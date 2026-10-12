# 八人联机首版：发布与单房压测说明

本说明的目标是 **Linux、4 核 / 8 GB、Node 22.x、同一时间一局**。它是部署操作手册和验收记录模板；执行发布、域名切换及最终合入 main 由用户决定。本次只交付脚本和文档，不执行部署。

基线：`origin/multiplayer@3785d96`，规则侧 T1/T2/T3/TP/T7/T5R 已合入。此时 B5 有限卡池、B6 机器人调度、B7 私有投影/加时接线与 C6 回放客户端仍待接入验收。**该基线可用于隔离测试，不是已经具备公网发布条件的候选**，尤其现有网络仍可能发送完整 MatchState。压测不会替它接入缺失功能，也不会将占位机器人说成已实现基础策略。

## 1 先准备什么

- 一台 Ubuntu 22.04 / 24.04 LTS 主机，4 核、8 GB 内存，普通管理员账号可以执行 sudo。
- 一个域名，例如 `play.example.com`，其 DNS A（使用 IPv6 时另有 AAAA）指向主机；开放入站 TCP 80、443。8787 只在本机监听。
- 用户已验收的**固定提交 SHA**，必须来自 multiplayer 集成线，不能拿持续变化的分支当发布包。下文将 `填入已批准的完整提交SHA` 换成该 SHA，将示例域名换成自己的。
- 最终发布前，先完成第 8 节真人验收清单；现有 `/cat/` 单人正式站点保持原部署，直到用户另行批准替换。

以下 shell 命令在目标机终端执行；看到错误应先停下处理，不能跳过构建或把缺失文件当成成功。

## 2 安装 Node 22 与构建候选

### 2.1 安装 Node 22（独立安装目录，供 systemd 使用）

```bash
set -e
sudo apt-get update
sudo apt-get install -y curl git xz-utils ca-certificates
mkdir -p "$HOME/cat-node-install"
cd "$HOME/cat-node-install"
case "$(uname -m)" in
  x86_64) CAT_NODE_ARCH=x64 ;;
  aarch64) CAT_NODE_ARCH=arm64 ;;
  *) echo '此步骤只列出 x64 / arm64，请先确认架构'; exit 1 ;;
esac
curl -fsSLO https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
CAT_NODE_ARCHIVE=$(awk -v suffix="linux-${CAT_NODE_ARCH}.tar.xz" '$2 ~ (suffix "$") {print $2}' SHASUMS256.txt)
test -n "$CAT_NODE_ARCHIVE"
curl -fsSLO "https://nodejs.org/dist/latest-v22.x/$CAT_NODE_ARCHIVE"
sha256sum --ignore-missing -c SHASUMS256.txt
sudo mkdir -p /opt/node22
sudo tar -xJf "$CAT_NODE_ARCHIVE" -C /opt/node22 --strip-components=1
export PATH="/opt/node22/bin:$PATH"
node --version
npm --version
```

`node --version` 必须显示 `v22.*`（仓库最低 22.12），记录实际输出。已有 nvm/fnm 的构建机也可以 `nvm install 22 && nvm use 22`；不要为本项目切换到 24。systemd 不会读取交互终端的 nvm 配置，因此生产服务用 `/opt/node22/bin/node` 的绝对路径。

### 2.2 构建（这一阶段需要开发依赖）

```bash
export PATH="/opt/node22/bin:$PATH"
mkdir -p "$HOME/cat-build"
cd "$HOME/cat-build"
git clone https://github.com/catfish-xn/cat.git source
cd source
git fetch origin multiplayer
CAT_RELEASE_COMMIT=填入已批准的完整提交SHA
git checkout --detach "$CAT_RELEASE_COMMIT"
npm ci
npm run build:game
npm run build
node --check dist-server/game/main.mjs
```

第一次 clone 后，后续发布复用 `source` 目录，从 fetch 开始。`npm run build:game` 生成 `dist-server/game/main.mjs` 与 Node 测试客户端；`npm run build` 生成 `dist/` 静态前端。不要使用 Pages 的构建模式部署到本说明的域名根路径。

**构建顺序不能颠倒：** esbuild、TypeScript、Vite 是 devDependencies；先执行 `npm ci --omit=dev` 会让 build:game/build 缺工具。生产启动使用已构建文件，不运行 `npm run serve:game`（它会重新调用 esbuild）。

Node 服务构建的外部运行包为 **ws**，其余是 Node 内置模块；Phaser 只用于前端构建/静态包。仓库 package.json 同时将 `ws` 和 `phaser` 列为 dependencies，所以用根锁文件执行 `npm ci --omit=dev` **仍会安装 Phaser**，不能说它只安装 ws。保留这份锁文件可复现安装，不在本任务拆分部署专用 package.json；安装的 Phaser 不会被服务器入口加载。

## 3 安装发布目录与 systemd 服务

### 3.1 创建账户、复制已构建候选

```bash
id catgame >/dev/null 2>&1 || sudo useradd --system --user-group --home-dir /srv/cat --shell /usr/sbin/nologin catgame
CAT_RELEASE_ID=$(git rev-parse HEAD)
CAT_RELEASE_DIR="/srv/cat/releases/$CAT_RELEASE_ID"
test ! -e "$CAT_RELEASE_DIR"
sudo mkdir -p "$CAT_RELEASE_DIR/dist-server"
sudo cp -a dist "$CAT_RELEASE_DIR/"
sudo cp -a dist-server/game "$CAT_RELEASE_DIR/dist-server/"
sudo cp package.json package-lock.json "$CAT_RELEASE_DIR/"
sudo chown -R catgame:catgame "$CAT_RELEASE_DIR"
sudo -u catgame env PATH="/opt/node22/bin:/usr/bin:/bin" npm ci --omit=dev --cache /tmp/catgame-npm-cache --prefix "$CAT_RELEASE_DIR"
```

现在该版本目录同时包含 `dist/`、`dist-server/game/`、锁文件与运行依赖。**不要覆盖旧版本目录**；后续回滚需要旧目录中的服务端、前端和 node_modules 一起保留。

### 3.2 配置环境变量

创建配置目录，用 `sudo nano /etc/cat/game.env` 编辑：

```bash
sudo mkdir -p /etc/cat
sudo nano /etc/cat/game.env
```

粘贴以下内容并保存：

```ini
NODE_ENV=production
CAT_HOST=127.0.0.1
PORT=8787
CAT_SEED=20261012
CAT_PREP_SEC=30
CAT_CHOICE_SEC=30
CAT_SETTLE_SEC=6
# CAT_QUEUE_TIMEOUT_SEC=30
```

| 变量 | 默认值与意义 |
| --- | --- |
| PORT | 8787；优先于 CAT_PORT |
| CAT_PORT | 8787；PORT 未设置时作为后备；建议只设置 PORT |
| CAT_HOST | 127.0.0.1；本说明保持本机绑定，由 Caddy 对外提供 WSS |
| CAT_SEED | 20261012；合法 uint32，复现压测时可用42；不是登录密钥 |
| CAT_PREP_SEC | 30；准备阶段秒数 |
| CAT_CHOICE_SEC | 30；选择阶段秒数 |
| CAT_SETTLE_SEC | 6；结算阶段秒数 |
| CAT_QUEUE_TIMEOUT_SEC | 不设置时等待任意排队玩家点开始；设置后首位入队开始倒计时 |
| NODE_ENV | production；常规进程环境，不改变规则数值 |

生产入口要求非负整数秒，不能照抄压测的 0.25 秒。战斗播放时间根据战斗 tick 数再加尾部等待确定，不属于这三个配置。浏览器 URL 上的 `prep/choice/settle/seed` 只作用于 local-room 调试模式，不能改变 WS 服务器配置。

### 3.3 systemd 单元

执行 `sudo nano /etc/systemd/system/cat-game.service`，粘贴：

```ini
[Unit]
Description=Cat single-match WebSocket server
After=network.target

[Service]
Type=simple
User=catgame
Group=catgame
WorkingDirectory=/srv/cat/current
EnvironmentFile=/etc/cat/game.env
ExecStart=/opt/node22/bin/node /srv/cat/current/dist-server/game/main.mjs
Restart=on-failure
RestartSec=3
TimeoutStopSec=20
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
LimitNOFILE=4096
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**首次启用**（沿用 3.1 终端中的 CAT_RELEASE_DIR）：

```bash
sudo ln -s "$CAT_RELEASE_DIR" /srv/cat/current
sudo systemctl daemon-reload
sudo systemctl enable --now cat-game
sudo systemctl status cat-game --no-pager
sudo journalctl -u cat-game -n 50 --no-pager
```

看到 `listening on ws://127.0.0.1:8787` 表示服务已监听。日志在 journald：`sudo journalctl -u cat-game -f` 实时查看。服务器不提供 HTTP /health；不要把 HTTP curl 返回空响应当成联机成功，接下来用网页或 Node WebSocket 客户端验证。

## 4 Caddy：静态前端、HTTPS 和 /ws

```bash
sudo apt-get install -y caddy
sudo nano /etc/caddy/Caddyfile
```

用自己的域名替换第一行：

```caddyfile
play.example.com {
    handle /ws {
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        root * /srv/cat/current/dist
        encode zstd gzip
        try_files {path} /index.html
        file_server
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 50 --no-pager
```

Caddy 自动处理 WebSocket Upgrade 与 TLS 证书；后端仍是本机明文 ws。前端 URL 使用：

`https://play.example.com/?mode=online&server=ws`

两个参数都需要：`mode=online` 进入联机界面；`server=ws` 连接真实服务器。页面在 HTTPS 时默认连接 **`wss://同一域名/ws`**，与上面的路径完全对应。没有 `server=ws` 时默认走浏览器内的 local-room；不能用这个模式证明公网联机成功。调试异域服务可附加 URL 编码后的 `ws=wss%3A%2F%2F...`，正式部署建议保持同源。

用两台电脑打开上述 URL，确认看到同一队列和相同战局。单台浏览器的动画顺畅不等于八席服务器压测通过，反过来也一样。准入控制由用户在网页入口另行部署；本仓库没有账户、登录或邀请机制，此 Caddy 示例本身不增加这些功能。

## 5 停止、更新与回滚

正常更新先停止新的准入，等当前对局结束，再停止服务：

```bash
sudo systemctl stop cat-game
```

`SIGTERM` 会关闭连接；未完成的局没有跨进程保存，重启不能恢复旧座位凭证。先按第 2–3.1 节安装**新 SHA 的独立版本目录**，再切换（不要删除旧目录）：

```bash
sudo ln -sfn "$(readlink -f /srv/cat/current)" /srv/cat/previous
sudo ln -s "$CAT_RELEASE_DIR" /srv/cat/current.next
sudo mv -Tf /srv/cat/current.next /srv/cat/current
sudo systemctl start cat-game
sudo systemctl status cat-game --no-pager
```

Caddy 通过 current 读取新静态文件，客户端需要刷新网页，确保前后端版本一致。确认日志、两席连接/操作/结算正常后再恢复准入。

如果新版本异常，回滚整个发布目录（包含原 `dist-server/game`、前端和依赖）：

```bash
sudo systemctl stop cat-game
CAT_PREVIOUS_DIR=$(readlink -f /srv/cat/previous)
test -f "$CAT_PREVIOUS_DIR/dist-server/game/main.mjs"
sudo ln -s "$CAT_PREVIOUS_DIR" /srv/cat/current.rollback
sudo mv -Tf /srv/cat/current.rollback /srv/cat/current
sudo systemctl start cat-game
sudo journalctl -u cat-game -n 50 --no-pager
```

不要只替换一份 JS 或用旧前端连接新协议。回滚也会中断旧局，玩家刷新后重新匹配；不要给中断局编造名次或补发奖励。清理历史版本时至少保留 current 与 previous 指向的两个目录。

## 6 单房压测怎么运行

在装有源码与 `npm ci` 开发依赖的 Node 22 环境运行。脚本会在系统临时目录打包测量入口，运行结束删除；不会改源码、根配置或自动写仓库报告文件。以下重定向文件由执行者明确指定。

```bash
nvm use 22                              # 或使用第2节的 /opt/node22/bin
node scripts/loadtest-room.cjs --help
node scripts/loadtest-room.cjs --seats 2 --rounds 3 > two-seat.json
node scripts/loadtest-room.cjs --seats 8 --rounds 3 > eight-seat.json
```

- `--rounds` 表示**完整对局数**，不是游戏内回合上限。默认先预热1局，再测3局；所有对局使用同一个服务器进程、服务器实例与单队列，前局必须有完整八席名次后才开下一局。正常关闭每局客户端，检查服务器连接数回到0。
- 始终建立8个 Node `TestClient` WebSocket 连接，由一个独立压测客户端进程驱动；`--seats 8` 全部入队，`--seats 2` 仅2个入队，其余6个连接停在大厅，6个参赛机器人由服务器补位。后者**不是八个真人接收战斗流**，不能冒充八席网络负载。
- `--ops 4` 默认每真人每游戏回合最多4个准备操作；按独立 lcg32 种子随机选择合法候选类型与目标，覆盖买卡、卖卡、刷新、经验、站位、锁店及有素材时的合成/装备。只读取已显示资源，调用只读规则校验，不读取随机流来预测。选择节点另处理，最多16步。命令进入服务器时可能已过准备截止或版本变更，拒绝数量与原因照实记录；不能因为发出了意图就算成功。
- 默认 `--prep-sec 0.25 --choice-sec 0.10 --settle-sec 0.05 --playback-ms 20`。本地测量入口可注入毫秒时钟配置；20ms 仅截短**计算完成后的播放等待**，不减少战斗 tick、不跳过结算、不伪造结果。该模式测计算/传输/生命周期，不是正常节奏试玩。`--playback-ms real --prep-sec 30 --choice-sec 30 --settle-sec 6` 恢复普通等待口径，完整三局可能耗时较长。
- `--seed 42` 默认固定服务种子；行动种子随测量局和席位派生，具体配置写进报告。`--warmup 0` 可做快速诊断，但不用于预热后的内存判断。`--idle-ms 1000` 默认每局断开后等待1秒再读内存。`--timeout-sec 900` 是每局期限，失败输出 status=failed、非零退出码；不重启服务器继续掩盖失败。
- 连接已有专用测试服务：`node scripts/loadtest-room.cjs --url wss://测试域名/ws --seats 8 --rounds 3 > remote.json`。该模式不启动/更改服务器，不接受本地阶段时间选项。测试会加入并开始真实对局，应在用户指定的测试入口执行；不要对正在给玩家服务的队列运行。

### 测量字段与限制（V2 §8.2）

stdout 仅输出一个 JSON；进度在 stderr。每局都有 status、真实整局墙钟 durationMs、finalRound、排名、每回合字节及命令分布。warmups 单独列出，不混入 matches。

| 指标 | 本脚本口径 |
| --- | --- |
| preparationCommands.rttMs | 从调用 TestClient.command 到收到相同 commandId 的 receipt；毫秒，nearest-rank p50/p95/p99/max/mean 与样本数，成功/拒绝均计入；每轮也分别输出 |
| serverQueueMs | 已解码 ws message 被交给应用，到 WriteQueue 对应任务开始；此前 socket 解码或主线程阻塞无法单独观测，仍包含在 RTT/残差里 |
| serverProcessingToReceiptMs | 任务开始到 receipt JSON 已构造、交给 ws.send 前；含校验、规则调用、去重与收据序列化，不含后续压缩/发送及广播 |
| serverQueueAndProcessingMs | 上面两段合计；通过 seatId+commandId 对应到同一个请求，serverMatched 必须覆盖测得的准备命令 |
| transportAndSchedulingResidualMs | **RTT 减上述服务器段的残差**；包含传输、压缩、收发事件循环等待和客户端调度/解析，不能叫纯网络 RTT；networkOnlyMs 固定为 null。负值保留并计数，不截成0掩盖观测问题 |
| overlappingBattleCompute | 本机共同时间基准上，请求往返区间与真实 resolver 计算区间相交的数量；辅助解释临近截止时的大 RTT，不是客户端实际发出时的服务器阶段证明 |
| rounds[].battles | 每个真实 PvP 配对或单席 PvE 的 wallMs、进程 CPU user/system、roundId/battleId、参与席数、镜像标记与成功标记；supply 独立分类，不当作 PvE 战斗 |
| serialBatchWaitMs | 从整轮 freezeAndResolve 开始到该战斗 resolver 开始；包含冻结及前序串行任务，用于解释批次位置，**不是不存在的 worker 线程池排队时间** |
| rounds[].batch | 当前同步整轮 freezeAndResolve 的墙钟与进程 CPU；含冻结、计算、结算规划和即时发布，与单战 resolver 的范围不同；CPU 也可能包含同时进行的进程后台工作 |
| rounds[].applicationBytes | 接收的原始文本 UTF-8 字节，按 state/view/replay/combat/receipt/lobby/error/other 分列；分包按实际收到的每包计数，没有显式 round 的收据按该连接最后观察到的回合归类，回合0为大厅；包括所有8个连接，不含未连接机器人的虚拟下发 |
| socketBytesRead | 每局客户端 socket 的 bytesRead 总和，含握手与 WebSocket 封装/压缩流；不是按消息类型分摊的 IP 线路流量，与 JSON 字节不混用 |
| observedMatchPeakRssBytes | 独立客户端进程每100ms读取 Linux /proc/服务器PID/status，结合端点 RSS 的单局观测峰值，可能漏掉短于采样间隔的尖峰 |
| memoryEnd.processLifetimeMaxRssBytes | Node resourceUsage 的**整个服务器进程**累计 RSS 高水位；不能拿这个必然不下降的计数器判定内存泄漏 |
| memoryTrend | 只比较预热后各局同位置的 memoryEnd.rssBytes，记录差值/是否严格递增；保留一份已结束 Room 直到下次开局、没有强制 GC。3个样本是方向观察，不能证明无泄漏；负载/GC也会影响它 |

服务器本地模式通过压测包装导入真实 createGameServer、默认 TwoSidedBattleResolver、WriteQueue 和 TestClient；不改任何 src 文件，观察代码不进入生产包。包装依赖这些入口，接口变动或命令计时关联不足会明确失败。观测本身有少量耗时，报告不是零开销剖析。远程服务器未提供这些测量接口，server、CPU、RSS、排队处理与计算重叠全部为 null；**不能从回放 tick 数、phase.serverNow 或客户端 RTT 推算服务器 CPU**。

V2 建议预算仍是参考：本机确认 p95≤100ms/p99≤250ms；服务器排队处理 p95≤50ms/p99≤100ms。脚本不设置性能通过阈值。四场 PvP 和八场 PvE 的实测批次按真实存活席数报告，后段少于八席不得当成开局八场成绩。压测不替代旧 M8 tick p95/p99、桌面帧率、重连5秒和公网真人试玩验收。

## 7 首版边界与记录位置

- 单一匹配队列、同一时间一局、最多8席；不做建房、邀请码、房主、准备键。第9人报满，不排第二局。
- 不足八席由服务器补位；基础策略、断线接管、共享池、加时以及投影必须以最终 B5/B6/B7/C6 的集成验收为准，不能仅凭规则库已导出函数宣布完成。
- 服务器内存态；重启/回滚中断旧局，旧凭证失效，没有跨进程恢复、账号登录或跨服匹配。隐藏座位凭证由连接层管理，玩家不需要输入。
- 容量只验证一房；4核不代表四场战斗天然并行，当前执行方式按报告注明。是否需要 worker 隔离由真实测量决定。
- 保留发布 SHA、Node/npm 实际版本、主机规格、配置、两种压测 JSON、试玩记录和旧发布目录；报告可由执行者放在仓库外证据目录，避免把逐帧状态或凭证作为日志公开。

## 8 用户试玩验收（对应 V2 §11，逐项留空）

V2 旧稿的“私密房间”按 AGENTS.md 最新产品决定改为单一匹配队列；不据此新增建房或邀请功能。

- [ ] 真人可从不同电脑进入同一匹配队列，开局补满八个席位。
- [ ] 服务器唯一决定资产、随机数、战斗、结算和排名。
- [ ] 真人和机器人使用同一个有限卡池，购买、刷新、升星、出售和淘汰满足库存守恒。
- [ ] 双方真实阵容及效果参与同一战斗，每对阵只有一份权威结果，结算只提交一次。
- [ ] 开场、PvE、PvP、选择、补给和终局按定稿合同走完。
- [ ] 基础机器人可完整参赛，人数不足与断线接管均按规则运行。
- [ ] 玩家短暂断线能回到原席位，旧连接与重复请求不会破坏状态。
- [ ] 正式界面可操作、可看战斗、可查看公开阵容和最终排名。
- [ ] 目标服务器的一房间负载、网络故障用例和真人试玩均通过。
- [ ] 未达成的可选增强和已知质量残余明确列出，没有冒充已完成。

发布候选 SHA：________　目标机：________　Node/npm：________　试玩日期/参与者：________

## 9 本次脚本交付的实测记录（不是发布验收）

2026-10-12，基线 `3785d96be7c9b8df9a2ccd1708ff534fcf86c3fd`，实际 **Node v22.23.3 / npm 10.9.9**，Linux x64、4 个逻辑 CPU、8,322,404,352 字节内存。脚本 SHA-256：`b5d4ced0de2786714a1f96a2de112b63ee7e1bf5d17ae9599527022d6cae16a1`。服务器与独立压测客户端进程共享这台主机的资源；以下是默认加速配置，不能外推为公网正常节奏容量。

派工单命令 `node scripts/loadtest-room.cjs --seats 2 --rounds 3` 退出0：同一服务器完成1局预热与3局测量，每局均得到完整八席排名、断开后连接数为0，所有准备命令均关联到服务器计时。原始报告名为 `t9-two-seat-final.json`。

| 测量局 | 游戏回合数 | 整局秒数 | 准备请求数 | RTT p95 / p99（ms） | 服务器排队+处理 p95（ms） | 结束 RSS（MiB） | 观测峰值 RSS（MiB） | 下发 JSON 字节 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 37 | 29.68 | 229 | 9.56 / 15.24 | 0.89 | 569.00 | 732.36 | 212,828,460 |
| 2 | 34 | 28.99 | 228 | 7.86 / 10.33 | 0.91 | 610.11 | 627.48 | 256,040,073 |
| 3 | 32 | 29.70 | 211 | 29.70 / 1031.34 | 0.87 | 669.69 | 683.09 | 316,429,093 |

三局共记录249场 PvP、158场 PvE、92次 supply 解析。每局按回合划分的计算耗时与 state/view/combat 等字节保留在 JSON 中；JSON 字节是解压后的应用载荷，不等于线路流量。

**尚不能确认内存不单向增长：** 结束 RSS 严格递增，共增加105,574,400字节（100.68 MiB）。不同局负载、GC 和保留最后一份已结束 Room 均会影响观测，不能据这3点直接断言泄漏，也不能宣称稳定。第三局 RTT p99 超过 V2 建议的250ms；临近阶段截止的10个请求与战斗计算区间重叠且收到 wrong-phase，保留在统计中。较小的服务器处理段不代表事件循环没有阻塞，处理前等待仍在 RTT/残差里。`status=complete` 只表示生命周期与测量完整，不表示性能预算或内存验收通过。

八真人席、连续3局在此基线**未跑通**：seed42 的诊断运行与最终脚本的 `--seats 8 --rounds 3 --seed 43` 均在完成预热后，首局测量第38回合剩2席时触发 `overtime-unavailable`，退出1。最终报告 `t9-eight-seat-43.json` 保留169条服务器战斗计算样本及故障；失败局不参与结束 RSS 趋势。T5R 已交付 `advanceMultiplayerRound`，这里缺的是 B7 服务器接线；故障旧文案“规则入口尚未交付”不代表当前规则库现状。脚本没有改服务器、跳过加时或编造终局，需 B7 合入后重跑八席3局。

交付验证：6个脚本测量/合法命令用例、`npm run typecheck`、`npm run build:game`、`npm run build` 通过（前端保留现有大 chunk 提示）。检查生产包外部导入为 `ws` 与 `node:crypto`；仅放入 `main.mjs` 和 `node_modules/ws` 的临时目录可启动并通过 `/ws` 加入。systemd 单元经 `systemd-analyze verify` 校验（仅将 Node 路径替为测试环境已安装路径）；不可达外部地址测试按预期退出1、输出失败 JSON，服务器指标为 null。未执行部署、Caddy 公网证书/WSS、浏览器回放或真人试玩，第8节清单保持未勾选。
