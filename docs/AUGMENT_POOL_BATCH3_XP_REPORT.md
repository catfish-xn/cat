# 增幅池第三批：经验与玩家血量类强化（v23 candidate，2026-10-24）

分支 `claude/augment-xp-batch3`，基于 `claude/augment-pool-batch3`（d4dd9cfa）。名单取 [AUGMENT_POOL_BATCH3_REPORT](AUGMENT_POOL_BATCH3_REPORT.md) 中“要发经验或改买经验价格、按升级触发”的 6 条。来源同第三批：`augments-research-2026-10-23/data/augments-14.24.json`。未改战斗恢复相关文件，未重录、未改身份常量。

## 经验发放与恢复校验链

新文件 `src/simulation/augment-xp.ts`：

- 进入回合经验 `batch3EntryXp`：在离线 `nextRound`、联机 `advanceMultiplayerRound` 两处与每回合2点经验一起发，只从已拥有强化和已结算历史推导。
- 购买经验量 `xpPurchaseAmount`：`buyXp` 和 2D 买经验按钮都用它。
- 获得时等级 `augment-acquisition-levels`：选强化时写入本席公开机制状态，供按升级计数的强化使用；`validateBatch1Gifts` 校验键与已拥有强化一一对应、值不超过当前等级。
- 免费刷新：`freeRerollsGranted` 加上本批的次数，仍走第三批的免费刷新账本。
- 单机存档经验链（`serialization-structure.ts`）：备战起点加进入回合经验，购买增量按本回合单次购买量整除，并核对记录的获得等级。

口径（P）见 [S13_RULES_GAP](S13_RULES_GAP.md) 2026-10-24 条目。

## 已完成（5 条）

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 耐心学习 | `patient-study` | 金 | winxp=2, lossxp=3 | 每场玩家对战后，下一次进入回合时赢+2/输或平+3经验（P） |
| 新纪元 | `epoch` | 金 | XP=6, Rerolls=2 | 即刻6经验+2次免费刷新；之后每个阶段开始再给一份 |
| 新纪元+ | `epoch-plus` | 金 | XP=8, Rerolls=3 | 即刻8经验+3次免费刷新；之后每个阶段开始再给一份 |
| 升级咯！ | `level-up` | 彩 | InitialXP=12, XP=2 | 即刻12经验；每次买经验多给2点（4金得6经验） |
| 大买特买 | `shopping-spree` | 彩 | Gold=4, {a9ad6d1b}=8 | 即刻4金；获得后每升到 L 级给 L 次免费刷新（P，未用 {a9ad6d1b}） |

新纪元与新纪元+、大买特买与 DD街区 走 14.24 静态互斥。

## 第二轮：玩家血量恢复校验链（2026-10-24）

- 升级回血 `applyLevelUpHealth` 接在所有升级点：买经验、进入回合（开局遭遇之后）、获得强化的经验、单机与联机结算。
- 单机校验：`batch2HpAfterSettlement` 加结算升级回血，`batch2HpBeforeBattle` 加备战段升级回血，两段都从等级历史和获得等级推导；猴子遭遇的两处校验同样走这两段。
- 联机房间（`src/server/room/room.ts`）：房间血量账本允许两次结算之间的规则回血（只升不降），结算期望值加上结算升级回血；规则血量低于房间血量仍被拒绝。试跑 seed 5 整局时，持有上进心的座位曾在结算时报“rules HP 56 disagrees with the room HP 63 - 9”，就是这个问题，已修正；按代码推断，`crimson-pact`（底城争夺战）在联机两次结算之间回血原本也会触发同样的报错（未单独复现）。
- 弑君突刺：房间结算收据加 `opponentHp`（仅持有者），规则端校验它必须存在且在 0–100，金币按收据推导、恢复时逐项比对。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 上进心 | `upward-mobility` | 彩 | Health=2, Rerolls=3 | 买经验3金；获得后每升1级+2生命值（上限100）、+3次免费刷新 |
| 弑君突刺 | `kingslayer` | 银 | Gold=1, WinGold=1, WinBonusGold=4 | 即刻1金；赢玩家对战+1金，对手生命值高于自己时改+4金 |

同样依赖玩家血量、本轮没做的：
- 冒险举动（`TFT9_Augment_RiskyMoves`，银）：Health=20、PlayerCombatNum=7、Gold=30 齐。缺：生命值不高于20时选它是否致死（原文未说），以及获得时扣血与同回合升级回血/上限100的先后；扣血是血量链里唯一的中途减少，需要再拆一段校验。
- 幸存者（`TFT_Augment_Survivor`，银）：PlayersDead=3、Gold=60 齐；淘汰人数在房间里，本席状态没有，需要像对手血量一样由房间写进结算收据，属于另一类接线。

## 测试

- 新增 `tests/augment-pool-batch3-xp.test.ts`（第二轮后共 11 项）：名称/等级/描述/数值与研究 JSON 一致并入池、上进心不入池；静态互斥；进入回合经验的时点（阶段开始、获得前不算、PvE 不算、平局按输）；升级咯！公开选择后即刻12经验、买经验+6、存档恢复，伪造的4点增量被拒；新纪元经真实回合推进到下一阶段开始时再给6经验和2次刷新，每回合存档恢复；耐心学习经真实回合给经验并恢复；大买特买记录获得等级、连升两级给 (L+1)+(L+2) 次免费刷新、免费刷新不扣金，篡改/缺失获得等级被拒。
- 扩池（174 张）后按第三批做法只改：oracle 池表 `tests/fixtures/m5/oracle.g2.cjs`、`g2-augments-choice` 总数 169→174、`g2-augments-static` 的清单，`s13-augments-p2-choice` 两个种子 12900→2304、1939→53（顺序搜索所得，原断言不变）。
- 强化/商店/联机 29 个文件（含 `tp-shared-pool`、`shop`、`augment-preparation-room`、`shared-pool-room`、`economy-flow-1023`）全部通过；经验与房间相关 16 个文件除下条外通过；typecheck 通过。
- 基线已有失败：`carousel-room` 1 项、`g2-4b-pr161-restore` 与 `g2-4b-resists-restore` 各 1 项（d4dd9cfa 上同样失败）。扩池后这两个文件各多失败 1 项（pr161“伪造复制器收据”、resists“阵亡发放恢复”），pr161 已查实是固定种子 42 在 2-1 选到的强化从 `big-grab-bag` 变成 `visionary-crest`，后续单位编号随之变化；resists 一项同为固定种子路线断言（期望金额 489 实得 523），推断同因。两者都不是本批经验逻辑出错，同前几批一样留待 v23 集成统一处理。

第二轮补充：
- 新增上进心（买经验3金、连升两级精确+4血/+6刷新、之后经真实回合的升级、血量±2与获得等级篡改被拒、上限100与阵亡不回血）与弑君突刺（联机1/4金、输不给、缺/越界 `opponentHp` 与非持有者带该字段被拒、篡改/删除金币收据被拒；单机胜利1金、平局不给）测试。
- 扩池到 176 张后又改了种子：`g2-augments-combat` 爬梯子 774→656，`s13-augments-p2-choice` 2304→3762、53→3502（顺序搜索，原断言不变）；`g2-augments-choice` 总数 176。
- 56 个相关文件：失败的只有基线已有的 carousel-room 1 项、`local-room-client-full-match` 超时（d4dd9cfa 上同样超时），g2-4b 两个文件各 2 项（同上，种子路线），以及 `v17-avarice-pvp` 1 项：扩池后种子 42 的四个人类座位选到的强化全变了（都不是本批强化），压金后的金币样本不再改变战斗，属固定种子路线断言，留待 v23 集成。几个 5 秒超时的用例在并发跑时超时，单独重跑通过。
