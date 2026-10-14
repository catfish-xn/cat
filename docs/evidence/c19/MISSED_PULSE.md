# SR-C19-01 / 窗口 4：日炎新贡献的首跳对齐

修复分支 `codex/c19-missed-pulse`，基线 `origin/multiplayer@88f9385`。
只改 `src/simulation/`、`tests/`、`docs/`。

## 复现与根因

在 `origin/claude/c19-full-match@e7d2a9c` 工作树运行：

```sh
node tests/server/e2e/repro-missed-pulse.mjs 9
```

结果：6-1、`repro:r32:b0`，`resolver-error: Missed periodic pulse; never backfill`。
生成的 `artifacts/repro-missed-pulse/seed-9.json` 可直接传给
`resolveTwoSidedBattle(input, 5000)`，同样在推进至 tick 161 时抛错。
原文件 SHA-256：`98e03bf361fd9c913f4bcd2c3cbe55ebfc685b2aa4e7e009c27bba768d5c4f24`。

逐 tick 检查 irelia（s3/unit-15）：

| 时点 | 来源 | appliedAtTick | nextPulseAtTick | pulseOrdinal | expiresAtTick |
| --- | --- | ---: | ---: | ---: | ---: |
| tick 159 末 | s4/unit-15 日炎 | 120 | 160 | 1 | 320 |
| tick 160 末，旧实现 | s4/unit-15 日炎 | 120 | 180 | 2 | 320 |
| tick 160 末，旧实现 | s4/unit-34 日炎，新贡献 | 160 | **160** | **0** | 360 |
| tick 160 末，修复后 | s4/unit-34 日炎，新贡献 | 160 | **180** | **0** | 360 |

`maintainMechanisms` 在阶段入口先冻结每组本拍 burn winner，再逐单位处理周期任务，
最后统一调用 `advanceBurnClock`。目标位于来源之前：目标的旧灼烧在 160 已经推进；
随后 s4/unit-34 的日炎选敌定时器创建第二个来源贡献，`synchronizeBurnTask`
却复制尚未统一推进的组时钟 160。阶段末组时钟变为 180，新任务仍停在 160。
该任务直到 161 才第一次进入 `advancePeriodicTask`，因此正确触发 never-backfill 检查。
没有不可选中、位移、复活、两侧合并或清理后重挂问题，也与切片预算无关。

另一个顺序边界：若持有者先处理，旧实现会在同拍访问新任务，虽因 winner 已冻结而不付款，
却把新任务 `pulseOrdinal` 提前计为 1。新增双顺序用例同时排除这两个分支。

## 修复与数值依据

只在**施加新 burn 贡献、没有已有同 key 任务、组时钟恰等于施加 tick**时，
将新任务的首跳设为组时钟 +20；不修改组的当拍 winner，不触碰已有任务的相位。
初始化重建已有贡献不传施加 tick，仍允许本拍应到期的任务正常执行。
非到期拍加入已有组仍沿该组相位（例如 41 施加、组下跳 60，保持 60）。
同源刷新仍保留任务 ordinal、相位及分数余数。

依据 `docs/M8_RULES.md` §5 和 B1 来源 `item-review-b.json` B-01/B-08：
50ms/tick；日炎选敌周期 40 tick；灼烧周期 20 tick，持续 200 tick，含到期末跳。
单次 t=160 施加应于 180、200、…、360 付款，共 200/20=10 次，
不能在施加的当拍凭空增加一次。2015 最大 HP、100 Bps 每跳精确 20.15，
10 次累计取整为 201；同源从 tick 0 已存在并在 40 刷新的控制向量共 12 次，累计 241。
`advancePeriodicTask` 完全未改，真正错过的任务继续抛错，既无回填也无静默跳过。

## 夹具与回归

`tests/fixtures/c19-seed-9-minimal.json` 是原始输入逐项删除单位及对应物品、成长、
海克斯、异常绑定后，用公共 `compileBattle` 重新生成的完整编译输入。
保留 s3 的 Ezreal/Garen、s4 的 Urgot/Caitlyn 和后者两件日炎；没有新增属性或装备。
移除投资策略时连同 `investmentHp` 清零以保持快照合法。反复删除至无法再单独删除
任何一个单位或任一件日炎并保留同一异常。仍保留原种子 `3706951144`、轮次和身份。
夹具 SHA-256：`e33083871bb0e41b6ec81931c7a90fe62430075a76f633826c56c5620546d594`。

缩减输入旧实现在 tick 161 抛错；修复后 tick 244 以 enemyWin 结束。
Ezreal 在 148 死亡，40 首次施加，60..140 共 5 跳；Garen 在 244 死亡，
60..240 共 10 跳，1800 HP ×1%×10=180 原始真伤。
新来源于 160 加入后首跳 180，不增加 160 付款次数。
原始未裁剪输入修复后也在 tick 355 正常结束。

新增 `tests/c19-missed-pulse.test.ts` 共 10 例：缩减输入、两种稳定 ID 顺序下的
新组/新来源/同源刷新、非到期拍相位，以及真正漏拍仍抛错。
将同一测试放回未修复的 C19 工作树，**3 失败 / 7 通过**：缩减输入抛错；
新来源两种顺序分别出现首跳滞后或 ordinal 提前。修复后 10/10 通过。

既有 golden 未修改。修复落实既有首次跳数和刷新合同，没有修改装备声明、玩法参数、
规则 manifest 或内容 digest（仍为 `fnv1a32-utf16:bd9c3a8e`）。

## 验收

Node v24.19.0；只跑指定目标集，不跑全套，不放宽时间预算或断言。

- `npm run typecheck`：通过。
- `npx vitest run tests/server/two-sided-resolver.test.ts tests/t5r*.test.ts tests/m8-b7*.test.ts tests/m8-b5-instances.test.ts tests/b8-resumable-battle.test.ts tests/c19-missed-pulse.test.ts`：**16 文件 / 223 用例通过**，59.28s，零失败、零跳过。包含新增 10 例；既有 SHA golden 原样通过。
- `npm run test:server-entry`：通过，**165 个状态 / 106 个事件**；state/event 指纹仍为 `acf238a8` / `966105d6`，内容 digest 仍为 `bd9c3a8e`。首次沙箱运行因 `spawnSync EPERM` 中断，沙箱外原样重跑通过。
- 整局：在 `e7d2a9c` 复现工作树覆盖本次唯一 simulation 改动，并运行随 PR 纳入的复现脚本。脚本额外断言 phase=ended、fault=null、8 个唯一席位与完整排名 1..8；保留原来的失败输入捕获与逐 tick 诊断，异常退出码改为 1。

`node tests/server/e2e/repro-missed-pulse.mjs 9 4 11`：**3/3 整局通过**，退出码 0。

| seed | 正常结束轮次 | fault | 第 1 至第 8 名 |
| --- | --- | --- | --- |
| 9 | overtime-2 | null | s4, s3, s7, s2, s0, s5, s1, s6 |
| 4 | 6-6 | null | s1, s5, s6, s7, s3, s4, s2, s0 |
| 11 | 6-2 | null | s0, s4, s3, s6, s7, s1, s2, s5 |

以上为进程内八机器人整局，不代替 C19 界面 e2e 或 T9 真机验收。
