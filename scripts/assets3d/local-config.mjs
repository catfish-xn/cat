import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const DEFAULT_UNIT_MAP = fileURLToPath(new URL('../../assets3d-local/unit-map.local.json', import.meta.url));

/** Private source paths and clip names are supplied locally; never fall back to sample data. */
export async function loadUnitMap(path = process.env.ASSETS3D_UNIT_MAP ?? DEFAULT_UNIT_MAP) {
  const file = resolve(path);
  let text;
  try { text = await readFile(file, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`missing-local-unit-map:${file}; restore your private mapping here or set ASSETS3D_UNIT_MAP. See scripts/assets3d/README.md.`);
    throw error;
  }
  let map;
  try { map = JSON.parse(text); }
  catch { throw new Error(`invalid-local-unit-map-json:${file}`); }
  if (!map || Array.isArray(map) || typeof map !== 'object' || !map.$animationRules ||
      !['idle', 'move', 'attack', 'cast', 'hit', 'death'].every(action => map.$animationRules[action]))
    throw new Error(`invalid-local-unit-map:${file}; expected unit entries and $animationRules`);
  return map;
}
