# 获批一轮 TG opening 性能排查：未找到足够且安全的修复

用户允许对35条真实公开准备路线做一轮有限、有实测依据的重复工作排查；43覆盖、35路线、5s和全部恢复/篡改断言保持，禁止跨调用cache及存档夹具替代。此次没有修改生产或测试源码，没有改门限/工作负载。TG P2仍开放。

## 实测具体热点

一次CPU诊断完整执行43定义、35路线、105开局战/15969ticks、705断言，默认5s未改。准备阶段采样2450ms：advanceS13Tick的unit-copy map1157ms（47.2%），其中native structuredClone885ms（36.1%）；map自身239ms（9.77%）。没有每tick全Match克隆。maintainMechanisms约3.45%、byDistance2.27%、spellCrit2.14%、range1.58%。CPU采样有开销，仅用于归因，不当验收计时。完整命令/源码/原cpuprofile与分析在cpu-evidence.tar.gz，SHA256 **8f899457a04b790fd22416510c015bf91e94d23c8d1a57250c57902177e25b42**。

## 只在临时镜像评估的候选

保原每unit native structuredClone及三COW字段排除，尝试复用未逃逸的copy对象，去掉return中的全字段二次spread。先在同样顺序构造原override；仅当所有override键已是copy自身数据键才Object.assign，否则回原spread，避免缺失键碰到getter安装的继承setter。未知扩展仍完整深克隆，没有跨unit或跨调用缓存，也没有把startingCell改读copy而破坏原别名。

同一个镜像、相同原target命令，一次before/after顺序执行，均1pass/24过滤，35真实路线和43定义的原断言不变。Vitest报告**4.01s→3.93s是整进程时长，含transform/import**，没有分别保存精确case计时，不能称显著收益。此候选最多触及map自身约总case7%的采样成本；这对照没有证据可以消除独立5503/5775或CI2077910ms的超时。所有结果保留，没有重复挑绿。

抽取单位copy map的7项语义小对照实际通过：可选字段/键序、同单位alias与环、跨单位共享输入输出独立、原startingCell别名、未知函数DataCloneError、有序变化getter及继承setter。它只证明所测片段，没有完整35路线逐命令state/RNG/events/receipts前后等价流证据，也没有对应全量/CI；因此候选**不落生产，不作为修复提交**。精确before/candidate源码、diff、执行脚本、原日志与SHA都在candidate/。

## 为什么本轮停止

更大36.1%的clone主体并非已证可删除的重复校验：默认shallow共享会改变未知扩展对象/历史输入隔离；批量clone可能保留原每unit应断开的跨单位别名，并改变getter求值顺序。没有为这些变化找到小范围可维护的完整等价证明，不能以JSON路线正控替代对象/别名负控。

其余候选规模小或改变语义：复用移动前目标会跳过移动/光环后的重新选敌；延迟空packet时spellCrit会省掉原非法授权拒绝；rollCrit内部重复校验只采样2.15ms，局部BFS range复用仅1.84ms。此前同crownguard输入第二次serialize约3.750ms，也不足解释CI207超额2910ms。没有删除这些校验或断言。

本轮结论是“当前有限范围内尚无已证明安全且足够的修复”，不是TG已过，也不是对所有未来算法的绝对不可能证明。后续如需改变克隆策略/验收组织，必须先给出明确边界与授权，不自动扩重构。CI208单轮通过保留，但不抹除独立两次和CI207/209失败。4d9树映射已获独立复核，不再重复补证。
