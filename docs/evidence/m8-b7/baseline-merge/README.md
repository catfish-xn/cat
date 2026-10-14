# B7 baseline merge checkpoint

Merged accepted baseline `947ac7151e180a70446aeece09d8c9e500f2a4b9` into existing B7 head `469afdae118c81e8c8ec44bc96b139552915455f` with two parents; no rebase or force update. Git reported no textual conflicts. Imported baseline changes (including existing UI/CI changes) are not new B7 edits.

The one intentional reconciliation is `tests/m8-b7-known-limitations.test.ts`: the historical assertion required an applied stun before lethal damage and then death cleanup. PR22 fixed this exact B3 defect. Keep the original HP100/maxHP1000 → raw150/hpDamage100 case, but now require no applied stun and no fake death cleanup. Add the independently calculated HP1000 → HP850 case and assert packetDamage before stun with interval [2,12). Neither case deletes, skips, or weakens the approved semantic requirement. No B3 implementation or frozen contracts changed.

This checkpoint precedes formal B7 game wiring. Validation results follow in the accompanying logs.

Node 22.23.3: typecheck passed; four focused files, 42 tests passed (B7 catalogs/mechanisms/migrated order plus B3 control-order regressions).
