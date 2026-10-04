# HEX 自动战棋原型

TypeScript + Vite + Phaser 3 的 2D 自动战棋。包含 7 × 8 六边形棋盘、7 格备战区、五槽商店、金币和连续回合；战斗沿用 M1 的确定性固定 tick 核心。不包含羁绊、装备、升级或正式英雄数据。

## 运行

需要 Node.js 22.12+（或 20.19+）。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
# 首次运行浏览器验证时：
npx playwright install chromium
npm run test:browser
npm run test:preview
```

准备阶段仅可操作我方单位：从备战席拖拽到我方空棋盘格（row 4–7），在我方区域内调整，或拖回空备战格。敌方区域为 row 0–3，预置两个带红色外圈和“敌”标记的测试单位，不可由玩家移动。绿色边框表示可放置，红色表示部署区域不允许或位置被占用；非法释放会提示原因并复原，不交换或覆盖其他单位，也不限制部署数量。鼠标和触摸使用同一套拖拽事件，画布随窗口等比缩放。

每局从 Round 1、10 金币和五个初始我方备战单位开始。商店显示五个占位单位，点击 Buy 花费3金币，单位进入第一个空备战格；已购槽不会自动补货。点击我方棋子选中后可 Sell（棋盘/备战区均可），返还2金币。Reroll 花费2金币刷新整店。金币不足、备战区满或阶段不允许时操作失败，不改变金币、阵容或随机状态。

桌面快捷键：**D** 刷店；**E** 出售悬停的我方单位，空白处按 E 出售明确选中的单位。悬停敌人时拒绝，不会误卖此前选择的我方棋子。出售成功会清除选择；拖拽中可按 E 出售，随后释放鼠标不会重新部署。每个 D 按下事件（包括长按自动重复）独立校验并立即提交一次合法刷新，金币不足后不扣钱、不推进 RNG。购买、拖拽释放和买卖刷新不等待动画；Ctrl/Meta/Alt 组合键和文本编辑输入不会触发操作，F 没有功能。

棋盘上至少有 1 个我方和 1 个敌方单位时才能点击 **Start Combat** 开战（备战席不计入）；条件不满足时提示具体原因。单位自动寻敌、移动和普攻；血条和受击反馈显示战斗进展，结束显示 Victory / Defeat / Draw。战斗和结算阶段不能部署、买卖、刷新或重复开始。

每次战斗结束自动结算一次基础收入5金币，胜负平都相同。点击 **Continue** 进入下一回合，免费刷新商店，保留现有阵容与准备站位；战斗HP、死亡和冷却不会带入下一场。Continue 不再次发钱，可以连续进行超过五轮。Debug New Match 只用于整局重开，正常回合不需要 Reset 或刷新网页。

默认 seed 为42；纯 `createMatch(seed)` 接受 uint32 整数（包含0）。同 seed、初态和操作可重放全部商店与回合。商店允许重复单位和连续两次相同内容。M2 固定敌阵为两个占位敌人，没有等级概率、共享卡池、利息、星级、玩家HP或淘汰。卖光阵容并把金币耗尽可能使该局无法继续；debug整局重开可恢复，正常五轮流程不会要求这样操作。

## 分层

- `src/simulation/board.ts`：棋盘尺寸、双方部署边界、奇数行偏移坐标、固定顺序有效相邻格与六边形步数距离。col 0–6，row 0–7 自上向下增加。相邻格顺序为 E、SE、SW、W、NW、NE，过滤越界格；非法源格返回空数组。距离接受整数格坐标，不受阵营和占用影响。
- `src/simulation/units.ts`：单位定义、基础属性、实例 ID、player / enemy 阵营和位置联合类型。
- `src/simulation/game.ts`：初始状态、共享准备阶段校验 `validateDeployment` 与纯函数 `deployUnit`；成功返回新状态，失败保留原状态及原因。没有 Phaser、DOM、像素或输入依赖。
- `src/simulation/combat.ts` / `combat-types.ts`：独立战斗快照与公共 API，排除 bench，不修改准备状态。
- `src/simulation/combat-tick.ts`：确定性寻敌、BFS 移动、同时伤害、死亡与终局结算。
- `src/simulation/match.ts` / `match-types.ts`：长期 MatchState、纯经济命令、阶段门禁、一次性结算与下一回合；准备仍用 GameState，临时战斗仍用 CombatState。
- `src/simulation/rng.ts` / `shop.ts` / `match-rules.ts`：显式 lcg32-v1 RNG、五槽商店及固定价格；RNG属于MatchState，只在首次商店、成功刷新或下一回合时推进。
- `src/rendering/match-session.ts`：持有当前 MatchState、转发 simulation 命令、累积固定 tick 时间；不决定经济或回合规则。
- `src/rendering/hex-layout.ts`：棋盘坐标与画布坐标转换、精确六边形命中判定。
- `src/rendering/BoardScene.ts`：Phaser 场景、单位视图、输入、预览反馈；拖拽预览和最终部署使用同一 simulation 校验，只通过 simulation 命令改变正式状态，拖拽过程仅移动视图。
- `src/main.ts`：应用入口与自适应画布配置。
- `tests/`：部署状态转换、双方区域、敌方权限、非法放置、占用检查、状态隔离、相邻关系、距离与新增行命中测试。

部署命令仅用于玩家准备阶段，战斗移动使用独立 simulation；通用棋盘边界、相邻格和距离函数不限制阵营区域。

CI 使用 Node.js 22，在 push / pull_request 时执行 `npm ci`、`npm test`、`npm run build`（含类型检查）；独立 Chromium job 验证同一局五回合、390×844触摸模拟及生产 preview 首屏/购买，并上传账本、截图和trace。`test:browser` 与 `test:preview` 自动启动和关闭本地服务器；若使用现有服务器可设 `M2_URL`，系统浏览器可设 `CHROMIUM_PATH=/usr/bin/chromium`，证据默认输出到忽略的 `artifacts/`。

战斗固定 20 tick/s（50 ms/tick），最长 60 逻辑秒；移动每 5 tick 一格，普攻间隔 20 tick，游侠射程 3、其他单位射程 1。普攻使用基础攻击力，不计算护甲。伤害同时结算，同 tick 双方全灭为 Draw；尚未分胜负的超时战斗也为 Draw。动画不参与规则判定。完整接口与边界约定见 [Combat Contract](docs/COMBAT_CONTRACT.md)。

[M1_PLAN.md](M1_PLAN.md) 按要求保留原文，其中旧基线阻塞和“本轮仅计划”是编写时记录；实际开发基于 PR #1 合并后的 main。

[M2_PLAN.md](M2_PLAN.md) 与 [M2_GOAL.txt](M2_GOAL.txt) 保留原规划内容；其中“本轮只规划”记录的是先前规划阶段。后续已按完整M2目标实施，计划第13节追加桌面高频操作正式验收，真实 Chromium 脚本同时覆盖该节。公共接口见 [Match Contract](docs/MATCH_CONTRACT.md)，最终验证与限制见 [M2 验证记录](docs/M2_VALIDATION.md)。

所有图形由 Phaser 即时绘制，无外部素材或服务依赖。

M1 的历史测试覆盖、浏览器复现方法、子代理分工及验证限制见 [验证记录](docs/M1_VALIDATION.md)。当前 `scripts/verify-m1-browser.cjs` 是兼容入口，转发到新的五回合验证，保留部署与开战门禁回归；旧两场 Reset 脚本可在 M1 提交中查阅。
