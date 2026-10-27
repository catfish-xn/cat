【完成】结论：**不通过**。发现 2 项 P2；新增 64 项、相关回归 169 项通过。未修改受跟踪文件、未提交。

must-fix：

- **P2｜[augment-batch5-g5-oracle.cjs:65](tests/fixtures/m5/augment-batch5-g5-oracle.cjs:65)**：只检查新增事实，未验证历史前缀不变。实测改写已开球的 `orbId`，再领取普通球，多发一次 8 金仍通过 `validateRewards`。建议校验历史前缀不可变，并加入此篡改反例。
- **P2｜[augment-batch5-g5-oracle.cjs:68](tests/fixtures/m5/augment-batch5-g5-oracle.cjs:68)**：只允许 `claimOrb` 产生开启事实，误拒合法队列结算。实测 seed=16、s0 将 2-7 球留到 3-1 战斗中领取，服务器正确结算一次 8 金，oracle 却报错。建议从先前队列独立推导结算开启及奖励，并补真实队列测试。

【未完成】网络投影测试因沙盒禁止监听 `127.0.0.1`（EPERM）阻塞。
【需要我决定】无。
【风险】上述为独立验收缺陷；当前权威恢复仍拒绝篡改。数值、阶段禁出、池账本和已检查投影未发现问题。
【下一步】修复两项 oracle 缺陷后定向复验。
可选建议：将[房间测试的条件断言](tests/server/batch5-g5-pipeline-room.test.ts:54)改为强制验证队列；当前种子实际在结算期领取，跳过了战斗排队断言。