# M6 回放合同 v1（F1 已冻结）

状态：F1已冻结，数值引用src/m6/limits.ts与M6_GOAL。使用完整战前Match上下文，不选择紧凑格式。

## BattleRecord

`{runId,combatId,context:MatchState,initial:CombatState,events:CombatEvent[],endTick,nextEventSeq,result:CombatResult|null,stateHash,eventHash}`。

context为当场startMatchCombat前可经restoreMatch验证的准备期Match，绝不含档案自身；initial为开战后tick0 Combat，包括其随机态、冷却、任务和运行时。events自tick0起连续有序、每条domain/combatId/eventSeq正确；endTick与最后状态相同，nextEventSeq等于完整事件数；result为完成结果或当前前缀null；stateHash为终点Combat规范化内容摘要，eventHash为完整事件数组摘要。摘要使用现有 content/index.ts 的 digestContent：FNV-1a UTF-16、canonicalContent递归排序对象键/数组保序/有限plain JSON；非密码学证明。每战身份[runId,combatId]。

## 记录生命周期

开战前捕获context，开战后接收完整tick0事件及initial；每次合法step增量追加。结束只归档一次；Continue/New在清账本前完成归档。补给轮无战斗记录；标准35轮共30战。当前战斗独立前缀与Match同tick，导入时验证其完整战斗状态而非只检查tick数字。

历史集合必须与Match.roundResults中非supply战斗一一对应，不可缺战/重战/未来战；同轮已完成当前Combat不重复作为currentBattle；允许阶段变为choice后的结算仍保持对应终战。历史英雄出售/合并/升级不影响context。上下文须具有正确round/combatId，result/tick对应当轮结算。

## 验证与重演

每个context先restoreMatch，调用startMatchCombat得到tick0，逐项核对initial和tick0事件。隔离副本固定50ms逐tick推进Combat（可用隔离Match副本原有推进，绝不引用活动对象），每次核对对应完整事件，终点比stateHash/eventHash/nextEventSeq/result。错误顺序、缺段、尾部多余、错误来源、旧digest均拒绝。当前前缀另核对当前Match.combat完整内容。历史context.roundResults须等于最终Match该战之前的历史前缀；隔离重演产出的完整RoundResult须等于最终Match对应条目。tick0可以零事件或直接结束，不虚构combatStart事件；endTick可以超过最后事件tick。result仅playerWin/enemyWin/draw/null，不能用victory/defeat替代。死亡AP按历史死亡停止值验证，不能强制继续增长；不升级schema5。

## PlaybackSession

只接受已完成且验证通过的记录；持有深副本，不持有活动Match可写引用。公开read/seek(tick)/play/pause/setSpeed(1|2|4)/advance(displayDelta)/dispose。暂停不推进，2×/4×在单位显示时间推进更多固定tick，不能更改tick规则。seek前后状态一致，无重复事件或累加统计。

v1正式文件不导出检查点；包装/记录使用严格key白名单，额外checkpoint字段拒绝。检查点仅稀疏缓存，包括合法Combat状态、tick、nextEventSeq、事件前缀校验；不每tick持久化。从最近合法检查点推进；可丢弃后从context重建，不能直接信任导入伪造检查点。缓存间隔和冷热seek预算待F1量测冻结。

回放仅准备/结算/终局进入。主控暂停活动计时和全部命令入口，退出清accumulator，不触发存储或结算；active Match/RNG/revision逐字段不变。ReplayPanel挂replay-root，B不直接改main/BoardScene。

## 统计合同与反馈

按来源ownerId累加packetDamage.hpDamage；按受击unitId累加packetDamage.absorbed；按heal.source.ownerId累加heal.actual，heal.overheal单列。不累计汇总damage，不把shieldLayerChanged/granted当吸收；洛里斯分担保留原来源与实际受击单位，各包一次。

C纯聚合器接收权威事件数组/增量游标，seek必须重置或重建前缀统计；StatsPanel挂stats-root，CombatFeedbackRenderer仅展示合并，不修改/删除权威事件。名称/星级/HP/法力/伤害类型/来源/效果优先，内部ID仅调试。支持单位与基本事件类型筛选。

475→238/237，盾100/200：实际HP175，吸收300。治疗请求100缺30：有效30、过量70。E提供独立手写预期，生产聚合器不能独自作为oracle。
