# H1 warn-only 独立交付证据

[PR #20](https://github.com/catfish-xn/cat/pull/20)，被测提交 `7667e7c01d6847e92d1a59e755ec8e3f1ae42c06`，[完整 CI 37900191209](https://github.com/catfish-xn/cat/actions/runs/37900191209) 成功。此处是 warn-only 政策验证，**不是旧源码 97f38a0 的长度缩放样本**，不合并统计。

- `ci-status.json`：最终 head SHA、每个 job/step 和状态；12 个常规 job 成功，2 个诊断 job 按条件跳过。
- `provenance.json`：两个所选完整 ZIP 的 API 身份、大小、摘要、CRC 检查及入库文件摘要。较大 ZIP 保留在链接的 GitHub artifact，未提交仓库。
- `preview/`、`dev/`：各 cannon 路线的原始 manifest 与 lifecycle，未经改写。两者均未超限，不能算真实告警分支覆盖。
- [独立审计说明](independent-audit.md)：审计者原样交付，SHA256 `d217bd3ae5ebf3a431eb6ab84b90966eb3a57dfe7c71184c343427b939d456cc`；包含代码、23 项定向验证、原始证据、最终 1,262 项测试及比较器的审计范围与限制。

完整 CI 日志可从上述运行下载；其归档摘要记于独立审计说明。原始 ZIP 和 CI 日志不承诺永久可下载，入库的小型证据及摘要用于保留可核对结果。
