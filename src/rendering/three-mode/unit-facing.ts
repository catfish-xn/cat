/**
 * Which way a 3D piece looks (its root's rotation.y), kept apart from placeholder-renderer.ts so the rule is testable
 * on plain numbers. Models face +z at rotation 0; board x→x, y→z.
 *
 * A piece that moves looks where it goes; standing in combat it looks at the unit it last attacked or cast on while
 * that unit is alive and drawn; with no such target (or dead itself) it keeps the way it already looks. Outside combat it
 * rests looking across the board at the other side. Every change is a turn the short way round, never a jump.
 */

/** Board units a piece must still have to go this frame to count as moving (the renderer's glide step). */
export const MOVE_EPSILON = 0.5;
/** Turn time constant in seconds: a turn closes 1 - e^(-t / TURN_SECONDS) of its angle, about 95% in 0.24 s. */
export const TURN_SECONDS = 0.08;

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

/** One frame of turning from `current` toward `desired` the short way round; snaps once within a hundredth of a radian. */
export function turnToward(current: number, desired: number, seconds: number): number {
  const gap = wrap(desired - current);
  if (Math.abs(gap) < 0.01 || !(seconds > 0)) return Math.abs(gap) < 0.01 ? wrap(desired) : wrap(current);
  return wrap(current + gap * (1 - Math.exp(-seconds / TURN_SECONDS)));
}

export interface FacingInput {
  /** Current heading. */
  readonly current: number;
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

/** The heading a piece should turn toward this frame. */
export function desiredHeading(input: FacingInput): number {
  if (!input.alive) return input.current;
  const moving = headingToward(input.position, input.destination);
  if (moving !== null) return moving;
  if (!input.fighting) return restHeading(input.team);
  return (input.target && headingToward(input.position, input.target)) ?? input.current;
}
