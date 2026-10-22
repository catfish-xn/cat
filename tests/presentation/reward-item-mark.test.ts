import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { g23RewardIcons } from '../../src/presentation/g23-reward-text';
import { rewardItemMarkHtml } from '../../src/presentation/reward-item-mark';

describe('black market and forge reward marks', () => {
  it.each(['Tier0', 'Tier1', 'Tier2', 'Tier3'])('shows %s as a pool badge, without inventing a drawn item', source => {
    const icon = g23RewardIcons({ Item: [source] })[0]!;
    expect(icon).toMatchObject({ kind: 'item', itemId: null, source });
    if (icon.kind !== 'item') throw new Error('item expected');
    const html = rewardItemMarkHtml(icon, 40);
    expect(html).toContain('黑市装备'); expect(html).toContain('market-pool-badge'); expect(html).not.toContain('?');
    const path = /src="([^"]+)"/.exec(html)![1]!;
    expect(readFileSync(new URL(`../../public/${path.replace(/^\//, '')}`, import.meta.url)).subarray(0, 4).toString('hex')).toBe('89504e47');
  });
  it.each(['TFT_ArmoryKeyCompleted', 'TFT_ArmoryKeyOrnn', 'TFT_ArmoryKeySupport'])('uses the bundled %s icon with a text fallback', source => {
    const icon = g23RewardIcons({ MeepTypeUnit: [source] })[0]!;
    if (icon.kind !== 'item') throw new Error('item expected');
    const html = rewardItemMarkHtml(icon, 30);
    expect(html).toContain(`${source.toLowerCase()}.png`); expect(html).toContain('item-glyph');
  });
  it('keeps the actual Crime item icon when an item has been drawn', () => {
    const icon = g23RewardIcons({ ExactItem: ['TFT13_Crime_Bronze_ChemGrips'] })[0]!;
    if (icon.kind !== 'item') throw new Error('item expected');
    expect(icon.itemId).not.toBeNull();
    expect(rewardItemMarkHtml(icon, 40)).toContain('tft13_crime_bronze_chemgrips.png');
  });
});
