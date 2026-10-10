# B7 cleanup: final integrated local verification

2026-10-10 UTC. Tested local `442bd706eff8cc9cb69a55dacc951e312577c82e` and published `b3bc1ebaca81892d9379c69c768adfcaf971f7d1` share exact tree `59c063c1affad478031001616c8df937dfacd37e`. Later `e4421bd5cc1a005eaa9b31b675c64f8ef0deefb0` adds only `docs/M8_U5_PREVIEW_CONTRACT_CHANGE.md`; subsequent edits add this evidence and documentation status. Runtime, tests and gate code are unchanged after the checks.

## Scope and history

- N1: restore derives control activation from the trusted task's executeAtTick and declaration activation, and expiry from declaration duration.ticks. N5: neutral maxMana may be zero; heroes remain >=1.
- Five independent cleanup vectors include mutation-sensitive timing and the exact defensive hero-minimum guard. [Cleanup-only runs and raw mutation proofs](../cleanup/README.md) remain separate historical evidence.
- User-provided Claude audit tip `5d0b1e18a147fb29c12835adc542cce3c88ede48` (14 vectors) merged preserving history in published merge `b45537a`; U5 request tip `d3deb2fb8cf0d6e24131d65b32f2eb6ebd721000` merged in `a100ab4`. These are real supplied branches, not recreated audit claims.
- Published `c349127e80f862952d3c18ed72be884d38ce3c9e` strengthens the imported tests: every one of 88 independently enumerated cone layouts must actually attack, and save/restore runs on each mechanism tick and the following consumer tick with immediate restored-state equality. Existing assertions and the complete continuous-versus-resumed event/terminal comparisons remain.
- Published planning document `2dfce1acff7c7a8274782a13d9b3bda3b742305d` precedes cap commit `b3bc1ebaca81892d9379c69c768adfcaf971f7d1`. The cap commit changes only scripts/m7-budget.cjs's JS factor and two matching numeric comments, 1.15→1.30. Interactive1.20, all-JS gzip9 method, sampling and every other gate remain unchanged. Approval is M8-only; M9 must reassess. [Approved plan and batch stop lines](../../../M8_REMAINING_JS_BUDGET_PLAN.md).

## Why selected restore ticks remain meaningful

The imported audit restores tick0, ticks1–13 (opening, next-tick control, expiry12 and post-expiry13), each death/heal/movement/status tick, and every50 ticks. The follow-up also restores immediately after every mechanism tick, covering pending death reactions and their next-tick consumption even if that consumer emits no selected event. Each selected restored state equals the uninterrupted state immediately, while the complete emitted event stream and terminal serialized state still match across the full battle. This preserves useful boundary coverage without claiming restore at every single tick.

The 14 audit vectors also retain independently calculated multi-target Herald packet/control order, lethal filtering, cap299/300/300 for maxHP1999/2000/2001, blocked landing, independent cone children29/noncritical with one RNG word, and specific restore-tamper rejection. The unchanged original B3/B7 suite continues to cover generic action/RNG, same-tick companion deaths and their independent arithmetic; no assertion/golden/timeout/skip has been relaxed.

## Actual results

All use installed Node22.23.3 and the original package scripts.

| Check | Result | Raw evidence |
| --- | --- | --- |
| Imported14 plus cleanup5 before strengthening | 19 passed,2.42s | focused-imported.log |
| Final targeted14 plus cleanup5 | 19 passed,2.89s | focused-final.log |
| npm run typecheck | exit0 | typecheck.log |
| npm run build, including typecheck | exit0; existing chunk warning retained | build.log |
| node --check scripts/m7-budget.cjs | exit0; syntax only, not browser execution | script-syntax.log |
| Final isolated original npm test | **113 files,1441 passed,10 existing approved skips,432.38s,exit0** | full-unit.log |
| Every dist/assets/*.js individually gzipSync(level:9), summed | **485816 B**, +73 B vs accepted B7; M7 baseline424763 B ×1.30 gives effective cap552191 B and **66375 B remaining** | budget.log |

No other worker builds/tests ran concurrently with the final complete suite. Its source/test checkpoint stayed fixed. Raw stdout is preserved unchanged, including harmless terminal blank lines. `git diff --check` therefore reports EOF-only blank-line warnings in four earlier raw cleanup logs; source/tests and authored documentation pass whitespace checks. No whitespace rule or gate was changed to hide those warnings.

Local desktop Chromium/interactive checks were not run: historical cloud Chromium blockage is not a desktop CI pass. Remote CI and Claude's subsequent review of this final cleanup remain separate requirements. UR-U5-01/02 is only a proposal awaiting approval; frozen types and runtime preview fields are unchanged. U5 UI, B8, UR-U5-03/04, G12 and frozen rules/contracts are not implemented or expanded here.
