# T7 派工单：基础机器人的纯策略函数

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/MULTIPLAYER_RENOVATION_V2.md` N5；`AGENTS.md` 分工（规则侧出纯策略，房间调度由 Claude 做）

## 0 先读
- TP（PR #42）已合入。Claude 正在做 B4（结算提交）和 B5（卡池接入）。机器人上线要等 B5，但策略函数可以先写。
- 关于"奖励缺货补一星购买价金币"：这条是你在 TP 里定的，我已提请用户确认；用户若改口再调 §12 配置。
- Node 22；既有超时测试不修。

## 1 目标
一个**纯函数**：给定机器人席位的 `MatchState`（以及合同允许它看到的公开信息），返回**一步**合法意图或"本回合结束"。不碰网络、不碰房间、不直接改状态；房间侧（Claude 的 B6）负责每轮按步数上限反复调用、执行、再读新状态。

## 2 范围
分支 `codex/t7-bot-policy`，可改 `src/simulation/bot/`（新目录）、`src/server-entry/`、`tests/`、`scripts/`、合同。不改 `src/server/`、界面、现有规则与 golden。

1. 导出 `decideBotAction(state: MatchState, context: BotContext, rng: number): { action: ClientCommand | 'done'; rng: number }`。`ClientCommand` 形状见 `src/server/protocol.ts`（只做 `import type`）。`rng` 是显式 `lcg32-v1` 状态，由房间持有并回传；不用 `Math.random`。
2. `BotContext`：难度（首版只有 `basic`）、本回合已执行步数、步数上限、本席公开信息（HP、轮次、对手席位公开阵容可选）。
3. 首版策略覆盖：基础经济（保利息阈值、后期花钱）、购买与升星（优先凑三张、优先费用高的）、买经验到人口上限、合法站位（前排近战后排远程，用现有单位定义的射程）、合法装备（合成与穿戴，不非法）、所有选择节点（强化/异常/组件选第一个合法项）、满备战区先卖最低价、不买买不起的。
4. 每步返回前用现有公开校验预检（`validateMatchDeployment`、`matchStartFailure` 等）；房间执行失败时策略不应陷入同一动作（上下文带"上一步失败原因"，策略换动作或返回 `done`）。
5. 测试 `t7-*`：同输入同输出；单回合在步数上限内必返回 `done`；在固定种子的开局状态上连续 20 回合（用现有单人 `nextRound` 推进即可）全部动作合法、无死循环；满备战区/金币不足/人口满/装备冲突各有用例；每个选择节点类型都有用例。
6. 合同新增第 13 节：签名、上下文字段、保证（纯、确定、有限步）、与 B6 调度的约定（每轮上限、失败回传）。

## 3 验收
- [ ] `t7-*` 全绿；typecheck、build、`test:server-entry` 通过；golden 零改动。
- [ ] 一个 Node 冒烟脚本 `verify-t7-node-entry.cjs`：单人 createMatch 下用策略打完整局到 gameOver，无非法命令。
- [ ] 合同第 13 节能让 Claude 只看文档实现 B6（机器人调度与断线接管）。
