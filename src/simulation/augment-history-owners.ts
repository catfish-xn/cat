/** Reserved integration IDs only. This registry does NOT enable offers or implement effects.
 * Future jobs must use these IDs (or update this registry in the same change). */
export const AUGMENT_HISTORY_OWNERS: Readonly<Record<string, readonly string[]>> = {
  'loot-explosion': ['deaths'],
  'shop-glitch': ['preparation-time'],
  'two-much-value': ['acquire', 'combat-roster'],
  'over-encumbered': ['positions'],
  'restart-mission': ['carousel', 'positions'],
  'brb': ['carousel', 'positions'],
  'diversified-portfolio': ['round-entry'], 'diversified-portfolio-plus': ['round-entry'],
  'survivor': ['table'], 'table-scraps': ['carousel'], 'young-and-wild-and-free': ['carousel'],
  'contested': ['pvp-roster'], 'scoreboard-scrapper': ['table', 'growth'],
  'good-for-something': ['deaths'], 'lunch-money': ['player-damage'],
  'titanic-titan': ['carousel', 'player-health'], 'forward-thinking': ['acquire', 'pvp-roster'],
  'mirrored-monetization': ['deaths'], 'dhampyr': ['player-damage'],
  'no-scout-no-pivot': ['pvp-roster', 'growth'], 'cooking-pot': ['round-entry', 'growth'],
};
export function augmentNeedsHistory(definitionId: string): boolean { return Object.hasOwn(AUGMENT_HISTORY_OWNERS, definitionId); }
