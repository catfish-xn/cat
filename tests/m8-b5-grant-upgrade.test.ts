import { describe, expect, it } from 'vitest';
import { planPermanentItemGrant } from '../src/simulation/item-grants';
import { readItemInventory } from '../src/simulation/item-selectors';
import { buyUnit, combineItems, equipItem, selectChoice, sellUnit, rerollShop } from '../src/simulation/match';
import { planReward } from '../src/simulation/rewards';
import { planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { accepted, freeze, readyMatch, reachRound } from './match-helpers';
import { publicInventory, publicRecursivePurchase } from './fixtures/b8-public-acquisition';

const item = (n: number, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id: `item-${n}`, definitionId, location: unitId ? { kind: 'unit', unitId, slot } : { kind: 'inventory' },
});
function forgedChain(items: readonly ItemInstance[]): MatchState {
  const state = readyMatch();
  return planTemporaryEquipment({ ...state, gold: 100, nextItemSerial: 100, nextUnitSerial: 5, items: [...state.items, ...items],
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(u => u.team === 'enemy'),
      { id: 'unit-1', definitionId: 'irelia', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } },
      { id: 'unit-2', definitionId: 'irelia', team: 'player', starLevel: 2, location: { kind: 'bench', slot: 0 } },
      { id: 'unit-3', definitionId: 'irelia', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 1 } },
      { id: 'unit-4', definitionId: 'irelia', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 2 } },
    ] }, shop: { ...state.shop, slots: [{ status: 'available', definitionId: 'irelia' }, ...state.shop.slots.slice(1)] } }).state;
}

describe('B5 IF-GRANT and atomic permanent inventory queries', () => {
  it.each(['sword', 'gloves', 'blue-buff', 'thiefs-gloves'])('plans exactly one permanent %s with no receipt/economy/RNG work', definitionId => {
    const state = freeze(readyMatch()), before = JSON.stringify(state);
    const plan = planPermanentItemGrant(state, { definitionId, receiptId: 'reward-1' }, []);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    const id = `item-${state.nextItemSerial}`;
    expect(plan.grantedItemIds).toEqual([id]);
    expect(plan.state).toEqual({ ...state, nextItemSerial: state.nextItemSerial + 1,
      items: [...state.items, { id, definitionId, location: { kind: 'inventory' } }] });
    expect(JSON.stringify(state)).toBe(before);
    // IF-GRANT deliberately has no caller-owned acquisition/receipt transaction.
    expect(plan.state.resourceProvenance).toBe(state.resourceProvenance);
    expect(plan.state.scheduleReceipts).toBe(state.scheduleReceipts);
    expect(() => restoreMatch(serializeMatch(plan.state))).toThrow('Invalid B8 Match: current resource fold');
    // The same definition is restorable only after a real choice (and recipe for a completed item).
    const legal = publicInventory([definitionId]);
    expect(legal.state.items.find(item => item.id === legal.itemIds[0])?.definitionId).toBe(definitionId);
    expect(restoreMatch(serializeMatch(legal.state))).toEqual(legal.state);
    // Caller commits its receipt with the inventory plan, then supplies that ledger on retry.
    const duplicate = planPermanentItemGrant(plan.state, { definitionId, receiptId: 'reward-1' }, ['reward-1']);
    expect(duplicate).toEqual({ ok: false, state: plan.state, reason: 'duplicate-grant' });
    expect(duplicate.state).toBe(plan.state);
  });
  it('rejects bad definitions, grant identities and serials without any partial state', () => {
    const state = freeze(readyMatch());
    for (const definitionId of ['absent', '__proto__', 'constructor', JSON.stringify(['item-20', '2-1', 1])]) {
      const result = planPermanentItemGrant(state, { definitionId, receiptId: 'new' }, []);
      expect(result).toEqual({ ok: false, state, reason: 'unknown-item-definition' }); expect(result.state).toBe(state);
    }
    expect(planPermanentItemGrant(state, { definitionId: 'sword', receiptId: '' }, [])).toEqual({ ok: false, state, reason: 'invalid-grant' });
    for (const serial of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, state.items[0] && Number(state.items[0].id.slice(5))]) {
      const input = freeze({ ...state, nextItemSerial: serial });
      const result = planPermanentItemGrant(input, { definitionId: 'sword', receiptId: 'new' }, []);
      expect(result).toEqual({ ok: false, state: input, reason: 'invalid-item-serial' }); expect(result.state).toBe(input);
    }
  });
  it('real choice commits exactly one item and one caller-owned receipt; restore/retry cannot regrant', () => {
    const state = freeze(reachRound('2-4',false)), choice = state.pendingChoice!;
    const next = accepted(selectChoice(state, choice.choiceId, choice.generation, 'gloves'));
    expect(next.items).toHaveLength(state.items.length + 1);
    expect(next.nextItemSerial).toBe(state.nextItemSerial + 1);
    expect(next.scheduleReceipts).toHaveLength(state.scheduleReceipts.length + 1);
    expect(next.scheduleReceipts.at(-1)?.itemIds).toEqual([`item-${state.nextItemSerial}`]);
    const restored = restoreMatch(serializeMatch(next));
    const duplicate = selectChoice(restored, choice.choiceId, choice.generation, 'gloves');
    expect(duplicate.ok).toBe(false); expect(duplicate.state).toBe(restored);
    const invalid = selectChoice(state, choice.choiceId, choice.generation, 'not-a-definition');
    expect(invalid.ok).toBe(false); expect(invalid.state).toBe(state);
  });
  it('legacy multi-component reward uses one caller receipt and rejects a bad batch atomically', () => {
    const state = freeze(readyMatch()), before = JSON.stringify(state);
    const event = { id: 'fixture-grant', priority: 0, kind: 'reward' as const, components: ['sword', 'rod'], randomComponents: 0, gold: 0, recruitIfEmpty: false };
    const planned = planReward(state, event);
    expect(planned.nextItemSerial).toBe(state.nextItemSerial + 2);
    expect(planned.receipt.itemIds).toEqual([`item-${state.nextItemSerial}`, `item-${state.nextItemSerial + 1}`]);
    const { receipt, ...resources } = planned;
    const committed = freeze({ ...state, ...resources, scheduleReceipts: [...state.scheduleReceipts, receipt] });
    expect(planReward(committed, event).items).toBe(committed.items);
    expect(() => planReward(state, { ...event, components: ['sword', 'missing'], randomComponents: 1 })).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
  it('inventory view contains only real inventory IDs, is detached and remains correct after combine/equip/sale', () => {
    const inventory = publicInventory(['gloves', 'gloves', 'sword']);
    let state = inventory.state;
    const [first, second] = inventory.itemIds, parent = `item-${state.nextItemSerial}`;
    state = accepted(combineItems(state, first, second));
    state = accepted(equipItem(state, parent, 'unit-1', 0));
    const before = JSON.stringify(state), view = readItemInventory(freeze(state));
    expect(view.some(i => i.itemInstanceId === parent || state.temporaryEquipment.some(c => c.temporaryId === i.itemInstanceId))).toBe(false);
    Object.assign(view[0], { definitionId: 'tampered' });
    expect(JSON.stringify(state)).toBe(before);
    state = accepted(sellUnit(state, 'unit-1'));
    expect(readItemInventory(state)).toContainEqual({ itemInstanceId: parent, definitionId: 'thiefs-gloves' });
    expect(readItemInventory(restoreMatch(serializeMatch(state)))).toEqual(readItemInventory(state));
    const old = readyMatch();
    const injected = { ...old, nextItemSerial: 30, items: [...old.items, item(20, 'gloves'), item(21, 'gloves'), item(22, 'sword')] };
    expect(() => restoreMatch(serializeMatch(injected))).toThrow('Invalid B8 Match: current resource fold');
    const oldCombined = accepted(combineItems(injected, 'item-20', 'item-21'));
    const oldEquipped = accepted(equipItem(oldCombined, 'item-30', 'unit-1', 0));
    const oldSold = accepted(sellUnit(oldEquipped, 'unit-1'));
    expect(() => restoreMatch(serializeMatch(oldSold))).toThrow('Invalid resource provenance: combination recipe/ownership');
  });
});

describe('B5 real purchase recursive upgrades and equipment returns', () => {
  it('chains to three stars, retaining one TG and returning conflicting parent without splitting or rerolling', () => {
    const inventory = publicInventory(['thiefs-gloves', 'thiefs-gloves']);
    const chain = publicRecursivePurchase(inventory.state), [retained, returned] = inventory.itemIds;
    // Upgrade transfers consumed holders in code-point ID order. Public purchases
    // cross unit-9, so unit-10 precedes unit-7; derive that order from their IDs.
    const [retainedHolder, returnedHolder] = [chain.secondId, chain.incomingId].sort();
    let equipped = accepted(equipItem(chain.state, retained, retainedHolder, 0));
    equipped = accepted(equipItem(equipped, returned, returnedHolder, 0));
    const state = freeze(equipped), before = JSON.stringify(state), nextId = `unit-${state.nextUnitSerial}`;
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const result = buyUnit(state, chain.slot, state.shop.generation), next = accepted(result);
    expect(next.preparation.units.filter(u => u.team === 'player').map(u => [u.id, u.starLevel])).toEqual([[chain.survivorId, 3]]);
    expect(next.items.find(i => i.id === retained)).toEqual({ id: retained, definitionId: 'thiefs-gloves', location: { kind: 'unit', unitId: chain.survivorId, slot: 0 } });
    expect(next.items.find(i => i.id === returned)).toEqual({ id: returned, definitionId: 'thiefs-gloves', location: { kind: 'inventory' } });
    expect(next.equipmentState).toEqual(state.equipmentState);
    expect(next.temporaryEquipment.map(c => [c.parentItemInstanceId, c.holderId])).toEqual([[retained, chain.survivorId], [retained, chain.survivorId]]);
    expect(next.nextItemSerial).toBe(state.nextItemSerial);
    expect(next.items.map(i => i.id).sort()).toEqual(state.items.map(i => i.id).sort());
    expect(next.gold).toBe(state.gold - 1); expect(next.nextUnitSerial).toBe(state.nextUnitSerial + 1);
    expect(JSON.stringify(state)).toBe(before);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter(e => e.type === 'unitUpgraded').map(({ domain: _domain, eventSeq: _seq, ...event }) => event)).toEqual([
      { type: 'unitUpgraded', survivorId: chain.incomingId, consumedIds: [chain.purchaseIds[7], nextId].sort(), definitionId: 'irelia', fromStar: 1, toStar: 2, location: state.preparation.units.find(u => u.id === chain.incomingId)!.location },
      { type: 'unitUpgraded', survivorId: chain.survivorId, consumedIds: [chain.secondId, chain.incomingId].sort(), definitionId: 'irelia', fromStar: 2, toStar: 3, location: state.preparation.units.find(u => u.id === chain.survivorId)!.location },
    ]);
    expect(result.events.some(e => e.type === 'equipmentRolled')).toBe(false);
    expect(result.events.filter(e => e.type === 'itemsReturned')).toEqual([expect.objectContaining({ unitId: returnedHolder, itemIds: [returned] })]);
    expect(next.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired' && entry.source.kind === 'shop')).toHaveLength(9);
    const restored = restoreMatch(serializeMatch(next));
    expect(restored).toEqual(next);
    const repeat = buyUnit(restored, chain.slot, restored.shop.generation);
    expect(repeat).toEqual({ ok: false, state: restored, reason: 'purchased-slot' }); expect(repeat.state).toBe(restored);
    const forged = forgedChain([item(20, 'thiefs-gloves', 'unit-2'), item(21, 'thiefs-gloves', 'unit-3')]);
    expect(() => restoreMatch(serializeMatch(forged))).toThrow('Invalid B8 Match: current resource fold');
    const forgedNext = accepted(buyUnit(forged, 0, forged.shop.generation));
    expect(() => restoreMatch(serializeMatch(forgedNext))).toThrow('Invalid resource provenance: unit serial');
  });
  it.each([
    ['unique', ['blue-buff', 'blue-buff'], [0, 1], [0, 0], [1]],
    ['exclusive survivor', ['thiefs-gloves', 'sword'], [0, 1], [0, 0], [1]],
    ['exclusive incoming', ['sword', 'thiefs-gloves'], [0, 1], [0, 0], [1]],
    ['full ordinary', ['sword', 'rod', 'vest', 'cloak'], [0, 0, 0, 1], [0, 1, 2, 0], [3]],
  ] as const)('returns %s conflicts and preserves permanent IDs across the complete command', (_label, definitions, holders, slots, returned) => {
    const inventory = publicInventory(definitions, true), chain = publicRecursivePurchase(inventory.state);
    let equipped = chain.state;
    for (const [index, id] of inventory.itemIds.entries()) equipped = accepted(equipItem(equipped, id, [chain.survivorId, chain.secondId][holders[index]], slots[index]));
    const state = freeze(equipped), result = buyUnit(state, chain.slot, state.shop.generation), next = accepted(result);
    for (const n of returned) expect(next.items.find(i => i.id === inventory.itemIds[n])?.location.kind).toBe('inventory');
    expect(next.items.map(i => i.id).sort()).toEqual(state.items.map(i => i.id).sort());
    expect(next.equipmentState).toEqual(state.equipmentState);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter(event => event.type === 'unitUpgraded')).toHaveLength(2);
    expect(result.events.filter(event => event.type === 'itemsReturned').map(({ domain: _domain, eventSeq: _seq, ...event }) => event)).toEqual([{ type: 'itemsReturned', unitId: chain.secondId, itemIds: returned.map(index => inventory.itemIds[index]).sort() }]);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
    const old = definitions.map((definition, index) => item(20 + index, definition, ['unit-1', 'unit-2'][holders[index]], slots[index]));
    const forged = forgedChain(old);
    expect(() => restoreMatch(serializeMatch(forged))).toThrow('Invalid B8 Match: current resource fold');
    const forgedNext = accepted(buyUnit(forged, 0, forged.shop.generation));
    expect(() => restoreMatch(serializeMatch(forgedNext))).toThrow('Invalid resource provenance: unit serial');
  });
  it('failed purchase preserves roll ledger, children, resources and event serials', () => {
    const inventory = publicInventory(['thiefs-gloves'], true), chain = publicRecursivePurchase(inventory.state);
    let input = accepted(equipItem(chain.state, inventory.itemIds[0], chain.secondId, 0));
    while (input.gold >= 2) input = accepted(rerollShop(input));
    // A real unaffordable offer suffices; no gold, RNG, offer or receipt is injected.
    const slot = input.shop.slots.findIndex(offer => offer.status === 'available' && !['darius', 'irelia', 'lux', 'maddie', 'zyra'].includes(offer.definitionId));
    if (slot < 0 && input.gold !== 0) throw new Error('Expected an unaffordable public offer');
    const state = freeze(input), before = JSON.stringify(state), result = buyUnit(state, slot < 0 ? 0 : slot, state.shop.generation);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    expect(result).toEqual({ ok: false, state, reason: 'insufficient-gold' }); expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
