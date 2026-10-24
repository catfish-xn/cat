# 锻造器单位重做：v22 候选交付

状态：规则层候选，**待 v22 统一录制**。工作分支 `codex/anvil-units`，父提交 `c2179b9ef2ae070a01388f8a3b859b34551f0f7d`（`codex/v22-candidate`，含两批开局奇遇）。没有提交、联网、改 CI、更新 epoch/golden，也没有修改界面目录。

依据：用户 2026-10-23 授权及本地 `/home/aiapps/workspcae/perf-1022/rules-1023/anvil-redo.md`；沿用该文件的 14.24 客户端 map22 / zh_cn 调研，不另改 14.24b 数值或奖励权重。

## 设计与实现位置

| 位置（文件:行） | 行为 |
| --- | --- |
| `src/simulation/content/anvils.ts:4` | 四个原始 definitionId、中文名称/出售/悬停文案、30 秒策略；独立无人口单位，固定一星，不进入英雄卡池 |
| `src/simulation/anvils.ts:17` | 统一发放接口；`:21/26` 开局及 G2-3 法球投影，`:36` 按来源重建旧选项，`:55/69` 打开消费与恢复核对 |
| `src/simulation/match.ts:310` | `openAnvil`；`sellUnit` 对锻造器走同一入口，无金币；失败保留原状态，不产生事件/RNG 消耗 |
| `src/simulation/game.ts`、`upgrades.ts`、`unit-stats.ts` | 可在备战席挪动/交换；拒绝部署及把场上英雄换入锻造器所在格；不自动上阵、不合星、售价 0 |
| `src/simulation/inventory.ts`、`consumables.ts`、`input-assets.ts` | 不可装备、不可用消耗品作为目标；恢复必须为己方备战席一星单位 |
| `src/simulation/loot-runtime.ts:144`、`orb-claim.ts`、`orb-restore.ts` | forge 奖励分配 unitId；满席保持 revealed、没有领取收据；法球其他奖励可先发，重领只处理剩余；跨回合仍可领 |
| `src/simulation/opening-encounter.ts:275` | 蔚 2 基础、杰斯 1 神器直接入席；溢出以未领取法球保留，不自动弹窗 |
| `src/simulation/opening-batch-rewards.ts`、`opening-batch-b-rewards.ts` | 梅尔、战利品订阅、巨蟹等 forge 来源全部改为单位；旧自动选择 hook 停用 |
| `src/simulation/g2-3-rewards.ts`、`g2-3-runtime.ts` | MeepTypeUnit atom 标为 anvil，保留原采样顺序；征服者/黑市锻造器进入待领取法球，领取后入席 |
| `src/simulation/resource-provenance.ts:49`、`b8-restore.ts`、`shared-pool-ledger.ts` | 收据绑定单位出生，anvil-opened 消费单位；回放重建消费和装备出生；不占共享英雄池 |
| `src/simulation/private-seat-view.ts:25`、`bot/index.ts` | 本人单位带 anvil 展示字段；机器人领取后出售打开、选首项；满席重领不会无限循环 |

不保存另一份武器库列表：未打开单位的选项由其原始奖励 receiptId 和原采样器重建；打开才产生 `pendingChoice`。开局、Batch A、Batch B、史诗、G2-3 的旧种子流/排序/抽样算法均保留。打开先后顺序不消耗商店、战斗、奖励等其他 RNG 流。成装池保留窃贼手套。`portable-forge` 仍立即神器 4 选 1，`radiant-relics` 仍立即光明 5 选 1。

## 公开命令、输入输出与失败

```ts
openAnvil(state: MatchState, unitId: string): MatchCommandResult
// 单机：从 simulation/match 导入；Node：从 server-entry 导入。
runSharedMatchCommand(pool, state, { type: 'openAnvil', unitId })
// 已有出售命令完全等价：{ type: 'sell', unitId }
// 打开后仍用既有选择命令：
{ type: 'choose', choiceId, generation, definitionId: pendingChoice.offers[index] }
// 仅服务器/权威计时层调用，不能让客户端自报超时：
{ type: 'timeoutChoice', round, choiceId, generation }
```

成功：移除该锻造器，释放备战席一格；金币不变；`phase='choice'`，生成 `choiceOpened` 及资源事实 `{kind:'anvil-opened',unitId,choiceId}`。choiceId 为 `JSON.stringify(['anvil',unitId])`，客户端按不透明字符串回传。选择后装备以原 mechanic choice 收据进入库存，返回打开前的 preparation/settlement。

失败：`wrong-phase`（非备战/结算、已有选择、阵容锁定、淘汰或选秀）、`unknown-unit`、`enemy-unit`、`invalid-target`（非锻造器/不在备战席）；基础 choice 层另保留 `duplicate-mechanic-receipt`、`invalid-mechanic-state` 防御检查。共享事务外围仍沿用既有 pool/seat/revision 校验。重复打开已消费单位返回 `unknown-unit`，重复选择/旧 generation 按既有 `stale-choice` 拒绝。

```ts
grantAnvilUnit(state, {
  receiptId: string, source: MechanicSource, definitionId: string
}): MatchCommandResult
```

这是规则内部发放接口，不是客户端索奖命令。调用者必须提供已认证来源（开局、Batch A/B、G2-3）对应的奖励收据；未知来源不能作为可恢复存档。失败为 `invalid-mechanic-state`、`duplicate-mechanic-receipt`、`bench-full`，后者不写领取收据。Loot 来源使用现有 `LootPayload {kind:'forge',definitionId,quantity:1}` 和 `grantDirectLoot`，由冻结奖励计划认证。

**4-7 固定额外 1 个基础装备锻造器已启用（P，用户 2026-10-23 批准）。** 原有 2–4 个散件全部保留；在冻结奖励计划的首个已有法球末尾追加 forge payload，不替换奖励、不改变原奖励身份、不新增 RNG 消耗。单机/联机共用 `freezeLootThroughRound`；沿用 `claimOrb` 入备战席、满席留球、打开和收据恢复路径。14.24 原版数据未找到必出证据，仅有未被引用的 `EpicNPCLootComponentAnvil` 表，故不标为原版规则。**待 v22 统一录制**。

## 给 Claude 的接入点

| 本人视图字段 | 含义/用法 |
| --- | --- |
| `preparation.units[].id / definitionId / location` | 通用单位身份/备战席位置；四种 definitionId 为 `TFT_ArmoryKeyCompleted/Component/Ornn/Support` |
| `preparation.units[].anvil`（仅锻造器存在） | `{kind:definitionId,name,sellText,description,timeoutMs:30000,sellGold:0}`；kind 是原始 ID |
| `pendingChoice` | 既有 `kind:'forge'`、`choiceId`、`generation`、`offers`；新 payload 为 `{kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}` |
| `unclaimedOrbs` / 单机 `readLootView(state).unclaimedOrbs` | 包含满席遗留锻造器；条目 payload 仍为 forge；使用已有 `{type:'claimOrb',round,orbId}`；成功可能只领取部分，按新视图刷新 |

出售按钮/拖入商店使用 `sellText`，悬停使用 `description`，来源为 `anvilDisplay(definitionId)`（规则公共导出），不要显示普通英雄售价。原文为“开启一个由成装组成的武器库”及“将此物拖拽至商店，即可打开一个满是成装的武器库！你将有30秒时间来进行选择。”其他三种替换装备类别。单机同样调用该导出，不另写规则判断。

**计时接线仍由 Claude 完成：** 规则只输出 30000ms 窗口并提供超时首项结算，不使用真实时钟。打开成功后，权威应用/服务器按该次 choiceId+generation 启动独立 30 秒截止时间；选择成功取消计时，断线重连保留服务器截止时间；超时调用既有 timeoutChoice/forfeitPendingChoice。当前 room 的全局准备/选择 deadline 不等于“本次打开后 30 秒”，不得直接当作本功能已验收；尤其准备倒计时末尾打开不能提前强选。单机应用也需绑定计时与恢复。规则存档保留武器库和确定性结果，不保存墙钟时间。

对手/观战沿用 `toPublicBoard` 白名单，只看到公开的备战席单位 definitionId/星级/位置；看不到本人 pendingChoice、未开奖选项、RNG、领取账本。不要把私有 anvil 选项复制到 public projection。

`src/server/` 最小改动仅三处：`protocol.ts:241` 命令 union、`net/messages.ts:261` 严格参数解析、`room/room.ts:122/153` 命令 gate 与公共共享事务转发。没有加入房间计时、结算或规则运算；`src/server-entry/index.ts:3` 仅增加公共导出。

## 收据、版本与合并

领取使用原奖励身份的 unit 收据/loot grantedUnitIds；打开另记 anvil-opened；选择使用 anvil choiceId 的 choice 收据。恢复交叉核对来源、单位、消费事实、4 个选项、免费选择、超时首项，拒绝重复消费、篡改选项和无来源单位。满席不提前写领取收据，不消耗单位序号。

候选 `rulesVersion=s13-g2-3-v22-anvil-units-candidate`、`contentVersion=s13-14.24b-g2-3-v22-anvil-units-candidate`；schema12/save8 保持，replay7/command7；新增策略进入 manifest，CONTENT_DIGEST/LOOT_REPLAY_DIGEST 随内容计算变化。旧身份不冒充当前存档。**待 v22 统一录制**，合并 cat-v22/cat-5c/cat-aug 后统一定稿身份与录制，本分支不改历史断言或签收证据。

共享文件改动集中在 match、units、game、inventory、consumables、upgrades、unit-stats、资源/恢复/共享池、G2-3 rewards/runtime/state、private-seat-view、m8 version/contracts、rules-manifest，以及 tests/t7-helpers 的命令分支。锻造器主逻辑集中在两个新文件，便于并行分支合并；没有修改攻击星级、五费技能或海克斯等级内容。

## 验证

结果见 [逐项失败清单](ANVIL_UNITS_TEST_FAILURES.md)。旧断言、epoch、digest 固定快照和 golden 均未改。Vitest/Vite 使用 `--configLoader runner`，避免只读共享 node_modules 的 `.vite-temp` 写权限问题；没有修改配置或依赖。

- 新增 `tests/anvil-units.test.ts` 10 项、`tests/anvil-rewards.test.ts` 15 项，**25/25 通过**：四种标识、蔚/杰斯、满席/混合法球部分领取、跨回合保留、出售打开、30 秒策略及单机/联机超时首项、装备入库、存档/资源回放、私有/公共投影、机器人、订阅/梅尔/巨蟹/史诗/G2-3 来源、两种海克斯立即选择。
- 旧相关回归 22 文件 **615 项：550 通过 / 65 失败**；父候选同集 **572 通过 / 43 失败**。22 个新增失败全部来自旧自动弹窗、旧 atom 类型和旧规则身份预期；逐项列于失败清单，没有改断言。合计已运行 **640 项：575 通过 / 65 失败**（新测试最终单独复跑一次）。
- `npm run typecheck` 通过；`npm run build -- --configLoader runner` 通过；`git diff --check` 通过。测试命令使用 `npm test -- --configLoader runner`，无联网安装。
- 按 `scripts/m7-budget.cjs` 的 2D 顶层 JS gzip level9 算法，本候选 **664,860 B**，父候选 **663,313 B**，增量 **1,547 B（0.233%）**；3D 分块不计入，与 CI 一致。
- 同依赖重建 CI 固定 M7 提交 `15313a75c6e74beec739fe52a2875c104c55eae3` 得 **424,407 B**；父候选比率 **1.562917**，本候选 **1.566562**，均超过 **1.50**，本候选超过上限约 **28,250 B**。这是已复现的 JS 静态门槛失败，不是通过；未调整门槛，也未做无关目录减包。未运行浏览器首交互预算。

剩余验收：Claude 界面/实际计时器/重连截止时间、合并后的 v22 统一录制及已有 JS 体积超标处理。真实公共命令路线已覆盖 5-7 满席跨到下一回合领取、打开前/中/后存档恢复；人工修改状态的奖励边界测试另用于覆盖全部分支，不把它们当作完整对局回放。

## 2026-10-23：4-7 补充验收

本次不新增公共命令、字段或失败原因，`claimOrb` / `openAnvil` 合同不变。`ANVIL_POLICY.version=anvil-units-v2`，规则/content 沿用本分支 v22 候选身份；双摘要离线重算，历史 epoch/golden 不改，**待 v22 统一录制**。固定奖励仍以对应野怪载体死亡作为揭示条件，复用现有法球发放时点。

测试覆盖 64 个 seed 的额外恰 1 个基础锻造器、原 2/3/4 散件数量与全部原抽样奖励保持、无额外 RNG 消耗、显式共享布局与单人计划一致、冻结账本恢复；共享满席留球/腾位重领/重复拒绝/卡池守恒；真实公共 4-7 路线领取与打开前中后存档、资源回放一致。

本次验证：`npm test -- --configLoader runner tests/anvil-47.test.ts tests/anvil-units.test.ts tests/anvil-rewards.test.ts`，3 文件 **28/28 通过**；`npm run typecheck`、离线双摘要 `--check`、`git diff --check` 通过。双摘要 CONTENT=`fnv1a32-utf16:f335dc93`、LOOT_REPLAY=`fnv1a32-utf16:4323f5a2`。未联网、未改 CI、未提交。

## 2026-10-24：补给回合（P）

补给回合的结算阶段不能打开锻造器：`openAnvil`／出售锻造器返回 `wrong-phase`，因为补给回合不接受机制选择。锻造器留在备战席，下个准备阶段可打开。见 `docs/S13_RULES_GAP.md` 同日条目。

## 2026-10-24：阶段截止延长上限（P，用户选乙）

联机房间里打开的锻造器会把当前阶段截止延长到它自己的截止，但同一阶段合计最多延长 30 秒；到上限还没选的锻造器由阶段超时自动选第一项。见 `docs/S13_RULES_GAP.md` 同日条目，房间测试 `tests/server/anvil-choice-deadline.test.ts`。
