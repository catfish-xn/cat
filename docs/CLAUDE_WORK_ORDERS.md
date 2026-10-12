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
