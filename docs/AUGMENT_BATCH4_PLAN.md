# 强化池 Batch 4 盘点与实施计划（2026-10-25）

基线 `codex/v23-b3rest` / `87a013f1`。Codex 只做规则、内容与恢复认证；不改界面、存档字段或身份常量。

## 对照口径

源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`（312条）；旧缺口：`/home/aiapps/workspcae/augment-pool-gap-2026-10-23.md`（旧 de29d695 基线，不能继续使用246缺失数）。逐项对照当前 `augment-pool*.ts`、`augment-policy.ts`、`augment-offer-rules.ts` 的 API 映射及定义，并核对 Batch1/2/3-XP blocked 表。基线208条已注册，104条未注册，其中102条常规待办、2条HR排除。禁用项仍属于未实现，不因存在原始内容行就计入完成。

“完整”指14.24数据已有影响效果的数值和行为；随机分布/支付顺序继续明确标P，不冒称原服概率。缺独立数值或关键行为的一组标“部分/不完整”，不能整组开放。按机制分组，不按工作量拆分；选整组完整且条数最多者（等级奖励5条）。

## 剩余清单（基线，实施前）

### 等级触发奖励（5条；完整）

奖励、费用公式、星级、阈值、五选一数量齐；随机权重沿用既有 P-AG1/2。5 条，为本次选择。

| 名称 | apiName |
|---|---|
| 游神的盟友 | `TFT9_Augment_BardPlaybook1` |
| 后期专家 | `TFT7_Augment_LategameSpecialist` |
| 游神的眷顾 | `TFT9_Augment_BardPlaybook2` |
| 生日礼物 | `TFT7_Augment_BirthdayPresents` |
| 游神的神选 | `TFT9_Augment_BardPlaybook3` |

### 战后检查备战席，发经验（4条；完整）

空英雄席／满英雄席／空装备库存条件、XP 与初始奖励齐（4 条）。

| 名称 | apiName |
|---|---|
| 清晰头脑 | `TFT6_Augment_ClearMind` |
| 纷乱头脑 | `TFT7_Augment_ClutteredMind` |
| 物尽其用 | `TFT11_Augment_Slammin` |
| 物尽其用+ | `TFT11_Augment_Slammin_Plus` |

### 每轮按金币或购买记录发免费刷新（3条；完整）

前轮不买英雄条件、50/80 金边界、每10金一次均齐（3 条）。

| 名称 | apiName |
|---|---|
| 耐心是一种美德 | `TFT_Augment_PatienceIsAVirtue` |
| 投资+ | `TFT_Augment_InvestedPlus` |
| 投资++ | `TFT_Augment_InvestedPlusPlus` |

### 强化选项与刷新额度改写（4条；部分）

ExtraRolls/升阶/转换数量齐；PowerUp 已棱彩时行为、AtWhatCost 已高于6级行为未给。

| 名称 | apiName |
|---|---|
| 乞亦有择 | `TFT_Augment_BeggarsCanBeChoosers` |
| 威力提升 | `TFT_Augment_PowerUp` |
| 刷新转换 | `TFT_Augment_RerollTransfer` |
| 不计代价 | `TFT11_Augment_AtWhatCost` |

### 商店刷新／购买／场上费用触发（8条；部分）

指定3费周期、下一4费升星、首次买XP回金齐；星夜哈希概率到等级映射、商店故障非对战计时边界未给。

| 名称 | apiName |
|---|---|
| 操纵商店+ | `TFT_Augment_RiggedShopPlus` |
| 四费增援 | `TFT11_Augment_Reinfourcement` |
| 商店故障 | `TFT_Augment_ShopGlitch` |
| 星夜 | `TFT_Augment_StarryNight` |
| 星夜+ | `TFT_Augment_StarryNightPlus` |
| 由二生D | `TFT_Augment_TwoMuchValue` |
| 双重目的 | `TFT_Augment_DualPurpose` |
| 棱彩门票 | `TFT6_Augment_GachaAddict` |

### 装备转换、拆解与替代奖励（12条；部分）

潘朵拉/神器转换类别和数量齐；精致古董跨回合计龄、合成重复赞助去重、狂暴到底特殊成装边界未给；不将已有禁用项当成已实现。

| 名称 | apiName |
|---|---|
| 基础装备自助餐 | `TFT9_Augment_CustomerIsAlwaysRight` |
| 精心打造 | `TFT_Augment_CraftedCrafting` |
| 精致古董 | `TFT11_Augment_FineVintage` |
| 潘朵拉的装备 | `TFT6_Augment_PandorasItems` |
| 学术研究 | `TFT13_Augment_Academy` |
| 潘朵拉的装备 II | `TFT9_Augment_PandorasItems2` |
| 打捞桶 | `TFT6_Augment_SalvageBin` |
| 打捞桶+ | `TFT8_Augment_SalvageBinPlus` |
| 狂暴到底 | `TFT_Augment_OopsAllRageblades` |
| 神器工厂 | `TFT_Augment_Artifactory` |
| 潘朵拉的装备 III | `TFT9_Augment_PandorasRadiantBox` |
| 重质不重量 | `TFT_Augment_QualityOverQuantity` |

### 英雄永久变形、出售及操作限制（7条；部分）

重启奖励齐；变形装备/异常继承、备战席变形合星顺序、锁定与自动发奖冲突未给。

| 名称 | apiName |
|---|---|
| 火爆甩卖 | `TFT_Augment_FiresalePlus` |
| 运力不足 | `TFT11_Augment_OverEncumbered` |
| 潘朵拉的备战席 | `TFT7_Augment_PandorasBench` |
| 变形重组器 | `TFT6_Augment_Recombobulator` |
| 重启任务 | `TFT_Augment_RestartMission` |
| 假装摸鱼 | `TFT_Augment_BRB` |
| 不侦察，不变阵 | `TFT_Augment_NoScoutNoPivot` |

### 跨玩家排名、淘汰、选秀资源（9条；部分）

排名/淘汰金币阈值齐；未选剩余资源分配、盗墓候选及多人同时淘汰排序未给；自由移动无当前规则对应。

| 名称 | apiName |
|---|---|
| 多元化投资 | `TFT_Augment_DiversifiedPortfolio1` |
| 多元化投资+ | `TFT_Augment_DiversifiedPortfolio2` |
| 幸存者 | `TFT_Augment_Survivor` |
| 餐桌剩菜 | `TFT_Augment_TableScraps` |
| 不拘一格 | `TFT9_Augment_YoungAndWildAndFree` |
| 纷争 | `TFT_Augment_Contested` |
| 冲榜战士 | `TFT11_Augment_ScoreboardScrapper` |
| 盗墓者 I | `TFT_Augment_TombRaider1` |
| 盗墓者 II | `TFT_Augment_TombRaider2` |

### 玩家伤害及生命／战后金币（9条；部分）

伤害阈值及金/治疗量齐；最大HP扩展、最小巨人移动加速具体量、ForwardThinking期间金币冻结与利息语义未给。

| 名称 | apiName |
|---|---|
| 进攻宣告 | `TFT_Augment_CalledShot` |
| 有用之材 I | `TFT10_Augment_GoodForSomethingSilver` |
| 午餐钱 | `TFT11_Augment_BloodBank` |
| 巨型泰坦 | `TFT_Augment_TitanicTitan` |
| 前瞻思维 | `TFT_Augment_ForwardThinking` |
| 恶意货币化 | `TFT_Augment_MirroredMonetization` |
| 吸血生机 | `TFT_Augment_Dhampyr` |
| 最小巨人 | `TFT9_Augment_TiniestTitan` |
| 最小巨人+ | `TFT9_Augment_TiniestTitanPlus` |

### 装备选择及后续复制（6条；部分）

候选数和数量齐；生金神器候选池/InterestCap、理想手套映射、反响首次选项抽样权重未给。

| 名称 | apiName |
|---|---|
| 闪若金鳞 | `TFT9_Augment_AllThatShimmers` |
| 闪若金鳞+ | `TFT_Augment_AllThatShimmersPlus` |
| 反响 | `TFT_Augment_Replication` |
| 幸运手套 | `TFT7_Augment_LuckyGloves` |
| 幸运手套+ | `TFT7_Augment_LuckyGlovesPlus` |
| 交给运气 | `TFT9_Augment_RollTheDice` |

### 战斗触发永久成长／任务奖励（11条；部分）

三个6费任务奖励和阈值齐；老友角色→属性映射、狙巢重置继承、黑玫3英雄抽样和硬承诺无匹配费用回退未给。

| 名称 | apiName |
|---|---|
| 金色收获 | `TFT13_Augment_AGoldenFind` |
| 金色炊具 | `TFT_Augment_CookingPot` |
| 禁忌魔法 | `TFT13_Augment_Cabal` |
| 挖角 | `TFT_Augment_Pilfer` |
| 狙神之巢 | `TFT13_Augment_Sniper` |
| 羁绊追踪者 | `TFT_Augment_TraitTracker` |
| 扭转命运 | `TFT13_Augment_Grant6Cost_MissMage` |
| 老友幽魂 | `TFT_Augment_GhostOfUnitsPast` |
| 光荣进化 | `TFT13_Augment_Grant6Cost_Viktor` |
| 硬性承诺 | `TFT_Augment_HardCommit` |
| 真心本色 | `TFT13_Augment_Grant6Cost_Warwick` |

### 英雄技能替换（1条；不完整）

辛吉德毒迹伤害、频率、路径及移速数值未给。

| 名称 | apiName |
|---|---|
| 炼金术士 | `TFT13_Augment_SingedCarry` |

### 羁绊战斗增强／召唤（6条；不完整）

现有禁用原因仍有效；另虚空虫群依赖传送门虚灵完整数值与出生规则。

| 名称 | apiName |
|---|---|
| 空战 | `TFT13_Augment_Firelight` |
| 战利品爆炸 | `TFT13_Augment_Ambusher` |
| 爆蓝之城 | `TFT13_Augment_Rebel` |
| 物竞天择 | `TFT13_Augment_Experiment` |
| 虚空召唤者 | `TFT13_Augment_Visionary` |
| 虚空虫群 | `TFT_Augment_Voidborne` |

### 开战复制、临时星级及装备分配（6条；部分）

复制HP/法耗/减伤及月光数值齐；物品/异常继承、镜廊中间并列、低费不存在处理及临时装备分配权重未给。

| 名称 | apiName |
|---|---|
| 克隆设施 | `TFT_Augment_CloningFacility` |
| 月光 | `TFT_Augment_Moonlight` |
| 拾荒者 | `TFT_Augment_Scavenger` |
| 高级月光 | `TFT_Augment_GreaterMoonlight` |
| 镜廊 | `TFT_Augment_HallOfMirrors` |
| 白蹭 | `TFT_Augment_Sponging` |

### 开战最远单位属性分享（1条；完整）

最远两单位、22%四属性分享齐（1 条）。

| 名称 | apiName |
|---|---|
| 天涯若比邻 | `TFT9_Augment_LongDistanceRelationship2` |

### 战斗额外弩箭（1条；完整）

额外1箭、85%原伤害及初始飓风齐（1 条）。

| 名称 | apiName |
|---|---|
| 五级飓风 | `TFT_Augment_CategoryFive` |

### 攻击／施法触发吸血转盾（2条；完整）

触发次数、伤害、吸血、盾上限及持续时间齐（2 条）。

| 名称 | apiName |
|---|---|
| 过量治疗 | `TFT_Augment_Overheal` |
| 满意的织法者 | `TFT_Augment_SatedSpellweaver` |

### 阶段奖励／特殊商店／等级上限（7条；部分）

MaxCap金币/上限齐；另异常装备、骰子奖励表、攻装魔像全数值、棱彩法球增量掉落表未给。

| 名称 | apiName |
|---|---|
| 延迟开始 | `TFT_Augment_HeadStart` |
| 又一个异常突变 | `TFT13_Augment_AnotherAnomaly` |
| 意料之中的意外 | `TFT_Augment_ExpectedUnexpectedness` |
| 我成C位了 | `TFT_Augment_ImTheCarryNow` |
| 最大规模 | `TFT_Augment_MaxCap` |
| 棱彩管道 | `TFT_Augment_PrismaticPipeline` |
| 订阅服务 | `TFT_Augment_SubscriptionService` |

### HR 模式变体（排除）（2条；不纳入）

源目录含 HR，不是本次常规八人池。

| 名称 | apiName |
|---|---|
| 打捞桶 | `TFT6_Augment_SalvageBinHR` |
| 虚空虫群 | `TFT_Augment_VoidborneHR` |

## 本次交付边界

实现游神的盟友、后期专家、游神的眷顾、生日礼物、游神的神选。复用取得等级 seat mechanic、现有 roundResults 等级轨迹、Batch1 礼物/满席待发/联机法球、金币唯一收据和锻造器。光明奖励严格五选一。生日礼物10级按源公式给6费二星，不自行封顶5费。原始 source.values 完整保留，包括 null；不改其他强化数值。无新增禁用需求，五条开放。完成后映射213条，常规待办97条，另2条HR。

约定详见 `S13_RULES_GAP.md` 的 P-B4 条目；接口、失败边界与测试结果在任务报告。
