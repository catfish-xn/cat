# M9 S13 英雄与羁绊数据台账

状态：**数据整理完成，历史证据缺口保留；未冻结为可运行目录。** 本分支仅新增本文，不修改游戏代码、内容版本、digest、规则、测试、CI或部署。英文身份和描述来自已归档原件；未取得同版本中文原件，不把临时译名当官方名称。

## 1. 基线、证据与范围

| 项 | 记录 |
| --- | --- |
| 分支 | `data/m9-champions`；从新克隆的最新 `origin/main` 创建；不合并 |
| main基线 | `5aff440c702e7c8c665f05f0b419a9edbf9ea00f` |
| B1来源分支 | `feat/m8-b0-baseline` @ `877c59b2babc4c6abfccc62452075f3b0cbbd688` |
| 归档路径 | `src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`（在上述B1提交；main未包含此文件，本文不把整个B1分支合入） |
| 上游固定地址 | [CommunityDragon 14.24 en_us.json](https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json) |
| 原件 | 12,061,650 bytes；SHA-256 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3` |
| gzip | 964,673 bytes；SHA-256 `7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2` |
| 取得时间 | 沿用B1 manifest：用户原下载时间 unknown；接收UTC 2026-10-07T02:50:39Z，归档UTC 02:52:29.147883。本文离线解压核验，不冒充新下载。 |
| 裁决政策 | B1 `provenance/source-policy.json` 与B1版 `M8_PLAN.md` §2.1.1；当前main的计划尚未含B1补充，本文明确沿用用户指定B1规则。 |
| 补丁证据 | [Riot 14.24（含12/10 A、12/11、12/17 B更新）](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)；[Riot 14.23](https://teamfighttactics.leagueoflegends.com/en-gb/news/game-updates/teamfight-tactics-patch-14-23-notes/)；2026-10-07核对 |
| 实现对照 | main的 `units.ts`、`content/abilities.ts`、`content/traits.ts`、`source-manifest.ts`、`combat-s13*.ts`、`strategy-snapshot.ts`、`s13-rules.ts` |

### 1.1 选择器的实际边界

B1唯一 `setData[mutator=="TFTSet13"]` 位于 `/setData/1`：84条单位记录中，60条为 `TFT13_*`、费用1–5且有羁绊的英雄；其余24条为野怪、召唤物、道具等，不进入英雄数。不能仅按 `cost==1` 选英雄。

14.24官方新增Viktor、Mel、Warwick三名6费，基础mutator没有这些记录。为交付历史标准模式全部英雄，本文**在保持60条基础记录的同时，显式补充**同一字节档案 `/setData/8`、`mutator=="TFTSet13_Evolved"` 的三条新增记录与三条专属羁绊；共有84条单位、33条羁绊已逐对象比较完全一致。补充来源的标准玩法身份由上述官方6-COSTS段支持；它不是TURBO、PAIRS、PVEMODE或MacaoMode。**这是文档取证补充，不是暗改B1导入器选择器**；后续导入器扩展见Q01。

英雄：**63 = 60 + 3**；费用1/2/3/4/5/6分布 **14/13/13/12/8/3**；已实现19，新增44。羁绊：**29个常规/专属羁绊 + 8个强化解锁关系羁绊 = 37条**；已有5个的有限档位，24个常规/专属羁绊及8个解锁关系未实现。`TFT13_RammusTrait` 单独列入排除/待确认附录，不当成第38个已上线羁绊。Hero强化技能分支保留原数值证据，不算额外英雄，不因收录而授权实现强化。

### 1.2 裁决、单位与读法

- 数值优先级：**14.24 B（2024-12-17） > 14.24补丁（含12/10更正） > 14.24客户端 variables/effects > 14.23补丁**。先对齐单位和范围；已包含不二次叠加。描述定语义，variables/effects定数字；缺失的执行语义列unknown，不用0填补。
- 每英雄原记录块保留身份、费用、全羁绊、所有基础属性和完整 `ability.name/desc/variables`（含null、七槽浮点原值）；字段数值采用表在§2。原描述中的 `@...@` 和 `{{...}}` 保留，不能把未解析宏写成已求值公式。
- 英雄技能七槽原数组的1/2/3索引为1/2/3星；4星保留原索引4供后续研究，Singed的B更新明确覆盖4星。0/5/6槽只归档，不能当普通1星或自动外推。羁绊effects按minUnits/maxUnits解释，25000是开放上界标记；Emissary只有恰好1或4，不可用“>=1最高档”算法激活2/3个。
- 审阅值 `N(x)` 为十进制四位、ROUND_HALF_UP；明确比例×10000→Bps，百分数点×100→Bps，秒×20→50ms tick。例如Singed AttackSpeed=100是100百分数点→10000Bps，Sniper=18是1800Bps/hex，Camille AD系数2.3是23000Bps，DR=.55是5500Bps。AP点数/HP/AD/格数/次数不乘10000。单位不能仅按字段名字含Percent猜测；`TOOLTIPONLY`、hash键和未解释宏不作运行换算。
- 例：Caitlyn raw AD系数1.7999999523162842→N=1.8→18000Bps；AS .550000011920929→5500Bps；50ms攻速间隔ceil(20/.55)=37tick是项目离散化，不冒充源档整数。HP/AD升星1/1.8/3.24为main既有项目规则，本文基础stats是一星原记录，不扩充4星基础属性。
- HERO/Hero字段：强化分支，默认不激活；Experiment字段：实验条件分支，不能像旧slice一样永久丢弃；Hyperroll/_HR、DU和PVE字段：其他模式，只保留不采用；null不等于0；哈希键及没有描述引用的字段：保留、待确认其活跃性/语义。本文不新批准任何项目约定。

## 2. 补丁字段核对与14.24b采纳值

原记录块始终未修改。下表按14.24→12/10 A更正→12/17 B排列；同一字段多行以最后适用阶段为最终值。客户端列每行始终是实际档案原值的N显示，完整浮点见各原记录。`覆盖`仅表示该阶段目标与原档不同，不表示每个历史中间目标都要重新写入：先确定最高优先级最终值，再比较原档。`已包含`意味着保持，不再次应用delta。例如Automata原件已经含12/10更正，不先回写14.24原公告70/150再改回60/140。英雄ability列默认为1/2/3星，Singed注明1–4星，Jinx只改索引3。trait括号为minUnits，单位随原字段/描述；AD/AP比率与点数不得混算。

| 公告阶段 | apiName / 字段 | 星级/档位 | 客户端原值 N | 该阶段目标值 | 与原档对照 |
| --- | --- | --- | --- | --- | --- |
| 14.24 | `TFT13_Morgana` / `ability.Damage` | [1,2,3] | [525,780,1300] | [525,780,1300]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Trundle` / `ability.GainHealth` | [1,2,3] | [200,220,250] | [200,220,250]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Zyra` / `ability.AOEDamage` | [1,2,3] | [95,140,215] | [95,140,215]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Camille` / `ability.HealPercent` | [1,2,3] | [0.33,0.33,0.33] | [0.3,0.3,0.3]；伤害转治疗比例；×10000→Bps | 覆盖 |
| 14.24 | `TFT13_Camille` / `ability.PercentAttackDamage` | [1,2,3] | [2.3,2.3,2.6] | [2.3,2.3,2.5]；AD系数；比例×10000→Bps | 覆盖 |
| 14.24 | `TFT13_Camille` / `ability.APDamage` | [1,2,3] | [30,45,70] | [30,45,70]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_RenataGlasc` / `ability.TargetDamage` | [1,2,3] | [310,465,700] | [310,465,700]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Ziggs` / `ability.Damage` | [1,2,3] | [180,270,450] | [180,270,450]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Ziggs` / `ability.MinibombDamage` | [1,2,3] | [90,135,200] | [90,135,200]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Blitzcrank` / `ability.Shield` | [1,2,3] | [470,500,550] | [470,500,550]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Gangplank` / `ability.PercentAttackDamage` | [1,2,3] | [3.4,3.4,3.4] | [3.4,3.4,3.4]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Beardy` / `ability.Shield` | [1,2,3] | [525,600,700] | [525,600,700]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_FlyGuy` / `ability.Damage` | [1,2,3] | [80,120,180] | [80,120,180]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_FlyGuy` / `ability.Heal` | [1,2,3] | [220,240,270] | [220,240,270]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_TwistedFate` / `ability.YellowDamage` | [1,2,3] | [230,345,535] | [230,345,535]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_TwistedFate` / `ability.BlueHeal` | [1,2,3] | [90,110,140] | [90,110,140]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Ambessa` / `ability.SlamDamageAD` | [1,2,3] | [5,5,12] | [5,5,12]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Heimerdinger` / `ability.Damage` | [1,2,3] | [50,75,225] | [50,75,225]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Vi` / `ability.Shield` | [1,2,3] | [280,325,1200] | [280,325,1200]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Vi` / `ability.PercentAttackDamage` | [1,2,3] | [6,6,12] | [6,6,12]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Vi` / `ability.PercentAttackDamage_SecondaryDamage` | [1,2,3] | [1.8,1.8,5] | [1.8,1.8,5]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Caitlyn` / `ability.PercentAttackDamage` | [1,2,3] | [1.8,1.8,7.5] | [1.8,1.8,7.5]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Jayce` / `ability.PercentAttackDamage` | [1,2,3] | [5,5,20] | [5,5,20]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_Malzahar` / `ability.InfectionDamage` | [1,2,3] | [14,21,400] | [14,21,400]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Blue` / `ability.Damage` | [1,2,3] | [350,500,700] | [350,500,700]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Vex` / `ability.Damage` | [1,2,3] | [220,330,550] | [220,330,550]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Akali` / `ability.SecondaryDamage` | [1,2,3] | [240,360,550] | [240,360,550]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Zeri` / `ability.PercentAttackDamage` | [1,2,3] | [2,2,2] | [2,2,2]；AD系数；比例×10000→Bps | 已包含 |
| 14.24 | `TFT13_KogMaw` / `ability.DamageOnAttack` | [1,2,3] | [48,72,120] | [48,72,120]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Swain` / `ability.Heal` | [1,2,3] | [240,300,380] | [240,300,380]；HP或护盾系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Swain` / `ability.HealPerSecond` | [1,2,3] | [70,90,125] | [70,90,125]；AP伤害系数；按desc AP/100 | 已包含 |
| 14.24 | `TFT13_Jinx` / `ability.ZapPercentAD` | [3] | [20] | [20]；AD系数 | 已包含 |
| 14.24 | `TFT13_Jinx` / `ability.FlameChompersPercentAD` | [3] | [20] | [20]；AD系数 | 已包含 |
| 14.24 | `TFT13_Nocturne` / `stats.attackSpeed` | 基础一星 | 0.8 | 0.8；攻击/秒 | 已包含 |
| 14.24 | `TFT13_Tristana` / `stats.attackSpeed` | 基础一星 | 0.75 | 0.75；攻击/秒 | 已包含 |
| 14.24 | `TFT13_Beardy` / `stats.mana` | 基础一星 | 90 | 90；最大法力 | 已包含 |
| 14.24 | `TFT13_FlyGuy` / `stats.mana` | 基础一星 | 170 | 170；最大法力 | 已包含 |
| 14.24 | `TFT13_Ambessa` / `stats.mana` | 基础一星 | 90 | 90；最大法力 | 已包含 |
| 14.24 | `TFT13_Caitlyn` / `stats.damage` | 基础一星 | 82 | 82；一星AD | 已包含 |
| 14.24 | `TFT13_Malzahar` / `stats.mana` | 基础一星 | 95 | 95；最大法力 | 已包含 |
| 14.24 | `TFT13_Gremlin` / `stats.damage` | 基础一星 | 70 | 70；一星AD | 已包含 |
| 14.24 | `TFT13_Corki` / `stats.damage` | 基础一星 | 65 | 65；一星AD | 已包含 |
| 14.24 | `TFT13_Rumble` / `ability.Flamethrower_Damage_Level1` | [1,2,3] | [30,30,30] | [30,30,30]；升级Level字段；非英雄星级 | 已包含 |
| 14.24 | `TFT13_Rumble` / `ability.Flamethrower_Damage_Level2` | [1,2,3] | [45,45,45] | [45,45,45]；升级Level字段；非英雄星级 | 已包含 |
| 14.24 | `TFT13_Rumble` / `ability.Flamethrower_Damage_Level3` | [1,2,3] | [600,600,600] | [600,600,600]；升级Level字段；非英雄星级 | 已包含 |
| 14.24 | `TFT13_Rumble` / `ability.SelfDestruct_ResistDamage_Level1` | [1,2,3] | [1.6,1.6,1.6] | [1.6,1.6,1.6]；升级Level字段；非英雄星级 | 已包含 |
| 14.24 | `TFT13_Rumble` / `ability.SelfDestruct_ResistDamage_Level2` | [1,2,3] | [2.4,2.4,2.4] | [2.4,2.4,2.4]；升级Level字段；非英雄星级 | 已包含 |
| 14.24 | `TFT13_Academy` / `effects.variables.PercentIncreaseSponsored` | [3,4,5,6] | [0.02,0.03,0.05,0.09] | [0.02,0.03,0.05,0.09]；最大HP/增伤比例 | 已包含 |
| 14.24 | `TFT13_Ambusher` / `effects.variables.CritDamage` | [2,3,4,5] | [0.1,0.2,0.25,0.25] | [0.1,0.2,0.25,0.25]；额外暴击倍率比例 | 已包含 |
| 14.24 | `TFT13_Ambusher` / `effects.variables.CritChance` | [2,3,4,5] | [0.25,0.35,0.45,0.55] | [0.25,0.35,0.45,0.55]；额外暴击概率比例 | 已包含 |
| 14.24 | `TFT13_Martialist` / `effects.variables.AD` | [2,4,6] | [0.1,0.45,0.6] | [0.1,0.45,0.6]；额外AD比例 | 已包含 |
| 14.24 | `TFT13_Hextech` / `effects.variables.Resists` | [2,4,6] | [25,60,140] | [25,70,150]；双抗点数 | 覆盖 |
| 14.24 | `TFT13_Hextech` / `effects.variables.MagicDamage` | [2,4,6] | [150,400,1100] | [150,450,1200]；固定魔法伤害 | 覆盖 |
| 14.24 | `TFT13_Crime` / `effects.variables.HealthPerSkip` | [3,4,5,6,7] | [20,60,110,160,220] | [20,60,110,160,220]；HP/跳过黑市 | 已包含 |
| 14.24 | `TFT13_Crime` / `effects.variables.ShimmerPerCombatStreaking` | [3,4,5,6,7] | [35,45,55,70,100] | [35,45,55,70,100]；Shimmer/连败战斗 | 已包含 |
| 14.24 | `TFT13_Warband` / `effects.variables.ADAPBase` | [2,4,6,9] | [0.18,0.25,0.4,1] | [0.18,0.25,0.4,1]；AD比例/AP显示比率 | 已包含 |
| 14.24 | `TFT13_Sorcerer` / `effects.variables.BaseAP` | [2,4,6,8] | [20,50,95,110] | [20,50,95,110]；AP点数 | 已包含 |
| 14.24 | `TFT13_Ambassador` / `effects.variables.GarenHealthPercent` | [1,4] | [0.12,0.12] | [0.12,0.12]；最大HP比例 | 已包含 |
| 14.24 | `TFT13_Pugilist` / `effects.variables.HealPercent` | [8] | [0.8] | [0.8]；最大HP比例 | 已包含 |
| 14.24 | `TFT13_Pugilist` / `effects.variables.TrueDamagePercent` | [8] | [0.4] | [0.4]；比例 | 已包含 |
| 14.24 | `TFT13_Rebel` / `effects.variables.PercentHealthTrigger` | [3,5,7,10] | [0.25,0.25,0.25,0.25] | [0.25,0.25,0.25,0.25]；队伍生命损失比例 | 已包含 |
| 14.24 | `TFT13_Rebel` / `effects.variables.ForceDuration` | [10] | [12] | [12]；秒 | 已包含 |
| 14.24 | `TFT13_Experiment` / `effects.variables.MaxHealth` | [7] | [300] | [300]；HP | 已包含 |
| 14.24 | `TFT13_Teamup_Geniuses` / `effects.variables.ReducedHeimerDamage` | [2] | [1.2] | [1.2]；强化解锁；比例 | 已包含 |
| A-12/10 | `TFT13_Warwick` / `stats.damage` | 基础一星 | 110 | 110；AD | 已包含 |
| A-12/10 | `TFT13_Hextech` / `effects.variables.Resists` | [2,4,6] | [25,60,140] | [25,60,140]；双抗点数 | 已包含 |
| A-12/10 | `TFT13_Hextech` / `effects.variables.MagicDamage` | [2,4,6] | [150,400,1100] | [150,400,1100]；固定魔法伤害 | 已包含 |
| A-12/10 | `TFT13_BloodHunter` / `effects.variables.EnemyHealthPercentThreshold` | [1] | [0.15] | [0.15]；严格低于该HP比例 | 已包含 |
| B-12/17 | `TFT13_Singed` / `ability.DR` | [1,2,3,4] | [0.5,0.5,0.6,0.7] | [0.5,0.5,0.55,0.6]；比例 | 覆盖 |
| B-12/17 | `TFT13_Red` / `stats.damage` | 基础一星 | 50 | 46；AD | 覆盖 |
| B-12/17 | `TFT13_Camille` / `stats.damage` | 基础一星 | 50 | 52；AD | 覆盖 |
| B-12/17 | `TFT13_Nocturne` / `stats.damage` | 基础一星 | 65 | 63；AD | 覆盖 |
| B-12/17 | `TFT13_Zeri` / `stats.damage` | 基础一星 | 45 | 48；AD | 覆盖 |
| B-12/17 | `TFT13_Beardy` / `stats.initialMana` | 基础一星 | 50 | 40；法力 | 覆盖 |
| B-12/17 | `TFT13_Beardy` / `stats.mana` | 基础一星 | 90 | 80；法力 | 覆盖 |
| B-12/17 | `TFT13_Ekko` / `ability.TargetDamage` | [1,2,3] | [290,435,1200] | [300,450,1200]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Ekko` / `ability.SecondaryDamage` | [1,2,3] | [145,215,450] | [150,225,450]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Silco` / `ability.MinionDamage` | [1,2,3] | [38,57,100] | [36,55,100]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Malzahar` / `ability.InfectionDamage` | [1,2,3] | [14,21,400] | [15,22,400]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Viktor` / `ability.LaserMagicDamage` | [1,2,3] | [70,175,2000] | [50,180,2000]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Viktor` / `ability.LaserTrueDamage` | [1,2,3] | [35,90,1000] | [25,90,1000]；固定真实伤害；desc未标AP | 覆盖 |
| B-12/17 | `TFT13_Viktor` / `ability.SpellDamage` | [1,2,3] | [120,300,9999] | [100,300,9999]；AP伤害系数；按desc AP/100 | 覆盖 |
| B-12/17 | `TFT13_Martialist` / `effects.variables.AD` | [6] | [0.6] | [0.7]；比例 | 覆盖 |
| B-12/17 | `TFT13_Warband` / `effects.variables.PercentIncreasePerChest` | [2,4,6,9] | [0.03,0.03,0.03,0.03] | [0.05,0.05,0.05,0.05]；比例 | 覆盖 |
| B-12/17 | `TFT13_Sniper` / `effects.variables.PercentDamageIncrease` | [2,4,6] | [7,16,35] | [7,18,36]；百分数点/hex | 覆盖 |
| B-12/17 | `TFT13_Sorcerer` / `effects.variables.BaseAP` | [2,4,6,8] | [20,50,95,110] | [20,50,95,125]；AP点数 | 覆盖 |
| B-12/17 | `TFT13_MachineHerald` / `effects.variables.startingmana` | [1] | [4] | [3]；Chaos Energy；最大8 | 覆盖 |

### 2.1 有公告、无安全字段映射的补丁项

| 对象 | 14.24最终证据与处理 | 待确认 |
| --- | --- | --- |
| Black Rose / Sion | 4档阶段HP系数0.9/1.25/2/2.7/3.5；5档1.0/1.4/2.1/3/3.65；7档复活75%HP；5档解锁后的效果按治疗缺失生命处理，受重伤。12/10五档：护盾AP系数0.75、持续3s、眩晕1s。 | Q06：trait hash键未证明对应上述字段；保留官方目标，不能覆盖猜中的hash键。Sion候选原件见附录。 |
| Sevika Jackpot | 14.24公告AD比例目标2.5；Sevika主desc的三条子技能仍为未展开宏。 | Q07：不能把Spell2/3_Bonus_*值4任意改为2.5；需实际子技能/Jackpot字段映射。 |
| Rumble 自毁升级3 | 公告20000%双抗=200倍，源SelfDestruct_ResistDamage_Level3为20。 | Q08：升级level/星级/内部额外乘数不明；前两级1.6/2.4和喷火30/45/600已匹配，最高自毁列conflict，不用20或200伪造已冻结答案。 |
| Gangplank 近战 | 14.24移除施法净化；B更新近战AD65。原stats AD50、armor0/MRnull/mana10是换形载体记录。 | Q02：近战AD65为已确定形态目标，不能覆盖全英雄共用stats并断言远程也65；不加入已移除净化。 |
| Enforcer(10) | 14.24没收排除非英雄和纹章；原desc概括所有敌方装备。 | Q09：数值依effects；执行资格依补丁；没收状态/归还时点仍需证据。 |
| Urgot实验加成 | 14.24实验位移为贴近目标；施法授予8%最大HP盾及20%AS，5s；不是仅开战/施法后才可贴近。 | Q04：普通技能与实验技能分开，移动策略仍需合同。 |
| Draven / Vander | 14.24明确斧头攻击能独立暴击；Vander强化击需要技能暴击授权。 | Q10：main按攻击通用暴击处理Vander，需要改资格；此文只记录差异。 |
| Viktor / Zeri | 12/17修复8 Visionary不能额外获得资源。 | Q11：通用回蓝管线须加资格；不能从Viktor载体mana100/initialMana0反推Chaos Energy。 |
| Chem-Baron contraband | 12/17多件非法装备数值也改变，但属于特殊装备记录，不是英雄或trait数值字段。 | Q12：不把非法装备的盾/AD/AP/复活字段拼进Chem-Baron自身effects；黑市实现需另建完整特殊装备账本。 |
| Family / Junker King | 14.24 Family5显示劫掠进度；Junker King改造的周期由源NumRounds1Star=3支持。 | Q12：显示tracker不提供完整奖励池、价格与跨轮执行数据。 |

未用14.23数值覆盖任何已存在的14.24字段。14.23仅用于定位旧改动/缺失证据线索；例如旧Elise后排改动并不能证明原件未归档的整个后排技能和属性最终无后续变更。

## 3. 与main已实现19英雄、5羁绊的差异

### 3.1 19英雄字段逐项比较

比较cost、HP/AD/armor/MR/range/initialMana/maxMana、N(AS)对应baseAttackSpeedBps、ceil(20/N(AS))间隔、现有每个技能变量三元组与最终采纳值。源普攻crit25%/倍率1.4与main全局2500Bps/14000Bps对齐；默认AP100是main现有全局规则，不是每英雄stats里的原始字段。没有把“已导入系数相同”称为整个技能已还原。

| 现有ID / apiName | 基础属性/费用 | 已导入1–3星系数 | 缺失羁绊 | 原档有、运行未导入的变量 |
| --- | --- | --- | --- | --- |
| darius / `TFT13_Darius` | 一致 | 一致（4字段） | Conqueror | 无 |
| irelia / `TFT13_Irelia` | 一致 | 一致（4字段） | Rebel | HERODashNum、HEROBaseDashDamage、HEROAttackSpeed、HEROSpellAPBase |
| lux / `TFT13_Lux` | 一致 | 一致（4字段） | Academy | 无 |
| maddie / `TFT13_Shooter` | 一致 | 一致（5字段） | Enforcer | 无 |
| zyra / `TFT13_Zyra` | 一致 | 一致（4字段） | Experiment | ExperimentTrueDamage、ExperimentDuration |
| leona / `TFT13_Leona` | 一致 | 一致（3字段） | Academy | 无 |
| vander / `TFT13_Prime` | 一致 | 一致（4字段） | Family | HEROSpellDuration、HEROBonusDamage、HEROSplashPerc、HEROStunDuration、HEROManaIncrease |
| rell / `TFT13_Rell` | 一致 | 一致（5字段） | Conqueror、Visionary | 无 |
| tristana / `TFT13_Tristana` | 一致 | 一致（3字段） | Emissary | ASKillGainHyperroll |
| urgot / `TFT13_Urgot` | 一致 | 一致（4字段） | Experiment、Pit Fighter | ExperimentPercentHealthShield、ExperimentAttackSpeed、ExperimentDuration |
| loris / `TFT13_Beardy` | 一致 | 一致（4字段） | Enforcer | 无 |
| ezreal / `TFT13_Ezreal` | 一致 | 一致（3字段） | Academy、Rebel | 无 |
| scar / `TFT13_FlyGuy` | 一致 | 一致（4字段） | Firelight | 无 |
| kogmaw / `TFT13_KogMaw` | 一致 | 一致（5字段） | Automata | 无 |
| nami / `TFT13_Nami` | 一致 | 一致（4字段） | Emissary | 无 |
| corki / `TFT13_Corki` | 一致 | 一致（7字段） | Scrap | 无 |
| garen / `TFT13_Garen` | 一致 | 一致（6字段） | Emissary | PassiveDamagePercent |
| zoe / `TFT13_Zoe` | 一致 | 一致（3字段） | Rebel | 无 |
| caitlyn / `TFT13_Caitlyn` | 一致 | 一致（8字段） | Enforcer | 无 |

结果：19/19基础属性及已导入三元组一致，字段数值差异0；19/19至少缺一项羁绊。Loris raw 50/90→B的40/80已在main落实。原档中的Hero强化变量、其他模式变量和null变量被排除是范围边界；实验变量被排除则会影响未来全羁绊，必须恢复为条件机制。

### 3.2 五个羁绊的档位与数值

| apiName / 现有ID | main已实现 | 14.24b台账目标 | 差异 |
| --- | --- | --- | --- |
| TFT13_Titan / sentinel | 2/4：全队12/25，成员额外24/50（合计36/75）双抗 | 2/4/6：全队12/25/42，成员合计36/75/126双抗 | 现有档一致；缺6档（成员额外84）；triple依desc，不把hash键2当成总倍率。 |
| TFT13_Martialist / artillerist | 2/4：AD10%/45%；每5攻击125%AD范围火箭 | 2/4/6：AD10%/45%/70%；5/5/4次，125%/125%/250%AD | 现有档一致；缺6档，B覆盖6档AD60%→70%。 |
| TFT13_Sniper / sniper | 只有2档：7%/hex | 2/4/6：7/18/36百分数点/hex；6档+5射程 | 2档一致；缺4/6档；B覆盖原16/35→18/36。 |
| TFT13_Watcher / watcher | 2/4：基础15/25%，当前HP>50%时30/45% | 2/4/6：基础15/25/35%，HP>50%时30/45/50% | 现有档一致；缺6档；严格>50%，不是>=。 |
| TFT13_Sorcerer / sorcerer | 2/4：全队AP10，成员额外10/40（合计20/50） | 2/4/6/8：成员总AP20/50/95/125，全队AP10；8档技能降目标伤害25%，3s | 现有档一致；缺6/8档及8档降伤；B覆盖8档110→125。 |

### 3.3 已实现技能语义与全量数据的边界

| 对象 | 已实现行为 / 限制 | 全量需求或待确认 | main依据 |
| --- | --- | --- | --- |
| 全部19 | 固定三元组、M5六角线/锥形、技能默认不暴击 | 补充1–4星政策、逐包暴击资格、全羁绊；不沿用No spell critical strikes当历史事实 | `content/source-manifest.ts`、`s13-rules.ts` |
| Irelia | 衰减盾；盾清零也提前执行ireliaEnd；邻格范围 | 原desc说到期攻击且“周围和前方”；破盾/到期与形状需明确项目约定，不能直接称历史一致 | `combat-s13.ts`、`combat-s13-abilities.ts` |
| Maddie | 6发固定偏移0/4/9/13/18/23tick、24tickchannel、最远目标和路径拦截 | 来源TotalSpellTime1.15s=23tick；固定6发时序为已有项目适配，需独立时序依据 | `combat-s13-abilities.ts` |
| Darius | 4次20tick流血，整数余数分配、同源同目标替换 | 基本系数一致；重施/叠加政策未由文案证实 | `combat-s13-abilities.ts` |
| Lux | 最低当前HP友军盾及下一攻击魔法包；没有DamageReduction效果 | DamageReduction在desc未引用，不能因字段存在新增减伤 | `combat-s13-abilities.ts` |
| Zyra | 主目标晕、两名最近敌人副伤 | 没有实验真伤；最近的参照点为实现约定，需明确 | `combat-s13-abilities.ts` |
| Tristana | 致命主包一次、额外HP过量才弹射；找到新敌人才+125Bps永久AD；次tick弹射不二次减伤 | 持续成长已实现，仍非完整官方过量/归因边界证据；ASKillGain名字不能当AS增长 | `combat-s13.ts`、`strategy-snapshot.ts` |
| Urgot | 爆炸+20%减甲6s | 没有实验位移/盾/AS条件分支 | `combat-s13-abilities.ts` |
| Rell | 线伤、双向偷抗60s | 系数已一致；重复施法与负抗/独立持续需核验 | `combat-s13-abilities.ts` |
| Leona | DR×AP后限100%，到期邻格伤害 | 常规系数一致；上限/重复覆盖为项目行为 | `combat-s13-abilities.ts` |
| Vander | 停止攻击2.5s、抗性、下一物理攻击；队友cost<=2计数 | 下一击沿攻击crit分支：与补丁需技能crit授权冲突；低费计数含自己/备战席政策未证实 | `combat-s13-abilities.ts`、`strategy-snapshot.ts` |
| Kog'Maw | 永久AS+25%，每3次cast加1射程、攻击魔法包 | MaxAS字段未形成技能专用cap证据；cap语义待确认，不能仅据20字段判20% | `combat-s13-abilities.ts` |
| Scar | 最近3目标晕/伤及自疗 | 没有Firelight周期位移/追踪治疗 | `combat-s13-abilities.ts` |
| Ezreal | 邻格群伤后中心另一个包 | 原desc的中心伤是追加还是总值以及包命中资格需源脚本；现有处理是项目口径 | `combat-s13-abilities.ts` |
| Loris | 邻格转伤；盾到期锥形被实现为离当前最近敌人1格范围；转移仅一次 | 转伤护盾耗尽资格、扇形、受击账本与源死后行为未完整证实 | `combat-s13.ts`、`combat-s13-abilities.ts` |
| Nami | 最多4命中、不重复单位、3格跳转 | NumBounces=3加初次命中；去重由实现选定，TimesHitTarget字段/文案不足以独立证明全部分支 | `combat-s13-abilities.ts` |
| Corki | 每tick一弹、邻域轮转分配、每7弹倍率7、固定偷甲；没有规则侧移 | source要求侧移；MissilesPerLaunchAttack=5被排除为运行节奏依据；固定分配为项目适配 | `combat-s13-abilities.ts` |
| Garen | 每个有效伤害action聚合后回HP（非每包）；HP/AP盾 | PassiveDamagePercent=null不填0；无Emissary最大HP共享 | `combat-s13.ts`、`content/source-manifest.ts` |
| Zoe | 主目标/最远副目标/返回主目标，多轮副目标去重 | 基本系数一致；目标死亡、射程与去重是执行边界 | `combat-s13-abilities.ts` |
| Caitlyn | 随机敌人作圆心，4/20发分配5s；心点头击、双抗削减60s | 源要求随机敌人簇，不是均匀抽单个敌人即可证明一致；前排偏好和BonusSearchRange单位待确认 | `combat-s13-abilities.ts` |

上述差异审计不修改既有游戏行为；此前批准的slice简化不自动等于M9全量实现获准继续简化。

## 4. 每个技能的通用机制需求

下面是人工对照desc/补丁的**实施需求分析**，不冒充客户端已经给出通用执行图。每个英雄一行，计入其被动、选中形态与条件实验加成；换形缺失后排技能仅注明依赖，不伪造后排数值。G08计主动施法接入（Viktor为专属资源接口）；G03计伤害包暴击资格审阅，不等于这些包默认能暴击；G05计周期/多发/延时，不把所有带持续时间的状态都算周期任务。G09计非单纯主动施法的攻击、命中、击杀、盾储能、施法计数等触发。G11没有已证实的原生技能消费者，位移和复活不冒充不可选中。G12没有普通技能直接生成临时装备的证据；Scrap/Academy/Enforcer属于羁绊需求，不计技能。

| 英雄 / apiName | 技能名 | G01–G12需求 | 超出G的机制 |
| --- | --- | --- | --- |
| Amumu / `TFT13_Amumu` | Obsolete Technology | G01, G02, G03, G05, G09, G10 | 无已识别扩展 |
| Powder / `TFT13_Blue` | Misfit Toy | G01, G02, G03, G04, G05, G08, G10 | 无已识别扩展 |
| Darius / `TFT13_Darius` | Decimate | G02, G03, G05, G06, G08, G10 | 无已识别扩展 |
| Draven / `TFT13_Draven` | Spinning Axes | G02, G03, G08, G09 | S09 |
| Steb / `TFT13_Fish` | Field Medicine | G02, G03, G06, G08, G09, G10 | S05 |
| Irelia / `TFT13_Irelia` | Defiant Dance | G02, G03, G05, G07, G08, G09, G10 | S05 |
| Lux / `TFT13_Lux` | Prismatic Barrier | G02, G03, G07, G08, G09, G10 | S09 |
| Morgana / `TFT13_Morgana` | Tormented Soul | G02, G03, G05, G07, G08, G10 | 无已识别扩展 |
| Violet / `TFT13_Red` | 1-2-3 Combo | G02, G03, G04, G05, G08 | 无已识别扩展 |
| Maddie / `TFT13_Shooter` | Fan the Hammer | G02, G03, G05, G08, G10 | 无已识别扩展 |
| Singed / `TFT13_Singed` | Dangerous Mutations | G01, G08, G09, G10 | 无已识别扩展 |
| Trundle / `TFT13_Trundle` | Desperate Chomp | G01, G02, G03, G06, G08 | 无已识别扩展 |
| Vex / `TFT13_Vex` | Looming Darkness | G02, G03, G05, G08, G10 | 无已识别扩展 |
| Zyra / `TFT13_Zyra` | Grasping Roots | G02, G03, G04, G05, G08, G10 | S11 |
| Akali / `TFT13_Akali` | Shuriken Flip | G01, G02, G03, G04, G05, G08 | S01 |
| Camille / `TFT13_Camille` | Adaptive Strike | G02, G03, G06, G08 | S07 |
| Leona / `TFT13_Leona` | Eclipse | G01, G02, G03, G05, G08, G10 | 无已识别扩展 |
| Nocturne / `TFT13_Nocturne` | Overdrive Blades | G02, G03, G05, G08, G09, G10 | 无已识别扩展 |
| Vander / `TFT13_Prime` | Hound of the Underground | G01, G02, G03, G05, G08, G09, G10 | S09 |
| Rell / `TFT13_Rell` | Shattering Strike | G01, G02, G03, G04, G07, G08, G10 | S05 |
| Renata Glasc / `TFT13_RenataGlasc` | Loyalty Program | G02, G03, G05, G07, G08, G10 | 无已识别扩展 |
| Sett / `TFT13_Sett` | Facebreaker | G01, G02, G03, G04, G08, G10 | S01 |
| Tristana / `TFT13_Tristana` | Draw a Bead | G01, G02, G03, G08, G09, G10 | S05, S06 |
| Urgot / `TFT13_Urgot` | Corrosive Charge | G01, G02, G03, G04, G07, G08, G09, G10 | S01, S11 |
| Vladimir / `TFT13_Vladimir` | Transfusion | G02, G03, G06, G08 | 无已识别扩展 |
| Zeri / `TFT13_Zeri` | Living Battery | G02, G03, G09, G10 | S09 |
| Ziggs / `TFT13_Ziggs` | Bomb Full of Bombs | G02, G03, G08, G10 | S04 |
| Loris / `TFT13_Beardy` | Piltover Bulwark | G02, G03, G05, G07, G08, G10 | S05 |
| Blitzcrank / `TFT13_Blitzcrank` | Static Field | G01, G02, G03, G05, G07, G08, G09, G10 | S05 |
| Cassiopeia / `TFT13_Cassiopeia` | Thorned Miasma | G02, G03, G08, G09, G10 | 无已识别扩展 |
| Renni / `TFT13_Chainsaw` | Sludgerunner's Smash | G02, G03, G04, G05, G06, G08, G10 | 无已识别扩展 |
| Ezreal / `TFT13_Ezreal` | Essence Flux | G02, G03, G08, G10 | 无已识别扩展 |
| Scar / `TFT13_FlyGuy` | Sumpsnipe Surprise | G02, G03, G04, G06, G08, G10 | 无已识别扩展 |
| Gangplank / `TFT13_Gangplank` | Harvest from Flames | G01, G02, G03, G06, G08, G10 | S03 |
| Smeech / `TFT13_Gremlin` | Scrap Hacker | G01, G02, G03, G05, G08, G09, G10 | S01 |
| Kog'Maw / `TFT13_KogMaw` | Upgrading Barrage Module | G01, G02, G03, G08, G09 | S09 |
| Nami / `TFT13_Nami` | Ocean's Ebb | G02, G03, G08, G10 | 无已识别扩展 |
| Nunu & Willump / `TFT13_NunuWillump` | ZOMBIE POWER!! | G01, G02, G03, G05, G08, G09, G10 | S11 |
| Swain / `TFT13_Swain` | Demonic Ascension | G02, G03, G05, G06, G08, G09, G10 | S03 |
| Twisted Fate / `TFT13_TwistedFate` | Wild Cards | G02, G03, G04, G06, G08, G10 | 无已识别扩展 |
| Ambessa / `TFT13_Ambessa` | Unrelenting Huntress | G01, G02, G03, G04, G06, G08, G09, G10 | S01, S09 |
| Corki / `TFT13_Corki` | Broadside Barrage | G01, G02, G03, G04, G05, G08, G09, G10 | S01 |
| Dr. Mundo / `TFT13_DrMundo` | Maximum Dosage | G01, G02, G03, G05, G06, G08, G09, G10 | S11 |
| Ekko / `TFT13_Ekko` | Splitting Seconds | G01, G02, G03, G04, G05, G08, G10 | 无已识别扩展 |
| Elise / `TFT13_Elise` | Cocoon | G02, G03, G04, G06, G08, G10 | S01, S02, S03 |
| Garen / `TFT13_Garen` | Demacian Justice | G02, G03, G06, G07, G08, G09, G10 | 无已识别扩展 |
| Heimerdinger / `TFT13_Heimerdinger` | PROGRESSSSS! | G02, G03, G08, G09, G10 | S04 |
| Illaoi / `TFT13_Illaoi` | Test of Spirit | G01, G02, G03, G05, G06, G08, G10 | S05 |
| Silco / `TFT13_Silco` | Canned Monstrosity | G02, G03, G05, G08, G10 | S02 |
| Twitch / `TFT13_Twitch` | Spray and Pray | G01, G02, G03, G05, G08, G09, G10 | S04, S09, S11 |
| Vi / `TFT13_Vi` | Wrecking Crew | G02, G03, G04, G07, G08, G10 | S01 |
| Zoe / `TFT13_Zoe` | Paddle Star! | G02, G03, G08, G10 | 无已识别扩展 |
| Caitlyn / `TFT13_Caitlyn` | Air Raid | G01, G02, G03, G04, G05, G08, G09, G10 | S04 |
| Jayce / `TFT13_Jayce` | Special Delivery | G02, G03, G04, G07, G08, G09, G10 | S01, S02, S03 |
| Jinx / `TFT13_Jinx` | Ruin Everything | G01, G02, G03, G04, G08, G09, G10 | S09 |
| LeBlanc / `TFT13_LeBlanc` | The Chains of Fate | G01, G02, G03, G05, G08, G09, G10 | S05, S09 |
| Sevika / `TFT13_Lieutenant` | Beat the Odds | G01, G02, G03, G04, G05, G07, G08, G09, G10 | S01, S04, S08, S12 |
| Malzahar / `TFT13_Malzahar` | Call of the Machine | G02, G03, G04, G05, G08, G09, G10 | S05 |
| Mordekaiser / `TFT13_Mordekaiser` | Grasp of the Iron Revenant | G01, G02, G03, G04, G06, G08, G09, G10 | S01, S09 |
| Rumble / `TFT13_Rumble` | The Equalizer | G01, G02, G03, G04, G05, G06, G08, G09, G10 | S12 |
| Mel / `TFT13_MissMage` | Conduit of Magic | G02, G03, G05, G07, G08, G09, G10 | S01, S05, S06, S13 |
| Viktor / `TFT13_Viktor` | Chaos Storm | G01, G02, G03, G04, G05, G08, G09, G10 | S09, S10 |
| Warwick / `TFT13_Warwick` | Blood Hunt | G01, G02, G03, G04, G05, G06, G08, G09, G10 | S01, S08, S11 |

### 4.1 覆盖统计（每技能对每机制最多计1次）

| 机制 | 63英雄技能需求数 | 60基础 / 3补充 | 说明 |
| --- | --- | --- | --- |
| G01 | 30 | 28 / 2 | 属性/条件修饰 |
| G02 | 62 | 59 / 3 | 物理/魔法/真实伤害包 |
| G03 | 62 | 59 / 3 | 逐包暴击资格 |
| G04 | 24 | 22 / 2 | 状态/削减/控制 |
| G05 | 34 | 31 / 3 | 周期/延时/多发 |
| G06 | 18 | 17 / 1 | 治疗/吸血 |
| G07 | 13 | 12 / 1 | 护盾/吸收/到期 |
| G08 | 61 | 58 / 3 | 施法/法力资格 |
| G09 | 34 | 31 / 3 | 有限触发/计数/ICD |
| G10 | 56 | 53 / 3 | 区域/多目标/位置 |
| G11 | 0 | 0 / 0 | 不可选中/仇恨/清除 |
| G12 | 0 | 0 / 0 | 临时装备授予/撤销 |

### 4.2 G01–G12以外的机制及消费者

| 编号 | 需要补的能力 | 技能消费者 | 边界/原因 |
| --- | --- | --- | --- |
| S01 | 规则位移／击退／拉拽 | Akali、Sett、Urgot、Smeech、Ambessa、Corki、Elise、Vi、Jayce、Sevika、Mordekaiser、Mel、Warwick | 移动路径、占格、碰撞、飞行和不可移动目标；G10只负责选目标，G11只负责仇恨。 |
| S02 | 召唤、可放置单位与复活 | Elise、Silco、Jayce | Silco怪物、Elise后排蜘蛛、Jayce工坊及Black Rose Sion；所有权、单位生命周期、死亡/复活资格不在G11内。 |
| S03 | 双形态目录与开战选择 | Gangplank、Swain、Elise、Jayce | Elise/Gangplank/Jayce/Swain按前后两排选形态，需双套属性/技能；G10可以选位置，不能变出缺失的形态数据。 |
| S04 | 技能或目标的确定性随机 | Ziggs、Heimerdinger、Twitch、Caitlyn、Sevika | Sevika技能/Jackpot/改造、Caitlyn炮击、Twitch穿透和Heimer/Ziggs随机目标；G12的装备抽样不能直接代表技能概率。 |
| S05 | 跨包数值累计、转移与链接 | Steb、Irelia、Rell、Tristana、Loris、Blitzcrank、Illaoi、LeBlanc、Malzahar、Mel | Irelia吸收量、Loris转伤、Mel护盾储能、LeBlanc链接真伤、Malzahar感染继承、Steb治疗共享、Rell双向偷抗、Tristana过量弹射和Illaoi汲取；需账本、快照和防递归。 |
| S06 | 跨战斗永久成长 | Tristana、Mel | Tristana永久AD、Mel永久增伤及强化解锁羁绊成长；G01只改属性，G09只提供触发，仍需Match持久化与升星/出售政策。 |
| S07 | 自适应伤害类型 | Camille | Camille按目标较低抵抗选择物理或魔法；不是看到trueDamage显示标签就判为真伤；同抗性裁决待证实。 |
| S08 | 处决与吞噬 | Sevika、Warwick | Warwick及Sevika分支的处决阈值、击杀归因、对复活/免死/免疫目标资格；G02可记击杀，不等于已实现处决。 |
| S09 | 替换攻击、技能轮转与动态射程 | Draven、Lux、Vander、Zeri、Kog'Maw、Ambessa、Twitch、Jinx、LeBlanc、Mordekaiser、Viktor | Draven斧头、Vander/Lux下一击、Zeri/Twitch/Mordekaiser/Viktor替换攻击、Jinx轮转、Ambessa姿态、Kog射程；需定义普攻/技能标签和消耗状态。 |
| S10 | 专属资源和全量属性转换 | Viktor | Viktor Chaos Energy 3/8、固定0.55攻速、额外AD/AS/Mana转AP；G08只留特殊资源接口，未承诺完整执行器。 |
| S11 | 实验格与共享实验加成 | Zyra、Urgot、Nunu & Willump、Dr. Mundo、Twitch、Warwick | Zyra/Urgot/Nunu/Mundo/Twitch/Warwick的实验增益有独立字段和开关；实验格生成、共享与七档倍增超出普通属性修饰。 |
| S12 | 跨轮奖励、装备改造与购买 | Sevika、Rumble | Rumble永久改造、Sevika金币、Family劫掠、Chem-Baron黑市、Conqueror战利品、Academy赞助和Enforcer没收；G12仅支持临时授予。 |
| S13 | 玩家淘汰拦截 | Mel | Mel累计PvP施法资格、一次性救命至1HP和永久增伤；必须在Match结算层，不能用战斗内G07护盾代替。 |

羁绊额外消费者：Black Rose→S02；Form Swapper→S03；High Roller→S04/S12；Firelight、Quickstriker→S01；Automata伤害累计→S05；Experiment→S11；Chem-Baron/Conqueror/Family/Junker King/Academy/Enforcer→S12；Machine Herald→S10；Banished Mage→S06/S13；Blood Hunter→S08；关系羁绊→跨英雄事件连动S05/S06/S09。Scrap临时合成和Enforcer没收/转授可复用G12的部分能力，但还需要S12装备来源与回滚政策。

## 5. 待确认项与证据边界

| ID | 待确认范围 | 已知证据 | 下一证据/建议 |
| --- | --- | --- | --- |
| Q01 | B1 selector与14.24标准模式全量范围 | 60+3身份/共有记录一致已核实；M8旧selector仍固定TFTSet13 | 建议后续批准显式TFTSet13_Evolved标准补充/迁移策略；本次不改导入器。Rammus无对应英雄/官方上线证据，排除。 |
| Q02 | 四名换形英雄完整属性与后排技能 | Elise/Gangplank/Jayce/Swain载体MR=null，stats有0抗性/10mana，仅一份技能 | 取得14.24客户端形态脚本/完整技能和属性表；近战GP AD65已确定，其他基础属性保持unknown，不能用0或另一个英雄代替。 |
| Q03 | desc动态宏与遗漏技能字段 | Modified*/TFTUnitProperty/TFTTrait宏；Sevika三个子技能宏 | 取得固定版本拼接/计算脚本；系数原值可以审阅，组合公式/内部单位尚不能全部冻结。 |
| Q04 | Experiment条件共享与加成 | 六位实验英雄的字段已保留；实验格/共享顺序与hash键不明 | 验证laboratory产生、共享、7档翻倍、获得/失去加成时点；不能沿用旧slice排除Experiment前缀。 |
| Q05 | 原件未描述或null/hash数值字段 | 例Garen PassiveDamagePercent、GP NumBarrels、Mel DashLogic_LineWidth、trait哈希变量 | null保留，未知不填0；逐字段取得执行引用/含义证据。未引用的数值不自动激活。 |
| Q06 | Sion成长、阶段系数、5档解锁与7档复活 | 公告值已归档，无法安全映射trait hash字段 | 取得Sion召唤参数脚本与14.24更正执行；不得将G11清仇恨视为复活。 |
| Q07 | Sevika随机分支/Jackpot | 子技能未展开、随机概率含hash键，公告AD2.5缺字段映射 | 取得三份子技能和随机表；不得凭hash值估计概率或把最高字段当Jackpot系数。 |
| Q08 | Rumble自毁最高级矛盾 | Level3 source20 vs 公告20000%=200倍；升级/星级口径待证实 | 保留conflict；取得改造计算公式；不沿用20也不盲改200。 |
| Q09 | Enforcer没收与Scrap/Academy装备 | 补丁排除纹章/非英雄；全物品池/归还逻辑缺失 | 另建特殊装备/暂授生命周期证据；G12本身不足以完成没收、改造、赞助。 |
| Q10 | 暴击资格、实际几何和技能时序 | Draven/Vander资格有官方区别；大部分技能具体包/路径/固定间隔不在desc | 逐包确定资格；固定50ms和M5几何作为项目约定供确认；治疗/盾不暴击。 |
| Q11 | Viktor资源和无主动技能英雄资格 | 载体0/100mana不等于能量；Banished Mage有HR/DU参数；Zeri/Amumu被动 | 使用Machine Herald能量3/8；转换比例、触发/回蓝排除、被动锁蓝以客户端执行证据验证。 |
| Q12 | 奖励/成长/玩家结算层 | Chem-Baron黑市、Family5、Conqueror箱、Rumble改造、Mel免淘汰 | 取得固定奖励表/价格/阈值/收据边界；是否纳入单人模式和适配政策需另行决定，不默认批准。 |
| Q13 | 四星与超范围强化字段 | 原七槽保留，Singed1–4星B更新明确；其余4星和Hero分支并非main19的能力 | 英雄批次明确星级支持与强化范围；数值证据与实现资格分开。 |
| Q14 | 递归、叠加、持续和同tick顺序 | Steb共享治疗、LeBlanc链接、Malzahar传播、Rell偷抗、Morgana削盾、转伤/过量弹射 | 补执行合同与独立例子；M8G09防递归不能替代具体来源/归因/存活政策。 |
| Q15 | 关系羁绊激活方式 | 8条Teamup在原件traits但不在英雄常规traits；对应Trait Unlock强化物品列入标准augments | 必须满足相应强化与伙伴条件，不能仅按两英雄上场激活；条目映射见§7。 |

共15个分组问题；它们不是15个孤立数值字段，Q02/Q03/Q05等含多个缺口。确定的公告覆盖已直接裁决，未要求用户重新批准B1数值优先级。本台账整理完成不等于全英雄来源签收、运行实现完成或历史执行语义已全面还原。

## 6. 全英雄原始记录（63条）

每条含JSON pointer、完整原记录SHA-256（含图标等未展示字段）、最终基础属性审阅值、原始技能和全部数值字段。记录块是从同一原件投影的未改字段；采用值按§2覆盖，未有对应公告的字段保持客户端N值。四名换形载体stats仅是原始对象，不当成已证实的形态属性。

### TFT13_Amumu — Amumu

来源：`/setData/1/champions/19`；完整记录SHA-256 `9d23ffa40de26925b551a0f8dc6153ed31074abf65127f855a2c95c9c35a489e`。费用1；main未实现。

羁绊身份：Automata → `TFT13_Hextech`；Watcher → `TFT13_Watcher`。

基础属性审阅值：`{"armor":35,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":45,"hp":600,"initialMana":0,"magicResist":35,"mana":0,"range":1}`。

```json
{
  "apiName": "TFT13_Amumu",
  "name": "Amumu",
  "cost": 1,
  "traits": ["Automata","Watcher"],
  "stats": {
    "armor": 35.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 600.0,
    "initialMana": 0,
    "magicResist": 35.0,
    "mana": 0.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> Reduce all incoming damage by <scaleLevel>@FlatDamageReduction@</scaleLevel>. Every second, emit sparks that deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent&nbsp;enemies.",
    "icon": "ASSETS/Characters/TFT13_Amumu/HUD/Icons2D/Amumu_W.TFT_Set13.tex",
    "name": "Obsolete Technology",
    "variables": [
      {
        "name": "FlatDamageReduction",
        "value": [7.0,12.0,15.0,25.0,35.0,10.0,10.0]
      },
      {
        "name": "Damage",
        "value": [20.0,10.0,15.0,25.0,35.0,0.0,0.0]
      },
      {
        "name": "DamageRefreshDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "FlatDRCooldownPerAttacker",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `FlatDamageReduction` | [12,15,25] | 其他模式；不采用 |
| `Damage` | [10,15,25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageRefreshDuration` | [1,1,1] | 其他模式；不采用 |
| `FlatDRCooldownPerAttacker` | [1,1,1] | 内部参数/活跃性或单位需证实；Q03/Q05 |

### TFT13_Blue — Powder

来源：`/setData/1/champions/44`；完整记录SHA-256 `2838df99a30bbc194e4a7aee00b747a10a233eb2a052a467f30047d2e8d5904a`。费用1；main未实现。

羁绊身份：Family → `TFT13_Family`；Scrap → `TFT13_Scrap`；Ambusher → `TFT13_Ambusher`。

基础属性审阅值：`{"armor":15,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":35,"hp":500,"initialMana":40,"magicResist":15,"mana":120,"range":4}`。

```json
{
  "apiName": "TFT13_Blue",
  "name": "Powder",
  "cost": 1,
  "traits": ["Family","Scrap","Ambusher"],
  "stats": {
    "armor": 15.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 35.0,
    "hp": 500.0,
    "initialMana": 40.0,
    "magicResist": 15.0,
    "mana": 120.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Send a monkey towards the largest group of enemies, causing a 2-hex radius explosion on impact. Enemies hit take <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage, reduced by @FalloffPercent*100@% for each hex they are away from the epicenter. <TFTKeyword>Wound</TFTKeyword> and 1% <TFTKeyword>Burn</TFTKeyword> applied for @IgniteDuration@&nbsp;seconds to all enemies hit.<br><br><rules>Burn: Deal a percent of the target's max Health as true damage every second<br>Wound: Reduce healing received by 33%<br></rules>",
    "icon": "ASSETS/Characters/TFT13_Blue/HUD/Icons2D/Blue_Spell.TFT_Set13.tex",
    "name": "Misfit Toy",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,350.0,500.0,700.0,900.0,0.0,0.0]
      },
      {
        "name": "IgniteDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "FalloffPercent",
        "value": [0.33000001311302185,0.30000001192092896,0.30000001192092896,0.25,0.25,0.33000001311302185,0.33000001311302185]
      },
      {
        "name": "HERODamage",
        "value": [240.0,350.0,500.0,700.0,900.0,240.0,240.0]
      },
      {
        "name": "HEROFalloffPercent",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "HEROFriendlyFire",
        "value": [0.6000000238418579,0.6000000238418579,0.6000000238418579,0.6000000238418579,0.6000000238418579,0.6000000238418579,0.6000000238418579]
      },
      {
        "name": "HeroBigFalloffPerc",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [350,500,700] | 客户端字段；含义按desc，未展开宏见Q03 |
| `IgniteDuration` | [5,5,5] | 其他模式；不采用 |
| `FalloffPercent` | [0.3,0.3,0.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HERODamage` | [350,500,700] | 强化分支；未启用 |
| `HEROFalloffPercent` | [0.2,0.2,0.2] | 强化分支；未启用 |
| `HEROFriendlyFire` | [0.6,0.6,0.6] | 强化分支；未启用 |
| `HeroBigFalloffPerc` | [0.5,0.5,0.5] | 强化分支；未启用 |

### TFT13_Darius — Darius

来源：`/setData/1/champions/58`；完整记录SHA-256 `3769edddbd921896b5b314da27fab93effea5e028c770f4f1cc3b9468704492a`。费用1；现有ID `darius`。

羁绊身份：Conqueror → `TFT13_Warband`；Watcher → `TFT13_Watcher`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":600,"initialMana":30,"magicResist":40,"mana":70,"range":1}`。

```json
{
  "apiName": "TFT13_Darius",
  "name": "Darius",
  "cost": 1,
  "traits": ["Conqueror","Watcher"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 600.0,
    "initialMana": 30.0,
    "magicResist": 40.0,
    "mana": 70.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Spin, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to adjacent enemies and healing <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>. Apply a <physicalDamage>@ModifiedBleedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage bleed to target over @BleedDuration@&nbsp;seconds.",
    "icon": "ASSETS/Characters/TFT13_Darius/HUD/Darius_Icon_Decimate.TFT_Set13.tex",
    "name": "Decimate",
    "variables": [
      {
        "name": "BleedDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316]
      },
      {
        "name": "Heal",
        "value": [0.0,150.0,175.0,200.0,225.0,0.0,0.0]
      },
      {
        "name": "BleedPercentAttackDamage",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `BleedDuration` | [4,4,4] | 其他模式；不采用 |
| `PercentAttackDamage` | [2.4,2.4,2.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Heal` | [150,175,200] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BleedPercentAttackDamage` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Draven — Draven

来源：`/setData/1/champions/27`；完整记录SHA-256 `33e7ae5a3de20b76e69187cd4b67a41456dabaf03f2dba219111d87db3e79810`。费用1；main未实现。

羁绊身份：Conqueror → `TFT13_Warband`；Pit Fighter → `TFT13_Pugilist`。

基础属性审阅值：`{"armor":15,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":500,"initialMana":30,"magicResist":15,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Draven",
  "name": "Draven",
  "cost": 1,
  "traits": ["Conqueror","Pit Fighter"],
  "stats": {
    "armor": 15.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 500.0,
    "initialMana": 30.0,
    "magicResist": 15.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> If Draven has an empowered axe in hand, his next attack will throw it, dealing a total of <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. Empowered axes return to Draven after hitting an&nbsp;enemy.<br><br><spellActive>Active:</spellActive> Spin an empowered&nbsp;axe.",
    "icon": "ASSETS/Characters/TFT13_Draven/HUD/Icons2D/Draven_SpinningAxe.TFT_Set13.tex",
    "name": "Spinning Axes",
    "variables": [
      {
        "name": "PercentAD",
        "value": [1.399999976158142,1.399999976158142,1.399999976158142,1.399999976158142,1.399999976158142,1.399999976158142,1.399999976158142]
      },
      {
        "name": "BaseDamage",
        "value": [20.0,10.0,15.0,25.0,35.0,20.0,20.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAD` | [1.4,1.4,1.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BaseDamage` | [10,15,25] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Fish — Steb

来源：`/setData/1/champions/42`；完整记录SHA-256 `544b28d81275fb76b5bcbcfb1f8a022698c58fb5fe548df7b9b28ad0da393ddb`。费用1；main未实现。

羁绊身份：Enforcer → `TFT13_Squad`；Bruiser → `TFT13_Bruiser`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.55,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":650,"initialMana":30,"magicResist":45,"mana":90,"range":1}`。

```json
{
  "apiName": "TFT13_Fish",
  "name": "Steb",
  "cost": 1,
  "traits": ["Enforcer","Bruiser"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.550000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 650.0,
    "initialMana": 30.0,
    "magicResist": 45.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> On heal, heal the @NumAlliesToShare@ closest allies for <TFTBonus>@PercentAlliedHealShare*100@%</TFTBonus> of the&nbsp;amount.<br><br><spellActive>Active:</spellActive> Heal for <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and strike target for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Fish/HUD/Icons2D/Fish_Spell.TFT_Set13.tex",
    "name": "Field Medicine",
    "variables": [
      {
        "name": "PercentAlliedHealShare",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "NumAlliesToShare",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "Damage",
        "value": [0.0,260.0,390.0,585.0,780.0,0.0,0.0]
      },
      {
        "name": "Heal",
        "value": [0.0,270.0,310.0,360.0,410.0,0.0,0.0]
      },
      {
        "name": "HEROOmnivamp",
        "value": [0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896]
      },
      {
        "name": "HEROSpellDamageMod",
        "value": [0.6499999761581421,0.6499999761581421,0.6499999761581421,0.6499999761581421,0.6499999761581421,0.6499999761581421,0.6499999761581421]
      },
      {
        "name": "HEROMaxHits",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAlliedHealShare` | [0.25,0.25,0.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumAlliesToShare` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Damage` | [260,390,585] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Heal` | [270,310,360] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HEROOmnivamp` | [0.3,0.3,0.3] | 强化分支；未启用 |
| `HEROSpellDamageMod` | [0.65,0.65,0.65] | 强化分支；未启用 |
| `HEROMaxHits` | [3,3,3] | 强化分支；未启用 |

### TFT13_Irelia — Irelia

来源：`/setData/1/champions/59`；完整记录SHA-256 `2e9832b858ad19ee3401eb34cf4101996c80dc0b2ce80f192c7feae4ecce5486`。费用1；现有ID `irelia`。

羁绊身份：Rebel → `TFT13_Rebel`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":45,"hp":700,"initialMana":30,"magicResist":40,"mana":70,"range":1}`。

```json
{
  "apiName": "TFT13_Irelia",
  "name": "Irelia",
  "cost": 1,
  "traits": ["Rebel","Sentinel"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 700.0,
    "initialMana": 30.0,
    "magicResist": 40.0,
    "mana": 70.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Enter a defensive stance and gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield that rapidly decays over @ShieldDuration@ seconds. When it expires, deal <magicDamage>@ModifiedBaseStrikeDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage + <magicDamage>@PercentShieldDamage*100@%</magicDamage> of the damage absorbed to enemies around and in front of&nbsp;Irelia.",
    "icon": "ASSETS/Characters/TFT13_Irelia/HUD/Icons2D/IreliaSpell.TFT_Set13.tex",
    "name": "Defiant Dance",
    "variables": [
      {
        "name": "ShieldDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "ShieldHealth",
        "value": [200.0,400.0,475.0,575.0,675.0,1200.0,1400.0]
      },
      {
        "name": "StrikeBaseDamage",
        "value": [50.0,70.0,100.0,150.0,200.0,300.0,350.0]
      },
      {
        "name": "PercentShieldDamage",
        "value": [0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896]
      },
      {
        "name": "HERODashNum",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "HEROBaseDashDamage",
        "value": [0.0,3.3499999046325684,3.3499999046325684,3.450000047683716,3.450000047683716,0.0,0.0]
      },
      {
        "name": "HEROAttackSpeed",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "HEROSpellAPBase",
        "value": [0.0,40.0,60.0,90.0,120.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `ShieldDuration` | [3,3,3] | 其他模式；不采用 |
| `ShieldHealth` | [400,475,575] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StrikeBaseDamage` | [70,100,150] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentShieldDamage` | [0.3,0.3,0.3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HERODashNum` | [2,2,2] | 强化分支；未启用 |
| `HEROBaseDashDamage` | [3.35,3.35,3.45] | 强化分支；未启用 |
| `HEROAttackSpeed` | [0.4,0.4,0.4] | 强化分支；未启用 |
| `HEROSpellAPBase` | [40,60,90] | 强化分支；未启用 |

### TFT13_Lux — Lux

来源：`/setData/1/champions/69`；完整记录SHA-256 `3080e7858f1b211976bad058db1263764ee8a4b5540b8dea399cd87d4eaae9b3`。费用1；现有ID `lux`。

羁绊身份：Academy → `TFT13_Academy`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":30,"hp":500,"initialMana":0,"magicResist":20,"mana":50,"range":4}`。

```json
{
  "apiName": "TFT13_Lux",
  "name": "Lux",
  "cost": 1,
  "traits": ["Academy","Sorcerer"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 30.0,
    "hp": 500.0,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 50.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Grant <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield to the lowest current Health ally. Lux's next attack deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> bonus magic&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Lux/HUD/Icons2D/TFT13_LuxPrismaWrap.TFT_Set13.tex",
    "name": "Prismatic Barrier",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,360.0,540.0,900.0,1260.0,0.0,0.0]
      },
      {
        "name": "Shield",
        "value": [0.0,160.0,180.0,240.0,300.0,0.0,0.0]
      },
      {
        "name": "ShieldDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "DamageReduction",
        "value": [0.3499999940395355,0.3499999940395355,0.3499999940395355,0.3499999940395355,0.3499999940395355,0.3499999940395355,0.3499999940395355]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [360,540,900] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Shield` | [160,180,240] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [4,4,4] | 其他模式；不采用 |
| `DamageReduction` | [0.35,0.35,0.35] | 其他模式；不采用 |

### TFT13_Morgana — Morgana

来源：`/setData/1/champions/71`；完整记录SHA-256 `b3e3ecf518d1b020b1180304a3df327016ee1b2916c524686350b090e43255f2`。费用1；main未实现。

羁绊身份：Black Rose → `TFT13_Cabal`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":30,"hp":500,"initialMana":0,"magicResist":20,"mana":40,"range":4}`。

```json
{
  "apiName": "TFT13_Morgana",
  "name": "Morgana",
  "cost": 1,
  "traits": ["Black Rose","Visionary"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 30.0,
    "hp": 500.0,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 40.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Curse the nearest non-cursed enemy, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage over @Duration@ seconds and reducing the effectiveness of shields used on them by&nbsp;@ShieldReavePercent*100@%.",
    "icon": "ASSETS/Characters/TFT13_Morgana/HUD/Icons2D/FallenAngel_Empathize.TFT_Set13.tex",
    "name": "Tormented Soul",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,525.0,780.0,1300.0,1550.0,200.0,240.0]
      },
      {
        "name": "ShieldReavePercent",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "Duration",
        "value": [10.0,10.0,10.0,10.0,10.0,10.0,10.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [525,780,1300] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldReavePercent` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [10,10,10] | 其他模式；不采用 |

### TFT13_Red — Violet

来源：`/setData/1/champions/50`；完整记录SHA-256 `bce93074e139903147a048dc1716cbc36b3bf448c9078b7f1273818c97c86022`。费用1；main未实现。

羁绊身份：Family → `TFT13_Family`；Pit Fighter → `TFT13_Pugilist`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":46,"hp":650,"initialMana":20,"magicResist":40,"mana":65,"range":1}`。

```json
{
  "apiName": "TFT13_Red",
  "name": "Violet",
  "cost": 1,
  "traits": ["Family","Pit Fighter"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 650.0,
    "initialMana": 20.0,
    "magicResist": 40.0,
    "mana": 65.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Jab target @NumStrikes@ times for <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage each. Then uppercut them, dealing <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</physicalDamage> physical damage and briefly knocking them&nbsp;up.",
    "icon": "ASSETS/Characters/TFT13_Red/HUD/TFT13_Red_Ability.TFT_Set13.tex",
    "name": "1-2-3 Combo",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858]
      },
      {
        "name": "StunDuration",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "APDamage",
        "value": [0.0,20.0,30.0,45.0,60.0,0.0,0.0]
      },
      {
        "name": "PercentIncreasedAttackDamage",
        "value": [3.299999952316284,3.299999952316284,3.299999952316284,3.299999952316284,3.299999952316284,3.299999952316284,3.299999952316284]
      },
      {
        "name": "NumStrikes",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [1.35,1.35,1.35] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [0.25,0.25,0.25] | 其他模式；不采用 |
| `APDamage` | [20,30,45] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentIncreasedAttackDamage` | [3.3,3.3,3.3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumStrikes` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Shooter — Maddie

来源：`/setData/1/champions/43`；完整记录SHA-256 `9abdb26ca643c9621cf3b34a8c8c90caca50e68632a5fc9037eddaf0988a02ba`。费用1；现有ID `maddie`。

羁绊身份：Enforcer → `TFT13_Squad`；Sniper → `TFT13_Sniper`。

基础属性审阅值：`{"armor":15,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":500,"initialMana":20,"magicResist":15,"mana":120,"range":6}`。

```json
{
  "apiName": "TFT13_Shooter",
  "name": "Maddie",
  "cost": 1,
  "traits": ["Enforcer","Sniper"],
  "stats": {
    "armor": 15.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 500.0,
    "initialMana": 20.0,
    "magicResist": 15.0,
    "mana": 120.0,
    "range": 6.0
  },
  "ability": {
    "desc": "Fire @NumOfShots@ shots towards the farthest enemy that deal <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to the first enemy they&nbsp;hit.",
    "icon": "ASSETS/Characters/TFT13_Shooter/HUD/Icons2D/ShooterSpellIcon.TFT_Set13.tex",
    "name": "Fan the Hammer",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [1.350000023841858,1.25,1.25,1.399999976158142,1.399999976158142,1.350000023841858,1.350000023841858]
      },
      {
        "name": "APDamage",
        "value": [0.0,10.0,15.0,25.0,35.0,0.0,0.0]
      },
      {
        "name": "NumOfShots",
        "value": [6.0,6.0,6.0,6.0,6.0,6.0,6.0]
      },
      {
        "name": "TotalSpellTime",
        "value": [1.149999976158142,1.149999976158142,1.149999976158142,1.149999976158142,1.149999976158142,1.149999976158142,1.149999976158142]
      },
      {
        "name": "ShotsPerSimulatedLaunchAttack",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [1.25,1.25,1.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [10,15,25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumOfShots` | [6,6,6] | 客户端字段；含义按desc，未展开宏见Q03 |
| `TotalSpellTime` | [1.15,1.15,1.15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShotsPerSimulatedLaunchAttack` | [3,3,3] | 内部参数/活跃性或单位需证实；Q03/Q05 |

### TFT13_Singed — Singed

来源：`/setData/1/champions/11`；完整记录SHA-256 `c2fd5b6561af6423312fd720521d757744bea7e6bfaead22e0b69da2817c05d8`。费用1；main未实现。

羁绊身份：Chem-Baron → `TFT13_Crime`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":650,"initialMana":0,"magicResist":40,"mana":50,"range":1}`。

```json
{
  "apiName": "TFT13_Singed",
  "name": "Singed",
  "cost": 1,
  "traits": ["Chem-Baron","Sentinel"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 650.0,
    "initialMana": 0,
    "magicResist": 40.0,
    "mana": 50.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Gain <TFTBonus>@ModifiedDurability@&nbsp;(%i:scaleAP%)</TFTBonus>&nbsp;Durability and grant the ally who has dealt the most damage this round <scaleLevel>@AttackSpeed@%</scaleLevel> Attack Speed, decaying over @Duration@&nbsp;seconds. ",
    "icon": "ASSETS/Characters/TFT13_Singed/HUD/Icons2D/Singed_R.TFT_Set13.tex",
    "name": "Dangerous Mutations",
    "variables": [
      {
        "name": "AttackSpeed",
        "value": [1.0,100.0,120.0,160.0,200.0,1.0,1.0]
      },
      {
        "name": "Duration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "DR",
        "value": [0.5,0.5,0.5,0.6000000238418579,0.699999988079071,0.5,0.5]
      },
      {
        "name": "HEROSpellBaseDamage",
        "value": [0.0,140.0,210.0,315.0,420.0,0.0,0.0]
      },
      {
        "name": "HEROOmnivamp",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "HERODuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "HEROCloudDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "HEROMoveSpeed",
        "value": [250.0,250.0,250.0,250.0,250.0,250.0,250.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `AttackSpeed` | [100,120,160] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [4,4,4] | 其他模式；不采用 |
| `DR` | [0.5,0.5,0.55] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HEROSpellBaseDamage` | [140,210,315] | 强化分支；未启用 |
| `HEROOmnivamp` | [0.2,0.2,0.2] | 强化分支；未启用 |
| `HERODuration` | [5,5,5] | 强化分支；未启用 |
| `HEROCloudDuration` | [3,3,3] | 强化分支；未启用 |
| `HEROMoveSpeed` | [250,250,250] | 强化分支；未启用 |

### TFT13_Trundle — Trundle

来源：`/setData/1/champions/35`；完整记录SHA-256 `4d9fe9e8131e5f5e22527d748e85171bd6fbf96048452778badeaaf383d91322`。费用1；main未实现。

羁绊身份：Scrap → `TFT13_Scrap`；Bruiser → `TFT13_Bruiser`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":650,"initialMana":30,"magicResist":40,"mana":90,"range":1}`。

```json
{
  "apiName": "TFT13_Trundle",
  "name": "Trundle",
  "cost": 1,
  "traits": ["Scrap","Bruiser"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 650.0,
    "initialMana": 30.0,
    "magicResist": 40.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and chomp target for <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. Both effects are increased by up to @AmountIncreaseMax*100@% based on Trundle's missing&nbsp;Health.",
    "icon": "ASSETS/Characters/TFT13_Trundle/HUD/Icons2D/Trundle_Q.TFT_Set13.tex",
    "name": "Desperate Chomp",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [2.799999952316284,2.799999952316284,2.799999952316284,2.799999952316284,2.799999952316284,2.799999952316284,2.799999952316284]
      },
      {
        "name": "GainHealth",
        "value": [0.0,200.0,220.0,250.0,270.0,0.0,0.0]
      },
      {
        "name": "AmountIncreaseMax",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [2.8,2.8,2.8] | 客户端字段；含义按desc，未展开宏见Q03 |
| `GainHealth` | [200,220,250] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AmountIncreaseMax` | [0.75,0.75,0.75] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Vex — Vex

来源：`/setData/1/champions/56`；完整记录SHA-256 `2695b61c866b97b28d7e8241ec9e141d0c5216432d91433fe9d36b1398b00c53`。费用1；main未实现。

羁绊身份：Rebel → `TFT13_Rebel`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":15,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":30,"hp":450,"initialMana":0,"magicResist":15,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Vex",
  "name": "Vex",
  "cost": 1,
  "traits": ["Rebel","Visionary"],
  "stats": {
    "armor": 15.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 30.0,
    "hp": 450.0,
    "initialMana": 0,
    "magicResist": 15.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and create a one-hex radius zone of darkness around them. After a brief delay, deal <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to enemies still in the&nbsp;zone.",
    "icon": "ASSETS/Characters/TFT13_Vex/HUD/Icons2D/Icons_TFT13_Vex_Spell.TFT_Set13.tex",
    "name": "Looming Darkness",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,220.0,330.0,550.0,770.0,0.0,0.0]
      },
      {
        "name": "SecondaryDamage",
        "value": [0.0,110.0,165.0,275.0,385.0,0.0,0.0]
      },
      {
        "name": "DOTDuration",
        "value": [0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [220,330,550] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondaryDamage` | [110,165,275] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DOTDuration` | [0.8,0.8,0.8] | 其他模式；不采用 |

### TFT13_Zyra — Zyra

来源：`/setData/1/champions/63`；完整记录SHA-256 `4e065ef99a8180815794b12dae41ff73199df633713db9a8604722c4184901dd`。费用1；现有ID `zyra`。

羁绊身份：Experiment → `TFT13_Experiment`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":30,"hp":500,"initialMana":10,"magicResist":20,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Zyra",
  "name": "Zyra",
  "cost": 1,
  "traits": ["Experiment","Sorcerer"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 30.0,
    "hp": 500.0,
    "initialMana": 10.0,
    "magicResist": 20.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Send vines towards the current target, Stunning them for @StunDuration@ second and dealing <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage. Then smaller vines seek out the @NumSmallerVines@ nearest enemies and deal <magicDamage>@ModifiedAOEDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to them.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus:<TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus> Ability damage bleeds enemies for <trueDamage enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus@%</trueDamage> bonus true damage over @ExperimentDuration@&nbsp;seconds.</spellActive>",
    "icon": "ASSETS/Characters/TFT13_Zyra/HUD/Icons2D/TFT13_ZyraSpellIcon.TFT_Set13.tex",
    "name": "Grasping Roots",
    "variables": [
      {
        "name": "TargetDamage",
        "value": [0.0,260.0,390.0,585.0,780.0,0.0,0.0]
      },
      {
        "name": "StunDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "AOEDamage",
        "value": [0.0,95.0,140.0,215.0,290.0,0.0,0.0]
      },
      {
        "name": "ExperimentTrueDamage",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "ExperimentDuration",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "NumSmallerVines",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `TargetDamage` | [260,390,585] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [1,1,1] | 其他模式；不采用 |
| `AOEDamage` | [95,140,215] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExperimentTrueDamage` | [0.5,0.5,0.5] | 实验条件；Q04 |
| `ExperimentDuration` | [2,2,2] | 其他模式；不采用 |
| `NumSmallerVines` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Akali — Akali

来源：`/setData/1/champions/23`；完整记录SHA-256 `1799e23e2f06251c814684e13d7a3fbe3647b453874063b669140894e7ee2518`。费用2；main未实现。

羁绊身份：Rebel → `TFT13_Rebel`；Quickstriker → `TFT13_Challenger`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":45,"hp":700,"initialMana":0,"magicResist":45,"mana":60,"range":1}`。

```json
{
  "apiName": "TFT13_Akali",
  "name": "Akali",
  "cost": 2,
  "traits": ["Rebel","Quickstriker"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": 45.0,
    "mana": 60.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Throw a shuriken at target, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and marking them to take <TFTBonus>@TargetDamageAmp*100@%</TFTBonus> more damage for @Duration@ seconds. Then dash away from target. After a brief delay, dash towards them and deal <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Akali/HUD/Icons2D/Akali_Spell.TFT_Set13.tex",
    "name": "Shuriken Flip",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,80.0,120.0,185.0,250.0,0.0,0.0]
      },
      {
        "name": "SecondaryDamage",
        "value": [0.0,240.0,360.0,550.0,740.0,0.0,0.0]
      },
      {
        "name": "TargetDamageAmp",
        "value": [0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448]
      },
      {
        "name": "Duration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "FlipBackwardsSpeed",
        "value": [1300.0,1300.0,1300.0,1300.0,1300.0,1300.0,1300.0]
      },
      {
        "name": "SpeedDuringFinalKick",
        "value": [1700.0,1700.0,1700.0,1700.0,1700.0,1700.0,1700.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [80,120,185] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondaryDamage` | [240,360,550] | 客户端字段；含义按desc，未展开宏见Q03 |
| `TargetDamageAmp` | [0.15,0.15,0.15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [4,4,4] | 其他模式；不采用 |
| `FlipBackwardsSpeed` | [1300,1300,1300] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SpeedDuringFinalKick` | [1700,1700,1700] | 其他模式；不采用 |

### TFT13_Camille — Camille

来源：`/setData/1/champions/14`；完整记录SHA-256 `508e02e1ff4a2e962448e8a818c6fee39148baab3e89f80ef954e888f6db4202`。费用2；main未实现。

羁绊身份：Enforcer → `TFT13_Squad`；Ambusher → `TFT13_Ambusher`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":52,"hp":700,"initialMana":0,"magicResist":45,"mana":25,"range":1}`。

```json
{
  "apiName": "TFT13_Camille",
  "name": "Camille",
  "cost": 2,
  "traits": ["Enforcer","Ambusher"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": 45.0,
    "mana": 25.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Kick the target, dealing <trueDamage>@TotalDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</trueDamage> <TFTKeyword>Adaptive Damage</TFTKeyword>. Heal for @HealPercent*100@% of the damage&nbsp;dealt.<br><br><rules><tftbold>Adaptive Damage:</tftbold> Uses the damage type the target resists less</rules><br>",
    "icon": "ASSETS/Characters/TFT13_Camille/HUD/Icons2D/Camille_Spell.TFT_Set13.tex",
    "name": "Adaptive Strike",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [2.75,2.299999952316284,2.299999952316284,2.5999999046325684,2.5999999046325684,2.75,2.75]
      },
      {
        "name": "APDamage",
        "value": [0.0,30.0,45.0,70.0,95.0,0.0,0.0]
      },
      {
        "name": "HealPercent",
        "value": [0.33000001311302185,0.33000001311302185,0.33000001311302185,0.33000001311302185,0.33000001311302185,0.33000001311302185,0.33000001311302185]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [2.3,2.3,2.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [30,45,70] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HealPercent` | [0.3,0.3,0.3] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Leona — Leona

来源：`/setData/1/champions/66`；完整记录SHA-256 `0b0c0817ddef2c2c3ccbc5350a5ae6dcfacde6f7a778ccc771434f50c756f5b9`。费用2；现有ID `leona`。

羁绊身份：Academy → `TFT13_Academy`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":800,"initialMana":50,"magicResist":50,"mana":90,"range":1}`。

```json
{
  "apiName": "TFT13_Leona",
  "name": "Leona",
  "cost": 2,
  "traits": ["Academy","Sentinel"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 800.0,
    "initialMana": 50.0,
    "magicResist": 50.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Fortify for @Duration@ seconds, gaining <TFTBonus>@ModifiedDurability@&nbsp;(%i:scaleAP%)</TFTBonus> Durability. Afterwards, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent enemies.",
    "icon": "ASSETS/Characters/TFT13_Leona/HUD/Icons2D/TFT13_LeonaSolarBarrier.TFT_Set13.tex",
    "name": "Eclipse",
    "variables": [
      {
        "name": "Duration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "Damage",
        "value": [0.0,115.0,175.0,270.0,365.0,0.0,0.0]
      },
      {
        "name": "DR",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Duration` | [3,3,3] | 其他模式；不采用 |
| `Damage` | [115,175,270] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DR` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Nocturne — Nocturne

来源：`/setData/1/champions/57`；完整记录SHA-256 `6900c2287ec020545dfce8d946ff1183c92bf6614c023af83585d9778e62cee8`。费用2；main未实现。

羁绊身份：Automata → `TFT13_Hextech`；Quickstriker → `TFT13_Challenger`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":63,"hp":700,"initialMana":0,"magicResist":45,"mana":40,"range":1}`。

```json
{
  "apiName": "TFT13_Nocturne",
  "name": "Nocturne",
  "cost": 2,
  "traits": ["Automata","Quickstriker"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 65.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": 45.0,
    "mana": 40.0,
    "range": 1.0
  },
  "ability": {
    "desc": "For @Duration@ seconds, attacks also cause adjacent enemies to bleed for <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage over @BleedDuration@&nbsp;second.",
    "icon": "ASSETS/Characters/TFT13_Nocturne/HUD/Icons2D/TFT13_Nocturne_EyeOfTheStorm.TFT_Set13.tex",
    "name": "Overdrive Blades",
    "variables": [
      {
        "name": "ADPercent",
        "value": [0.0,1.2000000476837158,1.2000000476837158,1.399999976158142,1.399999976158142,0.0,0.0]
      },
      {
        "name": "Duration",
        "value": [6.0,6.0,6.0,6.0,6.0,6.0,6.0]
      },
      {
        "name": "BaseDamage",
        "value": [0.0,15.0,25.0,40.0,55.0,0.0,0.0]
      },
      {
        "name": "BleedDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "BleedTicksRate",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `ADPercent` | [1.2,1.2,1.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [6,6,6] | 其他模式；不采用 |
| `BaseDamage` | [15,25,40] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BleedDuration` | [1,1,1] | 其他模式；不采用 |
| `BleedTicksRate` | [0.25,0.25,0.25] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Prime — Vander

来源：`/setData/1/champions/45`；完整记录SHA-256 `ea12701bb3175068e0e0a72a4fb66a624a45847a306dfe1039d0c2fd6d78a3d6`。费用2；现有ID `vander`。

羁绊身份：Family → `TFT13_Family`；Watcher → `TFT13_Watcher`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":800,"initialMana":0,"magicResist":45,"mana":50,"range":1}`。

```json
{
  "apiName": "TFT13_Prime",
  "name": "Vander",
  "cost": 2,
  "traits": ["Family","Watcher"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 800.0,
    "initialMana": 0,
    "magicResist": 45.0,
    "mana": 50.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Stop attacking and brace for @TauntDuration@ seconds, gaining <TFTBonus>@ModifiedDefenses@&nbsp;(%i:scaleAP%)</TFTBonus> Armor and Magic Resist. Vander's next attack is replaced with a strike that deals <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage, increased by <physicalDamage>@ModifiedBonusDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage for each 1 or 2 cost champion on your&nbsp;team. ",
    "icon": "ASSETS/Characters/TFT13_Prime/HUD/Icons2D/PrimeSpell.TFT_Set13.tex",
    "name": "Hound of the Underground",
    "variables": [
      {
        "name": "TauntDuration",
        "value": [2.5,2.5,2.5,2.5,2.5,2.5,2.5]
      },
      {
        "name": "Resists",
        "value": [90.0,100.0,125.0,150.0,175.0,90.0,90.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "BonusDamageADRatio",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "HEROSpellDuration",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "HEROBonusDamage",
        "value": [1.850000023841858,1.850000023841858,1.850000023841858,1.850000023841858,1.850000023841858,1.850000023841858,1.850000023841858]
      },
      {
        "name": "HEROSplashPerc",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "HEROStunDuration",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      },
      {
        "name": "HEROManaIncrease",
        "value": [60.0,60.0,60.0,60.0,60.0,60.0,60.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `TauntDuration` | [2.5,2.5,2.5] | 其他模式；不采用 |
| `Resists` | [100,125,150] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage` | [4,4,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BonusDamageADRatio` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HEROSpellDuration` | [0.5,0.5,0.5] | 强化分支；未启用 |
| `HEROBonusDamage` | [1.85,1.85,1.85] | 强化分支；未启用 |
| `HEROSplashPerc` | [0.25,0.25,0.25] | 强化分支；未启用 |
| `HEROStunDuration` | [0.75,0.75,0.75] | 强化分支；未启用 |
| `HEROManaIncrease` | [60,60,60] | 强化分支；未启用 |

### TFT13_Rell — Rell

来源：`/setData/1/champions/28`；完整记录SHA-256 `f406d583449f624cbfb32b046d61dfc55f41a119e70cdbb524442be0217f1637`。费用2；现有ID `rell`。

羁绊身份：Conqueror → `TFT13_Warband`；Sentinel → `TFT13_Titan`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":800,"initialMana":40,"magicResist":45,"mana":90,"range":1}`。

```json
{
  "apiName": "TFT13_Rell",
  "name": "Rell",
  "cost": 2,
  "traits": ["Conqueror","Sentinel","Visionary"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 800.0,
    "initialMana": 40.0,
    "magicResist": 45.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Lance enemies in a line for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and steal <TFTBonus>@DefensesSteal@</TFTBonus> Armor and Magic Resist from enemies&nbsp;hit.",
    "icon": "ASSETS/Characters/TFT13_Rell/HUD/Icons2D/RellSpell.TFT_Set13.tex",
    "name": "Shattering Strike",
    "variables": [
      {
        "name": "StabDamage",
        "value": [0.0,120.0,180.0,270.0,360.0,0.0,0.0]
      },
      {
        "name": "DefenseStealDuration",
        "value": [60.0,60.0,60.0,60.0,60.0,60.0,60.0]
      },
      {
        "name": "DefensesSteal",
        "value": [10.0,10.0,12.0,15.0,18.0,10.0,10.0]
      },
      {
        "name": "ShieldDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "Shield",
        "value": [0.0,300.0,350.0,400.0,540.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `StabDamage` | [120,180,270] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DefenseStealDuration` | [60,60,60] | 其他模式；不采用 |
| `DefensesSteal` | [10,12,15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [4,4,4] | 其他模式；不采用 |
| `Shield` | [300,350,400] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_RenataGlasc — Renata Glasc

来源：`/setData/1/champions/12`；完整记录SHA-256 `60425d9f89c829a8b09ceed212a3699db1f7a93c7f84d322fe65963e12077b72`。费用2；main未实现。

羁绊身份：Chem-Baron → `TFT13_Crime`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":35,"hp":600,"initialMana":20,"magicResist":20,"mana":80,"range":4}`。

```json
{
  "apiName": "TFT13_RenataGlasc",
  "name": "Renata Glasc",
  "cost": 2,
  "traits": ["Chem-Baron","Visionary"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 35.0,
    "hp": 600.0,
    "initialMana": 20.0,
    "magicResist": 20.0,
    "mana": 80.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Fire a pair of missiles at target. Allies they pass through gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. When they collide, they deal <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and <magicDamage>@ModifiedExplosionDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent&nbsp;enemies.  ",
    "icon": "ASSETS/Characters/TFT13_RenataGlasc/HUD/Icons2D/Renata_E.TFT_Set13.tex",
    "name": "Loyalty Program",
    "variables": [
      {
        "name": "Shield",
        "value": [100.0,95.0,120.0,150.0,180.0,100.0,100.0]
      },
      {
        "name": "ShieldDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "TargetDamage",
        "value": [0.0,310.0,465.0,700.0,935.0,0.0,0.0]
      },
      {
        "name": "ExplosionDamage",
        "value": [0.0,155.0,230.0,350.0,465.0,0.0,0.0]
      },
      {
        "name": "AdditionalSearchDistance",
        "value": [150.0,150.0,150.0,150.0,150.0,150.0,150.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Shield` | [95,120,150] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [3,3,3] | 其他模式；不采用 |
| `TargetDamage` | [310,465,700] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExplosionDamage` | [155,230,350] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AdditionalSearchDistance` | [150,150,150] | 内部参数/活跃性或单位需证实；Q03/Q05 |

### TFT13_Sett — Sett

来源：`/setData/1/champions/24`；完整记录SHA-256 `0ea9c7a3d95a58d9c0511b7a041cbcd15c811462aafa334a6c4567ce6fa1150f`。费用2；main未实现。

羁绊身份：Rebel → `TFT13_Rebel`；Bruiser → `TFT13_Bruiser`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":850,"initialMana":50,"magicResist":50,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_Sett",
  "name": "Sett",
  "cost": 2,
  "traits": ["Rebel","Bruiser"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 850.0,
    "initialMana": 50.0,
    "magicResist": 50.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Pull in an enemy on either side and slam them together, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and Stunning them for <scaleLevel>@StunDuration@</scaleLevel>&nbsp;seconds.<br><br>If only one enemy is grabbed, the damage and Stun duration are increased by <TFTBonus>50%.</TFTBonus>",
    "icon": "ASSETS/Characters/TFT13_Sett/HUD/Icons2D/Sett_Spell.TFT_Set13.tex",
    "name": "Facebreaker",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,180.0,270.0,420.0,570.0,2.0,2.0]
      },
      {
        "name": "StunDuration",
        "value": [1.0,1.5,1.5,2.0,2.5,3.5,4.0]
      },
      {
        "name": "SoloBonus",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [180,270,420] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [1.5,1.5,2] | 其他模式；不采用 |
| `SoloBonus` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Tristana — Tristana

来源：`/setData/1/champions/72`；完整记录SHA-256 `ed1b0010d9465ffd92b71d410da71f64447a640a6b7be8be3656ed34d1584c89`。费用2；现有ID `tristana`。

羁绊身份：Emissary → `TFT13_Ambassador`；Artillerist → `TFT13_Martialist`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":42,"hp":550,"initialMana":20,"magicResist":20,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Tristana",
  "name": "Tristana",
  "cost": 2,
  "traits": ["Emissary","Artillerist"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 42.0,
    "hp": 550.0,
    "initialMana": 20.0,
    "magicResist": 20.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Fire a cannonball at target, dealing <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. If they die, the cannonball ricochets to the nearest enemy, dealing the overkill damage. When it does, permanently gain <TFTBonus>@TFTUnitProperty.:TFT13_TristanaASPerStack@%</TFTBonus>&nbsp;Attack Damage.<br><br><TFTTrackerLabel>(Current Bonus:&nbsp;@TFTUnitProperty.:TFT13_TristanaASGain@% %i:scaleAD%) </TFTTrackerLabel> ",
    "icon": "ASSETS/Characters/TFT13_Tristana/HUD/Icons2D/TFT13_Tristana_Passive.TFT_Set13.tex",
    "name": "Draw a Bead",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [5.25,5.25,5.25,5.25,5.25,5.25,5.25]
      },
      {
        "name": "APDamage",
        "value": [0.0,50.0,75.0,115.0,155.0,0.0,0.0]
      },
      {
        "name": "ASKillGain",
        "value": [1.25,1.25,1.25,1.25,1.25,1.25,1.25]
      },
      {
        "name": "ASKillGainHyperroll",
        "value": [2.5,2.5,2.5,2.5,2.5,2.5,2.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [5.25,5.25,5.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [50,75,115] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ASKillGain` | [1.25,1.25,1.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ASKillGainHyperroll` | [2.5,2.5,2.5] | 其他模式；不采用 |

### TFT13_Urgot — Urgot

来源：`/setData/1/champions/75`；完整记录SHA-256 `ab95fc050a995ab6477cddc487e13f8844f168a996000fb7c3a8ed9b927592d6`。费用2；现有ID `urgot`。

羁绊身份：Experiment → `TFT13_Experiment`；Pit Fighter → `TFT13_Pugilist`；Artillerist → `TFT13_Martialist`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":700,"initialMana":20,"magicResist":45,"mana":70,"range":2}`。

```json
{
  "apiName": "TFT13_Urgot",
  "name": "Urgot",
  "cost": 2,
  "traits": ["Experiment","Pit Fighter","Artillerist"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 700.0,
    "initialMana": 20.0,
    "magicResist": 45.0,
    "mana": 70.0,
    "range": 2.0
  },
  "ability": {
    "desc": "Fire an explosive charge, dealing <physicalDamage>@ModifiedPrimaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to target and <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to adjacent enemies. 20% <TFTKeyword>Sunder</TFTKeyword> all enemies hit for @Duration@&nbsp;seconds.<br><br><rules><tftbold>Sunder:</tftbold> Reduce Armor</rules><br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus:<TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus> Dash to targets. On cast, gain <TFTBonus enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield@%</TFTBonus> max Health Shield and <TFTBonus enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS@%</TFTBonus>&nbsp;Attack Speed for @ExperimentDuration@&nbsp;seconds.</spellActive>",
    "icon": "ASSETS/Characters/TFT13_Urgot/HUD/Icons2D/TFT13_Urgot_Q.TFT_Set13.tex",
    "name": "Corrosive Charge",
    "variables": [
      {
        "name": "PrimaryDamage",
        "value": [3.0,3.0,3.0,3.299999952316284,3.299999952316284,3.0,3.0]
      },
      {
        "name": "SecondaryDamage",
        "value": [1.5,1.5,1.5,1.649999976158142,1.649999976158142,1.5,1.5]
      },
      {
        "name": "Duration",
        "value": [6.0,6.0,6.0,6.0,6.0,6.0,6.0]
      },
      {
        "name": "APDamage",
        "value": [0.0,35.0,50.0,75.0,100.0,0.0,0.0]
      },
      {
        "name": "ExperimentPercentHealthShield",
        "value": [0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066]
      },
      {
        "name": "ExperimentAttackSpeed",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "ExperimentDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PrimaryDamage` | [3,3,3.3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondaryDamage` | [1.5,1.5,1.65] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [6,6,6] | 其他模式；不采用 |
| `APDamage` | [35,50,75] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExperimentPercentHealthShield` | [0.08,0.08,0.08] | 实验条件；Q04 |
| `ExperimentAttackSpeed` | [0.2,0.2,0.2] | 实验条件；Q04 |
| `ExperimentDuration` | [5,5,5] | 其他模式；不采用 |

### TFT13_Vladimir — Vladimir

来源：`/setData/1/champions/30`；完整记录SHA-256 `63ca003ec8c6d17504b5b5f4f1a10f64af392397641653c4fd967c8a7a7e664e`。费用2；main未实现。

羁绊身份：Black Rose → `TFT13_Cabal`；Watcher → `TFT13_Watcher`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":45,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":45,"hp":800,"initialMana":0,"magicResist":45,"mana":65,"range":1}`。

```json
{
  "apiName": "TFT13_Vladimir",
  "name": "Vladimir",
  "cost": 2,
  "traits": ["Black Rose","Watcher","Sorcerer"],
  "stats": {
    "armor": 45.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 800.0,
    "initialMana": 0,
    "magicResist": 45.0,
    "mana": 65.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the&nbsp;target.",
    "icon": "ASSETS/Characters/TFT13_Vladimir/HUD/VladimirQ.tex",
    "name": "Transfusion",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,140.0,210.0,325.0,380.0,0.0,0.0]
      },
      {
        "name": "Heal",
        "value": [0.10000000149011612,200.0,240.0,300.0,330.0,0.10000000149011612,0.10000000149011612]
      },
      {
        "name": "HEROBonusDamage",
        "value": [1.7999999523162842,1.7999999523162842,1.7999999523162842,1.7999999523162842,1.7999999523162842,1.7999999523162842,1.7999999523162842]
      },
      {
        "name": "HEROOverkillPerc",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "HEROOverkillNum",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "HEROOverkillBaseDamage",
        "value": [0.0,90.0,135.0,205.0,275.0,0.0,0.0]
      },
      {
        "name": "TOOLTIPONLYMana",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "HEROAmpPerCast",
        "value": [0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [140,210,325] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Heal` | [200,240,300] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HEROBonusDamage` | [1.8,1.8,1.8] | 强化分支；未启用 |
| `HEROOverkillPerc` | [0.5,0.5,0.5] | 强化分支；未启用 |
| `HEROOverkillNum` | [1,1,1] | 强化分支；未启用 |
| `HEROOverkillBaseDamage` | [90,135,205] | 强化分支；未启用 |
| `TOOLTIPONLYMana` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HEROAmpPerCast` | [0.1,0.1,0.1] | 强化分支；未启用 |

### TFT13_Zeri — Zeri

来源：`/setData/1/champions/49`；完整记录SHA-256 `baead09f1b90aa07f85f08dc1dbca591092637161171e9807ef66ca509b7005c`。费用2；main未实现。

羁绊身份：Firelight → `TFT13_Hoverboard`；Sniper → `TFT13_Sniper`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":48,"hp":600,"initialMana":0,"magicResist":20,"mana":3,"range":6}`。

```json
{
  "apiName": "TFT13_Zeri",
  "name": "Zeri",
  "cost": 2,
  "traits": ["Firelight","Sniper"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 600.0,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 3.0,
    "range": 6.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> Every @NumOfAttacks@rd attack is replaced with a spark that deals <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to target and <physicalDamage>@SecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to @NumOfBounces@ nearby enemies.",
    "icon": "ASSETS/Characters/TFT13_Zeri/HUD/Icons2D/Zeri_P.TFT_Set13.tex",
    "name": "Living Battery",
    "variables": [
      {
        "name": "NumOfAttacks",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "NumOfBounces",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "APDamage",
        "value": [0.0,10.0,15.0,20.0,25.0,0.0,0.0]
      },
      {
        "name": "PercentDealtToBouncedEnemies",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `NumOfAttacks` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumOfBounces` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [10,15,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentDealtToBouncedEnemies` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Ziggs — Ziggs

来源：`/setData/1/champions/36`；完整记录SHA-256 `4968d5bb6ad43cb77a4398c7f13e3219cf24db58bf21c1fd563d8bcf0307420b`。费用2；main未实现。

羁绊身份：Scrap → `TFT13_Scrap`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":20,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":35,"hp":600,"initialMana":15,"magicResist":20,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Ziggs",
  "name": "Ziggs",
  "cost": 2,
  "traits": ["Scrap","Dominator"],
  "stats": {
    "armor": 20.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 35.0,
    "hp": 600.0,
    "initialMana": 15.0,
    "magicResist": 20.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Toss a bomb at target, dealing <magicDamage>@ModifiedInitialDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. @NumBombs@ mini-bombs fly out, dealing <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to random&nbsp;enemies. ",
    "icon": "ASSETS/Characters/TFT13_Ziggs/HUD/Icons2D/ZiggsSpell.TFT_Set13.tex",
    "name": "Bomb Full of Bombs",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,180.0,270.0,450.0,535.0,0.0,0.0]
      },
      {
        "name": "MinibombDamage",
        "value": [1.0,90.0,135.0,200.0,240.0,1.0,1.0]
      },
      {
        "name": "NumBombs",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [180,270,450] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinibombDamage` | [90,135,200] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumBombs` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Beardy — Loris

来源：`/setData/1/champions/41`；完整记录SHA-256 `d6ef6bcd7e4e135b3f39eb5fe84f3347c5231467d9c4a0ad2a67dfab591e38ed`。费用3；现有ID `loris`。

羁绊身份：Enforcer → `TFT13_Squad`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":850,"initialMana":40,"magicResist":50,"mana":80,"range":1}`。

```json
{
  "apiName": "TFT13_Beardy",
  "name": "Loris",
  "cost": 3,
  "traits": ["Enforcer","Sentinel"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 850.0,
    "initialMana": 50.0,
    "magicResist": 50.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @Duration@ seconds. It redirects <TFTBonus>@PercentDamageRedirect*100@%</TFTBonus> of damage taken by adjacent allies. When it expires, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage in a&nbsp;cone.",
    "icon": "ASSETS/Characters/TFT13_Beardy/HUD/Icons2D/Beardy_Spell.TFT_Set13.tex",
    "name": "Piltover Bulwark",
    "variables": [
      {
        "name": "Shield",
        "value": [0.0,525.0,600.0,700.0,800.0,0.0,0.0]
      },
      {
        "name": "Damage",
        "value": [0.0,150.0,225.0,360.0,495.0,0.0,0.0]
      },
      {
        "name": "PercentDamageRedirect",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "Duration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Shield` | [525,600,700] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Damage` | [150,225,360] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentDamageRedirect` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [4,4,4] | 其他模式；不采用 |

### TFT13_Blitzcrank — Blitzcrank

来源：`/setData/1/champions/15`；完整记录SHA-256 `ece6bc27b77bc3bb3d5bfb9eb966aa02bde21768749d57598d441e9aa321e3a3`。费用3；main未实现。

羁绊身份：Automata → `TFT13_Hextech`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":850,"initialMana":20,"magicResist":50,"mana":70,"range":1}`。

```json
{
  "apiName": "TFT13_Blitzcrank",
  "name": "Blitzcrank",
  "cost": 3,
  "traits": ["Automata","Dominator"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 850.0,
    "initialMana": 20.0,
    "magicResist": 50.0,
    "mana": 70.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> After surviving damage, deal <magicDamage>@PassiveDamagePercent*100@%</magicDamage> of the damage absorbed as magic damage to&nbsp;target.<br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Shock the nearest @NumEnemies@ enemies for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and reduce their damage by @DamageReduction*100@% for @ShieldDuration@&nbsp;seconds.",
    "icon": "ASSETS/Characters/TFT13_Blitzcrank/HUD/Icons2D/BlitzcrankQ.TFT_Set13.tex",
    "name": "Static Field",
    "variables": [
      {
        "name": "Shield",
        "value": [400.0,470.0,500.0,550.0,600.0,400.0,400.0]
      },
      {
        "name": "ShieldDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "BaseDamage",
        "value": [80.0,40.0,60.0,100.0,200.0,80.0,80.0]
      },
      {
        "name": "PassiveDamagePercent",
        "value": [0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746]
      },
      {
        "name": "PassiveCooldownSeconds",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "DamageReduction",
        "value": [0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612]
      },
      {
        "name": "NumEnemies",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Shield` | [470,500,550] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [4,4,4] | 其他模式；不采用 |
| `BaseDamage` | [40,60,100] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PassiveDamagePercent` | [0.03,0.03,0.03] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PassiveCooldownSeconds` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageReduction` | [0.1,0.1,0.1] | 其他模式；不采用 |
| `NumEnemies` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Cassiopeia — Cassiopeia

来源：`/setData/1/champions/29`；完整记录SHA-256 `bfd7e654fce581edaf8826679b718e3688c8fcae7e17359b3658f9bf8b7444aa`。费用3；main未实现。

羁绊身份：Black Rose → `TFT13_Cabal`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":25,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":40,"hp":700,"initialMana":10,"magicResist":25,"mana":40,"range":4}`。

```json
{
  "apiName": "TFT13_Cassiopeia",
  "name": "Cassiopeia",
  "cost": 3,
  "traits": ["Black Rose","Dominator"],
  "stats": {
    "armor": 25.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 40.0,
    "hp": 700.0,
    "initialMana": 10.0,
    "magicResist": 25.0,
    "mana": 40.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Blast target for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. Every third cast, splash miasma to @BonusNumEnemies@ enemies within @HexRadius@ hexes, dealing <magicDamage>@ModifiedMiasmaDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to&nbsp;each.",
    "icon": "ASSETS/Characters/TFT13_Cassiopeia/HUD/Cassiopeia_W.TFT_Set13.tex",
    "name": "Thorned Miasma",
    "variables": [
      {
        "name": "Damage",
        "value": [200.0,230.0,345.0,550.0,755.0,450.0,450.0]
      },
      {
        "name": "MiasmaDamage",
        "value": [40.0,160.0,240.0,385.0,530.0,40.0,40.0]
      },
      {
        "name": "BonusNumEnemies",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "NumCasts",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "HexRadius",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [230,345,550] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MiasmaDamage` | [160,240,385] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BonusNumEnemies` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumCasts` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HexRadius` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Chainsaw — Renni

来源：`/setData/1/champions/40`；完整记录SHA-256 `3d6d18ed68632a06a4cb296ed74343b80e936f9644506f97f7c1f1d1b7802711`。费用3；main未实现。

羁绊身份：Chem-Baron → `TFT13_Crime`；Bruiser → `TFT13_Bruiser`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":55,"hp":850,"initialMana":40,"magicResist":50,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_Chainsaw",
  "name": "Renni",
  "cost": 3,
  "traits": ["Chem-Baron","Bruiser"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 55.0,
    "hp": 850.0,
    "initialMana": 40.0,
    "magicResist": 50.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Heal <scaleHealth>@ModifiedHealing@&nbsp;(%i:scaleHealth%%i:scaleAP%)</scaleHealth> over @StunDuration@ seconds. For the duration, raise target into the air, Stunning them, and dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. Afterwards, slam them down, dealing <physicalDamage>@FinalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all adjacent&nbsp;enemies.<br><br>",
    "icon": "ASSETS/Characters/TFT13_Chainsaw/HUD/Icons2D/ChainsawSpell.TFT_Set13.tex",
    "name": "Sludgerunner's Smash",
    "variables": [
      {
        "name": "APHeal",
        "value": [5.75,300.0,325.0,375.0,425.0,100.0,100.0]
      },
      {
        "name": "MaxHealthHealingPercent",
        "value": [0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448]
      },
      {
        "name": "StunDuration",
        "value": [1.5,1.5,1.5,1.5,1.5,1.5,1.5]
      },
      {
        "name": "ADPercent",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "FinalADPercent",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "HeroAbilityDamage",
        "value": [1.100000023841858,1.100000023841858,1.100000023841858,1.100000023841858,1.100000023841858,1.100000023841858,1.100000023841858]
      },
      {
        "name": "HeroManaReduction",
        "value": [10.0,10.0,10.0,10.0,10.0,10.0,10.0]
      },
      {
        "name": "HeroHexDistance",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "HeroChargePercent",
        "value": [0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896]
      },
      {
        "name": "HeroStunDuration",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "HEROMaxHealthHealingPercent",
        "value": [0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `APHeal` | [300,325,375] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MaxHealthHealingPercent` | [0.15,0.15,0.15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [1.5,1.5,1.5] | 其他模式；不采用 |
| `ADPercent` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `FinalADPercent` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HeroAbilityDamage` | [1.1,1.1,1.1] | 强化分支；未启用 |
| `HeroManaReduction` | [10,10,10] | 强化分支；未启用 |
| `HeroHexDistance` | [2,2,2] | 强化分支；未启用 |
| `HeroChargePercent` | [0.3,0.3,0.3] | 强化分支；未启用 |
| `HeroStunDuration` | [0.5,0.5,0.5] | 强化分支；未启用 |
| `HEROMaxHealthHealingPercent` | [0.06,0.06,0.06] | 强化分支；未启用 |

### TFT13_Ezreal — Ezreal

来源：`/setData/1/champions/25`；完整记录SHA-256 `9f22b8e01b2cc8b91859d40f53f16d1f16cfa8658d9f5677bb9bccc389f789c1`。费用3；现有ID `ezreal`。

羁绊身份：Academy → `TFT13_Academy`；Rebel → `TFT13_Rebel`；Artillerist → `TFT13_Martialist`。

基础属性审阅值：`{"armor":25,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":700,"initialMana":0,"magicResist":25,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Ezreal",
  "name": "Ezreal",
  "cost": 3,
  "traits": ["Academy","Rebel","Artillerist"],
  "stats": {
    "armor": 25.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": 25.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Fire a shot towards current target that deals <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all enemies within 1 hex. Then, deal <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to the unit in the center of the&nbsp;blast.<br><br><br>",
    "icon": "ASSETS/Characters/TFT13_Ezreal/HUD/Icons2D/Ezreal_Spell.TFT_Set13.tex",
    "name": "Essence Flux",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858,1.350000023841858]
      },
      {
        "name": "APDamage",
        "value": [0.0,20.0,30.0,50.0,70.0,0.0,0.0]
      },
      {
        "name": "PercentCenterDamage",
        "value": [2.700000047683716,2.700000047683716,2.700000047683716,2.700000047683716,2.700000047683716,2.700000047683716,2.700000047683716]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [1.35,1.35,1.35] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [20,30,50] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentCenterDamage` | [2.7,2.7,2.7] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_FlyGuy — Scar

来源：`/setData/1/champions/46`；完整记录SHA-256 `4fbfef1c21d82a425badc21f5e7d86b0f6753e4ddc847b4177a77700307055fd`。费用3；现有ID `scar`。

羁绊身份：Firelight → `TFT13_Hoverboard`；Watcher → `TFT13_Watcher`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":800,"initialMana":80,"magicResist":50,"mana":170,"range":1}`。

```json
{
  "apiName": "TFT13_FlyGuy",
  "name": "Scar",
  "cost": 3,
  "traits": ["Firelight","Watcher"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 800.0,
    "initialMana": 80.0,
    "magicResist": 50.0,
    "mana": 170.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Lob bombs at the nearest @NumEnemies@ enemies, Stunning them for <scaleLevel>@StunDuration@</scaleLevel> seconds and dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to each. Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>.",
    "icon": "ASSETS/Characters/TFT13_FlyGuy/HUD/Icons2D/FlyGuy_Spell.TFT_Set13.tex",
    "name": "Sumpsnipe Surprise",
    "variables": [
      {
        "name": "Heal",
        "value": [0.029999999329447746,220.0,240.0,270.0,330.0,0.029999999329447746,0.029999999329447746]
      },
      {
        "name": "NumEnemies",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "StunDuration",
        "value": [1.5,1.5,1.5,1.75,1.75,1.5,1.5]
      },
      {
        "name": "Damage",
        "value": [0.0,80.0,120.0,180.0,240.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Heal` | [220,240,270] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumEnemies` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [1.5,1.5,1.75] | 其他模式；不采用 |
| `Damage` | [80,120,180] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Gangplank — Gangplank

来源：`/setData/1/champions/65`；完整记录SHA-256 `39400ed78b3cc09b963ab45303eb5d52f4d32f5ea67f28652d0381621ef29c41`。费用3；main未实现。

羁绊身份：Scrap → `TFT13_Scrap`；Form Swapper → `TFT13_FormSwapper`；Pit Fighter → `TFT13_Pugilist`。

基础属性审阅值：`{"armor":0,"attackSpeed":0.5,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":700,"initialMana":0,"magicResist":null,"mana":10,"range":1}`。 **Q02：换形载体，MR和双形态实际属性待确认。**

```json
{
  "apiName": "TFT13_Gangplank",
  "name": "Gangplank",
  "cost": 3,
  "traits": ["Scrap","Form Swapper","Pit Fighter"],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.5,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": null,
    "mana": 10.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Restore <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> Health. Then slash, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies in a line. If only one enemy is hit, the damage is&nbsp;doubled.",
    "icon": "ASSETS/Characters/TFT13_Gangplank/HUD/Icons2D/TFT13_Gangplank_Passive.TFT_Set13.tex",
    "name": "Harvest from Flames",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [3.4000000953674316,3.4000000953674316,3.4000000953674316,3.4000000953674316,3.4000000953674316,3.4000000953674316,3.4000000953674316]
      },
      {
        "name": "Heal",
        "value": [100.0,100.0,125.0,150.0,175.0,220.0,220.0]
      },
      {
        "name": "NumBarrels",
        "value": null
      },
      {
        "name": "SingleTargetDamageIncrease",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [3.4,3.4,3.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Heal` | [100,125,150] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumBarrels` | null | unknown/null；Q05 |
| `SingleTargetDamageIncrease` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |

本条null字段：`NumBarrels`；原样保留，不替换0。

### TFT13_Gremlin — Smeech

来源：`/setData/1/champions/38`；完整记录SHA-256 `4ba5faff91b46362ba59f788fd702ed9862a3d6ebc8d9eefe13fc64047627844`。费用3；main未实现。

羁绊身份：Chem-Baron → `TFT13_Crime`；Ambusher → `TFT13_Ambusher`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":70,"hp":800,"initialMana":20,"magicResist":50,"mana":80,"range":1}`。

```json
{
  "apiName": "TFT13_Gremlin",
  "name": "Smeech",
  "cost": 3,
  "traits": ["Chem-Baron","Ambusher"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 70.0,
    "hp": 800.0,
    "initialMana": 20.0,
    "magicResist": 50.0,
    "mana": 80.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Leap towards the enemy with the fewest items within @LeapHexRange@ hexes. Slash @BaseNumStabs@ times, dealing a total of <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. If they die, leap again, dealing @DamageReductionOnLeap*100@% less&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Gremlin/HUD/Icons2D/GremlinSpell.TFT_Set13.tex",
    "name": "Scrap Hacker",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "APDamage",
        "value": [0.0,70.0,105.0,170.0,235.0,0.0,0.0]
      },
      {
        "name": "LeapHexRange",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "BaseNumStabs",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "DamageReductionOnLeap",
        "value": [0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [70,105,170] | 客户端字段；含义按desc，未展开宏见Q03 |
| `LeapHexRange` | [4,4,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BaseNumStabs` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageReductionOnLeap` | [0.3,0.3,0.3] | 其他模式；不采用 |

### TFT13_KogMaw — Kog'Maw

来源：`/setData/1/champions/67`；完整记录SHA-256 `c8d39c638090f7e1375e8066023d704b5f8a9d9b6fea9fb27a95820f347fbae0`。费用3；现有ID `kogmaw`。

羁绊身份：Automata → `TFT13_Hextech`；Sniper → `TFT13_Sniper`。

基础属性审阅值：`{"armor":25,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":15,"hp":650,"initialMana":0,"magicResist":25,"mana":40,"range":4}`。

```json
{
  "apiName": "TFT13_KogMaw",
  "name": "Kog'Maw",
  "cost": 3,
  "traits": ["Automata","Sniper"],
  "stats": {
    "armor": 25.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 15.0,
    "hp": 650.0,
    "initialMana": 0,
    "magicResist": 25.0,
    "mana": 40.0,
    "range": 4.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> Attacks deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> bonus magic&nbsp;damage.<br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@AttackSpeed*100@%</TFTBonus> stacking Attack Speed for the rest of combat. After every @RangeIncreaseNumAttacks@ casts, gain&nbsp;+1&nbsp;Range.",
    "icon": "ASSETS/Characters/TFT13_KogMaw/HUD/Icons2D/TFT13_KogMaw_BioArcaneBarrage.TFT_Set13.tex",
    "name": "Upgrading Barrage Module",
    "variables": [
      {
        "name": "MaxAS",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      },
      {
        "name": "AttackSpeed",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "Duration",
        "value": [60.0,60.0,60.0,60.0,60.0,60.0,60.0]
      },
      {
        "name": "DamageOnAttack",
        "value": [0.0,48.0,72.0,120.0,210.0,0.0,0.0]
      },
      {
        "name": "RangeIncreaseNumAttacks",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `MaxAS` | [20,20,20] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `AttackSpeed` | [0.25,0.25,0.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [60,60,60] | 其他模式；不采用 |
| `DamageOnAttack` | [48,72,120] | 客户端字段；含义按desc，未展开宏见Q03 |
| `RangeIncreaseNumAttacks` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Nami — Nami

来源：`/setData/1/champions/51`；完整记录SHA-256 `3a6ba1e2cc361643322873ff14724d9473b30059edc3775b04b30eee11dfd658`。费用3；现有ID `nami`。

羁绊身份：Emissary → `TFT13_Ambassador`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":25,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":40,"hp":700,"initialMana":0,"magicResist":25,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Nami",
  "name": "Nami",
  "cost": 3,
  "traits": ["Emissary","Sorcerer"],
  "stats": {
    "armor": 25.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 40.0,
    "hp": 700.0,
    "initialMana": 0,
    "magicResist": 25.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Launch a wave at target that bounces @NumBounces@ times to enemies within @SearchRange@ hexes and deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Nami/HUD/Icons2D/NamiW.TFT_Set13.tex",
    "name": "Ocean's Ebb",
    "variables": [
      {
        "name": "NumBounces",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "Damage",
        "value": [75.0,120.0,180.0,290.0,400.0,150.0,150.0]
      },
      {
        "name": "SearchRange",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "TimesHitTarget",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `NumBounces` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Damage` | [120,180,290] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SearchRange` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `TimesHitTarget` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_NunuWillump — Nunu & Willump

来源：`/setData/1/champions/47`；完整记录SHA-256 `38125dda9a9ab8a2c3db5ac3efb591b410b96cd42cb72ed380e8a7023c49c064`。费用3；main未实现。

羁绊身份：Experiment → `TFT13_Experiment`；Bruiser → `TFT13_Bruiser`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":800,"initialMana":60,"magicResist":50,"mana":125,"range":1}`。

```json
{
  "apiName": "TFT13_NunuWillump",
  "name": "Nunu & Willump",
  "cost": 3,
  "traits": ["Experiment","Bruiser","Visionary"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 800.0,
    "initialMana": 60.0,
    "magicResist": 50.0,
    "mana": 125.0,
    "range": 1.0
  },
  "ability": {
    "desc": "For @DamageDuration@ seconds, gain <TFTBonus>@ModifiedDurability@&nbsp;(%i:scaleAP%)</TFTBonus> Durability and create a 2-hex cloud of noxious fumes that deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to enemies within. Afterwards, detonate the cloud and deal <magicDamage>@ModifiedSecondDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to all enemies&nbsp;within.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus: <TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus>After dealing damage, deal <magicDamage enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_NunuCurrentExperimentBonus@%&nbsp;</magicDamage>max&nbsp;%i:scaleHealth% bonus magic&nbsp;damage (@ExperimentICD@s&nbsp;cooldown).</spellActive>",
    "icon": "ASSETS/Characters/TFT13_NunuWillump/HUD/Icons2D/NunuSpell.TFT_Set13.tex",
    "name": "ZOMBIE POWER!!\t\t\t\t\t\t",
    "variables": [
      {
        "name": "Durability",
        "value": [0.5,0.5,0.5,0.550000011920929,0.5,0.5,0.5]
      },
      {
        "name": "Damage",
        "value": [0.0,30.0,45.0,65.0,85.0,0.0,0.0]
      },
      {
        "name": "DamageTicksPerSecond",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "SecondDamage",
        "value": [0.0,150.0,225.0,340.0,455.0,0.0,0.0]
      },
      {
        "name": "DamageDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "HexRadius",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "ExperimentMaxHealthDamage",
        "value": [0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746,0.029999999329447746]
      },
      {
        "name": "ExperimentICD",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Durability` | [0.5,0.5,0.55] | 其他模式；不采用 |
| `Damage` | [30,45,65] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageTicksPerSecond` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondDamage` | [150,225,340] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageDuration` | [3,3,3] | 其他模式；不采用 |
| `HexRadius` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExperimentMaxHealthDamage` | [0.03,0.03,0.03] | 实验条件；Q04 |
| `ExperimentICD` | [1,1,1] | 实验条件；Q04 |

### TFT13_Swain — Swain

来源：`/setData/1/champions/73`；完整记录SHA-256 `fd082e4bb8b26b847e2b0ee0f61042cbda34f68346ca31914b3453d7bf69479c`。费用3；main未实现。

羁绊身份：Conqueror → `TFT13_Warband`；Form Swapper → `TFT13_FormSwapper`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":0,"attackSpeed":0.5,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":650,"initialMana":0,"magicResist":null,"mana":10,"range":1}`。 **Q02：换形载体，MR和双形态实际属性待确认。**

```json
{
  "apiName": "TFT13_Swain",
  "name": "Swain",
  "cost": 3,
  "traits": ["Conqueror","Form Swapper","Sorcerer"],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.5,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 650.0,
    "initialMana": 0,
    "magicResist": null,
    "mana": 10.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and ascend for @Duration@ seconds. While ascended, heal <scaleHealth>@ModifiedHealPerSecond@&nbsp;(%i:scaleAP%)</scaleHealth> and deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent enemies every second. On takedown, the ascension's duration is extended by @BonusDuration@&nbsp;seconds.",
    "icon": "ASSETS/Characters/TFT13_Swain/HUD/Swain_Melee.TFT_Set13.tex",
    "name": "Demonic Ascension",
    "variables": [
      {
        "name": "Heal",
        "value": [0.0,240.0,300.0,380.0,460.0,0.0,0.0]
      },
      {
        "name": "HealPerSecond",
        "value": [0.0,70.0,90.0,125.0,130.0,0.0,0.0]
      },
      {
        "name": "DamagePerSecond",
        "value": [0.0,40.0,60.0,95.0,130.0,0.0,0.0]
      },
      {
        "name": "Duration",
        "value": [6.0,6.0,6.0,6.0,6.0,6.0,6.0]
      },
      {
        "name": "BonusDuration",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Heal` | [240,300,380] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HealPerSecond` | [70,90,125] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamagePerSecond` | [40,60,95] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [6,6,6] | 其他模式；不采用 |
| `BonusDuration` | [2,2,2] | 其他模式；不采用 |

### TFT13_TwistedFate — Twisted Fate

来源：`/setData/1/champions/68`；完整记录SHA-256 `b01874f75df9937ba2c77966da4e41a9458a6f63fa22b4c27c9bfebaadd156ff`。费用3；main未实现。

羁绊身份：Enforcer → `TFT13_Squad`；Quickstriker → `TFT13_Challenger`。

基础属性审阅值：`{"armor":25,"attackSpeed":0.7,"critChance":0.25,"critMultiplier":1.4,"damage":35,"hp":700,"initialMana":25,"magicResist":25,"mana":75,"range":4}`。

```json
{
  "apiName": "TFT13_TwistedFate",
  "name": "Twisted Fate",
  "cost": 3,
  "traits": ["Enforcer","Quickstriker"],
  "stats": {
    "armor": 25.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 35.0,
    "hp": 700.0,
    "initialMana": 25.0,
    "magicResist": 25.0,
    "mana": 75.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Throw 3 cards at different targets.<br><br><spellActive>Blue Card:</spellActive> Restore <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> Health to the lowest Health ally.<br><spellActive>Red Card:</spellActive> Deal <magicDamage>@ModifiedRedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the largest circle of&nbsp;enemies.<br><spellActive>Yellow Card:</spellActive> Deal <magicDamage>@ModifiedYellowDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and Stun them for @StunDuration@&nbsp;second.",
    "icon": "ASSETS/Characters/TFT13_TwistedFate/HUD/Icons2D/Cardmaster_PowerCard.TFT_Set13.tex",
    "name": "Wild Cards",
    "variables": [
      {
        "name": "BlueHeal",
        "value": [0.0,90.0,110.0,140.0,170.0,0.0,0.0]
      },
      {
        "name": "RedDamage",
        "value": [0.0,110.0,165.0,255.0,345.0,0.0,0.0]
      },
      {
        "name": "YellowDamage",
        "value": [0.0,230.0,345.0,535.0,725.0,0.0,0.0]
      },
      {
        "name": "StunDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `BlueHeal` | [90,110,140] | 客户端字段；含义按desc，未展开宏见Q03 |
| `RedDamage` | [110,165,255] | 客户端字段；含义按desc，未展开宏见Q03 |
| `YellowDamage` | [230,345,535] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StunDuration` | [1,1,1] | 其他模式；不采用 |

### TFT13_Ambessa — Ambessa

来源：`/setData/1/champions/61`；完整记录SHA-256 `b26acb3fef5f3fce9b3b97dfd39b2da294c64b13108a87a686ca6a047803806c`。费用4；main未实现。

羁绊身份：Emissary → `TFT13_Ambassador`；Conqueror → `TFT13_Warband`；Quickstriker → `TFT13_Challenger`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":65,"hp":1100,"initialMana":40,"magicResist":50,"mana":90,"range":1}`。

```json
{
  "apiName": "TFT13_Ambessa",
  "name": "Ambessa",
  "cost": 4,
  "traits": ["Emissary","Conqueror","Quickstriker"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 65.0,
    "hp": 1100.0,
    "initialMana": 40.0,
    "magicResist": 50.0,
    "mana": 90.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Ambessa switches between two stances on cast:<br><br><spellPassive>Chains:</spellPassive> Gain +1 Range. Attacks deal <physicalDamage>@ModifiedChainDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical&nbsp;damage.<br>On cast, dash to target and strike in a half-circle, dealing <physicalDamage>@ModifiedStrikeDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies&nbsp;hit.<br><br><spellPassive>Fists:</spellPassive> Gain <TFTBonus>@ModifiedOmnivamp@&nbsp;(%i:scaleAP%)</TFTBonus> Omnivamp and attack twice as&nbsp;fast.<br>On cast, briefly Stun target before slamming them into the ground, dealing <physicalDamage>@ModifiedSlamDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage, then dash&nbsp;away.<br>",
    "icon": "ASSETS/Characters/TFT13_Ambessa/HUD/Icons2D/Ambessa_Spell.TFT_Set13.tex",
    "name": "Unrelenting Huntress",
    "variables": [
      {
        "name": "PercentChainAttackAD",
        "value": [1.5,1.5,1.5,3.5,4.0,1.5,1.5]
      },
      {
        "name": "PercentStrikeAD",
        "value": [2.0999999046325684,2.5,2.5,5.0,6.0,2.5,2.5]
      },
      {
        "name": "PercentOmnivamp",
        "value": [0.15000000596046448,0.25,0.25,0.44999998807907104,0.6000000238418579,0.15000000596046448,0.15000000596046448]
      },
      {
        "name": "AttackSpeed",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "SlamDamageAD",
        "value": [5.0,5.0,5.0,12.0,15.0,6.0,6.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentChainAttackAD` | [1.5,1.5,3.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentStrikeAD` | [2.5,2.5,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentOmnivamp` | [0.25,0.25,0.45] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AttackSpeed` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SlamDamageAD` | [5,5,12] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Corki — Corki

来源：`/setData/1/champions/52`；完整记录SHA-256 `2a6191428bda3efaffbada5b510959b11d8a03aab090d92ecae0682b11a8ae12`。费用4；现有ID `corki`。

羁绊身份：Scrap → `TFT13_Scrap`；Artillerist → `TFT13_Martialist`。

基础属性审阅值：`{"armor":30,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":65,"hp":850,"initialMana":0,"magicResist":30,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Corki",
  "name": "Corki",
  "cost": 4,
  "traits": ["Scrap","Artillerist"],
  "stats": {
    "armor": 30.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 65.0,
    "hp": 850.0,
    "initialMana": 0,
    "magicResist": 30.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Lock onto target and strafe to a nearby position, unleashing <scaleLevel>@BaseMissiles@</scaleLevel> missiles split between the target and all enemies within two hexes. Each missile deals <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and reduces Armor by&nbsp;@FlatArmorShred@.<br><br>Every @SpecialMissileNum@th missile deals <physicalDamage>@ModifiedSpecialDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and reduces Armor by&nbsp;@SpecialMissileArmorReduction@.",
    "icon": "ASSETS/Characters/TFT13_Corki/HUD/Icons2D/Corki_RapidReload.TFT_Set13.tex",
    "name": "Broadside Barrage",
    "variables": [
      {
        "name": "BaseMissiles",
        "value": [21.0,21.0,21.0,35.0,35.0,21.0,21.0]
      },
      {
        "name": "PercentAD",
        "value": [0.4000000059604645,0.3499999940395355,0.3499999940395355,0.6000000238418579,0.699999988079071,0.5,0.5]
      },
      {
        "name": "FlatArmorShred",
        "value": [2.0,1.0,1.0,1.0,2.0,2.0,2.0]
      },
      {
        "name": "SpecialMissileNum",
        "value": [7.0,7.0,7.0,7.0,7.0,7.0,7.0]
      },
      {
        "name": "SpecialMissileMult",
        "value": [7.0,7.0,7.0,7.0,7.0,7.0,7.0]
      },
      {
        "name": "MissilesPerLaunchAttack",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "FlatDamagePerMissile",
        "value": [0.0,6.0,9.0,36.0,0.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `BaseMissiles` | [21,21,35] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAD` | [0.35,0.35,0.6] | 客户端字段；含义按desc，未展开宏见Q03 |
| `FlatArmorShred` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SpecialMissileNum` | [7,7,7] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SpecialMissileMult` | [7,7,7] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MissilesPerLaunchAttack` | [5,5,5] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `FlatDamagePerMissile` | [6,9,36] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_DrMundo — Dr. Mundo

来源：`/setData/1/champions/21`；完整记录SHA-256 `e1c26ab3d70738fc2530823726a7cd2dcc42f1dcb4a34951d1a48a1d1f61b887`。费用4；main未实现。

羁绊身份：Experiment → `TFT13_Experiment`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":1100,"initialMana":30,"magicResist":60,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_DrMundo",
  "name": "Dr. Mundo",
  "cost": 4,
  "traits": ["Experiment","Dominator"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 1100.0,
    "initialMana": 30.0,
    "magicResist": 60.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Become energized and heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleHealth%%i:scaleAP%)</scaleHealth> over @Duration@ seconds. While energized, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to a nearby enemy each second. Afterwards, deal <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleHealth%)</magicDamage> magic damage to all enemies within 2&nbsp;hexes.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus: <TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus>Gain <scaleHealth enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_DrMundoBaseHealthExperimentBonus@</scaleHealth> max Health. On each takedown, gain <scaleHealth enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_DrMundoCurrentExperimentBonus@</scaleHealth> more max&nbsp;Health.</spellActive>",
    "icon": "ASSETS/Characters/TFT13_DrMundo/HUD/Icons2D/DrMundo_E.TFT_Set13.tex",
    "name": "Maximum Dosage",
    "variables": [
      {
        "name": "PercentHealthHeal",
        "value": [0.18000000715255737,0.18000000715255737,0.18000000715255737,0.18000000715255737,0.18000000715255737,0.18000000715255737,0.18000000715255737]
      },
      {
        "name": "APHeal",
        "value": [0.0,650.0,750.0,2500.0,3500.0,0.0,0.0]
      },
      {
        "name": "PercentofHealImmediately",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "Duration",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "APDamage",
        "value": [0.0,120.0,180.0,1000.0,1200.0,0.0,0.0]
      },
      {
        "name": "PercentHealthDamage",
        "value": [0.15000000596046448,0.07000000029802322,0.07000000029802322,0.3499999940395355,0.5,0.25,0.25]
      },
      {
        "name": "ExperimentHealthGain",
        "value": [60.0,60.0,60.0,60.0,60.0,60.0,60.0]
      },
      {
        "name": "BaseExperimentHealthGain",
        "value": [120.0,120.0,120.0,120.0,120.0,120.0,120.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentHealthHeal` | [0.18,0.18,0.18] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APHeal` | [650,750,2500] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentofHealImmediately` | [0.4,0.4,0.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Duration` | [2,2,2] | 其他模式；不采用 |
| `APDamage` | [120,180,1000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentHealthDamage` | [0.07,0.07,0.35] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExperimentHealthGain` | [60,60,60] | 实验条件；Q04 |
| `BaseExperimentHealthGain` | [120,120,120] | 实验条件；Q04 |

### TFT13_Ekko — Ekko

来源：`/setData/1/champions/18`；完整记录SHA-256 `55f0823165c55ebf71b974cd7b4896735345b9096ff5b9a146f4a32fb421f832`。费用4；main未实现。

羁绊身份：Firelight → `TFT13_Hoverboard`；Scrap → `TFT13_Scrap`；Ambusher → `TFT13_Ambusher`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.85,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":1100,"initialMana":0,"magicResist":60,"mana":60,"range":1}`。

```json
{
  "apiName": "TFT13_Ekko",
  "name": "Ekko",
  "cost": 4,
  "traits": ["Firelight","Scrap","Ambusher"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.8500000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 1100.0,
    "initialMana": 0,
    "magicResist": 60.0,
    "mana": 60.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Summon an assault of afterimages that deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the target and <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to <scaleLevel>@NumBonusEnemies@</scaleLevel> other nearby&nbsp;enemies. Afterimages reduce their target's Magic Resist by @ShredAmount@ for the rest of combat.",
    "icon": "ASSETS/Characters/TFT13_Ekko/HUD/Icons2D/EkkoSpell.TFT_Set13.tex",
    "name": "Splitting Seconds",
    "variables": [
      {
        "name": "NumAfterimages",
        "value": [12.0,12.0,12.0,25.0,25.0,12.0,12.0]
      },
      {
        "name": "NumBonusEnemies",
        "value": [2.0,2.0,2.0,4.0,4.0,3.0,3.0]
      },
      {
        "name": "TargetDamage",
        "value": [0.0,290.0,435.0,1200.0,2000.0,0.0,0.0]
      },
      {
        "name": "SecondaryDamage",
        "value": [0.0,145.0,215.0,450.0,600.0,0.0,0.0]
      },
      {
        "name": "SpellTime",
        "value": [1.5,1.5,1.5,1.5,1.5,1.5,1.5]
      },
      {
        "name": "ShredAmount",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `NumAfterimages` | [12,12,25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumBonusEnemies` | [2,2,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `TargetDamage` | [300,450,1200] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondaryDamage` | [150,225,450] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SpellTime` | [1.5,1.5,1.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShredAmount` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Elise — Elise

来源：`/setData/1/champions/31`；完整记录SHA-256 `cdba65904bd42b804a509c39483fe326fc7de31b369777f599d65cef8fd0780e`。费用4；main未实现。

羁绊身份：Black Rose → `TFT13_Cabal`；Form Swapper → `TFT13_FormSwapper`；Bruiser → `TFT13_Bruiser`。

基础属性审阅值：`{"armor":0,"attackSpeed":0.5,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":750,"initialMana":0,"magicResist":null,"mana":10,"range":1}`。 **Q02：换形载体，MR和双形态实际属性待确认。**

```json
{
  "apiName": "TFT13_Elise",
  "name": "Elise",
  "cost": 4,
  "traits": ["Black Rose","Form Swapper","Bruiser"],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.5,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 750.0,
    "initialMana": 0,
    "magicResist": null,
    "mana": 10.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Jump to a nearby hex and web all enemies within @HexRadius@ hexes, Stunning them for @StunDuration@ seconds and dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>.",
    "icon": "ASSETS/Characters/TFT13_Elise/HUD/Icons2D/Elise_Melee.TFT_Set13.tex",
    "name": "Cocoon",
    "variables": [
      {
        "name": "StunDuration",
        "value": [1.5,1.75,2.0,8.0,12.0,2.5,2.5]
      },
      {
        "name": "SearchRange",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "Damage",
        "value": [0.0,120.0,180.0,1200.0,2000.0,0.0,0.0]
      },
      {
        "name": "HexRadius",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "FlatHealth",
        "value": [0.0,400.0,450.0,2000.0,2500.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `StunDuration` | [1.75,2,8] | 其他模式；不采用 |
| `SearchRange` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Damage` | [120,180,1200] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HexRadius` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `FlatHealth` | [400,450,2000] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Garen — Garen

来源：`/setData/1/champions/55`；完整记录SHA-256 `72dbc8aa890ed0dc77b97138aa31131f9193991422b97dfcbda79d2ec8c89c55`。费用4；现有ID `garen`。

羁绊身份：Emissary → `TFT13_Ambassador`；Watcher → `TFT13_Watcher`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.6,"critChance":0.25,"critMultiplier":1.4,"damage":65,"hp":1000,"initialMana":60,"magicResist":60,"mana":125,"range":1}`。

```json
{
  "apiName": "TFT13_Garen",
  "name": "Garen",
  "cost": 4,
  "traits": ["Emissary","Watcher"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.6000000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 65.0,
    "hp": 1000.0,
    "initialMana": 60.0,
    "magicResist": 60.0,
    "mana": 125.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> After dealing damage, heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleHealth%).</scaleHealth><br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleHealth%%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Slam a massive sword on target, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to them and <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies within 2&nbsp;hexes. ",
    "icon": "ASSETS/Characters/TFT13_Garen/HUD/Icons2D/TFT13_Garen_SpellIcon.TFT_Set13.tex",
    "name": "Demacian Justice",
    "variables": [
      {
        "name": "APShield",
        "value": [100.0,200.0,220.0,1500.0,2000.0,100.0,100.0]
      },
      {
        "name": "PercentHealthShield",
        "value": [0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448]
      },
      {
        "name": "ShieldDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "ADRatio",
        "value": [6.0,2.5,2.5,15.0,25.0,6.0,6.0]
      },
      {
        "name": "SecondaryADRatio",
        "value": [3.0,1.25,1.25,7.5,12.5,3.0,3.0]
      },
      {
        "name": "HealPercentHealth",
        "value": [0.014999999664723873,0.014999999664723873,0.014999999664723873,0.05000000074505806,0.07999999821186066,0.014999999664723873,0.014999999664723873]
      },
      {
        "name": "PassiveDamagePercent",
        "value": null
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `APShield` | [200,220,1500] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentHealthShield` | [0.15,0.15,0.15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [4,4,4] | 其他模式；不采用 |
| `ADRatio` | [2.5,2.5,15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SecondaryADRatio` | [1.25,1.25,7.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HealPercentHealth` | [0.015,0.015,0.05] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PassiveDamagePercent` | null | unknown/null；Q05 |

本条null字段：`PassiveDamagePercent`；原样保留，不替换0。

### TFT13_Heimerdinger — Heimerdinger

来源：`/setData/1/champions/33`；完整记录SHA-256 `8a159304136a02990cbdc0aa13f9f54f462c429489690ddfe60f362fc33d5f84`。费用4；main未实现。

羁绊身份：Academy → `TFT13_Academy`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":30,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":40,"hp":800,"initialMana":0,"magicResist":30,"mana":40,"range":4}`。

```json
{
  "apiName": "TFT13_Heimerdinger",
  "name": "Heimerdinger",
  "cost": 4,
  "traits": ["Academy","Visionary"],
  "stats": {
    "armor": 30.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 40.0,
    "hp": 800.0,
    "initialMana": 0,
    "magicResist": 30.0,
    "mana": 40.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Fire <scaleLevel>@StartingRockets@</scaleLevel> missiles at random enemies that deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. Each cast fires @MissileIncreasePerCast@ more missile than the&nbsp;last.",
    "icon": "ASSETS/Characters/TFT13_Heimerdinger/HUD/Icons2D/Heimerdinger_Spell.TFT_Set13.tex",
    "name": "PROGRESSSSS!",
    "variables": [
      {
        "name": "Damage",
        "value": [50.0,50.0,75.0,225.0,400.0,325.0,325.0]
      },
      {
        "name": "StartingRockets",
        "value": [9.0,5.0,5.0,7.0,7.0,9.0,9.0]
      },
      {
        "name": "NumOfCastsToIncreaseMissiles",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "MissileIncreasePerCast",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "PercentOfMissileToFocusOnTarget",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "AdditionalTargetRowDifferential",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [50,75,225] | 客户端字段；含义按desc，未展开宏见Q03 |
| `StartingRockets` | [5,5,7] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumOfCastsToIncreaseMissiles` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MissileIncreasePerCast` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentOfMissileToFocusOnTarget` | [0.5,0.5,0.5] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `AdditionalTargetRowDifferential` | [2,2,2] | 内部参数/活跃性或单位需证实；Q03/Q05 |

### TFT13_Illaoi — Illaoi

来源：`/setData/1/champions/26`；完整记录SHA-256 `1de4bf54d936d8cc348777509fce9156f58989a0515d6962215075741753e437`。费用4；main未实现。

羁绊身份：Rebel → `TFT13_Rebel`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.65,"critChance":0.25,"critMultiplier":1.4,"damage":70,"hp":1100,"initialMana":65,"magicResist":60,"mana":125,"range":1}`。

```json
{
  "apiName": "TFT13_Illaoi",
  "name": "Illaoi",
  "cost": 4,
  "traits": ["Rebel","Sentinel"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.6499999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 70.0,
    "hp": 1100.0,
    "initialMana": 65.0,
    "magicResist": 60.0,
    "mana": 125.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Gain <TFTBonus>@DR*100@%</TFTBonus> Durability for @SpellDuration@ seconds. Over the duration, drain <trueDamage>@ModifiedHealthSteal@&nbsp;(%i:scaleAP%)</trueDamage> Health from the nearest <scaleLevel>@NumEnemies@</scaleLevel> enemies. Then slam down, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleArmor%%i:scaleMR%)</magicDamage> magic damage to all enemies within 2&nbsp;hexes.",
    "icon": "ASSETS/Characters/TFT13_Illaoi/HUD/Icons2D/Illaoi_E_Debuff.TFT_Set13.tex",
    "name": "Test of Spirit",
    "variables": [
      {
        "name": "SpellDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "HealthSteal",
        "value": [200.0,50.0,75.0,225.0,225.0,200.0,200.0]
      },
      {
        "name": "NumEnemies",
        "value": [4.0,4.0,4.0,10.0,10.0,4.0,4.0]
      },
      {
        "name": "PercentBonusHealthSteal",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "DR",
        "value": [0.4000000059604645,0.5,0.5,0.8999999761581421,0.8999999761581421,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "DamageResistRatio",
        "value": [0.0,0.6000000238418579,0.8999999761581421,7.0,10.0,0.0,0.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `SpellDuration` | [3,3,3] | 其他模式；不采用 |
| `HealthSteal` | [50,75,225] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumEnemies` | [4,4,10] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentBonusHealthSteal` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DR` | [0.5,0.5,0.9] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageResistRatio` | [0.6,0.9,7] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Silco — Silco

来源：`/setData/1/champions/13`；完整记录SHA-256 `e41fbd640359f69a6b9356d2a257fbafd698d5f5482ba4f30340d08d9f879369`。费用4；main未实现。

羁绊身份：Chem-Baron → `TFT13_Crime`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":30,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":40,"hp":800,"initialMana":30,"magicResist":30,"mana":80,"range":4}`。

```json
{
  "apiName": "TFT13_Silco",
  "name": "Silco",
  "cost": 4,
  "traits": ["Chem-Baron","Dominator"],
  "stats": {
    "armor": 30.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 40.0,
    "hp": 800.0,
    "initialMana": 30.0,
    "magicResist": 30.0,
    "mana": 80.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Throw a canister at target, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to them and releasing <scaleLevel>@MinionsSpawned@</scaleLevel> monstrosities. Monstrosities attack @MinionNumAttacks@ times and deal <magicDamage>@ModifiedMinionDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage per&nbsp;attack.",
    "icon": "ASSETS/Characters/TFT13_Silco/HUD/Icons2D/TFT6_Silco_EyeOfTheStorm.TFT_Set13.tex",
    "name": "Canned Monstrosity",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,100.0,200.0,1000.0,2000.0,5.0,6.0]
      },
      {
        "name": "MinionsSpawned",
        "value": [4.0,4.0,4.0,8.0,8.0,8.0,8.0]
      },
      {
        "name": "MinionsThatAttackCurrentTarget",
        "value": [0.0,2.0,2.0,4.0,0.0,0.0,0.0]
      },
      {
        "name": "MinionDamage",
        "value": [30.0,38.0,57.0,100.0,120.0,6.0,6.0]
      },
      {
        "name": "MinionDuration",
        "value": [12.0,12.0,12.0,12.0,12.0,12.0,12.0]
      },
      {
        "name": "MinionNumAttacks",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [100,200,1000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinionsSpawned` | [4,4,8] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinionsThatAttackCurrentTarget` | [2,2,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinionDamage` | [36,55,100] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinionDuration` | [12,12,12] | 其他模式；不采用 |
| `MinionNumAttacks` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Twitch — Twitch

来源：`/setData/1/champions/22`；完整记录SHA-256 `c8a767819c1230486789127f1fd99897e29cf4c9962e2f0a4fe64c93a1697866`。费用4；main未实现。

羁绊身份：Experiment → `TFT13_Experiment`；Sniper → `TFT13_Sniper`。

基础属性审阅值：`{"armor":30,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":70,"hp":800,"initialMana":0,"magicResist":30,"mana":60,"range":6}`。

```json
{
  "apiName": "TFT13_Twitch",
  "name": "Twitch",
  "cost": 4,
  "traits": ["Experiment","Sniper"],
  "stats": {
    "armor": 30.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 70.0,
    "hp": 800.0,
    "initialMana": 0,
    "magicResist": 30.0,
    "mana": 60.0,
    "range": 6.0
  },
  "ability": {
    "desc": "For the next @TotalAttacks@ attacks, gain <TFTBonus>@AttackSpeed*100@%</TFTBonus> Attack Speed, infinite range, and replace attacks with a piercing bolt that targets random enemies. Bolts deal <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage, reduced by @DamageReduction*100@% for each enemy they pass&nbsp;through.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus: <TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus>After every <TFTBonus enabled=TFT13_ExperimentActive alternate=rules>@ExperimentDamageTicks@</TFTBonus> attacks, deal physical damage to the nearest enemy equal to <physicalDamage enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_TwitchCurrentExperimentBonus@%</physicalDamage> of their max&nbsp;Health.</spellActive>",
    "icon": "ASSETS/Characters/TFT13_Twitch/HUD/Icons_2D/Twitch_R.TFT_Set13.tex",
    "name": "Spray and Pray",
    "variables": [
      {
        "name": "TotalAttacks",
        "value": [8.0,8.0,8.0,8.0,8.0,8.0,8.0]
      },
      {
        "name": "AttackSpeed",
        "value": [0.8500000238418579,0.8500000238418579,0.8500000238418579,0.8500000238418579,0.8500000238418579,0.8500000238418579,0.8500000238418579]
      },
      {
        "name": "APDamage",
        "value": [4.0,18.0,25.0,120.0,200.0,4.0,4.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [1.5,1.399999976158142,1.399999976158142,3.0,4.0,1.5,1.5]
      },
      {
        "name": "DamageReduction",
        "value": [0.6000000238418579,0.4000000059604645,0.4000000059604645,0.20000000298023224,0.10000000149011612,0.6000000238418579,0.6000000238418579]
      },
      {
        "name": "ExperimentDamageTicks",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "ExperimentMaxHealthDamage",
        "value": [0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448,0.15000000596046448]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `TotalAttacks` | [8,8,8] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AttackSpeed` | [0.85,0.85,0.85] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [18,25,120] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage` | [1.4,1.4,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageReduction` | [0.4,0.4,0.2] | 其他模式；不采用 |
| `ExperimentDamageTicks` | [5,5,5] | 实验条件；Q04 |
| `ExperimentMaxHealthDamage` | [0.15,0.15,0.15] | 实验条件；Q04 |

### TFT13_Vi — Vi

来源：`/setData/1/champions/16`；完整记录SHA-256 `49e7819dd4a73374aa575bac0ccf49ffc18d17ad89cda09534ed4d60002a5d6f`。费用4；main未实现。

羁绊身份：Enforcer → `TFT13_Squad`；Pit Fighter → `TFT13_Pugilist`。

基础属性审阅值：`{"armor":50,"attackSpeed":0.85,"critChance":0.25,"critMultiplier":1.4,"damage":75,"hp":1100,"initialMana":40,"magicResist":50,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_Vi",
  "name": "Vi",
  "cost": 4,
  "traits": ["Enforcer","Pit Fighter"],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.8500000238418579,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 75.0,
    "hp": 1100.0,
    "initialMana": 40.0,
    "magicResist": 50.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds, then Stun target for @StunDuration@ seconds. Slam them down, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to them and causing a shockwave in their row. Enemies hit take <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and are briefly knocked&nbsp;up.",
    "icon": "ASSETS/Characters/TFT13_Vi/HUD/ViR.TFT_Set13.tex",
    "name": "Wrecking Crew",
    "variables": [
      {
        "name": "Shield",
        "value": [2.0,280.0,325.0,1200.0,1200.0,2.0,2.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [0.0,6.0,6.0,12.0,15.0,3.299999952316284,3.299999952316284]
      },
      {
        "name": "PercentAttackDamage_SecondaryDamage",
        "value": [1.5,1.7999999523162842,1.7999999523162842,5.0,7.0,4.0,4.0]
      },
      {
        "name": "ShieldDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "StunDuration",
        "value": [1.5,1.5,1.5,1.5,1.5,1.5,1.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Shield` | [280,325,1200] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage` | [6,6,12] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage_SecondaryDamage` | [1.8,1.8,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [3,3,3] | 其他模式；不采用 |
| `StunDuration` | [1.5,1.5,1.5] | 其他模式；不采用 |

### TFT13_Zoe — Zoe

来源：`/setData/1/champions/76`；完整记录SHA-256 `23fd1634ccca8d44ff6474b14cbbeab720d77c21baddd44a998c82c55ad1f168`。费用4；现有ID `zoe`。

羁绊身份：Rebel → `TFT13_Rebel`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":30,"attackSpeed":0.75,"critChance":0.25,"critMultiplier":1.4,"damage":40,"hp":800,"initialMana":20,"magicResist":30,"mana":80,"range":4}`。

```json
{
  "apiName": "TFT13_Zoe",
  "name": "Zoe",
  "cost": 4,
  "traits": ["Rebel","Sorcerer"],
  "stats": {
    "armor": 30.0,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 40.0,
    "hp": 800.0,
    "initialMana": 20.0,
    "magicResist": 30.0,
    "mana": 80.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Launch a star at target that deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. It bounces to the farthest enemy within @HexLimiter@ hexes, then bounces back to the target. This effect repeats @NumRepeats@ times, hitting a different enemy each&nbsp;time.",
    "icon": "ASSETS/Characters/TFT13_Zoe/HUD/Icons2D/TFT13_Zoe_Q2.TFT_Set13.tex",
    "name": "Paddle Star!",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,140.0,210.0,450.0,700.0,0.0,0.0]
      },
      {
        "name": "NumRepeats",
        "value": [2.0,2.0,2.0,4.0,4.0,2.0,2.0]
      },
      {
        "name": "HexLimiter",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [140,210,450] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumRepeats` | [2,2,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HexLimiter` | [4,4,4] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Caitlyn — Caitlyn

来源：`/setData/1/champions/17`；完整记录SHA-256 `1b7d3fe9dc909b783e17fa07b3f396d402526a2ded6df8cfadcdc3c8868a63e0`。费用5；现有ID `caitlyn`。

羁绊身份：Enforcer → `TFT13_Squad`；Sniper → `TFT13_Sniper`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.55,"critChance":0.25,"critMultiplier":1.4,"damage":82,"hp":900,"initialMana":0,"magicResist":40,"mana":50,"range":13}`。

```json
{
  "apiName": "TFT13_Caitlyn",
  "name": "Caitlyn",
  "cost": 5,
  "traits": ["Enforcer","Sniper"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.550000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 82.0,
    "hp": 900.0,
    "initialMana": 0,
    "magicResist": 40.0,
    "mana": 50.0,
    "range": 13.0
  },
  "ability": {
    "desc": "Enter a sniper's stance and call in an airship that circles the battlefield for @RaidDuration@ seconds, dropping @TotalShots@ bombs at a random cluster of enemies over the duration. Bombs deal <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%&nbsp;%i:scaleAP%)</physicalDamage> physical damage in a one-hex&nbsp;circle.<br><br>Whenever an enemy is caught in the epicenter of an Air Raid blast, reduce their Armor and Magic Resist by @ResistReduction@ and fire a shot towards them, dealing <physicalDamage>@HeadshotDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical&nbsp;damage.",
    "icon": "ASSETS/Characters/TFT13_Caitlyn/HUD/Icons2D/Caitlyn_Headshot.TFT_Set13.tex",
    "name": "Air Raid",
    "variables": [
      {
        "name": "RaidDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "TotalShots",
        "value": [4.0,4.0,4.0,20.0,4.0,4.0,4.0]
      },
      {
        "name": "PercentAttackDamage",
        "value": [2.0,1.7999999523162842,1.7999999523162842,7.5,2.0,2.0,2.0]
      },
      {
        "name": "APDamage",
        "value": [80.0,20.0,30.0,100.0,200.0,80.0,80.0]
      },
      {
        "name": "HeadshotPercentAD",
        "value": [2.0,2.799999952316284,2.799999952316284,13.5,13.5,2.4000000953674316,2.4000000953674316]
      },
      {
        "name": "BonusSearchRange",
        "value": [630.0,630.0,630.0,630.0,630.0,630.0,630.0]
      },
      {
        "name": "PercentShotsFocusedOnFrontline",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "ResistReduction",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `RaidDuration` | [5,5,5] | 其他模式；不采用 |
| `TotalShots` | [4,4,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentAttackDamage` | [1.8,1.8,7.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APDamage` | [20,30,100] | 客户端字段；含义按desc，未展开宏见Q03 |
| `HeadshotPercentAD` | [2.8,2.8,13.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BonusSearchRange` | [630,630,630] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `PercentShotsFocusedOnFrontline` | [0.5,0.5,0.5] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `ResistReduction` | [20,20,20] | 其他模式；不采用 |

### TFT13_Jayce — Jayce

来源：`/setData/1/champions/34`；完整记录SHA-256 `d71a3d830a7516494a085d638e5809abf2a6c84878fa9537402b0e026f59ff52`。费用5；main未实现。

羁绊身份：Academy → `TFT13_Academy`；Form Swapper → `TFT13_FormSwapper`。

基础属性审阅值：`{"armor":0,"attackSpeed":0.5,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":900,"initialMana":0,"magicResist":null,"mana":10,"range":1}`。 **Q02：换形载体，MR和双形态实际属性待确认。**

```json
{
  "apiName": "TFT13_Jayce",
  "name": "Jayce",
  "cost": 5,
  "traits": ["Academy","Form Swapper"],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.5,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 900.0,
    "initialMana": 0,
    "magicResist": null,
    "mana": 10.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> Summon a placeable Hextech Forge. On cast, the @NumAlliesShield@ allies closest to it gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. If it's dead, revive it with <TFTBonus>@ReducedSummonHealth*100@%</TFTBonus>&nbsp;Health.<br><br><spellActive>Active:</spellActive> Summon 2 Hexgates and knock target into one of them, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and sending them flying back to their original position. While flying, they deal <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all other enemies in the&nbsp;path.",
    "icon": "ASSETS/Characters/TFT13_Jayce/HUD/Icons2D/Jayce_Melee.TFT_Set13.tex",
    "name": "Special Delivery",
    "variables": [
      {
        "name": "PercentAttackDamage",
        "value": [0.0,5.0,5.0,20.0,0.0,0.0,0.0]
      },
      {
        "name": "PercentADSecondaryDamage",
        "value": [0.0,2.25,2.25,15.0,0.0,0.0,0.0]
      },
      {
        "name": "NumAlliesShield",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "Shield",
        "value": [0.0,200.0,275.0,1800.0,0.0,0.0,0.0]
      },
      {
        "name": "ShieldDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "InitialGateDistanceBehindTheTarget",
        "value": [480.0,480.0,480.0,480.0,480.0,480.0,480.0]
      },
      {
        "name": "EnemyFlightDuration",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      },
      {
        "name": "FlyingEnemyDamageRadius",
        "value": [290.0,290.0,290.0,290.0,290.0,290.0,290.0]
      },
      {
        "name": "MaxEnemySpeed",
        "value": [2300.0,2300.0,2300.0,2300.0,2300.0,2300.0,2300.0]
      },
      {
        "name": "MinEnemySpeed",
        "value": [1650.0,1650.0,1650.0,1650.0,1650.0,1650.0,1650.0]
      },
      {
        "name": "ReducedSummonHealth",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `PercentAttackDamage` | [5,5,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentADSecondaryDamage` | [2.25,2.25,15] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumAlliesShield` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Shield` | [200,275,1800] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldDuration` | [4,4,4] | 其他模式；不采用 |
| `InitialGateDistanceBehindTheTarget` | [480,480,480] | 客户端字段；含义按desc，未展开宏见Q03 |
| `EnemyFlightDuration` | [0.75,0.75,0.75] | 其他模式；不采用 |
| `FlyingEnemyDamageRadius` | [290,290,290] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MaxEnemySpeed` | [2300,2300,2300] | 客户端字段；含义按desc，未展开宏见Q03 |
| `MinEnemySpeed` | [1650,1650,1650] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ReducedSummonHealth` | [1,1,1] | 其他模式；不采用 |

### TFT13_Jinx — Jinx

来源：`/setData/1/champions/48`；完整记录SHA-256 `ec194cdb6af4810899246ac4ff9006a7bdc4b5a0e92b1ed6c84da12ce8b50396`。费用5；main未实现。

羁绊身份：Rebel → `TFT13_Rebel`；Ambusher → `TFT13_Ambusher`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":900,"initialMana":0,"magicResist":40,"mana":60,"range":4}`。

```json
{
  "apiName": "TFT13_Jinx",
  "name": "Jinx",
  "cost": 5,
  "traits": ["Rebel","Ambusher"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 900.0,
    "initialMana": 0,
    "magicResist": 40.0,
    "mana": 60.0,
    "range": 4.0
  },
  "ability": {
    "desc": "<tftrules>Jinx alternates between Zap, Flame Chompers, and Death Rocket for her&nbsp;ability.</tftrules><br><br><spellActive>Zap:</spellActive> Deal <physicalDamage>@ZapModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies in a line and Stun them for <scaleLevel>@ZapStunDuration@</scaleLevel>&nbsp;seconds.<br><spellActive>Flame Chompers:</spellActive> Deal <physicalDamage>@FlameChompersModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to @NumOfFlameChompers@ 1-hex circles of&nbsp;enemies.<br><spellActive>Death Rocket:</spellActive> Fire a rocket at the center of the board that <physicalDamage>@DeathRocketModifiedDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</physicalDamage> physical damage to ALL enemies, reduced by @FalloffPercent*100@% for each hex they are away from the epicenter.",
    "icon": "ASSETS/Characters/TFT13_Jinx/HUD/Icons2D/Jinx_P.TFT_Set13.tex",
    "name": "Ruin Everything",
    "variables": [
      {
        "name": "NumOfFlameChompers",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "FlameChompersPercentAD",
        "value": [0.0,2.6500000953674316,2.6500000953674316,20.0,30.0,0.0,0.0]
      },
      {
        "name": "ZapPercentAD",
        "value": [0.0,2.6500000953674316,2.6500000953674316,20.0,30.0,0.0,0.0]
      },
      {
        "name": "ZapStunDuration",
        "value": [1.5,1.25,1.5,10.0,10.0,1.5,1.5]
      },
      {
        "name": "ZapLength",
        "value": [2500.0,2500.0,2500.0,2500.0,2500.0,2500.0,2500.0]
      },
      {
        "name": "ZapWidth",
        "value": [180.0,180.0,180.0,180.0,180.0,180.0,180.0]
      },
      {
        "name": "DeathRocketPercentAD",
        "value": [0.0,7.0,7.0,90.01000213623047,90.0199966430664,0.0,0.0]
      },
      {
        "name": "DeathRocketAP",
        "value": [0.0,60.0,90.0,300.0,600.0,0.0,0.0]
      },
      {
        "name": "DeathRocketHexes",
        "value": [6.0,6.0,6.0,6.0,6.0,6.0,6.0]
      },
      {
        "name": "FalloffPercent",
        "value": [0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `NumOfFlameChompers` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `FlameChompersPercentAD` | [2.65,2.65,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ZapPercentAD` | [2.65,2.65,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ZapStunDuration` | [1.25,1.5,10] | 其他模式；不采用 |
| `ZapLength` | [2500,2500,2500] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ZapWidth` | [180,180,180] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DeathRocketPercentAD` | [7,7,90.01] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DeathRocketAP` | [60,90,300] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DeathRocketHexes` | [6,6,6] | 客户端字段；含义按desc，未展开宏见Q03 |
| `FalloffPercent` | [0.1,0.1,0.1] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_LeBlanc — LeBlanc

来源：`/setData/1/champions/32`；完整记录SHA-256 `a90bde400bd72766b8ce2fbd01137459eeefd9e3b19e88b5a65fc74b586879f1`。费用5；main未实现。

羁绊身份：Black Rose → `TFT13_Cabal`；Sorcerer → `TFT13_Sorcerer`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":50,"hp":900,"initialMana":45,"magicResist":40,"mana":90,"range":4}`。

```json
{
  "apiName": "TFT13_LeBlanc",
  "name": "LeBlanc",
  "cost": 5,
  "traits": ["Black Rose","Sorcerer"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 900.0,
    "initialMana": 45.0,
    "magicResist": 40.0,
    "mana": 90.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Chain together the nearest @ChainTargets@ enemies for @ChainDuration@ seconds, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage split between them. When one takes damage, <TFTBonus>@DamageShare*100@%</TFTBonus> of the amount is split as bonus true damage to the&nbsp;others.<br><br>LeBlanc's next @NumAttacks@ attacks deal <magicDamage>@ModifiedAutoDamage@&nbsp;(%i:scaleAP%)</magicDamage> bonus magic damage, increased by <TFTBonus>@AutoKillBonus*100@%</TFTBonus> for each enemy killed by the initial damage.",
    "icon": "ASSETS/Characters/TFT13_LeBlanc/HUD/Icons2D/LeBlancE.TFT_Set13.tex",
    "name": "The Chains of Fate",
    "variables": [
      {
        "name": "ChainTargets",
        "value": [4.0,4.0,4.0,20.0,20.0,4.0,4.0]
      },
      {
        "name": "ChainDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "Damage",
        "value": [500.0,650.0,975.0,5000.0,9002.0,200.0,200.0]
      },
      {
        "name": "AutoDamage",
        "value": [250.0,160.0,240.0,900.0,900.0,0.0,0.0]
      },
      {
        "name": "DamageShare",
        "value": [0.15000000596046448,0.18000000715255737,0.25,1.0,1.0,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "NumAttacks",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "AutoKillBonus",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `ChainTargets` | [4,4,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ChainDuration` | [5,5,5] | 其他模式；不采用 |
| `Damage` | [650,975,5000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AutoDamage` | [160,240,900] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageShare` | [0.18,0.25,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumAttacks` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AutoKillBonus` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Lieutenant — Sevika

来源：`/setData/1/champions/39`；完整记录SHA-256 `2232ebead4e6f235e3cd3d1aa04c98cb462203c96b9304992e7d77d0ba6c959d`。费用5；main未实现。

羁绊身份：High Roller → `TFT13_HighRoller`；Chem-Baron → `TFT13_Crime`；Pit Fighter → `TFT13_Pugilist`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.9,"critChance":0.25,"critMultiplier":1.4,"damage":80,"hp":1200,"initialMana":0,"magicResist":60,"mana":60,"range":1}`。

```json
{
  "apiName": "TFT13_Lieutenant",
  "name": "Sevika",
  "cost": 5,
  "traits": ["High Roller","Chem-Baron","Pit Fighter"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.8999999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 80.0,
    "hp": 1200.0,
    "initialMana": 0,
    "magicResist": 60.0,
    "mana": 60.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Randomly cast 1 of 3 spells, with a chance of a Jackpot!<br><br><spellPassive>Flamethrower:</spellPassive> {{Spell_TFT13_LieutenantSpell1_Tooltip}}<br><br><spellPassive>Extendo-Punch:</spellPassive> {{Spell_TFT13_LieutenantSpell2_Tooltip}}<br><br><spellPassive>Chomp:</spellPassive> {{Spell_TFT13_LieutenantSpell3_Tooltip}}",
    "icon": "ASSETS/Characters/TFT13_Lieutenant/HUD/Icons2D/TFT13_Lieutenant_AbilityIcon.TFT_Set13.tex",
    "name": "Beat the Odds",
    "variables": [
      {
        "name": "Spell1_ADPercent",
        "value": [2.5,2.4000000953674316,2.4000000953674316,15.0,20.0,1.7999999523162842,1.7999999523162842]
      },
      {
        "name": "Spell1_ReducedDamagePercent",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "Spell1_MinDuration",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "Spell1_Bonus_DamagePercentPerSecond",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "Spell1_HighrollBonus",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      },
      {
        "name": "APBonusDamage",
        "value": [0.0,20.0,30.0,500.0,0.0,0.0,0.0]
      },
      {
        "name": "Spell2_HexRadius",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "Spell2_Modifier",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "Spell2_SecondaryModifier",
        "value": [1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842]
      },
      {
        "name": "Spell2_HexKnockback",
        "value": [10.0,10.0,10.0,10.0,10.0,10.0,10.0]
      },
      {
        "name": "Spell2_StunDuration",
        "value": [1.5,1.5,1.5,1.5,1.5,1.5,1.5]
      },
      {
        "name": "Spell2_Bonus_KnockbackDamage",
        "value": [0.0,4.0,4.0,10.0,0.0,0.0,0.0]
      },
      {
        "name": "Spell3_Modifier",
        "value": [3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716]
      },
      {
        "name": "Spell3_BleedModifier",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      },
      {
        "name": "Spell3_StunDuration",
        "value": [1.25,1.25,1.25,1.25,1.25,1.25,1.25]
      },
      {
        "name": "Spell3_NumSlams",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "Spell3_BleedDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "Spell3_TargetPercentHealthDamage",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "Spell3_HexRadius",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "Spell3_Bonus_BleedADPercent",
        "value": [0.0,4.0,4.0,10.0,0.0,0.0,0.0]
      },
      {
        "name": "Spell3_Bonus_BleedDuration",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      },
      {
        "name": "Spell3_ExecutePercentage",
        "value": [0.15000000596046448,0.15000000596046448,0.15000000596046448,1.0,1.0,0.15000000596046448,0.15000000596046448]
      },
      {
        "name": "Spell3_ResetDashRange",
        "value": [2.0,2.0,2.0,10.0,10.0,2.0,2.0]
      },
      {
        "name": "Spell3_ResetDamageFalloff",
        "value": [0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929]
      },
      {
        "name": "Spell3_BonusNumChomps",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Spell1_ADPercent` | [2.4,2.4,15] | 子技能分支；Q07 |
| `Spell1_ReducedDamagePercent` | [0.5,0.5,0.5] | 其他模式；不采用 |
| `Spell1_MinDuration` | [2,2,2] | 其他模式；不采用 |
| `Spell1_Bonus_DamagePercentPerSecond` | [0.2,0.2,0.2] | 子技能分支；Q07 |
| `Spell1_HighrollBonus` | [20,20,20] | 子技能分支；Q07 |
| `APBonusDamage` | [20,30,500] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Spell2_HexRadius` | [1,1,1] | 子技能分支；Q07 |
| `Spell2_Modifier` | [3,3,3] | 子技能分支；Q07 |
| `Spell2_SecondaryModifier` | [1.3,1.3,1.3] | 子技能分支；Q07 |
| `Spell2_HexKnockback` | [10,10,10] | 子技能分支；Q07 |
| `Spell2_StunDuration` | [1.5,1.5,1.5] | 其他模式；不采用 |
| `Spell2_Bonus_KnockbackDamage` | [4,4,10] | 子技能分支；Q07 |
| `Spell3_Modifier` | [3.2,3.2,3.2] | 子技能分支；Q07 |
| `Spell3_BleedModifier` | [0.75,0.75,0.75] | 子技能分支；Q07 |
| `Spell3_StunDuration` | [1.25,1.25,1.25] | 其他模式；不采用 |
| `Spell3_NumSlams` | [2,2,2] | 子技能分支；Q07 |
| `Spell3_BleedDuration` | [5,5,5] | 其他模式；不采用 |
| `Spell3_TargetPercentHealthDamage` | [0.2,0.2,0.2] | 子技能分支；Q07 |
| `Spell3_HexRadius` | [1,1,1] | 子技能分支；Q07 |
| `Spell3_Bonus_BleedADPercent` | [4,4,10] | 子技能分支；Q07 |
| `Spell3_Bonus_BleedDuration` | [20,20,20] | 其他模式；不采用 |
| `Spell3_ExecutePercentage` | [0.15,0.15,1] | 子技能分支；Q07 |
| `Spell3_ResetDashRange` | [2,2,10] | 子技能分支；Q07 |
| `Spell3_ResetDamageFalloff` | [0.8,0.8,0.8] | 子技能分支；Q07 |
| `Spell3_BonusNumChomps` | [4,4,4] | 子技能分支；Q07 |

### TFT13_Malzahar — Malzahar

来源：`/setData/1/champions/20`；完整记录SHA-256 `ffcacdc97a57eefcea69361135e268faa342da311bedcaab7b362e7bf56f2a4f`。费用5；main未实现。

羁绊身份：Automata → `TFT13_Hextech`；Visionary → `TFT13_Invoker`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":45,"hp":950,"initialMana":30,"magicResist":40,"mana":95,"range":4}`。

```json
{
  "apiName": "TFT13_Malzahar",
  "name": "Malzahar",
  "cost": 5,
  "traits": ["Automata","Visionary"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 45.0,
    "hp": 950.0,
    "initialMana": 30.0,
    "magicResist": 40.0,
    "mana": 95.0,
    "range": 4.0
  },
  "ability": {
    "desc": "Summon a gate in a 5-hex line across target. Enemies hit take <magicDamage>@ModifiedDamage@ (%i:scaleAP%)</magicDamage> magic damage and are 20% <TFTKeyword>Shredded</TFTKeyword> for @ShredDuration@ seconds. Malzahar spreads 5 stacks of infection between enemies hit.<br><br>Infection deals <magicDamage>@ModifiedInfectionDamage@ (%i:scaleAP%)</magicDamage> magic damage per second for the rest of combat. This effect can stack infinitely. When an infected target dies, they spread their stacks to nearby enemies.<br><br><rules><tftbold>Shred:</tftbold> Reduce Magic Resist</rules>",
    "icon": "ASSETS/Characters/TFT13_Malzahar/HUD/Icons2D/TFT13_MalzaharSpellIcon.TFT_Set13.tex",
    "name": "Call of the Machine",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,80.0,120.0,1000.0,1500.0,2.0,2.0]
      },
      {
        "name": "InfectionDamage",
        "value": [0.0,14.0,21.0,400.0,1000.0,2.5,2.5]
      },
      {
        "name": "DamageTicksPerSecond",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      },
      {
        "name": "ShredDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [80,120,1000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `InfectionDamage` | [15,22,400] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageTicksPerSecond` | [0.75,0.75,0.75] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShredDuration` | [4,4,4] | 其他模式；不采用 |

### TFT13_Mordekaiser — Mordekaiser

来源：`/setData/1/champions/70`；完整记录SHA-256 `d4a267dcc6cfc66c64a8ccbf6b25d6821fd18204a4f68c669ba05d48f9d680a4`。费用5；main未实现。

羁绊身份：Conqueror → `TFT13_Warband`；Dominator → `TFT13_Infused`。

基础属性审阅值：`{"armor":70,"attackSpeed":0.55,"critChance":0.25,"critMultiplier":1.4,"damage":75,"hp":1200,"initialMana":25,"magicResist":70,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_Mordekaiser",
  "name": "Mordekaiser",
  "cost": 5,
  "traits": ["Conqueror","Dominator"],
  "stats": {
    "armor": 70.0,
    "attackSpeed": 0.550000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 75.0,
    "hp": 1200.0,
    "initialMana": 25.0,
    "magicResist": 70.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Briefly gain <TFTBonus>@DR*100@%</TFTBonus> Durability and summon a massive claw, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the most enemies in a line. The @NearestEnemies@ closest enemies take <TFTBonus>@DamageBonus*100@%</TFTBonus> more damage and are pulled towards&nbsp;Mordekaiser.<br><br>For the next @EmpowerDuration@ seconds, gain <TFTBonus>@OmnivampPercent*100@%</TFTBonus> Omnivamp, +1 Attack Range, and replace every attack with a slam that deals <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to all other enemies within @AttackHexRadius@&nbsp;hexes.",
    "icon": "ASSETS/Characters/TFT13_Mordekaiser/HUD/Icons2D/MordekaiserE.TFT_Set13.tex",
    "name": "Grasp of the Iron Revenant",
    "variables": [
      {
        "name": "DR",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "Damage",
        "value": [0.0,160.0,240.0,800.0,0.0,0.0,0.0]
      },
      {
        "name": "DamageBonus",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "NearestEnemies",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "Displacement",
        "value": [240.0,240.0,240.0,240.0,240.0,240.0,240.0]
      },
      {
        "name": "OmnivampPercent",
        "value": [0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896,0.30000001192092896]
      },
      {
        "name": "TargetDamage",
        "value": [0.0,330.0,500.0,3000.0,0.0,0.0,0.0]
      },
      {
        "name": "SlamDamage",
        "value": [0.0,85.0,125.0,1500.0,0.0,0.0,0.0]
      },
      {
        "name": "AttackHexRadius",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "LineRange",
        "value": [1470.0,1470.0,1470.0,1470.0,1470.0,1470.0,1470.0]
      },
      {
        "name": "LineWidth",
        "value": [615.0,615.0,615.0,615.0,615.0,615.0,615.0]
      },
      {
        "name": "NumAttacks",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "EmpowerDuration",
        "value": [10.0,10.0,10.0,10.0,10.0,10.0,10.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `DR` | [0.4,0.4,0.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Damage` | [160,240,800] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DamageBonus` | [0.25,0.25,0.25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NearestEnemies` | [4,4,4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Displacement` | [240,240,240] | 客户端字段；含义按desc，未展开宏见Q03 |
| `OmnivampPercent` | [0.3,0.3,0.3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `TargetDamage` | [330,500,3000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SlamDamage` | [85,125,1500] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AttackHexRadius` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `LineRange` | [1470,1470,1470] | 客户端字段；含义按desc，未展开宏见Q03 |
| `LineWidth` | [615,615,615] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumAttacks` | [1,1,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `EmpowerDuration` | [10,10,10] | 其他模式；不采用 |

### TFT13_Rumble — Rumble

来源：`/setData/1/champions/37`；完整记录SHA-256 `71851242b8523edfbb52970b66dba559c4270369ae48fc5e5d3e65bd84c365d8`。费用5；main未实现。

羁绊身份：Junker King → `TFT13_JunkerKing`；Scrap → `TFT13_Scrap`；Sentinel → `TFT13_Titan`。

基础属性审阅值：`{"armor":70,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":60,"hp":1200,"initialMana":40,"magicResist":70,"mana":120,"range":1}`。

```json
{
  "apiName": "TFT13_Rumble",
  "name": "Rumble",
  "cost": 5,
  "traits": ["Junker King","Scrap","Sentinel"],
  "stats": {
    "armor": 70.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 60.0,
    "hp": 1200.0,
    "initialMana": 40.0,
    "magicResist": 70.0,
    "mana": 120.0,
    "range": 1.0
  },
  "ability": {
    "desc": "Call down a rain of @NumMissile@ missiles on target's row that each deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage, <TFTKeyword>Wound</TFTKeyword>, and 1% <TFTKeyword>Burn</TFTKeyword> units hit for @WoundDuration@ seconds. For each missile that doesn't hit an enemy, restore @ManaPerMissile@&nbsp;Mana.<br><br>If there's only 1 enemy left, fire all of the missiles at&nbsp;them.<br><br><rules>Burn: Deal a percent of the target's max Health as true damage every second<br>Wound: Reduce healing received by 33%</rules><br><br>@TFTUnitProperty.:TFT13_JunkerKing_UpgradeTRAKeyWrapper@<br>",
    "icon": "ASSETS/Characters/TFT13_Rumble/HUD/Icons2D/Rumble_R.TFT_Set13.tex",
    "name": "The Equalizer",
    "variables": [
      {
        "name": "Damage",
        "value": [0.0,500.0,750.0,4000.0,9999.0,0.0,0.0]
      },
      {
        "name": "NumMissile",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "WoundDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "ManaPerMissile",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      },
      {
        "name": "Tankbuster_RefreshDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "Tankbuster_APDamage_Level1",
        "value": [100.0,100.0,100.0,100.0,100.0,100.0,100.0]
      },
      {
        "name": "Tankbuster_APDamage_Level2",
        "value": [150.0,150.0,150.0,150.0,150.0,150.0,150.0]
      },
      {
        "name": "Tankbuster_APDamage_Level3",
        "value": [1600.0,1600.0,1600.0,1600.0,1600.0,1600.0,1600.0]
      },
      {
        "name": "SelfDestruct_ResistGainIncrease",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "SelfDestruct_ResistDamage_Level1",
        "value": [1.600000023841858,1.600000023841858,1.600000023841858,1.600000023841858,1.600000023841858,1.600000023841858,1.600000023841858]
      },
      {
        "name": "SelfDestruct_ResistDamage_Level2",
        "value": [2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316,2.4000000953674316]
      },
      {
        "name": "SelfDestruct_ResistDamage_Level3",
        "value": [20.0,20.0,20.0,20.0,20.0,20.0,20.0]
      },
      {
        "name": "SelfDestruct_HexRadius",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "Flamethrower_Damage_Level1",
        "value": [30.0,30.0,30.0,30.0,30.0,30.0,30.0]
      },
      {
        "name": "Flamethrower_Damage_Level2",
        "value": [45.0,45.0,45.0,45.0,45.0,45.0,45.0]
      },
      {
        "name": "Flamethrower_Damage_Level3",
        "value": [600.0,600.0,600.0,600.0,600.0,600.0,600.0]
      },
      {
        "name": "Flamethrower_TicksPerSecond",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "RepairingMicrobots_RefreshDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "ReparingMicrobots_MaxHealthHeal_Level1",
        "value": [0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549]
      },
      {
        "name": "ReparingMicrobots_MaxHealthHeal_Level2",
        "value": [0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549,0.05999999865889549]
      },
      {
        "name": "ReparingMicrobots_MaxHealthHeal_Level3",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "PetriciteRod_RefreshDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "PetriciteRod_APDamage_Level1",
        "value": [350.0,350.0,350.0,350.0,350.0,350.0,350.0]
      },
      {
        "name": "PetriciteRod_APDamage_Level2",
        "value": [525.0,525.0,525.0,525.0,525.0,525.0,525.0]
      },
      {
        "name": "PetriciteRod_APDamage_Level3",
        "value": [6000.0,6000.0,6000.0,6000.0,6000.0,6000.0,6000.0]
      },
      {
        "name": "PetriciteRod_DOTDuration",
        "value": [15.0,15.0,15.0,15.0,15.0,15.0,15.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `Damage` | [500,750,4000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NumMissile` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `WoundDuration` | [5,5,5] | 其他模式；不采用 |
| `ManaPerMissile` | [20,20,20] | 客户端字段；含义按desc，未展开宏见Q03 |
| `Tankbuster_RefreshDuration` | [3,3,3] | 其他模式；不采用 |
| `Tankbuster_APDamage_Level1` | [100,100,100] | Junker King条件改造；Q08/Q12 |
| `Tankbuster_APDamage_Level2` | [150,150,150] | Junker King条件改造；Q08/Q12 |
| `Tankbuster_APDamage_Level3` | [1600,1600,1600] | Junker King条件改造；Q08/Q12 |
| `SelfDestruct_ResistGainIncrease` | [0.25,0.25,0.25] | Junker King条件改造；Q08/Q12 |
| `SelfDestruct_ResistDamage_Level1` | [1.6,1.6,1.6] | Junker King条件改造；Q08/Q12 |
| `SelfDestruct_ResistDamage_Level2` | [2.4,2.4,2.4] | Junker King条件改造；Q08/Q12 |
| `SelfDestruct_ResistDamage_Level3` | conflict：源[20,20,20] / 公告200倍；不采纳待确认 | Q08 |
| `SelfDestruct_HexRadius` | [2,2,2] | Junker King条件改造；Q08/Q12 |
| `Flamethrower_Damage_Level1` | [30,30,30] | Junker King条件改造；Q08/Q12 |
| `Flamethrower_Damage_Level2` | [45,45,45] | Junker King条件改造；Q08/Q12 |
| `Flamethrower_Damage_Level3` | [600,600,600] | Junker King条件改造；Q08/Q12 |
| `Flamethrower_TicksPerSecond` | [2,2,2] | Junker King条件改造；Q08/Q12 |
| `RepairingMicrobots_RefreshDuration` | [3,3,3] | 其他模式；不采用 |
| `ReparingMicrobots_MaxHealthHeal_Level1` | [0.06,0.06,0.06] | Junker King条件改造；Q08/Q12 |
| `ReparingMicrobots_MaxHealthHeal_Level2` | [0.06,0.06,0.06] | Junker King条件改造；Q08/Q12 |
| `ReparingMicrobots_MaxHealthHeal_Level3` | [0.4,0.4,0.4] | Junker King条件改造；Q08/Q12 |
| `PetriciteRod_RefreshDuration` | [5,5,5] | 其他模式；不采用 |
| `PetriciteRod_APDamage_Level1` | [350,350,350] | Junker King条件改造；Q08/Q12 |
| `PetriciteRod_APDamage_Level2` | [525,525,525] | Junker King条件改造；Q08/Q12 |
| `PetriciteRod_APDamage_Level3` | [6000,6000,6000] | Junker King条件改造；Q08/Q12 |
| `PetriciteRod_DOTDuration` | [15,15,15] | 其他模式；不采用 |

### TFT13_MissMage — Mel

来源：`/setData/8/champions/85`；完整记录SHA-256 `524a16ebe3abc59f35e558b3336f268d9b5612be9c1c9c49e5fc47ed0a484d25`。费用6；main未实现。

羁绊身份：Banished Mage → `TFT13_MissMageTrait`。

基础属性审阅值：`{"armor":60,"attackSpeed":0.8,"critChance":0.25,"critMultiplier":1.4,"damage":80,"hp":1800,"initialMana":0,"magicResist":60,"mana":40,"range":3}`。

```json
{
  "apiName": "TFT13_MissMage",
  "name": "Mel",
  "cost": 6,
  "traits": ["Banished Mage"],
  "stats": {
    "armor": 60.0,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 80.0,
    "hp": 1800.0,
    "initialMana": 0,
    "magicResist": 60.0,
    "mana": 40.0,
    "range": 3.0
  },
  "ability": {
    "desc": "Dash to a nearby hex, then gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield and grant the same Shield to @ShieldCount@ nearby allies. @DRConvertToUnstableEnergy*100@% of the damage blocked by the Shields is stored as unstable energy. After dashing, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to @NormalCastNumEnemies@ nearby&nbsp;enemies. <br><br>Every 3rd cast, unleash the unstable energy + <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> as magic damage split between the @ThirdCastNumEnemies@ nearest&nbsp;enemies.",
    "icon": "ASSETS/Characters/TFT13_MissMage/HUD/Icons2D/TFT13_MissMage_Spell.TFT_Set13_Evolved.tex",
    "name": "Conduit of Magic",
    "variables": [
      {
        "name": "NormalCastDamage",
        "value": [0.0,180.0,450.0,2700.0,0.0,0.0,0.0]
      },
      {
        "name": "NormalCastNumEnemies",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "NormalCastNumMissilesPerEnemy",
        "value": [10.0,10.0,10.0,10.0,10.0,10.0,10.0]
      },
      {
        "name": "AuraDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "AuraDR",
        "value": [0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224,0.20000000298023224]
      },
      {
        "name": "DRConvertToUnstableEnergy",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "SpecialCastDamage",
        "value": [0.0,1390.0,3475.0,99999.0,0.0,0.0,0.0]
      },
      {
        "name": "ThirdCastNumEnemies",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "DashLogic_DashRange",
        "value": [9000.0,9000.0,9000.0,9000.0,9000.0,9000.0,9000.0]
      },
      {
        "name": "DashLogic_LineWidth",
        "value": null
      },
      {
        "name": "DashLogic_DashSpeed",
        "value": [1600.0,1600.0,1600.0,1600.0,1600.0,1600.0,1600.0]
      },
      {
        "name": "DashLogic_MaxDashTime",
        "value": [1.5,1.5,1.5,1.5,1.5,1.5,1.5]
      },
      {
        "name": "ShieldAmount",
        "value": [0.0,300.0,600.0,10000.0,10000.0,0.0,0.0]
      },
      {
        "name": "ShieldCount",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `NormalCastDamage` | [180,450,2700] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NormalCastNumEnemies` | [3,3,3] | 客户端字段；含义按desc，未展开宏见Q03 |
| `NormalCastNumMissilesPerEnemy` | [10,10,10] | 客户端字段；含义按desc，未展开宏见Q03 |
| `AuraDuration` | [4,4,4] | 其他模式；不采用 |
| `AuraDR` | [0.2,0.2,0.2] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `DRConvertToUnstableEnergy` | [0.5,0.5,0.5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `SpecialCastDamage` | [1390,3475,99999] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ThirdCastNumEnemies` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |
| `DashLogic_DashRange` | [9000,9000,9000] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `DashLogic_LineWidth` | null | unknown/null；Q05 |
| `DashLogic_DashSpeed` | [1600,1600,1600] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `DashLogic_MaxDashTime` | [1.5,1.5,1.5] | 内部参数/活跃性或单位需证实；Q03/Q05 |
| `ShieldAmount` | [300,600,10000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShieldCount` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |

本条null字段：`DashLogic_LineWidth`；原样保留，不替换0。

### TFT13_Viktor — Viktor

来源：`/setData/8/champions/84`；完整记录SHA-256 `f372376e83a8904ce67027915cd3d592b595d478f6130e8c83d07df9749ea3d9`。费用6；main未实现。

羁绊身份：Machine Herald → `TFT13_MachineHerald`。

基础属性审阅值：`{"armor":40,"attackSpeed":0.55,"critChance":0.25,"critMultiplier":1.4,"damage":100,"hp":1600,"initialMana":0,"magicResist":40,"mana":100,"range":4}`。 **Q11：Viktor实际能量按Machine Herald的3/8；此处是原始mana载体。**

```json
{
  "apiName": "TFT13_Viktor",
  "name": "Viktor",
  "cost": 6,
  "traits": ["Machine Herald"],
  "stats": {
    "armor": 40.0,
    "attackSpeed": 0.550000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 100.0,
    "hp": 1600.0,
    "initialMana": 0,
    "magicResist": 40.0,
    "mana": 100,
    "range": 4.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> Attacks are replaced with a Death Ray that deals <magicDamage>@ModifiedDeathRayDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and <trueDamage>@LaserTrueDamage@</trueDamage> true damage in a @LaserHexLength@-hex line. Enemies hit are 30% <TFTKeyword>Sundered</TFTKeyword> and <TFTKeyword>Shredded</TFTKeyword> for @ShredDuration@&nbsp;seconds.<br><br><spellActive>Active:</spellActive> Summon a chaos storm that engulfs the battlefield, knocking up ALL enemies into the air for @StunDuration@ seconds. At the end of the duration, slam them to the ground, dealing <magicDamage>@ModifiedSpellDamage@&nbsp;(%i:scaleAP%)</magicDamage> plus <magicDamage>@PercentMaxHealthDamage*100@%</magicDamage> of their max Health as magic&nbsp;damage.<br><br><rules><tftbold>Sunder:</tftbold> Reduce Armor,</rules> <rules><tftbold>Shred:</tftbold> Reduce Magic Resist</rules>",
    "icon": "ASSETS/Characters/TFT13_Viktor/HUD/Icons2D/Viktor_Passive.TFT_Set13_Evolved.tex",
    "name": "Chaos Storm",
    "variables": [
      {
        "name": "LaserHexLength",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "LaserMagicDamage",
        "value": [40.0,70.0,175.0,2000.0,9001.0,20.0,20.0]
      },
      {
        "name": "LaserTrueDamage",
        "value": [0.0,35.0,90.0,1000.0,9001.0,0.0,0.0]
      },
      {
        "name": "ShredDuration",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      },
      {
        "name": "StunDuration",
        "value": [2.0,2.0,3.0,30.0,30.0,2.0,2.0]
      },
      {
        "name": "SpellDamage",
        "value": [150.0,120.0,300.0,9999.0,9999.0,100.0,100.0]
      },
      {
        "name": "PercentMaxHealthDamage",
        "value": [0.10000000149011612,0.07999999821186066,0.20000000298023224,1.0,1.0,0.15000000596046448,0.15000000596046448]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `LaserHexLength` | [2,2,2] | 客户端字段；含义按desc，未展开宏见Q03 |
| `LaserMagicDamage` | [50,180,2000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `LaserTrueDamage` | [25,90,1000] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ShredDuration` | [5,5,5] | 其他模式；不采用 |
| `StunDuration` | [2,3,30] | 其他模式；不采用 |
| `SpellDamage` | [100,300,9999] | 客户端字段；含义按desc，未展开宏见Q03 |
| `PercentMaxHealthDamage` | [0.08,0.2,1] | 客户端字段；含义按desc，未展开宏见Q03 |

### TFT13_Warwick — Warwick

来源：`/setData/8/champions/86`；完整记录SHA-256 `f1abac2b9f61d3869c19ab4fe90ae2dfedaef2e732fb28216f8768978eef3b37`。费用6；main未实现。

羁绊身份：Experiment → `TFT13_Experiment`；Blood Hunter → `TFT13_BloodHunter`。

基础属性审阅值：`{"armor":70,"attackSpeed":0.9,"critChance":0.25,"critMultiplier":1.4,"damage":110,"hp":2100,"initialMana":60,"magicResist":70,"mana":100,"range":1}`。

```json
{
  "apiName": "TFT13_Warwick",
  "name": "Warwick",
  "cost": 6,
  "traits": ["Experiment","Blood Hunter"],
  "stats": {
    "armor": 70.0,
    "attackSpeed": 0.8999999761581421,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 110.0,
    "hp": 2100.0,
    "initialMana": 60.0,
    "magicResist": 70.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Passive:</spellPassive> While <omnivamp>Bloodfrenzied</omnivamp>, move faster, gain <TFTBonus>@PercentOmnivamp@%&nbsp;(%i:scaleAP%)</TFTBonus> Omnivamp, <TFTBonus>@BloodfrenzyAS*100@%</TFTBonus> Attack Speed, and deal <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%%i:scaleAS%)</physicalDamage> physical damage each second to target. After killing @ChampsToDevourTooltipOnly@ enemies, become Unstoppable and <omnivamp>Bloodfrenzied</omnivamp> for the rest of&nbsp;combat.<br><br><spellActive>Active</spellActive>: Become <omnivamp>Bloodfrenzied</omnivamp> for @BloodfrenzyDuration@&nbsp;seconds.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus:<TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus> On kill, Stun enemies adjacent to the dead target for @TFTUnitProperty.:TFT13_WarwickCurrentExperimentBonus@&nbsp;second.</spellActive>",
    "icon": "ASSETS/Characters/TFT13_Warwick/Skins/Base/Images/TFT13_Warwick_AbilityIcon.TFT_Set13_Evolved.tex",
    "name": "Blood Hunt",
    "variables": [
      {
        "name": "BaseOmnivamp",
        "value": [0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612,0.10000000149011612]
      },
      {
        "name": "APOmnivamp",
        "value": [1.0,0.10000000149011612,0.15000000596046448,1.0,1.0,1.0,1.0]
      },
      {
        "name": "BloodfrenzyAS",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "BloodfrenzyDuration",
        "value": [4.0,4.0,4.0,4.0,4.0,4.0,4.0]
      },
      {
        "name": "DamagePercent",
        "value": [3.0,2.0,3.75,25.0,50.0,3.0,3.0]
      },
      {
        "name": "BaseDamage",
        "value": [0.0,180.0,300.0,1088.0,0.0,0.0,0.0]
      },
      {
        "name": "ExperimentStunDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "ChampsToDevourTooltipOnly",
        "value": [5.0,5.0,5.0,5.0,5.0,5.0,5.0]
      }
    ]
  }
}
```

技能数值审阅（1/2/3星；完整七槽原值见上）：

| 变量名 | 14.24b审阅值 | 适用性/边界 |
| --- | --- | --- |
| `BaseOmnivamp` | [0.1,0.1,0.1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `APOmnivamp` | [0.1,0.15,1] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BloodfrenzyAS` | [0.4,0.4,0.4] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BloodfrenzyDuration` | [4,4,4] | 其他模式；不采用 |
| `DamagePercent` | [2,3.75,25] | 客户端字段；含义按desc，未展开宏见Q03 |
| `BaseDamage` | [180,300,1088] | 客户端字段；含义按desc，未展开宏见Q03 |
| `ExperimentStunDuration` | [1,1,1] | 其他模式；不采用 |
| `ChampsToDevourTooltipOnly` | [5,5,5] | 客户端字段；含义按desc，未展开宏见Q03 |

## 7. 全羁绊原始记录、档位、效果和数值（37条）

原desc是各档公共语义；逐档minUnits/maxUnits及全部variables给出档位效果参数。后附最终审阅表将公告覆盖带入具体档位，raw不变；每档参数和公共desc共同解释效果，不能把hash键当官方命名参数。Teamup单列强化身份/激活证据，不计普通阵容自然羁绊。

| 标准模式强化apiName | 名称 | 来源pointer / 完整记录hash | 原始激活描述（未展开宏保留） |
| --- | --- | --- | --- |
| TFT13_TeamupAugment_Reunion | Trait: Reunion | /items/0；SHA-256 a0e65e2b0b933b2cb253d9268cd207fed10169463eacfcaabb5d56684f3accd4 | When Vi casts, Ekko releases 3 afterimages towards her target dealing @EkkoAfterImageReducedDamage*100@% damage. When Ekko casts, Vi slams an earthquake towards his target dealing @ViEarthquakeReducedDamage*100@% damage.<br><br>Gain a Vi and Ekko. |
| TFT13_TeamupAugment_UnlikelyDuo | Trait: Unlikely Duo | /items/4；SHA-256 402be59cdb61f54ebcda802ba45aa8b0b1c86bdecb6a068e4fecd098da76c1bc | Jinx and Sevika gain @AD*100@% Attack Damage and @Health@ Health. Whenever one casts, they grant the other @Mana@ mana. Sevika's arm is luckier.<br><br>Gain a Jinx and Sevika. |
| TFT13_TeamupAugment_Geniuses | Trait: Geniuses | /items/13；SHA-256 eb95506400dc1049b28529d05dd3d56ec55fcf7856857daf257cca0d3e615ef2 | When Heimerdinger casts, Ekko releases @NumEkkoAfterImages@ afterimages, each dealing @ReducedEkkoDamage*100@% damage. When Ekko casts, Heimerdinger fires @NumHeimerMissiles@ missiles, each dealing @ReducedHeimerDamage*100@% damage.<br><br>Gain a Heimerdinger, Ekko, and a Jeweled Gauntlet. |
| TFT13_TeamupAugment_Betrayal | Trait: Betrayal | /items/17；SHA-256 0c26282aecf4429976167d20d6ee55c8700209e92fa09f814d36f6a03758ba3e | Maddie always targets Ambessa's target with her Ability and attacks. Every round where either gets at least @NumKills@ kills, gain a Maddie.<br><br>Gain a Maddie and Ambessa. |
| TFT13_TeamupAugment_BloodBrothers | Trait: What Could Have Been | /items/31；SHA-256 be6d08f78268f0bc534d7de627e5e1c3374e81f0de80e1536305082f8b9a6df9 | Vander gains @MaxHealthGainPerCast@ permanent max Health each time Silco casts. Silco gains @APGainPerDeath@ permanent Ability Power each time Vander dies.<br><br>Gain a 2-star Vander, a Silco, and a Spear of Shojin. |
| TFT13_TeamupAugment_Sisters | Trait: Sisters | /items/33；SHA-256 e026d33b818973b0cc90b9c4f844355b494f2a042b64d060270a1a73829704e3 | Gain the Sister Trait. When Vi scores a takedown, Jinx gains @ASBuff*100@% bonus Attack Speed for @JinxDuration@ seconds. When Jinx scores a takedown, Vi gains @ADBuff*100@% bonus Attack Damage for @ViDuration@ seconds.<br><br>Gain a Vi and Jinx. |
| TFT13_TeamupAugment_Menaces | Trait: Menaces | /items/75；SHA-256 381e8879c313fbb0266d0126efd820adff58847de70af27a6fce842efbd94f3b | While fielded with Silco, Powder gains Dominator, but no longer benefits from Family. When her monkey explodes, it creates @TOOLTIPONLYNumMonstrosities@ of Silco's monstrosities.<br><br>Gain a 2-star Powder and a Silco. |
| TFT13_TeamupAugment_Mentorship | Trait: Martial Law | /items/80；SHA-256 8121810abed47fcc4ffadce19ab24a55d9cfda937c5bb3e0681a48a8b3301352 | When Ambessa casts, Caitlyn fires an empowered attack at the target, dealing @TOOLTIPONLYCAITAD@% damage. Ambessa gains @TOOLTIPONLYADSHARE@% of Caitlyn's Attack Damage.<br><br>Gain a Caitlyn and Ambessa. |

### TFT13_Academy — Academy

来源：`/setData/1/traits/17`；完整记录SHA-256 `4092b745bafe109288b183140999eacd5072d308148d0854c7cb58ce9ba24421`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Academy",
  "name": "Academy",
  "desc": "The Academy sponsors 3 items each game.<br><br>Copies of sponsored items grant bonus max Health and Damage Amp. Academy units holding sponsored items gain double the amount, plus an additional @BaseValues*100@% Health and Damage Amp.<br><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%</row>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 1,
      "variables": {
        "BaseValues": 0.05000000074505806,
        "NumOfItems": 1.0,
        "PercentIncreaseSponsored": 0.019999999552965164
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "BaseValues": 0.05000000074505806,
        "NumOfItems": 2.0,
        "PercentIncreaseSponsored": 0.029999999329447746
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "BaseValues": 0.05000000074505806,
        "NumOfItems": 3.0,
        "PercentIncreaseSponsored": 0.05000000074505806
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BaseValues": 0.05000000074505806,
        "NumOfItems": 3.0,
        "PercentIncreaseSponsored": 0.09000000357627869
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 3 | {"BaseValues":0.05,"NumOfItems":1,"PercentIncreaseSponsored":0.02} |
| 4 | 4 | {"BaseValues":0.05,"NumOfItems":2,"PercentIncreaseSponsored":0.03} |
| 5 | 5 | {"BaseValues":0.05,"NumOfItems":3,"PercentIncreaseSponsored":0.05} |
| 6 | 25000 | {"BaseValues":0.05,"NumOfItems":3,"PercentIncreaseSponsored":0.09} |

### TFT13_Ambassador — Emissary

来源：`/setData/1/traits/6`；完整记录SHA-256 `41cfa4eaa2dc19627d9337e03e9ebc37b740ff1d3f12e9667959b2b6ed4aae02`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Ambassador",
  "name": "Emissary",
  "desc": "This trait is active only when you have exactly 1 or 4 unique Emissaries. <br><br><row>(@MinUnits@) Gain that Emissary's bonus</row><br><row>(@MinUnits@) Gain all bonuses. Emissaries gain @BonusHealth@&nbsp;%i:scaleHealth% and @SelfishDamageAmp*100@%&nbsp;%i:scaleDA%</row><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveDomina alternate=TFTGuildInactive>Ambessa: Allies gain @AmbessaArmor@ Armor and Magic Resist for each opponent defeated. (@TFTUnitProperty.trait:TFT13_Ambassador_PlayersDefeated@/7)</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveJarvan alternate=TFTGuildInactive>Garen: On Combat Start, Garen and allies to his left and right gain @GarenHealthPercent*100@% of his max Health.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveNami alternate=TFTGuildInactive>Nami: Allies' attacks grant @NamiMana@ bonus Mana.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveTristana alternate=TFTGuildInactive>Tristana: Allies gain @StarAS*100@% Attack Speed per star level.</TFTGuildActive>",
  "effects": [
    {
      "maxUnits": 1,
      "minUnits": 1,
      "style": 1,
      "variables": {
        "AmbessaArmor": 2.0,
        "AmbessaArmor_PVE": 4.0,
        "BonusAS": null,
        "BonusHealth": 200.0,
        "CCImmuneDuration": 8.0,
        "GarenHealthPercent": 0.11999999731779099,
        "NamiMana": 2.0,
        "SelfishDamageAmp": 0.20000000298023224,
        "StarAS": 0.05999999865889549,
        "{3854f478}": 2.0,
        "{4b20f990}": null,
        "{845be53a}": 4.0
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "AmbessaArmor": 2.0,
        "AmbessaArmor_PVE": 4.0,
        "BonusAS": null,
        "BonusHealth": 200.0,
        "CCImmuneDuration": 8.0,
        "GarenHealthPercent": 0.11999999731779099,
        "NamiMana": 2.0,
        "SelfishDamageAmp": 0.20000000298023224,
        "StarAS": 0.05999999865889549,
        "{3854f478}": 2.0,
        "{4b20f990}": null,
        "{845be53a}": 4.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 1 | {"AmbessaArmor":2,"AmbessaArmor_PVE":4,"BonusAS":null,"BonusHealth":200,"CCImmuneDuration":8,"GarenHealthPercent":0.12,"NamiMana":2,"SelfishDamageAmp":0.2,"StarAS":0.06,"{3854f478}":2,"{4b20f990}":null,"{845be53a}":4} |
| 4 | 4 | {"AmbessaArmor":2,"AmbessaArmor_PVE":4,"BonusAS":null,"BonusHealth":200,"CCImmuneDuration":8,"GarenHealthPercent":0.12,"NamiMana":2,"SelfishDamageAmp":0.2,"StarAS":0.06,"{3854f478}":2,"{4b20f990}":null,"{845be53a}":4} |

### TFT13_Ambusher — Ambusher

来源：`/setData/1/traits/11`；完整记录SHA-256 `2033dfad41a14a3c3e94d012799a30b4df65b01fe9381ff44d257347533a7488`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Ambusher",
  "name": "Ambusher",
  "desc": "Damage from Ambushers' Abilities can critically strike. They also gain bonus Critical Strike Chance and Critical Strike Damage.<br><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%; also gain @DamageReductionPct*100@% Durability</row>",
  "effects": [
    {
      "maxUnits": 2,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "CritChance": 0.25,
        "CritDamage": 0.10000000149011612
      }
    },
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 3,
      "variables": {
        "CritChance": 0.3499999940395355,
        "CritDamage": 0.20000000298023224
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "CritChance": 0.44999998807907104,
        "CritDamage": 0.25
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "CritChance": 0.550000011920929,
        "CritDamage": 0.25,
        "DamageReductionPct": 0.15000000596046448
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 2 | {"CritChance":0.25,"CritDamage":0.1} |
| 3 | 3 | {"CritChance":0.35,"CritDamage":0.2} |
| 4 | 4 | {"CritChance":0.45,"CritDamage":0.25} |
| 5 | 25000 | {"CritChance":0.55,"CritDamage":0.25,"DamageReductionPct":0.15} |

### TFT13_BloodHunter — Blood Hunter

来源：`/setData/8/traits/32`；完整记录SHA-256 `f7a387fe070893f37152bdf657b54ea229848687a91d21a62a05f47f71b4cb4e`；分类：常规/专属。

```json
{
  "apiName": "TFT13_BloodHunter",
  "name": "Blood Hunter",
  "desc": "Warwick devours enemies that drop below @EnemyHealthPercentThreshold*100@%&nbsp;Health, healing him for @DevourHealing@ and granting him @ManaPerKill@&nbsp;Mana.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {
        "DevourHealing": 400.0,
        "EnemyHealthPercentThreshold": 0.15000000596046448,
        "ManaPerKill": 50.0,
        "{84534a47}": 5.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 25000 | {"DevourHealing":400,"EnemyHealthPercentThreshold":0.15,"ManaPerKill":50,"{84534a47}":5} |

### TFT13_Bruiser — Bruiser

来源：`/setData/1/traits/27`；完整记录SHA-256 `43b4d03516def2c95dfd7e4c6581abff28ca691636279eb2339bfea6b79cc201`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Bruiser",
  "name": "Bruiser",
  "desc": "Your team gains @TeamFlatHealth@ max Health. Bruisers gain more.<br><br><expandRow>(@MinUnits@) @BonusPercentHealth*100@%&nbsp;%i:scaleHealth%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "BonusPercentHealth": 0.20000000298023224,
        "TeamFlatHealth": 100.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "BonusPercentHealth": 0.44999998807907104,
        "TeamFlatHealth": 100.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BonusPercentHealth": 0.800000011920929,
        "TeamFlatHealth": 100.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"BonusPercentHealth":0.2,"TeamFlatHealth":100} |
| 4 | 5 | {"BonusPercentHealth":0.45,"TeamFlatHealth":100} |
| 6 | 25000 | {"BonusPercentHealth":0.8,"TeamFlatHealth":100} |

### TFT13_Cabal — Black Rose

来源：`/setData/1/traits/29`；完整记录SHA-256 `fa787b13cac1a502e0e84f743a3a590b4b1a21a8876d063a3eb591015e68f09e`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Cabal",
  "name": "Black Rose",
  "desc": "<row>(@MinUnits@) Summon a chained Sion. He is freed after @NumCastsToUnlock@ casts from Black Rose units or when he drops below @PercentHealthUnlock*100@% health.</row><br><row>(@MinUnits@) Sion grows stronger and his enemies take more damage from Black Rose units.</row><br><row>(@MinUnits@) Sion unleashes dark magic and heals to full Health when freed.</row><br><row>(@MinUnits@) When Sion dies, he restores to life with power beyond death!</row><br><br><rules>Each Black Rose champion's star level increases Sion's power</rules>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 1,
      "variables": {
        "NumCastsToUnlock": 5.0,
        "PercentHealthPerStarLevel": 0.15000000596046448,
        "PercentHealthUnlock": 0.6499999761581421,
        "{2c6be05c}": 0.11999999731779099,
        "{2e45fc86}": 40.0,
        "{85b293ec}": 0.3499999940395355,
        "{92ef9cd7}": 4.0
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "NumCastsToUnlock": 5.0,
        "PercentHealthPerStarLevel": 0.15000000596046448,
        "PercentHealthUnlock": 0.6499999761581421,
        "{2c6be05c}": 0.11999999731779099,
        "{2e45fc86}": 45.0,
        "{85b293ec}": 0.3499999940395355,
        "{92ef9cd7}": 4.0
      }
    },
    {
      "maxUnits": 6,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "NumCastsToUnlock": 5.0,
        "PercentHealthPerStarLevel": 0.15000000596046448,
        "PercentHealthUnlock": 0.6499999761581421,
        "{2c6be05c}": 0.11999999731779099,
        "{2e45fc86}": 50.0,
        "{85b293ec}": 0.3499999940395355,
        "{92ef9cd7}": 4.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 7,
      "style": 5,
      "variables": {
        "NumCastsToUnlock": 5.0,
        "PercentHealthPerStarLevel": 0.15000000596046448,
        "PercentHealthUnlock": 0.6499999761581421,
        "{2c6be05c}": 0.11999999731779099,
        "{2e45fc86}": 100.0,
        "{85b293ec}": 0.3499999940395355,
        "{92ef9cd7}": 4.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 3 | {"NumCastsToUnlock":5,"PercentHealthPerStarLevel":0.15,"PercentHealthUnlock":0.65,"{2c6be05c}":0.12,"{2e45fc86}":40,"{85b293ec}":0.35,"{92ef9cd7}":4} |
| 4 | 4 | {"NumCastsToUnlock":5,"PercentHealthPerStarLevel":0.15,"PercentHealthUnlock":0.65,"{2c6be05c}":0.12,"{2e45fc86}":45,"{85b293ec}":0.35,"{92ef9cd7}":4} |
| 5 | 6 | {"NumCastsToUnlock":5,"PercentHealthPerStarLevel":0.15,"PercentHealthUnlock":0.65,"{2c6be05c}":0.12,"{2e45fc86}":50,"{85b293ec}":0.35,"{92ef9cd7}":4} |
| 7 | 25000 | {"NumCastsToUnlock":5,"PercentHealthPerStarLevel":0.15,"PercentHealthUnlock":0.65,"{2c6be05c}":0.12,"{2e45fc86}":100,"{85b293ec}":0.35,"{92ef9cd7}":4} |

Q06：上述hash变量含义未证实；Sion阶段成长/5档盾晕/7档复活的公告值与治疗语义见§2.1，不凭hash变量强行映射。

### TFT13_Challenger — Quickstriker

来源：`/setData/1/traits/30`；完整记录SHA-256 `7cb5b27f1e2db73783900c19e9f8be901c87671ab9cea0daf63c20c237e7fcd3`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Challenger",
  "name": "Quickstriker",
  "desc": "Quickstrikers move faster and gain Attack Speed, based on their target's missing Health.<br><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%. On target death, Quickstrikers dash to a new target and gain @ShieldAmount@ shield for @ShieldDuration@&nbsp;seconds. </row>",
  "effects": [
    {
      "maxUnits": 2,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "MaxBonusAS": 0.6000000238418579,
        "MinBonusAS": 0.20000000298023224,
        "{0e9453af}": null,
        "{bdb9953b}": 200.0
      }
    },
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 3,
      "variables": {
        "MaxBonusAS": 0.800000011920929,
        "MinBonusAS": 0.30000001192092896,
        "{0e9453af}": null,
        "{bdb9953b}": 200.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "MaxBonusAS": 1.0,
        "MinBonusAS": 0.4000000059604645,
        "ShieldAmount": 200.0,
        "ShieldDuration": 3.0,
        "{0e9453af}": null,
        "{bdb9953b}": 200.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 2 | {"MaxBonusAS":0.6,"MinBonusAS":0.2,"{0e9453af}":null,"{bdb9953b}":200} |
| 3 | 3 | {"MaxBonusAS":0.8,"MinBonusAS":0.3,"{0e9453af}":null,"{bdb9953b}":200} |
| 4 | 25000 | {"MaxBonusAS":1,"MinBonusAS":0.4,"ShieldAmount":200,"ShieldDuration":3,"{0e9453af}":null,"{bdb9953b}":200} |

### TFT13_Crime — Chem-Baron

来源：`/setData/1/traits/18`；完整记录SHA-256 `0fca89eb05a172271b7003ae6b2950139f3442810d5ad0fc652ba35c853b75b9`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Crime",
  "name": "Chem-Baron",
  "desc": "Gain Shimmer after each player combat. If your loss streak is at least @MinStreakLength@, gain more.<br><br>At each stack of @ShimmerBreakpoint@ Shimmer, the Black Market offers you contraband that only Chem-Barons can use. Chem-Barons gain max Health for each Black Market you pass on.<br><br><expandRow>(@MinUnits@) @ShimmerPerCombat@ or @ShimmerPerCombatStreaking@; @HealthPerSkip@&nbsp;%i:scaleHealth%</expandRow><br><br><rules>Markets Skipped: @TFTUnitProperty.trait:TFT13_Crime_PassedMarkets@</rules><br><rules>Current Health: @TFTUnitProperty.trait:TFT13_Crime_CurrentHealth@&nbsp;%i:scaleHealth%</rules>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 1,
      "variables": {
        "HealthPerSkip": 20.0,
        "MinStreakLength": 3.0,
        "ShimmerBreakpoint": 100.0,
        "ShimmerPerCombat": 15.0,
        "ShimmerPerCombatStreaking": 35.0,
        "ShimmerPerCombatStreaking_HR": 50.0,
        "ShimmerPerCombat_HR": 25.0,
        "ShimmerPerDeath_PVE": 1.0,
        "ShimmerPerRound_PVE": 15.0,
        "{ecbc38fd}": 1.0
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "HealthPerSkip": 60.0,
        "MinStreakLength": 3.0,
        "ShimmerBreakpoint": 100.0,
        "ShimmerPerCombat": 20.0,
        "ShimmerPerCombatStreaking": 45.0,
        "ShimmerPerCombatStreaking_HR": 60.0,
        "ShimmerPerCombat_HR": 30.0,
        "ShimmerPerDeath_PVE": 1.0,
        "ShimmerPerRound_PVE": 20.0,
        "{ecbc38fd}": 1.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "HealthPerSkip": 110.0,
        "MinStreakLength": 3.0,
        "ShimmerBreakpoint": 100.0,
        "ShimmerPerCombat": 20.0,
        "ShimmerPerCombatStreaking": 55.0,
        "ShimmerPerCombatStreaking_HR": 70.0,
        "ShimmerPerCombat_HR": 35.0,
        "ShimmerPerDeath_PVE": 2.0,
        "ShimmerPerRound_PVE": 30.0,
        "{ecbc38fd}": 1.0
      }
    },
    {
      "maxUnits": 6,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "HealthPerSkip": 160.0,
        "MinStreakLength": 3.0,
        "ShimmerBreakpoint": 100.0,
        "ShimmerPerCombat": 25.0,
        "ShimmerPerCombatStreaking": 70.0,
        "ShimmerPerCombatStreaking_HR": 90.0,
        "ShimmerPerCombat_HR": 45.0,
        "ShimmerPerDeath_PVE": 3.0,
        "ShimmerPerRound_PVE": 40.0,
        "{ecbc38fd}": 1.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 7,
      "style": 5,
      "variables": {
        "HealthPerSkip": 220.0,
        "MinStreakLength": 3.0,
        "ShimmerBreakpoint": 100.0,
        "ShimmerPerCombat": 30.0,
        "ShimmerPerCombatStreaking": 100.0,
        "ShimmerPerCombatStreaking_HR": 125.0,
        "ShimmerPerCombat_HR": 60.0,
        "ShimmerPerDeath_PVE": 15.0,
        "ShimmerPerRound_PVE": 65.0,
        "{ecbc38fd}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 3 | {"HealthPerSkip":20,"MinStreakLength":3,"ShimmerBreakpoint":100,"ShimmerPerCombat":15,"ShimmerPerCombatStreaking":35,"ShimmerPerCombatStreaking_HR":50,"ShimmerPerCombat_HR":25,"ShimmerPerDeath_PVE":1,"ShimmerPerRound_PVE":15,"{ecbc38fd}":1} |
| 4 | 4 | {"HealthPerSkip":60,"MinStreakLength":3,"ShimmerBreakpoint":100,"ShimmerPerCombat":20,"ShimmerPerCombatStreaking":45,"ShimmerPerCombatStreaking_HR":60,"ShimmerPerCombat_HR":30,"ShimmerPerDeath_PVE":1,"ShimmerPerRound_PVE":20,"{ecbc38fd}":1} |
| 5 | 5 | {"HealthPerSkip":110,"MinStreakLength":3,"ShimmerBreakpoint":100,"ShimmerPerCombat":20,"ShimmerPerCombatStreaking":55,"ShimmerPerCombatStreaking_HR":70,"ShimmerPerCombat_HR":35,"ShimmerPerDeath_PVE":2,"ShimmerPerRound_PVE":30,"{ecbc38fd}":1} |
| 6 | 6 | {"HealthPerSkip":160,"MinStreakLength":3,"ShimmerBreakpoint":100,"ShimmerPerCombat":25,"ShimmerPerCombatStreaking":70,"ShimmerPerCombatStreaking_HR":90,"ShimmerPerCombat_HR":45,"ShimmerPerDeath_PVE":3,"ShimmerPerRound_PVE":40,"{ecbc38fd}":1} |
| 7 | 25000 | {"HealthPerSkip":220,"MinStreakLength":3,"ShimmerBreakpoint":100,"ShimmerPerCombat":30,"ShimmerPerCombatStreaking":100,"ShimmerPerCombatStreaking_HR":125,"ShimmerPerCombat_HR":60,"ShimmerPerDeath_PVE":15,"ShimmerPerRound_PVE":65,"{ecbc38fd}":1} |

### TFT13_Experiment — Experiment

来源：`/setData/1/traits/26`；完整记录SHA-256 `dd37b2a8e576618d596c4ce1122fa3a4cda2da1c9ceac1cebf00a591a2972c5e`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Experiment",
  "name": "Experiment",
  "desc": "Gain Laboratory hexes on your board.<br><br>Combat start: Experiments standing on Laboratory hexes gain the Experiment bonuses of all Experiments on Laboratory hexes, plus max Health.<br><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) Experiment bonuses increase by @ExperimentBonusIncrease*100@%!</row>",
  "effects": [
    {
      "maxUnits": 4,
      "minUnits": 3,
      "style": 1,
      "variables": {
        "ExperimentBonusIncrease": null,
        "MaxHealth": 100.0,
        "NumLaboratory": 2.0,
        "{a02e81c2}": 1.149999976158142
      }
    },
    {
      "maxUnits": 6,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "ExperimentBonusIncrease": null,
        "MaxHealth": 300.0,
        "NumLaboratory": 3.0,
        "{a02e81c2}": 1.2999999523162842
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 7,
      "style": 5,
      "variables": {
        "ExperimentBonusIncrease": 1.0,
        "MaxHealth": 300.0,
        "NumLaboratory": 3.0,
        "{a02e81c2}": 1.5
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 4 | {"ExperimentBonusIncrease":null,"MaxHealth":100,"NumLaboratory":2,"{a02e81c2}":1.15} |
| 5 | 6 | {"ExperimentBonusIncrease":null,"MaxHealth":300,"NumLaboratory":3,"{a02e81c2}":1.3} |
| 7 | 25000 | {"ExperimentBonusIncrease":1,"MaxHealth":300,"NumLaboratory":3,"{a02e81c2}":1.5} |

### TFT13_Family — Family

来源：`/setData/1/traits/10`；完整记录SHA-256 `3e90d83f47746fe473edadb9b826a0e7aaf66046e786fab5339f47001470ada2`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Family",
  "name": "Family",
  "desc": "Family members support each other, reducing their max Mana and gaining extra bonuses.<br><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @DamageReduction*100@%&nbsp;%i:scaleDR%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @AttackSpeed*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, heist on topside! After combat, progress the heist, increased for each surviving Family&nbsp;member!</row><br><br><rules>@TFTUnitProperty.trait:TFT13_JunkerKing_SelfDestructTRA@</rules>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 5,
      "variables": {
        "AttackSpeed": 0.20000000298023224,
        "DamageReduction": 0.20000000298023224,
        "ManaReduction": 0.25
      }
    },
    {
      "maxUnits": 4,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "AttackSpeed": 0.20000000298023224,
        "DamageReduction": 0.20000000298023224,
        "ManaReduction": 0.30000001192092896
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 5,
      "style": 5,
      "variables": {
        "AttackSpeed": 0.20000000298023224,
        "DamageReduction": 0.20000000298023224,
        "ManaReduction": 0.4000000059604645,
        "{01fcc30b}": 0.75,
        "{217874f1}": 2.5,
        "{43cb93dd}": 1.25,
        "{46c3fc24}": 1.5,
        "{6fc9f267}": 17.0,
        "{8173be81}": 2.0,
        "{9000fe5b}": 2.0,
        "{92029cea}": 0.5
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 3 | {"AttackSpeed":0.2,"DamageReduction":0.2,"ManaReduction":0.25} |
| 4 | 4 | {"AttackSpeed":0.2,"DamageReduction":0.2,"ManaReduction":0.3} |
| 5 | 25000 | {"AttackSpeed":0.2,"DamageReduction":0.2,"ManaReduction":0.4,"{01fcc30b}":0.75,"{217874f1}":2.5,"{43cb93dd}":1.25,"{46c3fc24}":1.5,"{6fc9f267}":17,"{8173be81}":2,"{9000fe5b}":2,"{92029cea}":0.5} |

### TFT13_FormSwapper — Form Swapper

来源：`/setData/1/traits/5`；完整记录SHA-256 `a08c37d550d03dc3af6780ec3c621373e092fb0830f837b9c7bc652e3ae46bd2`；分类：常规/专属。

```json
{
  "apiName": "TFT13_FormSwapper",
  "name": "Form Swapper",
  "desc": "Innate: Form Swappers change their stats and ability based on if they're placed in the front 2 rows or back 2&nbsp;rows.<br><br>Frontline Form Swappers gain Durability. Backline Form Swappers gain Damage&nbsp;Amp.<br><br><expandRow>(@MinUnits@) @DR*100@%&nbsp;%i:scaleDR% or @DA*100@%&nbsp;%i:scaleDA%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "DA": 0.20000000298023224,
        "DR": 0.15000000596046448
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "DA": 0.4000000059604645,
        "DR": 0.30000001192092896
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"DA":0.2,"DR":0.15} |
| 4 | 25000 | {"DA":0.4,"DR":0.3} |

### TFT13_Hextech — Automata

来源：`/setData/1/traits/0`；完整记录SHA-256 `c2c700bbea168f5cd379e7171646e39d682ffd15b3e7361936ca30e467d070e8`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Hextech",
  "name": "Automata",
  "desc": "Automata gain a crystal when they deal damage. At @TriggerNumCrystals@&nbsp;crystals, they blast their current target, dealing magic damage + <magicDamage>@ConversionDamagePct*100@%</magicDamage> of damage dealt since the previous blast and reset. They also gain Armor and Magic&nbsp;Resist.<br><br><expandRow>(@MinUnits@) <magicDamage>@MagicDamage@</magicDamage> damage, @Resists@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "ConversionDamagePct": 0.25,
        "MagicDamage": 150.0,
        "Resists": 25.0,
        "TriggerNumCrystals": 20.0,
        "{a142f31c}": 1.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "ConversionDamagePct": 0.25,
        "MagicDamage": 400.0,
        "Resists": 60.0,
        "TriggerNumCrystals": 20.0,
        "{a142f31c}": 1.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "ConversionDamagePct": 0.25,
        "MagicDamage": 1100.0,
        "Resists": 140.0,
        "TriggerNumCrystals": 20.0,
        "{a142f31c}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"ConversionDamagePct":0.25,"MagicDamage":150,"Resists":25,"TriggerNumCrystals":20,"{a142f31c}":1} |
| 4 | 5 | {"ConversionDamagePct":0.25,"MagicDamage":400,"Resists":60,"TriggerNumCrystals":20,"{a142f31c}":1} |
| 6 | 25000 | {"ConversionDamagePct":0.25,"MagicDamage":1100,"Resists":140,"TriggerNumCrystals":20,"{a142f31c}":1} |

### TFT13_HighRoller — High Roller

来源：`/setData/1/traits/16`；完整记录SHA-256 `dffe810bca6397d154fcc8f6e4e2f0b8dd85280e656200f4dfeafe8335600dac`；分类：常规/专属。

```json
{
  "apiName": "TFT13_HighRoller",
  "name": "High Roller",
  "desc": "When casting, Sevika rolls a random Jinx modification to her Ability and gains @Durability*100@% Durability for @Duration@ seconds.<br><br>Mods:<br>-Rocket: Launch @Bonus1NumRockets@ rockets that deal @Bonus1RocketDamage@ physical damage each<br>-Shield: Gain @Bonus2ShieldAmount@ Shield for @Bonus2ShieldDuration@ seconds<br>-Coin: Gain @Bonus4Gold@ gold<br>-Triple: Enhance her rolled ability!",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {
        "Bonus1NumRockets": 8.0,
        "Bonus1RocketDamage": 100.0,
        "Bonus2ShieldAmount": 500.0,
        "Bonus2ShieldDuration": 4.0,
        "Bonus4Gold": 3.0,
        "Durability": 0.800000011920929,
        "Duration": 1.5,
        "{01148678}": 0.3499999940395355,
        "{267deafa}": 0.3499999940395355,
        "{52aec87f}": 0.10000000149011612,
        "{592d23e5}": 0.3499999940395355,
        "{699f6a87}": 0.20000000298023224,
        "{9ad9e572}": 0.004999999888241291,
        "{9b22c5ec}": null,
        "{bcedb441}": 1.5,
        "{e1fc0fa1}": 0.24500000476837158,
        "{e640e05f}": 0.4000000059604645
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 25000 | {"Bonus1NumRockets":8,"Bonus1RocketDamage":100,"Bonus2ShieldAmount":500,"Bonus2ShieldDuration":4,"Bonus4Gold":3,"Durability":0.8,"Duration":1.5,"{01148678}":0.35,"{267deafa}":0.35,"{52aec87f}":0.1,"{592d23e5}":0.35,"{699f6a87}":0.2,"{9ad9e572}":0.005,"{9b22c5ec}":null,"{bcedb441}":1.5,"{e1fc0fa1}":0.245,"{e640e05f}":0.4} |

### TFT13_Hoverboard — Firelight

来源：`/setData/1/traits/24`；完整记录SHA-256 `ba5464a542595503ad156eed412037d609ec7e2173b28d9f00b3f6a402340a8a`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Hoverboard",
  "name": "Firelight",
  "desc": "Every @Duration@ seconds, Firelights dash. While dashing, they attack with infinite range and heal a percentage of the damage taken since their last dash.<br><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken. While dashing, gain a massive burst of Attack Speed.</row>",
  "effects": [
    {
      "maxUnits": 2,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "Duration": 6.0,
        "PercentDamageTakenHeal": 0.20000000298023224,
        "{0a9a9714}": null,
        "{3c0d594a}": 1.0
      }
    },
    {
      "maxUnits": 3,
      "minUnits": 3,
      "style": 5,
      "variables": {
        "Duration": 6.0,
        "PercentDamageTakenHeal": 0.33000001311302185,
        "{0a9a9714}": null,
        "{3c0d594a}": 1.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "Duration": 6.0,
        "PercentDamageTakenHeal": 0.4000000059604645,
        "{0a9a9714}": 3.5,
        "{3c0d594a}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 2 | {"Duration":6,"PercentDamageTakenHeal":0.2,"{0a9a9714}":null,"{3c0d594a}":1} |
| 3 | 3 | {"Duration":6,"PercentDamageTakenHeal":0.33,"{0a9a9714}":null,"{3c0d594a}":1} |
| 4 | 25000 | {"Duration":6,"PercentDamageTakenHeal":0.4,"{0a9a9714}":3.5,"{3c0d594a}":1} |

### TFT13_Infused — Dominator

来源：`/setData/1/traits/20`；完整记录SHA-256 `a7c3345afd4354519c69186abf05306aa87b4bd9d6cdb25768ce803001283e4c`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Infused",
  "name": "Dominator",
  "desc": "Combat start: Dominators gain a Shield for @ShieldDuration@ seconds.<br><br>When Dominators cast, they gain stacking Ability Power based on the Mana spent.<br><br><expandRow>(@MinUnits@) @ShieldAmount@ Shield, @APPercent*100@%&nbsp;%i:scaleAP%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "APPercent": 0.25,
        "ShieldAmount": 350.0,
        "ShieldDuration": 15.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "APPercent": 0.44999998807907104,
        "ShieldAmount": 500.0,
        "ShieldDuration": 15.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "APPercent": 0.6499999761581421,
        "ShieldAmount": 700.0,
        "ShieldDuration": 15.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"APPercent":0.25,"ShieldAmount":350,"ShieldDuration":15} |
| 4 | 5 | {"APPercent":0.45,"ShieldAmount":500,"ShieldDuration":15} |
| 6 | 25000 | {"APPercent":0.65,"ShieldAmount":700,"ShieldDuration":15} |

### TFT13_Invoker — Visionary

来源：`/setData/1/traits/13`；完整记录SHA-256 `2c26ad80e12ef92fcd300cc82b78bc4d8b2d4a3fb96115a9e65fc9a3d15b8cd4`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Invoker",
  "name": "Visionary",
  "desc": "Whenever Visionaries gain Mana, they gain more.<br><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%, Abilities heal an ally for @AllyHealing*100@% of damage dealt</row><br>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "EnlightenedBonusMana": 0.25
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "EnlightenedBonusMana": 0.5
      }
    },
    {
      "maxUnits": 7,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "EnlightenedBonusMana": 0.800000011920929
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 8,
      "style": 5,
      "variables": {
        "AllyHealing": 0.20000000298023224,
        "EnlightenedBonusMana": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"EnlightenedBonusMana":0.25} |
| 4 | 5 | {"EnlightenedBonusMana":0.5} |
| 6 | 7 | {"EnlightenedBonusMana":0.8} |
| 8 | 25000 | {"AllyHealing":0.2,"EnlightenedBonusMana":1} |

### TFT13_JunkerKing — Junker King

来源：`/setData/1/traits/28`；完整记录SHA-256 `e800f66a9e3f0fe2cf6caeb3af74e4eb7b52c9c6fc44a5c55c61959e0a243595`；分类：常规/专属。

```json
{
  "apiName": "TFT13_JunkerKing",
  "name": "Junker King",
  "desc": "Every @NumRounds1Star@ rounds, open an armory to purchase permanent upgrades to your strongest Rumble's&nbsp;mech.<br><br><rules>Rounds Until Upgrade: @TFTUnitProperty.trait:TFT13_JunkerKing_RoundsUntilOpening@</rules>",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {
        "NumRounds1Star": 3.0,
        "NumRounds1Star_HR": 2.0,
        "{7b91cfd3}": 2.0,
        "{da177dfb}": 1.0,
        "{ea33712c}": 3.0,
        "{ed4fa85a}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 25000 | {"NumRounds1Star":3,"NumRounds1Star_HR":2,"{7b91cfd3}":2,"{da177dfb}":1,"{ea33712c}":3,"{ed4fa85a}":1} |

### TFT13_MachineHerald — Machine Herald

来源：`/setData/8/traits/30`；完整记录SHA-256 `eb24196e4b887f1844c06f3227455342de17ec05ca5ef0138eb6dd79e230948c`；分类：常规/专属。

```json
{
  "apiName": "TFT13_MachineHerald",
  "name": "Machine Herald",
  "desc": "Viktor has a fixed Attack Speed of @AS@ attacks per second and converts ALL bonus Attack Damage, Attack Speed, and Mana into Ability Power. <br><br>Instead of Mana, Viktor gains 1 Chaos Energy every attack and casts when he has @MaxMana@.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {
        "AS": 0.550000011920929,
        "MaxMana": 8.0,
        "startingmana": 4.0,
        "{80af2f77}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 25000 | {"AS":0.55,"MaxMana":8,"startingmana":3,"{80af2f77}":1} |

资源字段startingmana原4→B3，MaxMana8；AS0.55。原始英雄stats法力0/100仅载体，转换比例和资源资格见Q11。

### TFT13_Martialist — Artillerist

来源：`/setData/1/traits/4`；完整记录SHA-256 `d081ea2fab85f4036e281f1b878aa15a3d9bf688a1c7b81005c86eacf62c64b0`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Martialist",
  "name": "Artillerist",
  "desc": "Every @NumOfAttacks@ attacks, Artillerists launch a rocket that deals @PercentDamage*100@% Attack Damage around the target. They also gain Attack Damage.<br><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%, Launch a rocket every @NumOfAttacks@ attacks that deals double&nbsp;damage.</row>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "AD": 0.10000000149011612,
        "NumOfAttacks": 5.0,
        "PercentDamage": 1.25
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "AD": 0.44999998807907104,
        "NumOfAttacks": 5.0,
        "PercentDamage": 1.25
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "AD": 0.6000000238418579,
        "NumOfAttacks": 4.0,
        "PercentDamage": 2.5
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"AD":0.1,"NumOfAttacks":5,"PercentDamage":1.25} |
| 4 | 5 | {"AD":0.45,"NumOfAttacks":5,"PercentDamage":1.25} |
| 6 | 25000 | {"AD":0.7,"NumOfAttacks":4,"PercentDamage":2.5} |

### TFT13_MissMageTrait — Banished Mage

来源：`/setData/8/traits/4`；完整记录SHA-256 `e2f7addd99ba432b9bab065d27f3577cd663c0df513897b814e23479738cae66`；分类：常规/专属。

```json
{
  "apiName": "TFT13_MissMageTrait",
  "name": "Banished Mage",
  "desc": "The first time you would be eliminated, if Mel has cast @MinimumCasts@ times during player combat this game, she saves you and you remain alive. <br><br>Afterwards, Mel permanently gains @ProcDamageAmp*100@% Damage Amp.<br><br>@TFTUnitProperty.:TFT13_MissMageTrait_TrackerTRA@",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {
        "MinimumCasts": 12.0,
        "MinimumCastsDU": 12.0,
        "MinimumCastsHR": 6.0,
        "MissMageHealDU": 15.0,
        "ProcDamageAmp": 0.10000000149011612,
        "ProcDamageAmpDU": 0.10000000149011612,
        "ProcDamageAmpHR": 0.10000000149011612,
        "{00885e86}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 1 | 25000 | {"MinimumCasts":12,"MinimumCastsDU":12,"MinimumCastsHR":6,"MissMageHealDU":15,"ProcDamageAmp":0.1,"ProcDamageAmpDU":0.1,"ProcDamageAmpHR":0.1,"{00885e86}":1} |

标准MinimumCasts12；HR6/DU参数保留不采用。官方说明救至1HP、后获10%永久增伤；玩家免淘汰属于S13，见Q12。

### TFT13_Pugilist — Pit Fighter

来源：`/setData/1/traits/21`；完整记录SHA-256 `eb89ea48f9c54c0565d6afce7b37ada81e5a71a6dfe3505710ae069b7ecb630d`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Pugilist",
  "name": "Pit Fighter",
  "desc": "Pit Fighters gain @OmnivampPercent*100@% Omnivamp and deal bonus true damage. Once per combat at @HealthThreshold*100@% Health, they heal a percentage of their max Health over @Duration@ seconds.<br><br><expandRow>(@MinUnits@) @TrueDamagePercent*100@%&nbsp;true damage, @HealPercent*100@%&nbsp;%i:scaleHealth%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "Duration": 2.0,
        "HealPercent": 0.10000000149011612,
        "HealthThreshold": 0.5,
        "OmnivampPercent": 0.15000000596046448,
        "TrueDamagePercent": 0.05999999865889549
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "Duration": 2.0,
        "HealPercent": 0.25,
        "HealthThreshold": 0.5,
        "OmnivampPercent": 0.15000000596046448,
        "TrueDamagePercent": 0.11999999731779099
      }
    },
    {
      "maxUnits": 7,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "Duration": 2.0,
        "HealPercent": 0.4000000059604645,
        "HealthThreshold": 0.5,
        "OmnivampPercent": 0.15000000596046448,
        "TrueDamagePercent": 0.20000000298023224
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 8,
      "style": 5,
      "variables": {
        "Duration": 2.0,
        "HealPercent": 0.800000011920929,
        "HealthThreshold": 0.5,
        "OmnivampPercent": 0.15000000596046448,
        "TrueDamagePercent": 0.4000000059604645
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"Duration":2,"HealPercent":0.1,"HealthThreshold":0.5,"OmnivampPercent":0.15,"TrueDamagePercent":0.06} |
| 4 | 5 | {"Duration":2,"HealPercent":0.25,"HealthThreshold":0.5,"OmnivampPercent":0.15,"TrueDamagePercent":0.12} |
| 6 | 7 | {"Duration":2,"HealPercent":0.4,"HealthThreshold":0.5,"OmnivampPercent":0.15,"TrueDamagePercent":0.2} |
| 8 | 25000 | {"Duration":2,"HealPercent":0.8,"HealthThreshold":0.5,"OmnivampPercent":0.15,"TrueDamagePercent":0.4} |

### TFT13_Rebel — Rebel

来源：`/setData/1/traits/19`；完整记录SHA-256 `897d8f5748f0214b5dff96cd8f0e10ecd27debe636d4b59f924d60f86741fad9`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Rebel",
  "name": "Rebel",
  "desc": "Rebels gain @MaxHealthIncrease*100@% max Health.<br><br>After your team loses @PercentHealthTrigger*100@% of their Health, a smoke signal appears, granting Rebels @BurstAS*100@% Attack Speed for @BurstDuration@ seconds and extra power for the rest of&nbsp;combat.<br><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%, and Stun all enemies for @StunDuration@&nbsp;seconds</row><br><row>(@MinUnits@) The smoke signal triggers at Combat Start and every @ForceDuration@&nbsp;seconds.</row>",
  "effects": [
    {
      "maxUnits": 4,
      "minUnits": 3,
      "style": 1,
      "variables": {
        "ADAP": 0.20000000298023224,
        "BurstAS": 0.6000000238418579,
        "BurstDuration": 5.0,
        "ForceDuration": null,
        "MaxHealthIncrease": 0.11999999731779099,
        "PercentHealthTrigger": 0.25,
        "PercentMaxHealthBonus": null,
        "StunDuration": null,
        "{1ec59053}": null
      }
    },
    {
      "maxUnits": 6,
      "minUnits": 5,
      "style": 3,
      "variables": {
        "ADAP": 0.4000000059604645,
        "BurstAS": 0.6000000238418579,
        "BurstDuration": 5.0,
        "ForceDuration": null,
        "MaxHealthIncrease": 0.11999999731779099,
        "PercentHealthTrigger": 0.25,
        "PercentMaxHealthBonus": 0.11999999731779099,
        "StunDuration": null,
        "{1ec59053}": null
      }
    },
    {
      "maxUnits": 9,
      "minUnits": 7,
      "style": 5,
      "variables": {
        "ADAP": 0.44999998807907104,
        "BurstAS": 0.6000000238418579,
        "BurstDuration": 5.0,
        "ForceDuration": null,
        "MaxHealthIncrease": 0.11999999731779099,
        "PercentHealthTrigger": 0.25,
        "PercentMaxHealthBonus": 0.15000000596046448,
        "StunDuration": 2.0,
        "{1ec59053}": null
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 10,
      "style": 6,
      "variables": {
        "ADAP": 0.5,
        "BurstAS": 0.6000000238418579,
        "BurstDuration": 5.0,
        "ForceDuration": 12.0,
        "MaxHealthIncrease": 0.11999999731779099,
        "PercentHealthTrigger": 0.25,
        "PercentMaxHealthBonus": 0.30000001192092896,
        "StunDuration": 2.0,
        "{1ec59053}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 3 | 4 | {"ADAP":0.2,"BurstAS":0.6,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.12,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":null,"StunDuration":null,"{1ec59053}":null} |
| 5 | 6 | {"ADAP":0.4,"BurstAS":0.6,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.12,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.12,"StunDuration":null,"{1ec59053}":null} |
| 7 | 9 | {"ADAP":0.45,"BurstAS":0.6,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.12,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.15,"StunDuration":2,"{1ec59053}":null} |
| 10 | 25000 | {"ADAP":0.5,"BurstAS":0.6,"BurstDuration":5,"ForceDuration":12,"MaxHealthIncrease":0.12,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.3,"StunDuration":2,"{1ec59053}":1} |

### TFT13_Scrap — Scrap

来源：`/setData/1/traits/3`；完整记录SHA-256 `90d73c499e7b86decdb4712c3f2842c1a30605a0e46a23b74d1638692c479c47`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Scrap",
  "name": "Scrap",
  "desc": "Combat start: Components held by Scrap units temporarily turn into full items. Scrap units gain Shield for @ShieldDuration@ seconds for each component held by your team, including those that make up a full item.<br><br><row>(@MinUnits@) @NumComponents@ component, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) @NumComponents@ components, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) All components, and full items become lucky! @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) Generate Radiant items! @HPShieldAmount@ Shield</row><br><br><rules>Shield Amount:&nbsp;@TFTUnitProperty.:TFT13_Trait_Scrap_ShieldTotal@ </rules> <br>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "HPShieldAmount": 25.0,
        "NumComponents": 1.0,
        "ShieldDuration": 20.0,
        "{659aef8d}": null,
        "{7e2474c8}": null
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "HPShieldAmount": 35.0,
        "NumComponents": 3.0,
        "ShieldDuration": 20.0,
        "{659aef8d}": null,
        "{7e2474c8}": null
      }
    },
    {
      "maxUnits": 8,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "HPShieldAmount": 50.0,
        "NumComponents": 20.0,
        "ShieldDuration": 20.0,
        "{659aef8d}": 1.0,
        "{7e2474c8}": null
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 9,
      "style": 5,
      "variables": {
        "HPShieldAmount": 60.0,
        "NumComponents": 20.0,
        "ShieldDuration": 20.0,
        "{659aef8d}": 1.0,
        "{7e2474c8}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"HPShieldAmount":25,"NumComponents":1,"ShieldDuration":20,"{659aef8d}":null,"{7e2474c8}":null} |
| 4 | 5 | {"HPShieldAmount":35,"NumComponents":3,"ShieldDuration":20,"{659aef8d}":null,"{7e2474c8}":null} |
| 6 | 8 | {"HPShieldAmount":50,"NumComponents":20,"ShieldDuration":20,"{659aef8d}":1,"{7e2474c8}":null} |
| 9 | 25000 | {"HPShieldAmount":60,"NumComponents":20,"ShieldDuration":20,"{659aef8d}":1,"{7e2474c8}":1} |

### TFT13_Sniper — Sniper

来源：`/setData/1/traits/14`；完整记录SHA-256 `13dd5ac2ebb8442285868a4b3edec92709bdfee00c2de3374e6ac96056115bfe`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Sniper",
  "name": "Sniper",
  "desc": "Snipers deal more damage to targets farther away.<br><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex and +@BonusHexRangeIncrease@ Attack Range</row>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "BonusHexRangeIncrease": null,
        "PercentDamageIncrease": 7.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 5,
      "variables": {
        "BonusHexRangeIncrease": null,
        "PercentDamageIncrease": 16.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BonusHexRangeIncrease": 5.0,
        "PercentDamageIncrease": 35.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"BonusHexRangeIncrease":null,"PercentDamageIncrease":7} |
| 4 | 5 | {"BonusHexRangeIncrease":null,"PercentDamageIncrease":18} |
| 6 | 25000 | {"BonusHexRangeIncrease":5,"PercentDamageIncrease":36} |

### TFT13_Sorcerer — Sorcerer

来源：`/setData/1/traits/2`；完整记录SHA-256 `d6a1dad3defb7a0daa3a75a8fece467a6857ed82614e19e9ceba21d8687d6715`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Sorcerer",
  "name": "Sorcerer",
  "desc": "Your team gains @TeamAP@ Ability Power. Sorcerers gain more.<br><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%, Abilities reduce their target's damage by @DamageDecrease*100@% for @DamageDecreaseDuration@&nbsp;seconds</row>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "BaseAP": 20.0,
        "TeamAP": 10.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "BaseAP": 50.0,
        "TeamAP": 10.0
      }
    },
    {
      "maxUnits": 7,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BaseAP": 95.0,
        "TeamAP": 10.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 8,
      "style": 5,
      "variables": {
        "BaseAP": 110.0,
        "DamageDecrease": 0.25,
        "DamageDecreaseDuration": 3.0,
        "TeamAP": 10.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"BaseAP":20,"TeamAP":10} |
| 4 | 5 | {"BaseAP":50,"TeamAP":10} |
| 6 | 7 | {"BaseAP":95,"TeamAP":10} |
| 8 | 25000 | {"BaseAP":125,"DamageDecrease":0.25,"DamageDecreaseDuration":3,"TeamAP":10} |

### TFT13_Squad — Enforcer

来源：`/setData/1/traits/23`；完整记录SHA-256 `014de0cfd8af1496b5e1f5e7523863ec90d467881c4eda9f992f6ac10bb657bf`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Squad",
  "name": "Enforcer",
  "desc": "Combat Start: Enforcers gain Shield and Damage Amp. The highest Health enemy units become <i>WANTED!</i> <br><br>When a Wanted enemy dies, Enforcers gain @AttackSpeedPerWantedKill*100@% Attack Speed.<br><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;unit; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) ALL enemies; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%, @BaseDA*100@%&nbsp;%i:scaleDA%; Combat Start: Confiscate all enemy&nbsp;items!</row>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "AttackSpeedPerWantedKill": 0.30000001192092896,
        "BaseDA": 0.11999999731779099,
        "NumOfWantedEnemies": 1.0,
        "PercentMaxHealthShield": 0.11999999731779099,
        "{36b1550f}": null,
        "{9edd4912}": null
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "AttackSpeedPerWantedKill": 0.30000001192092896,
        "BaseDA": 0.20000000298023224,
        "NumOfWantedEnemies": 2.0,
        "PercentMaxHealthShield": 0.20000000298023224,
        "{36b1550f}": null,
        "{9edd4912}": null
      }
    },
    {
      "maxUnits": 7,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "AttackSpeedPerWantedKill": 0.30000001192092896,
        "BaseDA": 0.33000001311302185,
        "NumOfWantedEnemies": 4.0,
        "PercentMaxHealthShield": 0.30000001192092896,
        "{36b1550f}": null,
        "{9edd4912}": null
      }
    },
    {
      "maxUnits": 9,
      "minUnits": 8,
      "style": 5,
      "variables": {
        "AttackSpeedPerWantedKill": 0.30000001192092896,
        "BaseDA": 0.5,
        "NumOfWantedEnemies": 5.0,
        "PercentMaxHealthShield": 0.4000000059604645,
        "{36b1550f}": null,
        "{9edd4912}": null
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 10,
      "style": 6,
      "variables": {
        "AttackSpeedPerWantedKill": 0.30000001192092896,
        "BaseDA": 1.5,
        "NumOfWantedEnemies": 99.0,
        "PercentMaxHealthShield": 1.0,
        "{36b1550f}": null,
        "{9edd4912}": 1.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"AttackSpeedPerWantedKill":0.3,"BaseDA":0.12,"NumOfWantedEnemies":1,"PercentMaxHealthShield":0.12,"{36b1550f}":null,"{9edd4912}":null} |
| 4 | 5 | {"AttackSpeedPerWantedKill":0.3,"BaseDA":0.2,"NumOfWantedEnemies":2,"PercentMaxHealthShield":0.2,"{36b1550f}":null,"{9edd4912}":null} |
| 6 | 7 | {"AttackSpeedPerWantedKill":0.3,"BaseDA":0.33,"NumOfWantedEnemies":4,"PercentMaxHealthShield":0.3,"{36b1550f}":null,"{9edd4912}":null} |
| 8 | 9 | {"AttackSpeedPerWantedKill":0.3,"BaseDA":0.5,"NumOfWantedEnemies":5,"PercentMaxHealthShield":0.4,"{36b1550f}":null,"{9edd4912}":null} |
| 10 | 25000 | {"AttackSpeedPerWantedKill":0.3,"BaseDA":1.5,"NumOfWantedEnemies":99,"PercentMaxHealthShield":1,"{36b1550f}":null,"{9edd4912}":1} |

文案的PercentMaxHealthShield*100*100有重复百分比显示疑点，采纳effects的比例（2/4/6/8/10档12/20/30/40/100%），不把显示宏100倍当真实护盾。10档没收资格以14.24公告排除非英雄和纹章，生命周期见Q09。

### TFT13_Teamup_Betrayal — Betrayal

来源：`/setData/8/traits/28`；完整记录SHA-256 `ea80a4b4b22c49b3561a6ff6492d7ac45f818d063127d559c9a8f3d8ae445f50`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Betrayal",
  "name": "Betrayal",
  "desc": "Maddie always targets Ambessa's target with her Ability and attacks. Every round where either gets at least @NumKills@ kill, gain a Maddie.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "NumKills": 2.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"NumKills":2} |

### TFT13_Teamup_BloodBrothers — What Could Have Been

来源：`/setData/1/traits/22`；完整记录SHA-256 `a377ba86339e954cc114261fc5895932fca97d549c0199b5d192f7ae70f49f3f`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_BloodBrothers",
  "name": "What Could Have Been",
  "desc": "Vander gains @TFTTrait.TFT13_Teamup_BloodBrothers.1:MaxHealthGainPerCast@ permanent max Health for each time Silco casts. Silco gains @TFTTrait.TFT13_Teamup_BloodBrothers.1:APGainPerDeath@ permanent Ability Power for each time Vander dies.<br><br>Bonuses: @TFTUnitProperty.trait:TFT13_Sidekick_BloodBrothers_HealthGained@ %i:scaleHealth% | @TFTUnitProperty.trait:TFT13_Sidekick_BloodBrothers_APGained@ %i:scaleAP%",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "APGainPerDeath": 6.0,
        "MaxHealthGainPerCast": 30.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"APGainPerDeath":6,"MaxHealthGainPerCast":30} |

### TFT13_Teamup_Geniuses — Geniuses

来源：`/setData/1/traits/31`；完整记录SHA-256 `2d7bcf521cad66a0c395fa390fa7aee09349e699054b6240a47cc664619491f3`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Geniuses",
  "name": "Geniuses",
  "desc": "When Heimerdinger casts, Ekko releases @NumEkkoAfterImages@ afterimages, each dealing @ReducedEkkoDamage*100@% damage. When Ekko casts, Heimerdinger fires @NumHeimerMissiles@ missiles, each dealing @ReducedHeimerDamage*100@% damage. ",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "NumEkkoAfterImages": 3.0,
        "NumHeimerMissiles": 3.0,
        "ReducedEkkoDamage": 0.33000001311302185,
        "ReducedHeimerDamage": 1.2000000476837158
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"NumEkkoAfterImages":3,"NumHeimerMissiles":3,"ReducedEkkoDamage":0.33,"ReducedHeimerDamage":1.2} |

### TFT13_Teamup_Menaces — Menaces

来源：`/setData/1/traits/1`；完整记录SHA-256 `ad423296cbe696ee6287706b84d5b6530feca4d3ce332bd94c4a51f9311610a0`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Menaces",
  "name": "Menaces",
  "desc": "Powder gains Dominator but no longer benefits from Family. When her monkey explodes, it creates @NumMonstrosities@ of Silco's monstrosities.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "NumMonstrosities": 3.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"NumMonstrosities":3} |

### TFT13_Teamup_Mentorship — Martial Law

来源：`/setData/1/traits/7`；完整记录SHA-256 `a22640cfffa88100fd001e12e68edc59aa772fdd83720170a045a2fb084341e4`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Mentorship",
  "name": "Martial Law",
  "desc": "When Ambessa casts, Caitlyn fires an empowered attack at the target, dealing @CaitAD*100@% damage. Ambessa gains @ADShare*100@% of Caitlyn's Attack Damage.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "ADShare": 0.25,
        "CaitAD": 2.25
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"ADShare":0.25,"CaitAD":2.25} |

### TFT13_Teamup_Reunion — Reunion

来源：`/setData/1/traits/9`；完整记录SHA-256 `1f07b2b22d4d391dfc6d676d9e42ed102853dac999e469ed1e753133b7663a46`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Reunion",
  "name": "Reunion",
  "desc": "When Vi casts, Ekko releases 3 afterimages towards her target each dealing @EkkoAfterImageReducedDamage*100@% damage. When Ekko casts, Vi slams an earthquake towards his target dealing @ViEarthquakeReducedDamage*100@% damage.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "EkkoAfterImageReducedDamage": 0.5,
        "ViEarthquakeReducedDamage": 1.5
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"EkkoAfterImageReducedDamage":0.5,"ViEarthquakeReducedDamage":1.5} |

### TFT13_Teamup_Sisters — Sisters

来源：`/setData/1/traits/12`；完整记录SHA-256 `c1177d4304208b2ddeb45504f601e03b4edabe270cb64a9adcff281577b405ea`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_Sisters",
  "name": "Sisters",
  "desc": "When Jinx scores a takedown, Vi gains @ADBuff*100@% bonus Attack Damage for @ViDuration@ seconds. When Vi scores a takedown, Jinx gains @ASBuff*100@% bonus Attack Speed for @JinxDuration@ seconds.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "ADBuff": 0.4000000059604645,
        "ASBuff": 0.75,
        "JinxDuration": 5.0,
        "ViDuration": 7.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"ADBuff":0.4,"ASBuff":0.75,"JinxDuration":5,"ViDuration":7} |

### TFT13_Teamup_UnlikelyDuo — Unlikely Duo

来源：`/setData/1/traits/25`；完整记录SHA-256 `e00b8fcc2824ceaa6e3fdbe5d0937876a978294e350b6b7f53ee656e34b769fa`；分类：强化解锁关系（Q15）。

```json
{
  "apiName": "TFT13_Teamup_UnlikelyDuo",
  "name": "Unlikely Duo",
  "desc": "Jinx and Sevika gain @AD*100@% Attack Damage and @Health@ Health. Whenever one casts, they grant the other @Mana@ mana. Sevika's arm is luckier.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 2,
      "style": 4,
      "variables": {
        "AD": 0.10000000149011612,
        "Health": 100,
        "Mana": 10,
        "{1e90fa01}": 0.10000000149011612
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 25000 | {"AD":0.1,"Health":100,"Mana":10,"{1e90fa01}":0.1} |

### TFT13_Titan — Sentinel

来源：`/setData/1/traits/8`；完整记录SHA-256 `689ed3f7c9b0b625cfb8b219691a9f440cbb3aef5a97f0d3e360d3a8e4fc7fd7`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Titan",
  "name": "Sentinel",
  "desc": "Your team gains Armor and Magic Resist. Sentinels gain triple.<br><br><expandRow>(@MinUnits@) @BonusArmor@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "BonusArmor": 12.0,
        "{5921fc26}": 2.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "BonusArmor": 25.0,
        "{5921fc26}": 2.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BonusArmor": 42.0,
        "{5921fc26}": 2.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"BonusArmor":12,"{5921fc26}":2} |
| 4 | 5 | {"BonusArmor":25,"{5921fc26}":2} |
| 6 | 25000 | {"BonusArmor":42,"{5921fc26}":2} |

### TFT13_Warband — Conqueror

来源：`/setData/1/traits/15`；完整记录SHA-256 `f301b1b00489d55fcde28879a5034c6a54fe22e9c0bfebb7a550b53d502a6255`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Warband",
  "name": "Conqueror",
  "desc": "Conquerors' takedowns grant stacks of Conquest. After gaining enough Conquest, open War Chests full of loot!<br><br>Conquerors gain Attack Damage and Ability Power, increased by @PercentIncreasePerChest*100@% for each War Chest opened.<br><br><expandRow>(@MinUnits@) @ADAPBase*100@%&nbsp;%i:scaleAD%%i:scaleAP%; @StacksPerKill@x&nbsp;Conquest</expandRow><br><br><rules>War Chests Opened: @TFTUnitProperty.trait:TFT13_Warband_ChestsCompleted@</rules><br><rules>Current Stats: @TFTUnitProperty.trait:TFT13_Warband_CurrentADAP@%&nbsp;%i:scaleAD%%i:scaleAP%</rules><br>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "ADAPBase": 0.18000000715255737,
        "PercentIncreasePerChest": 0.029999999329447746,
        "StacksPerKill": 1.0
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "ADAPBase": 0.25,
        "PercentIncreasePerChest": 0.029999999329447746,
        "StacksPerKill": 3.0
      }
    },
    {
      "maxUnits": 8,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "ADAPBase": 0.4000000059604645,
        "PercentIncreasePerChest": 0.029999999329447746,
        "StacksPerKill": 6.0
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 9,
      "style": 6,
      "variables": {
        "ADAPBase": 1.0,
        "PercentIncreasePerChest": 0.029999999329447746,
        "StacksPerKill": 20.0
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"ADAPBase":0.18,"PercentIncreasePerChest":0.05,"StacksPerKill":1} |
| 4 | 5 | {"ADAPBase":0.25,"PercentIncreasePerChest":0.05,"StacksPerKill":3} |
| 6 | 8 | {"ADAPBase":0.4,"PercentIncreasePerChest":0.05,"StacksPerKill":6} |
| 9 | 25000 | {"ADAPBase":1,"PercentIncreasePerChest":0.05,"StacksPerKill":20} |

### TFT13_Watcher — Watcher

来源：`/setData/1/traits/32`；完整记录SHA-256 `bfe633f16b03d52b3e8c6b77b43cf757a013ba7f39c1272ad5c8401fcd540d65`；分类：常规/专属。

```json
{
  "apiName": "TFT13_Watcher",
  "name": "Watcher",
  "desc": "Watchers gain Durability, increased while above @HealthBreakpoint*100@%&nbsp;Health.<br><br><expandRow>(@MinUnits@) @BaseDR*100@% or @IncreasedDR*100@%&nbsp;%i:scaleDR%</expandRow><br>",
  "effects": [
    {
      "maxUnits": 3,
      "minUnits": 2,
      "style": 1,
      "variables": {
        "BaseDR": 0.15000000596046448,
        "HealthBreakpoint": 0.5,
        "IncreasedDR": 0.30000001192092896
      }
    },
    {
      "maxUnits": 5,
      "minUnits": 4,
      "style": 3,
      "variables": {
        "BaseDR": 0.25,
        "HealthBreakpoint": 0.5,
        "IncreasedDR": 0.44999998807907104
      }
    },
    {
      "maxUnits": 25000,
      "minUnits": 6,
      "style": 5,
      "variables": {
        "BaseDR": 0.3499999940395355,
        "HealthBreakpoint": 0.5,
        "IncreasedDR": 0.5
      }
    }
  ]
}
```

各档最终审阅参数（N显示；比例、点数和模式边界按§1.2）：

| 档位minUnits | maxUnits | 14.24b最终variables |
| --- | --- | --- |
| 2 | 3 | {"BaseDR":0.15,"HealthBreakpoint":0.5,"IncreasedDR":0.3} |
| 4 | 5 | {"BaseDR":0.25,"HealthBreakpoint":0.5,"IncreasedDR":0.45} |
| 6 | 25000 | {"BaseDR":0.35,"HealthBreakpoint":0.5,"IncreasedDR":0.5} |

## 8. 排除项、召唤证据与可复核检查

### 8.1 不计入英雄/上线羁绊数的记录

| 原件pointer | apiName | 名称/费用 | 排除原因 |
| --- | --- | --- | --- |
| /setData/1/champions/0 | TFT_BlueGolem | Golem / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/1 | TFT9_SLIME_Crab | Rift Scuttler / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/2 | TFT_TrainingDummy | Target Dummy / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/3 | TFT_Voidspawn | Voidspawn / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/4 | TFT_Krug | Krug / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/5 | TFT_Murkwolf | Murk Wolf / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/6 | TFT_MurkwolfMini | Murkwolf / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/7 | TFT_Razorbeak | Razorbeak / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/8 | TFT_RazorbeakMini | Razorbeak / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/9 | TFT_RiftHerald | Rift Herald / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/10 | TFT_ElderDragon | Elder Dragon / 1 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/53 | TFT13_HoverboardProp | ApheliosTurret / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/54 | TFT13_EliseSpider | EliseSpider / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/60 | TFT13_Sion | Sion / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/62 | TFT13_Silco_Monstrosity | SRU_Horde_Mini / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/64 | TFT13_Blue_Monkey | Blue_Monkey / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/74 | TFT13_SwainDemonForm | SwainDemonForm / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/77 | TFT13_JayceSummon | Hextech Forge / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/78 | TFT5_EmblemArmoryKey | Tome of Traits / 8 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/79 | TFT_ArmoryKeyCompleted | Completed Item Anvil / 8 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/80 | TFT_ArmoryKeyComponent | Component Anvil / 8 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/81 | TFT_ArmoryKeyOrnn | Artifact Item Anvil / 8 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/82 | TFT_ArmoryKeySupport | Support item anvil / 8 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |
| /setData/1/champions/83 | TFT6_MercenaryChest | Mercenary Chest / 11 | 无英雄羁绊；野怪/召唤/道具，不入标准英雄目录 |

Rammus待确认原件：`/setData/8/traits/17`；未找到对应63英雄或官方14.24上线说明；不能因“+1Team Size”文案就启用。

```json
{
  "apiName": "TFT13_RammusTrait",
  "desc": "Rammus always makes room for himself in any team. <br><br>+1 Team Size, but only if Rammus is on your team.",
  "effects": [
    {
      "maxUnits": 25000,
      "minUnits": 1,
      "style": 4,
      "variables": {}
    }
  ],
  "icon": "ASSETS/UX/TraitIcons/Trait_Icon_8_Threat.tex",
  "name": "Rammus"
}
```

### 8.2 技能相关辅助单位（证据候选，不计英雄）

#### TFT13_EliseSpider

`/setData/1/champions/54`；完整记录SHA-256 `9787ec8352205898a5d76c327980abba2e4c109c2d1f69d3c04be2fe25acdcdd`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_EliseSpider",
  "name": "EliseSpider",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": null,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": null,
    "hp": null,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": null,
    "icon": "ASSETS/Characters/TFT13_EliseSpider/HUD/Icons2D/TFT13_EliseSpider_EyeOfTheStorm.TFT_Set13.tex",
    "name": null,
    "variables": []
  }
}
```

#### TFT13_Sion

`/setData/1/champions/60`；完整记录SHA-256 `f5f28e6e1b1982035cc00ff9d52e755884cfc875f17feb1a0b4c0573b7423dca`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_Sion",
  "name": "Sion",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.699999988079071,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": 750.0,
    "initialMana": 120.0,
    "magicResist": null,
    "mana": 120.0,
    "range": 1.0
  },
  "ability": {
    "desc": "<spellPassive>Freed:</spellPassive> Charge through the nearest enemy, dealing <physicalDamage>@ModifiedChargeDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all enemies&nbsp;hit. <br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Stun enemies in a line on target for @StunDuration@ seconds and deal <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to&nbsp;them.",
    "icon": "ASSETS/Characters/TFT13_Sion/HUD/Icons2D/SionSpell_1.TFT_Set13.tex",
    "name": "Decimating Smash",
    "variables": [
      {
        "name": "ADPercent",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "SlamHexLength",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "ChargeUpDuration",
        "value": [1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842,1.2999999523162842]
      },
      {
        "name": "Shield",
        "value": [175.0,175.0,175.0,75.0,175.0,175.0,175.0]
      },
      {
        "name": "ChargeKnockupDuration",
        "value": [0.5,0.5,0.5,0.5,0.5,0.5,0.5]
      },
      {
        "name": "ChargeDamageAmpDuration",
        "value": [60.0,60.0,60.0,60.0,60.0,60.0,60.0]
      },
      {
        "name": "ChargeDamageAmp",
        "value": [0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066,0.07999999821186066]
      },
      {
        "name": "HexRange",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      },
      {
        "name": "ShieldDuration",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "ChargeADPercent",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "StunDuration",
        "value": [1.0,1.0,1.0,1.0,1.0,1.0,1.0]
      },
      {
        "name": "NovaPercentHealthDamage",
        "value": [0.25,0.25,0.25,0.25,0.25,0.25,0.25]
      },
      {
        "name": "NovaAbilityPower",
        "value": [100.0,100.0,100.0,100.0,100.0,100.0,100.0]
      },
      {
        "name": "PercentOmnivamp",
        "value": [0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645,0.4000000059604645]
      },
      {
        "name": "PercentAttackSpeed",
        "value": [3.0,3.0,3.0,3.0,3.0,3.0,3.0]
      },
      {
        "name": "PercentReviveHealth",
        "value": [0.75,0.75,0.75,0.75,0.75,0.75,0.75]
      },
      {
        "name": "NovaRadius",
        "value": [2.0,2.0,2.0,2.0,2.0,2.0,2.0]
      }
    ]
  }
}
```

#### TFT13_Silco_Monstrosity

`/setData/1/champions/62`；完整记录SHA-256 `cd5772e1b7c5b224a14e88ddff64003876a7e1e04b4a735c4cd11e9dadcd6977`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_Silco_Monstrosity",
  "name": "SRU_Horde_Mini",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": 50.0,
    "attackSpeed": 0.800000011920929,
    "critChance": null,
    "critMultiplier": 1.399999976158142,
    "damage": null,
    "hp": null,
    "initialMana": 0,
    "magicResist": 50.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Placeholder Tooltip",
    "icon": "ASSETS/Maps/Particles/TFT/Item_Icons/Placeholders/TFT_Item_Unknown.tex",
    "name": "Placeholder Name",
    "variables": []
  }
}
```

#### TFT13_Blue_Monkey

`/setData/1/champions/64`；完整记录SHA-256 `fd9f30ee459e1a232820f7db432b1c838772933decce0422936ed10ec869162a`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_Blue_Monkey",
  "name": "Blue_Monkey",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": null,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": null,
    "hp": null,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Placeholder Tooltip",
    "icon": null,
    "name": "Placeholder Name",
    "variables": []
  }
}
```

#### TFT13_SwainDemonForm

`/setData/1/champions/74`；完整记录SHA-256 `b24674963ba8d1ddc03241e1437774124f7bb338116ab68214417b379f37fb9e`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_SwainDemonForm",
  "name": "SwainDemonForm",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": null,
    "attackSpeed": 0.800000011920929,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": null,
    "hp": null,
    "initialMana": 0,
    "magicResist": 20.0,
    "mana": 100,
    "range": 1.0
  },
  "ability": {
    "desc": "Placeholder Tooltip",
    "icon": null,
    "name": "Placeholder Name",
    "variables": []
  }
}
```

#### TFT13_JayceSummon

`/setData/1/champions/77`；完整记录SHA-256 `3ec0e039bcdc64bfb9c2677be44aabb6117c453cc75a664e2c572bfee72645a0`。附属记录不能替代完整后排形态/召唤参数脚本。

```json
{
  "apiName": "TFT13_JayceSummon",
  "name": "Hextech Forge",
  "cost": 11,
  "traits": [],
  "stats": {
    "armor": 0.0,
    "attackSpeed": 0.5,
    "critChance": 0.25,
    "critMultiplier": 1.399999976158142,
    "damage": 50.0,
    "hp": null,
    "initialMana": 0,
    "magicResist": null,
    "mana": 0.0,
    "range": 10.0
  },
  "ability": {
    "desc": "Placeholder Tooltip",
    "icon": null,
    "name": "Placeholder Name",
    "variables": []
  }
}
```

### 8.3 验证结果与离线回查

- 解压原件字节数/hash与B1 manifest及main SOURCE_MANIFEST匹配；全对象比较TFTSet13与Evolved共有记录一致。
- 63英雄身份唯一；费用分布 `{"1":14,"2":13,"3":13,"4":12,"5":8,"6":3}`；全部英雄trait名称均能唯一映射到29个常规/专属trait apiName；没有用展示名代替身份。
- 37羁绊身份唯一，29常规/专属、8关系解锁；全部档位和原始variables保留；英雄技能共408个变量名记录（含null与条件字段），羁绊逐档共434个变量键。
- 19现有英雄cost/基础stats/AS与tick间隔及全部已导入三元组逐字段比较：0差异；五羁绊已实现档的系数核对一致，缺失档和执行语义单列§3。
- 每英雄机制矩阵63行，G01–G12统计由矩阵累加；特殊能力S01–S13有逐英雄消费者。统计是规划需求，不是代码已实现覆盖率。
- 本次验证原始记录投影、JSON pointer/hash、字段覆盖和文档范围；未运行游戏对局/浏览器验收，不宣称任何新英雄或机制已通过执行测试。
- 独立从本文重新解析107个JSON块，与不可变原件投影相等；106个已列完整记录hash和pointer匹配（另1个为Rammus排除原件）；63行技能机制矩阵重新计数与G01–G12统计一致；8条关系强化均在标准Evolved的augments成员集合内；文内只读Python检查可离线执行。

从本分支checkout离线回查原件（需要本地已fetch B1 commit；不依赖当前网络站点内容）：

```sh
git show 877c59b2babc4c6abfccc62452075f3b0cbbd688:src/simulation/content/source/s13-14.24b/raw/en_us.json.gz > /tmp/m9-en_us.json.gz
gzip -dc /tmp/m9-en_us.json.gz > /tmp/m9-en_us.json
sha256sum /tmp/m9-en_us.json
```

JSON pointer直接指向解压后的对象。完整记录hash约定与B1相同：UTF-8 JSON、ensure_ascii=False、sort_keys=True、compact separators、allow_nan=False；以下只读检查复核基础选择器与6费补充，不修改运行源：

```python
import json, hashlib
from pathlib import Path
raw = Path("/tmp/m9-en_us.json").read_bytes()
assert hashlib.sha256(raw).hexdigest() == "c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3"
data = json.loads(raw)
b, = [s for s in data["setData"] if s["mutator"] == "TFTSet13"]
e, = [s for s in data["setData"] if s["mutator"] == "TFTSet13_Evolved"]
em = {c["apiName"]: c for c in e["champions"]}
assert all(c == em[c["apiName"]] for c in b["champions"])
base = [c for c in b["champions"] if c["apiName"].startswith("TFT13_") and 1 <= c["cost"] <= 5 and c["traits"]]
extra = [c for c in e["champions"] if c["cost"] == 6 and c["traits"]]
assert len(base) == 60 and len(extra) == 3
assert len({c["apiName"] for c in base + extra}) == 63
traits = [t for t in e["traits"] if t["apiName"] != "TFT13_RammusTrait"]
assert len(traits) == 37
for c in base + extra:
    for name in c["traits"]:
        assert sum(t["name"] == name for t in traits) == 1
```
