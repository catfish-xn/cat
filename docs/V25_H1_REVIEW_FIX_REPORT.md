# v25 H1 审查修复报告

基线：`codex/v25-h1`，HEAD `f59956b6af153a74eab6e200c704efc285bd1fe1`；开工时工作区干净。本次只修改工作区文件，未执行 Git 写操作。

## 结论与接口

已修复 P1：联机「由二生D」下一自然轮的 HUD 免费刷新次数由服务器计算、按私有白名单下发，客户端读取数值。领域规则、历史鉴权、资源消费、内容版本与 digest 均未修改，不下发完整历史，不把缺失历史当成零。

- `server-entry.freeRerollsAvailable(state: MatchState): number`：重导出既有领域查询；输入必须为权威状态，非法历史异常继续传播，无新增业务失败枚举。
- `SeatStateView.freeRerollsAvailable: number`：必填私有字段，由 `toSeatPrivateView` 调用上述查询获得；公共投影不包含该字段。
- `DisplayMatch.freeRerollsAvailable?: number`：保存服务端字段；`readFreeRerollsAvailable(state): number | null` 只读非负安全整数，不推导次数。尚无私有状态或字段无效时返回 null，HUD 显示“D · 刷新”，不虚报零次或金币费用。
- 在线 HUD 切换到私有字段读取；离线分支保持原调用。协议仍为版本 1；客户端、服务端应一起交付。

合同已补充至 [MULTIPLAYER_CONTRACT.md §14.5](MULTIPLAYER_CONTRACT.md#145-v25-h1-可用免费刷新次数私有投影2026-10-27)。

## 所有生产调用点

扫描 `src/**/*.ts` 中本次相关读取、投影和消费函数的直接调用；以下包含全部命中，定义和重导出单列。

| 文件及行号 | 调用及用途 |
| --- | --- |
| `src/server/room/projection.ts:183` | `freeRerollsAvailable(match)`：权威状态计算，写入私有字段。 |
| `src/server/net/server.ts:351` | `toSeatPrivateView(seat.match, seat.choiceDeadline)`：网络 state 消息统一入口，含首次、增量与重连。 |
| `src/rendering/online/local-room-client.ts:137` | `toDisplayMatch(toSeatPrivateView(match))`：本地联机客户端使用相同投影。 |
| `src/rendering/online/ws-client.ts:363` | `toDisplayMatch(view)`：网络 state 消息转展示状态，数值原样保留。 |
| `src/rendering/BoardScene.ts:1038` | 在线调用 `readFreeRerollsAvailable(match)`；离线才调用 `freeRerollsAvailable(match)`。 |
| `src/simulation/free-rerolls.ts:32` | `spendFreeReroll` 内调用 `freeRerollsAvailable(state)`：领域消费判定，保持不变。 |
| `src/simulation/shared-pool.ts:223` | `spendFreeReroll(state)`：共享卡池刷新事务消费次数，保持不变。 |
| `src/simulation/match.ts:375` | `spendFreeReroll(state)`：原 Match 刷新命令消费次数，保持不变。 |

定义与导出：`src/simulation/free-rerolls.ts:27/31`；`src/server-entry/index.ts:52`；`src/server/protocol.ts:120`；`src/server/room/projection.ts:179`；`src/rendering/online/seat-view-adapter.ts:46/91`。

## 回归覆盖

`tests/augment-pool-batch5-h1-room.test.ts` 在真实 Room 中通过 choose、claimOrb、deploy、reroll 等公共命令选取并使用「由二生D」，走 `toSeatPrivateView → JSON 往返 → toDisplayMatch → readFreeRerollsAvailable`，覆盖：

1. 选取当轮为零；下一自然轮获得正数次数。对同一展示状态调用旧领域 reader，仍明确断言抛出 `missing augment-history-v1`。
2. 免费刷新逐次扣次数、不扣金币；耗尽后刷新扣 2 金币；失败命令不改变状态或次数；重复投影不消费。
3. 历史、证明、RNG 不进入私有 JSON；次数不进入公共视图；删除权威历史后服务端查询仍抛错。
4. PvP、补给间隔及 PvE 后的自然轮累计正确，继续保留存档 object/JSON 鉴权和篡改拒绝断言。
5. 可选建议已增补独立证据：测试订阅首次 battle 发布，复制己方开战阵容，以测试侧固定 `COST` 表独立推导次数，并对比生产历史阵容。新 oracle 不读取生产历史事实；通用 `oracle.g2.cjs` 原有断言仍保留，未删除。

`tests/free-rerolls-projection.test.ts` 覆盖零值、缺失与非法字段的区别，并用抛错 getter 确认客户端 reader 不读取历史。

## 验证与约束

相关测试 **8 文件、138 项全部通过**（75.52 秒）；`npm run typecheck`（`tsc --noEmit`）通过；`git diff --check` 通过。运行的文件：

- `tests/free-rerolls-projection.test.ts`
- `tests/augment-pool-batch5-h1-room.test.ts`
- `tests/augment-pool-batch5-h1-clock.test.ts`
- `tests/augment-pool-batch5-h1-shared.test.ts`
- `tests/augment-pool-batch5-h1-value.test.ts`
- `tests/augment-history.test.ts`
- `tests/server/projection.test.ts`
- `tests/t5r-private-seat-view.test.ts`

复现命令（临时配置见下文）：

```sh
node node_modules/vitest/vitest.mjs run \
  --config artifacts/v25-h1/vitest.node.config.mts --configLoader runner \
  --project fast --maxWorkers 1 \
  tests/free-rerolls-projection.test.ts tests/augment-pool-batch5-h1-room.test.ts \
  tests/augment-pool-batch5-h1-clock.test.ts tests/augment-pool-batch5-h1-shared.test.ts \
  tests/augment-pool-batch5-h1-value.test.ts tests/augment-history.test.ts \
  tests/server/projection.test.ts tests/t5r-private-seat-view.test.ts
npm run typecheck
```

额外运行现有 `tests/server/projection-wire.test.ts -t 'B7 private seat view on every state path'`：本地客户端的推送/成功/拒绝投影用例 **1 项通过**；WebSocket 初始化及失败快照测试均在监听 `127.0.0.1` 时被沙盒拒绝（`listen EPERM`），未能验证真实套接字首次推送/增量/重连。该筛选执行记录为 1 个 suite 失败、1 个 case 失败、1 个 case 通过、7 个跳过（含筛选外用例），不能记为网络验收通过。未申请或尝试扩大权限。

默认 `npm test` 在配置加载时因共享只读 `node_modules/.vite-temp` 写入失败（EROFS），未进入测试。实际验证使用忽略目录内的 `artifacts/v25-h1/vitest.node.config.mts`，继承仓库配置，将缓存移入工作区，仅对 Node 测试取消全局浏览器启动钩子；使用 `--configLoader runner --project fast --maxWorkers 1`，未修改任何测试超时。

未运行 build、完整对局验收、浏览器或单人专项；未修改 `src/simulation`，未启动浏览器、未新增超时、未删除既有断言。

本次变更的 `src/server/protocol.ts`、`src/server/room/projection.ts` 中，`setTimeout`、`Date.now`、`performance.now`、独立单词 `window` 均零命中；新增差异也零命中。全目录基线已有命中，保持原样：

| 既有位置 | 内容 |
| --- | --- |
| `src/server/net/test-client.ts:13/86/112` | `setTimeout` 类型及既有测试客户端计时器。 |
| `src/server/room/real-clock.ts:4/5/12` | `performance.now` 注释与既有时钟实现。 |
| `src/server/room/real-clock.ts:10/15` | `setTimeout` 类型与既有时钟调度。 |

全目录无 `Date.now` 或独立单词 `window`。这些既有基础设施未纳入本次投影修复范围。

## 次数读取函数的全部测试调用位置

扫描全部 `tests/**/*.ts`，逐行列出 `freeRerollsAvailable(...)` 与 `readFreeRerollsAvailable(...)` 调用；同一行多次调用只列一次。此清单是静态调用审计，不表示运行了所有这些测试。

| 文件 | 行号 |
| --- | --- |
| `tests/augment-batch3-verify-public.test.ts` | 176, 180, 380, 386 |
| `tests/augment-pool-batch3-xp.test.ts` | 95, 96, 102, 125, 128, 142, 150 |
| `tests/augment-pool-batch3.test.ts` | 164, 178 |
| `tests/augment-pool-batch4-b4reroll.test.ts` | 42, 43 |
| `tests/augment-pool-batch5-h1-room.test.ts` | 41, 42, 47, 80 |
| `tests/augment-pool-batch5-h1-value.test.ts` | 37 |
| `tests/augment-pool-batch5-shared.test.ts` | 14 |
| `tests/augment-pool-batch5.test.ts` | 79 |
| `tests/augment-pool-shop.test.ts` | 89, 298, 306 |
| `tests/free-rerolls-projection.test.ts` | 10, 12, 14, 18 |
| `tests/server/batch5-dual-purpose-room.test.ts` | 26, 30 |
| `tests/shop-history.test.ts` | 194, 200, 201 |
| `tests/v23-tamper-batch4.test.ts` | 67 |
