import { describe, expect, it } from 'vitest';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Heimerdinger's focus changes battle results, so its rule identifier is part of the content digest: a save or replay written
// under the digest just before it (Malzahar's gate) is turned away as another version, never replayed under the new rule.
const BEFORE_FOCUS_DIGEST = 'fnv1a32-utf16:57428247';
describe("Heimerdinger's focus: files written before it", () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.heimerFocus).toBe('heimer-rockets-focus-current-target-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_FOCUS_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-focus', createdAt: '2026-11-20T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_FOCUS_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-focus']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_FOCUS_DIGEST }))).toThrow('content-digest');
  });
});
