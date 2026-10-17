# PR #171 CI 读档调用方审计

基线：先 `git fetch origin`，再 `git ls-remote`；显式抓取任务分支后再次核实。
任务分支 head：`ab946308cb8735df49ad44af24d8f25afa595700`；目标 multiplayer：`0719ced60ade353a238024d757cf9440701f6aaa`。

## 修复

- `tests/m5-replay-helper.ts:14`：逐步录制真实命令与 tick 的战斗事件；完成战斗后立即纳入 completedRecords，再向每次 restoreMatch 传入完整历史。每步独立执行、失败命令不变性、字段比对全部保留。
- `tests/m8-b7-match-wiring.test.ts:4`：读写调用使用公开夹具历史；跨轮及开局连续三战另录真实完成记录，保持原测试断言和时限。
- `tests/m8-b7-audit-vectors.test.ts:5`：读写调用使用公开夹具历史；机制逐 tick 连续/恢复对照同时录制当轮战斗，末轮结算也携带完整历史。

- `tests/fixtures/m8-neutral-public-route.ts:29`：夹具生成后先经生产序列化／恢复完整准入 33 战；测试内部仍传全历史验证每个候选。
- `tests/fixtures/history-evidence.ts:28`：同结算摘要的真实分支优先匹配最长资源前缀，避免误拿装备事务之前的祖先历史；最终仍由生产校验器逐项核验。
- `tests/m6-integration-helper.ts:36`：单条验证及 PlaybackSession 都传入该战之前的同局完整历史；保留每 tick 原轨迹对照。

- `src/simulation/battle-record-validation.ts:126`：缓存命中刷新最近使用顺序，上限按 3 归档 + 1 当前局设为 132；仅缓存已成功验证的私有不可变历史衔接，当前候选的历史结算、种子、顺序、终战及资源衔接继续逐次验证。
- `tests/crown-restore-cache.test.ts:12`：新增缓存满载淘汰与不可变历史衔接复用回归，验证热项不被逐出、冷项确实被逐出、每次候选仍被检查并拒绝伪造。

- `tests/m8-b8-live-reveal.test.ts:32`：在公共源前缀初始化时通过生产完整准入；保留同步死亡用例内全部读档、发奖和事件断言。
- `tests/m8-b8-live-transfer.test.ts:12`：TG 两个完整场景在夹具初始化时通过生产准入；保留每个计时边界的原始读写和状态／事件比较。

## 生产调用点逐项核对

| 调用点 | 历史来源／处理结果 |
| --- | --- |
| `src/server-entry/index.ts:9` | 仅重导出 restoreMatch / serializeMatch，无实际读档调用；严格历史合同不变。 |
| `src/server/room/room.ts:211` | Room 构造从公开 createMatch 创建新八席；没有磁盘 Room 恢复入口，也不调用离线 restoreMatch。 |
| `src/server/net/session.ts:44`、`src/server/net/server.ts:381` | 重连恢复座位凭证及连接 epoch，再投影现有 Room.state；不重建离线 Match，不存在漏传 battles 的拒绝。 |
| `src/rendering/online/ws-client.ts:364` | 本地只恢复连接凭证；对局恢复由服务器权威投影完成，不读离线 Match。 |
| `src/simulation/carousel.ts:172,468` | restoreCarousel / restoreCarouselSeat 是独立的服务器池及轮选快照边界；无生产调用，只有 server-entry 重导出；不经过离线 restoreMatch，本批不扩大其合同。 |
| `src/persistence/repository.ts:55` | materialize 按所有 battleKeys 读出完整 battles，缺任一条即拒绝；readCurrent:62、readCompleted:80 共用，无漏传。 |
| `src/persistence/repository.ts:91,98`、`src/persistence/coordinator.ts:31` | activate 写完整历史；增量保存写 battleKeys 和 addedBattles，读取再组装完整历史；无需改动。 |
| `src/persistence/compatibility.ts:63` | routeSaveFile 只做 staging，保留 envelope.battles；不能单独恢复会话。 |
| `src/persistence/compatibility.ts:68` | readCompatibility 调 validateBattleCollectionSync，使用完整 envelope；无需改动。 |
| `src/persistence/format.ts:20,33` | validateEnvelope / validateFile 必须调用完整集合验证；导入解析不丢 battles；无需改动。 |
| `src/persistence/format.ts:97` | exportFile 导出整个 envelope，包含 battles 与 currentBattle；无需改动。 |
| `src/persistence/legacy-records.ts:42,95` | 旧版记录组装原 battles，仅原样保全导出，禁止作为当前版本续局；无需改动。 |
| `src/m6/application.ts:129,134` | 导出和自动保存分别携 completedRecords / battleKeys + addedBattles，当前战斗携 capturePrefix；无需改动。 |
| `src/m6/application.ts:226,230` | 续局／文件导入经 validateEnvelope / validateFile 完整验证；无需改动。 |
| `src/m6/application.ts:189` | 校验后构造 MatchSession，并向 BattleHistory 传 candidate.battles 和 currentBattle；无需改动。 |
| `src/m6/application.ts:82,107`、`src/replay/history.ts:17,32` | 归档读出完整 envelope，经 admitArchives 及 matchHistoryChecks(match,envelope.battles,runId) 验证，再进回放列表；无需改动。 |
| `src/m6/application.ts:262`、`src/replay/playback-session.ts:22` | 从本局完成历史及已核归档按 runId 过滤、按轮排序，向 PlaybackSession 传完整前序；其构造转交 validateBattleRecord；无需改动。 |
| `src/replay/history.ts:72,78` | BattleHistory 恢复 currentBattle 时传 this.completed，PR 基线已经修复；无需改动。 |
| `src/replay/history.ts:38` | 当前前缀 replayBattleRecord 在同一生成器先完成 matchHistoryChecks 后执行；不是无历史续局入口，无需改动。 |
| `src/rendering/match-session.ts:38` | 薄会话仅复制已通过 application 校验的 candidate；不调用离线恢复，不另做历史授权。 |
| `src/m5/` | 仓库不存在此目录；M5 经 main.ts → BoardScene.ts:54 创建新 MatchSession（BoardScene.ts:233 接入 MatchApplication），未发现另一路存档恢复；对应逐步恢复在 tests/m5-replay-helper.ts，本次修复。 |

扫描覆盖整个 src 的序列化导入、restore/validate 调用及动态 JSON.parse；未发现生产合法路径因漏传历史被本 PR 拒绝。脚本中的历史测量/探针不是生产入口，本次未扩大到旧脚本改造。

## 自行决定

- 复用已有 BattleHistory 与 B7 的公开记录夹具，不合成历史，不放宽校验，不引入另一套规则。
- 完整历史导致旧 FIFO 缓存反复淘汰热记录；按已有 MAX_COMPLETED_RUNS（3 归档）+ 当前局确定缓存容量为 132 条，改用最近最少使用淘汰；单个存档最多 33 战等读档限制不变。仅复用深度不可变记录与私有重演结果之间已核实的历史衔接；当前存档永不进入该缓存。
- 公共路线夹具在初始化时完整准入其 33 战，避免把尚未准入的源历史冷重演混进单个机制用例；当前候选从不凭夹具身份跳过验证。
- B7 在计时用例外按公开命令生成原始 Herald 输入的五条分支证据；用例内部仍逐次解析原始文本并完整验证，未改断言、工作量或时限。逐 tick 保留全部事件，仅在完成战斗时登记新的夹具索引。
- B7 只补调用方证据及实际结算记录；首战尚无历史的结构/序列化专测保持直接调用，以继续覆盖省略 battles 的合法首战边界。
- simulation 仅调整已验证数据的缓存，不改变任何校验条件；通过指定 recorder 更新源指纹，再按 inputs 生成、--check 顺序验证；不升版本，不改规则数值、测试时限，不删除或跳过测试；只跑指定及相关测试。

## 验证结果

环境 Node 24.19.0；依照仓库 package-lock 执行 npm ci，Vitest 5.0.3。

- B7 与缓存回归：8 文件、89/89 通过，141.54 秒（墙钟 142.425 秒）。命令：`npx vitest run --project fast tests/m8-b7-*.test.ts tests/crown-restore-cache.test.ts --maxWorkers=1`。
- PR 原相关集合：34 文件、568 条；本轮 566 通过、2 条冷历史准入超时，232.25 秒。为两个固定源夹具补生产准入后，两个文件全部 22/22 通过，37.74 秒（墙钟 38.678 秒）。因此该集合全部 568 条均已覆盖通过；没有删断言、改时限或跳过用例。首轮命令：`npx vitest run --project fast tests/restore-audit tests/m8-b8-*.test.ts tests/g2-3-*.test.ts tests/crown-restore-cache.test.ts tests/g2-4a-crown-history.test.ts --maxWorkers=1`；复测命令：`npx vitest run --project fast tests/m8-b8-live-transfer.test.ts tests/m8-b8-live-reveal.test.ts --maxWorkers=1`。
- 指纹按顺序执行：`node tests/fixtures/record-g2-3-herald.cjs --write`（119.83 秒）→ `node scripts/record-g2-3-inputs.cjs` → `node scripts/record-g2-3-inputs.cjs --check`，全部通过。未使用 `verify-m8-herald-fixtures.cjs --write`。
- 五份原始 Match、trajectory 和内容 digest `fnv1a32-utf16:cf9dcfe5` 不变；Herald manifest 只改 sources / sourceSha256，对应 inputs audit 只更新 manifest 指纹。
- M6：3 文件、56/56 通过，59.90 秒（墙钟 60.802 秒）。命令：`npx vitest run --project fast tests/m6-integration.test.ts tests/m6-replay.test.ts tests/m6-persistence.test.ts --maxWorkers=1`；包括完整 cannon 路线每战每 tick 回放／恢复对照、存储和历史集合准入。
