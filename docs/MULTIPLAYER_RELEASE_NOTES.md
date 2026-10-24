# 八人联机首版：发布与单房压测说明

本说明的目标是 **Linux、4 核 / 8 GB、Node 22.x、同一时间一局**。它是部署操作手册和验收记录模板；执行发布、域名切换及最终合入 main 由用户决定。本次只交付脚本和文档，不执行部署。

当前复测基线：`origin/multiplayer@d5df11e`，B5/B6/B7/B8、C6 及 SR-C6-01 已合入：有限卡池、机器人调度、加时、私有投影、切片计算和紧凑回放均使用集成实现。当前协议只下发 `replay`，已无逐 tick 帧或 `combatTransport` 配置。第 9 节保留初版 T9 历史数据，第 10 节记录本次 B8 复测；两者均不替代目标机和公网真人发布验收。

## 1 先准备什么

- 一台 Ubuntu 22.04 / 24.04 LTS 主机，4 核、8 GB 内存，普通管理员账号可以执行 sudo。
- 一个域名，例如 `play.example.com`，其 DNS A（使用 IPv6 时另有 AAAA）指向主机；开放入站 TCP 80、443。8787 只在本机监听。
- 用户已验收的**固定提交 SHA**，必须来自 multiplayer 集成线，不能拿持续变化的分支当发布包。下文将 `填入已批准的完整提交SHA` 换成该 SHA，将示例域名换成自己的。
- 最终发布前，先完成第 8 节真人验收清单；现有 `/cat/` 单人正式站点保持原部署，直到用户另行批准替换。

以下 shell 命令在目标机终端执行；看到错误应先停下处理，不能跳过构建或把缺失文件当成成功。

## 2 按脚本部署（G3，推荐；约 10 分钟）

2026-10-15 起部署由仓库内 `deploy/` 完成：`deploy/deploy.sh <SHA>` 按提交拉取、`npm ci`、`build:game`、前端 `build`、在新目录里构建完再**原子切换** `/srv/cat/current`、重启 systemd 服务、轮询 `/healthz` 直到报告的 `sha` 等于这次的提交；健康检查失败**自动切回上一个版本目录**并重启。第 3 节的手工步骤和第 5 节的手工切换保留作备用与原理说明，日常不再需要。

### 2.1 安装 Node 22（一次性；独立安装目录，供 systemd 与部署脚本使用）

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

### 2.2 首次准备（只做一次）

```bash
set -e
# 运行服务的系统账户（只读访问发布目录）
id catgame >/dev/null 2>&1 || sudo useradd --system --user-group --home-dir /srv/cat --shell /usr/sbin/nologin catgame
# 发布根目录归执行部署的管理员账号；构建不用 root
sudo mkdir -p /srv/cat && sudo chown "$USER": /srv/cat
# 取一份部署脚本（之后每次部署都用目标 SHA 自带的同一份也可以）
git clone https://github.com/catfish-xn/cat.git "$HOME/cat-deploy" && cd "$HOME/cat-deploy"
git fetch origin multiplayer && git checkout --detach 填入已批准的完整提交SHA
# 运行配置：内容见 3.2 的表格；至少写 NODE_ENV/CAT_HOST/PORT
sudo mkdir -p /etc/cat && sudo nano /etc/cat/game.env
# systemd 单元（多读一份 current/release.env，里面是该版本的 CAT_GIT_SHA）
sudo cp deploy/cat-game.service /etc/systemd/system/cat-game.service
sudo systemctl daemon-reload
sudo systemctl enable cat-game
```

单元文件与第 3.3 节相同，只多了 `EnvironmentFile=-/srv/cat/current/release.env`。若 Node 不在 `/opt/node22/bin`，同时改单元的 `ExecStart` 与部署时的 `CAT_NODE_BIN`。Caddy 按第 4 节配置（注意 `/ws*` 也转发 `/ws/healthz`）。

### 2.3 部署一个提交

```bash
cd "$HOME/cat-deploy"
git fetch origin && git checkout --detach 填入已批准的完整提交SHA     # 让脚本本身也是这个版本
deploy/deploy.sh 填入已批准的完整提交SHA
```

脚本按顺序：
1. 在 `/srv/cat/source`（裸仓库缓存）`git fetch`，确认提交存在，解析成完整 SHA。
2. `git archive` 导出到 `/srv/cat/releases/<SHA>.tmp-*`，检查 Node 22.12+，`npm ci` → `npm run build:game` → `VITE_CAT_SHA=<SHA> npm run build`（含 typecheck）→ `node --check` → `npm prune --omit=dev`，写 `release.env`（`CAT_GIT_SHA=<SHA>`）与 `.release-ok`，最后 rename 成 `/srv/cat/releases/<SHA>`。任何一步失败：删除临时目录，current 不动，退出 1。已有完整目录时直接复用。
3. 读当前 `/healthz`：**有真人在线的对局进行中就拒绝切换**（重启会中断对局），等 `room.phase` 为 `ended` 或无房间再来；确需中断加 `--force`。
4. `ln -sfn` + `mv -T` 原子切换 `current`，旧目标记为 `previous`；`sudo systemctl restart cat-game`。
5. 在 `CAT_HEALTH_TIMEOUT`（默认 40 秒）内轮询 `http://127.0.0.1:8787/healthz`，`sha` 等于新提交即成功，打印 /healthz，并只保留最近 `CAT_KEEP_RELEASES`（默认 5）个版本目录（current、previous 总保留）。
6. 超时或服务起不来：自动把 `current` 切回上一个目录、重启、确认旧 `sha` 健康，然后以“已自动回滚”退出 1；失败的新目录留着供排查（`journalctl -u cat-game -n 100`）。

可调环境变量：`CAT_ROOT`（/srv/cat）、`CAT_REPO`、`CAT_NODE_BIN`（/opt/node22/bin）、`CAT_HEALTH_URL`、`CAT_HEALTH_TIMEOUT`、`CAT_RESTART_CMD`（`sudo systemctl restart cat-game`）、`CAT_KEEP_RELEASES`。

其他命令：`deploy/deploy.sh status`（current/previous 与 /healthz）；`deploy/deploy.sh rollback`（不构建，切回 previous 并检查）。同一时间只允许一个部署（`/srv/cat/.deploy.lock`）。

### 2.4 部署后确认

```bash
curl -s http://127.0.0.1:8787/healthz; echo
sudo journalctl -u cat-game -n 20 -o cat
```

`/healthz` 返回 JSON：`sha`、`contentDigest`、`lootReplayDigest`、`netProtocol`、`roomProtocol`、`room`（`roomId/phase/round/roundName/fault/humans/humansConnected/alive`，开服后未开局为 null）、`seatsOnline`（凭证绑在在线连接上的席位数，含排队）、`queue`、`capacity`、`connections`、`uptimeSec`、`rssBytes`。不含玩家名、凭证或棋盘状态。经 Caddy 访问为 `https://域名/ws/healthz`。

打开 `https://域名/?mode=online&server=ws`，页面**右下角**两行小字：`页面 <SHA 前 7 位> · 内容 <digest>` 与 `服务器 <SHA 前 7 位> · 内容 <digest>`。两行 SHA 与 digest 都应等于本次提交；出现“版本不一致，请刷新”说明浏览器还在用旧前端，强制刷新即可。

日志是每行一个 JSON（`ts/level/event/roomId/seatId` + 事件字段），级别由 `/etc/cat/game.env` 的 `CAT_LOG_LEVEL`（debug/info/warn/error，默认 info）控制。只记录阶段切换、入队/开局/重连、对局结束原因与错误，不含凭证或逐帧状态。例：`journalctl -u cat-game -o cat | grep '"event":"room.ended"'`。

### 2.5 清旧存档提醒（每次内容 digest 变化时）

- **服务器没有存档**：对局只在内存里，部署重启后旧局和旧座位凭证全部失效，玩家刷新页面会提示“席位已失效 · 请重新匹配”，浏览器里 `hex-online-seat:*` 的旧凭证随之作废，无需手动清。
- **单机存档在玩家浏览器的 IndexedDB**（`hex-autobattler-s13-rules-gap-v1`）。`contentDigest`/`lootReplayDigest` 与上次部署不同（看 `/healthz` 或第 11/12 节与 P3P4P5 节的记录）时，旧 digest 的存档**不能续玩**，只能原字节导出；提醒玩家先在“开始与继续”里“导出当前局”留档，再“随机新局”。不要替玩家改存档头部冒充新版本。确实要清空，可在浏览器开发者工具 → Application → IndexedDB 删除该库（会丢掉未导出的旧局）。
- 对外公告前，用 `/healthz` 的两个 digest 与上一版比对，写进本次发布记录。

### 2.6 对局异常时（无需重启）

房间结算出错（`resolver-error` 等）、卡死（`CAT_STALL_SEC`，默认 120：阶段截止后这么久没有任何发布）、全员掉线（`CAT_ABANDON_SEC`，默认 90：所有真人席都断线这么久）三种情况，服务器会把该局结束为异常（`/healthz` 的 `room.phase=ended`、`room.fault` 写原因），释放该局所有座位凭证，**匹配队列立刻重新开放**，进程不重启。玩家页面显示原因与“返回匹配”。两项设为 0 可分别关闭检查。`CAT_FAULT_INJECT_ROUND` 只供 e2e 注入异常，生产 `/etc/cat/game.env` 不得设置。

### 2.7 手工构建（备用）

部署脚本不可用时，按原手工方式在构建机执行，然后按第 3.1 节复制、第 5 节切换：

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
VITE_CAT_SHA="$CAT_RELEASE_COMMIT" npm run build
node --check dist-server/game/main.mjs
```

**构建顺序不能颠倒：** esbuild、TypeScript、Vite 是 devDependencies；先执行 `npm ci --omit=dev` 会让 build:game/build 缺工具。生产启动使用已构建文件，不运行 `npm run serve:game`（它会重新调用 esbuild）。手工安装的版本目录还需写入 `release.env`（`CAT_GIT_SHA=<SHA>`），否则 `/healthz` 报 `sha: "unknown"`。

Node 服务构建的外部运行包为 **ws**，其余是 Node 内置模块；Phaser 只用于前端构建/静态包。仓库 package.json 同时将 `ws` 和 `phaser` 列为 dependencies，所以 `npm ci --omit=dev` / `npm prune --omit=dev` **仍会保留 Phaser**；它不会被服务器入口加载。

## 3 安装发布目录与 systemd 服务（手工备用；第 2 节脚本已包含）

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
# CAT_SEED=20261012    # 不设置则每次启动随机
CAT_PREP_SEC=30
CAT_CHOICE_SEC=30
CAT_SETTLE_SEC=6
# CAT_QUEUE_TIMEOUT_SEC=30
# CAT_TAKEOVER=1
```

| 变量 | 默认值与意义 |
| --- | --- |
| PORT | 8787；优先于 CAT_PORT |
| CAT_PORT | 8787；PORT 未设置时作为后备；建议只设置 PORT |
| CAT_HOST | 127.0.0.1；本说明保持本机绑定，由 Caddy 对外提供 WSS |
| CAT_SEED | 不设置时每次启动随机（日志 `config.seed` 记下实际值）；设置时第一局用它，之后各局由它派生。合法 uint32，复现压测时可用42；不是登录密钥 |
| CAT_PREP_SEC | 30；**保持 30 或不设置**才按回合表走（1-2 6 秒、1-3 15 秒、1-4 与其他野怪 20 秒、4-6 75 秒、强化回合 50 秒、其余 30 秒）；设成其他值会让除强化回合外的所有回合都用这个秒数，只用于调试 |
| CAT_CHOICE_SEC | 30；独立选择阶段秒数（如奇遇里的选择）。v22 起强化并入准备阶段（该回合合计 50 秒，不受此项影响），10-23 批准的 48 秒作废；锻造器打开后的 30 秒由规则决定，也不受此项影响 |
| CAT_SETTLE_SEC | 6；结算阶段秒数 |
| CAT_QUEUE_TIMEOUT_SEC | 不设置时等待任意排队玩家点开始；设置后首位入队开始倒计时 |
| CAT_TAKEOVER | 不设置（默认关）：按云顶"掉线不接管"，掉线席位什么都不做、棋盘照常参战，重连后继续操作；设为 `1`/`true`/`on`/`yes` 才让机器人接管掉线席位（B6），`0`/`false`/`off`/`no` 显式关闭，其他值启动报错 |
| CAT_TAKEOVER_SEC | 60；仅在 CAT_TAKEOVER 打开时生效，掉线多少秒后由机器人接管 |
| CAT_STALL_SEC | 120；G3 看门狗：阶段截止后这么多秒没有任何状态发布即判卡死、异常收局、重开队列；0 关闭 |
| CAT_ABANDON_SEC | 90；G3 看门狗：所有真人席都断线这么多秒即收局、重开队列；0 关闭 |
| CAT_LOG_LEVEL | info；debug/info/warn/error，每行一个 JSON 日志 |
| CAT_GIT_SHA | 不在此文件设置：由版本目录的 `release.env` 提供，`/healthz` 与页面右下角显示 |
| CAT_FAULT_INJECT_ROUND | **仅测试**：该回合第一场战斗抛错一次；生产不得设置 |
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

日志首条 `"event":"server.listening"`（其 `msg` 含 `listening on ws://127.0.0.1:8787`）表示服务已监听。日志在 journald：`sudo journalctl -u cat-game -f -o cat` 实时查看（每行一个 JSON）。`curl -s http://127.0.0.1:8787/healthz` 返回版本与房间状态（见 2.4）；它只说明进程在服务，联机是否成功仍用网页或 Node WebSocket 客户端验证。

## 4 Caddy：静态前端、HTTPS 和 /ws

```bash
sudo apt-get install -y caddy
sudo nano /etc/caddy/Caddyfile
```

用自己的域名替换第一行：

```caddyfile
play.example.com {
    handle /ws* {
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

## 5 停止、更新与回滚（手工备用；日常用 `deploy/deploy.sh <SHA>` 与 `deploy/deploy.sh rollback`）

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
node --expose-gc scripts/loadtest-room.cjs --seats 8 --rounds 3 > eight-seat-gc.json
```

- `--rounds` 表示**完整对局数**，不是游戏内回合上限。默认先预热1局，再测3局；所有对局使用同一个服务器进程、服务器实例与单队列，前局必须有完整八席名次后才开下一局。正常关闭每局客户端，检查服务器连接数回到0。
- 始终建立8个 Node `TestClient` WebSocket 连接，由一个独立压测客户端进程驱动；`--seats 8` 全部入队，`--seats 2` 仅2个入队，其余6个连接停在大厅，6个参赛机器人由服务器补位。后者**不是八个真人接收战斗流**，不能冒充八席网络负载。
- `--ops 4` 默认每真人每游戏回合最多4个准备操作；按独立 lcg32 种子随机选择合法候选类型与目标，覆盖买卡、卖卡、刷新、经验、站位、锁店及有素材时的合成/装备。只读取已显示资源，调用只读规则校验，不读取随机流来预测。选择节点另处理，最多16步。命令进入服务器时可能已过准备截止或版本变更，拒绝数量与原因照实记录；不能因为发出了意图就算成功。
- 默认 `--prep-sec 0.25 --choice-sec 0.10 --settle-sec 0.05 --playback-ms 20`。本地测量入口可注入毫秒时钟配置；20ms 仅截短**计算完成后的播放等待**，不减少战斗 tick、不跳过结算、不伪造结果。该模式测计算/传输/生命周期，不是正常节奏试玩。默认准备时间250ms短于机器人动作间隔300ms，不能声称覆盖完整机器人策略负载；八真人席没有补位机器人。`--playback-ms real --prep-sec 30 --choice-sec 30 --settle-sec 6` 恢复普通等待口径，完整三局可能耗时较长。
- `--seed 42` 默认固定服务种子；行动种子随测量局和席位派生，具体配置写进报告。`--warmup 0` 可做快速诊断，但不用于预热后的内存判断。`--idle-ms 1000` 默认每局断开后等待1秒再读内存。以 `node --expose-gc` 启动时，子服务器继承该标志，并在每次结束内存取样前先执行 `gc()`；`gcApplied/gcWallMs` 记录实际模式及 GC 耗时，不计入战斗切片。普通命令保持自然 GC，两种 RSS 不混为同组。`--timeout-sec 900` 是每局期限，失败输出 status=failed、非零退出码；不重启服务器继续掩盖失败。
- 连接已有专用测试服务：`node scripts/loadtest-room.cjs --url wss://测试域名/ws --seats 8 --rounds 3 > remote.json`。该模式不启动/更改服务器，不接受本地阶段时间选项。测试会加入并开始真实对局，应在用户指定的测试入口执行；不要对正在给玩家服务的队列运行。

### 测量字段与限制（V2 §8.2）

stdout 仅输出一个 `room-loadtest-v2` JSON；进度在 stderr。每局都有 status、真实整局墙钟 durationMs、finalRound、排名、每回合字节及命令分布。warmups 单独列出，不混入 matches。

| 指标 | 本脚本口径 |
| --- | --- |
| preparationCommands.rttMs | 从调用 TestClient.command 到收到相同 commandId 的 receipt；毫秒，nearest-rank p50/p95/p99/max/mean 与样本数，成功/拒绝均计入；每轮也分别输出 |
| serverQueueMs | 已解码 ws message 被交给应用，到 WriteQueue 对应任务开始；此前 socket 解码或主线程阻塞无法单独观测，仍包含在 RTT/残差里 |
| serverProcessingToReceiptMs | 任务开始到 receipt JSON 已构造、交给 ws.send 前；含校验、规则调用、去重与收据序列化，不含后续压缩/发送及广播 |
| serverQueueAndProcessingMs | 上面两段合计；通过 seatId+commandId 对应到同一个请求，serverMatched 必须覆盖测得的准备命令 |
| transportAndSchedulingResidualMs | **RTT 减上述服务器段的残差**；包含传输、压缩、收发事件循环等待和客户端调度/解析，不能叫纯网络 RTT；networkOnlyMs 固定为 null。负值保留并计数，不截成0掩盖观测问题 |
| overlappingBattleCompute | 本机共同时间基准上，请求往返区间与真实 Room 切片计算区间相交（包含回放/发布，不包含切片间调度等待）的数量；辅助解释临近截止时的大 RTT，不是客户端实际发出时的服务器阶段证明 |
| rounds[].battles | 每个 PvP 配对或单席 PvE 的内部 resolver 任务；`startBattle(input,pool)` 全参数透传，每次 `advance` 独立记录 `slices`，wallMs/CPU user/system 为切片累计，maxSliceMs 为最长 advance；complete/ok 分别表示已返回结果/无抛错；supply 独立分类 |
| rounds[].freeze | freezeAndResolve 仅冻结与创建解析上下文的墙钟/CPU，不再包含整轮战斗 |
| rounds[].slices / server.sliceWallMs | 完整 Room.resolveSlice 的区间、wall/CPU 与汇总分位数，覆盖内部 advance、额外回放预热片和最后的结算规划/发布；这是报告“最大服务器单片”的口径，包含内部 resolver 时间，二者不能相加。CPU 为进程计数，可能包含后台工作 |
| rounds[].applicationBytes | 原始文本 UTF-8 字节，按 state/view/replay/receipt/lobby/error/other 分列；当前战斗消息仅 replay，无逐 tick 帧/分包。没有显式 round 的收据按该连接最后观察回合归类，回合0为大厅；包括全部8个连接，不含未连接机器人的虚拟下发 |
| socketBytesRead | 每局客户端 socket 的 bytesRead 总和，含握手与 WebSocket 封装/压缩流；不是按消息类型分摊的 IP 线路流量，与 JSON 字节不混用 |
| observedMatchPeakRssBytes | 独立客户端进程每100ms读取 Linux /proc/服务器PID/status，结合端点 RSS 的单局观测峰值，可能漏掉短于采样间隔的尖峰 |
| memoryEnd.processLifetimeMaxRssBytes | Node resourceUsage 的**整个服务器进程**累计 RSS 高水位；不能拿这个必然不下降的计数器判定内存泄漏 |
| memoryTrend | 只比较预热后各局同位置的 memoryEnd.rssBytes，记录差值/是否严格递增；保留一份已结束 Room 直到下次开局，`gcBeforeSamples` 对应各局实际 GC 模式。3个样本是方向观察，不能证明无泄漏；负载/GC也会影响它 |

服务器本地模式通过压测包装导入真实 createGameServer、默认 TwoSidedBattleResolver、WriteQueue 和 TestClient；不改任何 src 文件，观察代码不进入生产包。包装依赖这些入口，接口变动或命令计时关联不足会明确失败。观测本身有少量耗时，报告不是零开销剖析。远程服务器未提供这些测量接口，server、CPU、RSS、排队处理与计算重叠全部为 null；**不能从回放 tick 数、phase.serverNow 或客户端 RTT 推算服务器 CPU**。

V2 建议预算仍是参考：本机确认 p95≤100ms/p99≤250ms；服务器排队处理 p95≤50ms/p99≤100ms。脚本不设置性能通过阈值。四场 PvP 和八场 PvE 的实测批次按真实存活席数报告，后段少于八席不得当成开局八场成绩。压测不替代旧 M8 tick p95/p99、桌面帧率、重连5秒和公网真人试玩验收。

## 7 首版边界与记录位置

- 单一匹配队列、同一时间一局、最多8席；不做建房、邀请码、房主、准备键。第9人报满，不排第二局。
- 不足八席由服务器补位；B5/B6/B7/C6 已接入基础策略、断线接管、共享池、加时及投影，完整真人玩法仍需第8节验收。
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
- [ ] 基础机器人可完整参赛，人数不足补位按规则运行；断线默认不接管（掉线席位不操作、棋盘照打），`CAT_TAKEOVER=1` 时接管与收回按规则运行。
- [ ] 玩家短暂断线能回到原席位，旧连接与重复请求不会破坏状态。
- [ ] 正式界面可操作、可看战斗、可查看公开阵容和最终排名。
- [ ] 目标服务器的一房间负载、网络故障用例和真人试玩均通过。
- [ ] 未达成的可选增强和已知质量残余明确列出，没有冒充已完成。

发布候选 SHA：________　目标机：________　Node/npm：________　试玩日期/参与者：________

## 9 初版 T9 历史记录（3785d96，非当前性能）

2026-10-12，基线 `3785d96be7c9b8df9a2ccd1708ff534fcf86c3fd`，实际 **Node v22.23.3 / npm 10.9.9**，Linux x64、4 个逻辑 CPU、8,322,404,352 字节内存。脚本 SHA-256：`b5d4ced0de2786714a1f96a2de112b63ee7e1bf5d17ae9599527022d6cae16a1`。服务器与独立压测客户端进程共享这台主机的资源；以下是默认加速配置，不能外推为公网正常节奏容量。

派工单命令 `node scripts/loadtest-room.cjs --seats 2 --rounds 3` 退出0：同一服务器完成1局预热与3局测量，每局均得到完整八席排名、断开后连接数为0，所有准备命令均关联到服务器计时。原始报告名为 `t9-two-seat-final.json`。

| 测量局 | 游戏回合数 | 整局秒数 | 准备请求数 | RTT p95 / p99（ms） | 服务器排队+处理 p95（ms） | 结束 RSS（MiB） | 观测峰值 RSS（MiB） | 下发 JSON 字节 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 37 | 29.68 | 229 | 9.56 / 15.24 | 0.89 | 569.00 | 732.36 | 212,828,460 |
| 2 | 34 | 28.99 | 228 | 7.86 / 10.33 | 0.91 | 610.11 | 627.48 | 256,040,073 |
| 3 | 32 | 29.70 | 211 | 29.70 / 1031.34 | 0.87 | 669.69 | 683.09 | 316,429,093 |

三局共记录249场 PvP、158场 PvE、92次 supply 解析。每局按回合划分的计算耗时与 state/view/combat 等字节保留在 JSON 中；JSON 字节是解压后的应用载荷，不等于线路流量。

**尚不能确认内存不单向增长：** 结束 RSS 严格递增，共增加105,574,400字节（100.68 MiB）。不同局负载、GC 和保留最后一份已结束 Room 均会影响观测，不能据这3点直接断言泄漏，也不能宣称稳定。第三局 RTT p99 超过 V2 建议的250ms；临近阶段截止的10个请求与战斗计算区间重叠且收到 wrong-phase，保留在统计中。较小的服务器处理段不代表事件循环没有阻塞，处理前等待仍在 RTT/残差里。`status=complete` 只表示生命周期与测量完整，不表示性能预算或内存验收通过。

八真人席、连续3局在此基线**未跑通**：seed42 的诊断运行与最终脚本的 `--seats 8 --rounds 3 --seed 43` 均在完成预热后，首局测量第38回合剩2席时触发 `overtime-unavailable`，退出1。最终报告 `t9-eight-seat-43.json` 保留169条服务器战斗计算样本及故障；失败局不参与结束 RSS 趋势。T5R 已交付 `advanceMultiplayerRound`，这里缺的是 B7 服务器接线；故障旧文案“规则入口尚未交付”不代表当前规则库现状。脚本没有改服务器、跳过加时或编造终局，此历史阻塞已由后续 B7 接线，本次复测见第10节。

交付验证：6个脚本测量/合法命令用例、`npm run typecheck`、`npm run build:game`、`npm run build` 通过（前端保留现有大 chunk 提示）。检查生产包外部导入为 `ws` 与 `node:crypto`；仅放入 `main.mjs` 和 `node_modules/ws` 的临时目录可启动并通过 `/ws` 加入。systemd 单元经 `systemd-analyze verify` 校验（仅将 Node 路径替为测试环境已安装路径）；不可达外部地址测试按预期退出1、输出失败 JSON，服务器指标为 null。未执行部署、Caddy 公网证书/WSS、浏览器回放或真人试玩，第8节清单保持未勾选。

## 10 B8/C6 集成后的复测（SR-B8-01）

2026-10-12，规则/服务器/界面基线 `d5df11e3943ac9232024784f8e7d7c193fc22a76`（PR #54/#55 已合入）；只使用本 PR 的修正版脚本，无 src/golden 改动。实际 **Node v22.23.3 / npm 10.9.9**（nvm use 22），Linux x64、4 个逻辑 CPU、8,322,404,352 字节内存，服务器与负载客户端共享主机。脚本 SHA-256：`35138c5e7deba812140534b227e760e2916c968157cc5f73bd8c7dc7993f0969`，报告 schema `room-loadtest-v2`。下列运行串行执行，没有两组压测争用主机。

每组均默认 seed42、1局预热 + 3局测量、同一服务器/PID 连局、8个 Node 客户端、每真人每轮最多4次准备操作；准备/选择/结算250/100/50ms，播放等待上限20ms，结束断开后空闲1000ms。服务器使用默认100 tick 切片，未改变战斗、卡池、结算或机器人策略。原始 JSON 按下述文件名随任务证据交付，不提交大报告到仓库。

### 10.1 用户指定八席三局（自然 GC）

`node scripts/loadtest-room.cjs --seats 8 --rounds 3` **退出0**，报告 `b8-eight-seat.json`。预热36回合；三局均完整八席排名、结束连接数0、准备命令全部匹配服务器计时，battle 样本均完成且有 advance 记录，并收到 replay；无客户端错误或命令拒绝。

| 测量局 | 回合 / 秒数 | 准备请求数 | 准备 RTT p95 / p99（ms） | 服务器排队+处理 p99（ms） | 最大服务器单片（ms） | 最大 resolver advance（ms） | 结束 RSS（MiB） | 单局观测 RSS 峰值（MiB） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 36 / 29.87 | 824 | 24.62 / **29.04** | 2.59 | **437.20** | 284.74 | **225.16** | 242.11 |
| 2 | 34 / 37.48 | 832 | 23.81 / **28.32** | 2.26 | **598.16** | 485.76 | **229.50** | 246.21 |
| 3 | 34 / 40.12 | 840 | 25.51 / **33.62** | 2.58 | **727.42** | 577.56 | **237.00** | 254.14 |

“服务器单片”覆盖完整 Room.resolveSlice（包括单独回放预热和最后的规划/发布），不是仅内部 advance；三局最长片都出现在第24回合 PvE，区间内没有内部 advance，因此只包 resolver 会漏掉它们。两列嵌套，不能相加。三局分别403/415/443个服务器切片，战斗/补给记录合计244场 PvP、152场 PvE、90次 supply。准备请求没有与切片计算区间重叠，当前 RTT 不能说明临近准备截止时的延迟；默认少量早期命令负载不等于持续压满服务器。尽管该组 p99 低于 V2 建议250ms，最长同步片仍远高于 SR-B8-02 约50ms的目标。

| 测量局 | 总下发 JSON 字节 | 其中 replay 字节 | 进程累计 RSS 高水位（MiB） |
| --- | --- | --- | --- |
| 1 | 46,070,602 | 11,576,353 | 242.52 |
| 2 | 51,232,620 | 15,443,547 | 247.03 |
| 3 | 55,227,702 | 19,126,383 | 254.03 |

应用字节含全部8连接的 state/view/replay/receipt/lobby 等，不含逐 tick combat 帧。逐轮类型分布、每片 wall/CPU、socket 字节、收据处理/残差均保留在 JSON。RSS 结束点为236,097,536 / 240,644,096 / 248,512,512字节，严格递增，总增11.84MiB；自然 GC 下仅3点不能判定泄漏或声称内存稳定，需结合下一组及更长时间剖析。

### 10.2 SR-B8-01 两席接口验收

`node scripts/loadtest-room.cjs --seats 2 --rounds 3` **退出0**，报告 `b8-two-seat.json`。预热39回合，测量34/33/40回合；battle 样本170/163/169条且全部有完成的 advance，完整排名/连接清空/计时关联均通过。准备 RTT p99 为11.60 / 11.28 / 22.08ms，最大服务器单片195.58 / 511.27 / 801.71ms，结束 RSS 237.62 / 237.79 / 237.48MiB。6个机器人由真实 B6 调度器补位，但250ms准备期短于300ms动作间隔，本组不能作为完整机器人玩法负载验收；八席组无补位机器人。

### 10.3 强制 GC 取样验证（独立运行，不替换10.1）

`node --expose-gc scripts/loadtest-room.cjs --seats 8 --rounds 3` **退出0**，报告 `b8-eight-seat-gc.json`。子进程预热和三局结束样本均 `gcApplied=true`；gcWallMs 单独记录，不进入战斗计时。三局同样完整排名、连接归零、命令计时关联和回放/战斗样本检查通过。

| 测量局 | 回合 | 准备 RTT p99（ms） | 最大服务器单片（ms） | GC 后 RSS（MiB） | GC 后 heapUsed（MiB） |
| --- | --- | --- | --- | --- | --- |
| 1 | 34 | 32.26 | 521.93 | 234.21 | 14.49 |
| 2 | 33 | 28.43 | 589.25 | 227.60 | 16.05 |
| 3 | 34 | 30.57 | 752.98 | 233.73 | 16.84 |

GC 后 RSS 为245,587,968 / 238,657,536 / 245,084,160字节，非单向增长，末局较首局少0.48MiB；heapUsed 仍有变化，不能据三局宣布无泄漏。GC 不保证立即归还全部 RSS，两组也不是相同动作轨迹的严格 A/B：真实时钟、命令交错和存活回合可变。两组均保留已结束 Room 与测量记录，观测包装本身也占内存。

本次验证：10个 T9 测量/候选命令测试、脚本语法检查、全仓 typecheck 通过；两席、八席、八席 `--expose-gc` 三组各1预热+3测量均退出0。仅修改 scripts/tests/docs，未改任何 src、golden 或 main；未执行部署/真人验收。SR-B8-02/03 仅评估工作量，详见 `UI_REQUESTS.md` 末节，尚未优化同步规则调用或共享池。

## 11 T13-B / #81 最终身份与旧档（2026-10-14，窗口 1）

- 最终 `CONTENT_DIGEST=fnv1a32-utf16:bd9c3a8e`，`LOOT_REPLAY_DIGEST=fnv1a32-utf16:5cd0487c`，存档格式 **3**。本次性能与夹具修复不改玩法、随机数、身份或 digest。
- 前驱为 T13-A 的 `96c9126d`；更早 T12 为 `44fe9c0e`。旧格式 2 或旧 digest 的存档保留原字节供导出，不能修改头部冒充新档，也不迁移续玩；用户须新开局。当前格式 3 且身份匹配的存档继续走完整恢复校验。
- T12/T13 golden 原件与独立 oracle 均未改写。`bbe2258` 给路线脚本增加可配置夹具参数，导致当前脚本 SHA 与录制时 SHA 不同；录制脚本原字节存于 `evidence/t13/golden-driver.cjs`，`golden-audit.json` 分别记录录制和当前脚本 SHA。该文件是历史证据，不是新的执行入口。
- 性能优化仅复用已经校验的深冻结布局/掉落组合和不可变来源记录；外部 JSON、可变副本、新布局、换轮与恢复仍执行完整内容比较，资产守恒检查继续逐笔执行。详细验收见 [窗口 1 证据](evidence/t13/WINDOW1.md)。

## 12 合 main 前提醒（2026-10-14 晚）

- 旧单机存档作废：存档/回放格式 2→3，CONTENT_DIGEST 今天改为 `fnv1a32-utf16:bd9c3a8e`；旧档只能原字节导出、新开局，不迁移续玩。
- 掉线接管：用户决定按云顶"掉线不接管"。`bot-driver` 已加 `takeover` 开关且默认关，部署无需再把 `CAT_TAKEOVER_SEC` 调大；需要接管时设 `CAT_TAKEOVER=1`（见 §3.2）。启动日志末尾显示 `takeover on/off`。
- 真机反馈 backlog 原在会话交接文件 `SESSION_HANDOVER.md` §0.0.6（2026-10-20 已移出仓库，只保留在项目内部资料中）。

## P3/P4/P5 单批发布：旧档作废原因（2026-10-14）

P3-A 从首场PvP加时起基础扣血12→17，普通stage2–6和每个存活敌人1保持；P4-A保持76升9、最高9级（68为16.1值，不开10级）；P5-A保持球数/50-50/90-9-1，采样执行改读冻结权重。三项一包，身份一次冻结/切换/重录。

最终CONTENT_DIGEST **fnv1a32-utf16:bd9c3a8e → fnv1a32-utf16:77f80fec**，LOOT_REPLAY_DIGEST **fnv1a32-utf16:5cd0487c → fnv1a32-utf16:b8d9d7ca**；两者由共同manifest的canonical输入同批生成。rules/content升为s13-rules-gap-v2 / s13-14.24b-rules-gap-v2；schema7/save3/replay3/command3、NET2保持。

旧档作废指旧digest不能续玩，不删除原文件：加时扣血会影响HP/淘汰/配对，且旧loot摘要没有签入新共享manifest与权重执行规则，不能把旧seed按新身份重抽或仅替换hash伪装迁移。原档只读保全/导出，活动局按旧身份完成后再切新版本，新开局使用本包。T13及历史golden/录制原件原字节保留，新录制独立存放。

首次差异示例：overtime-1空对空tick0平局，旧基础/扣血12、HP100→88，新基础/扣血17、HP100→83；战斗事件/terminal/收入/XP/RNG相同。普通阶段四条完整路线命令及132场回合事件不变，134个录制状态仅发布身份改变；详见 [P3P4P5_RELEASE](P3P4P5_RELEASE.md)。单PR验收目标集与三问见 [PR正文](PR_P3P4P5.md)，不执行全套或部署。

## G2-1 candidate (codex/g2-1-content; not inventory-complete)

- `s13-g2-1-v1` / `s13-14.24b-g2-1-v1`; content `fnv1a32-utf16:77f80fec` → `fnv1a32-utf16:70a355f3`, loot replay `fnv1a32-utf16:b8d9d7ca` → `fnv1a32-utf16:65a85ecd`. Schema/save/replay/protocol versions stay7/3/3/3.
- Admitted14 new heroes, Automata/Firelight/Family, expanded33-species shop/pool (674 copies). Frozen source also contains Swain, whose form template has null MR; this candidate excludes him pending evidence. Thus existing five classes are not yet complete.
- Baseline already contains8 ordinary components and36 completed items. No fictitious ninth ordinary component or emblem is added. This discrepancy with the dispatch remains a scope decision.
- Prior #90 state/golden bytes remain intact; old identities cannot resume/replay and remain available for original-file read-only export. New public-command recordings and source/runtime/approximation tables: [G2-1 evidence](evidence/g2-1/RECONCILIATION.md), [byte audit](evidence/g2-1/release-audit.json).
- Source fields not modeled, finite geometry conventions and inaccessible emblem tiers are explicitly listed in the reconciliation. Icon manifest only; no `public/assets/` changes. Candidate remains draft until the inventory and numerical limitations are resolved/reviewed.
# P7-1 规则修正（与 Opus 服务器/界面配套 PR 一起验收）

基线 multiplayer `343877a5d364231ac64cdca0e2b7882730f35dea`。仅五次 x-4 选秀；恢复免费艾瑞莉娅与既有开局经济。选秀卡按备战席、未满人口的棋盘、临时位顺序放置，临时位不参战可出售；下一准备期迁入并合星，以 preparationReceipts 防止重复结算。

CONTENT `fnv1a32-utf16:22f31569 → fnv1a32-utf16:bb66f4f8`，仅更新一次；LOOT_REPLAY 保持 `fnv1a32-utf16:028e5593`。schema/save/replay/command 7/3/3/3，rules/content 字符串沿用 G2-2，选秀 revision=p7-1 纳入内容身份。旧快照保留原字节供导出，新局重开，不静默迁移。

新投影 heldCarouselUnits 替换 pendingCarouselUnits；运行时不再输出 openingPending。pendingUnits 和旧 resolve/sell 导出名暂保留兼容，详见 MULTIPLAYER_CONTRACT §21.6。规则 PR 不单独合入或部署；Opus 从规则 head 叠服务器 PR，修正 1-1 专用分支、投影消费与 tests/server 单测/e2e 后共同验收。


### 2026-10-16 随机一费起手

1-1 每席独立、等权获得 14 个一费英雄之一，允许撞卡，联机从共享池扣一张；单人同一选择规则。0G/等级1/0XP/100HP、unit-1 和 (1,4) 不变。按用户 2026-10-16 决定维持随机：1-2/1-3 从原五个老一费随机抽取，随机流、范围和消耗次数沿用 multiplayer 基线，重复照常合星。专用 opening-unit-v1 随机流不影响其他随机流。

本次升级 rules/content 身份并更新 CONTENT 与 LOOT_REPLAY digest，旧存档、快照、回放作废且不迁移。应在活动局结束后发布。详见 [交付与验证](OPENING_RANDOM_1COST_RELEASE.md)。
