# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付阶段、缺少的字段与含义、界面当前替代路径、交付后需要复核的内容和验收条件。界面不自行计算规则；后端交付前，界面只读已有权威字段，并在无法确定含义时使用中性文案。

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
- 当前替代路径：`combat-status.ts` 的 `statusSource(combat, unitId)` 直接读 store；带 `damageFilter` 的贡献全部显示并列出声明的适用范围，从不标为“被压制”；无过滤的同类最强（灼烧、重伤、击碎等）才依据 `effectiveSourceKey` 标注“同类更强来源生效中”。
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

- `packetDamage.outcome`（`DamageOutcome` 全字段，含 `context.source` 完整来源、`prevented/overkill/killingPacket`）：实战未携带。界面已有显示分支，交付后无需改代码，只需复核。
- `cast.receipt{targetIds,targetsSampledAtTick,actualManaSpent,refundedMana,completed,completionCell,actionSeq}`：用于“施法选中 A / 实际命中 B”（A11 麦迪例）和实际耗蓝/返蓝；当前只显示选中目标。
- `manaChanged.outcome`：普攻/受伤/施法路径缺失。
- 交付后复核：伤害明细出现“被防止/溢出/致命”；临时子件造成的伤害显示“临时子件”标记；麦迪例同时显示选中 A 与命中 B；界面不以法力净变化推算耗蓝。

### UR-U4-04 引导/分担的正式事件类型（P2，B9）

- 当前实战以 `statusChanged` 携带 `activity` 发出（含 `control-cancelled`、`replaced`），没有 `activityChanged` 类型。
- 需要：确认 replay2 用哪一种；若改为 `activityChanged`，请加入 `CombatEvent` 联合，界面改读该事件。
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
| R1 减伤适用范围 | 同一单位：8% 减伤 filter={basic-attack; physical/magic; exclude}，50% 减伤 filter={ability-direct; …}；再受 100 物理普攻 | 领域伤害 92；状态列表两行均无“同类更强来源生效中”、无 inactive 样式，各显示“适用：普攻…”“适用：技能直接伤害…” |
| 同类最强（无过滤） | 两个 shred：30% 至 100、50% 至 60，读 tick 59 与 61 | 59：50% 行正常、30% 行“同类更强来源生效中（本来源保留）”；61：仅 30% 行且无压制文字 |
| R2 兼容锚点 | 厄加特/蕾欧娜/芮尔/库奇技能施加；灼烧+重伤单位受致死伤害；战斗结束 | 事件日志：“护甲击碎 20%”“减伤 50%”“属性变化 −10”（UR-U4-05 交付后改为属性削弱明细）；清理显示“状态清理（阵亡清除）/（战斗结束）”，不出现“眩晕 0” |
| R3 来源 | 临时子件护盾（`m8State.source.parentItemInstanceId` 非空、`layer.source` 无该字段）；临时子件状态与治疗 | 事件日志、策略面板盾行、统计面板来源均含“临时子件”，两面板格式一致 |
| R4 治疗分项 | A10 两套：无重伤 / 33% 重伤（`resolveHeal`） | 事件含两来源各自“请求/有效/过量/重伤减少”，数值同 UR-U4-02 |
| 三类伤害 | 物理 10、魔法 20、真实 30 各一包 | 日志“物理/魔法/真实实际生命伤害”；飘字“−10”“−20 魔”“−30 真”；选中单位详情三类分别 10/20/30 |
| 状态与法力筛选 | 统计面板筛选选“状态”“法力”“全部事件（法力单列）” | “状态”只有 statusChanged；“法力”只有 manaChanged；“全部”不含 manaChanged |
| 引导被控取消 | 范德尔例（UR-U4-04） | 日志“引导 被控制打断”；状态列表与棋子“引”小标在取消 tick 消失且不恢复 |
| 护盾 | 600 盾自然衰减 100 后吸收 120；另一盾耗尽；阵亡清理 | 日志含“自然衰减”“吸收伤害”“耗尽”“阵亡清除”；剩余 380、已吸收 120、已衰减 100；统计吸收只加 120 |
| 只读 | 以上每个场景渲染、切换筛选、选中单位前后 | `JSON.stringify` 事件、战斗状态与 `BattleStats` 完全相同 |
