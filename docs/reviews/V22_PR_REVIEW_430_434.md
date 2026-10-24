【完成】审查 #430/#431/#432 各自相对 origin/claude/v22-integration 的三点差异，以及 #434 提交 28891acb；未改源码、既有测试、素材或 Git，未提交。
【完成】#430 — should-fix：src/rendering/strategy-panel.ts:1423 只读取服务器 deadline；单机没有 choiceDeadline/serverNow，倒计时为空，且 src/rendering/match-session.ts:120 只推进战斗，打开后超过 30 秒仍不自动选首项，违背 docs/ANVIL_UNITS.md 的单机计时要求。此为既有接入缺口，非本 PR 新引入；新增 it.fails 在当前树和该 PR 快照均复现。
【完成】#431 — 未发现 must-fix / should-fix / nit；src/presentation/s13-g23-manifest.ts:176、src/presentation/s13-g23-asset-checks.ts:90 与新增 PNG 一致；实际 64×64、3052 B、SHA-256=9ee4f66dc5f983ead0c827cb1ea675f23695e572cfa02b8c1a90592a008a6b88。
【完成】#432 — should-fix（静态确认）：scripts/assets3d/jayce-forge.mjs:52 的索引缺块分支返回 {ready:false,phase:'index',chunks}，但 :151 无条件读 report.missingChunks.length；冷缓存无法取齐 WAD 索引时，已写 plan/report 后又抛 TypeError，丢失预期 CLI 摘要。建议统一失败返回结构；现有 11 项专项未覆盖此路径。
【完成】#432 — spawn/cast/death 接线、复活和无星级逻辑与 docs/ASSETS3D_JAYCE_FORGE.md 一致；未发现其他需报告问题。
【完成】#434 — 未发现阻断缺陷；src/simulation/g2-4b-voidspawn.ts:62、src/simulation/two-sided-snapshot.ts:143 仅按仍在场的杰斯投影/筛选。出售或合星消耗后旧 unit-N 位置键确实保留，但无害：恢复后不生成、不接受移动、不进战斗快照、不传给新编号或另一合星存活者。
【完成】新增 tests/v22-review-forge-lifecycle.test.ts（8/8）：出售与补发、合星消耗/存活、旧键无害、不能上备战席/出售/装备且失败原子、锁阵/开战拒绝移动、拖动位置存取与重新上场、同编号两席不同位置镜像、P-F6 与 Sion 抢格优先级及旧顺序。
【完成】新增 tests/presentation/v22-review-anvil-offline.test.ts（1 通过、1 expected fail）：服务器 deadline 经私有投影与显示适配保留、拒绝错 choiceId/generation；it.fails 精确记录上述单机超时缺口，未改 src。
【完成】当前树最终命令：npx vitest run --configLoader runner tests/v22-review-forge-lifecycle.test.ts tests/presentation/v22-review-anvil-offline.test.ts tests/jayce-forge-placement.test.ts；结果 3 文件通过，13 passed / 1 expected fail。
【完成】/tmp 独立分支快照专项：#430 tests/presentation/anvil-display.test.ts 4/4；新增 deadline 文件 1 passed / 1 expected fail；#432 tests/rendering3d-jayce-forge.test.ts 与 tests/assets3d-neutrals.test.ts 共 11/11。只运行指定文件；#431 直接校验 Git 中 PNG，未联网拉素材。
【未完成】未运行真实 GPU/浏览器及版权素材转换；#432 冷缓存 CLI 问题为静态审查结论，未做端到端素材复现。默认 Vitest 加载器因只读 node_modules 失败，改用 runner 后专项通过。
【需要我决定】无；消息未提供 -o 路径，报告暂存工作区 v22-review-report.md。
【风险】expected fail 表示已知缺口仍存在，不代表功能已通过；未合并 #430–#432，未验证三者叠加后的最终集成观感。审查 refs：#430 0314cc30、#431 efa21220、#432 1d1b320a；当前 HEAD 4af5547d。
【下一步】补齐单机 30 秒窗口及恢复计时、统一 #432 索引失败返回，再去掉对应 it.fails 并重跑这些专项。
