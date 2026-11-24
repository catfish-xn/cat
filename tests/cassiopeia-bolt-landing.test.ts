import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { CASSIOPEIA_BOLT_LAUNCH_TICKS, cassiopeiaBoltFlightTicks } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Cassiopeia's main bolt (11-24, authorization ②, timing only; docs/S13_RULES_GAP.md 卡西奥佩娅主弹): it leaves
// CASSIOPEIA_BOLT_LAUNCH_TICKS after her cast and settles where it lands, cassiopeiaBoltFlightTicks(hexes) later; its amount is
// taken on the cast. A target that dies in flight
// takes nothing and no other one is picked. The every-third-cast splash still settles on the cast.
function cass(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 3, 7, { definitionId: 'cassiopeia', starLevel: 1, ability: resolveAbility('cassiopeia-ability', 1), hp: 5000, maxHp: 5000,
    armor: 0, magicResist: 0, mana: 100, maxMana: 100, attackDamage: 0, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 1,
    cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
function dummy(id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000,
    armor: 0, magicResist: 0, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
}
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
const mine = (out: { tick: number; events: readonly CombatEvent[] }[], target: string) =>
  out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability' && x.unitId === target).map(x => [s.tick, x.raw]));

describe('Cassiopeia main bolt settles where it lands', () => {
  it('leaves CASSIOPEIA_BOLT_LAUNCH_TICKS after the cast and lands cassiopeiaBoltFlightTicks(hexes) after that; nothing before', () => {
    for (const row of [5, 3, 1]) {
      const start = battle([cass(), dummy('e', 3, row)], { rngState: 42 }), cast = start.tick + 1;
      const flight = cassiopeiaBoltFlightTicks(hexDistance({ col: 3, row: 7 }, { col: 3, row }));
      const r = run(start, CASSIOPEIA_BOLT_LAUNCH_TICKS + flight + 2), launch = cast + CASSIOPEIA_BOLT_LAUNCH_TICKS;
      const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched'));
      expect(launched).toMatchObject([{ tick: launch, sourceId: 'p', targetId: 'e', skill: 'cassiopeia-bolt', arrivalTick: launch + flight }]);
      const hits = mine(r.out, 'e');
      expect(hits.length).toBe(1);
      expect(hits[0]![0]).toBe(launch + flight);
      expect(r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLanded'))).toMatchObject([{ tick: launch + flight, skill: 'cassiopeia-bolt', hit: true }]);
    }
  });
  it('a target dead in flight takes nothing and no other enemy is hit instead', () => {
    const start = battle([cass(), dummy('e', 3, 3), dummy('f', 4, 3)], { rngState: 42 });
    const cast = run(start, CASSIOPEIA_BOLT_LAUNCH_TICKS + 1).state;
    const dead = structuredClone(cast);
    const aimed = cast.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'skillShot')!.targetId!;
    Object.assign(dead.units.find(u => u.id === aimed)!, { hp: 0, alive: false });
    const r = run(dead, 16);
    expect(r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLanded'))).toMatchObject([{ targetId: aimed, hit: false }]);
    expect([...mine(r.out, 'e'), ...mine(r.out, 'f')]).toEqual([]);
  });
});

// The bolt timing changes battle results, so its rule identifier is part of the content digest: a save written under the digest
// just before it (Sevika's punch) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:cf1ef035';
describe('Cassiopeia main bolt: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.cassiopeiaBolt).toBe('cassiopeia-main-bolt-settles-on-landing-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-cassiopeia-bolt', createdAt: '2026-11-24T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-cassiopeia-bolt']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
