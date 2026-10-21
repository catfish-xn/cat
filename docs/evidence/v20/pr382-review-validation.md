# PR #382 评审修订验证（2026-10-22）

工作区分支 `codex/live-combat-stream`，HEAD 仍为 `fe746292`；修改未提交、未 push、未联网。

## 合流边界

- 本地 `origin/multiplayer=14006984`，因此无法宣称已取得最新上游。其他本地对象可读到 #376（`ed7346ba`）、#370、#380（`6b361334`），未找到 #381。
- 根工作区 `git merge` 被只读 Git 元数据拒绝：无法写 `ORIG_HEAD.lock`。遵守不联网约束，未执行 fetch。
- `/tmp/equip-pr382-review` 是不联网建立的临时本地副本。先演练已有上游，再按 #376 解决 `messages.ts` 的 WatchMessage 以及 `server.ts` 的连接初始化/重置冲突；结果与本次修订的临时合流提交为 `462b2e21`，仅存在 /tmp。
- 根工作区只写授权目录中的 #376 接收/观战接线和修订。完整最新 multiplayer（含 #381）仍待取得上游后合并，未搬入其他目录的视觉变更。

## 实现范围

- 每连接独立本人/观战游标；open/end 及每条增量标明 seatId/watch。每拍两条增量合在一个 `combat-chunk.chunks` 包中，观战只调用 watched → session.watchReplay，不进入本人的 finished/lastBattle。
- resume 独立带 combat/watchCombat/watchSeatId；切换观战不重置本人游标。watch 回执、pending 清理、连接 epoch 校验两端一致。旧 watch-replay/watch-tail 路径不存在。
- 绝对时刻排拍，最多连续补两拍后让出 tick；计算预算仍按步骤切片，整拍完成后统一通知。客户端四拍/200ms 缓冲，前沿不清零时间余额；end 释放最后四拍；服务器尾段至少 800ms。
- PvE state 汇集拍末，state/流通知在服务器合为一次连接遍历；缓存每席 view，unitIds 建流时计算；仅结算基础变化时重规划；1MiB 背压终止前记录一行 warn。
- simulation 规则、数值、随机次序未修改。本次未重录 epoch，未运行录制脚本，未改 epoch/golden/digest 文件。

## 验证

| 命令/范围 | 结果 |
| --- | --- |
| `npm test -- tests/server/combat-stream-client.test.ts tests/server/combat-stream.test.ts tests/server/net/combat-stream-memory.test.ts tests/server/replay-client.test.ts tests/server/net/watch.test.ts` | 5 文件、32 项通过。含三种 seed、各五轮的旧整轮/新流式战斗、账本、伤害、录像逐字节一致。 |
| `npm test -- tests/server/live-bank.test.ts tests/server/local-room-client.test.ts tests/server/net/messages.test.ts tests/server/net/dedupe.test.ts` | 匹配的 3 文件、19 项通过。 |
| `npm test -- tests/server/net/combat-stream-memory.test.ts` | 7 项通过；最终补强了抖动接收至结算前完整播放的事件相等断言。 |
| `npm test -- tests/server/combat-stream.test.ts tests/server/net/combat-stream-memory.test.ts` | 最后调度边界/守恒检查后重跑，2 文件、17 项通过。 |
| `npm run typecheck` | 通过（退出码 0）；提交前需在实际最新上游基线上再跑。 |
| `git diff --check` | 通过。工作区只有授权的代码、测试、文档，没有素材或生成物。 |
| `tests/server/net/combat-stream-wire.test.ts` | 2 项因沙箱禁止监听 `127.0.0.1` 而报 `listen EPERM`，未能完成真实端口验收；生产服务器的单写队列、推送、双流恢复、背压和客户端完整播放已由内存传输测试覆盖。 |

epoch 仍是临时版本，等待 #373/#379 合入后再统一录制。本轮没有把版本差异写回旧 golden。
