# 加时收据与 C19 重铸器调查

基点：`1fb55af1a89f8fc7f5e7a68b44480e84da9b8ddd`；分支：`codex/mp-overtime-receipt`。
Node：22.23.3。未调整版本、内容数值、测试时限或校验条件；`src/server/`、`src/rendering/` 均未修改。

## 加时机制弹窗：已独立复现的规则缺陷

`tests/mp-overtime-choices.test.ts` 构造联机结算事务向量：按现有规则的六次炼金男爵 3 胜利积累 90 微光，ordinal 39 的胜利达到 105，触发黑市。
轮次推进使用 `advanceMultiplayerRound`；历史使用现有 `finalSettlement` 事务夹具，明确不是可恢复的单人存档。

```sh
npm test -- tests/mp-overtime-choices.test.ts
```

原代码返回 `invalid-receipt`。最小探针进一步暴露：

```text
RangeError: Unknown catalog round ordinal
  getCatalogRoundByOrdinal
  getRoundKind
  openMechanicChoice
```

原因在 `src/simulation/seat-mechanics/choices.ts:59`（原 SHA 第 58 行）的 `openMechanicChoice`：供给轮判断调用仅支持固定目录的 `getRoundKind(state.round)`，ordinal 39 不在目录内。
当 `applyRoundSettlement` 的 `openG23Choice` 钩子触发新弹窗时，异常被 `src/simulation/round-settlement.ts:148` 的 catch 映射为 `invalid-receipt`；此路径不代表收据字段校验失败，也没有机器人发送不合法操作。
此外，选择或超时完成后，`src/simulation/match.ts:118` 的 `enterScheduledEvents` 也直接查固定目录。只修弹窗打开会把异常推迟到选择完成。

本分支修复这两处：联机弹窗用联机轮次查询；联机加时没有固定目录事件，保留原有返回阶段及后续奖励钩子。
回归检查结算打开黑市、手选、超时、返回结算、推进 ordinal 40、一次性收据和篡改伤害拒绝。

### 阶段物品

`src/simulation/multiplayer-round.ts` 为伤害与目录身份兼容保留 stage 6；加时 PvP 基础伤害仍为 17。
`src/simulation/strategy-snapshot.ts:32` 的 `supportStage` 已把目录外轮次映射为最后阶段加一，即 stage 7；`stageProgram` 和辅助物品授予均使用该值。
现有 `tests/g2-4b-artifacts.test.ts` 覆盖智慧末刃、巫妖之祸在 `overtime-1`、`overtime-5` 的绑定值。本次未修改这套数值或映射。

### C19 现场复现状态

旧证据 `artifacts/validation-1fb55af/c19-seed2.log` 的故障为 `seat bot-5: invalid-receipt`，但没有内部异常栈或被拒的权威输入；不能仅凭此确认它命中了上述路径。
本次第一次 `C19_SEED=2` 保持原 75 分钟上限，在 6-6 正常结束并给出八席排名，未进入加时：退出码 1，耗时 2,062,871 ms。
两条 FAIL 原文如下，均是检查机会不足，不能算作本次复现了产品异常：

```text
FAIL every .4 supply dialog showed exactly the offered components and the pick landed in the inventory (no supply pick)
FAIL in-battle buy/reroll/buyXp ran (no battle with gold, an offer and bench space)
```

seed 1 结束并释放端口后，串行重跑第二次原 SHA `C19_SEED=2`，保留原脚本、断言和时限，关闭额外指针跟踪，只对服务器结算作诊断插桩。第二次在 6-1 正常结束并给出八席排名：退出码 1，耗时 1,801,803 ms；同样只有上述两条未遇到检查机会的 FAIL，3-7 重铸器成功。
日志与报告分别为 `c19-seed2-retry.log`、`c19-seed2-retry/report.json`。两次 seed 2 都没有进入 ordinal 39，也没有触发 `invalid-receipt`，因此没有抓到历史 bot-5 的被拒收据或异常栈。

原 SHA 重跑命令（各轮串行、Node 22、浏览器路径已就绪）：

```sh
C19_SEED=2 VERBOSE=1 node tests/server/e2e/c19-full-match.mjs
# 重铸器现场对照使用 C19_SEED=1，其余脚本断言和时限相同。
```

**未完成：历史 seed 2 / bot-5 那一笔收据的精确根因仍未确认。** 本分支只把已独立复现、原代码必失败而修复后通过的加时弹窗路径认作已修缺陷；不能据此宣称历史整局故障已经验证消除。历史证据未保存权威输入，重跑的淘汰进程不同。未对服务器提出未经证据支持的补丁，未做修复后 C19 完整局验收。

原始日志、报告及诊断产物保留在 `artifacts/mp-overtime-receipt/`。诊断仅插桩生成的服务器 bundle，用于记录各 `invalid-receipt` 分支的输入和异常栈，不改源码规则或返回值。

## C19 成装重铸器：已复现的测试驱动缺陷

旧三条 FAIL 对应同一次 `completed-reforger` 消耗品操作，乙，2-7，settlement，目标 `item-3`：

```text
FAIL 乙 completed-reforger: one useConsumable to an allowed target ([])
FAIL 乙 completed-reforger: receipt null, state pushed
FAIL 乙 reforger: item-3 is gone from the projection and the cards
```

工具确实持有，目标也在服务器允许列表中；`commands: []`、`receipt: null` 表明该次拖拽没有发出 `useConsumable`，不是“没有获得工具机会”，也没有服务器拒绝这个命令的证据。
`tests/server/e2e/c19-full-match.mjs:349`（原 SHA 第 348 行）起的工具路径只在收到 `refused:wrong-phase` 时释放 claim；无命令时仍记录任务并执行后续检查，因而一次未发命令会产生三条 FAIL。
原截图拍摄于两次等待结束后，已经到 3-1，不能据此反推拖拽瞬间的命中或阶段。

本次 seed 2 在 3-7 成功使用重铸器，命令一条、`consumable-used`、原物品消失。
独立页面夹具直接使用真实 `StrategyPanel` 和投影目标，普通拖拽与中途 `render()` 均成功；尚未将历史失败归因于普通重绘。
seed 1 在原 SHA 隔离副本的诊断重放中原样复现了上述三条 FAIL。指针证据如下：

| 时刻（Unix ms） | 事件 | 坐标 / 结果 |
| --- | --- | --- |
| 1792303401949 | pointerdown | (79, 1500.25)，命中 consumable-5 |
| 1792303404938 | 最后一次 pointermove | (84.328125, 2507.390625)，命中 null |
| 1792303405174 | pointerup | (84.328125, 2507.390625)，命中 null |
| 1792303405184 | lostpointercapture | 状态文案为“消耗品未使用 · 请放到我方单位或装备上” |

全程处于 2-7 settlement，同一手势 epoch 121 保持到松手；不是阶段切换或拖拽取消。源工具在视口内，目标装备槽在 y≈2507，超过 C19 原视口高度 2200。
根因是 `c19-full-match.mjs` 只检查 debug bounds 存在，没有保证目标处于视口内。`StrategyPanel.snapshot` 合法地报告视口外非零边界；`toolTarget` 对视口外 `elementFromPoint` 返回 null，故正确地没有发送操作。
2-7 的战利品区把装备行推到视口外；旧截图等到 3-1 才拍，战利品区消失，目标又回到视口内，不能用该截图否定这一原因。

修复仅在测试驱动：新增 `c19-drag-geometry.mjs`，开始手势前把源、目标共同滚进视口，确认两点可以命中，滚动完成后重读坐标；原目标、全部命令/收据/物品消失校验和时限不变。无法同时容纳或被遮挡会明确失败，没有跳过检查。
新增 `node tests/server/e2e/c19-tool-viewport.mjs` 使用真实 StrategyPanel 和固定合法投影：先复现原拖拽零命令，再验证滚动后同一工具/同一物品恰好一次回调；4 项检查通过。未修改界面或服务器源码。
完整 seed 1 诊断对局按原 75 分钟上限，在 6-2 正常结束并给出八席排名：退出码 1，耗时 1,842,118 ms。共 4 条 FAIL，三条为上述已取证的重铸器问题，另一条为未遇到供给选择机会。原文在 `c19-seed1-traced.log`，报告在 `c19-seed1-traced/report.json`。

## 验证

根目录最终以 `--no-file-parallelism` 串行跑同一批 8 个相关文件，174 项全部通过（58.57 秒），未修改任何测试时限。
首次合跑时为 173 项通过、1 项原 20 秒时限超时，失败用例是 `g2-3-netcode-hooks.test.ts` 的真实军械库恢复路径；完整原文保留在 `artifacts/mp-overtime-receipt/related-tests.log`。同一用例在候选副本与根目录串行重跑均通过，单列为并发资源竞争下的时限失败，不当作收据或重铸器规则失败。
浏览器几何回归 4 项通过。根目录 `npm run typecheck`、`npm run build:game` 均退出 0（`typecheck.log`、`build-game.log`）。
指定指纹顺序在隔离副本完整执行并通过：

```sh
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node tests/fixtures/record-g2-3-herald.cjs
node scripts/record-g2-3-inputs.cjs --check
```

Herald 脚本默认即校验模式，不接受 `--check` 参数。未使用 `verify-m8-herald-fixtures.cjs --write`。
原始 Herald 输入字节及战斗指纹未变化；预期变化只有源码指纹清单及其审计摘要。
根目录同样完成了上述重录与两项校验，均退出 0。最终分支测试及后续现场结论以保存的日志和权威输入为准。

## 分支交付

已提交修复 `1276fac7f2f5c9d505887de4991f05c0f81ac748` 并推送 `origin/codex/mp-overtime-receipt`，已用 `git ls-remote` 核实。后续证据更新不改变该修复提交的代码。

## 自行决定与交付限制

- 把重铸器问题修在测试驱动：真实目标超出视口，不是产品拒绝，也不是没有获得工具。所有原有校验、目标、视口大小和时限保留。
- 相关测试按原时限串行复跑，保留首次并发超时原文；没有以加时或跳过用例解决资源竞争。
- 两次 seed 2 均未自然到加时；不改血量、轮次或计时来强造相同结局，明确保留历史收据未确认的限制。
- 使用仓库现有 Codex 作者身份，仅对本次提交传入，不修改全局 Git 身份。
