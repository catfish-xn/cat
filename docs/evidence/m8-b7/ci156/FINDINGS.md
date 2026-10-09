# B7 WIP CI156 diagnosis

Read-only diagnosis of https://github.com/catfish-xn/cat/actions/runs/37963368019
Exact SHA: e29c91e61af6ed9e32cfdb701bcadb6caa66c138. Run completed with failure.
No reruns, code edits, fixture edits, workflow edits or repository commits made.

## Verified first failing cause: one shared stale golden-content digest

All 9 failed jobs stop on:
AssertionError: golden contentDigest: review explicit rule/version change
Actual: fnv1a32-utf16:610d9dce
Expected: fnv1a32-utf16:c1704f5d
Shared assertion: tests/fixtures/m5/assert-golden.cjs:3:197.

This is verified from all nine raw job logs, not inferred from job names.
The fixture full-match-golden.json at the tested SHA still stores c1704f5d for all four routes.
The tested commit adds approved neutral encounter catalog/policy/definitions to CONTENT_DIGEST in src/simulation/content/index.ts, replaces opening/PvE placeholder enemies with COMPILED_NEUTRAL_ENCOUNTERS in src/simulation/round-enemies.ts, and changes ROUND_PREPARATION_RULES in src/simulation/round-schedule.ts. It does not update the golden fixture.
Therefore the observed mismatch is consistent with an intentional content migration whose existing fixture has not yet been reconciled. These logs do not independently validate all resulting combat values or prove that a digest-only replacement is sufficient.

## Failure groups and exact scenarios

1. test-and-build-sample1 (113931502904): npm test step fails.
   - tests/m5-route.test.ts:12:98: normally buys five-cost Caitlyn and fields her for at least two real battles.
   - tests/m5-route.test.ts:19:70: cannon, sniper, mage ordinary purchases/rewards to 6-7 with a complete build.
   - tests/m6-integration.test.ts:25:5: cannon, sniper, mage, sniper-caitlyn every completed battle has exact original state/events and isolated playback.
   - 2 files failed, 109 passed; 8 tests failed, 1399 passed, 10 skipped (1417 total).
   - Subsequent build, dedicated headless and performance steps were skipped. The npm test output itself includes all four successful m5-replay cases; do not confuse that with the skipped dedicated headless job step.

2. input-dev-sample1 (113931502942), input-preview-sample1 (113931503021):
   - Native-input phase reports passed:true, cases:31, with 5 explicit B8 dependency skips.
   - Subsequent cannon touch route fails in scripts/verify-m5-browser.cjs:14:118 at the shared golden assertion.
   - The input job is failed overall; its prior native-input phase is partial positive evidence, not a full touch-route pass.

3. browser-dev/preview cannon, sniper, mage (six jobs):
   - Each normal-time complete route fails in scripts/verify-m5-browser.cjs:14:118 at the same shared assertion.
   - Source order matters: line14 generates a headless route and checks the golden; line16 starts Vite; line18 launches Chromium. The route browser has not been started when this assertion fails.
   - Thus these failures do not expose a browser, normal-time combat, deep-restore or playback defect. Those downstream checks remain untested by these jobs.

## Masked checks and recommendation

assert-golden.cjs checks versions before seed, normal-input command transcript and all per-round state/event hashes. The first contentDigest error prevents those later assertions. Review and regenerate the full trajectory fixture under the intended approved migration with independent economic/resource/RNG checks; do not merely replace the digest and assume the rest is correct.
The active implementation worker was informed of the shared failure and masked coverage. Re-run the relevant checks only after its authorized changes are complete; this diagnosis initiated no rerun.

## Other same-SHA jobs

Succeeded: m7-presentation-sample1 (113931502567), m6-retention (113931502828), m8-u3-dynamic (113931502953).
Skipped: compare-evidence-sample${{ matrix.sample }} (113935356756), plus heap-diagnostics and warmup-experiment.
CI156 totals: 3 successful, 9 failed, 3 skipped jobs. No final compare pass exists for this SHA.

## Historical baseline, distinct SHA

CI155 https://github.com/catfish-xn/cat/actions/runs/37961827132 completed successfully for da801827d8fd267fef23c1648f091af4baf4c55c, not e29c91e.
Verified 13 jobs successful, 2 optional jobs skipped, including final compare-evidence-sample1 job113935028100.
This historical success must not be represented as passing CI for the B7 integration SHA.

## Evidence files and sanitization

Each .sanitized.log retains the complete failing test/route step output, its first failure, stack, outcome and existing skips. Setup/checkout, shell/environment configuration, upload and cleanup sections were excluded; ANSI formatting and runner workspace path prefixes were stripped. No credentials or environment configuration are retained.
jobs.json gives exact job IDs, links, file mapping, first-failure timestamps and retained line counts.


