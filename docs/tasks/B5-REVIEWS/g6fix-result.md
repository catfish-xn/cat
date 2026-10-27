【完成】核对 `codex/v25-g6` 的工作区差异；上一轮修复已保留，本轮完成核验，未执行 Git 写操作。  
【完成】魔像不计入存活伤害；0–10 名英雄加魔像在双边均有结算回归：[g2-3-summons.ts](src/simulation/g2-3-summons.ts:12)、[batch5-g6-room.test.ts](tests/server/batch5-g6-room.test.ts:85)。  
【完成】固定装备排除光明转换及消耗品升级候选：[g2-3-radiant.ts](src/simulation/g2-3-radiant.ts:7)、[consumables.ts](src/simulation/consumables.ts:37)。  
【完成】恢复时校验部署位置和独立重放装备序号，并覆盖传入房间 authority 的篡改反例：[augment-pool-batch5-g6.ts](src/simulation/augment-pool-batch5-g6.ts:53)、[batch5-g6-room.test.ts](tests/server/batch5-g6-room.test.ts:53)。  
【完成】更新数量断言、P 条目和内容身份；补充装备后属性及恢复后战斗一致性断言：[augment-stage-bans-audit.test.ts](tests/augment-stage-bans-audit.test.ts:146)、[m5-oracle-augment-ledger.test.ts](tests/m5-oracle-augment-ledger.test.ts:256)、[S13_RULES_GAP.md](docs/S13_RULES_GAP.md:1358)、[augment-pool-batch5-g6.test.ts](tests/augment-pool-batch5-g6.test.ts:182)。  
【完成】相关测试 11 个文件、270 项通过；`typecheck`、内容摘要检查和 `git diff --check` 通过。  
【未完成】无。  
【需要我决定】无。  
【风险】默认 Vitest 启动因共享 `node_modules` 只读而失败；使用 `--configLoader runner` 后测试通过。  
【下一步】可交叉审查当前工作区差异。