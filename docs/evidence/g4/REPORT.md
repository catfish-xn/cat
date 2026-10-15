# G4 测试提速与 SR-B8-03

基线：`origin/multiplayer@9e3d203`。Node 22.23.3，4 核 Intel Xeon (Skylake, IBRS)，同一锁文件依赖。原始全套与候选验收依次运行；没有并发压测。原始基线保留 Vitest 默认 worker 策略；fast 使用 `maxWorkers: '100%'`，本机 4 worker。

## 测试分组与不变量

- `npm test` 选择 fast，保留 Vitest 原始 include/exclude 扩展名范围。
- `npm run test:timing` 选择 timing，`maxWorkers: 1`、`fileParallelism: false`，命令另传 `--no-file-parallelism`。
- timing 文件：B8（50 ms startup/advance）、M5 cannon（180000 ms）、bot-driver（60000 ms 两条整局断言）、round-commit（30 s 整局断言），第八批最终交付另加入完整 g3-ops suite（原 5000 ms publishing-watchdog 超时）及 ws-client suite（原 5000 ms 网络回放/恢复超时）。各 timing wrapper 仅注册指定用例，其余回归留在 fast；LocalRoomClient 只有 60000 ms 用例超时，没有 elapsed-ms 断言，保留在 fast。
- 其余三条 M5 回放分到独立 fast 文件；M6 四条独立整局历史路线也拆为独立文件并保留各自容量/历史断言；四条路线共用原始逐命令/逐 tick 验证函数，原断言及 180000/360000 ms 预算不变。
- CI 同一个 job 先 fast 后 timing，二者都是必需步骤。两组覆盖原测试的并集，每条原用例只运行一次。
- 夹具复用：B8 的已冻结编译输入按人数/镜像缓存；装备公共路线的已编译战斗按请求/持有人缓存且向调用者返回独立副本；不同装备请求的相同公共路线前缀按完整准备态缓存战斗末态（最多 128 个），需要录制 history 的调用仍执行每一 tick；T5R catalog/wolves 的相同轮次/seed 使用冻结战斗源。需要验证重复执行确定性的解析器调用仍重复执行。
- 不修改 golden、规则身份、随机算法、时序、事件顺序和任何预算。

## SR-B8-03 实现与证据口径

共享池守恒每次调用建立商店预留索引、席位索引和待领奖励来源集合，减少重复全数组扫描。没有缓存外部可变池，也没有跳过未终局 tick、奖励路径或输入/输出守恒校验。保留所有失败原子性、唯一奖励收据、席位版本和篡改拒绝检查。

确定性布局参考按 seed/边界缓存（最多 128 个）；已认证布局下的掉落参考最多缓存 64 个 seed/边界组合。弱引用持有布局及参考的 canonical 文本；外部 JSON/可变对象每次仍做完整认证，不能因之前验证成功而跳过。缓存仅减少参考重建，所有 RNG 游标、结果与事件仍按原值返回。缓存淘汰有专门回归。

严格恢复首先完整校验 JSON，然后仅对本地 `JSON.parse` 的数据使用结构相等比较，避免重复排序/生成 canonical 字符串。对象输入仍保留原 canonical 比较，避免把带访问器的输入当作稳定数据。canonical 文本仅在对象自身冻结、每个参与序列化的字段都是数据属性、且对象子值已有同样的冻结证明时按弱引用复用；浅冻结或 getter 对象不进入缓存。

复现实验：

```sh
# baseline / candidate 各自工作树执行相同命令，顺序运行
node --expose-gc scripts/loadtest-room.cjs --seats 2 --rounds 3 --warmup 1 --seed 42 > load.json
# 在 candidate 执行；参数分别指向原始与候选工作树
node scripts/benchmark-g4-pve.cjs /path/to/worktree > pve.json
npm run typecheck
npm test
npm run test:timing  # 本轮独占运行一次；连续三次目标转入 G4-2
npm run test:server-entry
```

既有 loadtest 是真实服务器/RealClock 压测，不能用其时间调度相关的操作数差异冒充逐字节等价。另用确定性 PvE probe：3 个池 seed（42/9/11）、8 席、真实开局及共享商店、逐席打完整个 1-2；每个命令/tick 分别累计 pool/state 与 Match/pool 事件 SHA-256，并检查输入没有被改写。计时仅包规则调用，哈希/不可变断言在计时外。另对全部 8 席做 1000 次完整守恒校验。冷热逐 tick 等价、篡改及奖励覆盖沿用 `shared-pool-cache` / TP 目标集。


新一轮实现进一步复用完整冻结 JSON 的技能、装备程序、来源和机制声明；tick 的 HP、护盾、任务、运行时等动态字段仍独立复制。外部可变/浅冻结/访问器对象不会进入声明共享路径。恢复完成后可以共享只读内容，但 basis、inputs 和 preparation 容器每次独立；对象 restore 保留原独立 clone 路径。已有引用隔离与篡改断言不变。

公共装备战斗与准备夹具另使用每次 Vitest 调用新建的临时缓存目录，跨隔离 worker 复用真实命令生成的结果，以完整请求/完整输入 JSON 的 SHA-256 为键并原子发布。history 调用始终绕开缓存。运行结束删除目录，不复用上一次调用，不保存新的 golden。B5、B10、T12、终局掉落、6v6 和 B8 PvE 的首次公共路线/控制战斗在 beforeAll 准备，测试中的事件、逐 tick、恢复、篡改和数字断言保留。长路线优先调度，fast 为四 thread worker 并行；两组 worker 复用纯模块和有界不可变缓存。含 vi.mock/doMock 的文件在 suite 前后重置模块图，文件结束恢复 spy、global/env stub 与真实计时器。

## 原始全套最慢 20 个文件

原始全套为 211 文件、2635 用例，real **1942.63 s**，2618 通过、17 失败（原时间预算/超时）；无领域数值失败。下表从完整 JSON report 的文件起止时间计算，包含失败后的实际完成时间，不能当作原始全绿成绩。原始 M5/M6 一个文件内包含四条路线，所以其文件总时间很长。

| 文件 | 秒 | 主要原因 |
| --- | ---: | --- |
| tests/m5-replay.test.ts | 1138.7943 | 四条整局，每条逐命令/逐 tick restore、失败插入、双执行及全字段比较，原来串在一个文件 |
| tests/m6-integration.test.ts | 810.0071 | 四条整局历史、独立轨迹哈希、逐 tick playback、seek、全容量存档再验证 |
| tests/server/bot-driver.test.ts | 142.8161 | 两条完整八人局及确定性部分对局、接管流程 |
| tests/m5-route.test.ts | 103.5338 | 四条完整普通购买路线与独立资源 oracle |
| tests/m8-b10-item-save-replay.test.ts | 100.9246 | 44 件装备真实公共获取、录制/重放及 0/39/40/41/末态恢复 |
| tests/server/net/server.test.ts | 80.8043 | 真服务器整局、网络回放与可见性校验 |
| tests/t5r-b7-integration.test.ts | 72.3767 | seed42 八席整局及每场回放 |
| tests/m8-b4-catalog.test.ts | 70.1163 | 44 件装备重复公共获取、战斗编译及恢复 |
| tests/server/local-room-client.test.ts | 59.5618 | 真实本地房间全生命周期及每轮回放 |
| tests/m8-b9-activity-log.test.ts | 58.2744 | 完整 sniper 历史及 Vander 生命周期重放 |
| tests/server/shared-pool-room.test.ts | 54.8717 | 两条完整共享池整局与开局阶段回归 |
| tests/b8-resumable-battle.test.ts | 49.9982 | 重复九人输入编译、完整战斗和多个 replay slice 大小 |
| tests/m8-b7-audit-vectors.test.ts | 42.5464 | 真实晚期野怪路线、几何与周期效果向量 |
| tests/m8-b5-instances.test.ts | 42.4073 | 多装备公共获取，唯一性/槽位/组合的重复合法控制 |
| tests/m8-b8-oracle.test.ts | 40.2521 | cannon seed42/230 完整路线及状态转换验证 |
| tests/server/round-commit.test.ts | 39.8219 | 八席淘汰整局及重复开局/整轮提交 |
| tests/server/room.test.ts | 38.0276 | 真实 PvE 初始化、阶段循环与淘汰 |
| tests/server/t10-combat-ops.test.ts | 37.7217 | 战斗期命令反复创建并推进开局房间 |
| tests/server/projection-wire.test.ts | 34.3189 | 镜像回放及加时整局 |
| tests/t11-round-flow.test.ts | 32.4063 | 八机器人完整局推进至补给和加时 |


恢复仍逐次执行完整资源 fold、权威前缀校验、数值/装备/机制/事件边界校验以及候选策略比较。仅复用相同完整已认证 basis 输入的纯默认策略编译结果（最多 16 个），不缓存候选验证结果。对象输入继续执行原 canonical/clone 路径。完整冻结数据的 FNV digest 按弱引用复用；浅冻结和 getter 不进入 canonical/digest 缓存。

声明与 Match 元数据使用独立有界缓存：声明 256 项、元数据 64 项。对外部深冻结快照先证明整个有限 JSON 数据图，再复用引用；浅冻结或 getter 保留复制路径。可变检查点先复制其声明，随后只冻结本次新建的副本。机制声明在新建 Combat 时先独立复制再共享；严格恢复完成前不冻结调用者对象。

## G4 回放范围与比较实现

用户在本会话明确授权 G4 优化 `src/replay/` 内部复制/缓存；SR-B8-03 的规则优化仍只发生在 `src/simulation/`。回放快照仅共享经过完整有限 JSON 数据图证明的不可变子树；动态部分保持独立副本及内部别名/循环。访问器、Date/Map 等非普通数据使用原 `structuredClone`，试探遍历不调用 getter。不冻结外部输入。Playback 的已持有冻结状态可用于私有检查点；原始逐 tick 事件比较仍执行。

完整重放结果仅以 recorder 私有 ownership 标记的记录作弱引用键，首次仍执行版本路由、上下文 restore、起点、每个事件、终点及两项 hash 校验。缓存保存独立私有结果；每次命中返回独立可变 clone。结构相同的外部对象、浅冻结/访问器或篡改副本不会凭冻结状态进入验证缓存。新增回归覆盖缓存结果污染、外部篡改、动态别名/循环、负零、`__proto__`、getter 次数及 Date/Map。

部分逐 tick 的正向完整 JSON `toEqual` 比较改用 Node `deepStrictEqual`，actual/expected/message 表达式及检查位置不变，负向、非 JSON 与 asymmetric matcher 保留。Node 严格比较对原型、缺失字段/undefined 及负零更严格；没有用 hash 或部分字段代替全字段比较。

属性投影仍按原整数公式读取 AD/AP/攻速/护甲/魔抗/距离。`defenses` 对其他单位只读 alive/team/targetId/id，不再为每个投影单位复制整队 runtime。B8 账本字段集仍要求相同 plain-object 类型、相同字段数量和每个字段都属于原白名单，避免为字段名数组反复生成 canonical 文本。

## 阶段验收（新基线合并前，未达到速度目标）

- 原始全套：1942.63 s，211 文件 / 2635 用例，17 个时间相关失败。此数字含原 timing 用例，不冒充拆分后的 fast 基线。
- replay 优化前的 fast：744.29 s，217 文件 / 2637 用例，2634 通过、3 失败及空 suite；之后修复 ability 引用/getter 顺序、6v6 夹具准备与空 suite。此轮不是全绿基线。
- 当时 fast：**610.14 s**（user 2077.75 / sys 70.15），218 文件 / **2642 全通过**，仍超过 480 s。
- 当时 timing：**203.86 s**（user 231.90 / sys 9.68），4 文件 / **5 全通过**，仍超过 180 s；尚未取得连续三次达标成绩。
- fast+timing 按完整用例名核对原 2635 用例的多重集，各保留一次；另增 12 条边界回归。详见 metrics.json。
- typecheck、test:server-entry 已通过；第八批要求更新至 bdf50bb 后将补做验证。上述全套为 9e3d203 基线上的阶段成绩。
- PR 先作为草稿交付可审查成果，**G4 未完成**；按第八批用户优先级，提 PR 后先交付 P7 合同。

既有压测：同配置 1 场 warmup + 3 场 measured，均 complete，最终轮次均为 40/34/32。PvE 分别 53/52/50 场，wall 总计 26106.153 → 21232.066 ms（-18.7%），CPU 总计 29172.498 → 24077.894 ms（-17.5%）。整局 47251.00/40101.20/38399.92 → 39942.26/34802.31/33281.64 ms。准备命令 RTT p95 分别 16.32/13.12/12.82 → 13.41/12.86/16.46 ms，第三场没有改善；attempts 280/240/224 相同，accepted 首场 278→280，其余不变，属于 RealClock 调度差异。配置的 250 ms 准备期短于 300 ms bot 间隔，此脚本不能替代活跃八 bot e2e。

确定性 PvE probe 的 3 seed 均为 1286 ticks / 8 rewards，state/event SHA-256 前后相同；规则调用 ms：658.19/539.17/516.19 → 569.82/446.48/419.18；1000 次完整八席守恒 ms：185.13/178.75/190.22 → 57.57/55.70/53.63。原始 JSON 数字及指纹见 metrics.json。压测取样在最终属性投影去重前；不把 RealClock 压测当作逐字节验证。

### 第八批基线更新

已 merge `origin/multiplayer@bdf50bb`（merge `820796b`）；上游 round-commit 的配对延迟断言原样移入 helper。合并后 typecheck、test:server-entry 通过；6 文件目标集 48/49 通过，新增上游 `g3-ops` 的 publishing-watchdog 用例在并行时 5840 ms 超过原 5000 ms timeout。未改预算、未删断言，待 G4 后续修复；随后该基线的一轮 fast 在同机并发负载下为 1311.37 s，2582 通过、23 失败、63 跳过（beforeAll 超时使后续用例未执行），不能计为清零；前面的 2647 全绿也不能当作此 merge 的成绩。最终独占验收见下节。


## 第八批调整后的交付范围

用户于 2026-10-15 调整顺序：G4 先按现状交付，P7 冻结在 `7efc367f426f80f7fc06d619c238d03a47e420aa`，等 #98 合入通知后再 rebase。G4 已合入 `origin/multiplayer@ee8a6a7`（含 #99 / b484a28），本轮不新增性能优化。验收改为独占机器依次运行 typecheck、server-entry、默认并行 fast 一次、串行 timing 一次，全部通过即可；480/180 s 与连续三次指标转入 G4-2。

`tests/server/g3-ops.test.ts` 整个文件加入 timing，两组仍互补。publishing-watchdog 使用 ManualClock 推进三轮真实战斗，原 5000 ms 的 Vitest 超时衡量的却是机器实际运行时间；先前并行时为 5840 ms。通过串行隔离 CPU 竞争处理，保留所有原始测试、watchdog 数值和 timeout，不更改服务器实现。

本轮首次独占 fast 为 649.02 s，219 文件 / 2660 用例，2659 通过、1 失败、0 跳过。唯一失败是 ws-client 的重复恢复快照不重发 replay 用例，5026.48 ms 超过原 5000 ms timeout；它实际推进真实战斗、网络收发与重连，移整个 `tests/server/ws-client.test.ts` 至 timing，保持测试内容和预算。未修改任何生产源码。调整后重新运行四项验收，已全部通过，见最终独占验收。

### 本 PR 源码改动清单

- `src/simulation/shared-pool.ts`、`shared-pool-ledger.ts`：一次校验内复用席位/商店预留/奖励来源索引，减少重复扫描，保留完整守恒与失败原子性检查。
- `orb-layout.ts`、`loot-freeze.ts`、`loot-runtime.ts`：有界缓存确定性参考及冻结参考的 canonical 文本，每次重新认证外部候选布局与账本。
- `content/index.ts`、`immutable-json.ts`：完整不可变 JSON 图证明、冻结内容 canonical/digest 复用、已验证解析 JSON 的等价比较；getter、浅冻结和外部可变输入保留原路径。
- `combat-static.ts`、`combat.ts`、`combat-s13.ts`、`combat-input.ts`、`match.ts`：共享已经复制并认证的不可变声明/元数据，动态战斗状态仍独立复制。
- `serialization.ts`、`b8-restore.ts`、`m8/restore.ts`、`resource-provenance.ts`：已验证解析 JSON 的结构比较、相同完整 basis 的纯策略编译缓存，保留逐次资源/策略/运行时验证。
- `combat-replay-view.ts`：读取其他单位的防御关联字段，避免为每个投影单位复制整队 runtime，整数计算公式保持原值。
- `src/replay/snapshot.ts`：只共享完整证明不可变的子图，复制动态对象并保留别名/循环；特殊对象与访问器使用原 structuredClone。
- `src/replay/history.ts`：录制快照复用不可变声明；仅 recorder 私有 ownership 的不可变记录在首次完整重放验证后缓存独立结果，命中仍返回独立副本。
- `src/replay/playback-session.ts`：私有不可变记录与检查点复用声明，逐 tick 事件比较、seek 和公开快照校验保持。

### G4-2（本 PR 不实现）

保留全部现有工作负载时，四核 fast ≤480 s 暂不能承诺。此前全绿 fast 的 CPU 为 user 2077.75 + sys 70.15 = 2147.90 s，即使理想四核满载，下界也约 537 s，已高于 480 s；要达标至少减少约 10.6% CPU 工作，按实际 wall 610.14 s 则需减少约 21.3% 耗时，且新上游还增加用例。最终本轮 fast 为 631.61 s，CPU 2197.79 + 72.13 = 2269.92 s，四核理想下界 567.48 s；需至少减少 15.4% CPU 工作，按实测 wall 则需 24.0% 改善。

建议由指挥决定是否新增 `test:long`：把 M5/M6 整局逐命令恢复、全历史/回放/存档验收移入独立的必需 CI 步骤，保留全部断言、预算、用例与每次 CI 覆盖；普通 fast 保留局部规则及集成回归。旧全绿样本中这七个 fast 文件占累计文件耗时 1137.29 / 2089.52 s（54.4%），拆分后 fast 估算约 300–450 s，可望进入 480 s；最终本轮相应占比为 1209.20 / 2235.64 s（54.1%），与旧样本接近。该估算不是测量承诺，也不会减少 CI 总工作量。cannon 的原 180 s 毫秒预算仍需独占执行；timing ≤180 s 总量与连续三次稳定性另行验收。本 PR 不新增 test:long，不调整任何目标或预算常量。


## 最终独占验收（本次交付）

运行源码提交 `c3eb2ae93c12a7c06bd4df14c034d7e2f4ed3446`，之后只补文档/证据。Node 22.23.3 / 四核；确认 G2 worker 已退出、主进程已为 zombie 后开跑，期间无其他测试任务并发。P7 无存活测试且分支未改、未推送。本轮按以下顺序完整执行：

| 命令 | real 秒 | 结果 |
| --- | ---: | --- |
| `npm run typecheck` | 17.73 | 通过 |
| `npm run test:server-entry` | 3.15 | 通过，165 状态 / 106 事件对照 |
| `npm test`（fast，默认四 worker 并行） | **631.61** | **218 文件 / 2652 用例通过，0 失败、0 跳过** |
| `npm run test:timing`（单 worker、串行文件） | **212.80** | **6 文件 / 21 用例通过，0 失败、0 跳过** |

两组测试命令只附加 default/json reporter 与 outputFile，未传 name filter、exclude、worker 覆盖或 timeout。合计 **224 文件 / 2673 用例全通过**。将原始完整 JSON 报告的 2635 条 `fullName` 多重集与本轮两组结果逐项比较：每条原用例及其重名次数完全保留、各执行一次，无缺失/重复；两组文件交集为空。另有 G4 新增 12 条边界回归与上游新增 26 条，合计新增 38 条，全部执行通过。

75 个原始 JSON/gzip golden/录制文件逐字节一致，修改数 0；时间预算没有放宽。server-entry 最终 state/event FNV 仍为 `acf238a8 / 966105d6`，trace SHA-256 state/events/RNG 亦与固定基线一致；contentDigest `77f80fec`、lootReplayDigest `b8d9d7ca` 不变。三 seed PvE 的独立 state/event 指纹证据仍见 metrics.json。

原始基线 **1942.63 s / 17 个时间相关失败** 保留；本轮 fast/timing 完整通过才是最终交付成绩，不把失败或跳过的历史轮次混入通过数。机器汇总、原用例核对、38 条新增名称、两组最慢文件、报告 SHA-256、指纹与命令见 `final-acceptance.json`。本轮 cannon 为 117.731 s；publishing-watchdog 为 3123 ms；ws-client 全文件约 1.106 s，原预算全部通过。

**未达标转 G4-2：fast 631.61 >480 s，timing 212.80 >180 s；未执行连续三次达标验收。** 按本次用户调整，这些不阻塞 #98 取消草稿；本 PR 没有实施 test:long 或任何新增性能优化。等待指挥决定 G4-2 方案，且收到 #98 已合入通知前不开始 P7 rebase。


### #98 在验收期间已合入：补充 PR 的边界

交付时发现 #98 已于 2026-10-15 14:07（UTC+8）由其他窗口合入：原 HEAD `c0fe5aa19e0cc1f84df4505ea3a781140ae77a4b`，merge `a8e45722e8cf9cd478cfe9ba871abe3c279e4d5a`。因此上面的最终作者验收与两个 timing 分组修复不属于该次已合入快照，另以补充 PR 交付；不能把分支后续 push 视为已经进入 multiplayer。

补充分支合入最新 `origin/multiplayer@71de7b6` 后，PR 差异仅 `vitest.config.ts` 和本目录三份证据文档，无新增生产源码或测试体修改。相比完整验收的 c3eb2ae，上游新增 G5 界面与 5 条测试；合并后在 `42e40a5` 再跑 typecheck 通过，G5 新增 1 文件 / 5 用例通过（6.35 s）。完整 **2673** 结果仍指 c3eb2ae，不冒称在新基线上单次跑出 2678；新增 G5 的 5 条单独计数。

最新派工文档 71de7b6 已记录指挥另机实测与 G4-2 决策（不再追微优化，B8 startup 预热/中位数测量另案）。上面的 test:long 可达性估算是本次按用户要求提供的建议，保留供审计，本补充 PR 不实施任何后续方案。P7 仍冻结，等待本会话用户通知后再行动。
