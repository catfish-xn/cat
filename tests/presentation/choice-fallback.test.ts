import { describe, expect, it } from 'vitest';
import { genericOffer, readChoiceExtras } from '../../src/presentation/choice-fallback';

describe('generic mechanic choice display', () => {
  it('titles a forge popup by its offer count and names ordinary completed items in Chinese', () => {
    const forge = { kind: 'forge', offers: ['statikk-shiv', 'bramble-vest', 'gunblade', 'archangel'] };
    const extras = readChoiceExtras(forge);
    expect(extras.title).toBe('锻造器 · 4 选 1');
    expect(forge.offers.map(id => genericOffer(id, extras).name).every(name => /[一-鿿]/.test(name))).toBe(true);
  });
  it('keeps a declared title and leaves other kinds untitled', () => {
    expect(readChoiceExtras({ kind: 'forge', offers: ['gunblade'], display: { title: '自定义' } }).title).toBe('自定义');
    expect(readChoiceExtras({ kind: 'armory', offers: ['x'] })).toEqual({});
  });
});
