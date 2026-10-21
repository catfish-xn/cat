/**
 * Which way a 3D piece looks (its root's rotation.y), kept apart from placeholder-renderer.ts so the rule is testable
 * on plain numbers. Models face +z at rotation 0; board x→x, y→z.
 *
 * A piece that moves looks where it goes; standing in combat it looks at the unit it last attacked or cast on while
 * that unit is alive and drawn; with no such target (or dead itself) it keeps the way it already looks. Outside combat it
 * rests looking across the board at the other side. Every change is a TURN_SECONDS turn the short way round, never a jump.
 */

/** Board units a piece must still have to go this frame to count as moving (the renderer's glide step). */
export const MOVE_EPSILON = 0.5;
/** Seconds a turn takes, whatever its angle: it lands exactly on the heading at the end. */
export const TURN_SECONDS = 0.24;
/** A heading this close to the one being turned to keeps the turn's schedule (a target walking a little); a larger change starts a new turn. */
const RETARGET = 0.05;

export interface PlanarPoint { readonly x: number; readonly z: number }

/** Rest heading: the player's side looks up the board (-z), the enemy's down it (+z). */
export const restHeading = (team: 'player' | 'enemy'): number => team === 'player' ? Math.PI : 0;

/** The heading that looks from `from` to `to`, or null when the two points are (nearly) the same. */
export function headingToward(from: PlanarPoint, to: PlanarPoint): number | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  return dx * dx + dz * dz > MOVE_EPSILON * MOVE_EPSILON ? Math.atan2(dx, dz) : null;
}

/** `angle` wrapped into (-π, π]. */
const wrap = (angle: number): number => {
  const turns = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
  return turns === -Math.PI ? Math.PI : turns;
};

/**
 * A piece's heading turning toward a desired one the short way round, over TURN_SECONDS with an ease-out, ending
 * exactly on it. A small change of the desired heading mid-turn moves the end point without restarting the clock.
 */
export class HeadingTurn {
  private from: number; private gap = 0; private elapsed = 0;
  constructor(public heading: number) { this.from = heading; }
  /** One frame: turn toward `desired` (null: finish the turn in progress) by `seconds` and return the heading. */
  update(desired: number | null, seconds: number): number {
    if (desired !== null) {
      if (Math.abs(wrap(desired - (this.from + this.gap))) > RETARGET) { this.from = this.heading; this.elapsed = 0; }
      this.gap = wrap(desired - this.from);
    }
    if (seconds > 0) this.elapsed += seconds;
    const t = Math.min(1, this.elapsed / TURN_SECONDS);
    this.heading = wrap(this.from + this.gap * (1 - (1 - t) * (1 - t)));
    return this.heading;
  }
  /** Jump to `heading` with no turn (a new piece, a team change). */
  set(heading: number): void { this.heading = this.from = heading; this.gap = 0; this.elapsed = 0; }
}

export interface FacingInput {
  readonly team: 'player' | 'enemy';
  readonly alive: boolean;
  /** The combat being shown (BoardFrame.fighting). */
  readonly fighting: boolean;
  /** Where the piece stands now and where it is gliding to. */
  readonly position: PlanarPoint;
  readonly destination: PlanarPoint;
  /** The live, drawn unit it last attacked or cast on, if any. */
  readonly target: PlanarPoint | null;
}

/** The heading a piece should turn toward this frame; null keeps the one it has (or is already turning to). */
export function desiredHeading(input: FacingInput): number | null {
  if (!input.alive) return null;
  const moving = headingToward(input.position, input.destination);
  if (moving !== null) return moving;
  if (!input.fighting) return restHeading(input.team);
  return input.target && headingToward(input.position, input.target);
}
