import type { M8Version } from './contracts';

/** Server transport must import/align this value when wiring claimOrb. */
export const MULTIPLAYER_NET_PROTOCOL_VERSION = 5;
export const MULTIPLAYER_LOOT_CONTRACT_VERSION = 'multiplayer-orb-claim-v2';

/** B9 formal switch (M8_RULES §10): the one runtime source for the frozen M8 identifiers.
 * contentDigest stays computed from the canonical content (content/index.ts), never hand-written.
 * PR1 development identity: epoch NOT recorded. Rebase on v20-black-market before recording.
 * schema12/save8 add openingEncounter; replay/command stay5 (no new command semantics).
 * Old epochs are rejected, never migrated. */
export const M8_VERSION = {
  schemaVersion: 12, rulesVersion: 's13-g2-3-v21-opening-encounters', contentVersion: 's13-14.24b-g2-3-v21-opening-encounters',
  saveFormatVersion: 8, replayFormatVersion: 5, commandProtocolVersion: 5, rngAlgorithm: 'lcg32-v1', tickMs: 50,
} as const satisfies Omit<M8Version, 'contractVersion' | 'contentDigest'>;
/** D2-A: the shipped M7 identifiers, used only to recognize files for read-only preservation. */
export const LEGACY_M7_VERSION = {
  schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1', saveFormatVersion: 1, replayFormatVersion: 1,
} as const;

/** D8-A: prior M8 files remain original, read-only export material. */
export const LEGACY_M8_VERSION = {
  schemaVersion:6,rulesVersion:'m8-14.24b-v1',contentVersion:'s13-14.24b-m8-v1',saveFormatVersion:2,replayFormatVersion:2,
} as const;
