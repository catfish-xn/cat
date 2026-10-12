# T3 派工单：整轮结算事务与唯一收据

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/MULTIPLAYER_CONTRACT.md` §10.7 末段与 §10.10 的 T3 最小范围（你自己写的，已采纳）；`docs/UI_REQUESTS.md` 的 SR-B1-02、SR-B1-03、SR-B1-04

## 0 先读
- PR #36（T2）已合入 `multiplayer`；Claude 的 B3 正在把房间接到 `resolveTwoSidedBattle`，并把提案暂存在 `RoomState.pendingProposals`，等你的提交入口。
- Node 22；`tests/m5-replay.test.ts` 既有超时不修不改阈值。

## 1 目标
一个公开命令把**整轮**所有提案一次性、原子地写进席位状态：扣未截断伤害、发收入与经验、回写成长、追加 `roundResults`，用唯一 `settlementId` 去重。PvP 路径不再走单人 `withCombat` 的内部扣血和自动 `gameOver`。

## 2 范围
分支 `codex/t3-round-settlement`，可改 `src/simulation/`、`src/server-entry/`、`tests/`、`scripts/`、合同。不改 `src/server/`、界面、单人 golden。

1. `applyRoundSettlement(state, receipt): MatchCommandResult`（名字可按合同定）。`receipt` 含 `settlementId`、`battleId`、`round`、本席 `damage`（未截断整数，由房间从 `SideProposal` 转交）、`growth`、以及收入所需输入。重复 `settlementId` 返回原 state 与 `duplicate-settlement`；镜像提案（`settlementEligible=false`）拒绝；轮次不匹配拒绝 `stale-round`。
2. 同轮多席结算由房间逐席调用，但你要保证单席命令本身原子；房间侧"收齐再提交"由 Claude 做。
3. 经济：收入、利息、连胜败、经验沿用现有 `settleRound` 数值，写明复用了哪些函数；HP 归零后该席状态为 `eliminated`（或等价），不是单人 `gameOver`。
4. SR-B1-03 **合同**：加时轮（目录末轮之后只 PvP，沿用末阶段基础伤害，不新增野怪/强化/奖励）的 `nextRound` 推进方式与平局扣血、同轮归零破同分规则，写进合同第 11 节；实现可放 T4 但合同必须定稿。
5. SR-B1-04：两个不花资源的超时命令：`forfeitPendingChoice`（放弃当前选择，不发奖）和 `claimOrDiscardLoot`（自动领取可领、放弃不可领，不重复发奖），使任何席位超时都能推进。
6. 导出经 `src/server-entry/index.ts`；合同新增第 11 节；测试 `t3-*`。

## 3 验收
- [ ] 同一收据提交两次，第二次无事件、无资源变化；`roundResults` 恰一条。
- [ ] 迟到（旧轮）、镜像、缺字段收据原样拒绝。
- [ ] HP 1 承受 damage 9 → HP 0、状态 eliminated，不抛错，不置单人 gameOver。
- [ ] 两个超时命令在空阵容异常节点、待领奖励、待选项三种状态下都能让 `nextRound` 成功，且不发任何奖励。
- [ ] 单人路径与 golden 零改动；typecheck、build、`test:server-entry`、`verify-t2-node-entry` 通过。
- [ ] 合同第 11 节能让 Claude 只看文档实现 B4（房间提交）。
