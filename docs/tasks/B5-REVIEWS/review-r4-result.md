【完成】结论：**不通过**。相关测试137项通过；未修改受跟踪文件、未提交。

Must-fix：

- **P1** [augment-pool-batch5-r4-restore.ts:8](src/simulation/augment-pool-batch5-r4-restore.ts:8)：认证开关取决于候选档自身标记。真实房间 seed=46、s2 领取后，删除强化、选择记录、奖励收据和法球记录，重置选择 RNG、金币加1，仍保留辛吉德；共享池和选秀恢复入口在无句柄及原服务器句柄下均接受。应依据独立服务器状态决定认证要求，并始终核对已提供句柄对应的完整状态。
- **P2** [augment-pool-batch5-r4.ts:110](src/simulation/augment-pool-batch5-r4.ts:110)：毒云接触使用 `enemies()`，错误排除隐身／不可选中单位；复现同格可见目标产生毒伤，隐身目标完全不中毒。接触判定应使用 `areaEnemies()` 等在场资格，寻敌继续使用可选目标资格。
- **P2** [augment-pool-batch5-r4.ts:114](src/simulation/augment-pool-batch5-r4.ts:114)：附着毒伤存于独立数组，未接入既有 G11 净化。复现毒云已消失、夜之锋刃于 tick11 触发净化，tick31／41仍受到原毒伤。应接入可净化的附着 DoT 生命周期，或让净化同步移除对应毒伤。

【未完成】WebSocket 回归受沙盒 `listen EPERM 127.0.0.1` 限制：2项失败、1项跳过，未计为代码缺陷。
【需要我决定】无。
【风险】现有通过用例未覆盖组合删除标记、隐身接触及净化交互。
【下一步】修复上述三项并补回归；可选建议：增加本卡实际断线重连及奖励合星后卖出守恒用例。