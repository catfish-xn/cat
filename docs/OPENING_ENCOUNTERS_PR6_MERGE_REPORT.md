# PR6 集成冲突与 must-fix 修复报告（2026-10-22）

工作区 `/home/aiapps/workspcae/cat-enc6`，分支 `codex/encounters-pr6`；HEAD=`744d84efe8f4504d03597feebbd8eadf0dc92ecb`，正在合并本地已有的 `origin/codex/encounters-framework@f32552a3190269ae150b9e9971d57dd245a1c1f2`。按用户转述的 PR #398 DBoE 两项 must-fix 离线修复，没有联网查评论。没有 git add/commit，索引仍显示 8 个 UU，但对应工作文件已无冲突标记；不是已完成的 Git 合并提交。

## 两项 must-fix

1. **进度接口拆名**：`src/simulation/opening-encounter.ts:334` 的 `readOpeningMelProgress` / `OpeningMelProgress` 只返回梅尔门槛观察；`:367` 的 `readOpeningForgeProgress` / `OpeningForgeProgress` 只返回组件/神器锻造器进度。非适用奇遇 reader 返回 null。`src/simulation/private-seat-view.ts:102` 输出 `openingMelProgress`（可为 null）及可选 `openingForgeProgress`（有锻造器授予收据时存在）。旧同名 reader/类型/投影字段删除，match.ts:6 公共导出同步。没有向公共玩家投影添加本人进度。
2. **统一收据校验**：`src/simulation/opening-encounter.ts:136` 认证绑定与事实后，在 `:148` 严格比较完整 receipts 与「到期效果收据 + 首次梅尔观察收据」，继续调用原锻造器、猴子来源认证。各自首次触发、字段白名单、缺失/重复/篡改拒绝规则保留。`:319` 的健康结算钩子只处理梅尔，其他奇遇原引用返回，保留 PR2/PR5 收据。`src/simulation/opening-monkey.ts:33` 先限定猴子奇遇，再按节点读收据，防止梅尔 settlementId 恰为 `3-5` 时误认为猴子效果。

合同同步位置：`docs/MATCH_CONTRACT.md:1`、`docs/MULTIPLAYER_CONTRACT.md:1`、`docs/UI_REQUESTS.md:1134`；后续 PR8 使用两个独立本人字段接线。PR2/PR6 独立交付报告保留历史记录并标明本报告为当前集成说明。

## 内容身份与保留范围

- 配置版本：`opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`（`src/simulation/content/opening-encounters.ts:797`）。
- CONTENT：`fnv1a32-utf16:dcaa5334`；LOOT_REPLAY：`fnv1a32-utf16:14cd405f`（`src/simulation/content/identity-constants.ts:3`）。
- 使用既有 `node scripts/update-content-identities.cjs --write` 离线生成，再执行 `--check`；未手写摘要。
- rules/content 沿用未发布 v21；schema/save/replay/command=`12/8/6/6`。不录制 epoch、不改历史 golden/身份断言。
- 保留 PR2 强化/锻造器、PR4 魔像关闭接口、PR5 猴子/杰作完整逻辑；梅尔和沃里克 enabled=false、各800 Bps，奖励继续关闭。效果 receiptKey 保留，梅尔键另为 melReceiptKey。
- 本次实际编辑仅在 `src/simulation/`、`tests/`、`docs/`。开工前已暂存的 `src/presentation/orb-loot.ts` 未修改，工作文件与索引 SHA256 相同：`ee75111b7e6b430172e2a4383d914e4bd3d352c146f8a77323024c9bde1e1fe3`。

## 验证

环境：`export PATH=$HOME/.local/bin:$PATH`。TypeScript 使用本地 `npx --no-install tsc --noEmit`，避免任何下载。Vitest 因共享 node_modules 只读，默认配置加载器写 `.vite-temp` 会报 EROFS；改用 `--configLoader=runner`，测试配置/断言不变。

最终 `tsc --noEmit`、`update-content-identities --check`、`git diff --check` 全部通过；8 个冲突文件的工作区冲突标记为 0，实际编辑范围外文件为 0。

首轮命令：

```bash
npm test -- $(git grep -l opening-encounter -- tests/) \
  tests/opening-encounters-integration.test.ts tests/opening-encounters-trainer-golems.test.ts \
  tests/server/mel-save-settlement.test.ts tests/v19-part2.test.ts tests/t5r-private-seat-view.test.ts \
  --configLoader=runner --maxWorkers=4 --reporter=json --outputFile=/tmp/pr6-tests.json
```

首轮 260 项，259 通过、1 失败。补充收据隔离回归后重跑 PR5/PR6（`--maxWorkers=2`），73/73 通过，结果 `/tmp/pr6-retest.json`。以下按每文件最后一次执行去重统计，共 **9 文件、267 项，266 通过、1 失败、0 跳过**：

| 测试文件 | 通过 / 总数 |
| --- | --- |
| opening-encounters-integration | 46 / 46 |
| opening-encounters-pr2 | 31 / 31 |
| opening-encounters-pr5 | 31 / 31 |
| opening-encounters-pr6 | 42 / 42 |
| opening-encounters-trainer-golems | 35 / 35 |
| opening-encounters | 6 / 6 |
| server/mel-save-settlement | 20 / 20 |
| t5r-private-seat-view | 16 / 16 |
| v19-part2 | 39 / 40 |

唯一预期失败：`tests/v19-part2.test.ts:291`，`v19 emblem replacement and schema > retains v19 rules in v20-live-combat schema/save/replay 11/7/5`。旧断言期待 schema11/save7/replay5 和 `s13-g2-3-v20-live-combat`，实际为 schema12/save8/replay6 和 `s13-g2-3-v21-opening-encounters`。本批没有其他旧 epoch/身份失败；不为变绿修改此断言。

新增回归验证六种 PR2 收据不被梅尔钩子改写、跨奇遇混入/缺失拒绝、PR5 四分支原收据保留及重复拒绝、两类进度互斥、梅尔节点标识碰撞。t5r 白名单只更新本次有意更名的投影字段，不改变旧身份断言。
