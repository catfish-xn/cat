# PR #382 合流与阶段1补充验证（2026-10-22）

## 基线与边界

- 根目录 `<projects>/equip-wt`，分支 `codex/live-combat-stream`，HEAD `96e9ff24`，MERGE_HEAD `a7687b346dd01d4750880e8ac190f2179f1530e1`。
- 以实际 Git 为准：合流目标含 #370、#376、#379、#383；#381 尚未合入该目标，不宣称已拿到其未合代码。
- 33 个冲突文件已移除全部冲突标记；保留自动合入的上游改动。迅击/野火、共用移动禁止判定、搭档以及非冲突客户端视觉文件与 MERGE_HEAD 逐字节比对一致。
- 生产流式保留流推进、双游标、绝对排拍、四拍客户端缓冲、整拍合并推送。#376 原 watch.test.ts 完整保留；流式回归另存 watch-stream.test.ts。生产流式共用 recorder/open/chunk/end 与 watched → watchReplay，不另发 watch-replay/watch-tail；原消息仅供旧 resolver 兼容路径，复用同一 watchSeatId。
- 修复自动合流带回的 resume 后清空 lastWatch/重复订阅逻辑，客户端保留两条已收前缀续接；内存传输覆盖真实 WsGameClient 的断线/恢复、无二次 open、连续帧和 pending 清空。

## 规则与预留接口

- 结算利息继续读取结算瞬间 Match.gold，沿用 PvP 胜利金币先进入 interestBasis 的次序。新测试在 PvP 第5轮和 PvE 第11轮推进到 tick1 后成功买、卖备战席单位及刷新，确认扣款/返金，并比较 sliceTicks=1/8 的全部席位状态、战斗和卡池字节。
- seed 7/42/991 阵容同时激活迅击、野火和天才搭档，明确覆盖野火120tick周期与140tick窗口、迅击移动累计。整场推进、1/2/7 tick切片、CombatStream 首遍的完整结果、RNG、领域事件、回放和结算提案逐字节相等。
- 新增私有 BattleEquipmentInput/BattleTickInput 类型与 BattleResult.inputLog 字段；BattleReplayOptions.beforeTick 在 advance(n) 内每一 tick 及 advanceTick 前调用，经 startLiveTask/CombatStream 透传。
- 阶段1不实现 applyBattleEquipment；空批次无副作用，非空批次和外部伪造日志在推进/结算/回放边界报 battle-input-unsupported。测试钉住拒绝后未推进、同 tick 可重试、未记录虚假成功、字节仍与无输入相等。
- 已有成功 Match 装备操作仍由 BattleHistory.equipmentCommands 记录并通过生产命令重演和资源账本认证；共享 BattleEquipmentCommand 类型，不改变旧记录的字段或 tick 语义。原 crown-history 恢复回归覆盖漏记、篡改、错时输入拒绝。

## 临时身份（未重录 epoch）

沿用 v20-traits rules/content 名称与 schema10/save6，保留 PR 临时 replay5/command5/NET6、combatStreaming:live-tick-v1。只运行 update-content-identities.cjs --write 计算完整合流 manifest 的运行时常量：CONTENT=fnv1a32-utf16:8e090a36，LOOT=fnv1a32-utf16:12b936a1。
没有运行任何 record/epoch 脚本，没有改写旧 golden、原始状态、事件或 hash 证据；历史录制状态不改标签，按新 digest/command 身份拒绝恢复。等 #373 合入后统一重录 v20-live-combat；本轮不是正式发布 epoch 验收，也未执行全量 CI。

## 验证

| 检查 | 结果 |
| --- | --- |
| 下列16个测试文件，maxWorkers=2 / hookTimeout=30000 | 312项全部通过，111.98秒；包含完整内容/loot digest检查 |
| npm run typecheck | 通过，退出码0 |
| git diff --check / 33项冲突内容扫描 | 通过；工作树无冲突标记，索引受只读限制未更新 |

```sh
npm test -- tests/content-identity-constants.test.ts tests/live-combat-inputs.test.ts tests/server/combat-stream.test.ts tests/server/combat-stream-client.test.ts tests/server/net/combat-stream-memory.test.ts tests/server/net/watch-stream.test.ts tests/server/replay-client.test.ts tests/v20-traits.test.ts tests/g2-4a-crown-history.test.ts tests/m6-persistence.test.ts tests/t2-two-sided-battle.test.ts tests/t3-round-settlement.test.ts tests/t5r-combat-replay.test.ts tests/server/two-sided-resolver.test.ts tests/server/live-bank.test.ts tests/server/net/messages.test.ts --maxWorkers=2 --hookTimeout=30000
```

## 环境限制与交付

- 真实 WebSocket 的 combat-stream-wire 2项和 #376 watch 7项因 listen EPERM: operation not permitted 127.0.0.1 无法执行；解析用例通过。生产单写队列/推送/双游标恢复/背压/客户端播放与旧 resolver 观战兼容由内存传输测试覆盖；需在可监听端口环境复验真实网络。
- Git worktree 的实际元数据在 `<projects>/cat-remote/.git/worktrees/equip-wt`，只读。git add 尝试报无法创建 index.lock；未绕过限制。工作树内容已解决，索引仍有33项UU，未提交、未推送。
- 未新增真实素材或生成物；既有 v20 与新合入的 v20-traits 历史证据均未重录。

在可写 Git 元数据环境检查 diff 后暂存本轮内容（不会自动提交或推送）：

```sh
git add -u
git add src/simulation/battle-input-log.ts tests/live-combat-inputs.test.ts tests/server/net/watch-stream.test.ts docs/evidence/v20/pr382-merge-validation.md
```

随后确认 `git diff --name-only --diff-filter=U` 为空，再完成现有 merge 并进行交叉评审。
