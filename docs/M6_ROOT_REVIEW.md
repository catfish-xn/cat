# M6 root integration review — W3

Reviewer: A persistence / C presentation, independently reading root-owned integration. Review date: 2026-10-06. Scope is the frozen M6 Goal, primarily G02/G04/G05/G08; no new feature requirement is introduced.

Review base: `d78be2a1c6139adefc7acdec49f1b3d2b16900f0` plus the integrated, uncommitted M6 changes. Source fingerprint at this read: `839f6154648c019c03af941f3c805a806b66062fb461f975364738de7a7599ae`. Post-fix read fingerprint: `642d5a32218059353dcb8fc07ca1599d0eb94043527a131a31380020d87a4c0f`. This is a static integration review, not clean-final-SHA acceptance. The reviewer did not edit root production files and did not start parallel CPU/browser workloads during this pass.

## Reviewed code and evidence

- `src/m6/application.ts`: startup/continue, capture/queue, candidate construction, import activation, local session replacement, replay entry/switch/exit, visibility handling, archive cache, teardown.
- `src/rendering/match-session.ts`: per-command and per-step notifications, restored event ledger, pause-reason composition, accumulator reset, observer/session disposal.
- `src/main.ts`: one Phaser.Game, native pointer bounds updates, touch/mouse duplicate filter, ResizeObserver/rAF ownership and destroy cleanup.
- `src/rendering/BoardScene.ts`: application frame gate, domain advancement, stats/playback switching, input commands, replacement cleanup, Phaser shutdown handlers.
- Read supporting repository/coordinator, replay history/session, ReplayPanel and integration tests to check boundary assumptions. No benchmark result was inferred from source review.

## Findings reported to root

| ID | Goal | Finding and concrete trigger | Status in reviewed source |
|---|---|---|---|
| ROOT-01 | G05 | `openReplay()` unconditionally flushes the coordinator. A failed quota/abort write may be retained when first replay entry catches the flush error; after storage recovers, selecting another completed battle while already in replay retries that pending write and changes storage revision inside the read-only interval. Flush only on the active-to-replay boundary. | 源码已修复，真实故障门禁待E。`wasReplay` now suppresses all save flushing on replay-to-replay switches. |
| ROOT-02 | G05/G08 | During a replay-to-replay switch, existing replay controls remain usable while `openReplay()` awaits a retry/flush. “Return to current match” can close the old replay, but the still-pending open operation has no operation fence and can reopen replay after the return. This also temporarily removes the session's replay pause reason while the application is still busy; keyboard commands consult the session pause rather than application busy. Disallow close during the switch or fence the pending open. | 源码已修复，真实故障门禁待E。Replay open has an operation identity; close rejects busy transitions and increments the identity on return. |
| ROOT-03 | G08 | `savedArchiveRun` is keyed only by runId and is not reset by `install()`. Complete A, activate other completed files, then import A's older unfinished file. On A's next successful completion the equal runId suppresses archive refresh; if three other completed archives existed, database eviction succeeds but a removed archive can remain in the cached replay list. Reset the completion-refresh identity for each activation, or include activationEpoch. | 源码已修复，真实模块故障门禁已通过（dirty workspace，非最终验收）。`install()` resets `savedArchiveRun` for every activation; ROOT-03 public-control/native-IDB reproduction passed below. |
| ROOT-04 | G08 | The success continuation checks disposal, but `initialize()` and `replaceCandidate()` error handlers call `failed()`/`hooks.status()` after asynchronous rejection without checking disposal. Destroying the application while an IDB read or import is pending permits later rejection to touch the old destroyed UI. Gate failure callbacks with disposed/operation identity as well as successful callbacks. | 源码已修复，真实模块故障门禁已通过（dirty workspace，非最终验收）。`failed()` ignores disposed applications; replace/open error continuations check disposal and operation identity. Three disposal/failure interleavings passed below. |

These findings concern existing frozen failure/isolation/lifecycle requirements. They do not require new storage features, cross-tab merging, or a new simulation protocol.

## Earlier findings verified as corrected in this read

- Startup replacement confirmation now examines the existing stored Match when no run is active; export can use the existing envelope.
- Hidden-page handling saves only in active, non-busy mode. Replay visibility no longer retries writes, and visibility/return reset accumulated elapsed time.
- Successful activation refreshes completed archives, so a direct import of the fourth finished run refreshes the retained-list UI. ROOT-03 concerns the separate later-completion same-run activation case.
- Candidate sessions are disposed when validation/activation fails or the operation is discarded; successful installation disposes the old session and coordinator.
- Stats controls are inert during busy/startup; replay selection routes into the isolated replay view.

## Positive checks and reasoning

**G02 legal recovery boundaries.** MatchSession notifies after each complete stepMatch result, including all intermediate logical ticks in a long frame. The application observes history before capture and queues at each 40-tick boundary and phase transition. Command/Continue notifications occur after the ledger state is installed. A restored session takes the supplied event prefix rather than replaying start effects. Both pause and resume discard fractional frame time; hidden return also discards the first frame delta.

**G04 import/CAS order.** File/envelope/history validation and isolated candidate construction precede repository activation. The active session is paused throughout validation and the existing writer is drained before expected-token selection. Repository activation checks runId/activationEpoch/revision inside its transaction and returns only on transaction completion; only then does install replace the active object. A rejected candidate preserves the old domain object, RNG, ledger and receipts. Same-run activation receives a new epoch. Old coordinator callbacks are suppressed by dispose; normal replacement drains its in-flight write first. The coordinator's pending-save compaction retains all newly completed record additions and only the latest fixed Match/prefix.

**G05 isolation.** BoardScene gates active `advance()` through application.frame(); replay advances only its own PlaybackSession. Domain command entrypoints check composed pause reasons, so D/F/E cannot mutate active Match while the replay pause is held. Returning clears playback/render objects, resumes only the replay pause reason and discards elapsed time. ROOT-01/02 identified switching error-path gaps; the revised source closes these paths with a replay-boundary flush and operation/busy fences. Their real fault-path gates remain E-owned and pending here.

**G08 resource ownership.** Main owns one Phaser.Game. ResizeObserver, outstanding resize rAF, canvas mouse/geometry listeners and the window scroll listener have matching game-destroy cleanup. BoardScene keyboard/native-pointer listeners have shutdown cleanup. Replacing a run clears drag/router state, tweens, effects, old stats/ledger display and selection without starting another game/frame loop. Full application and Phaser lifetime counts still require E's real 30-cycle evidence; source inspection alone cannot prove bounded heap or no internal Phaser leaks.

## Validation boundary

This review read the current source and existing test assertions; it did not rerun the full suite, native input matrix or final performance job. Prior A/C checks were 33 persistence unit tests, the independent E statistics oracle, real native-IDB prolonged quota/abort retry checks and 17 Chromium component checks, each limited to its recorded workspace version. E owns final same-commit command/tick-route, browser, storage, performance and full product lifecycle evidence. Do not promote those earlier dirty-tree results into clean-final-SHA acceptance.

## Post-fix read confirmation

All four ROOT findings have source fixes on the post-fix fingerprint above; none is labelled final passed. `initialize()` still routes errors through `failed()`, whose new disposed guard is sufficient to prevent the stale UI callback. `replaceCandidate()` and `openReplay()` discard invalid operation/disposal error continuations before changing mode or status. `openReplay()` retains the existing replay pause when switching fails, while an initial open failure restores active mode's pause state. Close cannot race a busy replay transition. No further demonstrated domain-state/receipt/RNG mutation bug was identified in this read.

`loadArchives()` does not carry a separate generation guard. This review has not demonstrated an out-of-order cache result under a concrete public workflow: startup keeps controls busy, successful activation awaits its own fresh reload, and transaction reads return independent data. Therefore this remains a review limitation, not an invented new blocker or a claim that every possible asynchronous interleaving has been exercised. E's multi-operation browser/failure evidence remains authoritative for that coverage.

## ROOT-03/04 browser fault-path evidence

`node tests/m6-application-failures.cjs` exited 0 on 2026-10-06, with four named cases passed, no recorded browser/console errors, and total duration 48,956.894 ms. Manifest: `artifacts/m6-application-failures/manifest.json`. Environment: Node v24.21.0, Chromium 153.0.8010.12, Intel Xeon Processor (Skylake, IBRS). HEAD remained `d78be2a1c6139adefc7acdec49f1b3d2b16900f0` with explicitly recorded dirty changes; starting and ending production source fingerprints both equal `05cd3671fdc27b686370cc5f7c7f87aa6f8faf93778fa27425625a041a8c8d1f`. This is local fault-path evidence, not final clean-SHA acceptance.

- **ROOT_03_same_run_completion_archive_refresh:** A legal seed-42 cannon route generated through 182 accepted commands provides 30 complete battles and a final-combat unfinished prefix. Real SaveControls imports unfinished A, the public MatchSession advances to completion, then controls import completed B/C/D and the older unfinished A again. Completing reactivated A refreshes ReplayPanel to exactly 90 battles from retained C/D/A; evicted B is absent, native IndexedDB order agrees, and current A has 30 battles. Activation epoch remains stable during the final normal save. One application, session and observer remain active.
- **ROOT_04_initialize_dispose_then_idb_abort:** A native readonly IndexedDB transaction is kept pending; dispose precedes its real abort. No status/changed hooks reach the destroyed UI, no unhandled rejection remains, all three application/session/observer live counts reach zero, and SaveControls nodes are removed.
- **ROOT_04_import_dispose_then_file_failure:** File.text is held at the I/O boundary after a real file-input event, then rejects after dispose. The same callback, rejection, live-count and DOM cleanup checks pass.
- **ROOT_04_candidate_dispose_then_activation_abort:** A validated same-run import constructs an isolated candidate (two live sessions before disposal); its native readwrite activation transaction is held pending, then really aborted after dispose. Both sessions and observer/application resources are released, no stale UI callback fires, and the last durable Match is unchanged.

The gate uses real MatchApplication, SaveControls, ReplayPanel and native IndexedDB, with legal domain events and no simulation-resource injection. It does not instantiate Phaser, exercise native board dragging, or prove 30-cycle heap stability. ROOT-01/02 real replay-switch failure paths remain assigned to E; these four results do not close those findings. Final acceptance must rerun this gate together with the other evidence on the same clean implementation SHA.
