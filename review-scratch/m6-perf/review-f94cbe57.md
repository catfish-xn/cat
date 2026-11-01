# 审核：cursor/v26-ci-fix-m6-perf @ f94cbe57（基于 63372316）

结论：**有 2 项必修**，1 项回退要处理，1 项存档兼容要用户拍板。不建议按现状合入。

## 必修 1：删掉"战斗中穿戴命令"的伪造战报会被导入接受（基线会拒）
- 位置：`src/simulation/augment-history-restore.ts` noteCombatTranscript 把 `equipItem / useConsumable / combineItems` 也并进 transcript；`battle-record-validation.ts` replaySnapshot 只要求 `record.equipmentCommands` 为空就走 transcript。
- 复现：seed 902431，第 4 场战斗第 2 tick 穿一件装备，诚实存档正常导入；把该战报的 `equipmentCommands` 删掉后：
  - f94cbe57：**导入通过**（transcript 复用 4 场、冷重放 0）；之后回放这场 `validateBattlePlayback` 报"事件缺失或内容错误"。
  - 63372316：同一文件导入即拒（事件缺失或内容错误）。
- 也就是 transcript 路径和 tick walk 不等价：transcript 里含有战报没声明的命令效果。
- 修法建议：transcript 记下并入过的非 stepMatch 命令，有就不复用（或要求和 record.equipmentCommands 逐条一致）。补一条"删穿戴命令必须被拒"的测试。

## 必修 2：状态字典可做"放大炸弹"，2MB 存档把导入撑爆内存
- 位置：`src/persistence/fact-prefix.ts` expandAugmentFactPrefixes 的 revive：`{"$statusRef":n}` 可出现在事件任意位置，每处都指向同一个字典对象，没有总量上限。
- 复现：在一场战报加 `statusDictionary=[{s:512KB 字符串}]`，事件 0 塞 2 万个 `{"$statusRef":0}`，文件 2.1MB：
  - f94cbe57：vitest worker 内存耗尽退出（浏览器里就是标签页崩溃）；64KB×2000（1.5MB 文件）也要 4.8s、堆 +600MB。
  - 63372316：1.5s 拒（记录字段）。
- 修法建议：只在 `$s` 行和 statusChanged 的 key/source/application/effectiveSourceKey 位置认引用，其他位置出现就拒；并按"引用次数×条目编码长度"设上限（比如不超过 MAX_SAVE_BYTES）。

## 要处理：firstSeek 变慢，超 2s 门槛
本容器 enforce（4 核，负载 1.1~1.5）：

| 指标 | 门槛 | 63372316 | f94cbe57 |
|---|---|---|---|
| completeImport max | 30s | 65.4s（57/65/11） | 31.3s（27/31/26） |
| fullLoadRoundTrip | — | 47.5s | 26.1s |
| fullCapture p95 | 500ms | 2596ms | 800ms |
| capture p95 | 50ms | 73.1ms | 76.5ms |
| activation max | 1000ms | 952ms | 970ms |
| firstSeek max | 2000ms | **1844ms 过** | **4406ms 不过**（2059/4406/2426） |
| cachedSeek max | 100ms | 50.7 | 50.9 |

注意：基线那一轮期间我同时在跑 vitest（对基线不利），f94 那一轮独占机器，firstSeek 仍然变慢 → 回退是真的。三次波动大（2.1/4.4/2.4s），像 GC 被算进测量（与 m6-first-seek-spike 记录的现象一致）；推测原因是导入不再走 tick walk，首次 seek 要自己冷跑整场，且导入期间每场开战都 structuredClone+canonicalContent 一份整局状态塞进 replayPrefix 缓存，留下大量垃圾。未用堆数据证实。
- 对 CI：PR 进 multiplayer 的 run 里 wallclock 只报告，不会因此变红；workflow_dispatch 和进 release/* 的 PR 是 enforce，firstSeek 会红（原本能过）。completeImport/fullCapture/capture 在基线就超，不是本单引入。

## 要用户拍板：存档格式变化
- 旧存档（不压缩）：f94cbe57 照常导入，并且也走 transcript 复用（12 场复用、0 冷重放）。✓
- 新存档拿到 63372316（及更早版本）：**被拒，不会误收**；报错是"Invalid augment history: fact bounds"（数据无效），不是"需要更新版本"。saveFormatVersion 没改，所以旧版本没法区分"新格式"和"坏文件"。
- 小局（战斗少）不触发压缩，旧版本仍能打开；局数多就打不开。玩家可见：v26 导出的长局存档，v25 读不了。是否接受、要不要升 saveFormatVersion，由用户定。

## 要点 1 其余：transcript 复用不算自证
- transcript 是本次导入重放存档自带命令证明时现算出来的，战报逐项比对 context/initial/events/version/roundId/result/endTick/nextEventSeq/两个 hash，和 tick walk 算同一个函数序列，等价——上面"穿戴命令"一例除外。
- 篡改测试（12 场的压缩和非压缩文件都试）：改事件值、删最后事件、改 stateHash、改 eventHash、改结果、改 endTick、改 nextEventSeq、改 initial、改 context 金币 → 全部被拒，且都没走复用。
- format.ts 的 `ownBattleRecord` = `isImmutableJson` + 打"已拥有"标记，不可变检查没有削弱。
- recordThis 首轮禁用 prefix 缓存：代码如描述。
- 小问题（不必修）：transcript 路径不再对 record.context 跑 validateMatchStructure，只做 canonical 相等；-0 之类的非规范值会被放过到回放时才报。

## 要点 2 其余：恶意前缀
越界（-1、1e9）、小数、字符串、多余键、少一（prefixShorter）、字典不是数组、引用越界/负数、坏 `$s` 行、主档 facts 清空 → 全部拒，十几毫秒到 1.3 秒。

## 要点 4：capture 状态
- validateHistory 抛错后，transcript 不残留；随后直接调 validateBattleCollection 全部冷重放（复用 0）。closer 可重复调用。✓
- 并发两次导入（async 间隙）会共享同一个 capture，按 `round-N` 覆盖对方 transcript；因为比对是全量的，只会导致回退变慢，不会误收。可接受，建议注释写明。

## 测试
`git grep` 出引用 persistence/format、compatibility、fact-prefix、replay/history、replay 入口、augment-history-restore、battle-record-validation 的 48 个测试文件（含 m6-import-transcript）：
- 通过 6724，跳过 7（7 条都是 `skipIf(!existsSync(RESEARCH_FILE))`，本容器没有 14.24 研究文件，与本单无关），失败 0。
- 我的复现脚本只放在本地工作树，没提交、没推送。
