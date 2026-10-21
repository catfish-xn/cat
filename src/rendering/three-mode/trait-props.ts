/**
 * The 3D board's S13 trait props (planning W5/W6): the 铁血征服者 chest and the 炼金男爵 微光 flask on the left of my
 * half. Both read only BoardFrame.mechanics, my own counters as the trait column shows them (never another seat's),
 * and decide nothing: the chest glows brighter as 征服层数 nears the next chest and opens when the opened count grows
 * (its reward orb is the tabletop's Warband orb); the flask fills to 微光 / next black market, bubbles while a black
 * market waits, and drains when an accepted offer clears it. Like the tabletop, the first frame only records what is
 * there, so a reload never replays an opening. Asset ids are optional manifest entries; without them stand-ins draw.
 */
import {
  Box3, BoxGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector2, Vector3,
  type Camera, type Object3D, type Scene,
} from 'three';
import type { ModelLease, ParticleEffect } from '../../rendering3d';
import type { BoardFrame, BoardMechanics } from '../board-feed';

export const CHEST_MODEL = 'conqueror-chest', FLASK_MODEL = 'shimmer-flask';
export const CHEST_OPEN_EFFECT = 'conqueror-chest-open', FLASK_OFFER_EFFECT = 'shimmer-flask-offer', FLASK_TAKE_EFFECT = 'shimmer-flask-take';
const EFFECT_SECONDS = 3;
/** Stand-in sizes in board units (a champion is 92 tall): chest 34 × 18 × 24, flask 36 tall. */
const CHEST = { width: 34, height: 18, depth: 24, lid: 7 }, FLASK_HEIGHT = 36, LIQUID_BOTTOM = 1.5, LIQUID_TOP = 22;
/** Lid angles (radians, opening backward): shut, fully open while a chest pays out, and resting ajar once all are open. */
const LID_OPEN = -1.95, LID_DONE = -0.55;
const OPEN_HOLD_SECONDS = 1.6, POP_SECONDS = 0.5, FILL_RATE = 1.6, BUBBLES = 6;
const GOLD = '#e5b64a', SHIMMER = '#c25bff';

export interface TraitPropsContext {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly effectScale: number;
  /** A lease of `id` when the asset manifest names that model; null (or a rejection) draws the stand-in. */
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  readonly loadEffect: ((id: string, maxDuration: number) => Promise<ParticleEffect>) | null;
  readonly own: <T extends { dispose(): void }>(resource: T) => T;
}
export interface TraitProps {
  /** Board-space points the camera should keep in view, for this board size. */
  layout(frame: BoardFrame): readonly Vector3[];
  frame(frame: BoardFrame): void;
  update(seconds: number): void;
  /** Acceptance read (?debug3d). */
  debug(): {
    chest: { shown: boolean; glow: number; lid: number; opening: boolean; model: boolean };
    flask: { shown: boolean; fill: number; target: number; offer: boolean; model: boolean };
    bursts: number;
  };
  dispose(): void;
}

interface Burst { fx: ParticleEffect | null; mesh: Mesh | null; left: number }
interface Prop { readonly root: Group; readonly stand: Group; lease: ModelLease | null; loading: boolean; disposed: boolean }

export function createTraitProps(ctx: TraitPropsContext): TraitProps {
  const { scene, own } = ctx;
  const metal = own(new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.15, metalness: 0.7, roughness: 0.35 }));
  const wood = own(new MeshStandardMaterial({ color: '#5a3522', roughness: 0.8 }));
  const glowMaterial = own(new MeshStandardMaterial({ color: '#ffe7a3', emissive: GOLD, emissiveIntensity: 0, transparent: true, opacity: 0 }));
  const glass = own(new MeshStandardMaterial({ color: '#d8ecff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }));
  const liquid = own(new MeshStandardMaterial({ color: SHIMMER, emissive: SHIMMER, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0.88 }));
  const cork = own(new MeshStandardMaterial({ color: '#8a6440', roughness: 0.9 }));
  const bubbleMaterial = own(new MeshStandardMaterial({ color: '#f3d6ff', emissive: SHIMMER, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
  const popGeometry = own(new SphereGeometry(10, 16, 12));

  // --- chest -------------------------------------------------------------------------------------------------------
  const chestRoot = new Group(); chestRoot.name = 'render3d-conqueror-chest'; chestRoot.visible = false;
  const chestStand = new Group();
  const lid = new Group();
  {
    const { width, height, depth } = CHEST;
    const body = new Mesh(own(new BoxGeometry(width, height, depth)), wood); body.position.y = height / 2;
    const bands = own(new BoxGeometry(width + 1.2, 2.4, depth + 1.2));
    for (const y of [2, height - 2]) { const band = new Mesh(bands, metal); band.position.y = y; chestStand.add(band); }
    const lock = new Mesh(own(new BoxGeometry(5, 6, 1.6)), metal); lock.position.set(0, height - 3, depth / 2 + 0.8);
    // The lid hinges on the back top edge; its own band rides along.
    lid.position.set(0, height, -depth / 2);
    const top = new Mesh(own(new BoxGeometry(width, CHEST.lid, depth)), wood); top.position.set(0, CHEST.lid / 2, depth / 2);
    const lidBand = new Mesh(own(new BoxGeometry(width + 1.2, 2.4, depth + 1.2)), metal); lidBand.position.set(0, CHEST.lid - 1.2, depth / 2);
    lid.add(top, lidBand);
    // Light from inside the seam: invisible at 0 progress, a warm halo near the next chest.
    const glow = new Mesh(own(new BoxGeometry(width - 2, 3, depth - 2)), glowMaterial); glow.position.y = height + 0.5;
    chestStand.add(body, lock, lid, glow);
  }
  chestRoot.add(chestStand); scene.add(chestRoot);
  const chest: Prop = { root: chestRoot, stand: chestStand, lease: null, loading: false, disposed: false };

  // --- flask -------------------------------------------------------------------------------------------------------
  const flaskRoot = new Group(); flaskRoot.name = 'render3d-shimmer-flask'; flaskRoot.visible = false;
  const flaskStand = new Group();
  const level = new Group();
  const bubbles: { mesh: Mesh; phase: number }[] = [];
  {
    const outline = [[0, 0], [9, 0.6], [12.5, 4], [13, 12], [12, 19], [8.5, 24], [5, 27], [5, 33], [6, 34]].map(([x, y]) => new Vector2(x, y));
    const shell = new Mesh(own(new LatheGeometry(outline, 24)), glass); shell.renderOrder = 2;
    // A unit-tall column scaled to the fill; it sits inside the shell's belly.
    const column = new Mesh(own(new CylinderGeometry(11.6, 10.5, 1, 24).translate(0, 0.5, 0)), liquid);
    level.position.y = LIQUID_BOTTOM; level.add(column); level.scale.y = 0.001;
    const stopper = new Mesh(own(new CylinderGeometry(5.6, 4.6, 5, 14)), cork); stopper.position.y = FLASK_HEIGHT - 1.5;
    const bubble = own(new SphereGeometry(1.4, 8, 6));
    for (let index = 0; index < BUBBLES; index++) {
      const mesh = new Mesh(bubble, bubbleMaterial); mesh.visible = false;
      bubbles.push({ mesh, phase: index / BUBBLES }); flaskStand.add(mesh);
    }
    flaskStand.add(level, stopper, shell);
  }
  flaskRoot.add(flaskStand); scene.add(flaskRoot);
  const flask: Prop = { root: flaskRoot, stand: flaskStand, lease: null, loading: false, disposed: false };

  /** Swaps a stand-in for its manifest model once (scaled to the stand-in's height); the stand-in stays on any failure. */
  const tryModel = (prop: Prop, id: string, height: number) => {
    if (!ctx.loadModel || prop.loading || prop.lease) return;
    prop.loading = true;
    void ctx.loadModel(id).then(lease => {
      if (prop.disposed || lease.placeholder) { lease.release(); return; }
      prop.lease = lease; prop.stand.visible = false;
      prop.root.add(fitHeight(lease.scene, height));
    }).catch(() => { /* keeps the stand-in */ });
  };

  // --- layout ------------------------------------------------------------------------------------------------------
  const spots = { chest: new Vector3(), flask: new Vector3() };
  let layoutKey = '';
  const layout = (frame: BoardFrame): readonly Vector3[] => {
    const width = Math.sqrt(3) * frame.hexRadius, step = frame.hexRadius * 1.5;
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}`;
    if (key !== layoutKey) {
      layoutKey = key;
      // Left of my half (the tabletop keeps my legend and orbs on the right, the opponent's legend top left).
      const left = frame.origin.x - width * 1.25, bottom = frame.origin.y + step * (frame.rows - 1);
      spots.chest.set(left, 0, bottom - step * 0.35);
      spots.flask.set(left, 0, bottom - step * 2.1);
      chestRoot.position.copy(spots.chest); flaskRoot.position.copy(spots.flask);
      // Turned a little toward the board so the front (lock, label side) faces the player's camera.
      chestRoot.rotation.y = flaskRoot.rotation.y = 0.45;
    }
    const pad = CHEST.width;
    return [spots.chest.clone().add(new Vector3(-pad, 0, pad)), spots.flask.clone().add(new Vector3(-pad, FLASK_HEIGHT, 0))];
  };

  // --- bursts ------------------------------------------------------------------------------------------------------
  const bursts = new Set<Burst>();
  const burst = (id: string, point: Vector3, color: string) => {
    const entry: Burst = { fx: null, mesh: null, left: EFFECT_SECONDS };
    bursts.add(entry);
    const standIn = () => {
      if (!bursts.has(entry)) return;
      const material = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, transparent: true, opacity: 0.85 });
      entry.mesh = new Mesh(popGeometry, material); entry.mesh.position.copy(point); scene.add(entry.mesh); entry.left = POP_SECONDS;
    };
    if (!ctx.loadEffect) { standIn(); return; }
    void ctx.loadEffect(id, EFFECT_SECONDS).then(fx => {
      if (!bursts.has(entry)) { fx.dispose(); return; }
      fx.object.scale.setScalar(ctx.effectScale); fx.object.position.copy(point); scene.add(fx.object); entry.fx = fx;
    }).catch(standIn);
  };
  const endBurst = (entry: Burst) => {
    entry.fx?.dispose();
    if (entry.mesh) { entry.mesh.removeFromParent(); (entry.mesh.material as MeshStandardMaterial).dispose(); }
    bursts.delete(entry);
  };

  // --- frames ------------------------------------------------------------------------------------------------------
  let seeded = false, last: BoardMechanics | undefined;
  let glow = 0, lidAngle = 0, lidTarget = 0, openHold = 0, done = false;
  let fill = 0, fillTarget = 0, offer = false, clock = 0;
  const onFrame = (frame: BoardFrame) => {
    layout(frame);
    const next = frame.mechanics;
    const conquest = next?.conquest, shimmer = next?.shimmer;
    chestRoot.visible = !!conquest;
    if (conquest) {
      tryModel(chest, CHEST_MODEL, CHEST.height + CHEST.lid);
      done = conquest.next === null;
      glow = done ? 0 : Math.min(1, Math.max(0, (conquest.stacks - conquest.from) / Math.max(1, conquest.next! - conquest.from)));
      if (seeded && conquest.opened > (last?.conquest?.opened ?? conquest.opened)) {
        lidTarget = LID_OPEN; openHold = OPEN_HOLD_SECONDS;
        burst(CHEST_OPEN_EFFECT, spots.chest.clone().setY(CHEST.height + 4), GOLD);
      } else if (openHold <= 0) lidTarget = done ? LID_DONE : 0;
      if (!seeded) lidAngle = lidTarget;
    }
    flaskRoot.visible = !!shimmer;
    if (shimmer) {
      tryModel(flask, FLASK_MODEL, FLASK_HEIGHT);
      fillTarget = shimmer.next === null ? 1 : Math.min(1, shimmer.value / shimmer.next);
      const before = last?.shimmer;
      if (seeded && shimmer.offer && !before?.offer) burst(FLASK_OFFER_EFFECT, spots.flask.clone().setY(FLASK_HEIGHT), SHIMMER);
      // An answered offer that cleared the 微光 was accepted (a skip keeps it): the flask drains as the reward orb drops.
      if (seeded && before?.offer && !shimmer.offer && shimmer.value < before.value) burst(FLASK_TAKE_EFFECT, spots.flask.clone().setY(LIQUID_TOP), SHIMMER);
      offer = shimmer.offer;
      if (!seeded) fill = fillTarget;
    } else offer = false;
    last = next; seeded = true;
  };

  const update = (seconds: number) => {
    clock += seconds;
    if (chestRoot.visible) {
      if (openHold > 0 && (openHold -= seconds) <= 0) lidTarget = done ? LID_DONE : 0;
      lidAngle += (lidTarget - lidAngle) * Math.min(1, seconds * 7);
      lid.rotation.x = lidAngle;
      // Brighter toward the next chest, a slow breath once it is close; full while a chest is paying out.
      const breath = glow > 0.75 ? 0.15 * Math.sin(clock * 4) : 0, shine = openHold > 0 ? 1 : glow * 0.85 + breath;
      glowMaterial.opacity = Math.max(0, Math.min(1, shine)); glowMaterial.emissiveIntensity = 1.6 * Math.max(0, shine);
      metal.emissiveIntensity = 0.15 + 0.6 * Math.max(0, shine);
    }
    if (flaskRoot.visible) {
      fill += (fillTarget - fill) * Math.min(1, seconds * FILL_RATE);
      level.scale.y = Math.max(0.001, fill * (LIQUID_TOP - LIQUID_BOTTOM));
      liquid.emissiveIntensity = offer ? 0.9 + 0.4 * Math.sin(clock * 6) : 0.5;
      const surface = LIQUID_BOTTOM + fill * (LIQUID_TOP - LIQUID_BOTTOM);
      for (const bubble of bubbles) {
        bubble.mesh.visible = offer && fill > 0.05;
        if (!bubble.mesh.visible) continue;
        const t = (clock * 0.7 + bubble.phase) % 1, angle = bubble.phase * Math.PI * 2;
        bubble.mesh.position.set(Math.cos(angle) * 6 * (1 - t * 0.4), LIQUID_BOTTOM + t * (surface - LIQUID_BOTTOM), Math.sin(angle) * 6 * (1 - t * 0.4));
      }
    }
    for (const entry of bursts) {
      entry.left -= seconds;
      if (entry.fx) entry.fx.update(seconds, ctx.camera);
      else if (entry.mesh) {
        const t = 1 - Math.max(0, entry.left) / POP_SECONDS;
        entry.mesh.scale.setScalar(0.6 + t * 1.8);
        (entry.mesh.material as MeshStandardMaterial).opacity = 0.85 * (1 - t);
      }
      if (entry.left <= 0 || entry.fx?.finished) endBurst(entry);
    }
  };

  const dropProp = (prop: Prop) => { prop.disposed = true; prop.lease?.release(); prop.lease = null; prop.root.removeFromParent(); };
  return {
    layout, frame: onFrame, update,
    debug: () => ({
      chest: { shown: chestRoot.visible, glow, lid: lidAngle, opening: openHold > 0, model: !!chest.lease },
      flask: { shown: flaskRoot.visible, fill, target: fillTarget, offer, model: !!flask.lease },
      bursts: bursts.size,
    }),
    dispose() { for (const entry of [...bursts]) endBurst(entry); dropProp(chest); dropProp(flask); },
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
