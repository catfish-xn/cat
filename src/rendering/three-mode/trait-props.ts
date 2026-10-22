/**
 * The 3D board's S13 trait props (planning W5/W6): the 铁血征服者 banner/chest on the right of my half (outside my
 * legend's orb columns, where TFT plants it) and the 炼金男爵 微光 flask on the left. Both read only BoardFrame.mechanics, my own counters as the trait column shows them (never another seat's),
 * and decide nothing: the chest glows brighter as 征服层数 nears the next chest and opens when the opened count grows
 * (its reward orb is the tabletop's Warband orb); the flask fills to 微光 / next black market, bubbles while a black
 * market waits, and drains when an accepted offer clears it. Like the tabletop, the first frame only records what is
 * there, so a reload never replays an opening. Asset ids are optional manifest entries; without them stand-ins draw.
 * An extracted model replaces the stand-in body and plays its own idle clip (14.24 has no chest-opening clip: the
 * Conqueror prop is a war banner), so a chest opening on a model is the open effect plus a procedural rise and sway;
 * the stand-in is also a war banner. A ground aura carries the progress glow / fill level for either body.
 */
import {
  AnimationMixer, Box3, BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector2, Vector3,
  type Camera, type Object3D, type Scene,
} from 'three';
import type { ModelLease, ParticleEffect } from '../../rendering3d';
import type { BoardFrame, BoardMechanics } from '../board-feed';
import { conquestLabel } from '../conqueror-flag';

export const CHEST_MODEL = 'conqueror-chest', FLASK_MODEL = 'shimmer-flask';
export const CHEST_OPEN_EFFECT = 'conqueror-chest-open', FLASK_OFFER_EFFECT = 'shimmer-flask-offer', FLASK_TAKE_EFFECT = 'shimmer-flask-take';
const EFFECT_SECONDS = 3;
/** Stand-in heights in board units (a champion is 92 tall). */
const FLAG_HEIGHT = 70, FLASK_HEIGHT = 36, LIQUID_BOTTOM = 1.5, LIQUID_TOP = 22;
/** Extracted models stand this tall (the Conqueror banner is a standard, most of a champion's 92); the ground aura's radius. */
const CHEST_MODEL_HEIGHT = 76, AURA_RADIUS = 22;
/** A model's opening motion: rises this far and sways (radians) while the open effect plays. */
const RISE = 9, SWAY = 0.16;
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
    chest: { shown: boolean; glow: number; label: string; opening: boolean; model: boolean; rise: number };
    flask: { shown: boolean; fill: number; target: number; offer: boolean; model: boolean };
    bursts: number;
  };
  dispose(): void;
}

interface Burst { fx: ParticleEffect | null; mesh: Mesh | null; left: number }
/** `root` is placed in the scene; `body` holds the stand-in, the aura and a model (one child of root, like a piece). */
interface Prop { readonly root: Group; readonly body: Group; readonly stand: Group; lease: ModelLease | null; motion: Group | null; mixer: AnimationMixer | null; loading: boolean; disposed: boolean }

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
  chestStand.name = 'render3d-conqueror-flag';
  const cloth = own(new MeshStandardMaterial({ color: '#741d30', roughness: 0.85 }));
  const block = (width: number, height: number, depth: number, x: number, y: number, z: number, material: MeshStandardMaterial) => {
    const mesh = new Mesh(own(new BoxGeometry(width, height, depth)), material);
    mesh.position.set(x, y, z); chestStand.add(mesh); return mesh;
  };
  block(22, 4, 18, 0, 2, 0, metal);
  block(3, FLAG_HEIGHT - 4, 3, 0, (FLAG_HEIGHT + 4) / 2, 0, wood);
  block(34, 3, 3, 0, FLAG_HEIGHT - 4, 0, metal);
  // A hanging crimson standard with gold trim, visible from either side.
  block(28, 40, 1.4, 0, 44, 2, cloth);
  for (const x of [-14, 14]) block(1.6, 40, 2, x, 44, 2, metal);
  block(29, 2, 2, 0, 24, 2, metal);
  const emblem = block(10, 10, 2, 0, 45, 2, metal); emblem.rotation.z = Math.PI / 4;
  const emblemGlow = block(8, 8, 2.2, 0, 45, 2, glowMaterial); emblemGlow.rotation.z = Math.PI / 4;
  const chestBody = new Group(), chestMotion = new Group();
  chestMotion.add(chestStand); chestBody.add(chestMotion); chestRoot.add(chestBody); scene.add(chestRoot);
  const chest: Prop = { root: chestRoot, body: chestBody, stand: chestStand, lease: null, motion: chestMotion, mixer: null, loading: false, disposed: false };

  // A billboard outside the moving body: the total stays readable during a payout.
  let label = '';
  let labelView: { canvas: HTMLCanvasElement; texture: CanvasTexture; sprite: Sprite } | null = null;
  const showLabel = (text: string) => {
    const changed = label !== text;
    label = text; // Also available in headless tests without a document/canvas.
    if (!labelView) {
      const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
      if (!canvas?.getContext('2d')) return;
      canvas.width = 192; canvas.height = 80;
      const texture = new CanvasTexture(canvas);
      const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
      sprite.name = 'render3d-conqueror-stacks'; sprite.scale.set(48, 20, 1); sprite.renderOrder = 1003;
      chestRoot.add(sprite); labelView = { canvas, texture, sprite };
    } else if (!changed) return;
    const draw = labelView.canvas.getContext('2d')!;
    draw.clearRect(0, 0, 192, 80);
    draw.fillStyle = 'rgba(10, 16, 24, .92)'; draw.beginPath(); draw.roundRect(2, 2, 188, 76, 18); draw.fill();
    draw.fillStyle = GOLD; draw.font = 'bold 48px sans-serif'; draw.textAlign = 'center'; draw.textBaseline = 'middle';
    draw.fillText(text, 96, 42, 174); labelView.texture.needsUpdate = true;
    labelView.sprite.position.y = (chest.lease ? CHEST_MODEL_HEIGHT : FLAG_HEIGHT) + 16;
  };

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
  const flaskBody = new Group(); flaskBody.add(flaskStand); flaskRoot.add(flaskBody); scene.add(flaskRoot);
  const flask: Prop = { root: flaskRoot, body: flaskBody, stand: flaskStand, lease: null, motion: null, mixer: null, loading: false, disposed: false };
  // Ground auras (outside the stand-ins, so a model keeps them): gold toward the next chest, violet with the 微光 level.
  const auraGeometry = own(new CircleGeometry(AURA_RADIUS, 32).rotateX(-Math.PI / 2));
  const flaskAuraMaterial = own(new MeshStandardMaterial({ color: SHIMMER, emissive: SHIMMER, emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }));
  const chestAuraMaterial = own(new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }));
  const chestAura = new Mesh(auraGeometry, chestAuraMaterial), flaskAura = new Mesh(auraGeometry, flaskAuraMaterial);
  chestAura.position.y = flaskAura.position.y = 0.4;
  chestBody.add(chestAura); flaskBody.add(flaskAura);

  /** Swaps a stand-in for its manifest model once (scaled to the stand-in's height); the stand-in stays on any failure. */
  const tryModel = (prop: Prop, id: string, height: number) => {
    if (!ctx.loadModel || prop.loading || prop.lease) return;
    prop.loading = true;
    void ctx.loadModel(id).then(lease => {
      if (prop.disposed || lease.placeholder) { lease.release(); return; }
      prop.lease = lease; prop.stand.visible = false;
      // A wrapper takes the procedural motion, so the fitted model keeps its own scale and foot offset.
      if (!prop.motion) { prop.motion = new Group(); prop.body.add(prop.motion); }
      prop.motion.add(fitHeight(lease.scene, height));
      if (prop === chest && labelView) labelView.sprite.position.y = CHEST_MODEL_HEIGHT + 16;
      const idle = lease.animations.find(clip => /idle/i.test(clip.name)) ?? lease.animations[0];
      if (idle) { prop.mixer = new AnimationMixer(lease.scene); prop.mixer.clipAction(idle).play(); }
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
      // The banner right of my half, one cell beyond my legend's orb columns (the tabletop's legend spot); the flask on
      // the left (the opponent's legend stands top left).
      const left = frame.origin.x - width * 1.25, bottom = frame.origin.y + step * (frame.rows - 1);
      const right = frame.origin.x + width * (frame.columns - 0.5) + width * 2.65;
      spots.chest.set(right, 0, bottom - step * 1.4);
      spots.flask.set(left, 0, bottom - step * 2.1);
      chestRoot.position.copy(spots.chest); flaskRoot.position.copy(spots.flask);
      // Each turned a little toward the board so its front (lock, label side) faces the player's camera.
      chestRoot.rotation.y = -0.45; flaskRoot.rotation.y = 0.45;
    }
    const pad = 34;
    return [spots.chest.clone().add(new Vector3(pad, CHEST_MODEL_HEIGHT + 26, pad)), spots.flask.clone().add(new Vector3(-pad, FLASK_HEIGHT, 0))];
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
  let glow = 0, openHold = 0;
  let fill = 0, fillTarget = 0, offer = false, clock = 0;
  const onFrame = (frame: BoardFrame) => {
    layout(frame);
    const next = frame.mechanics;
    const conquest = next?.conquest, shimmer = next?.shimmer;
    chestRoot.visible = !!conquest;
    if (conquest) {
      tryModel(chest, CHEST_MODEL, CHEST_MODEL_HEIGHT);
      showLabel(conquestLabel(conquest));
      const done = conquest.next === null;
      glow = done ? 0 : Math.min(1, Math.max(0, (conquest.stacks - conquest.from) / Math.max(1, conquest.next! - conquest.from)));
      if (seeded && conquest.opened > (last?.conquest?.opened ?? conquest.opened)) {
        openHold = OPEN_HOLD_SECONDS;
        burst(CHEST_OPEN_EFFECT, spots.chest.clone().setY(FLAG_HEIGHT / 2), GOLD);
      }
    } else { label = ''; openHold = 0; }
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
      openHold = Math.max(0, openHold - seconds);
      // Brighter toward the next chest, a slow breath once it is close; full while a chest is paying out.
      const breath = glow > 0.75 ? 0.15 * Math.sin(clock * 4) : 0, shine = openHold > 0 ? 1 : glow * 0.85 + breath;
      glowMaterial.opacity = Math.max(0, Math.min(1, shine)); glowMaterial.emissiveIntensity = 1.6 * Math.max(0, shine);
      metal.emissiveIntensity = 0.15 + 0.6 * Math.max(0, shine);
      chestAuraMaterial.opacity = 0.55 * Math.max(0, Math.min(1, shine)); chestAuraMaterial.emissiveIntensity = Math.max(0, shine);
      chest.mixer?.update(seconds);
      if (chest.motion) {
        // No opening clip on the model: it rises and sways while the open effect plays, then settles.
        const t = openHold > 0 ? 1 - openHold / OPEN_HOLD_SECONDS : 1, live = openHold > 0 ? 1 : 0;
        chest.motion.position.y = live * Math.sin(Math.PI * t) * RISE;
        chest.motion.rotation.z = live * Math.sin(t * Math.PI * 6) * SWAY * (1 - t);
      }
    }
    if (flaskRoot.visible) {
      fill += (fillTarget - fill) * Math.min(1, seconds * FILL_RATE);
      level.scale.y = Math.max(0.001, fill * (LIQUID_TOP - LIQUID_BOTTOM));
      liquid.emissiveIntensity = offer ? 0.9 + 0.4 * Math.sin(clock * 6) : 0.5;
      flaskAuraMaterial.opacity = Math.min(0.8, fill * 0.55 + (offer ? 0.2 + 0.1 * Math.sin(clock * 6) : 0));
      flaskAuraMaterial.emissiveIntensity = 0.4 + fill;
      flask.mixer?.update(seconds);
      // A model has no liquid to bubble: it bobs while a black market waits.
      if (flask.motion) flask.motion.position.y = offer ? Math.abs(Math.sin(clock * 3)) * 3 : 0;
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

  const dropProp = (prop: Prop) => {
    prop.disposed = true; prop.mixer?.stopAllAction(); prop.mixer = null;
    prop.lease?.release(); prop.lease = null; prop.root.removeFromParent();
  };
  return {
    layout, frame: onFrame, update,
    debug: () => ({
      chest: { shown: chestRoot.visible, glow, label, opening: openHold > 0, model: !!chest.lease, rise: chest.motion?.position.y ?? 0 },
      flask: { shown: flaskRoot.visible, fill, target: fillTarget, offer, model: !!flask.lease },
      bursts: bursts.size,
    }),
    dispose() { labelView?.texture.dispose(); labelView?.sprite.material.dispose(); labelView = null; for (const entry of [...bursts]) endBurst(entry); dropProp(chest); dropProp(flask); },
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
