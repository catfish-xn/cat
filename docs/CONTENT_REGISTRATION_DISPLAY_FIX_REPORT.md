# 内容登记与显示修复报告（2026-10-28）

基线：HEAD `97068956a7ff0b9c96aad92323f98bce82b006fb`；实际分支 `claude/sol-cat-cx-s2c`；初始工作区干净。仅编辑工作区，不执行 Git 写操作。以下原因先调查并记录，再修改代码。

中断后本轮先执行 `git status` / `git diff`：HEAD 和分支未变，继承了 3 个 src、5 个测试文件的修改及本报告；本轮在其基础上补齐三项旧期望，未重做已通过的显示修复。

## 逐项根因与修复判断

1. **技能登记差集：`b5-voidling-ability`。** G4 提交 `8cfc6d10` 有意新增先知虚灵战斗召唤物（`src/simulation/content/augment-pool-batch5-g4.ts:45`）及其无主动技能的普攻定义，并汇入技能表；并非重复登记。原 `g24-voidspawn` 是传送门召唤物，两者有不同身份和出生来源。M5 的独立单位集合与 M8 的预期名单未同步。M5 按原方式从 G4 单位定义生成预期技能；M8 保留独立英雄名单，从 G4 单位定义取得新召唤物的技能 ID。更新失效的测试标题，不删除或放宽断言。
2. **强化文本差集：`snipers-nest`。** H10 提交 `f32cdd76` 将狙神之巢从禁用的第二批库存迁入第五批 H10，第二批原有文本仍有用途；不是误加文本。`scripts/augment-content-archive.ts:503` 已明确保存迁移前的归档文案。测试只枚举现有 B1/B2/B3/B3XP，遗漏迁移者。补上迁移记录并继续从对应内容对象生成预期键，保留运行时不含历史文案的原断言。基线实际技能键数为 76 对 75，文本键数为 150 对 149；Vitest 的省略显示 `…(75)` / `…(149)` 不包含首个已显示元素。
3. **虚灵显示源缺失。** `ability-display.ts` 对同类召唤物逐表查找，却没有 G4 召唤物表。按已有分支加入该表，不改技能、召唤、属性或数值。
4. **便携异变装备引用未展开模板。** R2 有意为各异变建立独立装备身份，`augment-pool-batch5-r2-items.ts:13` 直接把 `a.description` 放进描述；特殊装备显示又原样输出，绕过了异变描述的替换流程。终结者来源 `s13-p3-source.ts:84` 的 `ExecutePercent=0.15`，显示应为 15%。调查同时发现 7 个 P3、31 个 G23 便携异变模板含占位符。复用现有异变显示入口，并为该入口补 P3 来源的同等数值替换；全部从源值计算，不修改原始定义或内容 digest。
5. **动态文案导致测试期望过时。** `748b836a` 已有意将 `〔对局动态值〕` 在显示时转为当前值；未提供值时显示“未确定”。`caretakers-ally` 的原文和独立 14.24 归档一致，只是测试把渲染结果与模板直接比较。同文件还把已启用动态显示的 `starry-night` 和已有正文的 `bronze-for-life-i` 期望成 null。保留原模板与独立归档的精确比较，同时精确检查无动态值的渲染结果和传入弈子后的结果；更新两个过时的 null 期望，保留另两个仍应为 null 的断言。

## 验证

基线：指定的五项涉及 **6 个测试文件**，复现 7 个失败，155 个通过（含两项动态文案失败）。

首轮修复后 161 通过、1 失败：文本键集合修复后，`augment-text-identity.test.ts` 的后续循环首次到达动态文本比较，暴露 `rocket-collection` 等原模板与“未确定”显示结果的同类旧期望。独立检查全部 B1/B2/B3/B3XP 条目：渲染与模板的所有差异均恰为现有动态占位符替换，无额外文案差异。按第 5 项相同方式生成精确显示期望，原始文本和内容身份检查保留。

## 续做核对：计数与夹具（先查原因）

6. **B10 种子期望滞后。** `tests/fixtures/m8-neutral-public-route.ts:15` 的公开命令路线已改用 65，但测试仍钉死 2423，并向独立神谕传入旧种子。只读执行独立 `m5/oracle.g2.cjs` 与 `orb-combo-oracle.cjs`：65 的开场为 `none`，6-7 为 `rift-herald-v1`，奖励依次为成装锻造器、吉格斯、1 金币、俄洛伊、4 金币。应引用夹具当前种子，并继续由独立神谕计算完整奖励期望；不改路线或录制夹具。
7. **强化总量期望过时。** 第五批扩池后目录与独立全池均为 306；`v15-anomaly-availability.test.ts` 仍保留早期的 235。只更新精确数量与来源注释；56 个异变及双模式准入断言保留。
8. **全目录与默认准入池比较口径不一致。** 独立神谕 `augmentPool` 第六参数 `sharedCarousel` 默认 false，明确过滤 `table-scraps` 与 `young-and-wild-and-free`。只读核对默认三层池合计 304，开启共享选秀后三层并集恰为 306，差集恰为这两张卡。D11 应比较完整目录与开启该参数的独立并集，不删除卡、不改准入规则。

## 本轮改动位置

- `tests/fixtures/m8-neutral-public-route.ts:15`：导出已有 `HERALD_ROUTE_SEED=65`，种子和路线不变；`tests/m8-b10-encounter-outcomes.test.ts:69`、`:74` 引用它检查种子并调用独立奖励神谕，替换旧 2423。
- `tests/v15-anomaly-availability.test.ts:9`、`:11`：更新标题、第五批来源注释与精确 306 断言。
- `tests/d11-fill-source.test.ts:54`：开启独立神谕的共享选秀准入，取三层并集，精确验证 306 和完整键集合；保留其他断言。
- src 修复沿用上一轮并复核：`src/simulation/ability-display.ts:21`（G4 显示源）、`src/presentation/g23-display.ts:144`（P3 取值）、`src/presentation/special-item-text.ts:53`（便携异变复用填值）。无其他 src 改动。

## 最终验证

续做前运行全部指定 9 个文件：219 通过、3 失败；6 个内容登记/显示文件全部通过，三项失败恰为本轮随后修正的旧种子、235 和默认池口径。

最终运行（118.08 秒，退出码 0）：**9 个文件、222 项全部通过，无跳过项**。

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 tests/m5-combat.test.ts tests/m8-ability-contracts.test.ts tests/augment-text-identity.test.ts tests/g2-2-ability-display.test.ts tests/presentation/special-item-text.test.ts tests/augment-pool-display-audit.test.ts tests/m8-b10-encounter-outcomes.test.ts tests/v15-anomaly-availability.test.ts tests/d11-fill-source.test.ts
npm run typecheck
git diff --check
```

最终版本 `tsc --noEmit` 与 diff 空白检查均通过。内容身份与服务端 bundle 隔离断言也在上述测试中通过。未运行全仓回归或浏览器验收。

【未完成】无，本任务所有指定项已完成。
【需要用户决定】无。
【风险】验证范围为指定回归与类型检查；未修改规则数值、超时、门槛、预算、内容身份常量或任何录制夹具。
【下一步】执行端审核工作区并提交；本轮未执行 Git 写操作。
