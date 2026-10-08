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

逐件及集成定向验证：10文件／137项通过；连同原恢复用例的定向验证12文件／183项通过。最终 `npm test -- --maxWorkers=2`：91文件／1146项全部通过（581.61秒）；`npm run build`通过（118模块）。运行代码65252f3的完整CI #91已结束：首轮preview堆门禁失败，一次同SHA复测后12个必需作业通过；首轮失败、同机三次对照及U4合入包体见下方签收补充与入库JSON。补充提交仅含文档／证据，不冒称新SHA已有完整CI；不合并。

首次完整测试1144项通过、1项失败：sniper逐tick恢复超过原180秒测试期限（181.624秒），没有数值断言失败；局部去除重复机制编译后单项仍超时，原失败保留。剖析一份120312B的中期存档，重复2000次恢复时发现字符串已JSON.parse成独立对象后仍被structuredClone整图复制；现对字符串保留全部验证后直接返回解析图，对对象仍克隆，并新增两种输入相互独立的修改测试。没有增加持久缓存、修改测试期限或CI门禁。

同机、同 lockfile（SHA256 `3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`）、Vite production JS、Node gzip level9：签收 M7 `15313a75c6e74beec739fe52a2875c104c55eae3` 重新构建424763B；B4为465502B；比例1.0959100，上限467239.3B，可用整数字节上限467239B，**余量1737B（约1.70KiB）**。沿用原完整 CI M7×1.10门禁，没有放宽阈值。Vite显示的gzip使用不同压缩级别，不作门禁数值。

## 签收补充：首轮 CI 与 U4 包体（2026-10-08）

### CI #91 首轮失败的精确范围

运行提交 `65252f332c1f1f15523cfd01b497c425089997bd`。首轮失败作业为 `browser-preview-cannon-sample1`（job `113149764075`），步骤 `Normal-time complete route`。原日志在 04:35:14 UTC 报 `full application post-GC heap growth <=1048576 bytes (preview)`：2 次预热后 30 次新局／导入／回放返回，GC 后堆增长 **1,256,496 B**，超原 1 MiB 上限 207,920 B。监听器 82→82、RAF 1→1，页面错误为空。

[首轮失败作业日志](https://github.com/catfish-xn/cat/actions/runs/37727772320/job/113149764075)；[首轮完整运行](https://github.com/catfish-xn/cat/actions/runs/37727772320/attempts/1)。首轮 10 个作业成功／1 个失败／3 个跳过，其中测试与构建通过，证据比较因前置失败跳过。一次同 SHA 失败复测后，preview 增长 702,308 B，通过原门禁；依赖比较也通过，最终合并状态 12 个必需作业成功、2 个可选诊断跳过。原失败没有删去或追认为成功。

### U4 合入后的生产 JS

固定 U4 为 `feat/m8-u4@5778cab29fd02a5aeb002b1e12b16f1ac4dc39bf`，B4 为 `65252f3`。只在隔离 detached worktree 合入现有 U4，无冲突；正式 B4 分支未合入 U4。M7／B3／B4／B4＋U4 用同一 Node 24.21.0、相同 lockfile，普通 `npm run build` 均通过；按现有 `m7-budget.cjs` 方法对 **所有** `dist/assets/*.js` 各用 Node gzip level9 后求和。CSS／图片不在该 JS 门禁，未通过挪到其他资产类型来规避。

| 版本 | JS gzip B | 相对 M7 | 现 ×1.10 门禁余量 B |
| --- | ---: | ---: | ---: |
| 签收 M7 `15313a7` | 424,763 | 1.000000 | — |
| B3 `5dce5cd` | 453,949 | 1.068711 | 13,290 |
| B4 `65252f3` | 465,502 | 1.095910 | 1,737 |
| B4＋U4 `5778cab` | **469,414** | **1.105120** | **−2,175** |

U4 增加 3,912 B（约 3.82 KiB），已经超限 2,175 B（约 2.12 KiB）；不只是“B5 合入后可能超限”。当前门禁上限为 467,239.3 B，可用整数上限 467,239 B。B5 尚未实现，**不能给 B5 的新增体积作实测承诺**；如果 B5 相对当前合入树增加 Δ B，保持现上限需要至少节省 `2175 + Δ` B。

### 待用户决定的方案（未应用）

| 方案 | 对 U4 的量化结果 | 代价与限制 |
| --- | --- | --- |
| A：提高全量 JS 门禁，M7 基线不变 | ×1.12 上限 475,734 B，U4 后余 6,320 B；×1.15 上限 488,477 B，余 19,063 B | 实现改动最少，但允许更大的首次下载／解析总量；需明确审批门禁政策。×1.11 仅余 2,072 B，×1.12 的 6.17 KiB 也不能保证够 B5。×1.15 的 18.62 KiB 是预算，不是 B5 保证值。 |
| B：回放／统计等按需加载，并区分首屏与全量预算 | 当前只把文件拆开，全部 JS 的 gzip 总和仍被计入；**单独拆 chunk 无法消除这 2,175 B 超限** | 首屏可减少下载／解析，并可独立缓存 vendor；需同时审批“首屏 JS 上限＋全量 JS 上限”的新门禁口径，明确算上所有按需文件。只延后界面／回放显示代码，完整领域账本和统计采集仍常驻；需要界面负责人改异步入口，并回归加载失败、旧页面跨发布资源失效与回放时序。gzip 字典拆开还可能使总量增大，收益需原型实测。 |
| C：保持 ×1.10，先做包体优化 | 必须净节省至少 2,175 B，再为 B5 预留其实际新增量 | 先评估重复字段／文案表／辅助函数去重、压缩器参数；不删冻结内容、不删效果和测试、不把依赖外置后不计入预算。要比较构建与完整回归结果，不能先承诺能省够。 |
| D：定制精简 Phaser 等依赖 | 本次没有实测收益 | 可能比应用代码去重收益大，但需要完整使用面审计、依赖构建与升级维护，并覆盖渲染／输入／表现回归。成本和影响面最高，暂不建议与 B4 签收捆绑。 |

推荐优先 C 做一个独立的只读构建对照；若收益不足且希望继续推进 U4/B5，再选择 A 的 ×1.15，同时保留首交互及内存门禁，B5 完成后重新量化余量。B 适合以首屏和更新缓存为长期目标时单独实施，不能当作现全量门禁下的直接过线手段。任何门禁／压缩配置／加载方式／运行代码都还未修改。

拆分及加载失败的机制依据 [Vite 7.3.6 构建文档](https://github.com/vitejs/vite/blob/v7.3.6/docs/guide/build.md#chunking-strategy)；该建议基于本仓库现有全量求和门禁与文档作推断，不冒称已跑按需加载原型。本次合入评估只验证构建和包体，不冒充 U4/B4 合入树的完整功能 CI。

### B3／B4 各三次原方法 preview 堆对照

基线精确 SHA `5dce5cd07f3f400be42981742dcb2dc3ceff2009`，当前运行代码精确 SHA `65252f332c1f1f15523cfd01b497c425089997bd`。同机 Node 24.21.0、Chromium 153.0.8010.12、相同 lockfile；顺序为 B3-1→B4-1→B3-2→B4-2→B3-3→B4-3，每份新建浏览器并串行执行。本次六份是新测量，之前 1,666,760 B（约 1.59 MiB）的 B4 样本和快照诊断另保留，未混入这三次比较。

两版脚本的 JSON 编码字符串 `runnerHash` 相同：`6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25`。原始脚本字节 SHA256 为 `1a5e52defeb2c30fc9e524a1edf958a0f3a9de56b515ed7f738a2bf867356c05`。调用原 `scripts/verify-m5-browser.cjs --preview --build=cannon --m6-f2`：2 次预热、30 次新局→导入→回放返回、原 GC 和原 1,048,576 B 门禁，无堆快照／额外预热。测量期间本任务不并发运行构建或其他浏览器。六份子脚本均完整结束，2 份堆断言失败退出1、4份通过退出0，全部保留。全部测量工作区干净、源码指纹前后相等；原脚本 runnerHash、硬件、loadAtStart、before/afterHeap、逐循环应用实例与资源数量见入库 JSON。

| 次数 | B3 增长 B | B3 门禁 | B4 增长 B | B4 门禁 | B4−B3 B |
| --- | ---: | --- | ---: | --- | ---: |
| 1 | 1,162,108 | 失败 | 1,446,608 | 失败 | +284,500 |
| 2 | 520,092 | 通过 | −16,580 | 通过 | −536,672 |
| 3 | 1,015,580 | 通过 | 752,352 | 通过 | −263,228 |
| 中位数 | 1,015,580 | — | 752,352 | — | −263,228 |
| 平均数 | 899,260 | — | 727,460 | — | −171,800 |

两版均 1/3 超限，区间重叠，配对差值方向反转；B3 第3次仅余 32,996 B。这说明**超限现象在未含 B4 的基线即可复现，本轮证据不支持把此前 1.59 MiB 样本判为 B4 引入的新泄漏／特定装备回归**。不能凭每版3份样本证明 B4 没有有界成本、所有装备场景都没有内存问题，也不能把复测成功当作稳定保证。当前未定位到可归因的具体装备或提交，不据此提出装备机制修复。

固定导入存档两版均 1,016,986 B；三组的 Match 状态除 contentDigest 外相等，三场战斗初始状态与完整事件账本逐字相等。该探针只穿原目录死亡之刃，没有绑定 B4 新增 itemPrograms。独立快照诊断中 B3/B4 的 Session、History、Coordinator 各1且旧对象ID全部释放；B4 28份静态 combatProgram、44份描述数量不增长，live JS object self-size只增加1,020B。快照会扰动GC，节点self-size也不等于正式Runtime.getHeapUsage的usedSize，**不能把其结果从正式总堆增量扣除，也不能据此认定总增量全部来自JIT**。

本次只调查，不改运行代码、装备数据、GC、预热、内存／包体门禁、冻结合同或G12。总堆波动的精确根因仍未定位。若继续调查，建议保留原门禁，在独立诊断中分周期区分运行对象保留与V8代码／分配区域，必要时针对目录／恢复校验提交做消融对照；有确定保留链后再提交最小修复方案，由用户决定，避免按装备名特判或通过放宽内存门禁处理。

该补充只提交文档和证据，CI #91仍绑定运行代码65252f3，不把旧CI冒称为证据提交新SHA的完整CI。

入库证据：[`docs/evidence/M8_B4_CI_EVIDENCE.json`](evidence/M8_B4_CI_EVIDENCE.json)。包含原CI、首轮日志身份、六份完整测量数据、三组固定存档对照、原快照诊断及最新U4构建资产哈希。

## R1～R5、H2 审计修复追加

上述65252f3/39ca01c记录保留为原交付证据。运行修复提交6e0d902的处理表、B3影响、反例复现、93文件1165项验证及固定U4重新测量，见[审计修复报告](M8_B4_AUDIT_FIXES.md)和[本轮本地证据](evidence/M8_B4_AUDIT_LOCAL_EVIDENCE.json)。B4单独gzip465933B，余1306B；加固定U4 5778cab后469878B，超2639B。H1仅登记；冻结合同、G12、包体优化和门禁均未改。完整CI必须绑定最终追加提交SHA，以本次签收汇报的运行链接为准，不复用原CI #91。
