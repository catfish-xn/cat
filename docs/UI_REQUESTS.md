# 界面数据需求（Claude → Codex）

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付方、缺少的内容、界面当前替代做法和验收条件。界面不自行计算规则。

> 本分支 `feat/m8-u3-static` 从 `feat/m8-b0-baseline@83746ca` 新建，该基线尚未包含 U4（`feat/m8-u4@5778cab`）及其 UR-U4-01～07。两条分支合并时本文件会出现 add/add 冲突，按章节保留双方内容即可（U4 章节在前，U3 章节在后）。

## U3 静态部分：装备图鉴、合成表、效果说明

数据来源：B4 `readItemCatalog()`（`src/simulation/item-catalog.ts`，直接返回数组），44 件（8 组件 / 36 成装），`contentVersion = s13-14.24b-m8-b4-v3`。界面原样展示 `effectDescriptions`，展示 `unique`、`slotCost`、`evidenceStatus`、`localizationStatus`、`conventionIds`；不判断当前实例能否合成或装备。

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

### UR-U3-05 动态合法性与临时装备（P2，等 B5）

- 需要：`previewCombine`、`previewEquip`、`readUnitEquipment` 运行实现（冻结类型见 `ui-contracts.ts`），与公开命令同一校验器。
- 当前状态：U3 静态图鉴与合成表只展示配方，文案注明“不代表当前可合成 / 可装备”。**既有 U1 行为**：策略面板“合成”按钮仍按静态配方匹配决定是否可点，最终以 `session.combine` 结果为准；本次未扩大该逻辑，也未使用 `planCombine/planEquip`。B5 交付后改为读 `previewCombine(...).allowed/reason`，装备槽改读 `previewEquip`。
- 验收：B5 交付后，拒绝组合（含 `same-item`、`unique-conflict`、`exclusive-slots`、`temporary-item`）在点击前显示后端原因，与命令拒绝一致。

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
