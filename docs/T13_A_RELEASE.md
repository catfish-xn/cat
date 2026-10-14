# T13-A：组件全槽自动合成独立发布

按 2026-10-14 用户后续指示，从 #79 拆出为 #80，先验货合入 multiplayer；R3/R4 留在 codex/t13-loot 的 #81 草稿。本决定覆盖先前 A 与 B 一次发布的安排。包含 multiplayer@8968c8a（后者仅 docs 补充），规则比较基线仍为 297143e。

库存普通组件拖到持有永久普通组件的单位，优先与最低槽号散件合成，不论请求空槽、散件槽或成装槽。普通成装留原散件槽，三槽父件沿既有规则。成功预览 occupiedSlots 是实际落槽；无新命令、字段或失败码。四阶段许可、冻结战斗、失败原子性、来源 fold 和 B8 恢复沿用 T12。

| 身份 | T12 | T13-A |
| --- | --- | --- |
| EQUIPMENT_RULES_VERSION | m8-b5-instances-v3 | m8-b5-instances-v4 |
| CONTENT_DIGEST | fnv1a32-utf16:44fe9c0e | fnv1a32-utf16:96c9126d |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:7b14bfba | 不变 |
| schema/save/replay/command | 6/2/2/2 | 不变 |

旧 digest 的存档/快照由既有严格校验拒绝，不迁移、不补账，不用新规则重演旧命令。切换须结束活动局并新开局。保留历史 fixture 与证据；测试新档经公开命令独立生成。R3/R4 后续使用 schema7/save3/replay3 等新身份，不复用本次 digest。

T1 的固定首战未触发新合成分支：165 个状态的 state trace 从 `bf4da979eab5889734e1b61c03a33c268d08ca58f7413844aaacc1c17c1b504c` 变为 `3c59d6ba71a9b07e15cfd82c29c2932f923e1bb9c0d857ecf40e7dcdc327c906`，差异仅 contentDigest；战斗事件和 RNG 应完全相同。入口报告见 evidence/t13-a/t1-report.json。包含新拖放命令的运营轨迹确实会改变 ID/装备/后续战斗，不能用此固定首战结论宣称玩法不变。

四条原有完整公共路线与 297143e 逐命令、逐 tick 比对，归一化唯一 contentDigest 后全状态、事件、命令、经济账本及检查点完全相同。审计脚本先断言再写新 golden，历史 T12 golden 保留，哈希绑定见 evidence/t13-a/golden-audit.json。专项覆盖三类目标槽 × 四阶段、旧双散件最低槽收敛、失败零消耗；真实公开装备路线在空槽触发新合成后进行保存/恢复及战斗逐 tick 对照。

范围：本 PR 仅修改 simulation、tests、scripts、docs。合入的 C18 基线界面提交来自 multiplayer，不计作本 PR 新增界面改动。A 不包含 B 的消耗品/新存档结构/界面兼容例外。


验收结果：在 9774682 集成代码上空闲机单跑 `npm test`，196 文件 / 2551 用例全过，1048.40s；之后只合入 8968c8a 文档补充。`npm run typecheck`、`npm run test:server-entry` 全过；T1 对照 165 状态、tick40 保存恢复、事件/RNG 与 CLI；五份公开 Herald 原始存档恢复及后续 15 tick 对照均过。C18 基线新增悬停提示仅补测试展示 mock，真实 token 生命周期与领域断言未删减。
