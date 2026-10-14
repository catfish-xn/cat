# Raw Herald restore inputs: five explicitly approved equipment cases

These files are **raw exported Match JSON**, generated from real public commands
before the production restore module is loaded. They are not saved restored
objects, synthetic matches, a skip-combat path, or a substitute for the command
provenance verifier. This exception is restricted to Ionic Spark, Evenshroud,
both together, Quicksilver, and Edge of Night in `m8-b7-match-wiring.test.ts`.
The empty-equipment case and all other test paths retain their live preparation.

## Reproduce and independently verify

Use the project Node/npm toolchain and installed dependencies, from repository root:

    node scripts/verify-m8-herald-fixtures.cjs

The default command runs the complete seed-42 sniper public acquisition driver,
retains its actual unresolved 4-4 choice, independently clones it for each of the
five original equipment branches, and executes all original public choices,
deployments, XP purchases, combats, combinations and equips. Each branch runs
14 preparation battles and 5,844 ticks before reaching 6-7 preparation. The count
is 3 stage-four battles + 6 stage-five battles + 5 stage-six battles; the Herald
battle starts only after raw export and is not a preparation battle.

The command exports all five raw strings with `canonicalContent`, asserts that
`serialization.ts` has not yet entered the SSR module graph, then imports the
production restore implementation. Independent parsed copies must restore to
exactly the public-command objects, without input mutation. Start and fifteen
successive ticks receive full state/events round-trip checks. Finally, fresh raw
bytes, the command/round trace, and the source-bound manifest must exactly match
all checked-in files. A normal verification needs no `/tmp` files or old saves.

To intentionally regenerate after reviewing a source/content change:

    node scripts/verify-m8-herald-fixtures.cjs --write
    node scripts/verify-m8-herald-fixtures.cjs

`--write` is explicit. It writes the original raw byte strings, never the restored
validation outputs. Source hashes, generation version, seed, content/version
identifiers, per-round tick/result/event hashes and command arguments are recorded
in `manifest.json` and `trajectory.json`. Neither mode changes production sources,
combat load, test workers, timeouts or performance acceptance thresholds.

The optional `--baseline-dir=...` argument is a migration diagnostic only. It
compares newly generated full preparation/start/fifteen-tick states and events
with prior diagnostic captures; those captures are never generation inputs.

## Separate acceptance responsibilities and timing

- The independent command above covers current public-command generation,
  acquisition/provenance, full preparation battles, reproducibility, source binding
  and production restoration. It is a separately timed prerequisite, not work
  hidden in a test hook or moved outside a case's timer to claim faster execution.
- The five recovery-specific tests import immutable raw strings. Inside each
  original five-second case they parse a new object graph, call the complete
  production `restoreMatch`, then execute the original start/tick assertions,
  full state/events successor comparisons and every original corruption rejection.
  No mutable graph or restored result is shared or cached.
- The prior original preparation cost was about 4.62–4.77 seconds per branch;
  separate diagnostic validation was about 0.10–0.34 seconds. Those measurements
  identify the changed preparation boundary, not a production performance gain.
  New test totals must not be compared with old totals as evidence that the engine
  or restore implementation became faster. Existing performance gates are unchanged.

`generate.ts` is the single command recipe shared with the retained live helper.
It imports no serialization implementation and never invokes `serializeMatch` or
`restoreMatch`. The generator's raw prefix comes directly from the unchanged real
driver rather than the live helper's restored prefix accessor.

Migration evidence correction: the earlier informal description said “15”
preparation battles. Enumerating the unchanged original round trace establishes
14; the first generator assertion intentionally failed on that mismatch and its
raw failure log is preserved in the implementation evidence. No fight or tick
was removed to obtain the corrected count.
