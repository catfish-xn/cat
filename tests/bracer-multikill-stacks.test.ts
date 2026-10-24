import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sellUnit, deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchEvent, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { dispatchTriggers, EMPTY_TRIGGER_LEDGER, type TriggerSignal } from '../src/simulation/m8/triggers';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { publicEquipmentPreparation as acquireEquipment } from './fixtures/b8-public-equipment';
import { freezeContent } from '../src/simulation/content/freeze';
import { BRACER } from './fixtures/explorer-bracer-public';
import { createMatch } from '../src/simulation/match';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { MAX_COMBAT_TICKS, type CombatUnit, type LedgerCombatEvent } from '../src/simulation/combat-types';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { BattleHistory } from '../src/replay/history';
import { PlaybackSession } from '../src/replay/playback-session';
import { isDeclaredStatus, declaredEffects, statusDeclaration } from '../src/simulation/m8/item-restore';

// Match's content, provenance and input basis are immutable in ordinary public
// fixtures too. Re-certify those trees after cloning without sharing mutable data.
function certifyFixture(state: MatchState): MatchState {
  freezeContent(state.m8); freezeContent(state.resourceProvenance);
  if (state.combatInputBasis) freezeContent(state.combatInputBasis);
  return state;
}
const ownFixture = (state: MatchState) => certifyFixture(structuredClone(state));

const accepted = (r: MatchCommandResult) => { if (!r.ok) throw new Error(r.reason); return r.state; };
const lux = (s: MatchState) => s.combat!.units.find(u => u.definitionId === 'lux' && u.team === 'player')!;
const count = (s: MatchState) => lux(s).triggerLedger!.runtimes.filter(r => r.source.definitionId === BRACER).reduce((n, r) => n + r.triggerCount, 0);
/** Compare the entire intermediate Match, including ledgers, queues, RNG and
 * cursors, as well as each tick's events; terminal equality alone is insufficient. */
function expectContinuation(from: MatchState, copies: MatchState[]) {
  let state = from;
  for (const copy of copies) expect(copy).toEqual(state);
  while (state.phase === 'combat') {
    const expected = stepMatch(state); state = expected.state;
    copies = copies.map(copy => {
      const actual = stepMatch(copy);
      expect(actual.events).toEqual(expected.events);
      expect(actual.state).toEqual(expected.state);
      return actual.state;
    });
  }
}
// v19 Sisters shifts seed 3151248's gold offers to Spirit Link. Public card
// rerolls recover the inert front-row Glass Cannon II control without changing any combat assertions.
// Seed 5 still offers Manaflow I for the contribution=false board.
// v22 augment tier table: seed 3151248 no longer reaches Glass Cannon II, so each
// public fixture names a seed whose card rerolls still recover it.
const frontRowRod = (seed: number) => {let s=acquireEquipment(['rod'],{seed,augmentPriorities:['glass-cannon-ii'],rerollForAugment:true});for(const u of s.preparation.units.filter(u=>u.team==='player'&&!['irelia','lux'].includes(u.definitionId)))s=accepted(sellUnit(s,u.id));if(!s.preparation.units.some(u=>u.team==='player'&&u.definitionId==='lux'))s=accepted(grantMechanicUnit(s,{receiptId:'fixture:base-lux',source:'test',definitionId:'lux'}));return s;};
let initial: MatchState, before: MatchState, after: MatchState, doubleKill: MatchEvent[];
let luxFixture: { initial: MatchState; before: MatchState; after: MatchState; doubleKill: MatchEvent[] };
beforeAll(() => {
  // v22 AD/mana rules: Luden's splash now kills three from column 0; seed 1 from column 4 is an exact double kill.
  let state = frontRowRod(1);
  for (let i = 0; i < 8; i++) state = accepted(grantMechanicUnit(state, { receiptId: `lux-${i}`, source: 'test', definitionId: 'lux' }));
  const owner = state.preparation.units.find(u => u.definitionId === 'lux' && u.team === 'player')!;
  // S13 Lux shields and empowers her next attack. Its real Luden splash makes
  // the second kill in the SAME root action, without inventing an AoE Lux spell.
  for (const [slot, definitionId] of [BRACER, 'TFT_Item_Artifact_LudensTempest', 'TFT5_Item_RabadonsDeathcapRadiant'].entries()) {
    state = accepted(grantMechanicItem(state, { receiptId: `item-${slot}`, source: 'test', definitionId }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, owner.id, slot));
  }
  state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 4, row: 4 } }));
  initial = state = accepted(startMatchCombat(state));
  while (state.phase === 'combat') {
    const r = stepMatch(state);
    const kills = r.events.filter(e => e.type === 'kill' && e.source.ownerId === owner.id);
    if (kills.length === 2) { before = state; after = r.state; doubleKill = [...r.events]; break; }
    state = r.state;
  }
  expect(after, 'the public route must produce a real simultaneous double kill').toBeDefined();
  luxFixture = freezeContent(structuredClone({ initial, before, after, doubleKill }));
});
// Keep every case detached from the prepared snapshots, including negative cases.
beforeEach(() => {
  ({ initial, before, after, doubleKill } = structuredClone(luxFixture));
  for (const state of [initial, before, after]) certifyFixture(state);
});

it('Lux kills two different targets in one root action and gains two +20 stacks', () => {
  const packets = doubleKill.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome] : []);
  expect(after.combat!.tick).toBe(118);
  expect(packets).toHaveLength(2);
  expect(new Set(packets.map(p => p.context.rootActionSeq))).toEqual(new Set([18]));
  expect(new Set(packets.map(p => p.context.targetId)).size).toBe(2);
  expect(packets.map(p => p.context.delivery)).toEqual(['ability-direct', 'equipment-proc']);
  expect(count(before)).toBe(0); expect(count(after)).toBe(2);
  const old = readCombatStats(lux(before), before.combat!), next = readCombatStats(lux(after), after.combat!);
  expect([next.armor - old.armor, next.magicResist - old.magicResist, next.abilityPower - old.abilityPower]).toEqual([40, 40, 40]);
});

it.each(['object', 'json'] as const)('restores the real double kill and continues identically (%s)', format => {
  for (const state of [before, after]) {
    const restored = restoreMatch(format === 'json' ? serializeMatch(state) : structuredClone(state));
    expect(restored).toEqual(state); expect(serializeMatch(restored)).toBe(serializeMatch(state));
    expectContinuation(state, [restored]);
  }
});

// Only public acquisition and checkpoint preparation run in hooks. Recording,
// restores, continuation and PlaybackSession verification stay in each case.
describe('Renata public acquisition fixture', () => {
  let acquired: MatchState, granted: MatchState, deployed: MatchState;
  beforeAll(() => {
    // v22 augment tier table and mana rules: seed 3151248 now opens with a single kill; seed 84 keeps the tick-60 double kill.
    let preparation = acquireEquipment(['rod'],{seed:84,augmentPriorities:['glass-cannon-ii'],rerollForAugment:true});
    for(const u of preparation.preparation.units.filter(u=>u.team==='player'&&u.id!=='unit-1'))preparation=accepted(sellUnit(preparation,u.id));
    acquired = freezeContent(structuredClone(preparation));
    for (let i = 0; i < 9; i++) preparation = accepted(grantMechanicUnit(preparation, { receiptId: `renata-${i}`, source: 'test', definitionId: 'renata' }));
    granted = freezeContent(structuredClone(preparation));
    const owner = preparation.preparation.units.find(u => u.definitionId === 'renata' && u.team === 'player')!;
    for (const [slot, definitionId] of [BRACER, 'TFT_Item_Artifact_LudensTempest', 'TFT5_Item_BlueBuffRadiant'].entries()) {
      preparation = accepted(grantMechanicItem(preparation, { receiptId: `renata-item-${slot}`, source: 'test', definitionId }));
      preparation = accepted(equipItem(preparation, preparation.items.at(-1)!.id, owner.id, slot));
    }
    preparation = accepted(deployMatchUnit(preparation, owner.id, { kind: 'board', cell: { col: 4, row: 4 } }));
    deployed = freezeContent(structuredClone(preparation));
  });

  // Temporarily 20 s (user-approved 2026-10-20); restore the default 5 s once this slow case is sped up.
  it('saves Renata\'s tick-60 double kill, restores object/JSON, and replays every complete combat state', () => {
    let preparation = ownFixture(acquired);
    expect(preparation.seed).toBe(84); expect(preparation.roundDefinitionId).toBe('2-1');
    preparation = ownFixture(granted);
    const owner = preparation.preparation.units.find(u => u.definitionId === 'renata' && u.team === 'player')!;
    expect(owner.starLevel).toBe(3);
    preparation = ownFixture(deployed);
    const start = startMatchCombat(preparation);
    if (!start.ok) throw new Error(start.reason);
    let state = accepted(start);
    const history = new BattleHistory('bracer-early-double-kill');
    const observe = (before: MatchState, after: MatchState, events: readonly MatchEvent[], reason: 'command' | 'tick') =>
      history.observe({ before, after, events: events.filter((e): e is LedgerCombatEvent => e.domain === 'combat'), reason });
    observe(preparation, state, start.events, 'command');
    const states: CombatState[] = [state.combat!];
    let earlyBefore: MatchState | undefined, earlyAfter: MatchState | undefined;
    while (state.phase === 'combat') {
      const before = state, next = stepMatch(state); state = next.state;
      observe(before, state, next.events, 'tick'); states.push(state.combat!);
      if (state.combat!.tick === 60) {
        earlyBefore = before; earlyAfter = state;
        const packets = next.events.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome.context] : []);
        expect(packets).toHaveLength(2);
        expect(packets.map(p => [p.rootActionSeq, p.delivery, p.targetId])).toEqual([
          [9, 'ability-direct', 'enemy-r4-1'], [9, 'ability-direct', 'enemy-r4-2'],
        ]);
        const old = before.combat!.units.find(u => u.id === owner.id)!, current = state.combat!.units.find(u => u.id === owner.id)!;
        expect(current.triggerLedger!.runtimes.filter(r => r.source.definitionId === BRACER).map(r => [r.source.effectIndex, r.triggerCount])).toEqual([[4128, 2]]);
        const a = readCombatStats(old, before.combat!), b = readCombatStats(current, state.combat!);
        expect([b.armor - a.armor, b.magicResist - a.magicResist, b.abilityPower - a.abilityPower]).toEqual([40, 40, 40]);
      }
    }
    expect(earlyBefore).toBeDefined(); expect(earlyAfter).toBeDefined();
    for (const checkpoint of [earlyBefore!, earlyAfter!]) {
      const saved = serializeMatch(checkpoint);
      const copies = [restoreMatch(structuredClone(checkpoint)), restoreMatch(saved)];
      for (const copy of copies) expect(serializeMatch(copy)).toBe(saved);
      expectContinuation(checkpoint, copies);
    }
    expect(history.completedRecords).toHaveLength(1);
    const playback = new PlaybackSession(history.completedRecords[0]);
    expect(playback.read().combat).toEqual(states[0]);
    playback.play();
    for (const expected of states.slice(1)) expect(playback.advance(50).combat).toEqual(expected);
    for (const tick of [59, 60, 61, states.at(-1)!.tick]) expect(playback.seek(tick).combat).toEqual(states[tick]);
    playback.dispose();
  }, 20000);
});

/** S1 isolates life/attribution boundaries after the real strategy/item/summon
 * compiler. Only starting stats and readiness are controlled; all attacks,
 * deaths, contributor tracking, delayed tasks and triggers run through stepCombat. */
function attributionFight(names: readonly string[], keepEnemy = false) {
  const match = createMatch(42);
  const preparation = { ...match.preparation, units: [...names.map((definitionId, i) => ({
    id: i === 0 ? 'p' : `ally-${i}`, definitionId, starLevel: 1 as const, team: 'player' as const,
    location: { kind: 'board' as const, cell: { col: i, row: 4 } },
  })), { id: 'e', definitionId: 'garen', starLevel: 1 as const, team: 'enemy' as const,
    location: { kind: 'board' as const, cell: { col: 1, row: 3 } } },
    ...(keepEnemy ? [{ id: 'reserve', definitionId: 'garen', starLevel: 1 as const, team: 'enemy' as const,
      location: { kind: 'board' as const, cell: { col: 6, row: 0 } } }] : [])] };
  const items = [{ id: 'bracer-attribution', definitionId: BRACER, location: { kind: 'unit' as const, unitId: 'p', slot: 0 } }];
  const started = createCombatWithEvents(preparation, buildStrategySnapshot({ ...match, preparation, items }), 'bracer-attribution');
  const state: CombatState = { ...started.state, units: started.state.units.map(u => ({ ...u,
    hp: 10000, maxHp: 10000, armor: 0, magicResist: 0, mana: 0, maxMana: 100000,
    cooldownTicks: 5000, moveCooldownTicks: 5000, attackRange: 99, critChanceBps: 0,
    attackDamage: 10, attackDamageBase: 10, baseAttackSpeedBps: 1,
  })) };
  return { state, events: started.events };
}
const combatUnit = (s: CombatState, id: string): CombatUnit => s.units.find(u => u.id === id)!;
function earned(s: CombatState) {
  const p = combatUnit(s, 'p');
  return p.mechanismDefinitions!.eventTriggers!.filter(d => d.source.definitionId === BRACER).flatMap(d => {
    const runtime = p.triggerLedger?.runtimes.find(r => r.source.effectIndex === d.source.effectIndex && r.source.instanceId === d.source.instanceId);
    return runtime ? [[d.id, runtime.triggerCount]] : [];
  });
}

it('S1: a holder and its target dying in the same tick award no stack to the dead holder', () => {
  const { state } = attributionFight(['lux']);
  const initial = { ...state, units: state.units.map(u => ({ ...u, hp: 1, maxHp: 1,
    attackDamage: 10000, attackDamageBase: 10000, cooldownTicks: 0 })) };
  const result = stepCombat(initial);
  const lethal = result.events.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome.context] : []);
  expect(lethal.map(p => [p.source.ownerId, p.targetId]).sort()).toEqual([['e', 'p'], ['p', 'e']]);
  expect(result.events.filter(e => e.type === 'kill').map(e => e.tick)).toEqual([1, 1]);
  expect(result.state.result).toBe('draw');
  expect(combatUnit(result.state, 'p').alive).toBe(false);
  expect(earned(result.state)).toEqual([]);
  expect(combatUnit(result.state, 'p').runtime!.abilityPowerFlat).toBe(0);
});

it.each([false, true])('S1: Sion owns its kill; Black Rose holder earns only a real prior assist (%s)', contributed => {
  const started = attributionFight(['morgana', 'vladimir', 'cassiopeia'], true);
  const sion = started.state.units.find(u => u.definitionId === 'g23-sion')!;
  expect(sion).toBeDefined();
  expect(started.events).toContainEqual(expect.objectContaining({ type: 'unitSpawned', unitId: sion.id, definitionId: 'g23-sion' }));
  let state: CombatState = { ...started.state, units: started.state.units.map(u => u.id === sion.id
    ? { ...u, runtime: { ...u.runtime!, buddyTriggered: true }, cooldownTicks: 2, attackDamage: 10000, attackDamageBase: 10000 }
    : u.id === 'e' ? { ...u, hp: 100, maxHp: 100 }
    : u.id === 'p' && contributed ? { ...u, cooldownTicks: 0 } : u) };
  const first = stepCombat(state); state = first.state;
  expect(first.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'p' && e.outcome.hpDamage > 0)).toBe(contributed);
  expect(earned(state)).toEqual([]);
  const second = stepCombat(state); state = second.state;
  const lethal = second.events.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome.context] : []);
  expect(lethal).toHaveLength(1);
  expect(lethal[0]).toMatchObject({ source: { ownerId: sion.id }, targetId: 'e', delivery: 'basic-attack' });
  expect(earned(state)).toEqual(contributed ? [['assist', 1]] : []);
  expect(combatUnit(state, 'p').runtime!.abilityPowerFlat).toBe(contributed ? 15 : 0);
  const before = readCombatStats(combatUnit(started.state, 'p'), started.state), after = readCombatStats(combatUnit(state, 'p'), state);
  expect([after.armor - before.armor, after.magicResist - before.magicResist]).toEqual(contributed ? [15, 15] : [0, 0]);
});

it('S1: Silco monstrosities retain Silco ownership on a delayed lethal packet and award one kill stack', () => {
  const started = attributionFight(['silco'], true);
  let state: CombatState = { ...started.state, units: started.state.units.map(u => u.id === 'p'
    ? { ...u, mana: 100, maxMana: 100 } : u.id === 'e' ? { ...u, hp: 150, maxHp: 150 } : u) };
  const first = stepCombat(state); state = first.state;
  expect(first.events.some(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === 'p')).toBe(true);
  const tasks = combatUnit(state, 'p').tasks!.filter(t => t.kind === 'g23Magic');
  expect(tasks).toHaveLength(20);
  expect(earned(state)).toEqual([]);
  const cast = first.events.find(e => e.type === 'cast')!;
  if (cast.type !== 'cast' || !('receipt' in cast)) throw new Error('Silco must cast');
  let lethal: ReturnType<typeof stepCombat>['events'] = [];
  while (state.status === 'running') {
    const next = stepCombat(state); state = next.state;
    if (next.events.some(e => e.type === 'packetDamage' && e.outcome.killingPacket)) { lethal = next.events; break; }
    expect(earned(state)).toEqual([]);
  }
  const packets = lethal.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome.context] : []);
  expect(packets).toHaveLength(1);
  expect(state.tick).toBe(tasks[0].executeAtTick);
  expect(state.tick).toBeGreaterThan(1);
  expect(packets[0]).toMatchObject({ source: { ownerId: 'p', sourceKind: 'ability' }, targetId: 'e', delivery: 'ability-direct', rootActionSeq: cast.receipt.actionSeq });
  expect(earned(state)).toEqual([['kill', 1]]);
  expect(combatUnit(state, 'p').runtime!.abilityPowerFlat).toBe(20);
  const before = readCombatStats(combatUnit(started.state, 'p'), started.state), after = readCombatStats(combatUnit(state, 'p'), state);
  expect([after.armor - before.armor, after.magicResist - before.magicResist]).toEqual([20, 20]);
});

it.each(['ownerId', 'sourceKind', 'definitionId', 'instanceId', 'effectIndex', 'parentItemInstanceId', 'missing', 'under-count'] as const)(
  'binds all three effect offsets to settled receipts without borrowing %s or clock-derived stacks', mismatch => {
    const state = structuredClone(after), owner = lux(state), combatId = state.combat!.combatId!;
    const declarations = declaredEffects(owner, combatId).filter(d => d.source.definitionId === BRACER && d.source.effectIndex >= 4128 && d.source.effectIndex <= 4130);
    expect(declarations.map(d => d.source.effectIndex)).toEqual([4128, 4129, 4130]);
    for (const d of declarations) {
      const expected = statusDeclaration(d.effect, owner, d.source)!;
      expect(expected.modifier?.value).toEqual({ kind: 'constant', amount: 20 });
      const app = { ...expected, modifier: { ...expected.modifier!, value: { kind: 'constant' as const, amount: 40 } } };
      expect(isDeclaredStatus(d.source, app, state.combat!.units, combatId)).toBe(true);
      const bad = structuredClone(state), holder = lux(bad), ledger = holder.triggerLedger!;
      const runtime = ledger.runtimes.find(r => r.source.definitionId === BRACER)!;
      // A late (but legal: v22 combat ends at MAX_COMBAT_TICKS = 900) clock would accept these two layers under the old fallback.
      Object.assign(holder.mechanismState!, { sampledAtTick: MAX_COMBAT_TICKS });
      if (mismatch === 'missing') Object.assign(ledger, { runtimes: [] });
      else if (mismatch === 'under-count') {
        Object.assign(runtime, { triggerCount: 1 });
        const entries = Object.entries(ledger.actionCounts), first = entries.find(([key]) => JSON.parse(key)[0] === runtime.key)![0];
        Object.assign(ledger, { actionCounts: Object.fromEntries(entries.filter(([key]) => JSON.parse(key)[0] !== runtime.key || key === first)) });
      } else Object.assign(runtime, { source: { ...runtime.source, [mismatch]: mismatch === 'effectIndex'
        ? runtime.source.effectIndex + 32 : mismatch === 'sourceKind' ? 'ability' : `other-${mismatch}` } });
      expect(isDeclaredStatus(d.source, app, bad.combat!.units, combatId)).toBe(false);
    }
  },
);

it.each(['kill', 'assist'] as const)('deduplicates the same target, counts the second target, and keeps %s exclusive', kind => {
  const owner = lux(initial), combatId = initial.combat!.combatId!;
  const definitions = owner.mechanismDefinitions!.eventTriggers!.filter(d => d.source.definitionId === BRACER);
  const packets = doubleKill.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome] : []);
  const units = initial.combat!.units;
  let ledger = EMPTY_TRIGGER_LEDGER;
  for (const [eventSeq, targetIndex, expected] of [[1, 0, 1], [2, 0, 0], [3, 1, 1], [3, 1, 0]] as const) {
    const packet = packets[targetIndex];
    const damage = kind === 'kill' ? packet : { ...packet, context: { ...packet.context, source: { ...packet.context.source, ownerId: 'other-killer' } } };
    const signal: TriggerSignal = { aggregation: 'event', context: { event: 'kill-or-assist', eventSeq, tick: 118,
      actionSeq: 18, actorId: owner.id, targetId: packet.context.targetId, cast: null }, facts: { damage: [damage], healing: [], shieldDecay: [] } };
    const result = dispatchTriggers(combatId, definitions, ledger, signal, units, () => [owner.id]);
    expect(result.invocations).toHaveLength(expected);
    for (const invocation of result.invocations) expect(invocation.definition.id).toBe(kind);
    ledger = result.ledger;
  }
  expect(ledger.runtimes.map(r => r.triggerCount)).toEqual([2]);
  expect(Object.keys(ledger.actionCounts).map(k => JSON.parse(k)[4]).sort()).toEqual(packets.map(p => p.context.targetId).sort());
});

it('only the bracer opts into per-target limits; other item declarations retain action-wide behavior', () => {
  const scoped = Object.values(ITEM_DEFINITIONS).flatMap(item => (item.combatProgram?.triggers ?? []).filter(t => t.actionLimitScope).map(t => `${item.id}:${t.id}`));
  expect(scoped.sort()).toEqual([`${BRACER}:assist`, `${BRACER}:kill`]);
  const owner = lux(initial), original = owner.mechanismDefinitions!.eventTriggers!.find(d => d.source.definitionId === BRACER && d.id === 'kill')!;
  const definition = { ...original, actionLimitScope: undefined };
  const packets = doubleKill.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome] : []);
  let ledger = EMPTY_TRIGGER_LEDGER;
  for (const [i, packet] of packets.entries()) {
    const signal: TriggerSignal = { aggregation: 'event', context: { event: 'kill-or-assist', eventSeq: i + 1, tick: 118, actionSeq: 18, actorId: owner.id, targetId: packet.context.targetId, cast: null }, facts: { damage: [packet], healing: [], shieldDecay: [] } };
    const result = dispatchTriggers(initial.combat!.combatId!, [definition], ledger, signal, initial.combat!.units, () => [owner.id]);
    expect(result.invocations).toHaveLength(i === 0 ? 1 : 0); ledger = result.ledger;
  }
  expect(ledger.runtimes[0].triggerCount).toBe(1);
});

it.each(['unknown-target', 'duplicate-target', 'old-action-key'] as const)('rejects forged %s receipts despite correct aggregate AP and count', attack => {
  const bad = structuredClone(after), owner = lux(bad), ledger = owner.triggerLedger!;
  const keys = Object.keys(ledger.actionCounts).filter(key => JSON.parse(key)[0].includes(BRACER));
  expect(keys).toHaveLength(2);
  const changed = { ...ledger.actionCounts }, tuple = JSON.parse(keys[1]);
  delete changed[keys[1]];
  if (attack === 'unknown-target') tuple[4] = 'not-a-combat-unit';
  else if (attack === 'duplicate-target') tuple[4] = JSON.parse(keys[0])[4];
  else tuple.pop();
  changed[JSON.stringify(tuple)] = 1;
  Object.assign(owner, { triggerLedger: { ...ledger, actionCounts: changed } });
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save');
  expect(restoreMatch(serializeMatch(after))).toEqual(after);
});

// These fixtures use public grants/deployment and the normal Match combat loop.
// No HP, cooldown, contribution history, packet or trigger signal is fabricated.
function bracerCounts(state: MatchState, ownerId: string) {
  const owner = state.combat!.units.find(u => u.id === ownerId)!;
  return Object.fromEntries(['kill', 'assist'].map(id => {
    const definition = owner.mechanismDefinitions!.eventTriggers!.find(d => d.source.definitionId === BRACER && d.id === id)!;
    const runtime = owner.triggerLedger?.runtimes.find(r => r.source.instanceId === definition.source.instanceId && r.source.effectIndex === definition.source.effectIndex);
    return [id, runtime?.triggerCount ?? 0];
  }));
}

function bracerStats(state: MatchState, ownerId: string) {
  const stats = readCombatStats(state.combat!.units.find(u => u.id === ownerId)!, state.combat!);
  return [stats.armor, stats.magicResist, stats.abilityPower];
}

function equipBracer(state: MatchState, ownerId: string): MatchState {
  state = accepted(grantMechanicItem(state, { receiptId: 'boundary-bracer', source: 'test', definitionId: BRACER }));
  return accepted(equipItem(state, state.items.at(-1)!.id, ownerId, 0));
}

function stepTo(state: MatchState, tick: number): MatchState {
  while (state.phase === 'combat' && state.combat!.tick < tick) state = stepMatch(state).state;
  expect(state.phase).toBe('combat');
  expect(state.combat!.tick).toBe(tick);
  return state;
}

function expectRestoredTicks(checkpoints: readonly MatchState[]) {
  for (const checkpoint of checkpoints) for (const format of ['object', 'json'] as const) {
    let live = checkpoint;
    let restored: MatchState | undefined;
    // Check every checkpoint/format even if a current restore validator rejects
    // one live save. Keep that rejection red instead of weakening the fixture.
    expect.soft(() => {
      restored = restoreMatch(format === 'json' ? serializeMatch(live) : structuredClone(live));
    }, `${format} save at tick ${live.combat!.tick}`).not.toThrow();
    if (!restored) continue;
    expect(restored).toEqual(live);
    expect(serializeMatch(restored)).toBe(serializeMatch(live));
    while (live.phase === 'combat') {
      const next = stepMatch(live), resumed = stepMatch(restored);
      expect(resumed.events, `${format}: events at tick ${next.state.combat!.tick}`).toEqual(next.events);
      expect(resumed.state, `${format}: state at tick ${next.state.combat!.tick}`).toEqual(next.state);
      live = next.state; restored = resumed.state;
    }
  }
}

describe('dead-holder public combat fixture', () => {
  let fixture: { state: MatchState; initial: MatchState; before: MatchState; ownerId: string };
  beforeAll(() => {
    // v22 AD/mana rules moved the old seed's same-tick death; seed 207 at (3,7) has it at tick 352 after one earlier kill.
    let state = frontRowRod(207);
    for (let i = 0; i < 9; i++) state = accepted(grantMechanicUnit(state, { receiptId: `boundary-zyra-${i}`, source: 'test', definitionId: 'zyra' }));
    const owner = state.preparation.units.find(u => u.definitionId === 'zyra' && u.team === 'player')!;
    state = equipBracer(state, owner.id);
    state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 3, row: 7 } }));
    const initial = accepted(startMatchCombat(state));
    let before = initial;
    while (before.phase === 'combat' && before.combat!.tick < 351) before = stepMatch(before).state;
    fixture = freezeContent(structuredClone({ state, initial, before, ownerId: owner.id }));
  });

  it("retains a dead holder's same-tick killing blow but grants zero kill or assist stacks, with identical restored ticks", () => {
    const copy = structuredClone(fixture), state = certifyFixture(copy.state);
    certifyFixture(copy.initial); certifyFixture(copy.before);
    const owner = state.preparation.units.find(u => u.id === copy.ownerId)!;
    expect(owner.starLevel).toBe(3);
    const initial = copy.initial, before = stepTo(copy.before, 351);
    const result = stepMatch(before), after = result.state;
    const targetId = 'enemy-r4-2';
    expect(after.combat!.tick).toBe(352);
    expect(result.events.filter(e => e.type === 'kill')).toEqual([
      expect.objectContaining({ type: 'kill', tick: 352, unitId: owner.id, source: expect.objectContaining({ ownerId: 'enemy-r4-2' }) }),
      expect.objectContaining({ type: 'kill', tick: 352, unitId: targetId, source: expect.objectContaining({ ownerId: owner.id }) }),
    ]);
    expect(result.events.filter(e => e.type === 'packetDamage' && e.outcome.killingPacket)).toEqual([
      expect.objectContaining({ outcome: expect.objectContaining({ context: expect.objectContaining({ targetId: owner.id }) }) }),
      expect.objectContaining({ outcome: expect.objectContaining({ context: expect.objectContaining({ targetId, source: expect.objectContaining({ ownerId: owner.id }) }) }) }),
    ]);
    for (const id of [owner.id, targetId]) {
      expect(before.combat!.units.find(u => u.id === id)).toMatchObject({ alive: true, hp: expect.any(Number) });
      expect(before.combat!.units.find(u => u.id === id)!.hp).toBeGreaterThan(0);
      expect(after.combat!.units.find(u => u.id === id)).toMatchObject({ alive: false, hp: 0 });
    }
    expect(after.combat!.damageContributors![targetId]).toContain(owner.id);
    // Combat filters participants using settled HP, even though this packet keeps
    // its kill attribution. The dead holder cannot receive either bracer trigger.
    expect(bracerCounts(before, owner.id)).toEqual({ kill: 1, assist: 0 });
    expect(bracerCounts(after, owner.id)).toEqual({ kill: 1, assist: 0 });
    expect(bracerStats(before, owner.id)).toEqual([60, 60, 150]);
    // Death cleanup removes the existing bracer resistance buffs and Rell's
    // debuff; AP and receipts still show the one earlier personal-kill stack.
    expect(bracerStats(after, owner.id)).toEqual([50, 50, 150]);
    expectRestoredTicks([initial, before, after]);
  }, 30000);
});

describe.each([
  // v23: Black Rose owner is the lowest numeric unit serial (unit-9 before unit-10); on these public Manaflow
  // routes Morgana is that unit and owns Sion. Ticks moved with the v23 opening-encounter mixing.
  { contribution: false, seed: 108, cells: [{ col: 4, row: 6 }, { col: 0, row: 6 }, { col: 4, row: 7 }], tick: 219, targetId: 'enemy-r4-1' },
  { contribution: true, seed: 175, cells: [{ col: 4, row: 6 }, { col: 0, row: 6 }, { col: 4, row: 7 }], tick: 226, targetId: 'enemy-r4-1' },
])('summon public combat fixture: contribution=$contribution', ({ contribution, seed, cells, tick, targetId }) => {
  let fixture: { state: MatchState; start: MatchCommandResult; before: MatchState; ownerId: string };
  beforeAll(() => {
    // v15 retains the same contribution cases with actual Manaflow offers.
    let state = acquireEquipment(['rod'], { seed, augmentPriorities: [contribution ? 'manaflow-ii' : 'manaflow-i'] });
    for (const [i, definitionId] of ['morgana', 'cassiopeia', 'vladimir'].entries()) {
      state = accepted(grantMechanicUnit(state, { receiptId: `boundary-rose-${definitionId}`, source: 'test', definitionId }));
      const unit = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
      state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: cells[i] }));
    }
    const owner = state.preparation.units.find(u => u.definitionId === 'morgana' && u.team === 'player')!;
    state = equipBracer(state, owner.id);
    const start = startMatchCombat(state), initial = accepted(start);
    if (!start.ok) throw new Error(start.reason);
    let before = initial;
    while (before.phase === 'combat' && before.combat!.tick < tick - 1) before = stepMatch(before).state;
    fixture = freezeContent(structuredClone({ state, start, before, ownerId: owner.id }));
  });

  it(`a holder-owned summon kills as itself; holder contribution=${contribution} controls only assists, with identical restored ticks`, () => {
    const { state, start, before: checkpoint, ownerId } = structuredClone(fixture);
    for (const input of [state, start.state, checkpoint]) certifyFixture(input);
    const owner = state.preparation.units.find(u => u.id === ownerId)!;
    const initial = accepted(start), summonId = `${owner.id}:g23-sion`;
    if (!start.ok) throw new Error(start.reason);
    // The real spawn receipt establishes that this Sion belongs to the holder.
    expect(start.events.filter(e => e.type === 'unitSpawned')).toEqual([
      expect.objectContaining({ type: 'unitSpawned', unitId: summonId, definitionId: 'g23-sion', source: expect.objectContaining({ ownerId: owner.id }) }),
    ]);
    const before = stepTo(checkpoint, tick - 1), result = stepMatch(before), after = result.state;
    expect(after.combat!.tick).toBe(tick);
    expect(result.events.filter(e => e.type === 'kill')).toEqual([
      expect.objectContaining({ type: 'kill', unitId: targetId, source: expect.objectContaining({ ownerId: summonId, sourceKind: 'attack' }) }),
    ]);
    const packets = result.events.flatMap(e => e.type === 'packetDamage' ? [e.outcome] : []);
    expect(packets.filter(p => p.killingPacket)).toEqual([
      expect.objectContaining({ context: expect.objectContaining({ targetId, source: expect.objectContaining({ ownerId: summonId }) }) }),
    ]);
    expect(packets.some(p => p.context.source.ownerId === owner.id && p.context.targetId === targetId && p.absorbed + p.hpDamage > 0)).toBe(false);
    expect(before.combat!.damageContributors![targetId].includes(owner.id)).toBe(contribution);
    expect(after.combat!.damageContributors![targetId].includes(owner.id)).toBe(contribution);
    expect(after.combat!.damageContributors![targetId]).toContain(summonId);
    expect(after.combat!.units.find(u => u.id === owner.id)!.hp).toBeGreaterThan(0);
    expect(bracerCounts(before, owner.id)).toEqual({ kill: 0, assist: 0 });
    expect(bracerCounts(after, owner.id)).toEqual({ kill: 0, assist: contribution ? 1 : 0 });
    // +15 for an actual assist, +0 without personal contribution; never the +20
    // personal-kill reward merely because the spawn receipt names the holder.
    expect(bracerStats(after, owner.id).map((n, i) => n - bracerStats(before, owner.id)[i])).toEqual(Array(3).fill(contribution ? 15 : 0));
    expectRestoredTicks([initial, before, after]);
  }, 30000);
});
