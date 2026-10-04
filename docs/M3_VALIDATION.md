# M3 validation record

The implementation follows the checked-in `M3_PLAN.md` and merged M2 baseline `169f28e15e065aaa4c054dfcfd4739c7f110970b`. Rules are `schemaVersion=3`, `rulesVersion=m3-v1`, `contentVersion=m3-content-v1`. This document separates the reproducible acceptance design from final execution evidence; a candidate is accepted only when the clean product SHA, local suites and corresponding CI are recorded below.

## Implemented scope

Match remains the only authority for gold, XP, level, population, roster, RNG, shop and player HP. Commands commit atomically and rejected commands retain the original state reference. F buys four XP for four gold; natural XP, income and player damage settle together exactly once. Five cost tiers use a level-dependent ten-word shop draw; buying a third copy merges in the same transaction, including a full bench and cascading to three stars. Retained IDs/positions are deterministic and consumed IDs are never reused.

Combat remains an isolated 50 ms fixed-tick snapshot with existing targeting, BFS and movement reservations. Resolved star-scaled stats and abilities enter the snapshot at creation. Committed casts/attacks resolve simultaneously through physical/armor or magic/MR mitigation, shields, HP loss and survivor Mana gains. Rendering consumes events and never calculates damage or rewards. Defeat or draw reduces player HP; lethal settlement directly enters Game Over. A deliberately empty deployment concedes at tick zero, paying HP for the normal income/XP instead of soft-locking an empty, poor roster.

No traits, items, augments, anomalies, full season data, shared pool, PvP, critical hits, lifesteal or formal art were added. Eleven authored units and a deterministic enemy schedule supply the playable prototype content.

## Ownership and independent checks

The coordinator owns the public types/contracts, Match orchestration, enemy schedule, content cross-validation and CI. A owns growth helpers, shop, unit content and star calculations; B owns Combat effects; C owns presentation/input; D owns independent economy/HP/RNG oracles, Match integration/replay and the main Chromium runner. The coordinator explicitly handed the desktop browser module to C after its UI work was ready; D reviews its independent-ledger use and the combined evidence. No file has two active writers.

`tests/fixtures/m3/oracle.cjs` does not import production helpers or data tables. It independently fixes the probability/catalog/XP tables, uses BigInt for LCG arithmetic and checks prices, card-equivalent value, purchases/merges, level progression and per-round HP. The same acceptance ledger is used against actual browser input. The offline fixture generator calls the real product API only outside the browser; it supplies exact battle tick expectations and a finite legal action sequence, never writes the live game and never shortens the clock.

Automated suites preserve the M2 geometry, targeting, simultaneous death, isolation, terminal no-op, ID allocation and synchronous D/E guarantees. Added coverage includes all cost/star price boundaries, cap and failure priority, full-bench upgrades, three-star cascades, per-packet rounding, shield expiry/absorption, Mana/cast ordering, Game Over guards, JSON restore at every tick, rejected-command insertion, content versions and the exact production browser paths. Unit boundary fixtures are labeled as such; they do not stand in for normal browser growth or Game Over.

The additional seed6 transcript in `tests/m3-long-growth.test.ts` runs 61 accepted commands over eleven rounds using ordinary resources: a natural three-star in round3, level7 in round10, purchases across all five cost tiers, and a purchased five-cost oracle deployed and casting in round11. It finishes alive at HP12/gold5. Rounds8–10 deliberately sell the developed roster and concede empty deployments to pay HP for income/XP; the other eight rounds are nonempty battles. An independent resource/card/HP ledger and a second replay restored through JSON after every command and tick compare complete final state and CombatEvents. This is simulation evidence, not an additional Chromium route.

## Default-seed production routes

`node scripts/generate-m3-fixture.cjs` reproduces both routes with seed42 and the ordinary initial 10G/100HP/level3 roster. The growth route uses 28 preparation actions. It buys a natural two-star sentinel, sets up two more one-star copies, then in round2 executes an uninterrupted `D → third-card upgrade → F level-up → fourth deployment → D → higher-cost purchase → E → D`. Two legal one-cost sales fund an arcanist from a tier that was unavailable at level3. That three-cost unit is deployed and casts its magic area ability. Two more mixed chains occur during rounds4/5. No reset, reload, injected resources or fixture state occurs within this eight-round route.

| Growth round | Result | Final tick | Gold after | Level / XP after | Player HP |
| --- | --- | ---: | ---: | --- | ---: |
| 1 | playerWin | 162 | 12 | 3 / 2 | 100 |
| 2 | playerWin | 106 | 5 | 4 / 2 | 100 |
| 3 | playerWin | 243 | 10 | 4 / 4 | 100 |
| 4 | playerWin | 243 | 9 | 5 / 0 | 100 |
| 5 | enemyWin | 485 | 8 | 5 / 6 | 88 |
| 6 | playerWin | 304 | 10 | 5 / 8 | 88 |
| 7 | enemyWin | 282 | 15 | 5 / 10 | 72 |
| 8 | enemyWin | 282 | 20 | 5 / 12 | 56 |

Continue reaches round9 preparation with five deployed units. The desktop acceptance module then spends only that naturally earned balance on three more `D → buy → deploy → E → F` chains: 20→14→8→2. Screenshot capture occurs after a complete fast chain, never between its inputs. Read-only assertions between actions are allowed; there is no timer, animation wait or frame throttle used to hide latency.

The terminal route starts a separate normal match and deploys only the initial ranger. It loses nine real, nonempty battles, ending at round9 Game Over, HP0, gold55, level5/XP2. Final ticks are 101/101/71/71/36/36/26/26/26 and HP is 94/88/80/70/58/46/30/14/0. The last record distinguishes raw damage from clamped HP loss. Repeated D/F/E, buttons, deployment, Start and Continue leave the terminal state unchanged; New Match restores the complete original seed42 state and clears rendered counters/effects.

Both dev and the actual production preview execute these complete paths. Preview does not import `/src/` modules in the page. Additional 390×844 real CDP touch input buys/merges, presses F twice to reach level4, drags to an exact hex, starts a real battle, and continues once without repeating gold/XP/HP settlement.

## Browser assertions and evidence

Every observed combat tick is compared against the corresponding offline pure state; every emitted CombatEvent is observed in order through the scene's bounded read-only consumed-event history. The history is an observation of rendered events, not a dispatch hook. Actual rendered star text, names, symbols, tier prices, HP/Mana/shield meter values and widths, population, XP, result and player HP are checked against the live state. Combat/settlement inputs, stale selections and repeated Continue are tested. Every Continue removes old effects/drag state and rebuilds clean bars for preparation.

The desktop matrix covers trusted native keydown and OS repeat flags; same-dispatch state commits; resource exhaustion followed by thirty additional D/F attempts; hover precedence versus old selection and enemy hover; overlapping hitboxes; D/F/E during dragging with late release; population previews; modifier/editable/IME exclusions; and scene listener lifecycle. Separate dev startup fixtures exercise full bench with and without a third-copy merge, a cascading three-star purchase, level9 F rejection and scene restart. These isolated fixtures intercept only bootstrap source in their own page and are explicitly recorded. Production debug stays read-only, and neither production route is satisfied using them.

Each run saves source SHA, dirty and untracked status, versions, seed, browser/Node versions, complete operation ledgers, trusted/repeat events, per-round result ledgers, screenshots, Playwright traces and console/page/server logs. Console errors and page errors are not filtered. Failure also saves the last snapshot and a trace. An earlier dirty exploration or earlier SHA is not final acceptance evidence.

## Reproduction and release gate

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run test:preview
```

A preinstalled browser can be selected with `CHROMIUM_PATH=/usr/bin/chromium`. `M3_EVIDENCE_DIR` selects an evidence directory; defaults are ignored `artifacts/m3-browser` and `artifacts/m3-preview`. `M3_URL` can select an already running server. Historical M1/M2 browser entrypoints forward to the current suite. CI retains test/build and runs dev/preview browser matrix jobs, uploads artifacts with `if: always()`, and keeps a 20-minute job and 75-second battle timeout at the original clock rate.

During development, independent review caught scene-restart view maps retaining destroyed Phaser containers and a cascade animation assuming every intermediate survivor still existed after the full purchase transaction. Fixes remain within the presentation owner; isolated real-browser fixtures cover both. A repeated Continue also exposed an inaccurate generic phase message; phase-specific feedback fixes the confusing preparation-state prompt.

## Final execution record

On 2026-10-04 the clean product candidate `120d13f7e417f1b6a3a6b6b24cd01462b103e043` passed all 303 tests in 22 suites, type checking, production build and diff checks. Both complete local Chromium commands exited zero with that exact recorded SHA, `dirty=false` and empty `gitStatus`; the working tree remained clean throughout these runs. Local tools were Node24.19.0, npm11.9.0, Playwright1.63.0 and system Chromium151.0.7922.173.

| Local run | Complete acceptance | Evidence directory |
| --- | --- | --- |
| Dev, port5173 | 8 growth rounds, 9 terminal rounds, desktop206 steps, 4 isolated boundary fixtures, touch battle/Continue; passed | `/tmp/cat-m3-120d13f-dev` |
| Production preview, port4173 | Same growth, terminal, desktop and touch routes; no startup state fixtures; passed | `/tmp/cat-m3-120d13f-preview` |

Each `results.json` records 239 ledger actions, three naturally funded desktop cycles, 191 trusted desktop keydowns including 66 repeats, and 41 screenshots. Both runs observed actual Mana, shields, physical and magic packets, casts and shield absorption. Growth finished its eight rounds at HP56/gold20; the separate ninth loss reached HP0/gold55 and rejected terminal operations before New Match. Touch input reached level4, fought a real 545-tick battle ending HP96/gold6, and continued to round2 without repeating rewards or damage. Each directory contains `growth-desktop-trace.zip`, `terminal-mobile-trace.zip`, screenshots, server log and the full result ledger. Dev's four fixture error arrays and both main interaction error arrays are empty. D independently inspected the ledgers and real growth, Game Over and mobile screenshots, and found no remaining blocking product issue in its final Match/Combat/growth/input review.

[Candidate CI run37211119117](https://github.com/catfish-xn/cat/actions/runs/37211119117) completed successfully for test-and-build plus both dev and preview browser jobs. CI used Node22 and downloaded Playwright Chromium153.0.8010.12 (build1243). Its checkout is the GitHub PR synthetic merge SHA `831a91b650d74eec943d0767db2b90de6f4ead13`, not the local product SHA. The coordinator fetched that ref and verified both complete Git trees equal `5072609d33207dc3fb098b83c684095c8acd3a92`. Downloadable CI evidence is available in the [dev artifact](https://github.com/catfish-xn/cat/actions/runs/37211119117/artifacts/11307205890) and [preview artifact](https://github.com/catfish-xn/cat/actions/runs/37211119117/artifacts/11306209556).

Two evidence qualifications are explicit. Concurrent local offline Vite fixture generators printed a host HMR-port24678 collision; the actual application servers on5173/4173 and both complete acceptance runs continued successfully. This host diagnostic is distinct from application console/page errors. Also, the candidate runner installed its main-page error listeners only after navigation and debug readiness, so its empty error arrays establish that scope; isolated dev fixtures already listened before navigation. The following harness-only change moves the main error listeners before each navigation without changing assertions, input, clocks or product code. The delivery commit contains this listener improvement and this evidence document; all product code remains the tested candidate. The coordinator reruns the complete local and CI gates for that final delivery SHA and records those exact final links/results in [PR4](https://github.com/catfish-xn/cat/pull/4). The candidate evidence above must not be misrepresented as a completed run of a later SHA.

## Limits

The demo is single-player, deterministic and intentionally small. Enemies follow fixed authored templates and do not adapt to the player's roster. Browser acceptance uses Chromium and emulated touch; physical touch devices and other browser engines are not claimed. Rules/schema/content mismatches are rejected by the test replay tooling; there is no replay or save/load product UI. Numerical balance and visual polish remain prototype quality. The existing Phaser bundle-size warning remains unrelated to M3 correctness.
