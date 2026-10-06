# M7 验证记录

- 范围与验收清单：[M7_PLAN](../M7_PLAN.md)；基线与 F1 数据：[M7_BASELINE](M7_BASELINE.md)
- 状态：F1 已由用户确认（2026-10-06）；W2 主要功能完成，F3 回归进行中；F4 用户试玩签收尚未进行。

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

## 尚未完成

- `verify-m7-presentation.cjs` 与五视口走查目前只在本地运行，尚未加入 CI。
- F4：同一干净提交的完整门禁，以及用户按 [M7_PLAN 第 8 节试玩清单](../M7_PLAN.md#8-验收清单) 签收。
