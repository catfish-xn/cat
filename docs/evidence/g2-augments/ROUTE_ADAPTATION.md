# W4 公共命令路线：强化选择策略适配

扩大到30项后，旧驱动仅给原6项排序，其余遇到什么就选第一个。
这不是规则回归判据：相同seed的候选池已改变，旧驱动会错过新高阶团队强化。
本次仅修改 `scripts/generate-m5-route.cjs` 的固定选择优先级，覆盖全部30项，
不修改seed、候选池、随机算法、经济、玩家生命、单位、装备或场景输入。
仍只从真实offer中通过 `selectChoice` 公共命令选择；独立oracle继续检查全部候选。

## 修改前后真实诊断

2026-10-16，用当前真实引擎、seed42、sniper路线执行至4-4 choice；
旧/新选择策略分别运行，不恢复或改写历史存档。新顺序先在内存中的driver副本
诊断，五分支全成功后才应用到正式driver。诊断期间未写夹具。

|轮次|实际offer|旧策略|新策略|
|---|---|---|---|
|2-1|backup / bronze-for-life-i / bulky-buddies-ii|backup|bronze-for-life-i|
|3-2|clockwork-accelerator / pumping-up-ii / manaflow-i|manaflow-i|pumping-up-ii|
|4-2|item-collector-ii / built-different / bronze-for-life-ii|item-collector-ii|bronze-for-life-ii|

4-4前缀玩家HP：旧策略91，新策略97。
旧策略 ionic-spark 分支在6-6战斗后HP0、gameOver，无法形成6-7输入。
新策略下五个原场景全部到达6-7 preparation，玩家HP均57：
ionic-spark、evenshroud、ionic-spark--evenshroud、quicksilver、edge-of-night。
五者6-6战斗结果仍是enemyWin；未跳过败局或注入生命。

## 优先级与验收边界

固定顺序优先成长和广泛适用的团队增益；依赖特定几何、最后单体生存、无激活
羁绊的效果置后。保持单一固定优先级，不按seed硬编码选择答案，也不把测试
期望反灌为生产规则。完整顺序见driver唯一 `order` 字面量。

Herald生成器完全不改：4-4前缀、原14场后续战斗、五组材料获取和组合、原Irelia
持有装备、最后公共部署到孤立目标的流程均保留。此次诊断确认五条获取路线可达，
不声称已经完成四条完整路线回归或raw恢复验收。

正式生产冻结后须重新执行四条完整公共路线与原33战/victory断言；再执行Herald
五场景原始录制及restore/start/15 steps检查；最后运行双真实基线录制器。
新旧玩法差异必须记录首个command、完整事件和状态差异。历史基线仍用其原driver
和原oracle，不能套用新策略以掩盖差异。
