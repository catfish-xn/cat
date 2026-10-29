# D2 假装摸鱼（未开放候选）

依据：`codex-briefs/d-common.md` 已批准规则 3、4、5；独立数值源为研究 JSON 的 `TFT_Augment_BRB`（RoundsToSkip=3、anvils=2）。`content/augment-brb.ts` 只导出声明，未加入 `AUGMENT_DEFINITIONS`、档位表、API 名称表或出现阶段禁令。D5 统一注册黄金 `brb`，只在 2-1 出现，并处理规则/内容身份。

## 权威效果与失败

- `brbShopDisabled(state: Pick<MatchState,'augments'|'round'>): boolean`：取得自然轮 a 到 a+2 为 true；不按 PvP 场数计数，PvE 和选秀均消耗一轮。正常 2-1 取得，禁用 2-1/2-2/2-3，2-4 入轮恢复。
- 玩家购买、出售英雄、手动刷新、购买经验、锁店均返回原 `state`、`wrong-phase`，没有事件、费用或 RNG 消耗；共享池失败同时保持原 pool 引用。开已有锻造器属于原选择流程，不是出售英雄；装备与工具沿用既有命令规则。
- 系统入轮刷新、收入/经验、超时选择、自动布阵、选秀移动/自动选择、战斗与结算不经过上述商店限制。单机 Start 在 brb 期间复用同一个确定性补阵算法；联机继续由 Room 在截止时调用公共 `autoDeployToCap`。
- 玩家仍可调整站位、整理备战席、上下棋子，人口、部署区域和战斗阵容锁照常校验。
- `brbGiftPlan(state: MatchState): AugmentGift[]`：缺少已认证 acquire 事实抛 `RangeError('Invalid augment history: ...')`；a+3 入轮起派生两份 `TFT_ArmoryKeyCompleted`。唯一 receiptId 沿用 `planAugmentGifts` 的座位/choice/definition/index/copy 命名空间；重复推进、恢复、领取不会再次授予。满席保留权益，后续腾位由既有 gift drain 重试。到期前淘汰不发；到期后淘汰保留已有出生证据。
- 2-4 可以收到锻造器单位，开启仍沿用原有非 supply 轮限制。恢复折叠只允许 `brbGiftPlan` 中的两份成装锻造器：逐项核验 source、receiptId、unitId、held、0 金币、轮号及 definition；普通单位的 supply 出生约束保留。

## 任意海克斯选择期间布阵

`validateMatchDeployment` 在 `isAugmentPreparationChoice`（augment、returnPhase=preparation）期间接受单机与联机布阵。原 pendingChoice、generation、候选和选择 RNG 不变；其他选择类型、阵容锁、淘汰席位仍按原规则拒绝。联机已有 `ROOM_COMMAND_GATE.preparation/choice` 与 `applySeatCommand('deploy')` 接口接受该命令，无需增加网络命令或服务器计时器。

前端 `StrategyPanel` 在单机、联机共用海克斯弹窗加入收起/展开入口，两个按钮最小点击区域 44×44 CSS px。收起状态按 choiceId 保留，布阵导致描述刷新或 generation 更新时不会强制展开；选择结束/切换到另一选择时清理。隐藏是本地展示状态，不提交 choose、不暂停/重置服务器截止时间。`BoardScene` 的2D拖拽和3D共用拖拽回调均使用同一个布阵阶段判断。

## 调用点

| 入口 | 既有调用链与本次接入 |
| --- | --- |
| 单机 | MatchSession → Match 商店/布阵命令；Start → 共用补阵；nextRound → drainP2Gifts → batch1GiftPlan → brbGiftPlan |
| 联机服务端 | Room.handle → applySeatCommand → buySharedUnit/rerollSharedShop/sellSharedUnit/sellPendingCarouselUnit/runSharedMatchCommand；Room.autoDeploy → autoDeployToCap；nextSharedRound → nextRound |
| 浏览器本地房间 | LocalRoomClient 使用同一 Room 与 simulation；无第二套计数/结算 |
| bot/接管 | BotDriver → decideBotAction → legal 公共命令预检 → Room.handleBot；布阵照常，受禁商店意图不会通过预检 |
| 2D/3D | 共用 StrategyPanel + BoardScene 拖拽回调 → MatchSession/RemoteSession → 原命令；选秀走既有 walkLegend/carousel-pick，无 brb 禁令 |
| 保存恢复 | 对象/JSON/序列化文本走原历史认证和 receipt 校验；联机仍要求独立 AugmentHistoryAuthority；b8/shop-history 折叠仅接收规则派生 brbRewards |

## 验收与保留事项

专项测试只在隔离模块图中以 BRB 替换一张黄金卡，保持生产候选池未注册、内容数量断言不变。覆盖公开选择、三轮期限、命令失败原子性、自动布阵、真实 Room 截止推进、选秀移动/自动领取、满席重试、两锻造器使用和恢复/篡改拒绝。

相关 7 文件共 264 项测试通过（`--maxWorkers=4 --configLoader=runner`）；`npm run build -- --configLoader=runner`（含 typecheck）通过，2D 顶层 JS gzip 为 631,003 字节，低于 637,144 上限，未新增 lazy chunk。

v25 内容身份检查通过；全纪元 check 在 input/battle-start/release 审计及 Herald manifest 的源码 SHA 字段失败，失败前对应对局 fixture、raw state、回放重建均通过字节比较。未运行任何 --write、未重录或改动纪元证据；源码审计摘要与 D5 统一处理。日志在 `artifacts/d2-brb/epoch-check.log` 和 `artifacts/v25-online-rules-recording/`。

当前未提供 CODEX_BROWSER_CLIENT/PLAYWRIGHT_WS_ENDPOINT，按 AGENTS.md 不自行启动 Chromium。按钮实际尺寸及2D/3D拖拽需由 Claude 使用 `codex-browser exec` 新启动浏览器测试任务验证。
