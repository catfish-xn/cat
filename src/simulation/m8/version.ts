import type { M8Version } from './contracts';

/** Server transport must import/align this value when wiring claimOrb. */
export const MULTIPLAYER_NET_PROTOCOL_VERSION = 5;
export const MULTIPLAYER_LOOT_CONTRACT_VERSION = 'multiplayer-orb-claim-v2';

/** v25-h8-rules: three history-dependent batch-5 augments. Conditional augment-history-v1
 * authenticates their facts per MATCH_CONTRACT A2/A4/A5; no new public commands.
 * Schema/save/replay/command remain 12/8/8/7; older identities are rejected. */
export const M8_VERSION = {
  schemaVersion: 12, rulesVersion: 's13-g2-3-v25-h8-rules', contentVersion: 's13-14.24b-g2-3-v25-h8-rules',
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
