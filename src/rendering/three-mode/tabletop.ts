/**
 * The 3D board's surroundings (docs/ASSETS3D_TFT_EXTRAS.md 界面接线需求): my 河灵 (little legend) beside the board, an
 * opponent's on the far side while a PvP battle is shown, my unclaimed orbs in a column next to my legend, and the
 * HP-loss bolt of a settled round. Everything here is drawn from BoardFrame fields the 2D scene already reads (the
 * private orb view, the claim receipts, roundResults); a click on an orb goes back through BoardControls.claimOrb, which
 * is the 2D orb dock's own click. Nothing is priced, rolled or settled here, and a reload never replays an old opening
 * or hit: the first frame only records what is already there.
 */
import {
  Box3, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Camera, type Object3D, type Scene,
} from 'three';
import { UnitActionState, UnitAnimationMixer, type ModelLease, type ParticleEffect } from '../../rendering3d';
import type { BoardFrame, BoardOrb } from '../board-feed';

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
}
export interface Tabletop {
  /** Board-space points the camera should keep in view (legends, the orb column), for this board size. */
  layout(frame: BoardFrame): readonly Vector3[];
  frame(frame: BoardFrame): void;
  update(seconds: number): void;
  /** My orb drawn under a CSS-pixel point, by its projected center. */
  orbAt(client: { x: number; y: number }, area: { left: number; top: number; width: number; height: number }): string | null;
  /** Acceptance read (?debug3d). */
  debug(): { legends: string[]; orbs: { orbId: string; tier: string; effect: boolean }[]; hits: string[]; opening: number; bolt: boolean };
  dispose(): void;
}

interface LegendView { readonly id: string; readonly root: Group; state: UnitActionState; mixer: UnitAnimationMixer | null; lease: ModelLease | null; disposed: boolean }
interface OrbView { readonly orbId: string; readonly tier: BoardOrb['tier']; readonly root: Group; readonly stand: Mesh; fx: ParticleEffect | null; left: number; loading: boolean; disposed: boolean; phase: number }
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

  const anchors = { me: new Vector3(), opponent: new Vector3(), enemySide: new Vector3(), orbs: [] as Vector3[], center: new Vector3() };
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
    const side = view.id === 'legend:me' ? anchors.me : anchors.opponent;
    view.root.position.copy(side);
    // Models face +z; turn toward the board.
    view.root.rotation.y = Math.atan2(anchors.center.x - side.x, anchors.center.z - side.z);
  };
  const legend = (side: 'me' | 'opponent'): LegendView => {
    let view = legends.get(side);
    if (view) return view;
    const root = new Group(); root.name = `render3d-legend-${side}`;
    view = { id: `legend:${side}`, root, state: new UnitActionState(`legend:${side}`), mixer: null, lease: null, disposed: false };
    legends.set(side, view);
    root.add(standIn(side));
    placeLegend(view); scene.add(root);
    const created = view;
    void ctx.loadModel?.(LEGEND_MODEL).then(lease => {
      if (created.disposed || lease.placeholder) { lease.release(); return; }
      created.root.clear();
      created.lease = lease;
      created.root.add(fitHeight(lease.scene, legendHeight));
      created.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      created.mixer.apply(created.state.output);
    }).catch(() => { /* keeps the stand-in */ });
    return view;
  };
  const act = (view: LegendView | undefined, event: 'cast' | 'hit') => {
    if (!view) return;
    const output = view.state.consume(event === 'cast' ? { type: 'cast', sourceId: view.id }
      : { type: 'packetDamage', sourceId: 'legend:hit', targetId: view.id, hit: true, hpDamage: 1, absorbed: 0 });
    view.mixer?.apply(output);
  };
  const dropLegend = (side: 'me' | 'opponent') => {
    const view = legends.get(side);
    if (!view) return;
    view.disposed = true; view.mixer?.dispose(); view.lease?.release(); view.root.removeFromParent(); legends.delete(side);
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
  /** A one-shot effect at `point`; the stand-in mesh (when given) swells and fades if the effect is not available. */
  const burst = (id: string, seconds: number, point: Vector3, stand: Mesh | null) => {
    const entry: Burst = { fx: null, mesh: null, left: seconds, total: ORB_POP_SECONDS };
    bursts.add(entry);
    void effectAt(id, seconds, point, () => bursts.has(entry)).then(fx => {
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
    void ctx.loadEffect(ORB_IDLE[view.tier], idleSeconds(view.tier)).then(fx => {
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
    const view: OrbView = { orbId: orb.orbId, tier: orb.tier, root, stand, fx: null, left: 0, loading: false, disposed: false, phase: index * 1.3 };
    startIdle(view);
    return view;
  };
  const removeOrb = (view: OrbView, opened: boolean) => {
    view.disposed = true; view.fx?.dispose(); view.fx = null;
    const point = view.root.position.clone().setY(ORB_FLOAT);
    view.root.removeFromParent();
    if (opened) burst(ORB_OPEN[view.tier], OPEN_SECONDS, point, new Mesh(orbGeometry, orbMaterial[view.tier].clone()));
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
    const source = plan.fromLegend ? anchors.opponent : anchors.enemySide;
    const bolt: Bolt = { from: source.clone().setY(legendHeight * 0.6), to: anchors.me.clone().setY(legendHeight * 0.6), elapsed: 0, fx: null, mesh: null, disposed: false };
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
        const at = anchors.me.clone().setY(legendHeight * 0.6);
        burst('player-damage-tar', IMPACT_SECONDS, at, new Mesh(boltGeometry, flashMaterial.clone()));
        act(legends.get('me'), 'hit');
      }
    }
    if (bolt?.disposed && plan.at >= CAST_LEAD_SECONDS + TRAVEL_SECONDS + IMPACT_HOLD_SECONDS) { plan.done = true; hit = null; }
  };

  // --- frames ------------------------------------------------------------------------------------------------------
  let seeded = false, granted = 0, seenHit: string | null = null, pvpLinger = 0, pvpShown = false;
  const onFrame = (frame: BoardFrame) => {
    layout(frame);
    legend('me');
    // A shown battle against another board (no PvE monsters among the enemies) has that board's legend on its side.
    const enemies = frame.pieces.filter(piece => piece.team === 'enemy');
    if (frame.fighting && enemies.length) pvpShown = enemies.every(piece => !piece.definitionId.startsWith('pve-'));
    if (frame.fighting && pvpShown) { legend('opponent'); pvpLinger = OPPONENT_LINGER_SECONDS; }

    const list = frame.orbs ?? [], present = new Set(list.map(orb => orb.orbId));
    const grantedNow = frame.orbsGranted ?? 0, grew = seeded && grantedNow > granted;
    for (const [id, view] of orbs) if (!present.has(id)) { orbs.delete(id); removeOrb(view, grew); }
    granted = grantedNow;
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
      const output = view.state.update(seconds);
      if (view.mixer) { view.mixer.apply(output); view.mixer.update(seconds); }
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
    layout, frame: onFrame, update, orbAt,
    debug: () => ({ legends: [...legends.values()].map(view => `${view.id}:${view.lease ? 'model' : 'standin'}`),
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
