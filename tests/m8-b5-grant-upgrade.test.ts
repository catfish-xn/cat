import { describe, expect, it } from 'vitest';
import { planPermanentItemGrant } from '../src/simulation/item-grants';
import { readItemInventory } from '../src/simulation/item-selectors';
import { buyUnit, combineItems, createMatch, equipItem, selectChoice, sellUnit } from '../src/simulation/match';
import { planReward } from '../src/simulation/rewards';
import { planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { accepted, freeze, readyMatch } from './match-helpers';

const item = (n: number, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id: `item-${n}`, definitionId, location: unitId ? { kind: 'unit', unitId, slot } : { kind: 'inventory' },
});
function chain(items: readonly ItemInstance[]): MatchState {
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
    expect(restoreMatch(serializeMatch(plan.state))).toEqual(plan.state);
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
    const state = freeze(createMatch(42)), choice = state.pendingChoice!;
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
    let state = readyMatch();
    state = { ...state, nextItemSerial: 30, items: [...state.items, item(20, 'gloves'), item(21, 'gloves')] };
    state = accepted(combineItems(state, 'item-20', 'item-21'));
    state = accepted(equipItem(state, 'item-30', 'unit-1', 0));
    const before = JSON.stringify(state), view = readItemInventory(freeze(state));
    expect(view.some(i => i.itemInstanceId === 'item-30' || state.temporaryEquipment.some(c => c.temporaryId === i.itemInstanceId))).toBe(false);
    Object.assign(view[0], { definitionId: 'tampered' });
    expect(JSON.stringify(state)).toBe(before);
    state = accepted(sellUnit(state, 'unit-1'));
    expect(readItemInventory(state)).toContainEqual({ itemInstanceId: 'item-30', definitionId: 'thiefs-gloves' });
    expect(readItemInventory(restoreMatch(serializeMatch(state)))).toEqual(readItemInventory(state));
  });
});

describe('B5 real purchase recursive upgrades and equipment returns', () => {
  it('chains to three stars, retaining one TG and returning conflicting parent without splitting or rerolling', () => {
    const state = freeze(chain([item(20, 'thiefs-gloves', 'unit-2'), item(21, 'thiefs-gloves', 'unit-3')]));
    const before = JSON.stringify(state), result = buyUnit(state, 0, state.shop.generation), next = accepted(result);
    expect(next.preparation.units.filter(u => u.team === 'player').map(u => [u.id, u.starLevel])).toEqual([['unit-1', 3]]);
    expect(next.items.find(i => i.id === 'item-20')).toEqual(item(20, 'thiefs-gloves', 'unit-1'));
    expect(next.items.find(i => i.id === 'item-21')).toEqual(item(21, 'thiefs-gloves'));
    expect(next.equipmentState).toEqual(state.equipmentState);
    expect(next.temporaryEquipment.map(c => [c.parentItemInstanceId, c.holderId])).toEqual([['item-20', 'unit-1'], ['item-20', 'unit-1']]);
    expect(next.nextItemSerial).toBe(state.nextItemSerial);
    expect(next.items.map(i => i.id).sort()).toEqual(state.items.map(i => i.id).sort());
    expect(next.gold).toBe(state.gold - 1); expect(next.nextUnitSerial).toBe(6);
    expect(JSON.stringify(state)).toBe(before);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter(e => e.type === 'unitUpgraded')).toHaveLength(2);
    expect(result.events.some(e => e.type === 'equipmentRolled')).toBe(false);
    expect(result.events.filter(e => e.type === 'itemsReturned')).toEqual([expect.objectContaining({ unitId: 'unit-3', itemIds: ['item-21'] })]);
    const restored = restoreMatch(serializeMatch(next));
    expect(restored).toEqual(next);
    const repeat = buyUnit(restored, 0, restored.shop.generation);
    expect(repeat.ok).toBe(false); expect(repeat.state).toBe(restored);
  });
  it.each([
    ['unique', [item(20, 'blue-buff', 'unit-1'), item(21, 'blue-buff', 'unit-2')], [21]],
    ['exclusive survivor', [item(20, 'thiefs-gloves', 'unit-1'), item(21, 'sword', 'unit-2')], [21]],
    ['exclusive incoming', [item(20, 'sword', 'unit-1'), item(21, 'thiefs-gloves', 'unit-2')], [21]],
    ['full ordinary', [item(20, 'sword', 'unit-1'), item(21, 'rod', 'unit-1', 1), item(22, 'vest', 'unit-1', 2), item(23, 'cloak', 'unit-2')], [23]],
  ] as const)('returns %s conflicts and preserves permanent IDs across the complete command', (_label, items, returned) => {
    const state = freeze(chain(items)), next = accepted(buyUnit(state, 0, state.shop.generation));
    for (const n of returned) expect(next.items.find(i => i.id === `item-${n}`)?.location.kind).toBe('inventory');
    expect(next.items.map(i => i.id).sort()).toEqual(state.items.map(i => i.id).sort());
    expect(next.equipmentState).toEqual(state.equipmentState);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
  });
  it('failed purchase preserves roll ledger, children, resources and event serials', () => {
    const state = freeze({ ...chain([item(20, 'thiefs-gloves', 'unit-2')]), gold: 0 });
    const before = JSON.stringify(state), result = buyUnit(state, 0, state.shop.generation);
    expect(result).toEqual({ ok: false, state, reason: 'insufficient-gold' }); expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
