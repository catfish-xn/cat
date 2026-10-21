# 六费素材特效复测（2026-10-21）

沿用原表的英雄内编号。68 个已导出系统全部测量；只列超过 3 格的非全图系统，以及单列的全图系统。统一 FX_SCALE=0.44，1 格=62.4；不加特例、不改比例或素材。

口径：0–2 秒（含端点），50 ms 采样，固定种子；按各发射器独立播放时，单粒子几何最大边长乘世界缩放计算，至少两个非零维度，透明度必须 >1/255，排除空绘制范围。包含高度；不合并粒子间距，不按贴图透明像素裁边，因此不是实际发光像素覆盖。取各发射器峰值的最大值作为系统格数。旧表的最长 30 秒整系统包围盒口径已废弃。

截图每个系统一张：上排为峰值发射器、下排为同一时刻整系统；左斜视、右俯视，网格一格。Chrome 从 CHROMIUM_PATH 启动，所有页面请求限制为本机。31 张截图的两种视角几何数值均与离线测量一致（误差 <1e-6 格）。全图分类依据已提取的全场效果定义；单目标命中和落地碎片不因属于大招就归为全图。

非全图且 >3 格：梅尔 16 项、维克托 3 项、沃里克 8 项，共 27 项。全图另列 4 项，不追查；其中沃里克 系统 1 的旧整系统包围盒约 11 格，本次可见单粒子几何为 2.09 格。

| 英雄与编号 | 格数 | 是否全图 / 处理 | 截图路径 |
| --- | ---: | --- | --- |
| 梅尔 系统 1 | 7.42 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-1.png](../assets3d-local/six-cost/review/mel-system-1.png) |
| 梅尔 系统 2 | 11.28 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-2.png](../assets3d-local/six-cost/review/mel-system-2.png) |
| 梅尔 系统 3 | 6.39 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-3.png](../assets3d-local/six-cost/review/mel-system-3.png) |
| 梅尔 系统 4 | 6.39 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-4.png](../assets3d-local/six-cost/review/mel-system-4.png) |
| 梅尔 系统 5 | 3.76 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-5.png](../assets3d-local/six-cost/review/mel-system-5.png) |
| 梅尔 系统 6 | 3.86 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-6.png](../assets3d-local/six-cost/review/mel-system-6.png) |
| 梅尔 系统 7 | 4.15 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-7.png](../assets3d-local/six-cost/review/mel-system-7.png) |
| 梅尔 系统 8 | 3.88 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-8.png](../assets3d-local/six-cost/review/mel-system-8.png) |
| 梅尔 系统 9 | 4.04 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-9.png](../assets3d-local/six-cost/review/mel-system-9.png) |
| 梅尔 系统 10 | 4.04 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-10.png](../assets3d-local/six-cost/review/mel-system-10.png) |
| 梅尔 系统 11 | 5.38 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-11.png](../assets3d-local/six-cost/review/mel-system-11.png) |
| 梅尔 系统 12 | 3.18 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-12.png](../assets3d-local/six-cost/review/mel-system-12.png) |
| 梅尔 系统 13 | 3.60 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-13.png](../assets3d-local/six-cost/review/mel-system-13.png) |
| 梅尔 系统 14 | 3.84 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-14.png](../assets3d-local/six-cost/review/mel-system-14.png) |
| 梅尔 系统 15 | 3.87 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-15.png](../assets3d-local/six-cost/review/mel-system-15.png) |
| 梅尔 系统 16 | 3.87 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/mel-system-16.png](../assets3d-local/six-cost/review/mel-system-16.png) |
| 维克托 系统 1 | 7.42 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/viktor-system-1.png](../assets3d-local/six-cost/review/viktor-system-1.png) |
| 维克托 系统 2 | 7.42 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/viktor-system-2.png](../assets3d-local/six-cost/review/viktor-system-2.png) |
| 维克托 系统 3 | 25.09 | 是；全图，不追查 | [assets3d-local/six-cost/review/viktor-system-3.png](../assets3d-local/six-cost/review/viktor-system-3.png) |
| 维克托 系统 4 | 11.47 | 是；全图，不追查 | [assets3d-local/six-cost/review/viktor-system-4.png](../assets3d-local/six-cost/review/viktor-system-4.png) |
| 维克托 系统 5 | 11.47 | 是；全图，不追查 | [assets3d-local/six-cost/review/viktor-system-5.png](../assets3d-local/six-cost/review/viktor-system-5.png) |
| 维克托 系统 6 | 3.17 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/viktor-system-6.png](../assets3d-local/six-cost/review/viktor-system-6.png) |
| 沃里克 系统 1 | 2.09 | 是；全图，不追查 | [assets3d-local/six-cost/review/warwick-system-1.png](../assets3d-local/six-cost/review/warwick-system-1.png) |
| 沃里克 系统 2 | 4.36 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-2.png](../assets3d-local/six-cost/review/warwick-system-2.png) |
| 沃里克 系统 3 | 4.36 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-3.png](../assets3d-local/six-cost/review/warwick-system-3.png) |
| 沃里克 系统 4 | 4.36 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-4.png](../assets3d-local/six-cost/review/warwick-system-4.png) |
| 沃里克 系统 5 | 4.36 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-5.png](../assets3d-local/six-cost/review/warwick-system-5.png) |
| 沃里克 系统 6 | 4.01 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-6.png](../assets3d-local/six-cost/review/warwick-system-6.png) |
| 沃里克 系统 7 | 3.48 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-7.png](../assets3d-local/six-cost/review/warwick-system-7.png) |
| 沃里克 系统 8 | 3.97 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-8.png](../assets3d-local/six-cost/review/warwick-system-8.png) |
| 沃里克 系统 9 | 3.81 | 否；>3 格，待追查 | [assets3d-local/six-cost/review/warwick-system-9.png](../assets3d-local/six-cost/review/warwick-system-9.png) |

测量与截图的完整本地证据：`assets3d-local/six-cost/review/visible-2s.json`、`assets3d-local/six-cost/review/screenshots.json`；复测脚本保留在本地 `assets3d-local/six-cost/visible-2s.mjs`、`assets3d-local/six-cost/review-browser.mjs`。文档和截图标签只用英雄与编号，原始系统标识只保留在忽略目录内的机器证据中。
