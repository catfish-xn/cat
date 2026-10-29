# D11 生产接线与 v15 交接

> 2026-10-28 更新：本文为历史记录；卓尔不群现按14.24精确阶段表240/330/420/530生命、45/50/55/60%攻速，安慰剂+各阶段固定15金币、1%攻速。覆盖本文相应旧值；普通安慰剂不变。详见 [数值对齐报告](AUGMENT_14_24_ALIGNMENT.md)。

## v17 当前状态（草稿，覆盖下文历史交接）

#254/#258已接通权威实时银行，v17恢复贪财化身联机候选，异常单机56/联机56（原联机55），强化60。获取+5金仍按唯一收据，增伤数值不变。`sampleBankGold(seatId:string,liveGold:number):boolean`；下一tick指规则游标t→t+1，服务器8tick前瞻为0.4秒，不能承诺显示下一帧立即生效。PvP采用live结果结算和推帧，PvE先catchUp再操作。rules/content同升v17，CONTENT `de829c8a→8a955c10`、LOOT `62c76cb9`保持；格式/协议不升。v15/v16证据原字节保留，CURRENT切v17。发版排空对局；PR草稿等v16收口后合。6条服务器新增验收与兼容边界见 [V17_AVARICE_ONLINE](V17_AVARICE_ONLINE.md)。

以下“当前收口”“服务器尚未调用”等描述保留v15历史上下文，不再表示当前准入或接线状态。

当前收口（用户 2026-10-20 04:22 确认）：贪财化身联机暂缓，单机 54 异常保留，联机候选为 53，强化仍 60；模块及独立双边战斗能力保留，待服务器接通每 tick 前 `sampleBankGold` 再加回候选。当前身份、digest、v15 epoch 重录与测试以 [V15_RELEASE](V15_RELEASE.md) 为准。下文保留单支交付时的背景。

基线：`codex/d11-wiring`，`6392f319baf9ea6237e0cf8338190cd20f463546`（PR #231）。本轮仅工作区交付，不提交、不联网、不安装依赖。

**状态：领域接线与测试完成；运行目录 60 强化 / 54 异常。整项生产上线尚未完成：联机 PvP 实时金币需要服务器配套，界面还需消费新增说明字段。** 本轮按要求保留 v14 版本、原 digest 和历史指纹；不能独立发布为一个与旧 v14 等价的版本。

合并说明（2026-10-20）：以上版本描述及下文验证记录属于 D11 单支交付；合并工作区沿用法球分支既有 v15 身份与 digest，本次不再升版本、不改数值、不重录。联机 D11 赠送与 P2 共用奖励法球合同：获取时记录两个固定英雄法球，领取时才分配共享库存或折金；冻结 PvP 阵容期间只排队，经济、HP、成长与延迟升星之后结算。单机仍保留满席托管。私有法球字段、按卡刷新与 d11Display 同时保留，公开战斗 statuses 与 choiceEffects 同时保留。合并后逐文件结果见 [V15_MERGE_RESOLUTION](V15_MERGE_RESOLUTION.md)。

## 接线清单

| 环节 | 文件 / 接口 | 行为 |
| --- | --- | --- |
| 目录与等级 | `content/d11-fill.ts`、`content/augments.ts`、`content/augment-policy.ts`、`content/anomalies.ts` | 注册三个强化、两个异常；银 / 金 / 金。沿用既有等权抽取，旧条目值与权重未改 |
| 有限机制准入 | `validate-content.ts`、`effects.ts` | 数量 60/54；明确声明 D11 机制字段，未知机制仍拒绝 |
| 开战快照 | `strategy-snapshot.ts`、`combat-input.ts`、`two-sided-snapshot.ts` | 在 resolveEffects 前调用来源编译器；己方单机与双边各席分别编译；贪财化身携带开战银行 |
| 获取 / 托管重试 | `d11-fill.ts`、`s13-augments-p2-grants.ts`、`anomaly-acquisition.ts` | 选择提交后记录唯一收据；单机英雄沿用合星与满席托管，联机英雄先进入奖励法球，领取时才应用共享池 policy / 合星 / 折金；贪财化身获取金币仍即时发放。原有重试入口共用 drain，不重复生球 |
| 战斗数值与事件 | `combat.ts`、`combat-s13.ts`、`combat-s13-state.ts` | 程序治疗 / 增伤、实时银行取样、击杀攻速成长；保留完整 heal、packetDamage、kill、statChanged 账本 |
| 持久结算 | `g2-3-economy.ts`、`g2-3-settlement.ts`、`round-settlement.ts` | 猎头者唯一战斗击杀事实放入既有 g23Facts；通用事务提交，重复与镜像不结算 |
| 恢复 | `g2-3-restore.ts`、`g2-4b-gold-restore.ts`、`m8/restore.ts`、`crown-history.ts` | 校验赠送计划与收据；重算当前异常战斗；猎头者历史成长必须提供完整 battles 并重放验证 |
| 私有显示 | `d11-display.ts`、`private-seat-view.ts` | 可选 `d11Display`：当前已拥有 / 正在提供的定义、名称、说明、等级；猎头者已结算击杀数 |
| 公开战斗显示 | `combat-replay-view.ts` | 单位可选 `choiceEffects`：只含当前生效条目的名称、说明和等级；已有实时攻速投影、伤害 / 治疗 / 击杀事件继续可用 |
| 实时双边任务 | `two-sided-battle.ts`、`two-sided-types.ts` | 新 `BattleTask.sampleBankGold`；私有 `BattleResult.bankSamples` 记录发生 tick；结果校验与回放按同一时刻重放，不公开银行样本 |

五项新增数值均读 `content/d11-fill-source.ts`；没有重写旧条目数值。独立包的来源去重断言改为核对已注册身份；独立来源字段、准入和 Built Different B 补丁断言保留。source 测试不再写死 digest，改核对 Match 当前身份常量。

## 行为与项目约定

- **一费奉献 I**：获取两个随机 1 费英雄；场上每种独特 1 费英雄使全队 +2% 最大生命、+1.5% 伤害增幅。重复同英雄只算一种；备战席与非英雄不增加种类数。
- **三项赛 I**：获取两个随机 3 费英雄；开战至多随机三个 3 费英雄各 +250 生命、+18% 攻速。编译一次、按单位 ID 排序后部分 Fisher–Yates。新内容使用专属开战流 `d11OpeningSeed(g23.seed, round, choiceId)`；由 seed xor `0x6431316f` xor round，经 choiceId FNV 乘法派生，再由来源编译器消费至多三词。联机 choiceId 已带席位命名空间；不改变四条 Match RNG 流，也不消耗既有战斗 RNG。
- **灵魂连接**：每 100 tick 治疗自身最大生命的 5%；额外基点为 `floor((100 - 开战玩家生命) / 10) × 50`。沿用开战取样与完整十点组约定，战中不因玩家生命显示变化重算。
- **贪财化身**：获取时通过唯一通用金币收据给 5 金；伤害结算取样 `min(4000, 1500 + floor(当前金币 / 2) × 100)` Bps。银行不截成 50 金；只有增伤有上限。战斗内收集者、赌徒、投机者金币及 Sevika 的 Coin/Jackpot 更新后续伤害采样。奖励仍按原有结算事务入账，不另发一次。
- **猎头者**：基础 15% 攻速；每个由持有者完成的敌方英雄击杀永久 +1 个百分点，当战即时生效。不计助攻、友军、野怪、异常召唤物、镜像或风衣等物品召唤物；英雄复活后再次被击杀按不同 kill eventSeq 再计。收据包含 combatId / holderId / eventSeq / victimId，不能按 victimId 去重。永久值从可信历史导出，合星随已有异常绑定迁移，卖出解绑后不再应用。

赠送英雄的独立种子命名空间、缺池按费用补金、满席不换英雄也不推进 RNG，均沿用 #231。未启用狂暴模式的翻倍。

## 接口、失败与恢复边界

- `sampleD11CombatGold(combat: CombatState, team: 'player' | 'enemy', liveGold: number): CombatState`，位于 `simulation/d11-fill.ts`。仅接受服务器 / Match 权威银行；自动加上尚待结算的本战物品与 High Roller 收益，不重复加到资源账本。负数、非安全整数抛 RangeError；无变化返回原对象，无 RNG 消耗。
- `BattleTask.sampleBankGold(seatId: string, liveGold: number): boolean`，从已有 `startTwoSidedBattle` 返回。样本在下一个 tick 前生效；非参与席、非法金币或超过 100000 条有效样本抛 `BattleValidationError('invalid-bank-sample')`；已结束抛 `wrong-phase`。实际改变返回 true，相同有效银行、未绑定席位与镜像 B 返回 false。不接受客户端自行报金币。实时取帧、PvE 样本收据及完整签名见 [LIVE_GOLD_EXPORTS](LIVE_GOLD_EXPORTS.md)。
- 可选 `BattleResult.bankSamples: readonly {tick:number, team:'player'|'enemy', liveGold:number}[]` 为私有规则输入记录；tick 非递减且早于终战 tick。`proposeSettlement` 校验同一轨迹；`toCombatReplay` / `startCombatReplay` 输入必须保留该字段，公开输出不包含它。
- `G23BattleFacts.d11Headhunter?: D11KillReceipt` 原样随 `SideProposal.g23Facts` → `RoundSettlementReceipt.g23Facts` → G23 economyReceipts 传递；目前服务器已有 g23Facts 整体转发，无需另算击杀。异常未绑定、holderId 不匹配或 eventSeq 超过战斗边界等均按 `invalid-receipt` 原子拒绝；重复仍是 `duplicate-settlement`，镜像仍是 `mirror-settlement`。
- 单机使用 `serializeMatch(state, battles?)` / `restoreMatch(input, battles?)` 现有签名。只要历史中出现猎头者战斗事实（包括零击杀），就需要完整 battles；缺少证据拒绝，不能仅 JSON 往返自证。当前战斗还会从冻结输入逐 tick 重建。新增字段不提供旧档迁移。
- 联机完整 Match 存档本来就不受 offline restore 支持；本轮验证在线快照 JSON 往返、结算账本和战斗任务回放，不宣称新增了联机 Match 读档能力。

## 尚需 Claude 配套的生产接线

1. **D11-SERVER-LIVE-BANK，发布阻塞**：`src/server/room/two-sided-resolver.ts` / room 当前先从冻结快照算完整战斗，再播放；播放期间真实买卖不改变已计算结果。服务器需将实际规则推进与战中命令排序一致，在相关席位金币变化后、下一 tick 前调用 `task.sampleBankGold(seatId, seat.match.gold)`。不能只在开战取一次、或事后修改录像；需保留私有样本转给重放输入，并验证不泄露金币。领域入口与重放支持已备妥，**当前服务器尚未调用该入口，因此不能声称联机 PvP 贪财化身已完整生效**。联机 PvE 的 `stepMatch` 已读取实时 Match.gold。
2. **D11-DISPLAY**：领域目录与 private/public 战斗投影已给名称、说明、等级。现有 `augmentPlayerDescription` 只允许六个历史 ID；Claude 需消费 D11 说明，不要把 `d11Fill` 显示成未知效果。现有强化图标 manifest 没有这三个 ID，本轮未虚构 icon key、路径或复制资源；继续既有无图标文字回退，图标映射由表现层后续处理。公开静态 PublicBoard 仍遵守原白名单；新增显示数据在公开战斗 replay 中，不公开其他席候选或银行。

本轮禁改目录没有改动。以上配套需求也记录于 `UI_REQUESTS.md`；未把领域测试通过等同于整项生产上线完成。

## 统一 v15 时需要升级的身份点

| 位置 | 下轮动作 |
| --- | --- |
| `src/simulation/m8/version.ts` | rulesVersion → `s13-g2-3-v15`，contentVersion → `s13-14.24b-g2-3-v15`，与法球领取、强化按卡刷新一起切换 |
| `src/simulation/content/index.ts` | 删除临时 `preD11` 过滤，使 60/54 目录及完整等级表参与 digest；新增 D11 来源系数与执行约定输入（开战流、赠送流、击杀排除、治疗取样、银行取样 / 重放）。正常自动计算新 CONTENT_DIGEST，不手填哈希 |
| 法球 / 强化策略与有限规则 manifest | 按另外两项的实际合同更新策略身份与 digest 输入；D11 本身不改变等级权重或刷新语义 |
| `src/simulation/loot-freeze.ts::LOOT_REPLAY_DIGEST` | D11 本身不改；若同批法球策略变更涉及其输入，由统一切换自然重算 |
| snapshot / settlement / replay 私有扩展 | 把 D11 的新增输入、bankSamples、kill facts 纳入 v15 身份和证据。schema7 / save3 / replay3 / command3 本轮保持；是否另改格式版本取决于统一批次的兼容性合同，不由 D11 单独强行升级 |

当前 digest 仍是 `fnv1a32-utf16:ea6b11b6`。`preD11` 只是本轮“不改 digest”的显式过渡边界；不表示扩池后的旧 v14 存档仍可恢复。同种子候选已改变，历史 offer 校验可能拒绝旧档。正式发布必须用新身份拒绝旧档，不做静默迁移。

## 用新 v15 epoch 重录的指纹与消费者

保留旧文件作为历史证据，**不要覆盖 g2-4b / g2-3 / p3p4p5 等旧 epoch**。建议统一新路径如下；最终由 v15 集成任务采用同一命名。

| 新证据 | 当前基线 / 需要切换的消费者 |
| --- | --- |
| `tests/v15-content-baseline.json`：版本、digest、目录计数、首战状态 / 事件 trace、lootReplayDigest | 当前 `tests/g2-4b-content-baseline.json`；`opening-random-identity.test.ts`、`m8-content-equivalence.test.ts`、`d11-wiring-bank.test.ts` 的当前身份读取 |
| `tests/fixtures/m5/full-match-golden.v15.json`：正常路线命令 transcript、逐回合 stateHash / eventsHash、版本、结局 | 当前 `full-match-golden.g2-4b.json`；`tests/fixtures/m5/assert-golden.cjs` 及路线回放消费者。使用新的候选池与新刷新 / 法球命令真实重跑 |
| `tests/fixtures/v15-recorded-states/{cannon,sniper}.json.gz`：公开路线开战前 / 结算后 / 终局检查点，以及 gzip SHA256 / 字节数 | 当前 `g2-4b-recorded-states/`；`tests/fixtures/m8-golden-states.cjs`、严格 text/object 恢复检查 |
| `tests/fixtures/v15-b8-fingerprints.json`：0 / 1 / 9 单位的双边战斗与 replay SHA；另加五项 D11、银行样本与镜像用例 | 当前 `b8-resumable-battle-helper.ts` 仍读 `g2-3-b8-fingerprints.json`；切换当前 import，旧 epoch 留存 |
| `docs/evidence/v15/`：迁移审计、源文件 / oracle / 驱动哈希、候选 golden SHA、路线录制 SHA、计时和测试清单 | 新建统一证据链，保留既有 g2-4b / p3p4p5 审计原件与哈希断言；不要拿改旧 hash 当验收 |

如统一批次会运行任何其余读取旧当前 epoch 的消费者，应先列明 import / 读取位置再切换；不改历史来源 SHA。本轮未运行录制脚本，未改上述任何指纹或 baseline。

## 验证记录

命令均逐个文件执行，`npx.cmd vitest run <file> --configLoader runner`，新测试不设置单条时限。`npx.cmd tsc --noEmit` 通过。最终逐文件结果见本节更新；未跑全套、浏览器或部署验收。

最终逐文件通过 **19 文件 / 284 项**：

| 测试文件（均位于 tests/） | 通过数 |
| --- | ---: |
| d11-fill-source.test.ts | 7 |
| d11-fill-mechanics.test.ts | 20 |
| d11-wiring-match.test.ts | 5 |
| d11-wiring-online.test.ts | 10 |
| d11-wiring-bank.test.ts | 2 |
| g2-augments-choice.test.ts | 72 |
| s13-anomalies-source.test.ts | 12 |
| g2-3-content.test.ts | 10 |
| m5-content.test.ts | 9 |
| t5r-private-seat-view.test.ts | 15 |
| s13-augments-p2-choice.test.ts | 23 |
| s13-augments-p2-combat.test.ts | 34 |
| s13-augments-p2-multiplayer.test.ts | 18 |
| g2-4b-gold-settlement.test.ts | 2 |
| g2-4b-gambler.test.ts | 2 |
| augment-tier-consistency.test.ts | 7 |
| t2-two-sided-battle.test.ts | 21 |
| s13-anomalies-replay.test.ts | 7 |
| g2-4b-restore-authority.test.ts | 8 |

运行中发现并修复了机制准入 / 开战增伤恢复校验缺口、目录计数断言，以及扩池引起的旧 Crown + Trifecta 固定种子失效。旧用例重找合法种子，仍要求同一个 Kog'Maw、1080 生命 / 375 护盾及三种恢复入口，没有删除或放宽原断言。新测试没有单条 timeout。当前合同与历史指纹分开处理：未为扩池重录任何 golden，也未把旧 epoch 的固定 transcript 测试冒充为通过。

建议提交信息：`feat(simulation): wire D11 content for the v15 integration cutover`
