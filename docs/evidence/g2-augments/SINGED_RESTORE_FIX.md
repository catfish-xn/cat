# Singed 合法战斗状态恢复修复

## 发现路径与范围

W4 的 Clockwork Accelerator 公开获取与完整战斗恢复测试暴露了两项既有 Singed 状态问题。最初复现使用替换 Spirit Link 之前的 30 项目录：seed 7，真实公共命令推进至 2-1，选择公开提供的 Clockwork Accelerator，部署开局 Irelia，并从商店购买、部署 Singed。没有注入资源、英雄、选择收据或战斗状态。

测试从开战运行到结算，在周期增益和每 60 tick 等关键边界执行 `serializeMatch → restoreMatch`，随后对原状态和恢复状态分别调用 `stepMatch`，比较完整结果（状态、RNG、事件与收据）。此前仅开战后数 tick 的恢复检查不会进入这些技能状态。

最终目录以 Blistering Strikes 替换 Spirit Link 后，排序及公开 offer 改变；seed 7 是发现时目录的复现标识，不保证最终目录仍提供同一选择。最终公开路线测试保留确定性 offer 搜索，并另有不依赖 offer 的 Singed 独立回归。

## 根因与失败边界

1. tick 180：Singed 给 Irelia 的衰减攻速状态为合法 `attackSpeed/bps` modifier（该时刻为 5875 Bps），但 `m8/restore.ts` 的旧 legacy modifier 分支仅接受护甲/魔抗的 flat modifier，报 `Invalid Match save: status modifier projection`。序列化入口原本已允许 Singed/Firelight 的攻速来源，但下层恢复投影检查没有对应实现。
2. tick 300：Irelia 死亡后，Singed 的攻速授予目标变成自己。自身减伤与自身攻速都采用同一个 canonical identity：相同 combat/source/target，application ID 均为 `source`。两项状态分处不同 group，却共享全局唯一 key；恢复的 `validateStatusGroups` 正确拒绝该重复，报 `Invalid status contribution`。

Clockwork 本身没有生成这两项错误；真实长战斗与严格恢复检查使原先未覆盖的 Singed 合法状态显现。

## 精确修复

- `src/simulation/combat-s13-state.ts`：仅对来源为 `singed-ability` 的 `attackSpeed`，把无后缀 application ID 设为 `singed-speed`。自身减伤仍使用 `source`。保留原刷新策略、时长、数值、衰减任务及事件语义。
- `src/simulation/m8/restore.ts`：恢复投影推导同一个 `singed-speed` ID，继续要求 key/source/target/时刻一致，不放宽 canonical identity 的全局唯一约束。
- 同文件 legacy modifier 分支：精确接受已有 Singed/Firelight 攻速投影。Singed 必须来自 Singed 英雄自身技能声明，`attackSpeed/bps`、立即生效、1 tick，数值不超过原技能 AttackSpeed 系数；Firelight 必须绑定持有者现有 firelight mechanic，数值与持续时间等于声明。原护甲/魔抗 flat 验证保持。
- `tests/g2-augments-combat.test.ts`：独立验证 Singed 自身同时拥有减伤和攻速时 identity 不重复、恢复校验通过；将攻速 modifier 和展示投影同时篡改为 20000 Bps 仍被拒绝。

未修改任何英雄定义、技能系数或战斗数值；这不是 Singed 平衡调整。

## 检查记录

发现时命令：

```sh
npm test -- tests/g2-augments-combat.test.ts -t 'clockwork-accelerator public' --silent=false
```

初次日志：tick 180，`Invalid Match save: status modifier projection`。
补齐投影检查后的日志：tick 300，`RangeError: Invalid status contribution`。
两个根因均修复后，完整公开路线及独立回归通过。

2026-10-16 定向验证：

```sh
npm test -- tests/g2-augments-combat.test.ts tests/g2-1-skills.test.ts tests/m5-serialization.test.ts
# Test Files 3 passed; Tests 67 passed（新增最终 Singed 独立反例前）
npm test -- tests/g2-augments-combat.test.ts
# Test Files 1 passed; Tests 16 passed（包含最终 Singed 独立正例/反例）
```

当时全局 typecheck 唯一阻塞为并行重录尚未生成的 `tests/fixtures/g2-augments-b8-fingerprints.json`，没有报告上述修改文件类型错误。最终全局验收由集成任务统一执行。

## 行号索引

以本批文档记录时工作树为准；后续编辑可能移动行号：

- `src/simulation/combat-s13-state.ts:183`：Singed AS application ID 命名空间。
- `src/simulation/m8/restore.ts:75`：恢复推导相同 namespace。
- `src/simulation/m8/restore.ts:83`：Singed/Firelight 精确 AS 投影验证。
- `tests/g2-augments-combat.test.ts:118`：公开选择及完整战斗生产恢复路线。
- `tests/g2-augments-combat.test.ts:198`：Singed 自加攻速/减伤身份与伪造速度反例。
