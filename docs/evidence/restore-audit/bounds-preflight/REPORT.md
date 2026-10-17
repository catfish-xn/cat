# D 批第一项：BOUNDS-PREFLIGHT

## 边界与结论

分支 `codex/restore-fix-bounds-preflight`，从开工时最新 `origin/multiplayer` 的 `8db36d009caba60809031313e21db770fbcc6898` 新建。依据为 `546d086` 的 `docs/evidence/restore-audit/SAVE-CONSISTENCY-AUDIT.md` 中 BOUNDS-PREFLIGHT 及其共同修复建议。该项在原审计中是静态顺序风险；原 `tests/restore-audit/bounds-g22-state.test.ts` 的五项针对曝光、破盾、伤害累计，属于另外两项发现，未挪用或修改。此次新增本项复现和拒绝回归。

修复增加 `src/simulation/restore-bounds-preflight.ts`，在 `serialization.ts` 导入并调用一次；CI 修订另从 `m8/sampled-stat-facts.ts` 提取并复用原有计数校验。没有改变规则、数值、存档字段、版本、digest，未修改 `src/server/`、`src/rendering/`。G23-ALLOCATION 的奖励描述符展开仍留给 A 批，本单未触及。

预检在 B8 开战输入、strategy、board、roster 认证后，位于 sampled-stat 事实重演、neutral/resists 验证、逐单位恢复及其跨单位读取之前。第一遍认证**全部单位**的身份、ability、mechanics、itemPrograms、sources/triggers、冻结起始格；全部通过后才编译各单位的 mechanismDefinitions 并检查计数。不会用候选 `nextActionSeq`、castCount、alive、triggerCount 或候选声明的 cap/period 作为上界的权威来源。

内部函数签名：`validateRestoreBoundsPreflight(combat: CombatState, preparation: GameState, strategy: StrategySnapshot, same: (a: unknown, b: unknown) => boolean): void`。调用者必须已验证 preparation/strategy/roster。身份、声明、周期绑定等认证失败保留原校验的 `Invalid Match save: <reason>`，只有计数超界使用 `bounds preflight <field>`；已有 sampled AP/AD kill 计数校验复用 `validateSampledStatTriggerCount`，仍报 `sampled stat trigger count` / `sampled stat trigger count bound`。`restoreMatch(object)`、`restoreMatch(JSON)`、`serializeMatch` 经过同一入口。具体 field 见下表和测试；本函数不提交状态、不抽 RNG、不截断计数。

## 每个计数字段及可信上界

令 T 为已检查 `0 ≤ combat.tick ≤ MAX_COMBAT_TICKS` 的时钟，N 为已验证开战输入经 `projectG23Summons` 得到的棋盘 roster 数量，F 为这个 roster 中 Forge 的数量。T 仍是待验证的存档进度；其**工作量上限**来自规则常量 1200，不把它当作真实发生事实的证明。

| 字段/派生枚举量 | 上界或认证方法 | 来源与分配前保证 |
|---|---|---|
| `combat.tick`，按 tick 枚举的历史攻速候选 | 1200；候选最多 T+1 | `combat-types.ts` 的 `MAX_COMBAT_TICKS`，原入口还要求 maxTicks=1200；不能用存档 maxTicks 放大 |
| `mechanismState.sampledAtTick` | 必须等于 T | 同一有界战斗时钟；在跨单位 status/采样读取前检查 |
| `runtime.attackCount` | ≤T | executor 每单位每 tick 最多一个基础攻击/施法动作；不取存档 nextActionSeq |
| `runtime.castCount`，以及两者之和 | 各≤T，attackCount+castCount≤T | 同上；只是上界，不声称认证动作事实 |
| `mechanics[enforcer].values.wanted` | 必须等于可信 strategy 编译值 | 已验证开战输入经 `buildStrategySnapshot` 编译的羁绊声明；在 `declaredEffects` 的 wanted 循环前认证全部持有者 |
| `mechanics[*].values.periodTicks`（archangel 等），`itemPrograms[*].program.periodic[*]` 的 period/start/end | 必须等于可信 strategy 中对应完整声明 | 规则/装备编译结果；不能读取另一未认证单位自报的微小 period 或负 start 来扩张候选 |
| `mechanismDefinitions.periodicTasks[*]` 的 period/first/end、静态 pulseOrdinal/pulseLimit | 必须全等于用已认证输入编译的定义（初始 ordinal=0） | `compileMechanismDefinitions`；包括声明内的程序与 cap。先检查完整定义，再允许候选计算 |
| max-HP/AP 的派生 `pulses` 候选 | `max(0, floor((T-first)/period)+1)`；有 end 时实际更小 | first/period/end 来自上述编译定义，应用时刻先被现有 shield/timing 验证限制于 T；不依赖存档 pulseOrdinal |
| `mechanismState.periodicTasks[*].periodTicks/pulseOrdinal`（普通任务） | period 等于对应编译值；ordinal ≤ `max(0,floor((T-first)/period)+1)` | 可信编译周期；现有后续验证仍检查精确相位、完整程序及身份 |
| 同上（附着 burn 任务） | period=20；ordinal≤floor(T/20)+1 | `m8/s13-mechanisms.ts` 的 burn 调度规则；身份、程序、生命周期由后续原验证继续检查 |
| `triggerLedger.runtimes[*].triggerCount`，有 `maxPerCombat` | ≤编译声明 maxPerCombat | 全部持有者静态输入先认证；不信存档 mechanismDefinitions 的 cap |
| 同上，kill-or-assist | T=0 时为0，否则≤N+T×F | `applyCombatStart` 的 tick-zero 边界不结算伤害；每个原始单位一条生命；`reviveG23Forge` 仅在 Jayce 施法时复活，每 Forge 每 tick 至多一次；包含双方，故为保守上界 |
| 同上，attack-completed / cast-completed | ≤T×N×编译 maxPerAction | 每 actor 每 tick 最多一个对应动作；涵盖非 self 监听，未取候选 attackCount/castCount 作上界 |
| 其余 sampled AP/AD stacking 的 `triggerCount` 候选 | 必须等于从可信开战输入重演得到的完整 ledger | 入口原有 `validateSampledStatTriggerFacts` 继续在候选枚举前执行；预检先阻止伪造声明改变重演/枚举的语义。未宣称仅上界就能证明发生事实 |
| `itemPrograms` / `mechanismDefinitions` 中 counter cap、stackPolicy.cap、maxPerAction、maxPerCombat | 完整声明必须全等于可信编译值 | 有限规则/装备目录；候选枚举用编译 cap，不用存档自行声明的 cap |
| `triggerLedger.runtimes[*].counters[id]`（有 cap） | ≤对应编译 counter.cap，并验证 counter 来源存在 | 同上；无 cap 的纯标量不用于该入口的 cap-sized 枚举，原运行态验证仍保留 |

没有为已有 provenance、receipt、status、任务数组本身新增任意长度预算；它们按输入实际条目遍历，不按一个自报计数生成条目。`tasks.total/ordinal` 等标量没有在本基线恢复路径驱动 count-sized 分配，继续由已有语义验证负责。本单也不解决 G-C02 等事实权威缺口，不把有限上界等同于真实历史。

## 动手前的在途分支重叠比较

逐分支使用 `git diff --name-only origin/multiplayer...origin/<branch>` 比较，以下固定为开工获取的分支 HEAD。只列**本单实际会修改的文件**的交集；新 helper/test/report/script 均没有同名交集。

| 在途分支 | 获取的 HEAD | 本单重叠文件 |
|---|---|---|
| #161 `codex/g2-4b-artifact-forge` | `110ce6e` | 无 |
| #164 `codex/bracer-multikill-stacks` | `c0fe4c1` | 无 |
| #166 `codex/fix-task-mechanism-restore` | `4e6fb6a` | `src/simulation/serialization.ts` |
| #157 `codex/g2-4a-crown-win-gold` | `6fa69c0` | `src/simulation/serialization.ts` |
| B 批 `codex/restore-fix-batch-b` | `f0f060b` | `src/simulation/serialization.ts` |

合并注意（astro S2）：#157 后续提交 `db80d91` 已把恢复主体移到 `src/simulation/serialization-structure.ts`。与其合并时，预检的 import 和调用必须跟随恢复主体迁移，调用放在该提交的 roster 校验（:251）之后、neutral 校验（:259）之前，并继续位于 sampled-stat 重演及逐单位/跨单位候选展开之前。

`serialization.ts` 仅两行增量（import + 验证调用），没有改写这些分支也在施工的资源、账本、task 或候选重演实现。后续合并保持本调用在已验证输入之后、所有逐单位/跨单位候选读取之前即可；本轮没有执行这些分支的集成合并。

## 复现与测试证据

原基线 witness 以公开 `itemMatch('ionic-spark')` + `stepMatch` 建立合法正控，保留真实的跨单位 aura contribution，再给后面的 owner 加入安全小数 `wanted=64`。spy 观测 `stat()` 声明生成，对象和 JSON 都先生成64条，才报 `resolved mechanics`。见 [witness 源码](baseline-witness.test.ts.txt) 与 [原基线结果](logs/baseline-witness.json)。没有制造 OOM。

正式回归把这个顺序翻转为拒绝，CI 修订后明确要求原有 `resolved mechanics`，stat 声明生成次数仍为0，并测试反转单位顺序。其他负例分别要求装备声明、mechanism definitions、sampled tick、attackCount、castCount、periodTicks、pulseOrdinal、triggerCount、counter 的具体拒绝原因；新增“前一单位计数超界、后一单位身份错误”的混合负例，证明全部身份认证仍先于计数检查。每个负例覆盖 object、JSON 和 serialize，并断言尚未调用逐单位 `validateMechanisms`。

三入口合法正例覆盖的都是**单人存档**，来自公开命令：400 tick 的护臂长局、单人 6-7 的多奖励/92条资源账本存档、单人 6-7 战斗中待执行+周期任务最多的检查点（至少5项），以及普通开局。每例先验证 serialize、object restore、JSON restore 与规范化重存，再对两条恢复分支逐 tick 比较完整 step 结果（state、事件和 RNG 都包含在内）直到战斗结束。

覆盖边界（astro S1）：联机加时轮走在线 `restoreBattleInput`（`src/simulation/two-sided-battle.ts:91`）；离线 `restoreMatch` 照旧拒绝含 `multiplayer` 的状态（`serialization.ts:113`）及超过 `FINAL_ROUND` 的状态（`:122`）。因此本次没有加时恢复证据，在本项离线恢复边界内也不需要加时证据；上述单人 6-7 正例不代表加时覆盖。

初版相关回归：**7文件156/156通过**，见 [机器结果](logs/final-targeted.json)：

| 文件 | 项数 |
|---|---:|
| `tests/restore-audit/bounds-preflight.test.ts` | 15 |
| `tests/m5-serialization.test.ts` | 33 |
| `tests/m8-b8-restore.test.ts` | 7 |
| `tests/explorer-bracer-restore.test.ts` | 24 |
| `tests/m8-b3-restore.test.ts` | 13 |
| `tests/m8-b4-integration.test.ts` | 16 |
| `tests/g2-4b-artifacts.test.ts` | 48 |

初版 `npm run typecheck` 通过。初版只跑上述相关测试、下述 B7 单文件计时与 typecheck，没有跑全套、build 或 server 测试。Node 22.17.0，Vitest 5.0.3，Windows。

准备阶段的非产品问题：沙箱临时 fixture rename EPERM，改用正常本地权限执行；最初多奖励正例要求账本>100，但公开路径实际92，改为>80且保留同一公开路径；导出的基线临时放在 artifacts 内时被 Vitest 顺带发现，已移到仓库外，最终156项清单不含这些副本。不把这些初轮准备结果算入最终通过数。

## PR #167 CI 修订验证

在 `a463085` 上追加修订，未 rebase。四项旧拒因回归所在的 `explorer-bracer-restore-pressure`、`m8-b5-temporary`、`m8-b8-live-transfer` 文件及 B7 接线文件均未修改，包括断言和时限。第一遍认证全部单位、第二遍展开计数的顺序保留，并新增混合错误顺序回归。

两个慢正例共用一次公开命令取得的 6-7 局面，在 `beforeAll` 完整扫描同一场战斗，同时保留逐 tick 参照和真实最大任务检查点。对象、JSON 两条恢复分支仍分别执行每个后续 tick；完整 step 结果改用原生 `deepStrictEqual` 比较，仍涵盖全部 state、事件、RNG，没有减少轮次、检查点或字段覆盖。全部测试沿用原时限。

串行三个新进程，各以 `--project fast --maxWorkers=1` 跑完整预检文件，均 **16/16** 通过；下表为 Vitest 报告中的单项耗时，不包含模块导入和共享夹具准备：

| 轮次 | 多奖励正例 | 最大待执行任务正例 |
|---|---:|---:|
| 1 | 1.266s | 0.851s |
| 2 | 1.270s | 0.888s |
| 3 | 1.152s | 0.806s |

推送前远端并发增加 `f892e60`（范围说明、指纹与两个正例名称明确化）；以合并提交保留其说明和单人用例名称，指纹采用本轮最终实现的复算结果。重命名没有改变测试逻辑；合并后预检文件再次16/16通过，三轮计时仍对应上表的相同用例。

本轮指定范围为 **5 文件、97 项通过**（重复运行不累加）：预检16、护臂压力2、B5临时装备30、B8实时转移19、B7接线30。Windows / Node 22.17.0 / Vitest 5.0.3；Linux 专用护臂脚本依赖 `python3` 和 `resource.ru_maxrss`，Windows 两项因 `python3 ENOENT` 未能执行，随后将同一份源码复制到已配置 Ubuntu 临时目录，使用 Node 24.21.0 / Python 3.12.3 原样通过两项断言。正常本地权限运行规避了沙箱临时夹具 rename 的 EPERM。机器汇总见 [ci-followup.json](logs/ci-followup.json)。`npm run typecheck` 通过，未跑全套。

按仓库 LF 字节运行 `node scripts/verify-m8-herald-fixtures.cjs --write`、`node scripts/record-g2-3-inputs.cjs`，随后 `node scripts/record-g2-3-inputs.cjs --check` 和 Herald 默认完整复算校验均通过（Herald 脚本的校验模式不带参数）。源码清单相对旧清单仅预期的 `serialization.ts`、`restore-bounds-preflight.ts`、`m8/sampled-stat-facts.ts` 三项变化；原始夹具、轨迹、规则/内容/存档版本与 digest 均未变化，只更新源码指纹及对应 audit。新源码指纹为 `2b3a5792ba888b13dcca74e344a599ced6e0615767d8261fdc32bf0fe700da72`。

## 初版 B7 耗时对比

命令为 `vitest run --project fast --dir tests --maxWorkers=1 tests/m8-b7-match-wiring.test.ts`，通过 [计时脚本](../../../../scripts/measure-bounds-preflight.cjs) 交替串行运行三组；基线为仓库外的固定8db36d0源码导出，使用同一Node和同一node_modules。计时包括进程启动、transform/import/fixture准备和测试执行，没有其他测试任务并行。

| 组 | multiplayer 总耗时 | 修复后总耗时 |
|---|---:|---:|
| 1 | 24.776s | 25.614s |
| 2 | 24.186s | 24.669s |
| 3 | 24.281s | 24.528s |
| 中位数 | **24.281s** | **24.669s** |

中位数增加 **0.388s / 1.60%**；这是本机三组测量，不作跨机器性能保证。六次均30/30通过。见 [汇总](logs/b7-comparison.json)、逐次原始 JSON `logs/b7-{multiplayer,preflight}-{1,2,3}.json`。连同前述7文件，本次最终相关功能覆盖8文件186项（配对重复次数不累加为新测试）。
