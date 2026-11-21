import { describe, expect, it } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD, hexDistance } from '../src/simulation/board';
import { MEL_BOLT_TICKS_PER_HEX, MEL_DASH_LAND_TICKS, MEL_RELEASE_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility } from '../src/persistence/compatibility';
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
  it('her bolts leave MEL_RELEASE_TICKS after the cast and settle on arrival (MEL_BOLT_TICKS_PER_HEX a hex), ten packets each', () => {
    const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched' && (e as any).skill === 'mel-barrage') as any[]);
    expect(launched.length).toBeGreaterThan(0);
    expect(launched.every(l => l.tick === castAt + MEL_RELEASE_TICKS)).toBe(true);
    const melCell = r.out.find(s => s.tick === castAt + MEL_RELEASE_TICKS) && run(s0, castAt + MEL_RELEASE_TICKS - s0.tick).state.units.find(u => u.id === 'mel')!.cell;
    for (const l of launched) {
      const target = s0.units.find(u => u.id === l.targetId)!;
      expect(l.arrivalTick - l.tick).toBe(Math.max(1, hexDistance(melCell!, target.cell) * MEL_BOLT_TICKS_PER_HEX));
      const landed = r.out.find(s => s.tick === l.arrivalTick)!;
      expect(landed.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel' && (e as any).outcome.context.targetId === l.targetId
        && (e as any).outcome.context.source.sourceKind === 'ability')).toHaveLength(10);
    }
    expect(r.out.filter(s => s.tick < castAt + MEL_RELEASE_TICKS).flatMap(s => s.events).filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'mel'
      && (e as any).outcome.context.source.sourceKind === 'ability')).toEqual([]);
  });
  it('a target that dies while the bolts fly takes nothing (hit false), nobody else', () => {
    const before = run(s0, castAt + MEL_RELEASE_TICKS - s0.tick).state;
    const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched' && (e as any).skill === 'mel-barrage') as any[]);
    const victim = launched[0]!;
    const mid = structuredClone(before); Object.assign(mid.units.find(u => u.id === victim.targetId)!, { hp: 0, alive: false });
    const after = run(mid, victim.arrivalTick - mid.tick);
    const landed = after.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLanded' && (e as any).ordinal === victim.ordinal) as any[]);
    expect(landed.map(l => [l.targetId, l.hit])).toEqual([[victim.targetId, false]]);
  });
});
describe('Mel barrage: files written before it', () => {
  it('has its own identifier; a save with an earlier digest is rejected', () => {
    expect(S13_COMBAT_RULES.melBarrage).toBe('dash-lands-10-bolts-leave-15-fly-2-per-hex-settle-on-landing-channel-until-release');
    const before = 'fnv1a32-utf16:3476d8d4';
    expect(CONTENT_DIGEST).not.toBe(before);
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-mel', createdAt: '2026-11-21T00:00:00Z', match: { ...readyMatch(42), contentDigest: before }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toMatchObject({ status: 'rejected', reason: 'digest-mismatch' });
  });
});
