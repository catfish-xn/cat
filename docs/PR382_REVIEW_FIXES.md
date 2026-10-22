# PR #382 must-fix 验收（2026-10-22）

起点 `codex/live-combat-stream` / `1377ff61ea4f1131d2d5391e248e584636acd107`。按本轮用户明确授权修改 server 和客户端接线；无玩法、数值、领域代码、CI 或历史 epoch 变更，未连接外部服务器。

## 根因和修复

1. P1（`src/server/room/room.ts:1154`，预算源 `:1117`）：`finishStreams` 用 `drainWork(planStreamSteps())` 在末拍同步规划八席奖励/收据，绕过 #390 的预算。现只安排下一次注入 clock 回调，在 `startSettlementWork → finishStreamSteps → yield* planStreamSteps` 内计算。完整计划才发布 battles、pendingSettlement，并开始至少 800ms 尾段；到期继续复用计划，基础过期则切片重建。末拍和规划各自有独立预算；`advanceStreams` 同样支持 `sliceNow`。
2. P1（`src/rendering/online/online-application.ts:144` / `:148`，`remote-session.ts:105` / `:175`）：RemoteSession 已保留追加前缀，但 OnlineApplication 不区分返回路径，每 chunk 都重刷场景。`reviseReplay` / `watchReplay` 现在返回 boolean：只追加同一 initial/revision/fromTick/帧前缀（含 end）为 true。此时不 refresh、不 syncScout，帧仍交给独立播放器。open、换席和非追加修订照常刷新。
3. P2（`src/server/room/room.ts:243` / `:1146`）：PvE 分片中间已推进部分 current.seats，命令可经 replace 把它发布出去。房间统一写闸门现也检查 streamingBoundaryPending；席位命令、连接标记及其他既有受闸门保护的入口等整拍封口后按 FIFO 执行，保留原请求版本校验。没有改 tick、RNG 或奖励顺序。

## 新增/增强回归

| 文件 | 用例名称 | 验证 |
| --- | --- | --- |
| tests/server/combat-stream.test.ts | `slices terminal planning away from the final tick and keeps every closing callback below 50ms` | 末拍不执行任何规划单元；首次规划和尾段过期重算均切片；完整规划前 battles 为空，之后尾巴 ≥800ms。 |
| 同上 | `round 1/5: measures final-tick and closing slices and audits every first-pass stream` | 八席 PvE/PvP 末拍和收尾真实回调均 ≤50ms，所有首遍回放抽检有结果且逐帧相等。 |
| 同上 | `the 20ms budget yields inside a boundary and defers writers until every seat seals the tick`（增强原用例） | 八席仅两席走完 tick1 时锁店、断线排队；不发布中间状态，封口后两次发布均为八席 tick1。保留原 tick/输入边界断言。 |
| tests/server/net/combat-stream-memory.test.ts | `schedules and completes a real spot check after streamed battles are published` | 生产服务器调度确实记录 round1 抽检成功，无抽检失败。 |
| tests/rendering3d-scout-shop.test.ts | `refreshes replay opens, seat switches and revisions but keeps appended own/watched chunks off the refresh path` | 真实 OnlineApplication + RemoteSession，连续本人/观战追加不刷新、不重发 scout；open、换席、非追加仍刷新，播放器消费新帧。 |
| tests/server/combat-stream-client.test.ts | `own/watched replay reports only same-stream appends as refresh-free` | 追加/end 返回 true；revision、initial、完整回放替换和换席返回 false。 |

## 分片测量

Node v22.23.4 / x86_64，单 worker，无其他测试进程竞争。`ManualClock.fireNext` 推进房间时序，`sliceNow: () => performance.now()` 控制真实 CPU 预算；performance.now 仅在测试中使用。每次完整房间回调单独测量，最后一拍至结算发布的每片都有 ≤50ms 断言。无网络压缩或浏览器绘制负载。

单独测量命令：

```sh
npm test -- tests/server/combat-stream.test.ts --maxWorkers=1 -t 'slices terminal|measures final' --silent=false --reporter=verbose
```

| 回合 | 类型 | 末拍 ms | 收尾最长 ms | 总最长 ms |
| --- | --- | ---: | ---: | ---: |
| 1 | 八席 PvE | 1.886 | 7.675 | 7.675 |
| 5 | 八席 PvP（四场） | 1.605 | 5.654 | 5.654 |

20 文件完整套件中的同组实测：PvE 末拍 1.757ms / 收尾最长 6.232ms，PvP 末拍 1.454ms / 收尾最长 5.745ms，全部 ≤50ms。

另有确定性预算回归：每个真实规划生成器工作单元附加 7ms 假 CPU，20ms 预算，首次八席规划跨三个分片，最长 **21ms**；尾段操作使基础过期后，重规划每片同样 ≤21ms。此用例会抓住把生成器重新同步 drain 的回退。

20ms 是协作预算，一个不可抢占规则事务或 GC/调度暂停仍可能越过预算；上述 ≤50ms 是本次样本和测试约束，不代表全局硬实时保证。未处理用户明确列为不阻塞的每 chunk ticks 全量复制成本。

## firstPassReplays 调查结论

原分支已有登记，不需要重复补写：PvE `CombatStream.pveOutcome → primeCombatReplay(outcome, completedReplay)`；PvP `CombatStream.advancePvp → twoSidedResult → primeCombatReplay(result, task.replay())`。`primeCombatReplay` 同时写缓存和 firstPassReplays WeakSet。完整规划发布保留这些对象身份，`startReplaySpotCheck` 能选中所有八席，实际重演逐帧比较无差异；服务器的 scheduleSpotCheck 在新的分片规划发布后仍执行，新增日志断言覆盖此链。

## 验证范围

最终串行验收：**20 个文件、164 项全部通过**，耗时 647.24 秒；包含用户指定九个文件和搜索到的全部 online-application / remote-session 对应测试。真实 loopback WebSocket 用例正常通过，未改测试超时、断言门槛或 CI。`npm run typecheck`、`git diff --check` 通过。

完整命令（日志在 `artifacts/pr382-review/tests.log`）：

```sh
npm test -- tests/server/combat-stream.test.ts tests/server/net/combat-stream-wire.test.ts tests/server/net/combat-stream-memory.test.ts tests/server/net/server.test.ts tests/server/net/watch.test.ts tests/server/net/settlement-queue.test.ts tests/server/settlement-slices.test.ts tests/server/purity.test.ts tests/live-combat-inputs.test.ts tests/server/c15-replay-unit-ids.test.ts tests/server/c18b-use-consumable.test.ts tests/server/v15-orb-ui.test.ts tests/server/replay-client.test.ts tests/server/net/watch-stream.test.ts tests/server/g24-voidspawn-move.test.ts tests/server/live-bank.test.ts tests/server/g5-battle-ranking.test.ts tests/server/combat-stream-client.test.ts tests/rendering3d-catchup.test.ts tests/rendering3d-scout-shop.test.ts --maxWorkers=1 --silent=false
npm run typecheck
```

压力测试中旧路径两次均到第 40 轮、流式两次均到第 39 轮；各自终局、完整账本、命令、回执、Bot 五类 SHA-256 全部一致。流式终局 SHA-256 为 `015e23236653e9756039989e245716ed80123c3839bcae1ab62ae958350c72e7`。没有要求两种不同输入时序的路径之间指纹相同。

`git diff --exit-code 1377ff61 -- tests/fixtures` 通过；改动文件与 sourceDigests 集交集为空。未触碰 `scripts/v20-live-combat-fixture-audit.cjs` 的 sourceDigests 文件集或 Herald sources 集，因此本次不触发 epoch 重录。历史 manifest 和 v20-xp68 及更早文件保持原字节。

## 本地提交受阻

实际执行 `git add src/server/room/room.ts tests/server/combat-stream.test.ts tests/server/net/combat-stream-memory.test.ts` 返回：`fatal: Unable to create '/home/aiapps/workspcae/cat/.git/index.lock': Read-only file system`。本环境不能写 Git 元数据；未生成任何 commit，HEAD 仍为起点，未 push。没有改用其他 Git 目录绕过限制。

已准备 `artifacts/pr382-review/commit-local.sh`（`bash -n` 通过），在原仓库 Git 恢复可写后可按以下三组提交。每条均以 `Co-Authored-By: Codex <noreply@openai.com>` 收尾，脚本不 push：

1. `Fix sliced combat finalization and boundary publication`：room.ts 与服务器回归。
2. `Preserve client display state for appended combat frames`：两个客户端文件及其回归。
3. `Document PR 382 review fixes and validation`：合同和本记录。

对应 `01-server.patch`、`02-client.patch`、`03-docs.patch` 位于同一 artifacts 目录，便于转移已验证的改动。当前工作区已包含这些改动，无需再次 apply。
