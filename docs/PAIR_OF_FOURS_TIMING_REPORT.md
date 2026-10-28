# Pair of Fours 用例耗时剖析

2026-10-28，实际工作区为 `claude/sol-t11 @ 60366ec5`，Node 22.23.4、Vitest 5.0.3。工作区起始干净；未执行 Git 写操作。以下结果针对该提交，尚未在更新的 integration-2 提交验证。

seed 63 的主要耗时是单跑时重新构造到 4-2 的完整战斗路线。全文件运行时，前面的九个分段用例已经填充 `fieldedRoutes` 缓存，目标用例原本只需 158 ms；按名称筛选目标用例会跳过这些分段，冷启动剖析为 3751 ms，其中 3513 ms 用于路线构造。

## 分段计时和 CPU 证据

临时测试副本保留原断言，通过 `performance.now()` 包围路线、每次序列化、恢复和后续战斗，并通过 `node:inspector` 的 `Profiler.start/stop` 采集测试执行阶段的 CPU profile。导入和转换时间不计入下表；正式五次单跑和三次负载验证没有计时代码或 CPU 采样。临时测试副本已经清理。

| 阶段 | 原 seed 63 冷启动 ms | 原路线已缓存 ms |
| --- | ---: | ---: |
| 构造或读取 4-2 选择前状态 | 3513 | 1 |
| 选择后的 serializeMatch | 18 | 21 |
| 选择后的 restoreMatch | 16 | 10 |
| startMatchCombat | 8 | 11 |
| 开战后的 serializeMatch | 59 | 79 |
| 开战后的 restoreMatch | 23 | 22 |
| 推进三个战斗 tick | 5 | 5 |
| 三 tick 后的 serializeMatch | 34 | 34 |
| 三 tick 后的 restoreMatch | 23 | 14 |
| 其余命令、断言和采样开销 | 52 | 45 |
| 整个目标用例 | 3751 | 242 |

原 seed 63 三份存档的字符串长度分别为 82136、167881、168776 个 UTF-16 code unit。三次序列化合计 111 ms，三次恢复合计 62 ms；此前选择的是 `mentorship-ii` 和 `team-building`，没有 `augmentHistory`，因此本例不存在强化历史回放耗时。

冷启动 CPU profile 中，`stepMatch` 的包含子调用采样约 3033 ms，`advanceS13Tick` 约 2297 ms；后者自身约 486 ms，`copyCombatUnitForTick` 自身约 188 ms。包含子调用时间不能相加。对应源码入口为：

- `tests/augment-stage-helpers.ts:141`：`fieldedRoute` 对每个实际战斗持续调用 `stepMatch`。
- `src/simulation/combat-s13.ts:185`：`advanceS13Tick`。
- `src/simulation/combat-static.ts:97`：`copyCombatUnitForTick`。

这些证据指向测试预先打完无关战斗的成本，没有证明 seed 63 存在序列化或恢复的超线性问题。

## seed 25 首次序列化慢的原因

在临时副本中仅将路线种子改回 25，并仍按原有分段用例构造完整路线，可以复现首次 `serializeMatch` 为 5739 ms。该剖析用例触发原有 5000 ms 超时，未修改超时；后续日志和 CPU profile 仍被采集。

此时前置强化为 `built-different`、`titanic-titan`，强化历史证明的 origin 为 1-2，命令中压缩记录了 **7206 次 stepMatch**。首次存档字符串长度为 684438 个 code unit；`validateAugmentHistory` 的包含子调用采样约 5656 ms，首次紧接的 `restoreMatch` 为 116 ms，符合首次校验建立回放前缀缓存、后续恢复复用缓存的行为。

`src/simulation/serialization.ts:22` 的序列化入口会先做结构校验；`src/simulation/augment-history-restore.ts:204` 的强化历史校验在 `:225` 查找缓存前缀，并在 `:229` 至 `:242` 重放缺少的公共命令。因此小体积的压缩 step 记录也可以代表大量战斗计算。这里证明了冷历史回放成本，没有证明数据结构复杂度超线性。src 保持原样，若执行端继续处理此类热点，应单独评估经过认证的近端检查点或回放前缀复用，保留原有严格校验。

## 测试改法和覆盖范围

仅修改 `tests/s13-augments-p2-choice.test.ts`：

- `:36` 至 `:58`：增加文件内的选择前状态缓存。全文件运行复用原完整路线的 4-2 状态；独立筛选时从公共 `fieldedRoute(seed, '2-1')` 开始，PvE 正常上场获取奖励，前面的 PvP 通过公共空棋盘命令结算，4-1 再上场保留真实 4-2 出牌条件。仍使用 seed 63，没有脚本化三选一或注入状态。
- `:60` 至 `:63`：保留原九个分段路线用例和全部断言，在 4-2 缓存其状态。
- `:68`：目标用例使用上述缓存或较短路线；其余强化保持原路径。

独立筛选时，2-1、2-2、2-3、2-5、2-6、3-1、3-2、3-3、3-5、3-6 共十场前置 PvP 不再逐 tick 战斗；2-7、3-7 和 4-1 分别实际推进 380、641、439 tick。较短路线到达 4-2 时剩 9 HP，自然提供 `pair-of-fours`。一次附加剖析中，路线耗时 1924 ms，含完整后续断言共 2236 ms；此轮剖析与全文件回归尾部有重叠，仅用于核实执行路径，性能验收采用下面独立运行的无采样数据。

保留选择前节点、选择类型、实际出牌断言；保留赠礼数量、收据、RNG、不重复发放、重复选择失败、三次严格存档恢复、恢复后的同 seed 下一步一致性和伪造收据拒绝。未删断言，未变更任何 timeout、门槛或预算。全文件与名称筛选分别覆盖缓存路线和较短路线。

## 验证结果和复现命令

所有 Vitest 命令均使用 `--configLoader runner --maxWorkers=3`，默认单例超时仍为 5000 ms。每次冷启动验证均为新的 Vitest 进程，未使用 `--repeats` 复用本文件缓存。

| 验证 | 各次目标用例耗时 ms | 结果 |
| --- | --- | --- |
| 独立筛选五次 | 2063.981、2120.077、2129.637、2044.833、2012.815 | 每次 1 项通过 |
| 三 worker 双边战斗负载三次 | 2170.025、2197.591、2092.174 | 每次 40 项通过 |
| 全文件回归 | 172.284 | 32 项通过 |
| npm run typecheck | tsc --noEmit | 通过 |

负载由 `s13-augments-p2-multiplayer` 的 18 个测试和 `T2 true two-sided combat` 的 21 个测试提供，与目标用例共三个文件并行。JSON 的各文件开始与结束时间确认了三个文件的测试执行区间实际重叠。最慢目标用例为 2197.591 ms，距 3000 ms 目标余量约 802 ms，距默认 5000 ms 超时余量约 2802 ms。

```bash
export PATH=$HOME/.local/bin:$PATH
# 每次重新执行此命令，共五次。
npx vitest run --project fast --configLoader runner --maxWorkers=3 \
  tests/s13-augments-p2-choice.test.ts \
  -t 'pair-of-fours public acquisition' --reporter verbose

# 每次重新执行此命令，共三次。
npx vitest run --project fast --configLoader runner --maxWorkers=3 \
  tests/s13-augments-p2-choice.test.ts \
  tests/s13-augments-p2-multiplayer.test.ts \
  tests/t2-two-sided-battle.test.ts \
  -t 'pair-of-fours public acquisition|T2 true two-sided combat|crosses a|resolves shared gifts' \
  --reporter verbose

npx vitest run --project fast --configLoader runner --maxWorkers=3 \
  tests/s13-augments-p2-choice.test.ts
npm run typecheck
```

本机原始证据保存在 `/tmp/pair-before.cpuprofile`、`/tmp/pair-warm.cpuprofile`、`/tmp/pair-seed25.cpuprofile`，以及 `/tmp/pair-verification.json`、`/tmp/pair-load-battle-verification.json`、`/tmp/pair-full-final.json` 和相应日志中；这些临时产物未纳入仓库。最终仅保留本报告和测试文件改动，未改任何 src 文件或录制夹具。

牌池或前置奖励变化后，需重新验证较短路线的生存和实际出牌条件；当前补丁没有修改公共 `fieldedRoute` 或其他测试共享路线。没有需要用户决定的玩法问题。
