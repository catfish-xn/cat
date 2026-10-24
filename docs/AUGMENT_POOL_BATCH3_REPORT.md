# 增幅池第三批报告（v23 candidate，2026-10-24）

分支 `claude/augment-pool-batch3`：基于 `claude/v22-integration`（cefde414），合入 `codex/augment-pool-batch1`（6c9a2656）以复用其发放账本、锻造器池和复制器发放，未改动第一、二批内容。
来源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`（中文名与描述取 14.24 zh_cn 原文）；批次划分取 `perf-1022/augment-pool/classification.json` 的 batch="3"（135 条，全部为 C 类新机制；D 类 14 条不在本批）。

## 135 条按机制分组

| 组 | 条数 | 本次完成 | 主要阻碍 |
|---|---|---|---|
| G7 英雄技能重写 | 7 | 6 | 需逐个重写英雄技能，原版只有 tooltip 数值，缺技能完整参数 |
| G5 训练假人/魔像/克隆 | 10 | 7 | 需新增训练假人/魔像/复制体单位；假人基础属性与成长缺源值 |
| G6 战斗内新行为 | 23 | 7 | 战斗模拟内新增触发；多数数值齐，需要战斗事实字段与录制认证 |
| G4 备战席/装备/弈子变换 | 22 | 0 | 改动备战席/装备/弈子所有权，涉及恢复校验链 |
| G2 免费刷新与商店/买经验规则 | 21 | 4 | 需要新的“免费商店刷新”账本与商店规则原语，当前仓库没有 |
| G8 小小英雄/选秀/强化选择/任务 | 19 | 0 | 需要玩家血量/选秀/强化选择/跨玩家数据接入 |
| G3 回合/阶段/等级调度 | 14 | 3 | 需要“回合开始/升级时”稳定触发点；经验发放要改恢复时的经验校验链 |
| G1 对战计数/胜负/阵亡/淘汰计数发放 | 19 | 12 | 从已认证战斗收据推导，复用第一批发放账本 |

## 已完成：G1 子组 3a-1（11 条，其中 3 条为 P 口径）

规则：从获得强化的那一回合的战斗开始计数（含该回合）；只数玩家对战（roundKind=pvp），平局不算失败；阵亡数取战斗事实 `alliedDeaths`（PvE 也计，余数跨战累计）。奖励在达到阈值那一回合的结算里发放，走第一批的唯一收据账本，恢复时按战斗收据逐项重算并校验。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 团队建设 | `team-building` | 银 | PlayerCombatNum=7 | 即刻1次级英雄复制器；第7场玩家对战后再1个 |
| 休眠锻炉 | `latent-forge` | 银 | Numberofcombats=8 | 第8场玩家对战后1神器锻造器（4选项） |
| 成吨的伤害 | `phreaky-friday` | 彩 | CombatNum=5 | 即刻1三相之力；第5场玩家对战后再1个 |
| 成吨的伤害+ | `phreaky-friday-plus` | 彩 | CombatNum=3 | 即刻1三相之力；第3场玩家对战后再1个 |
| 暗巷交易 | `dark-alley-dealings` | 彩 | CombatNum=3 | 即刻1迷离风衣；第3场玩家对战后1诡术师之镜 |
| 活体锻炉 | `living-forge` | 彩 | Numberofcombats=9 | 即刻1神器锻造器；此后每9场玩家对战再1个 |
| 在失败中变强 | `what-doesnt-kill-you` | 金 | Gold=2, RoundsPerComponent=4 | 每输1场玩家对战+2金；每输4场1随机基础装备 |
| 以眼还眼 | `eye-for-an-eye` | 银 | AllyDeaths=15, NumComponents=4 | 每阵亡15名己方弈子1随机基础装备，最多4件 |
| 以眼还眼+ | `eye-for-an-eye-plus` | 银 | AllyDeaths=13, NumComponents=3, {a6cb80ca}=1 | 即刻1随机基础装备；每阵亡13名己方弈子再1件，阵亡给的最多3件（P） |
| 赏金战士 | `prizefighter` | 金 | WinsNeeded=5, component=2 | 即刻2随机基础装备；每赢5场玩家对战1件（P：只数玩家对战胜利） |
| 金鳞精粹 | `shimmerscale-essence` | 彩 | CombatNum=5 | 即刻1大亨之铠；第5场玩家对战后1投机者之刃（P：按 CombatNum 计玩家对战） |

## G1 其余 8 条（未做，原因）

- 弑君突刺（`TFT_Augment_Kingslayer`，银）：缺对手血量战斗事实（需加字段）
- 幸存者（`TFT_Augment_Survivor`，银）：淘汰人数不在本席状态里，需从房间接入
- 耐心学习（`TFT9_Augment_LearningFromExperience2`，金）：胜负给经验：要改经验恢复校验链
- 前瞻思维（`TFT_Augment_ForwardThinking`，金）：清空金币再返还：需要扣金收据
- 反响（`TFT_Augment_Replication`，金）：三选一基础装备管线未接
- 盗墓者 I（`TFT_Augment_TombRaider1`，金）：淘汰玩家装备选择：需房间数据+三选管线
- 盗墓者 II（`TFT_Augment_TombRaider2`，彩）：同上
- 虚空虫群（`TFT_Augment_Voidborne`，彩）：兹若特传送门/虚灵加成未实现


## 已完成：G2 免费刷新（4 条）

新增免费商店刷新账本 `src/simulation/free-rerolls.ts`（P，见 S13_RULES_GAP）：免费次数从已拥有强化和当前回合推导，只存已用次数；离线 `rerollShop` 与联机 `rerollSharedShop` 都先用免费次数再扣 2 金；恢复时校验已用次数。2D 商店按钮显示“免费刷新 · 剩 N 次”，联机免费刷新也播放刷新音效。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| D个痛快！ I | `rolling-for-days-i` | 银 | Numrolls=11 | 11次免费商店刷新 |
| 超级巨星 I | `superstars-i` | 银 | BaseBonusDamage=0.05, BonusDamagePer3Star=0.02, Rerolls=2 | 全队+5%伤害，场上每个3星己方弈子再+2%；2次免费刷新 |
| 超级巨星 II | `superstars-ii` | 金 | BaseBonusDamage=0.07, BonusDamagePer3Star=0.05, Rerolls=4 | 全队+7%伤害，每个3星再+5%；4次免费刷新 |
| DD街区 | `trade-sector` | 金 | Gold=1 | 即刻1金；每回合1次免费刷新（P：从获得回合起每回合序号1次，累计保留） |

G2 其余 17 条暂缺：
- 新纪元/新纪元+、升级咯！、上进心、大买特买：要发经验或改买经验价格、按升级触发，需要改恢复时的经验校验链或记录获得时等级。
- 刷新转换：要追踪之后强化选择里没用的刷新次数。
- 耐心是一种美德、由二生D：要上一回合是否购买、上一战登场2费弈子的认证事实。
- 棱彩门票：每次刷新45%返还，需独立随机流和刷新次数记录。
- 投资+/++：按回合开始时的金币给刷新，需记录回合开始金币。
- 操纵商店+、火爆甩卖、商店故障、四费增援、订阅服务、双重目的：要改商店生成或购买规则。


## 已完成：回合/阶段开始发放（4 条：G3 3 条 + G1 珍藏财宝 III）

新增回合进入发放钩子 `drainBatch3RoundEntry`（离线 `nextRound`、联机 `advanceMultiplayerRound` 两条路径都接；P，见 S13_RULES_GAP）。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 珍藏财宝 III | `building-a-collection-iii` | 彩 | roundsofbonusitems=6 | 即刻1随机基础装备，之后5次回合进入各1件 |
| 值得等待 | `worth-the-wait` | 金 | Delay=2, AdditionalCopies=99, UnitTier=1 | 即刻1个随机2星1费；获得后第2次回合进入起每回合1个该弈子的1星版本 |
| 值得等待 II（选秀回合顺延，P） | `worth-the-wait-ii` | 彩 | AdditionalCopies=99, UnitTier=2 | 即刻1个随机2费；之后每次回合进入1个同名1星 |
| 灵活摇摆 | `flexible` | 彩 | StartingEmblems=1, BonusStages=99, HPPerEmblem=40 | 即刻1随机纹章，之后每个阶段开始1个；上场弈子按全队携带纹章总数每个+40生命（P） |


## 已完成：战斗内效果（G6，7 条）

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 腐蚀 | `corrosion` | 银 | ResistLoss=3, Time=2 | 每2秒，开战时站在前两排的敌人 -3 护甲/魔抗，本场叠加（P） |
| 炽热灵魂 I | `blazing-soul-i` | 金 | AbilityPower=20, AttackSpeed=0.2, TransferDuration=3 | 开战起每3秒，攻速最高的另一名友军获得3秒 +20法强/+20%攻速（P） |
| 炽热灵魂 II | `blazing-soul-ii` | 彩 | AbilityPower=35, AttackSpeed=0.3, TransferDuration=3 | 同上，+35法强/+30%攻速（P） |
| 高贵牺牲 | `noble-sacrifice` | 金 | BaseResists=25, SharePerc=0.1 | 本场第一名友军阵亡时，存活友军 +25+10%该友军护甲/魔抗（P） |
| 健康就是财富 I | `wealthy-rehab-i` | 银 | Omnivamp=0.1, HealingThreshold=10000, Gold=8 | 全队10%全能吸血；累计治疗首次满10000给8金（P） |
| 厄运保护 | `bad-luck-protection` | 金 | ADPerCrit=0.01, CritChancePercent=1 | 全队不能暴击，每1%暴击率换1%攻击力；即刻1拳套（P） |
| 健康就是财富 II | `wealthy-rehab-ii` | 金 | Omnivamp=0.15, HealingThreshold=10000, Gold=15 | 全队15%全能吸血；累计治疗首次满10000给15金（P） |

接入点：`combat-augment-effects.ts` 的周期钩子（与发条加速器同一套可序列化状态贡献），`m8/restore.ts` 增加腐蚀专用的来源/时点/系数校验，战斗中途存档可严格恢复。

战斗中途存档校验：炽热灵魂、高贵牺牲、健康就是财富的贡献是限时或随单位变化的，改为整场回放逐字段比对（更严格，篡改即失败），见 S13_RULES_GAP 的 P 条目。

本组仍未做：


## 已完成：训练假人（G5，6 条）

新增单位 `training-dummy`（`content/batch3-summons.ts`）与假人奖励逻辑（`augment-pool-batch3-progress.ts` 的 `drainBatch3Dummies`/`validateBatch3Dummies`），口径见 S13_RULES_GAP 的 P 条目。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 辅助挖矿 | `support-mining` | 银 | NumDeaths=7 | 1个训练假人；它第7次阵亡给随机辅助装并移除它 |
| 辅助挖矿+ | `support-mining-plus` | 银 | NumDeaths=4 | 同上，第4次 |
| 替罪羊 | `scapegoat` | 金 | InitialGold=4, Gold=1 | 1个假人+4金；玩家对战中它第一个阵亡时+1金 |
| 漫游训练师 I | `wandering-trainer-i` | 金 | NumOfEmblems=2, Gold=1 | 1金+携带2个永久纹章的假人 |
| 漫游训练师 II | `wandering-trainer-ii` | 彩 | NumOfEmblems=3, Gold=6 | 6金+携带3个永久纹章的假人 |
| 假人金币 | `gold-for-dummies` | 金 | GoldDuration=10, GoldAmount=1 | 1个假人；战斗中每10秒每个存活假人1金 |
| 塔防游戏 | `tower-defense` | 金 | DummyAD=60, DummyAS=0.4；APRatio 60/90/135，Upgrade1Stage=3 (+25%AS)，Upgrade2Stage=5 (+50%箭) | 带1个纹章、会射击的假人，按阶段升级（P） |

假人化、魔像化（要移除全部弈子并按其面板生成单位，涉及联机共享池归还与装备去向）暂未做。


## 已完成：金蛋、崇高冒险（2 条）

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 金蛋 | `the-golden-egg` | 彩 | EggTurns=11；GoldenEggLoot A–I 权重 0.10/0.15/… | 11回合倒计时，赢玩家对战多减1；孵化时按权重抽一档奖励（P） |
| 崇高冒险 | `an-exalted-adventure` | 彩 | NumUnits=3；AdventureLoot A–F 权重 0.16/0.18 | 3个不同2费+次级复制器，每阶段再给复制器；两名升3星后下回合给一档奖励（P） |

奖励表原样存于 `content/augment-pool-batch3-loot.ts`（14.24 map22 原始权重与 apiName），抽档走独立随机流，回合进入时连同金币一起发放。


## 已完成：英雄强化（G7，6 条）

| 中文名 | 内部 id | 等级 | 行为（P，详见 S13_RULES_GAP） |
|---|---|---|---|
| 战地医生 | `field-medic` | 银 | 斯特卜：法力-10，3击×65%，30%技能吸血，不回血 |
| 刀锋之舞 | `blade-dance` | 银 | 艾瑞莉娅：+40%攻速，两段冲刺各 3.35AD+40AP |
| 震惊巨魔 | `shocking-troll` | 银 | 特朗德尔：法力-50，不回血，140%攻速5秒，永久+1.5%AD |
| 残暴复仇 | `savage-revenge` | 金 | 2个荏妮：法力-10，猛扑2格内最远敌人，伤害×1.1，途经150%AD |
| 卯足全力 | `all-out` | 金 | 范德尔：不给双抗，强化普攻×1.85，相邻溅射25% |
| 血色契约 | `blood-pact` | 金 | 弗拉基米尔：+3射程/+3法力每攻，1.8×伤害，最近敌人独立90/135/205AP，叠加10%增伤 |

炼金术士（辛吉德毒迹）暂缺。


## 已完成：战争财宝 I/II/III（3 条）

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为（P） |
|---|---|---|---|---|
| 战争财宝 I | `spoils-of-war-i` | 银 | LootDropChance=0.25；Tier1Table0–6 | 第 k 个阵亡敌人查座位表第 3k 格，命中给 1/2/3 金 |
| 战争财宝 II | `spoils-of-war-ii` | 金 | 0.30；Tier2Table0–6 | 同上 |
| 战争财宝 III | `spoils-of-war-iii` | 彩 | 0.40；Tier3Table0–6 | 同上 |

## 其余各组清单

**G7 英雄技能重写**（7）：战地医生、刀锋之舞、炼金术士、震惊巨魔、残暴复仇、卯足全力、血色契约

**G5 训练假人/魔像/克隆**（10）：假人化、辅助挖矿、辅助挖矿+、替罪羊、漫游训练师 I、克隆设施、假人金币、魔像化、漫游训练师 II、镜廊

**G6 战斗内新行为**（23）：有用之材 I、腐蚀、健康就是财富 I、冲榜战士、金色收获、天涯若比邻、厄运保护、炽热灵魂 I、五级飓风、恶意货币化、月光、高贵牺牲、过量治疗、满意的织法者、拾荒者、健康就是财富 II、幸运手套、幸运手套+、交给运气、炽热灵魂 II、老友幽魂、高级月光、白蹭

**G4 备战席/装备/弈子变换**（22）：精致古董、运力不足、潘朵拉的装备、变形重组器、潘朵拉的备战席、基础装备自助餐、精心打造、延迟开始、重启任务、物尽其用、物尽其用+、清晰头脑、打捞桶、纷乱头脑、打捞桶+、潘朵拉的装备 II、不侦察，不变阵、潘朵拉的装备 III、神器工厂、最大规模、狂暴到底、重质不重量

**G2 免费刷新与商店/买经验规则**（21，已做4）：D个痛快！ I、火爆甩卖、耐心是一种美德、刷新转换、操纵商店+、超级巨星 I、新纪元、新纪元+、四费增援、DD街区、商店故障、超级巨星 II、由二生D、棱彩门票、升级咯！、大买特买、双重目的、投资+、投资++、订阅服务、上进心

**G8 小小英雄/选秀/强化选择/任务**（19）：午餐钱、冒险举动、不拘一格、乞亦有择、进攻宣告、威力提升、餐桌剩菜、巨型泰坦、又一个异常突变、假装摸鱼、纷争、吸血生机、挖角、不计代价、扭转命运、光荣进化、真心本色、最小巨人、最小巨人+

**G3 回合/阶段/等级调度**（14）：后期专家、游神的盟友、多元化投资、多元化投资+、游神的眷顾、金色炊具、羁绊追踪者、值得等待、生日礼物、游神的神选、珍藏财宝 III、灵活摇摆、硬性承诺、值得等待 II

## 测试

- `tests/augment-pool-batch3.test.ts` 69 项：44 条的名称/等级/描述/数值与 14.24 研究 JSON 一致并已入池；静态互斥；阈值恰好触发、PvE 不计、获得前的战斗不计、单次项不重复；活体锻炉重复发放且每个锻造器有独立4选项；即刻奖励；失败/胜利计数（平局、PvE 不计）；阵亡余数、单战跨档与上限（含以眼还眼+ 的 1+3）；排空幂等、篡改金额/删战斗收据/缺收据被恢复校验拒绝；免费刷新：离线与联机共享池都先用免费次数再扣金、第12次付费、公开选择后存档恢复一致、超额/零/格式错误的已用次数被拒绝；超级巨星按场上3星数计伤害增幅；回合/阶段开始发放的时点、同名复制、上限，以及经真实回合推进后的收据与存档恢复；灵活摇摆生命值；腐蚀的脉冲时点、只打开战前两排、每队一次；炽热灵魂的转移与排除上一受益者；高贵牺牲只按第一名阵亡者计算一次；健康就是财富的吸血声明、治疗事实与首次过阈值发金；厄运保护无暴击、暴击率换攻击力、拳套；选秀回合不发弈子而顺延；训练假人不移动不攻击、不可出售/装备/合成，假人阵亡/首亡/金币脉冲计数，移除与纹章附着的篡改被拒，公开选择后跨回合存档恢复；金蛋计时/胜场加速/选秀顺延/抽档权重与内容解析；崇高冒险三名不同2费、每阶段复制器、第二个3星后发奖；真实对局战斗中途存档恢复，以及改动贡献数值、受益者记录、治疗计数后恢复被拒绝。
- 扩池后按第二批做法只改独立 oracle 池表、出牌总数（149→193）和受种子影响的旧测试：`g2-augments-combat` 爬梯子种子 109→600、孤胆英雄 20→689，`s13-augments-p2-choice` 路线种子 7329→1736、6672→107，`augment-offer-rules-v22` 种子 9→10，`augment-offer-rules-v22-external` 期望改按 apiName 计算；种子均为顺序搜索所得，原断言不变。
- 强化相关 21 个文件加 `tp-shared-pool`、`shop` 和 4 个联机房间测试共 27 文件，除下条外全部通过；渲染相关 4 文件 103/103 通过；typecheck 通过。
- `tests/server/carousel-room.test.ts` 的“选秀后第一战被淘汰”一项在合入第一批后的基线（3a2e703d）上就已失败（期望 5-6 淘汰，实际 6-1，机器人选到的强化随池子变化），本分支未改它。
- 身份/金标测试（m8-content-equivalence、opening-random-identity、content-identity-constants、g2-3-content）在合入第一批后的基线上就已 246 项失败，属 v23 候选待统一重录；本分支未重录、未改身份常量。
- `g2-4b-resists-restore` 的种子 42/5 开局强化随扩池变成会走回放的强化，测试改为公开选择固定的纹章类强化（ambusher-crest / enforcer-crest），现 21/21 全过。
- `g2-4b-pr161-restore` 2 项失败，与基线 3a2e703d 完全相同：在合入第一批后的基线 3a2e703d 上这两个文件失败 13 项，上一提交 7cc6760b 也是这 2 项，均为扩池后固定种子路线变化，本组未新增；与 carousel-room 一项一起留待 v23 集成统一处理。
- 扩池后的测试夹具修正：`augment-offer-rules-v22` 的推进辅助函数在礼包强化塞满备战席时卖一个非召唤单位；`g2-augments-choice` 跳过开局带不可下场魔像的种子；`g24-natural-forge` / `g2-4b-pr161-restore` 的卖单位步骤跳过训练假人；`g2-4b-resists-restore` 改为公开选择首个纹章类或纯经济强化。
- `rendering3d-scout-shop` 的一项在本机满载时 5 秒超时，上一提交 13da4a41 同样超时，与本组改动无关。
- 扩池后又修了几处卖单位夹具（b8-public-equipment、b8-public-acquisition、explorer-bracer-public、g2-3-academy-public、r3r4-public 跳过不可出售的召唤物），`g2-4b-resists-restore` 的公开选择在没有合适卡时先用每格一次的免费刷新。
- 仍随种子变化而失败、未改：`task-mechanism-restore` 的“Bulky Buddies 持有者与锻炉复活”（种子 22 的公开路线不再出现 Bulky Buddies I，0–80 号种子都不满足该场景；上一提交 7c914539 同样失败）、`server/carousel-room` 的“选秀后第一战被淘汰”（基线 3a2e703d 就失败）、以及 pr161 2 项、resists-restore 1 项基线失败。
- 英雄强化入池后：独立 oracle 增加第三批的 AssociatedTraits/互斥表（`tests/augment-pool-batch3-oracle-data.cjs`）；v22 规则测试的跨玩家可封锁列表加入 All Out（真实 PrimeCarry），外部测试的重映射里 All Out 与 Geniuses 共用 apiName；`match-helpers` 新增 `quietAugmentRound`，`purchasedThreeHeroMatch` 改为公开选择纯经济/纹章强化；房间测试不再断言外部封锁列表为空。
- `match-session` 的“五回合保留购买阵容”在基线 3a2e703d 也失败（随扩池变化），未改。
- 第三批全部入池后再修一轮夹具：`quietAugmentRound`/`crestPick` 的“安静”名单扩到只给金币/散件/消耗品/未装备道具的强化（含第三批的 D个痛快、DD街区、战争财宝等），`task-mechanism-restore` 的黑玫瑰夹具固定在第 8 回合。
- 当前已知失败 7 项（强化、恢复、商店、共享池、联机房间 43 文件 993 项中）：task-mechanism-restore 3（召唤物击杀 2 项基线即失败、Bulky Buddies 锻炉复活）、pr161 1、resists-restore 1、carousel-room 1（以上基线即失败），以及 explorer-bracer 压力子进程 1（种子 3151248 的公开路线不再选到 Glass Cannon II，附近 5 个可选到的种子数值不符，留待集成重找）。


## 续做：G6 战斗内新行为 + G4 备战席/装备/弈子变换（分支 `claude/augment-pool-batch3-more`，2026-10-24）

在 `claude/augment-pool-batch3` 之上继续，取前三批都未完成的两组：G6 剩余 16 条与 G4 全部 22 条。同期另有 `claude/augment-pool-shop`（G2 商店规则）与 `claude/augment-xp-batch3`（经验/玩家血量链、阶段标签），本分支不碰这两条线的内容。口径与 P 条目见 S13_RULES_GAP 2026-10-24 新增的 8 条。

### 已完成（8 条）

| 组 | 中文名 | 内部 id | 等级 | 14.24 数值 | 行为（P） |
|---|---|---|---|---|---|
| G6 | 恶意货币化 | `mirrored-monetization` | 金 | GoldContained=2, PercCost=2, rounds=3 | 即刻 2 金；获得回合起 3 个回合序号内，玩家对战每阵亡 1 名敌方开战弈子 +2 金 |
| G6 | 有用之材 I | `good-for-something-i` | 银 | DropChance=0.5, Gold=1 | 开战未持装备的己方弈子阵亡时各自独立 50% 掉 1 金 |
| G6 | 金色收获 | `a-golden-find` | 金 | FreeRerolls=10, GoldPerRequirement=2, NumKillsRequirement=3 | 10 次免费刷新；异常突变弈子每 3 次击杀 2 金（跨战累计） |
| G6 | 天涯若比邻 | `long-distance-relationship` | 金 | PercentShare=0.22 | 开战最远两名友军互得对方 22% 护甲/魔抗/攻击力/法强 |
| G6 | 五级飓风 | `category-five` | 金 | TotalDamage=0.85, additionalbolts=1（AS 为 None，文案未用） | 1 个卢安娜的飓风；飓风多 1 支弩箭，每支 55%×85% AD |
| G6 | 满意的织法者 | `sated-spellweaver` | 金 | Omnivamp=0.2, Duration=3, MaxShield=300 | 施法后 3 秒 20% 全能吸血，其溢出治疗转护盾（≤300） |
| G6 | 白蹭 | `sponging` | 彩 | MaxUnits=5, MaxItemsToBeEligible=1 | 开战至多 5 名持装 ≤1 的弈子复制最近全装友军的一件随机成装 |
| G4 | 精心打造 | `crafted-crafting` | 银 | Rerolls=2 | 获得回合起每合成 1 件装备 +2 次免费刷新 |

互斥（14.24 MutuallyExclusiveItems，池内）：满意的织法者 ↔ 健康就是财富 I/II，五级飓风 ↔ 不是今天（not-today）；独立 oracle 表 `tests/augment-pool-batch3-oracle-data.cjs` 同步加入。出牌池 193→201。

接入点：结算事实新增 `batch3ItemlessDeaths`/`batch3AnomalyKills`（只在非零时出现，`validateG23BattleFacts` 校验 1–100 的整数）；`augment-pool-batch3-progress.ts` 新计数 `pvp-enemy-deaths`/`itemless-deaths`/`anomaly-kills`，金币走第三批金币收据并按战斗收据逐项重算；`free-rerolls.ts` 增加 `perCraft`（由 `item-combined` 资源记录推导）；五级飓风在 `s13-p3-programs.ts` 改写飓风物品程序（静态声明可校验）；天涯若比邻、满意的织法者、金色收获、白蹭四种机制加入 `BATCH3_REPLAYED_MECHANICS`，战斗中途存档整场回放比对；白蹭的复制品在 `strategy-snapshot.ts` 以强化来源编译，战斗中换装重算沿用开战结果。

### 未做（30 条，原因）

G6（9 条）：
- 冲榜战士（`TFT11_Augment_ScoreboardScrapper`，金）：需要每回合 8 人排名（跨席位血量排序）事实与并列规则，本席状态里没有。
- 月光（`TFT_Augment_Moonlight`，金）：数值冲突——官方 14.24 补丁说明写加成 20%→35%，归档描述与 map22 常量为 25%/25，实装值未确认；另 ItemBonus=None。
- 高级月光（`TFT_Augment_GreaterMoonlight`，彩）：ItemBonus=None；任意 1 费临时升 4 星需要认证的 4 星基础面板（现只有家人团聚/异常路径）。
- 过量治疗（`TFT_Augment_Overheal`，金）：Duration=3 不在文案里、含义未知；“回复该伤害的 50%”以额外伤害还是整次攻击为基数未确认。
- 拾荒者（`TFT_Augment_Scavenger`，金）：临时成装的接收者与装备池未给出；战斗中途发装备的校验目前只认不稳定的宝箱（TFT_Item_UnstableTreasureChest）。
- 幸运手套 / 幸运手套+（`TFT7_Augment_LuckyGloves` / `Plus`，彩）：“理想装备”的逐英雄装备表 14.24 资料里没有。
- 交给运气（`TFT9_Augment_RollTheDice`，彩）：光明窃贼手套及其“随机光明武器”池项目里没有、资料未给。
- 老友幽魂（`TFT_Augment_GhostOfUnitsPast`，彩）：角色→生命/攻击/法强的对应表缺失；法强单位冲突（模板 1 法强 vs 补丁说明 1%）。

G4（21 条）：
- 精致古董、潘朵拉的装备 I/II/III、神器工厂（另 Health=50 含义未知）、狂暴到底、重质不重量、打捞桶、打捞桶+（出售拆分成装）：都要把备战席/身上的装备改成另一件或拆成两件。现有资源记录里能改装备定义的只有征服者光明转换（`g23-item-converted`，在资源折叠与 b8 历史回放三处写死为 `g23:conqueror:15`）；需要一个通用、可在恢复时证明“哪些装备在当时备战席上、每件恰好变一次”的装备变换/移除记录，属于恢复校验链改造，本批未做。
- 基础装备自助餐（`TFT9_Augment_CustomerIsAlwaysRight`）：要拦截所有基础装备来源（PvE 掉落、选秀、强化/异常发放）改发锻造器。
- 运力不足（`TFT11_Augment_OverEncumbered`）：下一阶段备战席限 1 格的规则；Gold=None。
- 变形重组器、潘朵拉的备战席、延迟开始、重启任务：移除/变形弈子，要处理联机共享池归还与装备去向。
- 物尽其用、物尽其用+（基础版 XPNow=None）、清晰头脑、纷乱头脑：发经验，依赖 `claude/augment-xp-batch3` 的经验恢复校验链，本分支没有。
- 不侦察，不变阵（`TFT_Augment_NoScoutNoPivot`）：参战后锁定不可回收/出售与逐单位永久成长；{eba92878}=None。
- 最大规模（`TFT_Augment_MaxCap`）：金锅锅冠冕（小队规模 +1 的战术家装备）未实现，另需等级上限 7 的规则。

### 测试

- 新增 `tests/augment-pool-batch3-more.test.ts` 15 项：8 条的 apiName/等级/数值对照手抄的 14.24 表与研究 JSON，编译后系数；互斥；恶意货币化的窗口、PvE 不计、收据篡改被拒；有用之材只标记无装备弈子、结算事实、独立 50% 掉落（400 次统计与确定性）、非法事实被拒；金色收获的免费刷新、跨战余数、真实战斗击杀计数与结算事实；天涯若比邻首 tick 最远两人互得 22% 四项属性；五级飓风弩箭目标与伤害改写及发放；满意的织法者吸血窗口、溢出转盾等于累计溢出且 ≤300；精心打造按合成记录给刷新、获得前的合成不计；白蹭的接收者/最近全装供体/候选池/上限 5、换装重算沿用开战结果；天涯若比邻、满意的织法者、白蹭的真实公开选择 + 战斗中途存档严格恢复与篡改被拒。
- 扩池（193→201）后只改了受种子影响的旧测试：`g2-augments-choice` 出牌总数 201；`g2-augments-combat` 爬梯子之外的血色打击种子 0→713；`s13-augments-p2-choice` 冠冕→三相→克格莫链种子 1736→15277、三相娜美 107→6590（均为顺序搜索所得，原断言不变）；第三批行列表测试加入 8 个新 id。
- `tests/*augment*` 22 个文件 792/792 通过；typecheck 通过。
