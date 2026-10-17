# B 批严格精确进程缓存收尾（仍有 2 项性能阻塞）

## 授权与固定版本

本轮用户明确允许“进程内已验证历史缓存”，覆盖前轮禁止跨调用缓存的历史限制。此处只实现**完整输入精确命中**；跨调用前缀续推仍未实施。前轮报告保留作历史，不代表本轮仍禁止已授权缓存。

- 起点：`9d0972c8cc60e4f4566f21cc2ceabbcdbb1fe5d3`。
- 固定代码：`4dd73d4c9f20fef7fcbd8ee48189acb84d1ff29f`。
- 代码树：`4f7f7e8cc7859aa7fb45a590ab6fa98e0823b4f7`。
- 分支：`codex/restore-fix-batch-b`，追加提交，不改历史。
- Node `v24.19.0` / npm `11.9.0`，与本环境此前测量一致。
- **未签收/不可合入：B5 两项仍超过原 5000 ms。** 不跑全套，不改变任何超时、门禁、规则、数值或版本。

## 缓存键、值与验证边界

1. 通用工具 `verified-restore-cache.ts`：键包含完整 canonical 输入、代码实际 `M8_VERSION`、`G23_POLICY.revision` 和 `CONTENT_DIGEST`。hash 只作 Map 索引，命中必须再比完整 canonical 原文；伪造自报 digest/ID/序号不能独立命中。
2. standalone `restoreMatch` / `serializeMatch` 仍先执行既有结构/装备/运行态校验，再在独立 detached 图上查完整 state 键。冷路径从 seed 重演并完整核对，成功后只存**重演自产结果**；失败不入。
3. 命中仍执行 `comparePreparationState`：当前 gold、level/XP、完整 shop、四条 RNG、完整事件和 nextMatchEventSeq、规范 commands、当前战斗身份位置，以及原账本核对的所有资源/成长/机制/物品/选择字段，一项不省。
4. collection 键包含完整 envelope，包含全部 `battles` / `currentBattle` 及当前 state。先对外部对象执行 canonical 数据形状检查，再独立 snapshot；此后键和验证始终使用这同一图，避免 getter 或异步期间修改造成检验/缓存对象不一致。
5. collection 未命中时保留上轮逐项真实验证和同调用 proof；**不借用 standalone 进程缓存**。只有整个 collection 完成才保存验证通过的 match。命中时完整 envelope 与此前成功输入字节级 canonical 相等，并显式执行当前字段比较，才返回。
6. 键原文变化不命中；JSON 空白或属性顺序等 canonical 等价变化不算历史数据变化。缓存保存与取出都 clone，外部修改返回对象不污染已验证结果。没有持久磁盘缓存，没有跨版本复用，没有跨调用前缀复用。

## 有界容量与实际内存

- standalone：最多 8 条、8 MiB。
- collection：最多 2 条、64 MiB。
- 两种缓存合计最多 **72 MiB canonical UTF-16 键+值载荷计账**；达到条数或字节任一上限按 LRU 淘汰。单条过大只放弃缓存，仍完整验证合法存档，不截断、不拒绝合法值。
- 这是明确的载荷计账上限，**不是 JavaScript 实际 heap/RSS 上限**，不包含对象开销和瞬时 canonical/snapshot 分配。
- 首次用 8 MiB collection 上限测得 33 场键+值 `60,593,488 B`，无法入缓存，第二次仍是冷验证。保留记录，不能把那次称为热命中。依据实测改为有界 64 MiB；两条大记录若合计超限仍淘汰。
- 单独 RSS 观察：完整公开路线生成、冷/热恢复、collection 与诊断计数的一个 Node 子进程，峰值 `1,235,092 KiB`（约 1.18 GiB），退出 0、29.826 s。使用 Python `getrusage(RUSAGE_CHILDREN)`，该进程只启动一个 Node 子进程；`/usr/bin/time` 不在默认路径，未安装新工具。此值包括全部生成与测量，不是缓存独占内存；没有无缓存 RSS 对照，不能归因全部由缓存导致。

## 测试与未闭环项

最终相关 **6 文件 48/48**，typecheck 通过：

- `tests/restore-audit/verified-restore-cache.test.ts` 4：cold/warm 一致、拒绝原因一致、历史数据变化 miss、失败不存、碰撞后原文不等拒命中、入出 clone、LRU/字节上限、collection 完整 battle 变化 miss、getter 在 canonical/snapshot 间换 gold+1 仍拒。
- `preparation-ledger-scope.test.ts` 4：同调用 seed/前缀/实际战斗装备/proof 隔离/异步隔离。
- `preparation-ledger.test.ts` 16、`match-authority.test.ts` 10：原 MA1/MA2/MA2b、seed 1/42 下一准备期 gold+1、对象/JSON/collection/envelope、合法多轮逐 tick 一致等。
- `m8-b8-restore-fold-reuse.test.ts` 5：既有 dynamic getter/资源恢复。
- `m6-replay.test.ts` 9：战斗事件、结果、拓扑与历史恢复。

B5 原文件单独一次：**7 通过 / 2 超时 / 0 未执行**，总 25.78 s；未改变文件、时限、负例或 hook：

|用例|实测|原限制|结论|
|---|---:|---:|---|
|preserves a legal pre-F roll through current, settled and historical save/restore|6516 ms|5000 ms|未通过|
|allows the first equip after same-round F at the upper bound, not only the starting level|5735 ms|5000 ms|未通过|

其余原超时与归档 hook 均通过。上轮 6 个失败缩为 2 个，不宣称文件全绿。两项各包含多个**不同完整输入**，精确缓存只能消除重复输入；不能为过测自动改成跨调用前缀命中。

本轮首次新测试错误地预期“settlement gold+1”由账本拒绝，实际原结构校验更早以 `current settlement totals` 拒绝。日志保留；准备期负例改为真实 nextRound 后再伪造，仍要求具体 `preparation-ledger-gold`；settlement 负例保留原精确拒因，没有修改生产校验。

## 无插桩 cold/warm 数据

均使用真实公开命令、相同工具链；每对 cold/warm 为同进程同完整输入，未用存档中间结果替代冷重演。

|场景|冷|热|说明|
|---|---:|---:|---|
|4-5 / 22 轮 / 7216 steps，单次 restore|2549.723 ms|17.044 ms|生成 3457.097 ms；每项一次|
|33 场，单次 restore|5460.475 ms|33.467 ms|完整 cannon seed42 路线|
|33 场，完整 collection|8804.626 ms|454.612 ms|64 MiB 容量后首次成功实测|

33 场额外第三次调用启用 V8 精确计数，`stepMatchImpl = 0`，证明真实热命中；计数发生在上表两个计时结束之后，不污染表内 cold/warm 测量。当前经济/事件等比较仍执行。

初设 8 MiB 的未缓存运行：33 场 collection `8649.067 / 7649.050 ms`，第二项不是热命中。另一次 RSS 运行的完整原始数字也保留在 JSON，不挑选通过数据或合并为统计显著性结论。

B5 整文件在 collection 专用容量 8 MiB 时运行；后续只提高缓存容量到 64 MiB，不改任何接受/拒绝或计时阈值，未重复整文件。48 项和 typecheck 对应最终代码；4-5 standalone 逻辑在该容量调整前后相同。

## 复现与后续

相关命令见 `logs/`。33 场源程序 `33-round-source.txt` 可在根目录执行：

```sh
node_modules/.bin/esbuild docs/evidence/restore-audit/batch-b/exact-cache/33-round-source.txt --loader:.txt=ts --bundle --packages=external --platform=node --format=cjs --outfile=./batch-b-33.tmp.cjs
node batch-b-33.tmp.cjs
```

`4-5-source.txt` 是专用测量测试源，临时放入 tests 单跑后移出；未加入默认 suite。全部首次失败、类型检查、容量不足测量和 RSS 记录保留。

本轮止于精确缓存授权范围。剩两项仍需另行决定安全优化方向；不能擅自扩大为跨调用前缀缓存、放宽规则或把验证移出原测试计时。版本升级事项继续沿用原批 B 报告，当前不升版本。未跑全套、未跑远端 CI、未宣布可合入。
