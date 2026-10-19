import { describe, expect, it } from 'vitest';
// @ts-expect-error Build-time JavaScript utility.
import { inventoryParticles } from '../scripts/assets3d/particle-inventory.mjs';
describe('lossless source particle inventory', () => {
  it('preserves source parameters and separates source evidence from renderable data', () => {
    const emitter = { EmitterPosition: { constantValue: [0, 50, 0] }, birthScale0: { constantValue: [350, 400, 400] },
      isSingleParticle: 1, particleLifetime: { constantValue: 0.2 }, nested: { probabilityTables: [{ values: [0.5, 1] }] } };
    const report = inventoryParticles({ test: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [emitter] } });
    expect(report.renderable).toBe(false); expect(report.systemCount).toBe(1); expect(report.emitterCount).toBe(1);
    expect(report.systems[0].emitters[0].source).toEqual(emitter);
    expect(report.systems[0].emitters[0].gaps).toEqual(['birth-probability', 'emitter-position', 'vector-size']);
    report.systems[0].emitters[0].source.birthScale0.constantValue[0] = 1;
    expect(emitter.birthScale0.constantValue[0]).toBe(350);
  });
  it('does not invent a positive lifetime, burst count or billboard interpretation', () => {
    const report = inventoryParticles({ effect: { __type: 'VfxSystemDefinitionData', simpleEmitterDefinitionData: [
      { primitive: { __type: 'VfxPrimitiveRay' }, particleLifetime: { constantValue: -1 }, rate: { constantValue: 5 } },
    ] } });
    expect(report.systems[0].emitters[0].gaps).toEqual(['continuous-emission', 'primitive:VfxPrimitiveRay', 'special-or-dynamic-lifetime']);
    expect(report.systems[0].emitters[0].source.particleLifetime.constantValue).toBe(-1);
  });
  it('counts emitter records rather than estimated rendered particles', () => {
    const report = inventoryParticles({ notVfx: {}, x: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [
      { primitive: { __type: 'VfxPrimitiveMesh' }, rate: { constantValue: 100 } },
      { primitive: { __type: 'VfxPrimitiveCameraTrail' } },
    ] } });
    expect(report.emitterCount).toBe(2); expect(report.systems[0].emitters[0].gaps).toContain('mesh');
    expect(report.systems[0].emitters[1].gaps).toContain('trail');
  });
  it('rejects malformed source collections', () => {
    expect(() => inventoryParticles([])).toThrow('invalid-particle-source');
    expect(() => inventoryParticles({ x: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: 7 } })).toThrow('invalid-emitter-list');
  });
});
