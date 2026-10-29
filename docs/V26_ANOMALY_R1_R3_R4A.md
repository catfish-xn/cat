# v26 anomA：异变 R1 / R3 / R4a 交付合同

基线 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`，分支 `claude/v26-anomaly-r1r3r4`。依据用户 2026-10-29 批准及 [流程审计](V26_ANOMALY_FLOW_AUDIT.md) 的 1.3、3.4、4.3、R4a；其中待选出售权限由用户同日 11:38/12:02 的第16条补充决定覆盖：异变待选期间全部禁售，确认后恢复。规则依据沿审计 S2（14.24 超时召唤物修复）、S4（4-6 planning=75）、S6（初始 12 项保护；13.4 才改为滚动窗口）。首次免费报价计入 12 是本次批准口径，不宣称存在同版执行脚本。

R2 保留首次选定锁定；R6 保留字符串 ID 升序默认目标及空席兜底；R7 保留 P-B5-81。R4b 阵容适配权重不改。R5 已批准但不属于 anomA 本单，确认后出售仍沿旧清绑定政策，交由后续 R5 实现。

## 规则和服务器计时

- Room 在 4-6 入轮直接进入 `preparation`，默认只设一次 75,000ms 截止点。不再先设 `choiceMs=30,000`；选目标、刷新、部分或全员确认均不重置、延长或提前结束总时钟。显式加速测试用 `preparationMs` 覆盖仍有效。
- 各席 Match 继续以 `phase='choice'` / `pendingChoice.kind='anomaly'` 表达尚未确认；房间阶段为 preparation。这与已有强化选择的双层阶段表达一致，无新 wire 命令。
- 规则允许待选时上场、下场、交换、移动，以及原准备期合法的买牌、D/F、锁店、装备和准备召唤物移动；仍执行人口、位置和冻结阵容限制。**待选时所有棋子禁止出售**，含场上、备战席、锁定目标及其他棋子；`sellUnit` 在锻造器出售转开启的快捷入口前也拒绝，沿用 `wrong-phase`，返回原 state，无事件、金币、卡池、报价历史或 RNG 变化。选秀暂存棋子的独立出售入口仍受其 preparation-only 门禁约束。单人、联机、本地房间一致；确认后恢复原出售规则。单人没有真实倒计时。
- 待选目标被合星消费时跟随 survivor，并增加 generation，保留当前报价、历史、已付次数及 choice RNG。普通主动换目标继续拒绝。D14 目标暂时下场仍保留锁定及报价，刷新/确认返回 invalid-target，移回合法位置后继续；不会因下场就解锁主动换目标。单人/联机一致，不产生免费重抽。
- 初始空席仍走已有 preparation 招募门禁，等待购买，不自动买牌或发棋；中途买到第一名棋子也不重设房间截止点。
- 准备到期沿既有注入 Clock → `freezeAndResolve` → `resolveSeatTimeouts` → 规则 `timeoutChoice`；异变 timeout 先调用领域 `autoDeployToCap`，再验证/确认报价；锁定 D14 的备战席目标优先填充空人口位，避免先用 board-only 资格拒绝、后又自动上场。仍受人口上限约束，不挤走已部署单位。其他回合沿 Room 原有 staged 自动部署及冻结边界。不新增真实时钟、计时器、超时预算或资源补偿。

## 公开资格接口与前端字段

以下接口由 `src/simulation/match.ts` 和 `src/server-entry/index.ts` 导出；实现集中在 `anomaly-choice.ts`。输入必须是完整权威 MatchState；投影视图不作为规则或保存状态。

| 接口 | 输入输出及用途 |
| --- | --- |
| `readAnomalyTargetIds(state: MatchState): readonly string[]` | 当前可以提交 `anomalyTarget` 的己方实例 ID，保留 roster 顺序。仅 anomaly target 步骤返回真实可选者；offer 步骤、其他阶段、淘汰或阵容冻结返回空。无副作用、无 RNG、无事件。不能把返回值理解为 offer 步骤允许主动换目标。 |
| `isEligibleAnomalyTarget(state: MatchState, unit: Unit \| undefined, offers?: readonly string[], purpose?: 'manual' \| 'timeout'): boolean` | 共用资格谓词；默认 offers=[]、purpose=manual。所有入口排除敌方、不存在单位/定义、锻造器、已有原生绑定；有报价时再验证 R2 复制品排除池及 D14 限制；timeout 额外排除所有 catalog summon。不是命令或阶段授权。 |
| `readAnomalyOfferHistory(state: MatchState): readonly string[]` | 按成功报价顺序返回定义 ID；含首次免费报价，重复项可在第 13 项起合法出现。只读查询，不向其他玩家公开。 |
| `isAnomalyPreparationChoice(state: MatchState): boolean` | 是否为准备期中的异变选择，供规则编辑门禁使用。 |
| `isAnomalyPreparationRound(state: MatchState): boolean` | 是否为尚未结算的异变日程轮（加时为 false），供 Room 选择本轮准备时钟。空席/其他准备弹窗仍属于同一时钟。 |

`toPrivateSeatView` / `toSeatPrivateView` 的本人投影新增必有字段 **`anomalyTargetIds: readonly string[]`**。与同包 pendingChoice 的 choiceId/generation 一起使用；名单是实时只读资格，点击后仍以服务器回执为准。旧令牌不允许客户端自行更新或重试。

Claude 的单一 anomaly-ui：联机/本地房间直接使用私有投影的 `anomalyTargetIds`；`toDisplayMatch` 已通过 `...view` 携带该字段，显示类型及面板接入由 Claude 处理。单人用公共查询读取权威 Session 状态。界面打开时客户端锁盘，提供“隐藏界面”，隐藏后可部署/上下场/移动，再打开继续选；出售始终由服务器拒绝，隐藏不解除禁售，无新增“界面是否隐藏”的网络命令。此界面接线由前端另一单处理。2D/3D 只提交既有 target/reroll/choose；不重算召唤物分类、抽样、金币、剩余时间或资格。对手 PublicBoard 不增加未确认报价或目标名单。服务器 `toItemSummonViews` 在异变待选时也保留可移动准备召唤物；单人 `MatchSession.itemSummons` 仍有旧 preparation-only 显示门禁，Claude 接线时同步开放，规则命令已允许。

原命令签名不变：`selectAnomalyTarget(state,choiceId,generation,unitId)`、`rerollAnomaly(state,choiceId,generation)`、`selectChoice(state,choiceId,generation,definitionId)`。沿用 `wrong-phase`、`stale-choice`、`invalid-choice`、`invalid-target`、`insufficient-gold`；失败返回原 state，无事件、资源和 RNG 消耗。不增加公开失败枚举。

### 有依据与待证的分类

| 分类 | 手动、刷新和确认 | 超时 |
| --- | --- | --- |
| 普通英雄 | 己方棋盘/备战席；继续按当前报价适配 | 继续保留字符串 ID 最小者默认排序 |
| 所有 `TFT_ArmoryKey*` 锻造器 | 排除，并从前端真实名单排除 | 排除 |
| `trainer-golem` | 普通异变维持原允许；原版资格待证 | catalog summon，排除 |
| `training-dummy` / `forming-dummy` / `tower-dummy` / `augment-golem` | 普通异变维持原允许；原版逐类资格待证 | catalog summon，排除 |
| `g23-sion` / `g23-forge` 及其他 catalog summon | 不新增通用手动黑名单；通常只是准备/战斗投影、不在永久 roster，因此也不在名单 | 所有 summon 均排除 |
| 终极英雄 / 进入未知 | 保留 D14 必须场上普通英雄；终极英雄还需三星一费及已支持第四星技能 | 使用同一适配检查，不给 summon |

如果手动锁定的召唤物尚未确认就超时，保留当前报价和 RNG，按原 ID 顺序寻找可兼容的非召唤物。找不到则沿原 empty-anomaly 兜底记 forfeitedChoices，不消耗 RNG、不发效果。并非授权主动换目标或重抽报价。

## R4a 权威报价历史与恢复

每次首次报价及成功付费刷新追加独立的 `MatchBase.anomalyOfferHistory`（`version=anomaly-offer-history-v1`，`facts` + `proof`）事实；不再让报价成为 `augment-history-v1` 的永久消费者：

```ts
{kind:'anomaly-offer',choiceId:'round:4-6:anomaly',definitionId:string,
 sequence:number,seatId:string,round:number,roundId:'4-6',resourcePrefix:number}
```

所有成功报价使用同一个 `drawAnomalyOffer`：当前已见数 <12 时排除全部已见；已见数 ≥12 时只排除最后一项。候选仍按 ID 排序、等权，沿原 `floor(uint32Word * poolSize / 2^32)` 映射；每次成功报价恰好消费 choice 流一词。前 12 项后不保留滚动 12 项黑名单。

- 历史不放进 pendingChoice；确认、确认后出售、合星、空席超时后仍保存。超时替换不合格召唤物目标时仅复用当前报价，不追加报价事实、不加刷新次数、不消费随机词。generation 是防旧令牌编号，允许因目标迁移而额外增加，不能再假设永远等于 rerollCount+1。
- 离线以首项前、可独立恢复校验的完整状态为 origin，仅记录首次报价到确认/作废这一段成功公共命令，逐命令重演资格、抽样、费用和目标变化。origin 是副本，不改写 before 的 WeakMap trace。报价结束后证明封存，只认证报价事实及最终选择收据；当前资源/装备/战斗继续由原有专项校验认证。已有强化消费者仍保留自己的原始证明及全程记录，报价 proof 仅标记 `{kind:"augment-history"}`，由已通过验证的完整强化重演同时认证报价节，避免重复重演同一 origin；删除强化历史不能把该标记当作离线证明；普通局不因异变开始记录死亡、全席 roster 或后续整局命令。
- 结构检查认证报价身份、前 12 项唯一、后续非连续、当前 offer/次数/最后选择的一致，以及从强化日程 seed 重推后的完整 choice RNG 词数；最终还要通过报价窗口命令重演；尚待选择时比较完整当前 state，确认后比较报价证明、选择收据及从已认证资源前缀跟随的目标谱系（出售/变形清除、合星迁移）。候选历史不自证。恢复缓存只存独立重演成功的私有规范文本，最多 4 个且文本总计不超过 4 MiB（UTF-16）；不保留候选对象或可变图；负零证据不复用缓存。
- 联机/本地房间从 4-6 起，`restoreSharedOrbSnapshot(pool,input,authority)` 必须提供 **独立的** `room.augmentHistoryAuthority(seatId)` 或 `captureAugmentHistoryAuthority(authoritativeState)`，包括空席或候选删除了历史的情况。其 WeakMap 检查点比较整份 state；不能把候选 JSON 自签成 authority。缺失沿原 `Invalid augment history: missing independent server authority`；内容不一致沿原 `server facts/state mismatch`。对象、JSON 和序列化文本统一拒绝篡改，不迁移旧档。
- 外层 schema/save/replay/command=12/8/8/7、规则 NET=5、WebSocket 封套保持原值；rules/content 升 `s13-g2-3-v26-online-rules` / `s13-14.24b-g2-3-v26-online-rules`，内容/战利品摘要随之更新。旧身份拒绝续玩。

## 全部生产调用点

| 路径 | 权威链路 / 适配职责 |
| --- | --- |
| WebSocket 联机 | `src/server/net/messages.ts` 校验既有 target/reroll/choose/sell/deploy → `Room.handle/apply` → `applySeatCommand` → Match 公共命令；出售经 `sellSharedUnit → sellUnit`，失败丢弃事务草稿、保留原卡池；部署经 `deployMatchUnit`。共享 choose/timeout 经 `runSharedMatchCommand` 原子结算。 |
| 房间超时 | `Room.continueRound` 定一次准备截止点 → 注入 Clock → `freezeAndResolve/applyTimeouts` → `resolveSeatTimeouts` → 共享 timeoutChoice → `forfeitPendingChoice` → 同一资格谓词/报价器/确认。 |
| 本地房间 | `src/rendering/online/local-room-client.ts` → Lobby/Room，使用完全相同的权威规则与时钟；投影沿 `toPrivateSeatView`。 |
| bot | `src/server/room/bot-driver.ts` → `decideBotAction`（anomaly target 使用公共名单）→ preflight → `Room.handleBot` / 公共命令。bot 不另抽报价；其主动命令沿手动资格，房间到期沿 timeout 资格。 |
| 单人 | `src/rendering/match-session.ts` 的 anomalyTarget/anomalyReroll/choose/buy/deploy/sell → 相同 Match 公共命令；无真实时间。 |
| 2D | `src/rendering/BoardScene.ts` 的 target/reroll/choose 回调 → 当前 Session；`strategy-panel.ts` 显示选择。新目标名单消费由 Claude 的 anomaly-ui 接入。 |
| 3D | `src/rendering/three-mode/` 使用 BoardScene/同一 Session 与通用 DOM 策略面板；无单独异变规则；侦察 `scout-stage.ts` 只读已绑定公开结果。 |
| 保存/恢复/重演 | `serialization.ts` → `serialization-structure.ts` → 强化/异变历史检查和 solo 命令重演；`shared-pool.ts` 恢复独立 authority；既有 `src/replay/` 命令分发仍调用同一 Match API。 |

## 被取代的旧断言（逐条）

1. 审计探针“4-6 入场 phase=choice / 30,000ms”：替换为真实 `enterRound` → preparation / 75,000ms。
2. “异变完成后再给 75,000ms”：替换为部分或全员确认后 deadlineAt 严格不变，到原截止点冻结。`economy-flow-1023` 的 after-choice 表项继续测配置，但不再单独作为异变流程验收。
3. “异变待选部署 wrong-phase、单人所有经济命令 wrong-phase”：仅异变准备选择例外开放部署/上下场/移动及其他合法经济操作；出售按用户第16条仍须 wrong-phase，扩展到所有棋子（含备战席和锁定目标），确认后可卖。单机、共享 Room 及真实 LocalRoomClient 均测试；拒绝保持原 state/卡池和完整事件序号，普通 choice 的旧禁令不删除。
4. “普通异变超时只检查己方、可选 summon”：替换为统一 predicate(timeout) 排 summon，含已经手动锁定的召唤物；没有普通目标时零消耗兜底。v23 手动 trainer-golem 断言保留，不能误当原版资格证据。
5. “每轮刷新只排上一项”：`m5-audit-boundaries` 四个独立 BigInt LCG 向量改为首次免费项也计数的初始 12 项排重；第 13 项起只排上一项，新向量验证旧项确实返回。
6. 恢复中的“target 子状态永远 offers=[] / generation=0”“offer generation 永远=rerollCount+1”：超时替换不合格召唤物、合星迁移仍可能保留旧报价及更大 generation，须历史与重演一致。自然对局验收改为待选禁售后保存恢复/继续刷新、确认后出售及封存证明不能复活已售目标；上一轮“卖出待选目标并重指定”的断言被第16条取代。
7. `t5r-private-seat-view` 的精确字段白名单：新增 anomalyTargetIds；RNG、未来计划、报价历史等继续隐藏。
8. “4-6 后无历史依赖强化就无需独立服务器 authority”：替换为从异变轮起必须给独立检查点，以同时认证报价存在和缺失；新增缺失/篡改拒绝断言。

9. 三份独立 oracle（`tests/fixtures/m5/oracle{,.t13,.g2}.cjs`）的“只排上一项”：oracle 自己累计观察到的报价，前 12 项排全部已见，之后只排上一项；不读取生产报价历史作为预期，重指定不得耗词。
10. `server/v17-avarice-helpers.ts`、`server/avarice-route.ts`、`server/net/v17-avarice-reconnect.test.ts` 的 Room `phase=choice` 等待：改为 preparation 且席位 pending anomaly，保留原 live-bank、实时收入、重连及单次结算检查。
11. `v15-anomaly-availability` 的手写 mage-armor 报价：先由逆 LCG 的真实 target 命令取得该报价，再穷尽每个剩余候选区间；两模式、三种目标，全部 6 项的精确候选数、费用和随机游标检查保留。
12. `d11-wiring-match` seed 10 在 R4a 下用尽刷新预算：换真实 seed 25，并在 4-3/4-4 通过原路线 reserve 保留收入；两个目标分别第 5/21 次付费出现，报价时有 94 金。保留实际付费、战斗、独立历史、唯一收据和恢复检查。
13. “D14 待选超时后才部署”：替换为 timeout 内先按人口上限部署、再用同一资格确认，新增两个 D14 的领域回归及真实 Room 截止点回归，检查目标 ID、已付报价、RNG、金币和不作废。
14. `m5-growth` 的 `augmentHistory=undefined`、`b8-late-claim-receipt-order` 的 `needsAugmentHistory=false`、`m4-ledger-bound` 的 `current resource fold`、`s13-anomalies-restore-review` 的原拒绝原因**未被新规则取代，原断言保留**；修实现以重新触达原检查。epic-loot 的新装备操作不应被不相关的后续整局强化重演拒绝。
15. `augment-pool-batch3-progress:141` 的精确字节断言**保留**。结构比对只有 rulesVersion、contentVersion、contentDigest、combatInputBasis.contentDigest、m8.loot.frozen.replayDigest 五项身份差异，无玩法字节差异；属于重录交接，不归因于历史开启。

16. `restore-audit/cd-replay-facts` 的 G-C06/C08 继续检查真实吸收、切割、鹰眼及 Mirror replay 的原拒绝原因。seed 49 的 R4a 鹰眼在第 151 次付费刷新才出现，原 4-5 reserve 只有 71 金；鹰眼分支从 3-5 起保留真实收入，仍取得 Wealthy Rehab II、仍通过完整战斗重演及三种篡改拒绝，不降级为合成状态。

## 验证和交接

前轮的“24 文件 361 项通过”仅为当时的窄范围运行，不能代表本次 Opus 的 128 文件回归。Opus 日志共 19 个失败文件（含收集失败连带）；基线同负载通过。本轮逐项复核，最终运行统计、仍失败的身份用例和性能证据记录于本文末尾，不将预期漂移计为通过。

实际入口：`npm test -- <相关文件> --configLoader runner --cache=false --maxWorkers=4`；共享 node_modules 只读，使用 runner 避免 Vite 临时配置写入 `.vite-temp`。CPU profile 另用 `node --cpu-prof --cpu-prof-dir=/tmp node_modules/vitest/vitest.mjs ... --pool=forks --maxWorkers=4`。不提高测试超时、不用 `--write`、不改 golden/epoch/历史素材。无浏览器测试需求；不运行会改写 bench-timing.json 的 playtest-1022b-bench。

### 需 Claude 统一重录（明确保留原字节）

- `m8-content-equivalence.test.ts` 读取 `tests/fixtures/v25-online-rules-recorded-states/{cannon,sniper}.json.gz`：已跑 138 项，其中 134 个旧档恢复用例因 `unsupported-version` 拒绝，另 4 项通过。这是旧身份准入的预期结果；没有修改断言来放行旧档。新 v26 录制及 loader/baseline 切换由 Claude 统一处理。
- `docs/evidence/v25-online-rules/battle-start-audit.json` 源码摘要只读核对发现 17 个已列入清单的文件漂移，另有新模块需纳入新纪元。保留历史审计与纪元文件，联合生成 v26 证据，不覆写 v25。
- 联机私有快照增加 anomalyTargetIds，异变准备期间 itemSummons 也保留；规则/内容身份、4-6 阶段/时钟、报价序列/随机游标/事件与后续战斗输入均可能漂移。联机回放、B8 指纹、转移路线和整局 golden 等由 Claude 用统一 v26 规则重录。本单没有伪造这些快照或刷新其哈希。
- Opus 指定的身份失败逐项保留：`opening-random-identity` 的 v25 源码/内容摘要；`d14-anomalies-source` 的冻结源码摘要；`d11-wiring-bank` 的 CONTENT_DIGEST；`m5-route` 的 golden rulesVersion/后续指纹；`epic-loot-reforger` 的 prior-epoch/version 断言和旧 5-7/6-7 存档；`m8-b8-live-transfer` 的 v25 transfer-route 锚点；`augment-pool-batch3-progress` 的 pre-spoils-v25 精确字节。Claude 统一录制 v26 并切换对应 fixture/loader；不把这些用例 skip、不改成只检查“能拒绝”、不手工替换 hash。
- 前端还需消费公共目标名单、解除其单人/2D/3D 的旧 choice 操作显示门禁，并将时限读为 Room preparation.endsAt。服务端和规则命令已完成；不把 UI 尚未接线算作浏览器验收通过。

### 关键修改位置

| 文件 | 节点 |
| --- | --- |
| `src/server/room/room.ts:883` | 4-6 入轮唯一准备时钟 |
| `src/simulation/match.ts:168` / `:203` / `:305` / `:393` | 待选身份跟随、空席保护、编辑门禁、购买不覆盖保留报价 |
| `src/simulation/match.ts:405` / `operation-policy.ts:9` | 全体待选禁售及参与摘要的禁售政策 |
| `src/simulation/anomaly-choice.ts:16` / `:25` / `:37` / `:47` | 共用资格、公共名单、初始12抽样、权威事实 |
| `src/simulation/match.ts:824` / `:861` / `:901` | 目标、刷新、超时调用同一资格边界 |
| `src/simulation/anomaly-history.ts:16` / `:28`，`anomaly-history-restore.ts:16`，`serialization-structure.ts:445` | 仅报价窗口取证、复用已认证强化证明、纯文本恢复缓存与目标谱系 |
| `src/simulation/private-seat-view.ts:78` | 前端 anomalyTargetIds 字段 |
| `src/server/room/projection.ts:195` | 异变待选的准备召唤物投影 |
| `src/simulation/restore-checks/anomaly-offer-history-check.ts:8` / `shared-pool.ts:92` | 报价/游标一致与独立服务器恢复 authority |

【需要我决定】无。用户第16条已确定待选禁售；魔像/假人未证实的手动资格、R6/R7 维持原状。卖后重买保留异变属于 R5，由后续任务处理。
【风险】界面门禁及新目标字段待 Claude 接入；旧存档和录制身份已失效；正式联机/本地房间恢复从4-6起须提供独立检查点，不能从候选快照自签。


### 性能诊断（本轮修复）

CPU profile 与诊断脚本仅存 `/tmp`。同一 seed 78 sniper、同一 R4a 抽样、33 场实际战斗，临时 bundle 回装旧“报价开启永久强化历史”开关作对照：`/tmp/v26-profile-before.log` / `v26-profile-after.log`。这是一轮诊断复现，非稳定性能基准。

| 指标 | 永久开启历史的对照 | 报价窗口独立证据 |
| --- | ---: | ---: |
| 确认后 CPU | 52,579 ms | 29,992 ms |
| 确认后墙钟 | 44,143 ms | 22,039 ms |
| 终局强化事实 | 6,822 | 0 |
| 保留报价事实 | 2 | 2 |
| `recordAugmentTransition` 自耗时采样数 | 1,357 | 16 |

采样确认额外开销来自逐 tick 的战斗/死亡历史记录、历史数组扫描及比较，并非 12 项候选过滤。修复后仍保留全部报价及独立重演证据；恢复也只重演报价窗口。正常负载验收以原测试的 5s / 20s 上限为准，没有改动 timeout。


### 第二轮验证清单（上一轮日志，保留）

以下为第二轮分批运行，均未重录；当时最后一次每文件结果汇总为 **44 个相关文件，4,387 项通过、147 项仍失败，另 1 个文件在身份锚点处收集失败**。7 个未全过文件均属于上文保留的旧纪元证据；不能描述为“全回归通过”。未重新运行 Opus 全部 128 个文件，也未作浏览器验收。第16条补充决定后的第三轮结果另列下节，不把旧禁售前用例计为本轮通过。

| 分批日志（均在 `/tmp`） | 当次原始结果 | 说明 |
| --- | --- | --- |
| `v26-regression.log` / `.json` | 12 文件：3,937 通过、1 失败；另 1 文件收集失败 | 三组 v17 avarice 路线全部通过；G-C08 鹰眼预算随后修复；B8 收集已到达旧摘要锚点 |
| `v26-critical.log` / `.json` | 8 文件：129 通过、3 失败 | 原资源/战斗篡改检查、G-C06/C08、D14 均通过；3 项为 epic-loot 旧身份 |
| `v26-remainder.log` / `.json` | 9 文件：95 通过、145 失败 | 含 144 项身份/字节断言和 1 项中途 dual-wielding 60s 超时；重复证明开销已修复，见末行 |
| `v26-final.log` / `.json` | 31 文件：463 通过、3 失败 | dual-wielding 已通过；3 项仍为 epic-loot 旧身份；包含逻辑准备时钟的报价证明恢复回归 |
| `v26-verification-summary.json` | 44 文件最后结果去重汇总 | 37 文件全过，7 文件等待统一重录；无剩余非身份失败 |

仍失败的具体清单：

| 文件 | 待重录断言数 | 原因 |
| --- | ---: | --- |
| `opening-random-identity` | 136 | 134 个 v25 checkpoint 拒绝，1 个内容身份绑定、1 个首战轨迹状态哈希；冻结源码审计同样待统一重录 |
| `m5-route` | 4 | 四条实际对局都先命中 golden rulesVersion 门禁；独立规则/资源 oracle 已执行 |
| `augment-pool-batch3-progress` | 2 | 上述五项身份字节差异，原 gameplay 数据一致 |
| `d11-wiring-bank` | 1 | CONTENT_DIGEST |
| `d14-anomalies-source` | 1 | CONTENT_DIGEST |
| `epic-loot-reforger` | 3 | 旧 5-7/6-7 存档 unsupported-version 两项、v25 版本断言一项 |
| `m8-b8-live-transfer` | 收集失败 | 独立 oracle 已不再阻塞，现命中 v25 transfer anchor CONTENT_DIGEST；尚未执行后续场景 |

最终 4-worker 运行：epic-loot 联机加时 **664 ms / 原 5,000 ms**；m8-b6 的 6-5 / 6-6 / 6-7 恢复分别 **4,646 / 5,019 / 4,488 ms / 原 20,000 ms**；dual-wielding 完整命令生成/重演/恢复 **43,081 ms / 原 60,000 ms**。没有提高超时。`m5-growth`、`b8-late-claim-receipt-order`、`m4-ledger-bound`、`s13-anomalies-restore-review` 的原断言保留并通过。

第二轮最终 `npm run typecheck`、`node scripts/update-content-identities.cjs --check`、`git diff --check` 均通过。当时 CONTENT=`fnv1a32-utf16:5bcf8835`，LOOT=`fnv1a32-utf16:4c16c970`。未执行 `--write`、未改动历史录制/素材、未运行 bench、未写 `.git` 或提交。

### 第三轮：第16条补充决定与 Opus 1–9 复核

待选禁售由 `match.ts` 的 `execute_sellUnit` 最前置门禁执行，复用 `wrong-phase`；`operation-policy.ts` 增加参与内容摘要的 `anomalySaleVersion='pending-choice-refuse-all-v1'`。新摘要经只读计算后同步常量：CONTENT=`fnv1a32-utf16:7b8283ad`，LOOT=`fnv1a32-utf16:9af7b4d0`，规则/内容仍属未发布 v26。没有使用 `--write`，没有重录旧证据。

| Opus 项 | 本轮确认及保持的结果 |
| --- | --- |
| 1 独立 oracle | 三份 `oracle{,.t13,.g2}.cjs` 均独立维护观察报价，前12项全排、之后仅排上一项；不从生产历史取预期。 |
| 2 房间路线 | `v17-avarice-helpers.ts`、`avarice-route.ts`、`net/v17-avarice-reconnect.test.ts` 继续按 preparation 中的 anomaly 待选定位；live-bank/收入/重连/唯一结算检查保留。 |
| 3 候选与预算 | `v15-anomaly-availability` 保留两模式三类目标的全候选/费用/游标检查；`d11-wiring-match` 继续 seed25 + 4-3/4-4 收入预留的真实付费路线。 |
| 4 历史连带 | 报价继续独立窗口证明，不启用永久强化历史；原 `m5-growth`、`b8-late-claim-receipt-order`、`m4-ledger-bound`、`s13-anomalies-restore-review` 断言未改。batch3-progress 的五项身份字节差异仍交统一重录。 |
| 5 性能 | 第二轮的窗口证明/复用强化证明/有界文本缓存修复均保留；没有提高任何 timeout。 |
| 6 身份交接 | 上节7文件及旧纪元/源码摘要/快照清单完整保留；本轮禁售策略再改变内容摘要，统一录制应使用本节新值。 |
| 7 D14 超时 | 仍在领域 timeout 内先部署，优先锁定 D14 备战席目标，再走统一资格；领域两个 D14 与真实 Room 截止点回归保留。 |
| 8 防失败放行/输入污染 | `shared-pool.ts` 仍用 `!(round < anomalyRound)` 要求独立 authority；`recordAnomalyOffer` 只追加 after 的事实，报价 origin 复制 before，不改写 before 的 WeakMap trace。 |
| 9 合同及验证 | 旧断言逐条替换清单、真实测试结果与重录清单保留；删除待选出售后换目标的合同授权及待决定项，补充全体禁售、隐藏界面边界和 R5 另单范围。 |

本轮新增/替换用例：`v26-anomaly-choice` 覆盖单机/联机，未选目标/免费报价/付费报价、锁定/未锁定、场上/备战席及锻造器出售快捷路径；`server/v26-anomaly-preparation` 通过共享 Room 和真实 LocalRoomClient 验证相同规则、全局原引用/卡池/事件序号不变、隐藏后可用的部署/上下场/移动命令、确认后恢复出售及截止点不变。`t10-combat-ops`、`m5-audit-boundaries`、`epic-loot-reforger` 中旧待选出售路径改成禁售、真实确认/超时及原费用/恢复/防篡改目标。卖后重买的异变保留由 R5 另单实现，本单不把旧清绑定行为标为 R5 通过。

本轮最终相关验证共 **45 文件，4,395 项通过、147 项旧身份断言失败，另1文件在旧摘要锚点收集失败**；38 文件全过，6 文件包含身份断言失败，1 文件未收集后续场景。失败仍为上节同一7文件/同一数量，无剩余非身份失败；不宣称全量128文件或浏览器验收通过。新增选秀暂存出售门禁的既有规则回归 `p7-1-carousel-rules` 8项全部通过。全部 Vitest 运行保持 `--maxWorkers=4`，不提高超时。

| 本轮日志（`/tmp/`） | 最终结果 |
| --- | --- |
| `v26-round3-changed.log` / `.json` | 5文件：106通过、3失败；3项均为 epic-loot 旧纪元，待选禁售/部署/确认后出售/付费报价恢复用例全部通过 |
| `v26-round3-regression.log` / `.json` | 其余40文件：4,289通过、144旧身份失败，另1文件旧摘要锚点收集失败 |
| `v26-round3-verification-summary.json` | 合计45文件去重汇总；贪欲draw/earnings/reconnect、R7复制品、G-C06/C08、D14及历史连带原断言均通过 |

性能复测：epic-loot 联机加时 **636ms / 原5,000ms**；m8-b6 的6-5/6-6/6-7恢复分别 **3,554 / 3,895 / 4,041ms / 原20,000ms**；dual-wielding 公共选择/命令重演/恢复 **35,680ms / 原60,000ms**。原检查目标、数值断言和时限全部保留。

本轮 `npm run typecheck`、`node scripts/update-content-identities.cjs --check`、`git diff --check` 通过；核对完整服务器增量无新增 `setTimeout/Date.now/performance.now/window`。未执行 `--write`，未改动旧epoch/golden/素材或 `.git`，未运行会重写 bench-timing.json 的 bench 测试，未提交。前端“打开锁盘/隐藏调阵”与R5继续交各自任务。
