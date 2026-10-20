import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertManifest } from '../src/rendering3d/contracts';
import { parseParticleDocument, ParticleEffect } from '../src/rendering3d/particles';
import { Vector3 } from 'three';
// @ts-expect-error Offline converter is JavaScript.
import { batchActionBindings, batchOutputRoot, fxBatch, loadBindingTables } from '../scripts/assets3d/fx-batch.mjs';
// @ts-expect-error Offline binding tables are JavaScript.
import { batch2Tables } from '../scripts/assets3d/fx-bindings/batch2.mjs';
// @ts-expect-error Offline converter is JavaScript.
import { mapEmitter } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Offline size measurement is JavaScript.
import { FX_SCALE, CELL_DISTANCE } from '../scripts/assets3d/fx-batch-sizes.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-batch2.json', import.meta.url), 'utf8'));
// Hand-authored inputs exercise generic size behavior without source asset data.
const syntheticQuad = (size: number[], values: number[][]) => ({
  emitterName: 'synthetic_axis_quad',
  isSingleParticle: true,
  particleLifetime: { constantValue: 1 },
  primitive: { __type: 'VfxPrimitiveArbitraryQuad' },
  birthScale0: { constantValue: size },
  scale0: { dynamics: { times: [0, 1], values } },
  texture: 'synthetic/quad.png',
});

describe('batch two reusable TFT13 FX pipeline', () => {
  it('discovers per-unit tables without editing the batch runner', async () => {
    const tables = await loadBindingTables();
    for (const [unit, table] of Object.entries(batch2Tables)) expect(tables[unit]).toEqual(table);
    expect(tables.lux).toBeDefined();
  });
  it('binds real effects and GLB joints with explicit approximated legal phases', () => {
    const plan = batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, batch2Tables);
    assertManifest({ ...fixture.manifest, actionEffects: plan.actionEffects });
    expect(plan.actionEffects).toEqual(fixture.manifest.actionEffects);
    expect(Object.keys(plan.actionEffects)).toHaveLength(10);
    for (const [unit, table] of Object.entries(batch2Tables) as [string, any][]) {
      for (const action of ['attack', 'cast']) for (const spec of table[action]) {
        expect(spec.status).toBe('approximated');
        expect(['start', 'travel', 'impact']).toContain(spec.phase);
        expect(['source', 'target', 'projectile']).toContain(spec.anchor);
        expect(spec.delay).toBeGreaterThanOrEqual(0);
        expect(spec.maxDuration).toBeGreaterThan(0);
        if (spec.bone) expect(fixture.bones[unit]).toContain(spec.bone);
        else expect(spec.note.length).toBeGreaterThan(0);
        if (spec.system !== '@shared-hit') expect(fixture.rows[unit].some((r: any) => r.sourcePath.endsWith(`_Base_${spec.system}`))).toBe(true);
      }
      for (const id of [...plan.actionEffects[unit].attack, ...plan.actionEffects[unit].cast]) {
        expect(fixture.manifest.effects[id]).toBeDefined();
        expect(plan.playback[id].status).toBe('approximated');
      }
    }
    for (const [unit, system] of [['camille', 'Q_2_cas_shin'], ['morgana', 'Q_Tar'], ['sett', 'E_cas'], ['zyra', 'E_Sequence_Root']]) {
      expect(plan.unavailable).toContainEqual(expect.objectContaining({ unit, system, reason: 'no-writable-emitters' }));
    }
    expect(plan.unavailable).toContainEqual(expect.objectContaining({ unit: 'nocturne', system: 'P_buf visible body aura' }));
  });
  it('rejects dangling effects, missing joints, invalid phases and unsafe roots', async () => {
    expect(() => batchActionBindings({ ...fixture.manifest, effects: {} }, fixture.rows, fixture.bones, batch2Tables)).toThrow('dangling-batch-binding');
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, { ...fixture.bones, akali: [] }, batch2Tables)).toThrow('missing-binding-bone');
    const bad = structuredClone(batch2Tables); bad.zyra.cast[0].phase = 'unknown';
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, bad)).toThrow('invalid-binding-phase');
    for (const out of ['public/fx-batch2', 'assets3d-local/fx-all', 'assets3d-local/fx-trial', 'assets3d-local/fx-batch2/nested']) await expect(batchOutputRoot(out)).rejects.toThrow();
    await expect(fxBatch({ units: 'akali,akali' })).rejects.toThrow('unsupported-batch-units');
    await expect(fxBatch({ units: 'invented' })).rejects.toThrow('unsupported-batch-units');
  });
  it.each([800, 1600])('preserves a synthetic oversized edge of %s through world and cell conversion', edge => {
    expect(FX_SCALE).toBe(.44); expect(CELL_DISTANCE).toBe(62.4);
    const source = syntheticQuad([edge, 400, 0], [[1, 1, 1], [1, 1, 1]]);
    const original = structuredClone(source);
    const result = mapEmitter(source, (path: string) => path, { particleMode: 'approximate' });
    expect(result.emitter.size0).toEqual([edge, 400, 0]);
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 100, maxDuration: 3 }, emitters: [result.emitter] });
    const fx = new ParticleEffect(doc, { scale: FX_SCALE });
    try {
      fx.update(.25);
      const sourceEdge = Math.max(...fx.object.children[0].scale.toArray().slice(0, 2));
      const worldScale = new Vector3().setFromMatrixScale(fx.object.matrix).x;
      expect(sourceEdge).toBeCloseTo(edge);
      expect(sourceEdge * worldScale).toBeCloseTo(edge * FX_SCALE);
      expect(sourceEdge * worldScale / CELL_DISTANCE).toBeGreaterThan(3);
    } finally { fx.dispose(); }
    expect(source).toEqual(original);
  });
  it('keeps a synthetic Y long edge without multiplying it by the X curve', () => {
    const source = syntheticQuad([80, 400, 0], [[3, 1, 1], [1, 1, 1]]);
    const original = structuredClone(source);
    const result = mapEmitter(source, (path: string) => path, { particleMode: 'approximate' });
    expect(result.emitter.size0).toEqual([80, 400, 0]);
    expect(result.emitter.size.every((k: any) => k.value === 1)).toBe(true);
    expect(result.approximations).toContainEqual(expect.objectContaining({ handling: 'scalar-v2-XY-long-edge-envelope-static-aspect-ratio' }));
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 100, maxDuration: 3 }, emitters: [result.emitter] });
    const fx = new ParticleEffect(doc, { scale: FX_SCALE });
    try {
      fx.update(.05);
      expect(Math.max(...fx.object.children[0].scale.toArray().slice(0, 2))).toBeCloseTo(400);
    } finally { fx.dispose(); }
    expect(source).toEqual(original);
  });
  it('inserts axis crossings so long-edge interpolation is correct between source keys', () => {
    const result = mapEmitter(syntheticQuad([80, 400, 0], [[10, 0, 0], [0, 2, 0]]),
      (path: string) => path, { particleMode: 'approximate' });
    expect(result.emitter.size).toContainEqual({ time: .5, value: 1 });
    expect(result.emitter.size[0].value).toBe(2);
    expect(result.emitter.size.at(-1).value).toBe(2);
  });
});
