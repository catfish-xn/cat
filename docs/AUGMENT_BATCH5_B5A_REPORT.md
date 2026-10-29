# Batch 5 B5a 工作报告（2026-10-27）

【完成】

| 强化 | 已实现数值 | 采用的项目约定 |
|---|---|---|
| B5-50 闪若金鳞 | 三选一、1个拆卸器；源字段 InterestCap=5 保留 | P，2026-10-27：固定投机者之刃、大亨之铠、金币收集者各一次；沿用现有利息规则。仅在2-1提供。 |
| B5-51 闪若金鳞+ | 三选一、1个拆卸器、4金币；源字段 InterestCap=5 保留 | P，2026-10-27：与B5-50相同，二者互斥；仅在3-2提供。 |
| B5-55 交给运气 | 1个光明窃贼手套；源 effects 为空 | P，2026-10-27：仅发放物品，复用现有手套逻辑；不宣称认证原服的70种配对概率。3-2、4-2可选。 |

前两项接入既有三选装备、金币、拆卸器、选择收据和恢复校验；B5-55接入既有赠礼收据。独立表记录装备与阶段条件。新增测试覆盖实际单人选择、三个存档入口的往返及篡改拒绝，和服务器 `applySeatCommand` 的真实派发函数（派发测试使用构造的已选强化状态）。

【未完成】

- B5-01、02、03、04、13、15、16、17、18、19、20、22、23、24、52 未实现，仍不可提供；其实现与保存认证仍需逐项完成和验证，不能当作已判定均需改存档格式。B5-17 是批次2的禁用证据行，不是已开放的池成员。
- B5-55 按提案复用现有光明手套：它暂借用普通手套的临时装备池（低等级成装加组件、高等级两成装），没有产生两件光明装备。该行为是既有项目限制，不是原服的70种配对或完整光明手套行为。
- 全量回归曾启动，因已确认固定种子失效而中止，尚未重新完成。`tests/augment-pool-batch3.test.ts` 的 Call to Chaos 公开奖励测试仍需重新找到 4-2 且命中经验分支的种子；0–1999 的受限搜索未找到。较广回归中的 `tests/augment-pool-batch3-progress.test.ts` 的两个 pre-Spoils 兼容快照测试仍失败：逐字段比较只发现 `rulesVersion`、`contentVersion`、`contentDigest`、`combatInputBasis.contentDigest`、`m8.loot.frozen.replayDigest` 不同；未重新录制旧 epoch。
- 阶段审计 Vitest 的子进程在此沙盒报 EPERM；直接执行审计可运行，仍报告基线已有的5项差异（Academy、Cabal、Experiment、Formswapper、BloodBrothers），本次三条阶段规则无新增差异。

【需要我决定】

- 无新增玩法决定：用户已授权按文档现有 P 提案执行。剩余项目的存档格式和房间命令可行性需先完成工程核查。

【风险】

- 扩充黄金强化池会改变同种子后续抽取；测试固定种子和历史 epoch 可能失效。未经全面修复和回归，不应视为交付完成或合并。
- 不将固定生金神器候选及利息处理宣称为原服已认证行为。光明手套的现有普通装备池行为与原文两件光明装备存在明确差异。

【下一步】

- 更新固定种子并完成回归，逐项实现剩余提案；若证明某项必须新增存档格式或无法经现有房间派发的命令，则保持禁用并明确报告。

## 验证记录

- 新强化及相关回归：7 个测试文件、268 项通过（后续棱彩扩池后再次复核并修复对应种子）；`npm run typecheck` 和生产体积测试6项通过，`node scripts/update-content-identities.cjs --check` 通过。
- 批次4刷新、B5a单人及房间派发共3个文件55项通过；批次4经验强化13项通过；生产体积6项通过。未重新录制 epoch；上述两项旧快照测试及 Call to Chaos 路线应继续处理。

## 变更调用点与文件

- `src/simulation/augment-acquisition.ts`：`augmentAcquisition` 注册两项与拆卸器，`augmentForgeOffers` 提供三项固定候选；`grantAugmentAcquisition`、`openAugmentForge`、`validateAugmentAcquisition` 通过前述函数取得新行为，函数体未改。`src/simulation/augment-pool-grants.ts` 的 `batch1GiftPlan` 接入B5-55赠品。
- `src/simulation/content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts`、`augment-stage-bans.ts`、`rules-manifest.ts`：注册定义、位阶、API映射、阶段禁止及内容身份；`augment-pool-batch1.ts` 移除不再适用的禁用记录；`validate-content.ts` 同步内容计数。
- 新增 `src/simulation/content/augment-pool-batch5-b5a.ts`、`src/simulation/augment-pool-batch5-b5a.ts`；生成 `src/simulation/content/identity-constants.ts`；同步 `scripts/tests/production-size.test.ts`。
- `tests/fixtures/m5/oracle.g2.cjs`、新增 `tests/fixtures/m5/augment-pool-batch5-b5a.cjs` 及声明：独立候选池、互斥、阶段、金币与三神器表，以及 B5-55 独立赠礼表；新增 `tests/augment-pool-batch5-b5a.test.ts`、`tests/augment-pool-batch5-b5a-room.test.ts`。
- `tests/augment-stage-helpers.ts`、`tests/s13-p1-acquisition.test.ts`、`tests/augment-pool-batch1.test.ts`、`tests/augment-pool-batch4-b4combat.test.ts`、`tests/augment-pool-batch4-b4xp.test.ts`、`tests/augment-pool-batch4-b4reroll.test.ts`：更新部分固定种子；`tests/augment-pool-source-expectations.ts`、`tests/augment-pool-source.test.ts` 更新禁用条目状态；`tests/m5-oracle-augment-ledger.test.ts` 更新目录数量断言。未删除原有断言。
- `src/server/` 没有改动；测试调用 `src/server/room/room.ts` 的 `applySeatCommand`，沿用原有 `choose` 派发。`src/simulation/match.ts` 的 `grantAugmentAcquisition` / `openAugmentForge` 和赠礼既有调用点未改。
