import { Matrix4, PropertyBinding, Quaternion, Vector3, type AnimationClip, type KeyframeTrack, type Object3D } from 'three';

/** Seconds for the followed offset to close most of a small gap (an idle sway, a clip blend): no jitter. */
export const OVERHEAD_FOLLOW_SECONDS = 0.05;
/**
 * A gap wider than this (board units, about a tenth of a cell) is closed at once: a jump, a dash or a landing never
 * leaves the bar behind (eased at 0.05 s it trailed a falling Jayce by a third of a cell).
 */
export const OVERHEAD_SNAP_DISTANCE = 6;
/** The skeleton bone that carries a League model's travel (root motion, jumps). Matched without case (Malzahar: ROOT). */
export const TRAVEL_BONE = 'Root';
/** The bone the body hangs from, matched in this order (Pelvis, pelvis, Pilot_Pelvis; a monster's L_Front_Hip). */
export const BODY_BONES: readonly RegExp[] = [/^pelvis$/i, /pelvis/i, /hip/i];
/**
 * How far the body bone may leave the travel bone, as a share of the drawn height, before the bars follow it: an
 * attack's lean or a hover's bob stays inside, a body that walks away from its Root goes past it (2026-11-12 GLB
 * check of asset-root-live, 1★ board units: every other clip ≤ 8.4 sideways against heights of ~90–105; Malzahar's
 * idle bobs 20.9 up). Only the part beyond is followed. Fitted values, not original data.
 */
export const BODY_SLACK = { across: 0.1, up: 0.3 } as const;

const trackOf = (clip: AnimationClip | undefined, node: Object3D, property: string): KeyframeTrack | undefined =>
  clip?.tracks.find(t => t.name === `${PropertyBinding.sanitizeNodeName(node.name)}.${property}` || t.name === `${node.name}.${property}`);
const first = (track: KeyframeTrack | undefined, size: number): number[] | null =>
  track && track.getValueSize() === size && track.values.length >= size ? Array.from(track.values.slice(0, size)) : null;
/** The node's local transform at the idle's first frame (its loaded transform where the idle has no track). */
const idleLocal = (clip: AnimationClip | undefined, node: Object3D): Matrix4 => {
  const p = first(trackOf(clip, node, 'position'), 3), q = first(trackOf(clip, node, 'quaternion'), 4), s = first(trackOf(clip, node, 'scale'), 3);
  return new Matrix4().compose(p ? new Vector3(...p) : node.position, q ? new Quaternion(...q) : node.quaternion, s ? new Vector3(...s) : node.scale);
};

const findBone = (body: Object3D, test: (name: string) => boolean): Object3D | null => {
  let found: Object3D | null = null;
  body.traverse(node => { if (!found && node !== body && test(node.name)) found = node; });
  return found;
};

/**
 * Where a body has travelled from where it stands, so its bars, star row and stun ring can follow it (user 11-11: the
 * bar stayed put while the model moved). Three sources: the clip's own root travel (the Root bone against its idle
 * stance: Jayce's jump, Vi's leap, a dash in an attack), the body bone's travel past the Root (Illaoi's slam, Rumble's
 * cast, Nami's water lift, Corki's and Malzahar's root that never moves: 2026-11-12 GLB check), and the procedural
 * lunge the renderer puts on the body. Height counts only upward (a crouch does not pull the bars down). Small changes
 * are eased (an idle sway never jitters); a large one is taken at once (the bar never lags a jump or a dash).
 */
export class OverheadFollow {
  readonly offset = new Vector3();
  private readonly raw = new Vector3();
  private readonly at = new Vector3();
  private readonly rest = new Vector3();
  private readonly extra = new Vector3();
  constructor(private readonly bone: Object3D | null = null, private readonly restLocal = new Vector3(),
    /** The body bone and its idle place in the travel bone's frame (or `frame`'s when there is no travel bone). */
    private readonly body: { readonly bone: Object3D; readonly frame: Object3D; readonly rest: Vector3 } | null = null) {}

  /** A body with no travel or body bone (a pawn, a model without a League skeleton) follows its lunge only. */
  static of(body: Object3D, animations: readonly AnimationClip[], idle: string | undefined): OverheadFollow {
    const clip = animations.find(c => c.name === idle);
    const exact = body.getObjectByName(TRAVEL_BONE);
    const bone = exact?.parent ? exact : findBone(body, name => name.toLowerCase() === TRAVEL_BONE.toLowerCase());
    let hip: Object3D | null = null;
    for (const pattern of BODY_BONES) if ((hip = findBone(body, name => pattern.test(name)))) break;
    const frame = bone?.parent ? bone : body;
    let tracked: { bone: Object3D; frame: Object3D; rest: Vector3 } | null = null;
    if (hip && hip !== frame) {
      // The body bone's idle place in the frame: its chain up to the frame at the idle's first frame.
      const chain = new Matrix4();
      let node: Object3D | null = hip;
      while (node && node !== frame) { chain.premultiply(idleLocal(clip, node)); node = node.parent; }
      if (node === frame) tracked = { bone: hip, frame, rest: new Vector3().setFromMatrixPosition(chain) };
    }
    if (!bone?.parent) return new OverheadFollow(null, new Vector3(), tracked);
    const rest = first(trackOf(clip, bone, 'position'), 3);
    return new OverheadFollow(bone, rest ? new Vector3(...rest) : bone.position.clone(), tracked);
  }

  /**
   * `lunge`: the world (x, z) the renderer's lunge has moved the body by. `height`: the drawn body height in world
   * units (sets the body bone's slack; without it the body bone is not followed). Returns the eased world offset.
   */
  update(seconds: number, lunge: { readonly x: number; readonly z: number } | null, height = 0): Vector3 {
    if (this.bone?.parent) {
      this.bone.getWorldPosition(this.at);
      this.bone.parent.localToWorld(this.rest.copy(this.restLocal));
      this.raw.subVectors(this.at, this.rest);
    } else this.raw.set(0, 0, 0);
    if (this.body && height > 0) {
      // The body bone's world move past the frame, beyond the slack (sideways and upward apart).
      const { bone, frame, rest } = this.body;
      bone.getWorldPosition(this.extra);
      frame.localToWorld(this.at.copy(rest));
      this.extra.sub(this.at);
      const across = Math.hypot(this.extra.x, this.extra.z), slack = BODY_SLACK.across * height;
      const keep = across > slack ? (across - slack) / across : 0;
      this.raw.x += this.extra.x * keep; this.raw.z += this.extra.z * keep;
      this.raw.y += Math.max(0, this.extra.y - BODY_SLACK.up * height);
    }
    this.raw.y = Math.max(0, this.raw.y);
    if (lunge) { this.raw.x += lunge.x; this.raw.z += lunge.z; }
    if (this.offset.distanceTo(this.raw) > OVERHEAD_SNAP_DISTANCE) this.offset.copy(this.raw);
    else this.offset.lerp(this.raw, seconds > 0 ? 1 - Math.exp(-seconds / OVERHEAD_FOLLOW_SECONDS) : 0);
    return this.offset;
  }

}
