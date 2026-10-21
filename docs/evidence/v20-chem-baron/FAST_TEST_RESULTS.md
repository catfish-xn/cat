# v20-chem-baron 第二次同步 fast 四分片结果

基线 `ce60a8b9dd2b0c3a0c34c527405d44939233fb5b`（v20-traits），Node 24.21.0。每批两片、每片一个 worker；四片均完整执行，未过滤用例、未改超时、未加载预加载器。首次四片并发因可用内存仅 175 MiB 主动中止，其日志不计入完整结果。

```bash
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --shard=i/4 --maxWorkers=1 --reporter=default --reporter=json --outputFile=artifacts/v20-chem-baron-sync2/shard-i.json
```

`i=1..4`；原始日志和 JSON 均在忽略目录 `artifacts/v20-chem-baron-sync2/`。每片退出码均为 1。

| 分片 | 文件 | 通过 | 失败 | 跳过 | 秒 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 122 | 1419 | 15 | 0 | 684.67 |
| 2 | 121 | 1611 | 5 | 0 | 1059.97 |
| 3 | 121 | 1822 | 16 | 0 | 1511.4 |
| 4 | 121 | 1532 | 17 | 0 | 706.84 |

合计 **485 文件，6384 通过、53 失败、0 跳过**；19 文件报告失败。53 项均有明确环境错误：46 项 `listen EPERM 127.0.0.1`、7 项同步子进程管道 EPERM（回放验收 4、压力测量 2、冷进程恢复 1）。本次完整四片无计时失败、无规则断言失败，也未出现 hook 阻塞。完整名称与错误见 [机器清单](fast-failures.json)。

## 环境复核与真实门槛

冷进程恢复：普通文件描述符捕获后，原 4/10/14 档存档与同一断言、原时限单跑 1/1 通过，10 项未选择；不覆盖原分片失败。回放验收内层异步管道和真实网络用例仍受环境限制，未计为通过。

**继承的真实性能门槛未通过**：独立 Git 基线/当前源码 bundle、测量子进程无预加载器，父 v20-traits RSS 282868 KiB、当前 284088 KiB，均超过 262144 KiB。AP 301 个（100–700）、AD 271 个，两者计算结果一致，耗时 45.6/49.2 ms。正确性与耗时通过，RSS 门槛不能计为通过；这不是本次新出现的玩法差异。见 [同条件比较](sync2-memory-comparison.json)。

U6 公共路线的 34 场战斗历史、存档、两英雄容量等待与 Gangplank 终局保留预检通过；监听 EPERM 阻断全部 DOM 断言，U6 仍未通过。

## 失败文件

| 文件 | 失败数 | 分类 |
| --- | ---: | --- |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2 | 子进程管道 EPERM |
| `tests/g2-4b-pr161-restore.test.ts` | 1 | 子进程管道 EPERM |
| `tests/server/e2e-replay-errors.test.ts` | 4 | 子进程管道 EPERM |
| `tests/server/g2-4a-forge-timeout.test.ts` | 1 | 监听 EPERM |
| `tests/server/g2-4b-artifact-forge-room.test.ts` | 1 | 监听 EPERM |
| `tests/server/g2-4b-support-forge-room.test.ts` | 1 | 监听 EPERM |
| `tests/server/legend-walk.test.ts` | 1 | 监听 EPERM |
| `tests/server/lifecycle.test.ts` | 1 | 监听 EPERM |
| `tests/server/little-legends.test.ts` | 1 | 监听 EPERM |
| `tests/server/net/heartbeat.test.ts` | 4 | 监听 EPERM |
| `tests/server/net/live-bank-wire.test.ts` | 1 | 监听 EPERM |
| `tests/server/net/server-close.test.ts` | 2 | 监听 EPERM |
| `tests/server/net/server.test.ts` | 13 | 监听 EPERM |
| `tests/server/net/slow-task.test.ts` | 4 | 监听 EPERM |
| `tests/server/net/takeover.test.ts` | 3 | 监听 EPERM |
| `tests/server/net/v17-avarice-reconnect.test.ts` | 1 | 监听 EPERM |
| `tests/server/net/watch.test.ts` | 7 | 监听 EPERM |
| `tests/server/projection-wire.test.ts` | 3 | 监听 EPERM |
| `tests/server/replay-first-pass.test.ts` | 2 | 监听 EPERM |
