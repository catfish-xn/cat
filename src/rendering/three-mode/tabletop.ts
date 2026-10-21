/**
 * The 3D board's surroundings (docs/ASSETS3D_TFT_EXTRAS.md 界面接线需求): my 河灵 (little legend) beside the board, an
 * opponent's on the far side while a PvP battle is shown, my unclaimed orbs in a column next to my legend, and the
 * HP-loss bolt of a settled round. Everything here is drawn from BoardFrame fields the 2D scene already reads (the
 * private orb view, the claim receipts, roundResults); a click on an orb goes back through BoardControls.claimOrb, which
 * is the 2D orb dock's own click. Nothing is priced, rolled or settled here, and a reload never replays an old opening
 * or hit: the first frame only records what is already there.
 * My legend walks where I right-click (TFT), at the shared legend pace (src/server/legend-motion.ts), and an orb it walks
 * over is claimed through that same dock click. An opponent's walks arrive from the room in that board's own cells and
 * are drawn mirrored on the far side.
 */
import {
  Box3, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Camera, type Object3D, type Scene,
} from 'three';
import { UnitActionState, UnitAnimationMixer, type ModelLease, type ParticleEffect } from '../../rendering3d';
import type { BoardFrame, BoardLegendWalk, BoardOrb } from '../board-feed';
import type { CellPoint } from '../../server/legend-motion';

export const LEGEND_MODEL = 'little-legend-default';
/** Orb effects by tier (parent systems that already contain their static child; never both). The prismatic orb uses the
 * bounded Idle system, and opens with the gold RewardBoxOpen: no dedicated prismatic opening was extracted, so this is an
 * explicit display convention, not a name match. */
const ORB_IDLE: Record<BoardOrb['tier'], string> = { gray: 'orb-gray', blue: 'orb-blue', gold: 'orb-gold', prismatic: 'orb-prismatic-idle' };
const ORB_OPEN: Record<BoardOrb['tier'], string> = { gray: 'orb-gray-open', blue: 'orb-blue-open', gold: 'orb-gold-open', prismatic: 'orb-gold-open' };
/** Playback bounds (seconds) as tft-extras action-bindings.json gives them; an idle that reaches its bound is rebuilt. */
const ORB_IDLE_SECONDS = 30, PRISMATIC_IDLE_SECONDS = 3600, OPEN_SECONDS = 3, TRAVEL_EFFECT_SECONDS = 1, IMPACT_SECONDS = 3;
const ORB_COLOR: Record<BoardOrb['tier'], string> = { gray: '#a8b0ba', blue: '#4fb7ff', gold: '#ffc94a', prismatic: '#e7a8ff' };
/** Stand-in orb (no asset root, or its effect is missing): radius and float height in board units. */
const ORB_RADIUS = 9, ORB_FLOAT = 16;
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
/** My legend roams the board and this many hex widths around it; it claims an orb it passes within ORB_REACH widths of. */
const ROAM_MARGIN = 2, ORB_REACH = 0.45;
/** Hex widths a second: the room's legend pace (legend-motion.ts LEGEND_CELLS_PER_SECOND; the carousel's RUN_CELLS). */
const WALK_WIDTHS = 5;

export interface TabletopContext {
  readonly scene: Scene;
  readonly camera: Camera;
  /** Height of a champion (board units); a legend stands half of it (the doc's 0.5 × hero). */
  readonly championHeight: number;
  /** World scale of particle effects (the renderer's FX_SCALE). */
  readonly effectScale: number;
  /** A lease of `id` when the asset manifest names that model; null otherwise (a stand-in is drawn). */
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  /** The effect when the manifest names it; null otherwise (a stand-in is drawn). */
  readonly loadEffect: ((id: string, maxDuration: number) => Promise<ParticleEffect>) | null;
  readonly own: <T extends { dispose(): void }>(resource: T) => T;
  /** The orb dock's own click (BoardControls.claimOrb); called once for an orb my walking legend reaches. */
  readonly claimOrb?: (orbId: string) => void;
  readonly now?: () => number;
}
export interface Tabletop {
  /** Board-space points the camera should keep in view (legends, the orb column), for this board size. */
  layout(frame: BoardFrame): readonly Vector3[];
  frame(frame: BoardFrame): void;
  update(seconds: number): void;
  /** My orb drawn under a CSS-pixel point, by its projected center. */
  orbAt(client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): string | null;
  /**
   * Walks my legend toward a board-space point (BoardScene x/y), or to my orb `orbId`, kept within the roaming area.
   * Returns the walk in board cells for the room, or null before the board is laid out.
   */
  walkTo(point: { x: number; y: number }, orbId?: string | null): { from: CellPoint; to: CellPoint } | null;
  /** An opponent's walk as the room relayed it (its own board cells): drawn mirrored on the far side. */
  walk(walk: BoardLegendWalk): void;
  /** Acceptance read (?debug3d). */
  debug(): { legends: string[]; orbs: { orbId: string; tier: string; effect: boolean }[]; hits: string[]; opening: number; bolt: boolean };
  dispose(): void;
}

interface Path { from: Vector3; to: Vector3; start: number; end: number }
interface LegendView { readonly id: string; readonly root: Group; state: UnitActionState; mixer: UnitAnimationMixer | null; lease: ModelLease | null; disposed: boolean; path: Path | null; walked: boolean }
interface OrbView { readonly orbId: string; readonly tier: BoardOrb['tier']; readonly variant?: BoardOrb['variant']; readonly root: Group; readonly stand: Mesh; fx: ParticleEffect | null; left: number; loading: boolean; disposed: boolean; phase: number }
interface Burst { fx: ParticleEffect | null; mesh: Mesh | null; left: number; total: number }
interface Bolt { from: Vector3; to: Vector3; elapsed: number; fx: ParticleEffect | null; mesh: Mesh | null; disposed: boolean }
interface HitPlan { key: string; at: number; cast: boolean; bolt: Bolt | null; done: boolean; fromLegend: boolean }

export function createTabletop(ctx: TabletopContext): Tabletop {
  const { scene, own } = ctx;
  const legendHeight = ctx.championHeight * 0.5;
  const orbGeometry = own(new SphereGeometry(ORB_RADIUS, 20, 14));
  const orbMaterial = Object.fromEntries((Object.keys(ORB_COLOR) as BoardOrb['tier'][]).map(tier => [tier,
    own(new MeshStandardMaterial({ color: ORB_COLOR[tier], emissive: ORB_COLOR[tier], emissiveIntensity: 0.55, roughness: 0.3, transparent: true }))])) as Record<BoardOrb['tier'], MeshStandardMaterial>;
  const boltGeometry = own(new SphereGeometry(7, 16, 12));
  const boltMaterial = own(new MeshStandardMaterial({ color: '#ffe3a1', emissive: '#ffb347', emissiveIntensity: 1, transparent: true }));
  const flashMaterial = own(new MeshStandardMaterial({ color: '#ff9b6b', emissive: '#ff6a3d', emissiveIntensity: 1, transparent: true, opacity: 0.8 }));
  const legendGeometry = { body: own(new SphereGeometry(14, 20, 14)), ear: own(new ConeGeometry(4, 10, 10)), eye: own(new SphereGeometry(2.4, 10, 8)) };
  const legendMaterial = { me: own(new MeshStandardMaterial({ color: '#7fd8cf', roughness: 0.55 })),
    opponent: own(new MeshStandardMaterial({ color: '#e3a08f', roughness: 0.55 })), eye: own(new MeshStandardMaterial({ color: '#1b2230' })) };

  const now = ctx.now ?? (() => performance.now());
  const anchors = { me: new Vector3(), opponent: new Vector3(), enemySide: new Vector3(), orbs: [] as Vector3[], center: new Vector3() };
  /** Board cells: hex widths from the board origin. `bounds` is where my legend may walk (board-space x/z). */
  const board = { x: 0, z: 0, width: 1, bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } };
  let layoutKey = '';
  const layout = (frame: BoardFrame): readonly Vector3[] => {
    const width = Math.sqrt(3) * frame.hexRadius, step = frame.hexRadius * 1.5;
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}`;
    if (key !== layoutKey) {
      layoutKey = key;
      const right = frame.origin.x + width * (frame.columns - 0.5), left = frame.origin.x;
      const bottom = frame.origin.y + step * (frame.rows - 1), top = frame.origin.y;
      // About one and a half cells outside the nearest deployable cell, never on one.
      anchors.me.set(right + width * 1.6, 0, bottom);
      anchors.opponent.set(left - width * 1.6, 0, top);
      anchors.enemySide.set(frame.origin.x + width * (frame.columns - 1) / 2, 0, top);
      anchors.center.set(frame.origin.x + width * (frame.columns - 0.5) / 2, 0, (top + bottom) / 2);
      board.x = frame.origin.x; board.z = frame.origin.y; board.width = width;
      const margin = ROAM_MARGIN * width;
      board.bounds = { minX: left - margin, maxX: anchors.me.x + margin * 0.5, minZ: top - margin, maxZ: bottom + margin };
      for (const view of legends.values()) { view.walked = false; view.path = null; }
      // Two columns of orbs rising from beside my legend toward the board's middle.
      anchors.orbs = Array.from({ length: MAX_ORBS }, (_, index) => new Vector3(
        anchors.me.x + (index % 2 ? 0.42 : -0.42) * width, 0, anchors.me.z - (1 + Math.floor(index / 2)) * step * 0.9));
      for (const view of legends.values()) placeLegend(view);
      [...orbs.values()].forEach((view, index) => view.root.position.copy(orbSlot(index)));
    }
    const pad = legendHeight;
    return [anchors.me.clone().add(new Vector3(pad, 0, pad)), anchors.opponent.clone().add(new Vector3(-pad, 0, -pad)),
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
  const legend = (side: 'me' | 'opponent'): LegendView => {
    let view = legends.get(side);
    if (view) return view;
    const root = new Group(); root.name = `render3d-legend-${side}`;
    view = { id: `legend:${side}`, root, state: new UnitActionState(`legend:${side}`), mixer: null, lease: null, disposed: false, path: null, walked: false };
    legends.set(side, view);
    root.add(standIn(side));
    placeLegend(view); scene.add(root);
    // The opponent already walked on their board before its legend was shown here: it stands where that walk ends.
    if (side === 'opponent' && opponentWalk) startPath(view, opponentWalk, true);
    const created = view;
    void ctx.loadModel?.(LEGEND_MODEL).then(lease => {
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
  const sent = new Map<string, number>();
  const walkTo = (point: { x: number; y: number }, orbId: string | null = null) => {
    if (!layoutKey) return null;
    const view = legend('me');
    const orb = orbId ? orbs.get(orbId) : undefined;
    const { minX, maxX, minZ, maxZ } = board.bounds;
    const to = orb ? orb.root.position.clone().setY(0)
      : new Vector3(Math.min(maxX, Math.max(minX, point.x)), 0, Math.min(maxZ, Math.max(minZ, point.y)));
    const from = view.root.position.clone().setY(0);
    const seconds = from.distanceTo(to) / (WALK_WIDTHS * board.width);
    view.walked = true; orbTarget = orb ? orb.orbId : null;
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
    if (view.id !== 'legend:me') return;
    // An orb it walked over since the last frame (the whole stretch, so a long frame skips none), or the one it was sent
    // to on arrival, is claimed as the dock's click; once, unless that claim was refused.
    for (const orb of orbs.values()) {
      const at = sent.get(orb.orbId);
      if (at !== undefined && (refusals[orb.orbId] ?? 0) <= at) continue;
      const reach = orb.orbId === orbTarget && t >= 1 ? board.width : ORB_REACH * board.width;
      if (stretchDistance(orb.root.position, before, view.root.position) > reach) continue;
      sent.set(orb.orbId, refusals[orb.orbId] ?? 0); ctx.claimOrb?.(orb.orbId);
    }
    if (t >= 1) orbTarget = null;
  };

  // --- effects -----------------------------------------------------------------------------------------------------
  const bursts = new Set<Burst>();
  const effectAt = (id: string, seconds: number, point: Vector3, owner: () => boolean): Promise<ParticleEffect | null> => {
    if (!ctx.loadEffect) return Promise.resolve(null);
    return ctx.loadEffect(id, seconds).then(fx => {
      if (!owner()) { fx.dispose(); return null; }
      fx.object.scale.setScalar(ctx.effectScale); fx.object.position.copy(point);
      scene.add(fx.object);
      return fx;
    }).catch(() => null);
  };
  /**
   * A one-shot effect at `point`; the stand-in mesh (when given) swells and fades if the effect is not available.
   * `fallback` is tried first when `id` cannot load (a trait orb's own open effect → the generic tier's).
   */
  const burst = (id: string, seconds: number, point: Vector3, stand: Mesh | null, fallback?: string) => {
    const entry: Burst = { fx: null, mesh: null, left: seconds, total: ORB_POP_SECONDS };
    bursts.add(entry);
    const live = () => bursts.has(entry);
    void effectAt(id, seconds, point, live)
      .then(fx => fx || !fallback || !live() ? fx : effectAt(fallback, seconds, point, live)).then(fx => {
      if (fx) { entry.fx = fx; disposeStand(stand); return; }
      if (!bursts.has(entry) || !stand) { bursts.delete(entry); disposeStand(stand); return; }
      stand.position.copy(point); scene.add(stand); entry.mesh = stand; entry.left = ORB_POP_SECONDS;
    });
  };
  // Stand-in bursts carry their own material copy (opacity fades per burst).
  const disposeStand = (stand: Mesh | null) => { stand?.removeFromParent(); (stand?.material as MeshStandardMaterial | undefined)?.dispose(); };
  const endBurst = (entry: Burst) => { entry.fx?.dispose(); disposeStand(entry.mesh); bursts.delete(entry); };

  // --- orbs --------------------------------------------------------------------------------------------------------
  const orbs = new Map<string, OrbView>();
  const idleSeconds = (tier: BoardOrb['tier']) => tier === 'prismatic' ? PRISMATIC_IDLE_SECONDS : ORB_IDLE_SECONDS;
  const startIdle = (view: OrbView) => {
    if (!ctx.loadEffect || view.loading) return;
    view.loading = true;
    const point = new Vector3(0, ORB_FLOAT, 0);
    // A trait orb (S13 Warband/Crime) uses its own idle effect; if that cannot load, the generic tier's.
    const generic = () => ctx.loadEffect!(ORB_IDLE[view.tier], idleSeconds(view.tier));
    const load = view.variant ? ctx.loadEffect(`orb-${view.variant}`, idleSeconds(view.tier)).catch(generic) : generic();
    void load.then(fx => {
      view.loading = false;
      if (view.disposed) { fx.dispose(); return; }
      fx.object.scale.setScalar(ctx.effectScale); fx.object.position.copy(point);
      view.root.add(fx.object); view.fx = fx; view.left = idleSeconds(view.tier); view.stand.visible = false;
    }).catch(() => { view.loading = false; });
  };
  const createOrb = (orb: BoardOrb, index: number): OrbView => {
    const root = new Group(); root.name = `render3d-orb-${orb.tier}`;
    const stand = new Mesh(orbGeometry, orbMaterial[orb.tier]); stand.position.y = ORB_FLOAT;
    root.add(stand); root.position.copy(orbSlot(index)); scene.add(root);
    const view: OrbView = { orbId: orb.orbId, tier: orb.tier, ...(orb.variant ? { variant: orb.variant } : {}), root, stand, fx: null, left: 0, loading: false, disposed: false, phase: index * 1.3 };
    startIdle(view);
    return view;
  };
  const removeOrb = (view: OrbView, opened: boolean) => {
    view.disposed = true; view.fx?.dispose(); view.fx = null;
    const point = view.root.position.clone().setY(ORB_FLOAT);
    view.root.removeFromParent();
    if (opened) burst(view.variant ? `orb-${view.variant}-open` : ORB_OPEN[view.tier], OPEN_SECONDS, point,
      new Mesh(orbGeometry, orbMaterial[view.tier].clone()), ORB_OPEN[view.tier]);
  };

  // --- HP-loss bolt ------------------------------------------------------------------------------------------------
  let hit: HitPlan | null = null;
  const hitsPlayed: string[] = [];
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
    for (const [id, view] of orbs) if (!present.has(id)) { orbs.delete(id); sent.delete(id); removeOrb(view, seeded && opened.has(id)); }
    list.slice(0, MAX_ORBS).forEach((orb, index) => {
      let view = orbs.get(orb.orbId);
      if (!view) { view = createOrb(orb, index); orbs.set(orb.orbId, view); }
      view.root.position.copy(orbSlot(index));
      // Queued until after the battle: drawn a little smaller, still not opened.
      view.root.scale.setScalar(orb.queued ? 0.8 : 1);
    });

    const key = frame.hit?.key ?? null;
    if (seeded && key && key !== seenHit) {
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
    if (!legends.size && !orbs.size && !hit && !bursts.size) return;
    updateHit(seconds);
    if (pvpLinger > 0 && !hit) {
      pvpLinger = Math.max(0, pvpLinger - seconds);
      if (pvpLinger === 0) dropLegend('opponent');
    }
    for (const view of legends.values()) {
      moveLegend(view);
      view.state.update(seconds);
      if (view.mixer) { view.mixer.apply(legendOutput(view)); view.mixer.update(seconds); }
    }
    for (const view of orbs.values()) {
      view.stand.position.y = ORB_FLOAT + Math.sin(clock * 2 + view.phase) * 2;
      if (!view.fx) continue;
      view.fx.update(seconds, ctx.camera);
      view.left -= seconds;
      // Bounded idle: when the effect has played out, it is rebuilt rather than assumed to run forever.
      if (view.fx.finished || view.left <= 0) { view.fx.dispose(); view.fx = null; view.stand.visible = true; startIdle(view); }
    }
    for (const entry of bursts) {
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
    walk(walk) {
      if (walk.scene !== 'board' || walk.who !== 'opponent') return;
      opponentWalk = walk;
      const view = legends.get('opponent');
      if (view) startPath(view, walk);
    },
    debug: () => ({ legends: [...legends.values()].map(view => `${view.id}:${view.lease ? 'model' : 'standin'}${view.path ? ':walk' : ''}`),
      orbs: [...orbs.values()].map(view => ({ orbId: view.orbId, tier: view.tier, effect: view.fx !== null })),
      hits: [...hitsPlayed], opening: bursts.size, bolt: !!hit?.bolt && !hit.bolt.disposed }),
    dispose() {
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

/** Ground distance (x/z) from `point` to the segment `a`–`b`. */
function stretchDistance(point: Vector3, a: Vector3, b: Vector3): number {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length > 0 ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length)) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}
