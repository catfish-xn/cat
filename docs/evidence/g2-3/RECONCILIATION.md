# G2-3 实现对账与接口交接

## v15 联机法球领取（2026-10-20）

基线 a0d42c5；线上英雄赠礼改为法球，领取才占池，满席按完整星级售价出售，缺货按费用且不叠加。单机计算保持。`LOOT_RUNTIME_REVISION=multiplayer-orb-claim-v2`，rules/content v15，联机法球合同 multiplayer-orb-claim-v1，网络目标 4（服务器常量和消息接线由 Claude 完成）。新字段、恢复边界、重录状态、暂定值与 PR 描述见 [v15 交接](../../LOOT_ORB_CLAIM_V15.md)。本段覆盖下文旧版线上自动发英雄/满席重试口径，旧版单机记录保留。

基线：`multiplayer@38747c595b7f4900133ca6e85c63b1bb48e83e2d`（含 OPENING-R1、SRC-MAP22、RESEARCH）；分支 `codex/g2-3-impl`。
用户决定：2026-10-16，含 13:46 补充及随后折金口径。**已基于 #134（19aa9f1）接入纯领域通用接口；服务器事实转发仍需配套，非联机上线声明。**

## 依据与重现

- **源数据**：`src/simulation/content/source/s13-14.24b/provenance/manifest.json` 的 `extendedSourceAcquisition`。两份提取脚本验证归档和解压字节长度/SHA256；`en_us.json` 解压 SHA256=`c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。
- **外部考证**：[EXTERNAL_SOURCES.md](EXTERNAL_SOURCES.md)、[external-sources.json](external-sources.json)（#127）。候选资料不升级为已证实脚本语义。
- **约定值**：本表明确列出的项目执行约定；用户允许缺少脚本时做有限近似。原始文本保留不代表全部脚本已复刻。
- `python3 docs/evidence/g2-3/extract-content.py --check` 验证六份提取产物；`extract-special-items.py` 生成奖励装备源表。`source-staging.json` 记录源产物字节证据。
- 新英雄与形态用 `tests/g2-3-content.test.ts` 直接读归档断言；独立商店名单为 `tests/fixtures/g2-3-roster.ts`，独立经济/随机 oracle 为 `tests/fixtures/m5/oracle.g2.cjs`。

## 内容准入

| 项目 | 分类 | 实现与边界 |
| --- | --- | --- |
| 新12位英雄 | 源数据 | Renata、Cassiopeia、Nunu、Renni、Smeech、Dr.Mundo、Elise、Silco、Sevika、Swain、Jayce、Gangplank；属性/技能三档系数提取到 `g2-3-units.ts`、`g2-3-abilities.ts` |
| 60位商店英雄 | 源数据 | 1–5费分别14/13/13/12/8；共享池每种30/25/18/10/9份，共1171份。四个远程形态和召唤物不可购买/升级/占共享卡池 |
| G23-FORM | 约定值 | 用户13:46：按开战初始站位，己方前两排近战、后两排远程，敌方按自身方向对称；整战固定，移动/恢复不换形；无换形动画，不开双形战士 |
| 形态两套属性与技能 | 源数据 | `FormSwapperStats`：血量、双抗、AD、AS、初始/最大法力；远程技能从四份英雄bin读取。Gangplank近战AD65按14.24b考证覆盖 |
| 远程射程/Forge生命 | 约定值 | 远程4格；Forge1000HP/0双抗、静止不攻击，死亡后Jayce施法满血复活，原格占用则按所属席位的行列顺序找首个空格，敌方镜像 |
| 26个非Teamup羁绊 | 源数据 | 原始26项完整保留；启用25项（排除FormSwapper），7个Teamup留待强化解锁。无纹章/6费英雄，本批不能自然达到的高档不伪造可达性 |
| Silco召唤物攻击36/55/100 | 外部考证 | 14.24b覆盖；四个伤害代理、每个5次，12秒内均分时点。省略可被攻击的召唤物实体，主人死亡取消剩余攻击（约定值） |
| 技能几何、时间粒度 | 约定值 | 六角线段/相邻1格近似原模型；Renni按50ms分摊、伤害/治疗余数完整守恒；不还原模型碰撞/飞行表现 |
| Smeech跃击 | 约定值 | 最少装备→距离→ID排序；瞬移到最近空相邻格，3刀；击杀后下一tick再跳，伤害每跳减30%，最多28次，任务完整序列化 |
| Swain近战 | 源数据 | 当前邻接敌人每秒伤害/治疗；唯一击杀/助攻收据延长持续时间 |
| 远程Elise | 约定值 | 最近四目标初始打击及邻接溅射，省略蜘蛛弹道与移动中碰撞 |
| 远程Gangplank | 约定值 | 最近目标桶爆炸及邻接衰减；省略攒蓝时预铺桶、跨桶连锁和显式桶实体 |

## 征服者永久进度与过渡奖励

| 项目 | 分类 | 规则 |
| --- | --- | --- |
| 启用范围 | 源数据 | map22阈值表仅15档，16–20档未启用；第10档650。超过1500继续累计，不开新箱 |
| 战斗层数 | 源数据 | 2/4/6/9档每次击杀或助攻1/3/6/20层；每个敌方英雄每战最多计一次，排除召唤物 |
| 属性成长 | 外部考证 | 每箱为当前羁绊基础AD/AP加成的5%，不是每箱额外5个百分点；整数定点计算 |
| 奖励选择 | 源数据 | 每档仅启用权重非零的Option1；其他选项只归档 |
| 光明转化 | 约定值 | 用户实战记忆与2026-10-16决定；源表只指向`TFT9_RadiantConversion_PlayerBuff`，未发现完整行为说明。开出时只转场上/备战席已穿戴普通成装；此后本局新合成成装自动转光明，库存已有成装/新赠送成装不额外转 |
| 延后物品折金 | 约定值 | G2-4B（用户2026-10-17确认）起只剩辅助装锻造器、指定辅助装（基克的先驱/钢铁烈阳之匣/能量圣杯）仍延后；删除延后物品，保留已实现奖励，Gold=max(原Gold,map22整档估值)。窃贼手套、成装锻造器、次级英雄复制器、金铲铲冠冕、神器锻造器按源发放，第4/8/9/10/12/14/15档恢复原奖励 |
| 金铲铲冠冕人口 | 源数据+用户定规则 | 源：每顶+MaxArmySizeIncrease(1)人口，unique=false。用户定（2026-10-17）：获得一顶冠冕，人口上限就永久+1，与冠冕装没装、装在场上还是备战席都无关；之后卖掉持冠单位、冠冕回背包、被磁吸移走或因任何方式不再持有，已获得的+1都不收回。计数取自奖励领取记录（不可撤销），不另存字段。本项目没有金铲铲组件，冠冕只能从征服者第12/15档获得。冠冕不进成装锻造器、重铸器、窃贼手套和光明转化池 |
| 冠冕胜利掉金 | 已实现：源数据+用户确认约定 | TFT_Item_ForceOfNature 源 PercentGoldChance=10，胜利每顶独立10%获得1金币；开战场上装备、阵亡仍算、PvE/PvP赢才算、直接到账、G23黑市之后随机流，详见 G24-CROWN-GOLD-01..05。 |
| 锻造器选项数 | 约定值 | 每个锻造器弹出4个不重复选项（用户2026-10-17）。神器锻造器自Set 11起4选1有外部依据（搜索摘录，页面未能打开）；成装锻造器的4选1为约定值。超时取第一项 |
| 次级英雄复制器 | 约定值 | 沿用G2-3自动复制（用户2026-10-17）：复制第一个已拥有且≤3费的候选（候选顺序由种子+原子ID派生），走同一卡池policy；无合格英雄则托管，拥有后再发；不做玩家手动选目标。第4档先发三费英雄再结算复制器，同档三费英雄可被这次复制（审查建议） |
| 次级微光复制器 | 源目标范围＋既有自动领取约定 | 用户2026-10-17 15:20批准恢复黑市`TFT13_Crime_Consumable_LesserShimmerDuplicator`身份，14.24 zh_cn名“次级微光复制器”。目标须≤3费且带chem-baron羁绊，场上/备战席均可；首个已拥有合法候选、无目标/满席托管及卡池policy沿用小英雄复制器。100微光LootA25%/LootA4 10%、200微光LootB1 20%，每包1个，原权重不变。raw物品对象`map22.bin.json.gz:/{93f1e034}`；中文键`tft_item_name_tft13_crime_consumable_lessershimmerduplicator`。本分支不升版本，合并时取multiplayer当时版本+1；两种大复制器不准入。 |

下表原奖励与估值为**源数据**；含延后物品的过渡规则逐档标记，不能理解为源逐件价格。“当前奖励”列为G2-4B实现；10/12/14/15恢复，11/13的辅助装锻造器与指定辅助装仍延后。

| 档 | 阈值 | 整档估值 | 原Option1 | G2-3过渡期奖励 | 当前奖励 | 分类 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | 2 | `{"Gold":2}` | `{"Gold":2}` | `{"Gold":2}` | 源数据：原样保留 |
| 2 | 35 | 2 | `{"TwoStarUnit":["TwoCostUnit"]}` | `{"TwoStarUnit":["TwoCostUnit"]}` | `{"TwoStarUnit":["TwoCostUnit"]}` | 源数据：原样保留 |
| 3 | 65 | 3 | `{"FourCostUnit":1}` | `{"FourCostUnit":1}` | `{"FourCostUnit":1}` | 源数据：原样保留 |
| 4 | 100 | 4 | `{"Item":["TFT_Consumable_ChampionDuplicator_III"],"ThreeCostUnit":1}` | `{"ThreeCostUnit":1,"Gold":4}` | `{"Item":["TFT_Consumable_ChampionDuplicator_III"],"ThreeCostUnit":1}` | 源数据：G2-4a恢复原奖励（复制器自动复制为约定值） |
| 5 | 150 | 5 | `{"Item":["COMPONENT_NOSPAT","TFT_Consumable_ItemReroller"]}` | `{"Item":["COMPONENT_NOSPAT","TFT_Consumable_ItemReroller"]}` | `{"Item":["COMPONENT_NOSPAT","TFT_Consumable_ItemReroller"]}` | 源数据：原样保留 |
| 6 | 200 | 6 | `{"FourCostUnit":1,"FiveCostUnit":1}` | `{"FourCostUnit":1,"FiveCostUnit":1}` | `{"FourCostUnit":1,"FiveCostUnit":1}` | 源数据：原样保留 |
| 7 | 330 | 8 | `{"TwoStarUnit":["FiveCostUnit"]}` | `{"TwoStarUnit":["FiveCostUnit"]}` | `{"TwoStarUnit":["FiveCostUnit"]}` | 源数据：原样保留 |
| 8 | 440 | 9 | `{"Item":["TFT_Item_ThiefsGloves"]}` | `{"Gold":9}` | `{"Item":["TFT_Item_ThiefsGloves"]}` | 源数据：G2-4a恢复原奖励 |
| 9 | 550 | 12 | `{"MeepTypeUnit":["TFT_ArmoryKeyCompleted"]}` | `{"Gold":12}` | `{"MeepTypeUnit":["TFT_ArmoryKeyCompleted"]}` | 源数据：G2-4a恢复原奖励（4选1为约定值） |
| 10 | 650 | 14 | `{"MeepTypeUnit":["TFT_ArmoryKeyOrnn"]}` | `{"Gold":14}` | `{"MeepTypeUnit":["TFT_ArmoryKeyOrnn"]}` | 源奖励；G2-4B恢复神器锻造器，21件交集池为用户批准约定 |
| 11 | 750 | 15 | `{"MeepTypeUnit":["TFT_ArmoryKeySupport"]}` | `{"Gold":15}` | `{"Gold":15}` | 约定值：延后物品仍按整档估值折算（辅助装锻造器仍延后） |
| 12 | 850 | 20 | `{"Item":["TFT_Item_ForceOfNature"],"Gold":20}` | `{"Gold":20}` | `{"Item":["TFT_Item_ForceOfNature"],"Gold":20}` | 源数据：G2-4a恢复原奖励（冠冕人口规则见上） |
| 13 | 1000 | 50 | `{"Item":["TFT_Item_ZekesHerald","TFT_Item_LocketOfTheIronSolari","TFT_Item_Chalice","TFT_Consumable_ItemRemover"],"Gold":20}` | `{"Item":["TFT_Consumable_ItemRemover"],"Gold":50}` | `{"Item":["TFT_Consumable_ItemRemover"],"Gold":50}` | 约定值：延后物品仍按整档估值折算（指定辅助装仍延后） |
| 14 | 1200 | 60 | `{"ItemByKey":["RADIANTITEMS_SET5"],"Gold":50,"MeepTypeUnit":["TFT_ArmoryKeyOrnn"],"Item":["TFT_Consumable_ItemRemover"]}` | `{"ItemByKey":["RADIANTITEMS_SET5"],"Gold":60,"Item":["TFT_Consumable_ItemRemover"]}` | `{"ItemByKey":["RADIANTITEMS_SET5"],"Gold":50,"MeepTypeUnit":["TFT_ArmoryKeyOrnn"],"Item":["TFT_Consumable_ItemRemover"]}` | 源奖励；G2-4B恢复神器锻造器并撤销额外10过渡金 |
| 15 | 1500 | 200 | `{"Gold":80,"Item":["TFT_Item_ForceOfNature","TFT_Item_ForceOfNature"],"PlayerBuff":["TFT9_RadiantConversion_PlayerBuff"]}` | `{"Gold":200,"PlayerBuff":["TFT9_RadiantConversion_PlayerBuff"]}` | `{"Gold":80,"Item":["TFT_Item_ForceOfNature","TFT_Item_ForceOfNature"],"PlayerBuff":["TFT9_RadiantConversion_PlayerBuff"]}` | 源数据：G2-4a恢复原奖励（光明转化仍为约定值，冠冕不转光明） |

已有拆卸器、重铸器不属于本批延后范围，按源表保留；第5档无延后物品，不触发折金。

奖励金币在唯一战斗结算事务内通过通用收据发放；非金币奖励存于`seatMechanics.seat.conqueror.rewards`，自动发放或弹出forge，满席英雄托管。物品走grantMechanicItem、英雄走grantMechanicUnit及同事务policy，池空按合同折金；逐副本MechanicReceipt防重。G2-4a起第8档窃贼手套按普通`thiefs-gloves`入库，第9档成装锻造器从36件普通成装池抽4件弹出forge，第4档复制器按上面的约定自动复制。

## 学院、炼金男爵、机械公敌与试验格

| 项目 | 分类 | 规则与有限近似 |
| --- | --- | --- |
| 学院随机池 | 约定值 | #127只证实29组×3结构，未恢复历史图标ID/权重。`g2-3-academy.ts`明确列29组三件普通装备项目组合，均匀抽一组，有序三件无重复；不是历史29组映射 |
| 学院时点 | 约定值 | 首个成功准备命令达到3/4/5档时，按序发对应赞助品到库存；跳档补齐，唯一收据不重发；Jayce使5档可达 |
| 学院叠加 | 约定值 | 普通同ID永久穿戴复制品每件加b；学院成员为2*n*b+(n>0?5%:0)，额外5%只一次；光明、临时装备、纹章不视作同ID |
| 炼金男爵微光 | 源数据 | 每档标准对战/连败/PvE死亡增量取源表；三连败起使用连败值；每100层触发，最多800档 |
| 黑市权重 | 源数据 | map22八档BlackMarket的全部命名权重，按单词32位缩放；恢复/重复命令不重抽 |
| 黑市有限时点 | 约定值 | 一轮跨多个100断点时只保留最高档一次机会；有未决offer时不覆盖。拒绝保留微光并累计跳过；领取清零微光。跳过生命取当前活跃羁绊源`HealthPerSkip`×次数 |
| High Roller分布 | 外部考证 | 首层火箭/盾/金币/Triple=35/35/20/10，Triple条件蓝火/击飞/四咬/Jackpot=40/35/24.5/0.5；先抽基础三技能，再抽mod，仅Triple多一词 |
| High Roller通用数值 | 外部考证 | 80%减伤1.5秒、8×100物伤火箭、500盾4秒、3金币；金币在结算唯一收据发，不在tick重复发 |
| Sevika有限技能 | 约定值 | 火焰主目标真伤、邻接50%物伤，按源最短2秒离散脉冲，省略持续喷射到目标死亡的完整通道；拳为初击+邻接二击及眩晕，省略10格击退物理；咬为单击+眩晕，强化分支省略完整流血、处决、连咬；Jackpot按有限mod处理，不伪造历史宝箱概率，3金为项目约定 |
| Rumble军械库时点/费用 | 约定值 | 采用#127候选：在场每3个战斗回合，2个未购付费升级+Spare；付费5金、已购移出；全购后Finishing，三星下一次Titan；取得Titan后不再出现已包含的付费升级，只给免费Finishing。弹出可收起、超时自动选，通用选择接口交Claude；本批不做常驻商店 |
| Rumble升级 | 外部考证 | Spare3AP50HP、Finishing25AP300HP、Titan全升级+90%减伤；喷火30/45/600AP，修复6/6/25%HP，石化弹350/525/6000AP，tank120/180/1600AP；时点/目标离散规则见执行模块 |
| Rumble一/二星自爆 | 源数据 | 160%/240%（16000/24000Bps）：map22 `TFT13_JunkerKing_SelfDestructButton` 常量 `SelfDestruct_ResistDamage_Level1/2`=1.6/2.4（`raw/map22.bin.json.gz`，en_us.json 同值），攻略站同值；`tests/g2-3-source-pins.test.ts` 钉住。同一对象 `Level3`=20.0（2000%），与公告20000%不同，三星另按下一行用户决定 |
| Rumble三星自爆 | 外部考证 | 用户选Riot官方公告20000%，即2000000Bps；双抗合计×倍率；死亡包在最后单位判负前处理 |
| 升级绑定 | 约定值 | 最强Rumble按星级→ID，无装备比较；绑定实例，卖掉不转移。菜单独立seed混合不消费商店/选择RNG |
| 实验格布局 | 约定值 | 固定种子独立流seed xor 0x6c616273，从己方28格无放回选2格/5档3格，本局同种子稳定。仅站格成员共享站格供体，不给全队无条件共享 |
| Mundo实验值 | 源数据 | 120生命、唯一击杀+60；基底flat与当前生命按max delta同步，收据防重并参与恢复验证 |
| 其他实验供体 | 约定值 | Nunu3%自身HP魔伤1秒ICD、Urgot施法8%HP盾和20%AS5秒、Zyra额外50%真实伤害分2次/2秒；Twitch每5击20%目标HP（#127未冻结此数值，显式约定）。无Warwick/纹章，因此不开放其供体 |
| Sion解锁/成长 | 外部考证 | 黑玫瑰成员合计5次施法或Sion降至65%以下解锁；每星15%生命；4/5档阶段倍率按#127表 |
| 召唤物胜负/玩家伤害 | 约定值 | Forge和预留g23-barrel不维持阵营存活，Sion仍是战斗单位；所有战斗召唤物不增加玩家伤害，与双边原始资产名单口径一致。桶当前为技能伤害包，没有桶实体；预留id仅防止将来实体接入后错误撑局 |
| Sion/Forge实体 | 约定值 | Sion1000HP/100AD/40双抗/100法力；阶段映射2…6。技能300%AD线伤、175AP盾5秒、1.5秒晕；5档解锁满血、75AP盾3秒、1秒晕。召唤物在战斗入口经spawnCombatUnit投影，带不可售/不占人口标记及unitSpawned；Sion绑定变化有bindingChanged，Forge同实体复活用unitRevived；不创建准备期永久资产 |

## 30项异变

数值均归档GoopBuff对象；标题/描述取文本表，Cosmic Rhythm照旧排除。运行时保留源占位符，不用显示文本解析规则。`all-for-one`研究候选与实际文本标题`force-of-friendship`的ID对齐见下表。

| ID | 标题 | 源对象 | 分类 |
| --- | --- | --- | --- |
| `arcana-overwhelming` | 奥术浩荡 / Arcana Overwhelming | `TFT13_GoopBuff_ArcanaOverwhelming` / `{63474fba}` | 源数据 |
| `attack-expert` | 物理专家 / Attack Expert | `TFT13_GoopBuff_SharpenedMind` / `{d2290efa}` | 源数据 |
| `avalanche-of-armor` | 护甲山崩 / Avalanche of Armor | `TFT13_GoopBuff_AvalancheofArmor` / `{6360b322}` | 源数据 |
| `berserker-rage` | 狂战之怒 / Berserker Rage | `TFT13_GoopBuff_BerserkerRage` / `{bed1f92f}` | 源数据 |
| `bully` | 恃强凌弱 / Bully | `TFT13_GoopBuff_Bully` / `{b910fc7b}` | 源数据 |
| `bulwark` | 壁垒 / Bulwark | `TFT13_GoopBuff_Bulwark` / `{1ff92847}` | 源数据 |
| `comeback-story` | 翻盘故事 / Comeback Story | `TFT13_GoopBuff_ComebackStory` / `{c88fbc1e}` | 源数据 |
| `deep-roots` | 根深蒂固 / Deep Roots | `TFT13_GoopBuff_DeepRoots` / `{72825068}` | 源数据 |
| `defense-expert` | 防御专家 / Defense Expert | `TFT13_GoopBuff_HardenedMind` / `{22252ea4}` | 源数据 |
| `eagle-eye` | 鹰眼 / Eagle Eye | `TFT13_GoopBuff_EagleEye` / `{6f0d7c18}` | 源数据 |
| `energy-absorption` | 法强吸收 / Energy Absorption | `TFT13_GoopBuff_EnergyAbsorption` / `{632c4258}` | 源数据 |
| `force-of-friendship` | 友谊之力 / Force of Friendship | `TFT13_GoopBuff_AllForOne` / `{bdc62901}` | 源数据 |
| `fortified` | 坚不可破 / Fortified | `TFT13_GoopBuff_Fortified` / `{0ce70b6f}` | 源数据 |
| `freestyling` | 即兴发挥 / Freestyling | `TFT13_GoopBuff_Freestyling` / `{3aecae57}` | 源数据 |
| `giant-sized` | 巨人体型 / Giant-Sized | `TFT13_GoopBuff_GiantSized` / `{6d87cae9}` | 源数据 |
| `heavy-hitter` | 重量级打击手 / Heavy Hitter | `TFT13_GoopBuff_HeavyHitter` / `{f15c3e18}` | 源数据 |
| `hypervelocity` | 超高速 / Hypervelocity | `TFT13_GoopBuff_Hypervelocity` / `{c0c710f6}` | 源数据 |
| `kill-streak` | 连杀 / Kill Streak | `TFT13_GoopBuff_KillStreak` / `{ee8859af}` | 源数据 |
| `laser-eyes` | 镭射眼 / Laser Eyes | `TFT13_GoopBuff_LaserEyes` / `{92afad54}` | 源数据 |
| `legacy-of-shurima` | 恕瑞玛的传承 / Legacy Of Shurima | `TFT13_GoopBuff_LegacyOfShurima` / `{407feb18}` | 源数据 |
| `mage-armor` | 法师护甲 / Mage Armor | `TFT13_GoopBuff_MageArmor` / `{37bc263a}` | 源数据 |
| `magic-expert` | 魔法专家 / Magic Expert | `TFT13_GoopBuff_MagicMind` / `{cce07bcc}` | 源数据 |
| `magic-training` | 魔法训练 / Magic Training | `TFT13_GoopBuff_MagicTraining` / `{940bfd62}` | 源数据 |
| `one-thousand-cuts` | 千刀斩 / One Thousand Cuts | `TFT13_GoopBuff_OneThousandCuts` / `{a4626aa4}` | 源数据 |
| `power-absorption` | 攻击吸收 / Power Absorption | `TFT13_GoopBuff_PowerAbsorption` / `{5a58cd97}` | 源数据 |
| `protective-shielding` | 防御型护盾 / Protective Shielding | `TFT13_GoopBuff_ShouldertheBurden` / `{c5853a3c}` | 源数据 |
| `slime-time` | 史莱姆时间 / Slime Time | `TFT13_GoopBuff_SlimeTime` / `{69305384}` | 源数据 |
| `slow-cooker` | 慢炖 / Slow Cooker | `TFT13_GoopBuff_SlowCooker` / `{c348d5f3}` | 源数据 |
| `strength-training` | 力量训练 / Strength Training | `TFT13_GoopBuff_StrengthTraining` / `{e8542136}` | 源数据 |
| `titanic-strikes` | 泰坦打击 / Titanic Strikes | `TFT13_GoopBuff_TitanicStrikes` / `{12b5bb88}` | 源数据 |

| 跨补丁/近似 | 分类 | 处理 |
| --- | --- | --- |
| Power/Energy Absorption | 外部考证 | 14.24正文确认Power Absorption为9%AD且不再被其他百分比AD放大；Energy5%AP沿用源对象；原值仍保留；每个已死友军只吸收一次，账本记录实际定点值 |
| Strength Training及其余B差异 | 约定值 | #127的B公告无异变改动段；沿用map22参数，不把公告沉默视作完整正式池或零差异的证据 |
| 深根拉拽/激光/范围 | 约定值 | 深根瞬时拉入首个可攻击空格；激光用有限3格朝主目标线段；不复刻模型射线宽度 |
| Dominator/MagicTraining法力 | 约定值 | 当前执行器施法正好扣归一化maxMana，按该值编译AP成长；若将来引入可变耗蓝，必须改为cast receipt实际耗蓝 |

## 奖励装备

光明映射36种普通成装到源apiName；新奖励ID使用源apiName。基础属性/暴击/增伤、吸血、盾/保命、回蓝/击杀增伤、护甲穿透、灼烧/重伤、离子光环、连锁闪电、飓风、叠层、团队治疗等由声明式program实现，参数来自`en_us.items.effects`。
**约定值**：复用本项目已有普通装备的目标选择/伤害顺序/同类取强规则。未还原模型碰撞、客户端特效；光明窃贼手套的随机光明临时件机制属下批，不把它作为本批新掉落（光明随机奖励池从源36项中排除该项，剩35项等权，约定值）。原有普通窃贼手套规则保留。第15档仍将已穿戴普通窃贼手套转为光明id；该转换体占3槽，有限近似保留原TG-01普通临时件及equipment随机流/同轮收据，不升级为光明临时件。此处为约定值，待下一批替换，不能宣称完整光明手套机制。
黑市附带28个化工装备奖励身份，源基础属性及可表达的通用再生/叠层/盾已接入；专属化工脚本（毒雾、额外投射、递进回收等）是有限近似，完整被动未宣称复刻。G2-4B准入21件神器锻造器；冠冕已在G2-4a第12/15档恢复；辅助装锻造器与指定辅助装仍延后。

## 确定性、恢复、版本与证据

- 无真实时钟/网络/`Math.random()`；固定50ms tick，显式lcg32-v1。G23独立进度流seed xor 0x67323370，开局学院抽1词，黑市每个offer1词；奖励原子由种子+bundle/atom ID哈希派生独立LCG；实验格/军械库另用各自常量混合。
- 当前准备期军械库扣费已进入后续RoundResult的goldBefore/goldAfter；单人恢复仅追加结算后机制金币，不再次扣准备期军械库费。冻结mechanicReceiptPrefixLength区分经济结算前后收据；只追加前缀后gold、池空unit折金并减choice价款，见PR134_INTEGRATION。
- `seatMechanics.seat`持久化六键公开进度，hidden.progress保存种子、RNG与经济重演事实；学院/奖励领取凭通用MechanicReceipt派生，不持久化重复发奖收据。冻结战斗输入中的g23只是编译DTO，不是MatchState根权威。恢复从种子重演经济收据，并比对当前终局Combat事实；缺失G23进度、重复/篡改收据、非法领取副本均拒绝。恢复不发奖、不抽随机数。
- rules=`s13-g2-3-v2`，content=`s13-14.24b-g2-3-v2`；本次#136后收尾修正升至v2，schema7/save3/replay3不变。旧存档与旧回放输入按版本/digest拒绝，无迁移。
- G2-4a（征服者第4/8/9档恢复原奖励、锻造器4选1）再升至rules=`s13-g2-3-v3`、content=`s13-14.24b-g2-3-v3`，policy revision `g2-4a-v3`；v2存档与回放输入同样按版本/digest拒绝，G2-3夹具用原录制脚本重录。
- G2-4a冠冕（第12/15档恢复原奖励、获得冠冕永久+1人口）与#147神器合并后统一升至rules=`s13-g2-3-v5`、content=`s13-14.24b-g2-3-v5`，policy revision `g2-4a-v5`；v3/v4存档与回放输入按版本/digest拒绝。冠冕人口从已有的奖励领取记录推出，存档、开战输入和联机快照都不新增字段。
- `release-audit.json`与候选夹具已按19aa9f1接入后源码重录，包含源码摘要、旧新字节和恢复证据。历史opening-random夹具原字节保留；新增夹具不覆盖历史归档。全套`npm test`和`test:timing`尚未执行，仅最终head各一次。

开发验证见`development-validation.json`；`live-reveal-audit.json`从真实mage公共命令前缀重跑完整及单留英雄分支，通过公共部署交换Lux/Nami得到tick51双死亡(447/448)，单留Loris保留有掉落失败、单留Zyra并部署(0,4)得到tick152无掉落失败。包含旧/新测试源码字节长度、SHA及首差异位置；没有改造战斗状态来伪造死亡，尚未宣称旧全套通过。

## #134 接入与服务器交接

- 源数据：目录统一使用g2-3-item-registry超集；36个光明kind为radiant并带radiantOf；化工装有chem-baron限制。普通配方/重铸/轮盘池维持独立。
- 约定值：本席容器使用conqueror、academy、alchemist、junkerKing、experimentCells、radiantConversion；hidden不外泄。随机流与收据如上，恢复不发奖。
- 约定值：黑市TFT13_Crime_LootA4源奖励没有装备，grantItem:false只认证选择，再发源英雄包；不伪造装备。低费复制器有限自动复制首个已拥有且≤3费的源种子候选，通过同一卡池policy；无合格英雄则托管，省略玩家手动指定复制目标。其他多选用forge，拆卸器/重铸器用consumable通用收据。
- 外部考证：High Roller每次施法发castOutcome，结算按战斗聚合为唯一high-roller金币收据；箱子金币另用conqueror-chest来源，不重发。
- 约定值：Rumble仅弹出armory，普通Spare、全购Finishing、三星Titan都有0元timeoutOption；黑市支持@skip，choose/bot/timeout复用通用接口。
- 约定值：Forge/预留barrel不维持阵营，Sion维持阵营，所有召唤物不增加玩家伤害；移除ID永不重用。Gangplank桶仍为伤害包，未宣称可承伤桶实体。
- 服务器交接：src/server/room/room.ts的buildReceipt须转发proposal.g23Facts；接口/命令exports和界面消费由Claude适配。src/server/、src/rendering/、src/server-entry/本批未改，不能将领域测试通过描述成联机上线。

详见[PR134_INTEGRATION](PR134_INTEGRATION.md)和[发布说明](RELEASE_NOTES.md)。

## PR #149 辅助装合入当前 multiplayer

以 `65db5d2` 的13件辅助装效果和数值为准，merge `311017e`（含 #147 神器、#148 战术家之冠及 #158/#159/#160/#165）；复用主线的 `supportStage` 与 `holder-death`，不重复定义或触发。规则版本 `s13-g2-3-v6`，内容版本 `s13-14.24b-g2-3-v6`，policy revision `g2-4b-support-v6`；schema/save/replay 格式不变，content digest 为 `fnv1a32-utf16:e73164da`（见 `tests/g2-3-content-baseline.json`）。夹具按 release → herald → inputs → live-reveal 顺序重录。

### 冠冕胜利金币（用户确认约定，2026-10-17）

源证据：14.24 map22 `TFT_Item_ForceOfNature` 的 `PercentGoldChance=10`、`unique=false` 及 en_us 描述“10% chance to drop 1 gold when you win combat”。来源决定概率与金额；下列边界属于用户确认约定，不能冒称官方已明确。

| 编号 | 已确认并实现的边界 |
| --- | --- |
| G24-CROWN-GOLD-01 | 仅开战时场上单位装备的每顶冠冕参与；背包、备战席不算；开战资格冻结，持有者阵亡仍算。 |
| G24-CROWN-GOLD-02 | PvE及PvP胜利均触发；失败和平局不掷骰、不消耗冠冕随机数。 |
| G24-CROWN-GOLD-03 | 每顶独立掷骰，允许叠加；同一持有者的多顶冠冕也各掷一次。数量校验上限84只取自7×4部署格×3装备槽结构，非额外玩法上限；不使用无依据的30顶限制。 |
| G24-CROWN-GOLD-04 | 命中直接到账1金币，不生成拾取球；汇总收据 `g23:crown:<battleId>`，source=`tacticians-crown`，位于豪赌客/征服者箱金币之后。0命中保留经济收据的 `crownGold:0`，不生成0额资源收据。 |
| G24-CROWN-GOLD-05 | 使用G23进度既有lcg32-v1随机流，每顶恰好一次，排在本战黑市roll之后；相同输入确定复现。冠冕掷骰推进共享RNG，因此会改变后续黑市结果；本战已经完成的黑市掷骰不变。 |

规则/content为 `s13-g2-3-v7` / `s13-14.24b-g2-3-v7`，policy=`g2-4a-crown-gold-v7`；schema7/save3/replay3不变。v6及更早旧存档/输入按版本和digest拒绝，不补账迁移。内容digest由录制脚本计算，见 `tests/g2-3-content-baseline.json`。专项测试 `tests/g2-4a-crown-gold.test.ts` 包含真实grant/equip/战斗/文本和对象restore/Continue防重发，以及黑市顺序、伪造金额拒绝；各生成物旧新SHA、字节数和冻结源hash见 `crown-gold-recording-audit.json`。

合入 multiplayer `8c7f6ac`（含 #149 辅助装、#153 不稳定宝箱、#167 上界预检、#166 前序修复）后升为规则/content `s13-g2-3-v7` / `s13-14.24b-g2-3-v7`，policy=`g2-4a-crown-gold-v7`；schema7/save3/replay3 与资源来源版本号不变，存档格式变化（有序穿戴记录 `equipmentHistory`）由规则版本校验隔离：v6 及更早存档按 `unsupported-version` 拒绝，不做迁移（用户 12:06 旧存档政策）。release/herald/inputs/live-reveal 按顺序从脚本重录。

## G2-4B 神器锻造器合入 multiplayer v7

#161 基于 #147 开发（原 v5），合入 multiplayer `0cdd6eb`（v7，含 #149、#153、#157）后统一升为 rules/content `s13-g2-3-v8` / `s13-14.24b-g2-3-v8`，policy `g2-4b-artifact-forge-v8`；schema7/save3/replay3 不变，v7 及更早存档/输入按版本和 digest 拒绝，不迁移。第10档改发神器锻造器（0金），第14档恢复50金+光明装+神器锻造器+拆卸器；与冠冕第12/15档合并后全15档金币合计247。来源成长500Bps不变。release/herald/inputs/live-reveal 按顺序从脚本重录。详见[实施交付](../g2-4/G2-4B-ARTIFACT-FORGE.md)。

## PR #170：次级微光复制器 v9

从 `f0f1d99` merge multiplayer `d6156ab`，再 merge 最新 `0719ced`（#162，仅界面及其测试增量），保留 #161 的出生顺序/神器奖励校验与复制器出生时目标、冻结前缀校验。黑市次级微光复制器仅复制≤3费炼金男爵；征服者次级英雄复制器仍复制≤3费英雄，沿用已批准规则，不改数值。规则版本 `s13-g2-3-v9`，内容版本 `s13-14.24b-g2-3-v9`，policy revision `g2-3-lesser-shimmer-duplicator-v9`；schema7/save3/replay3 不变。按 release → herald → inputs → live-reveal 重录，当前 digest 见 `tests/g2-3-content-baseline.json`；旧 g2-augments Herald 原始夹具保持与 multiplayer 逐字节一致。

## PR #164：探索者护臂逐目标计层 v10（2026-10-18）

在已审查的 `f2b7c39`（合入 multiplayer `563a7f9`）上登记规则身份：rules/content 为 `s13-g2-3-v10` / `s13-14.24b-g2-3-v10`，policy revision 为 `g2-4b-bracer-multikill-v10`。仅登记此前用户批准并已实现的护臂规则：每个参与击杀目标各计一次；同一动作击杀多个不同目标逐目标计层，同一目标不重复；亲自击杀与助攻仍使用冻结源既有数值。来源与原文见 [BRACER-MULTIKILL-STACKS](BRACER-MULTIKILL-STACKS.md)。本轮没有再改触发机制或数值。

schema7/save3/replay3、command3 和 NET_PROTOCOL3 不变；v9 及更早规则身份由现有版本/digest 校验隔离，不迁移玩家存档。重录顺序为 release → 当前规则 Herald `--write` → inputs → live-reveal；当前内容摘要和逐文件实测见本轮发布验证报告。历史 `tests/fixtures/g2-augments-herald-raw/` 保持与所合 multiplayer 逐字节一致。

## G2-4b new mechanisms — WIP

Fishbones, Spectral Cutlass and Shroud are connected to registry/combat; eight
items remain source-pinned and unimplemented. No forge or Conqueror tier changes.
Source extraction and hashes: `normalized/g2-4b-mechanism-items.json`, reproduced
by `scripts/extract-g2-4b-mechanism-items.py`. The user confirmed no 14.24b change
for these artifacts/supports; use 14.24 map22 numbers and map-selected zh_cn names.

**G24-FISHBONES-TARGET-01 — 约定值，非官方证据，待用户确认：** 每次实际普攻从翻倍后有效射程内的存活、可选中敌人中按显式独立 RNG 抽一个；候选按 ID 排序。未攻击不抽样。多件鱼骨头暂按持有者只翻倍一次、每次攻击只抽一次处理。raw 未明确随机池半径和多件叠加；不能将此约定称为原版证据。

**G24-KERNEL-PENDING-01 — 尚未接入、未生效的约定候选：** 法力劫掠整数向上取整；延伤按每 tick 累计整数差分分摊、非致死溢出丢弃；格子等距按行再列。延伤与护盾/转移的结算顺序仍待补证。虚空生物阶段 HP/AD 未查实，不以 null HP / 0 AD 充作战斗属性。

Random state is disjoint from critical-hit RNG and validated on restore against
the frozen battle seed and actual attack counter; dropping or forging it rejects
restoration. Full digest fixture migration and final full-suite run remain pending.

**G24-CUTLASS-CELL-01 — 约定值，待确认：** 镜像翻转两轴；被占格改选最近空格，等距按行/列，多个携带者按ID依次预留；多件同名只传送/返回一次。死亡不返回。

**G24-SHROUD-BEAM-01 — 约定值，待确认：** 在两席棋盘合并后的初始位置按列差≤1认定三列光束；多个光束取最强，不叠乘；最大法力向上取整，首次施法后恢复。原档确认30%和全队60HP，未说明此六角光束几何。

补证：已取得 Riot 13.18 的虚空生物阶段 HP 表及 14.7 的阶段 AD/升星/双抗/攻速说明，见 [EXTERNAL_SOURCES](EXTERNAL_SOURCES.md#official-historical-follow-up-read-2026-10-17)。这些是对应历史补丁的真实值；截至 14.24 的中间变更链未核完，不能据此宣称目标版本的完整召唤属性已经确定。14.9 风衣与不稳定财宝箱的交互暗示复制装备，但未证明全部继承规则。新增考证暂未改变运行时数值。

### G2-4b Death’s Defiance WIP checkpoint

`TFT4_Item_OrnnDeathsDefiance`: archived 14.24 (authorized for 14.24b),
AD10%, armor30, AS25%, omnivamp25%, damage defer50% for4seconds.
Source pointers/hashes: normalized/g2-4b-mechanism-items.json.
`G24-DEFIANCE-ORDER-01` is explicitly a **约定值**, pending confirmation: shields
before defer, redirect before defer, integer payments over80ticks, nonlethal
clipped excess consumed, no proc on repayment. BaseHeal25 is not independently
interpreted as a flat heal. Concentrated source gaps and recommendations for
all11items: [G2-4B-MECHANISMS-WIP.md](G2-4B-MECHANISMS-WIP.md).
Voidspawn HP candidate from13.18 is superseded by official14.6 stage2–6 values
1000/1500/2000/2500/3000; preparation placement remains unresolved for this project.

### G2-4b Trickster’s Glass WIP

Original14.24: armor10/MR10/AS10%/crit15%, clone70%maxHealth/+10%maxMana,
no clone equipment, active traits. Provisional `G24-MIRROR-INHERIT-01` and
`G24-SUMMON-CELL-01` in provenance are **约定值**; see the centralized WIP
list for missing inheritance evidence and native-summon limitations.
Clone identity and resolved sources must exactly match the independently rebuilt
strategy; no self-authentication from candidate save declarations.

G2-4b item-gold settlement bridge is wired to the generic economy receipt ledger;
combat producers remain pending. Positive receipt amounts are1, never piggyback
on High Roller's multiple-of3 grant. Collector's archived14.24 description
specifically says executions have40% drop chance, not arbitrary kills.

Collector runtime now executes its own post-hit threshold check and supplies gold
receipts to settlement; G24-COLLECTOR-EXECUTE-01 is a **约定值**, not confirmed
original ordering. Source raw14.24 AD30%, crit30%, threshold12%, chance40%1gold.
Gold restore independently reconstructs combat outcomes from the validated frozen
input rather than authenticating a candidate's own opportunity list.

Gambler runtime uses normal `TFT7_Item_ShimmerscaleGamblersBlade`, raw14.24
AP10/AS45%,1%AS per gold capped30,5%1gold per actual attack. Frozen opening
bank plus own-side battle gold and post-attack update timing are **约定值**
G24-ITEM-GOLD-01. Hashed20/4 fields remain recorded but uninterpreted.

Mogul normal `TFT7_Item_ShimmerscaleMogulsMail`: raw14.24 health50, per-hit
health7/resists1/cap35, full1gold, interval8seconds. G24-MOGUL-STACK-01
contains **约定值** for shield-hit qualification, HP barrier and lethal35th hit.
No HR3gold value is used. Original source constants and runtime limitations are
listed in the centralized G2-4B-MECHANISMS-WIP.md.

Zephyr `TFT_Item_Zephyr`: archived14.24 description and constants establish
5seconds,150HP,team2%AS and ignoring CC immunity. G24-ZEPHYR-ABSENCE-01
is a **约定值** for opening priority, distinct target reservation, missed pulse
policy and return collisions; these are not attributed to original scripts.
Banishment excludes units from active combat processing but preserves living
roster membership. Saves require exact reconstruction from validated frozen
inputs; this replaces clock-based structural checks only for Zephyr combats.

Voidspawn now has a preparation projection and movement API, matching the14.6
change from taunting combat spawn to movable preparation summon.14.8 establishes
cross-round placement persistence. HP uses the14.6 stage2..6 table; AD/star rows
use14.7. Sources: official
https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-6-notes/
and https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-7-notes/ .
The30-page follow-up ledger supports carry-forward as an **inference**, not a
recovered original script. G24-VOIDSPAWN-STAGES-01 records **约定值** for clamping,
total-stat interpretation and collision handling. Raw14.24 AS.75/armor30/MR30
and portal150HP apply directly; SummonedStatReduction25 has no confirmed meaning.

2026-10-17 user approval supersedes pending convention statuses in overrides.
Mirror HP specifically follows14.24 max Health wording: actual owner opening
maximum*70%, floor, including items/augments/anomaly/growth. Other inherited
attributes and counter exclusions are **约定值（用户 10-17 批准）**. Runtime
no longer computes Mirror HP from the naked clone. Voidspawn preparation movement
is required, not replaced by the superseded automatic-only placement proposal.
The chest is assigned to Claude's separate PR and remains outside this scope.
