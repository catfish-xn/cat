# M6-MEM-01 独立调查

2026-10-07；分支 `codex/m6-lifecycle-retention`，从 main `a8be9fc151b9ebb895eb4097828bb74c590e2559` 建立。只加入独立诊断脚本与记录，不改应用、UI、交互、现有测试或冻结预算。

## 状态与依据

用户已决定：M6 基线也有的增长作为已知问题独立跟踪，**不以它阻塞 M7 合并**。不把该决定解释为问题已修复、实验全部通过，或豁免其他 CI 失败。M7 没有在本次任务中合并。

失败实验为 [37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) 的 `warmup-m6-main-preview`，应用是上述 main SHA。同轮 M7 dev/preview 均通过。预热 12 次，三个连续 30 次窗口 +121,980 / +32,080 / +166,592 B，总计 320,652 B。各窗口均未超过 1MiB，失败的是额外的连续三段正增长检查。正式 CI 仍保持原 2 次预热、30 次测量和 1MiB。

完整记录位于 M7 分支 [M7_WARMUP_VALIDATION](https://github.com/catfish-xn/cat/blob/77600c82bb709837ca1142abc16238765074f116/docs/M7_WARMUP_VALIDATION.md)。先前全生命周期快照看到 UndoStep 每循环 +1、MediaQueryFeatureExpNode 每循环 +5；旧 MatchSession / BattleHistory / SaveCoordinator 实例被回收。强引用路径分别经 Editor/UndoStack 和 HTMLDocument/StyleEngine 的媒体查询缓存。

## 本次分操作实验

本地 Node 24.21.0、Chromium 153.0.8010.12，使用 main 的生产构建。与 CI 的 Node 22 / AMD runner 不同；每组独立 context，先 12 次预热，再三段各 30 次，并取堆快照。所有记录均 `diagnosticOnly=true`，不进入验收比较器。快照会扰动 GC，只用于确认对象保留与触发动作，不用它解释原 CI 的全部 `usedSize`。

### 输入与查询对照

| 操作 | UndoStep：0 / 30 / 60 / 90 次 | MediaQueryFeatureExpNode |
| --- | --- | --- |
| 每次 `seed.fill('42')`，没有对局生命周期切换 | 13 / 43 / 73 / 103 | 始终 4 |
| 只填一次，以后只读 inputValue | 1 / 1 / 1 / 1 | 始终 4 |
| 只填一次，反复查询回放按钮 | 1 / 1 / 1 / 1 | 始终 4 |

因此反复填写相同种子本身就足以产生撤销记录增长，与旧 session 被保留无关。正式驱动每循环确实会做这次输入；没有为去掉这一现象而修改正式输入测试或清空用户撤销历史。

初次工具探索的计数器未兼容 `blink::` 名称前缀，造成这些 native 类型被错误记为 0。修正后重新运行了全部三组；这里只引用重新采集、正确解析的 `m6-input-retention-verified`，没有用错误的 0 作为证据。原始快照保留，修正也与直接枚举节点名称相互核对。

### 导入与回放对照

同一 M6 公开导出的三战后存档，以真实文件输入加载；每次动作后等待公开 debug 状态确认完成。保持 seed 输入只填一次。

- **仅导入**：媒体查询节点 30 / 90 / 150 / 210，即每次 +2；UndoStep 始终 1。
- **仅进出回放**：媒体查询节点同样 30 / 90 / 150 / 210，即每次 +2；UndoStep 始终 1。
- **仅点击固定种子新局并完成初始选择**：媒体查询节点始终 7，UndoStep 始终 1；此组不包含原组合循环中先点击 `mobile:new-match` 返回开始面板的动作。
- 三组输入探针没有媒体查询节点增长，因此它与 seed.fill 的撤销历史是不同来源。
- 初步最小化：完全不加载游戏的页面，只切换 select/file 的 disabled 或 range 的 hidden，各观察 90 次，媒体查询节点始终 0。仅凭“操作过原生控件”不足以解释应用中的增长。
- `matchMedia` 调用追踪：页面初始化、5 次导入、5 次回放均未观察到页面主世界的调用。故目前没有证据归因于应用直接调用 matchMedia；此探针不覆盖隔离执行环境或浏览器内部调用。

这些结果定位了可重现的触发动作和强引用路径，但尚未确定浏览器缓存何时淘汰，也没有证明这两类 native 对象解释全部正式 JS heap 增量。不能把 MediaQueryFeatureExpNode 的 self-size 从 Runtime.usedSize 中相减。后续需继续缩小导入/回放的样式更新与 DOM 更新路径，确认缓存是否有界；不先修改 UI 来让计数变绿。

## 复现

在此调查分支执行：

```sh
npm ci
npm run build
npx playwright install chromium
npm run preview -- --host 127.0.0.1 --port 4193 --strictPort
```

另一个终端运行：

```sh
node scripts/diagnose-m6-input-retention.cjs
# fixture 使用公开导出的 M6 三战后存档；也可从历史 warmup-m6-main-preview artifact 取 lifecycle-export.json。
M6_DIAGNOSTIC_LIFECYCLE_FIXTURE=/path/to/lifecycle-export.json \
M6_DIAGNOSTIC_OUTPUT=artifacts/m6-isolated-actions \
node scripts/diagnose-m6-input-retention.cjs
node scripts/diagnose-m6-native-controls.cjs
M6_DIAGNOSTIC_LIFECYCLE_FIXTURE=/path/to/lifecycle-export.json node scripts/trace-m6-media-queries.cjs
```

摘要见 `docs/evidence/M6_RETENTION_PROBES.json`，包括采样值、快照哈希、构建哈希及环境。完整快照位于本地 `artifacts/m6-input-retention-verified/`、`artifacts/m6-isolated-actions/` 与 `artifacts/m6-native-controls/`，不提交大文件。探针中迭代数指单个操作，不等于正式新局/导入/回放组合循环；输入版与扩展版的驱动哈希不同，分别记录，不能伪称同一驱动的正式重复验收。

## 玩家影响与后续

失败 M6 样本平均每组合循环 +3.48 KiB；仅作线性量级估算，100 次约 0.34 MiB、1,000 次约 3.40 MiB。循环不是完整一局，其他样本也出现回落；未观测帧率与输入延迟退化，无法推算玩多少局必然卡顿，也不能把这个速率当增长上限。

下一步是更长的真实操作会话与浏览器缓存淘汰验证，同时记录帧时间/长任务；确认是否有真实用户可感知影响。维持 1MiB，不自行采用新的正式预热方法。新增脚本通过 Node 语法检查；其完成只表示诊断执行完毕，不表示内存门禁修复。
