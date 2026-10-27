# EXT-2 · v25: merge the 13 researched batch-5 branches and clear the seed-drift test failures

## Start point
- Repository `catfish-xn/cat`, branch **`claude/v25-integration`** (commit `d239794b`).
  - Contains multiplayer v24 (#456) and every earlier batch-5 branch: s-series, h1–h13 and the augment-history save section.
- Push the result to the new branch **`codex/v25-integration-2`**. Do not push to `claude/v25-integration` or `multiplayer`.
- Run `npm ci` first.

## Step 1 — merge these branches, in order
Each one is implemented, reviewed, fixed and re-reviewed.

| branch | tip | cards |
|---|---|---|
| codex/v25-r1 | 6948975f | B5-39/40 Tomb Raider I/II |
| codex/v25-r2 | a403319b | B5-21 Anger Issues, B5-81 Another Anomaly |
| codex/v25-r3 | 9e883e00 | B5-74 Cloning Facility, B5-78 Hall of Mirrors (stays banned at all nodes) |
| codex/v25-r4 | ea36308d | B5-67 Mad Chemist |
| codex/v25-r5 | 7acb53c5 | B5-08/09 Starry Night / + |
| codex/v25-r6 | 1ede4ee7 | B5-27 Pandora's Bench, B5-28 Recombobulator |
| codex/v25-g1 | 6384c9e5 | B5-53/54 Lucky Gloves / + |
| codex/v25-g2 | 8a3ce67b | B5-63 Ghost of Friends Past, B5-70 Paint the Town Blue |
| codex/v25-g3 | edacaf50 | B5-68 Aerial Warfare, B5-71 The Mutation Survives |
| codex/v25-g4 | 9195e386 | B5-72 Voidcaller, B5-73 Void Swarm |
| codex/v25-g5 | 7e2d03db | B5-82 Expected Unexpectedness, B5-85 Prismatic Pipeline |
| codex/v25-g6 | ff2c7caf | B5-83 I'm the Carry Now |
| codex/v25-g7 | b213b959 | B5-69 Loot Explosion (2-1/3-2 only) |

All 13 forked from `claude/v25-int-a`, which is an ancestor of the start point. They will conflict mostly in shared registries, because every branch appends its own entry to the same lines:
- `src/simulation/content/augments.ts`, `augment-policy.ts`, `augment-offer-rules.ts`, `rules-manifest.ts`, `augment-stage-bans.ts`
- `src/simulation/validate-content.ts`, `augment-pool-grants.ts`, `shared-pool.ts` (restore validation)
- `tests/fixtures/m5/oracle.g2.cjs`, `tests/fixtures/m5/augment-rewards-oracle.cjs`
- `docs/S13_RULES_GAP.md`, `docs/AUGMENT_BATCH5_GAPS.md`

Conflict rules:
- **Registries, lists and docs: keep both sides.** Every branch's entries, checks and restore validators stay.
- **Logic files**, such as `match.ts`, `combat*.ts`, `carousel.ts`, `augment-history*.ts` and the oracles: read both sides' intent and combine them. Both behaviours must survive. If two changes truly cannot coexist, stop and write down `file:line` and the reason. Do not drop one side.
- **`src/simulation/content/identity-constants.ts` and `scripts/tests/production-size.test.ts`:** do not hand-merge. After all merges run `node scripts/update-content-identities.cjs --write`, then sync the production-size test to the new digests.
- **Stage bans are user decisions. Keep them exactly:**
  - Fine Vintage and Table Scraps are offered at 2-1 only.
  - Loot Explosion is offered at 2-1 and 3-2, and banned at 4-2.
  - Hall of Mirrors is banned at every node.
  - Everything else follows the 14.24 tags.

## Step 2 — make the related tests green
Batch 5 grew the augment pool, so tests that relied on a fixed seed producing a specific offer now drift. Known failures:
- `tests/augment-history.test.ts` (seed 18 → starry-night)
- `tests/shop-history.test.ts:32`
- `tests/augment-pool-batch1.test.ts:91,115`
- `tests/server/augment-preparation-room.test.ts:74`
- `tests/augment-pool-batch2.test.ts` (rocket-collection-plus, seed 155)
- `tests/augment-pool-batch5-h5-priority.test.ts`
- `tests/m5-oracle-route-driver.test.ts:20`
- `tests/v23-tamper-mechanics.test.ts:268`
- `tests/epic-loot-reforger.test.ts:236`
- `tests/g2-3-lesser-shimmer-duplicator.test.ts:221`
- `tests/g2-4b-pr161-restore.test.ts:40`

There may be more after the merge. Fix each one at its root cause:
- **Seed or offer drift:** construct the offer explicitly, or search a legal seed within 0..100 (wider scans are forbidden). Keep every assertion.
- **A real behaviour conflict from the merge:** fix the code so both branches' behaviour holds.

**Do not touch** `tests/server/battle-start-slices.test.ts` or its fixture `tests/server/fixtures/battle-start.json`. Those are v24 epoch snapshots and get re-recorded with the v25 epoch later. Leave them failing and list them.

**Do not work on** `tests/server/bot-driver-timing.test.ts` (the 8-bot 60 s budget). That is task EXT-1.

## Hard rules
- Do not delete or weaken assertions. Do not raise, relax or skip any timeout or budget.
- No game rule or number changes beyond what the merged branches already contain.
- Do not record or alter epochs. Released epoch evidence (v23 and older) is immutable.
- `src/server/` must not gain `setTimeout`, `Date.now`, `performance.now` or the word `window`. Check with `git diff origin/multiplayer...HEAD -- src/server | grep '^+'`.
- 3D assets and original game data never enter git. Tests that read the external research file already `skipIf` when it is missing; leave that as is.
- Online multiplayer is the only target. Solo paths only need to not throw.
- No force-push, no deleting branches, no edits to `.github/workflows`.

## Acceptance
1. `npx tsc --noEmit -p .` passes.
2. `node scripts/update-content-identities.cjs --check` passes.
3. `npx vitest run scripts/tests/production-size.test.ts` passes.
4. `npx vitest run tests` passes, except `battle-start-slices` and `bot-driver-timing` as stated above.
5. `npx vitest run tests/server` passes, with the same two exceptions. These tests listen on 127.0.0.1, so a sandbox that forbids local ports is not enough: run them where local ports work.

Report in Chinese in `docs/V25_INTEGRATION_2_REPORT.md`:
- each merge: conflicting files and how they were resolved;
- each test fixed: root cause and fix;
- the final test counts;
- anything left failing, with `file:line` and the reason.

## Background in this folder
- `B5-RESEARCH-DECISIONS-A.md` and `B5-RESEARCH-DECISIONS-B.md`: the user-approved conventions for the 23 researched cards.
- `B5-REVIEWS/`: every review, fix report and re-review for r1–r6 and g1–g7.
