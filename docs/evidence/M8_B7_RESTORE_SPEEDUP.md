# M8 B7 存读档性能

基线：`origin/multiplayer` 的 `05a45db290fa52206b0b22c762bde8c7fd8ac5c0`。

## 实现与语义边界

- `serializeMatch` 仍执行全部对象输入校验和 `structuredClone`，对临时副本的待冻结元数据做纯数据图检查后，直接规范化；不再冻结只用于生成字符串、马上丢弃的普通副本。遇到数组额外属性、循环或非普通容器时回退到原冻结流程，保留原异常。公开 `restoreMatch` 的独立副本和冻结行为不变。
- 对象输入的 `restoreCombatInput` 已完成资源/权威校验并返回独立冻结副本。序列化内部的策略编译缓存现也接受其中经过 `isImmutableJson` 证明的完整纯数据图；保留 16 项上限、精确 JSON 字节键和负零回退。不缓存校验结果，调用者修改任何字段仍会重新校验。普通对象 `restoreMatch` 保留原来的每次重新编译路径，以保持临时可信定义变化时的拒绝错误。
- B7 测试辅助函数直接把 `serializeMatch` 输出传给 `restoreMatch`，避免外层 `JSON.parse` 把文本输入退回较慢的对象路径。被篡改的存档仍以对象形式送入拒绝测试。没有改变用例数、检查点、断言、20 秒超时或任何门槛。
- 未改变规则、数值、字段或 digest；未修改 `src/server/`、`src/rendering/`。

新增回归覆盖：连续保存的字节一致性、恢复后状态/事件一致性、原对象不受污染、返回对象独立性、缓存预热后篡改拒绝及错误类型/文本、访问器读取次数、负零保真，以及数组额外属性中的循环/typed array 原始拒绝错误。

## 复现

先按各自 checkout 的 lockfile 执行 `npm ci`。本次正式结果使用 Node 24.19.0、Vitest 5.0.3；容器 CPU quota 为 4 核。不是 GitHub CI 原机（CI 使用 Node 22）。预装 Vitest 3.2.7 的预诊断结果不计入下表。

```sh
node scripts/benchmark-m8-b7-restore.cjs /path/to/baseline /tmp/b7-before
node scripts/benchmark-m8-b7-restore.cjs /path/to/changed /tmp/b7-after
```

脚本先用全新进程分别单跑 3-7、4-7、5-7；随后启动四个并行进程，各带一个 Vitest worker，且每个 worker 完整执行三个原用例（共 12 次）。没有拆分测试，也不覆写超时。JSON report 中的 `duration` 是用例耗时；`processMs` 另含模块转换、夹具生成与进程启动。前后测试串行进行，计时期间不运行其他测试。

CPU profile 通过临时 `beforeEach` / `afterEach` 中的 Node inspector `Profiler.start/stop` 获取，覆盖用例本体；模块顶层的公共路线夹具加载不计入用例计时。临时埋点不提交。额外读取 `expect.getState().assertionCalls` 比较动态断言数量。

## 正式耗时（秒）

| 用例 | 修前单跑 | 修后单跑 | 降幅 | 修前 4 worker 范围 | 修后 4 worker 范围 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3-7 | 3.219 | 1.940 | 39.7% | 3.881–4.320 | 2.233–2.587 |
| 4-7 | 5.451 | 3.142 | 42.4% | 6.291–6.472 | 3.600–3.926 |
| 5-7 | 7.047 | 3.666 | 48.0% | 7.247–7.418 | 3.840–4.257 |

前后各三次独立单跑、12 次并发执行全部通过。保留毫秒原始数据和进程总耗时的证据见 `M8_B7_RESTORE_SPEEDUP.json`。用例外的转换/模块加载/完整路线夹具生成约 10–11 秒/单跑进程，本次未修改夹具。

## CPU profile 与断言

下表为函数及其子调用占采样时间的比例，父子项可能重叠，不能相加；profile 有采样开销，性能结论以上面的无埋点计时为准。

| 修前用例 | 规范化字符串 | 深拷贝 | 冻结 | 策略/装备编译 | 战斗推进 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3-7 | 38.3% | 8.6% | 5.9% | 3.7% | 6.7% |
| 4-7 | 40.4% | 9.7% | 5.8% | 2.8% | 7.0% |
| 5-7 | 41.0% | 10.3% | 6.5% | 2.7% | 5.5% |

恢复没有重演整场战斗；`validateB8Resources` 做资源/收据与经济账本校验，其消耗包含上面的规范化字符串工作。每个检查点同时保存、恢复并推进两条战斗分支，规范化和对象所有权处理才是本次主要热点。

| 5-7 采样项 | 修前 ms | 修后 ms |
| --- | ---: | ---: |
| `canonicalContent` | 2794.6 | 966.2 |
| `structuredClone` | 703.7 | 349.5 |
| `freezeContent` | 444.4 | 141.0 |
| `canSkipSerializationFreeze` | 0.0 | 23.8 |
| `buildStrategySnapshot` | 181.0 | 2.2 |

动态断言：3-7 **116→116**、4-7 **133→133**、5-7 **159→159**。没有减少原断言，另新增 6 个回归用例。

额外消融测量：仅替换生产文件、保留旧测试 helper，单 worker 在同一文件顺序执行三项，耗时 3.123 / 5.049 / 6.024 秒，全部通过。此测量的进程内预热顺序与独立单跑不同，仅用于区分生产优化和 helper 优化，不作为严格百分比对照。

外层 `JSON.parse` 移除后总解析次数仍为一次；收益来自恢复器能够证明解析图归自己所有，从而使用已有的直接比较、资源投影复用与避免恢复副本深拷贝的文本快路径。完整校验仍保留。

公共签名保持 `restoreMatch(input: unknown): MatchState`、`serializeMatch(state: MatchState): string`，拒绝条件和错误文本不变。

## 相关回归

最终代码的相关回归：**26 个文件、322 条通过，0 失败、0 跳过**；`npm run typecheck` 通过。未跑全套。fast 文件在 4 worker 下运行，炮手回放遵守原 timing project 单 worker 配置。

| 文件 | Project | 通过数 |
| --- | --- | ---: |
| `tests/g4-replay-snapshot.test.ts` | fast | 4 |
| `tests/m5-content.test.ts` | fast | 9 |
| `tests/m5-replay-cannon.test.ts` | timing | 1 |
| `tests/m5-replay-mage.test.ts` | fast | 1 |
| `tests/m5-replay-sniper-caitlyn.test.ts` | fast | 1 |
| `tests/m5-replay.test.ts` | fast | 1 |
| `tests/m5-serialization.test.ts` | fast | 33 |
| `tests/m6-persistence.test.ts` | fast | 44 |
| `tests/m6-replay.test.ts` | fast | 9 |
| `tests/m7-m6-save-compat.test.ts` | fast | 8 |
| `tests/m8-b10-item-save-replay.test.ts` | fast | 45 |
| `tests/m8-b10-temporary-replay.test.ts` | fast | 3 |
| `tests/m8-b3-restore.test.ts` | fast | 13 |
| `tests/m8-b7-audit-vectors.test.ts` | fast | 14 |
| `tests/m8-b7-catalog.test.ts` | fast | 5 |
| `tests/m8-b7-cleanup.test.ts` | fast | 5 |
| `tests/m8-b7-known-limitations.test.ts` | fast | 2 |
| `tests/m8-b7-match-wiring.test.ts` | fast | 30 |
| `tests/m8-b7-mechanisms.test.ts` | fast | 21 |
| `tests/m8-b7-serialization-reuse.test.ts` | fast | 6 |
| `tests/m8-b8-restore-fold-reuse.test.ts` | fast | 5 |
| `tests/m8-b8-restore.test.ts` | fast | 7 |
| `tests/m8-content-equivalence.test.ts` | fast | 4 |
| `tests/p7-restore-compilation.test.ts` | fast | 4 |
| `tests/t5r-b7-integration.test.ts` | fast | 1 |
| `tests/t5r-combat-replay.test.ts` | fast | 46 |

原始用例 20 秒超时、所有断言和现有门槛保持不变。没有修改 Vitest 配置，也没有拆分测试；基准脚本中的 `-t` 仅用于用户要求的单跑/并发测量。
