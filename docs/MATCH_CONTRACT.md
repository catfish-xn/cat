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
- Choice may carry a finished Combat snapshot during post-PvE rewards, and `returnPhase` distinguishes preparation from settlement. Restore verifies it against the scheduled timing (supply always returns settlement) and rejects forged return phases. Rendering must refresh on every transition out of Combat, including Combat→choice. A supply round has no Combat: selecting its component atomically settles income and XP. No early Continue can bypass rewards.
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

## SR-C7-01 准备阶段单位互换（2026-10-12）

用户已确认采用 TFT 的己方位置互换规则。本节覆盖上文 Deployment 的占位行为，单人与联机共用；不改棋盘尺寸、部署区、人口/经济/战斗数值。

沿用公开函数与现有命令，**不新增 swap 命令或目标单位 ID**：

```ts
validateMatchDeployment(state: MatchState, unitId: string, target: UnitLocation): MatchFailure | undefined
deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult
// 现有联机 ClientCommand 形状：
{ type: 'deploy', unitId: string, target: { kind: 'board', cell: { col: number, row: number } } }
{ type: 'deploy', unitId: string, target: { kind: 'bench', slot: number } }
```

- 空目标仍是移动；目标仅被另一个己方单位占用时，一次事务交换两者 location，支持棋盘↔备战席（两个方向）、备战席↔备战席、棋盘↔棋盘。目标单位按提交时的当前状态决定，联机仍走原有回合/席位版本校验。拖回自己的位置成功但布局不变，再发相同目标也不会把互换反转。
- 双方 ID、定义、星级、装备持有者、成长、异常绑定均跟随单位保留，只变位置；不买卖、不升星、不生成奖励或账本事件，不消耗金币、RNG、ID/事件序号。满备战席可以交换。输入与目标坐标不被修改，两端位置分别复制，没有中途重叠的可见状态。
- `validateDeployment(GameState,...)` 是几何/所属校验，允许己方占位交换，不承担人口或阶段判断。界面人口预览应调用 `validateMatchDeployment`；提交与预览共享校验。
- `validateMatchDeployment` / `deployMatchUnit` 首先要求 preparation，再检查部署区、合法坐标及己方所属；交换的反向目标（原位置）也必须合法。最后检查**完成移动/交换后的玩家棋盘单位总数 ≤ getDeploymentCap(state)**。例如 level3、场上3人、备战席1人，备战席换场上人仍为3人，允许；去空棋盘格会变4人，拒绝。若输入已超人口，交换不降低人数，仍拒绝；移到空备战席且恢复到上限内可以成功。
- 失败名沿用现有枚举：`wrong-phase`、`unknown-unit`、`enemy-unit`（拖动敌方）、`invalid-location`、`outside-deployment-zone`、`occupied`（目标有非己方单位或多个占用者）、`population-cap`。SR-C7-01 原文的 `deployment-cap` 指人口拒绝，**实际线上错误仍为 population-cap**，不新增同义错误。敌军合法部署区外优先报 outside-deployment-zone。失败返回 `{ok:false,state:原对象,reason}`，无 events，无部分位置/资源/RNG写入。
- Claude 接线：发送上述一个 deploy 到目标位置即可，不能先把另一人移走再移动两次。现有 `ClientCommand` / `applySeatCommand` 已覆盖，无需新增协议成员；不涉及共享池持有数、池版本或占用调整。UI 的己方占位阻挡逻辑及鼠标预览由 Claude 按此合同接入。本 PR 不改服务器和界面。

规则身份：新增子规则版本 `DEPLOYMENT_RULES_VERSION = 'preparation-swap-v1'` 纳入 CONTENT_DIGEST；digest 从 `fnv1a32-utf16:c7ac9b0c` 变为 `fnv1a32-utf16:20b58a63`。M8 schema、命令 protocol2 与内容数值不变，旧 digest 的存档/回放按现有规则明确拒绝，不做静默迁移。

T1 首战没有互换命令。完整状态 trace SHA-256 因 Match 及 combatInputs 的 contentDigest 改为 `05d9283c62258433146e564bb0d7a78b22d9d51baf49fa652f59094d7ef4cb1f`；把这些指纹恢复为旧值后，逐状态字节仍匹配原 trace `2750307d4dea28641853737163d3621a6b3cce3901cfd184a0dc8c4178689167`。原 `tests/t1-probe-baseline.json` 保留，新增 `tests/t1-deployment-baseline.json`，校验器同时断言新 trace 与仅指纹归一化的原 trace；事件/RNG trace、164 tick、106条战斗事件以及首战 Combat 终态 hash 均保持原固定值，不改任何数值 golden。

## T10 联机运营与截止自动部署（2026-10-13）

联机 opt-in 覆盖上文普通命令只能 preparation 的限制，完整允许矩阵、失败原因、服务器调用顺序见 [MULTIPLAYER_CONTRACT §15](MULTIPLAYER_CONTRACT.md#15-t10战斗运营与准备截止自动上场2026-10-13)。combat/choice/settlement 允许买刷经验锁店、备战席出售/互换/装备与库存合成，禁止棋盘出售/部署；T12 装备例外见下节，冻结战斗不回写。战斗中三合一只使用备战席，涉及棋盘的合并在战后提交成长后自动执行。

新增 `autoDeployToCap(state): MatchCommandResult` 仅供服务器准备截止显式调用：最左备战槽依次上场，前排起逐行按列 `3,2,4,1,5,0,6` 找空格，不耗 RNG；线上普通与自动部署共用 `unitDeployed {unitId,from,to,domain,eventSeq}`，离线部署事件行为保持。PvP 冻结两方快照后用 `lockMatchCombatRoster` 锁 live seat，结算自动解锁；共享 PvP 用 `runSharedMatchCommand(pool,state,{type:'settleRound',receipt})` 原子迁移来源，不能只提交旧 Match。单人不调用自动上场，既有操作阶段和行为保持；新细分规则版本进入 digest，旧 digest 存档拒绝。

## T11 开局自然经验修订（2026-10-13）

用户批准 [S13_RULES_GAP R1/R6](S13_RULES_GAP.md)：[OPENING §3.1](M8B_OPENING.md#31-基础收入与失败规则) 的 1-4 自然 XP 从 0 改为 2，开局政策升级 `m8b-opening-project-v2`。此前 B6 的 2/2/0 XP、进入 2-1 三级 0 XP 文字由本条覆盖；现在 2/2/2 XP，无经济操作的 seed 42 进入 2-1 强化前为 10G、三级 2/6 XP。XP 阈值不变，买 XP 按累计值推进，不强制回填基准。

发放仍发生在唯一结算事务；重复 step/继续/恢复不重发。公共 API 签名、失败原因、外层 M8 格式和 RNG 算法均不改变。内容 digest 与掉落回放 digest 随开局版本改变；旧身份存档拒绝，不做迁移。联机接续及加时边界见 [联机合同 §16](MULTIPLAYER_CONTRACT.md#16-t11开局经验与自动接续2026-10-13)。本次不开放战中棋盘单位装备、不新增宝珠/消耗品，也不扩展野怪回血。


## T12 单人装备权限与单位身上合成（2026-10-14）

本节覆盖旧文中装备 preparation-only、choice 禁止普通装备命令的说法；当前 M8 身份见 [联机合同 §17](MULTIPLAYER_CONTRACT.md#17-t12战斗中装备永不锁定r22026-10-14)。单人和 active 联机相同：preparation/combat/choice/settlement 均可库存合成、装备己方永久棋盘/备战席单位合法槽，包括本场已经阵亡的永久单位。gameOver、淘汰、敌方/镜像/召唤物拒绝。独立 `canOperateEquipment` 不放宽单人 buy/sell/deploy/reroll/buyXp/shopLock；原 settlement 满备战区待领奖出售特例保留。

既有 `equipItem(state,itemId,unitId,slot)` 输入库存组件、目标槽为永久组件时，按最终槽位校验后消费两件并生成一件新永久物品，顺序 `itemCombined → itemEquipped → 必需的临时装备规划`。窃贼独占三槽且父实例归一槽 0；不拆卸、不跨单位取件、不替换成装。失败原 state、无 events、无 ID/RNG/序号变化。预览可选 `combination`、全部导出签名和失败枚举见 §17.1。

战中新装备下场生效，当前 combat/combatInputBasis、HP/护盾/数值/触发器/战斗随机流完全不变。冻结前缀保存已被运营合成消费的旧物品身份。结算使用 latest live state、只提交本场合法成长与唯一奖励，装备不得反向计入本场收益；战后合并迁移最新装备。

单人四阶段 serializeMatch→restoreMatch→续算仍通过 b8-restore 与 resource-provenance，允许合法组合 suffix，保留出生/配方/所有权/序号/奖励顺序/冻结非装备数据约束。新 CONTENT_DIGEST `fnv1a32-utf16:44fe9c0e`；LOOT_REPLAY_DIGEST `fnv1a32-utf16:7b14bfba` 不变。旧 content digest 拒绝，不迁移或补账；外层格式不变。联机恢复仅采用用户已选 B 的冻结输入恢复与未中断席位结算，不新增联机存档合同。

## T13-A 单位全槽自动合成

库存普通组件装备到已有永久普通组件的己方单位时，无论请求空槽、散件槽或成装槽，均与最低槽号的散件合成。普通成装留在该槽；窃贼父件沿用三槽独占与 0 槽规范。旧状态有两件散件时也按最低槽号选取，每次只消耗一件已穿散件及一件库存组件。

`equipItem`/`previewEquip` 签名、失败枚举、combination 字段不变；成功预览的 occupiedSlots 表示实际落槽。输入 slot 仍须合法。四阶段权限、失败原子性、仅一个新永久 ID、来源 fold 与冻结战斗恢复沿用 T12。按用户后续拆分决定，A 以独立 equipment v4 digest 先行发布，保持 schema6/save2/replay2；旧 digest 拒绝、不迁移，R3/R4 后续另发，见 MULTIPLAYER_CONTRACT §17.7。


## T13 R3/R4 同步合同

D1–D8 按推荐 A 签署；公共签名、失败枚举和 shared-deferred 调用时机以 MULTIPLAYER_CONTRACT §18 为准。PvE 按 M8B_LOOT §11 随机宝珠，五次 .4 自选保留；消耗品在 T12 四阶段操作，修改运营装备且下场生效，失败无事件且保留原 state/RNG/ID。单人完整恢复校验工具授予/消费时序与独立重铸流；联机沿 T12 B 冻结输入恢复，不支持完整 Match 存档恢复。T13-A 与 R3/R4 一次升级到 schema 7、save/replay 3；旧格式 2 仅保全导出、新开局，不迁移。
