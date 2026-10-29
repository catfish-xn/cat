# v26 R5 异变出售保留交接

基线：`claude/v26-anomaly-r5` / `4baaaf5a9a74335d46fa0e037a93e4e595f05384`。本任务不写 `.git`、不提交、不改 `src/server/` 或界面目录、不重录基线。用户 2026-10-29 批准 R5-A，覆盖原 M5 出售销毁政策。审计依据为任务附带的 `codex-briefs/reports-1029/anomaly-flow.md`，特别是 7.2、7.3、7.6。R1/R3/R4a 属于其他任务；R2/R6 与 P-B5-81 沿用原决定。

## 已落实的规则

- `anomalySelection` 保存席位已选择的异变/英雄定义、choiceId、原获得轮，没有 unitId；`anomalyBinding` 仅表示一个真实实例。出售保留前者，后者可为 null。
- 当前实例优先，合星沿用 survivor；只有原实例离开后才找同英雄替补，按字符串 unitId 升序（如 `unit-20` 先于 `unit-3`），不由站位或星级抢占。**只有一个原生持有者**；便携异常是 P-B5-81 的独立复制例外。
- 获取渠道均恢复同一资格；不重开选择、不改 choiceId/boundRound、不重新抽样、不重发金币/双刀流装备/便携异常。失败仍返回原状态和原失败原因。
- 轮盘保持原有准备期归位/合星边界；当轮未结算的轮盘卡和未入位托管卡不成为新原生持有者。进入未知自己托管的原实例保持身份，不让第二副本同时生效。
- `selectAnomalyTarget` 同样拒绝收据尚未准备期结算的轮盘卡，返回原 state 和 `invalid-target`，不抽样、不发事件；收据结算后可正常选择。此门禁与来源折叠的未结算轮盘资格一致。
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
| 联机/轮盘快照 | `restoreSharedOrbSnapshot` / `restoreCarouselSeat` 对已选异变补做同一历史装备/绑定认证；拒绝删除资格、乱改英雄或实例、伪造原生持有者装备便携异常 |
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
| `tests/t5r-private-seat-view.test.ts` 私有视图仅 35 个 key | 精确白名单补 `anomalySelection`，共 36 个 key；夹具增加非空资格，继续验证四字段投影、嵌套哨兵不泄露、冻结和无引用共享 |
| `tests/m8-b8-live-transfer.test.ts` basis 异变目标篡改仅在 resolved strategy 阶段失败 | 更早由认证资源前缀拒绝，期望改为 `Invalid combat input basis` |
| 同文件 current anomaly silently removed 只在 finished resource projection 失败 | 更早由全量权威折叠拒绝，期望改为 `Invalid B8 Match: current resource fold` |
| `D14_POLICY.sale` 原 `retire-certificate` | 改为休眠资格、原期限与合格副本恢复；本分支更新临时版本，digest 待集成时重算 |

`tests/s13-p1-bound-identity.test.ts` 出售使**该实例的合星血缘**追踪为 null 仍正确，未改变；它不再用于推导席位资格或便携禁装。历史 `tests/historical/m4/*.txt` 是归档，未改。`anomalyRemoved` 事件名保留，合同明确含义为当前实例解绑。

## 验证与纪元交接

测试均使用 `--maxWorkers=4`，未提高任何超时。工作区 node_modules 指向只读共享依赖，默认配置打包会尝试写 `.vite-temp`；本次用 `--configLoader runner`。纯后端临时配置 `/tmp/anomr5-vitest.config.mts` 只去掉无关浏览器 globalSetup，保留项目的 workers/setup/超时，不启动浏览器。

`playtest-1022b-bench` 已运行，生成的 `docs/evidence/playtest-1022b/bench-timing.json` 在测试后还原为 HEAD 原字节。未运行任何 `--write`，未改固定 JSON 指纹、golden 或纪元基线。

rules/content 本任务临时纪元分别为 `s13-g2-3-v26-anomaly-r5` / `s13-14.24b-g2-3-v26-anomaly-r5`；schema/save/replay/command 为 12/8/8/7，不迁移旧档。**digest 待集成时重算**：`src/simulation/content/identity-constants.ts` 保留原 `CONTENT_DIGEST=fnv1a32-utf16:f671ab88`，由 Claude 在 v26 集成时统一计算并更新相关身份基线。

以下是 Opus 审查指出的全部预期纪元/身份漂移失败范围，属于交接清单，不代表本次逐项重跑；不能把全仓预期失败概括为“1 项”。行号按审查时版本定位。集成时须先确认最终身份和 R5 字段，再更新对应证据；不得借重录掩盖数值、鉴权或战斗轨迹变化。

| 预期失败位置 | 待集成处理的身份/证据 |
| --- | --- |
| `tests/m5-route.test.ts` | 固定路线当前纪元/序列化基线 |
| `tests/m6-integration*.test.ts`（主文件、mage、sniper、sniper-caitlyn） | 旧纪元录制状态及路线/回放证据 |
| `tests/m6-playback-checkpoints.test.ts` | 旧纪元回放检查点 |
| `tests/m8-content-equivalence.test.ts` | 当前内容等价性基线 |
| `tests/opening-random-identity.test.ts` | 当前纪元身份和审计基线；历史档案仍保留历史含义 |
| `tests/server/battle-start-slices.test.ts` | 同步/切片开战 tick0/1 的旧身份哈希 |
| `tests/m8-b7-match-wiring.test.ts` Herald 相关用例 | Herald 公共路线的旧身份输入夹具 |
| `tests/epic-loot-reforger.test.ts:297` | 硬编码 v25 身份及旧身份替换校验 |
| `tests/v19-part2.test.ts` | v25 身份常量期望 |
| `tests/match-contract.test.ts` | 旧 rules/content 常量期望 |
| `tests/augment-history.test.ts:449` | 归一化后的完整存档哈希，含新增 R5 结构 |
| `tests/augment-pool-batch5-g4-swarm.test.ts:47` | 完整序列化哈希 |
| `tests/augment-pool-batch3-progress.test.ts:134` | pre-Spoils 旧纪元兼容输入档案 |
| `tests/content-identity-constants.test.ts` | 保留的旧 CONTENT_DIGEST 与实时内容根不匹配 |
| `tests/opening-encounters.test.ts:114` | 实时内容 digest 与保留常量比较 |
| `tests/augment-text-identity.test.ts:16` | 实时内容 digest 与保留常量比较 |
| `scripts/tests/production-size.test.ts:109` | 硬编码 v25 的实时内容根期望 |
| `tests/d14-anomalies-source.test.ts:58` | D14 当前纪元与旧 current-baseline 比较 |
| `tests/m8-b8-live-transfer.test.ts:43` | 唯一 `anomaly-selected` 增加一条事实，旧账本长度 88 → 89 |

`m8-b8-live-transfer` 的两处鉴权失败原因断言已按上表单独更新，未弱化为任意异常；它们不属于上述漂移。新增的出售禁令（d-common 第 16 条）由 anomA 实现，本单未修改该规则。

审查前已运行的相关子集（2026-10-29；不代表全仓测试结果）：

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| 20 文件相关主回归（R5/D14/便携异常/所有权/来源折叠/存档/战斗冻结/轮盘/Pandora/Recombobulator） | 485 项通过 |
| 补充后的 `v26-anomaly-r5.test.ts`（含真实 BattleHistory 录制、JSON 档案认证和 PlaybackSession 往返 seek） | 13 项通过，其中 12 项与主回归重叠，新增回放 1 项 |
| `m8-b8-live-transfer.test.ts` 当时复测 | 21 项通过，该文件旧账本长度 anchor 失败（88 → 89），保留待重录；其他文件预期漂移见完整清单 |
| `playtest-1022b-bench.test.ts` | 1 项通过，计时文件已还原；SHA-256 `41ef6b4235c364ff02d724d186044b833957a0c5acec9383842f4a151b6793c6` 与 HEAD 一致 |
| `git diff --check`、职责目录检查 | 通过；`src/server/` 和界面目录零修改；原有 `assets3d-local` 未触碰 |

上述已运行子集按用例去重为 **508 项通过**，其中 live-transfer 另有账本长度失败；这不是全仓预期失败总数。审查后修订的复测结果另列如下。本次没有浏览器或完整发布验收；最终 v26 纪元、digest、R1/R3/R4a 和表现层接线由 Claude 集成后统一验收。

### Opus 审查修订后的复测（2026-10-29）

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| 上述 20 文件主回归加 `t5r-private-seat-view`、`resource-provenance-firesale` | **22 文件、515 项全部通过**；同样使用 `--maxWorkers=4 --configLoader runner --config /tmp/anomr5-vitest.config.mts`，53.58 秒，未提高超时 |
| 其中 `v26-anomaly-r5.test.ts` | 15 项通过；新增两个隔离轮盘目标门禁向量，覆盖此前轮盘未结算/当轮未结算、原状态与全部 RNG/资源/序号不变、结算后允许、普通目标仍允许，以及成功事件的域和序号 |
| 精确断言 | 私有视图 36-key 白名单及非空 selection、Firesale 全量/前缀折叠八字段均通过，未弱化匹配 |
| `git diff --check`、身份与计时文件核对 | 通过；`identity-constants.ts` 和 `bench-timing.json` 对 HEAD 无差异，后者 SHA-256 仍为上表值 |

本轮仅复测相关后端子集，未逐项重跑上面的预期漂移清单；未执行 `--write`，未重录任何身份/golden/固定夹具，未改 anomA 出售门禁或服务器/界面目录。此次补丁没有提交。
