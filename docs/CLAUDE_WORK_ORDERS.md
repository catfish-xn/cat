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

---

## 派工单 C3：界面接到真房间（浏览器内跑 `src/server/room`，替换假服务器）

分支：`claude/c3-local-room-client`，基于 `origin/multiplayer`（已含 PR #33、#34、#35）。

### 现状
- `src/rendering/online/fake-server.ts` 是临时假服务器，自己管回合、倒计时、其他七席的假数字。
- `src/server/room/` 已有真房间状态机（`Room`、`Lobby`、`ManualClock`、`toPlayerView`、`toCombatFrames`），但只在测试里跑过，没有接到界面。
- `src/server/room/types.ts` 里重声明了一份 `PlayerView`/`LobbyView`，与 `src/rendering/online/protocol.ts` 结构相同，注释说"合入后改为引用"。

### 要做
1. **统一协议文件**：把 `PlayerView`、`LobbyView`、`SeatPublic`、`RoomPhase`、`CombatFrame`、`ClientCommand`、`ROOM_CAPACITY` 搬到 `src/server/protocol.ts`（服务器与界面共用的纯类型文件，不含实现）。`src/rendering/online/protocol.ts` 改为 `export * from '../../server/protocol'` 并保留 `GameClient`/`ClientListeners` 接口；`src/server/room/types.ts` 删除重复声明改为引用。界面只能从 `src/server/protocol.ts` 和 `src/server/room/index.ts`（新增的公开出口）导入，不深入其他服务器文件。
2. **真实时钟适配器**：`src/server/room/clock.ts` 已有接口；新增 `src/server/room/real-clock.ts`（`performance.now` + `setTimeout`），它是唯一允许碰真实时钟的服务器文件，并把 `tests/server/purity.test.ts` 的白名单加上这一个文件。
3. **本地房间客户端**：新增 `src/rendering/online/local-room-client.ts` 实现 `GameClient`，内部直接 new `Lobby` + `Room`（真实时钟），把 `Room` 的推送转成 `listeners.state/view/combat/lobby`。`send()` 调用 `room.handle(mySeatId, command)`，原样返回结果。其他七席为机器人空席（B1 的 `start()` 行为），它们不操作。
4. **切换**：`BoardScene` 默认用 `LocalRoomClient`；`?server=fake` 时才用旧 `FakeServer`。URL 参数 `prep/choice/settle/seed/name` 继续有效（传给 Room 的配置）。假服务器文件保留到 C4 之后再删。
5. **顺手修两处 C2 遗留**：棋盘在 800 宽列内左右黑边（调 `#board-root` 的高度/宽度约束或 FIT 容器，不改 `BOARD_LAYOUT` 逻辑尺寸）；终局时左栏残留的补给/收入信息隐藏。
6. 房间 `fault`/`seat-stuck` 中断（B1 已定义）要在界面显示明确文案："对局异常结束：原因"，并提供返回匹配按钮。

### 不做
- 不改 `src/server/room/` 的流程逻辑和排名规则（只加 `real-clock.ts`、`index.ts`、搬类型）。
- 不写网络。不动 `src/simulation/`。

### 验收
- [ ] `?mode=online&prep=3&settle=1` 用真房间从匹配跑到终局排名，Playwright 全流程无报错；`__CAT_DEBUG__.read().m6.transport` 为 `local-room`。
- [ ] `?mode=online&server=fake` 仍可用（回归）。
- [ ] 协议类型只有一份；`npx vitest run tests/server` 仍全绿且 purity 白名单只多 `real-clock.ts`。
- [ ] 房间异常结束有可见文案和返回按钮（可用 `?faultAt=2` 之类的调试参数触发，参数只在非生产构建生效或明确标注为调试）。
- [ ] typecheck、build、离线冒烟通过。

---

## 派工单 B2：网络层（WebSocket 服务器 + Node 测试客户端，无浏览器）

分支：`claude/b2-net`，基于 `origin/multiplayer`（建议在 C3 合入后开工，以便复用 `src/server/protocol.ts`；若 C3 未合，自己先做第 1 步的类型统一，合并时以 C3 为准）。

### 目标
让两个独立进程能连上同一个房间、各控自己的席位、互不越权，断线后凭凭证回到原席。只验证网络正确性，不做正式界面（那是 C4）。

### 要做
1. 依赖：允许新增 `ws` 为运行依赖（Node 22 自带 WebSocket 客户端但没有服务器）。只加这一个包，写明版本。
2. `src/server/net/`：
   - `messages.ts`：客户端→服务器消息（`join`、`leaveQueue`、`start`、`command`、`resume`）与服务器→客户端消息（`lobby`、`view`、`state`、`combat`、`receipt`、`error`）的类型与**运行时校验函数**（手写校验，不引第三方 schema 库）。每条客户端消息带 `protocolVersion`、`commandId`；`command` 另带 `seatRevision`/`shopGeneration` 等所需版本字段，照 `docs/MULTIPLAYER_RENOVATION_V2.md` 5.1 节。
   - `session.ts`：座位凭证（服务器生成的不可猜测随机串，用 `node:crypto`，这是服务器网络层，不受 simulation 的 RNG 限制）、`connectionEpoch`、凭证→席位绑定；旧连接在新连接接入后失效。
   - `dedupe.ts`：每席 `commandId` 去重；相同编号相同内容返回原回执，相同编号不同内容拒绝；保留窗口（例如最近 256 条），窗口外要求重同步。
   - `server.ts`：`createGameServer({ port, room options, clock })`，单房间单写队列（所有消息按到达顺序串行进 `Room.handle`），每连接消息频率与大小上限，向各连接只发它自己的 `toPlayerView` 和自己的 `state`/`combat`，其他人收不到你的商店。
   - `src/server/main.ts`：Node 入口，读端口环境变量，启动服务器；`npm run serve:game` 启动（允许加 `tsx` 开发依赖或复用 esbuild 构建，二选一写明）。
3. `src/server/net/test-client.ts`：Node 测试客户端，能加入、开始、发命令、断开、用凭证重连。
4. 测试 `tests/server/net/`（真实端口随机、真实 ws，但房间用 `ManualClock`）：
   - 两个客户端连同一房间，各自购买后，对方的 `view` 看到 HP/等级变化但看不到自己的商店（抓取下发消息断言无 `shop` 字段）。
   - 伪造 `seatId`、客户端上传金币、`protocolVersion` 错误、字段类型错误、过期 `shopGeneration` 全部被拒且房间状态引用不变。
   - 重复 `commandId` 只执行一次；同编号不同内容被拒。
   - 断开后凭证重连回到原席，旧 socket 再发命令被拒；重连先收快照再收增量。
   - 第 9 个连接加入队列收到 `full` 错误。
   - 每房单写：并发 50 条命令按到达顺序串行处理，无交错。

### 不做
- 不写浏览器客户端（C4）。不做 HTTPS/WSS 终止（部署时由反向代理做，T9）。不做多房间。
- 不碰 `src/simulation/`、`src/rendering/`。

### 验收
- [ ] `npx vitest run tests/server` 全绿，网络测试总时长 < 60 秒。
- [ ] `npm run serve:game` 能起、能被 `test-client.ts` 连上并完整跑一局（用 `prep=2` 等短配置）。
- [ ] typecheck、build 通过；`src/server/net` 的 purity 例外只允许 `ws`、`node:crypto`、真实时钟适配器。
- [ ] `docs/UI_REQUESTS.md` 追加 C4 需要的客户端消息说明（待确认回执、重连流程、错误码表）。

---

## 派工单 B3：房间接入 T2 真实双方战斗（按合同 §10.6，不做资产提交）

分支：`claude/b3-two-sided-resolver`，基于 `origin/multiplayer`（已含 PR #36 T2 与 PR #37 C3）。

### 现状
- `src/server/room/battle-resolver.ts` 仍是占位：每席各跑一次单人 `startMatchCombat`，PvP 不是真对战。
- T2 已交付规则侧入口（经 `src/server-entry/index.ts` 导出）：`snapshotForBattle`、`compileBattle`、`resolveTwoSidedBattle`、`proposeSettlement`、`startTwoSidedCombatWithEvents`、`stepCombat`。合同 `docs/MULTIPLAYER_CONTRACT.md` 第 10 节（尤其 **10.6**）写明了房间侧要怎么改，照做即可，不要自创。
- T3（结算收据提交入口）GPT 还没交付，所以**本单只到"算出提案并暂存"，不扣血、不发收入、不进下一轮**。

### 要做
1. 调度信封（`src/server/room/types.ts` 的 `BattleInput`）增加显式 `battleSeed: number`（冻结配对时由房间种子派生，重试不换）和 `maxSteps: number`（默认 1201）；保留 `battleId/round/roomRevision`。
2. 新增 `src/server/room/two-sided-resolver.ts`：普通 PvP 对两席只编译、只运行一次，照 §10.6 的伪代码调用 T2 入口；返回 `{ battleId, round, roomRevision, battle: RulesBattleResult, proposals: { a, b } }`。镜像配对：真实参战席位为 a，`mirrorOf` 快照为 b，第四参传 `mirrorOfSeatId`；镜像提案 `settlementEligible=false` 时不得进入任何提交队列。PvE/补给回合保留原占位分支，不走 PvP 入口。
3. 战斗帧改为战斗视图数据：用 `startTwoSidedCombatWithEvents` + `stepCombat` 逐 tick 保存 `{ state: CombatState, events }`，只跑这一场；B 视角由映射得到，不再各跑一次。`projection.ts` 的 `toCombatFrames` 相应调整，`src/server/protocol.ts` 的 `CombatFrame` 若需改形状，同步改 `src/rendering/online/remote-session.ts` 的播放（它现在吃 `MatchState` 帧；改成 `CombatState` 帧后 BoardScene 仍能用 `syncCombat` 渲染，注意 `session.combat` 的来源）。
4. 房间增加 `pvpMode: 'placeholder' | 'two-sided'` 配置，默认仍为 `placeholder`（因为 T3 没到，two-sided 下 PvP 回合无法推进）。`two-sided` 模式下：PvP 回合算出提案后把它们存进 `RoomState.pendingProposals`（带 battleId、参战真实席位），然后房间进入新阶段 `awaiting-settlement` 并以 `fault: { kind: 'settlement-unavailable' }` 明确中断（T3 到了换成提交）。不要为了"能跑通"自己扣血。
5. 任一席位编译或规则抛 `BattleValidationError` 时，整轮不采纳结果（B1 已有的半轮不提交语义），记录原因。
6. 测试 `tests/server/two-sided-resolver.test.ts`：
   - 两席真实阵容进入同一场战斗（断言 `battle.mapping` 含双方席位且事件里出现双方单位）；
   - 同一信封重跑结果 deepEqual；重试不换 `battleSeed`；
   - 镜像配对的 b 提案不可结算，且镜像原主在它自己的配对里结果独立；
   - 帧序列只有一场，首帧为开场、末帧为终态；
   - `two-sided` 模式下 PvP 回合把提案暂存后以 `settlement-unavailable` 中断，无人扣血；`placeholder` 模式现有 33+ 用例不变。

### 不做
- 不实现 `applyRoundSettlement`、不扣血、不发收入、不做加时（等 T3）。
- 不碰 `src/simulation/`、`src/server-entry/`。规则侧缺口写进 `docs/UI_REQUESTS.md`，编号续 SR-B3-xx。

### 验收
- [ ] `npx vitest run tests/server tests/t2-two-sided-battle.test.ts` 全绿；purity 检查零命中。
- [ ] `?mode=online` 默认行为不变（placeholder），离线冒烟通过；typecheck、build 通过。
- [ ] 合同 §10.6 的五条要求逐条在 PR 描述里对应到代码位置。

---

## 派工单 C4：浏览器 WebSocket 客户端（两台电脑真的连上同一局）

分支：`claude/c4-ws-client`，基于 `origin/multiplayer`（已含 B2 网络层 PR #38、C3）。若 B3 已合入则一并包含；若未合入，帧仍是 `MatchState`，按下面第 6 条处理。

### 依据
`docs/UI_REQUESTS.md` 的「联机客户端消息说明（B2）」：消息表、待确认回执、重连流程、错误码表。类型与校验在 `src/server/net/messages.ts`（可直接在浏览器 import），共享视图在 `src/server/protocol.ts`。

### 要做
1. `src/rendering/online/ws-client.ts`：`WsGameClient implements GameClient`，`transport: 'websocket'`。
   - `joinQueue(name)` → `join`；回执里的 `token` 存 `sessionStorage`，不显示。`startMatch()` → `start`；`leaveQueue()` → `leaveQueue`。
   - `send(command)` 现在必须变成**待确认**：`GameClient.send` 的返回类型改为 `MatchCommandResult | { ok: 'pending'; commandId: number }`（改 `protocol.ts` 的接口，同步改 `RemoteSession.intent`：pending 时不改本地状态、返回 `blocked()` 给 BoardScene 但不显示"失败"，而是状态栏显示"待确认…"；收到 `receipt` 后由随后的 `state` 推送驱动刷新）。本地房间与假服务器仍同步返回，行为不变。
   - `commandId` 递增计数器；每条 `command` 带最新 `roomId/round/seatRevision`（来自最近一次 `state`/`view`）；`seat-revision-mismatch`/`stale-round` 时等下一条 `state` 再提示玩家重试，不自动重发。
   - 收到 `view/state/combat/lobby` 转给 `ClientListeners`；`error{session-superseded}` 时停止发送并显示"已在别处打开"。
2. 重连：`onclose` 后显示"连接中断，重连中…"（状态栏 + 右栏徽章），指数退避 1s/2s/4s 到 10s 上限，用 `resume{token}`；成功后按快照顺序恢复，把 `commandId` 计数器调到 `lastCommandId + 1`。`invalid-token` 回到匹配页。排队阶段断线视为离队。
3. 入口选择：`?mode=online&server=ws` 用 WebSocket，地址默认 `ws(s)://<当前主机>/ws`，可用 `?ws=ws://127.0.0.1:8787` 覆盖；`server=local`（默认）仍是浏览器内真房间；`server=fake` 删除，连同 `fake-server.ts` 一起删（C3 已替代）。
4. 开发联调：`vite.config.ts` 加 `/ws` 到 `ws://127.0.0.1:8787` 的代理（只影响 dev server）；`package.json` 加 `dev:online`：同时起 `serve:game` 和 `vite`（用 `npm-run-all` 或 `concurrently` 二选一，写明）。
5. 服务器端两处小改（`src/server/net/server.ts`，Claude 自己的目录）：开启 `permessage-deflate`；`combat` 消息若超过 1 MiB 则按 200 帧一包分批发送（消息体加 `part/total`），客户端拼回后再交给 `receiveCombat`。
6. 帧体积：若 B3 已合入，帧是 `CombatState`，直接用；若未合入，先按现状跑通，PR 里写明实测单条 `combat` 大小。
7. 测试：
   - `tests/server/ws-client.test.ts`：用 `createGameServer`（`ManualClock`）+ 真实 ws，在 Node 里跑 `WsGameClient`（无 DOM 依赖部分），覆盖：join/start/command 待确认→回执→state 刷新；重复 commandId；断线 resume 恢复顺序；`session-superseded`。
   - Playwright：**两个浏览器上下文**连同一个 `serve:game`（`CAT_PREP_SEC=3`），各自买卡，对方右栏看到等级/HP 变化但 `__CAT_DEBUG__.read().state.shop` 只有自己的；一方刷新页面后回到原席（`sessionStorage` token），另一方画面不受影响；跑到终局两边排名一致。
   - 离线冒烟、`?server=local` 回归。

### 不做
- 不做 HTTPS/WSS 终止、不做部署（T9）。不做机器人行为。不碰 `src/simulation/`、`src/server-entry/`、`src/server/room/` 流程。

### 验收
- [ ] 两个浏览器上下文 + 一个真服务器完成一局，排名一致，刷新页面可回原席。
- [ ] 待确认状态可见，回执失败后本地状态不变（`gold` 不先扣）。
- [ ] `npx vitest run tests/server` 全绿；typecheck、build 通过；`fake-server.ts` 已删且无引用。
- [ ] PR 写明实测单条 `combat` 最大体积与开启压缩后的体积。

---

## 派工单 B4：房间提交整轮结算（T3 收据接入，真实 PvP 跑通整局）

分支：`claude/b4-round-commit`，基于 `origin/multiplayer`（已含 B3 PR #40、T3 PR #39）。若 C4 PR 先合入，合并后以 C4 的网络代码为准。

### 依据
`docs/MULTIPLAYER_CONTRACT.md` **§11.3（B4 全轮编排）、§11.4（超时命令）、§11.5（加时与同轮归零排名）**；`docs/UI_REQUESTS.md` SR-B3-01。T3 导出（经 `src/server-entry`）：`enableMultiplayerSettlement`、`applyRoundSettlement`、`RoundSettlementReceipt`、`ROUND_SETTLEMENT_VERSION`、`forfeitPendingChoice`、`claimOrDiscardLoot`。

### 要做
1. 开局时对每席 `MatchState` 调 `enableMultiplayerSettlement`（服务器模式），PvP 不再走单人内部结算。
2. 把 B3 的 `parkProposals` 末尾的 `settlement-unavailable` 中断换成 §11.3 的提交流程：收齐全轮 → 校验每个真实席恰一份、battleId/round/代次与冻结信封一致 → 临时 map 逐席 `applyRoundSettlement`（收据按 §11.3 示意构造，`settlementId` 用合同建议格式）→ 任一失败整轮丢弃临时 map，不发布已成功的席 → 全部成功后一次替换，`SeatState.hp` 取返回 `state.playerHp` → 发布事件与版本。整轮提交用 round commit ID 去重；房间自身失败用同信封同 map 重试，不换种子。
3. PvE/补给回合的已结算状态也走同一次原子发布（§11.3 第 4 条）。
4. 超时：准备截止前先按 §11.4 对每席调用 `forfeitPendingChoice` / `claimOrDiscardLoot`，替换 B1 的 `choice-fallback.ts` 占位策略（删除它）。
5. 加时与排名：按 §11.5 实现目录末轮后的 PvP 加时（只 PvP，末阶段基础伤害），以及同轮归零排名（未截断 HP → 轮前 HP → 席位序号）；若 §11.5 要求的目录外 `nextRound` 入口规则侧尚未提供，用合同写明的方式，缺口写 SR-B4-xx，不自造。
6. `pvpMode` 默认改为 `two-sided`；`placeholder` 保留给测试。
7. 测试 `tests/server/round-commit.test.ts`：整轮提交后每席 `MatchState.playerHp === SeatState.hp`；重复 round commit 第二次无效果；一席收据失败时无人扣血、无事件发布；镜像不提交、原主由真实配对提交；8 → 2 席位逐轮淘汰到唯一名次；三席同轮归零名次与到达顺序无关；全 8 机器人（空阵容）整局在 `ManualClock` 下 30 秒内跑完。
8. 浏览器：`?mode=online&prep=2&choice=2&settle=1` 默认（two-sided）从匹配跑到终局排名；`__CAT_DEBUG__.read().state.playerHp` 与右栏我的 HP 一致；离线冒烟。

### 不做
- 不碰 `src/simulation/`、`src/server-entry/`；不做共享卡池（B5 等 TP）；不改网络协议（与 C4 并行，冲突时以 C4 为准，我来协调）。

### 验收
- [ ] `npx vitest run tests/server tests/t2-* tests/t3-*` 全绿；purity 零命中；`choice-fallback.ts` 已删。
- [ ] 默认模式浏览器整局到排名，无报错；typecheck、build 通过。
- [ ] PR 描述把 §11.3 五条逐条对应到代码位置；规则侧缺口列为 SR-B4-xx。

---

## 派工单 C5：查看对手阵容、淘汰后观战、联机文案收口（纯界面）

分支：`claude/c5-spectate`，基于 `origin/multiplayer`（已含 C4 PR #41、B3）。与 B4 并行，不碰 `src/server/room` 流程；若需要服务器下发新字段，写进 `docs/UI_REQUESTS.md`（SR-C5-xx），先用现有 `PlayerView` 能做的部分。

### 依据
`docs/MULTIPLAYER_RENOVATION_V2.md` N6 第 3、8 条（公开阵容查看、淘汰玩家观战）；`src/server/protocol.ts` 的 `PlayerView`/`SeatPublic`。TFT 原版：点右侧玩家头像可看对方棋盘和装备，自己被淘汰后仍能看排名并观战。

### 要做
1. **公开阵容数据**：`SeatPublic` 目前只有 HP/等级。在 `src/server/protocol.ts` 增加可选的 `publicBoard?: { units: { definitionId, starLevel, cell, items: string[] }[] ; traits?: ... }`，由 `src/server/room/projection.ts` 的 `toPlayerView` 从各席位 `MatchState.preparation` 白名单构造（只取上场单位，不含备战区、商店、金币、随机流）。这是 `src/server/room` 里唯一允许的改动，且只是投影，不碰流程。本地房间和 WebSocket 都自动带上。
2. **查看对手**：点击右栏任一席位，中间棋盘上方弹出一个只读的"对方阵容"面板（不替换我的棋盘，不触发任何命令）：七列八行缩略棋盘、每个单位的头像/星级/装备图标、羁绊列表（用现有 `deriveTraits` 读公开单位即可）。再点一次或 Esc 关闭。当前对手席位默认高亮。
3. **淘汰后观战**：我方 `alive=false` 后：商店坞置灰且所有命令按钮禁用（`RemoteSession` 已拒绝，界面也要明确不可点），右栏保留，顶部显示"已淘汰 · 第 N 名 · 观战中"，可继续看对手阵容和倒计时；终局时排名层正常弹出。
4. **文案收口**：联机模式下所有残留的单人文案（"点击开始战斗"、"点击 继续"、"新局"、"存档"等）统一替换或隐藏；状态栏在准备阶段显示"对手：xxx"，战斗阶段显示"对战 xxx"。
5. 右栏席位增加小头像位（用现有 `s13-assets` 的英雄头像里该席位人口最高/费用最高的单位作头像，没有单位则用默认占位），更接近 TFT。

### 不做
- 不做聊天、历史战绩、回放导出。不改规则，不改房间流程、配对、结算。

### 验收
- [ ] 本地房间（`?mode=online`）与真服务器（`?server=ws`）下都能点开对手面板，内容与对方 `__CAT_DEBUG__.read().state.preparation` 上场单位一致（用两个浏览器上下文脚本断言）。
- [ ] 对方面板不含商店、金币、备战区；抓取 `view` 消息断言 `publicBoard` 无这些字段。
- [ ] 淘汰后不能发出任何命令，终局排名仍弹出。
- [ ] `npx vitest run tests/server` 全绿（投影新增测试）；typecheck、build、离线冒烟通过。

---

## 派工单 B5：房间接入共享有限卡池（按合同 §12）

分支：`claude/b5-shared-pool`，基于 `origin/multiplayer`（已含 TP PR #42）。**必须在 B4 合入之后开工**（B4 改了房间的结算与超时路径，B5 要在其上接池）。

### 依据
`docs/MULTIPLAYER_CONTRACT.md` **§12.1–12.5**（签名、初始化顺序、自然刷新、来源与淘汰、失败枚举）。TP 导出（经 `src/server-entry`）：`createSharedPool`、`initializeSharedSeat`、`refreshSharedShops`、`nextSharedRound`、`buySharedUnit`、`rerollSharedShop`、`setSharedShopLock`、`sellSharedUnit`、`runSharedMatchCommand`、`releaseSeatOnElimination`、`assertSharedPoolConservation`。

### 要做
1. **开局**：`createSharedPool(roomId, seed)` → 对八份未发布的 `createMatch(seed)` 按固定 `seatIndex` 0–7 逐席 `initializeSharedSeat` → `refreshSharedShops(pool, states, 1)` → 一次性发布（中途失败整体丢弃）。`RoomState.pool` 持有池，`poolRevision` 取 `pool.revision`。
2. **席位命令改走池事务**：`buy/reroll/shopLock/sell` 分别调 `buySharedUnit/rerollSharedShop/setSharedShopLock/sellSharedUnit`；成功同时提交 `pool + state`，失败两者都不变。其他命令（站位、装备、经验、异常目标）仍走原公开命令。
3. **可能发棋子奖励的路径统一用 `runSharedMatchCommand`**：开战（`startCombat`）、逐 tick（`step`，若房间在 resolver 外还会 step）、三选一（`choose`）、超时代选（`timeoutChoice`）、领奖（`claimLoot`）。B4 接的 `forfeitPendingChoice/claimOrDiscardLoot` 改为经这个包装。
4. **跨轮**：目录推进用 `nextSharedRound(pool, states, expectedRound)` 替代逐席 `nextRound`（它内部先统一归还未锁店再按轮换顺序生成）；加时轮同样走它（若 §12 对加时有特殊说明按合同）。
5. **淘汰**：排名计算后、下一轮自然刷新前，对每个本轮淘汰席位调用 `releaseSeatOnElimination`；重复调用拒绝即忽略。
6. **每次发布后在测试模式断言守恒**：`assertSharedPoolConservation(pool, states)`（生产可关闭，测试默认开）。
7. **投影**：`PlayerView` 不含池精确库存；本席商店的空格 `{status:'purchased', empty:true}` 原样下发，界面画为空格（`strategy-panel.ts` 已有已购格渲染，确认不会画出虚构英雄）。
8. 测试 `tests/server/shared-pool-room.test.ts`：八席开局守恒；两席争最后一份不超卖；付费刷新 `pool-empty` 免费失败且 generation 不变；淘汰归还一次；整局（placeholder 与 two-sided 各一）跑完后守恒成立；失败命令后 `poolRevision` 不变。

9. 顺手：`tests/server/e2e/ws-two-contexts.mjs` 等排名的时限按真实 PvP 整局（约 25 分钟）放宽，或给脚本加 `--rounds=N` 只验证到第 N 轮后退出。

### 不做
- 不碰 `src/simulation/`、`src/server-entry/`；规则缺口写 SR-B5-xx。不改网络协议形状（空格标记是现有 `ShopSlot` 兼容形状）。

### 验收
- [ ] `npx vitest run tests/server tests/tp-* tests/t3-*` 全绿；purity 零命中。
- [ ] 浏览器 `?mode=online` 整局：商店能出现空格、刷新缺货免费失败有提示、终局排名正常；离线冒烟通过。
- [ ] PR 描述把 §12.2 初始化顺序、§12.4 淘汰时点逐条对应到代码位置。

---

## 派工单 B6：机器人调度与断线接管（按合同 §13.3）

分支：`claude/b6-bot-driver`，基于 `origin/multiplayer`。**在 B5 合入之后开工**（机器人的买/卖/刷新/选择必须走 B5 接好的共享池入口）。

### 依据
`docs/MULTIPLAYER_CONTRACT.md` §13（T7 策略与 B6 编排，重点 13.3 的六条顺序和意图→入口对照表）。T7 导出（经 `src/server-entry`）：`decideBotAction`、`BotContext`、`BotDecision`、策略版本与 64 步上限常量。

### 要做
1. `src/server/room/bot-driver.ts`：每个机器人席位持有显式 `botRng`（开局由房间种子派生，独立于其他随机流）和 `stepsTaken`。在准备阶段与选择阶段，于单写队列中循环：读当前 state → 构造 context（含 `lastFailure`）→ `decideBotAction` 一次 → 保存返回 rng、`stepsTaken++` → 按 §13.3 表执行（买/卖/刷新/锁店/选择走共享池入口，其余走原公开命令）→ 成功一次性提交 pool+state，失败回传 `lastFailure` 后 basic 会返回 done。每席每轮上限 64 步；`done` 后本轮不再调用。
2. 节奏：机器人动作不要在截止前一瞬间全部发生；用注入时钟把每席的步骤分散在准备窗口内（例如每 300 ms 一步，可配置），测试用 `ManualClock`。
3. **断线接管**：真人 `connected=false` 超过 `takeoverMs`（默认 60 s，可配置）后，由机器人临时接管该席（复用原 MatchState、池、资产，不新建）；本人凭证重连后立即撤销机器人执行权限与排程，正在执行的那一步以控制代次拒绝。任何时刻一个席位只有一个控制者。`SeatPublic` 增加 `controller: 'human' | 'bot' | 'takeover'` 供界面显示"机器人接管中"。
4. 队列超时自动开局、人数不足补位机器人、全 8 机器人整局都走这条驱动。
5. 测试 `tests/server/bot-driver.test.ts`：全 8 机器人整局在 `ManualClock` 下 60 秒内跑到唯一排名且每步命令都被规则接受；1 真人（空操作）+ 7 机器人整局；每席每轮 ≤64 步；同输入同机器人行为；断线 → 接管 → 重连撤销的控制权顺序；机器人在冻结/战斗阶段不发准备操作；机器人失败后本轮 done 不重试。
6. 界面：右栏"机"标记区分补位机器人与接管中；状态栏在本人被接管期间重连后显示"已接回席位"。

### 不做
- 不改策略内容（`src/simulation/bot/` 归 Codex）；不碰网络协议之外的 `messages.ts` 形状（只加 `controller` 字段）。

### 验收
- [ ] `npx vitest run tests/server` 全绿，整局机器人用例 < 60 s；purity 零命中。
- [ ] 浏览器 `?mode=online` 默认：七个机器人会买卡、上场、升星，右栏头像随之变化；整局到排名。
- [ ] 真服务器两浏览器：一方断线 60 s 后显示接管，重连后恢复控制。

---

## 派工单 B7：接入 T5R（加时入口、私有投影、紧凑回放的服务器侧）

分支：`claude/b7-projections`，基于 `origin/multiplayer`（已含 T5R PR #46、B4）。可与 B5 并行；两者都改 `src/server/room/room.ts`，先合入的为准。

### 依据
`docs/MULTIPLAYER_CONTRACT.md` **§11.5 + T5R 补充的入口签名（加时）、§14.1（私有投影）、§14.2/14.3（回放）**。T5R 导出（经 `src/server-entry`）：`advanceMultiplayerRound`、`toPrivateSeatView`、`toCombatViewState`、`toCombatReplay`、`applyCombatReplayTick`、`COMBAT_REPLAY_KEYFRAME_INTERVAL`。

### 要做
1. **加时**：`Room.advanceRound` 的 `nextRound` 换成 `advanceMultiplayerRound`（B5 合入后对已绑池席位走 `nextSharedRound`，以合同为准）；删除 `commitPending` 的 `overtime-unavailable` 中断；6-7 后 ≥2 席存活进入 `overtime-N`，直到 ≤1 席。`roundName` 显示"加时 N"。测试：8 席全空阵容的整局必须在有限轮内结束（连续平局各自扣血）。
2. **私有投影**：网络 `state` 消息（首发、增量、重连快照、失败回执附带的）全部改送 `toPrivateSeatView(state)`；`LocalRoomClient` 同样走投影，保证本地与网络一致。`messages.ts` 的 `state` 载荷类型改为 `PrivateSeatView`。抓包测试断言 `rngState`、`battleSeedRngState`、`choiceRngState`、`rewardRngState`、`resourceProvenance`、`combatInputBasis`、`m8.loot.frozen` 等不出现。
3. **紧凑回放**：服务器对每场战斗生成一次 `toCombatReplay`（按 battleId 缓存），新增 `replay` 消息下发；B 视角按 §12.6/§14.2 镜像（首末/关键帧的 `cell/startingCell`、`movement.from/to`、`cast.completionCell`、`unitUpdated` 差分里的坐标）。**旧 `combat` 帧消息保留并默认继续发送**，加服务器选项 `combatTransport: 'frames' | 'replay' | 'both'`（默认 `both`），C6 切换客户端后再改默认为 `replay` 并删帧。
4. 投影也应用到 `fault` 快照和观战视图（淘汰后仍收 `view` 与 `replay`，不再收 `state`）。
5. 测试 `tests/server/projection-wire.test.ts`：三种 `state` 路径都无私有字段；`replay` 消息 B 视角镜像正确（取一场 PvP 对比 A/B 的 `initial` 坐标）；`replay` 体积 < 对应 `combat` 帧体积的 5%；加时整局测试。

### 不做
- 不改客户端的战斗渲染（C6）；不碰 `src/simulation/`、`src/server-entry/`。

### 验收
- [ ] `npx vitest run tests/server tests/t5r-*` 全绿；purity 零命中。
- [ ] 浏览器 `?mode=online` 与 `?server=ws` 仍能用旧帧播放整局（默认 `both`）；离线冒烟通过。
- [ ] PR 描述给出 `replay` 与 `combat` 实测体积对比，以及 C6 需要的客户端接入点。

---

## 派工单 C6：客户端改用紧凑回放播放战斗（CombatViewState 渲染）

分支：`claude/c6-replay-client`，基于 `origin/multiplayer`（B7 PR #49 与 SR-B7-01 修复 PR #50 均已合入，可以开工）。

补充（2026-10-12 晚）：PR #50 把当前 PvE 的 `m8.preparation.{roundId,encounterId,enemies}` 和 `roundResults[].interestBasis` 加进了私有白名单；`src/rendering/online/seat-view-adapter.ts` 现在仍把 `m8.preparation` 清空，请一并接入，让 PvE 准备阶段重新显示野怪站位、收入明细显示利息基数（SR-B7-02 客户端侧）。

### 依据
合同 §14.2 的播放规则：从 `initial` 开始按 tick 顺序，先播放动画事件，再按 `unitUpdated` 差分覆盖，有 `keyframe` 整体替换；`applyCombatReplayTick` 已实现状态部分。

### 要做
1. `RemoteSession.receiveReplay(replay)`：以 `initial` 为当前战斗视图，`advance(delta)` 每 50 ms 推进一个 tick（调 `applyCombatReplayTick`），把该 tick 的动画事件作为"事件"交给 BoardScene 现有的 `showEvents`/反馈渲染（事件形状是白名单子集，缺失字段按可选处理）。
2. BoardScene / `unit-view` / `combat-feedback` / `stats-panel` 从 `CombatState` 改为读 `CombatViewState`（字段名一致、只少了内部字段）；统计面板只用白名单字段能算的部分，算不出的隐藏。`session.combat` 的类型相应改为视图类型（离线模式把 `CombatState` 经 `toCombatViewState` 转一次即可，保证两条路径同一渲染代码）。
3. `WsGameClient` 与 `LocalRoomClient` 改为消费 `replay`，不再消费 `combat` 帧；服务器 `combatTransport` 默认改为 `replay`，删除帧生成与分包代码及其测试。
4. 回放速度：保留 1x；战斗开始前有一次"开战"过渡，结束后停在 `terminal` 直到服务器推送结算状态。页面隐藏后返回：跳到 `terminal`。
5. 测试：`tests/server/replay-client.test.ts`（无 DOM）：逐 tick 应用后末视图与 `terminal` deepEqual；关键帧覆盖；B 视角坐标镜像。Playwright：本地房间与真服务器各跑到第 3 回合，战斗期间单位血条随回放变化、无报错；离线整场战斗渲染与之前一致（截图对比可选）。

### 不做
- 不碰 `src/simulation/`、`src/server-entry/`、房间流程。

### 验收
- [ ] 整局下发体积相比帧方案下降 ≥90%（PR 写实测数）；`combat` 帧代码已删。
- [ ] 离线与联机两条路径共用同一渲染代码；typecheck、build、`tests/server`、会话/B8 测试通过。

---

## 派工单 B8：服务器连局后的资源释放（T9 压测发现）

分支：`claude/b8-room-lifecycle`，基于 `origin/multiplayer`（含 T9 PR #47 的压测脚本）。可在 B7 之后、C6 之前做，也可与 C6 并行。

### 现象
`node scripts/loadtest-room.cjs --seats 2 --rounds 3`：三局结束后进程 RSS 569 → 610 → 670 MiB 严格递增；第三局准备命令 RTT p99 约 1 s。见 `docs/MULTIPLAYER_RELEASE_NOTES.md` 第 9 节。

### 要做
1. 用 `--inspect` 或 `v8.writeHeapSnapshot` 对比两局结束后的堆，找出上一局残留的引用。重点怀疑：`Lobby.current` 旧 `Room` 未置空、`Room` 的定时器/监听未取消、`net/session` 旧凭证与 `dedupe` 窗口未随新局清理、战斗帧或回放缓存按 battleId 累积、`RealClock.timers` 泄漏、每局的 `RoomState.battles`/`settlements` 整段保留。
2. 新局开始时明确 `dispose()` 上一局（取消定时器、清空缓存、吊销旧凭证），并在 `Room` 结束后释放逐 tick 帧（只保留结算所需的 `terminal` 与事件计数）。
3. RTT p99 1 s：确认是不是战斗计算占满单线程导致准备命令排队（T2 真实战斗在准备截止时同步算 4 场）。若是，把"算战斗"移出单写队列的关键路径：先冻结输入，异步算完再入队提交（仍保持单写）；不引入 worker 线程池（T9 后再评估）。
4. 测试：`tests/server/lifecycle.test.ts` 用 `ManualClock` 连跑 5 局，断言活动定时器数、缓存条目数、凭证数在每局结束后回到基线；`loadtest-room.cjs --seats 2 --rounds 3` 重跑，PR 写出前后 RSS 曲线与 p99。

### 不做
- 不改规则、不改协议形状。

### 验收
- [ ] 连跑 3 局 RSS 不再单向增长（允许 ±10%）；准备命令 p99 明显下降并写明数值。
- [ ] `npx vitest run tests/server` 全绿。
