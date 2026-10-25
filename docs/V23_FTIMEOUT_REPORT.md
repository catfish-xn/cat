【完成】移除五文件 8 处覆盖（9 个原用例），保留全部断言；固定种子并认证候选、深冻结复用、拆分三条回放比较；无生产/格式/受保护文件改动，未提交。以下为两 worker 适度负载的逐例毫秒（前→后）。
- tests/augment-pool-batch1.test.ts:138，黑玫纹章：333→210，种子 23。
- tests/augment-pool-batch1.test.ts:138，黑玫之冕：1290→209，种子 169。
- tests/augment-pool-blood-brothers.test.ts:95，发奖/结算/恢复/篡改：1868→1138，种子 178；候选断言见 :90/:92。
- tests/augment-pool-formswapper.test.ts:91，真实商店三合一：104→104，种子 4，文件内只读缓存见 :16。
- tests/black-rose-7.test.ts:55，复活及第二次死亡：702→300；冻结参考见 :37。
- tests/black-rose-7.test.ts:86，七档以下首次死亡：240→258。
- tests/black-rose-7.test.ts:95，快照/输入/三路回放：1169→39＋357（完整）＋297（预算1）＋364（预算13）；比较见 :106，黑玫全文件约3161→2692 ms（含公共准备）。
- tests/black-rose-7.test.ts:149，两个检查点恢复及伪造拒绝：855→926。
- tests/experiment-emblem-clone.test.ts:123，分裂前后恢复/续调/篡改：1321→1847；所有整改用例均在默认预算内通过。
【未完成】指定五文件基线157通过/2失败，整改后160通过/2失败（新增3个比较用例）；失败仍是 tests/augment-stage-helpers.ts:55 的 Final Polish seed12、:78 的 raining-gold-plus seed81 选项漂移，非摘要失败，未放宽。tests/presentation/v23-augment-stage-table.test.ts:111 的30秒覆盖按职责未改。
【需要我决定】无；工程约定已按委托记录于 docs/S13_RULES_GAP.md:1068（P，2026-10-25）。
【风险】墙钟存在负载波动，单例数字不含独立 beforeAll 的参考构建时间；白名单与旧时限未动。已执行要求的基线差异 grep 并逐项核对，剩余白名单外新增覆盖仅前端那一处；rendering3d 与搬迁服务器超时均可追溯基线。
【下一步】由界面负责人处理前端超时，另修两处旧阶段种子。验证：仅跑指定五文件，命令 npm test -- --configLoader runner --maxWorkers 2 加五个完整路径；冷缓存筛选预算13及商店三合一另测2/2通过（15跳过）；npm run typecheck、git diff --check 均通过。原始报告 /tmp/ftimeout-before.json、/tmp/ftimeout-after-final.json，日志 /tmp/ftimeout-filtered.log；未跑全套。
