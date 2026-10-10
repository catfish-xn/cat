import type { M8Version } from './contracts';

/** B9 formal switch (M8_RULES §10): the one runtime source for the frozen M8 identifiers.
 * contentDigest stays computed from the canonical content (content/index.ts), never hand-written. */
export const M8_VERSION = {
  schemaVersion: 6, rulesVersion: 'm8-14.24b-v1', contentVersion: 's13-14.24b-m8-v1',
  saveFormatVersion: 2, replayFormatVersion: 2, commandProtocolVersion: 2, rngAlgorithm: 'lcg32-v1', tickMs: 50,
} as const satisfies Omit<M8Version, 'contractVersion' | 'contentDigest'>;
/** D2-A: the shipped M7 identifiers, used only to recognize files for read-only preservation. */
export const LEGACY_M7_VERSION = {
  schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1', saveFormatVersion: 1, replayFormatVersion: 1,
} as const;
