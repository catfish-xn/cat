/**
 * The online 选秀 drawn in 3D (docs/ASSETS3D_CAROUSEL.md 界面接线需求): its own scene and camera, shown by the renderer
 * instead of the board while board-feed carries a BoardCarousel. The platform pieces load as one group at the shared
 * model scale (no per-piece centering, mirroring or grounding); eight seat legends stand on the outer cradles in public
 * seat order; the units on offer stand on a ring over the glass, in a display group that alone turns slowly from the
 * carousel's start. Everything comes from the server's carousel view as the 2D panel shows it: a click on a unit is the
 * panel's own slot click, a unit leaves only once the view says it was taken, and nothing here times, releases or picks.
 * Missing models or effects draw stand-ins; the timer ring is not drawn (its extracted effect is incomplete).
 */
import {
  AmbientLight, Box3, Color, CylinderGeometry, DoubleSide, DirectionalLight, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  Raycaster, RingGeometry, Scene, SphereGeometry, Sprite, SpriteMaterial, Texture, TextureLoader, Vector2, Vector3, type Object3D,
} from 'three';
import { UnitActionState, UnitAnimationMixer, createStarMark, type ModelLease, type ParticleEffect, type StarMark } from '../../rendering3d';
import type { BoardCarousel, BoardCarouselSlot } from '../board-feed';

/** Board units per carousel cell, as the asset review lays out the stage (one grid interval; models and effects at .44). */
export const CAROUSEL_CELL = 62.4;
/** Platform pieces in one root (manifest keys); the skybox is optional scenery kept out of feet, picking and the camera. */
export const CAROUSEL_PLATFORM = ['carousel-center', 'carousel-center-b', 'carousel-llplatforms', 'carousel-glassdome-a',
  'carousel-reflectionplane', 'carousel-kitpieces-a', 'carousel-kitpieces-b', 'carousel-kitpieces-c'] as const;
export const CAROUSEL_SCENERY = ['carousel-skybox'] as const;
/** Feet land on these surfaces (a ray from above), never on a whole-model bounding box. */
const LEGEND_SURFACE = ['carousel-llplatforms'], UNIT_SURFACE = ['carousel-glassdome-a', 'carousel-center'];
/** Doc's proposed layout, in cells: legends on the cradles, units on a ring inside the glass; feet without a surface. */
const LEGEND_RADIUS = 7.1, UNIT_RADIUS = 2.5, FEET = 0.25;
/** Display only: one turn of the unit ring takes this long; the angle runs from the carousel's own start. */
const ORBIT_SECONDS = 48;
/** Camera keeps the cradles' outer edge (17.2 cells across) and a legend's height in view, from my seat's side. */
const STAGE_RADIUS = 8.9, VIEW = new Vector3(0, 1.05, 1).normalize();
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
/** Quality ring under each carousel unit, by its cost (S13 shared-draft unittier1..6); bounded and rebuilt like the others. */
const TIER_FX = (cost: number) => `carousel-shareddraft-unittier${Math.min(6, Math.max(1, Math.round(cost)))}`;
const TIER_SECONDS = 4;
const RESTRAINT_EARLY_SECONDS = 1.2, WALL_SECONDS = 10, WALL_END_SECONDS = 2, SELECTED_SECONDS = 1.5, INDICATOR_SECONDS = 30;
/** Stand-in feedback when an effect is missing: a ring that swells and fades this long. */
const POP_SECONDS = 0.5;
const ITEM_SIZE = 18, STAR_SIZE = 12, STAR_GAP = 12;
const COLOR = { me: '#7fd8cf', seat: '#e3a08f', takable: '#68ddd0', pending: '#e6bc76', hover: '#ffd782', lock: '#b4a1f5', item: '#c9d4da' } as const;

export interface CarouselStageContext {
  /** A champion's height and width cap (board units), as on the board; a legend stands half a champion. */
  readonly championHeight: number;
  readonly championWidth: number;
  /** World scale of models' source units and particle effects (the renderer's FX_SCALE). */
  readonly sourceScale: number;
  /** A lease when the manifest names that model; null without an asset root (stand-ins only). */
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  readonly hasModel: (id: string) => boolean;
  readonly loadEffect: ((id: string, maxDuration: number) => Promise<ParticleEffect>) | null;
  readonly legendModel: string;
  readonly starColor: (level: number) => string;
  /** Item icon textures (tests pass a stub); defaults to three's TextureLoader. */
  readonly loadTexture?: (url: string) => Promise<Texture>;
  readonly now?: () => number;
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
  /** Acceptance read (?debug3d). */
  debug(): { platform: string[]; legends: string[]; units: { slot: number; body: string; items: number; ring: string }[]; effects: string[]; angle: number };
  dispose(): void;
}

interface Body { root: Group; lease: ModelLease | null; mixer: UnitAnimationMixer | null; state: UnitActionState; disposed: boolean }
interface UnitView extends Body {
  readonly slot: number; readonly definitionId: string; readonly holder: Group; readonly ring: Mesh; readonly proxy: Mesh;
  stars: StarMark; items: Sprite[]; data: BoardCarouselSlot; tier: Loop | null;
}
interface SeatView extends Body { readonly seatId: string; readonly me: boolean; readonly anchor: Vector3; lock: Loop | null; indicator: Loop | null }
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
    ring: own(new RingGeometry(20, 26, 32)), lock: own(new RingGeometry(0.5 * cell, 0.62 * cell, 40)), proxy: own(new CylinderGeometry(0.42 * cell, 0.42 * cell, 1.6 * cell, 12)),
    marker: own(new SphereGeometry(5, 12, 8)),
  };
  const materials = {
    disc: material('#22384a'), glass: material('#6fb4d6', { transparent: true, opacity: 0.35 }), cradle: material('#3a5266'),
    wall: material('#8f7cf0', { transparent: true, opacity: 0.22, emissive: '#8f7cf0', emissiveIntensity: 0.4, side: DoubleSide }),
    pawn: material('#9aaeb9'), me: material(COLOR.me), seat: material(COLOR.seat), lock: material(COLOR.lock, { emissive: COLOR.lock, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }),
    marker: material(COLOR.me, { emissive: COLOR.me, emissiveIntensity: 0.8 }),
    ring: Object.fromEntries((['takable', 'pending', 'hover'] as const).map(key => [key,
      material(COLOR[key], { emissive: COLOR[key], emissiveIntensity: 0.6 })])) as Record<'takable' | 'pending' | 'hover', MeshStandardMaterial>,
    proxy: own(new MeshBasicMaterial({ visible: false })),
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
  scene.add(platform, scenery, standIn, seats, units);
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
    for (const view of unitViews.values()) view.holder.position.y = unitFeet;
  };
  let azimuth = 0, aspect = 1;
  const frameCamera = () => {
    const tan = Math.tan(camera.fov * Math.PI / 360), radius = STAGE_RADIUS * cell;
    const distance = radius / Math.min(tan, tan * aspect) * 1.02;
    const direction = VIEW.clone().applyAxisAngle(new Vector3(0, 1, 0), azimuth);
    const target = new Vector3(0, legendHeight * 0.5, 0);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };

  // --- bodies ----------------------------------------------------------------------------------------------------
  const fit = (body: Object3D, height: number, width = Infinity) => {
    const bounds = new Box3().setFromObject(body), size = bounds.getSize(new Vector3());
    const scale = Math.min(size.y > 0 ? height / size.y : Infinity, Math.max(size.x, size.z) > 0 ? width / Math.max(size.x, size.z) : Infinity);
    if (!Number.isFinite(scale)) return body;
    body.scale.multiplyScalar(scale); body.position.y -= bounds.min.y * scale;
    return body;
  };
  const attach = (view: Body, id: string, height: number, width?: number) => {
    if (!ctx.loadModel || !ctx.hasModel(id)) return;
    void ctx.loadModel(id).then(lease => {
      if (view.disposed || lease.placeholder) { lease.release(); return; }
      view.root.clear(); view.lease = lease;
      view.root.add(fit(lease.scene, height, width));
      view.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      view.mixer.apply(view.state.output);
    }).catch(() => { /* keeps the stand-in */ });
  };
  const releaseBody = (view: Body) => { view.disposed = true; view.mixer?.dispose(); view.mixer = null; view.lease?.release(); view.lease = null; };

  // --- seats -----------------------------------------------------------------------------------------------------
  const seatViews = new Map<string, SeatView>();
  const createSeat = (seatId: string, me: boolean, index: number, count: number): SeatView => {
    const root = new Group(); root.name = `render3d-carousel-seat-${me ? 'me' : 'other'}`;
    const anchor = anchorAt(index, Math.max(8, count), LEGEND_RADIUS);
    anchor.y = surfaceAt(anchor.x, anchor.z, LEGEND_SURFACE);
    root.position.copy(anchor);
    root.rotation.y = Math.atan2(-anchor.x, -anchor.z); // models face +z: toward the center
    const body = new Mesh(geometry.legend, me ? materials.me : materials.seat); body.scale.set(1, 0.82, 1); body.position.y = 12;
    const stand = new Group(); stand.name = 'render3d-carousel-legend-standin'; stand.add(body);
    root.add(fit(stand, legendHeight));
    seats.add(root);
    const view: SeatView = { seatId, me, anchor, root, lease: null, mixer: null, state: new UnitActionState(`carousel:${seatId}`), disposed: false, lock: null, indicator: null };
    attach(view, ctx.legendModel, legendHeight);
    return view;
  };
  const dropSeat = (view: SeatView) => { releaseBody(view); endLoop(view.lock); endLoop(view.indicator); view.root.removeFromParent(); };

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
    if (stand) { stand.position.copy(point); scene.add(stand); }
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
    pawn.add(body, head); root.add(fit(pawn, ctx.championHeight * 0.6));
    const ring = new Mesh(geometry.ring, materials.ring.takable); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5; ring.visible = false;
    const proxy = new Mesh(geometry.proxy, materials.proxy); proxy.position.y = 0.8 * cell; proxy.name = 'render3d-carousel-pick';
    const stars = createStarMark({ effectiveStarLevel: data.starLevel, colorFor: ctx.starColor });
    stars.object.scale.setScalar(STAR_SIZE); stars.object.position.y = ctx.championHeight + STAR_GAP;
    holder.add(root, ring, proxy, stars.object);
    const view: UnitView = { slot: data.slot, definitionId: data.definitionId, holder, root, ring, proxy, stars, items: [], data, tier: null,
      lease: null, mixer: null, state: new UnitActionState(`carousel:slot:${data.slot}`), disposed: false };
    // Item marks bound to the same slot, above the stars.
    data.items.forEach((item, at) => {
      const sprite = new Sprite(itemMaterial(item.icon)); sprite.name = `render3d-carousel-item-${item.id}`;
      sprite.scale.setScalar(ITEM_SIZE); sprite.renderOrder = 1001;
      sprite.position.set((at - (data.items.length - 1) / 2) * (ITEM_SIZE + 3), ctx.championHeight + STAR_GAP + STAR_SIZE + ITEM_SIZE * 0.6, 0);
      holder.add(sprite); view.items.push(sprite);
    });
    units.add(holder);
    attach(view, data.definitionId, ctx.championHeight, ctx.championWidth);
    // Quality ring at the unit's feet, turning with it; none without a known cost (stand-ins only, no guess).
    if (data.cost) view.tier = loop(TIER_FX(data.cost), TIER_SECONDS, new Vector3(0, 0.5, 0), null, holder);
    return view;
  };
  const dropUnit = (view: UnitView) => {
    endLoop(view.tier); view.tier = null;
    releaseBody(view); view.stars.dispose();
    for (const sprite of view.items) sprite.material.dispose();
    view.holder.removeFromParent();
  };

  // --- view ------------------------------------------------------------------------------------------------------
  let current: BoardCarousel | null = null, hovered: number | null = null;
  const styleRing = (view: UnitView) => {
    const { takable, pending } = view.data;
    view.ring.visible = takable || pending;
    view.ring.material = pending ? materials.ring.pending : hovered === view.slot ? materials.ring.hover : materials.ring.takable;
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
    current = null; hovered = null;
  };
  const show = (view: BoardCarousel | null) => {
    if (!view) { if (current) clear(); return; }
    if (current && current.id !== view.id) clear();
    buildPlatform();
    const first = !current;
    current = view;

    // Seats: stable public order; my seat's side faces the camera.
    view.seats.forEach((seat, index) => {
      let entry = seatViews.get(seat.seatId);
      if (!entry) { entry = createSeat(seat.seatId, seat.me, index, view.seats.length); seatViews.set(seat.seatId, entry); }
      if (seat.me) azimuth = Math.atan2(entry.anchor.x, entry.anchor.z);
      // Restraint while the seat waits for its release (nobody picked for it yet); its stand-in is a ring at its feet.
      const locked = seat.locked && !seat.picked;
      if (locked && !entry.lock) {
        const stand = new Mesh(geometry.lock, materials.lock); stand.rotation.x = -Math.PI / 2;
        entry.lock = loop(seat.me ? FX.restraint : FX.restraintEnemy, RESTRAINT_EARLY_SECONDS, entry.anchor.clone().setY(entry.anchor.y + 1), stand);
      } else if (!locked && entry.lock) { endLoop(entry.lock); entry.lock = null; }
      if (seat.me && !entry.indicator) {
        const stand = new Mesh(geometry.marker, materials.marker);
        entry.indicator = loop(FX.indicator, INDICATOR_SECONDS, entry.anchor.clone().setY(entry.anchor.y + legendHeight + 14), stand);
      }
    });
    for (const [seatId, entry] of seatViews) if (!view.seats.some(seat => seat.seatId === seatId)) { dropSeat(entry); seatViews.delete(seatId); }
    frameCamera();

    // First-draft wall at the center while my seat is still held; its fade plays once when I am released.
    const myLock = view.seats.find(seat => seat.me);
    const held = !!myLock && myLock.locked && !myLock.picked;
    if (held && !wall) {
      const stand = new Mesh(geometry.wall, materials.wall);
      wall = loop(FX.wall, WALL_SECONDS, new Vector3(0, 0.3 * cell, 0), stand);
      stand.position.y = 0.3 * cell;
    } else if (!held && wall) {
      endLoop(wall); wall = null;
      if (!first) burst(FX.wallEnd, WALL_END_SECONDS, new Vector3(0, 0.3 * cell, 0), COLOR.lock);
    }

    // Units: placed by stable slot order; one leaves only when the view says it was taken (selection feedback there).
    const standing = view.slots;
    standing.forEach((slot, index) => {
      let entry = unitViews.get(slot.slot);
      if (slot.picked) {
        if (entry) {
          const point = entry.holder.getWorldPosition(new Vector3());
          dropUnit(entry); unitViews.delete(slot.slot);
          if (!first) burst(FX.selected, SELECTED_SECONDS, point, COLOR.pending);
        }
        return;
      }
      if (!entry || entry.definitionId !== slot.definitionId) {
        if (entry) dropUnit(entry);
        entry = createUnit(slot, index, standing.length); unitViews.set(slot.slot, entry);
      }
      entry.data = slot; entry.stars.setLevel(slot.starLevel);
      styleRing(entry);
    });
    for (const [slot, entry] of unitViews) if (!standing.some(candidate => candidate.slot === slot)) { dropUnit(entry); unitViews.delete(slot); }
    if (hovered !== null && !unitViews.has(hovered)) hovered = null;
  };

  const orbitAngle = () => {
    if (!current) return 0;
    const seconds = (current.elapsedMs + (now() - current.at)) / 1000;
    return (Math.max(0, seconds) / ORBIT_SECONDS) * Math.PI * 2;
  };
  const update = (seconds: number) => {
    if (!current) return;
    units.rotation.y = orbitAngle();
    for (const view of [...seatViews.values(), ...unitViews.values()]) {
      const output = view.state.update(seconds);
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

  const pointer = new Raycaster();
  const slotAt = (client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }) => {
    if (!current || area.width <= 0 || area.height <= 0) return null;
    const x = (client.x - area.left) / area.width, y = (client.y - area.top) / area.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    units.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    pointer.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), camera);
    const proxies = [...unitViews.values()].map(view => view.proxy);
    const hit = pointer.intersectObjects(proxies, false)[0];
    const view = hit && [...unitViews.values()].find(candidate => candidate.proxy === hit.object);
    return view ? { slot: view.slot, takable: view.data.takable } : null;
  };

  return {
    scene, camera,
    get active() { return current !== null; },
    show, update, slotAt,
    resize(next) { if (next > 0) { aspect = next; camera.aspect = next; camera.updateProjectionMatrix(); frameCamera(); } },
    hover(slot) {
      if (hovered === slot) return;
      hovered = slot;
      for (const view of unitViews.values()) styleRing(view);
    },
    debug: () => ({
      platform: [...pieces.keys()].concat(standIn.visible && built ? ['standin'] : []).concat(platformLoading ? [`loading:${platformLoading}`] : []),
      legends: [...seatViews.values()].map(view => `${view.seatId}:${view.lease ? 'model' : 'standin'}${view.lock ? ':locked' : ''}`),
      units: [...unitViews.values()].map(view => ({ slot: view.slot, body: view.lease ? 'model' : 'standin', items: view.items.length,
        ring: view.ring.visible ? view.data.pending ? 'pending' : hovered === view.slot ? 'hover' : 'takable' : 'none' })),
      effects: [...loops].map(entry => `${entry.id}:${entry.fx ? 'fx' : 'standin'}`).concat([...bursts].map(entry => `burst:${entry.fx ? 'fx' : 'standin'}`)),
      angle: units.rotation.y,
    }),
    dispose() {
      clear();
      void Promise.all(textures.values()).then(list => list.forEach(texture => texture?.dispose()));
      textures.clear();
      for (const resource of owned) resource.dispose();
    },
  };
}
