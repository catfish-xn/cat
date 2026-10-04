# HEX 自动战棋原型

TypeScript + Vite + Phaser 3 的 2D 自动战棋工程基础。包含 7 × 8 六边形棋盘、7 格备战区、拖拽部署与 M1 最小自动战斗，不包含商店、羁绊或装备。

## 运行

需要 Node.js 22.12+（或 20.19+）。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

准备阶段仅可操作我方单位：从备战席拖拽到我方空棋盘格（row 4–7），在我方区域内调整，或拖回空备战格。敌方区域为 row 0–3，预置两个带红色外圈和“敌”标记的测试单位，不可由玩家移动。绿色边框表示可放置，红色表示部署区域不允许或位置被占用；非法释放会提示原因并复原，不交换或覆盖其他单位，也不限制部署数量。鼠标和触摸使用同一套拖拽事件，画布随窗口等比缩放。

棋盘上至少有 1 个我方和 1 个敌方单位时才能点击 **Start Combat** 开战（备战席不计入）；条件不满足时会提示缺少哪一方。部署后点击 **Start Combat**，单位自动寻敌、移动和普攻；血条和受击反馈显示战斗进展，结束显示 Victory / Defeat / Draw。战斗中不能部署或重复开始。点击 **Reset to Preparation** 恢复本场开始前站位和完整单位，可调整后再次开战。

## 分层

- `src/simulation/board.ts`：棋盘尺寸、双方部署边界、奇数行偏移坐标、固定顺序有效相邻格与六边形步数距离。col 0–6，row 0–7 自上向下增加。相邻格顺序为 E、SE、SW、W、NW、NE，过滤越界格；非法源格返回空数组。距离接受整数格坐标，不受阵营和占用影响。
- `src/simulation/units.ts`：单位定义、基础属性、实例 ID、player / enemy 阵营和位置联合类型。
- `src/simulation/game.ts`：初始状态、共享准备阶段校验 `validateDeployment` 与纯函数 `deployUnit`；成功返回新状态，失败保留原状态及原因。没有 Phaser、DOM、像素或输入依赖。
- `src/simulation/combat.ts` / `combat-types.ts`：独立战斗快照与公共 API，排除 bench，不修改准备状态。
- `src/simulation/combat-tick.ts`：确定性寻敌、BFS 移动、同时伤害、死亡与终局结算。
- `src/rendering/combat-session.ts`：准备/战斗/结果生命周期、固定 tick 时间累积与 Reset。
- `src/rendering/hex-layout.ts`：棋盘坐标与画布坐标转换、精确六边形命中判定。
- `src/rendering/BoardScene.ts`：Phaser 场景、单位视图、输入、预览反馈；拖拽预览和最终部署使用同一 simulation 校验，只通过 simulation 命令改变正式状态，拖拽过程仅移动视图。
- `src/main.ts`：应用入口与自适应画布配置。
- `tests/`：部署状态转换、双方区域、敌方权限、非法放置、占用检查、状态隔离、相邻关系、距离与新增行命中测试。

部署命令仅用于玩家准备阶段，战斗移动使用独立 simulation；通用棋盘边界、相邻格和距离函数不限制阵营区域。

CI 使用 Node.js 22，在 push / pull_request 时依次执行 `npm ci`、`npm test`、`npm run build`；构建已包含类型检查。

战斗固定 20 tick/s（50 ms/tick），最长 60 逻辑秒；移动每 5 tick 一格，普攻间隔 20 tick，游侠射程 3、其他单位射程 1。普攻使用基础攻击力，不计算护甲。伤害同时结算，同 tick 双方全灭为 Draw；尚未分胜负的超时战斗也为 Draw。动画不参与规则判定。完整接口与边界约定见 [Combat Contract](docs/COMBAT_CONTRACT.md)。

[M1_PLAN.md](M1_PLAN.md) 按要求保留原文，其中旧基线阻塞和“本轮仅计划”是编写时记录；实际开发基于 PR #1 合并后的 main。

所有图形由 Phaser 即时绘制，无外部素材或服务依赖。

M1 的测试覆盖、浏览器复现方法、子代理分工及验证限制见 [验证记录](docs/M1_VALIDATION.md)。
