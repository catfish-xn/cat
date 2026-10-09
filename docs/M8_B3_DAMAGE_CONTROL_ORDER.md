# B3：开场伤害后控制修复

基线：`feat/m8-b0-baseline` / `5bd7968ee31e107e12701145aa4fdac0bec7ea8d`。
问题依据：[B7 固定记录](https://github.com/catfish-xn/cat/blob/3b0d55f923d7225587872340f62b203de31f8f41/docs/M8_B7_DAMAGE_CONTROL_ORDER.md)。
批准语义依据：`M8B_ENCOUNTERS §4.5`、`M8B_POLICY P-M05`、`M8B_CONTRACT_ADDENDUM IF-OPEN`。

## 提交边界

仅修 B3 通用执行器及其回归测试。不修改或合入 B6/B7 文件，不按野怪 ID/名称分支，不改婕拉、斯卡或装备声明，不把控制改成 `damage-dealt` 监听器。

`executeDamageControlSequence` 是开场任务显式选择的有限执行路径：同一 action/target 的 next-tick stun 绑定到序列中最近的前置 damage 包，保留原控制 source/effectIndex/ordinal。普通 Effect 消费者的即时状态、先状态后伤害规则保持原样。无前置 damage 的状态不建立这种绑定。

包提交原目标和可能的分担结果、完成它们的同步事件监听之后，在后续派生包和后续普通包执行之前，检查**原目标的 virtualHp > 0**，再调用既有状态入口检查当前有效免控并登记。检查点是对应包之后，不是整批伤害之后：

- 本包或之前的包已致死：不登记控制，也不产生伪 applied/death-cleanup。
- 本包后存活、同 tick 后续包致死：允许先登记，再由既有死亡清理移除，账本保留真实顺序。
- 完全防伤／护盾吸收：不要求正伤害；存活且不免控仍登记。
- 免控在本包同步监听中获得：登记时重新检查，拒绝控制。
- 分担单位不继承原目标的控制；其结果完成后仍只检查原目标。

控制仍从 tick2 生效、tick12 前结束，不影响 tick1 已规划动作。位移、pending/executed/cancelled 任务、来源取消、包稳定排序、RNG 与技能／普攻事件均沿用原管线。绑定只存在于单次 tick 内的已规划包，序列化状态继续保存原开场计划和任务消费状态，不增加未保存的跨 tick 队列。

开发规则标识 `S13_COMBAT_RULES.openingControlTiming` 增加 `m8-b3-v1-bound-packet-then-surviving-target-next-tick-stun`，自动纳入 content digest，使旧开发状态不能在相同 digest 下混用。没有改变正式 M8 schema/protocol 或数值、目录版本。

## 回归依据与运行

`tests/fixtures/m8-b3/damage-control-opening.json` 是在固定 B7 提交上实际调用 `compileNeutralEncounter('6-7')` 得到的 unit/openingDefinitions 输出，不是手写替身能力。只读提取过程在修复分支之外运行，B3 测试无需导入 B7 文件。主要断言值来自记录的独立手算：1000×15%=150，4000×15%受300封顶，当前HP100致死。

```sh
npm test -- tests/m8-b3-damage-control-order.test.ts
npm test
npm run build
```

新增用例覆盖致死／存活／封顶、已有免控、本包授予免控、完全防伤、护盾、同 tick 前后其他包、多目标与输入置换、泛化 ID、多组 damage/control 绑定、来源取消、位移后局部续算和 JSON 往返、唯一消费及 0RNG。未修复基线上 10 项失败、4 项通过；修复后 14 项通过。

恢复测试覆盖 B3 的 `OpeningState` 校验和 tick 边界纯状态往返，不能代替尚未接入的 B7 Match/B9 完整存档验收。B7 原 characterization 明确断言旧缺陷，合入修复后的后续 B7 集成应由其负责人更新；本提交不修改该文件。
