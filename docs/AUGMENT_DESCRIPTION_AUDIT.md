# 强化玩家说明补齐审计（2026-10-28）

> 2026-10-28 更新：本文为历史记录；卓尔不群现按14.24精确阶段表240/330/420/530生命、45/50/55/60%攻速，安慰剂+各阶段固定15金币、1%攻速。覆盖本文相应旧值；普通安慰剂不变。详见 [数值对齐报告](AUGMENT_14_24_ALIGNMENT.md)。

## 范围与来源

- 实际工作区为 `claude/sol-t14 @ 2dc80444`；任务预期为 `codex/v25-integration-2 @ 97068956` 或更新提交。本次保留实际分支和 HEAD，不执行 Git 写操作。
- 73 张缺失说明的根因是 `augmentPlayerDescription` 的各级说明源均未覆盖对应 ID，尽管领域定义已有中文描述。
- 仅向 `src/presentation/augment-pool-text.ts` 的 `AUGMENT_AUDITED_DESCRIPTIONS` 增加 73 条玩家模板，沿用原有优先级、懒加载和动态值替换。唯一修改的 `src` 文件就是此文件。
- 原文只读自 `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json` 的 `description_zh_cn`，通过 `augmentApiName` 对照 `apiName`；保留原文换行、空格、标点和动态占位。
- 存档缺失回退清单：**空**。此存档实际含有全部 73 张，包括 `expected-unexpectedness`（意料之中的意外）和 `im-the-carry-now`（我成C位了）。未复制存档文件或其原始数据集到仓库。
- 不修改规则、数值、版本、内容身份、服务器或录制夹具。此审计核对说明来源与展示覆盖，不代表对全部机制重新进行规则审计。

## 已发现的数值差异（仅记录，不修规则）

| 强化 | 14.24 存档原文中的数值 | 当前实现 | 代码依据 |
| --- | --- | --- | --- |
| `built-different`（卓尔不群） | 240–530 生命值、45–60% 攻速，随阶段变化 | 阶段 2/3/4/5+：300/400/500/600 生命值、45/55/65/75% 攻速 | `src/simulation/content/augments.ts:485`；`src/simulation/augment-effects.ts:151` |
| `placebo-plus`（安慰剂+） | 获得 15 金币、1% 攻速 | 阶段 2/3/4+ 分别获得 15/18/22 金币；攻速仍为 1% | `src/simulation/content/augments.ts:316`；`src/simulation/choice-acquisition.ts:12` |

按任务要求，玩家说明使用存档原文，以上实现均保持原样。是否另行统一规则与说明，交执行端询问用户，不包含在本次文字补齐中。

## 动态值

六张模板含对局动态值：`diversified-portfolio-plus`、`diversified-portfolio`、`glorious-evolution`、`lunch-money`、`forward-thinking`、`ghost-of-friends-past`。最后一张有三个值，其余各一个。

沿用现有 `〔对局动态值〕` 替换机制：传入投影值时按顺序填充，缺值显示“未确定”。当前 `augmentDynamicValues` 未为这六张提供这些计数；本次未新增领域投影，也不在展示层推算计数。

## 验证

- 新增 `tests/augment-description-coverage.test.ts`：遍历全部 306 张已开放强化，检查说明非空、无 `@`、未替换占位或内部 ID/API 名；覆盖 73 张玩家与卡片路径、101 条审计模板与存档逐字一致，以及动态值的顺序、零值、小数和缺值替换。存档不存在时仅存档测试 `skipIf`。
- 旧审计测试中两条“说明为 null”的预期改为对应官方全文精确断言，其余断言保持。
- 新测试先在未补文字时运行：76 条失败；补齐后新测试 76 条全部通过。
- 完整指定命令：`npm test -- --configLoader runner --maxWorkers=3 tests/augment-description-coverage.test.ts tests/augment-pool-display-audit.test.ts tests/augment-text-identity.test.ts tests/presentation/*.test.ts`。
- 结果：17 个文件通过、290 条测试通过；4 个浏览器测试文件在初始化失败，27 条测试未运行。失败文件为 `hover-card-long-press`、`hover-card-pin`、`hover-dom`、`unit-panel`。当前无 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`；现有测试夹具尝试启动 Chrome，被沙盒拒绝。未修改测试夹具、超时或权限；需 Claude 通过 `codex-browser exec` 补验。
- `npm run typecheck`（`tsc --noEmit`）通过；内容与战利品回放身份校验通过；`git diff --check` 通过。
