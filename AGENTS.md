# 分工规则
- 本项目由两个 AI 协作：GPT/Codex 负责规则、后端、测试、文档和审计；Claude 负责界面。
- 你可以修改：src/simulation/、content/、economy、match-rules、round-schedule、combat、存档、tests/、docs/、各阶段计划文件。
- 你不要修改：src/rendering/、index.html、样式文件，除非我明确要求。
- 界面方面你只定义"要显示什么、数据从哪来"，不要规定布局、颜色、动画等视觉细节。
- Claude 提出的数据需求记录在 docs/UI_REQUESTS.md，由你实现。

# 汇报格式（每次任务结束必须遵守）
最后用以下格式总结，总共不超过 15 行，用中文，不要复述过程：
【完成】做了哪些事（每条一行）
【未完成】还剩什么，为什么
【需要我决定】需要我拍板的问题，给出选项和你的建议
【风险】可能出问题的地方
【下一步】建议我接下来做什么

# 项目说明与维护指南

## 1. 本说明的范围与阅读顺序

- 仓库：`catfish-xn/cat`；项目名：HEX 自动战棋；npm 包名：`hex-autobattler`（`private: true`）。
- 本次扫描日期：2026-10-06。main 扫描基线为 `d0f9ecd`；此前游戏功能合并提交为 `d8a54bb`（M5，PR #6）。本说明是该快照的导航，不是永久不变的进度声明。
- 扫描覆盖 main 的全部 197 个受版本控制文件及主要开发分支的文件树、配置和里程碑记录；main 有 54 个 TypeScript 源文件、41 个顶层活动测试文件、21 份历史测试文本。后续以实际文件树为准，不把这些数量当验收门槛。
- 先读本文件的分工规则，再读 `README.md`、`docs/MATCH_CONTRACT.md`、`docs/COMBAT_CONTRACT.md`、`M5_RULES.md`，最后读当前任务涉及的计划、验收记录和代码。
- 实际功能与分支归属以当前源码、Git 合并历史为准；规则意图以当前版本契约为准；“已通过”必须有对应提交的真实验证证据。三者冲突时记录差异，不自行修改规则来迎合旧文档。
- M1—M5 计划中包含历史基线、当时的阻塞、旧协作安排和旧视觉要求。这些不是当前任务的新授权；当前用户要求及本文件开头的分工规则不因历史计划而改变。
- 下文列出的界面文件仅用于理解数据流和定位问题，不构成修改界面或制定视觉方案的授权。

## 2. 项目简介与产品范围

这是在浏览器本地运行的单人六角棋盘自动战棋，参考 TFT S13 原赛季 14.24b 的有限内容切片。玩家在准备期运营、购买与升级英雄、部署、装备和选择强化/异常，开战后由确定性模拟自动结算。

main 当前包含：

- 7 列 × 8 行棋盘，奇数行偏移坐标；敌方准备区 row 0–3，我方 row 4–7；九格备战席，人口上限等于等级。
- 19 个可购买英雄、5 个启用职业羁绊、7 个装备组件与 9 件成装、6 个强化、3 个异常；另有不进入商店的中立敌人和用于底层回归的旧单位。
- 从 2-1 到 6-7 的 35 轮单人流程。每阶段 .4 是无战斗补给，.7 是 PvE；普通对手是固定模板，不模拟其他玩家的经济。
- 默认 seed 42；新局 100 HP、10 G、等级 3，拥有一星 Irelia/Maddie/Lux。开局先选两件组件，再处理 2-1 强化。
- 五槽无限单位池商店、锁店、买卖、三合一升星（最高三星）、经验和等级（最高九级）、利息与连胜败收入、装备合成/装备/返还、持久成长和终局。
- D 刷新商店（2 G）、F 购买经验（4 G / 4 XP）、E 出售目标；Start Combat、Continue、New Match 由领域阶段控制。
- 三条主要构筑验收路线：`cannon`（四炮四哨）、`sniper`（两狙四监察两哨）、`mage`（四法四哨）；`sniper-caitlyn` 是额外的自然获取五费英雄路线。
- schema5 JSON 序列化、恢复校验和确定性重放测试。main 尚无 M6 的完整公开存档/续玩/回放产品界面。

这不是全量 TFT，也不是 Riot 内部规则的逐项复刻。单人简化包括无限商店池、手动准备期、补给替代选秀、固定对手和明确的有限战斗机制。没有独立后端服务、数据库服务器、账号系统或联网对战；这里的“后端”职责主要对应纯 TypeScript 领域规则与本地数据处理。当前未引入 React、Vue、服务端渲染或 URL 路由框架。

## 3. 技术栈与环境

| 项目 | main 的实际配置与作用 |
| --- | --- |
| TypeScript | `^5.9.3`，锁定 5.9.3；业务代码和测试的类型检查 |
| Vite | `^7.1.0`，锁定 7.3.6；开发服务器、生产打包和预览 |
| Phaser | `^3.90.0`，锁定 3.90.0；棋盘与战斗显示、输入接入 |
| Vitest | `^3.2.4`，锁定 3.2.7；单元、契约、集成、重放回归 |
| Playwright | 精确 1.63.0；Chromium 原生鼠标/键盘/触摸及生产预览验证 |
| npm | 通过 `package-lock.json` 锁定依赖；使用 `npm ci` 重现安装 |
| 模块 | `package.json` 为 `type: module`；源码 ESM，Node 工具多为 `.cjs`，数据导入器为 `.mjs` |
| CI | GitHub Actions、Ubuntu 24.04、Node 22；Pages 为独立工作流 |

- Node 要求以锁定工具的 engines 为准：Vite 7.3.6 要求 `^20.19.0 || >=22.12.0`，Playwright 要求 Node >=20。优先使用 Node 22.12+ 的 22 系列，与 CI 主版本保持一致。
- `tsconfig.json`：ES2022、DOM lib、ESNext 模块、Bundler 解析；启用 `strict`、`noEmit`、`noUnusedLocals`、`noUnusedParameters`、`skipLibCheck`；检查范围为 `src` 和 `tests`。
- 仓库没有独立 ESLint、Prettier、Docker 或后端启动配置，也没有 `lint`、`start`、`test:coverage` npm script；不要在说明或自动化中假设这些命令存在。
- 上述锁定版本是 main 快照。M7 分支已经将 Vitest 升为 `^5.0.3`，并将 dev/preview 默认监听改为本机，不能把不同分支的配置混写。

## 4. main 目录与文件职责

### 4.1 顶层与基础设施

```text
.
├── AGENTS.md                  协作边界、报告格式、项目导航
├── README.md                  玩家操作、架构概览、主要验证入口
├── M1_PLAN.md                 M1 最小自动战斗历史计划
├── M2_PLAN.md / M2_GOAL.txt    M2 连续对局循环计划与目标
├── M3_PLAN.md                 M3 成长循环历史计划
├── M4_PLAN.md                 M4 策略切片计划
├── M4_RULES.md                M4 历史规则
├── M4_ACCEPTANCE.md           M4 验收要求
├── M5_PLAN.md                 M5 范围、依赖与冻结点
├── M5_RULES.md                当前 S13 切片详细规则与审计修订
├── M5_ACCEPTANCE.md           M5 验收矩阵和证据门禁
├── package.json               npm scripts、依赖声明
├── package-lock.json          可重现依赖版本
├── tsconfig.json              TypeScript 检查配置
├── vite.config.ts             普通构建 / 与 Pages 构建 /cat/ 的 base
├── index.html                 HTML 入口，加载 src/main.ts（界面边界）
├── src/                       产品代码
├── tests/                     活动回归、独立 oracle 和历史 fixtures
├── scripts/                   路线生成、浏览器/性能验收和离线工具
├── docs/                      契约、规则补充、审查与验证记录
├── .github/workflows/ci.yml    原有完整测试矩阵
├── .github/workflows/pages.yml 正式站点与固定 M7 预览部署
└── .gitignore                 排除依赖、构建、coverage、日志、artifacts
```

`node_modules/`、`dist/`、`coverage/`、`artifacts/` 和 `*.log` 是忽略的安装/生成产物，不应当作源文件提交。main 没有 `public/`、`src/presentation/`、`src/persistence/` 等 M6/M7 专属目录；也没有顶层 `content/`、`economy/` 或 `combat/` 目录，分工规则中的这些逻辑模块实际主要位于 `src/simulation/`。

### 4.2 纯领域层：`src/simulation/`

| 文件或文件组 | 职责及修改时的关联点 |
| --- | --- |
| `board.ts` | 六角格、阵营、棋盘边界、部署区、固定邻格顺序和距离；不含像素坐标 |
| `game.ts` | 准备阵容 `GameState`、部署校验和部署操作；不负责整局经济 |
| `unit-types.ts` | 单位定义、实例、位置、费用、星级、解析属性与升星事件类型 |
| `units.ts` | 当前 19 英雄、中立敌人、旧测试单位及目录验证；旧单位不得进入 M5 获取池 |
| `unit-stats.ts` | 星级属性与出售价格查询；HP/AD 星级倍率为 1/1.8/3.24 |
| `match-types.ts` | MatchState 阶段联合类型、商店、轮次结果、失败原因和命令返回值 |
| `match.ts` | 整局唯一权威入口：创建、部署、买卖、D/F、锁店、开战、tick、Continue、装备与选择 |
| `match-rules.ts` | 初始资源、经验表、商店概率/候选池、阶段掉血及经济常量 |
| `economy.ts` | 纯经济结算规划，利息、胜利金、连胜败、HP 与 XP 结果；不直接驱动 UI |
| `progression.ts` | 经验归一化、升级、等级上限、商店概率查询 |
| `shop.ts` | 根据等级和显式 RNG 生成五槽商店 |
| `upgrades.ts` | 原子购买与递归三合一规划、survivor/位置选择、成长和装备资源转移 |
| `inventory.ts` | 合成、装备、出售返还规划；三槽与合法配方校验 |
| `round-schedule.ts` | 35 轮编号、阶段映射、补给/PvE/对战分类及选择日程 |
| `round-enemies.ts` | 固定对手阵容、站位、中立敌军和对手装备；不实现对手经济 AI |
| `choices.ts` | 显式 choice RNG 下的候选抽样 |
| `rewards.ts` | 日程奖励规划、资源发放和收据 |
| `rng.ts` | `lcg32-v1`、uint32 seed 校验及纯随机状态转换 |
| `strategy-types.ts` | 有限 Effect/Hook、物品、强化、异常、选择、来源、收据与快照类型 |
| `effects.ts` | 有限效果编译、稳定来源排序、属性归并和触发规划 |
| `trait-snapshot.ts` | 按上场不同英雄定义计算羁绊档位 |
| `strategy-snapshot.ts` | 开战前冻结属性、装备、羁绊、强化、异常与技能来源 |
| `ability-types.ts` | 技能、物理/魔法伤害与伤害包类型 |
| `combat-types.ts` | CombatState、单位、事件、任务、状态、盾层、来源及固定 tick 常量 |
| `combat.ts` | 开战校验、隔离战斗快照、tick-zero 事件与 `stepCombat` 入口 |
| `combat-tick.ts` | 通用/历史战斗 tick，并分流至 S13 resolver；不得将旧行为直接等同于 M5 |
| `combat-abilities.ts` | 通用技能解析/规划与 S13 技能定义接入 |
| `combat-damage.ts` | 通用伤害抗性和伤害包归并 |
| `combat-effects.ts` | 开战效果和战斗事件标识、来源记录 |
| `combat-s13.ts` | M5 有限技能战斗主循环；`readCombatStats` 为不推进状态的权威读取投影 |
| `combat-s13-state.ts` | S13 内部可变工作副本、来源键、排序、属性、距离、盾层和状态助手 |
| `combat-s13-abilities.ts` | 19 英雄有限施法/攻击/延迟动作规划与执行 |
| `s13-rules.ts` | 参与内容 digest 的 S13 运算常量和语义修订 |
| `serialization.ts` | `serializeMatch` / `restoreMatch`，精确版本、所有权、来源和阶段一致性校验 |
| `validate-content.ts` | 内容目录、有限效果、数值边界及获取池隔离验证 |

### 4.3 固定内容：`src/simulation/content/`

- `abilities.ts`：19 英雄历史技能变量和说明；`traits.ts`：5 个启用职业；`items.ts`：7 组件/9 成装；`augments.ts`：6 强化；`anomalies.ts`：3 异常。
- `source/s13-14.24.json`：固定版本客户端数据的项目归档切片；`source-manifest.ts`：原始来源、hash、补丁覆盖与明确简化的记录。运行和 CI 不在线拉取最新赛季数据。
- `freeze.ts`：递归冻结内容定义；`index.ts`：内容规范化与 `CONTENT_DIGEST`，覆盖内容、日程、经济和有限战斗语义等。
- `legacy-items.ts`、`legacy-traits.ts`、`legacy-augments.ts`、`legacy-anomalies.ts`：保留历史内容与测试兼容，不是当前可获取内容。新增内容不能绕过 `validateContent` 和目录隔离。

### 4.4 显示与交互：只读理解边界

- `src/main.ts`：创建 Phaser 游戏和 DOM 宿主，接入缩放/触摸输入并清理监听器。
- `src/style.css`、`index.html`：页面样式和 HTML 入口。
- `src/rendering/BoardScene.ts`：Phaser 场景、单位视图、原生输入、交互和只读调试观察入口。
- `src/rendering/match-session.ts`：薄会话适配器，同步提交 Match 命令、累计帧时间、维护当前战斗完整事件账本；不应成为第二套规则引擎。
- `src/rendering/hex-layout.ts`：格子与显示坐标转换；`input-router.ts`：手势 owner/epoch 和取消语义。
- `src/rendering/strategy-panel.ts`：读取状态并调用命令的 DOM 操作/信息面板；`combat-feedback.ts`：领域事件与来源的文字说明。
- GPT/Codex 定义展示字段、数据来源和读取契约；Claude 负责界面实现。不要把文档任务扩展为这些文件的重构。

### 4.5 测试、fixtures 与脚本

活动测试包括：

- 几何与基础契约：`board`、`deployment`、`simulation`、`rng`、`combat-contract`、`combat-start`、`combat-simulation`。
- 通用战斗与成长：`combat-abilities`、`combat-damage`、`combat-mana`、`unit-stats`、`upgrades`、`progression`、`shop`、`inventory`、`round-enemies`。
- 整局与输入：`match-contract`、`match-economy`、`match-lifecycle`、`match-session`、`input-router`。
- 保留的 M4 缺陷与底层回归：`m4-effect-combat`、`m4-effects`、`m4-ledger-bound`、`m4-review-regressions`、`m4-strategy-snapshot`。
- 当前 M5：`m5-acceptance`、`m5-audit-boundaries`、`m5-combat`、`m5-command-phases`、`m5-content`、`m5-economy`、`m5-growth`、`m5-match-integration`、`m5-neutral-timing`、`m5-regressions`、`m5-replay`、`m5-route`、`m5-runtime-import`、`m5-serialization`、`m5-strategy-numbers`。上述名称对应 `tests/<名称>.test.ts`。

`tests/*-helpers.ts` 提供测试构造与断言助手。`tests/fixtures/m3/`、`m4/`、`m5/` 保存独立 oracle、断言工具和版本化 golden；`.d.cts` 为 CommonJS 测试工具提供类型声明。`full-match-golden.pre-*.json` 保存规则修订前的轨迹，不能当作当前期望覆盖回去。`tests/historical/m4/*.test.ts.txt` 是归档文本，不参加 Vitest 发现；其迁移依据见 `docs/M5_HISTORICAL_TESTS.md` 和 `docs/M5_TEST_MIGRATION.md`。

| 脚本组 | 用途 |
| --- | --- |
| `generate-m3-fixture.cjs`、`generate-m4-route.cjs`、`generate-m5-route.cjs` | 各版本正常命令路线和轨迹生成；生产计算轨迹本身不是独立数值答案 |
| `verify-m1-browser.cjs`、`verify-m2-browser.cjs`、`verify-m2-desktop.cjs`、`verify-m3-browser.cjs`、`verify-m3-desktop.cjs` | 历史阶段浏览器验证，不能直接宣称兼容当前 M5 |
| `verify-m4-browser.cjs`、`verify-m4-interactions.cjs`、`verify-m4-input-boundaries.cjs` | M4 阶段路线、交互与边界证据 |
| `verify-m5-headless.cjs` | 当前多 seed 路线、完整终局和领域性能样本 |
| `verify-m5-browser.cjs` | dev/preview 三构筑和触摸正常时间完整路线 |
| `verify-m5-input.cjs` | 原生高频输入、触摸/旋转、DOM 信息和观察性能；`--metrics-only` 不等于完整输入门禁 |
| `m4-evidence.cjs`、`m5-evidence.cjs` | 规范化证据 hash 和源码指纹；指纹包含未跟踪的源码文件 |
| `compare-m4-evidence.cjs`、`compare-m5-evidence.cjs` | 对应阶段跨模式完整状态/事件比对，后者是当前入口 |
| `ci-m5-step.cjs` | 记录实际 CI 命令、耗时、环境和返回码 |
| `summarize-m5-ci-budget.cjs` | 从同一 run/SHA 的三样本 jobs API JSON 计算实测超时预算 |
| `import-s13-data.mjs` | 离线、SHA-256 门控的历史源数据提取；不是联网更新工具 |

### 4.6 文档索引

- `docs/MATCH_CONTRACT.md`、`docs/COMBAT_CONTRACT.md`：当前公共 API、阶段、原子性、事件、tick 与恢复契约。
- `docs/M1_VALIDATION.md` 至 `docs/M5_VALIDATION.md`：各阶段真实执行记录，包含失败、中间状态和历史限制，阅读时核对日期/SHA。
- `docs/M3_RULES.md`、根目录 `M4_RULES.md`：历史规则，不能覆盖 M5 的新内容/数值。
- `docs/M5_FIX_REVIEW.md`：M5 六项审计问题、修复依据、版本与验证边界。
- `docs/M5_TEST_MIGRATION.md`、`docs/M5_HISTORICAL_TESTS.md`：测试迁移、替代覆盖与历史保留依据。
- `docs/evidence/M5_CI_BUDGET.json`、`M5_CI_PROFILE_PERFORMANCE.json`：已入库的实测预算/性能证据，不是任意可重新生成的临时输出。
- `docs/UI_REQUESTS.md`：分工约定的 Claude 数据需求入口；扫描时 main 尚无此文件。收到真实需求时记录需求、字段含义、数据来源/API、验收条件及状态；不要凭空补造需求或规定视觉方案。

## 5. 安装、开发、测试和构建命令

所有命令默认在仓库根目录运行。首次需要网络安装依赖；正常游戏运行使用本地打包内容。

### 5.1 基础命令

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

- `dev`：Vite 开发服务器，默认端口通常为 5173，以终端实际输出为准。
- `typecheck`：`tsc --noEmit`；`test`：`vitest run`，不是 watch 模式。
- `build`：先 typecheck，再 `vite build`，产物为 `dist/`；不自动执行测试。
- `preview`：预览现有 `dist/`，默认端口通常为 4173；不自动 build，也不是生产托管服务。
- main 的 dev/preview 显式使用 `--host 0.0.0.0`。只需本机访问时运行 `npm run dev -- --host 127.0.0.1` 或 `npm run preview -- --host 127.0.0.1`。
- 单个文件验证示例：`npm test -- tests/m5-economy.test.ts`；测试名过滤示例：`npm test -- tests/rng.test.ts -t "lcg32"`。按影响面选择测试，不能用定向通过替代整阶段验收。

### 5.2 当前 M5 验收入口

```sh
npx playwright install --with-deps chromium
npm run build
npm run test:headless
npm run test:browser -- --build=cannon
npm run test:browser -- --build=sniper
npm run test:browser -- --build=mage
npm run test:preview -- --build=cannon
npm run test:preview -- --build=sniper
npm run test:preview -- --build=mage
npm run test:input
npm run test:input:preview
npm run test:browser -- --build=cannon --touch
npm run test:preview -- --build=cannon --touch
npm run test:performance
npm run test:compare
npm run test:compare -- --final
```

- `test:headless` 自带 `--multi-seed`，执行固定的 24 个 seed 路线；`test:performance` 使用 `--repeat=3`，四路线共 12 次样本。都不是浏览器 UI 通过证明。
- 浏览器脚本自动启停本地 Vite 服务；preview 脚本需要先完成普通 `npm run build`。它们默认访问根路径，不能拿 Pages `/cat/` 构建替代普通 preview 构建。
- `test:compare` 依赖已有三条 dev/preview 桌面路线产物；`--final` 还要求两模式完整输入与触摸证据、同一当前 HEAD、干净工作区、相同源码指纹、版本和完整状态/事件。
- 可用 `CHROMIUM_PATH` 指定已安装的 Chromium；`M5_PORT` 覆盖验证服务端口；`M5_EVIDENCE_DIR` 覆盖证据目录。默认路线端口为 dev 5176 / preview 4176，输入端口为 dev 5189 / preview 4189。
- 本地并行运行相同模式的路线会争用端口/输出；应串行，或明确隔离端口和目录。最终比较按脚本规定读取 `artifacts/m5-*` 标准目录，改了目录需正确归集证据。
- `artifacts/` 中可能包含大型完整账本、JSON、浏览器日志、截图和 trace。不要混用旧提交输出，也不要把全部产物提交到 Git。
- 完整对局按真实 50 ms tick 运行，耗时可能十几分钟；某些逐 tick 恢复测试也耗时数分钟。不要为了提速而改变 tick、跳过路径或降低断言。

### 5.3 数据与证据维护工具

```sh
node scripts/import-s13-data.mjs /path/to/historical/en_us.json
node scripts/summarize-m5-ci-budget.cjs jobs.json artifacts/m5-ci-budget.json
```

数据导入会写入 `src/simulation/content/source/s13-14.24.json`，不自动重生成全部运行时目录或 `source-manifest.ts`；输入必须是导入器规定 hash 的未修改历史原文件，不是随便下载的最新版或已有切片。只有内容维护任务才执行，并审查 diff、来源清单、内容 digest、规则版本和测试期望。预算工具必须提供同一 run、同一 SHA、每组 3 个成功样本的真实 jobs JSON，不能虚构环境或计时。

## 6. GitHub Actions 与两个试玩地址

### 6.1 原有测试工作流

`.github/workflows/ci.yml` 在 main push、pull_request 和手动触发时运行；Node 22，`contents: read`。PR 使用明确的 PR head SHA，证据记录 `M5_COMMIT_SHA`。

- `test-and-build`：安装、单测、构建、多 seed headless、三次领域性能样本；22 分钟预算。
- `chromium-match`：dev/preview × cannon/sniper/mage，6 个完整路线任务；每个 28 分钟预算。
- `chromium-input`：dev/preview 两个原生输入与正常时间触摸路线任务；每个 32 分钟预算。
- `compare-evidence`：依赖上述任务，下载同 SHA 产物并执行 `--final`；6 分钟预算。
- 常规共 10 个 job；手动 `profile=true` 时 sample 1/2/3 共 30 个 job。预算来自已记录实测，不随意加大或删减测试规避问题。

### 6.2 Pages 正式版与临时预览

- 正式版：`https://catfish-xn.github.io/cat/`，跟随 main。
- M7 临时预览：`https://catfish-xn.github.io/cat/m7/`，固定 `claude/friendly-darwin-pak00a` 的 `d46ed54269548840ccc4644e1d67cad96199afac` 快照。
- `.github/workflows/pages.yml` 是独立 build/deploy 工作流，只允许 main 的 push/手动运行进入 build。它与 CI 并行，没有以完整 CI 成功为部署前置条件；Pages 成功不等于完整测试通过。
- main 使用 `npm run build -- --mode pages`；`vite.config.ts` 仅在 mode=pages 时设置 `/cat/`，普通开发/测试仍是 `/`。
- 工作流把固定 M7 提交 checkout 到 `.pages-m7`，单独 `npm ci`，再 `npm run build -- --base /cat/m7/`，将其产物移到 `dist/m7`，最后上传整个 `dist`。
- GitHub Pages 一次部署替换整个站点，因此每次都携带 main 与 M7 两份产物；不能独立上传 M7 的 dist 到站点根目录，否则会覆盖正式版。以后更新 main 会保留当前预览，M7 分支的新提交不会自动更新它。
- main 本地检查：`npm run build -- --mode pages` 后 `npm run preview -- --base /cat/`，访问 `/cat/`。在 M7 对应 checkout 检查预览：`npm run build -- --base /cat/m7/` 后 `npm run preview -- --base /cat/m7/`，访问 `/cat/m7/`。
- 修改部署时检查 HTML 的 JS/CSS URL、静态图片、页面刷新和控制台。M7 图片加载使用 `import.meta.env.BASE_URL`，40 个图片位于该分支的 `public/assets/s13/`；不能改成域名根路径 `/assets/...`。
- 当前没有客户端 URL 路由，也没有任意深路径 fallback；只验证实际入口的刷新，不宣称任意 `/cat/xxx` 都能访问。
- 仓库 Pages 来源已设为 GitHub Actions。重建环境时在 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。更新/撤下预览属于部署改动，不擅自改成 M7 正式发布或合并 M7。

## 7. 当前开发进度与里程碑

以下依据 2026-10-06 的 Git 和文档快照；执行新任务前重新 fetch 并核对，不从分支名或旧计划推定当前状态。

| 阶段 | 能力与当前证据边界 |
| --- | --- |
| 初始原型 / 战场基础 | 六角部署、阵营与 7×8 战场；PR #1 已合并（`33428d3`） |
| M1 最小自动战斗 | 固定 tick、寻敌/移动/普攻/结束与隔离快照；PR #2 已合并（`abd9245`） |
| M2 连续对局 | Match 权威、五槽商店、基础经济、结算/Continue 和同步输入；PR #3 已合并（`169f28e`） |
| M3 成长循环 | XP/等级/人口、费用概率、三合一、法力/技能、玩家 HP 与终局；PR #4 已合并（`133a41b`） |
| M4 策略切片 | 羁绊、装备、强化、异常、有限效果、存档契约与完整路线；PR #5 已合并（`5a4ce80`） |
| M5 S13 单人切片 | 当前 main 玩法；19 英雄、35 轮和审计修复已由 PR #6 合并（`d8a54bb`） |
| M6 产品化与回放 | `feat/m6-product-replay`，扫描时 head `85d5d9b`；未进入 main。分支记录对功能提交 `631c131` 的技术验收通过，后续 head 含报告/计划文档，不等于每个 head 都重新跑过同样检查 |
| M7 表现层 | `claude/friendly-darwin-pak00a`，扫描时 head `d46ed54`；含 M6 能力和 S13 图片、身份显示、帮助、减少动效等。分支记录 F1 已确认、W2 主要功能完成、F3 回归进行中，F4 用户试玩签收未完成；已作为固定临时预览上线，未合入 main |
| M8 后续方向 | M7 分支计划记录了从 19 英雄 / 5 职业扩充到完整 S13 的后续方向；当前扫描未见独立 M8 实施与验收证据，不把它写成已实现能力 |
| M9 候选 | M7 计划记录立体化表现候选；尚无已实施/已验收证据，不把视觉候选项纳入当前规则任务 |

重要的状态差异：

- `M5_PLAN.md`、`M5_ACCEPTANCE.md`、`M5_RULES.md`、`docs/M5_VALIDATION.md`、`docs/M5_FIX_REVIEW.md` 仍有“未验收/不合并 main/不启动 M6”等当时记录。Git 已显示 M5 合并、M6/M7 分支存在；保留历史证据，但不要复述为当前仓库阻塞。
- main 的 README 仍有旧的“临时 watchdog/实测预算尚缺”表述；现行 CI 已使用 `docs/evidence/M5_CI_BUDGET.json` 的冻结预算。判断时核对实际工作流及最新验收记录。
- M7 的 `docs/M7_VALIDATION.md` 记录 `de31f6a` 的 CI run `37446456876` 10/10 成功；随后布局提交有本地复测，但该记录明确未单独跑完整 CI，M7 专项表现/五视口验证也尚未全部加入 CI。不能将该 run 当作 `d46ed54` 的完整最终验收。
- 分支验证报告、用户签收、Git 合并和 Pages 部署是不同状态，必须分别汇报。

### 7.1 只存在于 M6/M7 分支的模块

| 目录/文件 | 功能与注意点 |
| --- | --- |
| `src/m6/application.ts`、`contracts.ts`、`limits.ts` | 应用生命周期、公共边界与已冻结预算 |
| `src/persistence/` | 存档格式、seed、IndexedDB repository、写入协调、捕获所有权与保存控件；异步结果需关联正确 session/run/activation 身份 |
| `src/replay/` | 战斗历史、索引、播放会话与回放面板；只读回放不得改变活动局/存档 revision |
| `src/stats/` | 从完整领域账本聚合伤害、治疗、吸收等统计及显示适配 |
| `src/rendering/app-shell.ts`、`replay-view.ts` 等 | M6 外壳与回放显示；仍属界面协作边界 |
| `src/presentation/`（M7） | 英雄身份、视图/特效、帮助、偏好、主题、S13 素材清单和加载；不能因为目录名不同就当作规则层修改 |
| `public/assets/s13/`（M7） | 19 英雄、5 职业、16 装备，共 40 个固定版本图片；来源/hash 在素材清单 |
| `tests/fixtures/m6-saves/`（M7） | 用于存档兼容的固定样本 |
| M6/M7 文档与 scripts | 存储、加载、回放、生命周期、性能、表现层与五视口验证；切换分支后重新读取真实配置，不假设 main 已有这些入口 |

M6 记录的主要能力包括公开新局/seed、续玩、导入导出、当前局自动保存、最近三局归档、战斗回放/seek 和统计。其公开存档产品能力与 main 的底层 `serialization.ts` 不同。读取分支说明可用 `git show origin/feat/m6-product-replay:<路径>` 或 `git show origin/claude/friendly-darwin-pak00a:<路径>`；不要为阅读而覆盖当前工作区。

## 8. 代码约定与命名规范

以下是现有实现与契约的维护约定，不表示已有 formatter/linter 自动强制全部风格。

### 8.1 命名与文件风格

- 多数领域文件为小写 kebab-case（`match-rules.ts`、`combat-s13-state.ts`），类型集合使用 `*-types.ts`；现有 `BoardScene.ts` 是类名文件例外，不批量改名。
- 类型、接口、类使用 PascalCase（`MatchState`、`CombatEvent`、`MatchSession`）；函数/字段使用 camelCase；常量/目录表使用 UPPER_SNAKE_CASE。
- 定义 ID 是稳定协议值，常见小写或 kebab-case；实例 ID、definitionId、choiceId、combatId、eventSeq 各有含义，不用中文显示名替代。
- 数值字段保留单位语义：`Bps` 表示基点，`tick`/`Ticks` 表示逻辑 tick，`Ms` 表示毫秒；HP、金额、计数使用经过边界校验的整数。不要混用秒/毫秒/tick 或小数比例/基点。
- 源文件通常使用单引号、分号、两空格缩进及显式 `import type`/内联 `type`；部分既有文件较紧凑，修改应遵循邻近代码，避免与任务无关的全文件格式化。
- 测试用 `*.test.ts`，阶段专属回归用 `m5-*` 等前缀；英文符号/测试名与中文产品文案可以并存。
- 仓库已有 `feat:`、`fix:`、`docs:`、`ci:` 及 `feat(m7):` 等提交风格；提交主题描述实际范围，不伪造验收完成。

### 8.2 架构、状态与原子性

- `simulation` 不依赖 Phaser、DOM、网络、IndexedDB 或真实时钟；不读取动画状态决定规则。规则不使用 `Math.random()`、`Date.now()` 或隐含全局随机状态。
- Match 是整局资源、轮次、阶段、奖励和终局的唯一权威。UI/会话调用公共命令，不能自行扣费、结算、修复状态或另算一套经济。
- 公共输入/快照保持不可变、以 `readonly` 和隔离副本表达边界。S13 resolver 的内部可变工作副本不意味着允许修改调用者的历史状态。
- 命令失败返回原 state 引用及 reason，不产生领域事件，不消耗金币、RNG、ID、序号、generation、奖励收据或成长。成功结果是 `{ ok: true, state, events }`；同值锁店是契约明确的成功 no-op。
- 使用 phase 判别联合类型和 expectedGeneration/expectedRound/choiceId 等防止迟到操作；新增字段同时检查命令 guard、序列化、事件、观察接口和测试。
- 开战只冻结棋盘上的单位和来源，不带入备战席；后续商店/内容/界面修改不能污染本场战斗快照。
- 奖励、收入、XP、永久成长和终局按唯一收据/轮次/combatId 提交一次；重复 step、Continue、恢复或选择不能重发。

### 8.3 确定性与战斗运算

- 固定 50 ms/tick（20 Hz），上限 1200 tick；移动节奏为 5 tick。帧 delta 只由会话累计，动画不能推进或暂停领域结算。
- RNG 为显式 `lcg32-v1`，seed 为含 0 的 uint32。商店、选择、奖励、battleSeed 流独立，每场 Combat 再持独立 RNG；拒绝操作消耗 0。
- 邻居顺序固定 E、SE、SW、W、NW、NE；并列目标、等长路径、移动争抢、来源与事件按既定稳定 ID/顺序处理，不能依赖数组偶然插入顺序或本地语言排序。
- 领域 HP、伤害、盾、治疗、法力为整数；百分比使用基点。按冻结公式统一舍入，不能为 UI 显示方便修改运算顺序；AP 基准 100。
- 同 tick 按明确屏障规划、结算伤害/治疗/法力/死亡；本 tick 已规划攻击不因同 tick 死亡随意撤销。终局判断优先于超时判平。
- M5 不同来源盾层相加，同源刷新按剩余量/到期约定；旧通用引擎的 max-shield 行为是另一契约，不能无意统一。
- 来源、action/event 序号、盾层、状态和未来任务必须在可序列化状态/事件中表达，不藏在闭包或视图对象里。
- 显示可合并视觉反馈，但完整领域事件账本不得截断、改写或按动画节流丢失。只读查询（例如 `readCombatStats`）不消耗 RNG 或改变计数。
- 具体数值与时序以 `M5_RULES.md` 和两个 CONTRACT 为准；修改规则需要相应独立数值答案及契约变更，不能只改 golden 使测试变绿。

### 8.4 内容、版本与存档

当前 main 协议标识：

```text
schemaVersion = 5
rulesVersion = m5-14.24b-v1
contentVersion = s13-14.24b-slice-v1
commandProtocolVersion = 2
rngAlgorithm = lcg32-v1
tickMs = 50
arithmeticRevision = m5-audit-fix-1
```

- 内容 digest 由 `src/simulation/content/index.ts` 生成；当前审计记录为 `fnv1a32-utf16:d40612fa`。实现/内容变化后必须重新核对，不能把此值当永恒常量手填到各处。
- 旧 schema4、未知版本和不匹配 digest 明确拒绝，不猜测迁移。恢复不运行战前 hook、不重抽 RNG、不重开战、不重发奖励。
- 恢复校验包括 IDs/所有权、装备槽、阶段、轮次历史、收据、归一化 XP、来源、盾层、状态、任务、计数与安全整数边界。
- schema5 未记录死亡 tick，死亡单位周期 AP 只校验有限可达值；结构一致性不等于密码学证明，也不等于在导入器中重演完整历史。
- FNV digest 用于内容漂移检测，不是安全校验；验收轨迹使用 canonical JSON SHA-256。两者用途不可混淆。
- 内容变化要记录来源/单人简化理由、规则编号、版本或语义修订，保留旧 golden，并同步独立 oracle 与正常命令路线；不能只修改说明绕过真实校验。

## 9. 测试与审计习惯

- 区分三类证据：独立手算/BigInt/oracle 的规则答案；同输入重放的一致性；真实浏览器交互与生产构建可用性。生产引擎生成两遍相同结果只能证明一致性。
- 新缺陷优先写能复现边界的回归：失败原子性、重复命令、阶段转换、内容隔离、序列化拒绝、迟到事件和生命周期等，不写只镜像实现的断言。
- 保留未变的底层和历史缺陷回归；M4 旧内容测试的退出必须有迁移映射，不能一概删除 `m4-*` 活动测试。
- 浏览器验收使用真实 mouse/keyboard/touch，通过公开流程游玩；`window.__CAT_DEBUG__` 用于只读观察，不能注入金币、HP、结果、加速 tick 或手工结束战斗。
- D/F/E 同步、repeat、手势取消、owner/epoch、触摸鼠标去重和覆盖层输入等属于既有行为；报告界面问题时给复现条件、状态/事件证据和数据契约，由 Claude 处理视觉实现。
- 全阶段最终验收基于同一干净 SHA；源码指纹、版本、seed、模式和环境应一致。追加产品改动后旧证据失效范围要明确，不能沿用先前 run 宣称新 head 全部通过。
- 纯文档任务做内容/路径/命令/差异检查即可，不必为了文档重复跑整套十几分钟对局；但最终报告要准确说明实际执行了什么。

## 10. 已知问题、限制与容易误判的地方

1. **状态文档滞后**：main 中多份阶段文档仍为当时计划/审计状态；查 Git 与精确提交证据，不能把历史阻塞重新施加到当前任务，也不能删掉失败记录伪装一路通过。
2. **版本和分支不同**：main 是 M5；M6/M7 有新的应用/存储/表现层和不同依赖。工作前检查分支、HEAD、工作区与远端，不把预览视为正式合并。
3. **大 bundle 提示**：Vite 构建存在 Phaser 相关 chunk >500 kB 警告。这不是已证实的构建失败，也没有据此证明手机性能达标；优化需独立验证，勿在规则/文档任务顺手重构。
4. **依赖审计历史**：M6 最终审查记录了 Vitest 3 传递依赖的审计告警，并由 M7 F0 独立升级 Vitest 5。main 仍锁定 Vitest 3.2.7；需要依赖治理时重新执行 `npm audit` 核实当时结果，不把历史告警数量视为实时状态，也不自动运行 `npm audit fix --force`。
5. **开发监听地址**：main 默认监听所有网卡；M7 已改变默认值。分享 Pages 地址不需要暴露本机 dev server。
6. **浏览器支持**：当前主要目标是 Chromium 桌面、触屏电脑和手机竖横屏；手机模拟不等于实体设备认证，WebKit/iPhone/iPad Safari 尚未承诺正式支持。
7. **main 存档产品缺口**：领域 JSON 恢复不代表已有公开保存/导入/续玩按钮。M6 IndexedDB 保存成功必须以事务提交为准；异步终局归档、迟到结果和回放隔离有专门回归，未来合并时不能丢失。
8. **规则的明示简化**：有限 S13 内容、固定对手、无限商店池、几何/技能局部近似均是项目边界；没有账号、多人服务、有限共享池、完整选秀或全量赛季，不借“补全说明”增加功能承诺。
9. **M7 预览是快照**：以后 M7 有修复也不会自动进入 `/cat/m7/`；需明确更新 workflow 的固定 ref 并重新验证。main 构建与预览构建在同一 Pages job，任一失败都会阻止本次新部署。
10. **静态站点与存储隔离**：`/cat/` 与 `/cat/m7/` 是同源不同路径，不天然隔离浏览器存储。main 当前无 M6 持久化产品层；未来双版本都持久化时需核对数据库名、schema 和兼容性，不能假设路径本身提供隔离。
11. **素材边界**：main 未带 M7 官方素材；M7 分支有来源/hash 清单及项目免责声明。维护素材时保留来源记录，不把其使用范围扩展为已获任意商用授权。
12. **缺失需求记录**：`docs/UI_REQUESTS.md` 尚待真实协作需求建立；收到界面数据请求后先明确字段、来源与只读/命令边界，不直接替 Claude 改布局或视觉。

## 11. 后续协作的落地顺序

1. 核对当前分支/HEAD/工作区，阅读本文件和任务相关的当前契约；不覆盖他人未提交修改。
2. 明确任务是规则、内容、测试、存档、文档、审计还是部署；界面需求记录到 `docs/UI_REQUESTS.md`，只定义数据与语义。
3. 确认涉及的公共 API、状态字段、版本、golden 和恢复边界，再实施最小必要改动；不顺手合并里程碑或升级依赖。
4. 运行与改动相称的验证。需要正式阶段验收时按对应清单完成同 SHA 门禁，记录真实失败/未验证项。
5. 维护文档时同步路径、脚本、分支归属与证据日期；本文件优先提供导航和不变量，避免复制整套数值表形成第二套规则来源。
6. 最终答复严格使用开头规定的中文五项格式、总计不超过 15 行；不复述过程。
