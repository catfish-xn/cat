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
