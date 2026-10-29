import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from '../src/simulation/content/items';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { G24_ARTIFACT_ITEMS } from '../src/simulation/content/g2-4-artifacts';
import { G24_SUPPORT_ITEMS } from '../src/simulation/content/g2-4-support-items';
import { G23_SPECIAL_ITEMS } from '../src/simulation/content/g2-3-item-registry';
import { convertAngerIssuesItems, isAngerIssuesConvertibleItem } from '../src/simulation/augment-pool-batch5-r2';

describe('P-B5-21 item classification', () => {
  it('accepts ordinary completed recipes and rejects components', () => {
    for (const item of Object.values(ORDINARY_ITEMS)) {
      expect(isAngerIssuesConvertibleItem(item.id), item.id).toBe(item.kind === 'completed' && !!item.recipe);
    }
    expect(isAngerIssuesConvertibleItem('rageblade')).toBe(true);
    expect(isAngerIssuesConvertibleItem('thiefs-gloves')).toBe(true);
    expect(isAngerIssuesConvertibleItem('bow')).toBe(false);
    expect(isAngerIssuesConvertibleItem('unknown-item')).toBe(false);
  });
  it('rejects every emblem, artifact, support, radiant and black-market item', () => {
    for (const group of [EMBLEM_ITEMS, G24_ARTIFACT_ITEMS, G24_SUPPORT_ITEMS, G23_SPECIAL_ITEMS]) {
      for (const item of Object.values(group)) expect(isAngerIssuesConvertibleItem(item.id), item.id).toBe(false);
    }
  });
});

it('conversion preserves instance identities and locations while retaining special equipment', () => {
  const items = [
    { id: 'item-1', definitionId: 'deathblade', location: { kind: 'unit', unitId: 'unit-1', slot: 2 } },
    { id: 'item-2', definitionId: 'bow', location: { kind: 'inventory' } },
    { id: 'item-3', definitionId: 'TFT5_Item_GuinsoosRagebladeRadiant', location: { kind: 'inventory' } },
  ] as const;
  expect(convertAngerIssuesItems(items)).toEqual([
    { ...items[0], definitionId: 'rageblade' }, items[1], items[2],
  ]);
  expect(items[0].definitionId).toBe('deathblade');
});
