# G2-4B：神器锻造器、辅助装锻造器与征服者 10/11/13/14 档实施计划

日期：2026-10-17。范围：考证和实施设计；本次仅提交本文件，不改代码，不运行测试、构建或夹具录制。下文“验收”均指后续实施应做的检查，不代表已经执行或通过。

## 预演授权更新（2026-10-17，优先于下文历史范围）

用户指定 `codex/g2-4b-support-forge-trial` 从 #149 `65db5d2` 合并神器分支 `b2de81a`，仅供预演，不直接合入。两类装备实现均保留，共享 `supportStage` / `holder-death` 各一份。

- G24-FORGE-01…08 已确认沿用于辅助装；准入池为源17件与已实现13件交集，四选一、等权无放回、超时首项、库存/上次出现不排除、少于4件拒绝；普通成装重铸器拒绝辅助装。界面名称“辅助装锻造器”，具体弹窗由 Claude 接。
- 本预演恢复第11档（750：辅助装锻造器，无15过渡金）、第13档（1000：基克/鸟盾/圣杯三件固定物品+拆卸器+20金，无额外30过渡金）。10/14沿用神器分支；12/15冠冕继续延后。
- 用户明确要求本次只跑相关测试，不跑全套；不另升版本/revision、不重录夹具。合并选择神器分支已有v5标识，保留#149历史夹具字节。内容摘要仍由真实内容计算，加入辅助装及获取规则必然改变计算结果，不硬编码旧digest；正式合并时统一升版和录制。
- 不修改服务器/渲染/表现层；合并依赖自身带来的历史改动保留，本次新增实现仅在 simulation/tests/docs。没有新增待定约定值。

预演接口、冲突处理及测试记录见 [辅助装锻造器预演](G2-4B-SUPPORT-FORGE-TRIAL.md)。下文为计划与神器批历史记录，出现“辅助装延后”“需全套/升版”等描述时，以本节预演授权为准。

## 0. 实施授权更新（2026-10-17，优先于下文原计划）

计划专用分支 `codex/g2-4b-forges-plan` 已提交 `6ecdc02b11257a7fb5cb1af4cfb212dbca63cde2`。原计划考证阶段未运行测试；下文保留其来源、完整池和后续辅助装接口设计。

用户随后要求从 #147 固定 head `d3112d681ecff96140c451a842c36f29537e1c07` 实施领域层，新分支 `codex/g2-4b-artifact-forge`，并明确：

- **G24-FORGE-03 的神器 21 件交集池已确认**；不是等待确认的建议。辅助装的 13 件方案仅保留设计，未在本批准入。
- **本批只恢复征服者第 10/14 档；第 11/13 档等待 #149，保持 15 金 / 拆卸器+50 金。** 不提前发支持类物品，也不把其来源池当成可执行池。
- 不修改服务器、渲染或表现层。复用领域通用 forge 选择/超时接口；联机转发、标题与弹窗接入由 Claude 完成。
- 本实施批必须跑相关测试及最终 head 全套，升 policy revision、rules/content 和 digest，原脚本重录夹具。原文“不跑测试”只描述先前计划交付。
- 当前实际版本为 rules `s13-g2-3-v5` / content `s13-14.24b-g2-3-v5`，policy `g2-4b-artifact-forge-v5`；schema/save/replay/command 仍为 7/3/3/3。旧 v4 存档/回放拒绝，无迁移。

实际实现、收据和测试边界见 [G2-4B 实施交付](G2-4B-ARTIFACT-FORGE.md)。后续 #149 合并后独立恢复 11/13，再升版本和重录；无需阻塞当前 10/14 的领域实现。本文后续“四档一起恢复”“尚未确认”“等待两者最终合并后开分支”等均为原计划，不覆盖本节最新裁定。

## 1. 结论与基线

- 两种锻造器均为 **4 选 1**，沿用 G2-4a 的 forge 选择接口。神器源池 29 件，辅助装源池 17 件，完整 ID 见第 3 节。
- 征服者第 10/11 档分别恢复神器/辅助装锻造器；第 13 档恢复三件指定辅助装、拆卸器、20 金；第 14 档恢复随机光明装、神器锻造器、拆卸器、50 金。第 13/14 档不能保留过渡期的 50/60 金后再补物品。
- 源文件未确定抽样权重、抽样去重算法及跨锻造器排除规则。建议沿用 G2-4a：候选池等权、同次不重复、不同次可重复，显式标为项目约定。
- #147 只登记 21/29 件神器，#149 只登记 13/17 件辅助装。建议本批先采用“源池与已实现注册表的交集”恢复四档，并公开 21/13 的阶段限制；完整 29/17 池待剩余机制完成后再开放。这是 **G24-FORGE-03 建议值，尚非用户已确认的全池裁定**。若要求首次开放即完整源池，则必须先完成剩余 8+4 件，不能把它们伪装成已实现或直接发空效果物品。
- 成装重铸器维持“仅普通 36 件成装”。当前代码已经通过普通池成员检查拒绝神器和辅助装，不应为了接入新装备而扩大重铸池。原版重铸器的同类型描述不等于本项目已经支持辅助装同类重铸。

读取的固定基线：

| 对象 | 状态和提交 |
| --- | --- |
| multiplayer | 72724693693176bf314d6dda04e33abed79308ec；rules/content 仍为 v3 |
| [#144](https://github.com/catfish-xn/cat/pull/144) | 已合入；merge 66b724c468fa30588b7fc9f09c4d99ab59c312d0；恢复 4/8/9 档 |
| [#147](https://github.com/catfish-xn/cat/pull/147) | 未合入、draft；claude/g2-4b-artifacts-01c6wi，head d3112d681ecff96140c451a842c36f29537e1c07 |
| [#149](https://github.com/catfish-xn/cat/pull/149) | 未合入、draft；claude/g2-4b-support-items-oybovc，head 65db5d203764d479026ee5209d42e78b627ccb27 |

以上为本次读取时的快照，不代表后续 PR head 或合并状态。未将 PR 自述的测试结果计作本次验证。

## 2. 来源边界、可复查定位与命名差异

以下路径均相对仓库根目录。raw 根为 src/simulation/content/source/s13-14.24b/raw/。

### 2.1 来源锁定

依据 provenance/source-policy.json：Riot 14.24 B 公告优先于 14.24 正文，再优先于 14.24 客户端数据；数值描述与 effects 不一致时采用 effects。目录名 14.24b 不表示 raw 已含 B 改动。

本次直接解压读取归档，并核对压缩字节的 Git blob SHA 与固定基线的远程树一致；解压 SHA256 与 provenance/manifest.json 一致。GitHub 文本工具不能解码 gzip，因此读取已有本地归档副本，**以相同 Git blob SHA 证明其就是该基线的源文件**，没有用其他版本文件替代。

| raw 文件 | 解压 SHA256 | Git blob SHA |
| --- | --- | --- |
| map22.bin.json.gz | 09a9219647c08e70a8eb4d2ccbc35a9afe21934bc5279b4da2d05ca076339e0f | 78178fb490a17584509c969e9221a91dd886fb80 |
| en_us.json.gz | c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3 | a6bbdadfc57a43436a2f4de8ce8606c7ecbc42a6 |
| en_us.tft.stringtable.json.gz | 4951a0356e8d9ac7f59b3b54360c964d65baea8112bcbd8da23b8540df07a443 | b558a04606c4ab4c924fca3d8b8ad9249c2e6880 |
| zh_cn.tft.stringtable.json.gz | aa9ca3629482cdde5356a38c1f83c804fdcc20e2b6315cc872e6a9800dbacda3 | 653ab680768eb914d83bac9d05600a683b1bbdbb |

源树：[固定基线 raw 目录](https://github.com/catfish-xn/cat/tree/72724693693176bf314d6dda04e33abed79308ec/src/simulation/content/source/s13-14.24b/raw)。

[Riot 14.24 公告的 B 更新](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)将征服者每开箱属性成长由 3% 改为 5%；现有 G23_POLICY.conqueror.growthPerChestBps=500 应保留。本次未找到该 B 段修改四档奖励、两池成员或锻造器选择数的记录，不据此编造额外 B 差异；物品战斗数值继续由 #147/#149 的来源记录负责。

### 2.2 raw 定位

map22 是以对象路径或哈希键为顶层键的字典；下表 pointer 是解压后的 JSON Pointer，花括号是键本身。

| 事实 | map22 pointer / 字段 |
| --- | --- |
| 神器池 | /{3807b70f}/mConstants/Definitions/mValue；mName=ItemKeyDefinition_ORNNARTIFACTS_SET6 |
| 辅助装池 | /{6aa84b31}/mConstants/Definitions/mValue；mName=ItemKeyDefinition_SUPPORTITEMS |
| 同值历史辅助池 | /{0c730bfd}；ItemKeyDefinition_SUPPORTITEMS_Set10，与 SUPPORTITEMS 数组相同；本批仍引用无后缀的 SUPPORTITEMS |
| 神器锻造器身份 | /{bdbbdeb7}；TftShopData，mName=TFT_ArmoryKeyOrnn |
| 辅助装选择器身份 | /{fae72f61}；TftShopData，mName=TFT_ArmoryKeySupport |
| 四档门槛 | /{6c3dc4c3}/mConstants；ArmoryTable_TFT13_Warband_CashoutBreakpoints |
| 整档估值 | /{2e254fd9}/mConstants；ArmoryTable_TFT13_Warband_CashoutEstimatedGoldValues |
| 重铸器身份 | /Maps~1Shipping~1Map22~1Items~1TFT_Consumable_ItemReroller；TftItemData |

en_us.json 中两池所有成员都能按 /items 的 apiName 精确匹配，也都属于 setData 中 mutator=TFTSet13 的 items。源池分别有 29/17 个互异 ID；这证明池列表没有重复成员，**不能证明实际选择算法无放回**。

已生成来源可交叉复查：src/simulation/content/g2-3-special-item-source.ts 的 G23_SPECIAL_ITEM_POOLS，和 g2-3-loot-source.ts 的 G23_LOOT_SOURCE；抽取逻辑见 docs/evidence/g2-3/extract-special-items.py、extract-content.py。本次没有运行这些生成器。

### 2.3 “辅助装锻造器”的证据冲突

继续使用用户指定名称“辅助装锻造器”。但“14.24 没有这个物品/名称”不能写成已考证事实：

- map22 有 TFT_ArmoryKeySupport 的 TftShopData；标准征服者第 11 档 Option1 引用该身份。
- 英文文本 /entries/tft_armorykey_supportitem_name 为 Support item anvil。
- 中文同键为“辅助装锻造器”；tooltip 描述拖到商店开启辅助装武器库，并有 30 秒选择时间。
- 神器对应 /entries/tft_armorykey_artifactitem_name：英文 Artifact Item Anvil，中文“神器装备锻造器”；项目继续简称“神器锻造器”。

这些是归档的身份、文本和表引用证据；不把客户端所有残留对象一概视为正式服可获取性证明。14.24 正文确实把 Support Mining/Support Mining+ 的奖励从 Support Anvil 改为随机辅助装，但那是特定强化的奖励改动，不能推出“所有辅助装锻造器都不存在”。来源仍为上述 Riot 14.24 公告。

src/presentation/choice-fallback.ts 当前注释称“14.24 has no support anvil”，与归档文本不一致，后续由界面负责人修正文案注释，不借此改变用户已定名称。

## 3. 候选池：源全集与可执行子集

以下 ID 既是源 apiName，也沿用 #147/#149 的运行时 definitionId，不另造英文 slug。“已实现”仅指对应未合入 PR 的注册表，不表示 multiplayer 已可获取。

### 3.1 神器：ORNNARTIFACTS_SET6，29 件

| definitionId / apiName | 中文名 | #147 |
| --- | --- | --- |
| TFT4_Item_OrnnAnimaVisage | 生命盔甲 | 已实现 |
| TFT4_Item_OrnnDeathsDefiance | 死亡之蔑 | 延后：伤害延迟/流血 |
| TFT4_Item_OrnnInfinityForce | 三相之力 | 已实现 |
| TFT4_Item_OrnnMuramana | 魔蕴 | 已实现 |
| TFT4_Item_OrnnTheCollector | 金币收集者 | 延后：战斗掉金币 |
| TFT4_Item_OrnnZhonyasParadox | 中娅悖论 | 已实现 |
| TFT9_Item_OrnnHullbreaker | 碎舰者 | 已实现 |
| TFT9_Item_OrnnDeathfireGrasp | 冥火之拥 | 已实现 |
| TFT9_Item_OrnnHorizonFocus | 狙击手的专注 | 已实现 |
| TFT9_Item_OrnnTrickstersGlass | 诡术师之镜 | 延后：分身 |
| TFT7_Item_ShimmerscaleGamblersBlade | 投机者之刃 | 延后：战斗掉金币 |
| TFT7_Item_ShimmerscaleMogulsMail | 大亨之铠 | 延后：战斗掉金币 |
| TFT_Item_Artifact_TalismanOfAscension | 飞升护符 | 已实现 |
| TFT_Item_Artifact_Fishbones | 鱼骨头 | 延后：随机目标 |
| TFT_Item_Artifact_SuspiciousTrenchCoat | 迷离风衣 | 延后：复制体 |
| TFT_Item_Artifact_HorizonFocus | 视界专注 | 已实现 |
| TFT_Item_Artifact_Mittens | 连指手套 | 已实现 |
| TFT_Item_Artifact_UnendingDespair | 无终恨意 | 已实现 |
| TFT_Item_Artifact_RapidFirecannon | 疾射火炮 | 已实现 |
| TFT_Item_Artifact_InnervatingLocket | 激发之匣 | 已实现 |
| TFT_Item_Artifact_LudensTempest | 卢登的激荡 | 已实现 |
| TFT_Item_Artifact_SilvermereDawn | 密银黎明 | 已实现 |
| TFT_Item_Artifact_ProwlersClaw | 暗行者之爪 | 已实现 |
| TFT_Item_Artifact_SpectralCutlass | 幽魂弯刀 | 延后：传送 |
| TFT_Item_Artifact_BlightingJewel | 枯萎珠宝 | 已实现 |
| TFT_Item_Artifact_WitsEnd | 智慧末刃 | 已实现 |
| TFT_Item_Artifact_LichBane | 巫妖之祸 | 已实现 |
| TFT_Item_Artifact_LightshieldCrest | 光盾徽章 | 已实现 |
| TFT_Item_Artifact_SeekersArmguard | 探索者的护臂 | 已实现 |

源全集不可删去未实现项。实施候选池如采纳 G24-FORGE-03，应取源全集与 G24_ARTIFACT_ITEMS 键的交集；初始 21 件。“狙击手的专注”和“视界专注”是两个不同 ID，不能因 HorizonFocus 名片段去重合并。

### 3.2 辅助装：SUPPORTITEMS，17 件

| definitionId / apiName | 中文名 | #149 |
| --- | --- | --- |
| TFT_Item_ZekesHerald | 基克的先驱 | 已实现 |
| TFT_Item_Chalice | 能量圣杯 | 已实现 |
| TFT4_Item_OrnnRanduinsSanctum | 兰顿之兆 | 已实现 |
| TFT_Item_Shroud | 静止法衣 | 延后：法力劫掠 |
| TFT_Item_Zephyr | 灵风 | 延后：放逐 |
| TFT5_Item_ZzRotPortalRadiant | 兹若特传送门 | 延后：召唤物 |
| TFT_Item_LocketOfTheIronSolari | 钢铁烈阳之匣 | 已实现 |
| TFT4_Item_OrnnObsidianCleaver | 黑曜石切割者 | 已实现 |
| TFT_Item_AegisOfTheLegion | 军团圣盾 | 已实现 |
| TFT_Item_RadiantVirtue | 殉道美德 | 已实现 |
| TFT7_Item_ShimmerscaleHeartOfGold | 大而无当的宝石 | 已实现 |
| TFT_Item_BansheesVeil | 女妖面纱 | 已实现 |
| TFT_Item_EternalFlame | 永恒烈焰 | 已实现 |
| TFT_Item_SupportKnightsVow | 骑士之誓 | 已实现 |
| TFT_Item_Moonstone | 月石再生器 | 已实现 |
| TFT_Item_Spite | 恶意 | 已实现 |
| TFT_Item_UnstableTreasureChest | 不稳定的宝箱 | 延后：战中临时装备 |

实施候选池如采纳 G24-FORGE-03，应取源全集与 G24_SUPPORT_ITEMS 键的交集；初始 13 件。TFT5_Item_ZzRotPortalRadiant 虽有 Radiant 后缀，在本来源中属于辅助装池；不可按字符串前后缀猜类别。

### 3.3 选择数、去重与概率能证实到哪一步

| 规则 | 证据结论 | 本批行为 |
| --- | --- | --- |
| 神器 4 选 1 | raw 的 shop/text 没有选择数；[Riot 14.9 公告“ARTIFACT ANVILS”](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-9-notes/)明确由 3 改为 4；本次亦有用户明确决定 | 4 |
| 辅助装 4 选 1 | raw 只确定池和选择器身份，未定位选择数/服务器实现 | 用户已定 4，不冒充 raw 结论 |
| 同次去重 | 源数组各 ID 只出现一次；没有定位实际抽样去重代码 | 沿用 G2-4a，无放回抽四个不同 ID |
| 各物品权重 | Definitions 是字符串数组，没有每件权重 | 等权抽样，项目约定 |
| 不同次、不同玩家、已有库存排除 | 未定位源规则 | 不排除；不同窗口可重现同一物品，也可取得已拥有物品 |
| 原版 30 秒 | 字符串表有 30 秒描述 | 仅作源描述；项目沿用现有选择/联机超时机制，不新增独立 30 秒计时器 |

## 4. 征服者四档：精确恢复内容

各 ArmoryTable_TFT13_Warband_CashoutN 只有 Option1 的 mValue=1，其他列出选项权重为 0/省略值；因此本批恢复该唯一启用奖励，不随机选择其他归档 Option。

| 档 | 门槛 | 当前 G2-4a | G2-4b 恢复目标 |
| --- | --- | --- | --- |
| 10 | 650 | 14 金 | TFT_ArmoryKeyOrnn ×1；不发 14 金 |
| 11 | 750 | 15 金 | TFT_ArmoryKeySupport ×1；不发 15 金 |
| 13 | 1000 | 拆卸器 ×1 + 50 金 | 基克/鸟盾/圣杯各 1，拆卸器 ×1，20 金 |
| 14 | 1200 | 随机光明装 ×1 + 拆卸器 ×1 + 60 金 | 随机光明装 ×1，神器锻造器 ×1，拆卸器 ×1，50 金 |

原始 Option1 的 mConstants（以下简写已去掉 mValue 和类型包装）：

    10  { MeepTypeUnit: ["TFT_ArmoryKeyOrnn"] }
    11  { MeepTypeUnit: ["TFT_ArmoryKeySupport"] }
    13  { Item: ["TFT_Item_ZekesHerald", "TFT_Item_LocketOfTheIronSolari",
                "TFT_Item_Chalice", "TFT_Consumable_ItemRemover"], Gold: 20 }
    14  { ItemByKey: ["RADIANTITEMS_SET5"], Gold: 50,
          MeepTypeUnit: ["TFT_ArmoryKeyOrnn"], Item: ["TFT_Consumable_ItemRemover"] }

| 档 | table 顶层键 | Option1 顶层键 |
| --- | --- | --- |
| 10 | {5edd9c88} | {96afdfe4} |
| 11 | {5fdd9e1b} | {687c9527} |
| 13 | {61dda141} | {b7b519b5} |
| 14 | {62dda2d4} | {6fc13868} |

完整 pointer 为 /对应键/mConstants/字段/mValue。整档估值 14/15/50/60 是过渡规则的保底依据，不是恢复后的额外金币，也不是各物品价格。

第 14 档的 RADIANTITEMS_SET5 是 **随机发一件**，不改成新的光明 4 选 1。沿用已有 radiantPoolExclusions（光明窃贼手套排除，现 35 件）及已有约定；本批不扩大其范围。

从 G23_DEFERRED_CONQUEROR_ITEMS 移除两个 ArmoryKey 和三件辅助装身份。保留 TFT_Item_ForceOfNature；第 12/15 档仍按冠冕工作项的实际合入状态处理，不能因本批恢复四档而顺带恢复冠冕或修改第 15 档转换规则。

## 5. 成装重铸器与辅助装

### 5.1 原版能证实与不能证实的部分

en_us.json 的 /items/1180（按 apiName=TFT_Consumable_ItemReroller 再确认）和中英文字符串表 /entries/tft_consumable_description_itemreroller 均描述：拆卸全部装备，随机变为相似类型、品质的新装备。该原版工具不是本项目“指定一件普通成装”的完整同构接口。

[Riot 11.12 公告“Loot Orbs”](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-11-12-notes/)历史上明确重铸保留类别/等级（当时例举普通/黑暗、成装/组件、纹章）；它支持“区分类别”的原则，但早于辅助装分类，不能直接充当 14.24b“辅助装必定重铸为另一辅助装”的完整证据。

未在本批归档定位：14.24b 辅助装重铸目标白名单、是否排除原物品、每件权重、禁用项和服务器执行逻辑。故“辅助装→辅助装”可作为未来同类重铸设计方向，当前不得标成已复刻原版细节。

### 5.2 当前实现已经如何处理

- src/simulation/content/consumables.ts 的 REFORGE_POOLS 从 **普通** content/items.ts 导入目录：8 组件、36 成装；不是合并后的 g2-3-item-registry.ts。
- previewUseConsumable() 同时校验 kind 和目标 ID 属于普通重铸池；目标辅助装/神器即使 kind='completed'，仍返回 invalid-consumable-target。
- planConsumable() 从相应普通池排除原 ID 再抽取；validateConsumableState() 在恢复时同样认证原件属于普通池并重演输出及 RNG。
- #147/#149 当前都将新装备登记为 kind='completed'。**只按 kind 判断会误放行，但现有第二道成员检查已经阻止。**

建议 G24-FORGE-04：保持 completed-reforger 只处理普通 36 件，辅助装、神器、光明装、化工装均不能作为输入，也不能作为输出。失败保持原 state、不耗工具、不耗 RNG、不新增收据。普通重铸结果排除原 ID 的既有约定不变。

如果以后实现同类重铸，应单列语义类别及每类候选池，补齐来源或显式约定，复用同一个纯候选池解析器供 preview/plan/restore 使用；不能直接把全部 kind='completed' 放入 REFORGE_POOLS。本批建议不扩展该玩法，必要工作是守住现有边界并补恢复反例验收。

## 6. G24-FORGE 约定/未知项登记

“已定”表示本次用户或 G2-4a 已定；“建议”仅是本计划推荐，实施时写入规则清单与约定账本，不冒充官方证据。

| 编号 | 状态/未知项 | 建议值与理由 |
| --- | --- | --- |
| G24-FORGE-01 | 已定：两种均 4 选 1；辅助选择数未从 raw 证实 | 固定 4；神器另有 Riot 14.9 外证。不要把所有类型“4”统一标成客户端数值 |
| G24-FORGE-02 | 建议：权重与同次去重算法未知 | 对已准入候选池按 ID 排序，沿用 sample() 的等权无放回抽样；同窗口四个不同 ID，与 G2-4a 一致 |
| G24-FORGE-03 | 建议：源全集与实现子集不相等 | 先取 29∩已实现=21、17∩已实现=13，保留全量源记录并列出排除项；防止发出不可执行物品。若不接受缩池，先完成 8+4 件再开获取，不能悄悄缩池 |
| G24-FORGE-04 | 建议：原版辅助装重铸细节未证实 | 保持普通成装重铸器拒绝辅助装/神器；现有普通池成员检查已实现该边界，避免跨品质变成普通装 |
| G24-FORGE-05 | 沿用既有项目约定：超时/机器人自动取项 | timeoutOption=offers[0]，复用 choose/forfeitPendingChoice；不额外抽一次，不新增客户端计时权威 |
| G24-FORGE-06 | 建议：跨窗口/库存/跨席排除未知 | 不排除已拥有物品，不维护全局装备有限池，不做跨窗口保底或去重；每个窗口仍只发一件 |
| G24-FORGE-07 | 建议：客户端哈希字段/未识别选择器语义未知 | 仅明确映射 Completed/Ornn/Support 三个键；未知键拒绝，候选不足 4 时视为内容配置错误，不回退别的池或临时折金 |
| G24-FORGE-08 | 用户名称已定，原版获取性仍有边界 | UI 使用“神器锻造器/辅助装锻造器”；记录 raw 已有 Support 名称和身份，不再以“原版绝对不存在”为设计理由 |

本计划首选“先交集、后全池”，理由是与两个已分批 PR 的可执行边界一致；尚未确认的核心产品取舍只有 G24-FORGE-03。其他建议均尽量复用已授权的 G2-4a 行为及现有重铸边界。本次只交付可评审计划，不把建议转成运行时代码。

## 7. 文件与函数实施清单

### 7.1 规则、候选池与奖励

| 文件 | 函数/符号 | 计划 |
| --- | --- | --- |
| src/simulation/content/g2-3-policy.ts | G23_DEFERRED_CONQUEROR_ITEMS、g23ConquerorReward、G23_POLICY | 仅移除两选择器与三辅助装的延后项；四档奖励恢复后取消对应整档折金；保留复制器靠后顺序和冠冕隔离；policy revision 升级 |
| src/simulation/content/g2-3-special-item-source.ts | G23_SPECIAL_ITEM_POOLS | 复用完整 29/17 源池，不能用执行子集覆盖它；正常不需改生成文件 |
| src/simulation/content/g2-4-forges.ts（建议新增） | G24_FORGE_POLICY、G24_FORGE_POOLS、resolveG24ForgePool(api)（拟定名） | 明确三种 selector→pool；分开 sourceIds/admittedIds/exclusions/conventionIds；结合 #147/#149 注册表，输出排序稳定的候选池；至少 4 件且均已注册。纯内容逻辑，避免内容摘要导入循环 |
| src/simulation/g2-3-rewards.ts | ordinary、sample、g23RewardAtoms 的 MeepTypeUnit 分支 | 复用现有 sample 和 seed+bundle/atom ID 派生；将“未知键一律当辅助装”的嵌套三元式换成显式解析；三类选择器一律 4 选 1。普通池仍按 ordinary recipe 限定 |
| src/simulation/g2-3-economy.ts | advanceG23Economy | 原样复用 Gold 分离和 rewards bundle；核对 10/11 无金币，13/14 为 20/50；不另加一条补发路径 |
| src/simulation/g2-3-settlement.ts | commitG23Settlement、g23BattlePayouts、g23RoundGold | 复用战斗唯一结算和金币收据；更新预期而非维护第二份奖励表；保留 mechanicReceiptPrefixLength 的恢复口径 |
| src/simulation/g2-3-runtime.ts | claimG23Atom、drainG23Rewards、openG23Choice、finishG23Choice | 复用固定项自动发放、待选项托管、顺序弹窗；通常无需新机制代码。核对连续窗口和重复选择防重 |
| src/simulation/seat-mechanics/choices.ts、grants.ts、state.ts | openMechanicChoice、resolveMechanicChoice、grantMechanicItem、appendMechanicReceipt | 复用 forge/choice/item 收据；不新建 anvil 消耗品、物品实例或独立发奖收据类型 |
| src/simulation/consumables.ts、content/consumables.ts | previewUseConsumable、planConsumable、validateConsumableState、REFORGE_POOLS | 保留普通成员检查和独立目录导入；当前已满足拒绝辅助装，不为文档范围强改代码；若抽公共池解析器，三条路径同用 |
| src/simulation/content/index.ts、content/rules-manifest.ts | CONTENT_DIGEST、RULES_GAP_MANIFEST.g23 | 纳入实际池、排除项、4选1、去重/跨窗口/重铸约定和新奖励策略标签；旧 anvilChoices=4 本身不用改数值 |
| src/simulation/m8/version.ts | M8_VERSION | 按第 9 节递增 rules/content；不手填 digest |

不改 raw、g2-3-loot-source.ts 的源奖励，不改 #147/#149 已记录的战斗数值，也不通过复制新物品定义到锻造器 PR 绕过依赖。

随机数沿用 sample()：以 0x67323372 起始、对 seedText 逐字符乘 31 派生种子，再用 nextRandom 逐次从排序后的 remaining 中 splice。不要改 seed 混合、引入 Math.random，或消费商店/choice/reward/reforge 的共享 RNG 来生成同一窗口。不同锻造器由 bundle/atom ID 分开；同种子和同奖励应给完全相同的有序 offers。

### 7.2 收据与恢复相关文件

| 文件 | 函数 | 计划 |
| --- | --- | --- |
| src/simulation/g2-3-state.ts | readG23Progress、validateG23MechanicLinks | 继续从通用收据派生 rewardClaims；认证新四档收据与精确 atom、source、kind、definitionId、实例、轮次对应 |
| src/simulation/g2-3-match-progress.ts | validateG23Progress、replayEconomy | 从 economyReceipts 重演源奖励/金币，按新准入池认证每个 claim；不存第二套发奖账 |
| src/simulation/seat-mechanics/choices.ts | validateMechanicChoiceSpec、validateMechanicPendingChoice | 保留四项互异、已注册、超时项属于 offers、未领收据等结构检查；具体源池授权由 G23 层校验 |
| src/simulation/b8-restore.ts | validateB8Resources | 已有“清空 pending 后调用 openG23Choice，再整对象比对”的 G23 pending authority 校验；扩展覆盖两新池与四档，不另造恢复后重抽/补发路径 |
| src/simulation/serialization.ts | restoreMatch / restoreMatchWithinCall | 沿用版本/digest 与上述入口；核对新增奖励不会绕过资源 provenance、重复出生或最终战斗事实验证 |

### 7.3 文档与界面交接

同步 docs/evidence/g2-3/RECONCILIATION.md 中四档“当前奖励”、延后项和版本；同步 RELEASE_NOTES.md、docs/MATCH_CONTRACT.md、docs/MULTIPLAYER_CONTRACT.md 及约定账本/确认清单（provenance/project-conventions.json、docs/M8_PROJECT_CONVENTIONS_REVIEW.md）。本文件不是替代运行时规则清单的第二个权威。

界面工作交 Claude，Codex 只定义显示数据需求并写 docs/UI_REQUESTS.md：

- 继续显示 offers 中真实 item ID，标题“神器锻造器 · 4 选 1”或“辅助装锻造器 · 4 选 1”；候选名称、说明来自对应目录。
- src/simulation/item-catalog.ts 的 projectCatalog() 当前把运行时 kind 原样投影，而 #147/#149 的新物品都是 completed；现有 choice-fallback.forgeName() 因此不能凭 kind 自动得到新分类。
- 建议按本计划的源池成员关系提供/识别展示分类，不为标题擅自将运行时 ItemDefinition.kind 改成新枚举；若选择扩展目录字段，须同时审查 m8/ui-contracts.ts 和目录消费者的契约/兼容性。
- 展示可披露本阶段 21/13 准入范围；修正“没有辅助锻造器”的来源注释。不得由客户端重抽、过滤 offers 或自行发装备。

## 8. 新增奖励收据与恢复验收

### 8.1 复用收据形状，新增具体记录

不新增 MechanicReceipt union 分支；开窗口只有 pendingChoice，领取成功后才写一条 choice 收据。按现有字段遍历顺序及 advanceG23Economy 剥离 Gold 后，预期如下：

| 奖励 | receiptId | 类型与关键字段 |
| --- | --- | --- |
| 第 10 档神器选择 | g23:conqueror:10:atom:0:copy:0 | choice；choiceKind=forge，source=conqueror，optionId 属于该 atom 的四项，price=0、skipped=false、itemId 指向唯一出生物品 |
| 第 11 档辅助选择 | g23:conqueror:11:atom:0:copy:0 | 同上，使用辅助装池 |
| 第 13 档基克 | g23:conqueror:13:atom:0:copy:0 | item；definitionId=TFT_Item_ZekesHerald |
| 第 13 档鸟盾 | g23:conqueror:13:atom:1:copy:0 | item；definitionId=TFT_Item_LocketOfTheIronSolari |
| 第 13 档圣杯 | g23:conqueror:13:atom:2:copy:0 | item；definitionId=TFT_Item_Chalice |
| 第 13 档拆卸器 | g23:conqueror:13:atom:3:copy:0 | consumable；definitionId=magnetic-remover，唯一 consumableId |
| 第 13 档金币 | g23:conqueror:13:gold | gold；source=conqueror-chest，amount=20 |
| 第 14 档随机光明 | g23:conqueror:14:atom:0:copy:0 | item；固定种子抽得的一项，继续已有 35 件规则 |
| 第 14 档神器选择 | g23:conqueror:14:atom:1:copy:0 | choice；forge，字段同第 10 档 |
| 第 14 档拆卸器 | g23:conqueror:14:atom:2:copy:0 | consumable；magnetic-remover |
| 第 14 档金币 | g23:conqueror:14:gold | gold；source=conqueror-chest，amount=50 |

第 10/11 档不应再有 gold 收据。经济战斗收据只记相应 bundleId 各一次；物品资源出生通过 item-acquired/source.kind=mechanic/receiptId 与以上记录相连。选择器自身不另占库存，也不先发 item 再用第二条收据兑换。

注意 atom ID 含字段遍历生成的序号；实施时保留源顺序，不为“整理对象”排序奖励字段，否则会改变身份和确定性候选。若依赖 PR 已调整顺序，必须重核上表并版本化，不能让恢复沿用错位 ID。

### 8.2 后续必须覆盖的恢复与防重场景

1. 未开窗、已开窗未选、手动选后、超时选后分别 serialize/restore；offers 的顺序、timeoutOption、returnPhase、choiceId、generation 和可见结果一致，恢复不抽新 RNG、不发奖。
2. 同次结算跨 9→10→11→13→14 的所有中间档时，固定物品自动发，待选窗口按既有队列逐个打开；同时只有一个 pendingChoice。第 12 档继续按冠冕边界处理。
3. 重复 battle settlement、Continue、超时回调、旧 generation 选择、重复 receipt/copy 均不能补发；选择成功增加恰好一个物品实例及一条资源出生事实。
4. 篡改 offers（少项/重复/换序/跨池/塞入未实现 ID）、timeoutOption、source、kind 或窗口身份时拒绝。现有 pending 整对象重算比对负责源授权，不能只检查“这个 ID 在注册表里”。
5. 已领 claim 必须匹配种子派生出的 atom.options；choice 收据须为 forge、source=conqueror、price=0、skipped=false，实例/provenance/round/copy 一致。对 timedOut=true 的记录核对选了第一项；已有校验未覆盖的项在对应 validator 补齐。
6. 删除、复制或篡改三件辅助装/拆卸器收据及其资源实例时拒绝；金币恢复核对 20/50，拒绝旧 50/60 与新物品并存、10/11 旧金币残留、虚构额外金币。
7. 保持结算前 mechanicReceiptPrefixLength 与结算后资源后缀的口径，恢复不能在原 goldAfter 上再加一遍箱子金币。
8. 辅助装/神器无论库存还是装备中，成装重铸 preview/执行均拒绝；伪造“辅助装→普通装”的 consumable-used 记录也被恢复拒绝。普通 36 件照常可重铸，候选不含新特殊装。
9. 跨两席领取同 ID 合法；同席不同神器窗口出现同 ID 也合法，各自 receiptId 不同。不得把“同窗口去重”误用成整局唯一物品。
10. 旧版本/digest 的存档、冻结输入和回放拒绝按新规则继续；不将旧过渡金币自动迁移成新物品。

### 8.3 预计新增/更新的验收文件（本次不写、不运行）

- 新增 tests/g2-4b-forges.test.ts：源池钉值、交集/排除项、三种 selector、四项无重复/稳定性、未知 selector/不足四项失败。
- 新增 tests/g2-4b-forges-recovery.test.ts：上述窗口恢复、收据篡改、跨档与跨席防重；尽量走公共选择/结算流程。
- 更新 tests/g2-4a-conqueror-items.test.ts、tests/g2-3-traits.test.ts：把本批四档旧金币预期改为真实奖励，保留 4/8/9 和冠冕回归。
- 更新 tests/r3r4-consumable-targets.test.ts、tests/r3r4-consumables.test.ts：辅助装/神器拒绝及伪造重铸恢复反例。
- tests/server/g2-4a-forge-timeout.test.ts 可由服务器负责人扩展两池、断线重连、连续窗口和 timeout；不由 Codex 越过 src/server/ 边界。展示标题与目录分类的测试由界面负责人处理。

## 9. 版本、摘要与夹具

本次文档提交 **不升任何运行时版本、不改任何 digest、不重录夹具**。

实施后的规则变化必须升级：

| 项目 | 预计 |
| --- | --- |
| G23_POLICY.revision | g2-4b-forges-vN（N 跟随最终合并次序） |
| M8_VERSION.rulesVersion | s13-g2-3-vN |
| M8_VERSION.contentVersion | s13-14.24b-g2-3-vN |
| RULES_GAP_MANIFEST.g23 | 新 rewards 标签及 forge 源池/准入池/排除项/去重/超时约定纳入摘要 |
| CONTENT_DIGEST / LOOT_REPLAY_DIGEST | 由最终内容生成，不能预测或沿用 #147/#149 的值 |
| schema/save/replay/commandProtocol | 预计仍为 7/3/3/3；seat-mechanics-v1、g2-3-progress-v1 不变，复用现有结构与收据 |
| CONSUMABLE_RULES | 本批只保留普通重铸边界则无需升级；若选择实现同类重铸，另升规则及相关摘要，不能夹带 |

当前 multiplayer=v3；#147 声明 v4；#149 分支仍声明 v3。建议依赖合入时统一递增：#147=v4，#149 重新同步后=v5，本批锻造器=v6，即预计 s13-g2-3-v6 / s13-14.24b-g2-3-v6 和 g2-4b-forges-v6。**v6 是该顺序的预测，实际必须取两依赖合入后的最大版本再加一**；若期间另有规则 PR，继续递增。

后续实施用原录制器更新受新版本/digest 影响的内容，而不手改黄金哈希：

- scripts/record-g2-3-release.cjs：tests/g2-3-content-baseline.json、tests/fixtures/m5/full-match-golden.g2-3.json、g2-3-recorded-states/* 与 release-audit.json。
- tests/fixtures/record-g2-3-herald.cjs：g2-3-herald-raw/* 及 manifest。
- scripts/record-g2-3-inputs.cjs：c19 最小输入、input-fixture-audit.json 等对应产物。
- scripts/record-g2-3-live-reveal.cjs：live-reveal-audit.json。
- recovery-regression-audit.json 应补本批新增四档与两类窗口的证据；按真实输入重演记录，不编造“已通过”。

无关对局若只有版本变化，应说明事件/RNG 是否保持一致；真实跨档奖励对局的金币、物品、选择事件自然会变化，不要求事件哈希强行保持旧值。完整 29/17 池以后开放还会改变确定性 offers，届时再次升规则/内容版本。

## 10. 依赖顺序与交付边界

推荐次序：

1. #144 已合入，作为本计划的接口前提，不重新实现成装锻造器。
2. 完成并合入 #147 的已实现神器目录及引擎能力。
3. #149 同步上述 multiplayer 后解决共享引擎、目录、版本和夹具冲突，再合入。反向合并也可，但第二个依赖必须完整保留第一个的实现；本计划推荐先 #147 是因为其已基于 #144 且声明 v4。
4. 从包含 **两者最终合并提交** 的 multiplayer 开锻造器实现分支；按 G24-FORGE-03 最终裁定建立可执行池，然后恢复 10/11/13/14 档、核对重铸边界、完善恢复校验、统一升版本和录制证据。
5. 剩余 8 神器+4 辅助装的新机制批完成后，将准入池扩为完整 29/17；移除阶段性排除记录并再次升级版本。若选择“首发必须全池”，这一步前移为第 4 步前置依赖。

#147/#149 共同修改 g2-3-item-registry.ts、g2-3-policy.ts、content/index.ts、combat-s13.ts、m8/contracts.ts、m8/item-program.ts、m8/triggers.ts、strategy-snapshot.ts、m8/version.ts 及录制夹具。holder-death 等同名事件要统一实现，不能机械选一侧覆盖。两个 PR 的“物品定义已实现”不等于获取链、恢复链、标题分类已完成。

可分开的局部依赖：第 10/14 档依赖神器，第 11/13 档依赖辅助装；但本次用户目标是同批交付四档，建议两依赖都齐后一次切换。不能先移除所有延后项、等下个 PR 再补目录。

锻造器获取仍用与第 9 档相同的奖励驱动 forge 弹窗；不新增其他掉落渠道、常驻商店、可交易库存锻造器，也不接入冠冕批。服务器/界面所需改动通过合同和 UI_REQUESTS 交负责人。本次分支只放此计划文档。
