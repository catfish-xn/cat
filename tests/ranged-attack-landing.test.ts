import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, variable } from '../src/simulation/combat-s13-state';
import { rangedAttackFlightTicks, rangedAttackWindupTicks } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Ranged attack landing (fitted, not original data): a ranged hero's basic attack settles when its shot arrives,
// rangedAttackFlightTicks(hexes on the attack tick) later; melee attacks are unchanged. docs/S13_RULES_GAP.md.
function shooter(name: string, range: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 3, 6, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 3000, maxHp: 3000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1000, attackDamage: 100, attackRange: range, abilityPower: 100, baseAttackSpeedBps: 10000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
const dummy = (id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
// A passive ally keeps the fight running when the shooter falls.
const ally = () => ({ ...dummy('ally', 6, 7), team: 'player' as const });
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
const attackTicks = (out: { tick: number; events: readonly CombatEvent[] }[]) => out.flatMap(s => s.events.filter(e => e.type === 'attack' && e.attackerId === 'p').map(() => s.tick));
const hitTicks = (out: { tick: number; events: readonly CombatEvent[] }[], target = 'e') => out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p' && x.unitId === target).map(() => s.tick));

describe('ranged attack landing', () => {
  it('a ranged hero\'s attack lands rangedAttackFlightTicks(hexes) after it; its attack mana comes on the attack tick', () => {
    const start = battle([shooter('ezreal', 4), dummy('e', 3, 3)], { rngState: 42 });
    const hexes = hexDistance(start.units[0]!.cell, start.units[1]!.cell), flight = rangedAttackFlightTicks(hexes, 'ezreal');
    const r = run(start, 30), first = attackTicks(r.out)[0]!;
    expect(hitTicks(r.out)[0]).toBe(first + flight);
    const attackStep = r.out.find(s => s.tick === first)!;
    expect(packets(attackStep.events).filter(x => x.source.ownerId === 'p')).toEqual([]);
    expect(attackStep.events.some(e => e.type === 'manaChanged' && JSON.stringify(e).includes('"p"'))).toBe(true);
    // Display only: the launch on the attack tick names the arrival; the landing comes on it.
    expect(attackStep.events.filter(e => e.type === 'attackLaunched').map(e => e.type === 'attackLaunched' && [e.attackerId, e.targetId, e.arrivalTick, e.projectile]))
      .toEqual([['p', 'e', first + flight, 'flight']]);
    expect(r.out.find(s => s.tick === first + flight)!.events.filter(e => e.type === 'attackLanded').map(e => e.type === 'attackLanded' && [e.attackerId, e.targetId, e.hit]))
      .toEqual([['p', 'e', true]]);
  });
  it('a melee hero\'s attack still settles on its attack tick', () => {
    const r = run(battle([shooter('garen', 1), dummy('e', 3, 5)], { rngState: 42 }), 30);
    expect(hitTicks(r.out)[0]).toBe(attackTicks(r.out)[0]);
  });
  it('a target that dies in flight takes nothing and no other target is picked; one that moves is still hit on time', () => {
    const start = battle([shooter('ezreal', 4), dummy('e', 3, 3), dummy('f', 2, 3)], { rngState: 42 });
    const pre = run(start, 30), first = attackTicks(pre.out)[0]!;
    const shot = pre.out.find(s => s.tick === first)!.events.find(e => e.type === 'attack' && e.attackerId === 'p') as Extract<CombatEvent, { type: 'attack' }>;
    const aimed = shot.targetId, other = aimed === 'e' ? 'f' : 'e', flight = hitTicks(pre.out, aimed)[0]! - first;
    expect(flight).toBeGreaterThan(0);
    const atAttack = run(start, first - start.tick).state;
    const killed = structuredClone(atAttack); Object.assign(killed.units.find(u => u.id === aimed)!, { hp: 0 });
    const k = run(killed, flight + 1);
    expect(hitTicks(k.out, aimed)).toEqual([]);
    expect(k.out.flatMap(x => x.events.filter(e => e.type === 'attackLanded' && e.targetId === aimed).map(e => e.type === 'attackLanded' && e.hit))).toEqual([false]);
    expect(hitTicks(k.out, other).filter(t => t <= first + flight)).toEqual([]);
    const moved = structuredClone(atAttack); Object.assign(moved.units.find(u => u.id === aimed)!, { cell: { col: 0, row: 0 } });
    expect(hitTicks(run(moved, flight + 1).out, aimed)[0]).toBe(first + flight);
  });
  it('the shooter\'s death or a stun on her in flight does not stop the shot', () => {
    const start = battle([shooter('ezreal', 4), ally(), dummy('e', 3, 3)], { rngState: 42 });
    const pre = run(start, 30), first = attackTicks(pre.out)[0]!, flight = hitTicks(pre.out)[0]! - first;
    const atAttack = run(start, first - start.tick).state, dead = structuredClone(atAttack);
    Object.assign(dead.units.find(u => u.id === 'p')!, { hp: 0 });
    expect(hitTicks(run(dead, flight + 1).out)[0]).toBe(first + flight);
  });
});

import { createHash } from 'node:crypto';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle, startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { createCombatWithEvents } from '../src/simulation/combat';
import { validateM5Runtime } from '../src/simulation/serialization-structure';

function army(names: readonly string[], star: 1 | 2 | 3 = 2): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: names.map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: star, location: { kind: 'board', cell: { col: 1 + i, row: i % 2 ? 4 : 5 } } })) } };
}
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Melee only: the whole replay is byte-for-byte what it was before ranged attack landing (hash recorded on e9f33376).
it('a melee-only battle replays byte-for-byte as before ranged attack landing', () => {
  const source = compileBattle(snapshotForBattle(army(['garen', 'darius', 'vi', 'sett']), 'A'), snapshotForBattle(army(['illaoi', 'trundle', 'vander', 'akali']), 'B'), 42, { battleId: 'melee-only' });
  // Landing batch (11-20): Darius's spin now lands DARIUS_SPIN_TICKS after his cast, so this battle changed with it
  // (was 3c864002…, recorded on e9f33376 before ranged attack landing). Vi's slam at the original's time (11-21) changes it again
  // (was 457d404d…). The replay view now carries a killing packet's overkill (display only; the battle itself is unchanged,
  // same resolved-battle bytes) (was 934b2cb1…).
  expect(sha(toCombatReplay(resolveTwoSidedBattle(source, 901)))).toBe('d65ce6bf6edac67b298e66c7919a313338ca44ba23b683dabbf39592179e3b92');
});

it('ranged synchronous / 1- and 7-tick slices / replay preserve complete bytes', () => {
  const source = compileBattle(snapshotForBattle(army(['ezreal', 'jinx', 'garen']), 'A'), snapshotForBattle(army(['caitlyn', 'tristana', 'darius']), 'B'), 42, { battleId: 'ranged-landing' });
  const expected = resolveTwoSidedBattle(source, 901), expectedReplay = toCombatReplay(expected);
  for (const budget of [1, 7]) {
    const task = startTwoSidedBattle(source); let result = task.advance(budget);
    while (!result) result = task.advance(budget);
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    const replay = startCombatReplay(JSON.parse(JSON.stringify(result))); let frames = replay.advance(budget);
    while (!frames) frames = replay.advance(budget);
    expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
  }
}, 60000);

it('restores ticks with a pending attackLanding, continues identically and rejects a forged one', () => {
  const player = army(['ezreal', 'jinx', 'garen']), opponent = army(['garen', 'darius']);
  const s: MatchState = { ...player, preparation: { ...player.preparation, units: [...player.preparation.units,
    ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
      location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
  const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
  let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
  while (state.status === 'running' && checked < 6) {
    state = stepCombat(state).state;
    if (!state.units.some(u => u.tasks?.some(t => t.kind === 'attackLanding'))) continue;
    const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
    expect(rebuilt).toEqual(state);
    const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
    for (const forge of [(t: any) => { t.landing.packets[0].targetId = 'nobody'; }, (t: any) => { t.source = { ...t.source, sourceKind: 'ability' }; }]) {
      const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(t => t.kind === 'attackLanding'))!;
      forge(owner.tasks!.find(t => t.kind === 'attackLanding')!);
      expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
    }
    expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
    checked++;
  }
  expect(checked).toBe(6);
}, 60000);

it('Zeri\'s empowered shot is an instant beam: it settles on its attack tick; her other attacks fly', () => {
  const start = battle([shooter('zeri', 4), dummy('e', 3, 3)], { rngState: 42 });
  const r = run(start, 120), attacks = attackTicks(r.out), hits = new Set(hitTicks(r.out));
  const n = variable(start.units.find(u => u.id === 'p')!, 'NumOfAttacks');
  expect(n).toBeGreaterThan(1);
  const flight = rangedAttackFlightTicks(hexDistance({ col: 3, row: 6 }, { col: 3, row: 3 }), 'zeri');
  expect(attacks.length).toBeGreaterThan(n);
  attacks.forEach((t, i) => expect(hits.has((i + 1) % n === 0 ? t : t + flight), `attack ${i + 1} at ${t}`).toBe(true));
  const beams = r.out.flatMap(x => x.events.filter(e => e.type === 'attackLaunched' && e.projectile === 'beam').map(e => e.type === 'attackLaunched' && [x.tick, e.arrivalTick]));
  expect(beams.length).toBeGreaterThan(0);
  for (const [tick, arrival] of beams as [number, number][]) expect(arrival).toBe(tick);
});

// ---- In-flight save → restore → landing round trips (damage, on-hit status, Dragonsoul registration, dead target) ----
import { validateMechanisms } from '../src/simulation/m8/restore';
import { validateP3State } from '../src/simulation/s13-p3-combat';
function matchCombat(champion: string, opts: { anomaly?: string; mechanics?: { mechanic: string; values: Record<string, number> }[] } = {}): CombatState {
  const base = createMatch(42), round = 5;
  const preparation = { ...base.preparation, units: [champion, 'garen'].map((definitionId, i) => ({ id: i ? 'e0' : 'p0', definitionId, starLevel: 1 as const,
    team: i ? 'enemy' as const : 'player' as const, location: { kind: 'board' as const, cell: i ? { col: 3, row: 2 } : { col: 3, row: 5 } } })) };
  const state = { ...base, round, preparation, anomalyBinding: opts.anomaly ? { definitionId: opts.anomaly, choiceId: 'anomaly', unitId: 'p0', boundRound: 1 } : null };
  const strategy = buildStrategySnapshot(state);
  const withMechanics = { ...strategy, units: strategy.units.map(u => u.unitId !== 'p0' ? u : ({ ...u, mechanics: [...u.mechanics ?? [], ...(opts.mechanics ?? []).map((m, i) => ({ ...m,
    source: { ownerId: 'p0', sourceKind: 'augment' as const, definitionId: m.mechanic === 'blisteringStrikes' ? 'blistering-strikes' : m.mechanic, instanceId: 'choice-' + i, effectIndex: i } }))] })) };
  const started = createCombatWithEvents(preparation, withMechanics, 'landing-roundtrip').state;
  // p0 attacks at once (range kept from her own data), e0 stands still.
  return { ...started, units: started.units.map(u => u.id === 'p0' ? { ...u, cooldownTicks: 0, moveCooldownTicks: 2000, mana: 0 } : { ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 }) };
}
const pending = (s: CombatState) => s.units.find(u => u.id === 'p0')!.tasks?.filter(t => t.kind === 'attackLanding') ?? [];
// Ranged attack wind-up (11-19): the shot launches rangedAttackWindupTicks after the attack starts; step to that launch.
function toLaunch(start: CombatState): CombatState {
  let s = stepCombat(start).state;
  for (let n = 0; n < 20 && !pending(s).length; n++) s = stepCombat(s).state;
  return s;
}
function roundTrip(start: CombatState) {
  const launched = toLaunch(start), shot = pending(launched)[0]!;
  expect(shot, 'premise: a shot is in flight').toBeDefined();
  const restored = JSON.parse(JSON.stringify(launched)) as CombatState;
  for (const u of restored.units) { validateMechanisms(u, restored.units, restored.tick, restored.combatId!, false, restored.nextActionSeq!); validateP3State(u, restored.units, restored.tick, restored.nextActionSeq!); }
  const ids = new Set(restored.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const u of restored.units) validateM5Runtime(u, restored.tick, ids, restored.units, restored.combatId!, new Set(), same, restored.nextActionSeq!);
  let a = launched, b = restored; const events: CombatEvent[] = [];
  while (a.tick < shot.executeAtTick) { const x = stepCombat(a), y = stepCombat(b); expect(y).toEqual(x); a = x.state; b = y.state; events.push(...x.events); }
  return { shot, landed: a, events };
}
describe('ranged attack landing: in-flight save and restore', () => {
  it('damage: the restored shot lands on the same tick with the same packet', () => {
    const { shot, events } = roundTrip(matchCombat('ezreal'));
    const hits = events.filter(e => e.type === 'packetDamage' && e.tick === shot.executeAtTick && e.outcome.context.source.ownerId === 'p0');
    expect(hits.length).toBeGreaterThan(0);
  });
  it('on-hit status: Blistering Strikes rides the shot and applies when it lands', () => {
    const start = matchCombat('lux', { mechanics: [{ mechanic: 'blisteringStrikes', values: { durationTicks: 100, burnBpsPerSecond: 100, woundBps: 3300 } }] });
    const launched = toLaunch(start);
    expect(pending(launched)[0]!.landing!.effects.length, 'premise: the statuses wait in the shot').toBe(2);
    expect(launched.units.find(u => u.id === 'e0')!.mechanismState?.statuses.some(g => g.kind === 'burn')).toBe(false);
    const { landed } = roundTrip(start);
    expect(landed.units.find(u => u.id === 'e0')!.mechanismState!.statuses.map(g => g.kind).sort()).toEqual(['burn', 'wound']);
  });
  it('Dragonsoul: the target is registered when the shot lands, not on the attack', () => {
    const start = matchCombat('ezreal', { anomaly: 'dragonsoul' });
    const launched = toLaunch(start);
    expect(launched.units.find(u => u.id === 'p0')!.s13P3?.dragonTargets ?? []).toEqual([]);
    const { landed, events, shot } = roundTrip(start);
    expect(landed.units.find(u => u.id === 'p0')!.s13P3!.dragonTargets).toEqual(['e0']);
    expect(events.some(e => e.type === 'packetDamage' && e.tick === shot.executeAtTick && e.outcome.context.source.definitionId === 'dragonsoul')).toBe(true);
  });
  it('dead target: a restored shot whose target died in flight does nothing', () => {
    const start = matchCombat('ezreal', { anomaly: 'dragonsoul' });
    const launched = toLaunch(start), killed = structuredClone(launched);
    Object.assign(killed.units.find(u => u.id === 'e0')!, { hp: 0 });
    const shot = pending(killed)[0]!;
    let a = killed, b = JSON.parse(JSON.stringify(killed)) as CombatState; const events: CombatEvent[] = [];
    while (a.status === 'running' && a.tick < shot.executeAtTick) { const x = stepCombat(a), y = stepCombat(b); expect(y).toEqual(x); a = x.state; b = y.state; events.push(...x.events); }
    expect(events.filter(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'p0')).toEqual([]);
    expect(a.units.find(u => u.id === 'p0')!.s13P3?.dragonTargets ?? []).toEqual([]);
  });
});

it('a melee hero given extra range still settles her attack on its attack tick (her own data range decides)', () => {
  const r = run(battle([shooter('garen', 4), dummy('e', 3, 3)], { rngState: 42 }), 30);
  expect(hitTicks(r.out)[0]).toBe(attackTicks(r.out)[0]);
  expect(r.out.flatMap(s => s.events.filter(e => e.type === 'attackLaunched'))).toEqual([]);
});
describe('form heroes: the current form decides', () => {
  for (const name of ['jayce', 'elise', 'gangplank']) {
    it(`${name}: melee form settles on the attack tick, ranged form when the shot lands`, () => {
      const melee = run(battle([shooter(name, 1, { form: 'melee' }), dummy('e', 3, 5)], { rngState: 42 }), 30);
      expect(hitTicks(melee.out)[0]).toBe(attackTicks(melee.out)[0]);
      const ranged = run(battle([shooter(name, 4, { form: 'ranged' }), dummy('e', 3, 3)], { rngState: 42 }), 30), first = attackTicks(ranged.out)[0]!;
      expect(hitTicks(ranged.out)[0]).toBe(first + rangedAttackFlightTicks(3, name));
    });
  }
  it('a shot already in flight finishes as launched when the form changes', () => {
    const start = battle([shooter('jayce', 4, { form: 'ranged' }), dummy('e', 3, 3)], { rngState: 42 });
    const pre = run(start, 30), first = attackTicks(pre.out)[0]!, landing = first + rangedAttackFlightTicks(3, 'jayce');
    const swapped = structuredClone(run(start, first - start.tick).state);
    Object.assign(swapped.units.find(u => u.id === 'p')!, { form: 'melee' });
    expect(hitTicks(run(swapped, landing - swapped.tick).out)).toEqual([landing]);
  });
});

// ---- The attacker's side is taken on the attack tick and travels with the shot (saved with it) ----
import { wearing, enemy as itemEnemy, run as itemRun } from './fixtures/m8-b4-items';
describe('ranged attack landing: attacker-side snapshot', () => {
  // Blue Buff: a kill gives +500 bps damage. Kill a, then attack b (2 hexes away); the shot is in flight. A passive ally keeps
  // the fight running if the shooter falls.
  function amplifiedShot() {
    const fa = rangedAttackFlightTicks(1);
    const killed = itemRun(wearing('blue-buff', { baseCritChanceBps: 0, targetId: 'a' }), 1 + rangedAttackWindupTicks('zyra', 20) + fa, [itemEnemy('a', 1, 3, { hp: 100 }), itemEnemy('b', 2, 3), itemEnemy('z', 3, 3), { ...itemEnemy('ally', 6, 7), team: 'player' as const }]).state;
    // Ranged attack wind-up (11-19): the attack on b starts now and its shot launches rangedAttackWindupTicks later.
    let launched = stepCombat({ ...killed, units: killed.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0, targetId: 'b' } : u) }).state;
    for (let n = 0; n < 20 && !launched.units.find(u => u.id === 'p')!.tasks!.some(t => t.kind === 'attackLanding'); n++) launched = stepCombat(launched).state;
    const shot = launched.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'attackLanding')!;
    expect(shot.landing!.packets[0]!.locked!.amplifiers.length, 'premise: the shot carries her amplifiers').toBeGreaterThan(0);
    return { launched, shot };
  }
  const landingDamage = (state: CombatState, at: number) => {
    let s = state; const out: number[] = [];
    while (s.status === 'running' && s.tick < at) { const r = stepCombat({ ...s, units: s.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 1000 } : u) }); s = r.state;
      out.push(...packets(r.events).filter(x => x.source.ownerId === 'p' && x.unitId === 'b').map(x => x.hpDamage)); }
    return out;
  };
  it('the buff ending in flight (then a save and restore) does not change the landing damage', () => {
    const { launched, shot } = amplifiedShot(), base = landingDamage(launched, shot.executeAtTick);
    expect(base).toEqual([120]);
    const ended = structuredClone(launched), p = ended.units.find(u => u.id === 'p')!;
    (p as { mechanismState: unknown }).mechanismState = { ...p.mechanismState!, statuses: p.mechanismState!.statuses.filter(g => !g.contributions.some(c => c.application.modifier?.stat === 'damageAmp')) };
    expect(landingDamage(JSON.parse(JSON.stringify(ended)), shot.executeAtTick)).toEqual(base);
  });
  it('the shooter dying in flight: the shot lands with its snapshot', () => {
    const { launched, shot } = amplifiedShot(), dead = structuredClone(launched);
    Object.assign(dead.units.find(u => u.id === 'p')!, { hp: 0 });
    expect(landingDamage(dead, shot.executeAtTick)).toEqual([120]);
  });
  it('the crit is decided on the attack tick and travels with the shot', () => {
    const { shot } = amplifiedShot();
    expect(shot.landing!.packets.every(p => typeof p.critical === 'boolean')).toBe(true);
  });
});

// ---- Match save tamper resistance for a pending attackLanding (as for other task kinds) ----
import { itemMatch } from './fixtures/m8-b4-match';
import { stepMatch } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
describe('ranged attack landing: Match save with a shot in flight', () => {
  function inFlight() {
    let s = itemMatch('hand-of-justice', 'unit-3');
    for (let n = 0; n < 200 && s.phase === 'combat' && !s.combat!.units.some(u => u.tasks?.some(t => t.kind === 'attackLanding')); n++) s = stepMatch(s).state;
    expect(s.combat!.units.some(u => u.tasks?.some(t => t.kind === 'attackLanding')), 'premise: a shot is in flight at the save').toBe(true);
    return s;
  }
  const tamper = (s: ReturnType<typeof inFlight>, edit: (task: any, tasks: any[]) => void) => {
    const json = JSON.parse(serializeMatch(s));
    const holder = json.combat.units.find((u: any) => u.tasks?.some((t: any) => t.kind === 'attackLanding'));
    edit(holder.tasks.find((t: any) => t.kind === 'attackLanding'), holder.tasks);
    return JSON.stringify(json);
  };
  it('restores exactly and continues identically', () => {
    const s = inFlight(), restored = restoreMatch(serializeMatch(s));
    expect(restored).toEqual(s);
    expect(stepMatch(restored)).toEqual(stepMatch(s));
  }, 60000);
  it.each([
    ['removed', (t: any, tasks: any[]) => tasks.splice(tasks.indexOf(t), 1)],
    ['duplicated', (t: any, tasks: any[]) => tasks.push({ ...structuredClone(t), key: t.key + 'x' })],
    ['arrival tick moved', (t: any) => { t.executeAtTick += 1; }],
    ['snapshot amplifiers changed', (t: any) => { t.landing.packets[0].locked.attackDamage += 1; }],
    ['packet raw changed', (t: any) => { t.landing.packets[0].raw += 1; }],
    ['snapshot shape broken', (t: any) => { delete t.landing.packets[0].locked.weaknessBps; }],
    ['packet owner changed', (t: any) => { t.landing.packets[0].source = { ...t.landing.packets[0].source, ownerId: 'someone' }; }],
  ])('a save with the pending shot %s is rejected', (_name, edit) => {
    expect(() => restoreMatch(tamper(inFlight(), edit as never))).toThrow();
  }, 60000);
});

// ---- Another unit's trigger under this attack settles on the attack tick, by its own numbers ----
import { trigger as itemTrigger, damage as itemDamage, enemies as itemEnemies } from '../src/simulation/content/item-programs';
it('an ally\'s trigger on the shooter\'s attack settles on the attack tick with its owner\'s numbers; only her own shot flies', () => {
  const proc = { ...itemTrigger({ id: 'ally-proc', listener: { subject: 'actor', relationToHolder: 'ally', withinHexes: null },
    selector: itemEnemies({ candidates: 'event-target' }), effects: [itemDamage('magic', { flat: 50 })] }),
    source: { ownerId: 'ally', sourceKind: 'item' as const, definitionId: 'test-ally-proc', instanceId: 'proc', effectIndex: 0, parentItemInstanceId: null } };
  const holder = { ...dummy('ally', 6, 7), team: 'player' as const, mechanismDefinitions: { eventTriggers: [proc], periodicTasks: [], survivalTriggers: [], vamp: [] } } as unknown as CombatUnit;
  const start = battle([shooter('ezreal', 4), holder, dummy('e', 3, 3)], { rngState: 42 });
  const r = run(start, 30), first = attackTicks(r.out)[0]!, flight = rangedAttackFlightTicks(3, 'ezreal');
  const at = (tick: number, owner: string) => r.out.filter(s => s.tick === tick).flatMap(s => packets(s.events).filter(x => x.source.ownerId === owner));
  expect(at(first, 'ally').map(x => x.hpDamage)).toEqual([50]);
  expect(at(first, 'p')).toEqual([]);
  expect(at(first + flight, 'p').length).toBeGreaterThan(0);
  // The shooter falling right after her attack does not undo the ally's proc (already settled) nor her shot.
  const atAttack = run(start, first - start.tick - 1).state;
  const launched = stepCombat(atAttack);
  expect(packets(launched.events).filter(x => x.source.ownerId === 'ally').map(x => x.hpDamage)).toEqual([50]);
});

it('a target that dies in flight and is revived before the landing still takes nothing', () => {
  // A second, far enemy keeps the fight running while e is down.
  const start = battle([shooter('ezreal', 4), ally(), dummy('e', 3, 3), dummy('far', 6, 0)], { rngState: 42 });
  const pre = run(start, 30), first = attackTicks(pre.out)[0]!, flight = hitTicks(pre.out)[0]! - first;
  const atAttack = run(start, first - start.tick).state, killed = structuredClone(atAttack);
  Object.assign(killed.units.find(u => u.id === 'e')!, { hp: 0 });
  const dead = run(killed, 1).state;
  expect(dead.units.find(u => u.id === 'e')!.alive, 'premise: it died in flight').toBe(false);
  const revived = structuredClone(dead); Object.assign(revived.units.find(u => u.id === 'e')!, { alive: true, hp: 1000 });
  const rest = run(revived, flight);
  expect(hitTicks(rest.out)).toEqual([]);
  expect(rest.out.flatMap(s => s.events.filter(e => e.type === 'attackLanded').map(e => e.type === 'attackLanded' && e.hit))).toEqual([false]);
});
