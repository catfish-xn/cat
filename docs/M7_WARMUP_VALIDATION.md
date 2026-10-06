# M6 / M7 预热对照实验

## 授权与固定条件

用户于 2026-10-07 批准：12 次预热、30 次测量、1MiB 上限；在 M6 main 和 M7 上连续运行至少 3 次 CI，保留全部结果。如预热后仍持续增长，按真实泄漏方向处理。

- M6：main 在开工时的 HEAD `a8be9fc151b9ebb895eb4097828bb74c590e2559`。此提交已合并 M6；对照签收 `631c131`，`src/`、package/lock 和原测量脚本无差异，不能继续把 main 描述成 M5。
- M7：本次实验前的分支 HEAD `67527610063802d995c4f95044d82c7ad4afe9dc`。
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

待实际运行后逐项记录。无论成功或失败，均保留 run ID、目标、模式、三个窗口的原始前后值、增量和作业状态，不只记录“绿”。

## 采用状态

本提交只实现获批对照实验。正式方法是否改为 12 次预热，应基于三轮全部证据作出结论；不能在实验尚未证明稳定时宣称问题已解决。
