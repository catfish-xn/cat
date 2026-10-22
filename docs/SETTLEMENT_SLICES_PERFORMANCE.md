# 结算补算切片：定位与验收（2026-10-22）

基线 `origin/multiplayer` 的本地提交 `2de5e26d088e4e86032bf571d51941c9b0ecd12f`；工作分支 `codex/settle-slices`。全程离线、不 push、不写 Git 元数据。没有修改 `src/simulation/`、规则、运算顺序、RNG、内容版本或 digest。

## 根因与复现条件

真实日志的回合 2/10/17/24/31 对应 PvE 的 1-3/2-7/3-7/4-7/5-7。八个 Bot 本身不在战斗中操作，只跑 BotDriver 会漏掉关键触发条件：**战斗期间一个成功的商店操作让预结算过期**。

`Room.commitPending → commitSettlement(stale-seat) → planSettlement → plan → finishLiveCombat` 在固定席位顺序里同步补跑全部仍处于 combat 的席位。它在最新共享池上逐 tick 调用 `runSharedMatchCommand(..., {type:'step'})`，与冻结输入的预计算不同，不能直接丢掉。即使只锁一次店、不改金币或战斗结果，也会触发；不是选秀、终局排序、整份存档序列化或回放抽检。#371 已切开冻结战斗和抽检的循环，但没有覆盖这个补算循环。live-bank 的 `settleLive → LivePveTrack.catchUp(MAX_SAFE_INTEGER)` 也有同类无预算尾算，已一起切开。

`node scripts/settlement-slices-probe.cjs 2de5e26d artifacts/settlement-slices` 从本地 Git 对象导出基线 `src/` 到临时目录，各运行 seed=42 的八个 Bot 至终局（第 37 回合）。每个 PvE battle 入口对首个存活席位执行一次成功的 shopLock。阶段计时用 ManualClock 快进；预算用单调 `performance.now()`（新增可选 `RoomOptions.sliceNow`，生产默认仍为房间 clock）；`sliceTicks=100 / sliceMs=20` 与服务器默认值一致。每次 `clock.fireNext`、Room 的计划/提交/换轮和补算的共享池 step 都用 performance.now 打点。探针只在临时 bundle 注入测量，领域源码不读真实时钟。无网络连接、无人观看回放；其结果定位 Room 的结算路径，不代表 WebSocket 压缩/推送耗时。

## 本地耗时分解与前后对比

Node v24.21.0，Intel Xeon Processor (Skylake, IBRS)；同一机器串行跑基线与修复版，未并行运行测试。单位 ms，shared step 包含其领域运算与内部守恒检查；“计划余项”是计划耗时减去这些 step，“换轮”另属后续 settlement 截止回调，不与战斗截止结算相加。

| 回合 | 补算 step 数 | 基线 shared step 合计 | 基线计划余项 | 基线提交 | 基线换轮 | 基线最长结算回调 | 修复最长结算回调 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 961 | 728.3 | 10.9 | 0.31 | 30.8 | 739.4 | 24.1 |
| 10 | 1016 | 1199.3 | 10.9 | 0.29 | 32.3 | 1210.2 | 27.4 |
| 17 | 956 | 1644.7 | 11.4 | 0.40 | 45.4 | 1656.1 | 29.1 |
| 24 | 747 | 1677.0 | 11.1 | 0.51 | 44.5 | 1687.7 | 29.0 |
| 31 | 450 | 1102.3 | 6.9 | 0.49 | 31.6 | 1109.1 | 28.9 |

shared step 占基线计划的 98%–99%，live-bank 检查本例仅约 0.01–0.03 ms，提交不到 1 ms，排除排名/换轮作为这段秒级阻塞的主因。修复前后各回合的 step 数完全相同；修复降低单次连续占用，不保证总 CPU 用时减少。

持久证据：[comparison.json](evidence/settlement-slices/comparison.json)，包含五个目标回合的原始小数耗时、其他阶段慢回调与三类确定性指纹。全局最终状态 SHA-256：`7c5687861320a55381d583f1eb6579270fc1fb43f527ee9b2996610de7498f08`；每回合全局检查点 SHA-256：`39d16bed9fa70b531e1126051d399bc513fdbdcc56cf2a8d1f8332128d12a7e7`。首次逐 12 tick 的独立对照还直接 `cmp` 了两份 6,426,002 字节终局 JSON，结果相同。

## 修法与对外语义

- 同一个计划生成器同时提供同步 `planSettlement` 与房间调度用的续算形式。每个 PvE 工作单元最多一个原有共享池 step；PvP 收据按席位切开。每单元后检查 20 ms 和 tick 上限，用原 clock.schedule 让出单写队列。
- 仍按原席位和共享池顺序运算，保留全部战斗与 match-domain 事件，只在完整计划通过后执行原 `commitSettlement`。live-bank 尾算保留录帧、共享池顺序和每席原来的一次提交，不增添中间席位版本。
- 切片之间服务器继续解析、限流、处理心跳/重连。有效运营命令在 `Room.deferDuringSettlement` 等待，不提前发成功收据；完整结算后 FIFO 返回原入口，重新校验身份/连接代次、commandId、round、seatRevision，过期按既有原因拒绝，不改参数或自动重放。断开的连接不执行等待命令。
- abort/fault 取消续算并让等待命令经过终局校验；dispose 清空等待命令和所有定时器。`retained.resolving` 包括结算补算。公共接口和失败约定见 [联机合同](MULTIPLAYER_CONTRACT.md#结算补算切片2026-10-22服务器调度补充)。

## 确定性与测试

探针将每份状态先 JSON.stringify 成完整字节，再对字节求 SHA-256 并断言相同；组件测试另对完整 JSON 串直接断言相等。全局最终状态、每回合 commit 后的完整 RoomState（所有席位、共享池、种子/游标、排名、选秀账本、收据及每场完整战斗账本）、Bot 意图序列分别比较。不删除 roomRevision、deadlineAt 或任何字段。所有序列化在性能回调计时之外执行，避免测量工具制造阻塞。

`tests/server/settlement-slices.test.ts`：普通 PvE 与实时金币持有者改变金币后的 PvE，同步和逐 tick 切片的完整状态及每次发布逐字节相同；假 CPU 时钟每单元 7 ms、预算 20 ms，100 个工作单元中每回调最多 21 ms，且竞争消息定时器可先执行；FIFO、abort、dispose 和取消定时器断言。

`tests/server/net/settlement-queue.test.ts`：内存传输经过真实 parse/auth/版本校验/dedupe/写队列；结算期间有效命令等待，坏 JSON 立即应答，解锁后命令 FIFO 且重复 ID 只执行一次；断线后等待命令不再落地。

沙箱在后续运行中拒绝 loopback listen（`listen EPERM 127.0.0.1`）。原 `net/slow-task.test.ts` 的四个用例已通过仅替代 HTTP listen/address/close 的临时启动桩重跑，计时、队列、日志、计时器与断言沿用原代码；原测试文件没有修改。真实监听与 WebSocket 通路的完整验收仍需允许监听的环境。临时启动桩留在忽略目录 `artifacts/settlement-slices/http-listen.setup.ts` 与 `vitest-slow.config.ts`，命令：`node node_modules/vitest/vitest.mjs run --config artifacts/settlement-slices/vitest-slow.config.ts`。

最终验证：`npm run typecheck` 通过。六个相关测试文件（settlement-slices、net/settlement-queue、round-commit、live-bank、v17-avarice-battle-end、bot-driver）共 **32 项通过**；预算计时源补充后又定向运行 settlement-slices、net/settlement-queue、B8 sliced resolution，**11 项通过**（同文件另外两项不匹配筛选）；#371 slow-task 的原四项经上述监听桩运行通过。完整 lifecycle 套件中房间侧用例通过，真实服务器跨局用例受相同 listen EPERM 限制，未据此宣称真实网络验收完成。

## 限制

20 ms 是协作式预算，边界是“预算 + 一个不可抢占工作单元”，不是 GC/操作系统暂停的硬实时保证。总补算 CPU 工作仍存在，商店命令在这段原子提交边界内等待；切片的收益是事件循环继续响应，并非规则补算结果被省略。

探针另记录非 battle 阶段 >50 ms 回调；冻结战斗的初始化/快照、少数换轮与 GC 仍可能出现长回调，保留在 evidence，不把这次修复宣称为全进程所有任务都 ≤50 ms。没有更改它们的规则或通过删账本、改 golden 压低耗时。腾讯云 4 核单进程上的原始数字只作现象对照，不直接与本地机器绝对耗时作硬件等价比较。
