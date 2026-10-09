# H1 warn-only 独立审计说明

独立结论：通过。对下述固定提交的 H1 warn-only 变更，代码、定向验证、两份真实生命周期产物及最终 CI 结果一致；本审计范围内没有未关闭发现。

审计日期：2026-10-09。审计者：独立 Codex 审计 agent `/root/h1_independent_audit`，与实现 agent 分离。本说明由审计者撰写；审计者未修改被审代码、测试、工作流或门禁，仅实施独立读取与验证。

- 被审提交：`7667e7c01d6847e92d1a59e755ec8e3f1ae42c06`；分支 `fix/h1-heap-warn-only`；最终核对时工作区干净。
- 比较基线：`5bd7968ee31e107e12701145aa4fdac0bec7ea8d`。
- 交付：[PR #20](https://github.com/catfish-xn/cat/pull/20)。
- 最终机器证据：[CI 37900191209](https://github.com/catfish-xn/cat/actions/runs/37900191209)，`headSha` 与被审提交完全一致，状态 `completed/success`。

变更仅涉及 `scripts/m5-evidence.cjs`、`scripts/verify-m5-browser.cjs`、`scripts/compare-m6-evidence.cjs`、两份 H1 测试和 `docs/H1_WARN_ONLY.md`。完整应用 heap 超限在 producer 和 comparer 两条实际路径中均降为告警，保留原始 before/after、差值、比较值及明确的 `heapGate.policy=warn-only`、`exceeded`。dev 1,572,864 B、preview 1,048,576 B、2 次预热、30 次循环和 GC/采样协议未改变。功能、监听器/RAF、应用实例、身份与缺失/损坏证据检查，独立模块预算和原生对象保留门禁继续阻断；运行源码、B6/B7/U3 和 CI 工作流均未改动。

首次审查发现的 P2 已关闭：原始 `usedSize` 曾可通过减法隐式转换，将 null、数字字符串或负数变为看似合法差值。最终共享策略逐项要求 before/after 读数为非负安全整数，再计算差值；producer 和 comparer 均使用该策略。审计者独立执行完整 comparer 源码与原样 producer 生命周期函数的内存注入验证，确认非法读数被拒绝，合法超限保留原值并继续告警；伪造或缺失告警、差值不符、监听器/RAF 回归及 SHA/源码身份不符仍拒绝。该验证使用替代 I/O，不冒充真实浏览器测量。

审计者独立运行 `npm test -- tests/h1-heap-warning.test.js tests/h1-heap-comparison.test.js`，12+11=23 项全部通过，并核对最终提交与受测内容一致。最终 CI 日志亦记录这两文件 23 项通过；完整测试为 101 个文件、1,262 项全部通过，构建及其 typecheck 步骤成功。

最终 CI 的 12 个常规验收作业全部成功：test-and-build、六条 dev/preview × cannon/sniper/mage 路线、两条 input 路线、m6-retention、m7-presentation、compare-evidence。`warmup-experiment` 与 `heap-diagnostics` 按普通运行条件跳过，未计为通过。比较作业于 `2026-10-09T08:11:42Z` 完成；原始日志记录 `compare-m5-evidence.cjs --final` 的三路线均为该 SHA 的 `final-clean-commit/passed:true`，`compare-m6-evidence.cjs` 记录同 SHA、`manifests:9`、`passed:true`。

两份真实炮手路线产物由审计者独立核对：ZIP 摘要、字节数、run/SHA 与 GitHub API artifact 清单一致；每份 234 个成员的 CRC 全部通过；解压后的 manifest/lifecycle 与 ZIP 内原文逐字相同。进一步重算源码指纹和 driver hash，核对 manifest/lifecycle 一致、2 次预热、30 个顺序周期、每周期实例 1/1/1 及资源计数稳定。

| 模式 | before usedSize B | after usedSize B | 差值 B | 原比较值 B | exceeded | listeners / RAF |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| preview | 14,683,040 | 14,877,932 | 194,892 | 1,048,576 | false | 84 / 1，全程稳定 |
| dev | 17,420,288 | 18,735,380 | 1,315,092 | 1,572,864 | false | 85 / 1，全程稳定 |

两份 manifest 均为 clean、`passed:true`、`errors:[]`，Node `v22.23.3`、Chromium `153.0.8010.12`。重算得到的共同源码指纹为 `569228e555692174f013be544796352fa6fdc8eafbd70fb75e785a36656d6cd8`；driver hash 为 `65aeef9c2578a4f7274dd2880ca698d1153409952ce10e5d727c12975a3f99b5`，均与 manifest 一致。

| 归档 | Artifact ID | ZIP SHA256 |
| --- | ---: | --- |
| preview-cannon | 11603200520 | `5fa7c780d66390c2692a76c1b4caf9ca0f8580d6d1ec904501c04c2a29d3ec5d` |
| dev-cannon | 11602882705 | `24ee6adfd960892b8e7387c13b8737556a57dc99a682dafe9ac509ba7bec4352` |

供后续原样归档核对：最终 CI 状态 JSON 的 SHA256 为 `1964111526e5ec84246c852d552cfe54bb789e73e2caa07b00107a3b4acc30fd`；下载的完整 CI 日志为 1,038,446 字节，SHA256 为 `4afad796f7aad0070ba4f7c36c8ff01a21162b7b9d809cc7f0b3719d968cb49f`。

覆盖边界：上述两个真实 CI 样本都未超过原比较值，因此只能证明真实未超限路径及证据记录正确；真实超限分支没有被这两个样本触发，其行为依据来自定向测试与独立注入验证。审计通过表示获授权的 warn-only 政策得到一致、可核验的实现，不表示 H1 根因已解决，也不证明没有慢泄漏。独立的 30→90→300 缩放实验及后续门禁校准不属于本说明的最终验收范围。
