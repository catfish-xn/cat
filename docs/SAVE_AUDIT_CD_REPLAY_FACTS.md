# 存档一致性 C/D 批

基线：`origin/multiplayer`，`563a7f9245b2ed297d241efc766875af5270d3f2`（开工时 `git ls-remote` 核实）。
分支：`codex/save-audit-cd-replay-facts`。

实现入口：`src/simulation/restore-combat-replay.ts:7` 扩展 `CombatReplayFacts`，`:35` 从同一次可信轨迹复制运行事实；`serialization-structure.ts:290` 创建的 replay 传给各比对消费者。所有新增通用比对在 `combat-runtime-facts.ts`；保留已有的结构/上界/数值校验，不改规则、时限、版本或内容 digest。没有修改 `m8/triggers.ts` 或 `m8/item-restore.ts`。

| 项目 | 比对位置 | 新测试位置（tests/restore-audit/cd-replay-facts.test.ts） | 验证与具体拒绝原因（统一前缀 Invalid Match save:） |
| --- | --- | --- | --- |
| G-C02 | src/simulation/combat-runtime-facts.ts:44 | :54 | 无触发器持有者分别伪造 processed、actionCounts 的 invented-event 键；trigger ledger binding facts |
| G-C03 | src/simulation/combat-runtime-facts.ts:46 | :60、:191、:196、:205 | tick 1 在 0/1 间改攻击；改非黑玫瑰施法；协同改 Kogmaw 施法/攻速/射程；改合法上界内的 Tristana 成长；combat runtime binding facts |
| G-C04 | src/simulation/combat-runtime-facts.ts:19 | :68 | 不存在的 victim/holder、9e8 序号；damage contributors binding facts / trigger event sequence binding facts |
| G-C05 | src/simulation/combat-runtime-facts.ts:48 | :76 | 真正受伤的饮血普通盾 remaining+1/absorbed-1，连同 m8State 与 shield 一起改；shield binding facts |
| G-C06 | src/simulation/combat-runtime-facts.ts:51 | :88 | 真实 Power Absorption 正值收据及正例；value 和状态同时改；G23 absorption binding facts |
| G-C07 | src/simulation/combat-runtime-facts.ts:55 | :110、:117 | 真实 burn 分数余数分子；burn 组和任务共同改 nextPulse；periodic/burn binding facts |
| G-C08 | src/simulation/combat-runtime-facts.ts:53 | :128、:142、:212、:225、:229 | 伪造 Experiment 击杀并调整 maxHpBasis/maxHp；改 Sevika mod；改真实 cuts、stationary、ascension、conquest；G23 state/maximum health binding facts |
| G-C09 | src/simulation/combat-runtime-facts.ts:58 | :155 | Loris redirect 的时长/份额和 legacy status 同步改；activity binding facts |
| P1-BOUNDS-01 exposure | src/simulation/combat-runtime-facts.ts:60 | :165 | tick 0 的 exposureBps=10000 与两个窗口字段逐项造假；exposure binding facts |
| P2-BOUNDS-02 | src/simulation/combat-runtime-facts.ts:64 | :168 | tick 0 三个 damage 字段分别写 99999999；expansion damage binding facts |

每个反例先对**同一场真实战斗**做 serializeMatch、对象恢复、JSON 恢复的完整状态正例和下一 tick 对比，再在三个入口验证带具体原因的拒绝。正例只由公共命令、真实奖励/商店路线和生产 step 构造；不注入运行事实。测试共 30 例，参数化展开计数。

`cd-replay-facts.test.ts:172` 验证结果复用和缓存复制隔离；`:233` 在有抗性盾的冷缓存战斗证明 tick 60 只调用 60 次 step，后续三个入口没有第二条重演轨迹。`m8/resists-shield-restore.ts:30` 改为消费同一个 replay，沿用原来的抗性盾错误消息。

## 自行决定

- 全量比对整个 runtime、普通盾层、G23 与对应的 maxHpBasis，而非仅对可疑持有者/非零条目挑字段；候选值无法决定哪些事实应存在。
- G-C08 的真实 Sevika 正例暴露旧检查要求 highRoller 六字段，但生产记录/类型只有 `actionSeq,spell,mod,enhanced,gold` 五字段。`g2-3-combat.ts:71` 改成精确的五字段名集合校验，保留全部枚举/数值约束。额外第六字段的三个入口拒绝测试也保留，避免用简单字段数修正掩盖未知字段。
- 工作区原有四份未跟踪审计文档未改、未提交；阻挡切分支的未跟踪 `scripts/verify-m8-u3-dynamic.cjs` 原件保存在 `/tmp/save-cd-preexisting/verify-m8-u3-dynamic.cjs`，新基线已跟踪同路径文件。

## 验收

环境：Node v24.21.0、Vitest 5.0.3、4 核 Intel Xeon（Skylake, IBRS）。所有性能轮次依次单独运行，既有时限不变。

| 验收 | 结果 | 用时 |
| --- | --- | --- |
| 相关恢复回归（23 文件，含 30 项新增测试） | 最终 425/425 通过 | 原始一轮 175.01 s；2 文件子进程复验 24.00 s |
| M8 B7 全部 7 文件 | 83/83 通过 | 58.97 s（墙钟 59.87 s） |
| timing / m5-replay-cannon | 1/1 通过，原 180000 ms 时限 | 164.23 s（墙钟 165.22 s） |
| M6 原始性能脚本 | 全部 8 项门槛通过，无跳过；capture p95 **12.70 ms** ≤ 50 ms | 353.79 s（墙钟 355.42 s） |
| typecheck / diff 检查 | 全部通过 | typecheck 22.28 s |

M6 其余原门槛：write p95 47.50 ms、fullCapture p95 356.40 ms、activation max 439.50 ms、completeImport max 15240.00 ms、firstSeek max 1518.20 ms、cachedSeek max 49.40 ms、statsBatch max 0.30 ms；30 次生命周期后堆增量 309596 B，监听器和 DOM 残留均为 0。完整原始报告 `passed: true`、`skipped: []`。

相关恢复回归的三项最初失败均为执行沙箱拒绝 `spawnSync` 的 EPERM（Python 两项、冷 Node 一项）；不修改测试或断言，在允许原子进程的执行环境原样复跑 `g2-4b-pr161-restore.test.ts` 与 `explorer-bracer-restore-pressure.test.ts`，共 13/13 通过。425 是去重后的相关用例数；连同 B7 的 83 项和 cannon 的 1 项，共 509 项通过。

相关回归命令：

```sh
npm test -- tests/restore-audit tests/task-mechanism-restore.test.ts tests/m8-b3-restore.test.ts tests/m8-b8-restore.test.ts tests/m8-b8-restore-fold-reuse.test.ts tests/m8-b10-item-save-replay.test.ts tests/m8-b10-temporary-replay.test.ts tests/m8-b10-encounter-outcomes.test.ts tests/m5-serialization.test.ts tests/t12-combat-equip.test.ts tests/explorer-bracer-restore.test.ts tests/explorer-bracer-restore-pressure.test.ts tests/g2-4b-pr161-restore.test.ts tests/g2-4b-resists-restore.test.ts tests/crown-restore-cache.test.ts tests/p7-restore-compilation.test.ts tests/g2-3-anomalies.test.ts tests/g2-3-integration.test.ts tests/m6-replay.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/g2-4b-pr161-restore.test.ts tests/explorer-bracer-restore-pressure.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/m8-b7-audit-vectors.test.ts tests/m8-b7-catalog.test.ts tests/m8-b7-cleanup.test.ts tests/m8-b7-known-limitations.test.ts tests/m8-b7-match-wiring.test.ts tests/m8-b7-mechanisms.test.ts tests/m8-b7-serialization-reuse.test.ts --maxWorkers=1 --no-file-parallelism
npx vitest run --project timing tests/m5-replay-cannon.test.ts --no-file-parallelism
M6_EVIDENCE_DIR=artifacts/save-cd-m6-performance node scripts/verify-m6-performance.cjs
```

指纹按顺序完成：`node tests/fixtures/record-g2-3-herald.cjs --write`（76.64 s，五份真实档案均通过生产恢复与开战后 15 tick 往返）→ `node scripts/record-g2-3-inputs.cjs` → `node scripts/record-g2-3-inputs.cjs --check`（9 个输入核对通过）。只有 g2-3 Herald manifest 的来源指纹和相应审计元数据改变，五份原始 JSON 与 trajectory 均未变；`git diff --exit-code origin/multiplayer -- tests/fixtures/g2-augments-herald-raw/` 通过，整个历史目录与基线逐字节相同。没有执行 `verify-m8-herald-fixtures.cjs --write`。

本机详细日志保留于 `/tmp/save-cd-*.log`；M6 的完整诊断与指标在 `artifacts/save-cd-m6-performance/`，生成物不提交。

风险：cannon 虽通过原门槛，但本机只有约 16 秒余量；共享宿主负载增加时需关注原 180 秒门槛。无需用户额外决定，不开 PR，由用户创建。
