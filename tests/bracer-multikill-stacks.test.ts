import { beforeAll, expect, it } from 'vitest';
import { deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchEvent, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { dispatchTriggers, EMPTY_TRIGGER_LEDGER, type TriggerSignal } from '../src/simulation/m8/triggers';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { publicEquipmentPreparation } from './fixtures/m8-b4-match';
import { BRACER } from './fixtures/explorer-bracer-public';

const accepted = (r: MatchCommandResult) => { if (!r.ok) throw new Error(r.reason); return r.state; };
const lux = (s: MatchState) => s.combat!.units.find(u => u.definitionId === 'lux' && u.team === 'player')!;
const count = (s: MatchState) => lux(s).triggerLedger!.runtimes.filter(r => r.source.definitionId === BRACER).reduce((n, r) => n + r.triggerCount, 0);
function finish(from: MatchState) {
  let state = from; const events: MatchEvent[] = [];
  while (state.phase === 'combat') { const r = stepMatch(state); state = r.state; events.push(...r.events); }
  return { state, events };
}
let initial: MatchState, before: MatchState, after: MatchState, doubleKill: MatchEvent[];
beforeAll(() => {
  let state = publicEquipmentPreparation(['rod']);
  for (let i = 0; i < 8; i++) state = accepted(grantMechanicUnit(state, { receiptId: `lux-${i}`, source: 'test', definitionId: 'lux' }));
  const owner = state.preparation.units.find(u => u.definitionId === 'lux' && u.team === 'player')!;
  // S13 Lux shields and empowers her next attack. Its real Luden splash makes
  // the second kill in the SAME root action, without inventing an AoE Lux spell.
  for (const [slot, definitionId] of [BRACER, 'TFT_Item_Artifact_LudensTempest', 'TFT5_Item_RabadonsDeathcapRadiant'].entries()) {
    state = accepted(grantMechanicItem(state, { receiptId: `item-${slot}`, source: 'test', definitionId }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, owner.id, slot));
  }
  state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 0, row: 4 } }));
  initial = state = accepted(startMatchCombat(state));
  while (state.phase === 'combat') {
    const r = stepMatch(state);
    const kills = r.events.filter(e => e.type === 'kill' && e.source.ownerId === owner.id);
    if (kills.length === 2) { before = state; after = r.state; doubleKill = [...r.events]; break; }
    state = r.state;
  }
  expect(after, 'the public route must produce a real simultaneous double kill').toBeDefined();
});

it('Lux kills two different targets in one root action and gains two +20 stacks', () => {
  const packets = doubleKill.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome] : []);
  expect(after.combat!.tick).toBe(143);
  expect(packets).toHaveLength(2);
  expect(new Set(packets.map(p => p.context.rootActionSeq))).toEqual(new Set([20]));
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
    expect(finish(restored)).toEqual(finish(state));
  }
});

it.each(['kill', 'assist'] as const)('deduplicates the same target, counts the second target, and keeps %s exclusive', kind => {
  const owner = lux(initial), combatId = initial.combat!.combatId!;
  const definitions = owner.mechanismDefinitions!.eventTriggers!.filter(d => d.source.definitionId === BRACER);
  const packets = doubleKill.flatMap(e => e.type === 'packetDamage' && e.outcome.killingPacket ? [e.outcome] : []);
  const units = initial.combat!.units;
  let ledger = EMPTY_TRIGGER_LEDGER;
  for (const [eventSeq, targetIndex, expected] of [[1, 0, 1], [2, 0, 0], [3, 1, 1], [3, 1, 0]] as const) {
    const packet = packets[targetIndex];
    const damage = kind === 'kill' ? packet : { ...packet, context: { ...packet.context, source: { ...packet.context.source, ownerId: 'other-killer' } } };
    const signal: TriggerSignal = { aggregation: 'event', context: { event: 'kill-or-assist', eventSeq, tick: 143,
      actionSeq: 20, actorId: owner.id, targetId: packet.context.targetId, cast: null }, facts: { damage: [damage], healing: [], shieldDecay: [] } };
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
    const signal: TriggerSignal = { aggregation: 'event', context: { event: 'kill-or-assist', eventSeq: i + 1, tick: 143, actionSeq: 20, actorId: owner.id, targetId: packet.context.targetId, cast: null }, facts: { damage: [packet], healing: [], shieldDecay: [] } };
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

it("retains a dead holder's same-tick killing blow but grants zero kill or assist stacks, with identical restored ticks", () => {
  let state = publicEquipmentPreparation(['rod']);
  for (let i = 0; i < 9; i++) state = accepted(grantMechanicUnit(state, { receiptId: `boundary-zyra-${i}`, source: 'test', definitionId: 'zyra' }));
  const owner = state.preparation.units.find(u => u.definitionId === 'zyra' && u.team === 'player')!;
  expect(owner.starLevel).toBe(3);
  state = equipBracer(state, owner.id);
  state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 5, row: 4 } }));
  const initial = accepted(startMatchCombat(state)), before = stepTo(initial, 410);
  const result = stepMatch(before), after = result.state;
  const targetId = 'enemy-r4-2';
  expect(after.combat!.tick).toBe(411);
  expect(result.events.filter(e => e.type === 'kill')).toEqual([
    expect.objectContaining({ type: 'kill', tick: 411, unitId: owner.id, source: expect.objectContaining({ ownerId: 'enemy-r4-2' }) }),
    expect.objectContaining({ type: 'kill', tick: 411, unitId: targetId, source: expect.objectContaining({ ownerId: owner.id }) }),
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

it.each([
  { contribution: false, cells: [{ col: 6, row: 7 }, { col: 0, row: 7 }, { col: 1, row: 7 }], tick: 190, targetId: 'enemy-r4-1' },
  { contribution: true, cells: [{ col: 0, row: 4 }, { col: 6, row: 4 }, { col: 5, row: 4 }], tick: 369, targetId: 'enemy-r4-2' },
])('a holder-owned summon kills as itself; holder contribution=$contribution controls only assists, with identical restored ticks', ({ contribution, cells, tick, targetId }) => {
  let state = publicEquipmentPreparation(['rod']);
  for (const [i, definitionId] of ['morgana', 'cassiopeia', 'vladimir'].entries()) {
    state = accepted(grantMechanicUnit(state, { receiptId: `boundary-rose-${definitionId}`, source: 'test', definitionId }));
    const unit = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: cells[i] }));
  }
  const owner = state.preparation.units.find(u => u.definitionId === 'morgana' && u.team === 'player')!;
  state = equipBracer(state, owner.id);
  const start = startMatchCombat(state), initial = accepted(start), summonId = `${owner.id}:g23-sion`;
  if (!start.ok) throw new Error(start.reason);
  // The real spawn receipt establishes that this Sion belongs to the holder.
  expect(start.events.filter(e => e.type === 'unitSpawned')).toEqual([
    expect.objectContaining({ type: 'unitSpawned', unitId: summonId, definitionId: 'g23-sion', source: expect.objectContaining({ ownerId: owner.id }) }),
  ]);
  const before = stepTo(initial, tick - 1), result = stepMatch(before), after = result.state;
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
