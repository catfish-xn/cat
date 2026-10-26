【完成】在 `codex/v24-flake@ac3ca1e5` 修复 review K 的 M5 预热依赖；无 Git 提交、无生产目录改动：`tests/m5-route.test.ts:16`。
【完成】每阵容 describe 用默认时限分段 beforeAll 准备真实路线；全部六组 build/seed 保留，最终用例只读：`tests/m5-route.test.ts:23`、`tests/m5-route.test.ts:33`。
【完成】原 1,140 个无断言预热用例改为初始化；8 个验收用例、全部 expect/golden 保留，无新超时：`tests/m5-route.test.ts:37`、`tests/m5-route.test.ts:49`、`tests/m5-route.test.ts:69`。
【完成】Caitlyn 冷启动筛选通过（1 通过、7 按筛选跳过，63.44 秒，最终用例 8 ms）：`/tmp/review-k-flake-caitlyn.log:4`。
【完成】`node node_modules/typescript/bin/tsc --noEmit` 和 `git diff --check` 通过；P-V24-M5-SETUP（2026-10-26）已记录：`docs/S13_RULES_GAP.md:5`。
【完成】删除失效清单链接，明确原始 inventory 不随仓库提供：`docs/V24_FLAKE_REPORT.md:1`。
【完成】整文件 8/8 通过，167.41 秒；1,140 个预热用例已移至 hooks，不计入测试数：`/tmp/review-k-flake-whole.log:14`。
【完成】整文件 `--sequence.shuffle --sequence.seed=20261026` 8/8 通过，167.07 秒；四阵容均 B8 先跑：`/tmp/review-k-flake-shuffle.log:5`、`/tmp/review-k-flake-shuffle.log:15`。
【完成】Caitlyn 冷启动筛选叠加 shuffle（seed20261027）通过，详见 `/tmp/review-k-flake-caitlyn-shuffle.log:15`。
【完成】复现统一命令：`node node_modules/vitest/vitest.mjs run tests/m5-route.test.ts --configLoader runner --maxWorkers=4 --reporter=verbose`；整文件不加参数，筛选加 `-t 'normally buys five-cost Caitlyn'`，换序加上述 shuffle/seed 参数。
【未完成】无本次 must-fix 遗留；按用户范围未跑全套及浏览器。
【需要我决定】无；按授权采用 describe 分段初始化；未指定 -o 路径，报告采用本文件。
【风险】完整真实路线仍耗时；本修复隔离每个 hook/用例的预算，不宣称整文件五秒完成。review K 的两个 G2 可选冷启动建议不属于本次 must-fix 范围。
【下一步】由 Claude 按“测试过了吗／越界了吗／改玩法了吗”交叉审查；本任务不提交。
