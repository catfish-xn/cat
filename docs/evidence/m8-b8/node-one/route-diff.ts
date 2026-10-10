// Run the three public M5 route builds through the baseline API while comparing every candidate step.
import * as base from '/tmp/claude-0/base/src/simulation/match';
import * as cand from '/home/user/cat/src/simulation/match';
import { CONTENT_DIGEST as bd, canonicalContent as bc } from '/tmp/claude-0/base/src/simulation/content';
import { CONTENT_DIGEST as cd, canonicalContent as cc } from '/home/user/cat/src/simulation/content';
import { run } from '/tmp/claude-0/base/scripts/generate-m5-route.cjs';
if (bd !== cd) throw new Error('digest');
let steps = 0;
const driver = { ...base, stepMatch(state: any) {
  const a = base.stepMatch(state), b = cand.stepMatch(state);
  if (JSON.stringify(a) !== JSON.stringify(b) || bc(a.state) !== cc(b.state)) throw new Error(`step mismatch ${state.roundDefinitionId}:${state.combat?.tick}`);
  steps++; return a;
} };
(async () => { for (const build of ['cannon', 'mage', 'sniper', 'sniper-caitlyn']) for (const seed of [42, 230, 7]) {
  try { await run(driver, { build, seed }); } catch (e: any) { if (/mismatch|digest/.test(String(e?.message))) throw e; console.log('route ended', build, seed, String(e?.message).slice(0, 80)); }
}
console.log(JSON.stringify({ digest: cd, steps })); })().catch(e => { console.error(e); process.exit(1); });
