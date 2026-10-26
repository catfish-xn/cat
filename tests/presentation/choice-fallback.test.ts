import { loadTooltipText } from '../../src/presentation/tooltip-text-loader';
import { beforeAll } from 'vitest';
import { loadAugmentText } from '../../src/presentation/augment-text-loader';
beforeAll(() => Promise.all([loadAugmentText(), loadTooltipText()]));
import { describe, expect, it } from 'vitest';
import { genericOffer, isShopChoiceKind, readChoiceExtras, SKIP_OPTION, timeoutOption } from '../../src/presentation/choice-fallback';
import { itemDisplayName } from '../../src/presentation/g23-display';
import { itemDescriptions } from '../../src/presentation/item-codex';
import { G24_FORGE_POOLS } from '../../src/simulation/content/g2-4-forges';
import { G24_ARTIFACT_ITEMS } from '../../src/simulation/content/g2-4-artifacts';
import { augmentDisplayName, augmentIconHtml, augmentIconUrl, augmentPlayerDescription } from '../../src/presentation/augment-display';
import { describeEffect } from '../../src/presentation/effect-text';
import { AUGMENT_DEFINITIONS } from '../../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../../src/simulation/content/anomalies';

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
  it('titles an artifact forge 神器装备锻造器 by the rules\' artifact pool (artifacts are completed-kind) and shows their effect lines', () => {
    const offers = G24_FORGE_POOLS.TFT_ArmoryKeyOrnn.slice(0, 4);
    const extras = readChoiceExtras({ kind: 'forge', offers, payload: { kind: 'forge', source: 'conqueror', timeoutOption: offers[0] } });
    expect(extras.title).toBe('神器装备锻造器 · 4 选 1');
    for (const id of G24_FORGE_POOLS.TFT_ArmoryKeyOrnn) {
      const offer = genericOffer(id, extras);
      expect(offer.name).toBe(itemDisplayName(id));
      // The 21 G2-4b artifacts carry a '神器：' line; the 8 mechanism artifacts (#150) carry their own effect text.
      expect(offer.description).not.toBe('');
      if (Object.hasOwn(G24_ARTIFACT_ITEMS, id)) expect(offer.description).toContain('神器：');
    }
    // An artifact mixed with an ordinary completed item belongs to neither pool and keeps the plain name.
    expect(readChoiceExtras({ kind: 'forge', offers: [offers[0], 'gunblade'] }).title).toBe('锻造器 · 2 选 1');
    expect(readChoiceExtras({ kind: 'forge', offers: G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.slice(0, 4) }).title).toBe('成装锻造器 · 4 选 1');
  });
  it('titles a support forge 辅助装锻造器 by the rules\' support pool and names every support item in Chinese', () => {
    const offers = G24_FORGE_POOLS.TFT_ArmoryKeySupport.slice(0, 4);
    const extras = readChoiceExtras({ kind: 'forge', offers, payload: { kind: 'forge', source: 'conqueror', timeoutOption: offers[0] } });
    expect(extras.title).toBe('辅助装锻造器 · 4 选 1');
    for (const id of G24_FORGE_POOLS.TFT_ArmoryKeySupport) {
      const offer = genericOffer(id, extras);
      expect(offer.name).toMatch(/^[一-鿿]/);
      expect(offer.description).not.toBe('');
    }
    expect(genericOffer('TFT_Item_BansheesVeil', extras).name).toBe('女妖面纱');
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
  it('names armory upgrades in Chinese with their declared price, and marks the black-market skip timeout', () => {
    const armory = { kind: 'armory', offers: ['spare-parts', 'flamethrower'], payload: { kind: 'armory', prices: { 'spare-parts': 0, flamethrower: 5 }, timeoutOption: 'spare-parts' } };
    const extras = readChoiceExtras(armory);
    expect(genericOffer('spare-parts', extras)).toMatchObject({ name: '备用零件！', price: 0 });
    expect(genericOffer('flamethrower', extras)).toMatchObject({ name: '喷火器', price: 5 });
    for (const id of ['flamethrower', 'petricite-rod', 'repairing-microbots', 'self-destruct', 'tankbuster', 'spare-parts', 'finishing-touch', 'junkyard-titan'])
      expect(genericOffer(id, extras).description).toMatch(/[一-鿿]/);
    expect(timeoutOption({ kind: 'blackMarket', payload: { timeoutOption: '@skip' } })).toBe(SKIP_OPTION);
  });
  it('sends the black market and the Junker King armory to the shop row, titled by their 14.24 trait names; forges stay popups', () => {
    expect(['blackMarket', 'armory'].every(isShopChoiceKind)).toBe(true);
    expect(['forge', 'augment', 'component', 'anomaly'].some(isShopChoiceKind)).toBe(false);
    expect(readChoiceExtras({ kind: 'blackMarket', offers: ['x'], payload: { kind: 'blackMarket', source: 'black-market', skippable: true } }).title).toBe('炼金男爵 · 黑市');
    expect(readChoiceExtras({ kind: 'armory', offers: ['spare-parts'], payload: { kind: 'armory', source: 'junker-king', prices: {} } }).title).toBe('机械公敌 · 升级');
  });
});

describe('generic augment choice fallback', () => {
  // Two English W4 names plus an authored description exercise both text sources.
  const augmentIds = ['manaflow-ii', 'pumping-up-ii', 'pumping-up-i'] as const;

  it.each(augmentIds)('shows the Chinese name and player effect text for %s without inventing a price', id => {
    const definition = AUGMENT_DEFINITIONS[id]!;
    expect(definition.effects.length).toBeGreaterThan(0);
    const playerDescription = augmentPlayerDescription(id);
    const effectText = definition.effects.map(effect => describeEffect(effect)).join('；');
    const expectedDescription = playerDescription ? `${playerDescription} ${effectText}` : effectText;
    const offer = genericOffer(id, readChoiceExtras({ kind: 'augment', offers: [id] }));

    expect(offer.name).toBe(augmentDisplayName(id));
    expect(offer.name).toMatch(/[一-鿿]/);
    expect(offer.name).not.toBe(definition.name);
    expect(offer.description).toBe(expectedDescription);
    expect(offer.description).not.toBe('');
    expect(offer.description).toMatch(/[一-鿿]/);
    expect(offer).not.toHaveProperty('price');
  });

  it.each(augmentIds)('provides an icon for %s through the same helper used by strategy-panel', id => {
    const url = augmentIconUrl(id);
    expect(url).toEqual(expect.stringMatching(/assets\/s13\/augments\/.+\.png$/));
    // strategy-panel's generic offer button calls augmentIconHtml(offer.id, 40).
    const html = augmentIconHtml(id, 40);
    expect(html).toContain(`src="${url}"`);
    expect(html).toContain(`data-augment="${id}"`);
    expect(html).toContain('width="40" height="40"');
  });

  it('keeps the anomaly definition name and description without a price', () => {
    const id = 'titanic-strikes';
    const definition = ANOMALY_DEFINITIONS[id]!;
    const offer = genericOffer(id, readChoiceExtras({ kind: 'anomaly', offers: [id] }));
    expect(offer.name).toBe(definition.name);
    expect(offer.description).toBe(definition.description);
    expect(offer).not.toHaveProperty('price');
  });
});
