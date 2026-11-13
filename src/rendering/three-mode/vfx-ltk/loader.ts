/** Browser resource boundary. System documents are the upstream resolved VfxSystem JSON, unchanged. */
import { DataTexture, LinearFilter, NoColorSpace, type BufferGeometry, type Texture } from 'three';
import type { NamedAsset, VfxSystem, VfxValue } from './bindings';
import { readVfxSystem } from './engine/parsing/readVfxSystem';
import { drawnEmitters, type DrawnEmitter } from './rendering/utils/definitions';
import { drawsAsBeam, drawsAsMesh, drawsAsProjection, drawsAsQuad, drawsAsTrail, drawsTheAttachment } from './rendering/utils/drawKind';
import type { EmitterSamplers } from './rendering/hooks/useVfxTextures';
import type { TimelineCue } from './timeline';
import { readConvertedMesh, type ConvertedMesh } from './assets/mesh';
import type { Pose } from './assets/pose';
import { reflectionCube } from './assets/reflectionCube';
import { ATTACHED_HELD_BACK, ATTACHED_WHOLE_BODY, CUE_EXTRA_SKILLS, cueAdditions, cueOverride, DISABLED_EMITTERS, MUTED_EMITTERS, TRAIL_END_FADE, withCueBranches } from './cue-overrides';
import { convertedTimelines } from './s13-timelines';
import { QUAD_TYPE, RENDER_PHASE } from './engine/model/enums';
import { readEmissionMesh } from './assets/emissionMesh';
import { readMeshBuffer } from './assets/meshBuffer';
import { meshEmission } from './assets/emission';
import type { EmissionSampler, EmissionSurfaces, EmitterSurfaces } from './engine/simulation/emissionSurface';

export type LoadFailure = 'missing' | 'invalid' | 'unsupported' | 'closed';
export class VfxLoadError extends Error {
  constructor(readonly reason: LoadFailure, detail: string) { super(`vfx-ltk:${reason}:${detail}`); }
}
/**
 * An attached-mesh emitter that names a static mesh (`mSimpleMeshName`, a `.scb`) rather than its host's own skin.
 *
 * The attached kind draws the host's skinned body at the particle's scale, and such an emitter carries the scale meant for
 * its own small mesh: Sevika's punch hit BUBBLE_START1 (the bubble, 12×) drew a 4–12× purple copy of the struck unit
 * (#588, 11-10 a96aac47 recording), and Renata's empowered attack missile (d7729373 Alpha_Bullet/Add_Bullet, her
 * canister at 1.2 × 1.2 × 2.3) would stretch her body the same way. These three are the only such emitters in Set 13;
 * every other attached-mesh emitter names no mesh or the host's own `.skn` and stays at most 1.1× (11-10 audit).
 * They are left undrawn like a muted emitter.
 */
export function attachedMeshOfItsOwn(emitter: { readonly quadType: number | null; readonly mesh: { readonly skinned: boolean } | null }): boolean {
  return emitter.quadType === QUAD_TYPE.attachedMesh && emitter.mesh !== null && !emitter.mesh.skinned;
}
/**
 * An attached-mesh emitter whose look needs a frozen pose (afterimages: GhostImages, AvatarDash) or a dissolve, which
 * the live-pose overlay cannot show. Phase two of the attached-mesh work (11-11, Fable). Until then it still draws as a
 * body that follows its host, as it did before (the 11-11 audit: skipping it emptied Illaoi's cued eefae499), and is
 * listed in the system's notes.
 */
export function attachedMeshDeferred(emitter: { readonly quadType: number | null; readonly name: string | null }): boolean {
  return emitter.quadType === QUAD_TYPE.attachedMesh && /ghostimage|avatardash|dissolve/i.test(emitter.name ?? '');
}
/**
 * An attached-mesh emitter that draws its host's own skin. The geometry it names, if any, is the host's `.skn`, which the
 * overlay borrows from the live model; the vfx export does not carry it, so it is never loaded as a mesh of its own.
 */
export function attachedToHost(emitter: { readonly quadType: number | null }): boolean {
  return emitter.quadType === QUAD_TYPE.attachedMesh;
}
export interface VfxIndex {
  version: 1;
  systems: Record<string, string>;
  /** Original, case-insensitive League path -> converted file relative to vfx-ltk/. */
  assets: Record<string, string>;
  /** Presentation seconds relative to cast, not authoritative damage scheduling. */
  skills: Record<string, readonly TimelineCue[] | undefined>;
  /** Small root catalogue; each champion retains the existing per-index limits. */
  champions?: Record<string, string>;
}
export interface VfxReader {
  readJson(url: string): Promise<unknown>;
  readTexture(url: string): Promise<Texture>;
  /** One static mesh in viewport (mirrored X), original game units, no board scale baked in. */
  readMesh?(url: string): Promise<BufferGeometry>;
  /** Original converted LTKG/LTKS/LTKA bytes, through the host's local asset cache. */
  readBinary?(url: string): Promise<ArrayBuffer>;
}
export interface PreparedVfx {
  model: ReturnType<typeof readVfxSystem>;
  drawn: readonly DrawnEmitter[];
  samplers: ReadonlyMap<string, EmitterSamplers>;
  meshes: ReadonlyMap<string, BufferGeometry>;
  poses?: ReadonlyMap<string, Pose>;
  surfaces?: EmissionSurfaces;
  /** An original empty definition is an intentional no-op, never a failed replacement. */
  empty?: boolean;
  /**
   * What this system loads without: `reflection-cube:<emitter>` (a reflection map that is no cube strip, drawn without
   * its reflection) and `attached-deferred:<emitter>` (see attachedMeshDeferred, drawn as before). Logged once per system when loaded.
   */
  notes?: readonly string[];
  /** Trail emitters, by name, whose head fades out once the strand stops growing (cue-overrides.ts TRAIL_END_FADE, a fit). */
  endFade?: ReadonlySet<string>;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const hash = (v: unknown) => typeof v === 'string' && /^0x[\da-f]{8}$/i.test(v);
const nullableText = (v: unknown) => v === null || typeof v === 'string';

/** Paths never escape the configured asset root, including encoded traversal and URL schemes. */
export function vfxUrl(root: string, path: string): string {
  if (!path || /[\\?#:%]/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new VfxLoadError('invalid', 'asset-path');
  }
  return `${root.replace(/\/?$/, '/')}vfx-ltk/${path}`;
}

/** Bounded validation before the upstream parser touches arrays, hashes or recursive child trees. */
export function validateSystem(value: unknown): asserts value is VfxSystem {
  if (!record(value) || !hash(value.entry) || !hash(value.classHash) || !nullableText(value.name) || !nullableText(value.class)
    || !Array.isArray(value.materials) || value.materials.length !== 0) {
    // Translated/custom material programs require the desktop shader service; fail to legacy rather than approximate them.
    throw new VfxLoadError(record(value) && Array.isArray(value.materials) && value.materials.length ? 'unsupported' : 'invalid', 'system-envelope');
  }
  let nodes = 0;
  const walk = (node: unknown, depth: number): void => {
    if (++nodes > 20_000 || depth > 64 || !record(node)) throw new VfxLoadError('invalid', 'value-tree-limit');
    const fail = () => { throw new VfxLoadError('invalid', `value-${String(node.type)}`); };
    switch (node.type) {
      case 'null': case 'none': case 'undrawn': return;
      case 'bool': if (typeof node.value !== 'boolean') fail(); return;
      case 'number': if (node.value !== null && !finite(node.value)) fail(); return;
      case 'string': if (typeof node.value !== 'string') fail(); return;
      case 'vector': case 'matrix':
        if (!Array.isArray(node.values) || (node.type === 'matrix' ? node.values.length !== 16 : ![2, 3, 4].includes(node.values.length))
          || !node.values.every(n => n === null || finite(n))) fail(); return;
      case 'hash': case 'link': if (!hash(node.hash) || !nullableText(node.name)) fail(); return;
      case 'asset': if (typeof node.path !== 'string' || (node.asset !== null && !record(node.asset))) fail(); return;
      case 'struct': {
        if (!hash(node.classHash) || !nullableText(node.class) || !Array.isArray(node.fields)
          || (node.object !== null && (!record(node.object) || !hash(node.object.entry) || !nullableText(node.object.name)))) fail();
        const fields = node.fields as unknown[], seen = new Set<string>();
        for (const field of fields) {
          if (!record(field) || !hash(field.hash) || !nullableText(field.name)) fail();
          const held = field as Record<string, unknown>;
          const key = String(held.hash).toLowerCase(); if (seen.has(key)) fail(); seen.add(key); walk(held.value, depth + 1);
        }
        return;
      }
      case 'container': if (!Array.isArray(node.items)) fail(); for (const child of node.items as unknown[]) walk(child, depth + 1); return;
      case 'map':
        if (!Array.isArray(node.entries)) fail();
        for (const entry of node.entries as unknown[]) { if (!record(entry) || typeof entry.key !== 'string') fail(); walk((entry as Record<string, unknown>).value, depth + 1); } return;
      default: fail();
    }
  };
  walk(value.root, 0);
  if (!record(value.root) || value.root.type !== 'struct') throw new VfxLoadError('invalid', 'system-root');
}

export function parseIndex(raw: unknown): VfxIndex {
  if (!record(raw) || raw.version !== 1 || !record(raw.systems) || !record(raw.assets) || !record(raw.skills)) throw new VfxLoadError('invalid', 'index');
  if (Object.keys(raw.systems).length > 128 || Object.keys(raw.assets).length > 2048) throw new VfxLoadError('invalid', 'index-limit');
  for (const paths of [raw.systems, raw.assets]) for (const path of Object.values(paths)) {
    if (typeof path !== 'string') throw new VfxLoadError('invalid', 'index-path'); vfxUrl('', path);
  }
  for (const [champion, cues] of Object.entries(raw.skills)) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(champion) || !Array.isArray(cues) || cues.length === 0 || cues.length > 12) throw new VfxLoadError('invalid', 'skill');
    for (const cue of cues) {
      if (!record(cue) || typeof cue.system !== 'string' || !Object.hasOwn(raw.systems, cue.system)
        || !['cast-start', 'hit', 'projectile', 'link'].includes(String(cue.event)) || !finite(cue.delay) || Number(cue.delay) < 0 || Number(cue.delay) > 10
        || !finite(cue.duration) || Number(cue.duration) <= 0 || Number(cue.duration) > 10
        || (cue.bone !== undefined && typeof cue.bone !== 'string')
        || (cue.targetBone !== undefined && typeof cue.targetBone !== 'string')
        || (cue.primary !== undefined && typeof cue.primary !== 'boolean')
        || (cue.location !== undefined && cue.location !== 'board')
        || (cue.targetLimit !== undefined && (!Number.isInteger(cue.targetLimit) || Number(cue.targetLimit) < 1 || Number(cue.targetLimit) > 8))
        || (cue.optional !== undefined && (typeof cue.optional !== 'boolean' || cue.event === 'cast-start'))
        || (cue.stationary !== undefined && (typeof cue.stationary !== 'boolean' || cue.event !== 'projectile'))
        || (cue.action !== undefined && (typeof cue.action !== 'string' || !['attack', 'cast', 'passive', 'end'].includes(cue.action)))
        || (cue.variant !== undefined && (typeof cue.variant !== 'string' || !['empowered', 'self'].includes(cue.variant)))
        || (cue.branch !== undefined && (typeof cue.branch !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(cue.branch)))
        || (cue.stopAfter !== undefined && (!finite(cue.stopAfter) || Number(cue.stopAfter) < 0 || Number(cue.stopAfter) > Number(cue.duration)))
        || (cue.fadeOut !== undefined && (typeof cue.fadeOut !== 'boolean' || cue.stopAfter === undefined))
        || (cue.refresh !== undefined && (typeof cue.refresh !== 'boolean' || cue.event !== 'cast-start'))
        || (cue.main !== undefined && typeof cue.main !== 'boolean')
        || (cue.together !== undefined && !(typeof cue.together === 'string' && /^[a-z][a-z0-9-]{0,15}$/.test(cue.together)))
        || ((cue.rowToEnd !== undefined || cue.rowSpeed !== undefined || cue.rowBeyond !== undefined) && (cue.rowSide === undefined || (cue.rowToEnd !== undefined && typeof cue.rowToEnd !== 'boolean')
          || (cue.rowBeyond !== undefined && !(cue.rowToEnd === true && finite(cue.rowBeyond) && Number(cue.rowBeyond) >= 0 && Number(cue.rowBeyond) <= 1))
          || (cue.rowSpeed !== undefined && !(finite(cue.rowSpeed) && Number(cue.rowSpeed) >= 1 && Number(cue.rowSpeed) <= 40))))
        || ((cue.rowSide !== undefined || cue.rowCells !== undefined) && (cue.event !== 'projectile' || (cue.rowSide !== -1 && cue.rowSide !== 1)
          || !finite(cue.rowCells) || Number(cue.rowCells) < 0.5 || Number(cue.rowCells) > 8))
        || (cue.fromAbove !== undefined && (cue.event !== 'projectile' || cue.rowSide !== undefined || !Array.isArray(cue.fromAbove) || cue.fromAbove.length !== 3
          || !cue.fromAbove.every(finite) || Number(cue.fromAbove[1]) < 1 || Number(cue.fromAbove[1]) > 10
          || Math.abs(Number(cue.fromAbove[0])) > 4 || Math.abs(Number(cue.fromAbove[2])) > 4))
        || (cue.hide !== undefined && (!Array.isArray(cue.hide) || cue.hide.length === 0 || cue.hide.length > 8 || !cue.hide.every(name => typeof name === 'string' && name.length > 0 && name.length <= 64)))
        || (cue.scale !== undefined && !(finite(cue.scale) && Number(cue.scale) >= 0.05 && Number(cue.scale) <= 5))
        || (cue.event === 'projectile' && (!finite(cue.travelSeconds) || Number(cue.travelSeconds) <= 0 || Number(cue.travelSeconds) > Number(cue.duration)))) {
        throw new VfxLoadError('invalid', 'timeline-cue');
      }
    }
  }
  if (raw.champions !== undefined) {
    if (!record(raw.champions) || Object.keys(raw.champions).length > 128) throw new VfxLoadError('invalid', 'champions');
    for (const [id, path] of Object.entries(raw.champions)) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || typeof path !== 'string' || !path.endsWith('/index.json')) throw new VfxLoadError('invalid', 'champion-path');
      vfxUrl('', path);
    }
  }
  const assets: Record<string, string> = Object.create(null);
  for (const [name, path] of Object.entries(raw.assets)) {
    if (Object.hasOwn(assets, name.toLowerCase())) throw new VfxLoadError('invalid', 'duplicate-asset');
    assets[name.toLowerCase()] = path as string;
  }
  return { version: 1, systems: raw.systems as Record<string, string>, assets,
    skills: { ...convertedTimelines(raw.systems as Record<string, string>), ...raw.skills as VfxIndex['skills'] },
    ...(raw.champions ? { champions: raw.champions as Record<string, string> } : {}) };
}

/**
 * The index a library plays: reviewed in-repo replacements (cue-overrides.ts) win over the exported timelines, and
 * reviewed additions (CUE_ADDITIONS) are appended to whichever list stands, and display branches the export never had
 * (CUE_EXTRA_SKILLS) are added beside their champion's list.
 */
export function withCueOverrides(index: VfxIndex): VfxIndex {
  let skills: VfxIndex['skills'] | null = null;
  for (const champion of Object.keys(index.skills)) {
    const override = cueOverride(champion, index.systems), added = cueAdditions(champion, index.systems);
    if (override || added.length) (skills ??= { ...index.skills })[champion] = [...(override ?? index.skills[champion] ?? []), ...added];
    const branched = withCueBranches(champion, (skills ?? index.skills)[champion]);
    if (branched) (skills ??= { ...index.skills })[champion] = branched;
  }
  // Repository display branches (CUE_EXTRA_SKILLS) join an index that has their champion and every system they name.
  for (const [key, cues] of Object.entries(CUE_EXTRA_SKILLS)) {
    if (Object.hasOwn(index.skills, key) || !Object.hasOwn(index.skills, key.split('-')[0]!)) continue;
    if (cues.every(cue => Object.hasOwn(index.systems, cue.system))) (skills ??= { ...index.skills })[key] = cues;
  }
  return skills ? { ...index, skills } : index;
}

export interface VfxLibraryOptions { groundPass?: boolean; directory?: string }
export function createVfxLibrary(root: string, reader: VfxReader, options: VfxLibraryOptions = {}): VfxLibrary {
  let closed = false, current: VfxIndex | null = null;
  const documents = new Map<string, Promise<PreparedVfx>>(), textures = new Map<string, Promise<Texture>>(), meshes = new Map<string, Promise<BufferGeometry>>();
  const prepared = new Map<string, PreparedVfx>();
  const ownedTextures = new Set<Texture>(), ownedGeometry = new Set<BufferGeometry>();
  const children = new Map<string, VfxLibrary>();
  const urlOf = (path: string) => vfxUrl(root, (options.directory ?? '') + path);
  const converted = new Map<string, Promise<ConvertedMesh>>(), cubes = new Map<string, Promise<Texture | null>>();
  const birthMeshes = new Map<string, Promise<EmissionSampler>>();
  const black = new DataTexture(new Uint8Array(4), 1, 1); black.needsUpdate = true;
  const ensureOpen = () => { if (closed) throw new VfxLoadError('closed', 'library'); };
  const texture = (url: string) => {
    let held = textures.get(url);
    if (!held) { held = reader.readTexture(url).then(t => { if (closed) { t.dispose(); ensureOpen(); } ownedTextures.add(t); t.colorSpace = NoColorSpace; t.flipY = false; t.minFilter = LinearFilter; t.needsUpdate = true; return t; }); textures.set(url, held); }
    return held;
  };
  const cube = (url: string) => {
    let held = cubes.get(url);
    // A map that loads but cannot be cut into faces (no 1:6 strip, or an image with no drawable source) answers
    // null: the emitter then draws without its reflection. A map that fails to load still fails the system.
    if (!held) { held = texture(url).then(source => { try { return reflectionCube(source); } catch { return null; } })
      .then(t => { if (t && closed) { t.dispose(); ensureOpen(); } if (t) ownedTextures.add(t); return t; }); cubes.set(url, held); }
    return held;
  };
  const assetPath = (named: NamedAsset) => {
    const path = current?.assets[named.path.toLowerCase()];
    if (!path) throw new VfxLoadError('missing', `asset:${named.path}`); return urlOf(path);
  };
  async function load(id: string): Promise<PreparedVfx> {
    ensureOpen(); const index = await ready; ensureOpen();
    if (!index || !Object.hasOwn(index.systems, id)) throw new VfxLoadError('missing', id);
    let held = documents.get(id);
    if (held) return held;
    held = (async () => {
      const raw = await reader.readJson(urlOf(index.systems[id])); ensureOpen(); validateSystem(raw);
      const parsed = readVfxSystem(raw), disabled = DISABLED_EMITTERS[id], whole = ATTACHED_WHOLE_BODY[id];
      const model = disabled || whole ? { ...parsed, emitters: parsed.emitters.map(e => disabled?.includes(e.name ?? '') ? { ...e, disabled: true }
        : whole?.includes(e.name ?? '') ? { ...e, attachedSubmeshes: null } : e) } : parsed;
      const listed = drawnEmitters(model, true);
      // A mesh primitive that names no mesh draws nothing in the game either (Darius's Q_Heal FunnelTop1, 11-06).
      // After the phase checks below, it is left undrawn instead of failing the whole system back to the legacy ring.
      // A muted emitter (cue-overrides.ts) is left undrawn the same way, and so is an attached-mesh emitter that names a
      // static mesh of its own (attachedMeshOfItsOwn).
      // Held-back attached overlays (cue-overrides.ts ATTACHED_HELD_BACK) are left undrawn the same way.
      const muted = [...(MUTED_EMITTERS[id] ?? []), ...(ATTACHED_HELD_BACK[id] ?? [])];
      const notes: string[] = [];
      for (const { emitter: e } of listed) if (!e.disabled && attachedMeshDeferred(e)) notes.push(`attached-deferred:${e.name}`);
      const drawn = listed.filter(({ emitter: e }) => !(e.quadType === QUAD_TYPE.mesh && e.mesh === null && !e.childSet)
        && !muted.includes(e.name ?? '') && !attachedMeshOfItsOwn(e));
      if (listed.length > 64 || model.buildUpTime > 2 || !Number.isFinite(model.buildUpTime)) throw new VfxLoadError('unsupported', 'system-budget');
      // Check the entire child tree before reading assets or publishing a replacement.
      // Upstream's negative ground order alone cannot sort against both opaque hexes
      // and a transparent arena grid. Only a host providing the separate floor,
      // ground and character passes opts in; other consumers keep legacy intact.
      // The host has no particle shadow-map pass either; a shadow-only system must
      // not become a successful but invisible replacement (or leak into colour).
      for (const { emitter: e } of listed) {
        if (e.disabled) continue;
        if (!options.groundPass && (e.groundLayer || e.renderPhaseOverride === RENDER_PHASE.groundLayer)) throw new VfxLoadError('unsupported', 'ground-layer');
        if (e.renderPhaseOverride === RENDER_PHASE.shadow) throw new VfxLoadError('unsupported', 'shadow-only');
      }
      const empty = !drawn.some(d => !d.emitter.disabled);
      const samplers = new Map<string, EmitterSamplers>(), geometry = new Map<string, BufferGeometry>(), poses = new Map<string, Pose>();
      const surfaces = new Map<string, Map<number, EmitterSurfaces>>();
      const emission = async (named: NamedAsset, submeshes: readonly string[] = []) => {
        if (!reader.readBinary) throw new VfxLoadError('unsupported', 'surface-binary-reader');
        const mesh = readMeshBuffer(await reader.readBinary(assetPath(named))); ensureOpen();
        if (mesh.skinIndices) throw new VfxLoadError('unsupported', 'surface-skin-pose');
        return meshEmission(mesh, submeshes);
      };
      for (const { key, path, emitter: e } of drawn) {
        if (e.disabled) continue;
        if (e.childSet?.children.some(child => child === null) || e.hudLayer
          || !(drawsAsQuad(e) || drawsAsProjection(e) || drawsAsTrail(e) || drawsAsBeam(e) || drawsAsMesh(e) || drawsTheAttachment(e)) && !e.childSet) {
          throw new VfxLoadError('unsupported', `emitter:${e.name}`);
        }
        if (e.emissionMesh || e.emissionSurface) {
          const surface = e.emissionSurface;
          if (e.emissionMesh && !reader.readBinary) throw new VfxLoadError('unsupported', 'emission-mesh-binary-reader');
          if (surface && !reader.readBinary) throw new VfxLoadError('unsupported', 'surface-binary-reader');
          if (surface && (surface.kind !== 'mesh' || !surface.mesh || surface.skeleton || surface.joints.length))
            throw new VfxLoadError('unsupported', 'surface-host-pose');
          // Mesh bytes stay on the birth-mesh loop below. This pass only installs the surface so that loop can keep it.
          if (surface) {
            const sampled = await emission(surface.mesh!, surface.submeshes);
            let held = surfaces.get(path); if (!held) surfaces.set(path, held = new Map());
            held.set(e.index, { mesh: held.get(e.index)?.mesh ?? null, surface: sampled });
          }
        }
        const slots = { base: e.texture, mult: e.multTexture, color: e.colorTexture, palette: e.palette?.texture ?? null, erosion: e.erosion?.map ?? null,
          normal: e.distortion?.map ?? null, reflection: e.reflection?.map ?? null };
        const bundle: EmitterSamplers = { base: black, mult: null, color: null, palette: null, erosion: null, normal: null, reflection: null };
        for (const [slot, named] of Object.entries(slots)) if (named) {
          const url = assetPath(named);
          let loaded: Texture | null;
          if (slot !== 'reflection') loaded = await texture(url);
          else {
            // A reflection map the converter did not write as a cube strip drops only the reflection; the fill and rim still
            // draw. Defensive: the deployed PNG strips (all 1:6) cut fine (11-11 audit on live assets). Listed in notes.
            loaded = await cube(url);
            if (!loaded) notes.push(`reflection-cube:${e.name}`);
          }
          ensureOpen(); (bundle as unknown as Record<string, Texture | null>)[slot] = loaded;
        }
        samplers.set(key, bundle);
        if (e.mesh && !attachedToHost(e)) {
          if (reader.readBinary) {
            const signature = JSON.stringify(e.mesh) + (e.mesh.animationVariants.length ? key : '');
            let held = converted.get(signature);
            if (!held) {
              held = readConvertedMesh(e.mesh, path => reader.readBinary!(assetPath({ path, asset: null })), key)
                .then(mesh => { if (closed) { mesh.geometry.dispose(); ensureOpen(); } ownedGeometry.add(mesh.geometry); return mesh; });
              converted.set(signature, held);
            }
            const mesh = await held; ensureOpen(); geometry.set(key, mesh.geometry);
            if (mesh.pose) poses.set(key, mesh.pose);
            continue;
          }
          if (e.mesh.skinned || e.mesh.submeshes.length || e.mesh.submeshesAlways.length) throw new VfxLoadError('unsupported', 'binary-mesh-reader');
          if (!reader.readMesh || !e.mesh.path) throw new VfxLoadError('unsupported', 'mesh-reader');
          const url = assetPath({ path: e.mesh.path, asset: e.mesh.asset });
          let mesh = meshes.get(url);
          if (!mesh) { mesh = reader.readMesh(url).then(g => { if (closed) { g.dispose(); ensureOpen(); } ownedGeometry.add(g); return g; }); meshes.set(url, mesh); }
          geometry.set(key, await mesh); ensureOpen();
        }
      }
      for (const { emitter: e, path } of drawn) {
        if (e.disabled || !e.emissionMesh) continue;
        if (!reader.readBinary) throw new VfxLoadError('unsupported', 'emission-mesh-binary-reader');
        const url = assetPath(e.emissionMesh.mesh);
        let pending = birthMeshes.get(url);
        if (!pending) { pending = reader.readBinary(url).then(readEmissionMesh); birthMeshes.set(url, pending); }
        const sampler = await pending; ensureOpen();
        let system = surfaces.get(path); if (!system) { system = new Map(); surfaces.set(path, system); }
        system.set(e.index, { mesh: sampler, surface: system.get(e.index)?.surface ?? null });
      }
      if (notes.length) console.warn(`vfx-ltk:${id}:${notes.join(',')}`);
      const result = { model, drawn, samplers, meshes: geometry, poses, surfaces, empty, ...(notes.length ? { notes } : {}), ...(TRAIL_END_FADE[id] ? { endFade: new Set(TRAIL_END_FADE[id]) } : {}) }; prepared.set(id, result); return result;
    })().catch(error => {
      if (error instanceof VfxLoadError) throw error;
      throw new VfxLoadError('missing', error instanceof Error ? error.message : String(error));
    });
    documents.set(id, held); return held;
  }
  const ready = reader.readJson(urlOf('index.json')).then(parseIndex).then(withCueOverrides).then(index => { ensureOpen(); current = index; return index; }).catch(() => null);
  return {
    ready, load, get: (id: string) => prepared.get(id), get index() { return current; },
    async champion(id: string): Promise<VfxLibrary | null> {
      const index = await ready; if (closed || !index) return null;
      const path = index.champions?.[id];
      if (!path) return Object.hasOwn(index.skills, id) ? this : null;
      let child = children.get(id);
      if (!child) {
        child = createVfxLibrary(root, reader, { ...options, directory: (options.directory ?? '') + path.slice(0, -'index.json'.length) });
        children.set(id, child);
      }
      await child.ready; return closed ? null : child;
    },
    dispose() {
      if (closed) return; closed = true; black.dispose();
      for (const child of children.values()) child.dispose(); children.clear();
      // Release settled GPU resources before the host resets renderer.properties.
      // Pending reads release themselves in their closed checks when they arrive.
      for (const t of ownedTextures) t.dispose();
      for (const g of ownedGeometry) g.dispose();
      ownedTextures.clear(); ownedGeometry.clear();
      converted.clear(); cubes.clear(); birthMeshes.clear();
      textures.clear(); meshes.clear(); documents.clear(); prepared.clear(); current = null;
    },
  };
}
export interface VfxLibrary {
  ready: Promise<VfxIndex | null>; load(id: string): Promise<PreparedVfx>; get(id: string): PreparedVfx | undefined;
  readonly index: VfxIndex | null; champion(id: string): Promise<VfxLibrary | null>; dispose(): void;
}
export type { VfxValue };
