# v26 右侧玩家栏

本次纯前端修改：存活玩家按当前 HP 降序，自己一起排序；淘汰玩家置后，按服务器给出的最终名次升序，不在前端计算淘汰胜负。移除了 3D 的 `.online-seat.me { order:-1 }`。

未找到可确认 **14.24 存活玩家同 HP 排列**的一手说明。按本任务允许的回退，先保留上一次显示顺序，首次按 `PlayerView.seats` 原始座位顺序（`toPlayerView` 从 `room.seats` 原序投影）。名字、是否自己和连胜均不参与比较。终局/淘汰直接读取 `rank`，不把同时淘汰的决胜规则拿来套存活玩家。

列表保留行、头像和已有火焰节点，HP 导致排序变化时立即更新 DOM 顺序，再用 220ms WAAPI 位移动画平滑换位。无换位的推送不重启动画；动画中再次换位从当前可见位置开始；动画不阻断点击和键盘选择；销毁时取消。减少动态效果偏好下不播放换位。

## 连胜资料与限制

- [14.24 客户端侧栏原始数据](https://raw.communitydragon.org/14.24/game/gameplay.tftscoreboard.bin.json)：`PlayerSelfTemplate` 和 `PlayerOpponentTemplate` 都有 `WinStreakIntro/WinStreakLoopLevel1/WinStreakLoopLevel2/WinStreakOutro`，包含头像周围的火环和火焰粒子。没有对应的 LossStreak/Ice 侧栏控制字段，因此本次不自创连败头像冰焰。其他 UI 的连败/金币图标不属于玩家头像特效。
- [Riot 14.2 官方说明](https://teamfighttactics.leagueoflegends.com/en-au/news/game-updates/teamfight-tactics-patch-14-2-notes/)确认连胜**通知**调整到 5 和 8 场，不能等同于持续火焰门槛，也不能用金币奖励门槛替代火焰门槛。
- 较早实机玩家记录把持续头像火焰描述为 4 连胜起（[实机问答记录，2023-08-15](https://www.reddit.com/r/TeamfightTactics/comments/15ryetc/)、[实机问答记录，2021-12-26](https://www.reddit.com/r/TeamfightTactics/comments/rot7zm/)）。它们不是 14.24 的版本证明；14.24 scoreboard JSON 没有暴露触发次数。前端暂取 **4**，集中在 `SIDEBAR_FIRE_WINS`，明确保留版本核实缺口；不宣称 2、3 或 4 已被 14.24 官方确认。
- 当前本地 `assets3d-local/ui/manifest.json` 的 `unavailable` 明列 `data/menu/textures/tft_winstreak_atlas.tex: not-in-selected-wads`，sprites/textures 中也无连胜条目。本次使用 CSS 程序火焰，无素材请求、拷贝或提交；未猜测图集 UV。后续若提取图集，应走配置素材根的 `ui/manifest.json` / textures / sprites 运行时映射，再替换回退。
- 其他玩家的 streak 目前不公开。接口请求见 [SR-V26-SIDEBAR](UI_REQUESTS.md#sr-v26-sidebar-右侧玩家栏公开连胜2026-10-29待后端)。前端只读可选公开字段，缺失、连败、无效计数或淘汰都没有火焰；不从战斗结果、HP 或 publicBoard 推导它。

## 验证

- `npm run typecheck` 通过；生产构建 `npx vite build --configLoader runner` 通过。使用 runner 是因为 node_modules 软链所在目录只读，默认配置加载器写入 `.vite-temp` 会失败。
- 2D 顶层 JS gzip（level 9）合计 **631,109 bytes**，上限 **637,144 bytes**，余量 **6,035 bytes**。没有新增 lazy chunk，也没有改变体积计算范围或 vite.config.ts。
- 相关单测：`sidebar.test.ts`、`overtime-display.test.ts`、`rendering3d-budget.test.ts`、`rendering3d-mode.test.ts`，共 **49 项通过**，`--maxWorkers=4`。用 `artifacts/sidebar/vitest.config.ts` 只选择这四份测试，省略会无条件尝试启动 Chromium 的全局 setup；未改原测试、断言或超时。
- 当前没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，未启动 Chrome、未跑实机截图或布局验收。需要 Claude 用 `codex-browser exec -C /home/aiapps/workspcae/cat-cx-sidebar ...` 新开带连接的任务，检查 2D/3D 动画、头像火焰与点击；不能把 DOM 几何记录测试当成实机视觉验收。
