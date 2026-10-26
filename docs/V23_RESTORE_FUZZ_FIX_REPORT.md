【完成】修复技能贡献的独立重放认证与声明投影，保留来源／系数／时间／完整性检查：src/simulation/combat-runtime-facts.ts:11、src/simulation/m8/restore.ts:51、src/simulation/serialization-structure.ts:361。
【完成】6 个 it.fails 转普通 it；新增 12 个当前内容用例全部通过，覆盖三入口、10 类篡改（含贡献与显示同时伪造）和完整战斗后缀字节一致：tests/v23-restore-fuzz.test.ts:46、:100、:161。
【完成】纯随机长测退出 0：4 场完整对局、4163 checkpoint、12489 次入口尝试、86040 次完整续跑比较，恢复失败／分歧均 0：artifacts/v23-restore-fix/random-results.json:1。
【完成】覆盖准备期 222、战斗 3922、结算 17、选择 2；总计 28680 步。命令：node scripts/fuzz-restore.cjs --checkpoints 3000 --workers 4 --random-only --checkpoint-rate 7 -o /tmp/v23-restore-fuzz-random.md。
【完成】指定 tests/v23-restore-fuzz.test.ts、tests/restore-audit/*.test.ts、tests/m6-persistence.test.ts：146 通过、239 失败、15 跳过；失败拆分为 8 个 content-digest 旧夹具阻断及 231 个 HEAD 已复现基线失败，无新增审计失败：artifacts/v23-restore-fix/v23-restore-final-tests.log:797、baseline-comparison.json:14。
【完成】npx tsc --noEmit -p .、node --check scripts/fuzz-restore.cjs、git diff --check 均退出 0；未跑全套、未加超时、未放宽既有断言，未修改规则／数值／保存格式／冻结身份／禁改路径，未提交。
【完成】契约及 2026-10-25 的 P 已记录：docs/MATCH_CONTRACT.md:1282、docs/S13_RULES_GAP.md:1068；显式纯随机模式保留默认构筑路线和独立 Oracle 的所有断言：scripts/fuzz-restore.cjs:103。
【未完成】混合构筑／BotDriver 长测未完成：默认命令在四场随机对局 970 checkpoint 零恢复失败之后，被独立经济 Oracle 的增强 seen-once 账本不一致阻断；原始失败与部分结果保留：artifacts/v23-restore-fix/v23-restore-fuzz-fixed.log:3、mixed-partial/worker-0.json:1。
【未完成】既有 231 个审计失败包含 Oracle 增强候选不一致及 Kogmaw 拒绝原因不符，均已通过只读 HEAD 源码加载重现；8 个旧夹具 content-digest 不符按指示忽略，未重录夹具：artifacts/v23-restore-fix/baseline-comparison.json:4。
【需要我决定】无；工程口径已按委托采用推荐方案并记 P。
【风险】本次 4163 checkpoint 为纯随机覆盖，不代表构筑路线／BotDriver 通过；随机覆盖不能证明所有状态。真实联机席位继续由现有存档契约拒绝。
【下一步】先修复独立 Oracle／基线原因不符并完成既有 epoch 夹具重录，再按默认混合模式复跑；本次生产修复可直接审阅。
