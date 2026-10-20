import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertManifest } from '../src/rendering3d/contracts';
import { ParticleEffect, parseParticleDocument } from '../src/rendering3d/particles';
import { PerspectiveCamera, Vector3 } from 'three';
// @ts-expect-error Offline conversion module is JavaScript.
import { mapEmitter } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Offline converter module is JavaScript.
import { batchActionBindings, batchOutputRoot, fxBatch1 } from '../scripts/assets3d/fx-batch1.mjs';
// @ts-expect-error Offline hand-authored tables are JavaScript.
import { batch1Tables } from '../scripts/assets3d/fx-bindings/batch1.mjs';
// @ts-expect-error Offline converter module is JavaScript.
import { trialActionBindings } from '../scripts/assets3d/fx-trial.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-batch1.json', import.meta.url), 'utf8'));
const legacy = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-legacy-bindings.json', import.meta.url), 'utf8'));
const oversize = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-synthetic-oversize.json', import.meta.url), 'utf8'));

describe('TFT13 batch one explicit FX tables', () => {
  it.each([
    ['synthetic_glow_a', 1000, .5],
    ['synthetic_glow_b', 800 * (1 - .5 * .1), .4],
    ['synthetic_glow_c', 900, .6],
  ])('keeps synthetic %s edges without turning its arbitrary plane toward the camera', (name, edge, scale) => {
    const fixture = oversize.find((r: any) => r.source.emitterName === name);
    const original = structuredClone(fixture.source);
    const result = mapEmitter(fixture.source, (path: string) => path, { particleMode: 'approximate' });
    expect(result.emitter.kind).toBe('arbitraryQuad');
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 100, maxDuration: 3 }, emitters: [result.emitter] });
    const camera = new PerspectiveCamera(); camera.rotation.set(.2, .4, .1);
    const fx = new ParticleEffect(doc, { scale: scale as number });
    try {
      fx.update(.1, camera);
      expect(Math.max(...fx.object.children[0].scale.toArray().slice(0, 2))).toBeCloseTo(edge as number, 3);
      const rotation = fx.object.children[0].quaternion.clone();
      expect(rotation.angleTo(camera.quaternion)).toBeGreaterThan(.1);
      camera.rotation.set(.6, -.4, .3); fx.update(0, camera);
      expect(fx.object.children[0].quaternion.angleTo(rotation)).toBeLessThan(1e-6);
      expect(new Vector3().setFromMatrixScale(fx.object.matrix).x).toBeCloseTo(scale as number);
      expect(Math.max(...fx.object.children[0].scale.toArray().slice(0, 2)) * new Vector3().setFromMatrixScale(fx.object.matrix).x).toBeCloseTo((edge as number) * (scale as number), 3);
      expect(fixture.source).toEqual(original);
    } finally { fx.dispose(); }
  });
  it('keeps a signed-probability ray at zero width rather than treating it as a glow surface', () => {
    const fixture = oversize.find((r: any) => r.source.emitterName === 'synthetic_ray');
    const result = mapEmitter(fixture.source, (path: string) => path, { particleMode: 'approximate' });
    expect(result.emitter.kind).toBe('ray');
    expect(result.emitter.size0).toEqual([0, 600, 0]);
    // Signed probability keys cancel in the existing deterministic mean preview.
    // Its long bounding line has no surface, unlike the synthetic glow quads.
    expect(result.emitter.size[0].value).toBe(2);
  });
  it('rejects other output roots and unsupported units before writing', async () => {
    for (const out of ['assets3d-local/fx-trial', 'assets3d-local/fx-all', 'public']) {
      await expect(batchOutputRoot(out)).rejects.toThrow();
    }
    await expect(fxBatch1({ units: 'jinx' })).rejects.toThrow('unsupported-batch-units');
  });
  it('binds only writable manifest effects and real model joints with legal preview phases', () => {
    const plan = batchActionBindings(fixture.manifest, fixture.rows, fixture.bones);
    assertManifest({ ...fixture.manifest, actionEffects: plan.actionEffects });
    expect(plan.actionEffects).toEqual(fixture.manifest.actionEffects);
    expect(Object.keys(plan.actionEffects)).toHaveLength(10);
    for (const [unit, table] of Object.entries(batch1Tables) as [string, any][]) {
      for (const action of ['attack', 'cast']) for (const spec of table[action]) {
        expect(['start', 'travel', 'impact']).toContain(spec.phase);
        expect(['source', 'target', 'projectile']).toContain(spec.anchor);
        expect(spec.delay).toBeGreaterThanOrEqual(0); expect(spec.maxDuration).toBeGreaterThan(0);
        if (spec.bone) expect(fixture.bones[unit]).toContain(spec.bone);
        else expect(spec.note.length).toBeGreaterThan(0);
      }
      for (const id of [...plan.actionEffects[unit].attack, ...plan.actionEffects[unit].cast]) {
        expect(fixture.manifest.effects[id]).toBeDefined();
        expect(plan.playback[id]).toMatchObject({ status: 'approximated', convention: 'explicit-preview-stage-timing-and-placement' });
        if (plan.playback[id].bone) expect(fixture.bones[unit]).toContain(plan.playback[id].bone);
      }
    }
    expect(plan.unavailable).toContainEqual(expect.objectContaining({ unit: 'ziggs', system: 'TFT13_Ziggs_Q_mis_01', reason: 'no-writable-emitters' }));
    expect(plan.unavailable).toContainEqual(expect.objectContaining({ unit: 'lux', system: 'R_Beam' }));
  });
  it('rejects dangling effect references and absent bones rather than silently rebinding', () => {
    expect(() => batchActionBindings({ ...fixture.manifest, effects: {} }, fixture.rows, fixture.bones)).toThrow('dangling-batch-binding');
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, { ...fixture.bones, drmundo: [] })).toThrow('missing-binding-bone:drmundo');
    const bad = structuredClone(batch1Tables); bad.drmundo.cast[0].phase = 'invented';
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, bad)).toThrow('invalid-binding-phase');
  });
  it('preserves the complete jinx/vi trial plan including variants, unavailable and shared metadata', () => {
    const ids = Object.keys(legacy.playback);
    const rows: Record<string, any[]> = { jinx: [], vi: [] }, shared: any[] = [];
    for (const id of ids) {
      if (id.startsWith('global_')) shared.push({ effectId: id, path: `${id}.json`, sourcePath: 'Shared/TFT_Global_BA_Hit' });
      else {
        const unit = id.startsWith('jinx_') ? 'jinx' : 'vi';
        // Recover source spelling from the checked-in legacy table below.
        rows[unit].push({ effectId: id, path: `${id}.json`, sourcePath: id });
      }
    }
    // The source inventory preserves case while generated effect IDs are lowercase.
    const sourceNames = { jinx: ['BA_Minigun_Cas_Medium', 'BA_Minigun_Mis', 'W_Cas', 'W_Mis', 'W_Beam', 'W_Tar', 'E_Mis', 'E_Mine_Explosion', 'R_MuzzleFlash', 'R_Cast_Mouth', 'R_Rocket_Child', 'R_Tar'],
      vi: ['Q_activate_hands_R', 'Q_Jumping_Dust', 'Q_Landing_Mis', 'Q_Landing_AoE', 'Q_Landing_AoE_Child', 'Q_Tar'] };
    for (const [unit, names] of Object.entries(sourceNames)) for (const row of rows[unit]) {
      const suffix = names.find(n => row.effectId.endsWith(`_base_${n.toLowerCase()}`));
      expect(suffix).toBeDefined(); row.sourcePath = `_Base_${suffix}`;
    }
    shared.push({ effectId: 'global_tft_global_ba_crit', path: 'crit.json', sourcePath: 'Shared/TFT_Global_BA_Crit' });
    // Missing Q left-hand system is present but unwritable in the real inventory.
    rows.vi.push({ sourcePath: '_Base_Q_activate_hands_L', reason: 'no-writable-emitters' });
    const manifest = { effects: Object.fromEntries([...Object.values(rows).flat(), ...shared].filter(r => r.effectId).map(r => [r.effectId, { path: r.path }])) };
    expect(trialActionBindings(manifest, rows, shared)).toEqual(legacy);
  });
});
