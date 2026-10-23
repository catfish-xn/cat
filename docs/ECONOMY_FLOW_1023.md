# 经济与阶段流程：10-23 验收

角色 Codex；分支 `codex/economy-flow`，基线 `1b0e72b5`。只执行用户批准清单第10/11/12/13/15条；服务器计时属于本单明确授权。全程离线，未提交；不录epoch、不更新身份/digest常量或历史golden。**待 v22 统一录制**。

## 实现位置

| 文件:行 | 改动 |
| --- | --- |
| `src/simulation/match-rules.ts:31` | 连胜败阈值2/5/6；上一轮开局基础应收2/3/4；开局计连胜败 |
| `src/simulation/economy.ts:39` | PvP/PvE共用连胜败计算；供给保留不发、平局沿旧规则计败 |
| `src/simulation/opening-economy.ts:48` | 开局基础金加连胜败金；利息/胜利金仍0，HP/XP不变 |
| `src/simulation/round-schedule.ts:9` | 唯一准备时长表及`getRoundPreparationMs`查询，含加时 |
| `src/server/room/room.ts:1052` | 选择结束后按规则表设置准备deadline；非默认调试时长覆盖保留 |
| `src/simulation/content/opening-encounters.ts:208` | 前奏/终章/发条猴子3条描述去内部备注；概率、触发及来源不变 |

`planCombatStreak(streak:EconomyStreak,result:RoundEconomyInput['result'])`返回`{streakAfter:EconomyStreak,streakGold:number}`；供两种已验证输入的planner共用，不是新Match命令，安全整数溢出抛`RangeError`。`getRoundPreparationMs(roundId:string):number`返回毫秒，无效回合抛`RangeError`。其余命令、收据、序列化形状和失败原因不变。#406延后支付函数、权威结算/恢复路径继续复用同一planner，无新持久字段。普通与加时战斗规则未修改。

## 独立手算向量

- 结算后连胜/败长度1/2/3/4/5/6/7/21，奖金0/1/1/1/2/3/3/3；胜、败、平局及PvP/PvE双矩阵验证。PvE不发1G胜利金。
- 19G、已有4连胜，本场PvE胜：5基础+1利息+2连胜=8，应收后27G；同条件PvP胜：5+1胜利+2利息+2连胜=10，应收后29G，战后实际20G、下一入口29G。加时同一经济、基础掉血仍17。
- 1-2/1-3/1-4基础应收2/3/4，分别到1-3/1-4/2-1准备入口。无操作、无战利品、开局三败：结算应收2/4/5，实际准备入口0→2→6→11；2-1强化前11G=基础9+连败2；HP100→97→94→91，等级/XP依旧1/0→2/0→3/0→3/2。结算和恢复不提前到账，重复Continue不重发。
- 全38轮基础应收预算2+3+4+35×5=184（含终局无下一入口的应收，不能当实际累计到账）；原185向量按批准基础金修正。
- 准备时长：1-2=6000ms、1-3=15000、1-4/其余PvE=20000、4-6=75000，其余及overtime=30000。规则层全目录+非法ID；服务器真实调度器的11种回合入口/边界前一毫秒与1000ms调试覆盖验证。4-6强化/异常选择阶段的计时未改。
- 新planner测试监听`nextRandom`为0次；真实开局锁店推进的shop RNG保持原值。开局各轮严格恢复、完整事件回放终态与原状态相等；同步/流式、切片/非切片一致由服务器相关测试覆盖。

## 验收与保留的旧失败

核心6文件 **95/95通过**（含新增规则8项、服务器2项），命令：

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --no-file-parallelism tests/economy-flow-1023.test.ts tests/server/economy-flow-1023.test.ts tests/m5-economy.test.ts tests/m5-acceptance.test.ts tests/m8-b6-opening-economy.test.ts tests/playtest-1022b-income.test.ts
npm run typecheck
```

最终`npm run typecheck`通过；`git diff --check`通过。原收入用例用空场明确认输，消除即时PvE战利品对“余额仍0”的干扰；仍严格验证原收入、恢复和一次到账，不放宽断言。

身份专项4文件307项：**38通过、269失败**。`match-contract`、`m8-contracts`通过；以下身份/旧轨迹断言均保留：

| 旧测试 | 失败数 | 原因/范围 |
| --- | ---: | --- |
| `tests/opening-random-identity.test.ts` | 135 | cannon/sniper各67个旧checkpoint拒绝`unsupported-version`；1项首战terminal/事件hash旧轨迹失配 |
| `tests/m8-content-equivalence.test.ts` | 134 | cannon/sniper各67个旧epoch存档恢复`unsupported-version` |
| `tests/m8-b6-match-wiring.test.ts` | 1个suite加载阻断（0项执行） | `m8-neutral-public-route`顶层生成整局时旧独立oracle报`earned source must be dead`，不改oracle/golden。该文件普通经济断言同步到批准新值，但本轮无法执行；新公共开局测试独立覆盖相同恢复/支付/XP语义 |

上述不是本单全新增失败的归因清单：候选已有其他规则变动，当前不以更新hash或fixture消除它们。待v22统一录制前，不能把本单通过项当整包可发布验收。

最终相关测试15文件187项：**178通过、9失败、0跳过**；其中13文件173项全部通过。包括`server/combat-stream`15项（同步/流式、恢复及回放）、`server/settlement-slices`10项（切片/同步状态和发布字节）、T3结算11项；新增10项全部通过。与核心95项有重叠，不累加成额外通过数。最终相关测试与身份专项合计494项：216通过、278旧断言失败，另有上表1个加载阻断suite（0项执行）。旧失败逐项补充：

- `tests/opening-encounters.test.ts`：3项。
  - opening encounter PR1 content and independent selection preserves all sixteen official 14.24b intervals and explicit disabled identities
  - opening encounter PR1 content and independent selection rejects incomplete/reordered/enabled configs without altering the supplied input
  - opening encounter PR1 content and independent selection includes the full table and conventions in both freshly recomputed digests
- `tests/server/battle-start-slices.test.ts`：6项。
  - battle opening slices round 3: tick0/1 hashes equal the v21-opening-encounters synchronous baseline
  - battle opening slices round 9: tick0/1 hashes equal the v21-opening-encounters synchronous baseline
  - battle opening slices round 23: tick0/1 hashes equal the v21-opening-encounters synchronous baseline
  - battle opening slices 4-6 including the mirror: complete results and ledgers equal synchronous resolver output
  - battle opening slices keeps frozen inputs and FIFO commands until publication, matching arrivals after synchronous opening
  - battle opening slices 4-6 full boards: never adds a second rules initialization step to a slice

`opening-encounters`前2项仍假设已在候选启用的奇遇关闭，第3项为重算digest与固定常量不符；`battle-start-slices`6项使用旧录制房间/库存fixture，观察到`invalid-pool`，并连带影响开战、FIFO、tick0/1断言。未改其旧断言或fixture；待v22统一更新身份与录制后复验。本单仅更新经济规则的独立数值断言，未改任何golden/epoch/digest期望。

未运行全量浏览器/完整发布验收；本单无界面改动。下一步为集成v22后统一身份、golden/epoch录制并复验上述清单。
