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

Final clean-SHA local results, evidence directories, workflow links and exact test counts are recorded here after the candidate is committed and all suites finish. The expected tables above are independently checked offline fixtures, not a claim that an unfinished browser run passed.

## Limits

The demo is single-player, deterministic and intentionally small. Enemies follow fixed authored templates and do not adapt to the player's roster. Browser acceptance uses Chromium and emulated touch; physical touch devices and other browser engines are not claimed. Rules/schema/content mismatches are rejected by the test replay tooling; there is no replay or save/load product UI. Numerical balance and visual polish remain prototype quality. The existing Phaser bundle-size warning remains unrelated to M3 correctness.
