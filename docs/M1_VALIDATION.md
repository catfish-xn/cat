# M1 validation record

Validated on 2026-10-04 (Asia/Taipei). The starting baseline is PR #1's merge commit `33428d334435a016224e5ddbefff650dc8b17f89`, fetched from origin/main. It contains the 7×8 board, player/enemy teams, preparation restrictions, fixed-order neighbors, hex distance, and GitHub Actions CI. Baseline: 23 tests passed and build passed.

## Preserved plan

`M1_PLAN.md` is preserved byte-for-byte, SHA-256 `3e9d666dd267de2f52b941bd83a51edd21250d505ee02d70e814bf9fa087316f`. Its old baseline-blocker notes describe the earlier planning round. The user's subsequent instruction authorized implementation after PR #1 merged; the actual baseline above resolves those historical blockers.

## Architecture and ownership

- Main coordinator froze `combat.ts`, `combat-types.ts` and `COMBAT_CONTRACT.md`, verified the contract, and integrated actual diffs sequentially.
- Subagent A (`combat_simulation`) used `/workspace/cat-combat-sim` / `feat/m1-simulation`, implemented only the private tick algorithm and simulation tests.
- Subagent B (`combat_rendering`) used `/workspace/cat-combat-render` / `feat/m1-rendering`, implemented the Phaser view, pure UI session/clock and lifecycle tests.
- Subagent C (`independent_review`) remained read-only, independently reviewed contract, simulation and integrated rendering, and independently reran the tests/build. At most three subagents worked concurrently.
- Simulation does not import rendering, Phaser, DOM, random or wall time. Events are outputs, never animation-driven inputs. Preparation and combat have separate snapshots. Simultaneous damage, stable ID ordering, BFS occupancy/reservations, terminal immutability and 50 ms ticks are documented in the frozen contract.

## Automated evidence

Integrated application revision `84e095f` passed all 49 tests across six files and `npm run build` (including TypeScript typechecking). Existing 23 tests remain unchanged and pass. The coordinator and independent reviewer both ran the integrated checks.

| Suite | Count | Coverage |
| --- | ---: | --- |
| Existing board/deployment/layout | 23 | Original deployment restrictions, board geometry and input coordinate behavior |
| Combat contract | 4 | No bench, deep preparation isolation, immutable input, one 50 ms step, fresh state, initial/finished results |
| Combat simulation | 17 | 1v1, 2v2, distant/cross-zone movement, no overlap, reservation conflicts, occupied-cell avoidance, BFS tie/bypass/blocking, target ties/death, range, cooldown, simultaneous damage/kill, timeout/elimination precedence, terminal no-op, full replay and array permutation equality |
| Combat session | 5 | Deployment/Start guards, reset positions and full units, second-match HP/death/cooldown isolation, accumulator cleanup, invalid deltas, equal-time frame partitions, tick-zero result |

## Real browser evidence

Chromium `151.0.7922.173`, Playwright, 960×800 viewport, actual mouse drags/clicks against the Vite app. No simulation state was injected or edited. Read-only Phaser state observations verify visual interaction; a separately created simulation checks the observed Start tick, because real rendering may already have advanced beyond tick 0.

The reproducible script is `scripts/verify-m1-browser.cjs`. With Playwright installed externally, run:

```sh
npm run dev -- --host 127.0.0.1
# In another terminal:
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-m1-browser.cjs
```

Optional variables: `CHROMIUM_PATH`, `M1_URL`, `M1_EVIDENCE_DIR`. This environment uses `/opt/codex/cua_node/lib/node_modules/playwright` and `/usr/bin/chromium`; no repository dependencies were added or upgraded. The script needs local browser/socket permissions.

Passed checks:

1. Reject player drag into enemy deployment zone and reject occupied-cell deployment.
2. Deploy three player units by real dragging.
3. Click Start; bench stays out of combat, repeated Start does not reset the clock, combat drag cannot deploy.
4. Observe legal movement, attacks, monotonically decreasing HP and deaths; living units never share a cell.
5. First battle displays Victory (`playerWin`, tick 121).
6. Click Reset; every unit returns to its Start location, all tokens visible, combat null, HP bars hidden, tweens/effects zero.
7. Drag a unit to a different preparation hex and Start again; observed state equals a fresh battle at the same logical tick.
8. Second battle displays Victory (`playerWin`, tick 141), followed by another successful Reset.
9. No JavaScript page errors.

Evidence files are generated in `/tmp/m1-browser`: `results.json`, `preparation.png`, and each round's combat/result/reset screenshots. Both rounds use actual elapsed browser time. Draw and enemyWin rules are covered by automated tests; this browser scenario verifies Victory. Other browsers and physical touch devices were not tested in this M1 run.

## Review findings and limitations

No product-code blocker was found by independent contract, simulation or integrated rendering review. The reviewer suggested strengthening the browser repeated-Start clock assertion; the coordinator implemented it. Browser harness corrections also removed a tick-zero timing assumption and restricted Reset lookup to the interactive button rather than instructional text. These were verification-script fixes, not concealed application failures.

The existing Vite chunk-size warning remains; no unrelated bundling or dependency changes were made. No shop/economy/skills/items/traits or other excluded systems were added.

## Release evidence

GitHub CI must pass on the final PR HEAD before the coordinator reports M1 complete. The PR and final response carry the exact final commit and CI run link; no old baseline/branch check is used as final CI proof. No automatic merge is authorized.

## PR #2 pre-merge Start eligibility correction

The preparation Start command now calls pure simulation `validateCombatStart`: at least one board player and one board enemy are required. Bench units do not count. Rejected commands leave preparation, combat, reset snapshot and clock unchanged; the UI displays a persistent reason and repeats it on a rejected click. Direct `createCombat` empty/single-sided terminal semantics and all other M1 rules are unchanged.

The complete updated suite has **59 passing tests** (seven test files), and build passes. Seven validator cases cover empty board, both on bench, each missing side, bench-only presence and a valid 1v1 board. Session tests cover rejection without calling createCombat, deployment enabling Start and returning the last player to bench disabling it again. Independent review also ran all 59 tests and build with no blocker.

The browser script now additionally checks initial missing-player rejection, repeated invalid Start, and the last player returning to bench using real clicks/drags. The existing two-match flow remains. Missing-both/missing-enemy UI reasons are tested in a separate startup fixture that omits enemies from the initial data (the normal UI cannot remove enemies); live game state is not edited. This fixture is isolated from the normal two-round verification. Final browser evidence and CI are linked in the updated PR.
