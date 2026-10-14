import { createMatch, startMatchCombat, stepMatch } from '../src/server-entry/index.ts';

// This CLI owns the execution budget. The imported rule module owns every tick and result.
function main(args) {
  const usage = 'Usage: node dist-server/run-battle.mjs --seed <uint32> --max-steps <positive integer> [--snapshot]';
  let seed, maxSteps, snapshot = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--snapshot' && !snapshot) { snapshot = true; continue; }
    if (!['--seed', '--max-steps'].includes(flag) || !/^\d+$/.test(args[i + 1] ?? '')) throw new Error(usage);
    const value = Number(args[++i]);
    if (flag === '--seed' && seed === undefined) seed = value;
    else if (flag === '--max-steps' && maxSteps === undefined) maxSteps = value;
    else throw new Error(usage);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff
    || !Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new Error(usage);
  const started = startMatchCombat(createMatch(seed));
  if (!started.ok) throw new Error(`start-rejected: ${started.reason}`);
  let state = started.state, steps = 0;
  const events = [...started.events];
  while (state.phase === 'combat' && steps < maxSteps) {
    const next = stepMatch(state);
    state = next.state; events.push(...next.events); steps++;
  }
  if (state.phase === 'combat') throw new Error(`step-limit-exceeded: maxSteps=${maxSteps}`);
  console.log(JSON.stringify({ seed, maxSteps, steps, ticks: state.combat.tick,
    combatEvents: events.filter(event => 'tick' in event).length, result: state.combat.result,
    ...(snapshot ? { state, events } : {}),
  }));
}

try { main(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
