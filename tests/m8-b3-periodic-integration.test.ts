import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import type { Effect, PeriodicTask, StatusApplication } from '../src/simulation/m8/contracts';
import { amount, source, selector, modifier, trigger } from './fixtures/m8-contract-cases';
import { battle, unit } from './combat-helpers';
function dummy(id: string, team: 'player' | 'enemy', col: number, hp = 1000): CombatUnit {
  return unit(id, team, col, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp, maxHp: 1000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1, cooldownTicks: 1000, moveCooldownTicks: 1000, attackRange: 6, attackDamage: 0, statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME } });
}
function advance(state: CombatState, count: number) { const events: CombatEvent[] = []; for (let i = 0; i < count && state.status === 'running'; i++) { const next = stepCombat(state); state = next.state; events.push(...next.events); } return { state, events }; }
const definitions = (periodicTasks: PeriodicTask[]) => ({ periodicTasks, survivalTriggers: [], vamp: [] });
const app = (kind: StatusApplication['kind'], bps: number, ticks: number): StatusApplication => ({ kind, magnitudeBps: bps, activation: 'immediate', duration: { kind: 'ticks', ticks }, stackPolicy: { kind: 'strongest-category', category: kind, retainSuppressed: true }, polarity: 'harmful', removable: true, damageFilter: null, onEnd: null });
const redemption = (): PeriodicTask => { const s = source('redemption', 'r', 'p'); return { ...effectIdentity('standalone', s, 'p'), nextPulseAtTick: 100, periodTicks: 100, endsAtTick: null, pulseOrdinal: 0, pulseLimit: null, remainders: [], finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel', program: { definitionId: 'redemption-pulse', targetSnapshot: 'once-per-pulse', selector: selector({ relation: 'ally', radius: 1, maxTargets: 100, sample: 'each-pulse' }), effects: [
  { kind: 'heal', amount: amount(0, { missingHpBps: 1500, hpBasis: 'target', cap: 1000, sample: 'each-pulse' }) },
  { kind: 'apply-status', status: { ...app('damage-reduction', 1000, 100), activation: 'next-tick', polarity: 'beneficial', removable: false, damageFilter: { deliveries: 'all', damageTypes: ['physical','magic'], redirected: 'exclude' } } },
] } }; };
describe('B2 A06/A07/R1 programs on the production tick pipeline', () => {
  it('Redemption100 selects one set, A0/B1 carry1500/3500; B leaves with state retained, A returns with3000', () => {
    const p = { ...dummy('p','player',1,600), mechanismDefinitions: definitions([redemption()]) };
    const first = advance(battle([p,dummy('A','player',2,999),{ ...dummy('B','player',1,991), cell: { col: 1, row: 2 } },dummy('e','enemy',6)]),100);
    expect(first.events.filter(e => e.type === 'heal').map(e => [e.unitId,e.requested])).toEqual([['A',0],['B',1],['p',60]]);
    expect(first.state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks[0].remainders.map(r => [r.targetId,r.numerator])).toEqual([['A',1500],['B',3500]]);
    const departed = { ...first.state, units: first.state.units.map(u => u.id === 'B' || u.id === 'A' ? { ...u, cell: { col: 6, row: u.id === 'A' ? 0 : 1 } } : u) };
    const middle = advance(departed,100);
    expect(middle.events.filter(e => e.type === 'heal').map(e => e.unitId)).toEqual(['p']);
    expect(middle.state.units.find(u => u.id === 'B')!.mechanismState!.statuses[0].contributions[0].expiresAtTick).toBe(201);
    const returned = { ...middle.state, units: middle.state.units.map(u => u.id === 'A' ? { ...u, cell: { col: 2, row: 3 } } : u) };
    const third = advance(JSON.parse(JSON.stringify(returned)),100);
    expect(third.state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks[0].remainders.find(r => r.targetId === 'A')!.numerator).toBe(3000);
    expect(third.state.units.find(u => u.id === 'B')!.mechanismState!.statuses).toEqual([]);
  });
  it('source death cancels Redemption future pulses while ally contribution continues to201', () => {
    const p = { ...dummy('p','player',1,100), mechanismDefinitions: definitions([redemption()]) };
    const first = advance(battle([p,dummy('A','player',2,500),dummy('e','enemy',6)]),100);
    const death = stepCombat({ ...first.state, units: first.state.units.map(u => u.id === 'e' ? { ...u, cell: { col: 0, row: 3 }, cooldownTicks: 0, attackDamage: 1000 } : u) });
    expect(death.state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks).toEqual([]);
    expect(death.state.units.find(u => u.id === 'A')!.mechanismState!.statuses[0].contributions[0].expiresAtTick).toBe(201);
    const after = advance(death.state,99);
    expect(after.events.filter(e => e.type === 'heal')).toEqual([]);
  });
  it('burn strong terminal40 pays20 once; weak recovers60; refresh preserves source fractional remainder', () => {
    const weak = source('unknown-weak','w','p'), strong = source('unknown-strong','s','p');
    let groups = applyStatusContribution([],effectIdentity('standalone',weak,'e'),app('burn',100,80),0).groups;
    groups = applyStatusContribution(groups,effectIdentity('standalone',strong,'e'),app('burn',200,40),0).groups;
    const e = { ...dummy('e','enemy',2), mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } };
    const result = advance(battle([dummy('p','player',1),e]),80);
    expect(result.events.filter((e): e is Extract<CombatEvent, { type: 'packetDamage' }> => e.type === 'packetDamage' && e.damageType === 'true').map(e => [e.tick,e.raw,e.source.instanceId])).toEqual([[20,20,'s'],[40,20,'s'],[60,10,'w'],[80,10,'w']]);
    expect(result.state.units.find(u => u.id === 'e')!.hp).toBe(940);
    expect(result.state.units.find(u => u.id === 'e')!.mechanismState!.periodicTasks).toEqual([]);
  });
  it('night prevention naturally ending at30 grants1500AS once; control/immunity are independently removed', () => {
    const s = source('night','n','p');
    const reward: Effect = { kind: 'modify-stat', activation: 'immediate', stackPolicy: { kind: 'independent-instances' }, duration: { kind: 'combat' }, modifier: modifier('attackSpeed',1500,{unit:'bps'}) };
    const groups = applyStatusContribution([],effectIdentity('standalone',s,'p'),{ ...app('damage-prevention',10000,20), polarity: 'beneficial', removable: false, onEnd: { reasons: ['expired'], timing: 'expiry-before-actions', effects: [reward] } },10).groups;
    const first = advance({ ...battle([{ ...dummy('p','player',1), mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } },dummy('e','enemy',2)]),tick:10 },19);
    const next = stepCombat(JSON.parse(JSON.stringify(first.state)));
    expect(next.state.units.find(u => u.id === 'p')!.mechanismState!.statuses.flatMap(g => g.contributions).map(c => c.application.modifier?.value)).toEqual([{kind:'constant',amount:1500}]);
    expect(stepCombat(JSON.parse(JSON.stringify(next.state))).state.units.find(u => u.id === 'p')!.mechanismState!.statuses[0].contributions).toHaveLength(1);
  });  it('post-damage cleanse removes hostile burn/wound/control and future attached tasks, retaining friendly immunity', () => {
    let groups = applyStatusContribution([],effectIdentity('standalone',source('hostile','b','e'),'p'),app('burn',100,100),0).groups;
    groups = applyStatusContribution(groups,effectIdentity('standalone',source('hostile','w','e'),'p'),app('wound',3300,100),0).groups;
    groups = applyStatusContribution(groups,effectIdentity('standalone',source('hostile','c','e'),'p'),app('stun',0,100),0).groups;
    groups = applyStatusContribution(groups,effectIdentity('standalone',source('friendly','q','p'),'p'),{ ...app('control-immunity',10000,100), polarity: 'beneficial', removable: false },0).groups;
    const night = trigger({ source: source('unknown-night','n','p'), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, maxPerCombat: 1, condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 6000 }, effects: [{ kind: 'cleanse', remove: 'removable-hostile-control-dot-debuff', retarget: true }] });
    const p = { ...dummy('p','player',1,700), mechanismDefinitions: { ...definitions([]), survivalTriggers: [night] }, mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } };
    const e = { ...dummy('e','enemy',2), cooldownTicks: 0, attackDamage: 300 };
    const result = stepCombat(battle([p,e]));
    const target = result.state.units.find(u => u.id === 'p')!;
    expect(target.hp).toBe(400);
    expect(target.mechanismState!.statuses.map(g => g.kind)).toEqual(['control-immunity']);
    expect(target.mechanismState!.periodicTasks).toEqual([]);
    expect(result.events.filter(e => e.type === 'statusChanged' && e.reason === 'cleansed')).toHaveLength(3);
  });

  it.each(['expiry', 'cleanse'] as const)('R3 %s of short status preserves an independent same-key timer and applies again at40', reason => {
    const s = source('anonymous', 'timer', 'p');
    const status: StatusApplication = { ...app('stat-buff', 0, 10), activation: 'next-tick', polarity: 'beneficial', removable: false,
      stackPolicy: { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' }, modifier: modifier('armor', 10) };
    // Timer and status deliberately use the same identity in separate namespaces.
    const timer: PeriodicTask = { ...redemption(), ...effectIdentity('standalone', s, 'p'), nextPulseAtTick: 20, periodTicks: 20,
      program: { definitionId: 'anonymous', targetSnapshot: 'once-per-pulse', selector: selector(), effects: [{ kind: 'apply-status', status }] } };
    let state = advance(battle([{ ...dummy('p','player',1), mechanismDefinitions: definitions([timer]) }, dummy('e','enemy',2)]), 20).state;
    const first = state.units.find(u => u.id === 'p')!;
    expect(first.mechanismState!.statuses[0].contributions[0]).toMatchObject({ key: timer.key, appliedAtTick: 21, expiresAtTick: 31 });
    if (reason === 'cleanse') {
      // Hostile ordinary debuff shares the holder timer key, yet remains independently removable.
      const hostile = source('anonymous', 'timer', 'e');
      const task = { ...timer, ...effectIdentity('standalone', hostile, 'p'), program: { ...timer.program, selector: selector({ candidates: 'bound-target', relation: 'enemy' }) } };
      const groups = applyStatusContribution([], effectIdentity('standalone', hostile, 'p'), { ...status, kind: 'stat-debuff', polarity: 'harmful', removable: true, modifier: modifier('armor', -10) }, 20).groups;
      const cleanse = trigger({ source: source('cleanser','n','p'), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, maxPerCombat: 1, effects: [{ kind: 'cleanse', remove: 'removable-hostile-control-dot-debuff', retarget: true }] });
      state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, mechanismDefinitions: { ...definitions([task]), survivalTriggers: [cleanse] }, mechanismState: { ...u.mechanismState!, statuses: groups, periodicTasks: [{ ...task, nextPulseAtTick: 40, pulseOrdinal: 1 }] } } : { ...u, cooldownTicks: 0, attackDamage: 1 }) };
      const cleaned = stepCombat(state); state = cleaned.state;
      expect(cleaned.events.filter(e => e.type === 'statusChanged' && e.reason === 'cleansed')).toHaveLength(1);
      expect(state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks).toHaveLength(1);
    }
    state = advance(state, 31 - state.tick).state;
    expect(state.units.find(u => u.id === 'p')!.mechanismState!.statuses).toEqual([]);
    expect(state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks[0].nextPulseAtTick).toBe(40);
    const next = advance(state, 9);
    expect(next.events.filter(e => e.type === 'statusChanged' && e.reason === 'applied')).toHaveLength(1);
    expect(next.state.units.find(u => u.id === 'p')!.mechanismState!.statuses[0].contributions[0]).toMatchObject({ appliedAtTick: 41, expiresAtTick: 51 });
    expect(next.state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks[0].nextPulseAtTick).toBe(60);
  });

});
