# F3：服务器战斗时序与观战流排查

基线：`claude/sol-final @ e3b78cb3`，包含指定的 `97068956`。未执行 Git 写操作。

## T10：准备阶段采样先于战斗截止点

`tests/server/t10-combat-ops.test.ts` 的 deferred merge 案例使用 seed 1。
第五批强化历史接线后，`Room.scheduleAugmentClock` 在准备阶段也会安排采样，
`ManualClock.runNext()` 的含义是触发最早的定时器，并非结束当前阶段。

无端口 Room 探针观察到：第 5 回合准备开始于逻辑时间 127900 ms，
历史采样在 127950 ms，准备截止在 128900 ms；第一次 `runNext()` 后仍是 preparation，
到真正截止点正常进入第 5 回合 battle，fault 为 null。不是回合提前结束或没有战斗。

修复只将该案例的推进改为 `clock.advance(room.state.deadlineAt! - clock.now())`。
保留 battle、延迟合成、棋盘副本存活及升级事件的全部断言，未变更种子、规则或时长配置。

## Watch：相同前缀截短预测回放生成空尾包

`src/server/net/server.ts` 的 `pushLive` 对本人和观战均调用
`src/server/room/live-bank.ts` 的 `replayTail`。
第一次 live 修订可能只截掉预测未来，已产生的 live 帧与预测前缀完全相同。
旧实现比较到 `next.ticks.length` 后返回 `ticks: []`，违反现有 watch 测试的非空尾包断言。
这是服务器回放消息构造的边界缺陷，不是未进入战斗或观战绑定失败。

无端口探针复用 watch 的 8 个 human 席位（seat-1…seat-8）、seed 42、net-room、
TwoSidedBattleResolver 与测试时长；在第 5 回合准备时给各席首个棋盘单位绑定 avarice-incarnate，
进入战斗后推进 400 ms，给首场 PvP 的 B 席买 XP，再逐次推进 200 ms。
开场有 2 个单位，冻结终战 tick 410；旧实现首尾包为 `fromTick: 21, ticks.length: 0`，
之后仍有直播修订，最后正常到 settlement。修复后首尾包为 `fromTick: 20, ticks.length: 1`。

最小源码修复：当比较游标位于新前缀末端时回退一条记录，以末条权威帧携带截短或终态修订。
客户端仍按 `旧帧.slice(0, fromTick) + ticks` 拼接，得到的回放完全等于 next；
相同回放仍返回 null，追加或已有帧发生差异的路径保持原行为。本人和 B 视角观战共用此修复。
未新增时钟/定时器 API，未改网络版本、游戏数值或模拟层。

新增 `tests/server/replay-tail.test.ts`：覆盖相同前缀截短、后续连续追加、仅终态修订、相同替换不推送；
修复前两个案例均因空 ticks 失败。夹具仅是合成的公开回放结构，不含录制或原版数据。

## 验证及执行端复跑

沙盒内运行 watch 文件在监听 `127.0.0.1` 时被 `listen EPERM` 阻止，网络行为尚待执行端验收。
原 watch 文件及其所有断言均未修改。执行端在沙盒外运行：

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 tests/server/t10-combat-ops.test.ts tests/server/net/watch.test.ts tests/server/replay-tail.test.ts tests/server/live-bank.test.ts
npm run typecheck
```

其中两个原始目标文件为必验项；另两个文件检查新增边界案例及既有 live bank / 客户端拼接行为。
watch 原目标案例应完整检查 B 视角镜像、非空连续 tails、本人相同 tails、最终回放、连接清理，
不能以无端口探针替代网络验收，也不应删除断言或放宽超时。

沙盒内最终结果：T10 10/10、live-bank 7/7、新增 replay-tail 2/2 通过；watch 的协议解析案例通过，
其余 7 个网络案例受监听权限阻止（Vitest 报 5 failed、2 skipped，两个 fixture 的 beforeAll 也报 EPERM）。
四文件合计 20 passed、5 failed、2 skipped；失败均为 listen EPERM。`tsc --noEmit` 通过。
无端口探针验证了 99 次尾包均非空、fromTick 不倒退、帧连续且无缺失前缀，
拼接结果逐次等于目标回放、最终等于 Room 发布的 live 终局回放，末帧 tick 等于 terminal.tick，fault 为 null。
`git diff --check` 通过；唯一改动的 src 文件为 `src/server/room/live-bank.ts`。
