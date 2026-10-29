【完成】h1w / B5-07：在 `codex/v25-h1`、HEAD `6f8805149df5e58db18ee2b16204b77c638dd770` 的上轮未提交改动上续完；本轮未提交，未改界面、未录制新纪元。
【完成】开放商店故障；仅 PvE 准备期每 2500ms 免费刷新、30 秒最多 12 次，锁店跳过且不补刷；共享卡池与所有持有者席位一次发布，任一事务拒绝则舍弃整批暂存并结束故障房间。
【完成】服务器全部改动调用点：`src/server/room/room.ts` 的公共领域导入、`apply()`、`freezeAndResolve()`、`advanceAugmentClock()`、`scheduleAugmentClock()`、`replace()`；保留已到期回调、防同刻命令截断后续采样、换轮撤旧回调、采样截至准备期截止点；不在服务器计算刷新次数、金币或随机数。
【完成】复用领域调用链（实现未改）：`src/simulation/shared-pool.ts::advanceSharedAugmentPreparationTime()` → `augment-history.ts::advanceAugmentPreparationTime()` → `augment-pool-batch5-h1.ts::shopGlitchRefreshes()`；返池/抽卡/商店历史仍由共享池事务完成；恢复使用 `restoreSharedOrbSnapshot()` 和独立保留的 `room.augmentHistoryAuthority()`。
【完成】投放/身份改动：`src/simulation/content/augment-pool-batch5-h1.ts` 开启注册；执行 `node scripts/update-content-identities.cjs --write` 更新 `identity-constants.ts`，内容/战利品身份为 `5e8ea7cd` / `6546f4ff`；同步 `scripts/tests/production-size.test.ts`，保留 v25 及 schema12/save8/replay8/command7。
【完成】独立 oracle 改动：`tests/fixtures/m5/oracle.g2.cjs` / `.d.cts` 加入投放身份与 `shopGlitchCount/Solo/Shared`，从测试时钟、刷新前商店/RNG/有限卡池独立推导次数和抽卡，不读取生产时钟事实、刷新历史或奖励收据来生成答案。
【完成】测试改动：`tests/augment-pool-batch5-h1-clock.test.ts` 恢复原跳过的 9 项且全部通过；`tests/augment-pool-batch5-h1-shared.test.ts` 补独立抽卡、守恒、幂等及失败原引用；新增 `tests/server/shop-glitch-room.test.ts` 55 项覆盖边界、原子发布/失败回滚、锁店、断线接管/重连、存档往返/篡改、默认截止及延迟交付。
【完成】其余改动调用点：`tests/g2-augments-choice.test.ts` / `tests/m5-oracle-augment-ledger.test.ts` 同步 237 项目录，并以独立 oracle 定位 Heroic Grab Bag 种子 52；`tests/augment-history.test.ts` 仅更新身份归一化输入，原 SHA-256 断言未改；`docs/MULTIPLAYER_CONTRACT.md` / `docs/AUGMENT_HISTORY_DESIGN.md` 同步事务、时钟、恢复合同；本报告为新增文档。
【完成】分批验收最终全部通过：10 个相关测试文件共 383 项（含 B5-10、历史/旧身份回归）、生产体积 6 项、`npm run typecheck`、`git diff --check`；不删断言、不新增超时或跳过，未跑全套和浏览器测试。
【完成】证据在 `artifacts/h1w/verification-summary.json`，逐项结果见同目录 `related-tests.json`、`final-regression.json`、`production-size.json`（按文件取最后一次结果）；复验命令/配置见同目录 `verification.md`、`vitest.config.ts`，生成物均被 gitignore 排除。
【未完成】本单无遗留；未新增单机计时驱动，保留现有最简领域入口及恢复回归。
【需要我决定】无；沿用现有准备期时长和本单服务器目录豁免。
【风险】PvE 默认准备期仍为 20000ms，实际最多 8 次；测试用 31000ms 准备期验证完整 12 次上限。旧 digest 存档不续玩；联机恢复必须保留与存档配对的共享池及独立服务器 authority。
【风险】本次修改的 `room.ts` 无 `setTimeout`、`Date.now`、`performance.now` 或单词 `window`；全目录既有 `src/server/room/real-clock.ts`、`src/server/net/test-client.ts` 仍含真实时钟/计时器调用，属于原房间时钟适配器及测试客户端，本单未修改，不能声称整个 `src/server` 零命中。
【下一步】请 Claude 交叉验货：核对相关测试、授权目录和玩法约定；本克隆保持未提交供评审。
