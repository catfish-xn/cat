import { describe, expect, it } from 'vitest';
import { catalogEntry, createItemCodex, itemDescriptions, itemMarkHtml } from '../../src/presentation/item-codex';
import { shimmerFamily, shimmerItemLines } from '../../src/presentation/special-item-text';
import { genericOffer, readChoiceExtras } from '../../src/presentation/choice-fallback';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { readItemCatalog } from '../../src/simulation/item-catalog';

const shimmerIds = Object.keys(ITEM_DEFINITIONS).filter(id => id.startsWith('TFT13_Crime_'));

describe('reward-only items in the item catalogue', () => {
  it('gives every rules item a catalogue entry with player text, and keeps the codex list to the base catalogue', () => {
    for (const id of Object.keys(ITEM_DEFINITIONS)) {
      expect(catalogEntry(id), id).toBeDefined();
      for (const line of itemDescriptions(id)) expect(line, id).not.toMatch(/有限奖励装备|RECONCILIATION|undefined|NaN|@/);
    }
    expect(typeof createItemCodex).toBe('function');
    for (const entry of readItemCatalog()) expect(catalogEntry(entry.id)).toEqual(entry);
  });
  it('describes all 28 微光装备 by family, with the Chem-Baron rule and the 完美加成 only on the perfected tier', () => {
    expect(shimmerIds).toHaveLength(28);
    for (const id of shimmerIds) {
      const lines = shimmerItemLines(id)!, family = shimmerFamily(id)!;
      expect(family, id).not.toBeNull();
      expect(lines, id).toContain('仅限炼金男爵英雄装备。');
      expect(lines.some(line => line.startsWith('完美加成：')), id).toBe(family.perfected);
      expect(itemDescriptions(id)).toEqual(lines);
    }
  });
  it('reads every number from the rules source (synthetic check on the format, not on client values)', () => {
    const [stats, effect] = shimmerItemLines('TFT13_Crime_Silver_FleshRipper')!;
    expect(stats).toMatch(/^攻击力 \+\d+% · 暴击率 \+\d+%$/);
    expect(effect).toMatch(/^生命降到 \d+% 以下时/);
  });
  it('shows a black market offer with its icon and player text instead of the registry note', () => {
    const id = 'TFT13_Crime_Gold_ShimmerBloom', offer = genericOffer(id, readChoiceExtras({ kind: 'blackMarket', offers: [id] }));
    expect(offer.description).toBe(itemDescriptions(id).join('；'));
    expect(itemMarkHtml(id, 40)).toContain('kind-completed');
  });
  it('names a radiant item after its base item', () => {
    const radiant = Object.values(ITEM_DEFINITIONS).find(definition => definition.kind === 'radiant' && definition.radiantOf)!;
    expect(itemDescriptions(radiant.id)[0]).toMatch(/^「.+」的光明版本。$/);
  });
});
