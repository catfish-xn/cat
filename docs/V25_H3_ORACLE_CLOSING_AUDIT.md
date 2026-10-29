# v25 H3 账本收尾全量审计

起点：`claude/v25-h3-oracle-fast` / `586e568885477d707b4fc0ac6e5c639ba54c20dc`，工作区干净。仅修改测试、测试工具和文档；`.git` 只读，提交由执行端完成。未修改生产规则、golden、断言阈值或超时，未重录素材/纪元。

## 入口与语义

`auditH3(memory, state): void` 对当前 `checkpoint(state)` 与账本保存的整份脱离原对象的 `memory.observed` 执行 `node:assert/strict.deepEqual`，恢复旧账本的整份 checkpoint 比较语义。它不使用引用缓存、不依赖回合/阶段/阵容锁定边界，也不更新账本或重建期望值；失败仍为 `H3 independent observed checkpoint`。`oracle.g2.cjs` 转导出该入口及类型声明，并通过 `Ledger.audit(state)` 为间接调用方提供入口。H3 账本仍只依赖 Node 标准库，不引用 `src/`。

`generate-m5-route.cjs` 在 `finally` 审计最后一个成功接受的观察点：完整返回和 `onStep` / `onBattleProgress` / `onRound` 抛出哨兵而截断的路线均覆盖；一次转换本身断言失败时，不把未被接受的候选态拿来替代前一次可信观察。原始转换断言保留。

## 调用方排查

执行 `git grep -n checkH3Growth`，并追踪 `Ledger.apply` / `new Ledger` / `Ledger.prototype` 的间接调用。直接路线在 H3 房间测试中；间接路线在公共路线生成器、B8 前缀/返回路线、Heroic Grab Bag 前缀和 19 个 Herald 录制工具中。

| 文件:行 | 改动 |
| --- | --- |
| `tests/fixtures/m5/h3-growth-oracle.cjs:52` | 导出只读 `auditH3` 全量审计。 |
| `tests/fixtures/m5/oracle.g2.cjs:745` | `Ledger.audit`，并补导出和 `.d.cts` 类型。 |
| `scripts/generate-m5-route.cjs:66` | 完整和截断路线统一在 `finally` 收尾审计。 |
| `tests/augment-pool-batch5-h3-oracle.test.ts:67` | 重连前后、路线返回前和新旧账本轨迹对照末尾全量审计。 |
| `tests/m8-b8-oracle.test.ts:26` | `prefixLedger`（含零长度前缀）、D14 返回截断、重复失败命令后的末尾审计。 |
| `tests/m5-oracle-augment-ledger.test.ts:420` | 截取 Heroic Grab Bag 前缀之前审计。 |
| `scripts/benchmark-h3-oracle.cjs:36` | 原基准账本无新入口时，用其原有整份检查实现基准兼容，保留原 fixture 字节和逐步判定位。 |
| `tests/fixtures/record-g2-3-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（96）。 |
| `tests/fixtures/record-g2-4b-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-opening-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（96）。 |
| `tests/fixtures/record-v15-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v16-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v17-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v18-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v19-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-black-market-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-chem-baron-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-live-combat-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-traits-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v20-xp68-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v21-opening-encounters-herald.cjs:43` | 前缀快照前、完整观察路线末尾（46）、装备分支末尾（97）。 |
| `tests/fixtures/record-v22-online-rules-herald.cjs:46` | 前缀快照前、完整观察路线末尾（49）、装备分支末尾（100）。 |
| `tests/fixtures/record-v23-online-rules-herald.cjs:46` | 前缀快照前、完整观察路线末尾（49）、装备分支末尾（100）。 |
| `tests/fixtures/record-v24-online-rules-herald.cjs:47` | 前缀快照前、完整观察路线末尾（50）、装备分支末尾（101）。 |
| `tests/fixtures/record-v25-online-rules-herald.cjs:47` | 前缀快照前、完整观察路线末尾（50）、装备分支末尾（101）。 |

`m5-route.test.ts`、`m5-replay-helper.ts`、`verify-m5-headless.cjs` 等复用公共生成器，继承统一收尾；无需在所有包装器重复审计。旧 `generate-m5-route.p3p4p5.cjs` / `update-m8-b8-golden.cjs` 使用独立旧 `oracle.cjs`，该账本没有 H3 引用缓存，不属于本次漏洞。孤立单步正反例不作为路线末尾追加审计。

## 新回归覆盖

- `tests/h3-growth-oracle-fast.test.ts`：facts、resources、results、receipts 四类历史各覆盖“最后边界后同一对象就地篡改，后续快检查暂不报错，收尾全量审计报错”；对照旧账本也拒绝，并验证失败不改账本。
- 同四类历史覆盖“篡改后恢复，收尾通过；恢复之前的强制检查点拒绝”，保留脱离原对象的历史快照。
- `tests/augment-pool-batch5-h3-oracle.test.ts`：两种真实房间强化的重连观察点，分别验证旧记录字段篡改会报错，改回后通过。
- `tests/m5-route-h3-audit.test.ts`：真实 seed 230 公共命令路线，在三种回调截断出口篡改已观察结算记录，必须由收尾审计报错；干净截断及改后恢复仍保留原哨兵错误。

## seed 230 单次前后计时

相同命令各执行一次：`node scripts/generate-m5-route.cjs cannon 230`。修复前 **80.522 秒**，修复后 **78.159 秒**，差 **-2.363 秒（-2.93%）**。使用驱动自身的 `summary.durationSeconds`；单次波动不构成性能提升结论。计时路线没有并行运行其他路线或 Vitest；修复后计时前段有 TypeScript 检查。

剔除 `durationSeconds` / `tickTimingMs` 后，完整摘要及经济账本成本 JSON 深比较相同：6-7 胜利、10661 ticks、288 条命令、100 HP、141 金币。原始输出在 `/tmp/h3-tail-before.json` / `/tmp/h3-tail-after.json`，不提交。

## 验证

测试文件（均使用 `--configLoader runner --maxWorkers=2 --no-file-parallelism`）：

1. `tests/h3-growth-oracle-fast.test.ts`
2. `tests/augment-pool-batch5-h3-oracle.test.ts`
3. `tests/m5-route-h3-audit.test.ts`
4. `tests/m5-oracle-augment-ledger.test.ts`
5. `tests/m8-b8-oracle.test.ts`
6. `tests/m5-route.test.ts`

六个文件合计 **173 项全部通过**：前四文件 140 项（19.45 秒）、B8 文件 25 项（143.98 秒）、M5 路线文件 8 项（179.33 秒）。最终 `npm run typecheck`（`tsc --noEmit`）、`git diff --check` 均通过。新增回归共 15 项（四类历史各两项、两个真实 H3 重连观察点、五个路线截断用例）。

验证命令：

```sh
export PATH=$HOME/.local/bin:$PATH
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- --configLoader runner --maxWorkers=2 --no-file-parallelism tests/h3-growth-oracle-fast.test.ts tests/augment-pool-batch5-h3-oracle.test.ts tests/m5-route-h3-audit.test.ts tests/m5-oracle-augment-ledger.test.ts
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- --configLoader runner --maxWorkers=2 --no-file-parallelism tests/m8-b8-oracle.test.ts
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- --configLoader runner --maxWorkers=2 --no-file-parallelism tests/m5-route.test.ts
npm run typecheck
git diff --check
```

上述 Vitest 用例不需要浏览器；占位端点仅用于让现有 globalSetup 跳过 Chromium 启动，不建立连接。23 个改动 CJS 文件均通过 `node --check`。19 个录制工具只做语法检查，未重新生成历史录制或 golden。

全量审计只能发现检查点当时仍存在的差异；若两次检查点之间改后恢复，最终状态没有差异，收尾审计不会追溯该瞬时改写。因此重连等有意义的观察点需要显式调用本入口。
