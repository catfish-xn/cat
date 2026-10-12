# T5R 派工单：加时推进入口、去随机流私有投影、战斗回放投影

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/UI_REQUESTS.md` SR-B4-01、SR-B1-06、SR-B1-07；合同 §10.9、§11.5

## 0 先读
- T7（PR #44）已合入。Claude 的 B4（整轮提交）正在最后验证，B5（卡池接入）、B6（机器人调度）随后。
- 本单三件事互相独立，可一个 PR 交付，也可拆两个；都不改 `src/server/`、界面、golden。Node 22。

## 1 加时推进入口（SR-B4-01，P0）
合同 §11.5 已定稿加时规则，但缺公开入口。房间在 6-7 结算后若仍有 ≥2 席存活，目前以 `overtime-unavailable` 明确中断。
- 提供 `advanceMultiplayerRound(state, expectedRound)`（或在 `nextSharedRound` 上扩展）：目录末轮之后进入 `overtime-N` 轮，`roundDefinition.kind='pvp'`、`isFinal=false`、基础伤害沿用末阶段（12）、经济与商店照常、不新增野怪/强化/奖励；与共享池的 `nextSharedRound` 兼容（加时轮也要统一归还与轮换刷新）。
- 测试：连续 5 轮加时经济与商店正常；双空阵容平局各自扣血；全员同轮归零由房间排名（规则侧只保证状态合法）；单人路径零改动。
- 合同 §11.5 补上入口签名与失败枚举。

## 2 去随机流的本席私有投影（SR-B1-06，P0 上公网前必需）
现在网络 `state` 消息是完整 `MatchState`，含 `rngState`、`battleSeedRngState`、`choiceRngState`、`rewardRngState`、未来掉落计划、`resourceProvenance`、`combatInputBasis`。
- 提供 `toPrivateSeatView(state): PrivateSeatView`，按合同 §10.9 白名单构造（版本/进度、商店（含 `empty` 空格标记）、己方棋盘与备战区、装备与临时件、已拥有强化/异常/成长、当前已展示选择、已提交轮结果、HP/金币/等级/经验/连胜败）。**不含**任何随机流、未来计划、来源账本、战斗输入基础。
- 界面侧现在直接拿 `MatchState` 渲染（策略面板的选择器都吃 `MatchState`）。请把 `PrivateSeatView` 设计成**结构上是 `MatchState` 的子集**（相同字段名、相同嵌套），这样 Claude 只需把缺失的私有字段用占位填回即可继续用现有选择器；在合同里列出哪些选择器只依赖白名单字段。
- 测试：改变隐藏字段（随机流、未来计划）投影输出不变；哨兵字段永不出现；投影不改输入。

## 3 战斗回放投影（SR-B1-07，P1）
现在战斗帧是逐 tick `CombatState`，压缩后整局 7 MB，浏览器仍要解析完整 JSON。
- 提供 `toCombatReplay(battle): { initial: CombatViewState; ticks: { tick, events: CombatViewEvent[] }[]; terminal: CombatViewState }`：首帧与末帧完整视图，中间只给事件账本（去掉内部字段）；并说明客户端如何仅凭事件更新血量/法力/位置/护盾（事件清单与字段含义）。
- 若你判断"仅凭事件无法稳定重建单位状态"，改为"每 N tick 一个关键帧 + 事件"，N 写进合同并给出体积估算。
- 测试：同一场战斗，回放投影的末帧与 `terminal` 一致；投影不含 `rngState/rngDraws` 等私有字段。

## 4 验收
- [ ] 三项各有 `t5r-*` 测试与合同条目；typecheck、build、`test:server-entry`、`verify-t2/t3/tp/t7` 通过；T1 哈希不变；golden 零改动。
- [ ] PR 描述逐条回应 SR-B4-01、SR-B1-06、SR-B1-07，并给出 Claude 接入点（B7 投影接线、B4 的 `advanceRound`）。
