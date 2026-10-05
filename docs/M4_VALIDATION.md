# M4 validation record

Base: `133a41b4ef4257bee1b4bd458103393177fdf93e` (merged M3). Scope, rules and gates are [PLAN](../M4_PLAN.md), [RULES](../M4_RULES.md) and [ACCEPTANCE](../M4_ACCEPTANCE.md). This is an original authored S13-style engine slice, not Riot content.

## Reproduction and evidence

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run test:preview
node scripts/compare-m4-evidence.cjs
```

Local execution uses Node 24.19.0 and system Chromium (`CHROMIUM_PATH=/usr/bin/chromium`); GitHub CI uses Node 22 and Playwright's pinned Chromium. CI has unit/build plus independent dev/preview matrix jobs. Each browser job uploads `m4-chromium-<mode>-<sha>` even on failure. The exact commit, dirty status, versions, seed, duration and browser version are embedded in the artifact manifest; a local dirty-tree run is not represented as an execution of the base commit.

Each browser artifact contains `report.json`, `manifest.json`, the 52-command `full-match-transcript.json`, complete `round-ledger.json`, `build-chain.json`, checkpoint state JSON/screenshots, each battle's full state/events, native input logs, page/server logs and desktop/touch traces. Milestone PNGs retain the canvas; traces retain native actions and DOM snapshots without a redundant continuous screenshot filmstrip. The frozen [full-match golden](../tests/fixtures/m4/full-match-golden.json) locks every command and all 12 round state/event hashes. It is a regression baseline, not an independent mathematical oracle. Independent price/XP/shop/HP ledgers and hand-calculated effect/packet battles separately verify the rules.

## Normal full Match

The same seed42 Match remains active from its ordinary 5 units, 10G, 100HP and two scheduled components through Game Over. No browser state mutation, fixture switching, reload, injected resource, skipped tick or accelerated clock is used.

| Acceptance node | Concrete evidence |
| --- | --- |
| A4.1–3 | Ordinary shop purchases upgrade Mystic/Ranger to two stars; board activates Conduit 2. Scheduled blade+rod become item-3 Spell Edge, equipped to unit-3 Mystic. Trait and equipment checkpoints retain exact IDs and receipts. |
| A4.4–6 | R2 Study Circle and R5 Opening Guard; three real D→buy→F→E chains in R2/R4/R6. Population and ordinary purchases raise distinct Conduit to tier 4. |
| A4.7 | R7 locks unit-3, pays 2G for an Anomaly reroll and binds Cycling Core from the next three offers. Old offer release cannot select after reroll. |
| A4.8–9 | R7 and R8 retain the same binding and all four source kinds. Mystic has AD 159 and ability amount 424, real Mana/casts and Cycling Core procs. Both complete ledgers have contiguous per-combat sequences starting at zero. |
| A4.10–11 | All 12 battles have nonempty teams. HP goes 100→84→68→52→32→12→0 from R7 onward. R12 settles at tick 98 with 44G; Game Over locks commands, then normal New Match resets all persistent and transient strategy state. |
| A5/A6 | Trusted native key repeat, immediate dispatch observations, 30 rejected D/F each after normal resource exhaustion, unit/item drag success/failure/late release, mixed pointer ownership, touch cancellation and natural modal activation. Touch independently starts normally and completes R8 at 390×844, with 844×390 layout/cancellation checks. |

R7 final state hash: `01ad362cad5c352af0a3d211ce4b181b07e7a4b1c0f66a84449bd88180eebe50`.
R8 final state hash: `873e1ced2538988a557933674b5bc132242911c22894e7b040f15ae37f63fff9`.
R12 final state hash: `86faed06f65e3eb43879f2c0c0bb8c08b615ca53262e6738b651cd28dea93b8b`.

## Test matrix index

| Gates | Executable coverage |
| --- | --- |
| T01–02 | `m4-strategy-snapshot`, `m4-effects`, `m4-effect-combat` |
| T03–05 | `inventory`, `upgrades`, `match-economy`, `m4-match-strategy` |
| T06–10 | `m4-match-strategy`, `m4-rewards`, `match-lifecycle`, `match-contract`, `m4-review-regressions` |
| T11–13 | `m4-effects`, `m4-effect-combat`, `m4-content-combat`, original `combat-*` tests |
| T14–16 | `rng`, `shop`, `match-replay`, `m4-serialization`, `m4-review-regressions` |
| T17 | `m4-content`, `m4-content-combat`: all 20 items, 8 augments and 8 anomalies enter a real snapshot and combat; every trigger fires with source provenance. |
| T18 | `m4-multi-seed`: 24 fixed seeds, dual command/tick runs, per-round validated restore, resource conservation, bounded terminal matches and two bound battles. |
| T19 | Existing board/deployment/progression/shop/combat/session tests plus `m4-long-growth`: legal seed0, R3 three-star, all costs purchased, R11 five-cost Colossus casts an 800 shield and finishes at 12HP. |
| A3 | `match-replay`: every command/tick JSON restore and rejected-command insertion, all states/events/RNG/IDs/sequences compared. |
| A4–A7 | `verify-m4-browser.cjs`, `verify-m4-interactions.cjs`, `m4-session-observer`, `m4-ledger-bound`. |

A hand-calculated four-source battle in `m4-content-combat` finishes in 62 ticks with 43 events: Forge + Echo Rod + Heavy Hands + Cycling Core, four attacks of 165, then independently computed 150 physical and 70 magic packets. The legacy zero-modifier Combat suite retains M3 numerical behavior.

## Review and integration decisions

Core reviewer and independent UI reviewer passed with no unresolved P0/P1/P2. Their findings produced 15 dedicated restore/command/order regression tests and 59 restore cases. Fixed issues included malformed deployment targets, invalid restore counters/history/snapshots, enemy identity collisions, zero-amount shield expiry ordering and mixed-pointer equipment takeover. The last UI issue was independently reproduced and rechecked in real Chromium after the fix.

Phaser continues to own the board; the new strategy panel uses native DOM/CSS for readable scrolling content and real 44px touch controls, without another UI framework or authoritative store. See [PLAN P7](../M4_PLAN.md#p7-ui-拆分范围). Absolute round remains the authority; the three-round stage label is derived. The authored content digest is `fnv1a32-utf16:a4b8a029` under schema4 / m4-v1 / m4-slice-v1.

The capacity fixture has 9 three-star player units, 6 capped-growth enemies, 27 equipped items, two augments and one anomaly. It finishes in 324 ticks with 955 events (236,857 UTF-8 bytes); state plus ledger is 367,041 bytes. Tests preserve all tick-zero events, verify every sequence, prove deep-copy isolation and clear the ledger at Continue/New Match.

The M3 base passed 303 unit tests, build and its real Chromium dev regression before final M4 acceptance. A development run interrupted by an intentional UI HMR change is retained as diagnostic evidence, not counted as a passing gate. Offline route generation disables its unused Vite WebSocket transport so parallel tests cannot compete for port 24678.

## Final execution results

The initial M4 integration unit run passed all 552 tests across 36 files (53.27s), and its build including TypeScript passed. Core and UI reviewers passed. Local dev and production preview both completed the full desktop Match, touch through R8 and interaction regressions with zero console/page errors: 890.434s and 879.625s. Their 20 desktop/touch round records and all 170 deterministic UI checkpoints matched exactly; each recorded 131 trusted D/F/E keydowns.

The final submitted runner additionally retains canonical JSON hashes, explicit replay headers/build-chain evidence, a live four-source/Mana/Ability screenshot and the later independently verified merge/held-D/scroll regressions. The displayed stage label is derived without a rules change. The final commit is rechecked by all three GitHub CI jobs; the authoritative SHA-specific results and artifacts are available from the PR checks and [repository Actions](https://github.com/catfish-xn/cat/actions). A successful older commit is never substituted for the submitted revision.

The measured local integration pass was about 15 minutes with a continuous screenshot filmstrip. The final runner keeps explicit milestone images plus action/DOM traces, avoiding duplicate filmstrip storage. Browser jobs allow 30 minutes including install/build, full desktop Match, normal touch through R8, supplemental interaction battles and artifact upload; simulation always remains 50ms per tick.

A later local preview run exposed a harness race after restoring a short viewport: the script read button coordinates before Phaser FIT had caught up, then clicked after the scale changed. The harness now waits for the canvas DOM bounds to match its parent’s fitted, centered geometry and two animation frames before reading coordinates. It neither retries New Match nor changes simulation time/state. An independent preview check passed 48 resize → single-click resets; the permanent desktop gate repeats 12 such cases with gold perturbed first so a missed reset cannot pass. The failed run remains diagnostic evidence, and the final revised harness is rerun in both modes and CI.

The stricter FIT check then exposed a real mobile orientation defect in Phaser: its orientation handler refreshes with the previous parent size, records the new parent size only afterward, and can leave a 390×325 canvas centered inside a 960×800 host indefinitely. This was independently reproduced with `isMobile`, real orientation changes and tracing. The rendering entry point now observes host size changes, coalesces them into one animation frame, reads current parent bounds before refreshing FIT/input bounds, and disconnects/cancels on game destruction. The simulation clock and state are unaffected. The browser geometry assertion remains strict; earlier green CI on `7c0b256` is not the final revision gate.

## PR #5 follow-up: three reproduced boundaries

The external review of `2463830ae387f0530cb7e00317f47f835b1ec604` found three P2 defects after the initial integration checks. Before patching, trusted Chromium touch input reproduced a canceled bench-unit drag deploying to `(2,5)`, and two taps on the second R2 Augment card targeting first the choice and then `mobile:start-combat`, reducing HP from 94 to 88. Array-wrapped valid definition IDs also passed several restore boundaries. These findings supersede the earlier review's conclusion for those cases.

| Boundary | Fix and permanent regression |
| --- | --- |
| Choice confirmation and repeated touch | After confirmation, an empty transparent pointer shield absorbs the remaining tap burst and stays until 400ms without another pointerdown. Reset/destruction clear its timer. This is rendering input protection only: Match has already entered preparation, and native D/F/E remain synchronous. Native CDP double/triple taps at the card/Start overlap must choose exactly once, retain 94HP and never create Combat; recorded repeated pointer targets must be the shield. D/F/E and a fresh Start are checked afterward. |
| Unit touch cancellation | Capture-phase cancel handling clears the shared gesture before Phaser can submit deployment; `dragend` also rejects canceled pointers. Native `touchCancel` at a legal board destination must preserve the entire Match, release the gesture and restore the token's bench coordinates. The identical trajectory ending normally must deploy. Canvas gesture defaults use the existing CSS `touch-action: none` with Phaser touch capture disabled, so its cancel handler can release the pointer without an invalid `preventDefault()` on a noncancelable native event. Existing item, mixed-pointer, scroll, resize and late-release checks remain. |
| Definition ID coercion in restore | Persistent definition references now require a nonempty string before content-table membership checks. Reward serial parsing also checks the input type first. Sixteen added tests reject arrays wrapping legal unit/shop/item/Augment/Anomaly/receipt/Combat definitions, test object and JSON inputs, preserve valid roundtrips and reject separately wrapped copies before trait counting. Resolved Combat definitions remain checked against the canonical strategy snapshot. |

The revised unit suite passes 568 tests across 36 files, including 75 serialization tests. These changes preserve schema4, content digest, RNG streams, modifier rules and the full-match golden. The revised browser runners retain the complete Match through Game Over/New Match and the independent touch route through R8; boundary tests supplement that route. Intended subsequent pointer actions wait for the shield to finish, while the native repeated-tap regression deliberately does not wait. Dev/preview manifests, cross-mode comparison and the new SHA's PR checks are the final gates; earlier successful runs are not substituted for that revision.

CI on the first follow-up (`079419e`) passed all gameplay and interaction assertions, then failed the strict zero-console-error gate because Phaser tried to cancel a native noncancelable `touchcancel`. The capture configuration above fixes that path; the console gate is neither filtered nor relaxed. That run and the interrupted local browser runs remain diagnostic evidence, and the corrected revision must complete the entire gate again.

All six CI checks subsequently passed on `80461d0`. Its local traced runs exposed a test-driver timing error: full debug snapshots and DOM queries could take longer than the shield's 400ms before the script sent D/F/E. The final test sends trusted native D/F directly after the taps, records the confirmation state before the first key in a capture listener, and records committed states in a later bubble listener within each native dispatch. It requires the first D to arrive while the shield is active, verifies exact D/F/E costs and full state continuity, and logs each key's shield state. Product timing is unchanged; the final revision is rerun locally and in CI.

## PR #5 second follow-up: native canvas input paths

The external recheck of `d4bf8521435d611c7fc52388abe1cbcb566f3b5a` accepted unit cancellation and string-only definition references, but reproduced two remaining P2 input defects. Its six green CI checks did not cover these paths. Local trusted Chromium input reproduced both before this patch: at 1440×1000 with touch support, a single canvas Reroll spent 4G and a single Buy XP spent 8G; at 390×650, both a touch double tap and a mouse double click on the Study Circle/canvas Reroll overlap spent another 2G after choosing. The second contact targeted the still-visible dismissal shield.

Canvas capture listeners now reject only mouse events whose native `sourceCapabilities.firesTouchEvents` identifies them as touch-derived. This mirrors Phaser's existing window-entry filter at its missing canvas entry. Genuine mouse events, independent touches and keyboard repeat have no time gate. Listener cleanup follows game destruction. Phaser touch capture remains disabled so the signed-off cancellation path still releases a noncancelable `touchcancel` without calling `preventDefault()`.

The choice dialog and its transparent dismissal shield now stop the native mouse and touch event families that Phaser consumes at window, in addition to pointerdown and click. DOM choice activation and native D/F/E remain available. The existing 400ms pointer-burst guard is unchanged.

[The permanent native input boundary runner](../scripts/verify-m4-input-boundaries.cjs) is invoked by both dev and production preview acceptance. It uses a touch-capable desktop context, records trusted touch and compatibility mouse events, and compares entire Match states to separately executed model commands. It checks single canvas Reroll/XP touches; three distinct rapid touches and real mouse clicks; native D-repeat/F/E; and both touch and mouse double selection at the real 390×650 card/canvas overlap. Selection must equal exactly one choice command, including gold, shop generation, RNG, receipts and all other state. After the shield ends, a fresh click at that same coordinate must execute exactly one reroll. Its trace is `input-boundary-trace.zip`.

These checks supplement the existing continuous desktop Match through Game Over/New Match, touch Match through R8, DOM Start overlap double/triple taps, immediate D/F/E dispatch observations, unit `touchCancel` full-state/view restoration, identical normal `touchEnd` deployment and item cancellation. Every browser console error remains a failure; none is filtered. The final clean commit must pass the 568-test suite, build, both full browser modes and its own six GitHub CI checks; historical evidence above cannot satisfy this new gate.
