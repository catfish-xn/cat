# 开局奇遇 PR9：v21 epoch 录制与合入前验收

**结论：录制完成，但暂不能合入 multiplayer。发现合法战中合成的回放槽位丢失，最小复现稳定失败；按用户要求停止适配，没有修改生产实现或放宽断言。`ci-required` 合入条件尚未满足。**

## 身份与范围

工作分支 `codex/encounters-pr9-epoch`，输入 HEAD `3394f10446b6a6c2a793d8bd96be6932ebf06374`；父 epoch `v20-black-market`，基线 `multiplayer@83fd7fa58fc7c935229c8f8866b14ec9d716accd`。短名采用 **v21-opening-encounters**，rules/content 保留已集成的完整身份：

- rules：`s13-g2-3-v21-opening-encounters-battle-equipment`
- content：`s13-14.24b-g2-3-v21-opening-encounters-battle-equipment`
- CONTENT：`fnv1a32-utf16:35273c97`；LOOT_REPLAY：`fnv1a32-utf16:ef359464`
- schema/save/replay/command：**12/8/6/6**，NET **6**。

此 epoch 同时包含开局奇遇 PR1/2/4/5/6/8、实时战斗装备第2阶段和延后至下一准备阶段的收入。PR9 没有修改 `src/`、玩法或数值，没有修改 CI 门槛、workflow 或超时。全程离线、无下载、无提交；不声称远端 `ci-required` 已运行。

## 录制与字节证据

主入口：`node scripts/verify-v21-opening-encounters-epoch.cjs --write` 录制，随后不带参数逐项重算校验。依赖顺序为身份、房间快照、release、Herald、inputs、live-reveal、transfer，再做独立检查、补充场景和历史字节核对。inputs 引用 Herald 字节，因此沿父脚本实际依赖顺序生成。

| 新夹具 | 原因与生成证据 |
| --- | --- |
| `tests/v21-opening-encounters-content-baseline.json` | 新身份及首战状态/事件/RNG hash；`release-audit.json` |
| `tests/fixtures/m5/full-match-golden.v21-opening-encounters.json` | 四条公共路线新身份/状态；各33战、终局胜利、round38，原命令与完整事件账本逐项相等断言保留 |
| `tests/fixtures/v21-opening-encounters-recorded-states/{cannon,sniper}.json.gz` | 各67份实际状态；原始对象与文本严格恢复，SHA-256/长度/首个不同字节见 `release-audit.json` |
| `tests/fixtures/v21-opening-encounters-herald-raw/` | 五份原始 Herald 场景先生成后加载恢复器；开战和15拍往返，目录 manifest/trajectory 及 `input-fixture-audit.json` 留证 |
| `tests/fixtures/v21-opening-encounters-{c19-seed-9-minimal,b8-fingerprints}.json` | 当前战斗输入与 identity；保留原 tick/伤害/状态/事件精确断言；`input-fixture-audit.json` |
| `tests/fixtures/v21-opening-encounters-transfer-route.json` | 当前 transfer 路线锚点；独立重算与 `--check` |
| `tests/server/fixtures/battle-start.json` | 从 seed20261012 自然推进一真人买XP、七机器人，冻结 round3/9/23；同快照切片/同步初始化 tick0/1 的完整状态、输入、帧、账本 SHA-256 一致；`battle-start-audit.json` |
| `tests/fixtures/v21-opening-encounters-chest-trial.{ts,json}` | 旧seed554变为棱彩前奏；独立搜索真实白银 Manaflow I 路线，最终seed29997保留原tick79/80/179/180/220/344/451/452八个边界、两层护腕、三次脉冲、死亡及完整恢复续跑；`chest-trial-audit.json` |

`battle-start-slices.test.ts` 的旧 `9d9ea671 baseline` 标记改为本次输入 HEAD；新基线由脚本生成，未手填 hash，切片一致性断言不变。live-reveal 保留 tick44 双源死亡 seq382/383、Loris tick437、Zyra tick176 各1收据，以及 unloaded tick106/seq822 的0新掉落。

历史保护范围为 v20-black-market 及更早版本的393个 fixtures/证据/录制脚本，加上单独保护的 `tests/fixtures/g2-4b-herald-raw/manifest.json`。逐文件长度与 SHA-256 见 [history-preservation.json](evidence/v21-opening-encounters/history-preservation.json)；当前消费者修改的前后字节见 [consumer-byte-audit.json](evidence/v21-opening-encounters/consumer-byte-audit.json)。没有覆盖历史 golden 或伪装身份迁移。

## 消费者适配与失败分类

- **身份/当前指针**：CURRENT Herald、M5/M8 golden、B8/C19、transfer/current-epoch 等转向新目录；`opening-random-identity` 保留历史断言并增设当前断言，旧 rules/content/digest/schema/protocol 严格拒绝恢复；save/replay 旧版本与未来版本拒绝向量同步。
- **已批准收入时序**：match-contract、loot-orb、g2-3、M5、s13-p1、server/t10 区分结算可花余额与下一准备收入；逐项保留准确金额、利息、投资成长、重复推进不重发断言。
- **开局选择/独立 oracle**：oracle 使用独立字面权重表、BigInt FNV/LCG 补齐强制强化档位，未调用生产实现；修复 g2-augments、B8 cannon oracle、live-reveal。共享席位合成夹具携带相同 openingEncounter/augmentTierSeed；D11 严格恢复场景另改用真实提供的选项替代伪造 offer。
- **公开路线变化**：Crown/TG 先完成新增开局选择，读取实际物品出生 ID；seed307 黄金盛典经两次公开免费重掷选 Manaflow II，仍保留原战斗精确掉金断言；宝箱路线以录制场景替换旧固定种子；最终seed29997在公开免费重掷后取得 Manaflow I，八个原边界tick全部保持。
- **测试设施**：战斗任务 API 精确键集合新增 `queueEquipment`；开局导入循环导致原异步 mock 未注入实际 grant 导出，改为模块初始化后 spy，保留故障原子性断言。Crown 终战装备篡改由更早的完整事件账本校验拒绝，更新准确拒绝原因。
- **负载超时**：探索轮并行负载下的7个文件单独重跑59/59通过，未调高超时、未跳过测试。

探索轮在新夹具尚未全部生成时运行：6868用例，6579通过、212失败、77跳过；失败包含缺文件、旧身份级联、时序/公开路线和负载超时，不能当作最终验收。42个失败文件及212条失败断言的分类清单见 [exploratory-failures.json](evidence/v21-opening-encounters/exploratory-failures.json)。最终复验以末节为准。

## S13_RULES_GAP

文档顶端标记当前 v21，并把 v20 标记为历史。补齐延后收入、致死不补发、下一拍装备、冻结羁绊、纹章自身属性，以及每局一次独立流/全场同结果/关闭不归一化、前奏终章其余档位等权、锻造器四选一等已批准约定。明确训练师/梅尔奖励/沃里克等尚未批准内容仍关闭，不把工程约定写成官方数值。

## 最终验收

| 检查 | 实际结果 |
| --- | --- |
| `npm run typecheck` | 通过；最终 build 再次执行 typecheck 也通过 |
| 新 epoch verify | 15/15 通过，约557秒；最后 Crown 初始化适配后，consumer-byte-audit 已重新生成并单独 `--check`，其他 epoch 输入未改变 |
| 全套 fast，maxWorkers=16 | 6912例：6844通过、3个用例超时、65个因 hook 失败未执行；6个文件失败，命令退出1 |
| 五个负载失败文件逐个 maxWorkers=1 | 44/44通过：assets3d-compress、assets3d-fx-pilot、p7-carousel、server/g2-4b-artifact-forge-room、server/g5-battle-ranking；未改超时 |
| Crown 单独复验 | 起初18通过/38未执行；定位到另一处开局选择遗漏，补上合法选择后56例全部执行，41通过、15失败 |
| 按每个文件最新结果合并 | **6897通过、15失败、0跳过**；这是全套+单文件复验的合并口径，不是第二次全套运行 |
| `npm run build` | 通过（含typecheck）；Vite构建11.69秒，仅有大于500kB的chunk提示 |
| 收尾字节检查 | 393个历史文件及指定manifest原样；测试自动生成的旧bench-timing证据已恢复输入HEAD字节；`git diff --check`通过 |

完整分类及原始结果SHA-256见 [validation.json](evidence/v21-opening-encounters/validation.json)。探索轮及早期局部 JSON 的 `numFailedTests=0` 不能证明整个文件通过：Crown 的 beforeAll 失败导致38例跳过，已在本轮显式检查文件状态并展开验证。最终不以该早期结果作为通过证据。

## 阻塞问题：合法原位合成请求的槽位在回放中丢失

复现命令（**当前应退出1，表示问题仍在**）：

```bash
node scripts/reproduce-encounters-pr9-slot-replay.cjs
```

seed7，使用原测试已有的机制授予命令取得两把大剑，第一把装备槽0；开战后tick1将第二把请求装备到槽2，生产命令成功并原位合成为槽0死亡之刃。Match 的待生效装备输入保留请求 `slot:2`，`BattleHistory` 却从合成结果位置记录为 `slot:0`。原样 `capturePrefix()` 调用 `validateBattleRecord(prefix, [])` 抛出 **“战斗档案无效：内容校验”**。

两个真实命令执行（请求槽2与槽0）的 combat digest 分别为 `fnv1a32-utf16:945813ad` / `fnv1a32-utf16:f938c3f7`。没有篡改记录或状态。原始状态、上下文和回放共96797字节，SHA-256 `9af3a11f9ff0d9bd5b4955677be05cb055db8d7f1bee90c98ded32d3cf3627c3`；见 [最小复现证据](evidence/v21-opening-encounters/slot-replay-blocker.json) 与 [原始字节](evidence/v21-opening-encounters/slot-replay-blocker-raw.json)。定位在 `src/replay/history.ts` 原位合成的命令捕获（使用合成后槽位），与第2阶段保留原请求的装备输入不一致。PR9未修改这些实现。

15个剩余失败均在 `g2-4a-crown-history.test.ts`：

- **1个确认生产问题**：requested slot2 的合法回放不能通过内容校验。
- **3个待重录的时序预期**：战中合成/穿戴已经影响本场战斗，旧 endTick 不再成立；没有手改数字。
- **3个旧同结果假设**：把命令及收据tick一起移动仍应等于同一状态的旧假设，与下一拍生效不再一致。
- **8个待核对的拒绝边界**：更早的事件、内容或装备序列检查先失败；尚未继续适配，不能据此排除其他隐藏问题。

发现确认生产问题后，按“真bug停下来写报告”的要求停止处理余下14例。它们的分类是后续排查方向，不宣称已经全部证明只需更新夹具。完整用例名称及首条错误见 validation.json。

下一任务建议先修复回放对原请求槽位及输入顺序的保真，再按原严格断言录制其余时序夹具并重跑全套。无玩法取舍需要决定。完成后还必须实际触发远端 `ci-required`；本次离线、未提交，未执行远端CI，也没有改变任何合入门槛。
