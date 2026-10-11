# 节点三性能收尾

基线固定为 `f58c9fe1e55de9ca6b5c8be618d49aa02d789f45`，独立分支 `perf/m8-node3-tick`。冻结 p95 ≤ 5 ms、p99 ≤ 10 ms，原 9v9 负载不减。PR #30 Draft，main 不合并、不部署。独立功能审查已先行完成，见 [独立结论](M8_NODE3_FUNCTIONAL_REVIEW.md)；性能变更需另审。

## 口径

原 `d901b3f33a9e210e69281ce141bcbbfdd4cdbb5f` 测量的 distinct / mirror p95 分别 40.772341 / 46.131405 ms，p99 分别 111.610722 / 135.5672 ms。这是 `scripts/verify-m8-performance.cjs` 的独立 Node 子进程纯领域 `stepCombat(state)`，通过 Vite SSR 加载 TypeScript 源码。`--target=preview` 只指定另一浏览器部分的 dist，**领域数字不是生产浏览器包耗时，也不含渲染**。

环境：Node 22.23.3，Vite 7.3.6，Linux 容器 CPU 配额 4 核、内存上限 16 GiB。`hrtime.bigint()` 紧贴 stepCombat 前后，转为毫秒；包括计算、内部复制、验证、事件生成和期间 GC，不含夹具编译、导入、磁盘、历史捕获、哈希或渲染。原循环在计时外统计事件与活跃条目。两种 fixture 均 18 个三星单位、每人 3 件成装（54 件），每侧 9 个不同英雄；distinct 两侧共 18 种，mirror 为 A 阵容镜像。装备合法性由生产策略校验，SPEC 不变。

每种 variant 单独 seed 0 完整战斗预热，然后 GC；seed 1..30 完整战斗连续采样，战斗之间不强制 GC，结束 tick 也计入。所有 tick 合并取 nearest-rank p95/p99，不截尾、不剔除最坏值。硬件 GPU 复测是独立的浏览器帧间隔验收，不能替代或解释这里的 CPU 失败。

新增 `scripts/m8-node3-pressure.cjs` 只用于固定 9v9 诊断及配对比较，保持上述负载、计时边界与分位方法；不冒充包含 30 公开路线的原完整报告。剖析器开销单列，剖析结果不用于预算签收。原完整脚本与预算不改。

环境补充：CPU 型号 `INTEL(R) XEON(R) PLATINUM 8573C`。固定工作区共享同一 `node_modules` 依赖目录；原 `node_modules/` 忽略规则未覆盖符号链接，基线专项及原脚本启动身份记录含 `?? node_modules`，tracked diff 为空。原字段保持不改，另记录链接目标；本地 `.git/info/exclude` 后续已补 `/node_modules`。因此不宣称基线当时的完整 git status 为空。

原脚本双边运行使用 `--part=domain --target=preview`，保留全部30路线和各30场9v9，**manifest formal=false**，因为没有同时运行 browser 部分。它是完整领域采样复验，不是完整节点三签收，也不替代硬件GPU检查。

## 既有恢复优化

`2837b87ec6068258396db9b28bd405c28a950592` 已作为 `510dc93b7714c7e5af722bb14fb6eb93ea26920f` 纳入基线。它优化 restoreMatch 的 JSON 文本可表示性检查，而 9v9 计时区不调用 restoreMatch/canonicalContent；本轮不重复并入，也不把它视为 9v9 修复。

## 交付包提交对应

当前工作区实际存在下表两个 `d901b3f` 命名 ZIP；未找到独立 `f58c9fe` 命名的预览/证据 ZIP。f58 是最终送审与交付文档身份，不能仅据该名称推断另有一次站点构建。

| 对象 | 对应 SHA / 覆盖 |
| --- | --- |
| `m8-preview-d901b3f.zip` 的 site | d901b3f 生产构建；运行源码与最终 f58c9fe 完全一致 |
| `m8-b10-evidence-d901b3f.zip` 的正式性能、桌面、U3/U4 | d901b3f 原始运行报告，保持原标签 |
| 两包中的 BR4 样本/证据 | b4ca11c7bac9f63c82416ded5bde0e013b11263f 公开路径补验 |
| 两包中的 delivery.json、最终审查文档和 CI #232 | f58c9fe 最终文档提交与同 SHA CI，不能反称旧测量在 f58 重跑 |

三者 src tree 均 `49fb300c5ca6f014201f289a87f8d5a54649c551`，tests tree 均 `3509408ef4fee47d6ca76deaeb9cc146fe8ab7fa`。已重新校验 ZIP CRC 及 SHA256：预览 `041c5422a34949f13961038428b589a66ec47c604bd070f882b3dff0fc419727`；证据 `05fbf846bedd870146b900dd2cd25efd1aeccad0562dceab3cef82571c4df93e`。本轮性能分支不在旧包覆盖内，不覆盖旧包。

## 首失败保留

剖析脚本首次启动在读取 Git SHA 时被沙箱子进程限制拒绝（spawnSync git EPERM），尚未进入预热或采样。日志保留，关闭该进程后在允许本地 Vite/子进程的同一环境重启；不算性能失败样本，不隐藏原 9v9 预算失败。

## 原场景剖析与最小改动

固定 f58 的两种 variant 均采集 seed1..30 全战斗 CPU profile，预热仍为 seed0。V8 Profiler 每战启停，夹具生成在剖析区间外；启动/停止开销仍出现在样本内，单列，不把 profiler 耗时作预算数据。下面为按栈归属的互斥采样分类，不能解释为独立计时器的精确耗时。内联与匿名代码可能归入“战斗/其他”。

| 类别 | distinct | mirror |
| --- | ---: | ---: |
| 战斗计算/其他 | 37.19% | 36.45% |
| 复制/来源标识序列化 | 29.41% | 29.96% |
| 事件/触发器处理 | 13.76% | 15.93% |
| 显式校验 | 1.26% | 1.54% |
| GC | 6.24% | 5.62% |
| Profiler 开销 | 12.14% | 10.51% |
| 渲染 | 0 | 0 |

主要函数自身采样：`structuredClone` 25.28% / 25.31%；`advanceS13Tick` 14.98% / 15.41%；`dispatchTriggers` 有文件路径的帧 5.04% / 5.08%（匿名/内联帧另保留在原表）；`canonicalSource` 2.67% / 3.19%。序列化主要是来源标识，**不是存档恢复**。self/inclusive 各前40项汇总见 `evidence/m8-node3/profile-baseline.json`；行级采样等完整原始信息保留在 V8 `.profiles.json`，留在 artifacts 和交付归档。

保留的源码固定为 `cf76af02ccc70e9b7adb94c718bbb2e0365b8acd`，src tree `370b3bf4da2b0c86f2782f79b5acc7f1e4b46963`：

1. `2274651fde3115fd712193032450f00a6eaacdcc`：每 signal 一次最小 TriggerUnit 投影，代替每 holder 展开整队完整单位。静态审查确认派发间仅替换 triggerLedger，效果在全部 holder 完成派发后执行；virtualHp 仍按每 signal 采样。
2. `4aedd3b`：保留原 clone 入参，只以 Object.assign 给尚未逃逸的新原生克隆填覆盖字段，省掉第二次整单位展开。

`307a448` 曾试验无原型临时输入对象；专项边界通过，但 distinct 回退、mirror 改善，缺乏一致收益。`cf76af0` 撤回此实现，保留新增边界测试及首次结果。未尝试无保护 ledger COW 或后移 readCounters：那可能改变访问器/非法输入的读取与异常行为。无校验被删减。

## 隔离 9v9 配对结果（不是原完整运行）

| 候选 | distinct p95 / p99 ms | mirror p95 / p99 ms |
| --- | ---: | ---: |
| 固定 f58 基线 | 27.873527 / 77.025248 | 27.384570 / 55.972359 |
| 仅一次触发投影 | 19.918942 / 46.382588 | 20.612831 / 34.701133 |
| 再复用原生克隆（保留） | 16.530745 / 29.472261 | 17.377198 / 29.155715 |
| 无原型输入试验（已撤回） | 20.259472 / 48.559350 | 15.555408 / 25.649165 |

每行都是同一 Node/容器、同一 SPEC `e27075f0279c368a3ca2d71e8cc7d81aeab976569eccd0bbeedcd9cf3fb321ad`、每 variant 30 完整战斗，3394 / 4005 tick，无删样本。全部仍未达 5/10 ms。不要将旧完整运行的 40–46 ms 与这里直接相除声称优化幅度；本工具未先运行原脚本的 30 路线生成/重放，且计时外诊断工作不同。原脚本的双边完整领域复测另列。

## 等价和拒绝边界

固定 f58 与干净 cf76 的 60 战、7399 tick、201246 条事件逐步完整对照通过；两侧历史输入深度冻结，完整 state/ledger、RNG 状态、结束状态一致。0/39/40/41/end 的 JSON 运输续算也通过。引擎压力夹具不是合法经济/回合来源的 Match，因此此项不冒充 restoreMatch 接受该夹具；正式 Match 保存/回放由既有完整测试覆盖。

类型检查通过；复制/触发专项 3 文件 11 项通过。新增3项覆盖 own `__proto__`、循环/共享引用、Map/Date、读取顺序、getter删除/新增后续键；旧 B8 的函数拒绝、Date和稀疏数组反例保留。原生 clone、restoreMatch/canonicalContent 和校验器均不改。

`itemPrograms` 与 `sources` 是主要静态复制载荷；更大范围的冻结/共享可能改变物理可写性和引用边界，方案见 [待决定提案](M8_NODE3_COPY_PROPOSAL.md)，尚未实施。不会用该未测方案宣称已达到 5 ms。

[CI #233](https://github.com/catfish-xn/cat/actions/runs/38146630851) 在固定 `cf76af02ccc70e9b7adb94c718bbb2e0365b8acd` 上整条 workflow 通过：146 文件、2059 测试、0 skip，测试770.15秒；原 cannon/sniper/mage/sniper-caitlyn 逐 tick 恢复用例分别 95245 / 146173 / 139264 / 133281 ms，原超时不改。44装备保存/回放、临时子件伪造拒绝、全部既有机制/非法输入断言都在该完整运行内。六条浏览器路线、双输入路线和全部比较器通过，比较器 skip 为空；两个未启用的可选诊断 job 为 skipped，不是跳过测试断言。后续纯文档提交另有 SHA，不能称 CI #233 在文档新 SHA 上运行；CI 绿不等于9v9预算通过。

## 原脚本双边完整领域结果

固定 f58 / cf76 两个工作区依次运行原脚本，未并行本机测试、构建或浏览器。命令均为 `node scripts/verify-m8-performance.cjs --part=domain --target=preview`，仅证据目录不同。30条公开路线、990战和两组各30场9v9完整采样；两侧路线结果、tick数、每战事件数/负载/状态峰值完全一致。

| 指标 | 基线 p95 / p99 / max ms | 保留版 p95 / p99 / max ms | 样本数（两侧相同） |
| --- | ---: | ---: | ---: |
| domain.fullRuns.tickMs | 3.986471 / 7.623596 / 3935.078806 | 3.863126 / 6.320284 / 593.692646 | 326641 |
| domain.pressure9v9.distinct.tickMs | 49.267503 / 108.598768 / 1801.885650 | 16.843342 / 31.758186 / 538.264931 | 3394 |
| domain.pressure9v9.mirror.tickMs | 54.987229 / 105.515669 / 342.033645 | 15.337376 / 25.477027 / 234.415701 | 4005 |

基线运行 2026-10-11T14:23:55.365Z → 2026-10-11T14:47:23.045Z；保留版 2026-10-11T14:47:44.931Z → 2026-10-11T15:12:53.523Z。两侧 `errors=[]`、`formal=false`（仅领域）、`allBudgetsPass=false`（保留版）。报告模式退出码0不等于通过。CPU目标仍为5/10ms；不以原公开路线通过替代9v9达标。

固定 cf76 的 [CI #233](https://github.com/catfish-xn/cat/actions/runs/38146630851) 完整通过；所有原断言/预算保持。最终文档归档提交若不同，其与cf76的生产/测试树绑定在交付及PR31说明中，不能把cf76的测量冒称最终文档HEAD重跑。

保留两项优化作为 Draft 候选的依据是两种9v9在专项与原脚本中均有改善，且完整等价/拒绝边界和CI通过；**不是节点三签收或普遍加速结论**。30条公开路线中16条单路线p95上升、14条下降，例如 mage-42 从3.089055升至6.046978ms，cannon-0从2.207637升至4.164188ms；全部原值在报告中。整体脚本墙钟也从1,407,681增至1,508,592ms，包含未计时路线生成和诊断，不能将其与tick指标混用。该单次配对没有证明路线回退的原因，后续仍须关注。

9v9的p95/p99仍全部超标，保留538.264931/234.415701ms的最坏tick，不删除GC或其他慢样本。CPU目标、原始脚本、夹具、30路线与60场9v9、事件与验证覆盖都未改变。下一步冻结/共享提案尚待用户明确决定；硬件GPU与试玩也未签收，PR30/31均保持Draft，不合main、不部署。
