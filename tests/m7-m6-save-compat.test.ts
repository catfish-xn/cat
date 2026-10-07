/** M8_RULES §10: new development rules/digest reject old signed-off M6/M7 files.
 * The seven original 631c131 exports and their hashes remain unchanged. The old
 * M7 continuation assertions are retained under tests/historical/m7.
 * B9 still owns physical legacy-library preservation/export and final version routing.
 */
import { describe, expect, it, vi } from 'vitest';
import { load, manifest as readManifest } from './fixtures/m6-saves/load.cjs';
import { validateEnvelope } from '../src/persistence/format';
import { PlaybackSession } from '../src/replay';
import { restoreMatch } from '../src/simulation/serialization';
import type { SaveEnvelope } from '../src/m6/contracts';

const manifest = readManifest();
describe('M8 development boundary preserves original M6/M7 files and refuses to run them', () => {
  it('retains every historical phase without regenerating old exports', () => {
    expect(new Set(manifest.saves.map(save => save.phase))).toEqual(new Set(['choice', 'preparation', 'combat', 'settlement', 'gameOver']));
  });
  for (const entry of manifest.saves) it(`${entry.file}: reject current-engine restore/replay without mutation`, async () => {
    const envelope = load(entry.file) as SaveEnvelope, original = structuredClone(envelope);
    const history = vi.fn();
    expect(envelope.match.phase).toBe(entry.phase);
    expect(envelope.battles).toHaveLength(entry.battles);
    await expect(validateEnvelope(envelope, history)).rejects.toThrow('content-digest');
    expect(history).not.toHaveBeenCalled();
    expect(() => restoreMatch(envelope.match)).toThrow('content-digest');
    for (const record of envelope.battles) expect(() => new PlaybackSession(record)).toThrow('content-digest');
    expect(envelope).toEqual(original);
    expect(load(entry.file)).toEqual(original);
  });
});
