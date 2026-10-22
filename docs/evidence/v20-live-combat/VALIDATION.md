# v20-live-combat / XP68 合流验收

HEAD `c5c735cad69b1c7d5f413cc7d62b89a27ccf7f71`，MERGE_HEAD `db04d196e4a12933624add7d61be9081a639607f`；分支 `codex/live-combat-stream`。23处冲突内容已解除，Git元数据只读，索引仍有23个UU；全程离线、未push。`git diff --check`退出0。

## 身份与保留项

父epoch为 `v20-xp68`；schema/save/replay/command=11/7/5/5，NET6。CONTENT `fnv1a32-utf16:93fad04c`，LOOT_REPLAY `fnv1a32-utf16:49eb9cf0`。schema/save未增加字段，沿用父版11/7；replay/command从4/4升为5/5，标识实时流及逐tick输入语义。旧身份严格拒绝、无迁移。

经验8→9和9→10各68，经验表与上游字节一致。普通与流式PvP结算共用同一规划器，HP严格核对 `max(0,hp-damage)`；只有唯一、同battleId、来源mel的playerSaved事件可解释致死后1HP，另核对整条round record。补充已提交轮次的流式尾段防重，防止再次规划产生duplicate-settlement故障。

两个分支并集中的1681个历史文件及受保护manifest字节不变，范围包含旧证据、Herald raw/support、检查点、基线、golden、历史脚本与源归档。逐文件来源和SHA256见 [history-preservation.json](history-preservation.json)。当前实现/测试1325个源文件与录制来源364个文件均通过结束时hash核验；见 [final-audit.json](final-audit.json)。上游界面自动合并和本PR双游标、绝对排拍、缓冲、整拍推送保留项见 [merge-preservation.json](merge-preservation.json)。

## 确定性与相关测试

- 迅击、野火、搭档seed7/42/991：整轮、逐tick、2/7tick切片及CombatStream的完整结果、提案、回放字节一致。
- 黑市seed9/42/991：完整战斗、N选三候选、每项领取/保留、奖励收据与经济RNG字节一致。
- 经验68交易向量：等级8/9各17次正常付费买XP，恰好跨级；开战和每tick完整state/events字节一致。
- 梅尔seed42：同一冻结输入与同一实时卡池基础，整轮/流式完整结算、事件、状态、卡池字节一致；覆盖首次终局规划及尾段重规划。两种调度各自历史发布次数不同，不归一化或删除revision字段。
- 梅尔整轮/流式20项测试覆盖1HP存活、原始伤害、唯一收据、未达施法数/已消耗救命、错误伤害、缺少/错误来源/错误battleId/重复救命事件、HP记录不一致和重复提交。
- 保留八席多seed前5轮的完整结果/账本/伤害/回放对照、PvP第5轮与PvE第11轮战中买卖利息、绝对50ms排拍、双游标、四拍缓冲、整拍推送及逐tick空输入入口；非空输入仍明确拒绝。

相关集去重后35文件、991项，最终通过991，未通过0。首轮related为826通过、11项超时，保留原始报告；未改时限/测试代码/配置。复测选择原超时用例、hook阻断用例及M5路线必要的前置上下文，待分片及epoch完成后在单worker执行。首次名称筛选只匹配6项，发现后按标题后缀补跑遗漏18项；两份报告均保留，未重复已执行的6项，逐项结果见 [focused-results.json](focused-results.json)；未重跑整片。新增梅尔测试先暴露并修复尾段重复规划问题，原始失败日志留在忽略目录。

## Epoch、类型与四分片

显式重录11/11步退出0，见 [recording-verification.json](recording-verification.json)；随后默认只读核验11/11步退出0，见 [epoch-verification.json](epoch-verification.json)。四条公共路线各33战、cannon/sniper各67检查点、B8/C19、Herald五案、transfer、live-reveal均重算。命令与完整事件hash继承XP68；新epoch独立生成，未替换历史状态标签。

```sh
node scripts/verify-v20-live-combat-epoch.cjs  # exit 0，653.26 秒
npm run typecheck  # exit 0，54.79 秒
node scripts/update-content-identities.cjs --check  # exit 0，4.64 秒
```

四片各一遍，每批两片、每片一个worker：

| 分片 | 文件 | 通过 | 失败 | 跳过 | 秒 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1/4 | 124 | 1448 | 17 | 4 | 1284.01 |
| 2/4 | 124 | 1634 | 6 | 0 | 1546.76 |
| 3/4 | 124 | 1848 | 16 | 0 | 1636.52 |
| 4/4 | 123 | 1533 | 19 | 0 | 829.31 |

原始合计495文件、6463通过、58失败、4跳过。分类：timing-pass-on-idle-retry=3、environment-listen=48、environment-pipe=7；另计hook失败：{'timing-hook-pass-on-idle-retry': 1}，其阻断用例的复测结果单列。环境失败依据每项EPERM堆栈或Received错误，计时失败另列；空闲复测通过不改写首轮失败数。完整证据见 [fast-results.json](fast-results.json)、[fast-failures.json](fast-failures.json)。

原始Vitest JSON和日志在 `artifacts/v20-live-combat-tests/xp68-*`，不提交。沙箱不能监听真实socket/部分子进程管道，环境失败需在允许监听的环境复核。阶段2战中装备安装尚未实现，保持明确拒绝；没有新增账号、数据库或进程重启恢复。

## 留工作区

未写Git元数据；需在可写环境审阅、暂存23个已解冲突文件及新增测试，再完成当前merge。`artifacts/`、`dist/`和素材不纳入提交。最终审计见 [final-audit.json](final-audit.json)。
