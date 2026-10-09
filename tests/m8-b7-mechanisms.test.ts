import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { NEUTRAL_ENCOUNTERS } from '../src/simulation/content/neutral-encounters';
import { readCombatStats } from '../src/simulation/combat-s13';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { planOpening, commitOpening, validateOpeningState } from '../src/simulation/m8/opening';
import { freezeCompanions, registerDeaths, validateCompanionState } from '../src/simulation/m8/companions';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import type { Source, StatusKind } from '../src/simulation/m8/contracts';
import { battle, unit } from './combat-helpers';

const idle = (u: CombatUnit): CombatUnit => ({ ...u, cooldownTicks: 1000, moveCooldownTicks: 1000 });
const target = (id: string, col: number, row: number, hp = 500): CombatUnit => idle(unit(id, 'player', col, row, {
  hp, maxHp: hp, armor: 0, magicResist: 0, mana: 0, maxMana: 0,
  ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} },
}));
const start = (round: string, players: readonly CombatUnit[], patch: Partial<CombatState> = {}): CombatState => {
  const compiled = compileNeutralEncounter(round);
  return battle([...compiled.units, ...players], { combatId: 'b7-vector', rngState: 634785765, rngDraws: 0,
    openingDefinitions: compiled.openingDefinitions, ...patch });
};
function withStatus(u: CombatUnit, kind: StatusKind, magnitudeBps = 10000): CombatUnit {
  const source: Source = { ownerId: 'test-status-source', sourceKind: 'ability', definitionId: 'boundary-status', instanceId: 'boundary', effectIndex: 0, parentItemInstanceId: null };
  const { groups } = applyStatusContribution([], effectIdentity('b7-vector', source, u.id), {
    kind, magnitudeBps, activation: 'immediate', duration: { kind: 'ticks', ticks: 100 },
    stackPolicy: { kind: 'independent-instances' }, removable: true,
    polarity: kind === 'wound' ? 'harmful' : 'beneficial', damageFilter: null, onEnd: null,
  }, 0);
  return { ...u, mechanismState: { ...EMPTY_MECHANISMS, combatId: 'b7-vector', statuses: groups } };
}
const get = (state: CombatState, id: string) => state.units.find(u => u.id === id)!;

// Combat subjects always originate in compileNeutralEncounter. Altered HP/cooldowns or
// synthetic opponents isolate a mechanism; none of these vectors enable a Match round.
describe('B7 compiled neutral programs through the existing B3 executor', () => {
  it.each(NEUTRAL_ENCOUNTERS.map(e => e.roundId))('%s executes real authored units without mana/cast or input mutation', round => {
    const initial = start(round, [target('p', 3, 7, 100000)]);
    const before = JSON.stringify(initial);
    let state = initial;
    for (let n = 0; n < 50; n++) {
      const step = stepCombat(state); state = step.state;
      expect(step.events.some(e => e.type === 'cast')).toBe(false);
      expect(state.units.filter(u => u.team === 'enemy').every(u => u.mana === 0 && u.maxMana === 0)).toBe(true);
    }
    expect(JSON.stringify(initial)).toBe(before);
  });

  it.each([0, 3300])('krugs: actual two deaths, then separately sampled missing HP heals under wound=%i', wound => {
    const compiled = compileNeutralEncounter('2-7'), survivor = compiled.units[0];
    const krugs = compiled.units.map((u, i) => idle({ ...u, hp: i === 0 ? 200 : 1 }));
    if (wound) krugs[0] = withStatus(krugs[0], 'wound', wound);
    const killers = [target('killer2', 3, 4), target('killer3', 5, 4)].map(u => ({ ...u, cooldownTicks: 0 }));
    const initial = start('2-7', [], { units: [...krugs, ...killers] });
    const deathTick = stepCombat(initial);
    expect(deathTick.events.filter(e => e.type === 'death').map(e => e.unitId)).toEqual(compiled.units.slice(1).map(u => u.id));
    expect(deathTick.events.filter(e => e.type === 'heal')).toEqual([]);
    expect(get(deathTick.state, survivor.id).hp).toBe(200);
    expect(deathTick.state.companionState?.reactions.map(r => [r.executeAtTick, r.status])).toEqual([[2, 'pending'], [2, 'pending']]);
    const healed = stepCombat(deathTick.state);
    // floor(200*.67)=134, then floor(66*.67)=44. No early aggregation.
    expect(healed.events.flatMap(e => e.type === 'heal' ? [[e.requested, e.actual]] : [])).toEqual(wound ? [[200, 134], [66, 44]] : [[200, 200], [0, 0]]);
    expect(get(healed.state, survivor.id).hp).toBe(wound ? 378 : 400);
    expect(stepCombat(JSON.parse(JSON.stringify(deathTick.state)))).toEqual(healed);
    expect(stepCombat(healed.state).events.filter(e => e.type === 'heal')).toEqual([]);
    expect(healed.state.rngDraws).toBe(deathTick.state.rngDraws);
    validateCompanionState(healed.state.companionState!, 'b7-vector', compiled.units.flatMap(u => u.companionDefinitions ?? []), compiled.units);
  });

  it('krug scheduled healing cannot rescue its holder from the next damage batch', () => {
    const compiled = compileNeutralEncounter('2-7'), krugs = compiled.units.map((u, i) => idle({ ...u, hp: i ? 1 : 200 }));
    const killed = stepCombat(start('2-7', [], { units: [...krugs, ...[target('k2', 3, 4), target('k3', 5, 4)].map(u => ({ ...u, cooldownTicks: 0 }))] }));
    const doomed = stepCombat({ ...killed.state, units: [...killed.state.units,
      { ...target('executioner', 1, 4), attackDamage: 1000, attackDamageBase: 1000, cooldownTicks: 0 }] });
    expect(get(doomed.state, krugs[0].id).alive).toBe(false);
    expect(doomed.events.filter(e => e.type === 'heal')).toEqual([]);
    expect(doomed.state.companionState?.reactions.map(r => r.status)).toEqual(['cancelled', 'cancelled']);
  });

  it('five compiled wolves reserve the four back-row neighbor cells; last wolf consumes no-space once', () => {
    const compiled = compileNeutralEncounter('3-7'), units = [...compiled.units.map(idle), target('p', 3, 7)];
    const planned = planOpening('b7-vector', DEFAULT_BOARD, units, compiled.openingDefinitions);
    // From the approved five starts, ID order claims row7 col2/4, then row6 col3/4.
    expect(planned.plans.map(p => [p.to.col, p.to.row, p.result])).toEqual([
      [2, 7, 'moved'], [4, 7, 'moved'], [3, 6, 'moved'], [4, 6, 'moved'], [5, 3, 'no-space'],
    ]);
    expect(planOpening('b7-vector', DEFAULT_BOARD, [...units].reverse(), [...compiled.openingDefinitions].reverse())).toEqual(planned);
    const first = stepCombat(start('3-7', [], { units }));
    expect(first.events.filter(e => e.type === 'movement')).toHaveLength(4);
    expect(first.events.filter(e => e.type === 'packetDamage')).toEqual([]); expect(first.state.rngDraws).toBe(0);
    expect(first.state.openingState?.plans.every(p => p.consumed)).toBe(true);
    validateOpeningState(first.state.openingState!, 'b7-vector', DEFAULT_BOARD, compiled.openingDefinitions);
    const restored = stepCombat(JSON.parse(JSON.stringify(first.state)));
    expect(restored.events.filter(e => e.type === 'movement')).toEqual([]);
    expect(commitOpening(first.state.openingState!, first.state.units).movements).toEqual([]);
  });

  it.each([0, 1, 2, 5])('bird compiled post-death boundary: %i dead companions gives correct next-tick interval without resetting cooldown', count => {
    const compiled = compileNeutralEncounter('4-7'), holder = compiled.units[0], dead = compiled.units.slice(1, count + 1);
    // Explicit post-cleanup boundary (not a claim that these deaths were simulated).
    const definitions = compiled.units.flatMap(u => u.companionDefinitions ?? []);
    const live = compiled.units.filter(u => !dead.includes(u)).map(u => u.id);
    const ledger = registerDeaths(freezeCompanions('b7-vector', compiled.units, definitions), dead.map(u => ({
      combatId: 'b7-vector', tick: 1, deadUnitId: u.id, team: u.team, encounterId: u.encounterId!, monsterFamily: u.monsterFamily!, eventId: `death:${u.id}`,
    })), live);
    const units = compiled.units.map(u => dead.includes(u) ? { ...idle(u), hp: 0, alive: false } : { ...idle(u), cooldownTicks: 7 });
    const initial = start('4-7', [], { tick: 1, companionState: ledger, units: [...units, target('p', 6, 7)] });
    expect(readCombatStats(get(initial, holder.id), initial).attackIntervalTicks).toBe(25);
    const next = stepCombat(initial);
    // ceil(20 / (0.8*(1+0.15*n))) = 25,22,20,15 ticks for n=0,1,2,5.
    expect(readCombatStats(get(next.state, holder.id), next.state).attackIntervalTicks).toBe(({ 0: 25, 1: 22, 2: 20, 5: 15 } as Record<number, number>)[count]);
    expect(get(next.state, holder.id).cooldownTicks).toBe(6);
    expect(next.state.companionState?.reactions.filter(r => r.targetId === holder.id)).toHaveLength(count);
    expect(next.state.rngDraws).toBe(0);
    expect(stepCombat(JSON.parse(JSON.stringify(initial)))).toEqual(next);
    const again = stepCombat(next.state);
    expect(readCombatStats(get(again.state, holder.id), again.state).attackIntervalTicks).toBe(readCombatStats(get(next.state, holder.id), next.state).attackIntervalTicks);
    validateCompanionState(next.state.companionState!, 'b7-vector', definitions, compiled.units);
  });

  it('bird actual small-bird death grants its large companion one 1500Bps contribution at t+1', () => {
    const compiled = compileNeutralEncounter('4-7'), holder = compiled.units[0], victim = compiled.units[5];
    const units = compiled.units.map(u => idle({ ...u, hp: u.id === victim.id ? 1 : u.hp }));
    const first = stepCombat(start('4-7', [], { units: [...units, { ...target('p', 6, 4), cooldownTicks: 0 }] }));
    expect(first.events.filter(e => e.type === 'death').map(e => e.unitId)).toEqual([victim.id]);
    expect(readCombatStats(get(first.state, holder.id), first.state).attackIntervalTicks).toBe(25);
    const second = stepCombat(first.state);
    expect(readCombatStats(get(second.state, holder.id), second.state).attackIntervalTicks).toBe(22);
    const contributions = get(second.state, holder.id).mechanismState!.statuses.flatMap(g => g.contributions);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toMatchObject({ appliedAtTick: 2, application: { modifier: { stat: 'attackSpeed', value: { kind: 'constant', amount: 1500 } } } });
    expect(second.events.some(e => e.type === 'heal' || e.type === 'attack')).toBe(false);
  });

  it('dragon word0 gives 119 main damage and at most two 29 never-critical children, consuming exactly one combat word', () => {
    const players = [target('primary', 4, 2), target('a', 5, 2), target('b', 5, 1), target('c', 5, 3), target('d', 6, 2)];
    const initial = start('5-7', players), first = stepCombat(initial);
    // 0*10000 < 2500*2^32; floor(85*1.4)=119, floor(85*.35)=29.
    expect(first.events.flatMap(e => e.type === 'packetDamage' ? [[e.unitId, e.raw, e.hpDamage, e.critical, e.source.sourceKind]] : [])).toEqual([
      ['a', 29, 29, false, 'ability'], ['b', 29, 29, false, 'ability'], ['primary', 119, 119, true, 'attack'],
    ]);
    expect(players.map(u => [u.id, get(first.state, u.id).hp])).toEqual([['primary', 381], ['a', 471], ['b', 471], ['c', 500], ['d', 500]]);
    expect(first.events.filter(e => e.type === 'attack')).toHaveLength(1);
    expect(first.state.rngState).toBe(0); expect(first.state.rngDraws).toBe(1);
    expect(stepCombat(JSON.parse(JSON.stringify(initial)))).toEqual(first);
    const restored = stepCombat(JSON.parse(JSON.stringify(first.state)));
    expect(restored).toEqual(stepCombat(first.state));
    expect(restored.events.filter(e => e.type === 'packetDamage')).toEqual([]);
    expect(restored.state.rngDraws).toBe(1);
  });

  it.each([1000, 4000])('herald charge samples target maxHP=%i, caps at300 and stuns next tick for10 ticks', hp => {
    const compiled = compileNeutralEncounter('6-7');
    const initial = start('6-7', [], { units: [...compiled.units.map(idle), target('p', 3, 4, hp)] });
    const first = stepCombat(initial);
    expect(first.state.openingState?.plans[0]).toMatchObject({ path: [{ col: 4, row: 2 }, { col: 3, row: 3 }, { col: 3, row: 4 }, { col: 2, row: 5 }],
      targetIds: ['p'], to: { col: 2, row: 5 }, task: { executeAtTick: 1, status: 'executed' } });
    expect(first.events.find(e => e.type === 'packetDamage')).toMatchObject({ unitId: 'p', damageType: 'magic', raw: hp === 1000 ? 150 : 300, critical: false });
    expect(get(first.state, 'p').statuses?.find(s => s.kind === 'stun')).toMatchObject({ startsAtTick: 2, expiresAtTick: 12 });
    expect(first.events.filter(e => e.type === 'cast' || e.type === 'attack')).toEqual([]); expect(first.state.rngDraws).toBe(0);
    const second = stepCombat(JSON.parse(JSON.stringify(first.state)));
    expect(second.events.filter(e => e.type === 'packetDamage' || e.type === 'movement')).toEqual([]);
  });

  it('herald immunity blocks stun; prevention blocks damage but not the scheduled control', () => {
    for (const kind of ['control-immunity', 'damage-prevention'] as const) {
      const compiled = compileNeutralEncounter('6-7');
      const first = stepCombat(start('6-7', [], { units: [...compiled.units.map(idle), withStatus(target('p', 3, 4, 1000), kind)] }));
      expect(get(first.state, 'p').hp).toBe(kind === 'damage-prevention' ? 1000 : 850);
      expect(get(first.state, 'p').mechanismState?.statuses.some(g => g.kind === 'stun')).toBe(kind !== 'control-immunity');
    }
  });
});
