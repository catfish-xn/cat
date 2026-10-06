# M6 F1 storage prototype

This evidence is a standalone Chromium/IndexedDB prototype on unchanged M5 production code, not implemented M6 acceptance. Base SHA and dirty paths, CPU, runtime and raw 12-sample distributions are in JSON evidence. No tracing/CPU throttling was used. Duration includes actual IndexedDB transaction `complete`, not request success.

| Payload | UTF-8 bytes | full clone p95 ms | full IDB write p95 ms | JSON.parse p95 ms |
|---|---:|---:|---:|---:|
| cannon complete, 30 battles | 9,882,682 | 224.3 | 345.0 | 61.8 |
| largest complete route, sniper, 30 battles | 13,973,361 | 244.8 | 318.5 | 103.3 |
| sniper final active prefix, 29 completed | 13,969,713 | 162.6 | 321.4 | 67.0 |
| largest incremental prefix, round 34, 28 completed | 13,754,070 | 215.6 | 283.0 | 99.2 |

The final-round active-prefix incremental capture keeps immutable completed records in a separate store and writes only references, Match and the active prefix: 355,459 bytes, capture p95 6.3 ms, transaction p95 13.6 ms. The final completed-route incremental payload has no active prefix and must not substitute for this result. Completed history is inserted once; repeated incremental writes do not put those records again.

The largest measured incremental prefix (round 34, 3,254 events) is 1,164,071 bytes: capture p95 16.8 ms and transaction p95 31.9 ms in a dedicated repeat after E stopped route generation. A preliminary overlapping-CPU run is separately retained as M6_F1_STORAGE_MAX_CURRENT_SHARED_CPU.json and is not the final baseline.

Candidate F1 budgets grounded in these measurements: incremental capture p95 ≤ 30 ms; incremental transaction p95 ≤ 100 ms; full manual snapshot capture p95 ≤ 500 ms; full activation/archive transaction p95 ≤ 1000 ms. The final implementation must be remeasured against these fixed budgets with its validation/callback overhead; these are prototype ceilings, not claims of final production compliance or a frame-rate target.

Successful prototype checks: stale write after same-run reactivation rejected; another IndexedDB connection's newer revision conflicts; forced transaction abort retains current; captured snapshot remains fixed; failed fourth archive retains first three; successful fourth archive atomically evicts oldest.

Reproduction after generating E's payloads:

```
node scripts/m6-storage-prototype.cjs work/m6-f1-payload.json docs/evidence/M6_F1_STORAGE_COMPLETE.json
node scripts/m6-storage-prototype.cjs work/m6-f1-sniper.json docs/evidence/M6_F1_STORAGE_MAX_COMPLETE.json
node scripts/m6-storage-prototype.cjs work/m6-f1-current-prefix.json docs/evidence/M6_F1_STORAGE_CURRENT.json
node scripts/m6-storage-prototype.cjs work/m6-f1-incremental-prefix.json docs/evidence/M6_F1_STORAGE_MAX_CURRENT.json
```

Limits: JSON parsing excludes restoreMatch and full historical replay validation, which E measures separately. No quota exhaustion was induced; the abort proof does not substitute for production quota-failure handling. The conflict probe uses two same-origin IDB connections in one page, not a two-tab product UI. Archive copies here deliberately measure full payload writes; final schema should share immutable completed battle records rather than rewrite entire archives. Samples cover legal complete routes, not every possible legal seed/strategy or a mathematical bound on maximum events. The final active prefix is a valid heavy-history sample, not a proof of maximum active-event payload.

Lifecycle probe: `node scripts/m6-storage-lifecycle.cjs` ran 30 real IDB connection and DOM-listener create/dispose cycles. Active connections ended at zero, no post-dispose event callbacks fired, and GC heap increased 54,000 bytes. This covers prototype ownership only, not Phaser/tween/session product cleanup; see M6_F1_STORAGE_LIFECYCLE.json.
