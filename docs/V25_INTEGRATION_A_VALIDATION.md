# v25 集成 A 定向验证报告

验证日期：2026-10-27。分支 `claude/v25-int-a`，HEAD `b40ce329`，比较基线 `origin/multiplayer` 为 `100589ca`。

六次合并均由用户事先完成。以下冲突清单来自合并提交正文的 `Conflicts`，处理方式根据已提交的合并结果及 combined diff 复核；本次没有重新合并，也没有执行 Git 写操作。目标为联机；按要求运行各分支改动的完整测试文件，其中已有的单机领域夹具随文件执行，未扩展单机功能或运行单机全套验收。

## 验证结论

- `npx tsc --noEmit -p .`：修复前、修复后均通过。
- 定向测试共 **25 个文件、276 项通过、9 项既有跳过、0 项失败**。这是首轮与失败文件复跑后的累计结果，不是另跑全套所得。
- 生产体积测试 `scripts/tests/production-size.test.ts`：6 项通过，包含压缩前后语义、内容/掉落摘要、事件、RNG 和恢复一致性。此项是已有生产表示测试，未额外执行 Vite 完整生产构建或测量发行包字节数。
- `tests/augment-history*.test.ts` 当前匹配 1 个文件：77 项通过。
- 独立 oracle 账本 `tests/m5-oracle-augment-ledger.test.ts`：43 项通过；阶段禁选独立 CLI 审计测试：10 项通过。H1 免费刷新及 H3 候选池与独立 oracle 的对照亦已随分支测试执行。
- 内容身份独立测试：6 项通过；`node scripts/update-content-identities.cjs --check` 通过，保留用户重算的 `a81bf97e` / `30335c2e`，本次没有再改内容身份。
- `git diff --check` 通过。未修改服务器、界面或游戏规则实现。

## 各分支冲突与处理

以下列出的文件都属于既有合并冲突；“本次修正”另列在下一节。

### codex/v25-augment-history — 71ff1b8a

合并提交未记录冲突，combined diff 未显示手工合并差异。保留版本化历史、席位绑定、取得事务取样及恢复认证的分支实现。

### codex/v25-h1 — f2d896e4

冲突文件：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`。

处理：合并期间没有采用单分支摘要覆盖集成基线；所有分支合并后由用户重算内容身份，本次将生产体积测试的两个固定期望同步到该集成身份。H1 的赠英雄与前场实际战斗名单计数保留；Shop Glitch 仍未开放。

### codex/v25-h3 — 4147faf1

冲突文件（13）：

- `docs/S13_RULES_GAP.md`、`scripts/tests/production-size.test.ts`。
- `src/simulation/augment-pool-grants.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`。
- `src/simulation/content/augment-offer-rules.ts`、`augment-policy.ts`、`augments.ts`、`identity-constants.ts`、`rules-manifest.ts`（后五项均在同一 content 目录）。
- `tests/augment-history.test.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`。

处理：并列保留 H1/H3 的内容、位阶、API、manifest、赠品与共享事务逻辑，累加注册数；独立 oracle 同时保留 H1 两张二费赠卡与 H3 金锅锅。历史测试合并版本/摘要归一化与动态选种，原始 SHA-256、战斗事件数和账本断言保持不变。文档保留两侧约定；身份统一收尾。

### codex/v25-h4 — b9b83d05

冲突文件（15）：

- `docs/S13_RULES_GAP.md`、`scripts/tests/production-size.test.ts`。
- `src/simulation/augment-history.ts`、`augment-pool-grants.ts`、`match.ts`、`shared-pool.ts`、`validate-content.ts`（后四项均在同一 simulation 目录）。
- `src/simulation/content/augment-offer-rules.ts`、`augment-policy.ts`、`augment-stage-bans.ts`、`augments.ts`、`identity-constants.ts`、`rules-manifest.ts`。
- `tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-content.test.ts`。

处理：保留 H3 战后成长与 H4 羁绊收入/幸存者支付及恢复校验；内容、禁选、互斥与 oracle 初始金币条目叠加。H4 合并时的 241 项目录期望随后被 H5/H6 扩充，本次补齐对应测试计数。幸存者金币与收据已到账，但服务器事件传递缺口仍保留，见遗留问题。

### codex/v25-h5 — bc58763e

冲突文件（10）：

- `docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`scripts/tests/production-size.test.ts`。
- `src/simulation/content/augment-offer-rules.ts`、`augment-policy.ts`、`augment-stage-bans.ts`、`augments.ts`、`identity-constants.ts`。
- `src/simulation/validate-content.ts`、`tests/fixtures/m5/oracle.g2.cjs`。

处理：保留已有强化合同，叠加共享选秀专属候选、初始金币和选秀资格；Table Scraps 的三个阶段禁选均保留。独立 oracle 通过 sharedCarousel 参数区分两张仅共享选秀卡，本次补齐该已有参数的 TypeScript 声明并分别核对 245/243 项数量。未解除阶段禁选或改动抢占规则。

### codex/v25-h6 — b40ce329

冲突文件（22）：

- `docs/S13_RULES_GAP.md`、`scripts/tests/production-size.test.ts`。
- `src/simulation/augment-history.ts`、`augment-pool-grants.ts`、`b8-restore.ts`、`combat-input.ts`、`match.ts`、`round-settlement.ts`、`shared-pool.ts`、`strategy-snapshot.ts`、`two-sided-snapshot.ts`、`validate-content.ts`。
- `src/simulation/content/augment-offer-rules.ts`、`augment-policy.ts`、`augment-stage-bans.ts`、`augments.ts`、`identity-constants.ts`、`rules-manifest.ts`。
- `tests/augment-stage-bans-audit.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`。

处理：历史入口同时保留幸存者支付与冲榜入轮成长；战斗输入、双边快照、策略和恢复同时携带 H3 历史成长与 H6 成长字段。结算和共享事务保留各组支付/校验，注册表及 oracle 继续累加。本次修正仍停留在单分支值的审计数量和账本数量，并让纷争夹具使用已有的集成阶段种子。

## 本次修正

| 文件 | 修正及依据 |
| --- | --- |
| `scripts/tests/production-size.test.ts` | 固定摘要同步为 `fnv1a32-utf16:a81bf97e`、`fnv1a32-utf16:30335c2e`，保留运行时重算与压缩前后比较。 |
| `tests/m5-content.test.ts` | 源表计数补入 H5/H6；固定总数为 235 基线 + H1/H3/H4/H5/H6 的 1+2+3+2+2 = 245。 |
| `tests/m5-oracle-augment-ledger.test.ts`、`tests/fixtures/m5/oracle.g2.d.cts` | 默认池 243、共享选秀完整注册池 245、差集恰为两张 H5 卡；补充已有 sharedCarousel 参数类型，不修改 oracle 实现。 |
| `tests/augment-stage-bans-audit.test.ts` | 集成库存 218、现有禁选行 171、重建行 176；仍逐项断言原有五项差异。真实子进程输出改用临时文件描述符，避免沙盒管道 EPERM，退出码/stdout/stderr 校验不变。 |
| `tests/server/batch5-h3-room.test.ts` | 原 s3、无刷新取得路线改用集成池首个种子 15。 |
| `tests/server/batch5-h3-cooking-room.test.ts` | s2、至多两次刷新路线首个种子为 5；已有目标卡时停止刷新。 |
| `tests/augment-pool-batch5-h5-priority.test.ts` | s2 原始选项直接取得的首个种子改为 8。 |
| `tests/server/scoreboard-h6-room.test.ts` | 改用首个能让 s0 在三次刷新内取得冲榜的种子 49。 |
| `tests/augment-pool-batch5-h6.test.ts` | 两处旧种子 52 改读既有 `STAGE_SEEDS.contested.seed`，实际为 18。 |
| `tests/augment-pool-batch5-h4-seed.test.ts` | 保留种子 17 与三羁绊/1 金/恢复防篡改断言，通过有界付费刷新和购买取得艾瑞莉娅、芮尔、德莱文、薇古丝、莫甘娜；不依赖合并前首强化赠品碰巧构成的阵容。 |

所有选种均从 0 起有界搜索真实候选，随后用真实房间/公共命令复验。未伪造强化、余额、战斗结果或资源收据，未改 golden，未提高回归测试超时。

## 分支测试覆盖

测试清单按用户指定的 `git diff --name-only origin/multiplayer...origin/<分支> -- tests` 提取，测试文件取并集。`.cjs` oracle 和 `.ts` helper 由相关测试加载，不伪装成独立可运行的测试文件。

| 分支 | 改动的测试文件数 | 通过项 | 既有跳过 |
| --- | ---: | ---: | ---: |
| codex/v25-augment-history | 1 | 77 | 0 |
| codex/v25-h1 | 5 | 104 | 9 |
| codex/v25-h3 | 8 | 148 | 0 |
| codex/v25-h4 | 6 | 117 | 0 |
| codex/v25-h5 | 4 | 105 | 0 |
| codex/v25-h6 | 6 | 151 | 0 |

各行含共享文件，不能相加。去重为 23 个分支测试文件，加生产体积及内容身份测试共 25 个。首轮 16 文件通过、9 文件失败；修正后审计/目录/oracle 三文件 62 项通过，六个路线文件 32 项通过，原有 10 项因 beforeAll 失败被跳过的用例均已实际执行并通过。

环境适配仅用于本工作区：`node_modules` 链接到只读外部依赖，使用 `--configLoader runner`、`/tmp` 缓存，并在临时配置中关闭无关的浏览器 globalSetup；保留原 fast 项目、worker setup 与默认超时，使用 4 workers。没有启动浏览器。

复现入口与原始证据均在 gitignore 目录 [artifacts/v25-int-a-validation](../artifacts/v25-int-a-validation/)：`branch-tests.json`、`test-files.json`、`merge-conflicts.json`、`final-coverage.json`、首轮日志/JSON、`audit-rerun.log`、路线复跑日志/JSON、`stage-audit.json`、tsc 日志及选种记录。`final-coverage.json` 明确标记为多轮累计统计。

```sh
npx tsc --noEmit -p .
node scripts/update-content-identities.cjs --check
npx vitest run --config artifacts/v25-int-a-validation/vitest.config.mjs --configLoader runner --project fast --maxWorkers=4 <test-files.json 中的明确文件列表>
```

## 遗留问题及范围

1. **B5-07 Shop Glitch 尚未开放**：房间准备期逻辑计时接线未完成，内容 enabled=false，原有 9 项集成用例仍 `describe.skip`。时钟边界、锁店跳过和禁用状态的 5 项检查通过；不能把这解释为该强化已可用。
2. **B5-34 幸存者结算事件尚未传递**：金币和唯一收据及恢复测试通过，但 `recordRoomSettlementTable` 后的新 `mechanicGranted` 未进入服务器发布事件。已有需求见 [UI_REQUESTS.md](UI_REQUESTS.md) 的 B5-34-SETTLEMENT-EVENT。本次按 Codex 文件职责没有修改服务器。
3. **阶段禁选审计仍报告五个已有源资料差异**：Academy、Cabal、Experiment、Formswapper、BloodBrothers。测试要求独立 CLI 对这五项返回失败并准确列出，因此“审计测试通过”不代表资料一致性零差异；未擅自改变开放阶段。
4. **Table Scraps 仍按既有决定三阶段禁选**；测试里的显式持有夹具仅验证共享选秀分配和守恒，不证明自然可取得。
5. 本次没有完整对局、浏览器、部署或发行包体积验收；没有重录 epoch，也没有处理不在所选文件范围内的旧固定种子/单机套件。后续应先由 Claude 补齐上述服务器接线，再做对应联机验收。
