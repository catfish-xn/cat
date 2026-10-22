# v21-opening-encounters

**合入状态：阻塞。** 录制/verify通过，但合法战中原位合成的回放槽位丢失，Crown完整复验仍有15例失败。详见PR9报告及 `slot-replay-blocker.json`，不得把本录制当作CI已绿或发布完成。

父 epoch：`v20-black-market`（`multiplayer@83fd7fa58fc7c935229c8f8866b14ec9d716accd`）。集成待录制 HEAD：`3394f10446b6a6c2a793d8bd96be6932ebf06374`。PR9 本身只录制、适配测试与写文档，不修改游戏实现、规则或数值。

| 字段 | 当前值 |
| --- | --- |
| rules | `s13-g2-3-v21-opening-encounters-battle-equipment` |
| content | `s13-14.24b-g2-3-v21-opening-encounters-battle-equipment` |
| CONTENT | `fnv1a32-utf16:35273c97` |
| LOOT_REPLAY | `fnv1a32-utf16:ef359464` |
| schema/save/replay/command | `12/8/6/6` |
| NET | `6` |

短名 `v21-opening-encounters` 用于脚本、证据和夹具目录；外层身份沿用已集成的完整字符串。该 epoch 同时涵盖开局奇遇 PR1/2/4/5/6/8、实时战斗装备第2阶段及 `next-preparation-income-v1`，不省略后两项的发布语义。

- 每局一次独立流奇遇，全场同一个选择；关闭项保留权重且不发奖励。PR2 强制强化档位/四选一锻造器、PR5 猴子与杰作升级、PR6 梅尔观察及收据隔离按已有合同；PR4 魔像仅关闭接口，不宣称全部16项效果启用。
- 战中装备下一拍生效，本场羁绊冻结，纹章只加自身属性。
- 基础金/利息/连胜败收入下一准备入口支付；胜利金仍即付，利息按终战权威余额及胜利金取样；致死/终局无下一入口不补发。
- 所有旧身份严格拒绝恢复，无版本字符串伪装、迁移或历史夹具覆盖。

四条 seed42 公共命令路线均33场战斗，cannon/sniper 各67份原始状态；父版命令序列和完整事件账本逐项相等的断言保留，变化由 release-audit 的完整状态与字节证据记录。Herald 五份原始 JSON 先导出，随后才加载生产恢复器，验证开战和15拍完整往返。live-reveal 保留同tick双源死亡、Loris/Zyra各1个源掉落与空载源0掉落的原精确断言；不因 oracle 补齐强制强化档位而换种子或放宽场景。

服务器 `battle-start.json` 由新增脚本重新自然推进 seed20261012、一真人买XP及七机器人路线；轮次3/9/23分别冻结，同一初始化生成器同步耗尽与切片执行的 tick0/1 完整状态/输入/帧/账本 SHA-256 相等。旧 `9d9ea671 baseline` 替换原因是 schema12、开局奇遇字段、下一拍装备及收入支付时序改变；旧快照不作为生成输入。

复现（本地已有 Node22 与依赖，不联网）：

```bash
export PATH=$HOME/.local/bin:$PATH
node scripts/update-content-identities.cjs --check
node scripts/verify-v21-opening-encounters-epoch.cjs --write
node scripts/verify-v21-opening-encounters-epoch.cjs
npm run typecheck
npx --no-install vitest run --project fast --maxWorkers=16
npm run build
```

执行顺序沿父 epoch 的实际依赖：身份/服务器快照 → release → Herald → inputs → live-reveal → transfer → 逐项重算/历史字节/digest。inputs 引用 Herald 的原始字节，因此不可先于 Herald 生成。详细结果以 [PR9报告](../../OPENING_ENCOUNTERS_PR9_REPORT.md) 与本目录 JSON 为准；本地通过不冒称远端 `ci-required` 已执行。
