import { Vector3, type AnimationClip, type Object3D } from 'three';

/** Seconds for the followed offset to close most of a gap: smooth, but quick enough to stay on a jumping body. */
export const OVERHEAD_FOLLOW_SECONDS = 0.05;
/** The skeleton bone that carries a League model's travel (root motion, jumps). */
export const TRAVEL_BONE = 'Root';

/**
 * Where a body has travelled from where it stands, so its bars, star row and stun ring can follow it (user 11-11: the
 * bar stayed put while the model moved). Two sources: the clip's own root travel (the Root bone against its idle stance:
 * Jayce's jump, Vi's leap, a dash in an attack) and the procedural lunge the renderer puts on the body. Height counts
 * only upward (a crouch does not pull the bars down). The result is eased so an idle sway or a clip change never jitters.
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
    const k = seconds > 0 ? 1 - Math.exp(-seconds / OVERHEAD_FOLLOW_SECONDS) : 0;
    this.offset.lerp(this.raw, k);
    return this.offset;
  }

}
