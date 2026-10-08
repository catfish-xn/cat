# M8 剩余工作依赖图与并行边界

> 2026-10-08 只读规划；不代表开工授权或功能签收。本文只新增文档，不修改运行代码、冻结合同、测试、门禁或 CI 配置，也不合并分支。
>
> 代码核对快照：[`f03b81d7`](https://github.com/catfish-xn/cat/tree/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20)，即 U4 同步了 B4 与预算的新基线后的组合。写稿时 PR #12 完整 CI 尚在运行，以下“立即可做”均以三个合并成功为前提，不提前声称 U4 已合入。文档分支从已完成前两次合并的基线 `83746cad` 建立。

## 1. 先看结论

- **B5 可以开工**：B4 装备目录/程序、B3 通用机制与 G12 已具备。工作是装备实例接线与公共预览，不重做 G12。
- **B6 无须等 B5 才开始**：开场/显式日程/自然经济可以独立做；但 `match.ts`、序列化和内容 digest 接线要指定唯一负责人。完整开场“三英雄、两组件”端到端验收仍要等 B8 奖励。
- **B7 内容准备可以并行，正式接线等 B6**：已有 B3 通用入口；不能把已批准的野怪数值表当成运行实现或平衡验收。
- **U3 可以拆开**：44 件图鉴、36 配方表、效果说明与身份资源补齐可用 B4 现有接口；合法合成/穿戴预览、唯一/三槽拒绝、窃贼临时件生命周期必须等 B5。
- **B8 必须等 B5+B6+B7**；B9 的旧档保全骨架可早做，完整恢复/回放必须等 B3–B8；B10 最后收口。
- **U4 第一版签收不等于所有界面接口都补齐**：UR-U4-01～07 与正式 replay2 切换仍有待办；不要因为 B3 整体签收就假定所有冻结查询已存在。
- 当前另行授权的 H1 是诊断，优先遵守其前置验证与“不修复、不改门禁”边界；本图不自动启动 B5、第二条 Codex 线或 Claude。

## 2. 依赖骨架

```text
已签收 B3（含通用 M8B 接点） + B4（44 件目录、IF-POOL）
  ├─ B5：实例/唯一/三槽/TG/预览/IF-GRANT ──→ U3 动态操作部分
  ├─ U3 静态图鉴/配方/说明；U2 新身份资源（可先行）
  └─ B6：显式日程/开场经济/IF-ROUND
       └─ B7：真实野怪与遭遇/IF-ENCOUNTER ──→ U5 完整轮次/野怪展示
B5 + B6 + B7 ──→ B8：奖励/选择/唯一收据/IF-LOOT ──→ U6
B3～B8 + 前期旧档保全骨架 ──→ B9：整局恢复/版本/回放/IF-RESTORE ──→ U7
B3～B9 + U1～U7 + 代表负载与桌面集成 ──→ B10
```

B6 完成后 U5 可先接轮次标题/阶段/下一步，敌军正式预览等 B7；B8 才完成开场收益闭环。箭头表示正式集成交付依赖，不禁止提前整理纯数据、测试向量或只读设计。

## 3. 剩余后端批次与主要文件

路径未写前缀时位于 `src/simulation/`；“新增”是计划路径，实施时可按现有结构选址，但不得扩范围。

| 批次 | 硬依赖 / 可先行内容 | 剩余交付 | 预计主要文件 |
| --- | --- | --- | --- |
| B5 装备实例与查询 | B4、已交付 B3/G12；无需等 B6 | 唯一/三槽/独占、升星返还、TG 生成/同轮保持/跨轮刷新/清理；命令失败原子性；预览与只读装备视图；IF-GRANT | `inventory.ts`、`upgrades.ts`、`match.ts`、`match-types.ts`、`strategy-types.ts`、`strategy-snapshot.ts`、新增 `item-selectors.ts`、必要的局部 `serialization.ts`、相关 tests |
| B6 日程与开场经济 | 已批准 M8B OPENING、B2；无 B5 硬依赖；完整收益验收待 B8 | 显式 roundId/38轮33战、初始1级0G、2/3/5G及2/2/0XP、删除旧起手包、强化/异常语义节点、IF-ROUND | `round-schedule.ts`、`match-rules.ts`、`economy.ts`、`progression.ts`、`match.ts`、`content/index.ts`、新增 `round-selectors.ts` / `content/encounters.ts`、局部恢复 |
| B7 野怪与遭遇 | B6/IF-ROUND、B3 已有死亡/开场/几何/AS/暴击/零蓝入口 | 12定义、8场25实例、family/阵型、五种招牌机制；不混商店/羁绊；公开预览 | `round-enemies.ts`、`units.ts`、`unit-types.ts`、`combat-s13-abilities.ts` 或新增 `combat-neutral.ts`、`content/neutrals.ts`、`encounter-selectors.ts`、内容校验/digest |
| B8 掉落与收据 | B5 IF-GRANT + B6 IF-ROUND + B7 IF-ENCOUNTER + B4 IF-POOL | 预冻掉落/自选/fallback、资格/解决账本、奖励原子性、满席/终局、部分击杀/未击杀作废不顺延、成长迁移、IF-LOOT | `rewards.ts`、`round-schedule.ts`、`match.ts`、`match-types.ts`、`strategy-types.ts`、新增 `content/loot.ts` / `loot-selectors.ts`、序列化 |
| B9 版本/恢复/应用集成 | 旧档只读骨架可按 B2 先行；最终依赖 B3–B8 | schema6/save2/replay2、digest、旧 M7 保全与指定导出、33战容量、活动会话隔离、新事件/状态回放、IF-RESTORE | `serialization.ts`、`content/index.ts`；`src/m6/{contracts,limits,application}.ts`；`src/persistence/{format,repository,coordinator,compatibility}.ts`；`src/replay/{history,index,playback-session}.ts` |
| B10 集成验收 | B3–B9、U1–U7 完成；代表负载和证据齐备 | 全覆盖矩阵、独立预期、真实桌面路线、完整新日程、恢复/seek/子路径/容量与性能、首版玩法观察 | `tests/`、`tests/fixtures/m8/`、`scripts/`、`docs/M8_{ACCEPTANCE,VALIDATION,REVIEW}.md`；原计划涉及 CI，但当前禁止改配置，确需变更先问用户 |

来源：[M8_PLAN §5–6](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/M8_PLAN.md#5-后端任务清单gptcodex)。本图不修改任何被冻结合同，也不把原计划文件列表当成自动修改许可。

## 4. M8B 每部分映射及剩余接口

| M8B 设计部分 | 实施归属与依赖 | 当前边界 |
| --- | --- | --- |
| OPENING：1-1初始化、1-2～1-4、2-1对齐 | B6 日程/经济；B8 完整授奖链 | 获批设计，不是已启用开场；完整正常全清到2-1为10G、3级0XP、原三英雄、两组件 |
| ENCOUNTERS：八场PvE、12定义、25实例与招牌 | B7，消费 B6 轮次与 B3 通用机制 | 25%基础暴击/1.4倍只用于新中立定义，不全局改旧守卫或技能暴击授权 |
| LOOT：逐怪载荷、池/权重、自选、失败/终局 | B8，依赖 B5/B6/B7 | 完整路线15永久组件=11自选+4随机，TG临时子件不计入；不新增失败补发/跨轮顺延 |
| ADDENDUM：有限接口/账本/恢复/成长 | B3–B9 各自承接，见下表 | 是已批准 M8B 扩展，不能据此改 B2 冻结正文；实际类型映射/运行/恢复仍分别验收 |
| POLICY：49项首版参数与体验观察 | 编译到 B6–B8，B10 观察，B9 持久化版本 | 设计批准≠历史证据齐全≠实战平衡通过；重点石甲虫回血+暴击、鸟部分击杀收益、1-3/1-4资源时点 |

| IF 任务 | 已有 / 待做 | 消费链 |
| --- | --- | --- |
| IF-REVIEW | 设计已签收 | 约束所有后续实施 |
| IF-DEATH / IF-OPEN / IF-CONE / IF-AS / IF-CRIT / IF-MANA | B3 通用入口、消费者及局部恢复已签收；不要重做 | B7 接真实中立内容，B9 整局恢复 |
| IF-POOL | B4 已有八组件 apiName→定义映射、完整组件池 | B5/B8/B9 复用 |
| IF-GRANT | B5 待交付永久实例ID/库存原子授予与只读查询 | B8 同事务收据/选择解决，B9恢复 |
| IF-ROUND | B6 待交付明确日程与首次准备期冻结事务 | B7/B8/B9；奖励全流程向量等IF-LOOT |
| IF-ENCOUNTER | B7 待编译真实目录/站位/机制 | B8/B9 |
| IF-LOOT | B8 待交付计划/资格/解决/收据/容量/终局与成长 | B9 |
| IF-RESTORE | B9 完整集成待做 | B10 |

来源：[ADDENDUM §8](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/docs/M8B_CONTRACT_ADDENDUM.md#8-接口归属与实施任务)、[B3 状态](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/docs/M8_B3_STATUS.md#L7-L13)、[B4 状态](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/docs/M8_B4_STATUS.md#L9-L20)。增补中“其余12项待实施”和 UI 合同开头“只有类型/16件”是历史冻结时点描述，判断当前实现须结合后续签收与源码，不回写冻结合同。

## 5. UI 可拆开的交付与真实接口

### 5.1 已可用的 B4 接口

[`src/simulation/item-catalog.ts:5–14`](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/src/simulation/item-catalog.ts#L5-L14) 实际导出：

```ts
readItemCatalog(): readonly RuntimeItemCatalogEntry[]
```

- **直接返回数组，不是 `{items: ...}`**；不能照抄旧规划的 `.items`。
- 返回 id/apiName/name/localizationStatus、kind、recipe、effectDescriptions、unique、slotCost、referencePatch、contentVersion、evidenceStatus、conventionIds。
- 组件 `recipe=null`，成装是两组件定义；可做44件图鉴、36配方表、按类型筛选、纯说明浮窗，以及“唯一/占几槽”的声明展示。
- `effectDescriptions` 已从权威内容生成；UI直接展示，不重复计算效果。红Buff/卢安娜保留 `approved-provisional`，中文保留 `temporary-unverified`。
- `contentVersion` 目前是开发期字符串 `s13-14.24b-m8-b4-v3`，不是 B9 最终版本切换已完成；不能改冻结类型或对旧回放套当前目录。
- 这些是**静态目录能力**：显示配方并不等于判断当前两件实例能合成；展示unique/slotCost并不等于当前穿戴合法性已校验。

其他已可用的旧入口须与新冻结查询区分：`ITEM_DEFINITIONS`（`content/items.ts:12`，`content/index.ts:14`重导出）是真实目录；`combineItems(state,aId,bId)`、`equipItem(state,itemId,unitId,slot)`（`match.ts:236–244`）返回 `MatchCommandResult`，UI经 `session.combine/equip`（`match-session.ts:69–70`）调用。`combat-s13.ts:55–62` 现有同名 `readCombatStats(unit,combat)` 只返回AD/AP/攻击间隔/射程/双抗，**不是**冻结的 `readCombatStats(combat): CombatStatsView`；现有 `aggregateStats`/`BattleStats` 也不含完整bySource。泰坦属性投影提前一tick问题仍是另行登记问题，不宣称已修复。

U1/U2已有基础实现，但此次只读研究未找到可将二者分别标记“最终批次签收”的证据；应保留“已有基础UI/未单列签收”的状态，不宣称完全未做或完全完成。窃贼目录的本体150HP/20%暴击已由B4接入，其随机临时装备/实例规则仍等B5。

### 5.2 UI 批次/子集

| UI任务 | 三次合并后可做 | 必须等待 / 完成条件 | 主要UI文件 |
| --- | --- | --- | --- |
| U1/U2 现有操作与身份 | 可整理现有入口、补 B4 新定义身份资源/帮助；只读取现有命令结果 | 不把已有16件图标资源宣称为44件身份全覆盖；缺图保留可识别fallback；资源生成脚本由规则/工具线负责 | `strategy-panel.ts`、`unit-view.ts`、`help-panel.ts`、`s13-asset-manifest.ts`、`public/assets/` |
| U3 静态图鉴/合成表/效果说明 | **可立即做**，使用上面的已签收目录查询；新增28件身份映射可并行 | 不以静态表返回“允许装备/合成”；不虚构实例预览 | 主要 `strategy-panel.ts`、`unit-view.ts`、身份/资源读取器 |
| U3 动态合法性/槽/临时件 | 可先画交互与拒绝文案映射，不接假接口上线 | **等B5**：`previewCombine`、`previewEquip`、`readUnitEquipment` 与真实命令同校验；TG临时ID不可当永久ID传命令 | 同上及session薄适配器；不把其变为规则引擎 |
| U4 第一版后的补齐 | 第一版已有真实状态/部分事件展示，可按已有字段维护 | UR-01/02/03/05后端补交付；UR-06父装备映射等B5/B9；UR-04正式事件及回放等B9；UR-07定向桌面测试由开发线负责 | `combat-status.ts`、`combat-feedback.ts`、`combat-feedback-renderer.ts`、`stats-panel.ts`、`replay-view.ts` |
| U5 轮次/野怪信息 | 可先布局/文案结构；B6交付后先接阶段/轮次/下一步 | `readRoundInfo` 等B6；`readEncounterPreview` 等B7，不从旧ordinal猜新阶段，也不暴露隐藏掉落 | `strategy-panel.ts`、`BoardScene.ts`、`help-panel.ts` |
| U6 奖励/结算 | 布局可先准备；正式数据不能先造 | 等B8 `readLootView`/唯一收据；pending-capacity与retained-terminal不同；M8B待自选不伪装满席、不揭示隐藏fallback或未授予物品，前端不补发或自动换金币 | `strategy-panel.ts`、结算面板/来源展示 |
| U7 版本/回放 | 旧档提示/选择交互设计可先准备 | 等B9 `readCompatibility`、`listLegacyRecords`、`exportLegacy`及replay2；U4回放终验也等B9 | `save-controls.ts`、`replay-panel.ts`、`replay-view.ts`、stats两个UI叶子 |

冻结 [`M8_UI_CONTRACT`](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/docs/M8_UI_CONTRACT.md) 规定语义，但不能当成查询已实现的证明。当前源码中 `previewCombine/previewEquip/readUnitEquipment/readRoundInfo/readEncounterPreview/readLootView` 仍不能列作已交付的运行API。

已有 `planCombine/planEquip` 是内部命令计划器，不等于冻结预览查询：合成会规划分配实例与事件，穿戴并未补齐B5全部phase/unique/slotCost/TG条件；UI不得直接借它们实现另一套校验。已有 Match/session 的 combine/equip 命令仍是操作权威，展示应读 `MatchCommandResult.events`，不是等 `session.combatEvents` 的装备事件。

当前策略面板虽然动态列出配方，但仍用旧 `effects.map(describeEffect)`，并未接 `readItemCatalog()` 的完整说明；不得将这等同 U3 静态子集已完成。原资源目录仍16件装备资源，新增28件需补（[strategy-panel.ts:351–396](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/src/rendering/strategy-panel.ts#L351-L396)）。

### 5.3 UR-U4-01～07 是独立欠项，不混成 B5 已授权施工

- 01：`readCombatStatuses` 纯查询；现有UI直读store的兼容适配不等于运行导出已交付。
- 02：`readCombatStats` 完整bySource；现有BattleStats总数不等于冻结统计视图。
- 03：完整 `packetDamage.outcome` / `cast.receipt` / 每笔 `manaChanged.outcome`；开发期保留旧字段与B9正式结构切换分开。
- 04：引导/分担正式 `activityChanged` 接线，B9/replay2。
- 05：各状态变更路径正式group；兼容无group清理与正式group清理分开验收。
- 06：父永久装备实例→定义/名称映射，B5；历史冻结名称与回放，B9。
- 07：领域真实数据驱动的桌面Chromium定向验证，开发线编写；不让Claude改tests/CI。

来源：[UI_REQUESTS.md](https://github.com/catfish-xn/cat/blob/f03b81d7cdb5c68df42bbfcbf9492a229a8b0c20/docs/UI_REQUESTS.md)。U4第一版签收保持，不自动把这些需求升级为当前任务或扩大B5范围；排期需用户确认。

## 6. 文件冲突与单一负责人

| 高风险共享面 | 可能同时涉及 | 安排原则 |
| --- | --- | --- |
| `match.ts` / `match-types.ts` / `strategy-types.ts` | B5装备、B6准备期/经济、B8选择/收据/成长、B9恢复 | 主开发线单一owner；第二线交纯模块/API/向量，串行接入，不能同时改同一状态转换 |
| `serialization.ts` / `strategy-snapshot.ts` / `m8/restore.ts` | B5临时装备、B6日程、B7中立、B8账本、B9整局 | 每批自己完成新增态局部校验和往返，再由B9统合；不得推迟到B9才发现早期数据不可保存 |
| `content/index.ts` / `content/source-manifest.ts` / 版本常量与digest | B5装备修订、B6日程经济、B7敌阵、B8掉落、B9正式版本 | 主线统一管理版本发布；第二线不独立抢改版本/digest，合入时按最终实际内容生成，不随意取一边版本号 |
| `combat-s13*.ts` / `combat-types.ts` / `m8/s13-*` | B7内容挂载、U4事件欠项、后续英雄机制 | B3已签收通用机制优先复用；预先划分唯一owner与有限接点，避免以装备/英雄名打补丁 |
| `inventory.ts` / `upgrades.ts` / `rewards.ts` | B5实例分配、B8永久授予与成长谱系 | 先签IF-GRANT，再接B8，唯一ID/收据事务由Match管理 |
| UI共有`strategy-panel.ts`/`unit-view.ts`/`BoardScene.ts` | U3/U5/U6 与U4后续 | Claude内部也要分批接线，不让父/Codex同时改这些视觉文件 |

实际当前约束不能漏掉：`round-schedule.ts:4–29` 仍旧35轮/旧起手与序号推阶段；`content/index.ts:37–45` digest包含日程/经济/敌阵且仍硬编码35；`serialization.ts:182`限制35轮；`src/m6/limits.ts:3`与`application.ts:104`仍30战容量。B6只改日程不够，局部恢复与B9的33战容量必须配套。33战模型扩展不是放宽1MiB/1.5MiB等性能门禁。

## 7. 建议顺序：一条主线 + 用户手动第二 Codex + Claude UI

1. **先完成当前合并和H1已授权诊断**。H1同机性能采样时不要并发完整浏览器/性能负载；其诊断不顺手修B5或门禁。
2. **下一轮经用户批准后，主线B5；第二Codex先做B6隔离纯模块；Claude做U3静态子集/新增身份资源。** 第二线明确禁止改Match、serialization、content/index版本等主线owner文件；可交显式日程/经济模块与独立向量，正式接线等交接。
3. B5签收后，Claude补U3动态操作；主线接B6共享入口并验收，第二Codex准备B7已批准中立目录/阵型与机制向量。B7核心挂载和存档改动继续单owner串行。
4. B6/B7具备后，Claude接U5；主线B8。第二线可做B9旧M7只读识别/导出骨架，避免与主线同改序列化/活动存储。B6完整开场收益联调在此阶段完成。
5. B8后Claude接U6；主线统一B9，Claude接U7/U4回放终验；最后B10全线集成。版本/digest、恢复和性能门禁保持唯一权威。

这是减少共享文件干扰的建议，不是把硬依赖人为变成“必须全部串行”，也不承诺日期。第二Codex由用户手动启动，本文没有创建其任务。文件owner若要变更，先明确交接的SHA、接口与不改路径。

## 8. 不随计划放开的边界

冻结 `src/simulation/m8/{contracts,ui-contracts,equipment}.ts`、`docs/M8_RULES.md`、`docs/M8_UI_CONTRACT.md` 及G12/其测试不得修改。新增的M8B有限实现应从批准增补映射到可编辑模块；若实际接线确需改冻结文件，先报用户，不偷偷扩大。

不改D1–D6、独立RNG、protocol2、失败原子性、击杀作废/不顺延；数值来源优先级14.24b补丁 > 14.24补丁 > 14.24 effects > 14.23，desc定语义/effects定数值。只做桌面Chromium，不新增移动端。旧合同/计划中的历史措辞在此作现状校正，不改冻结原文。所有正式实施、合并和超出当前排期的修复仍按用户授权进行。
