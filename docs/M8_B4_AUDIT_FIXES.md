# M8 B4 审计修复 R1～R5、H2

修复基线为 `39ca01c5ea20315f751f4d332ada1eedfc2ca225`，运行代码修复提交为 `6e0d902bcabafae09d49cabdfd9e897658858d7b`。仅追加提交；没有 rebase、force push、合并到基线或正式分支。U4 只在 detached worktree 做体积实验，未合入 `feat/m8-b4`。

## 审计处理表

表内测试名与正式 Vitest 用例对应；参数化项包含全部列出的参数。

| 项目 | 处理及文件:行号 | 正式测试名与文件:行号 |
| --- | --- | --- |
| R1 | `src/simulation/m8/triggers.ts:42` 在消费前判断包权限与派生层；`:91` 分离伤害次数、逐包状态及共享计数更新。`src/simulation/m8/s13-triggers.ts:33` 按原 effect index 执行已获资格的效果，保留事件幂等、ICD、每战上限和有限伤害派生；没有装备 ID 特判。 | `tests/m8-b4-audit-regressions.test.ts:17` `%s listens to all three positive Urgot skill targets`；`:28` `%s: ineligible Runaan arrow settles first without spending burn allowance`；`:36` `Last Whisper applies 30% sunder to both root attack and physical Runaan arrow`；`:42` `Titan same-action Ezreal double packet: two stacks update both attributes at next tick (shield=%s)`；`:57` `Titan zero actual incoming damage does not count or create a growth projection`；`:62` `5-1 real Match progression with Titan/Warmog/Gunblade saves through enemy same-action double damage`。`tests/m8-b4-trigger-ledger.test.ts:16`、`:26` 验证资格不消费、同事件恢复后幂等、混合声明伤害只派生一次、状态仍逐包更新并保留原索引、装备派生不递归。原 `m8-b4-bow.test.ts` 满层向量继续验证25层与一次双抗奖励。 |
| R2 | `src/simulation/content/items-tear.ts:132` 救赎减伤显式 `next-tick`；`src/simulation/content/item-programs.ts:16` 状态 builder 要求调用方显式给出 activation，其他声明明确保持原时序。 | `tests/m8-b4-tear.test.ts:16` `redemption first contribution is [101,201): damage100/90/90/100 at ticks100/101/200/201 without refresh`；`:39` 原治疗向量保留75，tick100伤害预期改为100。边界测试在首次施加后使来源死亡，阻止tick200下一次周期刷新掩盖到期。 |
| R3 | `src/simulation/m8/restore.ts:40` 严格比对 kind、amount、唯一 contribution key 与无额外活动字段；`:41`、`:90` 检查活动状态／盾的消费记录。`src/simulation/m8/item-restore.ts:11` 声明递归保留原一次消费来源，`:35` 要求对应 runtime 已消费、次数1且不晚于效果发生。保留原来源、时序、护盾守恒与声明校验，未接受错误泰坦投影。 | `tests/m8-b4-audit-regressions.test.ts:95` `R3a rejects Giant Slayer projection forged %s, leaving genuine save valid`（kind、amount；对象与JSON入口）；`:104` `R3b rejects deletion of the entire Bloodthirster receipt while its granted shield is active`（整条记录删除，保持175盾；对象与JSON均拒绝，原存档续算相同）。 |
| R4 | `src/simulation/content/items-bow.ts:69`、`:94` 分别声明 B-07/B-10 的 `approved-provisional`；`:101` 增补 B-10 关联；`:175` 用完整机制文字说明泰坦触发、盾伤、下一tick属性、持续本战、25层及满层奖励一次。`src/simulation/item-catalog.ts:12` 从目录元数据投影证据状态。 | `tests/m8-b4-audit-regressions.test.ts:121` `only B-07/B-10 are approved-provisional; Titan describes actual stack and cap rules`；`tests/m8-b4-integration.test.ts:65` `catalogue query is frozen,source-labelled,44 entries and consumes zero Match words` 改为验证两项暂行，其余已复核。 |
| R5 | `tests/m8-b4-tear.test.ts:10`、`:11` 实际跨越前／后排后断言开战分支及回蓝；`:28` 手算115×1.05取整为120，验证500Bps、第二次击杀刷新及到期恢复115。`tests/m8-b4-integration.test.ts:48` 拉克丝取样后真实跨越50%血线，保存恢复并释放原强化值；R1～R3反例亦全部入正式回归。 | `helm back:AP100+10+15=125;tick60 adds10 mana,original branch survives movement`；`helm front moves into back rows but retains40 resists and incoming-hit mana instead of periodic mana`；`blue kill500Bps makes115→120 damage;second kill refreshes expiry,159/160 boundary remains half-open`；`Lux HoJ samples360×130%=468; crossing below50% keeps charged468 through Match save and next attack`。 |
| H2 | `docs/M8_B4_STATUS.md:119` 将6b7f06…标签改为脚本 JSON 编码字符串的 `runnerHash`，并列明原始字节 SHA256 1a5e52…；脚本未修改。 | 对照原证据 `docs/evidence/M8_B4_CI_EVIDENCE.json:1387` 的 `runnerSha256`，复核原脚本原始字节；仅说明标签修改，不新增同形单测。 |

## 对 B3 已签收行为的影响

`triggers.ts` 和 `restore.ts` 是 B3 通用代码，本次修复不是独立装备执行器。G09 的正实际承伤／共享计数属性更新现在按每个事件执行；逐包监听不再占用伤害派生额度，混合声明保留每效果原索引。合资格伤害派生仍受 maxPerAction 与 equipmentDepth 上限控制；ICD、maxPerCombat、奖励一次及重复事件幂等不变。非法包不会先消费额度。

恢复对已有来源绑定增加语义一致性和一次消费完整性检查，因此过去错误接受的伪造 kind／amount、缺失消费记录现在会拒绝；合法旧机制的效果、账本、RNG及续算保持一致。没有放宽校验、改变 G12 或修改冻结合同。目录声明改变按项目规则将开发装备目录版本升至 `s13-14.24b-m8-b4-v2`，内容 digest 自动更新；旧开发目录存档按既有 content-digest 规则拒绝，不新增迁移或偷偷绕过版本检查。B9/B10 最终版本切换仍按原计划。

四条既有正式路线使用 B3 装备。通过 `scripts/update-m8-b4-audit-golden.cjs` 的独立经济／随机 oracle 与严格比较，cannon182、sniper178、mage172、sniper-caitlyn182条命令逐条不变，30场战斗各自完整事件哈希全部不变；仅版本/digest进入状态后使状态哈希改变。原B4 golden归档至 `tests/fixtures/m5/full-match-golden.pre-m8-b4-audit.json`，数值依据仍是独立手算与审计反例，不来自重建golden。

## 验证与反例有效性

新反例放入修复前 `39ca01c` 的隔离 worktree 后，三文件39项中16项失败、23项通过；失败含群体漏状态、副箭抢占次数、泰坦双包属性、未经篡改5-1保存、救赎时序、两类篡改及目录状态。5-1 原版抛出 `Invalid Match save: status source/timing projection`，证明该回归真正击中阻塞路径。

修复后定向四文件41项通过；B3原有六文件78项全部通过，连同G01～G12共21文件156项通过，原B3/G12测试没有改写。完整 `npm test` 为93文件1165项通过（612.40秒），`npm run build`通过；最终SHA的完整 GitHub CI 结果见签收汇报；CI 以 [feat/m8-b4 的完整工作流](https://github.com/catfish-xn/cat/actions/workflows/ci.yml?query=branch%3Afeat%2Fm8-b4) 对应最终SHA为准，不把旧CI #91记作本次结果。

## 修复后的体积

同 Node24.21.0、同 lockfile（SHA256 `3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`）、普通production构建；沿用 `scripts/m7-budget.cjs:23` 的方法，对所有 `dist/assets/*.js` 分别Node gzip level9后求和。M7基线为424763B，可用整数上限467239B（×1.10）；没有压缩参数／依赖／加载方式优化。两种修复后构建均通过typecheck和Vite。

| 构建 | JS gzip B | 相对当前门禁余量 B |
| --- | ---: | ---: |
| 修复后B4单独（运行代码6e0d902） | 465,933 | +1,306 |
| 同一代码＋固定U4 `5778cab29fd02a5aeb002b1e12b16f1ac4dc39bf` | 469,878 | −2,639 |

修复使B4比原465502B增加431B；固定U4在修复树上增加3945B。U4合入实验无冲突，正式B4分支未合入U4；实验仅构建与测量，不冒称该合入树已完成完整功能CI。B5新增体积未知，后续容量方案由用户单独决定，本次未实施优化或门禁调整。资产文件／SHA256见 [`M8_B4_AUDIT_LOCAL_EVIDENCE.json`](evidence/M8_B4_AUDIT_LOCAL_EVIDENCE.json)。

## H1登记：独立内存门禁任务

H1不计入本次修复：保留原失败、原门禁、原GC与预热参数；登记代表性新装备程序负载、预先约定重复及失败处理、连续等长post-GC窗口走势和独立快照保留链调查。旧基线同样超限，不能直接归因B4；现有死亡之刃探针的 `boundB4ProgramUnitCount=0`，没有完成新装备负载的覆盖验收。精确根因及测量判别能力仍待单独立项，本次没有改脚本或宣称排除泄漏。
