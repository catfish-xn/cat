# 开局奇遇 PR9：v21 epoch 录制与合入前验收

**结论：PR9剩余Crown失败已全部修复，本地最终验收通过；无待处理生产bug或玩法取舍。未联网、未提交，远端 `ci-required` 尚未运行。**

## 身份与范围

工作分支 `codex/encounters-pr9-epoch`，录制输入 HEAD `3394f10446b6a6c2a793d8bd96be6932ebf06374`，本轮输入 HEAD `3b8e2c13bd314375ded86c6b08c47ab8edec0bf7`；父 epoch `v20-black-market`，基线 `multiplayer@83fd7fa58fc7c935229c8f8866b14ec9d716accd`。短名采用 **v21-opening-encounters**，rules/content 保留已集成的完整身份：

- rules：`s13-g2-3-v21-opening-encounters-battle-equipment`
- content：`s13-14.24b-g2-3-v21-opening-encounters-battle-equipment`
- CONTENT：`fnv1a32-utf16:35273c97`；LOOT_REPLAY：`fnv1a32-utf16:ef359464`
- schema/save/replay/command：**12/8/6/6**，NET **6**。

此 epoch 同时包含开局奇遇 PR1/2/4/5/6/8、实时战斗装备第2阶段和延后至下一准备阶段的收入。本轮仅修改测试、审计脚本与验收文档；输入HEAD已包含用户修复的回放原请求槽位保真。本轮没有修改 `src/`、玩法或数值，没有修改 CI 门槛、workflow 或超时。全程离线、无下载、无提交；不声称远端 `ci-required` 已运行。

## 录制与字节证据

主入口：`node scripts/verify-v21-opening-encounters-epoch.cjs --write` 录制，随后不带参数逐项重算校验。依赖顺序为身份、房间快照、release、Herald、inputs、live-reveal、transfer，再做独立检查、补充场景和历史字节核对。inputs 引用 Herald 字节，因此沿父脚本实际依赖顺序生成。

| 新夹具 | 原因与生成证据 |
| --- | --- |
| `tests/v21-opening-encounters-content-baseline.json` | 新身份及首战状态/事件/RNG hash；`release-audit.json` |
| `tests/fixtures/m5/full-match-golden.v21-opening-encounters.json` | 四条公共路线新身份/状态；各33战、终局胜利、round38，原命令与完整事件账本逐项相等断言保留 |
| `tests/fixtures/v21-opening-encounters-recorded-states/{cannon,sniper}.json.gz` | 各67份实际状态；原始对象与文本严格恢复，SHA-256/长度/首个不同字节见 `release-audit.json` |
| `tests/fixtures/v21-opening-encounters-herald-raw/` | 五份原始 Herald 场景先生成后加载恢复器；开战和15拍往返，目录 manifest/trajectory 及 `input-fixture-audit.json` 留证 |
| `tests/fixtures/v21-opening-encounters-{c19-seed-9-minimal,b8-fingerprints}.json` | 当前战斗输入与 identity；保留原 tick/伤害/状态/事件精确断言；`input-fixture-audit.json` |
| `tests/fixtures/v21-opening-encounters-transfer-route.json` | 当前 transfer 路线锚点；独立重算与 `--check` |
| `tests/server/fixtures/battle-start.json` | 从 seed20261012 自然推进一真人买XP、七机器人，冻结 round3/9/23；同快照切片/同步初始化 tick0/1 的完整状态、输入、帧、账本 SHA-256 一致；`battle-start-audit.json` |
| `tests/fixtures/v21-opening-encounters-chest-trial.{ts,json}` | 旧seed554变为棱彩前奏；独立搜索真实白银 Manaflow I 路线，最终seed29997保留原tick79/80/179/180/220/344/451/452八个边界、两层护腕、三次脉冲、死亡及完整恢复续跑；`chest-trial-audit.json` |

`battle-start-slices.test.ts` 的旧 `9d9ea671 baseline` 标记改为录制输入 HEAD；新基线由脚本生成，未手填 hash，切片一致性断言不变。live-reveal 保留 tick44 双源死亡 seq382/383、Loris tick437、Zyra tick176 各1收据，以及 unloaded tick106/seq822 的0新掉落。

历史保护范围为 v20-black-market 及更早版本的393个 fixtures/证据/录制脚本，加上单独保护的 `tests/fixtures/g2-4b-herald-raw/manifest.json`。逐文件长度与 SHA-256 见 [history-preservation.json](evidence/v21-opening-encounters/history-preservation.json)；当前消费者修改的前后字节见 [consumer-byte-audit.json](evidence/v21-opening-encounters/consumer-byte-audit.json)。没有覆盖历史 golden 或伪装身份迁移。

## 消费者适配与失败分类

- **身份/当前指针**：CURRENT Herald、M5/M8 golden、B8/C19、transfer/current-epoch 等转向新目录；`opening-random-identity` 保留历史断言并增设当前断言，旧 rules/content/digest/schema/protocol 严格拒绝恢复；save/replay 旧版本与未来版本拒绝向量同步。
- **已批准收入时序**：match-contract、loot-orb、g2-3、M5、s13-p1、server/t10 区分结算可花余额与下一准备收入；逐项保留准确金额、利息、投资成长、重复推进不重发断言。
- **开局选择/独立 oracle**：oracle 使用独立字面权重表、BigInt FNV/LCG 补齐强制强化档位，未调用生产实现；修复 g2-augments、B8 cannon oracle、live-reveal。共享席位合成夹具携带相同 openingEncounter/augmentTierSeed；D11 严格恢复场景另改用真实提供的选项替代伪造 offer。
- **公开路线变化**：Crown/TG 先完成新增开局选择，读取实际物品出生 ID；seed307 黄金盛典经两次公开免费重掷选 Manaflow II，仍保留原战斗精确掉金断言；宝箱路线以录制场景替换旧固定种子；最终seed29997在公开免费重掷后取得 Manaflow I，八个原边界tick全部保持。
- **测试设施**：战斗任务 API 精确键集合新增 `queueEquipment`；开局导入循环导致原异步 mock 未注入实际 grant 导出，改为模块初始化后 spy，保留故障原子性断言。Crown 终战装备篡改由更早的完整事件账本校验拒绝，更新准确拒绝原因。
- **负载超时**：探索轮并行负载下的7个文件单独重跑59/59通过，未调高超时、未跳过测试。

探索轮在新夹具尚未全部生成时运行：6868用例，6579通过、212失败、77跳过；失败包含缺文件、旧身份级联、时序/公开路线和负载超时，不能当作最终验收。42个失败文件及212条失败断言的分类清单见 [exploratory-failures.json](evidence/v21-opening-encounters/exploratory-failures.json)。最终复验以“最终验收”节为准。

## S13_RULES_GAP

文档顶端标记当前 v21，并把 v20 标记为历史。补齐延后收入、致死不补发、下一拍装备、冻结羁绊、纹章自身属性，以及每局一次独立流/全场同结果/关闭不归一化、前奏终章其余档位等权、锻造器四选一等已批准约定。明确训练师/梅尔奖励/沃里克等尚未批准内容仍关闭，不把工程约定写成官方数值。

## 最终验收

| 检查 | 实际结果 |
| --- | --- |
| `npm run typecheck` | 通过，退出0 |
| Crown + 槽位回归，maxWorkers=1 | **57/57通过**：Crown56例、槽位回归1例，0失败/0跳过 |
| 新epoch verify（只检查） | **15/15通过**，545.69秒；源码指纹未改，录像未重写 |
| 全套fast，maxWorkers=16 | 524文件、6913例：6892通过、1失败、20未执行；退出1，767.651秒 |
| 负载超时文件逐个maxWorkers=1 | 5文件、38/38通过；原超时不变 |
| 按每个文件最新结果合并 | **6913通过、0失败、0跳过**，524文件全部通过；明确是全套+单文件复验口径 |
| 字节保护 | 393历史文件及指定Herald manifest完全不变；另核对426个当前fixtures/基线文件与输入HEAD字节一致；`git diff --check`通过 |

负载复验文件：`tests/assets3d-fx-pilot.test.ts`、`tests/server/g2-4b-artifact-forge-room.test.ts`、`tests/server/g5-battle-ranking.test.ts`、`tests/server/projection-wire.test.ts`、`tests/server/replay-client.test.ts`。

fast自动生成的 `docs/evidence/playtest-1022b/bench-timing.json` 已恢复输入HEAD原字节，生成结果另留在artifacts中。

完整15例结论、命令、退出码、原始结果SHA-256及最终数字见 [validation.json](evidence/v21-opening-encounters/validation.json)。本轮没有执行build/browser/timing项目，先前build结果不作为本轮新增验收。

## 已修复：原请求槽位保真与 Crown 旧语义预期

原位合成的真实生产问题已由输入 HEAD `3b8e2c13` 修复：合成结果位于 slot0，不代表用户请求的是 slot0；`src/replay/history.ts` 从 `combat.pendingEquipment` 捕获原请求槽位。回归测试为 `tests/battle-history-equip-slot.test.ts`，本轮 Crown 的 slot0/slot2 两例进一步验证前缀、完整战斗、对象/文本恢复与下一战逐拍一致。已删除的复现脚本和 blocker JSON 不再作为当前证据。

本轮修复前复现为 **56例中15失败**，但 slot2 已由生产回放失败变成旧 `slot:0` 断言失败。逐例核对后，当前15例均可按已批准语义适配；没有新增生产 bug，没有修改 `src/`，没有规则取舍需决定。以下名称均位于 `M7/S7 combat equipment command replay`；完整原名称及分类写入 validation.json。

| # | 原失败用例 | 结论与修法 |
| --- | --- | --- |
| 1 | consumable use / combine（M10） | 过时终点：真实移除→合成→穿戴在下一拍影响本战，endTick **274→172**，仍 playerWin；remove/reequip 保持274，恢复及下一战逐拍全量断言保留。 |
| 2 | inventory combination / equip=true（M8） | 过时终点：穿戴后下一拍生效，endTick **164→103**；equip=false 仍164。保留物品、命令、前缀/终态及续战精确断言。 |
| 3 | only command tick / ordinary（M9） | 过时拒绝层：命令移至0/69先报“事件缺失或内容错误”，移至2报“内容校验”；只改收据tick报 `battle equipment command sequence`，删tick报 `extra battle equipment receipt`。三种入口逐项验证。 |
| 4 | only command tick / in-place（M9） | 过时终点和拒绝层：**138→103**；0/2/69、单改收据、缺tick的拒绝层与第3项相同，库存合成对照仍严格报历史资源不一致。 |
| 5 | both tick claims →0（M9 boundary） | 旧等价假设不成立：effectiveTick变1，tick1首次命中与tick35过量伤害改变；事件及完整状态不等价，胜负/endTick相同。详见下表。 |
| 6 | both tick claims →2（M9 boundary） | 旧完整状态等价假设不成立：effectiveTick变3，两次生效点之间无相关命中，事件完全相等；装备收据/终态哈希不同。 |
| 7 | both tick claims →69（M9 boundary） | 旧等价假设不成立：effectiveTick变70，tick35/69仍用大剑，tick103实际扣血量随之改变；事件及完整状态不等价，胜负/endTick相同。 |
| 8 | existing-target in-place tampering | 过时拒绝层：改投合法板凳目标后，原场上合成不再发生，先由完整事件比对拒绝。三种入口精确报“事件缺失或内容错误”。 |
| 9 | ordinary-equip inventory combination | 过时拒绝层：把库存合成伪装为场上穿戴，新增下一拍效果；先由完整事件比对拒绝，三种入口精确断言保留。 |
| 10 | temporary item roll prefix（M9） | 过时构造：原终战态已被新增装备序列校验拒绝；保留该拒绝，再用真实后续准备状态移植另一命令顺序的临时装备账本/投影，确认本地结构合法而三种入口仍报“历史临时装备收据前缀不一致”。 |
| 11 | in-place sword / requested slot0 | 过时拒绝层：合法前缀、终战和续战仍精确通过；漏掉合成先在事件校验处拒绝，替换旧资源前缀错误预期。 |
| 12 | in-place sword / requested slot2 | 原真 bug 已在输入HEAD修复；本轮修复遗留旧断言：记录必须是请求slot2，合成品实际仍在slot0。保留完整恢复/续战，漏命令严格拒绝。 |
| 13 | reordered commands | 过时拒绝层：同tick两个合法穿戴重排改变有序装备收据，先报“内容校验”；三种入口均拒绝。 |
| 14 | extra commands | 过时拒绝层：额外合法穿戴改变下一拍战斗，先报“事件缺失或内容错误”；三种入口均拒绝。 |
| 15 | missing commands | 过时拒绝层：缺少穿戴改变下一拍战斗，先报“事件缺失或内容错误”；三种入口均拒绝。 |

### 移动 tick 的精确等价边界

均从真实 seed7 命令路线重跑，原场景在 tick1 请求原位合成、effectiveTick=2；下面三条仍在 **tick103 / playerWin** 结束。测试保留56例，既不删除原用例，也不把恢复降为“不抛错”：对真实新时点记录执行对象/文本精确恢复和下一战全量逐拍比较；对仅移动命令及资源收据的伪造记录执行三入口拒绝和独立回放拒绝。

| 请求tick / effectiveTick | 相对原场景的精确差异 | 结论与拒绝位置 |
| --- | --- | --- |
| 0 / 1 | tick1 raw49→69、实际伤害49→74；tick35实际伤害61→36、过量42→67。其他事件字段逐项相等。 | 胜负和终点相同，事件不同；仅移动两处tick的状态被装备序列拒绝，记录独立回放被事件比对拒绝。 |
| 2 / 3 | 全部战斗事件逐项相等；装备收据effectiveTick从2变3。 | 仅事件/结果等价，完整状态和记录不等价；伪造状态被装备序列拒绝，记录独立回放被内容哈希拒绝。 |
| 69 / 70 | tick35 raw69→49、mitigated103→68、过量42→7；tick69实际伤害74→49；tick103实际伤害36→61、过量38→13。其他事件字段逐项相等。 | 胜负和终点相同，事件不同；伪造状态被装备序列拒绝，记录独立回放被事件比对拒绝。 |

三个场景在把资源tick及装备收据effectiveTick同步到真实时点后，完整终局Match恰好等于各自真实执行；这不代表旧事件账本可以复用。测试明确比较完整事件账本的所有字段，仅对上述实际变化字段给出精确的新值。没有改生产伤害、运算顺序或RNG。

### 本轮改动与证据边界

- `tests/g2-4a-crown-history.test.ts`：仅上述预期/构造适配，原56例保留，未改超时。
- `scripts/audit-encounters-pr9-adaptations.cjs`：旧脚本对本轮输入HEAD已纳入Git的新增槽位回归测试及新epoch文件执行 `git show <旧基线>:<新文件>` 会失败；现在用只读 `ls-tree` 区分新增文件，明确记录 `previousExists:false` 及空前像、当前真实字节哈希，不漏审新增文件。本次审计覆盖60个文件，其中19个相对录制输入HEAD为新增文件。
- `docs/OPENING_ENCOUNTERS_PR9_REPORT.md`、`docs/evidence/v21-opening-encounters/{validation,consumer-byte-audit,epoch-verification}.json`：更新结论、当前消费者字节和最终验收证据。
- 源码指纹核对1512项无变化；现有epoch指纹范围未包含 `src/replay/history.ts`，因此无需更新任何源码指纹。verify只用检查模式，录像未重写。

当前结论仅覆盖本地离线验收；未联网、未提交、未触发远端 `ci-required`，未调整 CI 门槛或 workflow。正式合入仍按原交叉审查与用户最终合并流程执行。
