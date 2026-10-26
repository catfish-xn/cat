# 第 5 阶段后卡顿测量（2026-10-27）

基线：`codex/stage5-lag`，HEAD `30690fe3717d1b267c3966f1e001ae75cf9d2475`。工作区起初干净；未提交、未写 Git 元数据。最终唯一产品修改是 `src/simulation/combat-summary.ts` 的离场单位空值处理，另加回归测试及合同说明。没有改玩法、时钟步长、资源、RNG、内容版本或 digest，没有删断言或提高测试时限。

## 结论

1. **有一个会被误认为“卡住”的确定性异常，已最小修复。** seed 42 的 5-1，tick 293 三个迷你召唤物离场，`summarizeBattle` 对不存在于当前 roster 的单位读取 `.alive`，经在线实时排行抛异常。2D、3D 各两次都停在该 tick；此后 rAF 仍能继续，不能把其“变快”的帧间隔当作优化。修复保留原统计行及贡献，把已离场单位的 `alive` 设为 false。修复后相同回放正常越过 tick 293。
2. **2D 的主要客户端热点是 DOM 飘字。** 同一机器、修复异常后，2-5 → 5-1 的战斗帧 p95 从 83.4 → 166.6 ms；回放应用 p95 约 0.2 ms。`renderFeedback` 中反复写文字、读尺寸产生布局计算，远大于回放 reducer 的成本。
3. **服务器后期每场战斗 tick 的成本确实增加。** 切片已经存在：初始化采用最多 5 ms 的协作预算，战斗及结算采用 20 ms；它们不能抢占单个规则事务、投影或 GC。后期慢回调不能简单归结为“没有切片”。
4. **真实 3D 在本机受软件渲染环境限制。** Chrome 使用 SwiftShader；2-5 与 5-1 战斗都约 183 ms 的帧中位数，不能由此推断玩家硬件 GPU 的帧率或把所有差值归为 JS。占位 3D 和真实素材样本分别保留。

## 方法与边界

- Node v22.23.4，Chromium 156.0.8078.47，Linux / Intel Xeon Skylake IBRS；容器可见 32 CPU，按用户给定的共享 24 核预算执行。Vitest `--maxWorkers=4`；测量时单个 Node 对局进程或单个浏览器负载串行运行，不并行跑浏览器。共享机器未独占，极值不代表硬实时保证。
- 服务器沿用 `tests/server/bench/late-game.ts`、`replay-cpu.ts`、`RoundPerf` 的观测方式，新增 `scripts/stage5-lag-server.ts`。真实 `Room`、`BotDriver`、`TwoSidedBattleResolver`、选秀及 NET6 `CombatStream`；seed 42，八个 bot 席位，自然淘汰，不改 HP 或强行保活。**八席不是后期八人都存活**；具体存活数列于测量表。
- `ManualClock.fireNext()` 快进等待，`performance.now()` 计同步工作及切片预算；另在目标回合冻结入口切到 `RealClock`，保持 50 ms 战斗节拍，记录回调开始相对计划时间的迟到。房间回调包括同步的八观察席投影和 JSON 编码；使用真实投影函数，但未运行生产 WebSocket socket、认证、背压、压缩及完整 WriteQueue。不是公网端到端延迟测量。
- `combatTick` 是 `onCombatWork` 的一场战斗推进及录帧，包含最后一 tick 的终态处理；`advanceStreams` 是一次房间流式工作片，一片可能推进多场战斗。两者都不是“整局 50 ms 等待”。各组件表为 **inclusive** 时间，不能与父级或彼此重叠项相加。
- 首轮逐条保存约 33.7 万观察对象并保留录制状态；正式复测改为分组数值数组、仅保留回调明细，并关闭录制状态保留。首轮的 522 ms 峰值保留为诊断数据，不当作稳定生产峰值。CPU profile 自身也有采样开销。浏览器同时开启 span / MutationObserver / CDP trace，尚未测关闭探针的绝对帧率；A/B 采用相同探针。
- 浏览器连接既有 `CODEX_BROWSER_CLIENT`，没有 launch Chrome。通过本地 Vite 加载原 `src/main.ts`，仅提前安装计时包装；录下同一 Room 的私有投影、公共视图及逐 tick 战斗流，以浏览器 WebSocket route 按时间播放。链路是 **WsGameClient → OnlineApplication → RemoteSession → BoardScene → 2D / board-feed / Three**；不是浏览器本地 Room，也没有在客户端再计算战斗规则。
- 1440×900，DPR 1，每个场景独立 context，准备采样 8 s，战斗最多 25 s（2-5 完整 18.75 s）。2-5 初始 10 个战斗单位，5-1 初始 20 个，后者包括召唤物；5-1 终态 tick 500，25 s 窗口末尾仍可能在播放缓冲内。所有表说明是否包含异常或素材回退。
- 真实素材只读来自 `/home/aiapps/workspcae/cat-cx-vfx4/assets3d-local/trial`，由测试 route 提供，不复制、不提交。准备窗口前等待 15 s；分别确认初批模型 12/12、17/17 加载，约 9.43 / 10.53 s。战斗首次遇到的敌方模型/特效仍可有上传成本。素材路径及 manifest 与生产测试站是否完全相同未验证。
- 使用 rAF 差值、PerformanceObserver longtask、CDP CPU profile、主渲染线程 timeline 的 Layout / UpdateLayoutTree / Paint / MinorGC / MajorGC，以及实际方法 span。布局事件、JS 方法 span 与 CPU 样本存在重叠；GC 只合计顶层 MinorGC / MajorGC，不累加其内部子事件。p50/p95 使用 nearest-rank，max 保留原值。

## 服务器测量

主表来自一次低保留、开启生产频率 replay spot-check 的完整对局（每四个符合条件回合一次，100 tick / 20 ms 切片，共 267 片，校验无差异）。达到加时 2；记录 17,514 个回调、88,345 条模拟发送消息。第 2、5、6 阶段各含七回合。CPU 采样覆盖整局约 120.18 s；以下是同步工作时间，不含快进掉的准备等待。

| 阶段 | 存活席位（入场 → 阶段结束） | 单席棋盘单位数上界 | 房间回调 n | 回调总工作 ms | 回调 p50 / p95 / max ms | 战斗 tick n | 战斗 tick p50 / p95 / max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 8 → 8 | 4–6 | 3804 | 16492.70 | 3.86 / 9.29 / 68.25 | 10313 | 1.06 / 2.31 / 53.53 |
| 5 | 6 → 3 | 9–10 | 2888 | 23151.85 | 6.67 / 17.44 / 154.66 | 4719 | 3.04 / 6.86 / 150.61 |
| 6 | 3 → 2 | 10 | 2642 | 20161.62 | 5.93 / 20.45 / 142.38 | 3148 | 3.87 / 9.57 / 142.25 |

5-1 至 5-7 的存活数依次为 6→5、5→4、4→4、4→4、4→3、3→3、3→3。虽然后期对战数量减少，单场 tick 的 p95 仍从 2.31 增至 6.86 ms（约 3 倍）；房间回调 p95 从 9.29 增至 17.44 ms。

按组件比较（单次调用 p50 / p95 / max，ms；第 5 阶段另列 inclusive 总时长）：

| 工作项 | 阶段 2 | 阶段 5 | 阶段 6 | 阶段 5 次数 / 总 ms |
| --- | --- | --- | --- | --- |
| 冻结入口 | 6.34 / 6.61 / 6.61 | 6.68 / 10.31 / 10.31 | 6.58 / 7.31 / 7.31 | 7 / 49.50 |
| 初始化片（frozen） | 5.11 / 12.67 / 14.62 | 5.10 / 8.66 / 125.43 | 5.11 / 10.97 / 18.67 | 205 / 1363.39 |
| 结算工作片（battle） | 17.53 / 48.76 / 48.76 | 17.88 / 120.51 / 120.51 | 12.15 / 140.05 / 140.05 | 14 / 345.38 |
| 流式推进片 | 3.83 / 8.76 / 53.56 | 6.71 / 15.14 / 154.65 | 5.70 / 14.06 / 142.38 | 2342 / 17386.82 |
| 提交结算 | 16.68 / 28.79 / 28.79 | 16.42 / 21.84 / 21.84 | 12.53 / 139.28 / 139.28 | 7 / 111.01 |
| 换轮事务 | 57.98 / 68.25 / 68.25 | 57.63 / 131.64 / 131.64 | 42.85 / 56.98 / 56.98 | 7 / 478.42 |
| 机器人行动 | 3.24 / 8.18 / 18.90 | 7.08 / 16.32 / 39.44 | 8.46 / 17.19 / 33.79 | 254 / 2051.22 |
| 机器人订阅同步 | 0.00 / 0.01 / 0.05 | 0.01 / 0.02 / 0.08 | 0.00 / 0.01 / 0.02 | 580 / 4.11 |
| 投影及编码总包 | 0.06 / 1.63 / 27.84 | 0.08 / 3.70 / 120.67 | 0.06 / 3.74 / 137.93 | 2663 / 1820.23 |
| 公开投影 | 0.00 / 0.17 / 17.93 | 0.00 / 0.39 / 3.27 | 0.00 / 0.45 / 124.04 | 2608 / 144.93 |
| 私有投影 | 0.79 / 1.81 / 19.32 | 2.10 / 5.03 / 110.81 | 2.97 / 6.37 / 9.22 | 331 / 1032.29 |
| 流读取 | 0.00 / 0.01 / 1.86 | 0.00 / 0.01 / 0.14 | 0.00 / 0.01 / 0.11 | 21304 / 41.16 |
| JSON 编码 | 0.00 / 0.05 / 2.87 | 0.01 / 0.11 / 4.48 | 0.02 / 0.12 / 4.59 | 10990 / 469.61 |
| 回放抽检片 | 20.38 / 20.98 / 21.72 | 22.19 / 29.10 / 54.89 | 22.14 / 26.99 / 67.09 | 59 / 1300.40 |

`runSettlementSlice` 名称同时覆盖初始化与结算，已按进入时的 phase 拆开。`freezeAndResolve` 还包含首个初始化片；不要重复求和。冻结阶段约 5 ms 的中位数证明切片生效，但单个不可抢占操作仍可超过预算。`advanceRound` 每阶段仅 7 次，nearest-rank p95 等于 max，不能当作稳定尾延迟估计。

房间回调按**进入时**的 phase 统计；settlement 行主要是到期后的换轮工作，提交结算则仍发生在 battle：

| phase | 阶段 2 n / 总 ms | 阶段 2 p50 / p95 / max | 阶段 5 n / 总 ms | 阶段 5 p50 / p95 / max |
| --- | --- | --- | --- | --- |
| preparation | 356 / 1313.87 | 3.27 / 8.19 / 18.92 | 260 / 2102.46 | 7.10 / 16.31 / 39.45 |
| frozen | 100 / 544.50 | 5.12 / 10.43 / 14.62 | 202 / 1331.87 | 5.11 / 8.67 / 125.43 |
| battle | 3335 / 14113.18 | 3.85 / 9.27 / 53.57 | 2415 / 19050.04 | 6.89 / 17.44 / 154.66 |
| settlement | 7 / 411.18 | 57.99 / 68.25 / 68.25 | 7 / 478.47 | 57.64 / 131.65 / 131.65 |
| carousel | 6 / 109.98 | 19.87 / 25.56 / 25.56 | 4 / 189.00 | 25.54 / 133.05 / 133.05 |

真实时钟复测每个目标回合一次，关闭 fixture 保留及回放抽检；表中只含切换后的回调，不含此前快进。这个复测回答 50 ms 调度是否能跟上，不能替代开启抽检后的生产 socket 验收：

| 回合 | 回调 n | 回调 p50 / p95 / max ms | 战斗 tick p50 / p95 / max ms | 计划迟到 p50 / p95 / max ms |
| --- | --- | --- | --- | --- |
| 2-5 | 712 | 5.26 / 8.99 / 21.43 | 1.59 / 2.65 / 20.40 | 0.00 / 0.52 / 9.08 |
| 5-1 | 548 | 9.40 / 16.81 / 31.75 | 3.72 / 6.27 / 26.63 | 0.00 / 1.19 / 51.98 |

2-5 没有迟到超过 50 ms 的回调；5-1 有 1 次（51.98 ms）。这一次回合内，服务器常规同步工作多数仍能放进 50 ms 节拍；不能由此否认跨回合出现的 100+ ms 长尾。

观察器与复现波动：

| 运行 | 阶段 5 回调 p50 / p95 / max ms |
| --- | --- |
| 首轮，逐条保留及 fixture | 6.82 / 16.04 / 522.46 |
| 低保留，不含抽检 | 6.53 / 16.20 / 215.68 |
| 低保留，含抽检（主表） | 6.67 / 17.44 / 154.66 |

峰值不稳定，不能把首轮 522 ms 全部归因于产品或全部归因于探针。低保留复测仍出现 154–216 ms 峰值。主表 GC 事件 3,019 次，累计 8,257.42 ms，p50 2.50 / p95 3.92 / max 112.50 ms；与 CPU 的 GC 样本口径不同，不相加。低保留无抽检运行的回合入口 heapUsed：阶段 2 约 58–197 MB，阶段 5 约 103–426 MB，阶段 6 约 129–378 MB，尚不能据此判断泄漏。


## 客户端测量

下表使用最小异常修复后的窗口，所有窗口无 pageerror。3D 均确认 `data-state=assets`。这是本机 **SwiftShader** 的实测；GPU 命令提交的 CPU 时长不等于 GPU 执行时长。

| 视图 | 回合 | 阶段 | rAF 样本数 | 帧间隔 p50 / p95 / max ms | >50 ms 帧数 | longtask 次数 / 总 ms |
| --- | --- | --- | --- | --- | --- | --- |
| 2d | 2-5 | prep | 316 | 33.20 / 33.40 / 50.00 | 0 | 0 / 0.0 |
| 2d | 2-5 | combat | 276 | 66.70 / 83.40 / 166.60 | 216 | 249 / 16951.0 |
| 2d | 5-1 | prep | 267 | 33.30 / 33.40 / 50.10 | 1 | 0 / 0.0 |
| 2d | 5-1 | combat | 240 | 100.00 / 166.60 / 233.40 | 234 | 239 / 24215.0 |
| 3d | 2-5 | prep | 48 | 166.70 / 183.40 / 183.40 | 48 | 49 / 8013.0 |
| 3d | 2-5 | combat | 96 | 183.40 / 233.30 / 483.30 | 96 | 97 / 17949.0 |
| 3d | 5-1 | prep | 47 | 166.70 / 183.40 / 199.90 | 47 | 49 / 8084.0 |
| 3d | 5-1 | combat | 137 | 183.30 / 216.70 / 533.20 | 137 | 138 / 23969.0 |

正常样本每格一次独立窗口，不能据此给置信区间；rAF 为浏览器帧调度间隔，longtask 为主线程任务，两者不是同一统计量。准备阶段没有流式战斗帧，2D p95 约 33.4 ms；真实 3D 准备阶段已经约 183.4 ms，显示问题不只发生在第 5 阶段战斗。

准备窗口的组件计时（8 s；无战斗帧应用）：

| 视图 / 回合 | BoardScene.update p95 / 总 ms | Three.render p95 / 总 ms | Layout + 样式 ms | Paint ms | MinorGC + MajorGC ms |
| --- | --- | --- | --- | --- | --- |
| 2d / 2-5 | 1.20 / 206.5 | — | 142.7 | 6.9 | 84.6 |
| 2d / 5-1 | 1.50 / 220.9 | — | 165.9 | 8.3 | 79.3 |
| 3d / 2-5 | 1.10 / 30.4 | 5.00 / 180.2 | 143.0 | 13.6 | 0.0 |
| 3d / 5-1 | 1.00 / 34.2 | 5.50 / 207.8 | 146.9 | 15.3 | 0.0 |

战斗组件单次调用 p95 / 整窗累计 ms（计时可重叠）：

| 组件 | 2D 2-5 | 2D 5-1 | 3D 2-5 | 3D 5-1 |
| --- | --- | --- | --- | --- |
| BoardScene.update | 49.80 / 7633.5 | 101.90 / 12287.9 | 8.20 / 479.6 | 7.30 / 702.3 |
| DOM 飘字 renderFeedback | 47.80 / 7041.9 | 98.20 / 11448.6 | 0.10 / 0.5 | 0.00 / 0.4 |
| 战斗视图同步 syncCombat | 0.80 / 131.0 | 1.20 / 186.3 | 2.00 / 87.5 | 1.60 / 129.4 |
| 3D boardFrame | 0.00 / 0.0 | 0.00 / 0.0 | 0.50 / 23.7 | 0.50 / 41.4 |
| Three.render（CPU 提交） | 0.00 / 0.0 | 0.00 / 0.0 | 11.40 / 562.7 | 11.80 / 998.7 |
| 已播放帧 advanceDisplay | 0.20 / 18.0 | 0.20 / 27.4 | 0.20 / 10.1 | 0.30 / 18.9 |
| 流追加 reviseReplay | 0.10 / 8.2 | 0.10 / 12.3 | 0.10 / 6.7 | 0.10 / 8.3 |
| OnlineApplication.frame | 1.60 / 320.5 | 2.40 / 424.0 | 2.10 / 134.7 | 2.30 / 206.7 |
| WsGameClient.onCombatStream | 0.10 / 77.5 | 0.10 / 134.2 | 0.10 / 121.2 | 0.10 / 148.9 |

3D 飘字近零是产品现有在线 `quietBoard()` 分支；表中不存在的 Three span 记 0。流接收 p95 很小，但 2D 5-1 单次最大 113.2 ms、3D 5-1 最大 133.0 ms；冷入口的流应用/初始化仍有尾峰，不能只看 p95。它们发生次数少，不是本窗持续低帧率的最大来源。

战斗主渲染线程 timeline 与场景快照：

| 视图 / 回合 | Layout ms | UpdateLayoutTree ms | MinorGC + MajorGC ms | DOM mutation 记录数 | 3D draw calls / triangles / textures |
| --- | --- | --- | --- | --- | --- |
| 2d / 2-5 | 2138.6 | 5670.7 | 137.9 | 14196 | — |
| 2d / 5-1 | 2537.5 | 9837.4 | 154.3 | 24455 | — |
| 3d / 2-5 | 66.2 | 392.5 | 28.8 | 5700 | 153 / 111241 / 97 |
| 3d / 5-1 | 74.5 | 625.8 | 55.7 | 12560 | 181 / 101276 / 133 |

2D 5-1 中 Layout + UpdateLayoutTree 共约 12.37 s，占 25 s 请求窗口约 49%；GC 约 154 ms，当前证据不支持把客户端 GC 作为首要原因。Three 的 CPU 提交 p95 约 12 ms，而真实 3D 帧 p95 超过 200 ms；软件 GPU / 原生浏览器执行未在该 JS span 内完整计量。draw calls/三角形/贴图是窗口末尾单帧快照，不是累计值。3D 的 `getBoundingClientRect` 及矩阵更新也有开销，但没有足够证据给硬件 GPU 优化排序。

仅在测试响应中把飘字 `textContent` 改成“内容变化才赋值”的诊断 A/B（产品 UI 未改）：

| 回合 | 原帧 p95 → A/B ms | 原飘字总 ms → A/B | 飘字累计减少 | 比较正确性 |
| --- | --- | --- | --- | --- |
| 2-5 | 83.4 → 66.7 | 7041.9 → 3950.5 | 43.9% | 末尾 combatView / recentCombatEvents 完全相同，无 pageerror |
| 5-1 | 166.6 → 150.0 | 11448.6 → 9682.8 | 15.4% | 末尾 combatView / recentCombatEvents 完全相同，无 pageerror |

这是一次诊断重复，帧 p95 分别改善约 20% / 10%，不是承诺收益。第 5 阶段仍有约 9.68 s 飘字总时长；现有 render 循环还交错写样式与读取 `root.clientWidth/clientHeight`、`label.offsetWidth`。下一步应将尺寸读取与位置写入分批，并缓存稳定尺寸，再用同一网络回放复测。不能据文字缓存 A/B 直接预测批次改造的具体收益。


原始未修复样本：`artifacts/stage5-lag/client-*-5-1-*-assets.*` 文件名中的 assets 是“请求素材”的历史标签，实际请求失败后回退为占位；截图明确显示占位状态。两轮 2D 和占位 3D 均在 tick 293 抛异常，故不把它们的整窗 p50 放进正常战斗对比。无素材的 2D 不受这个回退影响。启动端口冲突、HTML route 不匹配、直接 WebSocket 连接失败等探针失败分别保存在 `browser-smoke*.log`；修正的是测量器，不是产品网络代码。最终模拟服务的 `/healthz` 不可用仍被记为 requestfailed，不影响注入的战斗流，但也说明这不是完整生产服务验收。

## 火焰图热点与 GC

服务器主 profile 的 self 样本按函数名、文件及行合并；分母为整局 120.18 s 的采样墙钟时间，包含探针与 GC：

| 函数 | 源位置 | self ms | 采样占比 |
| --- | --- | --- | --- |
| (garbage collector) | V8 GC | 8720.6 | 7.26% |
| advanceS13Tick | src/simulation/combat-s13.ts:156 | 7738.1 | 6.44% |
| structuredClone | node:internal/worker/js_transferable:112 | 5354.2 | 4.46% |
| copyCombatUnitForTick | src/simulation/combat-static.ts:60 | 4991.5 | 4.15% |
| canonicalSteps | src/simulation/content/index.ts:67 | 4355.0 | 3.62% |
| freezeSteps | src/simulation/content/freeze.ts:17 | 3081.6 | 2.56% |
| pick | src/simulation/view-fields.ts:3 | 2980.3 | 2.48% |
| freezeTree | src/simulation/content/freeze.ts:34 | 2175.8 | 1.81% |
| (anonymous) | scripts/stage5-lag-server.ts:88 | 2157.7 | 1.80% |
| rememberFrozen | src/simulation/content/index.ts:35 | 2045.9 | 1.70% |
| working | src/simulation/combat-s13.ts:95 | 1992.6 | 1.66% |
| dispatchTriggers | src/simulation/m8/triggers.ts:56 | 1913.9 | 1.59% |

阶段 2 / 5 的回调采样中，`advanceS13Tick` self 为 7.9% / 6.1%，GC 6.6% / 7.8%，`structuredClone` 4.8% / 4.8%，`copyCombatUnitForTick` 5.3% / 3.9%，`canonicalSteps` 2.9% / 4.0%。后期每 tick 耗时变大，并不等于其 self 占比必须上升。`structuredClone` 包含所有调用来源，不能把该行全部算作单位复制可消除的成本。

将长回调时间戳与 CPU 采样、GC 事件对齐后的代表性尾峰（约数）：

| 回合 / 进入 phase | 回调 ms | 窗口内主要 self 样本 | GC 重叠 ms | 含义 |
| --- | --- | --- | --- | --- |
| 5-5 / battle | 154.7 | rememberFrozen 69.9 ms；GC 72.2 ms | 72.8 | 认证遍历与 GC 同时贡献 |
| 6-3 / battle | 142.4 | rememberFrozen 134.9 ms | 0 | 并非所有尾峰都是 GC |
| 6-3 / battle | 140.1 | freezeSteps 125.5 ms | 4.9 | 结算/投影冻结也能形成长尾 |
| 5-4 / carousel | 133.0 | freezeSteps 111.9 ms | 2.9 | 不只战斗阶段 |
| 5-4 / settlement | 131.6 | rememberFrozen 72.2 ms；canonicalSteps 11.9 ms | 5.7 | 换轮事务内仍有不可抢占工作 |

`rememberFrozen` 包含原生属性描述读取及 WeakSet/WeakMap 登记，`freezeSteps` 也做对象图遍历；JS 采样不能进一步证明某次峰值究竟属于原生容器增长还是具体遍历节点。不要把这些样本全归为规则数值运算，也不要在没有等价性证明时直接去掉冻结或摘要认证。

客户端战斗 self 热点（占各自整窗采样的比例）：

| 视图 / 回合 | 采样总 ms | 主要函数 self |
| --- | --- | --- |
| 2d / 2-5 | 19022.9 | (program) 49.33%; render 29.50%; getBoundingClientRect 7.32%; GraphicsWebGLRenderer 1.84%; batchLine 1.10%; isEarHashed 1.07%; batchQuad 1.00% |
| 2d / 5-1 | 25383.2 | (program) 41.13%; render 39.28%; getBoundingClientRect 5.72%; GraphicsWebGLRenderer 1.58%; batchLine 1.04%; isEarHashed 0.97%; batchQuad 0.82% |
| 3d / 2-5 | 19393.5 | (program) 88.98%; getBoundingClientRect 2.31%; updateMatrixWorld 0.63%; multiplyMatrices 0.34%; (anonymous) 0.26%; _removeInactiveBinding 0.22%; projectObject 0.21% |
| 3d / 5-1 | 25720.3 | (program) 87.97%; getBoundingClientRect 1.99%; multiplyMatrices 0.70%; updateMatrixWorld 0.64%; (anonymous) 0.41%; (garbage collector) 0.30%; projectObject 0.25% |

2D 的 `render` 是 `src/stats/combat-feedback-renderer.ts` 飘字方法，不是 Three renderer；`getBoundingClientRect` 的原生布局时间也被采样，和 timeline 不重复相加。第 5 阶段 2D 的飘字 self 约 39.28%，与方法计时及布局 trace 一致。3D 约 88% 为 `(program)`，不能把该行直接称为 GPU 精确占比。

可打开的主要火焰图：[服务器整局](../artifacts/stage5-lag/server-audit42.flame.svg)、[2D 2-5](../artifacts/stage5-lag/postfix/client-2d-2-5-combat-1-assets.flame.svg)、[2D 5-1](../artifacts/stage5-lag/postfix/client-2d-5-1-combat-1-assets.flame.svg)、[3D 2-5](../artifacts/stage5-lag/postfix/client-3d-2-5-combat-1-assets.flame.svg)、[3D 5-1](../artifacts/stage5-lag/postfix/client-3d-5-1-combat-1-assets.flame.svg)。这些链接只在保留本地 artifacts 的工作区有效，生成物不提交。


所有 `.cpuprofile` 可以在 DevTools Performance 导入；`scripts/stage5-lag-analyze.cjs` 同时输出保留父子调用栈的 `.flame.svg`。SVG 宽度是采样时间，保留 `(program)`、GC、idle 和探针开销，不冒充精确 CPU 指令计数。客户端大量 `(program)`/原生浏览器工作未在 JS 火焰图中细分，需结合 timeline；本任务未测 GPU timer query 或硬件 GPU trace。

## 已实施的小修复与验证

`summarizeBattle` 的 `terminal.get(unit.id)!.alive` 改为 `terminal.get(unit.id)?.alive ?? false`，只处理合法召唤物离场导致的缺项；不更改事件、伤害/治疗求和、战斗单位名单或终局收据。没有把离场变成新的死亡事件。

新增 `tests/stage5-summary-removal.test.ts` 两项：离场单位仍保留贡献、活单位与死单位区分、输入不变，以及在线 `rankLiveBattle` 前缀与完整 `rankBattle` 路径。修复前 **2/2 同位置失败**；修复后连同现有 `g5-combat-summary`、`server/g5-battle-ranking` **18/18 通过**；`npm run typecheck` 通过。未跑全套十几分钟验收。

浏览器用相同真实录制复验：2D 5-1 到 tick 494、真实素材 3D 到 tick 491，均越过原故障 tick 293 且无异常；2-5 两种视图均播到终态 tick 355。5-1 的正式 25 s 窗口不是完整终局验收。

## 修复优先级、收益与风险

按确定性、实测收益和实施风险排序；未实施项均为后续候选，不是已验证修复：

| 优先级 | 具体改动 / 状态 | 预期收益及依据 | 风险 / 验证要求 |
| --- | --- | --- | --- |
| P0 | 汇总缺项使用 false（已实施） | 消除 5-1 tick 293 的确定性异常；恢复播放。不是 FPS 优化 | 低；18 个相关测试、类型检查及同一在线回放已通过 |
| P1 | 飘字 textContent 内容未变则不写；随后分批读尺寸/写位置（Claude） | 单行诊断 A/B：5-1 飘字累计 -15.4%，帧 p95 -10%；批次改造收益待测 | 低至中；验证单位定位、缩放、过期移除及在线/回放；不承诺 60 FPS |
| P2 | 只优化 copyCombatUnitForTick 内有所有权证明的动态分支复制（Codex） | 该函数 self 约 4.15%，所有 structuredClone 另占 4.46%；若将该函数自身耗时减半，对整局约 2% 收益；clone 和 GC 的额外收益待分支归因，未实测 | 中高；不能误共享可变数组/记录，完整终态、事件、RNG 与恢复结果须字节等价；不能消除全部冻结/GC 尾峰 |
| P3 | nextSharedRound 同源可恢复任务，Room.advanceRound 分片后一次发布（Codex + Claude） | 目标将常见 58 ms、峰值 132 ms 的换轮阻塞拆到约 20 ms + 一个不可抢占单元；不减少总 CPU，原生长单元仍可能超预算 | 高；共享池原子性、唯一收据、超时、发布顺序及断线恢复必须不变；先确认尾峰具体工作单元 |

下面列出建议所涉及的全部直接生产调用点及在线链路。测试引用不算产品调用点；“受影响”不表示必须修改所有调用方。

1. **已修复的汇总缺项**：修改 `src/simulation/combat-summary.ts:summarizeBattle`。唯一直接生产调用是 `src/presentation/battle-ranking.ts:summarize`（约第 60 行）；上层 `rankBattle`、`rankLiveBattle`、`unitBattleStats`。实际消费者为 `src/rendering/online/battle-summary.ts:live/show`（62/69）、`src/rendering/online/online-application.ts:flushOutcome`（344）、`src/rendering/BoardScene.ts:syncUnitCard/inspectData`（1179/1208）；`rankLiveBattle` 的完成分支以及 `unitBattleStats` 的本场/历史聚合也调用 `rankBattle`（67/127/131）。`src/server-entry/index.ts` 为公共导出；在线触发链为 `OnlineApplication.frame → syncSummary → BattleSummaryPanel.live → rankLiveBattle → summarizeBattle`。只改汇总、回归、合同，以上 UI 文件未改。
2. **飘字文字缓存及读写批次**：修改点为 `src/stats/combat-feedback-renderer.ts:createCombatFeedbackRenderer` 返回的 `render`，约第 46–69 行。唯一工厂调用在 `BoardScene.create`（297）；全部 render 调用在 `BoardScene.renderReplayFeedback`（1101）、`BoardScene.renderFeedback` 的 3D 分支（1125）和 2D 分支（1128）。前者由 `BoardScene.update` 的 replay 模式分支调用，后者由同一个 update 每帧调用（1132 起）。在线事件源是 `RemoteSession.advanceDisplay → BoardScene.showEvents → feedback.push`；在线 3D 已有 `quietBoard()` 早退，不应声称该修复会加速当前在线 3D。该文件属于 Claude 界面职责，本次只用测试响应做 A/B，未改产品文件。
3. **战斗动态复制热点**：候选仅修改 `src/simulation/combat-static.ts:copyCombatUnitForTick` 内的动态分支；暂不改 `immutableTickRecord/sharedCombatDeclarations` 的通用认证约定，唯一直接 `copyCombatUnitForTick` 调用在 `src/simulation/combat-s13.ts:advanceS13Tick`（159）。应先针对有所有权证明的动态分支做窄范围复制，而非删冻/删字段或把外部输入当作已认证数据。通用入口 `stepCombat → advanceCombatTick → advanceS13Tick`。在线 PvP 为 `Room.advanceStreams → CombatStream.advancePvp → BattleReplayTask.advanceTick/advance → stepCombat`（`two-sided-battle.ts` 317/325）；PvE 为 `CombatStream.advancePve → stepMatchCombatStream → stepCombat`。旧 resolver、`startCombatReplay`、恢复冷重演、离线 Match 也共享此入口，必须跑完整状态/事件字节对比。无需直接改各 UI 调用方。
4. **换轮事务可恢复切片**：候选新增 `shared-pool.ts` 的 `nextSharedRound` 同源 generator，保留原同步入口；修改 `Room.advanceRound` 的调度接线，保持整个池和席位结果一次发布。当前唯一直接生产调用 `src/server/room/room.ts:1796`；唯一 `advanceRound` 调用是 `Room.onDeadline` 的 settlement 分支（1884）。`nextSharedRound` 目前直接调用内部 `refreshBatch(pool, states, expectedRound, true)`（348）。若提取该内部实现，另一直接调用 `refreshSharedShops`（344）也必须继续走同源同步路径；后者唯一生产调用是 `Room` 构造函数（409）。必须同步覆盖 `applyTimeouts('settlement')` 与发布前的 `openingViewFault/publishOpeningResolution`，不能把半个共享池公开。在线路径 `RealClock → roomClock/WriteQueue → onDeadline → advanceRound → nextSharedRound`，本地房间也复用 Room。需要改 server 的部分交由 Claude，新增契约与确定性测试由 Codex 配合。

没有建议删完整账本、少算战斗 tick、跳过校验、放宽守恒或降低画面信息正确性。单纯把 20 ms 预算调小不能消除一个不可抢占工作单元或 GPU/布局停顿。

## 复现与交付

所有生成物位于 gitignored `artifacts/stage5-lag/`；没有新增模型、贴图、录制夹具或 profile 到跟踪目录。四个可复用测量脚本为 `stage5-lag-server.ts`、`stage5-lag-browser.cjs`、`stage5-lag-browser-probe.ts`、`stage5-lag-analyze.cjs`。脚本没有依赖 Git 写权限。

```bash
export PATH=$HOME/.local/bin:$PATH
mkdir -p artifacts/stage5-lag
node_modules/.bin/esbuild scripts/stage5-lag-server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=artifacts/stage5-lag/server-v3.mjs
# 第一遍保留 fixture；后续计时关闭 fixture 保留。各命令串行执行。
node artifacts/stage5-lag/server-v3.mjs 42
STAGE5_FIXTURES=0 STAGE5_AUDIT=1 node --cpu-prof --cpu-prof-dir=artifacts/stage5-lag --cpu-prof-name=server-audit42.cpuprofile artifacts/stage5-lag/server-v3.mjs 42
STAGE5_FIXTURES=0 node artifacts/stage5-lag/server-v3.mjs 42 2-5
STAGE5_FIXTURES=0 node artifacts/stage5-lag/server-v3.mjs 42 5-1
# 需要当前已有 CODEX_BROWSER_CLIENT / PLAYWRIGHT_WS_ENDPOINT；连接，绝不 launch。
# 当前产品含本文的一行异常修复；把正常样本放入 postfix。
mkdir -p artifacts/stage5-lag/postfix artifacts/stage5-lag/textcache
cp artifacts/stage5-lag/fixture-42-*.json artifacts/stage5-lag/postfix/
cp artifacts/stage5-lag/fixture-42-*.json artifacts/stage5-lag/textcache/
STAGE5_OUT=artifacts/stage5-lag/postfix STAGE5_ASSETS=/path/to/local/assets-root STAGE5_REPEATS=1 node scripts/stage5-lag-browser.cjs
# A/B 放在另一输出目录，先复制上一步生成的 fixture-42-*.json。
STAGE5_OUT=artifacts/stage5-lag/textcache STAGE5_TEXT_CACHE=1 STAGE5_MODES=2d STAGE5_REPEATS=1 node scripts/stage5-lag-browser.cjs
node scripts/stage5-lag-analyze.cjs artifacts/stage5-lag
node scripts/stage5-lag-analyze.cjs artifacts/stage5-lag/postfix
node scripts/stage5-lag-analyze.cjs artifacts/stage5-lag/textcache
npm test -- tests/stage5-summary-removal.test.ts tests/g5-combat-summary.test.ts tests/server/g5-battle-ranking.test.ts --maxWorkers=4
npm run typecheck
```

固定 Vite 端口默认 53147，可用 `STAGE5_VITE_PORT` 指定空闲端口；发现占用即失败，不连接其他工作区的服务。最终数据索引为各输出目录的 `summary.json`，浏览器 JSON 包含原始帧序列、计时分布、调试状态、GPU/素材状态及错误记录。

尚未覆盖：生产测试站的实际硬件 GPU、真实公网延迟/背压、完整长会话累积内存、多个 seed 的统计外推、后期强制八名存活的压力上界。自然八席对局、单局 Room、录制网络帧及本机两种视图的结论不应扩写成这些场景已经通过。
