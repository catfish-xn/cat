import { Euler } from 'three';

// Explicit preview conventions, not claims about the original engine. Strict
// conversion never calls this module's adapter. All decisions carry field paths.
export function particleMode(mode = 'strict') {
  if (!['strict', 'approximate'].includes(mode)) throw new Error('invalid-particle-mode');
  return mode;
}
const vector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const defaultCurve = v => ({ constantValue: v });
// Known presentation modifiers: a static, single-texture preview omits these.
// Unknown fields are NOT discarded; the strict adapter will still reject them.
export const OMIT_PREVIEW_FIELDS = Object.freeze({
  pass: 'ignore-pass-order', miscRenderFlags: 'ignore-render-state', alphaRef: 'ignore-alpha-test', depthBiasFactors: 'ignore-depth-bias',
  bindWeight: 'constant-one-attached-to-host', isUniformScale: 'uniform-size-from-X',
  isRandomStartFrame: 'atlas-starts-at-zero', startFrame: 'atlas-starts-at-zero',
  alphaErosionDefinition: 'omit-secondary-erosion-mask', textureMult: 'omit-secondary-texture',
  particleColorTexture: 'use-birth-and-color-curves', paletteDefinition: 'use-birth-and-color-curves',
  reflectionDefinition: 'unlit-single-texture', softParticleParams: 'omit-depth-fade',
  birthUvScrollRate: 'static-UV', particleUVScrollRate: 'static-UV', emitterUvScrollRate: 'static-UV',
  birthUVOffset: 'static-UV', uvScale: 'static-UV', uvScrollClamp: 'static-UV', texAddressModeBase: 'static-UV',
  TextureFlipU: 'static-UV', TextureFlipV: 'static-UV', colorLookUpTypeY: 'omit-color-lookup',
  colorLookUpOffsets: 'omit-color-lookup', colorLookUpScales: 'omit-color-lookup',
  doesCastShadow: 'unlit-no-shadow', disableBackfaceCull: 'double-sided', meshRenderFlags: 'ignore-render-state',
  colorRenderFlags: 'ignore-render-state', isGroundLayer: 'host-local-space', useNavmeshMask: 'no-navmesh',
  isLocalOrientation: 'host-local-space', particleIsLocalOrientation: 'host-local-space',
  isRotationEnabled: 'birth-rotation-only', birthRotationalVelocity0: 'birth-rotation-only', rotation0: 'birth-rotation-only',
  birthOrbitalVelocity: 'linear-motion-only', velocity: 'birth-velocity-only',
  directionVelocityScale: 'birth-size-only', directionVelocityMinScale: 'birth-size-only',
  rateByVelocityFunction: 'use-base-rate', MaximumRateByVelocity: 'use-base-rate',
  ChanceToNotExist: 'always-exist', SortEmittersByPos: 'document-order',
  FlexShapeDefinition: 'fixed-source-size', emissionMeshScale: 'point-emission-with-SpawnShape',
  emissionMeshName: 'point-emission-with-SpawnShape', useEmissionMeshNormalForBirth: 'birth-velocity-only',
  isFollowingTerrain: 'host-local-space', censorModulateValue: 'omit-censor-modulation',
  '{cb13aff1}': 'ignore-unknown-scalar-preview-modifier',
});

export function approximateEmitter(input, system = {}, options = {}) {
  const source = structuredClone(input), approximations = [], additions = {};
  const note = (field, value, handling) => approximations.push({ field, value: structuredClone(value), handling });
  const omit = (field, handling) => { note(field, source[field], handling); delete source[field]; };
  // A subsystem/force collection cannot be represented by one v2 emitter. Do
  // not quietly drop these and pretend the parent's resource chain rendered.
  for (const field of ['childParticleSetDefinition', 'fieldCollectionDefinition', 'fieldCollection']) {
    if (Object.hasOwn(source, field)) return { status: 'skipped', reason: `unexpressible-emitter:${field}` };
  }
  const shape = source.SpawnShape;
  if (options.textureAlpha?.(source.texture) === false
      && (source.textureMult || source.alphaErosionDefinition)) {
    return { status: 'skipped', reason: 'unexpressible-emitter:opaque-base-requires-secondary-mask' };
  }
  const nonzero = value => typeof value === 'number' ? value !== 0
    : Array.isArray(value) ? value.some(nonzero)
    : value && typeof value === 'object' ? Object.entries(value).some(([key, v]) =>
      ['constantValue', 'values', 'keyValues', 'dynamics', 'probabilityTables'].includes(key) && nonzero(v)) : false;
  // A rotated emission frame affects BOTH position and velocity. Collapsing it
  // to a mean point/velocity stacks a continuous stream into a saturated slab.
  // V2 has no emission-frame distribution; omit rather than invent its motion.
  if (!source.isSingleParticle && shape?.emitRotationAxes?.some(nonzero)
      && shape.emitRotationAngles?.some(nonzero) && nonzero(source.birthVelocity)) {
    return { status: 'skipped', reason: 'unexpressible-emitter:rotated-directional-emission' };
  }
  const sample = (value, field, animated = false) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const v = structuredClone(value), d = v.dynamics;
    if (v.__type?.startsWith('IntegratedValue')) {
      note(`${field}.__type`, v.__type, 'sample-as-value-without-integration');
      v.__type = v.__type.replace('IntegratedValue', 'Value');
    }
    if (d?.probabilityTables) {
      const tables = d.probabilityTables;
      const factors = tables.map(t => t.keyValues?.length ? t.keyValues.reduce((a, b) => a + b, 0) / t.keyValues.length : 1);
      note(`${field}.dynamics.probabilityTables`, tables, 'deterministic-mean-keyValue-multiplier-empty-table-one');
      if (d.values) d.values = d.values.map(x => Array.isArray(x) ? x.map((n, i) => n * (factors[i] ?? 1)) : x * (factors[0] ?? 1));
      delete d.probabilityTables;
    }
    if (d && Object.hasOwn(v, 'constantValue')) {
      // Dynamics contain authored values for every field, not multipliers of
      // the fallback constant. Probability factors have already been applied once.
      note(field, { constantValue: v.constantValue, dynamics: d }, 'dynamics-replace-fallback-constant');
      delete v.constantValue;
    }
    if (!animated && d) {
      note(`${field}.dynamics`, d, 'birth-or-emitter-parameter-sampled-at-first-key');
      return defaultCurve(d.values?.[0]);
    }
    if (animated && d?.times?.some(t => Number.isFinite(t) && (t < 0 || t > 1))) {
      note(`${field}.dynamics.times`, d.times, 'clamp-preview-time-to-unit-interval-last-key-wins-at-duplicate');
      const keys = new Map(d.times.map((t, i) => [Math.min(1, Math.max(0, t)), d.values[i]]));
      const sorted = [...keys].sort(([a], [b]) => a - b);
      d.times = sorted.map(([t]) => t); d.values = sorted.map(([, v]) => v);
    }
    return v;
  };
  for (const key of ['particleLifetime', 'rate', 'birthScale0', 'birthRotation0', 'birthVelocity', 'birthDrag', 'worldAcceleration',
    'birthColor', 'EmitterPosition', 'birthAcceleration', 'frameRate', 'birthFrameRate']) if (source[key] !== undefined) source[key] = sample(source[key], key);
  for (const key of ['color', 'scale0']) if (source[key] !== undefined) source[key] = sample(source[key], key, true);
  // Numeric frameRate in the source is a scalar, unlike ValueFloat fields.
  if (typeof source.frameRate === 'number') source.frameRate = defaultCurve(source.frameRate);
  if (source.birthFrameRate !== undefined) {
    note('birthFrameRate', input.birthFrameRate, 'use-as-atlas-fps-if-frameRate-absent');
    source.frameRate ??= source.birthFrameRate; delete source.birthFrameRate;
  }
  if (source.birthAcceleration !== undefined) {
    const a = source.birthAcceleration.constantValue, g = source.worldAcceleration?.constantValue ?? [0, 0, 0];
    if (!vector(a) || !vector(g)) throw new Error('invalid-approximate-acceleration');
    note('birthAcceleration', input.birthAcceleration, 'constant-birth-acceleration-added-to-gravity');
    source.worldAcceleration = defaultCurve(a.map((n, i) => n + g[i])); delete source.birthAcceleration;
  }
  // Numeric selectors are named preview conventions, not proven GPU equations.
  const blend = source.blendMode;
  const alpha = options.textureAlpha?.(source.texture);
  if (!['normal', 'additive', 'multiply'].includes(blend) && (blend !== undefined || alpha === false)) {
    const mapped = typeof blend === 'number' && [1, 2, 3, 4].includes(blend)
      ? ({ 1: 'normal', 2: 'additive', 3: 'normal', 4: 'additive' })[blend] : undefined;
    source.blendMode = mapped ?? (alpha === false ? 'additive' : 'normal');
    note('blendMode', blend ?? null, mapped
      ? 'league-preview-' + blend + '-' + source.blendMode
      : 'league-preview-unknown-' + (alpha === false ? 'opaque-texture-additive' : 'alpha-or-unverified-normal'));
    if (!mapped) note('texture.alpha', alpha ?? null, 'PNG-any-alpha-below-255-effective-alpha-unknown-is-not-opaque');
  }
  if (source.SpawnShape !== undefined) {
    const s = source.SpawnShape;
    note('SpawnShape', s, 'uniform-volume-Box-Size-is-full-extents-Cylinder-Y-axis-Sphere-radius-missing-dimensions-zero-Legacy-or-unknown-point');
    const dim = (n = 0) => { if (!Number.isFinite(n) || n < 0) throw new Error('invalid-approximate-shape-size'); return n; };
    if (s.__type === 'VfxShapeBox') additions.shape = { kind: 'box', halfExtents: (s.Size ?? [0, 0, 0]).map(n => dim(n) / 2) };
    else if (s.__type === 'VfxShapeSphere') additions.shape = { kind: 'sphere', radius: dim(s.radius) };
    else if (s.__type === 'VfxShapeCylinder') additions.shape = { kind: 'cylinder', radius: dim(s.radius), height: dim(s.height) };
    else additions.shape = { kind: 'point' };
    if (s.emitOffset) {
      const offset = vector(s.emitOffset) ? s.emitOffset : sample(s.emitOffset, 'SpawnShape.emitOffset')?.constantValue;
      const position = source.EmitterPosition?.constantValue ?? [0, 0, 0];
      if (!vector(offset) || !vector(position)) throw new Error('invalid-approximate-shape-offset');
      source.EmitterPosition = defaultCurve(position.map((n, i) => n + offset[i]));
    }
    // Shape orientation/flags have no extra effect under the selected volume convention.
    delete source.SpawnShape;
  }
  if (source.isUniformScale === 1 || source.isUniformScale === true) {
    const size = source.birthScale0?.constantValue;
    if (Array.isArray(size)) source.birthScale0 = defaultCurve([size[0], size[0], size[0]]);
  }
  // V2 has a scalar lifetime size curve. For nonuniform XY planes retain the
  // authored longest edge, rather than multiplying Y by X's unrelated curve.
  // Aspect ratio animation remains approximated; strict conversion is unchanged.
  const primitiveType = source.primitive?.__type ?? 'VfxPrimitiveCameraQuad';
  const plane = ['VfxPrimitiveArbitraryQuad', 'VfxPrimitiveCameraQuad', 'VfxPrimitiveRay'].includes(primitiveType);
  const meshBounds = primitiveType === 'VfxPrimitiveMesh' ? options.meshBounds?.(source.primitive.mMesh?.mSimpleMeshName) : undefined;
  const axes = plane ? [0, 1] : [0, 1, 2];
  const birth = source.birthScale0?.constantValue ?? [1, 1, 1];
  const weights = plane ? birth : vector(meshBounds) ? birth.map((n, i) => n * meshBounds[i]) : undefined;
  if (weights && !source.isUniformScale && vector(birth) && Math.max(...axes.map(i => Math.abs(weights[i]))) > 0 && source.scale0) {
    const curve = source.scale0, values = curve.dynamics?.values ?? [curve.constantValue];
    if (values.every(vector) && values.some(v => axes.some(i => v[i] !== v[0]))) {
      note('scale0', input.scale0, plane ? 'scalar-v2-XY-long-edge-envelope-static-aspect-ratio' : 'scalar-v2-mesh-bounds-long-edge-envelope-static-aspect-ratio');
      const width = Math.max(...axes.map(i => Math.abs(weights[i])));
      const edge = v => Math.max(...axes.map(i => Math.abs(weights[i] * v[i]))) / width;
      if (!curve.dynamics) source.scale0 = defaultCurve(Array(3).fill(edge(values[0])));
      else {
        const times = curve.dynamics.times, keys = new Map();
        for (let i = 0; i < times.length; i++) {
          keys.set(times[i], edge(values[i]));
          if (!i || times[i] <= times[i - 1]) continue;
          const a = values[i - 1], b = values[i];
          // Max of signed axis-linear functions; insert every crossing so the
          // interpolated scalar preserves the long edge between source keys.
          const lines = axes.flatMap(axis => [1, -1].map(sign => [weights[axis] * a[axis] * sign, weights[axis] * b[axis] * sign]));
          for (let j = 0; j < lines.length; j++) for (let k = j + 1; k < lines.length; k++) {
            const [a0, a1] = lines[j], [b0, b1] = lines[k];
            const den = (a1 - a0) - (b1 - b0), f = (b0 - a0) / den;
            if (Number.isFinite(f) && f > 0 && f < 1) keys.set(times[i - 1] + f * (times[i] - times[i - 1]), edge(a.map((v, axis) => v + f * (b[axis] - v))));
          }
        }
        const sorted = [...keys].sort(([a], [b]) => a - b);
        source.scale0 = { dynamics: { times: sorted.map(([t]) => t), values: sorted.map(([, n]) => [n, n, n]) } };
      }
    }
  }
  if (source.scale0) {
    const s = source.scale0;
    const uniform = v => Array.isArray(v) ? [Math.abs(v[0]), Math.abs(v[0]), Math.abs(v[0])] : v;
    if (s.dynamics?.values.some(v => Array.isArray(v) && v.some(n => n !== v[0] || n < 0))) {
      note('scale0', input.scale0, 'scalar-v2-scale-uses-absolute-X'); s.dynamics.values = s.dynamics.values.map(uniform);
    }
    if (s.constantValue && Array.isArray(s.constantValue) && s.constantValue.some(n => n !== s.constantValue[0] || n < 0)) {
      note('scale0', input.scale0, 'scalar-v2-scale-uses-absolute-X'); s.constantValue = uniform(s.constantValue);
    }
  }
  if (source.modulationFactor) { note('modulationFactor', source.modulationFactor, 'omit-additional-color-modulation'); delete source.modulationFactor; }
  for (const [key, handling] of Object.entries(OMIT_PREVIEW_FIELDS)) if (Object.hasOwn(source, key)) omit(key, handling);
  if (source.rotationOverride !== undefined) {
    note('rotationOverride', source.rotationOverride, 'override-birth-Euler-rotation');
    source.birthRotation0 = defaultCurve(source.rotationOverride); delete source.rotationOverride;
  }
  if (source.Filtering !== undefined) omit('Filtering', 'use-runtime-texture-filtering');
  if (source.isDirectionOriented !== undefined) omit('isDirectionOriented', 'rays-use-birth-velocity-quads-face-camera');
  const p = source.primitive, type = p?.__type;
  if (p && Object.hasOwn(p, 'AlignYawToCamera')) { note('primitive.AlignYawToCamera', p.AlignYawToCamera, 'keep-static-mesh-birth-orientation'); delete p.AlignYawToCamera; }
  if (type === 'VfxPrimitiveArbitraryQuad') {
    // V2 already supports a fixed XY plane with birth Euler orientation.
    // Billboarding this plane turns authored ground decals into upright walls.
    additions.kind = 'arbitraryQuad';
    note('primitive', p, 'arbitrary-quad-local-XY-preserve-birth-Euler'); source.primitive = { __type: 'VfxPrimitiveCameraQuad' };
  } else if (type === 'VfxPrimitiveRay') {
    const velocity = source.birthVelocity?.constantValue;
    additions.kind = 'ray'; additions.direction = vector(velocity) && Math.hypot(...velocity) > 0 ? [-velocity[0], velocity[1], velocity[2]] : [0, 1, 0];
    note('primitive', p, 'ray-strip-along-birth-velocity-zero-velocity-local-Y');
    source.primitive = { __type: 'VfxPrimitiveCameraQuad' };
  } else if (type === 'VfxPrimitiveBeam') {
    if (!vector(p.start) || !vector(p.end) || Math.hypot(...p.end.map((n, i) => n - p.start[i])) === 0)
      return { status: 'skipped', reason: 'beam-endpoints-unavailable' };
    const delta = p.end.map((n, i) => n - p.start[i]);
    additions.kind = 'ray'; additions.direction = [-delta[0], delta[1], delta[2]];
    source.EmitterPosition = defaultCurve(p.start);
    const width = source.birthScale0?.constantValue?.[0] ?? 1;
    source.birthScale0 = defaultCurve([width, Math.hypot(...delta), 1]);
    note('primitive', p, 'beam-start-end-as-oriented-strip-width-birthScale0-X'); source.primitive = { __type: 'VfxPrimitiveCameraQuad' };
  } else if (['VfxPrimitiveCameraTrail', 'VfxPrimitiveArbitraryTrail'].includes(type)) {
    const t = p.mTrail ?? {}, width = t.mBirthTilingSize?.[0] ?? 1;
    additions.kind = 'trail'; additions.trail = { width: [{ time: 0, value: width }], lifetime: 0.3, segments: 32, uvMode: 'stretch' };
    note('primitive', p, 'v2-trail-width-birthTilingSize-X-tail-0.3s-32-segments-stretch-no-source-smoothing');
    source.birthScale0 = defaultCurve([1, 1, 1]); source.primitive = { __type: 'VfxPrimitiveCameraQuad' };
  }
  // Fixed planes/meshes: preview League pitch(X), yaw(Y), roll(Z) as
  // Ry * Rx * Rz (Three YXZ). Both spaces are Y-up; reflect X, hence negate
  // Y/Z angles, without swapping axes. Serialize an equivalent XYZ Euler in
  // degrees for the existing V2 contract. Camera roll and ray direction have
  // separate conventions below. Never infer orientation from ground-layer flags.
  const rotation = source.birthRotation0?.constantValue;
  if (['VfxPrimitiveArbitraryQuad', 'VfxPrimitiveMesh'].includes(type) && vector(rotation)) {
    const radians = Math.PI / 180;
    const xyz = new Euler(rotation[0] * radians, -rotation[1] * radians, -rotation[2] * radians, 'YXZ').reorder('XYZ');
    additions.rotation0 = [xyz.x, xyz.y, xyz.z].map(n => n / radians);
    note('birthRotation0', input.birthRotation0 ?? rotation, 'fixed-primitive-YXZ-X-reflection-to-v2-XYZ-degrees');
  }
  if (additions.kind === 'ray' && source.birthRotation0 !== undefined) {
    note('birthRotation0', input.birthRotation0 ?? source.birthRotation0, 'ray-or-beam-direction-overrides-birth-rotation');
    source.birthRotation0 = defaultCurve([0, 0, 0]);
  }
  if (!source.primitive || source.primitive.__type === 'VfxPrimitiveCameraQuad') {
    const rotation = source.birthRotation0?.constantValue;
    if (Array.isArray(rotation) && (rotation[0] !== 0 || rotation[1] !== 0) && !additions.kind) {
      note('birthRotation0', input.birthRotation0 ?? rotation, 'camera-facing-quads-keep-only-Z-roll');
      source.birthRotation0 = defaultCurve([0, 0, rotation[2]]);
    }
  }
  for (const field of ['particleLifetime', ...(!source.isSingleParticle ? ['rate'] : [])]) if (!source[field]) {
    note(field, null, 'missing-parameter-default-one'); source[field] = defaultCurve(1);
  }
  if (source.isSingleParticle && source.rate && source.rate.constantValue !== 1) {
    note('rate', input.rate, 'single-particle-one-burst'); source.rate = defaultCurve(1);
  }
  if (!source.isSingleParticle && (!Number.isFinite(source.lifetime) || source.lifetime <= 0)) {
    note('lifetime', input.lifetime ?? null, 'unbounded-emission-preview-one-second'); source.lifetime = 1;
  }
  if (source.particleLifetime.constantValue === -1) {
    note('particleLifetime', input.particleLifetime, 'infinite-particle-preview-one-second'); source.particleLifetime = defaultCurve(1);
  }
  if (source.birthDrag && Array.isArray(source.birthDrag.constantValue) && !source.birthDrag.constantValue.every(n => n === source.birthDrag.constantValue[0])) {
    note('birthDrag', input.birthDrag, 'isotropic-drag-from-X'); source.birthDrag = defaultCurve(source.birthDrag.constantValue[0]);
  }
  if (source.texDiv || source.numFrames) {
    const div = source.texDiv ?? [1, 1];
    if (!div.every(n => Number.isInteger(n) && n >= 1) || source.numFrames !== undefined && source.numFrames !== div[0] * div[1]) {
      note('texDiv/numFrames', { div, frames: source.numFrames ?? null }, 'integer-grid-uses-entire-atlas-fractional-grid-one-cell');
      source.texDiv = div.map(n => Number.isInteger(n) && n > 0 ? n : 1); source.numFrames = source.texDiv[0] * source.texDiv[1];
    }
    if (!source.frameRate && div[0] * div[1] > 1) { note('frameRate', null, 'missing-atlas-fps-zero-static-first-cell'); source.frameRate = defaultCurve(0); }
  }
  for (const [field, value] of Object.entries(system)) {
    if (['__type', 'complexEmitterDefinitionData', 'simpleEmitterDefinitionData', 'particleName', 'particlePath'].includes(field)) continue;
    if (field === 'transform') {
      if (!Array.isArray(value) || value.length !== 4 || value.some(row => !Array.isArray(row) || row.length !== 4 || !row.every(Number.isFinite))
        || value[0][3] !== 0 || value[1][3] !== 0 || value[2][3] !== 0 || value[3][3] !== 1) throw new Error('invalid-approximate-transform');
      // Row-vector League affine matrix, conjugated by X reflection. Three's
      // column-major storage is identical to this flattened row-vector matrix.
      const signs = [-1, 1, 1, 1];
      additions.localTransform = value.flatMap((row, i) => row.map((n, j) => n * signs[i] * signs[j]));
      note('system.transform', value, 'row-major-row-vector-last-row-translation-X-reflected-affine-local-position-and-orientation');
    } else if (['flags', 'soundOnCreateDefault', 'soundPersistentDefault', 'visibilityRadius', 'buildUpTime'].includes(field)) {
      note(`system.${field}`, value, 'ignore-preview-system-metadata');
    } else return { status: 'rejected', reason: `unmapped-system-field:${field}` };
  }
  if (!source.isSingleParticle) note('rate', input.rate ?? null, 'continuous-preview-initial-burst-one');
  return { source, additions, approximations, initialBurst: !source.isSingleParticle };
}
