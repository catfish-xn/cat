import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchEvent, MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

function accepted(result: api.MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Cross-round loot fixture: ${result.reason}`);
  return result.state;
}
function roundTrip(state: MatchState): MatchState {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state);
  expect(api.readLootView(restored)).toEqual(api.readLootView(state));
  return restored;
}
/** Run to the end of combat; restore at the first tick and require identical remaining state/events. */
function fight(preparation: MatchState): { state: MatchState; events: MatchEvent[] } {
  const started = accepted(api.startMatchCombat(preparation));
  const finish = (initial: MatchState) => {
    let state = initial; const events: MatchEvent[] = [];
    while (state.phase === 'combat') { const next = api.stepMatch(state); state = next.state; events.push(...next.events); }
    return { state, events };
  };
  const first = api.stepMatch(started).state, uninterrupted = finish(first);
  expect(finish(roundTrip(first))).toEqual(uninterrupted);
  return uninterrupted;
}
function reject(state: MatchState, message: string, change: (raw: any) => void): void {
  const saved = serializeMatch(state), raw = JSON.parse(saved);
  change(raw);
  expect(() => restoreMatch(raw), change.toString()).toThrowError(message);
  expect(serializeMatch(state)).toBe(saved);
}
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
const lootItem = (state: MatchState, definitionId: string) => state.m8.loot.receipts.find(r => r.payload.kind === 'item' && r.payload.definitionId === definitionId)!;

/* Real seed-42 opening, Irelia fielded, no other operations: 1-2 Maddie, 1-3 Lux and a
 * component pick (bow), 1-4 a component pick (rod). Independent expectation from the
 * frozen B8 gate "真实新局经1-2～1-4到2-1：无运营全清10G／3级0XP／三指定英雄／两组件". */
const openingState = createOpening();
function createOpening(): MatchState {
  let current = api.createMatch(42);
  const picks = ['bow', 'rod'];
  while (current.roundDefinitionId !== '2-1' || current.phase !== 'preparation') {
    if (current.phase === 'preparation') current = fight(current).state;
    else if (current.phase === 'choice') {
      const choice = current.pendingChoice!;
      const pick = choice.kind === 'component' ? picks.shift()! : choice.offers.find(id => id !== 'placebo')!;
      current = accepted(api.selectChoice(current, choice.choiceId, choice.generation, pick));
    } else if (current.phase === 'settlement') current = accepted(api.nextRound(current, current.round));
    else throw new Error(`Opening ended at ${current.phase}`);
  }
  expect(picks).toEqual([]);
  return current;
}

describe('B8 loot carried across rounds: combine, equip, fight and sell', () => {
  const opening = openingState;
  it('arrives at 2-1 with the frozen opening rewards and only current-round loot in the view', () => {
    expect([opening.gold, opening.level, opening.xp]).toEqual([10, 3, 0]);
    expect(players(opening).map(unit => unit.definitionId).sort()).toEqual(['irelia', 'lux', 'maddie']);
    expect(opening.items.map(item => [item.definitionId, item.location.kind]).sort()).toEqual([['bow', 'inventory'], ['rod', 'inventory']]);
    expect(opening.m8.loot.receipts.map(receipt => [JSON.parse(receipt.dropId)[0], receipt.payload.kind, 'definitionId' in receipt.payload ? receipt.payload.definitionId : null]))
      .toEqual([['1-2', 'unit', 'maddie'], ['1-3', 'unit', 'lux'], ['1-3', 'item', 'bow'], ['1-4', 'item', 'rod']]);
    expect(api.readLootView(opening)).toEqual({ roundId: '2-1', revealedDrops: [], pendingClaims: [], canContinue: false, reason: 'unsettled-round' });
    roundTrip(opening);
  });

  // 2-1: combine the two loot components from different rounds, equip the loot-born Lux, fight.
  const bow = lootItem(opening, 'bow'), rod = lootItem(opening, 'rod');
  const combined = accepted(api.combineItems(opening, bow.grantedItemIds[0], rod.grantedItemIds[0]));
  const rageblade = combined.items.find(item => item.definitionId === 'rageblade')!;
  const lux = players(opening).find(unit => unit.definitionId === 'lux')!;
  const equipped = accepted(api.equipItem(combined, rageblade.id, lux.id, 0));
  const fielded = accepted(api.deployMatchUnit(equipped, lux.id, { kind: 'board', cell: { col: 3, row: 7 } }));
  const battle = fight(fielded);
  const nextPreparation = accepted(api.nextRound(battle.state, battle.state.round));
  const sold = api.sellUnit(nextPreparation, lux.id);

  it('consumes both loot components into one item without touching their receipts', () => {
    expect(combined.items.filter(item => item.id === bow.grantedItemIds[0] || item.id === rod.grantedItemIds[0])).toEqual([]);
    expect(combined.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    const facts = combined.resourceProvenance.entries.slice(opening.resourceProvenance.entries.length);
    expect(facts.map(fact => fact.kind)).toEqual(['item-combined']);
    for (const step of [combined, equipped, fielded]) roundTrip(step);
  });
  it('fights 2-1 with the cross-round Rageblade and keeps loot identity through settlement and Continue', () => {
    expect(battle.events.some(event => event.type === 'statChanged' && event.source.definitionId === 'rageblade' && event.unitId === lux.id)).toBe(true);
    expect(battle.state.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    roundTrip(battle.state);
    expect(nextPreparation.roundDefinitionId).toBe('2-2');
    expect(api.readLootView(nextPreparation).revealedDrops).toEqual([]);
    roundTrip(nextPreparation);
  });
  it('selling the loot-born carrier returns the combined item and remains a legal history', () => {
    if (!sold.ok) throw new Error(sold.reason);
    expect(sold.events.map(event => event.type)).toContain('itemsReturned');
    expect(sold.state.items.find(item => item.id === rageblade.id)?.location).toEqual({ kind: 'inventory' });
    expect(players(sold.state).some(unit => unit.id === lux.id)).toBe(false);
    expect(sold.state.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    const restored = roundTrip(sold.state);
    expect(api.nextRound(restored, restored.round)).toEqual(api.nextRound(sold.state, sold.state.round));
  });
  it('rejects tampering with the cross-round consumption chain', () => {
    if (!sold.ok) throw new Error(sold.reason);
    const after = sold.state;
    // Deleting the combine fact also moves the recorded 2-1 combat-start prefix, which is checked first.
    reject(after, 'Invalid resource provenance: combat start prefix', raw => {
      const index = raw.resourceProvenance.entries.findIndex((entry: any) => entry.kind === 'item-combined');
      raw.resourceProvenance.entries.splice(index, 1);
      raw.resourceProvenance.entries.forEach((entry: any, sequence: number) => { entry.sequence = sequence; });
    });
    reject(after, 'Invalid resource provenance: receipt birth binding', raw => { raw.m8.loot.receipts.find((r: any) => r.payload.definitionId === 'bow').grantedItemIds = [rageblade.id]; });
    reject(after, 'Invalid resource provenance: duplicate loot receipt', raw => { raw.m8.loot.receipts.push({ ...raw.m8.loot.receipts.at(-1) }); });
    // A consumed loot component cannot reappear in inventory.
    reject(after, 'Invalid B8 Match: current resource fold', raw => { raw.items.push({ id: bow.grantedItemIds[0], definitionId: 'bow', location: { kind: 'inventory' } }); });
  });
});
