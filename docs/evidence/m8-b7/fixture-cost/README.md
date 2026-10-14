# Late-round identity/restore fixture cost

CI157 and CI158 both exceeded the unchanged 5000 ms timeout for `m8-b6-match-wiring.test.ts:115` (6149 ms and 5364 ms). They are not labelled incidental noise. CI158 otherwise passed 1421 cases, including all four corrected M6 replay-prefix cases; 10 pre-existing cases remained skipped. Its raw sanitized log is in `../ci158/`.

The old fixture simulated all 33 battles with nine three-star Caitlyns carrying 27 Deathblades. This is an identity/strict-restore test, not the maximum-unit-load performance gate. The approved test-only adjustment uses three identical heroes and nine identical weapons. No production code, official performance sample, timeout, test skip, golden or expected terminal result changes.

All 38 rounds and 33 battles still execute through ordinary Start/step/settlement commands, with no fabricated victories or precomputed checkpoint. The original 36–38 preparation/combat/settlement round trips, detached/frozen-state checks, no-enemy/no-item-regeneration spies, final-round/victory/history/duplicate-command assertions remain. A new explicit counter requires all nine late-round restore boundaries.

Read-only exploratory comparison (`node docs/evidence/m8-b7/fixture-cost/profile-fixture.cjs`, output `exploratory-profile.log`) measured the whole route plus nine serialization/restores, not the full Vitest assertions:

- 9 heroes × 3 items: 1863 ms, 1799 actual ticks, victory at round38.
- 9 × 1: 1836 ms, 2423 ticks; 5 × 3: 1472 ms, 2484 ticks; 5 × 1: 1390 ms, 3018 ticks.
- Selected 3 × 3: 1177 ms, 2980 actual ticks, victory at round38. More combat ticks are executed, but fewer irrelevant holder/item runtimes are initialized and processed.

Every exploratory sample is retained; this is diagnostic evidence, not a replacement CI performance measure. The initial adjusted full B6 test file passed three consecutive runs (3.44s/3.10s/3.06s). After adding the explicit nine-restore counter and non-max-load label, the exact final full B6 file passed three more consecutive runs (3.46s/3.38s/2.99s), all16 cases each, with the original `npm test -- tests/m8-b6-match-wiring.test.ts` command and unchanged default timeout. All six logs are retained, no sample excluded. Typecheck passed. The final isolated original complete-suite run passes:111 files,1422 passed/10 existing skipped,506.99s,exit0. Exact test tree:45d68632002279b38269ccbd4e0621a3e43c7d98. Raw log:../integration-receipts/final-full-unit.log.gz. Final CI confirmation remains pending.

The second pre-adjustment local complete-suite execution was interrupted: both tool session and process ceased to exist, and its preserved log ends without a summary (`../integration-receipts/full-prefix-run-interrupted.log.gz`). It is not counted as a pass or failure result. The subsequent isolated full run validates the fixed test tree, as recorded above.
