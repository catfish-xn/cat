# v15 合并冲突处理与逐文件验证

日期：2026-10-20。交付为工作区文件；未执行 git 命令、未写 .git、未联网、未安装依赖、未直接调用 exe。未登记索引解决状态，也未完成合并提交。

## 范围与结果

只读本地 refs、commit/tree/blob 与 pack 对象，计算与用户指定两条三点差异等价的文件清单，没有调用 git。

| 身份 | 提交 |
| --- | --- |
| HEAD：codex/loot-orb-claim | fcf87f85cdd1117f14cdb8027f80475d72411a07 |
| MERGE_HEAD：origin/codex/d11-wiring | 000750494f5010018cf857e7956ea48f9b644913 |
| origin/multiplayer；两条三点差异及本次合并的共同祖先 | a0d42c592cbd48fb075175e5f61818dabfe1b320 |

两支共涉及 105 个路径，其中 10 个双边改动路径、95 个单边改动路径；直接改动的 tests/ 含 23 个可执行测试文件、5 个夹具/辅助文件。另逐文件执行这些辅助文件的 19 个静态依赖消费者，以及 12 个 D11/身份/旧指纹补充回归。

直接改动测试：23 文件，320 通过 / 1 失败。补充：31 文件，589 通过 / 278 失败。总计 **54 文件，909 通过 / 279 失败，0 跳过**。剩余失败集中于下文 6 个旧基线文件；未发现尚未处理的合并行为回归。

## 五处冲突处理

| 文件 | 合并结果 |
| --- | --- |
| src/simulation/combat-replay-view.ts | unitView 同时输出 statuses 与可选 choiceEffects；保留状态清空数组、关键帧、增量更新，以及 D11 bankSamples 的回放输入消费 |
| src/simulation/private-seat-view.ts | 同时保留联机 unclaimedOrbs / orbClaimReceipts、按卡刷新投影与可选 d11Display；单机省略法球字段 |
| docs/MATCH_CONTRACT.md | D11、法球领取/排队与按卡刷新各节均保留；去掉误带入的旧 v14 整组刷新标题，统一联机赠送法球语义 |
| docs/MULTIPLAYER_CONTRACT.md | D11 银行/击杀事实与按卡刷新/法球/statuses 合同并存；保留服务器尚未配套的边界 |
| docs/UI_REQUESTS.md | LOOT-ORB-CLAIM、D11-SERVER-LIVE-BANK、D11-DISPLAY、AUGMENT-CARD-REROLL、UR-I3-01 均保留，各节不重复 |

docs/D11_WIRING_V15.md 增补合并说明，区分 D11 单支历史 v14 记录与当前法球分支既有 v15 身份。原历史记录、来源和验证清单保留。

## 自动合并语义检查

- match.ts 同时保留联机 PvE 实时金币取样、按卡刷新/永久移出、法球命令及战后 FIFO。round-settlement.ts 保留猎头者事实校验；仍先经济/HP/成长/G23/延迟升星，后领取队列，再打开选择。淘汰先作废。
- drainP2Gifts 末尾继续接 drainAllD11Gifts；通用 grantMechanicUnit 使联机 D11 / P2 英雄先生成唯一奖励法球。选择时不扣共享池、不补金；领取才按现有库存/容量处理。贪财化身的获取金币仍即时发放一次。
- 独立 oracle 同时保留按卡刷新单字抽取、永久排除与 D11 的英雄计划/金币来源。运行目录、等级表、有限机制白名单与数量断言均为 60 强化 / 54 异常；没有通过删字段或减少目录保留旧计数。
- D11 联机测试原有 4 个即时发英雄预期移到显式领取之后；另验证赠送法球与 d11Display 共存、私有 JSON 恢复、公开只给 count/tiers、冻结 PvP 阵容排队后结算、重复拒绝和 statuses / choiceEffects 共存。
- 补充回归暴露 P2 联机测试的同类即时赠送预期，保留原赠送数量、羁绊阈值、库存/补金和结算断言，在显式领取后验证；18 项通过。m5-audit-boundaries 的独立异常目录补齐 D11 两个来源 ID，完整抽样/RNG/扣金断言保留；20 项通过。
- D11 银行测试保留原历史 digest 断言，将其移到末尾；此前真实银行采样、完整账本、切片回放、隐私和篡改拒绝断言均执行完成，最终只在旧 digest 比较失败。
- 95 个单边改动路径逐一与对应父提交比对；仅上述 D11 文档和两份 D11 测试有本次有意调整。其余单边内容完整保留。三个合同文件无重复二级标题，src/docs/tests 无遗留冲突标记。
- m8/version.ts 与 HEAD 完全一致；D11 来源数值和 d11-fill.ts 执行实现与 incoming 完全一致；incoming 的 Herald manifest 未再改动。未改录制 JSON/gzip、golden、指纹或 digest 常量，保留临时 preD11 边界。HEAD 与 MERGE_HEAD 未变化。

## 验证命令

最终 npx.cmd tsc --noEmit 退出码 0。

每份文件分别执行 npx.cmd --no-install vitest run &lt;file&gt; --configLoader runner --reporter=json --outputFile=artifacts/merge-v15/&lt;name&gt;.json。没有更新快照参数、没有放宽超时。以下均为最终单文件运行结果；不把先前探测运行的临时失败或成组结果计入。

## 两支直接改动的测试

| 测试文件（均在 tests/） | 通过 | 失败 |
| --- | ---: | ---: |
| augment-card-reroll.test.ts | 12 | 0 |
| augment-tier-consistency.test.ts | 7 | 0 |
| d11-fill-mechanics.test.ts | 20 | 0 |
| d11-fill-source.test.ts | 7 | 0 |
| d11-wiring-bank.test.ts | 1 | 1 |
| d11-wiring-match.test.ts | 5 | 0 |
| d11-wiring-online.test.ts | 10 | 0 |
| g2-3-integration.test.ts | 18 | 0 |
| g2-3-netcode-hooks.test.ts | 14 | 0 |
| g2-augments-choice.test.ts | 72 | 0 |
| loot-orb-claim.test.ts | 20 | 0 |
| m5-content.test.ts | 9 | 0 |
| m8-contracts.test.ts | 6 | 0 |
| match-contract.test.ts | 12 | 0 |
| r3r4-shared.test.ts | 8 | 0 |
| s13-anomalies-source.test.ts | 12 | 0 |
| s13-augments-p2-choice.test.ts | 23 | 0 |
| shared-pool-cache.test.ts | 4 | 0 |
| t3-timeout-loot.test.ts | 6 | 0 |
| t5r-loot-view.test.ts | 24 | 0 |
| t5r-private-seat-view.test.ts | 15 | 0 |
| tp-rewards-and-rounds.test.ts | 9 | 0 |
| ur-i3-combat-statuses.test.ts | 6 | 0 |

## 辅助文件消费者及补充回归

| 测试文件（均在 tests/） | 通过 | 失败 |
| --- | ---: | ---: |
| b8-resumable-battle.test.ts | 13 | 2 |
| c19-missed-pulse.test.ts | 9 | 1 |
| g2-1-content.test.ts | 33 | 0 |
| g2-3-content.test.ts | 10 | 0 |
| g2-4b-gambler.test.ts | 2 | 0 |
| g2-4b-gold-settlement.test.ts | 2 | 0 |
| g2-4b-restore-authority.test.ts | 8 | 0 |
| m5-acceptance.test.ts | 7 | 0 |
| m5-audit-boundaries.test.ts | 20 | 0 |
| m8-b5-grant-upgrade.test.ts | 14 | 0 |
| m8-b5-instances.test.ts | 18 | 0 |
| m8-b5-queries.test.ts | 5 | 0 |
| m8-b5-temporary.test.ts | 30 | 0 |
| m8-b7-match-wiring.test.ts | 25 | 5 |
| m8-b8-command-oracle.test.ts | 6 | 0 |
| m8-b8-loot-freeze.test.ts | 67 | 0 |
| m8-b8-loot-runtime.test.ts | 16 | 0 |
| m8-b8-oracle.test.ts | 24 | 0 |
| m8-content-equivalence.test.ts | 4 | 134 |
| match-economy.test.ts | 83 | 0 |
| match-lifecycle.test.ts | 12 | 0 |
| match-session.test.ts | 16 | 0 |
| opening-random-identity.test.ts | 4 | 136 |
| r3r4-consumable-targets.test.ts | 5 | 0 |
| s13-anomalies-replay.test.ts | 7 | 0 |
| s13-augments-p2-combat.test.ts | 34 | 0 |
| s13-augments-p2-multiplayer.test.ts | 18 | 0 |
| t12-combat-equip.test.ts | 48 | 0 |
| t2-two-sided-battle.test.ts | 21 | 0 |
| t7-bot-policy.test.ts | 24 | 0 |
| t7-integration.test.ts | 4 | 0 |

## 仅因旧身份/待重录而失败

| 测试文件 | 失败数 | 证据与边界 |
| --- | ---: | --- |
| d11-wiring-bank.test.ts | 1 | 旧 g2-4b-content-baseline 仍为 ea6b11b6，当前沿用 HEAD 的 99b62a66；历史断言保留在用例末尾，其前银行和回放行为均完成 |
| b8-resumable-battle.test.ts | 2 | 1 / 9 单位的旧回放 SHA 不符；两项的战斗 SHA 均与旧值相同，0 单位指纹通过。statuses 投影扩展需要新的回放基线；其他 13 项通过 |
| c19-missed-pulse.test.ts | 1 | 旧 seed-9 编译输入在 restorePlayerBattleSnapshot 被 content-digest 拒绝；9 个独立脉冲/刷新边界用例通过 |
| m8-b7-match-wiring.test.ts | 5 | 历史 Herald raw 的 ionic-spark（两个状态）、evenshroud、quicksilver、edge-of-night 在恢复时 unsupported-version；其余 25 项通过 |
| m8-content-equivalence.test.ts | 134 | cannon/sniper 各 67 个 v14 记录状态被当前 v15 身份严格拒绝；其他 4 项通过 |
| opening-random-identity.test.ts | 136 | 1 项旧 digest、134 个 v14 检查点 unsupported-version、1 项旧完整 Match 状态 trace SHA；首战 combat 状态/事件摘要断言已通过，4 项历史链/拒旧用例通过 |

以上失败未通过覆盖旧数据、删除断言或放宽恢复校验消除。旧夹具拒绝发生后，其后续行为断言尚未执行，不能据此宣称旧夹具的全部行为验收完成。

## 交付边界

冲突内容和语义交叉已处理；合并仍保持进行中，索引未标记解决。后续由获授权的主控完成合并登记。统一 v15 身份/指纹迁移另轮处理，本次不重算身份、不重录。

D11 实时 PvP 银行、法球网络协议/控件、按卡刷新和说明/statuses 消费仍需原职责方接线；本次未改服务器、表现层或素材，也不宣称已可上线。

详细范围与机器输出在本地 artifacts/merge-v15/ 的 scope.json、final-audit.json、逐文件 JSON/log；这些生成证据不提交。
