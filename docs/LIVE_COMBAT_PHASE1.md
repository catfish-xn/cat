# 对战即时装备 B 方案：第 1 阶段实现

设计来源：`对战中装备设计稿（本地，未入库）`（批准的 B 方案）；基线 `14006984600a08f8dd96fa776bf9ba1d1048ff24`，工作分支 `codex/live-combat-stream`。
本说明原要求与设计文件并排保存；当前沙箱仅允许写 equip-wt 和 /tmp，故可审查副本放在本文件，未修改外部设计目录。

生产 WebSocket 服务器现启用实时首遍流，取消开战前整轮预模拟屏障。Room 负责单写调度，规则层仍计算 tick、RNG、胜负与奖励。
每50ms开始一个全轮边界，每场最多推进一步；步后检查20ms墙钟预算，未完成边界让出队列后续进；全体过界才开启下一边界。
PvP 直接复用 startLiveTask/BattleReplayTask.advanceTick；PvE 公共 open/step/settle 接口分开战斗推进与终局奖励。
首遍完整领域账本与紧凑 recorder 均保留；B方镜像只投影已录帧，已镜像前缀缓存复用。

服务器 subscribeStreams 和 combatStreamFor 是实时流的数据源，发 combat-open/chunk/end，断线游标从最近提交 chunk 续传，初次/丢失游标从最新关键帧接尾段。
#382 评审修订按本地 #376 接回观战：本人/观战独立游标，带 seatId/watch 的 open/end 和批量 chunk；观战只送 watchReplay，不记入本人的战绩。流式 watch 请求两端都有回执处理；生产流式不另发 watch-replay/watch-tail。#376 的原 replay/watch 接线仅留给显式注入旧 resolver 的兼容测试，复用同一 watchSeatId 和 watched 回调。
浏览器最小接收适配：双游标恢复、连续追加、缺口重连；本人和观战各保留四拍/200ms 缓冲，空缓冲不清零时间余额，end 释放尾段。服务器绝对时刻排拍，最多连续补两拍；终局尾段至少800ms。
整拍只通知一次，PvE state 汇集到拍末；同一连接每拍至多一个 chunk 包，内含本人/观战各自增量。view 按席缓存，unitIds 建流时计算一次。结算计划仅基础变化时重算。
慢连接1MiB积压后记录一行 warn，断开并保留席位；room不等待网络确认。

PvE终局只暂存，全部战斗实际结束后按固定席序在最新池规划共享奖励，再使用既有原子 round settlement。
D11金币直接采样同一PvP任务，PvE逐步读取Match.gold。可信、已冻结且由本地任务认证的 BattleResult 不再在 proposeSettlement 重新模拟整场；
外部/克隆结果保留原来的完整验证。避免在最后一个实时tick重新引入整场同步计算。

合流暂用 multiplayer 的 `v20-traits` rules/content 名称，schema10/save6；保留本 PR 的临时 replay5/command5/NET6 与 manifest `combatStreaming:live-tick-v1` 标识。
这不是正式发布 epoch：未执行录制、未改写任何旧 golden/原始夹具；等 #373 合入后统一生成 `v20-live-combat` 身份与证据。只重算运行时完整 manifest digest：CONTENT=`fnv1a32-utf16:8e090a36`、LOOT=`fnv1a32-utf16:12b936a1`；没有重录 epoch 夹具。旧 v20-traits 录制状态仍是历史身份，不能用改写版本/散列的方式绕过拒绝；发布录制留到统一处理。

战斗中允许买、卖备战席单位、刷新；利息取结算瞬间的权威 Match.gold，PvP 既有胜利金币先计入利息基数。开战冻结的是战斗资产，不冻结银行或利息基数。

阶段2挂点：Room.nextBattleInputTick给出下一未封口T，CombatStream.nextEffectiveTick给出该场下一步；
`BattleReplayOptions.beforeTick(effectiveTick): readonly BattleTickInput[]` 在 `advance(n)` 的每个 tick 前执行，`advanceTick()` 同样经过此点。
`startLiveTask(envelope,beforeTick?)` 与 `new CombatStream(envelope,pve?,beforeTick?)` 向同一 PvP 任务传递该输入源。
私有 `BattleResult.inputLog?: readonly BattleTickInput[]` 预留成功安装日志，字段为 `{kind:'equipment',seq,effectiveTick,seatId,itemId,unitId,slot}`。
阶段1空批次无副作用，非空批次和伪造非空日志明确报 `battle-input-unsupported`；不实现 applyBattleEquipment，不把未执行意图记成成功。
阶段2必须先认证输入、成功安装后原子追加日志，重演时在同一 tick/seq 注入；日志不进公开帧。
已有 Match 成功穿戴/合成/消耗品命令继续由 BattleHistory.equipmentCommands 记录，并经公共命令重演和资源来源账本认证；删除或伪造记录会拒绝恢复，未改变旧 tick 的含义。

完整消息字段、公共函数输入输出和失败枚举见 [MULTIPLAYER_CONTRACT](MULTIPLAYER_CONTRACT.md) 的 B 方案第1阶段一节。
测试、分片失败清单和环境限制见 [验证记录](evidence/v20/phase1-validation.md)。


#382 本次合流基线（2026-10-22）：HEAD=`96e9ff24`，MERGE_HEAD=`a7687b34`（#379/#383，包含 #370/#376；#381 尚未合入）。
33 个冲突文件的内容已修复，上游自动合并的视觉/素材路径变动保留。Git 元数据位于工作区外且只读，`git add` 无法创建 index.lock，故索引仍保留未解决标记；未提交或推送。
本轮验证和环境限制见 [合流验证](evidence/v20/pr382-merge-validation.md)。
