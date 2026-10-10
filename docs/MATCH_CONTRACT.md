# M5 Match contract v5

> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Public entrypoint: `src/simulation/match.ts`; public state: `match-types.ts` and `strategy-types.ts`. [M5_RULES](../M5_RULES.md) defines exact values and ordering. Match is the sole authority for economy, resources, schedule, progression and terminal state. The historical M4 contract is available in Git at the M4 baseline; this document describes the current API.

- `createMatch(seed=42)` accepts uint32 including zero. It returns schema5/rules `m5-14.24b-v1`/content `s13-14.24b-slice-v1`/protocol2, a complete content digest, 100HP/10G/level3 and the three starting units. Opening component choices precede the first augment. Round1 means2-1; round35 means6-7.
- Successful commands return `{ok:true,state,events}`. Failure returns `{ok:false,state,reason}` with the identical original state, no events, and no partial gold, shop generation, RNG, ID, receipt, growth or sequence mutation. `setShopLock` with the current value is a successful unchanged-state no-op.
- Preparation permits buy/sell/reroll/XP/deploy/item/lock commands. Buy validates generation and purchased status before resources, plans recursive triples atomically and checks final bench capacity. New candidate IDs consumed in upgrades are never reused. Price and sell value come from definitions, never UI.
- F costs4G/4XP, rejects wrong-phase then max-level then insufficient-gold, and never changes the current shop. Level9 caps XP at0. Requested and applied XP are separately recorded. D costs2G and keeps the lock flag. Natural Continue refreshes only unlocked shops; every generated shop consumes ten shop words and increments generation.
- Deployment shares `validateMatchDeployment` between preview and commit. Geometry is unchanged; nine bench slots and population equal to level. Moving a deployed unit does not consume an extra slot. Start rejects over-cap preparations. Empty player boards can concede immediately at tick0.
- `combineItems` and `equipItem` are atomic. Two inventory components become one new item ID; only the nine supported recipes are legal. Three equipment slots, deterministic upgrade transfer, overflow return and sale return remain authoritative in Match. Tristana growth sums into an upgrade survivor; selling destroys that unit's growth and anomaly binding.
- Choice is a real phase; all ordinary commands reject until it resolves. Choices validate ID/generation. Seven-way component choices consume no RNG; augment three-way offers consume three words; anomaly single offers consume one word, with1G rerolls excluding only the previous offer. Target binding precedes offers. Confirmation is free. Upgrades migrate bindings.
- Choice may carry a finished Combat snapshot during post-PvE rewards, and `returnPhase` distinguishes preparation from settlement. Rendering must refresh on every transition out of Combat, including Combat→choice. A supply round has no Combat: selecting its component atomically settles income and XP. No early Continue can bypass rewards.
- Shop, choice, reward and battle-seed streams are independent. Successful Start consumes one battle-seed word and freezes a separate Combat RNG. A random component consumes one reward word. Other command/choice/settlement operations consume no words unless explicitly specified by R4.
- `stepMatch` advances exactly one50ms tick. A terminal Combat transaction calculates result/survivors, HP, streak, income, XP, persistent growth and augment progress; creates one settlement identity/history/event sequence; then determines terminal state or post-battle rewards. Duplicate terminal steps cannot settle again. Supply uses the same economic planner without a Combat result.
- `nextRound(state,expectedRound)` accepts only the current completed settlement. It advances schedule/enemies, handles the shop lock, discards the old Combat and drains ordered before-round events. Receipts prevent duplicate grants. Income was already committed at settlement and is never repeated here.
- HP0 ends in defeat. At round35, final PvE victory ends in victory; other results end in defeat. All normal commands reject in gameOver. New Match discards the entire prior session. `stepMatch` outside Combat returns unchanged state and no events.
- `MatchSession` delegates synchronously, retains the complete current battle event ledger and uses a fixed-step accumulator. Phase changes and New Match clear time remainder. Native D/F/E commit in event order, independently of pointer-dismissal protection. The UI never settles, repairs state or calculates a parallel economy.
- `serializeMatch`/`restoreMatch` validate exact versions/digest, IDs and ownership, receipts/history, terminal and phase boundaries, normalized economy, RNG, growth/augment state, frozen Combat sources and dynamic layers/statuses/tasks. Restoration runs no hooks or random draws. Old schema4 and unknown content versions are explicitly rejected. This is structural consistency validation, not cryptographic proof of command history.
- Match event sequences and Combat `combatId/tick/eventSeq` are distinct and monotonic. Start events at tick0 are retained. Replay verifies every command/tick state and all events, including failed-command noninterference. Canonical evidence hashes use SHA-256; the content drift digest is not a security primitive.


M5审计修订：4-6无自有目标时保持preparation招募窗口，首个正常购买原子打开异常target选择；D/F保留至少一项可购买的卡，Start在该窗口拒绝。耗尽的锁店使用换轮正常免费刷新。确认收据幂等，确认后再卖空不重启异常。抽样使用完整32位词缩放候选区间，每次仍一词。

## M8 B5 开发期装备实例补充

本节覆盖上文旧 M5 装备条目的对应部分；正式 M8 存档版本仍待 B9。B4 已开放八组件/36配方。B5 依据冻结 M8 合同执行同持有者同 apiName 唯一性、三槽独占；三槽本体固定在0槽，预留1/2槽。合成同实例返回 `same-item`，装备非自有目标返回 `unknown-unit`。失败仍返回原状态且无事件/消耗。升星转移复用通用放置校验，冲突返回库存；恢复严格检查相同约束。开发规则修订纳入内容digest，旧开发档不自动迁移。阶段范围与验证见 [M8_B5_HANDOFF.md](M8_B5_HANDOFF.md)。

B5 第3阶段新增开发期必需字段 `equipmentState` 和 `temporaryEquipment`：独立装备RNG与父实例/轮次roll账本由Match成功事务管理，同轮组合跨等级/出售重穿/升星转移保持，新轮首次穿戴刷新。临时装备以独立temporaryId投影并传入现有战斗程序，不能转为永久库存；保存恢复严格重放装备随机流和验证当前父/子绑定。`item-selectors.ts`提供共享命令校验的预览及不会生成装备的只读视图。正式M8版本/持久化格式仍不在本阶段切换。


## M8 B7 中立战斗观察收据补充

本节仅补充已接入 B7 的 `combat.neutralReceipts`，不改冻结 M8 规则／UI 合同、G12 或 B8 掉落边界。含目录中立实例的 Combat 从开战起必有 `{ deaths: [], controls: [] }`；不含这些实例时该字段必须缺省。收据随 Combat 快照保存，由 `recordNeutralReceipts` 仅观察已提交的正式战斗事件，不施加效果、不改事件、不消费 RNG。

- `deaths[]` 每个中立死者至多一笔：`unitId`、正式死亡 `tick`、Combat 局部 `eventSeq`。恢复要求死者属于本场可信遭遇且确已死亡；每个已死亡中立都必须有收据。该身份绑定同伴反应的 `registeredAtTick` 与 `deathEventId`，防止删除／重定时后再次消费。
- `controls[]` 记录中立来源眩晕：`key` 是完整机制身份，`targetId` 是受控目标，`appliedEventSeq` 是施加事件序号。仍挂载时 `removedAtTick`、`removedEventSeq`、`removedReason` 全为 null；移除后填写对应正式事件的 tick、序号与原因。
- 恢复校验施加身份与可信开场任务／目标一致，状态应用来自同版本声明。起点由任务 `executeAtTick` 加声明的 next-tick 偏移计算，终点再加声明 `duration.ticks`；当前先锋为 `[2,12)`。活动收据须有对应存活目标和状态；移除收据须无活动状态，原因限有效的 `expired`、`death-cleanup`、`combat-end` 或有已消费装备净化依据的 `cleansed`。到期必须匹配声明终点；移除事件序号晚于施加序号。收据事件序号在本 Combat 的 `nextEventSeq` 范围内且不重复。
- `serializeMatch`／`restoreMatch` 执行上述同版本结构和一次消费一致性检查，不重放战斗启动、伤害、控制、奖励或随机流。这些观察收据不是 B8 `LootReceipt`、资产／掉落键，也不是对联合伪造整段历史的密码学认证；不替代 B9 完整恢复／回放验收。

详见 [M8B_CONTRACT_ADDENDUM §5.1](M8B_CONTRACT_ADDENDUM.md#51-b7-已接入的中立观察收据) 与 [B7 交接](M8_B7_HANDOFF.md)。
