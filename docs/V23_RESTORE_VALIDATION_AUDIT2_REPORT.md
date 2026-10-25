【完成】Codex 审计基线：codex/v23-audit2，HEAD 87a013f1；未提交、未修改 .git、规则数值、存档格式、身份常量或前端。
【完成】来源下界失败分支不可达，防御检查保留：冻结重放认证 roundId/dropId（src/simulation/loot-freeze.ts:141），前置收据验证要求 claim ordinal ≥ 编码来源 ordinal（src/simulation/resource-provenance.ts:260）；无 claimedRoundId 时二者相等，联机提前走独立路径。证明注释：src/simulation/b8-restore.ts:296；真实流程拒绝与顺序交换覆盖：tests/b8-late-claim-receipt-order.test.ts:132。
【完成】combatBankGold 改为本回合实际收据金币求和，排除 forfeited；显式收据取 gold，旧式单人收据取金币 payload.quantity，严格相等认证不变（src/simulation/b8-restore.ts:187；src/simulation/combat-input.ts:105）。
【完成】真实路线包含装备、英雄、3 金混合奖励，不能假设全是金币（tests/g2-4b-gambler-loot-gold-restore.test.ts:56）；单人 forfeited 伪造精确拒绝于 combat input basis（同文件:74），真实联机 held/forfeited 双向翻转经对象／JSON 入口精确拒绝于 receipt status（同文件:86）。
【完成】约定按授权自行决定，记为 P-B8-RESTORE-RECEIPTS（P，2026-10-25）：docs/S13_RULES_GAP.md:3。
【完成】定向新增测试 1 文件 5/5 通过；npx tsc --noEmit -p . 最终代码检查通过；git diff --check 通过。
【完成】按指定 glob 运行 fast：npx vitest run --configLoader runner --project fast --cache=false --maxWorkers=2 tests/b8-*.test.ts tests/g2-4b-gambler*.test.ts tests/r3r4-*.test.ts tests/restore-audit/*.test.ts；16 文件中 13 通过、3 失败，149 用例通过、4 超时、15 因 hook 超时跳过（/tmp/v23-audit2-verification.log:1）。未运行全量套件。
【完成】B8 timing 单独运行：npx vitest run --configLoader runner --project timing --cache=false tests/b8-resumable-battle-timing.test.ts；9 用例通过、3 失败，battle/replay 启动中位数 56.47/51.57 ms 超过原有 50 ms 门槛，另一次 replay 采样超过默认 5 秒（/tmp/v23-audit2-timing.log:1；tests/b8-resumable-battle-helper.ts:164、171）。
【未完成】全绿验收：对 b8-resumable-battle、bounds-preflight、g23-grant-evidence 三文件以 --maxWorkers=1 --no-file-parallelism 串行复验，16 用例通过、15 个默认 5 秒测试超时、15 因原有 30 秒 beforeAll 超时跳过；该批次没有断言内容失败（/tmp/v23-audit2-serial-recheck.log:1）。指定 17 文件全部已执行，尚未解决上述超时与 timing 门槛失败；未出现需忽略的 content-digest/golden contentDigest 失败。
【需要我决定】无。
【风险】首轮与 tsc 并行、后续串行均超时，不能宣称整体通过，也未证明超时根因；不放宽断言或超时。只读 node_modules 使默认配置打包失败，使用 runner 加载配置并关闭缓存；定向新增测试日志 /tmp/v23-audit2-targeted.log:1。
【下一步】在性能稳定的环境按原阈值复验上述 3 个 fast 文件与 B8 timing，确认耗时问题后再做交叉验货；本次不扩展为无关性能修复。
