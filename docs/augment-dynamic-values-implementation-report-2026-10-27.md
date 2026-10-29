【完成】自席打气、星夜、终身黄铜及其余可从既有账本取得的动态描述已接入；强化条、永久构筑和选择卡按状态刷新，2D/3D 共用。
【完成】联机只在自席私有投影发送显示值，公共阵容不含该字段；未改存档、规则数值或打气 II/III 累计口径。
【完成】调用点：`src/simulation/augment-effects.ts` 的 `compileAugmentEffect` → `pumpingUpRounds`；`augment-dynamic-values.ts` 的 `augmentDynamicValues` → 现有战斗、商店、账本及奖励选择器；`private-seat-view.ts` 的 `toPrivateSeatView` → `augmentDynamicValues`。
【完成】调用点：`src/rendering/strategy-panel.ts` 的 `dynamicValues`、`render`（强化条和永久构筑）、`augmentChip`、选择弹窗（标题、卡片及缓存键）；`src/presentation/augment-display.ts` 的 `augmentPlayerDescription`、`augmentCardSections`。
【完成】服务器路径：`src/server/room/projection.ts` 的既有 `toSeatPrivateView` → `toPrivateSeatView`；私有状态推送和恢复沿用原链路，该文件无需修改；公共 `toPublicBoard` 不含动态字段。
【完成】类型检查、生产构建、22 项定向测试及本地客户端投影测试通过；JSON 重连投影、等级/羁绊/账本刷新与隐私有测试覆盖。Vitest 使用 `--configLoader runner --maxWorkers=4`。
【未完成】禁忌魔法在项目中被禁用，缺认证成长账本，显示“未确定”。
【未完成】真实 WebSocket 重连测试因沙盒拒绝监听 `127.0.0.1`（EPERM）未通过；没有浏览器桥接环境，2D/3D 浏览器实测未执行。
【需要我决定】未收到 `-o` 文件路径，报告暂存本文件；请提供目标路径。打气 II/III 是否跨选秀累计仍待此前的规则决定，本次未改。
【风险】棋盘数值表示当前布阵对应的下一场战斗；战斗中的冻结效果不随布阵展示变化。侦察其他席位时无其私有计数，显示“未确定”。
【下一步】由 Claude 使用 `codex-browser exec` 启动浏览器任务，检查 2D/3D、刷新和重连；在允许本地监听的环境重跑 WebSocket 测试。
