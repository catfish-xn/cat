# PvE 战利品留到下一场

2026-10-29。基于 `claude/v26-integration` @ `c9b30bc7`，已合入 `claude/v26-neutrals-1424` 与 `claude/v26-pve-loss-damage`。分支 `cursor/pve-loot-carryover`。未开 PR，未强推。

规则来源是原版维基，不是 18.1 的“仅 4-7 及以后”：Any loot that would have been lost from losing the round will be carried over to the next PvE combat。失败或平局里没击杀、因而本来会作废的条目，留到目录中的下一场 PvE，和那场奖励一起给。已击杀的仍在本场给。胜场里没击杀的、这一击把玩家打到 0 血的、以及没有下一场 PvE（含 6-7）的，仍然作废。不重抽、不改绑到别的野怪、不按“欠了多少”另补。

## 行为

- 单人：发放场战斗结算时，用原条目的冻结载荷自动入库，收据 `claimedRoundId` 是发放场。发放场再输，也先把上次留下的发完，只把这一场新没拿到的再往后留。
- 联机 / 本地房间 / bot：发放场一开始就能看见原来的法球（`unclaimedOrbs`）。bot 准备入口 `claimBotPreparationOrbs` 按原顺序领。终局或淘汰时，还没发的 `carried` 只发 `lootForfeited`，不写收据。
- 2D 掉落列表和 3D 棋盘用的是同一份私有投影：法球 id、来源单位、条目。没有新的 2D/3D 模块。当前法球计划里的自选数组是空的；若计划里有自选，同一套 `carried` → 战后选择也适用。

## 改动（文件:行）

- `src/simulation/pve-loot-carry.ts:22` `pveLossCarryRound`；`:35` `invalidCarryReason`
- `src/simulation/loot-types.ts:41` 进度状态 `carried`；`:54` `LootCarry`；`:80` 事件 `lootCarried`
- `src/simulation/loot-runtime.ts:67` 失败结束时写入顺延；`:84` `lootCarried`；`:130` 领取顺延条目；`:200` `dueCarriedDirectDrops`；`:208` `revealDueCarriedChoices`；`:219` `forfeitCarriedLoot`
- `src/simulation/match.ts:542` 战后打开顺延自选；`:549` 单人在本场结算把顺延直接奖励入库
- `src/simulation/orb-claim.ts:28` 联机到了发放场才把顺延法球列入可领；`:130` 终局先作废未发的顺延
- `src/simulation/loot-view.ts:46` 发放场的掉落列表带上顺延条目和来源
- `src/simulation/private-seat-view.ts:30` 私有投影保留这些法球，供 2D 码头和 3D `feedOrbs`
- `src/simulation/b8-restore.ts:313` 存档键含 `carry`；`:380` 顺延必须对得上失败结果、下一场 PvE、且没有击杀证据；`:570` 附近回放把发放场的顺延入库算进同一笔结算
- `src/simulation/orb-restore.ts:67` 联机账本接受 `carried`；`:92` 自选顺延
- `docs/M8B_POLICY.md:16`、`:49`、`:105`、`:108`、`:132`、`:261`、`:264`、`:274`、`:314`
- `docs/M8B_LOOT.md:230`、`:243`、`:411`
- `docs/MATCH_CONTRACT.md:771` 终局也作废未发的顺延，且不写收据

## 断言替换（没有删、没有放宽）

- `tests/m8-b8-loot-runtime.test.ts`：1-3 平局未击杀从“全部 forfeited”改为“全部 `carried` 到 1-4，且 `grantDirectLoot` 当时不发”。另加：同一场若结果改成胜，仍 forfeited，且没有 `carry`。2-7 失败未击杀改为每条 `lootCarried`，目标场是 3-7，重复揭示无新事件。
- `tests/loot-orb-claim.test.ts`：终局事件从“只有已赚未领的 forfeited+收据对”改为“先是每条未发顺延一条 `lootForfeited`（无收据），再是原来的已赚对”。已赚收据集合不变。
- `tests/epic-loot-reforger.test.ts`：当前身份从写死的 v25 改为 `M8_VERSION`（野怪分支已把身份改成 `s13-g2-3-v26-neutrals-1424`）。把规则/内容身份改回 v25 仍拒绝。
- `tests/fixtures/m5/oracle.g2.cjs`：独立账本必须接受 `carried`，并要求目标场就是下一场 PvE、失败结果、无击杀证据；`lootCarried` 与新增顺延一一对应。已击杀收据规则不变。

## 测试

通过（`npx vitest run … --maxWorkers=4`）：

- `tests/pve-loot-carryover.test.ts`
- `tests/server/pve-loot-carryover.test.ts`（房间、本地房间客户端、bot 领取、私有投影）
- `tests/m8-b8-loot-runtime.test.ts`
- `tests/loot-orb-claim.test.ts`
- `tests/pve-loss-damage.test.ts`、`tests/server/pve-loss-damage.test.ts`
- `tests/epic-loot-reforger.test.ts` 除下面两条纪元失败外

`npx tsc --noEmit` 通过。

## 未完成 / 执行端

不要 `--write` 重录。下面是纪元和内容摘要漂移，留给执行端统一处理：

- 野怪分支已把规则/内容身份改成 `s13-g2-3-v26-neutrals-1424`。`docs/evidence/neutrals-1424/remaining-failures.md` 里的 v25 存档、golden、`opening-random-identity`、内容 digest 仍然有效，本分支没有重录。
- 本分支额外仍失败、且在关掉顺延后也同样失败（14.24 野怪下指定站位不再打出原来的击杀数）：`tests/m8-b8-loot-view.test.ts` 的 terminal「two source deaths」「only component carrier」「tool carrier」（`neutralReceipts.deaths` 为 0，期望 2/1/2）。
- `tests/epic-loot-reforger.test.ts` 的 “a real 5-7 command path…” 与 “the real 6-7 terminal…”：`Invalid Match save: unsupported-version`（读的是 v25 `cannon.json.gz`）。
- 素材下载、提取、上传测试服（ssh tencent）、测试服部署、浏览器 / GPU 实机验收（codex-browser）未做。
- 2D gzip-9 顶层 `dist/assets/*.js`：`index` 511,939 + `phaser` 123,899 = **635,838**（上限 637,144，余 1,306）。没有新增懒加载块，3D 没有新代码。`dist/` 不提交。
