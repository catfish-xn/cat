# F4：默认 5 秒超时的测试写法优化

日期：2026-10-28。工作区基线为 `claude/sol-final @ e3b78cb3`，包含任务指定的 `97068956`；没有 Git 写操作。只改测试和本报告；没有修改 src、规则、数值、超时、执行预算、录制夹具或 evidence。

## 耗时分布与根因

临时计时只包裹测试所调用的 `serializeMatch`、`restoreMatch`、`validateAugmentHistory` 和装备路线构造函数；测量后已移除插桩。以下计时包含父子调用，不能相加。

| 原用例 / 阶段 | 观察 |
| --- | --- |
| D14，种子 92 的路线构造 | 仅运行 display 子集的整文件约 40.94 s，其中 import 占 86%；公共路线、购买与两条后续轨迹原本就在模块初始化构造，未搬迁断言以躲避计时。 |
| D14 ultimate-hero acquisition | 用例约 7.19 s；一次 serialize 约 6.97 s，两次 restore 合计约 0.16 s。序列化会做领域校验，并非单纯 JSON 编码。 |
| D14 篡改批次 | ultimate-hero 六次 restore 合计约 39.05 s，历史校验约 38.88 s；into-the-unknown 七次 restore 合计约 43.81 s，历史校验约 43.65 s。每次冷回放约 6–8 s，保存的 proof 共约 7,261 / 7,276 个实际命令与 tick。 |
| T12 全文件公共装备输入构造 | 六次 publicInventory 调用合计约 4.13 s，发生在原有 hooks 中；最终供给用例的慢点并不是重新购买物品。 |
| T12 4-4 supply | 用例约 7.45 s；五次历史校验合计约 7.27 s，两次 serialize 合计约 7.30 s，两次 restore 合计约 0.10 s。原路线选择历史强化，重放实际命令与 tick。 |
| P3 种子 44 | 真实路线在 2-1 选择 Scoreboard Scrapper，后续序列化和恢复需要无关强化历史；路线日志确认到 3-1 已携带该强化。 |
| 房间 3-7 → 4-1 | 原用例约 6.05 s；`runNext()` 会把同一时间点后续新排入的八席 PvE 回调一起跑完。单个真实 PvE 回调约 0.6–1.0 s。 |

只报告的 src 热点：

- `src/simulation/serialization.ts:22`：serialize 调用完整结构 / 历史校验，首次序列化也会付冷回放成本。
- `src/simulation/augment-history-restore.ts:225`、`:229`、`:236`：已认证前缀不命中时，从 origin 逐命令、逐 tick 重建。篡改候选不能作为成功恢复缓存，多个篡改分支反复支付冷回放成本。
- `src/simulation/augment-pool-batch5-h12-progression.ts:22`：4-2 棱彩 offer 本身就要求历史；种子 92 三次都是棱彩，即使不选择 Max Cap 也会建立历史。
- `src/server/room/clock.ts:49` 及 `src/server/room/battle-resolver.ts:36`：runNext 经 advance 清空同一时刻回调；真实 resolver 的完整 PvE 工作叠加到一个测试体中。

## 最终测试改法

- `tests/d14-wiring-match.test.ts:17`：改用范围内种子 43，优先选择真实提供的普通战斗强化，避开 4-2 棱彩历史。继续用带独立账本的公共路线、真实付费购买三星和付费异常刷新；50 / 56 次预算不变。新路线 4-7 多出两个备战席单位，在第三次结算前真实出售，原返回槽位 3 断言保持原样。
- `tests/s13-p3-acquisition.test.ts:13`：保留五条种子 42 路线，dragonsoul / nothing-wasted 改种子 40，避开种子 44 的 Scoreboard Scrapper。仍使用真实抽牌和独立路线账本，100 次异常刷新预算、三个恢复断言和战斗推进全部保留。
- `tests/t12-combat-equip.test.ts:420`：沿用原有逐轮路线缓存，只对供给夹具的无关强化三选一用 `installB1Offers`，明确选择普通战斗强化，退出 suite 恢复 spy。夹具自检只证明脚本化卡片存在，不声称自然 RNG 可达；恢复与装备命令均为真实实现。手套输入改范围内种子 11，避开原默认路线的无关历史证据要求；恢复、只读预览、逐 tick 和最终结果比较不变。
- `tests/server/batch5-g5-dice-room.test.ts:22`：在八席真实 PvE 工作的 timer 回调之间分段，用现有 `fireNext()`；既不替换 resolver，也不改变 Room 配置、时间、tick 或 slice 预算。覆盖开场、2-7 和 3-7；原每轮骰子、奖励、守恒和存档篡改断言全部保留。

## 验证

命令：

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 tests/d14-wiring-match.test.ts tests/s13-p3-acquisition.test.ts tests/t12-combat-equip.test.ts tests/server/batch5-g5-dice-room.test.ts --reporter=verbose
npm run typecheck
```

负载验证在上述测试旁额外运行两个持续 CPU 循环进程，每轮新启动 Vitest，使用全新 invocation 的路线缓存。每轮四文件共 190 项（D14 39、P3 12、T12 74、房间 65）；新增的是真实调度分段断言，原断言没有删减。完整重复结果见下表。

| 附加两个 CPU 进程，maxWorkers=3 | 通过 | D14 最慢 | P3 最慢 | T12 最慢 | 房间最慢 |
| --- | --- | --- | --- | --- | --- |
| 第 1 轮 | 190/190 | 0.948 s | 2.253 s | 2.360 s | 0.968 s |
| 第 2 轮 | 190/190 | 0.944 s | 2.273 s | 2.063 s | 0.943 s |
| 第 3 轮 | 190/190 | 0.873 s | 2.230 s | 2.072 s | 0.949 s |

三轮均逐用例核对 ≤ 3,000 ms。`npm run typecheck`（tsc --noEmit）退出码 0；`git diff --check` 通过。原断言调用数保持：D14 expect 61→61、P3 22→22、T12 deepStrictEqual 32→32 / expect 67→68、房间 expect 23→30。没有改任何原有 timeout 值。
