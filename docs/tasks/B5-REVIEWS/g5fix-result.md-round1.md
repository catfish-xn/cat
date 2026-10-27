【完成】[G5 oracle](tests/fixtures/m5/augment-batch5-g5-oracle.cjs:64) 已校验历史前缀，并从先前队列推导结算开启；新增篡改、真实 3-1 排队和多球回归。

【完成】类型检查通过；相关测试 175 项通过、1 项失败。

【未完成】通用 [奖励 oracle](tests/fixtures/m5/augment-rewards-oracle.cjs:248) 仍会误判锁定 PvP 结算经验及部分 PvE 消耗品发放顺序，超出本次指定修改范围。真实 3-1 用例的 G5 校验通过，但完整 `validateRewards` 仍会因经验校验失败。

【风险】失败的商店测试因 seed 18 未抽到 `starry-night`；已在干净 HEAD 副本复现。

【需要我决定】是否允许后续修改通用奖励 oracle？建议修复上述两处误判。

【下一步】扩展文件范围后，复验真实 3-1 的完整奖励校验。