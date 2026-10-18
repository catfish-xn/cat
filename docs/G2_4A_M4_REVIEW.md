# PR #157 复审 M4 / S4

基于 `6fa69c0` 追加修复；不 rebase，不改规则、数值或版本常量。

普通 `equipItem` 原先没有资源事实，最终装备位置也不能唯一证明它发生在升星或卸装之前还是之后。因此新增 `item-equipped`（itemId、unitId、实际 slot），按资源账本 sequence 重演 `planEquip`。触发原位合成的穿戴仍由原有 `item-combined` 事务重演，不重复穿戴。历史续接、运行中后缀、结算后缀均消费穿戴事实，装备投影严格相等；移除从最终位置猜测穿戴的逻辑。卸装收据的持有者和槽位严格比较保持，M2 跨轮绑定检查保持。

资源账本新增必填 `equipmentHistory: 'ordered'`。旧账本缺此字段直接拒绝，不迁移、不推测；非空旧账本也不能通过追加事实自动补标记。删除穿戴事实的 M4 存档仍被拒绝。

测试覆盖：seed 7 公开命令三冠夹具，unit-3 在升星前装备 item-4，升星消耗 unit-1、unit-4 后 deathblade 在 0、两冠在 1/2、第三冠回背包；另覆盖升星、卸装后再穿戴的顺序。两者均通过 serializeMatch、restoreMatch(object/JSON)，恢复后下一场逐 tick 对比完整结果。补齐 S4 deathblade 非法迁移的三个入口拒绝断言，增加旧格式、缺穿戴事实及卸装持有者/槽位篡改拒绝断言。

验证仅运行用户指定的四个测试文件和 typecheck。另一个资源账本测试文件只更新空账本类型夹具以通过 typecheck，未执行它。

## 合并版本事项（本提交暂不升）

这是不兼容的存档/回放结构变化。合并时需统一提升 `M8_VERSION.schemaVersion`（当前 7）、`saveFormatVersion`（当前 3）、`replayFormatVersion`（当前 3）以及 `RESOURCE_PROVENANCE_VERSION`（当前 v1），同步对应合同字面量和兼容性识别。规则、内容数值、命令入参和 RNG 未变，本修复无需单独提升 rulesVersion、contentVersion、commandProtocolVersion。不得在仍使用旧格式标识的情况下直接作为兼容更新发布。
