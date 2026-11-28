# v26 异变合并：完整相关集合与逐项剩余漂移

范围：R1/R3/R4a/R5/待选禁售，HEAD基线0369ee6b，合入R5来源761871a9。只编辑工作区，不写Git元数据。

最终按文件去重：**159文件，139文件全过，17,737项通过、315项断言失败，另1文件收集失败**。失败文件共20个；全部剩余项逐个标为“纯身份/纪元漂移”，连带失败与未执行场景明确列出，不计作通过。

所有Vitest运行均使用 `--maxWorkers=4 --configLoader runner --cache=false`。fast原集合149文件；补充8个新文件和选择用例复测；反向替换审计4项与t10修订复测；炮手回放另走项目原timing分组。临时后端配置仅移除浏览器globalSetup，保留原worker setup、sequencer与时限；未提高任何timeout/阈值，未使用--write。

原完整SHA、golden、旧存档断言均保留；t10的旧操作版本字面量改为已批准的v26策略，并新增待选禁售策略精确断言，10项复测全过。

## 已修复并实际通过

| 检查 | 结果 |
| --- | --- |
| 贪欲 frozen-end 路线 | 1,921项通过；真实s3/s4、tick222，offset=0/1/40，推进前后4-6/battle和所有原资源/结算断言保留 |
| carousel-room | 20项通过；s0死于5-5，最近选秀5-4，fightsSinceCarousel=1，最新持有物、实扣血和卡池守恒断言通过 |
| v26-anomaly-choice / R5 / m5-audit-boundaries | 16 / 15 / 21项全部通过；统一资格、禁售、超时、真实卖后恢复与伪造旧绑定拒绝 |
| v26-anomaly-identity-audit | 4项通过；仅版本/摘要反向替换与移除新增null资格字段，精确恢复pre-Spoils全文、四份无历史SHA、首战全文SHA与完整事件、Void Swarm全文SHA；不替换原严格失败测试 |
| m8-b6-match-wiring | 18项通过；6-5/6-6/6-7恢复约3.0/3.5/3.5秒，原20秒时限不变 |
| bench-timing.json | 实际运行后恢复HEAD原字节；SHA-256=41ef6b4235c364ff02d724d186044b833957a0c5acec9383842f4a151b6793c6 |
| 已发布T13 oracle | 原字节已还原；SHA-256=0b11a6cc60f3d31e59553d5121acb8a1fdc22ce3c6091ae3065ff0f8c35ad6ca，t13-golden锁通过 |

## 剩余失败：逐文件概览

| 文件 | 断言失败 | 分类与核实依据 |
| --- | ---: | --- |
| `scripts/tests/production-size.test.ts` | 1 | **纯身份/纪元漂移**；压缩领域包的实时内容根038b00ca/战利品根9af7b4d0与旧硬编码f671ab88/36ebfac2不符；保留历史锚点，当前常量--check通过。 |
| `tests/augment-history.test.ts` | 2 | **纯身份/纪元漂移**；旧 v24 哈希的归一化只识别 v25；v26 版本和新增 null 资格字段仍进入完整字节。独立 v26-anomaly-identity-audit 的四存档与完整战斗/事件反向替换均逐字/逐哈希恢复原证据。 |
| `tests/augment-pool-batch3-progress.test.ts` | 2 | **纯身份/纪元漂移**；pre-spoils-v25 原文保留；独立反向替换仅版本/摘要及删除新 null 字段即恢复原全文，无数值或资源差异。 |
| `tests/augment-pool-batch5-g4-swarm.test.ts` | 1 | **纯身份/纪元漂移**；旧完整序列化 SHA 保留；独立反向替换恢复 8dedd866… 原完整 SHA，未改玩法字节。 |
| `tests/d11-wiring-bank.test.ts` | 1 | **纯身份/纪元漂移**；实时 CONTENT_DIGEST=038b00ca 与旧 f671ab88 锚点不符；原 bank/ledger 检查保留。 |
| `tests/d14-anomalies-source.test.ts` | 1 | **纯身份/纪元漂移**；当前内容根变为038b00ca，原 current-baseline 锚点 f671ab88 保留。 |
| `tests/epic-loot-reforger.test.ts` | 3 | **纯身份/纪元漂移**；两份旧5-7/6-7档被 unsupported-version 拒绝，一项仍要求旧 v25 rulesVersion；不迁移旧档。 |
| `tests/m5-route.test.ts` | 4 | **纯身份/纪元漂移**；四条真实路线先命中 v25 golden rulesVersion 门禁；后续旧命令/状态/事件指纹应另用 v26 录制，当前门禁后的断言不能计为通过。 |
| `tests/m6-integration-mage.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration-sniper.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration.test.ts` | 3 | **纯身份/纪元漂移**；主例在 assertGolden(route) 的旧 rulesVersion 处停止，尚未赋值 cannonTransition/fullEnvelopes；另外两项分别因 undefined/缺失封套连带失败，不是通过了后续机制检查。 |
| `tests/m6-playback-checkpoints.test.ts` | 3 | **纯身份/纪元漂移**；旧 B9 战斗档案版本在入口拒绝；一项预期事件篡改错误也因此先得到不支持版本，保留原鉴权断言。 |
| `tests/m8-b7-match-wiring.test.ts` | 5 | **纯身份/纪元漂移**；5个 Herald 公共路线输入仍为旧身份，在 unsupported-version 入口拒绝；其余25项通过。 |
| `tests/m8-b8-live-transfer.test.ts` | 收集失败 | **纯身份/纪元漂移**；旧 v25 transfer anchor 在模块收集时比较 f671ab88，当前为038b00ca，整文件后续场景未收集。更新统一 v26 锚点后，还须另核唯一 anomaly-selected 事实导致的长度88→89，当前不计为通过。 |
| `tests/m8-content-equivalence.test.ts` | 134 | **纯身份/纪元漂移**；134份旧 v25 checkpoint 入口 unsupported-version，其他4项通过。须另录新纪元并切换 loader，不改历史文件。 |
| `tests/match-contract.test.ts` | 1 | **纯身份/纪元漂移**；Match 初始契约仍硬编码旧 v25 rules/content 身份；外层12/8/8/7不变。 |
| `tests/opening-random-identity.test.ts` | 136 | **纯身份/纪元漂移**；1项旧内容根、134份旧 checkpoint 准入、1项含完整 Match 元数据的首战状态序列 SHA。该首战 ticks/完整事件/战斗体哈希断言在序列 SHA 之前已通过；独立反向替换审计也通过，未改首战数值。 |
| `tests/server/battle-start-slices.test.ts` | 11 | **纯身份/纪元漂移**；11项直接注入旧 battle-start.json（round3/9/23均v25、f671ab88且无anomalySelection）：命中 invalid-seat-state / battle-validation:content-digest，导致阶段、延迟队列、第二次故障注入和预算切片数连带失败。新建当前身份房间的第一项通过；不能把旧夹具连带失败说成计时断言已通过。 |
| `tests/v19-part2.test.ts` | 1 | **纯身份/纪元漂移**；仍要求 rulesVersion=v25，当前统一为v26；schema/save/replay仍12/8/8。 |

## 每一项失败

### scripts/tests/production-size.test.ts

压缩领域包的实时内容根038b00ca/战利品根9af7b4d0与旧硬编码f671ab88/36ebfac2不符；保留历史锚点，当前常量--check通过。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 1 | production representation preserves runtime semantics preserves complete content/loot digests, seeded matches, events, RNG and restore in a minified domain bundle | `scripts/tests/production-size.test.ts:109` | **纯身份/纪元漂移** |

### tests/augment-history.test.ts

旧 v24 哈希的归一化只识别 v25；v26 版本和新增 null 资格字段仍进入完整字节。独立 v26-anomaly-identity-audit 的四存档与完整战斗/事件反向替换均逐字/逐哈希恢复原证据。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 2 | keeps four no-owner saves identical to HEAD ee2b019c after identity normalization (independent baseline SHA-256) | `tests/augment-history.test.ts:91` | **纯身份/纪元漂移** |
| 3 | keeps the real battle ledger and terminal save identical to the independent baseline after identity normalization | `tests/augment-history.test.ts:449` | **纯身份/纪元漂移** |

### tests/augment-pool-batch3-progress.test.ts

pre-spoils-v25 原文保留；独立反向替换仅版本/摘要及删除新 null 字段即恢复原全文，无数值或资源差异。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 4 | pre-Spoils baseline bytes restore and continue round 1 with full history | `tests/augment-pool-batch3-progress.test.ts:141` | **纯身份/纪元漂移** |
| 5 | pre-Spoils baseline bytes restore and continue round 2 with full history | `tests/augment-pool-batch3-progress.test.ts:141` | **纯身份/纪元漂移** |

### tests/augment-pool-batch5-g4-swarm.test.ts

旧完整序列化 SHA 保留；独立反向替换恢复 8dedd866… 原完整 SHA，未改玩法字节。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 6 | B5-73 solo running combat preserves the exact pre-fix history order and save bytes | `tests/augment-pool-batch5-g4-swarm.test.ts:47` | **纯身份/纪元漂移** |

### tests/d11-wiring-bank.test.ts

实时 CONTENT_DIGEST=038b00ca 与旧 f671ab88 锚点不符；原 bank/ledger 检查保留。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 7 | a resumable online task consumes live bank samples, replays the exact same ledger and keeps bank values private | `tests/d11-wiring-bank.test.ts:37` | **纯身份/纪元漂移** |

### tests/d14-anomalies-source.test.ts

当前内容根变为038b00ca，原 current-baseline 锚点 f671ab88 保留。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 8 | retains the two D14 anomalies in the current epoch without overwriting source values | `tests/d14-anomalies-source.test.ts:58` | **纯身份/纪元漂移** |

### tests/epic-loot-reforger.test.ts

两份旧5-7/6-7档被 unsupported-version 拒绝，一项仍要求旧 v25 rulesVersion；不迁移旧档。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 9 | v17 epic rewards and unified consumables a real 5-7 command path restores new forge receipts and never repeats the rewards | `tests/epic-loot-reforger.test.ts` | **纯身份/纪元漂移** |
| 10 | v17 epic rewards and unified consumables the real 6-7 terminal keeps full-bench heroes retained-terminal while completing forge fallback once | `tests/epic-loot-reforger.test.ts` | **纯身份/纪元漂移** |
| 11 | v17 epic rewards and unified consumables uses exact approved zh_cn names and rejects prior-epoch state identities without migration | `tests/epic-loot-reforger.test.ts:300` | **纯身份/纪元漂移** |

### tests/m5-route.test.ts

四条真实路线先命中 v25 golden rulesVersion 门禁；后续旧命令/状态/事件指纹应另用 v26 录制，当前门禁后的断言不能计为通过。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 12 | M5 ordinary three-build routes and independent resource ledger sniper-caitlyn normally buys five-cost Caitlyn and fields her for at least two real battles | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 13 | M5 ordinary three-build routes and independent resource ledger cannon cannon: ordinary purchases/rewards to 6-7 with a complete build | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 14 | M5 ordinary three-build routes and independent resource ledger sniper sniper: ordinary purchases/rewards to 6-7 with a complete build | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 15 | M5 ordinary three-build routes and independent resource ledger mage mage: ordinary purchases/rewards to 6-7 with a complete build | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |

### tests/m6-integration-mage.test.ts

主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 16 | M6 independent route/history/playback/session integration mage: every completed battle has exact original state/events and isolated playback | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 17 | M6 independent route/history/playback/session integration mage: full catalog-capacity envelope acceptance (B9) | `tests/m6-integration-helper.ts:129` | **纯身份/纪元漂移**（前置失败连带） |

### tests/m6-integration-sniper-caitlyn.test.ts

主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 18 | M6 independent route/history/playback/session integration sniper-caitlyn: every completed battle has exact original state/events and isolated playback | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 19 | M6 independent route/history/playback/session integration sniper-caitlyn: full catalog-capacity envelope acceptance (B9) | `tests/m6-integration-helper.ts:129` | **纯身份/纪元漂移**（前置失败连带） |

### tests/m6-integration-sniper.test.ts

主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 20 | M6 independent route/history/playback/session integration sniper: every completed battle has exact original state/events and isolated playback | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 21 | M6 independent route/history/playback/session integration sniper: full catalog-capacity envelope acceptance (B9) | `tests/m6-integration-helper.ts:129` | **纯身份/纪元漂移**（前置失败连带） |

### tests/m6-integration.test.ts

主例在 assertGolden(route) 的旧 rulesVersion 处停止，尚未赋值 cannonTransition/fullEnvelopes；另外两项分别因 undefined/缺失封套连带失败，不是通过了后续机制检查。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 22 | M6 independent route/history/playback/session integration cannon: every completed battle has exact original state/events and isolated playback | `tests/fixtures/m5/assert-golden.cjs:3` | **纯身份/纪元漂移** |
| 23 | M6 independent route/history/playback/session integration [B8] cannon: completed history retains sold opening transition units | `tests/m6-integration-helper.ts:123` | **纯身份/纪元漂移**（前置失败连带） |
| 24 | M6 independent route/history/playback/session integration cannon: full catalog-capacity envelope acceptance (B9) | `tests/m6-integration-helper.ts:129` | **纯身份/纪元漂移**（前置失败连带） |

### tests/m6-playback-checkpoints.test.ts

旧 B9 战斗档案版本在入口拒绝；一项预期事件篡改错误也因此先得到不支持版本，保留原鉴权断言。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 25 | validated playback checkpoints preserve the unoptimized trajectory keeps every frame, terminal, ledger and record byte-identical on the B9 fixture | `tests/m6-playback-checkpoints.test.ts:63` | **纯身份/纪元漂移** |
| 26 | validated playback checkpoints preserve the unoptimized trajectory still performs complete event/hash/result validation and never trusts external freezing | `tests/m6-playback-checkpoints.test.ts:108` | **纯身份/纪元漂移** |
| 27 | validated playback checkpoints preserve the unoptimized trajectory preserves native byte order for a canonically valid reordered opening | `tests/m6-playback-checkpoints.test.ts:118` | **纯身份/纪元漂移** |

### tests/m8-b7-match-wiring.test.ts

5个 Herald 公共路线输入仍为旧身份，在 unsupported-version 入口拒绝；其余25项通过。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 28 | B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | `tests/m8-b7-match-wiring.test.ts` | **纯身份/纪元漂移** |
| 29 | B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "evenshroud" | `tests/m8-b7-match-wiring.test.ts` | **纯身份/纪元漂移** |
| 30 | B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | `tests/m8-b7-match-wiring.test.ts` | **纯身份/纪元漂移** |
| 31 | B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with quicksilver | `tests/m8-b7-match-wiring.test.ts` | **纯身份/纪元漂移** |
| 32 | B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with edge-of-night | `tests/m8-b7-match-wiring.test.ts` | **纯身份/纪元漂移** |

### tests/m8-b8-live-transfer.test.ts

旧 v25 transfer anchor 在模块收集时比较 f671ab88，当前为038b00ca，整文件后续场景未收集。更新统一 v26 锚点后，还须另核唯一 anomaly-selected 事实导致的长度88→89，当前不计为通过。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| — | 模块旧内容摘要锚点，未收集后续用例 | `tests/m8-b8-live-transfer.test.ts:17` | **纯身份/纪元漂移**（收集失败） |

### tests/m8-content-equivalence.test.ts

134份旧 v25 checkpoint 入口 unsupported-version，其他4项通过。须另录新纪元并切换 loader，不改历史文件。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 33 | restoreMatch text fast path is exact recorded cannon state 0: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 34 | restoreMatch text fast path is exact recorded cannon state 1: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 35 | restoreMatch text fast path is exact recorded cannon state 2: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 36 | restoreMatch text fast path is exact recorded cannon state 3: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 37 | restoreMatch text fast path is exact recorded cannon state 4: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 38 | restoreMatch text fast path is exact recorded cannon state 5: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 39 | restoreMatch text fast path is exact recorded cannon state 6: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 40 | restoreMatch text fast path is exact recorded cannon state 7: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 41 | restoreMatch text fast path is exact recorded cannon state 8: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 42 | restoreMatch text fast path is exact recorded cannon state 9: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 43 | restoreMatch text fast path is exact recorded cannon state 10: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 44 | restoreMatch text fast path is exact recorded cannon state 11: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 45 | restoreMatch text fast path is exact recorded cannon state 12: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 46 | restoreMatch text fast path is exact recorded cannon state 13: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 47 | restoreMatch text fast path is exact recorded cannon state 14: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 48 | restoreMatch text fast path is exact recorded cannon state 15: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 49 | restoreMatch text fast path is exact recorded cannon state 16: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 50 | restoreMatch text fast path is exact recorded cannon state 17: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 51 | restoreMatch text fast path is exact recorded cannon state 18: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 52 | restoreMatch text fast path is exact recorded cannon state 19: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 53 | restoreMatch text fast path is exact recorded cannon state 20: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 54 | restoreMatch text fast path is exact recorded cannon state 21: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 55 | restoreMatch text fast path is exact recorded cannon state 22: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 56 | restoreMatch text fast path is exact recorded cannon state 23: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 57 | restoreMatch text fast path is exact recorded cannon state 24: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 58 | restoreMatch text fast path is exact recorded cannon state 25: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 59 | restoreMatch text fast path is exact recorded cannon state 26: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 60 | restoreMatch text fast path is exact recorded cannon state 27: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 61 | restoreMatch text fast path is exact recorded cannon state 28: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 62 | restoreMatch text fast path is exact recorded cannon state 29: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 63 | restoreMatch text fast path is exact recorded cannon state 30: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 64 | restoreMatch text fast path is exact recorded cannon state 31: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 65 | restoreMatch text fast path is exact recorded cannon state 32: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 66 | restoreMatch text fast path is exact recorded cannon state 33: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 67 | restoreMatch text fast path is exact recorded cannon state 34: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 68 | restoreMatch text fast path is exact recorded cannon state 35: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 69 | restoreMatch text fast path is exact recorded cannon state 36: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 70 | restoreMatch text fast path is exact recorded cannon state 37: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 71 | restoreMatch text fast path is exact recorded cannon state 38: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 72 | restoreMatch text fast path is exact recorded cannon state 39: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 73 | restoreMatch text fast path is exact recorded cannon state 40: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 74 | restoreMatch text fast path is exact recorded cannon state 41: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 75 | restoreMatch text fast path is exact recorded cannon state 42: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 76 | restoreMatch text fast path is exact recorded cannon state 43: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 77 | restoreMatch text fast path is exact recorded cannon state 44: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 78 | restoreMatch text fast path is exact recorded cannon state 45: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 79 | restoreMatch text fast path is exact recorded cannon state 46: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 80 | restoreMatch text fast path is exact recorded cannon state 47: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 81 | restoreMatch text fast path is exact recorded cannon state 48: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 82 | restoreMatch text fast path is exact recorded cannon state 49: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 83 | restoreMatch text fast path is exact recorded cannon state 50: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 84 | restoreMatch text fast path is exact recorded cannon state 51: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 85 | restoreMatch text fast path is exact recorded cannon state 52: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 86 | restoreMatch text fast path is exact recorded cannon state 53: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 87 | restoreMatch text fast path is exact recorded cannon state 54: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 88 | restoreMatch text fast path is exact recorded cannon state 55: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 89 | restoreMatch text fast path is exact recorded cannon state 56: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 90 | restoreMatch text fast path is exact recorded cannon state 57: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 91 | restoreMatch text fast path is exact recorded cannon state 58: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 92 | restoreMatch text fast path is exact recorded cannon state 59: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 93 | restoreMatch text fast path is exact recorded cannon state 60: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 94 | restoreMatch text fast path is exact recorded cannon state 61: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 95 | restoreMatch text fast path is exact recorded cannon state 62: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 96 | restoreMatch text fast path is exact recorded cannon state 63: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 97 | restoreMatch text fast path is exact recorded cannon state 64: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 98 | restoreMatch text fast path is exact recorded cannon state 65: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 99 | restoreMatch text fast path is exact recorded cannon state 66: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 100 | restoreMatch text fast path is exact recorded sniper state 0: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 101 | restoreMatch text fast path is exact recorded sniper state 1: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 102 | restoreMatch text fast path is exact recorded sniper state 2: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 103 | restoreMatch text fast path is exact recorded sniper state 3: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 104 | restoreMatch text fast path is exact recorded sniper state 4: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 105 | restoreMatch text fast path is exact recorded sniper state 5: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 106 | restoreMatch text fast path is exact recorded sniper state 6: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 107 | restoreMatch text fast path is exact recorded sniper state 7: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 108 | restoreMatch text fast path is exact recorded sniper state 8: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 109 | restoreMatch text fast path is exact recorded sniper state 9: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 110 | restoreMatch text fast path is exact recorded sniper state 10: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 111 | restoreMatch text fast path is exact recorded sniper state 11: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 112 | restoreMatch text fast path is exact recorded sniper state 12: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 113 | restoreMatch text fast path is exact recorded sniper state 13: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 114 | restoreMatch text fast path is exact recorded sniper state 14: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 115 | restoreMatch text fast path is exact recorded sniper state 15: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 116 | restoreMatch text fast path is exact recorded sniper state 16: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 117 | restoreMatch text fast path is exact recorded sniper state 17: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 118 | restoreMatch text fast path is exact recorded sniper state 18: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 119 | restoreMatch text fast path is exact recorded sniper state 19: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 120 | restoreMatch text fast path is exact recorded sniper state 20: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 121 | restoreMatch text fast path is exact recorded sniper state 21: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 122 | restoreMatch text fast path is exact recorded sniper state 22: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 123 | restoreMatch text fast path is exact recorded sniper state 23: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 124 | restoreMatch text fast path is exact recorded sniper state 24: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 125 | restoreMatch text fast path is exact recorded sniper state 25: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 126 | restoreMatch text fast path is exact recorded sniper state 26: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 127 | restoreMatch text fast path is exact recorded sniper state 27: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 128 | restoreMatch text fast path is exact recorded sniper state 28: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 129 | restoreMatch text fast path is exact recorded sniper state 29: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 130 | restoreMatch text fast path is exact recorded sniper state 30: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 131 | restoreMatch text fast path is exact recorded sniper state 31: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 132 | restoreMatch text fast path is exact recorded sniper state 32: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 133 | restoreMatch text fast path is exact recorded sniper state 33: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 134 | restoreMatch text fast path is exact recorded sniper state 34: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 135 | restoreMatch text fast path is exact recorded sniper state 35: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 136 | restoreMatch text fast path is exact recorded sniper state 36: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 137 | restoreMatch text fast path is exact recorded sniper state 37: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 138 | restoreMatch text fast path is exact recorded sniper state 38: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 139 | restoreMatch text fast path is exact recorded sniper state 39: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 140 | restoreMatch text fast path is exact recorded sniper state 40: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 141 | restoreMatch text fast path is exact recorded sniper state 41: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 142 | restoreMatch text fast path is exact recorded sniper state 42: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 143 | restoreMatch text fast path is exact recorded sniper state 43: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 144 | restoreMatch text fast path is exact recorded sniper state 44: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 145 | restoreMatch text fast path is exact recorded sniper state 45: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 146 | restoreMatch text fast path is exact recorded sniper state 46: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 147 | restoreMatch text fast path is exact recorded sniper state 47: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 148 | restoreMatch text fast path is exact recorded sniper state 48: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 149 | restoreMatch text fast path is exact recorded sniper state 49: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 150 | restoreMatch text fast path is exact recorded sniper state 50: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 151 | restoreMatch text fast path is exact recorded sniper state 51: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 152 | restoreMatch text fast path is exact recorded sniper state 52: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 153 | restoreMatch text fast path is exact recorded sniper state 53: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 154 | restoreMatch text fast path is exact recorded sniper state 54: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 155 | restoreMatch text fast path is exact recorded sniper state 55: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 156 | restoreMatch text fast path is exact recorded sniper state 56: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 157 | restoreMatch text fast path is exact recorded sniper state 57: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 158 | restoreMatch text fast path is exact recorded sniper state 58: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 159 | restoreMatch text fast path is exact recorded sniper state 59: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 160 | restoreMatch text fast path is exact recorded sniper state 60: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 161 | restoreMatch text fast path is exact recorded sniper state 61: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 162 | restoreMatch text fast path is exact recorded sniper state 62: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 163 | restoreMatch text fast path is exact recorded sniper state 63: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 164 | restoreMatch text fast path is exact recorded sniper state 64: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 165 | restoreMatch text fast path is exact recorded sniper state 65: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |
| 166 | restoreMatch text fast path is exact recorded sniper state 66: restore from text equals restore from the parsed object | `tests/m8-content-equivalence.test.ts` | **纯身份/纪元漂移** |

### tests/match-contract.test.ts

Match 初始契约仍硬编码旧 v25 rules/content 身份；外层12/8/8/7不变。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 167 | M5 public contract (M4 command invariants retained) starts with versioned independent streams, public single-hero roster and immediate preparation | `tests/match-contract.test.ts:13` | **纯身份/纪元漂移** |

### tests/opening-random-identity.test.ts

1项旧内容根、134份旧 checkpoint 准入、1项含完整 Match 元数据的首战状态序列 SHA。该首战 ticks/完整事件/战斗体哈希断言在序列 SHA 之前已通过；独立反向替换审计也通过，未改首战数值。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 168 | binds v25-online-rules to fresh public rules and preserved v24-online-rules byte evidence | `tests/opening-random-identity.test.ts:774` | **纯身份/纪元漂移** |
| 169 | cannon: checkpoint 0 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 170 | cannon: checkpoint 1 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 171 | cannon: checkpoint 2 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 172 | cannon: checkpoint 3 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 173 | cannon: checkpoint 4 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 174 | cannon: checkpoint 5 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 175 | cannon: checkpoint 6 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 176 | cannon: checkpoint 7 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 177 | cannon: checkpoint 8 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 178 | cannon: checkpoint 9 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 179 | cannon: checkpoint 10 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 180 | cannon: checkpoint 11 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 181 | cannon: checkpoint 12 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 182 | cannon: checkpoint 13 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 183 | cannon: checkpoint 14 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 184 | cannon: checkpoint 15 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 185 | cannon: checkpoint 16 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 186 | cannon: checkpoint 17 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 187 | cannon: checkpoint 18 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 188 | cannon: checkpoint 19 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 189 | cannon: checkpoint 20 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 190 | cannon: checkpoint 21 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 191 | cannon: checkpoint 22 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 192 | cannon: checkpoint 23 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 193 | cannon: checkpoint 24 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 194 | cannon: checkpoint 25 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 195 | cannon: checkpoint 26 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 196 | cannon: checkpoint 27 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 197 | cannon: checkpoint 28 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 198 | cannon: checkpoint 29 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 199 | cannon: checkpoint 30 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 200 | cannon: checkpoint 31 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 201 | cannon: checkpoint 32 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 202 | cannon: checkpoint 33 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 203 | cannon: checkpoint 34 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 204 | cannon: checkpoint 35 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 205 | cannon: checkpoint 36 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 206 | cannon: checkpoint 37 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 207 | cannon: checkpoint 38 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 208 | cannon: checkpoint 39 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 209 | cannon: checkpoint 40 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 210 | cannon: checkpoint 41 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 211 | cannon: checkpoint 42 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 212 | cannon: checkpoint 43 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 213 | cannon: checkpoint 44 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 214 | cannon: checkpoint 45 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 215 | cannon: checkpoint 46 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 216 | cannon: checkpoint 47 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 217 | cannon: checkpoint 48 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 218 | cannon: checkpoint 49 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 219 | cannon: checkpoint 50 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 220 | cannon: checkpoint 51 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 221 | cannon: checkpoint 52 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 222 | cannon: checkpoint 53 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 223 | cannon: checkpoint 54 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 224 | cannon: checkpoint 55 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 225 | cannon: checkpoint 56 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 226 | cannon: checkpoint 57 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 227 | cannon: checkpoint 58 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 228 | cannon: checkpoint 59 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 229 | cannon: checkpoint 60 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 230 | cannon: checkpoint 61 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 231 | cannon: checkpoint 62 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 232 | cannon: checkpoint 63 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 233 | cannon: checkpoint 64 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 234 | cannon: checkpoint 65 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 235 | cannon: checkpoint 66 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 236 | sniper: checkpoint 0 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 237 | sniper: checkpoint 1 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 238 | sniper: checkpoint 2 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 239 | sniper: checkpoint 3 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 240 | sniper: checkpoint 4 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 241 | sniper: checkpoint 5 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 242 | sniper: checkpoint 6 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 243 | sniper: checkpoint 7 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 244 | sniper: checkpoint 8 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 245 | sniper: checkpoint 9 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 246 | sniper: checkpoint 10 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 247 | sniper: checkpoint 11 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 248 | sniper: checkpoint 12 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 249 | sniper: checkpoint 13 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 250 | sniper: checkpoint 14 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 251 | sniper: checkpoint 15 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 252 | sniper: checkpoint 16 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 253 | sniper: checkpoint 17 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 254 | sniper: checkpoint 18 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 255 | sniper: checkpoint 19 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 256 | sniper: checkpoint 20 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 257 | sniper: checkpoint 21 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 258 | sniper: checkpoint 22 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 259 | sniper: checkpoint 23 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 260 | sniper: checkpoint 24 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 261 | sniper: checkpoint 25 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 262 | sniper: checkpoint 26 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 263 | sniper: checkpoint 27 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 264 | sniper: checkpoint 28 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 265 | sniper: checkpoint 29 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 266 | sniper: checkpoint 30 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 267 | sniper: checkpoint 31 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 268 | sniper: checkpoint 32 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 269 | sniper: checkpoint 33 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 270 | sniper: checkpoint 34 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 271 | sniper: checkpoint 35 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 272 | sniper: checkpoint 36 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 273 | sniper: checkpoint 37 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 274 | sniper: checkpoint 38 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 275 | sniper: checkpoint 39 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 276 | sniper: checkpoint 40 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 277 | sniper: checkpoint 41 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 278 | sniper: checkpoint 42 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 279 | sniper: checkpoint 43 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 280 | sniper: checkpoint 44 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 281 | sniper: checkpoint 45 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 282 | sniper: checkpoint 46 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 283 | sniper: checkpoint 47 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 284 | sniper: checkpoint 48 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 285 | sniper: checkpoint 49 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 286 | sniper: checkpoint 50 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 287 | sniper: checkpoint 51 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 288 | sniper: checkpoint 52 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 289 | sniper: checkpoint 53 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 290 | sniper: checkpoint 54 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 291 | sniper: checkpoint 55 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 292 | sniper: checkpoint 56 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 293 | sniper: checkpoint 57 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 294 | sniper: checkpoint 58 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 295 | sniper: checkpoint 59 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 296 | sniper: checkpoint 60 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 297 | sniper: checkpoint 61 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 298 | sniper: checkpoint 62 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 299 | sniper: checkpoint 63 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 300 | sniper: checkpoint 64 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 301 | sniper: checkpoint 65 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 302 | sniper: checkpoint 66 survives strict text/object restore | `tests/opening-random-identity.test.ts` | **纯身份/纪元漂移** |
| 303 | recomputes the first battle terminal and every event hash from public commands | `tests/opening-random-identity.test.ts:885` | **纯身份/纪元漂移** |

### tests/server/battle-start-slices.test.ts

11项直接注入旧 battle-start.json（round3/9/23均v25、f671ab88且无anomalySelection）：命中 invalid-seat-state / battle-validation:content-digest，导致阶段、延迟队列、第二次故障注入和预算切片数连带失败。新建当前身份房间的第一项通过；不能把旧夹具连带失败说成计时断言已通过。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 304 | battle opening slices round 3: tick0/1 hashes equal the v25-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:35` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 305 | battle opening slices round 9: tick0/1 hashes equal the v25-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:74` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 306 | battle opening slices round 23: tick0/1 hashes equal the v25-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:74` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 307 | battle opening slices 4-6 including the mirror: complete results and ledgers equal synchronous resolver output | `tests/server/battle-start-slices.test.ts:35` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 308 | battle opening slices keeps frozen inputs and FIFO commands until publication, matching arrivals after synchronous opening | `tests/server/battle-start-slices.test.ts:109` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 309 | battle opening slices faults after a later battle fails without publishing earlier streams or roster locks | `tests/server/battle-start-slices.test.ts:158` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 310 | battle opening slices dispose cancels an opening continuation and drops deferred writes | `tests/server/battle-start-slices.test.ts:169` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 311 | battle opening slices 4-6 full boards: never adds a second rules initialization step to a slice | `tests/server/battle-start-slices.test.ts:201` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 312 | battle opening slices uses the 2 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 313 | battle opening slices uses the 8 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | **纯身份/纪元漂移**（旧检查点准入/连带） |
| 314 | battle opening slices uses the 20 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | **纯身份/纪元漂移**（旧检查点准入/连带） |

### tests/v19-part2.test.ts

仍要求 rulesVersion=v25，当前统一为v26；schema/save/replay仍12/8/8。

| 序号 | 失败用例 | 触发位置 | 分类 |
| ---: | --- | --- | --- |
| 315 | v19 emblem replacement and schema retains v19 rules in v25-online-rules schema/save/replay 12/8/8 | `tests/v19-part2.test.ts:294` | **纯身份/纪元漂移** |

## 实际执行的全部文件（按最后一次结果去重）

| 文件 | 通过 | 失败 | 结果 |
| --- | ---: | ---: | --- |
| `scripts/tests/production-size.test.ts` | 5 | 1 | 断言失败 |
| `tests/augment-history-carousel-growth.test.ts` | 4 | 0 | 通过 |
| `tests/augment-history-long-restore.test.ts` | 7 | 0 | 通过 |
| `tests/augment-history.test.ts` | 75 | 2 | 断言失败 |
| `tests/augment-pool-batch3-progress.test.ts` | 10 | 2 | 断言失败 |
| `tests/augment-pool-batch5-g4-swarm.test.ts` | 14 | 1 | 断言失败 |
| `tests/augment-pool-batch5-h12-head-start.test.ts` | 14 | 0 | 通过 |
| `tests/augment-pool-batch5-h12-max-cap-online.test.ts` | 3 | 0 | 通过 |
| `tests/augment-pool-batch5-h12-max-cap.test.ts` | 15 | 0 | 通过 |
| `tests/augment-pool-batch5-h12-subscription.test.ts` | 20 | 0 | 通过 |
| `tests/augment-pool-batch5-h13-carousel-room.test.ts` | 10 | 0 | 通过 |
| `tests/augment-pool-batch5-r2-anomaly.test.ts` | 90 | 0 | 通过 |
| `tests/augment-pool-batch5-r6-pandora.test.ts` | 8 | 0 | 通过 |
| `tests/augment-pool-batch5-r6-recombobulator.test.ts` | 8 | 0 | 通过 |
| `tests/augment-text-identity.test.ts` | 4 | 0 | 通过 |
| `tests/b8-late-claim-receipt-order.test.ts` | 24 | 0 | 通过 |
| `tests/blistering-restore.test.ts` | 5 | 0 | 通过 |
| `tests/content-identity-constants.test.ts` | 6 | 0 | 通过 |
| `tests/crown-restore-cache.test.ts` | 4 | 0 | 通过 |
| `tests/d11-wiring-bank.test.ts` | 1 | 1 | 断言失败 |
| `tests/d11-wiring-match.test.ts` | 5 | 0 | 通过 |
| `tests/d11-wiring-online.test.ts` | 8 | 0 | 通过 |
| `tests/d14-ability-display.test.ts` | 15 | 0 | 通过 |
| `tests/d14-anomalies-source.test.ts` | 3 | 1 | 断言失败 |
| `tests/d14-anomalies.test.ts` | 42 | 0 | 通过 |
| `tests/d14-public-unit-mark.test.ts` | 8 | 0 | 通过 |
| `tests/d14-sale-price.test.ts` | 2 | 0 | 通过 |
| `tests/d14-wiring-match.test.ts` | 40 | 0 | 通过 |
| `tests/epic-loot-reforger.test.ts` | 27 | 3 | 断言失败 |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2 | 0 | 通过 |
| `tests/explorer-bracer-restore.test.ts` | 24 | 0 | 通过 |
| `tests/g2-3-anomalies.test.ts` | 55 | 0 | 通过 |
| `tests/g2-4b-gambler-loot-gold-restore.test.ts` | 5 | 0 | 通过 |
| `tests/g2-4b-mirror-forge-restore.test.ts` | 2 | 0 | 通过 |
| `tests/g2-4b-pr161-restore.test.ts` | 11 | 0 | 通过 |
| `tests/g2-4b-resists-restore.test.ts` | 21 | 0 | 通过 |
| `tests/g2-4b-restore-authority.test.ts` | 8 | 0 | 通过 |
| `tests/g2-4b-trench-restore.test.ts` | 3 | 0 | 通过 |
| `tests/m4-ledger-bound.test.ts` | 2 | 0 | 通过 |
| `tests/m5-acceptance.test.ts` | 7 | 0 | 通过 |
| `tests/m5-audit-boundaries.test.ts` | 21 | 0 | 通过 |
| `tests/m5-combat.test.ts` | 48 | 0 | 通过 |
| `tests/m5-command-phases.test.ts` | 13 | 0 | 通过 |
| `tests/m5-content.test.ts` | 9 | 0 | 通过 |
| `tests/m5-economy-p3-selector.test.ts` | 1 | 0 | 通过 |
| `tests/m5-economy.test.ts` | 44 | 0 | 通过 |
| `tests/m5-growth.test.ts` | 12 | 0 | 通过 |
| `tests/m5-match-integration.test.ts` | 3 | 0 | 通过 |
| `tests/m5-neutral-timing.test.ts` | 5 | 0 | 通过 |
| `tests/m5-oracle-augment-ledger.test.ts` | 47 | 0 | 通过 |
| `tests/m5-oracle-h13-inventory.test.ts` | 10 | 0 | 通过 |
| `tests/m5-oracle-h6.test.ts` | 12 | 0 | 通过 |
| `tests/m5-oracle-loot-explosion.test.ts` | 10 | 0 | 通过 |
| `tests/m5-oracle-route-driver.test.ts` | 1 | 0 | 通过 |
| `tests/m5-regressions.test.ts` | 9 | 0 | 通过 |
| `tests/m5-replay-cannon.test.ts` | 1074 | 0 | 通过 |
| `tests/m5-replay-intermediates.test.ts` | 4 | 0 | 通过 |
| `tests/m5-replay-mage.test.ts` | 1661 | 0 | 通过 |
| `tests/m5-replay-resource-reuse.test.ts` | 3 | 0 | 通过 |
| `tests/m5-replay-sniper-caitlyn.test.ts` | 1664 | 0 | 通过 |
| `tests/m5-replay.test.ts` | 1673 | 0 | 通过 |
| `tests/m5-route-h3-audit.test.ts` | 9 | 0 | 通过 |
| `tests/m5-route-hash.test.ts` | 2 | 0 | 通过 |
| `tests/m5-route.test.ts` | 4 | 4 | 断言失败 |
| `tests/m5-runtime-import.test.ts` | 15 | 0 | 通过 |
| `tests/m5-serialization.test.ts` | 34 | 0 | 通过 |
| `tests/m5-strategy-numbers.test.ts` | 42 | 0 | 通过 |
| `tests/m6-integration-mage.test.ts` | 0 | 2 | 断言失败 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | 0 | 2 | 断言失败 |
| `tests/m6-integration-sniper.test.ts` | 0 | 2 | 断言失败 |
| `tests/m6-integration.test.ts` | 0 | 3 | 断言失败 |
| `tests/m6-playback-checkpoints.test.ts` | 0 | 3 | 断言失败 |
| `tests/m8-b3-restore.test.ts` | 13 | 0 | 通过 |
| `tests/m8-b6-match-wiring.test.ts` | 18 | 0 | 通过 |
| `tests/m8-b7-match-wiring.test.ts` | 25 | 5 | 断言失败 |
| `tests/m8-b8-acquisition.test.ts` | 12 | 0 | 通过 |
| `tests/m8-b8-combat-input.test.ts` | 38 | 0 | 通过 |
| `tests/m8-b8-command-oracle.test.ts` | 6 | 0 | 通过 |
| `tests/m8-b8-copy-semantics.test.ts` | 6 | 0 | 通过 |
| `tests/m8-b8-equipment-fixture.test.ts` | 4 | 0 | 通过 |
| `tests/m8-b8-golden-guard.test.mjs` | 24 | 0 | 通过 |
| `tests/m8-b8-input-evidence.test.mjs` | 32 | 0 | 通过 |
| `tests/m8-b8-live-capacity.test.ts` | 7 | 0 | 通过 |
| `tests/m8-b8-live-cross-round.test.ts` | 6 | 0 | 通过 |
| `tests/m8-b8-live-economy.test.ts` | 3 | 0 | 通过 |
| `tests/m8-b8-live-growth.test.ts` | 27 | 0 | 通过 |
| `tests/m8-b8-live-reveal.test.ts` | 4 | 0 | 通过 |
| `tests/m8-b8-live-transfer.test.ts` | 0 | 0 | 收集失败 |
| `tests/m8-b8-loot-freeze.test.ts` | 66 | 0 | 通过 |
| `tests/m8-b8-loot-runtime.test.ts` | 18 | 0 | 通过 |
| `tests/m8-b8-loot-view.test.ts` | 8 | 0 | 通过 |
| `tests/m8-b8-oracle.test.ts` | 25 | 0 | 通过 |
| `tests/m8-b8-resource-provenance.test.ts` | 64 | 0 | 通过 |
| `tests/m8-b8-restore-fold-reuse.test.ts` | 5 | 0 | 通过 |
| `tests/m8-b8-restore.test.ts` | 7 | 0 | 通过 |
| `tests/m8-b8-token-lifecycle.test.ts` | 4 | 0 | 通过 |
| `tests/m8-content-equivalence.test.ts` | 4 | 134 | 断言失败 |
| `tests/m8-contracts.test.ts` | 6 | 0 | 通过 |
| `tests/match-contract.test.ts` | 11 | 1 | 断言失败 |
| `tests/opening-encounters.test.ts` | 7 | 0 | 通过 |
| `tests/opening-random-identity.test.ts` | 19 | 136 | 断言失败 |
| `tests/p7-1-carousel-rules.test.ts` | 8 | 0 | 通过 |
| `tests/p7-carousel.test.ts` | 16 | 0 | 通过 |
| `tests/p7-restore-compilation.test.ts` | 4 | 0 | 通过 |
| `tests/playtest-1022b-bench.test.ts` | 1 | 0 | 通过 |
| `tests/presentation/v23-anomaly-panel.test.ts` | 13 | 0 | 通过 |
| `tests/resource-provenance-firesale.test.ts` | 11 | 0 | 通过 |
| `tests/restore-audit/bounds-preflight.test.ts` | 18 | 0 | 通过 |
| `tests/restore-audit/cd-replay-facts.test.ts` | 34 | 0 | 通过 |
| `tests/restore-audit/combat-accumulators.test.ts` | 1 | 0 | 通过 |
| `tests/restore-audit/corrosion-contributions.test.ts` | 5 | 0 | 通过 |
| `tests/restore-audit/g23-grant-evidence.test.ts` | 15 | 0 | 通过 |
| `tests/restore-audit/g23-reward-allocation.test.ts` | 11 | 0 | 通过 |
| `tests/restore-canonical-encoding.test.ts` | 4 | 0 | 通过 |
| `tests/restore-g23-reuse.test.ts` | 2 | 0 | 通过 |
| `tests/restore-json-decoding.test.ts` | 3 | 0 | 通过 |
| `tests/restore-validation-speed.test.ts` | 4 | 0 | 通过 |
| `tests/s13-anomalies-b.test.ts` | 5 | 0 | 通过 |
| `tests/s13-anomalies-c.test.ts` | 8 | 0 | 通过 |
| `tests/s13-anomalies-d.test.ts` | 4 | 0 | 通过 |
| `tests/s13-anomalies-redirect.test.ts` | 1 | 0 | 通过 |
| `tests/s13-anomalies-replay.test.ts` | 7 | 0 | 通过 |
| `tests/s13-anomalies-restore-review.test.ts` | 6 | 0 | 通过 |
| `tests/s13-anomalies-restore.test.ts` | 11 | 0 | 通过 |
| `tests/s13-anomalies-review.test.ts` | 17 | 0 | 通过 |
| `tests/s13-anomalies-settlement.test.ts` | 4 | 0 | 通过 |
| `tests/s13-anomalies-source.test.ts` | 12 | 0 | 通过 |
| `tests/s13-mech-ownership.test.ts` | 23 | 0 | 通过 |
| `tests/s13-p1-acquisition.test.ts` | 3 | 0 | 通过 |
| `tests/s13-p1-avarice.test.ts` | 1 | 0 | 通过 |
| `tests/s13-p1-bound-identity.test.ts` | 2 | 0 | 通过 |
| `tests/s13-p1-dual-wielding.test.ts` | 2 | 0 | 通过 |
| `tests/s13-p3-acquisition.test.ts` | 12 | 0 | 通过 |
| `tests/server/augment-pool-batch5-g4-swarm-room.test.ts` | 24 | 0 | 通过 |
| `tests/server/augment-pool-batch5-g7-carousel-restore.test.ts` | 22 | 0 | 通过 |
| `tests/server/batch5-g3-restore-room.test.ts` | 9 | 0 | 通过 |
| `tests/server/battle-start-slices.test.ts` | 1 | 11 | 断言失败 |
| `tests/server/carousel-room.test.ts` | 20 | 0 | 通过 |
| `tests/server/net/v17-avarice-reconnect.test.ts` | 1921 | 0 | 通过 |
| `tests/server/v17-avarice-battle-end-frozen.test.ts` | 1921 | 0 | 通过 |
| `tests/server/v17-avarice-battle-end.test.ts` | 2 | 0 | 通过 |
| `tests/server/v17-avarice-draw.test.ts` | 1 | 0 | 通过 |
| `tests/server/v17-avarice-earnings.test.ts` | 1921 | 0 | 通过 |
| `tests/server/v17-avarice-pvp.test.ts` | 3842 | 0 | 通过 |
| `tests/server/v17-avarice-same-tick.test.ts` | 1 | 0 | 通过 |
| `tests/server/v26-anomaly-preparation.test.ts` | 7 | 0 | 通过 |
| `tests/t10-combat-ops.test.ts` | 37 | 0 | 通过 |
| `tests/t10-deferred-upgrades.test.ts` | 10 | 0 | 通过 |
| `tests/t13-golden.test.ts` | 1 | 0 | 通过 |
| `tests/t5r-private-seat-view.test.ts` | 16 | 0 | 通过 |
| `tests/task-mechanism-restore.test.ts` | 20 | 0 | 通过 |
| `tests/v15-anomaly-availability.test.ts` | 7 | 0 | 通过 |
| `tests/v17-avarice-online.test.ts` | 3 | 0 | 通过 |
| `tests/v19-part2.test.ts` | 39 | 1 | 断言失败 |
| `tests/v23-restore-fuzz.test.ts` | 53 | 0 | 通过 |
| `tests/v23-review-restore.test.ts` | 40 | 0 | 通过 |
| `tests/v26-anomaly-choice.test.ts` | 16 | 0 | 通过 |
| `tests/v26-anomaly-identity-audit.test.ts` | 4 | 0 | 通过 |
| `tests/v26-anomaly-r5.test.ts` | 15 | 0 | 通过 |

未做浏览器或发布验收；旧基线门禁之后的场景需在统一v26重录后重新完整执行。已发布v25及更早证据保持原字节，T13 oracle仅恢复已锁定字节。

## 最终构建与静态核对

`npm run build -- --configLoader runner`（含完整`tsc --noEmit`）、内容双摘要`--check`、`git diff --check`均通过。2D顶层`dist/assets/*.js`逐文件gzip-9总计 **632,031字节 ≤ 637,144**（index 508,132，Phaser 123,899）；没有新增顶层JS或lazy chunk。

六个工作区冲突文件均无冲突标记；Git索引保留原6个UU条目，未add/commit。T13与bench已按原字节核对，R5交接文档无本机临时路径。`src/server/`、界面目录和素材无本轮修改，无新增服务器计时API。
