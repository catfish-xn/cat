# H1 补测（按 `docs/H1_FOLLOWUP_RUNS.md` @306f876 代跑）

Claude 代跑，只运行和收集数据；未改源码、浏览器脚本、阈值、GC、预热（正常组）、CI。包装脚本原样取自 `origin/diag/h1-heap-gate:scripts/diagnostics/h1-repeat.sh`（306f876），未修改。

## 运行身份

| 项 | 值 |
| --- | --- |
| 源码 | `97f38a0e787a4edcb35df4a59823bb1d106def67`，干净工作树（包装脚本已校验 HEAD 与 `git status --porcelain` 为空） |
| 命令 | `bash h1-repeat.sh <clean-97f38a0> <新输出目录> /opt/pw-browsers/chromium normal 8`，随后 `... trend 3`，两组顺序执行，无并行负载 |
| 浏览器 | Chromium 141.0.7390.37（与首轮代跑同一容器、同一版本）；**不是 CI 的 153，不可混算** |
| 环境 | Linux 6.18 x86_64，Node v22.22.0，Xeon 2.10GHz ×4（见各组 `environment.txt`） |
| 时间 | 正常组 2026-10-08 15:02:52–16:29:10Z；趋势组 16:29:23–17:12:00Z。11 次均正常结束，无超时；失败均为脚本自身断言 |

## 正常组（原参数：预热 2、30 次循环、preview 上限 1,048,576 B）

| 运行 | 退出码 | heapDelta (B) | 结果 |
| --- | :-: | ---: | --- |
| normal-01 | 1 | 1,175,900 | 超限 +127,324 |
| normal-02 | 1 | 1,655,408 | 超限 +606,832 |
| normal-03 | 0 | 601,396 | 通过 |
| normal-04 | 0 | 651,384 | 通过 |
| normal-05 | 1 | 1,335,372 | 超限 +286,796 |
| normal-06 | 0 | 603,184 | 通过 |
| normal-07 | 0 | 798,940 | 通过 |
| normal-08 | 0 | 763,160 | 通过 |

三次失败的断言均为 `full application post-GC heap growth <=1048576 bytes (preview)`；失败运行约 5 分钟即停止（断言后不再走完后续路线），通过运行约 14 分钟。所有运行监听器 82→82、pendingRaf 1→1。

**与首轮 2 次合并的同环境 10 样本批次**（首轮由 Claude 的 `run.sh` 顺序执行、同命令同浏览器同容器，见上级 `README.md`）：808,360、1,028,836、1,175,900、1,655,408、601,396、651,384、1,335,372、603,184、798,940、763,160。超限 **3/10**；中位数 803,650；最小 601,396，最大 1,655,408。样本少，仅供描述，不作误报率估计。

## 趋势组（`M6_WARMUP_EXPERIMENT=1`：预热 12，连续 3 个 30 次 post-GC 窗口；独立诊断对照，非门禁同参数重复）

| 运行 | 退出码 | 窗口1 | 窗口2 | 窗口3 | persistentGrowth | 失败断言 |
| --- | :-: | ---: | ---: | ---: | :-: | --- |
| trend-01 | 0 | −375,308 | +577,176 | +59,800 | false | — |
| trend-02 | 1 | +205,060 | +581,544 | +1,170,464 | true | `each follow-up 30-cycle window retains the historical 1MiB ceiling` |
| trend-03 | 1 | +315,004 | +603,372 | +75,812 | true | `persistent post-warmup growth: investigate as a potential real leak, do not accept the method` |

窗口 usedSize（before→after）：trend-01 15,125,052→14,749,744→15,326,920→15,386,720；trend-02 14,258,868→14,463,928→15,045,472→16,215,936；trend-03 14,244,348→14,559,352→15,162,724→15,238,536。

只陈述观测：3 次中 2 次三个窗口均为正增长，但增量大小不单调（trend-03 窗口3仅 +75,812）；trend-01 窗口1为负。是否为应用保留、JIT/浏览器内部缓存或测量噪声，需结合引用链判断（由 Codex 负责）。

## 文件

- `h1-normal-more/`、`h1-trend/`：`environment.txt`、`build.log`、`runs.tsv`、每次完整 `*.log`。
- 每次运行子目录：`manifest.json`、`m6-lifecycle.json`、进度 JSON；趋势组另有 `m6-heap-trend.json`、`m6-trend-progress.json`；失败运行另有 `failure-state.json`、`failure.png`。
- 未入库：每回合 JSON/截图、`trace.zip`（失败运行 8–18 MB）、导出文件等，原始全量目录（约 700 MB）保留在代跑容器临时目录，容器回收后不保证存在；如需某个文件请尽快指明。
