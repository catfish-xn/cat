import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { compatibilityText } from '../src/persistence/save-controls';
import { admitArchives } from '../src/replay';
import { M8_VERSION } from '../src/simulation/m8/version';

// A real save 9 / replay 9 file, not a hand-made object: written by integration b2749cec (before #739) from seed 42 —
// the 1-2 battle with the opening Irelia, then Continue and the 1-3 battle with the dropped Tristana fielded alone at
// (3,7) — as { match, battles: history.completedRecords, currentBattle: history.capturePrefix() }, and stored as is.
// Its Tristana battle settled every basic attack on the attack tick, so it cannot be replayed under #739's ranged
// landing; without the format bump it was rejected as damaged data (invalid-data).
const v9 = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/save9-replay9-before-landing.json.gz', import.meta.url))).toString('utf8'));

describe('save/replay 10 (#739 ranged landing): v26 saves and replays written before it are an old version', () => {
  it('the fixture really is a save 9 / replay 9 file with two finished battles, one with a ranged hero', () => {
    const file = v9();
    expect([file.saveFormatVersion, file.replayFormatVersion, file.battles.length]).toEqual([9, 9, 2]);
    expect(file.match.rulesVersion).toBe(M8_VERSION.rulesVersion);
    expect(JSON.stringify(file.battles[1])).toContain('"tristana"');
    expect(JSON.stringify(file)).not.toContain('"attackLaunched"');
    expect([M8_VERSION.saveFormatVersion, M8_VERSION.replayFormatVersion]).toEqual([10, 10]);
  });

  it('the save is recognized as an old version (read-only export, start a new match), not as damaged data', () => {
    // Was 'rejected / unsupported-version' (#739); v26 files from before format 10 are now kept as an old version (Fable 11-19).
    expect(readCompatibility(v9())).toEqual({ status: 'legacy-preserved', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: true, reason: 'new-match-required' });
    expect(routeSaveFile(v9()).view).toMatchObject({ status: 'legacy-preserved', reason: 'new-match-required' });
    expect(routeSaveFile(v9()).envelope).toBeNull();
    expect(compatibilityText(readCompatibility(v9()))).toBe('这是旧版本的存档，不能继续游戏或回放。请开始新的一局；这份旧存档仍可以导出保存。');
  });

  it('only the v26 identity is an old version: a damaged header or a different identity is still refused', () => {
    const forged = v9(); forged.match.contentVersion = 'other-content';
    expect(readCompatibility(forged)).toMatchObject({ status: 'rejected', reason: 'unsupported-version' });
    const broken = v9(); delete broken.runId;
    expect(readCompatibility(broken)).toMatchObject({ status: 'rejected', reason: 'invalid-data' });
    const replay8 = v9(); replay8.replayFormatVersion = 8;
    expect(readCompatibility(replay8)).toMatchObject({ status: 'rejected', reason: 'unsupported-version' });
  });

  it('its replay archive is quarantined as an old version, never admitted to the replay list', () => {
    const admission = admitArchives([v9()], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined).toHaveLength(1);
    expect(admission.quarantined[0]?.runId).toBe('compat-run');
    expect(admission.quarantined[0]?.reason).toBe('这是旧版本的回放，不能继续游戏或回放。请开始新的一局；这份旧回放仍可以导出保存。');
  });
});
