# TG35 public-opening CPU diagnostic (read-only production investigation)

## Result

One effective diagnostic test run completed. All 705 original assertions completed; coverage remained 43 child definitions / 35 selected public routes / 105 opening battles / 15,969 opening combat ticks. Selected seed indices, seeds, child pairs, bound pairs, opening tick triples, and round IDs match the prior segmented run. The test used the unmodified default 5,000 ms timeout. No production, fixture, helper, package, or configuration file was changed in the mirror. Hash verification covers 174 such files.

The only instrumentation is in the test copy: the previous segmented timers plus a Node inspector CPU profiler around the selected test callback. Sampling interval was 1,000 microseconds. This run measures profiling overhead and is NOT an acceptance timing or a baseline-versus-candidate comparison. No candidate was implemented or run.

## Timing interpretation

- Prior unprofiled segmented case: 3,022.23 ms; inclusive preparation: 2,327.34 ms.
- This profiled case callback: 3,286.18 ms; inclusive preparation: 2,556.09 ms.
- CPU profile weighted samples: 3,319.92 ms, including profiler setup/teardown samples; samples classified under `equipped`: 2,450.31 ms. GC cannot reliably be attributed to that stack and is excluded from this preparation subtotal. These are sampled weights, not function-call wall timers.
- `advanceS13Tick` inclusive under preparation: 2,092.62 ms (85.4% of preparation sampled time).
- Unit-copy map callback: 1,156.68 ms inclusive (47.2% of preparation sampled time); 239.44 ms self (9.77%).
- Native `structuredClone` directly under that map: 884.66 ms inclusive (36.1% of preparation sampled time). All preparation `structuredClone` callers combined: 920.71 ms inclusive.
- `maintainMechanisms`: 84.57 ms inclusive (3.45% prep).
- `byDistance`: 55.52 ms inclusive (2.27% prep).
- `spellCrit`: 52.48 ms inclusive (2.14% prep), including 50.92 ms under `rollPlannedPackets`.
- `range`: 38.62 ms inclusive (1.58% prep), but only 1.84 ms is inside the BFS `move` routine.
- `withCombat`: 49.27 ms inclusive; `revealMatchLoot` self: 7.55 ms. No full Match clone is performed on every step.

Profiler URLs/line numbers refer to Vitest-transformed functions, not necessarily original TypeScript line numbers. Relevant original source is `src/simulation/combat-s13.ts:94-117`, with stepMatch at `src/simulation/match.ts:269-275`.

## Narrow candidate and dependency audit

The measured candidate is the second full shallow copy in the unit map: native `structuredClone({ ...unit, ...exclusions })` already yields a private detached plain object, then `return { ...copy, ...overrides }` enumerates and copies all its fields again. Reusing the private clone for the result could remove that redundant enumeration/allocation. It leaves the native deep clone and existing mechanism sharing intact. The map's 239.44 ms self weight includes more work than the second spread, so this is an upper opportunity indicator, not a promised saving.

Conditions for an equivalent implementation:

1. Keep the original structuredClone argument and its evaluation order unchanged. Do not substitute a custom clone or newly share fields.
2. Preserve every subsequent read of original `unit`, including conditional truthiness/read pairs for mechanism fields and both alive/cooldown evaluations, in the same sequence.
3. Preserve `unit.startingCell ?? { ...unit.cell }` exactly. The current implementation shares an existing original startingCell; replacing it with the clone's startingCell changes reference semantics.
4. Replacing the cloned runtime with `{ ...EMPTY_RUNTIME, ...copy.runtime }` must preserve the existing alias break. Other cloned fields that happen to alias that old runtime retain the old cloned object, as before.
5. Under native structuredClone, no nested property can reference the private cloned root: the clone's input root is a newly created spread object inaccessible to the input graph. Thus returning the private clone rather than another top-level spread does not change a nested reference to that root. Source cycles point to separately cloned source objects, not this newly constructed input root.
6. Existing own-property order remains the same when existing properties are overwritten in place and absent override properties are created in the same order. Descriptors must remain enumerable, configurable and writable.
7. Raw-object edge: assignment uses [[Set]], while object-literal spread/overrides define own data properties. A source accessor could install an inherited setter on Object.prototype for an override absent from the clone. Plain assignment could trigger it; the original spread would not. Object.defineProperty with the ordinary data descriptor preserves this exotic behavior, but its overhead must be measured. Merely casting the type cannot solve it.
8. Tests should compare every public command/tick's full state/events/RNG/receipts for the same 35 routes, not just final state, and retain direct raw-object getters/alias tests and all recovery/tampering tests.

This report does not authorize broad clone replacement and proposes no cross-call/tick cache or fixture change.

## Alternatives not recommended as the initial fix

- Reusing the movement-stage nearest target at action time is unsafe: movement and aura work lie between the two selections.
- Lazily running spellCrit only when a packet exists would suppress the current authorization validation/error on empty-packet ticks. Existing raw-object behavior would change.
- spellCrit followed by rollCrit contains repeated validation, but validateSpellCrit's measured weight inside rollCrit is only 2.15 ms. Changing its exported API or validation boundaries is disproportionate to that measured opportunity.
- Hoisting range within a single BFS search is more narrowly reusable, but all such calls account for only 1.84 ms of sampled preparation time.

## Reproduction and files

Environment: Node v22.23.3 at `/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin`, Vitest 5.0.3. Source checkout HEAD at initial inspection: `8014d83e3364bad4da3dcf46873207f30b981ba2`.

The mirror was copied from `/tmp/b8-tg43-current-segmented/mirror` excluding node_modules; dependencies were symlinked to that mirror's unchanged node_modules. `diff -qr` confirmed the production source tree matched the current checkout before the run. `source-hashes.json` confirms it again afterward. The original repository was not edited.

Run command from `/tmp/b8-tg35-opening-cpu/mirror`:

```
PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH npm test -- tests/m8-b5-temporary.test.ts -t "all 43 eligible child definitions bind through real Match snapshots and restore"
```

- `run-once.sh`: exact environment capture and single test launcher.
- `environment-and-command.txt`: toolchain, machine information, test command and host-clock timestamps. Host wall-clock timestamps differ from conversation reminders; no timing is derived by comparing them.
- `single-run.log`, `single-run.stderr.log`, `single-run.exit`: complete test stdout/stderr and exit code (0).
- `tg35.cpuprofile`: raw CPU profile, usable in DevTools.
- `analyze-cpu.py`, `cpu-analysis.json`: weighted-sample analysis and all rankings.
- `segmented-results.json`: complete route/segment/assertion results.
- `instrument-cpu.py`, `instrumentation.diff`: added profiler instrumentation relative to the previously preserved segmented test.
- `checks.json`: exact coverage/route/assertion and source-integrity checks.
- `source-hashes.json`: paired checkout/mirror hashes of all 174 production/helper/config files.

No second diagnostic test run was performed. No assertion, timeout, case selection, game rule, public command route, serialization validation, or production source file was changed.
