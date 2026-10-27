【完成】核对并保留上一轮的工作区改动；本轮未再修改文件，也未执行 Git 写操作。  
【完成】[lucky-gloves-oracle.cjs](tests/fixtures/m5/lucky-gloves-oracle.cjs:52) 从历史阵容推导缓存，并从种子重放抽数和子装备；[奖励入口](tests/fixtures/m5/augment-rewards-oracle.cjs:425) 接入前态及实际命令校验。  
【完成】[装备回归](tests/augment-pool-batch5-g1-equipment.test.ts:154) 覆盖跨轮删除普通 roll 并重算；[联机回归](tests/server/augment-pool-batch5-g1-lucky-room.test.ts:37) 覆盖缺失、重复、跳抽及同时删除 roll 和临时装备，均被拒绝。  
【完成】相关 G1 与奖励账本测试：6 文件、87 项通过；`git diff --check` 通过。  
【未完成】额外运行的商店测试有 1 项失败：固定种子未出现预期选项；用原始 oracle 复测仍同样失败，本任务未改动该测试。  
【需要我决定】无。  
【风险】商店测试的既有失败仍需另行排查。  
【下一步】请 Claude 按项目约定验收本次改动。