import { createHash } from 'node:crypto';
import { afterAll, it } from 'vitest';
import type { BattleResolver, BattleJob } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { Room } from '../../src/server/room/room';
import type { BattleInput, BattleResult, RoomState, SharedPoolState } from '../../src/server/room/types';
import { RouteClock } from './route-clock';

/** Pure frozen inputs/pool identify a prefix result; immutable results are shared only within one file. */
export class RouteResolver implements BattleResolver {
  private readonly cache = new Map<string, BattleResult>();
  private readonly inner = new TwoSidedBattleResolver();
  private key(input: BattleInput, pool: SharedPoolState) {
    return createHash('sha256').update(JSON.stringify({ input, pool })).digest('hex');
  }
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult {
    const key = this.key(input, pool), cached = this.cache.get(key);
    if (cached) return cached;
    const result = this.inner.resolveBattle(input, pool); this.cache.set(key, result); return result;
  }
  startBattle(input: BattleInput, pool: SharedPoolState): BattleJob {
    const key = this.key(input, pool), cached = this.cache.get(key);
    if (cached) return { advance: () => cached };
    const job = this.inner.startBattle(input, pool);
    return { advance: ticks => {
      const result = job.advance(ticks); if (result) this.cache.set(key, result); return result;
    } };
  }
  clear() { this.cache.clear(); }
}

/** Exactly one original runNext group, resumable between same-time continuations. */
export function* clockGroup(room: Room, clock: RouteClock): Generator<number, boolean, void> {
  const next = clock.nextAt;
  if (next === undefined) return false;
  const end = Math.max(clock.now(), next);
  do { clock.fireNext(); yield room.state.round; } while (clock.nextAt !== undefined && clock.nextAt <= end);
  return true;
}
export function* routeUntil(room: Room, clock: RouteClock, predicate: (state: RoomState) => boolean, maxTimers = 2_000): Generator<number, RoomState, void> {
  for (let fired = 0; fired < maxTimers; fired++) {
    if (predicate(room.state)) return room.state;
    if (!(yield* clockGroup(room, clock))) break;
  }
  if (!predicate(room.state)) throw new Error(`room never reached expected state (${room.state.phase}, ${room.state.round}, ${JSON.stringify(room.state.fault)})`);
  return room.state;
}
export interface RouteEnvironment {
  clock: RouteClock;
  resolver: RouteResolver;
  dispose(fn: () => void | Promise<void>): void;
}
type Steps = Generator<number, void, void> | AsyncGenerator<number, void, void>;
/** Keep every original assertion inside the continued scenario, including when a filtered final case builds its prefix. */
export function registerSlowRoute(name: string, build: (env: RouteEnvironment) => Steps, resolver = new RouteResolver()) {
  const disposers: (() => void | Promise<void>)[] = [];
  let steps: Steps | undefined, cursor: IteratorResult<number, void> | undefined, failure: unknown;
  async function through(round: number, budget = 4) {
    if (failure) throw failure;
    try {
      steps ??= build({ clock: new RouteClock(), resolver, dispose: fn => disposers.push(fn) });
      cursor ??= await steps.next();
      for (let n = 0; !cursor.done && cursor.value <= round && n < budget; n++) cursor = await steps.next();
    } catch (error) { failure = error; throw error; }
  }
  afterAll(async () => {
    await steps?.return();
    for (const dispose of disposers.splice(0)) await dispose();
    steps = undefined; cursor = undefined; resolver.clear();
  });
  for (let round = 1; round <= 60; round++) for (let part = 1; part <= 32; part++) {
    it(`${name}: route toward round ${round}, part ${part}`, async () => { await through(round); });
  }
  it(name, async () => { await through(Infinity, Infinity); });
}
