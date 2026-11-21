# 选秀界面按 S13 原版重做（2026-11-02）

用户 2026-11-02 批准按推荐执行（项目线程消息 cmsg_01MDeyPQoaEQhyeQj8nGXth1VDHv8RnKpYGbfcsDT3KZwK）。参考：Riot 2024-11-06 S13 改版开发文章的选秀配图（开发预览，非 14.24 实录）。只改联机 3D 表现；选秀规则、拾取判定圈 0.55 格、被撞算拿、不自动追均不变。

## 改动

| 位置 | 原版 | 现在 |
| --- | --- | --- |
| 待选英雄头顶 | 眼睛查看徽章 + 下方装备图标（装备框） | `carousel-stage.ts`：去掉费用色方块和星级；装备图标加原版装备框（`item.frame`），其上放眼睛徽章，四态 `carousel.inspect` / `.hover` / `.disabled` / `.selected` 对应可选 / 悬停 / 不可选 / 待确认。未加载 UI 包时用纯色替身。拾取框上沿改到徽章。 |
| 待选英雄脚下 | 按费用着色的品质圈 | 恢复 `carousel-shareddraft-unittier<费用>`（1–6，越界取边界），挂在随转盘转动的单位上、有界循环重建；缺特效时画费用色平圈替身。被领取后立即结束。此项取代 `docs/NORING_V26_REPORT.md` 中“选秀不播 unittier”的约定（棋盘脚环仍不恢复）。 |
| 顶部 | 只有阶段条（选秀图标八角星 + 倒计时） | 3D 下选秀面板只保留“查看我的棋盘（空格）”按钮；标题、状态字、面板自带计时和放行顺序列表不再显示（DOM 仍在，2D 不变）。阶段条选秀图标可换原版 `stage.carousel`。 |
| 底部 | 商店收成梯形按钮 | 3D 选秀时显示不可点的收起标签 `.carousel-shop-tab`（提示“选秀中商店不可用”），图标可换原版 `hud.shop-toggle`。 |

## 原版素材（只在本机/测试服 UI 包，不进仓库）

新 sprite 需合并进 UI 包 `manifest.json` 的 `sprites`；坐标见项目文件 `carousel-ui/ui-manifest-carousel-sprites.json`（主 HUD 图集与 unitinfo 图集，均已在 UI 包内）。未合并时各处自动用替身。

## 测试

`tests/rendering3d-carousel.test.ts` 中五条“无脚环 / 头顶费用方块”断言按本次批准改为：仅有品质圈一种环、每单位一个 unittier 特效且随单位结束、徽章/装备框位置与状态、UI 包到达后换原版贴图。
