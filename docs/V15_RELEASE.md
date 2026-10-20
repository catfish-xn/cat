# v15 统一发布收口

工作区基线：`codex/loot-orb-claim` / `915439176f9990fe1846a506d6477cfe81640a7a`，LF clone，2026-10-20。仅工作区交付，不联网、不安装依赖、不写 `.git`。本文件记录领域与证据收口，不代表服务器和界面已完成上线。

## 版本与摘要

“历史 v14”取自保留的 G2-4b epoch；“开始时 HEAD”区分此前法球分支已完成的升版与本轮实际变更。

| 项目 / 权威入口 | 历史 v14 | 开始时 HEAD | 本轮最终值 |
| --- | --- | --- | --- |
| M8_VERSION.rulesVersion / M8Version | s13-g2-3-v14 | s13-g2-3-v15 | s13-g2-3-v15 |
| M8_VERSION.contentVersion / M8Version | s13-14.24b-g2-3-v14 | s13-14.24b-g2-3-v15 | s13-14.24b-g2-3-v15 |
| schema / save / replay | 7 / 3 / 3 | 7 / 3 / 3 | 7 / 3 / 3 |
| commandProtocolVersion / M8Version | 3 | 3 | 4 |
| MULTIPLAYER_NET_PROTOCOL_VERSION（领域） | 3 | 4 | 4 |
| MULTIPLAYER_LOOT_CONTRACT_VERSION | 无显式领取合同 | multiplayer-orb-claim-v2 | multiplayer-orb-claim-v2 |
| LOOT_RUNTIME_REVISION | m8-b8-live-loot-basis-provenance-v1 | multiplayer-orb-claim-v3 | multiplayer-orb-claim-v3 |
| G23_POLICY.revision | g2-4b-s13-augments-anomalies-v14 | g2-4b-multiplayer-orb-claim-v15 | g2-4b-multiplayer-orb-claim-v15 |
| AUGMENT_OFFER_POLICY.version | augment-shared-tier-v14 | augment-shared-tier-v14 | augment-card-reroll-v15 |
| D11_FILL_ACTIVATION | 未注册 | wired-pending-v15-epoch | wired-v15 |
| D11 执行 manifest | 无 | preD11 排除目录、无执行 manifest | d11-wired-v15，完整 60/54 目录与等级表、来源系数和执行约定参与 digest |
| CONTENT_DIGEST | fnv1a32-utf16:ea6b11b6 | fnv1a32-utf16:99b62a66 | fnv1a32-utf16:2d6c67f0 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:9895bc42 | fnv1a32-utf16:61568ec0 | fnv1a32-utf16:61568ec0 |
| RNG / tick | lcg32-v1 / 50ms | 同左 | 同左 |

摘要由 canonical 内容自然计算，未手填生产哈希。CONTENT_DIGEST 新纳入 D11 原始来源和执行约定、全目录、按卡策略；未缩小 LOOT_REPLAY_DIGEST 的 manifest 覆盖范围。其相对历史 v14 的变化来自此前 G23 策略修订；本轮不改冻结算法、权重、ORB_RULES 或售价公式。

旧 rules/content、旧 contentDigest 和 command3 继续经 `restoreMatch` / 双边快照恢复的原严格边界拒绝，没有版本字符串归一化、补字段或静默迁移。服务器常量仍为 3，必须由 Claude 对齐到 4 并显式拒绝旧线协议。

## Epoch 与生成方式

新目录：`docs/evidence/v15/`，`tests/v15-content-baseline.json`，`tests/fixtures/v15-recorded-states/`、`v15-herald-raw/`、`v15-b8-fingerprints.json`、`v15-c19-seed-9-minimal.json`，以及 `tests/fixtures/m5/full-match-golden.v15.json`。`scripts/verify-m8-herald-fixtures.cjs` 的 CURRENT 指向 `tests/fixtures/record-v15-herald.cjs`。

v15 的 `--baseline-commit` 固定为本轮集成基线 `915439176f9990fe1846a506d6477cfe81640a7a`；比较对象为其保留的 G2-4b 文件。历史 G2-4b 的 G2-3 比较基线仍为 `430017516a18fb38ee028cec000a44fb94bb638f`，不更改历史生成器、目录或哈希断言。新 `v15-fixture-audit.cjs` 复用原 `g2-4b-fixture-audit.cjs` 的 git 只读字节检查及 source verification。

独立 `tests/fixtures/m5/oracle.g2.cjs` 仅 require Node assert；英雄、等级、费用、来源计划、BigInt RNG、单卡抽取与永久移出均为手写实现，没有 import 被测实现。release 四条真实路线（cannon/sniper/mage/sniper-caitlyn）各 33 战；cannon/sniper 各 67 检查点逐个严格文本/对象恢复。Herald 所有 raw 字节先生成，才导入 production serialization；逐分支核对完整独立经济账本、14 场过渡战斗、开战及十五个后继 tick 的存取一致性。

新 `v15-herald-support/generate.ts` 保留目标原始 Irelia、五种装备、Hypervelocity 与全部过渡战斗。旧默认分支在新目录池下于 6-5 淘汰；v15 配方用真实留金、商店采购、输出装备优先 Kog'Maw、实际取得的光明装备支持生存。未注入 HP/金币/英雄/装备，未修改生产数值或缩短断言。

live-reveal 的旧种子因目录扩充抽不到原 Pumping Up II，裸 Loris / Zyra 击杀分别漂移到 437 / 176 tick。独立 oracle 筛选原三强化组合与掉落类型，再实跑验证得到 v15 种子 139464 / 3464，精确保持原 381 / 152 tick、r00 / r01、败北、结算、4 / 0 收据、单位序号零增加及物品序号 +2 / +0 断言。首个 Loris 候选 60072 虽满足死亡 tick，却会额外发一张英雄卡，已被完整用例拒绝；最终录制器也明确核对单位/物品序号增量。双源同时死亡仍保持 tick44 / eventSeq382、383。当前 Rumble 付费军械库恢复用例改用公开种子 5，仍精确断言 5-5、一次 5 金购买、存取及篡改拒绝；旧种子 4 在新目录下会延后到 5-6，未改期望轮次。

PowerShell 重录顺序（Node 22，已有共用依赖，不执行 npm ci）：

```powershell
Set-Location 'C:\Users\Administrator\Desktop\set13-worktrees\loot-orb'
$env:V15_CACHE_DIR = Join-Path (Get-Location) 'artifacts/v15-recording/vite-cache'
$v15Base = '915439176f9990fe1846a506d6477cfe81640a7a'
node scripts/record-v15-release.cjs --baseline-commit=$v15Base
node tests/fixtures/record-v15-herald.cjs --write
node scripts/record-v15-inputs.cjs --baseline-commit=$v15Base
node scripts/record-v15-live-reveal.cjs --baseline-commit=$v15Base
node scripts/record-v15-inputs.cjs --baseline-commit=$v15Base --check
node scripts/verify-m8-herald-fixtures.cjs
node scripts/v15-fixture-audit.cjs --baseline-commit=$v15Base --check
node -e "require('./scripts/g2-4b-fixture-audit.cjs').archivedBytes(require('./docs/evidence/g2-4b/release-audit.json').baseCommit,'tests/g2-3-content-baseline.json')"
node node_modules/typescript/bin/tsc --noEmit
```

cacheDir 仅通过环境变量注入，机器路径不进入录制元数据。机器日志、逐文件 JSON 与重试诊断放在未提交的 `artifacts/v15-recording/`；录制受环境阻止时，外部运行清单写入该目录的 `RUN_OUTSIDE.md`，不得手写指纹。

## 实际结果与未满足条件

release 完成四条完整路线，首战 164 tick、106 个战斗事件，playerWin；战斗 state/event 数值摘要为 `1db5b9e9` / `cf452d32`，与旧基线相同。首战 events / RNG trace SHA 与 v14 相同，完整 Match state trace SHA 由 `218616cf572d32cf069e035f877321405103d3cc7b6f09f6e9ce98303721616b` 变为 `bbfca39f17b86fceb2936a7801823e2ef2a585098a6338e81c2d5da5d874bf11`。

| 录制 / 校验 | 实测结果 |
| --- | --- |
| record-v15-release | 4 路线各 33 战，均 victory；cannon/sniper 各 67 检查点严格 text/object restore，完整 m5 golden 已生成 |
| record-v15-herald --write | 5 组 / 7 文件，raw 在导入 serialization 前生成；每组 14 场过渡战斗，完整账本及开战后十五 tick 存取验证通过 |
| verify-m8-herald-fixtures | CURRENT=v15；全部 raw/trajectory/manifest 重生成字节比较通过 |
| record-v15-inputs / --check | 9 个字节证据条目通过；B8 0/1/9 单位 battle/replay SHA 重录；C19 原 273 tick、148/273 death tick 与真伤脉冲完整断言通过 |
| record-v15-live-reveal / --check | full/simultaneous/loris/zyra 四分支通过；tick44 双源、381/152 部分死亡及 4/0 收据保持 |
| 三份 v15 audit 的 sourceDigests | 与最终源文件逐项相等 |
| tsc --noEmit / git diff --check | 通过 |
| G2-3/G2-4b 历史字节 | 86 文件与起点 HEAD 完全相等；无历史生成器或数据文件改动 |
| 原 g2-4b audit（base=430017…）及 v15 历史 audit | 均失败于下述同一处既有 manifest SHA 冲突，原断言保留 |
| 逐文件 Vitest | 74 文件，1313 通过 / 1 失败 / 0 跳过；唯一失败为既有历史 manifest SHA 冲突，详见逐文件表 |

所有录制与复验已在当前沙箱内完成，cacheDir 通过环境变量成功注入；**无仍需沙箱外执行的命令**，不需要 RUN_OUTSIDE.md。机器证据位于 `artifacts/v15-recording/`，不提交生成物日志。

历史存在独立阻塞：HEAD 中 `tests/fixtures/g2-4b-herald-raw/manifest.json` 的 SHA256 为 `0be74393894bd03d2f6fda1e4591abe0d787f3d0b5bdd414dd4098f740022446`，而 `docs/evidence/g2-4b/input-fixture-audit.json` 仍断言 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。两文件均与 HEAD 原字节一致。按方案 A 不改历史文件、不放宽断言，因此此历史验收不能声称通过；不把它当成沙箱限制，也不靠重录 v15 掩盖。

只读 Git 追溯确认：`6392f319`（`chore(fixtures): refresh Herald source hashes for D11`）把该 manifest 从 35462 字节改为 35773 字节；`6392f319^` 与 `81d39952` 的原文件 SHA 均为历史 audit 要求的 `b39c44…6a22`。当前 86 个受保护历史文件已逐个与任务起点 HEAD 用原 `archivedBytes` 比较相等。若另获授权修复，应恢复有来源的历史字节并单独记录例外，不能凭空改写哈希；本轮未执行该修复。

## 逐文件测试结果

每份文件分别执行 `node node_modules/vitest/vitest.mjs run <file> --configLoader runner --reporter=json --outputFile=<artifact.json>`，未改超时、未删除用例。共 74 文件 / 1314 项，最终 **1313 通过 / 1 失败 / 0 跳过**。四条 M5 每命令/每 tick 恢复长回放、四条 M6 历史/回放/存档/Session 集成均通过。

表中为最终单文件结果。`g2-3-identity` 初次 13/1，调整真实公开种子后复跑 14/0；`m8-b8-live-reveal` 初次 2/1，按原完整资源断言筛选新种子后复跑 3/0；`ur-i3-combat-statuses` 初次 5/1，将收口前固定 content digest 改为当前 v15 基线后复跑 6/0，其原战斗/账本 SHA、状态效果断言全部保留。首次输出与复跑 JSON 均保存在 artifacts，最终聚合在 `artifacts/v15-recording/final-test-results.json`。

`opening-random-identity.test.ts` 的 140/1 中，当前 v15 身份链、134 个检查点、拒绝旧档及首战完整摘要检查均通过；失败项是保留下来的 G2-4b 历史 input audit 对 manifest SHA 的精确断言。**未达到用户要求的 0 失败，不应按全部验收完成交付或发布。**

<!-- V15_TEST_RESULTS -->
| File | Passed | Failed |
| --- | ---: | ---: |
| `tests/augment-card-reroll.test.ts` | 12 | 0 |
| `tests/augment-tier-consistency.test.ts` | 7 | 0 |
| `tests/b8-resumable-battle-timing.test.ts` | 12 | 0 |
| `tests/b8-resumable-battle.test.ts` | 15 | 0 |
| `tests/c19-missed-pulse.test.ts` | 10 | 0 |
| `tests/d11-fill-mechanics.test.ts` | 20 | 0 |
| `tests/d11-fill-source.test.ts` | 7 | 0 |
| `tests/d11-wiring-bank.test.ts` | 2 | 0 |
| `tests/d11-wiring-match.test.ts` | 5 | 0 |
| `tests/d11-wiring-online.test.ts` | 10 | 0 |
| `tests/g2-1-content.test.ts` | 33 | 0 |
| `tests/g2-2-identity.test.ts` | 1 | 0 |
| `tests/g2-3-content.test.ts` | 10 | 0 |
| `tests/g2-3-identity.test.ts` | 14 | 0 |
| `tests/g2-3-integration.test.ts` | 18 | 0 |
| `tests/g2-3-netcode-hooks.test.ts` | 14 | 0 |
| `tests/g2-4b-gambler.test.ts` | 2 | 0 |
| `tests/g2-4b-gold-settlement.test.ts` | 2 | 0 |
| `tests/g2-4b-restore-authority.test.ts` | 8 | 0 |
| `tests/g2-augments-choice.test.ts` | 72 | 0 |
| `tests/g2-augments-identity.test.ts` | 1 | 0 |
| `tests/loot-orb-claim.test.ts` | 20 | 0 |
| `tests/m5-acceptance.test.ts` | 7 | 0 |
| `tests/m5-audit-boundaries.test.ts` | 20 | 0 |
| `tests/m5-content.test.ts` | 9 | 0 |
| `tests/m5-replay-cannon.test.ts` | 1 | 0 |
| `tests/m5-replay-mage.test.ts` | 1 | 0 |
| `tests/m5-replay-sniper-caitlyn.test.ts` | 1 | 0 |
| `tests/m5-replay.test.ts` | 1 | 0 |
| `tests/m5-route.test.ts` | 8 | 0 |
| `tests/m5-serialization.test.ts` | 33 | 0 |
| `tests/m6-integration-mage.test.ts` | 2 | 0 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | 2 | 0 |
| `tests/m6-integration-sniper.test.ts` | 2 | 0 |
| `tests/m6-integration.test.ts` | 3 | 0 |
| `tests/m8-b5-grant-upgrade.test.ts` | 14 | 0 |
| `tests/m8-b5-instances.test.ts` | 18 | 0 |
| `tests/m8-b5-queries.test.ts` | 5 | 0 |
| `tests/m8-b5-temporary.test.ts` | 30 | 0 |
| `tests/m8-b7-match-wiring.test.ts` | 30 | 0 |
| `tests/m8-b8-command-oracle.test.ts` | 6 | 0 |
| `tests/m8-b8-golden-guard.test.mjs` | 24 | 0 |
| `tests/m8-b8-live-reveal.test.ts` | 3 | 0 |
| `tests/m8-b8-loot-freeze.test.ts` | 67 | 0 |
| `tests/m8-b8-loot-runtime.test.ts` | 16 | 0 |
| `tests/m8-b8-oracle.test.ts` | 24 | 0 |
| `tests/m8-b9-golden-guard.test.mjs` | 3 | 0 |
| `tests/m8-b9-golden-tamper.test.mjs` | 8 | 0 |
| `tests/m8-content-equivalence.test.ts` | 138 | 0 |
| `tests/m8-contracts.test.ts` | 6 | 0 |
| `tests/match-contract.test.ts` | 12 | 0 |
| `tests/match-economy.test.ts` | 83 | 0 |
| `tests/match-lifecycle.test.ts` | 12 | 0 |
| `tests/match-session.test.ts` | 16 | 0 |
| `tests/opening-random-identity.test.ts` | 140 | 1 |
| `tests/r3r4-consumable-targets.test.ts` | 5 | 0 |
| `tests/r3r4-shared.test.ts` | 8 | 0 |
| `tests/s13-anomalies-replay.test.ts` | 7 | 0 |
| `tests/s13-anomalies-source.test.ts` | 12 | 0 |
| `tests/s13-augments-p2-choice.test.ts` | 23 | 0 |
| `tests/s13-augments-p2-combat.test.ts` | 34 | 0 |
| `tests/s13-augments-p2-multiplayer.test.ts` | 18 | 0 |
| `tests/s13-p1-bound-identity.test.ts` | 2 | 0 |
| `tests/shared-pool-cache.test.ts` | 4 | 0 |
| `tests/t12-combat-equip.test.ts` | 48 | 0 |
| `tests/t13-identity.test.ts` | 3 | 0 |
| `tests/t2-two-sided-battle.test.ts` | 21 | 0 |
| `tests/t3-timeout-loot.test.ts` | 6 | 0 |
| `tests/t5r-loot-view.test.ts` | 24 | 0 |
| `tests/t5r-private-seat-view.test.ts` | 15 | 0 |
| `tests/t7-bot-policy.test.ts` | 24 | 0 |
| `tests/t7-integration.test.ts` | 4 | 0 |
| `tests/tp-rewards-and-rounds.test.ts` | 9 | 0 |
| `tests/ur-i3-combat-statuses.test.ts` | 6 | 0 |
<!-- END_V15_TEST_RESULTS -->

## 约定值清单

- 完整星级需共享库存 1/3/9 份；不足时整条奖励只按英雄费用补一次金币，不部分取卡、不按份数倍增、不叠加满席出售金币。
- 有货且实际入库才扣池；满席按原 getUnitSellPrice 出售，份额视为未取出。2 费 1/2/3 星分别 +2/+5/+17，1 费 2 星 +3。
- 机制奖励法球档位暂用 gray，是项目分类默认；只对联机要求显式领取，单机沿原发奖/满席托管规则。
- combat / 冻结 PvP 阵容可接受点击并进入席位私有 FIFO；本轮经济、HP、成长、G23、延迟升星之后、战后选择之前结算。先判淘汰再分配；不回算本轮利息，不自动领取新解锁法球。
- 排队、领取、缺货、折金、扣池本身零 RNG；原临时装备钩子仍依原 equipment 流规则。跨席竞争按权威结算提交顺序。
- 强化每选择每张卡各免费刷新一次；新卡不能再刷，移出 ID 本局本席永久排除；其他席及新局不受影响。实际日程仍 2-1/3-2/4-2；每节点同级，等级等权为既有项目约定，未核实为原版概率。
- 初次发三张消费 choice 流三字，成功单卡刷新消费一字；候选仅一项可成功，零项原子拒绝。generation 与有序 rerolledIndices 按实际提交顺序重演。
- D11 灵魂连接取开战 HP 的完整十点缺失组；三项赛使用独立派生开战流。贪财化身按实时权威银行与待结算战斗收益取样，增伤最高 40%，银行不截 50；猎头者按不同 kill eventSeq 结算，排除助攻、野怪、召唤物与镜像。

## Claude 服务器与表现层配套

| 必须配套项 | 合同 / 验收边界 |
| --- | --- |
| claimOrb 白名单 | `{type:'claimOrb',round,orbId}`；凭证决定真实席位，battle/awaiting-settlement 仍允许排队；ACK 不代表已经发奖 |
| rerollAugment 白名单 | 必填 choiceId / generation / optionIndex=0..2；共享事务原子提交 state+pool，失败保持原引用且无资源/RNG变化 |
| NET_PROTOCOL_VERSION | `src/server/net/messages.ts` 3→4，客户端同批升级并拒绝旧协议；领域已为 4，未修改服务器目录 |
| bot 准备入口 | 普通操作预算前调用并原子提交 `claimBotPreparationOrbs(pool,state)`，包括新解锁法球，零 bot RNG |
| 私有 / 公共投影 | 私有转发 unclaimedOrbs（含 queued）、orbClaimReceipts、每卡 rerollAvailable / rerolledSlots、d11Display；公共法球仅 count/tiers，不能泄露 orbId、队列、载荷或金币样本 |
| D11-SERVER-LIVE-BANK | 实际规则 tick 与命令排序一致，在下一 tick 前调用 `BattleTask.sampleBankGold(seatId,seat.match.gold)`；保留私有 bankSamples 给结果校验/重放。先算完整战斗再播放的旧流程不满足合同，是端到端发布阻塞 |
| statuses / choiceEffects | 公开 combat replay 单位原样转发 statuses 和可选 choiceEffects，包含状态清空与增量更新；不重算规则 |
| 重连与终局 | 保留 latest seat FIFO、新强化权威字段与收据，不从投影重建；淘汰/终局按领域入口作废一次，断线不作废 |

## PR description draft

**Title:** `chore(simulation): finalize v15 identities and record an isolated fixture epoch`

**Before:** The integration branch combined explicit queued orb claims, per-card augment rerolls, statuses and D11 content while current fixture consumers still used v14 recordings. The offer manifest described whole-offer rerolls, and the transitional digest omitted D11.

**After:** Freeze command protocol 4 and the v15 offer/D11 manifests, naturally compute the full content digest, and record fresh public-command release, Herald, input and live-reveal evidence under a separate v15 epoch. CURRENT consumers use that epoch; G2-3 and G2-4b bytes and their historical checks remain retained. Old save identities and command protocol 3 are rejected without migration.

**How:** Run the command-only routes against a hand-written independent economy/choice oracle, restore every recorded checkpoint strictly, regenerate Herald raw inputs before importing serialization, recompile B8/C19 inputs, and run each related test file individually. Final measured results and any remaining historical evidence conflict are reported above. Server protocol/message, bot, projection and live-bank integration remain a separate Claude-owned prerequisite for online release.

中文对账：完整星级缺货整条只补一次费用；满席不取池；gray 为约定档位；战斗仅排队、战后按当时库存结算；每卡每选择一次且本局本席永久移出；60/54 完整内容参与 digest；不改历史字节、不手写指纹、不放宽用例/时限；服务器 NET3→4 与实时银行尚待配套。

建议提交信息：`chore(simulation): finalize v15 identities and record an isolated fixture epoch`。历史审计冲突解除且最终校验通过前，不建议提交为“验收全部通过”或发布。
