# PR #177 加时固定目录查询审计（2026-10-18）

基线 `e863605c7b0de9fe81534d5fbae7e3cac7406c7b`。全仓搜索固定轮次选择器、阶段/类型/日程包装器、敌军投影和 `ROUND_CATALOG` 直接查询。以下行号以本次修复后的源码为准；表中保留的严格目录 API 直接接收 ordinal ≥39 或 `overtime-*` 时仍会拒绝，不表示正常联机流程必然调用它们。

| 调用点 | ordinal ≥39 的行为与处理 |
| --- | --- |
| `strategy-snapshot.ts` 赛恩属性编译（原 137 行） | **已修复**：复用原支援装/神器的阶段查询 `strategyStage`，加时读第 7 阶段；赛恩仍使用原五项成长表及 `min(4, stage-2)` 封顶。未改成长值、版本或伤害阶段。 |
| `carousel-units.ts:26` `validateCarouselMetadata` 的 `fact.roundId` | **已修复**：延迟选秀处理可在加时写入 `carousel-preparation-settled`；联机事实轮次改读 `getMultiplayerRoundById`。选秀出生轮次仍严格读目录，离线分支仍严格，重复/非法边界仍拒绝。此校验由共享池守恒检查调用。 |
| `round-selectors.ts:8,15,22–24` | 三个目录选择器是严格目录底层；故意不扩展。联机选择器已经分流 ordinal >38 和 `overtime-*`。 |
| `round-schedule.ts:19,21,23` | `getStageRound/getRoundKind/getRoundSchedule` 均会抛 `RangeError`；它们定义离线目录，不修改。 |
| `round-enemies.ts:15,18,22,31,33,46–47,63` | 成长校验、模板、敌军生成/装备和缓存投影均限目录。双边战斗分别以自己的 `player` 编译，再镜像，故不调用加时固定敌军。不能为联机凭空生成目录敌军。 |
| `strategy-snapshot.ts:71,123`、`strategy-g2-2.ts:14`、`item-selectors.ts:37` | 有 `enemy` 单位才读取固定敌军装备/投影，传 39 会抛。正常联机 Match 只持本席玩家单位；双边编译也在镜像前完成。保留这些离线敌军路径。 |
| `combat-input.ts:81,113` | `restoreCombatInput` 查不到目录轮次即拒绝，后续敌军投影也严格；这是离线冻结输入恢复，线上使用 `restoreBattleInput`。 |
| `serialization-structure.ts:128,162,167,193,195,209,212,228,262` | 当前轮、日程、历史目录校验直接输入 39 会拒绝；入口 118 行先以 `multiplayer-state` 拒绝联机/共享池/选秀状态，不放宽离线恢复。 |
| `resource-provenance.ts:191,201,203,223,251,281,305,341,419,447` | 出生收据（选秀、日程、PvE、机制）、折叠边界、奖励战斗、事实轮次、选秀顺序及光明转化比较的固定目录查询。它们属于离线资源证明；`foldResourceProvenance` 在 281 行先拒绝超目录边界。正常联机追加事实已使用联机选择器（132–133 行），共享池使用独立持有账本。保留严格折叠，避免扩大恢复协议。 |
| `g2-3-grant-evidence.ts:44–45` | 资源前缀轮次比较，接收加时事实会抛；仅被 `b8-restore` 的离线证明调用，依赖上行严格折叠。 |
| `b8-restore.ts:165,183` | 装备/消耗品历史边界轮次查询；仅离线恢复调用，保留。 |
| `consumables.ts:119` | 消耗品授予/使用轮次比较输入加时会抛；`validateConsumableState` 仅由离线 `b8-restore` 调用。线上 `useConsumable` 不调用该恢复器，仍通过原计划和溯源追加。 |
| `opening-economy.ts:37,64` | 两个目录经济规划入口直接输入加时会抛。生产统一入口 `round-economy.ts:9` 已按 FINAL_ROUND 分流至加时规划，保留目录契约。 |
| `match.ts:109,118,122,137,147,410,413,520,617,633` | 异常招募/日程入口已有加时保护；事件循环在加时为空。147 行目录准备、410/413 行 `nextRound` 仅用于目录，联机推进在 435 行分流。520 行仅在异常招募成立时进入；617/633 行普通选择路径在机制选择完成分支之后，正常加时弹窗不进入。不能把普通目录选择扩展到加时。 |
| `round-settlement.ts:83`、`two-sided-snapshot.ts:120`、`seat-mechanics/choices.ts:59` | 分别已有 FINAL_ROUND 保护、联机/离线选择器分流，不存在未保护的加时固定目录调用。 |
| `carousel.ts:123`、`carousel-units.ts:26,64` 的选秀出生轮次 | 固定选秀只在 `1-1`/目录补给轮发生；创建入口在 112 行先拒绝 `overtime-*`，查询收据出生轮次是有意验证，加时只可能处理旧收据。 |
| `temporary-equipment.ts:52–53`、`orb-layout.ts:108,115`、`loot-freeze.ts:54`、`loot-runtime.ts:29–37` | 类似目录边界：离线装备恢复会拒绝 39；野怪布局/掉落冻结越界会抛或返回失败。共享池推进已 `min(targetRound, FINAL_ROUND)`，加时 Match 沿用最后 PvE 冻结账本，不生成新野怪掉落。 |

`src/server/`、`src/rendering/`、其他展示模块和脚本也已搜索；没有发现直接按加时当前轮调用上述目录选择器的新位置。固定样本生成器、目录循环、内容编译与测试中的刻意越界断言不作为线上缺陷修改。以上保留项不新增加时离线保存能力。

回归证据：

- `tests/mp-overtime-production.test.ts`：同一黑玫瑰三人阵容在 37 与经公共推进进入 39 后，双边各编译一个赛恩；成长封顶一致。
- 同文件另一用例从 `createMatch(42)` 起只调用生产公共命令，不补写历史、机制进度或战斗结果。PvE 真实编译/运行；PvP 使用快照、`compileBattle`、`resolveTwoSidedBattle`、`proposeSettlement`，把原提案字段映射为收据再提交。6-5 以正常金币/商店购买并上场兰博，三场后在加时打开军械库，选择免费备件，再对真实守军运行加时战斗、结算、验证去重并进入 40。默认 5 秒时限。
- 保留 `tests/mp-overtime-choices.test.ts` 的快速黑市选择/超时事务用例。
- `tests/g2-4b-artifacts.test.ts`：月石护盾在 38 为 280，在 39/43 为 325，能够区分第 6/7 阶段。
- `tests/p7-1-carousel-rules.test.ts`：过期选秀在加时消费后元数据合法，重复处理不再写收据，同轮边界及非法加时 ID 仍拒绝。

没有修改测试时限、筛除测试、放宽校验、调整内容数值或升版本；`src/server/` 与 `src/rendering/` 未改动。指纹按用户指定三步更新，旧 `g2-augments-herald-raw` 必须与 `origin/multiplayer` 逐文件一致。

验收结果：上述四个回归文件，加 `g2-4b-support-items`、`t2-two-sided-battle`、`t5r-overtime`、`m8-b6-round-catalog`，共 8 文件 131 条，以 `--no-file-parallelism --reporter=verbose` 串行全过，总耗时 12.13 秒；自然加时用例单次 1.273 秒。三步记录/校验全部成功；Herald 仅 `sourceSha256/sources` 改变，5 份原始样本字节、内容 digest、版本均未变；旧 augments Herald 7 文件的名称集合和 Git blob hash 与 `origin/multiplayer` 完全一致。
