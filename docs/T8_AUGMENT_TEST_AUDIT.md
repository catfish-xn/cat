# 第三／四批强化阶段测试与计数调查

核对基点：`claude/sol-t8`，HEAD `97068956`，跟踪
`origin/codex/v25-integration-2`。首次调查开始时正式文件无差异，只有
`tests/sol-t8-probe.test.ts` 临时调查脚本；上一轮交付时已清理。
本轮先核对 git status／git diff，再在保留上一轮改动的基础上完成评审返工；
两轮均未做 Git 写操作。

## 原始失败与处理

| 文件／失败数 | 定性与根因 | 改法 |
| --- | --- | --- |
| `augment-pool-batch3-progress.test.ts`／2 | 身份漂移：旧存档为 v24，当前为 v25；精确结构比较仅有规则版本、内容版本、内容摘要、战斗输入摘要、冻结掉落重演摘要五处不同 | 保留两个旧文件，独立打包 `808d16ae` 的 pre-Spoils 结算模块，新增当前身份的兼容基线；仍逐字节比较并重演后两轮 |
| `augment-pool-batch3-xp.test.ts`／1 | 测试边界漂移：Titanic Titan 已将可能的对手 HP 上限提高到 120，101 不再非法 | 保留 101 的覆盖并明确验证成功，再验证 120 成功、121／负数／缺失拒绝且保留原 state |
| `augment-pool-batch4-b4xp.test.ts`／4 | Clear Mind 的 seed 98 是组件锻造器开局；`sellUnit` 打开锻造选择，下一次调用报 wrong-phase。Slammin+ 的 seed 4 在扩池后已不提供该卡 | 清空条件只处理英雄，保留不计入条件的锻造器；0..100 内找到 seed 19、公开重选槽位 0/1/2 的真实 Slammin+ 路线 |
| 同上，解除前述阻塞后 | 联机手工结算样例使用的 Slammin seed 63 是 Warwick 开局，必须携带死亡事实 | 该样例仅隔离背包／备战席条件，换成同一范围内真实提供 Slammin 的 seed 95（Scuttle），不修改结算校验 |
| `d14-ability-display.test.ts`／1 | 真实显示缺陷：四星战斗投影没有 Zyra 的试验品说明字段，显示查询抛 RangeError，被 tooltip 转成 null | 从认证四星源补齐 tooltip 元数据，再覆盖战斗投影（含 14.24b 修正）；不再回落三星系数；补充四星基础／150 AP／普通三星数值检查 |
| `g2-augments-choice.test.ts`／5 | 计数漂移：第五批扩池后独立 oracle 与目录均为 306，原断言仍为 285 | 固定检查完整目录 306、默认池 304，差集必须恰为两张选秀限定卡；LCG 三词与完整目录一致性断言保留 |
| 同上／1 | 路线错误：Table Scraps 与 Young and Wild and Free 均仅对共享选秀开放，单机检索永远找不到 Table Scraps | 两张卡均通过真实共享池事务选择，检查过期／重复命令、金币、RNG、唯一收据、三种恢复输入和篡改拒绝；返工后抽样也使用真实 RNG（种子分别为 187、124） |
| 同上／1 | 真实接线缺陷：单机空棋盘在 tick 0 直接结算，Void Swarm 发奖读取 PvP 阵容时，外层命令追踪尚未记录该事实 | 仅在单机 PvP 战斗 tick 0 已结束时提前记录同一阵容事实，避免结算抛错；正常开战走原有外层追踪顺序，多人分支不变 |

G2 实际七项失败为五个种子的同一计数断言，加两项独立问题。
评审返工后，G2 恢复该文件原有例外：独立 oracle 检索 0..1000（含端点），
仍跳过阻塞空棋盘路线的 Trainer Golem 开局。51 张普通池卡的首次真实命中
位于 101..1000；当前所有受测卡均有真实命中，已移除全部 withB1Offers 回退。
两张选秀限定卡也按共享候选池检索真实种子，选择、恢复、失败原子性与 RNG
断言完整保留。其他文件新选种子仍在 0..100 内。

## 验证

上一轮指定五文件 265 项通过；本轮增加 swarm 回归后，六文件 280 项全部通过，
命令如下：

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 \
  tests/g2-augments-choice.test.ts \
  tests/augment-pool-batch5-g4-swarm.test.ts \
  tests/d14-ability-display.test.ts \
  tests/augment-pool-batch3-progress.test.ts \
  tests/augment-pool-batch3-xp.test.ts \
  tests/augment-pool-batch4-b4xp.test.ts
```

`npm run typecheck`（`tsc --noEmit`）通过；`git diff --check` 通过。
基线导出器还单独验证历史结算 serialize/restore，以及除五项身份字段外
全部数据与旧 v24 基线一致。没有修改或重录 epoch 证据。

swarm 新增两条公开命令回归：正常开战固定事实 sequence 为
`combat-roster:3 → pvp-roster:4 → deaths:5`，整份存档 SHA-256 必须为
`ea42cda1eeab49ebc9c4e012b17214218092cf55d5653adb6b41ebc6f4e760bc`。
该值独立加载 `git show 97068956:src/simulation/match.ts` 导出后与工作区输出
核对一致；空棋盘 tick 0 结算则验证唯一 PvP 阵容、唯一轮次结果与恢复成功。
两条均使用真实 Void Swarm 种子 53。

上一轮额外相邻回归共 116 项：96 通过，20 失败。已在 `/tmp` 独立副本中将
两个变更的 src 文件替换为 HEAD 原始文件重跑，失败名称和数量完全一致：

- `g2-2-ability-display.test.ts:10`：`b5-voidling` 缺显示源，1 项。
- `server/augment-pool-batch5-g4-swarm-room.test.ts:18`：固定 seed 57 的
  `s3` 报价已没有 Void Swarm，首个选择失败导致后续 18 项连锁失败。

这两处为指定五文件之外的既存问题，本任务未修改其测试或实现。

## 交付边界

src 仅修改 `simulation/ability-display.ts` 和 `simulation/match.ts`。
没有改变玩法、战斗数值、超时、预算或门槛；未修改 src/server、界面目录、
旧兼容夹具、docs/evidence 或任何 online-rules 录制夹具。所有改动留工作区，
交执行端评审和提交。
