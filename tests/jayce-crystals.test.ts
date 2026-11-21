import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { hexDistance } from '../src/simulation/board';
import { JAYCE_CRYSTAL_BLASTS, JAYCE_CRYSTAL_LANDS, JAYCE_MAIN_HIT_TICKS, jayceCrystalBlastTick, jayceCrystalChainPlace, jayceCrystalLandTick } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Jayce's ranged cast (11-21): crystals land, stay, and explode one after another around their cells; where the tooltip is
// silent the reading is self-chosen (docs/S13_RULES_GAP.md 杰斯水晶连锁).
const jayce = () => unit('p', 'player', 3, 7, { definitionId: 'jayce', ability: resolveAbility('jayce-ranged-ability', 2), starLevel: 2, hp: 100000, maxHp: 100000, armor: 0, magicResist: 0,
  mana: 100, maxMana: 100, attackDamage: 100, attackRange: 20, abilityPower: 100, baseAttackSpeedBps: 1, cooldownTicks: 2000, moveCooldownTicks: 2000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] } as unknown as CombatUnit);
const foe = (id: string, col: number, row: number, hp = 1000000) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
  hp, maxHp: hp, mana: 0, maxMana: 1, attackDamage: 0, armor: 0, magicResist: 0, cooldownTicks: 100000, moveCooldownTicks: 100000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] } as unknown as CombatUnit);
type Step = { tick: number; events: readonly CombatEvent[] };
function run(state: CombatState, n: number) { const out: Step[] = []; for (let i = 0; i < n && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: r.state.tick, events: r.events }); } return { state, out }; }
// a nearest; b and c beside each other, farther, and b one hex from a.
const scene = (hp?: number) => battle([jayce(), foe('a', 3, 4, hp), foe('b', 4, 3), foe('c', 5, 3)], { strategy: { traits: [], units: [] }, combatId: 'jayce-crystals', rngState: 42 } as any);

describe("Jayce's crystals", () => {
  const start = scene(), r = run(start, JAYCE_CRYSTAL_BLASTS[2]! + 5);
  const cast = r.out.find(s => s.events.some(e => e.type === 'cast'))!.tick;
  const crystals = r.out.flatMap(s => s.events.filter(e => e.type === 'jayceCrystal') as any[]);
  const hits = r.out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === 'ability').map(p => ({ tick: s.tick, target: p.unitId, raw: p.raw })));
  it('three crystals land on the three nearest enemies at their landing ticks and stay on those cells', () => {
    const landed = crystals.filter(c => c.phase === 'landed');
    expect(landed.map(c => [c.tick - cast, c.crystal, c.count])).toEqual([0, 1, 2].map(i => [jayceCrystalLandTick(i), i, 3]));
    expect(landed.map(c => `${c.cell.col},${c.cell.row}`)).toEqual(['3,4', '4,3', '5,3']);
    expect(crystals.filter(c => c.phase === 'exploded').map(c => `${c.cell.col},${c.cell.row}`).sort()).toEqual(['3,4', '4,3', '5,3']);
  });
  it('they explode one after another in chain order (nearest, then farthest back), the main hit before', () => {
    const exploded = crystals.filter(c => c.phase === 'exploded');
    expect(exploded.map(c => [c.crystal, c.tick - cast])).toEqual([0, 2, 1].map(i => [i, jayceCrystalBlastTick(jayceCrystalChainPlace(i, 3))]));
    expect(hits.filter(h => h.tick - cast < JAYCE_MAIN_HIT_TICKS)).toEqual([]);
    expect(hits.filter(h => h.tick - cast === JAYCE_MAIN_HIT_TICKS)).toEqual([{ tick: cast + JAYCE_MAIN_HIT_TICKS, target: 'a', raw: hits.find(h => h.target === 'a')!.raw }]);
  });
  it('each explosion hits the enemies within 1 hex of its crystal; the nearest takes none from its own crystal; later explosions on one enemy are halved, not compounded', () => {
    const blastAt = (i: number) => cast + jayceCrystalBlastTick(jayceCrystalChainPlace(i, 3));
    const near = (cell: string, id: string) => { const [col, row] = cell.split(',').map(Number); const u = start.units.find(x => x.id === id)!; return hexDistance({ col: col!, row: row! }, u.cell) <= 1; };
    const full = hits.find(h => h.tick === blastAt(0) || h.tick === blastAt(2))!.raw;
    const seen = new Map<string, number>(), expected: { tick: number; target: string; raw: number }[] = [];
    for (const [i, cell] of [[0, '3,4'], [2, '5,3'], [1, '4,3']] as const)
      for (const id of ['a', 'b', 'c'].filter(id => near(cell, id) && !(id === 'a' && i === 0))) {
        const n = seen.get(id) ?? 0; seen.set(id, n + 1);
        expected.push({ tick: blastAt(i), target: id, raw: n ? Math.floor(full / 2) : full });
      }
    expect(expected.length).toBeGreaterThan(3);
    expect(expected.some(e => e.raw < full)).toBe(true);
    expect(hits.filter(h => h.tick - cast > JAYCE_MAIN_HIT_TICKS)).toEqual(expected);
  });
  it('an enemy that dies before an explosion takes nothing from it, and no one else takes its share', () => {
    const mid = structuredClone(run(start, cast + JAYCE_MAIN_HIT_TICKS - start.tick).state);
    Object.assign(mid.units.find(u => u.id === 'b')!, { hp: 0, alive: false });
    const after = run(mid, JAYCE_CRYSTAL_BLASTS[2]! + 5);
    const later = after.out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === 'ability').map(p => p.unitId));
    expect(later).not.toContain('b');
    expect(later.length).toBe(hits.filter(h => h.tick - cast > JAYCE_MAIN_HIT_TICKS && h.target !== 'b').length);
  });
});

const BEFORE_DIGEST = 'fnv1a32-utf16:93d4dcc9';
describe("Jayce's crystals: files written before them", () => {
  it('the constants, the rule identifier, and the digest moved', () => {
    expect([JAYCE_CRYSTAL_LANDS, JAYCE_MAIN_HIT_TICKS, JAYCE_CRYSTAL_BLASTS]).toEqual([[11, 14, 15], 33, [35, 37, 40]]);
    expect(S13_COMBAT_RULES.jayceCrystals).toBe('jayce-crystals-land-then-chain-explode-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-jayce', createdAt: '2026-11-21T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-jayce']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
