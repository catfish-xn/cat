# H1 补测只读诊断

更新：下文日志缺口针对固定提交394853c；后续a062cece已补入，核验见 [H1_TRACE_REVIEW.md](H1_TRACE_REVIEW.md)。原统计和窗口数据未变。

本报告不是签收审计，不改变阈值、不采用 12 次预热、不证明或否定泄漏。

## 来源和复现
- 新证据固定 `394853cbdd7e305100c148c435cd18e9e6b81f98`；旧 2 正常样本直接读 `e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce`，另确认其两份 JSON 在新提交中字节不变。
- 复现：`python scripts/diagnostics/analyze-h1-followup.py . /tmp/h1-followup-reproduce`。仅使用 Python 标准库、Node 和 git show；无浏览器、无网络、无测试重跑；仅向指定输出目录写输出；任一一致性检查失败则退出非0。需先fetch该固定证据提交。
- `analysis.json` 包括逐样本原始数值、loadAtStart、文件 SHA256、298 项检查和统计；`source-runner.txt` 固定源脚本；`evidence-file-list.txt` 固定提交证据文件列表。
- 298 项检查通过。13 个 manifest（正常 10、趋势 3）均报源码 SHA `97f38a0e787a4edcb35df4a59823bb1d106def67`、status 为空、Chromium `141.0.7390.37`、Node v22.22.0、preview/cannon、touch=false、errors=[]。
- 从固定源码重新构造 runnerHash=`6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25`，sourceFingerprint=`80fa4a6b963ea9ce0163b12589cf8b6d19466dee5840d252d977702a6d87bf57`；均与全部 manifest 的起始/最终值一致。空 diff 的 canonical SHA256 也一致。sourceFingerprint 使用原实现的 UTF-8 解码、目录递归 localeCompare 排序及 canonical hash 规则。
- “干净”是历史 manifest 的记录且与 wrapper 检查吻合，不等于重新独立观测了过去的工作树。离线分析工作树与历史被测工作树分开，不把当前工作区状态冒充历史实测状态。
- 新 11 次 TSV 退出码与 manifest passed、failure 文本和失败附属文件存在性一致；退出码仅 0/1，无 124。TSV 与 manifest 可支持“没有记录到 timeout”，但缺完整日志，不将其扩张为独立日志审计通过。旧 2 次无入库 TSV，仅 manifest passed=true 和 README 声明。

## 正常组：原 2 预热、30 cycles、无快照、1,048,576 B 上限
所有增量由 raw JSON 的 after.usedSize − before.usedSize 重算，与 heapDelta 相同。

| 组 | n | 超限 | 描述性比例 | 95% Wilson 区间 | 均值 B | 中位数 B | 样本标准差 B | 范围 B |
|---|---:|---:|---:|---|---:|---:|---:|---|
| 旧批 | 2 | 0 | 0% | 0–65.8% | 918,598 | 918,598 | 155,900 | 808,360–1,028,836 |
| 新批 | 8 | 3 | 37.5% | 13.7–69.4% | 948,093 | 781,050 | 393,849 | 601,396–1,655,408 |
| 合并同参数正常样本 | 10 | 3 | 30% | 10.8–60.3% | 942,194 | 803,650 | 351,428 | 601,396–1,655,408 |

正常增量按旧 2、新 8 的顺序：808360、1028836；1175900、1655408、601396、651384、1335372、603184、798940、763160。新正常 01/02/05 超限 127324/606832/286796 B，其余通过。所有 10 次均为正增，但原方法只有各自独立的一个 post-GC 窗口，不能据此证明同一页面持续线性增长。

Wilson 为二项观测比例的标准公式，z=1.959963984540054；它不是误报率区间。没有“真实无泄漏”的独立标签，也没有独立随机抽样保证；样本按顺序在同一容器采集，区间只表达这组小样本观察的有限精度，不应外推为生产/CI 失效率。合并仅限已匹配来源、参数、浏览器的正常 10 次描述；不得混入趋势、快照、CI153 或 B4 重负载组。

## 趋势组：12 预热、连续 3×30 cycles、无快照

| 样本 | usedSize 起点→窗1→窗2→窗3（B） | 三窗增量（B） | 90 cycles 净增（B） | 首个失败 |
|---|---|---|---:|---|
| trend-01 | 15,125,052→14,749,744→15,326,920→15,386,720 | −375,308 / +577,176 / +59,800 | +261,668 | 无 |
| trend-02 | 14,258,868→14,463,928→15,045,472→16,215,936 | +205,060 / +581,544 / +1,170,464 | +1,957,068 | 第3窗超过1MiB（+121,888 B） |
| trend-03 | 14,244,348→14,559,352→15,162,724→15,238,536 | +315,004 / +603,372 / +75,812 | +994,188 | 三窗均正增 |

三个窗口的前后堆值首尾连续，第一窗与各自 m6-lifecycle.json、manifest.m6Lifecycle 完全一致，进度均到 window=3/cycle=30。persistentGrowth 的定义严格是 windows.every(heapDelta > 0)，不是增长速度递增或保留路径分析。

trend-01 和 trend-03 起点相差 880,704 B，终点相差 148,184 B；一负两正与三次正增这两种分类均受基线影响。二者后段较小增量与接近终点值得关注，但不能据此宣称收敛：trend-02 最后一窗 +1,170,464 B，终点 16,215,936 B，明显更高。3 次仅 90 cycles 的有限观察也不足以确证平台期或无界增长。

## 资源与断言顺序
- 全部 13 次生命周期 30 行以及前后值：listeners=82、pendingRaf=1，applications/sessions/observers=1/1/1。趋势全部窗端资源也恒定。
- listener 计数仅覆盖 window/document/canvas；这不是全 DOM 监听器普查，也不覆盖所有 JS 保留对象、浏览器/JIT 内存。恒定资源计数不能等同“无泄漏”。
- 原脚本 verify-m5-browser.cjs 第 23–54 行：每 cycle 先核对 state/effects/tweens/paused/save/lifecycle；完成预热后 drainInputs→collectGarbage→getHeapUsage；30 次后再 drain/GC/measurement。
- trend 第 43–45 行在断言前已经保存三个窗口和 persistentGrowth；第 47–50 行依窗检查 listeners、RAF、1MiB 上限；第 52 行才 assert(!persistentGrowth)；第 54 行才执行原第一窗 listeners/RAF/heap 断言。
- 因此 trend-02 的原始 persistentGrowth=true 仍是有效观测，但实际抛出的是先执行的第3窗上限断言；trend-03 三窗都没超限，后命中 persistentGrowth。正常 01/02/05 则在第54行 heap 断言失败。失败不代表完整路线后续部分已执行。

## 环境与证据缺口
- 所有 manifest errors=[] 不等于整个工具链没有 stderr；失败独立记录在 failure。缺日志尤需区别。
- loadAtStart 已保留于机器输出。normal-01 为 [0.6,0.14,0.04]、normal-02 为 [4.17,2.55,1.1]，之后多约4，CPU count=4。TSV 支持这两批测试顺序执行；不能由此验证机器不存在其他并行负载，也不能仅凭 loadavg 反推泄漏或清理失败。
- 固定提交证据目录中 `.log` 文件为 0。新 README 所列 build.log/normal-NN.log/trend-NN.log 和旧 README 所列 run.log 都未实际入库。建议补原日志，保留失败记录，不必因此新跑测量。
- 仍缺：原 2 预热下同页面连续等长窗口；独立 B4 重负载序列；Chromium 153 CI 匹配环境的同参数诊断。现有 12 预热趋势不能替代原参数连续趋势。
- 这些样本证明门限附近存在重复可见的超限，并观测到部分趋势持续正增；尚不能把增量归因为应用泄漏、JIT/浏览器缓存或测量噪声。归因需要保留引用路径、分类时间序列和匹配环境证据。不能据此放宽门禁、采用12预热、宣称H1通过或改写CI。

## 后续与状态

本轮为诊断中间报告，未送独立签收审计。方法候选、剩余采样与需要批准的CI路线见 [H1_DIAGNOSTIC_NEXT_STEPS.md](H1_DIAGNOSTIC_NEXT_STEPS.md)。不再盲目追加141正常样本；现有脚本、门禁和CI配置未改。
