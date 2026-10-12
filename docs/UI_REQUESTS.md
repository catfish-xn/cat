# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付阶段、缺少的字段与含义、界面当前替代路径、交付后需要复核的内容和验收条件。界面不自行计算规则；后端交付前，界面只读已有权威字段，并在无法确定含义时使用中性文案。

## U6 已揭示掉落、领取与结算（静态阶段盘点）

基线：`feat/m8-b0-baseline` 的 `f18985131c08c729f5bcf8cc8de8bbd3eec59a3d`；分支 `feat/m8-u6-static`。B8（PR #28）尚未签收，`readLootView` 接线排在 B8③。本阶段只做静态界面：渲染函数直接以冻结的 `LootView`／`RevealedDropView`（M8_UI_CONTRACT §5）和 `PendingChoice`（M8B_CONTRACT_ADDENDUM §3.3）为输入类型，样例只在开发服务器的 `/u6-preview.html` 上展示，不进入游戏入口和生产构建。

优先级：P1 = 正式接线前必须明确，否则界面只能猜测或混淆状态；P2 = 影响显示完整度；P3 = 需要确认。

### 已有、可直接使用的形状

| U6 需要 | 权威来源 | 备注 |
| --- | --- | --- |
| 已入库／处理中／等待空位／终局保留 | `RevealedDropView.status/receiptId/reason` | 只有 `granted` 显示“已入库”；不按金币变化或动画猜收据 |
| 奖励内容 | `payload.kind/definitionId/quantity` | 名称、图标沿用 UI 名表和装备图鉴 |
| 继续是否可用及原因 | `LootView.canContinue/reason/pendingClaims` | 界面不另算阻塞 |
| 八组件选择与命令 | `PendingChoice.offers/choiceId/generation` + `selectChoice(choiceId, generation, definitionId)` | 固定 8 项、不可刷新；结果以命令返回为准 |

### UR-U6-01 已解决组件选择的只读投影（P1，B8③，合同增补）

- 现状：ADDENDUM §5.1 要求“新增选择奖励的只读投影……现有 UI 合同缺少的只读形状需作为增补提交”，目前仓库和 PR #28 中都没有这份增补。冻结 `LootView` 只有具体 payload 的 `revealedDrops`，没有说明已解决的选择是否出现在其中、以哪个 `dropId` 出现。
- 需要：明确已解决选择的展示形状。例如作为 `revealedDrops` 中 `status:'granted'` 的 item 行（`dropId` 为选择的 dropId、`receiptId` 为其 LootReceipt），并区分 `player-choice`／`terminal-fallback` 两种解决方式。
- 用途：“已揭示奖励与已解决选择的结果”和“提前终局时自动选定的组件”。
- 当前替代：静态样例按 granted item 行展示，不区分解决方式。
- 验收：玩家选择和终局 fallback 都以唯一收据的已入库行出现；未解决的选择从不显示为已拥有物品；未用到的 fallback 从不出现。

### UR-U6-02 选择期间的继续阻塞原因（P1，B8③，合同增补）

- 现状：`LootView.reason` 只有 `pending-capacity | unsettled-round | game-over | null`。ADDENDUM §5.1 要求未解决自选“须有明确的待选投影与阻塞原因，不能……伪装成英雄容量问题”。
- 需要：在 `phase==='choice'` 时，明确 `readLootView` 返回的 `canContinue/reason`。可以增加例如 `pending-choice` 的原因值，也可以由合同写明 `reason=null` 时以 `PendingChoice` 为准。
- 当前替代：样例为 `canContinue:false, reason:null`，阻塞文案取自 `PendingChoice` 是否存在。
- 验收：选择与满席同时存在时，按 ADDENDUM 的顺序先显示选择、后显示容量，两种原因不相互覆盖。

### UR-U6-03 待选项的来源（P2，B8③）

- 现状：`PendingChoice` 没有 dropId／sourceUnitId 等来源字段；`choiceId` 是编码后的标识，界面按约定不解析它。
- 需要：在 UR-U6-01 的只读投影中给出当前待选项的来源（sourceUnitId 或已解析的怪物定义）。
- 当前替代：选择框只写“本回合野怪奖励”，不写具体怪物。

### UR-U6-04 掉落来源名称的读取路径（P3，确认）

- 计划：用同一回合 `readEncounterPreview(state).units[].unitId` 匹配 `RevealedDropView.sourceUnitId`，再取 `definitionId` 并通过 UI 名表显示怪物名。
- 需要确认：`LootView.roundId` 是否总是当前回合（包括选择期和提前终局），以及 `sourceUnitId` 是否与预览中的 `unitId` 为同一编码。如果不能保证，请在视图中直接给出来源的 `definitionId`。

### UR-U6-05 战中揭示的可见性（P3，确认）

- 现状：冻结表把 `revealed` 写为“领域正在同事务自动处理”；ADDENDUM §3.1 则规定战中只揭示、战后统一授予。
- 需要确认：战斗进行中 `readLootView` 是否返回 `revealed` 行（界面计划在战斗中显示“已揭示 · 战后处理”），还是只在战斗结束后才有数据。

### 正式接线待办（B8③签收后）

1. 在结算、选择、终局三个阶段，策略面板读取 `readLootView(state)` 渲染奖励列表；来源名称按 UR-U6-04 处理。
2. 选择框：根据 UR-U6-01／03 的来源信号（不解析 `choiceId` 前缀）判断是野怪组件选择，改用八组件布局；点击调用现有的 `session.choose(choiceId, generation, definitionId)`，沿用现有的防重复点击和关闭遮罩。
3. Continue 按钮的可用状态与提示改读 `canContinue/reason`；命令失败时显示领域返回的原因。
4. 终局页面显示保留奖励的只读记录，不提供任何领取或折算操作。
5. 奖励英雄出现在棋盘或备战席时，依赖 DOT 在 B8 分支修复的 BoardScene 生命周期提交（`07f269c`），U6 不重复修改该处。
6. 接线后重新实测包体（静态阶段探针：引入三个渲染函数约 +1,416 B），并请 Codex 补充 U6 界面自动回归。

### U6 接线状态（2026-10-10，Claude 接手 B8＋U6 后）

`readLootView` 已在 B8 分支实现（`src/simulation/loot-view.ts`，经 `match.ts` 导出），策略面板已接线。以下记录每项请求的实际处理结果；**没有修改冻结的 `LootView` 形状**，需要改合同的部分已按 2026-10-10 批准的最小增补实施（见 [U6 LootView 增补](M8_U6_LOOT_CONTRACT_PROPOSAL.md)）。

| 项 | 处理结果 | 证据 |
| --- | --- | --- |
| UR-U6-01 | 已解决的组件选择只在其 LootReceipt 存在后以 `status:'granted'` 行出现（dropId 为选择的 dropId，payload 取自收据）；未解决的选择和未用到的终局备用组件不出现。冻结形状无法区分 `player-choice`／`terminal-fallback`，界面不区分；如需区分须另行增补合同 | `tests/m8-b8-loot-view.test.ts` 选择后与终局三场景 |
| UR-U6-02 | **按 2026-10-10 批准的增补已改为 `reason='pending-choice'`**（补给/强化/异常选择仍为 `unsettled-round`），不伪装成 `pending-capacity`；选择与满席并存时，选择完成后才转为 `pending-capacity`。原因顺序与 `nextRound` 守卫一致，测试逐例比对命令结果 | 同上 `agreesWithContinue` |
| UR-U6-03 | **按批准的增补已解决**：`LootView.pendingChoice` 给出待选项身份（含 sourceUnitId）；界面据此判断野怪选择并显示来源名，不再按回合类型推断、不解析 `choiceId` | `strategy-panel.ts` `renderChoice` |
| UR-U6-04 | 已确认：`roundId` 恒为当前回合；`sourceUnitId` 与同回合 `readEncounterPreview().units[].unitId` 同一编码，测试断言每条已揭示掉落恰好匹配一个预览单位 | 测试“mid-combat”用例 |
| UR-U6-05 | 已确认：战斗进行中返回 `revealed` 行，界面显示“已揭示 · 战斗结束后自动入库” | 同上；浏览器实测 1-3 战中截图 |

接线内容：PvE 回合开战后（战斗、选择、结算）显示 `lootPanelSection`，终局显示 `lootTerminalSummary`；战斗中仅在投影变化时刷新。Continue 是否可用、原因及等待入库数量全部来自 `LootView`，界面不发领取命令、不按金币或动画推断收据。

## U5 第一阶段与 `.7` 野怪遭遇预览（开工前接口盘点）

**交付状态（2026-10-10）：U5 已独立审查并合入。** PR #26 已审查 SHA `855430157b6947d4b9710db3b08f6842f1c9347d`（[CI #168](https://github.com/catfish-xn/cat/actions/runs/38019557635) 成功，无 P0–P2），合并提交 `d64c381260c4c862d813da7e8c7c983813ce89e0`，合并后的 tree 与已审查 HEAD 完全一致。预览已改读 UR-U5-01/02 正式字段，不再依赖旧适配层。包体实测 488,964 B，距总上限 552,191 B 余 63,227 B。仍未完成：6-7 先锋的实机导入和完整应用验证由 B9 补验；非阻塞 P3「U5 界面自动回归」登记为 [#27](https://github.com/catfish-xn/cat/issues/27)。独立审查证据：Codex 原审查记录已补记为 [PR #26 评论 6093541375](https://github.com/catfish-xn/cat/pull/26#issuecomment-6093541375)，内含原始 `u5-review-evidence.json` 的完整副本（35,015 B，SHA-256 `12b86d324d5b9d5abaa6a0fff71c1f063a4470d89d33d927bf13ff3b1440662a`）。时间顺序：审查结论先由用户在会话中转达；随后 PR 于 03:50:57Z 合并，本记录首版（`2acb9ac`）于 03:52:24Z 写入，当时 PR 上尚无审查记录；原审查记录于 03:59:55Z 补记（均为 2026-10-10 UTC）。该评论是对原审查（针对 `8554301`、CI #168）的补记，不是重新审查，也不构成对合并提交的新签收。H1 维持 [H1_WARN_ONLY.md](H1_WARN_ONLY.md) 原记录，不因本次 CI 全绿而关闭。

基线：`feat/m8-b0-baseline` 的 `8778269`（B7 PR #21 已合入）。以下为该基线开工前的数据盘点。2026-10-10 更新：用户已批准 M8 专用 JS 新上限及 U5 先沿已有适配路径开工；UR-U5-01/02 已签收、已合并（PR #25，`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`），见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。下述两项的“现状/当前替代”保留为开工前历史，不再表示新字段缺失。

优先级：P1 = U5 第一版必须有，否则显示不准确或只能混用两个数据源；P2 = 第一版可以先用占位，补上后显示更完整；P3 = 可选。

### 已有、可直接使用的字段（无需新增）

| U5 需要 | 权威来源 | 备注 |
| --- | --- | --- |
| 阶段、小回合、类别、是否终局、显示名 | `readRoundInfo(state)` → `RoundDefinition.roundId/ordinal/stage/subround/kind/isFinal/encounterId/displayName` | 现有 HUD 用 `getStageRound(match.round)`，它已读取目录，数值正确；U5 改为直接读 `displayName` |
| 敌方阵容、位置、星级、名字 | `readEncounterPreview(state).units[].unitId/definitionId/name/starLevel/cell` | 补给轮返回 `null` |
| 四项基础属性 | `.units[].stats.maxHp/attackDamage/armor/magicResist` | 来自开战前的 strategy snapshot，PvP 包含装备和羁绊 |
| 能力说明、规则说明 | `.units[].abilityDescription`、`.rulesNote` | 中文玩家文案，界面原样显示 |
| 回放中的回合名 | `readRoundInfo(record.context)` | 回放记录的 `context` 是完整 `MatchState`，无需新增字段 |
| 开战/继续失败原因 | 公共命令的 `reason` | 已有 |

### UR-U5-01 预览单位的分类字段 `unitKind` / `monsterFamily`（P1，B7 后续，修改冻结类型）

- 状态：**已签收、已合并**；Claude Code 复审签收 `d2e7558`，PR #25 合并提交 [`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`](https://github.com/catfish-xn/cat/commit/4acea21818dc8ff2ef1e266d3aed51c78b81d74f)；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。
- 现状：`EncounterPreview.units[]` 不能区分英雄和野怪。界面只能回退到 `UNIT_DEFINITIONS[id]`，但其中的野怪条目是 ENCOUNTERS §3 允许的旧类型适配（`cost:1`、`symbol:'兽'`、`color`）。`getHeroIdentity()` 会因此把野怪显示成“1费”，职业行显示为空或“中立”。
- 需要：`units[].unitKind: 'champion' | 'neutral'`，`units[].monsterFamily: MonsterFamily | null`（英雄为 null）。值取自冻结内容，与恢复校验同源，不按 ID 前缀推断。
- 用途：野怪不显示费用、职业行和英雄头像框；按 `monsterFamily` 分组显示（例如“石甲虫 ×3”）。
- 当前替代：开工后先读适配层的 `UNIT_DEFINITIONS[id].unitKind`，并屏蔽野怪费用；字段交付后改读预览。
- 验收：8 场 PvE 的 25 个单位全部为 `neutral`，family 与 ENCOUNTERS §3 表一致；PvP 单位全部为 `champion`，family 为 null。

### UR-U5-02 预览单位的完整开战属性（P1，B7 后续，修改冻结类型）

- 状态：**已签收、已合并**；Claude Code 复审签收 `d2e7558`，PR #25 合并提交 [`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`](https://github.com/catfish-xn/cat/commit/4acea21818dc8ff2ef1e266d3aed51c78b81d74f)；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。
- 现状：`stats` 只有生命、攻击力、护甲、魔抗。射程（远程小兵 3、远古龙和先锋 2）、攻击间隔、基础暴击（野怪 25%/1.4 倍）、法力都没有，只有 `rulesNote` 里的一句文字。
- 需要：在 `stats` 中增加 `attackRange`、`attackIntervalTicks`（开战时的值；野怪由 `baseAttackSpeedBps` 按 G01 算出）、`critChanceBps`、`critMultiplierBps`、`abilityPower`、`mana`、`maxMana`。来源与现有四项相同（strategy snapshot），不能另算。
- 用途：遭遇预览卡和敌方单位详情。
- 当前替代：用 `getUnitStats(definitionId, starLevel)` 补齐。野怪的值与预览一致；PvP 单位缺装备和羁绊加成，会与预览的四项属性来源不一致，因此界面对 PvP 只显示现有四项。
- 验收：对 8 场 PvE 和至少一个 PvP 轮，预览值等于 `startMatchCombat` 后 tick 0 对应 `CombatUnit` 的值。

### UR-U5-03 野怪图片（P2，资源管线）

- 现状：`S13_ASSETS` 只有英雄（`kind:'champion'`）。`selected-neutrals.json` 归档了 7 个野怪 apiName 的 icon/squareIcon：TFT_Krug、TFT_Murkwolf、TFT_MurkwolfMini、TFT_Razorbeak、TFT_RazorbeakMini、TFT_ElderDragon、TFT_RiftHerald。五种小兵没有归档记录（ENCOUNTERS §1）。
- 需要：
  1. 内容数据给出 `definitionId → apiName | null` 对照，并附归档记录指针；小兵为 null。
  2. `scripts/fetch-s13-assets.cjs` 支持这 7 个 apiName，生成 `kind:'neutral'`、按 definitionId 编号的清单项（含 source、bytes、sha256）。界面不手绘、不用相似英雄图代替。
- 用途：棋盘野怪棋子、预览卡头像。图片只是外观，不作为 14.24b 机制依据。
- 当前替代：类型色块加名称首字作为占位；小兵永久使用占位。
- 验收：清单补齐后无需改界面代码；7 种野怪显示图片；在 `/cat/` 子路径下可读；受控 404 时回退为占位。

### UR-U5-04 能力短名称（P3，可选）

- 现状：能力 ID 是内部标识（如 `stone-salvage-project-v1`），不能显示；预览只有一段说明文字。
- 需要（可选）：`units[].abilityName`，例如“残骸回收”“狼群扑袭”，由内容提供并核实中文。
- 当前替代：卡片标题用单位名，正文用 `abilityDescription`。

### 需要确认的约定（不是新字段）

- **PvP `encounterId = pvp:<roundId>`**：用户已批准；界面只把它当作不透明的显示键，不用作素材键或掉落键，也不解析前缀。
- **预览范围**：`readEncounterPreview` 只描述当前轮（准备、战斗、结算阶段都能读，`nextRound` 后切换）。U5 第一版不提供“下一轮预告”；如果需要，要新增接口，并由 Codex 判断可公开的范围。

### 体积影响（U5 开工前实测）

同一环境（Node 22.22、zlib 1.3.1，按 `m7-budget` 的方法：每个 `dist/assets/*.js` 先单独 gzip level 9，再求和）：在 `8778269` 上只加入 `readEncounterPreview` 的 import，不加任何界面代码，JS gzip 从 **485,743 B** 增到 **487,353 B**（**+1,610 B**）。按现行上限 488,477 B 计算，留给 U5 全部界面代码的只有 **1,124 B**。其中英雄说明表 `HERO_RULES` 约占 842 B。UR-U5-01/02 会再增加少量字节。U5 是否开工取决于体积新上限。

## U4 通用战斗状态、来源与统计反馈（U4 第一版）

基线：`feat/m8-b0-baseline` 的 `5dce5cd`（B3 三批均已签收）。U4 第一版提交见 PR #12（首版 `2f36e62`，审计 R1–R6 修订在其后）。

优先级：P1 = 影响 U4 第一版显示是否完整、准确；P2 = 统计/回放的完整度；P3 = 后续内容接入时需要。

### 实战事件已携带 / 未携带的权威字段（以 `5dce5cd` 实际发事件路径为准）

| 字段 | 实战状态 | 界面用法 |
| --- | --- | --- |
| `CombatUnit.mechanismState.statuses`（StatusGroup）、`.activities` | 已有 | 当前状态列表、棋子状态小标（经 `combat-status.ts` 的 `statusSource()` 单点读取） |
| `ShieldLayer.m8State`（含完整 `source`、`absorbed/decayed/expiredDiscarded`） | 已有 | 护盾账目与来源（优先 `m8State.source`） |
| `heal.outcome`（`shares[]`、`requested/afterWound/actual/overheal/preventedByWound`） | 已有（`s13-mechanisms.ts` 唯一治疗路径） | 单条治疗事件的来源分项 |
| `statusChanged.group` | **部分**：`applyFrozenStatus`、到期、净化路径有；`applyStatus()`（现有英雄技能）施加、死亡/战斗结束清理路径**没有** | 有 group 读 group；没有时见 UR-U4-05 |
| `statusChanged.activity`、`shieldLayerChanged.endReason` | 已有 | 引导/分担结束原因、护盾结束原因 |
| `packetDamage.outcome` | **未携带**（`combat-s13.ts:280–282` 注明留待 B9/replay2） | 只读旧字段 `damageType/hpDamage/absorbed/critical/redirected`；`prevented/overkill/killingPacket` 显示分支目前不会触发 |
| `manaChanged.outcome` | **部分**：仅有限回蓝请求路径（`combat-s13.ts:390`）携带；普攻/受伤/施法路径只有旧字段 | 有 outcome 显示原因/锁蓝/溢出，否则显示旧字段 |
| `cast.receipt` | **未携带**（只有 `targetIds/manaSpent`） | 只显示选中目标 |

### UR-U4-01 `readCombatStatuses(combat)` 运行实现（P1，B3 补交付）

- 合同：B2 §3、§8；`src/simulation/m8/ui-contracts.ts` 的 `CombatStatusesView` 只有类型，没有运行导出。
- 需要：纯函数 `readCombatStatuses(combat) → {statuses: StatusGroup[], activities: CombatActivity(lifecycle='active')[]}`，不改 state/RNG。
- 适用范围：减伤等带 `damageFilter` 的贡献按每个伤害包筛选后再取强（M8_RULES A08），组内 `effectiveSourceKey` 只是无包上下文的摘要。若希望界面显示“对哪类伤害当前生效”，请在查询中提供权威的按适用范围划分结果；界面不会自行执行过滤。
- 当前替代路径：`combat-status.ts` 的 `statusSource(combat, unitId)` 直接读 store；带 `damageFilter` 的贡献全部显示并列出声明的适用范围，从不标为“被压制”；无过滤的同类最强（灼烧、重伤、击碎等）才依据 `effectiveSourceKey` 标注“同类状态由另一来源提供（本来源保留）”。领域选定的可能是更强来源，也可能是同强度时按 key 选定的一份；界面不比较强弱，文案不暗示大小。
- 交付后复核：替换 `statusSource()` 一处；8% 普攻 + 50% 技能减伤例两行都显示为有效并各带适用范围；查询前后 canonical 状态与 RNG 不变。

### UR-U4-02 M8 统计视图 `readCombatStats(combat)`（P2，B3 补交付）

- 合同：B2 §3，冻结 `CombatStatsView.units[].bySource[]{source,hpDamage,healing,requestedHealing,preventedByWound,overheal}`。现有 `BattleStats` 没有 `bySource`。
- 当前替代路径：统计表沿用 `BattleStats` 总数；单条 `heal` 事件明细直接展示 `outcome.shares[]` 的 `requested/actual/overheal/preventedByWound`（不跨事件聚合）。
- 验收样例（M8_RULES A10，饮血请求 20、枪刃请求 15、缺血 20），两套分开核对：
  - 无重伤：总请求 35、有效 20、过量 15；饮血 有效 11 / 过量 9，枪刃 有效 9 / 过量 6；重伤减少 0 / 0。
  - 33% 重伤：总 35 → 重伤后 23 → 有效 20、过量 3、重伤减少 12；饮血 有效 11 / 过量 2 / 重伤减少 7，枪刃 有效 9 / 过量 1 / 重伤减少 5。
- 额外需求（**不是冻结字段**）：按单位汇总的 `preventedByWound`。冻结合同只有 `bySource[].preventedByWound`；若要加单位总数，需走合同变更，不要直接改冻结正文。界面在没有该字段时不显示单位级重伤总数。
- 交付后复核：统计表按来源显示上述两套数值；seek/切战重建不重复累加；真实伤害单列。

### UR-U4-03 完整事件载荷：`packetDamage.outcome`、`cast.receipt`、`manaChanged.outcome`（P1，B3 开发适配 / B9 replay2）

- `packetDamage.outcome`（`DamageOutcome` 全字段，含 `context.source` 完整来源、`prevented/overkill/killingPacket`）：实战未携带。界面已有读取 `outcome` 的分支，但仍从旧字段 `unitId/hpDamage/absorbed/critical/redirected` 取目标与数值：
  - 若开发期适配**保留旧字段并附加 `outcome`**，界面可直接接入，只需复核显示。
  - 若 B9 切换为冻结的 `packetDamage{outcome}` 结构（无旧字段，`contracts.ts` `M8CombatEvent`），界面消费端（`combat-status.ts`、`combat-feedback-renderer.ts`、统计筛选）仍需适配并小范围复核；请随交付在本文件登记切换提交。
- `cast.receipt{targetIds,targetsSampledAtTick,actualManaSpent,refundedMana,completed,completionCell,actionSeq}`：用于“施法选中 A / 实际命中 B”（A11 麦迪例）和实际耗蓝/返蓝；当前只显示选中目标。
- `manaChanged.outcome`：普攻/受伤/击杀等回蓝路径缺失。冻结 `ManaOutcome` 表示**一笔回蓝请求**的结果，请为每种回蓝请求各自发布对应的 `ManaOutcome`；不要把施法扣蓝或同 tick 净变化塞进 `ManaOutcome`。施法消耗由界面读 `cast.receipt.actualManaSpent`，返蓝读绑定该次施法（`castActionSeq`）的 `cast-refund` outcome。
- 交付后复核：伤害明细出现“被防止/溢出/致命”；临时子件造成的伤害显示“临时子件”标记；麦迪例同时显示选中 A 与命中 B；界面不以法力净变化推算耗蓝。

### UR-U4-04 引导/分担按冻结的 `activityChanged` 接线（P2，B9）

- B2 已冻结引导/分担使用 `activityChanged{activity, reason}`（`M8_UI_CONTRACT.md` §8、`contracts.ts` `M8CombatEvent`）。当前实战以 `statusChanged` 携带 `activity` 发出，只是开发期适配，不等于符合正式回放格式。
- 需要：按冻结结构发布 `activityChanged` 并加入 `CombatEvent` 联合；同时通知界面，界面消费端（事件明细、筛选、飘字、状态小标）同步改读该事件并复核。
- 验收：范德尔 10 开始、20 被眩晕取消，事件明细显示“引导 被控制打断”，状态列表在 20 起不再显示引导，40 眩晕结束后也不恢复。

### UR-U4-05 所有 `statusChanged` 路径携带正式 `group`（P1，B3）

- 问题：兼容锚点 `status.kind` 不能表达正式状态种类与影响属性：
  - 施加（`combat-s13-state.ts` `applyStatus()`，现有英雄技能）：无 `group`。`resistanceFlat` 可能只改护甲（库奇）或双抗（芮尔），`amount` 单位随种类不同（减伤/击碎/攻速为 Bps，抗性/法强为固定值）。
  - 到期：`s13-mechanisms.ts:202` 为无锚点贡献生成 `kind:'resistanceFlat', amount:0`（带 group）。
  - 死亡清理 / 战斗结束（`s13-mechanisms.ts:274`）：所有贡献统一生成 `kind:'stun', amount:0`，**无 group**。实际复现：灼烧、重伤单位阵亡后日志显示“眩晕 0 阵亡清除”。
- 当前替代路径（`combat-status.ts` `LEGACY_ANCHOR`/`trustedAnchor`）：仅当锚点带 `contributionKeys` 或 `activity`（即真实存储的记录）时解读其种类；减伤、护甲击碎、攻速按 Bps 显示百分比；`resistanceFlat` 只显示中性“属性变化 ±N”，不判断是护甲还是双抗；其余无 group、无关联的锚点显示为“状态清理（原因）”。不按英雄名特判，不解析内部 key。
- 需要：施加、刷新、到期、净化、死亡清理、战斗结束各路径的事件都带正式 `group`（至少含结束贡献的完整身份、`application.kind` 与 `modifier`）。
- 验收：厄加特显示“护甲击碎 20%”，蕾欧娜“减伤 50%”，芮尔“属性削弱 护甲 −10 / 魔抗 −10”，库奇“属性削弱 护甲 −1”；灼烧/重伤单位阵亡显示“灼烧 阵亡清除”“重伤 阵亡清除”，不出现“眩晕”。

### UR-U4-06 父装备名称与本场冻结来源名称（P3，B5/B9）

- 已有字段（界面已读取，不需等待）：`Source.parentItemInstanceId` 存在于 `m8State.source`、`heal.outcome.shares[].source`、`StatusContribution.source`、`activity.source`。界面在这些路径显示“临时子件”标记，统计面板与策略面板共用同一来源格式（`originLabel`）。
- 旧字段缺父信息：`ShieldLayer.source`、`packetDamage.source`（outcome 未发前）、无 group 的状态锚点只有 `CombatOrigin`，这些路径暂时显示不出标记（伤害路径随 UR-U4-03 解决）。
- 未交付：父实例 → 父装备定义 / 名称的只读映射；回放使用该记录对应的冻结内容名称（合同 §3）。
- 验收：窃贼手套临时子件来源显示为“某临时装备（来自窃贼手套）”；切换内容版本后旧回放名称不变。

### UR-U4-07 U4 桌面 Chromium 定向验证（P1，Codex 编写；Claude 不改 tests/、CI）

现有 `tests/m6-stats-browser.cjs` 的 17 项只覆盖旧结构事件和无 `mechanismState` 单位，不能发现 U4 语义错误。请补一组桌面 Chromium（1440×1000）组件或路线验证。领域数据应由公开流程或领域函数产生（`applyStatusContribution`、`resolveHeal`、`grantShieldState/maintainShield`、实际 S13 战斗），不要手写与领域不一致的假数据。

| 场景 | 输入 | 预期显示 |
| --- | --- | --- |
| R1 减伤适用范围 | 同一单位：8% 减伤 filter={basic-attack; physical/magic; exclude}，50% 减伤 filter={ability-direct; …}；再受 100 物理普攻。前提：目标护甲 0，无护盾、无暴击，无其他增伤/减伤 | 领域 HP 伤害 92；状态列表两行均无“同类状态由另一来源提供”、无 inactive 样式，各显示“适用：普攻…”“适用：技能直接伤害…” |
| 同类最强（无过滤） | 两个 shred：30% 至 100、50% 至 60；状态快照由领域维护生成（实际战斗推进或领域维护函数），读 tick 59、60、61 | 59：50% 行正常、30% 行“同类状态由另一来源提供（本来源保留）”；60 与 61：仅 30% 行且无该文字 |
| 同类同强度 | 两名同星厄加特对同一目标施法，各施加 20% 护甲击碎（领域按 key 选定一份） | 两行均显示“护甲击碎 20%”；领域未选中的一行显示“同类状态由另一来源提供（本来源保留）”，不出现“更强”等暗示大小的文字；界面不比较或排序 |
| R2 兼容施加锚点 | 厄加特/蕾欧娜/芮尔/库奇技能施加（`applyStatus()` 事件，无 group、带 `contributionKeys`） | 事件日志：“护甲击碎 20%”“减伤 50%”“属性变化 -10”“属性变化 -1”；UR-U4-05 交付 group 后改按“正式 group”预期 |
| R2a 兼容清理锚点 | 输入固定为**无 group、无 `contributionKeys`、无 activity** 的清理事件（当前 `cleanupMechanisms` 形状：`kind:'stun', amount:0`），reason 分别为 `death-cleanup`、`combat-end` | 显示“状态清理（阵亡清除）”“状态清理（战斗结束）”；不猜种类，不出现“眩晕” |
| R2b 正式 group 清理 | 输入固定为**带正式 group** 的清理事件（group.kind 为 burn、wound），reason 为 `death-cleanup`、`combat-end` | 显示“灼烧 … 阵亡清除”“重伤 … 战斗结束”等真实种类加结束原因；后端再次丢失 group 时本场景应失败 |
| R3 来源 | 临时子件护盾（`m8State.source.parentItemInstanceId` 非空、`layer.source` 无该字段）；临时子件状态与治疗 | 事件日志、策略面板盾行、统计面板来源均含“临时子件”，两面板格式一致 |
| R4 治疗分项 | A10 两套：无重伤 / 33% 重伤（`resolveHeal`） | 事件含两来源各自“请求/有效/过量/重伤减少”，数值同 UR-U4-02 |
| 三类伤害 | 物理 10、魔法 20、真实 30 各一包 | 日志“物理/魔法/真实实际生命伤害”；飘字“−10”“−20 魔”“−30 真”；选中单位详情三类分别 10/20/30 |
| 状态与法力筛选 | 统计面板筛选选“状态”“法力”“全部事件（法力单列）” | “状态”只有 statusChanged；“法力”只有 manaChanged；“全部”不含 manaChanged |
| 引导被控取消 | 范德尔例（UR-U4-04） | 日志“引导 被控制打断”；状态列表与棋子“引”小标在取消 tick 消失且不恢复 |
| 护盾 A：衰减后吸收 | 600 盾（线性衰减），自然衰减 100 后吸收 120 | 日志含“自然衰减”“吸收伤害”；剩余 380、已吸收 120、已衰减 100；**本子场景**统计吸收增加 120（衰减不计） |
| 护盾 B：耗尽 | 另一盾受伤害至 0 | 日志含“吸收伤害（耗尽）”；该盾吸收量单独核对，与 A 的 120 分开统计 |
| 护盾 C：清理 | 持盾单位阵亡 / 战斗结束 | 日志“到期（阵亡清除）/（战斗结束）”，统计吸收不增加 |
| 只读 | 以上每个场景渲染、切换筛选、选中单位前后 | `JSON.stringify` 事件、战斗状态与 `BattleStats` 完全相同 |

## UR-U3-B5-01 装备命令拒绝原因临时文案（U3 动态部分）

- 用户明确授权 Codex 仅在 `BoardScene.ts` 既有拒绝原因表补齐四条映射，解决 B5 新失败码导致的构建阻塞；未改其他界面代码、布局或样式。
- 四条均为临时文案，后续由 Claude 在 **U3 动态部分**统一打磨：

| 领域拒绝码 | 当前临时文案 |
| --- | --- |
| `same-item` | 请选择两件不同的组件实例合成 |
| `unique-conflict` | 该单位已装备同一件唯一装备 |
| `exclusive-slots` | 独占装备不能与其他装备同时穿戴 |
| `temporary-item` | 临时装备不能单独操作 |

- 验收：保留四种拒绝原因各自的准确语义，界面读取领域失败码；不自行重新校验装备规则、不改变命令失败原子性。B5 构建与桌面验收结果见 `docs/M8_B5_HANDOFF.md` 最新记录。
- **已由 U3 动态部分接手**：四条临时文案已移入共用映射 `EQUIPMENT_FAILURE_TEXT`（`src/presentation/equipment-feedback.ts`），`BoardScene` 的命令失败提示与预览提示读同一份，四条文案同时打磨。`wrong-phase`、`unknown-unit`、`invalid-slot` 与非装备命令共用，命令提示仍沿用 `BoardScene` 原有分阶段文案。

## U3 静态部分：装备图鉴、合成表、效果说明

基线：`feat/m8-b0-baseline` 的 `97f38a0`（含 B4、体积预算 ×1.15、U4）。数据来源：B4 `readItemCatalog()`（`src/simulation/item-catalog.ts`，直接返回数组），44 件（8 组件 / 36 成装），`contentVersion = s13-14.24b-m8-b4-v3`。界面原样展示 `effectDescriptions`，展示 `unique`、`slotCost`、`evidenceStatus`、`localizationStatus`、`conventionIds`；不判断当前实例能否合成或装备。

优先级：P1 = 玩家可见文本或身份有误；P2 = 等后续 B 任务；P3 = 体验改进。

### UR-U3-01 组件说明夹带内部来源串（P1，B4 数据）

- 现象：7 个组件的 `effectDescriptions` 除属性行外还有一条英文内部串，原样展示给玩家：暴风大剑 `AD: 1000 Bps`、锁子甲 `Armor: 20 resistance-points`、巨人腰带 `Health: 150 health-points`、无用大棒 `AP: 10 ability-power-points`、负极斗篷 `MagicResist: 20 magic-resist-points`、反曲之弓 `AS: 1000 Bps`、女神之泪 `Mana: 15 mana-points`（来源 `src/simulation/content/items-components.ts`）。拳套没有。
- 需要：`effectDescriptions` 只放玩家可读的中文效果；来源核对串如需保留，放到独立字段（不在冻结类型内的，按合同变更流程）。
- 当前替代：界面原样显示，不过滤、不改写。
- 验收：7 个组件浮窗只显示中文属性行；与成装说明格式一致。

### UR-U3-02 窃贼手套说明夹带实施状态备注（P1，B4/B5 数据）

- 现象：`thiefs-gloves.effectDescriptions` 含“TG-01临时装备生成、刷新、清理在B5接入；B4仅本体属性生效。”，属于开发状态说明，不是玩家效果文本。
- 需要：玩家说明写成冻结规则描述；实施进度另行记录（文档或独立字段）。B5 交付临时装备后，由 B5 提供临时件的来源/期限展示数据（`readUnitEquipment().temporaryItems`）。
- 当前替代：原样显示；同时显示目录声明“占用装备槽 3”。
- 验收：浮窗不出现 B4/B5、TG-01 等开发术语。

### UR-U3-03 新增 28 件装备图标（P2，资源管线）

- 现状：`S13_ASSETS` 只有 16 件装备图标。缺图的 28 件：adaptive-helm、bloodthirster、blue-buff、bramble-vest、crownguard、protectors-vow、edge-of-night、infinity-edge、ionic-spark、jeweled-gauntlet、last-whisper、nashors-tooth、giant-slayer、morellonomicon、steadfast-heart、guardbreaker、quicksilver、red-buff、sunfire-cape、redemption、runaans-hurricane、gloves、evenshroud、statikk-shiv、steraks-gage、thiefs-gloves、titans-resolve、hand-of-justice（apiName 见目录）。
- 需要：按 `apiName` 对照官方 14.24 资源，经 `scripts/fetch-s13-assets.cjs` 生成清单项（含 source、bytes、sha256），提交到 `public/assets/` 与 `s13-asset-manifest.ts`。界面不手绘、不生成近似图标。
- 当前替代：统一占位标识——类型色块（组件蓝灰 / 成装棕金）+ 名称前两字；有图时图片覆盖在占位上，加载失败自动露出占位。
- 验收：清单补齐后无需改界面代码；图鉴 44 件都显示图片；在 `/cat/` 子路径下可读；受控 404 时回退为占位。

### UR-U3-04 中文译名核实（P2，内容）

- 现状：44 件 `localizationStatus` 全部为 `temporary-unverified`。
- 当前替代：每个名称旁显示“暂译”标记，浮窗写“临时译名（待核实）”；值变为 `verified` 后标记自动消失，无需改界面。
- 验收：核实后图鉴、库存、合成表、浮窗的名称一致，且不再显示暂译标记。

### UR-U3-05 动态合法性与临时装备（P2，B5 已交付；界面接线见下，送审中）

- 需要：`previewCombine`、`previewEquip`、`readUnitEquipment` 运行实现（冻结类型见 `ui-contracts.ts`），与公开命令同一校验器。
- 当前状态：U3 静态图鉴与合成表只展示配方，文案注明“不代表当前可合成 / 可装备”。**既有 U1 行为**：策略面板“合成”按钮仍按静态配方匹配决定是否可点，最终以 `session.combine` 结果为准；本次未扩大该逻辑，也未使用 `planCombine/planEquip`。B5 交付后改为读 `previewCombine(...).allowed/reason`，装备槽改读 `previewEquip`。
- 验收：B5 交付后，拒绝组合（含 `same-item`、`unique-conflict`、`exclusive-slots`、`temporary-item`）在点击前显示后端原因，与命令拒绝一致。

- **U3 动态部分接线（`feat/m8-u3-dynamic`；B5 已经 PR #16 合入基线 `5bd7968`，本分支已合并该基线后送审）**：合成按钮改读 `previewCombine`（移除静态配方匹配）；选中物品后各槽读 `previewEquip` 标出可装备/拒绝原因/冲突装备，三槽装备显示“将占用槽 1、2、3”；槽位与单位详情读 `readUnitEquipment`，独占预留槽与临时子件只读显示（来源父装备、有效轮次、不可操作）；拖到棋盘单位时取第一个预览允许的槽。拒绝文案集中在 `src/presentation/equipment-feedback.ts`，预览提示与 `BoardScene` 命令失败提示共用。（B5 合入后以 merge 方式同步基线，未 rebase。）

### UR-U3-06 约定编号的可读说明（P3，文档/内容）

- 现状：浮窗原样显示 `conventionIds`（如 `A-01`、`GLOBAL-STAT-01`），玩家看不懂。
- 可选需要：提供编号 → 简短中文说明或文档锚点的只读映射；不提供时界面保持原样显示。

### UR-U3-07 U3 静态部分桌面 Chromium 验证（P1，Codex 编写；Claude 不改 tests/、CI）

视口 1440×1000，生产 preview；数据全部来自 `readItemCatalog()`。

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| 图鉴数量 | 展开“装备图鉴与合成表” | 44 个图鉴项；筛选按钮计数：全部 44、组件 8、成装 36、唯一 6、占多槽 1、暂定 2 |
| 筛选 | 依次点各筛选 | 组件 8 件；成装 36 件；唯一为 blue-buff、edge-of-night、last-whisper、morellonomicon、quicksilver、sunfire-cape；占多槽仅 thiefs-gloves；暂定为 red-buff、runaans-hurricane |
| 合成表 | 8×8 表 | 64 个非空交点、36 个不同结果；每个交点结果与目录 `recipe` 一致（无序、允许同种）；暂定结果交点带标记 |
| 说明浮窗 | 悬停与键盘聚焦任一图鉴项、合成表交点、库存物品、已装备槽 | 浮窗效果条目与 `effectDescriptions` 逐条完全相同，顺序不变；显示唯一/占槽声明、规则依据、暂译状态；Escape、移出、失焦后隐藏 |
| 暂定与占槽 | 红霸符、卢安娜的飓风、窃贼手套 | 前两者显示“暂定”及“批准暂行，待历史核验”；窃贼手套显示“占3槽”“占用装备槽 3” |
| 缺图占位 | 28 件无清单图标；另对已有图标做受控 404 | 显示类型色块 + 名称前两字，无破图；404 后回退为同一占位 |
| 快捷键隔离 | 在图鉴搜索框输入 d、f、e | 金币、商店代次、单位不变 |
| 只读 | 展开、筛选、搜索、悬停前后 | `MatchState` 序列化完全相同，无新事件 |

### UR-U3-08 U3 动态部分桌面 Chromium 验证（P1，Codex 编写；Claude 不改 tests/、CI）

视口 1440×1000。状态由公开 `createMatch` + 选择命令得到；与 `tests/m8-b5-*.test.ts` 相同，可把永久装备实例放入库存作为夹具，此后只走 `equipItem`/`combineItems` 公开命令。说明：`same-item` 与 `temporary-item` 无法通过正常点击产生（再次点击同一物品会取消选中；临时件不在库存、槽位不可操作），这两项按领域码 + 面板文案核对。

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| unique-conflict | 蓝霸符装到 u1；再选第二件蓝霸符 | u1 各槽 `data-preview=unique-conflict`，已装蓝霸符的槽标冲突；行提示含唯一冲突文案与“冲突：蓝霸符”；其他单位为 allowed；点击 u1 槽命令同样拒绝 `unique-conflict`，状态与提示文案一致 |
| exclusive-slots（TG 加入） | u1 有蓝霸符；选窃贼手套 | u1 三槽均 `exclusive-slots`，蓝霸符标冲突；空单位提示“可装备 · 将占用槽 1、2、3” |
| TG 穿戴与临时件 | 窃贼手套点 u2 的槽 3 | 命令成功，本体规范到槽 1；槽 2/3 显示“临时 · 名称”、虚线、禁用；行内与单位详情各 2 行“来自 窃贼手套 · 槽 N · 仅 2-1 本轮有效 · 不可操作” |
| exclusive-slots（已有 TG） | u2 持窃贼手套；选普通装备 | u2 槽 1 为 `exclusive-slots`，窃贼手套标冲突，提示含“冲突：窃贼手套” |
| temporary-item | 领域：`previewEquip/previewCombine/equipItem` 传临时 ID | 三者均 `temporary-item`；状态序列化不变；文案取共用表 |
| same-item | 领域：`previewCombine/combineItems(a,a)`；面板选中 `[a,a]` | 领域均 `same-item`；面板 `combine-preview` 显示共用文案，合成按钮禁用 |
| invalid-recipe / 允许合成 | 选大剑+成装；再选两把大剑 | 前者 `invalid-recipe` 提示；后者按钮“合成 死亡之刃”可点，命令成功 |
| 拖放到棋盘单位 | 把物品拖到持 TG 的单位 / 普通单位 | 前者显示 `exclusive-slots` 文案、不发命令；后者装到第一个预览允许的槽 |
| 只读 | 每次选中、预览、渲染前后 | `MatchState` 序列化完全相同，RNG 与 `equipmentState` 不变 |

**待 Codex 补测（拖放到棋盘单位）**：U3 动态部分的拖放路径（`strategy-panel.ts` 释放物品时未命中装备槽、落在棋盘单位上）只在代码中改为读 `previewEquip`，Claude 本地未做真实指针拖放验证。请在桌面 Chromium（1440×1000）用原生指针拖放补测：
- 拖到持窃贼手套的我方单位：不发出装备命令，状态行显示共用表的 `exclusive-slots` 文案，`MatchState` 不变。
- 拖到槽 1 已有装备的普通我方单位：命令装到第一个预览允许的槽（槽 2），成功事件 `itemEquipped.slot=1`。
- 拖到三槽已满的单位：状态行“该单位的 3 个装备槽已满”，不发命令。
- 拖到敌方单位：显示 `unknown-unit` 共用文案，不发命令。（Codex 审计 `51704a0` P2：原棋盘命中只返回我方单位，敌方拖放显示的是“物品未装备”通用提示；已改为命中任意可见单位、由 `previewEquip` 判定 `unknown-unit`。）
- 把窃贼手套拖到空单位：装备成功且本体规范到槽 1，生成两件临时装备。

## B10 补充验证状态（2026-10-11，Codex 接替收尾）

用户已授权 Codex 接替 Claude 完成收尾与必要显示修复；本段更新历史请求的实际交付状态，不改变冻结领域合同。

- **UR-U3-07**：补交 `scripts/verify-m8-u3-static.cjs`，生产 preview 的真实应用、1440×1000，读取权威目录，并通过原生导入加载经生产校验器验证的公开操作存档。最终结果见 `M8_VALIDATION.md`，尚未独立签收。
- **UR-U4-07**：`8d87e74` 已交付 `scripts/verify-m8-u4-status.cjs`，`9fa8a63` 修正一次施加多项状态的日志遗漏。本轮复核得到 15 场景、181 检查通过；这是实际组件验证，不冒称整局浏览器路线。最终候选绑定见 `M8_VALIDATION.md`。
- U4 的旧 R2a 无 group 清理输入已被 B9 正式账本排除，改验真实清理事件都有 group；R3 父实例也已进入旧 shield 投影；状态筛选按 UR-U4-04 包含 activityChanged；盾的 absorbed/depleted 与 death-cleanup/combat-end 按各自正式原因显示。脚本 manifest 保留五项差异及依据，不通过手写非法事件恢复过时形状。


**B10 固定候选补充（2026-10-11）**：`d901b3f` 的 U3静态8组、U4 15场景/181检查、桌面27项通过。`b4ca11c` 新增 `verify-m8-br4-public.cjs` 并在干净工作区通过 dev/preview 10组公开存档验证，补足总计划BR4；原 `verify-m8-u3-dynamic` 的显式装备夹具仍按原范围保留。数据/显示技术检查通过不等于节点三签收：9v9压力超预算、硬件帧率、独立审查及用户试玩仍待完成。证据见 `M8_VALIDATION.md`。

## 八人联机界面数据需求（2026-10-12，流水线 C → 流水线 A/B）

界面已按 `src/rendering/online/protocol.ts` 的形状先行实现（开发期的 `fake-server.ts` 已在 C4 删除，现由浏览器内真房间 `server=local` 或 WebSocket `server=ws` 驱动）。T4/T5 的真实服务器与网络层需按同样形状下发；字段如有调整，请改 `protocol.ts` 并同步此表。

| 对象 | 字段 | 含义 | 用途 | 验收 |
| --- | --- | --- | --- | --- |
| `LobbyView` | `queue[{name,kind,me}]`、`capacity=8`、`joined`、`canStart`、`error` | 匹配队列 | 匹配页列表、开始按钮、第 9 人报错 | 第 9 人加入时 `error` 非空且队列不变 |
| `PlayerView.seats[]` | `seatId,name,kind(human/bot),hp,level,alive,rank,connected` | 八席公开信息 | 右侧血条栏、淘汰置灰、断线标记 | 每次 HP、等级、淘汰变化都推送一次 |
| `PlayerView.seats[].publicBoard` | `units[{definitionId,starLevel,cell,items[]}]`（C5） | 该席场上单位与所持装备定义（公开信息） | 右栏头像、点击席位弹出的只读"对方阵容"面板、羁绊由界面用 `deriveTraits` 读 | 只含上场的本席单位；不含备战席、商店、金币、经验、实例 id、随机流（`tests/server/projection.test.ts`、`net/server.test.ts`） |
| `PlayerView.phase` | `kind(preparation/choice/combat/settlement/ended)`、`round`、`roundName`、`endsAt`、`serverNow` | 房间阶段与截止 | 顶部阶段徽章与倒计时 | 倒计时以服务器时钟为准，客户端只做显示 |
| `PlayerView.opponentSeatId` | 本轮对手席位 | PvP 对手 | 血条栏高亮对手、准备阶段状态栏提示 | PvE/补给回合为 null |
| `PlayerView.ranking` | 终局后的完整名次 | 排名页 | 终局覆盖层 | 八席名次唯一完整 |
| 私有状态 | 本席字段白名单（见 `MULTIPLAYER_CONTRACT.md` §10.9） | 商店、棋盘、装备、选择 | 复用现有策略面板与棋盘渲染 | 不含他人商店与内部随机流 |
| 战斗帧 | `CombatFrame[{state,events}]` | 服务器算完的一场战斗 | 客户端按 50 ms/tick 播放 | 完整事件账本，不因播放截断 |
| 命令 | `ClientCommand`（买卖、刷新、经验、站位、装备、选择） | 意图 | 现有按钮直接发送 | 失败返回原因，不改本地状态 |

界面侧明确不做的事：不调用 `startMatchCombat`/`nextRound`/`stepMatch`（联机模式下 `RemoteSession.start/continue` 直接拒绝），不本地算金币和胜负。

需要服务器定稿、界面只显示结果的规则：选择节点超时的代选规则；准备截止时阵容非法的处理；断线接管的提示文案来源（`connected=false` 即显示"断线"）。假服务器对这些只做了标注的临时兜底。

真网络接入（T8）时的已知改动点：`GameClient.send` 已在 C4 改为"待确认"回执再确认（WebSocket），本地房间仍同步返回。

## src/server 需要规则侧提供的接口（B1，2026-10-12，Claude 流水线 B）

`src/server/room/` 已交付房间状态机骨架（八席、阶段与截止、配对、一次性结算、排名、白名单投影；见 `docs/CLAUDE_WORK_ORDERS.md` 派工单 B1）。房间只编排、不算规则：每席各持一份 `MatchState`，只经 `src/simulation/match.ts` 公开命令变化；战斗经 `BattleResolver` 接口注入，当前为占位实现（每席跑自己的单人 `startMatchCombat` + `stepMatch`）。接真实双方战斗与共享卡池前，需要规则侧提供下列接口。编号 SR-B1-xx。

### SR-B1-01 双方战斗输入与结果类型（P0，T2/T3）

- 需要：`resolvePvpBattle(input): BattleResult` 或同等公开函数。输入为两席冻结快照（合法上场单位、装备、强化、异常、持久成长）、规则版本、独立战斗随机输入；输出含 `battleId`、胜负/平局、双方存活者、双方成长增量、完整事件账本、以及**双方各自的未截断伤害整数**。
- 用途：替换 `src/server/room/battle-resolver.ts` 的占位实现。房间侧已冻结的字段见 `src/server/room/types.ts` 的 `BattleInput`/`BattleResult`/`BattleSeatOutcome`：房间只消费 `damage`（未截断、≥0 整数）和 `state`，自己不算伤害。
- 镜像：奇数存活者时 `BattleInput.mirrorOf` 携带来源席位快照（来源不是参战方）；规则侧需保证镜像一方不被扣血、不发收入、不成长。
- 验收：相同冻结输入重跑得到完全相同的结果；输入中席位/单位身份不碰撞。

**T2 回应（Codex）**：已交付真实双方战斗与双方非负、未截断伤害提案；新增冻结 `mirrorOfSeatId` 和 `settlementEligible`，镜像方 damage=0、growth=[] 且不可提交收入/经验/奖励。接口映射、失败与测试见 [合同 §10.8](MULTIPLAYER_CONTRACT.md#108-sr-b1-01双方伤害整数与镜像结算资格t2-已实现)。B1 由 Claude 按 §10.6 适配，实际写回由 T3 实现。

### SR-B1-02 房间结算收据：把外部 HP、收入、成长写回席位状态（P0，T3）

- 现状：单人 `settleRound` 在 `withCombat` 内部自动扣血、发收入并在 HP 归零或 6-7 时置 `gameOver`。房间的权威 HP 是 `SeatState.hp`，`MatchState.playerHp` 只能是派生镜像；占位实现靠"规则自己算的 `RoundResult.playerDamage`"保持两者相等，真实 PvP 后会分叉。
- 需要：一个公开命令（例如 `applyRoundSettlement(state, receipt)`），由房间在收齐全轮结果后调用，一次性提交该席的收入、经验、持久成长和由房间给定的 HP；带唯一 `settlementId`，重复提交返回原 state 与 `duplicate-settlement`，不重发任何奖励。要求 `startMatchCombat`/`stepMatch` 的 PvP 路径不再内部扣血、不再自行进入 `gameOver`。
- 验收：同一收据提交两次，第二次无事件、无资源变化；`roundResults` 恰好一条。

**T3 回应（Codex）**：已导出 enableMultiplayerSettlement/applyRoundSettlement，单席原子提交未截断伤害、收入、经验、成长和唯一收据，镜像拒绝、重复原样返回、HP0 为 eliminated；B4 全轮暂存/执行代次/统一发布按 [合同 §11](MULTIPLAYER_CONTRACT.md#11-t3单席原子结算整轮发布与超时规则) 接入。房间 HP 必须取规则返回值，不自行计算。

### SR-B1-03 加时与目录末轮（P1，T3/T4 合同）

- 现状：目录 6-7 为 `isFinal`，引擎在该轮结算时对所有席位置 `gameOver`（`outcome` 为 victory/defeat）。房间在 `planSettlement` 中以 `isFinal` 结束对局，按存活者 HP 定名次，代码注释标明"建议规则，待 T3/T4 合同定稿"。
- 需要：PvP 加时轮的公开入口（继续经济与商店、沿用末阶段基础伤害、不新增野怪/强化/奖励），以及 `nextRound` 在目录末尾之后的合法推进方式；平局扣血、同轮归零破同分规则定稿（房间当前实现：扣血后未截断 HP → 轮前 HP → 席位序号小者优先）。
- 验收：连续平局、双方空阵容、多席同轮归零都能在有限轮内产生唯一名次。

**T3 回应（Codex）**：合同 §11.5 已定稿加时 ID/ordinal、基础伤害12、经济/商店推进、双方平局扣血和未截断HP→轮前HP→固定座位序的唯一排名。目录外规则入口留 T4 接入前由规则线补齐，当前不冒称加时已可运行；在线目录末轮不再触发单人 gameOver。

### SR-B1-04 超时兜底的权威定义（P1）

- 现状：准备/选择截止时仍停在 `choice` 的席位，房间用 `src/server/room/choice-fallback.ts` 的占位策略（第一个选项 / 第一个己方单位）经公开命令兜底。
- 缺口：
  1. 异常节点且阵容为空时 `needsAnomalyRecruitment` 阻止开战（`missing-player`），兜底不能花钱买单位；当前占位 resolver 抛错导致整房 `fault` 结束。需要规则侧提供"超时放弃本轮/视为空阵容应战"的公开命令或等价规则。
  2. `nextRound` 因 `unsettled-round`（待领奖励、待选项或奖励容量不足）拒绝时，房间只能有限次延长结算截止，然后 `seat-stuck` 中断。需要超时自动领取/放弃奖励的公开命令，且不得重复发奖。
- 验收：任一席位在任何节点超时都能在不花费资源的前提下推进到下一轮。

**T3 回应（Codex，按用户确认）**：forfeitPendingChoice 默认选第一项（项目规则），只有无合法目标的空异常跳过；claimOrDiscardLoot 领取已赚且可容纳奖励，容量不足部分放弃。两者不付费、不重复发奖；签名、代次、失败和推进顺序见合同 §11.4。覆盖首项金币/组件、空异常、满备战区及领取事务回滚。

### SR-B1-05 淘汰归还卡池与共享卡池版本（P1，TP）

- 现状：`RoomState.poolRevision` 预留、恒为 0；商店各自独立。
- 需要：淘汰席位归还卡池的事务钩子（在本轮排名计算后、下一轮商店生成前调用），以及买/刷/卖/升星/奖励与席位资产同一事务提交的公开入口；失败时库存、占用、金币、商店、随机流均不变。
- 验收：八席全程卡池守恒；淘汰后该席占用全部归还。

**TP 回应（Codex）**：已交付池与席位同事务入口、淘汰唯一归还钩子和池 revision，详见合同 §12.1–12.5；开场与奖励统一占池，缺货按用户决定补英雄一星价格金币，八席跨轮守恒覆盖。B5 需将买/刷/锁/卖、发奖与跨轮切到 TP 包装，排名后、自然刷新前调用 releaseSeatOnElimination；src/server 接入由 Claude 完成。

### SR-B1-06 本席私有投影不含随机流（P2）

- 现状：`toPlayerView` 只输出白名单公开数据；本席私有状态（商店、待选项、棋盘）目前只能由适配器直接读 `SeatState.match`，而 `MatchState` 含 `rngState`、`battleSeedRngState`、`choiceRngState`、`rewardRngState`、未来掉落计划。
- 需要：规则侧提供"去随机流与未来计划"的本席私有视图构造函数（或列出可安全下发的字段清单），供 T5 网络层发送。

**T2 回应（Codex）**：已在 [合同 §10.9](MULTIPLAYER_CONTRACT.md#109-sr-b1-06本席私有视图下发白名单t2-清单t5-实现) 列出逐层字段白名单、当前已揭示奖励条件、随机流/未来计划禁发项及 T5 验收要求；覆盖初始、增量、重连与命令错误回执，不可透传完整 MatchState/CombatState。T2 只交清单，T5 由 Claude 实现投影；其余 SR-B1-02~05 归属与最小范围见合同 §10.10。

## 联机客户端消息说明（B2，2026-10-12，Claude 流水线 B → 流水线 C / C4）

`src/server/net/` 已交付单房间 WebSocket 服务器（`createGameServer`）、座位凭证、commandId 去重、单写队列与 Node 测试客户端（`src/server/net/test-client.ts`）。C4 的浏览器客户端只需实现下面的消息流；类型与校验函数在 `src/server/net/messages.ts`（无 ws / node 依赖，可直接在浏览器 import），共享视图类型在 `src/server/protocol.ts`。协议版本 `NET_PROTOCOL_VERSION = 1`。

### 消息一览

| 方向 | 消息 | 关键字段 | 说明 |
| --- | --- | --- | --- |
| C→S | `join` | `name` | 进队列。回执 `joined{seatId, token, connectionEpoch}`；`token` 只保存在本地（例如 `sessionStorage`），不显示、不上传到别处 |
| C→S | `leaveQueue` / `start` | — | 需已入队。`start` 由任一入队玩家发，机器人补满 8 席 |
| C→S | `resume` | `token` | 新连接凭 token 回到原席；回执 `resumed{seatId, roomId, connectionEpoch, lastCommandId}` |
| C→S | `command` | `roomId`、`round`、`seatRevision`、`command: ClientCommand` | `command` 内 buy/shopLock 带 `generation`，choose/anomaly 带 `choiceId+generation`，与规则一致 |
| S→C | `lobby` | `view: LobbyView` | 连接建立即发一次，队列变化再发 |
| S→C | `view` | `roomId`、`roomRevision`、`view: PlayerView` | 房间任何变化都发（白名单公开数据） |
| S→C | `state` | `roomId`、`round`、`seatRevision`、`state: MatchState` | 只发本席私有状态；`seatRevision` 是下一条 `command` 必须带的值 |
| S→C | `combat` | `roomId`、`round`、`battleId`、`frames: CombatFrame[]`，可选 `part`、`total` | 本席本轮战斗帧，每轮一场。整条超过 1 MiB 时按 200 帧一包连续发送，`part` 为 1..`total`，客户端按序拼回（C4） |
| S→C | `receipt` | `commandId`、`ok`、`result` 或 `reason`+`detail` | 每条客户端消息恰好一条回执 |
| S→C | `error` | `code`、`message`、`commandId\|null` | 无法对应到回执的连接级错误 |

每条客户端消息带 `protocolVersion` 与 `commandId`（正整数，本席本局内唯一，建议递增计数器）。服务器严格拒绝未知字段（`seatId`、`gold`、`hp` 之类一律 `invalid-message`），操作者只取自连接绑定的席位。

### 待确认回执（界面要显示"待确认"）

1. 发出 `command` 后该操作处于"待确认"，界面不得先改本地金币或商店；收到同 `commandId` 的 `receipt` 才结束。
2. `ok:true` 的 `applied` 回执带 `seatRevision`、`roomRevision`、`events`；紧接着服务器推送新的 `state`（同 `seatRevision`）和 `view`。
3. `ok:false` 时本地状态不变，`reason` 为下表错误码或规则失败原因（`insufficient-gold`、`stale-shop`、`wrong-phase` 等，见 `MatchFailure`）。
4. 丢回执重试：用**相同 `commandId` 和完全相同内容**（含同一个 `seatRevision`）重发，得到原回执；内容不同会被 `commandId-conflict` 拒绝。
5. 顺序发送可以流水线化：第 n 条命令带 `seatRevision = 基准 + n - 1`（假设前面全部成功）；任何一条失败后，后续会收到 `seat-revision-mismatch`，客户端等最新 `state` 后重发。

### 重连流程

1. 连接断开时界面显示"连接中断"，保留最后一份 `view`/`state`；房间侧只把该席 `connected=false`，资产、配对、名次不动。
2. 新建 WebSocket，发 `resume{token}`。成功后依次收到：`receipt(resumed)` → `view` → `state` →（若本轮已有战斗）`combat`，这是快照；之后才是增量推送。客户端把本地 `commandId` 计数器调到 `lastCommandId + 1` 以上。
3. 旧连接若还活着会收到 `error{code:'session-superseded'}`，随后被服务器关闭（关闭码 4001）；旧连接再发命令只会得到 `not-authenticated`。
4. 排队阶段断线视为离队（token 失效，需重新 `join`）；开局后断线可随时重连直到对局结束。服务器进程重启后旧 token 一律 `invalid-token`（首版不做跨进程恢复）。

### 错误码表

| 码 | 出现于 | 含义 / 界面处理 |
| --- | --- | --- |
| `invalid-json`、`invalid-message` | error / receipt | 消息格式或字段非法（含多余字段）；属客户端 bug，记日志 |
| `unsupported-protocol` | receipt | `protocolVersion` 不是 1；提示刷新页面 |
| `message-too-large`（关闭码 1009） | 连接关闭 | 单条消息超 16 KiB |
| `rate-limited` | error | 每连接每秒超过 60 条；丢弃本条，稍后重试 |
| `not-authenticated` | receipt | 连接未绑定席位（未 join / 已被取代）；回到匹配页或重连 |
| `already-joined`、`not-queued` | receipt | 重复入队 / 未入队就 leave、start |
| `full`、`in-progress`、`empty` | receipt | 队列满 8 人 / 对局进行中 / 空队列开始 |
| `invalid-token` | receipt | 凭证无效或已失效；回到匹配页 |
| `session-superseded` | error | 本连接被新连接取代；停止发送 |
| `commandId-conflict` | receipt | 同 id 不同内容；客户端 bug |
| `resync-required` | receipt | id 早于最近 256 条保留窗口；等最新 `state` 后用新 id 重发 |
| `no-room`、`wrong-room` | receipt | 本席不在进行中的房间 / `roomId` 不符 |
| `stale-round`、`seat-revision-mismatch` | receipt | 命令针对旧轮次 / 旧席位版本；等最新 `view`/`state` 后重发 |
| `unknown-seat`、`seat-eliminated`、`wrong-phase` 及其余 `MatchFailure` | receipt | 房间或规则拒绝，文案沿用现有离线映射 |

### 需要用户决定 / Codex 配合的事项

- **战斗帧体积（P0，影响 C4 是否可用）**：`CombatFrame.state` 是每 tick 一份完整 `MatchState`。真实测量（`tests/server/net/server.test.ts` 整局用例）：一局空闲对局下发给单席约 105 MB，单条 `combat` 最大 13.5 MB，17 场战斗共 2873 帧。局域网可跑通，公网不可接受。建议：由规则侧（SR-B1-07）提供"战斗回放投影"——首帧完整状态 + 每 tick 只含 `combat` 子状态或事件账本，客户端按 `LedgerCombatEvent` 播放；或至少去掉帧内与战斗无关的字段。决定前 C4 不要按当前帧格式上线。
- **C4 实测（压缩已开启）**：服务器开启 `permessage-deflate`（阈值 1 KiB，保留上下文）。整局空闲对局下发给单席：未压缩 103.9 MB → 线路上 7.3 MB；最大一场战斗 12.5 MB（拆成 3 包，最大单包 8.8 MB）。压缩后局域网与普通宽带可用，但浏览器仍要解析完整 JSON，SR-B1-07 的回放投影仍有必要。
- **SR-B1-06 仍未实现**：`state` 消息目前是完整 `MatchState`（含本席随机流）。B2 按工单只发本席自己的状态；去随机流的私有投影仍需规则侧提供。
- 启动方式：`npm run serve:game`（esbuild 打包到 `dist-server/game/main.mjs`，环境变量 `PORT`、`CAT_HOST`、`CAT_SEED`、`CAT_PREP_SEC`、`CAT_CHOICE_SEC`、`CAT_SETTLE_SEC`、`CAT_QUEUE_TIMEOUT_SEC`）；`npm run client:game -- ws://127.0.0.1:8787 名字` 跑一局空闲对局。TLS 由反向代理终止（T9）。

## src/server 接入 T2 后的规则侧缺口（B3，2026-10-12，Claude 流水线 B）

B3 已按合同 §10.6 让房间的 PvP 走 `snapshotForBattle → compileBattle → resolveTwoSidedBattle → proposeSettlement`（`src/server/room/two-sided-resolver.ts`），提案暂存在 `RoomState.pendingProposals`，房间进入 `awaiting-settlement` 后以 `settlement-unavailable` 中断；默认 `pvpMode` 仍为 `placeholder`。以下是接入时发现的缺口，编号续 SR-B3-xx。

### SR-B3-01 结算提交入口与房间阶段推进（P0，T3）

- 现状：`Room.parkProposals` 已把每场的 `settlementEligible=true` 且属于真实参战席位的 `SideProposal` 按 battleId 暂存（含 `round/roundId/roomRevision/participants`）；镜像提案不进入队列。房间不扣血、不发收入、不进入下一轮。
- 需要：合同 §10.10 的 `applyRoundSettlement(state, receipt)` 或等价事务命令。房间侧期望的调用方式：收齐全轮 `pendingProposals` 后，对每个真实席位用其提案构造唯一收据提交一次，由同一提交结果产出 HP/淘汰/`roundResults` 一条，再回到现有 `settlement → nextRound` 流程。请在合同里写明：收据字段、`settlementId` 的构成（房间建议 `${roomId}:round-${round}:${seatId}`）、拒绝枚举（重复、过期代次、镜像、不完整整轮）。
- 验收：同一收据提交两次第二次无事件、无资源变化；提交后 `MatchState.playerHp` 与 `SeatState.hp` 一致。

### SR-B3-02 战斗帧的逐 tick 账本入口（P2，T2 补充）

- 现状：`resolveTwoSidedBattle` 只返回 `initial/terminal/events`；逐 tick 播放帧由房间用 `startTwoSidedCombatWithEvents + stepCombat` 重放同一冻结输入生成，再把 `battle.events` 按 `tick` 分配到各帧，并校验终态与事件总数一致（不一致即 `frame-divergence` 中断）。这意味着每场战斗实际执行两次（一次结算、一次取帧）。
- 需要（可选）：一个同时返回逐 tick 状态序列与结果的入口，或说明 `stepCombat` 的事件与 `toLedgerEvents` 的对应关系可被服务器直接使用，以避免二次执行。若规则侧认为二次执行可接受，请在合同注明，房间保持现状。

### SR-B3-03 第二视角的战斗投影（P2，T5 前确认）

- 现状：双方战斗只运行一次，A 视角为 `player`；B 席位的帧由 `src/server/room/projection.ts` 的 `mirrorCombatFrame` 做纯显示镜像（队伍互换、`row = rows - 1 - row`、结果互换、`movement`/`cast.completionCell` 坐标翻转）。它不重算任何数值。
- 需要：T5 做帧 DTO（合同 §10.9）时确认这一镜像规则就是客户端应看到的视角，或由规则侧给出带坐标字段的事件完整清单，避免遗漏其他含 `HexCell` 的事件字段。


**TP 对 SR-B3-02 的回应（Codex）**：选择保留二次纯执行取帧；同一冻结输入、规则/内容版本和足够预算保证相同终态及完整有序事件，不能重复提交结算。toLedgerEvents 不转换字段，保留 tick0 和 eventSeq 次序；详见合同 §12.6。

**TP 对 SR-B3-03 的回应（Codex）**：LedgerCombatEvent 坐标清单为 movement.from、movement.to、cast.receipt.completionCell；单位快照另有 cell/startingCell。B 视角只镜像 DTO，行翻转、列不变，互换队伍/胜负，保持标识与事件顺序；详见合同 §12.6。未修改 src/server 的投影实现。

## src/server 接入 T3 后的规则侧缺口（B4，2026-10-12，Claude 流水线 B）

B4 已按合同 §11.3 让房间收齐全轮后在临时 map 上逐席 `applyRoundSettlement`，全部成功才一次发布（`Room.planSettlement` / `commitSettlement`），`SeatState.hp` 取返回 `state.playerHp`；超时按 §11.4 用 `forfeitPendingChoice` / `claimOrDiscardLoot`（`choice-fallback.ts` 已删除）；同轮归零按 §11.5 键排名；`pvpMode` 默认 `two-sided`。编号续 SR-B4-xx。

### SR-B4-01 目录末轮后的加时推进入口（P0，T4 依赖）

- 现状：合同 §11.5 约定由规则线补 `advanceMultiplayerRound(state, expectedRound): MultiplayerCommandResult`（目录内委托 `nextRound`，6-7 后生成 `overtime-N` 准备态，沿用第 6 阶段基础伤害 12），`src/server-entry` 尚未导出；当前 `nextRound` 在目录末尾返回 `wrong-phase`。房间在 6-7 结算发布后若仍有 ≥2 席存活，以 `fault: { kind: 'overtime-unavailable', round, survivors }` 明确中断，不自造名次（`Room.commitPending`）。空闲八席对局在 seed 42 下于 6-5 决出唯一名次，不触发此中断。
- 需要：导出该入口，并保证 T2 `snapshotForBattle`/`compileBattle` 与 T3 `applyRoundSettlement` 接受 `overtime-N` 轮次标识（`roundId` 不在目录内时 `getCatalogRoundById` 的行为、基础伤害 12、经济与经验照常）。房间侧接入点只有一处：`Room.advanceRound` 把 `nextRound` 换成该入口，`Room.enterRound` 用返回状态的 `m8.round` 读取 `ordinal/roundId/kind`。
- 验收：连续平局、双方空阵容、镜像与同轮多人归零在有限加时内产生唯一名次（§11.5 "有限终局"）。

### SR-B4-02 PvE 结果的房间侧一致性校验（P2，说明）

- 现状：PvE/补给回合仍由各席单人公共命令结算（`startMatchCombat`/`stepMatch`），房间只做 §11.3 第 4 条的原子发布，并校验规则返回的 `playerHp === max(0, hpBefore - roundResults.playerDamage)`，不一致即 `invalid-results` 整轮丢弃。测试用的占位结果（`state` 未结算）才由房间自行扣血（`pvpMode: 'placeholder'`）。
- 需要（可选）：若规则侧希望 PvE 也走收据提交（统一入口），请在合同注明；否则维持现状。

## T5R 规则侧交付（Codex，2026-10-12）

- **SR-B4-01（P0）**：已导出 `advanceMultiplayerRound`，贯通 T2/T3 加时 ID、伤害12和既有经济，`nextSharedRound` 支持全席加时释放/轮换刷新；合同 §11.5 给出签名、失败枚举及 B4/B5 接入。B4 除替换 Room.advanceRound 调用外，还须解除 Room.commitPending 的 overtime-unavailable 依赖中断（bc35bac 当前仍存在）。规则不替调度器判断剩余席位或排全局名次。
- **SR-B1-06（P0）**：已导出 `toPrivateSeatView`，逐层白名单，保持 MatchState 原字段名/嵌套，去全部随机流、未来计划、来源账本及战斗输入。合同 §14.1 列出安全复用的显示选择器和无法用占位保真的选择器。B7 尚须替换所有网络 state 发布路径。
- **SR-B1-07（P1）**：已导出 `toCombatReplay` / `toCombatViewState` / `applyCombatReplayTick`，每20 tick关键帧＋精简动画事件＋权威单位显示差分，逐 tick/终态均与权威视图相同；白名单、B视角坐标、失败与体积测量见 §14.2–14.3。仍保留完整服务器账本与一次纯重执行，不重复结算；B7 替换旧逐 tick 完整帧输出。

## src/server 接入共享卡池后的规则侧缺口（B5，2026-10-12，Claude 流水线 B）

B5 已按合同 §12 让房间开局建池（`createSharedPool` → 八席按 seatIndex `initializeSharedSeat` → `refreshSharedShops(…, 1)` → 一次发布），买/卖/刷/锁走池事务，选择、超时代选、领奖与 PvE 战斗（startCombat/step）走 `runSharedMatchCommand`，跨轮用 `nextSharedRound`，淘汰在排名后、下一轮自然刷新前调用 `releaseSeatOnElimination`。编号续 SR-B5-xx。

### SR-B5-01 加时推进的共享池批量入口（P1，与 SR-B4-01 同批）

- 现状：`nextSharedRound` 内部委托 `nextRound`，目录末轮后返回失败；房间在 6-7 后仍有 ≥2 席存活时照旧以 `overtime-unavailable` 明确中断（B4 行为不变）。
- 需要：交付 SR-B4-01 的 `advanceMultiplayerRound` 时，同时给接入共享池的席位一个批量入口（例如 `nextSharedRound` 接受加时，或新增 `advanceSharedMultiplayerRound(pool, states, expectedRound): SharedPoolBatchResult`），保证加时轮同样先归还未锁店、再按轮换顺序生成共享店（§11.5 第二条"TP 后仍受共享池约束"）。房间侧接入点仍只有 `Room.advanceRound` 一处。
- 验收：加时轮的商店来自共享池，`assertSharedPoolConservation` 在加时前后成立。

## src/server 接入 T5R 后的规则侧缺口（B7，2026-10-12，Claude 流水线 B）

B7 已把 `Room.advanceRound` 换成 `advanceMultiplayerRound` 并删除 `overtime-unavailable` 中断；网络与本地所有 `state` 改送 `toPrivateSeatView`（客户端经 `src/rendering/online/seat-view-adapter.ts` 填占位后显示）；每场战斗按结果对象缓存一份 `toCombatReplay`，B 视角镜像后以 `replay` 消息下发，旧 `combat` 帧默认保留（`combatTransport: 'both'`）。编号续 SR-B7-xx。

### SR-B7-01 PvE 回放输入：首步补发的 tick0 事件导致 `replay-divergence`（P0，C6 切换 `replay` 前必须修）

- 现状：按 §14.2 对 PvE 传 `startMatchCombat` 后的 CombatState、`stepMatch` 末帧和逐帧完整 Ledger 事件。seed 42 空闲八席整局中，除 **3-7（wolves-v1）** 外所有 PvE/PvP 回放都生成成功；3-7 八席全部抛 `RangeError('replay-divergence')`。原因：该遭遇的 5 条 tick0 事件（`movement`，eventSeq 0–4）不是 `startMatchCombat` 返回的，而是第一次 `stepMatch`/`stepCombat` 从 tick0 状态推进时才发出（tick 仍记为 0）。`toCombatReplay` 内部重执行的 `generated` 包含这 5 条，却与 `battle.events.filter(tick > 0)` 比较，必然不等。逐帧 `stepCombat` 与房间帧逐 tick 完全一致，终态视图也一致，只是这条比较的分界不对。
- 需要：规则侧修正 `toCombatReplay` 的 tick0 处理（例如重执行时把首步产生的 tick0 事件并入 `ticks[0]`，或比较时用全部事件），或在合同里给出 PvE 的正确输入构造方式。两边路径（`startTwoSidedCombatWithEvents` 是否也可能把 tick0 事件留到首步）请一并确认。
- 房间侧现状：生成失败只记日志（服务器故障，不伪造结果），该席仍收旧 `combat` 帧；若默认改为 `replay`，3-7 将没有战斗播放。
- 验收：seed 42 空闲整局所有回合 `toCombatReplay` 成功，且回放折叠结果等于 terminal。

### SR-B7-02 私有投影下的显示缺口（P2，界面体验）

- 现状：`toPrivateSeatView` 去掉了敌方单位与 `m8.encounterPlan`、`m8.loot`，`roundResults` 也去掉了 `interestBasis`、`xpRequested`、`streakBefore/After`、`roundKind`。联机界面因此：PvE 准备阶段看不到野怪站位与预览；掉落只能靠事件；收入明细省略"利息基数"和"经验请求"。
- 需要（可选）：按 §10.9/§14.1 另给已揭示的遭遇预览摘要（敌方定义、星级、站位）与已揭示掉落摘要的白名单字段；`roundResults` 是否可加回 `interestBasis`/`xpRequested`。界面只显示，不用于规则。

## B7 接入反馈：T5R 规则侧修正（Codex）

- **SR-B7-01（P0）**：`toCombatReplay` 以 `initial.nextEventSeq` 区分已经发出的开局事件与 step 事件，不再用 `tick > 0`。3-7 狼群第一次 step 发出的5条 tick0 跳跃放入 tick1 回放记录，保留原 tick/eventSeq，避免遗漏和重复；显示差分仍对应每步权威状态。严格比较后续动画序列，缺失/篡改/重复均继续报 `replay-divergence`。没有改战斗引擎或账本归属，详见合同 §14.2。
- **SR-B7-02（P2）**：白名单新增本轮公开 PvE 的 `m8.preparation.{roundId,encounterId,enemies}`，enemies 的 id/definitionId/team/starLevel/location 逐层复制，同一组野怪进入 `preparation.units` 供棋盘和 `readEncounterPreview` 显示。须当前 PvE 轮 ID/遭遇 ID 匹配；PvP、补给、过期预览均不下发此子树。新增 `roundResults[].interestBasis`，直接使用历史已提交计息金币基数。保持 MatchState 递归结构子集，不公开 RNG、未来遭遇/掉落、PvP 固定模板或结算收据；字段与适配说明见合同 §10.9、§14.1。
- **验证覆盖**：目录全部33个战斗回合（38轮减5个补给轮）的逐 tick/终态回放；狼群8个种子的事件恰好一次及缺失/篡改/重复拒绝；全部8种 PvE 预览的站位/属性保真、递归哨兵与无引用共享、旧/未来预览屏蔽、利息基数。仅修改规则投影、测试和合同文档，未修改 src/server、界面或 golden。

验证环境：Node v22.23.3 / npm 10.9.9；75个 T5R/B7 用例（含 seed42 八席整局、全部战斗回放折叠与狼群八席检查）、全仓类型检查、五个 Node 入口校验（T1/T2/T3/TP/T5R）通过，T1 固定 state/event/RNG trace 哈希保持不变。

B7 显示接线提示：`toDisplayMatch` 当前把 m8.preparation 固定填为空敌军；应消费上述已公开 preparation 字段才能显示完整预览。此处只补规则投影，界面适配仍由 Claude 修改；xpRequested 与掉落摘要不在本次用户指定增补范围。

## C6 客户端改用紧凑回放后的需求（2026-10-12，Claude 流水线 C）

C6 已让离线与联机共用一条战斗渲染路径：棋盘、单位条、特效、飘字都读 `CombatViewState` 与 §14.2 白名单事件；服务器只发 `replay`，旧 `combat` 帧、分包与 `combatTransport`/`CAT_COMBAT_TRANSPORT` 已删除；PvE 结果只保留开战态、末态与完整账本（不再逐 tick 保存 MatchState）。SR-B7-02 的野怪预览与利息基数已在 `seat-view-adapter.ts` 接入。

### SR-C6-01 导出单条事件的显示投影（P2，去重）

- 现状：`combat-replay-view.ts` 的 `animationEvent` 未导出。离线模式需要把本地账本转成同一白名单事件，客户端在 `src/presentation/combat-display.ts` 的 `toDisplayEvent` 里逐字段复写了一份；`tests/server/replay-client.test.ts` 用真实 PvP/PvE 战斗断言两者完全相等，防止漂移。
- 需要：从 `src/server-entry`（或 `combat-replay-view.ts`）导出 `toCombatViewEvents(events: readonly LedgerCombatEvent[]): CombatViewEvent[]`（不含 unitUpdated，语义与回放中的动画事件逐条相同）。导出后客户端删除复写，只保留离线专用的 `effectTriggered` 标签。
- 验收：对任一可信战斗，`toCombatViewEvents(battle.events)` 等于 `toCombatReplay(battle).ticks` 展平后去掉 unitUpdated 的事件序列。

### SR-C6-02 联机状态图标与护盾层（P3，可选）

- 现状：§14.2 不承诺状态图标/持续时间；联机棋子不显示状态条，策略面板与统计面板隐藏护盾层、状态行、效果来源与按来源治疗（离线仍完整显示）。
- 需要（可选）：若要联机也显示，给 `CombatViewUnit` 增加只读白名单字段，例如 `statuses: {kind, harmful, expiresAtTick}[]` 与 `shieldLayers: {remaining, expiresAtTick}[]`；客户端只显示，不回填 runtime。
