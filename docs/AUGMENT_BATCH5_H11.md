# B5-76／B5-79 实现与验收

基线 `codex/v25-h11`，HEAD `62ff4fce`；在上一轮未提交草稿上完成。规则依据为 `AUGMENT_BATCH5_GAPS.md` 的推荐和用户2026-10-27授权，批准条目见 `S13_RULES_GAP.md` 的 P-B5-76／P-B5-79。仅开放这两项；不提交、不重录 epoch。

| 强化 | 归档数值 | 开放节点与执行 |
| --- | --- | --- |
| B5-76 拾荒者 `scavenger` | 黄金；`NumDeaths=5` | 2-1／3-2／4-2；每战前5名敌方正式英雄首次真实死亡，同一死亡清理边界即时发临时成装，无接收者消耗机会但不抽随机词 |
| B5-79 白蹭 `sponging` | 棱彩；`MaxItemsToBeEligible=1, MaxUnits=5` | 3-2／4-2；tick0永久装备快照，最多5名，最近三件永久普通成装友军，同距按ID，按实例等权复制，统一采样后分配 |

来源 `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`，API身份分别 `TFT_Augment_Scavenger`、`TFT_Augment_Sponging`。来源测试使用 `it.skipIf(!existsSync(RESEARCH_FILE))`；实现数值独立固定，不在运行时读取研究目录。

## 历史和内部接口

没有新增网络／Match命令、失败原因或持久计数器。选取继续使用 `selectChoice`／共享池 `choose`，失败保持原 state 且无事件和随机消耗；组合／穿装继续使用已有公共命令。两项均登记为 `augment-history-v1` 持有者。

永久物品来自 `historyRoster(Pick<MatchState,'preparation'|'items'>): HistoryRoster`，与既有 `combat-roster`／`pvp-roster` 事实同源。`compileH11HistoryEquipment(inputs,unit,enemyItems)` 在极客转换前按槽冻结永久装备及手套子装标记，只有H11持有者才添加 `StrategyUnitSnapshot.augmentEquipment`；`combat.ts` 将其投影为现有 `CombatUnit.equipment`。白蹭仅从永久普通成装挑源，不把复制品或手套子装当来源。执法官没收沿现有战斗投影先执行。

`readAugmentFirstHeroDeaths(state,events)` 是 `augment-death-samples.ts` 新增的战中历史读取器：同一真实死亡样本随后由原接口写入历史节；当次未 stamped 事件按产生顺序读取，前缀取已重演认证的 `openingDeaths`，恢复后不依赖 WeakMap 仍可去重。读取不写状态，不从HP猜死亡，不新增事件或第二份计数。普通英雄判断共用 `isAugmentOrdinaryHero`。原始每次死亡历史仍保留复活后再死，只有拾荒者读取视图去重。

`settleH11Deaths(ctx: AbilityContext,before: CombatState): void` 在真实死亡清理后、消灭判定前执行，跨双方按完整死亡事件顺序抽样。`openingH11(ctx,before): void` 在tick0已有开场机制后、最终镜像生命和实验复制体快照前执行；所有候选和来源读取原始冻结装备／位置，采样完成才发放。两者只改本次战斗的工作副本并追加原有事件类型。

`grantCombatItemDefinition(ctx,source,target,seq,definitionId): void` 复用既有宝箱的35件普通成装载荷和即时程序安装，H11先用战斗LCG拒绝采样等权选项，再调用它；原宝箱仍保持原抽样方式。收据沿用 `CombatItemGrant`，其历史字段名 `chest` 对H11存真实 `sourceKind='augment'` 来源，派生物品实例命名空间为 `augment-h11`。非法载荷拒绝 `Invalid combat item payload`。临时装备增加当战属性、法力、开场效果、周期程序，不生成永久 `ItemInstance`，下轮自然消失。

`validateH11Grant(units,receiver,grant): void` 校验来源、数量、连续序号及白蹭tick0/单人单件约束，失败 `Invalid Match save: H11 combat item grant`。精确死亡、来源英雄、随机词、装备及授予时刻由完整战斗重演认证。槽位资格按授予瞬间判断；后来的合法永久穿装或宝箱发装不能反向否认旧收据。`proposeSettlement` 的脱离内存结果同样重演H11，认可经过编译的开战装备快照，篡改仍报已有 `invalid-result`／`battle-input-invalid`。

历史节和三入口认证不变：单人object／JSON／`serializeMatch`走公共命令重演；联机object／JSON／canonical序列化走 `restoreSharedOrbSnapshot(pool,input,authority)`，必须使用服务器独立捕获的 `Room.augmentHistoryAuthority`。离线 `serializeMatch` 本来就拒绝联机Match，联机序列化测试因此使用既有 `canonicalContent`。没有候选自签名或对缺历史旧档补零。

## 全部运行接线点

| 文件／调用点 | 变更或复用 |
| --- | --- |
| `content/augment-pool-batch5-h11.ts` | 新增两项内容、来源数值、机制字段、tier/API映射 |
| `content/augments.ts, augment-policy.ts, augment-offer-rules.ts, augment-stage-bans.ts, rules-manifest.ts` | 最小注册／阶段禁用／约定身份；既有互斥组照常执行 |
| `effects.ts, validate-content.ts` | 认可新机制字段，目录数增加2 |
| `augment-history-owners.ts, augment-history.ts, augment-death-samples.ts` | 登记持有者、通用roster输入类型、新增实时死亡读取器；旧事实结构不变 |
| `augment-pool-batch5-h11.ts, augment-pool-batch5-h11-history.ts, augment-pool-batch5-h11-validation.ts` | 新规则、冻结历史适配和恢复检查 |
| `strategy-types.ts, strategy-snapshot.ts / buildStrategySnapshotSteps` | 条件冻结开战装备槽 |
| `combat.ts / snapshotCombatSteps` | 将已编译装备投影至战斗单位 |
| `combat-effects.ts / applyCombatStart` | 白蹭开战事务 |
| `combat-s13.ts / advanceS13Tick` | 拾荒者死亡事务 |
| `m8/combat-item-grants.ts, m8/combat-item-programs.ts` | 公共指定物品授予、强化来源收据／命名空间／校验 |
| `g2-4b-gold-restore.ts / BATCH3_REPLAYED_MECHANICS` | H11加入完整战斗重演认证 |
| `two-sided-battle.ts / validateDynamicResult` | 脱离运行缓存后的H11结果认证，允许已编译的开战装备 |
| `combat-replay-view.ts / startCombatReplay` | 同样识别开战装备快照，重建联机回放不误拒绝 |
| `src/server/room/room.ts / applySeatCommand, apply, freezeAndResolve, openStreams, commitSettlement, augmentHistoryAuthority` | **无需修改**；复用choose／combine／equip调度、自动布阵、冻结、流式战斗、独立恢复authority |
| `src/server/room/two-sided-resolver.ts, combat-stream.ts` | **无需修改**；复用规则编译和推进，服务端无奖励／RNG计算 |
| `src/server/room/augment-history.ts / recordRoomPvpRosters, recordRoomBattleFacts, recordRoomPublication` | **无需修改**；发布全桌开战名单、完整死亡、命令后阵容事实 |
| `tests/fixtures/m5/oracle.g2.cjs, tests/augment-stage-helpers.ts` | 独立候选目录237项／白蹭阶段禁用，固定3-2 seed7路由 |
| `tests/augment-history.test.ts` | 目录扩展后用0..100内合法starry-night路径；旧SHA断言原样保留，仅将已验证的contentDigest／loot replayDigest归一回基线以比较其余字节，未重录epoch |
| `tests/augment-stage-bans-audit.test.ts` | 真实归档统计同步新增两项：209项池、161行禁用、166行重建、70项无限制；原有五项缺陷断言保留 |
| `content/identity-constants.ts, scripts/tests/production-size.test.ts` | 最终重算并同步完整内容身份；epoch文件不改 |

## 测试范围

`augment-pool-batch5-h11.test.ts`／`-room.test.ts`：来源数值、报价节点、失败原子性、真实选取购买开战、首次死亡／前5名／双方事件顺序／无接收者／复活去重／排除召唤与野怪／满槽；即时属性程序；三个保存入口的取得、战中、结算、下一轮往返及缺历史、版本、阵容、死亡、收据、随机和编译装备篡改；真实流式房间、独立authority及脱离内存战斗结果认证。

`augment-pool-batch5-h11-sponging.test.ts`／`-sponging-public.test.ts`／`-sponging-room.test.ts`：原始数值／阶段／互斥、五人上限、最近来源及同距ID、装备实例／永久与临时区分、合法0/1件和不合法2件、特殊装备排除、手套满槽候选、反序输入确定性；真实choose→claimOrb→combine→equip→开战；tick0一次发放、永久账本不变；三入口往返与篡改、联机准备快照及战后authority恢复、脱离内存战斗结果重演。

## 实际验证结果（2026-10-27）

| 定向范围 | 结果 |
| --- | --- |
| 拾荒者规则及真实房间，两文件 | 28项通过 |
| 白蹭规则、公共命令及真实房间，三文件 | 33项通过 |
| 共享报价节点及独立oracle | 2项通过；H11合计63项 |
| 历史基础设施／内容身份／生产包大小，三文件 | 89项通过 |
| `t2-two-sided-battle`、`battle-equipment-phase2`、`server/battle-equipment-phase2`、`server/two-sided-resolver` | 55项通过 |
| 既有 `g2-4b-unstable-chest` | 39项通过；见下方种子扫描执行偏差 |
| 最后追加归档阶段标签断言后，重跑H11两个规则文件 | 33项通过（已包含在上方63项，不重复累加） |
| `npm run typecheck`、`npm run build -- --configLoader runner`、`npm run build:game` | 全部通过；客户端构建仍有既有大chunk提示 |
| `node scripts/update-content-identities.cjs --write`／`--check`、`git diff --check` | 通过；未重录epoch、未提交、无素材文件 |

不同测试共246项通过。Vitest使用 `npx vitest run --project fast --config /tmp/h11-vitest.config.ts --configLoader runner --maxWorkers=3 <上列文件>`。该临时配置只移除原项目会启动浏览器的globalSetup，保留原worker setup、断言和超时；测试均为纯规则或ManualClock房间，不需要浏览器。没有运行完整套件，没有删断言或增加超时。

额外 `tests/augment-stage-bans-audit.test.ts` 的10项子进程测试被沙盒 `spawnSync <node> EPERM` 阻断（52行／真实归档131行），不能记为通过；直接执行CLI成功产生报告并按原有五项缺陷退出1。新增H11归档标签断言通过，直接报告也确认 Scavenger 无限阶段限制、Sponging 禁2-1。五项差异与既有测试列出的完全相同：Academy、Cabal、Experiment、Formswapper、BloodBrothers，对应 `content/augment-pool-batch2.ts` 的12／154／271／334／590行。本单不修改这五项玩法。

执行偏差：早期复跑旧宝箱文件时未提前检查其内部循环，运行了既有 `seed<400`、`seed*7919` 的扫描（该文件155／187／347行）。发现后未再运行；没有改其断言或循环。本单新增／修改的种子查找均在0..100内，白蹭联机固定seed0、单人固定seed7，拾荒者联机固定seed3。

最终 `CONTENT_DIGEST=fnv1a32-utf16:976a7cc9`，`LOOT_REPLAY_DIGEST=fnv1a32-utf16:671c71c1`；生产包测试已同步。旧内容身份的存档仍按既有规则拒绝，没有放宽恢复认证。交付摘要见根目录 `-o`。
