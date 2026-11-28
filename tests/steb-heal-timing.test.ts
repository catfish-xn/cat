import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { STEB_HEAL_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { packets, heals } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Steb's heal (11-24, authorization ②, timing only; docs/S13_RULES_GAP.md 斯特卜治疗): his strike stays on the cast, his heal
// lands STEB_HEAL_TICKS later (the amount taken on the cast); he takes no heal if he dies first.
function steb(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: 'steb', ability: resolveAbility('steb-ability', 1), hp: 3000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 1, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
const dummy = (): CombatUnit => unit('e', 'enemy', 2, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000,
  mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
describe('Steb heal lands after his cast', () => {
  it('the strike on the cast, the heal STEB_HEAL_TICKS later, nothing of the heal before', () => {
    const start = battle([steb(), dummy()], { rngState: 42 }), cast = start.tick + 1;
    const r = run(start, STEB_HEAL_TICKS + 2);
    const struck = r.out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability').map(() => s.tick));
    const healed = r.out.flatMap(s => heals(s.events).filter(x => x.unitId === 'p').map(x => [s.tick, x.actual]));
    expect(struck).toEqual([cast]);
    expect(healed.map(h => h[0])).toEqual([cast + STEB_HEAL_TICKS]);
    expect(healed[0]![1]).toBeGreaterThan(0);
  });
  it('dead before the heal lands: no heal', () => {
    const start = battle([steb(), dummy()], { rngState: 42 });
    const after = structuredClone(run(start, 1).state);
    Object.assign(after.units.find(u => u.id === 'p')!, { hp: 0 });
    const r = run(after, STEB_HEAL_TICKS + 1);
    expect(r.out.flatMap(s => heals(s.events).filter(x => x.unitId === 'p'))).toEqual([]);
  });
});

// The heal timing changes battle results, so its rule identifier is part of the content digest: a save written under the digest
// just before it (Cassiopeia's main bolt) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:eb067864';
describe('Steb heal: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.stebHeal).toBe('steb-heal-lands-after-cast-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-steb-heal', createdAt: '2026-11-24T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-steb-heal']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
