import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node utility.
import { batch7Tables } from '../scripts/assets3d/fx-bindings/batch7.mjs';
// @ts-expect-error Pure Node utility.
import { batchActionBindings, loadBindingTables } from '../scripts/assets3d/fx-batch.mjs';
// @ts-expect-error Pure Node utility.
import { FX_SCALE } from '../scripts/assets3d/fx-batch-sizes.mjs';

describe('six-cost independent FX binding contracts', () => {
  it('discovers the three own-skin tables and retains the common scale', async () => {
    const loaded = await loadBindingTables();
    expect(Object.keys(batch7Tables).sort()).toEqual(['mel', 'viktor', 'warwick']);
    const prefixes: Record<string, string> = { warwick: 'TFT13_Warwick_Base_', viktor: 'TFT13_Viktor_Base_', mel: 'TFT13_MissMage_Base_' };
    for (const [id, table] of Object.entries(batch7Tables) as [string, any][]) {
      expect(loaded[id]).toEqual(table);
      for (const spec of [...table.attack, ...table.cast]) {
        expect(spec.system.startsWith(prefixes[id])).toBe(true);
        expect(spec.status).toBe('approximated');
        expect(spec.note.length).toBeGreaterThan(0);
        expect(Object.keys(spec)).not.toContain('scale');
      }
      for (const [, reason] of table.unavailable) expect(reason.length).toBeGreaterThan(0);
    }
    expect(FX_SCALE).toBe(.44);
  });
  it('binds legal synthetic stages and reports a missing system without substitution', () => {
    const tables: Record<string, any> = {};
    const rows: Record<string, any[]> = { global: [] };
    const effects: Record<string, { path: string }> = {};
    const bones: Record<string, string[]> = {};
    Object.values(batch7Tables).forEach((source: any, i) => {
      const id = `synthetic-${i}`;
      tables[id] = { attack: [], cast: [], unavailable: [] };
      rows[id] = []; bones[id] = [];
      for (const action of ['attack', 'cast']) source[action].forEach((spec: any, j: number) => {
        const effectId = `synthetic-${i}-${action}-${j}`;
        const system = `TFT13_Synthetic_${i}_${action}_${j}`;
        tables[id][action].push({ ...spec, system });
        effects[effectId] = { path: `synthetic/${effectId}.json` };
        rows[id].push({ effectId, path: effects[effectId].path, sourcePath: `synthetic/${system}` });
      });
    });
    const manifest = { schemaVersion: 1, models: {}, effects };
    const result = batchActionBindings(manifest, rows, bones, tables);
    expect(Object.keys(result.playback)).toHaveLength(20);
    expect(result.unavailable).toEqual([]);
    rows['synthetic-0'] = [];
    const missing = batchActionBindings(manifest, rows, bones, tables);
    expect(missing.actionEffects['synthetic-0']).toEqual({ attack: [], cast: [] });
    expect(missing.unavailable.every((e: any) => e.reason === 'missing-system')).toBe(true);
  });
});
