【完成】Review F 三处 oracle 修复：schedule 从当前选择推导完整应发集合（tests/fixtures/m5/oracle.g2.cjs:585）；消耗品按前态序号与独立奖励计划核验完整库存增删（tests/fixtures/m5/augment-rewards-oracle.cjs:359）；四类战后金币先独立推导资格、时点、金额与收据集合再记账（tests/fixtures/m5/battle-gold-oracle.cjs:9、tests/fixtures/m5/oracle.g2.cjs:543）。
【完成】新增评审全部反例和正向／缺失／重复／身份金额篡改向量（tests/m5-oracle-augment-ledger.test.ts:371、tests/m5-oracle-augment-ledger.test.ts:447）；oracle 自测 43/43 通过。
【完成】定向 Vitest：24 文件、384 项全通过，含全部 tests/m8-b8-*.test.ts；日志 /tmp/foracle3-tests.log。命令使用 --configLoader runner --maxWorkers=4 --no-file-parallelism，解决只读 node_modules 的 Vite 临时配置写入；未新增超时、未放宽断言、未跑全套。
【完成】npm run typecheck、三份 CJS 的 node --check、git diff --check 通过；只修改 tests/docs，没有生产规则、数值、保存格式、内容身份或前端变更，未提交。
【完成】约定均记为 P、日期 2026-10-25（docs/S13_RULES_GAP.md:1246）；独立 oracle 不导入生产模块。
【完成】seeds 0..300 × cannon/sniper 单进程扫描：602/602 通过、0 失败，602 个唯一组合无缺漏／重复；4 worker thread，共 3543.245 秒。逐路线结果 /tmp/foracle3-scan-final.jsonl，完整性与源码哈希核对 /tmp/foracle3-scan-verification.json，扫描器 /tmp/foracle3-scan.cjs。
【未完成】无。
【需要我决定】无。
【风险】本 oracle 以已完成战斗的输入／运行结果为事实边界；不替代既有战斗重放测试。
【下一步】交给 Claude 交叉验货：测试过了吗、越界了吗、改玩法了吗；保留当前未提交补丁。
