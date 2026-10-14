# B7 cleanup verification — pre-integration checkpoint

Scope: N1 restores control start/end from the trusted opening task and status declaration; N5 preserves hero maximum mana >=1 while neutrals may use zero; N6/N7 supplement receipt contracts and the accepted/merged handoff. No frozen contracts, G12, UI, catalogs, content digest, CI settings, thresholds or measurement methods changed. At this checkpoint B8 and delivery of the user's separate Claude audit-vector branch remained pending. The audit branch was supplied and merged afterward; this evidence is retained as the earlier cleanup-only check, not final integration acceptance.

## Regression strength

`tests/m8-b7-cleanup.test.ts` adds five cases. Three run the real combat executor with isolated hypothetical trusted opening declarations: execution1/duration7 -> [2,9), execution1/duration17 -> [2,19), execution4/duration7 -> [5,12). Every relevant tick is validated; retimed contributions and expiry receipts are rejected. Mocks only vary the trusted declaration/task in this test process; they do not change the production catalog or claim new supported opening schedules.

A normal stage-one Match round-trips hero positive mana and neutral0/0 and rejects corrupted hero/neutral mana. A fifth test independently reaches the defensive hero minimum: it mocks the trusted strategy resolver to zero for unit-1 and makes the saved strategy/runtime agree, bypassing neither structural checks nor the minimum itself. It expects the exact `Invalid Match save: combat stats` error and restores ordinary behavior afterward.

Mutation probes copied source/tests into a separate directory with the same node_modules. On the final five-test file:

- Current implementation: five pass (`probe-current.log`).
- Replace only N5 predicate `unit.maxMana >= (unit.unitKind === 'neutral' ? 0 : 1)` with old `unit.maxMana >= 0`: precisely the fifth test fails because restore does not throw; other four pass (`probe-old-mana.log`).
- Restore the current predicate, then replace only neutral-restore.ts with merged87782695's file: all three timing cases fail and both mana cases pass (`probe-old-timing.log`).

These are regression sensitivity checks, not an independent external audit or a substitute for Claude's pending branch.

## Actual checks

All commands used Node22.23.3 and original package scripts. No concurrency flags, timeout changes, assertions, skips or thresholds were edited.

- Initial checkpoint original npm test: 112 files,1426 passed/10 existing skipped,419.13s,exit0 (`initial-full-unit.log`). This run predates the fifth case and overlapped separate bundle planning builds plus brief mutation probes; it is not the final isolated acceptance run.
- Final focused test: five pass (`focused.log`).
- Final original npm run typecheck: pass (`typecheck.log`).
- Final original npm run build: pass (`build.log`), including its own typecheck. Existing large-chunk warning retained.
- Final isolated original npm test: 112 files,1427 passed/10 existing skipped,420.52s,exit0 (`final-full-unit.log`). Runtime/test checkpoint local f042e7d2f620754e572b4c27f81d2fbf07e97e25 and remote 3fd72a8e7afe097a836fb585d31ec529880d9df1 share tree c59d4122a6468df400c968053a7d7183d0bf0cd7. Subsequent changes only add this evidence and its handoff summary.
- All dist/assets/*.js files individually gzipSync(level:9), summed:485816 B. Accepted B7=485743 B, cleanup delta+73 B; exact947 baseline=480941 B, total delta+4875 B. Unchanged effective cap488477 B leaves2661 B (`budget.log`). Vite's displayed gzip size is not this measure.

Desktop Chromium checks were not run locally; the earlier cloud-browser block was not represented as desktop CI. This cleanup needs remote CI and later independent review. The accepted PR21 CI161 refers only to its fixed889 source, not these cleanup changes.
