# 第 3 批展示接线剩余数据需求

本轮只修改 rendering、相关测试/工具/文档；不要求用户决定新玩法，也不在显示层重算规则。

| 字段/事件 | 含义与用途 | 验收条件 |
| --- | --- | --- |
| packetDamage 可公开的 actionSeq、sourceKind、abilityKey、delivery/任务阶段 | 区分同一 caster 的技能、装备、普攻；把 Loris 反击、Illaoi drain/slam、Swain pulse 接回真实阶段 | 装备魔法/真伤包不能误触技能阶段；同 tick 多目标属于同一动作 |
| Silco 显示代理的 cohortId/proxyId、targetId、begin/end/attack tick | 原逻辑任务没有可见 Unit；仅投影显示生命周期，不新增领域实体或客户端选敌 | 重叠两次召唤可逐只归属；转目标/目标死亡/施法者死亡/结束与真实任务一致 |
| Elise ranged 的蜘蛛中心 targetId 与 splash targetIds 分组 | 当前扁平 cast targetIds 无法区分主蜘蛛中心与旁溅受害者 | 蜘蛛数量、路径、爆点一一对应真实主目标；不按邻格另算 |
| Swain ascension 的开始/到期/延长展示 tick | g23.ascension 没有公开 deadline，助攻延长也不可由当前动画事件唯一恢复 | 满血、无邻敌、击杀/助攻延长、死亡时仍准确续显与结束 |
| 可区分来源的状态结束事实 | Illaoi 自身技能减伤与其他减伤重叠 | 不因别的状态结束提前停技能；没有受害者时仍结束并播放自身收尾 |
| Loris 原技能的延迟反击阶段事实 | 盾提前耗尽后任务仍等原截止 tick，当前盾事件没有该任务身份 | 正常到期和提前破盾两分支均在实际反击时触发，不把装备伤害当反击 |

数据应来自现有权威账本/快照的只读投影，不让服务器或界面新增一套技能计算。公开范围由既有联机合同决定；此文是接口缺口记录，未实施规则/协议变更。
