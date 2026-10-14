# TG definition-level preparation deduplication, no route-position changes

## Scope
This batch implements only stable seed planning inside the existing all-43-definitions test. The parent explicitly confirmed definition-level coverage as the acceptance granularity. No helper, production code, test timeout, worker count, skip, case split, or setup outside the test timer changed.

Changed file: tests/m8-b5-temporary.test.ts.
Unchanged fixture SHA256: 19086bab7b487c06dd7ef4a643cc81e4c3f573016d2ece158f656571f77e4836 for tests/fixtures/b8-public-equipment.ts. Original Maddie/Lux positions are retained.
HEAD before this uncommitted patch: 25a7fe3d5c099ae582a4e0a48717f7e323636dae; executable baseline d2011ae3fff2744cb56a63a8c5c7176eb4a7f7d0.
Exact patch and file hashes: change.diff, source-before.sha256, source-after.sha256.
No commit by this worker.

## Coverage
Pure generateRoundRolls plans all 512 candidates inside the existing case. Stable greedy selection favors two unseen child definitions and uses ascending seed as the tie-break. Coverage is added only from the actual publicly equipped Match state. Each retained route still executes the original public opening, paid XP to level6, equipment binding, start serialize/restore equality, temporary shield corruption rejection when present, three ticks, post-tick serialize/restore, and restored/original next-step equality.
The original final 43 count is retained; added assertions check the exact 43 pool definitions, exactly 35 public routes, and a non-vacuous crownguard shield corruption branch.
All separate fixed-number assertions and the complete parameterized corruption matrix are unchanged.

Two specific pair combinations are removed; definition-level coverage is retained, pair coverage is not identical:
- seed-index3 / matchSeed3668339987: deathblade + bow. Neither original case executed the temporary shield negative branch. Deathblade remains in seed-index2 with cloak; bow remains with hand-of-justice (27), sunfire-cape (83), and crownguard (123).
- seed-index4 / matchSeed2027808452: deathblade + gloves. No temporary shield negative branch. Gloves remain with steadfast-heart (12), warmog (28), jeweled-gauntlet (36), archangel (76), gargoyle (108), and deathcap (236).
The original shield negative control remains seed-index123 / matchSeed78084107, crownguard + bow.
Full original-to-new seed/pair mapping is in coverage-map.json; it was generated with actual generateRoundRolls under Node22 and matched against all original 37 public-route records.

## Verification
Toolchain for both commands:
  export PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH
  node v22.23.3; npm 11.9.0
Commands, unchanged defaults:
  npm test -- tests/m8-b5-temporary.test.ts
  npm run typecheck
Outputs and exit codes retained in temporary-original-command.log/.exit and typecheck.log/.exit.
The exact requested test command passed 25/25, exit0, total 4.45s. The default reporter did not emit per-case passing durations. Typecheck passed, exit0.
The original isolated single-file baseline also reported total 4.45s; these are not evidence of stable headroom. This 35-route change theoretically reduces expensive public routes by 5.4%, but does not establish that the original recorded 5413ms full-run failure is fixed. No new full-suite run was performed by this worker. Earlier Lux-position candidate passes do not count toward this batch.

## Separation from prior diagnostic batch
Read-only diagnostics, original segmented timings, old route snapshots, CPU profile, and the withdrawn Lux-front candidate are preserved separately in /tmp/b8-timeout-fix/tg/. That folder was frozen before this new batch.
