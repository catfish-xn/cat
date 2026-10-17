# 存档一致性 A 批（二）：奖励展开和收据绑定

基线：`origin/multiplayer`，`0719ced60ade353a238024d757cf9440701f6aaa`。
分支：`codex/save-audit-a-receipts`。只修改领域规则、测试、指纹记录器和文档。

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
5. Herald raw 目录是历史证据，包含旧源码 manifest。记录器逐字节校验原始状态/轨迹，核对全部执行元数据与旧源码指纹内部一致性；本次源码指纹另记 `docs/evidence/g2-3/herald-current-fingerprints.json`，`--check` 校验该文件，不重写 raw manifest。
6. 沙箱对冷启动 Node 子进程返回 `spawnSync EPERM`，使用同一测试命令在环境授权执行器复验；没有改测试时限或跳过用例。

7. 环境未配置 Git 作者身份；仅对本次提交使用 `Codex <codex@openai.com>`，不修改用户或全局 Git 配置。

## 验证记录

- 相关 Vitest 文件共 16 个，234 项全部通过；`npm run typecheck` 通过。包含 G23 收据、商店/部署、在线事实、奖励序列、神器锻造、PR161 冷启动存档、B8 输入与资源折叠。
- 新增 `restore-audit/g23-reward-allocation.test.ts`（9 项）、`restore-audit/g23-grant-evidence.test.ts`（10 项）。
- 调整 `g2-3-followup.test.ts` 的非法描述符缓存断言，`g2-3-hook-failures.test.ts` 的故障 fixture；`g2-4a-conqueror-items.test.ts` 用真实完整 tier4 包先领英雄再出售，保留复制器托管场景；`g2-4b-artifact-forge.test.ts` 核对更早的冻结描述符拒绝。
- 指纹命令顺序：`node tests/fixtures/record-g2-3-herald.cjs` → `node scripts/record-g2-3-inputs.cjs` → `node scripts/record-g2-3-inputs.cjs --check`；Herald 另以 `--check` 复验当前源码指纹。
- 未改任何规则数值、版本号、内容表或 digest；未使用 `verify-m8-herald-fixtures.cjs --write`。`g2-3-herald-raw/`（7 文件）及 `g2-augments-herald-raw/` 与交付时最新 multiplayer 原始字节一致。
- `b8-restore.ts` 的历史装备重演函数体和整个 `resource-provenance.ts` 均未修改；未跑全套测试。
