# 强化池 Batch 5：Batch 4 未闭合组逐条缺口核查（2026-10-25）

基线：`codex/v23-b4gaps`，HEAD `0797f3fe6fbf8ead34fc256edbdef99aceb98b31`。本次为 **Codex 文档审计**。任务文字称13组，但当前计划逐项核对实际为12组（10组“部分”＋2组“不完整”）；以文件为准，不虚构第13组。只核对 `AUGMENT_BATCH4_PLAN.md` 标为“部分／不完整”的 **12组、86条**；不纳入已标完整的组及HR变体，不以旧基线的未实现总数代替本次范围。没有联网、没有改规则/数值/保存格式、没有开放任何强化。

## 分类和证据口径

- **现已完整（资料层）：4条**。该条效果所需专属数值与触发行为有本地原文；不等于代码已实现，也不声称原服所有交互/随机执行均已认证。通用命令失败原子性、唯一收据、已有经济/装备事件继续沿用项目原约定。
- **需要项目约定：59条**。基础效果有源，剩余是本项目必须明确的时序、边界或当前领域模型的适配；每条给出具体**用户提案**，登记为 P（2026-10-25），本任务只决定推荐方案，**未将提案实施或当作历史事实**。涉及缩小类别/选秀抽象的提案尤其不是原版还原认证。
- **需要外部研究：23条**。缺核心曲线、奖励/角色映射、召唤面板或继承执行；不能用排序、等权或其它赛季的数据假装补齐。逐条列出准确的下一次研究对象，本次不执行联网研究。

“未找到”指下列本地语料内未取得足以支持结论的证据，不证明服务端没有该机制。原始 `null`、缺省 `mValue`、匿名hash分别保留，不解释为0、不猜字段含义。14.24目录名不保证覆盖全部14.24b热修；S13后期、S14、HR/PBE仅作线索，不回填14.24b。

每条“已有原文／字段”给出精确的**文件＋零基数组索引＋apiName＋key**；“原计划缺口／本次细化”与“本地补查结果”区分已找到的数值和仍缺的执行。阶段可选性不是本次主任务；已知的后期阶段差异单独提示，不据此改变当前候选池。

## 本地来源索引

以下简写均相对于 `/home/aiapps/workspace/`，没有复制或修改原研究文件。条目内 `A.effects` / `A.description_*` **只指该条apiName所在数组记录**，不是全文件搜索命中即算补证。

| 简写 | 本地文件或目录 | 用途与限制 |
|---|---|---|
| A | `augments-research-2026-10-23/data/augments-14.24.json`；同包 `data/map22-augment-item-nodes.json`、`data/selection-augment-fields.json`、`report.zh-CN.md`、`catalogue.zh-CN.md` | 312条原目录、效果与双语描述；重复目录和原件不是多个独立运行证据 |
| M | `augment-crossversion-research-2026-10-24/raw/common/14.24-map22.bin.json` | 完整原始map22；`M.{hash}`表示顶层对象键；有表不等于已获得调用脚本 |
| X | `augment-crossversion-research-2026-10-24/` | `report-zh.html`、`unknowns.json`、`excerpts/rewards/`、`excerpts/clones_loot/`和`excerpts/stage-audit/`；区分14.24和后期/S14 |
| V | `s13-missing-values-research-2026-10-24/` | `report.zh-CN.md`、`data/claims-index.json`与字段摘录；B1星夜、B3魔像、C2复制、C3.3辛吉德及A5/A7奖励缺口 |
| N | `anvil-research-2026-10-23/` | `data/anvil-data-14.24.json`、`data/carousel-data-14.24.json`、`candidate-pools.md`、`report.zh-CN.md`；池成员不能代替强化专属路由 |
| B | `black-market-research-2026-10-23/` | `data/item-definitions-14.24.json`、`black-market-research.zh-CN.md`；微光装备本身不证明强化是否转换它 |
| C | `combat-rules-research-2026-10-23/` | `data/combat-14.24-excerpt.json`、`data/stats-14.24-excerpt.json`、`combat-rules.zh-CN.md`；通用暴击/伤害不等于强化专属公式 |
| H | `champion-skills-research-2026-10-23/` | `data/ability-parameters-14.24.json`、`data/geometry-fields-14.24.json`；普通英雄技能不代替强化替换技能 |
| F | `game-flow-ui-research-2026-10-23/` | `data/round-timing-and-streaks-14.24.extract.json`、`research.zh-CN.md`；通用计时/选秀不证明特殊强化边界 |
| S | `control-sion-research-2026-10-24/` | `data/excerpts/cabal-trait.json`、`report-zh.md`；赛恩本体及羁绊参数不补初始三英雄抽样 |
| T | `s13-trait-mechanics-research-2026-10-24/` | `data/experiment-14.24.excerpts.json`、`REPORT.zh-CN.md`；试验品纹章不等于物竞天择牺牲格 |

### 通用装备池的精确定位

各条所称“找到池成员”统一指 `N.data/anvil-data-14.24.json` 以下key；这些定义只填成员，**不填强化专属路由、权重、重复限制或特殊装备例外**。

| 定义名 | 原始key | 解析条数 |
|---|---|---:|
| `ItemKeyDefinition_COMPONENT_NOSPAT` | `raw_map_objects["{54ee5db1}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_COMPONENT_NOSPAT.entries` | 8 |
| `ItemKeyDefinition_COMPLETEDITEMS` | `raw_map_objects["{2660fe8b}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_COMPLETEDITEMS.entries` | 36 |
| `ItemKeyDefinition_COMPLETEDITEMS_NOGLOVES` | `raw_map_objects["{31f63855}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_COMPLETEDITEMS_NOGLOVES.entries` | 35 |
| `ItemKeyDefinition_ORNNARTIFACTS_SET6` | `raw_map_objects["{3807b70f}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_ORNNARTIFACTS_SET6.entries` | 29 |
| `ItemKeyDefinition_ORNNARTIFACTS_NoGold` | `raw_map_objects["{de82db48}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_ORNNARTIFACTS_NoGold.entries` | 26 |
| `ItemKeyDefinition_ARTIFACTITEMS` | `raw_map_objects["{69830c46}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_ARTIFACTITEMS.entries` | 29 |
| `ItemKeyDefinition_RADIANTITEMS_SET5` | `raw_map_objects["{c3f3f4cd}"].mConstants.Definitions.mValue`；核对 `resolved_pools.ItemKeyDefinition_RADIANTITEMS_SET5.entries` | 36 |

## 覆盖汇总

| 组 | 条数 | 现已完整 | 项目约定提案 | 外部研究 |
|---|---:|---:|---:|---:|
| 强化选项与刷新额度改写 | 4 | 0 | 4 | 0 |
| 商店刷新／购买／场上费用触发 | 8 | 1 | 5 | 2 |
| 装备转换、拆解与替代奖励 | 12 | 1 | 10 | 1 |
| 英雄永久变形、出售及操作限制 | 7 | 0 | 5 | 2 |
| 跨玩家排名、淘汰、选秀资源 | 9 | 0 | 7 | 2 |
| 玩家伤害及生命／战后金币 | 9 | 1 | 8 | 0 |
| 装备选择及后续复制 | 6 | 0 | 4 | 2 |
| 战斗触发永久成长／任务奖励 | 11 | 1 | 9 | 1 |
| 英雄技能替换 | 1 | 0 | 0 | 1 |
| 羁绊战斗增强／召唤 | 6 | 0 | 0 | 6 |
| 开战复制、临时星级及装备分配 | 6 | 0 | 4 | 2 |
| 阶段奖励／特殊商店／等级上限 | 7 | 0 | 3 | 4 |
| 合计 | 86 | 4 | 59 | 23 |

## 逐条核查

### 1. 强化选项与刷新额度改写

#### B5-01 乞亦有择（需要项目约定）

- 身份：`TFT_Augment_BeggarsCanBeChoosers`。
- 已有原文／字段：`A[2].apiName=TFT_Augment_BeggarsCanBeChoosers`，`description_zh_cn`：“你的所有其它强化符文选择获得+3刷新次数。获得7金币。” `effects={"ExtraRolls":3.0,"Gold":7.0}`；原始map22定位为 `A[2].map22_node={4fae52e9}`，对应 `data/map22-augment-item-nodes.json.nodes["{4fae52e9}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：额外3次是共享额度、每槽加1，还是每槽加3；能否反复刷同槽。
- 本地补查结果：A.report.zh-CN.md §4.3 明写“额外三次具体怎样分配给三个按钮……未确认”；A.effects 仅 ExtraRolls=3、Gold=7，未找到分配规则。
- 分类与后续：**需要项目约定**。**P-B5-01（P，2026-10-25，用户提案）**：提案：后续每轮保留每槽原1次，再给该轮共享3次；优先消耗该槽原额度，额外额度可重刷同槽；取得当轮不加。

#### B5-02 威力提升（需要项目约定）

- 身份：`TFT_Augment_PowerUp`。
- 已有原文／字段：`A[48].apiName=TFT_Augment_PowerUp`，`description_zh_cn`：“你的下一个强化符文的位阶提高一阶。” `effects={}`；原始map22定位为 `A[48].map22_node={1280b9f9}`，对应 `data/map22-augment-item-nodes.json.nodes["{1280b9f9}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：下一轮原本已为棱彩时怎么办；是否顺延到再下一轮。
- 本地补查结果：A.description_zh_cn 只说“位阶提高一阶”，effects={}；M 同名节点无上溢分支，未找到。
- 分类与后续：**需要项目约定**。**P-B5-02（P，2026-10-25，用户提案）**：提案：银→金→彩，彩保持彩；下一次选择消耗效果，不顺延、不折金。

#### B5-03 刷新转换（需要项目约定）

- 身份：`TFT_Augment_RerollTransfer`。
- 已有原文／字段：`A[51].apiName=TFT_Augment_RerollTransfer`，`description_zh_cn`：“每1次未使用的强化符文刷新，可获得3次免费商店刷新。获得3金币。  不包含这个强化符文被选择的那个回合。” `effects={"AugmentRerollTracked":1.0,"Gold":3,"ShopRerollToGrant":3.0}`；原始map22定位为 `A[51].map22_node={1aa8e66e}`，对应 `data/map22-augment-item-nodes.json.nodes["{1aa8e66e}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：未用次数按槽还是共享预算计；结算时点、跨轮累计、与额外刷新叠加。
- 本地补查结果：A.effects 的 AugmentRerollTracked=1、ShopRerollToGrant=3 和描述“不包含……被选择的那个回合”填齐兑换率及排除当前轮；未找到叠加和支付次序。
- 分类与后续：**需要项目约定**。**P-B5-03（P，2026-10-25，用户提案）**：提案：只在以后每次强化选择关闭时，对该轮真实剩余额度一次性乘3；不重复计算已消耗额度，奖励加入既有免费商店刷新账本。

#### B5-04 不计代价（需要项目约定）

- 身份：`TFT11_Augment_AtWhatCost`。
- 已有原文／字段：`A[224].apiName=TFT11_Augment_AtWhatCost`，`description_zh_cn`：“立即升到6级并获得4经验值。你无法选择之后的强化符文。” `effects={"Gold":null,"Level":6.0,"XP":4.0}`；原始map22定位为 `A[224].map22_node={4cec9205}`，对应 `data/map22-augment-item-nodes.json.nodes["{4cec9205}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：选择时已达/超过6级的处理；4XP是否仍给；后续选项是否直接跳过。
- 本地补查结果：A.effects Level=6、XP=4、Gold=null；null不是金币0的独立证明。未找到高等级分支。
- 分类与后续：**需要项目约定**。**P-B5-04（P，2026-10-25，用户提案）**：提案：等级不倒退，低于6级补至6后给4XP，已达6级仍给4XP；按既有最高级经验封顶，后续强化节点跳过且不自动选取。

### 2. 商店刷新／购买／场上费用触发

#### B5-05 操纵商店+（需要项目约定）

- 身份：`TFT_Augment_RiggedShopPlus`。
- 已有原文／字段：`A[53].apiName=TFT_Augment_RiggedShopPlus`，`description_zh_cn`：“你的下一次和每4次商店刷新都将是全3费弈子。获得5次刷新。” `effects={"Numrolls":4.0,"Rerolls":5.0}`；原始map22定位为 `A[53].map22_node={2dd088c9}`，对应 `data/map22-augment-item-nodes.json.nodes["{2dd088c9}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“下一次和每4次”计数是否含自然/免费/其他效果刷新、锁店时是否计数，以及共享池不足时的补位。
- 本地补查结果：A.effects Numrolls=4、Rerolls=5 填齐周期和初始免费次数；未找到刷新类别及缺卡回退。
- 分类与后续：**需要项目约定**。**P-B5-05（P，2026-10-25，用户提案）**：提案：取得后所有成功重生成商店均计数，第一次及其后每4次强制3费；锁店未生成不计。缺3费沿现有共享商店空槽政策，不凭空造卡。

#### B5-06 四费增援（需要项目约定）

- 身份：`TFT11_Augment_Reinfourcement`。
- 已有原文／字段：`A[160].apiName=TFT11_Augment_Reinfourcement`，`description_zh_cn`：“你购买的下一个4费弈子将立刻升到2星。获得 12 金币。” `effects={"Gold":12.0}`；原始map22定位为 `A[160].map22_node={c53e99d3}`，对应 `data/map22-augment-item-nodes.json.nodes["{c53e99d3}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：买入直接2星的卡池份数/售价、合星先后；剩余卡不足3份时能否购买。
- 本地补查结果：A.description_zh_cn 明确下一次购买4费直接2星、Gold=12；未找到共享池扣份及合星执行。
- 分类与后续：**需要项目约定**。**P-B5-06（P，2026-10-25，用户提案）**：提案：保留正常买入的一份来源，其余两份按非商店赠送的既有共享池协议处理，先完成升星再合星；不得直接实现为凭空补两份，实施前需确认现有协议可表达。

#### B5-07 商店故障（需要项目约定）

- 身份：`TFT_Augment_ShopGlitch`。
- 已有原文／字段：`A[174].apiName=TFT_Augment_ShopGlitch`，`description_zh_cn`：“在非玩家对战回合期间，你的商店每2.5秒进行一次免费刷新，共持续30秒。” `effects={"RefreshTimer":2.5,"TotalTimer":30.0}`；原始map22定位为 `A[174].map22_node={e4e733aa}`，对应 `data/map22-augment-item-nodes.json.nodes["{e4e733aa}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：30秒从何时起算，含哪些非PvP阶段、暂停/锁店/切阶段边界、首刷在0还是2.5秒。
- 本地补查结果：A.effects RefreshTimer=2.5、TotalTimer=30；F 的回合计时摘录只给通用流程，不给本强化时钟；未找到边界。
- 分类与后续：**需要项目约定**。**P-B5-07（P，2026-10-25，用户提案）**：提案：每个非PvP战斗轮的准备期启用，逻辑时间2500、5000…30000ms各刷新一次；离开准备期即停，不累积到下一轮；锁店期间保留锁定且跳过该次，不补刷。需后续领域逻辑时钟设计，不能新增服务端真实时钟。

#### B5-08 星夜（需要外部研究）

- 身份：`TFT_Augment_StarryNight`。
- 已有原文／字段：`A[183].apiName=TFT_Augment_StarryNight`，`description_zh_cn`：“你商店中的1费和2费弈子有几率成为2星。获得6金币。  当前几率：〔对局动态值〕% 几率随玩家等级提升。” `effects={"Gold":6.0,"{019b80fe}":0.800000011920929,"{020fb2eb}":0.25,"{0d14760d}":2.0,"{4885b8ce}":1.0,"{49c43705}":0.20000000298023224,"{4abd7204}":0.18000000715255737,"{7083c200}":0.30000001192092896,"{99dcb7a2}":0.2199999988079071,"{ca771d21}":0.5}`；原始map22定位为 `A[183].map22_node={b457ac7c}`，对应 `data/map22-augment-item-nodes.json.nodes["{b457ac7c}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：1/2级概率、1费与2费是否实际同率、等级字段到运行抽样的绑定；二星商店卡的卡池份数和购买合星顺序。
- 本地补查结果：V.data/map22-b1-starry-odds.json 两对象 constants.{df085b93}；V.data/b1-hash-decoding.json 的 candidate_label=Level3Odds…Level10Odds 精确哈希匹配，给出18/20/22/25/30/50/80/100%；这只是字段识别。V.report §B1 明确1/2级及分费用执行未确认，不能补0或外推。
- 分类与后续：**需要外部研究**。外研：查14.24/14.24b执行脚本或同等级分费用受控商店录像，确认每级概率及二星卡对共享池的预留/返还/买入规则；区分普通与+版，不以两份配置相同证明执行相同。

#### B5-09 星夜+（需要外部研究）

- 身份：`TFT_Augment_StarryNightPlus`。
- 已有原文／字段：`A[184].apiName=TFT_Augment_StarryNightPlus`，`description_zh_cn`：“你商店中的1费和2费弈子有几率成为2星。获得8金币。  当前几率：〔对局动态值〕% 几率随玩家等级提升。” `effects={"Gold":8.0,"{019b80fe}":0.800000011920929,"{020fb2eb}":0.25,"{0d14760d}":2.0,"{4885b8ce}":1.0,"{49c43705}":0.20000000298023224,"{4abd7204}":0.18000000715255737,"{7083c200}":0.30000001192092896,"{99dcb7a2}":0.2199999988079071,"{ca771d21}":0.5}`；原始map22定位为 `A[184].map22_node={30240fec}`，对应 `data/map22-augment-item-nodes.json.nodes["{30240fec}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：1/2级概率、1费与2费是否实际同率、等级字段到运行抽样的绑定；二星商店卡的卡池份数和购买合星顺序。
- 本地补查结果：V.data/map22-b1-starry-odds.json 两对象 constants.{df085b93}；V.data/b1-hash-decoding.json 的 candidate_label=Level3Odds…Level10Odds 精确哈希匹配，给出18/20/22/25/30/50/80/100%；这只是字段识别。V.report §B1 明确1/2级及分费用执行未确认，不能补0或外推。
- 分类与后续：**需要外部研究**。外研：查14.24/14.24b执行脚本或同等级分费用受控商店录像，确认每级概率及二星卡对共享池的预留/返还/买入规则；区分普通与+版，不以两份配置相同证明执行相同。

#### B5-10 由二生D（需要项目约定）

- 身份：`TFT_Augment_TwoMuchValue`。
- 已有原文／字段：`A[203].apiName=TFT_Augment_TwoMuchValue`，`description_zh_cn`：“上一个对战回合中每登场过2个独特的2费弈子，就会获得1次刷新。获得2个2费弈子。” `effects={"FreeRerolls":1.0,"NumChampsToGrant":2.0,"UnitCost":2.0,"UnitCount":2.0,"augmentselectbonusgold":null,"{10307c7b}":null,"{d5279bbe}":2.0,"{e0965628}":2.0}`；原始map22定位为 `A[203].map22_node={56b9a68f}`，对应 `data/map22-augment-item-nodes.json.nodes["{56b9a68f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“上一个对战”是否含PvE；独特按英雄身份还是实例计；发奖在下一自然轮还是下一PvP。
- 本地补查结果：A.effects FreeRerolls=1、UnitCount=2、UnitCost=2、NumChampsToGrant=2 齐；未找到开战快照及发放边界。
- 分类与后续：**需要项目约定**。**P-B5-10（P，2026-10-25，用户提案）**：提案：按上一次实际战斗开战快照中的不同2费英雄ID计数（含PvE），下一自然轮给floor(数量/2)次；同名多副本只算一名，初始两名按既有随机英雄约定。

#### B5-11 双重目的（现已完整（资料层））

- 身份：`TFT_Augment_DualPurpose`。
- 已有原文／字段：`A[244].apiName=TFT_Augment_DualPurpose`，`description_zh_cn`：“你在每回合首次购买经验值时，获得2金币。每当你购买经验值时，刷新你的商店。” `effects={"goldtogive":2.0}`；原始map22定位为 `A[244].map22_node={63ac6499}`，对应 `data/map22-augment-item-nodes.json.nodes["{63ac6499}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：Batch4未列本条专属缺值；核对首次购买XP回金与每次购买后刷新是否都有源。
- 本地补查结果：A.effects goldtogive=2；A.description_en_us 明写“The first time you buy XP each round”及“Whenever you buy XP, reroll your Shop.”，填齐两个不同触发器。
- 分类与后续：**现已完整（资料层）**。无新增专属约定；成功购买XP使用现有命令及原子失败语义。与其它刷新强化并持的交互须随实现验证，不据此改其规则。

#### B5-12 棱彩门票（需要项目约定）

- 身份：`TFT6_Augment_GachaAddict`。
- 已有原文／字段：`A[277].apiName=TFT6_Augment_GachaAddict`，`description_zh_cn`：“每当你的商店刷新时，你都有45%几率获得1次免费刷新。” `effects={"RerollPercent":45.0}`；原始map22定位为 `A[277].map22_node={da2434fc}`，对应 `data/map22-augment-item-nodes.json.nodes["{da2434fc}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：45%是否也对自然、免费、买XP等刷新判定；获得免费次数是否立即引发递归刷新。
- 本地补查结果：A.effects RerollPercent=45，描述“每当你的商店刷新时”；A.screenshots.md I05 为45%卡面旁证，不给类别/递归；未找到执行。
- 分类与后续：**需要项目约定**。**P-B5-12（P，2026-10-25，用户提案）**：提案：每次真实成功重生成商店独立判定一次，含自然和免费刷新；只增加一次额度，不自动刷新，因此本次不递归。

### 3. 装备转换、拆解与替代奖励

#### B5-13 基础装备自助餐（需要项目约定）

- 身份：`TFT9_Augment_CustomerIsAlwaysRight`。
- 已有原文／字段：`A[11].apiName=TFT9_Augment_CustomerIsAlwaysRight`，`description_zh_cn`：“每当你将要获得一件基础装备时，转而获得1个【基础装备锻造器】。获得1个随机的基础装备。  这个锻造器提供4个选项。” `effects={}`；原始map22定位为 `A[11].map22_node={91ca928f}`，对应 `data/map22-augment-item-nodes.json.nodes["{91ca928f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：自身初始组件是否也转锻造器；法球领取/组件选项/拆解产物是否替换；替换是否再触发自身。
- 本地补查结果：A.description_zh_cn 填齐每件组件替换、初始随机组件和“四个选项”；N 候选池只证明普通组件成员，不证明替换来源边界。未找到。
- 分类与后续：**需要项目约定**。**P-B5-13（P，2026-10-25，用户提案）**：提案：初始自带组件按原文直接给；以后进入玩家库存的新组件统一替换，已持有/移动不替换；锻造器选择结果免再次替换以避免循环。

#### B5-14 精心打造（现已完整（资料层））

- 身份：`TFT_Augment_CraftedCrafting`。
- 已有原文／字段：`A[13].apiName=TFT_Augment_CraftedCrafting`，`description_zh_cn`：“每当你合成一件成装时，获得2次刷新。” `effects={"Rerolls":2.0}`；原始map22定位为 `A[13].map22_node={8d75bde0}`，对应 `data/map22-augment-item-nodes.json.nodes["{8d75bde0}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：核对每次合成的奖励次数及是否另有初始礼物。
- 本地补查结果：A.effects Rerolls=2；描述唯一触发是“每当你合成一件成装”；没有额外初始礼物条款，效果数值/行为齐。
- 分类与后续：**现已完整（资料层）**。无新增专属约定；只对既有真实装备合成事件发一次，不把领取或重铸当成合成。

#### B5-15 精致古董（需要项目约定）

- 身份：`TFT11_Augment_FineVintage`。
- 已有原文／字段：`A[21].apiName=TFT11_Augment_FineVintage`，`description_zh_cn`：“备战席上的成装会在放置4个回合后转化为【辅助装锻造器】。” `effects={"rounds":4.0}`；原始map22定位为 `A[21].map22_node={efca48b5}`，对应 `data/map22-augment-item-nodes.json.nodes["{efca48b5}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：4轮从放入当轮还是下一轮计、装备取出再放回是否重置、成装变换是否继承年龄、PvE/选秀是否计轮。
- 本地补查结果：A.effects rounds=4，A.description；M.{efca48b5}没有计龄脚本。未找到跨回合年龄规则。
- 分类与后续：**需要项目约定**。**P-B5-15（P，2026-10-25，用户提案）**：提案：连续留在库存的成装经过四次后续自然轮入口后转换；离开库存或变换成另一物品即清零，PvE/选秀计轮；年龄来源必须可从现有历史认证，不能本任务新增存档字段。

#### B5-16 潘朵拉的装备（需要项目约定）

- 身份：`TFT6_Augment_PandorasItems`。
- 已有原文／字段：`A[44].apiName=TFT6_Augment_PandorasItems`，`description_zh_cn`：“回合开始时：你备战席上的装备会随机变化。  获得1件随机基础装备。” `effects={"NumComponents":1.0}`；原始map22定位为 `A[44].map22_node={f700da13}`，对应 `data/map22-augment-item-nodes.json.nodes["{f700da13}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：重掷是否保持类别；纹章、锅铲冠冕、神器、辅助装、光明装及工具是否参加；能否变回原装备。
- 本地补查结果：A.description 和 effects 填齐回合开始重掷及初始1组件；N.data/radiant-augments-14.24.json 可证III为直接随机光明，不是五选一。N.candidate-pools.md 提供池定义，未找到本强化全部类别路由与例外。
- 分类与后续：**需要项目约定**。**P-B5-16（P，2026-10-25，用户提案）**：提案：仅重掷库存普通组件和普通可合成成装，分别用现有类别池、允许原样；纹章/冠冕/神器/辅助/光明/工具不变。此为保守项目范围提案，不能宣称原服就是该范围。

#### B5-17 学术研究（需要项目约定）

- 身份：`TFT13_Augment_Academy`。
- 已有原文／字段：`A[70].apiName=TFT13_Augment_Academy`，`description_zh_cn`：“每当你合成一件装备时，转而获得1个【成装锻造器】。该锻造器总是提供一件【皮城学院】装备以及已合成的装备。获得1件随机基础装备。获得1个【拉克丝】和1个【伊泽瑞尔】。” `effects={"NumItems":1.0,"NumOptions":2.0}`；原始map22定位为 `A[70].map22_node={3b9307e7}`，对应 `data/map22-augment-item-nodes.json.nodes["{3b9307e7}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：赞助装三选一的权重；合成物本身已是赞助装时，二选是否重复、如何补位；是否转换特殊成装。
- 本地补查结果：A.effects NumOptions=2、NumItems=1；M 的 TFT13_AcademyItemList0…29 及当前赞助装显示属性证明存在赞助组合，不能证明二选抽样。src/simulation/content/augment-pool-batch2.ts 的 academic-research 禁用原因仍有效；未找到去重执行。
- 分类与后续：**需要项目约定**。**P-B5-17（P，2026-10-25，用户提案）**：提案：普通成装合成后给“原成装＋当前三赞助装中异于它的一件”，赞助候选等权；保证两项不同，特殊成装不转换。初始组件与Lux/Ezreal照源。

#### B5-18 潘朵拉的装备 II（需要项目约定）

- 身份：`TFT9_Augment_PandorasItems2`。
- 已有原文／字段：`A[146].apiName=TFT9_Augment_PandorasItems2`，`description_zh_cn`：“回合开始时：你备战席上的装备会随机变化。  获得2件随机基础装备。” `effects={"NumCompletedItems":null,"NumComponents":2.0}`；原始map22定位为 `A[146].map22_node={96709e6c}`，对应 `data/map22-augment-item-nodes.json.nodes["{96709e6c}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：重掷是否保持类别；纹章、锅铲冠冕、神器、辅助装、光明装及工具是否参加；能否变回原装备。
- 本地补查结果：A.description 和 effects 填齐回合开始重掷及初始2组件；N.data/radiant-augments-14.24.json 可证III为直接随机光明，不是五选一。N.candidate-pools.md 提供池定义，未找到本强化全部类别路由与例外。
- 分类与后续：**需要项目约定**。**P-B5-18（P，2026-10-25，用户提案）**：提案：仅重掷库存普通组件和普通可合成成装，分别用现有类别池、允许原样；纹章/冠冕/神器/辅助/光明/工具不变。此为保守项目范围提案，不能宣称原服就是该范围。

#### B5-19 打捞桶（需要项目约定）

- 身份：`TFT6_Augment_SalvageBin`。
- 已有原文／字段：`A[164].apiName=TFT6_Augment_SalvageBin`，`description_zh_cn`：“立刻获得1件随机成装，并在7个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。” `effects={"NumRounds":7.0}`；原始map22定位为 `A[164].map22_node={5e580973}`，对应 `data/map22-augment-item-nodes.json.nodes["{5e580973}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：非普通合成成装如何拆；临时装备、神器/辅助/光明装备例外；累计PvP从选择当轮算否。
- 本地补查结果：A.description 明确冠冕系和纹章例外，effects NumRounds=7；N 普通成装配方可补普通拆解，但未找到其他类别路由。
- 分类与后续：**需要项目约定**。**P-B5-19（P，2026-10-25，用户提案）**：提案：只拆普通可合成永久成装，特殊装备原样回库存，临时装备不产生组件；选择当轮起按后续已完成PvP累计，满阈值一次给组件。

#### B5-20 打捞桶+（需要项目约定）

- 身份：`TFT8_Augment_SalvageBinPlus`。
- 已有原文／字段：`A[166].apiName=TFT8_Augment_SalvageBinPlus`，`description_zh_cn`：“立刻获得1件随机成装，并在4个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。” `effects={"NumRounds":4.0}`；原始map22定位为 `A[166].map22_node={6ea94f15}`，对应 `data/map22-augment-item-nodes.json.nodes["{6ea94f15}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：非普通合成成装如何拆；临时装备、神器/辅助/光明装备例外；累计PvP从选择当轮算否。
- 本地补查结果：A.description 明确冠冕系和纹章例外，effects NumRounds=4；N 普通成装配方可补普通拆解，但未找到其他类别路由。
- 分类与后续：**需要项目约定**。**P-B5-20（P，2026-10-25，用户提案）**：提案：只拆普通可合成永久成装，特殊装备原样回库存，临时装备不产生组件；选择当轮起按后续已完成PvP累计，满阈值一次给组件。

#### B5-21 狂暴到底（需要外部研究）

- 身份：`TFT_Augment_OopsAllRageblades`。
- 已有原文／字段：`A[221].apiName=TFT_Augment_OopsAllRageblades`，`description_zh_cn`：“你所有当前和未来的成装都会变为能够提供45护甲和魔抗的【鬼索的狂暴之刃】。每2层【鬼索的狂暴之刃】效果提供1%攻击力和法术强度。” `effects={"AttacksPerStack":2.0,"ResistStackValue":45.0,"StackValue":1.0}`；原始map22定位为 `A[221].map22_node={0f6a763d}`，对应 `data/map22-augment-item-nodes.json.nodes["{0f6a763d}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“所有成装”是否含光明/神器/辅助/纹章/冠冕/微光/临时装备；转成特殊鬼索的基础数值、叠层及AD/AP取样和取整。
- 本地补查结果：A.effects AttacksPerStack=2、ResistStackValue=45、StackValue=1 填齐额外双抗和每2层1%数值；M 及B黑市定义只能列现有特殊物品，不给本强化转换矩阵。未找到。
- 分类与后续：**需要外部研究**。外研：查14.24b转换白/黑名单及变换后物品定义；分别验证现有/未来成装、手套临时物品与黑市装备，不以普通鬼索数值补特殊版本。

#### B5-22 神器工厂（需要项目约定）

- 身份：`TFT_Augment_Artifactory`。
- 已有原文／字段：`A[222].apiName=TFT_Augment_Artifactory`，`description_zh_cn`：“每回合开始时，你备战席上的各个成装都将转变为一件随机的神器装备。获得1个【神器锻造器】和2个【拆卸器】。” `effects={"Health":50.0,"NumItems":1.0,"NumRemovers":2}`；原始map22定位为 `A[222].map22_node={76eab04f}`，对应 `data/map22-augment-item-nodes.json.nodes["{76eab04f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：可转换成装类别、神器是否再变、候选权重及是否同物品回滚；Health=50是否被使用。
- 本地补查结果：A.description 填齐每轮开始、1神器锻造器和2拆卸器；effects 另有Health=50但描述无对应。N 神器池29项仅为静态成员，不证明全部用于转换。未找到完整路由。
- 分类与后续：**需要项目约定**。**P-B5-22（P，2026-10-25，用户提案）**：提案：仅普通库存成装转现有已支持神器池，神器/其他特殊类不再转；等权有放回，忽略未绑定描述的Health字段且原值保留；不据孤立常量给队伍加50HP。

#### B5-23 潘朵拉的装备 III（需要项目约定）

- 身份：`TFT9_Augment_PandorasRadiantBox`。
- 已有原文／字段：`A[271].apiName=TFT9_Augment_PandorasRadiantBox`，`description_zh_cn`：“回合开始时：你备战席上的装备会随机变化。  获得1件随机光明武器。” `effects={}`；原始map22定位为 `A[271].map22_node={d0aaffea}`，对应 `data/map22-augment-item-nodes.json.nodes["{d0aaffea}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：重掷是否保持类别；纹章、锅铲冠冕、神器、辅助装、光明装及工具是否参加；能否变回原装备。
- 本地补查结果：A.description 和 effects 填齐回合开始重掷及初始1随机光明装备；N.data/radiant-augments-14.24.json 可证III为直接随机光明，不是五选一。N.candidate-pools.md 提供池定义，未找到本强化全部类别路由与例外。
- 分类与后续：**需要项目约定**。**P-B5-23（P，2026-10-25，用户提案）**：提案：仅重掷库存普通组件和普通可合成成装，分别用现有类别池、允许原样；纹章/冠冕/神器/辅助/光明/工具不变。此为保守项目范围提案，不能宣称原服就是该范围。

#### B5-24 重质不重量（需要项目约定）

- 身份：`TFT_Augment_QualityOverQuantity`。
- 已有原文／字段：`A[279].apiName=TFT_Augment_QualityOverQuantity`，`description_zh_cn`：“正好携带了1件装备的弈子可将该装备升级为光明武器。持有光明武器的弈子们+12%生命值。获得2个【装备拆卸器】。  【窃贼手套】会被视为多件装备。” `effects={"BonusHealth":0.11999999731779099,"MaxUnits":99.0,"NumRemovers":2.0}`；原始map22定位为 `A[279].map22_node={c921ed5b}`，对应 `data/map22-augment-item-nodes.json.nodes["{c921ed5b}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：光明化何时恢复；装备第二件/拆卸后是否回普通；无光明对应的特殊装、临时装备及12%HP应用顺序。
- 本地补查结果：A.effects BonusHealth≈0.12、NumRemovers=2；描述“正好1件”且手套算多件；未找到动态转换/撤销及特殊类行为。
- 分类与后续：**需要项目约定**。**P-B5-24（P，2026-10-25，用户提案）**：提案：每战开场以永久装备数冻结资格，仅普通有光明对应成装临时升级；第二件则下一战失去资格，原物品身份保留；12%HP只给当场持有光明者一次。

### 4. 英雄永久变形、出售及操作限制

#### B5-25 火爆甩卖（需要项目约定）

- 身份：`TFT_Augment_FiresalePlus`。
- 已有原文／字段：`A[22].apiName=TFT_Augment_FiresalePlus`，`description_zh_cn`：“每回合从商店偷取一个随机弈子。获得1金币。” `effects={"Gold":1.0}`；原始map22定位为 `A[22].map22_node={033f4a74}`，对应 `data/map22-augment-item-nodes.json.nodes["{033f4a74}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：偷取时点、锁店/空商店/满席、共享池归属；是否刷新偷走的商店格。
- 本地补查结果：A.effects Gold=1、描述每轮偷一个随机商店弈子；未找到时点及空槽处理。
- 分类与后续：**需要项目约定**。**P-B5-25（P，2026-10-25，用户提案）**：提案：自然商店处理完后从非空槽等权选一个，转移该槽已预留卡并清空槽、不补刷；满席走既有待发/法球；全空不发奖、不改其它槽。

#### B5-26 运力不足（需要项目约定）

- 身份：`TFT11_Augment_OverEncumbered`。
- 已有原文／字段：`A[42].apiName=TFT11_Augment_OverEncumbered`，`description_zh_cn`：“在下一阶段，你只能获得1个备战席栏位。随后，获得3件基础装备。” `effects={"BenchSlots":1.0,"Gold":null,"components":3.0}`；原始map22定位为 `A[42].map22_node={9c17ce21}`，对应 `data/map22-augment-item-nodes.json.nodes["{9c17ce21}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“下一阶段”是当前阶段剩余时间还是下一整个阶段；多余席位已有英雄去向、自动奖励/合星如何挤占。
- 本地补查结果：A.effects BenchSlots=1、components=3、Gold=null，只能确认1栏与3组件，未找到起止阶段及溢出政策。
- 分类与后续：**需要项目约定**。**P-B5-26（P，2026-10-25，用户提案）**：提案：从选择后的下一个阶段开始至该阶段结束限制为1个可用英雄席；原有超额单位保留但不新增，赠送走既有待发；恢复正常席位时给3组件。

#### B5-27 潘朵拉的备战席（需要外部研究）

- 身份：`TFT7_Augment_PandorasBench`。
- 已有原文／字段：`A[43].apiName=TFT7_Augment_PandorasBench`，`description_zh_cn`：“提供2金币。每个回合开始时，处在备战席最右侧3个栏位的英雄们变为随机的同费用英雄。” `effects={"BenchSlots":3.0,"Gold":2.0}`；原始map22定位为 `A[43].map22_node={2344491a}`，对应 `data/map22-augment-item-nodes.json.nodes["{2344491a}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：同费用是单卡费用还是星级折合费用；星级/装备/异常/成长继承、多个槽同时变形与合星次序、共享池缺卡回退。
- 本地补查结果：A.effects BenchSlots=3、Gold=2；描述“随机的同费用英雄”。M.{2344491a}无继承/抽样执行。未找到。
- 分类与后续：**需要外部研究**。外研：查14.24b备战席变形的原始费用/星级映射、装备/异常/永久成长继承和共享池替换执行；验证三槽同步变形后合星顺序。不能只约定排序就宣称该条完整。

#### B5-28 变形重组器（需要外部研究）

- 身份：`TFT6_Augment_Recombobulator`。
- 已有原文／字段：`A[50].apiName=TFT6_Augment_Recombobulator`，`description_zh_cn`：“你棋盘上的弈子们会永久变形为一个比自身高1费的随机弈子(最大5费)。获得2个【装备拆卸器】。” `effects={"NumRemovers":2.0}`；原始map22定位为 `A[50].map22_node={9b8fcd49}`，对应 `data/map22-augment-item-nodes.json.nodes["{9b8fcd49}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：升费变形保留什么：星级、装备、异常、永久成长；6费输入的“最大5费”处理；共享池扣/返、同时合星顺序。
- 本地补查结果：A.description 填齐+1费上限5和2拆卸器；M.{9b8fcd49}没有继承矩阵；未找到这些行为。
- 分类与后续：**需要外部研究**。外研：取14.24b普通/异常绑定/6费实例的变形前后完整记录，核对身份与成长继承及共享池份数；先查星级是否保留，不能用“永久”推定全部继承。

#### B5-29 重启任务（需要项目约定）

- 身份：`TFT_Augment_RestartMission`。
- 已有原文／字段：`A[52].apiName=TFT_Augment_RestartMission`，`description_zh_cn`：“移除你场上和备战席上的所有弈子。获得2个随机的2星3费弈子、3个2星2费弈子和1个2星1费弈子。” `effects={"1Cost":1.0,"2Cost":3.0,"3Cost":2.0,"NumUnits":2.0}`；原始map22定位为 `A[52].map22_node={72df96ec}`，对应 `data/map22-augment-item-nodes.json.nodes["{72df96ec}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：移除是否出售给钱、装备与异常去向；六名奖励能否同名、满席及共享池处理。
- 本地补查结果：A.effects 1Cost=1、2Cost=3、3Cost=2，描述明确均为2星；随机分布/移除后处理未找到。
- 分类与后续：**需要项目约定**。**P-B5-29（P，2026-10-25，用户提案）**：提案：移除不发出售金币，永久装备回库存、原单位绑定效果不转给新单位；按费用目录等权有放回生成六名，沿用已存在的共享奖励/满席协议。

#### B5-30 假装摸鱼（需要项目约定）

- 身份：`TFT_Augment_BRB`。
- 已有原文／字段：`A[86].apiName=TFT_Augment_BRB`，`description_zh_cn`：“你在接下来的3个回合里无法采取任何行动，随后获得2个【成装锻造器】。” `effects={"RoundsToSkip":3.0,"anvils":2.0}`；原始map22定位为 `A[86].map22_node={60616423}`，对应 `data/map22-augment-item-nodes.json.nodes["{60616423}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“任何行动”禁止命令清单；当前轮是否算3轮之一，选秀/强化/自动领取、自动合星与不可操作冲突。
- 本地补查结果：A.effects RoundsToSkip=3、anvils=2；未找到命令白名单与轮计数执行。
- 分类与后续：**需要项目约定**。**P-B5-30（P，2026-10-25，用户提案）**：提案：包含取得后的当前轮在内锁3个自然轮，拒绝玩家经济/布阵/装备/选择命令；允许观察、重连及系统超时选择/正常结算/自动发奖。期满给2成装锻造器，不人为冻结战斗。

#### B5-31 不侦察，不变阵（需要项目约定）

- 身份：`TFT_Augment_NoScoutNoPivot`。
- 已有原文／字段：`A[138].apiName=TFT_Augment_NoScoutNoPivot`，`description_zh_cn`：“参与玩家对战后，弈子无法再回到备战席或出售。每次玩家对战后，参战弈子都会获得20生命值、1.5%攻击力和1.5%法术强度。” `effects={"ADScale":0.014999999664723873,"APScale":1.5,"HPScale":20.0,"MaxUnits":99.0,"{eba92878}":null}`；原始map22定位为 `A[138].map22_node={c6459b1b}`，对应 `data/map22-augment-item-nodes.json.nodes["{c6459b1b}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：参战锁是否含PvE、不可回席/出售是否禁换格和合星；永久成长随合星/变形怎样继承；自动发奖能否越过锁。
- 本地补查结果：A.effects HPScale=20、ADScale≈0.015、APScale=1.5 齐；M.{eef66c94}/.{f28bea4f}仅是HasFought/RoundsFought属性，不证明命令限制。未找到。
- 分类与后续：**需要项目约定**。**P-B5-31（P，2026-10-25，用户提案）**：提案：只按真实PvP开战名单建立锁，允许场内换格/装备及自动合星，拒绝出售/回席；每次实际PvP结束对该名单按既有成长合星协议加20HP/1.5%AD/1.5AP，系统赠送不能出售锁定实例腾位。

### 5. 跨玩家排名、淘汰、选秀资源

#### B5-32 多元化投资（需要项目约定）

- 身份：`TFT_Augment_DiversifiedPortfolio1`。
- 已有原文／字段：`A[15].apiName=TFT_Augment_DiversifiedPortfolio1`，`description_zh_cn`：“每回合，每激活3个非唯一羁绊，就会获得1金币。 获得1金币。  金币加成：〔对局动态值〕” `effects={"GoldRate":1.0,"InstantGold":1.0,"TraitsActive":3.0}`；原始map22定位为 `A[15].map22_node={3efa3b1a}`，对应 `data/map22-augment-item-nodes.json.nodes["{3efa3b1a}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：每轮采样羁绊的时点、非唯一羁绊范围；不满3个是否有余数跨轮、金币是否进入本轮利息。
- 本地补查结果：A.effects TraitsActive=3、GoldRate=1、InstantGold=1，填齐公式与初始奖励；未找到时序/利息执行。
- 分类与后续：**需要项目约定**。**P-B5-32（P，2026-10-25，用户提案）**：提案：每个后续自然轮入口按入轮正式棋盘的非唯一已激活羁绊数给floor(n/3)金，不累计余数；沿既有回合收入冻结/付款次序，不追溯取得轮。

#### B5-33 多元化投资+（需要项目约定）

- 身份：`TFT_Augment_DiversifiedPortfolio2`。
- 已有原文／字段：`A[16].apiName=TFT_Augment_DiversifiedPortfolio2`，`description_zh_cn`：“每回合，每激活3个非唯一羁绊，就会获得1金币。 获得4金币。  金币加成：〔对局动态值〕” `effects={"GoldRate":1.0,"InstantGold":4.0,"TraitsActive":3.0}`；原始map22定位为 `A[16].map22_node={3dfa3987}`，对应 `data/map22-augment-item-nodes.json.nodes["{3dfa3987}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：每轮采样羁绊的时点、非唯一羁绊范围；不满3个是否有余数跨轮、金币是否进入本轮利息。
- 本地补查结果：A.effects TraitsActive=3、GoldRate=1、InstantGold=4，填齐公式与初始奖励；未找到时序/利息执行。
- 分类与后续：**需要项目约定**。**P-B5-33（P，2026-10-25，用户提案）**：提案：每个后续自然轮入口按入轮正式棋盘的非唯一已激活羁绊数给floor(n/3)金，不累计余数；沿既有回合收入冻结/付款次序，不追溯取得轮。

#### B5-34 幸存者（需要项目约定）

- 身份：`TFT_Augment_Survivor`。
- 已有原文／字段：`A[61].apiName=TFT_Augment_Survivor`，`description_zh_cn`：“在3名玩家被淘汰后，获得60金币。” `effects={"Gold":60.0,"PlayersDead":3.0}`；原始map22定位为 `A[61].map22_node={864b5295}`，对应 `data/map22-augment-item-nodes.json.nodes["{864b5295}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：选择前已淘汰是否计数，是否允许死亡玩家领取；多人同轮淘汰与自己淘汰的顺序。
- 本地补查结果：A.effects PlayersDead=3、Gold=60；未找到累计起点及淘汰批次顺序。
- 分类与后续：**需要项目约定**。**P-B5-34（P，2026-10-25，用户提案）**：提案：读取全局累计已淘汰其他席位数，选择时已满足则补发；同轮淘汰先全部确定，存活持有者至多领取一次，已淘汰持有者不发奖。

#### B5-35 餐桌剩菜（需要项目约定）

- 身份：`TFT_Augment_TableScraps`。
- 已有原文／字段：`A[62].apiName=TFT_Augment_TableScraps`，`description_zh_cn`：“在接下来的4个选秀回合后，获得1个未被选走的弈子和其装备。获得1金币。” `effects={"Gold":1.0,"NumStages":4}`；原始map22定位为 `A[62].map22_node={3a97bd73}`，对应 `data/map22-augment-item-nodes.json.nodes["{3a97bd73}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：多名持有者如何分剩余槽/是否复制、存活人数少剩余多的抽样；单人补给无共享剩余资源。
- 本地补查结果：A.effects NumStages=4、Gold=1，文案确认未来4次选秀。N.data/carousel-data-14.24.json 只有候选生成，没有剩余归属。X.excerpts/stage-audit/stage-crosscheck-differences.json 还记录阶段可选性差异，不能借后期归档替14.24。未找到分配执行。
- 分类与后续：**需要项目约定**。**P-B5-35（P，2026-10-25，用户提案）**：提案：只在已有共享选秀模式启用；正常选取全部结束后按seatIndex处理持有者，从尚未分走的槽等权无放回取一；不足则该次不补造、仍消耗一次机会；单人不开放。

#### B5-36 不拘一格（需要项目约定）

- 身份：`TFT9_Augment_YoungAndWildAndFree`。
- 已有原文／字段：`A[67].apiName=TFT9_Augment_YoungAndWildAndFree`，`description_zh_cn`：“你在选秀回合中总能自由移动。获得2金币。” `effects={"Gold":2.0}`；原始map22定位为 `A[67].map22_node={080f6c7e}`，对应 `data/map22-augment-item-nodes.json.nodes["{080f6c7e}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：自由移动在当前“放行后点选”领域模型中的等效权限；是否从arrival开始立即可抢。
- 本地补查结果：A.description_zh_cn 确认自由移动、Gold=2；F 只有一般选秀流程。现行P7没有可移动小小英雄，未找到等效机制。
- 分类与后续：**需要项目约定**。**P-B5-36（P，2026-10-25，用户提案）**：提案：在共享选秀arrival结束时即取得领取资格，保留同一共享槽和原子抢占；单人补给无选秀优先级，不开放。无需规定视觉移动。

#### B5-37 纷争（需要项目约定）

- 身份：`TFT_Augment_Contested`。
- 已有原文／字段：`A[101].apiName=TFT_Augment_Contested`，`description_zh_cn`：“每次玩家对战回合后，每有2名其他玩家在本局游戏中登场了你替补席上最左边的弈子，你就会获得2金币。” `effects={"GoldPerInstance":2.0,"PlayerPerInstance":2.0}`；原始map22定位为 `A[101].map22_node={51515c98}`，对应 `data/map22-augment-item-nodes.json.nodes["{51515c98}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：“其他玩家登场”采样时点、镜像/淘汰玩家、 bench最左为空与多名同名如何计；一组2人余数是否跨轮。
- 本地补查结果：A.effects PlayerPerInstance=2、GoldPerInstance=2，文案按玩家而非单位数；未找到全桌快照执行。
- 分类与后续：**需要项目约定**。**P-B5-37（P，2026-10-25，用户提案）**：提案：本轮PvP开战冻结左侧首个实际英雄及全桌存活玩家阵容，每名其他玩家同名英雄至少一名算1；战后给2×floor(n/2)金，余数不累计；无备战英雄为0。

#### B5-38 冲榜战士（需要项目约定）

- 身份：`TFT11_Augment_ScoreboardScrapper`。
- 已有原文／字段：`A[170].apiName=TFT11_Augment_ScoreboardScrapper`，`description_zh_cn`：“每个回合，如果你的排名在后4位，那么你的弈子们将永久获得1.5%攻击力和法术强度。如果你的排名在前4位，那么你的弈子们将拥有10%额外生命值。” `effects={"BottomHalf":4.0,"LoserBoost":0.014999999664723873,"UpperHalf":4.0,"WinningStatBoost":0.10000000149011612}`；原始map22定位为 `A[170].map22_node={18ff84c7}`，对应 `data/map22-augment-item-nodes.json.nodes["{18ff84c7}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：排名快照/平血排序、少于8人是否仍按前4后4、永久成长授予哪些单位、上半区HP是否永久。
- 本地补查结果：A.effects BottomHalf=4、UpperHalf=4、LoserBoost≈0.015、WinningStatBoost≈0.10；描述只对后半区写“永久”；未找到动态分组执行。
- 分类与后续：**需要项目约定**。**P-B5-38（P，2026-10-25，用户提案）**：提案：沿用已有八席排名顺序，每个后续自然轮入口名次5–8给予当前正式英雄永久1.5%AD/1.5AP，名次1–4获得本轮10%HP；不按剩余人数重分半。

#### B5-39 盗墓者 I（需要外部研究）

- 身份：`TFT_Augment_TombRaider1`。
- 已有原文／字段：`A[190].apiName=TFT_Augment_TombRaider1`，`description_zh_cn`：“从接下来被淘汰的3名玩家留下的成装中选择一件据为己有。” `effects={"NumDead":3.0}`；原始map22定位为 `A[190].map22_node={20e1cd25}`，对应 `data/map22-augment-item-nodes.json.nodes["{20e1cd25}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：可选成装类别、背包还是含棋子装备、候选数量/权重、淘汰装备归还前后采样；同时淘汰排序和无可选装备。
- 本地补查结果：A.effects NumDead=3（I）/9（II）；II描述实际是“每有一位玩家被淘汰”，不能以9推导最多9次。M同名节点无选择表；未找到候选和分配执行。
- 分类与后续：**需要外部研究**。外研：找14.24b盗墓选择界面与淘汰资源回收前后完整记录，验证全量展示还是抽样、特殊装可选性、下3名起点与同时死亡顺序；不得拿普通神器/成装池充候选。

#### B5-40 盗墓者 II（需要外部研究）

- 身份：`TFT_Augment_TombRaider2`。
- 已有原文／字段：`A[299].apiName=TFT_Augment_TombRaider2`，`description_zh_cn`：“每有一位玩家被淘汰，即可选择该玩家的一件成装据为己有。” `effects={"NumDead":9.0}`；原始map22定位为 `A[299].map22_node={1de1c86c}`，对应 `data/map22-augment-item-nodes.json.nodes["{1de1c86c}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：可选成装类别、背包还是含棋子装备、候选数量/权重、淘汰装备归还前后采样；同时淘汰排序和无可选装备。
- 本地补查结果：A.effects NumDead=3（I）/9（II）；II描述实际是“每有一位玩家被淘汰”，不能以9推导最多9次。M同名节点无选择表；未找到候选和分配执行。
- 分类与后续：**需要外部研究**。外研：找14.24b盗墓选择界面与淘汰资源回收前后完整记录，验证全量展示还是抽样、特殊装可选性、下3名起点与同时死亡顺序；不得拿普通神器/成装池充候选。

### 6. 玩家伤害及生命／战后金币

#### B5-41 进攻宣告（现已完整（资料层））

- 身份：`TFT_Augment_CalledShot`。
- 已有原文／字段：`A[7].apiName=TFT_Augment_CalledShot`，`description_zh_cn`：“将你的连胜数设为+4。获得4金币。” `effects={"Gold":4.0,"Streak":4.0}`；原始map22定位为 `A[7].map22_node={a414aaba}`，对应 `data/map22-augment-item-nodes.json.nodes["{a414aaba}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：核对是增加连胜还是直接设值，以及初始金币。
- 本地补查结果：A.effects Streak=4、Gold=4；中英描述均为“设为/Set your win streak to +4”，填齐为覆盖当前连胜而非累加。
- 分类与后续：**现已完整（资料层）**。无新增专属约定；后续连胜收入使用既有经济流程。

#### B5-42 有用之材 I（需要项目约定）

- 身份：`TFT10_Augment_GoodForSomethingSilver`。
- 已有原文／字段：`A[24].apiName=TFT10_Augment_GoodForSomethingSilver`，`description_zh_cn`：“未携带装备的弈子们在阵亡时有50%几率掉落1金币。” `effects={"DropChance":0.5,"Gold":1.0}`；原始map22定位为 `A[24].map22_node={6e026ded}`，对应 `data/map22-augment-item-nodes.json.nodes["{6e026ded}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：未带装备判定时点、临时装备和手套、召唤物/复活多次死亡是否适用；按每人或每战判定。
- 本地补查结果：A.effects DropChance=0.5、Gold=1，文案按未装备弈子阵亡触发；未找到资格与多次死亡执行。
- 分类与后续：**需要项目约定**。**P-B5-42（P，2026-10-25，用户提案）**：提案：每次正式英雄真实死亡、按死亡当刻实际装备（含临时装）为空判定一次50%；排除召唤物/攻击代理，复活后再次死亡另判定。

#### B5-43 午餐钱（需要项目约定）

- 身份：`TFT11_Augment_BloodBank`。
- 已有原文／字段：`A[34].apiName=TFT11_Augment_BloodBank`，`description_zh_cn`：“你每对敌方小小英雄们造成8伤害，就会获得2金币。 (当前：〔对局动态值〕)” `effects={"Damage":8.0,"Gold":2.0}`；原始map22定位为 `A[34].map22_node={41228f0d}`，对应 `data/map22-augment-item-nodes.json.nodes["{41228f0d}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：伤害是否按实际HP扣减/过杀前/护盾前；累计余数、镜像/平局/淘汰与到账时点。
- 本地补查结果：A.effects Damage=8、Gold=2 填齐每8伤害2金；C 仅有通用玩家伤害表，没有本强化计数接口，未找到细节。
- 分类与后续：**需要项目约定**。**P-B5-43（P，2026-10-25，用户提案）**：提案：累计已提交的对敌方实际玩家HP扣减，排除镜像与过杀；每跨8点给2金，余数跨战保留，用既有战后唯一收据。

#### B5-44 巨型泰坦（需要项目约定）

- 身份：`TFT_Augment_TitanicTitan`。
- 已有原文／字段：`A[65].apiName=TFT_Augment_TitanicTitan`，`description_zh_cn`：“使你的当前玩家生命值和最大玩家生命值都提升20。你会在选秀中更早被放出，但速度要慢得多。” `effects={"Heal":20.0}`；原始map22定位为 `A[65].map22_node={af552f1f}`，对应 `data/map22-augment-item-nodes.json.nodes["{af552f1f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：最大HP抬升后的治疗上限与恢复认证；选秀提前多少、移动减速多少，在点选模型中如何表达。
- 本地补查结果：A.effects Heal=20及描述明确当前/最大HP都+20，已填“是否扩最大HP”；M无放行偏移与速度数值。缺的是工程表达及选秀数值，不是20本身。
- 分类与后续：**需要项目约定**。**P-B5-44（P，2026-10-25，用户提案）**：提案：领域当前及最大HP均+20，后续治疗封顶新最大值；选秀只提前一个现有放行批次、不模拟移动速度。此映射无历史认证，原版提前/减速数值仍需外研，不把它写成已补齐。

#### B5-45 前瞻思维（需要项目约定）

- 身份：`TFT_Augment_ForwardThinking`。
- 已有原文／字段：`A[116].apiName=TFT_Augment_ForwardThinking`，`description_zh_cn`：“失去你所有的金币。在6轮玩家对战回合后，收回原来的金币和另外的70金币。  即将收到的金币：〔对局动态值〕” `effects={"BaseGold":70.0,"rounds":6.0,"{8f9a1368}":1.0}`；原始map22定位为 `A[116].map22_node={6fd324c8}`，对应 `data/map22-augment-item-nodes.json.nodes["{6fd324c8}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：失去金币是一次归零还是六战期间持续冻结；后续收入能否消费/生息；归还发生在第六战哪个事务、选择前/后金币基数。
- 本地补查结果：A.effects BaseGold=70、rounds=6、{8f9a1368}=1；描述“失去你所有的金币……收回原来的金币”，未给持续冻结语义，匿名1不证明倍率。未找到。
- 分类与后续：**需要项目约定**。**P-B5-45（P，2026-10-25，用户提案）**：提案：仅选择时把当前可用金币归零并记应返本金，后续经济正常、被移出的本金不计利息；取得后第6次PvP结算一次返本金+70，不持续扣走新收入。

#### B5-46 恶意货币化（需要项目约定）

- 身份：`TFT_Augment_MirroredMonetization`。
- 已有原文／字段：`A[134].apiName=TFT_Augment_MirroredMonetization`，`description_zh_cn`：“获得2金币。接下来的3个回合，敌方弈子在阵亡时会掉落2金币。” `effects={"GoldContained":2,"PercCost":2.0,"rounds":3.0}`；原始map22定位为 `A[134].map22_node={ce87c98c}`，对应 `data/map22-augment-item-nodes.json.nodes["{ce87c98c}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：接下来3轮是否含当前轮/PvE，敌方死亡含召唤物/复活，金币战内拾取还是战后到账。
- 本地补查结果：A.effects GoldContained=2、PercCost=2、rounds=3；描述明确初始2金、每敌人死掉2金，不从PercCost猜费用比例。未找到边界。
- 分类与后续：**需要项目约定**。**P-B5-46（P，2026-10-25，用户提案）**：提案：从取得轮起连续3个自然轮、仅实际战斗中正式敌方英雄每次真实死亡记2金；排除召唤物，复活再死另记，战后统一支付。

#### B5-47 吸血生机（需要项目约定）

- 身份：`TFT_Augment_Dhampyr`。
- 已有原文／字段：`A[206].apiName=TFT_Augment_Dhampyr`，`description_zh_cn`：“为自己回复生命值，治疗值相当于你对敌方小小英雄造成的20%伤害。你的弈子获得12%全能吸血。” `effects={"Omnivamp":0.20000000298023224,"OmnivampStatBonus":0.11999999731779099}`；原始map22定位为 `A[206].map22_node={11ec5008}`，对应 `data/map22-augment-item-nodes.json.nodes["{11ec5008}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：玩家治疗的取整/最大HP、过杀和镜像伤害口径、双边同时伤害/淘汰前后次序。
- 本地补查结果：A.effects Omnivamp≈0.20、OmnivampStatBonus≈0.12，已分清玩家吸血20%和单位全能吸血12%；未找到玩家治疗时序。
- 分类与后续：**需要项目约定**。**P-B5-47（P，2026-10-25，用户提案）**：提案：使用已提交实际敌方玩家HP扣减的20%向下取整，战后伤害完成后给存活持有者治疗、封顶其当前最大HP；镜像不计，不以治疗逆转已经确定的淘汰。

#### B5-48 最小巨人（需要项目约定）

- 身份：`TFT9_Augment_TiniestTitan`。
- 已有原文／字段：`A[297].apiName=TFT9_Augment_TiniestTitan`，`description_zh_cn`：“在每个玩家对战回合后获得2玩家生命值和1金币。你的小小英雄还会移动得更快。” `effects={"Gold":1.0,"Heal":2.0}`；原始map22定位为 `A[297].map22_node={07a0d5b6}`，对应 `data/map22-augment-item-nodes.json.nodes["{07a0d5b6}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：小小英雄加速具体量及点选选秀中的映射；治疗最大HP/淘汰顺序，取得当轮是否有战后奖励。
- 本地补查结果：A.effects Heal=2、Gold=1（+版InitialGold=15）齐；M只有强化节点、无加速常量。F没有本条移动规则。未找到速度数值。
- 分类与后续：**需要项目约定**。**P-B5-48（P，2026-10-25，用户提案）**：提案：取得后的每个真实PvP结算给存活持有者2HP/1金、按已有最大HP封顶；不扩最大HP。当前点选模型不模拟加速，也不额外提前放行。若要还原移动竞速需外研具体速度。

#### B5-49 最小巨人+（需要项目约定）

- 身份：`TFT9_Augment_TiniestTitanPlus`。
- 已有原文／字段：`A[298].apiName=TFT9_Augment_TiniestTitanPlus`，`description_zh_cn`：“在每个玩家对战回合后获得2玩家生命值和1金币。你的小小英雄还会移动得更快。  即刻获得15金币。” `effects={"Gold":1.0,"Heal":2.0,"InitialGold":15.0}`；原始map22定位为 `A[298].map22_node={f1f012aa}`，对应 `data/map22-augment-item-nodes.json.nodes["{f1f012aa}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：小小英雄加速具体量及点选选秀中的映射；治疗最大HP/淘汰顺序，取得当轮是否有战后奖励。
- 本地补查结果：A.effects Heal=2、Gold=1（+版InitialGold=15）齐；M只有强化节点、无加速常量。F没有本条移动规则。未找到速度数值。
- 分类与后续：**需要项目约定**。**P-B5-49（P，2026-10-25，用户提案）**：提案：取得后的每个真实PvP结算给存活持有者2HP/1金、按已有最大HP封顶；不扩最大HP。当前点选模型不模拟加速，也不额外提前放行。若要还原移动竞速需外研具体速度。

### 7. 装备选择及后续复制

#### B5-50 闪若金鳞（需要项目约定）

- 身份：`TFT9_Augment_AllThatShimmers`。
- 已有原文／字段：`A[74].apiName=TFT9_Augment_AllThatShimmers`，`description_zh_cn`：“选择一件可产生金币的神器装备，并获得一个【装备拆卸器】。” `effects={"ArmoryChoiceCount":3.0,"InterestCap":5.0}`；原始map22定位为 `A[74].map22_node={e86aae50}`，对应 `data/map22-augment-item-nodes.json.nodes["{e86aae50}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：生金神器完整候选及与三选一的绑定；InterestCap=5是否覆盖/提高利息上限；权重/重复候选。
- 本地补查结果：新找到 M.{c53ad89b}.mConstants.Definitions.mValue：TFT7_Item_ShimmerscaleGamblersBlade、TFT7_Item_ShimmerscaleMogulsMail、TFT4_Item_OrnnTheCollector 共3项；M.{66e31824}.mConstants.Items.mValue 有5个SHIMMERSCALEITEMS_SET7占位，不能说因此有5选。A.effects ArmoryChoiceCount=3、InterestCap=5；未找到占位裁剪和InterestCap运行调用。
- 分类与后续：**需要项目约定**。**P-B5-50（P，2026-10-25，用户提案）**：提案：三候选固定各显示一次，保留拆卸器与+版4金；不把InterestCap=5写成新的收入覆盖器，沿用既有经济政策。原始字段保留，若将来需改变利息规则，须先补执行证据。

#### B5-51 闪若金鳞+（需要项目约定）

- 身份：`TFT_Augment_AllThatShimmersPlus`。
- 已有原文／字段：`A[75].apiName=TFT_Augment_AllThatShimmersPlus`，`description_zh_cn`：“选择一个生成金币的神器。获得1个【装备拆卸器】和4金币。” `effects={"ArmoryChoiceCount":3.0,"GoldGranted":4.0,"InterestCap":5.0}`；原始map22定位为 `A[75].map22_node={1b08c717}`，对应 `data/map22-augment-item-nodes.json.nodes["{1b08c717}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：生金神器完整候选及与三选一的绑定；InterestCap=5是否覆盖/提高利息上限；权重/重复候选。
- 本地补查结果：新找到 M.{c53ad89b}.mConstants.Definitions.mValue：TFT7_Item_ShimmerscaleGamblersBlade、TFT7_Item_ShimmerscaleMogulsMail、TFT4_Item_OrnnTheCollector 共3项；M.{66e31824}.mConstants.Items.mValue 有5个SHIMMERSCALEITEMS_SET7占位，不能说因此有5选。A.effects ArmoryChoiceCount=3、InterestCap=5；未找到占位裁剪和InterestCap运行调用。
- 分类与后续：**需要项目约定**。**P-B5-51（P，2026-10-25，用户提案）**：提案：三候选固定各显示一次，保留拆卸器与+版4金；不把InterestCap=5写成新的收入覆盖器，沿用既有经济政策。原始字段保留，若将来需改变利息规则，须先补执行证据。

#### B5-52 反响（需要项目约定）

- 身份：`TFT_Augment_Replication`。
- 已有原文／字段：`A[161].apiName=TFT_Augment_Replication`，`description_zh_cn`：“在3件基础装备中选择1件。在接下来的2回合，获得1件该基础装备。” `effects={"Gold":null,"roundsofbonusitems":2.0}`；原始map22定位为 `A[161].map22_node={0d1c53b3}`，对应 `data/map22-augment-item-nodes.json.nodes["{0d1c53b3}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：首次3件组件候选的池、无放回/权重，以及两轮的入轮时点。
- 本地补查结果：A.effects roundsofbonusitems=2，描述明确3选1及接下来2轮复制；N 普通8组件定义可填成员，未找到专属抽样/时序。
- 分类与后续：**需要项目约定**。**P-B5-52（P，2026-10-25，用户提案）**：提案：现有8组件等权无放回选3，选择立即给该组件，后续两个自然轮入口各复制一件；初选与续发各有唯一收据。

#### B5-53 幸运手套（需要外部研究）

- 身份：`TFT7_Augment_LuckyGloves`。
- 已有原文／字段：`A[267].apiName=TFT7_Augment_LuckyGloves`，`description_zh_cn`：“【窃贼手套】总会为你的弈子们提供理想的装备。获得2个【拳套】。在5回合后，获得另1个【拳套】。” `effects={"NumGloves":2.0,"NumRounds":5.0}`；原始map22定位为 `A[267].map22_node={3ca0ce8a}`，对应 `data/map22-augment-item-nodes.json.nodes["{3ca0ce8a}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：英雄角色→理想装备表映射、Tier1/2选择条件、组合抽样权重、双形/推荐变化以及是否影响光明手套。
- 本地补查结果：新找到 M 中11个 LuckyGlovesLootTable_* 表，例如 {459316d0}=AD_Tier1、{48931b89}=AD_Tier2、{1b1ba180}=APCaster_Tier1、{d8ba8470}=Tank_Tier2；每个 mConstants.<序号>.mValue 是具体装备对。{072bb1c0}.mConstants.1.mValue=[TFT_Item_NeedlesslyLargeRod,TFT_Item_RabadonsDeathcap]。它们证明有候选组合，不证明按哪个英雄/阶段调用；未找到完整映射/概率。
- 分类与后续：**需要外部研究**。外研：找14.24b英雄角色与推荐装备路由、Tier1/2阈值及权重；查Support/APNonCaster/ADBruiser等角色缺表时回退，以及与光明手套的关系。不能把11表等权混合称作“理想”。

#### B5-54 幸运手套+（需要外部研究）

- 身份：`TFT7_Augment_LuckyGlovesPlus`。
- 已有原文／字段：`A[268].apiName=TFT7_Augment_LuckyGlovesPlus`，`description_zh_cn`：“【窃贼手套】总会为你的弈子们提供理想的装备。获得3个【拳套】。” `effects={"NumGloves":3.0}`；原始map22定位为 `A[268].map22_node={0f18ebce}`，对应 `data/map22-augment-item-nodes.json.nodes["{0f18ebce}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：英雄角色→理想装备表映射、Tier1/2选择条件、组合抽样权重、双形/推荐变化以及是否影响光明手套。
- 本地补查结果：新找到 M 中11个 LuckyGlovesLootTable_* 表，例如 {459316d0}=AD_Tier1、{48931b89}=AD_Tier2、{1b1ba180}=APCaster_Tier1、{d8ba8470}=Tank_Tier2；每个 mConstants.<序号>.mValue 是具体装备对。{072bb1c0}.mConstants.1.mValue=[TFT_Item_NeedlesslyLargeRod,TFT_Item_RabadonsDeathcap]。它们证明有候选组合，不证明按哪个英雄/阶段调用；未找到完整映射/概率。
- 分类与后续：**需要外部研究**。外研：找14.24b英雄角色与推荐装备路由、Tier1/2阈值及权重；查Support/APNonCaster/ADBruiser等角色缺表时回退，以及与光明手套的关系。不能把11表等权混合称作“理想”。

#### B5-55 交给运气（需要项目约定）

- 身份：`TFT9_Augment_RollTheDice`。
- 已有原文／字段：`A[284].apiName=TFT9_Augment_RollTheDice`，`description_zh_cn`：“获得1个【光明窃贼手套】。每回合装备2件随机的临时光明武器。  光明武器是各个成装的超级加强版。” `effects={}`；原始map22定位为 `A[284].map22_node={94c6ce6f}`，对应 `data/map22-augment-item-nodes.json.nodes["{94c6ce6f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：光明手套临时装备是独立单件抽样还是成对抽样；哪些配对有效、抽样权重及幸运手套覆盖。
- 本地补查结果：A.description 确认给1光明手套、每轮2临时光明。新找到 M.{8f4c3fec} mName=ThiefsGlovesLootTierRadiant，共70个配对；例RTG1=[TFT5_Item_DeathbladeRadiant,TFT5_Item_BlueBuffRadiant]。未找到该表运行绑定与权重，不能把它与全光明池混为一谈。
- 分类与后续：**需要项目约定**。**P-B5-55（P，2026-10-25，用户提案）**：提案：优先复用项目现有光明手套行为，本强化只授予物品，不另写一套随机表；不得把这等同已核实原服70配对概率。与幸运手套交互在后者仍禁用期间不新增行为。

### 8. 战斗触发永久成长／任务奖励

#### B5-56 金色收获（需要项目约定）

- 身份：`TFT13_Augment_AGoldenFind`。
- 已有原文／字段：`A[68].apiName=TFT13_Augment_AGoldenFind`，`description_zh_cn`：“被【异常突变】进化的弈子每完成3次击杀就会掉落2金币。获得10次免费刷新。” `effects={"FreeRerolls":10.0,"GoldPerRequirement":2.0,"NumKillsRequirement":3.0}`；原始map22定位为 `A[68].map22_node={47a69ef8}`，对应 `data/map22-augment-item-nodes.json.nodes["{47a69ef8}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：三次击杀累计范围、异常复制者是否计、召唤击杀/助攻/跨战余数及即时掉金时点。
- 本地补查结果：A.effects NumKillsRequirement=3、GoldPerRequirement=2、FreeRerolls=10；未找到跨战累计及异常归属脚本。
- 分类与后续：**需要项目约定**。**P-B5-56（P，2026-10-25，用户提案）**：提案：只有原始被异常绑定的正式英雄本人完成击杀计数，排除召唤代理/助攻，余数跨战保留；每跨3击杀记2金，战后唯一收据发放，取得立即给10次免费刷新。

#### B5-57 金色炊具（需要项目约定）

- 身份：`TFT_Augment_CookingPot`。
- 已有原文／字段：`A[102].apiName=TFT_Augment_CookingPot`，`description_zh_cn`：“在每回合开始时，所有持有【金锅锅】或【金铲铲】装备的弈子都会给予相距最近的弈子50永久生命值。获得1个【金锅锅】。” `effects={"AbilityPower":1.0,"Health":50.0}`；原始map22定位为 `A[102].map22_node={cf9614a0}`，对应 `data/map22-augment-item-nodes.json.nodes["{cf9614a0}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：最近目标是否排除自身、六角并列、多个锅铲/冠冕派生装备是否叠给、全空和独自一人、50HP是平面还是按星放大。
- 本地补查结果：A.effects Health=50与描述确认每轮开始和初始金锅锅；另AbilityPower=1无描述绑定。未找到目标/类别执行。
- 分类与后续：**需要项目约定**。**P-B5-57（P，2026-10-25，用户提案）**：提案：每个携带原始金锅锅或金铲铲的正式英雄每轮给最近另一正式英雄50平面永久HP一次，多件不倍增，并列按单位ID；没有其它英雄则不发。不据AbilityPower=1额外加AP。

#### B5-58 禁忌魔法（需要项目约定）

- 身份：`TFT13_Augment_Cabal`。
- 已有原文／字段：`A[115].apiName=TFT13_Augment_Cabal`，`description_zh_cn`：“【黑色玫瑰】弈子或【赛恩】每参与击杀3次，【赛恩】就会永久获得1.5%攻击力和10最大生命值。获得3个【黑色玫瑰】弈子。(层数：〔对局动态值〕)” `effects={"NumTakedownsPerStack":3.0,"SionADPercentPerStack":0.014999999664723873,"SionHealthPerStack":10.0}`；原始map22定位为 `A[115].map22_node={1e2173ca}`，对应 `data/map22-augment-item-nodes.json.nodes["{1e2173ca}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：三名初始黑玫英雄的费用/候选/是否不同名/权重；takedown共享、跨战余数和Sion永久成长认证。
- 本地补查结果：A.effects NumTakedownsPerStack=3、SionADPercentPerStack≈0.015、SionHealthPerStack=10齐；S.data/excerpts/cabal-trait.json可证赛恩羁绊存在，不是三英雄抽样表。生产 blocked 指向此缺口；未找到抽样/参与击杀去重执行。
- 分类与后续：**需要项目约定**。**P-B5-58（P，2026-10-25，用户提案）**：提案：从S13黑玫完整英雄目录等权有放回抽3名；每名符合资格的参与者每敌人一次takedown，合并为玩家计数，余数跨战；每满3给Sion下一战永久1.5%AD/10HP，由真实战斗事实认证。

#### B5-59 挖角（需要项目约定）

- 身份：`TFT_Augment_Pilfer`。
- 已有原文／字段：`A[149].apiName=TFT_Augment_Pilfer`，`description_zh_cn`：“每回合，获得你在上一场战斗中首先击杀的那个弈子的一个1星版本。” `effects={"Gold":null}`；原始map22定位为 `A[149].map22_node={d64cb511}`，对应 `data/map22-augment-item-nodes.json.nodes["{d64cb511}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：战斗是否含PvE、召唤/分身/6费能否偷、同tick多死的“首先”、未杀敌及跨轮重复。
- 本地补查结果：A.description 确认上一战首个击杀目标的1星副本；X.report-zh.html的克隆相关章节没有本条全资格清单，未找到。
- 分类与后续：**需要项目约定**。**P-B5-59（P，2026-10-25，用户提案）**：提案：只认上一战第一个死亡的敌方正式商店英雄（六费可入，PvE野怪/召唤物排除），同tick按现有完整死亡事件顺序；下一自然轮给1星副本一次，无合法目标不给。

#### B5-60 狙神之巢（需要项目约定）

- 身份：`TFT13_Augment_Sniper`。
- 已有原文／字段：`A[178].apiName=TFT13_Augment_Sniper`，`description_zh_cn`：“【狙神】们每在相同的初始格战斗过一回合，就会获得+8%伤害增幅 (最多+32%)。获得1个【泽丽】。” `effects={"DamageAmp":8.0,"MaxAmp":32.0}`；原始map22定位为 `A[178].map22_node={19cd2e34}`，对应 `data/map22-augment-item-nodes.json.nodes["{19cd2e34}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：首战是否立即有层；换格、备战席、离场/重买、合星、临时狙神资格如何重置/继承。
- 本地补查结果：A.effects DamageAmp=8、MaxAmp=32，取得给Zeri；src/simulation/content/augment-pool-batch2.ts snipers-nest 禁用原因与此一致；未找到重置执行。
- 分类与后续：**需要项目约定**。**P-B5-60（P，2026-10-25，用户提案）**：提案：首次在某格开战即得8%，连续相同开战格每战+8%至32%；改变开战格或离场后重上从8%起，未参与战斗不加层；合星继承主实例、出售重买清零。

#### B5-61 羁绊追踪者（需要项目约定）

- 身份：`TFT_Augment_TraitTracker`。
- 已有原文／字段：`A[195].apiName=TFT_Augment_TraitTracker`，`description_zh_cn`：“你在首次激活8个非唯一羁绊时，获得6个纹章。” `effects={"NumEmblems":6.0,"NumTraits":8.0}`；原始map22定位为 `A[195].map22_node={7dcae01f}`，对应 `data/map22-augment-item-nodes.json.nodes["{7dcae01f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：首次激活检测时点（准备/开战/战中）、纹章池、6个是否不同名与已有纹章过滤。
- 本地补查结果：A.effects NumTraits=8、NumEmblems=6明确，未找到本条抽样/检测执行；既有P-AG1只确认项目可用22纹章池，不能认证原服本强化分布。
- 分类与后续：**需要项目约定**。**P-B5-61（P，2026-10-25，用户提案）**：提案：在准备期合法命令完成后检查正式棋盘，首次达8个非唯一激活羁绊给现有22纹章池等权无放回6件，不按已有持有过滤，领取一次。

#### B5-62 扭转命运（现已完整（资料层））

- 身份：`TFT13_Augment_Grant6Cost_MissMage`。
- 已有原文／字段：`A[217].apiName=TFT13_Augment_Grant6Cost_MissMage`，`description_zh_cn`：“获得一个【蓝霸符】。在以60金币开始一个回合以及赢下一个玩家对战回合后，获得一个【梅尔】和一个【海克斯科技枪刃】。  这些任务能够以任意顺序完成。” `effects={"RoundGold":60}`；原始map22定位为 `A[217].map22_node={cc3c74fd}`，对应 `data/map22-augment-item-nodes.json.nodes["{cc3c74fd}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：核对本金阈值、胜利条件、完成先后及初始/最终奖励。
- 本地补查结果：A.effects RoundGold=60；description明确“以60金币开始一个回合”且赢一次PvP，两任务任意顺序；初始Blue Buff，完成Mel+Gunblade。没有未绑定的效果数值。
- 分类与后续：**现已完整（资料层）**。无新增专属约定；使用现有入轮金币快照、真实PvP胜利及任务唯一收据；不把开战余额替入轮余额。

#### B5-63 老友幽魂（需要外部研究）

- 身份：`TFT_Augment_GhostOfUnitsPast`。
- 已有原文／字段：`A[253].apiName=TFT_Augment_GhostOfUnitsPast`，`description_zh_cn`：“每当一名己方弈子阵亡，己方当前弈子们和所有未来弈子们将永久获得5生命值、0.8%攻击力或1法术强度，根据阵亡弈子的角色而定。  生命值：〔对局动态值〕 攻击力：〔对局动态值〕% 法术强度：〔对局动态值〕” `effects={"ADPerStack":0.00800000037997961,"APPerStack":1.0,"HealthPerStack":5.0}`；原始map22定位为 `A[253].map22_node={a8483b7a}`，对应 `data/map22-augment-item-nodes.json.nodes["{a8483b7a}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：全部英雄角色→HP/AD/AP映射、无角色/多角色回退；召唤/复活死亡资格与跨战累计继承。
- 本地补查结果：A.effects HealthPerStack=5、ADPerStack≈0.008、APPerStack=1；M.{3ba4450b}/{4fa46487}/{9babee5c}仅给AD/AP/Health玩家显示属性。M的ItemKeyDefinition_CHARACTERROLE_*能列角色成员，不能绑定到三种奖励。未找到完整映射。
- 分类与后续：**需要外部研究**。外研：查14.24b老友幽魂角色映射执行或覆盖各角色的逐次死亡面板记录，特别是坦克/AD斗士/AP斗士/双形/召唤物，确认死亡而非助攻与复活重复计数。

#### B5-64 光荣进化（需要项目约定）

- 身份：`TFT13_Augment_Grant6Cost_Viktor`。
- 已有原文／字段：`A[254].apiName=TFT13_Augment_Grant6Cost_Viktor`，`description_zh_cn`：“获得一个【适应性头盔】。在你升级9个弈子后，获得一个【维克托】和一个【珠光护手】。 (当前：〔对局动态值〕) ” `effects={"NumUpgrades":9.0}`；原始map22定位为 `A[254].map22_node={77129bb0}`，对应 `data/map22-augment-item-nodes.json.nodes["{77129bb0}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：9次“升级弈子”如何计：一次连升两级、初始赠送2星、购买现成2星、战中临时升星是否计；取得前升级是否追溯。
- 本地补查结果：A.effects NumUpgrades=9、description初始Adaptive Helm，完成Viktor+Jeweled Gauntlet；未找到升级事件资格。
- 分类与后续：**需要项目约定**。**P-B5-64（P，2026-10-25，用户提案）**：提案：只数取得后真实永久合星事件，每跨一星计一次，临时升星和直接发/买高星不算；同命令连升分别计，满9只发一次。

#### B5-65 硬性承诺（需要项目约定）

- 身份：`TFT_Augment_HardCommit`。
- 已有原文／字段：`A[258].apiName=TFT_Augment_HardCommit`，`description_zh_cn`：“获得1个随机纹章。现在以及每个阶段开始时，获得该羁绊的一个1星弈子，且该弈子的费用相当于当前阶段数(最多为5)。” `effects={}`；原始map22定位为 `A[258].map22_node={332ec033}`，对应 `data/map22-augment-item-nodes.json.nodes["{332ec033}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：纹章池、每阶段同费用羁绊无英雄时回退，随机是否有放回、共享池耗尽。
- 本地补查结果：A.description 明确立即及每阶段各一个1星、费用等于阶段最多5；effects={}，未找到无匹配费用回退。
- 分类与后续：**需要项目约定**。**P-B5-65（P，2026-10-25，用户提案）**：提案：纹章从现有22池等权取一，先查阶段目标费用；无该费用则找最近较低费用，再较高费用，同池等权；全无合法英雄不补金币。共享池仍走既有奖励协议。

#### B5-66 真心本色（需要项目约定）

- 身份：`TFT13_Augment_Grant6Cost_Warwick`。
- 已有原文／字段：`A[310].apiName=TFT13_Augment_Grant6Cost_Warwick`，`description_zh_cn`：“获得一个【饮血剑】。在你对其他玩家造成35伤害后，获得一个【沃里克】和一个【斯特拉克的挑战护手】。 (当前：〔对局动态值〕) ” `effects={"PlayerDamage":35.0}`；原始map22定位为 `A[310].map22_node={74d2ae85}`，对应 `data/map22-augment-item-nodes.json.nodes["{74d2ae85}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：35玩家伤害含过杀/镜像/平局/取得前伤害否；达标同轮死亡能否领奖。
- 本地补查结果：A.effects PlayerDamage=35，description初始Bloodthirster，完成Warwick+Sterak；C通用伤害规则不定义本任务累计。未找到边界。
- 分类与后续：**需要项目约定**。**P-B5-66（P，2026-10-25，用户提案）**：提案：只累计取得后实际扣减敌方玩家HP的伤害，不含镜像与过杀；存活持有者达35时战后一次发奖，已确定淘汰不领奖。

### 9. 英雄技能替换

#### B5-67 炼金术士（已按项目约定实现并开放）

- 身份：`TFT13_Augment_SingedCarry`。
- 已有原文／字段：`A[35].apiName=TFT13_Augment_SingedCarry`，`description_zh_cn`：“获得1个【辛吉德】。你最强大的那个【辛吉德】无法攻击，但会不断奔跑并留下剧毒踪迹，造成持续魔法伤害。他的技能将始终以自己为目标，提供20%的全能吸血和移动速度。” `effects={"TOOLTIPONLYOmnivamp":20.0}`；原始map22定位为 `A[35].map22_node={55848d10}`，对应 `data/map22-augment-item-nodes.json.nodes["{55848d10}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：毒迹每跳间隔/伤害分摊、碰撞宽度/覆盖形状、重入刷新/叠伤、移动路径/寻敌、云雾寿命与DOT时长关系；AP缩放、持续施法与法力执行细节。
- 本地补查结果：已补数值：V.data/C3-singed-hero.raw.json 顶层{3a8f72f9}.mSpell.mDataValues中HEROSpellBaseDamage=[0,140,210,315,420,0,0]、HERODuration=5、HEROCloudDuration=3、HEROMoveSpeed=250、Duration=4、HEROOmnivamp≈0.2；mSpellCalculations.HEROModifiedDamage为AP缩放、HEROManaPerSec含系数10，mTargetingTypeData.__type=Self。V.report §C3.3支持5秒伤害与主动+250移速4秒；X.unknowns.records[question=9]仍列宽度/跳频/路径未确认。不能把普通技能AttackSpeed/DR常量自动移植。
- 分类与后续：**已按项目约定实现并开放**（2-1 白银；原始标签禁止3-2/4-2）。**P-B5-67 / P-B5-67-EXEC（P，2026-10-27）**：每0.5秒一跳、5秒总伤害平分，宽1格，同格刷新不叠伤，朝最近敌人跑；140/210/315/420的5秒总量与每秒回蓝10×当前攻速为**已证实**，跳频、分摊、宽度、刷新、路径和离散执行为**约定**，没有冒用社区推测。实现位于 `content/augment-pool-batch5-r4.ts` / `augment-pool-batch5-r4*.ts`；定向数值、公共命令、真实八席/选秀房间、存档往返与篡改拒绝见 `tests/augment-pool-batch5-r4*.test.ts` / `tests/server/augment-pool-batch5-r4-room.test.ts`。

### 10. 羁绊战斗增强／召唤

#### B5-68 空战（需要外部研究）

- 身份：`TFT13_Augment_Firelight`。
- 已有原文／字段：`A[73].apiName=TFT13_Augment_Firelight`，`description_zh_cn`：“在【野火帮】弈子们开始一次【野火帮】冲刺时，会获得9%攻击力和9法术强度。他们在该战斗中每移动一格还会获得另外的3%。获得1个【刀疤】和1个【泽丽】。” `effects={"Bonus":3.0,"FirelightBonusAD":0.09000000357627869,"FirelightBonusAP":9.0,"{445a9cb6}":99.0}`；原始map22定位为 `A[73].map22_node={57fc3415}`，对应 `data/map22-augment-item-nodes.json.nodes["{57fc3415}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：每格3%是对初值还是累积、AD与AP各如何加；普通移动/冲刺/传送如何计格，重复起飞是否重叠9%/9AP。
- 本地补查结果：A.effects FirelightBonusAD≈0.09、FirelightBonusAP=9、Bonus=3、匿名{445a9cb6}=99；未找到每格算法，99不能直接认作层数上限。生产aerial-warfare禁用原因仍有效。
- 分类与后续：**需要外部研究**。外研：查14.24b野火移动事件/强化执行，取至少一次普通移动、羁绊冲刺和传送前后AD/AP变化，确认加法/乘法、叠层上限及刷新时点。

#### B5-69 战利品爆炸（需要外部研究）

- 身份：`TFT13_Augment_Ambusher`。
- 已有原文／字段：`A[132].apiName=TFT13_Augment_Ambusher`，`description_zh_cn`：“【伏击专家】击杀敌人时有几率掉落战利品，掉落几率受益于暴击几率。所获战利品的价值也可以触发暴击，从而提供更多战利品。获得1个【卡蜜尔】和1个【爆爆】。” `effects={"{51972fee}":2.0,"{a59e2760}":0.5,"{c209103c}":0.10999999940395355,"{ca332ec1}":0.5,"{d89481f4}":1.75}`；原始map22定位为 `A[132].map22_node={5280d1b0}`，对应 `data/map22-augment-item-nodes.json.nodes["{5280d1b0}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：暴击率→掉落概率公式、奖励表和各权重、掉落暴击倍率/递归上限、击杀/召唤与拾取资格。
- 本地补查结果：A.effects 只有匿名{51972fee}=2、{a59e2760}=0.5、{c209103c}≈0.11、{ca332ec1}=0.5、{d89481f4}=1.75；C基础暴击25%/140%不是此强化掉落公式；未找到可用绑定。
- 分类与后续：**需要外部研究**。外研：找14.24b伏击专家专属战利品表与暴击计算脚本，逐项解释匿名字段并核对额外战利品是否还能暴击；不能直接把0.11填作固定掉率。

#### B5-70 爆蓝之城（需要外部研究）

- 身份：`TFT13_Augment_Rebel`。
- 已有原文／字段：`A[144].apiName=TFT13_Augment_Rebel`，`description_zh_cn`：“每场对战中的前5个【蓝发小队】阵亡时，召唤该弈子的一个比自身低一星级、生命值少400的版本。获得1个【阿卡丽】和1个【艾瑞莉娅】。” `effects={"NumOfUnits":5.0,"ReducedHealth":400}`；原始map22定位为 `A[144].map22_node={f736f8b5}`，对应 `data/map22-augment-item-nodes.json.nodes["{f736f8b5}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：1星死亡后的低一星是否仍生成、最低HP及扣400顺序；装备/异常/永久成长/强化/羁绊继承、复活/复制再触发及落格冲突。
- 本地补查结果：A.effects NumOfUnits=5、ReducedHealth=400，已填数量和扣血；X/V关于通用复制体继承也未确认，不能转用为此条继承矩阵。未找到。
- 分类与后续：**需要外部研究**。外研：找14.24b不同星级/低生命蓝发死亡生成记录，确认复制体星级下限、HP计算与继承、是否占5次名额及可否递归。

#### B5-71 物竞天择（需要外部研究）

- 身份：`TFT13_Augment_Experiment`。
- 已有原文／字段：`A[188].apiName=TFT13_Augment_Experiment`，`description_zh_cn`：“【试验品】弈子们获得12%生命值并提供一个特殊格子。这个格子内的【试验品】弈子在战斗开始时会被击杀，从而将其【试验品】加成提供给其它的试验格。获得3个【试验品】弈子。” `effects={"Health":0.11999999731779099,"{1b889d1c}":100.0}`；原始map22定位为 `A[188].map22_node={8cb6ab8c}`，对应 `data/map22-augment-item-nodes.json.nodes["{8cb6ab8c}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：额外牺牲格的位置/选择/空格与非法格处理；被牺牲单位的实验加成具体传播到谁、何时；是否算击杀/死亡、装备/异常实验复制效果。
- 本地补查结果：A.effects Health≈0.12、匿名{1b889d1c}=100，未解释100；T.data/experiment-14.24.excerpts.json与REPORT只填普通试验格/纹章分身基础参数，不定义额外牺牲格；未找到。
- 分类与后续：**需要外部研究**。外研：找14.24b物竞天择格子布局和开战牺牲执行，核对3/5/7档传播对象与装备/异常交互；不能用试验品纹章分身60%HP当牺牲规则。

#### B5-72 虚空召唤者（需要外部研究）

- 身份：`TFT13_Augment_Visionary`。
- 已有原文／字段：`A[208].apiName=TFT13_Augment_Visionary`，`description_zh_cn`：“战斗期间，【先知】们每消耗275法力值，就会召唤一个虚灵，至多至5个虚灵。获得1个【芮尔】和1个【莫甘娜】。  虚灵拥有400-600生命值(基于阶段)。” `effects={"Mana":275.0,"MaxVoidlings":5.0,"Stage2Health":400.0,"Stage3Health":450.0,"Stage4Health":500.0,"Stage5Health":550.0,"Stage6Health":600.0,"{3bc62dd2}":60.0}`；原始map22定位为 `A[208].map22_node={55875747}`，对应 `data/map22-augment-item-nodes.json.nodes["{55875747}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：虚灵AD/攻速/双抗/射程/技能/移动、出生格和无空格回退；275法力是全队共享还是逐人、超额余数、5只是累计还是同时存活上限；阶段7+HP。
- 本地补查结果：A.effects Mana=275、MaxVoidlings=5、Stage2…6Health=400/450/500/550/600；匿名{3bc62dd2}=60不等于已证实AD。C通用单位面板与M.TFT_Voidspawn身份不是先知召唤实例定义，未找到完整数值/出生绑定。
- 分类与后续：**需要外部研究**。外研：查14.24b先知虚灵专用角色/生成覆盖脚本，取得各阶段全属性和出生搜索顺序，核实耗蓝聚合方式、死亡后是否释放名额及6阶段以后生命封顶。

#### B5-73 虚空虫群（需要外部研究）

- 身份：`TFT_Augment_Voidborne`。
- 已有原文／字段：`A[305].apiName=TFT_Augment_Voidborne`，`description_zh_cn`：“获得1个【兹若特传送门】，并且每11个玩家战斗回合后再获得1个。【兹若特传送门】的虚灵获得40%攻击速度和40%全能吸血。” `effects={"BonusAS":0.4000000059604645,"BonusOmnivamp":0.4000000059604645,"Numberofcombats":11.0}`；原始map22定位为 `A[305].map22_node={62522d29}`，对应 `data/map22-augment-item-nodes.json.nodes["{62522d29}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：兹若特虚灵全属性/阶段或星级成长/技能与出生格；每11战计数起点；与先知虚灵是否同一模板。
- 本地补查结果：A.effects BonusAS≈0.4、BonusOmnivamp≈0.4、Numberofcombats=11齐；M.{ca7a3d7e}只是TftShopData身份，研究目录没有虚灵角色专用导出文件，未找到完整战斗属性及出生执行。
- 分类与后续：**需要外部研究**。外研：找14.24b兹若特传送门生成单位及覆盖表、攻击/双抗/射程/成长与无空格策略，再验证额外40%AS/40%全能吸血；禁止拿先知HP400–600替代。

### 11. 开战复制、临时星级及装备分配

#### B5-74 克隆设施（需要外部研究）

- 身份：`TFT_Augment_CloningFacility`。
- 已有原文／字段：`A[98].apiName=TFT_Augment_CloningFacility`，`description_zh_cn`：“强化棋盘中心的一个格子。召唤格子上弈子的一个复制体，它拥有70%生命值，且法力消耗提升20%。” `effects={"HealthPercent":0.699999988079071,"ManaPercent":0.20000000298023224,"{4074ec36}":2.0,"{d47f9a80}":4.0}`；原始map22定位为 `A[98].map22_node={53a0a5de}`，对应 `data/map22-augment-item-nodes.json.nodes["{53a0a5de}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：强化格坐标系、空格和新复制体落格/满格回退；星级/装备/异常/羁绊/成长继承及羁绊计数；70%HP按何时属性计算、法耗+20%取整。
- 本地补查结果：A.effects HealthPercent≈0.7、ManaPercent≈0.2齐；V.data/C2-clone-config.raw.json及data/clone-coordinate-hash-candidates.json只给HexRow=2/HexCol=4候选，不能直接转本项目坐标。V.data/claims-index.json的C2-inheritance/C2-position与X.unknowns question=5明确未确认。
- 分类与后续：**需要外部研究**。外研：查14.24b克隆格显示到逻辑坐标映射、创建脚本与属性继承矩阵，受控测试空格/拥塞/异常/手套；不以IsClone属性或永久复制bug修复代替正常行为。

#### B5-75 月光（需要项目约定）

- 身份：`TFT_Augment_Moonlight`。
- 已有原文／字段：`A[137].apiName=TFT_Augment_Moonlight`，`description_zh_cn`：“战斗开始时：1个随机的1费弈子在该回合中升为3星，并获得25%攻击力和25法术强度。 ” `effects={"ADBonus":0.25,"APBonus":25.0,"ItemBonus":null,"NumUnits":1.0,"{51b72188}":null}`；原始map22定位为 `A[137].map22_node={df8a297e}`，对应 `data/map22-augment-item-nodes.json.nodes["{df8a297e}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：没有1费时怎么办、已有3/4星能否被选而降星；随机候选含备战席否、临时星级与装备/异常/成长计算先后。
- 本地补查结果：A.effects NumUnits=1、ADBonus=0.25、APBonus=25，描述随机1费临时3星；未找到候选过滤与无目标分支。
- 分类与后续：**需要项目约定**。**P-B5-75（P，2026-10-25，用户提案）**：提案：从开战正式上场且低于目标星级的1费英雄等权选一，无则不触发；只改本战星级属性、保留原实例装备/异常，25%AD与25AP在临时升星后按既有属性管线加。

#### B5-76 拾荒者（需要项目约定）

- 身份：`TFT_Augment_Scavenger`。
- 已有原文／字段：`A[169].apiName=TFT_Augment_Scavenger`，`description_zh_cn`：“每次对战中被击杀的前5名敌方弈子会为你的队伍中的一个弈子提供一件临时成装。” `effects={"NumDeaths":5.0}`；原始map22定位为 `A[169].map22_node={d17d3d9d}`，对应 `data/map22-augment-item-nodes.json.nodes["{d17d3d9d}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：前5次敌人死亡是否含召唤/复活/野怪；临时成装池、接收者满装/无空位、选择权重和事件顺序。
- 本地补查结果：A.effects NumDeaths=5只填触发额度；N普通成装池可列成员，但未找到此强化接收者及抽样/溢出执行。
- 分类与后续：**需要项目约定**。**P-B5-76（P，2026-10-25，用户提案）**：提案：仅前5个敌方正式英雄的首次真实死亡，按完整事件顺序；临时物品从现有普通成装池等权抽，接收者在存活有装备空位的正式友军中等权，无人可接则本次不发；临时物品不转永久。

#### B5-77 高级月光（需要项目约定）

- 身份：`TFT_Augment_GreaterMoonlight`。
- 已有原文／字段：`A[256].apiName=TFT_Augment_GreaterMoonlight`，`description_zh_cn`：“战斗开始时：1个随机的1费弈子在该回合中升为4星，并获得5%攻击力和5法术强度。” `effects={"ADBonus":0.05000000074505806,"APBonus":5.0,"ItemBonus":null,"NumUnits":1.0,"{51b72188}":1.0}`；原始map22定位为 `A[256].map22_node={9510dc02}`，对应 `data/map22-augment-item-nodes.json.nodes["{9510dc02}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：无1费、已有4星、候选范围及临时4星如何覆盖；与月光或其它升星并持顺序。
- 本地补查结果：A.effects NumUnits=1、ADBonus≈0.05、APBonus=5，description明确临时4星；匿名{51b72188}=1不能单独解释成执行优先级；未找到边界。
- 分类与后续：**需要项目约定**。**P-B5-77（P，2026-10-25，用户提案）**：提案：按月光相同上场/低于目标星级过滤，等权选一，无则不触发；更高目标星级先处理，保留永久星级不变，额外5%AD/5AP按既有管线生效。

#### B5-78 镜廊（需要外部研究）

- 身份：`TFT_Augment_HallOfMirrors`。
- 已有原文／字段：`A[257].apiName=TFT_Augment_HallOfMirrors`，`description_zh_cn`：“战斗开始时：你的前排的所有弈子都会成为最中间弈子的复制体。复制体拥有100%的原生命值，并且造成的伤害降低40%。” `effects={"DamagePenalty":0.4000000059604645,"HealthRatio":1.0}`；原始map22定位为 `A[257].map22_node={5659a8ff}`，对应 `data/map22-augment-item-nodes.json.nodes["{5659a8ff}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：前排索引、最中间距离并列、无前排时回退；源/目标星级、生命、装备、异常、羁绊和成长继承，伤害减40%的作用范围。
- 本地补查结果：A.effects HealthRatio=1、DamagePenalty≈0.4齐；V.data/clone-marker.excerpt.json的IsClone布尔标记不定义算法；V.data/claims-index.json C2-inheritance/C2-position仍未确认。X中后期S13模板格和S14修复不可作14.24b完整继承证据。
- 分类与后续：**需要外部研究**。外研：查14.24b镜廊变形执行及棋格选择，用前排偶数/空中心/无前排验证中间规则；逐类记录装备、异常、羁绊计数及伤害来源是否减伤，不能借克隆设施规则补齐。

#### B5-79 白蹭（需要项目约定）

- 身份：`TFT_Augment_Sponging`。
- 已有原文／字段：`A[292].apiName=TFT_Augment_Sponging`，`description_zh_cn`：“战斗开始时：至多5个仅携带了1件及以下装备的弈子们会从相距最近的那个全装友军处随机获得一件成装的复制品。” `effects={"MaxItemsToBeEligible":1.0,"MaxUnits":5.0}`；原始map22定位为 `A[292].map22_node={dc455416}`，对应 `data/map22-augment-item-nodes.json.nodes["{dc455416}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：受益超过5人的选取、最近全装者并列、全装是否含手套临时装、复制物品池/权重/特殊装和满槽次序。
- 本地补查结果：A.effects MaxUnits=5、MaxItemsToBeEligible=1，文案含最近全装友军与随机一件成装；未找到并列和类别执行。
- 分类与后续：**需要项目约定**。**P-B5-79（P，2026-10-25，用户提案）**：提案：开战先冻结永久装备快照，按单位ID取最多5名合资格英雄，最近持3件永久普通成装的另一英雄为源，并列按ID；从源普通成装实例等权复制1件临时装，统一采样后分配，避免连锁复制。

### 12. 阶段奖励／特殊商店／等级上限

#### B5-80 延迟开始（需要项目约定）

- 身份：`TFT_Augment_HeadStart`。
- 已有原文／字段：`A[14].apiName=TFT_Augment_HeadStart`，`description_zh_cn`：“卖掉你场上和备战席上的所有弈子。获得4个随机的2星1费弈子。在接下来的3个回合中禁用你的商店。” `effects={"NumUnits":4.0,"RoundsToSkip":3.0,"Tier":1.0}`；原始map22定位为 `A[14].map22_node={aff7cb1b}`，对应 `data/map22-augment-item-nodes.json.nodes["{aff7cb1b}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：出售是否正常返金币/归还装备；商店关闭3轮起止、自然刷新与非商店赠送能否继续；四名随机英雄是否不同名。
- 本地补查结果：A.effects NumUnits=4、Tier=1、RoundsToSkip=3及description明确2星；未找到禁用命令类别和轮边界。
- 分类与后续：**需要项目约定**。**P-B5-80（P，2026-10-25，用户提案）**：提案：按现有出售命令语义批量清空（含返金/装备），四个2星1费按既有随机奖励约定；取得轮起3个自然轮拒绝商店买入/手动刷新，正常XP/收入/非商店奖励继续，下一轮恢复。

#### B5-81 又一个异常突变（需要外部研究）

- 身份：`TFT13_Augment_AnotherAnomaly`。
- 已有原文／字段：`A[77].apiName=TFT13_Augment_AnotherAnomaly`，`description_zh_cn`：“在阶段4-6的【异常突变】回合后，获得一件装备，可用于将所选【异常突变】效果复制到携带装备的弈子身上。” `effects={}`；原始map22定位为 `A[77].map22_node={60ad6ef3}`，对应 `data/map22-augment-item-nodes.json.nodes["{60ad6ef3}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：复制装备类别/槽位/能否拆卸/叠加，和原异常已绑定者/复制体/英雄专属异常交互；4-6后确切发奖入口及异常状态复制时点。
- 本地补查结果：已补 M["Maps/Shipping/Map22/Items/TFT13_AnotherAnomaly_Item"].constants.{df085b93}：Health=250、AD≈0.20、AP=25，mIsUnique=true并自互斥；中英字符串 entries.tft_item_description_anotheranomaly 只说持有者获得你的异常。不是消耗型重复选异常的证据。X报告提到后期13.8禁用，不能倒推14.24禁用；未找到复制兼容矩阵。
- 分类与后续：**需要外部研究**。外研：查14.24b Portable Anomaly装备执行，按每个异常类别确认复制的是效果定义还是累计状态、卸下后是否撤销、原绑定者能否装备及特殊英雄限制；不能只有250/20%/25就开放。

#### B5-82 意料之中的意外（需要外部研究）

- 身份：`TFT_Augment_ExpectedUnexpectedness`。
- 已有原文／字段：`A[246].apiName=TFT_Augment_ExpectedUnexpectedness`，`description_zh_cn`：“现在以及下2个阶段开始时，投掷3个骰子。根据总点数获得各种奖励。” `effects={"NumStages":2.0,"{03e061af}":7.0,"{dae07608}":20.0,"{fcb8577b}":15.0}`；原始map22定位为 `A[246].map22_node={47cf345f}`，对应 `data/map22-augment-item-nodes.json.nodes["{47cf345f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：骰子面数/独立公平性、总点数→奖励完整表、阶段差异/概率、随机英雄/物品内部抽样，阶段内具体触发次序。
- 本地补查结果：A.effects NumStages=2，匿名{03e061af}=7、{dae07608}=20、{fcb8577b}=15；V.data/claims-index.json A7确认只有“现在及后续2阶段”三次触发，没有奖励映射；X.excerpts/rewards/tactics-s14-factual-arrays.json是S14，不能补S13。V的MagicRoll六条文本与蛋表也不是本项骰点表。未找到14.24完整映射。
- 分类与后续：**需要外部研究**。外研：找14.24b Expected Unexpectedness三次触发各自骰子分布、骰点到奖励表及数量；明确是否与Magic Roll共享表，再核实阶段内时点。禁止用S14表或自行公平3d6替代。

#### B5-83 我成C位了（需要外部研究）

- 身份：`TFT_Augment_ImTheCarryNow`。
- 已有原文／字段：`A[260].apiName=TFT_Augment_ImTheCarryNow`，`description_zh_cn`：“获得一个【魔像】且它携带着多件量身定做的进攻型装备。它会在每个阶段开始时变得更强。” `effects={"{2d6883d7}":0.20000000298023224,"{8715634f}":475.0,"{92c6e7f9}":null}`；原始map22定位为 `A[260].map22_node={ed870029}`，对应 `data/map22-augment-item-nodes.json.nodes["{ed870029}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：特殊魔像初始星级/阶段全属性、进攻装备名称/件数/固定或抽样、每阶段成长/换装/取整与触发回合；匿名475/0.2的含义。
- 本地补查结果：A.effects {8715634f}=475、{2d6883d7}≈0.2、{92c6e7f9}=null；V.data/C1-blue-golem.raw.json与X.excerpts/clones_loot/14.24-bluegolem-background.json仅是普通魔像，V.report §B3明确不能代替该特殊实例。未找到专属装备和成长表。
- 分类与后续：**需要外部研究**。外研：查14.24b强化生成魔像脚本、初始化覆盖、进攻装备套装及各阶段面板；分别核实475/0.2单位及计算位置，不能把普通魔像基础值加猜测成长当答案。

#### B5-84 最大规模（需要项目约定）

- 身份：`TFT_Augment_MaxCap`。
- 已有原文／字段：`A[269].apiName=TFT_Augment_MaxCap`，`description_zh_cn`：“你的最大等级为7级。获得1个【金锅锅冠冕】，该装备可使己方小队规模+1，并获得60金币。” `effects={"AugmentGold":60.0,"NumItems":1.0}`；原始map22定位为 `A[269].map22_node={26668cb1}`，对应 `data/map22-augment-item-nodes.json.nodes["{26668cb1}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：选择时已超过7级是否降级/退经验、已有提高等级上限强化如何冲突；金币/冠冕发放和封顶先后。
- 本地补查结果：A.description 明确最大7级、60金和1金锅锅冠冕，effects AugmentGold=60、NumItems=1；未找到已超7级分支。
- 分类与后续：**需要项目约定**。**P-B5-84（P，2026-10-25，用户提案）**：提案：仅在当前等级≤7时提供该强化，所有更高等级上限项互斥；获得后上限7，溢出XP沿现有封顶处理，不降级/退经验。不得仅依互斥表假定玩家不可能早升8。

#### B5-85 棱彩管道（需要外部研究）

- 身份：`TFT_Augment_PrismaticPipeline`。
- 已有原文／字段：`A[276].apiName=TFT_Augment_PrismaticPipeline`，`description_zh_cn`：“下个非玩家对战回合将额外掉落一个棱彩法球，里面装满了丰厚的战利品。所有的棱彩法球都将带来更多战利品！” `effects={"NumRounds":1.0}`；原始map22定位为 `A[276].map22_node={515ca22f}`，对应 `data/map22-augment-item-nodes.json.nodes["{515ca22f}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：额外棱彩球底表与调用绑定、所有来源球是否加奖、Early/Late分界、生成/领取时抽取时点、缺省权重与14.24b覆盖。
- 本地补查结果：已补 V.data/a5-pipeline-bonus.json：Early={b7040c44}、Late={761d6a09}；Early明示8金权重1，Late明示约34%16金/33%两COMPONENT_NOSPAT/33%两FiveCostUnit+6金。data/a5-ultra-orb-candidates.json定位UltraGradePlusBonusDistribution={ca212807}及UltraBoxPlusA–J，但未证明管道调用。X.excerpts/rewards/patch-facts.json证实14.24移除金球加奖，不能启用残留GoldBonus。V.data/claims-index.json A5与X.unknowns question=4仍缺分界/调用。
- 分类与后续：**需要外部研究**。外研：找14.24b管道法球生成与领取脚本，绑定底表和Early/Late比较式、加奖适用来源；核实缺省权重的实际处理。不能用“价值降低约30%”反推精确奖励或以OrbUpgradeStage=2直接定分界。

#### B5-86 订阅服务（需要项目约定）

- 身份：`TFT_Augment_SubscriptionService`。
- 已有原文／字段：`A[293].apiName=TFT_Augment_SubscriptionService`，`description_zh_cn`：“现在，并且在每个阶段开始时，开启一个由4个独特4费弈子组成的商店，并获得6金币。” `effects={"ChampionTier":4.0,"GoldPerStage":6.0}`；原始map22定位为 `A[293].map22_node={c1120d9d}`，对应 `data/map22-augment-item-nodes.json.nodes["{c1120d9d}"].constants`（无constants则不以空对象推测隐藏值）。
- 原计划缺口／本次细化：独特4费商店是独立选择还是替换普通5槽；免费还是仍需购买、维持时长/锁店/刷新、不足4名共享卡处理、阶段当轮重触发。
- 本地补查结果：A.effects ChampionTier=4、GoldPerStage=6；中英文描述填齐立即/每阶段开始、4个不同4费和6金，但无特殊商店费用/生命周期执行；M.{c1120d9d}无额外路由。未找到。
- 分类与后续：**需要项目约定**。**P-B5-86（P，2026-10-25，用户提案）**：提案：在取得及后续阶段首轮，将下一次普通商店替换为4个不同4费（其余槽空），按现有4费正常价格购买，可正常刷新离开；不附赠免费英雄，不绕过共享池，无足够不同卡则留空。

## 研究与实施优先级（推荐已选定）

先从4条“现已完整”分别评估实现，不因某组其它条目需P而将已闭合条目重新报缺数字。需要P的条目采用文内具体提案作为后续设计起点，实施任务仍须检查是否能用现有认证历史表达，不能为了计龄/累计新增保存字段。若某提案需要新存档字段，本轮约束下应继续禁用该条，重新设计已有历史的推导方式。

外研优先：星夜的实际概率调用；老友幽魂/幸运手套的角色映射；先知/传送门虚灵的独立召唤模板；辛吉德毒迹跳频/几何；克隆设施/镜廊/蓝发的继承矩阵；骰子和棱彩管道的奖励调用；特殊魔像装备/成长。即使已有静态数字，也不跳过仍缺的主效果。

不计代价高等级、最大规模已超7级、BRB与自动奖励冲突等属于项目边界提案；本任务未将它们自动实现成新的玩法限制。学术研究、禁忌魔法等已有禁用内容依旧禁用，代码中的行不是可用完成证明。

## 检索范围与复核

实际遍历 `/home/aiapps/workspace/*-research-*/` 的全部已解包文本文件（JSON/Markdown/HTML/TXT/CSV/TSV/JS/Python/YAML），对86条apiName、中英文名做不区分大小写检索；再按具体缺口检索/读取完整map22的命名表、字符串表、相关研究结论与负证索引。图片/视频元数据只作线索，不宣称做了帧测；zip/docx包内重复物不再当独立证据。不存在的路径或未导出的执行函数保持“未找到”。

| 已搜索本地目录 | 文本文件数 | 文本字节数 | 至少命中一条名称的文件数（不等于补证条数） |
|---|---:|---:|---:|
| `anvil-research-2026-10-23` | 25 | 457228 | 5 |
| `augment-crossversion-research-2026-10-24` | 98 | 109417046 | 42 |
| `augments-research-2026-10-23` | 26 | 2195337 | 16 |
| `black-market-research-2026-10-23` | 30 | 298361 | 0 |
| `champion-skills-research-2026-10-23` | 18 | 271407 | 0 |
| `combat-rules-research-2026-10-23` | 16 | 162121 | 1 |
| `control-sion-research-2026-10-24` | 49 | 3054910 | 2 |
| `game-flow-ui-research-2026-10-23` | 26 | 207010 | 0 |
| `s13-missing-values-research-2026-10-24` | 67 | 570366 | 21 |
| `s13-trait-mechanics-research-2026-10-24` | 23 | 250267 | 3 |

文档检查：12组与原计划逐项集合相等；86个apiName各出现于一个核查小节，无漏项/重复项；所有原始索引、apiName、map22键及effects直接从只读研究JSON提取；分类合计86；P条目与 `S13_RULES_GAP.md` 对应登记。新增M证据均按原始对象键核对，未将匿名字段命名候选当作执行事实。

测试：仅文档任务，未运行Vitest、全量测试、构建或录制；用离线文档一致性检查核对覆盖、分类、来源路径和P登记。未改代码/fixtures/内容版本/保存格式，未提交Git。
