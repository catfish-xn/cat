# M8 B4：全装备目录与 IF-POOL

实施分支 `feat/m8-b4`，从已合并 B3 的 `feat/m8-b0-baseline@5dce5cd` 创建。B1 装备档案、B2 合同及 M8B 增补正文保持不变。本文件记录实施证据，不代替用户签收。

开发期运算修订 `m8-b4-catalog-1`，装备目录修订 `s13-14.24b-m8-b4-v1`，内容 digest `fnv1a32-utf16:742dadf7`。schema5、公开 protocol2 和既有版本标识保留，正式 M8 保存／回放版本切换归 B9/B10。

## 实施边界

- B1 全部 44 个 apiName、8 个组件、36 个无序配方、sourceUnique 与运行定义一一对应，原9件成装效果数据保留。数据归档仍是 `content/source/s13-14.24b/normalized/items.json`，没有重抓来源或替换冻结值。
- `m8/item-program.ts` 绑定完整 Source；`s13-definitions.ts` 将目录声明编译成 B3 已有 StatModifier、Effect、TriggerDefinition、PeriodicTask、VampDefinition。执行器不按装备 ID／名称分支；改名保持数值和 RNG 的实战向量见 integration 测试。
- G01–G11 消费者补齐目录所需接点：起手排位双抗、伤害过滤与取最强、burn/wound/轻语的包权限、状态投影、同 tick 灼烧刷新不倒退时钟、G10 each-tick 光环在移动后与源死亡时撤销自身贡献。净化后的光环下 tick 再施加，不在清理阶段立即重施。
- 新装备程序进入玩家与敌方 StrategySnapshot／Combat；局部恢复核对目录来源、编译定义、事件／阈值运行态、授权、最大生命消费、附着灼烧、周期账户及盾取样。血手后饮血、双授权、正义改变属性分支、拉克丝取样后一次强化、水银持有者死亡都有独立边界测试。AP／AD 的历史取样只校验同内容可产生的有限集合，不冒称没有完整历史时可证明所有历史输入；B9 仍负责完整保存／回放集成。
- `readItemCatalog()` 位于 `src/simulation/item-catalog.ts`，只读返回 44 项，带 apiName、配方、基础属性与机制描述、unique、slotCost、来源版本／证据、conventionIds；中文名称仍标 temporary-unverified。没有修改界面或资源目录；U3 的装备实例／预览／临时来源显示仍依赖 B5。
- 窃贼手套本步启用 150HP／20% 暴击和三槽目录元数据；TG-01 生命周期声明保留供 B5 消费。未执行临时子装备生成、刷新、返还或清理，`m8/equipment.ts` 等 G12 实现未改。

## IF-POOL

`component-pool.ts` 明确 `m8b-components-v1` 的 API 代码点顺序：BFSword→ChainVest→GiantsBelt→NeedlesslyLargeRod→NegatronCloak→RecurveBow→SparringGloves→TearOfTheGoddess；对应 sword/vest/belt/rod/cloak/bow/gloves/tear。

旧日程使用完整八项候选，确认只发原 ScheduleReceipt，零 choice RNG；随机组件获取池也共用此顺序。验证器拒绝缺项、重复、错误 kind／apiName、未知版本、非法候选和非 canonical 顺序。36 配方严格覆盖全部 8×9÷2 组合，另核对核准运行映射；交换两个成品的配方也拒绝。`inventory.test.ts` 逐一测试正序／反序合成及拒绝用成品合成。B8 可直接复用该池与验证器，新掉落账本／LootReceipt 来源路由未提前实施。

## 逐件独立数值与真正触发

每行来自 `tests/m8-b4-<组>.test.ts`：期望数值写死并附手算，未调用生产公式或从程序参数生成期望；随后用实际 ITEM_DEFINITIONS、resolveEffects 与 stepCombat 验证该装备效果确实发生。特殊效果测试实际跨过其门槛／计数／时间，纯属性成装则实际改变伤害或生命。37 条逐件向量覆盖 36 件，额外一条覆盖自适应头盔前／后排。

| 组 | 运行 ID | 独立手算／实战触发证据 |
| --- | --- | --- |
| sword | deathblade | 100×1.55=155；155×1.08→167 实际普攻 |
| sword | giant-slayer | 125×1.05→131（HP1750）；×1.25→156（1751） |
| sword | gunblade | 实际120伤害，18自疗＋30友疗 |
| sword | shojin | 起手15＋一次普攻10＋额外5=30法力 |
| sword | edge-of-night | ≤60%伤后净化／免选／防止20tick，结束＋15%AS→18tick间隔 |
| sword | bloodthirster | 115×20%=23吸血；存活低血线盾=1000×25%=250 |
| sword | steraks-gage | (1000+150)×1.25→1437，增287HP；AD150 |
| sword | infinity-edge | 60%暴击；种子42实际135×1.4=189；授权技能260×1.4=364 |
| bow | red-buff | 基础攻速／3%增伤，实际灼烧100与33%重伤 |
| bow | rageblade | 已完成攻击计数×500Bps，后续真实间隔加速 |
| bow | statikk-shiv | 第3普攻真实4目标；先30%shred再35magic |
| bow | titans-resolve | 攻击与承伤叠25层；AD/AP与满层20双抗下一tick |
| bow | runaans-hurricane | 125AD×55%→68副弹，主暴击不扩散 |
| bow | nashors-tooth | 真实施法后＋60%AS下一tick；100tick期限 |
| bow | last-whisper | 正物理伤后30%sunder；后包读取降低护甲 |
| rod | deathcap | 150AP技能260×1.5=390，×1.15→448 |
| rod | archangel | 首次100tick增加30AP，前后实际技能／属性不同 |
| rod | crownguard | 1100HP×25%=275盾；160tick自然结束＋25AP |
| rod | ionic-spark | 2格内30%shred；敌方实际花80mana×1.6=128，MR100经shred后实伤75 |
| rod | morellonomicon | 实际技能伤附着10秒burn/wound，首次1%maxHP跳伤 |
| rod | jeweled-gauntlet | 技能授权；60%chance，135AP技能260×1.35=351，暴击491 |
| tear | blue-buff | 实际施法退10mana；击杀增伤5%持续160tick |
| tear | protectors-vow | 伤后≤40%，1000HP×25%=250盾，＋20双抗 |
| tear | adaptive-helm | 前排40双抗/每受击1mana；后排AP15/60tick回10mana |
| tear | redemption | 每100tick每友军missingHP×15%＋10%常规减伤 |
| tear | hand-of-justice | >50%AD/AP双倍；<50%吸血双倍；恰50%基础值 |
| vest | bramble-vest | 100/1.65→60×.92→55；实际反击100，40tick ICD |
| vest | gargoyle | 一敌锁定双抗25+10=35；真实100伤→74 |
| vest | sunfire-cape | HP1242；40tick施加、60tick第一跳100 |
| vest | steadfast-heart | 50%边界上方15%／等值8%减伤；100→70／76 |
| cloak | dragons-claw | HP1090×2.5%=27＋余数，40tick真实治疗 |
| cloak | evenshroud | aura使100护甲→70，实际100伤→58；200tick双抗到期 |
| cloak | quicksilver | 9次×3%=27%成长；总57%AS→13tick，360末次先于免控到期 |
| belt | warmog | (1000+600)×1.12=1792，真实100伤留下1692HP |
| belt | guardbreaker | 140×1.10=154击中50盾；后次×1.25=175 |
| gloves | thiefs-gloves | HP1150，45%crit实际140普攻；无临时装备子项（B5） |

`m8-b4-catalog.test.ts` 另外逐一验证44件在真正 Match 开战后的局部保存往返与下一步事件／RNG相等，跨0/20/40/60/80/100/160/200/360边界（战斗仍运行时）；36件的 Combat JSON 连续运行也比较完整下一步。`m8-b4-integration.test.ts` 验证组合、移动／死亡／其他附着减抗保留、只读查询，拒绝篡改授权／程序／maxHP消费／阈值次数／盾声明／burn数值。

## 旧路线与 golden 变更依据

旧文件逐字保留为 `full-match-golden.pre-m8-b4.json`，旧7组件／9配方断言归档于 `tests/historical/m8-b3/`。独立资源 oracle 显式使用八项 API 顺序及 reward word%8，不从生产获取池生成预期。

八组件池改变了随机奖励身份，路线生成器依据已有库存调整后续自选和合成时点。四条路线的**总命令数及每种命令数量完全相同**：cannon182、sniper178、mage172、sniper-caitlyn182；均保持35推进轮／30战／15永久组件。炮手／狙击／女警 r14自选 sword→belt、r18 cloak→sword；法师 r7 belt→rod、r14 sword→belt、r18 rod→sword、r25 cloak→vest，库存实例与合成／穿戴时点随之调整。商店、经济、收据、随机流逐词由独立 oracle 核对，不能把新哈希当作装备数值依据。`scripts/update-m8-b4-golden.cjs` 记录重建入口。未启用 B6 新轮次或 B8 新掉落。

## 验证与包体

逐件及集成定向验证：10文件／137项通过；连同原恢复用例的定向验证12文件／183项通过。最终 `npm test -- --maxWorkers=2`：91文件／1146项全部通过（581.61秒）；`npm run build`通过（118模块）。默认完整CI将在最终推送SHA执行，结果以该SHA的 [Actions](https://github.com/catfish-xn/cat/actions/workflows/ci.yml?query=branch%3Afeat%2Fm8-b4) 和交付汇报为准；不合并。

首次完整测试1144项通过、1项失败：sniper逐tick恢复超过原180秒测试期限（181.624秒），没有数值断言失败；局部去除重复机制编译后单项仍超时，原失败保留。剖析一份120312B的中期存档，重复2000次恢复时发现字符串已JSON.parse成独立对象后仍被structuredClone整图复制；现对字符串保留全部验证后直接返回解析图，对对象仍克隆，并新增两种输入相互独立的修改测试。没有增加持久缓存、修改测试期限或CI门禁。

同机、同 lockfile（SHA256 `3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`）、Vite production JS、Node gzip level9：签收 M7 `15313a75c6e74beec739fe52a2875c104c55eae3` 重新构建424763B；B4为465502B；比例1.0959100，上限467239.3B，可用整数字节上限467239B，**余量1737B（约1.70KiB）**。沿用原完整 CI M7×1.10门禁，没有放宽阈值。Vite显示的gzip使用不同压缩级别，不作门禁数值。
