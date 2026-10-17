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

- `tests/g2-3-lesser-shimmer-duplicator.test.ts:21`：同步 #170 后的新调用方补录自然战斗与每个独立恢复分支的 BattleRecord；读写传完整证据，不改变新复制器规则或任何断言。

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

## 目标分支同步

交付前再次 fetch / ls-remote：任务分支仍为 ab94630，multiplayer 已前进到 `4ad4e83df584dee8ff7d4113c935ec03c8cca291`（#170 已合入）。同步该目标基线，两个生成清单冲突通过指定 recorder 和 inputs 脚本重新生成解决；源码无文本冲突。版本与策略数值文件相对该 multiplayer 为零差异，继承目标已有 v9，不另行升版或改规则值。

## 自行决定

- 复用已有 BattleHistory 与 B7 的公开记录夹具，不合成历史，不放宽校验，不引入另一套规则。
- 完整历史导致旧 FIFO 缓存反复淘汰热记录；按已有 MAX_COMPLETED_RUNS（3 归档）+ 当前局确定缓存容量为 132 条，改用最近最少使用淘汰；单个存档最多 33 战等读档限制不变。仅复用深度不可变记录与私有重演结果之间已核实的历史衔接；当前存档永不进入该缓存。
- 公共路线夹具在初始化时完整准入其 33 战，避免把尚未准入的源历史冷重演混进单个机制用例；当前候选从不凭夹具身份跳过验证。
- B7 在计时用例外按公开命令生成原始 Herald 输入的五条分支证据；用例内部仍逐次解析原始文本并完整验证，未改断言、工作量或时限。逐 tick 保留全部事件，仅在完成战斗时登记新的夹具索引。
- B7 只补调用方证据及实际结算记录；首战尚无历史的结构/序列化专测保持直接调用，以继续覆盖省略 battles 的合法首战边界。
- simulation 仅调整已验证数据的缓存，不改变任何校验条件；通过指定 recorder 更新源指纹，再按 inputs 生成、--check 顺序验证；不升版本，不改规则数值、测试时限，不删除或跳过测试；只跑指定及相关测试。

## 最终验证（同步 4ad4e83 后）

环境 Node 24.19.0；依照仓库 package-lock 执行 npm ci，Vitest 5.0.3。

- 指定 Fast 回归一轮全部通过：45 文件、744/744，384.59 秒（墙钟 385.683 秒），无失败。覆盖 B7、B8、restore-audit、G2-3（含 #170 新增复制器）、冠冕缓存／历史，以及 M6 完整 cannon 路线、回放和存储。命令：`npx vitest run --project fast tests/m8-b7-*.test.ts tests/restore-audit tests/m8-b8-*.test.ts tests/g2-3-*.test.ts tests/crown-restore-cache.test.ts tests/g2-4a-crown-history.test.ts tests/m6-integration.test.ts tests/m6-replay.test.ts tests/m6-persistence.test.ts --maxWorkers=1 --reporter=verbose`。
- 指纹按顺序执行：`node tests/fixtures/record-g2-3-herald.cjs --write`（113.50 秒）→ `node scripts/record-g2-3-inputs.cjs` → `node scripts/record-g2-3-inputs.cjs --check`，全部通过。未使用 `verify-m8-herald-fixtures.cjs --write`。
- 相对已合入的 4ad4e83：五份原始 Match、trajectory 逐字节不变；内容 digest 仍为目标已有的 `fnv1a32-utf16:d6c9bf1b`。Herald manifest 只更新源指纹，对应 inputs audit 更新清单指纹。版本／策略数值文件与目标完全一致。
- 最终 cannon：1 文件、1/1 通过；测试 161.01 秒，Vitest 总计 163.17 秒，命令墙钟 163.897 秒，原时限 180 秒不变；206 条命令、8703 tick 全部逐步恢复／字段／事件比较。命令：`npx vitest run --project timing tests/m5-replay-cannon.test.ts --no-file-parallelism --reporter=verbose`。
- 最终 `npm run typecheck`、inputs `--check`、`git diff --check` 通过；修改文本均为 LF。
- 没有删除、跳过测试或改测试时限；没有运行全套；没有自行修改目标的版本或规则数值。

## 未完成

无。本次只跑指定相关回归，完整 CI 由普通推送后自动触发。
