# B5 equipment history：v25 缓存与路线审计

基线：`claude/sol-m8b5 @ 7c8c0bd8`（已经包含 PR #479 除 B5 文件外的改动）。
只修改测试和本文；不修改 src、玩法数值、期望值、超时、购买预算、循环上限或录制夹具。

## 结论

不能把 B5 的 XP 变化归因于 g4 缓存或生产代码不确定性。本次没有复现相同完整输入在 src 内得到不同 XP。
查出一个可独立复现的 **fieldedRoute 缓存污染**，以及 B5 自身两个确定的路线问题；三者不能混为同一原因。

1. `tests/augment-stage-helpers.ts:143`：旧 `fieldedRoutes` 只按 seed 缓存。先运行自然路线，再安装脚本化抽牌，同样的 seed/node 会读到自然抽牌状态。
   修为 `[seed, b1OfferCacheKey()]`；节点仍在该路线的 `entries` 中单独索引。B5 不调用 fieldedRoute，因此此缺陷不是 B5 XP 跳动的直接证据。
2. `tests/m8-b5-equipment-history.test.ts:25`：v25 下 seed 42 不再自然提供碎裂水晶，原强化优先级不是强制出牌。
   在整个 B5 describe 中安装、清理既有 `installB1Offers(['fractured-crystals'])`，使构建和恢复历史使用相同的纯抽牌策略。
   只改变 2-1：选中后候选池排除已拥有的碎裂水晶，后续节点不再注入；添加唯一取得记录自检，明确不是自然随机出牌证明。
3. `tests/m8-b5-equipment-history.test.ts:44`：原来先买牌、后上场。每轮 `emptyBoard` 把棋子放满备战席，买牌遇到 `bench-full` 立即结束补强循环，阵容长期停在一星，最终 4-3 出局。
   只把原有上场循环移到原有购买循环之前；保留原位置算法、目标英雄、预算和全部上限。装备与不装备两条路线均能保持原 `[6,2]` 及历史装备断言。

## 缓存最小复现

保留在 `tests/b5-fixture-cache.test.ts` 第一例：

```ts
resetFieldedRouteCache();
fieldedRoute(42, '2-1'); // 先缓存自然路线
withB1Offers(['fractured-crystals'], () => {
  const cached = fieldedRoute(42, '2-1');
  resetFieldedRouteCache();
  const rebuilt = fieldedRoute(42, '2-1');
  expect(cached).toEqual(rebuilt);
});
```

修复前，同一脚本作用域中的两次相同参数调用得到不同 offers：
缓存为 `['sorcerer-crest','not-today','voidcaller']`，重建为 `['fractured-crystals','not-today','voidcaller']`。
差异来自缺失脚本上下文的缓存键，不是 RNG 或 XP 运算不确定。
修复后该断言和独立 `reachRoundFielded` 对照均通过，退出包装后恢复自然抽牌。
第二例验证 B8 自然/脚本准备缓存隔离，并把缓存结果与绕过战斗、准备缓存的完整历史构建对照。

## Cursor 路线的 XP 依据

PR #479 的 `rerollForAugment:true` 会在 3-2 仍找已经拥有、不能再出现的碎裂水晶，耗尽三格重掷。
该路线选中 `slammin-plus`，不是碎裂水晶发 XP。

- `src/simulation/content/augment-pool-batch4-b4xp.ts:67`：物尽其用+取得给 10 XP，满足库存条件的 PvP 另给 2 XP。
- `src/simulation/augment-pool-batch4-b4xp-progress.ts:10`：读取战斗结束、掉落前的库存条件。
- 同一 worker 中使用全新 CompletedBattleHistory 连续三次重建脚本化、开启 reroll 的路线，均为 `[6,22]`；3-5 为 `[5,18]`，3-6 为 `[6,2]`，3-7 为 `[6,6]`，4-1 为 `[6,8]`，4-2 为 `[6,12]`，4-3 为 `[6,16]`，4-5 为 `[6,22]`。
- 没有复现所述 `[6,12]/[6,20]/[6,22]` 在完全相同输入间变化，不能宣称已经解释 Cursor 的每次波动。
  其中 2 XP 的差额与该强化库存条件有关，但没有对应逐次原始输入，不能据此推断当时是哪一步改变。

该策略不按 mock 调用次数计数；历史验证重放 2-1 时仍能生成相同 offers。

最终没有引入 `rerollForAugment:true`，不需要改 XP 期望，原 `[6,2]` 保持不变。

## 其他缓存边界

- `tests/fixtures/b8-public-equipment.ts:94` 的准备键已经包含 seed、组件列表及顺序、强化选择优先级、最早轮次、是否重掷、脚本化抽牌元数据。history 不入键：它只控制是否完整记录战斗；记录构建绕过缓存，产物须与状态缓存相等。
- `finishedBattles` 以完整输入 MatchState 序列化作为键，返回脱离缓存的副本；当前战斗路径不生成新的强化三选一。
- B5 的私有 `progressionCache` 只在本文件固定抽牌策略中使用，以是否装备为键；history 构建绕过它。
- `partialRoutes` 与准备缓存共用同一完整路线键，throughRound 只决定暂停点；记录构建不使用暂停状态。
- `tests/fixtures/g4-run-cache.ts:9` 按 namespace 和完整键 SHA-256 定位，global setup 每次调用创建全新临时目录，原子发布。未发现跨调用旧文件复用证据。
- `tests/fixtures/b1-offer-cache-key.ts:2` 保存冻结的优先级副本；既有包装在 finally 清理。本次的 fieldedRoute 漏用了此元数据，B8 准备键已经使用。

## 验证

稳定性日志位于被 gitignore 的 `artifacts/b5-stability/`，不提交；其中也保留修复前 B5 失败、fielded 缓存反例与三次 Cursor reroll 路线的原始日志。
实际重复运行结果：

- B5 单跑十次：10/10，每次 9/9 全过（首次重复约 67 秒，末次约 68 秒）。
- B5 → batch3，同一 worker，三次：3/3，每次 2 文件、93/93 项通过（102.49 / 104.68 / 103.94 秒）。
- batch3 → B5，同一 worker，三次：3/3，每次 2 文件、93/93 项通过（107.54 / 105.94 / 107.05 秒）。
- 缓存最小复现与 B8 对照：最终复跑 2/2 通过。
- `tsc --noEmit`：初次通过；删除临时排序配置后的最终复跑退出码 0，通过。

所有 Vitest 命令带 `--configLoader runner`；单文件用 `--maxWorkers=3`，混跑用 `--maxWorkers=1`，沿用 fast 项目的 `isolate:false`。
混跑使用临时顺序配置，继承原 vitest.config，只替换 sequencer 为显式的两文件顺序，并输出排序结果；两个方向同时反转命令中的文件参数，避免 Vitest 的耗时排序使“反序参数”实际仍同序。该临时文件验收后删除，副本保存在忽略目录。
临时文件曾放在 `tests/fixtures/`，使 tsc 额外纳入平时不在 tsconfig include 中的根 `vitest.config.ts`，报告其第 47 行 `number` 不能赋给 `0 | 900` 的既有推断错误。已删除测试目录中的临时文件；复跑以最终交付的原项目范围为准，未修改根配置。该次日志保留为 `tsc.log`，最终检查为 `tsc-final.log`。
这些测试不需要浏览器；运行时用无连接的 `PLAYWRIGHT_WS_ENDPOINT=ws://127.0.0.1:1` 让现有 global setup 跳过启动浏览器，没有建立浏览器连接。

混跑顺序配置可按以下内容存为 `artifacts/b5-stability/order.config.ts`（其余配置完全继承）：

```ts
import { basename } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import base from '../../vitest.config';
class B5Order extends BaseSequencer {
  override async sort(files: TestSpecification[]) {
    const order = process.env.B5_TEST_ORDER!.split(',');
    const sorted = [...files].sort((a,b) =>
      order.indexOf(basename(a.moduleId))-order.indexOf(basename(b.moduleId)));
    process.stdout.write('B5 file order: '+sorted.map(f=>basename(f.moduleId)).join(' -> ')+'\n');
    return sorted;
  }
}
export default { ...base, test: { ...base.test, sequence: { sequencer: B5Order } } };
```

```sh
export PATH=$HOME/.local/bin:$PATH
export PLAYWRIGHT_WS_ENDPOINT=ws://127.0.0.1:1
# 单跑：重复十次，每次均包含全部 9 项。
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/m8-b5-equipment-history.test.ts
# 两个方向各重复三次，排序输出也须对应反转。
B5_TEST_ORDER=m8-b5-equipment-history.test.ts,augment-pool-batch3.test.ts node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --config artifacts/b5-stability/order.config.ts --maxWorkers=1 tests/m8-b5-equipment-history.test.ts tests/augment-pool-batch3.test.ts
B5_TEST_ORDER=augment-pool-batch3.test.ts,m8-b5-equipment-history.test.ts node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --config artifacts/b5-stability/order.config.ts --maxWorkers=1 tests/augment-pool-batch3.test.ts tests/m8-b5-equipment-history.test.ts
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=3 tests/b5-fixture-cache.test.ts
npm run typecheck
```
