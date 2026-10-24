# 战斗法力规则：第1–4条（待 v22 统一录制）

基线 `codex/mana-rules@1b0e72b5`。依据为用户10-23批准的 `../perf-1022/rules-1023/approved-1023-batch2.md` 第1–4条；离线执行，不联网、不提交。第5条减伤叠加及其他数值不动。来源/P说明见 [S13_RULES_GAP](S13_RULES_GAP.md) 顶部。本单不录epoch、不改身份/digest常量、归档或golden。

## 实现与内部合同

| 位置 | 行为/签名 |
| --- | --- |
| `src/simulation/m8/mana.ts:28` | `damageMana(beforeMitigation:number, afterMitigation:number):number`，返回单包百分之一法力 `min(4250, pre+3×post)`，不再返回整数法力。参数须为非负安全整数，否则RangeError。 |
| `src/simulation/m8/damage.ts:48` | `prepareDamage`的内部中间值由`rawAfterCritical`改为`beforeMitigation`：含暴击、出伤增幅，抗性/减伤之前；既有伤害、反伤数值与运算顺序不变。 |
| `src/simulation/combat-s13.ts:465` / `:672` | 包结算收集受伤百分之一法力，按单位合计、应用已有先知增幅、加旧余数，tick末统一floor一次；`damageManaRemainderCenti?:number`保存0–99余数。没有合格包时余数保持；锁蓝期间不累计受伤法力或新余数。 |
| `src/simulation/combat-s13.ts:341` | 施法消耗`maxMana`，余量保留；普通单位施法开始写`manaLockedUntilTick=tick+20`。tick T施法，T…T+19锁蓝，T+20恢复。 |
| `src/simulation/m8/mana.ts:14` | `resolveMana(state,request,tick,cast?):ManaOutcome`签名不变：damage只补至最大值，不能扣掉已存的非受伤溢出；其他来源全部保留，零最大法力仍不增长。`overflow`仍表示丢弃量，保留量进入`applied/after`；锁蓝量进入`blocked`。不匹配目标、非法数值或未绑定退款沿用RangeError。 |
| `src/simulation/battle-equipment.ts:109` | 下一tick安装装备不截掉既有溢出；新增起始法力服从该tick锁蓝，维克托原能量上限保持。 |
| `src/simulation/m8/crit.ts:18` / `m8/item-program.ts:38` | `authorizeSpellCrit`原签名不变：先合并未截断的暴击率，超10000Bps部分除2向下取整并加暴伤，再把概率封顶10000Bps。多余装备授权的1000Bps仍单独叠加，不凭空授予技能暴击。 |
| `src/simulation/m8/crit.ts:38`、`s13-augments-p2-combat.ts:82`、`s13-p3-combat.ts:74` | 内部`addCritChance(base,bonusBps)`复用转换；Cull/Knockout的条件暴击率同样转换；Knockout把本次倍率随临时伤害包传入，普通/技能包仍沿既有授权。无新增RNG调用。 |
| `src/simulation/combat-runtime-facts.ts:30`、`restore-combat-replay.ts:17`、`serialization-structure.ts:370` | 保存允许普通法力大于最大值，但必须从认证开战输入重算并精确核对mana/锁蓝/余数，拒绝伪造（`mana binding facts`，动态路径沿用authoritative错误）。Match公共命令/失败枚举无变化。 |

补充执行口径（P）：post为包减伤后、护盾/HP分配前的值；护盾全吸收也回蓝，免伤包不回蓝，只对伤害批次后幸存者结算法力。死亡之蔑的原包包括延迟量，后续扣血不重复回蓝。洛里斯重定向按实际转移伤害比例分摊pre（转移方floor，余数留原目标），不重复计算完整pre，各接收包独立封顶。既有绑定本次施法退款仍可绕锁；阿木木零法力、维克托3/8混沌能量/攻击增长/外来法力转AP保持。旧M3/M4独立引擎不切换。

## 独立手算与一致性

新增 `tests/rules-combat-mana.test.ts` **20/20**，相关核心组合（含G03/G08、眼泪装备、战中装备）**55/55**。

| 输入 | 独立预期 |
| --- | --- |
| pre200，护甲100→post100，护盾全吸收 | 200+3×100=500百分之一 →5法力，HP不掉 |
| 100普攻暴击到140，护甲100→70 | 140+210=350 →3法力、余50 |
| pre1000/post1083；pre1000/post1084 | 4249；4250（上限）百分之一 |
| 两包各pre2000/post2000 | 每包42.50，总85，无整tick上限 |
| 同tick两包7/7，下一tick重复 | 56百分之一；再+56→1法力、余12 |
| 先知+50%，每tick7/7，共3tick | 每tick28×1.5=42；合计126→1、余26 |
| pre600/post300，洛里斯平分 | 两方各pre300/post150→7、余50 |
| pre200/post200，死亡之蔑延迟100 | 初包8法力；下一tick扣1HP，法力仍8 |
| 法力95、普攻+10、最大100 | 105；下一tick施法花100、留5；20tick锁蓝边界精确 |
| 暴击率125%、原暴伤140%、AD100 | 暴击率100%、暴伤152.5%，伤害floor(152.5)=152；仍只抽1词 |

真实公共操作取得的战斗检查点覆盖：余数/锁蓝保存恢复、真实超过最大法力的保存恢复、对象与JSON伪造拒绝、恢复后下一tick完整状态/事件一致。阿木木/维克托混合阵容按同步与1/7/31步切片比较完整结果、RNG和事件字节，再比较回放；均通过。

## 验证数字与旧测试失败清单

- `npm run typecheck`、`npm run build -- --configLoader runner`、`git diff --check`通过。共享node_modules只读，测试统一加`--configLoader runner`，未改配置或CI。
- 相关回归57文件：**711项，678通过、18失败、15跳过，另2个文件初始化/前置钩子失败**；身份/golden组7文件：**48项，46通过、2失败**。合计759项、724通过、20失败、15跳过；不是全套测试通过。
- 干净HEAD另建`/tmp`快照复测：已有14项相同断言失败；另2个钩子与身份2项也在父基线失败。本单新增4项失败均为旧饮血剑夹具把任何来源的首盾当成饮血剑盾。原断言均保留，没有改golden或放宽断言。
- 同机同配置生产构建，按`m7-budget.cjs`相同口径统计顶层JS gzip(level9)：HEAD **658588 B** →本单 **658919 B**，**+331 B（+0.0503%）**；3D独立chunk不变。未重跑交互耗时门槛。

| 文件 | 保留的失败用例 | 分类/原因 |
| --- | --- | --- |
| `combat-contract.test.ts` | frozen combat contract snapshots integer star-scaled attributes, fixed defenses and independent resolved abilities | 已有基线失败（干净HEAD复现） |
| `m8-b4-audit-regressions.test.ts` | B4 audit R1: qualified packets and counter projections 5-1 real Match progression with Titan/Warmog/Gunblade saves through enemy same-action double damage | 已有基线失败（干净HEAD复现） |
| `m8-b4-audit-regressions.test.ts` | B4 audit R3: projection semantics and active-effect receipt references R3b rejects deletion of the entire Bloodthirster receipt while its granted shield is active | 新法力节奏使艾瑞莉娅更早施放技能盾；旧首盾夹具预期418为175/0 |
| `m8-b4-r3b-lifecycle.test.ts` | B4 R3b: compiled consumption partition survives the complete shield lifecycle untriggered legal object/JSON saves retain first use; missing/duplicate unconsumed identities are rejected | 新法力节奏使艾瑞莉娅更早施放技能盾；旧首盾夹具预期418为175/0 |
| `m8-b4-r3b-lifecycle.test.ts` | B4 R3b: compiled consumption partition survives the complete shield lifecycle consumed source with an active shield rejects deletion of its receipt in both restore entries | 新法力节奏使艾瑞莉娅更早施放技能盾；旧首盾夹具预期418为175/0 |
| `m8-b4-r3b-lifecycle.test.ts` | B4 R3b: compiled consumption partition survives the complete shield lifecycle consumed source after natural shield expiry/cleanup still rejects receipt deletion and never grants again | 新法力节奏使艾瑞莉娅更早施放技能盾；旧首盾夹具预期418为175/0 |
| `v19-part2.test.ts` | v19 six costs freezes stage/level odds and preserves two words per shop slot | 已有基线失败（干净HEAD复现） |
| `v19-part2.test.ts` | v19 six costs shared six-cost reservations are finite, can merge, sell and fall back after exhaustion; locks and failures are inert | 已有基线失败（干净HEAD复现） |
| `restore-audit/bounds-preflight.test.ts` | 文件初始化/前置钩子；earned source must be dead | 旧路径oracle要求earned source已死亡，干净HEAD已复现 |
| `restore-audit/cd-replay-facts.test.ts` | G-C06 binds the real absorption value even when its status is forged coherently | 已有基线失败（干净HEAD复现） |
| `restore-audit/cd-replay-facts.test.ts` | G-C08 binds real one-thousand-cuts history | 已有基线失败（干净HEAD复现） |
| `restore-audit/cd-replay-facts.test.ts` | G-C08 binds real eagle-eye history | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-grant-evidence.test.ts` | 文件初始化/前置钩子；earned source must be dead | 旧路径oracle要求earned source已死亡，干净HEAD已复现 |
| `restore-audit/g23-reward-allocation.test.ts` | rejects a forged ThreeCostUnit count before invoking any atom expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects a forged FourCostUnit count before invoking any atom expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects a forged FiveCostUnit count before invoking any atom expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects an unearned frozen bundle with forged id before expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects an unearned frozen bundle with forged tier before expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects an unearned frozen bundle with forged source before expansion | 已有基线失败（干净HEAD复现） |
| `restore-audit/g23-reward-allocation.test.ts` | rejects an unearned frozen bundle with forged round before expansion | 已有基线失败（干净HEAD复现） |
| `content-identity-constants.test.ts` | committed identities cover complete archived content (CI fast) matches the original full content root, including explanation/source columns | 身份根未重录，待 v22 统一录制（父基线亦失败） |
| `content-identity-constants.test.ts` | committed identities cover complete archived content (CI fast) matches the full loot replay root | 身份根未重录，待 v22 统一录制（父基线亦失败） |

身份根保留原断言：CONTENT期望`737db413`、当前计算`35273c97`；LOOT_REPLAY期望`b60b716e`、当前计算`ef359464`（均带`fnv1a32-utf16:`前缀）。不执行更新脚本。旧盾夹具需在v22统一集成时选取真实饮血剑触发点，继续严格核对来源收据与完整盾层；其余失败按各自原规则任务处理。
