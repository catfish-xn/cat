import { freezeContent } from './freeze';
/**
 * Enforcer 10 "Combat Start: Confiscate all enemy items!" ({9edd4912}=1).
 * 14.24 confirmed (official patch notes, s13-trait-mechanics-research-2026-10-24 P01/P02): emblems and items held by
 * non-champion units are never confiscated. Everything else is P (2026-10-24), from the next-version-data-check-2026-10-24
 * recommendation (U21-U28 unconfirmed): see docs/S13_RULES_GAP.md.
 */
export const ENFORCER_CONFISCATION_POLICY = freezeContent({
  revision: 'enforcer-confiscation-v1',
  fromTier: 10,
  kept: ['emblem', 'non-champion-holder'],
  scope: 'every other item on an enemy champion: completed, component, artifact, support, radiant, temporary (Thief\'s Gloves children)',
  timing: 'combat-snapshot-first: before Scrap conversion, support/shroud grants, item summons and every item effect; trait membership unchanged',
  ledger: 'combat-only projection; permanent items never move, so they stay on their holder and slot after combat',
  transfer: 'none',
  mutual: 'both sides confiscate independently from their own opening snapshot',
  battleEquipment: 'items equipped mid-combat onto a confiscated side are inert for the rest of that combat',
});
