# M8 界面任务说明（可直接交给 Claude）

**状态：规划待用户确认；本文不授权开始功能实施。**

你负责本项目的界面与表现层。GPT/Codex 负责规则、内容数据、存档/回放领域实现、测试、文档和审计。项目固定参考 TFT S13 **14.24b**，单人模式，工作平台为桌面 Chromium。

M8 计划补全常规基础组件与成装，并加入第一阶段野怪、完善各阶段 `.7` 野怪和掉落。本文只规定要实现的功能及其权威数据来源，不规定布局、颜色或动画设计。总体范围、后端任务和用户决策以 [M8_PLAN.md](../M8_PLAN.md) 为准。

## 1. 开工前提与任务标签

以下前提全部满足后，才可以开始本文的功能任务：

1. 用户明确确认 M8 计划，并确认会影响当前任务的决策；仅收到本文、阅读文件或出现任务标签不算确认。
2. 核实 M7 已真正合入 `main`，记录最新 `main` SHA、工作分支和干净工作区。规划时核对的 `main=a8be9fc` 只有 M6；M7 候选 `6120e86` 是把 main 合入 M7，不能当作 M7 已合入 main。当前事实与证据见 [M7_STATUS.md](M7_STATUS.md)。
3. 核对实施基线的 CI 与实际差异；`77600c8` 的历史成功 CI 不自动证明之后的 `6120e86` 或合并提交已通过。不要自行合并 M7 来满足前提。
4. 等待相应后端任务的真实交付和接口冻结。未确认的范围、数值和存档策略继续标为待定。

本文的 **【可立即开始】** 表示“上述公共前提满足后，现有数据已足够，不额外等待新增后端接口”，**不是现在开始施工**。**【依赖后端任务 Bx】** 表示必须等该任务的代码、类型、文档和必要验证交付后再接入；读取到计划里的字段名称不代表接口已经存在。

当前范围建议为 8 种常规组件、36 件常规成装，共 44 个装备定义、36 个无序配方，包含窃贼手套；这是 `M8_PLAN.md` 决策 D1 的待确认范围。纹章及其特殊合成路线、神器、光明装备等不属于本轮默认范围。M9 起按费用补英雄和羁绊，全英雄完成后再做特殊装备，最后扩充海克斯强化。现有强化/异常仍按当前规则使用，不在 M8 删除或扩充。

## 2. 阅读顺序与修改边界

### 2.1 需要阅读的文件

先读前四项，再按领取的 U 任务读取对应源码；无需为了界面工作改写后端模块。

| 顺序 | 文件或模块 | 阅读目的 |
| --- | --- | --- |
| 1 | [AGENTS.md](../AGENTS.md)、[README.md](../README.md)、[M7_STATUS.md](M7_STATUS.md) | 分工、现有操作、准确基线与历史证据边界 |
| 2 | [M8_PLAN.md](../M8_PLAN.md)、本文 | 范围、B/U 编号、用户决策、依赖与验收 |
| 3 | [MATCH_CONTRACT.md](MATCH_CONTRACT.md)、[COMBAT_CONTRACT.md](COMBAT_CONTRACT.md)、[SAVE_CONTRACT.md](SAVE_CONTRACT.md)、[REPLAY_CONTRACT.md](REPLAY_CONTRACT.md) | 命令、事件、存档和回放的权威边界；接入时再读 B2/B9 更新版 |
| 4 | [PROJECT_GUIDE.md](PROJECT_GUIDE.md)、[M5_RULES.md](../M5_RULES.md)、[M6_GOAL.md](../M6_GOAL.md) | 当前目录、仍有效的规则和冻结预算；历史阶段范围不覆盖本轮要求 |
| 5 | `src/rendering/strategy-panel.ts`、`match-session.ts`、`BoardScene.ts`、`combat-feedback.ts`、`replay-view.ts`、`app-shell.ts` | 现有装备操作、会话接线、战斗与回放视图、命令结果反馈 |
| 6 | `src/presentation/s13-assets.ts`、`s13-asset-manifest.ts`、`hero-identity.ts`、`unit-view.ts`、`fx-plan.ts`、`combat-fx.ts`、`help-panel.ts`、`preferences.ts` | M7 身份、图片、事件反馈、帮助与减少动效的已有实现 |
| 7 | `src/simulation/match-types.ts`、`strategy-types.ts`、`combat-types.ts`、`content/items.ts`、`inventory.ts`、`round-schedule.ts`、`round-enemies.ts`、`rewards.ts`、`combat-s13.ts` | 只读核对真实字段和规则入口；不在这些文件写界面替代规则 |
| 8 | `src/m6/application.ts`、`contracts.ts`，`src/persistence/`、`src/replay/`、`src/stats/` 的相关文件 | 只读理解应用接线、保存状态、版本、回放快照与统计；修改权限另见 D6 |
| 9 | 合并基线中的 `docs/M7_VALIDATION.md`、`docs/M7_CODEX_AUDIT.md`，B0/B2/B10 交付的合同、样本与命令清单 | 保留已修复缺陷，按当前 SHA 运行真实验证 |

规划时 main 尚无第 6 项及 M7 专项验证文件；可先只读 [固定 M7 候选源码](https://github.com/catfish-xn/cat/tree/6120e86b74934bd70d484ca93b83ab5c93b10d41/src/presentation) 和 [候选验证记录](https://github.com/catfish-xn/cat/blob/6120e86b74934bd70d484ca93b83ab5c93b10d41/docs/M7_VALIDATION.md)。实施时以真正合并后的源码为准，不把候选文件复制进旧 main 代替合并。

### 2.2 可以修改和不可修改的范围

| 范围 | 本任务权限 |
| --- | --- |
| `src/rendering/`、`src/presentation/`、`src/main.ts`、`index.html`、`src/style.css`、`public/assets/` | Claude 可修改；限本轮已批准的界面功能。`match-session.ts` 仍是薄命令/时间适配器 |
| `docs/UI_REQUESTS.md` | 按 AGENTS 的明确约定记录数据/命令/接线需求；没有文件时可建立这个协作记录，不自行扩写规则合同 |
| `src/simulation/`（含 `content/`）、`tests/`、`scripts/`、`.github/`、`package.json`、`package-lock.json`、构建配置 | Claude 不修改；可阅读并运行 GPT 提供的现有命令，不增加或修改测试代码，不升级依赖 |
| `src/persistence/`、`src/replay/`、`src/m6/`、`src/stats/` | 默认不修改，包含以下历史界面叶子文件；不能因文件内部有 DOM 代码就扩大白名单 |

**决策 D6：历史界面叶子的协作边界尚待用户确认。** 建议只明确允许 Claude 修改这四个界面文件：`src/persistence/save-controls.ts`、`src/replay/replay-panel.ts`、`src/stats/stats-panel.ts`、`src/stats/combat-feedback-renderer.ts`。在 D6 获确认前，它们仍不可修改；确认后也只允许展示和控件回调适配，存档校验、重演、统计聚合、资源发放和应用领域集成仍由 GPT 完成，不扩大到整个目录。

遇到边界外接线或字段缺口，在 `docs/UI_REQUESTS.md` 写明：关联 U/B 编号、目标功能、缺少的字段或公共命令、字段含义与单位、来源与读取时机、失败/空值情况、可验证的验收条件及当前阻塞。等待 GPT 交付或用户决定；不得搬文件、复制统计计算、自建存档导入器或实现同名假后端来绕开边界。

## 3. 已存在的数据与拟议接口

### 3.1 已存在：可以只读使用，不是 M8 新接口

下表已经按 M6 main 和 M7 候选的实际类型核对。M7 尚未改变领域装备数量与存档协议；接入时以合并基线及后续冻结合同为准。

| 已有入口 | 真实字段或签名 | 使用边界 |
| --- | --- | --- |
| `ITEM_DEFINITIONS`（`src/simulation/content/items.ts`） | 每项 `id`、`name`、`kind: 'component' \| 'completed'`、`effects`、可选 `recipe: [definitionId, definitionId]`；当前 7 组件 + 9 成装 | 可展示现有目录与静态配方；没有 `apiName`、`unique`、`slotCost`、`referencePatch`、完整44项或通用效果描述字段 |
| `MatchState.items` | 每个实例 `id`、`definitionId`、`location.kind`；装备在单位上时另有 `location.unitId`、`location.slot` | 实例ID与装备定义ID分开；当前槽索引0–2。只按状态展示库存/归属，不自行改数量或位置 |
| `MatchState.pendingChoice` | `kind`、`step`、`choiceId`、`generation`、`offers`、`targetId`、`eventId`、可选 `returnPhase` 等 | 使用公共选择命令，保持过期选择保护；不要凭字段存在判断某份 M8 掉落已可领取 |
| `MatchState.scheduleReceipts` | `eventId`、`round`、`kind`、`itemIds`、`gold`、`unitId`、`definitionId` | 当前已提交奖励的账本，不是未来随机掉落目录；不可在前端追加收据 |
| `MatchState` 的阶段/轮次 | `phase`、`round`、`roundDefinitionId`、`roundResults`；现有 `getStageRound(round)` 返回 `{stage, round}` | 旧编号从2-1起算。M8 接入 B6 后必须改读显式轮次投影，不能保留前端加减偏移公式 |
| `MatchSession` | `state`、`phase`、`combat`、`combatEvents`；`combine(a,b)`、`equip(itemId,unitId,slot)`、`choose(choiceId,generation,definitionId)`、`continue(round)` | 调用现有公共命令；成功读取新状态/事件，失败读取 `reason`。不会因为预览为允许就跳过最终命令校验 |
| 当前装备命令事件 | `itemCombined{consumedIds,itemId,definitionId}`、`itemEquipped{itemId,unitId,slot}`、`itemsReturned{itemIds,unitId}` | 来自成功命令的 `MatchCommandResult.events`；`session.combatEvents` 只保存战斗事件，不能从中等待装备命令事件 |
| `readCombatStats(unit, combat)`（`combat-s13.ts`） | `attackDamage`、`abilityPower`、`attackIntervalTicks`、`attackRange`、`armor`、`magicResist` | 这是当前有效战斗属性投影，不是伤害排行榜；UI 不另算减抗、叠层或装备加成 |
| `CombatState.units` 与 `CombatEvent` | 单位有 `hp/maxHp`、`mana/maxMana`、`shield`、`shieldLayers`、`statuses`；事件有 `packetDamage`、`heal`、`manaChanged`、`statusChanged`、`shieldLayerChanged` 等 | 当前伤害类型只有 `physical`/`magic`。真实伤害和新增状态/法力语义需要 B2/B3，不能前端补算 |
| 统计与回放 | `BattleStats{runId,combatId,nextEventSeq,units}`；`ReplaySnapshot{combat,events,tick,endTick,nextEventSeq,playing,speed}` | 读取 GPT 提供的统计和回放快照；历史回放不读取当前局临时装备或当前版本新规则 |
| 现有保存控件投影 | `SaveControlsView{startup,canContinue,seed,runId,busy,status,hasActive}`；`SaveStatus` 为 `saving` / `saved` / `failed` | 当前没有兼容性投影。只有 `saved` 表示事务完成；不能把排队或解析成功显示为保存成功 |
| M7 素材读取 | `S13_ASSETS` 每项 `kind,id,path,source,bytes,sha256`；`s13AssetUrl(kind,id)`、`s13IconHtml(...)`、`installImageFallback(...)` | 当前16项装备素材，图标来源版本14.24不等于14.24b数值已核实；保持 `import.meta.env.BASE_URL` 子路径语义与缺图回退 |

已有 `strategy-panel.ts` 的 `describeEffect(effect)` 只负责当前效果的文案；完整 M8 描述以后由 B1/B2/B4 的已核实元数据提供，不能把该函数扩成规则实现。

### 3.2 拟议：名称与类型由 B2 冻结后才可接入

以下是交接所需的**建议读取合同**，不是当前已经存在的 API。B2 负责冻结导出路径、函数名、字段类型、空值、失败码、枚举和版本语义；后续任务负责实现。只读查询不得推进 tick、消耗 RNG、分配实例ID、发奖励或写入存档。

| 拟议入口 | 所需字段 | 完整数据依赖 |
| --- | --- | --- |
| `readItemCatalog()` | `items[]{id,apiName,name,kind,recipe,effectDescriptions,unique,slotCost,referencePatch,contentVersion}` | B1/B2冻结；B4提供确认后的全量定义；B5验证资格元数据 |
| `previewCombine(state,aId,bId)` | `allowed,reason,resultDefinitionId,consumedItemIds` | B5；两个入参是库存实例ID，返回结果定义与真实消耗实例 |
| `previewEquip(state,itemId,unitId,slot)` | `allowed,reason,occupiedSlots,conflictingItemIds` | B5；展示独占/占槽/冲突原因，不在UI再判断规则 |
| `readUnitEquipment(state,unitId)` | `slots,temporaryItems[]{definitionId,sourceItemId,slot,expiresAfterRoundId}` | B5；固定装备与临时装备的归属、期限均来自规则投影 |
| `readRoundInfo(state)` | `roundId,ordinal,stage,subround,kind,isFinal,encounterId,displayName` | B6；稳定轮次ID、顺序序号和玩家可读阶段分开 |
| `readEncounterPreview(state)` | `encounterId,units[]{unitId,definitionId,name,starLevel,cell,stats,abilityDescription},rulesNote` | B7，建立在B6日程上；敌方位置/数值/能力由后端提供 |
| `readLootView(state)` | `roundId,revealedDrops[]{dropId,sourceUnitId,kind,definitionId,quantity,status,allowedActions,receiptId},pendingClaims,canContinue,reason` | B8；只暴露已揭示内容及当前可领取状态，不返回未揭示抽样结果供UI展示 |
| 兼容性读取投影（函数名待B2/B9冻结） | `status,currentRulesVersion,fileRulesVersion,canResume,canReplay,canExportOriginal,reason` | B9及用户决策D2；无权从版本字符串自行推断兼容性 |

`effectDescriptions` 的结构、`unique/slotCost` 的精确语义、`slots` 内元素形状、领取命令与 `pendingClaims` 的结构也必须由 B2 冻结，不能根据字段名称猜测。同样，B3 新增的真实伤害分量、重伤/灼烧/破甲/魔抗削减/护盾/法力效果事件需先有正式类型及数值合同。

来源有两种既有结构：`CombatOrigin` 使用 `ownerId/sourceKind/definitionId/instanceId/effectIndex`，`EffectSource` 使用 `ownerId/sourceKind/sourceDefinitionId/sourceInstanceId/effectIndex`。新增通用投影或展示适配由 B2 说明，不能把不同结构强制转型后忽略来源。回放必须使用该记录对应的内容元数据；B9未提供时，不能让无参数的当前目录查询解释旧版事件。

### 3.3 后端依赖编号

| 编号 | GPT/Codex 交付内容 |
| --- | --- |
| B0 | 实施基线、用户决策、性能基线样本 |
| B1 | 14.24b历史数据核对与冻结、来源及未确认项 |
| B2 | 类型、规则合同、UI只读与命令合同 |
| B3 | 通用伤害、状态、触发、法力、统计管线 |
| B4 | 确认后的44项装备、36配方及原9件成装接入 |
| B5 | 装备资格、三槽、窃贼手套临时装备、只读装备查询 |
| B6 | 显式轮次、第一阶段与初始经济 |
| B7 | 野怪类型、行为、遭遇定义与只读预览 |
| B8 | 掉落生成、唯一收据、领取与终局 |
| B9 | 新版存档、旧档保全、回放兼容与应用集成 |
| B10 | 全部验收、浏览器脚本和CI证据 |

“后端已完成”的证据至少包含：可读取的提交SHA、实际导出与冻结类型、合同位置、字段含义/单位/版本、代表性成功/拒绝状态和相关测试结果。运行样本应由公共流程或 GPT 提供的验证样本产生；不得把手工构造的假界面数据作为已经完成后端依赖的证明。

## 4. 界面任务

### U1【可立即开始】现有装备目录、配方与操作反馈

**实现功能：** 支持查询当前已有16项装备及9个已开放配方，区分库存实例与已装备实例；使用当前公开流程完成两组件合成、指定单位装备及失败反馈。购买、升星、出售导致装备转移/返还后，显示与最新状态一致，不沿用旧选中实例提交后续操作。

**读取字段/命令：** `ITEM_DEFINITIONS` 的 `id/name/kind/effects/recipe`；`state.items[].id/definitionId/location`；`state.phase`；`session.combine(aId,bId)`、`session.equip(itemId,unitId,slot)` 的 `ok/reason/state/events`；成功事件 `itemCombined`、`itemEquipped`、`itemsReturned`。当前静态目录查询可直接读取已归档配方，组合或装备是否合法仍由命令判断。

**完成条件：** 正常操作与失败操作的库存、槽位、数量和原因一致；不提前显示尚未归档的28项新增定义，不根据组件列表自行生成“所有组合都可合成”的规则。完整目录及资格预览接入归 U3，等待B4/B5。

### U2【可立即开始】现有装备身份、图片与帮助文案基础

**实现功能：** 让当前已有装备在目录、库存、单位详情、合成结果和回放中保持定义身份一致；保留图片缺失时仍能辨识名称、查看信息与操作的能力。帮助文案先准确描述已实现的装备操作、快捷键和状态限制；不提前承诺阶段1资源或新的掉落规则。

**读取字段：** 装备 `definitionId/name/kind/recipe`；已有16项装备素材的 `S13_ASSETS.id/path/source/sha256`；`s13AssetUrl`、`s13IconHtml`；现有帮助和 `reducedMotion()` 偏好。资源URL沿用 `BASE_URL` 读取，图片加载完成与否不决定游戏状态。

**扩展子项【依赖后端任务 B4】：** D1确认后，为新归档的28项装备补齐相应身份与图片，按冻结 `id/apiName/name` 对照，不能用外观相似图标代替未核实的装备。素材来源与hash保留；已有清单是生成文件，按 GPT 提供的生成方式维护，不伪造来源/hash。需要改 `scripts/fetch-s13-assets.cjs` 时提交 UI_REQUEST，由 GPT 处理；只运行已提供且输出在允许范围内的生成命令。

**完成条件：** 在域名根路径、正式 `/cat/` 子路径及构建实际声明的入口中，已归档图片可读，故障注入时可回退。涉及第一阶段、掉落、窃贼手套或存档政策的最终帮助文字分别等待B5–B9及用户相关决策；14.24图片来源不能冒充14.24b机制证据。

### U3【依赖后端任务 B5】全量装备目录、合成资格与临时装备

**实现功能：** 在B4/B5及D1范围交付后，展示8组件与36成装的完整配方、已核实效果及限制；玩家可查询某组合/某装备操作能否执行及拒绝原因。准确显示占用的装备槽、唯一性冲突、窃贼手套等独占槽行为，以及其生成临时装备的来源与有效轮次。

**读取字段/命令：** `readItemCatalog().items` 全部字段；`previewCombine(...).allowed/reason/resultDefinitionId/consumedItemIds`；`previewEquip(...).allowed/reason/occupiedSlots/conflictingItemIds`；`readUnitEquipment(...).slots/temporaryItems[].definitionId/sourceItemId/slot/expiresAfterRoundId`；最终仍调用B2保留或新增的公共装备命令并处理其 `ok/reason`。

**完成条件：** 拒绝的组合/重复点击/过期实例不产生虚假成功反馈；三槽、独占限制、出售返还和升星溢出展示与后端结果一致。临时装备不被UI写回永久库存，不允许UI决定其抽样、出售、转移或跨轮保留。B5保证的未揭示临时装备不能由UI根据种子提前推算。

### U4【依赖后端任务 B3】通用战斗状态、来源与统计反馈

**实现功能：** 展示本轮装备实际产生的灼烧、重伤、减抗、护盾、法力及其他已实现通用机制；能够区分物理、魔法、真实伤害，查明作用单位、来源、当前状态、有效持续时间和已提交结果。战斗过程、当前属性、事件明细与统计使用相同的权威语义；只展示本阶段已实现的机制，不为后续英雄/海克斯预先创建功能。

**读取字段：** `combat.tick` 与单位 `hp/maxHp,mana/maxMana,shield,shieldLayers,statuses`；`readCombatStats(unit,combat)`；B3更新后的 `packetDamage.damageType/raw/mitigated/absorbed/hpDamage/source/actionSeq/packetOrdinal`，`heal.requested/actual/overheal`，`manaChanged.before/spent/attackGain/damageGain/hookGain/overflow/after`，`statusChanged.status/reason`，`shieldLayerChanged.layer/reason`，及B2/B3正式新增的字段。效果持续时间从逻辑tick/到期tick读取；格式换算不决定何时失效。统计直接消费B3聚合结果，真实伤害不得按“非物理即魔法”归类。

**回放要求：** 同一功能必须接入回放 `ReplaySnapshot.combat/events/tick/nextEventSeq`，当前单位装备变化不能污染历史战斗。B3后可接现有版本的事件展示，跨版本、恢复和完整回放验收还依赖B9。切换战斗、跳转、退出或新局后，显示归属跟随当前快照，不重复计入旧事件。

**完成条件：** 画面反馈与完整账本、统计一致；减少动效只改变表现，结算、RNG、状态及事件完全相同；不因表现限量截断领域账本。涉及 `stats-panel.ts` 或 `combat-feedback-renderer.ts` 的改动先等D6，统计聚合本身仍由GPT负责。

### U5【依赖后端任务 B7】第一阶段与 `.7` 野怪遭遇预览

**实现功能：** 准确显示当前阶段、小回合、回合类别、是否终局，以及当前允许预览的野怪阵容、星级、位置、属性和能力说明。第一阶段进入后，HUD、帮助、开战/继续条件及回放中的回合名称与权威日程一致。保留既有`.4`补给、强化和异常的已确认日程，不把所有`.7`硬编码成同一套敌人。

**读取字段：** B6的 `readRoundInfo(state).roundId/ordinal/stage/subround/kind/isFinal/encounterId/displayName`；B7的 `readEncounterPreview(state).encounterId/units[].unitId/definitionId/name/starLevel/cell/stats/abilityDescription/rulesNote`；公共命令返回的阶段失败原因。第一阶段金币、等级、经验与单位直接读 `MatchState` 和B6合同，不在UI根据“第一回合”填固定资源。

**完成条件：** 当前轮次与预览对应，进入战斗后的实际敌军与B7定义一致；恢复、继续和回放时没有2-1起算的偏移残留。只显示后端允许揭示的遭遇，不读取未来内部随机状态来预测敌人/掉落。空预览、未确认规则及拒绝状态用后端提供的含义解释，不猜造野怪数值或技能。

### U6【依赖后端任务 B8】已揭示掉落、领取与结算

**实现功能：** 显示本回合已揭示的奖励、来源、数量、已发放/待处理状态；若规则要求选择或领取，则通过公共命令完成。结算和“继续”状态与尚未完成的奖励处理一致，失败、平局及最终PvE结果按B8返回的规则结果展示。

**读取字段/命令：** `readLootView(state).roundId/revealedDrops[].dropId/sourceUnitId/kind/definitionId/quantity/status/allowedActions/receiptId/pendingClaims/canContinue/reason`；必要时读取 `pendingChoice.choiceId/generation/offers` 并使用B2/B8冻结的领取/选择命令；已提交结果由新状态、奖励事件和唯一收据确认。`MatchState.outcome`、`roundResults` 与B8终局投影是结果依据。

**完成条件：** 重复点击、重复继续、刷新恢复或迟到回调只显示真实的一次发放；不能为了显示奖励而调用随机函数、推进RNG或写收据。未揭示掉落不得出现在界面、提示文字或额外UI调试字段中；不根据敌方装备外观推算掉落。自动发放规则不额外增加一个领域中不存在的“领取”步骤。若采用D4-A，满备战席的最终英雄掉落可由后端标为`retained-terminal`：仅在终局清单展示并随存档保留，不显示为已入库；读取`allowedActions`，没有允许动作时不显示虚假领取能力，不放进会永久阻塞终局的待处理流程。

### U7【依赖后端任务 B9】旧档保全、新局提示与对应版本回放

**实现功能：** 按用户D2决定及B9兼容性结果，明确区分可继续、可回放、只能保全/导出原文件以及不可识别的档案；在创建新版新局或替换当前槽之前显示实际影响及可执行操作。用户应能按后端支持的路径保留M7原档；不得因为加载新版界面而静默覆盖或删除旧档。

**读取字段：** 兼容性投影 `status/currentRulesVersion/fileRulesVersion/canResume/canReplay/canExportOriginal/reason`；保存控件的 `busy/status/hasActive` 及B9补充的权威信息；文件/记录版本由B9校验，不能仅凭文件名或字符串版本差异推断“可迁移”。回放使用B9交付的对应版本快照、元数据、轮次名称和能力标记。

**完成条件：** 只暴露真正可用的续玩/回放/导出能力，D2未确认时不承诺无损升级或历史重演。原文件保全通过B9的公共接口完成，UI不直接改IndexedDB、重写schema/digest或重演规则。导入/写入失败保留原局，保存成功仍以事务完成为准；新旧回放都只读。涉及 `save-controls.ts`、`replay-panel.ts` 的修改先等D6；`application.ts`、存储、版本分派、回放算法由GPT集成。

## 5. 验证要求

Claude 运行验证并提交界面证据；GPT/Codex 编写、修复和维护测试/脚本，B10负责最终全量验收。发现测试缺少覆盖时记录具体缺口，不自行修改断言、golden、预算或添加测试文件。

### 5.1 当前已存在的常用入口

在确认后的实施基线与工作分支上，按改动影响面运行：

```sh
npm ci
npm run typecheck
npm run build
npm test
```

这些命令已经存在；不假设有 `lint`、`start`、`test:m8`。完整单测、正常时间对局与性能运行由GPT协调，避免多个代理同时占用CPU而污染数值证据。浏览器路线和B10新增脚本的精确命令由GPT随交付提供；在其真实存在之前只记录待运行，不填写伪造脚本名或通过结果。读取调试观察口只作核对，不能注入金币、装备、敌人或加速逻辑tick。

### 5.2 桌面功能与浏览器路线

新增界面检查使用 **1440×1000、1440×600、1920×1080** 三个桌面视口。完整对局在主1440×1000视口分别跑dev与生产preview，另两个视口只核对关键流程与信息可达性，不把完整路线再乘三份；子路径资源在构建实际声明的 `/cat/` 入口检查。M8不新增手机适配、手机视口、旋转或触摸测试；现有门禁中的历史手机断言不由Claude擅自删除。

| 路线 | 必须核对的行为与状态 |
| --- | --- |
| 装备 | 现有与新增定义/配方可查询；正常合成/装备及拒绝结果；独占槽、临时装备、出售返还、升星转移；最终状态与B5一致 |
| 第一阶段至后续PvE | 用B10提供的正常公共路线进入第一阶段、过渡到2-1、完成各阶段`.7`与终局；另验证6-7英雄掉落且备战席已满时的终局保留记录/允许动作、保存恢复；界面轮次、敌军、已揭示奖励与收据一致；不以手工跳轮代替路线 |
| 快捷键与焦点 | D/F/E快速输入、repeat、输入框内打字、拖拽取消和过期选择仍正确；帮助打开时运营输入不穿透，奖励出现不抢焦点；关闭帮助后合法操作恢复 |
| 生命周期操作 | 保留M7防止“继续”双击误开下一战的行为；B10路线按真实保护窗口操作，不通过修改按钮防护或重试吞错让测试通过 |
| 战斗与统计 | 包括真实伤害、盾吸收、有效/过量治疗、法力和来源的代表性样本；从状态/事件读取结果，显示与B3统计相符 |
| 减少动效 | 同seed、同公开命令、同逻辑tick下，开关前后完整状态/事件及结果相同；不能把不同抽样的两场战斗当等价证据 |
| 保存与回放 | 新版准备/战斗/奖励待处理/终局恢复；按D2验证M7原档保全与实际支持能力；1×/2×/4×、暂停、seek、切战、退出后不改变活动局或存档revision |
| 资源与错误 | 已归档图片在根路径和`/cat/`下可读；受控404回退可用；正常路线无新增控制台/页面错误，故障注入导致的预期网络错误单独记录 |

既有 `verify-m7-presentation.cjs`、`verify-m7-subpath.cjs` 等只在真正包含它们的M7基线上运行。既有五视口脚本含历史手机范围，B10应为本轮新增桌面需求提供准确入口；Claude不新增手机测试，也不宣称三桌面视口已被旧五视口脚本自动覆盖。

### 5.3 性能与证据

- 沿用B0/B10冻结的负载和测量口径。主计划§7.6建议M8以已验收M7为基线，JS gzip≤1.10倍、首次可操作中位数≤1.20倍，并给出新压力场景的tick/帧间隔预算；这些是待确认草案，不是实测结果。旧M7相对M6的同类门槛和报告属于历史证据，不能改名当M8证据，也不能由Claude自行更换参照物或阈值。
- M6现有存档/回放预算、30次生命周期后的GC堆增量≤1MiB与监听器/RAF不增长继续如实报告；M6撤销记录累积由独立分支处理，M8不修复、不清空输入撤销历史，也不提高阈值掩盖问题。
- 新图片加载、状态展示和回放不能阻塞公共操作或改变规则推进。界面性能证据注明桌面视口、浏览器、模式、采样负载和SHA；UI流畅度不能用Node领域运行时间代替。
- 截图/日志/trace和机器结果按GPT指定的 `artifacts/` 目录保存并交接，不把生成物提交到Git。记录确切命令、通过/失败/未运行项、源码是否干净；旧SHA通过不代表新SHA通过。

## 6. 交付与汇报

每个U任务交付时提供：变更文件清单；消费的实际B任务提交/接口/版本；完成的功能与数据来源；已运行命令和证据位置；仍缺的字段、用户决策或后端接线。界面新代码只能读取批准后的真实接口，最终交付不保留模拟数据分支或另一套规则计算。

“已实现”“验证通过”“等待后端”“等待用户决定”分别说明。不要自行合并分支、发布网站或启动后续阶段。提交/推送沿用用户在实施阶段明确授权的协作方式；本文不是现在写功能代码的指令。

最终中文汇报总计不超过15行，使用AGENTS的五项格式，例如：

```text
【完成】U编号、完成的功能、工作分支与精确HEAD；读取的后端任务SHA/合同版本。
【完成】修改文件范围；实际验证命令、结果及证据路径。
【未完成】未完成U编号及缺少的具体字段、B任务、D决策或验证；没有则写无。
【需要我决定】需要用户拍板的选项和建议；已有D1/D2/D6结果不得重新当作未授权。
【风险】已复现问题及证据；当前未验证边界；不把旧CI当本次结果。
【下一步】下一项可执行U任务及前置交付；等待GPT审计/用户验收，不自行合并。
```

用户确认后的决策应回填主计划，尤其是D1装备范围、D2旧档处理和D6四个历史界面叶子的权限。字段或机制拿不准时交给GPT核对14.24b来源；不要从当前赛季印象补数值，也不要在界面文案中把未确认规则写成事实。
