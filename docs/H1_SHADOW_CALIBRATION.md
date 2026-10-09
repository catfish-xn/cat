# H1 影子校准运行记录

状态：已启动，2026-10-09T09:14:31Z 起生效。用户批准的 PR #20 已合并至 `feat/m8-b0-baseline`，合并提交 `f90e438933f341938c238980e1249d8904468c53`；合并树与独立审计及完整 CI 通过的 `7667e7c01d6847e92d1a59e755ec8e3f1ae42c06` 逐文件相同。没有合入临时诊断工作流。

本分支 `codex/h1-shadow-calibration` 是持续观察台账，不是新的应用实现或门禁分支。采集复用已经合并的 producer 及现有 CI artifact 上传；台账在后续验收审阅时离线更新。没有增加浏览器循环、CI job、定时轮询或自动长窗调度，也不要求合并这个台账分支才能采集原始数据。

## 已采用的政策

- 常规完整应用仍为 2 次预热、30 次循环，preview 比较值 1,048,576 B、dev 1,572,864 B。只把总堆超限作为告警，保留 before/after、差值和 `heapGate`；数值不提高。
- 身份或证据损坏、功能错误、监听器/RAF/实例回归、独立模块堆和耗时预算继续由原检查阻断。影子统计不能覆盖其失败。
- 不部署固定三进程×六窗口。本轮不改业务代码，不追加长窗；后续同口径告警频繁时再开按需长窗。
- 三态仅为诊断语义：**观察范围内无明显趋势 / 增长候选 / 证据不足**。单次 30 循环只有一个差值，无论是否超限，趋势状态均为“证据不足”；`warning=true/false` 单独记录，不伪造平台结论。

## 采集与纳入

每次正常 CI 已自动上传 dev/preview 的炮手路线 manifest、m6-lifecycle 和失败证据；只有 `--m6-journey` 的 cannon 是 H1 完整应用样本。mage/sniper、输入路线、模块压力、快照及长窗诊断不得当成同参数重复样本。

后续验收更新台账时，读取 `m5-browser-{mode}-cannon-sample{sample}-{sha}` artifact 内对应 manifest 和 lifecycle，并同时保留 GitHub run/attempt/job/artifact 身份及归档摘要。原始读数与 `heapGate` 必须一致，来源干净、协议匹配。失败/超时/缺失/不匹配样本仍留记录及原因，进入“证据不足”，不能删去或算作成功。

统计按 **精确 sourceSha × Chromium × Node × mode × CPU** 分层，另保留 sourceFingerprint 作为完整性字段及 job/run 身份。不同 SHA 即分层，即使指纹或源码树相同也不拼池；既有指纹不覆盖 public/assets、测量脚本及工作流，不能代替精确版本。相同 SHA 若指纹不一致则证据无效。同一个 run 的 profile 多样本、重跑 attempt 和共享 runner 要标明相关性。频繁告警计数的权威取样现在固定为每模式每个独立 run 的 **attempt=1、sample=1、cannon**，无论是否 profile。sample1 缺失、失败或不合格均保留相应状态，不用 sample2/3 或重跑补位；其他实际样本和重跑单列保留，但不进入该计数。每模式每个 run 至多计一次，不能按结果择优。

“频繁”的运维复核触发线现在固定为：**同匹配分层最近最多 5 个独立正常 CI 首次运行中，至少 2 次完整应用堆超限**。不足两个首次运行不能触发。该规则只提出长窗排查，不是显著性检验、泄漏证明、新内存阈值或合并阻断，也不会自动启动 CI。样本层不匹配时分别保留，不能为凑计数混池。

不同 SHA 的反复告警仍逐项作运维审阅，不能拼成同层 2/5 比例，也不能因不满足同层计数就宣称稳定；需要排查时在最新接受版本上开长窗。常规每 SHA 可能只有一次运行，因此同层计数可以长期不足；不为凑相同 SHA 的次数重跑 CI。

真正启动长窗时使用届时接受的集成源码及匹配浏览器，重新核对诊断驱动，沿用一进程/异常模式的 30→90→300、原 GC 协议及最多一次确认规则。`C=H300−H90`，候选端点扰动假设 E=1,572,864 B；C>E 是增长候选，缺失/功能资源失败或扰动假设不适用为证据不足，未见明显趋势只能附有限范围和条件上界。具体采集前固定方案，不直接复用只支持旧源码 hash 的派生器，更不把 16 KiB/次检测目标当可接受泄漏预算。

## 启动批次

[台账](evidence/h1-shadow-calibration/ledger.json)已建立；两份完整参考 manifest/lifecycle 同目录原样保存。它们来自已审 CI [37900191209](https://github.com/catfish-xn/cat/actions/runs/37900191209)，用于验证采集口径，**均早于本次生效，不是前瞻保留样本**。不把历史数据改名成新测量，也不重跑已成功 CI 凑样本。

| 模式 | 参考差值 B | 比较值 B | 告警 | 趋势诊断 |
| --- | ---: | ---: | --- | --- |
| preview | 194,892 | 1,048,576 | 否 | 证据不足：仅一个 30 次窗口 |
| dev | 1,315,092 | 1,572,864 | 否 | 证据不足：仅一个 30 次窗口 |

当前前瞻样本为 0，长窗触发为否。前瞻资格要求独立 run 的 created_at 不早于上述合并时间，且被测提交包含已批准的 warn-only 提交 `7667e7c`；不能只按 artifact 上传或重跑完成时间纳入。参考样本不进入前瞻频率分母或触发计数。现有工作流在 main push、PR 或人工 dispatch 时运行；向本次集成分支合并不会额外触发一次正常 CI。因此下一批来自后续正常验收，不为启动台账新增测量。

阈值校准阶段保持候选值冻结，积累匹配版本的后续样本，不以观察到的最大值临时上调比较值。尚无新尾部分布、误报率或检出率结论；若今后要恢复自动阻断，需要独立正控、保留样本和审计，另行提出具体变更。

## 归档与可追溯性

长度缩放提交 `61f0bde7c8cd39fd4d0410ed3a145c27631d3b9b` 已由永久标签 `archive/h1-length-scaling-2026-10-09` 保留，包含报告、分析器、小型原始输入和两份独立审计。远程标签解引用已核验精确指向该提交；原 `diag/h1-length-scaling` 的远端及本地分支名已删除，本地工作树以 detached HEAD 保留同一归档提交。只归档，没有合入目标分支。

- [结果报告](https://github.com/catfish-xn/cat/blob/61f0bde7c8cd39fd4d0410ed3a145c27631d3b9b/docs/H1_LENGTH_SCALING_RESULTS.md)
- [缩放独立审计](https://github.com/catfish-xn/cat/blob/61f0bde7c8cd39fd4d0410ed3a145c27631d3b9b/docs/evidence/h1-length-scaling-37900065144/independent-audit.md)
- [warn-only 独立审计](https://github.com/catfish-xn/cat/blob/61f0bde7c8cd39fd4d0410ed3a145c27631d3b9b/docs/evidence/h1-warn-only-ci-37900191209/independent-audit.md)

两份本轮完整 300 次 ZIP 另存于工作区 `artifacts/h1-archive-2026-10-09/`，合计 128,558,712 B，摘要见同目录 `archive-manifest.json`；与 GitHub artifact digest 一致。这是本地完整产物备份，不冒称远端永久二进制存储，也不包含旧 PR #15 的全部历史堆快照。生成物不提交。
