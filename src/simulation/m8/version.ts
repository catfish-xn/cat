import type { M8Version } from './contracts';

/** Server transport must import/align this value when wiring claimOrb. */
export const MULTIPLAYER_NET_PROTOCOL_VERSION = 5;
export const MULTIPLAYER_LOOT_CONTRACT_VERSION = 'multiplayer-orb-claim-v2';

/** v22 anvil candidate on v22-candidate c2179b9e. New command and consumed-unit replay fact:
 * schema12/save8 unchanged, replay7/command7; exact rules/content identity rejects the parent.
 * No epoch is recorded here. 待 v22 统一录制. */
export const M8_VERSION = {
  schemaVersion: 12, rulesVersion: 's13-g2-3-v22-anvil-units-candidate', contentVersion: 's13-14.24b-g2-3-v22-anvil-units-candidate',
  saveFormatVersion: 8, replayFormatVersion: 7, commandProtocolVersion: 7, rngAlgorithm: 'lcg32-v1', tickMs: 50,
} as const satisfies Omit<M8Version, 'contractVersion' | 'contentDigest'>;
/** D2-A: the shipped M7 identifiers, used only to recognize files for read-only preservation. */
export const LEGACY_M7_VERSION = {
  schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1', saveFormatVersion: 1, replayFormatVersion: 1,
} as const;

/** D8-A: prior M8 files remain original, read-only export material. */
export const LEGACY_M8_VERSION = {
  schemaVersion:6,rulesVersion:'m8-14.24b-v1',contentVersion:'s13-14.24b-m8-v1',saveFormatVersion:2,replayFormatVersion:2,
} as const;
