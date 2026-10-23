# 10-22 第二轮试玩规则核对

【完成】

基线：`codex/rules-playtest-1022b@7937f241`，开工工作区干净；角色 Codex。仅修改 simulation/tests/docs；不联网、不改服务器/界面/CI、不提交、不录 epoch。候选外层身份仍为 `s13-g2-3-v21-opening-encounters-battle-equipment`，新增收入细分政策进入共同 manifest，运行时 digest 自动更新，PR9 统一录制。

## 六项结论

| 项目 | 结论与依据 | 改法 / 定位 | 测试与截图 |
| --- | --- | --- | --- |
| 1 安慰剂 / 安慰剂+ | 当前固定8/15G，未按阶段变化。14.24b `raw/en_us.json.gz` 的 `items[1870]/[1640]` 与 `map22.bin.json.gz` 的 `{cc6699c5}/{499b8275}` 均只给固定Gold=8/15、攻速1%，没有阶段数组。不能据此声称另有分阶段的官方数值。 | `src/simulation/content/augments.ts:15,211` 保留，不改数值；用户分阶段要求待具体表批准。归档提取见 evidence/archive-extract.json。 | 固定发钱及重复选择覆盖在 T3 的11例中；没有这项试玩截图。 |
| 2 利息/回合金提前到账 | 确认bug：此前普通 settleRound 与 PvP applyRoundSettlement 在战后把全部 plan.goldAfter 写入state.gold。已修复：最终战斗权威余额（含战中买卖/花费）+胜利金作为冻结利息基数；胜利金即付，其余收入下一轮入口到账。 | `src/simulation/match.ts:377,506,547`；`src/simulation/round-settlement.ts:158`；新增 `src/simulation/deferred-income.ts:5,10`。恢复 `serialization-structure.ts:273,285` 同步严格重建待付额及已付投资成长。共享池复用nextRound；自然XP仍在结算，不擅改。 | 新时序7例、T3 11例、开局/计算/预览143例、live-economy恢复3例、加时/共享池5例；均通过。无截图，以状态断言为证。 |
| 3 战斗加速 | 确认缺口：`MAX_COMBAT_TICKS=1200`、50ms/tick，即60秒；没有战斗中途加时增伤/攻速，活着的双方到上限判平。已知原版有战斗加时机制，但本次不能可靠确认14.24b的整套起点/时长/攻速/伤害/治疗修正表，不能把试玩“23秒”当参数。 | `src/simulation/combat-types.ts:8`、`combat-s13.ts:708` 保留不改。原始map22与stringtable按overtime/suddendeath检索只取得标识/文案/表现内容，无可认证规则表；`CombatDuration=6` 的条目也不能当整场时长。 | 未新增臆造倍率测试；此次不宣称已实现原版加速。没有3-3视频或截图，静态截图也无法验证时间。 |
| 4 梅尔免死 | 已实现且与归档吻合：`map22/{85892f99}` 的TFT13_MissMageTrait有 MinimumCasts=12；stringtable明确“this game / during player combat”。累计PvP12次（包含本场）、整局仅一次、致死留1HP；PvE/镜像不累计；卖出重买不重置。 | `src/simulation/mel-save.ts:6,13`、`g2-3-settlement.ts:28`、`g2-3-economy.ts:78`。规则不改，合同补充现有 `playerSaved{battleId,playerHp:1,source:'mel'}`；动画由Claude消费事件。 | 新边界1例（包含在新时序7例）、既有服务器梅尔20例全过，含流式/非流式、少于12次、已用掉、伪造或缺事件拒绝；没有这项截图。 |
| 5 德莱文售价（只报告） | 归档cost=1；现有通用售价：一星1、二星3、三星9。二星卖3正常，不能把“卖3”直接判bug。若是一星实际增加3才是异常，现有截图不能证明单位星级和前后余额。 | `src/simulation/unit-stats.ts:28`（费用>1才有合星折价）；未改售价。 | 新售价审计1例（含于7例）断言1/3/9；既有命令经济90例通过。用户截图 `/home/aiapps/workspace/feedback-1022b/1.png` 已只读查看，证明显示问题，不足以判定售价。 |
| 6 战中备战区卡顿（只报告） | `applySeatCommand(deploy)`本身不调用pveCatchUp/stepCombat；但会执行部署校验、planTemporaryEquipment及accept机制钩子，非裸数组交换。外层Room.apply在battle阶段先调用pveCatchUp；仅有实时金币读者的PvE会追算。测得规则入口亚毫秒，外层可达十余毫秒，不能断言是全部卡顿来源。 | 只读定位：`src/server/room/room.ts:144,148,488,1369`；规则 `src/simulation/match.ts:230`。未改性能行为；复测脚本 `tests/playtest-1022b-bench.test.ts:10`。 | 独立复测1例通过，500次/分组；数值见下表。截图同 `/home/aiapps/workspace/feedback-1022b/1.png`，静态图不能量出延迟。 |

截图2（黑市）、3（选秀）、4（杰斯锻炉）均位于 `/home/aiapps/workspace/feedback-1022b/{2,3,4}.png`，不作为本任务规则结论证据；未复制或修改任何截图/3D素材，未生成UI截图。

## 收入时序验收

战斗可买卖、刷新、买XP → 战斗终止 → 最终权威金币取样 → 胜利金计入基数并即付 → 记录基础/利息/连胜败应收额、结算HP/XP/成长 → 战后选择/奖励按已有流程 → nextRound/advanceMultiplayerRound/nextSharedRound成功推进时支付应收额、发投资成长 → 刷新商店/下一轮前置强化选择/准备。

手算：19G、已有1连胜，本场胜利后应收总收入9（5+1+2+1）；战后只有20G，下一轮28G。没有连胜奖励时下一轮27G。战中22G买XP减4再卖一星德莱文加1，终战19G、胜利利息基数20G、利息2。战后机制奖励、容量出售不倒算刚结束战斗的利息；下一轮才影响下一次结算。下一轮前置强化选择已到账；重复收据/step/Continue、恢复不重发；淘汰/单人终局无下一准备入口不支付。供给和1-x基础金同样延后，开局累计进入2-1选择前仍为10G。

`RoundResult.goldAfter`保留收入方案值，不能当战后实时余额；界面和服务端只能读state.gold作为可花余额。没有新增持久字段，失败原因/公共命令签名不变。完整合同与Claude接线说明见 MATCH_CONTRACT.md 末节及 UI_REQUESTS.md 末节。

## 性能证据

Node v22.23.4，seed42，真实8席房间1-4（ordinal3），用公共购买取得备战单位；只有“贪财化身”绑定采用测试接缝。相同冻结state的applySeatCommand单独预热100次、测500次；然后ManualClock前进400ms，测一次Room.handle。最终测量期间未并行启动本任务其他测试，单次结果不当性能SLA，未测后期长账本、网络或3D帧率。

| PvE 实时金币读者 | applySeatCommand 中位 / p95 / 最大 ms | Room.handle ms | 战斗tick前→后 |
| --- | --- | --- | --- |
| 无 | 0.120 / 0.201 / 2.153 | 1.088 | 0→0 |
| 贪财化身 | 0.104 / 0.179 / 5.096 | 13.486 | 8→16 |

证据：`docs/evidence/playtest-1022b/bench-timing.json`、`bench-final.log`。结论只支持该样本中外层有追算成本；不能凭此改服务器事件顺序，更不能声称已修复试玩的卡顿。

## 测试结果、命令与断言变更

命令均使用 `export PATH=$HOME/.local/bin:$PATH`。Node模块为原软链，默认vite配置打包因只读node_modules/.vite-temp启动失败后，改用 `npm test -- --configLoader runner <文件...> --no-file-parallelism`；未改Vitest配置或断言预算。

- 功能相关10文件共280例全过（含新时序7例、性能1例）；重复的7例精化“2-1强化选择前精确10G并恢复”后再单跑通过；性能1例最终单跑通过。核心150、T3 11、恢复/加时8、服务器梅尔+命令经济+性能111；原始日志及计数在 `docs/evidence/playtest-1022b/`。
- `npm run typecheck` 通过。未跑全套、构建、浏览器或改CI；`git diff --check`通过。
- 身份专项2文件：18过、270失败，未改断言/夹具。`opening-random-identity`的1项最新旧epoch绑定失败、cannon/sniper各67个旧checkpoint拒绝、1项首战状态轨迹hash变化；`m8-content-equivalence`的cannon/sniper各67项旧存档恢复因unsupported-version失败，共270。不是全数由本次修改引起：基线v21本身也尚未录epoch。收入支付时点另会改变状态轨迹，需要PR9基于独立数值验证后统一重录，不能仅换hash。
- 全部270项逐条清单：`docs/evidence/playtest-1022b/identity-failures.txt`；完整expected/received及堆栈见identity.log。未重录epoch、golden、baseline或降低门槛。

既有断言修改逐条列出：

1. `tests/t3-round-settlement.test.ts` 收入oracle：战后金币28→20、投资成长24→8；增加下一轮金币28、成长24。两个loss/draw淘汰向量战后26→19，不存在下一准备入口。supply用例改为战后余额不变，并增加下一轮增加断言。XP/HP/RNG/收据/失败原对象断言保留。
2. `tests/match-economy.test.ts` 空棋盘失败：开局战后金币+2→不加；增加nextRound后+2，扣血/战斗结果/XP不变。
3. `tests/m8-b8-live-economy.test.ts` 三个9/49/50G恢复向量：战后实际金币改为最终掉落后本金，投资成长不提前；独立16/60/61方案值及下一准备120/152/152成长保留，改用“本金+5+利息=原方案值”检查，所有篡改拒绝与往返恢复断言保留。
4. `tests/t5r-helpers.ts` 合成晚期夹具末条记录从复制开局2G改为显式6-7 PvE方案：19G本金+5基础+1利息=25G待下一轮；不是修改真实掉落或golden。`tests/t5r-overtime.test.ts` 对应首个准备余额25，五轮分别断言准备已付、结算未付、下一方案金额；不改17扣血、失败原对象、共享池守恒、恢复重演和唯一收据断言。

【未完成】

安慰剂分阶段数值与战斗加速均缺本次允许来源能认证的表，保持原值。服务器/UI实际展示需Claude按合同核对（本次只写需求）。后期账本/浏览器/3D卡顿未量测，不能把1-4微测当全场结论。

【需要我决定】

1. 安慰剂分阶段：可选A提供有依据的历史阶段表后照表实现；B批准项目自定义表。建议B的待定提案如下，**不是14.24b原版数据，尚未写入代码**。取归档8/15为两个锚点，阶段2→3→4用约半档/一档（+0/+3/+7）递增，两种同增量；这只是便于讨论的设计方案，没有独立原版表依据。默认建议先签表再实施，不把表伪装成“原版修复”。

| 选择时阶段 | 安慰剂 | 安慰剂+ |
| --- | --- | --- |
| 2 | 8 | 15 |
| 3 | 11 | 18 |
| 4及以后 | 15 | 22 |

2. 战斗加速：A补充可认证的14.24b参数归档，按原版做（建议）；B单独批准自定义的起点、持续时长、增伤/攻速/治疗修正表。当前不能批准一句“23秒加速”就补齐其余未知数。没有据此改60秒超时上限或强制胜负。

【风险】

收入时序改变会使旧checkpoint/轨迹不再适用；候选内容digest已随细分规则自动变化，PR9未录之前不能拿旧epoch测试当发布通过。特别是任何外部消费者若误读roundResults.goldAfter为当前余额，仍会显示提前到账；需求已交Claude核对。战斗加速缺口仍在。此次没有证据证明一星德莱文卖3，也没有证据证明规则入口是3D卡顿唯一原因。

【下一步】

先拍板安慰剂表/提供加速原始参数；Claude核对state.gold显示与服务器时序，并评估bench deploy的catch-up必要性；PR9统一身份录制、跨层回归与最终验收。本次改动留在工作区，未commit。
