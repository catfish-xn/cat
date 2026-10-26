import { freezeContent } from './freeze';
import { CHAMPION_ROLES, ROLE_DISPLAY } from './scrap-lucky-roles';
/**
 * P (2026-10-24, Scrap 6/9 lucky + radiant): next-version-data-check-2026-10-24 recommendation.
 * Source: archived 14.24 client role tables (en_us.json champion `role` + map22 TFTCharacterRoleData.items,
 * client order). 14.24 confirms "lucky" consults the holder's recommended items; the draw itself is unconfirmed (U12-U19).
 */
export const SCRAP_LUCKY_POLICY = freezeContent({
  revision: 'scrap-lucky-v1',
  classification: 'P',
  luckyFromTier: 6,
  radiantFromTier: 9,
  /** Never converted at tier 6+; tiers 2/4 keep the original ordinary-first rule. */
  excludedComponents: ['spatula', 'frying-pan'],
  selection: 'first legal recommended item whose recipe contains the component (client order); else uniform over legal ordinary completed items by FNV-1a/fmix32 word of (g23 seed, round, item instance id)',
  radiant: 'tier 9 maps each produced temporary item through G23_RADIANT_MAPPING; items without a radiant stay ordinary; shield component count unchanged',
});
export const SCRAP_CHAMPION_ROLES: Readonly<Record<string, string>> = freezeContent({ ...CHAMPION_ROLES });
export const SCRAP_ROLE_ITEMS: Readonly<Record<string, readonly string[]>> = freezeContent(
  Object.fromEntries(Object.entries(ROLE_DISPLAY).map(([role, row]) => [role, row.items])));
