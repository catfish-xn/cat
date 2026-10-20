import { beforeAll, expect, it, vi } from 'vitest';
import * as replayCombat from '../src/simulation/combat';
import * as content from '../src/simulation/content';
import { BattleHistory } from '../src/replay/history';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import { purchasedThreeHeroMatch } from './match-helpers';
import { deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { publicEquipmentPreparation as acquireEquipment } from './fixtures/b8-public-equipment';
// Keep the original seed/2-1 combat and passive augment; its v16 opening
// gloves are genuinely acquired, while the old unused rod now arrives later.
const cursePreparation=()=>acquireEquipment(['gloves'],{seed:3151248,augmentPriorities:['inspiring-epitaph','clockwork-accelerator']});
import { BRACER } from './fixtures/explorer-bracer-public';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';

// Acquisition is input preparation; all behavior and restoration stay in cases.
for (const options of [
  { seed: 77 }, { seed: 3151248, augmentPriorities: ['glass-cannon-ii'] },
  { seed: 42 }, { seed: 112 },
]) beforeAll(() => { acquireEquipment(['rod'], options); });
beforeAll(() => { acquireEquipment(['rod']); });

const accepted = (r: MatchCommandResult): MatchState => { if (!r.ok) throw new Error(r.reason); return r.state; };
// v16 public position vectors: real Sion attack kills at244/355, zero personal
// kill reward and exactly0/15 assist stats; no battle facts or stats are patched.
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
  { contribution: false, cells: [{ col: 6, row: 7 }, { col: 0, row: 7 }, { col: 1, row: 7 }], tick: 192, targetId: 'enemy-r4-1' },
  { contribution: true, cells: [{ col: 0, row: 4 }, { col: 6, row: 4 }, { col: 5, row: 4 }], tick: 369, targetId: 'enemy-r4-2' },
])('a holder-owned summon kills as itself; holder contribution=$contribution controls only assists, with identical restored ticks', ({ contribution, cells, tick, targetId }) => {
  // v15 seed 3151248 offers Manaflow II (inert in row 4); seed 5 offers
  // Manaflow I for the back-row contribution=false board.
  let state = acquireEquipment(['rod'], { seed: contribution ? 3151248 : 5, augmentPriorities: [contribution ? 'manaflow-ii' : 'manaflow-i'] });
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
  const checkpoints = [initial, before, after];
  if (contribution) {
    let completed = initial;
    while (!completed.combat!.units.find(u => u.id === owner.id)!.tasks!.some(t => t.kind === 'g22Curse')){
      expect(completed.phase).toBe('combat');completed = stepMatch(completed).state;
    }
    const firstCast = completed.combat!.units.find(u => u.id === owner.id)!.tasks!.filter(t => t.kind === 'g22Curse');
    const actionSeq = firstCast[0].actionSeq;
    while (completed.phase === 'combat' && completed.combat!.units.find(u => u.id === owner.id)!.tasks!
      .some(t => t.kind === 'g22Curse' && t.actionSeq === actionSeq)) completed = stepMatch(completed).state;
    expect(completed.combat!.tick).toBe(Math.max(...firstCast.filter(t => t.actionSeq === actionSeq).map(t => t.executeAtTick)));
    expect(completed.combat!.units.find(u => u.id === owner.id)!.tasks!
      .some(t => t.kind === 'g22Curse' && t.actionSeq === actionSeq)).toBe(false);
    checkpoints.push(completed);
  }
  expectRestoredTicks(checkpoints);
  for (const checkpoint of [initial, after]) {
    const bad = structuredClone(checkpoint), summon = bad.combat!.units.find(u => u.id === summonId)!;
    Object.assign(summon.runtime!, { buddyTriggered: !summon.runtime!.buddyTriggered });
    expect(() => serializeMatch(bad)).toThrow('Invalid Match save: Sion binding facts');
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save: Sion binding facts');
  }
}, 30000);

function morganaCurseSave(twoOwners = false): MatchState {
  let state = cursePreparation();
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

function expectRejectedAtAllEntrances(bad: MatchState, reason: string) {
  expect(() => serializeMatch(bad)).toThrow(reason);
  expect(() => restoreMatch(bad)).toThrow(reason);
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow(reason);
}

it('rejects altered or invented target reave facts beside the legal seed 3151248 curse', () => {
  const state = morganaCurseSave();
  expect(state.round).toBe(4); expect(state.combat!.tick).toBe(89);
  const target = state.combat!.units.find(u => u.id === 'enemy-r4-1')!;
  expect(target.g22).toMatchObject({ reaveBps: 5000, reaveUntilTick: 289 });
  const owner = state.combat!.units.find(u => u.definitionId === 'morgana')!;
  expect(owner.tasks).toHaveLength(10);
  for (const patch of [{ reaveBps: 0 }, { reaveUntilTick: 89 }, { reaveBps: 0, reaveUntilTick: 0 }]) {
    const bad = structuredClone(state);
    Object.assign(bad.combat!.units.find(u => u.id === target.id)!.g22!, patch);
    expectRejectedAtAllEntrances(bad, 'curse reave binding facts');
  }
  const bad = structuredClone(state), untouched = bad.combat!.units.find(u => u.team === target.team && u.id !== target.id)!;
  expect(untouched.g22?.reaveBps ?? 0).toBe(0);
  Object.assign(untouched, { g22: { initialized: false, wanted: [], wantedDeaths: 0, mordeUntilTick: 0,
    reaveBps: 5000, reaveUntilTick: 289, rebelTriggered: false, exposureFromTick: 0, exposureUntilTick: 0, exposureBps: 0 } });
  expectRejectedAtAllEntrances(bad, 'curse reave binding facts');
});

it('restores the legal target reave and retains Irelia shielding at tick 104', () => {
  const state = morganaCurseSave(), restored = restoreMatch(serializeMatch(state));
  expect(restoreMatch(state)).toEqual(state); expect(restored).toEqual(state);
  const live = stepTo(state, 104), resumed = stepTo(restored, 104);
  expect(resumed).toEqual(live);
  expect(live.combat!.units.find(u => u.id === 'enemy-r4-1')!.shield).toBe(200);
});

async function blackRoseSave(): Promise<MatchState> {
  const { publicEquipmentPreparation: prepare } = await import('./fixtures/b8-public-equipment');
  let state = prepare(['rod'], { seed: 42 });
  expect(state.round).toBe(8);
  for (const [i, definitionId] of ['morgana', 'cassiopeia', 'vladimir'].entries()) {
    state = accepted(grantMechanicUnit(state, { receiptId: `cast-fact-${definitionId}`, source: 'test', definitionId }));
    const unit = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: [0, 6, 5][i], row: 4 } }));
  }
  return stepTo(accepted(startMatchCombat(state)), 20);
}

it('rejects forged Black Rose member cast counts, including redistribution with an unchanged team total', async () => {
  const state = await blackRoseSave(), bad = structuredClone(state);
  const member = bad.combat!.units.find(u => u.definitionId === 'vladimir' && u.team === 'player')!;
  expect(member).toMatchObject({ definitionId: 'vladimir', runtime: { castCount: 0 } });
  Object.assign(member.runtime!, { castCount: 5 });
  expectRejectedAtAllEntrances(bad, 'Black Rose cast binding facts');
  // A genuine cast can also be moved to a different holder without changing
  // the team sum or the current Sion flag. Each holder still needs proof.
  const later = stepTo(state, 89), redistributed = structuredClone(later);
  const morgana = redistributed.combat!.units.find(u => u.definitionId === 'morgana')!;
  const vladimir = redistributed.combat!.units.find(u => u.id === member.id)!;
  expect(morgana.runtime!.castCount).toBeGreaterThan(0);
  Object.assign(morgana.runtime!, { castCount: morgana.runtime!.castCount - 1 });
  Object.assign(vladimir.runtime!, { castCount: vladimir.runtime!.castCount + 1 });
  expectRejectedAtAllEntrances(redistributed, 'Black Rose cast binding facts');
});

it('restores legal Black Rose member counts and keeps Sion bound at tick 21', async () => {
  const state = await blackRoseSave(), restored = restoreMatch(serializeMatch(state));
  expect(restoreMatch(state)).toEqual(state); expect(restored).toEqual(state);
  const live = stepMatch(state), resumed = stepMatch(restored);
  expect(resumed).toEqual(live);
  expect(live.state.combat!.tick).toBe(21);
  expect(live.events.filter(e => e.type === 'bindingChanged')).toEqual([]);
  expect(live.state.combat!.units.find(u => u.definitionId === 'g23-sion')).toMatchObject({ shield: 0, runtime: { buddyTriggered: false } });
});

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
    expect(() => serializeMatch(bad)).toThrow(`Invalid Match save: ${reason}`);
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
  expect(() => serializeMatch(bad)).toThrow('Invalid Match save: curse task binding facts');
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
  expect(() => serializeMatch(bad)).toThrow('curse task binding facts');
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('curse task binding facts');
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
});

it('restores a living Bulky Buddies holder after its Forge buddy dies and Jayce revives that same Forge', async () => {
  const { publicEquipmentPreparation: prepare } = await import('./fixtures/b8-public-equipment');
  // v15 seed 53 offers Bulky Buddies I at the same 2-1 node.
  let state = prepare(['rod'], { seed: 53 });
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
    expect(() => serializeMatch(bad)).toThrow('buddy trigger binding facts');
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('buddy trigger binding facts');
  }
}, 30000);

it.each([
  { label: 'tasks only', items: [] },
  { label: 'bracer and tasks', items: [BRACER] },
])(
  'compares every restore for $label while reusing only exact detached replay evidence', ({ items }) => {
    let state = purchasedThreeHeroMatch();
    for (const [slot, definitionId] of items.entries()) {
      state = accepted(grantMechanicItem(state, { receiptId: `shared-replay-${slot}`, source: 'test', definitionId }));
      state = accepted(equipItem(state, state.items.at(-1)!.id, 'unit-1', slot));
    }
    state = stepTo(accepted(startMatchCombat(state)), 60);
    const json = JSON.stringify(state);
    const create = vi.spyOn(replayCombat, 'createCombatWithEvents');
    const step = vi.spyOn(replayCombat, 'stepCombat');
    try {
      // Only the first lookup simulates. Equal content in independent objects
      // and JSON may reuse proof, but each candidate is still compared in full.
      for (const [index, input] of [state, structuredClone(state), json, json].entries()) {
        create.mockClear(); step.mockClear();
        const restored = restoreMatch(input);
        expect(restored).toEqual(state);
        expect(create).toHaveBeenCalledTimes(index === 0 ? 1 : 0);
        expect(step).toHaveBeenCalledTimes(index === 0 ? 60 : 0);
        expect(restored.combat).not.toBe(state.combat);
      }
      expect(JSON.stringify(state)).toBe(json);
      const owner = state.combat!.units.find(u => u.team === 'player' && u.definitionId !== 'maddie' && u.definitionId !== 'morgana')!;
      const genuine = owner.tasks;
      Object.assign(owner, { tasks: [...genuine ?? [], {
        key: 'shared-replay-forged-maddie', kind: 'maddie', source: {
          ownerId: owner.id, sourceKind: 'ability', definitionId: owner.ability.id,
          instanceId: owner.id, effectIndex: 0,
        }, executeAtTick: 61, targetId: state.combat!.units.find(u => u.team === 'enemy')!.id,
        amount: 1000000, ordinal: 0, total: 1, cancellable: false, actionSeq: 0,
      }] });
      // A hit never caches acceptance: mutating a previously accepted object
      // must still be rejected at all three entrances.
      for (const reject of [() => serializeMatch(state), () => restoreMatch(state), () => restoreMatch(JSON.stringify(state))]) {
        create.mockClear(); step.mockClear();
        expect(reject).toThrow('Invalid Match save: task binding facts');
        expect(create).not.toHaveBeenCalled();
        expect(step).not.toHaveBeenCalled();
      }
      Object.assign(owner, { tasks: genuine });
      expect(JSON.stringify(state)).toBe(json);
      // Returned snapshots cannot poison cached facts, and advancing the same
      // authenticated trajectory computes only the new tick.
      const detached = restoreMatch(json);
      Object.assign(detached.combat!.units[0].runtime!, { castCount: 999 });
      expect(restoreMatch(json)).toEqual(state);
      const next = stepMatch(state).state;
      create.mockClear(); step.mockClear();
      expect(restoreMatch(JSON.stringify(next))).toEqual(next);
      expect(create).not.toHaveBeenCalled(); expect(step).toHaveBeenCalledTimes(1);
    } finally { vi.restoreAllMocks(); }
  },
);

it('bounds replay evidence, separates complete input contents and detaches every returned graph', () => {
  const state = stepTo(accepted(startMatchCombat(purchasedThreeHeroMatch())), 5);
  const basis = state.combatInputBasis!, strategy = state.combat!.strategy!;
  const create = vi.spyOn(replayCombat, 'createCombatWithEvents'), step = vi.spyOn(replayCombat, 'stepCombat');
  const variant = (n: number) => ({ ...basis, battleSeed: 8765400 + n });
  try {
    const original = createRestoreCombatReplay(variant(0), strategy, 5).atSaveTick();
    const bytes = JSON.stringify(original);
    create.mockClear(); step.mockClear();
    Object.assign(original.units[0], { castCount: 999 });
    const copy = createRestoreCombatReplay(structuredClone(variant(0)), structuredClone(strategy), 5).atSaveTick();
    expect(JSON.stringify(copy)).toBe(bytes);
    expect(create).not.toHaveBeenCalled(); expect(step).not.toHaveBeenCalled();
    const opening = createRestoreCombatReplay(variant(0), strategy, 5).opening();
    Object.assign(opening.units[0].runtime!, { castCount: 999 });
    expect(createRestoreCombatReplay(variant(0), strategy, 0).atSaveTick().units[0].castCount).toBe(0);
    // Same seed, roster and tick but different input content must miss too.
    create.mockClear();
    createRestoreCombatReplay({ ...variant(0), inputs: { ...basis.inputs, playerHp: 99 } }, strategy, 5).atSaveTick();
    expect(create).toHaveBeenCalledTimes(1);
    // More than eight distinct trajectories evicts the oldest; misses rebuild
    // from the opening rather than accepting stale evidence from another key.
    for (let n = 1; n <= 8; n++) createRestoreCombatReplay(variant(n), strategy, 5).atSaveTick();
    create.mockClear(); step.mockClear();
    const rebuilt = createRestoreCombatReplay(variant(0), strategy, 5).atSaveTick();
    expect(create).toHaveBeenCalledTimes(1); expect(step).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(rebuilt)).toBe(bytes);
    // Full-input equality is checked after hashing, even under a collision.
    vi.spyOn(content, 'digestContent').mockReturnValue('forced-test-collision');
    create.mockClear();
    const first = createRestoreCombatReplay(variant(100), strategy, 5).atSaveTick();
    const second = createRestoreCombatReplay(variant(101), strategy, 5).atSaveTick();
    expect(create).toHaveBeenCalledTimes(2);
    expect(first.rngState).not.toBe(second.rngState);
  } finally { vi.restoreAllMocks(); }
});

it('reuses verified hashes and incrementally hashes appended events against the full-ledger oracle', () => {
  let state = cursePreparation();
  state = accepted(grantMechanicUnit(state, { receiptId: 'capture-curse', source: 'test', definitionId: 'morgana' }));
  const owner = state.preparation.units.find(u => u.definitionId === 'morgana')!;
  state = accepted(deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 0, row: 4 } }));
  const history = new BattleHistory('capture-curse');
  const observe = (before: MatchState, after: MatchState, events: readonly unknown[], reason: 'command' | 'tick') =>
    history.observe({ before, after, events: events.filter((e): e is LedgerCombatEvent => (e as LedgerCombatEvent).domain === 'combat'), reason });
  const started = startMatchCombat(state);
  const initial = accepted(started);
  if (!started.ok) throw Error(started.reason);
  observe(state, initial, started.events, 'command'); state = initial;
  while (state.combat!.tick < 89) {
    expect(state.phase).toBe('combat');
    const next = stepMatch(state); observe(state, next.state, next.events, 'tick'); state = next.state;
  }
  const prefix = history.capturePrefix()!;
  const restored = new BattleHistory('capture-curse', [], prefix);
  const hash = vi.spyOn(content, 'digestContent');
  try {
    const first = restored.capturePrefix()!, second = restored.capturePrefix()!;
    expect(first).toEqual(prefix); expect(second).toEqual(prefix);
    expect(first.events).not.toBe(second.events);
    expect(hash).not.toHaveBeenCalled();
    const next = stepMatch(state);
    restored.observe({ before: state, after: next.state, events: next.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat'), reason: 'tick' });
    hash.mockClear();
    const advanced = restored.capturePrefix()!;
    expect(hash).toHaveBeenCalledTimes(1);
    expect(advanced.stateHash).toBe(content.digestContent(next.state.combat));
    expect(advanced.eventHash).toBe(content.digestContent(advanced.events));
    hash.mockClear();
    expect(restored.capturePrefix()).toEqual(advanced);
    expect(hash).not.toHaveBeenCalled();
    // Different capture cadences, an eventless observation, and another restore
    // must preserve the original canonical full-ledger digest and old snapshots.
    let live = next.state, recorder = restored;
    const ledger = [...advanced.events], retained = JSON.stringify(prefix);
    recorder.observe({ before: live, after: live, events: [], reason: 'tick' });
    expect(recorder.capturePrefix()!.eventHash).toBe(content.digestContent(ledger));
    for (const ticks of [1, 3, 6]) {
      for (let i = 0; i < ticks; i++) {
        const result = stepMatch(live);
        const events = result.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
        recorder.observe({ before: live, after: result.state, events, reason: 'tick' });
        ledger.push(...events); live = result.state;
      }
      const captured = recorder.capturePrefix()!;
      expect(captured.eventHash).toBe(content.digestContent(ledger));
      expect(captured.stateHash).toBe(content.digestContent(live.combat));
      expect(captured.events).toEqual(ledger);
      recorder = new BattleHistory('capture-curse', [], captured);
      expect(recorder.capturePrefix()).toEqual(captured);
    }
    expect(JSON.stringify(prefix)).toBe(retained);
  } finally { vi.restoreAllMocks(); }
});
