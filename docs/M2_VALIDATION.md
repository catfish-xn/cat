# M2 validation record

Validated on 2026-10-04 (Asia/Taipei). Baseline: latest fetched main `abd9245c01a8bbdd5b26724e6ab156fd2a89dfe3`, including merged PR #1 and PR #2. Baseline 59 tests/build and the original two-battle Chromium script passed before implementation. The original planning text remains; the subsequent full-M2 Goal authorized implementation, and M2_PLAN section13 adds the requested desktop interaction acceptance without changing scope.

## Implemented behavior

One MatchState now owns round, gold, deterministic RNG, five shop slots, preparation roster, instance serial and settlement history. Pure commands validate deployment/buy/sell/reroll/Start/Continue. Failed commands return the identical state without spending, allocating IDs or consuming RNG. Terminal combat atomically records one result and grants5; Continue grants0, refreshes the shop and retains preparation. MatchSession only forwards commands and accumulates 50ms ticks.

Initial gold10; buy3; sell2; reroll2; income5 for every outcome. Fixed three-definition catalog and two-enemy template. No excluded leveling, star, pool, hero, item, multiplayer or asset systems were added. M1 combat, board, unit definitions, deployment and hex layout source files are unchanged. Normal lifecycle uses Continue; optional Debug New Match resets the entire match instead of replaying a rewarded round.

## Ownership and review

Main coordinator froze the public Match API/types/rules and contract in `0dde6ea`, implemented Match/economy/lifecycle, integrated the actual diffs serially, and owns browser/CI/final acceptance. A worked only on RNG/shop tests in `/workspace/cat-m2-shop`; B worked on Phaser/session and corresponding tests in `/workspace/cat-m2-ui`. C remained an independent read-only reviewer. Maximum concurrency was four including the coordinator. No core file had two simultaneous owners.

The reviewer checked the frozen API, failure atomicity, settlement, replay tests, integrated UI/token cleanup and the migration of M1 tests. Browser assertions were strengthened to check visible HUD/shop labels and reject a repeated Start after tick40. Final evidence and CI must be checked at the final implementation SHA, as recorded in the final acceptance report; an earlier commit's green checks do not constitute final acceptance.

## Automated tests

`npm ci`, `npm test` and `npm run build` pass locally. Node24.19.0 / npm11.9.0; CI uses Node22. Build includes strict TypeScript checking. The pre-existing Phaser chunk-size warning remains.

| Tests | Count | Evidence |
| --- | ---: | --- |
| Original M1 board/deployment/layout/combat/start files | 51 | All six files unchanged; geometry, permissions, targeting/BFS, simultaneous damage/death, timeout, snapshot isolation, replay and terminal behavior |
| MatchSession, replacing old 8-test CombatSession suite | 13 | Original guards/clock/isolation/restart guarantees migrated to Continue, plus economy, five rounds, whole-match debug reset and three rapid-command accounting/replay tests |
| RNG and shop | 33 | Independent uint32 vectors and threshold seeds, fixed catalog, five draws, four-generation sequence, duplicate definitions and identical consecutive shops |
| Match public contract | 9 | Initialization, reproducibility, invalid seeds and atomic rejection |
| Match economy | 15 | Buy/sell/reroll boundaries, sufficient-money full bench rejection, first free slot/ID non-reuse, stale shop and combat/settlement guards |
| Match lifecycle/isolation | 7 | Real win/loss/draw settlement, repeat/stale Continue, all historical frozen snapshots, five rounds and fresh combat |
| Match integration replay | 3 | Full five-round state/event trace equality, rejected-command insertion invariance, JSON restore at every preparation/combat/settlement step |
| Total | **131** | **13 suites** |

Test code uses complete state identity/deep equality and frozen input, not merely gold comparisons. An independent operation ledger checks every successful transition. The draw fixture shortens maxTicks while still using real stepCombat; browser playthroughs do not inject results or change tick duration.

## Real Chromium evidence

`scripts/verify-m2-browser.cjs` drives actual mouse clicks/drags and Chromium touch events. Its only live observation API returns copied state, text and bounds; it has no setter or command dispatch hook. Main path uses one page and one match through five settlements and Continue to round6, with no reload or Reset. Fresh-state comparison separately constructs pure combat and advances it to the observed tick; it never writes the live battle.

Local Chromium `151.0.7922.173`, seed42, 960×800:

1. Initial five slots, visible Round1/Gold10, missing-player and last-player-returned-to-bench Start rejection; illegal enemy area, occupied cell and enemy dragging rejected.
2. Buy twice: gold10→7→4, bench5→6→7, purchased slots and visible new tokens. Rebuy and a third purchase on a full bench leave the complete state unchanged.
3. Sell purchased unit-6 from bench: gold6 and token/HP view removed. Reroll: gold4, all five available slots and independently verified RNG sequence. Keep purchased unit-7.
4. Deploy unit-7 plus two original units; deploy then sell unit-1 from board: gold6. Both sales remain absent in future rounds.
5. Observe five actual battles and match visible results to simulation. Repeat Start after tick40 cannot reset combat; combat and settlement economic input rejected. Result-page idle/input does not grant a second reward. Double Continue changes the round exactly once.
6. On every Continue, preparation and purchased IDs remain, combat=null, effects/tweens/drag clear, HP bars hide, all tokens restore position/visibility/alpha. On every Start, actual combat equals a fresh snapshot at its observed tick. Round2 repositions unit-7 with real dragging before fighting.

| Completed round | Result | Final tick | Gold before / after | Next shop generation |
| --- | --- | ---: | --- | ---: |
| 1 | playerWin | 126 | 6 / 11 | 3 |
| 2 | playerWin | 141 | 11 / 16 | 4 |
| 3 | playerWin | 141 | 16 / 21 | 5 |
| 4 | playerWin | 141 | 21 / 26 | 6 |
| 5 | playerWin | 141 | 26 / 31 | 7 |

The main path ends at **round6 preparation, gold31, five unique result records, generation7**. Independent BigInt arithmetic checks each shop and RNG advancement. Further checks after this uninterrupted path cover 390×844 viewport/touch deployment and reroll (gold31→29), Debug New Match, exact insufficient-money rejection, and isolated startup fixtures for missing-enemy/missing-both UI messages. Fixtures reload only after the five-round path is complete and are not used to satisfy its success conditions.

Production preview separately verifies actual built-bundle startup, HUD, five slots, purchase rendering and D/E shortcuts. Both pageerror and console.error must be empty. Traces, screenshots and JSON including source SHA, dirty flag, operations, per-round ledger and failure evidence are saved even on failure.

Initial verification uncovered a missing favicon request in preview and a test context that had not enabled touch capability. Added a local empty data favicon to remove the404; enabled `hasTouch` before creating the browser context. Final independent evidence review also caught a purchased unit landing in row5 when dragged to row4: Phaser's threshold-delayed drag offset included the initial pointer movement, and release used the token's previous position. Preview and release now both use the actual camera-transformed pointer position; every successful browser deployment asserts the exact requested hex. The corrected first battle ends at tick126 (the earlier incorrect-position run ended at131). No console error is filtered out. Earlier partial passes are superseded by the final exact-placement run.

Reproduce with:

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:browser
npm run test:preview
```

For a system Chromium, set `CHROMIUM_PATH=/usr/bin/chromium`. Evidence defaults to `artifacts/m2-browser` and `artifacts/m2-preview` (gitignored); `M2_EVIDENCE_DIR` overrides it. The legacy `verify-m1-browser.cjs` entrypoint forwards to this expanded regression suite. Desktop-extension clean-commit evidence is at `/tmp/cat-m2-desktop-final` and `/tmp/cat-m2-desktop-preview-final`; those JSON records identify the exact tested SHA and supersede the earlier M2-only and dirty intermediate runs.

## Desktop high-frequency acceptance (M2_PLAN section13)

The coordinator appended the acceptance section and owns BoardScene/browser integration. Agent A added only three MatchSession tests; the independent reviewer remained read-only. No simulation API, prices, RNG algorithm or excluded feature changed.

D/E use native keydown so each OS repeat is processed in DOM event order alongside pointer input, without Phaser's frame-queued keyboard repeat filtering. Existing synchronous MatchSession commands own all changes. There is no timer, debounce or animation completion gate. Modifier/composition/editable input is ignored; shutdown removes the listener. E checks current token geometry, honors a dragged token and the display order of overlapping hit areas, rejects enemy hover, then uses an explicit selection only on empty space. Successful sales clear any previous selection and drag so repeated E or a late mouse release cannot sell/deploy the deleted instance or an unrelated old selection.

`scripts/verify-m2-desktop.cjs` runs inside the main Chromium suite after five rounds and touch checks, using the same naturally earned gold29. Three uninterrupted chains `D → buy → deploy → E → D → buy` cost8 each: **29 → 21 → 13 → 5**. There is no reset, injected gold, synthetic DOM input or artificial delay between operations in those chains. Every step compares the full state against a separate ledger with BigInt RNG, checks first-free bench placement/ID allocation, exact board positions, token count/visibility, and visible gold/shop. A keyboard observer records trusted events and repeat flags, checking that successful D/E already committed gold/RNG/shop during that same event dispatch.

Additional real-input checks cover hover over another selected unit, enemy hover with an old selection, empty-space selection fallback, repeated E, overlapping neighbor hit areas, E and D during a drag followed by release, Ctrl/Meta/Alt shortcuts, ignored F, editable input, full bench with enough gold, purchased slots and insufficient funds. Separate post-match reset fixtures send eight keydowns without keyup and eight rapid independent D presses: in each sequence the first five refresh exactly once, and the last three preserve the entire state. The main five-battle path also rejects D/E in combat and settlement. The JSON `desktop` section preserves every checked state and real keyboard event; screenshot/trace evidence accompanies it.

Review caught a hover-order mismatch at overlapping rectangular token hit areas: clicking selected the last-drawn token while E searched creation order. Dragging can also move an older token forward in the display list, so simply reversing creation order is insufficient. The handler now uses Phaser's own click sorting on the current hit candidates. Real overlapping-area clicks followed by E assert the same target both for a newly drawn instance and an older token brought forward by dragging. The final exact-SHA browser evidence and CI must include both regressions; a pass from before those corrections is insufficient.

## GitHub CI and release gate

The existing test-and-build job remains. The new chromium-match job installs locked Playwright1.63.0 and its matching Chromium, builds, runs the five-round real browser suite and production preview, and uploads the complete artifacts even on failure. It has a 15-minute timeout; individual battles allow75 seconds for the existing60 logical-second maximum. No clock acceleration is used.

The final acceptance report must link the successful workflow run for the exact final implementation commit and record local browser SHA/clean-tree evidence. Completion requires both jobs passing and final independent review, not only this document or an intermediate run. The implementation is delivered on `feat/m2-match-loop`; no PR or merge is required for the branch's push-triggered CI.

## Limits

- Browser playthroughs exercise Victory; loss/draw continuation and single settlement are covered by real pure-simulation tests. Other browser engines and physical touch devices were not tested.
- The deterministic local demo has fixed enemies, no content growth and no persistence. Selling all units then spending all gold can deliberately strand a match; Debug New Match recovers. The normal five-round path requires neither reset nor rescue rules.
- The 960×800 layout is intentionally minimal. Screenshots verify five shop cards fit between board and bench; mobile checks use Chromium touch simulation.
