# M8 B2 界面数据合同（m8-b2-v3-review，已复审签收、合同冻结）

2026-10-07，B2于提交 `2632925` 通过用户复审签收，合同冻结（合同标识与字段不变）；配套 [M8_RULES.md](M8_RULES.md)。本页规定数据、语义与入口，不规定布局、颜色或动画。类型见 `src/simulation/m8/ui-contracts.ts`；**当前只有类型签名，没有这些新查询的运行实现**。Claude可以继续U1/U2使用现有16件目录，不得将B1的44件来源归档显示成已实现战斗效果。

## 1. 权威边界与交付门槛

Match为资源/操作/轮次唯一权威，Combat为战斗结算唯一权威。只读投影不修改state、ID、事件、收据或RNG，也不触发临时装备生成、补发掉落或恢复修复。预览与真实命令使用同一领域校验器，预览通过后提交仍须校验当前状态，不能把预览当授权令牌。

| 功能 | 冻结查询 | 交付者 / 可用门槛 |
| --- | --- | --- |
| 装备目录、配方、效果说明 | readItemCatalog() | B4；每件有实际效果后才宣告可用 |
| 合成/穿戴预览、三槽与临时装备 | previewCombine、previewEquip、readUnitEquipment | B5；公开命令原子性和TG生命周期通过 |
| 战斗状态/来源/统计 | readCombatStatuses、readCombatStats | B3；实战完成，B9后才签收回放 |
| 轮次、野怪预览 | readRoundInfo、readEncounterPreview | B6/B7；具体日程/内容须来源签收 |
| 已揭示掉落、终局保留 | readLootView | B8；资源/收据原子性通过 |
| 保存/回放兼容性、旧记录导出 | readCompatibility、listLegacyRecords、exportLegacy | B9；版本路由与历史验证通过 |

泛型 M8Queries<Match,Combat,File> 是未来经过验证的领域状态适配签名，不是允许UI自行构造一套Match。新合同导入必须`import type`；本步不提供假实现、固定返回值或any占位。

## 2. 装备与拒绝原因

ItemCatalogEntry包含id/apiName/name/localizationStatus、kind、recipe、effectDescriptions、unique、slotCost、referencePatch、contentVersion、evidenceStatus、conventionIds。组件recipe=null，成装recipe固定两项（允许同种）。id是运行目录稳定键，apiName是源身份，不依赖中文名匹配。临时译名标 temporary-unverified；B-07/B-10显示approved-provisional，批准暂行与待历史核验并存。effectDescriptions由核准效果数据生成，不由UI再计算系数。

- previewCombine(state,aId,bId)：允许时给resultDefinitionId和两个consumedItemIds；拒绝只给reason。aId=bId拒绝same-item，两件不同实例同种可合成。预览不分配成品ID。
- previewEquip(state,itemId,unitId,slot)：允许时给occupiedSlots；拒绝给reason和冲突实例列表。窃贼占[0,1,2]，普通件仅指定slot。不能根据source.unique=false绕过三槽。
- readUnitEquipment(state,unitId)：未知单位返回null；已知返回slots及temporaryItems。槽中永久ID、reservedByItemInstanceId、子件temporaryId分开。临时件只展示来源/定义/期限，不作为equip/combine/sell参数。相同roundId转移会显示同一组合，不能通过打开详情触发重抽。

EquipmentFailure冻结为wrong-phase、unknown-item、unknown-unit、same-item、item-not-inventory、invalid-recipe、invalid-slot、item-slot-occupied、unique-conflict、exclusive-slots、temporary-item。校验优先顺序：phase→身份与临时限制→位置/输入合法性→配方或唯一/槽冲突。UI翻译reason，不能自行改变拒绝结果。

操作沿现有Match/session公开combine/equip/sell/deploy入口；成功使用MatchCommandResult.events，失败保留原state无事件。装备命令事件不在session.combatEvents中，不能等待战斗事件来确认合成。继续/开始依权威phase和拒绝原因，不由页面推断已结算。

## 3. 战斗显示与来源

Source使用ownerId/sourceKind/definitionId/instanceId/effectIndex/parentItemInstanceId。旧EffectSource的sourceDefinitionId/sourceInstanceId不等于新Source同名结构；B3提供明确转换，UI不能猜字段。名称来自本场冻结内容投影；实战与回放共用语义。

M8CombatEvent保持domain/combatId/tick/eventSeq，payload由类型化联合确定：

| 事件 | 权威字段 | 显示/统计含义 |
| --- | --- | --- |
| cast | receipt.targetIds/targetsSampledAtTick/actualManaSpent/refundedMana/completed/completionCell/actionSeq | 规划完成时的权威目标列表（保留顺序/重复）；不能以伤害目标替代，也不能以法力净变化替代耗蓝 |
| packetDamage | outcome.context、raw/prevented/mitigated/absorbed/hpDamage/overkill/critical/killingPacket | 来源、父包及physical/magic/true分开；伤害排行只加hpDamage，盾伤另列 |
| heal | healId/contributions/shares/requested/afterWound/actual/overheal/preventedByWound | 总actual只计一次；bySource用shares权威分项，不以伤害×吸血比例反算 |
| manaChanged | reason/before/blocked/applied/overflow/after/castActionSeq | 回蓝/锁蓝/返蓝分开，不以施法前后净值算离子 |
| activityChanged | activity.key/source/targetId/actionSeq/startsAtTick/expiresAtTick/lifecycle/endedAtTick/endReason、reason | 引导/分担真实生命周期；取消后即移除当前展示，不因计划期限尚未到达而恢复 |
| statusChanged | group.contributions/effectiveMagnitude/effectiveSourceKey/nextPulseAtTick、reason | 显示有效状态与来源/期限；强者压制弱者不是删除 |
| shieldLayerChanged | layer.granted/remaining/absorbed/decayed/expiredDiscarded/decay/expiresAtTick/source、reason | 自然decayed不记吸收；depleted、expired、death-cleanup分开 |
| statChanged、maxHpChanged | before/after/source；最大HP还含前后currentHp、countsAsHeal=false | range为六角格，旧range原名映射；血手补当前生命不作治疗/吸血反馈 |

readCombatStats返回增量nextEventSeq和每单位三类HP伤害、盾吸收、治疗、溢出及bySource；readCombatStatuses返回CombatStatusesView，含statuses状态组和activities权威当前引导/分担，不能从AbilityPlan重建。时间用50ms×剩余tick换算显示，burn pulse每20tick一次，不能显示成每50ms跳伤。统计聚合使用完整事件，seek重置或从检查点重建，不重复累加；attack动作事件不记伤害；M8不再发旧damage/shieldChanged汇总事件，不能与packetDamage双算。

夜刃可显示“不可选中”和“伤害防止”为两个规则状态；是否隐藏模型由Claude决定，不得让视觉隐藏改变选敌。动画合并、降频、减少动效只影响表现，不丢权威事件。契约变更事件在replay2启用，旧回放按兼容视图拒播。

## 4. 轮次与公开遭遇

readRoundInfo返回RoundDefinition全部字段。stage/subround/displayName由目录提供；UI不再从ordinal+旧2-1公式推导。非战斗补给encounterId=null，readEncounterPreview返回null。遭遇预览包含encounterId、units的定义/名字/星级/cell/基本属性/技能说明以及rulesNote；仅提供允许公开的敌军信息，不含隐藏掉落计划、随机词或尚未揭示奖励。

B1阶段1/野怪未核准时，不可把候选1-2/1-3/1-4或9条中立原记录当运行遭遇。当前版本继续显示现有规则；最终新目录由B6/B7一次提供。

### 4.1 U5 遭遇预览有限增补（2026-10-10）

用户于 **2026-10-10 00:31 UTC** 批准按 [UR-U5-01/02 提案](M8_U5_PREVIEW_CONTRACT_CHANGE.md) 实施一次有限、加法式扩展。此处是对 B2 冻结合同的已批准范围例外；正文中的 B2 交付时点说明保留为历史记录。本次实施、测试、Claude 独立审计与合并批准的状态不能由该授权推定。

`EncounterPreview.units[]` 仅新增必填只读的 `unitKind: 'champion' | 'neutral'` 与 `monsterFamily: MonsterFamily | null`；英雄明确为 `champion/null`，中立取同版本冻结定义的正式分类与 family，`MonsterFamily` 使用已有内容类型的 `import type`。`stats` 仅新增必填数值 `attackRange / attackIntervalTicks / critChanceBps / critMultiplierBps / abilityPower / mana / maxMana`。全部精确语义、取值、权威来源及验收门槛见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。

原字段、查询签名、补给轮 `null`、当前轮范围和隐藏信息边界均不变。每次查询只构建一次 strategy snapshot；新属性与真实开战共用领域初始化，其中 `mana` 指成功 `startMatchCombat` 返回的 tick 0 初始化结束值，不是裸 `initialMana`。准备、战斗、结算均显示当前轮开战输入，不读取当前战中属性代替。`pvp:<roundId>` 保留为不透明遭遇身份，不作素材键或掉落键。

本次不含 UR-U5-03/04、图片、UI 改动或英雄说明删减，也不改规则、内容 digest、存档 schema 或 [M8B 冻结增补](M8B_CONTRACT_ADDENDUM.md)。必须提供真实开战对照和普通／相同查询可达条件下的实际 gzip 差量；经 Claude 对合同与实现独立审计后，仍须用户另行批准合并。

## 5. 掉落视图与操作

readLootView只含roundId/revealedDrops/pendingClaims/canContinue/reason。每条含dropId/encounterId/sourceUnitId/roundId/payload与下表状态。隐藏planned以及未取得forfeited条目不进入revealedDrops；类型联合明确不能表达planned，避免直接把领域DropState数组传给UI。

| status | receiptId | allowedActions | 语义 |
| --- | --- | --- | --- |
| revealed | null | [] | 领域正在同事务自动处理，UI不发领取命令 |
| pending-capacity | null | [] | 英雄备战席满；提示通过已有卖出/合并释放空间，领域成功命令自动排队领取 |
| granted | 非空稳定ID | [] | 实际资源已入库，才可显示已领取 |
| retained-terminal | null | [] | 终局保留奖励，未入库/未领取，不换金币；只读记录 |

pendingClaims仅列非终局受阻dropId；canContinue=false时reason为pending-capacity/unsettled-round/game-over。终局保留从pendingClaims移除，但gameOver仍不可Continue。按钮不根据金币增加/动画结束猜收据；重复展示/刷新不授奖。

原子示例：6-7最后怪死亡，揭示金币与一名英雄；金币入库并创建收据，满席英雄成为retained-terminal且receiptId=null，pendingClaims=[]，同一次step进入gameOver。界面必须同时能读到终局结果和保留奖励，不能先进入终局再异步补发。

## 6. 保存与回放能力

CompatibilityView是经过版本路由和必要验证后的结果，不是单凭文件头判断的许可：

- current：M8版本/digest/状态/历史全验证通过，canResume/canReplay/canExportOriginal=true；具体已终局文件展示只读局面，由phase决定可用命令。
- legacy-preserved：识别M7，canResume=false/canReplay=false/canExportOriginal=true，reason=new-match-required。保全/导出不表示经M8语义验证。
- rejected：未知版本、digest不匹配、损坏或容量超限；canResume/canReplay=false。若原始字节确实仍保存可允许导出，否则canExportOriginal=false。失败不能替换现有好档。

文件currentRulesVersion/fileRulesVersion用于解释差异；UI不能改版本号、digest或hash解锁旧档。新局只写M8独立存储命名空间，旧M7原样导出由B9提供。保存成功只来自原生事务完成；重试/迟到回调不覆盖新局。回放1×/2×/4×、seek不改活动state/RNG/revision。

### U7 旧记录目录与指定导出（A13）

LegacyRecordAccess是B9存储服务签名，与只读Match投影M8Queries分开。UI调用listLegacyRecords()得到当前旧库active及历史records，不直接读取IndexedDB。每条LegacyRecord包括稳定recordRef、location、activeSlotRevision、createdAt、rules/schema/save/replay版本、canExportOriginal与reason。空旧库返回成功空数组；不可用/读取失败返回LegacyListResult失败分支，不冒充空库。

recordRef={namespace:hex-autobattler-m6,runId,fingerprint}；namespace/runId定位旧局，fingerprint是B9对原保存信封及关联历史的确定性摘要，不含当前M8会话字段。activeSlotRevision仅是可空提示：旧历史记录没有保存活动槽token，必须为null，不能编造revision。active→history且内容不变时身份不变；内容或fingerprint变化须重新列目录后另选。列表同一引用只出现一次，active/history是位置而非身份。canExportOriginal只表示旧格式导出可完成，不表示M8可恢复/回放；失效记录返回invalid-record/missing-history。

按钮选中一条完整引用后调用exportLegacy({requestId,recordRef})，不是无参数当前导出。B9校验引用，使用旧格式导出器重建原版本信封和其历史，不迁移、不改标版本、不以当前Match填充内容；若已保存原始文件字节则原样返回。响应成功携带同requestId/recordRef、fileName、application/json和bytes；失败携带同身份及not-found/stale-reference/invalid-record/missing-history/unavailable/read-failed。迟到响应只归属原选择，请求ID不一致不得覆盖新选项反馈；失败不自动回退导出其他记录。

M8SaveControlsCallbacks明确区分onExportCurrent()与onExportLegacy(request)。已有SaveControlsCallbacks.onExport()只能适配“当前局”，不能直接承担旧记录导出。具体服务、控件适配与下载均由B9实现，本步不改存储或UI。

合同例：当前new-m8/revision9运行中，列表返回old-run/fingerprint=old-content（history，activeSlotRevision=null，M7 format1）。选择后export-1只能返回该旧记录的format1内容；它若已换修订则stale-reference，响应仍指old-run/old-content，new-m8及其活动槽/revision/epoch/RNG完全不变。不能把“旧档可导出”的布尔值当成记录选择接口。

### U4 审计例的展示归属（A03/A10/A11/A12）

刀妹600盾自然减100再吸收120后，护盾反馈为remaining380/absorbed120/decayed100，吸收排行只增加120。饮血/枪刃合并35治疗、实际20/过量15，仅一个healId修改HP；bySource分别显示实际11/9、过量9/6，requestedHealing20/15；重伤分项也由领域shares给出。麦迪cast.targetIds=[A]、实际packet.targetId=B时分别展示施法选中A和拦截命中B，不覆盖其一。旧attackSpeedBps事件映射attackSpeed，before/after仍为Bps；abilityPower保留原名。克格莫第三次施法range3→4按statChanged直接反馈六角射程增长，不用UI计数推算。上述统计在实战和回放采用同一权威字段。

## 7. 接线验收与职责

B3/B5/B8/B9实现后分别验证：查询前后canonical状态和所有RNG相同；预览/提交同条件同拒绝；临时ID不能操作；事件归属正确；只打盾不误报HP伤；true不混magic；血手不混heal；隐藏计划不泄漏；终局retained不报已领取；旧M7可导出但不可播。未实现门槛不得以假数据正式上线。

Claude修改展示层及D6-A四个UI叶子；缺字段写 `docs/UI_REQUESTS.md`，说明字段/含义/用途/现有来源/期望验收/阻塞任务。Codex负责领域/类型、非视觉存档/回放/统计。本版合同已于2632925通过复审签收并冻结；运行实现仍等待对应B3–B9任务，不要求Claude在本次状态记录中修改UI。


## 8. R3 引导与分担的U4接线

`readCombatStatuses(state)`现返回 `{statuses,activities}`，类型为CombatStatusesView；activities只允许lifecycle=active的CombatActivity。每项包含完整来源、施法actionSeq、计划起止tick和已生效的规则字段。领域负责状态有效性、控制取消及分担到期，UI只映射channel为“引导”、redirect为“伤害分担”；不能根据计划、剩余时长或眩晕结束重建状态。

`activityChanged`与现有`statusChanged`是两种载荷。前者记录引导/分担应用、刷新、自然到期、控制取消、替换、死亡和战斗清理，后者继续承载状态组；不能将旧channel/redirect静默丢弃。B3映射生成新事件并同步统计消费，B9保存完整活动记录并恢复权威投影；旧M7回放仍按D2拒播，不从不含actionSeq的旧状态伪造M8记录。

验收：范德尔10开始、原定60结束；20被持续至40的眩晕取消，事件携endedAtTick20及control-cancelled，查询中立刻没有引导。40眩晕结束、40后读档或seek到40，都不能再次显示引导。洛里斯10开始80tick分担，89仍显示，90的expired事件与查询去除一致，早先盾耗尽不撤掉分担。回放seek从领域检查点/权威事件重建活动，不重新执行AbilityPlan；迟到的计划或旧applied事件不能覆盖后来的结束事件。

周期余数属于领域持久态，不要求UI展示或自行累计。读状态、看治疗、打开回放均不改变R1账户、触发计数或RNG。两份合同的R1–R4验收向量通过也不表示B3/B9接口已有运行实现。
