# Input-dev M6 performance：最小观测性取证 WIP

CI200 c854 的真实浏览器关闭仍未定根因。原失败和范围区分见 ../ci200-first-failure/；只读诊断全文及有限CI170对照封存在 diagnosis.md.gz、comparison.json.gz。

本批独立修改 scripts/verify-m6-performance.cjs：加入 page crash / browser disconnected / 明确 processKind=node 的退出事件及原计时回调外流程标记。manifest.diagnostics 与 diagnostics.jsonl 留证；cleanupStarted 区分正常finally清理引起的断连。chromium.launch 返回 Browser 的公开API不暴露Chrome进程exitCode/signal，未伪造该字段、未换启动器、未用私有API。

保留原负载、样本、12个measure/measured调用与回调文本、gates、skip、原catch及计时边界；没有RSS定时采样、生产或CI配置改动。node --check、git diff --check及13组静态结构比较通过；这些静态检查使用Node24.19.0，不能冒称Node22或Chromium执行。未本机运行浏览器，新的正常CI还没有结果；如观测产生计时扰动，该结果必须标作诊断，不能代替原验收。

原始脚本、diff、结构对照脚本/结果、字段及行号说明都在observability/，gzip保留原字节。本提交不是关闭原因修复，不是②完成或签收。
