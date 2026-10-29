# Batch 5 G3 交付（2026-10-27）

基线 `codex/v25-g3` / `4495602daa21ab5b218e05a76721b7a070117ccc`，只实现 B5-68 与 B5-71 的联机规则与测试；没有提交 Git、修改界面／素材／服务器或重录 epoch。原始研究文件只读，两轮只使用这两项的结论。证据差异和用户约定分别登记在 `S13_RULES_GAP.md` 的 P-B5-68-G3、P-B5-71-G3（2026-10-27），并更新 GAPS 的单卡分类。

| B5-68 空战 | 交付 |
| --- | --- |
| 数值 | 金色；刀疤、泽丽各一；每实际移动一格 +300 Bps AD／+3 AP，每场最多 99 格；每次野火帮起飞另加 +900 Bps AD／+9 AP，不受格数上限限制 |
| 约定与研究状态 | 14.24 数值已证实；GPT 对执行细节未找到证据，Gemini 社区／跨版本资料提示双属性、加法和全移动；按用户批准的约定执行，未冒称 99 的原始字段已解码 |
| 报价 | 2-1、3-2、4-2 均可；后两节点仍须在场野火帮；未覆盖任何阶段禁令 |
| 测试 | 13 项：原数据、三个节点、原生／纹章、低羁绊档、行走／传送／强制位移、重复及无法位移的起飞、99 格上限、状态不可变、下战清零；真实房间选卡／领球／部署／出战；对象、JSON、序列化保存恢复；伪造奖励及增加／删除格数与冲刺计数拒绝 |

| B5-71 物竞天择 | 交付 |
| --- | --- |
| 数值 | 金色；所有试验品 +1200 Bps HP；取得 3 个试验品；普通实验室仍为 3／5／7 档 2／3／3 格；7 档献祭加成 ×2；匿名 100 保留而不执行 |
| 约定与研究状态 | 描述／HP／接收范围已证实；GPT 对细节未找到证据或仅有社区推测，Gemini 跨版本社区／视频报告细节；按用户批准固定己方后数第 2 排第 4 列（玩家 col3,row6；镜像 col3,row1）。仅从本战投影排除，正式单位、装备、异常保留，不计阵亡；额外分享自身试验品加成给普通实验室上的试验品；同名可再次相加。三个礼物沿既有 P-AG1 的原生试验品全家族均匀有放回独立抽样，走共享有限池 |
| 报价 | 保留 14.24 的 2-1 禁令，仅 3-2／4-2；保留羁绊过滤及原互斥。特殊格从本持有者普通实验室抽样候选中排除，数量不减 |
| 测试 | 30 项：原数据／三个节点和互斥、3／5／7 档、六种原生捐赠、重复加成、空格／非成员、HP 公式、装备／异常保留与效果不转移、纹章捐赠、Jayce Forge／门户／亡语不触发；真实房间从商店购买、合法选卡、独立三礼物、装备和部署、双边战斗、下一准备期回来；对象／JSON／序列化保存恢复与改奖／改加成拒绝 |

## 新文件与调用点

内容和规则只放在 `src/simulation/content/augment-pool-batch5-g3.ts`、`src/simulation/augment-pool-batch5-g3.ts`、`augment-pool-batch5-g3-combat.ts`、`augment-pool-batch5-g3-mutation.ts`。共享文件仅接线、登记或补充字段：

| 范围 | 实际调用点／修改 |
| --- | --- |
| 两卡共享注册 | `content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts` 各新增导入与 spread；`rules-manifest.ts` 绑定 G3 内容及约定；`validate-content.ts`、`effects.ts` 登记有限 mechanic 字段；`augment-pool-grants.ts / batch1GiftPlan` 接既有礼物事务；`content/augment-pool-batch2.ts` 保留旧原始 disabled 行作历史资料，移除已闭合的两条 BLOCKED 理由 |
| B5-68 编译／属性 | `augment-effects.ts / compileAugmentEffect` 以正式羁绊快照过滤；`combat-types.ts` 增可选本战计数；`combat-s13-state.ts / ad, ap` 读取加法增量 |
| B5-68 全位移提交 | `combat-s13.ts`（行走、opening commit）、`combat-g2.ts`（起飞、羁绊位移）、`combat-ambessa-dash.ts`、`combat-displacement.ts`、`combat-g2-3-summons.ts`、`combat-g2-3.ts`、`combat-g2-4b.ts`、`combat-six-cost.ts`、`combat-v20-traits.ts`、`g2-3-combat.ts`、`anomalies/shared.ts`、`m8/s13-mechanisms.ts`：只在既有移动事件旁调用统一计格函数，不复制移动规则 |
| B5-71 编译／名单 | `augment-effects.ts` 接 HP 与献祭标记；`strategy-snapshot.ts` 在成员快照后过滤献祭者的战斗装备／异常；`g2-3-experiment.ts` 允许普通实验室排除指定格、追加捐赠；`combat.ts / snapshotCombatSteps` 在召唤和开战前排除献祭；`two-sided-battle.ts / sideResult` 仅允许有标记的献祭者缺席 |
| B5-71 坐标／视图 | `content/augment-stage-bans.ts` 补原始 2-1 ban；`g2-3-state.ts / updateG23Cells` 同步普通实验室；`g2-3-view.ts / readG23MechanismState` 在 owner-only 数据中额外给 `mutationSacrificeCell`，未修改渲染 |
| 两卡恢复 | `g2-4b-gold-restore.ts / validateDynamicCombat`、`two-sided-battle.ts / validateDynamicResult` 接现有权威重演；没有新增 augmentHistory 节或自己构造历史事实 |
| M5 独立 oracle | `tests/fixtures/m5/oracle.g2.cjs` 手写金色池、关联羁绊、互斥、2-1 ban 与总数 247；`augment-rewards-oracle.cjs` 独立常量礼物、六角距离、加法系数、实验室 LCG 抽样及原生捐赠公式（并补 d.cts）。不导入生产代码，不用生产收据决定预期奖励 |
| 相关既有断言适配 | `tests/m5-content.test.ts` 更新 247 总数；`augment-pool-source.test.ts`／`augment-pool-batch2.test.ts` 区分已由 G3 实现的历史 disabled 行；`augment-stage-bans-audit.test.ts` 保留完整剩余差异断言，仅更新已补 Experiment 禁令的预期；`experiment-emblem-clone.test.ts` 的注入资源 fixture 通过现有选择 helper 排除历史依赖卡，避免池扩张后选中历史卡却注入未认证资源；未删除断言、未提高超时 |
| src/server | **无变更**，沿用 Room → shared-pool → snapshot/compile → resolver → settlement；未添加时钟或浏览器依赖。`src/server-entry` 也无需新导出 |

## 验证与身份

指定 11 个文件共 **209 项通过**：两卡新增 43 项；相关源数据、内容、阶段审计、克隆、双边战斗、身份常量和 production-size 语义共 166 项。末次完善合法装备 fixture 后，物竞天择 15 项再次单独通过。全部 Vitest `--configLoader runner --maxWorkers=3`，没有全套测试；唯一新 seed 查找为 0..100 内第一可用空战房间种子，物竞天择房间固定 42。没有启动浏览器或网络监听。

`npm run build -- --configLoader runner` 通过（含 `tsc --noEmit`）；`git diff --check` 通过；`node scripts/update-content-identities.cjs --write` 与末次 `--check` 通过，并同步 `scripts/tests/production-size.test.ts`：content=`fnv1a32-utf16:0a7bad1d`，loot=`fnv1a32-utf16:89fa7dd4`。身份精确匹配；外层版本沿基线，无 epoch 重录。

实际 14.24 阶段审计还保留 4 项既有 TABLE_MISMATCH：Academy、Cabal、Formswapper、BloodBrothers，未越界代修；审计测试仍要求 CLI exit 1 且精确断言这四项。两张本任务卡没有全节点禁用情况。特殊格显示数据已提供，视觉接线仍由 Claude 负责，本任务未改界面。研究跨版本细节以已登记的用户约定为实现依据。
