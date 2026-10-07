# M9 分批方案（提案，未冻结为施工合同）

本方案基于[M9数据台账](M9_DATA_LEDGER.md)的兰博局部修订提交`3ae3962`、固定B1归档`877c59b2`与[B2冻结合同](https://github.com/catfish-xn/cat/blob/2632925/docs/M8_RULES.md)。这是文档规划，不修改游戏代码或批准新的执行政策。本文采用台账(a)已有表达/行为、(b)规划适配、(c)新规则/状态/生命周期三类；单个英雄取其完整技能所需的最高依赖，不按费用排工。

## 1. 范围、排序与“完整”的判定

- 候选仅S13标准模式**60名1–5费英雄、1–3星普通分支**。主归属唯一：A组25名、B组12名、C组15名、D组8名；已有19名是迁移/补齐与回归锚点，并非新加19名。C05/D06为羁绊配套批，不重复计英雄。
- 顺序为A（只需G01–G12及(a)）→B（需要(b)）→C（(c)新系统分别成批）→D（硬数据/公式/冲突的暂缓队列）。G覆盖指**机制能力足够承接完整技能**，不表示所有英雄/羁绊已写完；G11/G12无普通技能直接消费者，不硬塞进每批。每个批次仍需核对实际子机制执行与验收。
- 英雄完整包括被动、主动、替换攻击、选定形态及其已启用条件分支；换形不能只做一形态，实验不能永久删条件效果，Rumble不能把基础火箭等同完整条件改造。未开启的4星/Hero/关系分支只归档，不算缺普通技能。
- **英雄技能批与羁绊配套分别验收。** 两名自动机的技能都能用G，不代表金额羁绊已完成；旧Scar技能可在A02验收，2/3野火必须等C02。本文每阵都列全部实际激活档位，不将不完整触发系统当作静态属性羁绊交付。
- 阵容是累积可用目录下的**8人口、无纹章、无关系强化、无6费**目标，各英雄只占一格；包含前排与输出/治疗。仅表示规则可玩，不预言平衡强度。原件minUnits/maxUnits决定实际档位，5铁卫采用4档，2/3使者明确不激活；不把人数当档位，也不默认未列羁绊被关闭。
- F规则继续沿用，无需重开批准；P政策须提出并明确采纳后才施工。纯几何/短延时/控制离散化政策采纳后，可按项目规则实现，历史还原D继续留证，不自动重开已采纳政策。**必需数值、完整子技能、必要属性或同源数值冲突的D不能由政策凭空填补。** 下文标“暂缓/条件就绪”的英雄或效果未过门槛前不计完整交付。
- Vander M9历史暴击资格已决定：无技能授权的强化击不能暴击；另作M9行为变更与版本/digest/独立例。B3继续B2 basic-attack/basic；Draven斧头不随之改资格。Zeri原mana=3独立定义回蓝/主动施法资格，不能与Amumu mana=0混称无蓝。

## 2. 批次总览

| 批次 | 依赖类别 | 主归属英雄数 | 交付重心 | 开工/签收状态 |
| --- | --- | --- | --- | --- |
| A01 | G/a | 8 | 通用盾、治疗与法术前后排 | 机制可复用；新时序政策未冻结的条目暂缓签收 |
| A02 | G/a | 7 | 通用远程输出与守望前排 | 机制可复用；新时序政策未冻结的条目暂缓签收 |
| A03 | G/a | 10 | 其余通用技能与斗士炮手 | 机制可复用；新时序政策未冻结的条目暂缓签收 |
| B01 | b | 5 | 特殊选敌、自适应类型与攻速衰减规划 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| B02 | b | 2 | 承伤/汲取金额规划与战斗羁绊账本 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| B03 | b | 5 | 随机分支、多发替换与技能轮转规划 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| C01 | c | 1 | 固定承伤扣减阶段 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| C02 | c | 7 | 权威位移、追击与野火 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| C03 | c | 3 | 分享、链接、传播与死亡反应 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| C04 | c | 4 | 实验格与已知条件加成 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| C05 | c | 0 | 赞助与临时装备所有权 | 条件就绪：先采纳新政策，硬D局部分支仍暂缓 |
| D01 | D/c | 1 | 暂缓：召唤物与黑玫瑰Sion取证 | 暂缓：解除对应数据/公式/数值冲突后再排日期 |
| D02 | D/c | 4 | 暂缓：四名双形态目录 | 暂缓：解除对应数据/公式/数值冲突后再排日期 |
| D03 | D/c | 1 | 暂缓：Nunu必需公式与五实验 | 暂缓：解除对应数据/公式/数值冲突后再排日期 |
| D04 | D/c | 1 | 暂缓：Sevika子技能与High Roller | 暂缓：解除对应数据/公式/数值冲突后再排日期 |
| D05 | D/c | 1 | 暂缓：Rumble条件改造与购买 | 暂缓：解除对应数据/公式/数值冲突后再排日期 |
| D06 | D/c | 0 | 暂缓：经济奖励表与使者对手进度 | 暂缓：解除对应数据/公式/数值冲突后再排日期 |

依赖主线：A01→A02/A03→B01→B02→B03→C01/C02→C03→C04/C05。C01与C02只在各自前置齐全时推进，不要求固定减伤先于所有位移。D01召唤数据与D02双形态可独立取证，D02实例执行依赖D01生命周期；D03依赖C04（六斗士目标还需D02）；D04依赖D02的Gangplank及C组；D05依赖C05和自己的Q08/Q12；D06逐奖励系统解除缺口。D编号表示候选队列，不是已批准的开工日期。

## 3. 各批英雄、羁绊、机制与阵容

表中“涉及羁绊”列出主归属英雄、阵容复用英雄及本批配套羁绊的全部原始身份；其中未到阈值或另有配套批的不能提前称已实现。阵容的“实际激活”是根据原件复算的全部生效羁绊，后续实现必须逐个通过配套门槛。

### A01 通用盾、治疗与法术前后排

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Irelia（1费，`TFT13_Irelia`）；Lux（1费，`TFT13_Lux`）；Leona（2费，`TFT13_Leona`）；Rell（2费，`TFT13_Rell`）；Loris（3费，`TFT13_Beardy`）；Nami（3费，`TFT13_Nami`）；Vladimir（2费，`TFT13_Vladimir`）；Zoe（4费，`TFT13_Zoe`） |
| 涉及羁绊 | Academy、Black Rose、Conqueror、Emissary、Enforcer、Rebel、Sentinel、Sorcerer、Visionary、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10的既有组合；S05(a)吸收/偷抗/分担、S09(a)下一击；不新增规则系统。同步Sorcerer2/4、Sentinel2/4/6及单使者Nami/Garen/Tristana效果的G01/G08/G09/G10组合（Ambessa除外）。 |
| 前置 | M8对应G机制执行与B2冻结行为通过；无(b)/(c)前置。 |
| 阻塞/政策 | Q03-F/Q05-F/Q10-F/Q14-F沿已冻结规则，不重开批准；完整历史几何欠据继续记录。无已识别的必需数值/属性硬缺口。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 法术与盾前排 | Irelia、Rell、Leona、Loris、Lux、Vladimir、Nami、Zoe | 1 Emissary、4 Sentinel、4 Sorcerer | Nami为唯一使者；前四名承伤，后四名输出/护盾。 |

### A02 通用远程输出与守望前排

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Darius（1费，`TFT13_Darius`）；Vander（2费，`TFT13_Prime`）；Scar（3费，`TFT13_FlyGuy`）；Garen（4费，`TFT13_Garen`）；Kog'Maw（3费，`TFT13_KogMaw`）；Caitlyn（5费，`TFT13_Caitlyn`）；Maddie（1费，`TFT13_Shooter`） |
| 涉及羁绊 | Automata、Black Rose、Conqueror、Emissary、Enforcer、Family、Firelight、Sniper、Sorcerer、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10；S04(a)凯特琳ID排序/每发一词/modulo；S09(a)Kog计数/射程与Vander一次强化；Watcher2/4、Sniper2/4/6。 |
| 前置 | A01可提供Vladimir/Nami与基础属性羁绊；机制迁移沿B2。 |
| 阻塞/政策 | Vander M9历史暴击修正已获决定，需独立规则/版本/digest和无授权/有授权验收，B3不改B2。Scar仅普通技能在本批完整；Firelight要到C02。Kog/凯特琳随机或本场规则属于F，不因历史字段unknown重开批准。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 守望狙击 | Darius、Vander、Scar、Garen、Kog'Maw、Caitlyn、Vladimir、Nami | 2 Sniper、2 Sorcerer、4 Watcher；Emissary 2不激活 | Garen/Nami共2使者，明确不激活；只有Caitlyn一名执法，不触发尚未安排的Wanted系统。 |

### A03 其余通用技能与斗士炮手

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Trundle（1费，`TFT13_Trundle`）；Vex（1费，`TFT13_Vex`）；Renata Glasc（2费，`TFT13_RenataGlasc`）；Nocturne（2费，`TFT13_Nocturne`）；Tristana（2费，`TFT13_Tristana`）；Ezreal（3费，`TFT13_Ezreal`）；Cassiopeia（3费，`TFT13_Cassiopeia`）；Renni（3费，`TFT13_Chainsaw`）；Violet（1费，`TFT13_Red`）；Ekko（4费，`TFT13_Ekko`） |
| 涉及羁绊 | Academy、Ambusher、Artillerist、Automata、Black Rose、Bruiser、Chem-Baron、Dominator、Emissary、Enforcer、Family、Firelight、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Visionary |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；G01–G10有限伤害/治疗/控制/任务与计数；S05(a)/S06(a)小炮溢出和已有持久成长；Bruiser2/4/6、Artillerist2/4/6。Renni原格抬起/落下按控制与伤害处理；Ekko后像按有限伤害包，不凭“Summon”一词造持久实体。 |
| 前置 | A01/A02前排和基础机制；不需要(b)/(c)新执行器。 |
| 阻塞/政策 | 新英雄Q03-P/Q10-P需明确取样/时序，尤其Vex短延时、Violet短击飞；DOTDuration/StunDuration历史绑定仍unknown，不在本方案选时长。两位在政策采纳或必要绑定取得前暂缓完整签收；其他英雄可先行。若要求源档完整历史时序，则相应移入末尾取证队列。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 斗士炮手 | Trundle、Renni、Renata Glasc、Nocturne、Irelia、Loris、Ezreal、Tristana | 2 Artillerist、2 Bruiser、1 Emissary、2 Sentinel | 只有2炼金男爵和1废铁；不误开经济/装备新系统。 |
| 斗士近战变体 | Trundle、Renni、Renata Glasc、Violet、Irelia、Loris、Ezreal、Tristana | 2 Artillerist、2 Bruiser、1 Emissary、2 Sentinel | Violet替换Nocturne，形成同样的完整已激活羁绊；须先通过上述短控时序门槛。 |

### B01 特殊选敌、自适应类型与攻速衰减规划

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Singed（1费，`TFT13_Singed`）；Powder（1费，`TFT13_Blue`）；Twisted Fate（3费，`TFT13_TwistedFate`）；Morgana（1费，`TFT13_Morgana`）；Camille（2费，`TFT13_Camille`） |
| 涉及羁绊 | Academy、Ambusher、Black Rose、Chem-Baron、Conqueror、Emissary、Enforcer、Family、Firelight、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；P01(b)本轮伤害最多、最大敌群/圆群、未诅咒资格；S07(b)逐目标physical/magic解析；Singed G01/G05衰减规划。配套Family3/4的法力/属性组合、Ambusher2–5技能授权/暴击属性；不含Family5劫掠。 同步Visionary2/4/6普通回蓝放大取样/资格适配(b)，不把Zeri攻击计数或专属资源当普通蓝；Visionary8的伤害友疗不在本批。 |
| 前置 | A组；固定目标有限计划及通用金额/任务执行。 |
| 阻塞/政策 | Q03-P/Q10-P：取样、伤害口径、并列、衰减曲线/离散化、Camille等抗；政策待提出/采纳。若要严格还原曲线，Q03-D须补脚本；不能固定攻速4秒再移除。Morgana削盾资格需Q14政策，不偷偷扩G07/Trigger枚举。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 家人与伏击 | Powder、Violet、Vander、Camille、Garen、Vladimir、Scar、Lux | 2 Ambusher、1 Emissary、3 Family、2 Sorcerer、4 Watcher | Garen唯一使者；仅Camille一名执法、Scar一名野火，避免提前依赖C组。 |
| 先知与铁卫 | Singed、Renata Glasc、Morgana、Rell、Irelia、Leona、Loris、Vex | 4 Sentinel、4 Visionary | 炼金男爵仅2；最大的先知档为4，铁卫5人只采用4档。 |

### B02 承伤/汲取金额规划与战斗羁绊账本

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Blitzcrank（3费，`TFT13_Blitzcrank`）；Illaoi（4费，`TFT13_Illaoi`） |
| 涉及羁绊 | Academy、Artillerist、Automata、Black Rose、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Pit Fighter、Rebel、Sentinel、Sniper、Sorcerer、Visionary |
| 机制需求 | G01,G02,G03,G05,G06,G07,G08,G09,G10；S05(b)Blitz承伤反击、Illaoi汲取；独立金额状态，绝不把G09次数改金额。配套Automata2/4的伤害累计/水晶次数、Rebel3/5/7团队失血阈值与有限奖励、Dominator2/4/6消耗法力→AP规划、Pit Fighter2/4/6真伤附包/阈值治疗。底层仍用已有damage/heal/modify-stat；金额取样与次数各自保存。 |
| 前置 | B01；G02/G06/G07权威结果与source/actionSeq/packetId/parentPacketId边界。 |
| 阻塞/政策 | Q14-P/Q10-P：absorbed/hpDamage/overkill口径、阈值取样、同tick、清零/恢复、附包防回传；这些运行态与规划适配需M9明确合同，不能声称B3已有执行器或扩充冻结枚举。仅有百分比数字不等于账本完整。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 自动机与铁卫 | Blitzcrank、Kog'Maw、Rell、Leona、Loris、Irelia、Renata Glasc、Cassiopeia | 2 Automata、2 Dominator、4 Sentinel、2 Visionary | 2自动机、2统治者的完整战斗效果同时验收；只2黑玫瑰以下，不依赖Sion。 |
| 叛军炮法 | Illaoi、Irelia、Vex、Ezreal、Zoe、Rell、Lux、Tristana | 2 Artillerist、1 Emissary、5 Rebel、2 Sentinel、2 Sorcerer、2 Visionary | Tristana唯一使者；5叛军失血触发是本批配套账本，不能只给静态属性就称完整。 |

### B03 随机分支、多发替换与技能轮转规划

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Draven（1费，`TFT13_Draven`）；Zeri（2费，`TFT13_Zeri`）；Ziggs（2费，`TFT13_Ziggs`）；Heimerdinger（4费，`TFT13_Heimerdinger`）；Jinx（5费，`TFT13_Jinx`） |
| 涉及羁绊 | Academy、Ambusher、Artillerist、Black Rose、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Firelight、Pit Fighter、Rebel、Scrap、Sentinel、Sniper、Sorcerer、Visionary |
| 机制需求 | G01,G02,G03,G04,G08,G09,G10；S04(b)显式战斗RNG候选/权重→有限计划；S09(b)回旋斧持续替换、Zeri每3攻、多发/轮转。一次攻击只发一次attack-completed，每包delivery/暴击资格独立，取消不提前消费。Zeri回蓝/主动施法资格单独适配，原mana=3不当普通法力上限。 |
| 前置 | B01/B02，尤其Rebel团队阈值与Dominator法力取样。 |
| 阻塞/政策 | Q10-P/Q14-P：随机抽样、弹药/轮转消费时点、目标失效；B2凯特琳抽样保持原样，技能随机不借G12装备流。Q11的Zeri澄清是实施门槛而非Viktor硬缺口。Draven不改为Vander技能授权资格。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 叛军轮转主攻 | Irelia、Vex、Ezreal、Zoe、Jinx、Rell、Lux、Tristana | 2 Artillerist、1 Emissary、5 Rebel、2 Sentinel、2 Sorcerer、2 Visionary | 在B02炮法基础上以Jinx换Illaoi；同一5叛军骨架验证轮转与多包计数。 |
| 统治者随机火力 | Ziggs、Cassiopeia、Heimerdinger、Rell、Leona、Irelia、Loris、Renata Glasc | 2 Dominator、4 Sentinel、2 Visionary | 仅2学院；不提前激活赞助物品。 |

### C01 固定承伤扣减阶段

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Amumu（1费，`TFT13_Amumu`） |
| 涉及羁绊 | Academy、Automata、Conqueror、Dominator、Emissary、Enforcer、Family、Firelight、Quickstriker、Rebel、Sentinel、Sniper、Visionary、Watcher |
| 机制需求 | G02,G03,G05,G09,G10；FD01(c)所有incoming damage固定扣减、G05每秒火花；G02顺序/资格新增合同，不能把damageReduction.flat当HP扣减或用incoming-basic-hit模拟。 |
| 前置 | A/B组；FD01须先明确G02阶段合同。 |
| 阻塞/政策 | Q05-D：FlatDRCooldownPerAttacker活跃性/单位未证实；若不启用此候选参数可独立归档，若证明为必需则暂缓该分支。FD01抗性/%减伤/盾先后、真伤、零伤/最低1、多包等政策未采纳前不可签收。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 自动机守望 | Amumu、Nocturne、Kog'Maw、Blitzcrank、Garen、Vander、Darius、Scar | 4 Automata、1 Emissary、4 Watcher | 自动机4；守望5人实际为4档，只有Scar一名野火。 |
| 自动机铁卫 | Amumu、Nocturne、Kog'Maw、Blitzcrank、Rell、Leona、Loris、Irelia | 4 Automata、4 Sentinel | 4自动机/4铁卫，无需Sion或炼金男爵。 |

### C02 权威位移、追击与野火

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Akali（2费，`TFT13_Akali`）；Sett（2费，`TFT13_Sett`）；Vi（4费，`TFT13_Vi`）；Smeech（3费，`TFT13_Gremlin`）；Corki（4费，`TFT13_Corki`）；Ambessa（4费，`TFT13_Ambessa`）；Mordekaiser（5费，`TFT13_Mordekaiser`） |
| 涉及羁绊 | Ambusher、Artillerist、Automata、Black Rose、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Family、Firelight、Pit Fighter、Quickstriker、Rebel、Scrap、Sentinel、Sniper、Sorcerer、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S01(c)权威坐标、占格、移动/拉拽/击退/飞行生命周期；Smeech装备最少、Mordekaiser最大直线敌群复用B01规划；S09(b)姿态与持续替换复用B03。配套Quickstriker2/3/4、Firelight2/3（位移＋S05(b)上次突进以来承伤→G06治疗及攻击射程/节奏）。 |
| 前置 | B01特殊选敌、B02金额取样、B03攻击替换；单位集合/位置/可选资格边界。 |
| 阻塞/政策 | Q10-P/Q14-P：目的格/碰撞/不可移动、取消、账本清零/恢复、临时射程；Akali SpeedDuringFinalKick等unknown不能直接当仿真单位。Ambessa使者对手奖励暂缓D06，本批可完整基础技能，但不称其单使者奖励已实现。Corki从旧无侧移行为到历史位移也需M9显式合同/版本验收。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 迅击追击 | Nocturne、Akali、Twisted Fate、Ambessa、Irelia、Illaoi、Nami、Vladimir | 4 Quickstriker、3 Rebel、2 Sentinel、2 Sorcerer；Emissary 2不激活 | Ambessa/Nami为2使者，明确不激活对手进度；只有Ambessa一名征服者。 |
| 野火远程 | Zeri、Scar、Ekko、Kog'Maw、Nocturne、Blitzcrank、Garen、Vander | 2 Automata、1 Emissary、3 Firelight、2 Sniper、2 Watcher | 3野火、2自动机完整运行；不使用4狙击所必带的两名执法，避开C03 Wanted。 |

### C03 分享、链接、传播与死亡反应

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Steb（1费，`TFT13_Fish`）；LeBlanc（5费，`TFT13_LeBlanc`）；Malzahar（5费，`TFT13_Malzahar`） |
| 涉及羁绊 | Academy、Ambusher、Automata、Black Rose、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Pit Fighter、Rebel、Sentinel、Sniper、Sorcerer、Visionary、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G08,G09,G10；S05(c)任意治疗分享、成员链接防回传、死亡感染传播与同tick顺序；结果仍走G02/G06。配套Enforcer2/4/6/8：最高HP Wanted身份及死亡收益反应。Wanted并未在冻结TargetSelector/Condition里现成表达，本方案按新身份/死亡反应状态安排(c)，不假称只靠G10/G09已完整覆盖；Enforcer10没收另留C05/取证。 |
| 前置 | B02权威金额、B03有限替换计划、C02当前单位/资格读取。 |
| 阻塞/政策 | Q14-P：actual治疗/成员/来源、防回传/源死、传播存活资格与去重；不得偷加B2 heal-completed/death枚举。若某启用效果必需的未知公式仍缺，标Q14-D局部暂缓，不能以无限递归/截断事件蒙混签收。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 六执法与守望 | Steb、Maddie、Camille、Loris、Vi、Caitlyn、Garen、Vladimir | 1 Emissary、6 Enforcer、2 Sniper、2 Watcher | 6执法全部战斗效果含Wanted死亡奖励；只有1黑玫瑰。 |
| 六先知统治者 | Morgana、Renata Glasc、Rell、Vex、Heimerdinger、Malzahar、Blitzcrank、Cassiopeia | 2 Automata、2 Dominator、6 Visionary | 6先知/2统治者/2自动机；黑玫瑰仅2，不触发Sion。 |

LeBlanc还可替换A01的Lux：维持4法师/4铁卫，仅LeBlanc＋Vladimir两名黑玫瑰，不触发未取证的Sion。

### C04 实验格与已知条件加成

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Zyra（1费，`TFT13_Zyra`）；Urgot（2费，`TFT13_Urgot`）；Dr. Mundo（4费，`TFT13_DrMundo`）；Twitch（4费，`TFT13_Twitch`） |
| 涉及羁绊 | Academy、Artillerist、Automata、Black Rose、Conqueror、Dominator、Emissary、Enforcer、Experiment、Pit Fighter、Rebel、Sentinel、Sniper、Sorcerer、Visionary、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S11(c)实验格、开战成员/来源、共享/倍增资格；资格后的G机制复用(a)。先交付可组成的Experiment3档（2实验格/100HP）及完整已取证加成；Urgot还需S01、Twitch还需S04/S09。不得只关闭实验分支就把普通技能称完整英雄。 六法阵所需Sorcerer6属性档同步以G01补齐，不混入Sorcerer8的伤害削减。 |
| 前置 | C02移动与B03随机穿透/替换，C03有界反应；Nunu完整资格留D03。 |
| 阻塞/政策 | Q04-P的格位/镜像/来源/存续需采纳；每个CurrentExperimentBonus宏须有明确字段/公式映射，任何必需Q04-D未补齐的消费者暂缓完整签收，不能猜值。Nunu普通减伤绑定/实验公式单列末尾D03；5/7档及未知加成不在3档验收中混称完成。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 实验狙击与守望 | Zyra、Urgot、Dr. Mundo、Twitch、Kog'Maw、Caitlyn、Vladimir、Garen | 1 Emissary、3 Experiment、2 Sniper、2 Sorcerer、2 Watcher | 4实验英雄采用3档；待这四位共享加成各自通过字段绑定后，才能称本阵容完整。 |
| 六法铁卫 | Lux、Vladimir、Nami、Zoe、LeBlanc、Zyra、Irelia、Rell | 1 Emissary、2 Sentinel、6 Sorcerer | 仅1实验不激活共享，黑玫瑰2不激活召唤；与上一阵对照条件资格。 |

### C05 赞助与临时装备所有权

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | 无新增主归属英雄；复用此前批次。 |
| 配套消费者 | Powder、Trundle、Ziggs、Ekko、Camille、Garen、Vladimir、Scar；Lux、Leona、Ezreal、Heimerdinger、Rell、Loris、Nami、Zoe |
| 涉及羁绊 | Academy、Ambusher、Artillerist、Black Rose、Bruiser、Conqueror、Dominator、Emissary、Enforcer、Family、Firelight、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher |
| 机制需求 | G01–G10/G12的适用组合；S12(c)赞助选择/授予收据、原件/临时子件来源与生命周期；Scrap2/4、Academy3/4完整有效档位，G12只复用部分应用/撤销，不等于任意改造系统。Enforcer10需独立没收/归还所有权政策和可达阵容支持，不能混入低档验收。 |
| 前置 | C02野火、C03执法反应、M8 G12/TG-01已冻结应用/撤销边界。 |
| 阻塞/政策 | Q09-P：普通成装池、赞助选取/槽冲突、清理/归还/恢复；Scrap6“lucky”执行定义未齐则暂缓该档，Scrap9光明本体Q09-D留取证队列。Academy5需Jayce/D02，6档及Enforcer10须另有数量来源，本文阵容不用纹章。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 废铁伏击野火 | Powder、Trundle、Ziggs、Ekko、Camille、Garen、Vladimir、Scar | 3 Ambusher、1 Emissary、2 Firelight、4 Scrap、2 Watcher | 4废铁、3伏击和2野火均须完整，不能只给废铁盾不做暂授。 |
| 学院法术火力 | Lux、Leona、Ezreal、Heimerdinger、Rell、Loris、Nami、Zoe | 4 Academy、1 Emissary、2 Sentinel、2 Sorcerer、2 Visionary | 4学院包括赞助物品和授予；Nami唯一使者。 |

### D01 暂缓：召唤物与黑玫瑰Sion取证

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Silco（4费，`TFT13_Silco`） |
| 配套消费者 | Morgana、Cassiopeia、Vladimir、LeBlanc等黑玫瑰；后续Elise/Jayce的召唤接入 |
| 涉及羁绊 | Academy、Automata、Black Rose、Chem-Baron、Conqueror、Dominator、Emissary、Rebel、Scrap、Sentinel、Sorcerer、Visionary、Watcher |
| 机制需求 | G02,G03,G05,G08,G10；S02(c)实例ID、所属方、容量、创建/退出、攻击次数与死亡/复活；Silco monstrosities和Black Rose/Sion；G11清仇恨不是复活。 |
| 前置 | C组单位/死亡/所有权边界；解除Q05/Q06后再排施工。可先写S02生命周期合同，不开放残缺实体。 |
| 阻塞/政策 | Q05-D Silco召唤必需属性/完整攻击执行；MinionDuration仍仅归档、不默认12秒寿命，不把非必需未绑定字段单独当全技能硬阻塞；Q06 Sion实际成长/分档属性/解锁映射。75%复活、3秒盾、1秒晕已知，不重列为缺数字。只完整取得适用档证据后才开放该档。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 黑玫瑰法术 | Morgana、Cassiopeia、Vladimir、LeBlanc、Nami、Lux、Rell、Leona | 4 Black Rose、1 Emissary、2 Sentinel、4 Sorcerer、2 Visionary | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；目标4黑玫瑰；Sion4档成长/解锁签收前暂缓，不把现有四法阵容等同完整黑玫瑰。 |
| 召唤统治者 | Silco、Blitzcrank、Ziggs、Cassiopeia、Heimerdinger、Rell、Renata Glasc、Vex | 4 Dominator、4 Visionary | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；目标4统治者/4先知；只有2炼金男爵，不依赖黑市。 |

### D02 暂缓：四名双形态目录

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Gangplank（3费，`TFT13_Gangplank`）；Swain（3费，`TFT13_Swain`）；Elise（4费，`TFT13_Elise`）；Jayce（5费，`TFT13_Jayce`） |
| 涉及羁绊 | Academy、Black Rose、Bruiser、Conqueror、Emissary、Form Swapper、Pit Fighter、Rebel、Scrap、Sorcerer、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G06,G07,G08,G09,G10；S03(a)镜像行/开战取样复用；S03(c)双套属性/技能/形态目录；Elise/Jayce另需S01/S02，Jayce工坊死亡/复活必须完整。 |
| 前置 | D01 S02基础设施＋C02位移，双形态数据可独立取证；不要求Sion各档全部完成。 |
| 阻塞/政策 | Q02四位完整双形态基础属性与第二技能硬缺；Elise蜘蛛/Jayce工坊等必需召唤参数并入Q05-D。GP近战AD65已有目标，不能覆盖载体全形态；无null→0、无拿另一形态替代。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 四换形法术 | Gangplank、Swain、Elise、Jayce、Lux、Vladimir、Nami、Zoe | 1 Emissary、4 Form Swapper、4 Sorcerer | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；4换形＋4法师；只2黑玫瑰、2学院，不依赖额外Sion/赞助高档。 |

### D03 暂缓：Nunu必需公式与五实验

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Nunu & Willump（3费，`TFT13_NunuWillump`） |
| 涉及羁绊 | Artillerist、Automata、Black Rose、Bruiser、Chem-Baron、Dominator、Emissary、Enforcer、Experiment、Form Swapper、Pit Fighter、Rebel、Scrap、Sniper、Sorcerer、Visionary、Watcher |
| 机制需求 | G01,G02,G03,G05,G08,G09,G10；G01/G02/G05及S11(c)共享实验；普通Durability→ModifiedDurability计算绑定与实验公式分开取证。 |
| 前置 | C04实验系统，六斗士目标还需D02 Elise完整目录。 |
| 阻塞/政策 | Q03-D/Q04-D/Q05-D：已知普通减伤效果不能删；原Durability数字存在但宏绑定未证实，不以静默采用或关闭效果称完整英雄。必要绑定/公式取得后再开放Nunu和完整5实验；7档仍受可达人数/范围限制。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 五实验狙击 | Zyra、Urgot、Nunu & Willump、Dr. Mundo、Twitch、Caitlyn、Kog'Maw、Garen | 1 Emissary、5 Experiment、2 Sniper | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；5实验全部成员/共享、3实验格/300HP均须完整；不依赖待定Warwick。 |
| 六斗士双狙击 | Steb、Trundle、Sett、Renni、Nunu & Willump、Elise、Twitch、Kog'Maw | 6 Bruiser、2 Sniper | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；6斗士＋2狙击；仅2实验、1黑玫瑰，不激活这两条条件羁绊。 |

### D04 暂缓：Sevika子技能与High Roller

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Sevika（5费，`TFT13_Lieutenant`） |
| 涉及羁绊 | Ambusher、Artillerist、Chem-Baron、Conqueror、Enforcer、Experiment、Family、Form Swapper、High Roller、Pit Fighter、Scrap、Watcher |
| 机制需求 | G01,G02,G03,G04,G05,G07,G08,G09,G10；S04(b)有限抽样＋S01(c)/S08(c)位移/吞噬/处决资格；S12(c)High Roller改造及金币唯一收据，不能以超大真伤/HP清零代处决。 |
| 前置 | B03随机规划、C02位移、C03反应；取得Q07后才开放完整英雄。 |
| 阻塞/政策 | Q07三份子正文/挂接、Jackpot AD2.5映射与概率；High Roller哈希权重同样须核对。Q12对应奖励/执行资格分支缺证时暂缓；不等概率、不用最大字段猜Jackpot。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 六搏击家人与废铁 | Draven、Violet、Urgot、Vi、Gangplank、Sevika、Powder、Vander | 3 Family、1 High Roller、6 Pit Fighter、2 Scrap | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；6搏击、3家人、2废铁、1High Roller；需D02 GP完整技能，不依赖6炼金男爵黑市。 |

### D05 暂缓：Rumble条件改造与购买

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | Rumble（5费，`TFT13_Rumble`） |
| 涉及羁绊 | Academy、Ambusher、Chem-Baron、Dominator、Enforcer、Family、Firelight、Junker King、Rebel、Scrap、Sentinel |
| 机制需求 | G01,G02,G03,G04,G05,G06,G08,G09,G10；基础技能G01–G10可独立规划；S12(c)最强兰博归属、每3轮购买/升级、升级持久化。四条周期已取证，只在获得改造后生效；不能当无条件技能。 |
| 前置 | C05装备/来源与Match收据基础；已知基础技能可先做预备任务，但不计完整Junker King。 |
| 阻塞/政策 | 扩大后的Q08：Tankbuster1/2（100/150 vs 120/180）、Microbots3（.4 vs .25）、自毁3（20 vs 公告200倍）均数值采用待裁决，本方案不选值。Q12价格/购买/升级表及周期首次执行/重叠政策仍需补齐。仅这些分支阻塞；基础技能和无冲突改造可先准备，完整英雄签收待明确开放范围。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 废铁铁卫改造 | Rumble、Powder、Ziggs、Ekko、Irelia、Loris、Leona、Singed | 2 Ambusher、1 Junker King、4 Scrap、4 Sentinel | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；4废铁、4铁卫、2伏击、1Junker King；包含改造购买资格，不能以基础火箭已实现宣称该阵完整。 |

### D06 暂缓：经济奖励表与使者对手进度

| 项目 | 本批范围 |
| --- | --- |
| 英雄 | 无新增主归属英雄；复用此前批次。 |
| 配套消费者 | Darius、Draven、Rell、Swain、Ambessa、Mordekaiser等征服者；Singed、Renata、Renni、Smeech、Silco、Sevika等炼金男爵；Garen/Nami/Tristana/Ambessa使者 |
| 涉及羁绊 | Academy、Ambusher、Artillerist、Bruiser、Chem-Baron、Conqueror、Dominator、Emissary、Enforcer、Family、Form Swapper、High Roller、Pit Fighter、Quickstriker、Rebel、Sentinel、Sorcerer、Visionary、Watcher |
| 机制需求 | G01–G10/G12的适用组合；S06(c)新增跨轮来源/对手身份与去重进度；S12(c)Conqueror箱、Chem-Baron黑市/非法装备与Family5劫掠收据。单使者Ambessa及4使者需要PlayersDefeated/7、每对手+2双抗政策；不能每场胜利当新对手，也不用PVE=4替代。 |
| 前置 | 前述英雄/系统，特别D01/D02/D04；先补Q12内容表，再分别开放对应系统，不捆绑成全局阻塞。 |
| 阻塞/政策 | Q12经济奖励池/价格/阈值硬缺口与单人身份/封顶/收据政策分开；Family5、Scrap9光明等不可达/缺表分支暂缓，不能用普通奖励/装备替代。已有小炮成长不重做；Mel不在本批范围。 |

| 阵容目标（8人口） | 英雄 | 实际激活档位 | 完整性门槛/说明 |
| --- | --- | --- | --- |
| 六征服炮手 | Darius、Draven、Rell、Ambessa、Mordekaiser、Swain、Ezreal、Tristana | 2 Artillerist、6 Conqueror；Emissary 2不激活 | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；6征服者箱/成长完整；Ambessa与Tristana共2使者不激活，不将这个阵作为4使者签收证据。 |
| 六炼金伏击执法 | Singed、Renata Glasc、Renni、Smeech、Silco、Sevika、Steb、Camille | 2 Ambusher、2 Bruiser、6 Chem-Baron、2 Enforcer、1 High Roller | 暂缓目标，须本批数据门槛和所依赖配套签收后才可玩；6炼金黑市/跳过收益完整，外带2斗士/2伏击/2执法；High Roller和Silco召唤必须先解锁。 |

使者附加验收必须分别检查Nami/Garen/Tristana单使者、Ambessa单使者与四使者（Ambessa、Garen、Nami、Tristana）的完整奖励；上面2使者阵容不能作四使者验收。身份/去重/封顶7/唯一收据政策未采纳前，Ambessa使者奖励继续暂缓。

## 4. 待定范围与局部暂缓清单

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

## 5. 每批签收与计划验证

每批先提交明确的技能/羁绊执行合同、所采纳P政策与独立手算例，再实施与验收；文档提案不代替批准。签收须覆盖该批完整启用技能/条件、实际激活羁绊与一至两套目标阵容，核对事件账本、取消/死亡/保存恢复、RNG词数与唯一收据；新内容/规则同步版本和digest。沿用F规则的例不重定义；每次只扩大到本批影响面。

本次为只读数据规划检查：60名1–5费英雄主归属唯一，已有19名全部包含；每个阵容8个不同英雄、无6费/关系强化，羁绊计数按原件minUnits/maxUnits复算；A/B/C阵容只使用本批或此前英雄，D阵容的额外前置明确列出；6费/4星/关系羁绊只列待定，没有伪装成已安排批次。未运行游戏对局，不宣称任何新技能或阵容已通过运行验收。

## 附录：60名英雄主归属与既有状态

| apiName | 英雄 / 费用 | 主归属 | 现有main状态 | 完整技能依赖/暂缓分类 |
| --- | --- | --- | --- | --- |
| `TFT13_Irelia` | Irelia / 1 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Lux` | Lux / 1 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Leona` | Leona / 2 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Rell` | Rell / 2 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Vladimir` | Vladimir / 2 | A01 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Beardy` | Loris / 3 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Nami` | Nami / 3 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Zoe` | Zoe / 4 | A01 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Darius` | Darius / 1 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Shooter` | Maddie / 1 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Prime` | Vander / 2 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_FlyGuy` | Scar / 3 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_KogMaw` | Kog'Maw / 3 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Garen` | Garen / 4 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Caitlyn` | Caitlyn / 5 | A02 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Red` | Violet / 1 | A03 | 新增候选 | G/a；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Trundle` | Trundle / 1 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Vex` | Vex / 1 | A03 | 新增候选 | G/a；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Nocturne` | Nocturne / 2 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_RenataGlasc` | Renata Glasc / 2 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Tristana` | Tristana / 2 | A03 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Cassiopeia` | Cassiopeia / 3 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Chainsaw` | Renni / 3 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Ezreal` | Ezreal / 3 | A03 | 已有19之一，需按本批补齐/回归 | G/a；依本批机制与政策门槛 |
| `TFT13_Ekko` | Ekko / 4 | A03 | 新增候选 | G/a；依本批机制与政策门槛 |
| `TFT13_Blue` | Powder / 1 | B01 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Morgana` | Morgana / 1 | B01 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Singed` | Singed / 1 | B01 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Camille` | Camille / 2 | B01 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_TwistedFate` | Twisted Fate / 3 | B01 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Blitzcrank` | Blitzcrank / 3 | B02 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Illaoi` | Illaoi / 4 | B02 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Draven` | Draven / 1 | B03 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Zeri` | Zeri / 2 | B03 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Ziggs` | Ziggs / 2 | B03 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Heimerdinger` | Heimerdinger / 4 | B03 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Jinx` | Jinx / 5 | B03 | 新增候选 | b；依本批机制与政策门槛 |
| `TFT13_Amumu` | Amumu / 1 | C01 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Akali` | Akali / 2 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Sett` | Sett / 2 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Gremlin` | Smeech / 3 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Ambessa` | Ambessa / 4 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Corki` | Corki / 4 | C02 | 已有19之一，需按本批补齐/回归 | c；依本批机制与政策门槛 |
| `TFT13_Vi` | Vi / 4 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Mordekaiser` | Mordekaiser / 5 | C02 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Fish` | Steb / 1 | C03 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_LeBlanc` | LeBlanc / 5 | C03 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Malzahar` | Malzahar / 5 | C03 | 新增候选 | c；依本批机制与政策门槛 |
| `TFT13_Zyra` | Zyra / 1 | C04 | 已有19之一，需按本批补齐/回归 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Urgot` | Urgot / 2 | C04 | 已有19之一，需按本批补齐/回归 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_DrMundo` | Dr. Mundo / 4 | C04 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Twitch` | Twitch / 4 | C04 | 新增候选 | c；具体字段/时序政策门槛见本批；未过不签收 |
| `TFT13_Silco` | Silco / 4 | D01 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Gangplank` | Gangplank / 3 | D02 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Swain` | Swain / 3 | D02 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Elise` | Elise / 4 | D02 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Jayce` | Jayce / 5 | D02 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_NunuWillump` | Nunu & Willump / 3 | D03 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Lieutenant` | Sevika / 5 | D04 | 新增候选 | D/c；硬缺口/冲突暂缓 |
| `TFT13_Rumble` | Rumble / 5 | D05 | 新增候选 | D/c；硬缺口/冲突暂缓 |
