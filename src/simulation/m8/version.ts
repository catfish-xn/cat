import type { M8Version } from './contracts';

/** Server transport must import/align this value when wiring claimOrb. */
export const MULTIPLAYER_NET_PROTOCOL_VERSION = 5;
export const MULTIPLAYER_LOOT_CONTRACT_VERSION = 'multiplayer-orb-claim-v2';

/** v23-online-rules epoch (fmix32 opening selection, Sion rework with knock-up charge and revive, forced displacement,
 * knock-up marks, Black Rose 7, augment pool batches 1-2, Experiment emblem, Scrap/Enforcer). New replay facts (knock-up
 * status mark, displacement movement reasons) and no new command: schema12/save8 unchanged, replay8/command7; exact
 * rules/content identity rejects v22. */
export const M8_VERSION = {
  schemaVersion: 12, rulesVersion: 's13-g2-3-v23-online-rules', contentVersion: 's13-14.24b-g2-3-v23-online-rules',
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
