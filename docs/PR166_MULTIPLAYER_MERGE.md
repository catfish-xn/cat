# PR166: multiplayer merge evidence

## Inputs and merge method

- PR branch: `codex/fix-task-mechanism-restore`.
- Starting head: `55a80709da545e97d91a2d369ddc7ed0052f84be`.
- Fetched multiplayer: `0719ced60ade353a238024d757cf9440701f6aaa`.
- Both heads were independently checked with `git ls-remote` before work and after fixture generation. PR170 was not merged at that point and was not separately included.
- Ordinary two-parent merge, no rebase or force push. Separate worktree; PR168's worktree and existing uncommitted files were not changed.
- Runtime: Node 24.19.0 / npm 11.9.0; isolated `npm ci --ignore-scripts` from the unchanged lockfile. Existing shared dependencies were insufficient for Node/ws types; an independent install fixed the environment without modifying another worktree.

## Conflict resolution

1. `serialization.ts`: retained multiplayer's public facade and history validation unchanged. Migrated PR166's four semantic changes to `serialization-structure.ts`: create/share the restore replay for sampled facts, validate task/summon facts, treat Sion/Bulky Buddies as historical facts, and recognize Morgana's `g22Curse` attached task binding.
2. `replay/history.ts`: preserved multiplayer equipment command capture, immutable snapshots, and crown-history validation. Retained PR166's frozen-ledger incremental FNV hash cursor and cached state/event hashes; invalidation stays at the start of the same-combat observation branch. Restored records still undergo complete validation before hash reuse.
3. Herald manifest: generated through the independent recorder, not by choosing conflict sides or editing fingerprints. The initial default verification compared every raw case and trajectory successfully before failing only on the conflicted manifest. After that evidence, the same recorder's `--write` regenerated its seven outputs; all five raw files and trajectory remained byte-identical to multiplayer.
4. Input audit: generated with `node scripts/record-g2-3-inputs.cjs` after the Herald recorder, then verified with `--check`.

Optional resistance/shield replay sharing was deliberately deferred. It requires adding full shield-layer facts and proving identical trusted source selection, tick checks, sorted full-layer comparisons, and cache identity. Existing independent shield validation is unchanged; no validation was removed or weakened.

## Fixture verification

- Default `node tests/fixtures/record-g2-3-herald.cjs`: 39.786 s; expected manifest-only mismatch while conflict markers remained. All five raw exports, trajectory, production restores, and start-plus-fifteen-tick checks passed first.
- `node tests/fixtures/record-g2-3-herald.cjs --write`: passed, 39.970 s; raw bytes unchanged.
- `node scripts/record-g2-3-inputs.cjs`: passed, 9 cases, 3.179 s.
- `node scripts/record-g2-3-inputs.cjs --check`: passed, 9 cases, 2.934 s.
- `tests/fixtures/g2-augments-herald-raw` is byte-identical to multiplayer. `verify-m8-herald-fixtures.cjs --write` was never used.
- Independent read-only review verified all 259 source fingerprints and the canonical aggregate hash. Manifest changes are limited to source fingerprints; generation markers, cases, trajectory, content/schema/rules versions remain unchanged. Audit current byte counts and SHA256 values match actual files.

## Focused acceptance

Each selected complete test file was run once, serially, with no test-name filtering, skipped tests, deadline changes, or gameplay value changes. The cannon file uses the existing timing project and original 180000 ms case timeout. No full-suite claim is made.

Typecheck passed in 10.534 s after the independent dependency install. The branch delta versus multiplayer passes `git diff --check`; an existing upstream extra EOF blank line in `docs/evidence/g2-4/G2-4B-FORGES-PLAN.md` was left untouched.

| Complete file | Passed | Vitest duration | Wall time |
| --- | ---: | ---: | ---: |
| `tests/task-mechanism-restore.test.ts` | 20 | 11.79s | 0m12.083s |
| `tests/restore-audit/combat-accumulators.test.ts` | 1 | 1.41s | 0m1.672s |
| `tests/m8-b7-audit-vectors.test.ts` | 14 | 23.57s | 0m23.874s |
| `tests/m8-b7-catalog.test.ts` | 5 | 375ms | 0m0.636s |
| `tests/m8-b7-cleanup.test.ts` | 5 | 1.47s | 0m1.731s |
| `tests/m8-b7-known-limitations.test.ts` | 2 | 868ms | 0m1.147s |
| `tests/m8-b7-match-wiring.test.ts` | 30 | 20.20s | 0m20.497s |
| `tests/m8-b7-mechanisms.test.ts` | 21 | 1.04s | 0m1.332s |
| `tests/m8-b7-serialization-reuse.test.ts` | 6 | 1.79s | 0m2.037s |
| `tests/m5-replay-cannon.test.ts` | 1 | 86.37s | 1m26.640s |

Total: **10 complete files, 105 tests passed, zero failures or skips**. Raw logs and machine-readable results accompany the delivery bundle.

## Delivery status

Publication was not retried: the existing platform write-quota refusal remains in effect, and the Git transport has no publishing credentials. No alternative credential or write route was used. The ordinary merge commit is delivered as a Git bundle with source ZIP and validation logs; remote publication and CI for that commit are not claimed.
