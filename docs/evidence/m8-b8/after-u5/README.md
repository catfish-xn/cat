# B8 checkpoint① after-U5 combination evidence

This is **combination verification only**. Checkpoint① implementation is unchanged; no checkpoint② work or U5 P3/issue #27 changes are included. Original [pre-U5 evidence](../checkpoint-one/README.md) remains intact and retains its original source/baseline bindings.

## Source identity and preserved history

- Freshly fetched baseline: `2acb9acfe90ad7936083fa2c7018dd482b6b222f`, including U5 merge `d64c381` and subsequent documentation.
- Local pre-integration checkpoint: `5bb3c231e1cca0d91fa3ce286bcb1cb658ff3e39`, tree `5db0b23ccf5bad836d46444974e39649a4f8690c`; remote equivalent `3be3760edbdd022682c03fa3485ff8ac1582904e` has the same tree.
- Clean local merge: `be099d7df52fa8eceed05e48ddd67e3c99b3c4ac`, parents **5bb3c231e1cca0d91fa3ce286bcb1cb658ff3e39 + 2acb9acfe90ad7936083fa2c7018dd482b6b222f**, tree **7f90e654c28b3c4f35f52c6f12073e88288cafd0**.
- Remote same-tree merge: **4e223cacf4107ef641cb7438bd5012272d0d37dd**, parents **3be3760edbdd022682c03fa3485ff8ac1582904e + 2acb9acfe90ad7936083fa2c7018dd482b6b222f**.
- No reset, rebase, forced update or discarded changes. The merge was conflict-free. Local and remote histories intentionally retain their respective prior commit IDs; identical trees bind the tested content.
- No original checkpoint① simulation/test file changed during integration; all six SHA-256 entries in the original `tested-source-sha256.txt` still match. Imported UI changes are exactly the approved baseline, not new B8 UI edits.

## Same-toolchain budget against the new actual baseline

Node **v22.23.3**, Vite **7.3.6**, identical installed dependencies and Vite entry/config for baseline and candidate. Each emitted production JS file receives its own zlib gzip level9, then totals are added (`budget.json`, `budget.log.gz`).

| Build | Every-JS gzip9 total | Delta against 2acb |
| --- | ---: | ---: |
| Actual 2acb baseline | **488964 B** | — |
| Actual integrated checkpoint① production | **488964 B** | **0 B** |
| Audit-only fully reachable B8 exports | **491669 B** | **2705 B** |

Production delta is zero because the completed isolated planning module is deliberately not live yet. The **2705 B reachable cost** retains every export of loot-freeze, loot-choice and loot-identity through the exact same in-memory entry transform as before U5; restore/validation costs are included. This cost is charged to B8 and cannot be hidden in U6. U5's own first reachability is already in the actual 2acb baseline and is not charged a second time.

B8 midpoint 10000 B: the measured checkpoint① cost consumes **27.05%** (−72.95% versus midpoint); below the **strictly greater than 13000 B** stop threshold. This is not the final cost of the unimplemented B8 pipeline. Global ceiling **552191 B** leaves actual production **63227 B** and audit-reachable **60522 B**. The difference from the old +2674 B probe is whole-bundle compression/minification interaction after U5, not a source edit.

`measure.mjs` only transforms the production entry in memory for the audit build. It never writes src/main.ts or any UI/config file; ordinary candidate assets contain no probe globals. To reproduce, export exact baseline 2acb to `/tmp/m8-b8-after-u5-2acb` with `git archive`, attach the same node_modules, create `artifacts/b8-after-u5`, then run `node docs/evidence/m8-b8/after-u5/measure.mjs` from the candidate root with Node22 first in PATH.

## Combination validation

- Fresh combination `npm run typecheck`: **exit 0** (`typecheck.log.gz`).
- Original unmodified full `npm test` against local merge **be099d7/tree7f90** (remote **4e223** same tree): **116 files passed, 1590 tests passed / 10 existing skipped (1600 total), 392.37s, exit 0** (`full-test.log.gz`). The 82 checkpoint① tests are included in this full run.
- Final `npm run build`, including another typecheck: **exit 0**, Vite build **4.70s** (`final-build.log.gz`). Its actual emitted `index-DNk6IFSw.js` independently matches the measured production **488964 B** gzip9. Source/test hashes and tracked source diff remained unchanged after the full run. The subsequent evidence-only commit changes none of that tested source.
- No goldens, skips, timeouts, test worker overrides or CI/gates modified.
- Browser verification is **not run** in this EPERM-limited environment; neither U5 UI nor the 6-7 Herald live-import obligation is claimed independently accepted here. The latter remains B9's obligation.

## CI and audit boundary

The baseline 2acb / U5 merge d64c381 themselves have no baseline CI run under the current main-push trigger. U5 candidate CI #168 is not evidence for either that baseline or this integrated B8 tree. This document records local combination checks only; the new B8 draft PR's actual CI and the checkpoint① independent fixed-SHA audit remain separate pending acceptance evidence. No checkpoint② work starts from these local results.
