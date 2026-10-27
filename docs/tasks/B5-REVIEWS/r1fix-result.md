【完成】修复[盗墓者恢复校验](src/simulation/augment-pool-batch5-r1.ts:124)，按资源账本核验装备实例、转换链和征服者解锁依据。  
【完成】[回归测试](tests/server/augment-pool-batch5-r1-room.test.ts:217)覆盖两版强化、两个恢复入口的合法转换和伪造拒绝；相关测试 160 项及 TypeScript 检查通过。  
【未完成】可选的 oracle 反例未添加，本次聚焦恢复修复。  
【需要我决定】无。  
【风险】第 15 宝箱进度由受控战斗事实构造，未模拟完整对局积累。  
【下一步】交叉复审。