# v26 R5 异变出售保留交接

R5 来源：`claude/v26-anomaly-r5` / `761871a9`；集成工作区：`claude/v26-anomaly-r1r3r4` / `0369ee6b`。本轮只编辑工作区，不写 `.git`、不提交、不改 `src/server/` 或界面目录、不重录旧证据。用户 2026-10-29 批准 R5-A，覆盖原 M5 出售销毁政策。审计依据为任务附带的 `codex-briefs/reports-1029/anomaly-flow.md`，特别是 7.2、7.3、7.6。R1/R3/R4a/R5 与第16条禁售已合并；完整时钟、资格、报价和恢复合同见 [统一交付](V26_ANOMALY_R1_R3_R4A.md)。R2/R6 与 P-B5-81 沿用原决定。

## 已落实的规则

- `anomalySelection` 保存席位已选择的异变/英雄定义、choiceId、原获得轮，没有 unitId；`anomalyBinding` 仅表示一个真实实例。出售保留前者，后者可为 null。
- 当前实例优先，合星沿用 survivor；只有原实例离开后才找同英雄替补，按字符串 unitId 升序（如 `unit-20` 先于 `unit-3`），不由站位或星级抢占。**只有一个原生持有者**；便携异常是 P-B5-81 的独立复制例外。
- 获取渠道均恢复同一资格；不重开选择、不改 choiceId/boundRound、不重新抽样、不重发金币/双刀流装备/便携异常。失败仍返回原状态和原失败原因。
- 轮盘保持原有准备期归位/合星边界；当轮未结算的轮盘卡和未入位托管卡不成为新原生持有者。进入未知自己托管的原实例保持身份，不让第二副本同时生效。
- 统一 `isEligibleAnomalyTarget` 拒绝收据尚未准备期结算的轮盘卡和已有 `anomalySelection`（即使绑定为 null），同时用于手动选择、本人目标名单、刷新/确认及超时目标选择。手动拒绝返回原 state 和 `invalid-target`，不抽样、不发事件；收据结算后可正常选择。超时额外排 catalog summon；先自动部署，包含 bot 席位。
- 终极英雄只恢复到实体三星，原三次结算期限继续；进入未知不重复离场，已归来效果随新持有者恢复。`d14.retired` 代表上一实体退出，资格仍保存。
- Tristana 实例成长出售删除；原生 Headhunter 使用最初 boundRound 的席位击杀账本，便携异常按原 itemId 独立计数，单场计数照常重建。恢复不复制其他实例或便携异常的累计值。
- 恢复后的原生持有者禁装便携异常；它原已装备的复制品退回库存，保留物品身份和独立成长账本。装备预览和提交仍走 `item-restricted`。
- PvE/PvP 都冻结本场原生绑定。PvP `lockMatchCombatRoster` 内部记录 `combatAnomaly`，避免战斗中卖出备战席持有者后恢复到场上副本，导致本场 Headhunter 收据被错判；结算解除锁定后删除此记录。

## 全部调用点与权威边界

| 入口/场景 | 调用链与本次处理 |
| --- | --- |
| 手动/超时确认 | `match.selectChoice`（含 `forfeitPendingChoice` 路径）提交 selection、binding、schedule receipt、唯一 `anomaly-selected` 资源事实；原目标锁定/兜底顺序未改 |
| 普通/共享池出售 | `match.sellUnit` / `shared-pool.sellSharedUnit` → `augment-pool-batch5-h12.sellPreparedUnit` → `reconcileMatchAnomaly`；先归还原装备、清实例成长和写 sale，再恢复单一替补；共享池仍独立归还原卡份数 |
| Head Start 批量出售 | `applyHeadStart` 仍逐个调用 `sellPreparedUnit`，保留同一政策；不另算资源 |
| 单人/共享商店购买 | `match.buyUnit` / `shared-pool.buySharedUnit` → `planUnitAcquisition` → `transferUpgradeResources` → `reconcileAnomalyResources`；候选出生、合星、绑定、便携退库在成功计划内一起提交 |
| PvE 掉落/领取、机制球/家人球 | `loot-runtime.grantDirectLoot` / `orb-claim` / `match.claimOrb` → `planUnitAcquisition` 或 `grantMechanicUnit`；金币替代、未领取球或满席托管不制造实体绑定 |
| 强化、羁绊与其他机制英雄奖励 | `seat-mechanics.grantMechanicUnit` → 同一获取计划；其直接返回值同步更新 D14 生命周期。`g2-3-runtime.mechanicGrantEvents` 对只返回 state 的奖励 drain 补齐恢复、退库和晋升事件 |
| 英雄复制器/次级复制器/微光复制器 | `consumables.previewUseConsumable` 只规划；`match.useConsumable` → `grantConsumableCopy` → `grantMechanicUnit`。生成实体一星英雄，原生异变按资格选唯一持有者，不复制计数或额外奖励 |
| 轮盘 | `carousel.grantCarouselPick` / `grantAdditionalCarouselPick` 保留既有归位边界；`resolvePendingCarouselUnits` / `nextRound` / `nextSharedRound` → `carousel-units.resolveCarouselPreparation`，归位及合星后恢复；满席等候时无新绑定 |
| 战斗中购买/战后延迟合星 | 购买用 benchOnly 计划，既有绑定不抢占；`deferred-upgrades.resolveDeferredUpgrades` → 资源迁移后恢复；PvE/PvP 冻结输入保留本场原身份 |
| 永久变形/移除 | `augment-pool-batch5-r6.transformBatch` 每次变形及合星后恢复；`augment-pool-batch3-progress.drainBatch3Forming` 每次移除后重选/休眠；英雄资格不随永久换英雄而改变 |
| 纯战斗投影 | `projectHallOfMirrors` / `mutationEquipmentProjection` 仅去掉本场效果，未改变永久 selection；战后仍沿原英雄资格 |
| 独立所有权/D14 参考引擎 | `owned-resources.transactOwnership` 在每项操作后对 acquire/duplicate/claim/hold/sell/merge/deploy/equip 做统一协调；`createOwnershipState` 从可信边界复制 selection；`d14-anomalies.transactD14` 同步保留资格与原期限，仍不接入生产 Match |
| 本人/对手显示数据 | `toPrivateSeatView` 新增四字段 selection 白名单；`server/room/projection.toPublicBoard` 无需改动，只读取当前 binding；休眠资格不公开给对手。`snapshotForBattle` 和 `two-sided-battle` 只冻结/映射实际上场实例 |
| 单人存档/回放 | `restoreMatch` / `serializeMatch` → `foldResourceProvenance` 重建 selection、当前及历史最后绑定；`validateHistoricalEquipment`、获取奖励/D14/便携校验与冻结输入相互对照。`b8-restore` 三个后续获取重演点透传 selection；历史 basis 不被当前绑定覆盖 |
| 联机/轮盘快照 | `restoreSharedOrbSnapshot` / `restoreCarouselSeat` 对已选异变补做同一历史装备/绑定认证；从 4-6 起两者都要独立服务器 authority。选秀入口对无强化历史的多人异变证据同样要求该句柄，不接受只改 selection/binding/选择收据定义的自洽伪造。拒绝删除资格、乱改英雄或实例、伪造原生持有者装备便携异常 |
| 服务器现有入口（仅核对） | `room.applySeatCommand` 分发 buy/sell/choose/target/reroll/consumable；`Room` 准备期腾位调用 `resolvePendingCarouselUnits`，两条战斗入口调用 `lockMatchCombatRoster`；结算仍调用公共领域 API。本次服务器零改动、无新计时 API |

内部新 helper 的签名：`resolveAnomalyBinding(selection:AnomalySelection|null|undefined,binding:AnomalyBinding|null,units:readonly Hero[]):AnomalyBinding|null`；`reconcileAnomalyResources(selection,binding,units,items):{anomalyBinding,items,events}`；`reconcileMatchAnomaly(state:MatchState,events?:MatchEvent[]):MatchState`。只接受领域持有实体/已认证历史投影，不供客户端指定候选列表。公共命令没有新增失败枚举，合法失败保持资源/RNG/ID/事件原子性。

## 被取代的旧断言：逐项替换

| 旧位置/断言 | 替换与保留边界 |
| --- | --- |
| `M5_RULES.md` 原第 235 行“出售绑定者销毁异常” | 替换为资格保留、单实例恢复、特殊异变与 P-B5-81 边界 |
| `docs/MATCH_CONTRACT.md` 原第 837 行 selling destroys growth and anomaly binding | 区分实例成长删除与异变资格保留；追加完整 R5 契约 |
| `tests/d14-wiring-match.test.ts` 原第 163 行出售只断言 binding=null / retired | 保留无候选时 null/retired，新增 selection 不变、重获后等待/晋升/归来恢复且无第二次离场事实；新增提前售出恢复不重开三回合等待 |
| `tests/s13-p1-dual-wielding.test.ts` 原第 58 行出售后 binding=null | 保留该夹具无替补时 null；新增 selection 保留。真实重获且双刀流/贪财不重奖由 `v26-anomaly-r5` 覆盖 |
| `tests/m8-b8-resource-provenance.test.ts` 两处折叠结果仅五字段精确相等 | 期望补 `anomalySelection:null`、`anomalyBinding:null`、`lastAnomalyBinding:null`，继续精确验证旧资源字段 |
| `tests/resource-provenance-firesale.test.ts` 完整及前缀折叠结果仅五字段精确相等 | 两处期望都补上述三个 null 字段，继续使用 `toEqual` 精确验证，不改为部分匹配 |
| `tests/t5r-private-seat-view.test.ts` 私有视图仅 35 个 key | 精确白名单合并 `anomalySelection` 与 R1 的 `anomalyTargetIds`，共37个 key；夹具增加非空资格，继续验证四字段投影、嵌套哨兵不泄露、冻结和无引用共享 |
| `tests/m8-b8-live-transfer.test.ts` basis 异变目标篡改仅在 resolved strategy 阶段失败 | 更早由认证资源前缀拒绝，期望改为 `Invalid combat input basis` |
| 同文件 current anomaly silently removed 只在 finished resource projection 失败 | 更早由全量权威折叠拒绝，期望改为 `Invalid B8 Match: current resource fold` |
| `D14_POLICY.sale` 原 `retire-certificate` | 改为休眠资格、原期限与合格副本恢复；已纳入合并后的 v26 内容摘要 |

`tests/s13-p1-bound-identity.test.ts` 出售使**该实例的合星血缘**追踪为 null 仍正确，未改变；它不再用于推导席位资格或便携禁装。历史 `tests/historical/m4/*.txt` 是归档，未改。`anomalyRemoved` 事件名保留，合同明确含义为当前实例解绑。

## 合并后的恢复与验证

报价窗口证明封存 `anomalySelection`、唯一选择收据和资源前缀，不再以原实例出售后血缘归零推导资格销毁。`validateB8Resources` 在报价证明检查前，独立折叠全部出生、出售、变形和合星事实，认证当前单一绑定；真实重新获得英雄产生的 `anomalyRestored` 事件与此折叠一致。候选事件不自行授权绑定。伪造旧实例、篡改英雄/选择身份、删除资格或选择事实仍拒绝。

`m5-audit-boundaries` 保留待选禁售、封存证明与原篡改断言，增加出售后真实获取同英雄并成功序列化/恢复，再分别验证休眠与已恢复状态不能用已售实例伪造绑定。R5 的真实商店重买、奖励/复制、单持有者、便携退库、D14 原期限、冻结 PvP 输入及回放往返断言均保留。

统一身份：rules=`s13-g2-3-v26-online-rules`，content=`s13-14.24b-g2-3-v26-online-rules`，CONTENT=`fnv1a32-utf16:038b00ca`，LOOT=`fnv1a32-utf16:9af7b4d0`；schema/save/replay/command=12/8/8/7、NET=5。摘要经只读重算与 `--check` 验证；未执行 `--write`。

完整相关集合、逐项剩余失败与重录边界统一记录在 [交付合同的验证清单](V26_ANOMALY_R1_R3_R4A.md#验证与剩余漂移)，不再把此前窄范围运行数当成最终验收。`bench-timing.json` 跑完恢复为 HEAD 原字节，已发布 T13 oracle 与证据均保持锁定字节。没有浏览器或发布验收。

合并最终验证：159文件，17,737项通过、315项纯身份/纪元断言失败，另1文件旧摘要锚点收集失败；逐项原因及连带阻塞见统一清单。构建/类型检查/双摘要检查通过，2D顶层JS gzip-9为632,031字节（上限637,144）；未新增lazy chunk。
