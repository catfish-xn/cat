# Current TG43 case: one-run read-only segmentation

## Finding and limits

The single effective diagnostic executed all 35 original public routes, all 43 definitions and all original assertions (705 Vitest assertion calls) in 3022.232425ms of measured case body on this machine. Public equipped preparation took 2327.343278ms (77.0074%); its three-battle opening alone took 2246.749182ms (74.3407%). This is a bottleneck diagnosis, not timeout acceptance or a stable-headroom claim.

Independent review reported 5503ms for TG in a whole-file-plus-fold-control run and 5775ms for the exact single case. The provided CI207 log directly reports TG43 at 7910ms, a 5000ms timeout, and 131 passed/1 failed files, 1851 passed/1 failed/10 skipped tests. CI200's reported 7596ms is a different run and is not relabeled as CI207. The older local 5413ms is not either CI measurement. This worker did not re-run a suite or claim P2 closure.

The local environment is Node22.23.3, npm11.9.0, Vitest5.0.3, Vite7.3.6, 9 logical CPUs (AMD EPYC 9V74), 10,451,464,192 bytes total memory. Reviewer hardware was reported by the parent as 4 logical Intel Skylake CPUs and about8.32GB. Same Node/Vitest does not make these environments equivalent; targeted/suite contention and instrumentation also differ. No causal allocation of that discrepancy is established here.

## Scope and source binding

Original repository: /workspace/scratch/2d61d723fa5a/cat-b8-phase2.
Original archive HEAD: 5e8ea0e38d04f3ed641c77ad222d79c3d325b5af.
Source tree: 16568c527580d74caca79e988bb5e8a1d43a290b.
Tests tree: 3202b3100b8b2b4e54b89c34630c6809b7c1ff18.
Original TG test SHA256: dbf5d48fb449f97d32725983c40ee29e513a249f7ea1324d4b7d9a05a113d2a3.
Original public fixture SHA256: 19086bab7b487c06dd7ef4a643cc81e4c3f573016d2ece158f656571f77e4836.
Instrumented test SHA256: 8e73f0782a4eb7e13dd1c619784219fad562bded8fb1355b7dd55da3fd56b57f.

All changes and outputs are outside the repository in /tmp/b8-tg43-current-segmented/. Only the copied test was instrumented; all 174 production/helper/toolchain files checked against the repository remained identical. All1282 originally tracked file hashes still verify. Other workers concurrently added documentation and advanced the local docs HEAD; source-after.txt records that, and analysis.json identifies ten added docs visible at that check. This worker did not write repository files. The parent supplied remote3dc3dd2d634cc64e716630c9a1ff53d65953ff60; that object was unavailable locally, so this diagnostic does not independently assert remote tree equivalence.

## Exact effective command and execution count

Within the isolated copied source and copied node_modules:

    export PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH
    npm test -- tests/m8-b5-temporary.test.ts -t "all 43 eligible child definitions bind through real Match snapshots and restore"

No timeout, worker, isolation, seed, position, route, case split or assertion policy was changed. The default5000ms remained in force. The other24 tests were filtered by the requested targeted diagnostic command, not altered/skipped in source. The effective run returned exit0,1 passed/24 filtered, 3.89s overall Vitest duration. The cached selected test-file duration was 3026.566472ms; the instrumented measured body was 3022.232425ms. Marker serialization/file output and timing wrappers add overhead and change execution characteristics; neither number is an original uninstrumented acceptance measurement. Do not use it as an acceptance run.

Two launcher failures happened before the case executed: missing /usr/bin/time, then dereferenced .bin/vitest from an over-eager dependency copy. Each raw attempted launcher/log/exit was preserved in prelaunch-missing-time and prelaunch-dereferenced-bin; the second failed at Node ESM entrypoint resolution before Vitest initialized. The copied .bin symlinks were restored, then exactly one effective case ran. No effective-test re-run or best-result selection occurred. run-once.sh is the final reproducible command. The copied node_modules retains preexisting package caches; only the selected target cache result is extracted as evidence.

## Segmentation (milliseconds, non-overlapping groups)

- 512 candidate generation and35 stable selections:18.610222 (0.6158%). Candidate generation alone14.602255; selection4.007967.
- Public equipped preparation:2327.343278 (77.0074%). Includes original helper assertions. Opening2246.749182; later public battle advances42.198396; nextRound21.663059; combine5.092007; resolveChoices3.021444; XP2.132838; deployment0.691705; equip3.933321. Nested helper times must not be added again to the total.
- serializeMatch71 calls:297.962666 (9.8590%). Start151.482418/35; after ticks142.730573/35; repeated shield save3.749675/1.
- Explicit restoreMatch71 calls:214.517586 (7.0980%). Start string107.454341/35; after-tick string104.332276/35; shield-corruption raw2.730969/1.
- Combat starts35 and175 tested ticks:88.864106 (2.9403%). Starts24.687956; three ticks/route44.092536; restored next11.449683; original next8.633931.
- Remaining assertions, excluding preparation and nested shield restoration:72.266601 (2.3912%). Full-state equality34.809627 and next-step equality34.012967 dominate.
- Shield JSON parse0.291760; unclassified wrapper/bookkeeping2.376206.

serializeMatch is canonicalContent(restoreMatch(state)), so every serialization includes a full raw-object restore validation. The explicit restore group is not total validation cost. There are142 full restore invocations across71 serialize internals plus70 string loads plus1 intentionally rejected shield raw load. The diagnostic did not separately instrument inside production validation or replace any of it. No raw TG exception was used. No production optimization was made.

## Coverage and source checks

analysis.json confirms:
- All35 ordered seed indices and matchSeed/child pairs equal the prior accepted greedy coverage map, with exact43 pool definitions.
- Actual bound children match planned children, and all routes reach2-5.
- All35 opening tick triples equal the corresponding original37-route diagnostic, totaling105 genuine opening combats and15969 combat ticks.
- The temporary shield corruption branch remains seed-index123/matchSeed78084107/crownguard+bow.
- All original test assertions completed. All87 direct expect calls in the whole source file remain; the dynamic selected-case assertion count was705 including helper accepted/level assertions.
- Both start-state roundtrip and post-three-ticks roundtrip/next-step equality execute for every route.

## Read-only evaluation of equivalent preparation deduplication

The helper cache key is JSON.stringify([seed,components]). Other tests in this file use default seed42; none of the35 TG matchSeeds is42, all35 are unique, and default test-file isolation prevents caches from other files becoming a shared opening. Therefore existing helper caching helps the seed42 cases but has no hits for TG43, both for this isolated run and from the earlier tests in this file. Each TG seed executes its own required opening. Reusing a state across seeds would change RNG streams, provenance/receipts and/or public actions and is not an equivalent permitted preparation deduplication.

At this fixed level-six2-5 control each roll binds exactly one completed child. There are 35 completed definitions; 35 public routes is the lower bound only for this fixed level-six, two-child roll mechanism with one completed child per route. It is not a mathematical lower bound across all conceivable test organizations. The512 pure plans and35 selections cost only0.62% here. Planning harder cannot remove another full route without changing the tested contract.

Two narrow candidates could be authorized separately, but neither is established as a5s solution:
1. Reuse the first start-state serialized string in the crownguard corruption branch. No state changes between the two calls; retain JSON.parse, legacy-key corruption and the explicit raw restore rejection. This removes exactly one redundant serialization, measured3.749675ms here (0.1241% of body). It does not remove any positive roundtrip, shield assertion or full restore of a distinct input. One 3.750ms observation is insufficient evidence for closing the CI207 excess of 2910ms over 5000ms; no extrapolated gain is claimed.
2. Let these known-single-use35 preparation calls opt out of storing their defensive structuredClone in the helper cache, while executing all commands and real combats unchanged. The existing cold path returns its original state, so suppressing a never-read cache entry need not change outputs. It requires an explicit fixture/API change and a proof of no future same-key use. Clone-only cost was not instrumented and no material saving is claimed.

Do not remove start or post-tick serialization/restore: these exercise different state boundaries. Do not replace either next-step call with the other's result: that would make the comparison vacuous. There is no repeat restore of an identical input in the main body beyond serialize's intentionally checked raw input followed by a string load, which cover different interfaces and validation paths.

If substantial opening savings are required while retaining35 seeds, positions,105 combats and all assertions, a separately authorized production-execution performance investigation/optimization is needed, followed by equivalent-output proof and the actual reviewer/CI5s gates. Safe cache/compilation/projection reuse would need its own dependency, invalidation, RNG/provenance and conservative-raw validation audit. No such optimization is authorized or implemented in this work. P2 remains open.

## Evidence map

segmented-results.json is the complete raw timings/routes/assertion result; single-run.log/.stderr.log/.exit are unedited output and status. environment-and-command.txt records toolchain, hardware, selected environment variables, command and timestamps. analysis.json is a derived reconciliation, generated by analyze.py. instrumentation.diff and instrument.py show all diagnostic changes; original-test.ts, original-fixture.ts and instrumented-test.ts are retained. source-before/after hashes and verification log bind original repository state; mirror-unchanged-files.sha256 binds copied source/helper/toolchain. ci207-original.log is the supplied raw CI log. prior-coverage-map.json is the committed coverage map decompressed without changes. prior-original37-segmented.json preserves the earlier opening-tick control. route-input-hashes.json/.tsv bind all 35 ordered seed/public-input metadata and source hashes to observed child/tick tuples; these hashes are not runtime Match-state hashes. diagnostic-inputs.tar.gz contains copied source/tests/config/package inputs without dependencies; the full live mirror with copied dependencies remains outside the repository. SHA256SUMS hashes the deliverable evidence files.

## Parent integration / current decision

Author integration retains the worker's original evidence and wording above. Archive `evidence.tar.gz` SHA256 is e26634049c19f35152ecfed88d9873e090ac22c2d560746e3f4f0c4e897158f6; its internal SHA256SUMS covers 50 files. Sources correspond to local5e8ea0e / remote3dc3dd; subsequent browser diagnostic/docs commits do not change TG or production input. The local/remote mapping is author-side evidence, not a claim of independent whole-tree certification.

The original public opening is **105 battles / 15969 ticks across 35 seeds**. The lower-bound argument is limited to the current level-six two-slot roll that provides one completed child, covering 35 completed definitions; it does not prohibit all alternative test designs. No route, real battle, tick, definition or original assertion has been removed. No raw Herald fixture exception is applied.

CI207's exact TG observation is **7910ms**, over its unchanged5000ms by2910ms. A single duplicate serialize observed at3.750ms cannot establish a fix for that gap; no speculative scaling is used. Production opening execution accounts for77% of this diagnostic body. There is no proven substantial, legal within-scope preparation deduplication left. User authorization for bounded production opening performance investigation is pending; no production optimization has started.

CI208 /3dc3dd later passed test-and-build:132files,1852pass/10originalskip,460.04s, plus build/headless/performance, as reported by the CI monitor. This does not erase CI207 or two independent TG timeout reproductions, and does not establish stable headroom. Input-dev remains a separate unresolved diagnostic item. All first failures are preserved, no unchanged test reruns were used to select a green result.
