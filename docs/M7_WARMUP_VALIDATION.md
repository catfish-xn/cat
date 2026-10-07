# M6 / M7 预热对照实验

## 授权与固定条件

> 后续决定（2026-10-07）：用户确认 M6 基线也有增长时，单独作为已知问题跟踪，不以此阻塞 M7 合并。第三轮失败确实发生在 M6 main preview；调查已移至独立分支。见 [M6-MEM-01](M6_LIFECYCLE_KNOWN_ISSUE.md)。以下三轮原始结果和失败记录保留，正式 1MiB 门禁不变。

用户于 2026-10-07 批准：12 次预热、30 次测量、1MiB 上限；在 M6 main 和 M7 上连续运行至少 3 次 CI，保留全部结果。如预热后仍持续增长，按真实泄漏方向处理。

- M6：main 在开工时的 HEAD `a8be9fc151b9ebb895eb4097828bb74c590e2559`。此提交已合并 M6；对照签收 `631c131`，`src/`、package/lock 和原测量脚本无差异，不能继续把 main 描述成 M5。
- M7：本次实验前的分支 HEAD `67527610063802d995c4f95044d82c7ad4afe9dc`。
- 实验结束、推送记录时，远端另有 Claude 的 UI 提交 `b252c34`。已保留该并行提交并仅重放本报告；它不在本次固定 M7 样本中，不能把以下结果当成新 UI 提交的内存验收。
- 每轮矩阵：M6/M7 × dev/preview，四个独立 Ubuntu 24.04 / Node 22 runner，分别按各自 lockfile 安装并构建。
- 三轮使用相同实验提交与固定目标 SHA；上一轮结束后才派发下一轮。不从失败中挑一次成功，不重跑覆盖结果。
- 不修改 main、不合并分支、不修改 UI/规则/存档、预算常量或普通完整 CI 的正式测量方法。

## 测量方法与理由

此前同一应用源码的正式 2 次预热样本既有超标，也有通过；本地 M6/M7 的 60 次诊断均表现为早期增长、后段回落，主要应用实例未累积。详见 [M7_CODEX_AUDIT](M7_CODEX_AUDIT.md)。因此验证固定增加预热次数能否减少运行时编译/缓存对测量起点的影响，**不提高 1MiB**。

共享 `verify-m5-browser.cjs` 通过 `M6_WARMUP_EXPERIMENT=1` 显式进入实验：

1. 按原公开浏览器路线实际完成前三场战斗与回放/故障隔离检查，从浏览器公开导出当前局。
2. 原生命周期动作不变：新局、种子 42、选择、导入、进入回放、返回；每循环验证状态相等、effects/tweens 清空、保存成功以及 application/session/observer 各 1。
3. 预热从 2 次增加到 **12 次**，清理输入观测队列，强制 GC，读取 Runtime heap 和监听器/RAF 基线。
4. 连续 **30 次**原循环，中间不 GC、不取 heap snapshot；结束清理输入队列、强制 GC，读取后值。`heapDelta = after.usedSize - before.usedSize`，上限仍 **1,048,576B**。这是规定的主测量窗口，先独立写入 `m6-lifecycle.json`。
5. 主窗口完成后，在**同一浏览器进程**追加两段各 30 次的趋势观察，每段末尾同样 GC 和采样，写入 `m6-heap-trend.json`。后续观察不追溯修改主窗口的前后值，也不冒充只有 30 次的正式验收。
6. 每窗口保留原资源约束和 1MiB 上限。若三个窗口全部正增长，保守地判实验失败并要求按潜在真实泄漏排查；不把这种趋势自动解释成正常代码增长。这个信号本身还需要保留链/对象证据才能定位具体泄漏源。

不采堆快照，避免快照改变 GC/优化时序。每轮共 12 次预热 + 30 次主测量 + 60 次后续观察。只测 JS heap `usedSize`，不把它称为整个进程 RSS。

## 证据完整性与 CI

- `.github/workflows/m7-warmup-experiment.yml` 双 checkout：一个固定应用源码，一个共享实验驱动；在目标 `scripts/` 下放置独立未跟踪驱动，不覆盖目标原脚本。记录目标 SHA、实验 SHA、驱动 SHA-256、应用 sourceFingerprint、Node/Chromium/CPU 信息。
- 明确记录该独立驱动造成的 dirty 状态；比较脚本要求只有这个文件未跟踪，并要求运行前后应用 fingerprint 不变，不冒称目标是正式 clean acceptance。
- `scripts/compare-m7-warmup.cjs` 必须读齐四组结果，验证固定 SHA、相同驱动、12/30 参数、原上限、三个连续窗口和资源计数；任何缺样或失败都不能通过。
- 普通 `compare-m6-evidence.cjs` 明确拒绝实验报告，正式预热仍为 2 次。实验 workflow 与完整游戏 CI 分开，后者未被实验结果代替。
- 通过现有默认分支已登记的 CI workflow 派发分支实验：`gh workflow run ci.yml --repo catfish-xn/cat --ref claude/friendly-darwin-pak00a -f warmup_experiment=true`。
- 本次实验的 compare 作业使用 `always()` 以保存失败样本；其比较脚本仍严格断言全部成功。这与正式 `compare-evidence` 的成功依赖无关。
- 静态检查：三份 JS 脚本通过 `node --check`，所有 workflow 通过 actionlint，`git diff --check` 通过。
- 比较器对抗验证：完整有效样本通过；持续增长、超过 1MiB、监听器增长、缺少窗口、驱动哈希不一致均按预期拒绝。

## 三轮结果

实验提交：`4e687db1df765aaaaae504586884d84aa6ecaed2`。三轮按顺序运行，使用同一源码/驱动；没有重跑覆盖失败。前两轮 success，第三轮 failure。**未达到三轮全部稳定通过的目标。**

下表增量单位均为 B。窗口 1 是规定的 30 次主测量，窗口 2/3 是同进程后续观察。

| 轮次 / CI | 目标 | 模式 | 窗口 1 | 窗口 2 | 窗口 3 | 结果 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| [1 / 37495606837](https://github.com/catfish-xn/cat/actions/runs/37495606837) | m6-main | dev | -214,352 | 787,372 | 55,120 | 通过 |
| [1 / 37495606837](https://github.com/catfish-xn/cat/actions/runs/37495606837) | m6-main | preview | -744,136 | 247,680 | 727,088 | 通过 |
| [1 / 37495606837](https://github.com/catfish-xn/cat/actions/runs/37495606837) | m7 | dev | -404,100 | 289,216 | 131,496 | 通过 |
| [1 / 37495606837](https://github.com/catfish-xn/cat/actions/runs/37495606837) | m7 | preview | -160,052 | 490,920 | -190,172 | 通过 |
| [2 / 37497322321](https://github.com/catfish-xn/cat/actions/runs/37497322321) | m6-main | dev | -521,792 | 720,352 | -456,676 | 通过 |
| [2 / 37497322321](https://github.com/catfish-xn/cat/actions/runs/37497322321) | m6-main | preview | 69,372 | 275,128 | -105,340 | 通过 |
| [2 / 37497322321](https://github.com/catfish-xn/cat/actions/runs/37497322321) | m7 | dev | 19,796 | -151,776 | 595,660 | 通过 |
| [2 / 37497322321](https://github.com/catfish-xn/cat/actions/runs/37497322321) | m7 | preview | -841,080 | 327,500 | 611,468 | 通过 |
| [3 / 37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) | m6-main | dev | -965,956 | 444,512 | 179,728 | 通过 |
| [3 / 37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) | m6-main | preview | 121,980 | 32,080 | 166,592 | **持续增长，失败** |
| [3 / 37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) | m7 | dev | -465,840 | 368,988 | -178,128 | 通过 |
| [3 / 37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) | m7 | preview | -492,852 | -80,892 | 154,736 | 通过 |

### 结论与失败处置

- 12 组主测量全部低于原 1MiB，上限未改；最大主窗口增量 **121,980B**。全部 36 个窗口也都未超 1MiB，最大单窗口增量 **787,372B**。这些数字不能掩盖持续增长检查失败。
- M7 的 dev/preview 共 6 组全部通过，未出现三个窗口连续增长。
- **M6/main preview 第 3 轮失败**：预热后 usedSize 从 11,574,956 → 11,696,936 → 11,729,016 → 11,895,608 B，连续三段正增长，90 次合计 **320,652B**。采样没有堆快照，故不能归咎于本次快照扰动。
- 按实验时的用户要求，将该样本按潜在真实泄漏处理，保留实验失败，不以“仍小于 1MiB”或其他轮次通过改写结果。后续用户已决定该 M6 已有问题不阻塞 M7 合并，转独立分支跟踪。增长趋势已观察到；不能把趋势直接写成某个应用对象泄漏已证实。
- 失败样本监听器始终 80、RAF 始终 1，主窗口各循环 application/session/observer 均为 1。所有 12 组已有资源计数都稳定，因此常见实例/监听器累积未被这些探针发现，但这不足以排除其他对象保留。
- 三轮环境均为 Node 22.23.3、Chromium 153.0.8010.12；目标应用 fingerprint 与共享驱动哈希跨轮一致。每轮有 4 个测量作业和 1 个 compare；第 3 轮 compare 也按预期失败，原始失败保持可见。
- 机器摘要见 [M7_WARMUP_CI.json](evidence/M7_WARMUP_CI.json)，包含全部前后值、增量、资源计数、环境、SHA 和原始比较报告哈希。完整证据见三个 run 的 `warmup-*` / `warmup-comparison` artifacts；失败原始包为 artifact `11428324817`。

### 独立泄漏调查

已在独立的 main 固定提交工作树中完成相同公开路线、12 次预热和 90 次观察，采集 baseline、30、60、90 次后的堆快照。该单独诊断明确启用 `heapDiagnostics=true`，不进入正式/实验比较器；没有把它作为第 4 次候选验收，或用它覆盖第 3 轮失败。

诊断环境是本地 Node **24.21.0** / Intel Xeon，CI 是 Node **22.23.3** / AMD EPYC；Chromium 均为 153.0.8010.12。加上快照对 GC/优化的扰动，这不是原失败 runner 的直接重现。三段增量为 **−844,396 / +297,112 / +585,904 B**，90 次净增 **38,620B**。

快照分析（生产构建类名通过实际构造调用及 debug lifecycle 字段映射，不按缩写猜测）：

| 对象 | baseline / 30 / 60 / 90 次 |
| --- | --- |
| MatchApplication、MatchSession、BattleHistory、SaveCoordinator、SaveRepository | 均为 1 / 1 / 1 / 1 |
| PlaybackSession、ReplayView | 均为 0 / 0 / 0 / 0 |
| HTMLCanvasElement | 3 / 3 / 3 / 3 |

基线的旧 MatchSession / BattleHistory / SaveCoordinator 对象 ID 在后续三张快照中均不存在，证明这些旧实例确实释放。普通 JS object 的总 self-size 到 90 次仅增加 244B，closure 总 self-size 不变；但不能由此推断所有对象都没有问题。

定位到的其他增长和保留链：

- V8 code 类型总 self-size 较基线 +145,644B；其中 InstructionStream 的正向变化 +490,944B，同时有其他代码类型回收。不能只加正项，也不能直接拿 snapshot self-size 去减 Runtime.usedSize。
- native 类型总 self-size +278,061B。`MediaQueryFeatureExpNode` 较基线在 30/60/90 次分别增加 **150/300/450** 个；新对象强引用路径为 `HTMLDocument → StyleEngine → media-query cache → MediaQuerySet → MediaQuery → MediaQueryFeatureExpNode`。
- `UndoStep` 较基线在 30/60/90 次分别增加 **30/60/90** 个；强引用路径为 `LocalFrame → Editor → UndoStack → UndoStep`。测试每次通过公开 seed input 执行 `fill('42')`，这是值得进一步做消融验证的输入历史来源，尚未用消融实验证明因果。
- 以上表明诊断中确有浏览器原生缓存/编辑历史持续保留，也有运行时代码变化；**尚不能证明它们解释了失败 CI 的全部 JS usedSize 增长，不能据此把原实验失败改判成纯噪声。** 未贸然修改界面、浏览器输入方式或再次调整预热次数。

节点摘要、类名映射、原始快照哈希和非 weak 保留路径见 [M7_WARMUP_HEAP_DIAGNOSTIC.json](evidence/M7_WARMUP_HEAP_DIAGNOSTIC.json)。原始快照和独立驱动保存在本次交付目录 `outputs/m7-warmup/`。

静态复核：`MatchApplication.install()` 解除旧订阅、dispose 旧 session/coordinator 并替换 history；退出回放清空 playback session/view；`SaveCoordinator` 只持有一个在途写和一个 pending capture，dispose 清空 pending；repository 的 committedHeader 只保存头部而不保留完整战斗，激活时清理不再保留的存档。暂未由这些代码定位到确定的无界保留链，继续按未定位泄漏风险处理。

## 采用状态

**不推广 12 次预热为正式门禁；不提高 1MiB，不继续增加预热次数来追求全绿。** 三轮实验已完成，M6 持续增长按 [M6-MEM-01](M6_LIFECYCLE_KNOWN_ISSUE.md) 独立调查，不阻塞 M7 合并。正式 CI 仍保持原方法。后续应定位并处理被保留对象，或用充分证据定位测量器本身的问题，再完整重复验证；不能把这三轮表述成全部通过。
