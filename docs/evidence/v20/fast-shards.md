# 四个 fast 分片首次运行结果

每片一次；命令为 `npm test -- --shard=i/4 --reporter=json --outputFile=artifacts/v20-phase1/shard-i.json`，未跳过测试或修改超时。原始日志及JSON保留在gitignore的 `artifacts/v20-phase1/`。

表中数字为测试项，不是 describe suite 数。exit 137 只确认进程被终止；资源观测不足以将其确认为某种具体OOM原因。超时没有通过基线复跑证明为既有失败，不将超时算作通过。EPERM表示本环境操作被拒绝。

| 分片 | 退出码 | 秒 | 通过 / 失败 / 待执行 |
| --- | --- | --- | --- |
| 1/4 | 137 | 496.71 | 未生成报告 |
| 2/4 | 1 | 820.91 | 1528 / 12 / 8 |
| 3/4 | 1 | 692.13 | 1701 / 11 / 20 |
| 4/4 | 1 | 236.4 | 1485 / 22 / 0 |

## 分片 1/4

进程被终止（exit 137，日志 `Killed`）；没有JSON报告，无法提供该片断言结果或完整失败名称。不能视为通过。

## 分片 2/4

### `tests/d14-wiring-match.test.ts`

- ultimate-hero strictly restores settled-1 and continues identically — Error: Test timed out in 5000ms.

- ultimate-hero strictly restores combat-2 and continues identically — Error: Test timed out in 5000ms.

- ultimate-hero strictly restores settled-2 and continues identically — Error: Test timed out in 5000ms.

### `tests/m5-replay-mage.test.ts`

- M5 mage restores every command and tick; rejected insertion preserves every field — Error: Test timed out in 600000ms.

### `tests/m6-integration-mage.test.ts`

- M6 independent route/history/playback/session integration mage: every completed battle has exact original state/events and isolated playback — Error: Test timed out in 360000ms.

### `tests/m6-integration-sniper.test.ts`

- M6 independent route/history/playback/session integration sniper: every completed battle has exact original state/events and isolated playback — Error: Test timed out in 360000ms.

### `tests/m8-b8-loot-view.test.ts`

- 文件 hook / 收集阶段（子测试未执行） — Hook timed out in 10000ms.

### `tests/r3r4-oracle.test.ts`

- signed R3/R4 independent loot oracle matches every PvE entry and both independent RNG cursors for 512 seeds — Error: Test timed out in 5000ms.

### `tests/server/e2e-replay-errors.test.ts`

- Server replay errors fail acceptance scripts replay.failed after readiness cannot be hidden by an explicit success exit — AssertionError: expected Error: spawnSync /opt/node-v24.21.0-linux… { …(5) } to be undefined

- Server replay errors fail acceptance scripts split replay-divergence after readiness cannot be hidden by an explicit success exit — AssertionError: expected Error: spawnSync /opt/node-v24.21.0-linux… { …(5) } to be undefined

- Server replay errors fail acceptance scripts replay.failed before readiness cannot be hidden by an explicit success exit — AssertionError: expected Error: spawnSync /opt/node-v24.21.0-linux… { …(5) } to be undefined

- Server replay errors fail acceptance scripts unrelated server output cannot be hidden by an explicit success exit — AssertionError: expected Error: spawnSync /opt/node-v24.21.0-linux… { …(5) } to be undefined

### `tests/server/legend-walk.test.ts`

- walk message (wire) reaches every seat of the room as `legend`, with no receipt, and a refused walk sends nothing — Error: listen EPERM: operation not permitted 127.0.0.1

### 待执行/跳过项（保留首次报告状态）

`tests/m8-b8-loot-view.test.ts`

- B8 readLootView over real randomized public routes exposes no future orb content and hidden payloads cannot leak before a death

- B8 readLootView over real randomized public routes reveals only earned orb entries mid-combat, still without receipts or player actions

- B8 readLootView over real randomized public routes after PvE grants item/tool entries and withholds the full-bench hero, with no obsolete choice

- B8 readLootView over real randomized public routes one real sale grants the hero and unblocks Continue, while the next round clears the view

- B8 readLootView over real randomized public routes terminal two source deaths including a hero: retained reward is read-only and unearned content stays hidden

- B8 readLootView over real randomized public routes terminal only component carrier: retained reward is read-only and unearned content stays hidden

- B8 readLootView over real randomized public routes terminal tool carrier: retained reward is read-only and unearned content stays hidden

- B8 readLootView over real randomized public routes terminal no carrier: retained reward is read-only and unearned content stays hidden

## 分片 3/4

### `tests/explorer-bracer-restore-pressure.test.ts`

- rejects 5,000,000 claimed triggers / 100,000,000 AP in a bounded subprocess — Error: spawnSync python3 EPERM

- keeps the real Titan 25-stack cap while merging 26^12 AP/AD histories — Error: spawnSync python3 EPERM

### `tests/g2-4b-unstable-chest.test.ts`

- 文件 hook / 收集阶段（子测试未执行） — JSON标记文件失败，但未附具体错误；原因未确定

### `tests/t12-combat-equip.test.ts`

- T12 public saves across equipment phases augment choice and supply choice retain offers while equipment saves resume — Error: Test timed out in 5000ms.

- T12 latest assets survive death, settlement and upgrades a permanent unit killed in this combat can equip; next battle uses the new stats — Error: Test timed out in 12000ms.

### `tests/server/g2-4a-forge-timeout.test.ts`

- G2-4a: the forge popup across a reconnect a resumed seat gets the same forge popup and the unchanged deadline, and can still pick — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/g2-4b-support-forge-room.test.ts`

- G2-4b: the support anvil across a reconnect a resumed seat gets the same support popup and the unchanged deadline, and can still pick — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/little-legends.test.ts`

- little legends: over the wire shows every seat the legend another player picked — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/projection-wire.test.ts`

- B7 private seat view on every state path sends only the private view: first snapshot, increments, resume snapshot and the fault snapshot — Error: listen EPERM: operation not permitted 127.0.0.1

- B7 private seat view on every state path keeps the fault snapshot projected — Error: listen EPERM: operation not permitted 127.0.0.1

- B7 compact replay sends each battle once as the room's own replay and never as combat frames (C6) — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/v17-avarice-reconnect.test.ts`

- v17 avarice: reconnect during and after a live battle a seat that left and came back is shown the settled live replay and settles once — Error: listen EPERM: operation not permitted 127.0.0.1

### 待执行/跳过项（保留首次报告状态）

`tests/g2-4b-unstable-chest.test.ts`

- G2-4b chest restore rejects forged grants accepts the genuine grants

- G2-4b chest restore rejects forged grants rejects an item outside the pool

- G2-4b chest restore rejects forged grants rejects a future tick

- G2-4b chest restore rejects forged grants rejects a different tick from its siblings

- G2-4b chest restore rejects forged grants rejects a duplicated ordinal

- G2-4b chest restore rejects forged grants rejects a fifth grant

- G2-4b chest restore rejects forged grants rejects a second grant to one receiver

- G2-4b chest restore rejects forged grants rejects an enemy receiver

- G2-4b chest restore rejects forged grants rejects a living holder

- G2-4b chest restore rejects forged grants rejects an unfired chest

- G2-4b chest restore rejects forged grants rejects an extra field

- G2-4b chest restore rejects forged grants a Match save whose unit claims an item it never received is rejected

- G2-4b chest restore rejects forged grants a Match save with not an array as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with a null record as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with an item outside the pool as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with an unknown item as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with a missing chest as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with a text ordinal as combat item grants is an invalid save

- G2-4b chest restore rejects forged grants a Match save with a fractional tick as combat item grants is an invalid save

`tests/t12-combat-equip.test.ts`

- T12 supply choice input T12 supply choice permits fresh component transactions and single-save continuation

## 分片 4/4

### `tests/epic-loot-reforger.test.ts`

- v17 epic rewards and unified consumables uses exact approved zh_cn names and rejects v15 state identities without migration — AssertionError: expected 's13-g2-3-v20' to be 's13-g2-3-v19' // Object.is equality

### `tests/g2-4b-pr161-restore.test.ts`

- cold Node processes restore actual canonical saves for tiers4/10/14 with the same claims and pending choice — AssertionError: expected Error: spawnSync /opt/node-v24.21.0-linux… { …(5) } to be undefined

### `tests/m6-persistence.test.ts`

- M6 seed and file boundaries rejects outer corruption before history {"saveFormatVersion":6} — Error: promise resolved "{ kind: 'hex-autobattler-save', …(7) }" instead of rejecting

- M6 seed and file boundaries rejects outer corruption before history {"replayFormatVersion":5} — Error: promise resolved "{ kind: 'hex-autobattler-save', …(7) }" instead of rejecting

### `tests/server/net/combat-stream-wire.test.ts`

- NET6 combat stream opens before resolution, streams contiguous frames, resumes a cursor and reuses the same source for watch — Error: listen EPERM: operation not permitted 127.0.0.1

- NET6 combat stream a backpressured socket is terminated while the room and other seats continue — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/server.test.ts`

- game server: visibility shows the other seat its level and HP changes but never its shop or private state — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: rejections leave the room untouched refuses forged seats, uploaded gold, wrong protocol, wrong types and stale versions — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: commandId dedupe executes a repeated commandId once and refuses the same id with other content — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: commandId dedupe refuses an id that fell out of the retention window and demands a resync — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: disconnect and resume returns a dropped seat to its owner by token, snapshot before increments, and disarms the old socket — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: disconnect and resume G1-P6: a resumed seat gets the same opponent candidates in preparation and fights one of them — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: disconnect and resume drops a queued player that disconnects before the match and frees the seat — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: queue refuses the ninth join with "full" and leaves the queue at eight — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: queue refuses a join while a match runs and lets a new queue form after it ends — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: single writer runs 50 pipelined commands strictly in arrival order with no interleaving — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: connection limits closes a connection that sends an oversized frame — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: connection limits rate-limits a connection on the room clock and accepts again in the next window — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: whole match over the wire drives two clients from the queue to a full ranking with replays on the manual clock — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/takeover.test.ts`

- game server: no takeover by default (P2) keeps a disconnected seat human-controlled long after the old takeover delay; resume is a plain reconnect — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: bot takeover of a disconnected seat when switched on (B6) shows the takeover to everyone after takeoverMs and hands the seat back on resume with reclaimed=true — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: bot takeover of a disconnected seat when switched on (B6) a resume before takeoverMs is a plain reconnect: no takeover, no reclaimed flag — Error: listen EPERM: operation not permitted 127.0.0.1

## 首次分片后的修正

版本断言与存档未来版本测试已更新至v20；4文件、120项定向复核通过，包含先前未附具体错误的宝箱文件。首次分片统计未被覆写，详见 [phase1-validation.md](phase1-validation.md)。

## 第1/4单worker补跑（保留首次exit137）

命令：`npm test -- --shard=1/4 --maxWorkers=1 --reporter=json --outputFile=artifacts/v20-phase1/shard-1-serial.json`。耗时637.96秒，1382通过 / 15失败 / 0待执行，exit 1。15项失败均为listen EPERM，没有放宽超时或跳过测试。

### `tests/server/g2-4b-artifact-forge-room.test.ts`

- G2-4b: the artifact anvil across a reconnect a resumed seat gets the same artifact popup and the unchanged deadline, and can still pick — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/lifecycle.test.ts`

- B8 lifecycle: the network server across matches keeps connections, credentials, dedupe windows and timers at the same baseline after each of five matches — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/replay-first-pass.test.ts`

- game server: spot check logs a mismatch with its battle, seed and first difference, keeps settling, and checks every later battle — Error: listen EPERM: operation not permitted 127.0.0.1

- game server: spot check checks every Nth round that captured a battle (the 1st, N+1th …), one battle each, and nothing in between — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/heartbeat.test.ts`

- server heartbeat options starts no heartbeat timer when listening fails — Error: listen EPERM: operation not permitted 127.0.0.1

- server heartbeat sends nothing extra when the option is off — Error: listen EPERM: operation not permitted 127.0.0.1

- server heartbeat keeps answering peers connected and sends them a heartbeat every interval — Error: listen EPERM: operation not permitted 127.0.0.1

- server heartbeat drops a seated peer that went silent, keeps its seat, and lets the token resume it — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/live-bank-wire.test.ts`

- D11 live bank: replay-tail on the wire streams the changed records of a live battle to its seat and ends on the settled battle — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/server-close.test.ts`

- server close and failed start cancels the delayed close of a superseded connection when the server closes — Error: listen EPERM: operation not permitted 127.0.0.1

- server close and failed start rejects a start on a taken port after releasing its lobby and WebSocketServer — Error: listen EPERM: operation not permitted 127.0.0.1

### `tests/server/net/slow-task.test.ts`

- task.slow pending-window reports logs the first slow task immediately and ignores a fast task before expiry — Error: listen EPERM: operation not permitted 127.0.0.1

- task.slow pending-window reports flushes count, maximum and latest slow duration on a fast task at window expiry, only once — Error: listen EPERM: operation not permitted 127.0.0.1

- task.slow pending-window reports flushes an idle pending batch using only the loop.lag timer — Error: listen EPERM: operation not permitted 127.0.0.1

- task.slow pending-window reports flushes the unexpired pending batch on close and cancels all timers — Error: listen EPERM: operation not permitted 127.0.0.1
