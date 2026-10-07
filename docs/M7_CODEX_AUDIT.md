# M7 Codex 审计与 CI 跟进

审计日期：2026-10-07（北京时间）。分支 `claude/friendly-darwin-pak00a`，交接提交 `111e9f8305ab4a7da8e67bd7f96a2318cabe5df0`。
先阅读了 [M7_HANDOFF](M7_HANDOFF.md) 和 [M7_PLAN](../M7_PLAN.md)。本次只修改测试驱动、诊断 workflow 和文档；没有修改游戏实现、视觉、交互或冻结预算，没有合并分支。

> 最新跟进（2026-10-07）：已在包含 Claude `b252c34` 的 `77600c82bb709837ca1142abc16238765074f116` 上重新完成一次完整 CI，11 个验收作业全部通过，见下节。第三轮预热失败属于 M6 main，现按用户决定独立登记为 [M6-MEM-01](M6_LIFECYCLE_KNOWN_ISSUE.md)，不以该已知问题阻塞 M7 合并。

## 1. 完整 CI

### 最新 Claude UI 提交后的完整复核

[完整运行 37540777240](https://github.com/catfish-xn/cat/actions/runs/37540777240)：`workflow_dispatch`，2026-10-07 北京时间 06:28 启动，约 06:48 结束；**success**。开跑前拉取最新分支，HEAD 为 `77600c8`，已确认包含 `b252c34`。未开启 profile、heap_diagnostics 或 warmup_experiment。

| 作业（均为 sample1） | 结果 |
| --- | --- |
| test-and-build：50 文件 / 722 单元测试、build、headless、performance | 通过 |
| m7-presentation | 通过 |
| browser-dev-cannon / mage / sniper | 三项均通过 |
| browser-preview-cannon / mage / sniper | 三项均通过 |
| input-dev / input-preview | 两项均通过 |
| compare-evidence | 正常执行并通过；M5 三条路线、M6 九份 manifest 比较均通过 |

共 **11 个验收作业通过**。两个诊断入口 `heap-diagnostics` / `warmup-experiment` 因未启用而按预期跳过，不是验收缺失。所有作业状态、SHA、正式生命周期样本见 [M7_LATEST_FULL_CI.json](evidence/M7_LATEST_FULL_CI.json)。本次没有修改 workflow 的依赖或跳过策略。

正式生命周期仍为 **2 次预热 / 30 次测量 / 1MiB**：dev +56,668B，preview +1,032,868B；分别保持 listeners=83 / 82、RAF=1。preview 仅剩 15,708B 余量，单次全绿不能证明门禁稳定，风险与后续调查见 [M6-MEM-01](M6_LIFECYCLE_KNOWN_ISSUE.md)。

独立调查分支 `codex/m6-lifecycle-retention` 已推送提交 `a35b027`，新增输入、原生控件与 matchMedia 诊断及证据，未修改应用。M7 本轮随后仅追加文档/证据；上述 CI 的确切受测 SHA 是 `77600c8`，不把之后的报告提交称为另一次完整验收。没有合并分支。

### 原始交接提交

[完整运行 37489054653](https://github.com/catfish-xn/cat/actions/runs/37489054653)，手动 `workflow_dispatch`，未启用 profile 或堆诊断。

| 作业（均为 sample1） | 结果 |
| --- | --- |
| test-and-build | 通过 |
| m7-presentation | 通过 |
| browser-dev-cannon | 通过 |
| browser-dev-mage | 失败：最终开始按钮被 400ms 生命周期保护忽略 |
| browser-dev-sniper | 通过 |
| browser-preview-cannon / mage / sniper | 三项均通过 |
| input-dev / input-preview | 两项均通过 |
| compare-evidence | 上游失败，被跳过 |

这次实际结果与交接时不同：**dev/cannon 内存通过，阻塞比较的是 dev/mage**。不能把历史内存失败当成本次失败原因。

dev/mage 原始 artifact `11425207197` 的 trace：末轮 Continue 的 `before.startTime=684430.829`，Start 为 `684787.533`，仅相隔 **356.704ms**。当前 UI 的 `LIFECYCLE_QUIET_MS=400` 会忽略后者，最后停在 preparation（gold=229），而 golden 期待 finished/victory（gold=239）。之前两次间隔约 470ms 和 463ms，没有触发问题。

修复 `scripts/verify-m5-browser.cjs`：完整路线的有意 Start 前等待 450ms，并立即断言已离开 preparation。此等待只作用于 Start，D/F/E 高频输入与 M7 F01 双击/双触测试保持原样，不重试吞掉错误，不改变 golden。内存循环、GC、预热次数、资源断言及 1MiB 上限保持原样。

### 修复后的完整 CI

代码与测试提交：`a5495521e22d7aa76185767fe23cac64db8984b3`。
[完整运行 37491636101](https://github.com/catfish-xn/cat/actions/runs/37491636101)：**success，11 个验收作业全部通过**。

| 作业（均为 sample1） | 结果 |
| --- | --- |
| test-and-build（50 文件 / 722 单元测试、build、headless、performance） | 通过 |
| m7-presentation | 通过 |
| browser-dev-cannon / mage / sniper | 三项均通过 |
| browser-preview-cannon / mage / sniper | 三项均通过 |
| input-dev / input-preview | 两项均通过 |
| compare-evidence（M5 与 M6 两个比较脚本） | **正常执行并通过，不再被跳过** |

此后追加本审计报告和交接索引属于文档提交；正式 CI 验证的代码/测试 SHA 始终以上述 `a549552` 为准，不把文档提交谎称为另一次完整运行。

比较作业仍遵守原有 `needs` 成功依赖，没有通过 `always()`、伪造证据或忽略失败强行运行。新增的 `heap-diagnostics` 只在显式传入 `heap_diagnostics=true` 时运行；常规完整 CI 中它被跳过属于预期，不属于验收作业缺失。

## 2. 内存调查：目前更支持预热与测量波动

### 未加快照的正式测量

| 来源 | SHA / 模式 | GC 后增量 | 1MiB 门禁 |
| --- | --- | ---: | --- |
| 历史运行 37483034783，artifact 11421983451 | 69e1387 / dev-cannon | 1,088,060 B | 失败，超出 39,484 B（约 3.77%） |
| 本次运行 37489054653，artifact 11425816715 | 111e9f8 / dev-cannon | −566,108 B | 通过 |
| 修复后运行 37491636101，artifact 11427185634 | a549552 / dev-cannon | 64,016 B | 通过 |

前两个版本之间只有交接文档差异。正式样本的监听器均为 83→83、pending RAF 为 1→1。交接所说的约 2.5MB 是本地样本，不是上述历史 CI 的实际值。本次没有通过放宽预算取得通过。

### 同配置 CI 快照对照（只用于诊断）

[诊断运行 37490676891](https://github.com/catfish-xn/cat/actions/runs/37490676891)，Ubuntu 24.04 / Node 22 / 锁定依赖 Chromium。M6 固定为签收提交 `631c131f1f2fd387c873f0fd8b5a238bca79dbe0`，M7 固定为原交接 `111e9f8`。

四组执行原版本的 `verify-m5-browser.cjs --build=cannon --m6-f2`（preview 增加 `--preview`），设置 `M6_HEAP_DIAGNOSTICS=1`，仍为 2 次预热、30 次测量循环，仍执行原 1MiB 断言。

| 样本 | artifact ID | heapDelta | listeners | RAF |
| --- | --- | ---: | --- | --- |
| M6 dev | 11425033442 | −161,024 B | 81→81 | 1→1 |
| M6 preview | 11425871990 | 32,392 B | 80→80 | 1→1 |
| M7 dev | 11424948579 | 132,616 B | 83→83 | 1→1 |
| M7 preview | 11425058322 | 141,568 B | 82→82 | 1→1 |

四个诊断作业均通过。**快照采集会改变 GC/编译时序，以上结果不能代替正式验收。** `compare-m6-evidence.cjs` 原有的 `heapDiagnostics=false` 校验保留；诊断运行中的正常验收作业有意不执行。

M7 dev 快照中 MatchApplication、MatchSession、BattleHistory、SaveCoordinator、BoardScene 均保持 1 个；PlaybackSession、ReplayView 均保持 0；UnitView 7→7，HTMLCanvasElement 3→3，HTMLImageElement 6→6。旧 MatchSession、BattleHistory、SaveCoordinator 的对象 ID 不再存在于后快照，说明原实例已释放，并非只看计数器。

M7 dev 最大的正向 self-size 变化为 V8 InstructionStream +563,520 B、TrustedByteArray +167,744 B、ProtectedFixedArray +72,972 B；还有 native DOMRectReadOnly +40,096 B、PerformanceLongAnimationFrameTiming +22,880 B。M6 dev 同样有 InstructionStream +472,896 B、TrustedByteArray +146,408 B。新增执行路径可能增加编译成本，但不足以把所有波动都归因于 M7 代码量。

注意：heap snapshot 的节点 self-size（尤其 code/native）与 `Runtime.getHeapUsage().usedSize` 不是可直接相减的同一口径。因此未采用“从 usedSize 中减去 code 节点大小”作为新门禁，也不把正向条目之和说成总堆净增量。

### 本地延长到 60 次的诊断

使用公开导入接口载入 M6 三场结算存档，然后沿用原来的生命周期操作、资源探针和 2 次预热。每 10 次强制 GC 采样，并在基线、30、60 次取快照。它省去了正式路线前段，增加了中间 GC 和快照，**明确不是正式测量，也不是修改验收标准**。

M7 dev 的 `usedSize`（B）：

| 测量循环数 | 0 | 10 | 20 | 30 | 40 | 50 | 60 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| M7 dev | 12,922,912 | 14,577,492 | 14,470,208 | 14,676,860 | 14,434,128 | 14,395,508 | 14,005,168 |
| 签收 M6 dev | 12,311,540 | 13,908,564 | 13,360,836 | 13,840,436 | 13,802,344 | 13,451,620 | 13,435,624 |

前 30 次 +1,753,948 B，后 30 次 −671,692 B；上述应用对象计数在 30 和 60 次均未累积，listeners=83、RAF=1、application/session/observer=1。支持“前期预热/运行时缓存与测量波动”的解释；有限样本不能证明不存在任何泄漏，native timing/DOMRect 的变化仍值得后续观察。

签收 M6 的前 30 次也增长 1,528,896 B，后 30 次下降 404,812 B，listeners=81、RAF=1、application/session/observer=1。两者都出现早期增长和后期回落，进一步削弱了“仅 M7 引入持续生命周期泄漏”的解释。

### 待用户决定的方案（尚未实施）

> 后续状态：用户已于 2026-10-07 批准预热对照实验。具体方法、固定 main/M7 提交及连续三轮 CI 结果见 [M7_WARMUP_VALIDATION](M7_WARMUP_VALIDATION.md)。本节下文保留提出方案时的历史记录。

建议先验证测量方法，**不直接提高 1MiB**：在独立诊断中比较 2 次与 12 次固定预热，保留 30 次测量、强制 GC 及原 1MiB 和资源上限；M6/M7 × dev/preview 各取 3 个独立进程样本。正式候选样本不采快照、不在 30 次中插入额外 GC；快照仅作另一组诊断。保存所有结果，不挑最好的一次。

12 次是根据本地早期增长提出的待验证候选，并非已证明最佳值。若候选仍波动或出现持续对象保留，继续排查，不自动扩大上限。用户尚未确认前，不修改正式方法和冻结预算。

## 3. F02 / F04 / F07 负对照

修复前代码：`d46ed54`；修复后 UI：`111e9f8`（本次提交没有更改 UI）。两者分别完成生产 build，以独立本地 preview 服务运行，同一 Chromium。

从当前 `verify-m7-presentation.cjs` 提取同一辅助函数及对应 case，分别独立执行，避免 F01 在旧代码上先失败导致 F02/F04/F07 根本没跑到；没有替换旧实现或伪造页面状态。F04 使用本次增强后的断言。

| 项目 | 旧代码实际失败 | 当前代码实际通过 |
| --- | --- | --- |
| F02 帮助与奖励焦点 | 到第 7 轮奖励时，`help=false, choice=true, debug=choice:belt`，违反帮助保有焦点断言 | 帮助保有焦点、奖励 inert、关闭后正常选奖励 |
| F04 回放反馈 | 回放到达记录终点后，`replay shows numeric damage floats` 断言失败 | 76 次攻击、11 次施法与事件账本完全匹配，209 个特效 spec；增强断言重测中最多 13 个可见飘字 |
| F07 头像加载失败 | 人为让 Darius 图片返回 404 后，残留 3 张坏图，`3 !== 0` | 坏图 0，3 张 Darius 商店卡全部显示回退徽记 |

增强之前，旧代码 F04 会先因 `fx` 不存在抛 TypeError。现已使用可选访问并先验证播放完毕及实际飘字，再验证精确事件数，负对照因此证明了行为缺失。F07 额外断言种子商店确实含 Darius，避免 `0 === 0` 的空通过。

负对照报告、截图与独立驱动保存在本次交付目录 `outputs/m7-codex-audit/negative-controls/`（旧失败是预期结果，不是当前代码失败）。故障注入的 F07 404 是测试前提，不是正常资源回归。

## 4. application.ts 两行审计

对照签收 M6 的差异仅为：

1. `renderReplay` 将 `snapshot.events` 作为第三个参数交给 `ReplayView.render`。`PlaybackSession.read()` 返回 `deepFreeze` 的 combat/events 快照；视图按 consumed 索引取新增事件，`planFx` 只读映射为视图特效，不写回 Match、存档、RNG 或事件账本。特效列表最多 120 项，关闭回放会 dispose 并清空持有引用。
2. `debug()` 增加 `fx: { ...this.replayView?.stats }`。这些是数字计数，浅拷贝足够隔离外部修改；仅用于观测，不进入规则/持久化数据。

未发现这两行引入规则、确定性或存档兼容问题。对照 M6，`src/simulation/`、`src/persistence/`、`src/replay/`、`src/stats/` 无实现差异。F04 当前测试还验证返回后 active Match 不变。

## 5. 范围与限制

- 交接文档所列视觉/交互问题继续留给 Claude；本次不作 UI 签收。
- 历史失败和诊断样本保留，不以单次全绿宣称门禁已稳定。
- 没有合并 M6/M7，也没有修改 main、Pages 或分支策略。
- 本地 build、脚本语法检查、actionlint 和 `git diff --check` 通过。修复后 CI 的 test-and-build 日志确认 50 个测试文件、722 个单元测试通过；最终正式验收以第 1 节所列完整 CI 提交与结果为准。
