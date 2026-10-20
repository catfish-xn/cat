import { inventoryParticles } from './particle-inventory.mjs';
import { approximateEmitter, particleMode } from './particle-approximate.mjs';

export const PARTICLE_LIMITS = Object.freeze({ maxParticles: 10000, maxDuration: 30 });
const allowed = new Set(['__type', 'emitterName', 'importance', 'primitive', 'isSingleParticle', 'particleLifetime',
  'rate', 'lifetime', 'timeBeforeFirstEmission', 'EmitterPosition', 'birthScale0', 'birthRotation0', 'birthVelocity',
  'birthDrag', 'worldAcceleration', 'birthColor', 'color', 'scale0', 'texture', 'blendMode', 'texDiv', 'numFrames', 'frameRate']);
function only(value, keys, label) {
  for (const k of Object.keys(value)) if (!keys.includes(k)) throw new Error(`unmapped-${label}:${k}`);
}
function constant(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`dynamic-or-probabilistic:${name}`);
  only(value, ['constantValue', 'dynamics', '__type'], name);
  if (value.__type && !/^Value(Float|Vector[234]|Color)$/.test(value.__type)) throw new Error(`unsupported-value-type:${value.__type}`);
  if (value.dynamics) {
    const d = value.dynamics;
    if (Object.keys(d).some(k => !['__type', 'times', 'values'].includes(k))) throw new Error(`unmapped-${name}:dynamics`);
    if (d.__type && !/^VfxAnimated(Float|Vector3f|Color)VariableData$/.test(d.__type)) throw new Error(`unsupported-curve-type:${d.__type}`);
    if (!Array.isArray(d.times) || !d.times.length || !Array.isArray(d.values) || d.times.length !== d.values.length ||
        d.times.some((n, i) => !Number.isFinite(n) || n < 0 || n > 1 || i > 0 && n <= d.times[i - 1]) ||
        d.values.some(v => JSON.stringify(v) !== JSON.stringify(d.values[0])) ||
        value.constantValue !== undefined && JSON.stringify(value.constantValue) !== JSON.stringify(d.values[0]))
      throw new Error(`dynamic-or-probabilistic:${name}`);
    return d.values[0];
  }
  if (value.constantValue === undefined) throw new Error(`dynamic-or-probabilistic:${name}`);
  return value.constantValue;
}
const vec = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
function mirror(v, name) {
  if (!vec(v)) throw new Error(`invalid-vector:${name}`);
  return [-v[0], v[1], v[2]];
}
function birth(v, name, rotate = false) {
  const transform = x => {
    if (!Number.isFinite(x) && !vec(x)) throw new Error(`invalid-birth:${name}`);
    if (!rotate) return x;
    // X reflection of XYZ Euler: Rx unchanged, Ry/Rz reverse. Scalar is local Z.
    return Array.isArray(x) ? [x[0], -x[1], -x[2]] : -x;
  };
  // Explicit uniform bounds only; probability tables do not establish uniformity.
  if (v && Object.hasOwn(v, 'min') && Object.hasOwn(v, 'max')) {
    only(v, ['min', 'max'], name);
    const lo = Array.isArray(v.min) ? v.min : [v.min], hi = Array.isArray(v.max) ? v.max : [v.max];
    if (Array.isArray(v.min) !== Array.isArray(v.max) || lo.length !== hi.length || lo.some((x, i) => x > hi[i])) throw new Error(`invalid-birth-range:${name}`);
    const a = transform(v.min), b = transform(v.max);
    return Array.isArray(a) ? { min: a.map((x, i) => Math.min(x, b[i])), max: a.map((x, i) => Math.max(x, b[i])) }
      : { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return transform(constant(v, name));
}
function curve(v, name, dimensions) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`invalid-source-curve:${name}`);
  only(v, ['constantValue', 'dynamics', '__type'], name);
  if (v.__type && !/^Value(Float|Vector[234]|Color)$/.test(v.__type)) throw new Error(`unsupported-value-type:${v.__type}`);
  // No source evidence establishes whether these compose, multiply or override.
  // Reject even malformed/nested constants here; neither branch may hide the other.
  if (v.dynamics && Object.hasOwn(v, 'constantValue')) throw new Error('ambiguous-curve:constantValue+dynamics');
  if (Object.hasOwn(v, 'constantValue')) {
    const value = v.constantValue;
    if (dimensions ? !Array.isArray(value) || value.length !== dimensions || !value.every(Number.isFinite)
      : !Number.isFinite(value)) throw new Error(`invalid-source-curve:${name}`);
  }
  if (!v.dynamics) return [{ time: 0, value: constant(v, name) }];
  const d = v.dynamics;
  only(d, ['times', 'values', '__type'], name);
  if (d.__type && !['VfxAnimatedFloatVariableData', 'VfxAnimatedVector3fVariableData', 'VfxAnimatedColorVariableData'].includes(d.__type))
    throw new Error(`unsupported-curve-type:${d.__type}`);
  if (!Array.isArray(d.times) || !Array.isArray(d.values) || d.times.length !== d.values.length || !d.times.length) throw new Error(`invalid-source-curve:${name}`);
  const out = d.times.map((time, i) => ({ time, value: d.values[i] }));
  if (dimensions && out.some(k => !Array.isArray(k.value) || k.value.length !== dimensions)) throw new Error(`invalid-source-curve:${name}`);
  return out;
}
function rgba(v) {
  if (!Array.isArray(v) || v.length !== 4 || v.some(n => !Number.isFinite(n) || n < 0 || n > 1)) throw new Error('invalid-source-color');
  return v;
}
function primitive(source, options) {
  const p = source.primitive ?? { __type: 'VfxPrimitiveCameraQuad' }, type = p.__type;
  if (source.distortionDefinition) return { status: 'skipped', reason: 'screen-distortion-requires-scene-color' };
  if (type === 'VfxPrimitiveAttachedMesh') return { status: 'skipped', reason: 'attached-mesh-requires-skinning' };
  if (type === 'VfxPrimitiveCameraQuad') { only(p, ['__type'], 'primitive'); return { kind: 'quad' }; }
  if (type === 'VfxPrimitiveMesh') {
    only(p, ['__type', 'mMesh'], 'primitive');
    if (!p.mMesh?.mSimpleMeshName) return { status: 'skipped', reason: 'mesh-resource-unavailable' };
    only(p.mMesh, ['__type', 'mSimpleMeshName'], 'mesh');
    const mesh = options.meshPath?.(p.mMesh.mSimpleMeshName);
    if (!mesh) return { status: 'skipped', reason: options.meshReasons?.get(p.mMesh.mSimpleMeshName) ?? 'mesh-resource-unavailable' };
    return { kind: 'mesh', mesh };
  }
  // A type tag alone cannot prove ray camera constraints, axes or trail modes.
  // Optional reviewed profiles require provenance. Production supplies none.
  const convention = options.primitiveConventions?.[type];
  if (!convention?.evidence) return { status: 'rejected', reason: `unverified-primitive-semantics:${type}` };
  if (type === 'VfxPrimitiveArbitraryQuad') {
    only(p, ['__type'], 'primitive');
    if (convention.plane !== 'XY') throw new Error('unsupported-arbitrary-quad-plane');
    return { kind: 'arbitraryQuad' };
  }
  if (type === 'VfxPrimitiveRay') {
    only(p, ['__type'], 'primitive');
    return { kind: 'ray', direction: mirror(convention.direction, 'ray-direction') };
  }
  if (['VfxPrimitiveCameraTrail', 'VfxPrimitiveArbitraryTrail'].includes(type)) {
    only(p, ['__type', 'mTrail'], 'primitive');
    if (!convention.trail || !convention.matches || JSON.stringify(p.mTrail) !== JSON.stringify(convention.matches)) throw new Error('unverified-trail-mode');
    return { kind: 'trail', trail: structuredClone(convention.trail) };
  }
  throw new Error(`unsupported-primitive:${type}`);
}
function mapStrictEmitter(source, texturePath, options = {}) {
  try {
    const p = primitive(source, options);
    if (p.status) return p;
    const approximations = [];
    // Explicit opt-in only. This policy omits the tail, never claims equivalence
    // or infers linger types/curves from these two duration fields.
    if (options.approximateLinger === true) {
      source = { ...source };
      for (const field of ['particleLinger', 'emitterLinger']) if (Object.hasOwn(source, field)) {
        const value = source[field];
        if (!Number.isFinite(value) || value < 0 || value > 3600) throw new Error(`invalid-source-linger:${field}`);
        approximations.push({ field, value, handling: 'omit-tail', reason: 'preview-omits-post-lifetime-residue' });
        delete source[field];
      }
    }
    if (source.__type && source.__type !== 'VfxEmitterDefinitionData') throw new Error(`unsupported-emitter-type:${source.__type}`);
    if (![undefined, true, false, 0, 1].includes(source.isSingleParticle)) throw new Error('invalid-source-single-particle');
    for (const key of Object.keys(source)) if (!allowed.has(key)) throw new Error(`unmapped-source-field:${key}`);
    const lifetime = constant(source.particleLifetime, 'particleLifetime'), emission = {};
    if (source.isSingleParticle) {
      if (source.rate !== undefined && constant(source.rate, 'rate') !== 1) throw new Error('unverified-single-particle-count');
      emission.mode = 'burst'; emission.count = 1;
      if (source.lifetime !== undefined && (!Number.isFinite(source.lifetime) || source.lifetime <= 0)) throw new Error('unverified-emitter-lifetime');
    } else {
      emission.mode = 'continuous'; emission.rate = constant(source.rate, 'rate');
      if (source.lifetime === -1 && options.emitterLoopEvidence) emission.loop = true;
      else if (Number.isFinite(source.lifetime) && source.lifetime > 0) emission.duration = source.lifetime;
      else throw new Error('unverified-emitter-lifetime');
    }
    let life = lifetime;
    if (lifetime === -1 && emission.loop && options.infiniteParticleEvidence) life = 'infinite';
    else if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error('special-or-dynamic-lifetime');
    const out = { ...p, emission, lifetime: life };
    if (source.texture) { out.texture = texturePath(source.texture); if (!out.texture) throw new Error('missing-or-unsupported-texture'); }
    if (source.timeBeforeFirstEmission !== undefined) out.delay = typeof source.timeBeforeFirstEmission === 'number'
      ? source.timeBeforeFirstEmission : constant(source.timeBeforeFirstEmission, 'delay');
    if (source.EmitterPosition !== undefined) out.position = mirror(constant(source.EmitterPosition, 'EmitterPosition'), 'EmitterPosition');
    if (source.birthScale0 !== undefined) out.size0 = birth(source.birthScale0, 'birthScale0');
    if (source.birthRotation0 !== undefined) out.rotation0 = birth(source.birthRotation0, 'birthRotation0', true);
    for (const [from, to] of [['birthVelocity', 'velocity'], ['worldAcceleration', 'gravity']]) if (source[from] !== undefined) out[to] = mirror(constant(source[from], from), from);
    if (source.birthDrag !== undefined) {
      const drag = constant(source.birthDrag, 'birthDrag');
      if (Array.isArray(drag) && (!vec(drag) || !drag.every(n => n === drag[0]))) throw new Error('anisotropic-drag');
      out.drag = Array.isArray(drag) ? drag[0] : drag;
    }
    if (source.color !== undefined || source.birthColor !== undefined) {
      const base = source.birthColor === undefined ? [1, 1, 1, 1] : rgba(constant(source.birthColor, 'birthColor'));
      const keys = source.color === undefined ? [{ time: 0, value: [1, 1, 1, 1] }] : curve(source.color, 'color', 4);
      const combined = keys.map(k => ({ time: k.time, value: rgba(k.value).map((n, i) => n * base[i]) }));
      out.color = combined.map(k => ({ time: k.time, value: k.value.slice(0, 3) }));
      out.opacity = combined.map(k => ({ time: k.time, value: k.value[3] }));
    }
    if (source.scale0 !== undefined) out.size = curve(source.scale0, 'scale0', 3).map(k => {
      if (!vec(k.value) || !k.value.every(n => n === k.value[0])) throw new Error('anisotropic-scale-curve');
      return { time: k.time, value: k.value[0] };
    });
    if (source.blendMode !== undefined) {
      if (!['normal', 'additive', 'multiply'].includes(source.blendMode)) throw new Error(`unverified-source-blend:${source.blendMode}`);
      out.blend = source.blendMode;
    }
    if (source.texDiv !== undefined || source.numFrames !== undefined || source.frameRate !== undefined) {
      const div = source.texDiv ?? [1, 1];
      if (!Array.isArray(div) || div.length !== 2 || source.numFrames !== undefined && source.numFrames !== div[0] * div[1]) throw new Error('partial-atlas');
      if (div[0] * div[1] > 1 && source.frameRate === undefined) throw new Error('unverified-atlas-frame-rate');
      out.frames = { columns: div[0], rows: div[1], fps: source.frameRate === undefined ? 0 : constant(source.frameRate, 'frameRate'), loop: false };
    }
    return approximations.length
      ? { status: 'approximated', reason: 'omitted-linger-tail', approximations, emitter: out }
      : { status: 'mapped', reason: 'exact-v2-subset', emitter: out };
  } catch (error) { return { status: 'rejected', reason: error.message }; }
}
export function mapEmitter(source, texturePath, options = {}) {
  if (particleMode(options.particleMode) === 'strict') return mapStrictEmitter(source, texturePath, options);
  try {
    const adapted = approximateEmitter(source, options.system, options);
    if (adapted.status) return adapted;
    const result = mapStrictEmitter(adapted.source, texturePath, { ...options, approximateLinger: true });
    const approximations = [...adapted.approximations, ...(result.approximations ?? [])];
    if (!result.emitter) return { ...result, approximations };
    const emitter = { ...result.emitter, ...adapted.additions };
    if (adapted.initialBurst) emitter.emission = { ...emitter.emission, burst: 1 };
    return { ...result, emitter,
      ...(approximations.length ? { status: 'approximated', reason: 'visual-preview-conventions', approximations } : {}) };
  } catch (error) { return { status: 'rejected', reason: error.message }; }
}
export function convertParticles(source, texturePath, validate, options = {}) {
  const mode = particleMode(options.particleMode);
  const inventory = inventoryParticles(source), counts = { mapped: 0, skipped: 0, rejected: 0 }, systems = [], byReason = {};
  if (options.approximateLinger === true || mode === 'approximate') counts.approximated = 0;
  const reasonsByStatus = { approximated: {}, skipped: {}, rejected: {} };
  const limits = { ...PARTICLE_LIMITS, ...options.limits };
  let budgetError;
  try { validate({ schemaVersion: 2, limits, emitters: [] }); }
  catch (error) { budgetError = error.message; }
  for (const system of inventory.systems) {
    const originalSystem = source[system.id], report = [], accepted = [];
    let maxDuration = limits.maxDuration;
    const systemKeys = ['__type', 'complexEmitterDefinitionData', 'simpleEmitterDefinitionData', 'particleName', 'particlePath'];
    const systemGaps = Object.keys(originalSystem).filter(k => !systemKeys.includes(k));
    for (const e of system.emitters) {
      let result = mapEmitter(e.source, texturePath, { ...options, system: originalSystem });
      if (result.emitter && systemGaps.length && mode === 'strict') result = { status: 'rejected', reason: `unmapped-system-field:${systemGaps[0]}` };
      let candidateDuration = maxDuration;
      if (result.emitter) try {
        if (budgetError) throw new Error(budgetError);
        const e = result.emitter;
        if (e.lifetime !== 'infinite' && !e.emission.loop) {
          const end = (e.delay ?? 0) + (e.emission.duration ?? 0) + e.lifetime + (e.trail?.lifetime ?? 0);
          if (options.limits?.maxDuration !== undefined && end > limits.maxDuration) throw new Error('finite-effect-exceeds-duration-budget');
          candidateDuration = Math.max(candidateDuration, end);
        }
        validate({ schemaVersion: 2, limits: { ...limits, maxDuration: candidateDuration }, emitters: [e] });
      }
      catch (error) { result = { status: 'rejected', reason: `contract-rejected:${error.message}` }; }
      if (result.emitter) { accepted.push(result.emitter); maxDuration = candidateDuration; }
      report.push({ sourcePath: e.id, mapped: result.status === 'mapped', status: result.status, reason: result.reason,
        ...(result.approximations ? { approximations: result.approximations } : {}),
        inventoryGaps: e.gaps, originalFields: e.source });
    }
    let document = accepted.length ? { schemaVersion: 2, limits: { ...limits, maxDuration }, emitters: accepted } : undefined;
    if (document) try { validate(document); }
    catch (error) {
      for (const row of report.filter(r => ['mapped', 'approximated'].includes(r.status))) {
        Object.assign(row, { mapped: false, status: 'rejected', reason: `contract-rejected:${error.message}` });
        delete row.approximations;
      }
      document = undefined;
    }
    for (const row of report) {
      counts[row.status]++;
      if (!row.mapped) {
        byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
        const group = reasonsByStatus[row.status]; group[row.reason] = (group[row.reason] ?? 0) + 1;
      }
    }
    systems.push({ sourcePath: system.id, document, reason: document ? undefined : 'no-writable-emitters', report,
      originalFields: originalSystem, systemGaps });
  }
  return { systems, counts, byReason, reasonsByStatus, emitters: inventory.emitterCount };
}
