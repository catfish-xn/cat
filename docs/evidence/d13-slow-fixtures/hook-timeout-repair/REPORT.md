# D13 local repair: withdraw two overlong preparation hooks

Published head07af2bfbde736685ba88c23d55623c4aa4f93dee failed in [run39372329138/job118462740972](https://github.com/catfish-xn/cat/actions/runs/39372329138/job/118462740972), attempt1. Both failures were `Hook timed out in 10000ms`, at M4 line18 and CD line21. The original complete job log is preserved in `first-failure.json` (`original_log_utf8`, including ANSI/newlines); its raw-log SHA256 is in `results.json`. CI reported2 failed suites,85 passed files,1056 passed tests and36 skipped/unexecuted tests caused by failed hooks. Those36 were not passed; no test `.skip` was introduced.

Local parent is cff3ced9102cd901717026ebb68ccdc9ef144e12. No push, dispatch or rerun was performed for this repair; last verified remote published head is07af (local tracking ref unchanged; no new remote mutation). The repaired revision has no CI result. Earlier local154/116-case checks remain historical; this repair only runs the two affected files.

M4 is restored byte-for-byte to baseline a0d42c592cbd48fb075175e5f61818dabfe1b320, removing its capacity-route hook and cached input. Its original full route, restore, observer and ledger work all execute inside the original case. CD removes the three anomaly-route hooks and shared snapshot map; each affected case constructs its original route independently. Only the existing two small itemMatch cache warm-ups remain in beforeAll. No tested restore/validation or assertion is moved outside cases, no result is cached, and no timeout/configuration/production/M5 helper is changed. All other candidate changes are preserved.

This deliberately restores preparation time to the cases instead of lengthening the default10-second hook limit. Original M4 explicit120000ms and CD60000ms case limits remain unchanged. It avoids the introduced heavy-hook failure mechanism; it does not establish a faster whole suite or a green CI run. Two locally passing pre-repair files do not invalidate the observed CI failure.

## Local verification

Same workspace/toolchain: Debian13.6/Linux6.18.55, AMD EPYC9V74,5 available CPUs,18007MiB; Node24.19.0/npm11.9.0, TypeScript5.9.3, Vitest5.0.3/Vite7.3.6. Before and after are sequential one-file runs with `npm test -- <file> --maxWorkers=1 --reporter=json --outputFile=<report>`: M4 2/2 and CD34/34 both before and after. Both files together pass36/36 under each `--sequence.shuffle --sequence.seed=42` and `--sequence.seed=20261020`, maxWorkers1. No full-suite discovery run or combined270-case verification is claimed. Restored routes are fresh per call; no shared mutable anomaly snapshot exists. The two seeded shuffled orders exercise the same assertions and state isolation.

`npm run typecheck` and `git diff --check` pass. `node docs/evidence/d13-slow-fixtures/verify-assertions.cjs tests/m4-ledger-bound.test.ts tests/restore-audit/cd-replay-facts.test.ts` compares token-preserving assertion ASTs and each callback's assertions/options/timeout against a0:14 files,156 callbacks,1810 expect/deepStrictEqual call expressions identical. Explicit paths include the now byte-identical M4 file that git diff would omit. Details in `assertions.json`.

Every case timing and shuffled status is recorded in `results.json`, bound to source SHA256. Durations below are milliseconds inside cases, single samples; beforeAll is excluded. They measure relocation/reversion and machine variation, not independent CPU savings or CI timing predictions.

| File / case | Before repair ms | After repair ms |
| --- | ---: | ---: |
| tests/m4-ledger-bound.test.ts / M4 observer safety retained under M5 finite-content capacity retains complete event sequences, deep-copy isolation, and clears at Continue/New Match | 428.425 | 7676.807 |
| tests/m4-ledger-bound.test.ts / M4 observer safety retained under M5 finite-content capacity retains actual tick-zero combat events returned from Start commands | 4.987 | 6.571 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C02 rejects invented processed keys on a holder without triggers | 57.993 | 54.865 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C02 rejects invented actionCounts keys on a holder without triggers | 25.716 | 33.092 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C03 authenticates every unit attackCount even within the one-tick bound | 25.177 | 27.360 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C03 authenticates every unit castCount even within the one-tick bound | 23.710 | 22.479 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the contribution map and trigger sequence: victim | 23.191 | 26.919 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the contribution map and trigger sequence: holder | 23.958 | 29.437 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the contribution map and trigger sequence: sequence | 21.159 | 33.057 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the combat cursor: rngState | 35.017 | 45.381 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the combat cursor: rngDraws | 29.524 | 37.076 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the combat cursor: nextActionSeq | 29.977 | 30.488 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C04 binds the combat cursor: nextEventSeq | 27.082 | 24.517 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C05 binds a genuinely damaged ordinary shield even when both projections conserve the grant | 120.478 | 114.328 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C06 binds the real absorption value even when its status is forged coherently | 203.790 | 5513.010 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C07 authenticates a live periodic fractional account | 105.017 | 204.516 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C07 authenticates burn phase even when the group and task agree | 99.449 | 145.021 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 rejects invented Experiment takedowns plus matching maximum health | 219.750 | 281.700 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 binds Sevika high-roller mod rather than only its enum | 93.013 | 110.821 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C09 binds the activity duration even with a matching legacy status | 57.808 | 76.764 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C09 binds the activity share even with a matching legacy status | 48.716 | 47.738 |
| tests/restore-audit/cd-replay-facts.test.ts / P1-BOUNDS-01 binds exposureBps at tick zero | 20.598 | 26.065 |
| tests/restore-audit/cd-replay-facts.test.ts / P1-BOUNDS-01 binds exposureFromTick at tick zero | 17.039 | 23.731 |
| tests/restore-audit/cd-replay-facts.test.ts / P1-BOUNDS-01 binds exposureUntilTick at tick zero | 18.077 | 23.656 |
| tests/restore-audit/cd-replay-facts.test.ts / P2-BOUNDS-02 binds damageDealt at tick zero | 19.261 | 21.576 |
| tests/restore-audit/cd-replay-facts.test.ts / P2-BOUNDS-02 binds damageTaken at tick zero | 16.647 | 19.154 |
| tests/restore-audit/cd-replay-facts.test.ts / P2-BOUNDS-02 binds crystalDamage at tick zero | 21.346 | 29.111 |
| tests/restore-audit/cd-replay-facts.test.ts / shares one replay between all consumers and detaches the expanded facts on cache hits | 14.269 | 21.629 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C03 rejects changing a real first-tick attack from one to zero | 40.034 | 47.068 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C03 rejects coherent Kogmaw cast/speed/range changes | 55.803 | 59.654 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C03 rejects Tristana growth that remains within the cast-count upper bound | 52.420 | 62.821 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 binds real one-thousand-cuts history | 143.361 | 6347.474 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 binds real eagle-eye history | 128.509 | 5203.824 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 binds Swain ascension timing | 68.099 | 74.952 |
| tests/restore-audit/cd-replay-facts.test.ts / G-C08 binds Conqueror receipts after an actual takedown | 297.430 | 234.352 |
| tests/restore-audit/cd-replay-facts.test.ts / resists shields, sampled holders and ordinary facts share the same cached trajectory | 71.031 | 67.855 |
