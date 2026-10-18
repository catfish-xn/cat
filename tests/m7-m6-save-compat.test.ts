/** M8_RULES §10 D2-A (B9 flip): the seven original 631c131 M6/M7 exports and their hashes remain unchanged.
 * They are now recognized by version routing as legacy-preserved (export only, new match required) instead of
 * failing the digest check; they are never restored, replayed or migrated. The old M7 continuation assertions
 * remain under tests/historical/m7; the physical legacy library is covered by scripts/verify-m8-b9-legacy.cjs.
 */
import { describe, expect, it, vi } from 'vitest';
import { load, manifest as readManifest } from './fixtures/m6-saves/load.cjs';
import { CompatibilityError, validateEnvelope } from '../src/persistence/format';
import { readCompatibility } from '../src/persistence/compatibility';
import { PlaybackSession } from '../src/replay';
import { restoreMatch } from './fixtures/history-evidence';
import type { SaveEnvelope } from '../src/m6/contracts';

const manifest = readManifest();
describe('M8 version routing preserves original M6/M7 files and refuses to run them', () => {
  it('retains every historical phase without regenerating old exports', () => {
    expect(new Set(manifest.saves.map(save => save.phase))).toEqual(new Set(['choice', 'preparation', 'combat', 'settlement', 'gameOver']));
  });
  for (const entry of manifest.saves) it(`${entry.file}: legacy-preserved, never restored or replayed, without mutation`, async () => {
    const envelope = load(entry.file) as SaveEnvelope, original = structuredClone(envelope);
    const history = vi.fn();
    expect(envelope.match.phase).toBe(entry.phase);
    expect(envelope.battles).toHaveLength(entry.battles);
    expect(readCompatibility(envelope)).toMatchObject({ status: 'legacy-preserved', fileRulesVersion: 'm5-14.24b-v1', canResume: false, canReplay: false, canExportOriginal: true, reason: 'new-match-required' });
    await expect(validateEnvelope(envelope, history)).rejects.toBeInstanceOf(CompatibilityError);
    expect(history).not.toHaveBeenCalled();
    expect(() => restoreMatch(envelope.match)).toThrow('unsupported-version');
    for (const record of envelope.battles) expect(() => new PlaybackSession(record)).toThrow('记录版本');
    expect(envelope).toEqual(original);
    expect(load(entry.file)).toEqual(original);
  });
});
