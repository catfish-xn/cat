import { projectedBox, type ScreenArea } from './description-pick';
import type { BoardScreenBox } from '../board-feed';
/**
 * The 3D board's surroundings (docs/ASSETS3D_TFT_EXTRAS.md 界面接线需求): my 河灵 (little legend) beside the board, an
 * opponent's on the far side while a PvP battle is shown, my unclaimed orbs where their monster fell (else in a column
 * next to my legend), and the HP-loss bolt of a settled round. An orb the room reveals while its monster still stands in
 * the shown battle waits for that monster to fall, then bursts out of the corpse and hops to where it lies (TFT). Everything here is drawn from BoardFrame fields the 2D scene already reads (the
 * private orb view, the claim receipts, roundResults); a click on an orb goes back through BoardControls.claimOrb, which
 * is the 2D orb dock's own click. Nothing is priced, rolled or settled here, and a reload never replays an old opening
 * or hit: the first frame only records what is already there.
 * My legend walks where I right-click (TFT), at the shared legend pace (src/server/legend-motion.ts), and an orb it walks
 * over is claimed through that same dock click. An opponent's walks arrive from the room in that board's own cells and
 * are drawn mirrored on the far side.
 */
import {
  Box3, ConeGeometry, Group, Mesh, MeshStandardMaterial, RingGeometry, SphereGeometry, Vector3, type Camera, type Object3D, type Scene,
} from 'three';
/** Must stay aligned with vfx-ltk/particles FX_SCALE (0.44); not imported here to keep tabletop free of the LTK bundle. */
const FX_SCALE = 0.44;
import { UnitActionState, UnitAnimationMixer, type ModelLease, type ParticleEffect } from '../../rendering3d';
import type { BoardFrame, BoardLegendWalk, BoardOrb } from '../board-feed';
import type { CellPoint } from '../../server/legend-motion';

import { LEGEND_FALLBACK_MODEL, LEGEND_MODEL, loadLegendLease, resolveDefaultLegend } from './legend-load';
import { LEGEND_HEIGHT_RATIO } from './model-fit';
import { createPlayerDamage } from './player-damage';
import type { PvpDamage } from '../../presentation/pvp-damage';
export { LEGEND_FALLBACK_MODEL, LEGEND_MODEL, resolveDefaultLegend, loadLegendLease };
type LegendFrame = Pick<BoardFrame, 'columns' | 'rows' | 'hexRadius' | 'origin'>;
/** The x of a grid's right edge cell centre (odd rows sit half a cell right); the grid's left edge is origin.x. */
const gridRightX = (frame: LegendFrame) => frame.origin.x + Math.sqrt(3) * frame.hexRadius * (frame.columns - 0.5);
/**
 * Where the board owner's 河灵 stands: on the middle of the arena's near-left stone platform (TFT: the bottom-left
 * corner beside the bench), LEGEND_INSET_CELLS hex widths left of the grid's left edge, never on a deployable cell.
 * The playtest server's 6b353a0f capture showed the plain mirror of the old right-hand spot (1.6 widths out) on the
 * platform's outer rim, about 0.8 widths left of its middle.
 */
export const LEGEND_INSET_CELLS = 0.8;
export function legendSpot(frame: LegendFrame): Vector3 {
  const width = Math.sqrt(3) * frame.hexRadius;
  return new Vector3(frame.origin.x - width * LEGEND_INSET_CELLS, 0, frame.origin.y + frame.hexRadius * 1.5 * (frame.rows - 1));
}
/** The far corner across the board from `legendSpot` (top right): a PvP opponent's or a scouting visitor's legend. */
export function farLegendSpot(frame: LegendFrame): Vector3 {
  return new Vector3(gridRightX(frame) + Math.sqrt(3) * frame.hexRadius * 1.6, 0, frame.origin.y);
}
/**
 * The ten orb slots of a board owner's legend: two columns rising from beside it toward the board's middle, both on the
 * legend's outer (left) side. Centred on the legend, the inner column would sit on the left column's cells now that the
 * legend stands 0.8 widths out, and a left click there would take the orb instead of lifting the unit (orbAt is asked first).
 */
export function legendOrbSlots(frame: LegendFrame, count = 10): Vector3[] {
  const width = Math.sqrt(3) * frame.hexRadius, step = frame.hexRadius * 1.5, spot = legendSpot(frame);
  return Array.from({ length: count }, (_, index) => new Vector3(
    spot.x - (index % 2 ? 1.26 : 0.42) * width, 0, spot.z - (1 + Math.floor(index / 2)) * step * 0.9));
}
/** Orb effects by tier (parent systems that already contain their static child; never both). The prismatic orb uses the
 * bounded Idle system, and opens with the gold RewardBoxOpen: no dedicated prismatic opening was extracted, so this is an
 * explicit display convention, not a name match. */
const ORB_IDLE: Record<BoardOrb['tier'], string> = { gray: 'orb-gray', blue: 'orb-blue', gold: 'orb-gold', prismatic: 'orb-prismatic-idle' };
const ORB_OPEN: Record<BoardOrb['tier'], string> = { gray: 'orb-gray-open', blue: 'orb-blue-open', gold: 'orb-gold-open', prismatic: 'orb-gold-open' };
/** Playback bounds (seconds) as tft-extras action-bindings.json gives them; an idle that reaches its bound is rebuilt. */
const ORB_IDLE_SECONDS = 30, PRISMATIC_IDLE_SECONDS = 3600, OPEN_SECONDS = 3, TRAVEL_EFFECT_SECONDS = 1, IMPACT_SECONDS = 3;
const ORB_COLOR: Record<BoardOrb['tier'], string> = { gray: '#a8b0ba', blue: '#4fb7ff', gold: '#ffc94a', prismatic: '#e7a8ff' };
/** S13 trait orb stand/halo tints (取自原版 review 截图，近似). */
const ORB_VARIANT_COLOR: Record<NonNullable<BoardOrb['variant']>, string> = { warband: '#f05838', crime: '#e060d0' };
const orbTint = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) => variant ? ORB_VARIANT_COLOR[variant] : ORB_COLOR[tier];
/**
 * Loot orb particles are not scaled like skill VFX. tft-extras review at FX_SCALE=0.44 (docs/ASSETS3D_TFT_EXTRAS.md):
 * gray idle ≈0.37 cell; blue/gold/prismatic ≈0.5 cell; warband/crime cores ≈0.92 / ≈0.97 cell (special-orbs review).
 * Target visible core ≈0.5 cell for every variant.
 */
const ORB_GRAY_IDLE_CELLS_AT_FX = 0.37;
const ORB_BLUE_IDLE_CELLS_AT_FX = 0.5;
const ORB_WARBAND_IDLE_CELLS_AT_FX = 0.92;
const ORB_CRIME_IDLE_CELLS_AT_FX = 0.97;
const ORB_TARGET_CORE_CELLS = 0.5;
const orbIdleCellsAtFx = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) =>
  variant === 'warband' ? ORB_WARBAND_IDLE_CELLS_AT_FX
    : variant === 'crime' ? ORB_CRIME_IDLE_CELLS_AT_FX
      : tier === 'gray' ? ORB_GRAY_IDLE_CELLS_AT_FX
        : ORB_BLUE_IDLE_CELLS_AT_FX;
const orbParticleScale = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) =>
  FX_SCALE * (ORB_TARGET_CORE_CELLS / orbIdleCellsAtFx(tier, variant));
/** Dominant idle emitter position.y in extras JSON × orbParticleScale (review probe, 约); lowers FX so the core sits on the stand. */
const ORB_IDLE_SOURCE_Y: Record<BoardOrb['tier'] | 'warband' | 'crime', number> = {
  gray: 32, blue: 27, gold: 32, prismatic: 0, warband: 15, crime: 45,
};
const orbIdleFxYOffset = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) => {
  const key = variant ?? (tier === 'prismatic' ? 'prismatic' : tier);
  const sourceY = ORB_IDLE_SOURCE_Y[key as keyof typeof ORB_IDLE_SOURCE_Y];
  return Math.round(sourceY * orbParticleScale(tier, variant));
};
/** Stand-in core when the effect is missing: radius ≈ half a cell at hexRadius 34 (√3×34 ≈ 59 board units per cell). */
const ORB_RADIUS = 14.5, ORB_FLOAT = 16;
/** Idle vertical bob (approximate; extracted orb bindings have no dedicated motion curve). */
const ORB_BOB = 3;
/** Ground halo under the core (approximate; parent orb systems also carry ground-facing particles). */
const ORB_GROUND_RING_INNER = 12, ORB_GROUND_RING_OUTER = 24;
/** Orbs are clicked within this many CSS pixels of their drawn center (at least). */
const ORB_PICK_PX = 16;
/** Stand-in orb opening: it swells and fades over this long. */
const ORB_POP_SECONDS = 0.45;
/** Orbs drawn at most; any more wait (still claimable on the 2D dock). */
const MAX_ORBS = 10;
/** HP-loss sequence: the winner's cast leads, the bolt travels about two thirds of the segment, then the impact. */
const CAST_LEAD_SECONDS = 0.25, TRAVEL_SECONDS = 1, IMPACT_HOLD_SECONDS = 0.6;
/** An opponent legend stays this long after a PvP battle left the board, so a settled loss has someone to come from. */
const OPPONENT_LINGER_SECONDS = 4;
const BOLT_ARC = 60;
/**
 * My legend roams the board and this many hex widths around it; it claims an orb it passes within ORB_REACH widths of
 * (about a quality ring's radius plus the orb's own, so brushing an orb is enough).
 */
const ROAM_MARGIN = 2, ORB_REACH = 0.6;
/** Orbs one monster dropped land this many hex widths from where it fell, each further one a little farther out. */
const DROP_REACH = 0.35, ORB_SPREAD = 0.3;
/**
 * The burst out of a fallen monster: a hop of DROP_SECONDS peaking DROP_ARC hex widths up, then one small bounce. The
 * extracted orb systems have idle and open effects only (docs/ASSETS3D_TFT_EXTRAS.md) and no recording of the drop was
 * found, so this flight is a display convention, not a copied curve.
 */
const DROP_SECONDS = 0.55, BOUNCE_SECONDS = 0.2, DROP_ARC = 0.9, BOUNCE_ARC = 0.15;
/** Hex widths a second: the room's legend pace (legend-motion.ts LEGEND_CELLS_PER_SECOND; the carousel's RUN_CELLS). */
const WALK_WIDTHS = 2.5;

export interface TabletopContext {
  readonly scene: Scene;
  readonly camera: Camera;
  /** Height of a champion (board units); a legend stands half of it (the doc's 0.5 × hero). */
  readonly championHeight: number;
  /** World scale of particle effects (the renderer's FX_SCALE). */
  readonly effectScale: number;
  /** A lease of `id` when the asset manifest names that model; null otherwise (a stand-in is drawn). */
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  /** Model of each side's little legend now (cosmetic, board-feed legends); LEGEND_MODEL when absent. A change rebuilds that legend. */
  readonly legendModel?: (side: 'me' | 'opponent') => string;
  /** The effect when the manifest names it; null otherwise (a stand-in is drawn). */
  readonly loadEffect: ((id: string, maxDuration: number) => Promise<ParticleEffect>) | null;
  readonly own: <T extends { dispose(): void }>(resource: T) => T;
  /** The orb dock's own click (BoardControls.claimOrb); called once for an orb my walking legend reaches. */
  readonly claimOrb?: (orbId: string) => void;
  readonly now?: () => number;
}
export interface Tabletop {
  /** Authoritative PvP total and terminal survivor cells, delivered by the lazy settlement presenter. */
  damage(hit: PvpDamage): void;
  /** A confirmed Mel save, at my legend; receipt deduplication belongs to BoardScene. */
  saved(): void;
  /** Board-space points the camera should keep in view (legends, the orb column), for this board size. */
  layout(frame: BoardFrame): readonly Vector3[];
  frame(frame: BoardFrame): void;
  update(seconds: number): void;
  /** My orb drawn under a CSS-pixel point, by its projected center. */
  orbBox(id: string, area: ScreenArea): BoardScreenBox | undefined;
  orbAt(client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): string | null;
  /**
   * Walks my legend toward a board-space point (BoardScene x/y), or to my orb `orbId`, kept within the roaming area.
   * Returns the walk in board cells for the room, or null before the board is laid out.
   */
  walkTo(point: { x: number; y: number }, orbId?: string | null): { from: CellPoint; to: CellPoint } | null;
  /** An opponent's walk as the room relayed it (its own board cells): drawn mirrored on the far side. */
  walk(walk: BoardLegendWalk): void;
  /**
   * Visiting another board (TFT: my legend goes there): mine leaves this one, its walk dropped and no orb claimed meanwhile;
   * back home it stands at its own spot again.
   */
  away(on: boolean, carousel?: boolean): void;
  /** Acceptance read (?debug3d). */
  debug(): { legends: string[]; orbs: { orbId: string; tier: string; effect: boolean; dropping: boolean; opened: boolean }[]; hits: string[]; opening: number; bolt: boolean;
    volley: ReturnType<ReturnType<typeof createPlayerDamage>['debug']> };
  dispose(): void;
}

interface Path { from: Vector3; to: Vector3; start: number; end: number }
interface LegendView { readonly id: string; readonly model: string; readonly root: Group; state: UnitActionState; mixer: UnitAnimationMixer | null; lease: ModelLease | null; disposed: boolean; path: Path | null; walked: boolean }
interface OrbDrop { readonly from: Vector3; readonly to: Vector3; elapsed: number }
interface OrbView {
  readonly orbId: string; readonly tier: BoardOrb['tier']; readonly variant?: BoardOrb['variant']; readonly root: Group; readonly stand: Mesh; readonly halo: Mesh; fx: ParticleEffect | null;
  left: number; loading: boolean; disposed: boolean; phase: number;
  /** Flying out of its monster: not claimable until it lands. */
  drop: OrbDrop | null;
  /**
   * Opened at my legend's touch and no longer drawn: shown at once while the claim is on its way (TFT feel), and kept for
   * a claim the rules queued until after the battle. A refused claim draws it again.
   */
  opened: boolean;
}
interface Burst { expiresAt?: number; fx: ParticleEffect | null; mesh: Mesh | null; left: number; total: number }
interface Bolt { from: Vector3; to: Vector3; elapsed: number; fx: ParticleEffect | null; mesh: Mesh | null; disposed: boolean }
interface HitPlan { key: string; at: number; cast: boolean; bolt: Bolt | null; done: boolean; fromLegend: boolean }

export function createTabletop(ctx: TabletopContext): Tabletop {
  const { scene, own } = ctx;
  const legendHeight = ctx.championHeight * LEGEND_HEIGHT_RATIO;
  const orbGeometry = own(new SphereGeometry(ORB_RADIUS, 20, 14));
  const orbHaloGeometry = own(new RingGeometry(ORB_GROUND_RING_INNER, ORB_GROUND_RING_OUTER, 32));
  const orbStandMaterial = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) => {
    const color = orbTint(tier, variant);
    return own(new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: variant ? 0.65 : 0.85, roughness: 0.28,
      transparent: true, opacity: variant ? 0.48 : 0.72, depthWrite: false }));
  };
  const orbHaloMaterialFor = (tier: BoardOrb['tier'], variant?: BoardOrb['variant']) => {
    const color = orbTint(tier, variant);
    return own(new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, transparent: true,
      opacity: variant ? 0.34 : 0.42, depthWrite: false }));
  };
  const orbMaterial = Object.fromEntries((Object.keys(ORB_COLOR) as BoardOrb['tier'][]).map(tier => [tier, orbStandMaterial(tier)])) as Record<BoardOrb['tier'], MeshStandardMaterial>;
  const orbHaloMaterial = Object.fromEntries((Object.keys(ORB_COLOR) as BoardOrb['tier'][]).map(tier => [tier, orbHaloMaterialFor(tier)])) as Record<BoardOrb['tier'], MeshStandardMaterial>;
  // Trait orb tints ignore the tier, so each variant's materials are made once, not per orb.
  const variantMaterials = new Map<string, MeshStandardMaterial>();
  const variantMaterial = (kind: 'stand' | 'halo', tier: BoardOrb['tier'], variant: NonNullable<BoardOrb['variant']>) => {
    const key = `${kind}:${variant}`;
    let material = variantMaterials.get(key);
    if (!material) { material = kind === 'stand' ? orbStandMaterial(tier, variant) : orbHaloMaterialFor(tier, variant); variantMaterials.set(key, material); }
    return material;
  };
  const boltGeometry = own(new SphereGeometry(7, 16, 12));
  const boltMaterial = own(new MeshStandardMaterial({ color: '#ffe3a1', emissive: '#ffb347', emissiveIntensity: 1, transparent: true }));
  const flashMaterial = own(new MeshStandardMaterial({ color: '#ff9b6b', emissive: '#ff6a3d', emissiveIntensity: 1, transparent: true, opacity: 0.8 }));
  const legendGeometry = { body: own(new SphereGeometry(14, 20, 14)), ear: own(new ConeGeometry(4, 10, 10)), eye: own(new SphereGeometry(2.4, 10, 8)) };
  const legendMaterial = { me: own(new MeshStandardMaterial({ color: '#7fd8cf', roughness: 0.55 })),
    opponent: own(new MeshStandardMaterial({ color: '#e3a08f', roughness: 0.55 })), eye: own(new MeshStandardMaterial({ color: '#1b2230' })) };

  const now = ctx.now ?? (() => performance.now());
  const damage = createPlayerDamage(ctx);
  let damageFrame: BoardFrame | null = null;
  const anchors = { me: new Vector3(), opponent: new Vector3(), enemySide: new Vector3(), orbs: [] as Vector3[], center: new Vector3() };
  /** Board cells: hex widths from the board origin. `bounds` is where my legend may walk (board-space x/z). */
  const board = { x: 0, z: 0, width: 1, bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } };
  let layoutKey = '';
  const layout = (frame: BoardFrame): readonly Vector3[] => {
    const width = Math.sqrt(3) * frame.hexRadius, step = frame.hexRadius * 1.5;
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}`;
    if (key !== layoutKey) {
      layoutKey = key;
      const right = gridRightX(frame);
      const bottom = frame.origin.y + step * (frame.rows - 1), top = frame.origin.y;
      anchors.me.copy(legendSpot(frame));
      anchors.opponent.copy(farLegendSpot(frame));
      anchors.enemySide.set(frame.origin.x + width * (frame.columns - 1) / 2, 0, top);
      anchors.center.set(frame.origin.x + width * (frame.columns - 0.5) / 2, 0, (top + bottom) / 2);
      board.x = frame.origin.x; board.z = frame.origin.y; board.width = width;
      const margin = ROAM_MARGIN * width;
      board.bounds = { minX: anchors.me.x - margin * 0.75, maxX: right + margin, minZ: top - margin, maxZ: bottom + margin };
      for (const view of legends.values()) { view.walked = false; view.path = null; }
      // Two columns of orbs rising from beside my legend toward the board's middle.
      anchors.orbs = legendOrbSlots(frame, MAX_ORBS);
      for (const view of legends.values()) placeLegend(view);
      [...orbs.values()].filter(view => !spots.has(view.orbId)).forEach((view, index) => view.root.position.copy(orbSlot(index)));
    }
    const pad = legendHeight;
    return [anchors.me.clone().add(new Vector3(-pad, 0, pad)), anchors.opponent.clone().add(new Vector3(pad, 0, -pad)),
      anchors.orbs[MAX_ORBS - 1]!.clone()];
  };
  const orbSlot = (index: number) => anchors.orbs[Math.min(index, MAX_ORBS - 1)] ?? anchors.me;

  // --- legends ---------------------------------------------------------------------------------------------------
  const legends = new Map<'me' | 'opponent', LegendView>();
  const standIn = (side: 'me' | 'opponent'): Object3D => {
    const group = new Group(); group.name = 'render3d-legend-standin';
    const body = new Mesh(legendGeometry.body, legendMaterial[side]); body.scale.set(1, 0.82, 1); body.position.y = 12;
    for (const x of [-7, 7]) {
      const ear = new Mesh(legendGeometry.ear, legendMaterial[side]); ear.position.set(x, 24, -1); ear.rotation.z = x < 0 ? 0.35 : -0.35;
      const eye = new Mesh(legendGeometry.eye, legendMaterial.eye); eye.position.set(x * 0.6, 14, 12);
      group.add(ear, eye);
    }
    group.add(body);
    return fitHeight(group, legendHeight);
  };
  const placeLegend = (view: LegendView) => {
    if (view.walked) return;
    const side = view.id === 'legend:me' ? anchors.me : anchors.opponent;
    view.root.position.copy(side);
    // Models face +z; turn toward the board.
    view.root.rotation.y = Math.atan2(anchors.center.x - side.x, anchors.center.z - side.z);
  };
  /** Set while I visit another board (`away`). */
  let away = false, carousel = false;
  const legend = (side: 'me' | 'opponent'): LegendView => {
    const model = ctx.legendModel?.(side) ?? LEGEND_MODEL;
    let view = legends.get(side);
    if (view?.model === model) return view;
    // Another look for the same seat: the new body takes over where the old one stood or walked.
    const before = view ? { position: view.root.position.clone(), rotation: view.root.rotation.y, path: view.path, walked: view.walked, walk: opponentWalk } : null;
    if (view) dropLegend(side);
    const root = new Group(); root.name = `render3d-legend-${side}`;
    view = { id: `legend:${side}`, model, root, state: new UnitActionState(`legend:${side}`), mixer: null, lease: null, disposed: false, path: null, walked: false };
    legends.set(side, view);
    root.add(standIn(side)); root.visible = !carousel && !(away && side === 'me');
    placeLegend(view); scene.add(root);
    if (before?.walked) { root.position.copy(before.position); root.rotation.y = before.rotation; view.path = before.path; view.walked = true; }
    if (side === 'opponent' && before) opponentWalk = before.walk;
    // The opponent already walked on their board before its legend was shown here: it stands where that walk ends.
    else if (side === 'opponent' && opponentWalk) startPath(view, opponentWalk, true);
    const created = view;
    if (ctx.loadModel) void loadLegendLease(ctx.loadModel, model).then(lease => {
      if (created.disposed || lease.placeholder) { lease.release(); return; }
      created.root.clear();
      created.lease = lease;
      created.root.add(fitHeight(lease.scene, legendHeight));
      created.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      created.mixer.apply(legendOutput(created));
    }).catch(() => { /* keeps the stand-in */ });
    return view;
  };
  const act = (view: LegendView | undefined, event: 'cast' | 'hit') => {
    if (!view) return;
    view.state.consume(event === 'cast' ? { type: 'cast', sourceId: view.id }
      : { type: 'packetDamage', sourceId: 'legend:hit', targetId: view.id, hit: true, hpDamage: 1, absorbed: 0 });
    view.mixer?.apply(legendOutput(view));
  };
  const dropLegend = (side: 'me' | 'opponent') => {
    const view = legends.get(side);
    if (!view) return;
    view.disposed = true; view.mixer?.dispose(); view.lease?.release(); view.root.removeFromParent(); legends.delete(side);
    if (side === 'opponent') opponentWalk = null;
  };
  /** A legend's own animation, with the run loop while it walks (a cast or a hit still plays over it). */
  const legendOutput = (view: LegendView) => {
    const base = view.state.output;
    const walking = view.path !== null && (base.state === 'idle' || base.state === 'move');
    return { ...base, ...(walking ? { state: 'move' as const, loop: true } : {}), revision: base.revision * 2 + (walking ? 1 : 0) };
  };

  // --- walking -----------------------------------------------------------------------------------------------------
  const toCells = (point: Vector3): CellPoint => ({ x: (point.x - board.x) / board.width, y: (point.z - board.z) / board.width });
  /** An opponent's own cells, turned half around my board's center onto the far side. */
  const mirrored = (point: CellPoint) => new Vector3(2 * anchors.center.x - (board.x + point.x * board.width), 0, 2 * anchors.center.z - (board.z + point.y * board.width));
  let opponentWalk: BoardLegendWalk | null = null;
  const startPath = (view: LegendView, walk: BoardLegendWalk, settled = false) => {
    const to = mirrored(walk.to);
    view.walked = true;
    if (settled || walk.arriveAt <= now()) { view.path = null; view.root.position.copy(to); return; }
    view.path = { from: view.root.position.clone(), to, start: now(), end: walk.arriveAt };
  };
  /**
   * Claims my legend sent, by orb, with the orb's refusal count when sent: not sent again until the session reports a
   * refusal of it (the dock put it back); forgotten when the orb leaves.
   */
  let orbTarget: string | null = null, refusals: Readonly<Record<string, number>> = {};
  /** Orbs my legend touched and opened before the room answered, with the refusal count at that touch. */
  const claimedHere = new Map<string, number>();
  const sent = new Map<string, number>();
  const walkTo = (point: { x: number; y: number }, orbId: string | null = null) => {
    if (!layoutKey || away) return null;
    const orb = orbId ? orbs.get(orbId) : undefined;
    // An orb still inside its standing monster: my legend goes to that monster and takes the orb once it has landed.
    const inside = orbId && !orb ? monsters.get(held.get(orbId) ?? '') : undefined;
    // Sent to an orb that is not drawn (any more): nowhere to go.
    if (orbId && (orb ? !reachable(orb) : !inside)) return null;
    const view = legend('me');
    const { minX, maxX, minZ, maxZ } = board.bounds;
    const to = orb ? (orb.drop?.to ?? orb.root.position).clone().setY(0) : inside ? inside.clone().setY(0)
      : new Vector3(Math.min(maxX, Math.max(minX, point.x)), 0, Math.min(maxZ, Math.max(minZ, point.y)));
    const from = view.root.position.clone().setY(0);
    const seconds = from.distanceTo(to) / (WALK_WIDTHS * board.width);
    view.walked = true; orbTarget = orbId ?? null;
    view.path = { from, to, start: now(), end: now() + seconds * 1000 };
    return { from: toCells(from), to: toCells(to) };
  };
  const moveLegend = (view: LegendView) => {
    const path = view.path;
    if (!path) return;
    const span = path.end - path.start, t = span <= 0 ? 1 : Math.min(1, Math.max(0, (now() - path.start) / span));
    const before = view.root.position.clone();
    view.root.position.lerpVectors(path.from, path.to, t);
    if (path.from.distanceToSquared(path.to) > 1) view.root.rotation.y = Math.atan2(path.to.x - path.from.x, path.to.z - path.from.z);
    if (t >= 1) view.path = null;
    if (view.id !== 'legend:me' || away) return;
    // An orb it walked over since the last frame (the whole stretch, so a long frame skips none), or the one it was sent
    // to on arrival, is claimed as the dock's click; once, unless that claim was refused.
    for (const orb of orbs.values()) {
      if (orb.drop || !reachable(orb)) continue;
      const reach = orb.orbId === orbTarget && t >= 1 ? board.width : ORB_REACH * board.width;
      if (stretchDistance(orb.root.position, before, view.root.position) > reach) continue;
      claim(orb);
    }
    // Arrived before the orb it was sent to has landed (or burst out at all): it waits there and takes it on landing.
    const waiting = orbTarget !== null && (orbs.get(orbTarget)?.drop ?? held.has(orbTarget));
    if (t >= 1 && !waiting) orbTarget = null;
  };
  /** Claims `orb` as the dock's click; once, unless that claim was refused. */
  const claim = (orb: OrbView) => {
    const at = sent.get(orb.orbId);
    if (at !== undefined && (refusals[orb.orbId] ?? 0) <= at) return;
    sent.set(orb.orbId, refusals[orb.orbId] ?? 0); ctx.claimOrb?.(orb.orbId);
    // Open it now rather than a server round trip later: the receipt fills the bench when it arrives, and a refusal
    // (a newer refusal count for this orb in a later frame) draws the orb again.
    if (orb.disposed) return;
    claimedHere.set(orb.orbId, refusals[orb.orbId] ?? 0);
    if (!orb.opened) { orb.opened = true; orb.root.visible = false; openOrb(orb); }
  };
  /** A landed orb that my legend stands on, or was sent to and already reached, is claimed now. */
  const landed = (orb: OrbView) => {
    const me = legends.get('me');
    if (!me || away || !reachable(orb)) return;
    const near = me.root.position.distanceTo(orb.root.position.clone().setY(me.root.position.y)) <= ORB_REACH * board.width;
    const waited = orb.orbId === orbTarget && !me.path;
    if (!near && !waited) return;
    if (waited) orbTarget = null;
    claim(orb);
  };

  // --- effects -----------------------------------------------------------------------------------------------------
  const bursts = new Set<Burst>();
  const effectAt = (id: string, seconds: number, point: Vector3, owner: () => boolean, scale = ctx.effectScale): Promise<ParticleEffect | null> => {
    if (!ctx.loadEffect) return Promise.resolve(null);
    return ctx.loadEffect(id, seconds).then(fx => {
      if (!owner()) { fx.dispose(); return null; }
      fx.object.scale.setScalar(scale); fx.object.position.copy(point);
      scene.add(fx.object);
      return fx;
    }).catch(() => null);
  };
  /**
   * A one-shot effect at `point`; the stand-in mesh (when given) swells and fades if the effect is not available.
   * `fallback` is tried first when `id` cannot load (a trait orb's own open effect → the generic tier's).
   */
  const burst = (id: string, seconds: number, point: Vector3, stand: Mesh | null, fallback?: string, scale = ctx.effectScale) => {
    const entry: Burst = { fx: null, mesh: null, left: seconds, total: ORB_POP_SECONDS };
    bursts.add(entry);
    const live = () => bursts.has(entry);
    void effectAt(id, seconds, point, live, scale)
      .then(fx => fx || !fallback || !live() ? fx : effectAt(fallback, seconds, point, live, scale)).then(fx => {
      if (fx) { entry.fx = fx; disposeStand(stand); return; }
      if (!bursts.has(entry) || !stand) { bursts.delete(entry); disposeStand(stand); return; }
      stand.position.copy(point); scene.add(stand); entry.mesh = stand; entry.left = ORB_POP_SECONDS;
    });
    return entry;
  };
  // Stand-in bursts carry their own material copy (opacity fades per burst).
  const disposeStand = (stand: Mesh | null) => { stand?.removeFromParent(); (stand?.material as MeshStandardMaterial | undefined)?.dispose(); };
  const endBurst = (entry: Burst) => { entry.fx?.dispose(); disposeStand(entry.mesh); bursts.delete(entry); };

  // --- orbs --------------------------------------------------------------------------------------------------------
  const orbs = new Map<string, OrbView>();
  /**
   * Where each orb lies, as in TFT: where the monster that dropped it was last drawn (frame.orbs `source`), spread a little
   * when one monster drops several; kept until the orb is claimed. An orb with no known source (a mechanic's, or one listed
   * before this layer saw its monster) takes the column beside my legend.
   */
  const spots = new Map<string, Vector3>();
  /** Neutral pieces' last drawn points in the latest PvE combat, by combat unit id (the loot's sourceUnitId). */
  const monsters = new Map<string, Vector3>();
  let wasFighting = false;
  const spotFor = (orb: BoardOrb): Vector3 | undefined => {
    const known = spots.get(orb.orbId);
    if (known || !orb.source) return known;
    const at = monsters.get(orb.source);
    if (!at) return undefined;
    const siblings = [...spots.keys()].filter(id => orbSource.get(id) === orb.source).length;
    const angle = idAngle(orb.orbId) + siblings * 2.4, reach = (DROP_REACH + siblings * ORB_SPREAD) * board.width;
    const { minX, maxX, minZ, maxZ } = board.bounds;
    const spot = new Vector3(Math.min(maxX, Math.max(minX, at.x + Math.cos(angle) * reach)), 0, Math.min(maxZ, Math.max(minZ, at.z + Math.sin(angle) * reach)));
    spots.set(orb.orbId, spot); orbSource.set(orb.orbId, orb.source);
    return spot;
  };
  const orbSource = new Map<string, string>();
  /** Orbs revealed while their monster still stands in the shown battle, by orb id, with that monster's id. */
  const held = new Map<string, string>();
  const idleSeconds = (tier: BoardOrb['tier']) => tier === 'prismatic' ? PRISMATIC_IDLE_SECONDS : ORB_IDLE_SECONDS;
  const orbAnchorY = (bob: number) => ORB_FLOAT + bob;
  const orbFxY = (view: OrbView, bob: number) => orbAnchorY(bob) - orbIdleFxYOffset(view.tier, view.variant);
  /** Idle particles share the stand anchor at the orb root; dominant emitter y is compensated (see ORB_IDLE_SOURCE_Y). */
  const alignIdleFx = (view: OrbView, fx: ParticleEffect) => {
    fx.object.scale.setScalar(orbParticleScale(view.tier, view.variant));
    view.root.add(fx.object);
    fx.object.position.set(0, orbFxY(view, 0), 0);
  };
  const startIdle = (view: OrbView) => {
    if (!ctx.loadEffect || view.loading) return;
    view.loading = true;
    // A trait orb (S13 Warband/Crime) uses its own idle effect; if that cannot load, the generic tier's.
    const generic = () => ctx.loadEffect!(ORB_IDLE[view.tier], idleSeconds(view.tier));
    const load = view.variant ? ctx.loadEffect(`orb-${view.variant}`, idleSeconds(view.tier)).catch(generic) : generic();
    void load.then(fx => {
      view.loading = false;
      if (view.disposed) { fx.dispose(); return; }
      alignIdleFx(view, fx);
      view.fx = fx; view.left = idleSeconds(view.tier);
    }).catch(() => { view.loading = false; });
  };
  const createOrb = (orb: BoardOrb, index: number): OrbView => {
    const root = new Group(); root.name = `render3d-orb-${orb.tier}`;
    const halo = new Mesh(orbHaloGeometry, orb.variant ? variantMaterial('halo', orb.tier, orb.variant) : orbHaloMaterial[orb.tier]);
    halo.rotation.x = -Math.PI / 2; halo.position.y = 1;
    const stand = new Mesh(orbGeometry, orb.variant ? variantMaterial('stand', orb.tier, orb.variant) : orbMaterial[orb.tier]);
    stand.position.y = ORB_FLOAT; stand.renderOrder = -1;
    root.add(halo, stand); root.position.copy(orbSlot(index)); scene.add(root);
    const view: OrbView = { orbId: orb.orbId, tier: orb.tier, ...(orb.variant ? { variant: orb.variant } : {}), root, stand, halo, fx: null, left: 0, loading: false, disposed: false, phase: index * 1.3, drop: null, opened: false };
    startIdle(view);
    return view;
  };
  const removeOrb = (view: OrbView, opened: boolean) => {
    view.disposed = true; view.fx?.dispose(); view.fx = null;
    view.root.removeFromParent();
    if (opened) openOrb(view);
  };
  /** The tier's (or trait skin's) opening where the orb lies. */
  const openOrb = (view: OrbView) => burst(view.variant ? `orb-${view.variant}-open` : ORB_OPEN[view.tier], OPEN_SECONDS,
    view.root.position.clone().setY(ORB_FLOAT), new Mesh(orbGeometry, (view.variant ? variantMaterial('stand', view.tier, view.variant) : orbMaterial[view.tier]).clone()), ORB_OPEN[view.tier],
    orbParticleScale(view.tier, view.variant));
  /** Drawn, landed and not already opened by a queued claim: my legend may walk onto it. */
  const reachable = (view: OrbView) => !view.opened && view.root.visible;
  /** Bursts out of the corpse at `from`: a flash of the tier's color there, then the hop to `to`. */
  const startDrop = (view: OrbView, from: Vector3, to: Vector3) => {
    view.drop = { from: from.clone().setY(0), to: to.clone(), elapsed: 0 };
    view.root.position.copy(view.drop.from); view.root.scale.setScalar(0.3);
    const flash = new Mesh(orbGeometry, orbMaterial[view.tier].clone()); flash.position.copy(view.drop.from).setY(ORB_FLOAT);
    scene.add(flash); bursts.add({ fx: null, mesh: flash, left: ORB_POP_SECONDS, total: ORB_POP_SECONDS });
  };
  const flyDrop = (view: OrbView, seconds: number) => {
    const drop = view.drop!;
    drop.elapsed += seconds;
    const hop = Math.min(1, drop.elapsed / DROP_SECONDS), bounce = Math.min(1, Math.max(0, drop.elapsed - DROP_SECONDS) / BOUNCE_SECONDS);
    view.root.position.lerpVectors(drop.from, drop.to, hop);
    view.root.position.y = hop < 1 ? 4 * DROP_ARC * board.width * hop * (1 - hop) : 4 * BOUNCE_ARC * board.width * bounce * (1 - bounce);
    view.root.scale.setScalar(Math.min(1, 0.3 + hop * 1.4));
    if (bounce >= 1) { view.drop = null; view.root.position.copy(drop.to); view.root.scale.setScalar(1); landed(view); }
  };

  // --- HP-loss bolt ------------------------------------------------------------------------------------------------
  let hit: HitPlan | null = null;
  const hitsPlayed: string[] = [];
  const damagePlayed: string[] = [];
  const endBolt = (bolt: Bolt) => { bolt.disposed = true; bolt.fx?.dispose(); bolt.fx = null; bolt.mesh?.removeFromParent(); bolt.mesh = null; };
  const startHit = (key: string, fromLegend: boolean) => {
    if (hit?.bolt) endBolt(hit.bolt);
    hit = { key, at: 0, cast: false, bolt: null, done: false, fromLegend };
    hitsPlayed.push(key);
  };
  const launchBolt = (plan: HitPlan) => {
    // From and to where the legends stand now (they may have walked off their places).
    const source = plan.fromLegend ? legends.get('opponent')?.root.position ?? anchors.opponent : anchors.enemySide;
    const bolt: Bolt = { from: source.clone().setY(legendHeight * 0.6), to: (legends.get('me')?.root.position ?? anchors.me).clone().setY(legendHeight * 0.6), elapsed: 0, fx: null, mesh: null, disposed: false };
    plan.bolt = bolt;
    const fallback = () => { if (!bolt.disposed && !bolt.fx) { bolt.mesh = new Mesh(boltGeometry, boltMaterial); bolt.mesh.position.copy(bolt.from); scene.add(bolt.mesh); } };
    // The Avatar bolt, or the plain one when only that was extracted (one of the two, never both).
    void effectAt('player-damage-mis', TRAVEL_EFFECT_SECONDS, bolt.from, () => !bolt.disposed)
      .then(fx => fx ?? effectAt('player-damage-mis1', TRAVEL_EFFECT_SECONDS, bolt.from, () => !bolt.disposed))
      .then(fx => { if (fx) { bolt.fx = fx; fx.object.lookAt(bolt.to); } else fallback(); });
  };
  const boltPoint = (bolt: Bolt, t: number, out: Vector3) => out.lerpVectors(bolt.from, bolt.to, t).setY(out.y + Math.sin(Math.PI * t) * BOLT_ARC);
  const updateHit = (seconds: number) => {
    const plan = hit;
    if (!plan) return;
    plan.at += seconds;
    if (!plan.cast) { plan.cast = true; act(plan.fromLegend ? legends.get('opponent') : undefined, 'cast'); }
    if (!plan.bolt && plan.at >= CAST_LEAD_SECONDS) launchBolt(plan);
    const bolt = plan.bolt;
    if (bolt && !bolt.disposed) {
      bolt.elapsed += seconds;
      const t = Math.min(1, bolt.elapsed / TRAVEL_SECONDS), node = bolt.fx?.object ?? bolt.mesh;
      if (node) boltPoint(bolt, t, node.position);
      bolt.fx?.update(seconds, ctx.camera);
      if (t >= 1) {
        // Arrived: the travel stops and the impact plays on my legend.
        endBolt(bolt);
        const at = bolt.to.clone();
        burst('player-damage-tar', IMPACT_SECONDS, at, new Mesh(boltGeometry, flashMaterial.clone()));
        act(legends.get('me'), 'hit');
      }
    }
    if (bolt?.disposed && plan.at >= CAST_LEAD_SECONDS + TRAVEL_SECONDS + IMPACT_HOLD_SECONDS) { plan.done = true; hit = null; }
  };

  // --- frames ------------------------------------------------------------------------------------------------------
  let seeded = false, seenHit: string | null = null, pvpLinger = 0, pvpShown = false;
  const onFrame = (frame: BoardFrame) => {
    damageFrame = frame;
    layout(frame);
    legend('me');
    // A shown battle against another board (no neutral PvE monster among the enemies) has that board's legend on its side.
    const enemies = frame.pieces.filter(piece => piece.team === 'enemy');
    if (frame.fighting && enemies.length) pvpShown = enemies.every(piece => !piece.neutral);
    if (frame.fighting && pvpShown) { legend('opponent'); pvpLinger = OPPONENT_LINGER_SECONDS; }

    const list = frame.orbs ?? [], present = new Set(list.map(orb => orb.orbId));
    refusals = frame.orbRefusals ?? {};
    // Only an orb a granted receipt names opens; one that left with nothing granted (forfeited) is just removed.
    const opened = new Set(frame.openedOrbs ?? []);
    for (const id of held.keys()) if (!present.has(id)) held.delete(id);
    for (const [id, view] of orbs) if (!present.has(id)) { orbs.delete(id); sent.delete(id); claimedHere.delete(id); spots.delete(id); orbSource.delete(id); removeOrb(view, seeded && opened.has(id) && !view.opened); }
    if (frame.fighting && !wasFighting) monsters.clear();
    wasFighting = frame.fighting;
    // Monsters still standing in the shown battle: an orb of theirs waits for them to fall.
    const standing = new Set<string>();
    for (const piece of frame.pieces) if (piece.neutral) {
      monsters.set(piece.id, new Vector3(piece.x, 0, piece.y));
      if (frame.fighting && piece.alive && piece.visible) standing.add(piece.id);
    }
    let column = 0;
    list.slice(0, MAX_ORBS).forEach((orb, index) => {
      let view = orbs.get(orb.orbId);
      if (!view) {
        // The room reveals a drop at the monster's death on its own clock, a little ahead of the battle shown here.
        if (seeded && orb.source && standing.has(orb.source)) { held.set(orb.orbId, orb.source); return; }
        held.delete(orb.orbId);
        view = createOrb(orb, index); orbs.set(orb.orbId, view);
        const corpse = orb.source ? monsters.get(orb.source) : undefined, spot = spotFor(orb);
        // Only a drop seen arriving bursts out; a reload just shows it lying there.
        if (seeded && corpse && spot) startDrop(view, corpse, spot);
      }
      const spot = spotFor(orb);
      if (!view.drop) view.root.position.copy(spot ?? orbSlot(column++));
      // TFT opens the orb at the touch: one I touched stays open until the room answers (a refusal draws it again), and
      // one the rules queued until after the battle opens now, its contents following with the settlement (a reload
      // while queued shows nothing more to open).
      const touched = claimedHere.has(orb.orbId) && (refusals[orb.orbId] ?? 0) <= claimedHere.get(orb.orbId)!;
      if (!touched) claimedHere.delete(orb.orbId);
      const open = orb.queued || touched;
      if (open && !view.opened) { view.opened = true; if (seeded) openOrb(view); }
      else if (!open && view.opened) view.opened = false;
      view.root.visible = !view.opened;
    });

    const key = frame.hit?.key ?? null;
    if (seeded && key && key !== seenHit && !frame.hit?.pvp) {
      const fromLegend = pvpShown && pvpLinger > 0;
      if (fromLegend) legend('opponent');
      startHit(key, fromLegend);
    }
    seenHit = key ?? seenHit;
    seeded = true;
  };

  let clock = 0;
  const update = (seconds: number) => {
    clock += seconds;
    damage.update(seconds);
    if (!legends.size && !orbs.size && !hit && !bursts.size) return;
    updateHit(seconds);
    if (pvpLinger > 0 && !hit && !damage.isActive()) {
      pvpLinger = Math.max(0, pvpLinger - seconds);
      if (pvpLinger === 0) dropLegend('opponent');
    }
    for (const view of legends.values()) {
      moveLegend(view);
      view.state.update(seconds);
      if (view.mixer) { view.mixer.apply(legendOutput(view)); view.mixer.update(seconds); }
    }
    for (const view of orbs.values()) {
      if (view.drop) flyDrop(view, seconds);
      const bob = Math.sin(clock * 2 + view.phase) * ORB_BOB;
      const y = orbAnchorY(bob);
      view.stand.position.y = y;
      view.fx?.object.position.set(0, orbFxY(view, bob), 0);
      if (!view.fx) continue;
      view.fx.update(seconds, ctx.camera);
      view.left -= seconds;
      // Bounded idle: when the effect has played out, it is rebuilt rather than assumed to run forever.
      if (view.fx.finished || view.left <= 0) { view.fx.dispose(); view.fx = null; startIdle(view); }
    }
    for (const entry of bursts) {
      if (entry.expiresAt !== undefined && now() >= entry.expiresAt) { endBurst(entry); continue; }
      entry.left -= seconds;
      if (entry.fx) entry.fx.update(seconds, ctx.camera);
      else if (entry.mesh) {
        const t = 1 - Math.max(0, entry.left) / entry.total;
        entry.mesh.scale.setScalar(1 + t * 1.6);
        (entry.mesh.material as MeshStandardMaterial).opacity = 1 - t;
      }
      if (entry.left <= 0 || entry.fx?.finished) endBurst(entry);
    }
  };

  const projected = new Vector3();
  const orbAt = (client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): string | null => {
    let best: string | null = null, bestDistance = Infinity;
    for (const view of orbs.values()) {
      if (!reachable(view)) continue;
      view.root.updateWorldMatrix(true, false);
      projected.copy(view.root.position).setY(ORB_FLOAT).project(ctx.camera);
      if (projected.z > 1) continue;
      const x = area.left + (projected.x + 1) / 2 * area.width, y = area.top + (1 - projected.y) / 2 * area.height;
      const distance = Math.hypot(client.x - x, client.y - y);
      if (distance <= ORB_PICK_PX && distance < bestDistance) { best = view.orbId; bestDistance = distance; }
    }
    return best;
  };

  return {
    layout, frame: onFrame, update, orbAt, walkTo,
    damage(event) {
      const frame = damageFrame;
      const key = `${event.key}:${event.target}`;
      if (!frame || away || damagePlayed.includes(key)) return;
      damagePlayed.push(key);
      if (damagePlayed.length > 64) damagePlayed.shift();
      if (!hitsPlayed.includes(event.key)) hitsPlayed.push(event.key);
      pvpLinger = OPPONENT_LINGER_SECONDS;
      if (hitsPlayed.length > 32) hitsPlayed.shift();
      legend('opponent');
      const sources = event.sources.map(cell => new Vector3(
        frame.origin.x + Math.sqrt(3) * frame.hexRadius * (cell.col + (cell.row % 2) / 2), ctx.championHeight * 0.6,
        frame.origin.y + frame.hexRadius * 1.5 * cell.row));
      damage.play(event, sources, () => (legends.get(event.target)?.root.position ?? anchors[event.target]).clone().setY(legendHeight * 0.9),
        () => act(legends.get(event.target), 'hit'));
    },
    orbBox(id, area) { const view = orbs.get(id); return view && reachable(view) ? projectedBox(view.root, ctx.camera, area) : undefined; },
    saved() {
      const view = legends.get('me');
      if (view && !away) {
        const save = burst('mel_tft13_missmage_base_p_damageredirect_cas', 1.4, view.root.position.clone(), null);
        save.expiresAt = now() + 1400; // A dropped frame must not stretch the save past its wall-clock bound.
      }
    },
    away(on, inCarousel = false) {
      const changed = on !== away, wasCarousel = carousel;
      carousel = inCarousel;
      for (const [side, view] of legends) view.root.visible = !carousel && !(on && side === 'me');
      if (!changed) return;
      if (on) damage.clear();
      away = on; orbTarget = null;
      const view = legends.get('me');
      if (!view) return;
      view.path = null;
      if (!on) { if (!wasCarousel) view.walked = false; placeLegend(view); }
    },
    walk(walk) {
      if (walk.scene !== 'board' || walk.who !== 'opponent') return;
      opponentWalk = walk;
      const view = legends.get('opponent');
      if (view) startPath(view, walk);
    },
    debug: () => ({ legends: [...legends.values()].map(view => `${view.id}:${view.lease ? 'model' : 'standin'}${view.path ? ':walk' : ''}`),
      orbs: [...orbs.values()].map(view => ({ orbId: view.orbId, tier: view.tier, effect: view.fx !== null, dropping: view.drop !== null, opened: view.opened })),
      hits: [...hitsPlayed], opening: bursts.size, bolt: !!hit?.bolt && !hit.bolt.disposed, volley: damage.debug() }),
    dispose() {
      damage.dispose();
      if (hit?.bolt) endBolt(hit.bolt);
      hit = null;
      for (const entry of [...bursts]) endBurst(entry);
      for (const view of orbs.values()) { view.disposed = true; view.fx?.dispose(); view.root.removeFromParent(); }
      orbs.clear();
      dropLegend('me'); dropLegend('opponent');
    },
  };
}

/** Scales `body` to `height`, feet on y = 0. */
function fitHeight(body: Object3D, height: number): Object3D {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3());
  if (!(size.y > 0)) return body;
  const scale = height / size.y;
  body.scale.multiplyScalar(scale);
  body.position.y -= box.min.y * scale;
  return body;
}

/** A fixed direction (radians) per orb id, so where an orb lands does not depend on frame timing. */
function idAngle(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return (hash >>> 0) % 360 * Math.PI / 180;
}

/** Ground distance (x/z) from `point` to the segment `a`–`b`. */
function stretchDistance(point: Vector3, a: Vector3, b: Vector3): number {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length > 0 ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length)) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}
