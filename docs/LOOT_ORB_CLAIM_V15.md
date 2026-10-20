# 联机法球领取 v15：实现与交接

基线 `origin/multiplayer a0d42c592cbd48fb075175e5f61818dabfe1b320`，分支 `codex/loot-orb-claim`。用户于 2026-10-20 02:20 批准规则；工作区交付，不 add/commit，不安装依赖。只有 `state.multiplayer` 存在时启用；单机自动发放、满席托管、售价公式、冻结权重、ORB_RULES、5-7/6-7 节点均保持。

## 命令与回执

```ts
claimOrb(state: MatchState, orbId: string, expectedRound: number,
  unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult
runSharedMatchCommand(pool, state, {type:'claimOrb', round: state.round, orbId})
```

客户端不能提供 unitLootPolicy。绑定共享卡池的席位必须经过包装，直接调用无 policy 返回 `shared-pool-required`。`expectedRound` 是操作时的当前轮，法球自身 `roundId` 是来源轮；二者可以不同。

失败枚举：`multiplayer-required`、`seat-eliminated`、`stale-round`、`wrong-phase`、`unknown-orb`、`already-claimed`、`shared-pool-required`、`invalid-loot`；共享事务另保留原有池校验失败枚举。失败返回原 state/pool 引用，无事件、RNG 或卡池变更。未知、未揭示、未杀死载体的法球均 `unknown-orb`。

允许 preparation / settlement / choice。combat 和冻结 PvP 阵容阶段拒绝 `wrong-phase`，集中在 `ORB_CLAIM_PHASES` / `planOrbClaim`。一次领取完整法球，按 entryOrdinal 执行，任何条目失败整体回滚。金币/物品/消耗品在领取时入账；英雄先运行完整星级的 `planUnitAcquisition`，能合成腾格则合成，否则自动出售。

领取收据仍以 dropId / lootReceiptId 唯一，增加 `resolution: held | gold | capacity-sold | forfeited`、`gold`、`claimedRoundId`。payload 保留原英雄及 starLevel，`grantedUnitIds` 只在真实入库时存在元素；满席显示“自动出售 +NG”，缺货显示“缺货补偿 +NG”，二者不叠加。普通金币收据 resolution=held，gold 是实际到账金额。领取不改已经完成的收入、利息或成长结算。

## 池与生命周期

- 冻结、揭示、生成奖励法球均不占池。领取时要 1/3/9 份；库存足够且入库才扣池，持有账本记录每一份独立来源；升星沿用真实升级事件。
- 满席折金采用“不取出份额”，不创建 pending 预留；价格完全调用未修改的 getUnitSellPrice。2 费 1/2/3 星为 +2/+5/+17，1 费 2 星为 +3。
- 暂定：不足以满足完整星级份数时，整颗英雄奖励只补一次费用金币；不部分取货、不按份数倍增，也不再追加满席出售金币。沿用现有缺货按费用折金，扩展到完整星级。
- deadline `claimLoot` 只处理原组件选择等选择流程，不领取、不丢弃法球；未领法球不阻塞 nextRound。
- PvE 法球跨轮留在冻结计划中；机制法球追加在 `m8.loot.rewardOrbs`，与冻结计划互不复制。强化 P2、征服者、黑市英雄先写 `MechanicReceipt.resolution='orb'`（orbId/starLevel、gold=0、unitId=null），后续不再容量托管重试。
- 黑市 Champions_2Star/3Star 与 TwoStarUnit 在联机归一为一条完整星级奖励；单机仍使用原 3/9 个一星路径。
- 复制器无合法已拥有目标时仍待选择；目标确定后产生奖励法球。领取英雄后会 drain 原机制奖励，使刚获得的合法目标能解锁待决复制器。
- 淘汰/终局由 `forfeitUnclaimedOrbs` 将每个已赚未领条目写一次 forfeited 收据。未杀死载体仍按原 forfeited 处理，无资源收据；断线不作废。

## 投影、恢复与服务器接线

私有 `readLootView().unclaimedOrbs` 和 `toPrivateSeatView().unclaimedOrbs` 始终在线上提供：

```ts
{orbId, roundId, tier, entries:[{kind, definitionId?, quantity, starLevel?}], source:'pve'|'mechanic'}[]
```

仅揭示且已赚内容，跨轮提供；单机/旧预览省略该字段。`readLootView().claimReceipts` 与 private `orbClaimReceipts` 提供领取结果；public 只调用 `readPublicOrbSummary`，得到 `{count, tiers}`，不得发 orbId、来源轮、内容或收据。机制法球暂用 gray 档位，仅为分类默认。

`validateB8Loot` 识别线上持久状态，专用 `validateMultiplayerOrbLedger` 校验来源、死亡证据、整颗原子状态、收据、金额与计数。`restoreSharedOrbSnapshot(pool,input)` 用匹配的权威池校验冻结计划、版本绑定、持有守恒及法球账本；它是配套池的席位法球快照恢复边界，不宣称替代完整服务器会话恢复。既有 `serializeMatch/restoreMatch` 仍明确拒绝 multiplayer 状态，不放宽单机断言。

Claude 必须完成以下接线，本交付未修改 src/server/ 或界面目录：

1. 在 ClientCommand / 消息白名单加入 `{type:'claimOrb', round:number, orbId:string}`；通过席位凭证选取真实 state，原样转给 `runSharedMatchCommand`。沿用现有命令请求关联 ID / ACK 包装，不能信任客户端席位或重算金币。
2. `src/server/net/messages.ts` 的 `NET_PROTOCOL_VERSION` 从 3 升到 4；领域导出 `MULTIPLAYER_NET_PROTOCOL_VERSION=4`。旧协议必须显式拒绝。该服务器常量处于用户禁改目录，当前工作区仍为 3，未宣称已端到端升级。
3. 私有发送 unclaimedOrbs / orbClaimReceipts；公共只转 count / tiers。点击一个 orbId 发送一次上述命令，ACK 展示实际 resolution/gold。
4. 每次 bot 准备阶段入口、普通操作预算之前调用 `claimBotPreparationOrbs(pool,state)` 并提交整个成功结果；函数按 orbId 代码点排序，包含领取后新解锁的奖励法球，不消费 bot RNG。
5. 终局统一调用 `forfeitUnclaimedOrbs` 并按原 Match 事件规则分配序号；淘汰结算和 releaseSeatOnElimination 已接入领域清理。

## 暂定值

combat 暂拒绝（用户仍在决定）；完整星级库存不足整条按一次费用补金；奖励法球 tier=gray。上述取值不代表已核实的原版 TFT 规则。卡池满席采用“不取出”是本次实现选择，保证守恒。

## PR draft

**Title:** `feat(simulation): add explicit multiplayer orb claims and capacity sale receipts`

**Before:** Online PvE rewards were automatically granted after combat. Full benches reserved scarce pool copies and deadline processing could discard the rewards. Mechanic hero gifts retried capacity grants; two/three-star market rewards were split into base copies.

**After:** Earned online orbs remain claimable across rounds. A claim commits the complete orb in entry order, consumes pool copies only for successful unit acquisitions, and sells capacity overflow at the existing star-level sale price. Shortage compensation and capacity sales are mutually exclusive. P2, Conqueror and market hero rewards use the same orb list and command; offline behavior is retained.

**How:** Reuse unit acquisition/upgrade planners with an optional initial star level, preserve original payloads in exactly-once resolution receipts, and validate restored orb ledgers against an authoritative shared pool snapshot. Provide private pending-orb/receipt projections, a public count/tier projection, and a preparation-entry bot claim transaction.

**Integration required:** Claude must wire the server/client claim message, bump the server net protocol to 4, invoke the bot preparation helper and forward the projections. Combat claims remain provisionally disabled. This PR is a domain handoff, not an end-to-end online release.

中文对账：卡池未领不扣；满席不取出；缺货优先且不叠加；完整星级 1/3/9 份；单机不改数值；LOOT_REPLAY_DIGEST 应保持；服务器协议常量与 bot 入口尚需 Claude 对齐。测试与指纹状态见本文件后续验收记录。

建议提交：

1. `feat(simulation): persist and claim multiplayer reward orbs`
2. `test(simulation): cover orb claims with independent capacity and replay oracles`
3. `docs(multiplayer): specify orb claim protocol and v15 reconciliation`
4. `test(fixtures): regenerate v15 rule fingerprints`（仅在完整重录和校验通过后）

## 本工作区验收记录

当前为**领域实现完成、指纹迁移未完成的工作区交付**，不能据此宣称可合并或可上线。未写 .git、未安装依赖、未联网；禁改目录及 getUnitSellPrice、loot-freeze.ts、content/orbs.ts 均无差异。共享依赖实际路径来自 assets3d，Vite 7.3.6 / Vitest 5.0.3；typecheck 与针对性测试可用。

| 身份 | 基线 | 工作区 |
| --- | --- | --- |
| rules / content | s13-g2-3-v14 / s13-14.24b-g2-3-v14 | s13-g2-3-v15 / s13-14.24b-g2-3-v15 |
| CONTENT_DIGEST | fnv1a32-utf16:ea6b11b6 | fnv1a32-utf16:138f9135 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:9895bc42 | fnv1a32-utf16:61568ec0 |
| LOOT_RUNTIME_REVISION | m8-b8-live-loot-basis-provenance-v1 | multiplayer-orb-claim-v2 |
| G23_POLICY.revision | g2-4b-s13-augments-anomalies-v14 | g2-4b-multiplayer-orb-claim-v15 |
| 联机法球合同 / 网络目标 | 无 / 3 | multiplayer-orb-claim-v1 / 4（服务器实际仍 3） |
| schema / save / replay / command protocol | 7 / 3 / 3 / 3 | 保持 |

LOOT_REPLAY_DIGEST 的变化并非冻结表变化：loot-freeze.ts 的 digest 输入包含整个 RULES_GAP_MANIFEST，而该 manifest 的 g23.policy 包含本次要求提升的 G23_POLICY.revision。未缩减 digest 覆盖范围来强行保持旧值；冻结算法、权重和 ORB_RULES 均未修改。

以下各文件均单独执行 `npx.cmd vitest run <file> --configLoader runner`，最后适用运行通过，合计 14 个文件、197 项；未跑全套、未加新单条时限、未放宽现有断言/时限：

| 文件 | 通过项 |
| --- | ---: |
| loot-orb-claim.test.ts | 15 |
| t3-timeout-loot.test.ts | 6 |
| tp-shared-pool.test.ts | 14 |
| tp-rewards-and-rounds.test.ts | 9 |
| t5r-loot-view.test.ts | 24 |
| shared-pool-cache.test.ts | 4 |
| g2-3-integration.test.ts | 18 |
| g2-3-netcode-hooks.test.ts | 14 |
| r3r4-shared.test.ts | 8 |
| m8-b8-loot-view.test.ts | 7 |
| s13-augments-p2-choice.test.ts | 23 |
| g2-3-lesser-shimmer-duplicator.test.ts | 37 |
| match-contract.test.ts | 12 |
| m8-contracts.test.ts | 6 |

独立法球 oracle 为 `tests/oracles/multiplayer-orb-oracle.ts`，不 import 被测实现，手写 +2/+5/+17/+3、完整星级份数、合成腾格、跨轮及重复领取期望，并独立累计池守恒。新增用例另覆盖二星奖励三合一、九份持有来源与资源事实重推。

`record-g2-3-release.cjs`：已实际跑完 cannon/sniper/mage/sniper-caitlyn 四条路线，前两条各 67 个完整存档入口核验通过，现有独立 M5 oracle 通过。生成结果保留于 `artifacts/loot-orb-recording-attempt/`，**未安装为当前指纹**，历史文件已恢复。与旧 v14 cannon/sniper 各 67 个检查点逐字段比较，仅排除 rulesVersion/contentVersion/contentDigest/replayDigest，其他字段零差异（`artifacts/loot-orb-solo-comparison.json`）。因此未重写单机数值 oracle。

### 指纹未完成的原因与待运行项

1. 首次重录因共用 node_modules/.vite 缓存 unlink EPERM 挂住，已终止；相关 record 脚本改用本工作区 artifacts/loot-orb-vite-cache 后 release 跑通。
2. 固定历史基线必须为 `docs/evidence/g2-4b/release-audit.json` 的 `430017516a18fb38ee028cec000a44fb94bb638f`，不是本 PR 的 a0d42c5。g2-4b-fixture-audit.cjs 的 archivedBytes 明确断言 G2-3 文件与该提交字节完全一致。直接更新 tests/g2-3-content-baseline.json / G2-3 golden 会破坏此断言；未放宽它。本次试生成后已恢复历史，待用户选择新增 v15 epoch 的迁移方式。CURRENT 与历史 Herald 目录尚未改写。
3. 已跑 `node scripts/record-g2-4b-inputs.cjs --check --baseline-commit=430017516a18fb38ee028cec000a44fb94bb638f`，失败于旧 Herald manifest 的 ea6b11b6 与当前 138f9135 不一致，不能记为通过（日志 artifacts/loot-orb-inputs-check.log）。
4. 已跑 `node scripts/verify-m8-herald-fixtures.cjs`，失败于旧生成器默认加载 vite.config.ts 时 esbuild 的 Access is denied / Could not resolve vite.config.ts；共享依赖位于 assets3d，当前沙箱不能完成该路径解析（日志 artifacts/loot-orb-herald-check.log）。未重复运行同一失败方式。
5. 待迁移选择明确后：以新的当前 epoch 输出完整 release / Herald / inputs / live-reveal，调整 CURRENT 及对应读取路径，保留历史目录字节；再跑 inputs --check 与 Herald verify。`record-g2-4b-release.cjs`、当前 Herald 重录、inputs 重录、live-reveal 及最终校验目前均**未完成**，不得只手改 digest 或 golden。

调度方可复现环境限制的原命令为 `node scripts/verify-m8-herald-fixtures.cjs`；固定基线校验命令如第 3 条。完整迁移前不要对历史 Herald 目录使用 --write。若选择保留历史并新增 epoch，下一步应先提供一个新目录生成器（configFile:false、工作区 cacheDir），再将 CURRENT 指向它；完成真实重录后再通过上述校验。当前工作区不提供假通过的 CURRENT 或手修指纹。
