import type { MatchState } from '../../src/simulation/match';

/** Pause the genuine public route at battle/tick boundaries; never reconstruct or edit its state. */
export function roundRouteCache(build: (onRound: (state: MatchState) => Promise<void>) => Promise<MatchState>) {
  let target = 0, reached = 0, release: (() => void) | undefined;
  let notify: (() => void) | undefined, result: MatchState | undefined, failure: unknown;
  let started = false, done = false;
  const changed = () => { notify?.(); notify = undefined; };
  async function through(round: number): Promise<MatchState | undefined> {
    target = Math.max(target, round);
    if (!started) {
      started = true;
      void build(async state => {
        reached = state.phase === 'combat' ? state.round - 1 + state.combat!.tick / 1201 : state.round;
        if (reached >= target) {
          // Install the continuation before waking the waiting case.
          await new Promise<void>(resolve => { release = resolve; changed(); });
        }
      }).then(state => { result = state; done = true; changed(); }, error => { failure = error; done = true; changed(); });
    } else if (release && reached < target) {
      const resume = release; release = undefined; resume();
    }
    while (!done && reached < target) await new Promise<void>(resolve => { notify = resolve; });
    if (failure) throw failure;
    return result;
  }
  return { through, finish: async () => (await through(Infinity))! };
}
