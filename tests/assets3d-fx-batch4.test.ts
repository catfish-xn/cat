import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Offline JavaScript tooling.
import { batchActionBindings, loadBindingTables } from '../scripts/assets3d/fx-batch.mjs';
// @ts-expect-error Offline JavaScript binding metadata.
import { batch4Tables } from '../scripts/assets3d/fx-bindings/batch4.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-batch4.json', import.meta.url), 'utf8'));
const tables = Object.fromEntries(Object.values(batch4Tables).map((t, i) => [`synthetic-unit-${i}`, t]));

describe('batch four offline FX bindings', () => {
  it('discovers all ten independent tables', async () => {
    const loaded = await loadBindingTables();
    expect(Object.keys(batch4Tables)).toHaveLength(10);
    for (const [unit, table] of Object.entries(batch4Tables)) expect(loaded[unit]).toEqual(table);
  });
  it('validates existing effect IDs, real skeleton joints and legal approximated stages', () => {
    const plan = batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, tables);
    assertManifest({ ...fixture.manifest, actionEffects: plan.actionEffects });
    let count = 0;
    for (const [unit, table] of Object.entries(tables) as [string, any][]) {
      for (const action of ['attack', 'cast']) {
        expect(plan.actionEffects[unit][action].length).toBeGreaterThan(0);
        for (const spec of table[action]) {
          expect(spec.status).toBe('approximated');
          expect(['start', 'travel', 'impact']).toContain(spec.phase);
          expect(['source', 'target', 'projectile']).toContain(spec.anchor);
          expect(spec.delay).toBeGreaterThanOrEqual(0);
          expect(spec.maxDuration).toBeGreaterThan(0);
          expect(spec.note.length).toBeGreaterThan(0);
          if (spec.bone) expect(fixture.bones[unit]).toContain(spec.bone);
          if (spec.system !== '@shared-hit') expect(fixture.rows[unit].some((r: any) =>
            r.sourcePath.endsWith('_Base_' + spec.system))).toBe(true);
        }
        for (const id of plan.actionEffects[unit][action]) {
          expect(fixture.manifest.effects[id]).toBeDefined();
          expect(plan.playback[id].status).toBe('approximated');
          count++;
        }
      }
      for (const [, reason] of table.unavailable) expect(reason.length).toBeGreaterThan(0);
    }
    expect(count).toBe(51);
    expect(plan.unavailable.filter((r: any) => r.reason === 'no-writable-emitters')).toHaveLength(7);
  });
  it('rejects dangling IDs, nonexistent bones and invalid phases', () => {
    expect(() => batchActionBindings({ ...fixture.manifest, effects: {} }, fixture.rows, fixture.bones, tables)).toThrow('dangling-batch-binding');
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, { ...fixture.bones, 'synthetic-unit-0': [] }, tables)).toThrow('missing-binding-bone');
    const bad = structuredClone(tables) as any;
    bad['synthetic-unit-0'].cast[0].phase = 'invalid';
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, bad)).toThrow('invalid-binding-phase');
  });
  it('reports an absent system without substituting a different effect', () => {
    const rows = structuredClone(fixture.rows);
    rows['synthetic-unit-0'] = [];
    const plan = batchActionBindings(fixture.manifest, rows, fixture.bones, tables);
    expect(plan.actionEffects['synthetic-unit-0'].cast).toEqual([]);
    expect(plan.unavailable.some((r: any) => r.unit === 'synthetic-unit-0' && r.reason === 'missing-system')).toBe(true);
  });
  it('keeps fixture paths and unit names synthetic', () => {
    expect(Object.keys(fixture.manifest.models).every(u => u.startsWith('synthetic-unit-'))).toBe(true);
    for (const entry of [...Object.values(fixture.manifest.models), ...Object.values(fixture.manifest.effects)] as { path: string }[]) {
      expect(entry.path.startsWith('synthetic/')).toBe(true);
    }
  });
});
