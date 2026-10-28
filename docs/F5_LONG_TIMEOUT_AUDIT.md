# F5 长超时审计（2026-10-28）

## F5 续验（2026-10-28，本轮）

本轮先检查 `git status`、`git diff`：保留上轮 6 个已跟踪文件的改动以及新增的 oracle/哈希辅助文件；实际仍为 `claude/sol-final @ e3b78cb3`，`97068956` 是祖先。没有 git 写操作，没有 src 改动、超时/预算改动或纪元录制操作。以下为本轮增量；文档后半保留上轮数据，不能混作本轮验收。

### 热点与改法

- 单独筛选 seed 230 重新采样。初始采样文件包含 seed-49 预热：125.86 s 文件墙钟、seed230 测试体 111.991 s；H3 累计 53.212 s，其中 CPU 自耗主要为 `plainEqual` 26.640 s、`freezeObservation` 15.934 s。src 历史记录采样累计 30.945 s，哈希 11.794 s。这组累计值**包含预热**，不能相加当成 seed230 测试体分项。
- 隔离预热后的中间采样（`artifacts/f5/continued/seed230-r5.*`）：seed230 测试体 88.098 s；H3 墙钟 38.494 s、其余 ledger 校验 19.391 s、哈希 3.881 s，剩余 26.332 s 是公开命令/战斗、路线编排、最终断言和采样开销。CPU 分组为 H3 37.115 s、其他独立 oracle 19.390 s、src live history 24.732 s、其他 7.192 s。`plainEqual` 的已认证行 WeakMap 查询仍是最大叶热点（约 12,747 个源码位置样本）；据此改成数组级行凭据。
- `tests/fixtures/m5/observed-equal.cjs`：普通数组直接检查完整保留前缀，避免先切片再构造全部字符串索引；依照 ECMAScript 数组键顺序认证稠密索引，稀疏、额外属性、符号和特殊类型保留 Node 比较语义。独立副本构建时一次完成映射、冻结和认证，减少额外冻结遍历；完整比较仍逐行扫描。按独立期望数组保存行凭据，每个旧行仍检查当前来源身份，只有**完整比较成功且双方深不可变**的行能复用；新克隆、新行和可变来源必须比较字段。
- `tests/fixtures/m5/h3-growth-oracle.cjs`：仍保留完整 detached before 检查点、四类完整前缀、逐项边界/来源/合并和完整增长收据断言；仅复用 oracle 自己的旧副本。复制变化分支时顺便冻结变化的生产小节点，取消结尾再次遍历全部生产历史。没有将任何生产 growth reader 或规则实现作为神谕。
- `tests/fixtures/m5/augment-h6-oracle.cjs`：同一条 append-only 断言改用精确前缀比较器，保持全部旧行和原错误标签。
- `scripts/m5-route-hash.cjs`：单条路线中复用共享不可变子树的原 canonical 文本；仍是相同键排序、数组顺序、undefined/稀疏编码和 SHA-256，未换摘要或跳过摘要。通用坏档/可变证据继续使用原 `m4-evidence.hash`。

### 冻结观察值对生产快路径的影响

评审提醒属实：oracle 主动冻结生产对象会让原本可变的真实输入进入 src 的深冻结认证/缓存路径。相关入口包括 `immutable-json.ts:71` 的 `isImmutableJson`、`battle-record-validation.ts:25`、`loot-freeze.ts:38`、`combat-static.ts:91` 和 `shared-pool-ledger.ts:156`。因此冻结路线的速度不能直接当成真实联机未冻结输入的性能；本轮没有修改这些 src。

`tests/m8-b8-oracle.test.ts:190` 的 **完整 seed42 主路线**显式传入 `freezeObservations:false`，oracle 只冻结独立副本，不冻结生产输入；每次公开命令/tick 观察都断言生产 `augmentHistory.facts` 未被冻结。`scripts/generate-m5-route.cjs` / `.d.cts` 和 `tests/fixtures/m5/oracle.g2.cjs` 只传递这一测试选项。生产构造器自己冻结的常量仍维持原行为。新增无冻结篡改回归确认原地修改 roster/shop/history 后，独立 before 检查点仍拒绝，而非依赖抛 TypeError 才能发现。

seed230 保留默认冻结小节点观察；生产大日志容器仍不冻结。曾试验整体冻结大日志，首个试跑超过原 120 s，已撤回；没有扩大预算。两条原种子、默认炮手公开命令策略、6-7 终局、38 结果、33 战斗和全部原收据断言均保留。

### 续验结果

**三次整文件单跑以及一轮真实三 worker 负载全部达到 seed230 ≤84 s；两条原路线均通过全部原断言。**

| 运行 | 通过 | 命令墙钟 | B8 文件钩子/测试区间 | seed42（不冻结生产输入） | seed230 | 230 对原 120 s 预算余量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| solo-verified-1 | 25/25 | 196.164 s | 182.235 s | 79.560 s | **81.371 s** | 32.19% |
| solo-verified-2 | 25/25 | 193.237 s | 179.575 s | 79.448 s | **78.424 s** | 34.65% |
| solo-verified-3 | 25/25 | 193.852 s | 180.425 s | 81.218 s | **78.492 s** | 34.59% |
| load-final | 3359/3359 | 455.493 s | 183.886 s | 79.183 s | **83.581 s** | 30.35% |

“命令墙钟”包括启动、导入和报告，以及负载文件；“B8 文件区间”来自 JSON reporter 的文件 `endTime-startTime`。性能目标仅按独立用例 duration 判定，不挪到钩子或测试收集阶段，也不把三个测试体分拆计时。所有命令均保留 `--configLoader runner --maxWorkers=3`。

完整负载是同一次 Vitest 的 `m8-b8-oracle.test.ts`、`m5-replay.test.ts`、`m5-replay-mage.test.ts`；分别 25、1673、1661 项，共 **3359/3359**。两套回放文件的实际测试区间约 407.534 / 396.905 s，B8 为 183.886 s，负载覆盖整个 seed230 执行区间；不是在 seed230 开始前就结束的短负载。

seed230 最差 83.581 s，距 84 s 目标仍仅约 **0.419 s**；达到本机实测要求，不宣称对任意 CI 机器或任意额外负载都有保证。seed42 为完整未冻结观察路线，三次单跑 79.560 / 79.448 / 81.218 s，完整负载 79.183 s，也均 ≤84 s。

最终辅助回归 **6 文件 82/82**：Node 深比较差分、普通/特殊/稀疏数组、原地/替换篡改、缓存行凭据继承、循环回退、独立检查点分叉与无冻结输入、原编码 DAG 哈希，以及 H3 在线神谕和 H6 真实恢复审计均通过。`npm run typecheck` 退出 0。

最终直接 CLI 定向三 worker 复核：seed230 与 M4 容量、M7 FX 同时运行，**6/6** 通过（B8 其余 24 项明确未选中）；seed230 **77.532 s**，M4 容量 16.860 s，FX 文件钩子/测试约 30.840 s，命令 Duration 90.25 s。它补充验证最终比较器的循环回退，不替代上表的完整 25 项负载验收。

原始结果在本地 `artifacts/f5/continued/`，不提交。完整负载/三次单跑的收集器 `.command.json` 带有 spawnSync 的 EPERM 附加元数据且未捕获控制台输出，但每轮 `status=0`、新生成 JSON 的 `success=true`、用例计数和时间区间完整；表格时长来自这些 JSON。最后的 82 项回归、tsc 和定向负载均改为直接 CLI，日志完整、命令正常退出。


### 最终 seed230 分项剖析

关闭预热区间、只采样目标用例，最终测试体为 **79.120 s**（开启 inspector 与计时包装器，仅用于定位；预算验收使用前述关闭采样器的运行）。下表四个非零墙钟区间互不重叠：从 ledger 总计扣除独立观察/前缀比较，再从测试体扣除 ledger 和哈希得到路线余项。

| 区间 | 墙钟 |
| --- | ---: |
| 公开命令/战斗、路线编排及最终断言余项 | 27.735 s |
| 神谕副本构建、独立数学及其余小断言 | 36.248 s |
| 独立检查点及 H3/H6 完整前缀比较 | 11.283 s |
| 原 canonical 编码与 SHA-256 路线摘要 | 3.854 s |
| 存档 serialize/restore 往返（该路线未调用） | 0 s |

最终 H3 总计 **28.826 s**；含 H3 的完整 ledger 为 **47.531 s**。观察比较调用 10,949 次、完整前缀比较 54,745 次（每步四个 H3 前缀及一个 H6 前缀），摘要请求 642 次。目标路线仍为 **10,661 ticks + 288 commands**，没有减少观察次数或真实命令。

最终 CPU 采样：比较 9.812 s、H3 其余副本/数学/小断言 19.397 s、其他独立 oracle 16.205 s、哈希 3.555 s、含 src history 的调用栈 25.987 s、其余 4.457 s。最大单叶已从通用比较转为 `observedArray` 的完整副本/凭据构建（12.886 s）；`plainEqual` 自耗为 2.748 s，额外全量冻结遍历不再是主热点。此处报告剩余热点，不据此继续扩大改动范围。

### 本轮文件位置与复现

| 文件:行 | 本轮增量 |
| --- | --- |
| `tests/fixtures/m5/h3-growth-oracle.cjs:26` / `:40` / `:172` | 变化分支复制与节点冻结合并；可关闭生产输入冻结；保留完整 checkpoint |
| `tests/fixtures/m5/observed-equal.cjs:13` / `:41` / `:88` / `:132` | 独立数组构建、浅节点认证、完整精确比较、完整保留前缀和行凭据 |
| `tests/fixtures/m5/augment-h6-oracle.cjs:70` | 同一完整 append-only 断言使用精确比较器 |
| `scripts/m5-route-hash.cjs:8` | 同编码的共享子树文本复用 |
| `scripts/generate-m5-route.cjs:25` / `.d.cts:4` | 仅传递测试观察冻结选项 |
| `tests/fixtures/m5/oracle.g2.cjs:16` / `:579` | Ledger 仅转发冻结选项，不改独立数学 |
| `tests/m8-b8-oracle.test.ts:190` | seed42 主路线不冻结生产输入并逐步检查 facts 容器 |
| `tests/h3-observed-equal.test.ts:58` / `:108` / `:126` | 前缀差分、缓存行篡改和循环回退回归 |
| `tests/h3-oracle-checkpoint.test.ts:56` | 原地修改未冻结生产输入仍被独立 checkpoint 拒绝 |
| `tests/m5-route-hash.test.ts:28` | 确定性 DAG 与原编码逐值比对 |

```sh
export PATH=$HOME/.local/bin:$PATH
# 连续单独执行三次；保留原 120000 ms 用例预算。
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b8-oracle.test.ts
# 同一次 Vitest 三 worker，两个完整真实回放套件持续加负载。
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b8-oracle.test.ts tests/m5-replay.test.ts tests/m5-replay-mage.test.ts
# 最终版本直接 CLI 的定向三 worker 复核。
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b8-oracle.test.ts tests/m4-ledger-bound.test.ts tests/m7-fx-plan.test.ts -t 'seed 230|M4|M7'
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/h3-observed-equal.test.ts tests/h3-oracle-checkpoint.test.ts tests/m5-route-hash.test.ts tests/m5-oracle-h6.test.ts tests/augment-pool-batch5-h3-oracle.test.ts tests/augment-pool-batch5-h6.test.ts
npm run typecheck
git diff --check
```

**本轮未完成：无。src 修改：无。需要用户决定：无。** 改动留工作区，供执行端评审和提交；纪元、录制夹具、规则/数值和原性能预算均未改动，断言未弱化。

### src 热点边界

`src/simulation/augment-history.ts:35` 追加事实复制整个历史、`:224` 每 tick 从历史过滤死亡行、`:275` 复制命令前缀，仍有累计平方成本；最终隔离 seed230 CPU 采样将约 25.987 s 归入含 `augment-history.ts` 调用栈的 live-history 组（包含其子调用，不能全部算成历史记录自耗）；`preparationElapsed`（`:161`）、`recordAugmentTransition`（`:201`）的叶自耗分别约 4.979 / 3.389 s。没有改 src。这个长用例的 driver **没有调用 serializeMatch/restoreMatch**；测试中的 route hash 是证据编码，不是存档认证往返。不能把 live history 成本误报成序列化/恢复热点，也没有证明 replay/serialize 超线性。

## 上轮范围与口径

工作区 HEAD 为 `e3b78cb377bf2c08daf997d158d5495143f38114`，分支实际为 `claude/sol-final`；`97068956` 是其祖先。未写 `.git`，改动留工作区。没有修改 src、玩法/数值、原超时/性能门槛、录制夹具、内容身份或 `docs/evidence/`，没有重录纪元。新选种子仅 1、49，均在 0..100；2146 沿用原英雄终局用例，仅换实际持有者和站位。未用脚本化三选一。

所有 Vitest 命令使用 `--project fast --configLoader runner --maxWorkers=3`，Node 22.23.4 / Vitest 5.0.3。原始基线逐文件启动，期间部分 CPU 采样与其他基线进程重叠，因此不把前后墙钟比值称为纯 CPU 加速倍数。最终验收关闭采样器，五文件串行启动，分别统计文件墙钟、用例和钩子耗时；30% 余量按 **耗时 ≤ 原预算 × 0.7** 计算。

原始日志、最终 JSON、采样原文件在本地 `artifacts/f5/`，属于不提交的生成物。CPU 分布来自 Node inspector 采样，包含 GC/调度影响，函数占比只用于定位；最终预算采用关闭采样后的验收结果。

## 原始基线

| 文件/目标 | 原预算 | 本次基线 | 结果 |
| --- | ---: | ---: | --- |
| m4-ledger-bound 主用例 | 120 s | 131.386 s | 超时，尚未执行到完整容量断言 |
| m8-b8-oracle seed 42 / 230 | 每项 120 s | 126.552 / 134.865 s | 两项超时；未结束的异步路线又触发 worker 退出超时 |
| cd-replay-facts 吸收 | 60 s | 69.458 s | 超时 |
| cd-replay-facts Cuts / Eagle Eye | 每项 60 s | 21.088 / 21.804 s | 本 HEAD 是真实断言失败：seed 3 已不持有 Wealthy Rehab II |
| m7-fx-plan beforeAll | 120 s | 131.569 s | 钩子超时，3 项未执行 |
| m8-b8-loot-view 首个 beforeAll | 10 s | 14.413 s | 钩子超时，8 项未执行 |

## 根因与测试修改

1. **主要热点在测试 H3 oracle。** 原 m4 采样窗口 132.40 s 中，H3 占 91.30 s，其余独立 oracle 8.09 s，生产历史记录 16.67 s，路线哈希仅 3.78 s。通用 `structuredClone` 自身占 57.79 s（含各调用方），Node 深比较的 `objectComparisonStart/keyCheck/objEquiv` 另有显著成本。本次改前的 H3 每 tick 深复制整份 memory（含之前检查点），结尾再深复制整个新检查点，并反复深比较所有历史前缀。v25 的逐 tick 历史放大了这些成本。Git 历史中，历史记录模块首次加入于 `4fbb08f3`，H3 独立 oracle 首次加入于 `22131959`；本次未跑 v24 同机对照，不报告 v24→v25 的纯性能倍数。
2. **保留脱离生产的独立期望。** `tests/fixtures/m5/h3-growth-oracle.cjs` 改为只复制变化分支；复用的都是 oracle 自己的副本，不把生产 facts 或 growth reader 当期望。保留完整 before 检查点、全部四种前缀、合并、归属、增长、边界和拒绝原因检查。
3. **只复用已比较过的不可变对象对。** `tests/fixtures/m5/observed-equal.cjs` 对普通数据执行完整逐字段比较，其他类型/失败回到 Node `deepStrictEqual`。观察时冻结小数据节点和独立副本；大日志数组继续逐次扫描、保持独立副本，不冻结/缓存整个大数组，避免每 tick 重建所有索引描述符。只有双方均已认证为深不可变且完整比较成功，才能复用对象对。原地改节点抛错，替换日志行或克隆后联合篡改仍被拒绝。WeakMap/WeakSet 不保留失去所有者的旧状态。
4. **哈希仍是原编码和 SHA-256。** `scripts/m5-route-hash.cjs` 在单次 `run` 内复用同一不可变状态的摘要；上一命令 after 与下一命令 before 往往是同一个对象。`m4-evidence.hash` 对可变坏档和通用证据的行为不变，没有换算法或跳过 oracle/事件校验。
5. **容量夹具的两个独立问题。** `tests/m4-ledger-bound.test.ts` 原来捕获第 33 回合后仍跑到终局；现在只生成被使用的真实前缀。seed 42 的 v25 历史认证会先拒绝人为超载阵容，使原 `/current resource fold/` 断言失去隔离性；换成 4-2 为金色节点的 seed 1。原 9 个三星单位、27 成装、3 强化、1 异常，事件序列/深复制/20 MiB 等所有断言保留。增加默认种子重开验证，再显式重开 42，保留原 `createMatch(42)` 断言。
6. **恢复审计的自然路线漂移。** `tests/restore-audit/cd-replay-facts.test.ts`：seed 66 现在是 Prismatic Party，除超时外还暴露其路线的 item-serial oracle 失败；吸收用例改用 seed 1 的普通 4-7 中立单位，4-5 留 80 金购买目标异常。Cuts/Eagle Eye 改用范围内扫描发现的 seed 49；3-2 自然三选一含 Wealthy Rehab II，公开命令选择它，4-5 留 150 金购买所需异常。没有补钱、改收据或放宽拒绝原因；原 Mirror 动态回放和 G23 吸收入口分别执行到原断言。
7. **Loot 钩子和失效持有者。** `tests/m8-b8-loot-view.test.ts` 合并两个相同默认前缀的预热，不再为未使用的 Loris/Rell 预热派生部署。原 seed 2146 的炮手路线已卖掉 Maddie；改用同种子的正常狙神路线保留二星 Maddie，共享原空板败局日程（`tests/fixtures/t13-loot-public.ts:102`）。通过路线已有拆卸器、四根已有大棒的两次合成及公开装备命令，装备 Warmog / Deathcap / Statikk Shiv，站 `(0,7)` 杀死 r01/r03，仅取得剑和 Cassiopeia；r00 的铁砧仍未赚取。没有购买额外币或注入英雄/装备，仍为 3 HP / 已损失 97 的满板终局。原两死亡、独立掉落、保留状态、无收据/无行动等断言保留，并补充 HP=3、板凳9格、持有者站位和英雄掉落存在断言。其他三个终局案例不变。
8. **FX 保留整条路线。** `tests/m7-fx-plan.test.ts` 没有改动；仍生成全部回合和所有原事件，仍检查所有原映射/治疗/文字/reduced-motion 断言。完整 seed 42/230 的 B8 路线测试也保留原路线、终局和账本断言。

## 未修改的 src 热点及证据

- `src/simulation/augment-history.ts:35` 的 `appendAugmentFact` 每次复制整个 facts 数组；`:224` 每 tick 从全历史过滤当前战斗 deaths；`:230` 即使没有死亡也为每个推进的 tick 记录边界。因此同一历史持续 T tick 时，这两项存在 O(T²) 的累计复制/扫描成本。这是代码结构给出的复杂度证据，不把整场不同阵容/不同 tick 数的墙钟比值当作复杂度证明。
- 同文件 `:275` 每 tick 更新压缩 step 命令时仍复制命令前缀。原 m4 采样中生产历史路径累计 16.67 s；H3 仅优化复制的中间 oracle 采样中，生产历史路径累计 40.70 s（整文件多条路线）。这些都是 live 记录成本，不应误归为恢复专用的强化三选一历史检查。
- `src/simulation/augment-history-restore.ts:220` 从 origin/命令前缀认证保存状态，并受 8 MiB / 8 条 evidence 上限约束。容量 seed-42 的中间采样中，此路径约 11.24 s；非法超载态首先报 `Invalid augment history: replayed facts/state mismatch`。本次没有证明 restore/序列化本身超线性，也没有绕过其认证；用可隔离目标 resource-fold 检查的真实夹具修复测试。
- 没有修改上述 src。若要优化真实联机运行时的历史记录，应另开 src 任务，继续保留完整事件、事实边界和恢复认证；本任务没有通过删事实或缩短真实路线达标。

## 上轮验收（历史记录；本轮结果见续验）

**结果：五文件 72/72 通过，原超时均未放宽；但 seed 230 未达到用户要求的 30% 余量，不能将 F5 整包标为完成。**

下表“文件时长”取各单跑命令的 Vitest `Duration`，包含该文件导入/钩子/测试等整体启动工作；性能预算针对用例或单个钩子，不能用整文件时长替代。除 Loot 最后夹具修正后单独重跑外，其他四文件来自同一次串行验收；Loot 末次也无并行测试或采样器。完整原始结果见本地 `artifacts/f5/final/verified-summary.json`。

| 文件 | 通过 | 文件时长 | 原长用例/钩子实际耗时 | 原预算 → 70% 目标 | 余量结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| `tests/m4-ledger-bound.test.ts` | 2/2 | 22.10 s | 容量用例 16.437 s | 120 → 84 s | 达标，余量 86.3% |
| `tests/m8-b8-oracle.test.ts` | 25/25 | 174.29 s | seed42 **32.865 s**；seed230 **107.589 s** | 每项 120 → 84 s | 42 达标；**230 未达标，余量仅 10.3%** |
| `tests/restore-audit/cd-replay-facts.test.ts` | 34/34 | 49.28 s | 吸收 11.389 s；Cuts 12.288 s；Eagle Eye 11.776 s | 每项 60 → 42 s | 全部达标，最差余量 79.5% |
| `tests/m7-fx-plan.test.ts` | 3/3 | 38.02 s | beforeAll 32.541 s | 120 → 84 s | 达标，余量 72.9% |
| `tests/m8-b8-loot-view.test.ts` | 8/8 | 41.94 s | 默认前缀钩子 6.155 s；英雄钩子 5.507 s | 每个 10 → 7 s | 全部达标，最差余量 38.4% |

Loot 两个回调各自记录耗时；Vitest reporter 的模块 `beforeAll` 事件只给二者合计，不能把合计 11.52 s 错当某个 10 s 回调超时。其余单例中，Loot 最慢测试体为 5.179 s（原 20 s 配置，70% 目标 14 s），oracle 的 30 s beforeAll 为 7.753 s；均保留原预算。

容量实际执行完 89 ticks / 985 条完整事件；9 个三星单位、27 成装、3 强化、1 异常及全部原资源/事件/隔离断言均通过。新哈希逐值对照、普通/特殊类型深比较差分、浅冻结/访问器/大日志替换篡改、检查点分支隔离，加原 H3 在线 oracle：4 文件 **55/55** 通过。最终 `npm run typecheck`（`tsc --noEmit`）退出 0，`git diff --check` 通过。

### 上轮剩余未完成项

- **`tests/m8-b8-oracle.test.ts:187` 的 seed 230**：原 120 s 用例现为 107.589 s，仍比 84 s 目标多 23.589 s。保留原种子、默认炮手策略、完整真实路线、全部终局/收据断言，没有拆段少计时间、改强化优先级绕开历史、提高超时或删除断言。该优化思路持续未达余量目标后停止继续叠加，按要求留下卡点。
- 同样公开命令路线的证据：seed42 为 **8,694 ticks / 4,177 facts / 221 commands / 约1.21 MB 状态文本**，seed230 为 **10,661 ticks / 9,863 facts / 288 commands / 约2.27 MB**。42 的历史强化是后期 Scavenger；230 早期即选中 Loot Explosion，历史覆盖更长；成型回合也从 ordinal25 延后到29。tick 数增加约22.6%，事实数增加约136%，不能只把慢归因于多打几轮或回放入口。
- 最后一轮失败采样（后续又优化了比较热循环，最终只做无采样验收）中，整 oracle 文件的 H3 仍占约86.37 s、生产 live history 46.17 s、其余独立 oracle 34.16 s、哈希14.34 s。**这些不是最终107.589 s的分项统计，不能相加归因给最后一个用例。** 剩余瓶颈同时包含 H3 完整前缀/观察扫描和 src 历史追加/过滤，不能把未完成全推给 src。
- 本轮没有修改 `src/simulation/augment-history.ts`、恢复校验或任何其他 src 文件；没有发现需要改变玩法/数值才能继续的证据。后续应继续针对 seed230 单独采样并改进测试前缀比较；若要处理生产历史的累计平方成本，须在另一个允许改 src 的任务中进行。

## 文件位置与复现

- `tests/fixtures/m5/h3-growth-oracle.cjs:26`：独立增量副本；`:108` 完整 before 检查点；`:32` 全前缀断言；`:166` 新副本及不可变观察。
- `tests/fixtures/m5/observed-equal.cjs:7`：只认证纯数据不可变节点；`:38` 精确字段比较与已验证源节点复用；所有失败/特殊类型回到 Node 原断言。
- `scripts/m5-route-hash.cjs:8`、`scripts/generate-m5-route.cjs:6`：每次真实路线内的原摘要复用。
- `tests/m4-ledger-bound.test.ts:18`：合法容量前缀；`tests/restore-audit/cd-replay-facts.test.ts:99` / `:232`：自然种子及公开异常选择。
- `tests/m8-b8-loot-view.test.ts:27`：正常狙神英雄控制；`:47` 两个钩子分别计时；`:94` 起保留的四组终局断言。

```sh
export PATH=$HOME/.local/bin:$PATH
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m4-ledger-bound.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b8-oracle.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/restore-audit/cd-replay-facts.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m7-fx-plan.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b8-loot-view.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m5-route-hash.test.ts tests/h3-observed-equal.test.ts tests/h3-oracle-checkpoint.test.ts tests/augment-pool-batch5-h3-oracle.test.ts
npm run typecheck
```

**src 改动：无。需要用户决定：无。** （上轮结语）当时未完成的余量目标已明列，未用“测试全绿”代替验收；本轮续验结果见文首。执行端可提交工作区内测试/脚本/报告；生成物不提交。
