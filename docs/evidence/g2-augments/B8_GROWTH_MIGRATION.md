# B8 成长与奖励即时合并：W4 迁移

## 根因及不变场景

`89b219c` 全套暴露旧路线固定序号和历史战斗轨迹失效，而非成长规则变更。
仍用 seed48、cannon、最多两张 Tristana、两张均上场的真实公共路线至3-7；
再公共部署隔离原两张成长来源。没有改seed、生产代码、共享helper或资源状态。
26项 live-growth 测试（6正向、20篡改）与24项 oracle 测试全部保留。

真实两原始单位仍为 unit-14 / unit-15，都是一星；原奖励 unit-25 变为
unit-23，因为新选择策略改变了此前购买数量。奖励候选必须是战斗开始前
nextUnitSerial对应的新单位，不能使用合并后的存活ID冒充出生候选。

|证据|旧固定路线|W4真实路线|
|---|---|---|
|两原始单位前史有效弹射次数|2 / 1|4 / 2|
|两份前史存量bps|250 / 125|500 / 250|
|当前战斗有效弹射次数|2|2|
|当前增长bps|250|250|
|合并存量bps|625|1000|
|奖励候选|unit-25|unit-23|
|首个非终局揭露边界tick|201|197|

本表是运行证据摘要，不用于把生产输出直接替换成新的测试常数。
测试内的期望采用下面独立计算。

## 独立依据与计算

数值依据：原始 S13 Tristana 的 `ASKillGain=[1.25,1.25,1.25]`，
见 `src/simulation/content/source/s13-14.24b/normalized/g2-1-champions.json`
的 Tristana ability；每次有效击杀后弹射获得125bps。

正向测试观察真实公共命令轨迹：每个新 `tristanaBounce` 任务必须对应同transition
中的真实 parent packet，要求 killingPacket、overkill>0、同owner与actionSeq；
验证弹射量等于过量伤害、执行时间为父包tick+1、目标不是刚死亡的原目标。
以这些事实计数×独立常量125，推导两原始来源的前史存量和当轮增量。
不会读取 `growth.amountBps`、`growth.totalBps` 或 `persistentGrowth` 来构造期望。

当前战斗完整两条 growth 事件仍逐项比较：包含来源、tick、125bps、逐源累计量、
combatId、domain和eventSeq；序号由父packet→kill→growth的公开事件次序推导。
保留当轮必须恰有两次有效弹射、两个原来源都已有正存量的场景要求。
对stock+delta、runtime增量、唯一来源commit及合并存量分别交叉核验。

奖励ID在收到奖励前由nextUnitSerial推导；原来源从真实两张一星Tristana解析。
首揭露边界与真实中立死亡receipt/evidence绑定，仍要求发生于未结束的combat，
并验证资源、出生、成长在该边界没有预发放。

## 篡改边界保留

20项全部保留原拒绝消息，不放宽为任意throw，不删除或跳过断言：
- 删除delta时同步伪造最终存量为独立前史stock，仍命中original combat growth deltas。
- 增量注水时同时给delta/最终存量加125，仍绕过简单求和而触及原始来源校验。
- 已消费donor复活时从最终总量拆出125，保持总和但破坏有效持有人身份。
- 奖励出生、receipt与upgrade使用战前预推的新serial，所有旧来源/新来源伪装仍检查。
- 错误消费参与者从真实非参与单位选择，避免旧unit-24现在不存在/身份变化导致
  误撞另一个校验边界。

## 验证

```sh
npx vitest run --project fast tests/m8-b8-live-growth.test.ts tests/m8-b8-oracle.test.ts
npx tsc --noEmit
```

最终针对性运行：2文件，50 passed，19.16秒。
TypeScript检查已执行；这两个文件无类型错误，仓库检查仍被其他并行改动中的
`tests/g2-augments-identity.test.ts:51` TS2345阻断，已通知主任务。
不修改超时、测试数量或执行范围。
完整全套仍由主任务在最终提交统一复核。
