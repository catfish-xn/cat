import { describe, expect, it } from 'vitest';
import { genericOffer, readChoiceExtras, timeoutOption } from '../../src/presentation/choice-fallback';
import { itemDisplayName } from '../../src/presentation/g23-display';
import { itemDescriptions } from '../../src/presentation/item-codex';

describe('generic mechanic choice display', () => {
  it('titles a completed-item forge popup with its 14.24 name and offer count and names ordinary completed items in Chinese', () => {
    const forge = { kind: 'forge', offers: ['statikk-shiv', 'bramble-vest', 'gunblade', 'archangel'] };
    const extras = readChoiceExtras(forge);
    expect(extras.title).toBe('成装锻造器 · 4 选 1');
    expect(forge.offers.map(id => genericOffer(id, extras).name).every(name => /[一-鿿]/.test(name))).toBe(true);
  });
  it('shows each item offer with its display name and catalogue effect lines', () => {
    const offer = genericOffer('gunblade', readChoiceExtras({ kind: 'forge', offers: ['gunblade'] }));
    expect(offer.name).toBe(itemDisplayName('gunblade'));
    expect(offer.description).toBe(itemDescriptions('gunblade').join('；'));
    expect(offer.description).not.toBe('');
  });
  it('falls back to the plain anvil name when offers are not one item kind', () => {
    expect(readChoiceExtras({ kind: 'forge', offers: ['gunblade', 'not-an-item'] }).title).toBe('锻造器 · 2 选 1');
  });
  it('keeps a declared title and leaves other kinds untitled', () => {
    expect(readChoiceExtras({ kind: 'forge', offers: ['gunblade'], display: { title: '自定义' } }).title).toBe('自定义');
    expect(readChoiceExtras({ kind: 'armory', offers: ['x'] })).toEqual({});
  });
  it('reads the declared timeout option and ignores malformed payloads', () => {
    expect(timeoutOption({ kind: 'forge', payload: { kind: 'forge', timeoutOption: 'gunblade' } })).toBe('gunblade');
    expect(timeoutOption({ kind: 'forge', payload: { timeoutOption: 3 } })).toBeUndefined();
    expect(timeoutOption({ kind: 'forge' })).toBeUndefined();
  });
});
