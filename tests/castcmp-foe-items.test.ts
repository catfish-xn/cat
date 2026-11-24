import { describe, expect, it } from 'vitest';
import { FOE_ITEMS_APPLIED, foeItemsLabel, layoutProblem, parseFoeItems, realFoeItems } from '../dev/castcmp/real-combat';

// castcmp --foe-items (recording setup only): items on the foes. Parsed and checked; not applied to the combat until the
// rules take a recording-only enemy items field, so jobs-check fails such a line and v-capture refuses it.
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
  it('is not applied yet', () => expect(FOE_ITEMS_APPLIED).toBe(false));
});
