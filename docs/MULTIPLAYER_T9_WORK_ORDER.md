# T9 派工单（规则侧部分）：单房压测脚本与发布说明

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/MULTIPLAYER_RENOVATION_V2.md` N7 与第 8.2 节（性能口径）、`AGENTS.md`（T9 压测脚本与发布说明归 Codex，部署执行由用户授权）

## 0 现状
规则侧六个任务包（T1/T2/T3/TP/T7/T5R）全部合入。Claude 正在做 B5（卡池接入）、B6（机器人调度）、B7（投影接线）、C6（回放客户端）。服务器入口 `npm run serve:game`（`dist-server/game/main.mjs`，环境变量 `PORT/CAT_HOST/CAT_SEED/CAT_PREP_SEC/...`），Node 测试客户端 `src/server/net/test-client.ts`。本单只写脚本和文档，不改 `src/server/`、界面、规则。

## 1 压测脚本 `scripts/loadtest-room.cjs`
- 启动一个真服务器进程（或连接已启动的 `ws://`），用 8 个 Node WebSocket 客户端（复用 `test-client`）加入同一局：可配置真人席数（其余机器人）、每席每轮随机合法操作数、准备/选择/结算秒数。
- 测量并输出 JSON：每轮准备阶段命令往返 p50/p95（分开报告网络耗时与服务器处理耗时）、每场 PvP 与 PvE 的服务器计算耗时、每轮下发字节（`state`/`view`/`replay` 或 `combat` 分列）、进程 RSS 高水位、整局时长。
- 连续跑 N 局（默认 3）验证内存不单向增长。
- 不要求通过任何阈值；输出口径按 V2 8.2 写入文档。

## 2 发布说明 `docs/MULTIPLAYER_RELEASE_NOTES.md`
- 目标机 4 核 8G：Node 22 LTS 安装、`npm ci --omit=dev`（确认运行依赖只有 `ws`）、`npm run build:game` 与前端 `npm run build`。
- 进程管理建议（systemd 单元示例）、环境变量表、日志位置、停止与回滚步骤（保留上一个 `dist-server/game` 目录）。
- 反向代理示例（Caddy 或 Nginx 二选一）：静态前端 + `/ws` 升级到 WebSocket + HTTPS/WSS；说明前端 `?server=ws` 的默认地址如何对上。
- 首版边界：单房间、服务器重启即中断旧局、准入由用户在网页入口自控、容量只验证一房。
- 验收清单：对照 V2 第 11 节逐条留空，由用户试玩时勾选。

## 3 验收
- [ ] `node scripts/loadtest-room.cjs --seats 2 --rounds 3` 能在本机跑通并输出 JSON；脚本不修改仓库其他文件。
- [ ] 发布说明能让一个不懂代码的人照步骤把服务器跑起来。
- [ ] 不改任何 `src/`。
