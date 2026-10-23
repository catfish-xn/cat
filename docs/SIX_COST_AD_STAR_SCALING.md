# 六费攻击力星级倍率（2026-10-23）

分支 `codex/v22-candidate`，施工 HEAD `1b0e72b5`，初始工作区干净。只实现本地 `/home/aiapps/workspcae/perf-1022/rules-1023/approved-1023-batch2.md` 的六费 AD 条目；来源为用户 10-23 批准的项目决定（P），离线执行。**待 v22 统一录制**，没有改 epoch、digest 常量、历史 golden、CI，也没有提交。

## 实现与手算

- `src/simulation/unit-stats.ts:18`：六费 AD 与普通单位共用 `STAR_ATTACK_PERCENT` 的 100/150/225%，六费单独正数四舍五入，`floor((一星AD×整数百分比+50)/100)`，每档从一星计算。普通 AD 继续向下取整，HP、固定属性召唤物、魔像百分之一 AD 与专用四星不变。
- `src/simulation/combat-s13-state.ts:93`、`:98`：维克托转 AP 扣除基线及固定 AD 同步为 100/150/225；额外 AD/AS/法力的转换顺序与系数不变。
- `src/simulation/s13-rules.ts:24`：`sixCostStarPercent` 仅代表六费 HP，新增 `sixCostAttackRounding:'half-up'`；`content/v19-six-cost.ts:9` 的 `threeStarBps:36000` 仍是 HP。来源清单与 MATCH/COMBAT 合同同步；S13_RULES_GAP 顶部记 P 和来源，上一单 AD 报告顶部注明后续覆盖。

| 单位 | 一星/二星/三星 AD | 一星/二星/三星 HP（不变） |
| --- | --- | --- |
| 沃里克 | 110 / 165 / 248 | 2100 / 3780 / 7560 |
| 维克托 | 100 / 150 / 225 | 1600 / 2880 / 5760 |
| 梅尔 | 80 / 120 / 180 | 1800 / 3240 / 6480 |

手算：沃里克 `110×1.5=165`、`110×2.25=247.5→248`；维克托 `100×1.5=150`、`100×2.25=225`；梅尔 `80×1.5=120`、`80×2.25=180`。维克托无装备 AP=100；带 +10% AD 长剑后 raw AD=`floor(100/150/225×1.1)`＝110/165/247，额外 AD＝10/15/22，AP＝110/115/122，实际 AD 仍固定 100/150/225。测试期望是独立字面量，不导入生产倍率生成。

## 验证

最终命令：`npm test -- tests/six-cost-ad-star-scaling.test.ts tests/ad-star-scaling.test.ts tests/unit-stats.test.ts tests/v19-part2.test.ts tests/v19-mechanics.test.ts tests/content-identity-constants.test.ts tests/g2-3-skills.test.ts tests/d14-anomalies.test.ts --configLoader runner --no-file-parallelism --maxWorkers 1`。

**8 文件、186 项：182 通过、4 旧失败，无跳过。** 新增 `six-cost-ad-star-scaling` **6/6**，更新后的 `ad-star-scaling` **12/12**（含三组六费全星级手算、resolveUnitStats 与家人普通升星）。全过六文件为新增测试、AD 测试、unit-stats、v19-mechanics、g2-3-skills、d14-anomalies；v19-part2 38/40，身份测试 4/6。

新增集成测试每档都包含三名六费：验证战斗起点 `rngState=42/rngDraws=0`、JSON 检查点通过 `validateDynamicCombat`、恢复后终态及完整后缀事件相同、每个 tick 回放投影相同、双边同步结算与 17 tick 切片结果（含 RNG/账本）完全相同、切片捕获回放等于同步回放。规则变更没有添加随机调用；不要求战斗结束时随机词数与旧伤害轨迹相同。

`npm run typecheck` 与 `git diff --check` 均通过。

## 保留的旧失败清单

改动前先运行 AD、v19-part2、身份测试：58 项，54 通过、4 失败；最终同四项失败，未放宽断言。

| 文件 / 用例 | 数量 | 原因 |
| --- | --- | --- |
| `tests/content-identity-constants.test.ts` / `matches the original full content root, including explanation/source columns` | 1 | 旧常量 `fnv1a32-utf16:35273c97`，当前只读重算 `fnv1a32-utf16:815330ea`；修改前重算已为 `2f81d2de`；待 v22 统一录制 |
| 同文件 / `matches the full loot replay root` | 1 | 旧常量 `fnv1a32-utf16:ef359464`，当前重算 `fnv1a32-utf16:b60b716e`，修改前亦如此；待 v22 统一录制 |
| `tests/v19-part2.test.ts` / `freezes stage/level odds and preserves two words per shop slot` | 1 | 旧商店期望 20 Bps，Batch A 实际 16；修改前已失败 |
| 同文件 / `shared six-cost reservations are finite, can merge, sell and fall back after exhaustion; locks and failures are inert` | 1 | 旧极小卡池向量返回 `pool-empty`；修改前已失败 |

没有重跑全部历史 golden/旧存档路线；上一单的历史失败见 [AD 星级报告](AD_STAR_SCALING.md)，不能将那些历史结果计入本单测试数字。当前候选仍需 v22 统一身份与录制，不能按旧身份直接发布。
