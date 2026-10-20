# v15 统一发布收口

本次工作区基线：`codex/loot-orb-claim` / `2aaa537c02f6675a952ea26894c79996067543b3`，LF clone，2026-10-20。离线、不安装依赖、不写 .git，改动全部留工作区；未修改服务器和界面禁改目录。前轮集成基线仍为 `915439176f9990fe1846a506d6477cfe81640a7a`。

## 最后三项

1. **历史 manifest**：读取 `git show 6392f319^:tests/fixtures/g2-4b-herald-raw/manifest.json` 的原始字节写回。35462 字节，SHA256 为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。这是用户授权的唯一历史修复。G2-3/G2-4b 历史审计断言和其余文件字节不变；v15 audit 对该文件核对精确 SHA 和 6392f319^，其余仍使用原集成基线。新增 simulation 源码指纹只记录于 v15 epoch。
2. **贪财化身联机暂缓**：按用户 10-20 04:22 决定，从联机首抽与付费刷新候选池移出 avarice-incarnate，联机异常 54→53，强化仍 60。模块、来源系数、双边战斗独立能力和单机 54 异常保留。单机每 tick 已使用权威金币及待结算战斗收入，有公共获取、+5 金唯一收据、战斗及严格恢复测试支持。服务器按命令提交顺序接通每个规则 tick 前 sampleBankGold 后再加回；详见 [当前发布说明](evidence/v15/RELEASE_NOTES.md)。
3. **t10 失败排查**：准确起点未改代码时单文件已为 37/37；改候选池后仍为 37/37，未能复现云端两条失败。该文件无固定 content digest；使用真实 createMatch(5) 战斗和独立阶段夹具，装备限制已由 e1c94004 对齐，买卖异常目标的两例也通过。无证据支持改实现、删例或放宽断言，原文件保持不变。未取得云端失败用例名和输出，具体云端失败原因仍未知。扩查修正三处 D11 合入前的旧期望：非 P4 目录计数 41→43（加入两个 D11）；Avarice 从“生产目录不存在”改为“单机存在、联机候选排除”；强化静态清单加入三个 D11 ID 和各自精确 d11Fill 效果断言（57→60），其余独立数值断言保持。

## 版本与摘要

| 项目 | 本次 HEAD 2aaa537c | 收口最终值 |
| --- | --- | --- |
| rulesVersion / contentVersion | s13-g2-3-v15 / s13-14.24b-g2-3-v15 | 不变 |
| schema / save / replay / command | 7 / 3 / 3 / 4 | 不变 |
| 领域 NET_PROTOCOL_VERSION | 4 | 4 |
| MULTIPLAYER_LOOT_CONTRACT_VERSION | multiplayer-orb-claim-v2 | 不变 |
| LOOT_RUNTIME_REVISION | multiplayer-orb-claim-v3 | 不变 |
| G23_POLICY.revision | g2-4b-multiplayer-orb-claim-v15 | 不变 |
| AUGMENT_OFFER_POLICY.version | augment-card-reroll-v15 | 不变 |
| D11_FILL_ACTIVATION / execution | wired-v15 / d11-wired-v15 | 不变 |
| 强化 / 单机异常 / 联机异常候选 | 60 / 54 / 54 | 60 / 54 / 53 |
| ANOMALY_OFFER_POLICY.revision | 无模式排除约定 | anomaly-offers-v15-online-avarice-deferred |
| CONTENT_DIGEST | fnv1a32-utf16:2d6c67f0 | fnv1a32-utf16:70dbb056 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:61568ec0 | fnv1a32-utf16:61568ec0 |
| RNG / tick | lcg32-v1 / 50ms | 不变 |

历史 v14 内容/掉落摘要仍为 ea6b11b6 / 9895bc42；前轮统一前内容摘要为 99b62a66。本次自然计算摘要新增模式候选策略，完整 60/54 定义、D11 来源及执行约定继续参与摘要；没有手填生产哈希或缩小掉落 manifest。冻结算法、权重、售价及数值不变。旧 rules/content、旧 digest 和 command3 按严格边界拒绝，无归一化或迁移。

## Epoch 与生成方式

新目录：`docs/evidence/v15/`，`tests/v15-content-baseline.json`，`tests/fixtures/v15-recorded-states/`、`v15-herald-raw/`、`v15-b8-fingerprints.json`、`v15-c19-seed-9-minimal.json`，以及 `tests/fixtures/m5/full-match-golden.v15.json`。`scripts/verify-m8-herald-fixtures.cjs` 的 CURRENT 指向 `tests/fixtures/record-v15-herald.cjs`。

v15 的 `--baseline-commit` 固定为本轮集成基线 `915439176f9990fe1846a506d6477cfe81640a7a`；比较对象为其保留的 G2-4b 文件。历史 G2-4b 的 G2-3 比较基线仍为 `430017516a18fb38ee028cec000a44fb94bb638f`，不更改历史生成器或哈希断言。唯一授权修复是 G2-4b manifest 恢复 6392f319^ 原字节；v15 audit 单独记录该引用，其余历史文件仍逐字节比较原集成基线。新 `v15-fixture-audit.cjs` 复用原 `g2-4b-fixture-audit.cjs` 的 git 只读字节检查及 source verification。

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

## 重录与验证结果

release → herald → inputs → live-reveal 已依次完成，全部写入 v15 epoch；content baseline、M5 golden、两个 67 状态压缩包、Herald 5 组/7 文件、B8 0/1/9 单位指纹及 C19 输入均重录。

B8 0/1/9 指纹重新计算后与本次 HEAD 的 v15 文件字节相同，因此没有该文件的 Git diff；C19 输入中的摘要随身份更新，既有终局、死亡 tick 和真伤脉冲断言不变。

首战仍为 164 tick / 106 战斗事件 / playerWin，战斗 state/event 数值摘要仍为 1db5b9e9 / cf452d32。完整 Match state trace SHA 从本次 HEAD 的 bbfca39f17b86fceb2936a7801823e2ef2a585098a6338e81c2d5da5d874bf11 变为 499a9a3606d9cc100b60535b80c24d11c9696e42136134f545d47d1b74fd9f79；首战 events/RNG trace 不变。

| 录制 / 校验 | 实测结果 |
| --- | --- |
| record-v15-release | 4 路线各 33 战均 victory；cannon/sniper 各 67 检查点严格 text/object restore；M5 golden 更新 |
| record-v15-herald --write | 5 组/7 文件；全部 raw 先生成再导入 production serialization；每组 14 场过渡战斗和开战后 15 tick 存取通过 |
| record-v15-inputs | 9 条字节证据；B8 0/1/9 指纹；C19 273 终局 tick、148/273 死亡 tick 和真伤脉冲断言保持 |
| record-v15-live-reveal | 四分支全通过；tick44 双源、381/152 部分死亡、4/0 收据和资源增量保持 |
| record-v15-inputs --check | 9 条证据一致，通过 |
| verify-m8-herald-fixtures | CURRENT=v15；5 组 raw/trajectory/manifest 共 7 文件重生成字节一致，通过 |
| record-v15-live-reveal --check | 四分支及完整资源断言一致，通过 |
| g2-4b 原审计 / v15 fixture audit | 原 G2-4b 9 条 current/previous SHA 断言通过；86 个历史文件按原基线及唯一 manifest 修复引用逐字节通过 |
| v15 三份 audit sourceDigests | release / inputs / live-reveal 与当前源码逐项一致 |
| tsc --noEmit | 通过 |
| git diff --check / 目录边界 | 通过；禁改目录无改动，历史目录仅指定 manifest 恢复 |

## 逐文件测试结果

逐个执行 `node node_modules/vitest/vitest.mjs run <file> --configLoader runner --reporter=json --outputFile=<artifact.json>`，不改超时、不删用例。范围为前轮 74 文件，加本次候选池、异常/强化、T10、身份和恢复覆盖，共 128 文件。日志和 JSON 保存在未提交的 artifacts/v15-final/。

<!-- V15_TEST_RESULTS -->
最终 **128 文件 / 1987 通过 / 0 失败 / 0 跳过**。首轮七份文件暴露旧目录/路线/自动领取期望，修正后逐个复跑；初次及复跑 JSON 均保留。强化静态清单新增三个 D11 精确效果用例，其余用例保留。

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
| `tests/g2-3-anomalies.test.ts` | 53 | 0 |
| `tests/g2-3-content.test.ts` | 10 | 0 |
| `tests/g2-3-identity.test.ts` | 14 | 0 |
| `tests/g2-3-integration.test.ts` | 18 | 0 |
| `tests/g2-3-netcode-hooks.test.ts` | 14 | 0 |
| `tests/g2-4b-gambler.test.ts` | 2 | 0 |
| `tests/g2-4b-gold-settlement.test.ts` | 2 | 0 |
| `tests/g2-4b-restore-authority.test.ts` | 8 | 0 |
| `tests/g2-augments-choice.test.ts` | 72 | 0 |
| `tests/g2-augments-combat.test.ts` | 16 | 0 |
| `tests/g2-augments-identity.test.ts` | 1 | 0 |
| `tests/g2-augments-multiplayer.test.ts` | 6 | 0 |
| `tests/g2-augments-static.test.ts` | 93 | 0 |
| `tests/loot-orb-claim.test.ts` | 20 | 0 |
| `tests/m4-effect-combat.test.ts` | 7 | 0 |
| `tests/m4-review-regressions.test.ts` | 16 | 0 |
| `tests/m4-strategy-snapshot.test.ts` | 10 | 0 |
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
| `tests/m8-b8-acquisition.test.ts` | 12 | 0 |
| `tests/m8-b8-combat-input.test.ts` | 38 | 0 |
| `tests/m8-b8-command-oracle.test.ts` | 6 | 0 |
| `tests/m8-b8-copy-semantics.test.ts` | 6 | 0 |
| `tests/m8-b8-equipment-fixture.test.ts` | 4 | 0 |
| `tests/m8-b8-golden-guard.test.mjs` | 24 | 0 |
| `tests/m8-b8-input-evidence.test.mjs` | 32 | 0 |
| `tests/m8-b8-live-capacity.test.ts` | 6 | 0 |
| `tests/m8-b8-live-cross-round.test.ts` | 6 | 0 |
| `tests/m8-b8-live-economy.test.ts` | 3 | 0 |
| `tests/m8-b8-live-growth.test.ts` | 26 | 0 |
| `tests/m8-b8-live-reveal.test.ts` | 3 | 0 |
| `tests/m8-b8-live-transfer.test.ts` | 19 | 0 |
| `tests/m8-b8-loot-freeze.test.ts` | 67 | 0 |
| `tests/m8-b8-loot-runtime.test.ts` | 16 | 0 |
| `tests/m8-b8-loot-view.test.ts` | 7 | 0 |
| `tests/m8-b8-oracle.test.ts` | 24 | 0 |
| `tests/m8-b8-resource-provenance.test.ts` | 64 | 0 |
| `tests/m8-b8-restore-fold-reuse.test.ts` | 5 | 0 |
| `tests/m8-b8-restore.test.ts` | 7 | 0 |
| `tests/m8-b8-token-lifecycle.test.ts` | 3 | 0 |
| `tests/m8-b9-golden-guard.test.mjs` | 3 | 0 |
| `tests/m8-b9-golden-tamper.test.mjs` | 8 | 0 |
| `tests/m8-content-equivalence.test.ts` | 138 | 0 |
| `tests/m8-contracts.test.ts` | 6 | 0 |
| `tests/match-contract.test.ts` | 12 | 0 |
| `tests/match-economy.test.ts` | 83 | 0 |
| `tests/match-lifecycle.test.ts` | 12 | 0 |
| `tests/match-session.test.ts` | 16 | 0 |
| `tests/mp-overtime-choices.test.ts` | 1 | 0 |
| `tests/mp-overtime-production.test.ts` | 2 | 0 |
| `tests/opening-random-identity.test.ts` | 141 | 0 |
| `tests/r3r4-consumable-targets.test.ts` | 5 | 0 |
| `tests/r3r4-shared.test.ts` | 8 | 0 |
| `tests/s13-anomalies-b.test.ts` | 5 | 0 |
| `tests/s13-anomalies-c.test.ts` | 8 | 0 |
| `tests/s13-anomalies-d.test.ts` | 4 | 0 |
| `tests/s13-anomalies-redirect.test.ts` | 1 | 0 |
| `tests/s13-anomalies-replay.test.ts` | 7 | 0 |
| `tests/s13-anomalies-restore-review.test.ts` | 6 | 0 |
| `tests/s13-anomalies-restore.test.ts` | 11 | 0 |
| `tests/s13-anomalies-review.test.ts` | 17 | 0 |
| `tests/s13-anomalies-settlement.test.ts` | 4 | 0 |
| `tests/s13-anomalies-source.test.ts` | 12 | 0 |
| `tests/s13-augments-p2-choice.test.ts` | 23 | 0 |
| `tests/s13-augments-p2-combat.test.ts` | 34 | 0 |
| `tests/s13-augments-p2-multiplayer.test.ts` | 18 | 0 |
| `tests/s13-augments-p3.test.ts` | 30 | 0 |
| `tests/s13-p1-acquisition.test.ts` | 3 | 0 |
| `tests/s13-p1-avarice.test.ts` | 1 | 0 |
| `tests/s13-p1-bound-identity.test.ts` | 2 | 0 |
| `tests/s13-p1-dual-wielding.test.ts` | 2 | 0 |
| `tests/s13-p1-income.test.ts` | 8 | 0 |
| `tests/s13-p1-multiplayer-income.test.ts` | 2 | 0 |
| `tests/s13-p3-acquisition.test.ts` | 12 | 0 |
| `tests/shared-pool-cache.test.ts` | 4 | 0 |
| `tests/t10-auto-deploy.test.ts` | 5 | 0 |
| `tests/t10-combat-ops.test.ts` | 37 | 0 |
| `tests/t10-deferred-upgrades.test.ts` | 10 | 0 |
| `tests/t11-golden.test.ts` | 2 | 0 |
| `tests/t11-opening-xp.test.ts` | 2 | 0 |
| `tests/t11-round-flow.test.ts` | 1 | 0 |
| `tests/t12-combat-equip.test.ts` | 48 | 0 |
| `tests/t12-golden.test.ts` | 6 | 0 |
| `tests/t12-offline-transfer.test.ts` | 1 | 0 |
| `tests/t12-recovery-boundary.test.ts` | 5 | 0 |
| `tests/t13-a-golden.test.ts` | 6 | 0 |
| `tests/t13-auto-combine.test.ts` | 14 | 0 |
| `tests/t13-golden.test.ts` | 1 | 0 |
| `tests/t13-identity.test.ts` | 3 | 0 |
| `tests/t2-two-sided-battle.test.ts` | 21 | 0 |
| `tests/t3-round-settlement.test.ts` | 10 | 0 |
| `tests/t3-timeout-loot.test.ts` | 6 | 0 |
| `tests/t5r-loot-view.test.ts` | 24 | 0 |
| `tests/t5r-private-seat-view.test.ts` | 15 | 0 |
| `tests/t7-bot-policy.test.ts` | 24 | 0 |
| `tests/t7-integration.test.ts` | 4 | 0 |
| `tests/tp-rewards-and-rounds.test.ts` | 9 | 0 |
| `tests/tp-shared-pool.test.ts` | 14 | 0 |
| `tests/ur-i3-combat-statuses.test.ts` | 6 | 0 |
| `tests/v15-anomaly-availability.test.ts` | 3 | 0 |
<!-- END_V15_TEST_RESULTS -->

## 扩查旧测试的精确修正

128 文件首轮中七份文件存在旧期望或旧路线，均保留原用例和超时。这里记录差异依据，最终逐文件结果以表格为准：

| 文件 | 修正与保留的验收边界 |
| --- | --- |
| g2-augments-static | 静态清单补入三项 D11，并各增一条精确 d11Fill 效果断言，目录仍精确 60 项 |
| m8-b8-equipment-fixture | 相同公开种子/组件/物品序号下，第二强化已变为 investment-strategy-i；精确断言该 ID、投资成长为 0、原 Irelia 700 HP 及所有物品来源 |
| m8-b8-live-capacity | 在原公开 Urgot 移动后，用公开部署将 unit-1 移到 (3,4)，保留 gold=18、9 席容量、揭示 117 / 终局 137 tick、存取和拒绝篡改全部边界 |
| m8-b8-live-economy | 原 97653 在当前目录提供其他金色强化，不能选择投资。独立 oracle 筛选、真实命令确认新种子 3374947733；保持 65 金 / 73 HP / 投资成长 128、2-7 完整掉落、9/49/50 金的 16/60/61 结算与 136/168/168 成长断言 |
| m8-b8-live-transfer | 当前公开路线只有 21 次英雄出生、65 条资源记录，下一英雄为 unit-22；更新精确序号，仍验证真实付费 Ezreal、TG 配方/归属、异常迁移、事件与完整恢复，未改变升星/装备规则 |
| s13-p1-dual-wielding | 旧压缩命令带保持原 v14 字节及身份断言；当前 v15 命令带通过公开路线和独立账本现场生成、再逐命令重放；两件角色装备、唯一赠送、售出目标及拒绝篡改断言保留 |
| t11-opening-xp | v15 联机奖励须显式领取，因此未领取为 10 金而非自动入账后的 13；开局基础收入为 2+3+5，精确断言累计 [2,5,10]、金币领取收据为空、原 level3 / XP2；单机仍精确 13 金 |

这些修正仅涉及测试，不改变生产实现或已有 v15 源码指纹；因此无需再次重录已通过的领域 epoch。

## 约定值清单

- **贪财化身联机暂缓**：单机 54 / 联机 53 异常，强化 60；只限制联机首抽及付费刷新，单机及模块保留。服务器接通每 tick 前权威 sampleBankGold 和私有回放证据后再恢复联机候选。
- 完整星级需共享库存 1/3/9 份；不足时整条只按英雄费用补一次金币，不部分取卡、不按份数倍增、不叠加满席出售金币。
- 有货且实际入库前扣池；满席按 getUnitSellPrice 出售，视为未取出。1 费 1/2/3 星分别 +2/+5/+17，2 费 2 星 +3。
- 机制奖励法球暂用 gray，为项目分类默认；仅联机显式领取，单机沿原发奖/满席托管规则。
- 战斗和冻结 PvP 阵容仍可进入席位私有 FIFO；本轮经济、HP、成长、G23、延迟升星后、战后选择前结算。先判淘汰再分配，不回算利息，不自动领取新法球。
- 排队、领取、缺货、折金、扣池本身零 RNG；临时装备仍用原 equipment 流。跨席竞争按权威提交顺序。
- 每强化选择每槽免费刷新一次，新卡不能再刷；移出 ID 本局本席永久排除。强化节点 2-1/3-2/4-2 同级，等级等权为项目约定，未核实为原版概率。
- 初次三张消耗 choice 流三字，单卡刷新一字；一候选仍可成功，零候选原子拒绝。generation 与有序 rerolledIndices 按提交顺序重演。
- D11 灵魂连接取开战 HP 完整十点缺失组；三项赛用独立派生开战流。贪财化身增伤上限 40%，银行不截 50；猎头者按 kill eventSeq 结算，排除助攻、野怪、召唤物和镜像。

## Claude 配套与交付边界

领域验收不代表端到端上线。协议 4、claimOrb/rerollAugment 白名单、原子 state+pool 事务、bot 准备领取、私有法球/单卡刷新投影、公开 statuses/choiceEffects、重连 FIFO 与收据保留仍由 Claude 配套；本次未修改服务器或界面。D11-SERVER-LIVE-BANK 现在是贪财化身重回联机候选的准入条件，不再阻塞其余 v15 领域收口。完整签名、输入输出及失败枚举见 [Match 合同](MATCH_CONTRACT.md)。

建议提交信息：`fix(simulation): close v15 anomaly availability and fixture audits`。仅工作区交付，不提交、不发布。
