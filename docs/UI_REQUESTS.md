# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、字段、含义与单位、来源与读取时机、空值/失败情况、验收条件和当前阻塞。界面不自行计算规则；以下各项在后端交付前，界面只读已有权威字段并如实标注。

## U4 通用战斗状态、来源与统计反馈（依赖 B3，回放签收依赖 B9）

基线：`feat/m8-b0-baseline` 的 `5dce5cd`（B3 三批均已签收）。U4 已接入的现有权威字段：`CombatUnit.mechanismState.statuses`（StatusGroup）、`mechanismState.activities`、`ShieldLayer.m8State`、事件上的 `packetDamage.outcome`、`heal.outcome`、`manaChanged.outcome`、`statusChanged.group/activity`、`shieldLayerChanged.endReason`，以及 `src/stats/aggregate.ts` 的 `BattleStats`。

### UR-U4-01 `readCombatStatuses(combat)` 运行实现

- 关联：U4 / B3（合同 §3、§8；`src/simulation/m8/ui-contracts.ts` 已有 `CombatStatusesView` 类型，无运行导出）。
- 需要：可从 `src/simulation/` 导入的纯函数，返回 `CombatStatusesView{statuses: StatusGroup[], activities: CombatActivity(lifecycle='active')[]}`，按单位可筛选或带 `targetId`。
- 当前临时做法：`src/presentation/combat-status.ts` 的 `readUnitStatusRows` 直接读 `mechanismState.statuses/activities`，只复制 `effectiveSourceKey`、`appliedAtTick`、`expiresAtTick`、`nextPulseAtTick`、`stackPolicy.kind`、`polarity` 等已存字段，不调用 `isEffective/summarizeGroup`。
- 验收：同一 `CombatState` 下查询结果与 store 中有效组/活跃活动一致；查询不改 state/RNG；交付后界面改为只调此查询，删去直接读 store 的路径。

### UR-U4-02 M8 统计视图 `readCombatStats(combat)`（`CombatStatsView`）

- 关联：U4 / B3（合同 §3 “readCombatStats返回增量nextEventSeq和每单位三类HP伤害、盾吸收、治疗、溢出及bySource”）。
- 缺少：现有 `BattleStats.units[]` 没有 `bySource[]{source, hpDamage, healing, requestedHealing, preventedByWound, overheal}`，也没有按单位汇总的 `preventedByWound`。界面目前只能在单条 `heal` 事件里显示“重伤减少 N”和多来源分项，统计表无法按来源（如饮血/枪刃）展示 A10 审计例的 11/9、9/6。
- 单位：整数生命点；来源为完整 `Source`（含 `parentItemInstanceId`）。
- 验收：A10 例（饮血+枪刃，33% 重伤）统计行与合同数值一致；seek/切战重建不重复累加；真实伤害单列不混入魔法。

### UR-U4-03 施法收据进入实战事件

- 关联：U4 / B3、B9。合同 `M8CombatEvent.cast` 为 `receipt{targetIds,targetsSampledAtTick,actualManaSpent,refundedMana,completed,completionCell,actionSeq}`；当前实战 `CombatEvent.cast` 只有 `targetIds/manaSpent`。
- 用途：显示“施法选中 A / 实际命中 B”（A11 麦迪例）、实际耗蓝与返蓝；当前只显示选中目标列表。
- 验收：实战与回放 cast 事件都带收据；界面不以法力净变化推算耗蓝。

### UR-U4-04 引导/分担使用 `activityChanged` 还是 `statusChanged.activity`

- 关联：U4 / B3、B9（合同 §8）。当前实战以 `statusChanged` 携带 `activity` 字段发出（含 `control-cancelled`、`replaced`），没有独立的 `activityChanged` 事件类型。
- 需要：确认正式回放格式（replay2）中使用哪一种；若改为 `activityChanged`，请同步加入 `CombatEvent` 联合，界面会改读该事件。
- 验收：范德尔眩晕取消例在事件明细中显示“引导 被控制打断”，查询中立即消失。

### UR-U4-05 状态事件的旧锚点 `status.kind`

- 关联：U4 / B3。`s13-mechanisms.ts` 的 `applyFrozenStatus` 与到期路径为新状态生成旧 `CombatStatus` 锚点，`kind` 只映射 stun/armorReduction，其余（灼烧、重伤、魔抗击碎、属性增减等）退化为 `resistanceFlat`。
- 当前处理：界面一律优先读 `group.kind`，仅在没有 `group` 时才读旧 `status.kind`；不再把灼烧显示成“双抗提升”。
- 需要：确认该锚点仅为兼容用途，B9 保存/回放保留 `group`；或在事件上直接提供正式 `StatusKind`。

### UR-U4-06 临时子件与回放的来源名称

- 关联：U4 / B5、B9。`Source.parentItemInstanceId` 非空时，界面目前只标注“临时子件”，无法显示父装备名称；回放中来源名称目前用当前内容目录解析。
- 需要：本场冻结内容投影（来源定义 → 名称）以及父实例 → 父装备定义的只读映射；回放使用该记录对应的内容元数据（合同 §3 “名称来自本场冻结内容投影”）。
- 验收：窃贼手套临时子件在实战/回放显示“来源：某临时装备（来自窃贼手套）”；切换内容版本后旧回放名称不变。
