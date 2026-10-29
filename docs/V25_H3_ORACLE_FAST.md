# v25 H3 测试账本增量校验

起点：`claude/v25-h3-oracle-fast`，`686f3086fa565d2c1af81a5414d1259fc0ab86fb`，工作区干净。只改测试、测试工具与本报告；不写 `.git`，不改 `src/`，不重录纪元，不改超时或阈值，不删除原有测试断言。

## 修改位置

| 文件:行 | 内容 |
| --- | --- |
| `tests/fixtures/m5/h3-growth-oracle.cjs:22` | 对 facts、资源事实、回合结果、联机收据保存独立的引用数组；相同引用跳过历史内容深比较，引用变化则立即深比较脱离原对象的旧值。删除、重排、内容不同的替换立即拒绝。 |
| `tests/fixtures/m5/h3-growth-oracle.cjs:39` | 非历史字段仍每次深比较；失败路径恢复原先整份 checkpoint 的错误诊断。 |
| `tests/fixtures/m5/h3-growth-oracle.cjs:49` | 只克隆新增历史项；旧的脱离原对象的快照按值保留，并在新账本里共享。引用数组自身另行浅拷贝，不能被输入数组的 pop/splice 改写。 |
| `tests/fixtures/m5/h3-growth-oracle.cjs:126` | 回合、阶段或战斗阵容锁定状态改变时，全量深比较前后两态的历史前缀；先检查再保存，不能把就地篡改写成新基准。移除每 tick 对整个 memory 的克隆，成长、合星、结算断言保留。 |
| `tests/fixtures/m5/h3-growth-oracle-v25-baseline.cjs:1` | 原账本逐字节副本，仅作对照。SHA-256：`9bbea0b3d1f5fd6d6048d0a6dfffa729b30670292acef802fad29d1a43b74b70`；测试锁定该值。 |
| `tests/h3-growth-oracle-fast.test.ts:1` | 增量缓存、边界篡改、错误诊断、快照隔离与原实现等价测试。 |
| `tests/augment-pool-batch5-h3-oracle.test.ts:92` | 两种 H3 强化的真实房间轨迹，逐观察点对照原账本的判定与完整脱离原对象的账本值。 |
| `scripts/benchmark-h3-oracle.cjs:1` | seed 230 cannon 的三次独立进程计时、逐位判定对照及确定性输出比对。 |

两个账本都只依赖 Node 标准库，不调用或导入 `src/`。基准工具沿用 `scripts/generate-m5-route.cjs` 的公共命令路线，以生产模块提供待检查轨迹；期望值仍由独立账本产生。`oracle.g2.cjs` 的 `Ledger.apply` 原本就调用 `checkH3Growth`，无须改接线。既有入口包括 `tests/m5-route.test.ts`、`tests/m5-replay-helper.ts`、`scripts/verify-m5-headless.cjs`。

## 等价与篡改证明

- 冻结原实现并校验文件摘要，避免对照组随优化一起改动。
- 两条真实房间 H3 路线分别覆盖 `no-scout-no-pivot` 的 PvP 冻结/结算成长，以及 `cooking-pot` 的入轮成长。每个观察点同时调用新旧账本，要求都通过，且去掉新增的引用缓存后完整账本值相等；原有攻击矩阵、独立数值向量与所有断言保留。
- 手写多回合轨迹对照每步判定和完整账本值；错误向量逐字段比较完整 `message`、`code`、`operator`，覆盖新增事实序号/座位/回合/回合 ID/资源前缀/额外成长，以及历史删除/替换/前态篡改。
- 就地改写旧事实字段后连跑三个同阶段观察点，脱离原对象的快照始终保留旧值，下一阶段边界报错；另外覆盖仅后态持有已改旧引用时的边界检查，以及四类历史在入轮边界的联合篡改。
- 删除旧记录、替换为内容不同的记录、重排旧前缀，均在当前观察点报错。输入数组自身就地 pop 也不能改变账本记住的长度。
- 内容完全相同的新引用仍按原账本语义接受，但必须立即深比较；这保证现有手写向量、克隆状态和恢复状态的合法调用不变。相同引用内的字段改写按本次需求延迟到边界发现，不声称逐 tick 报错时刻与原实现相同。
- 新增记录的全部原有校验仍立即执行；空 `deaths` 记录保留。测试验证新历史项克隆隔离、旧快照不被输入或下一份账本改写。

## 计时与输出比对

运行命令：

```sh
export PATH=$HOME/.local/bin:$PATH
node scripts/benchmark-h3-oracle.cjs baseline
node scripts/benchmark-h3-oracle.cjs optimized
```

每组顺序运行三次，每次启动全新 Node 进程。先加载同一生产模块，再用 `performance.now()` 包围整个 `run(api,{seed:230,build:'cannon'})`，包括所有原有账本断言；没有空操作账本，没有改变路线参数。原实现与优化实现只通过测试进程内的 CommonJS 缓存切换。

本环境：Node `v22.23.4`，Intel Xeon Processor (Skylake, IBRS)，32 个逻辑 CPU。原账本首遍期间也运行了定向验证，后两遍及优化组三遍不并行跑测试；各组内部不并行跑路线。这里的绝对耗时不直接等同于 Cursor 环境中的 269.95 秒。

每次记录每个 H3 观察点的成功位/完整错误，并对照同序号的原实现结果。除逐位判定以外，还比较确定性终局摘要、完整终态 SHA-256、命令轨迹 SHA-256、完整战斗事件/轮次 SHA-256、经济账本 SHA-256、总历史条数及 deaths 条数。摘要里的 `durationSeconds` 与 `tickTimingMs` 是运行性能观测，不参与确定性逐字节对照；其余摘要字段完整比较。

| 实现 | 第 1 次（秒） | 第 2 次（秒） | 第 3 次（秒） | 中位数（秒） |
| --- | ---: | ---: | ---: | ---: |
| 原账本 | 648.311 | 629.844 | 634.653 | **634.653** |
| 增量账本 | 74.107 | 72.518 | 75.152 | **74.107** |

中位数提速 **8.564 倍**，耗时减少 **88.323%**。六次路线均成功结束；优化组三次与对应原账本的所有比较断言通过：每次 **10,949 个判定位逐位相同，全部为成功；报错均为空**。终局均为 6-7 胜利，10661 ticks / 288 条命令，100 HP / 141 金币；历史均为 **9,863 条，其中 9,637 条 deaths**，没有删除空记录。确定性摘要的 JSON 字节完全相同。

三组新旧路线共有的输出摘要如下，均从完整 JSON 字节计算 SHA-256：

| 比较对象 | 共同 SHA-256 |
| --- | --- |
| 完整终态 | `08ac26f28050655e7fafff93368a6a3a4fef711f9d6ad0580f9190bbf557443c` |
| 完整命令轨迹 | `6d3ab6c86f0acc23d4aa9c64ba2187ebd9b7b5b978dd70f526c85db386ce87dd` |
| 完整战斗事件/轮次 | `4d185a278e8c08a0e2a06131396504c24fc56848e9b8e9932bb7e92450634175` |
| 完整经济账本 | `20d4b4dbaec3620b647a5de11d0862a31417b7cb3cde2e759cfff9e5da6b9e81` |

生成的原始证据位于 `artifacts/h3-oracle-fast/`，不提交。

## 验证命令

```sh
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- --configLoader runner --maxWorkers=2 tests/h3-growth-oracle-fast.test.ts tests/augment-pool-batch5-h3-oracle.test.ts tests/m5-oracle-augment-ledger.test.ts tests/server/batch5-h3-room.test.ts tests/server/batch5-h3-cooking-room.test.ts tests/augment-history.test.ts
npm run typecheck
git diff --check
```

这些定向测试不使用浏览器；该占位环境变量仅阻止已有 globalSetup 尝试启动 Chromium，不建立浏览器连接。生产规则、数值、内容身份、golden、测试超时和验收阈值均未修改。

最终定向验证：6 文件、208 项通过，新增 32 项（新文件 30 项、真实房间逐点等价对照 2 项）；最后补充完整边界错误对照后，新文件 30 项再次通过。TypeScript 与 diff 检查通过。
