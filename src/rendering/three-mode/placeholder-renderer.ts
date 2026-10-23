/**
 * The 3D chunk's MountRenderer3d. The file keeps its original name because three-loader.ts imports it and
 * tests/rendering3d-mode.test.ts mocks that path; it is no longer only a placeholder.
 *
 * It draws the BoardScene feed (board-feed.ts) with the src/rendering3d core: hex board and bench, one piece per
 * 2D token at the same logical position (x→x, y→z), ModelCache leases with UnitActionState/UnitAnimationMixer
 * driven by display combat events. Without an asset root, or when the manifest cannot be read, pieces are
 * team-coloured pawns; missing models keep those pawns, with a portrait badge for summons when available.
 * Pointer input on the 3D board is replayed through BoardControls (hit volumes for units, the board plane for drop points):
 * BoardScene runs its own drag rules and session commands, so this layer never issues a command or reads rules itself.
 */
import { createReferenceBurst, createRenataShield, renataShieldTarget, renataRadius, RENATA_IMPACT_DELAY } from './reference-fx';
import { prepareRenataModel } from './renata-glass';
import { createRenataMissile, RENATA_LAUNCH_DELAY } from './renata-missile';
import { planActionEffects, type EffectPlayback } from './action-effect-plan';
import { installHudStyle } from './hud-style';
import {
  AmbientLight, LoopRepeat, Box3, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Frustum, Group, Matrix4, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Plane, Sphere, Raycaster, RingGeometry, SRGBColorSpace, Scene, SphereGeometry, Sprite, SpriteMaterial, TextureLoader, Vector2, Vector3, WebGLRenderer,
  type Object3D, type Texture,
} from 'three';
import {
  ModelCache, UnitActionState, UnitAnimationMixer, assetUrl, createActionEffectResolver, createStarMark, hexCenter,
  type AnimationEvent, type HexGrid, type ModelLease, type ParticleEffect, type StarMark,
} from '../../rendering3d';
import type { BoardDropHint, BoardFeed, BoardFrame, BoardLegendWalk, BoardPiece, BoardScreenBox } from '../board-feed';
import type { DisplayCombatEvent } from '../../presentation/combat-display';
import type { MountRenderer3d, Renderer3d } from './contract';
import { AssetPreloader, describePreload, openAssetStore, readPackList, readPrecacheList } from './asset-preload';
import { createAssetReader, type AssetReader, type ModelTiming } from './asset-reader';
import { LEGEND_MODEL, createTabletop } from './tabletop';
import { createCarouselStage } from './carousel-stage';
import { offerLegendPicker } from './legend-picker';
import { createTraitProps } from './trait-props';
import { DEFAULT_BOARD, arenaBench, createBoardArena, type BoardArena } from './board-arena';
import { createScoutStage } from './scout-stage';
import { DEFAULT_METER_COLORS, createUnitOverhead, type MeterColors, type UnitOverhead } from './unit-overhead';
import { ENVELOPE_ACTIONS, LOOPING_ACTIONS, animationEnvelope, animationEnvelopeSliced, fitModel, readUnitScale, standingFeet, type Envelope } from './model-fit';
import { HeadingTurn, desiredHeading, restHeading } from './unit-facing';
import { CastLunge, castLungeFor } from './cast-lunge';
import { createEffectLibrary } from './effect-library';
import { createLoadReport, createModelWarmup } from './model-warmup';
import { createModelRetention, releaseAfterUpload } from './model-memory';
import { isLegendModel } from './legend-load';

const MANIFEST_TIMEOUT_MS = 4000;
/** precache.json (~0.5 MB) and packs.json over a slow tunnel can take several seconds; timing out would silently
 * drop to the unversioned, unpacked per-file path, so they get longer and one more try. */
const INDEX_TIMEOUT_MS = 20000;
/** Placeholder pawn size in board units (2D logical pixels); a hex is 2 × hexRadius (68) tall and √3 × 68 wide. */
const PAWN_HEIGHT = 56, PAWN_WIDTH = 40;
/**
 * League models are scaled to their full bbox height (D7 build-report: jinx 234, vi 213 source units), so every
 * champion stands this tall. Width is capped at 110 (just under a hex, √3 × 68 ≈ 118, and fits a bench slot), so
 * short wide models (Urgot, Corki) stay in their own cell; tested locally on the 60 real models, slim ones (Jinx, Vi)
 * are unchanged by the cap.
 */
const MODEL_HEIGHT = 92, MODEL_WIDTH = 110;
/** Seconds a dying piece stays up when its model has no death clip (or is a pawn). */
const DEATH_FALLBACK_SECONDS = 1.2;
/** Seconds for a piece to glide to a new token position; the 2D tween itself is 0.22 s. */
const FOLLOW_SECONDS = 0.12;
const TEAM_COLOR = { player: '#3d8fd1', enemy: '#d1504a' } as const;
const ANIMATION_EVENTS = new Set(['movement', 'death', 'unitRevived', 'attack', 'cast', 'packetDamage', 'heal']);
/** CSS pixels before a press becomes a drag; BoardScene's own threshold is 6. */
const DRAG_THRESHOLD = 6;
/** The dragged piece floats this far above the board. */
const DRAG_LIFT = 10;
const DROP_COLOR = { allowed: '#68ddd0', refused: '#f08080' } as const;
/** Live action effects at most; later ones are dropped rather than queued. */
const MAX_EFFECTS = 48;
/**
 * Action effects started per frame at most, and waiting at most (a burst of casts spreads over a few frames instead of
 * stalling one); one still waiting STALE_SECONDS past its time is dropped, as its moment has gone.
 */
const MAX_STARTS_PER_FRAME = 6, MAX_QUEUED = 64, STALE_SECONDS = 0.3;
/** A batch of combat events spanning more ticks than this (catching up after dropped frames) plays effects for its last ticks only. */
const EFFECT_TICKS = 2;
/** A combat step lands every MOVE_INTERVAL_TICKS (250 ms): a run must outlast it, or the piece drops to idle between cells. */
const ACTION_CONFIG = { durations: { move: 0.3 } };
/** League game units -> board units for particle effects, the same for every champion so a shared effect keeps its
 * authored size. Median of 92 / model height over the 60 all-anim models (0.438; p10 0.31, p90 0.64), 2026-10-20.
 * Models are height-normalised, so following each body's own scale made small champions' effects up to 3x larger. */
const FX_SCALE = 0.44;
/**
 * PvE monsters (docs/ASSETS3D_NEUTRALS.md): target height and ground offset as fractions of MODEL_HEIGHT, scaled from
 * the GLB box once per lease with no width cap (wolves' tails and the dragon's wings span cells; visual only). Ranged
 * minions are set lower than the doc's 0.57 because their bind pose is low (idle ≈ 0.77): 0.43 stands about as tall
 * as a melee minion. The dragon keeps its idle flight height (no offset). A monster missing here is fitted as a champion.
 */
const MONSTER_FIT: Readonly<Record<string, { readonly height: number; readonly lift: number }>> = {
  'pve-minion-melee': { height: 0.57, lift: -0.03 }, 'pve-minion-ranged': { height: 0.43, lift: 0.02 },
  'pve-krug': { height: 0.78, lift: 0.03 },
  'pve-wolf-large': { height: 0.87, lift: 0.01 }, 'pve-wolf-small': { height: 0.52, lift: 0.04 },
  'pve-razorbeak-large': { height: 0.87, lift: 0.1 }, 'pve-razorbeak-small': { height: 0.48, lift: 0.05 },
  'pve-elder-dragon': { height: 1.52, lift: 0 }, 'pve-rift-herald': { height: 1.36, lift: 0.01 },
};
/** Minion tiers A/B/C share one look: 'pve-minion-melee-b' → 'pve-minion-melee'. */
const monsterFit = (definitionId: string) => MONSTER_FIT[definitionId] ?? MONSTER_FIT[definitionId.replace(/-[a-c]$/, '')];
/** Overhead star row: each star this many board units wide, its center this far above the body's top. */
const STAR_SIZE = 12, STAR_GAP = 12;
/** Target-anchored effects sit this high on the target (board units), roughly its chest. */
const IMPACT_HEIGHT = MODEL_HEIGHT * 0.45;
/** A piece's hit cylinder radius as a fraction of hexRadius: neighbouring cells (√3 × r apart) and bench slots stay apart. */
const PICK_RADIUS = 0.8;
/** Board units the camera fit adds beyond the near (bench) edge: a piece ring's outer radius (33) and a little. */
const FRAME_NEAR_PAD = 36;
/** Fit-then-centre passes for the camera framing (each pass shrinks the off-centre left by the previous one). */
const FRAME_PASSES = 4;
/** A bench cell marker's side as a fraction of the cell spacing (square, as TFT draws its bench). */
const BENCH_CELL_FILL = 0.88;

/**
 * How close a ray (unit direction) passes to a piece's upright axis, the segment from `base` up `height`. A piece is under the pointer when the distance is within its pick
 * radius (a capsule around the axis, so the star row on top counts too).
 */
function axisDistance(origin: Vector3, direction: Vector3, base: Vector3, height: number): number {
  const ox = origin.x - base.x, oz = origin.z - base.z;
  const a = direction.x * direction.x + direction.z * direction.z;
  // Where the ray passes the vertical line closest (seen from above), then clamped onto the segment.
  let t = a > 1e-12 ? Math.max(0, -(ox * direction.x + oz * direction.z) / a) : 0;
  const y = origin.y + direction.y * t, clamped = Math.min(base.y + height, Math.max(base.y, y));
  if (clamped !== y) {
    // Above or below the segment: the ray's closest point to that end instead.
    const ex = base.x - origin.x, ey = clamped - origin.y, ez = base.z - origin.z;
    t = Math.max(0, ex * direction.x + ey * direction.y + ez * direction.z);
    return Math.hypot(origin.x + direction.x * t - base.x, origin.y + direction.y * t - clamped, origin.z + direction.z * t - base.z);
  }
  return Math.hypot(ox + direction.x * t, oz + direction.z * t);
}

// Injected by three-loader.ts: a static import would make Rollup move board-feed.ts (also used by BoardScene)
// into this chunk and the 2D entry would then load the whole 3D chunk.
let feed: BoardFeed | null = null;
let reducedMotion = () => false;
export function useReducedMotion(read: () => boolean): void { reducedMotion = read; }
export function useBoardFeed(next: BoardFeed): void { feed = next; }
// Injected the same way: the shell's one-line preload status (asset-preload.ts describePreload).
// `fraction` is the share downloaded while a download runs (the shell's progress bar), null once there is none.
let assetProgress: ((text: string, fraction: number | null) => void) | null = null;
export function useAssetProgress(next: (text: string, fraction: number | null) => void): void { assetProgress = next; }
// Injected the same way: models a game is likely to show first (the cheapest shop tiers), warmed while idle.
let warmModels: readonly string[] = [];
export function useWarmModels(next: readonly string[]): void { warmModels = next; }
// Injected the same way: what the shell does when this renderer's WebGL context was lost and came back (mount a fresh
// one); each renderer keeps the one set when it mounted.
let contextRestored: (() => void) | null = null;
export function useContextRestored(next: () => void): void { contextRestored = next; }
// Injected the same way: the 2D theme's star color (presentation/theme.ts starColor), so 2D and 3D stars match.
let starColorFor: (level: number) => string = () => '#ffd34d';
export function useStarColor(next: (level: number) => string): void { starColorFor = next; }
// Injected the same way: the 2D theme's cost color (presentation/theme.ts costColor) for the carousel's cost rings.
let costColorFor: ((cost: number) => string) | undefined;
export function useCostColor(next: (cost: number) => string): void { costColorFor = next; }
// Injected the same way: the 2D theme's meter colors (presentation/theme.ts THEME.color), so 2D and 3D bars match.
let meterColors: MeterColors = DEFAULT_METER_COLORS;
export function useMeterColors(next: MeterColors): void { meterColors = next; }
// Injected the same way: the 2D bundle's item icon URL (presentation/s13-assets.ts), for a scouted seat's items.
let itemIconFor: (id: string) => string | null = () => null;
export function useItemIcon(next: (id: string) => string | null): void { itemIconFor = next; }
let championIconFor: (id: string) => string | null = () => null;
export function useChampionIcon(next: (id: string) => string | null): void { championIconFor = next; }

type Models = { cache: ModelCache; status: 'assets'; detail: string; preloader: AssetPreloader; reader: AssetReader; preloaded: Promise<unknown> }
  | { cache: null; status: 'placeholder'; detail: string; preloader: null; reader: null; preloaded: null };

const fetchJson = async (url: string, timeoutMs = MANIFEST_TIMEOUT_MS): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`http-${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
};
/** An index file, or null when the root has none (HTTP error); a timeout or dropped link gets one more try. */
const fetchIndex = async (url: string): Promise<unknown> => {
  for (let attempt = 0; ; attempt++) {
    try { return await fetchJson(url, INDEX_TIMEOUT_MS); }
    catch (error) { if (attempt >= 1 || /^http-\d+$/.test((error as Error)?.message ?? '')) return null; }
  }
};

async function openModels(assetBase: string | null, renderer: WebGLRenderer, onProgress?: (text: string, fraction: number | null) => void,
  onModel?: ModelTiming): Promise<Models> {
  const none = (detail: string): Models => ({ cache: null, status: 'placeholder', detail, preloader: null, reader: null, preloaded: null });
  if (!assetBase) return none('未配置 3D 素材，显示占位棋子');
  let manifest: unknown;
  try { manifest = await fetchJson(`${assetBase}manifest.json`); }
  catch (error) {
    const status = /^http-(\d+)$/.exec((error as Error)?.message ?? '')?.[1];
    return none(status ? `素材清单读取失败（HTTP ${status}），显示占位棋子` : '素材地址无法访问或清单格式不符，显示占位棋子');
  }
  try {
    // Everything under the root goes through the preloader; the cache keeps models it has already decoded.
    let preloader: AssetPreloader | null = null;
    const reader = createAssetReader(renderer, url => preloader!.read(url.slice(assetBase.length)), onModel);
    // Once on the GPU a model's CPU-side copies go (model-memory.ts), except little legends: the lobby's legend picker
    // draws those with a renderer of its own, which uploads them again.
    const legendUrls = new Set<string>();
    const cache = new ModelCache(manifest, assetBase, url => reader.readModel(url).then(model => {
      const renata = cache.manifest.models.renata;
      if (renata && url === assetUrl(assetBase, renata.path)) prepareRenataModel(model.scene);
      if (!legendUrls.has(url)) releaseAfterUpload(model.scene);
      return model;
    }));
    for (const [id, entry] of Object.entries(cache.manifest.models)) if (isLegendModel(id)) legendUrls.add(assetUrl(assetBase, entry.path));
    const list = readPrecacheList(await fetchIndex(`${assetBase}precache.json`), cache.manifest);
    // Optional: a root without packs.json (or with one that disagrees with precache) downloads file by file.
    const packs = readPackList(await fetchIndex(`${assetBase}packs.json`), list);
    const store = await openAssetStore();
    preloader = new AssetPreloader(assetBase, list, store, { packs });
    if (onProgress) preloader.onProgress(progress => onProgress(describePreload(progress), progress.state !== 'downloading' ? null
      : progress.totalBytes > 0 ? progress.readyBytes / progress.totalBytes : progress.readyFiles / Math.max(1, progress.totalFiles)));
    void navigator.storage?.persist?.().catch(() => false);
    const preloaded = preloader.start().catch(() => null);
    return { cache, status: 'assets', detail: `已读取素材清单（${Object.keys(cache.manifest.models).length} 个模型）`, preloader, reader, preloaded };
  } catch {
    return none('素材地址无法访问或清单格式不符，显示占位棋子');
  }
}

/** Preview staging for one effect (assets3d action-bindings.json `playback`); approximate, not gameplay timing. */
type ResolveEffects = (unit: string, action: 'attack' | 'cast') => readonly { id: string }[];
interface ActionEffectPlan { resolve: ResolveEffects; playback: Record<string, EffectPlayback> }

/** Optional: an asset root whose manifest names actionEffects plays them on attack/cast; anything unreadable plays none. */
async function openActionEffects(models: Models, assetBase: string | null): Promise<ActionEffectPlan | null> {
  if (!models.cache || !assetBase || !models.cache.manifest.actionEffects) return null;
  try {
    const resolve = createActionEffectResolver(models.cache.manifest);
    const playback: Record<string, EffectPlayback> = {};
    const response = await fetch(`${assetBase}action-bindings.json`, { cache: 'no-cache' }).catch(() => null);
    const entries = response?.ok ? (await response.json() as { playback?: unknown }).playback : null;
    if (entries && typeof entries === 'object') for (const [id, raw] of Object.entries(entries as Record<string, Record<string, unknown>>)) {
      const anchor = raw.anchor, delay = Number(raw.delay), maxDuration = Number(raw.maxDuration);
      if ((anchor !== 'source' && anchor !== 'target' && anchor !== 'projectile') || !(delay >= 0) || !(maxDuration > 0)) continue;
      playback[id] = { anchor, bone: typeof raw.bone === 'string' ? raw.bone : undefined, delay, maxDuration };
    }
    return { resolve, playback };
  } catch { return null; }
}

interface PieceView {
  readonly root: Group; readonly ring: Mesh; state: UnitActionState;
  /**
   * Overhead stars, a scene child that follows `root` each frame (kept out of root so its bounds stay ring and body).
   * Null on a PvE monster: as in TFT, monsters carry only their health bar.
   */
  stars: StarMark | null; starHeight: number;
  /** HP/mana bars and worn items over the head (unit-overhead.ts); a scene child placed each frame like the stars. */
  readonly overhead: UnitOverhead;
  body: Object3D | null; lease: ModelLease | null; mixer: UnitAnimationMixer | null; team: BoardPiece['team'];
  definitionId: string; target: Vector3; placed: boolean; disposed: boolean;
  /** False while BoardScene reports the unit dead in the shown combat; a dead piece is never picked. */
  alive: boolean;
  starLevel: number; form: 'front' | 'back';
  /** Seconds the death action still has to play while dead (0 = hidden); 'loading' until its model can play it. */
  dyingFor: number | 'loading' | null;
  /**
   * The model's world scale when it is drawn at its official unitScale (model-fit.ts), else null. The caster's own
   * effects (on its bones or launched from them) then share it, as the skin scale sizes the whole character.
   */
  modelScale: number | null;
  /** The unit it last attacked or cast on in the shown combat (null: none, itself, or gone): it turns to look at it. */
  facing: string | null;
  /** Its root's rotation.y, turned smoothly (unit-facing.ts). */
  readonly turn: HeadingTurn;
  /** 家人团聚 easter egg in planning: its model's dance clip ('clip') or, without one, a hop in place ('hop'). */
  dance: 'clip' | 'hop' | null;
  /** A cast drawn as a dash toward its target (cast-lunge.ts): only the body is offset, never the root. */
  lunge: CastLunge | null;
  /** The body-local (x, z) offset the lunge has put on `body`, taken off again before the body changes. */
  lungeOffset: { x: number; z: number };
}
function deathSeconds(view: PieceView): number {
  const lease = view.lease, name = lease?.animationNames.death ?? 'death';
  const clip = lease?.animations.find(candidate => candidate.name === name);
  return clip && clip.duration > 0 ? clip.duration : DEATH_FALLBACK_SECONDS;
}

/** Scales a model to `height` (and at most `width` across when given), feet on y=0 (D7 keeps League units; see planning/3d). */
function fit(body: Object3D, height: number, width = Infinity): Object3D {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3());
  const scale = Math.min(size.y > 0 ? height / size.y : Infinity, Math.max(size.x, size.z) > 0 ? width / Math.max(size.x, size.z) : Infinity);
  if (!Number.isFinite(scale)) return body;
  body.scale.multiplyScalar(scale);
  body.position.y -= box.min.y * scale;
  return body;
}

export const mountRenderer3d: MountRenderer3d = async (host, options) => {
  installHudStyle();
  const renderer = new WebGLRenderer({ antialias: true });
  // First-batch load report (model-warmup.ts): model reads are keyed back to their manifest id by path.
  // One report per match: a new match (body[data-m6-mode] turning active) starts it again.
  let loadReport = createLoadReport(), timeUpload = false, reported = false;
  const modelByUrl = new Map<string, string>();
  delete (globalThis as { __render3dLoad?: unknown }).__render3dLoad;
  const models = await openModels(options.assetBase, renderer, assetProgress ?? undefined,
    (url, readMs, parseMs) => loadReport.read(modelByUrl.get(url) ?? url, readMs, parseMs));
  if (models.cache) for (const [id, entry] of Object.entries(models.cache.manifest.models)) modelByUrl.set(assetUrl(models.cache.root, entry.path), id);
  const actionEffects = await openActionEffects(models, options.assetBase);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'render3d-canvas';
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#101923');
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(-200, 600, 300);
  scene.add(sun);
  const camera = new PerspectiveCamera(36, 1, 1, 5000);

  // Shared geometry/materials owned by this renderer; model templates are owned by the ModelCache.
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(resource: T): T => { owned.push(resource); return resource; };
  const pawnBody = own(new CylinderGeometry(9, 13, 34, 16)), pawnHead = own(new SphereGeometry(10, 16, 12));
  const ringGeometry = own(new RingGeometry(18, 23, 32));
  const teamMaterial = {
    player: own(new MeshStandardMaterial({ color: TEAM_COLOR.player, roughness: 0.6 })),
    enemy: own(new MeshStandardMaterial({ color: TEAM_COLOR.enemy, roughness: 0.6 })),
  };
  const ringMaterial = {
    player: own(new MeshStandardMaterial({ color: TEAM_COLOR.player, emissive: TEAM_COLOR.player, emissiveIntensity: 0.4 })),
    enemy: own(new MeshStandardMaterial({ color: TEAM_COLOR.enemy, emissive: TEAM_COLOR.enemy, emissiveIntensity: 0.4 })),
  };

  // Every lease on a model goes through the retention (model-memory.ts), so a template nothing shows is let go after a
  // while; little legends stay (few, and the lobby's picker shares them), and so do the models the room's current warm
  // hints name (board-feed warmHints: the shop and what comes next), as if leased. An evicted model is no longer warmed:
  // the next match's warm list reads and uploads it again (its envelope numbers stay).
  const pinned = (id: string) => isLegendModel(id) || !!feed?.warmHints?.()?.ids.includes(id);
  const retention = models.cache ? createModelRetention(models.cache, { pinned, onEvict: id => warmup?.forget(id) }) : null;
  const loadModel = retention ? (id: string) => retention.load(id) : null;
  // Online 选秀 (carousel-stage.ts): its own scene and camera, drawn instead of the board while board-feed carries one.
  // Every effect on this renderer (combat, carousel, tabletop, trait props) reads its files once (effect-library.ts).
  const effects = models.cache && options.assetBase ? createEffectLibrary(models.cache.manifest, options.assetBase, models.reader) : null;
  // Models warmed while idle (model-warmup.ts): little legends first, then the cheapest shop tiers, once the preload has
  // finished (on a first visit the reads would compete with the download). Its textures and programs go to the GPU here.
  // A compile in flight when the renderer goes: dispose waits for it (three polls the programs until they are ready).
  let compiling: Promise<unknown> | null = null;
  const uploadModel = async (lease: ModelLease) => {
    const started = performance.now();
    lease.scene.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) renderer.initTexture(value as Texture);
    });
    const compile = renderer.compileAsync(lease.scene, camera, scene);
    compiling = compile.catch(() => {}).finally(() => { if (compiling === settled) compiling = null; });
    const settled = compiling;
    await compile;
    return performance.now() - started;
  };
  // Animation envelope per model id (model-fit.ts), shared by the warm-up (measured in idle slices) and mounting.
  const envelopes = new Map<string, Envelope>();
  const envelopeClips = (lease: ModelLease) => {
    const nameOf = (action: string) => lease.animationNames[action as keyof typeof lease.animationNames] ?? action;
    const names = new Set(ENVELOPE_ACTIONS.map(nameOf));
    return lease.animations.filter(clip => names.has(clip.name))
      // Every combat clip also sets the feet (its lowest point net of root motion), in the same pass as the width.
      .map(clip => ({ clip, loop: ENVELOPE_ACTIONS.some(action => LOOPING_ACTIONS.has(action) && nameOf(action) === clip.name), ground: true,
        feet: clip.name === nameOf('idle') }));
  };
  const prepareEnvelope = async (id: string, lease: ModelLease): Promise<boolean> => {
    if (envelopes.has(id) || !readUnitScale(models.cache?.manifest.models, id)) return true; // only official-scale models use it
    const envelope = await animationEnvelopeSliced(lease.scene, envelopeClips(lease), { budgetMs: 3, stop: () => closed || !!fighting });
    if (envelope === null) return false;
    if (!envelopes.has(id)) envelopes.set(id, envelope);
    return true;
  };
  const warmup = retention ? createModelWarmup({ load: id => retention.load(id), has: id => Object.hasOwn(models.cache!.manifest.models, id),
    upload: uploadModel, prepare: prepareEnvelope, busy: () => !!fighting }) : null;
  const warmList = () => {
    const legends = feed?.legends?.();
    return [LEGEND_MODEL, ...[legends?.me, legends?.opponent].filter((id): id is string => !!id).map(id => `little-legend-${id}`), ...warmModels];
  };
  let preloaded = false, hintVersion = 0;
  void models.preloaded?.then(() => { preloaded = true; if (!closed) warmup?.want(warmList()); });
  // Match edges (body[data-m6-mode]): entering a match starts a fresh first-batch report and asks for anything not yet
  // warmed; leaving one (back to the lobby or the start screen) drops what was still waiting. Before the first match the
  // lobby warms from the preload above.
  const inMatch = () => typeof document === 'undefined' || document.body?.dataset?.m6Mode === 'active';
  let matchShown = inMatch();
  const followMatch = () => {
    const now = inMatch();
    if (now === matchShown) return;
    matchShown = now;
    if (now) {
      loadReport = createLoadReport(); reported = false; timeUpload = false;
      delete (globalThis as { __render3dLoad?: unknown }).__render3dLoad;
      if (preloaded) warmup?.want(warmList());
    } else warmup?.cancel();
  };
  const loadEffect = effects && models.cache!.manifest.effects ? (id: string, maxDuration: number) => {
    if (!models.cache!.manifest.effects?.[id]) return Promise.reject(new Error('unknown-effect'));
    return effects.load(id, maxDuration);
  } : null;
  const stage = createCarouselStage({ championHeight: MODEL_HEIGHT, championWidth: MODEL_WIDTH, sourceScale: FX_SCALE, legendModel: LEGEND_MODEL,
    loadModel, hasModel: id => !!models.cache && Object.hasOwn(models.cache.manifest.models, id),
    unitScale: id => readUnitScale(models.cache?.manifest.models, id), envelope: (id, lease) => envelopeOf(id, lease),
    loadEffect, starColor: level => starColorFor(level), costColor: cost => costColorFor?.(cost) ?? '#9aa4ae', onReleased: () => flashCallout('可以选了') });
  // One line flashed low in the middle of the 3D view (my carousel release); made on first use, removed with the renderer.
  let callout: HTMLElement | null = null, calloutTimer: ReturnType<typeof setTimeout> | undefined;
  const flashCallout = (text: string) => {
    if (typeof document === 'undefined') return;
    if (!callout) { callout = document.createElement('div'); callout.className = 'render3d-callout'; callout.dataset.debug = 'render3d-callout'; host.append(callout); }
    callout.textContent = text;
    callout.classList.remove('flash'); void callout.offsetWidth; callout.classList.add('flash');
    clearTimeout(calloutTimer); calloutTimer = setTimeout(() => callout?.classList.remove('flash'), 1800);
  };
  // 河灵, my orbs and the settled-round HP bolt around the board (tabletop.ts); same asset root and effect scale.
  // Each side's own little legend (board-feed legends) when the root has it, else the default 河灵.
  const legendModel = (side: 'me' | 'opponent') => {
    const named = feed?.legends?.()[side], id = named ? `little-legend-${named}` : LEGEND_MODEL;
    return models.cache && Object.hasOwn(models.cache.manifest.models, id) ? id : LEGEND_MODEL;
  };
  const tabletop = createTabletop({ scene, camera, championHeight: MODEL_HEIGHT, effectScale: FX_SCALE, own, legendModel,
    loadModel: models.cache && Object.hasOwn(models.cache.manifest.models, LEGEND_MODEL) ? loadModel : null,
    loadEffect, claimOrb: orbId => feed?.controls()?.claimOrb?.(orbId) });
  // The lobby's 外观 panel (legend-picker.ts) draws the root's legends; offered only while this layer has an asset root.
  const withdrawPicker = models.cache ? offerLegendPicker(feed, models.cache) : () => {};
  // 铁血征服者 chest and 微光 flask on the left of my half (trait-props.ts), from my own counters only.
  const traitProps = createTraitProps({ scene, camera, effectScale: FX_SCALE, own, loadEffect,
    loadModel: loadModel ? id => Object.hasOwn(models.cache!.manifest.models, id) ? loadModel(id) : Promise.reject(new Error('unknown-model')) : null });
  const boardGroup = new Group(), boardBox = new Box3();
  // Look from the player's side with a TFT-like tilt; back off until board and bench fit both ways.
  const VIEW = new Vector3(0, 1.32, 0.98).normalize();
  // Fills the board box (#board-root): the board, bench and table props, the near edge padded for the rings under the
  // bench pieces, as large as they fit. The camera keeps its tilt; it moves to the closest distance at which every corner
  // projects inside the frame, then slides along its own up/right axes so the drawn extents sit centred (a tilted board
  // is wider at its near edge, so centring on the box's middle left the top of the frame empty). A few passes settle both.
  const fitCorners = Array.from({ length: 8 }, () => new Vector3()), cameraSpace = new Vector3(), cameraAxis = new Vector3();
  const frameCamera = () => {
    if (boardBox.isEmpty()) return;
    const target = boardBox.getCenter(new Vector3()), size = boardBox.getSize(new Vector3());
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const place = (distance: number) => { camera.position.copy(target).addScaledVector(VIEW, distance); camera.lookAt(target); camera.updateMatrixWorld(); };
    const { min, max } = boardBox, near = max.z + FRAME_NEAR_PAD;
    fitCorners.forEach((corner, i) => corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? near : min.z));
    /** The corners' frame extents in NDC (-1..1 fits), or null when one is behind the camera. */
    const extents = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const corner of fitCorners) {
        cameraSpace.copy(corner).applyMatrix4(camera.matrixWorldInverse);
        const depth = -cameraSpace.z;
        if (depth <= 0) return null;
        const x = cameraSpace.x / (depth * tan * camera.aspect), y = cameraSpace.y / (depth * tan);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };
    const fits = (distance: number) => { place(distance); const e = extents(); return !!e && e.x0 >= -1 && e.x1 <= 1 && e.y0 >= -1 && e.y1 <= 1; };
    let distance = Math.max(size.x * 0.54 / (tan * camera.aspect), size.z * 0.5 * VIEW.y / tan + size.z * 0.5 * VIEW.z);
    for (let pass = 0; pass < FRAME_PASSES; pass++) {
      let high = distance;
      for (let i = 0; i < 16 && !fits(high); i++) high *= 1.25;
      let low = high / 4;
      for (let i = 0; i < 4 && fits(low); i++) { high = low; low /= 4; }
      for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (fits(mid)) high = mid; else low = mid; }
      distance = high;
      place(distance);
      const e = extents();
      if (!e) break;
      // Shift the look point by the extents' off-centre (NDC × the half-frame at that depth, the target's depth).
      target.addScaledVector(cameraAxis.set(1, 0, 0).applyQuaternion(camera.quaternion), (e.x0 + e.x1) / 2 * tan * camera.aspect * distance);
      target.addScaledVector(cameraAxis.set(0, 1, 0).applyQuaternion(camera.quaternion), (e.y0 + e.y1) / 2 * tan * distance);
    }
    // The last shift moved the extents: back off just enough that they still fit.
    for (let i = 0; i < 16 && !fits(distance); i++) distance *= 1.02;
    place(distance);
  };
  scene.add(boardGroup);
  // The original arena under the grid (manifest `boards`); the procedural tiles then become a faint cell overlay.
  const arenaGroup = new Group();
  scene.add(arenaGroup);
  let lastFrame: BoardFrame | null = null;
  const boardEntry = models.cache?.manifest.boards?.[DEFAULT_BOARD];
  const arena: BoardArena | null = boardEntry && models.cache ? createBoardArena(arenaGroup, boardEntry.alignment,
    () => loadModel!(DEFAULT_BOARD), () => { boardKey = ''; if (lastFrame) buildBoard(lastFrame); }, boardEntry.grid) : null;
  let boardKey = '';
  /**
   * The arena's own bench cells (alignment.bench) while the arena is drawn, else null: bench pieces stand there instead
   * of on the 2D bench coordinates, and points over them are handed back to BoardScene as its own bench slots.
   */
  let benchSlots: Vector3[] | null = null;
  /** Index of the slot within half a slot spacing of (x, z), or -1. */
  const nearestSlot = (slots: readonly { x: number; z: number }[], x: number, z: number): number => {
    let best = -1, bestDistance = Infinity, spacing = Infinity;
    for (let i = 1; i < slots.length; i++) spacing = Math.min(spacing, Math.hypot(slots[i]!.x - slots[i - 1]!.x, slots[i]!.z - slots[i - 1]!.z));
    const reach = Number.isFinite(spacing) && spacing > 0 ? spacing / 2 : (lastFrame?.hexRadius ?? 34);
    slots.forEach((slot, i) => { const d = Math.hypot(slot.x - x, slot.z - z);
      // Cells are squares, as drawn below; their corners must not fall through to the board plane.
      if (Math.abs(slot.x - x) <= reach && Math.abs(slot.z - z) <= reach && d < bestDistance) { best = i; bestDistance = d; } });
    return best;
  };
  const benchOf2d = (frame: BoardFrame, x: number, y: number) => nearestSlot(frame.bench.map(point => ({ x: point.x, z: point.y })), x, y);
  /**
   * The arena bench cell under the current ray (`ray` already set from the pointer), or -1: each cell is met on its
   * own floor height, so a raised strip is not read through the y=0 board plane (off by its height × the view slope).
   */
  const benchCellPlane = new Plane(new Vector3(0, 1, 0), 0), benchCellPoint = new Vector3();
  const arenaBenchAtRay = (): number => {
    if (!benchSlots) return -1;
    let best = -1, bestDistance = Infinity;
    benchSlots.forEach((slot, i) => {
      benchCellPlane.constant = -slot.y;
      if (!ray.ray.intersectPlane(benchCellPlane, benchCellPoint)) return;
      if (nearestSlot(benchSlots!, benchCellPoint.x, benchCellPoint.z) !== i) return;
      const d = Math.hypot(benchCellPoint.x - slot.x, benchCellPoint.z - slot.z);
      if (d < bestDistance) { best = i; bestDistance = d; }
    });
    return best;
  };
  const buildBoard = (frame: BoardFrame) => {
    lastFrame = frame;
    arena?.place(frame);
    const overlay = !!arena?.ready;
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}|${frame.bench.length}|${overlay}`;
    if (key === boardKey) return;
    boardKey = key;
    benchSlots = overlay && boardEntry ? arenaBench(boardEntry.alignment, frame) : null;
    boardGroup.clear();
    const tile = own(new CylinderGeometry(frame.hexRadius * 0.95, frame.hexRadius * 0.95, 6, 6)); // six segments start at +z: pointy-top
    // Over the arena the tiles only mark the cells (thin, translucent, above its floor); without it they are the board.
    const tileLook = (color: string) => overlay
      ? { color, roughness: 0.85, transparent: true, opacity: 0.22, depthWrite: false } : { color, roughness: 0.85 };
    const own0 = own(new MeshStandardMaterial(tileLook('#2d5c7a')));
    const foe = own(new MeshStandardMaterial(tileLook('#5a3a48')));
    const grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.columns; col++) {
      const mesh = new Mesh(tile, row < frame.rows / 2 ? foe : own0);
      mesh.position.copy(hexCenter({ col, row }, grid)).setY(overlay ? 1 : -3);
      if (overlay) mesh.scale.y = 0.2;
      boardGroup.add(mesh);
    }
    // The arena has its own bench strip; the slot boxes are only drawn on the procedural board.
    const slot = own(new BoxGeometry(48, 4, 56)), slotMaterial = own(new MeshStandardMaterial({ color: '#25313d', roughness: 0.9 }));
    for (const point of overlay ? [] : frame.bench) {
      const mesh = new Mesh(slot, slotMaterial);
      mesh.position.set(point.x, -2, point.y);
      boardGroup.add(mesh);
    }
    // Over the arena's own bench cells: a faint square per cell (as the hexes above are marked), sized to the cell spacing.
    if (benchSlots && benchSlots.length > 1) {
      const side = Math.hypot(benchSlots[1]!.x - benchSlots[0]!.x, benchSlots[1]!.z - benchSlots[0]!.z) * BENCH_CELL_FILL;
      const square = own(new BoxGeometry(side, 1.2, side)), squareMaterial = own(new MeshStandardMaterial(tileLook('#2d5c7a')));
      for (const point of benchSlots) {
        const mesh = new Mesh(square, squareMaterial);
        mesh.position.set(point.x, point.y + 1, point.z);
        boardGroup.add(mesh);
      }
    }
    boardBox.setFromObject(boardGroup);
    // Same camera framing with or without the arena: the bench still counts when its boxes are not drawn.
    for (const point of overlay ? frame.bench : []) boardBox.expandByPoint(new Vector3(point.x, 0, point.y));
    for (const point of benchSlots ?? []) boardBox.expandByPoint(point);
    for (const point of [...tabletop.layout(frame), ...traitProps.layout(frame)]) boardBox.expandByPoint(point);
    frameCamera();
  };

  const pieces = new Map<string, PieceView>();
  // Item icons are the 2D bundle's image URLs; one texture per URL for every piece, released with the renderer.
  const itemTextures = new Map<string, Promise<Texture | null>>();
  let closed = false;
  // A lost context that comes back cannot re-upload models whose CPU copies were emptied (model-memory.ts): the shell
  // mounts a fresh renderer instead, which reads them again from the local store.
  const restored = contextRestored;
  renderer.domElement.addEventListener('webglcontextrestored', () => { if (!closed) restored?.(); });
  const textureLoader = new TextureLoader();
  const overheadContext = {
    colors: () => meterColors,
    itemTexture: (url: string) => {
      let texture = itemTextures.get(url);
      if (!texture) {
        texture = textureLoader.loadAsync(url).then(loaded => {
          // Arrived after the player left 3D: owned resources are already released, so this one goes too.
          if (closed) { loaded.dispose(); return null; }
          loaded.colorSpace = SRGBColorSpace; return own(loaded);
        }).catch(() => null);
        itemTextures.set(url, texture);
      }
      return texture;
    },
  };
  // 3D 看对手 (scout-stage.ts): another seat's public build on this board while board-feed carries one; my pieces,
  // surroundings and effects are hidden meanwhile and the board takes no input.
  const scout = createScoutStage({ scene, championHeight: MODEL_HEIGHT, championWidth: MODEL_WIDTH, pawnHeight: PAWN_HEIGHT, pawnWidth: PAWN_WIDTH,
    unitScale: id => readUnitScale(models.cache?.manifest.models, id), sourceScale: FX_SCALE, envelope: (id, lease) => envelopeOf(id, lease),
    loadModel, legendModel: legend => {
      if (!models.cache || !Object.hasOwn(models.cache.manifest.models, LEGEND_MODEL)) return null;
      const id = legend ? `little-legend-${legend}` : LEGEND_MODEL;
      return Object.hasOwn(models.cache.manifest.models, id) ? id : LEGEND_MODEL;
    },
    myLegend: () => feed?.legends?.().me ?? null,
    starColor: level => starColorFor(level), overhead: overheadContext, itemIcon: id => itemIconFor(id), own });
  let scoutView: Parameters<typeof scout.show>[0] = null;
  const pawnFor = (team: BoardPiece['team'], definitionId: string): Object3D => {
    const pawn = new Group();
    pawn.name = 'render3d-pawn';
    const body = new Mesh(pawnBody, teamMaterial[team]); body.position.y = 17;
    const head = new Mesh(pawnHead, teamMaterial[team]); head.position.y = 42;
    pawn.add(body, head);
    const icon = definitionId.startsWith('g23-') ? championIconFor(definitionId) : null;
    if (icon) {
      pawn.name = `render3d-fallback-${definitionId}`;
      const material = own(new SpriteMaterial({ color: '#ffffff' })), badge = new Sprite(material);
      badge.position.y = 42; badge.scale.set(38, 38, 1); badge.visible = false; pawn.add(badge);
      void overheadContext.itemTexture(icon).then(texture => {
        if (!texture || closed) return;
        material.map = texture; material.needsUpdate = true; badge.visible = true; head.visible = false;
      });
    }
    return fit(pawn, PAWN_HEIGHT, PAWN_WIDTH);
  };
  /** Animation envelope radius per model id (unscaled source units), measured on its first lease. */
  /** Models first seen during a shown combat: drawn from their bind box, measured and re-attached at the next preparation. */
  const envelopePending = new Set<string>();
  const envelopeOf = (id: string, lease: ModelLease): Envelope | undefined => {
    let envelope = envelopes.get(id);
    if (envelope === undefined && fighting) { envelopePending.add(id); return undefined; } // no long task mid-combat
    // Not warmed yet (the warm-up measures in slices ahead of time): measured now, at once.
    if (envelope === undefined) { envelope = animationEnvelope(lease.scene, envelopeClips(lease)); envelopes.set(id, envelope); }
    return envelope;
  };
  // Cast lunges: the world-plane offset (x, z) is turned into the root's frame (it rotates to face) and put on the body
  // as a change from what was already applied, so the body's own fitted position is never overwritten.
  const setLungeOffset = (view: PieceView, x: number, z: number) => {
    const turn = view.root.rotation.y, cos = Math.cos(turn), sin = Math.sin(turn);
    const localX = x * cos - z * sin, localZ = x * sin + z * cos, applied = view.lungeOffset;
    if (view.body) { view.body.position.x += localX - applied.x; view.body.position.z += localZ - applied.z; }
    applied.x = localX; applied.z = localZ;
  };
  function cancelLunge(view: PieceView): void { view.lunge = null; setLungeOffset(view, 0, 0); }
  const startLunge = (sourceId: string, targetId: string | undefined) => {
    const source = pieces.get(sourceId), spec = source && castLungeFor(source.definitionId);
    const target = targetId && targetId !== sourceId ? pieces.get(targetId) : undefined;
    if (!source || !spec || !source.alive || !source.root.visible || !target?.alive) return;
    const dx = (target.target.x - source.target.x) * spec.ratio, dz = (target.target.z - source.target.z) * spec.ratio;
    if (dx * dx + dz * dz < 1) return;
    source.lunge = new CastLunge(dx, dz, spec.seconds);
  };
  const attachBody = (view: PieceView) => {
    cancelLunge(view);
    if (view.body) { view.root.remove(view.body); view.body = null; }
    view.mixer?.dispose(); view.mixer = null; view.lease?.release(); view.lease = null; view.modelScale = null; held.delete(view);
    // The team pawn stands in until the model arrives (cache miss while the preload is still running).
    view.body = pawnFor(view.team, view.definitionId); view.root.add(view.body); view.starHeight = PAWN_HEIGHT + STAR_GAP;
    if (!loadModel) return;
    const definitionId = view.definitionId;
    void loadModel(definitionId).then(lease => {
      if (view.disposed || view.definitionId !== definitionId) { lease.release(); return; }
      cancelLunge(view); // the stand-in pawn gives way: the lunge's offset never moves to the model
      view.lease = lease;
      if (lease.placeholder) {
        // The loader's diagnostic magenta cube is never a player-facing model. Keep the visible, pickable stand-in.
        if (view.dyingFor === 'loading') view.dyingFor = DEATH_FALLBACK_SECONDS;
        if (loadReport.waiting) for (const [id, other] of pieces) if (other === view) loadReport.attached(id, definitionId);
        return;
      }
      const stand = view.body;
      const monster = monsterFit(definitionId);
      const unitScale = readUnitScale(models.cache?.manifest.models, definitionId);
      if (monster && unitScale) {
        // A monster at its official scale like a champion, no width cap (wolves' tails and the dragon's wings span cells);
        // its lift stays the same share of its drawn height, and its bar sits on what is drawn.
        const before = Math.abs(lease.scene.scale.x) || 1;
        // No height cap either: the official scale is the monster's size (the dragon is 0.44 × 1.75).
        const drawn = fitModel(lease.scene, { height: Infinity, sourceScale: FX_SCALE, unitScale });
        view.body = lease.scene; lease.scene.position.y += drawn * monster.lift / monster.height;
        view.starHeight = drawn + STAR_GAP;
        view.modelScale = Math.abs(lease.scene.scale.x) / before;
      } else if (monster) {
        // The offset goes on the GLB root, which the mixer never animates (clips drive its bones).
        view.body = fit(lease.scene, MODEL_HEIGHT * monster.height); lease.scene.position.y += MODEL_HEIGHT * monster.lift;
        view.starHeight = MODEL_HEIGHT * monster.height + STAR_GAP;
      } else {
        // Official scale when the asset root has it (short champions stay short); the stars and bars follow the drawn height.
        const before = Math.abs(lease.scene.scale.x) || 1;
        // With an official scale the width cap covers everything the clips reach (measured once per model).
        // ... and its feet on the idle's lowest point (a bind pose can stand far below it: Darius, Nami floated).
        const envelope = unitScale ? envelopeOf(definitionId, lease) : undefined;
        const drawn = fitModel(lease.scene, { height: MODEL_HEIGHT, width: MODEL_WIDTH, sourceScale: FX_SCALE, unitScale,
          envelopeRadius: envelope?.radius, ground: envelope?.ground, feet: standingFeet(definitionId, envelope) });
        view.body = lease.scene;
        // Without an official scale the stars, bars and hit volume keep the old fixed baseline (older roots unchanged).
        view.starHeight = (unitScale ? drawn : MODEL_HEIGHT) + STAR_GAP;
        // The factor fitModel applied (League source units → board units, caps included), not the GLB root's own scale.
        view.modelScale = unitScale ? Math.abs(lease.scene.scale.x) / before : null;
      }
      // Remove the pawn only after fitting succeeded; a malformed model must not leave an empty ring.
      stand?.removeFromParent();
      view.root.add(lease.scene);
      view.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames, lease);
      view.state.setPlaybackResolver((action, index) => view.mixer!.resolvePlayback(action, index, { starLevel: view.starLevel, form: view.form }));
      view.mixer.apply(view.state.output);
      if (view.dyingFor === 'loading') view.dyingFor = deathSeconds(view); // the death clip starts now
      if (loadReport.waiting) for (const [id, other] of pieces) if (other === view) { loadReport.attached(id, definitionId); timeUpload = true; }
    }).catch(() => {
      // A disposed cache rejects late loads; the piece keeps its pawn (and a dying one hides).
      if (view.dyingFor === 'loading') { view.dyingFor = 0; view.root.visible = false; }
    });
  };
  // Effective stars from BoardFeed (a promoted 终极英雄 is 4); the mark only draws them. BoardFeed's `neutral` monsters get none.
  const syncStars = (view: PieceView, piece: BoardPiece) => {
    if (piece.neutral) { view.stars?.dispose(); view.stars = null; return; }
    const level = piece.effectiveStarLevel ?? piece.starLevel;
    if (view.stars) { view.stars.setLevel(level); return; }
    view.stars = createStarMark({ effectiveStarLevel: level, colorFor: starColorFor });
    view.stars.object.scale.setScalar(STAR_SIZE); scene.add(view.stars.object);
  };
  const createPiece = (piece: BoardPiece): PieceView => {
    const root = new Group();
    const ring = new Mesh(ringGeometry, ringMaterial[piece.team]);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
    root.add(ring);
    scene.add(root);
    const overhead = createUnitOverhead(overheadContext); scene.add(overhead.object);
    const view: PieceView = { root, ring, stars: null, starHeight: PAWN_HEIGHT + STAR_GAP, overhead, state: new UnitActionState(piece.id, ACTION_CONFIG), body: null, lease: null, mixer: null, team: piece.team,
      definitionId: piece.definitionId, target: new Vector3(piece.x, 0, piece.y), placed: false, disposed: false, alive: true, dyingFor: null, modelScale: null,
      starLevel: piece.starLevel, form: 'back', facing: null, turn: new HeadingTurn(restHeading(piece.team)), dance: null,
      lunge: null, lungeOffset: { x: 0, z: 0 } };
    root.rotation.y = view.turn.heading;
    attachBody(view); syncStars(view, piece);
    return view;
  };
  // Time a piece's mixer held while nobody could see it (the tick below), with the action revision and mixer it is for:
  // a new action, a new mixer or a removed piece drops it.
  const held = new WeakMap<PieceView, { seconds: number; revision: number; mixer: UnitAnimationMixer }>();
  // UnitActionState stays on death until unitRevived and ignores later events, so a unit that died must start the
  // next combat or preparation fresh. A new mixer too: the old one caches the last applied revision.
  const resetAction = (view: PieceView, id: string) => {
    held.delete(view); cancelLunge(view);
    view.state = new UnitActionState(id, ACTION_CONFIG); view.facing = null;
    view.mixer?.dispose(); view.mixer = null;
    if (view.lease) {
      view.mixer = new UnitAnimationMixer(view.lease.scene, view.lease.animations, view.lease.animationNames, view.lease);
      view.state.setPlaybackResolver((action, index) => view.mixer!.resolvePlayback(action, index, { starLevel: view.starLevel, form: view.form }));
      view.mixer.apply(view.state.output);
    }
  };
  const removePiece = (view: PieceView) => {
    cancelLunge(view); view.disposed = true; held.delete(view);
    view.mixer?.dispose(); view.lease?.release(); view.stars?.dispose(); view.stars = null; view.overhead.dispose();
    view.root.removeFromParent();
  };

  // Action effects (attack/cast): staged by render time, owned by a phase generation so a new combat, preparation or
  // dispose drops everything still queued, loading or playing.
  interface LiveEffect { fx: ParticleEffect; left: number; from?: Vector3; to?: Vector3; travel?: number; elapsed: number }
  let clock = 0, generation = 0;
  const queued: { at: number; generation: number; run: () => void }[] = [];
  const live = new Set<LiveEffect>();
  type ReferenceEffect = ReturnType<typeof createReferenceBurst> | ReturnType<typeof createRenataShield> | ReturnType<typeof createRenataMissile>;
  const referenceEffects = new Set<ReferenceEffect>();
  let saveBurst: ReturnType<typeof createReferenceBurst> | null = null, saveExpires = 0, saveGoldLeft: number | null = null;
  const addReference = (fx: ReferenceEffect) => {
    if (referenceEffects.size >= MAX_EFFECTS) { fx.dispose(); return; }
    referenceEffects.add(fx);
  };
  const clearEffects = () => {
    generation++; queued.length = 0;
    for (const effect of live) effect.fx.dispose();
    live.clear();
    for (const fx of referenceEffects) fx.dispose();
    referenceEffects.clear();
  };
  const worldPoint = (view: PieceView, bone: string | undefined, out: Vector3): boolean => {
    const node = bone ? view.body?.getObjectByName(bone) : undefined;
    if (node) { node.getWorldPosition(out); return true; }
    if (bone) return false;
    view.root.getWorldPosition(out).setY(IMPACT_HEIGHT);
    return true;
  };
  /** Local scale that gives an effect `world` scale (FX_SCALE unless the caster has an official scale) under `parent`. */
  // abs: a mirrored parent decomposes with a negative X, which would flip the effect on every axis.
  const effectScale = (parent: Object3D, world = FX_SCALE): number => world / (Math.abs(parent.getWorldScale(new Vector3()).x) || 1);
  const playEffect = (id: string, spec: EffectPlayback, sourceId: string, targetId: string | undefined, owner: number, targetPoint?: Vector3) => {
    const source = pieces.get(sourceId), target = targetId ? pieces.get(targetId) : undefined;
    if (!source?.body || live.size >= MAX_EFFECTS || !effects) return;
    if (spec.anchor !== 'source' && !target) return; // no target: never fake a projectile with the caster's own motion
    void effects.load(id, spec.maxDuration).then(fx => {
      const effect: LiveEffect = { fx, left: spec.maxDuration, elapsed: 0 };
      if (owner !== generation || source.disposed || !source.body || (target && target.disposed) || live.size >= MAX_EFFECTS) { fx.dispose(); return; }
      if (spec.anchor === 'source') {
        const node = spec.bone ? source.body.getObjectByName(spec.bone) : source.root;
        if (!node) { fx.dispose(); return; }
        fx.object.scale.setScalar(effectScale(node, source.modelScale ?? FX_SCALE));
        node.add(fx.object);
      } else {
        const from = new Vector3();
        if (spec.anchor === 'target' && targetPoint) from.copy(targetPoint);
        else if (!worldPoint(spec.anchor === 'projectile' ? source : target!, spec.anchor === 'projectile' ? spec.bone : undefined, from)) { fx.dispose(); return; }
        // A projectile is the caster's (its scale); an effect on the target stays in world units (FX_SCALE).
        fx.object.scale.setScalar(spec.anchor === 'projectile' ? source.modelScale ?? FX_SCALE : FX_SCALE);
        fx.object.position.copy(from);
        scene.add(fx.object);
        if (spec.anchor === 'projectile') {
          effect.from = from; effect.to = target!.root.position.clone().setY(IMPACT_HEIGHT); effect.travel = spec.maxDuration;
          fx.object.lookAt(effect.to);
        }
      }
      live.add(effect);
    }).catch(() => { /* a missing or invalid effect file just plays nothing */ });
  };
  const playAction = (action: 'attack' | 'cast', sourceId: string, targetId: string | undefined) => {
    const source = pieces.get(sourceId);
    if (!source?.alive) return;
    const owner = generation;
    let targetPoint: Vector3 | undefined;
    if (action === 'cast' && source.definitionId === 'renata') {
      if (!targetId || !pieces.has(targetId) || queued.length > MAX_QUEUED - 2) return;
      // One endpoint for both missile and impact, even if the target moves during the visual flight.
      const point = pieces.get(targetId)!.root.position.clone();
      targetPoint = point;
      if (!reducedMotion()) queued.push({ at: clock + RENATA_LAUNCH_DELAY, generation: owner, run: () => {
        if (source.disposed || !source.alive || reducedMotion()) return;
        const from = new Vector3();
        if (!worldPoint(source, 'C_Canister', from)) worldPoint(source, undefined, from);
        const fx = createRenataMissile(from, point.clone().setY(IMPACT_HEIGHT), grid?.radius ?? 34);
        scene.add(fx.object); addReference(fx);
      } });
      queued.push({ at: clock + RENATA_IMPACT_DELAY, generation: owner, run: () => {
        const fx = createReferenceBurst('renata', renataRadius(grid?.radius ?? 34), reducedMotion());
        fx.object.position.copy(point); scene.add(fx.object); addReference(fx);
      } });
      // Continue into the asset plan: ignition and tar complement the single procedural flight/area.
    }
    if (!actionEffects || (source.definitionId === 'renata' && reducedMotion())) return;
    for (const { id, playback: spec } of planActionEffects(source.definitionId, action, actionEffects.resolve(source.definitionId, action), actionEffects.playback)) {
      if (queued.length >= MAX_QUEUED) return;
      queued.push({ at: clock + spec.delay, generation: owner, run: () => playEffect(id, spec, sourceId, targetId, owner, targetPoint) });
    }
  };
  const updateEffects = (seconds: number) => {
    clock += seconds;
    for (const fx of referenceEffects) { fx.update(seconds, camera); if (fx.finished) { fx.dispose(); referenceEffects.delete(fx); } }
    if (saveBurst) {
      saveBurst.update(seconds);
      if (saveGoldLeft !== null && (saveGoldLeft -= seconds) <= 0) {
        saveGoldLeft = null;
        if (performance.now() < saveExpires && !reducedMotion()) tabletop.saved();
      }
      if (saveBurst.finished || performance.now() >= saveExpires) { saveBurst.dispose(); saveBurst = null; }
    }
    // Oldest first, MAX_STARTS_PER_FRAME at most; the rest wait for the next frame unless their moment has passed.
    let started = 0;
    for (let i = 0; i < queued.length;) {
      const job = queued[i]!;
      if (job.generation !== generation || clock - job.at > STALE_SECONDS) { queued.splice(i, 1); continue; }
      if (job.at <= clock && started < MAX_STARTS_PER_FRAME) { queued.splice(i, 1); started++; job.run(); continue; }
      i++;
    }
    for (const effect of live) {
      effect.elapsed += seconds; effect.left -= seconds;
      if (effect.from && effect.to && effect.travel) effect.fx.object.position.lerpVectors(effect.from, effect.to, Math.min(1, effect.elapsed / effect.travel));
      effect.fx.update(seconds, camera);
      if (effect.left <= 0 || effect.fx.finished) { effect.fx.dispose(); live.delete(effect); }
    }
  };

  let fighting: boolean | null = null, dancing: ReadonlySet<string> = new Set();
  /** Starts or stops one piece's dance: the model's celebrate (dance) clip when the asset root mapped one, else a hop. */
  const setDance = (view: PieceView, id: string, on: boolean) => {
    if (!on) { if (view.dance === 'clip') resetAction(view, id); view.dance = null; return; }
    const name = view.lease?.animationNames.celebrate, clip = name ? view.lease!.animations.find(c => c.name === name) : undefined;
    // A model swap or action reset rebuilds the mixer: the clip is started again on the new one.
    if (clip && view.mixer ? view.dance === 'clip' && view.mixer.mixer.existingAction(clip)?.isRunning() : view.dance === 'hop') return;
    // A dance starts from its own start: time the mixer held for the earlier action is dropped, and from here on its
    // frames count (held for the action revision it is shown over).
    if (clip && view.mixer) { held.set(view, { seconds: 0, revision: view.state.output.revision, mixer: view.mixer }); view.mixer.mixer.stopAllAction(); view.mixer.mixer.clipAction(clip).reset().setLoop(LoopRepeat, Infinity).play(); view.dance = 'clip'; }
    else view.dance = 'hop';
  };
  const onFrame = (frame: BoardFrame) => {
    followMatch(); // a new match's first board can arrive before this renderer's next animation frame
    buildBoard(frame);
    lastFrame = frame;
    if (scoutView && !scoutView.watching) scout.show(scoutView, frame); // a new board size relays it; the same one is kept
    grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    // BoardScene cancelled the drag itself (blur, resize, D/F, phase change, a command): let go of the pointer too.
    if (dragging && frame.dragging !== dragging) endDrag();
    const combatStarted = fighting !== true && frame.fighting;
    if (fighting !== null && fighting !== frame.fighting) { clearEffects(); for (const [id, view] of pieces) resetAction(view, id); }
    fighting = frame.fighting;
    // What the room says comes next (board-feed warm hints): queued once per change, after the preload, in a match.
    const hints = feed?.warmHints?.();
    if (hints && hints.version !== hintVersion && preloaded && matchShown && warmup) { hintVersion = hints.version; warmup.want(hints.ids); }
    // Back in preparation: measure what a combat skipped and re-attach those pieces at their full envelope.
    if (!fighting && envelopePending.size) {
      const ids = new Set(envelopePending); envelopePending.clear();
      for (const view of pieces.values()) if (ids.has(view.definitionId) && view.lease && !view.lease.placeholder) attachBody(view);
    }
    const seen = new Set<string>();
    for (const piece of frame.pieces) {
      if (!piece.definitionId || (piece.team !== 'player' && piece.team !== 'enemy')) continue;
      seen.add(piece.id);
      let view = pieces.get(piece.id);
      const created = !view;
      if (!view) { view = createPiece(piece); pieces.set(piece.id, view); }
      view.starLevel = piece.effectiveStarLevel ?? piece.starLevel;
      // Form is chosen from deployment, then frozen while combat movement changes the drawn position.
      if (!frame.fighting || combatStarted || created) {
        const middle = frame.origin.y + (frame.rows - 1) * frame.hexRadius * 1.5 / 2;
        view.form = Math.abs(piece.y - middle) < frame.hexRadius * 3 ? 'front' : 'back';
      }
      if (view.definitionId !== piece.definitionId || view.team !== piece.team) {
        view.definitionId = piece.definitionId; view.team = piece.team; view.ring.material = ringMaterial[piece.team]; attachBody(view);
      }
      syncStars(view, piece);
      view.overhead.set(piece.team, piece.alive ? piece.meters : undefined, piece.items);
      // Dying: keep the piece up until its death action has played (the death event normally starts it already).
      if (piece.alive) {
        // Revived or a new combat: never stay locked in a death pose that had not finished.
        if (!view.alive) resetAction(view, piece.id);
        view.alive = true; view.dyingFor = null;
      } else if (view.alive) {
        view.alive = false; cancelLunge(view);
        const output = view.state.consume({ type: 'death', unitId: piece.id });
        view.mixer?.apply(output);
        view.dyingFor = created ? 0 : models.cache && !view.lease ? 'loading' : deathSeconds(view);
      }
      const shown = piece.visible && (view.dyingFor === null || view.dyingFor === 'loading' || view.dyingFor > 0);
      if (shown && !view.root.visible) resetAction(view, piece.id);
      view.root.visible = shown;
      const slot = benchSlots ? (piece.id !== frame.dragging && piece.benchSlot !== undefined
        ? piece.benchSlot ?? -1 : benchOf2d(frame, piece.x, piece.y)) : -1;
      if (slot >= 0 && benchSlots?.[slot]) view.target.copy(benchSlots[slot]!); else view.target.set(piece.x, 0, piece.y);
      if (!view.placed) { view.root.position.copy(view.target); view.placed = true; }
    }
    for (const [id, view] of pieces) if (!seen.has(id)) { loadReport.dropped(id); removePiece(view); pieces.delete(id); }
    if (models.cache && matchShown && !loadReport.began) loadReport.frame([...pieces].filter(([, view]) => !view.lease).map(([id]) => id),
      [...pieces.values()].filter(view => warmup?.warmed(view.definitionId)).length);
    dancing = new Set(frame.fighting ? [] : frame.mechanics?.reunion ?? []);
    for (const [id, view] of pieces) setDance(view, id, dancing.has(id) && view.root.visible);
    tabletop.frame(frame); traitProps.frame(frame);
  };
  const face = (sourceId: string, targetId: string | undefined) => {
    const source = pieces.get(sourceId);
    // Every attack or cast replaces the target: one on itself, on nobody or on a unit not drawn leaves none to follow.
    if (source) source.facing = targetId && targetId !== sourceId && pieces.has(targetId) ? targetId : null;
  };
  const onEvents = (events: readonly DisplayCombatEvent[]) => {
    // A batch spanning many ticks is the replay catching up after dropped frames: every event still moves the action
    // states, but only its last EFFECT_TICKS start effects (the earlier ones would all burst in this one frame).
    const tickOf = (event: DisplayCombatEvent) => 'tick' in event && typeof event.tick === 'number' ? event.tick : null;
    let latest = -Infinity;
    for (const event of events) latest = Math.max(latest, tickOf(event) ?? -Infinity);
    for (const event of events) {
      const currentEffect = (tickOf(event) ?? latest) > latest - EFFECT_TICKS;
      const shieldTarget = currentEffect ? renataShieldTarget(event) : null;
      const recipient = shieldTarget ? pieces.get(shieldTarget) : undefined;
      if (recipient?.alive && recipient.root.visible) {
        const fx = createRenataShield(grid?.radius ?? 34, reducedMotion());
        recipient.root.add(fx.object); addReference(fx);
      }
      if (!ANIMATION_EVENTS.has(event.type)) continue;
      // Display events carry the replay field names UnitActionState reads; each state ignores other units' events.
      for (const view of pieces.values()) view.state.consume(event as unknown as AnimationEvent);
      const tick = tickOf(event), current = tick === null || tick > latest - EFFECT_TICKS;
      if (event.type === 'attack') { face(event.attackerId, event.targetId); if (current) playAction('attack', event.attackerId, event.targetId); }
      else if (event.type === 'cast') {
        face(event.sourceId, event.targetIds[0]);
        if (current) { playAction('cast', event.sourceId, event.targetIds[0]); startLunge(event.sourceId, event.targetIds[0]); }
      } else if (event.type === 'movement' || event.type === 'death') {
        // A real step or death takes over from a lunge at once: the body is back on the root.
        const view = pieces.get((event as { unitId: string }).unitId); if (view) cancelLunge(view);
      }
    }
    // Each mixer takes the batch's final action once (it starts only a changed one; nothing ran in between).
    for (const view of pieces.values()) if (view.dance !== 'clip') view.mixer?.apply(view.state.output);
  };
  // Hover cards and combat floats: the drawn piece's bounds (ring and body as fitted) projected to CSS pixels, asked
  // once per 2D frame; a skinned body's bounds are its cached bind-pose box, so anchors stay still while it animates.
  const corner = new Vector3(), pieceBox = new Box3();
  const screenBox = (id: string): BoardScreenBox | undefined => {
    const view = pieces.get(id), area = viewport();
    if (!view?.root.visible || area.width <= 0 || area.height <= 0) return undefined;
    camera.updateMatrixWorld();
    pieceBox.setFromObject(view.root);
    if (pieceBox.isEmpty()) return undefined;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    const { min, max } = pieceBox;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      corner.set(x, y, z).project(camera);
      if (corner.z > 1) return undefined; // behind the camera
      const cx = area.left + (corner.x + 1) / 2 * area.width, cy = area.top + (1 - corner.y) / 2 * area.height;
      left = Math.min(left, cx); right = Math.max(right, cx); top = Math.min(top, cy); bottom = Math.max(bottom, cy);
    }
    // Off the 3D canvas: nothing to point at.
    if (right < area.left || left > area.left + area.width || bottom < area.top || top > area.top + area.height) return undefined;
    return { left, top, right, bottom };
  };
  // The carousel replaces the board view: a board press or drag in progress is let go first.
  const onCarousel = (view: Parameters<typeof stage.show>[0]) => {
    if (view && !stage.active) {
      if (dragging) feed?.controls()?.dragCancel();
      feed?.controls()?.hover(null); endDrag();
    }
    if (!view && stage.active) { feed?.carouselControls?.()?.hover(null); canvas.style.cursor = ''; }
    stage.show(view);
  };
  // Scouting replaces my board the same way: let go of a press or drag first.
  const onScout = (view: Parameters<typeof scout.show>[0]) => {
    if (view && !visiting()) {
      if (dragging) feed?.controls()?.dragCancel();
      feed?.controls()?.hover(null); endDrag(); canvas.style.cursor = '';
    }
    // Another battle on the board (a watched seat's, or mine again): nothing queued or playing belongs to it.
    const watched = view?.watching ? view.seatId : null;
    if (watched !== (scoutView?.watching ? scoutView.seatId : null)) { clearEffects(); for (const [id, piece] of pieces) resetAction(piece, id); }
    // Watching its battle: that battle is on my board (the frames carry it), so no static build is drawn over it.
    scoutView = view; scout.show(view?.watching ? null : view, lastFrame);
    // My legend goes along to a drawn build: it leaves my board (no walk, no orb claims) and comes back to its own spot.
    tabletop.away(scout.active);
  };
  /** On another seat's board, its build drawn or its battle playing: the board takes no input. */
  const visiting = () => scout.active || scoutView?.watching === true;
  const mine = () => !stage.active && !visiting();
  const onLegendWalk = (walk: BoardLegendWalk) => { if (walk.scene === 'carousel') stage.walk(walk); else tabletop.walk(walk); };
  /** My legend runs onto my orb, which it claims on arrival (TFT: no click opens an orb); false when it cannot go there now. */
  const walkToOrb = (orbId: string): boolean => {
    if (stage.active || visiting()) return false;
    const walk = tabletop.walkTo({ x: 0, y: 0 }, orbId);
    if (walk) legend()?.walk({ scene: 'board', ...walk });
    return walk !== null;
  };
  const unsubscribe = feed?.subscribe({ frame: onFrame, events: onEvents, carousel: onCarousel, scout: onScout, legendWalk: onLegendWalk, playerSaved: event => {
    if (event.source !== 'mel' && !visiting()) tabletop.saved();
    if (event.source !== 'mel' || visiting() || stage.active || !lastFrame) return;
    saveBurst?.dispose();
    const f = lastFrame, spanX = Math.sqrt(3) * f.hexRadius * f.columns, spanZ = f.hexRadius * 1.5 * (f.rows - 1);
    saveBurst = createReferenceBurst('mel', Math.hypot(spanX, spanZ) * .55, reducedMotion());
    saveBurst.object.position.set(f.origin.x + (spanX - Math.sqrt(3) * f.hexRadius) / 2, 0, f.origin.y + spanZ / 2);
    scene.add(saveBurst.object); saveExpires = performance.now() + 2000; saveGoldLeft = .65;
  }, walkToOrb,
    unitAt: client => mine() ? pickUnit(client, true) ?? undefined : undefined, screenBox: id => mine() ? screenBox(id) : undefined }) ?? (() => {});

  // Pointer → BoardControls. A press on my unit selects it; moving past the threshold drags it through BoardScene,
  // which moves the 2D token (this piece follows it via the frame) and answers where a release would land.
  const canvas = renderer.domElement;
  const marker = new Mesh(own(new RingGeometry(26, 33, 6, 1, Math.PI / 2)), own(new MeshStandardMaterial({ color: DROP_COLOR.allowed,
    emissive: DROP_COLOR.allowed, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 1; marker.visible = false;
  scene.add(marker);
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0), ray = new Raycaster();
  let grid: HexGrid | null = null;
  let press: { id: string; pointerId: number; x: number; y: number } | null = null, dragging: string | null = null;
  const viewport = () => { const rect = canvas.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; };
  /**
   * The drawn piece under a point: my units for board gestures, any team for item drops (BoardScene judges the target).
   * Each piece is a hit volume, as in TFT: a capsule (PICK_RADIUS of a hex) around its upright axis from the floor to
   * its star row. Where volumes overlap the piece whose axis is drawn closest to the pointer wins, not the
   * nearest surface: a short unit in the cell in front no longer takes an item aimed at the body behind it.
   * Not the model's triangles: a skinned ray test transforms every vertex by its bones on each pointer move (15–35 ms
   * with 13 units, 2026-10-21) and only counts the model's own pixels, so gaps between limbs, the cell under the feet,
   * the star row and a body whose cached bounds went stale after it moved could not be clicked.
   */
  const pickUnit = (client: { x: number; y: number }, anyTeam: boolean): string | null => {
    const area = viewport();
    if (!grid || area.width <= 0 || area.height <= 0) return null;
    const x = (client.x - area.left) / area.width, y = (client.y - area.top) / area.height;
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
    camera.updateMatrixWorld();
    ray.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), camera);
    const radius = (grid.radius ?? 36) * PICK_RADIUS;
    // The capsule decides what is under the pointer; among those, the closest axis on screen wins (in world units a
    // piece farther from the camera would win a perspective tie it loses on screen).
    let best: string | null = null, bestDistance = Infinity;
    for (const [unitId, view] of pieces) {
      if (!view.alive || !view.root.visible || (!anyTeam && view.team !== 'player')) continue;
      if (axisDistance(ray.ray.origin, ray.ray.direction, view.root.position, view.starHeight) > radius) continue;
      const distance = screenAxisDistance(client, area, view.root.position, view.starHeight);
      if (distance < bestDistance) { best = unitId; bestDistance = distance; }
    }
    return best;
  };
  const axisFoot = new Vector3(), axisHead = new Vector3();
  /** CSS-pixel distance from a point to a piece's axis as drawn (both ends projected). */
  const screenAxisDistance = (client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number },
    base: Vector3, height: number): number => {
    const toScreen = (point: Vector3) => ({ x: area.left + (point.x + 1) / 2 * area.width, y: area.top + (1 - point.y) / 2 * area.height });
    const a = toScreen(axisFoot.copy(base).project(camera)), b = toScreen(axisHead.copy(base).setY(base.y + height).project(camera));
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length > 0 ? Math.min(1, Math.max(0, ((client.x - a.x) * dx + (client.y - a.y) * dy) / length)) : 0;
    return Math.hypot(client.x - (a.x + dx * t), client.y - (a.y + dy * t));
  };
  const unitAt = (event: PointerEvent) => pickUnit({ x: event.clientX, y: event.clientY }, false);
  const boardPoint = (event: PointerEvent): { x: number; y: number } | null => {
    const area = viewport();
    if (area.width <= 0 || area.height <= 0) return null;
    ray.setFromCamera(new Vector2((event.clientX - area.left) / area.width * 2 - 1, 1 - (event.clientY - area.top) / area.height * 2), camera);
    const point = ray.ray.intersectPlane(groundPlane, new Vector3());
    return point ? { x: point.x, y: point.z } : null;
  };
  /** The drag point as BoardScene reads it (move preview and release alike): over an arena bench cell, its 2D slot. */
  const dragPoint = (event: PointerEvent): { x: number; y: number } | null => {
    const point = boardPoint(event);
    const slot = point ? arenaBenchAtRay() : -1, bench = slot >= 0 ? lastFrame?.bench[slot] : undefined;
    return bench ? { x: bench.x, y: bench.y } : point;
  };
  const showHint = (hint: BoardDropHint) => {
    marker.visible = !!hint.target;
    if (!hint.target) return;
    const slot = hint.target.kind === 'bench' && benchSlots && lastFrame ? benchOf2d(lastFrame, hint.target.x, hint.target.y) : -1;
    if (slot >= 0 && benchSlots?.[slot]) marker.position.copy(benchSlots[slot]!).setY(benchSlots[slot]!.y + 1);
    else marker.position.set(hint.target.x, 1, hint.target.y);
    const color = hint.allowed ? DROP_COLOR.allowed : DROP_COLOR.refused;
    const material = marker.material as MeshStandardMaterial;
    material.color.set(color); material.emissive.set(color);
  };
  const endDrag = () => {
    if (press && canvas.hasPointerCapture(press.pointerId)) canvas.releasePointerCapture(press.pointerId);
    dragging = null; press = null; marker.visible = false; canvas.style.cursor = '';
  };
  const onPointerDown = (event: PointerEvent) => {
    if (stage.active) {
      if (event.button !== 0 && event.button !== 2) return;
      // Either button, as TFT's right click: on a unit I may take my legend runs to it and the room picks it when it gets
      // there (a client that cannot walk falls back to the panel's own slot click); anywhere else it walks there.
      const client = { x: event.clientX, y: event.clientY };
      const hit = stage.slotAt(client, viewport());
      if (hit?.takable) {
        event.preventDefault();
        if (!legend()?.walk({ scene: 'carousel', slot: hit.slot })) feed?.carouselControls?.()?.pick(hit.slot);
        else stage.runTo(hit.slot);
        return;
      }
      const to = stage.walkTo(client, viewport());
      if (to) { event.preventDefault(); legend()?.walk({ scene: 'carousel', to }); }
      return;
    }
    // While scouting the board is the other seat's: only a right click, which walks my visiting legend there.
    // Watching its battle takes no input at all.
    if (visiting()) {
      if (scout.active && event.button === 2) { const point = boardPoint(event); if (point && scout.walkVisitor(point)) event.preventDefault(); }
      return;
    }
    // Right click: my legend walks there (onto my orb when it is under the pointer, which it then claims).
    if (event.button === 2) {
      const point = boardPoint(event);
      const walk = point && tabletop.walkTo(point, tabletop.orbAt({ x: event.clientX, y: event.clientY }, viewport()));
      if (walk) { event.preventDefault(); legend()?.walk({ scene: 'board', ...walk }); }
      return;
    }
    if (event.button !== 0 || press) return;
    // My orb: my legend runs onto it and claims it there, as walking over it does.
    const orb = tabletop.orbAt({ x: event.clientX, y: event.clientY }, viewport());
    if (orb) { if (walkToOrb(orb)) event.preventDefault(); return; }
    const id = unitAt(event);
    if (!id) return;
    press = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (stage.active) {
      const hit = stage.slotAt({ x: event.clientX, y: event.clientY }, viewport()), slot = hit?.slot ?? null;
      stage.hover(slot); feed?.carouselControls?.()?.hover(slot);
      canvas.style.cursor = hit?.takable ? 'pointer' : '';
      return;
    }
    if (visiting()) return;
    const controls = feed?.controls();
    if (!press || event.pointerId !== press.pointerId) {
      if (press) return;
      const id = unitAt(event);
      controls?.hover(id);
      canvas.style.cursor = id ? 'grab' : tabletop.orbAt({ x: event.clientX, y: event.clientY }, viewport()) ? 'pointer' : '';
      return;
    }
    // A mouse that moves with no button held lost its release (synthetic input, a missed pointerup): end the press as a
    // cancel instead of leaving the drag and its sell hint stuck until the next click.
    if (event.pointerType === 'mouse' && event.buttons === 0) { onPointerCancel(event); return; }
    if (!dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
    if (!dragging) {
      if (!controls?.dragStart(press.id)) { endDrag(); return; }
      dragging = press.id; canvas.style.cursor = 'grabbing';
    }
    const target = dragPoint(event);
    if (target && controls) showHint(controls.dragMove(target));
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const controls = feed?.controls();
    if (dragging) controls?.dragEnd(dragPoint(event), { x: event.clientX, y: event.clientY });
    else controls?.select(press.id);
    endDrag();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (dragging) feed?.controls()?.dragCancel();
    endDrag();
  };
  const onPointerLeave = () => {
    if (stage.active) { stage.hover(null); feed?.carouselControls?.()?.hover(null); canvas.style.cursor = ''; return; }
    if (!press) { feed?.controls()?.hover(null); canvas.style.cursor = ''; }
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  // A right click walks my legend (board and carousel), and as in TFT it opens no browser menu over the game (the 3D
  // view and the panels on it) while the 3D view is up. Links, text fields and selected text keep theirs; the page
  // outside the game root is untouched.
  const onContextMenu = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.('a[href], input, textarea, [contenteditable="true"]')) return;
    if (typeof getSelection === 'function' && getSelection()?.toString()) return;
    event.preventDefault();
  };
  // The game root (#app: panels, shop, sidebars) and the canvas itself, which online moves out of it onto <body>.
  const app = typeof document === 'undefined' ? null : document.getElementById('app');
  const menuRoots: EventTarget[] = app ? [app, canvas] : [canvas];
  const legend = () => feed?.legendControls?.() ?? null;
  for (const root of menuRoots) root.addEventListener('contextmenu', onContextMenu);

  let width = 0, height = 0, frameId = 0, last = performance.now();
  // Online the layer fills the window behind the panels (style.css L12), so it moves from #board-root to <body>: inside
  // #board-frame's size container a fixed layer would stay clipped to the frame. The board keeps #board-root's box: both
  // cameras are framed for that box and offset so it lands where the box is, the rest of the window showing more scene.
  // Offline the layer stays in the board and there is no offset.
  const board = host.parentElement;
  const page = typeof document === 'undefined' ? null : document.body;
  let boxKey = '';
  const readBox = () => board?.getBoundingClientRect?.() ?? null;
  const frameBox = () => {
    const view = canvas.getBoundingClientRect?.(), box = readBox();
    boxKey = box ? `${box.left},${box.top},${box.width},${box.height}` : '';
    if (!view) return null;
    if (!box || box.width <= 0 || box.height <= 0 || (Math.abs(box.left - view.left) < 1 && Math.abs(box.top - view.top) < 1
      && Math.abs(box.width - view.width) < 1 && Math.abs(box.height - view.height) < 1)) return null;
    return { width: box.width, height: box.height, x: view.left - box.left, y: view.top - box.top };
  };
  const resize = (w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    const box = frameBox();
    camera.aspect = box ? box.width / box.height : w / h;
    if (box) camera.setViewOffset(box.width, box.height, box.x, box.y, w, h); else camera.clearViewOffset();
    frameCamera(); stage.resize(camera.aspect);
    if (box) stage.camera.setViewOffset(box.width, box.height, box.x, box.y, w, h); else stage.camera.clearViewOffset();
  };
  // Once a frame: the online page may mark itself after the mount, and the box moves without the layer resizing (the
  // left panel folding, a resized column, a scrolled page). One rect read; reframed only when it changed.
  const followBox = () => {
    if (page?.hasAttribute?.('data-online') && board && host.parentElement === board) page.append(host);
    const box = readBox();
    if (width > 0 && (box ? `${box.left},${box.top},${box.width},${box.height}` : '') !== boxKey) resize(width, height);
  };
  // TFT's FPS readout in the top-right corner, refreshed once a second.
  const fpsLabel = typeof document === 'undefined' ? null : document.createElement('span');
  if (fpsLabel) { fpsLabel.className = 'render3d-fps'; fpsLabel.dataset.debug = 'render3d-fps'; host.append(fpsLabel); }
  let fpsFrames = 0, fpsSince = 0;
  // Unused models, effect resources and KTX2 workers are let go (model-memory.ts, effect-library.ts, asset-reader.ts),
  // looked at every few seconds and never during a combat, whose effects come and go too quickly to tell idle.
  let sweptAt = 0;
  const SWEEP_MS = 5000;
  // Pieces the board camera cannot see this frame: their skeletons are not posed (the mixer holds the time and catches
  // up when they are seen again). Hidden, off the view, or the board not drawn at all (carousel, scouting).
  const frustum = new Frustum(), viewMatrix = new Matrix4(), bounds = new Sphere();
  const seen = (view: PieceView): boolean => {
    if (!view.root.visible || stage.active || scout.active) return false;
    view.root.getWorldPosition(bounds.center).setY(bounds.center.y + MODEL_HEIGHT / 2);
    bounds.radius = MODEL_HEIGHT;
    return frustum.intersectsSphere(bounds);
  };
  const tick = (now: number) => {
    frameId = requestAnimationFrame(tick);
    if (fpsLabel && ++fpsFrames && now - fpsSince >= 1000) { if (fpsSince) fpsLabel.textContent = `FPS: ${Math.round(fpsFrames * 1000 / (now - fpsSince))}`; fpsFrames = 0; fpsSince = now; }
    followMatch();
    if (!fighting && now - sweptAt >= SWEEP_MS) { sweptAt = now; retention?.sweep(); effects?.sweep(); models.reader?.trim?.(); }
    const seconds = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    const follow = 1 - Math.exp(-seconds / FOLLOW_SECONDS);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const [id, view] of pieces) {
      if (id === dragging) view.root.position.copy(view.target).setY(view.target.y + DRAG_LIFT); // follows the pointer exactly
      else {
        view.root.position.y = view.target.y; // the floor it stands on: 0, or an arena bench cell's own height
        const step = view.target.clone().sub(view.root.position), aim = view.facing ? pieces.get(view.facing) : undefined;
        const target = aim?.alive && aim.root.visible ? { x: aim.root.position.x, z: aim.root.position.z } : null;
        view.root.rotation.y = view.turn.update(desiredHeading({ team: view.team,
          alive: view.alive, fighting: !!fighting, position: { x: view.root.position.x, z: view.root.position.z },
          destination: { x: view.target.x, z: view.target.z }, target }), seconds);
        view.root.position.addScaledVector(step, follow);
        // Hop: two bounces a second, each dancer a little out of step with the next.
        if (view.dance === 'hop') view.root.position.y += Math.abs(Math.sin(now / 1000 * Math.PI * 2 + view.root.position.x / 40)) * MODEL_HEIGHT * 0.14;
      }
      if (view.lunge) { const offset = view.lunge.update(seconds); if (offset) setLungeOffset(view, offset.x, offset.z); else cancelLunge(view); }
      if (typeof view.dyingFor === 'number' && view.dyingFor > 0 && (view.dyingFor = Math.max(0, view.dyingFor - seconds)) === 0) view.root.visible = false;
      const output = view.state.update(seconds);
      if (view.mixer) {
        // Held time catches up only the action it was held for, on the same mixer: a new action starts from its own start.
        const kept = held.get(view), same = !!kept && kept.mixer === view.mixer && kept.revision === output.revision;
        if (seen(view)) { view.mixer.update(seconds + (same ? kept!.seconds : 0)); held.set(view, { seconds: 0, revision: output.revision, mixer: view.mixer }); }
        else held.set(view, { seconds: same ? kept!.seconds + seconds : 0, revision: output.revision, mixer: view.mixer });
        if (view.dance !== 'clip') view.mixer.apply(output); // a dance clip runs outside the action state
      }
      if (view.stars) {
        view.stars.object.position.copy(view.root.position).setY(view.root.position.y + view.starHeight);
        view.stars.object.visible = view.root.visible;
      }
      // Above the star row; a monster has none, so its bar takes the stars' place.
      view.overhead.object.position.copy(view.root.position)
        .setY(view.root.position.y + view.starHeight + (view.stars ? STAR_SIZE / 2 + 3 : -STAR_GAP / 2));
      view.overhead.object.visible = view.root.visible && view.overhead.drawn;
    }
    updateEffects(seconds);
    tabletop.update(seconds); traitProps.update(seconds); stage.update(seconds); scout.update(seconds); followBox();
    if (width > 0) {
      if (stage.active) renderer.render(stage.scene, stage.camera);
      else if (scout.active) {
        // Only the board, the lights and the scouted seat: my pieces, legend, orbs and effects stay out of the picture.
        const hidden = scene.children.filter(child => child !== boardGroup && child !== arenaGroup && child !== scout.group && !(child as { isLight?: boolean }).isLight && child.visible);
        for (const child of hidden) child.visible = false;
        renderer.render(scene, camera);
        for (const child of hidden) child.visible = true;
      } else if (timeUpload) {
        // A first-batch model was just attached: this frame uploads its geometry, textures and programs.
        const started = performance.now();
        renderer.render(scene, camera);
        loadReport.uploaded(performance.now() - started); timeUpload = false;
      } else renderer.render(scene, camera);
    }
    if (!reported && loadReport.report.wallMs !== null && !timeUpload) {
      reported = true;
      const r = loadReport.report, ms = (n: number) => Math.round(n);
      (globalThis as { __render3dLoad?: unknown }).__render3dLoad = r;
      console.info(`[3D] 首批 ${r.shown}/${r.pieces} 个棋子模型 ${ms(r.wallMs!)} ms 后出现；各模型合计：读取 ${ms(r.readMs)} ms，解析 ${ms(r.parseMs)} ms，`
        + `首帧上传与编译 ${ms(r.uploadMs)} ms；其中 ${r.warmed} 个已预热`);
    }
  };
  resize(host.clientWidth, host.clientHeight);
  frameId = requestAnimationFrame(tick);

  // Opt-in inspection hook (?debug3d) for checking live action effects in a browser.
  // Guarded: unit tests mount this renderer without a `location` global.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug3d')) (window as unknown as { __render3d?: unknown }).__render3d = { scene, camera, live, pieces, tabletop, traitProps, stage, scout };
  const renderer3d: Renderer3d = {
    status: models.status, detail: models.detail, resize,
    dispose() {
      closed = true; cancelAnimationFrame(frameId); unsubscribe(); fpsLabel?.remove();
      if (dragging) feed?.controls()?.dragCancel();
      feed?.controls()?.hover(null); endDrag();
      for (const [type, handler] of [['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp],
        ['pointercancel', onPointerCancel], ['lostpointercapture', onPointerCancel], ['pointerleave', onPointerLeave]] as const)
        canvas.removeEventListener(type, handler as EventListener);
      for (const root of menuRoots) root.removeEventListener('contextmenu', onContextMenu);
      withdrawPicker(); clearEffects(); saveBurst?.dispose(); saveBurst = null; tabletop.dispose(); traitProps.dispose(); stage.dispose(); scout.dispose(); arena?.dispose(); clearTimeout(calloutTimer); callout?.remove();
      for (const view of pieces.values()) removePiece(view);
      pieces.clear(); boardGroup.clear();
      warmup?.dispose(); effects?.dispose(); models.cache?.dispose(); models.preloader?.dispose(); models.reader?.dispose();
      for (const resource of owned) resource.dispose();
      renderer.domElement.remove();
      const release = () => { renderer.dispose(); renderer.forceContextLoss(); };
      if (compiling) void compiling.then(release); else release();
    },
  };
  return renderer3d;
};
