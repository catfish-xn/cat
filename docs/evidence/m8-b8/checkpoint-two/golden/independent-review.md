# Exact candidate technical review

本记录是本次迁移的独立只读技术复核，不是外部审计或 B8 全面签收。

最终审阅对象：

- updater SHA256：`ca53ebd5f6c9f0f23478aca8db5ecd6659fbfe6b7a8239bd9e4a7ff8b371dcc9`
- audit SHA256：`f574c9ed982abd75668134921431efbe77c4d63c46bb1f45e583e709e32fe863`
- candidate SHA256：`8d129f70c093a63b339543f65814232f3cfb6daa13d95168aac3b06bdc39ac28`
- old golden / preserved archive SHA256：`007b6b4136d6959b227cbd9567948f83dca75db4ad788fd43d03c4e3cf069cc5`

审阅者另行逐份重算八份 retained route 的完整 state/event hash、旧四构筑 commands 和 132 个 round 记录，并验证 initial→每个 command→对应完整 battle→final 的连续链。

审阅者用单独手写 XP 表检查新四路线全部 227/215/209/218 个事务的购买 XP +4、自然 XP（1-4 为0，其余结算为2）、实际提交 level/xp、playerHp/streak。随后这些检查补入 updater 本身，并补齐真实 combine/equip/deploy 输出检查。

审阅者还重新执行未改 command driver，以 retained before/after 为只读输入，逐调用验证全部 194/182/176/185 条命令的实例、slot、generation 和目标；33×4 场完整 round hash 复现。该脚本已在固定 Node22.23.3 复跑，见 `verify-driver-decisions.cjs` 与对应日志。

逐份完整 semantic diff 的可接受 SHA256：

| build | plain diff SHA256 | 完整 state 叶子差异数 |
| --- | --- | --- |
| cannon | `31c4fd31a45bf16735bbe314727923c2e612442f9c0eb686236d76ea6ff32c73` | 35301 |
| sniper | `998310d02cc5396b933d20edc9c8f3796bd3357a73debfb834f79ab35a9cfc12` | 24570 |
| mage | `205a1ee94d286e777bd3c2913b82b4b20171d44ed36c96da6a545145897893ab` | 24133 |
| sniper-caitlyn | `fe178c83b6f18b2b92e7a91fd836e47d92b36593625c2f8bfcf7d437d3448c1c` | 25489 |

全部叶子列表与原始 route 的独立重算结果相符；每条 old/new command policy witness 复核一致。这些具体差异已经绑定，不能用其分类扩张到新的字段变化或不同命令。

首轮复核发现的三个问题均在最终候选前修复：

1. 顶层 allowlist / 按 command type 自动解释不足以证明因果完整性：新增完整叶子差异、具体 policy witness、未改 driver 只读重放和精确已审 diff SHA；未知差异拒绝，不再写死 unknown=[] 当证明。
2. 原 Ledger 不直接检查买 XP 后 level/xp 提交：新增独立 progression、HP/streak 提交和完整事务链断言。
3. 候选文件在最终写入窗口被重新读取的 TOCTOU：使用首次已验证的固定 candidate bytes，staged 内容对固定已审 SHA，rename 前重新检查 live old baseline。

最终审阅执行 `verifyReviewed` 成功，并逐项验证当前 183 个 new manifest 输入与捕获 hash 相同；额外原 scripts/.github/oracle、guard test、plain↔gzip、updater/candidate binding 均通过。19 项 guard 反例和 typecheck 通过。最终四路线再运行、原子应用、原 m5/m6 targeted 的结果分别见后续 `deterministic-replay.json`、`apply.log`、`targeted-tests.log`，不由本只读结论代替。
