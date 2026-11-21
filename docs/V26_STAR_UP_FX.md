# v26 合星表现补齐

## 现状审查

- 原 2D `BoardScene.showUpgrades` 已调用 `presentation/merge-fx.ts`：280 ms 副本飞入，再播 520 ms 光圈。副本起点只保存于最后一次 reconcile，重复同步可能清空它；星标则随权威状态立即刷新，未与汇聚时刻配合。下一条操作的 `clearCombatEffects()` 会清掉这套动画的 tween。
- 原 3D `three-mode/placeholder-renderer.ts` 只在 `syncStars` 调用 `rendering3d/star-mark.ts` 的 `setLevel()`，直接重建静态星标；原 BoardFeed 只传战斗事件，未传 `unitUpgraded`。3D 覆盖 2D 画布，因此原有 2D 光圈在 3D 看不见。
- 联机已有自己的权威事件和前后状态：`GameClient.state` 带 `confirmed[].events` 与 `serverEvents`，`OnlineApplication` 保留推送前状态，RemoteSession 接收投影后的棋子 ID、位置及星级。`src/server/room/projection.ts` 的 `seatPushEvents` 已允许 `unitUpgraded`。
- 事件已有 `survivorId / consumedIds / definitionId / fromStar / toStar / location`，本任务不需更改规则、服务器或投影字段。

## 完成内容

- 2D：独立、无输入命中的肖像副本飞入目标；300 ms 时闪光、扩散光圈、星标切换并轻微放大，总时长 680 ms。动画通过自己的帧更新管理，不依赖会被下一条命令清掉的战斗 tween，也不改变棋子拖动缩放。星标在动画结束或释放时恢复。
- 2D 实现仅在第一次合星时加载 `assets/ui/merge-fx-*.js`；运行时没有任何 import，其唯一模块属于 `src/presentation/`。loader 丢弃场景关闭后才返回的 import。
- 3D：新增只属于 3D chunk 的 `three-mode/star-up-fx.ts`。被消耗模型从实时、可拾取的棋子表转移到动画层，保留原模型租约；两副本缩小、抛物线汇聚，目标闪光、地面光圈和头顶星标变化。动画结束或切换棋盘时释放模型、克隆骨骼、几何与材质；共享模型资源仍由原租约管理。
- 未曾显示的购买副本从商店方向飞入；3D 优先克隆本次保留的同名模型，没有可用模型时用程序化光影占位，不等待素材下载。
- 同一存活棋子的连锁升星在上一次汇聚后继续；无关棋子的升星同时进行。减少动态效果模式省略飞行与缩放，仅保留 240 ms 闪光、星标切换。
- 联机在刷新完成后统一分发本次推送全部合星事件，覆盖普通购买确认、跨阶段确认及服务器结算推送。以存活 ID、目标星级、消耗 ID 去重；不从阵容差分推断升星，不改变权威状态或结算时机。

## 验证

- 使用 Node 展示替身运行真实帧更新与 BoardScene、OnlineApplication、3D renderer 接线，验证副本汇聚、连续同步后的起点保留、连锁升星、重复回执、结算切换、动态目标、减少动态效果、懒加载失效及资源释放。
- `rendering3d-isolation.test.ts` 使用真实生产构建验证：2D 静态依赖不含 3D，UI lazy chunk 仅含 presentation 模块、无运行时依赖，且不被 HTML 预加载；原体积断言保持。
- 环境的 `node_modules` 是只读软链，默认 Vite bundle 配置加载器无法写 `.vite-temp`。构建改用 `npx vite build --configLoader runner`，没有修改仓库依赖或缓存配置。
- 测试使用 `/tmp/starfx-vitest.config.ts`：继承仓库测试项目和 worker setup，仅将缓存放到 `/tmp`，跳过会启动 Chromium 的 global setup。全部相关测试使用 `--maxWorkers=4`，没有删除原断言、增加超时或运行全套测试。

## 浏览器验收状态和边界

**截图／录屏未实跑。** 本任务无 `CODEX_BROWSER_CLIENT`、`PLAYWRIGHT_WS_ENDPOINT` 或 `PW_TEST_CONNECT_WS_ENDPOINT`，没有启动 Chrome 或改用完整权限。需由 Claude 使用 `codex-browser exec` 新启动浏览器测试任务后，分别验收 2D 与 3D 的普通二星、连锁三星、棋盘／备战席混合来源、快速连续买牌及升星中拖动／出售。

己方当前回执已足够。断线后仅有最终快照且没有新合星事件时不重播历史动画；未显示过的棋子没有历史起点，使用商店方向。看对手的公开棋盘没有对手合星事件，本次不推断或播放对手动画；若以后要求该功能，需另提供仅含公开棋子 ID、前后星级、目标位置、消耗棋子公开位置和稳定事件标识的公开合星事件。

## 最终结果

- 类型检查、生产构建通过；9 个相关测试文件共 72 项通过，均使用 --maxWorkers=4。
- 顶层 dist/assets/*.js 的逐文件 gzip-9 总和：**630,573 字节**，上限 637,144，余量 6,571 字节。
- 2D 合星 lazy chunk：assets/ui/merge-fx-Di6EiBLR.js，gzip-9 1,206 字节。
- 未修改 src/simulation/、src/server/、本地素材或 .git；未提交。
