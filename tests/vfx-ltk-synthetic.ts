/** Synthetic value tree builders, not exported game data or a converted asset fixture. */
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
export const num = (value: number): VfxValue => ({ type: 'number', value });
export const vec = (...values: number[]): VfxValue => ({ type: 'vector', values });
export function struct(name: string, fields: Record<string, VfxValue>): VfxValue {
  return { type: 'struct', classHash: nameHash(name), class: name, object: null,
    fields: Object.entries(fields).map(([key, value]) => ({ hash: nameHash(key), name: key, value })) };
}
export const constant = (value: VfxValue) => struct('ValueFloat', { constantValue: value, dynamics: { type: 'null' } });
export function syntheticSystem(fields: Record<string, VfxValue> = {}): VfxSystem {
  const emitter = struct('VfxEmitterDefinitionData', {
    emitterName: { type: 'string', value: 'synthetic-only' },
    rate: constant(num(30)), lifetime: num(0.2), particleLifetime: constant(num(0.5)),
    birthScale0: constant(vec(4, 4, 4)), birthVelocity: constant(vec(12, 0, 0)),
    birthColor: constant(vec(0.5, 0.75, 1, 1)),
    texture: { type: 'asset', path: 'synthetic.tex', asset: null },
    ...fields,
  });
  return { entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'),
    class: 'VfxSystemDefinitionData', materials: [], root: struct('VfxSystemDefinitionData', {
      complexEmitterDefinitionData: { type: 'container', items: [emitter] },
    }) };
}
export function syntheticIndex() {
  return { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'textures/sample.png' },
    skills: { jinx: [ { system: 'sample', event: 'cast-start', delay: 0, duration: 1, stopAfter: 0.3 } ] } };
}
