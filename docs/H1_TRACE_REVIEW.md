# H1 trend-02 / trend-03 离线 trace 诊断（非签收审计）

## 结论
两份 trace 能复核动作轨迹与保存完整性，不能定位具体泄漏对象、所有权链或根因。未出现额外页面创建/反复 reload 的可见异常；重复操作与 12 次预热 + 3×30 次窗口相符。没有证据可把 GPU 警告、Phaser、回放或导入中的某一环节归为泄漏根因。

## 输入与复现
- 证据固定提交：a062cececca3424d1c2b414f7b1a2a016a77f1a0；被测提交：97f38a0e787a4edcb35df4a59823bb1d106def67；manifest Chromium 141.0.7390.37。
- 执行：python3 scripts/diagnostics/review-h1-traces.py --repo . --output /tmp/h1-trace-review
- 参数化仓库/输出，输出必须位于仓库外；固定 SHA，不 fetch、不改仓库、不启动浏览器、不打开页面，不执行任何 trace 内的 JavaScript。仅 git show 导出、ZIP 流式读取、JSON 解析；任何检查失败退出非零。
- trace-evidence.json 保存每个成员字节数、压缩大小、CRC32 验证、SHA256、计数及原始 JSONL 行号。SHA256 是固定 Git 字节的复现锚点，CRC 仅检测内容完整性，均不证明实验正确或来源可信。

## 保留的证据
- trend-02：18,488,772 B，SHA256 0b1bfd7b3bb57f795aaf54e744c2203e91f785d40a0377a5769d011ec439dcbd。
- trend-03：18,488,275 B，SHA256 0c2bd6435e4f598d9b0b5ed22b71ec2cd10216134758df733341db80b09379a4。
- 每份均仅有 trace.trace、trace.network、trace.stacks 三个成员，CRC 全过；network 为 0 B；无 heapsnapshot、DOM snapshot、截图或资源成员。存在 screenshot API 动作，但图片不在本 ZIP 内。
- 每份 4279 个 before/after 一一配对；两份按顺序的 class/method/selector/expression 完全一致，此比较不含时间、其他参数或返回结果。
- 每份可见 1 次 newPage、1 次 goto、1 次 reload、1 次 newCDPSession；仅 1 个控制台 pageId。未记录 close 不等于实际未关闭，关闭可能在 trace 保存后。
- 每份 102 次 mobile:new-match、103 次 fixed-start（含初始准备）、104 次 import/选择已完成战斗、206 次 dialog accept；不能把实验设计的重复动作直接视为异常重复。
- 每份可见 4 次输入缓冲 drain，返回事件数依次为 358、720、720、720，说明 trace 中确有清空操作；仍不能由此证明旧数组无其他引用。
- 每份 34 个资源读取返回均为 listeners=82、pendingRaf=1。只覆盖采样时刻与脚本所追踪的目标；不能推出所有 DOM 节点、所有监听器、定时器、Phaser 资源或对象均无残留。
- 每份控制台 2 条 Phaser 启动日志、4 条 ReadPixels GPU stall warning。警告出现在初始启动期，最后一条说明将停止重复输出，不能推定后续不再发生；没有根因证据。
- 可见的 console error 与 after.error 均为零。这不代表测试通过：Node 主机端断言不会必然出现在浏览器 trace 的 after.error，原运行日志/manifest 明确记录失败。

## 缺失与限制
- newCDPSession 可见，但未保留 CDPSession.send、HeapProfiler.collectGarbage、Runtime.getHeapUsage 或其响应；无法用 trace 独立核对“预热后 + 三个30次窗口后”的四组堆边界。数值只能引用单独 m6-heap-trend.json，不能宣称已从 trace 复算。
- 空 trace.network 仅表示未保留网络条目，不证明没有请求，也不证明网络全部成功。
- 无堆对象图、分配栈、retainer path 或 retained size，不能证明某个模块、闭包、DOM、Phaser 对象泄漏。
- trace 保留大量 evaluate/read 的序列化应用状态。这是诊断工具的可见行为与潜在测量扰动背景，不能仅据其大小或与堆增长同时出现推因。
- 尾部为最后状态/资源/输入读取与失败诊断截图动作；API调用均配对完成，未见中途悬空调用。其后 Node 断言及完整 shutdown 不属于本 trace 可见范围。

## 对现有失败的关系与下一步
trend-02 第三窗 +1,170,464 B 超过 1 MiB；trend-03 三窗为正增长。该 trace 诊断不改变已有失败或签收边界。若需定位，应另行获准对同版本同工作负载保留 GC 后堆快照或分配/retainer 证据，并区分应用、调试注入与追踪开销；本任务没有运行该实验。

## 补入日志核验

`verify-h1-logs.py` 对14份运行日志末尾JSON、失败首行、原manifest字节不变及3份构建日志完成记录等进行46项检查，全部通过。重跑输出逐字节一致，机器记录见 `docs/evidence/h1-trace-review/log-validation.json`。复现：

```bash
python scripts/diagnostics/verify-h1-logs.py . /tmp/h1-log-validation.json
```

本轮修复的是证据缺失，不是运行代码；未新增浏览器测量，不改变此前超限和趋势结论。2026-10-08 22:48 UTC用户已批准新增仅workflow_dispatch的独立CI153诊断工作流；实施中，尚未运行。新文件的默认分支注册/合并仍按单独审批执行。
