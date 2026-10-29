# EXT-2 完成报告：v25 分支合并与种子漂移（codex/v25-integration-2）

- 起点：`claude/v25-integration` @ `d239794b`
- 目标分支：`codex/v25-integration-2`（新建，只推送此分支）
- 状态：**Step 1（13 个分支合并 + 内容 digest 再生）已完成；Step 2（种子漂移修复）未开始**，用户于 2026-10-28 00:17（台北）指示停止等待测试、先提交推送。

## 一、合并记录（按任务文件顺序，每个分支一个 merge 提交）

通用规则（每个合并都适用）：
- `docs/*.md`：双方并集。
- `src/simulation/content/identity-constants.ts`、`scripts/tests/production-size.test.ts`：一律取 ours，合并完毕后统一用 `node scripts/update-content-identities.cjs --write` 再生，并同步 production-size 测试里的 digest（最后一个独立提交 `411cd74d`）。
- 注册表类文件（`content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts`、`augment-stage-bans.ts`、`rules-manifest.ts`、`augment-history-owners.ts`、`augment-history-types.ts`、`combat-types.ts`）：import 与条目并集。
- `validate-content.ts`：MECHANIC_FIELDS 并集；augments 计数公式前置 `Object.keys(AUGMENT_BATCH5_Gx).length+`。
- `augment-pool-grants.ts` `batch1GiftPlan`：`??` 链前置新批次，`concat(...)` 追加新 reward plan。
- `shared-pool.ts` `restoreSharedOrbSnapshot`：owner 检查与 receiptId 命名空间检查都加入新批次。
- 独立 oracle（`tests/fixtures/m5/oracle.g2.cjs`、`augment-rewards-oracle.cjs`）：offers、STAGE_BANS、TEAMUP_TRAITS、EXCLUSIVE_GROUPS、initial 礼物、hook 全部并集；`AUGMENTS.length` 断言随目录总数递增。
- `tests/m5-content.test.ts`、`tests/m5-oracle-augment-ledger.test.ts`：目录总数与各档 groups 递增（285 → 306）。

| 分支 | 冲突文件数 | 关键逻辑冲突与解法 |
| --- | --- | --- |
| r1 `6948975f` Tomb Raider I/II（`307b2e9f`） | 注册表/oracle 类 | 全部并集。 |
| r2 `a403319b` Anger Issues / Another Anomaly（`b97f196c`） | 注册表/oracle 类 | 全部并集。 |
| r3 `9e883e00` Cloning Facility / Hall of Mirrors（`0b5fdb78`） | 注册表/oracle 类 | 并集；Hall of Mirrors 三节点全禁保持（`['2-1','3-2','4-2']`）。 |
| r4 `ea36308d` Mad Chemist（`6538bd2e`） | 注册表/oracle 类 | 并集。 |
| r5 `7acb53c5` Starry Night/+（`a9ce8982`） | `augment-pool-shop.ts`、`rules-manifest.ts`、`shop-augments.ts`、`shop-history.ts`、`tests/augment-pool-shop.test.ts`、oracle | shop 池改为 `...AUGMENT_BATCH5_R5`（删除 HEAD 内联 starry-night）；oracle 追加 `starryChanceBps/starrySharedShop`。 |
| r6 `1ede4ee7` Pandora's Bench / Recombobulator | `match.ts` 两处回合进入点、`carousel.ts`、`shared-pool.ts`、`resource-provenance.ts` | `match.ts`：`grantCookingPotGrowth(enterH13ItemRound(recordAugmentRoundEntry(...)))` 后接 r6 的 `transformPandorasBench`；accept 块同时保留 head-start 与 recombobulator 行。`carousel.ts`：r6 把 `validateAugmentHistory` 提前，删掉 HEAD 尾部重复调用，保留 titanic/release/TombRaider/MadChemist 校验。 |
| g1 `6384c9e5` Lucky Gloves/+（`447b11b0`） | `match.ts`、`shared-pool.ts`、`b8-restore.ts`、`combat-input.ts`、`temporary-equipment.ts` | `match.ts` 两处 `gifted` 条件追加 `lucky-gloves`；`shared-pool.ts` 在 MadChemist 校验后加 `validateMatchEquipment`（G1 或 lucky roll 存在时）。 |
| g2 `8a3ce67b` Ghost of Friends Past / Rebel Resurgence（`5d3c689c`） | `augment-death-samples.ts`、`b8-restore.ts`、`combat-input.ts`、`combat-s13.ts`、`combat-s13-state.ts`、`effects.ts`、`g2-4b-gold-restore.ts`、`two-sided-battle.ts`、`augment-pool-batch2.ts` | `isAugmentOrdinaryHero` 加 `!unit.rebelCopy`，样本同时保留 `form/championCopy`；`combat-input` 两处类型加 `ghostFriendsGrowth?`；`combat-s13` 先 `settleH11Deaths` 再 `settleGhostFriendsDeaths`；`two-sided-battle` 装备检查改 `(!u.rebelCopy || u.equipment.length>0)`；batch2 gap 表移除 rebel-resurgence 与 snipers-nest（双方各删一条）。 |
| g3 `edacaf50` Aerial Warfare / Natural Selection（`cdb2e2ba`） | `combat.ts`、`combat-s13-state.ts`、`strategy-snapshot.ts`、`seat-view-adapter.ts`、`tests/augment-pool-source.test.ts`、`tests/augment-stage-bans-audit.test.ts` | `combatPreparation`：`projectG23Summons(projectR3Preparation(...))` → `excludeMutationSacrifice` → `projectItemSummons`；AP/AD 公式同时含 `aerialWarfareBonus` 与 `ghostFriends`；`strategy-snapshot` 保留 r3 `openingTraits` 再做 `mutationEquipmentProjection`；`augment-pool-source.test.ts` 的 `migrated` 查找泛化为 `G3??G2`（g2 分支自身遗留的 rebel-resurgence 失败）；stage-bans 审计测试删去 Experiment 2-1 的 TABLE_MISMATCH 期望并把 `errors` 调为 3（该测试在无外部研究包时 `skipIf`，本机无法验证）。 |
| g4 `9195e386` Voidcaller / Void Swarm（`38957ccd`） | 29 个，含 `augment-effects.ts`、`combat-effects.ts`、`combat-s13.ts`、`m8/s13-mechanisms.ts`、`strategy-snapshot.ts`、`units.ts`、`tests/augment-history.test.ts` | `combat-effects` opening：HEAD `openingH11` 后接 `startB5VoidSwarm` 与 mechanismUnits 回填；`combat-s13` 返回值同时带 `batch5RebelSummons` 与 `voidcaller`；`vampRates` 前置 `b5VoidSwarmVamp`；`strategy-snapshot` 物品效果用 `b5PortalEffects(state,id,itemEffects(r2ItemDefinition(p2ItemDefinition(...))))`；`tests/augment-history.test.ts` 采用 g4 的 0..100 合法 reroll 搜索（删除 HEAD `firstNodeSeed('starry-night',10000)`），符合任务"不得宽扫"的要求。 |
| g5 `7e2d03db` Expected Unexpectedness / Prismatic Pipeline | `augment-pool-grants.ts`、`free-rerolls.ts`、`loot-runtime.ts`、`match.ts`、`shared-pool.ts`、rewards oracle | `drainBatch1Gifts` 起点改为 `drainBatch5G5Gold(preparePipelineOrbs(drainBatch3Forming(recordH13Settlements(initial))))`；`validateBatch1Gifts` 同时调用 TombRaider 与 G5 校验；`freeRerollsGranted` 前置 `expectedUnexpectednessRerolls`；`match.ts` gifted 条件追加两张卡；rewards oracle `validateRewardsCore` 同时调用 `validateTombRaiderTransition` 与 `validatePipelineClaim`，并采用 g5 的锁定 PvP 结算分支（替换 HEAD 的 `terminal` 定义，保留 h4/H6 过渡校验）。 |
| g6 `ff2c7caf` I'm the Carry Now | `combat-s13-abilities.ts`、`combat-s13-state.ts`、`g2-3-summons.ts`、`match.ts`、`resource-provenance.ts`、`units.ts`、`serialization-structure.ts`、`shared-pool.ts`、`tests/server/batch5-dual-purpose-room.test.ts` | `planS13Cast` 保留 Mad Chemist 行并把 carry-golem 并入 golem 判定；AP 公式采用 `Math.min(3,starLevel)` 索引、AD 公式加 carry golem 的 attackCenti 分支；`countsG23SurvivorDamage` 同时排除 `b5-voidling` 与 `CARRY_GOLEM_ID`；`match.ts` 在线回合进入 `growCarryGolem(drainPortfolioGold(...))`、gifted 条件保持 HEAD 全列表，选择后追加 `grantCarryGolem`；`resource-provenance` 投影同时保留 `projectBatch5Items` 与 carry-golem 星级；`UNIT_DEFINITIONS` 同时含 `CARRY_GOLEM_UNIT` 与 `B5_G4_SUMMON_UNITS`；dual-purpose room 测试取 HEAD（带 `roomOfferFor`）。 |
| g7 `b213b959` Loot Explosion（`93e66baa`） | `src/server/room/augment-history.ts`、`room.ts`、`augment-death-samples.ts`、`augment-history.ts`、`combat-s13.ts`、`shared-pool.ts`、`scripts/audit-augment-stage-bans.cjs`、`augment-pool-batch2.ts`、多处测试 | `sampleAugmentDeath` 签名合并为 `(event, unit, killer?, actors?, lootExplosion?)`，`combat-s13` 调用同时传 killer/takedowns 与 lootExplosion；`augment-history.ts` 合并 HEAD 的 killer/takedown 捕获与 g7 的 `boundaryRecorded`/killerSeatId 逻辑，并保留 `recordR2PortableBattle`；服务器 `executedDeaths(battle, match)` 带 golden-find/forbidden-magic 开关，`recordRoomBattleFacts` 保留 R2 portable 记录；`shared-pool.ts` 加入 g7 的 `validateAugmentAuthority` 前置检查与 `validateLootExplosionRewards`；stage bans：Loot Explosion 仅 4-2 禁（用户决定），审计脚本 `OVERRIDES` 新增 `TFT13_Augment_Ambusher: {source:[], expected:['4-2'], decision:'P-LOOT-EXPLOSION-STAGE'}`，rules-manifest 的 `augmentStageBans` 版本升为 `user-override-v3`；`AUGMENT_BATCH2_BLOCKED` 清空（loot-explosion 由 G7、visionary-voidlings 由 G4 的 voidcaller 实现），相应 gap 测试改为断言 API 名映射；`tests/g2-augments-static.test.ts` 目录列表补齐 R1–G7 全部 DEFINITIONS。 |

合并后：
- `npx tsc --noEmit -p .` 通过（每个合并后都单独验证）。
- `node scripts/update-content-identities.cjs --write` → `CONTENT_DIGEST=fnv1a32-utf16:229d9f7e`、`LOOT_REPLAY_DIGEST=fnv1a32-utf16:55f72339`；`--check` 通过；`scripts/tests/production-size.test.ts` 6/6 通过。
- `git diff origin/multiplayer...HEAD -- src/server | grep '^+'` 无 `setTimeout`/`Date.now`/`performance.now`/`window`。
- 目录总数：285 → 306（r1+2, r2+2, r3+2, r4+1, r6+2, g1+2, g2+2, g3+2, g4+2, g5+2, g6+1, g7+1）。

## 二、Step 2：测试漂移修复 — 未开始

全量 `npx vitest run tests --exclude battle-start-slices --exclude bot-driver-timing` 跑到 104/789 个文件时按用户指示中止。已观察结果：64 个文件通过，40 个文件有失败。失败按根因分三类：

**A. 种子/offer 漂移（任务已预告，待修）**
- `tests/augment-pool-batch2.test.ts`：rocket-collection-plus（seed 300）、betrayal（seed 27）3-2 不再出现。
- `tests/shop-history.test.ts`（3 个）、`tests/augment-pool-batch1.test.ts`（9 个）、`tests/epic-loot-reforger.test.ts`（部分）、`tests/g2-4b-pr161-restore.test.ts`（11 个，seed 27566 immovable-object）、`tests/v23-tamper-mechanics.test.ts`、`tests/opening-random-identity.test.ts` 的 TG 组（seed 42 Watcher Crest）、`tests/m5-oracle-augment-ledger.test.ts` 2 个（HEROIC_SEED=37 路线不再到达 heroic selection）、`tests/server/batch5-dual-purpose-room.test.ts`（seed 6 无 dual-purpose）、各 g2/g3/g4/g5 room 测试里 offer 找不到的级联失败。
- 各分支自带的 `tests/augment-stage-helpers.ts` STAGE_SEEDS 需在 0..100 内重新搜索。

**B. 版本纪元漂移（需要用户决定，见下）**
- `tests/opening-random-identity.test.ts` 136 个、`tests/m8-b5-temporary.test.ts` 29 个、`tests/epic-loot-reforger.test.ts:236`、`tests/m6-integration*.test.ts`、`tests/d14-wiring-match.test.ts` 等：失败原因为 `Invalid Match save: unsupported-version` 或断言 `rulesVersion === 's13-g2-3-v24-online-rules'`。基线 `d239794b` 已把 `M8_VERSION.rulesVersion` 升到 `s13-g2-3-v25-online-rules`（h9 提交 `29541801` 引入，在本任务起点之前），而 `tests/fixtures/v24-online-rules-recorded-states/*.json.gz` 等录制证据仍是 v24 纪元。任务规则禁止"录制或更改纪元"，所以这类失败**不属于本任务可修范围**，与 `battle-start-slices` 同性质。

**C. 尚未分诊**
- `tests/augment-batch3-verify-public.test.ts`（69）、`tests/augment-pool-batch5-r2-anomaly.test.ts`（5）、`tests/g2-augments-combat.test.ts`（5）、`tests/opening-encounters-pr5.test.ts`（6）、`tests/task-mechanism-restore.test.ts`（3）、`tests/restore-audit/cd-replay-facts.test.ts`（3）、`tests/t12-combat-equip.test.ts`（2）、`tests/m8-b8-combat-input.test.ts`（2）、`tests/g2-4b-resists-restore.test.ts`（2）、`tests/augment-pool-batch4-b4combat.test.ts`（4）、`tests/m5-route.test.ts`（2）、`tests/server/{net/watch,projection-wire,t10-combat-ops}.test.ts`（各 1）、`tests/{anvil-rewards,bracer-multikill-stacks,m5-combat,m8-b5-grant-upgrade,match-session,opening-encounters-batch-a,opening-encounters-pr6,v19-part2,augment-pool-batch3,augment-pool-batch3-xp}.test.ts`（各 1–2）、`tests/m8-b8-live-growth.test.ts`（0 test，加载失败）。多数预期属于 A 或 B 类，但尚未逐个确认是否有真实行为冲突。
- `tests/server` 全量尚未单独跑。

**按任务要求保持失败、不处理**：`tests/server/battle-start-slices.test.ts`（v24 纪元快照）、`tests/server/bot-driver-timing.test.ts`（EXT-1）。

## 三、最终测试计数

- 全量：未完成（104/789 文件；64 通过，40 有失败，其余未运行）。
- 已跑过的定点验证：`production-size` 6/6；g4 相关 6 文件 147 通过/2 失败（ledger seed-37）；g5 相关 7 文件 151/2；g6 相关 4 文件 67/4（含 dual-purpose 漂移）；g7 相关 20 文件 543 通过/10 失败/2 跳过；注册表测试（batch2/source/static/m5-content）272 通过/2 失败（rocket/betrayal 漂移）。

## 四、风险与待决

1. **纪元问题**：v25 版本字符串已在起点生效，但 v24 录制证据未再录。请决定：(a) 本任务只修 A 类漂移、B 类与 battle-start-slices 一并留给"v25 纪元再录"任务（建议）；(b) 放宽范围允许再录。
2. `tests/augment-stage-bans-audit.test.ts` 的真实归档用例（`skipIf` 外部研究包缺失）在 g3/g7 合并时按逻辑推算改了 `errors` 计数与 Ambusher override 期望，本机不可验证。
3. g5 采用了 g5 分支的 rewards oracle 锁定 PvP 结算分支替换 HEAD 的 `terminal` 定义；两者语义一致（HEAD 的定义是 g5 的子集）但未经全量 server 测试证实。
