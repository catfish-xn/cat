import { assetUrl, type Curve, type Vec3, type ParticleDocument, type ParticleDocumentV1 } from './contracts';
import { parseParticleDocumentV2 } from './particle-validation-v2';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vector = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && Array.from(v).every(finite);
function record(value: unknown, path: string, reason: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${reason}:${path}`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`unsupported-particle-field:${path}.${key}`);
  }
}
function validateCurve(value: unknown, path: string, color = false): void {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`invalid-curve:${path}`);
  let previous = -1;
  for (const [i, item] of value.entries()) {
    const keyPath = `${path}[${i}]`, key = record(item, keyPath, 'invalid-curve');
    fields(key, ['time', 'value'], keyPath);
    if (!finite(key.time) || key.time < 0 || key.time > 1 || key.time <= previous) throw new Error(`invalid-curve:${keyPath}.time`);
    if (color ? !vector(key.value) || key.value.some(n => n < 0 || n > 1)
      : !finite(key.value) || key.value < 0) throw new Error(`${color ? 'invalid-color' : 'invalid-curve'}:${keyPath}.value`);
    previous = key.time;
  }
}
/** Strict v1 JSON validation before textures/GPU allocation. Known unsupported kinds
 * remain opaque and are skipped/counted; supported sprites may not lose semantics.
 */
export function parseParticleDocumentV1(value: unknown): ParticleDocumentV1 {
  const doc = record(value, '$', 'invalid-particle-document');
  fields(doc, ['schemaVersion', 'emitters'], '$');
  if (doc.schemaVersion !== 1 || !Array.isArray(doc.emitters)) throw new Error('invalid-particle-document:$');
  for (const [index, item] of doc.emitters.entries()) {
    const path = `$.emitters[${index}]`, emitter = record(item, path, 'invalid-emitter-kind');
    if (!['sprite', 'mesh', 'trail', 'screenDistortion'].includes(emitter.kind as string)) throw new Error(`invalid-emitter-kind:${path}.kind`);
    if (emitter.kind !== 'sprite') continue;
    fields(emitter, ['kind', 'texture', 'count', 'lifetime', 'delay', 'velocity', 'drag', 'gravity', 'shape',
      'color', 'opacity', 'size', 'frames', 'dissolve', 'blend'], path);
    if (!finite(emitter.count) || !Number.isInteger(emitter.count) || emitter.count < 0) throw new Error(`invalid-emitter-timing:${path}.count`);
    if (!finite(emitter.lifetime) || emitter.lifetime <= 0) throw new Error(`invalid-emitter-timing:${path}.lifetime`);
    for (const key of ['delay', 'drag'] as const) {
      const n = emitter[key];
      if (n !== undefined && (!finite(n) || n < 0)) throw new Error(`invalid-emitter-timing:${path}.${key}`);
    }
    for (const key of ['velocity', 'gravity'] as const) {
      if (emitter[key] !== undefined && !vector(emitter[key])) throw new Error(`invalid-vector:${path}.${key}`);
    }
    for (const key of ['size', 'opacity', 'dissolve', 'color'] as const) {
      if (emitter[key] === undefined) continue;
      validateCurve(emitter[key], `${path}.${key}`, key === 'color');
      if ((key === 'opacity' || key === 'dissolve') && (emitter[key] as Curve).some(k => k.value > 1)) {
        throw new Error(`invalid-normalized-curve:${path}.${key}`);
      }
    }
    if (emitter.texture !== undefined) {
      if (typeof emitter.texture !== 'string') throw new Error(`invalid-texture:${path}.texture`);
      try { assetUrl('', emitter.texture); }
      catch { throw new Error(`invalid-texture:${path}.texture`); }
    }
    if (emitter.blend !== undefined && !['normal', 'additive', 'multiply'].includes(emitter.blend as string)) throw new Error(`invalid-blend:${path}.blend`);
    if (emitter.shape !== undefined) {
      const shape = record(emitter.shape, `${path}.shape`, 'invalid-shape');
      if (shape.kind === 'point') fields(shape, ['kind'], `${path}.shape`);
      else if (shape.kind === 'sphere') {
        fields(shape, ['kind', 'radius'], `${path}.shape`);
        if (!finite(shape.radius) || shape.radius < 0) throw new Error(`invalid-shape:${path}.shape.radius`);
      } else if (shape.kind === 'box') {
        fields(shape, ['kind', 'halfExtents'], `${path}.shape`);
        if (!vector(shape.halfExtents) || shape.halfExtents.some(n => n < 0)) throw new Error(`invalid-shape:${path}.shape.halfExtents`);
      } else throw new Error(`invalid-shape:${path}.shape.kind`);
    }
    if (emitter.frames !== undefined) {
      const f = record(emitter.frames, `${path}.frames`, 'invalid-frames');
      fields(f, ['columns', 'rows', 'fps', 'loop'], `${path}.frames`);
      for (const key of ['columns', 'rows'] as const) {
        if (!finite(f[key]) || !Number.isInteger(f[key]) || f[key] < 1) throw new Error(`invalid-frames:${path}.frames.${key}`);
      }
      if (!finite(f.fps) || f.fps < 0) throw new Error(`invalid-frames:${path}.frames.fps`);
      if (f.loop !== undefined && typeof f.loop !== 'boolean') throw new Error(`invalid-frames:${path}.frames.loop`);
    }
  }
  return structuredClone(doc) as unknown as ParticleDocumentV1;
}

export function parseParticleDocument(value: unknown): ParticleDocument {
  return value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 2
    ? parseParticleDocumentV2(value, parseParticleDocumentV1) : parseParticleDocumentV1(value);
}
