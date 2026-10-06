# Versioned test migration

The M4 baseline passed 568 tests before implementation. M5 deliberately changes economy, content, schedule and schema; these original test programs are kept verbatim as versioned artifacts in `tests/historical/m4/*.ts.txt`. They are not silently rewritten to new golden values. The M4 golden JSON remains unchanged. The list below identifies replacements; replacement completion must be proven by actual M5 evidence, not this mapping.

Unchanged board, deployment, RNG, upgrade, damage, mana, pathing, generic effect and native-input defects remain active tests. Generic snapshot, inventory, shop/progression and basic command tests are migrated with independent M5 expectations, not classified as obsolete.

| Historical artifact | Version dependency and replacement |
|---|---|
| `m4-full-match.test.ts` | M4 v4 golden only; replaced by m5-route/m5-replay and independent M5 ledger; original golden JSON retained unchanged. |
| `match-replay.test.ts` | M4 v4 golden replay only; replaced by m5-replay per command/tick/negative insertion on M5. |
| `m4-multi-seed.test.ts` | M4 schedule/content oracle; replaced by the same fixed 24 seeds in verify-m5-headless with independent M5 ledger. |
| `m4-long-growth.test.ts` | M4 content acquisitions; 3-star merge remains upgrades tests, M5 19-unit acquisition and Caitlyn natural route replace obsolete content IDs. |
| `m4-match-strategy.test.ts` | M4 R2/R5/R7 choice timetable and two-stage M4 builds; replaced by three M5 command routes and source snapshot assertions. |
| `m4-content-combat.test.ts` | M4-only 20 items/8 augments/8 anomalies; historical numbers retained; replaced by 16/6/3 M5 content and independent combat tests. |
| `m4-serialization.test.ts` | Schema4 only (explicitly unsupported by M5); original negative cases retained as artifact; M5 restore/replay and native regression tests cover schema5. |
| `m4-content.test.ts` | M4-only 18/11/6/20/8/8 catalog and previous acquisition schedule; replaced by M5 validated content manifest and negative tests. |
| `m4-rewards.test.ts` | M4 recurring component grants/recruitment removed by specified finite M5 schedule; replaced by M5 choices, receipts, 15-component conservation and supply tests. |
| `m4-session-observer.test.ts` | M4 normal route and old effect IDs; observer isolation/release checked by migrated capacity test and M5 browser/full event consistency. |
