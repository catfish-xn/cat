import { describe, expect, it } from 'vitest';
import { itemsLabel, layoutProblem, parseItems, realItems, realUnits, runRealCombat, type RealSetup } from '../dev/castcmp/real-combat';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
// @ts-expect-error Pure Node utility.
import { STAT_ONLY_ITEMS, TEMPO_ITEMS, WARN_ITEMS, itemAdvice } from '../dev/castcmp/item-advice.cjs';

// castcmp --items / --ally2: recordings with items on the caster's side (off by default) and a second ally.
const base: RealSetup = { unit: 'garen', star: 2, form: null, foe: 'training-dummy', dist: 3, nfoes: 1, foestar: 1 };
const firstState = (units: any[], items: any[] = []) => {
  let first: any;
  runRealCombat(units, 1, state => { first ??= state; }, 1, undefined, items);
  return first;
};
const unitOf = (state: any, id: string) => state.units.find((u: any) => u.id === id);

describe('castcmp --items and --ally2', () => {
  it('reads me=a+b,ally=c into items per unit and refuses foes (not yet), unknown units, unknown ids, more than 3, a unit twice or nothing', () => {
    expect(parseItems('me=warmog+deathblade,ally=warmog')).toEqual({ items: { me: ['warmog', 'deathblade'], ally: ['warmog'] } });
    expect(parseItems('ally2=deathcap')).toEqual({ items: { ally2: ['deathcap'] } });
    expect(parseItems('foe=warmog')).toEqual({ why: '--items: items on foes are not supported yet (foe)' });
    for (const bad of ['', 'enemy=warmog', 'foe2=warmog', 'me=not-an-item', 'me=warmog+warmog+warmog+warmog', 'me=warmog,me=deathcap', 'me', 'me=', 'me=a=b'])
      expect('why' in parseItems(bad), bad).toBe(true);
    expect(parseItems(undefined)).toEqual({ why: '--items is empty' });
  });

  it('puts the items on their units slot by slot, as the game holds them', () => {
    expect(realItems({ ...base, items: { me: ['warmog', 'deathblade'], ally: ['deathcap'] }, ally: 'leona' })).toEqual([
      { id: 'item-me-0', definitionId: 'warmog', location: { kind: 'unit', unitId: 'me', slot: 0 } },
      { id: 'item-me-1', definitionId: 'deathblade', location: { kind: 'unit', unitId: 'me', slot: 1 } },
      { id: 'item-ally-0', definitionId: 'deathcap', location: { kind: 'unit', unitId: 'ally', slot: 0 } }]);
    expect(realItems(base)).toEqual([]);
    expect(itemsLabel({ me: ['warmog'], ally2: ['deathcap', 'deathblade'] })).toBe('me=warmog ally2=deathcap+deathblade');
    expect(itemsLabel(undefined)).toBeNull();
  });

  it('places a second ally one row ahead and one column right of the caster unless told, and checks its layout', () => {
    const units = realUnits({ ...base, ally: 'leona', ally2: 'vi', ally2star: 3 });
    expect(units.find(u => u.id === 'ally2')).toEqual({ id: 'ally2', definitionId: 'vi', team: 'player', starLevel: 3, location: { kind: 'board', cell: { row: 4, col: 4 } } });
    expect(realUnits({ ...base, ally2: 'vi', ally2Cell: { row: 6, col: 1 } }).find(u => u.id === 'ally2')!.location.cell).toEqual({ row: 6, col: 1 });
    expect(layoutProblem({ ...base, ally2Cell: { row: 4, col: 4 } }, [])).toBe('--ally2-cell / --ally2star need --ally2');
    expect(layoutProblem({ ...base, items: { ally: ['warmog'] } }, [])).toBe('--items ally=... needs --ally');
    expect(() => realUnits({ ...base, ally: 'leona', ally2: 'vi', ally2Cell: { row: 4, col: 3 } })).toThrow('both on 4,3');
  });

  it('equips the items in the real combat: a Warmog on the caster raises its health', () => {
    const units = realUnits(base);
    const plain = unitOf(firstState(units), 'me'), equipped = unitOf(firstState(units, realItems({ ...base, items: { me: ['warmog'] } })), 'me');
    expect(equipped.maxHp).toBeGreaterThan(plain.maxHp);
    // No items: the very same combat as before the option existed (the default argument is the empty list).
    const events = (items?: any[]) => { const all: any[] = []; runRealCombat(units, 40, (_s, shown) => all.push(shown), 1, undefined, ...(items ? [items] : [])); return JSON.stringify(all); };
    expect(events()).toBe(events([]));
  });

  it('advises on real item ids only: warnings, timing notes and the stats-only first choices, by holder', () => {
    for (const id of [...Object.keys(WARN_ITEMS), ...TEMPO_ITEMS, ...STAT_ONLY_ITEMS]) expect(Object.hasOwn(ITEM_DEFINITIONS, id), id).toBe(true);
    for (const id of STAT_ONLY_ITEMS) expect(Object.hasOwn(WARN_ITEMS, id) || TEMPO_ITEMS.includes(id), id).toBe(false);
    expect(itemAdvice({ me: ['warmog', 'sunfire-cape', 'shojin'], ally: ['bloodthirster'] }))
      .toEqual({ warn: ['me:sunfire-cape (burn)', 'ally:bloodthirster (shield)'], tempo: ['me:shojin'] });
    expect(itemAdvice(undefined)).toEqual({ warn: [], tempo: [] });
  });
});
