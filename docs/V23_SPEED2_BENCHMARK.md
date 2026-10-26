# v23 server 测量数据（2026-10-25）

基线：`codex/v23-speed2`，HEAD `87a013f1`。未提交。规则、数值、保存格式、生产服务器及界面代码均未修改。

基线要求的命令先因只读 `node_modules/.vite-temp` 返回 EROFS；随后使用相同仓库配置与 `--configLoader runner` 完成：

```sh
export PATH=$HOME/.local/bin:$PATH
npx vitest run tests/server --configLoader runner --reporter=json --outputFile=/tmp/srv.json
```

基线为 565 项：490 通过、42 失败、33 未执行。没有运行全套测试。改后仅运行指定文件及修改代码的覆盖文件，通常 `--maxWorkers=1/2`。基线自动使用 32 worker，期间宿主负载曾超过 120，复测时负载逐步下降；下表用于确认单例预算与断言覆盖，不能据此计算纯 CPU 加速倍数。

## 最慢十项：改前/改后（秒）

改后“最慢分段”包括整条路线的初始化、逐回合/续调、所有原断言及末尾哈希；“原名终点”仅为最后续跑检查。近零的终点耗时不代表整局不再计算。功能分段使用 Vitest 默认 5 秒，未新增超时。机器人原来的 60/120 秒墙钟门槛和测试保持原样。

| # | 原用例（文件及完整标题） | 改前 | 改前结果 | 改后最慢分段 | 原名终点 | 改后结果 |
| --- | --- | ---: | --- | ---: | ---: | --- |
| 1 | `tests/server/net/settlement-queue-full-match-streamed.test.ts`<br>finishes deterministically with eight bot controllers and continuous authenticated human traffic (streaming=true) | 1335.532 | 失败 | 3.156 | 0.005 | 通过 |
| 2 | `tests/server/net/settlement-queue-full-match-legacy.test.ts`<br>finishes deterministically with eight bot controllers and continuous authenticated human traffic (streaming=false) | 625.233 | 失败 | 1.353 | 0.001 | 通过 |
| 3 | `tests/server/net/v17-avarice-reconnect.test.ts`<br>a seat that left and came back is shown the settled live replay and settles once | 241.668 | 失败 | 2.526 | 0.000 | 通过 |
| 4 | `tests/server/net/server-whole-match.test.ts`<br>drives two clients from the queue to a full ranking with replays on the manual clock | 235.280 | 失败 | 3.636 | 1.411 | 通过 |
| 5 | `tests/server/bot-driver-timing.test.ts`<br>plays eight bots from the first round to a unique ranking; every intention is accepted by the rules | 219.109 | 失败 | 83.377 | 83.377 | 1 项失败 |
| 6 | `tests/server/v17-avarice-earnings.test.ts`<br>the room samples only the bank; the rules add the team's earnings once; the settlement pays them once | 163.456 | 通过 | 2.574 | 0.000 | 通过 |
| 7 | `tests/server/v17-avarice-battle-end-frozen.test.ts`<br>exactly at the frozen end, or past it, the change is not sampled and the frozen battle settles; no fault | 150.562 | 通过 | 0.890 | 0.000 | 通过 |
| 8 | `tests/server/local-room-client-full-match.test.ts`<br>plays the room from the first preparation to the final ranking, pushing one replay per battle round | 142.340 | 失败 | 1.674 | 0.008 | 通过 |
| 9 | `tests/server/bot-driver-timing.test.ts`<br>plays one idle human and seven bots through the lobby to a unique ranking; the human seat is never driven | 106.420 | 通过 | 68.348 | 68.348 | 通过 |
| 10 | `tests/server/v17-avarice-pvp.test.ts`<br>a mirror battle samples its real seat A and never the frozen copy's side | 104.958 | 通过 | 3.328 | 0.000 | 通过 |

## 授权证据与开战切片

`g23-grant-evidence.test.ts` 改前 `beforeAll` 在 30,000 ms 超时，15 条原断言均未执行，因此改前逐例耗时不能填写为 0。改后路线各文件只构建一次，按回合和 300 tick 段继续；hook 只取缓存终点并选择 armory，不再构建长路线。hook 未单独计时。

| 原证据用例 | 改前 | 改后 ms | 结果 |
| --- | --- | ---: | --- |
| public commands record a legal armory receipt; selling its holder later retains grant-time authority | hook 超时，未执行 | 182.814 | 通过 |
| rejects a junker unitId that disagrees with the holder reconstructed at selection | hook 超时，未执行 | 68.408 | 通过 |
| rejects titan on a non-three-star holder even when both receipts agree | hook 超时，未执行 | 65.302 | 通过 |
| rejects a paid option outside the seed-derived menu even when generic and mechanic receipts agree | hook 超时，未执行 | 131.940 | 通过 |
| rejects omitted evidence and forged ownership/star/resource/economy prefixes | hook 超时，未执行 | 530.992 | 通过 |
| public Academy3 grant restores from its historical deployment after members are sold | hook 超时，未执行 | 126.774 | 通过 |
| rejects an Academy receipt whose grant-time deployment cannot qualify | hook 超时，未执行 | 55.521 | 通过 |
| source cannot opt an Academy receipt out of its dedicated validation | hook 超时，未执行 | 52.491 | 通过 |
| the frozen combat purchase cannot substitute another unitId for the validated selection | hook 超时，未执行 | 313.103 | 通过 |
| Academy3/4/5 each binds its own pre-grant birth boundary and qualifying deployment | hook 超时，未执行 | 56.070 | 通过 |
| rejects forged grant evidence extra snapshot without mutating either save entry | hook 超时，未执行 | 135.894 | 通过 |
| rejects forged grant evidence identity without mutating either save entry | hook 超时，未执行 | 129.117 | 通过 |
| rejects forged grant evidence round without mutating either save entry | hook 超时，未执行 | 111.914 | 通过 |
| rejects forged grant evidence level without mutating either save entry | hook 超时，未执行 | 110.258 | 通过 |
| rejects forged grant evidence deployment collision without mutating either save entry | hook 超时，未执行 | 142.913 | 通过 |

改后总计 272 项全部通过；257 个路线/终点用例中最慢 2.582 秒。所有原恢复入口、授权证据和拒绝原因断言保留。

开战切片通过已有 `sliceNow` 注入每次读取推进 0.1 ms 的预算源，房间时间仍由 `ManualClock` 驱动。两处原 100 次续调上限以及 2/8/20 ms 子步骤边界断言均保留。新增 fresh public room 的两次初始化次数相等检查已通过。

旧 `battle-start.json` 的 11 项仍失败：检查点 3/9/23 均为摘要 `fnv1a32-utf16:1b4978e8`，当前冻结常量为 `fnv1a32-utf16:e0b6bb65`；同时三者的冻结掉落账本验证均返回 false，因此会出现 `invalid-seat-state`，不能只归为直接的 content-digest 报错。未修改夹具、摘要、版本、断言或记录脚本；须由另行重录工作消除。

## 文件证据

- `tests/server/net/settlement-queue-harness.ts:45`：独立保存完整机器人调用记录，避开 Vitest 跨用例清空 mock.calls；`:89` 保留终局、八席、命令收据断言；`:100` 逐检查点更新同一账本哈希；`:113` 两次独立运行续调与完整证据比较。
- `tests/server/slow-route.ts:10`：完整输入/共享池键与文件内解析结果缓存；`:33` 保留原 runNext 分组；`:55` 分段注册与统一清理。`tests/server/avarice-route.ts:10`：真实公开命令前缀。
- `tests/server/route-clock.test.ts:5`：同时间、嵌套、取消及过期计时器与原 ManualClock 分组逐项比较。
- `tests/server/local-room-client-helper.ts:36`：缓存整局、保留 6000 次分组上限及原微任务发布边界。`tests/server/net/server-whole-match.test.ts:8`：缓存真实连接对，保留 2000 次分组上限。
- `tests/restore-audit/g23-grant-evidence.test.ts:12`：两条公开路线缓存与 300 tick 分段；`:23` 轻量 hook；`:33` 起原断言保留。`scripts/generate-m5-route.cjs:24`：可选暂停接口，未传回调的现有路径不变。
- `tests/server/battle-start-slices.test.ts:20`：确定性预算；`:32` 原 100 次上限；`:47` fresh public room 检查。
- `docs/S13_RULES_GAP.md`：2026-10-25 的 P 工程约定。

## 最终验证记录

每行只统计“覆盖”列列出的最终文件；同一原始报告中的其他文件取后续复测结果，不把已修复的中间失败计作最终失败。

| 报告 | 覆盖 | 通过 | 失败 | 未执行 |
| --- | --- | ---: | ---: | ---: |
| `/tmp/busy-verified.json` | 高流量 streaming/legacy | 11522 | 0 | 0 |
| `/tmp/avarice-final.json` | v17 四文件及本地整局 | 10567 | 0 | 0 |
| `/tmp/other-final.json` | 网络整局、netcode hooks、本地基础 | 1116 | 0 | 0 |
| `/tmp/final-segments.json` | 授权证据 | 272 | 0 | 0 |
| `/tmp/small-final.json` | 开战切片、本地基础、时钟分组 | 8 | 11 | 0 |
| `/tmp/bot-timing-isolated.json` | 原机器人墙钟门槛（其余测试全部结束后单独运行） | 1 | 1 | 0 |

机器人文件在与复测并行时为：八机器人 94.295 秒（60 秒门槛失败），七机器人加闲置人类 76.553 秒（120 秒门槛通过）；上表另列其他测试全部退出后的单独复测，未设置 CI_WALLCLOCK_GATES=report。


仍未完成：八机器人真实整局墙钟检查在完全单独运行时为 83.377 秒，超过原 60 秒门槛；该文件和墙钟断言均未修改，也未使用报告模式绕过。需要实际性能优化或独占性能 runner 复核，不能靠拆段后少计工作或提高门槛验绿。旧切片夹具另有前述 11 项不匹配。

`npm run typecheck` 已通过；`git diff --check` 已通过。禁止修改的内容身份、版本、证据/回放夹具、在线规则记录脚本、CI、生产服务器、界面目录均未改动。没有提交。
