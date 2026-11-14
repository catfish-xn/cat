# D4：重启任务（restart-mission）

基线：`claude/v26-d4-restart`，`4baaaf5a9a74335d46fa0e037a93e4e595f05384`。
依据：用户 2026-10-29 D4 指令、共同背景规则 9／10／11，以及本地只读 `augments-14.24.json` 的 `TFT_Augment_RestartMission`。

## 规则与交付边界

- 选取时移除本人场上与备战席全部棋子，包含普通召唤棋子；锻造器与选秀暂存保留。不调用出售，不给出售金币，不触发打捞桶的出售拆装。
- 永久装备原实例回库存，原单位的异常绑定、持久攻击成长终止；临时装备沿原装备重建边界清理，不产生永久资源。魔像的固定装备／训练魔像纹章也回库存，原出生收据保留，之后不再生成被移除的魔像。
- 按原文固定发 **1 个二星一费、3 个二星二费、2 个二星三费**。每个费用桶均取完整 `SHOP_CATALOG_BY_COST`、稳定 ID 排序、等权有放回，不按当前池余量筛选，允许同名。
- 使用既有按 seed／seat／choice／spec 绑定的独立 LCG 赠礼流；不消费商店、强化选择、战斗种子或普通奖励 RNG。
- 六份奖励在单人和联机均先成为灰色奖励法球，不生成棋子、不提前扣共享池、不提前合星。领取沿原 `claimOrb`／共享池事务；二星占 3 张，同名三份领取后正常升为三星、合计占 9 张。
- 共享池不足完整 3 张时，沿既有规则按**英雄费用**折金，不乘星级或出售倍率。满席沿既有法球容量处理；单人满席领取成功但原对象零事件，法球保留。
- **未注册候选池**：定义独立导出，没有加入 `AUGMENT_DEFINITIONS`、`AUGMENT_TIERS`、API-name 映射或阶段表。D5 再完成注册与统一重录；D4 不改任何纪元／golden／生成身份常量，不运行写入模式。

## 内部接口与失败语义

| 接口 | 输入／输出与边界 |
| --- | --- |
| `applyRestartMission(state: MatchState): { state: MatchState; events: readonly MatchEvent[] }` | 仅接在选择强化、记录 acquire 之后，发赠礼之前。未拥有、非取得轮、战斗中或已有完成标记：原对象、空事件。成功写逐单位移除及唯一完成边界，返回 `itemsReturned`；金币不变。 |
| `restartMissionGiftPlan(state: MatchState): AugmentGift[]` | 无持有者返回空；否则确定性重推 6 个既有 `augment-pool-batch1` 收据与二星定义，不按库存或领取进度重抽。 |
| `restartMissionRemovalId(owner: Pick<OwnedAugment,'choiceId'>): string` | 固定 JSON 元组 `['restart-mission', choiceId, 'removal']`，供池账本、历史验证共用。 |
| `restartMissionRemovedUnit(state: MatchState, unitId: string)` | 返回经 acquire 原阵容、轮次、资源前缀、移除事实及完成标记共同证明的移除条目，否则 `undefined`。仅为永久魔像退场扩展；普通魔像在场时全部原断言保留。 |
| `validateRestartMission(state: MatchState): void` | 恢复专用。无效拥有者／取得事实、缺失或重复完成标记、错轮或错序移除、缺失赠礼／法球，抛 `RangeError('Invalid restart mission authority')`。 |
| `grantMechanicUnit(..., request & { deferToOrb?: boolean }, policy?)` | 原内部赠礼请求增加延后入法球选项；D4 仅对本卡六份赠礼启用。召唤物依旧直接发放。公开网络命令不增加字段。 |

公共 `selectChoice`／`claimOrb`、共享 `choose`／`claimOrb` 的签名和失败枚举不变。过期／无效选择、重复领取继续返回原 state／pool，无事件、资源或 RNG 消耗。

## 账本与恢复

`unit-removed` 保存真实定义和星级；共享池既有 `reconcileHoldings` 归还全部持有来源，召唤物不入池。新增资源事实 `restart-mission-completed {choiceId}`，即使选取时空场也恰有一条，因此重试不会清掉之后领取的奖励。

资源折叠按选择收据验证移除者、轮次、星级及锻造器／选秀例外，并在完成边界验证完整清场。成长魔像按当轮派生星级核对，包含已有四星类型。赠礼验证要求六条 `resolution:'orb'` 原收据与对应法球；既有法球验证继续核对 payload／状态／领取证据，历史装备折叠证明装备已回库存。删除拥有者、清除事实、完成标记、领取收据或法球均不形成可恢复的合法状态。

`restart-mission` 继续使用 `augment-history-v1`，补显式 `acquire` 需求。联机恢复仍要求独立服务器 authority，不允许候选 JSON 自证；没有新 schema/save/replay/command 版本或客户端命令。

## 全部调用点

| 路径 | 现有调用链／D4 状态 |
| --- | --- |
| 单人规则 | `match.selectChoice → recordAugmentAcquisition → applyRestartMission → drainP2Gifts → drainBatch1Gifts`；领取 `match.claimOrb → planOrbClaim → grantDirectLoot`。规则专项覆盖，定义仅在测试直接查找时注入。 |
| 联机 server | `src/server/room/room.ts:188` 的 `applySeatCommand(choose) → runSharedMatchCommand → selectChoice`；`room.ts:194` 的 `claimOrb` 同样走共享事务；选择后的 `withPendingResolved` 沿原选秀待发迁入协议，不销毁暂存。服务器无需重算规则或新增命令。 |
| 本地房间 | `src/rendering/online/local-room-client.ts:124 → room.handle`，与服务器同一路径。 |
| bot | `src/server/room/bot-driver.ts:217 → Room.claimBotOrbs → claimBotPreparationOrbs`，沿原事务领取；专项验证六球合计 18 张池副本。 |
| 2D | `BoardScene` 选择回调 → `session.choose`；线上 `remote-session.ts:296/301` 提交 choose／claimOrb，读取既有棋子、库存、法球投影。 |
| 3D | `src/rendering/three-mode/placeholder-renderer.ts:455` 与 `tabletop.ts:294` 经既有 `BoardControls.claimOrb`，共用线上 Session 与权威投影，无规则分叉。 |
| 单人 UI 待接 | `src/rendering/match-session.ts:104` 当前显式阻止单人 claimOrb；D4 已提供单人规则领取，界面归 Claude，接线需求已记 `UI_REQUESTS.md`。候选池未开放，因此本次不会让普通玩家抽到无法领取的卡。 |

## 验证与 D5 事项

专项涵盖独立字面 FNV／LCG 抽签 oracle、同名重复、清场与装备／成长／异常、锻造器／选秀暂存、1／2／3 星归池、法球延后分配与九张合星、缺池折金、满席、bot、空场防重、JSON 资源恢复及篡改拒绝、永久魔像退场与不重生。

测试使用 `--maxWorkers=4`。本工作区共享 `node_modules` 只读，因此采用 `--configLoader runner` 与 `artifacts/d4/vitest.config.mjs`（保持 worker setup、四 worker，省去不相关的浏览器 global setup）；无浏览器测试、无浏览器启动需求。

最终相关回归 **10 个文件、241 项通过**（含 18 项 D4 专项）；覆盖商店赠礼、Batch3 清除、历史装备、重组器、奖励法球、共享池缓存／守恒、两种永久魔像。`npm run typecheck` 和 Vite 生产构建通过，2D 顶层 `dist/assets/*.js` 的 level-9 gzip 总和 **631,184 字节 ≤ 637,144**；未增加 lazy chunk。详细原始输出保留在忽略目录 `artifacts/d4/tests.log`／`build.log`／`size.json`。

v25 检查的 `check-identities` 通过，历史保护检查 **552 份证据逐字节一致**；最终源码重跑 `record-battle-start --check` 的三处实际快照（round 3／9／23）与现有 fixture 字节一致、切片与同步开战一致，随后仅在 `battle-start-audit.json` 的 `sourceDigests` 检查失败（`artifacts/d4/epoch-final.log`）。按用户预期保留源码摘要差异给 D5；未写证据。该检查在首个源码审计差异处停止，后续纪元步骤未运行，不宣称完整 epoch check 通过。

D5：注册定义／等级／API-name／阶段；接单人 UI 如需开放；统一更新源码审计与所需纪元证据，并完成真实候选选择、完整保存／恢复及房间验收。
