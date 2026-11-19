import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { M8_VERSION } from '../src/simulation/m8/version';

// A real save 9 / replay 9 file, not a hand-made object: written by integration b2749cec (before #739) from seed 42 —
// the 1-2 battle with the opening Irelia, then Continue and the 1-3 battle with the dropped Tristana fielded alone at
// (3,7) — as { match, battles: history.completedRecords, currentBattle: history.capturePrefix() }, and stored as is.
// Its Tristana battle settled every basic attack on the attack tick, so it cannot be replayed under #739's ranged
// landing; without the format bump it was rejected as damaged data (invalid-data).
const v9 = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/save9-replay9-before-landing.json.gz', import.meta.url))).toString('utf8'));

describe('save/replay 10 (#739 ranged landing): saves and replays written before it', () => {
  it('the fixture really is a save 9 / replay 9 file with two finished battles, one with a ranged hero', () => {
    const file = v9();
    expect([file.saveFormatVersion, file.replayFormatVersion, file.battles.length]).toEqual([9, 9, 2]);
    expect(file.match.rulesVersion).toBe(M8_VERSION.rulesVersion);
    expect(JSON.stringify(file.battles[1])).toContain('"tristana"');
    expect(JSON.stringify(file)).not.toContain('"attackLaunched"');
    expect([M8_VERSION.saveFormatVersion, M8_VERSION.replayFormatVersion]).toEqual([10, 10]);
  });

  it('the save is rejected as unsupported-version (the old version), not as damaged data', () => {
    expect(readCompatibility(v9())).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'unsupported-version' });
    expect(routeSaveFile(v9()).view).toMatchObject({ status: 'rejected', reason: 'unsupported-version' });
    expect(routeSaveFile(v9()).envelope).toBeNull();
  });

  it('its replay archive is quarantined as an old version, never admitted to the replay list', () => {
    const admission = admitArchives([v9()], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined).toHaveLength(1);
    expect(admission.quarantined[0]?.runId).toBe('compat-run');
  });
});
