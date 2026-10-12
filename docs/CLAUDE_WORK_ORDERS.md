# Claude 流水线派工单（由策划 Claude 编写，执行者为 Claude Opus 会话）

用法：每次新开一个 Opus 会话，把下面一张派工单整段粘贴进去。每张单独立、可直接执行。执行者只做单子里的事，做完按 AGENTS.md 汇报格式汇报并开 PR 到 `multiplayer`。

通用规则（每张单都默认包含）：
- 你是 AGENTS.md「八人联机分工」里的 **Claude**，负责流水线 B（`src/server/`）与 C（界面）。先读 AGENTS.md、`docs/MULTIPLAYER_RENOVATION_V2.md` 第 3、5 节、`docs/MULTIPLAYER_CONTRACT.md`、`docs/UI_REQUESTS.md` 末节。
- 从 `origin/multiplayer` 开分支，分支名见单子。不碰 `src/simulation/`、`tests/`（`tests/server/` 除外）、`scripts/`、main。需要规则改动写进 `docs/UI_REQUESTS.md`。
- 结束前必跑：`npm run typecheck`、`npm run build`、与改动相关的 vitest；界面改动用 Playwright 走一遍并截图（云端会话里 Chromium 在 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`，用 `executablePath` 指定，不要 `playwright install`）。
- 开 PR 到 `multiplayer`，PR 里写：改了什么行为、跑了哪些检查、剩余问题。不要合并，不要开第二个 PR。
- 汇报用 AGENTS.md 的【完成】【未完成】【需要我决定】【风险】【下一步】格式，不超过 15 行。

---

## 派工单 C2：商店移到棋盘底部，完成 TFT 式布局（联机模式）

分支：`claude/c2-tft-layout`，基于 `origin/multiplayer`（需已包含 PR #33 `claude/t8-online-ui`；若未合并，先 `git merge origin/claude/t8-online-ui`）。

### 现状
`?mode=online` 已有三栏：左侧策略面板（含商店、HUD、羁绊装备等标签页）、中间棋盘、右侧八席血条栏。见 `src/rendering/online/`。商店目前在左栏里，TFT 是在棋盘正下方横排。

### 要做
1. 联机模式下把商店（`.shop-panel`）和四个操作按钮（刷新、经验、出售、锁店，`.mobile-controls`）移到棋盘正下方，横向一排，宽度与棋盘一致。
   - `StrategyPanel.render()` 每次会 `replaceChildren` 重建自己的 DOM，所以不能只搬一次节点。推荐做法：在 `src/rendering/app-shell.ts` 或 `online-application.ts` 里新增一个 `#shop-dock` 容器放在 `#board-frame` 下方；在 `StrategyPanel` 增加一个可选的「商店挂载点」参数（构造时传入 `HTMLElement | null`），render 时若有挂载点就把商店与操作按钮渲染到那里，否则保持原位。离线模式不传，行为不变。
   - 金币、等级、经验、人口四个 HUD 芯片随商店一起放到底部左侧（TFT 的位置），生命值芯片可以留在左栏或一并下移，自己定。
2. 左栏只剩：阶段标题、本轮对手/野怪预览、羁绊/装备/部署/构筑/记录标签页。
3. 右栏血条栏保持；顶部倒计时放大到明显可见（TFT 顶部中央有大倒计时，可以把倒计时移到棋盘正上方居中，右栏只留阶段徽章）。
4. 终局时左栏的「失败 · 对局结束 · 点击新局」等单人文案在联机模式隐藏或改为「对局结束 · 查看排名」。查 `BoardScene.ts` 里三处 `点击 新局 重开` 和 `strategy-panel.ts` 的 `PHASE_HINT`，用 `document.body.dataset.online` 判断。
5. 1440 宽度下不出现横向滚动；1100 以下允许退化为两栏。

### 不做
- 不改离线布局和任何离线 DOM 顺序；现有 Playwright 脚本依赖的 `data-debug` 名称和 `#strategy-root`、`.shop-panel` 等选择器必须保留。
- 不动假服务器逻辑，不改规则。

### 验收
- [ ] `?mode=online&prep=5` 下：商店在棋盘正下方，操作按钮同排，购买、刷新、锁店、经验仍可用（通过 `window.__CAT_DEBUG__.read().state.gold` 变化证明）。
- [ ] 不带参数打开：布局与 PR #33 之前一致，`npm test -- tests/m8-b8-token-lifecycle.test.ts tests/match-session.test.ts` 通过。
- [ ] 截图三张：匹配页、准备阶段、终局排名，放在 PR 描述里（用 GitHub 附件或描述文字说明尺寸）。
- [ ] `npm run typecheck`、`npm run build` 通过。

---

## 派工单 B1：`src/server/` 房间状态机骨架（T4 第一步，无网络）

分支：`claude/b1-room-machine`，基于 `origin/multiplayer`。

### 目标
一个纯 TypeScript、无网络、无真实时钟的「房间」类，管八个席位的回合流程。真实双方战斗（T2/T3）和共享卡池（TP）还没交付，所以战斗结果通过一个可替换的接口注入；本单只做编排，不做任何规则计算。

### 要做
1. 新建 `src/server/room/` 目录，至少包含：
   - `types.ts`：`RoomState`、`SeatState`、`RoomPhase`（`waiting | preparation | choice | frozen | battle | settlement | ended`）、`RoundSettlement`，字段参照 `docs/MULTIPLAYER_RENOVATION_V2.md` 3.2 节与 `docs/MULTIPLAYER_CONTRACT.md` 第 2 节。所有数值为整数。
   - `clock.ts`：可注入时钟接口 `{ now(): number; schedule(at: number, fn): handle; cancel(handle) }`，附一个测试用的手动时钟（`advance(ms)` 触发到期回调）。
   - `battle-resolver.ts`：接口 `resolveBattle(input: BattleInput): BattleResult`。本单提供一个 **占位实现**：对每个席位调用现有 `startMatchCombat` + `stepMatch` 跑完它自己的单人战斗（和现在的假服务器一样），把结果包成 `BattleResult`。文件头注明「占位，等 T2/T3 交付后替换为真实双方战斗」。
   - `pairing.ts`：PvP 配对。8、7、5、3、2 名存活者都能配对；奇数时给一名玩家分配另一名存活者的「镜像」标记（只记录来源席位，不复制资产）；同一轮无人自战、无人重复；相同输入可复现（用 `src/simulation/rng.ts` 的 `nextRandom`，种子由房间持有）。
   - `room.ts`：`Room` 类。命令入口 `handle(seatId, command)` 只做阶段校验与席位归属，然后调用 `src/simulation/match.ts` 的公共命令函数；失败原样返回，不改任何字段。阶段推进：准备截止 → 冻结 → 对每对调用 resolver → 收齐全部结果后一次性提交结算（扣血、淘汰、排名）→ 进入下一轮或终局。
   - `projection.ts`：`toPlayerView(room, seatId)`，输出 `src/rendering/online/protocol.ts` 里的 `PlayerView`（白名单构造，不序列化整个 MatchState）。
2. 排名与淘汰：按 V2 的 D7 建议实现（扣血后未截断 HP → 轮前 HP → 席位序号破同分），在代码注释里标明「建议规则，待 T3/T4 合同定稿」。
3. 单一队列：`Lobby` 类，`join(name)` 第 9 人返回 `{ ok: false, reason: 'full' }`；`start()` 用机器人占位席补满 8 席（机器人此时只是空席位，不操作）。
4. 测试放 `tests/server/`，用手动时钟，不等真实秒数：
   - 开局恰好 8 席；8/7/5/3/2 名存活者配对无自战无重复，奇数有且只有一个镜像。
   - 一轮内一场 resolver 抛错时，没有任何席位被扣血（半轮不提交）。
   - 同一 `RoundSettlement` 提交两次，第二次无效果。
   - 多席同轮归零时名次唯一且覆盖 8 席，与结果到达顺序无关。
   - 命令在错误阶段或错误席位被拒绝，且状态引用不变。

### 不做
- 不写 WebSocket/HTTP，不写机器人策略，不改 `src/simulation/`。
- 不实现共享卡池；商店仍是各自独立（在 `types.ts` 预留 `poolRevision` 字段并注明待 TP）。
- 不把 `fake-server.ts` 换成这个 Room（下一张单再接）。

### 验收
- [ ] `npx vitest run tests/server` 全部通过，运行时间 < 30 秒。
- [ ] `npm run typecheck`、`npm run build` 通过；`src/server/` 不引入 `phaser`、DOM、`Math.random`、`Date.now`（grep 证明）。
- [ ] `docs/UI_REQUESTS.md` 末尾追加一节「src/server 需要规则侧提供的接口」，列出你发现的缺口（例如：双方战斗输入类型、结算收据类型、淘汰归还卡池钩子）。
