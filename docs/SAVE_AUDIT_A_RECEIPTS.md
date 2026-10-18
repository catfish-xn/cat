# 存档一致性 A 批（二）：奖励展开和收据绑定

基线：`origin/multiplayer`，`0719ced60ade353a238024d757cf9440701f6aaa`。
分支：`codex/save-audit-a-receipts`。修改领域校验、测试和文档；Herald 记录器已按审查恢复为 multiplayer 原版。

## 实现与验收

| 项目 | 实现位置 | 校验与测试 |
| --- | --- | --- |
| A2 | `serialization-structure.ts:129`、`g2-3-state.ts:88`、`g2-3-rewards.ts:28` | 首次 DTO/atoms 构造前，绑定 seed、经济/结算事实、奖励 identity/tier/source/round；冻结表重生成并比较整个 bundle。展开循环读取已匹配的冻结表值。`restore-audit/g23-reward-allocation.test.ts` 对三种单位奖励的 1000 数量、伪造身份及 tier/source/round，断言 atom 函数调用数为零；直接 preview 也拒绝非表项数量。 |
| A4 | `g2-3-runtime.ts:81`、`g2-3-grant-evidence.ts:20`、`g2-3-grant-evidence.ts:67`、`combat-input.ts:93` | 在选择前记录资源/经济/机制前缀、等级、单位实例/星级/位置；独立折叠资源持有，按 seed 与已验证购买序号重建最强 Rumble 的菜单。核对 unitId、选项、费用、3 星 titan、超时默认；冻结战斗 DTO 不得另换购买绑定。公开命令正例支持购买后出售持有者，负例覆盖错 unitId、非法 titan 和菜单选项。 |
| A5 | `g2-3-match-progress.ts:31`、`g2-3-state.ts:35`、`g2-3-grant-evidence.ts:58` | 同一授予前快照重推部署合法性、资源身份/星级和 3/4/5 学院资格；每条赠装的下一资源事实必须恰为对应物品出生。保留旧有 seed/itemId/轮次/阶次/唯一性校验，按 receiptId 或 source 找到需验证收据，随后两者必须一致。公开商店/部署命令正例、出售成员后的正例，及资格/来源/前缀负例均覆盖。 |

统一入口：`b8-restore.ts:252` 在完整资源折叠后调用新证据验证。A4/A5 主要回归为 `tests/restore-audit/g23-grant-evidence.test.ts`，另有 `tests/fixtures/g2-3-academy-public.ts` 提供实际商店与部署路线。

## 自行决定

1. 原工作区存在用户未跟踪文件，且会被目标分支覆盖；使用 `/tmp/cat-save-audit-a-receipts` 独立 worktree，保留原工作区和文件。
2. 授予证据存放在 `seatMechanics.hidden.grantEvidence`，避免增加客户端字段或改变既有 13 字段 G23 战斗 DTO。相关收据缺证据直接拒绝；没有这些授予的旧状态无需补空数组，保留原始 Herald 输入字节。
3. 证据绑定授予前完整持有资源和部署，而非读档当下阵容，因此后续出售、合星不抹除历史资格；当前资源与完整账本的原有严格校验继续执行。
4. 奖励 preview 支持冻结征服表的完整描述符及已支付金币后的 escrow 描述符；真实存档仅接受经济重推得到的精确 escrow 包。随意拼造的测试描述符改用真实表项，原故障/拒绝断言保留。
5. 按审查纠正：`g2-3-herald-raw/` 是当前规则夹具，领域源码变化必须重录，默认模式严格比对全部字节（含 manifest）；只有 `g2-augments-herald-raw/` 保持与 multiplayer 逐字节一致。已撤回独立指纹方案并删除 `herald-current-fingerprints.json`。
6. 沙箱对冷启动 Node 子进程返回 `spawnSync EPERM`，使用同一测试命令在环境授权执行器复验；没有改测试时限或跳过用例。

7. 环境未配置 Git 作者身份；仅对本次提交使用 `Codex <codex@openai.com>`，不修改用户或全局 Git 配置。

## 原交付验证记录（本轮结果见末节）

- 相关 Vitest 文件共 16 个，234 项全部通过；`npm run typecheck` 通过。包含 G23 收据、商店/部署、在线事实、奖励序列、神器锻造、PR161 冷启动存档、B8 输入与资源折叠。
- 新增 `restore-audit/g23-reward-allocation.test.ts`（9 项）、`restore-audit/g23-grant-evidence.test.ts`（10 项）。
- 调整 `g2-3-followup.test.ts` 的非法描述符缓存断言，`g2-3-hook-failures.test.ts` 的故障 fixture；`g2-4a-conqueror-items.test.ts` 用真实完整 tier4 包先领英雄再出售，保留复制器托管场景；`g2-4b-artifact-forge.test.ts` 核对更早的冻结描述符拒绝。
- 原交付的指纹方案已撤回。修订使用 `node tests/fixtures/record-g2-3-herald.cjs --write` → `node scripts/record-g2-3-inputs.cjs` → `node scripts/record-g2-3-inputs.cjs --check`，最后运行原版 `node scripts/verify-m8-herald-fixtures.cjs` 严格核对。
- 未改任何规则数值、版本号、内容表或 digest；未使用 `verify-m8-herald-fixtures.cjs --write`。`g2-augments-herald-raw/` 与最新 multiplayer 原始字节一致；当前规则目录 `g2-3-herald-raw/` 仅 manifest 相对合入后的 multiplayer 变化，五个状态和 trajectory 原始字节不变。
- `b8-restore.ts` 的历史装备重演函数体和整个 `resource-provenance.ts` 均未修改；未跑全套测试。

## PR #172 审查修订

- 远端起点经 fetch、ls-remote 核实为 `da04ccb96f180f1d3c20a114f0928bc03b5e93b7`；#170 已合入，merge `multiplayer` 的 `4ad4e83df584dee8ff7d4113c935ec03c8cca291`，无冲突。#170 自带的 v9 版本/内容表直接继承，本次没有再升版本或修改规则数值。
- M1：记录器与 multiplayer 原版逐字节一致，恢复默认模式对源码指纹的严格核对；不使用 `verify-m8-herald-fixtures.cjs --write`。inputs 审计随 manifest 更新。
- M2：`g2-3-lesser-shimmer-duplicator.test.ts` 用冻结的 `TFT13_Crime_LootA` 完整描述符，先处理该包真实的物品授予，再保留 8 个棋盘/备战席复制正例与不合格目标托管断言；2 个不支持的大复制器负例改为断言更早的冻结表拒绝。
- 自行决定：使用 `/tmp/hex-pr172-review-fixes` 独立副本保留用户工作区；测试串行运行，避免同任务内部 CPU 竞争；未改时限，未删或跳过用例。
- 新增 7 项测试：全部冻结奖励包的键顺序/JSON 稳定性、热缓存拒绝篡改及不可变性，以及授予证据多余快照、身份、轮次、等级、位置冲突（每项覆盖 Rumble/学院和对象/JSON 两入口，并断言失败不改输入）。
- 位置冲突回归首次暴露出 `validateDeployment` 支持交换，不能独自证明历史快照位置唯一；授予证据现额外检查位置唯一性。此为非法快照拒绝加固，正常部署/交换规则不变。
- 7 条低风险建议原文未随任务提供，仓库文档及 GitHub #172 正文/评论/行内评论/审查列表也无该报告，因此不能声称逐条处理；以上 7 项为独立补充测试。未擅自猜测其余建议内容。
- #171 尚未合入，本次不修改其缺少完整战斗历史的 4 条正例，按用户要求留给 #171 补齐。

### 本轮验证

- 相关 Vitest：17 个文件、266 项全部通过（核心 3 文件 63 项，其余 14 文件 203 项）；新增 7 项计入其中。完整联机/浏览器验收未运行。
- 测试命令：`npm test -- tests/restore-audit/g23-reward-allocation.test.ts tests/restore-audit/g23-grant-evidence.test.ts tests/g2-3-lesser-shimmer-duplicator.test.ts --no-file-parallelism --maxWorkers=1`；其余覆盖 G23 followup/hooks/content/integration、在线事实、征服者物品、神器 forge/reward-order、PR161 冷启动恢复、B8 combat-input/resource-provenance/restore-fold-reuse/restore。
- `npm run typecheck` 通过；共享依赖缺 `@types/node` 后，使用 `/tmp/pr172-deps` 按锁文件执行 `npm ci` 安装隔离依赖，再复验通过，未修改依赖文件。
- 最终重录顺序：Herald `--write` → inputs 默认重录 → inputs `--check`（9 项）均通过。manifest 的 258 个源码指纹逐项核对，失配为 0；`sourceSha256=4ba96174467cfdafff25fa7d3e4afca63394433e4e685d6ca4ad86a49bce1d5a`。
- 原版 `node scripts/verify-m8-herald-fixtures.cjs` 默认 verify 通过：7 文件严格一致，五个场景均完成原始状态恢复及开战后 15 tick 往返校验，manifest 无不一致；未使用该入口的 `--write`。
