import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { M8_VERSION } from '../src/simulation/m8/version';

// A real replay-8 save, not a hand-made object: written by integration 9e1eb12e (before #628) with the
// `finishedEnvelope()` of tests/m8-b9-compatibility.test.ts (seed 42, one finished battle in the history) and stored
// as is. Its battle records have no castIndex on their cast events.
const v8 = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/replay-v8-finished-save.json.gz', import.meta.url))).toString('utf8'));

describe('replay format 9: pre-castIndex saves and archives', () => {
  it('the fixture really is a replay-8 save with a finished battle and no castIndex', () => {
    const file = v8();
    expect([file.saveFormatVersion, file.replayFormatVersion, file.battles.length]).toEqual([9, 8, 1]);
    expect(file.match.rulesVersion).toBe(M8_VERSION.rulesVersion);
    expect(JSON.stringify(file)).not.toContain('"castIndex"');
    expect(M8_VERSION.replayFormatVersion).toBe(9);
  });

  it('is rejected as unsupported-version (the old version), not as damaged data', () => {
    expect(readCompatibility(v8())).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'unsupported-version' });
  });

  it('the version gate runs before any byte or replay check: a corrupted v8 battle archive gets the same verdict', () => {
    const file = v8();
    file.battles[0].eventHash = 'fnv1a32-utf16:00000000'; file.battles[0].events = [];
    expect(routeSaveFile(file).view).toMatchObject({ status: 'rejected', reason: 'unsupported-version' });
    expect(routeSaveFile(file).envelope).toBeNull();
  });

  it('a stored v8 replay archive is quarantined, never admitted to the replay list', () => {
    const admission = admitArchives([v8()], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined).toHaveLength(1);
    expect(admission.quarantined[0]?.runId).toBe('compat-run');
  });
});
