# D13: prepare slow-test inputs before each suite

Final scope: **10 changed test files /154 cases**, with both shuffled orders154/154 and typecheck passing. The entire prior29-file CI candidate list is audited below. Eight files extend the valid phase1 B5/Bracer work; actual restore/validation/clock-budget operations remain inside the cases. Full per-case data and exact tested source fingerprints are in `results.json`.

The original phase1 evidence below is preserved for head6940. Its CI was cancelled at04:52 UTC, with the required aggregator failing on cancelled dependencies; this is not reported as a green run. The expanded revision needs its own actual-head CI. External239/253 coordination and exclusions are recorded near the end.

Baseline: `a0d42c592cbd48fb075175e5f61818dabfe1b320`, tree `a7fe425dfecd60e2f687e98a025b37ead830534a` (`origin/multiplayer`, fetched 2026-10-20 UTC).
Initial checkout: clean `work` at `e958032c878c65bcb8bf05ab963265c31a4f029d`; explicit fetch created `origin/multiplayer` because the checkout fetchspec tracks main only. Local/remote `codex/perf-slow-fixtures` and matching PR search were empty before branch creation. No overwrite, rebase or force push.
Read repository `AGENTS.md`; `/workspace/.agents` is empty and there is no repository `.agents/skills`.
Reference: [PR234](https://github.com/catfish-xn/cat/pull/234), head `cd11bf3f94598d31614428744a17e2921c1ad208`, is a separate open PR; its R3b file is untouched.

## Phase1 change and isolation

- `tests/bracer-multikill-stacks.test.ts`: Renata's acquisition, grants and deployment move into scoped `beforeAll`; acquired/granted/deployed snapshots let the original seed, round and star assertions stay in the case. Real combat recording, object/JSON restoration, continued live/restored steps, and PlaybackSession construction/advance/seek/disposal remain in the case.
- The dead-holder and each summon variant prepare their public route, deployment and pre-target checkpoint in their own `beforeAll`. Target `stepMatch`, all event/stat checks and every `expectRestoredTicks` restore and continuation remain in the case. No restored state, continuation result or playback result is cached.
- New Bracer snapshots are recursively frozen. Each case receives `structuredClone` copies; even pre-existing Lux snapshots are detached in `beforeEach`. Only immutable m8/provenance/input-basis trees are re-certified after cloning, matching the existing fixture helper convention. No mutable object is shared with saved fixtures or another case.
- `tests/m8-b5-grant-upgrade.test.ts`: build the four legal inventory inputs in separate hooks, freeze them, then clone the selected input per case. Real permanent planning, negative restore, legal restore and duplicate-grant checks all remain in the original case. Existing helpers are unchanged.
- Seeds 42 and 20261020 shuffle both suites and cases, each passing all 39 cases (negative/mutation tests included). Frozen saved trees plus detached nested copies prevent mutation propagation; passing both orders demonstrates no dependency on earlier fixture warm-up.

## Phase1 validation and limits

Environment: Debian 13.6, Linux 6.18.55 x86_64, AMD EPYC 9V74 (5 logical CPUs), 18007 MiB RAM. Node 24.19.0, npm 11.9.0, Vitest 5.0.3, TypeScript 5.9.3, Vite 7.3.6; installed with the baseline lockfile (`npm ci --cache /tmp/d13-npm-cache`). CI uses Ubuntu 24.04 / Node 22; local measurements are not CI guarantees.

Before/after timing runs each select one changed file, using `npm test -- <file> --reporter=json --outputFile=<path>` with default project configuration. Before: 25/25 and 14/14; final after: 25/25 and 14/14. Shuffle checks use `npm test -- <both changed files> --maxWorkers=1 --sequence.shuffle --sequence.seed=<42 or 20261020> --reporter=json --outputFile=<path>`, each 39/39. `npm run typecheck` / `tsc --noEmit` exits 0; `git diff --check` passes. No full suite was started locally. An exploratory combined post-change run also passed 39/39; final per-file values below avoid cross-file contention. Shuffle runs are robustness checks, not timing comparisons.

`node docs/evidence/d13-slow-fixtures/verify-assertions.cjs` compares canonical TypeScript AST multisets of **all expect-rooted call expressions**, including chained calls and matcher helpers, against the full baseline. Bracer: 218 before/218 after; B5: 135/135; expressions and multiplicities identical. These are AST call counts, not dynamic assertion counts. All existing timeouts are unchanged. Diff scope excludes src, Vitest/config, golden, lockfile, D12's `m5-replay.test.ts` / `m5-replay-sniper-caitlyn.test.ts`, and every existing helper.

The two summon cases still take >2 s: their remaining cost is real restore and full tick equality verification, intentionally retained. Renata also improves only modestly because live recording and verification remain. This moves input preparation outside the case budget; it does not remove the work or claim whole-suite speedup.

## Completed audit of the prior slow-item list

The original existing CI source was [run39359104894 / shard1 job118420796734](https://github.com/catfish-xn/cat/actions/runs/39359104894/job/118420796734), head `7329e9687612d1f3ff0fdee9d8fc83ebee0a8df0`. B5 blue-buff/thiefs-gloves were2572/2636ms. Cancelled sibling logs returned BlobNotFound. `ci-slow-cases.txt` preserves every retrieved >=2s case/file line; aggregate file duration alone does not prove a >2s individual case.

All files in that prior list plus the supplied Bracer case were statically audited. Eight further test files changed, in addition to the original two. No local discovery full suite was run. “Actual operation” below means the remaining time is deliberately retained under the user's constraints; it is not a claim that those cases are now <2s. Cases already preparing inputs outside their bodies were not rewritten merely to change timing attribution. Files not represented in the available CI list remain outside this discovery coverage.

| File | Disposition | Reason |
| --- | --- | --- |
| tests/restore-audit/cd-replay-facts.test.ts | optimized | Warm the two legal item inputs; prepare absorption/cuts/eagle-eye public route prefixes in independent hooks. Every until, restore, corruption, rejection and continuation remains inside the cases. |
| tests/g2-4a-crown-history.test.ts | optimized | Prepare the repeated remover opening once; clone mutable MatchState for every scenario. Existing recursively immutable BattleHistory records retain identity. Consumable commands, validation, restore and next-battle comparison remain live. |
| tests/m8-b8-live-growth.test.ts | already prepared | The command route, prior/current growth facts and live boundary inputs are constructed at module setup. Cases perform actual strict restore, state/event continuation and negative validation; no large acquisition remains in them. |
| tests/match-lifecycle.test.ts | actual operation / no single-case evidence | Source CI lists only aggregate2769ms across12 cases. The explicit round/start/settlement/identity transitions are what the tests verify; no identified large repeated case-local input construction. |
| tests/m8-b5-grant-upgrade.test.ts | optimized phase1 | Retain previously delivered frozen legal inputs, per-case copies, live planning/duplicate/restore checks. |
| tests/server/g2-4b-artifact-forge-room.test.ts | optimized | Four distinct Room/Clock pairs reach round4 battle in separate hooks. toForgeWindow assertions, tier injection, round4 settlement, choices, grants and deadlines remain in each case. The network reconnect case remains live because it tests its own protocol sequence. |
| tests/m5-route.test.ts | D12 / actual operation | The run and independent golden/resource ledger are the operation being tested, not disposable setup. Its shared driver is excluded for D12. No changes. |
| tests/m8-b10-encounter-outcomes.test.ts | already prepared / actual operation | The public neutral route runs once at fixture-module setup; each call intentionally restores its own independent input. The46 cases test actual kills/loss/loot/terminal/restore outcomes; do not cache those restores. |
| tests/combat-first-pass-frames.test.ts | actual operation / no single-case evidence | Source CI lists only an aggregate3455ms over11 cases. The measured capture/re-run comparison and every resumable boundary are the actual test; synthetic one-unit input construction is small. |
| tests/server/replay-first-pass.test.ts | actual operation | The two reported >2s cases are the live network background-spot-check cadence and mismatch logging across rounds. Their capture, re-execution and later-round checks stay live. Already prepared idle-room lineups are outside case timers. |
| tests/tp-rewards-and-rounds.test.ts | actual operation | The 24 PvE plus four PvP battles, shared-pool transactions and next-round conservation are the specified integration scenario. The initial eight-seat construction is small; do not replace the live transactions with prepared results. |
| tests/server/replay-client.test.ts | optimized | Build and dispose the producer room once; save frozen plain battle inputs and copy them for each caller. No RemoteSession or playback result is cached. |
| tests/server/lifecycle.test.ts | optimized | Commands, dispose and BusyClock cases own separate rooms prepared only to round4 preparation. Actual freeze, slice steps, clock budgets and disposal stay in the cases. The complete one-shot/sliced comparison remains live over every original round. |
| tests/m6-integration-mage.test.ts | actual operation | Route/history observation and real per-tick playback/validation are the integration target. Full envelope acceptance is itself tested. Moving its results to hooks or reusing restored envelopes would cache the operation being tested. Existing helper unchanged. |
| tests/m8-b8-live-capacity.test.ts | already prepared / actual operation | The shared lethal campaign prefix already warms in beforeAll and returns copies. Each live lethal battle, loot/terminal checks and strict negative restore is the test target. |
| tests/m4-ledger-bound.test.ts | optimized | Capture genuine public preparation at ordinal33 in beforeAll, stopping fixture construction at the required boundary instead of simulating the unused suffix. All Match restore, synthetic-input rejection, session combat, ledger, copy isolation and capacity/timing assertions stay in the case. |
| tests/m5-growth.test.ts | D12 / already prepared | The large equipment acquisition route already warms in beforeAll; original CI evidence lists only a file total, not an individual >2s case. An uncommitted extra change was withdrawn; file is identical to baseline. |
| tests/m8-b8-live-economy.test.ts | already prepared | Large common economy/combat preparation is at module scope; case-local gold-boundary and restore validation remain. Source CI provides only the aggregate file duration. |
| tests/restore-audit/g23-grant-evidence.test.ts | already prepared | Junker/Academy campaigns already build in beforeAll with their original30000ms hook unchanged. Remaining larger costs are genuine restore/rejection checks; the five-unit planner vector is small. |
| tests/g2-augments-multiplayer.test.ts | actual operation | The bronze-tier cases compile and resolve each independently changed board then inspect settlement facts; this is the scenario under test. The eight-unit array is small; hoisting combat/settlement would cache tested results. |
| tests/server/g2-2-emissary-wins.test.ts | already prepared | The real round5 room input is already captured in beforeAll (original60000ms preserved); cases inspect and execute the selected battle independently. |
| tests/g2-4b-source-pins.test.ts | optimized | Decompress once and retain independent raw-source oracle fields, then copy them per case. All raw archive SHA256 checks and every content comparison still execute in the original case. |
| tests/g2-4b-replay.test.ts | actual operation / no single-case evidence | Source CI lists only aggregate4468ms across10 cases. Combat/replay reconstruction and negative missing-action validation are the actual target; a one-unit fixture is small. |
| tests/server/pairing-room.test.ts | optimized | Only the disconnect/takeover/resume case gets its own prepared room. Subscription assertions and both same-seed executions stay live; caching either would remove the behavior being tested. |
| tests/m5-match-integration.test.ts | D12 / actual operation | The 30s failure is restoring every real tick across rounds, exactly the test target. Do not move/cache those restores, skip rounds, or change its limit. No changes. |
| tests/s13-anomalies-restore.test.ts | actual operation / no single-case evidence | Source CI lists aggregate2964ms across11 cases; its reported slower cases are408/479ms. Small anomaly input construction feeds live140-tick reconstruction, deterministic order and forged-state rejection, which must stay in the case. |
| tests/m8-b10-item-save-replay.test.ts | already prepared | Every legal holderPreparation is already warmed in hooks. Its BattleHistory recording, four checkpoint restores, continuation and replay validation are the target and remain live. |
| tests/b8-resumable-battle.test.ts | already prepared / actual operation | Its helper already warms PvE and control battles in beforeAll. Each resumable task, budget boundary, divergence and resulting byte comparison remains live; no helper change. |
| tests/bracer-multikill-stacks.test.ts | optimized phase1 | Retain Renata/dead-holder/summon input preparation and detached per-case Lux snapshots. Real restore, continuation, target steps and playback remain live. |

## Phase1 per-case measured milliseconds

| File | Case | Before | After |
| --- | --- | ---: | ---: |
| bracer-multikill-stacks.test.ts | Lux kills two different targets in one root action and gains two +20 stacks | 3.023 | 3.982 |
| bracer-multikill-stacks.test.ts | restores the real double kill and continues identically (object) | 267.831 | 263.79 |
| bracer-multikill-stacks.test.ts | restores the real double kill and continues identically (json) | 277.974 | 264.362 |
| bracer-multikill-stacks.test.ts | saves Renata's tick-60 double kill, restores object/JSON, and replays every complete combat state | 1262.007 | 1109.15 |
| bracer-multikill-stacks.test.ts | S1: a holder and its target dying in the same tick award no stack to the dead holder | 10.034 | 8.273 |
| bracer-multikill-stacks.test.ts | S1: Sion owns its kill; Black Rose holder earns only a real prior assist (false) | 9.563 | 9.071 |
| bracer-multikill-stacks.test.ts | S1: Sion owns its kill; Black Rose holder earns only a real prior assist (true) | 6.747 | 8.579 |
| bracer-multikill-stacks.test.ts | S1: Silco monstrosities retain Silco ownership on a delayed lethal packet and award one kill stack | 11.766 | 11.662 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing ownerId or clock-derived stacks | 4.105 | 5.305 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing sourceKind or clock-derived stacks | 3.94 | 4.413 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing definitionId or clock-derived stacks | 3.537 | 4.626 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing instanceId or clock-derived stacks | 3.77 | 4.085 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing effectIndex or clock-derived stacks | 3.696 | 4.203 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing parentItemInstanceId or clock-derived stacks | 3.663 | 10.255 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing missing or clock-derived stacks | 3.236 | 4.21 |
| bracer-multikill-stacks.test.ts | binds all three effect offsets to settled receipts without borrowing under-count or clock-derived stacks | 4.068 | 4.499 |
| bracer-multikill-stacks.test.ts | deduplicates the same target, counts the second target, and keeps kill exclusive | 1.184 | 1.816 |
| bracer-multikill-stacks.test.ts | deduplicates the same target, counts the second target, and keeps assist exclusive | 0.693 | 1.684 |
| bracer-multikill-stacks.test.ts | only the bracer opts into per-target limits; other item declarations retain action-wide behavior | 0.512 | 1.715 |
| bracer-multikill-stacks.test.ts | rejects forged unknown-target receipts despite correct aggregate AP and count | 33.77 | 33.214 |
| bracer-multikill-stacks.test.ts | rejects forged duplicate-target receipts despite correct aggregate AP and count | 27.016 | 30.656 |
| bracer-multikill-stacks.test.ts | rejects forged old-action-key receipts despite correct aggregate AP and count | 45.658 | 30.708 |
| bracer-multikill-stacks.test.ts | retains a dead holder's same-tick killing blow but grants zero kill or assist stacks, with identical restored ticks | 1817.048 | 1453.892 |
| bracer-multikill-stacks.test.ts | a holder-owned summon kills as itself; holder contribution=false controls only assists, with identical restored ticks | 3262.972 | 3105.284 |
| bracer-multikill-stacks.test.ts | a holder-owned summon kills as itself; holder contribution=true controls only assists, with identical restored ticks | 2366.317 | 2349.433 |
| m8-b5-grant-upgrade.test.ts | plans exactly one permanent sword with no receipt/economy/RNG work | 622.892 | 25.077 |
| m8-b5-grant-upgrade.test.ts | plans exactly one permanent gloves with no receipt/economy/RNG work | 41.957 | 12.033 |
| m8-b5-grant-upgrade.test.ts | plans exactly one permanent blue-buff with no receipt/economy/RNG work | 972.507 | 19.315 |
| m8-b5-grant-upgrade.test.ts | plans exactly one permanent thiefs-gloves with no receipt/economy/RNG work | 904.538 | 12.223 |
| m8-b5-grant-upgrade.test.ts | rejects bad definitions, grant identities and serials without any partial state | 3.398 | 3.775 |
| m8-b5-grant-upgrade.test.ts | real choice commits exactly one item and one caller-owned receipt; restore/retry cannot regrant | 24.69 | 21.192 |
| m8-b5-grant-upgrade.test.ts | legacy multi-component reward uses one caller receipt and rejects a bad batch atomically | 3.603 | 3.208 |
| m8-b5-grant-upgrade.test.ts | inventory view contains only real inventory IDs, is detached and remains correct after combine/equip/sale | 585.847 | 545.788 |
| m8-b5-grant-upgrade.test.ts | chains to three stars, retaining one TG and returning conflicting parent without splitting or rerolling | 448.979 | 536.85 |
| m8-b5-grant-upgrade.test.ts | returns unique conflicts and preserves permanent IDs across the complete command | 26.746 | 28.443 |
| m8-b5-grant-upgrade.test.ts | returns exclusive survivor conflicts and preserves permanent IDs across the complete command | 50.508 | 45.185 |
| m8-b5-grant-upgrade.test.ts | returns exclusive incoming conflicts and preserves permanent IDs across the complete command | 48.349 | 42.771 |
| m8-b5-grant-upgrade.test.ts | returns full ordinary conflicts and preserves permanent IDs across the complete command | 65.252 | 57.799 |
| m8-b5-grant-upgrade.test.ts | failed purchase preserves roll ledger, children, resources and event serials | 35.759 | 38.5 |

## Expanded implementation and validation

Follow-up starts from the clean phase1 head `6940b097f2968c8a7cb1963c2c7136ba70dc266a`, tree `3b47bccbcd3e5573bd0b61e91377598b6a2cc7f5`; the original full baseline remains `a0d42c592cbd48fb075175e5f61818dabfe1b320`. The remote head was checked repeatedly and remained6940 before publication. Earlier valid B5/Bracer changes are retained.

New helper `tests/fixtures/prepared-input.ts` stores frozen plain input data and returns detached deep copies. It re-certifies only immutable Match m8/provenance/input-basis trees, matching existing fixture conventions. It never saves a restore/validation decision or the result being tested. Crown histories are the existing recursively immutable recorder-owned records; mutable scenario MatchState is copied. Room/Clock instances are not cloneable: each relevant case instead owns a separately constructed pair, prepared by its original real prefix and disposed afterward. No live Room/Clock is shared between cases. The complete live sliced/one-shot comparison, deterministic pairing runs and network sequences remain in the case.

Eight new changed-file single-file baseline/after commands: `npm test -- <file> --maxWorkers=1 --reporter=json --outputFile=<path>`; all115/115 passed before and after. Integration/order checks select exactly the ten changed test files, `--maxWorkers=1 --sequence.shuffle --sequence.seed=42` and seed20261020; both154/154 pass. `npm run typecheck` / `tsc --noEmit` and `git diff --check` pass. No full suite runs locally. No M5 file or existing shared helper changes; the temporary uncommitted m5-growth adjustment was withdrawn after the latest D12 ownership instruction.

The updated `verify-assertions.cjs` compares token-preserving AST representations against the full original baseline. Every expect/deepStrictEqual call expression and multiplicity is identical, and each individual test callback has its original assertion expressions and timeout, in the same test-definition order. Ten files /93 callbacks /1087 call expressions match. Default hook limits remain unchanged; no timeout/config/golden/digest/src changes. `results.json` records every one of154 before/after case timings, detailed check counts and SHA256 of the exact tested code files. These source fingerprints can be matched to the published commit tree.

Moving a prefix into beforeAll changes the test-body budget attribution, not the amount of required validation. Source archives retain only the raw-source fields used as independent oracle input, while every raw archive hash still executes inside the case. M4 stops acquisition at its required ordinal33 preparation; all real Match restore and synthetic load rejection, session/ledger operations, measured tick/observer loops and assertions remain in the case. The extra source-data copies are compact; they do not replace expected assertions with cached outcomes.

## External coordination and preserved first CI

[PR239](https://github.com/catfish-xn/cat/pull/239) head `7a48c2738ce41816e9a2e2f4f76968ace2a967b6` was verified via its actual four-file patch. It contains PR234's R3b setup, Renata's temporary20000ms limit, and the two M5 temporary600000ms limits. D13 duplicates none of those changes and keeps Renata's original default5000ms; R3b and both M5 tests/helpers remain untouched. The shared Bracer file is an integration coordination point with239. The comment [6282996544](https://github.com/catfish-xn/cat/pull/239#issuecomment-6282996544) is background only, not authorization to change limits.

[PR253 (D12)](https://github.com/catfish-xn/cat/pull/253) was verified to change restore-combat-replay.ts, s13-augments-p2-combat.ts, serialization-structure.ts, m5-replay-intermediates.test.ts and its own evidence. D13 changes none of them, no M5 file or existing shared route/replay helper, and does not merge/cherry-pick D12 production changes. M5 candidates in the prior list are explicitly delegated/excluded rather than silently counted as completed optimizations.

Fixed phase1 CI [39363364327](https://github.com/catfish-xn/cat/actions/runs/39363364327), head6940, attempt1, reached `completed/cancelled` at2026-10-20T04:52:08Z without a D13 rerun or new push. `ci-required` failed because dependency groups were cancelled, not because of a reported assertion in these two target files. The retrieved tests-2 log reports87 files /1262 tests passed but its GitHub conclusion is cancelled. Neither Bracer nor B5 occurs in that log, so no CI timing is claimed for them on6940. Cancellation source is not established. See `ci-6940-summary.json` and the complete preserved `ci-6940-required.txt`. This result is retained, not rewritten as a green run. The new publication requires its own actual-head CI.

## Additional per-case measured milliseconds

Same host and lockfile toolchain as phase1. Each baseline/after timing command selected one changed file with one worker. Timings may increase for untouched real-work portions because of ordinary run variance; the report includes them rather than hiding them. Real network reconnect, deterministic pairing and whole sliced-resolution work remain above2s in some runs and are intentionally not cached.

| File | Case | Before | After |
| --- | --- | ---: | ---: |
| g2-4b-source-pins.test.ts | pins all eleven exact Set13 identities, bilingual descriptions and map22 values | 1392.131 | 13.306 |
| g2-4b-source-pins.test.ts | keeps normal-mode economy values and the original 14.24 trench threshold | 1.116 | 0.604 |
| g2-4b-source-pins.test.ts | keeps every admitted runtime identity/name/uniqueness equal to the pinned original data | 0.582 | 0.626 |
| restore-audit/cd-replay-facts.test.ts | G-C02 rejects invented processed keys on a holder without triggers | 89.613 | 56.037 |
| restore-audit/cd-replay-facts.test.ts | G-C02 rejects invented actionCounts keys on a holder without triggers | 32.584 | 27.511 |
| restore-audit/cd-replay-facts.test.ts | G-C03 authenticates every unit attackCount even within the one-tick bound | 31.296 | 30.28 |
| restore-audit/cd-replay-facts.test.ts | G-C03 authenticates every unit castCount even within the one-tick bound | 26.258 | 22.494 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the contribution map and trigger sequence: victim | 30.699 | 24.133 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the contribution map and trigger sequence: holder | 21.784 | 21.953 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the contribution map and trigger sequence: sequence | 23.827 | 24.87 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the combat cursor: rngState | 52.098 | 35.269 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the combat cursor: rngDraws | 38.07 | 24.959 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the combat cursor: nextActionSeq | 28.283 | 26.873 |
| restore-audit/cd-replay-facts.test.ts | G-C04 binds the combat cursor: nextEventSeq | 31.527 | 25.132 |
| restore-audit/cd-replay-facts.test.ts | G-C05 binds a genuinely damaged ordinary shield even when both projections conserve the grant | 687.483 | 106.506 |
| restore-audit/cd-replay-facts.test.ts | G-C06 binds the real absorption value even when its status is forged coherently | 3945.462 | 167.913 |
| restore-audit/cd-replay-facts.test.ts | G-C07 authenticates a live periodic fractional account | 815.391 | 100.096 |
| restore-audit/cd-replay-facts.test.ts | G-C07 authenticates burn phase even when the group and task agree | 119.564 | 85.769 |
| restore-audit/cd-replay-facts.test.ts | G-C08 rejects invented Experiment takedowns plus matching maximum health | 277.752 | 219.99 |
| restore-audit/cd-replay-facts.test.ts | G-C08 binds Sevika high-roller mod rather than only its enum | 85.71 | 76.782 |
| restore-audit/cd-replay-facts.test.ts | G-C09 binds the activity duration even with a matching legacy status | 60.965 | 68.969 |
| restore-audit/cd-replay-facts.test.ts | G-C09 binds the activity share even with a matching legacy status | 52.761 | 57.761 |
| restore-audit/cd-replay-facts.test.ts | P1-BOUNDS-01 binds exposureBps at tick zero | 20.787 | 20.926 |
| restore-audit/cd-replay-facts.test.ts | P1-BOUNDS-01 binds exposureFromTick at tick zero | 19.225 | 17.425 |
| restore-audit/cd-replay-facts.test.ts | P1-BOUNDS-01 binds exposureUntilTick at tick zero | 23.759 | 18.259 |
| restore-audit/cd-replay-facts.test.ts | P2-BOUNDS-02 binds damageDealt at tick zero | 20.938 | 22.104 |
| restore-audit/cd-replay-facts.test.ts | P2-BOUNDS-02 binds damageTaken at tick zero | 18.403 | 17.151 |
| restore-audit/cd-replay-facts.test.ts | P2-BOUNDS-02 binds crystalDamage at tick zero | 18.52 | 16.756 |
| restore-audit/cd-replay-facts.test.ts | shares one replay between all consumers and detaches the expanded facts on cache hits | 18.142 | 14.122 |
| restore-audit/cd-replay-facts.test.ts | G-C03 rejects changing a real first-tick attack from one to zero | 42.815 | 42.643 |
| restore-audit/cd-replay-facts.test.ts | G-C03 rejects coherent Kogmaw cast/speed/range changes | 57.292 | 58.3 |
| restore-audit/cd-replay-facts.test.ts | G-C03 rejects Tristana growth that remains within the cast-count upper bound | 58.668 | 64.378 |
| restore-audit/cd-replay-facts.test.ts | G-C08 binds real one-thousand-cuts history | 4811.211 | 135.288 |
| restore-audit/cd-replay-facts.test.ts | G-C08 binds real eagle-eye history | 4719.193 | 125.804 |
| restore-audit/cd-replay-facts.test.ts | G-C08 binds Swain ascension timing | 103.037 | 68.664 |
| restore-audit/cd-replay-facts.test.ts | G-C08 binds Conqueror receipts after an actual takedown | 239.35 | 239.225 |
| restore-audit/cd-replay-facts.test.ts | resists shields, sampled holders and ordinary facts share the same cached trajectory | 74.005 | 65.219 |
| g2-4a-crown-history.test.ts | rejects the crowns:84/+5 coordinated forgery in text and object restoration, with or without genuine history | 196.657 | 154.008 |
| g2-4a-crown-history.test.ts | rejects the unchanged genuine replay collection paired with the forgery, synchronously and asynchronously | 228.468 | 186.252 |
| g2-4a-crown-history.test.ts | does not let a later record context authorize its own forged historical prefix | 239.953 | 222.225 |
| g2-4a-crown-history.test.ts | accepts the public-command no-crown control and resumes identically | 201.364 | 205.258 |
| g2-4a-crown-history.test.ts | restores and continues a legal provenance-backed crown control, seed 1 | 409.389 | 301.896 |
| g2-4a-crown-history.test.ts | restores and continues a legal provenance-backed crown control, seed 42 | 381.314 | 267.673 |
| g2-4a-crown-history.test.ts | rejects seed 7 cross-round crown transfer despite self-consistent production replay and rewards | 315.296 | 241.823 |
| g2-4a-crown-history.test.ts | accepts legal sale and subsequent re-equipping | 458.701 | 343.495 |
| g2-4a-crown-history.test.ts | accepts legal remover and subsequent re-equipping | 493.491 | 313.326 |
| g2-4a-crown-history.test.ts | accepts legal upgrade and subsequent re-equipping | 464.842 | 316.331 |
| g2-4a-crown-history.test.ts | accepts legal upgrade-remover-equip and subsequent re-equipping | 401.44 | 339.109 |
| g2-4a-crown-history.test.ts | accepts legal combine-equip and subsequent re-equipping | 381.276 | 269.086 |
| g2-4a-crown-history.test.ts | replays survivor equipment before-upgrade in exact order (M4) | 304.159 | 254.197 |
| g2-4a-crown-history.test.ts | replays survivor equipment after-upgrade in exact order (M4) | 359.541 | 258.027 |
| g2-4a-crown-history.test.ts | also rejects moving a non-crown equipped instance | 27.025 | 19.466 |
| g2-4a-crown-history.test.ts | replays combat equip before settlement, restores through all three entries and continues tick for tick | 462.868 | 362.084 |
| g2-4a-crown-history.test.ts | rejects a claimed pre-first-battle equip left in inventory, with or without an empty history | 69.923 | 47.237 |
| g2-4a-crown-history.test.ts | accepts legal pre-first-battle equipment and validates the first opening prefix | 336.347 | 239.53 |
| g2-4a-crown-history.test.ts | records combat consumable use with remove at all three entries and resumes tick for tick (M10) | 578.614 | 457.79 |
| g2-4a-crown-history.test.ts | records combat consumable use with reequip at all three entries and resumes tick for tick (M10) | 524.572 | 414.644 |
| g2-4a-crown-history.test.ts | records combat consumable use with combine at all three entries and resumes tick for tick (M10) | 428.946 | 356.602 |
| g2-4a-crown-history.test.ts | records combat consumable use with component-reforger at all three entries and resumes tick for tick (M10) | 1919.462 | 1572.878 |
| g2-4a-crown-history.test.ts | records combat consumable use with completed-reforger at all three entries and resumes tick for tick (M10) | 1685.438 | 1530.337 |
| g2-4a-crown-history.test.ts | rejects changing the remove command tick at all three entries (M10) | 247.102 | 191.716 |
| g2-4a-crown-history.test.ts | rejects changing the component-reforger command tick at all three entries (M10) | 901.399 | 706.058 |
| g2-4a-crown-history.test.ts | rejects changing the completed-reforger command tick at all three entries (M10) | 793.421 | 707.959 |
| g2-4a-crown-history.test.ts | rejects changing the remove resource tick at all three entries (M10) | 140.972 | 148.391 |
| g2-4a-crown-history.test.ts | rejects changing the component-reforger resource tick at all three entries (M10) | 507.006 | 402.747 |
| g2-4a-crown-history.test.ts | rejects changing the completed-reforger resource tick at all three entries (M10) | 410.96 | 393.461 |
| g2-4a-crown-history.test.ts | records inventory combination followed by equip=false and resumes the next battle tick for tick (M8) | 302.133 | 353.007 |
| g2-4a-crown-history.test.ts | records inventory combination followed by equip=true and resumes the next battle tick for tick (M8) | 176.883 | 190.404 |
| g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for ordinary (M9) | 302.683 | 300.247 |
| g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for in-place (M9) | 274.708 | 275.877 |
| g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for inventory (M9) | 293.44 | 308.623 |
| g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 0 (M9 boundary) | 214.265 | 201.174 |
| g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 2 (M9 boundary) | 220.292 | 203.84 |
| g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 69 (M9 boundary) | 221.575 | 219.693 |
| g2-4a-crown-history.test.ts | rejects existing-target in-place combination tampering at all three entries | 97.957 | 112.851 |
| g2-4a-crown-history.test.ts | rejects missing-first in-place combination tampering at all three entries | 29.438 | 30.258 |
| g2-4a-crown-history.test.ts | rejects missing-second in-place combination tampering at all three entries | 30.309 | 27.599 |
| g2-4a-crown-history.test.ts | rejects ordinary-equip in-place combination tampering at all three entries | 27.482 | 28.692 |
| g2-4a-crown-history.test.ts | rejects missing-first inventory combination commands at all three entries | 36.669 | 37.524 |
| g2-4a-crown-history.test.ts | rejects missing-second inventory combination commands at all three entries | 34.959 | 35.679 |
| g2-4a-crown-history.test.ts | rejects ordinary-equip inventory combination commands at all three entries | 102.703 | 95.762 |
| g2-4a-crown-history.test.ts | rejects a structurally valid command with an invalid recipe through production replay | 53.189 | 53.221 |
| g2-4a-crown-history.test.ts | binds combat equip order to the temporary item roll prefix (M9) | 142.265 | 144.206 |
| g2-4a-crown-history.test.ts | keeps combat equips before terminal resources and crown gold (M9) | 155.606 | 153.068 |
| g2-4a-crown-history.test.ts | records in-place sword combination at tick 1 (requested slot 0) and resumes the next battle tick for tick | 296.104 | 302.99 |
| g2-4a-crown-history.test.ts | records in-place sword combination at tick 1 (requested slot 2) and resumes the next battle tick for tick | 299.699 | 294.366 |
| g2-4a-crown-history.test.ts | rejects reordered commands at all three save/restore entries | 186.509 | 134.923 |
| g2-4a-crown-history.test.ts | rejects duplicated commands at all three save/restore entries | 64.518 | 71.233 |
| g2-4a-crown-history.test.ts | rejects extra commands at all three save/restore entries | 114.888 | 125.879 |
| g2-4a-crown-history.test.ts | rejects missing commands at all three save/restore entries | 119.683 | 136.304 |
| g2-4a-crown-history.test.ts | rejects unknown-target commands at all three save/restore entries | 67.88 | 68.749 |
| g2-4a-crown-history.test.ts | accepts combat equipment targeting a bench unit at all three entries | 64.56 | 64.755 |
| g2-4a-crown-history.test.ts | accepts combat equipment targeting a dead unit at all three entries | 338.069 | 348.741 |
| server/replay-client.test.ts | applies every tick record in order and ends exactly on the terminal view (A and mirrored B) | 2611.918 | 117.508 |
| server/replay-client.test.ts | a keyframe replaces the whole view; diffs between keyframes agree with it | 5.695 | 71.659 |
| server/replay-client.test.ts | side B sees every cell row-flipped and teams swapped, values unchanged | 7.469 | 69.527 |
| server/replay-client.test.ts | skips to the terminal view when the tab returns and drops the battle once the settled state arrives | 2.886 | 63.784 |
| server/replay-client.test.ts | catches up with wall time when frames were dropped, never runs ahead of it | 3.318 | 67.473 |
| server/replay-client.test.ts | projects a local ledger exactly like the server replay events (PvP and PvE) | 24.526 | 79.852 |
| m4-ledger-bound.test.ts | retains complete event sequences, deep-copy isolation, and clears at Continue/New Match | 7689.295 | 419.261 |
| m4-ledger-bound.test.ts | retains actual tick-zero combat events returned from Start commands | 6.492 | 5.382 |
| server/g2-4b-artifact-forge-room.test.ts | tier 10 opens 神器锻造器 with four distinct artifacts and the deadline grants the first offer once | 2425.869 | 26.44 |
| server/g2-4b-artifact-forge-room.test.ts | a pick before the deadline grants that artifact; stale, foreign and other-seat answers are refused | 1854.816 | 5.906 |
| server/g2-4b-artifact-forge-room.test.ts | tiers 9, 10 and 14 in one settlement open three anvils in turn; the deadline grants each remaining first offer | 1626.478 | 9.414 |
| server/g2-4b-artifact-forge-room.test.ts | never shows the artifact offers to another seat, in its view or its pushes | 1544.527 | 8.284 |
| server/g2-4b-artifact-forge-room.test.ts | a resumed seat gets the same artifact popup and the unchanged deadline, and can still pick | 1976.372 | 2275.439 |
| server/pairing-room.test.ts | every frozen opponent was a shown candidate; only PvP rounds grow the history | 2838.873 | 2418.445 |
| server/pairing-room.test.ts | a disconnect, a takeover and a resume leave the candidates unchanged (they live in the room state) | 1810.394 | 101.741 |
| server/pairing-room.test.ts | the same seed gives the same candidates and pairings | 3542.854 | 4311.661 |
| server/lifecycle.test.ts | returns timers and room leftovers to the baseline after every match and disposes the replaced room | 255.588 | 284.242 |
| server/lifecycle.test.ts | keeps connections, credentials, dedupe windows and timers at the same baseline after each of five matches | 576.162 | 614.059 |
| server/lifecycle.test.ts | publishes the same rounds whether a frozen round is resolved in one go or in slices of a few ticks | 3875.585 | 3833.469 |
| server/lifecycle.test.ts | refuses commands while the round is frozen and resolves one slice per clock turn | 1727.648 | 195.346 |
| server/lifecycle.test.ts | ends a slice once the clock passed sliceMs, in steps of SLICE_STEP_TICKS, and publishes the same round | 3160.919 | 444.034 |
| server/lifecycle.test.ts | stops resolving and publishes nothing once disposed in the middle of a frozen round | 1402.726 | 11.881 |
