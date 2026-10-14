# B8 checkpoint① evidence

Scope: isolated, pure loot content/identities/RNG/frozen ledger and deterministic own-format restore. This is **not** a live Match loot release. No award/death/selection command pipeline, public LootView, B9 save/replay switch or UI changes are implemented by this checkpoint. Match still truthfully reports B8 pending and requires encounterPlan=null.

Baseline: `cab8fe2b2ed8c9f2f48901bf4355a360c0ed8248`. First local implementation commit: `2c146c46dacb53b328e14613fe692e6d6d33221b`, tree `fe6f83b83e10b33c32b91b7371f740fcb52f9101`. Remote backup `110eed10fae9c4941e84c1298f28f7f3f9e12590` has the same tree. The fixed implementation/test source commit is `c12f5e50df5865cee27a2be29491a2964353a83e` (tree `35624cc0dbf4a6d66ad0c0bfa0ef45215665bf04`). Its remote backup is `e666ec555576c4c5943405e6c6a11e0b183a9c3c`, with the identical source tree. Later evidence-only commits do not change the tested code or imply checkpoint② approval.

## Reproducible bundle accounting

Node `v22.23.3`, Vite `7.3.6`, shared identical installed dependencies for both builds. Each emitted production `.js` is compressed independently with Node zlib gzip level 9, then summed; see `budget.json`.

- Exact baseline production: **485873 B**.
- Checkpoint① production: **485873 B**, delta **0 B** because this isolated module is deliberately not connected yet.
- Audit-only reachable build retaining **all exports** of loot-freeze / loot-choice / loot-identity: **488547 B**, marginal **2674 B**. This includes freezing, independent RNG, validation, own restore, choice constraints and identity helpers.
- 2674 B is the measured conservative checkpoint① reachability estimate, **not** a completed-B8 budget or final integration prediction. Relative to the B8 midpoint 10000 B: 26.74% consumed (−73.26%); below its strict >13000 B stop trigger.
- Global effective ceiling **552191 B**: actual production headroom **66318 B**; audit-reachable headroom **63644 B**. Later B8 pipeline/query integration must be measured and charged to B8, not hidden in U6/UI.

The probe changes only Vite's in-memory transform of src/main.ts. It never edits the repository entry, UI, config, CI or gates. No probe global is present in the production candidate. `measure.mjs` documents the exact transform and gzip chain. To reproduce, export the baseline to `/tmp/m8-b8-cab8` using `git archive <baseline>`, attach the same node_modules, create `artifacts/b8`, then from the candidate root run `node docs/evidence/m8-b8/checkpoint-one/measure.mjs` with the Node 22 path first in PATH. It generates ignored artifacts only.

## Validation status

Fixed-source validation at local `c12f5e50df5865cee27a2be29491a2964353a83e`, tree `35624cc0dbf4a6d66ad0c0bfa0ef45215665bf04` (remote same-tree backup `e666ec555576c4c5943405e6c6a11e0b183a9c3c`):

- Targeted: **82/82 passed** (`targeted.log.gz`).
- `npm run typecheck`: **exit 0** (`typecheck.log.gz`).
- Original unmodified `npm test`: **116 files passed, 1590 tests passed / 10 existing skipped (1600 total), 390.01s, exit 0** (`full-test.log.gz`). No extra exclusions, worker overrides or timeout changes were used.
- Final `npm run build` (includes another typecheck): **exit 0**, Vite production build 4.74s (`final-build.log.gz`). Ordinary existing chunk-size warning retained; no gate/config change.
- Source/test SHA-256 before and after the full run matched (`tested-source-sha256.txt`). The final commit only adds evidence files; no runtime or test edits follow the verified source commit.
- Isolated freeze version: `m8-b8-loot-freeze-v1`; replay digest: **fnv1a32-utf16:d03edab3**. Live Match content digest remains **fnv1a32-utf16:c8a4b6d9**, unchanged from baseline; see `versions.json`.
- No goldens, existing skips, CI, production entry or frozen B2/G12 files changed.

 Browser/Chromium checks are **not run**: this environment's previously verified launch limitation is EPERM; no browser success is claimed.

## Review boundary

`restoreFrozenLootLedger` takes an external authoritative seed and entered-round ordinal. It replays the approved fixed policies, exact component/hero pools, slot table, whole schedule, encounters and versioned algorithm digest. Saved RNG state/draw count, payloads, fallbacks, order and identities are compared to regenerated results, never used to generate their own expected values. It rejects extra/missing/changed fields rather than repairing them. A coherent alternate seed/boundary supplied by the caller is not authenticated by this local format; checkpoint② must bind those inputs to Match and its round history.

Only preparation planning exists here. Pure PendingChoice construction/validation pins component, generation=0, step=offer, returnPhase=settlement, null target, zero rerolls, exact full-pool order, and isolated canonical choice/event identity. The caller must establish eligibility, actual finished Combat, absence of a resolution and phase legality in checkpoint② before installing one. The order helper is not an authorization function or full runtime-ledger validator.

The complete next-boundary authority/write-point/recovery specification is [M8_B8_HANDOFF](../../../M8_B8_HANDOFF.md). Combat input basis, growth transfer and consumption/sale provenance are checkpoint② requirements, not work deferred to checkpoint③/B9. Checkpoint① stops for fixed-SHA audit before any such runtime work.
