# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付阶段、缺少的字段与含义、界面当前替代路径、交付后需要复核的内容和验收条件。界面不自行计算规则；后端交付前，界面只读已有权威字段，并在无法确定含义时使用中性文案。

## U5 第一阶段与 `.7` 野怪遭遇预览（开工前接口盘点）

基线：`feat/m8-b0-baseline` 的 `8778269`（B7 PR #21 已合入）。U5 **尚未开工**，等待 JS 体积新上限批准；本节只盘点 U5 需要的数据和缺口。

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

- 现状：`EncounterPreview.units[]` 不能区分英雄和野怪。界面只能回退到 `UNIT_DEFINITIONS[id]`，但其中的野怪条目是 ENCOUNTERS §3 允许的旧类型适配（`cost:1`、`symbol:'兽'`、`color`）。`getHeroIdentity()` 会因此把野怪显示成“1费”，职业行显示为空或“中立”。
- 需要：`units[].unitKind: 'champion' | 'neutral'`，`units[].monsterFamily: MonsterFamily | null`（英雄为 null）。值取自冻结内容，与恢复校验同源，不按 ID 前缀推断。
- 用途：野怪不显示费用、职业行和英雄头像框；按 `monsterFamily` 分组显示（例如“石甲虫 ×3”）。
- 当前替代：开工后先读适配层的 `UNIT_DEFINITIONS[id].unitKind`，并屏蔽野怪费用；字段交付后改读预览。
- 验收：8 场 PvE 的 25 个单位全部为 `neutral`，family 与 ENCOUNTERS §3 表一致；PvP 单位全部为 `champion`，family 为 null。

### UR-U5-02 预览单位的完整开战属性（P1，B7 后续，修改冻结类型）

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

- **PvP `encounterId = pvp:<roundId>`**：如果获批，界面只把它当作不透明的显示键，不用作素材键或掉落键，也不解析前缀。
- **预览范围**：`readEncounterPreview` 只描述当前轮（准备、战斗、结算阶段都能读，`nextRound` 后切换）。U5 第一版不提供“下一轮预告”；如果需要，要新增接口，并由 Codex 判断可公开的范围。

### 体积影响（U5 开工前实测）

同一环境（Node 22.22、zlib 1.3.1，按 `m7-budget` 的方法：每个 `dist/assets/*.js` 先单独 gzip level 9，再求和）：在 `8778269` 上只加入 `readEncounterPreview` 的 import，不加任何界面代码，JS gzip 从 **485,743 B** 增到 **487,353 B**（**+1,610 B**）。按现行上限 488,477 B 计算，留给 U5 全部界面代码的只有 **1,124 B**。其中英雄说明表 `HERO_RULES` 约占 842 B。UR-U5-01/02 会再增加少量字节。U5 是否开工取决于体积新上限。

