# B 方案第1阶段验证记录（v20）

基线：`14006984600a08f8dd96fa776bf9ba1d1048ff24`；工作分支 `codex/live-combat-stream`。全程未联网、未 push，未修改 Git 元数据。Node v24.21.0；依赖按 package-lock 离线安装。

## 实现与版本

生产服务器启用单次实时推进；固定50ms逻辑tick、步间20ms墙钟预算、同一边界公平推进。combat-open / combat-chunk / combat-end 共用首遍 recorder，玩家、重连和 watch 同源。完整领域账本独立保留，不随网络帧截断。终局后才规划提案和共享池奖励；尾部播放后唯一提交，期间资产操作使用最新状态重规划。

v19已占schema9/save5/replay4/command4，独立v20顺延至 **schema10/save6/replay5/command5/NET6**。rules/content为 `s13-g2-3-v20` / `s13-14.24b-g2-3-v20`；CONTENT `fnv1a32-utf16:ecca0d49`、LOOT `fnv1a32-utf16:ca40ec4c`。旧身份严格拒绝运行态恢复，不迁移。

## 确定性与历史字节

- 新流式任务与旧整轮resolver逐字节对照：seed 7 / 42 / 991，各8席前5回合（包含PvE及PvP），battle、完整ledger、proposals、damage、roundResults与双方recorder投影一致。
- D11金币从同一首遍任务采样，完成结果可按日志重执行，回放字节与流相同；未完成PvE前缀serialize/restore后继续，终局和剩余事件相同。
- 四条完整公共命令路线 cannon / sniper / mage / sniper-caitlyn：新epoch独立录制，脚本强制断言命令序列与每轮事件hash和v19相同；67个检查点经严格恢复复核。状态hash包含新身份，单独保留新epoch，不覆写旧golden。
- 独立epoch核验共10步exit 0，见 [epoch-verification.json](epoch-verification.json)。本环境Node同步子进程会附带EPERM采集错误，即使实际status为0且有完整输出；临时预加载仅接纳这种status0输出，不忽略实际非零错误，相关限制保留在JSON中。
- v19及更早历史夹具/原始字节经本地Git blob对照；`g2-4b-herald-raw/manifest.json` SHA256仍为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

## 相关回归与静态检查

最终定向命令：

```sh
npm test -- tests/server/combat-stream.test.ts tests/server/combat-stream-client.test.ts tests/server/net/combat-stream-memory.test.ts tests/b8-resumable-battle.test.ts tests/server/net/messages.test.ts tests/server/live-bank.test.ts tests/m8-b9-compatibility.test.ts tests/t13-identity.test.ts tests/server/v15-orb-claim.test.ts --maxWorkers=1
npm run typecheck
git diff --check
```

9个文件、65项测试全部通过（107.29秒）；最终typecheck、diff检查均exit 0。定向日志位于 `/tmp/live-related-final.log`。
覆盖开场前无整轮结果、连续tick、结算一次、前缀恢复、步数超时不伪造终局、20ms让出与封口、D11同源、客户端waiting/end/重复/缺口/关键帧位置，以及生产服务器内存传输下的游标续传、观战同源、慢客户端隔离和旧协议拒绝。

真实socket版本 `tests/server/net/combat-stream-wire.test.ts` 保留为常规测试；沙箱listen 127.0.0.1返回EPERM，两项不能在本环境完成。内存传输仅替换HTTP/ws I/O，执行真实createGameServer/Room/协议/单写队列/投影；不声称真实网络已验收。

## 四分片fast（每片一次）

| 分片 | 退出码 | 秒 | 通过 / 失败 / 待执行 |
| --- | --- | --- | --- |
| 1/4 | 137 | 496.71 | 未生成报告 |
| 2/4 | 1 | 820.91 | 1528 / 12 / 8 |
| 3/4 | 1 | 692.13 | 1701 / 11 / 20 |
| 4/4 | 1 | 236.4 | 1485 / 22 / 0 |

四片首次运行均已结束，结果未全绿；被终止的分片未获得测试结果。完整失败名称、hook失败和错误首行见 [fast-shards.md](fast-shards.md)，结构化汇总见 [fast-shards-summary.json](fast-shards-summary.json)。超时未通过基线复跑证明为既有失败；没有扩大超时、跳过失败或将环境错误算为通过。

## 分片后的定向修正与复核

四片首次结果保持原样归档，不覆写失败记录。修正当前epoch的两个旧身份断言（D14与epic rewards）；存档损坏测试原来使用的未来6/5现已合法，改为当前版本+1，同时保留5/4历史版本拒绝检查。未改规则、历史夹具、超时或skip。

`npm test -- tests/d14-anomalies-source.test.ts tests/epic-loot-reforger.test.ts tests/m6-persistence.test.ts tests/g2-4b-unstable-chest.test.ts --maxWorkers=1`：**4文件、120项全部通过，54.27秒**。这也复核了第3/4被标记失败但未附错误的宝箱文件；首次错误原因仍未获报告，不作推断。日志 `artifacts/v20-phase1/final-focused.log`。

第1/4因首次exit137无报告，单worker补跑已结束：**1382通过 / 15失败 / 0待执行**，637.96秒，exit 1。15项失败均为listen EPERM；完整名称已加入 [fast-shards.md](fast-shards.md)。初次exit137记录仍保留。补跑不修改超时/skip，仅降低worker数；日志/JSON保存在 `artifacts/v20-phase1/shard-1-serial.*`。

最终相关回归合计13个不同文件、185项通过（65+120）；所有修改后的文件最终typecheck exit 0，日志 `artifacts/v20-phase1/final-typecheck.log`。四片首次报告中的3项版本预期错误已定向复核通过；EPERM、9项时限超时及2个hook/文件级异常仍保留，不能声称fast全绿。第3/4未附错误的宝箱文件已单独全量通过，但首次原因仍未确定。

## 范围与剩余风险

阶段2 `applyBattleEquipment` 未实现；挂点为 `Room.nextBattleInputTick`、`CombatStream.nextEffectiveTick` 和推进前的单写边界。现有装备命令仍遵循开局冻结语义。
单tick、tick0初始化及终局规划不能抢占；20ms是步间预算，不是硬实时上限；尚无重负载3-x/3-6真机p95/p99保证。无新增数据库或进程重启房间恢复；仅承诺现有Match领域前缀恢复和网络cursor续传。
设计目录 `设计稿本地目录` 不在可写根内，并排说明未写入；仓库副本见 [LIVE_COMBAT_PHASE1](../../LIVE_COMBAT_PHASE1.md)，用户可复制至设计目录。
