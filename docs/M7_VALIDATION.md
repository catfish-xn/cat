# M7 验证记录

- 范围与验收清单：[M7_PLAN](../M7_PLAN.md)；基线与 F1 数据：[M7_BASELINE](M7_BASELINE.md)
- 状态：F1 已由用户确认（2026-10-06）；W2 完成；外部审计（d46ed54）的 7 项发现已修复并补门禁；F4 用户试玩签收尚未进行。

## W2 交付

| 项目 | 内容 | 证据 |
|---|---|---|
| 官方 S13 素材 | 40 个 14.24 图标（19 英雄、5 职业、16 装备），清单含来源与 sha256；棋子、商店、装备、羁绊面板、回放使用；缺图回退代码绘制徽记 | `public/assets/s13/`、`src/presentation/s13-asset-manifest.ts`、`tests/m7-hero-identity.test.ts` |
| 真实 S13 羁绊信息 | 商店列出种族 + 职业，与归档客户端数据逐项比对 | `tests/m7-hero-identity.test.ts` |
| 回放棋盘 | 与实战相同的头像、星级、费用、阵营与血蓝盾显示，几何与棋盘一致 | `scripts/verify-m7-presentation.cjs` replay-identity |
| 帮助 | 可关闭、可重开；焦点圈定；打开时 D/F/E 不生效；不发命令 | 同上 help-dialog |
| 减少动效 | 仅表现层；开关前后首战完整 Match 与战斗账本完全相同 | 同上 reduced-motion-equivalence |
| 中文化 | 画布残留英文全部替换 | 代码 diff |
| 免责声明 | 页脚与 README | `#legal-notice` 断言 |

## 回归（提交 de31f6a 及之后）

| 检查 | 结果 |
|---|---|
| 单元测试（本地，vitest 5） | 48 文件 / 717 项通过，383s |
| 原生输入门禁 dev（本地） | 100/100 |
| M7 表现门禁（本地 preview） | 3/3 |
| 五视口走查（本地 preview） | 横向溢出 0、<44px 目标 0、页面/控制台错误 0；侧栏最小字号 12px |
| CI [37446456876](https://github.com/catfish-xn/cat/actions/runs/37446456876)（de31f6a） | 10/10 作业通过：单元/构建/headless/性能、三条桌面路线 × dev/preview（炮手含 M6 存档、回放与 30 次生命周期门禁）、两种模式原生输入 + 正常时间触摸路线、最终证据比对 |

de31f6a 之后的提交：手机端把非当前主操作的按钮移到商店下方（仅布局），以及文档。该布局改动已在本地复跑原生输入门禁 dev 100/100、M7 表现门禁 3/3 和五视口走查，尚未单独跑 CI。

## 外部审计 d46ed54 的处理（2026-10-06）

| 编号 | 级别 | 问题 | 修复 | 回归门禁 |
|---|---|---|---|---|
| F01 | High | 双击/双触“继续”直接开始下一场战斗 | 生命周期按钮在阶段切换后 400ms 内忽略另一个生命周期操作；D/F/E、购买等不受影响 | `verify-m7-presentation` continue-double-activation（鼠标 dblclick + 触摸双击，并确认之后正常点击仍可开战）；在 d46ed54 上运行该门禁于此项按预期失败 |
| F02 | High | 帮助打开时战后奖励抢焦点并可被 Enter 选中 | 帮助打开期间奖励层 `inert`、不自动聚焦、Tab 只在帮助内循环；关闭帮助后焦点交给奖励 | help-over-reward-choice（公开操作推进到 2-7，帮助跨战斗结束保持打开） |
| F03 | High（限子路径部署） | 默认构建在 `/cat/` 下请求根路径资源导致白屏 | `vite.config.ts` 使用相对 base | `verify-m7-subpath`：严格只在 `/cat/` 提供 dist，入口与 40 个图标全部 200；在 d46ed54 构建上按预期失败 |
| F04 | Medium | 回放没有攻击/施法等战斗反馈 | 新增纯函数 `fx-plan.ts` 作为唯一事件→特效映射，实战 Phaser 与回放画布共用；回放同时驱动 DOM 数字飘字；seek/切战清理 | replay-feedback：4× 连续播放，特效计数与账本中的攻击/施法数逐一相等，且出现数字飘字；`tests/m7-fx-plan.test.ts` |
| F05 | Medium | 最上排血条被画布裁切 | 棋盘原点下移到 y=50（实战与回放共用 `BOARD_LAYOUT`） | `tests/m7-layout.test.ts` 检查所有格子的血条与棋子在画布内、棋盘不压备战席 |
| F06 | Low | 治疗数字被 DOM 与画布各画一次 | 数字只由 DOM 渲染器负责，画布只画光环 | `tests/m7-fx-plan.test.ts` 断言画布特效不含数字文本 |
| F07 | Low | 头像 404 时没有回退 | 图片加载失败时一次性换成代码徽记；装备/羁绊图标退回文字 | portrait-404-fallback（拦截德莱厄斯头像返回 404） |
| 验证缺口 | Medium | M7 脚本未进 CI，走查只记录不判失败 | `m7-screens` 对溢出、小目标、棋子尺寸、页面错误判失败；新增 `m7-budget`（与现场构建的 M6 签收树成对比较 JS gzip ≤+10%、首次可操作 ≤+20%）；CI 新增 `m7-presentation` 作业运行四项 | CI 见下 |

修复过程中，预算门禁发现首次可操作时间比 M6 慢约 25%（CPU 采样定位到 Phaser 文字纹理上传、头像 blob 解码与图片解码）。改为页面空闲时再加载头像、DOM 图标懒加载、Phaser 文字 2 倍分辨率后，本地成对测量为 +8.7%（M6 中位 774ms，M7 841ms）；JS gzip +3.3%。

审计报告中最新提交 8 项单元测试超时：本地在空闲机器上完整重跑 50 文件 / 722 项全部通过（432s），CI test-and-build 亦通过；超时与审计环境的 CPU 竞争一致，未修改超时设置。

## 尚未完成

- CI 37483034783（69e1387）：除 browser-dev-cannon 的 M6 生命周期堆门禁（>1MiB）外全部通过；性能/内存问题已移交 Codex，详见 [M7_HANDOFF](M7_HANDOFF.md)。
- F4：同一干净提交的完整门禁，以及用户按 [M7_PLAN 第 8 节试玩清单](../M7_PLAN.md#8-验收清单) 签收。
