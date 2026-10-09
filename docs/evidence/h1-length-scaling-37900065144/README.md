# H1 30→90→300 原始证据

[运行 37900065144](https://github.com/catfish-xn/cat/actions/runs/37900065144)，诊断定义 `f485ff7496116d101d3d5543db257776d558fd75`，被测源码 `97f38a0e787a4edcb35df4a59823bb1d106def67`。Node 22.23.3 / Chromium 153.0.8010.12，2 次预热、无快照、10×30 次连续同页面生命周期循环。完整方法和预先定义的追加规则见[预登记](../../H1_LENGTH_SCALING_PLAN.md)，解释见[结果报告](../../H1_LENGTH_SCALING_RESULTS.md)。

preview/dev 各一个首次进程；原退出码均为 0，十窗完整。没有追加测量，没有择优替换。preview 归档下载遇到一次网络 EOF 后重新下载同一个 artifact，这不是重新运行实验。两个 job 的最终身份和步骤状态在 `ci-status.json`。

| 模式 | CPU | Artifact | 原 ZIP 字节数 | ZIP SHA256 |
| --- | --- | --- | ---: | --- |
| preview | AMD EPYC 7763 | [11603454240](https://github.com/catfish-xn/cat/actions/runs/37900065144/artifacts/11603454240) | 64,240,439 | `e0d59056a0c6cf304d4c7eb147abd550526b816198ee759c672dfa94620a5b3f` |
| dev | AMD EPYC 9V74 | [11603302473](https://github.com/catfish-xn/cat/actions/runs/37900065144/artifacts/11603302473) | 64,318,273 | `53339fe2c007b439f832ef03d104bd965087ca80fcb994c86fd9df14dc7449aa` |

两个 ZIP 均与 GitHub API 摘要及大小一致，各 245 成员 CRC 全部通过。大 ZIP、trace、截图及安装日志保留在 GitHub artifact（保存 30 天），未入库；本目录保留离线分析器实际读取的全部 10 项原始输入，包括完整 manifest、lifecycle、十窗 trend、派生驱动及 derivation、环境/request、TSV、源状态和原始运行日志。原始文件未经改写，逐文件摘要在各模式 `provenance.json` 与 `analysis.json.inputs` 中。

复现无需浏览器或 npm，仅需 Python 3、Node 和含上述固定提交的 Git 仓库；在诊断分支仓库根执行：

```bash
python3 scripts/diagnostics/analyze-h1-length-scaling.py --batch docs/evidence/h1-length-scaling-37900065144/preview --mode preview --run-id 37900065144 --output /tmp/h1-preview-reproduced.json
python3 scripts/diagnostics/analyze-h1-length-scaling.py --batch docs/evidence/h1-length-scaling-37900065144/dev --mode dev --run-id 37900065144 --output /tmp/h1-dev-reproduced.json
cmp /tmp/h1-preview-reproduced.json docs/evidence/h1-length-scaling-37900065144/preview/analysis.json
cmp /tmp/h1-dev-reproduced.json docs/evidence/h1-length-scaling-37900065144/dev/analysis.json
```

分析器从固定 Git 提交重建整个派生驱动，核对它与实际归档逐字一致；原 30 行断言及上限保留。它重算边界差值、资源计数、persistentGrowth 和原始首个失败，拒绝损坏/伪造/不完整证据，不输出自动“泄漏/无泄漏”判决。E=1.5 MiB 为预先选择的端点扰动假设，不能解释成已验证置信界或新正式门禁。
