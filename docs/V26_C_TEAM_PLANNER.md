# v26-C 阵容规划器交付记录

基线：`686f3086fa565d2c1af81a5414d1259fc0ab86fb`，与本地记录的 `origin/codex/v25-integration-2` 一致。工作分支 `claude/v26-team-planner`；未改 `.git`，未提交或合入 integration-2。

## 功能与取舍

- 大厅与商店均有“阵容规划”入口；点击才加载 `assets/ui/team-planner-*.js`。面板、样式、存储、快照、羁绊预览和高亮实现全部在子目录内，首屏没有静态引入。
- 三套固定规划，每套最多十名不同英雄；点击英雄加入/移除，支持清空与快照替换。列表读取当前 `SHOP_CATALOG`，包括当前版本已有的六费英雄。
- 快照点击时读取自己的当前场上单位，排除敌人、备战席和不可购买召唤物，去重后取前十名；大厅无对局时快照禁用。
- `hex.planner.v1` 只保存 `{ active, plans }` 和英雄定义 ID；读取、解析、写入均容错，未知 ID 被过滤。存储不可用时本页内存仍可编辑。跨标签页更新会刷新高亮并关闭旧编辑面板。
- 羁绊只预览英雄成员数，使用现有门槛及 `traitTierStyle`；处理外交官 1/4 的特殊激活条件。注明不含纹章、异常、强化，不改实际羁绊栏。
- **高亮首次打开规划器后才生效**，关闭面板后继续作用于后续刷新的 DOM 商店；刷新页面后须再次打开。这样入口只保留按钮及读取自己场上单位的回调。2D、3D 联机共用 DOM 商店；单人 Phaser 卡片高亮沿用设计范围，未实现。
- 标记、描边与 aria 提示不改购买回调、禁用状态或升星提示。面板使用原生 dialog，支持 Esc、Tab、关闭后恢复焦点；编辑时阻断游戏快捷键，切换页面或出现构筑选择时关闭面板。

## 修改文件与位置

已有文件（同期 UI-1/UI-2 合并时关注这四处）：

| 文件 | 位置与内容 |
| --- | --- |
| `src/rendering/strategy-panel.ts:1454` | 商店按钮、动态加载、快照只读回调；复用小型按钮样式 |
| `src/rendering/online/lobby.ts:39` | 大厅按钮及动态加载 |
| `vite.config.ts:71` | 新分包输出到 `assets/ui/` |
| `tests/rendering3d-isolation.test.ts:90` | 允许新 UI 模块复用现有展示依赖；103 行起断言全部规划器模块按需加载；124 行禁止 HTML 预加载 UI |

新增文件：

| 文件 | 内容 |
| --- | --- |
| `src/presentation/team-planner/model.ts:1` | 规划操作、存储校验、快照、高亮判定、羁绊估算 |
| `src/presentation/team-planner/team-planner.ts:23` | 面板生命周期、三套选择、编辑、快照与预览 |
| `src/presentation/team-planner/shop-highlight.ts:4` | 幂等 DOM 高亮装饰 |
| `src/presentation/team-planner/style.ts:1` | 按需注入样式 |
| `tests/team-planner.test.ts:1` | 七项数据与存储测试 |
| `tests/team-planner-highlight.test.ts:1` | 两项 DOM 装饰测试 |
| `docs/V26_C_TEAM_PLANNER.md:1` | 本记录 |

未修改 `src/simulation/`、`src/server/`、3D 实现、素材或预算阈值。

## 体积（生产构建，gzip level 9，字节）

| 范围 | 基线 | 完成后 | 差值 |
| --- | ---: | ---: | ---: |
| 2D 顶层 `assets/*.js` | 635,487 | 635,781 | +294 |
| 3D `assets/3d/*.js` | 333,961 | 333,961 | 0 |
| 按需 UI 合计 | 34,565 | 38,135 | +3,570 |
| 单人分包 | 86,247 | 86,247 | 0 |
| 新规划器分包 | 0 | 3,571 | +3,571 |

基线是本次在相同 HEAD 和同一机器实测，非任务描述中的约数。294 B 增量为最小入口挂接及共享导出/打包变化。2D 低于不变的 637,144 B 上限，余量 1,363 B；按历史 424,763 B 基线计算，m7 比率 `1.4967899746 < 1.50`。HTML 不预加载新 UI/3D/solo 分包，3D 分包没有引入任何 2D 模块。

原 `scripts/m7-budget.cjs` 未改；本次执行其中原样的体积函数，独立检查上述硬上限和历史比率。结果在未跟踪的 `artifacts/v26-c/size-report.json`。未执行需要浏览器的首交互计时，不能将体积检查称为完整 m7 浏览器验收。

## 验证结果与复现

- `npm run typecheck`：通过。
- `node node_modules/vite/bin/vite.js build --configLoader runner`：通过。默认 `npm run build` 的 Vite 配置缓存写入共享只读 `node_modules` 会失败，runner 避免该环境限制。
- 规划数据 7 项、高亮装饰 2 项、`rendering3d-isolation` 1 项、`rendering3d-budget` 14 项，共 **24 项通过**。隔离测试使用真实生产配置构建并验证 import 图、HTML preload 与原 637,144 B 门槛。
- 测试使用 `/tmp/v26-c-vitest.config.mjs`，与仓库测试执行器相同，选中上述四个测试文件、最多两个 worker、缓存放 `/tmp`，未启用会自行启动浏览器的全局 fixture。命令：`node node_modules/vitest/vitest.mjs run --config /tmp/v26-c-vitest.config.mjs --configLoader runner --no-cache`。
- `git diff --check`：通过；无素材、dist 或 artifacts 文件进入变更清单。

## 待补浏览器与截图验收

当前缺少 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按 AGENTS.md 未启动 Chrome，**没有截图，不宣称完成视觉或真实键盘验收**。需要 Claude 使用 `codex-browser exec` 新启动浏览器测试任务，并按桥接 README 连接。

1. 生产预览打开 `?mode=online`，清空规划存储后刷新，Network 确认点击“阵容规划”之前不请求 planner 分包；点击后只请求一次。
2. 大厅编辑三套不同规划，选满十人，确认第十一人不能加入；移除、清空、切换规划、刷新页面检查保存；大厅快照禁用。截取面板（含羁绊预览）。
3. 使用开发联机服务器（`npm run serve:game`，另开 Vite runner）进入 `?mode=online&server=ws`；部署不同英雄及重复英雄，点击快照核对只有自己的场上英雄。侦察其他玩家时规划仍为本机数据。
4. 选择商店中现有英雄进入规划，关闭面板检查标记、描边和 aria；刷新商店确认后续卡片也生效；切换规划移除标记；购买、原升星提示正常。截取带高亮的商店。
5. 重复第 3–4 步于 `?mode=online&server=ws&render=3d`，核对同一份本地规划、商店按钮与标记可见，截图保存到 `artifacts/v26-c/`。
6. 面板内按 D/F/E/W 不改变对局，Tab/Enter/Space 可编辑，Esc 关闭并恢复焦点；构筑选择弹出/返回大厅时面板关闭。模拟 localStorage 读取或写入抛错，确认游戏和本页编辑继续正常。

待 v25 合入 multiplayer 后，再由执行端提交并按协调顺序合并本分支；不提前合入 integration-2。
