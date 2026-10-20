import { assetUrl, type ParticleDocumentV1, type ParticleDocumentV2 } from './contracts';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vec = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && Array.from(v).every(finite);
function fail(path: string): never { throw new Error(`invalid-particle-v2:${path}`); }
function record(v: unknown, path: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(path);
  return v as Record<string, unknown>;
}
function fields(v: Record<string, unknown>, keys: string[], path: string): void {
  for (const key of Object.keys(v)) if (!keys.includes(key)) throw new Error(`unsupported-particle-field:${path}.${key}`);
}
function positive(v: unknown, path: string, max = Number.MAX_VALUE): void {
  if (!finite(v) || v <= 0 || v > max) fail(path);
}
function count(v: unknown, path: string, max: number): void {
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > max) fail(path);
}
function birth(v: unknown, path: string, nonnegative: boolean): void {
  const valid = (x: unknown) => (finite(x) || vec(x)) && (!nonnegative || (Array.isArray(x) ? x : [x as number]).every(n => n >= 0));
  if (valid(v)) return;
  const r = record(v, path);
  fields(r, ['min', 'max'], path);
  if (!valid(r.min) || !valid(r.max) || finite(r.min) !== finite(r.max)) fail(path);
  const lo = Array.isArray(r.min) ? r.min : [r.min], hi = Array.isArray(r.max) ? r.max : [r.max];
  if (lo.some((n, i) => n > hi[i])) fail(path);
}
function resource(v: unknown, path: string, glb = false): void {
  if (typeof v !== 'string' || (glb && !/\.glb$/i.test(v))) fail(path);
  try { assetUrl('', v); } catch { fail(path); }
}

/** Reuse the unchanged v1 validators for all shared fields, after checking every v2 key. */
export function parseParticleDocumentV2(value: unknown, validateV1: (v: unknown) => ParticleDocumentV1): ParticleDocumentV2 {
  const d = record(value, '$');
  fields(d, ['schemaVersion', 'limits', 'emitters'], '$');
  if (d.schemaVersion !== 2 || !Array.isArray(d.emitters)) fail('$');
  const limits = record(d.limits, '$.limits');
  fields(limits, ['maxParticles', 'maxDuration'], '$.limits');
  count(limits.maxParticles, '$.limits.maxParticles', 10000);
  positive(limits.maxDuration, '$.limits.maxDuration', 3600);
  if (limits.maxParticles === 0) fail('$.limits.maxParticles');
  if (d.emitters.length > 1024) fail('$.emitters');
  for (const [i, item] of d.emitters.entries()) {
    const p = `$.emitters[${i}]`, e = record(item, p);
    const specific: Record<string, string[]> = { quad: [], mesh: ['mesh'], trail: ['trail'], ray: ['direction'],
      arbitraryQuad: [], screenDistortion: ['distortion'] };
    if (typeof e.kind !== 'string' || !Object.hasOwn(specific, e.kind)) fail(`${p}.kind`);
    const common = ['texture', 'delay', 'velocity', 'drag', 'gravity', 'shape', 'color', 'opacity', 'size', 'frames', 'dissolve', 'blend'];
    fields(e, ['kind', 'emission', 'lifetime', 'position', 'size0', 'rotation0', 'localTransform', ...common, ...specific[e.kind]], p);
    if (e.localTransform !== undefined) {
      const m = e.localTransform;
      if (!Array.isArray(m) || m.length !== 16 || !Array.from(m).every(finite) || m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) fail(`${p}.localTransform`);
    }
    const em = record(e.emission, `${p}.emission`);
    if (em.mode === 'burst') {
      fields(em, ['mode', 'count'], `${p}.emission`);
      count(em.count, `${p}.emission.count`, 10000);
    } else if (em.mode === 'continuous') {
      fields(em, ['mode', 'rate', 'duration', 'loop', 'burst'], `${p}.emission`);
      positive(em.rate, `${p}.emission.rate`, 10000);
      if (em.loop === true) { if (Object.hasOwn(em, 'duration')) fail(`${p}.emission.duration`); }
      else {
        if (em.loop !== undefined && em.loop !== false) fail(`${p}.emission.loop`);
        positive(em.duration, `${p}.emission.duration`, 3600);
      }
      if (em.burst !== undefined) count(em.burst, `${p}.emission.burst`, 10000);
    } else fail(`${p}.emission.mode`);
    if (e.lifetime === 'infinite') {
      if (em.mode !== 'continuous' || em.loop !== true) fail(`${p}.lifetime`);
    } else positive(e.lifetime, `${p}.lifetime`, 3600);
    if (e.position !== undefined && !vec(e.position)) fail(`${p}.position`);
    if (e.size0 !== undefined) birth(e.size0, `${p}.size0`, true);
    if (e.rotation0 !== undefined) birth(e.rotation0, `${p}.rotation0`, false);
    const shared = Object.fromEntries(common.filter(k => Object.hasOwn(e, k)).map(k => [k, e[k]]));
    if (shared.shape && (shared.shape as Record<string, unknown>).kind === 'cylinder') {
      const s = record(shared.shape, `${p}.shape`);
      fields(s, ['kind', 'radius', 'height'], `${p}.shape`);
      if (!finite(s.radius) || s.radius < 0 || !finite(s.height) || s.height < 0) fail(`${p}.shape`);
      delete shared.shape;
    }
    try { validateV1({ schemaVersion: 1, emitters: [{ ...shared, kind: 'sprite', count: 0, lifetime: 1 }] }); }
    catch (error) { throw new Error((error as Error).message.replace('$.emitters[0]', p)); }
    if (e.kind === 'mesh') resource(e.mesh, `${p}.mesh`, true);
    if (e.kind === 'ray' && (!vec(e.direction) || !Number.isFinite(Math.hypot(...e.direction)) || Math.hypot(...e.direction) === 0)) fail(`${p}.direction`);
    if (e.kind === 'trail') {
      const t = record(e.trail, `${p}.trail`);
      fields(t, ['width', 'lifetime', 'segments', 'uvMode', 'tileLength'], `${p}.trail`);
      try { validateV1({ schemaVersion: 1, emitters: [{ kind: 'sprite', count: 0, lifetime: 1, size: t.width }] }); }
      catch { fail(`${p}.trail.width`); }
      if (t.width === undefined) fail(`${p}.trail.width`);
      positive(t.lifetime, `${p}.trail.lifetime`, 3600);
      count(t.segments, `${p}.trail.segments`, 256);
      if ((t.segments as number) < 2 || !['stretch', 'repeat'].includes(t.uvMode as string)) fail(`${p}.trail`);
      if (t.uvMode === 'repeat') positive(t.tileLength, `${p}.trail.tileLength`);
      else if (Object.hasOwn(t, 'tileLength')) fail(`${p}.trail.tileLength`);
    }
    if (e.kind === 'screenDistortion') {
      const x = record(e.distortion, `${p}.distortion`);
      fields(x, ['normalMap', 'strength'], `${p}.distortion`);
      resource(x.normalMap, `${p}.distortion.normalMap`);
      if (!finite(x.strength) || x.strength < 0 || x.strength > 1) fail(`${p}.distortion.strength`);
    }
  }
  return structuredClone(value) as ParticleDocumentV2;
}
