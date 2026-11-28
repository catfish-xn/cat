【服务器】

调查基线：`claude/v26-late-game-perf`，HEAD `5c376b5ef69f2c5b384f5466367bca609ed1d0ad`，Node v22.23.4。没有提交、部署或修改测试服。原有未跟踪的 `assets3d-local` 保留。只修表现层的资源复用和重复 DOM 创建，`src/server/`、`src/simulation/`、规则、内容身份和存档格式均未修改。

本地方法：`scripts/profile-late-game.cjs` 使用真实 Room、ManualClock、BotDriver、TwoSidedBattleResolver、共享选秀和当前 `combatStreaming: true`，八席均由 bot 从开局玩到自然结束。保持 100 tick / 20 ms 分片，注入已有的 `sliceNow` 测 CPU 预算；守恒校验保持开启。独立脚本包装时钟回调、Room 发布和守恒校验，为八个模拟接收者执行真实公共/私有投影及 JSON 序列化，流式消息只序列化新增 tick。没有增加服务器计时 API，也没有真实 WebSocket/压缩/发送的成本。

逐轮原始数据：`artifacts/lag/baseline/report.json`（seed 42，36 轮，止于 6-5）、`artifacts/lag/seed7/report.json`（seed 7，33 轮，止于 6-2）。额外的 round 0 是等待/开局记账，不计作对局轮数。`baseline.cpuprofile` 是修正测量脚本后采用的 CPU profile；`before.*` 是早期试跑，统计代码曾扫描整段回放，不能用作耗时结论或优化收益。

seed 42 每轮平均 CPU 毫秒如下；轮次中的选秀也纳入平均。**发布、守恒、投影互有包含，不能相加**；“整轮”是该轮所有回调累计，绝不是一次阻塞或战斗墙钟长度。显式 GC 和检查点哈希在回调计时之外；CPU profile 本身仍包含这些诊断工作的采样。

| 阶段 | 轮数 | 整轮回调合计 | 战斗工作（含录制） | 房间发布 | 其中守恒校验 | 投影 | JSON 序列化 | 最大单回调 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 1048.8 | 732.2 | 130.8 | 22.6 | 95.9 | 22.0 | 53.1 |
| 2 | 7 | 1858.7 | 1422.5 | 171.8 | 29.7 | 103.0 | 42.4 | 65.5 |
| 3 | 7 | 2681.8 | 2001.6 | 302.4 | 45.4 | 197.9 | 61.2 | 108.2 |
| 4 | 7 | 4250.4 | 3254.0 | 439.4 | 85.6 | 248.8 | 99.8 | 244.9 |
| 5 | 7 | 3849.0 | 3005.9 | 374.2 | 57.9 | 227.9 | 79.6 | 241.0 |
| 6 | 5 | 2932.4 | 2332.8 | 247.9 | 40.0 | 142.5 | 55.3 | 137.8 |

4 阶段后明细（毫秒），可用原始 JSON 检查发布次数、回调数、发送字节和流式帧数：

| 回合 | 整轮推进合计 | 发布合计 | 最大一次发布 | 最大单回调 |
| --- | ---: | ---: | ---: | ---: |
| 4-1 | 4687.5 | 574.9 | 28.0 | 115.9 |
| 4-2 | 5078.9 | 575.2 | 33.2 | 116.8 |
| 4-3 | 4581.0 | 322.5 | 23.7 | 114.3 |
| 4-4 | 253.2 | 111.6 | 30.5 | 93.6 |
| 4-5 | 5774.1 | 442.6 | 26.1 | 109.9 |
| 4-6 | 6188.6 | 557.2 | 31.9 | 135.0 |
| 4-7 | 3189.4 | 491.8 | 30.2 | 244.9 |
| 5-1 | 6737.1 | 1140.6 | 52.1 | 241.0 |
| 5-2 | 4616.5 | 204.6 | 24.0 | 75.9 |
| 5-3 | 5292.4 | 193.6 | 24.5 | 63.6 |
| 5-4 | 295.5 | 90.7 | 19.7 | 155.2 |
| 5-5 | 3844.4 | 506.4 | 139.4 | 141.4 |
| 5-6 | 4629.7 | 177.7 | 22.1 | 53.2 |
| 5-7 | 1527.2 | 305.6 | 116.2 | 121.2 |
| 6-1 | 4805.7 | 556.3 | 25.9 | 137.8 |
| 6-2 | 4399.1 | 199.8 | 25.5 | 64.5 |
| 6-3 | 3405.8 | 275.5 | 103.2 | 109.0 |
| 6-4 | 108.7 | 64.6 | 19.3 | 43.0 |
| 6-5 | 1942.7 | 143.5 | 11.7 | 109.6 |

CPU profile 的包含子调用占比：`advanceS13Tick` 41.94%，回放 recorder 的 `record` 22.82%，`copyCombatUnitForTick` 7.44%，`assertSharedPoolConservation` 3.01%，`recordRoomPublication` 0.59%，`toPlayerView` 1.42%，`toSeatPrivateView` 3.99%；GC 自身 5.90%。这些类别存在嵌套，不能求和。`freezeOwned` 若把递归栈上每一帧的包含时间相加会得到 14.12%，同一采样被重复计入；只计最外层调用后约为 3.84%，且分散在多条路径，不能只凭它的名字推断是某一张历史表。

最终再跑 seed 42（`artifacts/lag/final/report.json`、`final.cpuprofile`），36 轮完整结束，所有检查点与最终 Room JSON 的 SHA-256 均与 baseline 一致：最终 `4a9001352b5657f881812d3f24b7c499c22bea9d0b8e8f0995d967df89e510fd`，检查点 `c0f9417a6d60ed6e29d605465bba4d943c133c63c97b46007571a8e162ae1e22`。这不是服务器优化前后性能收益：领域/服务器没有改动，重复测量用于确定性检查。新增的回调来源观察表明，4-7 最慢 232.7 ms 在 battle 流式推进边界，5-1 最慢 201.0 ms 在 preparation 的 bot 指令，6-1 最慢 140.5 ms 也在 bot 指令；问题不限于战斗循环。bot 指令可能包含规划、交易、发布等，不能把整个 callback 的时间全部归给发布或守恒。

判断：战斗/投影/录制随单位与技能数量上升，淘汰后回落；本次数据不支持“仅随回合数平方恶化”。守恒校验会遍历收据等历史，且持有单位匹配仍有局部平方查找，但当前持有/选秀规模有界、实测占比约 3%，没有依据先删断言或关掉校验。augment history 已线性化的发布记账约 0.6%，也不是本次首要热点。

snapshot 审计：`Room.state` 直接返回当前不可变发布引用（`room.ts:433`）；公共席位、私有视图及回放派生缓存是 WeakMap（`projection.ts:26,178,248`）。当前流式广播使用独立 cursor，只取新增 tick（`net/server.ts:415`），不是每 tick 序列化整场或整局。房间跨轮清理 streams/frozenInputs（`room.ts:1941`），没有发现保留每一轮 Room 快照的强引用列表。

seed 42 GC 后采样堆从 2-1 约 32.5 MiB 增至 6-5 约 86 MiB；同一期间来源收据从 174 增至 873。采样在进入下一轮时给上一轮记账，因此不是精确战斗瞬时值。流式帧峰值没有跨回合单调累加（4-1 为 2860，6-5 为 588，八个席位视角相加，包含镜像）；两个 seed 结束并 dispose 后 timers/listeners/frozenInputs 全部 0，pendingSettlement/resolving 均 false。堆增长包含合法历史与有界缓存，不能据此声称已证明没有服务端泄漏；本任务没有跨多局的堆快照支配树证据。

测试服只读检查：`/healthz` 的 sha 确认是 `5c376b5e`，状态 ok，对局于 6-3 正常结束、fault=null。服务自 20:55:50 CST 启动，NRestarts=0；服务 cgroup 当前约 160 MiB、峰值约 183 MiB，进程 RSS 约 207 MiB（两个统计口径不可混用）。两次相隔约 7 分钟的闲置进程 RSS 为 212072/212144 KiB，healthz 的 rssBytes 均约 216756224；这只说明闲置窗口平稳，不是对局内存曲线。

`journalctl` 只有启停，因为 stdout/stderr 配置为 append 文件。实际读取 `/srv/cat-playtest-v20/logs/game.log` 与 `game-error.log`，后者 0 字节。按本次服务启动后筛选，实际有 32 条 `task.slow`、33 条 `round.perf`，有一次 **1-2** 的 loop.lag=122 ms / p99=10 ms / queueDepth=0；没有超时、房间故障或背压断开记录。后期逐阶段最大战斗/投影/任务耗时：

| 阶段 | 最大战斗工作 ms | 最大投影 ms | 最大任务 ms |
| --- | ---: | ---: | ---: |
| 3 | 52 | 36 | 67 |
| 4 | 66 | 11 | 79 |
| 5 | 70 | 55 | 89 |
| 6 | 82 | 6 | 82 |

5-2 的单次战斗工作 67 ms、投影 42 ms，6-2 的单次任务 82 ms；确有服务器尖峰，但流式客户端已有 200 ms 缓冲，不能仅凭这些尖峰认定每次都造成可见卡顿。只读证据保存于 `artifacts/lag/tencent-full.txt`、`tencent-logs.txt`。

【客户端】

没有 CODEX_BROWSER_CLIENT / PLAYWRIGHT_WS_ENDPOINT，按任务要求做静态审计、真实纯 CPU 组件微基准，以及极小 recording canvas/节点计数器；没有使用 JSDOM 或把 Node 计时称作浏览器 FPS。最初标准 Vitest 配置的共享 globalSetup 会自动尝试 launchServer，后续改用 CPU-only 配置跳过；没有执行浏览器渲染验收。需要 Claude 通过 `codex-browser exec` 新启动浏览器测试任务才能确认 GPU、布局/绘制和真实素材的耗时。

`scripts/profile-late-game-client.cjs` 的真实路径微基准与数量报告在 `artifacts/lag/client-before/report.json`、`client-after/report.json`；baseline 通过只读 `git show HEAD:...` 覆盖被测 minimap 模块，未更改工作树。每项先预热 200 次，再采样 800/1000/2000 次；绝对毫秒仅作 CPU 结构定位，不是设备性能承诺。

| 路径 | 输入规模 | 观测/复杂度 |
| --- | --- | --- |
| placeholder-renderer 的单位更新 | 8 / 24 / 48 单位；合成每单位 24 根骨骼、真实 AnimationMixer | CPU p95 约 0.06 / 0.26 / 0.52 ms，随单位/骨骼数增长；省略实际 GPU、真实模型和其余场景模块，不代表整个 tick |
| unit-overhead | 48 单位、每单位 1 装备，HP 变化 | recording canvas p95 约 0.04 ms；条值/装备键已有去重；Canvas 上传和绘制未测。装备 stacks 变化会重建整行图标/徽章，属进一步可优化的分配源 |
| LTK 真引擎/真 buffer writer | 1 / 3 / 6 系统，合成 150 粒子/系统 | 900 粒子时 CPU p95 约 2.05 ms；低粒子量时明显更小。系统上限 6、排队上限 64、每系统根/子粒子槽预算 150+100 已存在 |
| LTK render passes | 棋盘/骨骼与粒子 | `passes.ts:17` 每次扫描场景；ground/soft/early/late 会增加整场景遍历、depth draw、拷贝和多次 draw。这是 GPU/真实骨骼数下的重点候选，纯 Node 无法验证 |
| 侦察 | 40 次切换、12 单位 | 每轮 161 个节点、12 份共享资源，清理后节点 0；show 的内容/布局键去重已存在，不随回合积累 |
| 侧栏 | 每次 onView，8 席 | `players-sidebar.ts:88` 每次排序并 replaceChildren 所有 seatRow，重建头像、文字和交互监听；O(8 log 8 + 头像/DOM)。tick 只更新倒计时，不是每帧重排全部八席；DOM 样式/布局耗时未测 |
| 合星/星标 | 1–4 星/单位 | createStarMark 同级不重建；几何/材质每标记各一份，销毁释放。每颗星 onBeforeRender 都更新整行矩阵，多星有重复工作，但最多四星，规模有界 |
| 弹道/技能 feel | 40 轮，每轮 48 次攻击 | 固定池 128 节点，40 轮仍 128，过期 visible=0。Renata 专用弹道/范围等则逐次分配并有 dispose，不是无限历史 |

确定的平方级客户端路径在**单场战斗内的流式回放追加**：`ws-client.ts:400` 每块展开复制整个已收 tick 数组；`remote-session.ts:111,181` 自己/观战的每次修订用 `.every()` 重新比较整段前缀。实际调用 RemoteSession、逐 tick 追加到 300 / 600 / 1200 tick，Proxy 只计数数组引用读取，得到 **90300 / 360600 / 1441200** 次。翻倍战斗长度，比较工作约四倍。Proxy 会放大时间，报告不把它的 wall time 当生产耗时。当前不可变旧回放与重连/修订的边界都需要保留，不能只删掉检查或改成原地 push。

历史保留审计：RemoteSession 的 `finished` 明确用于整局战斗回顾（`remote-session.ts:55,94`），每轮只保留一份，修订替换该轮引用。合成每轮 601 帧，10/20/30/40 轮分别保留 6010/12020/18030/24040 帧；`forgetBattles()` 后 0。属于有意的线性内存增长，未擅自删历史、缩短完整事件账本或改变存档字节。当前 `played`/combatLedger 按战斗/轮次重置，观战只有当前一份；WsGameClient 的 current own/watch 引用也被替换，没有发现自身无限追加对局历史的列表。

【根因排序】

这是按证据与下一步价值排列的候选，尚不能把用户这一次卡顿唯一归因到其中某项。

1. **战斗/录制及开局、发布边界的主线程尖峰（已实测）**：后期每 tick 工作更重，20 ms 分片不能拆开一次重的原子计算；测试服出现 50–89 ms 工作，本地八接收者场景有超过 200 ms 的回调。先定位原子步骤和发布边界，再考虑把不改变结算顺序的展示投影/录制工作拆分；不能通过增大超时/阈值或删校验“优化”。
2. **3D 单位、粒子、多 pass 和真实素材的 GPU/CPU 负载（结构明确，实际 GPU 待证）**：后期同时出现更多单位/高费技能，多次 scene render 会重复处理骨骼和透明对象；目前 CPU 合成数据不足以证明真实 GPU 已超预算。
3. **流式回放全前缀复制/比较（已确认 O(T²)）**：主要跟战斗长度而非整局轮次相关；应做独立的分段缓冲/已验证追加路径，保留旧记录不可变性及修订检查。
4. **重复 DOM 创建和侧栏重建（已确认）**：小地图本次已消除内容不变时的重建；侧栏下一步按席位/显示字段更新，需要同时验证掉血效果、排序、焦点和监听器。
5. **占位图标材质累积（已复现并修复）**：是明确资源生命周期问题，但单份材质很小，不能声称修完它就解决所有后期卡顿。

【已修复】

| 文件:行 | 原因与变更 | 前后证据 |
| --- | --- | --- |
| `src/rendering/three-mode/placeholder-renderer.ts:624,668` | 召唤物/铁砧 fallback 每次分配 SpriteMaterial 并进入 renderer 长期 owned；按 icon URL 共用材质，所有权仍在 renderer，纹理由原缓存管理 | 同图标 40 轮出现/消失，保留材质 **40 → 1**；纹理加载一次；最终材质、纹理 dispose 各一次；RAF 清零 |
| `src/rendering/online/scout-minimap.ts:23` | 对实际绘制字段生成紧凑键；跨 JSON clone、只变商店/时钟的发布不再 replaceChildren | 8 席各 8/24/48 单位，1000 次内容相同发布额外节点 **96000/224000/416000 → 0**；对应 CPU p95 约 **0.053/0.088/0.176 → 0.019/0.045/0.080 ms**，不含浏览器 layout/paint |

新测试在原始 HEAD 上确实失败：材质数量为 40 而不是 1；小地图替换了原节点。修复后两项均通过，并检查名字/血量/存活/座位顺序/自己与对手/单位格子/种类/召唤标记/侦察选择的失效，避免缓存造成旧显示。另补真实 LTK 40 轮共 240 份 draw 的几何/材质释放，以及弹道池/侦察资源数量不增长测试。

验证：10 个相关文件共 **50 项测试通过**；另跑原有 2D/3D 静态依赖隔离与真实产物体积门禁 **1 项通过**，所有 Vitest 命令均保留 `--maxWorkers=4`。typecheck 与 production build 通过，`git diff --check` 通过。没有删/改旧断言、延长超时、提高任何阈值。

2D 顶层 `dist/assets/*.js`，逐文件 GNU `gzip -n -9c` 求和 **627164 B ≤ 637144 B**，余量 **9980 B**。隔离测试另按原有 Node gzip-9/真实静态依赖图验证，未移动分包边界或改变门禁。构建日志中的 gzip 使用不同压缩口径，不能拿它和 GNU 数字直接相加比较。

复现（生成物均留在 gitignore 的 artifacts）：

```bash
mkdir -p artifacts/lag
node --expose-gc --cpu-prof --cpu-prof-dir=artifacts/lag --cpu-prof-name=baseline.cpuprofile scripts/profile-late-game.cjs artifacts/lag/baseline 42
node --expose-gc scripts/profile-late-game.cjs artifacts/lag/seed7 7
node scripts/profile-late-game-client.cjs artifacts/lag/client-before --baseline
node scripts/profile-late-game-client.cjs artifacts/lag/client-after
```

本工作区 node_modules 指向只读位置，Vite 默认 config bundle loader 写 `.vite-temp` 会失败；使用 `--configLoader runner`。CPU-only 测试使用 `artifacts/lag/vitest-node.config.ts`：沿用仓库测试配置/断言，仅给所选纯 Node suites 取消会启动浏览器的共享 globalSetup，并将 cache 放在 artifacts；`LAG_BASELINE=1` 只读覆盖上述两个模块验证红灯。此临时配置不提交、不替换仓库配置。

【建议】

优先让 Claude 用 `codex-browser exec` 连接桌面 Chromium，复测真实后期阵容、同一窗口分别开/关 LTK，并录 CPU/GPU frame、draw calls、纹理/几何量、长任务和 stream buffer frontier。然后分别处理录制/发布边界尖峰、分段回放追加、侧栏局部更新；每一步保持相同 seed 的事件、RNG、最终状态/存档字节一致。保留现有日志与所有断言。

【风险】

本次没有真实 GPU、真实素材或布局/绘制测量；不能宣布“后期不卡了”，也不能证明服务器尖峰就是用户肉眼卡顿的唯一原因。两个本地 seed、一次线上完整日志也不能覆盖所有强化/装备/召唤组合。全局回放是产品功能，继续保留；跨多局强引用/堆增长需单独做 dominator/GC 复测。当前修复只改变对象复用与是否重复创建相同 DOM，不改规则、事件顺序、协议或存档格式。
