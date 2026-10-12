# 交接记录（2026-10-12）

分支：`multiplayer`（0d97c60），今天合入 10 个 PR（#50–#60），类型检查与 246 个服务器/规则用例全绿。main 未动。

## 1. 今天改了什么

| 范围 | 文件 | 做了什么 |
| --- | --- | --- |
| 机器人（B6, #51） | `src/server/room/bot-driver.ts`、`room.ts`、`lobby.ts` | 补位机器人真打（T7 策略 → 同一命令闸门）；真人断线 60 s 后被接管，重连立即接回；`SeatPublic.controller`、`resumed.reclaimed`、拒绝原因 `seat-controlled`/`control-revoked` |
| 回放客户端（C6, #52） | `src/rendering/online/remote-session.ts`、`src/presentation/combat-display.ts`、`src/server/net/*` | 战斗改由紧凑回放逐 tick 播放，离线/联机共用渲染；删除逐 tick 帧、分包与 `combatTransport` |
| 资源释放（B8, #55） | `src/server/room/room.ts`、`battle-resolver.ts`、`net/server.ts` | `Room.dispose` 释放定时器/监听/冻结输入；战斗按时钟切片计算（`sliceTicks`）；`retained` 诊断计数 |
| 规则侧（#50 #53 #54 #56 #58 #59） | `src/simulation/*`、`docs/MULTIPLAYER_CONTRACT.md`、`scripts/loadtest-room.cjs` | 狼群回放修复；合同 §13.5；共用事件投影导出；压测脚本对齐 B8（八席三局 p99 约 30 ms、RSS 225–237 MiB）；`deploy` 原子互换单位（规则版本 `preparation-swap-v1`，digest 20b58a63，旧存档拒绝）；私有投影公开 `revealedLoot` |
| 真机修复（C7, #57；C8, #60） | `src/rendering/online/mode.ts`、`ws-client.ts`、`round-gains.ts`、`BoardScene.ts`、`strategy-panel.ts` | 座位凭证改 localStorage（按服务器地址分键，局终清除）；联机结算显示"本轮获得"；互换的拖拽文案与高亮；e2e：`tests/server/e2e/b6-bots.mjs`、`c6-replay.mjs`、`c7-playtest.mjs`、`c8-unit-swap.mjs` |

合并原则（已写进各 PR 评论）：帧已被 C6 删除，后续分支里所有帧相关代码一并删；切片、释放、机器人保留。

## 2. 遗留问题

- **C9 未做**：联机结算面板还用 `round-gains.ts` 差分（重连后不显示、掉落即升星会漏、战后扣费会抵掉）；#59 已公开权威 `revealedLoot`，待接线。派工单见 `docs/CLAUDE_WORK_ORDERS.md` C9。
- **用户未拍板**：把组件拖到已带组件的单位上是否自动合成（TFT 行为）。现在只能在装备页点选两件再合成。
- **性能**：PvP 一场战斗仍完整执行两次（权威 + 回放），规则入口不可分，后期回合准备截止后单次 300–650 ms（SR-B8-02）；PvE 每 tick 池守恒检查约 4.6 s/局（SR-B8-03）。Codex 评估各 2–3 工程日，未排期。
- **真机**：用户只在两台电脑上试了半局；C7/C8 之后没再人工试玩。回放"开战"过渡 400 ms 占尾段一半，网络差时最后几帧可能被结算打断直接跳结果。
- **已知测试噪音**：`tests/m5-replay`、`m6-integration`、`t5r-combat-replay` 在容器里并行跑会超时，单独跑通过；`round-commit.test.ts` 整局 30 s 墙钟在慢机器上偶发超时。CI 里联机整局用例因机器人真打从 36 s 涨到 52 s。
- **部署未做**：`docs/MULTIPLAYER_RELEASE_NOTES.md` 有 systemd + Caddy 步骤，尚未在任何服务器执行；main 未合入，正式站 `/cat/` 仍是单机版。

## 3. 明天第一步

1. 把 C9 派给 Opus（提示词：`读 docs/CLAUDE_WORK_ORDERS.md 派工单 C9，从 origin/multiplayer 开分支 claude/c9-loot-view，改联机结算面板读 revealedLoot 并删 round-gains.ts，开 PR 到 multiplayer`），策划验货合入。
2. 用户两台电脑再试一整局（步骤：A 机 `npm run serve:game` + `npx vite --host`，两边开 `?mode=online&server=ws&name=…`），重点看换位、合成、本轮获得、关页重开接回、打到排名结束。
3. 试玩通过后决定合 main 与部署：`git checkout main && git merge multiplayer`，按发布说明 §2–§4 部署；合 main 前提醒用户旧单机存档会因规则版本变化作废。
