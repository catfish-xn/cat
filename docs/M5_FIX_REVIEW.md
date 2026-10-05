# M5 audit fixes and revalidation

Status: **fixes implemented; final clean-commit gates pending**. The user's six findings on PR#6 / ba5c057 supersede the earlier M5 acceptance conclusion. That commit's 621 tests and ten successful CI jobs remain trustworthy historical evidence; they did not cover these boundaries. PR remains draft, main is not merged, and M6 is not started.

## Changes and review

| Finding | Fix | Permanent evidence |
|---|---|---|
| P2 empty roster blocks4-6 | Defer anomaly opening while roster is empty. Remain in preparation with a recruitment message; the first normal purchase atomically opens target selection. D/F cannot spend the last affordable offer's budget. Empty deployment cannot bypass this node. An exhausted locked shop receives the normal round refresh, ten words, one generation, unlocked. No free cards/gold. Completed anomaly never reopens after sale. | Normal seed42 cannon command trajectory, sell all before4-5, empty loss, Continue, purchase, choose, deploy, combat; exhausted/nonexhausted lock variants; D/F exhaustion; JSON/state/sequence/receipt/idempotence checks. |
| P2 two-offer cycle | Map the full32-bit word with floor(word×N/2^32), excluding only the immediately previous offer. Still exactly one word per successful draw. | Four seeds×40 draws with independent BigInt interval answers, all three options returning, per-command gold/RNG/generation. The independent route ledger now uses this reviewed rule too. |
| P2 ricochet misses Loris | Rename internal packet meaning to alreadyMitigated; resistance/amplification remains skipped for inherited overflow. Every hit can enter sharing once. The transferred amount goes directly to absorb with redirected=true; it cannot recurse or create extra growth. | Actual primary hit creates475 overflow. Next tick target receives238, Loris237, with secondary armor0 or100. Existing redirect recursion/double-growth regressions remain active. |
| P2 missing member trait effects | Trait descriptions label team/member base benefits, member extra benefits, and summed flat member totals. UI reads authored definitions and computes presentation only. | Independent totals20/50 AP,36/75 resists; native browser click verifies rendered labels/numbers and unchanged full state, screenshot. |
| P2 illegal runtime values | Runtime AS/range strictly derive from source mechanics and attack/cast counts; alive AP derives from periodic source/tick; dead AP must be a possible finite stopped total. Check empowered strikes, growth bounds, buddy source and safe arithmetic before restore returns. Unsupported AP/AS status sources are rejected in this finite content. | MAX_SAFE_INTEGER on six fields plus unsupported small AP30 rejected as object/JSON; normal per-command/per-tick replay retained for all four builds. |
| P3 last-row description | Manaflow I and Glass Cannon I descriptions consistently say最后一排. Position filtering is unchanged. | Both descriptions asserted; existing numerical positioning tests retained. |

The dead-unit AP check intentionally does not invent a death tick absent from schema5. It verifies values that could legally stop at or before the current tick; it does not replay the entire combat history inside the importer. Independent replay provides the separate trajectory-consistency evidence. There is still no public browser save-import UI; the malformed-save finding affects the promised validation boundary, not ordinary play in the audited routes.

## Versions and golden migration

Historical S13 reference remains14.24b. No new champions/content are added. Schema5/rules m5-14.24b-v1/content s13-14.24b-slice-v1/protocol2/lcg32-v1 remain, with `arithmeticRevision=m5-audit-fix-1`, digest `fnv1a32-utf16:d40612fa`. Restore explicitly rejects old digest219676ed. `full-match-golden.pre-audit-fix.json` preserves ba5c057 expectations. New expected hashes are derived trajectories, while the reviewed rule answers use hand-written/BigInt tests.

Four ordinary command routes were rerun after the rule fixes: cannon/sniper/mage/Caitlyn all reach35 victory; HP86/83/77/87, command counts182/178/172/182, ticks8130/11742/11822/11362. Caitlyn participates in12 battles and23 casts. Changed anomaly selection and ricochet sharing legitimately change later timing/HP/events; unchanged low-level M4 tests/goldens are preserved.

## Actual checks and remaining gates

- First targeted run exposed a stale independent anomaly oracle still using modulo; it failed and is not reported as a pass. Its rule was corrected to the separately reviewed full-range BigInt answer.
- Six affected suites passed128 tests; the expanded combat/recruitment cross-review then passed115 tests in four targeted suites. Source of fixtures, independent answers and browser consistency are explicitly distinct.
- The full local suite passed643/643 tests across41 files in522.98s, including all four command/tick restore routes. A final importer-only cross-review passed68 targeted tests in7.62s; the latest typecheck and production build passed (Vite6.81s). Existing large-bundle warning remains; dependencies were not changed or reinstalled. The full suite started before the last importer guards, so the exact-final-source full remote suite remains mandatory.
- Native dev input gate passed77 cases in305.167s, including the actual trait DOM regression; artifact: artifacts/m5-audit-input-dev. These checks are worktree evidence, not final-SHA approval. All ten remote CI jobs remain required on one clean fix commit.

Budget strategy stays with the measured hosted-runner class: test22/browser28/input32/comparison6 minutes, Ubuntu24.04/Node22. The added boundary suite and trait DOM check must fit those budgets; if a genuine timing concern appears, record it and remeasure rather than weakening routes or accelerating simulation.

Final results will be recorded in PR#6 and its exact-SHA CI run after this document's commit, avoiding another source change just to reference its own hash. User review remains separate from successful technical gates. No automatic merge or M6 planning follows.
