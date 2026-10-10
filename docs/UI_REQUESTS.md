# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付阶段、缺少的字段与含义、界面当前替代路径、交付后需要复核的内容和验收条件。界面不自行计算规则；后端交付前，界面只读已有权威字段，并在无法确定含义时使用中性文案。

## U5 第一阶段与 `.7` 野怪遭遇预览（开工前接口盘点）

基线：`feat/m8-b0-baseline` 的 `8778269`（B7 PR #21 已合入）。以下为该基线开工前的数据盘点。2026-10-10 更新：用户已批准 M8 专用 JS 新上限及 U5 先沿已有适配路径开工；UR-U5-01/02 已按获批范围实施、待审计，见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。下述两项的“现状/当前替代”保留为开工前历史，不再表示新字段缺失。

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

- 状态：**已实施、待审计**；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)，实施状态不代表审计签收或合并批准。
- 现状：`EncounterPreview.units[]` 不能区分英雄和野怪。界面只能回退到 `UNIT_DEFINITIONS[id]`，但其中的野怪条目是 ENCOUNTERS §3 允许的旧类型适配（`cost:1`、`symbol:'兽'`、`color`）。`getHeroIdentity()` 会因此把野怪显示成“1费”，职业行显示为空或“中立”。
- 需要：`units[].unitKind: 'champion' | 'neutral'`，`units[].monsterFamily: MonsterFamily | null`（英雄为 null）。值取自冻结内容，与恢复校验同源，不按 ID 前缀推断。
- 用途：野怪不显示费用、职业行和英雄头像框；按 `monsterFamily` 分组显示（例如“石甲虫 ×3”）。
- 当前替代：开工后先读适配层的 `UNIT_DEFINITIONS[id].unitKind`，并屏蔽野怪费用；字段交付后改读预览。
- 验收：8 场 PvE 的 25 个单位全部为 `neutral`，family 与 ENCOUNTERS §3 表一致；PvP 单位全部为 `champion`，family 为 null。

### UR-U5-02 预览单位的完整开战属性（P1，B7 后续，修改冻结类型）

- 状态：**已实施、待审计**；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)，实施状态不代表审计签收或合并批准。
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
