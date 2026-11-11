import { Vector3, type AnimationClip, type Object3D } from 'three';

/** Seconds for the followed offset to close most of a small gap (an idle sway, a clip blend): no jitter. */
export const OVERHEAD_FOLLOW_SECONDS = 0.05;
/**
 * A gap wider than this (board units, about a tenth of a cell) is closed at once: a jump, a dash or a landing never
 * leaves the bar behind (eased at 0.05 s it trailed a falling Jayce by a third of a cell).
 */
export const OVERHEAD_SNAP_DISTANCE = 6;
/** The skeleton bone that carries a League model's travel (root motion, jumps). */
export const TRAVEL_BONE = 'Root';

/**
 * Where a body has travelled from where it stands, so its bars, star row and stun ring can follow it (user 11-11: the
 * bar stayed put while the model moved). Two sources: the clip's own root travel (the Root bone against its idle stance:
 * Jayce's jump, Vi's leap, a dash in an attack) and the procedural lunge the renderer puts on the body. Height counts
 * only upward (a crouch does not pull the bars down). Small changes are eased (an idle sway never jitters); a large one is
 * taken at once (the bar never lags a jump or a dash).
 */
export class OverheadFollow {
  readonly offset = new Vector3();
  private readonly raw = new Vector3();
  private readonly at = new Vector3();
  private readonly rest = new Vector3();
  constructor(private readonly bone: Object3D | null = null, private readonly restLocal = new Vector3()) {}

  /** A body with no travel bone (a pawn, a model without a League skeleton) follows its lunge only. */
  static of(body: Object3D, animations: readonly AnimationClip[], idle: string | undefined): OverheadFollow {
    const bone = body.getObjectByName(TRAVEL_BONE);
    if (!bone?.parent) return new OverheadFollow();
    const track = animations.find(clip => clip.name === idle)?.tracks.find(t => t.name === `${TRAVEL_BONE}.position` && t.getValueSize() === 3);
    const rest = track && track.values.length >= 3 ? new Vector3(track.values[0], track.values[1], track.values[2]) : bone.position.clone();
    return new OverheadFollow(bone, rest);
  }

  /** `lunge`: the world (x, z) the renderer's lunge has moved the body by. Returns the eased world offset. */
  update(seconds: number, lunge: { readonly x: number; readonly z: number } | null): Vector3 {
    if (this.bone?.parent) {
      this.bone.getWorldPosition(this.at);
      this.bone.parent.localToWorld(this.rest.copy(this.restLocal));
      this.raw.subVectors(this.at, this.rest);
      this.raw.y = Math.max(0, this.raw.y);
    } else this.raw.set(0, 0, 0);
    if (lunge) { this.raw.x += lunge.x; this.raw.z += lunge.z; }
    if (this.offset.distanceTo(this.raw) > OVERHEAD_SNAP_DISTANCE) this.offset.copy(this.raw);
    else this.offset.lerp(this.raw, seconds > 0 ? 1 - Math.exp(-seconds / OVERHEAD_FOLLOW_SECONDS) : 0);
    return this.offset;
  }

}
