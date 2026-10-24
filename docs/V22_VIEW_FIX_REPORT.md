# v22 候选：奇遇投影读取修复

分支 `codex/v22-view-fix`，基线 `1b0e72b5`。仅修改 simulation 的只读读取边界、增加回归测试和本文档；不改规则数值、内容身份、历史夹具、CI、服务器或界面代码。未联网、未提交。

## 修复与接口

`toPrivateSeatView` 输出的 `openingEncounter` 是公开白名单，只有顶层 `encounterId/configVersion` 等展示信息，没有权威 `mode/selection/context/receipts`。客户端 `toDisplayMatch` 保留该投影；棋盘调用 `readLootView → unclaimedOrbPlans → openingRewardAtoms` 时，原代码误读 `selection.encounterId`。其他奇遇 reader 也存在同类结构假设。

新增只读输入类型及 selector（均在 `src/simulation/opening-encounter.ts` 导出）：

```ts
interface OpeningEncounterProjection {
  readonly configVersion: string;
  readonly encounterId: OpeningEncounterId;
  readonly revealedFacts?: readonly {readonly nodeId: string; readonly outcome: MonkeyOutcome}[];
}
interface OpeningEncounterReadState {
  readonly openingEncounter?: OpeningEncounterState | OpeningEncounterProjection | null;
}
readOpeningSelection(state: OpeningEncounterReadState): OpeningEncounterSelection | null
openingEncounterId(state: OpeningEncounterReadState): OpeningEncounterId | null
readOpeningEncounterView(state: OpeningEncounterReadState, shared?: OpeningEncounterContext): OpeningEncounterView
readOpeningMelProgress(state: OpeningEncounterReadState): OpeningMelProgress
```

- solo 从 `context.selection` 读取，shared 从 `selection` 读取；shared-deferred、缺字段返回不可用（`null` 或空数组）。
- 公开投影直接读取已公开身份；`readOpeningEncounterView` 重建展示白名单，保留已公开猴子结果，不透传额外字段。
- 投影没有权威收据，因此 batch A 不重建订阅收据、奖励 atom/orb，锻造器及梅尔 reader 不推导个人进度；已有投影个人进度字段仍由客户端直接使用。
- 不从客户端占位 seed/RNG 重抽奇遇或推算奖励。完整权威状态计算路径不变；`validateOpeningEncounterState` 仍拒绝缺字段状态。
- 没有新增失败枚举；现有未知奇遇/配置版本不匹配仍抛 `opening-context-mismatch`。

新增测试 `tests/opening-encounter-projection.test.ts`：全部 16 种奇遇的 solo/shared、真实 private seat view 经 JSON 传输、公开视图、实际 `toDisplayMatch` 及 `readLootView` 路径；另覆盖 deferred/null/缺失 selection/context、权威校验拒绝、猴子公开结果、无状态/RNG修改及不推导奖励。

## 用户指定的两项候选失败

### `tests/m5-audit-boundaries.test.ts`：旧独立审计器未适配螃蟹承载者

`beforeAll` 的 cannon/seed 42 路线在 1-2 即触发 `tests/fixtures/m5/oracle.g2.cjs:192` 的 `earned source must be dead`，导致该组 7 项跳过，其余 13 项通过。

实际证据：奇遇 `scuttle-puddle`；原掉落来源 `["pve","1-2","minions-a-v1","m01"]` 映射到 `["pve","1-2","scuttle-puddle/1-2","c0"]`。真实 `neutralReceipts.deaths` 中 c0 于 tick 164、eventSeq 88 死亡；掉落 `earnedEvidence.death` 同为 `combatId=round-1/tick=164/eventSeq=88`。这是 `opening-crabs.ts` 的既有原槽位→螃蟹承载者规则；旧独立 oracle 仍硬查原怪物的存活状态。

结论：规则启用后的旧预期，不是本修复引入的代码 bug。保留该断言及夹具；v22 统一录制时需同步独立审计器对承载者身份的验证，继续严格核对实际死亡、唯一性及收据边界。

### `tests/rendering3d-scout-shop.test.ts`：未复现失败

改动前两文件合跑、单独运行，该文件均为 15/15 通过。没有足够证据将此前的一项失败认定为规则旧预期或具体代码 bug；保留全部测试与断言，不做猜测性改动。

## 扩展验证中已有的旧预期

额外运行 PR2/PR6 后出现 15 项失败；临时用 HEAD 原版的两个 simulation 文件重跑，同样是 **15 失败 / 58 通过**，随后恢复修复文件。

- PR2：1 项，enabled 列表仍只列早期启用的奇遇。
- PR6：14 项，仍预期梅尔奖励关闭（资源、事件、blocked-evidence 及收据）、沃里克接口一律 `opening-config-incomplete`。

保留所有旧断言，交由 v22 统一处理。本次不处理 v21 身份审计。

## 运行方式

共享 `node_modules` 为只读符号链接，默认 Vite 配置打包会写 `.vite-temp` 并报 EROFS。验证使用 `npm test -- --configLoader runner --no-file-parallelism ...`，未修改仓库配置或依赖。

最终通过：

- `npm test -- --configLoader runner --no-file-parallelism tests/opening-encounter-projection.test.ts tests/opening-encounters-batch-a.test.ts tests/opening-encounters-batch-b.test.ts tests/opening-encounters-pr5.test.ts tests/rendering3d-scout-shop.test.ts tests/server/local-room-client.test.ts`：6 文件、234 项通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

M5 及 PR2/PR6 保留的旧预期失败如上，不将相关测试标为全绿。
