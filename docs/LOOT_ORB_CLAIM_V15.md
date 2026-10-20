# 联机法球领取 v15：实现与交接

基线 `origin/multiplayer a0d42c592cbd48fb075175e5f61818dabfe1b320`，分支 `codex/loot-orb-claim`。用户于 2026-10-20 02:20 批准规则；工作区交付，不 add/commit，不安装依赖。只有 `state.multiplayer` 存在时启用；单机自动发放、满席托管、售价公式、冻结权重、ORB_RULES、5-7/6-7 节点均保持。

第二轮以第一轮提交 `b1c841e6` 为基线。用户 2026-10-20 02:26 已定“战斗中也能点、排队、战后结算”；本轮覆盖下文所有第一轮 combat 拒绝语义。改动仅留工作区，不写 .git、不联网、不运行 exe、不 npm ci。按卡刷新与 #231 接线并入后才用新的 v15 epoch 统一重录，本轮未重录/改写任何指纹。

## 命令与回执

```ts
claimOrb(state: MatchState, orbId: string, expectedRound: number,
  unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult
runSharedMatchCommand(pool, state, {type:'claimOrb', round: state.round, orbId})
```

客户端不能提供 unitLootPolicy。绑定共享卡池的席位必须经过包装，直接调用无 policy 返回 `shared-pool-required`。`expectedRound` 是操作时的当前轮，法球自身 `roundId` 是来源轮；二者可以不同。

失败枚举：`multiplayer-required`、`seat-eliminated`、`stale-round`、`wrong-phase`、`unknown-orb`、`already-claimed`、`shared-pool-required`、`invalid-loot`；共享事务另保留原有池校验失败枚举。失败返回原 state/pool 引用，无事件、RNG 或卡池变更。未知、未揭示、未杀死载体的法球均 `unknown-orb`。

允许 preparation / combat / settlement / choice，集中在 `ORB_CLAIM_PHASES` / `planOrbClaim`。combat 或冻结 PvP 阵容阶段（preparation + combatRosterLocked）接受并排队；其他允许阶段即时领取。一次领取完整法球，按 entryOrdinal 执行，任何条目失败整体回滚。金币/物品/消耗品在实际执行领取时入账；英雄先运行完整星级的 `planUnitAcquisition`，能合成腾格则合成，否则自动出售。

## 第二轮：排队与确定性结算

- 新持久字段 `MatchLootState.queuedOrbClaims?:readonly string[]`：仅席位私有，缺省为空，按权威提交顺序保存 orbId；不复制 payload，不保存 policy/回调。接受时 direct 仍为 revealed，不改军队、金币、库存、预留、任何 RNG 或事件序号，无领取事件/收据；共享包装仍更新 pool/seat revision。重复排队返回 `already-claimed`，保持原 state/pool 引用，无事件；不新增失败枚举。
- PvE `withCombat` 和 PvP `applyRoundSettlement` 的唯一结算位置：本轮收入/利息、XP、HP、成长、G23 结算钩子及延迟升星完成之后，战后选择打开之前。先判淘汰；淘汰清空队列并对所有已赚未领条目写 forfeited/gold=0，不取卡、不补金。存活调用 `settleQueuedOrbClaims`，逐颗 FIFO、颗内 entryOrdinal 调用同一 planOrbClaim/grantDirectLoot，以执行时的容量和池库存判定入库、满席折金或缺货补偿，生成相同的 dropId 唯一收据。领取金额不回算本轮利息或修改 RoundResult.goldAfter。
- 每颗后按原领取路径 drainG23Rewards、同步临时装备；新解锁的机制法球仍待显式点击，不自动入队。队列清空、收据、资源与本轮结算在同一权威事务原子提交，任何失败回滚，不能发布半个队列。
- 排队/出队/领取/折金/扣池本身各消耗 0 RNG，不重抽冻结载荷。原装备钩子若需新 roll，按 FIFO、每颗后父装备 ID/roundId 代码点顺序只消费 equipment 流：两个 uniformIndex（含原拒绝采样），记 equipmentRolled。战斗和商店 RNG 不因领取改变。跨席竞争沿服务器结算原子提交顺序；不建立全局点击时间优先规则。
- `validateMultiplayerOrbLedger` 校验队列为无重复字符串数组、已赚已揭示且未领的已进入法球、活动战斗/冻结 PvP 生命周期，拒绝已结算/淘汰残留。完整星级入库/折金收据仍用原账本验证。JSON 快照保留 FIFO 原序；结算后空队列和唯一收据共同防重，重连读取 queued 投影、不重新提交领取。`prepareMatchLoot` 保留字段，不另建队列来源。
- 私有 `unclaimedOrbs.queued:boolean` 标记排队；队列中法球仍可见，重复提交失败。公共投影仅 count/tiers，不带 queued、队列、orbId 或内容。服务器必须保存 latest seat 和池的原子结果，不能用战前 battle/resolver 副本覆盖最新队列。
- 版本：仍处于 v15 epoch，schema7/save3/replay3/command3 不变；联机法球合同升到 `multiplayer-orb-claim-v2`，LOOT_RUNTIME_REVISION 升到 `multiplayer-orb-claim-v3`（CONTENT_DIGEST 自然重算）。网络目标仍 4，服务器接线未做；冻结算法/权重/ORB_RULES 不变，LOOT_REPLAY_DIGEST 相对第一轮不变。

领取收据仍以 dropId / lootReceiptId 唯一，增加 `resolution: held | gold | capacity-sold | forfeited`、`gold`、`claimedRoundId`。payload 保留原英雄及 starLevel，`grantedUnitIds` 只在真实入库时存在元素；满席显示“自动出售 +NG”，缺货显示“缺货补偿 +NG”，二者不叠加。普通金币收据 resolution=held，gold 是实际到账金额。领取不改已经完成的收入、利息或成长结算。

## 池与生命周期

- 冻结、揭示、生成奖励法球均不占池。领取时要 1/3/9 份；库存足够且入库才扣池，持有账本记录每一份独立来源；升星沿用真实升级事件。
- 满席折金采用“不取出份额”，不创建 pending 预留；价格完全调用未修改的 getUnitSellPrice。2 费 1/2/3 星为 +2/+5/+17，1 费 2 星为 +3。
- 暂定：不足以满足完整星级份数时，整颗英雄奖励只补一次费用金币；不部分取货、不按份数倍增，也不再追加满席出售金币。沿用现有缺货按费用折金，扩展到完整星级。
- deadline `claimLoot` 只处理原组件选择等选择流程，不领取、不丢弃法球；未领法球不阻塞 nextRound。
- PvE 法球跨轮留在冻结计划中；机制法球追加在 `m8.loot.rewardOrbs`，与冻结计划互不复制。强化 P2、征服者、黑市英雄先写 `MechanicReceipt.resolution='orb'`（orbId/starLevel、gold=0、unitId=null），后续不再容量托管重试。
- 黑市 Champions_2Star/3Star 与 TwoStarUnit 在联机归一为一条完整星级奖励；单机仍使用原 3/9 个一星路径。
- 复制器无合法已拥有目标时仍待选择；目标确定后产生奖励法球。领取英雄后会 drain 原机制奖励，使刚获得的合法目标能解锁待决复制器。
- 淘汰由内部 `forfeitUnclaimedOrbs`、整局终局由公共 `forfeitTerminalOrbs` 将每个已赚未领条目写一次 forfeited 收据。未杀死载体仍按原 forfeited 处理，无资源收据；断线不作废。

## 投影、恢复与服务器接线

私有 `readLootView().unclaimedOrbs` 和 `toPrivateSeatView().unclaimedOrbs` 始终在线上提供：

```ts
{orbId, roundId, tier, entries:[{kind, definitionId?, quantity, starLevel?}], source:'pve'|'mechanic', queued:boolean}[]
```

仅揭示且已赚内容，跨轮提供；单机/旧预览省略该字段。`readLootView().claimReceipts` 与 private `orbClaimReceipts` 提供领取结果；public 只调用 `readPublicOrbSummary`，得到 `{count, tiers}`，不得发 orbId、来源轮、内容或收据。机制法球暂用 gray 档位，仅为分类默认。

`validateB8Loot` 识别线上持久状态，专用 `validateMultiplayerOrbLedger` 校验来源、死亡证据、整颗原子状态、收据、金额与计数。`restoreSharedOrbSnapshot(pool,input)` 用匹配的权威池校验冻结计划、版本绑定、持有守恒及法球账本；它是配套池的席位法球快照恢复边界，不宣称替代完整服务器会话恢复。既有 `serializeMatch/restoreMatch` 仍明确拒绝 multiplayer 状态，不放宽单机断言。

Claude 必须完成以下接线，本交付未修改 src/server/ 或界面目录：

1. 在 ClientCommand / 消息白名单加入 `{type:'claimOrb', round:number, orbId:string}`；通过席位凭证选取真实 state，原样转给 `runSharedMatchCommand`。沿用现有命令请求关联 ID / ACK 包装，不能信任客户端席位或重算金币。
2. `src/server/net/messages.ts` 的 `NET_PROTOCOL_VERSION` 从 3 升到 4；领域导出 `MULTIPLAYER_NET_PROTOCOL_VERSION=4`。旧协议必须显式拒绝。该服务器常量处于用户禁改目录，当前工作区仍为 3，未宣称已端到端升级。
3. 私有发送 unclaimedOrbs（含 queued）/ orbClaimReceipts；公共只转 count / tiers。battle/awaiting-settlement 也允许转发 claimOrb；排队 ACK 仅表示已受理，战后收到实际收据才展示 resolution/gold。断线重连读取 queued，不重提或提前发奖。
4. 每次 bot 准备阶段入口、普通操作预算之前调用 `claimBotPreparationOrbs(pool,state)` 并提交整个成功结果；函数按 orbId 代码点排序，包含领取后新解锁的奖励法球，不消费 bot RNG。
5. 整局终局逐席调用 `forfeitTerminalOrbs(state: MatchState): MatchStep`（server-entry 导出，含赢家及其他 active 存活席位），提交 `{state, events}`。领域已统一按 Match 的 nextMatchEventSeq 连续编号，服务器不得重复编号；无失败枚举，重复调用/快照恢复后不重复发事件或收据。调用者负责终局判断，不要求席位已转 gameOver/eliminated，也不在普通轮次截止调用。不发资源、不扣池、不消耗 RNG、不运行获取/选择钩子；淘汰结算和 releaseSeatOnElimination 的内部清理保留。完整语义见 MATCH_CONTRACT 的 #260 / #262 终局入口。

## 约定值

combat 可点、排队、战后结算已由用户确定，不再列为暂定。保留的暂定值：完整星级库存不足整条按一次费用补金；奖励法球 tier=gray。实现约定：满席采用“不取出”；队列缺省为空、重复排队沿用 already-claimed；本轮经济/伤害/机制钩子/延迟升星之后、战后选择之前出队，跨席竞争沿原结算提交顺序，新解锁法球不自动入队。上述项目约定不代表已核实的原版 TFT 规则。

## PR draft

**Title:** `feat(simulation): queue combat orb claims until round settlement`

**Before:** Explicit multiplayer orb claims rejected combat and locked PvP rosters with wrong-phase.

**After:** Combat claims persist as a seat-private FIFO without allocating resources or consuming RNG. PvE and PvP settlement drains it after economy, damage, mechanic hooks and deferred upgrades, before post-battle choices. Capacity and pool shortage are evaluated at settlement; eliminated seats forfeit. Duplicate submissions and restored settlement retries cannot pay twice. Private projections expose queued; public projections retain count and tiers only.

**Validation:** Run tsc and each related Vitest file individually with --configLoader runner. Independent oracle vectors cover delayed sale amounts, FIFO stock competition and conservation, plus snapshot/reconnect idempotence and elimination. Exact second-round results are recorded below.

**Integration required:** Claude must wire the server/client claim message in battle and awaiting-settlement, preserve the latest seat queue, bump the server net protocol to 4, invoke the bot preparation helper and forward queued/receipt projections. Fingerprints stay deferred until per-card rerolls and #231 integration land, then regenerate together in a new v15 epoch. This PR is a domain handoff, not an end-to-end online release.

**Convention values:** Incomplete full-star stock compensates the champion cost once for the entire entry; reward orbs use gray. Capacity sales do not withdraw copies. FIFO is per seat, and cross-seat allocation follows the existing settlement commit order.

中文对账：战斗排队不扣池；战后按当时容量/库存结算；满席不取出；缺货优先且不叠加；完整星级 1/3/9 份；先淘汰则作废；单机不改数值。服务器协议常量与 bot 入口尚需 Claude 对齐。测试与指纹状态见下文。

第二轮建议提交：`feat(simulation): queue combat orb claims until round settlement`。

第一轮建议提交（历史）：

1. `feat(simulation): persist and claim multiplayer reward orbs`
2. `test(simulation): cover orb claims with independent capacity and replay oracles`
3. `docs(multiplayer): specify orb claim protocol and v15 reconciliation`
4. `test(fixtures): regenerate v15 rule fingerprints`（仅在完整重录和校验通过后）

## 第二轮验收记录（2026-10-20）

`npx.cmd tsc --noEmit` 通过；`git diff --check` 通过。以下 11 个文件均逐个运行 `npx.cmd vitest run <file> --configLoader runner`，最终共 122 项通过，未跑全套，未改测试超时/放宽断言。

| 文件 | 通过项 |
| --- | ---: |
| loot-orb-claim.test.ts | 20 |
| t3-round-settlement.test.ts | 10 |
| tp-rewards-and-rounds.test.ts | 9 |
| t5r-loot-view.test.ts | 24 |
| tp-shared-pool.test.ts | 14 |
| t3-timeout-loot.test.ts | 6 |
| shared-pool-cache.test.ts | 4 |
| t10-deferred-upgrades.test.ts | 10 |
| m8-b8-loot-view.test.ts | 7 |
| match-contract.test.ts | 12 |
| m8-contracts.test.ts | 6 |

原“combat 拒绝”用例已改成战斗接受、仅排队、重复排队不变、战后才到账；补充满席直接 +5 与战斗中出售腾格后完整二星入库、反 orbId 顺序 FIFO 竞争三份库存后补 +2、排队/结算前后 JSON 恢复及重连投影、重复 step/结算不再支付、非法/重复队列拒绝、PvE 实际伤害淘汰和锁定 PvP 淘汰作废。独立 oracle 无生产导入，手写 0/+5/+2 与 0/3 份变化，并独立加总初始库存=可用+商店+持有来源+预留。

差异仅在 src/simulation/、tests/、上述五份 docs；禁改目录及指纹/golden/CURRENT 无差异。未 add/commit、未联网、未安装依赖。领域排队交付完成；服务器/界面接线及新 v15 epoch 指纹重录仍待后续任务，不宣称端到端重连或上线验收完成。下方保留第一轮原始验证/失败记录供追溯；其中旧 digest、旧合同号和当时“待选择”的迁移状态均为历史信息，本轮以本文开头的版本和延后重录安排为准。

## 第一轮验收记录（b1c841e6 历史，不代表本轮重新执行）

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

## v15 第四块：UR-I3-01 联机战斗状态种类

基线：本地 `codex/loot-orb-claim` / `58dd20265a786c28dc0667f30524bacabdde620a`，开工时工作区干净。此块只改只读回放投影、server-entry 类型导出、测试及文档，全部留工作区；未联网、安装依赖、直接运行 exe、写 .git 或重录既有 fixture。

### 字段与确定性

`CombatViewUnit.statuses?: readonly CombatViewStatus[]`，成员只有 `kind: StatusKind|'channel'|'redirect'` 和 `harmful:boolean`；server-entry 导出这两个类型。`combat-replay-view.ts` 直接复用 `readUnitStatusRows` 的纯快照读取，跳过 pending/suppressed，不另算规则。因本轮禁改 presentation，保留该纯函数的跨目录导入；它没有 DOM/Phaser 运行时依赖，来源/中文描述等字段均不下发。

按 `(kind,harmful)` 去重；kind 采用 ASCII 字符升序：`burn, channel, control-immunity, damage-prevention, damage-reduction, redirect, shred, stat-buff, stat-debuff, stun, sunder, untargetable, wound`，同 kind 下 false 先于 true，不依赖 locale 或来源遍历顺序。新快照总写数组，清空写 `[]`；tick 末原有差量比较自动产生 `unitUpdated.changes.statuses`。初始/关键/终态以及 `unitEntered.unit` 均走同一完整单位投影；`seat-mechanics/replay-units.ts` 与 reducer 已泛化传递单位，无需另加白名单。护盾仍用 `shield`，不加入种类数组。

netProtocol 与 claimOrb 共用目标 **4**，未另升版本。服务器禁改目录当前常量仍为 3，待 Claude 统一接线；此块不宣称实际联机图标已完成浏览器验收。UI 请求原文已补入并标“已实现”，新字段的完整协议见 MULTIPLAYER_CONTRACT 的 UR-I3-01 节。

### 规则不变的证据

未改战斗引擎、事件账本、RNG、内容或版本声明。新增合成战斗的权威结果锚点在修改视图前采集，修改后逐项通过：

| 对象 | 修改前后相同的值 |
| --- | --- |
| CONTENT_DIGEST | `fnv1a32-utf16:99b62a66` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:61568ec0` |
| 合成战斗终态 SHA-256（含 RNG） | `432c237bd3225a4b75ac5436bb370194689cab64f4be002007bbd703b65afdd9` |
| 合成战斗完整账本 SHA-256 | `c5762f92e94df75176eab0b23de25dcd5636f0f80f9d5da1d41ffae794d4583d` |

合成战斗在 tick45 draw，RNG state=42、draws=0；启用/关闭 recorder 的每 tick 权威状态和完整账本一致，重新执行回放与首遍录帧一致。B8 旧锚点另提供真实 PvP 证据：1/9 单位每侧的 battle SHA 均仍与原 fixture 完全相等，只有 replay SHA 变化；0 单位终局无单位字段可变，原指纹仍通过。

### 需重录清单（本轮全部不重录）

| 对象 | v15 统一重录时的处理 |
| --- | --- |
| B8 完整 compact replay 指纹 | `tests/fixtures/g2-3-b8-fingerprints.json` 是当前 B8 helper 的读取源；`g2-4b-b8-fingerprints.json` 是现有较新生成输出。1/9 单位的 replay 项受 statuses 影响，initial/keyframe/terminal 单位均多数组，状态变化再增加差量；battle 项不因本块改变。新建 v15 epoch、迁移当前读取路径，保留历史字节，不能覆盖旧文件或只手改 hash。 |
| 联机录制帧/快照 golden（包括 C19、B8 的关键帧） | 凡保存或计算 CombatReplay / CombatViewState / unitEntered / unitUpdated 字节的当前录制，须从最终 v15 公共输入重新生成，含空数组及清空差量；不要剥离新字段让旧 golden 变绿。本仓库 C19 当前 fixture 是编译输入，并非已保存的关键帧。 |
| C19 编译输入与权威终态/账本证据 | statuses 本身不改变 `g2-4b-c19-seed-9-minimal.json`、终态/账本/灼烧 pulse；它当前绑定旧 digest `ea6b11b6`，与本分支 `99b62a66` 不同，已有 v15 输入迁移仍需在新 epoch 重新编译，不能只替换版本串。 |
| 生成源码指纹/审计 manifest | `docs/evidence/g2-4b/input-fixture-audit.json` 等保存 simulation/server-entry 源 SHA 的记录会因源码改动失配；统一录制时另记 v15 源码证据。直接复用函数使 `src/presentation/combat-status.ts` 成为帧生成依赖，新的源码 manifest 应一并记录它。Herald/单机权威原始 state 和规则数值 oracle 不因新增视图字段而重录；之前块留下的身份迁移仍按原计划处理。 |

### 验证结果

使用共用 node_modules，`npx.cmd tsc --noEmit` 通过。以下文件均单独执行 `npx.cmd vitest run <文件> --project fast --configLoader runner`，未跑全套，新测试没有单条时限：

| 测试文件（tests/ 下） | 结果 |
| --- | --- |
| ur-i3-combat-statuses.test.ts | 6/6：逐 tick 对照单机、眩晕/灼烧/重伤/增减益/护盾、去重/压制/filtered/legacy/activity、JSON 关键帧加差量恢复、unitEntered、权威状态/账本/RNG/digest 不变 |
| t5r-combat-replay.test.ts | 46/46 |
| combat-first-pass-frames.test.ts | 11/11 |
| g2-4b-replay.test.ts | 10/10 |
| jayce-forge-replay-order.test.ts | 7/7 |
| m8-b9-status-events.test.ts | 2/2 |
| c19-missed-pulse.test.ts | 9 通过、1 失败：旧编译输入在恢复入口报 content-digest，尚未进入回放投影 |
| b8-resumable-battle.test.ts | 13 通过、2 失败：1/9 单位的旧 replay 字节锚点不含 statuses；battle 锚点相等，其余分片/恢复/校验用例通过 |

合计 104 通过、3 个待 v15 统一迁移的 fixture 失败；未修改或跳过旧断言，未修改既有 golden/录制数据。建议提交信息：`feat(replay): expose active unit status kinds in combat views`。
