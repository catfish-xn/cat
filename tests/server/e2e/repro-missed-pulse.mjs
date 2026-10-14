/**
 * SR-C19-01 reproducer (rules side, not an acceptance test): an all-bot room ends in `resolver-error` "Missed periodic
 * pulse; never backfill" (src/simulation/m8/periodic.ts advancePeriodicTask) in a stage-6 PvP battle. In process, on the
 * manual clock, no browser or network; ~1 min per seed.
 *
 *   node tests/server/e2e/repro-missed-pulse.mjs [seed ...]      (default: 9 4 11, the seeds C19 found)
 *
 * For each seed: plays eight bots (BotDriver, real TwoSidedBattleResolver) until the room ends; on a resolver error it
 * recompiles the failing pairing with the public rules entry (snapshotForBattle → compileBattle), shows that
 * `resolveTwoSidedBattle(input, 5000)` alone throws, then steps the combat tick by tick and prints the periodic task(s)
 * whose `nextPulseAtTick` is already behind the tick that throws. The compiled rules input is written to
 * artifacts/repro-missed-pulse/seed-<n>.json, enough for `resolveTwoSidedBattle` without any server code.
 * A normal finish asserts a complete, unique eight-seat ranking; a resolver error makes the command fail.
 */
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { ROOT, outDir } from './harness.mjs';

const OUT = outDir('repro-missed-pulse');
const seeds = process.argv.slice(2).map(Number);

const outfile = `${OUT}/entry.mjs`;
await build({
  stdin: { contents: [
    "export { ManualClock } from './src/server/room/clock.ts';",
    "export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room.ts';",
    "export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver.ts';",
    "export { BotDriver } from './src/server/room/bot-driver.ts';",
    "export { compileBattle, snapshotForBattle, resolveTwoSidedBattle, startTwoSidedCombatWithEvents, stepCombat } from './src/server-entry/index.ts';",
  ].join('\n'), resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
});
const rules = await import(`${outfile}?${Date.now()}`);

for (const seed of seeds.length ? seeds : [9, 4, 11]) {
  const clock = new rules.ManualClock();
  const seats = Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `bot ${index}`, kind: 'bot' }));
  const inner = new rules.TwoSidedBattleResolver();
  let failing = null;
  // Keeps the envelope of the battle that throws; the room's own handling (resolver-error fault) is unchanged.
  const resolver = { resolveBattle: (input, pool) => inner.resolveBattle(input, pool), startBattle: (input, pool) => {
    const job = inner.startBattle(input, pool);
    return { advance(maxTicks) { try { return job.advance(maxTicks); } catch (error) { failing ??= input; throw error; } } };
  } };
  const room = new rules.Room(seats, { ...rules.ROOM_TIMING_DEFAULTS, preparationMs: 8_000, choiceMs: 6_000, settlementMs: 8_000, roomId: 'repro', seed, clock, resolver, sliceTicks: 100, assertPoolConservation: false });
  const bots = new rules.BotDriver(room, seed, { stepMs: 100, takeoverMs: 600_000 });
  room.start();
  for (let fired = 0; fired < 200_000 && room.state.phase !== 'ended'; fired++) if (!clock.runNext()) break;
  bots.dispose();
  const state = room.state;
  console.log(`seed ${seed}: ended in ${state.roundId}, fault ${JSON.stringify(state.fault)}`);
  if (!failing) {
    assert.equal(state.phase, 'ended');
    assert.equal(state.fault, null);
    assert.equal(state.ranking?.length, 8);
    assert.equal(new Set(state.ranking.map(entry => entry.seatId)).size, 8);
    assert.deepEqual(state.ranking.map(entry => entry.rank).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
    console.log(`  unique final ranking: ${JSON.stringify(state.ranking)}`);
    continue;
  }
  process.exitCode = 1;
  const [first, second] = failing.seats, other = failing.mirrorOf ?? second;
  const input = rules.compileBattle(rules.snapshotForBattle(first.state, first.seatId), rules.snapshotForBattle(other.state, other.seatId), failing.battleSeed,
    failing.mirrorOf ? { battleId: failing.battleId, mirrorOfSeatId: failing.mirrorOf.seatId } : { battleId: failing.battleId });
  writeFileSync(`${OUT}/seed-${seed}.json`, JSON.stringify(input));
  try { rules.resolveTwoSidedBattle(structuredClone(input), 5_000); console.log('  resolveTwoSidedBattle alone: no error'); }
  catch (error) { console.log(`  resolveTwoSidedBattle(artifacts/repro-missed-pulse/seed-${seed}.json, 5000) → ${error}`); }
  let combat = rules.startTwoSidedCombatWithEvents(input).state;
  while (combat.status === 'running') {
    const before = combat;
    try { combat = rules.stepCombat(combat).state; continue; }
    catch (error) {
      const tick = before.tick + 1;
      console.log(`  step to tick ${tick} throws ${error}`);
      for (const unit of before.units) for (const task of unit.mechanismState?.periodicTasks ?? []) if (task.nextPulseAtTick < tick) {
        console.log(`  late task on ${unit.definitionId} (alive ${unit.alive}): ${task.source.sourceKind} ${task.source.definitionId} of ${task.source.ownerId}, nextPulseAtTick ${task.nextPulseAtTick}, period ${task.periodTicks}, ends ${task.endsAtTick}, pulse ${task.pulseOrdinal}, finalPulse ${task.finalPulse}`);
      }
      break;
    }
  }
}
