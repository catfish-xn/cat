import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import type { LootView } from '../src/simulation/m8/ui-contracts';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { run } from '../scripts/generate-m5-route.cjs';

const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
const bench = (state: MatchState) => players(state).filter(unit => unit.location.kind === 'bench');
const plan = (state: MatchState) => state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === state.roundDefinitionId)!;
function accepted(result: api.MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public loot-view fixture: ${result.reason}`);
  return result.state;
}
function reserveExcept(initial: MatchState, keep: readonly string[]): MatchState {
  let state = initial;
  for (const unit of players(state).filter(unit => unit.location.kind === 'board' && !keep.includes(unit.id))) {
    const used = new Set(bench(state).flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: 9 }, (_, index) => index).find(index => !used.has(index))!;
    state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}
const emptyRounds = new Set(['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-7', '4-1', '4-2']);
/** Same seed-230 public command route as m8-b8-live-capacity: only ordinary commands, no edited state. */
async function publicPrefix(roundId: string, accumulateLosses = false): Promise<MatchState> {
  const captured = new Error('Captured public preparation');
  let prefix: MatchState | undefined;
  const driver = { ...api, startMatchCombat(state: MatchState) {
    if (state.roundDefinitionId === roundId) { prefix = state; throw captured; }
    return api.startMatchCombat(accumulateLosses && emptyRounds.has(state.roundDefinitionId) ? reserveExcept(state, []) : state);
  } };
  try { await run(driver, { build: 'cannon', seed: 230 }); }
  catch (error) { if (error !== captured) throw error; }
  return prefix!;
}
const capacityPrefix = await publicPrefix('2-7');
const terminalPrefix = await publicPrefix('4-7', true);

/** Read twice, through a strict restore, and confirm the read itself changes nothing. */
function view(state: MatchState): LootView {
  const saved = serializeMatch(state), result = api.readLootView(state);
  expect(serializeMatch(state)).toBe(saved);
  expect(api.readLootView(state)).toEqual(result);
  expect(api.readLootView(restoreMatch(saved))).toEqual(result);
  expect(Object.isFrozen(result) && Object.isFrozen(result.revealedDrops)).toBe(true);
  // Contract fields only: no slot ordinals, reveal conditions, choice descriptors, RNG or future rounds.
  expect(Object.keys(result).sort()).toEqual(['canContinue', 'pendingClaims', 'reason', 'revealedDrops', 'roundId']);
  for (const drop of result.revealedDrops) expect(Object.keys(drop).filter(key => !['dropId', 'encounterId', 'sourceUnitId', 'roundId',
    'payload', 'status', 'receiptId', 'allowedActions', 'reason'].includes(key))).toEqual([]);
  return result;
}
/** Agreement with the authoritative command, so the hint never contradicts Continue. */
function agreesWithContinue(state: MatchState, result: LootView): void {
  const command = api.nextRound(state, state.round);
  expect(command.ok).toBe(result.canContinue);
  if (!command.ok) expect(command.state).toBe(state);
}
/** Hidden-information negative control: rewriting what is not yet earned cannot change the view. */
function hiddenIndependent(state: MatchState, mutate: (raw: any) => void): void {
  const raw = JSON.parse(serializeMatch(state));
  mutate(raw);
  expect(api.readLootView(raw)).toEqual(api.readLootView(state));
}
function finish(initial: MatchState) {
  let state = initial, revealed: MatchState | undefined;
  while (state.phase === 'combat') {
    const result = api.stepMatch(state); state = result.state;
    if (!revealed && result.events.some(event => event.type === 'lootRevealed')) revealed = state;
  }
  return { state, revealed: revealed! };
}
function capacityPreparation(): MatchState {
  let state = capacityPrefix;
  for (const [generation, slots] of [[9, [1, 3]], [10, [1, 4]], [11, [3]], [12, [1, 3, 4]], [13, [1]]] as const) {
    if (state.shop.generation < generation) state = accepted(api.rerollShop(state));
    for (const slot of slots) state = accepted(api.buyUnit(state, slot, generation));
  }
  expect(bench(state)).toHaveLength(9);
  return state;
}

describe('B8 readLootView over real public routes', () => {
  const preparation = capacityPreparation(), frozen = plan(preparation);
  const [first, hero] = frozen.encounterPlan.drops.slice(-2), choice = frozen.choices[0];
  const battle = finish(accepted(api.startMatchCombat(preparation)));

  it('exposes nothing before any source dies, and hidden plans cannot leak through the view', () => {
    const before = view(preparation);
    expect(before).toEqual({ roundId: '2-7', revealedDrops: [], pendingClaims: [], canContinue: false, reason: 'unsettled-round' });
    agreesWithContinue(preparation, before);
    expect(frozen.encounterPlan.drops.every(drop => drop.status === 'planned')).toBe(true);
    hiddenIndependent(preparation, raw => {
      const round = raw.m8.loot.frozen.rounds.find((value: any) => value.encounterPlan.roundId === '2-7');
      for (const drop of round.encounterPlan.drops) drop.payload = { kind: 'gold', quantity: 99 };
      for (const value of round.choices) value.terminalFallbackDefinitionId = 'sword';
    });
    const started = accepted(api.startMatchCombat(preparation));
    expect(view(started)).toEqual({ ...before, reason: 'unsettled-round' });
  });

  it('shows revealed drops mid-combat as domain auto-grants, without unearned or later drops', () => {
    const state = battle.revealed, result = view(state);
    expect(state.phase).toBe('combat');
    const revealed = state.m8.loot.direct.filter(drop => drop.status === 'revealed').map(drop => drop.dropId);
    expect(revealed.length).toBeGreaterThan(0);
    expect(result.revealedDrops.map(drop => drop.dropId)).toEqual(revealed);
    for (const drop of result.revealedDrops) {
      const source = frozen.encounterPlan.drops.find(value => value.dropId === drop.dropId)!;
      expect(drop).toEqual({ dropId: source.dropId, encounterId: source.encounterId, sourceUnitId: source.sourceUnitId, roundId: '2-7',
        payload: source.payload, status: 'revealed', receiptId: null, allowedActions: [], reason: 'auto-grant-in-domain' });
    }
    expect(result).toMatchObject({ pendingClaims: [], canContinue: false, reason: 'unsettled-round' });
    expect(JSON.stringify(result)).not.toContain(choice.dropId);
    // UR-U6-04: the source is the same unit identity the public encounter preview lists.
    const preview = api.readEncounterPreview(state)!;
    for (const drop of result.revealedDrops) expect(preview.units.filter(unit => unit.unitId === drop.sourceUnitId)).toHaveLength(1);
  });

  it('after combat: granted receipts, a full-bench hero pending, and the unresolved choice withheld', () => {
    const state = battle.state, result = view(state);
    expect(state.phase).toBe('choice');
    const receipt = state.m8.loot.receipts.find(value => value.dropId === first.dropId)!;
    expect(result.revealedDrops.find(drop => drop.dropId === first.dropId)).toEqual({ dropId: first.dropId, encounterId: first.encounterId,
      sourceUnitId: first.sourceUnitId, roundId: '2-7', payload: first.payload, status: 'granted', receiptId: receipt.receiptId, allowedActions: [] });
    expect(result.revealedDrops.find(drop => drop.dropId === hero.dropId)).toMatchObject({ status: 'pending-capacity', receiptId: null, reason: 'bench-full',
      payload: { kind: 'unit', definitionId: 'maddie', quantity: 1 } });
    expect(result.revealedDrops.some(drop => drop.dropId === choice.dropId)).toBe(false);
    expect(result).toMatchObject({ pendingClaims: [hero.dropId], canContinue: false, reason: 'unsettled-round' });
    agreesWithContinue(state, result);
    hiddenIndependent(state, raw => {
      raw.m8.loot.frozen.rounds.find((value: any) => value.encounterPlan.roundId === '2-7').choices[0].terminalFallbackDefinitionId = 'sword';
    });
  });

  it('a real selection adds its own receipt; capacity then blocks Continue until a real sale grants the hero', () => {
    const pending = battle.state.pendingChoice!;
    const waiting = accepted(api.selectChoice(battle.state, pending.choiceId, pending.generation, 'sword')), result = view(waiting);
    const receipt = waiting.m8.loot.receipts.find(value => value.dropId === choice.dropId)!;
    expect(result.revealedDrops.find(drop => drop.dropId === choice.dropId)).toEqual({ dropId: choice.dropId, encounterId: choice.encounterId,
      sourceUnitId: choice.sourceUnitId, roundId: '2-7', payload: { kind: 'item', definitionId: 'sword', quantity: 1 },
      status: 'granted', receiptId: receipt.receiptId, allowedActions: [] });
    expect(result).toMatchObject({ pendingClaims: [hero.dropId], canContinue: false, reason: 'pending-capacity' });
    agreesWithContinue(waiting, result);
    const sold = accepted(api.sellUnit(waiting, bench(waiting).find(unit => unit.definitionId === 'zoe')!.id)), after = view(sold);
    const heroReceipt = sold.m8.loot.receipts.find(value => value.dropId === hero.dropId)!;
    expect(after.revealedDrops.find(drop => drop.dropId === hero.dropId)).toMatchObject({ status: 'granted', receiptId: heroReceipt.receiptId });
    expect(after.revealedDrops.filter(drop => drop.status === 'granted').map(drop => drop.receiptId).sort())
      .toEqual(sold.m8.loot.receipts.filter(value => value.dropId.startsWith('["2-7"')).map(value => value.receiptId).sort());
    expect(after).toMatchObject({ pendingClaims: [], canContinue: true, reason: null });
    agreesWithContinue(sold, after);
    const next = accepted(api.nextRound(sold, sold.round));
    expect(view(next)).toEqual({ roundId: next.roundDefinitionId, revealedDrops: [], pendingClaims: [], canContinue: false, reason: 'unsettled-round' });
  });

  it.each([
    { name: 'both sources', keep: ['unit-11', 'unit-6'], fallback: true },
    { name: 'only direct source', keep: ['unit-16'], fallback: false },
    { name: 'only choice source', keep: ['unit-14'], fallback: true },
  ])('terminal $name: retained hero is read-only, earned fallback only via its receipt, nothing forfeited shown', scenario => {
    let start = reserveExcept(terminalPrefix, scenario.keep);
    for (const slot of scenario.keep.length === 2 ? [2, 3] : [2]) start = accepted(api.buyUnit(start, slot, 43));
    const state = finish(accepted(api.startMatchCombat(start))).state, result = view(state), round = plan(state);
    expect(state.phase).toBe('gameOver');
    const statuses = Object.fromEntries(state.m8.loot.direct.filter(drop => round.encounterPlan.drops.some(d => d.dropId === drop.dropId))
      .map(drop => [drop.dropId, drop.status]));
    for (const drop of round.encounterPlan.drops) {
      const shown = result.revealedDrops.find(value => value.dropId === drop.dropId);
      if (statuses[drop.dropId] === 'forfeited') expect(shown).toBeUndefined();
      else if (statuses[drop.dropId] === 'retained-terminal') expect(shown).toMatchObject({ status: 'retained-terminal', receiptId: null, reason: 'terminal-bench-full', allowedActions: [] });
      else expect(shown).toMatchObject({ status: 'granted' });
    }
    const fallback = state.m8.loot.receipts.find(value => value.dropId === round.choices[0].dropId);
    expect(Boolean(fallback)).toBe(scenario.fallback);
    expect(result.revealedDrops.find(drop => drop.dropId === round.choices[0].dropId)?.receiptId ?? null).toBe(fallback?.receiptId ?? null);
    expect(result).toMatchObject({ pendingClaims: [], canContinue: false, reason: 'game-over' });
    agreesWithContinue(state, result);
    if (!scenario.fallback) hiddenIndependent(state, raw => {
      raw.m8.loot.frozen.rounds.find((value: any) => value.encounterPlan.roundId === '4-7').choices[0].terminalFallbackDefinitionId = 'sword';
    });
  });
});
