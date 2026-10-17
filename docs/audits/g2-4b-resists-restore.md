# G2-4b resistsBps 恢复补强

基线：`d3112d681ecff96140c451a842c36f29537e1c07`。仅新分支；未改战斗规则、内容、服务端或表现层。

## 真实 restoreMatch 基线

公开命令：seed 5，正常空场推进到 2-1，部署 unit-1，经 grantMechanicItem 的唯一收据授予光盾，再 equipItem、startMatchCombat、stepMatch 到 tick 60。合法盾 granted=remaining=133。没有修改正控 state 的战斗字段。

每个数值攻击同时修改 layer.granted/remaining、m8State.granted/remaining 和 unit.shield，保持原有守恒关系。

| 攻击 | 原版 | 补强后 |
| --- | --- | --- |
| 133 → 134 | 接受 | Invalid Match save: resists shield replay |
| 133 → 132 | 接受 | 同上 |
| 133 → -1 | Invalid Match save: integer | 同上 |
| 133 → 133.5 | Invalid Match save: integer | 同上 |
| 移到另一单位，同步两侧 shield/expiry 及 m8State targetId/key | 接受 | 同上 |

原版负数/小数在 restoreMatchWithinCall 的 unit.shield 整数校验被挡，并非授予量公式核对。只移动层而不改 targetId 时，validateMechanisms 的 shield projection 会拒绝；完整重绑则绕过。实际漏洞是 declared shield sampled amount 的 resistsBps 分支仅检查非负安全整数，无法认证数值或目标选择。

完整可重复诊断：`scripts/probe-g2-4b-resists-restore.ts`。运行说明在文件头。全文原始/修复输出分别保存于相邻 `g2-4b-resists-original.txt`、`g2-4b-resists-fixed.txt`。原版对照将 git show HEAD:src/simulation/serialization.ts 临时用于独立 esbuild bundle，随后立即恢复工作区源码；该旧入口不引用新验证器。m8/restore.ts 的工作区差异仅注释，所以运行行为为基线。

## 安全设计

- 先完成 validateB8Resources / restoreCombatInput 的来源、资源前缀、battleSeed 验证，并由 buildStrategySnapshot 重编译 expectedStrategy。
- 仅可信 expectedStrategy 含 resistsBps grant-shield 的战斗进入新路径；不是由候选存档的盾或程序决定是否开启。
- 从可信输入和 seed 创建隔离战斗，只重演到已通过界限验证的保存 tick，且终态停止。没有用候选当前双抗、候选历史授予量或候选状态作为重演输入。
- 比较双方全部 resists 护盾层，包括目标、source、历史时间、grant 声明、granted、remaining、absorbed 等完整记录；缺失/新增/换目标同样拒绝。
- 不用开战双抗代替历史实时双抗。重演自然包含石像鬼目标变化、护盾刷新取 max(oldRemaining,newGrant)、状态过期、死亡触发及周期小数余量。
- 验证结果只用于比较，不安装重演状态、不返回重演事件、不推进原存档 RNG、不重发奖励。入口包装为统一 Invalid Match save 错误。

## 验证与成本

新增 tests/g2-4b-resists-restore.test.ts：公开合法盾的 object/JSON 恢复、下一步等价、原状态不变；八种攻击同时检查 object/JSON；石像鬼动态双抗、刷新、吸收、过期、结束清理；Maddie 携光盾在真实 tick620 死亡后的队友盾恢复。

动态公开正控开战双抗120+120，对应168；tick60实时140+140，实际盾196。tick180已有旧盾196与新盾182并存，证明当前/开战静态公式都不能取代历史重演。所有正控都通过公开命令生成。

诊断单次恢复：tick60原版约14.6ms、修复约34.7ms；单次测量含热身，不能视为性能阈值。相关测试并行运行下 tick60/120/180/240/600 约37/172/113/161/217ms。无 resists 装备战斗不新增重演。未改 timeout、skip、CI 或任何既有数值期望。全套 fast/timing 与审计指纹重录由主任务统一协调。

## 历史观察（合入 #158 之前）：探索者护臂 AP 恢复

以下为合入 #158 之前、基线 d3112d6 上的历史观察，不代表当前 HEAD：

同一个脚本保留完整失败向量：公开 purchasedThreeHeroMatch 等价路线，unit-1 装光盾、石像鬼、探索者护臂，到 tick600。原版与补强版都拒绝 `Invalid Match save: derived ability power`。此时 runtime.abilityPowerFlat=15，展示 AP=145，双抗155+155，光盾217。

具体拒绝链：restoreMatch → restoreMatchWithinCall → validateM5Runtime → derived ability power（基线 serialization.ts:369；补强后:371）。该检查仅从 archangel 机制推导允许的 runtime.abilityPowerFlat，未接纳探索者助攻成长。补强版的可信护盾重演比较已经通过，随后仍被该原有校验拒绝。当时此组合不能宣称合法恢复通过；该历史补强未扩大修改 AP 规则/恢复范围。

## 版本与源码审计

两版实际输出一致：CONTENT_DIGEST=`fnv1a32-utf16:b58e35ae`，LOOT_REPLAY_DIGEST=`fnv1a32-utf16:8db7fb0a`，rulesVersion=`s13-g2-3-v4`，contentVersion=`s13-14.24b-g2-3-v4`。schema/save/replay 版本亦未变。

源码指纹变化：src/simulation/serialization.ts、src/simulation/m8/restore.ts，以及新增 src/simulation/m8/resists-shield-restore.ts。所有包含完整 simulation 源列表的审计 manifest 需由主任务按既有生成器重录；本任务未自行更新 fixture 或数值 golden。

当前需重录清单：`tests/fixtures/g2-3-herald-raw/manifest.json` 中 `sources` 三个路径及汇总 `sourceSha256`，生成器 `node tests/fixtures/record-g2-3-herald.cjs --write`。该生成器同时重新导出五个 raw 与 trajectory，预期它们字节不变；必须核对。旧阶段的 herald manifest 是历史证据，不应因本次源码修改而覆写。

最终相关验证：3 files / 78 tests passed（光盾恢复17、G2-4b artifacts、M8-B3 restore），`npm run typecheck` passed，`git diff --check` passed。未 commit/push；未执行完整 fast/timing。


## 无声明路径与内部边界复核

额外公开 battle() 正控自然生成普通技能盾，攻击仅向 m8Grant.amount 注入 resistsBps=7000。在未补静态条件时，真实 restoreMatch 接受（回归测试实际失败），见 `g2-4b-resists-undeclared-baseline.txt`。原因是普通技能盾的零系数清单漏掉这个新增 optional 字段。现补 `(grant.amount.resistsBps ?? 0) === 0`，拒绝链为 validateMechanisms → uncompiled shield grant；无此装备的战斗仍不重演。此攻击与前述 +1、-1、完整目标重绑合计四类原可接受向量均已有回归覆盖。

导出验证器自身在可信声明筛选之后再次检查 tick 为安全整数且范围0..1200。专项直接调用测试覆盖-1、0.5、1201、MAX_SAFE_INTEGER；无resists可信声明时，用访问即抛错的输入证明不读取重演输入。

最终专项完整原始输出保存于 `g2-4b-resists-focused-tests.txt`（3 files / 78 tests），typecheck输出 `g2-4b-resists-typecheck.txt`。未运行完整fast/timing。

## Source-audit fixture regeneration

Executed the unchanged public-command Herald generator with `--write` after
freezing the repair source. All five raw inputs were exported before loading
production restoration; all five restored identically and passed combat start
plus fifteen subsequent round trips. The original raw five JSON files and
trajectory are byte-for-byte unchanged against d3112d6. Only manifest `sources`
and `sourceSha256` changed. The byte audit and full generator output are retained
in adjacent `g2-4b-resists-herald-byte-audit.json` and
`g2-4b-resists-herald-record.txt`. No content, rules, loot, schema or gameplay
identity was changed. The requested final one-time full run is still pending.


## PR #159 追加复核（基于 794c92a，已包含 #158）

M1：从可信输入创建开战状态，并以编译后的 grant-shield 声明生成 canonicalSource 集合（持有者、装备实例、效果索引及完整来源）。两侧所有声称来自该集合的层均参与重演比较，不再由候选 resistsBps 决定。局部恢复先按来源找到盾声明，再严格核对 grant；不匹配直接拒绝，不能退回固定值盾分支。

新增攻击以 atTick(60) 合法存档为基础，原光盾层不动，在另一个活单位增加同来源层，resistsBps=0、flat=1，并同步授予量、剩余量、目标总盾、过期时间、目标身份及固定目标声明。object/JSON 均被重演拒绝，独立局部验证也在 declared shield grant 拒绝。

S1/S2 当前源码验证：公开命令生成光盾+石像鬼+探索者护臂，tick600 已有真实护臂触发收据，runtime.abilityPowerFlat=15、展示 AP=145、光盾217。object/JSON 均合法恢复；恢复前后逐 tick 比较完整 state（含 RNG）与 events，直到本轮结束，再公开推进到下一轮开战并比较至该轮结束。#158 之前的 derived ability power 拒绝在当前源码上不再发生。

源码指纹使用原脚本 `node tests/fixtures/record-g2-3-herald.cjs --write` 重新生成；核对五个 raw JSON 与 trajectory 字节不变，仅 manifest 的 sources/sourceSha256 更新。规则、数值、存档字段、内容与 loot digest 均未修改。

本次最终验证：仅运行 `npm test -- tests/g2-4b-resists-restore.test.ts tests/explorer-bracer-restore.test.ts`，2 files / 44 tests passed；`npm run typecheck` 与 `git diff --check` 通过。未跑全套，未调整 timeout、skip 或数值期望。生成器五份输入全部通过其内置恢复与开战后十五 tick 往返校验。
