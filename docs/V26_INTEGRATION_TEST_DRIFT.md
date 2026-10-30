# V26 集成后四项测试漂移核对（2026-10-30）

结论：四项失败均为战斗路线漂移，没有发现重复结算、重复发奖或额外生成掉落。本次只修改两个测试文件及本文档，不改生产规则、服务器、纪元、摘要或 golden。

## 对照方式

当前集成提交为 `218fa472`，工作区初始干净。只读 `git archive` 将 `b7ce34b6`（a1）与 `d4d73c32`（a4）分别导出至 `/tmp/cat-v26-drift/`；二者父提交均为 `9e3530c0`。分别运行各自原测试，再在集成提交执行同样种子、公开命令与回合路线。诊断副本仅增加记录，不替换断言或提高限制。

- a1 原 `placeholder-augment-history.test.ts`：14/14 通过。
- a4 原 `over-encumbered-pending-capacity.test.ts`：142/142 通过。
- 集成原测试：152 通过、指定的 4 项失败，合计 156 项。
- a4 的 `loot-runtime.ts` 与集成文件字节一致；a1 的 `augment-pool-batch5-h9.ts`、服务器 `room/augment-history.ts` 与集成文件字节一致。

## seed 6389：相同冻结计划，不同载体击杀

两版的 2-7 冻结掉落计划完全相等。下表 W/L/S 分别表示 playerWin/enemyWin/supply，括号内为战斗 tick；未到 3-7 时 pending-capacity 均为 0。

| 回合 | 9e3530c0 + a4 | 218fa472 |
| --- | --- | --- |
| 2-1 | L (486) | L (479) |
| 2-2 | L (411) | L (382) |
| 2-3 | L (699) | W (606) |
| 2-4 | S (0) | S (0) |
| 2-5 | L (367) | L (368) |
| 2-6 | L (313) | L (347) |
| 2-7 | L (251) | L (231) |
| 3-1 | L (293) | L (295) |
| 3-2 | L (242) | L (241) |
| 3-3 | L (292) | L (264) |
| 3-4 | S (0) | S (0) |
| 3-5 | L (308) | L (293) |
| 3-6 | L (263) | L (237) |
| 3-7 | L (61)，3 条旧待发 | L (61)，6 条旧待发 |

旧版 2-7 中，Akali `unit-2` 在 tick 246 击杀石甲虫 `k01`，随后 tick 251 死亡；`k01` 的三名英雄当轮已发，只有 `k02` 的 Sett/Camille/Vander 顺延。集成版四名己方英雄分别在 tick 51/101/156/231 死亡，未击杀任何载体；`k01` 的 Renata/Tristana/Renata 也合法顺延。两名 Renata 来自不同 entryOrdinal，有不同 dropId，并非重复发放。

故当前 **6** 条都来自真实未击杀的 `k01/k02`，交付轮均为 3-7；出售前均无收据。旧版出售前备战席有 8 人，出售后腾出 2 格，发 2 条、余 1 条；当前有 5 人，出售后腾出 5 格，发 5 条、余 1 条，第二次出售发最后一条。

测试保留 seed 6389，精确参数更新为 `pending: 6, firstGranted: 5`。原有队列、事件、唯一收据、无 RNG/结算变化、三种恢复、再次出售、篡改拒绝与继续到 4-1 的断言全部保留；额外精确核对六份 payload 顺序、两个载体 ID 和出售前 5 人容量。seed 6133 的 `4/4` 向量不变。

## Golden Find：保留 1 + 2 杀跨阈值的测试意图

seed 42、s3，4-6 开战前两版的三个强化、棋子 ID/星级/位置、装备及 31 金币完全一致。HP 为旧版 59、集成版 47，来自既有战斗输赢变化。

| 节点 | 9e3530c0 + a1 的原路线 | 218fa472 的原路线 |
| --- | --- | --- |
| 1-4 | W，319 tick | W，314 tick |
| 4-5 | W，616 tick | L，688 tick |
| 4-6 | W，614 tick；Darius 击杀 Irelia，tick 198 | W，641 tick；Darius 击杀 Irelia/Lux，tick 291/641 |
| 4-7 | W，295 tick；Darius 击杀小鸟 r02/r03，tick 122/143 | L，387 tick；Darius 0 杀，tick 283 被大鸟击杀 |

其余截至 4-6 的回合胜负相同。当前原路线累计仅 2 杀，不达到三杀门槛；未发奖励是正确行为，不能将金额断言改成 0 来消除失败。

新向量只在 4-6 选定异变目标、答完选择后，通过 `room.handle` 的公开 `deploy` 命令把绑定 Darius `unit-1` 从 `(1,4)` 移至 `(1,5)`。保留真实原始 ID 的 PvP **1 杀**、下一轮 PvE **2 杀**、累计三杀唯一 **2G** 收据、重复 settle 同一引用和独立 authority 快照恢复的全部原断言。生产占位解析器保持不变，未注入单位、伤害、死亡或历史事实。

未新增 `it` 用例；修复现有向量并补强 seed 6389 的三项精确断言。临时追踪和搜索程序都在 `/tmp`，不交付到仓库。

## 验证

Golden Find 修复后单独运行原文件，14/14 通过。最终运行（按任务最后的并发要求使用 2 workers）：

```sh
npx vitest run --configLoader=runner --maxWorkers=2 tests/server/shared-pool-room.test.ts tests/server/placeholder-augment-history.test.ts tests/over-encumbered-pending-capacity.test.ts tests/server/battle-result-cache.test.ts tests/server/augment-pool-batch5-h6-room.test.ts tests/augment-pool-batch5-h9-pvp-attribution.test.ts tests/pve-loot-carryover.test.ts
npm run typecheck
git diff --check
```

指定 **7 文件、192 项全部通过，无跳过**，77.26 秒；typecheck 与 diff 检查通过。未提高超时或阈值，未删除/弱化原断言、禁用检查或添加 skip，未跑全套或 Vite build，未执行任何 `--write` 或 git 写操作。纪元 unsupported-version/摘要漂移按要求留给统一重录，本次未处理。
