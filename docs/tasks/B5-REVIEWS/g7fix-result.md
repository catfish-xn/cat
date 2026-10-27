【完成】P1：发奖前记录终局死亡边界，包括 tick 0 空死亡列表；真实房间覆盖空阵容、全灭及普通／流式 PvE。见 [augment-history.ts](src/simulation/augment-history.ts:165)、[match.ts](src/simulation/match.ts:472)、[房间回归](tests/server/augment-pool-batch5-g7-review.test.ts:87)。
【完成】P2：校验初始赠礼命名空间，并依据可信卡池记录要求服务器认证；覆盖三种输入、删除收据和卖出赠送英雄后的篡改。见 [shared-pool.ts](src/simulation/shared-pool.ts:56)、[房间回归](tests/server/augment-pool-batch5-g7-review.test.ts:55)。
【完成】P2：Oracle 按奖励种类区分金币与装备，补合法及伪造向量。见 [augment-rewards-oracle.cjs](tests/fixtures/m5/augment-rewards-oracle.cjs:385)、[Oracle 回归](tests/m5-oracle-loot-explosion.test.ts:71)。
【完成】同步“2-1／3-2 开放、4-2 禁出”文档；[修复报告](docs/V25_G7_REVIEW_FIXES.md:1)已记录详情。
【完成】相关测试 9 个文件、271 项通过；`npm run typecheck`、`git diff --check` 通过。未执行 Git 写操作。
【未完成】按任务范围未跑全套或 WebSocket 投影测试；此前投影测试因沙盒禁止本地监听未完成。
【需要我决定】无。
【风险】恢复认证依赖调用方提供可信服务器卡池和独立 authority；缺少所需证据的旧候选档会被拒绝。
【下一步】请 Claude 按约定交叉复审并在可监听环境补验 WebSocket 投影。