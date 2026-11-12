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
 * attack's lean or a hover's bob stays inside, a body that walks away from its Root goes past it. Only the part beyond
 * is followed. Fitted values (2026-11-12), not original data.
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

/** A side marker in a bone name (L_Front_Hip, Hip_R, Left_Hip, LeftHip) and its mirror spelling. */
const SIDE = /(^|[_\s.-])(l|r|left|right)(?=$|[_\s.-])|^(left|right)(?=[A-Z0-9_])/i;
const MIRROR: Readonly<Record<string, string>> = { l: 'r', r: 'l', left: 'right', right: 'left' };
const swapCase = (from: string, to: string): string =>
  from === from.toUpperCase() ? to.toUpperCase() : from[0] === from[0]!.toUpperCase() ? to[0]!.toUpperCase() + to.slice(1) : to;
/** The other side's name for a side-marked bone name, or null when it carries no side. */
export function mirrorName(name: string): string | null {
  const match = SIDE.exec(name);
  if (!match) return null;
  const side = match[2] ?? match[3]!, at = match.index + (match[1]?.length ?? 0);
  return name.slice(0, at) + swapCase(side, MIRROR[side.toLowerCase()]!) + name.slice(at + side.length);
}
const isAncestor = (node: Object3D, of: Object3D): boolean => { for (let n = of.parent; n; n = n.parent) if (n === node) return true; return false; };

/**
 * The bones the bars follow and the rule that picked each: the travel bone (`Root` exactly, else the same name in
 * another case) and the body bones (the first BODY_BONES pattern with a match). A pick on one side of the body (a
 * leg's hip) is never the body alone: with its mirror both are taken (`pair`, their midpoint is followed); without
 * one, their shared parent bone (`parent`); when that parent is the travel bone or the model root, none (only the
 * travel bone is followed). Exported for the per-model audit.
 */
export function pickFollowBones(body: Object3D): { travel: Object3D | null; travelRule: 'exact' | 'case' | null;
  body: readonly Object3D[]; bodyRule: number | null; side: 'pair' | 'parent' | 'dropped' | null } {
  const exact = body.getObjectByName(TRAVEL_BONE);
  const travel = exact?.parent ? exact : findBone(body, name => name.toLowerCase() === TRAVEL_BONE.toLowerCase());
  const travelRule = travel ? (travel === exact ? 'exact' : 'case') : null;
  const frame = travel ?? body;
  for (let rule = 0; rule < BODY_BONES.length; rule++) {
    const hip = findBone(body, name => BODY_BONES[rule]!.test(name));
    if (!hip) continue;
    const mirrored = mirrorName(hip.name);
    if (mirrored === null) return { travel, travelRule, body: [hip], bodyRule: rule, side: null };
    const other = findBone(body, name => name === mirrored);
    // Both sides under the frame: their midpoint. Otherwise the bone both hang from (the one side's own parent).
    if (other && other !== hip && isAncestor(frame, hip) && isAncestor(frame, other)) return { travel, travelRule, body: [hip, other], bodyRule: rule, side: 'pair' };
    let parent: Object3D | null = hip.parent;
    if (other) while (parent && !isAncestor(parent, other)) parent = parent.parent;
    if (parent && parent !== frame && parent !== body && isAncestor(frame, parent)) return { travel, travelRule, body: [parent], bodyRule: rule, side: 'parent' };
    return { travel, travelRule, body: [], bodyRule: rule, side: 'dropped' };
  }
  return { travel, travelRule, body: [], bodyRule: null, side: null };
}

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
  private readonly part = new Vector3();
  constructor(private readonly bone: Object3D | null = null, private readonly restLocal = new Vector3(),
    /** The body bones (their midpoint is followed) and their idle places in the travel bone's frame (or the model's). */
    private readonly body: { readonly frame: Object3D; readonly parts: readonly { readonly bone: Object3D; readonly rest: Vector3 }[] } | null = null) {}

  /** A body with no travel or body bone (a pawn, a model without a League skeleton) follows its lunge only. */
  static of(body: Object3D, animations: readonly AnimationClip[], idle: string | undefined): OverheadFollow {
    const clip = animations.find(c => c.name === idle);
    const { travel: bone, body: hips } = pickFollowBones(body);
    const frame = bone?.parent ? bone : body;
    // Each body bone's idle place in the frame: its chain up to the frame at the idle's first frame.
    const parts: { bone: Object3D; rest: Vector3 }[] = [];
    for (const hip of hips) {
      if (hip === frame) continue;
      const chain = new Matrix4();
      let node: Object3D | null = hip;
      while (node && node !== frame) { chain.premultiply(idleLocal(clip, node)); node = node.parent; }
      if (node === frame) parts.push({ bone: hip, rest: new Vector3().setFromMatrixPosition(chain) });
    }
    const tracked = parts.length === hips.length && parts.length > 0 ? { frame, parts } : null;
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
      const { frame, parts } = this.body;
      this.extra.set(0, 0, 0);
      for (const { bone, rest } of parts) {
        bone.getWorldPosition(this.part);
        this.extra.add(this.part.sub(frame.localToWorld(this.at.copy(rest))));
      }
      this.extra.divideScalar(parts.length);
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
