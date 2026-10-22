# 结算补算切片：定位与验收（2026-10-22）

基线 `origin/multiplayer` 的本地提交 `2de5e26d088e4e86032bf571d51941c9b0ecd12f`；工作分支 `codex/settle-slices`。初版全程离线、不 push、不写 Git 元数据。初版没有修改 `src/simulation/`、规则、运算顺序、RNG、内容版本或 digest。

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
- 切片之间服务器继续解析、限流、处理心跳/重连。`Room.deferDuringSettlement` 首批操作在一次重建前执行；批次边界确定后冻结，后续操作等待完整结算提交，再 FIFO 校验原 round / seatRevision，过期按既有原因拒绝，不改参数或自动重放。已认证 session 的命令不因断线丢失，回执记录在 session。
- abort/fault 取消续算并让等待命令经过终局校验；dispose 清空等待命令和所有定时器。`retained.resolving` 包括结算补算。公共接口和失败约定见 [联机合同](MULTIPLAYER_CONTRACT.md#结算补算切片2026-10-22服务器调度补充)。

## 确定性与测试

探针将每份状态先 JSON.stringify 成完整字节，再对字节求 SHA-256 并断言相同；组件测试另对完整 JSON 串直接断言相等。全局最终状态、每回合 commit 后的完整 RoomState（所有席位、共享池、种子/游标、排名、选秀账本、收据及每场完整战斗账本）、Bot 意图序列分别比较。不删除 roomRevision、deadlineAt 或任何字段。所有序列化在性能回调计时之外执行，避免测量工具制造阻塞。

`tests/server/settlement-slices.test.ts`：普通 PvE 与实时金币持有者改变金币后的 PvE，同步和逐 tick 切片的完整状态及每次发布逐字节相同；假 CPU 时钟每单元 7 ms、预算 20 ms，100 个工作单元中每回调最多 21 ms，且竞争消息定时器可先执行；FIFO、abort、dispose 和取消定时器断言。

`tests/server/net/settlement-queue.test.ts`：内存传输经过真实 parse/auth/版本校验/dedupe/写队列；结算期间有效命令等待，坏 JSON 立即应答，解锁后命令 FIFO 且重复 ID 只执行一次；已认证 session 的等待命令在断线后仍执行并保存回执。

沙箱在后续运行中拒绝 loopback listen（`listen EPERM 127.0.0.1`）。原 `net/slow-task.test.ts` 的四个用例已通过仅替代 HTTP listen/address/close 的临时启动桩重跑，计时、队列、日志、计时器与断言沿用原代码；原测试文件没有修改。真实监听与 WebSocket 通路的完整验收仍需允许监听的环境。临时启动桩留在忽略目录 `artifacts/settlement-slices/http-listen.setup.ts` 与 `vitest-slow.config.ts`，命令：`node node_modules/vitest/vitest.mjs run --config artifacts/settlement-slices/vitest-slow.config.ts`。

最终验证：`npm run typecheck` 通过。六个相关测试文件（settlement-slices、net/settlement-queue、round-commit、live-bank、v17-avarice-battle-end、bot-driver）共 **32 项通过**；预算计时源补充后又定向运行 settlement-slices、net/settlement-queue、B8 sliced resolution，**11 项通过**（同文件另外两项不匹配筛选）；#371 slow-task 的原四项经上述监听桩运行通过。完整 lifecycle 套件中房间侧用例通过，真实服务器跨局用例受相同 listen EPERM 限制，未据此宣称真实网络验收完成。

## 限制

20 ms 是协作式预算，边界是“预算 + 一个不可抢占工作单元”，不是 GC/操作系统暂停的硬实时保证。总补算 CPU 工作仍存在，商店命令在这段原子提交边界内等待；切片的收益是事件循环继续响应，并非规则补算结果被省略。

探针另记录非 battle 阶段 >50 ms 回调；冻结战斗的初始化/快照、少数换轮与 GC 仍可能出现长回调，保留在 evidence，不把这次修复宣称为全进程所有任务都 ≤50 ms。没有更改它们的规则或通过删账本、改 golden 压低耗时。腾讯云 4 核单进程上的原始数字只作现象对照，不直接与本地机器绝对耗时作硬件等价比较。


## PR #390 评审修订（2026-10-22）

本地 `origin/multiplayer=db04d196` 已包含 #386。遵守不联网，没有 fetch；原树 `git merge --no-commit --no-ff origin/multiplayer` 因 Git 元数据只读而失败。在 `/tmp/settle-pr390-merge` 从本地对象离线克隆并三方合并，无文本冲突，合并结果通过 binary patch 还原工作区。上游已有的规则/版本/界面变动随合并保留；本次自行修改仅涉及 server、tests、docs 和 `combat-replay-view.ts` 的无结果变化 recorder fork。#386 的 Mel 唯一事件、本场 battleId 与完整 HP 收据/record 核对原样保留。

采用评审方案 **(a)**：暂存结算与回放，命令到达后废弃未发布切片，在原 round/seatRevision 的状态上 FIFO 执行，再有界重建。房间统一排队涵盖 bot、领球、控制权、连接标记、走路与 live 回调。策略 RNG 也随 BotDriver 整个事务延迟。排空操作按工作单元计预算；两个重试上限、返回值及 #382 复用约束见 [合同](MULTIPLAYER_CONTRACT.md#结算补算切片2026-10-22服务器调度补充)。

断线策略改为按已认证 session 执行与保存回执。WsGameClient 不会重发旧 inflight；superseded 宽限期同内容重发只取同一回执，不再执行，新命令仍被撤权拒绝。之前文中的“结算后执行/断线不执行”描述由本节及新版合同覆盖。

新增回归覆盖房间每个席位入口排队、真实法球领取、stale/restart 上限、真实 PvE 尾部购买的旧 revision 成功回执与客户端投影一致、关闭后执行及恢复回执、新旧连接同时重发与冲突。普通 PvE/实时金币两条路径比较同步截止前购买与首片后排队购买的完整状态及每次发布，包含全量领域账本。


评审后整局对照：`node scripts/settlement-slices-probe.cjs db04d196 artifacts/pr390-review` 通过。seed=42，八 Bot 至第 36 回合终局，终局全局状态、每轮全局 checkpoint（含完整战斗事件账本）与 Bot 意图 SHA-256 三项完全一致；[精简证据](evidence/pr390-review/comparison.json)。该轮与回归并跑，耗时受竞争/GC 影响，不能当隔离延迟验收；单个不可分割规则事务或 GC 仍可超过 20 ms。


最终验证：`npm run typecheck` 与 `git diff --check` 通过。`npm test -- tests/server/settlement-slices.test.ts tests/server/net/settlement-queue.test.ts tests/server/live-bank.test.ts tests/server/round-commit.test.ts tests/server/mel-save-settlement.test.ts tests/server/bot-driver.test.ts tests/server/v17-avarice-battle-end.test.ts tests/server/net/slow-task.test.ts --maxWorkers=2`：8 文件、50 项全部通过，包含 #371 原始 slow-task 四项。最后调整队列预算断言、真实法球测试时限后，`-t 'checks|queues every|bounds work'` 三项定向复验全部通过。额外使用旧 HTTP 监听桩运行 slow-task 四项也通过；并未用桩结果替代上述原始套件结果。

Git HEAD 保持 `7b37ec50`；工作区包含离线合并与评审修订。仅评审增量另存 `/tmp/pr390-review-only.patch`，供有 Git 写权限的环境先正式 merge 本地已核对的 upstream、再应用增量；本次没有 push。

## PR #390 最后一条 P1：首次重建后冻结（2026-10-22）

本轮起点 `codex/settle-slices` / `b3217bd0`。上述“有界重建八次”方案被本节及新版合同替代：第一次排队批次只触发一次重建，从该批次边界起冻结后续输入，继续按原 20 ms / tick 预算算到提交。后续命令在完整结算和阶段发布后 FIFO 执行，使用原始请求在最新状态上校验；同轮旧版本得到 `seat-revision-mismatch`，不改写版本、不消费 RNG，不再存在 `settlement-restart-limit` 的整局 fault 路径。

回归包括：假 CPU 时钟下超过九批连续输入仍只构造两次工作、每片保持预算，首批前置且后续严格在发布后执行；真实 PvE 在首批尚未排空时持续入队，旧版本拒绝回执可 dedupe，显式匹配提交后版本的命令成功，连接与走路在提交后落地。整局压力用例在八席中将真人连接席也交由 BotDriver 驱动（测试夹具，非九席），保留真人身份以实际改变连接标记；持续通过真实认证/校验/写队列提交买、卖、刷新、锁店、走路请求及 setConnected 抖动。bot 控制期间走路按既有门槛拒绝，正常真人走路另由前述冻结回归验证。

两次同 seed / 同输入序列运行，比较完整终局、每轮完整 RoomState 检查点（全部战斗事件、收据、共享池、RNG、版本、期限均不裁剪）、命令与回执 SHA-256。压力传输使用内存 ws / HTTP 桩，不访问网络；提升测试连接限流以持续施压，生产限流不变。

验收结果：整局双跑 `npm test -- tests/server/net/settlement-queue.test.ts --maxWorkers=1 -t 'finishes deterministically'` 通过（245.56 秒），八个控制席均有 bot 命令、真人买卖/刷新/锁店均有成功回执、冻结输入超过九批、所有已接受命令都有最终回执；两局均到达至少第 31 轮、排名完整且 fault 为 null，五类完整指纹（终局、逐轮账本、真人输入、回执、bot 命令）一致。该真实双跑用例时限为 600 秒；首次 180 秒时限不足，未计为通过。

定向三个文件共 17 项通过（包含真实冻结旧 revision 回执与 #371 原始 slow-task 四项）；扩展冻结中 abort/dispose 后，`npm test -- tests/server/settlement-slices.test.ts tests/server/net/slow-task.test.ts --maxWorkers=1 -t 'cancels|rebuilds once|task.slow'` 的 9 项通过。合计覆盖当前三个文件的全部 20 项不同用例。`npm run typecheck` 与 `git diff --check` 通过。只修改 server/tests/docs，保留工作区，HEAD 仍为 `b3217bd0`；没有联网、提交或 push。
