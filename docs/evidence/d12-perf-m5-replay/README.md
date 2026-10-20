# D12：M5 sniper replay 性能

基线：`a0d42c592cbd48fb075175e5f61818dabfe1b320`（fetch 后的 `origin/multiplayer`）。
分支：`codex/perf-m5-replay`。本任务不回填 TASKS，由父任务处理。

## 改动

- 保留每个命令和 tick 的真实恢复、第二次执行、拒绝插入与所有原断言。两个目标测试、共用 helper、timeout 和 Vitest 配置均未修改。
- 仅为 restore 自己解析且已完成输入验证的 JSON，复用完整 basis/strategy/version 的 canonical 身份文本及其原 digest；精确 JSON 字节作 key，最多 8 条，每个 key 和 canonical 文本各不超过 1 MiB。缓存没有 Match、候选 runtime、恢复输出或验证通过决定；每次照常验证当前候选。对象输入仍走原 getter 路径。
- P2 opening 校验只深拷贝它实际比较的 `id` 与 `s13P2Opening`。完整 opening 和 facts 仍保持分离，所有外部返回都与私有轨迹隔离。
- 没有修改规则、内容、digest、golden、RNG 或事件结算。没有更改 D13 范围内的其他慢测试。

## 同机串行阶段数据

Node 22.23.3；Vite 7.3.6；Vitest 5.0.3；TypeScript 5.9.3；esbuild 0.28.2。依赖由锁文件安装，使用 npm 11.9.0 和 `/tmp/d12-npm-cache`。Linux x64，cgroup 4 CPU / 16 GiB。每份样本使用独立 Vite 进程，串行执行。

| 路线 | 版本 | 编译加载 s | 两次建局 s | 回放主体 s | 三次序列化累计 s | 恢复累计 s | golden ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sniper | before | 1.659 | 0.015 | 175.371 | 22.943 | 114.363 | 0.357 |
| sniper | after | 1.766 | 0.017 | 149.413 | 22.724 | 89.719 | 0.361 |
| sniper-caitlyn | before | 1.925 | 0.015 | 180.116 | 23.920 | 116.630 | 0.543 |
| sniper-caitlyn | after | 1.678 | 0.016 | 151.891 | 23.172 | 91.026 | 2.806 |

sniper 主体减少 14.8%；Caitlyn 减少 15.7%。这些是本机串行诊断数据，CI 240 秒目标须由 PR 的实际 CI 另行确认。

`measurements.json` 保留每轮 `onStep` 的断言、拒绝、重复执行、序列化、恢复累计分解，以及未分配到 callback 的原路线执行/记账耗时。编译、建局及 golden 分别列出；阶段之间不重复计算。

准备方式实验：独立 Node bundle 的 sniper 为 169.663 秒（采集 CPU profile），对比 Vite 基线仅约 3.3% 收益，故未采用，也未修改测试的执行方式。

复现命令（各命令串行、相同工具链，基线与本分支分别执行）：

```sh
npm ci --cache /tmp/d12-npm-cache
node docs/evidence/d12-perf-m5-replay/profile.cjs "$PWD" sniper vite
node docs/evidence/d12-perf-m5-replay/profile.cjs "$PWD" sniper-caitlyn vite
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --project fast --maxWorkers 2 tests/m5-replay.test.ts tests/m5-replay-sniper-caitlyn.test.ts
```

## 一致性证据

- 两条路线前后均通过现有 `tests/fixtures/m5/assert-golden.cjs`，覆盖命令 transcript 及每轮完整 state/event hash。
- sniper：219 命令 / 11,934 tick；路线 SHA-256 `9d6fb90d3604f7901858d9aa51b167b11e58a881b11763d686eeffd7839f23b3`。
- Caitlyn：254 命令 / 11,896 tick；路线 SHA-256 `e46feed7e8917edded67d161cb64193a938f7392348d3934169fc954534545fb`。
- 前后 content digest 均为 `fnv1a32-utf16:ea6b11b6`。golden 文件 Git blob 保持 `9f208ce14451a637209d350329b9d33dd2ca6c62`。
- 原基线源码与候选源码的 81 项差异检查全部一致：opening、tick 10、结束 tick 164；JSON/对象恢复；getter 次数与中途改写 ledger；较短历史前缀（1/3）；RNG/action/event 游标篡改；后缀字段篡改；负零；继续执行及拒绝不变性。见 `boundary-comparison.json`。
- 新增测试覆盖身份 key 的完整 basis/strategy、淘汰后重算、P2 projection 的所有权、对象 getter 和 warm identity 下的候选 RNG 拒绝。

## 本地最终验证

- 两项原测试：2/2 通过，2 worker 总 wall time 174.52 秒（两项均在该总时长内完成）。
- 受影响的原有 7 文件、136 项测试通过；新增 4 项中间值测试在夹具修正后复验全部通过。
- `tsc --noEmit` 通过。只运行两项目标测试及受影响文件，没有在本地运行全套。
- `git diff --exit-code` 核对两项原测试、helper、`tests/fixtures/m5`、`src/simulation/content`、Vitest 配置及依赖文件全部未变。

受影响测试命令：

```sh
node node_modules/vitest/vitest.mjs run --project fast --maxWorkers 1 tests/m5-replay-intermediates.test.ts tests/m5-serialization.test.ts tests/p7-restore-compilation.test.ts tests/m8-b8-restore-fold-reuse.test.ts tests/m8-b7-serialization-reuse.test.ts tests/task-mechanism-restore.test.ts tests/restore-audit/cd-replay-facts.test.ts tests/s13-augments-p2-combat.test.ts
node node_modules/vitest/vitest.mjs run --project fast --maxWorkers 1 tests/m5-replay-intermediates.test.ts
node docs/evidence/d12-perf-m5-replay/compare-boundaries.cjs /tmp/d12-baseline "$PWD"
```

差异检查使用的 `/tmp/d12-baseline` 为基线提交的 `src/`、`package.json` 和同一依赖目录。两套 Vite 在同进程加载时提示 HMR 端口冲突，81 项规则比较正常完成、退出码为 0；不涉及网络测试。

CI 的实际单项耗时和终态记录在草稿 PR 的最终说明中。本机串行分段数据与双 worker 总时长不替代 CI 240 秒验收。

## 恢复校验跟进（基于 6fad68c8）

保持第一次的完整测量，不重复无变化基线。第二轮只改恢复路径：

- 同一次同步恢复内，完整收据仅构建一次出生投影；按五个完整收据边界（schedule / loot / mechanic / carousel 数组身份及 throughRoundOrdinal）匹配。Map 与记录返回副本，不跨恢复保留；对象/序列化路径关闭复用，异常和重入用 finally 恢复作用域。每个 ledger/prefix 的原有遍历和拒绝检查仍执行。
- 对私有 JSON basis 延后冻结，到已有的最终 metadata 复用处处理；公开/object 调用仍立即冻结，返回的 Match basis 仍完整冻结且容器独立。没有缓存恢复输出。
- G23 canonical 比较/经济键实验收益不足 2%，已撤回，没有提交该改动。没有改 D13 的准备文件。

| 路线 | 恢复累计（第一次）s | 恢复累计（第二次）s | 主体（第一次）s | 主体（第二次）s |
| --- | ---: | ---: | ---: | ---: |
| sniper | 89.719 | 85.983 | 149.413 | 148.278 |
| sniper-caitlyn | 91.026 | 85.680 | 151.891 | 147.208 |

两条完整路线均通过原 golden；完整命令数、tick 数、逐轮 state/event 指纹、digest 与第一次及原始基线一致。分阶段和逐轮原始记录在 measurements.json 的 followup 字段。定点诊断的四个检查点、每点 250 次恢复也保留在该字段；这是诊断，不代替原测试或 CI 验收。

本轮相关原有 89 项 + 新增 3 项通过，tsc --noEmit 通过。与 6fad68c8 的通用 81 项比较通过，另有中后期 84 项收据/prefix/runtime 篡改、getter 读取及错误后隔离对照通过，完整异常类型与消息相同；见 phase2-*-comparison.json 和 compare-receipts.cjs。

外部集成事项：本分支实际测量基线是 a0d42c59 / 6fad68c8，两个目标 wrapper 的 timeout 都保持 360000。PR #239 的 HEAD 7a48c2738ce41816e9a2e2f4f76968ace2a967b6 曾说明临时 600 秒及提速后恢复 360 秒；该事项由外部集成跟进，不能作为 D12 的 240 秒验收。已核对 #234 仅改 tests/m8-b4-r3b-lifecycle.test.ts 的 fixture beforeAll，本任务未改该文件，也未重复其工作。

旧 HEAD 6fad68c8 的 CI 39364817788 终态为 cancelled，目标快测分片未产生可验收耗时；不视为 240 秒通过或性能失败。原始 tests-2 取消日志保留为 ci-39364817788-tests-2.log.gz（该分片包含 mage，两个目标分片均取消）。最终以实际新 HEAD 的 CI 单项记录验收。

本轮两项原测试 2/2 通过，2 worker 总 wall time 153.67 秒；此数据仍不代替 CI 单项 240 秒验收。

## 本地追加瓶颈诊断（不推送、不触发 CI）

远端实际受测生产提交仍是 `1f8a921e06095a545f6874c328a6bd154a431d3c`。CI 39372322168 的 tests-3 分片 87 个文件 / 1202 项通过，但 sniper 为 325.790615272 秒、Caitlyn 为 329.746713616 秒，均超过 240 秒目标。原始日志为 ci-39372322168-tests-3.log.gz；没有重跑 CI。

诊断使用源码公共命令生成的四个输入检查点（R12/R19/R25/R33，tick 100），每点真实调用 restoreMatch 250 次，每次完整比较返回状态。输入准备和断言不计入这里的微诊断计时；完整测试性能仍只引用前述完整路线和原测试，不能用本表替代 CI 验收。没有缓存待测恢复结果，也没有改生产代码。

| 1000 次 warm 恢复累计 | ms | 占恢复调用 |
| --- | ---: | ---: |
| restoreMatch | 7708.652 | 100% |
| 主体 JSON.parse | 1235.246 | 16.0% |
| 小 JSON.parse | 54.887 | 0.7% |
| 内部 JSON.stringify | 1115.088 | 14.5% |
| structuredClone | 295.390 | 3.8% |
| 其余 JS 校验/比较/分配及诊断包装开销 | 5008.041 | 65.0% |

进一步分类编码调用（另一轮诊断）：字符串 741567 次，共 123.450 ms；对象 778357 次，共 1077.732 ms。可重复字符串虽多，但其原生成本不足整体的 2%，不值得增加进程级缓存。小 ID 解析不足 1%，也没有添加解析缓存。主体 JSON 解析和当前候选编码仍需读取完整值，未尝试缓存候选 Match 或绕过验证来省掉这些工作。

现有 CPU 采样显示剩余校验分散在资源/收据/历史、runtime facts、canonical/validated equality、声明处理等路径；这些 warm 本机数据不能外推为完整 CI 的阶段比例。目前未找到足以安全补齐约 86–90 秒 CI 差距的明确小热点，未扩大为自定义 JSON 解码器、全局编码替换或其他测试/调度改造。

同一 CI 分片的共享负载记录（仅报告给指挥/D13，本任务未修改这些文件）：

| 文件 | CI 用时 ms | 日志结束时刻 UTC |
| --- | ---: | --- |
| tests/m6-integration-sniper-caitlyn.test.ts | 167710 | 05:00:49.855 |
| tests/g2-4b-unstable-chest.test.ts | 49726 | 04:58:51.994 |
| tests/task-mechanism-restore.test.ts | 25719 | 04:59:17.910 |
| tests/t12-combat-equip.test.ts | 24298 | 04:59:42.503 |
| tests/server/projection-wire.test.ts | 41395 | 05:00:24.586 |
| tests/server/shared-pool-room.test.ts | 56623 | 05:01:24.732 |

两条 M5 于约 04:58:03 同时开始；M6 Caitlyn 和 unstable-chest 从相邻时刻执行，后续重测试也位于 M5 运行窗口。并行负载可能贡献本地/CI 差距，仅为推断，不是放宽校验或宣称达标的依据。D13 已接到这六个文件的准备热点核对，本任务保持文件边界。

历史 g2-4b / g2-3 manifest 完全未动；最新限制收到后没有再次推送、触发/重跑 CI，也没有再运行原本已通过的测试。新增内容只是上述本地诊断及证据，等待用户通知。
