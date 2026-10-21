# 对战即时装备 B 方案：第 1 阶段实现

设计来源：`对战中装备设计稿（本地，未入库）`（批准的 B 方案）；基线 `14006984600a08f8dd96fa776bf9ba1d1048ff24`，工作分支 `codex/live-combat-stream`。
本说明原要求与设计文件并排保存；当前沙箱仅允许写 equip-wt 和 /tmp，故可审查副本放在本文件，未修改外部设计目录。

生产 WebSocket 服务器现启用实时首遍流，取消开战前整轮预模拟屏障。Room 负责单写调度，规则层仍计算 tick、RNG、胜负与奖励。
每50ms开始一个全轮边界，每场最多推进一步；步后检查20ms墙钟预算，未完成边界让出队列后续进；全体过界才开启下一边界。
PvP 直接复用 startLiveTask/BattleReplayTask.advanceTick；PvE 公共 open/step/settle 接口分开战斗推进与终局奖励。
首遍完整领域账本与紧凑 recorder 均保留；B方镜像只投影已录帧，已镜像前缀缓存复用。

服务器 subscribeLive 和 combatStreamFor 是唯一数据源，发 combat-open/chunk/end，断线游标从最近提交 chunk 续传，初次/丢失游标从最新关键帧接尾段。
基线没有 #376 watch-tail 实现，因此新增同源 watch 请求与回执；未增观战模拟或视觉控件。
浏览器仅最小改 ws-client / remote-session：连续追加、缺口重连、空缓冲等待、只以end完成；追加不重放已播特效。
慢连接1MiB积压后断开并保留席位；room不等待网络确认。

PvE终局只暂存，全部战斗实际结束后按固定席序在最新池规划共享奖励，再使用既有原子 round settlement。
D11金币直接采样同一PvP任务，PvE逐步读取Match.gold。可信、已冻结且由本地任务认证的 BattleResult 不再在 proposeSettlement 重新模拟整场；
外部/克隆结果保留原来的完整验证。避免在最后一个实时tick重新引入整场同步计算。

v20/schema10/save6/replay5/command5/NET6；新 content/loot digest 自动计算，历史字节不改。
`verify-v20-epoch.cjs` 是独立录制入口；完整四条公共路线强制检查命令与各轮事件 hash 与v19相同，再写新状态身份目录。
游戏内容、数值、伤害和RNG没有变；身份变更导致存档/状态hash变化，不把这种变化写回旧golden。

阶段2挂点：Room.nextBattleInputTick给出下一未封口T，CombatStream.nextEffectiveTick给出该场下一步；
之后将领域 `applyBattleEquipment(ctx,{seatId,itemId,unitId,slot,effectiveTick,seq})` 接在 advanceTick 之前，并将成功输入写统一日志。
本阶段尚无中途装备安装、原子合成对本场生效或新输入日志；已有装备命令仍使用开局冻结语义。

完整消息字段、公共函数输入输出和失败枚举见 [MULTIPLAYER_CONTRACT](MULTIPLAYER_CONTRACT.md) 的 B 方案第1阶段一节。
测试、分片失败清单和环境限制见 [验证记录](evidence/v20/phase1-validation.md)。
