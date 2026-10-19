# PR #150：同步 multiplayer v10 的验证交接

## 固定版本与范围

- PR： https://github.com/catfish-xn/cat/pull/150 （保持草稿、未合并）
- 分支：`codex/g2-4b-new-mechanism-items`
- 远端原 HEAD：`7d9064007cc763cc3a405b65072becea233d503a`
- 合入 multiplayer：`1fb55af1a89f8fc7f5e7a68b44480e84da9b8ddd`
- merge commit：`81e6b4622b7cd830ea39ae14de3aec6e8d16966e`，保留两个父提交，无 rebase。
- 最终受测代码提交：`1897144c456b51163a1ad64ea8d00cbf99500e11`。后续提交仅收录本报告和结果，不混作新代码验证。
- 规则 `s13-g2-3-v10`、内容 `s13-14.24b-g2-3-v10`、policy `g2-4b-bracer-multikill-v10`，不提前升 v11。
- 合并后的内容计算摘要 `fnv1a32-utf16:67cd0953`；没有篡改摘要算法或硬填旧摘要。
- 本次只做同步兼容，没有修改已批准物品规则、数值、测试时限或必过条件。
- dot 云环境恢复成旧快照后，独立建立工作树重取远端；原有其他工作树的改动没有丢弃。
- Node 24.19.0 / npm 11.9.0；`core.autocrlf` 未设置，工作树 LF。`npm ci --cache /tmp/pr150-npm-cache` 成功。

## 冲突处理

1. `docs/MATCH_CONTRACT.md`、`docs/UI_REQUESTS.md`、`docs/evidence/g2-3/RECONCILIATION.md`：保留双方章节，锻造器/复制器/宝箱以及11件机制物品的批准条目均保留。
2. `src/simulation/content/g2-3-item-registry.ts:41`：原普通/特殊/神器/辅助装顺序保留，最后追加 G24_MECHANISM_ITEMS；不重排旧条目。
3. `src/simulation/content/g2-3-policy.ts:38`：采用 multiplayer v10 revision；保留双方政策对象，未改具体值。
4. `src/simulation/g2-3-economy.ts`、`g2-3-settlement.ts`、`g2-3-state.ts`：冠冕开战持有者事实、冠冕收据与新物品金币收据并存；保留原持有者死亡/风衣分裂后的计账和唯一链接。
5. `src/simulation/b8-restore.ts`：保留上游 G23/奖励来源校验，加入 PR150 的召唤位置和开战存款输入；复制体不重复消费成长来源，风衣原持有者已赚成长仍保留一次。
6. `src/simulation/strategy-snapshot.ts`：保留 supportGrants 与 shrouds，虚空生物投影→羁绊→镜像的顺序，以及可信开战存款。
7. `src/simulation/m8/item-restore.ts:120`：最大生命历史候选同时组合赠装 flat/bps、大亨逐伤害包历史和复制体缩放，整数取整顺序保留；其他属性候选保留逐轮去重、上界及已结算目标事实。修正了冲突合并意外留在 return 后的不可达旧代码，未改变运行分支。
8. `src/simulation/m8/restore.ts`：期望最大生命基准同时包含赠装、大亨、镜像开战生命及形态位置。
9. `src/simulation/serialization.ts`：保留上游拆分后的轻包装，PR150 恢复增量移到 `serialization-structure.ts`，未覆盖上游包装。
10. `src/simulation/serialization-structure.ts:285-370`：普通战斗保留 preflight、sampled-stat、resists、完整 runtime/task/triggerLedger 重演；风衣/灵风/杰斯镜像走由可信开战策略选择的既有全战斗规范化等值验证，再避开不适用的静态 roster/时钟检查。不能由存档自报字段绕过。独立物品 RNG、金币、召唤来源、成长、法衣及伤害延期均保留。

## 测试兼容适配（断言未削弱）

- `tests/g2-4b-support-items.test.ts:44-45`：三件“之前未入库”机制辅助装现在由 PR150 注册；改为确认它们不在普通辅助装表、精确在机制表、最终注册表身份相等且两表无重叠。
- `tests/g2-4b-trench-restore.test.ts:78`：结算适配器的小型单元输入补上上游新接口要求的空 strategy 与开战持有者列表；原金币与重复结算期望不变。
- `tests/m8-ability-contracts.test.ts:11-14`：名单精确只加入 `g24-voidspawn`（66→67），确认该新表恰有一个能力且最终注册定义全等；19个历史机制契约全保留。
- `tests/c19-missed-pulse.test.ts:17`：未来 `g2-4b-c19-seed-9-minimal.json` 改为本次指定脚本真正产出的 `g2-3-c19-seed-9-minimal.json`，原脉冲/恢复断言不动。
- `tests/fixtures/m8-neutral-public-route.ts`：恢复到本次指定脚本产出的当前 `g2-3-herald-raw` 路径，合法公开轨迹恢复和续战断言不变。
- `tests/b8-resumable-battle-helper.ts:1`、`tests/m8-content-equivalence.test.ts:3`：不存在的未来 `g2-4b` JSON 导入改回 multiplayer 当前 v10 的 `g2-3` 文件；精确 hash/digest/恢复断言保留。尚未完成未来版本重录，不将旧摘要当成新内容通过证据。

## 指纹与保护目录

在最终源码上严格执行：

1. `node tests/fixtures/record-g2-3-herald.cjs --write`：exit 0，39.833 秒，5份公开命令原始输入全部经过生产恢复及15 tick续战验证。
2. `node scripts/record-g2-3-inputs.cjs`：exit 0，9 cases。
3. `node scripts/record-g2-3-inputs.cjs --check`：exit 0，9 cases，摘要 67cd0953。

最终 sourceSha256：`351a820c79d7d7cdbbf1044837a58cd13d00e4fdb7dafbf343f6399a2a2625f4`。
未使用 verify-m8-herald-fixtures 的 --write。
`git diff origin/multiplayer -- tests/fixtures/g2-augments-herald-raw/` 为空。保护历史目录逐字节相同。

## 尚未完成与风险

- 不提前做 v11 release、recorded-states、m5/browser golden 全量迁移。`tests/m8-content-equivalence.test.ts` 仍引用未来 `g2-4b-recorded-states`，当前缺失，无法收集其录制态恢复用例。未删断言、未 skip，也未把此项标绿。
- 未来版本的 opening-random-identity、m5 等相关录制内容仍需统一版本迁移；不在本次指定指纹命令里伪造。
- 未运行全套，未改变任何时限；最终代码尚未推到 GitHub，没有新 CI 结果可报告。
- 已知平台 GitHub 写入限制尚未解除，本轮不绕过/不重复试推，提供 git bundle。最终 ls-remote 仍是原 PR150 HEAD，不能声称远端已更新。
- 本报告是同步验证记录，不是独立签收或合并批准。

## 自行决定

- 使用隔离工作树和临时 npm cache，保护其他任务改动。
- 相关测试逐文件单 worker，避免小内存机器并发峰值；未改测试自身超时。
- 将测试对“尚未注册的新机制条目”的旧断言改成精确注册归属检查。
- 缺失的未来录制内容明确保留为未完成；没有为了绿灯提前升版本或改校验。

## 测试结果与版本映射

- `npm run typecheck`：exit 0（最终代码树）。
- 首轮：122 次逐文件调用（包含 1 次误选不存在的文件），1456 通过 / 4 失败，耗时合计 457.959s；4 个实际用例失败均保留原文，修正后补验。
- 最终固定代码 SHA 补验：40 个文件调用，415 通过 / 0 用例失败，1 文件退出非零；耗时合计 175.402s。
- 去重后的最新有效结果：126 个真实文件，125 文件通过，1 文件未通过；已收集用例 1533 条，其中 1533 通过、0 失败、0 跳过。未能收集的录制态文件不虚报条数。
- 首轮证据来自 81e6b462 合并树及随后删除不可达代码的等价树；1897144 的唯一生产源码差异是 `return r.triggerCount` 后不可达的旧合并残片删除。独立只读复核确认无运行分支改动，故未受影响文件保留首轮结果；修正测试与主要装备/恢复文件在1897144重新验证。
- 恢复 C/D 的三个核心模块与 multiplayer parent 逐字节一致，静态复核未发现校验丢失。静态复核不代替运行测试。
- 原误选 `tests/explorer-bracer-pressure.test.ts` 不存在（exit 1），已改跑真实 `tests/explorer-bracer-restore-pressure.test.ts`；不计为产品故障，也没有隐藏该次调用。

| 文件 | 最新证据轮次 | 通过 | 失败 | exit | 秒 |
|---|---|---:|---:|---:|---:|
| tests/bracer-multikill-stacks.test.ts | final | 25 | 0 | 0 | 10.907 |
| tests/c19-missed-pulse.test.ts | final | 10 | 0 | 0 | 1.841 |
| tests/explorer-bracer-restore-pressure.test.ts | final | 2 | 0 | 0 | 2.018 |
| tests/explorer-bracer-restore.test.ts | final | 24 | 0 | 0 | 3.608 |
| tests/g2-4b-artifact-forge.test.ts | final | 7 | 0 | 0 | 3.238 |
| tests/g2-4b-artifact-mechanism-integration.test.ts | final | 2 | 0 | 0 | 1.9 |
| tests/g2-4b-artifacts.test.ts | final | 48 | 0 | 0 | 3.064 |
| tests/g2-4b-clone-forges.test.ts | final | 4 | 0 | 0 | 1.013 |
| tests/g2-4b-collector.test.ts | final | 1 | 0 | 0 | 4.147 |
| tests/g2-4b-cutlass.test.ts | final | 4 | 0 | 0 | 1.988 |
| tests/g2-4b-defiance.test.ts | final | 3 | 0 | 0 | 2.014 |
| tests/g2-4b-fishbones.test.ts | final | 4 | 0 | 0 | 1.938 |
| tests/g2-4b-gambler.test.ts | final | 2 | 0 | 0 | 1.995 |
| tests/g2-4b-gold-settlement.test.ts | final | 2 | 0 | 0 | 1.638 |
| tests/g2-4b-item-gold.test.ts | final | 3 | 0 | 0 | 0.719 |
| tests/g2-4b-item-kernel.test.ts | final | 6 | 0 | 0 | 0.685 |
| tests/g2-4b-mirror-forge-restore.test.ts | final | 2 | 0 | 0 | 2.073 |
| tests/g2-4b-mirror.test.ts | final | 6 | 0 | 0 | 2.791 |
| tests/g2-4b-mogul.test.ts | final | 2 | 0 | 0 | 2.171 |
| tests/g2-4b-pr161-restore.test.ts | final | 11 | 0 | 0 | 11.385 |
| tests/g2-4b-replay.test.ts | final | 10 | 0 | 0 | 3.344 |
| tests/g2-4b-resists-restore.test.ts | final | 21 | 0 | 0 | 5.653 |
| tests/g2-4b-restore-authority.test.ts | final | 8 | 0 | 0 | 2.287 |
| tests/g2-4b-reward-order.test.ts | final | 1 | 0 | 0 | 1.117 |
| tests/g2-4b-shroud.test.ts | final | 3 | 0 | 0 | 1.945 |
| tests/g2-4b-source-pins.test.ts | final | 3 | 0 | 0 | 1.401 |
| tests/g2-4b-support-items.test.ts | final | 15 | 0 | 0 | 2.341 |
| tests/g2-4b-trench-gold.test.ts | final | 1 | 0 | 0 | 2.336 |
| tests/g2-4b-trench-restore.test.ts | final | 3 | 0 | 0 | 2.745 |
| tests/g2-4b-trench.test.ts | final | 7 | 0 | 0 | 2.488 |
| tests/g2-4b-unstable-chest.test.ts | final | 39 | 0 | 0 | 17.157 |
| tests/g2-4b-voidspawn.test.ts | final | 9 | 0 | 0 | 2.047 |
| tests/g2-4b-zephyr.test.ts | final | 5 | 0 | 0 | 2.233 |
| tests/m8-ability-contracts.test.ts | final | 21 | 0 | 0 | 0.737 |
| tests/m8-audit-contracts.test.ts | initial | 13 | 0 | 0 | 0.672 |
| tests/m8-b10-encounter-outcomes.test.ts | initial | 46 | 0 | 0 | 14.784 |
| tests/m8-b10-item-save-replay.test.ts | initial | 45 | 0 | 0 | 20.613 |
| tests/m8-b10-temporary-replay.test.ts | initial | 3 | 0 | 0 | 6.352 |
| tests/m8-b3-audit.test.ts | initial | 6 | 0 | 0 | 2.652 |
| tests/m8-b3-damage-control-order.test.ts | initial | 14 | 0 | 0 | 1.436 |
| tests/m8-b3-integration.test.ts | initial | 25 | 0 | 0 | 1.482 |
| tests/m8-b3-periodic-integration.test.ts | initial | 7 | 0 | 0 | 1.493 |
| tests/m8-b3-restore.test.ts | initial | 13 | 0 | 0 | 2.547 |
| tests/m8-b3-second-integration.test.ts | initial | 13 | 0 | 0 | 1.475 |
| tests/m8-b3-third-audit.test.ts | initial | 14 | 0 | 0 | 1.436 |
| tests/m8-b4-audit-regressions.test.ts | initial | 14 | 0 | 0 | 9.539 |
| tests/m8-b4-belt.test.ts | initial | 2 | 0 | 0 | 1.39 |
| tests/m8-b4-bow.test.ts | initial | 7 | 0 | 0 | 1.452 |
| tests/m8-b4-catalog.test.ts | initial | 84 | 0 | 0 | 13.608 |
| tests/m8-b4-cloak.test.ts | initial | 3 | 0 | 0 | 1.477 |
| tests/m8-b4-gloves.test.ts | initial | 1 | 0 | 0 | 1.422 |
| tests/m8-b4-integration.test.ts | initial | 16 | 0 | 0 | 5.18 |
| tests/m8-b4-r3b-lifecycle.test.ts | initial | 4 | 0 | 0 | 3.882 |
| tests/m8-b4-rod.test.ts | initial | 6 | 0 | 0 | 1.498 |
| tests/m8-b4-sword.test.ts | initial | 8 | 0 | 0 | 1.381 |
| tests/m8-b4-tear.test.ts | initial | 9 | 0 | 0 | 1.443 |
| tests/m8-b4-trigger-ledger.test.ts | initial | 2 | 0 | 0 | 0.682 |
| tests/m8-b4-vest.test.ts | initial | 4 | 0 | 0 | 1.391 |
| tests/m8-b5-equipment-history.test.ts | initial | 9 | 0 | 0 | 10.274 |
| tests/m8-b5-grant-upgrade.test.ts | initial | 14 | 0 | 0 | 10.451 |
| tests/m8-b5-instances.test.ts | initial | 18 | 0 | 0 | 11.164 |
| tests/m8-b5-queries.test.ts | initial | 5 | 0 | 0 | 3.888 |
| tests/m8-b5-temporary.test.ts | initial | 30 | 0 | 0 | 4.615 |
| tests/m8-b6-match-wiring.test.ts | initial | 18 | 0 | 0 | 15.066 |
| tests/m8-b6-opening-economy.test.ts | initial | 27 | 0 | 0 | 0.69 |
| tests/m8-b6-round-catalog.test.ts | initial | 30 | 0 | 0 | 0.626 |
| tests/m8-b7-audit-vectors.test.ts | initial | 14 | 0 | 0 | 23.865 |
| tests/m8-b7-catalog.test.ts | initial | 5 | 0 | 0 | 0.867 |
| tests/m8-b7-cleanup.test.ts | initial | 5 | 0 | 0 | 1.899 |
| tests/m8-b7-known-limitations.test.ts | initial | 2 | 0 | 0 | 1.517 |
| tests/m8-b7-match-wiring.test.ts | final | 30 | 0 | 0 | 19.709 |
| tests/m8-b7-mechanisms.test.ts | initial | 21 | 0 | 0 | 1.559 |
| tests/m8-b7-serialization-reuse.test.ts | initial | 6 | 0 | 0 | 2.347 |
| tests/m8-b8-acquisition.test.ts | initial | 12 | 0 | 0 | 1.74 |
| tests/m8-b8-combat-input.test.ts | initial | 38 | 0 | 0 | 1.989 |
| tests/m8-b8-command-oracle.test.ts | initial | 6 | 0 | 0 | 1.746 |
| tests/m8-b8-copy-semantics.test.ts | initial | 6 | 0 | 0 | 1.756 |
| tests/m8-b8-equipment-fixture.test.ts | initial | 4 | 0 | 0 | 3.544 |
| tests/m8-b8-live-capacity.test.ts | initial | 6 | 0 | 0 | 7.876 |
| tests/m8-b8-live-cross-round.test.ts | initial | 6 | 0 | 0 | 3.131 |
| tests/m8-b8-live-economy.test.ts | initial | 3 | 0 | 0 | 3.015 |
| tests/m8-b8-live-growth.test.ts | initial | 26 | 0 | 0 | 6.458 |
| tests/m8-b8-live-reveal.test.ts | initial | 3 | 0 | 0 | 7.907 |
| tests/m8-b8-live-transfer.test.ts | initial | 19 | 0 | 0 | 8.072 |
| tests/m8-b8-loot-freeze.test.ts | initial | 67 | 0 | 0 | 1.362 |
| tests/m8-b8-loot-runtime.test.ts | initial | 16 | 0 | 0 | 1.716 |
| tests/m8-b8-loot-view.test.ts | initial | 7 | 0 | 0 | 6.747 |
| tests/m8-b8-oracle.test.ts | initial | 24 | 0 | 0 | 21.446 |
| tests/m8-b8-resource-provenance.test.ts | initial | 64 | 0 | 0 | 1.226 |
| tests/m8-b8-restore-fold-reuse.test.ts | initial | 5 | 0 | 0 | 1.921 |
| tests/m8-b8-restore.test.ts | initial | 7 | 0 | 0 | 2.757 |
| tests/m8-b8-token-lifecycle.test.ts | initial | 3 | 0 | 0 | 2.738 |
| tests/m8-b9-activity-log.test.ts | initial | 1 | 0 | 0 | 15.235 |
| tests/m8-b9-compatibility.test.ts | initial | 11 | 0 | 0 | 3.05 |
| tests/m8-b9-status-events.test.ts | initial | 2 | 0 | 0 | 1.475 |
| tests/m8-content-equivalence.test.ts | final | 0 | 0 | 1 | 1.749 |
| tests/m8-contracts.test.ts | initial | 6 | 0 | 0 | 0.64 |
| tests/m8-effect-policy-contracts.test.ts | initial | 20 | 0 | 0 | 0.732 |
| tests/m8-g01.test.ts | initial | 7 | 0 | 0 | 0.67 |
| tests/m8-g02.test.ts | initial | 7 | 0 | 0 | 0.648 |
| tests/m8-g03.test.ts | initial | 4 | 0 | 0 | 0.669 |
| tests/m8-g04.test.ts | initial | 5 | 0 | 0 | 0.71 |
| tests/m8-g05.test.ts | initial | 4 | 0 | 0 | 0.686 |
| tests/m8-g06.test.ts | initial | 6 | 0 | 0 | 0.672 |
| tests/m8-g07.test.ts | initial | 6 | 0 | 0 | 0.688 |
| tests/m8-g08.test.ts | initial | 5 | 0 | 0 | 1.391 |
| tests/m8-g09-integration.test.ts | initial | 4 | 0 | 0 | 1.446 |
| tests/m8-g09.test.ts | initial | 4 | 0 | 0 | 0.65 |
| tests/m8-g10-integration.test.ts | initial | 3 | 0 | 0 | 1.437 |
| tests/m8-g10.test.ts | initial | 6 | 0 | 0 | 0.647 |
| tests/m8-g11.test.ts | initial | 6 | 0 | 0 | 1.406 |
| tests/m8-g12-integration.test.ts | initial | 3 | 0 | 0 | 1.413 |
| tests/m8-g12.test.ts | initial | 8 | 0 | 0 | 0.693 |
| tests/m8-if-death.test.ts | initial | 3 | 0 | 0 | 0.675 |
| tests/m8-if-inputs.test.ts | initial | 3 | 0 | 0 | 1.469 |
| tests/m8-if-open.test.ts | initial | 2 | 0 | 0 | 0.692 |
| tests/m8-node3-copy-boundary.test.ts | initial | 3 | 0 | 0 | 1.664 |
| tests/m8-planning.test.ts | initial | 1 | 0 | 0 | 0.69 |
| tests/m8-rereview-contracts.test.ts | initial | 7 | 0 | 0 | 0.663 |
| tests/m8-target-order-contracts.test.ts | initial | 28 | 0 | 0 | 1.322 |
| tests/m8-u5-preview-mocked-snapshot.test.ts | initial | 8 | 0 | 0 | 1.856 |
| tests/m8-u5-preview.test.ts | initial | 60 | 0 | 0 | 14.698 |
| tests/restore-audit/bounds-preflight.test.ts | final | 16 | 0 | 0 | 14.657 |
| tests/restore-audit/cd-replay-facts.test.ts | final | 34 | 0 | 0 | 16.69 |
| tests/restore-audit/combat-accumulators.test.ts | final | 1 | 0 | 0 | 1.804 |
| tests/task-mechanism-restore.test.ts | final | 20 | 0 | 0 | 11.829 |

所有用例命令：`npm test -- <文件> --maxWorkers=1 --reporter=json --outputFile=<证据JSON>`。本次没有全套命令。逐次原始日志和 JSON 在交接 ZIP 的 logs/。
