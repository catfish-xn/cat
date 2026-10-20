import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { recomputeContentDigest } from '../scripts/content-digest';
import { recomputeLootReplayDigest } from '../scripts/loot-replay-digest';
import { restoreArchiveColumns } from '../src/simulation/content/archive-source';

const command = 'Recompute: node scripts/update-content-identities.cjs --write';
describe('committed identities cover complete archived content (CI fast)', () => {
  it('matches the original full content root, including explanation/source columns', () => {
    expect(CONTENT_DIGEST, command).toBe(recomputeContentDigest());
  });
  it('matches the full loot replay root', () => {
    expect(LOOT_REPLAY_DIGEST, command).toBe(recomputeLootReplayDigest());
  });
  it('rejects incomplete archive rows and overlapping runtime columns', () => {
    expect(() => restoreArchiveColumns({ a: {} }, {} as { a: object })).toThrow('identities differ');
    expect(() => restoreArchiveColumns({ a: { name: 'a' } }, { a: { name: 'b' } })).toThrow('overlap');
  });
  it.each(['src/main.ts', 'src/server/main.ts', 'src/server-entry/index.ts'])(
    'keeps complete archive tables out of the %s dependency graph', entry => {
      const visited = new Set<string>();
      const visit = (file: string): void => {
        if (visited.has(file)) return;
        visited.add(file);
        expect(file, `Archive columns reached from ${entry}`).not.toMatch(
          /g2-[34]-(?:special-item|trait|artifact|support-item)-source\.ts$/);
        expect(file).not.toMatch(/scripts[\\/](?:content-digest|loot-replay-digest)\.ts$/);
        for (const imported of ts.preProcessFile(readFileSync(file, 'utf8')).importedFiles) {
          if (!imported.fileName.startsWith('.')) continue;
          const target = resolve(dirname(file), imported.fileName);
          const dependency = [target, target + '.ts', target + '.js', resolve(target, 'index.ts')]
            .find(candidate => /\.[cm]?[jt]s$/.test(candidate) && existsSync(candidate));
          if (dependency) visit(dependency);
        }
      };
      visit(resolve(entry));
    });
});
