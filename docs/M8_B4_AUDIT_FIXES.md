# M8 B4 审计修复 R1～R5、H2（含 R3b 全生命周期补修）

修复基线为 `39ca01c5ea20315f751f4d332ada1eedfc2ca225`，运行代码修复提交为 `6e0d902bcabafae09d49cabdfd9e897658858d7b`。仅追加提交；没有 rebase、force push、合并到基线或正式分支。U4 只在 detached worktree 做体积实验，未合入 `feat/m8-b4`。

## 审计处理表

表内测试名与正式 Vitest 用例对应；参数化项包含全部列出的参数。

| 项目 | 处理及文件:行号 | 正式测试名与文件:行号 |
| --- | --- | --- |
| R1 | `src/simulation/m8/triggers.ts:42` 在消费前判断包权限与派生层；`:91` 分离伤害次数、逐包状态及共享计数更新。`src/simulation/m8/s13-triggers.ts:33` 按原 effect index 执行已获资格的效果，保留事件幂等、ICD、每战上限和有限伤害派生；没有装备 ID 特判。 | `tests/m8-b4-audit-regressions.test.ts:17` `%s listens to all three positive Urgot skill targets`；`:28` `%s: ineligible Runaan arrow settles first without spending burn allowance`；`:36` `Last Whisper applies 30% sunder to both root attack and physical Runaan arrow`；`:42` `Titan same-action Ezreal double packet: two stacks update both attributes at next tick (shield=%s)`；`:57` `Titan zero actual incoming damage does not count or create a growth projection`；`:62` `5-1 real Match progression with Titan/Warmog/Gunblade saves through enemy same-action double damage`。`tests/m8-b4-trigger-ledger.test.ts:16`、`:26` 验证资格不消费、同事件恢复后幂等、混合声明伤害只派生一次、状态仍逐包更新并保留原索引、装备派生不递归。原 `m8-b4-bow.test.ts` 满层向量继续验证25层与一次双抗奖励。 |
| R2 | `src/simulation/content/items-tear.ts:132` 救赎减伤显式 `next-tick`；`src/simulation/content/item-programs.ts:16` 状态 builder 要求调用方显式给出 activation，其他声明明确保持原时序。 | `tests/m8-b4-tear.test.ts:16` `redemption first contribution is [101,201): damage100/90/90/100 at ticks100/101/200/201 without refresh`；`:39` 原治疗向量保留75，tick100伤害预期改为100。边界测试在首次施加后使来源死亡，阻止tick200下一次周期刷新掩盖到期。 |
| R3a／R3b 首轮 | `src/simulation/m8/restore.ts:40` 严格比对 kind、amount、唯一 contribution key 与无额外活动字段；`:41`、`:90` 检查活动状态／盾的消费记录。`src/simulation/m8/item-restore.ts:11` 声明递归保留原一次消费来源，`:35` 要求对应 runtime 已消费、次数1且不晚于效果发生。保留原来源、时序、护盾守恒与声明校验，未接受错误泰坦投影。 | `tests/m8-b4-audit-regressions.test.ts:95` `R3a rejects Giant Slayer projection forged %s, leaving genuine save valid`（kind、amount；对象与JSON入口）；`:104` `R3b rejects deletion of the entire Bloodthirster receipt while its granted shield is active`（整条记录删除，保持175盾；对象与JSON均拒绝，原存档续算相同）。 |
| R4 | `src/simulation/content/items-bow.ts:69`、`:94` 分别声明 B-07/B-10 的 `approved-provisional`；`:101` 增补 B-10 关联；`:175` 用完整机制文字说明泰坦触发、盾伤、下一tick属性、持续本战、25层及满层奖励一次。`src/simulation/item-catalog.ts:12` 从目录元数据投影证据状态。 | `tests/m8-b4-audit-regressions.test.ts:121` `only B-07/B-10 are approved-provisional; Titan describes actual stack and cap rules`；`tests/m8-b4-integration.test.ts:65` `catalogue query is frozen,source-labelled,44 entries and consumes zero Match words` 改为验证两项暂行，其余已复核。 |
| R5 | `tests/m8-b4-tear.test.ts:10`、`:11` 实际跨越前／后排后断言开战分支及回蓝；`:28` 手算115×1.05取整为120，验证500Bps、第二次击杀刷新及到期恢复115。`tests/m8-b4-integration.test.ts:48` 拉克丝取样后真实跨越50%血线，保存恢复并释放原强化值；R1～R3反例亦全部入正式回归。 | `helm back:AP100+10+15=125;tick60 adds10 mana,original branch survives movement`；`helm front moves into back rows but retains40 resists and incoming-hit mana instead of periodic mana`；`blue kill500Bps makes115→120 damage;second kill refreshes expiry,159/160 boundary remains half-open`；`Lux HoJ samples360×130%=468; crossing below50% keeps charged468 through Match save and next attack`。 |
| H2 | `docs/M8_B4_STATUS.md:119` 将6b7f06…标签改为脚本 JSON 编码字符串的 `runnerHash`，并列明原始字节 SHA256 1a5e52…；脚本未修改。 | 对照原证据 `docs/evidence/M8_B4_CI_EVIDENCE.json:1387` 的 `runnerSha256`，复核原脚本原始字节；仅说明标签修改，不新增同形单测。 |

## 对 B3 已签收行为的影响

`triggers.ts` 和 `restore.ts` 是 B3 通用代码，本次修复不是独立装备执行器。G09 的正实际承伤／共享计数属性更新现在按每个事件执行；逐包监听不再占用伤害派生额度，混合声明保留每效果原索引。合资格伤害派生仍受 maxPerAction 与 equipmentDepth 上限控制；ICD、maxPerCombat、奖励一次及重复事件幂等不变。非法包不会先消费额度。

首轮恢复修复拒绝伪造 kind／amount，以及**仍被活动状态或护盾引用**的缺失收据；它没有覆盖盾自然结束后的收据删除，`bfcd505` 的复审指出 R3b 尚未闭合，不能将首轮描述为消费完整性全部通过。本次补修用编译来源的完整消费分区补齐这项检查：未消费来源键与已消费 runtime 必须互斥、唯一且合起来完整覆盖每场一次来源，效果清理不会删除消费事实；任何缺项都拒绝，不将缺项解释为已消费或未触发。合法当前版本存档的首次触发、伤害、效果、RNG及续算不变，B3 原有“致死伤害不产生消费 runtime”行为也保留。没有放宽校验、改变 G12 或修改冻结合同。开发装备目录由 v2 升至 `s13-14.24b-m8-b4-v3`，内容 digest 自动更新；旧开发目录存档按既有 content-digest 规则拒绝，不新增迁移或绕过版本检查。B9/B10 最终版本切换仍按原计划。

四条既有正式路线使用 B3 装备。通过 `scripts/update-m8-b4-audit-golden.cjs` 的独立经济／随机 oracle 与严格比较，cannon182、sniper178、mage172、sniper-caitlyn182条命令逐条不变，30场战斗各自完整事件哈希全部不变；首轮仅版本/digest、本次另含完整消费分区进入状态，使状态哈希改变。原B4 golden归档至 `tests/fixtures/m5/full-match-golden.pre-m8-b4-audit.json`，数值依据仍是独立手算与审计反例，不来自重建golden。

## 验证与反例有效性

新反例放入修复前 `39ca01c` 的隔离 worktree 后，三文件39项中16项失败、23项通过；失败含群体漏状态、副箭抢占次数、泰坦双包属性、未经篡改5-1保存、救赎时序、两类篡改及目录状态。5-1 原版抛出 `Invalid Match save: status source/timing projection`，证明该回归真正击中阻塞路径。

首轮修复后定向四文件41项通过；B3原有六文件78项全部通过，连同G01～G12共21文件156项通过，原B3/G12测试没有改写。完整 `npm test` 为93文件1165项通过（612.40秒），`npm run build`通过；最终SHA的完整 GitHub CI 结果见签收汇报；CI 以 [feat/m8-b4 的完整工作流](https://github.com/catfish-xn/cat/actions/workflows/ci.yml?query=branch%3Afeat%2Fm8-b4) 对应最终SHA为准，不把旧CI #91记作本次结果。

## 修复后的体积

同 Node24.21.0、同 lockfile（SHA256 `3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`）、普通production构建；沿用 `scripts/m7-budget.cjs:23` 的方法，对所有 `dist/assets/*.js` 分别Node gzip level9后求和。M7基线为424763B，可用整数上限467239B（×1.10）；没有压缩参数／依赖／加载方式优化。两种修复后构建均通过typecheck和Vite。

| 构建 | JS gzip B | 相对当前门禁余量 B |
| --- | ---: | ---: |
| 修复后B4单独（运行代码6e0d902） | 465,933 | +1,306 |
| 同一代码＋固定U4 `5778cab29fd02a5aeb002b1e12b16f1ac4dc39bf` | 469,878 | −2,639 |

修复使B4比原465502B增加431B；固定U4在修复树上增加3945B。U4合入实验无冲突，正式B4分支未合入U4；实验仅构建与测量，不冒称该合入树已完成完整功能CI。B5新增体积未知，后续容量方案由用户单独决定，本次未实施优化或门禁调整。资产文件／SHA256见 [`M8_B4_AUDIT_LOCAL_EVIDENCE.json`](evidence/M8_B4_AUDIT_LOCAL_EVIDENCE.json)。

## H1登记：独立内存门禁任务

H1不计入本次修复：保留原失败、原门禁、原GC与预热参数；登记代表性新装备程序负载、预先约定重复及失败处理、连续等长post-GC窗口走势和独立快照保留链调查。旧基线同样超限，不能直接归因B4；现有死亡之刃探针的 `boundB4ProgramUnitCount=0`，没有完成新装备负载的覆盖验收。精确根因及测量判别能力仍待单独立项，本次没有改脚本或宣称排除泄漏。

## R3b 复审残留：全生命周期消费完整性

补修基线为 `bfcd505a57e7053c01287182d81e4328b47d0c1f`。下面的处理表是本次新增范围；上表及首轮计数保留其历史归属，R1、R2、R3a、R4、R5、H2 的既有修复未改执行行为。原活动盾用例仍在，错误文本改为更早执行的完整性拒绝；其 describe 标题改为 `projection semantics and active-effect receipt references`，不再暗示该组已覆盖全部生命周期。

| 项目 | 处理及文件:行号 | 正式测试名与文件:行号 |
| --- | --- | --- |
| R3b：完整来源事实 | `src/simulation/m8/runtime-types.ts:19` 的 `unconsumedSurvivalKeys` 与已消费 runtimes 组成完整分区；`src/simulation/m8/shield.ts:68` 根据编译后的 `maxPerCombat === 1` 来源身份建立键集合，相同来源的开场／伤后监听共用键，装备实例保持独立；`src/simulation/m8/s13-mechanisms.ts:156` 开场建立、`:263` 消费后仅移除对应未消费键。 | `tests/m8-b4-r3b-lifecycle.test.ts:41` `untriggered legal object/JSON saves retain first use; missing/duplicate unconsumed identities are rejected`。合法未触发档两入口可恢复，并由真实伤害首次授盾175；未消费来源的缺失／重复也拒绝。 |
| R3b：活动效果阶段 | `src/simulation/m8/item-restore.ts:63` 根据权威编译结果验证互斥、身份唯一及覆盖完整性；原活动效果引用校验保留。 | `tests/m8-b4-r3b-lifecycle.test.ts:56` `consumed source with an active shield rejects deletion of its receipt in both restore entries`；原 `tests/m8-b4-audit-regressions.test.ts:104` 活动盾反例仍通过。 |
| R3b：效果结束阶段 | 同上 `item-restore.ts:69`，完整性不依赖 shieldLayers 或 statuses 是否仍存在；未消费键在消费后不会随盾到期重建。 | `tests/m8-b4-r3b-lifecycle.test.ts:62` `consumed source after natural shield expiry/cleanup still rejects receipt deletion and never grants again`。正常 stepMatch 自然到期清理盾层，单独删除 runtime 两入口拒绝；合法恢复后真实正伤害不重复授盾。该测试在未修 `bfcd505` 上失败于“expected to throw”，证明击中复审残留。 |
| R3b：实例不能互相顶替 | 同上来源键包括 combatId、owner、definition、instance、effectIndex、parent、target、application；不按装备 ID 打补丁，不增加 RNG。 | `tests/m8-b4-r3b-lifecycle.test.ts:75` `two equipment instances consume independently; one receipt cannot replace the other after both shields end`。两实例各175盾、两份唯一消费记录；正常到期后删一份／复制另一份顶替均拒绝。 |

新分区只记录资格消费事实，没有产生未触发 runtime，因此最大生命奖励及历史授盾采样仍只计算原已消费 runtime；ICD、每动作伤害额度、逐包监听、共享计数属性更新和其他恢复检查保持原语义。本次没有修改 `triggers.ts`、`restore.ts` 的既有调度／语义校验，不调整冻结合同、G12、CI、堆脚本或包体预算脚本。B3 原有六文件78项及前轮新增回归的具体结果随仓库证据提交。

## 已知问题登记：泰坦已有层刷新后的属性查询

复审建议，修复前已存在，本次不修。`src/simulation/m8/status.ts:61` 与 `src/simulation/combat-s13.ts:55`：刷新已活动的属性贡献时保留旧生效起点，同时替换幅度，造成当前 `readCombatStats` 可能提前一 tick 返回新层数。基础 AD/AP100，tick1 首攻、tick2 第一层生效，tick20 第二攻实际取样102正确，但 tick20 结束查询已为104/104，按第二层下一 tick 生效的语义应仍为102/102。后续单独统一当前值／待生效值投影并补已有层再次叠层查询测试；这与 R1 双包漏更新／合法存档失败不同，也不把本次测试通过表述为该建议已修。

## R3b 补修后的体积（只测量）

继续按相同 Node、lockfile、production 构建及 `scripts/m7-budget.cjs:23` 的逐 JS 文件 gzip level9求和方法；上限仍467239B。运行代码 `3f10251`：B4单独 **466144B，余1095B**；同树在 detached worktree 隔离合入固定 U4 `5778cab`，仅构建测量为 **470088B，超2849B**。GitHub CI #95 原预算日志亦确认B4为466144B，与本地测量相同。两者相对首轮分别增加211B、210B；本次没有体积优化或阈值调整，U4也没有合入正式B4分支。资产字节、hash及构建范围随本轮仓库证据保存。

## R3b 本轮验证与仓库证据

运行代码 `3f10251` 的本地完整单测94文件1169项通过（603.46秒），`npm run build`通过；定向26文件201项包括本次4项、前轮4文件41项，以及未经改写的B3六文件78项／G01～G12十五文件78项。相同自然到期反例在基线bfcd505上因“expected to throw”失败；不把复现错误当作修复通过。四条旧路线完整命令及120场战斗事件哈希仍与bfcd505相同。

[CI #95 首轮 cannon preview 原始日志](https://github.com/catfish-xn/cat/actions/runs/37747928993/job/113213786367)失败于H1堆门禁：1147300B > 1048576B，超98724B；仍为2次预热、30次循环。失败作业、原始artifact、完整生命周期测量和失败日志身份会与本轮回归、冻结文件hash、体积资产一起提交至[`M8_B4_R3B_EVIDENCE.json`](evidence/M8_B4_R3B_EVIDENCE.json)。任何同SHA重试均保持原参数与门禁，保留首轮失败，不据重试通过宣称H1已解决。证据记录运行代码SHA的完整CI；随后文档／证据提交还须在自身最终SHA执行完整CI，最终运行链接以签收汇报为准。


运行代码 `3f102514ce589cdc5302325fe02915a73140b561` 的[完整 CI #95](https://github.com/catfish-xn/cat/actions/runs/37747928993)第2次执行通过：12个必需作业成功、两个可选诊断跳过。首轮失败和被依赖跳过的比较作业保留在仓库证据的 attempt history；比较作业在重试后正常执行并通过。完整回归、原B3测试hash、冻结合同／G12、原门禁脚本hash与体积资产均已入库。本段仅证明运行代码提交，不将 #95 冒称为随后证据提交的 CI。
