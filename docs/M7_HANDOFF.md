# M7 交接（Claude → Codex）

- 分支：`claude/friendly-darwin-pak00a`（基于 PR #7 `feat/m6-product-replay`，M6 签收提交 631c131；PR #7 未合并）
- 交接前最后的代码提交：69e1387（本交接只追加文档）
- 相关文档：[M7_PLAN](../M7_PLAN.md)、[M7_BASELINE](M7_BASELINE.md)、[M7_VALIDATION](M7_VALIDATION.md)、[M6_FINAL_REVIEW](M6_FINAL_REVIEW.md)

> 后续跟进（2026-10-07）：以下保留交接时的历史状态。Codex 的完整 CI、内存快照与负对照结果见 [M7_CODEX_AUDIT](M7_CODEX_AUDIT.md)；原始 `111e9f8` 本次内存检查已通过，另发现并修复了完整路线测试与 400ms 防连击保护的时序冲突。冻结内存预算及正式测量方法未调整。

## 1. M7 已完成的功能

- 主题令牌 `src/presentation/theme.ts`，CSS 变量统一注入（`applyThemeVariables`）。
- 19 个英雄的身份数据（简称、颜色、形状、S13 起源/职业）与代码绘制徽记 `hero-identity.ts`。
- Riot 官方 S13（14.24）头像/羁绊/装备图标 40 个，取自 CommunityDragon，带 sha256 清单 `s13-asset-manifest.ts`。
- 图标加载失败回退为代码徽记/文字（`installImageFallback`）。
- 棋子视图 `UnitView`：头像、星级铜/银/金、血条蓝条、目标环，文字 2 倍分辨率。
- 纯函数 `fx-plan.ts`：唯一的战斗事件→特效映射，实战 Phaser（`combat-fx.ts`）与回放画布共用。
- 侧栏 HUD 信息块、单一主操作按钮、商店卡片显示头像与起源+职业。
- 手机端非当前主操作按钮移到商店下方。
- 回放画布显示头像身份、战斗特效与 DOM 数字飘字，seek/切换战斗时清理。
- 帮助面板（快捷键、规则说明），打开时屏蔽 D/F/E 与奖励层。
- 减少动态效果偏好（localStorage，失败时安全降级），结算与非减少模式一致。
- 界面文字中文化；页脚 Riot 非商业素材声明。
- Vite 相对 base（支持子路径部署）；`npm run dev` 走 localhost，新增 `preview`。
- M6 存档兼容性固定样本 `tests/fixtures/m6-saves/*.json.gz`。
- vitest 升级到 5.0.3（清掉仅开发依赖的 tinypool critical 告警）。

## 2. 已修复的问题（外部审计 d46ed54）

- F01（High）：双击“继续”直接开战 → 阶段切换后 400ms 内忽略第二个生命周期操作。
- F02（High）：帮助打开时奖励层抢焦点 → 帮助期间奖励层 inert、焦点锁在帮助内，关闭后交还。
- F03（High，子路径）：`/cat/` 下白屏 → 相对 base。
- F04（Medium）：回放无战斗反馈 → 共用 `planFx`，回放驱动特效与数字飘字。
- F05（Medium）：顶排血条被裁切 → 棋盘原点下移到 y=50，实战与回放共用 `BOARD_LAYOUT`。
- F06（Low）：治疗数字画两次 → 数字只由 DOM 渲染器负责。
- F07（Low）：头像 404 无回退 → 一次性换成代码徽记。
- 验证缺口：M7 脚本未进 CI → 新增 `m7-presentation` CI 作业（见第 4 节）。

## 3. 性能 / 内存现状（已停止，移交 Codex）

**超标的门禁**：M6 生命周期门禁（`node scripts/verify-m5-browser.cjs --m6-journey`，30 轮新开/回放/删除循环后强制 GC，堆增长 ≤ 1 MiB = 1,048,576 B）。

| 测量 | 模式 | 堆增长（B） | 结果 |
|---|---|---|---|
| CI 37483034783，69e1387 | browser-dev-cannon（vite dev） | > 1 MiB（日志未能下载，代理拦截 artifact） | 失败 |
| CI，de31f6a | dev | ≤ 1 MiB | 通过 |
| CI49，631c131（M6 签收） | dev | 993,756 | 通过（本身仅余约 5%） |
| 本地，69e1387 | dev | 2,581,964 | 超 ~1.5 MiB |
| 本地，631c131 | dev（未跑完被中止） | 1,216,200 | 本地基线也超 |
| 本地，631c131 | preview（生产构建） | 1,364,816 / 1,389,912 / 439,088 | 波动大，基线也会超 |
| 本地，M7 | preview | 3,111,724 / 804,892 / 410,548 / 904,740 | 波动大 |

结论：该门禁在本机噪声很大，M6 基线本身在本地也会超标；M7 在 CI dev 模式下仍是确定失败，需要处理。

**堆快照分析（本地 dev，69e1387，首轮后 vs 30 轮后）**：
- 事件监听器 83→83，RAF 回调 1→1，没有应用层对象（UnitView、Phaser GameObject、ReplayView、PlaybackSession、DOM 节点）累积。
- 增长几乎全部是 V8 代码对象：约 +512 KB / 202 个 code 对象，`TrustedByteArray` 约 +180 KB（JIT/优化代码）；其余为 performance timing 条目与约 670 个 `DOMRectReadOnly`。
- 对照：M6 诊断中基线 preview 的代码增长为 +145,552 B。M7 新增的渲染路径（planFx、UnitView、回放画布）让更多函数被 JIT 优化，推测是主要来源，但未证实。
- 尚未做：未在 CI 机器上取快照；未分离“代码对象”与“应用对象”分别设预算。

**已做过的优化（主要针对首次可操作时间，不是这个堆门禁）**：
- 头像改为页面空闲时加载（`requestIdleCallback`），DOM 图标 `loading=lazy`。
- Phaser 文字分辨率固定为 2。
- `s13-assets.ts` 只做类型导入 Phaser（也修复了 Node 测试）。
- 结果：首次可操作 +8.7%（M6 中位 774ms → M7 841ms，预算 ≤ +20%）；JS gzip +3.3%（预算 ≤ +10%）。

**给 Codex 的建议方向**：先在 CI 同配置下取 30 轮前后快照，确认增长是否仍只有 code 对象；如是，可考虑门禁改为排除 code space 或提高预热轮数，但需 PM 同意改门禁；如有应用对象，按保留链修。

## 4. 新增门禁规则和 CI 改动

- `.github/workflows/ci.yml` 新作业 `m7-presentation`：fetch-depth 0，在 `../m6-base` 构建 631c131 作对照，启动 preview，运行下面四项，上传 `m7-presentation` artifact。
- `scripts/verify-m7-presentation.cjs`：7 项检查（help-dialog、reduced-motion-equivalence、continue-double-activation、replay-feedback、replay-identity、help-over-reward-choice、portrait-404-fallback）。
- `scripts/m7-screens.cjs`：五视口走查，任一横向溢出、<44px 触控目标、棋子 <32 CSS px、页面/控制台错误、缺步骤即失败。
- `scripts/m7-budget.cjs`：与 M6 签收构建成对交替测量，JS gzip ≤ ×1.10，首次可操作中位数 ≤ ×1.20（`waitUntil: 'commit'` 起算）。
- `scripts/verify-m7-subpath.cjs`：dist 只挂在 `/cat/` 下，入口与 40 个图标必须全部 200。
- 新单元测试：`m7-m6-save-compat`、`m7-hero-identity`、`m7-preferences`、`m7-layout`、`m7-fx-plan`（本地 50 文件 / 722 项通过）。
- 辅助脚本（不在 CI）：`m7-interactive-time.cjs`、`fetch-s13-assets.cjs`、`generate-m6-save-fixtures.cjs`。
- 注意：CI 只在 PR、push main、workflow_dispatch 时运行；本分支的运行均为手动 workflow_dispatch。

## 5. 未解决问题

| # | 类别 | 问题 |
|---|---|---|
| 1 | 性能/测试 | CI browser-dev-cannon 的 M6 生命周期堆门禁失败（见第 3 节），导致 compare-evidence 被跳过。 |
| 2 | 性能/测试 | 本地该堆门禁噪声极大，M6 基线本身也会超标，门禁可信度需重新评估。 |
| 3 | 性能/测试 | 最新提交（含本交接）还需要一次全绿 CI；69e1387 的 CI 除第 1 项外全绿。 |
| 4 | 性能/测试 | 外部审计环境下 8 项单元测试超时，本地空闲机器全过；未改超时，CPU 竞争时可能复现。 |
| 5 | 性能/测试 | `ReplayView` 每帧重绘整张画布，未做脏区/按需绘制。 |
| 6 | 性能/测试 | F02/F04/F07 的回归门禁未在修复前旧代码上实际验证会失败（F01、F03 已验证）。 |
| 7 | 界面 | 4× 回放和近战密集时，数字飘字与施法标签会重叠。 |
| 8 | 界面 | 360×640 手机上商店需要滚动一次才能看全。 |
| 9 | 界面 | 羁绊中文名取自公开资料，未与国服客户端逐字核对。 |
| 10 | 界面 | F4 用户按 M7_PLAN 第 8 节清单试玩签收尚未进行。 |
| 11 | 流程 | PR #7（M6）未合并，本分支以其为基；合并顺序需确认。 |

## 6. 修改过的规则层文件

- `src/m6/application.ts`：2 行，仅表现层管线——`renderReplay` 把 `snapshot.events` 传给回放视图；调试 `read()` 的 replay 字段附带 `fx: { ...this.replayView?.stats }`。不影响规则、存档或确定性。
- 未修改：`src/simulation/`（含 combat、economy）、`src/persistence/`（存档）、`src/replay/`、`src/stats/`。
- 其余改动均在 `src/presentation/`、`src/rendering/`、`src/main.ts`、`src/style.css`、测试、脚本、CI 与文档。
