# TP 派工单：八人共享有限卡池

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/MULTIPLAYER_RENOVATION_V2.md` N1P 节、`docs/MULTIPLAYER_CONTRACT.md` 第 3 节（你写的卡池账本草案，已采纳）、`docs/UI_REQUESTS.md` SR-B1-05

## 0 先读
- T3（PR #39）已合入 `multiplayer`。Claude 的 B3 正在把房间接到 T2，B4 随后接 T3 的 `applyRoundSettlement`。
- 用户决定：**数值直接照搬拳头**。每费用英雄份数按 Riot 公开数值 30/25/18/10/9（1–5 费）写入版本化配置并注明来源；目录只覆盖现有 19 位英雄，不扩目录、不私自加份数。
- Node 22；`m5-replay` 既有超时不修。

## 1 目标
八个席位共用一个有限卡池。商店生成占用、购买转持有、刷新归还、锁店保留、升星按基础张数、出售与淘汰归还、开场赠送与奖励走同一来源账本。任何时刻：可用 + 商店占用 + 真实持有 + 合法待领取 = 初始份数，无负数、无超卖。

## 2 范围
分支 `codex/tp-shared-pool`，可改 `src/simulation/`、`src/server-entry/`、`tests/`、`scripts/`、合同。不改 `src/server/`、界面、单人无限商店行为（单人路径必须零改动、golden 零改动）。

1. `SharedPoolState`：按英雄定义记录初始份数、可用份数、按席位/generation/slot 的商店预留、待领取预留；版本化配置 `POOL_CAPACITY_BY_COST` 带来源注释。
2. 房间级事务入口（纯函数，输入池 + 该席 `MatchState`，输出新池 + 新状态 + 事件，失败两者都不变）：`generateSharedShop`、`buySharedUnit`、`rerollSharedShop`、`setSharedShopLock`、`sellSharedUnit`、`releaseSeatOnElimination`、以及开场赠送与奖励入库的来源合同入口。这些是 B4/B5 房间调用的公开函数，经 `src/server-entry/index.ts` 导出。
3. 抽取：沿用现有等级费用概率表；同费层内按**剩余份数加权**而非按英雄等概率；层内缺货在原概率大于零且仍有货的层之间归一化；全部缺货留明确空格，不无限重抽。付费刷新在无法生成任何新卡时的语义（收费或免费失败）写进合同并实现，二选一。
4. 全房自然刷新顺序：先统一释放应刷新的旧商店，再按可复现的轮次抽签顺序生成，锁店不释放；席位优先顺序每轮变化，不能永远 seat0 先抽。
5. 升星合并保留基础份数 1/3/9；镜像、召唤物、回放副本不占池不回池；淘汰归还只执行一次。
6. 测试 `tp-*`：先用微型库存夹具（例如每英雄 2 份、两席）验证守恒与争抢，再接真实目录。覆盖：两席争最后一份不超卖；重复购买/刷新不重复消耗；锁店、刷新、出售、二星三星合成、淘汰归还守恒；金币不足/备战区满/旧 generation 失败后池与资产全部不变；八席同时自然刷新顺序可复现且轮换；缺货回退与空格；同房同命令顺序商店可复现；单人无限商店测试与 golden 零改动。
7. 合同新增第 12 节：函数签名、事务语义、失败枚举、随机消费次数、缺货规则、数值来源。

## 3 验收
- [ ] 任意测试序列结束时守恒等式成立，`npm run typecheck`、`build`、`test:server-entry`、`verify-t2/t3-node-entry`、`tp-*` 通过。
- [ ] 单人路径与 golden 零改动。
- [ ] 合同第 12 节能让 Claude 只看文档在 `src/server/room` 接入（B5）。
- [ ] PR 描述对 SR-B1-05 逐条回应。

## 4 补充：B3 提出的两条小需求（顺手在 TP 的 PR 里回应）
- **SR-B3-02**（P2）：房间为了取逐 tick 播放帧要把同一冻结输入再跑一次。请在合同注明"二次执行可接受且结果必然一致"，或提供一个同时返回逐 tick 状态序列与结果的入口；二选一，不阻塞 TP。
- **SR-B3-03**（P2）：第二视角镜像翻转了 `units.cell/startingCell`、`movement`、`cast.completionCell`；请列出 `LedgerCombatEvent` 里所有含坐标的字段，供 T5 核对。
