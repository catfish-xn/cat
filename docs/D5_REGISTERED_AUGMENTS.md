# D5：四张强化注册与阶段禁令（v26）

第 0 步由 Claude 提交在本分支 `b2dad8d6`，本次从干净工作区继续，不重解 D3 冲突，不写 `.git`。

## 研究数据与候选池

只读依据：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`。
`content/augment-pool-d5.ts` 原样保存四张卡的全部 `item_tags_raw` 和品级，统一导出定义、API 名和品级映射。
沿用阶段标签解释：`{d02ae323}` / `{d12ae4b6}` / `{d22ae649}` 分别表示禁 2-1 / 3-2 / 4-2。

| ID / 研究 API | 品级 | 研究阶段标签（原样、按源顺序） | 可出现阶段 |
| --- | --- | --- | --- |
| what-you-really-are / TFT13_Augment_Grant6Cost_Warwick | 棱彩 | `{d02ae323}` `{d12ae4b6}` | 4-2 |
| brb / TFT_Augment_BRB | 金色 | `{d12ae4b6}` `{d22ae649}` | 2-1 |
| over-encumbered / TFT11_Augment_OverEncumbered | 银色 | `{d12ae4b6}` `{d22ae649}` | 2-1 |
| restart-mission / TFT_Augment_RestartMission | 银色 | `{d02ae323}` `{d22ae649}` | 3-2 |
| why-not-both / TFT13_Augment_Formswapper | 金色 | `{d02ae323}` | 3-2、4-2 |
| blood-brothers / TFT13_TeamupAugment_BloodBrothers | 棱彩 | `{d02ae323}` `{d22ae649}` | 3-2 |
| academic-research / TFT13_Augment_Academy | 金色 | `{d22ae649}` | 2-1、3-2 |
| forbidden-magic / TFT13_Augment_Cabal | 金色 | `{d02ae323}` `{d22ae649}` | 3-2 |
| natural-selection / TFT13_Augment_Experiment | 金色 | `{d02ae323}` | 3-2、4-2 |

学院、黑玫、试验品三处禁令在起始提交已存在；D5 补另外两处，逐一验证最终 augmentCandidates 的结果，不扩展到同羁绊的徽/冕。既有羁绊筛选、已见排除、互斥和全席唯一规则继续生效。

## 命令、数据和调用点

- selectChoice / runSharedMatchCommand(choose)：签名和失败枚举不变，失败保持原 state/pool，无事件、资源或 RNG 消耗。取得 brb 自动解锁，不刷新商店、不改 generation、不消耗 RNG；shop-history 同步记录并在恢复折叠中重演。
- whatYouReallyAreProgress(state): {count:number; completedRound?:number}：从取得当轮起读取 D0 实扣血。移除历史所有者的 player-damage 占位声明，因为那是本席受到的伤害。仍严格比较结果与收据；有 settlementId 的结果不能缺对应收据。旧直调结算两边都不带 damageDealt、或本地占位战斗使用既有 round-N-settled 单席身份且无 D0 收据和 damageDealt 时跳过，不推算伤害；单人计数保持 0。
- applyRestartMission(state): {state:MatchState; events:readonly MatchEvent[]}：combat 调用显式抛 RangeError。清除 preparation 中所有非锻造器我方棋子；真实选秀暂存存于 carousel 元数据，本来就没有棋盘/备战席位置，其物品在库存。删除无效 pending ID 过滤，修正夹具为真实形态。
- traceBoundUnitIdentity(originalId, facts): string|null：unit-removed 与 unit-sold 一样终止身份链；D14 恢复校验同步识别移除前最终身份。
- projectG23Summons(...)：黑玫三档以上而没有场上成员时抛 RangeError('Black Rose summon requires a fielded member')，不生成缺所有者的赛恩 ID。
- 单人：Match → MatchSession.claimOrb → 公开 claimOrb → commit/通知；暂停仍原子拒绝。失败保留既有 MultiplayerFailure 原因，BoardScene 只扩展接收类型。
- 联机：Room.handlePlayer/handleBot → shared command。浏览器本地房间 LocalRoomClient.send 走相同入口，two-sided / placeholder 都覆盖。src/server 不新增时钟或规则。修复既有 placeholder PvP 被普通 startCombat 门禁拒绝的问题：PlaceholderBattleResolver 在 PvP 仅编排调用内部共享命令 startPlaceholderCombat / stepPlaceholderCombat；该命令不属于玩家 WireCommand。领域导出 startPlaceholderMatchCombat / stepPlaceholderMatchCombat(state, unitLootPolicy?): MatchCommandResult，要求 multiplayer + PvP，沿用全部其余开战检查、现有战斗引擎和原子拒绝原因 wrong-phase；普通 startMatchCombat 仍拒绝多人 PvP、stepMatch 仍不推进多人 PvP，正式对战仍走双方解析器。
- bot：BotDriver → decideBotAction/preflight → 同一公开选择命令；领取仍走 claimBotPreparationOrbs。占位房间测试复用既有 sliceTicks 调度接缝，并按单席解析任务分段验证，仍运行每个战斗 tick，未改超时或阈值。脚本抽样集成夹具只控制真实候选池内抽牌，不绕过品级、阶段或命令合法性；brb 单人/Room 原有集成继续使用自然种子。
- 2D/3D：共享 augment-display 的名称、说明、动态数值和图标/文字徽章回退。四卡说明位于无 import 的 presentation/augment-pool-text.ts，已有 vite augment-text 分包进入 assets/ui。3D 不另算规则；无新增美术素材。

## 断言与夹具替换

不删测试或弱化校验。阶段审计原来预期的变形者/本可发生之事两条差异，替换为修复后的精确禁令断言与四卡覆盖数断言；仅保留原有 TableScraps 用户覆盖与原始标签不一致这一条审计差异。D1/D2/D3/D4 的“尚未注册/没有品级/不在任何候选池”断言，被正式注册、精确品级和阶段矩阵断言替代；删除相应临时定义/品级 mock，改测生产注册。
原 D1 缺 D0 一律拒绝的断言，被“无 D0 的旧格式成功但计数为 0；单边缺失、缺收据及冲突数值继续拒绝”替代。
重启任务暂存夹具由“pending 同时在棋盘中”改成“heldCarouselUnits 与 pendingUnits 同一无位置身份，物品在库存”，保留完整暂存和物品断言。

`over-encumbered-gift-restore.test.ts` 的 D3 历史容量用例需要同时持有仅 2-1 的美酒与运力不足，生产中无法同时取得。该文件明确作为合成准入夹具，局部开放运力不足 3-2 并保持原品级序列；保留全部延迟发放、三种恢复、篡改拒绝及无空位断言。独立 d5-registration 测试严格验证生产禁令，其他 D3 流程使用生产注册。

## 纪元与验收交接

规则/内容标识推进至 s13-g2-3-v26-online-rules / s13-14.24b-g2-3-v26-online-rules；schema/save/replay/command 不变。内容定义、候选池、禁令、历史所有者和源码 SHA 均有预期变化；不运行任何 --write，不改 identity-constants 或历史证据。Claude 需统一计算新身份并录制 v26。

受影响检查：update-content-identities --check、旧 v25 epoch 的源码/内容/输入/输出快照与 digest 比较、当前内容基线/offer-oracle、固定种子的强化公开路线，以及依赖这些种子的 replay/herald/release/live-reveal/transfer/chest-trial 证据。v24 及更早已发布证据保持原字节；不能更新旧证据绕过新纪元。

浏览器未提供 CODEX_BROWSER_CLIENT / PLAYWRIGHT_WS_ENDPOINT；本次仅做领域、应用适配器、DOM-free 本地房间和共享展示函数检查。真人浏览器验收需 Claude 经 codex-browser exec 新启动任务。


## 最终验证记录（2026-10-29）

- 18 个相关测试文件合计 924 项通过，均使用 --maxWorkers=4；占位模式长程用例按单席解析任务拆分，所有原断言保留，没有提高超时或阈值。
- typecheck 与生产构建通过。共享 node_modules 只读，本沙盒使用 configLoader runner 和 artifacts/d5 下的临时测试缓存配置；仅去掉不需要的全局浏览器启动，测试与工作者清理保持原样。
- 最终 2D 顶层 JS level-9 gzip：635,605 B（index 511,706 + Phaser 123,899），上限 637,144 B，余量 1,539 B，比用户提供的 636,519 B 基线减少 914 B。新增说明在既有 assets/ui/augment-text 中，成品确认无静态/动态 import。
- playtest-1022b-bench 通过，bench-timing.json 已按 HEAD 原字节恢复并用 git diff 核对；.git 只读，没有 git add/commit。
- 独立阶段 CLI 审计：312 条源记录、274 个池条目、227 条已交付禁令；D5 两条差异消除，仍精确报告既有 TableScraps 用户覆盖这一条差异，测试没有隐藏它。
- update-content-identities --check 按预期失败：重算 contentDigest 为 fnv1a32-utf16:91708ea6、lootReplayDigest 为 fnv1a32-utf16:a6e5c7bf；生成常量未改，不执行 --write，需由 Claude 统一重算录制。
- tests/d14-wiring-match.test.ts 在加载公开 4-5 路线时，被 tests/fixtures/m5/oracle.g2.cjs:617 的旧 seen-once 候选池断言拦住：原 superstars-ii / wandering-trainer-i 变为 starry-night / voidcaller；尚未进入 D14 测试体。这属于候选池变更后的 oracle/路线重录影响，保留断言，未修改旧 oracle；unit-removed 身份链的独立向量已通过；D14 专属正式恢复路线须在 oracle 更新后复验。
- 无浏览器连接，未进行桌面 2D/3D 真人画面验收；需 Claude 用 codex-browser exec 启动后复验。
