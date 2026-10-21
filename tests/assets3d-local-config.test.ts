import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
// @ts-expect-error Pure Node tooling.
import { DEFAULT_UNIT_MAP, loadUnitMap } from '../scripts/assets3d/local-config.mjs';
// @ts-expect-error Pure Node tooling; importing helpers must not require private data.
import { castModelEntry, loadCastPicks } from '../scripts/assets3d/cast-picks.mjs';

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) {
    expect(root.startsWith(join(tmpdir(), 'asset-config-'))).toBe(true);
    await rm(root, { recursive: true, force: true });
  }
});
async function location() {
  const root = await mkdtemp(join(tmpdir(), 'asset-config-')); roots.push(root);
  return join(root, 'unit-map.local.json');
}
const rules = Object.fromEntries(['idle', 'move', 'attack', 'cast', 'hit', 'death'].map(action => [action, { aliases: [], tokens: [] }]));

describe('private asset mapping configuration', () => {
  it('reports the missing file and recovery action without silently using examples', async () => {
    const file = await location();
    expect(DEFAULT_UNIT_MAP).toBe(resolve('assets3d-local/unit-map.local.json'));
    await expect(loadUnitMap(file)).rejects.toThrow(`missing-local-unit-map:${file}`);
    vi.stubEnv('ASSETS3D_UNIT_MAP', file);
    await expect(loadUnitMap()).rejects.toThrow('set ASSETS3D_UNIT_MAP');
    // Pure helpers remain importable in CI without any private configuration.
    expect(typeof castModelEntry).toBe('function');
    await expect(loadCastPicks()).rejects.toThrow('missing-local-unit-map');
  });
  it('loads the configured file unchanged and rejects malformed JSON or missing rules', async () => {
    const file = await location(), map = { $animationRules: rules, example: { base: 'synthetic/example/skins/base' } };
    await writeFile(file, JSON.stringify(map));
    vi.stubEnv('ASSETS3D_UNIT_MAP', file);
    expect(await loadUnitMap()).toEqual(map);
    for (const text of ['null', '[]', '{}', '{"$animationRules":{}}']) {
      await writeFile(file, text);
      await expect(loadUnitMap()).rejects.toThrow('invalid-local-unit-map:');
    }
    await writeFile(file, '{');
    await expect(loadUnitMap()).rejects.toThrow('invalid-local-unit-map-json:');
  });
  it('keeps the checked-in example synthetic', async () => {
    const text = await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8');
    expect(text).not.toMatch(/tft13_|\.tft_set13|https?:/i);
    expect(await loadUnitMap(fileURLToPath(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url)))).toEqual(JSON.parse(text));
  });
});
