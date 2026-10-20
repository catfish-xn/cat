# D13: prepare slow-test inputs before each suite

Baseline: `a0d42c592cbd48fb075175e5f61818dabfe1b320`, tree `a7fe425dfecd60e2f687e98a025b37ead830534a` (`origin/multiplayer`, fetched 2026-10-20 UTC).
Initial checkout: clean `work` at `e958032c878c65bcb8bf05ab963265c31a4f029d`; explicit fetch created `origin/multiplayer` because the checkout fetchspec tracks main only. Local/remote `codex/perf-slow-fixtures` and matching PR search were empty before branch creation. No overwrite, rebase or force push.
Read repository `AGENTS.md`; `/workspace/.agents` is empty and there is no repository `.agents/skills`.
Reference: [PR234](https://github.com/catfish-xn/cat/pull/234), head `cd11bf3f94598d31614428744a17e2921c1ad208`, is a separate open PR; its R3b file is untouched.

## Change and isolation

- `tests/bracer-multikill-stacks.test.ts`: Renata's acquisition, grants and deployment move into scoped `beforeAll`; acquired/granted/deployed snapshots let the original seed, round and star assertions stay in the case. Real combat recording, object/JSON restoration, continued live/restored steps, and PlaybackSession construction/advance/seek/disposal remain in the case.
- The dead-holder and each summon variant prepare their public route, deployment and pre-target checkpoint in their own `beforeAll`. Target `stepMatch`, all event/stat checks and every `expectRestoredTicks` restore and continuation remain in the case. No restored state, continuation result or playback result is cached.
- New Bracer snapshots are recursively frozen. Each case receives `structuredClone` copies; even pre-existing Lux snapshots are detached in `beforeEach`. Only immutable m8/provenance/input-basis trees are re-certified after cloning, matching the existing fixture helper convention. No mutable object is shared with saved fixtures or another case.
- `tests/m8-b5-grant-upgrade.test.ts`: build the four legal inventory inputs in separate hooks, freeze them, then clone the selected input per case. Real permanent planning, negative restore, legal restore and duplicate-grant checks all remain in the original case. Existing helpers are unchanged.
- Seeds 42 and 20261020 shuffle both suites and cases, each passing all 39 cases (negative/mutation tests included). Frozen saved trees plus detached nested copies prevent mutation propagation; passing both orders demonstrates no dependency on earlier fixture warm-up.

## Validation and limits

Environment: Debian 13.6, Linux 6.18.55 x86_64, AMD EPYC 9V74 (5 logical CPUs), 18007 MiB RAM. Node 24.19.0, npm 11.9.0, Vitest 5.0.3, TypeScript 5.9.3, Vite 7.3.6; installed with the baseline lockfile (`npm ci --cache /tmp/d13-npm-cache`). CI uses Ubuntu 24.04 / Node 22; local measurements are not CI guarantees.

Before/after timing runs each select one changed file, using `npm test -- <file> --reporter=json --outputFile=<path>` with default project configuration. Before: 25/25 and 14/14; final after: 25/25 and 14/14. Shuffle checks use `npm test -- <both changed files> --maxWorkers=1 --sequence.shuffle --sequence.seed=<42 or 20261020> --reporter=json --outputFile=<path>`, each 39/39. `npm run typecheck` / `tsc --noEmit` exits 0; `git diff --check` passes. No full suite was started locally. An exploratory combined post-change run also passed 39/39; final per-file values below avoid cross-file contention. Shuffle runs are robustness checks, not timing comparisons.

`node docs/evidence/d13-slow-fixtures/verify-assertions.cjs` compares canonical TypeScript AST multisets of **all expect-rooted call expressions**, including chained calls and matcher helpers, against the full baseline. Bracer: 218 before/218 after; B5: 135/135; expressions and multiplicities identical. These are AST call counts, not dynamic assertion counts. All existing timeouts are unchanged. Diff scope excludes src, Vitest/config, golden, lockfile, D12's `m5-replay.test.ts` / `m5-replay-sniper-caitlyn.test.ts`, and every existing helper.

The two summon cases still take >2 s: their remaining cost is real restore and full tick equality verification, intentionally retained. Renata also improves only modestly because live recording and verification remain. This moves input preparation outside the case budget; it does not remove the work or claim whole-suite speedup.

## Discovery coverage

Prioritized existing CI: [run39359104894 / shard1 job118420796734](https://github.com/catfish-xn/cat/actions/runs/39359104894/job/118420796734), head `7329e9687612d1f3ff0fdee9d8fc83ebee0a8df0`. Its B5 blue-buff/thiefs-gloves cases were 2572/2636 ms. See `ci-slow-cases.txt` for the extracted >=2 s case and file lines. The supplied Bracer candidate was measured directly; its two summon cases qualified locally. Renata (known line82 candidate) measured 1262 ms locally but still constructs substantial inputs in the case and is included.

This is **not exhaustive**: sibling cancelled CI logs returned BlobNotFound, and a single shard's file totals cannot identify every slow case. No discovery run of the entire repository was attempted. Other >=2 s evidence includes restore-audit/cd-replay-facts, g2-4a-crown-history, m5-route, m6-integration-mage, m4-ledger-bound, m5-match-integration, g2-augments-multiplayer, tp-rewards-and-rounds and multiple tests/server cases; their preparation/real-operation boundaries have not all been audited or refactored here. The existing m5-match-integration 30 s CI timeout remains an upstream risk, not fixed by changing a timeout. D12 files/helpers, PR234 and other handed-off work are untouched. Follow-up should inspect remaining evidence without launching a discovery full suite.

## Per-case measured milliseconds

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
