# 联机规则层性能修复：合并 829128f 后复测

起始分支经 fetch 核实为 `e809a7fe51ba774060cc553d10d952932dd44f5b`。按追加指令合入 `multiplayer` 的 `829128fcaf665b11559884986207600c66369be1`，合并基底为 `79fa6b9adf8e75064d48e6c43837163fd6cc8cda`。性能代码提交为 `c13ed47194865502cb99c6258b6951e5a8c1b996`。新机制的规则与 `validateDynamicResult` 校验均保留。最终测量使用这个合并基底与候选源码比较，避免将 #150 的规则变化混入优化对照。

Node 22.23.3、Linux，同机串行。原始日志、压力采样、完整账本和 Inspector profiles 保存在 `/workspace/scratch/mp-sim-perf-integrated/` 与旧诊断目录 `/workspace/scratch/mp-sim-perf-followup/`；本目录 `metrics.json` 保留每局指标、对照摘要、原始证据哈希及源码哈希。

## 实现

- **复制与 CI 边界：** 去掉 `combat-static.ts` 每字段的临时 `{ [key]: value }` 包装，直接写 detached spread 的同一自有属性。保留只读记录共享与可写状态复制，并恢复原生复制边界在读取全部自有字段后对 `mechanismDefinitions`、`mechanismState`、`triggerLedger` 的有序二次读取，以及复制后的条件/值重读。不是空读补丁：三项读取仍控制排除复制和最终引用覆盖。原 `tests/m8-node3-copy-boundary.test.ts` 未改，3 条通过。
- **回放冻结：** 新增任务内深冻结器，WeakSet 仅记录显式传入的根，随任务释放；所有后代仍递归冻结。独立视图/reducer 不记录任何新冻结标记。这样每 tick 的视图节点不再不断扩张全局冻结表；浅冻结包装的内部仍完整冻结。没有改为首次执行采集回放。
- **战斗收尾：** 初态和每个账本事件在生成时冻结并执行原 `canonicalContent`，最终校验其余全部字段；收尾复用已经冻结的根。`proposeSettlement` 仅复用本模块产生的同一深冻结对象的完整规范化证明，外部 clone/spread/其他结果仍全量规范化。事件顺序、胜负、幸存者、成长、动态机制等校验未删减。
- **启动：** `compileBattle` 删除对已独立恢复且由编译器持有的数据的重复整图 `structuredClone`。输入恢复、重编译、派生字段比较全部保留；因此大输入的恢复与校验仍可能形成长启动切片。
- 相对合入后的 multiplayer，未手动修改 `src/server/`、`src/rendering/`、任何既有测试、数值、版本或时限；本轮仅在 `tests/mp-sim-perf.test.ts` 新增两项冻结/外部输入校验回归。旧分支的短文本缓存仍只保留 `< 2048` UTF-16 码元文本。

## 原 e809a7f 的 GC 回退诊断（合入新规则前）

同一未修改提交额外跑了两轮 GC 组，每轮一局预热和三局测量。六局 GC 后 RSS 为 **466–513 MiB**，观测峰值 **504–552 MiB**，各局准备命令 RTT p99 为 **64–98 ms**。上轮 687 MiB 平均 RSS、875 MiB 峰值、317 ms p99 没有复现。

上轮高 RSS 的第二、三局分别为 805、810 MiB，第三局回放载荷却从第二局的 52.0 MiB 降到 27.9 MiB，GC 后活堆亦下降。这符合峰值之后进程仍保留内存页的现象，不能把 RSS 当作存活 JS 对象量。RealClock 压测接纳的命令、轮数和阵容也不完全相同。没有上轮峰值时的 heapTotal/GC 轨迹，不能唯一定位当时究竟由哪次 GC 或分配器扩容触发。

为分离两个改动，新增 `scripts/mp-sim-allocation-probe.cjs`，用相同 seed 42、八机器人、39 轮、168 场战斗，分别在内存 bundle 中换回旧复制、旧缓存或两者。使用 Inspector 分配采样（包含已被 minor/major GC 收集的对象）与 CPU 采样；不改任何仓库规则源文件。四组终态及完整账本 SHA-256 均一致。

| 固定输入诊断组合 | 累计采样分配 GiB | 规范化调用栈分配 MiB | 运行中 RSS 峰值 MiB | 活堆峰值 MiB |
|---|---:|---:|---:|---:|
| e809a7f | 19.36 | 2516.1 | 602.1 | 318.9 |
| 只换回旧复制 | 20.32 | 2514.2 | 588.2 | 294.9 |
| 只换回旧缓存 | 19.23 | 2375.9 | 651.8 | 375.9 |
| 两者均旧 | 20.20 | 2371.2 | 665.8 | 371.4 |

复制优化降低了累计分配，structuredClone 的 CPU 自耗采样从约 10.39 秒降至 3.08 秒。短文本边界确实会重建大文本，但对照中只增加约 140 MiB 累计临时分配，约占总分配的 0.7%，并降低堆峰值。没有证据支持新增大块复制是上轮高 RSS 的直接原因。取舍是保留降低复制成本和存活文本量的现有优化，不因一次未复现的 RSS 高水位恢复整段缓存或全单位复制；本轮继续去掉已确认存在的逐字段临时包装分配。采样有开销，这些数据只用于归因；诊断的累计分配量、峰值和生成 profile 后的内存都不能替代真实网络压测指标。

## 合并后字节对照

三局完整八机器人对局，seed 42/7/11，共 481 个已完成战斗任务、327,927 条事件、4,346 次机器人操作。终态（含收据、池、排名、结算和 RNG）、完整账本和全部操作的解压字节完全相同；仅排除服务器调度的 roomRevision。JSON 账本累计约 896.6 MB，直接比较 Buffer，不只比较摘要。

全部 389 个非空 PvP/PvE 回放输入逐一对照：357 个成功结果逐字节一致；32 个在合并基底、候选源码、纯 829128f 均抛出相同 `RangeError: replay-divergence`，单独记录为既有拒绝，未计为成功回放。示例 `bot-room:r23:b1` 的兰博熔炉初始追加在队列末尾，首 tick 按 ID 排序后违反 `alignReplayUnits` 的存活单位顺序校验。这是上游既有问题，本轮性能修改不改变其行为。详见 `upstream-replay-rejection.md` 和 `metrics.json` 中逐场结果。

## 指纹与相关验证

按 `docs/evidence/g2-4b/MIGRATION.md` 的 #180 流程，统一使用合并基底 `79fa6b9adf8e75064d48e6c43837163fd6cc8cda`：

```sh
node scripts/record-g2-4b-release.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda
node tests/fixtures/record-g2-4b-herald.cjs --write
node tests/fixtures/record-g2-4b-herald.cjs
node scripts/record-g2-4b-inputs.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda
node scripts/record-g2-4b-inputs.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda --check
node scripts/record-g2-4b-live-reveal.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda
node scripts/record-g2-4b-live-reveal.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda --check
node scripts/record-g2-4b-release.cjs --baseline-commit=79fa6b9adf8e75064d48e6c43837163fd6cc8cda --check
```

Herald 默认模式仅校验，当前 g2-4b 的源码 manifest 必须先用该脚本支持的 `--write` 更新。追加指令后没有运行历史 g2-3 或 augments 目录的重录写入命令；合并时取 multiplayer 的历史文件，二者逐字节一致。release/live 审计也按同一基底重新生成，以满足仓库的跨审计基底一致性断言。数据 fixture 不应有变化，只有源码清单/基底审计元数据更新。

串行预检 6 文件 / 100 条通过，18.79 秒；类型检查通过。随后完整 67 文件 / 1,219 条全部通过，966.53 秒；补充新机制、复制边界及 M6 的 29 文件 / 314 条全部通过，72.15 秒。后两轮覆盖 96 个不同文件、1,533 条测试，0 失败、0 跳过。两份清单见 `test-files.txt`、`extra-files.txt`。所有 Vitest 运行均使用 `--no-file-parallelism --maxWorkers=1`，没有运行全仓库套件。

## 压力与 M6 测量方法

使用原 `scripts/loadtest-room.cjs`（复用 tests/server 压测驱动），每组 1 局预热、3 局测量；前后均分别运行普通八席和 `--expose-gc` 八席组，所有组、测试和探针串行。普通组没有显式 GC，其结束 heap 不能称为 GC 后活堆。GC 组明确记录 gcApplied。RSS 峰值为该局观测峰值，另保留进程生命周期高水位；RTT 为该局准备命令 p99，最长切片为 server.sliceWallMs.max。

M6 使用原 `scripts/verify-m6-performance.cjs` 和已安装 `/usr/bin/chromium`，纯 829128f 与候选源码串行各一次；每次仍包含原始三次 firstSeek、完整导入、持久化、满载与生命周期流程。2000 ms 等原门禁完全未改。环境指定仅用脚本支持的 CHROMIUM_PATH、M6_EVIDENCE_DIR。

<!-- MEASUREMENTS -->

## 合并后实际测量

普通组为结束时采样（未显式 GC）；GC 组为强制 GC 后采样。RSS/堆单位 MiB，延迟单位 ms。峰值为该局观测 RSS 峰值。

| 组别 | 局 | 轮数 | RSS | heapUsed | RSS 峰值 | RTT p99 | 最长服务器切片 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 改前普通 | 1 | 34 | 527.64 | 114.42 | 542.67 | 320.02 | 260.19 |
| 改前普通 | 2 | 34 | 629.66 | 99.27 | 664.95 | 30.47 | 211.06 |
| 改前普通 | 3 | 41 | 604.30 | 112.47 | 649.77 | 252.69 | 435.47 |
| 改后普通 | 1 | 32 | 579.67 | 188.75 | 591.10 | 100.98 | 124.52 |
| 改后普通 | 2 | 36 | 598.10 | 127.90 | 613.01 | 126.54 | 235.59 |
| 改后普通 | 3 | 39 | 550.86 | 318.48 | 610.07 | 230.87 | 126.36 |
| 改前 GC | 1 | 36 | 629.93 | 90.63 | 700.54 | 140.86 | 226.21 |
| 改前 GC | 2 | 34 | 650.27 | 94.20 | 680.16 | 39.75 | 200.74 |
| 改前 GC | 3 | 37 | 651.14 | 97.06 | 689.35 | 33.64 | 232.63 |
| 改后 GC | 1 | 34 | 575.07 | 84.19 | 587.89 | 51.41 | 247.93 |
| 改后 GC | 2 | 34 | 591.52 | 80.63 | 609.39 | 65.79 | 301.95 |
| 改后 GC | 3 | 34 | 562.07 | 85.10 | 600.55 | 56.07 | 135.41 |

普通组平均 RSS 587.20 → 576.21 MiB，结束 heapUsed 108.72 → 211.71 MiB（含未收集垃圾，不能当作活堆）。三局最差 p99 320.02 → 230.87 ms，最大切片 435.47 → 235.59 ms。

GC 组平均 RSS 643.78 → 576.22 MiB，活堆 93.96 → 83.31 MiB；观测峰值 700.54 → 609.39 MiB，进程生命周期高水位 704.16 → 616.66 MiB。三局最差 p99 140.86 → 65.79 ms，**最大切片却从 232.63 增至 301.95 ms**，三局最大切片均值 219.86 → 228.43 ms，没有消除尾部尖峰。最大值出现在改后第 2 局第 22 轮 PvP（user CPU 354.84 ms、system CPU 5.82 ms）；时间区间对齐将其定位到 `room-1:r22:b0` 的第 156/511 次 resolver advance（301.87 ms），是战斗中途的尖峰；日志没有内部栈/GC 时间线，仍无法唯一定位到某次分配或弱表重排。详见 `slice-details.json`。

固定 seed42 / 39 轮 / 168 战斗任务的 Inspector 对照中，终态与账本摘要完全相同；采样累计分配 20,012.55 → 19,377.79 MiB，单位复制调用栈 2,815.05 → 2,311.98 MiB，结算调用栈 1,538.33 → 2.95 MiB（检查已前移到逐 tick）。单次带采样总耗时 46.28 → 47.60 秒，GC 自耗采样 3.45 → 3.57 秒，**不据此宣称总 CPU 或 GC 时间下降**。这些采样有开销，只用于分配归因。

### 固定九单位 B8 输入的阶段耗时

每版 1 次预热、5 次测量，下表为中位数；所有测量的战斗、结算、回放 JSON 摘要相同。此小型固定输入不能代表压测中复杂阵容的启动上限。

| 操作 | 改前 ms | 改后 ms |
|---|---:|---:|
| compileBattle | 2.433 | 1.985 |
| startTwoSidedBattle | 8.112 | 7.778 |
| 最后一个战斗 tick / 收尾 | 3.286 | 1.518 |
| proposeSettlement | 18.383 | 0.332 |
| startCombatReplay | 9.225 | 8.964 |
| 各次最慢战斗 tick | 4.126 | 3.619 |
| 各次最慢回放 tick | 43.570 | 3.858 |

### M6 原脚本结果

| 运行 | firstSeek 最大 ms / 2000 | capture p95 ms / 50 | 整脚本 |
|---|---:|---:|---|
| m6-before | 1531.9 | 6.3 | 失败（原错误保留） |
| m6-after | 1223.1 | 202.0 | 失败（原错误保留） |
| m6-repeat | 1128.1 | 7.3 | 失败（原错误保留） |

纯 multiplayer 与优化版都未复现 firstSeek 超过 2000 ms；本地对照不支持这次优化拖慢 firstSeek，但不能据此断言 CI 只因机器慢。优化版首轮 capture 的第一个样本为 202 ms，余下 11 个为 4–5.1 ms。原样复测 capture p95 为 7.3 ms，八项性能门禁全部通过；首轮尖峰未稳定复现，不删除该失败，也不把它定性为已经证明的 GC 原因。三轮输入的 JSON 字节数和 value SHA 完全一致（113,582,644 字节）；只读共享使优化版独立对象数减少 3,049、别名数相应增加。优化版两次运行的完整签名（含别名）一致。整条 M6 脚本的三次运行都因同一个 favicon 404 断言失败。

资源错误单独复现：`[{"text": "Failed to load resource: the server responded with a status of 404 (Not Found)", "location": {"url": "http://127.0.0.1:5173/favicon.ico", "line": 0, "column": 0, "lineNumber": 0, "columnNumber": 0}}]`。原 console error 检查、测试页、时限和其他门禁均未修改。

### 复现入口

```sh
node --expose-gc scripts/mp-sim-perf-probe.cjs <source-root> <output-dir>
node scripts/mp-sim-replay-probe.cjs <before-root> <after-root> <before-ledger-dir> <output-dir> <upstream-root>
node --expose-gc scripts/mp-sim-allocation-probe.cjs <source-root> <output-dir>
node scripts/mp-sim-stage-probe.cjs <source-root> <output.json>
```

各压力组命令为 `node [--expose-gc] scripts/loadtest-room.cjs --seats 8 --rounds 3`；M6 使用 `CHROMIUM_PATH=/usr/bin/chromium M6_EVIDENCE_DIR=<output-dir> node scripts/verify-m6-performance.cjs`。源码基底、逐文件 SHA、每局指标及每场回放摘要见 `metrics.json`。

<!-- END MEASUREMENTS -->

## 后续建议与限制

保留此前建议：在首次权威战斗执行时生成相同的视图差分、白名单事件和原间隔关键帧，复用其输出生成回放；外部输入仍保留独立重演验证。若当前重跑确占约 30% CPU，理论上限接近这一比例，考虑投影/差分等必须保留的工作，先以约 20–25% 总 CPU 为待验证预估。本轮未实现，不计入实测收益。

RealClock 压测的命令接纳、阵容与轮数受调度影响，三局数据只是同机观测；不把 RSS 等同于活堆，也不承诺消除所有 GC 尖峰。输入恢复和动态机制校验继续执行，仍可能贡献长切片。原 875 MiB 峰值没有当时的分配/GC 时间线，无法唯一归因；上游 32 份回放拒绝仍需独立修复。


## 自行决定、未完成与风险

- **自行决定：** 主性能对照使用合并基底 79fa6b9，另保留原 e809a7f 重复 GC/分配诊断；M6 与纯 829128f 对照。遵照 #180 对当前 g2-4b manifest 使用 `--write` 后执行默认验证，并统一 release/inputs/live 的基底；历史目录采用 multiplayer 原字节。使用仓库要求的 Node 22 和机器现有 Chromium，未安装或升级版本。
- **未完成：** 原 875 MiB 峰值没有当时的 GC/分配轨迹，未唯一归因；本轮 GC 组 301.95 ms 的战斗中途长切片仍在。M6 整脚本因测试页 `/favicon.ico` 缺失失败，优化版首轮 capture 超限保留。32 份纯上游也拒绝的回放没有改规则去修复。
- **风险/取舍：** 已验证更低的 GC 后 RSS/活堆、固定输入的阶段耗时和结果字节一致性；没有证明总 CPU 降低或所有长尾改善。保留完整输入恢复、重编译和动态机制校验，复杂输入启动仍可能昂贵。RealClock 阵容、轮数和 GC 时机有波动，三局样本不能替代长期线上观测。

交付前远端复核：`multiplayer` 已前进到 `429eb07c985438fb1213c4e5e382200879a12c7b`（#183/#185，新增 UI 与端到端测试，没有 simulation 改动）。本次保留用户指定且已完整验证的 829128f 合并基底，不额外混入 UI 提交；两个历史目录也已核实与该最新远端逐字节一致。
