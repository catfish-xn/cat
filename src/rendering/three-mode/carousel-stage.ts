import { contains, projectedBox, spritePick, type ScreenArea } from './description-pick';
import type { BoardDescription, BoardScreenBox } from '../board-feed';
/**
 * The online 选秀 drawn in 3D (docs/ASSETS3D_CAROUSEL.md 界面接线需求): its own scene and camera, shown by the renderer
 * instead of the board while board-feed carries a BoardCarousel. The platform pieces load as one group at the shared
 * model scale (no per-piece centering, mirroring or grounding); eight seat legends stand on the outer cradles in public
 * seat order; the units on offer stand on a ring over the glass, in a display group that alone turns slowly from the
 * carousel's start. Everything comes from the server's carousel view as the 2D panel shows it: a click on a unit is the
 * panel's own slot click, and nothing here releases or picks.
 *
 * The legends act it out as in TFT (planning/3d/tft-parity-carousel-scout-ui-2026-10-21.md C1/C2/C5): once my seat is
 * released a click on the ground walks my legend there, and a click on a unit runs it to that unit. The room plans every
 * walk (src/server/legend-motion.ts) and sends it to all seats, so every legend is drawn where the room has it; with a
 * room that walks, a unit is picked when its legend reaches it, first come first served. Without one (an in-browser room)
 * a unit click is still the panel's pick at once. A unit leaves the ring only when the view names the seat that took it:
 * the unit follows that legend on a tether as it moves freely. A held seat
 * counts down over its head and its chains break at release; the stage opens with a short push-in.
 * Missing models or effects draw stand-ins; the timer ring is not drawn (its extracted effect is incomplete).
 */
import {
  AmbientLight, Box3, CanvasTexture, Color, CylinderGeometry, DoubleSide, DirectionalLight, Group, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Plane, Raycaster, RingGeometry, Scene, SphereGeometry, Sprite, SpriteMaterial, Texture, TextureLoader, Vector2, Vector3, type Object3D,
} from 'three';
import { UnitAnimationMixer, createStarMark, type ActionOutput, type ModelLease, type ParticleEffect, type StarMark } from '../../rendering3d';
import { loadLegendLease } from './legend-load';
import type { BoardCarousel, BoardCarouselSlot, BoardLegendWalk } from '../board-feed';
import type { CellPoint } from '../../server/legend-motion';
import { fitModel, standingFeet, type Envelope } from './model-fit';

/** Board units per carousel cell, as the asset review lays out the stage (one grid interval; models and effects at .44). */
export const CAROUSEL_CELL = 62.4;
/** Platform pieces in one root (manifest keys); the skybox is optional scenery kept out of feet, picking and the camera. */
export const CAROUSEL_PLATFORM = ['carousel-center', 'carousel-center-b', 'carousel-llplatforms', 'carousel-glassdome-a',
  'carousel-reflectionplane', 'carousel-kitpieces-a', 'carousel-kitpieces-b', 'carousel-kitpieces-c'] as const;
export const CAROUSEL_SCENERY = ['carousel-skybox'] as const;
/** Feet land on these surfaces (a ray from above), never on a whole-model bounding box. */
const LEGEND_SURFACE = ['carousel-llplatforms'], UNIT_SURFACE = ['carousel-glassdome-a', 'carousel-center'];
/**
 * Doc's proposed layout, in cells: legends on the cradles, units on a ring inside the glass; feet without a surface. The
 * room aims walks by the same numbers (src/server/legend-motion.ts, not imported here so that the 3D chunk stays apart;
 * tests/rendering3d-carousel.test.ts pins them equal).
 */
export const LEGEND_RADIUS = 7.1, UNIT_RADIUS = 2.5, FEET = 0.25;
/** One turn of the unit ring takes this long; the angle runs from the carousel's own start. */
export const ORBIT_SECONDS = 48;
/**
 * Camera, from my seat's side: as near as keeps the whole pedestal ring (its outer edge STAGE_RADIUS cells out, from the
 * platform's lowest point up) and the legends' heads on the cradles inside FRAME_FILL of the view, so the near pedestal
 * reaches the bottom edge and the arena fills the screen as in TFT (playtest 10-21: it looked too small framed as a full
 * circle). Fitted by projecting that rim, never estimated from the ring's center (that cropped the near pedestal).
 */
const STAGE_RADIUS = 8.6, FRAME_FILL = 0.975, RIM_POINTS = 128, VIEW = new Vector3(0, 1.05, 1).normalize();
/** The framed rim's underside: vertices from RIM_BAND of the ring's radius outward and at most STRUT_DEPTH cells down
 * (the pedestal ring's own slab, never the struts hanging under the platform). */
const RIM_BAND = 0.85, STRUT_DEPTH = 3;
/**
 * Effects (manifest keys). One variant of each is chosen explicitly: the plain restraint for my seat and the enemy one for
 * others, the Galaxy first-draft wall. The restraint plays only its reviewed early part (the later part shows a grey band),
 * rebuilt while the seat is locked; every other effect is bounded and rebuilt or dropped, never assumed to run forever.
 */
const FX = {
  restraint: 'carousel-shareddraftplayerrestraint', restraintEnemy: 'carousel-shareddraftplayerrestraint-enemy',
  wall: 'carousel-shareddraft-firstdraftwall-galaxy', wallEnd: 'carousel-shareddraft-firstdraftwall-death-galaxy',
  selected: 'carousel-shareddraft-unitselected', indicator: 'carousel-shareddraft-playerindicator',
} as const;
const RESTRAINT_EARLY_SECONDS = 1.2, WALL_SECONDS = 10, WALL_END_SECONDS = 2, SELECTED_SECONDS = 1.5, INDICATOR_SECONDS = 30;
/** Stand-in feedback when an effect is missing: a ring that swells and fades this long. */
const POP_SECONDS = 0.5;
const ITEM_SIZE = 18, STAR_SIZE = 12, STAR_GAP = 12;
/** Half the width of a ring unit's click box, in cells (a full cell is 0.5). */
const PICK_HALF_WIDTH = 0.65;
/**
 * Carousel champions stand this much larger than on the board (their body, stars, items and pick box), so each draft
 * unit reads at a glance (playtest 10-22: "make the pieces bigger, easier to tell apart").
 */
const UNIT_SIZE = 1.7;
/** Lightweight hover/pending feedback, in board units; cost/availability live over the head. */
const HOVER_LIFT = 5, PENDING_LIFT = 10, QUALITY_SIZE = 8;
/**
 * Legend motion, display only (cells, seconds): every legend runs for its unit at RUN_CELLS a second (another seat's too,
 * until the room confirms contact). It waits within GRAB_CELLS; the unit trails TETHER_CELLS behind. Ground clicks stay inside the cradles' ring.
 */
export const RUN_CELLS = 2.5;
const GRAB_CELLS = 0.25, TETHER_CELLS = 1.1, ROAM_RADIUS = LEGEND_RADIUS;
/** Opening push-in: the camera starts this much farther and higher and settles on the fixed view. */
const INTRO_SECONDS = 1.5, INTRO_PULL = 0.45, INTRO_LIFT = 0.5;
const COUNTDOWN_SIZE = 32;
const COLOR = { me: '#7fd8cf', seat: '#e3a08f', pending: '#e6bc76', lock: '#b4a1f5', item: '#c9d4da' } as const;

export interface CarouselStageContext {
  /** A champion's height and width cap (board units), as on the board; a legend stands half a champion. */
  readonly championHeight: number;
  readonly championWidth: number;
  /** World scale of models' source units and particle effects (the renderer's FX_SCALE). */
  readonly sourceScale: number;
  /** A lease when the manifest names that model; null without an asset root (stand-ins only). */
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  readonly hasModel: (id: string) => boolean;
  /** The asset root's official scale for a champion model (model-fit.ts), null when it has none. */
  readonly unitScale?: (id: string) => number | null;
  /** The board's animation envelope for an official-scale model (model-fit.ts): width cap and idle feet; undefined if none. */
  readonly envelope?: (id: string, lease: ModelLease) => Envelope | undefined;
  readonly loadEffect: ((id: string, maxDuration: number) => Promise<ParticleEffect>) | null;
  /** The default little legend's model; a seat whose own legend (`little-legend-<legend>`) the manifest lacks shows it. */
  readonly legendModel: string;
  readonly starColor: (level: number) => string;
  /** The 2D theme's cost color (1 gray … 5 gold) for the overhead quality mark; a neutral gray without it. */
  readonly costColor?: (cost: number) => string;
  /** Item icon textures (tests pass a stub); defaults to three's TextureLoader. */
  readonly loadTexture?: (url: string) => Promise<Texture>;
  readonly now?: () => number;
  /** My seat was just released (not on the first view of a carousel): the renderer flashes its callout. */
  readonly onReleased?: () => void;
}
export interface CarouselStage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** True while a carousel is drawn. */
  readonly active: boolean;
  show(view: BoardCarousel | null): void;
  update(seconds: number): void;
  resize(aspect: number): void;
  /** The standing unit drawn under a CSS-pixel point. */
  slotAt(client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): { slot: number; takable: boolean } | null;
  hover(slot: number | null): void;
  descriptionAt(client: { x: number; y: number }, area: ScreenArea): { target: BoardDescription; box: BoardScreenBox } | undefined;
  /**
   * A press on the ground: my released legend, with no pick out, starts toward that point at once. The point in cells
   * (for the room), or null when it may not move.
   */
  walkTo(client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): CellPoint | null;
  /** A press on a standing unit: my legend starts toward it at once (the room's walk then takes over). False when it may not move. */
  runTo(slot: number): boolean;
  /** A walk the room took: that legend goes where the room has it, arriving when the room says. */
  walk(walk: BoardLegendWalk): void;
  /** Acceptance read (?debug3d). Legends read `seat:body[:locked][:chase|:carry|:walk]`; `fetched` names who holds which slot. */
  debug(): { platform: string[]; legends: string[]; units: { slot: number; body: string; items: number; cue: string }[]; effects: string[]; angle: number;
    fetched: Record<string, number>; countdowns: Record<string, string> };
  dispose(): void;
}

/** Carousel bodies only walk or stand, looping either, until told otherwise (UnitActionState times combat actions out). */
class Stride {
  private moving = false; private revision = 0;
  set(moving: boolean): void { if (moving !== this.moving) { this.moving = moving; this.revision++; } }
  get output(): ActionOutput {
    return { state: this.moving ? 'move' : 'idle', previous: this.moving ? 'idle' : 'move', blendSeconds: 0.15, loop: true, revision: this.revision };
  }
}
interface Body { root: Group; lease: ModelLease | null; mixer: UnitAnimationMixer | null; state: Stride; disposed: boolean }
interface UnitView extends Body {
  readonly slot: number; readonly definitionId: string; readonly holder: Group;
  /** Small cost-colored overhead square: bright when takable/pending, dim while unavailable. */
  readonly quality: Sprite;
  stars: StarMark; items: Sprite[]; data: BoardCarouselSlot;
  /** Seat named by the view as having taken it: the unit has left the turning ring for that seat's legend. */
  takenBy: string | null;
}
interface SeatView extends Body {
  readonly seatId: string; readonly me: boolean; readonly anchor: Vector3; lock: Loop | null; indicator: Loop | null;
  /** Held until this logical ms (the view's release time); `locked` is the last state drawn, to catch the release. */
  releaseAtMs: number; locked: boolean;
  /** Running to a unit (mine while my pick is out, or the seat's taken unit), or to a ground point / home; else standing. */
  chase: UnitView | null; goal: Vector3 | null; speed: number;
  /** The room's walk (performance.now() times), followed even while carrying a unit. */
  path: { from: Vector3; to: Vector3; start: number; end: number } | null;
  /** The unit it took, trailing on the tether. */
  carry: UnitView | null;
  readonly tether: Mesh;
  countdown: { sprite: Sprite; texture: CanvasTexture; canvas: HTMLCanvasElement; text: string } | null;
}
/** A bounded effect rebuilt while wanted, or its stand-in mesh. */
/** `parent`: carry the effect with a moving object (a unit on the turning ring); `point` is then local to it. */
interface Loop { id: string; seconds: number; point: Vector3; fx: ParticleEffect | null; stand: Mesh | null; left: number; loading: boolean; disposed: boolean; parent?: Object3D }
interface Burst { fx: ParticleEffect | null; mesh: Mesh | null; left: number; total: number; disposed: boolean }

export function createCarouselStage(ctx: CarouselStageContext): CarouselStage {
  const cell = CAROUSEL_CELL, now = ctx.now ?? (() => performance.now());
  const legendHeight = ctx.championHeight * 0.5;
  const scene = new Scene();
  scene.background = new Color('#101923');
  scene.add(new AmbientLight(0xffffff, 0.75));
  const sun = new DirectionalLight(0xffffff, 1.3); sun.position.set(-200, 600, 300); scene.add(sun);
  const camera = new PerspectiveCamera(36, 1, 1, 20000);

  // Shared stand-in resources for the stage's lifetime.
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(resource: T): T => { owned.push(resource); return resource; };
  const material = (color: string, extra: object = {}) => own(new MeshStandardMaterial({ color, roughness: 0.7, ...extra }));
  const geometry = {
    disc: own(new CylinderGeometry(7.55 * cell, 7.55 * cell, 0.2 * cell, 64)), glass: own(new CylinderGeometry(3.37 * cell, 3.37 * cell, 0.06 * cell, 48)),
    cradle: own(new CylinderGeometry(0.62 * cell, 0.7 * cell, 0.2 * cell, 24)), wall: own(new CylinderGeometry(4.2 * cell, 4.2 * cell, 0.6 * cell, 48, 1, true)),
    pawn: own(new CylinderGeometry(9, 13, 34, 16)), head: own(new SphereGeometry(10, 16, 12)), legend: own(new SphereGeometry(14, 20, 14)),
    lock: own(new RingGeometry(0.5 * cell, 0.62 * cell, 40)),
    marker: own(new SphereGeometry(5, 12, 8)),
    // Unit-length tether along +y, stretched and turned between legend and unit each frame.
    tether: own(new CylinderGeometry(1.4, 1.4, 1, 6, 1, true).translate(0, 0.5, 0)),
  };
  const materials = {
    disc: material('#22384a'), glass: material('#6fb4d6', { transparent: true, opacity: 0.35 }), cradle: material('#3a5266'),
    wall: material('#8f7cf0', { transparent: true, opacity: 0.22, emissive: '#8f7cf0', emissiveIntensity: 0.4, side: DoubleSide }),
    pawn: material('#9aaeb9'), me: material(COLOR.me), seat: material(COLOR.seat), lock: material(COLOR.lock, { emissive: COLOR.lock, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }),
    marker: material(COLOR.me, { emissive: COLOR.me, emissiveIntensity: 0.8 }),
    tether: { me: material(COLOR.me, { emissive: COLOR.me, emissiveIntensity: 0.9 }), seat: material(COLOR.seat, { emissive: COLOR.seat, emissiveIntensity: 0.9 }) },
  };
  const textures = new Map<string, Promise<Texture | null>>();
  const loadTexture = ctx.loadTexture ?? (url => new TextureLoader().loadAsync(url));
  const itemMaterial = (icon: string | null): SpriteMaterial => {
    const sprite = new SpriteMaterial({ color: COLOR.item, depthTest: false, transparent: true });
    if (!icon) return sprite;
    let texture = textures.get(icon);
    if (!texture) { texture = loadTexture(icon).catch(() => null); textures.set(icon, texture); }
    void texture.then(loaded => { if (loaded) { sprite.map = loaded; sprite.color.set('#ffffff'); sprite.needsUpdate = true; } });
    return sprite;
  };

  // --- platform --------------------------------------------------------------------------------------------------
  const platform = new Group(); platform.name = 'render3d-carousel-platform';
  const scenery = new Group(); scenery.name = 'render3d-carousel-scenery';
  const standIn = new Group(); standIn.name = 'render3d-carousel-standin';
  const units = new Group(); units.name = 'render3d-carousel-units'; // the turning display group
  const seats = new Group(); seats.name = 'render3d-carousel-seats';
  const taken = new Group(); taken.name = 'render3d-carousel-taken'; // units off the ring with their legends, and the tethers
  scene.add(platform, scenery, standIn, seats, units, taken);
  const pieces = new Map<string, ModelLease>();
  let platformLoading = 0, built = false;
  const buildStandIn = () => {
    const disc = new Mesh(geometry.disc, materials.disc); disc.position.y = -0.1 * cell;
    const glass = new Mesh(geometry.glass, materials.glass); glass.position.y = 0.03 * cell;
    standIn.add(disc, glass);
    for (let index = 0; index < 8; index++) {
      const cradle = new Mesh(geometry.cradle, materials.cradle);
      cradle.position.copy(anchorAt(index, 8, LEGEND_RADIUS)).setY(0.1 * cell);
      standIn.add(cradle);
    }
  };
  const buildPlatform = () => {
    if (built) return;
    built = true; buildStandIn();
    if (!ctx.loadModel) return;
    for (const id of [...CAROUSEL_PLATFORM, ...CAROUSEL_SCENERY]) {
      if (!ctx.hasModel(id)) continue;
      platformLoading++;
      void ctx.loadModel(id).then(lease => {
        platformLoading--;
        if (!built || lease.placeholder) { lease.release(); return; }
        // GLBs carry the source transform and X mirror: one shared scale, nothing else.
        lease.scene.scale.setScalar(ctx.sourceScale); lease.scene.name = id;
        (CAROUSEL_SCENERY as readonly string[]).includes(id) ? scenery.add(lease.scene) : platform.add(lease.scene);
        pieces.set(id, lease);
        standIn.visible = !pieces.size;
        resurface();
      }).catch(() => { platformLoading--; });
    }
  };
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  /** Height of the named surfaces under (x, z), else the stand-in disc's top plus the doc's quarter cell. */
  const surfaceAt = (x: number, z: number, ids: readonly string[]): number => {
    const targets = ids.flatMap(id => pieces.get(id)?.scene ?? []);
    if (targets.length) {
      platform.updateWorldMatrix(true, true);
      ray.set(new Vector3(x, 60 * cell, z), down);
      const hit = ray.intersectObjects(targets, true)[0];
      if (hit) return hit.point.y;
    }
    return FEET * cell;
  };

  // --- layout ----------------------------------------------------------------------------------------------------
  function anchorAt(index: number, count: number, radius: number): Vector3 {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    return new Vector3(Math.sin(angle) * radius * cell, 0, Math.cos(angle) * radius * cell);
  }
  let unitFeet = FEET * cell;
  const resurface = () => {
    for (const view of seatViews.values()) { view.anchor.y = surfaceAt(view.anchor.x, view.anchor.z, LEGEND_SURFACE); view.root.position.copy(view.anchor); }
    unitFeet = surfaceAt(0, UNIT_RADIUS * cell, UNIT_SURFACE);
    for (const view of unitViews.values()) if (!view.takenBy) styleCue(view);
    measureRim(); frameCamera();
  };
  let azimuth = 0, intro = 0;
  // The rim the camera keeps in view: the ring's outer edge from the platform's lowest to its highest point, and the
  // heads of legends standing on the cradles.
  const rim: Vector3[] = [];
  let fitted = { key: '', distance: 0 };
  const measureRim = () => {
    fitted = { key: '', distance: 0 };
    const radius = STAGE_RADIUS * cell;
    const drawn = pieces.size ? platform : standIn, box = new Box3();
    drawn.updateWorldMatrix(true, true); box.setFromObject(drawn);
    // The rim's floor is the underside of the pedestal ring itself: the lowest vertex out at the ring (from RIM_BAND of
    // its radius outward) and above STRUT_DEPTH. Not the model's lowest point: the struts under the platform reach far
    // down, and fitting them pushed the camera back until the arena filled a third of the view (playtest 10-22). Its top
    // is the legends' heads, not the glass domes over them.
    let bottom = 0;
    const vertex = new Vector3();
    drawn.traverse(object => {
      const mesh = object as Mesh, position = mesh.isMesh ? mesh.geometry?.getAttribute('position') : undefined;
      if (!position) return;
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        if (vertex.y < bottom && vertex.y >= -STRUT_DEPTH * cell && Math.hypot(vertex.x, vertex.z) >= RIM_BAND * radius) bottom = vertex.y;
      }
    });
    const top = box.isEmpty() ? 0 : Math.max(0, Math.min(box.max.y, surfaceAt(0, LEGEND_RADIUS * cell, LEGEND_SURFACE) + legendHeight));
    const head = surfaceAt(0, LEGEND_RADIUS * cell, LEGEND_SURFACE) + legendHeight;
    rim.length = 0;
    for (let i = 0; i < RIM_POINTS; i++) {
      const angle = i / RIM_POINTS * Math.PI * 2, x = Math.sin(angle), z = Math.cos(angle);
      rim.push(new Vector3(x * radius, bottom, z * radius), new Vector3(x * radius, top, z * radius),
        new Vector3(x * LEGEND_RADIUS * cell, head, z * LEGEND_RADIUS * cell));
    }
  };
  const place = (direction: Vector3, target: Vector3, distance: number) => {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };
  const fits = () => rim.every(point => {
    const ndc = point.clone().project(camera);
    return ndc.z < 1 && Math.abs(ndc.x) <= FRAME_FILL && Math.abs(ndc.y) <= FRAME_FILL;
  });
  const frameCamera = () => {
    if (!rim.length) measureRim();
    const direction = VIEW.clone().applyAxisAngle(new Vector3(0, 1, 0), azimuth);
    const target = new Vector3(0, legendHeight * 0.5, 0);
    // The nearest distance that still fits the rim, by bisection (the fit only gets easier farther out), in the projection
    // as drawn: the host sets its view offset after resize(), so each update re-checks. Kept until the view's shape or
    // offset, its side or the platform changes.
    const view = camera.view;
    const key = `${camera.aspect}/${azimuth}/${view?.enabled ? [view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height].join(',') : ''}`;
    if (fitted.key !== key) {
      let near = STAGE_RADIUS * cell * 0.5, far = STAGE_RADIUS * cell * 20;
      for (let step = 0; step < 24; step++) {
        const middle = (near + far) / 2;
        place(direction, target, middle);
        if (fits()) far = middle; else near = middle;
      }
      fitted = { key, distance: far };
    }
    const far = fitted.distance;
    // Opening push-in, eased out: farther and higher at the start.
    const t = intro / INTRO_SECONDS, ease = t * t * (3 - 2 * t);
    direction.y += INTRO_LIFT * ease; direction.normalize();
    place(direction, target, far * (1 + INTRO_PULL * ease));
  };

  // --- bodies ----------------------------------------------------------------------------------------------------
  const fit = (body: Object3D, height: number, width = Infinity) => {
    const bounds = new Box3().setFromObject(body), size = bounds.getSize(new Vector3());
    const scale = Math.min(size.y > 0 ? height / size.y : Infinity, Math.max(size.x, size.z) > 0 ? width / Math.max(size.x, size.z) : Infinity);
    if (!Number.isFinite(scale)) return body;
    body.scale.multiplyScalar(scale); body.position.y -= bounds.min.y * scale;
    return body;
  };
  const attach = (view: Body, id: string, height: number, width?: number, load = ctx.loadModel && ctx.hasModel(id) ? ctx.loadModel : null) => {
    if (!load) return;
    void load(id).then(lease => {
      if (view.disposed || lease.placeholder) { lease.release(); return; }
      view.root.clear(); view.lease = lease;
      // A champion at the asset root's official scale (model-fit.ts) when it has one; legends and older roots are fitted.
      const unitScale = ctx.unitScale?.(id) ?? null;
      if (unitScale) {
        const envelope = ctx.envelope?.(id, lease);
        fitModel(lease.scene, { height, width, unitScale, sourceScale: ctx.sourceScale, envelopeRadius: envelope?.radius, ground: envelope?.ground, feet: standingFeet(id, envelope) });
        view.root.add(lease.scene);
      }
      else view.root.add(fit(lease.scene, height, width));
      view.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      view.mixer.apply(view.state.output);
    }).catch(() => { /* keeps the stand-in */ });
  };
  const releaseBody = (view: Body) => { view.disposed = true; view.mixer?.dispose(); view.mixer = null; view.lease?.release(); view.lease = null; };

  // --- seats -----------------------------------------------------------------------------------------------------
  const seatViews = new Map<string, SeatView>();
  const legendOf = (legend: string | undefined) => legend && ctx.hasModel(`little-legend-${legend}`) ? `little-legend-${legend}` : ctx.legendModel;
  const createSeat = (seatId: string, me: boolean, index: number, count: number, legend: string | undefined): SeatView => {
    const root = new Group(); root.name = `render3d-carousel-seat-${me ? 'me' : 'other'}`;
    const anchor = anchorAt(index, Math.max(8, count), LEGEND_RADIUS);
    anchor.y = surfaceAt(anchor.x, anchor.z, LEGEND_SURFACE);
    root.position.copy(anchor);
    root.rotation.y = Math.atan2(-anchor.x, -anchor.z); // models face +z: toward the center
    const body = new Mesh(geometry.legend, me ? materials.me : materials.seat); body.scale.set(1, 0.82, 1); body.position.y = 12;
    const stand = new Group(); stand.name = 'render3d-carousel-legend-standin'; stand.add(body);
    root.add(fit(stand, legendHeight));
    seats.add(root);
    const tether = new Mesh(geometry.tether, me ? materials.tether.me : materials.tether.seat); tether.name = 'render3d-carousel-tether'; tether.visible = false;
    taken.add(tether);
    const view: SeatView = { seatId, me, anchor, root, lease: null, mixer: null, state: new Stride(), disposed: false, lock: null, indicator: null,
      releaseAtMs: Infinity, locked: false, chase: null, goal: null, speed: 0, path: null, carry: null, tether, countdown: null };
    // A legend that cannot be drawn (refused, placeholder) falls back to the default model before the stand-in.
    attach(view, legendOf(legend), legendHeight, undefined, ctx.loadModel ? id => loadLegendLease(model => ctx.hasModel(model) ? ctx.loadModel!(model) : Promise.reject(new Error('unknown-model')), id, ctx.legendModel) : null);
    return view;
  };
  const dropCountdown = (view: SeatView) => {
    if (!view.countdown) return;
    view.countdown.sprite.removeFromParent(); view.countdown.sprite.material.dispose(); view.countdown.texture.dispose(); view.countdown = null;
  };
  const dropSeat = (view: SeatView) => {
    releaseBody(view); endLoop(view.lock); endLoop(view.indicator); dropCountdown(view);
    view.root.removeFromParent(); view.tether.removeFromParent();
  };
  /** "N" seconds over a held legend's head; no canvas (tests, a worker) draws none. */
  const showCountdown = (view: SeatView, text: string) => {
    if (!text) { dropCountdown(view); return; }
    if (view.countdown?.text === text) return;
    if (!view.countdown) {
      const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
      if (!canvas?.getContext('2d')) return;
      canvas.width = canvas.height = 64;
      const texture = new CanvasTexture(canvas);
      const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
      sprite.name = 'render3d-carousel-countdown'; sprite.scale.setScalar(COUNTDOWN_SIZE); sprite.renderOrder = 1002;
      sprite.position.y = legendHeight + COUNTDOWN_SIZE;
      view.root.add(sprite);
      view.countdown = { sprite, texture, canvas, text: '' };
    }
    const draw = view.countdown.canvas.getContext('2d')!;
    draw.clearRect(0, 0, 64, 64);
    draw.fillStyle = 'rgba(10, 16, 24, .72)'; draw.beginPath(); draw.arc(32, 32, 30, 0, Math.PI * 2); draw.fill();
    draw.fillStyle = view.me ? COLOR.me : '#e6e0f8'; draw.font = 'bold 34px sans-serif'; draw.textAlign = 'center'; draw.textBaseline = 'middle';
    draw.fillText(text, 32, 34);
    view.countdown.texture.needsUpdate = true; view.countdown.text = text;
  };

  // --- effects ---------------------------------------------------------------------------------------------------
  const loops = new Set<Loop>(), bursts = new Set<Burst>();
  const placeEffect = (fx: ParticleEffect, point: Vector3, parent: Object3D = scene) => {
    fx.object.scale.setScalar(ctx.sourceScale); fx.object.position.copy(point); parent.add(fx.object);
  };
  const startLoop = (loop: Loop) => {
    if (!ctx.loadEffect || loop.loading || loop.disposed) return;
    loop.loading = true;
    void ctx.loadEffect(loop.id, loop.seconds).then(fx => {
      loop.loading = false;
      if (loop.disposed) { fx.dispose(); return; }
      placeEffect(fx, loop.point, loop.parent); loop.fx = fx; loop.left = loop.seconds;
      if (loop.stand) loop.stand.visible = false;
    }).catch(() => { loop.loading = false; });
  };
  const loop = (id: string, seconds: number, point: Vector3, stand: Mesh | null, parent?: Object3D): Loop => {
    const entry: Loop = { id, seconds, point: point.clone(), fx: null, stand, left: 0, loading: false, disposed: false, ...(parent ? { parent } : {}) };
    if (stand) { stand.position.copy(point); (parent ?? scene).add(stand); }
    loops.add(entry); startLoop(entry);
    return entry;
  };
  function endLoop(entry: Loop | null) {
    if (!entry) return;
    entry.disposed = true; entry.fx?.dispose(); entry.fx = null; entry.stand?.removeFromParent(); loops.delete(entry);
  }
  const burst = (id: string, seconds: number, point: Vector3, color: string) => {
    const entry: Burst = { fx: null, mesh: null, left: seconds, total: POP_SECONDS, disposed: false };
    bursts.add(entry);
    const fallback = () => {
      if (entry.disposed) return;
      const mesh = new Mesh(geometry.lock, new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.copy(point); scene.add(mesh);
      entry.mesh = mesh; entry.left = POP_SECONDS;
    };
    if (!ctx.loadEffect) { fallback(); return; }
    void ctx.loadEffect(id, seconds).then(fx => {
      if (entry.disposed) { fx.dispose(); return; }
      placeEffect(fx, point); entry.fx = fx;
    }).catch(fallback);
  };
  /** Stand-in feedback only (the swelling ring), where no extracted effect fits: a seat's chains breaking. */
  const pop = (point: Vector3, color: string) => {
    const entry: Burst = { fx: null, mesh: null, left: POP_SECONDS, total: POP_SECONDS, disposed: false };
    const mesh = new Mesh(geometry.lock, new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(point); scene.add(mesh);
    entry.mesh = mesh; bursts.add(entry);
  };
  const endBurst = (entry: Burst) => {
    entry.disposed = true; entry.fx?.dispose();
    entry.mesh?.removeFromParent(); (entry.mesh?.material as MeshStandardMaterial | undefined)?.dispose();
    bursts.delete(entry);
  };
  let wall: Loop | null = null;

  // --- units -----------------------------------------------------------------------------------------------------
  const unitViews = new Map<number, UnitView>();
  const createUnit = (data: BoardCarouselSlot, index: number, count: number): UnitView => {
    const holder = new Group(); holder.name = 'render3d-carousel-unit';
    const base = anchorAt(index, count, UNIT_RADIUS);
    holder.position.set(base.x, unitFeet, base.z);
    holder.rotation.y = (index / Math.max(1, count)) * Math.PI * 2 + Math.PI / 2; // facing along the ring
    const root = new Group();
    const pawn = new Group(); pawn.name = 'render3d-carousel-pawn';
    const body = new Mesh(geometry.pawn, materials.pawn); body.position.y = 17;
    const head = new Mesh(geometry.head, materials.pawn); head.position.y = 42;
    pawn.add(body, head); root.add(fit(pawn, ctx.championHeight * 0.6)); root.scale.setScalar(UNIT_SIZE);
    const quality = new Sprite(new SpriteMaterial({ color: data.cost ? ctx.costColor?.(data.cost) ?? '#9aa4ae' : '#9aa4ae',
      depthTest: false, depthWrite: false, transparent: true }));
    quality.name = 'render3d-carousel-quality'; quality.renderOrder = 1001; quality.scale.setScalar(QUALITY_SIZE);
    quality.position.set(-STAR_SIZE * 3, ctx.championHeight * UNIT_SIZE + STAR_GAP, 0);
    const stars = createStarMark({ effectiveStarLevel: data.starLevel, colorFor: ctx.starColor });
    stars.object.scale.setScalar(STAR_SIZE); stars.object.position.y = ctx.championHeight * UNIT_SIZE + STAR_GAP;
    holder.add(root, stars.object, quality);
    const view: UnitView = { slot: data.slot, definitionId: data.definitionId, holder, root, quality, stars, items: [], data, takenBy: null,
      lease: null, mixer: null, state: new Stride(), disposed: false };
    // Item marks bound to the same slot, above the stars.
    data.items.forEach((item, at) => {
      const sprite = new Sprite(itemMaterial(item.icon)); sprite.name = `render3d-carousel-item-${item.id}`;
      sprite.scale.setScalar(ITEM_SIZE); sprite.renderOrder = 1001;
      sprite.position.set((at - (data.items.length - 1) / 2) * (ITEM_SIZE + 3), ctx.championHeight * UNIT_SIZE + STAR_GAP + STAR_SIZE + ITEM_SIZE * 0.6, 0);
      holder.add(sprite); view.items.push(sprite);
    });
    units.add(holder);
    attach(view, data.definitionId, ctx.championHeight, ctx.championWidth);
    return view;
  };
  const dropUnit = (view: UnitView) => {
    view.quality.material.dispose();
    releaseBody(view); view.stars.dispose();
    for (const sprite of view.items) sprite.material.dispose();
    view.holder.removeFromParent();
  };

  // --- view ------------------------------------------------------------------------------------------------------
  let current: BoardCarousel | null = null, hovered: number | null = null;
  const claimedSeats = new Set<string>();
  const styleCue = (view: UnitView) => {
    if (view.takenBy) return;
    const { takable, pending } = view.data;
    view.quality.visible = !!view.data.cost || takable || pending;
    view.quality.material.opacity = takable || pending ? 1 : 0.35;
    view.holder.position.y = unitFeet + (pending ? PENDING_LIFT : takable && hovered === view.slot ? HOVER_LIFT : 0);
  };
  const clear = () => {
    for (const view of unitViews.values()) dropUnit(view);
    unitViews.clear();
    for (const view of seatViews.values()) dropSeat(view);
    seatViews.clear();
    endLoop(wall); wall = null;
    for (const entry of [...loops]) endLoop(entry);
    for (const entry of [...bursts]) endBurst(entry);
    for (const lease of pieces.values()) lease.release();
    pieces.clear(); platform.clear(); scenery.clear(); standIn.clear(); standIn.visible = true; built = false;
    current = null; hovered = null; intro = 0; claimedSeats.clear();
  };
  /** Logical ms since the carousel opened, by the view's clock. */
  const elapsedNow = () => current ? current.elapsedMs + (now() - current.at) : 0;
  const pickedBy = (seatId: string) => !!current?.slots.some(slot => slot.pickedBy === seatId);
  /**
   * Held seats by the view's release times: the restraint (its stand-in a ring at the feet) and the seconds left over the
   * head; at release the chains break once (stand-in pop) and, for me, the first-draft wall fades and the callout flashes.
   */
  const syncLocks = (first: boolean) => {
    if (!current) return;
    const elapsed = elapsedNow();
    let held = false;
    for (const entry of seatViews.values()) {
      const locked = entry.releaseAtMs > elapsed && !pickedBy(entry.seatId);
      if (locked && !entry.lock) {
        const stand = new Mesh(geometry.lock, materials.lock); stand.rotation.x = -Math.PI / 2;
        entry.lock = loop(entry.me ? FX.restraint : FX.restraintEnemy, RESTRAINT_EARLY_SECONDS, entry.anchor.clone().setY(entry.anchor.y + 1), stand);
      } else if (!locked && entry.lock) {
        endLoop(entry.lock); entry.lock = null;
        if (!first && entry.locked) { pop(entry.root.position.clone().setY(entry.root.position.y + 1), COLOR.lock); if (entry.me) ctx.onReleased?.(); }
      }
      entry.locked = locked;
      if (entry.me) held = locked;
      showCountdown(entry, locked && Number.isFinite(entry.releaseAtMs) ? String(Math.max(1, Math.ceil((entry.releaseAtMs - elapsed) / 1000))) : '');
    }
    // First-draft wall at the center while my seat is still held; its fade plays once when I am released.
    if (held && !wall) {
      const stand = new Mesh(geometry.wall, materials.wall);
      wall = loop(FX.wall, WALL_SECONDS, new Vector3(0, 0.3 * cell, 0), stand);
      stand.position.y = 0.3 * cell;
    } else if (!held && wall) {
      endLoop(wall); wall = null;
      if (!first) burst(FX.wallEnd, WALL_END_SECONDS, new Vector3(0, 0.3 * cell, 0), COLOR.lock);
    }
  };
  /** Where a unit trails its legend: behind it, both while walking and standing. */
  const trailPoint = (seat: SeatView, out: Vector3) => {
    const facing = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), seat.root.rotation.y);
    return out.copy(seat.root.position).addScaledVector(facing, -TETHER_CELLS * cell);
  };
  /** A confirmed pick attaches the unit to its legend without changing that legend's destination. */
  const take = (unit: UnitView, seat: SeatView, settled: boolean) => {
    claimedSeats.add(seat.seatId);
    unit.takenBy = seat.seatId;
    unit.quality.visible = false; unit.holder.position.y = unitFeet;
    taken.attach(unit.holder);
    for (const other of seatViews.values()) if (other !== seat && other.chase === unit) { other.chase = null; other.goal = null; }
    // A receipt confirms contact on the server. Never start another chase or replace the walk with a trip home.
    grab(seat, unit, !settled);
    if (settled) trailPoint(seat, unit.holder.position).setY(seat.root.position.y);
  };
  const grab = (seat: SeatView, unit: UnitView, feedback = true) => {
    seat.chase = null; seat.carry = unit; seat.tether.visible = true;
    if (feedback) burst(FX.selected, SELECTED_SECONDS, unit.holder.getWorldPosition(new Vector3()), COLOR.pending);
  };

  const show = (view: BoardCarousel | null) => {
    if (!view) { if (current) clear(); return; }
    if (current && current.id !== view.id) clear();
    buildPlatform();
    const first = !current;
    current = view;
    if (first) intro = INTRO_SECONDS;

    // Seats: stable public order; my seat's side faces the camera.
    view.seats.forEach((seat, index) => {
      let entry = seatViews.get(seat.seatId);
      if (!entry) { entry = createSeat(seat.seatId, seat.me, index, view.seats.length, seat.legend); seatViews.set(seat.seatId, entry); }
      entry.releaseAtMs = seat.releaseAtMs;
      if (seat.me) azimuth = Math.atan2(entry.anchor.x, entry.anchor.z);
      if (seat.me && !entry.indicator) {
        // The indicator rides on my legend as it walks.
        const stand = new Mesh(geometry.marker, materials.marker);
        entry.indicator = loop(FX.indicator, INDICATOR_SECONDS, new Vector3(0, legendHeight + 14, 0), stand, entry.root);
      }
    });
    for (const [seatId, entry] of seatViews) if (!view.seats.some(seat => seat.seatId === seatId)) {
      for (const unit of [entry.carry, entry.chase]) if (unit?.takenBy === seatId) { dropUnit(unit); unitViews.delete(unit.slot); }
      dropSeat(entry); seatViews.delete(seatId);
    }
    frameCamera();
    syncLocks(first);

    // Units: placed by stable slot order; one leaves the ring only when the view names who took it.
    const standing = view.slots;
    standing.forEach((slot, index) => {
      let entry = unitViews.get(slot.slot);
      if (entry && entry.definitionId !== slot.definitionId) { releaseTaken(entry); dropUnit(entry); unitViews.delete(slot.slot); entry = undefined; }
      const taker = slot.pickedBy ? seatViews.get(slot.pickedBy) : undefined;
      if (slot.pickedBy && !taker) {
        // Nobody here to fetch it (a seat the view no longer lists): it just leaves, with the selection burst.
        if (entry) {
          const point = entry.holder.getWorldPosition(new Vector3());
          releaseTaken(entry); dropUnit(entry); unitViews.delete(slot.slot);
          if (!first) burst(FX.selected, SELECTED_SECONDS, point, COLOR.pending);
        }
        return;
      }
      // Already taken when this carousel was first shown: by its legend at home; one I never saw stand is not drawn.
      if (!entry && slot.pickedBy && !first) return;
      if (!entry) { entry = createUnit(slot, index, standing.length); unitViews.set(slot.slot, entry); }
      entry.data = slot; entry.stars.setLevel(slot.starLevel);
      if (taker && entry.takenBy !== taker.seatId) take(entry, taker, first);
      if (!entry.takenBy) styleCue(entry);
    });
    for (const [slot, entry] of unitViews) if (!standing.some(candidate => candidate.slot === slot)) { releaseTaken(entry); dropUnit(entry); unitViews.delete(slot); }
    if (hovered !== null && (!unitViews.has(hovered) || unitViews.get(hovered)!.takenBy)) hovered = null;

    // My pick is out: my legend heads for that unit while it still stands; a refusal (no pending, not mine) stops it there.
    const mine = [...seatViews.values()].find(entry => entry.me);
    if (mine && !mine.carry) {
      const pending = standing.find(slot => slot.pending && !slot.pickedBy);
      const target = pending ? unitViews.get(pending.slot) : undefined;
      if (target && !target.takenBy && !mine.path) { mine.chase = target; mine.goal = null; mine.speed = RUN_CELLS * cell; }
      else if (mine.chase && !mine.chase.takenBy) { mine.chase = null; mine.goal = null; }
    }
  };
  /** A unit about to go: no legend keeps running for it or dragging it. */
  function releaseTaken(unit: UnitView) {
    for (const seat of seatViews.values()) {
      if (seat.chase === unit) {
        seat.chase = null;
      }
      if (seat.carry === unit) { seat.carry = null; seat.tether.visible = false; }
    }
  }

  const orbitAngle = () => {
    if (!current) return 0;
    return (Math.max(0, elapsedNow() / 1000) / ORBIT_SECONDS) * Math.PI * 2;
  };
  const step = new Vector3(), aim = new Vector3(), up = new Vector3(0, 1, 0), from = new Vector3(), to = new Vector3();
  /** One legend's run: toward its unit (grabbing it on reach when the view says it is this seat's) or its goal. */
  const moveSeat = (seat: SeatView, seconds: number) => {
    let target: Vector3 | null = null;
    if (seat.chase) target = seat.chase.holder.getWorldPosition(aim);
    else if (seat.goal) target = aim.copy(seat.goal);
    let moving = false;
    const path = seat.path;
    if (path && !target) {
      // The room's walk: on its line, arriving when the room says (its pick, if any, follows from the view).
      const span = path.end - path.start, t = span <= 0 ? 1 : Math.min(1, Math.max(0, (now() - path.start) / span));
      seat.root.position.lerpVectors(path.from, path.to, t);
      seat.root.position.y = surfaceAt(seat.root.position.x, seat.root.position.z, [...LEGEND_SURFACE, ...UNIT_SURFACE]);
      if (path.from.distanceToSquared(path.to) > 1) seat.root.rotation.y = Math.atan2(path.to.x - path.from.x, path.to.z - path.from.z);
      moving = t < 1;
      if (!moving) seat.path = null;
    } else if (target) {
      step.copy(target).sub(seat.root.position).setY(0);
      const reach = seat.chase ? GRAB_CELLS * cell : 0.5;
      const distance = step.length();
      if (distance > reach) {
        moving = true;
        seat.root.rotation.y = Math.atan2(step.x, step.z);
        seat.root.position.addScaledVector(step, Math.min(1, seat.speed * seconds / distance));
        seat.root.position.y = surfaceAt(seat.root.position.x, seat.root.position.z, [...LEGEND_SURFACE, ...UNIT_SURFACE]);
      } else if (seat.chase) {
        // Reached it: mine only once the view says I took it; until then it waits by the turning unit.
        if (seat.chase.takenBy === seat.seatId) grab(seat, seat.chase);
      } else {
        seat.goal = null;
        // Home: face the center again, as on the cradle.
        if (seat.root.position.distanceToSquared(seat.anchor) < 1) { seat.root.position.copy(seat.anchor); seat.root.rotation.y = Math.atan2(-seat.anchor.x, -seat.anchor.z); }
      }
    }
    seat.state.set(moving);
    const unit = seat.carry;
    if (!unit) return;
    // The unit trails on its tether (a little lag), facing its legend; the tether runs chest to chest.
    trailPoint(seat, to);
    unit.holder.position.lerp(to.setY(seat.root.position.y), 1 - Math.exp(-seconds / 0.15));
    step.copy(seat.root.position).sub(unit.holder.position).setY(0);
    if (step.lengthSq() > 1) unit.holder.rotation.y = Math.atan2(step.x, step.z);
    unit.state.set(moving);
    from.copy(seat.root.position).setY(seat.root.position.y + legendHeight * 0.55);
    to.copy(unit.holder.position).setY(unit.holder.position.y + ctx.championHeight * UNIT_SIZE * 0.45);
    const length = from.distanceTo(to);
    seat.tether.visible = length > 1;
    if (length > 1) {
      seat.tether.position.copy(from);
      seat.tether.scale.set(1, length, 1);
      seat.tether.quaternion.setFromUnitVectors(up, step.copy(to).sub(from).normalize());
    }
  };
  const update = (seconds: number) => {
    if (!current) return;
    units.rotation.y = orbitAngle();
    syncLocks(false);
    if (intro > 0) intro = Math.max(0, intro - seconds);
    frameCamera(); // cheap unless the projection changed since the last fit
    for (const seat of seatViews.values()) moveSeat(seat, seconds);
    for (const view of [...seatViews.values(), ...unitViews.values()]) {
      const output = view.state.output;
      if (view.mixer) { view.mixer.apply(output); view.mixer.update(seconds); }
    }
    for (const entry of loops) {
      if (!entry.fx) continue;
      entry.fx.update(seconds, camera);
      entry.left -= seconds;
      if (entry.fx.finished || entry.left <= 0) { entry.fx.dispose(); entry.fx = null; if (entry.stand) entry.stand.visible = true; startLoop(entry); }
    }
    for (const entry of bursts) {
      entry.left -= seconds;
      if (entry.fx) entry.fx.update(seconds, camera);
      else if (entry.mesh) {
        const t = 1 - Math.max(0, entry.left) / entry.total;
        entry.mesh.scale.setScalar(1 + t * 1.4);
        (entry.mesh.material as MeshStandardMaterial).opacity = 1 - t;
      }
      if (entry.left <= 0 || entry.fx?.finished) endBurst(entry);
    }
  };

  const ground = new Plane(new Vector3(0, 1, 0), 0), groundHit = new Vector3();
  const walkTo = (client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }) => {
    const mine = movable();
    if (!mine || area.width <= 0 || area.height <= 0) return null;
    camera.updateMatrixWorld();
    pointer.setFromCamera(new Vector2((client.x - area.left) / area.width * 2 - 1, 1 - (client.y - area.top) / area.height * 2), camera);
    ground.constant = -mine.anchor.y;
    if (!pointer.ray.intersectPlane(ground, groundHit)) return null;
    groundHit.setY(0);
    const limit = ROAM_RADIUS * cell;
    if (groundHit.length() > limit) groundHit.setLength(limit);
    mine.chase = null; mine.path = null;
    mine.goal = groundHit.clone().setY(mine.root.position.y); mine.speed = RUN_CELLS * cell;
    return { x: groundHit.x / cell, y: groundHit.z / cell };
  };
  /** Ground movement remains available after a pick. */
  const movable = () => {
    const mine = [...seatViews.values()].find(entry => entry.me);
    // A panel pick still out (a client without walks) holds it too, as before walks.
    const out = current?.slots.some(slot => slot.pending && !slot.pickedBy);
    return current && mine && !out && !mine.locked ? mine : null;
  };
  const runTo = (slot: number) => {
    const mine = movable(), unit = unitViews.get(slot);
    if (!mine || !unit || unit.takenBy || mine.carry || claimedSeats.has(mine.seatId) || pickedBy(mine.seatId)) return false;
    mine.chase = unit; mine.goal = null; mine.path = null; mine.speed = RUN_CELLS * cell;
    return true;
  };
  /** The room's walk for one seat, including a seat already carrying its unit. */
  const applyWalk = (walk: BoardLegendWalk) => {
    const seat = seatViews.get(walk.seatId);
    if (!current || walk.scene !== 'carousel' || !seat) return;
    seat.chase = null; seat.goal = null;
    const to = new Vector3(walk.to.x * cell, seat.root.position.y, walk.to.y * cell);
    // Draw the authoritative line and timing; easing from a predicted position can make a valid contact look remote.
    seat.path = { from: new Vector3(walk.from.x * cell, seat.root.position.y, walk.from.y * cell),
      to, start: walk.startedAt, end: walk.arriveAt };
  };

  const pointer = new Raycaster();
  /**
   * Same rule as the board pick (#349): each unit still on the turning ring has a fixed box at its live position, a bit
   * over a cell wide and from its feet to its star, with some slack for a moving target; where boxes overlap, the unit
   * nearest the pointer wins. No mesh test, so a thin model or a legend in front never swallows the click.
   */
  const slotAt = (client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }) => {
    if (!current || area.width <= 0 || area.height <= 0) return null;
    const px = client.x - area.left, py = client.y - area.top;
    if (px < 0 || px > area.width || py < 0 || py > area.height) return null;
    units.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize(), scale = new Vector3();
    const screen = (at: Vector3) => { at.project(camera); return { x: (at.x + 1) / 2 * area.width, y: (1 - at.y) / 2 * area.height }; };
    let best: UnitView | null = null, bestDistance = Infinity;
    for (const view of unitViews.values()) {
      if (view.takenBy) continue;
      const base = view.holder.getWorldPosition(new Vector3()), size = view.holder.getWorldScale(scale).x;
      const feet = screen(base.clone()), star = screen(view.stars.object.getWorldPosition(new Vector3()));
      const side = screen(base.clone().addScaledVector(right, PICK_HALF_WIDTH * UNIT_SIZE * cell * size));
      const half = Math.hypot(side.x - feet.x, side.y - feet.y), slack = half * 0.4;
      if (Math.abs(px - feet.x) > half || py < star.y - slack || py > feet.y + slack) continue;
      // Distance to the unit's drawn axis (feet to star): a taller neighbour's middle no longer wins at another's feet.
      const dx = star.x - feet.x, dy = star.y - feet.y, length = dx * dx + dy * dy;
      const t = length > 0 ? Math.min(1, Math.max(0, ((px - feet.x) * dx + (py - feet.y) * dy) / length)) : 0;
      const distance = Math.hypot(px - (feet.x + dx * t), py - (feet.y + dy * t));
      if (distance < bestDistance) { best = view; bestDistance = distance; }
    }
    return best ? { slot: best.slot, takable: best.data.takable } : null;
  };

  return {
    scene, camera,
    get active() { return current !== null; },
    show, update, slotAt, walkTo, runTo, walk: applyWalk,
    descriptionAt(client, area) {
      if (!current) return;
      for (const view of unitViews.values()) {
        const hit = spritePick(view.items, client, camera, area);
        if (hit) return { target: { kind: 'item', id: view.data.items[hit.index]!.id }, box: hit.box };
      }
      const hit = slotAt(client, area), view = hit && unitViews.get(hit.slot);
      if (!view) {
        for (const carried of unitViews.values()) {
          if (!carried.takenBy) continue;
          const box = projectedBox(carried.root, camera, area);
          if (box && contains(box, client)) return { target: { kind: 'carousel', unit: carried.data }, box };
        }
        return;
      }
      const box = projectedBox(view.root, camera, area);
      if (box) return { target: { kind: 'carousel', unit: view.data }, box };
    },
    resize(next) { if (next > 0) { camera.aspect = next; camera.updateProjectionMatrix(); frameCamera(); } },
    hover(slot) {
      if (hovered === slot) return;
      hovered = slot;
      for (const view of unitViews.values()) styleCue(view);
    },
    debug: () => ({
      platform: [...pieces.keys()].concat(standIn.visible && built ? ['standin'] : []).concat(platformLoading ? [`loading:${platformLoading}`] : []),
      legends: [...seatViews.values()].map(view => `${view.seatId}:${view.lease ? 'model' : 'standin'}${view.lock ? ':locked' : ''}`
        + (view.chase ? ':chase' : view.carry ? ':carry' : view.goal || view.path ? ':walk' : '')),
      units: [...unitViews.values()].map(view => ({ slot: view.slot, body: view.lease ? 'model' : 'standin', items: view.items.length,
        cue: view.takenBy ? 'none' : view.data.pending ? 'pending' : view.data.takable ? hovered === view.slot ? 'hover' : 'takable' : 'none' })),
      effects: [...loops].map(entry => `${entry.id}:${entry.fx ? 'fx' : 'standin'}`).concat([...bursts].map(entry => `burst:${entry.fx ? 'fx' : 'standin'}`)),
      angle: units.rotation.y,
      fetched: Object.fromEntries([...seatViews.values()].flatMap(view => view.carry ? [[view.seatId, view.carry.slot]] : [])),
      countdowns: Object.fromEntries([...seatViews.values()].flatMap(view => view.countdown ? [[view.seatId, view.countdown.text]] : [])),
    }),
    dispose() {
      clear();
      void Promise.all(textures.values()).then(list => list.forEach(texture => texture?.dispose()));
      textures.clear();
      for (const resource of owned) resource.dispose();
    },
  };
}
