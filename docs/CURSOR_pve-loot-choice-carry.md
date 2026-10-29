# PvE 自选奖励顺延发放

2026-10-29。基于 `origin/cursor/v26-integration`（已含 `8f794062` pve-loot-carryover）。分支 `cursor/pve-loot-choice-carry`。未开 PR，未强推。

## 问题

失败或平局时，未击杀的 PvE **自选**（`FrozenLootRound.choices` 里的 component-choice，战后 PendingChoice 领取，不在 orb entries 里）会写入 `carry` 与 `choiceEligibility: carried`，并在发放场战后由 `revealDueCarriedChoices` 变为 `revealed`。但 `grantLootChoice` 只在**当前轮**的 `currentPlan(state).choices` 里解析 descriptor；顺延条目的 `roundId` 仍是来源场，查找失败，选择阶段无法发奖。

直接掉落（orb entries）不受影响：`dueCarriedDirectDrops` / 法球领取路径已在 pve-loot-carryover 接通。

## 修复

- `src/simulation/loot-runtime.ts`：新增 `frozenLootChoice(state, dropId)`，在全部冻结轮次 `choices` 中解析 descriptor；`grantLootChoice` 改用它，与 `unresolvedLootChoices` 的跨轮合并一致。

行为不变：发放场战后仍走原有 choice 打开 → `selectChoice` / 联机 `claimOrDiscardLoot` 超时默认 → 终端 fallback；最后一场 PvE 或淘汰仍 `forfeitCarriedLoot`；读档仍由 `b8-restore` / `orb-restore` 核对 `carry` 与 choice carry。

## 测试

通过（`npx vitest run … --maxWorkers=4`）：

- `tests/pve-loot-carryover.test.ts`（含顺延自选在下一场 PvE 战后领一次）
- `tests/server/pve-loot-carryover.test.ts`
- `tests/m8-b8-loot-runtime.test.ts`

`npx tsc --noEmit` 通过。

## 纪元 / 内容漂移（仅报告，未 `--write`）

与 pve-loot-carryover 文档相同：`tests/epic-loot-reforger.test.ts` 部分用例仍读 v25 `cannon.json.gz` 报 `unsupported-version`；`tests/m8-b8-loot-view.test.ts` 若干 terminal 击杀数与 14.24 野怪站位不一致。本分支未重录 golden。
