# Restore 校验性能与等价性报告

保留实现的 sniper 测试体耗时降低 13.05%，完整 M5 replay 工作量逐例合计降低 23.41%；未更改规则、存档或原有断言。**全部验收尚未完成**：三个真实重连用例被本沙箱禁止监听阻塞，cannon 虽有原测试通过记录，但整组命令仍会超过 180 秒。下文分别给出可比耗时、通过证据与未通过记录。

## 范围与环境

起点为 `codex/restore-validation-speed`，HEAD `f917655c9cea69ef8c446b16ef66f6ab7ca5b5fa`；Node 22.23.4、Vitest 5.0.3，同一机器逐文件串行测试。`.git` 未写入，没有提交；现有测试和超时限制未修改，没有修改存档格式、规则、digest、版本及指定的 v22 证据文件。未运行全套测试。新增四个等价性测试文件。

共享的 `node_modules` 只读，因此所有 Vitest 命令使用 `--configLoader runner`。计时使用测试输出的路线 wall time，以及 `/usr/bin/time` 的进程 wall time。最终计时期间不并行执行其他测试或分析 CPU profile。以下是单次机器观测，不代表统计置信区间。

## 原版热点

使用 `node --cpu-prof` 跑原版 `tests/m5-replay*.test.ts`；主 worker 的采样如下。各项包含子调用，不能相加：

| 调用栈 | CPU 采样秒数 |
| --- | ---: |
| restoreMatch | 818.641 |
| validateMatchStructure | 816.720 |
| validateDynamicCombat | 308.540 |
| canonicalSteps | 281.026 |
| canonicalContent | 238.067 |
| stateAtSaveTick | 126.827 |
| validateB8Resources | 122.767 |
| structuredClone | 87.370 |
| replay lookup | 43.290 |
| equalValidatedContent | 42.165 |

其中 `onStep` 的 self time 为 187.624 秒，GC 为 109.304 秒。主要重复工作是递归生成器编码、为比较而复制整场战斗、将候选战斗再次编码、反复解析/冻结不可变声明，以及同一 restore 内反复重建和核对 G23 收据。

另对原版 cannon 完整路线采样：restore 为 137.068 秒，canonicalSteps 为 31.690 秒，动态战斗为 27.188 秒，资源验证为 23.046 秒；G23 奖励来源和进度检查分别为 6.873、6.718 秒。这些数值用于确定优化方向。

## 改动及等价性依据

1. **同步规范化编码。** `content/index.ts` 在同步文本 restore 的动态作用域内使用等价的递归编码，去掉最终仍被同步 drain 的生成器分配和委托。保留 ASCII 键排序、数组顺序、稀疏数组错误、有限 JSON 检查、冻结文本策略及非普通数组的原有 map/species 分派。对象输入、serialize 和协作式调用保留原路径；嵌套调用或异常通过 `finally` 恢复作用域。此处没有保存准入结果。
2. **完整值比较替代候选的重复编码。** `g2-4b-gold-restore.ts`、`restore-combat-replay.ts` 仅对 restore 自行解析且经过完整 JSON 准入的候选，递归比较完整键集合、每个数组位置及数值。预期战斗仍先执行 `canonicalContent(expected)`，保留原有验证、错误和求值顺序。有限普通 JSON 的该比较与原规范化文本相等的条件相同，包括原有的 `-0/0` 等价关系。借用元数据的相同对象引用也逐字段比较，不以引用相同跳过检查。对象输入仍走原深拷贝、编码路径。
3. **移除仅为比较产生的战斗副本。** 重建器在内部私有游标上完成比较，避免 `stateAtSaveTick()` 的整场深拷贝。内部可变战斗不暴露；原 `opening/stateAtSaveTick/atSaveTick` 公共方法仍返回独立副本。身份编码复用原先已有的私有解析输入路径，没有新增跨调用的验证缓存。
4. **通过检查后共享不可变声明。** `combat-static.ts` 按 unit id 建表，借用独立重建证据中已认证为深冻结普通 JSON 的声明和策略。替换前对完整值、属性顺序及数组顺序做比较；使用 `Object.is` 保留负零，确保 JSON 字节不变。不同、额外或乱序字段不会被修复或删除。可变单位、战斗容器和 runtime 仍各自独立；所有原来的战斗检查继续执行。`shareParsedDeclaration` 对已认证的同一冻结对象不再重复编码。
5. **同一次 restore 内复用 G23 派生工作。** 新增 `g23-restore-reuse.ts`，仅作用于同步文本 restore 拥有的私有 JSON 图；入口建上下文，出口及异常均清除，嵌套对象 restore/serialize 禁用。复用同一 owner 的只读 DTO 和已成功检查的奖励来源；另一 basis DTO 必须与本次已检查的 DTO 完整、顺序敏感地相等，且 seed/round 相同。纯经济重放只对本次登记的私有收据引用和 seed 复用首次独立计算结果。首次检查不变，失败不记成功，没有任何上下文或验证结论跨 restore 调用存活。外部对象/getter 输入保留原行为。
6. **借用构造器元数据的 JSON 表示。** `immutable-json.ts` 利用原有有界不可变表示池，仅为构造器新产生且证明可无损 native JSON 往返的 M8 元数据登记来源。每次文本恢复都将候选 M8 的**全部原始字节**与已知表示比较，完全一致才借用冻结值，省掉解析及最终再编码的副本。登记的是构造器来源和表示性质，不是 Match 校验成功；解析或已准入的 save 对象永不登记为构造器来源。每次仍执行完整 `assertParsedContent` 和所有领域检查。即使构造器池中存在领域无效的 M8，恢复也照常拒绝。歧义键、转义、重复键、空白变体、负零和原型 toJSON 等情况回退 native JSON.parse；解析出错时重新解析原文本，保留原始错误位置和消息。`orb-layout.ts` 对文本 restore 强制执行原布局重建核对，不因借用构造器引用走 generated-layout 捷径。成功后才刷新原有表示池；没有新增已验证存档/哈希的跨调用缓存。

## 前后耗时

| 路线／统计口径 | 原版（秒） | 保留版本（秒） | 降幅 |
| --- | ---: | ---: | ---: |
| sniper，270 commands / 13,434 ticks | 517.438 | 449.929 | 13.05% |
| sniper-caitlyn，284 / 13,231 | 492.823 | 327.989 | 33.45% |
| mage，263 / 12,774 | 399.949 | 313.761 | 21.55% |
| cannon，219 / 7,427 | 247.926* | 177.929 | 28.23% |
| 7 个小用例合计 | 0.312 | 0.568 | 增加 0.256 秒 |
| **完整 M5 replay 工作量，逐例 wall 合计** | **1,658.448** | **1,270.175** | **23.41%** |

该完整工作量合计为四条路线加七个小用例，逐文件串行；所有路线的 command/tick 数均不变。原版前三条路线和七个小用例取无 profiler 的整组记录；*cannon 因原测试已超时，使用调用完全相同原版 helper 的独立 600 秒测量 wrapper 补齐完整工作量，补测开启 CPU profiler。保留版本 cannon 的 177.929 秒来自**未修改的原测试**独立运行，其余用例来自保留版本整组记录。因此合计是透明列明来源的测试体 wall 总和，不冒充一次全绿进程的 wall time。原版 profiler/无 profiler 的 sniper 分别为 518.129/517.438 秒，差异约 0.13%，但 cannon 的 profiler 偏差没有独立量化。

**实际整组 CLI 仍有超时，不能宣称单次全绿。** 无 profiler 的原版整组进程为 1,641.61 秒，保留版本为 1,315.80 秒；两次都是 5 文件/10 用例通过、cannon 在原有 180 秒限制超时，这两个值都是未完成工作量，不能据此计算完整加速比。保留版本 cannon 独立通过时进程 wall 为 182.39 秒、测试体为 177.929 秒，只剩约 2 秒余量；测试文件各自已有通过记录，但整组单命令验收仍不稳定。

为解决该余量，另测过“完整检查但不生成预期文本”、大块冻结编码的同次复用、私有历史事实投影等方案，均未取得可靠 cannon 收益，已全部撤回。对应实验日志在 `/tmp/restore-complete-after/`、`/tmp/restore-cannon-final/`、`/tmp/restore-m5-final/`，不计入保留实现的速度结果。没有为通过而改断言、跳过路线或放宽原测试超时。

## 等价性证据

从未改动的原版实现通过正常命令取得 103 份 sniper 路线存档，其中 66 份含战斗。分别对原版打包和当前打包执行文本、对象输入及 RNG、事件、HP、声明额外键、单位顺序、策略数值、战斗 seed、资源、机制、attackCount 等变体，共 1,526 次恢复调用。324 次接受后的完整状态深相等；1,202 次拒绝的异常类型和完整消息相等。118 次原版接受的修改在新实现仍被接受，未额外收紧。

其中全部 763 次文本输入均预热了构造器来源元数据，并确认实际走了表示借用路径，因此差分比较同时覆盖优化路径上的有效及无效 save。原版 bundle 在首次改动之前生成；辅助文件仅存 `/tmp/restore-perf-equivalence/`。

新增四个测试文件共 12 个用例，覆盖逐叶战斗篡改、下一次调用重新检查、完整键/数组比较、声明共享及可变状态隔离、规范化字节与异常、getter/map 分派、作用域异常清理及嵌套调用、完整 G23 basis 比较、无效构造器元数据、已恢复对象不得取得构造器来源、JSON 重复/转义/嵌套键、语法错误消息、负零及下溢。这 12 项全部通过。最终保留版本 `npm run typecheck` 和 `git diff --check` 均通过；最终差分重跑仍为 324 接受、1,202 拒绝、763 次文本借用，全部一致。

最终定向回归覆盖 63 个现有文件和 4 个新文件，共 1,173 项测试：**64 文件、1,170 项通过，3 文件各有 1 项因环境失败**。Vitest wall 为 730.54 秒，进程 wall 为 731.60 秒。用户指定的 M6 persistence、opening identity、M8 content equivalence、所有 restore-audit、G2-4b restore，以及其余 restore/forgery 领域用例均已实际执行。没有跳过、修改或只更新 golden。

三个未验收用例均在 `listen(127.0.0.1)` 返回 `EPERM`，未进入 WebSocket 重连恢复断言：

- `tests/server/g2-4a-forge-timeout.test.ts`：anvil choice across a reconnect。
- `tests/server/g2-4b-artifact-forge-room.test.ts`：artifact anvil across a reconnect。
- `tests/server/g2-4b-support-forge-room.test.ts`：support anvil across a reconnect。

相同文件中不依赖真实监听的其余用例通过。没有改服务器实现或使用模拟网络来将这三项变绿；需要允许本地监听的执行环境补验。冷 Node 进程的 text/object 恢复用例通过，耗时 8.376 秒，使用下述 I/O 适配器保留实际子进程和全部断言。

M5 的 6 文件/11 用例各自均有保留实现的通过记录；单命令整组为 5 文件/10 用例通过及 1 个 cannon 超时，不能称为整组全绿。

## 命令与原始记录

原版 CPU profile：

```bash
export PATH=$HOME/.local/bin:$PATH
/usr/bin/time -p -o /tmp/restore-perf-before/m5.time \
  node --cpu-prof --cpu-prof-dir=/tmp/restore-perf-before \
  node_modules/vitest/vitest.mjs run --configLoader runner \
  --no-file-parallelism --reporter verbose tests/m5-replay*.test.ts \
  > /tmp/restore-perf-before/m5.log 2>&1
```

无 profiler 的前后整组计时，分别使用 `/tmp/restore-wall-before` 和 `/tmp/restore-wall-after`：

```bash
/usr/bin/time -p -o /tmp/restore-wall-after/m5.time \
  node node_modules/vitest/vitest.mjs run --configLoader runner \
  --no-file-parallelism --reporter verbose tests/m5-replay*.test.ts \
  > /tmp/restore-wall-after/m5.log 2>&1
```

原版 cannon 完整工作量补测记录为 `/tmp/restore-cannon-before/cannon.log`、`cannon.time`；临时 wrapper 只调用未改动的 `verifyReplay('cannon')`，放宽其测量超时至 600 秒，现已删除。原有测试文件及其 180 秒限制从未修改。最终原测试的单独通过记录在 `/tmp/restore-cannon-decoder/`。

差分结果：`/tmp/restore-perf-equivalence/results.json`、`compare-decoder.log`；CPU 摘要：`/tmp/restore-perf-before/profile-summary.txt`、`/tmp/restore-cannon-before/profile-summary.txt`。所有 profile、日志和生成的路线样本均未放入仓库。


定向回归命令（文件清单见下方；没有调用不受影响的整套测试）：

```bash
NODE_OPTIONS=--require=/tmp/restore-perf-equivalence/spawn-sync-files.cjs \
/usr/bin/time -p -o /tmp/restore-regression-complete/regression.time \
  node node_modules/vitest/vitest.mjs run --configLoader runner --project fast \
  --no-file-parallelism --reporter verbose \
  $(cat /tmp/restore-perf-equivalence/regression-files.txt) \
  tests/restore-validation-speed.test.ts tests/restore-canonical-encoding.test.ts \
  tests/restore-g23-reuse.test.ts tests/restore-json-decoding.test.ts \
  > /tmp/restore-regression-complete/regression.log 2>&1
```

这里的仓库外 preload 仅处理本沙箱 `spawnSync` 默认 pipe 返回 `EPERM` 的问题：将 stdin/stdout/stderr 绑定普通文件描述符，仍执行实际冷 Node 子进程，并回填真实 stdout/stderr；不替换状态码、不忽略错误、不模拟 restore。最小复现中连 `/bin/true` 默认 pipe 都报 EPERM，inherit 则正常；适配后的子进程状态与输出均正常。现有冷进程测试和所有断言保持原样。普通环境无需该 preload。首次未经适配的回归记录在 `/tmp/restore-final-regression/`。

63 个现有文件（另加上列 4 个新测试文件）：

```text
tests/anvil-47.test.ts
tests/black-market-concrete-offers.test.ts
tests/chem-baron-fix.test.ts
tests/content-identity-constants.test.ts
tests/crown-restore-cache.test.ts
tests/epic-loot-reforger.test.ts
tests/explorer-bracer-restore-pressure.test.ts
tests/explorer-bracer-restore.test.ts
tests/five-cost-replay.test.ts
tests/g2-3-followup.test.ts
tests/g2-3-identity.test.ts
tests/g2-3-traits.test.ts
tests/g2-4a-crown-gold.test.ts
tests/g2-4a-crown-history.test.ts
tests/g2-4b-artifact-forge.test.ts
tests/g2-4b-clone-forges.test.ts
tests/g2-4b-gold-settlement.test.ts
tests/g2-4b-mirror-forge-restore.test.ts
tests/g2-4b-pr161-restore.test.ts
tests/g2-4b-resists-restore.test.ts
tests/g2-4b-restore-authority.test.ts
tests/g2-4b-support-forge.test.ts
tests/g2-4b-trench-restore.test.ts
tests/g4-reference-cache.test.ts
tests/jayce-forge-placement.test.ts
tests/jayce-forge-replay-order.test.ts
tests/live-combat-inputs.test.ts
tests/loot-orb-claim.test.ts
tests/m5-serialization.test.ts
tests/m6-persistence.test.ts
tests/m8-b3-restore.test.ts
tests/m8-b7-serialization-reuse.test.ts
tests/m8-b8-live-reveal.test.ts
tests/m8-b8-loot-freeze.test.ts
tests/m8-b8-restore-fold-reuse.test.ts
tests/m8-b8-restore.test.ts
tests/m8-b9-golden-tamper.test.mjs
tests/m8-content-equivalence.test.ts
tests/mp-sim-perf.test.ts
tests/opening-random-identity.test.ts
tests/p7-restore-compilation.test.ts
tests/r3r4-loot-weights.test.ts
tests/r3r4-loot.test.ts
tests/r3r4-oracle.test.ts
tests/restore-audit/bounds-preflight.test.ts
tests/restore-audit/cd-replay-facts.test.ts
tests/restore-audit/combat-accumulators.test.ts
tests/restore-audit/g23-grant-evidence.test.ts
tests/restore-audit/g23-reward-allocation.test.ts
tests/rules-overtime-paths.test.ts
tests/s13-anomalies-restore-review.test.ts
tests/s13-anomalies-restore.test.ts
tests/s13-augments-p2-combat.test.ts
tests/server/g2-4a-forge-timeout.test.ts
tests/server/g2-4b-artifact-forge-room.test.ts
tests/server/g2-4b-support-forge-room.test.ts
tests/six-cost-ad-star-scaling.test.ts
tests/task-mechanism-restore.test.ts
tests/v17-orb-combo.test.ts
tests/v19-mechanics.test.ts
tests/v19-part2.test.ts
tests/v20-traits.test.ts
tests/yieldable-battle-setup.test.ts
```
