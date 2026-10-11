# H1 补测命令（诊断，不是新门禁）

固定被测源码：`97f38a0e787a4edcb35df4a59823bb1d106def67`。当前两次正常样本仅能说明观测差异，不能估计误报率。Chromium 141 与 CI 153 的数据分层，不混合统计。

## 代跑准备

在已有干净的 97f38a0 工作树中使用 lockfile 安装的依赖。输出放在仓库外；包装脚本从诊断分支提取到临时目录，不加入被测工作树。不要更改原浏览器脚本、阈值、CI、GC、原正常组预热或负载。

```bash
# 在可访问远端的仓库中；只 fetch，不合并。
git fetch origin diag/h1-heap-gate
git show origin/diag/h1-heap-gate:scripts/diagnostics/h1-repeat.sh > /tmp/h1-repeat.sh
# 替换 /absolute/path/to/clean-97f38a0；输出目录必须尚不存在。
bash /tmp/h1-repeat.sh /absolute/path/to/clean-97f38a0 /tmp/h1-normal-more /opt/pw-browsers/chromium normal 8
```

补 8 次后和原来 2 次组成同环境、同浏览器版本的初步 10 样本批次；如果容器、版本或资源配置改变，应另列一组。它仍不足以宣称低误报率或排除泄漏：即便 10 次均未超限，独立同分布假设下超限概率的单侧 95% 上界仍约 25.9%，且“超限”只有排除真实增长后才能叫误报。后续样本量由初步分布决定，不为追求通过而丢弃失败样本。

## 连续窗口辅助对照

```bash
bash /tmp/h1-repeat.sh /absolute/path/to/clean-97f38a0 /tmp/h1-trend /opt/pw-browsers/chromium trend 3
```

此组使用原脚本已有的 `M6_WARMUP_EXPERIMENT=1`，将预热从 2 改为 12，连续测 3 个各 30 次的 post-GC 窗口；不采快照。它是独立诊断对照，**不是现行 2 次预热门禁的同参数重复，不替代正常组，不批准采用新方法**。该历史实验自身有断言，失败日志与已写出的窗口数据照样保存。全部窗口为正不自动等于应用泄漏，仍需引用链和更长走势核对。

包装脚本只提供顺序运行、环境记录、原命令调用、超时和退出码保留。未改变 `scripts/verify-m5-browser.cjs` 或工作流。本机只完成 `bash -n` 语法检查；浏览器实跑需由代跑环境执行。每个原正常运行先前约 14 分钟，额外 8 次约 2 小时；趋势组时间更长，建议单独顺序执行，不与其他负载并行。

## 回传证据

保留所有运行，包括超限/超时/错误，不自动重跑替换：

- `environment.txt`、`build.log`、`runs.tsv` 和每次完整 `*.log`。
- 每次的 `manifest.json`、`m6-lifecycle.json`、若生成则 `m6-heap-trend.json` 和进度 JSON。
- 若失败发生在上述文件生成前，完整日志仍需保存。
- 原始全量目录保留，仓库至少提交以上证据；沿用独立代跑分支，不合并。

本轮尚未覆盖 dev 模式、CI Chromium 153、现行 2 次预热的连续窗口、B4 装备大量触发负载。当前 `heap_diagnostics` 指向历史 M6/M7 固定 SHA，不能当作本次 97f38a0 证据；本任务未获修改该工作流授权。
