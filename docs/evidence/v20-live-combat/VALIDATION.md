# v20-live-combat 验收

分支 `codex/live-combat-stream`，HEAD `e472df6d235ab54e7b670e5e97ba965c6d61707e`，MERGE_HEAD `2de5e26d088e4e86032bf571d51941c9b0ecd12f`，Node v24.21.0。全程离线、未 push、未写 Git 元数据；9处冲突内容已解除，但索引受只读限制仍有9个UU。`git diff --check`通过。

## 合并与身份

保留父版 B 补丁、PvE微光约束、黑市多候选/保留及 schema/save=11/7；NET6、replay/command=5/5，完整身份与升版理由见 [RELEASE_NOTES](RELEASE_NOTES.md)。受保护manifest和253个历史文件按MERGE_HEAD逐字节核验，逐文件SHA256见 [history-preservation.json](history-preservation.json)。

`merge-preservation.json`记录了预热实现4文件与MERGE_HEAD一致，服务端流调度/推送及客户端流缓冲4文件与原HEAD一致的SHA256；online-application自动合入的warm hints保持，未改视觉或素材。

## 确定性

- `tests/server/combat-stream.test.ts`：seed7/42/991、八席前5轮，对照旧整轮resolver的完整battle/ledger/proposals/damage/roundResults和双方回放；绝对排拍、两拍追赶上限、20ms步间让出、终局计划缓存与唯一结算均覆盖。
- `tests/live-combat-inputs.test.ts`：seed7/42/991同时激活迅击、野火、搭档，覆盖120tick周期与140tick窗口；整轮、每tick、2/7tick切片和CombatStream的JSON字节相等。
- 新增seed9/42/991炼金男爵对照：真实战斗完整结果及双方g23Facts/提案字节相等，再以相同已核算前缀结算黑市，比较三候选、逐项领取及保留、奖励收据、经济RNG和独立经济重演的完整JSON字节。
- PvP第5轮及PvE第11轮tick1成功买、卖备战席单位和刷新，按结算瞬间金币计算利息；sliceTicks=1/8的全部席位、战斗和卡池字节一致。
- 非空逐tick输入在推进前拒绝，可在同tick重试空输入，未追加成功日志；伪造非空/畸形日志被提案与回放边界拒绝。
- 四条完整公共命令路线cannon/sniper/mage/sniper-caitlyn，各33战，全部命令和每轮完整事件hash与父epoch一致；新身份独立重录，不改标签。cannon/sniper各67检查点通过严格text/object恢复与原字节序列化。Herald五案在production restore模块加载前先导出原始字节，再核验准备期、开战及15个后继tick。

## 定向测试

| 报告 | 文件 | 通过 | 失败 |
| --- | ---: | ---: | ---: |
| core-final.json | 8 | 132 | 0 |
| related.json | 19 | 380 | 0 |

共27个不同文件、512项通过。第一轮新增黑市测试把双席提案对象当数组，3项未执行经济断言而失败；已改为Object.values后重跑完整核心集132/132通过，首次报告保留在忽略目录，不改规则/超时/golden。

核心集包含live-combat-inputs、chem-baron-fix、v20-traits、server/combat-stream、combat-stream-client、net/combat-stream-memory、live-bank、net/messages。
相关集包含content-identity-constants、server/net/watch-stream、server/replay-client、g2-4a-crown-history、m6-persistence、t2-two-sided-battle、t3-round-settlement、t5r-combat-replay、server/two-sided-resolver、m8-b9-compatibility、match-contract、c19-missed-pulse、b8-resumable-battle、t13-identity、g2-3-lesser-shimmer-duplicator、g2-3-hook-failures、g2-3-integration、v19-part2、v17-orb-combo。

原始日志与Vitest JSON：`artifacts/v20-live-combat-tests/`。每个定向命令使用`npm test -- <上述文件> --maxWorkers=1 --reporter=default --reporter=json --outputFile=<报告>`；核心命令只用JSON reporter。未修改测试时限或跳过用例。

`npm run typecheck`退出0（62.04秒），见同目录`typecheck.json`和`typecheck.log`。

## Epoch与四分片

初次显式录制入口`node scripts/verify-v20-live-combat-epoch.cjs --write`，11步全部退出0；报告见 [recording-verification.json](recording-verification.json)。缺省入口再次按`--check`核验独立golden、输入和证据，不重写已录内容，最终报告见 [epoch-verification.json](epoch-verification.json)：缺省只读核验11/11步退出0，命令退出0，606.65秒。定向、类型、身份及epoch计数另见 [focused-results.json](focused-results.json)，父/当前完整根摘要见 [digest-comparison.json](digest-comparison.json)。

四片每片仅跑一遍，每批两片，每片一个worker，未改时限/skip或安装依赖：

```sh
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --shard=i/4 --maxWorkers=1 --reporter=default --reporter=json --outputFile=artifacts/v20-live-combat-tests/shard-i.json
```

| 分片 | 文件 | 通过 | 失败 | 跳过 | 秒 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1/4 | 123 | 1437 | 15 | 0 | 893.63 |
| 2/4 | 123 | 1625 | 5 | 0 | 1215.77 |
| 3/4 | 123 | 1838 | 16 | 0 | 1480.38 |
| 4/4 | 123 | 1535 | 19 | 0 | 723.95 |

合计 **492文件、6435通过、55失败、0跳过**；四片退出码均为1。55项全部为环境限制：48项`listen EPERM`、7项子进程管道`spawnSync ... EPERM`，**计时失败0、规则/数值/golden断言失败0**。子进程的Vitest JSON省略了嵌套error的errno，已将同一默认报告中的Received错误（含EPERM）逐项附入`fast-failures.json`，未仅凭测试名推断。未加载预加载器、未修改时限、未跳过用例、未重跑整片；环境失败不计为通过。

| 失败文件 | 数量 | 分类 |
| --- | ---: | --- |
| tests/explorer-bracer-restore-pressure.test.ts | 2 | environment-pipe |
| tests/g2-4b-pr161-restore.test.ts | 1 | environment-pipe |
| tests/server/e2e-replay-errors.test.ts | 4 | environment-pipe |
| tests/server/g2-4a-forge-timeout.test.ts | 1 | environment-listen |
| tests/server/g2-4b-artifact-forge-room.test.ts | 1 | environment-listen |
| tests/server/g2-4b-support-forge-room.test.ts | 1 | environment-listen |
| tests/server/legend-walk.test.ts | 1 | environment-listen |
| tests/server/lifecycle.test.ts | 1 | environment-listen |
| tests/server/little-legends.test.ts | 1 | environment-listen |
| tests/server/net/combat-stream-wire.test.ts | 2 | environment-listen |
| tests/server/net/heartbeat.test.ts | 4 | environment-listen |
| tests/server/net/live-bank-wire.test.ts | 1 | environment-listen |
| tests/server/net/server-close.test.ts | 2 | environment-listen |
| tests/server/net/server.test.ts | 13 | environment-listen |
| tests/server/net/slow-task.test.ts | 4 | environment-listen |
| tests/server/net/takeover.test.ts | 3 | environment-listen |
| tests/server/net/v17-avarice-reconnect.test.ts | 1 | environment-listen |
| tests/server/net/watch.test.ts | 7 | environment-listen |
| tests/server/projection-wire.test.ts | 3 | environment-listen |
| tests/server/replay-first-pass.test.ts | 2 | environment-listen |

最终分片结果与逐项失败分类见 [fast-results.json](fast-results.json)、[fast-failures.json](fast-failures.json)。环境`listen EPERM`、子进程管道`EPERM`、未证实原因的计时失败以及真实断言失败分别记录，失败不计为通过。

## 交付限制

真实socket受沙箱监听权限限制，内存传输回归覆盖生产队列/协议/游标/推送；真实网络失败须在可监听环境复核。阶段2即时装备安装未实现，20ms不是单tick硬上限，没有新增进程重启房间恢复。

Git元数据位于工作区外只读目录，按用户授权仅留工作区。可写环境审查后暂存跟踪文件及新epoch目录，再完成现有merge；生成物`artifacts/`、`dist/`及素材不纳入提交。

全部测试结束后的 [final-audit.json](final-audit.json) 确认：253个历史文件及受保护manifest未变、364个录制来源文件hash未变、9处冲突内容均无标记、`git diff --check`退出0；索引9个UU未写入，未联网、未push。
