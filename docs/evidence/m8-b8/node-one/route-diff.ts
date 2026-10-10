// Route differential: baseline (c0109ac worktree) vs candidate stepMatch on identical inputs while the
// public M5 route driver advances with the baseline. Fail-closed (audit P2-6): any exception fails the
// process; each route must reach gameOver with the full battle count, and records its final state,
// battles and compared steps. Usage:
//   node route-diff.cjs [--routes=cannon:42,...] [--inject=throw|early]
// --inject=throw throws an ordinary Error at step 100; --inject=early stops the route at step 100 as the
// old script's catch did. Both negative controls must exit non-zero.
import * as base from '/tmp/claude-0/base/src/simulation/match';
import * as cand from '/home/user/cat/src/simulation/match';
import { CONTENT_DIGEST as bd, canonicalContent as bc } from '/tmp/claude-0/base/src/simulation/content';
import { CONTENT_DIGEST as cd, canonicalContent as cc } from '/home/user/cat/src/simulation/content';
import { ROUND_CATALOG } from '/home/user/cat/src/simulation/content/round-catalog';
import { run } from '/tmp/claude-0/base/scripts/generate-m5-route.cjs';

const BATTLES = ROUND_CATALOG.filter(round => round.kind !== 'supply').length;
const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const inject = arg('inject');
const routes = (arg('routes') ?? 'cannon:42,mage:42,sniper:42,sniper-caitlyn:42').split(',').map(entry => {
  const [build, seed] = entry.split(':'); return { build, seed: Number(seed) };
});
class EarlyStop extends Error {}

export function checkRouteComplete(summary: { phase: string; round: string; battles: number; steps: number }): void {
  if (summary.phase !== 'gameOver') throw new Error(`route incomplete: phase ${summary.phase} at ${summary.round}`);
  if (summary.battles !== BATTLES) throw new Error(`route incomplete: ${summary.battles}/${BATTLES} battles`);
  if (summary.steps <= 0) throw new Error('route compared no steps');
}

(async () => {
  if (bd !== cd) throw new Error(`digest ${bd} != ${cd}`);
  const results = [];
  for (const { build, seed } of routes) {
    let steps = 0, last: any;
    const driver = { ...base, stepMatch(state: any) {
      if (inject && steps === 100) { if (inject === 'throw') throw new Error('injected ordinary error'); throw new EarlyStop('early stop'); }
      const a = base.stepMatch(state), b = cand.stepMatch(state);
      if (JSON.stringify(a) !== JSON.stringify(b) || bc(a.state) !== cc(b.state)) throw new Error(`step mismatch ${build}:${seed} ${state.roundDefinitionId}:${state.combat?.tick}`);
      steps++; last = a.state; return a;
    } };
    let final: any;
    try { final = (await run(driver, { build, seed })).final; }
    catch (error) {
      // The old script swallowed anything without "mismatch|digest". Only the early-stop control is
      // allowed to continue, and only so that the completeness check below must then reject it.
      if (!(error instanceof EarlyStop)) throw error;
      final = last;
    }
    const summary = { build, seed, phase: final.phase, round: final.roundDefinitionId, outcome: final.outcome ?? null,
      battles: final.roundResults.filter((result: any) => result.result !== 'supply').length, steps };
    checkRouteComplete(summary);
    results.push(summary); console.log(JSON.stringify(summary));
  }
  console.log(JSON.stringify({ digest: cd, routes: results.length, steps: results.reduce((n, r) => n + r.steps, 0), battlesPerRoute: BATTLES }));
})().catch(error => { console.error(`FAILED: ${error?.message ?? error}`); process.exit(1); });
