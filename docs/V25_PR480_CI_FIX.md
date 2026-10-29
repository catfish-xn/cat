# v25 PR #480 CI 根因与修复

基线：`claude/v25-ci-480`，`6c9f2a98c74f5adf99b00653cef91f0028074181`；原始工作区干净。
失败 run：[40808291273](https://github.com/catfish-xn/cat/actions/runs/40808291273)。
本次只修改 scripts/tests/docs，不修改 src、玩法、数值、版本、golden、超时或阈值；`.git` 不写入，由执行端提交。

## 1. headless：H13 转换漏入独立物品总账

- 复现：mage/64 后下一条路线是 **cannon/99**，`continue(round=19)`，4-2 → 4-3。
- 根因：`tests/fixtures/m5/oracle.g2.cjs:752`（原 749）只把普通赠予和合成计入 `nextItemSerial`；未计入 H13 的 `augment-item-transform`。
- 此时已持有 `pandoras-items-iii`，库存 `item-12/17/18/9` 转换为 `item-20/21/22/23`；数量保持 4，序号从 20 变成 24。第一件 rod → rod 仍必须分配新 ID。
- 规则依据是既有 `src/simulation/augment-pool-batch5-h13-entry.ts:24` 和 `augment-pool-batch5-h13-transforms.ts:19`；这是合法的既有转换，没有领域规则回归。
- 对照：把 `e0147d72`、`f2235646` 的 oracle 通过 `git show` 读到 `/tmp`，分别对同一失败状态调用旧 `Ledger.check`，均报 **24 !== 20**。旧公式已缺失此项；不能归因于 H3 快账本合并。
- 修复：`tests/fixtures/m5/h13-inventory-oracle.cjs` 从操作前的库存、所有者及独立测试池/配方计算完整转换义务，以 BigInt 独立计算 FNV/LCG；核对转换输入、输出、ID、抽取、历史、资源前缀和回合标记。
- `Ledger.apply` 累计经过验证的消耗数/产出数；库存守恒加“产出−消耗”，序号守恒加“产出”。同时覆盖 Artifactory 和 Salvage Bin+ 的现有转换形式，保留原有精确断言。
- 回归：`tests/m5-oracle-h13-inventory.test.ts` 包含 cannon/99 的独立字面向量、同结果重抽、删除/重复/成对伪造/错序号/错命令、空库存标记及拆装产出顺序。

## 2. browser mage：异变选择后的原生拖拽越过关闭保护层

- 与第 1 项是**不同根因**；browser 使用 mage/42 及 `scripts/v25-online-rules-route.cjs` 的 reroll 策略，完整 headless 同路线可通过。重放确认第 175 条正是选择 `protective-shielding`，第 176 条立即开始部署。
- 第 176 条：4-6，`deploy unit-24 (nami, 2★)`，bench slot 3 → board (0,7)；领域命令正常完成。`protective-shielding` 绑定的是 `unit-26`，不是这次部署的 Nami。
- 根因：`scripts/verify-m5-browser.cjs:109` 原生桌面拖拽直接 mouse.down/move/up；与 `click()` 不同，没有等待 `.choice-overlay.dismissal-shield` 消失。
- `src/rendering/strategy-panel.ts:992` 的既有关闭保护层会拦截确认后的指针事件，持续原有的 400 ms。headless 没有 DOM 保护层，因而没有偏差。
- 修复：在原生部署拖拽前复用点击操作已有的 DOM 条件等待；之后仍使用原生拖拽，并逐条严格比较完整 state。没有重试命令、直接注入状态或放宽时限。
- 验证边界：本任务没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，不启动 Chrome；本地 headless 与脚本检查不能替代实际浏览器验收。

执行端正常终端复跑（顺序执行，避免额外资源竞争）：

```sh
export PATH=$HOME/.local/bin:$PATH
export CHROMIUM_PATH=/usr/bin/google-chrome
npm run build -- --configLoader runner
npm run test:browser -- --build=mage
npm run test:preview -- --build=mage
```

若交回沙盒浏览器任务，请由 Claude 使用 `codex-browser exec` 新建有连接变量的任务，按 AGENTS.md 的 bridge 连接已有 Chrome；不要在沙盒中运行脚本现有的 `chromium.launch()`。

## 3. 两项超时：原样独立运行与耗时来源

两文件最初分别单独运行一次，Node v22.23.4，Vitest `--configLoader runner --maxWorkers=3`，没有并行运行其他测试或 headless 路线。

| 文件/目标 | 本地结果 | 原时限 | 判断 |
| --- | --- | --- | --- |
| `augment-pool-batch5-s6c-room.test.ts:15` 的 public 2-1 augment | 3.575 s；4/4 通过；整个命令 11.59 s | 5 s | 余量有限，不能仅凭本次通过称为远低于上限；CI 同用例 5.339 s |
| `m8-b5-equipment-history.test.ts:195` 的 archived save hook | 9/9 通过；整个命令 68.10 s；JSON 的测试时间差估算该嵌套 hook 约 16.63 s | 20 s | 接近上限，不能判为无成本的偶发；不改超时 |

房间用例在 `tests/server/helpers.ts:36` 的 `runUntil` 中推进真实八席 PvE、结算及 2-1 选择生成；`src/server/room/battle-resolver.ts:70` 对每席执行规则的 startCombat/step，消耗 CPU，不是在等真实时钟。测试使用 `ManualClock`。
归档 hook 会完整校验 18 场真实历史战斗；`src/replay/history.ts:49` 遍历 `battleCollectionChecks`，其中 `src/simulation/battle-record-validation.ts:253` 逐场重演并验证历史衔接；入口 `src/persistence/format.ts:20` 先做存档版本/结构路由。它保留每场战斗间的异步让出；CI 的并行负载会进一步侵蚀余量。
补充冷跑：全种子 headless 已结束后，仅筛选 `archived save` 再跑同文件，仍在 `tests/m8-b5-equipment-history.test.ts:195` 触发 **20 s hook 超时**（命令 39.09 s、退出码 1）。所以此项不能归为纯 CI 负载偶发；它对冷验证/先前测试的预热敏感。先前整文件独立运行的 9/9 通过和 68.10 s 总耗时均保留如实记录。

耗时链：`validateEnvelope` → `routeSaveFile`（`src/persistence/compatibility.ts:63` 对 envelope 做结构校验及深拷贝）→ `validateBattleCollection` → `matchHistoryChecks` → 每场 `replaySnapshot`（冷记录必须重演；`src/simulation/battle-record-validation.ts:145`）。共 18 场，另有逐场历史装备/经济衔接验证。此处没有发现规则或数值错误。

这两项没有修改测试、生产实现、调度分组或时限；按任务约束，报告接近/超过预算的来源，不通过扩充超时来处理。后续优化应单独测量冷重演与历史衔接的 CPU 成本，并维持相同验证强度。

## 验证记录

- 新增独立 oracle 回归：10/10 通过；相关 5 文件（含奖励/掉落/H3 快账本及收尾审计）合计 115/115 通过。
- `npm run typecheck`、两个修改的 CJS 文件语法检查、`git diff --check`：通过。
- 两个原超时文件：首次各自独立运行通过（4/4、9/9）；归档冷跑筛选复测失败，详见第 3 节。
- mage/42、与 browser 完全一致的 routeOptions：headless 全 38 回合，victory，220 命令；第 176 条 Nami 部署符合预期。
- `npm run test:headless`：全部 **24/24 种子通过**，退出码 0；manifest `passed=true`，源码指纹前后一致。开始 `2026-10-29T03:11:03.630Z`，结束 `2026-10-29T03:26:32.336Z`。
- 路线种子（按实际顺序）：`0, 1, 42, 4294967295, 7, 13, 23, 31, 64, 99, 123, 256, 777, 1024, 2048, 4096, 8192, 12345, 32768, 65535, 424242, 3735928559, 2147483648, 2654435769`。

沙盒说明：原样 `npm run test:headless` 在写 manifest 前，Node 的 `execFileSync('git', ...)` 报 `EPERM`，但底层只读 git 已返回 exit=0 和正确 stdout。
本地验收用 `/tmp/ci480-readonly-git.cjs` 预加载，仅把 manifest 的三条只读 git 查询替换为启动前由 shell 取得的真实快照；其余子进程、全部领域执行和全部断言保持原样。该适配器不提交。

```sh
NODE_OPTIONS=--require=/tmp/ci480-readonly-git.cjs VITE_CONFIG_LOADER=runner npm run test:headless
```

最终 manifest 与路线产物保存在 gitignore 的 `artifacts/m5-headless-seeds/`，不提交生成物。
