import { deepStrictEqual } from 'node:assert/strict';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  deployMatchUnit, equipItem, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchEvent, type MatchState,
} from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { grantedItemPrograms } from '../src/simulation/m8/combat-item-programs';
import { publicEquipmentPreparation } from './fixtures/b8-public-equipment';

const BRACER = 'TFT_Item_Artifact_SeekersArmguard';
const CHEST = 'TFT_Item_UnstableTreasureChest';
const accepted = (result: MatchCommandResult): MatchState => {
  if (!result.ok) throw new Error(`Chest/bracer integration: ${result.reason}`);
  return result.state;
};

/** Real acquisition route followed by production mechanic-grant commands (source
 * "test"), equip/deploy/start/step. The special items are NOT claimed to be
 * naturally rolled by the acquisition route. No combat facts, stats or RNG edits. */
function startFight(): { state: MatchState; receiverId: string; chestHolderId: string } {
  let state = publicEquipmentPreparation(['rod'], { seed: 19 });
  const chestHolderId = state.preparation.units.find(u => u.team === 'player' && u.definitionId !== 'lux')!.id;
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.definitionId !== 'lux' && u.id !== chestHolderId))
    state = accepted(sellUnit(state, unit.id));
  if (!state.preparation.units.some(u => u.team === 'player' && u.definitionId === 'lux'))
    state = accepted(grantMechanicUnit(state, { receiptId: 'joint-lux-base', source: 'test', definitionId: 'lux' }));
  for (let i = 0; i < 2; i++)
    state = accepted(grantMechanicUnit(state, { receiptId: `joint-lux-${i}`, source: 'test', definitionId: 'lux' }));
  const receiver = state.preparation.units.find(u => u.team === 'player' && u.definitionId === 'lux')!;
  expect(receiver.starLevel).toBe(2);
  for (const [unitId, definitionId] of [[receiver.id, BRACER], [chestHolderId, CHEST]]) {
    state = accepted(grantMechanicItem(state, { receiptId: `joint-${definitionId}`, source: 'test', definitionId }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, unitId, 0));
  }
  state = accepted(deployMatchUnit(state, chestHolderId, { kind: 'board', cell: { col: 3, row: 4 } }));
  state = accepted(deployMatchUnit(state, receiver.id, { kind: 'board', cell: { col: 6, row: 7 } }));
  return { state: accepted(startMatchCombat(state)), receiverId: receiver.id, chestHolderId };
}

const checkpointCases = [
  ['before grant', 162], ['grant tick', 163],
  ['before first pulse', 262], ['first pulse', 263],
  ['first bracer stack', 352], ['repeated bracer stack', 469],
  ['before receiver death', 550], ['after receiver death', 551],
] as const;
const checkpoints = new Map<number, { state: MatchState; eventOffset: number }>();
const events: MatchEvent[] = [];
let initial: MatchState, terminal: MatchState, receiverId: string, chestHolderId: string;
const receiverOf = (state: MatchState) => state.combat!.units.find(u => u.id === receiverId)!;
const stacks = (state: MatchState) => receiverOf(state).triggerLedger?.runtimes
  .filter(r => r.source.definitionId === BRACER).reduce((sum, r) => sum + r.triggerCount, 0) ?? 0;
const pulses = (state: MatchState) => {
  const unit = receiverOf(state), grantedSources = new Set(grantedItemPrograms(unit).map(p => p.source.instanceId));
  return unit.mechanismState!.periodicTasks.filter(t => grantedSources.has(t.source.instanceId)).map(t => t.pulseOrdinal);
};
function finish(from: MatchState, original: MatchState) {
  let state = from;
  const continuation: MatchEvent[] = [];
  while (state.phase === 'combat') {
    const result = stepMatch(state), expected = stepMatch(original);
    // Strict deep equality keeps the full per-tick comparison without Vitest's slower matcher.
    deepStrictEqual(result, expected, `continuation tick ${expected.state.combat!.tick}`);
    original = expected.state; state = result.state; continuation.push(...result.events);
  }
  return { state, events: continuation };
}

beforeAll(() => {
  const started = startFight();
  initial = started.state; receiverId = started.receiverId; chestHolderId = started.chestHolderId;
  let state = initial;
  while (state.phase === 'combat') {
    const result = stepMatch(state); state = result.state; events.push(...result.events);
    if (checkpointCases.some(([, tick]) => tick === state.combat!.tick))
      checkpoints.set(state.combat!.tick, { state, eventOffset: events.length });
  }
  terminal = state;
});

describe('chest-granted Archangel with an originally equipped Seeker’s Armguard', () => {
  it('pins the natural grant, pulse, repeated stacks and receiver death in one fight', () => {
    expect(checkpoints.size).toBe(checkpointCases.length);
    expect(receiverOf(initial).itemPrograms!.map(p => p.source.definitionId)).toContain(BRACER);
    expect(receiverOf(initial).combatItemGrants ?? []).toEqual([]);
    const at = (tick: number) => checkpoints.get(tick)!.state;
    expect(receiverOf(at(162)).combatItemGrants ?? []).toEqual([]);
    expect(receiverOf(at(163)).combatItemGrants).toMatchObject([{ definitionId: 'archangel', grantedAtTick: 163 }]);
    expect(at(163).combat!.units.find(u => u.id === chestHolderId)!.alive).toBe(false);
    expect(pulses(at(262))).toEqual([0]);
    expect(pulses(at(263))).toEqual([1]);
    expect(readCombatStats(receiverOf(at(263)), at(263).combat!).abilityPower
      - readCombatStats(receiverOf(at(262)), at(262).combat!).abilityPower).toBe(30);
    expect(stacks(at(263))).toBe(0);
    expect(stacks(at(352))).toBe(1);
    expect(stacks(at(469))).toBe(2);
    expect(receiverOf(at(550)).alive).toBe(true);
    expect(receiverOf(at(551)).alive).toBe(false);
    expect(pulses(at(550))).toEqual([3]);
    // Production death cleanup cancels attached periodic tasks, but preserves
    // the earned grant and bracer receipts in the deceased receiver’s save.
    expect(pulses(at(551))).toEqual([]);
    expect(receiverOf(at(551)).combatItemGrants).toEqual(receiverOf(at(550)).combatItemGrants);
    expect(receiverOf(at(551)).triggerLedger).toEqual(receiverOf(at(550)).triggerLedger);
    expect(stacks(at(551))).toBe(2);
    expect(terminal.combat!.tick).toBe(551);
    expect(terminal.phase).not.toBe('combat');
  });

  it.each(['restore', 'serialize'] as const)('rejects an in-place grant edit after successful %s validation', warmup => {
    const candidate = structuredClone(checkpoints.get(263)!.state);
    const grants = receiverOf(candidate).combatItemGrants!;
    expect(grants[0].definitionId).toBe('archangel');
    if (warmup === 'restore') expect(restoreMatch(candidate)).toEqual(candidate);
    else expect(JSON.parse(serializeMatch(candidate))).toEqual(candidate);
    (grants[0] as { definitionId: string }).definitionId = 'shojin';
    expect(receiverOf(candidate).combatItemGrants).toBe(grants);
    expect(() => restoreMatch(candidate)).toThrow('uncompiled mechanism definitions');
    expect(() => serializeMatch(candidate)).toThrow('uncompiled mechanism definitions');
  });

  it.each(checkpointCases)('%s @%i: JSON/object restore preserves the entire state and uninterrupted continuation', (_label, tick) => {
    const { state, eventOffset } = checkpoints.get(tick)!;
    const saved = serializeMatch(state);
    for (const input of [saved, structuredClone(state)]) {
      const restored = restoreMatch(input);
      expect(restored).toEqual(state);
      expect(serializeMatch(restored)).toBe(saved);
      // Full Match equality includes outcome/settlement, every unit, grants,
      // sampled-stat receipts, periodic state, RNG counters and all events.
      expect(finish(restored, state)).toEqual({ state: terminal, events: events.slice(eventOffset) });
    }
  });
});
