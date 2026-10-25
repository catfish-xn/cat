【完成】分支 codex/v23-b3bugs，HEAD 87a013f1；未提交，未写 .git。基线已含两处初步修复及六个普通 it，未重复改写既有修复。
【完成】免费刷新 used 必须精确匹配既有 free-reroll 事实（src/simulation/free-rerolls.ts:32）；新增 0/2/11 次消费、额度范围各错误整数、越界、类型、额外字段和删除计数的三入口拒绝测试（tests/augment-batch3-verify-public.test.ts:323、:342）。
【完成】合法退休沿既有结算后缀消费 unit-removed（src/simulation/b8-restore.ts:553）；新增两个版本 JSON／对象／serialize 入口保存恢复后跨轮、再保存、战斗继续全状态一致及奖励只发一次断言（tests/augment-batch3-verify-public.test.ts:412）。
【完成】修复额外发现的“删退休事实并补回假人、保留辅助装”漏洞：成熟阈值必须有匹配退休事实且假人已移除（src/simulation/augment-pool-batch3-progress.ts:212）。两版本新增反例在修复前真实失败，修复后三入口按 missing retirement 拒绝（tests/augment-batch3-verify-public.test.ts:433）。
【完成】决定记为 P-B3-RESTORE，日期 2026-10-25（docs/S13_RULES_GAP.md:3）；未改变玩法、数值、存档格式、版本、受限目录、oracle 或 timeout，未放宽断言；缺陷测试无 it.fails。
【完成】定向 B3-V／G2 anti-tamper／G5：22 passed，55 未选；npx tsc --noEmit -p .：通过；git diff --check：通过。
【未完成】指定 11 文件已全部执行但未全绿：396 passed、9 failed（全部 5s 超时）、15 skipped（g23-grant-evidence.test.ts:11 的既有 30s 初始化超时）；6 文件通过、5 文件未通过，退出码 1，768.57s。完整输出 /tmp/b3bugs-final-tests.log；无业务断言或 content-digest 失败。
【需要我决定】无，已按用户授权选择保留现有字段、严格拒绝不一致状态。
【风险】超时位置：tests/augment-batch3-verify-public.test.ts:169；tests/augment-pool-batch3.test.ts:313（两项）、:330；tests/restore-audit/bounds-preflight.test.ts:68、:128、:152、:158；tests/m6-persistence.test.ts:180。四个增幅耗时用例另行选跑：1 passed、3 仍超时（/tmp/b3bugs-timeout-recheck.log）；未提高超时或将超时当成可忽略的 digest 差异。
【下一步】交 Claude 交叉验货；在低负载环境按原超时复跑上述未通过项，或另立性能任务；不改本次规则与断言来消除超时。
