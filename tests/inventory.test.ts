import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import type { GameState } from '../src/simulation/game';
import { planCombine, planEquip, returnUnitItems } from '../src/simulation/inventory';
import type { ItemInstance } from '../src/simulation/strategy-types';
import type { Unit } from '../src/simulation/units';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const item = (id: string, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id, definitionId, location: unitId === undefined ? { kind: 'inventory' } : { kind: 'unit', unitId, slot },
});
const unit = (id: string, team: Unit['team'], onBoard: boolean): Unit => ({
  id, team, definitionId: 'irelia', starLevel: 1,
  location: onBoard ? { kind: 'board', cell: { row: team === 'player' ? 4 : 1, col: 2 } } : { kind: 'bench', slot: 0 },
});
const preparation: GameState = freeze({
  board: DEFAULT_BOARD, benchSize: 9,
  units: [unit('board-unit', 'player', true), unit('bench-unit', 'player', false), unit('enemy-unit', 'enemy', true)],
});

// Independent transcription of signed B1 / M8_PLAN appendix A; production recipes are only the actual under test.
const recipes = [
 ['sword','sword','deathblade'],['sword','bow','giant-slayer'],['sword','rod','gunblade'],['sword','tear','shojin'],['sword','vest','edge-of-night'],['sword','cloak','bloodthirster'],['sword','belt','steraks-gage'],['sword','gloves','infinity-edge'],
 ['bow','bow','red-buff'],['bow','rod','rageblade'],['bow','tear','statikk-shiv'],['bow','vest','titans-resolve'],['bow','cloak','runaans-hurricane'],['bow','belt','nashors-tooth'],['bow','gloves','last-whisper'],
 ['rod','rod','deathcap'],['rod','tear','archangel'],['rod','vest','crownguard'],['rod','cloak','ionic-spark'],['rod','belt','morellonomicon'],['rod','gloves','jeweled-gauntlet'],
 ['tear','tear','blue-buff'],['tear','vest','protectors-vow'],['tear','cloak','adaptive-helm'],['tear','belt','redemption'],['tear','gloves','hand-of-justice'],
 ['vest','vest','bramble-vest'],['vest','cloak','gargoyle'],['vest','belt','sunfire-cape'],['vest','gloves','steadfast-heart'],
 ['cloak','cloak','dragons-claw'],['cloak','belt','evenshroud'],['cloak','gloves','quicksilver'],['belt','belt','warmog'],['belt','gloves','guardbreaker'],['gloves','gloves','thiefs-gloves'],
] as const;

describe('atomic inventory composition', () => {
  it.each(recipes)('combines %s + %s into %s with the same result in both command orders', (a, b, completed) => {
    const items = freeze([item('item-8', a), item('item-2', b), item('item-1', 'vest', 'board-unit', 2)]);
    const before = JSON.stringify(items);
    const expected = {
      ok: true,
      items: [item('item-1', 'vest', 'board-unit', 2), item('item-9', completed)],
      nextItemSerial: 10,
      events: [{ type: 'itemCombined', consumedIds: ['item-2', 'item-8'], itemId: 'item-9', definitionId: completed }],
    };
    expect(planCombine(items, 9, 'item-8', 'item-2')).toEqual(expected);
    expect(planCombine(items, 9, 'item-2', 'item-8')).toEqual(expected);
    expect(planCombine([...items].reverse(), 9, 'item-8', 'item-2')).toEqual(expected);
    expect(JSON.stringify(items)).toBe(before);
  });

  it('accounts for every authored unordered recipe exactly once', () => {
    const authored = Object.values(ITEM_DEFINITIONS).filter(definition => definition.kind === 'completed');
    expect(authored.map(definition => definition.id).sort()).toEqual(recipes.map(([, , id]) => id).sort());
    expect(new Set(recipes.map(([a, b]) => [a, b].sort().join('+'))).size).toBe(36);
    expect(Object.values(ITEM_DEFINITIONS).filter(definition => definition.kind === 'component').map(value => value.id).sort())
      .toEqual(['belt', 'bow', 'cloak', 'gloves', 'rod', 'sword', 'tear', 'vest']);
  });

  it('every one of the 36 component pairs is now open;completed materials remain invalid and unchanged', () => {
    for (const [a,b] of recipes) {
      const items=freeze([item('item-1',a),item('item-2',b)]),before=JSON.stringify(items);
      expect(planCombine(items,3,'item-1','item-2').ok).toBe(true);
      expect(planCombine(items,3,'item-2','item-1').ok).toBe(true);
      expect(JSON.stringify(items)).toBe(before);
    }
    for (const completed of recipes.map(x=>x[2])) {
      const items=freeze([item('item-1',completed),item('item-2','gloves')]),before=JSON.stringify(items);
      expect(planCombine(items,3,'item-1','item-2')).toEqual({ok:false,reason:'invalid-recipe'});
      expect(JSON.stringify(items)).toBe(before);
    }
  });

  it('rejects same instance, unknown/stale instances, equipped components and completed materials atomically', () => {
    const items = freeze([item('item-1', 'sword'), item('item-2', 'rod'), item('item-3', 'vest', 'board-unit'), item('item-4', 'gunblade')]);
    const before = JSON.stringify(items);
    for (const [a, b, reason] of [
      ['item-1', 'item-1', 'same-item'], ['missing', 'item-2', 'unknown-item'],
      ['item-1', 'missing', 'unknown-item'], ['item-3', 'item-2', 'item-not-inventory'],
      ['item-1', 'item-3', 'item-not-inventory'], ['item-4', 'item-2', 'invalid-recipe'],
      ['item-1', 'item-4', 'invalid-recipe'],
    ]) expect(planCombine(items, 5, a, b)).toEqual({ ok: false, reason });
    expect(JSON.stringify(items)).toBe(before);
    const success = planCombine(items, 5, 'item-1', 'item-2');
    if (!success.ok) throw new Error(success.reason);
    const committed = freeze(success.items);
    expect(planCombine(committed, success.nextItemSerial, 'item-1', 'item-2')).toEqual({ ok: false, reason: 'unknown-item' });
    expect(success.nextItemSerial).toBe(6);
    expect(committed.map(value => value.id)).toEqual(['item-3', 'item-4', 'item-5']);
  });

  it('rejects corrupt content references and serials instead of manufacturing duplicate identities', () => {
    const items = freeze([item('item-1', 'sword'), item('item-2', 'rod')]);
    for (const serial of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(() => planCombine(items, serial, 'item-1', 'item-2')).toThrow('Invalid next item serial');
    }
    expect(() => planCombine(items, 1, 'item-1', 'item-2')).toThrow('Duplicate item ID');
    expect(() => planCombine([item('a', 'unknown'), item('b', 'rod')], 3, 'a', 'b')).toThrow('Unknown item definition');
  });
});

describe('equipment and sale return plans', () => {
  it.each(['board-unit', 'bench-unit'])('equips components and repeated completed items into all three slots on %s', unitId => {
    let items: readonly ItemInstance[] = freeze([item('item-1', 'sword'), item('item-2', 'deathblade'), item('item-3', 'deathblade'), item('item-4', 'vest')]);
    for (let slot = 0; slot < 3; slot++) {
      const source = items, before = JSON.stringify(source), itemId = `item-${slot + 1}`;
      const result = planEquip(freeze(source), preparation, itemId, unitId, slot);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      expect(result.items.find(value => value.id === itemId)?.location).toEqual({ kind: 'unit', unitId, slot });
      expect(result.events).toEqual([{ type: 'itemEquipped', itemId, unitId, slot }]);
      expect(JSON.stringify(source)).toBe(before);
      items = result.items;
    }
    for (const slot of [0, 1, 2]) {
      expect(planEquip(freeze(items), preparation, 'item-4', unitId, slot)).toEqual({ ok: false, reason: 'item-slot-occupied' });
    }
    expect(items.filter(value => value.location.kind === 'unit')).toHaveLength(3);
  });

  it('rejects invalid targets, slots and duplicate pointer releases without moving an item', () => {
    const items = freeze([item('item-1', 'sword'), item('item-2', 'rod', 'board-unit', 1)]);
    const before = JSON.stringify(items);
    for (const slot of [-1, 3, 0.5, Number.NaN, Infinity, '0' as unknown as number]) {
      expect(planEquip(items, preparation, 'item-1', 'board-unit', slot)).toEqual({ ok: false, reason: 'invalid-slot' });
    }
    expect(planEquip(items, preparation, 'missing', 'board-unit', 0)).toEqual({ ok: false, reason: 'unknown-item' });
    expect(planEquip(items, preparation, 'item-1', 'missing', 0)).toEqual({ ok: false, reason: 'unknown-unit' });
    expect(planEquip(items, preparation, 'item-1', 'enemy-unit', 0)).toEqual({ ok: false, reason: 'unknown-unit' });
    expect(planEquip(items, preparation, 'item-2', 'bench-unit', 0)).toEqual({ ok: false, reason: 'item-not-inventory' });
    expect(planEquip(items, preparation, 'item-1', 'board-unit', 1)).toEqual({ ok: false, reason: 'item-slot-occupied' });
    expect(JSON.stringify(items)).toBe(before);
    const result = planEquip(items, preparation, 'item-1', 'board-unit', 0);
    if (!result.ok) throw new Error(result.reason);
    expect(planEquip(freeze(result.items), preparation, 'item-1', 'board-unit', 0)).toEqual({ ok: false, reason: 'item-not-inventory' });
  });

  it('returns all sold-unit equipment with stable IDs into an arbitrarily large inventory', () => {
    const existing = Array.from({ length: 100 }, (_, i) => item(`item-${i + 10}`, 'belt'));
    const items = freeze([...existing, item('item-3', 'gunblade', 'board-unit', 2), item('item-1', 'sword', 'board-unit', 0),
      item('item-2', 'sword', 'board-unit', 1), item('item-4', 'vest', 'bench-unit', 2)]);
    const before = JSON.stringify(items), returned = returnUnitItems(items, 'board-unit');
    expect(returned.items).toHaveLength(items.length);
    expect(returned.items.filter(value => value.location.kind === 'inventory')).toHaveLength(103);
    expect(returned.items.find(value => value.id === 'item-4')).toEqual(item('item-4', 'vest', 'bench-unit', 2));
    expect(returned.items.map(value => value.id)).toEqual(items.map(value => value.id).sort());
    expect(returned.events).toEqual([{ type: 'itemsReturned', unitId: 'board-unit', itemIds: ['item-1', 'item-2', 'item-3'] }]);
    expect(returnUnitItems([...items].reverse(), 'board-unit')).toEqual(returned);
    expect(JSON.stringify(items)).toBe(before);
    expect(returnUnitItems(returned.items, 'board-unit')).toEqual({ items: returned.items, events: [] });
  });

  it('preserves behavior after JSON restoration', () => {
    const items = [item('item-1', 'sword'), item('item-2', 'rod')];
    const original = planCombine(items, 3, 'item-1', 'item-2');
    expect(planCombine(JSON.parse(JSON.stringify(items)), 3, 'item-1', 'item-2')).toEqual(original);
    if (!original.ok) throw new Error(original.reason);
    expect(planEquip(JSON.parse(JSON.stringify(original.items)), JSON.parse(JSON.stringify(preparation)), 'item-3', 'board-unit', 2))
      .toEqual(planEquip(original.items, preparation, 'item-3', 'board-unit', 2));
  });
});
