# S13 14.24b 强化与异常 P3

基底：`075e9a494758b13620c8ae36e55364cc214fd364`（multiplayer，rules/content v11）。分支：`codex/s13-augments-p3`。不升版本；合并时由 Claude 统一处理。新来源、授予映射与项目约定参与自动计算的 content digest。

## 来源与范围

全部新系数来自 `src/simulation/content/source/s13-14.24b/raw/` 的 `en_us.json.gz`、`map22.bin.json.gz`；界面名来自同目录 `zh_cn.tft.stringtable.json.gz`。`content/s13-p3-source.ts` 保存 API ID、map22 指针、未知字段及归一化到六位小数的原始系数。运行时百分比转为整数 Bps；B 补丁已有覆盖值不变。独立测试直接解压 raw 比对系数与中文名，不改原始文件。

注册后强化与异常各为 37 项。历史 30 项系数测试原样保留，仅精确扩展目录计数/集合断言。独立 oracle 增加字面候选 ID 和四种装备的精确授予断言，原有 RNG、经济、卡牌、物品、收据守恒断言保留。不改 `src/server/`、`src/rendering/`，不改测试时限，不删除或跳过测试。

## 逐项实现与数值证明

主测试：`tests/s13-augments-p3.test.ts`。领取、独立原始来源核对与公开路线恢复：`tests/s13-p3-acquisition.test.ts`。

| 条目 / API ID（异常前缀 TFT13_GoopBuff_） | 实现与独立数值断言 |
| --- | --- |
| 硬化护盾 / TFT_Augment_DefenseCall | 首次跌到低于50%生命触发原 survival 护盾；阶段2/3/4/5+分别100/150/200/225，持续60 tick。有盾时100物理伤害减为90；盾耗尽后不重发。 |
| 高压电 / TFT_Augment_HighVoltage | 永久授予离子火花；冻结原装备声明，将光环/敌方施法监听半径2增到5，160%耗蓝伤害增至200%。125实际耗蓝对应250原始伤害。 |
| 透体莲花 I / TFT_Augment_PiercingLotus1 | +5个百分点暴击，基础25%变30%；复用技能暴击授权，暴击技能施加20%破甲/魔抗击碎60 tick。 |
| 透体莲花 II / TFT_Augment_PiercingLotus2 | +20个百分点暴击，基础25%变45%；与I共用授权、暴击命中条件和双抗击碎。 |
| 嗜火 / TFT_Augment_Pyromaniac | 永久授予红霸符；所有共享 item-burn 包在同一入口增加50%，不重复执行抵抗/护盾/HP结算。1240生命目标首个灼烧脉冲12→18；火球额外真伤14保持14。 |
| 棘刺镀板铠甲 / TFT_Augment_ThornPlatedArmor | 永久授予棘刺背心；原反击冷却与目标选择不变，阶段2/3/4/5+的100原始伤害变105/130/170/200；按实际HP伤害50%排入原治疗管线，两次105实际伤害各治疗52。 |
| 释放野兽 / TFT_Augment_UnleashTheBeast | 永久授予斯特拉克的挑战护手；在原装备同一次 survival 声明附加35%整战攻速和200 tick控制免疫。 |
| 终结者 / TheFinisher | 共用原收集者的伤害后严格低于阈值斩杀、护盾/延期绕过和死亡提交逻辑，阈值15%。1240最大生命时185斩杀、186存活；不发收集者金币。 |
| 冰霜触摸 / TouchofFrost | 技能直接/周期伤害施加-20%攻速80 tick；死亡前冻结仍有效的冰冷来源，最近存活同阵营敌人获得20 tick晕眩，控制从下一tick生效。负攻速读取保留符号，数值断言确认实际攻击间隔增加。 |
| 火球 / Fireball | 累积实际耗蓝，每70触发；69不触发，随后71累计触发两次。半径2目标经共享 Burn/Wound入口；额外6%最大生命真伤分5次，1240生命目标每次14/15/15/15/15，共74；标准灼烧另算，JSON续跑完全一致。 |
| 龙魂 / Dragonsoul | 每个新普攻目标仅一次20%目标最大生命真伤，1240生命对应248；重复攻击同一目标不再触发，切换新目标触发。 |
| 绝不浪费 / NothingWasted | 清理死亡单位的mana之前冻结所有捐赠者，按70%排入原 mana resolver。50当前法力→35；同时死亡的接收者不获得法力。保留法力上限、锁定、溢出事件。 |
| 荆棘满途 / Thornskin | **项目约定**：+60护甲/+60魔抗；仅对护甲/魔抗与减伤阻止的量反击邻格敌人20%魔法伤害。100攻击遇100护甲阻止50→反伤10；护盾吸收不计，反伤不再触发反伤。 |
| 地下拳王 / Knockout | **项目约定**：+15%AD；施法刷新一次“下一次普攻行动”门控，+35个百分点暴击；原始普攻100替换成90真伤，统一1.4倍暴击后126；消费后下一次恢复物理伤害。 |

## 复用与接口

公开入口保持 `selectChoice`、`buildStrategySnapshot`、`createCombatWithEvents`、`stepCombat`、`restoreMatch`。新项为机制 `s13P3`，冻结来源、阶段与已有 item program 一起编译（包括战斗中宝箱授予的普通装备）；服务端和渲染端继续读取原有公开投影。

- `p3Program(id: string, stage: number): ItemProgram`：编译生存盾、暴击授权/击碎、冰冷及可验证效果声明；未知ID返回空程序。
- `p3ItemProgram(id: string, program: ItemProgram, augments: readonly string[], stage: number): ItemProgram`：只适配原装备声明；无匹配强化时返回等值声明。
- `advanceP3(ctx: AbilityContext): void`、`p3Cast(ctx, holder, target, actionSeq, actualManaSpent)`、`p3Attack(ctx, holder, target, actionSeq): boolean`：只负责定时、目标和行动门控，所有伤害仍进入既有 damage packet 管线。
- `settleP3Deaths(ctx: AbilityContext, fallen: readonly S13Unit[]): void`：在死亡清理之前冻结法力与冰冷，再调用原法力/控制执行器。
- `validateP3State(unit: CombatUnit, units: readonly CombatUnit[], tick: number, nextActionSeq: number): void`：拒绝缺失的必要运行记录、未知字段、无来源状态、非法目标/行动/脉冲/余数；异常抛出 `RangeError`，不修补候选状态。
- `CombatUnit.s13P3?` 仅保留 `charged`、`manaRemainder`、`dragonTargets`、`fireballs`，均为可序列化战斗状态；无新命令、网络接口或失败 reason。
- `prepareDamage` 增加只读 `blockedByMitigation` 观察值，保留原有伤害事件和结算顺序；反伤共用 `p3ReflectionDamage` 声明及 `executeMechanismEffect`，不会再次反伤棘刺背心或荆棘满途包。
- 装备授予走原 `planPermanentItemGrant` 与 schedule 事务，重复选择失败返回原状态；来源与严格恢复检查确切实例、定义、序列号及唯一收据。

## 自行决定

1. 阶段四档按2/3/4/5+映射；第1阶段取第一档，加时取末档。装备强化仅作用于原文对应的普通装备，不擅自扩展到光明/特殊同类装备。
2. 火球以当前攻击目标为圆心，6%额外真伤和标准1%/秒灼烧分开；直接DoT可叠加，标准灼烧复用既有 strongest-category 与刷新策略。逐次读取目标当前最大生命，累积取整差保存五次总量；嗜火仅增强标准灼烧。原始说明未明确的这些调度细节采用此有限实现。
3. 冰冷采用当前引擎的攻速Bps修正；原读取会把负修正截到零，改为读取有符号的修正总和。源系数和其他数值不变。
4. 终结者与收集者并存时选择较高斩杀阈值来源；只有收集者实际执行才产生其金币机会。不把终结者变成金币来源。
5. 法力死亡转移按每位捐赠者独立向下取整，尊重现有法力锁与上限。已死亡接收者不参与。
6. 当前 g2-4b Herald 获取分支在新候选池下默认沿用的4-4阵容于6-6正常出局；记录显示两只1星斯卡未升级、未补盖伦，且近200金币未投入阵容。当前记录器与对应公开fixture启用正常购牌策略：以最高利息所需本金为购牌停止线，补一只盖伦、将两只1星斯卡升到2星。每笔购买、刷新、合星都经独立oracle校验；原游戏数值、时限、战斗数、胜利/守恒/恢复要求均不改。默认历史生成配方仍可调用，历史字节保持。

## 最后两项：缺脚本数据的项目约定

已检索 raw 的 `map22.bin.json.gz` 中机制对象、tooltip、关联 `mScriptName`，以及现有归档脚本文件。荆棘满途仅查到 `{c55c279f}` 与 tooltip `{b709926c}`；地下拳王为 `{062de479}` 与 tooltip `{58c6fe9c}`。归档提供系数/说明和效果资源元数据，未发现能判定这些语义的可执行脚本体。未知的荆棘满途字段 `{6c6773d4}=75` 保留在来源表中，未擅自解释为上限。

荆棘满途的**项目约定**：以统一伤害管线已计算的暴击后、增幅后基数减去护甲/魔抗和减伤后数值；不计护盾吸收、免疫、分摊或延期偿付。完全免疫不反击，目标在本tick已致死后不再获得新反击。其自身及棘刺背心反伤包均不会再触发反伤；反伤依旧受对方魔抗、减伤和护盾影响。

地下拳王的**项目约定**伤害组成表（示例原始普攻包R=100、基础暴击倍率1.4；AD加成在生成R时已计入）：

| 组成 | 未充能 | 施法后下一次普攻行动 |
| --- | --- | --- |
| 原始普攻包R | 原物理伤害100 | 替换为floor(R×90%)=90真伤，不额外叠加原100 |
| 暴击几率 | 已有几率 | 已有几率+35个百分点，上限100%；与透体莲花授权共用 |
| 暴击运算顺序 | 统一管线 | 先转90，再统一暴击：90×1.4=126真伤 |
| 多目标普攻 | 既有行动规则 | 同一行动各基础包均转换；保留Twitch原有一次暴击共享规则 |
| 独立附加魔法/物理/真实包 | 原来源单独结算 | 仍独立结算，不另加90%第二包 |
| 连续施法与门控 | 无 | 刷新一击，不堆叠；攻击行动消费，不因多目标重复消费 |

## 指纹和验证边界

只用当前 `g2-4b` 流程记录：Herald生成/默认检查；`record-g2-4b-inputs.cjs --baseline-commit=075e9a494758b13620c8ae36e55364cc214fd364` 及对应 `--check`。不写 `g2-3`、`g2-augments` 历史目录，不用 `verify-m8-herald-fixtures.cjs --write`。历史来源字节由输入审计再次比对基底。

只跑相关测试和类型检查，不声明完整全套或在线界面验收。本包按指定流程更新 g2-4b Herald/inputs；没有运行会重录整套发布轨迹的 record-g2-4b-release.cjs。旧的 g2-4b 发布级 golden/recorded-states 与 release-audit 基线仍留给合并升版时统一重录，相关完整发布恢复验收尚未完成。最后验证统计见下文。两项缺脚本语义及火球有限调度约定是后续对照客户端实测时可能需要调整的边界。

## 最终相关测试结果

21个文件、331条全部通过，无跳过；主批次20文件/322条窗口47.17秒，补充目录1文件/9条窗口0.97秒。下表为Vitest JSON逐文件执行窗口，并行文件的耗时不能相加作为总墙钟时间。

| 文件 | 条数 | 耗时(ms) |
| --- | ---: | ---: |
| `tests/g2-3-anomalies.test.ts` | 46 | 1691.26 |
| `tests/g2-3-content.test.ts` | 10 | 1545.2 |
| `tests/g2-4b-artifact-mechanism-integration.test.ts` | 2 | 420.57 |
| `tests/g2-4b-collector.test.ts` | 1 | 8772.49 |
| `tests/g2-4b-defiance.test.ts` | 3 | 539.65 |
| `tests/g2-4b-resists-restore.test.ts` | 21 | 14831.88 |
| `tests/g2-4b-source-pins.test.ts` | 3 | 2525.58 |
| `tests/g2-4b-unstable-chest.test.ts` | 39 | 40824 |
| `tests/g2-augments-choice.test.ts` | 42 | 11040.65 |
| `tests/g2-augments-combat.test.ts` | 16 | 8484.3 |
| `tests/g2-augments-identity.test.ts` | 1 | 550.15 |
| `tests/g2-augments-multiplayer.test.ts` | 4 | 67.95 |
| `tests/g2-augments-static.test.ts` | 60 | 446.27 |
| `tests/m8-b3-damage-control-order.test.ts` | 14 | 100.67 |
| `tests/m8-b4-trigger-ledger.test.ts` | 2 | 8.53 |
| `tests/m8-g02.test.ts` | 7 | 15.04 |
| `tests/m8-g03.test.ts` | 4 | 3.59 |
| `tests/m8-g04.test.ts` | 5 | 7.86 |
| `tests/s13-augments-p3.test.ts` | 30 | 1494.4 |
| `tests/s13-p3-acquisition.test.ts` | 12 | 6463.92 |
| `tests/m5-content.test.ts` | 9 | 51.79 |

类型检查通过；g2-4b Herald五分支生成96.23秒、默认检查79.17秒，均完成每分支14场及全部严格恢复。inputs记录和相同基底的`--check`通过（9组文件证据）。摘要为`fnv1a32-utf16:1add8f97`。
