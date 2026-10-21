/**
 * The 3D chunk's MountRenderer3d. The file keeps its original name because three-loader.ts imports it and
 * tests/rendering3d-mode.test.ts mocks that path; it is no longer only a placeholder.
 *
 * It draws the BoardScene feed (board-feed.ts) with the src/rendering3d core: hex board and bench, one piece per
 * 2D token at the same logical position (x→x, y→z), ModelCache leases with UnitActionState/UnitAnimationMixer
 * driven by display combat events. Without an asset root, or when the manifest cannot be read, pieces are
 * team-coloured pawns; a unit missing from a readable manifest shows the core's magenta placeholder box.
 * Pointer input on the 3D board is replayed through BoardControls (pick() for units, the board plane for drop points):
 * BoardScene runs its own drag rules and session commands, so this layer never issues a command or reads rules itself.
 */
import {
  AmbientLight, Box3, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Plane, Raycaster, RingGeometry, SRGBColorSpace, Scene, SphereGeometry, TextureLoader, Vector2, Vector3, WebGLRenderer,
  type Object3D, type Texture,
} from 'three';
import {
  ModelCache, UnitActionState, UnitAnimationMixer, createActionEffectResolver, createStarMark, hexCenter, loadParticleEffect, pick, readParticleMesh,
  type AnimationEvent, type HexGrid, type ModelLease, type ParticleEffect, type StarMark,
} from '../../rendering3d';
import type { BoardDropHint, BoardFeed, BoardFrame, BoardPiece, BoardScreenBox } from '../board-feed';
import type { DisplayCombatEvent } from '../../presentation/combat-display';
import type { MountRenderer3d, Renderer3d } from './contract';
import { AssetPreloader, describePreload, openAssetStore, readPackList, readPrecacheList } from './asset-preload';
import { createAssetReader, type AssetReader } from './asset-reader';
import { LEGEND_MODEL, createTabletop } from './tabletop';
import { createCarouselStage } from './carousel-stage';
import { DEFAULT_METER_COLORS, createUnitOverhead, type MeterColors, type UnitOverhead } from './unit-overhead';

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
/** Effects without a playback entry play at the source this long. */
const DEFAULT_EFFECT_SECONDS = 1;
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

// Injected by three-loader.ts: a static import would make Rollup move board-feed.ts (also used by BoardScene)
// into this chunk and the 2D entry would then load the whole 3D chunk.
let feed: BoardFeed | null = null;
export function useBoardFeed(next: BoardFeed): void { feed = next; }
// Injected the same way: the shell's one-line preload status (asset-preload.ts describePreload).
let assetProgress: ((text: string) => void) | null = null;
export function useAssetProgress(next: (text: string) => void): void { assetProgress = next; }
// Injected the same way: the 2D theme's star color (presentation/theme.ts starColor), so 2D and 3D stars match.
let starColorFor: (level: number) => string = () => '#ffd34d';
export function useStarColor(next: (level: number) => string): void { starColorFor = next; }
// Injected the same way: the 2D theme's meter colors (presentation/theme.ts THEME.color), so 2D and 3D bars match.
let meterColors: MeterColors = DEFAULT_METER_COLORS;
export function useMeterColors(next: MeterColors): void { meterColors = next; }

type Models = { cache: ModelCache; status: 'assets'; detail: string; preloader: AssetPreloader; reader: AssetReader }
  | { cache: null; status: 'placeholder'; detail: string; preloader: null; reader: null };

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

async function openModels(assetBase: string | null, renderer: WebGLRenderer, onProgress?: (text: string) => void): Promise<Models> {
  const none = (detail: string): Models => ({ cache: null, status: 'placeholder', detail, preloader: null, reader: null });
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
    const reader = createAssetReader(renderer, url => preloader!.read(url.slice(assetBase.length)));
    const cache = new ModelCache(manifest, assetBase, url => reader.readModel(url));
    const list = readPrecacheList(await fetchIndex(`${assetBase}precache.json`), cache.manifest);
    // Optional: a root without packs.json (or with one that disagrees with precache) downloads file by file.
    const packs = readPackList(await fetchIndex(`${assetBase}packs.json`), list);
    const store = await openAssetStore();
    preloader = new AssetPreloader(assetBase, list, store, { packs });
    if (onProgress) preloader.onProgress(progress => onProgress(describePreload(progress)));
    void navigator.storage?.persist?.().catch(() => false);
    void preloader.start();
    return { cache, status: 'assets', detail: `已读取素材清单（${Object.keys(cache.manifest.models).length} 个模型）`, preloader, reader };
  } catch {
    return none('素材地址无法访问或清单格式不符，显示占位棋子');
  }
}

/** Preview staging for one effect (assets3d action-bindings.json `playback`); approximate, not gameplay timing. */
interface EffectPlayback { anchor: 'source' | 'target' | 'projectile'; bone?: string; delay: number; maxDuration: number }
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
  /** Seconds the death action still has to play while dead (0 = hidden); 'loading' until its model can play it. */
  dyingFor: number | 'loading' | null;
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
  const renderer = new WebGLRenderer({ antialias: true });
  const models = await openModels(options.assetBase, renderer, assetProgress ?? undefined);
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

  // Online 选秀 (carousel-stage.ts): its own scene and camera, drawn instead of the board while board-feed carries one.
  const loadEffect = models.cache && options.assetBase && models.cache.manifest.effects ? (id: string, maxDuration: number) => {
    if (!models.cache!.manifest.effects?.[id]) return Promise.reject(new Error('unknown-effect'));
    return loadParticleEffect(models.cache!.manifest, id, { root: options.assetBase!, scale: 1, maxDuration, readTexture: models.reader!.readTexture,
      readJson: models.reader!.readJson, readMesh: url => readParticleMesh(url, models.reader!.readModel) });
  } : null;
  const stage = createCarouselStage({ championHeight: MODEL_HEIGHT, championWidth: MODEL_WIDTH, sourceScale: FX_SCALE, legendModel: LEGEND_MODEL,
    loadModel: models.cache ? id => models.cache!.load(id) : null, hasModel: id => !!models.cache && Object.hasOwn(models.cache.manifest.models, id),
    loadEffect, starColor: level => starColorFor(level), onReleased: () => flashCallout('可以选了') });
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
  const tabletop = createTabletop({ scene, camera, championHeight: MODEL_HEIGHT, effectScale: FX_SCALE, own,
    loadModel: models.cache && Object.hasOwn(models.cache.manifest.models, LEGEND_MODEL) ? id => models.cache!.load(id) : null,
    loadEffect });
  const boardGroup = new Group(), boardBox = new Box3();
  // Look from the player's side with a TFT-like tilt; back off until board and bench fit both ways.
  const VIEW = new Vector3(0, 1.32, 0.98).normalize();
  const frameCamera = () => {
    if (boardBox.isEmpty()) return;
    const center = boardBox.getCenter(new Vector3()), size = boardBox.getSize(new Vector3());
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const distance = Math.max(size.x * 0.54 / (tan * camera.aspect), size.z * 0.66 * VIEW.y / tan + size.z * 0.5 * VIEW.z);
    camera.position.copy(center).addScaledVector(VIEW, distance);
    camera.lookAt(center);
  };
  scene.add(boardGroup);
  let boardKey = '';
  const buildBoard = (frame: BoardFrame) => {
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}|${frame.bench.length}`;
    if (key === boardKey) return;
    boardKey = key;
    boardGroup.clear();
    const tile = own(new CylinderGeometry(frame.hexRadius * 0.95, frame.hexRadius * 0.95, 6, 6)); // six segments start at +z: pointy-top
    const own0 = own(new MeshStandardMaterial({ color: '#2d5c7a', roughness: 0.85 }));
    const foe = own(new MeshStandardMaterial({ color: '#5a3a48', roughness: 0.85 }));
    const grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.columns; col++) {
      const mesh = new Mesh(tile, row < frame.rows / 2 ? foe : own0);
      mesh.position.copy(hexCenter({ col, row }, grid)).setY(-3);
      boardGroup.add(mesh);
    }
    const slot = own(new BoxGeometry(48, 4, 56)), slotMaterial = own(new MeshStandardMaterial({ color: '#25313d', roughness: 0.9 }));
    for (const point of frame.bench) {
      const mesh = new Mesh(slot, slotMaterial);
      mesh.position.set(point.x, -2, point.y);
      boardGroup.add(mesh);
    }
    boardBox.setFromObject(boardGroup);
    for (const point of tabletop.layout(frame)) boardBox.expandByPoint(point);
    frameCamera();
  };

  const pieces = new Map<string, PieceView>();
  // Item icons are the 2D bundle's image URLs; one texture per URL for every piece, released with the renderer.
  const itemTextures = new Map<string, Promise<Texture | null>>();
  let closed = false;
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
  const pawnFor = (team: BoardPiece['team']): Object3D => {
    const pawn = new Group();
    pawn.name = 'render3d-pawn';
    const body = new Mesh(pawnBody, teamMaterial[team]); body.position.y = 17;
    const head = new Mesh(pawnHead, teamMaterial[team]); head.position.y = 42;
    pawn.add(body, head);
    return fit(pawn, PAWN_HEIGHT, PAWN_WIDTH);
  };
  const attachBody = (view: PieceView) => {
    if (view.body) { view.root.remove(view.body); view.body = null; }
    view.mixer?.dispose(); view.mixer = null; view.lease?.release(); view.lease = null;
    // The team pawn stands in until the model arrives (cache miss while the preload is still running).
    view.body = pawnFor(view.team); view.root.add(view.body); view.starHeight = PAWN_HEIGHT + STAR_GAP;
    if (!models.cache) return;
    const definitionId = view.definitionId;
    void models.cache.load(definitionId).then(lease => {
      if (view.disposed || view.definitionId !== definitionId) { lease.release(); return; }
      view.lease = lease;
      if (view.body) view.root.remove(view.body);
      // A unit missing from the manifest gets ModelCache's unit-cube placeholder: keep it pawn sized.
      const monster = lease.placeholder ? undefined : monsterFit(definitionId);
      if (lease.placeholder) view.body = fit(lease.scene, PAWN_HEIGHT, PAWN_WIDTH);
      else if (monster) {
        // The offset goes on the GLB root, which the mixer never animates (clips drive its bones).
        view.body = fit(lease.scene, MODEL_HEIGHT * monster.height); lease.scene.position.y += MODEL_HEIGHT * monster.lift;
      } else view.body = fit(lease.scene, MODEL_HEIGHT, MODEL_WIDTH);
      view.starHeight = (lease.placeholder ? PAWN_HEIGHT : MODEL_HEIGHT * (monster?.height ?? 1)) + STAR_GAP;
      view.root.add(lease.scene);
      view.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      view.mixer.apply(view.state.output);
      if (view.dyingFor === 'loading') view.dyingFor = deathSeconds(view); // the death clip starts now
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
    const view: PieceView = { root, ring, stars: null, starHeight: PAWN_HEIGHT + STAR_GAP, overhead, state: new UnitActionState(piece.id), body: null, lease: null, mixer: null, team: piece.team,
      definitionId: piece.definitionId, target: new Vector3(piece.x, 0, piece.y), placed: false, disposed: false, alive: true, dyingFor: null };
    attachBody(view); syncStars(view, piece);
    return view;
  };
  // UnitActionState stays on death until unitRevived and ignores later events, so a unit that died must start the
  // next combat or preparation fresh. A new mixer too: the old one caches the last applied revision.
  const resetAction = (view: PieceView, id: string) => {
    view.state = new UnitActionState(id);
    view.mixer?.dispose(); view.mixer = null;
    if (view.lease) { view.mixer = new UnitAnimationMixer(view.lease.scene, view.lease.animations, view.lease.animationNames); view.mixer.apply(view.state.output); }
  };
  const removePiece = (view: PieceView) => {
    view.disposed = true;
    view.mixer?.dispose(); view.lease?.release(); view.stars?.dispose(); view.stars = null; view.overhead.dispose();
    view.root.removeFromParent();
  };

  // Action effects (attack/cast): staged by render time, owned by a phase generation so a new combat, preparation or
  // dispose drops everything still queued, loading or playing.
  interface LiveEffect { fx: ParticleEffect; left: number; from?: Vector3; to?: Vector3; travel?: number; elapsed: number }
  let clock = 0, generation = 0;
  const queued: { at: number; generation: number; run: () => void }[] = [];
  const live = new Set<LiveEffect>();
  const clearEffects = () => {
    generation++; queued.length = 0;
    for (const effect of live) effect.fx.dispose();
    live.clear();
  };
  const worldPoint = (view: PieceView, bone: string | undefined, out: Vector3): boolean => {
    const node = bone ? view.body?.getObjectByName(bone) : undefined;
    if (node) { node.getWorldPosition(out); return true; }
    if (bone) return false;
    view.root.getWorldPosition(out).setY(IMPACT_HEIGHT);
    return true;
  };
  /** Local scale that gives an effect FX_SCALE in world space under `parent`. */
  // abs: a mirrored parent decomposes with a negative X, which would flip the effect on every axis.
  const effectScale = (parent: Object3D): number => FX_SCALE / (Math.abs(parent.getWorldScale(new Vector3()).x) || 1);
  const playEffect = (id: string, spec: EffectPlayback, sourceId: string, targetId: string | undefined, owner: number) => {
    const source = pieces.get(sourceId), target = targetId ? pieces.get(targetId) : undefined;
    if (!source?.body || live.size >= MAX_EFFECTS || !models.cache || !options.assetBase) return;
    if (spec.anchor !== 'source' && !target) return; // no target: never fake a projectile with the caster's own motion
    void loadParticleEffect(models.cache.manifest, id, { root: options.assetBase, scale: 1, maxDuration: spec.maxDuration, readTexture: models.reader.readTexture,
      readJson: models.reader.readJson,
      // Each call parses a fresh template from the cached bytes, as readParticleMesh requires (it disposes it).
      readMesh: url => readParticleMesh(url, models.reader.readModel) }).then(fx => {
      const effect: LiveEffect = { fx, left: spec.maxDuration, elapsed: 0 };
      if (owner !== generation || source.disposed || !source.body || (target && target.disposed) || live.size >= MAX_EFFECTS) { fx.dispose(); return; }
      if (spec.anchor === 'source') {
        const node = spec.bone ? source.body.getObjectByName(spec.bone) : source.root;
        if (!node) { fx.dispose(); return; }
        fx.object.scale.setScalar(effectScale(node));
        node.add(fx.object);
      } else {
        const from = new Vector3();
        if (!worldPoint(spec.anchor === 'projectile' ? source : target!, spec.anchor === 'projectile' ? spec.bone : undefined, from)) { fx.dispose(); return; }
        fx.object.scale.setScalar(FX_SCALE);
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
    if (!actionEffects || !source?.alive) return;
    const owner = generation;
    for (const { id } of actionEffects.resolve(source.definitionId, action)) {
      const spec = actionEffects.playback[id] ?? { anchor: 'source', delay: 0, maxDuration: DEFAULT_EFFECT_SECONDS };
      queued.push({ at: clock + spec.delay, generation: owner, run: () => playEffect(id, spec, sourceId, targetId, owner) });
    }
  };
  const updateEffects = (seconds: number) => {
    clock += seconds;
    for (let i = queued.length - 1; i >= 0; i--) {
      const job = queued[i];
      if (job.generation !== generation) { queued.splice(i, 1); continue; }
      if (job.at <= clock) { queued.splice(i, 1); job.run(); }
    }
    for (const effect of live) {
      effect.elapsed += seconds; effect.left -= seconds;
      if (effect.from && effect.to && effect.travel) effect.fx.object.position.lerpVectors(effect.from, effect.to, Math.min(1, effect.elapsed / effect.travel));
      effect.fx.update(seconds, camera);
      if (effect.left <= 0 || effect.fx.finished) { effect.fx.dispose(); live.delete(effect); }
    }
  };

  let fighting: boolean | null = null;
  const onFrame = (frame: BoardFrame) => {
    buildBoard(frame);
    grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    // BoardScene cancelled the drag itself (blur, resize, D/F, phase change, a command): let go of the pointer too.
    if (dragging && frame.dragging !== dragging) endDrag();
    if (fighting !== null && fighting !== frame.fighting) { clearEffects(); for (const [id, view] of pieces) resetAction(view, id); }
    fighting = frame.fighting;
    const seen = new Set<string>();
    for (const piece of frame.pieces) {
      if (!piece.definitionId || (piece.team !== 'player' && piece.team !== 'enemy')) continue;
      seen.add(piece.id);
      let view = pieces.get(piece.id);
      const created = !view;
      if (!view) { view = createPiece(piece); pieces.set(piece.id, view); }
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
        view.alive = false;
        const output = view.state.consume({ type: 'death', unitId: piece.id });
        view.mixer?.apply(output);
        view.dyingFor = created ? 0 : models.cache && !view.lease ? 'loading' : deathSeconds(view);
      }
      const shown = piece.visible && (view.dyingFor === null || view.dyingFor === 'loading' || view.dyingFor > 0);
      if (shown && !view.root.visible) resetAction(view, piece.id);
      view.root.visible = shown;
      view.target.set(piece.x, 0, piece.y);
      if (!view.placed) { view.root.position.copy(view.target); view.placed = true; }
    }
    for (const [id, view] of pieces) if (!seen.has(id)) { removePiece(view); pieces.delete(id); }
    tabletop.frame(frame);
  };
  const onEvents = (events: readonly DisplayCombatEvent[]) => {
    for (const event of events) {
      if (!ANIMATION_EVENTS.has(event.type)) continue;
      // Display events carry the replay field names UnitActionState reads; each state ignores other units' events.
      for (const view of pieces.values()) { const output = view.state.consume(event as unknown as AnimationEvent); view.mixer?.apply(output); }
      if (event.type === 'attack') playAction('attack', event.attackerId, event.targetId);
      else if (event.type === 'cast') playAction('cast', event.sourceId, event.targetIds[0]);
    }
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
  const unsubscribe = feed?.subscribe({ frame: onFrame, events: onEvents, carousel: onCarousel,
    unitAt: client => stage.active ? undefined : pickUnit(client, true) ?? undefined, screenBox: id => stage.active ? undefined : screenBox(id) }) ?? (() => {});

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
  /** pick() over the drawn pieces: my units for board gestures, any team for item drops (BoardScene judges the target). */
  const pickUnit = (client: { x: number; y: number }, anyTeam: boolean): string | null => {
    const area = viewport();
    if (!grid || area.width <= 0 || area.height <= 0) return null;
    const units = [...pieces].filter(([, view]) => view.alive && (anyTeam || view.team === 'player')).map(([unitId, view]) => ({ unitId, object: view.root }));
    const hit = pick(client, area, camera, grid, units);
    return hit?.kind === 'unit' ? hit.unitId : null;
  };
  const unitAt = (event: PointerEvent) => pickUnit({ x: event.clientX, y: event.clientY }, false);
  const boardPoint = (event: PointerEvent): { x: number; y: number } | null => {
    const area = viewport();
    if (area.width <= 0 || area.height <= 0) return null;
    ray.setFromCamera(new Vector2((event.clientX - area.left) / area.width * 2 - 1, 1 - (event.clientY - area.top) / area.height * 2), camera);
    const point = ray.ray.intersectPlane(groundPlane, new Vector3());
    return point ? { x: point.x, y: point.z } : null;
  };
  const showHint = (hint: BoardDropHint) => {
    marker.visible = !!hint.target;
    if (!hint.target) return;
    marker.position.set(hint.target.x, 1, hint.target.y);
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
      // A unit on the carousel (left button): the 2D panel's own slot click (it checks my release and a pick still out);
      // my legend runs for it while the pick is out. Anywhere else, either button as TFT's right click: my legend walks there.
      const client = { x: event.clientX, y: event.clientY };
      const hit = event.button === 0 ? stage.slotAt(client, viewport()) : null;
      if (hit?.takable) { feed?.carouselControls?.()?.pick(hit.slot); event.preventDefault(); return; }
      if (stage.walkTo(client, viewport())) event.preventDefault();
      return;
    }
    if (event.button !== 0 || press) return;
    // My orb: the orb dock's own click (it decides whether the rules can be asked now).
    const orb = tabletop.orbAt({ x: event.clientX, y: event.clientY }, viewport());
    if (orb) { feed?.controls()?.claimOrb?.(orb); event.preventDefault(); return; }
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
    const point = boardPoint(event);
    if (point && controls) showHint(controls.dragMove(point));
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const controls = feed?.controls();
    if (dragging) controls?.dragEnd(boardPoint(event), { x: event.clientX, y: event.clientY });
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
  // The carousel walks on a right click too: no browser menu over it.
  const onContextMenu = (event: Event) => { if (stage.active) event.preventDefault(); };
  canvas.addEventListener('contextmenu', onContextMenu);

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
  const tick = (now: number) => {
    frameId = requestAnimationFrame(tick);
    const seconds = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    const follow = 1 - Math.exp(-seconds / FOLLOW_SECONDS);
    for (const [id, view] of pieces) {
      if (id === dragging) view.root.position.copy(view.target).setY(DRAG_LIFT); // follows the pointer exactly
      else {
        view.root.position.y = 0;
        const step = view.target.clone().sub(view.root.position);
        if (step.lengthSq() > 0.25) view.root.rotation.y = Math.atan2(step.x, step.z);
        else view.root.rotation.y = view.team === 'player' ? Math.PI : 0; // models face +z; the player's side looks up the board
        view.root.position.addScaledVector(step, follow);
      }
      if (typeof view.dyingFor === 'number' && view.dyingFor > 0 && (view.dyingFor = Math.max(0, view.dyingFor - seconds)) === 0) view.root.visible = false;
      const output = view.state.update(seconds);
      if (view.mixer) { view.mixer.apply(output); view.mixer.update(seconds); }
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
    tabletop.update(seconds); stage.update(seconds); followBox();
    if (width > 0) { if (stage.active) renderer.render(stage.scene, stage.camera); else renderer.render(scene, camera); }
  };
  resize(host.clientWidth, host.clientHeight);
  frameId = requestAnimationFrame(tick);

  // Opt-in inspection hook (?debug3d) for checking live action effects in a browser.
  // Guarded: unit tests mount this renderer without a `location` global.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug3d')) (window as unknown as { __render3d?: unknown }).__render3d = { scene, camera, live, pieces, tabletop, stage };
  const renderer3d: Renderer3d = {
    status: models.status, detail: models.detail, resize,
    dispose() {
      closed = true; cancelAnimationFrame(frameId); unsubscribe();
      if (dragging) feed?.controls()?.dragCancel();
      feed?.controls()?.hover(null); endDrag();
      for (const [type, handler] of [['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp],
        ['pointercancel', onPointerCancel], ['lostpointercapture', onPointerCancel], ['pointerleave', onPointerLeave], ['contextmenu', onContextMenu]] as const)
        canvas.removeEventListener(type, handler as EventListener);
      clearEffects(); tabletop.dispose(); stage.dispose(); clearTimeout(calloutTimer); callout?.remove();
      for (const view of pieces.values()) removePiece(view);
      pieces.clear(); boardGroup.clear();
      models.cache?.dispose(); models.preloader?.dispose(); models.reader?.dispose();
      for (const resource of owned) resource.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
  return renderer3d;
};
