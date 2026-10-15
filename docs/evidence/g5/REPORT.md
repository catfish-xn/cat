# G5 数据侧验收

基线 `origin/multiplayer@4d4cc73`；测试源码 `d0ea874818e2ab8fc06e3b80a809f1d9c4c383bc`；Node v22.23.3。

previewRoundEconomy 与实际结算共用 resolveRoundEconomy 的目录/加时分流，开局继续调用 OPENING_ECONOMY_RULES。heal 保留单条事件并增加实际来源份额；summarizeBattle 从完整回放提供统一统计口径。没有改变结算、战斗数值或 RNG。

## 验收

以下完整全绿结果为两 worker 负载对照。默认并行的最近完整运行仍有三个既有超时；是否接受两 worker 作为本包最终验收，待指挥确认。

- `npm run typecheck`：通过，18.96 s。
- `npm run test:server-entry`：通过，3.08 s；精确导出白名单、浏览器目标/Node 状态与事件/RNG 对照、恢复与引擎可移植性检查均通过。
- 受影响文件逐个 `npm test -- tests/<file>.test.ts`：12 文件，277 用例通过。
- 最终测试修复后的定向验证：3 文件、27 用例通过（与上列存在重叠，不相加）。
- 清洁工作区、新进程、两 worker 一次 `npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=artifacts/g5/fast-two-workers.json`：221 文件、2732 用例通过，0 失败/0 跳过；实际耗时 1118.36 s。
- 按任务要求未运行 timing。全部检查的结构化结果及每文件通过数见 [acceptance.json](acceptance.json)。

新增 75 用例：经济 66、统计 9。经济覆盖 1-2、2-1、overtime-1/3，金币 0 及 10/20/30/40/50 各边界前/中/后，五组 streak，胜/负逐项对照真正提交的 roundResults。开局胜局使用真实战斗最后一个推进，败局使用空部署实际结算；PvP/加时使用真实 applyRoundSettlement，前置历史为隔离事务用的连续历史夹具。另验证 null 条件、无敌方/RNG读取与输入不变。

统计用 seed42 正常 PvP、seed42 镜像 PvP、seed73 PvP、seed43 的 3-7 PvE 四场真实战斗，逐步 stepCombat/toLedgerEvents 形成完整账本后按单位独立筛选求和；全部字段与 summarizeBattle 相等。覆盖两侧实际治疗、护盾、击杀、治疗守恒、B 视角镜像、空战斗、多来源取整/重伤/过量治疗投影，以及来源/份额篡改、删除/重复事件导致 replay-divergence。

## §14.2/14.3 固定回放字节

同 Node、同 seed42、同 `scripts/verify-t5r-node-entry.cjs` 的 Maddie 1v1 和含 bloodthirster 的 6v6 输入，分别构建基线与当前 server-entry，直接比较两份战斗与回放。完整初态、末态与账本深度相等；从新回放删除新增 heal.shares 后与旧回放深度相等。

| 样例 | 基线 JSON B | 新 JSON B | 基线 gzip B | 新 gzip B |
| --- | ---: | ---: | ---: | ---: |
| 1v1 | 38624 | 38624 | 2678 | 2678 |
| 6v6 | 403090 | 404608 | 19443 | 19583 |
| B8 9v9 | 870641 | 870937 | 40032 | 40087 |

6v6 增加 1518 B JSON / 140 B gzip；1v1 不变。SHA-256、tick 与字节明细见 [replay-bytes.json](replay-bytes.json)。未替换任何旧指纹常量：B8 保留战斗本体 SHA 与去除新增 shares 后的旧回放 SHA，新增 shares 逐条独立对照完整账本。只有可见 heal 新增白名单字段，不能声称整个回放仍逐字节不变。9v9 的直接基线对比同样记录于 JSON。

## 范围与交接

- 主体仅 simulation（不含 content）、tests、docs；按任务要求新增 server-entry 导出。用户另明确批准 scripts/verify-t1-node-entry.cjs 的 expectedExports 仅添加两个函数名，该脚本没有其他改动。
- digest、版本号、content、服务器实现、界面全部不变；没有玩法改动。
- Claude 接入私有经济投影、界面排行；签名与字段见 MULTIPLAYER_CONTRACT §14.2/14.4 及 UI_REQUESTS SR-G5-01/02 回应。旧无 shares 的缓存回放须从完整账本重建后用于来源统计。
- 开发初次定向测试有一个空战斗夹具误用 PvE 回合，已修成 2-1；初始 12 文件定向使用 6130e80；测试修复后的 3 文件定向及两 worker 全套使用上列源码，生产实现相同。入口检查首次被沙箱以 EPERM 阻止外部 Node 子进程，使用宿主执行权限后原命令通过；未绕过任何断言。完整 fast 初次也因沙箱禁止本地监听（独立探针确认 EPERM）导致 13 个网络用例即时失败，该轮已中止并保留 artifacts/g5/sandbox-diagnostic；随后宿主全套完成：218 文件/2729 用例通过，3 项失败（B8 旧回放指纹、装备历史和界面排行各一个 5000 ms timeout），记录位于 artifacts/g5/first-complete-diagnostic。修复时旧指纹常量保留，新增 shares 单独校验；排行的共享房间准备、装备档案合法控制验证移到 beforeAll，原有断言不删且未改任何 timeout 数字。修复后的默认并行全套仍为 218 文件/2729 用例通过，另三个既有用例超时（B8 输入隔离 5000 ms、T12 离线转移 15000 ms、LocalRoomClient 整局 60000 ms），保留于 artifacts/g5/second-complete-diagnostic；该三文件各自单跑全部 21 用例通过，LocalRoomClient 文件 40.89 s。未继续改其预算或生产代码，上列全绿是两 worker 负载对照，不冒称默认并行通过。
