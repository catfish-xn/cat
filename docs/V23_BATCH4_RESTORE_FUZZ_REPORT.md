【完成】16 个 batch-4 强化均通过真实选项／命令构造非平凡合法档；逐叶修改、删除及整容器移除覆盖 JSON、object、serialized 三入口：tests/v23-tamper-batch4.test.ts:34、:192、:204。
【完成】合法三入口 round-trip 与完整命令结果／状态／事件／RNG／收据续跑比较，直至真实战斗结束；两种过量治疗先产生非零护盾：tests/v23-tamper-batch4.test.ts:114、:173。
【完成】构筑路线加入全部 16 个 augmentPriorities，按种子轮换，记录实际取得强化与检查点；保留独立经济 oracle 断言：scripts/fuzz-restore.cjs:16、:28、:36；未修改 oracle 文件。
【完成】Fuzz 命令：export PATH=$HOME/.local/bin:$PATH; node scripts/fuzz-restore.cjs --checkpoints 3000 --workers 4 -o docs/V23_BATCH4_RESTORE_FUZZ_REPORT.md。
【完成】Node v22.23.4，mixed／rate=31，11 完整对局（4 随机、6 构筑、1 BotDriver），3764 检查点、11292 三入口尝试、338790 续跑比较，合法档恢复／续跑失败 0；原始轨迹、种子与数据见同名 .json。
【完成】指定两文件命令：npm test -- --configLoader runner tests/v23-tamper-batch4.test.ts tests/v23-restore-fuzz.test.ts；2 文件通过，4605 正常通过、51 预期失败（同一共享产品缺口），耗时 590.28 s；未运行全量测试。
【完成】npm run typecheck、node --check scripts/fuzz-restore.cjs、git diff --check 均通过；沿用 Vitest 默认超时，没有修改任何 src、受保护文件、保存格式或既有断言，没有提交。
【完成】P 约定日期固定 2026-10-25：docs/S13_RULES_GAP.md:1172；共享缺口最小化为仅一次真实 2-1 选取的三入口 it.fails：tests/v23-restore-fuzz.test.ts:219。
【未完成】产品收据 unitId 校验缺口未修（本任务禁止改 src）；篡改矩阵保留 16×3 个预期失败，最小反例另有 3 个，均保留拒绝断言。
【需要我决定】无，测试构造、取样与缺口记录口径已按授权自行决定并记为 P。
【风险】src/simulation/serialization-structure.ts:222 的 choice 分支未约束 unitId，:224 仅校验 nullableString，因此 null→任意字符串可通过三入口；尚未证明能借此改变奖励或玩法。
【风险】构筑路线实际取得并检查 游神的眷顾 caretakers-favor（462 检查点）与耐心 patience-is-a-virtue（342）；其余 14 个没有宣称构筑 fuzz 命中，逐个覆盖来自定向矩阵；随机／BotDriver 未按强化细分，真实联机席位不属于离线 Match 保存契约。
【下一步】另开产品修复任务补齐强化取得收据 unitId 的权威约束，再将对应 it.fails 转为正常通过测试；保留本报告命令和 JSON 复跑。
