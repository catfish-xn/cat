import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { samplePlanBindings, planEffectApplications } from '../src/simulation/m8/planning';
import { chooseRandomCenter, selectAbilityTargets } from '../src/simulation/m8/targeting';
import { freezeCompanions, registerDeaths, validateCompanionState, type CompanionDefinition, type CompanionReaction } from '../src/simulation/m8/companions';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { AbilityPlan, Effect } from '../src/simulation/m8/contracts';
import { source, trigger, amount, cast } from './fixtures/m8-contract-cases';
import { shiv } from './fixtures/m8-audit-definitions';
import { battle, unit } from './combat-helpers';

const dummy = (id: string, team: 'player'|'enemy', col: number, patch: Partial<CombatUnit> = {}): CombatUnit =>
  unit(id, team, col, 3, { ability: resolveAbility('neutral-attack', 1), hp: 1000, maxHp: 1000, armor: 0, magicResist: 0,
    attackDamage: 100, cooldownTicks: 1000, moveCooldownTicks: 1000, attackRange: 6, mana: 0, maxMana: 1000, runtime: { ...EMPTY_RUNTIME }, ...patch });
const defs = (eventTriggers: readonly ReturnType<typeof trigger>[]) => ({ periodicTasks: [], survivalTriggers: [], vamp: [], eventTriggers });

describe('B3 third audit: independent counterexamples before implementation', () => {
  it.each([false, true])('R1 earlier magic100 sees MR100 =>50; own35 sees MR70 =>20 (other root=%s)', otherRoot => {
    const ability = resolveAbility('kogmaw-ability', 1); if (ability.kind !== 's13') throw Error('fixture');
    const p = dummy('p', 'player', 1, { ability: { ...ability, variables: { ...ability.variables, DamageOnAttack: 1000000 } },
      cooldownTicks: 0, mechanismDefinitions: defs([{ ...shiv, source: source('audit-proc', 'i', 'p') }]) });
    let state = battle([p, dummy('z', 'enemy', 2, { hp: 10000, maxHp: 10000, magicResist: 100 })], { rngState: 42 });
    for (let i = 0; i < 2; i++) state = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) }).state;
    const earlier = dummy('a', 'player', 0, { ability: { ...ability, variables: { ...ability.variables, DamageOnAttack: 1000000 } }, cooldownTicks: 0 });
    const result = stepCombat({ ...state, units: [...state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u), ...(otherRoot ? [earlier] : [])] });
    const magic = result.events.flatMap(e => e.type === 'packetDamage' && e.damageType === 'magic' ? [[e.source.ownerId, e.raw, e.hpDamage]] : []);
    expect(magic).toEqual(otherRoot ? [['a', 100, 50], ['p', 100, 50], ['p', 35, 20]] : [['p', 100, 50], ['p', 35, 20]]);
    const applied = result.events.findIndex(e => e.type === 'statusChanged' && e.reason === 'applied' && e.group?.kind === 'shred');
    const own = result.events.findIndex(e => e.type === 'packetDamage' && e.raw === 35);
    const prior = result.events.findIndex(e => e.type === 'packetDamage' && e.source.ownerId === 'p' && e.damageType === 'magic' && e.raw === 100);
    expect(applied).toBeGreaterThan(prior); expect(applied).toBeLessThan(own);
  });

  it.each(['kill', 'assist', 'dead'] as const)('R2 counter-only kill-or-assist subscription: %s', scenario => {
    const d = trigger({ source: source('reward', 'i', 'a'), event: 'counter-updated',
      counters: [{ id: 'kills', events: [{ event: 'kill-or-assist', listener: { subject: 'actor', relationToHolder: 'self', withinHexes: null }, qualifies: 'completed-event' }], scope: 'source-instance', reset: 'combat-start', cap: null }],
      effects: [{ kind: 'grant-mana', amount: 7, reason: 'attack', bypassLock: 'none' }] });
    const a = dummy('a', 'player', 1, { ability: resolveAbility('zyra-ability', 1), cooldownTicks: 0, attackDamage: scenario === 'kill' ? 100 : 10, hp: scenario === 'dead' ? 10 : 1000, mechanismDefinitions: defs([d]) });
    const allies = scenario === 'kill' ? [] : [dummy('b', 'player', 0, { cooldownTicks: 0 })];
    const result = stepCombat(battle([a, ...allies, dummy('e', 'enemy', 2, { hp: 50 }), dummy('z', 'enemy', 3, { cooldownTicks: scenario === 'dead' ? 0 : 1000 })], { rngState: 42 }));
    const holder = result.state.units.find(u => u.id === 'a')!;
    if (scenario === 'dead') { expect(holder.hp).toBe(0); expect(holder.mana).toBe(0); expect(holder.triggerLedger?.runtimes ?? []).toEqual([]); }
    else { expect(holder.mana).toBe(17); expect(holder.triggerLedger?.runtimes[0].counters).toEqual({ kills: 1 }); }
    expect(result.state.units.find(u => u.id === 'z')?.alive).toBe(true);
  });

  const hit = (n: number): Effect => ({ kind: 'damage', damageType: 'physical', delivery: 'ability-direct', critEligibility: 'never', amount: amount(n) });
  const plan: AbilityPlan = { source: source('plan', 'i', 'h'), cast: cast(), snapshots: {}, triggers: [], operations: [
    { kind: 'center-and-area', center: { kind: 'bound-selection' }, areaEffects: [hit(100)], centerEffects: [hit(200)] },
  ] };
  const env = { board: DEFAULT_BOARD, holderId: 'h', tick: 1, units: [dummy('h', 'player', 1), dummy('A', 'enemy', 2), dummy('B', 'enemy', 3)] };
  const random = { kind: 'random-enemy-center', areaOrder: 'id', radius: 1, rng: 'combat', mapping: 'word-modulo-id-sorted-count', draws: 1 } as const;
  it('R3 bound area[A,B] and explicit centerB survive JSON; execution makes no new draw', () => {
    let draws = 0;
    const center = chooseRandomCenter(env, () => { draws++; return 1; });
    const selection = selectAbilityTargets(random, { ...env, randomCenterId: center });
    expect(selection).toEqual({ targetIds: ['A', 'B'], centerId: 'B' });
    const boundEnv = { ...env, boundTargetIds: selection.targetIds, boundCenterId: selection.centerId };
    const result = planEffectApplications(plan, boundEnv, { centers: {} });
    expect(result.effects.map(e => [e.targetId, e.effects])).toEqual([['A', [hit(100)]], ['B', [hit(100)]], ['B', [hit(200)]]]);
    expect(planEffectApplications(JSON.parse(JSON.stringify(plan)), JSON.parse(JSON.stringify(boundEnv)), { centers: {} })).toEqual(result);
    expect(draws).toBe(1);
  });
  it('R3 explicit null does not borrow a stale bound target for center damage', () => {
    const boundEnv = { ...env, boundTargetIds: ['A'], boundCenterId: null };
    expect(planEffectApplications(plan, boundEnv, { centers: {} }).effects.map(e => [e.targetId, e.effects])).toEqual([['A', [hit(100)]]]);
  });
  it('R3 empty random candidates consume zero words and null never becomes a stale center', () => {
    const empty = { ...env, boundTargetIds: ['A'], units: [env.units[0]] };
    const randomPlan: AbilityPlan = { ...plan, operations: [{ kind: 'center-and-area', center: random, areaEffects: [hit(100)], centerEffects: [hit(200)] }] };
    let draws = 0; const bindings = samplePlanBindings(randomPlan, empty, () => { draws++; return 0; });
    expect(bindings).toEqual({ centers: { 0: null } });
    expect(planEffectApplications(randomPlan, empty, bindings).effects).toEqual([]); expect(draws).toBe(0);
  });

  it.each([false, true])('R4 aim excludes untargetable; path includes it; separate prevention=%s', prevention => {
    const statuses = (['untargetable', ...(prevention ? ['damage-prevention'] : [])] as ('untargetable'|'damage-prevention')[]).flatMap((kind, index) =>
      applyStatusContribution([], effectIdentity('standalone', { ...source('phase', 'i', 'p'), effectIndex: index }, 'p'), {
        kind, magnitudeBps: 10000, activation: 'immediate', duration: { kind: 'ticks', ticks: 20 }, stackPolicy: { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' },
        removable: false, polarity: 'beneficial', damageFilter: null, onEnd: null,
      }, 0).groups);
    const units = [dummy('h', 'player', 3, { cell: { col: 3, row: 1 } }), dummy('p', 'enemy', 3, { cell: { col: 3, row: 3 }, mechanismState: { ...EMPTY_MECHANISMS, statuses } }), dummy('v', 'enemy', 3, { cell: { col: 3, row: 4 } })];
    const result = stepCombat(battle(units, { openingDefinitions: [{ kind: 'path-charge', source: { ...source('opening', 'h', 'h'), sourceKind: 'ability' }, effects: [
      { kind: 'damage', damageType: 'magic', delivery: 'ability-direct', critEligibility: 'never', amount: amount(0, { maxHpBps: 1500, hpBasis: 'target', cap: 300, sample: 'packet' }) },
    ] }] }));
    expect(result.state.openingState?.plans[0]).toMatchObject({ aimId: 'v', targetIds: ['p', 'v'], path: [{ col: 4, row: 2 }, { col: 3, row: 3 }, { col: 3, row: 4 }, { col: 2, row: 5 }] });
    expect(result.events.flatMap(e => e.type === 'packetDamage' ? [[e.unitId, e.hpDamage]] : [])).toEqual([['p', prevention ? 0 : 150], ['v', 150]]);
  });

  const members = ['a', 'b', 'c'].map(id => ({ id, team: 'enemy' as const, unitKind: 'neutral' as const, encounterId: 'enc', monsterFamily: 'family' }));
  const def: CompanionDefinition = { source: { ...source('reaction', 'i', 'a'), sourceKind: 'ability' }, maxReactions: 1, effects: [{ kind: 'heal', amount: amount(10) }] };
  const deaths = ['b', 'c'].map(deadUnitId => ({ combatId: 'battle', tick: 10, deadUnitId, team: 'enemy' as const, encounterId: 'enc', monsterFamily: 'family', eventId: `death-${deadUnitId}` }));
  it.each(['pending', 'executed', 'cancelled'] as const)('R5 max1 rejects two identities including %s; one identity remains valid', status => {
    const unlimited = registerDeaths(freezeCompanions('battle', members, [{ ...def, maxReactions: 2 }]), deaths, ['a']);
    const state = { ...freezeCompanions('battle', members, [def]), reactions: unlimited.reactions.map((r, i): CompanionReaction => ({ ...r, status: i ? 'pending' : status })) };
    expect(() => validateCompanionState(JSON.parse(JSON.stringify(state)), 'battle', [def], members)).toThrow(/limit|count|maximum/i);
    expect(() => validateCompanionState({ ...state, reactions: state.reactions.slice(0, 1) }, 'battle', [def], members)).not.toThrow();
  });
  it('R5 separate effectIndex and parentItemInstanceId each have their own max1 allowance', () => {
    const definitions = [def, { ...def, source: { ...def.source, effectIndex: 1 } }, { ...def, source: { ...def.source, parentItemInstanceId: 'parent' } }];
    const state = registerDeaths(freezeCompanions('battle', members, definitions), deaths, ['a']);
    expect(state.reactions).toHaveLength(3);
    expect(() => validateCompanionState(JSON.parse(JSON.stringify(state)), 'battle', definitions, members)).not.toThrow();
  });
});
