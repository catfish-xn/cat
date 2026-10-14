# P3-A / P4-A / P5-A 一次规则发布

用户签收推荐包；第六批派工基线 `origin/multiplayer@66395eb`（包含 `8d7f08e`），分支 `codex/p3p4p5-numbers`，单 PR → multiplayer。读取 DISPATCH 第六批、S13_RULES_GAP §9；不部署、不合 main。

| 身份 | T13 / 发布前 | 本包最终 canonical |
| --- | --- | --- |
| CONTENT_DIGEST | fnv1a32-utf16:bd9c3a8e | fnv1a32-utf16:77f80fec |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:5cd0487c | fnv1a32-utf16:b8d9d7ca |
| rulesVersion | s13-rules-gap-v1 | s13-rules-gap-v2 |
| contentVersion | s13-14.24b-rules-gap-v1 | s13-14.24b-rules-gap-v2 |

扣血细分版本 `s13-player-damage-overtime-v2`；经验政策 `s13-14.24b-nine-levels-v1`；宝珠政策 `s13-orbs-project-v2` / `frozen-cumulative-weights-v1`。三项完成后共同 manifest 一次冻结，两种 digest 来自 canonical 输入，不手写运行时 hash。schema7/save3/replay3/command3、NET_PROTOCOL 2 保持，序列化结构未增加字段（计算函数的可选 roundId 不是存档字段）。

## 语义与独立向量

P3-A：普通 stage2…6 保持基础 2/5/8/10/12；PvP overtime-n 从第一场起基础17。项目加时映射到标准stage7，非完整7/8日程。selectPlayerBaseDamage 是 economy、proposal、唯一收据验证的同源 selector；冻结输入恢复重演后再 proposal 同源，不允许服务器/客户端补5。普通英雄每个存活者1，费用/星级不加权；胜方0、平局基础+存活数、镜像0、HP clamp、淘汰排序不变。

P4-A：现表符合 14.24b，68 为 16.1 值，不开 10 级。progression 的逐阈值用例包括75+1→9；match-economy 的 “F preserves a valid old-generation offer and checks max-level before money” 验证满级拒买、原对象/全字段/资源/RNG不变且无事件。

P5-A：球数保持1/2/3/2/2/2/2/1、配比50/50与90/9/1；sampler读取 ORB_RULES 冻结表，总权重决定 drawIndex 的 size，累计权重决定 template/tier。固定边界0/49/50/89/90/98/99及全部100个index逐一与独立旧分界向量比对；反向LCG种子653637408先产生0xffffffff被拒绝，再产生1012239698，index98，draws7→9，验证拒绝采样游标未变。同局八席、部分击杀、重连/重复推进零额外RNG由既有目标用例验收。

## 轨迹证据与旧档

`node scripts/record-p3p4p5-release.cjs` 用公开命令重录四条完整路线，独立 literal-table economy/loot ledger 每步验证；保留全部历史及 T13 原 golden、baseline、两份 gzip 录制。新 golden 为 full-match-golden.p3p4p5.json，新 recording 为 p3p4p5-recorded-states。134个before/after/final状态在四项明确身份替换后逐字段等于原T13；四条路线735条命令、132场回合事件hash全部不变，首战events/RNG trace原值不变。该结论覆盖普通阶段、P4/P5现表。审计文件含原件SHA，t13-identity继续验证保全与拒绝旧档。

本地最初旧工作树缺最新第六批；随后经GitHub连接器读到派工并fetch最新基线，移到规定分支。`node scripts/record-p3p4p5-release.cjs --check` 在最新基线重新执行全部路线和恢复验证，逐字节核对已录制artifact，不再次写身份/重录。旧原件仍只读。

`node scripts/record-p3p4p5-overtime.cjs <T13-worktree>` 在真实99d9eff与本包执行同一首场加时空对空。首次玩法差异在 overtime-1 proposal：baseDamage/damage **12→17**；唯一结算 **HP100→88** 改为 **100→83**。战斗tick0平局，terminal/事件、收入、XP、RNG完全相同；新增差异仅加时扣血。若剩3个普通敌人则旧12+3=15、新17+3=20。详见 evidence/p3p4p5/overtime-first-difference.json；后续每场败/平局多5可能提前淘汰改变配对与名次。

CONTENT与LOOT_REPLAY都改变：共同manifest新增扣血/经验政策并标识新的表驱动采样执行规则；P4/P5数字未改不能成为保留旧身份的理由。旧digest无法证明新规则续算正确，拒绝续玩且不迁移、不按新seed重抽；原文件仅保全/导出、新开局。联机完整Match保存恢复仍拒绝，冻结BattleInput恢复与账本唯一收据沿已有合同。

## 目标验收

验收命令与最终通过数见同目录 PR_P3P4P5.md。只运行用户指定目标集、typecheck、test:server-entry；全套由指挥在合并树唯一一次执行。没有跳过、放宽断言或改变预算。
