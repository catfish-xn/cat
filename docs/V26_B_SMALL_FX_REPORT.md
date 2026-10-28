# v26-B：施法文字、没收占位、选秀计时环

基准：`claude/v26-small-fx`，`686f3086`（任务指定的 `codex/v25-integration-2` 基准）。2026-10-28。工作区起点干净，未写 `.git`，未提交或合并；本任务不进 integration-2，等 v25 合进 multiplayer 后再合。

沙盒没有 `codex/v25-integration-2` 命名 ref；已核对预置工作分支 HEAD 与任务 brief 标注的基准 `686f3086` 一致，执行端提交前可再核对集成分支是否有新提交。

## 交付

- 2D 施法计划删除 `label` 和技能名生成逻辑，保留施法颜色、目标连线和圆环。实际文件是 `src/presentation/fx-plan.ts`。Phaser 与回放 Canvas 原本已只画圆环，本次清除残留字段；测试明确断言 cast 不含 `label`/`text`。
- 联机 2D/3D 战斗补程序生成的“已没收！”占位章。冻结开战公开阵容，复用 `publicTraitSnapshots` → `enforcerConfiscates` 现有选择器；显示层隐藏被没收的普通装备图标，保留纹章，非英雄不盖章；战斗中穿戴的被没收装备也清除图标并保留占位章。只修改视图，没有新增领域物品、变动装备账本或另算战斗数值。
- 3D 选秀每个待释放座位补计时圆环。`releaseAtMs`、`elapsedMs`、本地接收时间与相邻释放批次决定圆环剩余比例；帧数、粒子生命周期不决定释放或领取。释放/领取后隐藏，未知截止时间不画。
- 本地可读素材中存在 `carousel-shareddraft-releasetimerring-6s.json`，但提取文档确认它只有亮点/尾迹。配置的素材 manifest 含此键时，最后六秒附加该素材装饰，程序圆环始终保留；缺素材或加载失败使用纯程序圆环。未复制、提交任何版权素材，所有新增 Three.js 代码只进 `assets/3d/`。

## gzip-9 体积

生产构建：`npx vite build --configLoader runner`。各 `.js` 分别 gzip level 9 后求和；2D 只计顶层 `assets/*.js`，3D 只计 `assets/3d/*.js`，与隔离测试、m7 口径一致。

| 构建 | 2D 字节 | 3D 字节 |
| --- | ---: | ---: |
| 修改前 `686f3086` | 635,487 | 333,961 |
| 仅移除施法文字字段 | 635,352 | 333,961 |
| 最终三项 | 636,332 | 334,635 |
| 最终净变化 | **+845** | **+674** |

移除施法文字单独节省 **135 字节**。相对仅移除文字版，没收展示、接线及最终产物引用变化增加 2D **980 字节**，未新增图片请求或 2D 懒加载包。3D 计时实现没有静态引入任何 2D 模块。

2D **636,332 < 637,144**，距上限 **812 字节**。以签收 M7 `15313a75` 的 424,763 字节（`M8_REMAINING_JS_BUDGET_PLAN.md:26`）计算，倍率 **1.498087 < 1.50**。未调整硬上限、m7 倍率或隔离测试边界。体积 JSON 留在忽略目录 `artifacts/v26-b/`。

默认 `npm run build` 的 Vite 配置打包器会尝试写共享且只读的 `node_modules/.vite-temp`，因此本机使用 runner；未修改依赖、构建配置或权限。

## 验证

以下 9 个文件共 **65 项通过**：

```sh
npx vitest run --configLoader runner --project fast \
  tests/m7-fx-plan.test.ts \
  tests/v26-confiscation-display.test.ts tests/v26-carousel-timer.test.ts \
  tests/rendering3d-carousel.test.ts tests/rendering3d-overhead.test.ts \
  tests/unit-view-item-stacks.test.ts tests/rendering3d-budget.test.ts \
  tests/rendering3d-isolation.test.ts tests/scrap-enforcer-top-tiers.test.ts
```

实际分组执行：M7 特效 3 项；新增/相关表现、隔离、预算 53 项；原有执法官/极客规则回归 9 项。生产 Vite 构建成功；全量 `npm run typecheck` 通过。`git diff --check` 通过。

M7 特效测试原先重新生成整局经济路线，两次超过原有 120 秒 hook 限制。改为读取已签收的 v25 cannon seed-42 备战状态，仍以当前规则执行每场战斗的全部 tick、收集完整领域账本。原有映射数量、确定性、数值文字和减弱动态断言保留，新增 cast 无文字断言；未延长超时、改 golden 或跳过战斗，最终约 16 秒通过。

新增测试覆盖：双方互相没收、低档不触发、纹章保留、非英雄排除、缺公开数据不猜测、中途装备、冻结阵容与跨轮清理；圆环按时间缩短、相邻释放批次、未知截止、无素材/加载失败、异步资源迟到、退出/重复销毁清理；3D 占位章与通缉标记不重叠。

## 截图与人工验收

本任务没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按工作区 AGENTS 的浏览器桥接约定，未自行启动 Chrome；**没有冒充实机截图**。浏览器首屏交互倍率尚未实测，上述 m7 结论仅涵盖确定性的 JS 预算与预算脚本回归。

执行端需要由 Claude 使用 `codex-browser exec` 新启动浏览器测试任务，连接已有专用 Chrome，按以下步骤验画：

1. 桌面 Chromium 打开联机 2D 对局，施法时只有原圆环/连线，无“施法 · 某某”；回放 Canvas 同样无技能名。截取施法瞬间。
2. 用现有执法官 10 测试阵容进入 PvP：被没收一侧显示“已没收！”，普通装备图标隐藏、纹章仍在，非英雄不盖章；下一准备期恢复原装备图标，章消失。切换 3D 复查头顶章与通缉标记。双方都有执法官 10 时两侧分别检查。无需改规则数值。
3. `?mode=online&render=3d` 进入选秀；无素材根时已有完整程序环，环随服务器时间缩短，释放/领取后消失。配置含计时素材的根后检查最后六秒装饰与程序环共存；网络阻断效果请求时仍有完整圆环。退出选秀再进入，确认没有旧环或旧粒子残留。
4. 浏览器中确认 2D 页面没有请求/预加载 `assets/3d/`；按 CI 的 `scripts/m7-budget.cjs` 对签收基线补测首屏交互预算。

## 改动文件与接线点

已有文件（给同期 UI-1/UI-2 合并时定位）：

| 文件:行 | 改动 |
| --- | --- |
| `src/presentation/fx-plan.ts:28` | 施法只生成颜色，移除 label 字段 |
| `src/presentation/unit-view.ts:75` | 懒创建 2D 占位章，准备/死亡清除 |
| `src/rendering/BoardScene.ts:1346`、`:1481` | 应用展示装备和占位章，传递到 BoardFeed |
| `src/rendering/board-feed.ts:31` | 可选 `itemsConfiscated` 展示字段 |
| `src/rendering/online/online-application.ts:108`、`:152`、`:275` | 持有展示快照、捕获回放初始状态、冻结公开阵容 |
| `src/rendering/online/opponent-board.ts:51` | 导出现有公开阵容的原始羁绊选择器结果 |
| `src/rendering/three-mode/carousel-stage.ts:406`、`:569` | 座位计时环生命周期和服务器时间接线 |
| `src/rendering/three-mode/placeholder-renderer.ts:437`、`:1066` | manifest 可用性和占位章参数两处最小挂接 |
| `src/rendering/three-mode/unit-overhead.ts:126` | 3D 占位章显示、位置与释放 |
| `tests/m7-fx-plan.test.ts:1` | 无施法文字断言及同种子夹具准备优化 |
| `tests/rendering3d-carousel.test.ts:68` | 无素材也有程序计时环 |
| `tests/rendering3d-overhead.test.ts:20` | 占位章显示/清理与通缉标记间隔 |
| `docs/S13_RULES_GAP.md:1163` | 更新占位表现交付状态 |
| `docs/ASSETS3D_CAROUSEL.md:90` | 更新计时环程序化兜底接线约定 |

新文件：`src/rendering/online/confiscation-display.ts:1`、`src/rendering/three-mode/carousel-timer-ring.ts:1`、`src/rendering/three-mode/confiscation-stamp.ts:1`、`tests/v26-confiscation-display.test.ts:1`、`tests/v26-carousel-timer.test.ts:1`、本报告。

## 边界

- 未改 `src/simulation/`、`src/server/`、规则数值、内容版本、素材、打包边界或预算阈值；未扩展单人模式。
- 观战协议没有对手配对字段；公开阵容不能唯一匹配（例如多个座位同阵容，或特殊召唤改变阵形）时保守不猜测没收来源。正常本席对局使用服务器明确的 `opponentSeatId`。旧服务器缺公开阵容时也不凭通缉标记推测没收。
- 程序章与程序环已经覆盖缺素材的功能路径；真实 Chromium 观感及可选本地粒子效果仍需上述人工验收。
