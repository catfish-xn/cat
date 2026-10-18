# PR #164 合入 multiplayer 验证报告

- 验证日期：2026-10-18 UTC。
- 原 PR HEAD：`c0fe4c1406e60f8d20ec825c9c82767fda23783d`。
- 合入基线：`563a7f9245b2ed297d241efc766875af5270d3f2`，含 #166；开工及冻结前两次 `ls-remote` 一致，#168 尚未合入。
- 分支：`codex/bracer-multikill-stacks`；使用 merge，保留两条父历史。
- 本报告和冲突解法、重录当前规则夹具位于同一合并提交；最终完整 SHA 见交付包 `DELIVERY.md`（不自引用提交哈希）。
- 环境：Node v24.19.0、npm 11.9.0；与已有工作树 package-lock.json 完全一致，复用其已安装依赖。测试逐文件串行运行，没有全套、重试、改时限或跳过。

## 冲突与保留内容

仅两处文本冲突，均为文件头 import/type 接合：

1. `src/simulation/m8/item-program.ts:5-11`：保留 #153 的 `grantedItemPrograms`，采用 #164 的 `TargetLimitedTrigger`。其余赠装程序、编译、验证逻辑保留。最终片段：

```ts
import type { TargetLimitedTrigger } from './triggers';
import { grantedItemPrograms } from './combat-item-programs';
export type ItemTrigger = Omit<TargetLimitedTrigger, 'source'> & { readonly initialAlso?: true };
```

2. `src/simulation/m8/item-restore.ts:1-8`：保留 multiplayer 的 `MAX_COMBAT_TICKS` 及 #164 的 `TargetLimitedTrigger`，移除不再使用的 `TriggerDefinition` 类型导入。最终片段：

```ts
import type { TargetLimitedTrigger } from './triggers';
import type { CombatUnit } from '../combat-types';
import { MAX_COMBAT_TICKS } from '../combat-types';
import type { Effect, Source, StatusApplication } from './contracts';
```

`triggers.ts` 自动合并；target actionKey 第五项仍是被击杀目标，只给护臂 kill/assist 声明启用，其他装备维持原动作级限额。

恢复链路保留：
- `item-restore.ts:30-39,57-69` 将 effect 绑定所属已编译 trigger，层数上界按相同持有者、装备实例、来源与结算收据校验。
- `item-restore.ts:174-195` 保留 combat tick 上界、按 target/action 两种键形状核对 actionCounts，与 triggerCount 一致。
- multiplayer 的逐轮 `(fixed, flat, bps)` 去重、赠装 periodic/cap/可信 sampledAtTick、恢复调用局部缓存、护盾可信来源核对全部保留。
- `restore-combat-replay.ts`、`m8/sampled-stat-facts.ts` 与所合 multiplayer 逐字节一致；后者第55行从真实开战重演整份 triggerLedger，和上述局部 effect/收据绑定同时成立。
- 额外只读静态复核检查了上述差异，不冒充独立正式签收。

## 指纹与当前规则夹具

按用户指定顺序执行，三个命令均 exit 0：

```sh
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node scripts/record-g2-3-inputs.cjs --check
```

Herald 5 条公开命令生成路线均通过原始状态恢复及续战15tick；生成耗时39.736秒。未使用 `verify-m8-herald-fixtures.cjs --write`。

没有改任何版本字符串或 policy revision。内容自动摘要因原有护臂 target 声明纳入新基线，得到 `fnv1a32-utf16:8e5d6983`（multiplayer 原为 `fnv1a32-utf16:d6c9bf1b`）。当前5份原始存档的字段差异仅 contentDigest；轨迹无玩法差异。manifest 按真实源哈希更新，不是手填 golden。

`tests/fixtures/g2-augments-herald-raw/` 与合入的 multiplayer 完全无差异。当前规则夹具的逐文件前后字节数/SHA256保存在 `fixture-byte-evidence.json`；inputs 9 项重算与 --check 通过。

## 实测结果

命令：每个文件分别 `npm test -- <文件> --reporter=default --reporter=json --outputFile=<证据路径>`。下表耗时是整个命令墙钟时间，含启动/收尾；JSON 保留每个用例的独立时长。

| 文件 | 通过/总数 | 失败 | 墙钟秒 |
|---|---:|---:|---:|
| `tests/bracer-multikill-stacks.test.ts` | 25/25 | 0 | 10.606 |
| `tests/explorer-bracer-restore.test.ts` | 24/24 | 0 | 3.751 |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2/2 | 0 | 2.139 |
| `tests/m8-b7-audit-vectors.test.ts` | 14/14 | 0 | 24.257 |
| `tests/m8-b7-catalog.test.ts` | 5/5 | 0 | 0.837 |
| `tests/m8-b7-cleanup.test.ts` | 5/5 | 0 | 1.794 |
| `tests/m8-b7-known-limitations.test.ts` | 2/2 | 0 | 1.416 |
| `tests/m8-b7-match-wiring.test.ts` | 30/30 | 0 | 20.301 |
| `tests/m8-b7-mechanisms.test.ts` | 21/21 | 0 | 1.513 |
| `tests/m8-b7-serialization-reuse.test.ts` | 6/6 | 0 | 2.220 |

合计 10 文件、134/134 通过，0 失败、0 跳过；typecheck exit 0，10.560秒。未运行全套或远端CI。原始日志和 JSON 在交付包 logs/。

## 自行决定与未完成

- 为完整覆盖用户“m8-b7”范围，逐个运行全部7个 m8-b7 文件；没有扩大到全套。
- 不改两边任何断言/时限，不引入新优化；保留既有目标逐个计层规则，不升版本。
- 冻结前远端仍为563a7f9，未合尚未进入 multiplayer 的 #168。后续基线变化需另行同步验证。
- 既往写入限制仍未解除，本轮没有再次尝试 push 或绕过；提供已 verify 的 git bundle，供正常导入。远端 PR 尚未更新、CI 未执行，本地通过不能替代后续 CI。
