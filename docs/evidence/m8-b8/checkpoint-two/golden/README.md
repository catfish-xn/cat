# B8 checkpoint-two guarded golden migration

## 范围与判据

本目录只记录获批 B8 默认真实掉落启用后的现有正确性修复。生产规则、命令 driver、当前已批准的独立 oracle、正式 assert-golden、所有原 skip、门禁和数值均不修改。这指本次迁移的修改范围，不表示旧树到新树 oracle 字节相同；已批准 B8 oracle 的历史变化在 changedInputs 中明确保留。

旧 golden 精确来源 `ff60a7989ad76052c9720fe58546cc70842b316c`；在旧签收树 `4554f5afee219416be410ff7edbd16ffbeb7daf5` 中字节相同。`full-match-golden.pre-m8-b8.json` SHA256 为：

`007b6b4136d6959b227cbd9567948f83dca75db4ad788fd43d03c4e3cf069cc5`

当前生产源以 `2814d0146a3a109d8cef920034ba67d0cc571bf0` 绑定，其 `src` tree 为 `5f9b62228b236074efd78b50a571cc26d23858e5`，与此前 `6484a53` 的生产源码等价。后续并行测试/文档提交不被冒称生产变化。完整实际输入 SHA 在 `old-manifest.json`、`new-manifest.json` 和 `audit.json`：基础 manifest 覆盖全部 src 与列出的直接 driver/oracle/assert/skip/config 输入，不声称覆盖整个 tests 树；保护范围另含原有全部 scripts/.github、相关独立 oracle，以及本次新增 guard 测试。并行无关 fixture 修复不改变本 golden 的执行输入，最终整库 gates 仍须绑定之后冻结的最终 commit。

执行使用同一个实际依赖安装与 Node `22.23.3`：Vite `7.3.6`、Vitest `5.0.3`、TypeScript `5.9.3`、Phaser `3.90.0`。源码 lock 与 installed-lock 都绑定，不重新安装依赖。旧树从 git archive 解到独立 `/tmp` 目录，使用其自己的原 oracle。八条初次路线和四条新确定性复跑始终一条构筑执行完才运行下一条。

## 为什么不是换 digest 让测试变绿

- 旧树重新生成四条路线，逐条复现原 commands 及 132 个完整 state/event hash 记录。原正式 assert-golden 已在初次 capture 中执行；updater 又逐字段比对相同完整记录。
- 新树每一条真实 command/tick 都经过未改的独立 `Ledger`：经济、卡牌、物品、serial、唯一 receipt、死亡资格、冻结 loot RNG、原 RNG 流、结算、事件序列。
- 另由命令/真实收据/成长事件独立重建全部 provenance；检查每次提交 XP、HP、streak、合成配方与实例、装备 owner/slot、部署位置及完整事务链。预战 basis 与真正开战前输入精确相同。
- `verify-driver-decisions.cjs` 不加载生产引擎，只将已验证 before/after 作为只读资料，重新走未改 driver，逐次匹配它实际请求的每条 command，包括实例 ID、generation、slot、目标。四构筑全部复现，无被忽略的失败 buy；这验证实际资源状态怎样改变 driver 的决定。
- 每条 command 还有独立转录的 policy witness：可以买的构筑英雄/价格/份数、XP 与重刷阈值、组件等价数量与首个缺口、真实配方、装备目标和空槽、阵容排名和坐标。
- 逐轮对齐按语义，既不把 action index 强行同位，也不要求旧新 commands 相同。所有完整 state 叶子变化被列出；四构筑共 109,493 个差异叶子，附原始完整 route、命令前态、经济/RNG/资产、战斗输入与事件首差异。
- 独立只读审查复核上述路线、叶子列表和 witness 后，四份完整 plain diff 的 SHA256 被硬编码在 updater。顶层分类/按命令类型的文字仅是检索说明，不构成语义证明。任何新嵌套差异、熟悉类型但未经审阅的新增命令都会改变固定 diff SHA 并被拒绝。
- 候选全部写在 `/tmp`。应用前再次顺序执行四条当前路线，并要求候选完整 transcript/hash 全等及原非 skip 断言成立；全部成功后才用固定已审核 bytes 原子替换整个 golden。不是逐构筑部分刷新。

## 实测结果

| 构筑 | commands 旧→新 | HP 旧→新 | 终局金币旧→新 | ticks 旧→新 | 新 formed / bound |
| --- | --- | --- | --- | --- | --- |
| cannon | 158→194 | 89→100 | 212→222 | 10324→8467 | 14 / 14 |
| sniper | 160→182 | 60→83 | 222→245 | 12973→11930 | 15 / 14 |
| mage | 157→176 | 44→52 | 250→267 | 12814→12380 | 15 / 14 |
| sniper-caitlyn | 163→185 | 61→100 | 217→251 | 12583→11571 | 3 / 14 |

八条路线都为 victory、38 个推进轮、33 场真实战斗。新 Caitlyn 12 场参战、23 次施法，至少两场实际造成伤害。三个标准构筑的原四来源/三强化/异常/升级/锁店条件继续成立。终局非法操作保持原 state 身份、资源/RNG 不变，新局完全确定。

新 formed 观测不是解除原 skip 的批准。原 `[B8]` skip body 仍包含历史 `ScheduleReceipt` 15 组件形状，未运行、未改写、未报 passed。

## 可手算的根因与对账

按 [OPENING](../../../../M8B_OPENING.md)、[LOOT](../../../../M8B_LOOT.md) 与 [ADDENDUM](../../../../M8B_CONTRACT_ADDENDUM.md)：

1. 初态仍为 0G、等级 1、0XP、100HP、`unit-1` 刀妹 `(1,4)`；stage 1 自然收入 2/3/5G，XP 2/2/0。新增字段只有已审核的 digest、loot 冻结/进度、开局 provenance、`combatInputBasis:null` 及 B8 preparation 标签，逐字段消除这些明确差异后初态精确等于旧态。
2. 四条 seed42 路线都实际击杀绑定来源并收取：1-2 Maddie、1-3 Lux；六个选择组件；随机组件依次 belt/rod/sword/vest；2-7/3-7/4-7/5-7/6-7 分别 1/2/3/4/5G。总计 2 英雄、10 个 LootReceipt 组件、15G；另有原 5 个 Supply ScheduleReceipt 组件。不存在 forfeited/pending-capacity/retained-terminal，也没有 fallback 实际授予。
3. 冻结 fallback 依次 sword/tear/cloak/bow/belt/cloak；独立 loot 流总共 14 draws，终态 `1259077867`。它不消费 shop/choice/reward/battleSeed 流。所有同 round 的旧/新 battleSeed、choiceRng、rewardRng 均精确相等；shop 差异由实际额外 reroll/正常免费商店刷新逐次独立核算。
4. 第一场 1-2 四条路线的完整开战 Combat 和所有 combat-only 事件均不变；实际掉落追加到 Match 层后，完整 Match events 与 state hash 即已改变。后 128 场实际战斗的输入确实不同，不冒称为“同输入战斗全覆盖”。同输入比较包含全部策略输入、完整 initial Combat、battle seed 和完整 combat 事件；不从正式 golden 的 hash 范围删除新字段或 Match 事件。
5. 首个 command 差异：cannon 在 index 2 部署实际掉落 Maddie；sniper/Caitlyn index 3、mage index 4 的部署英雄 ID 因真正新生 Maddie 占用序号而后移。此后新增选择、早期装备、星级/布阵、经济决定的买卖/重刷都保留具体前态和 policy witness。
6. 所有 132 个完整 state hash、132 个完整 event hash 均应变化。除了真实资源/战斗变化，还包括 `resourceProvenance`、`combatInputBasis`、`roundResults.combatEventCount` 和 loot Match 事件造成的完整账本变化。
7. 例：cannon 2-7 开战金币 40，掉落 1G 后利息基数 41；PvE 无胜利金币/连胜收入，利息 `min(5,floor(41/10))=4`，基础 5G，结算 50G。它不是旧33G直接加1G，因为更早战斗结果与命令已经改变。
8. 全局守恒可直接手算：
   - cannon：`400收入 + 23奖励 + 2出售 - 56购买 - 62重刷 - 84XP - 1异常 = 222`
   - sniper：`398 + 23 + 1 - 52 - 40 - 84 - 1 = 245`
   - mage：`401 + 23 + 1 - 49 - 24 - 84 - 1 = 267`
   - Caitlyn：`409 + 23 + 1 - 57 - 40 - 84 - 1 = 251`
   奖励23含原8G和真实loot15G；掉落英雄从未折成金币。出售只有后续明确 sell 指令实际获得的金币。

## 最终专项实测

原样执行 `npm test -- tests/m5-route.test.ts tests/m6-integration.test.ts`：2 文件通过，8 passed / 9 既有 skipped，总用时 239.84s。未添加或调整 worker/timeout 参数。9 个 skip 是原 m5 的4个 B8、原 m6 的1个 B8与4个 B9，原 body 未执行且未改动。

新增 guard 专项诊断：19/19 实际通过；`npm run typecheck` 通过。guard 诊断日志保留其独立单 worker 运行参数，该诊断不冒充修改后的原门禁；上面的原 m5/m6 验收使用默认运行方式。应用的最终 golden SHA 为 `8d129f70c093a63b339543f65814232f3cfb6daa13d95168aac3b06bdc39ac28`，原档继续为 `007b6b41…`。

此处均为未提交工作树中、由具体文件 SHA 绑定的测试。capture 的2814不冒称含本次 updater/guard；最终全库验收仍由之后固定最终提交执行。

## 文件与复核方式

- `old-*.json.gz` / `new-*.json.gz`：完整初态、终态、每个 command 前后态、每场完整事件、ledger。性能计时仅为原始观测，不进入 golden/hash 比较。
- `diff-*.json.gz`：完整语义对齐与叶子差异，解压后 plain SHA 与 audit 逐项相符；审阅 plain 与保存 gzip 并非两份可分离答案。
- `audit.json`：旧/新精确来源、输入 SHA、固定已审 diff SHA、每份证据 SHA、候选 SHA、updater SHA、新 guard 测试 SHA。
- `deterministic-replay.json` / `apply.log`：应用前四条全路径重跑和原断言结果。
- `verify-driver-decisions.cjs` / `driver-decision-replay.log`：独立只读决策重放。
- `guard-tests.log`：精确旧字节、输入/版本漂移、未知嵌套字段、无因果的新命令、错误资源需求、候选变化等反例。
- `targeted-tests.log`：原 m5-route、m6-integration 与新增 guard 专项；以日志最终结果为准，既有 skip 不算通过。

原 updater 是绑定本次捕获环境的一次性工具：其 `NEW_COMMIT=2814d0146a3a109d8cef920034ba67d0cc571bf0` 是本地捕获提交。发布端记录的对应远端提交为 `50786a196cdff0762867e2918813a090df4fcac6`，二者 whole tree 应为 `4f982ed61cd6247c0d6a0033a156799e6c6d026f`，src tree 应为 `5f9b62228b236074efd78b50a571cc26d23858e5`。新远端 clone 没有2814对象时，原脚本会拒绝执行；不能把本记录误读成原脚本在新clone可直接运行。

无需 reset/rebase 即可在远端clone复核对应源：`git rev-parse 50786a196cdff0762867e2918813a090df4fcac6^{tree}`、`git rev-parse 50786a196cdff0762867e2918813a090df4fcac6:src` 应分别等于上述whole/src tree；`git show 50786a196cdff0762867e2918813a090df4fcac6:package-lock.json | sha256sum` 应为 `3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`。任一不符则停止，不能用任意新提交替代。已归档manifest仍可逐文件核hash，已归档driver决策复核脚本及原m5/m6测试也不依赖2814对象。

只有在具备原精确git对象、原golden和相同绑定输入的捕获环境中，才可用原updater `--capture /tmp/fresh-review`、`--audit /tmp/fresh-review` 重现。应用还必须提供所审audit的精确SHA。已迁移golden会触发旧字节guard拒绝再次覆盖，不能把脚本当自动刷新工具。若后续修复工具以支持精确等价的远端ref，须另存本次原脚本字节及SHA、生成新的独立audit，不覆盖本次已审记录，不重新apply已更新golden，也不伪造commit对象。

版本边界仍为 schema5/save1/replay1/protocol2，只有已经批准实现的 contentDigest 从 `c8a4b6d9` 到 `314b4c1f`。B8 原 skip、B9 的 30 战应用容量、浏览器尾部延期、所有性能/heap/bundle 门禁原样保留。本目录不证明完整浏览器输入路线、预算通过、外部审计通过或 B8 最终签收。
