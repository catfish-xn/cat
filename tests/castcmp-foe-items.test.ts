import { describe, expect, it } from 'vitest';
import { FOE_ITEMS_APPLIED, foeItemsLabel, layoutProblem, parseFoeItems, realFoeItems, realUnits, startRealCombat } from '../dev/castcmp/real-combat';

// castcmp --foe-items (recording setup only): items on the foes, given to the combat as the rules' recording-only enemy items.
describe('castcmp --foe-items', () => {
  it('parses foe=a+b,foe2=c into items per foe, in slot order', () => {
    const parsed = parseFoeItems('foe=sword+vest,foe2=infinity-edge');
    expect(parsed).toEqual({ items: { foe: ['sword', 'vest'], foe2: ['infinity-edge'] } });
    expect(foeItemsLabel((parsed as { items: never }).items)).toBe('foe=sword+vest foe2=infinity-edge');
    expect(realFoeItems({ foeItems: { foe: ['sword', 'vest'], foe2: ['infinity-edge'] } } as never)).toEqual([
      { unitId: 'foe', definitionId: 'sword', slot: 0 }, { unitId: 'foe', definitionId: 'vest', slot: 1 }, { unitId: 'foe2', definitionId: 'infinity-edge', slot: 0 }]);
  });
  it('refuses an empty list, an unknown foe or item, a foe named twice, more than 3 items, a malformed part', () => {
    for (const [text, why] of [['', 'empty'], ['me=sword', 'not one of'], ['foe=nothing', 'unknown item'], ['foe=sword,foe=vest', 'twice'],
      ['foe=sword+vest+belt+rod', 'at most 3'], ['foe', 'wants foe=item+item']] as const)
      expect((parseFoeItems(text) as { why: string }).why, text).toContain(why);
  });
  it('a foe beyond --nfoes is refused', () => {
    expect(layoutProblem({ nfoes: 1, foeItems: { foe2: ['sword'] } } as never, [])).toContain('--nfoes 2');
    expect(layoutProblem({ nfoes: 2, foeItems: { foe2: ['sword'] } } as never, [])).toBeNull();
  });
  it('reaches the combat: a foe given an item fights with it, and without the option the combat is as before', () => {
    expect(FOE_ITEMS_APPLIED).toBe(true);
    const setup = { unit: 'garen', star: 1, foe: 'garen', dist: 1, nfoes: 2, foestar: 1 } as never;
    const foes = (foeItems: Parameters<typeof startRealCombat>[3]) => (startRealCombat(realUnits(setup), [], 1, foeItems).state as { units: { id: string; attackDamage: number }[] }).units;
    const bare = foes(undefined), none = foes([]), armed = foes(realFoeItems({ foeItems: { foe2: ['sword'] } } as never));
    expect(JSON.stringify(none)).toBe(JSON.stringify(bare));
    expect(armed.find(u => u.id === 'foe2')!.attackDamage).toBeGreaterThan(bare.find(u => u.id === 'foe2')!.attackDamage);
    expect(armed.find(u => u.id === 'foe')!.attackDamage).toBe(bare.find(u => u.id === 'foe')!.attackDamage);
  });
});
