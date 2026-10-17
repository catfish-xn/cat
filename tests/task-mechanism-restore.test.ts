import { expect, it } from 'vitest';
import { deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { publicEquipmentPreparation } from './fixtures/m8-b4-match';
import { BRACER } from './fixtures/explorer-bracer-public';

const accepted = (r: MatchCommandResult): MatchState => { if (!r.ok) throw new Error(r.reason); return r.state; };
// The two public Sion positions are copied from c0fe4c1; no battle facts are patched.
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
    const saved = serializeMatch(live);
    let restored = restoreMatch(format === 'json' ? saved : structuredClone(live));
    expect(restored).toEqual(live);
    expect(serializeMatch(restored)).toBe(saved);
    while (live.phase === 'combat') {
      const next = stepMatch(live), resumed = stepMatch(restored);
      expect(resumed.events, `${format}: events at tick ${next.state.combat!.tick}`).toEqual(next.events);
      expect(resumed.state, `${format}: state at tick ${next.state.combat!.tick}`).toEqual(next.state);
      live = next.state; restored = resumed.state;
    }
  }
}

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
  expect(before.combat!.units.find(u => u.id === owner.id)!.tasks!.some(t => t.kind === 'g22Curse')).toBe(true);
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
  expect(initial.combat!.units.find(u => u.id === summonId)!.runtime!.buddyTriggered).toBe(false);
  expect(after.combat!.units.find(u => u.id === summonId)!.runtime!.buddyTriggered).toBe(true);
  expectRestoredTicks([initial, before, after]);
  for (const checkpoint of [initial, after]) {
    const bad = structuredClone(checkpoint), summon = bad.combat!.units.find(u => u.id === summonId)!;
    Object.assign(summon.runtime!, { buddyTriggered: !summon.runtime!.buddyTriggered });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save: Sion binding facts');
  }
}, 30000);

function morganaCurseSave(twoOwners = false): MatchState {
  let state = publicEquipmentPreparation(['rod']);
  state = accepted(grantMechanicUnit(state, { receiptId: 'curse-morgana', source: 'test', definitionId: 'morgana' }));
  if (twoOwners) state = accepted(grantMechanicUnit(state, { receiptId: 'second-morgana', source: 'test', definitionId: 'morgana' }));
  const owners = state.preparation.units.filter(u => u.definitionId === 'morgana' && u.team === 'player');
  for (const [i, owner] of owners.entries())
    state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: i * 6, row: 4 } }));
  state = accepted(startMatchCombat(state));
  expect(state.combat!.units.some(u => u.definitionId === 'g23-sion')).toBe(false);
  while (state.phase === 'combat') {
    if (state.combat!.units.some(u => u.tasks?.some(t => t.kind === 'g22Curse'))) return state;
    state = stepMatch(state).state;
  }
  throw new Error('Public Morgana must schedule her curse');
}

it('saves Morgana curse without a summon or bracer, restores object/JSON, and continues every tick', () => {
  const state = morganaCurseSave();
  const owner = state.combat!.units.find(u => u.definitionId === 'morgana')!;
  expect(owner.tasks).toHaveLength(10);
  expect(owner.tasks!.every(t => t.kind === 'g22Curse' && t.attachedDot === true)).toBe(true);
  expectRestoredTicks([state, stepTo(state, owner.tasks![0].executeAtTick)]);
}, 30000);

it.each(['attachment', 'source', 'timing', 'action', 'amount', 'missing'] as const)(
  'rejects corrupted curse %s binding for object and JSON beside a valid control', mismatch => {
    const state = morganaCurseSave(), bad = structuredClone(state);
    const owner = bad.combat!.units.find(u => u.definitionId === 'morgana')!, task = owner.tasks![0];
    if (mismatch === 'attachment') Object.assign(task, { attachedDot: false });
    if (mismatch === 'source') Object.assign(task.source, { effectIndex: 1 });
    if (mismatch === 'timing') Object.assign(task, { executeAtTick: task.executeAtTick + 1 });
    if (mismatch === 'action') Object.assign(task, { actionSeq: task.actionSeq + 1 });
    if (mismatch === 'amount') Object.assign(task, { amount: task.amount + 1 });
    if (mismatch === 'missing') Object.assign(owner, { tasks: [] });
    const reason = mismatch === 'attachment' ? 'task mechanism binding'
      : mismatch === 'source' ? 'ability source identity' : 'curse task binding facts';
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow(`Invalid Match save: ${reason}`);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  },
);

it('rejects transferring pulses to another real Morgana even with rebuilt source/holder/key identities', () => {
  const state = morganaCurseSave(true), bad = structuredClone(state);
  const owners = bad.combat!.units.filter(u => u.definitionId === 'morgana');
  expect(owners).toHaveLength(2);
  const owner = owners.find(u => u.tasks!.length > 0)!, other = owners.find(u => u !== owner)!;
  const moved = owner.tasks!.map(task => ({ ...task,
    key: JSON.stringify([other.id, task.actionSeq, task.kind, task.ordinal, task.targetId]),
    source: { ...task.source, ownerId: other.id, instanceId: other.id },
  }));
  Object.assign(owner, { tasks: [] });
  Object.assign(other, { tasks: [...other.tasks!, ...moved] });
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save: curse task binding facts');
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
});

it('rejects an appended fake bleed while retaining every genuine Morgana curse pulse', () => {
  const state = morganaCurseSave(), bad = structuredClone(state);
  const owner = bad.combat!.units.find(u => u.definitionId === 'morgana')!, curse = owner.tasks![0];
  const fake = { key: 'forged-bleed-beside-real-curses', kind: 'bleed' as const,
    source: { ...curse.source }, targetId: curse.targetId, actionSeq: curse.actionSeq,
    executeAtTick: bad.combat!.tick + 1, amount: 1000, ordinal: 0, total: 1,
    cancellable: false, attachedDot: true };
  Object.assign(owner, { tasks: [...owner.tasks!, fake] });
  expect(owner.tasks!.filter(t => t.kind === 'g22Curse')).toEqual(state.combat!.units.find(u => u.id === owner.id)!.tasks);
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('curse task binding facts');
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
});

it('restores a living Bulky Buddies holder after its Forge buddy dies and Jayce revives that same Forge', async () => {
  const { publicEquipmentPreparation: prepare } = await import('./fixtures/b8-public-equipment');
  let state = prepare(['rod'], { seed: 26 });
  expect(state.augments.some(a => a.definitionId === 'bulky-buddies-i')).toBe(true);
  for (const [definitionId, copies] of [['jayce', 3], ['irelia', 2]] as const)
    for (let i = 0; i < copies; i++) state = accepted(grantMechanicUnit(state, { receiptId: `revive-${definitionId}-${i}`, source: 'test', definitionId }));
  const jayce = state.preparation.units.find(u => u.definitionId === 'jayce')!;
  state = accepted(deployMatchUnit(state, jayce.id, { kind: 'board', cell: { col: 0, row: 7 } }));
  state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } }));
  state = accepted(startMatchCombat(state));
  const forgeId = `${jayce.id}:g23-forge`;
  expect(state.combat!.units.find(u => u.id === 'unit-1')!.mechanics).toContainEqual(expect.objectContaining({ mechanic: 'bulkyBuddies', targetId: forgeId }));
  let beforeDeath: MatchState | undefined, afterDeath: MatchState | undefined, revived: MatchState | undefined;
  while (state.phase === 'combat') {
    const before = state, result = stepMatch(state); state = result.state;
    if (result.events.some(e => e.type === 'death' && e.unitId === forgeId)) { beforeDeath = before; afterDeath = state; }
    if (result.events.some(e => e.type === 'unitRevived' && e.unitId === forgeId)) { revived = state; break; }
  }
  expect(beforeDeath).toBeDefined(); expect(afterDeath).toBeDefined(); expect(revived).toBeDefined();
  expect(afterDeath!.combat!.units.find(u => u.id === forgeId)!.alive).toBe(false);
  expect(afterDeath!.combat!.units.find(u => u.id === 'unit-1')!.runtime!.buddyTriggered).toBe(true);
  expect(revived!.combat!.units.find(u => u.id === forgeId)!.alive).toBe(true);
  expect(revived!.combat!.units.find(u => u.id === 'unit-1')).toMatchObject({ alive: true, runtime: { buddyTriggered: true } });
  expectRestoredTicks([beforeDeath!, afterDeath!, revived!]);
  // A Forge binding alone authorizes neither an early flag nor deleting a real
  // trigger after revival: validate the historical event in both directions.
  for (const checkpoint of [beforeDeath!, revived!]) {
    const bad = structuredClone(checkpoint), holder = bad.combat!.units.find(u => u.id === 'unit-1')!;
    Object.assign(holder.runtime!, { buddyTriggered: !holder.runtime!.buddyTriggered });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('buddy trigger binding facts');
  }
}, 30000);
