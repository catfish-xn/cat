/** B9 version-switch golden: the committed golden, its archive and the updater are exactly the reviewed audit's,
 * and the audit classifier refuses any state difference other than version/digest/event-sequence fields. */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const updater = require('../scripts/update-m8-b9-golden.cjs');
const root = resolve(import.meta.dirname, '..');
const sha = file => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
const audit = JSON.parse(readFileSync(join(root, 'docs/evidence/m8-b9/golden/audit.json'), 'utf8'));

describe('B9 reviewed golden migration', () => {
  it('binds golden, archive and updater to the reviewed audit', () => {
    expect(audit.kind).toBe('m8-b9-version-switch-golden-v1');
    expect(audit.oldCommit).toBe(updater.OLD_COMMIT);
    expect(sha('tests/fixtures/m5/full-match-golden.json')).toBe(audit.candidateSha256);
    expect(sha('tests/fixtures/m5/full-match-golden.pre-m8-b9.json')).toBe(audit.previousGoldenSha256);
    expect(sha('scripts/update-m8-b9-golden.cjs')).toBe(audit.updaterSha256);
    // The committed evidence is a clean-tree reproduction whose raw trajectories are committed beside it.
    const capture = JSON.parse(readFileSync(join(root, 'docs/evidence/m8-b9/golden/capture-complete.json'), 'utf8'));
    expect(audit.reproducedCommittedGolden).toBe(true);
    expect(capture.newDirty).toBe(false);
    expect(Object.keys(capture.files).sort()).toEqual(['cannon', 'mage', 'sniper', 'sniper-caitlyn'].flatMap(b => [`new-${b}.json.gz`, `old-${b}.json.gz`]).sort());
    for (const [file, digest] of Object.entries(capture.files)) expect(sha(`docs/evidence/m8-b9/golden/${file}`)).toBe(digest);
    for (const build of ['cannon', 'sniper', 'mage', 'sniper-caitlyn']) {
      const report = audit.report.builds[build];
      expect(report.battles).toBe(33); expect(report.outcome).toBe('victory');
      expect(report.resolvedReferences).toBeGreaterThan(0);
      expect(Object.keys(report.stateDifferences).sort()).toEqual(['ledgerLength', 'sequence', 'version']);
    }
  });
  it('binds the regenerated Herald fixtures to their classified migration evidence', () => {
    const herald = JSON.parse(readFileSync(join(root, 'docs/evidence/m8-b9/herald-diff.json'), 'utf8'));
    expect(Object.keys(herald.files).sort()).toEqual(['edge-of-night.json', 'evenshroud.json', 'ionic-spark--evenshroud.json', 'ionic-spark.json', 'quicksilver.json', 'trajectory.json']);
    for (const [file, entry] of Object.entries(herald.files)) {
      expect(sha(`tests/fixtures/m8-herald-raw/${file}`)).toBe(entry.newSha256);
      expect(entry.oldSha256).not.toBe(entry.newSha256);
    }
  });
  it('classifies only the frozen version/digest/sequence/ledger-length paths', () => {
    const diff = (path, a, b) => updater.classify([{ path, old: a, new: b }], 'vector');
    expect(diff('/schemaVersion', 5, 6).version).toBe(1);
    expect(diff('/combatInputBasis/contentDigest', 'a', 'b').version).toBe(1);
    expect(diff('/combat/neutralReceipts/deaths/0/eventSeq', 33, 26).sequence).toBe(1);
    expect(diff('/combat/companionState/reactions/0/deathEventId', '["round-10",55,77]', '["round-10",55,61]').sequence).toBe(1);
    expect(diff('/roundResults/3/combatEventCount', 119, 106).ledgerLength).toBe(1);
    for (const [path, a, b] of [['/gold', 1, 2], ['/playerHp', 100, 99], ['/combat/units/0/hp', 10, 9], ['/combat/neutralReceipts/deaths/0/tick', 33, 26],
      ['/combat/companionState/reactions/0/deathEventId', '["round-10",55,77]', '["round-10",56,61]'], ['/combat/neutralReceipts/deaths/0/eventSeq', 33, 'x'],
      ['/m8/loot/receipts/0/receiptId', 'a', 'b']]) expect(() => diff(path, a, b)).toThrow('UNKNOWN state difference');
  });
});
