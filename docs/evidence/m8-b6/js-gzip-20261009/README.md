# B6/B7 production JS gzip audit — 2026-10-09

## Result

Same Node v22.23.3, npm 11.9.0, shared pre-existing dependencies (Vite 7.3.6, TypeScript 5.9.3, Phaser 3.90.0, Rollup 4.64.0, esbuild 0.28.2). All five `npm run build` commands passed. Package lock SHA-256 is identical across all five sources (see report.json). No installation or runtime/config/gate/test edit was made. Builds used detached worktrees and an untracked node_modules symlink; no commits or merges.

| Source | JS asset | Raw bytes | gzip level 9 bytes | Delta vs fixed 041 | Integer headroom |
|---|---|---:|---:|---:|---:|
| M7 15313a75c6e74beec739fe52a2875c104c55eae3 | index-CsWIfx1z.js | 1497604 | 424763 | -54434 | 63714 |
| Fixed 0411ad65c1933e87df840042f38cfe1ce834d127 | index-DdMOBtRY.js | 1673838 | 479197 | 0 | 9280 |
| B6 ac76255df7876f2dfa47deaa4a4475a0beaf81b8 | index-DUu5xtPS.js | 1680043 | 480808 | +1611 | 7669 |
| B7 469afdae118c81e8c8ec44bc96b139552915455f | index-DESX2A9r.js | 1668522 | 477438 | -1759 | 11039 |
| B7 own base 5bd7968ee31e107e12701145aa4fdac0bec7ea8d | index-DESX2A9r.js | 1668522 | 477438 | -1759 | 11039 |

Every build has exactly one dist/assets/*.js; the table therefore also gives each build's sum. SHA-256 for each asset is in report.json.

Current B6 scripts/m7-budget.cjs reads jsBudget 1.15; its jsGzip function sums individually gzipped `.js` assets at zlib level 9. Applied to the rebuilt signed-off M7 source, the mathematical threshold is 424763 × 1.15 = 488477.45 bytes. Actual JS floating-point multiplication serializes as 488477.44999999995. Effective integer ceiling = 488477 bytes. B6 remaining integer budget is 7669 B (7.669 decimal kB; 7.489 KiB). Fixed 041 remaining budget is 9280 B (the approximately 9.3 kB starting headroom). Historical M7 script itself used 1.10, not the current 1.15; do not confuse historical and current gate policy. JS budget passes; no claim is made about interactive timing or the overall combined M7 gate.

## Comparison limitations

- B6 raw head is based on adf24b4ef6f5ec65b3abd59adc050ad2b6b82880. It does not include the latest B3 041 fix. +1611 B is raw-head versus fixed-baseline difference, not a hypothetical merged integration measurement.
- B7 shares old base 5bd7968ee31e107e12701145aa4fdac0bec7ea8d. Its build is byte-for-byte identical to that own base (same raw length, gzip length, asset name and SHA-256). Its measured isolated production increment is 0 B because the new catalog/compiler is not wired into production; -1759 B versus 041 reflects the baseline mismatch and is NOT a reduction due to B7.
- Future B7 wiring, B6 integration with 041, and U5 must be remeasured. None of the present headroom is an approved allocation to those tasks. Preserve it rather than infer their future size.
- B6 later test-only checkpoint must be bound by a fresh build or exact unchanged-production-input proof; this report initially measures ac76255 only.

## Read-only retained text/debug inspection

Verified in fixed, B6 and B7 output: original English ability descriptions (e.g. `Enter a defensive stance and gain`), provenance URL, local archive path strings, `approvedSimplifications`, `championApiNames`, `variableConvention`, and `No origin-trait effects`. Source path: `src/simulation/match.ts:25,96` uses CONTENT_DIGEST; `src/simulation/content/index.ts:10,13,41-54` hashes the entire S13_ABILITY_DATA and SOURCE_MANIFEST objects. This runtime content digest prevents those text fields from being eliminated. `combat-abilities.ts:5,47-48` also uses the ability data. These are retained metadata/text candidates, not quantified removable savings: changing hashed content can alter save/replay compatibility and requires explicit design approval.

Production also contains `__CAT_DEBUG__`: BoardScene.ts:200-203 publishes its read-only debug snapshot without a DEV condition; debugSnapshot is implemented at :617 onward. This is existing intentional-looking test support, not proof of an accidental new B6/B7 import. Do not remove it on this audit's authority. `m6-fixed-start` is a test selector, not by itself evidence of wasted debug data.

The large source archive is only referenced by pathname metadata here, not imported as raw JSON in the inspected source imports. No claim that the whole archive was bundled. B7 catalog markers `m8b-encounters-project-v1`, `m8b-pve-project-v1`, `pve-minion-melee-a` are absent from production; source search finds catalog imports only in the isolated compiler, which has no production importer. Probe results are preserved in bundled-content-probes.json and content-probes-raw.log. No speculative savings are added to headroom and no refactor was performed.

## Reproduction and evidence

Set PATH to `/tmp/dot-npm-cache/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH`. For each source above, create a detached worktree with `git worktree add --detach <target> <SHA>`, read AGENTS.md, then `ln -s /tmp/cat-final-baseline/node_modules <target>/node_modules`; in each target run `npm run build`. Targets in this audit are `/tmp/m8-bundle-audit-20261009/{m7,fixed,b6,b7,b7-own-base}`. These worktrees retain the actual outputs for verification.

Run `node /tmp/m8-bundle-audit-20261009/measure.cjs > measurement-raw.log 2> measurement-stderr.log` and `node /tmp/m8-bundle-audit-20261009/probe.cjs > content-probes-raw.log 2>&1` from the evidence folder. The scripts are standalone audit tooling outside the repository. measure.cjs uses `zlib.gzipSync(data,{level:9})` for every sorted `.js` under each dist/assets, summing results independently. It extracts multiplier from the current gate source, not a guessed threshold.

Evidence: report.json; measure.cjs; probe.cjs; tool-versions.json; measurement-raw.log; measurement-stderr.log; bundled-content-probes.json; content-probes-raw.log; {m7,fixed,b6,b7,b7-own-base}-build.log. All build logs are raw npm/typecheck/Vite output. Vite chunk-size warning is expected and not the custom gzip budget gate. Evidence directory is outside all working repositories.
