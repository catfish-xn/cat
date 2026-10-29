# 慢测试 2：tests-4 其他慢用例

基线 `multiplayer` `5c376b5ef69f2c5b384f5466367bca609ed1d0ad`。分支 `cursor/slow-tests-2`。只改测试和本文，没有改 `src/`。

计时是本机 Vitest 5、`--project fast --maxWorkers=1 --fileParallelism=false` 的逐用例耗时，不含 `beforeAll`。超时默认 5000 ms；表里写的是该用例自己的上限。一半即目标。清单机一列来自 `slow-tests-list` 的「tests-4 其他慢用例」（`--maxWorkers=2` 逐文件），只作对照，不与本机改后相减。

禁改清单 154 个文件和事先点名的跳过项都没有改。本地在清单到达前没有提交过改动，因此没有需要撤回的禁改 diff。

## 仍超过一半超时

本机改后，67 条里能改的都低于各自超时的一半。

下面两条在禁改清单里，本机没有复测。按清单机耗时，它们超过自己超时的一半（`vi.setConfig({ testTimeout: 20_000 })`，一半 10 s）：

| 文件 | 用例 | 清单机 / s | 超时 | 一半 | 原因 |
| --- | --- | ---: | ---: | ---: | --- |
| `tests/m8-b8-live-reveal.test.ts` | B8 real simultaneous loot-source deaths earns only killed source rewards after an actual partial defeat with loris | 12.178 | 20000 | 10000 | 禁改 |
| `tests/m8-b8-live-reveal.test.ts` | B8 real simultaneous loot-source deaths earns only killed source rewards after an actual partial defeat with zyra | 12.161 | 20000 | 10000 | 禁改 |

## 改过的用例

耗时单位毫秒。改后是本机改完后的单跑。

| 文件 | 用例 | 改前 | 改后 | 超时 | 一半 | 清单机 / s | 改法 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `tests/m6-integration-sniper-caitlyn.test.ts` | sniper-caitlyn: every completed battle has exact original state/events and isolated playback | 76144 | 58273 | 360000 | 180000 | 132.473 | `tests/m6-integration-helper.ts`：每场战斗只 `startMatchCombat` 一次，中点对照从这次开局往下 `stepMatch`。逐 tick 哈希、独立回放和 `deepStrictEqual` 都还在。剩下的时间是整条路线加逐 tick 回放，不能删 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | sniper-caitlyn: full catalog-capacity envelope acceptance (B9) | 10034 | 9285 | 120000 | 60000 | 23.165 | 同上，少了一次重复开局；信封校验没动 |
| `tests/m5-match-integration.test.ts` | restores each real tick, then supply without creating combat or consuming battle RNG | 15506 | 11684 | 60000 | 30000 | 28.503 | 每个 tick 的 `stepMatch(state)` 原来算了两次。现在保留一次结果，既和恢复后的 step 比较，也用它推进。`serialize` / `restore` 和后续供给断言没少。同机稍后整批复测 12920 |
| `tests/server/shared-pool-room.test.ts` | pvpMode=placeholder | 7764 | 1639 | 90000 | 45000 | 13.897 | `beforeAll` 用真实 `placeholderPvp` 打完一局并记下战斗结果；用例再打一局时只读克隆。每次发布的 `assertSharedPoolConservation` 和 `poolRevision` 单调检查仍在用例里。房间默认的发布前守恒检查没有关 |
| `tests/server/g2-4a-forge-timeout.test.ts` | opened from the bench it offers four distinct ordinary completed items, and its own 30 s deadline grants the first offer once | 4916 | 24 | 30000 | 15000 | 5.584 | 四条用例各自的「开房并走到第 4 回合战斗」拆成四个 `beforeAll`（每个一份房间，互不改写）。用例仍从那场战斗 `toAnvil` 并保留原断言 |
| `tests/server/g2-4a-forge-timeout.test.ts` | a pick before the deadline grants that item, cancels the deadline at once and the old deadline grants nothing more | 3380 | 14 | 30000 | 15000 | 5.050 | 同上，用第二份已走到第 4 回合战斗的房间 |
| `tests/server/g2-4a-forge-timeout.test.ts` | never shows the four offers, the choice or its deadline to another seat, in its view or its pushes | 2282 | 14 | 30000 | 15000 | 4.537 | 同上，第三份 |
| `tests/server/g2-4a-forge-timeout.test.ts` | a JSON copy of the seat with the open anvil re-derives the same choice and continues exactly like the live seat | 1885 | 14 | 30000 | 15000 | 4.399 | 同上，第四份 |
| `tests/server/augment-tier-consistency.test.ts` | eight room seats share tiers across all three nodes and forward free rerolls through the gate | 1612 | 1010 | 5000 | 2500 | 2.690 | `beforeAll` 用真实 resolver 把八席空棋盘路线打一遍并缓存战斗；用例再打一遍，断言仍在用例里（强化档、免费重转、`restoreSharedOrbSnapshot`）。空棋盘战斗没有强化死亡样本，可以克隆 |
| `tests/server/augment-pool-batch5-h6-room.test.ts` | contested real room reaches 3-2 through the room | 1512 | 135 | 5000 | 2500 | 2.589 | 同一 `installB1Offers(['contested'])` 下，`beforeAll` 分段把影子房间真实打到 3-2 准备并记录战斗。用例仍自己 `runUntilClaiming`，只是读到那次真实结果的克隆。选卡和结算用例的原断言还在 |
| `tests/server/h12-subscription.test.ts` | real room advances to natural round 11 | 1852 | 108 | 5000 | 2500 | 2.761 | 购买、锁定、重转的原断言留在 `beforeAll`（必须发生在后面几轮之前，且是同一间房）。5/6/8 与 9/10/11 分两段 `beforeAll` 真实推进，并在每一轮准备期留下池和席位克隆。用例检查轮次、订阅收据、商店、`requireAugmentFacts`、`enterShopAugmentRound` 和 `onlineTripAndReject`。没有关守恒检查。跨房间克隆战斗结果会丢掉 WeakMap 上的死亡样本，所以这里不用那条缓存 |

`h12` 的「choose, buy, lock and reroll」不在 67 条里。它的命令和原来的 `expect` 改在到达第 5 轮之前的 `beforeAll` 里执行；用例改为核对第 5 轮标记上的订阅、锁店、持有和守恒。

## 没改的用例

改前即本机单跑。改后与改前相同。都已经低于自己超时的一半，除非另注。

| 文件 | 用例 | 改前 | 超时 | 一半 | 清单机 / s | 原因 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `tests/m8-b4-audit-regressions.test.ts` | 5-1 real Match progression with Titan/Warmog/Gunblade saves through enemy same-action double damage | 18037 | 120000 | 60000 | 22.374 | 大头是 `configuredPrefix('5-1')`，实现在禁改的 `tests/fixtures/t13-loot-public.ts`。后面的逐 tick `serialize` / `restore` / `stepMatch` 是断言。没有重复的同状态 `stepMatch` 可删。不改 `src/` |
| `tests/server/v17-avarice-same-tick.test.ts` | samples each accepted change in commit order at one tick; refused and gold-neutral commands add nothing | 10419 | 120000 | 60000 | 21.195 | 一条用例真实打到 4-6 再在战斗中改金币。克隆战斗结果会丢掉死亡样本上的 WeakMap，不能拿去回放。超时一半是 60 s |
| `tests/server/g5-economy-preview.test.ts` | G5 economyPreview in the private seat view equals the settled incomeBreakdown item by item over a match into overtime (1-x opening, 2-1, overtime, 10-gold steps) | 未复测 | 120000 | 60000 | 18.993 | 点名跳过，且在禁改清单 |
| `tests/server/shared-pool-room.test.ts` | pvpMode=two-sided | 8726 | 90000 | 45000 | 16.536 | 双方战斗结果上的死亡样本挂在事件对象身份上，克隆后房间结算会报 `missing executed death samples`。每次发布的守恒和 `poolRevision` 检查保持原样。同机另一次单跑 6076，差在冷热，不当成优化 |
| `tests/server/combat-stream.test.ts` | round 11: buys/sells/rerolls during battle use settlement gold for interest with deterministic slicing | 6609 | 120000 | 60000 | 15.715 | 同一局用 `sliceTicks` 1 和 8 各打一遍再比整局 JSON，这就是断言。缓存会让两次切片不再各自结算 |
| `tests/m8-b8-live-reveal.test.ts` | … with loris | 未复测 | 20000 | 10000 | 12.178 | 禁改。清单机超过一半，见上节 |
| `tests/m8-b8-live-reveal.test.ts` | … with zyra | 未复测 | 20000 | 10000 | 12.161 | 禁改。清单机超过一半，见上节 |
| `tests/server/combat-stream.test.ts` | 8 seats seed 7: old full battles, ledgers, damage and replay bytes equal | 8542 | 120000 | 60000 | 11.000 | 五轮里流式战斗要和当场 `resolveBattle` 的整局字节对照。两路都必须真跑 |
| `tests/server/combat-stream.test.ts` | 8 seats seed 991: old full battles, ledgers, damage and replay bytes equal | 5669 | 120000 | 60000 | 9.797 | 同上 |
| `tests/playtest-1022b-bench.test.ts` | measures combat bench moves separately from Room.handle PvE catch-up | 3857 | 60000 | 30000 | 9.585 | 500 次 `applySeatCommand` 采样和两次走到第 3 回合战斗是测量本身。不能少次数 |
| `tests/server/combat-stream.test.ts` | 8 seats seed 42: old full battles, ledgers, damage and replay bytes equal | 4719 | 120000 | 60000 | 9.162 | 同 seed 7 |
| `tests/t12-offline-transfer.test.ts` | T12 offline loot upgrade migrates latest equipment and restores overflow of a frozen donor item | 5170 | 60000 | 30000 | 9.001 | 公共路线已经按 tick 边界分在 `beforeAll`。用例里每个 tick 的 `stepMatch` 对照和 `serialize` / `restore` 是断言。准备函数在禁改的 `tests/fixtures/t13-loot-public.ts` |
| `tests/server/combat-stream.test.ts` | round 5: buys/sells/rerolls during battle use settlement gold for interest with deterministic slicing | 4180 | 120000 | 60000 | 8.986 | 同 round 11，两次切片都要真打 |
| `tests/server/c15-replay-unit-ids.test.ts` | side A and mirrored side B each get exactly their own unit entries, never the opponent's | 4220 | 60000 | 30000 | 6.405 | 真实双方战斗加回放座位对照。没有可外提且不改断言的重复前置 |
| `tests/server/g2-4a-forge-timeout.test.ts` | a resumed seat gets the same choice and the unchanged deadline, and can still pick | 4103 | 60000 | 30000 | 5.886 | 重连走 `startServer` 的真实房间，座位和 `roomId` 与本地 `makeRoom` 不同，不能共用上面的第 4 回合房间。同机复测 2403，不当成逻辑优化 |
| `tests/server/g2-4b-artifact-forge-room.test.ts` | a resumed seat gets the same artifact choice and the unchanged deadline, and can still pick | 2566 | 60000 | 30000 | 5.886 | 同文件另四条已经把走到第 4 回合战斗放在 `beforeAll`（用例体 9–25 ms）。这条重连仍要自己打到第 4 回合。超时一半 30 s |
| `tests/server/v15-terminal-orbs.test.ts` | side A and the mirrored side B of a two-sided battle both carry the rules' statuses | 2371 | 20000 | 10000 | 5.423 | 真实 PvE 到首个 PvP，再核对双方状态。一条用例一条房间 |
| `tests/server/net/settlement-queue.test.ts` | accepts a last-second purchase on the pre-settlement revision and publishes the same private state | 未复测 | 60000 | 30000 | 5.284 | 点名跳过 `settlement-queue`。清单机低于一半 |
| `tests/server/combat-stream.test.ts` | round 5: measures final-tick and closing slices and audits every first-pass stream | 2165 | 60000 | 30000 | 5.218 | 计时的是切片回调本身，并且要抽查每一路首遍流。不能改成缓存终局 |
| `tests/server/mel-save-settlement-stream.test.ts` | keeps a rescued seat alive at 1 HP, preserves raw damage and commits the save exactly once | 1427 | 20000 | 10000 | 5.207 | 流式战斗不走 resolver 缓存。克隆双方战斗结果会丢掉死亡样本。清单机 5.2 s，一半是 10 s |
| `tests/server/v15-terminal-orbs.test.ts` | forfeits the winner's unclaimed orbs at the end (disconnected or not), with the events the rules numbered; eliminated seats get nothing new | 2121 | 20000 | 10000 | 5.125 | 真实打到终局再没收。发布路径上的规则没收就是断言 |
| `tests/server/mel-save-settlement.test.ts` | keeps a rescued seat alive at 1 HP, preserves raw damage and commits the save exactly once | 1805 | 20000 | 10000 | 5.112 | 九条非流式用例各打到第 4 回合。试过共享战斗缓存，结算读死亡样本失败，已撤回。一半是 10 s |
| `tests/server/net/settlement-queue.test.ts` | holds writers received after the first rebuild until commit and checks their original revisions then | 未复测 | 60000 | 30000 | 4.953 | 点名跳过。清单机低于一半 |
| `tests/t11-opening-xp.test.ts` | seed 20 eight-seat room reaches 2-1 with the same earned income before explicit orb claims | 3190 | 30000 | 15000 | 4.802 | 八席真实走到 2-1 后对收入。没有第二条相同房间可共享 |
| `tests/live-combat-inputs.test.ts` | seed 7: Quickstriker/Firelight/teamup bytes match full advance and small slices | 2547 | 60000 | 30000 | 4.759 | 整段推进和细切片的字节必须各自算出来再比 |
| `tests/server/v15-orb-claim.test.ts` | leaves the seat as it was and tells only that seat, once, with the rules' reason | 1837 | 20000 | 10000 | 4.670 | 真实冻结回合里的拒绝。一半 10 s |
| `tests/server/v15-orb-claim.test.ts` | is held without touching the frozen inputs and queued by the rules at battle entry | 2027 | 20000 | 10000 | 4.660 | 同上，`sliceTicks: 10` 的冻结路径要真发生 |
| `tests/server/mel-save-settlement.test.ts` | still eliminates lethal damage with fewer than twelve casts | 1808 | 20000 | 10000 | 4.495 | 同 Mel 非流式，缓存会破坏死亡样本 |
| `tests/server/mel-save-settlement-stream.test.ts` | still eliminates lethal damage with fewer than twelve casts | 1473 | 20000 | 10000 | 4.393 | 同流式 Mel |
| `tests/server/mel-save-settlement.test.ts` | still eliminates lethal damage with an already spent save | 1899 | 20000 | 10000 | 4.321 | 同 Mel 非流式 |
| `tests/server/mel-save-settlement-stream.test.ts` | still eliminates lethal damage with an already spent save | 1391 | 20000 | 10000 | 4.320 | 同流式 Mel |
| `tests/server/v15-terminal-orbs.test.ts` | a winner with every orb claimed is published unchanged at the end | 1854 | 20000 | 10000 | 4.277 | 另一条终局没收路径，棋盘状态和上一条不同 |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects lethal damage returning 1 HP with a missing playerSaved event | 1411 | 20000 | 10000 | 4.239 | 同流式 Mel |
| `tests/server/combat-stream.test.ts` | D11 gold samples feed the same first-pass task and remain replayable | 1955 | 60000 | 30000 | 4.431 | 走到第 5 回合战斗再核对金样本和回放。一条用例 |
| `tests/server/combat-stream.test.ts` | a stream exhausting its tick limit faults instead of fabricating a terminal or rewarding a seat | 2186 | 60000 | 30000 | 4.227 | 要真的把流打到 tick 上限。不能换成终局缓存 |
| `tests/server/mel-save-settlement.test.ts` | rejects edited damage even when Mel would save the seat | 1694 | 20000 | 10000 | 4.173 | 同 Mel 非流式 |
| `tests/server/mel-save-settlement.test.ts` | rejects lethal damage returning 1 HP with a duplicate playerSaved event | 1692 | 20000 | 10000 | 4.050 | 同 Mel 非流式 |
| `tests/server/mel-save-settlement.test.ts` | rejects lethal damage returning 1 HP with a wrong source playerSaved event | 1774 | 20000 | 10000 | 4.039 | 同 Mel 非流式 |
| `tests/server/mel-save-settlement.test.ts` | rejects lethal damage returning 1 HP with a missing playerSaved event | 1654 | 20000 | 10000 | 4.036 | 同 Mel 非流式 |
| `tests/live-combat-inputs.test.ts` | seed 42: Quickstriker/Firelight/teamup bytes match full advance and small slices | 1887 | 60000 | 30000 | 4.033 | 同 seed 7，种子不同不能共用 |
| `tests/server/mel-save-settlement.test.ts` | rejects lethal damage returning 1 HP with a wrong battleId playerSaved event | 1709 | 20000 | 10000 | 4.021 | 同 Mel 非流式 |
| `tests/server/mel-save-settlement.test.ts` | seed 42: streaming Mel rescue is byte-identical to full-round settlement (beforeTerminal=true) | 1537 | 60000 | 30000 | 4.000 | 流式与整回合结算的字节对照，两路都要真算 |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects lethal damage returning 1 HP with a wrong battleId playerSaved event | 1512 | 20000 | 10000 | 3.989 | 同流式 Mel |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects edited damage even when Mel would save the seat | 1600 | 20000 | 10000 | 3.977 | 同流式 Mel |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects a room/rules HP mismatch even when the rules return 1 HP | 1450 | 20000 | 10000 | 3.975 | 同流式 Mel |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects lethal damage returning 1 HP with a duplicate playerSaved event | 1398 | 20000 | 10000 | 3.974 | 同流式 Mel |
| `tests/server/mel-save-settlement.test.ts` | seed 42: streaming Mel rescue is byte-identical to full-round settlement (beforeTerminal=false) | 1638 | 60000 | 30000 | 3.968 | 同 beforeTerminal=true |
| `tests/m8-b7-match-wiring.test.ts` | 6-7 freezes, starts, runs to settlement and resumes canonical saves | 未复测 | 20000 | 10000 | 3.961 | 禁改。清单机低于一半 |
| `tests/server/mel-save-settlement-stream.test.ts` | rejects lethal damage returning 1 HP with a wrong source playerSaved event | 1423 | 20000 | 10000 | 3.902 | 同流式 Mel |
| `tests/server/mel-save-settlement.test.ts` | rejects a room/rules HP mismatch even when the rules return 1 HP | 1774 | 20000 | 10000 | 3.882 | 同 Mel 非流式 |
| `tests/server/v15-orb-claim.test.ts` | during my battle a claim is only queued (no resource moves) and the rules settle it with the round | 1542 | 20000 | 10000 | 3.752 | 真实打到战斗再索赔。一半 10 s |
| `tests/live-combat-inputs.test.ts` | seed 991: Quickstriker/Firelight/teamup bytes match full advance and small slices | 1713 | 60000 | 30000 | 3.344 | 同 seed 7 |
| `tests/server/v15-orb-claim.test.ts` | every bot seat claims all of its orbs at each preparation entry, outside its policy budget | 1460 | 20000 | 10000 | 2.772 | 机器人准备期索赔要逐轮真发生 |
| `tests/black-market-concrete-offers.test.ts` | preserves every old bundle selection and exact source frequencies across 80,000 market openings | 2132 | 30000 | 15000 | 2.753 | 8 万次开启就是用例。不能少次数 |
| `tests/server/mechanic-failed-push.test.ts` | pushes the failure with the own seat state only, and never in another seat's view | 2039 | 30000 | 15000 | 2.621 | 一条房间推送用例。一半 15 s |
| `tests/m8-b7-match-wiring.test.ts` | round-trips legal Herald item immunity/cleanup boundaries with quicksilver | 未复测 | 20000 | 10000 | 2.536 | 禁改。清单机低于一半 |

## 验证

改过的文件都用上面的单跑命令跑过，退出码 0：

- `tests/m5-match-integration.test.ts`
- `tests/m6-integration-sniper-caitlyn.test.ts`（经 `tests/m6-integration-helper.ts`）
- `tests/server/g2-4a-forge-timeout.test.ts`
- `tests/server/shared-pool-room.test.ts`（双方全场仍真实打；placeholder 读缓存）
- `tests/server/h12-subscription.test.ts`
- `tests/server/augment-pool-batch5-h6-room.test.ts`
- `tests/server/augment-tier-consistency.test.ts`
- `tests/server/mel-save-settlement-stream.test.ts`（助手签名恢复后仍过；非流式 Mel 缓存方案已撤回，改前那次单跑是绿的）

没有提高任何超时，没有删断言，没有关房间发布前的守恒检查和 `poolRevision` 校验。
