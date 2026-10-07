# M9 分批方案（审计修订提案，未冻结为施工合同）

本方案以已复核签收的[M9数据台账](M9_DATA_LEDGER.md)（`3ae3962`）、固定B1归档`877c59b2`与[B2冻结合同](https://github.com/catfish-xn/cat/blob/2632925/docs/M8_RULES.md)为依据，修订原提案`369d905`的R1–R5。用户已同意合为**8个交付批**，原**17个编号保留为内部工作包**；本次只修订文档，不批准执行政策或开始游戏施工。

## 1. 范围、完整性与暂停条件

- 候选仅S13标准模式**60名1–5费英雄、1–3星普通分支：41名新增、19名已有**。英雄主归属保持唯一，C05/D06为羁绊配套工作包，不重复计英雄；已有英雄只按需补齐/回归，M8已完成迁移直接复用，不重复计工。
- 首批A01+A02仅需G01–G12既有能力及(a)表达；第二批A03+B01接(b)规划适配，**A03的Nocturne/Vex明确属于(b)**。第3批将金额/随机规划与独立FD01系统合批，后续(c)位移、分享、实验、装备、召唤和形态仍保留各工作包的合同/测试边界。第6–8批为条件队列，不因合批承诺日期。
- 完整英雄包括普通被动、主动、替换攻击、启用的形态和条件分支；换形不能只做一形态，实验不能删条件效果，Rumble基础火箭不能等同完整改造。未开放的4星/Hero/关系分支只归档。英雄技能与羁绊配套分别签收：Scar普通技能归A02，Firelight归C02；Jayce完整技能与Academy5补档同归D02。
- 本文正式目标仅**16套八人口阵容，每交付批2套**，无纹章、无关系强化、无6费，按累积目录核算全部实际激活档位。5铁卫取4档、4实验取3档，2/3使者不激活。名单顺序不规定站位，也不代表平衡强度；Vladimir射程1且自疗，属于近战副坦/输出。
- F为已有冻结项目规则，继续沿用，不重开批准；P为待提出的M9执行政策，明确采纳后才施工；D为真正缺少的必需数据/公式或同源冲突，不能靠政策猜值。未被启用效果引用的null/hash只归档；局部缺口只阻塞对应消费者/档位，不制造整批连带阻塞。
- Vander强化击暴击资格在M9按14.24历史规则修正，单列**M9行为变更**：无技能暴击授权不能暴击，实施同步规则/内容版本、digest及独立例。M8 B3继续B2 `basic-attack/basic`合同，Draven斧头不随之改资格。Zeri原mana=3的回蓝/施法资格须独立明确，不能与Amumu mana=0并列为普通无蓝。
- 延续[M9状态](M9_STATUS.md)的等待条件：**分批方案审定后暂停M9；等M8A（B3–B5）完成后，再冻结第一批执行合同。** 下文“可以开始施工”均指未来恢复后、对应合同/政策已就绪的技术条件，不是当前开工授权。取证可以按消费者设计并行安排，当前不提前实施游戏代码。

## 2. 八个交付批总览

| 交付批 | 内部工作包 | 主归属英雄数量 | 交付重点 | 正式阵容目标 |
| --- | --- | --- | --- | --- |
| 1 | A01＋A02 | 15：1新增＋14已有 | 通用法术/盾前排、守望狙击；A01先作内部试跑 | 1-A、1-B |
| 2 | A03＋B01 | 15：13新增＋2已有 | 通用技能、家人/伏击/先知、梦魇/薇古丝(b)适配 | 2-A、2-B |
| 3 | B02＋B03＋C01 | 8：全新增 | 金额账本、自动机/叛军、随机/轮转、固定扣减及六守望 | 3-A、3-B |
| 4 | C02＋C03 | 10：9新增＋1已有 | 位移/野火、四迅击死亡反应、分享/传播/Wanted | 4-A、4-B |
| 5 | C04＋C05 | 4：2新增＋2已有 | 实验条件、学院赞助、废铁临时装备 | 5-A、5-B |
| 6 | D01＋D02 | 5：全新增 | 条件队列：召唤/双形态及五学院补档 | 6-A、6-B |
| 7 | D03＋D04 | 2：全新增 | 条件队列：Nunu公式、Sevika子技能/High Roller | 7-A、7-B |
| 8 | D05＋D06 | 1：Rumble新增 | 条件队列：改造购买、经济奖励及对手进度 | 8-A、8-B |

编号表示建议交付顺序，**不构成1→8的整批施工链**。按实际接口和消费者并行：A03不等待A02全包；B02、B03各自设施可以先施工，但阵容分别确需Visionary及Rebel/Dominator；FD01可与B02/B03并行；C05普通学院/废铁不以C03 Wanted整包为门槛。D类各自取证，Nunu/Sevika/Rumble/经济系统按自己的缺口推进。

## 3. 可以开始施工与可以签收阵容的前置关系

全表共同前提为§1的恢复条件与相应执行合同/政策冻结。**施工只要求所消费接口和局部资料就绪；签收还要求阵内每位完整技能及全部实际激活羁绊通过。** 同批目标不覆盖的英雄或系统须另作独立验收，不能因为两套阵容能跑而省略工作包。带数据门槛的验收仍条件暂缓。

| 工作包 / 交付批 | 可以开始施工 | 可以签收阵容 / 独立消费者验收 |
| --- | --- | --- |
| A01 / 第1批 | M8对应G01–G10实际接口与B2行为可用；无(b)/(c)前置。先完成内部接入试跑。 | 1-A：八位技能、Sorcerer4/Sentinel4与Nami单使者通过；复用M8已完成迁移，不重复计工。Garen/Tristana单使者另验，Tristana英雄联验随A03可用后补齐。 |
| A02 / 第1批 | G/a接口及M9 Vander行为变更合同就绪；可先做各技能，不把A01整包完成设为普遍门槛。 | 1-B：实际复用A01的Vladimir/Lux及Sorcerer2，另需Watcher4/Sniper2、Garen单使者与Vander暴击独立例；首次交付按A01试跑→A02内部顺序。 |
| A03 / 第2批 | 真实G执行接口、对应取样/离散政策；Nocturne与Vex各自(b)适配合同/接入口就绪，其他消费者可先做。无需A02整包完成。 | 供2-A的Violet及2-B的Renata/Vex通过；A03斗士炮手独立联验只需A01的Irelia/Loris、Artillerist/Bruiser及Tristana单使者，不要求A02。Nocturne攻击任务/Vex定点区域适配各自签收。 |
| B01 / 第2批 | 固定目标有限计划、G金额/任务/回蓝接口；所消费的特殊选敌、自适应与衰减政策明确，不等待全部A组英雄。 | 2-A需要A03 Violet与A01/A02实用英雄、Family3/Ambusher2；2-B需要A03 Vex适配/延时、Renata及本包Singed/Morgana/Visionary4。 |
| B02 / 第3批 | G02/G06/G07权威结果及source/actionSeq/packetId/parentPacketId边界、金额取样合同就绪即可，不等待B01整包签收。 | 3-A消费B01 Visionary、A03 Vex适配、B03 Jinx与Rebel5；3-B只需Automata2及C01/A01/A02列名技能/羁绊。Automata/Dominator独立联验若带Renata/Rell，必须先有B01 Visionary。 |
| B03 / 第3批 | 显式RNG、真实攻击/替换/多包规划接口及相应政策就绪即可，不以B02全部消费者完成为开工门槛。 | 3-A确需B02 Rebel5；统治者随机火力独立联验确需B02 Dominator、B01 Visionary。3-B不消费本包新英雄，不能据此省略本包其余五位完整技能验收。 |
| C01 / 第3批 | G02扣减阶段、资格及FD01合同明确即可与B02/B03并行；Watcher6复用阈值取样。 | 3-B需B02 Automata2、A01/A02六守望成员与Sorcerer2/Garen单使者；不需Nocturne或B03全体。独立Automata4联验带Nocturne时，另需A03攻击适配与B02 Automata4。 |
| C02 / 第4批 | 单位身份/位置/可选资格接口及位移、当前目标死亡政策明确；消费者分别接B01选敌、B02承伤账本或B03持续替换，不整包捆绑。 | 4-A需要A03 Nocturne适配、B01 Twisted Fate、B02 Illaoi/Rebel3及A01法师；四迅击最小死亡反应在本包完成。Firelight独立验收需要Scar/Ekko/Zeri、承伤取样及位移，不因本批16套目标未用野火而漏验。 |
| C03 / 第4批 | 权威治疗/伤害结果、C02单位/资格与最小死亡反应接口及分享/传播合同就绪；不强加所有B03英雄前置。 | 4-B需本包Steb/Enforcer6、C02 Vi和其余列名旧英雄、Sniper2/Watcher2/Garen单使者。六先知/统治者独立联验需B01 Visionary6与B02金额羁绊。 |
| C04 / 第5批 | 实验格/开战成员及来源合同；Urgot接C02位移、Twitch接B03替换/穿透，分享消费者有需要才接有界反应，不笼统等C03全部英雄。 | 5-A四位实验完整普通/共享分支、Experiment3及阵内Sniper/Sorcerer/Watcher/Garen单使者通过；每个必需Q04-D独立解除，缺一个不得称完整阵容。 |
| C05 / 第5批 | 装备所有权及M8 G12/TG-01应用/撤销边界、赞助/暂授政策就绪；学院与普通废铁不依赖C03 Wanted整包。 | 5-B需A01/A03/B03实际列名英雄与Academy4赞助；Scrap2/4另作生命周期独立例。若做废铁野火联验，需要C02 Firelight，不需要只有一执法的Wanted；Academy5交D02。 |
| D01 / 第6批 | 取证/生命周期设计可与早期工作包并行；启用召唤消费者须取得其Q05/Q06必需数据及单位创建/退出/死亡接口，不等待所有C包。 | 第6批须本包Silco完整召唤独立例、适用Black Rose档/Sion独立例和D02消费的S02接口通过；6-A/6-B不激活黑玫瑰，不能代替本包验收。Sion某档缺证只阻塞该档。 |
| D02 / 第6批 | 双形态取证可并行；执行需要相应Q02/Q05数据、D01 S02及所消费C02位移接口；五学院补档接C05赞助基础，不等Sion所有档。 | 6-A四位完整双形态、必要召唤与Form Swapper4；6-B需Jayce完整、C05基础及本包Academy5第三件授予/去重。两目标分别过门槛。 |
| D03 / 第7批 | Nunu自身必需减伤绑定/实验公式与C04实验接口齐全即可，不等待D04或D02整包。 | 7-A需C04四位实验及全部共享公式、Experiment5与本阵狙击/Garen单使者；只有另做六斗士联验才需D02 Elise。 |
| D04 / 第7批 | Q07子技能/概率及相应Q12资料，B03 RNG、C02位移、C03反应接口按实际消费齐全即可，不等待Nunu。 | 7-B需D02 Gangplank完整、C05 Scrap2、B02 Pit Fighter6、本包Sevika/High Roller与已列名英雄/Family3；不依赖六炼金黑市。 |
| D05 / 第8批 | C05装备/来源及Match唯一收据，自己Q08/Q12对应分支明确即可；基础技能/无冲突改造可先准备，不等待Nunu或全部D06。 | 8-A完整Rumble/Junker King及C05 Scrap4、阵内技能/Sentinel4/Ambusher2通过；四处冲突待裁决与缺表分支未过不签收，不以其他改造完成代替。 |
| D06 / 第8批 | 按系统取得自己的Q12内容表/政策和来源/对手身份/收据接口；Conqueror、Chem-Baron、Emissary各自推进，不设D01/D02/D04整体门槛。 | 8-B需要Swain完整目录与其余六征服者技能、Conqueror6奖励/成长及Artillerist2；Chem-Baron6独立联验才需要Silco/Sevika。Ambessa单使者/四使者必须独立验身份去重/封顶7，2使者目标不能代验。 |

## 4. 交付批详情、内部工作包与16套目标阵容

每个英雄的apiName/费用与技能机制保持在其唯一工作包中。“涉及羁绊”包含本交付批英雄及正式阵容全部身份，低于阈值的不提前开放；档位责任见§5。G执行最终效果不等于已有规划接口能生成该效果，(b)/(c)归属须同时完成。

### 第1交付批：A01＋A02

主归属英雄（15名）：Irelia、Lux、Leona、Rell、Loris、Nami、Vladimir、Zoe、Darius、Vander、Scar、Garen、Kog'Maw、Caitlyn、Maddie。

涉及羁绊：Academy、Automata、Black Rose、Conqueror、Emissary、Enforcer、Family、Firelight、Rebel、Sentinel、Sniper、Sorcerer、Visionary、Watcher。

A01仅Vladimir为新增、其余7位为已有；A02为7位已有。先A01试跑，再做A02及Vander行为变更验收，不把14位已有重复估算为新增。

#### A01 通用盾、治疗与法术前后排（G/a）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Irelia（1费，`TFT13_Irelia`）；Lux（1费，`TFT13_Lux`）；Leona（2费，`TFT13_Leona`）；Rell（2费，`TFT13_Rell`）；Loris（3费，`TFT13_Beardy`）；Nami（3费，`TFT13_Nami`）；Vladimir（2费，`TFT13_Vladimir`）；Zoe（4费，`TFT13_Zoe`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10的既有组合；S05(a)吸收/偷抗/分担、S09(a)下一击；不新增规则系统。同步Sorcerer2/4、Sentinel2/4/6及单使者Nami/Garen/Tristana效果的G01/G08/G09/G10组合（Ambessa除外）。 |
| 阻塞/政策 | Q03-F/Q05-F/Q10-F/Q14-F沿已冻结规则，不重开批准；完整历史几何欠据继续记录。无已识别的必需数值/属性硬缺口。 |
| 前置关系 | 分别按§3的A01施工条件与签收条件执行。 |

#### A02 通用远程输出与守望前排（G/a）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Darius（1费，`TFT13_Darius`）；Vander（2费，`TFT13_Prime`）；Scar（3费，`TFT13_FlyGuy`）；Garen（4费，`TFT13_Garen`）；Kog'Maw（3费，`TFT13_KogMaw`）；Caitlyn（5费，`TFT13_Caitlyn`）；Maddie（1费，`TFT13_Shooter`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10；S04(a)凯特琳ID排序/每发一词/modulo；S09(a)Kog计数/射程与Vander一次强化；Watcher2/4、Sniper2/4（6档当前不可达，另留范围）。 |
| 阻塞/政策 | Vander M9历史暴击修正已获决定，需独立规则/版本/digest和无授权/有授权验收，B3不改B2。Scar仅普通技能在本批完整；Firelight要到C02。Kog/凯特琳随机或本场规则属于F，不因历史字段unknown重开批准。 |
| 前置关系 | 分别按§3的A02施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 1-A 法术盾前排 | Irelia、Rell、Leona、Loris、Lux、Vladimir、Nami、Zoe | 1 Emissary、4 Sentinel、4 Sorcerer | Nami唯一使者；Vladimir射程1且自疗，按近战副坦/输出验收，不据列表顺序规定四前四远程站位。 |
| 1-B 守望狙击 | Darius、Vander、Scar、Garen、Kog'Maw、Caitlyn、Vladimir、Lux | 1 Emissary、2 Sniper、2 Sorcerer、4 Watcher | Garen唯一使者；Caitlyn可用Maddie替位，激活档位相同，作为同一目标的变体。 |

### 第2交付批：A03＋B01

主归属英雄（15名）：Trundle、Vex、Renata Glasc、Nocturne、Tristana、Ezreal、Cassiopeia、Renni、Violet、Ekko、Singed、Powder、Twisted Fate、Morgana、Camille。

涉及羁绊：Academy、Ambusher、Artillerist、Automata、Black Rose、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Family、Firelight、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher。

A03将普通技能消费者与两项(b)适配分别验收，B01承接特殊选敌/自适应/衰减和Visionary。时长政策通过后仍须实际完成Vex区域选择器，不能只改分类文字。

#### A03 通用技能与梦魇/薇古丝规划适配（G/a＋b）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Trundle（1费，`TFT13_Trundle`）；Vex（1费，`TFT13_Vex`）；Renata Glasc（2费，`TFT13_RenataGlasc`）；Nocturne（2费，`TFT13_Nocturne`）；Tristana（2费，`TFT13_Tristana`）；Ezreal（3费，`TFT13_Ezreal`）；Cassiopeia（3费，`TFT13_Cassiopeia`）；Renni（3费，`TFT13_Chainsaw`）；Violet（1费，`TFT13_Red`）；Ekko（4费，`TFT13_Ekko`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10有限伤害/治疗/控制/任务与计数；S05(a)/S06(a)小炮溢出和已有持久成长；Bruiser2/4/6、Artillerist2/4（6档当前不可达）。Renni原格抬起/落下按控制与伤害处理；Ekko后像按有限伤害包，不凭“Summon”一词造持久实体。 Nocturne需(b)“实际攻击事件→有限延时任务”：6秒有效期内每次实际攻击独立创建1秒邻敌流血，保留动作身份、目标取样、取消与保存恢复；伤害复用G02/G05。TriggerDefinition.effects仅Effect[]，不宣称已能创建schedule/PeriodicTask，不压成即时伤害、不在施法时预排未来攻击，也不以一次ArmedAttack代替。Vex需(b)“保存HexCell区域中心→到期读取当前棋盘→固定目标集合”：固定1格暗区的执行语义须明确采纳；A离开/B进入的例验B命中、A不命中，不能跟随原目标移动或冻结旧targetIds。这两项属于规划适配，不扩大为(c)生命周期。 |
| 阻塞/政策 | 新英雄Q03-P/Q10-P需明确取样/时序，尤其Vex短延时、Violet短击飞；DOTDuration/StunDuration历史绑定仍unknown，不在本方案选时长。两位在政策采纳或必要绑定取得前暂缓完整签收；其他英雄可先行。若要求源档完整历史时序，则相应移入末尾取证队列。 |
| 前置关系 | 分别按§3的A03施工条件与签收条件执行。 |

#### B01 特殊选敌、自适应类型与攻速衰减规划（b）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Singed（1费，`TFT13_Singed`）；Powder（1费，`TFT13_Blue`）；Twisted Fate（3费，`TFT13_TwistedFate`）；Morgana（1费，`TFT13_Morgana`）；Camille（2费，`TFT13_Camille`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；P01(b)本轮伤害最多、最大敌群/圆群、未诅咒资格；S07(b)逐目标physical/magic解析；Singed G01/G05衰减规划。配套Family3（4档当前不可达）的法力/属性组合、Ambusher2–5技能授权/暴击属性；不含Family5劫掠。 同步Visionary2/4/6普通回蓝放大取样/资格适配(b)，不把Zeri攻击计数或专属资源当普通蓝；Visionary8的伤害友疗不在本批。 |
| 阻塞/政策 | Q03-P/Q10-P：取样、伤害口径、并列、衰减曲线/离散化、Camille等抗；政策待提出/采纳。若要严格还原曲线，Q03-D须补脚本；不能固定攻速4秒再移除。Morgana削盾资格需Q14政策，不偷偷扩G07/Trigger枚举。 |
| 前置关系 | 分别按§3的B01施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 2-A 家人伏击 | Powder、Violet、Vander、Camille、Garen、Vladimir、Scar、Lux | 2 Ambusher、1 Emissary、3 Family、2 Sorcerer、4 Watcher | Family3、Ambusher2及Violet短控政策通过；单Camille/Scar不提前触发Wanted/Firelight。 |
| 2-B 先知铁卫 | Singed、Renata Glasc、Morgana、Rell、Irelia、Leona、Loris、Vex | 4 Sentinel、4 Visionary | Vex区域到期选敌适配、延时政策/必需绑定及Visionary4通过；5名铁卫采用4档，只有2炼金男爵。 |

### 第3交付批：B02＋B03＋C01

主归属英雄（8名）：Blitzcrank、Illaoi、Draven、Zeri、Ziggs、Heimerdinger、Jinx、Amumu。

涉及羁绊：Academy、Ambusher、Artillerist、Automata、Black Rose、Conqueror、Dominator、Emissary、Family、Firelight、Pit Fighter、Rebel、Scrap、Sentinel、Sniper、Sorcerer、Visionary、Watcher。

B02金额账本、B03随机/替换/轮转与C01 FD01保留独立边界。新增Watcher6与Automata2联验；其他Automata4、Dominator、Pit Fighter及未上阵英雄另验，3-B不替代这些工作。

#### B02 承伤/汲取金额规划与战斗羁绊账本（b）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Blitzcrank（3费，`TFT13_Blitzcrank`）；Illaoi（4费，`TFT13_Illaoi`） |
| 机制需求 | G01,G02,G03,G05,G06,G07,G08,G09,G10；S05(b)Blitz承伤反击、Illaoi汲取；独立金额状态，绝不把G09次数改金额。配套Automata2/4的伤害累计/水晶次数、Rebel3/5/7团队失血阈值与有限奖励、Dominator2/4/6消耗法力→AP规划、Pit Fighter2/4/6真伤附包/阈值治疗。底层仍用已有damage/heal/modify-stat；金额取样与次数各自保存。 |
| 阻塞/政策 | Q14-P/Q10-P：absorbed/hpDamage/overkill口径、阈值取样、同tick、清零/恢复、附包防回传；这些运行态与规划适配需M9明确合同，不能声称B3已有执行器或扩充冻结枚举。仅有百分比数字不等于账本完整。 |
| 前置关系 | 分别按§3的B02施工条件与签收条件执行。 |

#### B03 随机分支、多发替换与技能轮转规划（b）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Draven（1费，`TFT13_Draven`）；Zeri（2费，`TFT13_Zeri`）；Ziggs（2费，`TFT13_Ziggs`）；Heimerdinger（4费，`TFT13_Heimerdinger`）；Jinx（5费，`TFT13_Jinx`） |
| 机制需求 | G01,G02,G03,G04,G08,G09,G10；S04(b)显式战斗RNG候选/权重→有限计划；S09(b)回旋斧持续替换、Zeri每3攻、多发/轮转。一次攻击只发一次attack-completed，每包delivery/暴击资格独立，取消不提前消费。Zeri回蓝/主动施法资格单独适配，原mana=3不当普通法力上限。 |
| 阻塞/政策 | Q10-P/Q14-P：随机抽样、弹药/轮转消费时点、目标失效；B2凯特琳抽样保持原样，技能随机不借G12装备流。Q11的Zeri澄清是实施门槛而非Viktor硬缺口。Draven不改为Vander技能授权资格。 |
| 前置关系 | 分别按§3的B03施工条件与签收条件执行。 |

#### C01 固定承伤扣减阶段（c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Amumu（1费，`TFT13_Amumu`） |
| 机制需求 | G01,G02,G03,G05,G09,G10；FD01(c)所有incoming damage固定扣减、G05每秒火花；G02顺序/资格新增合同，不能把damageReduction.flat当HP扣减或用incoming-basic-hit模拟。明确负责Watcher6补档，G01复用属性修改：基础坚韧35%，HP严格>50%时50%；对照Watcher4的25%/45%。在50%及上下边界、升至6/降回4、FD01组合中独立验收，目标3-B。 |
| 阻塞/政策 | Q05-D：FlatDRCooldownPerAttacker活跃性/单位未证实；若不启用此候选参数可独立归档，若证明为必需则暂缓该分支。FD01抗性/%减伤/盾先后、真伤、零伤/最低1、多包等政策未采纳前不可签收。 |
| 前置关系 | 分别按§3的C01施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 3-A 叛军轮转 | Irelia、Vex、Ezreal、Zoe、Jinx、Rell、Lux、Tristana | 2 Artillerist、1 Emissary、5 Rebel、2 Sentinel、2 Sorcerer、2 Visionary | B02 Rebel5、B03 Jinx轮转及B01 Visionary2通过；Tristana唯一使者。 |
| 3-B 六守望 | Amumu、Darius、Vander、Vladimir、Scar、Garen、Kog'Maw、Lux | 2 Automata、1 Emissary、2 Sorcerer、6 Watcher | C01 FD01与Watcher6、B02 Automata2通过；本目标没有Nocturne，不等待其攻击适配或B03全部随机消费者。 |

### 第4交付批：C02＋C03

主归属英雄（10名）：Akali、Sett、Vi、Smeech、Corki、Ambessa、Mordekaiser、Steb、LeBlanc、Malzahar。

涉及羁绊：Ambusher、Artillerist、Automata、Black Rose、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Sniper、Sorcerer、Visionary、Watcher。

C02拥有四迅击最小死亡反应，C03在同批复用并交付Wanted/分享/传播。Firelight2/3仍须独立验承伤→治疗和位移，不因正式阵容没有野火而遗漏。

#### C02 权威位移、追击与野火（c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Akali（2费，`TFT13_Akali`）；Sett（2费，`TFT13_Sett`）；Vi（4费，`TFT13_Vi`）；Smeech（3费，`TFT13_Gremlin`）；Corki（4费，`TFT13_Corki`）；Ambessa（4费，`TFT13_Ambessa`）；Mordekaiser（5费，`TFT13_Mordekaiser`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S01(c)权威坐标、占格、移动/拉拽/击退/飞行生命周期；Smeech装备最少、Mordekaiser最大直线敌群复用B01规划；S09(b)姿态与持续替换复用B03。配套Quickstriker2/3/4、Firelight2/3（位移＋S05(b)上次突进以来承伤→G06治疗及攻击射程/节奏）。 四迅击死亡反应明确归C02：保存当前目标身份及死亡原因→选择新目标→冲刺→200护盾/3秒；刚选中的敌人被队友击杀、尚未造成正HP伤害时也必须触发。普通换敌/不可选中不能触发；kill-or-assist或无原因的target-changed均不能代替。最小死亡反应接口由本包负责，C03复用，不扩写M8 B2冻结触发枚举。 |
| 阻塞/政策 | Q10-P/Q14-P：目的格/碰撞/不可移动、取消、账本清零/恢复、临时射程；Akali SpeedDuringFinalKick等unknown不能直接当仿真单位。Ambessa使者对手奖励暂缓D06，本批可完整基础技能，但不称其单使者奖励已实现。Corki从旧无侧移行为到历史位移也需M9显式合同/版本验收。 |
| 前置关系 | 分别按§3的C02施工条件与签收条件执行。 |

#### C03 分享、链接、传播与死亡反应（c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Steb（1费，`TFT13_Fish`）；LeBlanc（5费，`TFT13_LeBlanc`）；Malzahar（5费，`TFT13_Malzahar`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G08,G09,G10；S05(c)任意治疗分享、成员链接防回传、死亡感染传播与同tick顺序；结果仍走G02/G06。配套Enforcer2/4/6（8档当前不可达）：最高HP Wanted身份及死亡收益反应。Wanted并未在冻结TargetSelector/Condition里现成表达，本方案按新身份/死亡反应状态安排(c)，不假称只靠G10/G09已完整覆盖；Enforcer10没收另留C05/取证。 复用C02的当前单位身份/最小死亡反应接口；Wanted及传播仍分别定义自身身份/资格/去重，不将四迅击反应推迟到本包。 |
| 阻塞/政策 | Q14-P：actual治疗/成员/来源、防回传/源死、传播存活资格与去重；不得偷加B2 heal-completed/death枚举。若某启用效果必需的未知公式仍缺，标Q14-D局部暂缓，不能以无限递归/截断事件蒙混签收。 |
| 前置关系 | 分别按§3的C03施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 4-A 四迅击 | Nocturne、Akali、Twisted Fate、Ambessa、Irelia、Illaoi、Nami、Vladimir | 4 Quickstriker、3 Rebel、2 Sentinel、2 Sorcerer；2 Emissary不激活 | 当前目标死亡→选新目标→冲刺→200盾/3秒全部在C02闭合；Nami/Ambessa为2使者，不激活使者奖励。 |
| 4-B 六执法 | Steb、Maddie、Camille、Loris、Vi、Caitlyn、Garen、Vladimir | 1 Emissary、6 Enforcer、2 Sniper、2 Watcher | Enforcer6含Wanted死亡奖励；Steb分享、Vi技能及Garen单使者通过。 |

### 第5交付批：C04＋C05

主归属英雄（4名）：Zyra、Urgot、Dr. Mundo、Twitch。

涉及羁绊：Academy、Artillerist、Automata、Black Rose、Conqueror、Dominator、Emissary、Enforcer、Experiment、Pit Fighter、Rebel、Sentinel、Sniper、Sorcerer、Visionary、Watcher。

C04必需实验宏逐个取证；C05交Academy3/4与Scrap2/4基础。五学院留D02明确补档；Scrap6 lucky未定则局部暂缓，不能称所有废铁档已完成。

#### C04 实验格与已知条件加成（c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Zyra（1费，`TFT13_Zyra`）；Urgot（2费，`TFT13_Urgot`）；Dr. Mundo（4费，`TFT13_DrMundo`）；Twitch（4费，`TFT13_Twitch`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S11(c)实验格、开战成员/来源、共享/倍增资格；资格后的G机制复用(a)。先交付可组成的Experiment3档（2实验格/100HP）及完整已取证加成；Urgot还需S01、Twitch还需S04/S09。不得只关闭实验分支就把普通技能称完整英雄。独立六法例所需Sorcerer6属性档同步以G01补齐，不混入Sorcerer8的伤害削减。 |
| 阻塞/政策 | Q04-P的格位/镜像/来源/存续需采纳；每个CurrentExperimentBonus宏须有明确字段/公式映射，任何必需Q04-D未补齐的消费者暂缓完整签收，不能猜值。Nunu普通减伤绑定/实验公式单列末尾D03；5/7档及未知加成不在3档验收中混称完成。 |
| 前置关系 | 分别按§3的C04施工条件与签收条件执行。 |

#### C05 赞助与临时装备所有权（c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | 无新增主归属英雄；复用此前目录。 |
| 机制需求 | G01–G10/G12的适用组合；S12(c)赞助选择/授予收据、原件/临时子件来源与生命周期；Scrap2/4、Academy3/4完整有效档位，G12只复用部分应用/撤销，不等于任意改造系统。Enforcer10需独立没收/归还所有权政策和可达阵容支持，不能混入低档验收。 |
| 阻塞/政策 | Q09-P：普通成装池、赞助选取/槽冲突、清理/归还/恢复；Scrap6“lucky”执行定义未齐则暂缓该档，Scrap9光明本体Q09-D留取证队列。Academy5需Jayce/D02，6档及Enforcer10须另有数量来源，本文阵容不用纹章。 |
| 前置关系 | 分别按§3的C05施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 5-A 实验狙击 | Zyra、Urgot、Dr. Mundo、Twitch、Kog'Maw、Caitlyn、Vladimir、Garen | 1 Emissary、3 Experiment、2 Sniper、2 Sorcerer、2 Watcher | 4名实验采用3档；四位实验共享效果各自完成必需字段/公式取证后才可签收。 |
| 5-B 学院法术 | Lux、Leona、Ezreal、Heimerdinger、Rell、Loris、Nami、Zoe | 4 Academy、1 Emissary、2 Sentinel、2 Sorcerer、2 Visionary | Academy4含赞助选择、两件装备授予和唯一收据；不触发Wanted，不要求C03整包签收。 |

### 第6交付批：D01＋D02

主归属英雄（5名）：Silco、Gangplank、Swain、Elise、Jayce。

涉及羁绊：Academy、Artillerist、Black Rose、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Form Swapper、Pit Fighter、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher。

条件交付：D01召唤生命周期供D02复用，Sion各档取证不成为所有形态的前置。D02同时接回Academy5，与C05的Academy3/4基础构成完整责任链。

#### D01 暂缓：召唤物与黑玫瑰Sion取证（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Silco（4费，`TFT13_Silco`） |
| 机制需求 | G02,G03,G05,G08,G10；S02(c)实例ID、所属方、容量、创建/退出、攻击次数与死亡/复活；Silco monstrosities和Black Rose/Sion；G11清仇恨不是复活。 |
| 阻塞/政策 | Q05-D Silco召唤必需属性/完整攻击执行；MinionDuration仍仅归档、不默认12秒寿命，不把非必需未绑定字段单独当全技能硬阻塞；Q06 Sion实际成长/分档属性/解锁映射。75%复活、3秒盾、1秒晕已知，不重列为缺数字。只完整取得适用档证据后才开放该档。 |
| 前置关系 | 分别按§3的D01施工条件与签收条件执行。 |

#### D02 暂缓：四名双形态目录（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Gangplank（3费，`TFT13_Gangplank`）；Swain（3费，`TFT13_Swain`）；Elise（4费，`TFT13_Elise`）；Jayce（5费，`TFT13_Jayce`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S03(a)镜像行/开战取样复用；S03(c)双套属性/技能/形态目录；Elise/Jayce另需S01/S02，Jayce工坊死亡/复活必须完整。明确接回Academy5补档，接G12及C05赞助/所有权接口：在Academy3/4基础上，PercentIncreaseSponsored由4档0.03切到5档0.05，NumOfItems由2切到3；第三件赞助装备授予、重复进入档位/退出再进入及保存恢复收据去重归本包验收，目标6-B。 |
| 阻塞/政策 | Q02四位完整双形态基础属性与第二技能硬缺；Elise蜘蛛/Jayce工坊等必需召唤参数并入Q05-D。GP近战AD65已有目标，不能覆盖载体全形态；无null→0、无拿另一形态替代。 |
| 前置关系 | 分别按§3的D02施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 6-A 四换形 | Gangplank、Swain、Elise、Jayce、Lux、Vladimir、Nami、Zoe | 1 Emissary、4 Form Swapper、4 Sorcerer | 暂缓：四位双形态及Elise/Jayce召唤完整后签收；2黑玫瑰、2学院不激活，不要求Sion各档全部交付。 |
| 6-B 五学院 | Lux、Leona、Ezreal、Heimerdinger、Jayce、Rell、Nami、Zoe | 5 Academy、1 Emissary、2 Sentinel、2 Sorcerer、2 Visionary | 暂缓：Jayce完整目录、C05赞助基础与D02 Academy5补档通过，验第三件装备与重复进入/恢复去重。 |

### 第7交付批：D03＋D04

主归属英雄（2名）：Nunu & Willump、Sevika。

涉及羁绊：Ambusher、Artillerist、Automata、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Experiment、Family、Form Swapper、High Roller、Pit Fighter、Scrap、Sniper、Sorcerer、Visionary、Watcher。

条件交付：Nunu与Sevika分别过门槛；五实验不需要Elise，六斗士附加联验才需要Elise。六搏击真实需要Gangplank与Scrap2，不强加六炼金黑市。

#### D03 暂缓：Nunu必需公式与五实验（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Nunu & Willump（3费，`TFT13_NunuWillump`） |
| 机制需求 | G01,G02,G03,G05,G08,G09,G10；G01/G02/G05及S11(c)共享实验；普通Durability→ModifiedDurability计算绑定与实验公式分开取证。 接回Experiment5档，3实验格/300HP；本批Nunu分支与C04四位全部共享资格分别验收。 |
| 阻塞/政策 | Q03-D/Q04-D/Q05-D：已知普通减伤效果不能删；原Durability数字存在但宏绑定未证实，不以静默采用或关闭效果称完整英雄。必要绑定/公式取得后再开放Nunu和完整5实验；7档仍受可达人数/范围限制。 |
| 前置关系 | 分别按§3的D03施工条件与签收条件执行。 |

#### D04 暂缓：Sevika子技能与High Roller（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Sevika（5费，`TFT13_Lieutenant`） |
| 机制需求 | G01,G02,G03,G04,G05,G07,G08,G09,G10；S04(b)有限抽样＋S01(c)/S08(c)位移/吞噬/处决资格；S12(c)High Roller改造及金币唯一收据，不能以超大真伤/HP清零代处决。 |
| 阻塞/政策 | Q07三份子正文/挂接、Jackpot AD2.5映射与概率；High Roller哈希权重同样须核对。Q12对应奖励/执行资格分支缺证时暂缓；不等概率、不用最大字段猜Jackpot。 |
| 前置关系 | 分别按§3的D04施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 7-A 五实验 | Zyra、Urgot、Nunu & Willump、Dr. Mundo、Twitch、Caitlyn、Kog'Maw、Garen | 1 Emissary、5 Experiment、2 Sniper | 暂缓：C04基础及Nunu普通减伤绑定/实验公式通过；5实验含3实验格/300HP，不需Elise或Warwick。 |
| 7-B 六搏击 | Draven、Violet、Urgot、Vi、Gangplank、Sevika、Powder、Vander | 3 Family、1 High Roller、6 Pit Fighter、2 Scrap | 暂缓：Sevika完整子技能/High Roller、D02 Gangplank、C05 Scrap2与B02 Pit Fighter6通过。 |

### 第8交付批：D05＋D06

主归属英雄（1名）：Rumble。

涉及羁绊：Academy、Ambusher、Artillerist、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Family、Firelight、Form Swapper、Junker King、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher。

条件交付：Rumble只等待C05与自己的Q08/Q12对应分支，无需等Nunu。D06奖励系统分别按内容表/接口开放；单Ambessa、四使者和Chem-Baron另作独立验收。

#### D05 暂缓：Rumble条件改造与购买（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | Rumble（5费，`TFT13_Rumble`） |
| 机制需求 | G01,G02,G03,G04,G05,G06,G08,G09,G10；基础技能G01–G10可独立规划；S12(c)最强兰博归属、每3轮购买/升级、升级持久化。四条周期已取证，只在获得改造后生效；不能当无条件技能。 |
| 阻塞/政策 | 扩大后的Q08：Tankbuster1/2（100/150 vs 120/180）、Microbots3（.4 vs .25）、自毁3（20 vs 公告200倍）均数值采用待裁决，本方案不选值。Q12价格/购买/升级表及周期首次执行/重叠政策仍需补齐。仅这些分支阻塞；基础技能和无冲突改造可先准备，完整英雄签收待明确开放范围。 |
| 前置关系 | 分别按§3的D05施工条件与签收条件执行。 |

#### D06 暂缓：经济奖励表与使者对手进度（D/c）

| 项目 | 工作包范围 |
| --- | --- |
| 英雄 | 无新增主归属英雄；复用此前目录。 |
| 机制需求 | G01–G10/G12的适用组合；S06(c)新增跨轮来源/对手身份与去重进度；S12(c)Conqueror箱、Chem-Baron黑市/非法装备与Family5劫掠收据。单使者Ambessa及4使者需要PlayersDefeated/7、每对手+2双抗政策；不能每场胜利当新对手，也不用PVE=4替代。 |
| 阻塞/政策 | Q12经济奖励池/价格/阈值硬缺口与单人身份/封顶/收据政策分开；Family5、Scrap9光明等不可达/缺表分支暂缓，不能用普通奖励/装备替代。已有小炮成长不重做；Mel不在本批范围。 |
| 前置关系 | 分别按§3的D06施工条件与签收条件执行。 |

| 阵容目标（8人口） | 英雄 | 全部实际激活档位 | 签收条件/说明 |
| --- | --- | --- | --- |
| 8-A 废铁改造 | Rumble、Powder、Ziggs、Ekko、Irelia、Loris、Leona、Singed | 2 Ambusher、1 Junker King、4 Scrap、4 Sentinel | 暂缓：C05 Scrap4与Rumble Q08/Q12及改造资格通过；不等待Nunu，不以基础火箭代替Junker King。 |
| 8-B 六征服 | Darius、Draven、Rell、Ambessa、Mordekaiser、Swain、Ezreal、Tristana | 2 Artillerist、6 Conqueror；2 Emissary不激活 | 暂缓：六位完整技能及D06 Conqueror6箱/成长通过；2使者不激活，不能作Ambessa单使者或四使者验收。 |

## 5. 羁绊—档位—负责批次—首次可达批次—验收目标

覆盖60名候选的**26条普通羁绊、85个原件档位**，英文名与台账对应，不含Q01专属/Q15关系条目。负责批次是效果/接口责任；首次可达是**累积英雄目录达到人数且该档责任机制可用时，最早能安排独立验收的交付批**，不等于已完成，也不保证整套附带羁绊已可玩。若人数先齐，括注人数首达批次，防止“上齐英雄”被当成“效果已实现”。第5批实验及第6–8批等仍以各自数据/政策门槛解除为条件。

已交付机制的后续可达档位，由原负责工作包提供独立例，在首次可达的交付批补联验；不把后续英雄的整体签收倒置为早期工作包的开工门槛。表内的独立档位例只验证该羁绊；若升级为完整阵容联验，还须检查其中其他实际激活羁绊的门槛。

正式阵容证据用1-A～8-B引用；未被16套目标覆盖的可达档位需独立数值/生命周期例。不可达档只保留归属和取证责任，**不算8批已交付效果，不新增纹章或超出八人口的范围**；涉及幸运/光明/劫掠/没收等另需明确范围与政策，不能用低档完成代替。单Ambessa和四使者归D06独立验收，2使者正式阵容不作证。

| 羁绊 | 档位 | 负责批次（交付 / 工作包） | 首次可达批次 | 验收目标 |
| --- | --- | --- | --- | --- |
| Academy | 3 | 第5批 / C05 | 第5批（人数第2批先达） | 独立档位例；赞助参数/装备数量、授予与重复进入/恢复去重 |
| Academy | 4 | 第5批 / C05 | 第5批（人数第3批先达） | 5-B联验；赞助参数/装备数量、授予与重复进入/恢复去重 |
| Academy | 5 | 第6批 / D02 | 第6批；条件交付 | 6-B；0.05/3件对照4档0.03/2件，第三件授予与重复进入/恢复去重 |
| Academy | 6 | 第5批 / C05（范围暂缓） | 不可达：自然英雄5名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Ambusher | 2 | 第2批 / B01 | 第2批 | 2-A、8-A联验；技能暴击授权、暴击属性及独立资格例 |
| Ambusher | 3 | 第2批 / B01 | 第2批 | 独立档位例；技能暴击授权、暴击属性及独立资格例 |
| Ambusher | 4 | 第2批 / B01 | 第3批 | 独立档位例；技能暴击授权、暴击属性及独立资格例 |
| Ambusher | 5 | 第2批 / B01 | 第4批 | 独立档位例；技能暴击授权、暴击属性及独立资格例 |
| Artillerist | 2 | 第2批 / A03 | 第2批 | 3-A、8-B联验；攻击计数、附包与属性档位 |
| Artillerist | 4 | 第2批 / A03 | 第5批 | 独立档位例；攻击计数、附包与属性档位 |
| Artillerist | 6 | 第2批 / A03（范围暂缓） | 不可达：自然英雄4名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Automata | 2 | 第3批 / B02 | 第3批（人数第2批先达） | 3-B联验；累计伤害/水晶次数、取样、清零与恢复；不以次数代金额 |
| Automata | 4 | 第3批 / B02 | 第3批 | 独立档位例；累计伤害/水晶次数、取样、清零与恢复；不以次数代金额 |
| Automata | 6 | 第3批 / B02（范围暂缓） | 不可达：自然英雄5名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Black Rose | 3 | 第6批 / D01 | 第6批（人数第2批先达）；条件交付 | 独立档位例；Sion阶段属性/解锁映射及创建/复活；Q06条件 |
| Black Rose | 4 | 第6批 / D01 | 第6批（人数第4批先达）；条件交付 | 独立档位例；Sion阶段属性/解锁映射及创建/复活；Q06条件 |
| Black Rose | 5 | 第6批 / D01 | 第6批；条件交付 | 独立档位例；Sion阶段属性/解锁映射及创建/复活；Q06条件 |
| Black Rose | 7 | 第6批 / D01（范围暂缓） | 不可达：自然英雄5名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Bruiser | 2 | 第2批 / A03 | 第2批 | 独立档位例；HP属性档位与升降档；6档完整Nunu/Elise目录后联验 |
| Bruiser | 4 | 第2批 / A03 | 第4批 | 独立档位例；HP属性档位与升降档；6档完整Nunu/Elise目录后联验 |
| Bruiser | 6 | 第2批 / A03 | 第7批；条件交付 | 独立档位例；HP属性档位与升降档；6档完整Nunu/Elise目录后联验 |
| Chem-Baron | 3 | 第8批 / D06 | 第8批（人数第2批先达）；条件交付 | 独立档位例；连败/微光、黑市/跳过奖励与非法装备；Q12条件 |
| Chem-Baron | 4 | 第8批 / D06 | 第8批（人数第4批先达）；条件交付 | 独立档位例；连败/微光、黑市/跳过奖励与非法装备；Q12条件 |
| Chem-Baron | 5 | 第8批 / D06 | 第8批（人数第6批先达）；条件交付 | 独立档位例；连败/微光、黑市/跳过奖励与非法装备；Q12条件 |
| Chem-Baron | 6 | 第8批 / D06 | 第8批（人数第7批先达）；条件交付 | 独立档位例；连败/微光、黑市/跳过奖励与非法装备；Q12条件 |
| Chem-Baron | 7 | 第8批 / D06（范围暂缓） | 不可达：自然英雄6名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Conqueror | 2 | 第8批 / D06 | 第8批（人数第1批先达）；条件交付 | 独立档位例；征服计数、箱奖励/成长、跨轮收据去重；Q12条件 |
| Conqueror | 4 | 第8批 / D06 | 第8批（人数第4批先达）；条件交付 | 独立档位例；征服计数、箱奖励/成长、跨轮收据去重；Q12条件 |
| Conqueror | 6 | 第8批 / D06 | 第8批（人数第6批先达）；条件交付 | 8-B联验；征服计数、箱奖励/成长、跨轮收据去重；Q12条件 |
| Conqueror | 9 | 第8批 / D06（范围暂缓） | 不可达：自然英雄6名，目标仅8人口 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Dominator | 2 | 第3批 / B02 | 第3批 | 独立档位例；消耗法力→AP、到期与保存恢复 |
| Dominator | 4 | 第3批 / B02 | 第4批 | 独立档位例；消耗法力→AP、到期与保存恢复 |
| Dominator | 6 | 第3批 / B02 | 第6批；条件交付 | 独立档位例；消耗法力→AP、到期与保存恢复 |
| Emissary | 1 | 第1批 / A01（Nami/Garen/Tristana效果）；第8批 / D06（Ambessa） | 第1批Nami/Garen；第2批Tristana英雄联验；第8批Ambessa（政策条件） | 1-A Nami、1-B Garen、3-A Tristana；三者单使者分别独立例，Tristana随A03补齐联验；Ambessa单使者另验对手身份/去重/封顶7 |
| Emissary | 4 | 第8批 / D06 | 第8批（人数第4批先达） | 独立四使者例（Ambessa/Garen/Nami/Tristana），每对手+2双抗、身份去重/封顶7；2/3使者不激活 |
| Enforcer | 2 | 第4批 / C03 | 第4批（人数第1批先达） | 独立档位例；Wanted身份、死亡收益与去重 |
| Enforcer | 4 | 第4批 / C03 | 第4批（人数第2批先达） | 独立档位例；Wanted身份、死亡收益与去重 |
| Enforcer | 6 | 第4批 / C03 | 第4批 | 4-B联验；Wanted身份、死亡收益与去重 |
| Enforcer | 8 | 第4批 / C03（范围暂缓） | 不可达：自然英雄7名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Enforcer | 10 | 第5批 / C05（范围暂缓） | 不可达：自然英雄7名，目标仅8人口 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Experiment | 3 | 第5批 / C04 | 第5批；条件交付 | 5-A联验；实验格/HP及所有启用共享加成；必需宏绑定逐项通过 |
| Experiment | 5 | 第7批 / D03 | 第7批；条件交付 | 7-A联验；实验格/HP及所有启用共享加成；必需宏绑定逐项通过 |
| Experiment | 7 | 第5批 / C04（范围暂缓） | 不可达：自然英雄5名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Family | 3 | 第2批 / B01 | 第2批 | 2-A、7-B联验；法力/属性、阈值与升降档 |
| Family | 4 | 第2批 / B01（范围暂缓） | 不可达：自然英雄3名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Family | 5 | 第8批 / D06（范围暂缓） | 不可达：自然英雄3名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Firelight | 2 | 第4批 / C02 | 第4批（人数第2批先达） | 独立档位例；野火位移、上次突进以来承伤→治疗、射程/节奏 |
| Firelight | 3 | 第4批 / C02 | 第4批（人数第3批先达） | 独立档位例；野火位移、上次突进以来承伤→治疗、射程/节奏 |
| Firelight | 4 | 第4批 / C02（范围暂缓） | 不可达：自然英雄3名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Form Swapper | 2 | 第6批 / D02 | 第6批；条件交付 | 独立档位例；形态取样/切换及双套属性/技能，必要召唤完整 |
| Form Swapper | 4 | 第6批 / D02 | 第6批；条件交付 | 6-A联验；形态取样/切换及双套属性/技能，必要召唤完整 |
| High Roller | 1 | 第7批 / D04 | 第7批；条件交付 | 7-B联验；子技能概率/挂接、改造及金币收据；Q07/Q12条件 |
| Junker King | 1 | 第8批 / D05 | 第8批；条件交付 | 8-A联验；最强归属、购买/升级/持久化；Q08四处冲突及Q12条件 |
| Pit Fighter | 2 | 第3批 / B02 | 第3批 | 独立档位例；真伤附包、阈值治疗与防回传 |
| Pit Fighter | 4 | 第3批 / B02 | 第5批 | 独立档位例；真伤附包、阈值治疗与防回传 |
| Pit Fighter | 6 | 第3批 / B02 | 第7批 | 7-B联验；真伤附包、阈值治疗与防回传 |
| Pit Fighter | 8 | 第3批 / B02（范围暂缓） | 不可达：自然英雄6名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Quickstriker | 2 | 第4批 / C02 | 第4批（人数第2批先达） | 独立档位例；攻速取样/阈值；4档当前目标死亡→冲刺→200盾/3秒 |
| Quickstriker | 3 | 第4批 / C02 | 第4批 | 独立档位例；攻速取样/阈值；4档当前目标死亡→冲刺→200盾/3秒 |
| Quickstriker | 4 | 第4批 / C02 | 第4批 | 4-A联验；攻速取样/阈值；4档当前目标死亡→冲刺→200盾/3秒 |
| Rebel | 3 | 第3批 / B02 | 第3批（人数第2批先达） | 4-A联验；团队失血阈值及完整有限奖励/恢复 |
| Rebel | 5 | 第3批 / B02 | 第3批 | 3-A联验；团队失血阈值及完整有限奖励/恢复 |
| Rebel | 7 | 第3批 / B02 | 第4批 | 独立档位例；团队失血阈值及完整有限奖励/恢复 |
| Rebel | 10 | 第3批 / B02（范围暂缓） | 不可达：自然英雄8名，目标仅8人口 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Scrap | 2 | 第5批 / C05 | 第5批（人数第2批先达） | 7-B联验；暂授来源/撤销/恢复与盾；6档lucky政策就绪才开放 |
| Scrap | 4 | 第5批 / C05 | 第5批（人数第3批先达） | 8-A联验；暂授来源/撤销/恢复与盾；6档lucky政策就绪才开放 |
| Scrap | 6 | 第5批 / C05 | 第6批；lucky政策未定暂缓 | 独立档位例；暂授来源/撤销/恢复与盾；6档lucky政策就绪才开放 |
| Scrap | 9 | 第8批 / D06（范围暂缓） | 不可达：自然英雄7名，目标仅8人口 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Sentinel | 2 | 第1批 / A01 | 第1批 | 3-A、4-A、5-B、6-B联验；全队双抗与铁卫成员三倍双抗、升降档；前后排位置不改变增益资格 |
| Sentinel | 4 | 第1批 / A01 | 第1批 | 1-A、2-B、8-A联验；全队双抗与铁卫成员三倍双抗、升降档；前后排位置不改变增益资格 |
| Sentinel | 6 | 第1批 / A01 | 第3批 | 独立档位例；全队双抗与铁卫成员三倍双抗、升降档；前后排位置不改变增益资格 |
| Sniper | 2 | 第1批 / A02 | 第1批 | 1-B、4-B、5-A、7-A联验；属性、距离取样及边界 |
| Sniper | 4 | 第1批 / A02 | 第3批 | 独立档位例；属性、距离取样及边界 |
| Sniper | 6 | 第1批 / A02（范围暂缓） | 不可达：自然英雄5名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Sorcerer | 2 | 第1批 / A01 | 第1批 | 1-B、2-A、3-A、3-B、4-A、5-A、5-B、6-B联验；属性档位；6档亦须数值验收 |
| Sorcerer | 4 | 第1批 / A01 | 第1批 | 1-A、6-A联验；属性档位；6档亦须数值验收 |
| Sorcerer | 6 | 第5批 / C04 | 第5批 | 独立档位例；属性档位；6档亦须数值验收 |
| Sorcerer | 8 | 第1批 / A01（范围暂缓） | 不可达：自然英雄7名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Visionary | 2 | 第2批 / B01 | 第2批 | 3-A、5-B、6-B联验；普通回蓝资格/倍率；Zeri资源不冒充普通蓝 |
| Visionary | 4 | 第2批 / B01 | 第2批 | 2-B联验；普通回蓝资格/倍率；Zeri资源不冒充普通蓝 |
| Visionary | 6 | 第2批 / B01 | 第4批 | 独立档位例；普通回蓝资格/倍率；Zeri资源不冒充普通蓝 |
| Visionary | 8 | 第2批 / B01（范围暂缓） | 不可达：自然英雄7名 | 不作本轮交付签收；保留原档数据，数量来源/扩大范围另审 |
| Watcher | 2 | 第1批 / A02 | 第1批 | 4-B、5-A联验；HP严格>50%阈值、升降档与坚韧取样 |
| Watcher | 4 | 第1批 / A02 | 第1批 | 1-B、2-A联验；HP严格>50%阈值、升降档与坚韧取样 |
| Watcher | 6 | 第3批 / C01 | 第3批 | 3-B；35%/HP>50%为50%，50%边界与4档25%/45%对照，FD01组合 |

## 6. 待定范围与局部暂缓清单

| 项 | 状态 | 本方案处理 |
| --- | --- | --- |
| Q01：6费Viktor、Mel、Warwick及专属羁绊 | 待定范围 | 不排入任何批次或阵容。原件补充记录已存在，但选择器/启用范围未冻结；不以它们补齐本方案的英雄或人数缺口。Viktor Q11、Mel S06/S13、Warwick处决/实验的机制只保留依赖说明。 |
| Q13：4星、Hero强化技能分支 | 待定范围 | 本方案仅1–3星；不从七槽外推4星基础属性，不把Hero数值当普通技能。 |
| Q15：8条强化解锁关系羁绊 | 待定范围 | 不排批次，不计阵容激活；两个伙伴同场不能当已解锁。 |
| Q02/Q05/Q06：形态与召唤必需数据 | 硬暂缓 | D01/D02按缺口取证；已知Sion75%/3秒/1秒不重复求数值，缺阶段映射仍阻塞相关档。 |
| Q03/Q04：Nunu及实验未知必需公式 | 局部暂缓 | Nunu D03；C04每个实验消费者逐项过字段/公式门槛，未过的不算完整英雄或完整实验阵。 |
| Q07：Sevika子技能/Jackpot/High Roller随机关系 | 硬暂缓 | D04；B03随机设施可先做，不为Sevika猜等概率或AD挂接。 |
| Q08：Rumble四处数值冲突 | 局部暂缓、采用待裁决 | D05；原值100/150 vs物品120/180、.4 vs .25、20 vs公告200均保留。四条3/3/5/15秒改造周期有证据，首次执行/重叠属政策，不能再当未绑定。 |
| Q09/Q12：装备/经济本体表 | 局部暂缓 | C05普通暂授/赞助先提政策；Scrap9光明本体、Conqueror/黑市奖励表等留D06取证。普通装备不能替代光明/非法装备；Rumble购买缺口留D05。 |
| Q12：Emissary/Ambessa对手进度 | 待提出单人政策 | 只影响其使者奖励/完整四使者，不阻塞Ambessa基础技能C02；不重做小炮已有成长。 |

**不先设“关闭全部新羁绊”的施工默认值。** 每个阵容达到阈值的效果必须完整通过；若需暂不开放某英雄、某档或某改造，实施批次须明确范围及版本/digest，不能静默过滤。没有被启用效果引用的null/hash仍归档、不激活，不能连带拦住整批；必需数据缺失也不能用保存null称完整。

## 7. 交付签收与本次文档核验

未来每交付批先冻结所需技能/羁绊执行合同、P政策与独立手算例，再施工验收；文档提案不能代替合同。签收覆盖本批全部主归属英雄完整启用分支、负责的可达羁绊档位与两套正式目标阵容，并单独检查未上阵消费者；硬缺口未解的消费者/档位局部暂缓，不把基础效果称完整。核对事件账本、动作/目标身份、取消/死亡/保存恢复、RNG词数及唯一收据，内容/规则同步版本与digest。沿用F例不重新定义。

除16套正式目标外，至少安排：A01 Nami/Garen/Tristana单使者例；A03梦魇真实攻击创建任务与Vex固定区域移出/移入例；B02各金额羁绊及B03未上阵技能例；C01固定扣减/六守望边界与Automata4复用例；C02 Firelight2/3及四迅击队友击杀/非死亡换敌反例；C03链接/传播/Wanted；C04 Sorcerer6及每位实验共享；C05废铁暂授/赞助生命周期；D01 Silco/Sion；D02双形态/五学院第三件；D06黑市及Ambessa单使者/四使者。这些独立例不是额外交付阵容，也不能在缺证时提前称签收。

本次文档按固定归档复算：8交付批/17工作包，60名主归属唯一（41新增/19已有）；16套阵容均8名不同英雄且不提前引用后续英雄，全部实际激活档位按minUnits/maxUnits核对；26条普通羁绊的每个原件档位都有责任、首次可达或不可达说明。Q01/Q13/Q15继续只列待定，Q08四处冲突未选值。未修改游戏代码、未运行游戏对局，不宣称新技能或阵容已通过运行验收。

## 附录：60名英雄主归属与既有状态

| apiName | 英雄 / 费用 | 主归属 / 交付批 | 现有main状态 | 完整技能依赖/暂缓分类 |
| --- | --- | --- | --- | --- |
| `TFT13_Irelia` | Irelia / 1 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Lux` | Lux / 1 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Leona` | Leona / 2 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Rell` | Rell / 2 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Vladimir` | Vladimir / 2 | A01 / 第1批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Beardy` | Loris / 3 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Nami` | Nami / 3 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Zoe` | Zoe / 4 | A01 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Darius` | Darius / 1 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Shooter` | Maddie / 1 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Prime` | Vander / 2 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_FlyGuy` | Scar / 3 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_KogMaw` | Kog'Maw / 3 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Garen` | Garen / 4 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Caitlyn` | Caitlyn / 5 | A02 / 第1批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Red` | Violet / 1 | A03 / 第2批 | 新增候选 | G/a；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Trundle` | Trundle / 1 | A03 / 第2批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Vex` | Vex / 1 | A03 / 第2批 | 新增候选 | (b)保存区域中心→到期读取棋盘→固定目标集合，语义/时长门槛见A03 |
| `TFT13_Nocturne` | Nocturne / 2 | A03 / 第2批 | 新增候选 | (b)实际攻击事件→有限延时流血任务，动作/目标/恢复合同须通过 |
| `TFT13_RenataGlasc` | Renata Glasc / 2 | A03 / 第2批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Tristana` | Tristana / 2 | A03 / 第2批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Cassiopeia` | Cassiopeia / 3 | A03 / 第2批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Chainsaw` | Renni / 3 | A03 / 第2批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Ezreal` | Ezreal / 3 | A03 / 第2批 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Ekko` | Ekko / 4 | A03 / 第2批 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Blue` | Powder / 1 | B01 / 第2批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Morgana` | Morgana / 1 | B01 / 第2批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Singed` | Singed / 1 | B01 / 第2批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Camille` | Camille / 2 | B01 / 第2批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_TwistedFate` | Twisted Fate / 3 | B01 / 第2批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Blitzcrank` | Blitzcrank / 3 | B02 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Illaoi` | Illaoi / 4 | B02 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Draven` | Draven / 1 | B03 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Zeri` | Zeri / 2 | B03 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Ziggs` | Ziggs / 2 | B03 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Heimerdinger` | Heimerdinger / 4 | B03 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Jinx` | Jinx / 5 | B03 / 第3批 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Amumu` | Amumu / 1 | C01 / 第3批 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Akali` | Akali / 2 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Sett` | Sett / 2 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Gremlin` | Smeech / 3 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Ambessa` | Ambessa / 4 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Corki` | Corki / 4 | C02 / 第4批 | 已有19之一，需按本批补齐/回归 | c；依本批机制与政策门槛 |
| `TFT13_Vi` | Vi / 4 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Mordekaiser` | Mordekaiser / 5 | C02 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Fish` | Steb / 1 | C03 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_LeBlanc` | LeBlanc / 5 | C03 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Malzahar` | Malzahar / 5 | C03 / 第4批 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Zyra` | Zyra / 1 | C04 / 第5批 | 已有19之一，需按本批补齐/回归 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Urgot` | Urgot / 2 | C04 / 第5批 | 已有19之一，需按本批补齐/回归 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_DrMundo` | Dr. Mundo / 4 | C04 / 第5批 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Twitch` | Twitch / 4 | C04 / 第5批 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Silco` | Silco / 4 | D01 / 第6批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Gangplank` | Gangplank / 3 | D02 / 第6批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Swain` | Swain / 3 | D02 / 第6批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Elise` | Elise / 4 | D02 / 第6批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Jayce` | Jayce / 5 | D02 / 第6批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_NunuWillump` | Nunu & Willump / 3 | D03 / 第7批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Lieutenant` | Sevika / 5 | D04 / 第7批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Rumble` | Rumble / 5 | D05 / 第8批 | 新增候选 | D/c；硬缺口/冲突暂缓 |
