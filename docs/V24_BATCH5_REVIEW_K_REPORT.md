【完成】P1：房间 buyXp 已走共享事务，正常升级、原子刷店与奖励不再被普通入口拒绝；src/server/room/room.ts:180，真实八席公开2-1选取回归 tests/server/batch5-dual-purpose-room.test.ts:12、:21。
【完成】P2：以取得／购买有序事实认证全部合法阶段，逐轮核对结算免费经验并携带结算购买后的经验进入次轮；src/simulation/match.ts:392、:938，src/simulation/augment-pool-batch5-progress.ts:21、:27、:75。
【完成】12→10、同轮第二笔4G、准备期已返后结算不再返、跨轮、满级截断、失败原引用及篡改拒绝均通过；tests/augment-pool-batch5-settlement.test.ts:28、:42、:51、:69、:77，tests/augment-pool-batch5.test.ts:58，tests/server/batch5-dual-purpose-room.test.ts:41。
【完成】最终 batch5*.test.ts＋新房间文件共51项通过，独立身份诊断1项通过；涉及buyXp的 carousel-room、room-hp-ledger、room、v23-room-command-robustness 四文件最终173项通过；/tmp/batch5-k-final-required.log:4、/tmp/batch5-k-room-regression-final.log:4。
【完成】npx tsc --noEmit -p .、git diff --check、node scripts/update-content-identities.cjs --check通过；Vitest均 --maxWorkers=4 --no-file-parallelism，未跑全套／浏览器，未加测试或hook超时、未放宽断言；服务器未新增禁用计时API或window，未改epoch文件、未提交Git。
【完成】决定登记为P、2026-10-26：docs/S13_RULES_GAP.md:1271；函数／事实／失败原因合同 docs/MATCH_CONTRACT.md:1413；原服务器接线请求已关闭 docs/UI_REQUESTS.md:1259；完整定向身份失败清单 docs/evidence/v24-batch5-review-k/identity-failures.json:29。
【未完成】纯身份失败①②：tests/augment-pool-batch3-progress.test.ts:139 的“pre-Spoils baseline bytes restore and continue round 1/2 with full history”；独立比较仅两处contentDigest及一处loot replayDigest不同，证据 docs/evidence/v24-batch5-review-k/identity-failures.json:19。
【未完成】纯身份失败③：tests/d11-wiring-bank.test.ts:36 的“a resumable online task consumes live bank samples, replays the exact same ledger and keeps bank values private”；当前ea87d498与录制d61a28f2不一致。
【未完成】纯身份失败④：tests/d14-anomalies-source.test.ts:58 的“retains the two D14 anomalies in the current epoch without overwriting source values”；同为ea87d498／d61a28f2身份门禁。
【未完成】纯身份失败⑤：tests/ur-i3-combat-statuses.test.ts:84 的“preserves the pre-view-change battle, ledger and RNG and binds the current epoch identity”；同为ea87d498／d61a28f2身份门禁。
【未完成】纯身份失败⑥⑦：tests/opening-random-identity.test.ts:682 的“binds v23-online-rules to fresh public rules and preserved v22-online-rules byte evidence”，及 :793 的“recomputes the first battle terminal and every event hash from public commands”；后者只在内存映射旧content／loot身份后状态轨迹匹配，原事件轨迹一致。
【需要我决定】无；用户已委托决定。具体-o路径未提供，本报告默认写入 docs/V24_BATCH5_REVIEW_K_REPORT.md；所有7条身份失败保留原断言，交集成流程独立重录；本次额外身份复验19通过，未执行的151项不宣称通过。
【风险】修复前缺新来源事实的双重目的候选档会被拒绝，不自动猜测迁移；见 docs/S13_RULES_GAP.md:1277。上述身份清单限定本次定向复验，未运行全套，当前分支仍不能声称全部测试绿。
【下一步】集成时按既定独立epoch流程重录身份及证据，再复验上述7条；内容身份保持 src/simulation/content/identity-constants.ts:3 的ea87d498，本工作区保持未提交。
