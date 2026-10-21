# v20-chem-baron fast 四分片结果

基线 `14006984600a08f8dd96fa776bf9ba1d1048ff24`；Node 24.21.0。原始四分片顺序各运行一次，`maxWorkers=2`，未使用 preload，未更改 test/hook timeout。四片退出码均为 1；补充单跑结果不覆盖原失败。

```bash
npm test -- --shard=i/4 --maxWorkers=2 --reporter=default --reporter=json --outputFile=artifacts/v20-chem-baron-sync/shard-i.json
```

`i=1..4`；完整机器清单与错误见 [fast-failures.json](fast-failures.json)，专项结果见 [validation.json](validation.json)。原始日志与 JSON 留在本地忽略目录 `artifacts/v20-chem-baron-sync/`。

| 分片 | 通过 | 失败 | hook 阻塞 | 文件 | 失败文件 | 耗时（秒） |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1355 | 15 | 38 | 119 | 8 | 572.15 |
| 2 | 1542 | 5 | 0 | 118 | 2 | 620.53 |
| 3 | 1726 | 12 | 0 | 118 | 8 | 1202.38 |
| 4 | 1489 | 17 | 0 | 118 | 3 | 487.08 |

**合计 6112 项通过、49 项失败、38 项被 hook 阻塞；473 个文件中 21 个报告失败。** 46 个失败断言来自环境，3 个来自计时；另有 1 个 hook 计时失败。没有未分类错误。

## 分类与复核

- **监听环境**：39 项 `listen EPERM 127.0.0.1`。沙箱不允许本机监听，未执行网络断言。
- **子进程环境**：7 项（replay-errors 4、压力测试 2、冷进程恢复 1）。同步管道报 `spawnSync EPERM`；最小复现还证实异步管道丢 stdout/stderr 数据事件。文件描述符捕获后，冷进程恢复通过；replay-errors 仍因内层异步管道无 readiness 输出而失败，不能视为已通过。
- **计时**：crown-history hook 原 10 秒超时，阻塞 38 项，单 worker 原时限复核 56/56 通过；checkpoint 23 原 5 秒超时，单跑原时限 1/1 通过（1713ms）；T5R 两例原 5 秒超时，单跑原时限 2/2 通过。
- **真实性能门槛失败（v19 同样存在）**：压力测试移除同步管道障碍后，第一例通过；第二例正确性、耗时通过，RSS 超出 256 MiB。相同环境、独立 v19/current 源 bundle、不加载 preload 的对比为 v19 **290016 KiB**、current **290512 KiB**；两者都超标。运算结果均为 AP 301 个、范围 100–700、AD 271 个；这不是玩法差异，但性能门槛仍未通过。

## 原始失败逐项清单

以下列出完整测试名；括号为原始分类。错误全文及 38 个被阻塞用例名称在 JSON。

### 分片 1

`tests/g2-4a-crown-history.test.ts`

- （计时）suite/hook

该 hook 阻塞 38 项；具体名称见机器清单。

`tests/server/g2-4b-artifact-forge-room.test.ts`

- （环境）G2-4b: the artifact anvil across a reconnect a resumed seat gets the same artifact popup and the unchanged deadline, and can still pick

`tests/server/lifecycle.test.ts`

- （环境）B8 lifecycle: the network server across matches keeps connections, credentials, dedupe windows and timers at the same baseline after each of five matches

`tests/server/replay-first-pass.test.ts`

- （环境）game server: spot check logs a mismatch with its battle, seed and first difference, keeps settling, and checks every later battle

- （环境）game server: spot check checks every Nth round that captured a battle (the 1st, N+1th …), one battle each, and nothing in between

`tests/server/net/heartbeat.test.ts`

- （环境）server heartbeat options starts no heartbeat timer when listening fails

- （环境）server heartbeat sends nothing extra when the option is off

- （环境）server heartbeat keeps answering peers connected and sends them a heartbeat every interval

- （环境）server heartbeat drops a seated peer that went silent, keeps its seat, and lets the token resume it

`tests/server/net/live-bank-wire.test.ts`

- （环境）D11 live bank: replay-tail on the wire streams the changed records of a live battle to its seat and ends on the settled battle

`tests/server/net/server-close.test.ts`

- （环境）server close and failed start cancels the delayed close of a superseded connection when the server closes

- （环境）server close and failed start rejects a start on a taken port after releasing its lobby and WebSocketServer

`tests/server/net/slow-task.test.ts`

- （环境）task.slow pending-window reports logs the first slow task immediately and ignores a fast task before expiry

- （环境）task.slow pending-window reports flushes count, maximum and latest slow duration on a fast task at window expiry, only once

- （环境）task.slow pending-window reports flushes an idle pending batch using only the loop.lag timer

- （环境）task.slow pending-window reports flushes the unexpired pending batch on close and cancels all timers

### 分片 2

`tests/server/e2e-replay-errors.test.ts`

- （环境）Server replay errors fail acceptance scripts replay.failed after readiness cannot be hidden by an explicit success exit

- （环境）Server replay errors fail acceptance scripts split replay-divergence after readiness cannot be hidden by an explicit success exit

- （环境）Server replay errors fail acceptance scripts replay.failed before readiness cannot be hidden by an explicit success exit

- （环境）Server replay errors fail acceptance scripts unrelated server output cannot be hidden by an explicit success exit

`tests/server/legend-walk.test.ts`

- （环境）walk message (wire) reaches every seat of the room as `legend`, with no receipt, and a refused walk sends nothing

### 分片 3

`tests/explorer-bracer-restore-pressure.test.ts`

- （环境）rejects 5,000,000 claimed triggers / 100,000,000 AP in a bounded subprocess

- （环境）keeps the real Titan 25-stack cap while merging 26^12 AP/AD histories

`tests/opening-random-identity.test.ts`

- （计时）cannon: checkpoint 23 survives strict text/object restore

`tests/t5r-combat-replay.test.ts`

- （计时）T5R compact combat replay every tick matches authoritative view (six-per-side=true), terminal exact, input untouched

- （计时）T5R compact combat replay PvE accepts the same initial/terminal/ledger shape and rejects inconsistent inputs

`tests/server/g2-4a-forge-timeout.test.ts`

- （环境）G2-4a: the forge popup across a reconnect a resumed seat gets the same forge popup and the unchanged deadline, and can still pick

`tests/server/g2-4b-support-forge-room.test.ts`

- （环境）G2-4b: the support anvil across a reconnect a resumed seat gets the same support popup and the unchanged deadline, and can still pick

`tests/server/little-legends.test.ts`

- （环境）little legends: over the wire shows every seat the legend another player picked

`tests/server/projection-wire.test.ts`

- （环境）B7 private seat view on every state path sends only the private view: first snapshot, increments, resume snapshot and the fault snapshot

- （环境）B7 private seat view on every state path keeps the fault snapshot projected

- （环境）B7 compact replay sends each battle once as the room's own replay and never as combat frames (C6)

`tests/server/net/v17-avarice-reconnect.test.ts`

- （环境）v17 avarice: reconnect during and after a live battle a seat that left and came back is shown the settled live replay and settles once

### 分片 4

`tests/g2-4b-pr161-restore.test.ts`

- （环境）cold Node processes restore actual canonical saves for tiers4/10/14 with the same claims and pending choice

`tests/server/net/server.test.ts`

- （环境）game server: visibility shows the other seat its level and HP changes but never its shop or private state

- （环境）game server: rejections leave the room untouched refuses forged seats, uploaded gold, wrong protocol, wrong types and stale versions

- （环境）game server: commandId dedupe executes a repeated commandId once and refuses the same id with other content

- （环境）game server: commandId dedupe refuses an id that fell out of the retention window and demands a resync

- （环境）game server: disconnect and resume returns a dropped seat to its owner by token, snapshot before increments, and disarms the old socket

- （环境）game server: disconnect and resume G1-P6: a resumed seat gets the same opponent candidates in preparation and fights one of them

- （环境）game server: disconnect and resume drops a queued player that disconnects before the match and frees the seat

- （环境）game server: queue refuses the ninth join with "full" and leaves the queue at eight

- （环境）game server: queue refuses a join while a match runs and lets a new queue form after it ends

- （环境）game server: single writer runs 50 pipelined commands strictly in arrival order with no interleaving

- （环境）game server: connection limits closes a connection that sends an oversized frame

- （环境）game server: connection limits rate-limits a connection on the room clock and accepts again in the next window

- （环境）game server: whole match over the wire drives two clients from the queue to a full ranking with replays on the manual clock

`tests/server/net/takeover.test.ts`

- （环境）game server: no takeover by default (P2) keeps a disconnected seat human-controlled long after the old takeover delay; resume is a plain reconnect

- （环境）game server: bot takeover of a disconnected seat when switched on (B6) shows the takeover to everyone after takeoverMs and hands the seat back on resume with reclaimed=true

- （环境）game server: bot takeover of a disconnected seat when switched on (B6) a resume before takeoverMs is a plain reconnect: no takeover, no reclaimed flag

## 其他未通过项

`node scripts/verify-m8-u6-loot.cjs` 因沙箱禁止监听 `127.0.0.1` 退出 1，浏览器/DOM 验收未运行。原脚本的 seed36 容量、seed38 terminal 采集及 save-envelope 路线已在无浏览器环境单独通过；这不能替代 DOM 验收。Git 元数据只读，内容冲突已消除，但索引仍有 23 个 UU，待用户暂存提交。
