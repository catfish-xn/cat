【完成】在 `codex/v23-perf2` / `87a013f1` 重新应用 `6a074ed7` 的等价优化，保留 v23 新增认证；同步规范编码、完整候选比较、私有重放游标及不可变声明共享、构造器表示借用、单次恢复 G23 派生复用均已迁移（`src/simulation/serialization-structure.ts:140`、`src/simulation/content/index.ts:48`、`src/simulation/g23-restore-reuse.ts:17`）；不跨调用缓存准入结果，不改规则、数值、存档、身份、oracle 或指定禁改目录，未写入 `.git`、未提交。  
【完成】四条路线每 8 步一例，使用 Vitest 默认超时；文件内只缓存原路线压缩边界和输入，边界恢复归下一段首步，以完整 JSON 字节绑定，确保全部插入使用真实恢复状态且恢复次数不增（`tests/m5-replay-helper.ts:66`、`:74`、`:90`）；合计 1,004 命令、48,916 tick、49,920 次恢复、199,680 次拒绝插入，原完整断言保留；P 约定：`docs/S13_RULES_GAP.md:1017`。  
【完成】计时为同机、相同最终分段器、相同 `--maxWorkers=4` 命令的完整工作量对照：优化前快照 605 个生产文件与原 HEAD 快照逐字节一致；长路线 wall 包含路线收集及全部用例，短文件为测试执行 wall，均不含模块转换。原单例超时后的重叠运行不用于下表；两组对照并发运行，属于单次共享负载观测。  
【完成】`tests/m5-replay.test.ts:3`（sniper）：690.364 → 556.001 秒；1,748 段全部通过，最大单段 0.734 秒。  
【完成】`tests/m5-replay-sniper-caitlyn.test.ts:3`：674.369 → 538.968 秒；1,716 段全部通过，最大单段 0.581 秒。  
【完成】`tests/m5-replay-mage.test.ts:3`：641.607 → 513.908 秒；1,680 段全部通过，最大单段 0.593 秒。  
【完成】`tests/m5-replay-cannon.test.ts:3`：379.463 → 279.219 秒；1,098 段全部通过，最大单段 0.524 秒。  
【完成】`tests/m5-replay-intermediates.test.ts:9`：0.326 → 0.322 秒；4 项全部通过。  
【完成】`tests/m5-replay-resource-reuse.test.ts:16`：0.370 → 0.422 秒；3 项全部通过（增加 0.052 秒）。  
【完成】优化前后 M5 均为 6 文件、6,249 项全部通过；CLI wall 1,076.69 → 842.09 秒，降低 21.79%。另运行指定 persistence、全部 restore-audit、根目录全部 *forg* 及相关恢复/batch3 回归，共 30 文件、448 项：445 通过、3 失败；新增等价性 4 文件/12 项、persistence 54 项、restore-audit 77 项全部通过。`npx tsc --noEmit -p .` 与 `git diff --check` 均通过；未运行全套测试。  
【完成】可复核记录：`/tmp/v23-perf2-before/control-final.{log,json,time}`、`/tmp/v23-perf2-after/m5-final.{log,json,time}`、`/tmp/v23-perf2-after/regression.{log,json,time}`；完整回归清单 `regression-files.txt`、命令 `/tmp/v23-perf2-after/final.sh`，Vitest 使用 `--configLoader runner`；原版快照与相同分段器位于 `/tmp/v23-perf2-control`。  
【未完成】回归未全绿：`tests/epic-loot-reforger.test.ts:210` 原先期待 `neutral opening plan/consumption`，实际为 `Invalid authoritative Mirror forge replay`；原版与优化版独立复跑均 25 通过/3 失败，28 项状态及失败首行完全一致（`/tmp/v23-perf2-before/epic-original.json`、`/tmp/v23-perf2-after/epic-isolated.json`）。另外两项仅 content-digest 不匹配，按用户要求忽略；不改断言或拒绝原因，不重录夹具。  
【需要我决定】无；工程未决项已按推荐方案执行并记录 P。  
【风险】既有的 `epic-loot-reforger:210` 失败仍会使对应 CI 非绿；单次共享负载计时不等于 CI 加速保证，短文件毫秒波动不作性能结论。  
【下一步】由 Claude 交叉验货：测试结果、目录边界、玩法是否变化；另立任务解决 `epic-loot-reforger:210` 的既有拒绝消息契约不一致，再进入合并流程。
