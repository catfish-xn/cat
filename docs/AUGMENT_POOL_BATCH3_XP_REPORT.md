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
- 联机房间（`src/server/room/room.ts`）：房间血量账本 `seat.hp` 在每次发布时按来源同步（`src/simulation/player-hp.ts` 的 `explainedHp`：上进心升级回血、底城争夺战跳过黑市的选择收据），解释不了的血量变化直接让房间报错终止；结算时恢复以账本为起点的严格相等，只加结算记录里的升级回血。试跑 seed 5 整局时，持有上进心的座位曾在结算时报“rules HP 56 disagrees with the room HP 63 - 9”，就是账本不跟随回血造成的，现已修正，SeatPublic 显示的血量也随之及时更新。（500b866f 里先用过“取房间与规则血量较大者”的修法，评审指出等于放松校验，已在后续提交替换。）
- 弑君突刺：房间结算收据加 `opponentHp`（仅持有者），规则端校验它必须存在且在 0–100，金币按收据推导、恢复时逐项比对。没有升 `ROUND_SETTLEMENT_VERSION`：字段可选且只在持有者的收据里出现，现有收据和录制都不变；收据字段只在 `applyRoundSettlement` 校验，`g2-3` 恢复只比对 `g23Facts`，单机恢复走 `validateBatch1Gifts` 的金币比对，联机座位恢复（`restoreSharedOrbSnapshot`）本来就不校验强化发放。

| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 上进心 | `upward-mobility` | 彩 | Health=2, Rerolls=3 | 买经验3金；获得后每升1级+2生命值（上限100）、+3次免费刷新 |
| 弑君突刺 | `kingslayer` | 银 | Gold=1, WinGold=1, WinBonusGold=4 | 即刻1金；赢玩家对战+1金，对手生命值高于自己时改+4金 |

同样依赖玩家血量、本轮没做的：
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

第三轮（评审 must-fix）：
- 新增 `tests/server/room-hp-ledger.test.ts` 3 项：经房间买经验触发上进心升级，账本与规则同为52、每次扣3金，之后一整轮结算不报错；无来源的血量变化让房间以 invalid-results 终止且账本不动；`explainedHp` 对底城争夺战只认新增的跳过收据、对等级只认上进心、上限100。
- 相关 30 个文件：除基线已有的 carousel-room 1 项和种子路线的 v17-avarice 1 项外全部通过；并发时超时的 battle-start-slices、pairing-room、projection-wire 与弑君突刺单机用例单独重跑通过。

第四轮（评审非阻塞建议）：`commitSeat` 返回是否已发布，座位命令（`apply`、机器人领球）在房间因无来源血量终止时向调用方返回 `room-phase` 失败而不是 ok，超时与选择截止路径也随之停止。`room-hp-ledger` 增至 5 项：规则血量无来源上升/下降都以 invalid-results 终止并通知订阅者、账本不动；命令结果里带无来源回血时调用方收到失败。

第五轮（冒险举动，协调者按推荐授权口径）：
| 中文名 | 内部 id | 等级 | 14.24 数值 | 行为 |
|---|---|---|---|---|
| 冒险举动 | `risky-moves` | 银 | Health=20, PlayerCombatNum=7, Gold=30 | 选取即扣20血（最低留1）；获得起第7场玩家对战结算时给30金 |

- 扣血在 `selectChoice` 里接在升级回血之后；单机“战斗前血量”按获得时等级拆成“获得前升级回血 → 扣血 → 黑市与之后的升级回血”三步（`batch2HpBeforeBattle`）；房间 `explainedHp` 把新选的冒险举动算作来源。
- 30金与弑君突刺同在 `src/simulation/augment-settlement-gold.ts`（原 augment-kingslayer.ts 改名），结算时发、恢复时逐项比对。
- 测试：选取后血量正好少20、存档恢复，血量±1或原血量、删掉获得等级都被拒；最低留1、0血不扣；6场不给、第7场给30（PvE 不计）、只给一次；与上进心同回合时“进入回合回血到100封顶→扣20→再回2=82”（合并算会得83）；房间账：选冒险举动降20放行并同步，降21报错终止。
- 卡池 177 张：爬梯子种子 656 仍可用；`g2-augments-combat` 的 blistering-strikes 种子 0→681（顺序搜索）；oracle 池表与总数同步。相关 37 个文件全部通过。

第六轮（用户指正：部分强化只在特定阶段出现）：
- 14.24 ItemTags 的 `{d02ae323}`/`{d12ae4b6}`/`{d22ae649}` 读作“不在 2-1/3-2/4-2 出现”（P，依据见 S13_RULES_GAP）。本批 8 条的出现轮次写进内容表 `nodes`，生成 `AUGMENT_BATCH3_XP_NODE_BANS` 并入 `AUGMENT_OFFER_RULES.nodeBans`：

| 强化 | 可出现 |
|---|---|
| 耐心学习、新纪元、升级咯！、大买特买、冒险举动 | 只在 2-1 |
| 新纪元+ | 只在 3-2 |
| 弑君突刺 | 2-1、3-2 |
| 上进心 | 三轮都可 |

- 测试：各条 `nodes` 与研究 JSON 标签逐条一致，并对三个节点用 `augmentOfferAllowed` 断言；同一读法复现黑色玫瑰只禁 2-1。独立 oracle 池表同步写入同样的阶段禁令。
- 受影响的旧测试：`g2-augments-choice` 的“2-1 公开选取”列表排除新纪元+（与黑色玫瑰同理）；`augment-offer-rules-v22` 的 3-2/4-2 金色候选数减去阶段禁用数，跨玩家用例种子 10→14；`s13-augments-p2-choice` 冠冕链种子 3762→9844。相关 36 个文件通过（Silver Spoon 一项并发超时，单独重跑通过）。
- 其他批次的强化同样带这些标签，见第七轮（已全量套用）。

## 第七轮：全量套用 14.24 阶段标签（单独提交）

- 依据：14.24 map22 ItemTags 的 `{d02ae323}`/`{d12ae4b6}`/`{d22ae649}` 读作“不在 2-1/3-2/4-2 出现”（推断，原字符串未取得），并经跨版本交叉印证：对默认 312 条，304 条与 S13 归档一致，不一致的 8 条中 7 条是 13.4/13.8 的官方后续调整（perf-1022/augment-pool/missing-values-triage-2026-10-24.md 第四节；数据 `augment-crossversion-research-2026-10-24/excerpts/stages/14.24-active-augment-tags-with-s13-crosscheck.json`）。`{4529fead}` 不当阶段标签。
- 实现：`src/simulation/content/augment-stage-bans.ts`（134 张，apiName → 不出现的轮次，由研究 JSON 一次性生成）并入 `AUGMENT_OFFER_RULES.nodeBans`；规则清单加 `augmentStageBans`，出牌在重放和恢复时按同一张表推导。独立 oracle（`tests/fixtures/m5/oracle.g2.cjs`）按 id 另写一份同样的禁令。
- `{4529fead}` 线索的结论：与标签读法不矛盾。它出现在 5 条上，冒险举动、银汤匙、不计代价按三个阶段标签本来就只在 2-1；上进心、挖角不带阶段标签，按 14.24 三轮都可。若把 `{4529fead}` 当作“只在 2-1”，只会额外改这两条，没有其他证据支持，不采用。
- 与 S13 归档不同的池内强化只有玻璃大炮 I/II（标签允许 2-1，归档不在 2-1，属 13.x 后调整），按 14.24 标签。战斗伤疤三轮都不出，与归档一致。餐桌剩菜不在池内，按 14.24 不出现（P，已记入 S13_RULES_GAP）。

接入第三批：`claude/augment-pool-batch3`（7b863dad）已基于本线 206dbbda，按快进接入、保留其历史；本轮改动作为一个提交放在它之后。合入后卡池 206 张，134 张带阶段限制；第三批自带的 49 条 `AUGMENT_BATCH3_NODE_BANS` 与本表逐条一致，两张表一并并入 nodeBans。

测试（只改选取轮次与种子；规则本身变了的断言按新规则改，逐条列在下面）：
- 新增 `tests/augment-stage-helpers.ts`：`offeredAt`、带上限的 `firstNodeSeed`、`STAGE_SEEDS`（66 张不在 2-1 出现的强化在其首个可出现轮次的种子，顺序搜索所得）、`offerFor`/`acquireAugment`；`tests/match-helpers.ts` 加 `fieldBench`/`reachRoundFielded`（空阵容会在 4-2 前被打死，4-2 才出的强化和 3-2 需羁绊的强化用上阵路线）。
- 没有上限的种子搜索都加了上限：`opening-encounters-trainer-golems`、`v19-part2`（2 处）；第三批测试改用其自带的带上限 `publicPick`（之前 `while(!offers.includes(id))seed++` 在 `rolling-for-days-i`、`corrosion` 不在 2-1 后无限循环，整套测试因此卡住）。
- 改为在首个可出现轮次选取：`augment-pool-batch1`（`final-polish`、`raining-gold-plus`）、`augment-pool-batch2`（`rocket-collection-plus`、`betrayal` 等）、`augment-pool-tactician-items`（`coronation`）、`s13-augments-p2-choice`（各 overflow、`trifecta-ii`，只核对本次选择的赠品；`trifecta-ii` 送娜美改为 3-2 种子 320）、`augment-tier-table`（`geniuses` 在 4-2）、`augment-pool-batch3`（`call-to-chaos` 用共用种子表）。
- 规则变了而改的断言：`augment-pool-batch2` 的羁绊过滤断言改为在可出现的轮次检查，被阶段禁用的轮次即使有羁绊也不出；`augment-offer-rules-v22` 的“3-2 有执法官时出 mentorship/reunion/sisters”改为只在可出现轮次出现（三者只在 4-2），2-1 不出任何羁绊强化，金色候选数改为按“非羁绊、非英雄、可出现”计算；`augment-tier-table` 的“`geniuses` 在彩色池可出”改为 4-2 带羁绊时可出、2-1 不出；`g2-augments-choice` 的 2-1 公开选取只覆盖 2-1 可出现的强化；`augment-card-reroll` 的最后一张候选按 2-1 过滤计算；`d11-wiring-online` 的联机发放用例去掉 `trifecta-i`（只在 3-2/4-2，2-1 联机夹具无法选到），同一路线由 `all-for-one-i` 覆盖；`augment-pool-batch2` 的公开选取不再覆盖 `watcher-growth`（从不出现）；`rules-placebo-stage` 的公开选取只测 `placebo` 2-1、`placebo-plus` 3-2（其余阶段金额仍由单元断言覆盖）；`p7-carousel` 的卡池持有数只数商店卡池弈子（`gold-for-dummies` 的训练假人不占卡池）；`g2-4b-pr161-restore` 的冠冕物品编号 item-24→item-23（该路线 3-2/4-2 改选 `betrayal`/`quickstriker-boost`，之前少一次物品产出）。
- 只换种子：`g2-augments-combat`（`blistering-strikes` 601、`lone-hero` 688、`climb-the-ladder-i` 3-2 种子 61）、`s13-augments-p2-choice` 冠冕链 7806、`black-market-single-offer` 9→0、`match-session` 7216→7226、`restore-audit/cd-replay-facts`（roster 5→6，Experiment/鹰眼路线 1→2）、`opening-encounters-batch-a`（2-1 三张都发装备，用免费卡牌刷新换到不发装备的强化）、`s13-p1-multiplayer-income` 搜索上限 400→3000、`task-mechanism-restore` 的 `bulky-buddies-i` 路线 22→100、`s13-p1-dual-wielding` 路线 23→26、`mp-overtime-production` 42→43。
- 对照：按文件、带超时跑 138 个涉及出牌或种子路线的测试文件；与第三批 7b863dad 同文件逐项对照，本提交新增的失败已全部修掉。仍失败、未掩盖的都是对照基线上已有的：`m8-b8-live-capacity`、`m8-b8-live-transfer`、`m8-b8-loot-view`（基线已在独立金币账本前置检查失败，本提交后在独立弈子编号账本处失败，独立账本不认第一批/第三批赠弈子，属同一类旧问题）、carousel-room 1 项、g2-4b 两个文件、v17-avarice-pvp、task-mechanism-restore 召唤物两项，以及第三批测试里基线已有的失败项。
- 转给其他线的缺陷：`blistering-strikes` 在第三批接入前的种子 16、648 路线上战斗中途恢复报 `Invalid status contribution`（战斗恢复线）；`worth-the-wait` 选秀回合发弈子的问题第三批已在 0f193f5f 修掉，接入后不再出现。

### 出现阶段一览表（206 张，来源：14.24 哈希标签推导 + S13 归档交叉印证）

| 中文名 | 内部 id | 等级 | 可出现轮次 | S13 归档对照 |
|---|---|---|---|---|
| C位的觉悟 | `find-your-center` | 银 | 3-2、4-2 | 一致 |
| D个痛快！ I | `rolling-for-days-i` | 银 | 3-2、4-2 | 一致 |
| 一二二三 | `ones-twos-three` | 银 | 2-1 | 一致 |
| 一费奉献 I | `all-for-one-i` | 银 | 2-1 | 一致 |
| 一，二，五！ | `one-two-five` | 银 | 4-2 | 一致 |
| 以眼还眼 | `eye-for-an-eye` | 银 | 2-1 | 一致 |
| 以眼还眼+ | `eye-for-an-eye-plus` | 银 | 3-2 | 一致 |
| 休眠锻炉 | `latent-forge` | 银 | 2-1 | 一致 |
| 假人化 | `dummify` | 银 | 3-2 | 一致 |
| 健康就是财富 I | `wealthy-rehab-i` | 银 | 3-2、4-2 | 一致 |
| 冒险举动 | `risky-moves` | 银 | 2-1 | 一致 |
| 刀锋之舞 | `blade-dance` | 银 | 2-1 | 一致 |
| 列队 | `lineup` | 银 | 3-2、4-2 | 一致 |
| 别再错过 | `missed-connections` | 银 | 3-2、4-2 | 一致 |
| 后援 | `backup` | 银 | 3-2、4-2 | 一致 |
| 团队建设 | `team-building` | 银 | 2-1、3-2 | 一致 |
| 孤胆英雄 | `lone-hero` | 银 | 2-1、3-2、4-2 | 一致 |
| 安慰剂 | `placebo` | 银 | 2-1 | 一致 |
| 安慰剂+ | `placebo-plus` | 银 | 3-2 | 一致 |
| 导师制 I | `mentorship-i` | 银 | 2-1、3-2、4-2 | 一致 |
| 巨大伙伴 I | `bulky-buddies-i` | 银 | 2-1、3-2、4-2 | 一致 |
| 弑君突刺 | `kingslayer` | 银 | 2-1、3-2 | 一致 |
| 成群结队 I | `teaming-up-i` | 银 | 3-2、4-2 | 一致 |
| 战争财宝 I | `spoils-of-war-i` | 银 | 2-1 | 一致 |
| 战地医生 | `field-medic` | 银 | 2-1 | 一致 |
| 打气 I | `pumping-up-i` | 银 | 2-1 | 一致 |
| 攀登天梯 I | `climb-the-ladder-i` | 银 | 3-2、4-2 | 一致 |
| 法力流 I | `manaflow-i` | 银 | 3-2、4-2 | 一致 |
| 玻璃大炮 I | `glass-cannon-i` | 银 | 2-1、3-2、4-2 | 归档：3-2、4-2 |
| 百宝袋 I | `item-grab-bag-i` | 银 | 2-1、3-2、4-2 | 一致 |
| 窃贼帮派 I | `band-of-thieves-i` | 银 | 2-1、3-2、4-2 | 一致 |
| 腐蚀 | `corrosion` | 银 | 3-2、4-2 | 一致 |
| 节外生枝 | `branching-out` | 银 | 2-1、3-2 | 一致 |
| 装备收集器 I | `item-collector-i` | 银 | 3-2、4-2 | 一致 |
| 超级巨星 I | `superstars-i` | 银 | 2-1 | 一致 |
| 辅助挖矿 | `support-mining` | 银 | 2-1 | 一致 |
| 辅助挖矿+ | `support-mining-plus` | 银 | 3-2 | 一致 |
| 酷热打击 | `blistering-strikes` | 银 | 2-1、3-2、4-2 | 一致 |
| 银汤匙 | `silver-spoon` | 银 | 2-1 | 一致 |
| 震惊巨魔 | `shocking-troll` | 银 | 2-1 | 一致 |
| 黑铁资产 | `iron-assets` | 银 | 2-1 | 一致 |
| DD街区 | `trade-sector` | 金 | 2-1 | 一致 |
| 一对4 | `pair-of-fours` | 金 | 4-2 | 一致 |
| 一费奉献 II | `all-for-one-ii` | 金 | 2-1 | 一致 |
| 三项赛 I | `trifecta-i` | 金 | 3-2、4-2 | 一致 |
| 不是今天 | `not-today` | 金 | 2-1、3-2、4-2 | 一致 |
| 两把刷子 | `two-trick` | 金 | 2-1 | 一致 |
| 伏击专家之徽 | `ambusher-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 便携锻炉 | `portable-forge` | 金 | 2-1、3-2、4-2 | 一致 |
| 值得等待 | `worth-the-wait` | 金 | 2-1 | 一致 |
| 假人金币 | `gold-for-dummies` | 金 | 2-1 | 一致 |
| 健康就是财富 II | `wealthy-rehab-ii` | 金 | 3-2、4-2 | 一致 |
| 先知之徽 | `visionary-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 冕已有卫 | `crown-guarded` | 金 | 2-1、3-2 | 一致 |
| 卓尔不群 | `built-different` | 金 | 2-1 | 一致 |
| 卯足全力 | `all-out` | 金 | 2-1 | 一致 |
| 厄运保护 | `bad-luck-protection` | 金 | 3-2、4-2 | 一致 |
| 双排 | `duo-queue` | 金 | 4-2 | 一致 |
| 发条增速器 | `clockwork-accelerator` | 金 | 2-1、3-2、4-2 | 一致 |
| 哨兵之徽 | `sentinel-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 嗜火 | `pyromaniac` | 金 | 2-1、3-2 | 一致 |
| 在失败中变强 | `what-doesnt-kill-you` | 金 | 2-1 | 一致 |
| 塔防游戏 | `tower-defense` | 金 | 2-1、3-2 | 一致 |
| 大百宝袋 | `big-grab-bag` | 金 | 3-2、4-2 | 一致 |
| 天降金币 | `raining-gold` | 金 | 2-1 | 一致 |
| 天降金币+ | `raining-gold-plus` | 金 | 3-2 | 一致 |
| 奥术之惩 | `sorcerer-explosion` | 金 | 2-1、3-2、4-2 | 一致 |
| 家人之徽 | `family-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 导师制 II | `mentorship-ii` | 金 | 2-1、3-2、4-2 | 一致 |
| 小伙伴 | `little-buddies` | 金 | 3-2、4-2 | 一致 |
| 巨大伙伴 II | `bulky-buddies-ii` | 金 | 3-2、4-2 | 一致 |
| 底城争夺战 | `crimson-pact` | 金 | 2-1、3-2 | 一致 |
| 强力重击 | `heavy-hitters` | 金 | 2-1、3-2、4-2 | 一致 |
| 征战之路 | `warpath` | 金 | 2-1 | 一致 |
| 成群结队 II | `teaming-up-ii` | 金 | 4-2 | 一致 |
| 战争财宝 II | `spoils-of-war-ii` | 金 | 2-1 | 一致 |
| 战斗伤疤 | `watcher-growth` | 金 | 三轮都不出 | 一致 |
| 打气 II | `pumping-up-ii` | 金 | 2-1 | 一致 |
| 执法 | `enforce` | 金 | 2-1、3-2 | 一致 |
| 执法官之徽 | `enforcer-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 投资策略 I | `investment-strategy-i` | 金 | 2-1 | 一致 |
| 护盾猛击 | `sentinel-slam` | 金 | 2-1、3-2、4-2 | 一致 |
| 搏击手之徽 | `pit-fighter-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 攀登天梯 II | `climb-the-ladder-ii` | 金 | 3-2、4-2 | 一致 |
| 新纪元 | `epoch` | 金 | 2-1 | 一致 |
| 新纪元+ | `epoch-plus` | 金 | 3-2 | 一致 |
| 替罪羊 | `scapegoat` | 金 | 2-1 | 一致 |
| 权杖意志 | `guardbreaker-spirit` | 金 | 2-1、3-2、4-2 | 一致 |
| 极客之徽 | `scrap-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 极客宝藏之顶 | `scrap-recycling` | 金 | 2-1 | 一致 |
| 格斗家之徽 | `bruiser-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 棘刺镀板铠甲 | `thorn-plated-armor` | 金 | 2-1、3-2 | 一致 |
| 欢迎来到游乐场 | `welcome-to-the-playground` | 金 | 2-1、3-2 | 一致 |
| 残暴复仇 | `savage-revenge` | 金 | 3-2 | 一致 |
| 法力流 II | `manaflow-ii` | 金 | 3-2、4-2 | 一致 |
| 法师之徽 | `sorcerer-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 海克斯机械之徽 | `automata-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 漫游训练师 I | `wandering-trainer-i` | 金 | 2-1 | 一致 |
| 激昂墓志铭 | `inspiring-epitaph` | 金 | 2-1、3-2、4-2 | 一致 |
| 火箭收藏 | `rocket-collection` | 金 | 2-1 | 一致 |
| 火箭收藏+ | `rocket-collection-plus` | 金 | 3-2 | 一致 |
| 灵魂连接 | `spirit-link` | 金 | 2-1、3-2、4-2 | 一致 |
| 炮手之徽 | `artillerist-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 炼金男爵之徽 | `chem-baron-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 炽热灵魂 I | `blazing-soul-i` | 金 | 3-2、4-2 | 一致 |
| 狙神之徽 | `sniper-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 王冠意志 | `crownguard-spirit` | 金 | 2-1、3-2、4-2 | 一致 |
| 玻璃大炮 II | `glass-cannon-ii` | 金 | 2-1、3-2、4-2 | 归档：3-2、4-2 |
| 皮城学院之徽 | `academy-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 监察之徽 | `watcher-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 硬化护盾 | `defense-call` | 金 | 3-2、4-2 | 一致 |
| 碎裂水晶 | `fractured-crystals` | 金 | 2-1、3-2、4-2 | 一致 |
| 终身黄铜 I | `bronze-for-life-i` | 金 | 3-2、4-2 | 一致 |
| 统领之徽 | `dominator-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 统领全场 | `dominate` | 金 | 2-1、3-2、4-2 | 一致 |
| 羁绊：军事管制 | `mentorship` | 金 | 4-2 | 一致 |
| 羁绊：危险人物 | `menaces` | 金 | 3-2 | 一致 |
| 羁绊：姐妹 | `sisters` | 金 | 4-2 | 一致 |
| 羁绊：意外搭档 | `unlikely-duo` | 金 | 4-2 | 一致 |
| 羁绊：背叛 | `betrayal` | 金 | 3-2 | 一致 |
| 羁绊：重新联合 | `reunion` | 金 | 4-2 | 一致 |
| 耐心学习 | `patient-study` | 金 | 2-1 | 一致 |
| 肾上腺爆发 | `quickstriker-boost` | 金 | 2-1、3-2、4-2 | 一致 |
| 英勇福袋 | `heroic-grab-bag` | 金 | 2-1、3-2、4-2 | 一致 |
| 蓝发小队之徽 | `rebel-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 血色契约 | `blood-pact` | 金 | 2-1 | 一致 |
| 装备收集器 II | `item-collector-ii` | 金 | 3-2、4-2 | 一致 |
| 训练篇 | `pit-fighter-prizefighter` | 金 | 2-1 | 一致 |
| 试验品之徽 | `experiment-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 诺克萨斯断头台 | `noxian-guillotine` | 金 | 2-1、3-2、4-2 | 一致 |
| 赏金战士 | `prizefighter` | 金 | 2-1 | 一致 |
| 超级巨星 II | `superstars-ii` | 金 | 2-1 | 一致 |
| 辅助宝库 | `support-cache` | 金 | 2-1、3-2、4-2 | 一致 |
| 迅击战士之徽 | `quickstriker-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 透体莲花 I | `piercing-lotus-i` | 金 | 3-2、4-2 | 一致 |
| 释放野兽 | `unleash-the-beast` | 金 | 2-1、3-2 | 一致 |
| 野火帮之徽 | `firelight-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 铁血征服者之徽 | `conqueror-crest` | 金 | 2-1、3-2、4-2 | 一致 |
| 长矛意志 | `shojin-spirit` | 金 | 2-1、3-2、4-2 | 一致 |
| 高压电 | `high-voltage` | 金 | 2-1、3-2 | 一致 |
| 高贵牺牲 | `noble-sacrifice` | 金 | 3-2、4-2 | 一致 |
| 魔像化 | `golemify` | 金 | 3-2 | 一致 |
| 魔法投掷 | `magic-roll` | 金 | 3-2 | 一致 |
| 黑色玫瑰之徽 | `black-rose-crest` | 金 | 3-2、4-2 | 一致 |
| 1个霸符，2个霸符 | `one-buff-two-buff` | 彩 | 3-2、4-2 | 一致 |
| 三项赛 II | `trifecta-ii` | 彩 | 3-2、4-2 | 一致 |
| 上进心 | `upward-mobility` | 彩 | 2-1、3-2、4-2 | 一致 |
| 不可撼动之物 | `immovable-object` | 彩 | 2-1、3-2、4-2 | 一致 |
| 伏击专家之冕 | `ambusher-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 值得等待 II | `worth-the-wait-ii` | 彩 | 2-1 | 一致 |
| 先知之冕 | `visionary-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 光明圣物 | `radiant-relics` | 彩 | 2-1、3-2、4-2 | 一致 |
| 光明重构器 | `radiant-refactor` | 彩 | 3-2、4-2 | 一致 |
| 加冕礼 | `coronation` | 彩 | 3-2、4-2 | 一致 |
| 升级咯！ | `level-up` | 彩 | 2-1 | 一致 |
| 哨兵之冕 | `sentinel-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 大买特买 | `shopping-spree` | 彩 | 2-1 | 一致 |
| 大剑溢流 | `sword-overflow` | 彩 | 3-2、4-2 | 一致 |
| 家人之冕 | `family-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 对冲基金 | `hedge-fund` | 彩 | 2-1 | 一致 |
| 崇高冒险 | `an-exalted-adventure` | 彩 | 2-1 | 一致 |
| 巨大伙伴 III | `bulky-buddies-iii` | 彩 | 3-2、4-2 | 一致 |
| 成吨的伤害 | `phreaky-friday` | 彩 | 2-1 | 一致 |
| 成吨的伤害+ | `phreaky-friday-plus` | 彩 | 3-2、4-2 | 一致 |
| 战争财宝 III | `spoils-of-war-iii` | 彩 | 2-1 | 一致 |
| 打气 III | `pumping-up-iii` | 彩 | 2-1 | 一致 |
| 执法官之冕 | `enforcer-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 投资策略 II | `investment-strategy-ii` | 彩 | 2-1 | 一致 |
| 搏击手之冕 | `pit-fighter-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 暗巷交易 | `dark-alley-dealings` | 彩 | 3-2 | 一致 |
| 最终润色 | `final-polish` | 彩 | 4-2 | 一致 |
| 来个好伙计！ | `build-a-bud` | 彩 | 2-1 | 一致 |
| 极客之冕 | `scrap-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 格斗家之冕 | `bruiser-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 法师之冕 | `sorcerer-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 法杖溢流 | `wand-overflow` | 彩 | 3-2、4-2 | 一致 |
| 活体锻炉 | `living-forge` | 彩 | 2-1 | 一致 |
| 海克斯机械之冕 | `automata-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 混沌召唤 | `call-to-chaos` | 彩 | 4-2 | 一致 |
| 漫游训练师 II | `wandering-trainer-ii` | 彩 | 2-1 | 一致 |
| 灵活摇摆 | `flexible` | 彩 | 2-1 | 一致 |
| 炫目之速 | `blinding-speed` | 彩 | 3-2、4-2 | 一致 |
| 炮手之冕 | `artillerist-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 炼金男爵之冕 | `chem-baron-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 炽热灵魂 II | `blazing-soul-ii` | 彩 | 3-2、4-2 | 一致 |
| 狙神之冕 | `sniper-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 珍藏财宝 III | `building-a-collection-iii` | 彩 | 2-1、3-2 | 一致 |
| 皮城学院之冕 | `academy-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 监察之冕 | `watcher-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 精心赋能 | `calculated-enhancement` | 彩 | 3-2、4-2 | 一致 |
| 终身黄铜 II | `bronze-for-life-ii` | 彩 | 3-2、4-2 | 一致 |
| 统领之冕 | `dominator-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 羁绊：天才 | `geniuses` | 彩 | 4-2 | 一致 |
| 腰带溢流 | `belt-overflow` | 彩 | 3-2、4-2 | 一致 |
| 蓝发小队之冕 | `rebel-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 试验品之冕 | `experiment-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 迅击战士之冕 | `quickstriker-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 连串打击 | `flurry-of-blows` | 彩 | 2-1、3-2、4-2 | 一致 |
| 透体莲花 II | `piercing-lotus-ii` | 彩 | 3-2、4-2 | 一致 |
| 遥遥领先 | `going-long` | 彩 | 2-1 | 一致 |
| 野火帮之冕 | `firelight-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 金蛋 | `the-golden-egg` | 彩 | 4-2 | 一致 |
| 金鳞精粹 | `shimmerscale-essence` | 彩 | 2-1 | 一致 |
| 铁血征服者之冕 | `conqueror-crown` | 彩 | 2-1、3-2、4-2 | 一致 |
| 锅铲厨房 | `tacticians-kitchen` | 彩 | 2-1 | 一致 |
| 黑色玫瑰之冕 | `black-rose-crown` | 彩 | 3-2、4-2 | 一致 |
