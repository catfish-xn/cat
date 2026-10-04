# HEX 自动战棋原型

TypeScript + Vite + Phaser 3 的 2D 自动战棋工程基础。当前只包含 7 × 6 六边形棋盘、基础单位数据、7 格备战区和拖拽部署，不包含战斗、商店、羁绊或装备。

## 运行

需要 Node.js 22.12+（或 20.19+）。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

从备战区拖拽单位到任意空棋盘格，可在棋盘上移动，或拖回空备战格。绿色边框表示可放置，红色表示已占用；释放到非法位置会复原，不交换或覆盖其他单位。鼠标和触摸使用同一套拖拽事件，画布随窗口等比缩放。

## 分层

- `src/simulation/board.ts`：棋盘尺寸、奇数行偏移坐标与边界规则。
- `src/simulation/units.ts`：单位定义、基础属性、实例 ID 和位置联合类型。
- `src/simulation/game.ts`：初始状态和纯函数 `moveUnit`；成功返回新状态，失败保留原状态及原因。没有 Phaser、DOM、像素或输入依赖。
- `src/rendering/hex-layout.ts`：棋盘坐标与画布坐标转换、精确六边形命中判定。
- `src/rendering/BoardScene.ts`：Phaser 场景、单位视图、输入、预览反馈；只通过 simulation 命令改变正式状态，拖拽过程仅移动视图。
- `src/main.ts`：应用入口与自适应画布配置。
- `tests/`：部署状态转换、非法放置、占用检查、状态隔离与六边形几何测试。

单位定义包含基础生命、攻击和护甲数据，仅作为后续扩展结构，当前不计算战斗。未来可在 simulation 内新增命令、规则和确定性更新，再由 rendering 消费状态；避免把游戏规则放入 Phaser 场景。

所有图形由 Phaser 即时绘制，无外部素材或服务依赖。
