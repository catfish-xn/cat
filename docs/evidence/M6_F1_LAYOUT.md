# M6 F1 布局原型实测

这是独立布局原型证据，不是生产 Phaser、完整玩法或 M4/M5 浏览器验收通过声明。未修改 `src/main.ts`、`BoardScene.ts`、`strategy-panel.ts` 或生产 CSS。

重现：`node scripts/m6-layout-measure.cjs`。使用仓库 Playwright/Chromium，真实浏览器 CSS bounds、触摸事件与截图；沙箱禁止 Chromium 系统调用，已通过受控升级执行。原型源：`scripts/m6-layout-prototype.html`；原始数据：`docs/evidence/M6_F1_LAYOUT.json`；十张截图：`artifacts/m6-f1-layout/{视口}.png` 及 `{视口}-controls.png`。artifact 目录受 gitignore 排除，可按命令重建。

| 视口 | 棋盘实际 CSS 宽 | 棋子实际 CSS 直径 | 最小 DOM 目标 |
| --- | ---: | ---: | ---: |
| 1440×1000 | 760 | 85.500 | 44×44 |
| 1440×600 | 546.781 | 61.513 | 44×44 |
| 390×844 | 370 | 41.625 | 44×44 |
| 844×390 | 327.641 | 36.860 | 44×44 |
| 360×640 | 340 | 38.250 | 44×44 |

所有视口 document.scrollWidth 等于 viewportWidth；所有主操作按钮可滚动到完整可见范围；DOM 触摸“选中崔丝塔娜→部署第 3 列第 8 行”五次均更新原型状态；390×844→844×390→390×844 后 DOM 部署仍到达预期单元格。pageerror 为零。JSON 中 bounds 在触摸滚动后采集，因此窄屏 canvas 的 y 可为负；尺寸是实际渲染尺寸，截图回到页首，横屏另重置面板滚动。

逐一读取最终五视口截图：棋盘各行未切边；中文单位符号可辨；360 宽商店长名称允许换行；主操作、部署网格和详情未互相覆盖。初版底部 sticky 主操作曾遮挡内容，读图后已移除，最终布局采用面板首部主操作并允许纵向滚动。窄屏全部棋盘和六个主操作在首屏可达；详情允许纵向滚动。横屏面板自身纵向滚动、棋盘独立保留。

## 冻结给 Goal 的可验收阈值

- `MIN_PIECE_DIAMETER_CSS = 32`；真实棋子填充圆直径乘 canvas CSS/逻辑尺度测量，不能直接读取 radius=27 后声明 54 CSS px。原型用 480×460 棋盘独立坐标空间，填充圆直径 54 逻辑像素；实际最差为 36.860 CSS px，余量 4.860 px。
- `MIN_DOM_TARGET_CSS = 44`，宽高均满足，含部署格、选择、商店、主操作、展开详情、存档/回放/统计入口。实际产品还需覆盖各组件内控件。
- `MAX_HORIZONTAL_OVERFLOW_CSS = 0`（以上五个视口）。主要中文控件不得被层遮挡；截图与实测 bounds 同时检查。
- 直接棋子触摸并非 44 px 全覆盖，因此 DOM 单位列表→选中→部署位置按钮路径是必需能力，不是降级可选项。保留备战席回收/出售及失败原因原有领域路径。原型仅证明选中/部署路径几何及事件可用，未实现这些领域操作。

## 接口与整合约束

生产仍保留 Phaser 棋盘 / DOM 面板。D 提供纯布局参数：棋盘逻辑尺寸、hex radius/origin、CSS host bounds 与 token radius；主控独占 BoardScene 用这些参数更新布局和输入变换。建议移出旧 960×800 整体面板中的商店/HUD/主操作，让 canvas 只承载棋盘与单位。原型 480×460 / radius34 / origin(35,40) 是几何可行证据，生产备战席、敌我详情和反馈接线后仍需相同矩阵验收，不可仅换 CSS 宽度后跳过。

D 的 DOM shell 提供 board/strategy/save/replay/stats 独立挂载点，主控决定生命周期。A/B/C 各挂载自己组件，不能改 D 壳或 BoardScene。统一主操作区映射现有 D/F/锁店/开始/继续/新局；中文失败原因由 MatchFailure 映射，UI 不重新推导经济合法性。产品输入坐标在 ResizeObserver 稳定后更新，并保留 M4 取消、正常松手、重复鼠标过滤与键盘 repeat。

F3 尚需：生产 canvas 触摸/拖放/取消、D/F/E、所有组件内 44 px、modal 焦点与输入遮挡、正常时间战斗、反馈遮挡、浏览器 console errors、横竖屏 canvas 坐标及生命周期清理。这些不能由 F1 原型代替。
