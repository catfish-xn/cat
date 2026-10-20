# 联机规则层性能优化验收

基线：`8b614fc9c3a51eaefd3397b61aeac745b298b2f9`，开工时通过 `git fetch origin multiplayer` 核实，包含 #177、#178。分支：`codex/mp-sim-perf`。同一 Linux 云端、Node 22.23.3；使用隔离执行器，没有更新项目依赖版本。

**结果混合：普通组 RSS 下降、最差服务器切片缩短；GC 组 RSS 和 RTT 出现回退，不能宣称内存目标全面达成。** 原始失败和回退数据全部保留，未用补测覆盖原结果。

## 实现

1. `content/index.ts` 仅缓存长度小于 2048 个 UTF-16 码元的规范文本，即每段 UTF-16 文本低于 4 KiB。另用 WeakSet 认证完整冻结数据图，因此大对象仍可缓存短摘要，不再靠保留其整段文本证明不可变性。排序、数字表示、getter 读取顺序、异常行为和摘要算法不变。
2. `combat-static.ts` / `combat-s13.ts` 取消整个单位的每 tick 原生深克隆，改为新单位外壳、独立可写 runtime/旧式 G2/G22/G23 状态和独立列表容器；任务、护盾、状态、触发计数、临时物品授予及采样位置/属性记录只在证明深度不可变后复用。可变 checkpoint 的只读记录先克隆再冻结，不冻结调用者的数据。机制定义/状态/账本保留原有写时复制契约；函数和 Symbol 保持原生 `DataCloneError` 拒绝。
3. 没有修改 `src/server/`、`src/rendering/`、`combat-replay-view.ts`、版本号、玩法数值、既有测试、测试时限、校验阈值或负载。只新增相关测试及对照探针。

## 八席压测

基线没有独立位于 `tests/server` 的压测运行器；采用现有 `scripts/loadtest-room.cjs`，它使用真实服务器/RealClock/TestClient，测量语义由 `tests/t9-loadtest.test.ts` 验证。普通和 GC 两组串行，各保留默认一局预热及三局完整测量，改前改后相同命令：

```sh
node scripts/loadtest-room.cjs --seats 8 --rounds 3
node --expose-gc scripts/loadtest-room.cjs --seats 8 --rounds 3
```

### 后续复现：内存分项与两版本对照

`sampleMemory()` 在原字段之外记录 `heapTotalBytes`（V8 已分配堆）、
`externalBytes`（JS 对象关联的外部内存）、`arrayBuffersBytes`（ArrayBuffer/SharedArrayBuffer，
含 Node Buffer；已包含在 external 中，不可重复相加），均来自 `process.memoryUsage()`。
`rssAnonBytes` 在 Linux 同步读取 `/proc/self/status` 的 `RssAnon`，将 kB 乘以 1024；
其他平台、读取失败、缺失或无效格式均为 null。原采样时机不变，启用 GC 时仍先 GC 再采样。
`memoryTrend` 另附 `postMatchHeapTotalBytes`、`postMatchRssAnonBytes` 序列；不可用值保留 null。
RSS、heapTotal、external 和 RssAnon 反映不同范围，不能简单相减后认定为泄漏。

采用独立 `scripts/loadtest-compare.cjs`，避免将跨目录进程编排混入单版本压测入口。
两个目录须已 checkout 并安装依赖；脚本不会安装依赖或修改源码。
为比较新内存字段，两边的 `loadtest-room.cjs` 都需带相同采样补丁；旧入口缺失字段时显示 null。
在同一机器先完整跑 before，再完整跑 after，固定八席，同一 Node 可执行文件并强制 `--expose-gc`。
默认每边 1 局预热、6 局测量；同一组参数转发给两边，可覆盖局数、预热及其他本地压测参数。

```sh
node scripts/loadtest-compare.cjs /path/to/before /path/to/after --out artifacts/compare-six
node scripts/loadtest-compare.cjs /path/to/before /path/to/after --rounds 8 --warmup 2 --seed 42 --out artifacts/compare-eight
```

输出目录必须不存在，避免覆盖证据；生成 `before.json`、`after.json` 原始报告，以及
`comparison.json`、`comparison.md`。对照含每局终局轮次、GC 标记、局末 RSS、GC 后 heapUsed、
heapTotal、RssAnon、最差 RTT p99、最长完整服务器切片及各项均值/最差值（最大值）。
RTT 取每局准备/选择命令 p99 和各轮准备命令 p99 的最大值，不是合并全部样本重算的 p99。
JSON 内存单位为字节，时间为 ms；Markdown 同单位。缺失值和未实际 GC 的 heapUsed 为 null，
均值排除 null 并列出有效样本数；预热和失败局不纳入汇总。
不设性能门槛、不作通过/失败判定；运行错误仍以非零退出，并保留已生成的原始报告。
RealClock 下终局轮次与操作负载仍可能不同，均值及最差值仅供观察，不单凭这些值归因。

内存单位均为 MiB，时间为 ms。**普通组没有强制 GC，heapUsed 不能称为 GC 后活堆；GC 组每局 `gcApplied` 均为 true。** 峰值是每局观察到的 RSS 峰值，不是进程终生高水位。RTT p99 为准备命令的 nearest-rank p99；最长切片为完整 `Room.resolveSlice`，包括回放、结算及发布。

| 组别 | 局 | 终局轮次 | 结束 RSS | heapUsed | 峰值 RSS | RTT p99 | 最长切片 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 改前普通 | 1 | 33 | 675.93 | 336.98 | 691.77 | 117.05 | 140.28 |
| 改前普通 | 2 | 39 | 698.05 | 416.60 | 698.98 | 249.65 | 337.02 |
| 改前普通 | 3 | 37 | 677.24 | 329.06 | 700.05 | 108.23 | 191.16 |
| 改后普通 | 1 | 34 | 601.48 | 260.31 | 614.27 | 91.54 | 184.85 |
| 改后普通 | 2 | 36 | 601.15 | 192.60 | 627.58 | 46.21 | 223.15 |
| 改后普通 | 3 | 36 | 596.34 | 261.64 | 623.62 | 136.86 | 260.81 |
| 改前 GC | 1 | 33 | 541.12 | 108.09 | 565.52 | 172.50 | 491.82 |
| 改前 GC | 2 | 39 | 530.69 | 92.16 | 571.89 | 127.73 | 233.98 |
| 改前 GC | 3 | 37 | 558.48 | 96.53 | 582.28 | 89.62 | 192.23 |
| 改后 GC | 1 | 36 | 446.57 | 74.55 | 460.43 | 100.96 | 230.11 |
| 改后 GC | 2 | 39 | 805.44 | 105.06 | 875.09 | 317.36 | 208.75 |
| 改后 GC | 3 | 39 | 810.34 | 97.83 | 838.56 | 203.87 | 208.30 |

下面 RSS/heapUsed 为三局均值，其余为三局最差值；“最差 RTT p99”不是合并全部样本后的总体 p99。

| 组别 | 平均 RSS 改前 → 改后 | 平均 heapUsed | 最大峰值 RSS | 最差 RTT p99 | 最大切片 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 普通 | 683.74 → 599.66 | 360.88 → 238.18 | 700.05 → 627.58 | 249.65 → 136.86 | 337.02 → 260.81 |
| GC | 543.43 → 687.45 | 98.93 → 92.48 | 582.28 → 875.09 | 172.50 → 317.36 | 491.82 → 230.11 |

普通组平均 RSS 下降约 12.3%，GC 组平均 RSS 反而增加约 26.5%；GC 后平均活堆仅下降约 6.5%。GC 组的第二、三局 RSS 回退尤其明显，尚未定位，不能仅凭活堆下降判断驻留内存问题已解决。普通组第三局 RTT、若干单局切片也回退，不能宣称逐局全面改善。

完整服务器切片累计 CPU 的每局均值：普通组 58.36 → 43.00 秒，GC 组 52.17 → 46.59 秒。这是观测值；RealClock 前后操作接受数、终局轮次和战斗负载不同，不能当作隔离后的纯算法提速比例。逐局 CPU、样本数、命令数及原始报告 SHA-256 在 `metrics.json` 中。

## 测试

相关测试串行执行：`vitest run --no-file-parallelism --maxWorkers 1`，沿用既有 fast/timing 项目。67 个文件的确切选择清单见 `metrics.json`，未运行全套。

- 首轮 67 文件、1215 条，982.02 秒：1214 通过、1 失败、0 pending/skip。唯一失败是既有 `m8-b8-copy-semantics` 的 getter 首次返回函数必须读取一次并抛出 `DataCloneError` 用例。
- 修正函数/Symbol 拒绝分支后，串行复验 `m8-b8-copy-semantics`、`g4-reference-cache`、`mp-sim-perf`，3 文件、24 条全部通过，1.83 秒，含新增的函数/Symbol 两条回归。
- 合并用例覆盖为 67 个不同文件、1217 个不同用例均有通过结果。**不是一次全绿批次；首轮失败仍记录在 metrics 中。拒绝边界修复后没有重跑已通过的长路线测试，而是复验受影响的三个文件，并重新运行最终源码的三种子完整对局、字节对照和指纹链。**
- 四条完整重演路线均在首轮通过：sniper-caitlyn 159.12 秒、sniper 161.52 秒、mage 151.13 秒、cannon 132.63 秒。原时限、工作量和断言均未修改。
- 最终源码 `tsc --noEmit` 通过。

## 完整对局逐字节对照

`scripts/mp-sim-perf-probe.cjs` 沿用 `tests/server/bot-driver-helper.ts` 的八机器人/ManualClock/真实 resolver 设置，固定 seed 42、7、11。保留终态完整规则状态（含收据和历史）、共享池、排名、结算 ID、选秀账本、所有机器人操作流以及每场完整 resolver 结果。仅剔除 resolver 信封中属于服务器调度的 `roomRevision`，不剔除规则结果字段。

最终源码三局共 481 场战斗、327927 条事件，终局分别为 39/34/36 轮。所有终态、操作流和完整账本文件解压后以 `assert.deepEqual(Buffer, Buffer)` 逐字节通过，不只比较哈希。各种子完整 SHA-256 见 `metrics.json`。该对照不替代真实 WebSocket 压测。

```sh
node scripts/mp-sim-perf-probe.cjs /path/to/baseline /path/to/before-output
node scripts/mp-sim-perf-probe.cjs /path/to/candidate /path/to/after-output
```

## 指纹

在最后一次规则层修改后，按下列顺序全部通过：

```sh
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node scripts/record-g2-3-inputs.cjs --check
```

内容摘要保持 `fnv1a32-utf16:4bf7fe15`。五个 Herald 原始样例及 trajectory 字节不变，清单只更新源码指纹及三个修改模块的哈希，审计文件相应更新清单 SHA。`tests/fixtures/g2-augments-herald-raw/` 与 `origin/multiplayer` 一致。未使用禁止的历史 fixture writer。

## 回放重跑的后续建议（本次未改）

在权威战斗第一次执行时采集现有回放所需的视图投影和有序动画事实，复用原来的 diff/keyframe 构造器，避免 `startCombatReplay` 再调用 `stepCombat` 跑一遍。必须保留 tick 0 的事件游标归属、单位进出顺序、20 tick 关键帧、初末态投影、账本/分歧校验以及 A/B 镜像共享缓存。外部导入的不可信回放仍独立重演验证，或要求经过认证的内部采集记录；不降低恢复校验。

按提供的约 30% CPU 热点，上限约为总 CPU 的 30%（吞吐约 1.43 倍）；仍需支付投影、编码和校验成本，初步估计实际可节省总 CPU 15–25%，**尚未实测**。应采集紧凑视图差分，避免保留每 tick 的完整规则快照。

## 自行决定、未完成与风险

- 自行决定：短文本上限采用 2048 UTF-16 码元；冻结认证与文本缓存分离；使用仓库现有 T9 真实网络压测；对拒绝边界做针对复验并保留首轮失败。
- 未完成：GC 组 RSS/RTT 回退尚未定位，不能将本分支视为“驻留内存已稳定降低”的验收结论。回放消重按要求只给方案，没有实现。
- 风险：RSS 不等同于活堆；RealClock 负载不同及分配器驻留均可能影响结果，现有数据不足以归因。当前最长切片仍明显高于 50 ms。边界修复后的长路线未全量复跑，最终源码另有完整对局字节对照。

原始四组压测、初轮/复验日志、指纹日志及 gzip 对照文件保存在 `/workspace/scratch/mp-sim-perf/`；仓库保留可复现脚本及轻量指标，未提交大体积运行产物。

## 补充：同输入 GC 诊断

为了诊断原 GC 组 RSS 回退，另以 `node --expose-gc scripts/mp-sim-perf-probe.cjs <root> <output>` 串行重跑相同三个完整八机器人对局，在输出终态/账本后强制 GC。输入与规则结果哈希一致。它包含完整账本文件编码及 Buffer 分配，**不是 WebSocket 压测的替代，也不能解释或覆盖上面的 RSS 回退。**

| seed | GC 后活堆 MiB 改前 → 改后 | RSS MiB 改前 → 改后 |
| --- | ---: | ---: |
| 42 | 98.17 → 85.57 | 815.54 → 814.16 |
| 7 | 138.91 → 112.80 | 1141.59 → 1008.48 |
| 11 | 179.65 → 135.48 | 1172.67 → 1088.36 |

固定输入下活堆下降，为减少文本保留和复制提供了补充证据；真实网络 GC 组驻留内存回退仍是未完成问题。
