import { describe, expect, it } from 'vitest';
import { VI_SLAM_TICKS } from '../src/simulation/combat-g2-2';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Vi's slam at the original's time (11-21, authorization ②; docs/S13_RULES_GAP.md 蔚砸地时刻). The timing itself is covered by
// tests/vi-grab-slam.test.ts, which reads VI_SLAM_TICKS.
const BEFORE_DIGEST = 'fnv1a32-utf16:8ce74891';
describe("Vi's slam timing: files written before it", () => {
  it('the slam constant, the rule identifier, and the digest moved', () => {
    expect(VI_SLAM_TICKS).toBe(17);
    expect(S13_COMBAT_RULES.viSlam).toBe('vi-slam-aligned-to-original-v2');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-vi-slam', createdAt: '2026-11-21T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-vi-slam']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
