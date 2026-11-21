import { describe, expect, it } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD, hexDistance } from '../src/simulation/board';
import { MEL_BOLT_SPAN_TICKS, MEL_BOLT_TICKS_PER_HEX, MEL_BOLTS_PER_TARGET, MEL_DASH_LAND_TICKS, MEL_RELEASE_TICKS, MEL_TARGET_STAGGER_TICKS, melBoltOffset } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Mel's cast (11-20, user-approved timing; dash and release aligned to the original frame by frame, bolt flight self-chosen):
// docs/S13_RULES_GAP.md (梅尔弹幕).
function start(): CombatState {
  const units: any[] = [{ id: 'mel', definitionId: 'mel', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 7 } } },
    { id: 'ally', definitionId: 'garen', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } },
    ...['amumu', 'sett', 'vi'].map((definitionId, i) => ({ id: `e${i}`, definitionId, team: 'enemy', starLevel: 3, location: { kind: 'board', cell: { col: 1 + 2 * i, row: 1 } } }))];
  const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
  const { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [], augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'mel', 7) as { state: CombatState };
  return { ...state, units: state.units.map(u => u.id === 'mel' ? { ...u, mana: u.maxMana } : { ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 }) };
}
function run(state: CombatState, n: number) { const out: { tick: number; events: readonly CombatEvent[] }[] = []; for (let i = 0; i < n && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); } return { state, out }; }
describe('Mel barrage timing', () => {
  const s0 = start(), r = run(s0, 60);
  const castAt = r.out.find(s => s.events.some(e => e.type === 'cast' && (e as any).receipt.source.ownerId === 'mel'))!.tick;
  it('her dash lands MEL_DASH_LAND_TICKS after the cast (the movement), not on the cast', () => {
    const moves = r.out.filter(s => s.tick > castAt && s.events.some(e => e.type === 'movement' && (e as any).unitId === 'mel')).map(s => s.tick);
    expect(moves[0]).toBe(castAt + MEL_DASH_LAND_TICKS);
  });
  it('her normal cast fires MEL_BOLTS_PER_TARGET bolts per target, staggered by target and spread over the span; each settles on arrival', () => {
    const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched' && (e as any).skill === 'mel-bolt') as any[]);
    const targets = [...new Set(launched.map(l => l.targetId))];
    expect(targets.length).toBeGreaterThan(0);
    expect(launched).toHaveLength(targets.length * MEL_BOLTS_PER_TARGET);
    expect(launched.every(l => l.count === targets.length * MEL_BOLTS_PER_TARGET)).toBe(true);
    const melCell = run(s0, castAt + MEL_RELEASE_TICKS - s0.tick).state.units.find(u => u.id === 'mel')!.cell;
    for (const l of launched) {
      const k = Math.floor(l.ordinal / MEL_BOLTS_PER_TARGET), i = l.ordinal % MEL_BOLTS_PER_TARGET;
      expect(l.tick).toBe(castAt + MEL_RELEASE_TICKS + k * MEL_TARGET_STAGGER_TICKS + melBoltOffset(i));
      const target = s0.units.find(u => u.id === l.targetId)!;
      expect(l.arrivalTick - l.tick).toBe(Math.max(1, hexDistance(melCell, target.cell) * MEL_BOLT_TICKS_PER_HEX));
      const landed = r.out.find(s => s.tick === l.arrivalTick)!;
      expect(landed.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel' && (e as any).outcome.context.targetId === l.targetId
        && (e as any).outcome.context.source.sourceKind === 'ability' && (e as any).outcome.context.ordinal === l.ordinal).length + 0).toBeLessThanOrEqual(1);
    }
    // One packet per bolt; per target they add up to the cast's per-target amount (split evenly, remainder first).
    for (const t of targets) {
      const raws = r.out.flatMap(s => s.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel' && (e as any).outcome.context.targetId === t
        && (e as any).outcome.context.source.sourceKind === 'ability').map(e => (e as any).outcome.context.raw ?? (e as any).raw));
      expect(raws).toHaveLength(MEL_BOLTS_PER_TARGET);
    }
    expect(r.out.filter(s => s.tick < castAt + MEL_RELEASE_TICKS).flatMap(s => s.events).filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel'
      && (e as any).outcome.context.source.sourceKind === 'ability')).toEqual([]);
  });
  it('a target that dies takes none of the bolts still flying or still to leave (hit false), and nobody else takes them', () => {
    const before = run(s0, castAt + MEL_RELEASE_TICKS - s0.tick).state;
    const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched' && (e as any).skill === 'mel-bolt') as any[]);
    const victim = launched[0]!.targetId;
    const mid = structuredClone(before); Object.assign(mid.units.find(u => u.id === victim)!, { hp: 0, alive: false });
    const after = run(mid, MEL_TARGET_STAGGER_TICKS * 3 + MEL_BOLT_SPAN_TICKS + 20);
    const landed = after.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLanded' && (e as any).skill === 'mel-bolt' && (e as any).targetId === victim) as any[]);
    expect(landed.length).toBeGreaterThan(0);
    expect(landed.every(l => l.hit === false)).toBe(true);
    const others = after.out.flatMap(s => s.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel'
      && (e as any).outcome.context.source.sourceKind === 'ability').map(e => (e as any).outcome.context.targetId));
    expect(others.filter(t => t === victim)).toEqual([]);
    expect(others.length).toBe((new Set(launched.map(l => l.targetId)).size - 1) * MEL_BOLTS_PER_TARGET);
  });
});
// 11-21 (Fable, from original footage): every normal cast dashes, even when she already stands by her allies; the third cast
// (the one that releases her stored energy) does not move. Where she lands is self-chosen. docs/S13_RULES_GAP.md (梅尔弹幕).
describe('Mel dash: every normal cast, never the third', () => {
  function beside(castCount: number) {
    const units: any[] = [{ id: 'mel', definitionId: 'mel', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 6 } } },
      { id: 'a1', definitionId: 'garen', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 2, row: 6 } } },
      { id: 'a2', definitionId: 'garen', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 4, row: 6 } } },
      ...['amumu', 'sett'].map((definitionId, i) => ({ id: `e${i}`, definitionId, team: 'enemy', starLevel: 3, location: { kind: 'board', cell: { col: 2 + 2 * i, row: 1 } } }))];
    const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
    const { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [], augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'mel-dash', 7) as { state: CombatState };
    const s = { ...state, units: state.units.map(u => u.id === 'mel' ? { ...u, mana: u.maxMana, moveCooldownTicks: 2000, runtime: { ...(u as any).runtime, castCount } } : { ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 }) } as CombatState;
    const r = run(s, 60);
    const cast = r.out.flatMap(o => o.events).find(e => e.type === 'cast' && (e as any).receipt.source.ownerId === 'mel') as any;
    const moves = r.out.flatMap(o => o.events.filter(e => e.type === 'movement' && (e as any).unitId === 'mel') as any[]).filter(m => m.tick >= cast.tick && m.tick <= cast.tick + MEL_RELEASE_TICKS);
    return { branch: cast.receipt.branch?.branch, moves, castTick: cast.tick };
  }
  it('a normal cast moves her one dash even beside two allies; the third cast keeps her where she is', () => {
    const seen = new Set<string>();
    for (const castCount of [0, 1, 2]) {
      const { branch, moves, castTick } = beside(castCount);
      seen.add(branch);
      if (branch === 'third') expect(moves, `castCount ${castCount}`).toEqual([]);
      else {
        expect(branch).toBe('normal');
        expect(moves.map(m => m.tick), `castCount ${castCount}`).toEqual([castTick + MEL_DASH_LAND_TICKS]);
        expect(hexDistance(moves[0].from, moves[0].to)).toBeGreaterThan(0);
      }
    }
    expect([...seen].sort()).toEqual(['normal', 'third']);
  });
});

// 11-21 (Fable): among equally good cells (same allies nearby, same distance) she goes away from the nearest enemy, on either
// side of the board. Self-chosen, not original data.
describe('Mel dash: ties go away from the nearest enemy', () => {
  function landing(team: 'player' | 'enemy') {
    const mine = team === 'player' ? { col: 3, row: 5 } : { col: 3, row: 2 }, foeRow = team === 'player' ? 1 : 6;
    const units: any[] = [{ id: 'mel', definitionId: 'mel', team, starLevel: 1, location: { kind: 'board', cell: mine } },
      ...['amumu', 'sett'].map((definitionId, i) => ({ id: `f${i}`, definitionId, team: team === 'player' ? 'enemy' : 'player', starLevel: 3, location: { kind: 'board', cell: { col: 2 + 2 * i, row: foeRow } } }))];
    const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
    const { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [], augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'mel-away', 7) as { state: CombatState };
    const s = { ...state, units: state.units.map(u => u.id === 'mel' ? { ...u, mana: u.maxMana, moveCooldownTicks: 2000 } : { ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 }) } as CombatState;
    const r = run(s, 40);
    const move = r.out.flatMap(o => o.events.filter(e => e.type === 'movement' && (e as any).unitId === 'mel') as any[])[0];
    return { from: mine, to: move?.to, foeRow };
  }
  it('lands one hex away, on the side away from the enemies, for both teams', () => {
    for (const team of ['player', 'enemy'] as const) {
      const { from, to, foeRow } = landing(team);
      expect(to, team).toBeDefined();
      expect(hexDistance(from, to)).toBe(1);
      expect(Math.abs(to.row - foeRow), team).toBeGreaterThan(Math.abs(from.row - foeRow));
    }
  });
});

// The barrage timing changes battle results, so its rule identifier is part of the content digest: a save or replay written
// under the digest just before it (Swain's drain) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:eb2d4cee';
describe('Mel barrage: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.melBarrage).toBe('mel-barrage-settle-on-landing-dash-each-normal-cast-away-from-foes-v3');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-mel', createdAt: '2026-11-21T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-mel']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
