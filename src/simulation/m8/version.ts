import type { M8Version } from './contracts';

/** Server transport must import/align this value when wiring claimOrb. */
export const MULTIPLAYER_NET_PROTOCOL_VERSION = 5;
export const MULTIPLAYER_LOOT_CONTRACT_VERSION = 'multiplayer-orb-claim-v2';

/** v26-neutrals-1424, plus targeting-p0 (28fd974a), anomaly-ui (6093cd26) and d5-register (2a7dd541).
 * Neutrals: 2026-10-29 approved PvE stats/counts and stage-6 Elder Dragon.
 * Targeting: ordinary target retention and one-step chase; the optional engaged-target
 * fact is authenticated by combat replay. No new commands/events.
 * Anomaly: planning, shared eligibility, initial-twelve quote protection and R5 sale-persistent entitlement.
 * D5: D0–D5 actual PvP damage, four augment registrations, stage bans, and over-encumbered bench capacity.
 * Schema/save/replay/command remain 12/8/8/7. Older identities are rejected.
 * targeting-p0, anomaly-ui and d5-register labeled this s13-g2-3-v26-online-rules; epoch re-record stays with the execution side. */
export const M8_VERSION = {
  schemaVersion: 12, rulesVersion: 's13-g2-3-v26-neutrals-1424', contentVersion: 's13-14.24b-g2-3-v26-neutrals-1424',
  saveFormatVersion: 8, replayFormatVersion: 8, commandProtocolVersion: 7, rngAlgorithm: 'lcg32-v1', tickMs: 50,
} as const satisfies Omit<M8Version, 'contractVersion' | 'contentDigest'>;
/** D2-A: the shipped M7 identifiers, used only to recognize files for read-only preservation. */
export const LEGACY_M7_VERSION = {
  schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1', saveFormatVersion: 1, replayFormatVersion: 1,
} as const;

/** D8-A: prior M8 files remain original, read-only export material. */
export const LEGACY_M8_VERSION = {
  schemaVersion:6,rulesVersion:'m8-14.24b-v1',contentVersion:'s13-14.24b-m8-v1',saveFormatVersion:2,replayFormatVersion:2,
} as const;
