# H1 堆门禁：替代环境实测（Claude 代跑）

Dot 沙箱内 Chromium 启动被 socket EPERM 拒绝（见 `docs/H1_PREFLIGHT.md`），经用户同意，由 Claude 在另一云端容器按原脚本、原参数代跑。**只运行和收集数据，未改源码、脚本、GC/预热参数、门禁阈值或 CI。** 本目录是诊断辅助数据，不是门禁证据，不能据此宣称 H1 已解决或存在泄漏；诊断结论和后续处理由 Codex（Dot）负责。

## 运行身份

| 项 | 值 |
| --- | --- |
| 源码 | `97f38a0e787a4edcb35df4a59823bb1d106def67`（Merge accepted U4 into M8 baseline），工作区干净（manifest `status` 为空） |
| 命令 | `npm run build` 后 `CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/verify-m5-browser.cjs --preview --m6-journey --build=cannon`（与 CI `browser-preview-cannon` 相同参数，未经 `ci-m5-step.cjs` 包装）；快照运行另加 `M6_HEAP_DIAGNOSTICS=1` |
| 参数 | 预热 2 次、30 次循环、preview 上限 1,048,576 B（脚本默认，未改） |
| 浏览器 | **Chromium 141.0.7390.37**（容器预装）。CI 由 Playwright 安装 **Chromium 153.0.8010.12**（revision 1243）；本地无法下载该版本。不同版本的 V8/GC 行为可能不同，本数据不可与 CI 数值直接等同 |
| 环境 | Linux，Node v22.22.0，Intel Xeon 2.10GHz ×4，内存 16.9 GB；三次顺序执行，无并行负载 |
| 时间 | normal-1 13:25:53–13:40:09Z，normal-2 13:40:09–13:54:26Z，snapshot-1 13:54:26–14:08:57Z（2026-10-08） |

## 结果

三次脚本均 `passed: true`、退出码 0、`errors: []`；监听器 82→82、pendingRaf 1→1。

| 运行 | 快照 | before usedSize | after usedSize | heapDelta | 相对 1 MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| normal-1 | 否 | 13,624,772 | 14,433,132 | **808,360** | 77.1%，余 240,216 |
| normal-2 | 否 | 13,649,040 | 14,677,876 | **1,028,836** | 98.1%，余 19,740 |
| snapshot-1 | 是 | 13,825,532 | 14,564,820 | 739,288 | 快照会扰动测量，不计门禁 |

对照：CI #95 首轮 cannon preview 为 1,147,300 B（超 98,724 B），重试通过。两次正常测量相差 220,476 B，同一源码在门禁附近波动；仅两次样本，不足以估计误报率。

## 快照增量（snapshot-1，after − before，按构造器）

`snapshot-diff-by-constructor.json` 由 `snapdiff.py` 生成（按节点类型+名称汇总 self_size，未追保留路径）。总 self_size 20,885,334 → 21,955,838（+1,070,504），节点 253,958 → 259,473。

| 主要增量 | 数量 | self_size |
| --- | ---: | ---: |
| V8 代码对象（`code:`、TrustedByteArray、ProtectedFixedArray、FeedbackVector、BASELINE instruction stream、TrustedWeakFixedArray 等合计） | — | 约 +777,000 |
| `hidden:system / WeakArrayList` | +558 | +62,696 |
| `native:DOMRectReadOnly` | +418 | +23,408 |
| 性能条目：PerformanceLongAnimationFrameTiming / TaskAttributionTiming / PerformanceLongTaskTiming / PerformanceScriptTiming / LayoutShift(+Attribution) | +142 / +146 / +146 / +106 / +59(+209) | 约 +85,000 |

观察（待 Codex 判断，非结论）：增量大头是 JIT 编译代码与反馈向量，随循环中更多函数被编译/分层而增长；其次是浏览器性能时间线条目和 DOMRect。是否属于应用保留链、是否随窗口持续增长，需要 Codex 按 H1 立项方法（连续等长 post-GC 窗口、保留路径）进一步确认。

## 文件

- `normal-1/`、`normal-2/`、`snapshot-1/`：`manifest.json`（脚本完整报告）、`m6-lifecycle.json`（堆/资源与 30 行循环记录）、`run.log`（输出尾部）。
- `snapshot-1/before.heapsnapshot.gz`、`after.heapsnapshot.gz`：原始堆快照（gzip -9），可直接在 Chrome DevTools Memory 面板解压后载入比较。
- `snapshot-1/snapshot-diff-by-constructor.json`、`snapdiff.py`：上表的汇总及脚本。
- `run.sh`：本次顺序执行脚本（`$SCRATCH` 为临时目录）。
- 其余输出（每回合 JSON/截图、导出文件等约 80 MB/次）未入库，如需可再提供。
