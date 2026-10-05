# M5 implementation evidence

Status: **implementation and acceptance in progress; F4 has not passed**. Browser jobs and later checks are not counted as passed until their complete manifests succeed. Local dirty-worktree evidence does not certify a final clean commit.

## Observed baseline — 2026-10-05

- Repository `/root/projects/hex-autobattler`; remote `https://github.com/catfish-xn/cat.git`.
- Initial branch `main`, HEAD `5a4ce80394bde766e79d57a31d8625e5a0b381c3`, merged PR#5, including reviewed M4 `9eb5e081350ea00a1963f3799529a9f8b83da078` with the same tree.
- Initial changes were the three untracked, user-approved M5 planning documents; preserved. Implementation branch: `feat/m5-s13-single-player`. This session has not merged a PR.
- Before M5 edits, **568 tests /36 files passed in39.26s**. This proves only the M4 baseline and is reused rather than rerun.
- Runtime/network skill was already read. No environment_status tool or `/etc/codex/network-policy.json` was available. No credentials were printed or changed. Dependencies were not changed during M5 implementation.

## Contract and implementation record

Scope remains19 heroes,5 professions,7 components/9 complete items,6 augments,3 anomalies and three eight-unit builds, with35 rounds from2-1 through6-7. Historical reference remains S13 original-season14.24b. The downloaded14.24 client archive matched the SHA fixed in M5_RULES; curated local source/manifest and explicit Loris40/80 override are checked in with the implementation. Runtime/CI never download current game data.

Public state now includes schema5/protocol2; independent shop/choice/reward/battle-seed RNG; round kind and definition; streak/outcome; source receipts and settlement identity; persistent Tristana growth and augment progress. Supply settles without Combat. Post-PvE choice retains finished Combat and returns to settlement. Combat freezes integer coefficients, sources and mechanics, and tracks layers, statuses, tasks, RNG/action sequence and provenance.

The root owns shared contracts and integration. A implemented economy/shop; B finite Combat; C content/archive; D rendering/native input; E independent routes/replay/performance evidence. Shared interfaces were broadcast and integrated. F1 is implemented, with cross-review closing alongside the acceptance matrix; no claim that writing this record alone freezes or verifies all behavior.

Clarifications made during integration, recorded in M5_RULES R6:

- Darius' archived description applies bleed to the primary target; initial spin remains area damage.
- Tristana grows only if a secondary ricochet actually occurs; a final-enemy kill without a bounce grants no growth.
- Next-tick1second control blocks20 full action ticks; refreshing a same-source state does not introduce a gap.
- Irelia shield decay uses integer linear remaining amounts, avoiding premature disappearance from repeated rounding.

## Actual targeted results

These are executed checks on the developing worktree, not final-SHA evidence. Counts overlap with the full suite and must not be summed as unique tests.

| Check | Observed result | Limit |
|---|---|---|
| Economic module |42 independent cases passed | Module scope |
| Imported content |9 cases passed | Manifest/catalog/schema coverage |
| Finite Combat |42 cases passed;63 unchanged low-level cases passed separately | Numerical/source/ordering/19 skills; independent expected numbers distinguishable in tests |
| Shop/progression/stats/inventory/Match economy |150 passed in1.53s | Migration basis in M5_TEST_MIGRATION |
| Generic effect/snapshot/enemy migration |24 passed in1.27s | Legacy arithmetic retained; enemy curve explicitly versioned |
| Match contracts/lifecycle/session |12/12/16 passed in focused runs | Normal choices and independent command oracle |
| Schema5 negative imports |33 passed; session+schema run49 passed in2.31s | Boundary/ID/history/terminal/snapshot negatives |
| Live transient imports |13 passed in1.80s total | Real first-battle layers/statuses/tasks; duplicate, expired, invalid-source and target negatives |
| Normal headless routes | cannon/sniper/mage reached35-round victory, finalHP86/87/63 | Normal commands/resources; independent economic and item ledgers |
| Caitlyn acquisition variant |Normal purchase,12 real battles,22 casts, terminalHP100 | Optional upper-end champion evidence; not required for base sniper formation |
| Headless route tests |4 passed in latest full run | Three builds plus Caitlyn; M5 golden is explicitly versioned |
| Earlier per-tick replay |One cannon route passed (~115–118s) | Later full-suite timeout and expanded coverage remain pending |
| Build after final production changes |`npm run build` passed; Vite6.61s | Bundle1.38MB uncompressed/386.68KB gzip; Vite size warning recorded, not a measured frame failure |

### Full-suite integration result

Latest full run: **538 passed,1 failed /35 files,182.27s**. Only `m5-replay.test.ts` exceeded its180s limit while the browser jobs and the rest of the suite shared the machine. It did not report a state/event mismatch. This remains a failed run; earlier isolated success does not override it. The replay test is being expanded to all four routes and replacing assertion-framework overhead with complete strict comparisons; the180s per-route limit is retained. Re-run the complete suite after the browser workloads release resources.

M4-only high-level tests are preserved verbatim as `tests/historical/m4/*.ts.txt`; original M4 golden data remains unchanged. This version migration is documented in [M5_HISTORICAL_TESTS](M5_HISTORICAL_TESTS.md) and [M5_TEST_MIGRATION](M5_TEST_MIGRATION.md). Unchanged board/path/RNG/upgrade/damage/effects, invalid definition IDs and native-input defects remain active. Archiving a historical program is not itself evidence that its replacement passes.

## Browser findings and current evidence

Initial dev/preview full-route attempts exposed a real UI defect at2-7: Match had moved from Combat to reward choice, but the scene only rerendered settlement/gameOver. The fix updates HUD/rendering on every exit from Combat. Failed artifacts are retained with a `p1-failed` suffix. The new dev cannon run has reached beyond the first PvE reward with the choice visibly present and all offers interactive; this is a partial regression result, not a complete route pass.

Current runners perform native input, normal50ms logic time, full per-command state comparisons, complete per-round Combat events and tick0 events. They do not inject resources, restore to a midgame fixture, or accelerate ticks. Development and preview queues each run cannon→sniper→mage→cannon touch serially to keep browser concurrency bounded. The pre-cross-review cannon route subsequently completed in both modes: dev927.261s and preview881.884s,182 command checkpoints and30 combat records each. Complete initial/final state, commands, economic ledger and every combat event agreed across modes, including New Match. These are old-digest development results and cannot certify the later AS/source/redirect fixes.

The new native-input runner covers touch/compatibility-mouse behavior, choice bursts and dismissal protection, immediate D/F/repeat, cancel/release pairs, items, sizes and rotation. Timing-sensitive tests record trusted CDP-native event arrival relative to the400ms product shield; they do not lengthen the shield to make tests pass. Complete dev/preview input manifests remain required.

Canonical artifact directories are `artifacts/m5-{dev,preview}-{cannon,sniper,mage}`, `artifacts/m5-{dev,preview}-cannon-touch`, and `artifacts/m5-input-{dev,preview}`. The comparison script labels default results development validation. `--final` requires all ten manifests, matching clean SHA/source/version/digest, successful checks and cross-mode full state/events. Screenshots are supplementary; they cannot replace domain comparison or independent mathematical answers.

## Performance and CI

Executed local headless performance: four routes×three repetitions on the4-logical-CPU Linux/Node24.21 machine. Observed route p95 maximum1.212ms, p99 maximum1.934ms, single-tick maximum17.745ms; maximum route8.377s; maximum Combat event ledger874,607bytes; process RSS peak432,189,440bytes. Full metadata and per-route values are in `artifacts/m5-performance/manifest.json`. These are local measurements, not GitHub-runner measurements or browser-frame results.

The explicitly synthetic maximum-capacity fixture has9 player/8 enemy units,27 items,3 augments and1 anomaly. It produced101ticks,782events,212,390bytes ledger and403,494bytes state+ledger. It is labeled capacity evidence and is never presented as a normally acquired15-component build. Observer copies remained isolated and ledgers cleared at Continue/New Match. A later short normal-browser observation measured frame/heap/observer costs; complete final-SHA performance remains required (see cross-review record below).

CI now specifies six normal route jobs, two native-input-plus-touch-route jobs, headless/unit/build and final evidence comparison. The initial profiling workflow runs three samples for every workload on the same runner specification, including unit/headless/build. After measured budgets freeze, its default matrix will return to one sample and `workflow_dispatch profile=true` will request three. The90minute watchdog is provisional. Installation/build/play/upload timings must be collected and the final budget set to `ceil(max measured minutes×1.5+5)` before F4; no GitHub measurements or final budget are claimed yet.

## Remaining freeze gates

- **F1:** final cross-review of the implemented reference/content/public contracts and independent coverage.
- **F2:** full suite, all required command/tick integrations and rejected-command invariants pass together.
- **F3:** all numerical/content checks, four natural routes, six desktop browser routes, native/touch interactions, visual evidence and measured CI budgets freeze.
- **F4:** the same final clean commit passes all gates with complete evidence. Dirty local runs and the M4 baseline cannot substitute.

Safari/iPhone/iPad remain outside M5 formal support. Chromium mobile simulation is not Safari evidence. No fullS13, network play, shared finite pool, real carousel or opponent economy AI is claimed.


## Cross-review fixes and latest freeze

The initial freeze was reopened for independently reproduced defects, then refrozen after fixes; no older successful route is relabeled as validation of these changes.

1. **R6 attack speed:** Lux+Bow snapshot previously reported27ticks instead of the hand answer `ceil(20/.77)=26`. Static speed had also been multiplied by runtime speed; Kog+Bow+25%cast returned21instead of22. Original base speed is now retained, `attackSpeedBonusBps` stores static modifiers, and static/runtime/status bonuses add before one final interval ceil. Five independent cases and the real Rageblade first/third-attack case verify this. The complete strategy-number suite passed42/42.
2. **R6 redirect/ricochet:** Tristana's primary and Loris redirect packets could both grant bounce/growth, producing250bps and duplicate task keys from one cast. Redirect packets now cannot trigger ricochet and an action-level guard prevents duplicates. Both red regressions now pass. Combat suite45/45 includes these and the clarified Archangel tick99/100 periodic boundary.
3. **Runtime source import:** A fabricated trait source with a self-consistent layer key was accepted. Runtime sources must now correspond to the actual frozen owner's source or ability. The15 transient import cases pass, including the new rejection.
4. **Dynamic UI:** The unit detail had shown frozen attack interval and resistances as current values. It now uses the authoritative `readCombatStats` selector for AD/AP/interval/armor/MR/range and labels base/frozen/current explicitly. It does not calculate another stat model.

`s13-rules.ts` now contributes finite constants and `arithmeticRevision=m5-cross-review-2` to the digest. The unpublished M5v1 identity remains, while the new digest explicitly rejects earlier development saves. The previous M5 golden is retained as `full-match-golden.pre-cross-review.json`; the original M4 golden is untouched. New digest: `fnv1a32-utf16:a40192ef`.

Actual post-fix checks:140 targeted tests passed (combat45, strategy42, runtime15, unchanged generic effects/snapshots38). A separate53-test runtime/schema/growth/integration run passed in7.86s. The12-case phase matrix checks every preparation command, every choice command and Continue across all forbidden phases, comparing entire domain state, reference identity and absent events; all passed. Two growth tests prove merge conservation, sale destruction, actual combat grant, restore/step/Continue idempotence. Typecheck/build passed; Vite6.39s, bundle1,382.90KB/387.37KB gzip with the existing size warning.

Four fresh normal headless routes passed with independent ledgers, finalHP86/82/63/100 for cannon/sniper/mage/Caitlyn. Caitlyn participates in12 battles and23 casts. Updated golden annotations cite the independent AS and redirect answers; production-generated hashes are used only as trajectory consistency evidence. Four route regression tests passed (30.706s for the file). Expanded four-route per-tick replay is still running at the time of this record.

Latest dev short-browser observation after the fixes:7 checkpoints passed in62.501s. Normal Bow+Rod acquisition/combine/equip gives Lux Rageblade;801 real battle events agree exactly with headless. Six displayed current stats agree with the authoritative selector; attack interval changes from frozen1300ms to current550ms. New Match clears the801-event ledger and all observed effect/tween objects. This is explicitly `observation-only`, not the62-case full native-input gate.

On this software-rendered development machine, that battle's measured frame intervals were p50/p95/p99=83.3/150/183.4ms; no60fps claim is made. Post-battle observer-read p50/p95=5.7/7.2ms, after New Match1/1.3ms. Heap samples are recorded without forcedGC, so they do not prove retained-memory reduction. Evidence: `artifacts/m5-observation-dev/`. Final complete input and full-route runs on the clean commit remain mandatory.

The CI command wrapper records actual install/build/test/play timings and machine metadata. The budget summarizer consumes complete GitHub job timestamps (including upload) and rejects missing/failed three-sample groups. The CLI `gh` is unavailable; the connected GitHub tools remain available for remote workflow evidence. No redundant dependency installation or archive revalidation was performed.


## Full integration result after cross-review

The latest complete run passed **616/616 tests in39 files,462.26s**. All four replay routes passed, with84.621/125.699/128.599/122.036s per route; no test was skipped. This replaces the earlier timeout as current integration evidence, while preserving that failed run's record. F2 integration is now verified on the worktree; final-clean-SHA CI remains separate. The touch full-route runner now rotates to844×390 before round15 and back to390×844 before round22, so anomaly rounds20/21 occur in landscape. It records unchanged full state and screenshots around native resize; actual full-route execution remains pending.


## R7 neutral-timing correction

After commit60b314d, an independent review found that neutral intervals23/22/18 were inverted to rounded attacks/second and then rounded back to24/23/19ticks. Five small tests reproduced exactly three failures before the fix. R7's authored integer intervals are now used directly for neutral units, which have no speed modifiers in this slice. The arithmetic digest revision advances to `m5-cross-review-3`; old results are preserved but are not final acceptance of this correction.

Before reopening this freeze, clean60b314d had passed all24 fixed-seed routes, both complete69-case native-input gates, and the preview cannon full route (883.769s). The remaining queues were deliberately interrupted for this rule correction; their cancellation is not reported as a product failure or successful acceptance. Remote push remains unperformed: automatic approval rejected upload pending explicit user authorization.

Post-correction checks:5/5 independent neutral timing cases and107/107 related combat/strategy/import regressions passed. Typecheck/build passed (Vite7.14s). All four normal routes reached round35 victory withHP86/82/63/100; command counts182/178/172/182 are unchanged, while legitimate PvE state/event timing hashes changed. New digest `fnv1a32-utf16:219676ed`. Full-suite and browser acceptance will run on the follow-up clean commit; no old browser pass is promoted to this digest.

## Clean-commit local acceptance: 19a486e

Commit `19a486ef81248cee97b82da4ee12387ded1ea458` uses arithmetic revision `m5-cross-review-3` and content digest `fnv1a32-utf16:219676ed`. It preserves authored neutral attack periods directly; independently specified stage 3/4/6 periods are 23/22/18 ticks. The three red regressions preceded the fix. Earlier M5 golden remains archived in `tests/fixtures/m5/full-match-golden.pre-neutral-timing.json`; current golden changes are documented against this rule correction.

Actual completed checks on the current source:

- Clean-commit full test suite: 621 tests in 40 files, 463.34s; four normal full routes and four per-command/per-tick replay routes passed. No tests skipped. Source log: `/tmp/m5-19a486e-tests.log`.
- 24 ordinary headless seeds: all 24 reached victory, with independent economic, card, item and RNG ledgers. Manifest: `artifacts/m5-headless-19a486e/manifest.json`.
- Native Chromium input gates: 69 cases each, dev 386.456s / preview 362.949s. Complete current-SHA manifests are in `artifacts/m5-input-{dev,preview}`.
- Desktop complete routes: cannon dev/preview 861.135/866.041s; sniper 1030.962/1031.616s; mage 1051.226/1046.06s. All three routes include normal terminal progression and New Match. Cross-mode comparisons matched 182/178/172 command checkpoints and each route's 30 full combat states/events. Source: `artifacts/m5-cross-mode-comparison.json`; its non-final classification is intentional while touch/CI gates remain outstanding.
- Local four-route performance sampling repeated three times: 12 samples passed. Maximum route p95 tick time 2.501208ms, p99 4.912888ms, individual tick 19.271238ms; peak process RSS 504,082,432 bytes; largest route combat ledger 868,878 bytes. Two normal-time Chromium routes were running concurrently. These are local Node 24 observations, not GitHub Node 22 timeout measurements.
- Synthetic maximum-capacity test: 101 ticks / 782 events / 212,390-byte ledger / 404,364-byte state plus ledger; tick p95 1.625344ms and p99 2.612619ms, observer p95 2.549204ms (five observer samples). Synthetic 27-item capacity does not claim normal acquisition of 27 items.

Reviewed current-SHA round-20 desktop screenshots for all three builds: target links, shields and status feedback are visible; selected carries show trait/item/augment/anomaly provenance. Dense melee floating labels can overlap. The sidebar/event record remains available, with scrolling required for all details. Screenshots prove only the recorded UI observation; independent numerical answers and full state/event checks remain separate evidence classes.

F4 remains incomplete. Required outstanding evidence: both normal-time touch full routes, final all-manifest comparison, three actual same-spec GitHub CI profiling samples, measured timeout budget freeze, and all required gates on the final clean commit after budget/document changes. No remote upload or merge has been performed. Remote push and draft PR require the still-pending explicit authorization after automatic approval rejected the upload.

## Touch route failure: occluded DOM target in the acceptance driver

Both normal-time touch routes on `19a486e` stopped at command 87 (round 12 deployment), dev 501.254s and preview 530.959s. The complete-state assertion caught an extra Tristana purchase (2G and one extra unit/serial); this failure is not a passed mobile route. Original evidence remains in the touch directories, archived by subsequent clean-commit queues.

The driver used `scrollIntoViewIfNeeded` followed by an unconditional viewport-coordinate touch. The deployment tab was geometrically visible but covered by the sticky shop; its center hit `mobile:buy-2`. A short normal-new-game probe reproduced the accidental purchase. On the same scenario, Playwright's native locator `tap()` scrolled/hit-tested the DOM target and preserved the complete state. Probe evidence: `artifacts/m5-occlusion-probe/{unsafe,safe}.json` and screenshots. The probe does not count as a complete route.

Both browser drivers now use native locator tap/click for DOM controls, retaining native coordinate input for Canvas. The input gate includes a permanently occluded-tab case: first prove the center is covered by the shop, then require a single native pointerdown on `panel:units` and complete-state noninterference. The full-route driver also saves native input logs on failure. No production source, rule/content digest, dependency, simulation function or golden expectation changed. Script syntax checks and the focused native probe passed; full updated-driver acceptance is pending.
