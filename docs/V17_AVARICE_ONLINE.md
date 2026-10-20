# v17 草稿：贪财化身恢复联机候选

基线为本地 `origin/multiplayer` HEAD `30cf934446719a0da0d3cea1667bf84a3df5296c`（含 v16）。离线施工，不写 Git 元数据，不修改服务器、服务器测试或表现层。独立 v17；PR 保持草稿，待 v16 发版收口后才合入。

## 改动与身份

`ANOMALY_OFFER_POLICY.multiplayerExcluded` 移除 `avarice-incarnate`，revision 为 `anomaly-offers-v17-online-avarice-enabled`，resumeWhen 为 `enabled-server-authoritative-live-bank-wired`，表示恢复条件已满足。候选入口仍为 `anomalyCandidates(multiplayer:boolean):string[]`；初选、付费刷新共用入口，权重、目标资格和失败原因不变。强化 60；异常单机 56、联机 **55 → 56**；按备战席、普通场上、可晋升三星一费场上目标过滤，两模式均为 **54 / 55 / 56**。

贪财化身数值沿用归档 `d11-fill-source.ts`：获取时 +5 金，唯一收据 `JSON.stringify(['d11-fill',choiceId,'avarice-gold'])`；基础增伤 15%，每完整 2 金 +1%，总上限 40%。不重复注册、不改数值和随机流。

| 身份 | v16 | v17 |
| --- | --- | --- |
| rulesVersion | `s13-g2-3-v16` | `s13-g2-3-v17` |
| contentVersion | `s13-14.24b-g2-3-v16` | `s13-14.24b-g2-3-v17` |
| CONTENT_DIGEST | `fnv1a32-utf16:de829c8a` | `fnv1a32-utf16:8a955c10` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:62c76cb9` | 保持 |
| RULES_GAP_MANIFEST digest | `fnv1a32-utf16:31950a0f` | 保持 |

按 #265 运行 `node scripts/update-content-identities.cjs --write` 后 `--check`；浏览器与服务器仍读取同一生成常量。schema/save/replay/command 为 **7/3/3/4**；领域多人协议 **4**，服务器网络消息协议 **5**，法球合同 `multiplayer-orb-claim-v2`、RNG `lcg32-v1`、50 ms/tick、LOOT_FREEZE_VERSION 均不升版。

## 已有实时银行链路与时间边界

#254/#258 已接通权威银行；本次只开放候选。PvP 用 `readBattleLiveGoldReaders` 判断 A/player、B/enemy；镜像 B 固定不读实时银行。Room 成功命令提交后捕捉真实 `Match.gold` 变化，人类与机器人共用；`LivePvpTrack.sample` 排队，任务 `sampleBankGold(seatId:string,liveGold:number):boolean` 记录私有样本；最终采用 live 结果结算，并更新公开 replay-tail。PvE 在操作前 catchUp，之后 `stepMatch` 按权威 Match.gold 采样，样本进入本轮结果。服务器不得自行计算增伤。

`sampleBankGold` 返回 true 表示战斗状态改变且记录样本；相同有效银行、未绑定席位、镜像 B 返回 false。非法席位/金币/超过 100000 条有效样本抛 `invalid-bank-sample`，终战后抛 `wrong-phase`。`sampleD11CombatGold` 合入本队尚未结算的物品与 Sevika High Roller 收益一次；传入的 liveGold 只取银行，不能先叠加这些收益，也不能由客户端自报。

**“下一 tick 生效”指规则游标，不是玩家眼前播放帧或命令到达时刻。** 私有 `{tick:t,team,liveGold}` 表示在规则 tick t 已完成、执行 t+1 前注入；已经完成的 tick 不回改，同 tick 多个有效样本保留提交顺序，下一步使用最后银行值。伤害只在之后实际伤害取样时反映变化，并非每步一定产生攻击。

现有服务器 `LIVE_BANK_LEAD_TICKS=8`，50 ms/tick，即规则推进相对显示时钟前瞻 **0.4 秒**。Room 的目标为 `floor((clock.now()-battleStartedAt)/tickMs)+8`；PvP 排队 tick 还取目标、当前规则游标和此前排队 tick 的最大值，推进到该点后才采样，再计算下一规则步。玩家在显示 tick d 操作，不能承诺显示 d+1 就变伤害；通常最早影响 d+8 后的规则步对应显示内容，另受排队、调度和下一次伤害时机影响。0.4 秒是前瞻预算，不是固定端到端延迟保证。PvE 同样先追到目标再受理操作，其后一步才读取新银行。

首次创建 PvP live 轨道时，若目标已 **大于冻结终战 tick**，服务器直接忽略该战的采样；等于终战 tick 也不能保证还有下一规则步可消费样本。已有 live 轨道终战后的操作不改该战结果。即使屏幕仍在播放末尾动画，也可能已无可影响的规则步。保持现有边界，本次不修改前瞻或末尾策略；服务器测试须覆盖这一点。

`BattleResult.bankSamples` / PvE `CombatState.bankSamples` / `RoundResult.bankSamples` 是服务器私有重演输入。`proposeSettlement`、`toCombatReplay`、`startCombatReplay` 按原顺序重放；样本篡改导致 `invalid-result` / `replay-divergence`。公开录像与私有席位投影均不带银行样本，不能直接发送完整 BattleResult 或 advanceTick 返回的 result。

## 兼容与发版

**发版须先排空当前对局再切换进程和客户端。** 不在同一局混用 v16/v17 的规则对象、冻结输入、候选 RNG 轨迹或摘要。虽然只扩联机池，全局 CONTENT 身份变化也使旧单机存档不能在 v17 恢复；旧 v15/v16 私有输入不能在 v17 继续或重算，无静默迁移。

`restoreMatch` 原本就拒绝含 multiplayer/sharedPool/carousel 的完整联机磁盘存档；本次不新增联机离线恢复。断线重连仍为同一服务器进程的内存席位恢复。历史公开显示帧可按原展示接口播放，不代表其旧私有输入可以在新规则下重演。存档/回放/命令/网络格式版本不变不等于内容身份兼容。

## v17 epoch 与复现

入口：`node scripts/verify-v17-epoch.cjs`，固定上述 baseline，依次执行以下九步；原始日志写 `artifacts/v17-recording/`，退出码与结果写 [epoch-verification.json](evidence/v17/epoch-verification.json)。

1. `record-v17-release.cjs --baseline-commit=<基线>`：四条公共路线、baseline、全局 golden、cannon/sniper 各 67 个原始检查点。
2. `tests/fixtures/record-v17-herald.cjs --write`：独立公共命令生成五份 Herald 原始输入与轨迹，全部导出后才导入生产 restore。
3. `record-v17-inputs.cjs --baseline-commit=<基线>`：C19、B8 指纹和 Herald 输入审计。
4. `record-v17-live-reveal.cjs --baseline-commit=<基线>`：同 tick 揭示及两条部分揭示路线。
5. 第 3 步加 `--check`，逐字节校验新输入与审计。
6. `verify-m8-herald-fixtures.cjs`（CURRENT 指向 record-v17-herald），重新生成并逐字节核验五份 raw、轨迹和 manifest。
7. `v17-fixture-audit.cjs --baseline-commit=<基线>`：v15/v16 历史文件原字节及历史身份断言。
8. 第 4 步加 `--check`，核验实时揭示审计。
9. `compare-v17-digests.cjs`：从只读 Git archive 提取基线，在独立目录与当前源码分别计算三个摘要。

v15/v16 evidence、fixture、生成器保持开工时原字节；Windows 下审计用只读 `git cat-file --filters` 比较基线的检出字节（含 EOL 过滤），并核对开工时 SHA256。录制审计的旧输入哈希/字节数使用 `git show` 的原始对象，保持与旧审计一致；身份测试只在内存中将JSON读为原始LF表示，gzip二进制不转换。历史断言原行保留；检出文件不改写，原字节清单见 [historical-checkout-bytes.json](evidence/v17/historical-checkout-bytes.json)。新结果只写v17，不把旧manifest换成新源码指纹。当前golden / checkpoints / Herald / C19 / B8 helper改读v17。

规则侧测试 `v17-avarice-online.test.ts` 使用隔离的真实 catalog 边界，经过公共初选/刷新/选择和战中经济命令，验证 +5 唯一收据、实际伤害、私有 bankSamples、JSON 传输、逐步回放与结算验证；不冒充服务器或完整对局恢复验收。`v15-anomaly-availability` 对两个模式、三个目标资格的每个 LCG 区间穷举初选/刷新候选。

## 服务器侧待补测试

以下 **6 条**交由 Claude 写入服务器测试；现有注入绑定测试不能替代真实抽选闭环。本草稿未新增或修改 `tests/server/`，也未宣称以下验收已经完成。表内领域函数均从 `src/server-entry` 公共导出。

| 场景 | 必须断言 | 用到的导出函数/入口 |
| --- | --- | --- |
| 1. 真实抽选闭环 | 真实席位推进至 4-6，用真实目标初选和付费刷新分别抽到并选择贪财；不得手写 binding/offer。联机总池56、资格过滤正确，+5仅一张收据；重复选择/重连/推进不重发；随后实际交易触发该席 live 银行。 | `Room.handle`；领域 `runSharedMatchCommand`、`selectAnomalyTarget`、`rerollAnomaly`、`selectChoice`、`readBattleLiveGoldReaders`、`toPrivateSeatView` |
| 2. 双真人 A/B 与镜像 | 两个真人都通过真实选择取得贪财；A、B 分别增减金，player/enemy 样本仅影响对应队伍，双方投影朝向正确；镜像 B 不采样、不接受该侧成长/收益结算，A仍可采样；不泄露他席银行。 | `Room.handle`、`LivePvpTrack.sample/advance`；领域 `snapshotForBattle`、`compileBattle`、`readBattleLiveGoldReaders`、`startTwoSidedBattle`、`proposeSettlement` |
| 3. 同 tick 连续增减金 | 用可控时钟在一个目标 tick 连续出售、刷新/买XP等成功命令，再插入失败命令；有效样本按提交顺序、同值无操作，失败不改资源/RNG/样本；下一规则步取最后值，live帧、账本与重演一致。 | `Room.handle`、`LivePvpTrack.sample/advance`；领域 `runSharedMatchCommand`、`BattleTask.sampleBankGold`、`toCombatReplay`、`proposeSettlement` |
| 4. 物品/Sevika 收益叠加 | 贪财同队带真实金币物品及 Sevika Coin/Jackpot，战中再真实买卖；未结算收益与银行合入一次，队友收益亦纳入；伤害按当时总值；资源账本只在既有结算发一次，重复结算拒绝；PvP和PvE都覆盖。 | `Room.handle`、`LivePveTrack.catchUp/commit`；领域 `sampleD11CombatGold`、`stepMatch`、`startTwoSidedBattle`、`proposeSettlement`、`applyRoundSettlement` |
| 5. 战斗末尾操作 | 在冻结终战前后、首次目标小于/等于/大于终战 tick、已有live轨道已终战、tick0终局分别交易；验证8tick前瞻边界、迟到采样不追改、不抛错/重结算；仍合法的经济命令只改变真实席位银行；改变终战长度时采用live结果。 | `LIVE_BANK_LEAD_TICKS`、`Room.handle`、`LivePvpTrack.sample/advance`、`LivePveTrack.catchUp`；领域 `BattleTask.sampleBankGold`、`proposeSettlement` |
| 6. 重连推帧与结算一致性 | 采样后、轨道分歧前后及终战前后断开/重连；累计 replay-tail 合并成同一最终公开录像，双方终态/HP/唯一收益与服务器live结算相符；同进程重连不丢样本、不重发；网络负载无 bankSamples/liveGold/私有CombatState。 | `Room.setConnected/liveFrames/commitSettlement`、服务器 `toCombatReplayFor`、`replayTail`；领域 `toCombatReplay`、`startCombatReplay`、`applyCombatReplayTick`、`proposeSettlement`、`applyRoundSettlement` |

## 验证结果

最终机器结果及构建体积写 [validation.json](evidence/v17/validation.json)；全部 fast 使用 `--maxWorkers 4`。服务器测试失败只报告，不在本任务中修改。沿用正式2D的既有口径：直接位于 `dist/assets/*.js` 的文件各自 gzip level9 后求和（含Phaser），M7分母 **424763 B**，验收比值不超过 **1.49**。独立懒加载的 `dist/assets/3d/*.js` 另列，不混入2D历史预算；递归全包总量亦保留在机器结果中。

- `tsc --noEmit --incremental false`、`npm.cmd run build -- --configLoader runner` 原始退出码均为0。构建沿用基线配置，仍有重复build键和大chunk警告，未扩改配置。
- 正式2D gzip **626556 B / 424763 B = 1.4750719813 ≤ 1.49**；独立3D JS为213137 B，递归全部JS为839693 B（1.9768506202；此数不是既有2D预算口径）。
- 最终九步 **9/9退出0**；v15/v16共58份历史文件与历史身份断言通过，四路线各33场胜利、cannon/sniper各67检查点、Herald五案及实时揭示全部重新生成并核验。
- 最终相关复验 **8文件 / 192项通过，0失败/待执行**，覆盖初选/刷新、唯一+5金、实际伤害、bankSamples、逐步重放、结算验证、完整候选区间和当前身份链。
- 录制结束后按原时限逐文件复验 **4文件 / 35项通过，0失败/待执行**：mage回放1、sniper-caitlyn集成2、B7恢复向量14、B5实例18。未改测试时限，也未用补充结果覆盖首次全量数字。
- 首次fast全量 **417文件 / 5560项：5512通过、25失败、23待执行**（4 workers）。这是原始结果，不扣掉后续复验恢复的用例，也不宣称全量已绿。该轮与epoch重录并行，唯一v17身份失败读到了此前审计；最终192项复验已覆盖并通过该断言。

全量失败分类：

| 分类 | 原始结果与后续处理 |
| --- | --- |
| 历史EOL哈希 | 13个失败断言；均已找到具体原件，检出CRLF哈希与实际值、内存LF哈希与断言期望值分别匹配。详见 [historical-eol-diagnosis.json](evidence/v17/historical-eol-diagnosis.json)。原测试和原件不改；未宣称这些旧测试越过首个失败断言后的部分已全绿。 |
| Explorer Bracer子进程 | 2项构建失败：esbuild父目录访问拒绝、入口解析失败；未修改该历史压力测试或其脚本。 |
| 非服务器超时 | mage回放360秒、sniper-caitlyn集成180秒、5-7恢复向量20秒各1项超时；m8-b5-instances的10秒hook失败导致18项未执行。录制结束后4文件35项按原时限全部通过，结果原样保留于validation.json；另有assets3d-paths的1项条件跳过，未将其计作超时恢复。 |
| v17旧审计读入 | 1项，最终8文件/192项复验已通过。 |
| 服务器 | `tests/server/e2e-replay-errors.test.ts` 4项失败（子进程spawn ENOENT）；`replay-first-pass.test.ts` 2项5秒超时；`lifecycle.test.ts`套件状态failed、JSON无顶层message、4项未执行。服务器合计48文件、286通过、6失败、4未执行。只报告，未修改服务器代码或测试。 |

本机原node_modules链接缺少已有3D测试依赖；验证临时复用邻近`compress/node_modules`的完整离线依赖，vite/vitest/typescript/phaser/three版本与原链接一致，未安装或联网。结束时恢复原链接，环境记录见validation.json；复现全仓库检查仍需具备package-lock中已有的完整依赖。

建议提交信息：`feat(simulation): restore online Avarice in v17`。草稿可交叉审查；合并仍等v16发版收口，服务器新增6场景由Claude补验，正式切换须排空对局。
