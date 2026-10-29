# 卓尔不群、安慰剂+ 对齐 14.24（2026-10-28）

## 范围、来源与精确字段

用户已批准仅修改 `built-different` 与 `placebo-plus` 的数值。实际起点 `claude/sol-t17 @ 5ca5ad623742afb9f455cf74c119e16878a8c82a`，包含指定基线 `97068956` 和 73 张说明补齐；工作区起始干净。未执行 Git 写操作。

只读来源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`，SHA-256 `2ce78dba16d45fe466ef9929d35ddcb916d6cb25c18f4bc7007fec007463b6a0`。未将该数据文件复制入库。来源条目的 `retrieved_date` 为 2026-10-23；`source_urls` 指向 CommunityDragon 保存的 14.24 客户端归档（`cdragon/tft/zh_cn.json`、`en_us.json` 和 `game/data/maps/shipping/map22/map22.bin.json`），不是重新查询当前版本。

- 数组第 90 项（从零起），`apiName=TFT6_Augment_Traitless2`：`effects.HP1/HP2/HP3/HP4 = 240/330/420/530`；`effects.AS1/AS2/AS3/AS4 = 45/50/55/60`。说明模板直接引用 `@HP1@-@HP4@`、`@AS1@-@AS4@%`；中间两档来自上述真实字段，未从端点插值。按现有阶段 2/3/4/5+ 的四档读取，逐项映射到 `health2..5`、`speed2..5`；AS 原字段是百分数，乘100转为整数 Bps。现有阶段夹取、羁绊资格和运算顺序不变。
- 数组第 47 项，`apiName=TFT_Augment_PlaceboPlus`：`effects.Gold=15`、`effects.AttackSpeed=0.009999999776482582`；模板 `@Gold@`、`@AttackSpeed*100@%`，静态说明为15金币、1%攻速。浮点噪声按既有整数规范化为100 Bps。没有阶段覆盖字段；移除项目旧 `stage3Amount=18`、`stage4Amount=22` 即恢复各阶段固定15。
- 卓尔不群条目的 `source_notes` 特别区分：14.24静态表是240–530／45–60%；2024-12-17 B热修是300–600／45–75%。本单按用户批准选择前者，不宣称这两版相同。仓库总体仍锁定14.24b，本单是明确批准的两张卡覆盖。

## 改前／改后（逐阶段）

| 阶段 | 卓尔不群生命：前 → 后 | 卓尔不群攻速：前 → 后 | 安慰剂+金币：前 → 后 | 安慰剂+攻速：前 → 后 |
| --- | --- | --- | --- | --- |
| 2 | 300 → 240 | 45% → 45% | 15 → 15 | 1% → 1% |
| 3 | 400 → 330 | 55% → 50% | 18 → 15 | 1% → 1% |
| 4 | 500 → 420 | 65% → 55% | 22 → 15 | 1% → 1% |
| 5及以后（含6-7后PvP） | 600 → 530 | 75% → 60% | 22 → 15 | 1% → 1% |

普通 `placebo` 的8/11/15金币与1%攻速不变；其他卡不变。阶段表不新增获取节点：卓尔不群仍只在2-1提供，安慰剂+仍只在3-2提供；其余获取阶段金币测试属于纯计算边界向量。

## 所有数值定义、消费位置与测试期望

下表行号对应最终工作区；同一行号后的说明覆盖该段的其他字段。

| 位置 | 数值／行为与处理 |
| --- | --- |
| `src/simulation/content/augments.ts:303`、`:475` | 唯一生产数值定义；安慰剂+固定15金与100 Bps，卓尔不群四档精确值；两条领域说明改成存档原文，代码注释注明来源 |
| `src/simulation/augment-effects.ts:151` | 卓尔不群读取 `health${stage}` / `speed${stage}`；阶段夹在2..5；无硬编码旧数值，无需改动 |
| `src/simulation/choice-acquisition.ts:7` | `choiceAcquisitionGold(definition: ChoiceDefinition, round: number): number` 的通用阶段读取；缺少阶段覆盖时回退 `amount`。不改变普通安慰剂和其他卡的分阶段支持；无新增失败原因 |
| `src/presentation/effect-text.ts:45` | 卓尔不群效果行直接读取领域四档值，自然显示新值；无需改动 |
| `src/presentation/augment-pool-text.ts:785`、`:787` | 玩家说明已是15金／1%和240–530／45–60%，保留原文 |
| `tests/fixtures/m5/oracle.g2.cjs:25`、`:30` | 独立 `AUGMENT_GOLD['placebo-plus']=15` 保留，移除 `STAGED_AUGMENT_GOLD` 中该卡的15/18/22覆盖，补逐字段来源注释；此目录其余 `*oracle*` 无这两张卡的旧生命／攻速数值表 |
| `tests/g2-augments-static.test.ts:93`、`:117`、`:194` | 完整effect等式、阶段四档及羁绊排除的精确预期同步；低阶段兼容也保持精确断言 |
| `tests/d11-fill-source.test.ts:51` | 目录／digest检查内卓尔不群完整effect预期同步，注明已批准的14.24取值 |
| `tests/s13-trait-augment-membership.test.ts:51` | 纹章／成员移除用例：240生命差，Lux500+240=740；攻速仍4500 Bps；原断言数量和资格条件保留 |
| `tests/rules-placebo-stage.test.ts:42` | 普通卡原向量不变，plus在2/3/4/5阶段均15，增加独立神谕核对；保留公开选择、唯一收据、重复失败、RNG不变、篡改拒绝、继续后恢复断言；原搜索上限1500收紧到0..100 |
| `tests/m5-oracle-augment-ledger.test.ts:10` | plus旧3-2=18断言改为六个阶段／节点固定15的独立原值断言，注明来源 |
| `tests/g2-augments-multiplayer.test.ts:17`、`:37` | 新增9个卓尔不群双边快照向量（2/3/4阶段首战及末次PvP，5/6/7阶段）；逐个单位核对未激活羁绊者的HP／AS增量及对侧不获加成；新增6个plus双边100 Bps向量，包含6-7后PvP |
| `tests/augment-pool-display-audit.test.ts:90` | 现有两条玩家说明精确等式已是目标值，保留 |
| `tests/augment-description-coverage.test.ts:31` | 覆盖两卡玩家／卡片路径及与独立存档说明逐字一致；无需改动 |

`src/presentation/augment-display.ts`、素材清单、`content/source-manifest.ts`、`augment-offer-rules.ts`、`augment-policy.ts`、`opening-encounters.ts` 仅含名称／ID／阶段准入引用，`effects.ts` 与 `validate-content.ts` 仅定义字段结构，均无旧数值副本，保留。`scripts/generate-m5-route.cjs` 和其余grep命中的候选池／互斥测试也只引用ID，不改变准入或规则。

## 文档、身份与录制边界

- 当前规则说明同步：`M5_RULES.md:307`、`docs/MATCH_CONTRACT.md:317`、`docs/COMBAT_CONTRACT.md:113`、`docs/S13_RULES_GAP.md:370` 的plus旧分段表；`docs/S13_TRAIT_PROJECTION.md:119` 的240生命示例；`docs/augment-description-audit-report.md:65`、`:69` 的当前实现列。
- 历史差异／旧批准值保留原记录，并在文首明确本单覆盖：`docs/AUGMENT_DESCRIPTION_AUDIT.md`、`docs/RULES_PLACEBO_OVERTIME.md`、`docs/V22_RELEASE.md`、`docs/PLAYTEST_1022B_RULES_REPORT.md`、`docs/D11_WIRING_V15.md`。这些历史报告内的15/18/22或B补丁旧值不再作为当前规则。
- 执行 `node scripts/update-content-identities.cjs --write`，最终 `CONTENT_DIGEST` 从 `fnv1a32-utf16:229d9f7e` 改为 `fnv1a32-utf16:527bc747`；`LOOT_REPLAY_DIGEST` 仍为 `fnv1a32-utf16:55f72339`。生成文件 `src/simulation/content/identity-constants.ts:3`，精确摘要预期同步到 `scripts/tests/production-size.test.ts:109`。
- 未跑纪元 `--write`，未改 `docs/evidence/`、任何 `*-online-rules-*`、整局golden或录制状态。历史录制中出现的强化ID、旧资源和旧摘要属于原纪元证据，保持原字节；交执行端统一重录，不能用本次仅数值回归声称旧纪元已兼容。
- 未改 `src/server/`、展示模块或素材；只修改两个src文件：`src/simulation/content/augments.ts`、`src/simulation/content/identity-constants.ts`。没有新增真实时钟、随机源、协议字段或服务器逻辑。

## 最终验证

- 按 `grep -rlE 'built-different|placebo-plus' tests --include='*.test.ts'` 选出15个相关文件，另外加入 `tests/content-identity-constants.test.ts`、`scripts/tests/production-size.test.ts`；通过 `npm test -- --configLoader runner --maxWorkers=3 ...` 运行：**17个文件、512项全部通过**。包含 `tests/augment-description-coverage.test.ts`；既有两卡数值断言、资格／互斥、真实选择收据与恢复、独立神谕、minified bundle摘要语义均通过。
- `npm run typecheck`（`tsc --noEmit`）：通过，exit 0。
- `node scripts/update-content-identities.cjs --check`：通过，最终摘要 `fnv1a32-utf16:527bc747`／`fnv1a32-utf16:55f72339`。
- `git diff --check`：通过。未删除或放宽断言、超时、门槛或预算；数值等式仅按已批准来源更新。没有运行纪元录制或浏览器验证；本次不声称旧录制已通过新身份验收。
- 交接：执行端重录相关纪元并提交工作区；无需用户新增玩法决定。
