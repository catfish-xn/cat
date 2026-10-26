【完成】实现双重目的、精心打造、进攻宣告、扭转命运四条14.24强化；资料、位阶、阶段禁选见 src/simulation/content/augment-pool-batch5.ts:6、:62、:65；无其他玩法/数值或存档格式变更。
【完成】经验返金、强刷商店、真实合成额度、连胜覆盖、60G入轮银行＋PvP胜利任务及恢复校验：src/simulation/augment-pool-batch5-progress.ts:17、:29、:38、:69；src/simulation/match.ts:377；共享卡池原子入口 src/simulation/shared-pool.ts:211。
【完成】新强化43条测试通过：tests/augment-pool-batch5.test.ts:17（11）、tests/augment-pool-batch5-fate.test.ts:21（31）、tests/augment-pool-batch5-shared.test.ts:7（1）；含真实命令、完成任务后的真实战斗回放、保存恢复及三种入口篡改拒绝；离线完成证据见 tests/augment-pool-batch5-fate.test.ts:78、:88、:92。
【完成】batch4等9文件回归278/278；扩展8文件4668通过，漂移Spoils两例修正后通过，补跑 tests/augment-pool-batch3-progress.test.ts 为10通过＋2旧digest失败；四条最终遗留失败详见风险。全部Vitest命令使用 --configLoader runner --maxWorkers=4，未跑全套或浏览器脚本，未加超时或放宽断言。
【完成】独立M5 oracle加入四条与228条目录：tests/fixtures/m5/oracle.g2.cjs:140、tests/fixtures/m5/augment-rewards-oracle.cjs:83；阶段审计和原路线首个有效种子已更新，Call to Chaos额外满足XP分支（401）；tests/augment-stage-helpers.ts:22、tests/augment-pool-batch3-progress.test.ts:97。
【完成】P-B5统一登记为P、2026-10-25：docs/S13_RULES_GAP.md:1260；导出签名、输入输出及失败原因合同见 docs/MATCH_CONTRACT.md:1408。
【完成】仅由 node scripts/update-content-identities.cjs --write 生成身份，--check通过：content=fnv1a32-utf16:ea87d498，loot=fnv1a32-utf16:c68ff41f；src/simulation/content/identity-constants.ts:3；scripts/tests/production-size.test.ts:108已同步且相关测试通过。
【完成】npm run typecheck、最终Vite构建、git diff --check通过；顶层 dist/assets/*.js 按gzip-9合计604,719字节，低于637,144上限32,425字节；未提交，生成物/素材未进入改动清单。
【未完成】服务器接线按职责留给Claude：src/server/room/room.ts:179须将普通buyXp分派改成 runSharedMatchCommand(pool,state,{type:'buyXp'})；完整请求及验收在 docs/UI_REQUESTS.md:1259。本任务未修改服务器、界面或保护的epoch证据。
【需要我决定】无；开放行为均按最佳建议落实为P，日期固定2026-10-25。
【风险】接线前，持有双重目的的共享席普通buyXp返回 invalid-mechanic-state，保持原state而不发布失配商店；规则侧共享事务已通过守恒、锁店、首次返金、免费额度与失败原子性测试（tests/augment-pool-batch5-shared.test.ts:7）。
【风险】保留且未重录的4条纯digest失败：tests/augment-pool-batch3-progress.test.ts:132 的round1/2两例（JSON差异仅 $.contentDigest、$.combatInputBasis.contentDigest、$.m8.loot.frozen.replayDigest）；tests/d11-wiring-bank.test.ts:36；tests/d14-anomalies-source.test.ts:58。后两例仅当前contentDigest与旧epoch比较不一致。
【下一步】Claude完成上述一处服务器分派后进行v24联调；epoch由既定独立流程重录，本工作区不提交。
