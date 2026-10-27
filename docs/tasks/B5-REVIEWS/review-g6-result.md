结论：**不通过**（HEAD `a0299e9`）。

Must-fix：

- **P1｜合法阵容无法结算**：[augment-pool-batch5-g6.ts:19](src/simulation/content/augment-pool-batch5-g6.ts:19)。魔像不占人口，却计入存活伤害。“10名英雄＋魔像”全部存活时产生 `opposingSurvivors=11`，结算入口返回 `invalid-receipt`，阻断房间结算。建议补齐魔像的存活伤害政策，并验证合法阵容均能结算。
- **P2｜固定装备仍会变成光明装**：[augment-pool-batch5-g6.ts:39](src/simulation/augment-pool-batch5-g6.ts:39)。征服者第15档的 `applyG23Radiant` 会转换魔像三件装备，违反批准约定；转换后的状态又被 `validateCarryGolem` 拒绝恢复。建议全体转换路径排除该固定套装。
- **P2｜在线恢复认证不完整**：[augment-pool-batch5-g6.ts:60](src/simulation/augment-pool-batch5-g6.ts:60)、[同文件:80](src/simulation/augment-pool-batch5-g6.ts:80)。仅持有本强化时，魔像坐标改为 `(99,99)`，或同步篡改装备ID、收据、来源事实及 `nextItemSerial`，三个恢复入口均接受，包括传入房间 authority。建议校验合法部署，并从资源前缀独立推导装备连续序号。
- **P2｜相关回归测试未同步**：[augment-stage-bans-audit.test.ts:146](tests/augment-stage-bans-audit.test.ts:146)、[m5-oracle-augment-ledger.test.ts:258](tests/m5-oracle-augment-ledger.test.ts:258)。旧数量断言分别仍为 `218/69`、`243/245`，当前应为 `219/70`、`244/246`；两项实测失败。建议更新数量，保留阶段禁令及差异断言。

可选建议：独立 oracle 增加含装备后的最终 HP/AD 精确断言，以及恢复后继续战斗的一致性检查。

验证：11个相关测试文件 **245/247通过**，typecheck通过；阶段禁表未改，未见新增投影隐私泄露。[补充复现探针](artifacts/g6-review.test.ts) 位于忽略目录；未修改受跟踪文件、未提交。