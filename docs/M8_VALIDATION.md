# M8 B10 验证记录

2026-10-11，Codex 按用户授权接替 Claude 完成收尾及必要显示修复。功能补测已完成；本记录严格区分已通过检查、未达性能目标与待外部签收事项。

## 候选与证据绑定

- 分支 `feat/m8-b10`，送审 [PR #30](https://github.com/catfish-xn/cat/pull/30)，目标 `feat/m8-b0-baseline`。尚未合入 main 或部署。
- BR4 补充脚本及干净复验：`b4ca11c7bac9f63c82416ded5bde0e013b11263f`，dev/preview 10 组全部通过，错误 0；两种模式各有 2 个真实技能暴击包。运行命令 `CHROMIUM_PATH=/usr/bin/chromium M8_BR4_EVIDENCE_DIR=artifacts/m8-br4-public-b4ca11c node scripts/verify-m8-br4-public.cjs`。
- 实测代码 `d901b3f33a9e210e69281ce141bcbbfdd4cdbb5f`，实测时工作区干净；源码指纹 `b7872f7d275876249f436c8f74729c5be642fd145eb14d808bed8450d42080ec`。
- 随后只新增 BR4 验证脚本及证据/文档，不改变 `src/`、原有测试与压力脚本、依赖或构建配置。本地结果属于上述代码 SHA；最终文档 HEAD 的 CI 单独列明，不能冒称本地全部重跑。
- 起点 `9fa8a6334b6cee862767fe39c4e35fc9eb8bac14`；`e2c98f5` 同步 main 文档；`510dc93` 纳入原 `2837b87` 文本恢复等价优化；`d901b3f` 按路线拆分新增等价测试，并准确记录实际 GPU。
- schema 6 / rules `m8-14.24b-v1` / content `s13-14.24b-m8-v1` / save 2 / replay 2 / command 2 / `lcg32-v1` / 50ms tick / digest `fnv1a32-utf16:c7ac9b0c` 不变。

## 环境与方法

Node 22.23.3、npm 11.9.0、Vitest 5.0.3、Playwright 1.63.0、Vite 7.3.6、Chromium 151.0.7922.173；容器 CPU 配额 4 核、内存上限 16 GiB。`os.cpus()` 的宿主机数量不是本容器配额。浏览器通过 `CHROMIUM_PATH=/usr/bin/chromium` 选择，实际 GPU 由 CDP 记录。

桌面、U3、U4 完成后关闭测试浏览器，再依次执行 M7 配对与领域/浏览器压力；正式采样没有并发运行本机测试或构建。GC 在路线之间显式调用，路线内 GC 不排除；不删首样或失败样本。完整运行的命令、时间、cgroup、两侧构建 SHA256 见 `evidence/m8-b10/results-d901b3f/formal-run.json`。

## 功能结果

| 检查 | 结果与范围 |
| --- | --- |
| `npm run build` | 类型检查、生产构建通过；最终 JS gzip level9 为 508,990 B |
| B10 三个单测文件 | 94/94：46 遭遇结果、45 全装备保存/回放、3 临时装备回放；优化前后均通过 |
| 恢复等价专项 | `m8-content-equivalence`、`m8-b8-copy-semantics`、`m5-serialization` 共 43/43；20,000 组 JSON、两条记录路线 text/object 入口相等、±Infinity 拒绝、原 canonical 对象语义及坏档校验 |
| `verify-m8-desktop.cjs` | 27 项通过：1440×1000、1440×600、1920×1080 × dev/preview；真实鼠标取消、D/F repeat、E 单次出售、弹层隔离、保存刷新继续、1/2/4×/seek 不改活动局、减少动效不改状态/账本 |
| Pages 子路径 | 严格 `/cat/` 服务器，40 项资源全 200、93 个请求，子路径刷新恢复；中立占位、帮助文案通过 |
| `verify-m8-u3-static.cjs` | 8 组通过：44 件及筛选、64 格/36 结果、逐字效果说明、原生 hover/focus、只读与 D/F/E 隔离、28 占位、真实 404 移除失败图并回退；真实公开操作存档经生产验证器验证 |
| `verify-m8-u4-status.cjs` | 15 场景 / 181 检查通过；实际组件和正式事件，五项历史规格差异与表现层观察保留在 manifest；不是整局画布检查 |
| `verify-m8-br4-public.cjs` | 10/10：拳套/TG、法暴、减抗、灼烧的原生合成/穿戴和完整战斗；非法组合/穿戴、临时子件只读、换轮与出售、第三张购买升星；5 份公开奖励/购买轨迹存档经生产校验器通过，浏览器完整 state/ledger 与权威续算相等 |
| 覆盖矩阵 | 44 件 × 独立值/战斗/保存回放缺格为 0；机制列来自正式 effect/program，源码引用是定位索引，实际通过由测试证明 |

命令：`npm test -- tests/m8-b10-encounter-outcomes.test.ts tests/m8-b10-item-save-replay.test.ts tests/m8-b10-temporary-replay.test.ts`；专项为 `npm test -- tests/m8-content-equivalence.test.ts tests/m8-b8-copy-semantics.test.ts tests/m5-serialization.test.ts`；浏览器三个入口均为 `node scripts/<上表文件名>`。桌面是对完整 33 战 CI 路线的补充，遭遇公开 Match / 引擎边界 / 纯结算向量的适用范围见 [encounter-outcomes.md](evidence/m8-b10/encounter-outcomes.md)。

## M7 配对与体积

基线 `15313a75c6e74beec739fe52a2875c104c55eae3`，两边各自锁文件、同 Node 22 构建；同机交替 9 个有效配对，另 1 个固定预热配对。命令：

```sh
node scripts/m7-budget.cjs --base=/workspace/m8-b10-m7-base/dist --js-base=/workspace/m8-b10-m7-base/dist --current=dist --samples=9 --out=artifacts/m8-m7-budget-d901b3f
```

| 指标 | M7 | M8 | 结论 |
| --- | --- | --- | --- |
| 首次可操作中位数 | 1,889 ms | 1,838 ms | 0.9730016×，≤1.20，通过 |
| JS gzip level9 | 424,763 B | 508,990 B | 1.1982918×，≤1.30；停止线 552,191 B，剩余 43,201 B |

原始 9 样本：M7 `[1788,1936,2110,2274,1889,1739,1699,1619,1891]`；M8 `[1873,1680,2653,1820,1591,1848,1700,1885,1838]`。CI 的旧首次可操作检查仍以 M6 为交互基线；这里才是计划要求的 M7 配对，未改 CI 参数。

## 新压力测量

命令 `M8_PERFORMANCE_EVIDENCE_DIR=artifacts/m8-performance-d901b3f node scripts/verify-m8-performance.cjs --target=preview`；30 固定公开路线、两种 9v9 各 seed 1..30，各自固定预热，完整浏览器战斗。总耗时 1,725,820 ms，`formal=true`、`errors=[]`、`allBudgetsPass=false`。脚本为原定报告模式，退出码 0 **不等于预算通过**。

| 样本 | 数量 | p50 ms | p95 ms | p99 ms | max ms | 结果 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 30 完整路线（990 战） | 326,641 tick | 1.349 | 3.928 | 6.734 | 516.354 | 通过 5/10 ms 目标 |
| 9v9 distinct，18 人/54 成装 | 30 战 / 3,394 tick | 9.877 | 40.772 | 111.611 | 663.865 | **失败** |
| 9v9 mirror，18 人/54 成装 | 30 战 / 4,005 tick | 9.504 | 46.131 | 135.567 | 5,250.918 | **失败** |
| 普通动效帧间隔 | 142 帧间隔 | 150.000 | 250.000 | 383.400 | 533.300 | 超过 33.3/50 ms；软件图形 |
| 减少动效帧间隔 | 168 帧间隔 | 116.700 | 200.000 | 316.600 | 866.700 | 超过 33.3/50 ms；软件图形 |

两种浏览器模式均为前台、hiddenIntervals=0，6-6 完整战斗 tick 381 / 1,738 事件结束，分别 21,616 / 20,999 ms；9 我方＋8 敌方、15 我方＋5 敌方装备，正式合法导入文件 18,540,119 B。CDP 实际 renderer 为 ANGLE / SwiftShader，WebGL `unavailable_software`，`frameAcceptanceEligible=false`。这些帧间隔不能签收硬件桌面性能；9v9 是独立纯领域 CPU 测量，不能归因于 GPU。该公开文件导入控件的等待观测为 42,686 / 30,485 ms（均在帧计时之外），不同于原 M6 模块专项的采样边界，保留该慢值而不以 CI 的 5,447.7 ms 替换。

30 路线每战事件最大 3,079；最大完整保存 22,848,531 B，最大单战记录 2,156,322 B。完成每条路线后采样点中的 Node heap 最大 136,289,520 B、RSS 最大 445,603,840 B，**不是连续采样的瞬时峰值**。活跃条目峰值（状态/任务/盾层）：公开路线 80/43/8、distinct 156/78/5、mirror 187/97/6；脚本相加 legacy 与 M8 运行字段，不宣称去重后的逻辑状态数。结束战斗的 990 个 tick 也计入总分布，单列诊断 p95/p99 为 5.600/10.118 ms，没有从通过统计中删掉。

测量结束后另做一次诊断：同 distinct 夹具 seed 1..10，先预热，仅对 stepCombat 循环启用 Node CPU profiler。`structuredClone` 自身采样约 41.36%，GC 约 5.60%，另有触发器分发/结果提交成本。该诊断含 profiler 开销，**不是重新抽样直到达标**，也不证明仅优化复制便可达标。保留原规则、历史输入不可变、完整事件和 RNG 顺序；后续应针对复制与触发路径作等价优化，再复测全部固定负载。9v9 预算未达标是节点三实际阻塞，不能由 CI 绿或普通路线通过抵消。

## 完整 CI

实测代码的 [CI #231](https://github.com/catfish-xn/cat/actions/runs/38138447854) 全绿：145 文件、2,056 测试通过，0 skip，773.23 秒；build、24 seed headless、既有性能、六条 dev/preview 三构筑完整路线、两模式输入、U3 动态、U6 掉落、retention 和 compare 全部通过。独立可选诊断 workflow 未启用而 skipped，不是测试断言 skip。

最终比较器对三构筑各 33 场完整战斗、全部领域路线、12 份 M6 manifest 比较通过，`skippedBrowserRoundIds=[]`、`skipped=[]`。sniper 原恢复用例耗时 147,284 ms，低于原 180,000 ms；其余 cannon/mage/sniper-caitlyn 为 96,501 / 137,605 / 131,917 ms。input-dev 本次约 23 分钟，原 32 分钟 job 预算未改；这次通过不消除历史 runner 波动，#26 仍是独立改进事项。

| 既有真实 33 战应用预算 | 实测 ms | 上限 ms |
| --- | ---: | ---: |
| 增量捕获 p95 / 增量写入 p95 | 24.8 / 14.9 | 50 / 250 |
| 完整捕获 p95 / 激活 max | 64.8 / 271.5 | 500 / 1000 |
| 完整导入 max / 首次 seek max | 5447.7 / 715.8 | 30000 / 2000 |
| 缓存 seek max / 40 tick 统计 max | 20.8 / 0.2 | 100 / 5 |

30 次模块生命周期堆增量 -102,028 B；完整应用 dev/preview 分别 +880,804 / +986,500 B，监听器分别 85→85 / 84→84，RAF 均 1→1。H1 `warn-only` 不变，单次未超线不能宣布根因关闭。原 CI artifact 的三份比较/验证 JSON 已归档。

BR4 补充脚本和证据归档后的最终 HEAD 重新执行原完整 CI；最终送审 SHA、对应 run 与结论固定写入 [PR #30 正文](https://github.com/catfish-xn/cat/pull/30)。本页明确固定代码 CI 与最终 HEAD CI 的边界，不把旧 run 冒称新提交的结果。

## 首失败及纠正

- 同 tick 灼烧夹具首次误以为中立可受超过 100 的单次灼烧伤害；改为明确 100 当前 HP 的边界输入，仍要求 tick20 同时死亡，正式机制不改。
- U3 首次遍历未设置显式超时，主动停止后加入有界等待；滚动将锚点移到静止指针下时会关闭浮窗，改为移出再重新进入。受控 404 的实际合同是移除失败 img 并保留文字色块，修正测试的“仅隐藏图片”错误预期。
- 桌面首次误认为 D/F repeat 只提交一次、Esc 取消棋盘拖拽；按已有合同验证两次 repeat 的精确公开命令结果，以及移出有效格释放取消。先断言手势真正开始，防止原格释放的空通过。
- 临时装备回放与浏览器并行时触及原 5s 超时；停止并发后原条件通过。新增恢复等价测试把两条完整记录路线合在一例时耗时 5928ms，按 cannon/sniper 分成两例，全部状态/断言不变，未放宽 5s 限制。
- [CI #230](https://github.com/catfish-xn/cat/actions/runs/38137104517)，`1042730`：143/144 文件、2051/2052 测试通过，旧 sniper 用例 180041ms 超时（节点二为172417ms）。input-dev 另在32分钟任务上限取消：截至 m6-persistence-retry 均通过，最后的 application-failures 未给出完成结果，compare 因此 skipped。不能写作“其余全部绿”。
- 该恢复阻塞促使纳入 `2837b87` 等价优化（本分支 `510dc93`）：只省去 JSON.parse 输入随即丢弃的 canonical 字符串构造，对象输入、全部校验、digest 和旧测试体不变；CI #231 复验全绿。旧失败日志及 input-dev 摘录保留，未改 CI 配置/预算。
- `7e24056` 曾通过桌面27项、U3 8组、U4 181项；当时 M7 配对1755→1824ms（1.0393×），JS508943B。其压力运行在未计时准备阶段停止；本页采用优化后 `d901b3f` 完整重测，不把中断运行当正式结果。
- BR4 的最终补测源于作者复核发现：已有 U3 动态脚本明确注入装备夹具，不能替代总计划 BR4 公开操作/合法导入要求。补充专用脚本验证公开奖励取得组件、原生合成/穿戴及完整战斗，不删除原 U3 动态检查。

- BR4 法暴首轮用了旧 `damage` 事件名，正式 replay2 是 `packetDamage`，导致准备阶段误报无暴击；改为正式事件类型，仍断言真实技能暴击包数量大于 0。未修改输入 seed 或生产行为；首轮日志和 manifest 保留。

## 外部签收与交付

9v9 CPU 压力预算未达；固定 f58 的只读[功能源码/证据独立审查](M8_NODE3_FUNCTIONAL_REVIEW.md)范围内无新 P1/P2，未独立重跑 CI 或浏览器，不签收性能分支、硬件桌面性能或用户试玩。独立性能分支、新的配对测量及提案见 [M8_NODE3_PERFORMANCE.md](M8_NODE3_PERFORMANCE.md)；本页原报告不改标签。PR 保持 draft，main 与 Pages 未改。issue #23 仅依据节点二同 SHA CI #229、PR #29 合并签收说明关闭，不能作为 B10 独立签收。

固定代码报告在 [results-d901b3f](evidence/m8-b10/results-d901b3f/)，BR4 干净复验及源码等价绑定在 [results-b4ca11c](evidence/m8-b10/results-b4ca11c/)。两者 src tree 均为 `49fb300c5ca6f014201f289a87f8d5a54649c551`，tests tree 均为 `3509408ef4fee47d6ca76deaeb9cc146fe8ab7fa`；压力测量后只新增 BR4 脚本，没有把旧测量重贴成新 SHA。完整日志、截图、公开存档及原始生成物保留于 `artifacts/`，不纳入运行包或 Git；可复查的预览包和 SHA256 清单见交付说明。H1 保持告警模式；issue #27、#11 与未定位 H3 不写成已解决。
