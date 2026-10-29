# EXT-1 v25 八机器人整局性能任务报告（2026-10-28）

起点：`claude/v25-perf-wip`（`b862cdac`）。交付分支：`codex/v25-perf`。只改动了 `src/simulation/`、`tests/`、`docs/`；未触碰 `src/server/`、`.github/workflows`、门槛/超时/断言、规则数值、epoch 证据与录制夹具。

## 结论

- 行为逐字节不变：种子 42、7、19 三局完整对比，终局状态、全部 MatchEvent、机器人意图、收据、逐场战斗账本、公开回放全部零差异；内容身份校验通过。
- 本机（4 核）独占运行目标测试：优化前 32.1–33.2 s，优化后 27.9–30.5 s，约 8–16% 的降幅，门槛 60 s 内通过。
- **未达到** 任务文档对作者机器的 ≤55 s 目标余量估计：作者机器优化前 68.5 s，按本机降幅外推为 58–63 s，可能仍不稳定地贴近或超过 60 s。需要在作者机器实测确认。

## 热点定位

用独立 bundle + `--cpu-prof`（`node --cpu-prof` 和 vitest worker 内 `inspector` 采样）两种方式剖析整局 29 s：

| 自身时间 | 位置 | 说明 |
| --- | --- | --- |
| 2.4–2.7 s | `advanceS13Tick`（含内联子调用） | 规则主循环，分散在 `planActions`、`resolvePackets`、`settleMana`、`maintainMechanisms` 等；本任务未改规则代码 |
| 2.1–2.3 s | GC | 整局分配约 23.5 GB，1530 次 scavenge；调大新生代（`--max-semi-space-size`）无收益 |
| 1.7 s | `copyCombatUnitForTick` | 每 tick 对 16 个单位各做一次 41 字段的浅拷贝 + 嵌套 `structuredClone`（整局 51.3 万次） |
| 1.1–1.3 s | `canonicalContent` / `canonicalContentSteps` | 战斗输入恢复与快照编码；`canonicalSteps` 曾为每个节点分配一个 generator |
| 1.1 s | `appendEvents`（双边战斗账本） | 每条账本事件先 `freezeTree` 再 `plainData` 两次遍历 |
| 1.0–1.1 s | `assertSharedPoolConservation` | 每条命令调用 3 次，共享池记录是字典模式对象 |
| 0.5 s | `encodePrimitiveTuple` | 记忆化 trie 命中率≈100%；尝试改为 `JSON.stringify` 反而更慢（键含引号走转义慢路径），已回退 |

剩余 profile 非常平坦（前 40 项各占 <1%），继续压缩需要改规则代码本身或减少每 tick 全量拷贝的设计，风险落在逐字节等价上，本任务未做。

## 改动

1. `src/simulation/content/freeze.ts`、`content/index.ts`：`freezeContentSteps` / `canonicalContentSteps` 改为单次同步遍历，边遍历边按旧规则计数（每 64 个被计费的非叶节点暂停一次，失败前同样暂停相同次数），保持属性读取顺序、冻结状态与房间调度可见的 yield 次数不变；对象键已升序时跳过 `sort`。
2. `src/simulation/immutable-json.ts`、`two-sided-battle.ts`：新增 `createScopedLedgerCertifier`，一次遍历完成账本事件的冻结与"深度冻结的有限纯数据"证明；证明不了的图（访问器、异常原型、环、非有限数）回退到原来的 scoped freezer + checker。
3. `src/simulation/plain-clone.ts`（新）、`combat-static.ts`、`augment-history.ts`：`clonePlainData` 代替纯数据的 `structuredClone`（别名/环保持一份拷贝，`__proto__` 键按自有属性处理），函数、symbol、访问器、非普通原型仍交给 `structuredClone`（包括其错误）；`copyCombatUnitForTick` 用 `Object.values` 一趟代替逐字段多态读取。`tests/plain-clone.test.ts` 覆盖与 `structuredClone` 的一致性。
4. `src/simulation/shared-pool-ledger.ts`：守恒校验用 `Map` 记录总量、每个目录 id 只读一次 `initial/available`，常量列表提升到模块级。

## 计时（本机 4 核，独占，`WALLCLOCK_REPORT_DIR` 记录的测试内墙钟）

| 版本 | 单独运行目标用例 | 备注 |
| --- | --- | --- |
| `b862cdac` 优化前 | 33,222 ms / 32,074 ms | 两次 |
| 本分支 | 30,275 / 30,469 / 28,904 ms | 连续三次 `npx vitest run tests/server/bot-driver-timing.test.ts -t 'plays eight bots from the first round'`，进程总墙钟 33.4 / 33.6 / 32.1 s |
| 本分支（另两次） | 27,876 / 29,742 ms | 与前者间隔其他负载，说明本机抖动约 ±1.5 s |

探针 `scripts/mp-sim-perf-probe.cjs`（含事件采集与账本写入）的 matchDurationMs：种子 42 30.1 s → 28.1 s，种子 7 29.9 s → 25.3 s，种子 19 27.5 s → 23.2 s。

## 等价证据

- 命令：`node scripts/mp-sim-perf-probe.cjs <b862cdac 工作树> BEFORE 42,7,19`、`node scripts/mp-sim-perf-probe.cjs /workspace AFTER 42,7,19`、`node scripts/compare-bot-perf-evidence.cjs <b862cdac 工作树> BEFORE /workspace AFTER REPORT 42,7,19`。
- 探针已为每个座位采集完整的 match 域 MatchEvent 序列（断言 `0..nextMatchEventSeq` 无缺口），combat 域事件随每场战斗账本保存；比较脚本逐字节比较终局、MatchEvent、意图、收据、账本行和两版各自生成的公开回放。三个种子均 `equivalent: true`，无需再扩展脚本。
- 结果文件：`docs/evidence/v25-perf/equivalence-42-7-19.json`（含每场回放摘要）、`probe-before.ndjson`、`probe-after.ndjson`。
- 摘要（before = after）：
  - 种子 42：33 轮、154 场、176,176 条战斗事件、1,828 条 MatchEvent；终局 `e4d714088e99fe1e…`，账本 `7d4f4f4fc7287248…`，回放 `b3c35eebdb99696b…`
  - 种子 7：36 轮、155 场、125,690 条、1,858 条；终局 `eabf51a5d029cffe…`，账本 `20c32492e5829782…`，回放 `8863b72f1918b159…`
  - 种子 19：34 轮、152 场、99,203 条、1,876 条；终局 `34b8a50e9cf0bf86…`，账本 `bd0a9668274595a9…`，回放 `8416abeb49dd9cfe…`
- `node scripts/update-content-identities.cjs --check` 通过（`contentDigest fnv1a32-utf16:93d57139`，`lootReplayDigest fnv1a32-utf16:5a53934e`）。

## 已跑过的测试

- `npx tsc --noEmit -p .`：通过。
- `npx vitest run tests/server/bot-driver-timing.test.ts`：通过（含闲置人类 + 7 机器人用例，27,996 ms）。
- `npx vitest run tests/mp-sim-perf.test.ts tests/restore-canonical-encoding.test.ts tests/server/net/server-whole-match.test.ts`：3 个文件 979 个用例全部通过。
- 定向：`tests/plain-clone.test.ts`、`tests/scoped-immutable-json.test.ts`、`tests/primitive-tuple.test.ts`、`tests/augment-history*.test.ts`、`tests/shared-pool-cache.test.ts`、`tests/tp-shared-pool.test.ts`、`tests/m8-b8-loot-freeze.test.ts`：通过。
- `npm test`（fast 项目全量）：**未跑完**，按用户指示中止。跑完部分有 23 个文件出现失败；其中抽样 7 个文件（`opening-random-identity`、`task-mechanism-restore`、`v19-part2`、`augment-batch3-verify-public`、`m8-b5-temporary`、`server/battle-start-slices`、`g2-augments-combat`）在未改动的 `b862cdac` 上失败数逐一相同（例如 `opening-random-identity` 均为 136/154 失败，原因是起点分支已同步的 `CONTENT_DIGEST 93d57139` 与 v24 epoch 夹具记录的 `1b86447c` 不一致），属于起点分支既有问题，与本任务改动无关；其余 16 个失败文件未在基线上逐一复核。

## 未完成 / 风险

- 作者机器上的 ≤55 s 目标未经实测，按本机比例外推可能仍不达标；进一步收益需要触及 `combat-s13.ts` 规则循环或每 tick 全量拷贝的设计。
- fast 全量套件未跑完；上文列出的既有失败需要单独处理（起点分支的内容摘要与 epoch 夹具不一致）。
- 单遍遍历证明器对含访问器等奇异图的 getter 调用顺序与"先冻结再检查"的两步法略有差异（只影响此类非法输入的失败路径，不影响任何纯数据输入与本任务的等价证据）。
