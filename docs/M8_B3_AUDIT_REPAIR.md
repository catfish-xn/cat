# B3 第二批审计修复（2026-10-07）

基线 `feat/m8-b0-baseline@fce88e5`，合同基线 `2632925`。开工时 `git pull --ff-only` 为 Already up to date；随后提交前 fetch 发现 PR #10 于工作期间合并，已快进到 `6a79a49`。新增仅为签收的 M8B 文档/来源说明，未修改运行TypeScript、测试或B2合同；保留本轮全部修复，测试代码范围与本地验证保持一致。本次不实现 M8B 野怪逻辑，不修改 `contracts.ts` / `ui-contracts.ts`、B2 冻结规则、表现层、回放严格比较、CI 路径或门禁。

## R1–R4、R6 修改与独立预期

| 问题 | 修改位置 | 独立预期与验收 |
| --- | --- | --- |
| R1 P1 | `m8/s13-mechanisms.ts` 的直接治疗规划和旧技能直接治疗提交：ID 使用 canonical Source 六字段元组，不依赖对象属性顺序 | 真实 seed42：两次 cloak 合成巨龙之爪给 unit-1，三英雄部署 (1,4)/(3,4)/(5,4)。t39=699/763，t40 请求 floor(763×250/10000)=19，有效19，HP718。`m8-b3-audit.test.ts` 同时断言规范序列化恢复前后的完整事件/状态相等，并对恢复后续录前缀执行 `validateBattleRecord`；另测回退治疗入口来源键顺序置换 |
| R2 P2 | `m8/shield.ts::validateShield`、`m8/restore.ts::validateMechanisms`：正剩余禁止已消费，投影结束原因和待执行结束任务一致 | 真实 t104 刀妹盾400、到期164：合法活动状态接受，只翻转消费标记则拒绝；400全部实际吸收后，剩余0/absorbed400/待任务允许，下一规划只发一次；已消费0且无待任务允许、不重发；缺失任务、已消费仍有任务、非零初始授盾耗尽后缺原因分别拒绝；初始授盾0且保留唯一待任务允许、不误拒绝 |
| R3 P2 | `m8/s13-mechanisms.ts` 到期/净化：仅取消明确绑定该灼烧贡献的附着时钟，不凭普通状态贡献同名删除独立任务 | 匿名20tick周期，在t20施加+10护甲，next-tick生效21、到期31；t31保留任务，t40再次施加、41生效、51到期，下一跳60。补到期和净化两个集成向量，保留灼烧到期末跳/净化取消任务的已有测试 |
| R4 P2 | `combat-s13-abilities.ts::executeTask` → `m8/s13-mechanisms.ts::executeShieldEnd/executeMechanismEffect` 内部上下文 | 原施法序号7、AP100、吸收0、自然衰减完毕：结束发包70、area=true、triggeringCastActionSeq=7；重复执行不再发包。断言实际任务向通用入口生成的包，不以辅助金额函数替代 |
| R6 P3 | `m8/s13-mechanisms.ts::cleanupMechanisms`：删除所有来源队列中指向死亡目标的 attachedDot | t1伤害240击杀100HP目标，保留其他敌人使战斗继续，t21/41/61/81四任务立即清空；反向场景来源死亡/目标存活保留四跳50，实际在21/41/61/81发射、结束后队列空，无额外RNG。按字段处理，不按英雄名删除 |

新增复现测试在生产修复前实际运行，R1/R2/R3/R4/R6 各有失败记录；反向“来源死、目标活”向量原实现即通过，保持该合法语义。数值预期来自冻结合同及输入，不使用生产输出生成答案。R2 后续组合、R1 回退入口补测覆盖恢复和身份边界。另先用初始授盾0的守恒夹具复现恢复误拒绝，再允许无结束原因的未消费零初始盾；耗尽非零初始盾仍要求结束原因，任务约束不放宽。

恢复规则是对冻结语义的校验补齐；R6 是旧实现也有、但本批须落实的死亡清理缺口。R4 修复上下文回归，金额不变。治疗 ID 的修复会改变完整事件哈希：保留旧 golden，必须先通过手算/真实恢复向量，再核对正常路线命令与独立资源账本后更新哈希；不能放松回放或恢复验证。

## R5 原门禁失败与调查

原完整 CI #75，`fce88e5`：[37597141913](https://github.com/catfish-xn/cat/actions/runs/37597141913)。炮手 dev 在原2次预热、30次应用生命周期后增长1,763,096B，超过1,048,576B；其余9项验收作业通过，证据比较前置失败跳过，两可选诊断任务按参数跳过。签收第一批 `877c59b` 同项76,260B，不能以旧绿色替代本批失败。

先检查新增状态、周期任务、余数账本、状态贡献、护盾分账、治疗记录与缓存，而非预先归因机器噪声。金额 Map/Set 属单次执行，属性索引缓存是 WeakMap，不作为旧战斗的强根。战斗结束清空任务/状态/盾，余数随任务清理；引导活动的结束收据仍按冻结合同保留于当前战斗，历史事件保持完整。新局/导入替换活动 Session/History/Coordinator，回放关闭清除 Playback 缓存，历史档案的合法保留不作为泄漏删除。

本地在只读 `fce88e5` worktree 沿原炮手 dev 路径采集前后快照，仍2次预热、30次测量、同一1MiB断言。`M6_HEAP_DIAGNOSTICS=1` 会扰动 GC/编译时序，本地诊断不能替代最终无快照的完整 CI。该样本 usedSize=16,700,180→17,738,912B，增长1,038,732B；listeners83→83、RAF1→1。

以对象属性集合识别机制及生命周期所有者，不依赖构造函数名字。fce88e5 前后快照：

| 对象/账本 | before | after |
| --- | ---: | ---: |
| MechanismState（含静态EMPTY模板） | 24 | 24 |
| PeriodicTask / Remainder / StatusContribution | 0 / 0 / 0 | 0 / 0 / 0 |
| ShieldState / ShieldLayer | 660 / 660 | 660 / 660 |
| HealOutcome | 2 | 2 |
| CombatActivity | 29 | 29 |
| MatchSession / BattleHistory / SaveCoordinator | 1 / 1 / 1 | 1 / 1 / 1 |
| MatchApplication / PlaybackSession | 1 / 0 | 1 / 0 |

旧Session、History、Coordinator的对象ID不在后快照中；旧护盾分账、治疗结果和活动对象ID也不再保留。Application按设计保留同一实例。机制静态空模板不属于旧局；完整历史盾事件合法保留660个对象，数量没有随30次替换累加。这里是对象识别与节点ID比较，不冒充完整dominator分析，也不能从“当前边界任务0”推出从未有任何短期残留；R6已单独用存活战斗断言即时清理。

快照节点self-size净变化中，InstructionStream +575,040B、TrustedByteArray +157,880B、ProtectedFixedArray +76,340B；Object净+912B、Array净+208B。关联较大新编译块包括原有renderItems、Text2/updateText/Arc2/Shape2、eventText、innerSerialize、planFx、planS13Cast、validateStatBounds。对照第一批后才能讨论归因；这些节点口径与Runtime.usedSize不同，不能相减抵扣门禁。

fce88e5 两快照SHA256：before `48563b619aa269ec32a097ba63b64abb9b39e7b2cca4018013b0abd420a9b66f`，after `8497134440fe73c63205375070290e86277243b5f8f4e91e6c2d64d93e2a287f`。原文件在任务诊断目录 `work/r5-before/`，不把生成物提交到仓库。

同机器、相同Node24.21.0/Chromium153.0.8010.12、原2次预热/30周期的第一批只读worktree诊断已完成：

| 版本 | usedSize before→after | 增量 | InstructionStream节点净增长 | 所有者/旧实例 |
| --- | --- | ---: | ---: | --- |
| 签收第一批877c59b | 14,729,768→15,737,256B | 1,007,488B | 626,496B | Session/History/Coordinator各1→1，旧ID均消失，Playback0→0 |
| 审计基线fce88e5 | 16,700,180→17,738,912B | 1,038,732B | 575,040B | 同上，新增机制对象数量保持稳定 |

本地增长差31,244B，未复现两份CI产物76,260B与1,763,096B的巨大差距；第一批本身也出现约1MiB的编译/原生浏览器增长。first完整诊断脚本退出0、passed=true、source fingerprint前后相同，耗时853.372秒。fce88e5诊断在30轮堆测量/前后快照完成后，后续完整路线主动停止，未计为完整路线通过。两份诊断有快照且其他验证负载不完全一致，不能当作严格配对性能实验，也不能替代无快照CI。

修复后第一次无快照本地检查在回放“返回当前局”按钮的点击等待超时，未到达heap采样。失败现场mode=active/replay=null，已回到活动局，page errors为空、源码fingerprint稳定；保留trace和日志，不将其算作heap结果。随后减少并行浏览器负载按原脚本重跑；没有修改按钮等待时间、预热、周期、阈值或路径。

结论边界：本地样本不支持“第二批新增运行状态未释放造成持续积累”，已有编译/浏览器预热增长在第一批同样存在；R3/R6按合同修复生命周期，不能假称这两个逻辑修复已解释原CI的1,763,096B。原CI没有heap snapshot，精确归因仍有限，不能完全排除第二批增加编译成本或运行条件放大增长。修复后减少并行浏览器的原脚本无快照复测已完整退出0、passed=true、源码fingerprint前后一致：usedSize16,767,392→17,044,248B，增长276,856B，listeners83→83、RAF1→1，仍2次预热/30周期/1MiB。耗时450.967秒，heapDiagnostics=false、warmupExperiment=false；测试路径、等待时间与阈值均未改。它证明修复版在这一本地样本通过原门禁，不把变化全归功于R3/R6，也不替代最终提交完整CI。

## 验证记录

- 独立审计定向向量38项（4文件）通过；包含5项新真实Match/恢复/身份测试、两个匿名周期集成向量和三项任务/包断言。
- 四条正常命令路线全部victory，与fce88e5的命令序列逐项相同，原独立经济/商店RNG/资源账本通过：8142/11795/11858/11391tick，182/178/172/182命令。旧golden逐字归档，修订2/digest84c32d26由内容自动生成，严格回放不放宽。
- npm run build通过：TypeScript + Vite96模块、7.26秒，保留已有chunk大小提示；锁文件不改。
- 初次全量在旧golden下发现四条路线及M6对应检查的事件哈希变化，主动停止，不作为通过结果。迁移golden后第二轮因并行浏览器负载三条M6长回放超过原120秒（146.698/130.542/123.459秒），主动停止并保留日志，不增加时限。所有浏览器检查结束后重新单独运行完整npm test，68文件/919项通过、597.70秒。随后补入R2初始零授盾断言并最小修正恢复校验，4文件/38项再通过，最终代码再次全量运行；最终推送SHA的完整CI也执行全量npm test，精确结果在任务汇报中绑定运行链接。
- 冻结contracts.ts/ui-contracts.ts与2632925逐字一致；CI工作流、验收脚本/阈值/路径和表现层均未修改，git diff --check通过。未修改任何原测试的断言或时限。
- 最终完整CI需绑定最终推送SHA，无快照/无预热实验/无profile，等待全部作业结束后在任务汇报中给出精确运行链接和结果，不合并。


## 完整 CI #78 的独立时间门禁失败及补充修复

审计修复提交 `da4e90c` 已推送，完整 [CI #78](https://github.com/catfish-xn/cat/actions/runs/37606118681) 全部结束：9项成功、input-dev失败、证据比较及两个可选诊断跳过。炮手dev的R5原门禁通过：2次预热/30周期，usedSize16,489,516→16,010,908B，增量−478,608B；listeners83→83、RAF1→1，各轮Application/Session/Observer各1，Node22.23.3/Chromium153.0.8010.12/AMD EPYC7763，源码指纹前后一致。该运行保留为失败，不能报成整份CI通过。

新增失败来自未改动的 `verify-m6-performance.cjs:123`：capture P95 91.7ms超过冻结50ms，其余七项时间预算通过。它与R5堆门禁分开记录。原fce88e5的CI #75此项38.8ms通过；同机只读fce88e5原脚本复测53.6ms失败，da4e90c原脚本复测70.1ms失败，故不能只归因CI环境。载荷没有由审计修复放大：incrementalBytes2,011,585→2,007,755、events均3469，completeBytes24,908,541→24,866,531。样本时序并非严格性能因果实验，不能从差异证明每项修复都无时间影响。

通用哈希入口 `src/simulation/content/index.ts::digestContent` 对完整规范文本先split成逐字符数组，每份大前缀制造大量短期引用，再逐UTF-16码元计算FNV。补充修复直接按索引读取码元，保持完全相同的排序/字节语义/32位运算/哈希格式；不增加缓存、运行状态或档案字段，不改变内容digest84c32d26，不迁移golden、不更改规则/格式版本。不能假称该短期分配解释了原R5的全部堆增长。

先补独立UTF-16LE码元FNV固定向量：null=77074ba4、空数组741638a5、含中文/代理对/换行的字符串2f1e0ccb、双事件对象908020e1；优化前通过，优化后连同恢复/回放/存档所有权/内容61项通过。大档案原脚本复测全部通过：capture P95 47.5ms，其余七项时间门禁通过，module lifecycle堆增量182,316B、源码指纹稳定，载荷与优化前逐项相同；构建96模块/7.12秒通过。最终代码全量npm test -- --maxWorkers=2通过：68文件/920项，599.42秒；完整CI须绑定补充修复后的最终推送SHA，全部作业终态及运行链接在任务汇报中给出，全部门禁和验收路径保持冻结。
