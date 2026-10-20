# v16 共享转移测试恢复 seed 4

对照基线：v15 `1642beaabee7df800c15250bb07ec6cf2e6bbed0`；v16 `99e13501664f01c9de87864bf68506898ec5841c`。
恢复 `tests/fixtures/t13-loot-public.ts` 的 `transferPreparation()` 原 seed 4、4-5 保留金币 19、目标 `mage-armor`，以及三个使用方的原单位、装备与账本期望。这里“共享”指三个测试共用的单机路线，不是联机共享卡池。

## 原因与代码路径

- `content/anomalies.ts` 的 `ANOMALY_DEFINITIONS` 在 v16 引入 `D14_ANOMALIES`，54 项变为 56 项，没有删除旧异常。
- `match.ts:selectAnomalyTarget` / `rerollAnomaly` 新增 `eligibleD14Target` 过滤。`d14-runtime.ts` 规定普通在场 Ezreal 可选 `into-the-unknown`，不可选要求三星一费的 `ultimate-hero`：本路线初始池从 54 项变为 55 项。
- 两版 `generateAnomalyOffer` 均排序 ID，调用一次 `nextRandom(choiceRngState)`，使用 `floor(word * pool.length / 2^32)` 取下标；重抽只排除当前报价，再消耗一个 word。候选变化足以改变报价，不需要随机流偏移。
- `augment-offers.ts` 在两版没有差异。三次强化各消耗三个 choice word；异常首次抽取及每次付费重抽各消耗一个。路线实际所有 34 次 choice RNG 状态更新逐项相同，没有 v16 新抽签插入此流。

## 离线双版本实测

使用只读 `git archive` 提取基线源码、路线脚本和独立账本 oracle；本地 TypeScript CommonJS 转译分别运行两版原配置，`onStep` 记录每次 choice RNG 改变。均经过各自 oracle 校验，不注入状态、金币或报价。

| 检查点 | v15 / v16 的 RNG 状态 | 报价或结果 |
| --- | --- | --- |
| 初始 choice RNG | 2654435773 | seed 4 的独立 choice 流 |
| 三次强化后 | 4240258026 → 330125851 → 3918909088 | 三组强化报价完全相同 |
| 异常首次抽取 | 3918909088 → 4143853951 | 两版均 titanic-strikes |
| 第 4 次重抽 | 1877326804 → 3416519971 | v15 power-absorption；v16 one-thousand-cuts（首次报价差异） |
| 第 30 次重抽 | 3864513630 → 3749693477 | 两版均 slime-time |

背景中“最终异常名字变了”未在完整原配置上复现：原脚本追求 `mage-armor`，金币耗尽后选择当时报价；v15 原断言本来就是 `slime-time`，v16 也相同。原账本 65 条、nextUnitSerial 22、单位与装备身份全部恢复。中间报价变化由池内容导致，31 次异常抽取的前后 RNG 状态完全相同。

没有修改 simulation、版本或 digest，不触发 v16 九步重录。临时完整 trace 保存在 gitignore 的 `artifacts/seed4/trace.json`，正式交付依据为以上代码路径、数值对照及原期望回归。
