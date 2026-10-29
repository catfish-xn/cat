# 联机慢测试余量

只覆盖联机路径：`tests/server/**`，以及仓库根下文件名含 `room` / `online` 的 Vitest 用例。单机用例不在本单。超时不放宽、不删除、不跳过，不减少种子或场次，不改 `src/`。

## 测量方式

- 环境：本机 Linux，Node 22.23.4，Vitest 5.0.3（`npm test` 的 `fast` 项目，以及 `timing` 项目）。
- 用例耗时取 Vitest `diagnostic().duration`；超时取该用例的 `options.timeout`，未写则是 Vitest 默认 **5 000 ms**。
- 钩子默认上限 **10 000 ms**。源码里写成 `beforeAll(fn, 20_000)` 这类显式上限的，按那个数的 50% 判断。
- 靠近上限的用例用 **`maxWorkers=1`、同一命令连跑 3 次、取中位数**。`timing` 项目本身就是单 worker、文件串行。
- 普查先用 `maxWorkers=3` 扫一遍（CPU 争用会把耗时抬高）。这一遍里不超过 50% 的，单独跑只会更短，不再逐条做 3 次。
- 同步钩子在主进程 reporter 里经常是 0 ms：worker 把开始和结束两条消息一起送出。因此对「文件总耗时 − 用例耗时之和 > 5 s」的文件，在 worker 里包了一层 `callSuiteHook`（只改 `node_modules`，不进提交）再计每个钩子。钩子只跑了这一次；离 50% 都还远，没有做 3 次中位数。

默认测试上限 5 s 的 50% 是 2.5 s；10 s 钩子是 5 s；20 s 是 10 s；60 s 是 30 s。

## 超过 50% 并已提速

| 用例 | 超时 | 改前三次 | 改前中位数 | 改后三次 | 改后中位数 | 改法 |
| --- | ---: | --- | ---: | --- | ---: | --- |
| `tests/server/bot-driver-timing.test.ts` › BotDriver: whole matches › plays eight bots from the first round to a unique ranking; every intention is accepted by the rules | 60 000 ms | 30 361 / 30 602 / 30 908 ms | **30 602 ms（51.0%）** | 29 288 / 29 382 / 29 414 ms | **29 382 ms（49.0%）** | 关掉房间「每次发布都做」的卡池全量守恒（`assertPoolConservation: false`）。同一条 `assertSharedPoolConservation` 改到每个回合边界（`settlements` 变长）和终局再做，并核对 `poolRevision`。命令种类、拒绝、等级、星级、排名和 60 s 墙钟断言都保留。 |

改前、改后都是：

```text
npx vitest run --project timing --maxWorkers=1 tests/server/bot-driver-timing.test.ts -t "plays eight bots from the first round"
```

只滤到这一条（同文件另一条整局被跳过）。改完后再跑过整个 `bot-driver-timing.test.ts`（2 条都过）和 `tests/server/bot-driver.test.ts`。

余量大约 0.6 s。三次改后结果落在 29.3–29.4 s，没有一次越过 30 s。再往下就是战斗模拟本身，见文末，没有改 `src/`。

## 普查里没过线的

`fast` 项目一次 `maxWorkers=3` 扫了 156 个文件、23 948 条用例，全部通过。争用下仍超过自身上限 40% 的只有这些（上限都是默认 5 000 ms）：

| 用例 | 争用下一次 | 单独 `maxWorkers=1` 三次中位数 | 结论 |
| --- | ---: | ---: | --- |
| `batch5-dual-purpose-room.test.ts` › buyXp … in settlement | 2 564 ms（51.3%） | 1 667 / 1 808 / 1 669 → **1 669 ms（33.4%）** | 争用抬高，单独跑低于 50%，未改 |
| `batch5-h9-cabal-room.test.ts` › streaming=false round 17 | 2 250 ms（45.0%） | 未再跑（争用已低于 50%） | 禁止改动的文件 |
| `net/settlement-queue-full-match-streamed.test.ts` › run 2 toward round 33 | 2 239 ms（44.8%） | 同上 | 禁止改动的文件 |
| `augment-pool-batch5-r1-room.test.ts` › tomb-raider-1 reaches 4-… | 2 195 ms（43.9%，第一次普查） | 同上 | 禁止改动的文件 |

显式 20 s / 60 s / 90 s / 120 s 的长用例，最长的一条是 `v17-avarice-draw.test.ts` 的整段路线 10 645 / 120 000 ms（8.9%）。`timing` 项目里另一条八人机器人（1 名人类 + 7 机器人）是 27 776 / 120 000 ms（23.1%），整局提交那条是 6 985 / 60 000 ms（11.6%）。

钩子：worker 内实测超过 2 s 的只有

| 钩子 | 耗时 | 该钩子上限 | 占上限 |
| --- | ---: | ---: | ---: |
| `carousel-room.test.ts` › a whole carousel match 的 `beforeAll` | 15 440 ms | 120 000 ms | 12.9% |
| `lifecycle.test.ts` › B8 sliced resolution 的 `beforeAll` | 3 210 ms | 20 000 ms | 16.1% |
| `carousel-room.test.ts` › P7-1 2-4 carousel 的 `beforeAll` | 2 491 ms | 60 000 ms | 4.2% |
| `augment-pool-batch5-h12-max-cap-online.test.ts` 的 `beforeAll` | 2 028 ms | 10 000 ms（默认） | 20.3% |

没有钩子超过自身上限的 50%。`lifecycle.test.ts` 里另外两个走到 2-1 准备期的 `beforeAll`（上限同样 20 s）分别约 2.2 s 和 1.6 s。

## 不在本单范围

- `tests/m8-b8-live-transfer.test.ts`：单机用例，文件头把 `testTimeout` 设为 20 000 ms。另有执行端专门提速它。本单没有读它来改、也没有改它。

## 本单没有改的禁止文件

这些文件即使偏慢也不动：`tests/server/augment-pool-batch5-r1-room.test.ts`、`tests/server/batch5-h9-cabal-room.test.ts`、`tests/augment-pool-batch5-s6c-room.test.ts`、`tests/server/net/settlement-queue*.ts`（含 harness）、`tests/rumble-shop-layout.test.ts`（界面浏览器测试，不是对局模拟）、`tests/fixtures/m5/h3-growth-oracle.cjs`。上面表格里出现过的，争用下也没有超过 50%。

## `src/` 慢点（未改）

八人机器人整局剩下的约 29 s，主要在战斗模拟，不在测试脚手架。用 `node --cpu-prof` 跑了一条与该用例相同的八机器人 `ManualClock` 路线（esbuild 打成单文件，来回两遍，采样合计 51.4 s）。下面是含调用栈的占比，子项互相包含，不能相加：

| 函数 | 位置 | 约占采样 | 原因 |
| --- | --- | ---: | --- |
| `advanceS13Tick` | `src/simulation/combat-s13.ts` | 56% | 每 tick 的 S13 战斗步进，整局战斗的主体 |
| `copyCombatUnitForTick` | `src/simulation/combat-static.ts` | 10% | 每个 tick 复制战斗单位，算在上面的步进里面 |
| `assertSharedPoolConservation` | `src/simulation/shared-pool-ledger.ts`，由 `src/server/room/room.ts` 的 `assertConserved` 在每次发布时调用 | 11%（房间默认每次发布都查时） | 八人状态的全量卡池守恒。测试已改成只在回合边界查；函数本身没改 |
| `BotDriver.enqueue` | `src/server/room/bot-driver.ts` | 10% | 机器人每步排队执行 |

这些都是对局规则或服务器编排。本单没有改 `src/`。
