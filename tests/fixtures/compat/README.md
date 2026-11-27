# Spoils compatibility baseline

`pre-spoils-seed42.json` freezes the review-E public route:
`createMatch(42) → resolveM5Choices → fieldBench → startMatchCombat → stepMatch` until settlement.

Generated in an isolated `/tmp` copy of `23ff9d74307bfe7664efc3f3ee5d24c237697ec6`,
with only `src/simulation/g2-3-settlement.ts` replaced by its pre-fb3prog version
from `808d16ae` (`git show 808d16ae:src/simulation/g2-3-settlement.ts`).
The baseline exporter asserted its own serialize/restore round trip before writing the bytes.
No digest fields were patched. Review E's original pre2 JSON has an older content
identity; regenerating with current content isolates this settlement compatibility
check from the separately recorded v23 content epoch.

The regression requires exact serialized byte equality and restores the frozen
JSON with independently recorded battle history before comparing subsequent rounds.

## v24 content identity

`pre-spoils-v24-seed42.json` repeats the same public seed-42 opening with the
unchanged working-tree source at `8aa8c627` and **only** the settlement module
replaced by `git show 808d16ae:src/simulation/g2-3-settlement.ts` at bundle time.
The exporter checks `restoreMatch(serializeMatch(state))` before writing; no
digest is patched. The original v23 baseline above remains untouched.

A structural comparison against `pre-spoils-seed42.json` has exactly five differences:
`rulesVersion`, `contentVersion`, `contentDigest`, `combatInputBasis.contentDigest`,
and `m8.loot.frozen.replayDigest`. All combat, reward, receipt, RNG and roster data
are identical. The current settlement implementation must still match the new
pre-Spoils bytes exactly and continue both following rounds with full history.

## v25 content identity

`pre-spoils-v25-seed42.json` uses checkout `97068956` with the same isolated
pre-Spoils settlement module from `808d16ae`. Reproduce into a **new** file with:

```sh
git show 808d16ae:src/simulation/g2-3-settlement.ts | node scripts/export-pre-spoils-compat.cjs /tmp/pre-spoils-v25.json
```

The exporter verifies its own serialize/restore, then checks that every gameplay
field equals the retained v24 fixture. Exactly the same five identity fields
listed above differ; no digest is patched and neither earlier fixture is changed.
The regression still requires exact serialized byte equality and continued replay
of both following rounds. This is a settlement compatibility fixture, not epoch
evidence or an old-identity save migration.

### v25 Starry Night identity refresh

At `e0147d72`, both pre-Spoils parameter cases were independently checked against
the retained v25 bytes before updating this fixture. Only `contentDigest`,
`combatInputBasis.contentDigest` (`229d9f7e` → `f671ab88`), and the derived
`m8.loot.frozen.replayDigest` (`55f72339` → `36ebfac2`) differ. Reversing those
identity substitutions restores the old file byte for byte. No gameplay data was
regenerated; v23/v24 files remain unchanged. Full hashes and the corresponding
Swarm/B9 proofs are recorded in [V25_STARRY_PINS.md](../../../docs/V25_STARRY_PINS.md).

## v26 neutrals-1424 identity

`pre-spoils-v26-seed42.json` repeats the same isolated pre-Spoils settlement export (module from `808d16ae`) on
the v26 integration head `707eed25` (`s13-g2-3-v26-neutrals-1424`). `scripts/export-pre-spoils-compat.cjs` was run
unchanged except that its v24 gameplay-equality check was skipped, because v26 intentionally changes the 1-2 fight.
Against `pre-spoils-v25-seed42.json` the only differences are: the identity fields (`rulesVersion`, `contentVersion`,
`contentDigest`, `combatInputBasis.contentDigest`, `m8.loot.frozen.replayDigest` `36ebfac2` → `a56b2c4a`), the new
null `anomalySelection`, and the 1-2 minion combat outcome (14.24 neutral stats from `568eeea4`, targeting/melee pathing
from `8106acee`/`34cfbfbb`: deaths at ticks 155/274 instead of 69/164, `combatTicks` 274, `baseDamage` 0). These match
`tests/v26-anomaly-identity-audit.test.ts`. The v23/v24/v25 files are unchanged. SHA-256:
`3e1ca4c8ad23abe7044c1be70fb9e86ce38d93bd87ec91b4d5ef5aa626f05bd7`.

2026-11-09 塞维卡三连/头奖: `pre-spoils-v26-seed42.json` identity-only refresh, `contentDigest` (×2) `150d825d` → `c7f0a2f3`
and `m8.loot.frozen.replayDigest` `a56b2c4a` → `b53841c0`; no other byte changed. SHA-256:
`8b14766028027050af86186218f274b254a4b258d813a8cc5e136ff646e57167`.

2026-11-09 塞维卡老虎机转完再出手: identity-only refresh again, `contentDigest` (×2) `c7f0a2f3` → `f37c6970` and
`m8.loot.frozen.replayDigest` `b53841c0` → `9c98c8ef`; no other byte changed. SHA-256:
`8648179a96e0091283e61cf1e2f1fc8cf13d665df42dc1805f0e54b00d0cbaf8`.

2026-11-12 14.24b 七项英雄数值 (b-patch-overrides.json): identity-only refresh, `contentDigest` (×2) `f37c6970` → `db6dc9b6`;
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. SHA-256:
`a895917a2707e529fe319fd3d2c4dbc0c7667f877092313d0f9bb8eca3dfc6fe`.

2026-11-12 施法事件带 castIndex、回放格式 8→9 (#628): identity-only refresh, `contentDigest` (×2) `db6dc9b6` → `d94c78f1`
(content-digest.ts covers `replayFormatVersion`); `m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed.
Exported with `git show 808d16ae:src/simulation/g2-3-settlement.ts | node scripts/export-pre-spoils-compat.cjs <out>`, v24 gameplay
check skipped as above. SHA-256: `f2be9d16394fc40944810cb7c8461ee33734b1feec4ce479df19d96456580682`.

2026-11-19 远程普攻命中才结算、存档/回放格式 9→10 (#739): identity-only refresh, `contentDigest` (×2) `d94c78f1` → `cf212873`
(content-digest.ts covers `M8_VERSION`); `m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed (the 1-2 fight
fields only melee units). Exported with the same command, v24 gameplay check skipped as above; the export equals the old file
with that one substitution. SHA-256: `9164136961297336b3fed3376a006ed77c36cdec879635715977ce30c79b80e6`.

2026-11-20 技能落地结算批: identity-only refresh, `contentDigest` (×2) `cf212873` → `2f642cc0` (`S13_COMBAT_RULES.skillLanding`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed (the 1-2 fight has none of the batch's heroes).
Exported with the same command, v24 gameplay check skipped as above; the export equals the old file with that one substitution.
SHA-256: `65b0a55d862a47254941e29386f36f5a23bb4422eb4da0c329ddfa7067d80b76`.

2026-11-21 死亡判定随机键 v1: identity-only refresh, `contentDigest` (×2) `2f642cc0` → `6983672c` (`S13_COMBAT_RULES.deathRollKeys`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `81cda1aa2103d88fa9f1dd4a05d01a670d69cbaf379c5929a0226c05c3262aa4`.

2026-11-21 玛尔扎哈门线 v1: identity-only refresh, `contentDigest` (×2) `6983672c` → `57428247` (`S13_COMBAT_RULES.malzaharGate`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `bea914e1e7464436978a0c0bdf8f79526b6091e88470f73ceb0a1d3386a02344`.

2026-11-21 黑默丁格火箭集火 v1: identity-only refresh, `contentDigest` (×2) `57428247` → `31713f8c` (`S13_COMBAT_RULES.heimerFocus`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `0f5eaf021d9a71a91d2ca4e0898779b6867fd66c2d13d0dd5c316685f34ad0ee`.

2026-11-21 斯维因吸取节奏 v2: identity-only refresh, `contentDigest` (×2) `31713f8c` → `b74b81b0` (`S13_COMBAT_RULES.swainDrain`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `31bb6479bddf6154650f07a876a5cea84ecc5026affe0abc236cc4630e49aa6f`.

2026-11-21 梅尔施法 v3: identity-only refresh, `contentDigest` (×2) `b74b81b0` → `1ca19aae` (`S13_COMBAT_RULES.melBarrage`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `9a79ad7b0951446b60cfa8d40f33d945597dc16fe9214a9f2303345adbeccbad`.

2026-11-21 蔚奥莱连击 v1: identity-only refresh, `contentDigest` (×2) `1ca19aae` → `6130956b` (`S13_COMBAT_RULES.violetCombo`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `1c671200e937fc4c9314adae73ce9cad90c46da75fb1e4b08563a4e8935fde1a`.

2026-11-21 金克丝飞弹 v1: identity-only refresh, `contentDigest` (×2) `6130956b` → `946379e4` (`S13_COMBAT_RULES.jinxRocket`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `0c5dc2edf45e135360dda9d628ee319d95f91bb0ef74f37b5a38cd0474125f10`.

2026-11-21 蔚砸地时刻 v2: identity-only refresh, `contentDigest` (×2) `946379e4` → `36e7e2c1` (`S13_COMBAT_RULES.viSlam`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `da6aae59bf6c4ed67b6edad1dda82e1a851b0742ecd8ae6e94c41e3a634da9a2`.

2026-11-21 梅尔连发 v1: identity-only refresh, `contentDigest` (×2) `36e7e2c1` → `57ffb53e` (`S13_COMBAT_RULES.melBolts`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `34d246b6d8112dcd3e3226f3c5657a28f5ba4708b125a01756af4649122a2f50`.

2026-11-21 杰斯水晶连锁 v1: identity-only refresh, `contentDigest` (×2) `57ffb53e` → `33d330e9` (`S13_COMBAT_RULES.jayceCrystals`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `de2e71ca291be0bfaace09696c993cf73540528b5b1d1875589e30f16de61054`.

2026-11-21 远程普攻前摇 v1（含 11-24 取消情形）: identity-only refresh, `contentDigest` (×2) `33d330e9` → `d6493c11` (`S13_COMBAT_RULES.rangedAttackWindup`, `rangedAttackWindupCancel`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `8e0f13ee07f7749d9f1ae700c4ae4179b425ae4dee26cb6bf2a8e69c887c4658`.

2026-11-24 蔚奥莱连击 v2: identity-only refresh, `contentDigest` (×2) `d6493c11` → `8bb37864` (`S13_COMBAT_RULES.violetCombo`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `12397518f2ec53cf663705c724d7ed4b32997cabc7c2bb02443204e0186aa6c5`.

2026-11-24 塞薇卡重拳 v1: identity-only refresh, `contentDigest` (×2) `8bb37864` → `64c5e278` (`S13_COMBAT_RULES.sevikaPunch`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `b7a2743fc7093deeea21eccc5d190dd64de6d715434357eaf6ce8e1821418aad`.

2026-11-24 卡西奥佩娅主弹 v1: identity-only refresh, `contentDigest` (×2) `64c5e278` → `eb067864` (`S13_COMBAT_RULES.cassiopeiaBolt`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `964aff5c255073c73575f85e647a48f9fb787c815933504b303cf205a34167a0`.

2026-11-24 斯特卜治疗 v1: identity-only refresh, `contentDigest` (×2) `eb067864` → `85411c71` (`S13_COMBAT_RULES.stebHeal`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `ee4d7c81071ae346c87a64df48e96344c279d4b4b02c67bb664dae68f9ad255d`.

2026-11-25 金克丝大火箭镜像 v1: identity-only refresh, `contentDigest` (×2) `85411c71` → `190a62ea` (`S13_COMBAT_RULES.jinxRocketMirror`);
`m8.loot.frozen.replayDigest` unchanged (`9c98c8ef`); no other byte changed. Exported with the same command, v24 gameplay check
skipped as above; the export equals the old file with that one substitution. SHA-256: `d7f70b3cacb28052e6eefbc4899181b54b31321896d2c1ee0214dc09d7d906bb`.
