# v25 最终集成验证与收尾修复

**指定的 115 个合并差异测试文件全部通过，production-size 与 TypeScript 检查通过。** 扩展服务器验收仍保留 26 个环境阻断文件、旧 v24 快照 11 项失败及八机器人 60 秒性能门槛 1 项失败。

验证对象：本克隆 `claude/v25-integration`，HEAD `d28484ff9d753917e1546e9bec4b3bc6e85c0a75`，比较基线为 `origin/multiplayer`。本轮未执行 Git 写操作，未录 epoch，未修改 `src/server/`、界面或游戏规则/数值。

用户到场前已重算的内容身份保持原样：`CONTENT_DIGEST=fnv1a32-utf16:b029f325`，`LOOT_REPLAY_DIGEST=fnv1a32-utf16:54b9a76a`。仅同步 `scripts/tests/production-size.test.ts` 中的固定预期；`update-content-identities --check` 验证一致。

## 范围与运行方式

- 指定的 `git diff --name-only origin/multiplayer...HEAD -- tests` 中 `test.ts` 文件共 115 个；并入全部 `tests/server/**/*.test.ts` 和 production-size，共 210 个文件。
- 首轮 fast 205 个文件全部执行：21,372 通过、3,300 失败、287 跳过；97 个文件失败。失败数包含被同一初始化失败连带阻断的用例，不代表 3,300 个独立逻辑错误。
- 全程 Vitest 参数为 `--maxWorkers=4`；保留仓库 fast/timing 分组、线程池、隔离策略和原超时。计时项目仍由原 `fileParallelism:false` 串行执行。
- 本克隆的 `node_modules` 指向只读位置，默认 Vite 配置打包会报 `.vite-temp` EROFS。因此使用忽略目录内的 `artifacts/v25-final/vitest.config.ts` 和 `--configLoader runner --no-cache`，将缓存置于工作区；保留 G4 共享缓存设置，移除本次纯 Vitest 不需要的浏览器启动步骤。没有启动 Chrome，也没有申请完整权限。
- 端口全部被 EPERM 阻断的 21 个文件已在首轮真实尝试；统一复测不重复这 21 个环境失败文件。投影及运营等混合文件仍执行其无网络部分，失败的网络用例单独列出。

## 失败清单 → 根因 → 修法

| 失败范围 | 根因 | 修法（均保留行为断言） |
| --- | --- | --- |
| production-size、内容池/独立 oracle 计数 | H9 合入后共 285 张；旧版本总数、内容身份和启用来源预期滞后 | 沿用当前身份；同步 285 总量、联机/单机候选差异以及 Sniper/H9 已启用来源。 |
| H7 Titanic Titan、Survivor 及 G2/S6c 血量恢复 | S6c 结算路径即使没有 S6c 持有者也把 HP 截至 100，覆盖 H7 的 120 上限 | 仅存在治疗量时施加治疗，并调用既有 `maximumPlayerHp(augments,round)`；无治疗保持 HP。增加 119→120、无持有者仍为 119 的交叉断言。 |
| Pilfer 在 3-3 击杀、3-4 发奖后的恢复 | P-B5-59 按下一自然轮发奖；旧资源溯源统一禁止补给轮机制英雄出生 | 仅放行 `pilferRewardPlan` 推导出的同轮、同收据英雄，仍逐项认证来源、定义、星级、序号与完整历史。同步资源恢复和商店历史两个折叠入口；新增真实 3-3→3-4 轨迹及合谋伪造拒绝。 |
| Fate 将已有历史的测试状态转成联机后，离线保存错误原因改变 | H12 在所有 4-2 棱彩报价上记录等级历史；旧预检先报座位历史错误，掩盖离线格式的 `multiplayer-state` 拒绝 | 将原有联机字段拒绝移到历史预检之前；没有放宽历史校验或接受联机离线存档。 |
| 多数强化报价、2-1/3-2/4-2、共享选秀报价 | 扩池改变候选顺序、去重和逐槽刷新结果；空棋盘、出战、共享选秀、座位 ID 路径不能共用裸 RNG 预测 | 更新已实际运行的种子/刷新槽；公共 helper 有界搜索真实路径，并验证实际报价。保留所有目标卡、奖励、RNG、不重复发放及篡改拒绝断言。 |
| Survivor 联机真实淘汰轨迹 | 原座位已不持有该卡；扩池后首场 PvE 改变 HP、淘汰轮和名次 | 使用种子 8 的真实持有者 s7，调整公开出售操作的轮次；继续检验持有者同批淘汰不领奖、存活持有者恰好领 60，以及两种结算模式的恢复和幂等。 |
| H8 击杀、Cabal、Sponging、Golden Find 联机阵容 | 报价仍可达，但旧商店内容、持有者或背包状态已变；人类购买的英雄不会自动立刻上场；部分菜单仍待处理 | 显式使用 Room 的购买、部署、经验、法球、铁砧、合成、装备和选择命令准备真实见证阵容；不伪造 HP、胜负、击杀或历史。 |
| Fate / Glorious Evolution 的离线历史恢复夹具 | H12 在 4-2 棱彩报价时开始历史证明，旧夹具在证明开始后直接调用测试赠送，未进入公共命令轨迹 | 把可追溯测试见证放在证明开始前的合法检查点；之后只用公共命令。Evolution 九次升级改为真实商店购买合星；测试预算有独立 `source:test` 收据。完整战斗证据和所有恢复/篡改断言保留。 |
| Final Polish、投资强化、Greater Moonlight 等默认 5 秒用例 | 一例内重复重放多份完整历史；部分老种子还带入额外历史持有者 | 对不需要历史的合法 4-1 检查点进行真实保存/恢复，约束后续证明长度；选择无额外历史持有者的真实种子；把多入口验证拆成独立用例，不增加超时。 |
| Mel 结算、终局法球和层级一致性恢复 | H4 结算表事实已成为权威历史；旧期望缺少此事实，或恢复未提供独立服务器凭据 | 期望状态通过公共历史记录函数加入结算事实；在线恢复传入 Room 独立 authority，并继续拒绝无凭据/篡改候选。 |
| `mechanic-failed-push` | 深层循环依赖的部分模块 mock 未生效；同一时刻多个发布也会替换 `serverEvents` | 在公共规则边界注入带序号的失败并保留真实自动部署；订阅实际携带事件的发布，继续逐字段校验且断言其他座位不可见。 |
| 选秀死亡、投影与经济预览加时 | 旧种子 5 不再进入加时；种子 42 的空棋盘轨迹可能取得不可出售召唤物 | 使用已验证会到 `overtime-3` 的种子 0；空棋盘轨迹显式回答选择，仍验证每个真实 PvP 平局扣血、完整名次、每项收入和逐轮结算。 |

上述生产修正没有改变来源数值、发奖时间、伤害或 RNG 算法。H7 最大 HP 与 Pilfer 补给轮发奖均沿用已确认合同。新增历史仍由原证明和独立服务器 authority 认证。

## 复测结果

- `npm run typecheck`、`git diff --check`、内容身份 `--check` 均通过；production-size 在统一回归中通过。
- 最终 fast：184 文件，180 通过、4 失败；21,891 用例通过、27 失败、1 既有条件跳过。未跳过断言来获得通过结果。
- 完整计时组 5 文件已执行：本地整局 962 项与 round-commit 通过；另对 watchdog 的三个自然回合和八机器人性能单独复测，保留原预算。表内以各用例最后一次**实际执行**结果合并统计，筛选复测未执行的用例保留先前结果。
- 全范围 210 文件的最后执行结果：182 文件通过、28 文件未通过；用例通过 23,030、失败 2,970、原有条件跳过 3。环境失败不计为已验证通过。
- 引用短路前后的两个完整联机场景共四次运行证据逐项一致：终局、账本、命令、收据、机器人摘要及到达计数完全相同（`history-short-circuit-equivalence.json`）。未省略历史事实。
- `src/server/` 工作区无改动；对 `origin/multiplayer` 的新增行扫描没有新增 `setTimeout`、`Date.now`、`performance.now` 或单词 `window`。没有新录制、改写任何 epoch/战斗快照 JSON。

## 仍未通过：文件、位置和原因

### 旧 v24 切片快照（本轮禁止录 epoch）

`tests/server/fixtures/battle-start.json` 内身份仍为 `fnv1a32-utf16:1b86447c`。直接检查这三个旧检查点：round 3 为 `invalid-seat-state`；round 9 为 `battle-validation:content-digest`；round 23 缺少当前历史型强化必需的 `augment-history-v1`。因此初始化失败，后续固定哈希/切片断言连带失败；同文件的新建公共 Room 用例通过。按“不录 epoch”保留这批原断言及旧 JSON，未把拒绝旧状态改成接受。

| 失败用例 | 文件:行 | 原因 |
| --- | --- | --- |
| battle opening slices > round 3: tick0/1 hashes equal the v24-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:35` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > round 9: tick0/1 hashes equal the v24-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:74` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > round 23: tick0/1 hashes equal the v24-online-rules synchronous baseline | `tests/server/battle-start-slices.test.ts:74` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > 4-6 including the mirror: complete results and ledgers equal synchronous resolver output | `tests/server/battle-start-slices.test.ts:35` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > keeps frozen inputs and FIFO commands until publication, matching arrivals after synchronous opening | `tests/server/battle-start-slices.test.ts:109` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > faults after a later battle fails without publishing earlier streams or roster locks | `tests/server/battle-start-slices.test.ts:158` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > dispose cancels an opening continuation and drops deferred writes | `tests/server/battle-start-slices.test.ts:169` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > 4-6 full boards: never adds a second rules initialization step to a slice | `tests/server/battle-start-slices.test.ts:201` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > uses the 2 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > uses the 8 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | 旧检查点未能进入有效战斗，见上述三个根因。 |
| battle opening slices > uses the 20 ms budget between rules substeps, without publishing partial streams | `tests/server/battle-start-slices.test.ts:225` | 旧检查点未能进入有效战斗，见上述三个根因。 |

### 沙盒外复跑清单

已独立用无网络的 `spawnSync(process.execPath, ["-e", ...])` 探针复现 `EPERM`；因此两个子进程测试也不能在当前沙盒验过。端口测试在随机端口的首次监听即失败，没有到达对局行为。以下 26 个文件需外部复跑（混合文件中已执行通过的无网络部分不受此结论影响）。

| 文件:行 | 原因 |
| --- | --- |
| `tests/server/anvil-choice-deadline.test.ts:224` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/e2e-replay-errors.test.ts:21` | 子进程 spawnSync EPERM |
| `tests/server/g2-4a-forge-timeout.test.ts:168` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/g2-4b-artifact-forge-room.test.ts:157` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/g2-4b-support-forge-room.test.ts:137` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/g3-ops.test.ts:116` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/legend-walk.test.ts:185` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/lifecycle.test.ts:81` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/little-legends.test.ts:53` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/main-seed.test.ts:20` | 子进程 spawnSync EPERM；main-seed 的合法启动用例另需监听端口 |
| `tests/server/net/battle-equipment-wire.test.ts:9` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/combat-stream-wire.test.ts:12` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/heartbeat.test.ts:48` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/live-bank-wire.test.ts:29` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/room-seed.test.ts:13` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/server-close.test.ts:14` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/server-whole-match.test.ts:15` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/server.test.ts:17` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/slow-task.test.ts:19` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/takeover.test.ts:12` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/v17-avarice-reconnect.test.ts:49` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/net/watch.test.ts:55` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/projection-wire.test.ts:68` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/replay-first-pass.test.ts:135` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/v23-room-command-robustness.test.ts:141` | listen EPERM: 127.0.0.1；初始化未完成 |
| `tests/server/ws-client.test.ts:84` | listen EPERM: 127.0.0.1；初始化未完成 |

网络共用入口为 `tests/server/net/helpers.ts:19` 的 `createGameServer({port:0,host:"127.0.0.1"})`。`projection-wire` 的本地投影/回放/加时/空棋盘部分通过；`g3-ops` watchdog 的最终结果见计时记录，healthz/日志网络用例仍被监听阻断。

### 八机器人性能门槛

- `bot-driver eight bots whole match`：77586.7 ms，原门槛 `< 60000` ms，仍失败；`enforced=true`。

仍失败位置为 `tests/server/bot-driver-timing.test.ts:3` → `tests/server/bot-driver-helper.ts:64` → `tests/fixtures/wallclock.ts:17`。名次、所有机器人命令被规则接受、人口/合星、操作预算等功能断言通过，剩余问题是整局实测耗时超过 60 秒。未换种子、未放宽预算、未切换 report-only。引用短路保持历史事实等价，但未改善本机整局门槛；采样已定位主要负担，战斗执行成本优化仍未完成。

单独一次 Inspector CPU 采样（约 81.6 秒，包含启动和 GC）显示如下热点。比例为含子调用的采样占比，彼此嵌套，不能相加；行号为当前源码位置，剖析器原始位置经过 Vitest 转译。性能结论使用上面的**未启用剖析器**的独立复测值。

| 热点 | 当前文件:行 | 含子调用采样占比 |
| --- | --- | --- |
| S13 逐 tick 执行 `advanceS13Tick` | `src/simulation/combat-s13.ts:177` | 52.7% |
| tick 单位复制 `copyCombatUnitForTick` | `src/simulation/combat-static.ts:96` | 12.0% |
| 规范编码 `canonicalSteps` | `src/simulation/content/index.ts:67` | 9.6% |
| 共享池守恒校验 | `src/simulation/shared-pool-ledger.ts:52` | 7.9% |

剩余项是固定种子 42 的真实逐 tick 仿真和状态复制/校验计算成本超过 60 秒。需要在保持复制隔离、事件顺序、RNG 和账本等价的前提下优化；本轮不把预算、种子或强制断言改成通过。CPU 证据见 `eight-bots.cpuprofile`、`profile-summary.json`。

## 首轮失败文件及最终状态（完整清单）

本表覆盖本轮首轮 fast 的全部 97 个失败文件；具体修法按上文根因表归类。计时组另外列于上文。

| 文件 | 根因类别 | 最终状态 |
| --- | --- | --- |
| `tests/augment-pool-batch1.test.ts` | 报价/背包条件/完整历史重复验证 | 通过 |
| `tests/augment-pool-batch2.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch4-b4combat.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch4-b4reroll.test.ts` | 报价/背包条件/完整历史重复验证 | 通过 |
| `tests/augment-pool-batch4-b4xp.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-b5a.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-fate.test.ts` | 报价及 H12 报价证明与测试赠送轨迹交叉 | 通过 |
| `tests/augment-pool-batch5-h10-sniper-integration.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h10-sniper-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h10-tracker-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h10-tracker.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h11-offers.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h11-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h11-sponging-public.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h11-sponging-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h12-head-start.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h12-max-cap-online.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h12-max-cap.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h12-subscription.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h13-artifactory-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h13-artifactory.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h13-carousel-room.test.ts` | 报价/选秀死亡轨迹漂移 | 通过 |
| `tests/augment-pool-batch5-h13-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h13-salvage.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h4-income.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h4-seed.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h4-survivor.test.ts` | 真实持有者、淘汰轨迹及 S6c/H7 血量冲突 | 通过 |
| `tests/augment-pool-batch5-h4.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h5-priority.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h6.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h7-health.test.ts` | S6c/H7 上限交叉或报价漂移 | 通过 |
| `tests/augment-pool-batch5-h7.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h8-deaths-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h8-deaths.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h8-health-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h8-health.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h8.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-h9-golden.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-s11a-greater-moonlight.test.ts` | 报价/背包条件/完整历史重复验证 | 通过 |
| `tests/augment-pool-batch5-s11a-moonlight.test.ts` | 报价/背包条件/完整历史重复验证 | 通过 |
| `tests/augment-pool-batch5-s1b-at-what-cost.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-s3a-vintage.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5-s6c-room.test.ts` | S6c/H7 上限交叉或报价漂移 | 通过 |
| `tests/augment-pool-batch5-s8a-room.test.ts` | 报价及 Pilfer 下一自然轮资源恢复 | 通过 |
| `tests/augment-pool-batch5-s8b.test.ts` | 报价及 H12 报价证明与测试赠送轨迹交叉 | 通过 |
| `tests/augment-pool-batch5-s8c-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-batch5.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/augment-pool-source.test.ts` | 内容身份/池总量/启用来源 | 通过 |
| `tests/g2-augments-choice.test.ts` | S6c/H7 上限交叉或报价漂移 | 通过 |
| `tests/g2-augments-static.test.ts` | 内容身份/池总量/启用来源 | 通过 |
| `tests/m5-content.test.ts` | 内容身份/池总量/启用来源 | 通过 |
| `tests/m5-oracle-augment-ledger.test.ts` | 内容身份/池总量/启用来源 | 通过 |
| `tests/s13-p1-acquisition.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/anvil-choice-deadline.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/augment-pool-batch5-h6-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/augment-tier-consistency.test.ts` | 结算表事实/独立服务器 authority | 通过 |
| `tests/server/batch5-dual-purpose-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-h3-cooking-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-h3-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-h9-cabal-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-h9-golden-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-portfolio-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-s1a-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-s3d-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/batch5-survivor-room.test.ts` | 真实持有者、淘汰轨迹及 S6c/H7 血量冲突 | 通过 |
| `tests/server/battle-start-slices.test.ts` | 旧 v24 版本/历史证明快照 | 保留失败，见上文 |
| `tests/server/carousel-room.test.ts` | 报价/选秀死亡轨迹漂移 | 通过 |
| `tests/server/e2e-replay-errors.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/forming-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/g2-4a-forge-timeout.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/g2-4b-artifact-forge-room.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/g2-4b-support-forge-room.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/g5-economy-preview.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/legend-walk.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/lifecycle.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/little-legends.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/main-seed.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/mechanic-failed-push.test.ts` | 无效深层 mock/发布时点 | 通过 |
| `tests/server/mel-save-settlement.test.ts` | 结算表事实/独立服务器 authority | 通过 |
| `tests/server/net/battle-equipment-wire.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/combat-stream-wire.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/heartbeat.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/live-bank-wire.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/room-seed.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/server-close.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/server-whole-match.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/server.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/slow-task.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/takeover.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/v17-avarice-reconnect.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/net/watch.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/projection-wire.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/replay-first-pass.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/server/shop-glitch-room.test.ts` | 报价、公开准备轨迹或旧内容夹具漂移 | 通过 |
| `tests/server/terminal-orb-reveal.test.ts` | 结算表事实/独立服务器 authority | 通过 |
| `tests/server/v23-room-command-robustness.test.ts` | 端口/子进程 EPERM | 环境阻断，外部复跑 |
| `tests/shop-history.test.ts` | 报价/联动种子及公开刷新路径 | 通过 |

## 可复现命令与本机证据

最终文件清单：`artifacts/v25-final/final-fast-files.json`；计时清单：`final-timing-files.json`；外部复跑清单：`external-fast-files.json`、`external-timing-files.json`。所有清单均为普通路径数组，可作为下列命令末尾的文件参数。

```bash
python3 artifacts/v25-final/run-list.py fast artifacts/v25-final/final-fast-files.json
python3 artifacts/v25-final/run-list.py timing artifacts/v25-final/final-timing-files.json
# 以下两行由用户在沙盒外复跑：
python3 artifacts/v25-final/run-list.py fast artifacts/v25-final/external-fast-files.json
python3 artifacts/v25-final/run-list.py timing artifacts/v25-final/external-timing-files.json
npm run typecheck
node scripts/update-content-identities.cjs --check
git diff --check
```

原始证据（忽略目录，不提交）：`baseline.json`、`final-regression.json`、`final-regression-progress.jsonl`、`timing.json`、`timing-final.json`、`wallclock-final/vitest.jsonl`、`identity-check.log`、`spawn-probe.json`、`inspect-v24-fixture.log`、`server-audit.json`、`history-short-circuit-equivalence.json`、`eight-bots.cpuprofile`、`profile-summary.json`、`final-ledger.json`，均位于 `artifacts/v25-final/`。没有把沙盒阻断或旧快照失败改成 skip/pass。
