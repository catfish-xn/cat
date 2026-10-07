# 协作分工

本项目由两个 AI agent 协作。先确认你是哪一个，只按自己的角色行事。

**Codex（GPT）：规则、后端、测试、文档、审计、部署**
- 可修改：`src/simulation/`（含 `content/`）、`tests/`、`scripts/`、`docs/`、各阶段计划文件、`.github/`。
- M8 D6-A 已由用户确认：负责 `src/m6/` 的非视觉应用集成，以及 `src/persistence/`、`src/replay/`、`src/stats/` 中的非界面模块；下列四个界面文件归 Claude，不扩大为 Codex 的界面修改权限。
- 不修改：`src/rendering/`、`src/presentation/`、`src/main.ts`、`index.html`、`src/style.css`、`public/assets/`，除非用户明确要求。
- 界面方面只定义"显示什么、数据从哪来"，不规定布局、颜色、动画等视觉细节。
- 实现 `docs/UI_REQUESTS.md` 中 Claude 提出的数据需求。

**Claude：界面与表现层**
- 可修改：`src/rendering/`、`src/presentation/`、`src/main.ts`、`index.html`、`src/style.css`、`public/assets/`。
- M8 D6-A 已由用户确认：另可修改 `src/persistence/save-controls.ts`、`src/replay/replay-panel.ts`、`src/stats/stats-panel.ts`、`src/stats/combat-feedback-renderer.ts`，仅做展示和控件回调适配；其余存储、回放、统计聚合和应用领域集成仍由 Codex 负责，不扩大到整个目录。
- 不修改 `src/simulation/`、`tests/`、`scripts/`，可以运行测试。需要新数据或新命令时，写入 `docs/UI_REQUESTS.md`（字段、含义、用途、验收条件），由 Codex 实现。
- 界面只调用 Match 公共命令、读取状态，不自行扣费、结算或另算规则；`match-session.ts` 是薄适配器，不能变成第二套规则引擎。

# 汇报格式（每次任务结束必须遵守）

最后用以下格式总结，总共不超过 15 行，用中文，不要复述过程：
【完成】做了哪些事（每条一行）
【未完成】还剩什么，为什么
【需要我决定】需要我拍板的问题，给出选项和你的建议
【风险】可能出问题的地方
【下一步】建议我接下来做什么

# 项目概况

浏览器本地运行的单人六角棋盘自动战棋（HEX 自动战棋），复刻 TFT S13（14.24b）的有限内容切片。无后端服务、数据库或联网，"后端"指纯 TypeScript 领域规则。

技术栈：TypeScript + Vite + Phaser 3，测试用 Vitest 和 Playwright。Node 22.12+。没有 ESLint/Prettier，也没有 `lint`、`start` 脚本。

# 常用命令

```
npm ci                 # 安装
npm run dev            # 开发服务器
npm run typecheck
npm test               # vitest run；单文件：npm test -- tests/m5-economy.test.ts
npm run build          # typecheck + vite build
npm run preview        # 预览 dist/，需先 build
```

完整验收（`test:headless`、`test:browser`、`test:input`、`test:compare` 等）耗时十几分钟，命令和顺序见 `docs/PROJECT_GUIDE.md`。按改动影响面选择测试，纯文档任务不必跑完整对局。

# 目录

- `src/simulation/`：纯领域规则。`match.ts` 是整局唯一权威入口；`combat-s13*.ts` 是当前战斗；`content/` 是固定赛季内容。
- `src/rendering/`：Phaser 场景、输入、DOM 面板。
- `tests/`：回归测试；`tests/fixtures/` 存放 oracle 和 golden。
- `docs/MATCH_CONTRACT.md`、`docs/COMBAT_CONTRACT.md`、`M5_RULES.md`：当前规则与 API 契约，改规则前必读。

# 必须遵守的不变量

- `src/simulation/` 不依赖 Phaser、DOM、网络、真实时钟，不用 `Math.random()`/`Date.now()`；随机只用显式 `lcg32-v1` RNG。
- 命令失败返回原 state 和 reason，不产生事件、不消耗任何资源或 RNG。
- 数值为整数，百分比用基点（`Bps`）；固定 50 ms/tick。不为显示方便改运算顺序。
- 奖励、收入、成长按唯一收据只发一次；重复 step、Continue 或恢复不能重发。
- 完整领域事件账本不能因动画节流而截断或丢失。
- 改规则要有独立数值依据和契约修改，不能只改 golden 让测试变绿；内容或规则变化需同步版本号与内容 digest。

# 分支与部署

- main 已包含 M6 和 M7（PR #8）；M7 开发分支 `claude/friendly-darwin-pak00a` 已删除。开工前先核对分支、HEAD 和工作区，以 Git 为准。
- Pages：正式版 `/cat/` 跟随 main，已包含 M7；`/cat/m7/` 是旧 M7 固定提交快照。图片路径用 `import.meta.env.BASE_URL`，不要写成 `/assets/...`。
- `artifacts/`、`dist/` 等生成物不提交。

# 详细资料

完整的文件职责表、验收命令、CI 说明、里程碑记录和已知问题见 `docs/PROJECT_GUIDE.md`，需要时再读，不必每次通读。

# 平台优先级
以桌面 Chromium 为主。手机不再作为优化目标，不要为手机新增布局适配或专门测试；
现有的手机/触摸测试保持能通过即可，不必扩展。
