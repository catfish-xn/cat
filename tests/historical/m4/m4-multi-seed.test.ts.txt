import { describe, expect, it } from 'vitest';
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly,
  rerollShop, selectAnomalyTarget, selectChoice, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchState,
} from '../src/simulation/match';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { getStageRound } from '../src/simulation/round-schedule';

// T18: four required boundary seeds and twenty additional fixed uint32 seeds.
const SEEDS = [0, 1, 42, 0xffffffff, 7, 13, 23, 31, 64, 99, 123, 256, 777, 1024, 2048, 4096, 8192,
  12345, 32768, 65535, 424242, 0xdeadbeef, 0x80000000, 0x9e3779b9] as const;
const ROUND_LIMIT = 24;
type Command = (state: MatchState) => MatchCommandResult;

/** Stateful test driver owns only observations. All game writes go through production commands. */
class ParallelMatch {
  original: MatchState;
  restored: MatchState;
  combinations = 0;
  readonly createdItemIds = new Set<string>();
  readonly phases = new Set<string>();
  readonly choiceSteps = new Set<string>();
  commandCount = 0;
  tickCount = 0;
  rerolls = 0;
  augmentSelections = 0;
  anomalyRounds = 0;

  constructor(readonly seed: number) {
    this.original = createMatch(seed);
    this.restored = createMatch(seed);
    for (const item of this.original.items) this.createdItemIds.add(item.id);
    expect(this.restored).toEqual(this.original);
    this.checkResources();
  }

  command(command: Command): void {
    const before = this.original;
    const first = command(before), second = command(this.restored);
    expect(second).toEqual(first);
    expect(first.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('The fixed strategy unexpectedly rejected a command');
    for (const event of first.events) {
      if (event.type === 'itemCombined') {
        this.combinations++;
        expect(new Set(event.consumedIds).size).toBe(2);
        expect(this.createdItemIds.has(event.itemId)).toBe(false);
        this.createdItemIds.add(event.itemId);
      } else if (event.type === 'rewardGranted') {
        for (const id of event.receipt.itemIds) {
          expect(this.createdItemIds.has(id)).toBe(false);
          this.createdItemIds.add(id);
        }
      }
    }
    expect(first.state.nextItemSerial).toBeGreaterThanOrEqual(before.nextItemSerial);
    expect(first.state.nextUnitSerial).toBeGreaterThanOrEqual(before.nextUnitSerial);
    this.original = first.state;
    this.restored = second.state;
    this.commandCount++;
    this.checkResources();
  }

  checkResources(): void {
    const state = this.original;
    this.phases.add(state.phase);
    expect(Number.isSafeInteger(state.gold) && state.gold >= 0).toBe(true);
    for (const rng of [state.rngState, state.choiceRngState, state.rewardRngState]) {
      expect(Number.isInteger(rng) && rng >= 0 && rng <= 0xffffffff).toBe(true);
    }
    expect(state.playerHp).toBe(state.roundResults.at(-1)?.hpAfter ?? 100);
    expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length);
    expect(new Set(state.scheduleReceipts.map(receipt => receipt.eventId)).size).toBe(state.scheduleReceipts.length);
    expect(state.roundResults.map(result => result.round)).toEqual(state.roundResults.map((_, index) => index + 1));
    const rewardCount = state.scheduleReceipts.reduce((sum, receipt) => sum + receipt.itemIds.length, 0);
    expect(state.items.length).toBe(rewardCount - this.combinations);
    expect(state.nextItemSerial).toBe(1 + rewardCount + this.combinations);
    expect(this.createdItemIds.size).toBe(rewardCount + this.combinations);
    const slots = new Set<string>();
    for (const item of state.items) {
      expect(this.createdItemIds.has(item.id)).toBe(true);
      if (item.location.kind !== 'unit') continue;
      const ownerId = item.location.unitId;
      expect(state.preparation.units.some(unit => unit.id === ownerId && unit.team === 'player')).toBe(true);
      expect(item.location.slot >= 0 && item.location.slot < 3).toBe(true);
      const key = `${item.location.unitId}:${item.location.slot}`;
      expect(slots.has(key)).toBe(false);
      slots.add(key);
    }
  }

  /** Deliberate rejected-command insertion has no state, RNG, ID or event-sequence effect. */
  assertBlocked(): void {
    const commands: Command[] = [
      rerollShop, buyXp, state => sellUnit(state, 'unit-1'),
      state => buyUnit(state, 0, state.shop.generation),
      state => deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } }),
      state => equipItem(state, state.items[0]?.id ?? 'missing', 'unit-1', 0),
      state => combineItems(state, state.items[0]?.id ?? 'a', state.items[1]?.id ?? 'b'),
      startMatchCombat, state => nextRound(state, state.round),
    ];
    for (const state of [this.original, this.restored]) for (const command of commands) {
      const result = command(state);
      expect(result).toEqual({ ok: false, reason: 'wrong-phase', state });
      expect(result.state).toBe(state);
    }
    expect(stepMatch(this.original)).toEqual({ state: this.original, events: [] });
    expect(stepMatch(this.original).state).toBe(this.original);
  }

  resolveChoices(): void {
    while (this.original.phase === 'choice') {
      let choice = this.original.pendingChoice!;
      this.choiceSteps.add(`${choice.kind}:${choice.step}`);
      this.assertBlocked();
      if (choice.kind === 'anomaly' && choice.step === 'target') {
        this.command(state => selectAnomalyTarget(state, choice.choiceId, choice.generation, 'unit-1'));
        choice = this.original.pendingChoice!;
        this.choiceSteps.add('anomaly:offer');
        this.assertBlocked();
        this.command(state => rerollAnomaly(state, choice.choiceId, choice.generation));
        this.rerolls++;
        choice = this.original.pendingChoice!;
        this.assertBlocked();
      }
      const definitionId = choice.offers[(this.seed >>> 3) % choice.offers.length];
      this.command(state => selectChoice(state, choice.choiceId, choice.generation, definitionId));
      if (choice.kind === 'augment') this.augmentSelections++;
    }
  }

  prepare(): void {
    if (this.original.round === 1) {
      for (const [index, id] of ['unit-1', 'unit-2', 'unit-3'].entries()) {
        this.command(state => deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + 2 * index, row: 4 } }));
      }
    }
    // All fifteen component pairs have public recipes; no fixture grants or item injection.
    for (;;) {
      const components = this.original.items.filter(item => item.location.kind === 'inventory'
        && ITEM_DEFINITIONS[item.definitionId].kind === 'component').sort((a, b) => a.id < b.id ? -1 : 1);
      if (components.length < 2) break;
      const [a, b] = components;
      this.command(state => combineItems(state, a.id, b.id));
    }
    for (const item of this.original.items.filter(item => item.location.kind === 'inventory')) {
      let destination: { unitId: string; slot: number } | undefined;
      for (const unitId of ['unit-2', 'unit-1', 'unit-3']) {
        const occupied = new Set(this.original.items.filter(other => other.location.kind === 'unit'
          && other.location.unitId === unitId).map(other => other.location.kind === 'unit' ? other.location.slot : -1));
        const slot = [0, 1, 2].find(slot => !occupied.has(slot));
        if (slot !== undefined) { destination = { unitId, slot }; break; }
      }
      if (destination) {
        const { unitId, slot } = destination;
        this.command(state => equipItem(state, item.id, unitId, slot));
      }
    }
    if (this.original.gold >= 6 && this.original.level < 9) {
      this.command(rerollShop);
      this.command(buyXp);
    } else if (this.original.gold >= 2) this.command(rerollShop);
    // Exercise ordinary E and resource preservation while retaining a nonempty combat roster.
    if (this.original.round === 3) this.command(state => sellUnit(state, 'unit-4'));
    if (this.original.round === 4) this.command(state => sellUnit(state, 'unit-5'));
    this.restored = restoreMatch(serializeMatch(this.restored));
    expect(this.restored).toEqual(this.original);
  }

  fight(): void {
    this.command(startMatchCombat);
    let roundTicks = 0;
    if (this.original.anomalyBinding) this.anomalyRounds++;
    while (this.original.phase === 'combat') {
      expect(roundTicks++).toBeLessThan(1200);
      const first = stepMatch(this.original), second = stepMatch(this.restored);
      expect(second).toEqual(first);
      // Combat cannot consume permanent inventory or edit preparation ownership.
      expect(first.state.items).toBe(this.original.items);
      expect(first.state.preparation).toBe(this.original.preparation);
      this.original = first.state;
      this.restored = second.state;
      this.tickCount++;
      for (const unit of this.original.combat!.units) {
        expect(unit.hp >= 0 && unit.hp <= unit.maxHp && unit.mana >= 0 && unit.mana <= unit.maxMana).toBe(true);
        for (const counter of unit.effectRuntime!) {
          const trigger = unit.triggers!.find(trigger => trigger.key === counter.key)!;
          expect(Number.isSafeInteger(counter.count) && counter.count >= 0
            && counter.count <= (trigger.hook === 'combatStart' ? 1 : this.original.combat!.tick)).toBe(true);
        }
      }
    }
    this.checkResources();
    this.restored = restoreMatch(serializeMatch(this.restored));
    expect(this.restored).toEqual(this.original);
  }
}

describe('T18 fixed multi-seed complete Match regression', () => {
  it.each(SEEDS)('replays seed %i with conserved resources and blocking choices until a bounded terminal result', seed => {
    const run = new ParallelMatch(seed);
    for (let round = 1; round <= ROUND_LIMIT; round++) {
      expect(run.original.round).toBe(round);
      expect(getStageRound(round)).toEqual({ stage: 1 + Math.floor((round - 1) / 3), round: 1 + (round - 1) % 3 });
      run.resolveChoices();
      run.prepare();
      run.fight();
      if (run.original.phase === 'gameOver') break;
      if (round < ROUND_LIMIT) run.command(state => nextRound(state, state.round));
    }
    expect(run.original.phase === 'gameOver' || (run.original.phase === 'settlement' && run.original.round === ROUND_LIMIT)).toBe(true);
    expect(run.original.round).toBeLessThanOrEqual(ROUND_LIMIT);
    expect(run.tickCount).toBeLessThanOrEqual(ROUND_LIMIT * 1200);
    expect(run.tickCount).toBeGreaterThan(0);
    expect(run.commandCount).toBeGreaterThan(20);
    expect(run.phases.has('preparation') && run.phases.has('choice') && run.phases.has('combat') && run.phases.has('settlement')).toBe(true);
    expect(run.choiceSteps).toEqual(new Set(['augment:offer', 'anomaly:target', 'anomaly:offer']));
    expect(run.augmentSelections).toBe(2);
    expect(run.rerolls).toBe(1);
    expect(run.anomalyRounds).toBeGreaterThanOrEqual(2);
    expect(run.combinations).toBeGreaterThanOrEqual(1);
    if (run.original.phase === 'gameOver') {
      expect(run.original.playerHp).toBe(0);
      run.assertBlocked();
    }
    expect(createMatch(seed)).toEqual(createMatch(seed));
    expect(createMatch(seed).roundResults).toEqual([]);
    expect(run.restored).toEqual(run.original);
  }, 20000);
});
