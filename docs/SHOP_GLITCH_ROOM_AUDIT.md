# Shop Glitch 房间测试审计（2026-10-28）

结论：本次失败来自报价漂移及未约束的其他席位选择。恢复“两名持有者”的测试前置条件后，生产计时与独立 `shopGlitchShared` 一致。未修改任何 `src` 文件或独立参考实现，未修改游戏规则、数值、超时、门槛、预算或录制证据。

基线为 `claude/sol-t9 @ 773853c3758cc5a296a129c9a5fd2323c6b1eeaa`，包含指定的 `97068956`；基线工作区干净，本次只留工作区改动，不执行 Git 写操作。

## 规则与两边实现的证据

- `docs/AUGMENT_BATCH5_GAPS.md:124` 保留 14.24 原文与字段：非玩家对战期间每 2.5 秒免费刷新，持续 30 秒。
- `docs/S13_RULES_GAP.md:86` 的已批准 P-B5-07：仅 PvE 战斗轮准备期，2500、5000…30000ms；离开即停，锁店跳过且不补刷，取得当轮以取得时刻为起点，后续 PvE 从准备期开始计时。
- `docs/MULTIPLAYER_CONTRACT.md:3` 明确默认准备期仍为 20000ms、最多 8 次；第 7 行要求按席序暂存全部结果，一次发布，截止点在冻结前采样，延迟交付不能多算时间。没有第五批延长或改变共享准备期时间的依据。
- 生产 `src/simulation/augment-pool-batch5-h1.ts:6` 选择 PvE 与起点，`:25` 用截断到起点后 30000ms 的边界差计数并跳过锁店；`augment-history.ts:130` 逐次刷新；`shared-pool.ts:304` 将返池和抽卡纳入共享事务。
- 独立 `tests/fixtures/m5/oracle.g2.cjs:802` 枚举 12 个 2500ms 边界，排除 PvP、非准备期和锁店；`:814` 用独立 LCG、等级概率与有限副本数重新抽卡。它不调用生产时钟或抽卡函数，也不从刷新收据生成预期。
- 房间 `src/server/room/room.ts:1953` 截止点采样，并按存活且需要时钟的席位顺序暂存；只有全部成功才发布。多个持有者应同时参与共享池变更，不能只处理测试命名的两席。

## 报价漂移与 fault 数量

原种子 537 已无法通过公开三次单槽重选保证 s1/s3 获得 Shop Glitch，原文件复现 22/55 项失败。取得失败使后续计时、恢复和 fault 用例继续在错误前置状态下运行；独立 oracle 的早期单强化作用域检查也因此拒绝状态。

对照实验只安装 `installB1Offers(['shop-glitch'])`、改用范围内种子 42，保留原计时断言，仍有 14 项失败：其他席位的默认选择也可取得 Shop Glitch，参考推导却只遍历 s1/s3，导致有限共享池不一致；fault 在 s3 拒绝之前实际暂存了 3 席（s0、s1、s2）。这是报价脚本影响了其他席位的结果，不是共享准备期规则改变。原始报价失败时 fault 暂存数则为 0，不能据此调整固定期望。

最终 `tests/server/shop-glitch-room.test.ts:24` 只脚本化三选一、保留真实资格与 RNG 推进，种子为 42。`:34` 经公共选择命令让另外六席明确选择非 Shop Glitch 的现有报价，必要时完成其后续选择，并自检持有者恰为 s1/s3；所有报价 `toContain` 均注释为夹具自检。

`:59` 的时钟预期、存档后的下一次刷新，以及默认截止点预期继续调用独立 `shopGlitchShared`，没有改成生产函数自证。`:208` 在 fault 注入前再次检查两名持有者；保留 `staged.toHaveLength(1)`、成功事务和全部原引用回滚断言，并额外断言暂存席位为 `['s1']`。没有删除或放宽原断言。

## 验证

- 原文件 55 项全部通过；额外 `tests/augment-pool-batch5-h1-shared.test.ts` 的独立共享池对照 1 项通过，共 56 项。
- 命令：`npx vitest run --config artifacts/shop-glitch-audit/vitest.config.ts tests/server/shop-glitch-room.test.ts tests/augment-pool-batch5-h1-shared.test.ts --configLoader runner --maxWorkers=3`。耗时 29.89 秒。
- 本次房间测试使用注入的 ManualClock，不需要浏览器或监听端口。忽略目录中的临时配置保留 fast 项目的线程、隔离与 worker setup，仅省略浏览器 global setup；没有调整任何超时或预算。未遇到 listen EPERM；未运行整个 `tests/server`。
- `npm run typecheck`（`tsc --noEmit`）与 `git diff --check` 通过。

未完成事项：无。修改的 src 文件：无。需要用户决定：无。
