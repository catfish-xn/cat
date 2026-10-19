# S13 强化/异常批次：延到收口处理的种子路线失败

集成分支 `integration/s13-augments` 按"包一到就合、种子路线收口统一重录"合包（协调者 10-19 04:43 定，依据用户 03:46 第 2、6 条）。
每次合包时由集成串按 g2-4b 流程重录指纹（规则版本仍为 v12，不改期望）。下表只列重录指纹后仍失败、且原因是
"强化/异常池扩大后，固定种子的公开路线抽到不同的选项或走出不同的战斗"的测试。表外出现的新红灯不属于本清单，合包时当场修。

收口时先换种子保住原断言；必须改期望的条目汇总给协调者，由用户一次确认。收口 PR 进 multiplayer 时必须全绿。

共同原因：每个包都会把 `AUGMENT_DEFINITIONS` / `ANOMALY_DEFINITIONS` 扩大。选项生成按排序后的整池等权抽取，
池大小一变，同一种子下的报价、异常重掷次数、商店与战斗 RNG 消耗都会跟着变。规则数值本身没有改。

## P2 合入后（P2 头 57418b1，强化 44 个，异常 44 个）

| 测试 | 原期望 | 现结果 | 原因 |
| --- | --- | --- | --- |
| `tests/m8-b8-live-reveal.test.ts` › reveals four orb entries while two neutral sources die on the same tick… | 4-7 揭示 4 个宝珠，两个中立源在 tick 51 同时死亡（eventSeq 447/448） | 揭示 0 个；录制脚本里同批死亡移到 tick 59 | 法师路线（种子 42）抽到的强化变了，4-7 战斗过程不同 |
| `tests/m8-b8-live-reveal.test.ts` › earns only killed source rewards after an actual partial defeat with loris | 指定的部分阵亡记录 | 阵亡记录不同 | 同上 |
| `tests/restore-audit/cd-replay-facts.test.ts` › G-C06 binds the real absorption value… | 种子 4 的加农炮路线拿到"能量吸收"（power-absorption） | 拿到 `TFT13_GoopBuff_DramaticEntrance` | 异常池变大，路线的重掷预算内没再刷出能量吸收 |
| `tests/server/carousel-room.test.ts` › a seat eliminated at the first fight after a carousel… | 种子 42 的 s0 在 5-6 被淘汰 | 5-5 被淘汰 | 机器人选到的强化变了，对局走向不同；测试注释已写明内容变化会让这一行失败 |
| `tests/m8-b5-equipment-history.test.ts` › B5 audit R1: equipment roll level belongs to its round history | 公开装备路线走通 | 路线中途断言不成立 | 公开装备路线抽到的强化／商店变了 |
| `tests/m8-b5-grant-upgrade.test.ts` › chains to three stars, retaining one TG… | 购买后合成 `unit-40` 三星 | 仍是 4 个分散单位（`unit-37` 起） | 同上，商店出现的英雄变了 |
| `tests/m8-b5-grant-upgrade.test.ts` › returns unique conflicts and preserves permanent IDs… | 公开装备路线不经过异常选择 | 路线遇到异常选择而报错 | 同上 |

P2 CI（57418b1）的 test-and-build-tests 正好是这 7 条失败，浏览器、无头、计时等作业未见表外红灯。合入提交 de5ba28。

## P3 合入后（P2 + P3：强化 51 个，异常 51 个）

上一节的 G-C06 和两个 m8-b5 文件在此树上已通过。

P3 合包时另有两条按种子挑强化的测试，已在合并提交里换种子修好，断言未动：

- `tests/s13-augments-p2-choice.test.ts` › public Crown + Trifecta…：种子 82 改成 2734（2-1 出冕卫守护、3-2 出三重奏 II、赠送英雄仍为克格莫）。
- `tests/g2-augments-combat.test.ts` › climb-the-ladder-i…：种子 1 改成 11（报价含登梯 I，且战斗里触发死亡增益）。

重录指纹后仍失败的 28 条（替代上一节）：

| 测试 | 原期望 | 现结果 |
| --- | --- | --- |
| `tests/m8-b8-live-reveal.test.ts` › reveals four orb entries… | 揭示 4 个宝珠，tick 51 同批死亡 | 揭示 0 个 |
| `tests/m8-b8-live-reveal.test.ts` › partial defeat with loris | 指定阵亡记录 | 记录不同 |
| `tests/m8-b8-live-reveal.test.ts` › partial defeat with zyra | 指定阵亡记录 | 无阵亡记录 |
| `tests/m8-b8-live-economy.test.ts`（整个文件） | T13 公开前缀可走通 | 前缀选择命令被拒（`invalid-choice`） |
| `tests/m8-b8-live-growth.test.ts`（整个文件） | 路线达成成长条件 | 未达成（第 49 行） |
| `tests/m8-b8-live-capacity.test.ts` › two killed carriers… | 2 条掉落记录 | 4 条 |
| `tests/m8-b8-live-transfer.test.ts` › pins the real two paid Ezreals… | 异常为 mage-armor | slime-time |
| `tests/m8-b8-equipment-fixture.test.ts` › obtains components three and four… | 强化 manaflow-i + pumping-up-ii | lone-hero + pumping-up-ii |
| `tests/bracer-multikill-stacks.test.ts` › a holder-owned summon kills as itself… | 召唤物击杀记录 1 条 | 无 |
| `tests/task-mechanism-restore.test.ts` › a holder-owned summon kills as itself… | 召唤物击杀记录 1 条 | 无 |
| `tests/task-mechanism-restore.test.ts` › rejects forged Black Rose member cast counts… | 路线里有弗拉基米尔 | 没有 |
| `tests/chest-bracer-integration-trial.test.ts` › pins the natural grant… | 护臂 8 层 | 5 层 |
| `tests/chest-bracer-integration-trial.test.ts` › 三个检查点恢复（@469/@550/@551） | 检查点存在 | 检查点不存在（随上一条） |
| `tests/g2-3-lesser-shimmer-duplicator.test.ts` › renni / singed 两条 | 结算轮次 64 | 65 |
| `tests/g2-4b-resists-restore.test.ts` › restores crest shields after a chest… | tick 172 宝箱发石像鬼 | 发放记录与此不符 |
| `tests/g2-4b-trench-gold.test.ts` › real Trench copies… | 1 条金币掉落 | 0 条 |
| `tests/m5-growth.test.ts` › commits actual battle growth once… | 崔丝塔娜成长 > 0 | 0 |
| `tests/m8-b4-r3b-lifecycle.test.ts` › two equipment instances consume independently… | 护盾结束时剩余 0 | 520 |
| `tests/m8-b5-temporary.test.ts` › children contribute real stats… | 909 | 1337 |
| `tests/m8-b5-temporary.test.ts` › TG route group 0 / 2 / 3（3 条） | 每条路线都能绑定子装备 | 有路线绑定失败（第 250 行） |
| `tests/restore-audit/cd-replay-facts.test.ts` › G-C08 one-thousand-cuts / eagle-eye（2 条） | tick 118 / 91 有检查点 | 缺检查点 |
| `tests/server/carousel-room.test.ts` › a seat eliminated at the first fight after a carousel… | 5-6 淘汰 | 5-3 |
| `tests/server/g5-economy-preview.test.ts` › equals the settled incomeBreakdown… | 对局进入加时 | 没有加时轮 |
| `tests/server/projection-wire.test.ts` › runs a match past 6-7 into overtime-N… | 打到 6-7 后进入加时 | 对局在 6-7 之前结束 |

另外 `scripts/record-g2-4b-live-reveal.cjs` 的录制断言（同批死亡 tick 51）同样失败，`docs/evidence/g2-4b/live-reveal-audit.json` 暂未重录，收口时和 m8-b8-live-reveal 一起处理。

## P1 合入后（P1 + P2 + P3：强化 57 个，异常 52 个）

P1 合包时换种子修好、断言未动的：

- `tests/s13-augments-p2-choice.test.ts` › public Crown + Trifecta…：种子 2734 改成 182。
- 同文件 Trifecta 娜美：种子 14 改成 18（标题改为 "seed 18 Trifecta Nami"）。
- `tests/g2-augments-combat.test.ts` › climb-the-ladder-i…：种子 11 改成 28。
- `tests/fixtures/s13-p1-dual-commands.json.gz` 重录。

合包时当场修的表外问题（不是种子路线）：P3 穿刺莲花（piercing-lotus）恢复校验误拒。
后一次暴击刷新同一状态时，`status.ts` 保留 `appliedAtTick`、把到期改为该次命中 + 60；
原校验要求到期必须等于 `appliedAtTick + 60`，种子 42 在 tick 138 读档被拒（applied 103、到期 198）。
`src/simulation/m8/restore.ts` 改为接受到期在 `applied + 60` 到 `tick + 60` 之间，并要求刷新时触发次数至少 2。没有放宽其他条件。

P3 表中以下条目在此树上已通过：chest-bracer 三个检查点恢复、g2-4b-resists-restore、m5-growth、
m8-b4-r3b、m8-b8-live-capacity、m8-b8-live-growth、task-mechanism-restore › Black Rose。其余 P3 条目仍失败。另外新增的 22 条：

| 测试 | 原期望 | 现结果 |
| --- | --- | --- |
| `tests/bracer-multikill-stacks.test.ts` › Lux 层数 | 143 | 140 |
| `tests/bracer-multikill-stacks.test.ts` › dead holder | 指定阵亡持有者记录 | 记录不同 |
| `tests/bracer-multikill-stacks.test.ts` › contribution 来源 | `combat` | `settlement` |
| `tests/chest-bracer-integration-trial.test.ts` › rejects in-place grant edit（2 条） | 宝箱发 archangel | 发 warmog |
| `tests/explorer-bracer-restore.test.ts`（2 条） | 410 | 340 |
| `tests/g2-4b-pr161-restore.test.ts` › tier4 | 征服者第 4 档路线 | 路线不同 |
| `tests/m8-b5-grant-upgrade.test.ts` › returns unique conflicts… | 不经过异常选择 | 遇到异常选择 |
| `tests/m8-b5-temporary.test.ts` › TG route group 1 / 4（2 条） | 能绑定子装备 | 绑定失败 |
| `tests/m8-b8-combat-input.test.ts` | 指定战斗输入 | 不同 |
| `tests/restore-audit/bounds-preflight.test.ts` | 400 | 360 |
| `tests/restore-audit/cd-replay-facts.test.ts` › G-C08 rejects invented Experiment | 指定拒绝原因 | 另一条校验先触发 |
| `tests/server/carousel-room.test.ts` › P7-1（4 条） | 座位 [9,5]、持有槽有单位 | [9,4]、持有槽为空 |
| `tests/server/room.test.ts` › choice window | 选完 offers[0] 后离开 choice | 又开锻造器选择，仍在 choice |
| `tests/server/t10-combat-ops.test.ts` › deferred merge | 延迟合成发生 | 未发生 |
| `tests/task-mechanism-restore.test.ts`（2 条） | contribution 为 combat；杰斯复活 | settlement；未复活 |

全部 22 条判断为种子路线变化（推断：报价、商店或战斗走向不同），收口时逐条核实。

计时类（R2，不挡合并）：`tests/t12-combat-equip.test.ts` › T12 supply choice 在一次本地全套里 5656 ms，超过默认 5 秒；
`m6-performance` capture p95 546.7（门槛 50），本地 4 核并发跑全套时出现。

## v13 收口（P1–P4 + multiplayer `bc49cac`）

升 v13 并按 MIGRATION.md 重录 G2-4b 证据后，全套 41 条失败与 P1 节相同，没有新增。处理结果：

- 39 条只改路线输入修好，断言未动。改法是换种子，或让路线跳过会额外发装备、开锻造器的强化。逐条见各测试提交：
  - m8-b5 / g2-3 / g2-4b / cd-replay：`e0a4b485`
  - 服务器 5 个文件：`7d51beb9`
  - 护臂与任务机制：`0e428c6f`、`6febce7e`
  - m8-b8：`a35e8c35`、`df33cd94`、`a5b3db50`、`a09988b8`
- 2 条换种子保不住原期望，用户 10-19 07:49 确认按现值改期望（提交 dfd2b4af）：
  - `tests/m8-b8-live-transfer.test.ts`：异常 mage-armor → slime-time。原值要重掷 133 次（133 金），路线只有 32 金。
  - `tests/m8-b8-live-reveal.test.ts` 同 tick 双死亡：tick 51 → 44，eventSeq 447/448 → 382/383。所需强化在 v13 下刷不出；60 个保留原强化的候选种子里 eventSeq 最高约 310。同 tick 双死亡和四个掉落归属不变。
