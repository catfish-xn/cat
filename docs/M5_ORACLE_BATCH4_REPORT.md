【完成】基线 codex/v23-foracle2 / b3272dd0；删除等级组重复登记，独立池固定 224 个唯一 ID（44/113/67），补齐三组的双向互斥；证据 tests/fixtures/m5/oracle.g2.cjs:138、tests/fixtures/m5/oracle.g2.cjs:188、tests/m5-oracle-augment-ledger.test.ts:262。
【完成】独立转录研究 augments-14.24.json 与 AUGMENT_BATCH4_PLAN.md：条件经验、投资 26/45 金、前轮购买／银行免费刷新、四个 1 费／基础装备／飓风礼物；证据 tests/fixtures/m5/oracle.g2.cjs:50、tests/fixtures/m5/oracle.g2.cjs:61、tests/fixtures/m5/augment-rewards-oracle.cjs:15、tests/fixtures/m5/augment-rewards-oracle.cjs:231。
【完成】战争财宝兼容既有专用计数包络，普通 PvE 击杀独立重建，前态开战来源绑定，按独立表派生金币；证据 tests/fixtures/m5/augment-rewards-oracle.cjs:110、tests/fixtures/m5/augment-rewards-oracle.cjs:202、tests/m5-oracle-augment-ledger.test.ts:345。
【完成】未知来源拒绝及原反例全部保留；oracle 单测 35/35、完整锻造器路线 1/1；路线仅换为 224 池实际提供游神眷顾的 seed 30，全部原断言保留（tests/m5-oracle-route-driver.test.ts:10）。
【完成】/tmp 并行分段扫描 seeds 0..600 × cannon/sniper，修复后完整重跑 18 个受影响组合，合计 1202/1202 通过；另指定五条复现路线 5/5。逐组合核验 /tmp/foracle2-verified.json，复查 /tmp/foracle2-repaired.jsonl，扫描器 /tmp/foracle2-scan.cjs 与 /tmp/foracle2-repair-monitor.cjs；原扫描日志保留修复前失败，不将其冒充最终失败。
【完成】tests/m8-b8-*.test.ts 全部 19 文件已运行；汇总最终结果为 18 文件通过、1 文件失败，320 测试通过、6 失败。live-capacity／loot-view 的默认 hook 超时已在低负载复跑通过；最后连同两个 oracle 文件共 4 文件、50/50 测试通过（/tmp/foracle2-b8.log、/tmp/foracle2-final-tests.log）。
【完成】tsc --noEmit、两个 CJS 语法检查、git diff --check 通过；定向 Vitest 使用 /tmp/foracle2-vitest.config.mts，无 fast tier、全套测试、新增超时或断言放宽；仅改 tests/docs，无生产规则、数值、保存格式、内容身份变更，未提交。
【完成】约定均记为 P、日期 2026-10-25；证据 docs/S13_RULES_GAP.md:1162。生产模块未进入独立 oracle 的运行依赖。
【未完成】B8 live-transfer 的 6 项断言仍失败：冻结 anchor 的获取序号预期 37/55，当前为 40/58；后续 TG 身份／来源引用失配。证据 tests/m8-b8-live-transfer.test.ts:22、tests/m8-b8-live-transfer.test.ts:48、tests/m8-b8-live-transfer.test.ts:114；原始错误见 /tmp/foracle2-b8.log:65。这是非 contentDigest 失败，未忽略或宣称通过。
【需要我决定】无；按授权沿用既有 P-B4 系列，未新增玩法决定。
【风险】live-transfer 引用的 tests/fixtures/v23-online-rules-transfer-route.json 属本任务禁止修改的 v23 夹具，仍待独立重录流程对齐，当前不能宣称 B8 全绿。
【下一步】将本次 tests/docs 补丁交付评审；既有 v23 夹具重录完成后重跑 tests/m8-b8-live-transfer.test.ts，无需再调整游戏规则。
