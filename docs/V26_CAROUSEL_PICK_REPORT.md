【完成】

基线：`claude/v26-carousel-pick` / `4baaaf5a9a74335d46fa0e037a93e4e595f05384`。按 2026-10-28 已批准的四条执行；没有写 Git index、提交、素材或纪元证据。

- `src/server/legend-motion.ts:74`：唯一拾取半径 `CAROUSEL_UNIT_PICK_RADIUS = 0.55` 格；`carouselWalkContact` 包含起点、移动中及终点后的旋转接触。移动段沿用 10 ms 采样、24 次二分，静止段解析求圆周最早进入时刻。
- `src/server/room/room.ts:1037`：服务器规划及复核接触，通过原有注入时钟和 `LegendWalkBook.contacts` 调度。地面路线不改目的地，先接触哪个未取槽就拿哪个；2D 卡片请求保留服务器一次拦截规划，只对所点槽接触领取。重定向、成功领取、选秀退出和 dispose 清理计时器，领取后可继续走。
- `src/server/room/room.ts:505`：新增玩家入口 `handlePlayer`，联机和本地共同使用；直接 `carousel-pick` 返回既有 `wrong-phase`，不改 state/pool/RNG/事件。`handle` 保留为服务器内部可信编排/规则测试入口，玩家传输不再调用它。
- `src/rendering/online/local-room-client.ts:139`：补 `walk`、路线推送、重新监听补发及退订；`src/rendering/online/online-application.ts:386` 将 2D 卡片改成 `client.walk({scene:'carousel',slot})`，移除 `RemoteSession.carouselPick`。
- `src/rendering/three-mode/placeholder-renderer.ts:1323`：点击棋子和地面都发送固定地面坐标，不再发送槽或回退直接选。`carousel-stage.ts:194` 可选圈读取共享半径；删除 `runTo`、pending 追逐和 chase 状态。
- `src/rendering/three-mode/placeholder-renderer.ts:1153`：选秀持续状态独立于当前显示哪一侧；切回棋盘仍隐藏己方/对战方及侦察双方小小英雄，退出选秀恢复己方原位置。小地图原本只画阵容点，不画小小英雄，无需新增隐藏逻辑。
- `docs/MULTIPLAYER_CONTRACT.md:2023`：同步调用签名、输入输出、失败原因和 v26 接触约定。`src/simulation/` 原子领取、机器人评分、事件形状及内容身份均未改。

全部应用调用点（包含保留入口、传输和领域边界）：

| 路径 | 文件:行 | 当前行为 |
| --- | --- | --- |
| 联机旧直接选消息 | `src/server/net/messages.ts:280` → `net/server.ts:732` → `room/room.ts:505` | 旧消息保留解析，凭证/信封通过后在 `handlePlayer` 拒绝；不会进规则领取 |
| 联机行走 | `src/rendering/online/ws-client.ts:199` → `src/server/net/messages.ts:317` → `net/server.ts:752` → `room/room.ts:1037` | 凭证决定 seat，位置取服务器保留路线，不信客户端选秀起点 |
| 联机行走广播/重连 | `src/server/net/server.ts:523`、`:695` | `subscribeWalks` 广播；resume 补发保留路线 |
| 本地直接命令 | `src/rendering/online/local-room-client.ts:127` → `room.handlePlayer` | 与网络同门，直接选也拒绝 |
| 本地行走/补发/退订 | `local-room-client.ts:139`、`:85`、`:160` | `walkLegend`；`listeners.legend(walk,serverNow)`；detach 退订 |
| 2D 卡片 | `src/rendering/online/carousel-panel.ts:260` → `:178` → `online-application.ts:131`、`:386` | 点卡片只发 `walk {scene,slot}`；发出时不领取，接触后以房间投影确认 |
| 2D 服务器代走 | `src/server/room/room.ts:1066` → `src/server/legend-motion.ts:64` | 仅此路径使用 `interceptCarouselUnit`，规划一次直线，没有客户端追逐 |
| 3D 鼠标/短触摸 | `src/rendering/three-mode/placeholder-renderer.ts:1323`、`:1387` → `carousel-stage.ts:747` | 两键或短触摸转地面坐标 `to`；长按查看仍保持 450 ms |
| 3D 控制桥/路线显示 | `online-application.ts:134`、`:161` → `src/rendering/board-feed.ts:132` → `placeholder-renderer.ts:1189` → `carousel-stage.ts:767` | 转发房间路线；没有 `runTo`、pending 自追或直接选回退 |
| 统一接触及原子领取 | `src/server/room/room.ts:1078`、`:1088`、`:1015` → `src/simulation/carousel.ts:331`、`:339` | 接触时再验当前距离、槽占用和路线身份，调用 `pickCarouselForSeat` → `pickFromCarousel`，仍原子发布 |
| bot / takeover / 离线 / 超时 | `src/server/room/room.ts:938`、`:954` → `src/simulation/carousel.ts:347`、`:352` | `catchUpCarousel` 调 `autoPickCarouselForSeat`；bot/托管按放行，离线和闲置真人按截止兜底，不走人的直选入口 |
| 选秀存在/隐藏 | `online-application.ts:371` → `board-feed.ts:204` → `placeholder-renderer.ts:1154`、`:1184` → `tabletop.ts:574` / `scout-stage.ts:259` | `active=true` 时棋盘侧也隐藏小小英雄；小地图 `online/scout-minimap.ts:30` 只画阵容点 |
| 计时器归属/清理 | `src/server/room/legend-walk.ts:42`、`:59`、`:61`；`room.ts:1100`、`:1908`、`:1935` | 新路线、成功拾取、选秀结束及 dispose 清理，不用新增真实时钟 API |
| 旧类型/内部派发 | `src/server/protocol.ts:270`；`src/server/room/room.ts:557` | 供兼容解析及可信内部编排保留，网络/本地玩家均被上面的入口挡住 |

可信规则测试保留直接调用，不改其断言：`tests/server/carousel-room.test.ts:30`，`tests/server/batch5-r6-pandora-room.test.ts:105`，`tests/server/batch5-r6-recombobulator-room.test.ts:98`、`:168`，`tests/augment-pool-batch5-h5-priority.test.ts:54`、`:55`、`:59`、`:62`，`tests/augment-pool-batch5-h7-health.test.ts:109`、`:113`、`:116`。`tests/server/t10-combat-ops.test.ts:46` 的内部命令门断言及 `carousel-room.test.ts:510` 的兼容解析断言也原样保留；新增真实 WebSocket 用例另证玩家入口拒绝。

【测试】

全部测试命令均带 `--maxWorkers=4`；只选相关文件或用例，没有提高任何旧 timeout、预算、节流或误差阈值。0.25 → 0.55 是已批准的产品判定半径。

- 服务器：`legend-walk.test.ts`、`carousel-room.test.ts`、`local-room-client.test.ts` 首批 40/40；本地生命周期新增用例在最终补跑通过。
- 表现/隔离：`rendering3d-carousel.test.ts`、`rendering3d-scout-input.test.ts`、`rendering3d-tabletop.test.ts`、`rendering3d-scout.test.ts`、`scout-minimap.test.ts`、`rendering3d-isolation.test.ts` 首批 70/70；选秀存在状态新增用例在最终补跑通过。
- 定向 timing：`npx vitest run --project timing tests/server/local-room-client-full-match.test.ts -t 'opens the 2-4 carousel through the client' --maxWorkers=4`，1/1 通过；961 条不相关全局路线用例按过滤跳过，没有运行整场压测。
- 最终补跑：本地客户端、3D 输入、3D 选秀及真实生产包隔离共 46/46。去重合计 **113 个相关用例通过**。
- `npm run typecheck`、`npx vite build --configLoader runner`、三个修改后的 e2e `.mjs` 的 `node --check`、`git diff --check` 通过。
- 生产体积：顶层 `dist/assets/*.js` 逐文件 gzip-9，仓库门禁所用 Node/zlib 为 **630,507 B**，距 637,144 余 **6,637 B**；GNU `gzip -n -9c` 同文件为 **626,255 B**。既有体积及动态依赖隔离断言通过，未改打包配置或排除口径。
- 环境的 `node_modules` 是只读链接，默认配置打包写 `.vite-temp` 失败后改用 `--configLoader=runner`。本轮节点测试使用 `--config artifacts/v26-carousel/vitest.node.config.ts`：保留原 projects/setupFiles/断言/时限，只省去不使用的浏览器 globalSetup，并把缓存放 `/tmp`。日志和生产体积在 `artifacts/v26-carousel/`，不提交。

新增覆盖：精确 0.55 边界/圈外、约 0.6101007166 格间隙、穿过旋转间隙不拿、站定后旋转碰撞领取、重定向取消静止碰撞、网络直选无副作用及行走后唯一领取、本地转发/补发/退订、3D 点棋子发地面坐标、走路发送失败不直选回退、pending 不追逐、共享可选圈几何、选秀棋盘侧与侦察双方隐藏及恢复。原有争抢先到者获胜、改道取消、一次领取、拾取后不回家且可继续移动、账本和池守恒断言保留通过。

旧断言替换清单（逐项供送审；下列旧行号以 `4baaaf5a` 为准）：

| 旧文件:行 / 断言 | 新断言及原因 |
| --- | --- |
| `tests/server/legend-walk.test.ts:214`，`walk(0.6)` 不接触 | 同一条路线改断言会接触；新增 `walk(1.0)` 圈外不接触，以及精确 0.55 边界/0.550001 圈外。批准半径变大，保留原输入，未放宽测试容差 |
| 同文件 `:219`，距离等于旧 0.25 常量 | 改为等于共享 0.55 常量，仍 `toBeCloseTo(...,6)`；原零时长且远离圈的空结果断言保留，新增站定被碰到断言 |
| `tests/rendering3d-carousel.test.ts:386`，pending 后 `:chase` | 改为不得追逐；新增 pending 4 秒位置不动、无领取，真实输入另验固定 `to` |
| 同文件 `:387`，pending 后地面走路为空 | 改为允许地面改道，配合房间旧计时器取消/静止取消断言；自动追逐已获准删除 |
| 同文件 `:398`，领取后 `runTo(1)===false` | 断言 API 已移除且 `fetched` 仍为原已领槽；保留领取后可走和原 carry 断言；房间 `already-picked` 断言原样保留 |
| 同文件 `:487`，未放行 `runTo(4)===false` | 改为未放行 `walkTo(...)===null`，保留锁席不能移动的约束 |
| 同文件 `:489`，放行后 `runTo(4)===true` | 改为放行后固定地面 `walkTo(...)` 成功，取消被批准删除的追棋子 API |
| 同文件 `:490`，放行后立即 `:chase` | 改为固定地面 `:walk`；原服务器路线接管的 `:walk` 断言保留 |
| 同文件 `:547`，领取后再次 `runTo` 失败 | 改为 API 不存在、原已领槽仍唯一；原服务器接线、拖带、继续地面走断言保留 |
| 同文件 `:555`，槽被投影剪掉后仍不能 `runTo` | 改为 API 不存在且再过 1 秒未确认槽不会本地领取；原地面走路仍允许；服务器收据依然保证不可二领 |
| `tests/rendering3d-scout-input.test.ts:131`，触摸短按发送 `{slot:0}` | 改为只发送地面 `{to:{x,y}}` 且无 slot；原 450 ms 长按只查看、不走路断言保留 |
| `tests/server/local-room-client-helper.ts:168`，早发直选 `seat-locked` | 改为所有直选统一 `wrong-phase`；额外断言早发行走拒绝、无保留路线，原 revision/state 推送不变断言保留 |
| 同文件 `:177`，过期直选 `stale-carousel` | 玩家入口改为 `wrong-phase`；把同一 `stale-carousel` 断言保留在可信内部 `room.handle`，不删除规则版本校验 |
| 同文件 `:179`，正确直选立即成功 | 替换为 walk 被接受、发布路线、state 引用不变且未领取；推进接触计时器后原所点槽/receipt/装备/放置/守恒断言继续执行 |
| 同文件 `:187`，重复直选 `already-picked` | 直选仍统一 `wrong-phase`；另断言房间再走向卡片返回原 `already-picked`，保留一次领取限制 |
| `tests/server/e2e/p7-carousel.mjs:221`，点击得到 `applied` 直选 receipt | 替换为确实发送 carousel walk 且服务器投影确认接触领取；既有后续所属槽、临时位、装备及出售后落位检查保留 |
| 同文件 `:223`，直选携带 carouselId/revision/slot | 替换为认证 walk 信封带 scene/slot、无 seatId，并断言完全没有 `carousel-pick`；沿用原 5,000 ms 单次等待和 3 次上限 |
| `tests/server/e2e/c19-full-match.mjs:569`、`:575`、`:584`，等待直选 receipt/applied 再确认 | 改为 walk + 接触后的房间投影 `contact-granted` 且无直接选；所属槽、单位、装备落位检查保留，原 5,000 ms 等待/3 次重试上限不变 |

【需要重录】

1. **必须刷新 v25 的消费者字节审计** `docs/evidence/v25-online-rules/consumer-byte-audit.json`：只读比对已确认本次 7 个修改测试/适配文件的当前 SHA 与旧审计不符。执行端完成送审后可跑 `node scripts/audit-v25-online-rules-adaptations.cjs`，再跑 `node scripts/verify-v25-online-rules-epoch.cjs --write` 刷新汇总并验证其余证据；本轮没有写这些证据或运行整套纪元。
2. v25 的领域路线夹具未因本次产生已知轨迹变化：simulation/内容 digest/事件格式未变，现有纪元 room 脚本不发真人直接选命令。无需仅为服务器交互版本 v26 伪造新的 simulation content/rules identity。仓库当前没有 v26 纪元录制器；若发布流程要独立 v26 纪元，应新增交互验证/适配字节证据，再按同一入口重录，不能把旧 v25 证据默认为新树验收。
3. p7/c19 浏览器验收脚本已适配 walk，**需要执行端重跑并重存相应 e2e 结果**。本轮没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按用户提供的浏览器约束，应由 Claude 用 `codex-browser exec` 新启测试任务；此处没有用全权限或自行启动浏览器替代。
4. 调查报告关于“纪元检查比对所有受控字节”需区分：`v25-epoch-report.cjs` 的全文件快照用于证明检查前后工作区未被改写；实际当前适配字节匹配由 `audit-v25-online-rules-adaptations.cjs` 检查。因此确需刷的是消费者字节证据及汇总，不能仅因 src 文件变更就宣称所有规则 golden 必须重录。

【需要我决定】

无新增玩法决定。以上旧断言替换清单供执行端送审；四项已批准玩法已实现。未提交。

【风险】

浏览器 p7/c19 真机结果及重新录制的纪元汇总尚待执行端补齐，当前通过的是节点/真实 WebSocket/本地房间和生产构建隔离测试。旧客户端若仍直接发 `carousel-pick` 会收到 `wrong-phase`，需配套本次客户端发布。内部 `Room.handle` 是可信 API，后续新增玩家传输必须沿 `handlePlayer` 接入。
