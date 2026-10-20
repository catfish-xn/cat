# 任务书：v16 外网部署与跨网验收（2026-10-20）

给用户本机的 GPT 照做。分两段：**部署**在 ChatGPT 聊天里做（第 A 部分），**测试**另起任务做（第 B 部分）。提示词在文末，可直接粘贴。沿用 v13 在用户 Windows 电脑上的做法：前端 Vite preview（5173）+ 对局服务（8787），对外方式和 v13 相同。**测试版不设访问口令。**

发布提交是 `a641cf2738d9d647aabdf61feb6f597d2b718ace`（页面显示 `a641cf2`），见 `release-v16-checklist.md` 第一节。release/v16 分支上比它多一个纯文档提交（就是这两份文件），代码相同；部署一律用上面这个提交。

## 0. 边界（必须遵守）

- **不改代码、不提交、不推送、不开 PR、不碰 main 或任何远程分支。** 只从 GitHub 拉固定提交构建。
- 只部署固定提交 `a641cf2738d9d647aabdf61feb6f597d2b718ace`，不要用分支名、main 或 multiplayer 最新提交。
- 用新目录 `cat-v16` clone，v13 目录留着作回滚；clone 后先 `git config core.autocrlf false` 再 checkout（必须是 LF）。
- 对局服务只在本机监听（`CAT_HOST=127.0.0.1`），只把前端端口对外。
- 隧道账号、令牌不要写进报告或聊天。
- **3D 素材不进 cat-v16 目录、不进仓库。** 3D 不挡这次发版。
- 某一步失败：停下，记时间、整页截图（含右下角版本号），按 B.4 回报。不要为了通过改代码或改参数重试。

## 1. 版本

| 项 | 值 |
|---|---|
| 提交 | `a641cf2738d9d647aabdf61feb6f597d2b718ace`（页面显示 `a641cf2`） |
| contentDigest | `fnv1a32-utf16:de829c8a` |
| lootReplayDigest | `fnv1a32-utf16:62c76cb9` |
| netProtocol | 5 |
| 回滚到 | v13 目录（`a0d42c592cbd48fb075175e5f61818dabfe1b320`），启动方式不变 |

## A. 部署（在 ChatGPT 聊天里做）

1. **排空对局**：`curl http://127.0.0.1:8787/healthz`，`room` 为 null 或 `phase` 为 ended 才往下做；有真人在打就等。然后停掉 v13 的两个窗口。
2. 新目录构建（PowerShell，Node 22.12 以上）：
   ```powershell
   git clone https://github.com/catfish-xn/cat.git cat-v16; cd cat-v16
   git config core.autocrlf false
   git checkout --detach a641cf2738d9d647aabdf61feb6f597d2b718ace
   npm ci
   npm run build:game
   $env:VITE_CAT_SHA="a641cf2738d9d647aabdf61feb6f597d2b718ace"; npm run build
   ```
3. 启动（两个窗口，和 v13 一样，只换目录和 SHA）：
   ```powershell
   # 窗口 1：对局服务，只在本机监听
   $env:CAT_HOST="127.0.0.1"; $env:PORT="8787"; $env:CAT_GIT_SHA="a641cf2738d9d647aabdf61feb6f597d2b718ace"; node dist-server/game/main.mjs
   # 窗口 2：前端，/ws 转给本机 8787
   npx vite preview --port 5173 --strictPort
   ```
   不要设置 `CAT_FAULT_INJECT_ROUND`、`CAT_TAKEOVER`、`CAT_SEED`。
4. 对外：沿用 v13 的方式，指向新的前端 5173。不设访问口令。
5. 核对，全部通过才算部署完成：
   - `curl http://127.0.0.1:8787/healthz`：sha 以 `a641cf2` 开头，contentDigest 以 `de829c8a` 结尾，lootReplayDigest 以 `62c76cb9` 结尾，netProtocol 5
   - 打开 `<公网地址>/?mode=online&server=ws`：右下角两行都是 `a641cf2`、内容 `de829c8a`，没有“版本不一致”；点“匹配”有反应
   - 回复用户：公网地址、四个字段、以上结果

## B. 跨网验收（另起任务做）

### B.1 准备

两台物理电脑 A、B，走不同网络（例如 A 家里宽带、B 手机热点或朋友家）。桌面 Chrome 或 Edge，不用无痕窗口。一局约 30–40 分钟；每个准备期至少买一张牌或升一级、把单位放上棋盘，不然 3–4 阶段就会被淘汰。旧页面开着的先刷新。

### B.2 逐项

| 步 | 时机 | 做什么 | 通过标准 |
|---|---|---|---|
| W0 | 开始前 | 两台打开 `<公网地址>/?mode=online&server=ws` | 右下角两行都是 `a641cf2`、内容 `de829c8a` |
| W1 | 开局 | A、B 都点匹配，A 点开始 | 同一局，8 席：两个真人 + 6 个机器人 |
| **W2 法球领取（v15 新）** | 1-2 起每个野怪回合 | 法球掉在棋盘上，**手动点击领取**；至少一次留到下回合再领，至少一次在战斗中点 | 点了才进背包/备战席；不点的跨回合还在；战斗中点的战后结算入库；备战席满时英雄按原售价折金币 |
| W3 强化（v15 新） | 2-1、3-2、4-2 | 三张卡各有一个刷新键，**先刷一张**再选 | 只换被刷的那张，等级不变，该卡刷新键变不可用；A、B 同一轮等级相同；中文名、图标、说明齐全 |
| W4 轮选 | 2-4 | 双方手动选 | 两边归属一致 |
| **W5 侦察（v16 改）** | 任意准备期 | A 点右侧 B 的头像看 B 的棋盘 | 能看到 B 的强化、装备、场上单位、备战席、异常；看不到连胜连败、卖价、卡池份数。B 有终极英雄晋升的四星单位时，**显示四颗铂金偏青绿的星**（不是三颗金星加一颗） |
| W6 PvP | 任意一场 A 对 B | 两边同时看 | 战斗过程、胜负、血量变化两边一致 |
| **W7 重铸器 / 复制器（v16 新）** | 2-7、3-7、4-7 的法球；任意法球 | 拿到“装备重铸器”就用在一个有装备的单位上；拿到“英雄复制器 / 次级英雄复制器”就用在一个单位上 | 重铸器一次把该单位**全部**永久装备换成同类别别的装备，换下的进背包不自动穿；复制器得到一个同名英雄法球，点了才领。备战席满时复制器被拒绝并提示。没拿到就记“未触发” |
| **W8 史诗奖励（v16 新）** | 5-7、6-7 打完野怪 | 领取掉落 | 出现锻造器时弹四选一，选一件进背包；或出现金铲铲冠冕。A、B 各自独立。没活到或没触发记“未触发” |
| **W9 终极英雄四星（v16 新）** | 4-6 异常 | 若选项里有“终极英雄”就选它并确认 | 单位说明显示“再 N 次回合结算后晋升四星”，到点后棋盘、悬停卡上显示四颗铂金偏青绿星；卖出价等于同卡三星。没出现记“未触发” |
| W10 刷新 | 3 阶段准备期 | A 按 F5 | 回到原座位，金币、等级、棋盘、备战席、装备、未领法球和刷新前一样 |
| **W11 断网自动重连（v13 后新加心跳）** | 4 阶段某场战斗中 | B 关 Wi-Fi 或拔网线约 30 秒再连回，**不要刷新** | 断网期间 B 显示“重连中”，A 那边 B 标“断线”；恢复后 B 不刷新自动回到原座位。记恢复到接回的秒数。没接回就等 60 秒再 F5，记“自动重连失败、刷新可恢复” |
| W12 终局 | 排名出来 | 两边看排名 | 两边一致，1–8 名各一次；最后 `/healthz` 的 `room.fault` 为 null |
| W13 延迟与内存 | 全程 | 记体感卡顿；终局前读一次本机 `/healthz` | 记 A、B 网络类型、有无明显卡顿；记 `rssBytes`（参考门槛 1 GiB） |
| W14 3D（可选，不算失败） | 任意时 | 若用户服务器上已放好 3D 素材：打开 `<公网地址>/?mode=online&server=ws&render=3d&assets3d=<素材地址>` | 能进局、模型和特效出现；记首次下载用时。素材地址不加口令 |

可选：第三台设备在对局中点“匹配”，应提示“对局正在进行，请等待本局结束”。

### B.3 证据

放在桌面 `set13\v16-public-test\`，不含令牌、隧道账号：`healthz-start.json`、`healthz-final.json`、`version-A.png`、`version-B.png`、`W2-*.png`、`W3-*.png`、`W5-scout-*.png`、`W7-*.png`、`W8-*.png`、`W9-*.png`、`W10-before.png`、`W10-after.png`、`W11-*.png`、`W12-ranking-A.png`、`W12-ranking-B.png`、服务窗口本局日志 `game-server.log`。

### B.4 报告

写到桌面 `set13\v16-public-test-report.txt`：

```
v16 外网验收报告
提交：a641cf2738d9d647aabdf61feb6f597d2b718ace
公网地址：<地址>
结论：通过 / 部分通过 / 失败（是否已停服）

一、部署核对：/healthz 四个字段
二、逐项结果：W0–W14 每项一行，写“通过 / 失败 / 未触发”和一句依据；W11 写秒数；W13 写 rssBytes
三、发现的问题：现象、哪一步、截图文件名
四、证据目录完整路径
```

### B.5 回滚

严重问题（对局异常结束、两边状态不一致、重连回不到原座位）：确认没有进行中的对局后停掉 v16 两个窗口，保留日志；回报后等用户决定。要恢复 v13：在 v13 原目录按原方式启动，对外指回去。

---

## 部署提示词（用户贴给 ChatGPT）

```
按 GitHub 仓库 catfish-xn/cat 部署 v16：在新目录 cat-v16 clone，git config core.autocrlf false，checkout 固定提交 a641cf2738d9d647aabdf61feb6f597d2b718ace，npm ci、npm run build:game、设 VITE_CAT_SHA 为该提交后 npm run build。先看 8787 的 /healthz 没有进行中的对局，再停掉 v13 两个窗口，用和 v13 一样的方式启动服务（CAT_HOST=127.0.0.1、PORT=8787、CAT_GIT_SHA=该提交）和 vite preview 5173，对外方式沿用 v13，不设口令。核对 /healthz：sha 开头 a641cf2、contentDigest 结尾 de829c8a、lootReplayDigest 结尾 62c76cb9、netProtocol 5；页面右下角显示 a641cf2。不改代码、不推送。完成后回我公网地址和核对结果。v13 目录别删，出问题切回去。
```

## 测试提示词（部署完成后另起任务）

```
读桌面 set13 里的 v16-public-deploy-task-2026-10-20.md，按 B 部分做 v16 跨网验收，报告写到桌面 set13\v16-public-test-report.txt，证据放 set13\v16-public-test\。不改代码。
```
