# v26 histperf：强化历史累计

工作区 `claude/v26-history-perf`，起点 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`；不提交、不改 `.git`。没有修改 `src/server/`、界面、数值、内容身份、fixture 数据或原有测试断言、超时、阈值。

## 生产改动

- `append-only-log.ts` 保存私有追加数组和每份状态的固定前缀长度。正常后继只 push 新项；旧前缀分叉才复制一次。公开数组在发布历史时立即物化，各快照彼此独立，兼容冻结、JSON、structuredClone。
- `augment-history-log.ts` 用 WeakMap 关联历史对象和私有日志。死亡边界按 battleId/tick 查询，死亡 eventSeq 首次位置按 battleId 查询；每个查询都限制在该状态的前缀内，未来状态及其它分叉不能补足旧证据。准备期时钟用按轮的不可变索引，战斗追加直接共享；仅 acquire/preparation-time 复制至多 256 轮的时钟索引。
- `augment-history.ts` 沿用所有公共签名和失败原因。私有轨迹中连续 stepMatch 只更新命令尾部 count，切换命令才追加旧尾部；公开 proof.commands 每次发布为普通数组。无参数的重复 step 不再 structuredClone 空数组。完整 facts、空 deaths 边界、参数脱离所有权、失败/no-op 身份及恢复认证保留。
- Opus 后续修正：facts/commands 不再有 getter；历史后继按对象展开语义恢复所有可枚举字段的可写、可配置数据属性，冻结输入的 version/seatId 不会变成只读。旁表检查 facts 数组替换，避免继续使用旧数组索引。snapshotData、fixedCapture、clonePlainData 和原有纯数据比较实现均未修改。
- 冷输入重建索引；这些缓存不能充当认证。原有单人命令重演、完整状态比较、历史前缀验证、独立服务器 authority 均保持原实现。

复杂度范围：沿一条正常命令链，私有日志、死亡边界及准备时钟索引维护合计 O(F+T)，私有命令前缀维护 O(C+T)。但每次发布普通 facts 数组仍需 O(F)，commands 数组需 O(C)，因此完整生产记录路径仍有 O(T·F+T·C) 的最坏成本。普通原生数组、立即可读的完整内容及旧状态固定前缀这三项约束下，不能保留 getter 初稿对整条记录路径的线性宣称。旧状态分叉另外需要 O(F) 复制。

## 计时口径

Node v22.23.4；新进程先加载模块，再从 `createMatch(230)` 一直计时到 `6-7/gameOver`。原实现通过只读 `git show 4baaaf5a:src/simulation/augment-history.ts` 在 Vite 加载时替换；其它生产文件、路线、神谕和全部断言相同。正式计时前后单独运行，不并行跑测试；计数另起进程，不用插桩耗时计算提速。

默认完整路线仍使用 `generate-m5-route.cjs` 的原策略、经济/成长神谕、每 tick 观察与全部断言。公开命令累计时间含生产调用，不含调用间的神谕/哈希时间；完整路线计时包括它们。最终额外执行 serializeMatch，验证存档 SHA-256；此项在整局计时区间之后，未混入 createMatch→结束耗时。

| 测量 | 原实现 | getter 初稿 | 本轮普通数据属性 |
| --- | ---: | ---: | ---: |
| seed230 生产整局（同一公共命令记录重放） | 18.922 s | 13.902 s | 15.461 s |
| seed230 完整路线（含原神谕） | 74.985 s | 67.434 s | 68.274 s |
| 同路线公开命令累计 | 27.325 s | 18.324 s | 18.823 s |
| bot-driver-timing 文件 Duration | 138.74 s | 134.14 s | 140.27 s |
| 八机器人用例（门槛内计时） | 68.682 s | 67.650 s | 69.513 s |
| 闲置人类＋七机器人（门槛内计时） | 未单独记录 | 59.539 s | 64.197 s |

生产整局相对原实现减少 18.29%，完整路线减少 8.95%，公开命令累计减少 31.11%；普通数组发布比 getter 初稿多出复制成本。生产整局另以 `--production-only` 从 createMatch 重新执行原路线记录的全部 288 条公共命令与 10,661 ticks；该补充测量不执行观察神谕，并且前后都核对完整终态及真实存档文本与原完整路线相同。它没有替代完整路线或任何既有测试。

原实现和 getter 初稿列来自上一轮保留的原始记录；本轮最终代码重新测量，没有把插桩运行的耗时混入表格。以上均为单次测量，只表述本机观测，不保证任意 CI 负载。bot 的八机器人用例三版均超过原 60 s 门槛，严格模式仍为 1 failed / 1 passed；没有关闭门槛。本轮闲置人类＋七机器人为 64.197 s，通过原 120 s 门槛。

另以完全相同的 seed230 终局状态（完整终态 SHA 也核对相同），预热一次后连续执行 20 次 snapshotData：getter 初稿 **861.327 ms**，本轮 **732.096 ms**。`snapshotData(state).m8 === state.m8` 从 false 恢复为 true，facts/commands 的属性描述符也从访问器恢复为数据属性。此微基准在独立进程中运行，不在整局计时区间内；终局历史较长，不与评审中其它检查点的 49/84 ms 直接比较。

## facts 操作计数

单独的 `--count` 进程只在 Vite 内存转换中插桩，生产文件没有计数器、真实时钟或测试开关。以下计数区间与整局相同，排除结束后的输出哈希和存档认证重演。计的是本任务热点触及的历史行槽位，不将无关规则派生器的所有读取冒充为已统计。

| 操作 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 追加事实 | 9,863 | 9,863 |
| append 复制的旧事实槽位 | 48,634,453 | 0 |
| deaths 全历史 filter 访问 | 48,892,911 | 0 |
| deaths 边界 some 访问 | 1,935,572 | 0 |
| 终战 deaths 行遍历 | 19,550 | 0 |
| preparationElapsed/时钟全历史 filter 访问 | 48,516,227 | 0 |
| 新死亡索引增量访问 | 0 | 9,863 |
| 新公开数组物化复制 | 0（旧数组在 append 时已复制） | 48,644,316 |

旧热点共 147,998,713 次槽位访问/复制；本轮新索引逐行维护 9,863 次，公开数组发布复制 48,644,316 次。合计为 **147,998,713 → 48,654,179**；私有日志追加新行本身均另计 9,863 次。新公开数组复制包含新行，旧 appendCopies 只统计旧前缀，两个复制步骤的槽位触及范围在表中分别列出，未将其隐藏。

本轮计数使用 `after --count --production-only`：恢复普通数据属性后，发布成本发生在生产命令中，不再依赖外部观察器何时读取数组。初稿生产整局仅 845,512 次按需物化的结果不再代表最终实现。计数进程继续核对终态、事实数及完整公共命令记录；另一个不插桩进程核对真实存档文本。

## 完整性对照

seed230 仍为 38 个 roundResults、33 战、10,661 ticks、288 条公开命令，终局胜利、100 HP、141 金币；9,863 facts，其中 9,637 条 deaths。前后以下完整 SHA-256 一致，非仅摘要字段一致：

| 对象 | SHA-256 |
| --- | --- |
| 完整终态 JSON | `cb53baa335e58624cfef4109cf48182e8583ef3340ba96ae0451f438090c41da` |
| serializeMatch 存档文本 | `cbcb80f45265a0f762e97401c6e8e2929b53b16dff7a8470277ece5312661506` |
| 全部命令轨迹（含每次前后哈希与事件） | `84c7e8c20eaf74d349f5ead47c1f9b1b6cf21fe63b01e13e8844888ec7fec65b` |
| 全部战斗/事件 | `9bc30d67af1825e7c1d0ebee7fbe400a06f8a7462fc1d7f45e91bccdfae31fb3` |
| 独立经济账本 | `20d4b4dbaec3620b647a5de11d0862a31417b7cb3cde2e759cfff9e5da6b9e81` |

## 验证与来源清单

本轮相关 7 文件、121 项通过；包含既有历史篡改/恢复矩阵、长历史冷恢复、回放快照，以及新增的固定快照、冻结后追加、分叉、未来证据隔离、时钟优先序、4096 边界无全数组读取、命令尾部压缩与参数脱离检查。typecheck 和 `git diff --check` 通过。

新增两项回归检查冻结输入的可写/可配置属性、facts 替换后的索引重建、facts/commands 数据描述符、冻结历史的纯 JSON 认证，以及 snapshotData/fixedCapture 对 m8 和冻结历史的引用共享。还通过 structuredClone spy 确认 snapshotData、fixedCapture、clonePlainData 没有回退原生整图克隆。原有断言、超时和阈值均未修改。

当前 node_modules 指向只读共享目录，默认配置加载器会尝试写入其中的 `.vite-temp`。本轮 Vitest 使用 `--configLoader=runner` 加载同一配置，仍按 `--maxWorkers=4` 运行相关测试；timing 项目自身保持单 worker。

已修正 `record-v25-online-rules-herald.cjs` 的直接来源清单：将过时的 `m4-evidence.cjs` 改为实际使用的 `m5-route-hash.cjs`；`v25-online-rules-fixture-audit.cjs/sourceDigests` 补收该脚本。内容 digest、loot replay digest 与版本身份没有变化。来源摘要本身以及消费端字节清单需要用户决定是否重录；未运行任何 `--write`。

严格执行 `node scripts/verify-v25-epoch-parallel.cjs --jobs=4`，退出 1，`complete:false`；5/15 步实际启动，首次失败后调度器按原设计停止启动后续步骤，已运行的步骤全部结束。另以相同 check 参数补跑其余六种独立脚本（最多四进程）；四个重复入口分别复用同脚本同参数的结果，没有修改原 runner 或将其报告改绿。

| 检查 | 结果与证据 |
| --- | --- |
| identities、历史保护、content/loot/rules digest 重算 | 通过；当前 content=`f671ab88`、loot=`36ebfac2`、rules manifest=`2f4de5ce`，全部与现有 v25 证据一致 |
| release | 四路线各 33 战、cannon/sniper 各 67 状态的完整恢复和存档核对完成；gzip、golden、content-baseline 字节通过，最后在 `release-audit.json` 来源摘要失败 |
| Herald | 五份完整 raw state、trajectory 字节通过；逐份恢复和开战后 15 ticks 恢复通过；最后在 `manifest.json` 的 sources/sourceSha256 失败 |
| battle-start、inputs | 实际 fixture 字节通过；最后在各自来源审计失败 |
| live-reveal | 全部原场景断言执行完，最后在来源审计失败 |
| transfer、chest-trial | check 全部通过，fixture 及对应证据不变 |
| consumer-byte-audit | 失败：新增测试及来源清单修正改变当前消费端源码字节清单 |

需要用户决定是否刷新以下六份**当前来源/消费端审计**：`docs/evidence/v25-online-rules/{battle-start-audit,release-audit,input-fixture-audit,live-reveal-audit,consumer-byte-audit}.json` 和 `tests/fixtures/v25-online-rules-herald-raw/manifest.json`。仅生产源码优化也会改变其完整源码摘要，不只两处来源清单修正会触发。因此“改生产源码、保留旧来源摘要、严格总 check 全绿”三者无法同时满足；本次保留所有旧证据及严格断言，明确报告红灯，等待用户决定重录。当前没有实际对局/存档 fixture 字节变化。

本轮日志：`artifacts/histperf/opus-review/`；最终基准结果为该目录的 `final-after*.json`，`getter-after*.json` 保留修正前初稿，`snapshot-{review,after}.json` 为两次快照测量。epoch 原始日志仍为 `artifacts/v25-online-rules-recording/*.log` 和 `epoch-verification.json`；本轮补充结果为 `artifacts/histperf/opus-review/epoch-supplement/results.json`。完整 runner 报告仍如实标为失败。

复现命令：

```sh
node scripts/benchmark-augment-history.cjs before
node scripts/benchmark-augment-history.cjs after
node scripts/benchmark-augment-history.cjs before --count
node scripts/benchmark-augment-history.cjs after --count
node scripts/benchmark-augment-history.cjs before --production-only
node scripts/benchmark-augment-history.cjs after --production-only
node scripts/benchmark-augment-history.cjs before --production-only --count
node scripts/benchmark-augment-history.cjs after --production-only --count
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- tests/augment-history-log.test.ts tests/augment-history.test.ts tests/augment-history-long-restore.test.ts tests/augment-pool-batch5-r2-history.test.ts tests/augment-pool-batch5-s3b-history.test.ts tests/augment-history-carousel-growth.test.ts tests/g4-replay-snapshot.test.ts --maxWorkers=4 --configLoader=runner
WALLCLOCK_REPORT_DIR=artifacts/histperf/opus-review/bot-after node node_modules/vitest/vitest.mjs run --project timing tests/server/bot-driver-timing.test.ts --maxWorkers=4 --configLoader=runner
node artifacts/histperf/opus-review/snapshot-benchmark.cjs review
node artifacts/histperf/opus-review/snapshot-benchmark.cjs after
node scripts/verify-v25-epoch-parallel.cjs --jobs=4
npm run typecheck
git diff --check
```

上面相关测试均为纯 Node 测试，占位浏览器变量仅用于跳过已有 globalSetup 的浏览器启动；不建立连接。快照微基准及初稿源码副本保存在忽略提交的 artifacts 目录，以便本工作区复测。计时/计数及临时日志均不提交。
