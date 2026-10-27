【完成】[combat.ts:50](src/simulation/combat.ts:50) 统一献祭前的召唤身份；[回归测试:28](tests/augment-pool-batch5-g3-mutation-summons.test.ts:28) 覆盖单边、双边和镜像。
【完成】[shared-pool.ts:62](src/simulation/shared-pool.ts:62) 校验 G3 持有者及礼物收据；[回归测试:76](tests/server/batch5-g3-aerial-room.test.ts:76) 覆盖联合篡改、孤儿收据和重复领奖。
【完成】[augment-stage-helpers.ts:37](tests/augment-stage-helpers.ts:37) 将 `betrayal` 路线更新为搜索所得种子 34，保留恢复和篡改断言；同步更新 [战斗契约](docs/COMBAT_CONTRACT.md:382) 和 [对局契约](docs/MATCH_CONTRACT.md:1509)。
【测试】G3 相关 50 项全部通过；Batch2 84 项通过、1 项失败，`betrayal` 回归通过；`tsc --noEmit` 和 `git diff --check` 通过。
【未完成】Batch2 的 `rocket-collection-plus` 固定种子仍不报价；审查报告已记为基线失败，不属于三项 must-fix。
【需要我决定】无。
【风险】Batch2 测试文件整体仍为失败状态，需单独修复该基线路线。
【下一步】单独处理 `rocket-collection-plus` 基线失败后再复审；本次未执行 Git 写操作。