/**
 * Powder's monkey on the board (presentation only; the rules send it on `powder-monkey-sent` with its landing cell and
 * arrival tick, and it explodes on `powder-monkey-arrived`). Fable 11-17: the monkey in her hand (her model's Monkey
 * submesh, hidden by her cast clip's own submesh event) and the one on the ground swap in one frame, the ground one where
 * and as big as the hand one was, never both and never neither; it then runs to its cell and gets there on the arrival
 * tick. The ground monkey's rig is the hand one's without the `Monkey_` prefix, so the swap is read off matching bones.
 * Drop and run shapes are fitted, not original data.
 */
import { AnimationMixer, Group, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';

/** How long the swapped-in monkey takes to come down from the hand to the floor while it starts to run (s, fitted). */
export const MONKEY_DROP_SECONDS = 0.2;
/** The hand monkey's bones in Powder's rig, and the standalone monkey's matching ones. */
const HAND_ROOT = 'Monkey_Root', HAND_MESH = 'Monkey', ROOT = 'Root';

export interface MonkeyLease { readonly scene: Object3D; readonly animations: readonly AnimationClip[]; readonly animationNames: { readonly move?: string }; release(): void; readonly placeholder?: boolean }
interface Monkey {
  owner: string; root: Group; lease?: MonkeyLease; mixer?: AnimationMixer;
  /** Seconds since her cast; when her clip should hide the hand one (a swap on a hide well before it is not this one). */
  since: number; hideAt: number;
  /** Seconds run since the swap, and its whole run (from the swap to the arrival) once the rules sent it. */
  ran: number; runFor?: number;
  /** Its cell, once the rules sent it. */
  to?: Vector3; sent: boolean;
  from?: Vector3; size?: number; facing?: Quaternion; started: boolean; disposed: boolean;
  /** The standalone monkey's root bone in its own model space (unscaled), so the swap puts that bone where the hand's was. */
  offset?: Vector3;
  /** The hand monkey as last seen while still in her hand (the frame before her clip hides it). */
  hand?: { root: Vector3; size: number; turn: Quaternion } | null;
}

/**
 * Where the hand monkey stands and how big it is, read off its root bone in the owner's posed body: the bone's world
 * point, world scale (her cast clip scales it, and her model's own fit is in it) and world turn. The ground monkey's root
 * bone takes the same three (its rig and mesh are the hand one's). Its root-to-head length is no measure: the clip
 * squashes and stretches the monkey's spring.
 */
export function handMonkeyPose(body: Object3D): { root: Vector3; size: number; turn: Quaternion } | null {
  const root = body.getObjectByName(HAND_ROOT);
  if (!root) return null;
  body.updateMatrixWorld(true);
  const scale = root.getWorldScale(new Vector3());
  return { root: root.getWorldPosition(new Vector3()), size: (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3, turn: root.getWorldQuaternion(new Quaternion()) };
}

/** The hand monkey's own mesh in her body (the submesh her clip shows and hides, named by its material), if any. */
export function handMonkeyShown(body: Object3D): boolean | undefined {
  let shown: boolean | undefined;
  body.traverse(node => {
    const material = (node as { material?: { name?: string } | { name?: string }[] }).material;
    const names = Array.isArray(material) ? material.map(m => m.name) : material ? [material.name] : [];
    if (names.includes(HAND_MESH)) shown = (shown ?? false) || node.visible;
  });
  return shown;
}
/** The share of the drop done `t` seconds in (eased out), and of the run (linear in ground distance). */
export const dropShare = (t: number) => { const k = Math.min(1, Math.max(0, t / MONKEY_DROP_SECONDS)); return 1 - (1 - k) * (1 - k); };

export function createPowderMonkeys(scene: Object3D, load: ((id: string) => Promise<MonkeyLease>) | null, model = 'tft13_blue_monkey') {
  const monkeys = new Map<string, Monkey>();
  const fetch = () => load ? load(model).then(lease => lease.placeholder ? (lease.release(), null) : lease).catch(() => null) : Promise.resolve(null);
  const at = new Vector3(), ahead = new Vector3(), up = new Vector3(0, 1, 0), toward = new Quaternion();
  const remove = (key: string, m: Monkey) => {
    m.disposed = true; m.mixer?.stopAllAction(); if (m.lease) { m.mixer?.uncacheRoot(m.lease.scene); m.lease.release(); }
    m.root.removeFromParent(); monkeys.delete(key);
  };
  /** How long a swapped-in monkey may wait for the rules to send it before it goes (a cast whose monkey never left). */
  const UNSENT_SECONDS = 0.3;
  const create = (owner: string, hideAt: number): Monkey => {
    const old = monkeys.get(owner); if (old) remove(owner, old);
    const root = new Group(); root.name = 'powder-monkey'; root.visible = false; root.userData.visualProxy = true;
    const m: Monkey = { owner, root, since: 0, hideAt, ran: 0, sent: false, started: false, disposed: false };
    monkeys.set(owner, m); scene.add(root);
    void fetch().then(lease => {
      if (!lease) return;
      if (m.disposed) { lease.release(); return; }
      m.lease = lease; root.add(lease.scene); m.mixer = new AnimationMixer(lease.scene);
      const clip = lease.animations.find(c => c.name === lease.animationNames.move) ?? lease.animations[0];
      if (clip) m.mixer.clipAction(clip).play();
    });
    return m;
  };
  return {
    /** Live monkeys, by owner. */
    get size() { return monkeys.size; },
    /**
     * `owner` cast: a monkey is made ready now (its model loads), to swap in on the frame her clip hides the hand one,
     * `hideIn` seconds from now. The rules' send may come a frame after that: the swapped-in monkey waits for it.
     */
    prepare(owner: string, hideIn: number) { create(owner, Math.max(0, hideIn)); },
    /**
     * The rules sent `owner`'s monkey to `to` (its cell, on the floor), there `arriveIn` seconds from now. A monkey made
     * ready on her cast takes it (swapped in already or not); without one (her cast not seen) one swaps in `swapIn` from now.
     */
    send(owner: string, to: Vector3, swapIn: number, arriveIn: number) {
      const m = monkeys.get(owner) ?? create(owner, Math.max(0, swapIn));
      m.to = to.clone(); m.sent = true;
      m.runFor = Math.max(0.05, m.started ? m.ran + arriveIn : arriveIn - Math.max(0, m.hideAt - m.since));
    },
    /** The rules' monkey arrived (or its owner's cast was undone): it goes; its cell's point, when it was out. */
    arrive(owner: string): Vector3 | null {
      const m = monkeys.get(owner); if (!m) return null;
      const point = m.to?.clone() ?? null; remove(owner, m); return point;
    },
    /** `owner` died: a monkey not yet sent goes with her (the rules send none); a sent one runs on. */
    drop(owner: string) { const m = monkeys.get(owner); if (m && !m.sent) remove(owner, m); },
    /**
     * Each frame, after the mixers ran. `body(owner)` is the owner's posed body while it is still on the board (the swap
     * reads the hand there); without it, or without the hand bones, the monkey starts on the floor where it would have.
     */
    update(seconds: number, body: (owner: string) => Object3D | null) {
      for (const [key, m] of monkeys) {
        m.since += seconds;
        if (!m.started) {
          // While the hand one still shows, keep its last pose; the swap is the frame her clip hides it in (its submesh, read
          // after the mixers ran this frame) near the clip's hide time, or, on a body without that submesh, that time.
          const b = body(m.owner), shown = b ? handMonkeyShown(b) : undefined;
          if (shown) { const pose = handMonkeyPose(b!); if (pose) m.hand = pose; }
          const due = m.since >= m.hideAt - 0.06;
          const swap = shown === false ? !!m.hand && due : shown === undefined && m.since >= m.hideAt;
          if (!swap) { if (!m.sent && m.since > m.hideAt + 1) remove(key, m); continue; }
          const lease = m.lease; if (!lease) continue; // swaps on the frame its model is in
          const hand = m.hand ?? (b ? handMonkeyPose(b) : null);
          // Its own root bone in model space (the group at rest), to match the hand's root bone point, turn and scale.
          const own = lease.scene, rootBone = own.getObjectByName(ROOT);
          m.root.position.set(0, 0, 0); m.root.quaternion.identity(); m.root.scale.setScalar(1); m.root.updateMatrixWorld(true);
          const ownRoot = rootBone?.getWorldPosition(new Vector3()), ownTurn = rootBone?.getWorldQuaternion(new Quaternion());
          const ownScale = rootBone ? (v => (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)) / 3)(rootBone.getWorldScale(new Vector3())) : 0;
          m.size = hand && ownScale > 0 ? hand.size / ownScale : 1;
          m.from = hand ? hand.root.clone() : m.to?.clone() ?? new Vector3();
          m.facing = hand && ownTurn ? hand.turn.clone().multiply(ownTurn.invert()) : undefined;
          m.offset = hand && ownRoot ? ownRoot : new Vector3();
          m.root.scale.setScalar(m.size);
          m.started = true; m.root.visible = true; m.ran = 0;
        } else m.ran += seconds;
        if (!m.sent && m.ran > UNSENT_SECONDS) { remove(key, m); continue; }
        m.mixer?.update(seconds);
        const from = m.from!, to = m.to ?? from, floor = m.to?.y ?? 0;
        const t = m.runFor ? Math.min(1, m.ran / m.runFor) : 0, drop = dropShare(m.ran);
        // Along the floor from under the hand to the cell; down from the hand's height over the drop.
        at.set(from.x + (to.x - from.x) * t, from.y + (floor - from.y) * drop, from.z + (to.z - from.z) * t);
        // Facing: the hand's turn at the swap, then toward the cell over the drop.
        ahead.set(to.x - from.x, 0, to.z - from.z);
        if (ahead.lengthSq() > 1e-6) toward.setFromAxisAngle(up, Math.atan2(ahead.x, ahead.z)); else toward.identity();
        if (m.facing) m.root.quaternion.copy(m.facing).slerp(toward, drop); else m.root.quaternion.copy(toward);
        // The group's origin (the monkey's feet) sits so its root bone is on `at` at the swap; the offset goes as it lands.
        ahead.copy(m.offset!).multiplyScalar(m.size! * (1 - drop)).applyQuaternion(m.root.quaternion);
        m.root.position.copy(at).sub(ahead);
        if (m.runFor !== undefined && m.ran >= m.runFor + 1) remove(key, m); // the arrival never came (a replay cut)
      }
    },
    /** A combat reset or the board cleared. */
    clear() { for (const [key, m] of monkeys) remove(key, m); },
  };
}
