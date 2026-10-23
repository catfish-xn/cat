# 开局奇遇 Batch B 实现报告（2026-10-23）

## 1. 交付范围与来源等级

工作树 `/home/aiapps/workspcae/cat-encb`，分支 `codex/encounters-batch-b`，输入 HEAD `b5a05d1a90a0468270554499a271ea7b2fc63ba0`（规则父分支 `codex/rules-placebo-overtime`，下含未合 PR #410）。本批实现安蓓萨魔像、沃里克、迅捷蟹水潭、蟹之狂欢；四项 `enabled=true/effectStatus=active`。不提交、不联网、不录 epoch、不改 digest 常量/历史断言/夹具，不改 rendering、server、CI、资源。

只读来源：

- `/home/aiapps/workspcae/perf-1022/encounters-decisions.html`：A1–A5、W1–W4、J1–J5，全部执行用户10-23批准的「我的推荐」。
- `/home/aiapps/workspace/s13-14.24b-supplement-2026-10-23/TFT_S13_14.24b_Research_ZH.md` §3/5/6及同目录 `TFT_S13_14.24b_Data.json`。原件未复制进仓库。
- PR2/PR5的独立流、收据、锻造器和恢复模式；既有PvE `ORB_BOXES`、共享池与G23战斗结算。

| 项 | 原版可证 | 类推/用户批准 |
| --- | --- | --- |
| A1 | 通用22纹章枚举、永久3纹章；13.4才加种族/职业配额 | 直接采用22项、各席等权无放回；没有额外配额 |
| A2 | 裸模板600HP/55AD/40护甲/40魔抗/0.55AS，30/100蓝，技能300/480/750魔伤 | 原模板直接采用，纹章/羁绊随后正常加成 |
| A3 | 历史“像假人升级”方向 | 1–3阶段1星，4-1二星1080/82.5，6-1三星1944/123.75；生命×1.8、AD×1.5 |
| A4–A5 | 永久纹章、同期额外单位旁证 | 0人口，不售、不入备战席、不换装；可移动/换位；1-2前排中央首空格 |
| W1 | 击杀有时掉落；三档战争财宝互斥 | 仅PvP开战正式敌方弈子首次死亡，30%成功 |
| W2–W4 | 条件奖池来自战争财宝原型，不能称狼人原版实证 | 95/5互斥入口；普通83/15/2；稀有50/29/10/5/5/1；L或min(L+1,10)商店分布、1星1–5费；无保底/上限 |
| J1 | 同版编组和底层坐标 | 坐标映射到项目奇偶行六角棋盘 |
| J2 | 普通蟹裸双抗10/10、AD20、AS0.8；普通野怪生命模板 | 每轮生命代理、关闭普攻、每4秒挪格、水潭后期10000HP |
| J3 | 总预算2组件+1金球、巨蟹默认2成装锻造器+2Silver箱 | 2-7/3-7组件、4-7金球固定事件；1–4阶段每杀一蟹1金；巨蟹胜利沿默认表 |
| J4–J5 | 第5阶段起危险、单只巨蟹；后版本递增100线索 | 20000HP、100双抗、2秒首跳/间隔、100×n全场魔伤、无普攻/额外成长；均命名常量 |

掉落30%、95/5、巨蟹属性和时序是**已批准的项目参数**，不宣称已考证为14.24b原版精确数值。既有普通PvE基础奖励保留；既有箱子子池的历史证据等级不因此升级。

## 2. 实现位置与具体行为

以下 `文件:行` 以本报告工作树为准。

| 奇遇/职责 | 实现位置 |
| --- | --- |
| 紧凑参数与身份策略 | `src/simulation/content/opening-batch-b.ts:4`；配置集中接入 `content/opening-encounters.ts:788` |
| 魔像抽样/出生/永久纹章/恢复 | `src/simulation/trainer-golems.ts:16`、`:27`、`:47` |
| 魔像升星/小数AD/施法 | `trainer-golems.ts:21`、`unit-stats.ts:15`、`m8/stats.ts:115`、`combat-s13-state.ts:96`、`combat-s13-abilities.ts:48` |
| 沃里克两级池/费用解析 | `src/simulation/opening-warwick.ts:7`、`:12`；互斥 `augment-offers.ts:47` |
| 首次死亡与可信结算 | `neutral-receipts.ts:13`、`g2-3-settlement.ts:15`、`:40`、`round-settlement.ts:98`；重放核对 `combat-runtime-facts.ts:17` |
| 两种蟹的编组/替换/基础载体 | `content/opening-crabs.ts:5`、`opening-crabs.ts:7`、`:17` |
| 普通蟹移动/危险巨蟹跳伤 | `src/simulation/combat-opening-crabs.ts:6`、`:12`；挂接 `combat-s13.ts:284`、`:334` |
| 奖励计划/授予/锻造器/恢复 | `opening-batch-b-rewards.ts:26`、`:68`、`:76`、`:90`、`:109` |
| 本人奖励组投影/怪物说明 | `opening-batch-b-rewards.ts:122`；Match公开导出；`encounter-selectors.ts:72` |
| 新测试 | `tests/opening-encounters-batch-b.test.ts:1` |

魔像生成检查己方格子：先row4，再5/6/7，每行按col `3,2,4,1,5,0,6`找第一个空位；正常1-2落点为`{col:3,row:4}`。三件纹章具有独立物品收据和 `item-equipped` 来源事实；不能使用拆卸器/重铸器/杰作升级或复制器改造该召唤物。它不入共享卡池、不占部署人口、不计PvP幸存弈子扣血数，纹章羁绊与普通战斗效果照常工作。

AD以整数百分之一保存基底表 `[5500,8250,12375]`，整数主体+余数参与属性求值，最终照引擎规则取整。例：82.50×1.20=99，不能先把82.5截成82再得98。裸输出整数AD为55/82/123，展示精确基底可读该表/`attackRemainderCenti`；实际伤害仍全为整数。HP为600/1080/1944，护甲魔抗40，攻速0.55，技能为单目标法强缩放魔伤。

客户端坐标记为 `(原行,原列)`，项目映射 **`col=原列−1, row=8−原行`**；原行8在敌方后排row0，原行5在敌方前排row3，不翻转左右列。底层空间等距含义不直接搬入项目六角距离。

| 回合 | 项目落点 `(col,row)`，按原表顺序 | 每只生命 |
| --- | --- | --- |
| 1-2 | (2,2),(4,2) | 250,250 |
| 1-3 | (2,2),(4,2),(1,1) | 250,250,150 |
| 1-4 | (2,2),(4,2),(1,1),(4,1) | 250,250,150,150 |
| 2-7 | (0,3),(1,1),(5,3) | 1200×3 |
| 3-7 | (3,2),(1,0),(2,0),(4,0),(5,0) | 1300,550×4 |
| 4-7 | (3,0),(1,2),(1,1),(4,1),(5,2) | 2400,1450×4 |
| 5-7、6-7 | (3,3) | 水潭10000；狂欢20000 |

普通蟹每80tick按固定邻格顺序轮转寻找空位，无空位不移动、不消耗随机词。巨蟹不普攻，tick40/80/120…跳伤；被控制跳过的时点不增加实际跳数，下一次真正跳跃仍按下一项计伤；不额外添加免控或减抗免疫。原始100×n接受普通魔抗/增减伤及父分支的加时增伤，100不是强制最终掉血。

基础PvE掉落计划和旧随机流保持原样，旧怪物slot按原表顺序关联到蟹c0/c1…；4-7原6个载体对应5只蟹，原第6载体绑定c4，两个独立dropId只发各自原奖励一次。映射只变死亡证据归属，不增加/删除基础奖励、不换奖池。

仓库**已有** `content/loot.ts:45` 的 `ORB_BOXES.silver`，故没有降级为任意金币、也没有另编银箱。每个巨蟹胜利roll两次既有银箱，加两次成装锻造器；4-7roll一次既有 `ORB_BOXES.gold`。一个箱子的多份原子奖励保留同组身份。金币/物品/消耗品在结算自动到账；联机弈子等待本人点击法球并走共享池；单机弈子直接入库，满备战席保留待领。展示“一个金球/两个银箱”应使用奖励组投影，不能把组内每个弈子都叫一只新金球。单人6-7终局沿既有末轮锻造器规则，以第一候选超时选项完成两份成装，避免终局留下不可操作选择。

## 3. 接口与恢复合同

```ts
// 公共命令仍走 Match；单机、联机域规则同源。
applyTrainerGolemsOpening(state: MatchState, shared?: OpeningEncounterContext): MatchCommandResult
applyWarwickHunger(state: MatchState, facts: readonly OpeningWarwickKillFact[],
  shared?: OpeningEncounterContext): MatchCommandResult
readOpeningBatchBRewards(state: MatchState): Array<{
  id: string; roundId: string; tier: 'gray' | 'blue' | 'gold';
  entries: Array<{payload: LootPayload; claimed: boolean}>;
}>
// G23BattleFacts 新增可选字段；沃里克联机 PvP 收据必须提供（可为空数组）。
openingDeaths?: readonly {victimId: string; eventSeq: number}[]
```

`applyTrainerGolemsOpening` 现在只认证已由生命周期授予的状态，合法重试成功且引用不变。`applyWarwickHunger` 只接受与已结算PvP账本完全匹配的首次死亡事实，成功重试无事件/无新增奖励；未经结算、镜像、非champion、伪造死亡均 `invalid-opening-effect`。实际授予发生在内部 `commitG23Settlement`，不接受来自UI的掉率/奖项/数量。以上入口还可返回 `opening-context-mismatch`，配置认证仍用 `opening-config-incomplete`；失败均原state且无事件。

`readOpeningBatchBRewards` 只列本人**已结算**奖励组，不读未来掉落、不暴露seed/流。联机现有 `readLootView(...).unclaimedOrbs` 自动包含待领弈子，走 `runSharedMatchCommand(pool,state,{type:'claimOrb',round,orbId})`；前缀 `opening-batch-b/`。战斗锁定时拒绝领取（`wrong-phase`），陈旧round=`stale-round`，缺共享policy=`shared-pool-required`，重复/未知该前缀=`already-claimed`，已淘汰=`seat-eliminated`，备战席满=`bench-full`。不改网络命令形状。池内缺卡按既有policy折金；满席保留待领而非丢弃。魔像自身不占共享池卡数。

独立流：根seed与UTF-16 FNV-1a32流名异或后使用 `lcg32-v1`，抽样 `floor(word×range/2^32)`。

- `opening-encounter-v1/seat/<seat>/trainer-golems/emblems`：3词部分Fisher–Yates，单人seat=`solo`。
- `opening-encounter-v1/seat/<seat>/warwicks-hunger/<JSON([battleId,victimId])>`：3词依次判掉落/入口/条件奖项，未掉落也独立取3词；必要时再取组件/费用/弈子词。每个首次死亡有独立命名流，无保底或累计次数截断。
- `opening-encounter-v1/seat/<seat>/<奇遇>/<roundId>/bonus`：额外组件、金箱、银箱；每个锻造器另以奖励ID加 `/forge`派生4词无放回候选。
- 仍使用既有shared选择流确定全局奇遇；这些个人效果不用shared连续消费。商店、战斗、基础掉落、装备等旧流不受影响。

魔像收据：`opening-batch-b/trainer-golems`及其 `/emblem/0..2`，source=`opening-trainer-golems`。奖励收据：`opening-batch-b/`+`JSON([encounter,battleId,key,index])`，source=`opening-batch-b`，其中key是首次死亡victimId或component/gold-orb/anvil/i/silver/i。

首次死亡账本记录完整战斗死亡事件的首次实例，不截断原事件；投影时用开战阵容排除召唤物/中途新生单位/野怪。恢复重放比对 `openingDeaths`，按战斗事实重算奖励身份并核对已发收据和物品来源；不在恢复时补发资源。魔像缺收据、换纹章、移入备战席、错误星级都拒绝。联机恢复仍遵从原共享池快照边界，不扩展为单人 `restoreMatch` 可恢复共享对局。

## 4. 独立手算向量

| 向量 | 手算期望与验证 |
| --- | --- |
| 纹章无放回 | n=22，依次从22/21/20个候选等权取；单枚入选率3/22，任意无序三元组1/C(22,3)=1/1540。测试独立BigInt FNV/LCG逐词推导，128种seed×2个seat核对，无重复 |
| 魔像边界 | 3-7仍600/55；4-1=600×1.8=1080、55×1.5=82.5；5-7不变；6-1=1080×1.8=1944、82.5×1.5=123.75；82.5×1.2=99 |
| 沃里克边界 | `ceil(bps×2^32/10000)` 是新区间首词，前一词仍旧分支；测试3000、9500、普通8300/9800、稀有5000/7900/8900/9400/9900边界 |
| 沃里克概率 | 每合格死亡普通1金=0.3×0.95×0.83=23.655%；稀有任一种总和=1.5%；全复制器=0.3×0.05×0.01=0.015%，不追加普通金币 |
| 弈子档位 | L=9高档按10级5/10/20/40/25，L=10仍10级；两名按当前L，每名独立1星普通1–5费。遍历种子验证没有6费；真实联机PvP生成单位奖后通过共享池领取并检验守恒 |
| 蟹编组/HP | 另写literal项目坐标和生命表，独立于生产CRAB_GROUPS核对8轮；4-7特别核对原(6,6)→(5,2)，未对称修正 |
| 蟹额外金 | 前6轮数量2+3+4+3+5+5=22，每杀1金；5-7/6-7普通蟹无这笔额外杀金 |
| 固定预算 | 2-7、3-7各一组件；4-7一个金箱组；即使该轮失败仍执行已批准固定额外事件。每个既有金/银箱条件行的区间起点均测覆盖 |
| 巨蟹伤害 | tick40/80/120对0魔抗单目标100/200/300，累计600；10万HP剩99400；没有普攻事件；受控制错过首跳，实际首跳仍100 |
| 巨蟹奖励 | 5-7/6-7胜利各2成装锻造器+2银箱组，失败没有这项巨蟹胜利奖励；重复结算/末轮超时选择不重发 |
| 单机/联机/恢复 | 4奇遇×8席初始化；单机首次战斗中/结算后/下一轮恢复一致；真实沃里克PvP存档一致；双边战斗首次死亡、三纹章魔像；联机真实3轮PvE→PvP→领单位奖励→拒绝重复领取且卡池守恒 |

测试中的隔离战斗/合成回合向量仅用于公式和边界，**不冒充完整可恢复的历史整局**。公开命令路径与存档用例另测。

## 5. 验证结果与体积

最后一组相关测试 **12文件，289/289通过**，包含本批71项、存档52项、单位属性42项、PR5 31项、消耗品20项、T3 11项、TP 23项、PvE机制21项/序列化6项、Match合同12项。没有跑全套。

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner tests/opening-encounters-batch-b.test.ts tests/m6-persistence.test.ts tests/unit-stats.test.ts tests/r3r4-consumable-targets.test.ts tests/r3r4-consumables.test.ts tests/opening-encounters-pr5.test.ts tests/t3-round-settlement.test.ts tests/tp-shared-pool.test.ts tests/tp-rewards-and-rounds.test.ts tests/m8-b7-mechanisms.test.ts tests/m8-b7-serialization-reuse.test.ts tests/match-contract.test.ts
npm run typecheck
```

`node_modules`沿现有软链；默认Vite配置打包会尝试写软链目标 `.vite-temp`，该目录只读，所以测试/测体积用 `--configLoader runner`，没有改配置或权限。

`npm run typecheck` **未通过**：唯一错误是 `src/rendering/online/stage-track.ts:18` 的 `Record<MonsterFamily,string>` 缺少新 `scuttle`、`giant-crab` 两项。属于本批新增类型要求导致的待接线，不能称旧基线错误；按用户禁止未改该文件，Claude补名称映射即可。simulation与新测试没有剩余TS错误。

直接 `vite build --configLoader runner --outDir /tmp/encb-build-final --emptyOutDir` 成功，仅用于生产体积测量，**不等于含typecheck的 `npm run build`通过**。从本地git只读导出M7和输入HEAD到临时目录，使用同一依赖、默认production配置，各顶层JS分别用Node `zlib.gzipSync({level:9})`求和（与门槛脚本相同，3D不计入2D）。未跑浏览器首交互或CI完整预算脚本。

| 构建 | 2D JS gzip9 | 相对M7 |
| --- | ---: | ---: |
| 固定M7 `15313a75` | 424,763 B | 1.00000 |
| 输入HEAD `b5a05d1a` | 654,241 B | 1.54025 |
| 本批工作树 | 660,193 B | 1.55426 |

本批净增 **5,952 B**；现行1.50上限 **637,144 B**，输入树已超 **17,097 B**，当前超 **23,049 B**。未放宽门槛、未做越界打包改造。新增运行时内容只有紧凑表和执行代码，证据文字只在文档。

## 6. 保留不改的旧测试失败

相关旧兼容测试另跑：PR2/PR6/旧trainer/奇遇身份/T2、PvE目录与B7审计、opening-random历史身份。将各文件最新一轮结果合并（重复运行不重复计数），共 **580项：438通过、142失败，另1文件收集失败**。其中最终相关12文件289项全过；余下142项旧失败清单如下。没有修改它们的断言、golden、oracle或历史字节。早期发现的存档共享引用回归已修复，52项存档全过，不计入残留清单。

- PR2/PR6/旧trainer/奇遇配置：17项仍断言魔像/沃里克/蟹关闭、奖励无变化或旧配置digest；本批有意启用，需统一epoch时重审。
- T2：1项仍按1200tick预期，父规则分支已改900；非本批重新改加时。
- PvE目录：1项期望12个neutral definition，本批新增8种生命的普通蟹+1巨蟹后为21。
- `opening-random-identity.test.ts`：123项历史checkpoint、来源或轨迹指纹不再匹配。混有父规则分支的旧G23/选择/计时差异，以及seed42从普通PvE变为蟹；不将其全部归因于本批。
- `m8-b7-audit-vectors.test.ts`：收集阶段 `earned source must be dead`，导入的老公开路线oracle仍要求基础drop的原怪物ID出现在当前战斗死亡表；本批通过显式载体映射对应蟹ID。保留该旧oracle，统一录制时更新独立模型后重跑。这个文件没有执行到单个it，不能计作通过。

### 精确失败名称（所选测试集合）

**`tests/m8-b7-catalog.test.ts`：1项**

- `B7 isolated approved content, not the enabled Match catalog compiles all 12 authored base stats, 25%/1.4 critical inputs and 0/0 mana`

**`tests/opening-encounters-pr2.test.ts`：1项**

- `exactly six PR2 effects become enabled; unimplemented effects retain original weights and null evidence`

**`tests/opening-encounters-pr6.test.ts`：7项**

- `PR6 Mel threshold observation with reward gate closed keeps all rewards closed and preserves only the evidenced B-patch branch override`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 0`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 1`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 2`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 3`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 4`
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 5`

**`tests/opening-encounters-trainer-golems.test.ts`：6项**

- `PR4 trainer evidence admission and executable emblem validation retains the 4% identity, known counts, approved conventions and unknown core parameters`
- `PR4 trainer evidence admission and executable emblem validation rejects caller-supplied enabled instead of filling the evidence gap`
- `PR4 trainer evidence admission and executable emblem validation rejects enabling only the weighted entry and accepts the exact disabled config copy`
- `PR4 trainer evidence admission and executable emblem validation accepts every executable distinct triple, returns a detached frozen tuple, without declaring a sampling pool`
- `PR4 disabled lifecycle, bypass rejection and restoration repeated explicit grants fail atomically; generic round hooks and restore never grant or draw`
- `PR4 disabled lifecycle, bypass rejection and restoration keeps all eight seats closed and rejects forged shared receipts and foreign bindings`

**`tests/opening-encounters.test.ts`：3项**

- `opening encounter PR1 content and independent selection preserves all sixteen official 14.24b intervals and explicit disabled identities`
- `opening encounter PR1 content and independent selection rejects incomplete/reordered/enabled configs without altering the supplied input`
- `opening encounter PR1 content and independent selection includes the full table and conventions in both freshly recomputed digests`

**`tests/opening-random-identity.test.ts`：123项**

- `cannon: checkpoint 0 survives strict text/object restore`
- `cannon: checkpoint 1 survives strict text/object restore`
- `cannon: checkpoint 2 survives strict text/object restore`
- `cannon: checkpoint 3 survives strict text/object restore`
- `cannon: checkpoint 4 survives strict text/object restore`
- `cannon: checkpoint 5 survives strict text/object restore`
- `cannon: checkpoint 7 survives strict text/object restore`
- `cannon: checkpoint 9 survives strict text/object restore`
- `cannon: checkpoint 11 survives strict text/object restore`
- `cannon: checkpoint 13 survives strict text/object restore`
- `cannon: checkpoint 15 survives strict text/object restore`
- `cannon: checkpoint 16 survives strict text/object restore`
- `cannon: checkpoint 17 survives strict text/object restore`
- `cannon: checkpoint 19 survives strict text/object restore`
- `cannon: checkpoint 20 survives strict text/object restore`
- `cannon: checkpoint 21 survives strict text/object restore`
- `cannon: checkpoint 22 survives strict text/object restore`
- `cannon: checkpoint 23 survives strict text/object restore`
- `cannon: checkpoint 24 survives strict text/object restore`
- `cannon: checkpoint 25 survives strict text/object restore`
- `cannon: checkpoint 26 survives strict text/object restore`
- `cannon: checkpoint 27 survives strict text/object restore`
- `cannon: checkpoint 28 survives strict text/object restore`
- `cannon: checkpoint 29 survives strict text/object restore`
- `cannon: checkpoint 30 survives strict text/object restore`
- `cannon: checkpoint 31 survives strict text/object restore`
- `cannon: checkpoint 32 survives strict text/object restore`
- `cannon: checkpoint 33 survives strict text/object restore`
- `cannon: checkpoint 34 survives strict text/object restore`
- `cannon: checkpoint 35 survives strict text/object restore`
- `cannon: checkpoint 36 survives strict text/object restore`
- `cannon: checkpoint 37 survives strict text/object restore`
- `cannon: checkpoint 38 survives strict text/object restore`
- `cannon: checkpoint 39 survives strict text/object restore`
- `cannon: checkpoint 40 survives strict text/object restore`
- `cannon: checkpoint 41 survives strict text/object restore`
- `cannon: checkpoint 42 survives strict text/object restore`
- `cannon: checkpoint 43 survives strict text/object restore`
- `cannon: checkpoint 44 survives strict text/object restore`
- `cannon: checkpoint 45 survives strict text/object restore`
- `cannon: checkpoint 46 survives strict text/object restore`
- `cannon: checkpoint 47 survives strict text/object restore`
- `cannon: checkpoint 48 survives strict text/object restore`
- `cannon: checkpoint 49 survives strict text/object restore`
- `cannon: checkpoint 50 survives strict text/object restore`
- `cannon: checkpoint 51 survives strict text/object restore`
- `cannon: checkpoint 52 survives strict text/object restore`
- `cannon: checkpoint 53 survives strict text/object restore`
- `cannon: checkpoint 54 survives strict text/object restore`
- `cannon: checkpoint 55 survives strict text/object restore`
- `cannon: checkpoint 56 survives strict text/object restore`
- `cannon: checkpoint 57 survives strict text/object restore`
- `cannon: checkpoint 58 survives strict text/object restore`
- `cannon: checkpoint 59 survives strict text/object restore`
- `cannon: checkpoint 60 survives strict text/object restore`
- `cannon: checkpoint 61 survives strict text/object restore`
- `cannon: checkpoint 62 survives strict text/object restore`
- `cannon: checkpoint 63 survives strict text/object restore`
- `cannon: checkpoint 64 survives strict text/object restore`
- `cannon: checkpoint 65 survives strict text/object restore`
- `cannon: checkpoint 66 survives strict text/object restore`
- `sniper: checkpoint 0 survives strict text/object restore`
- `sniper: checkpoint 1 survives strict text/object restore`
- `sniper: checkpoint 2 survives strict text/object restore`
- `sniper: checkpoint 3 survives strict text/object restore`
- `sniper: checkpoint 4 survives strict text/object restore`
- `sniper: checkpoint 5 survives strict text/object restore`
- `sniper: checkpoint 7 survives strict text/object restore`
- `sniper: checkpoint 9 survives strict text/object restore`
- `sniper: checkpoint 11 survives strict text/object restore`
- `sniper: checkpoint 13 survives strict text/object restore`
- `sniper: checkpoint 15 survives strict text/object restore`
- `sniper: checkpoint 16 survives strict text/object restore`
- `sniper: checkpoint 17 survives strict text/object restore`
- `sniper: checkpoint 19 survives strict text/object restore`
- `sniper: checkpoint 20 survives strict text/object restore`
- `sniper: checkpoint 21 survives strict text/object restore`
- `sniper: checkpoint 22 survives strict text/object restore`
- `sniper: checkpoint 23 survives strict text/object restore`
- `sniper: checkpoint 24 survives strict text/object restore`
- `sniper: checkpoint 25 survives strict text/object restore`
- `sniper: checkpoint 26 survives strict text/object restore`
- `sniper: checkpoint 27 survives strict text/object restore`
- `sniper: checkpoint 28 survives strict text/object restore`
- `sniper: checkpoint 29 survives strict text/object restore`
- `sniper: checkpoint 30 survives strict text/object restore`
- `sniper: checkpoint 31 survives strict text/object restore`
- `sniper: checkpoint 32 survives strict text/object restore`
- `sniper: checkpoint 33 survives strict text/object restore`
- `sniper: checkpoint 34 survives strict text/object restore`
- `sniper: checkpoint 35 survives strict text/object restore`
- `sniper: checkpoint 36 survives strict text/object restore`
- `sniper: checkpoint 37 survives strict text/object restore`
- `sniper: checkpoint 38 survives strict text/object restore`
- `sniper: checkpoint 39 survives strict text/object restore`
- `sniper: checkpoint 40 survives strict text/object restore`
- `sniper: checkpoint 41 survives strict text/object restore`
- `sniper: checkpoint 42 survives strict text/object restore`
- `sniper: checkpoint 43 survives strict text/object restore`
- `sniper: checkpoint 44 survives strict text/object restore`
- `sniper: checkpoint 45 survives strict text/object restore`
- `sniper: checkpoint 46 survives strict text/object restore`
- `sniper: checkpoint 47 survives strict text/object restore`
- `sniper: checkpoint 48 survives strict text/object restore`
- `sniper: checkpoint 49 survives strict text/object restore`
- `sniper: checkpoint 50 survives strict text/object restore`
- `sniper: checkpoint 51 survives strict text/object restore`
- `sniper: checkpoint 52 survives strict text/object restore`
- `sniper: checkpoint 53 survives strict text/object restore`
- `sniper: checkpoint 54 survives strict text/object restore`
- `sniper: checkpoint 55 survives strict text/object restore`
- `sniper: checkpoint 56 survives strict text/object restore`
- `sniper: checkpoint 57 survives strict text/object restore`
- `sniper: checkpoint 58 survives strict text/object restore`
- `sniper: checkpoint 59 survives strict text/object restore`
- `sniper: checkpoint 60 survives strict text/object restore`
- `sniper: checkpoint 61 survives strict text/object restore`
- `sniper: checkpoint 62 survives strict text/object restore`
- `sniper: checkpoint 63 survives strict text/object restore`
- `sniper: checkpoint 64 survives strict text/object restore`
- `sniper: checkpoint 65 survives strict text/object restore`
- `sniper: checkpoint 66 survives strict text/object restore`
- `recomputes the first battle terminal and every event hash from public commands`

**`tests/t2-two-sided-battle.test.ts`：1项**

- `T2 true two-sided combat real equipped tanks reach the unchanged 1200-tick limit; budget exhaustion is not a draw`

## 7. Claude 接线清单与合并风险

1. **阻塞类型检查**：`src/rendering/online/stage-track.ts:18` 的怪物中文名称表补 `scuttle=迅捷蟹`、`giant-crab=危险巨蟹`；不在本批跨目录修改。
2. 奇遇横幅现有 `readOpeningEncounterView` 自动显示active。魔像棋子读取现有单位/装备状态；显示“0人口、不可出售、永久纹章”，精确基础AD显示55/82.5/123.75；控件失败按域返回，不由UI删装备/卖单位/升星。怪物预览说明已由域selector给出。
3. 奖励可读 `readOpeningBatchBRewards`（`simulation/match`公开导出）和既有 `readLootView.unclaimedOrbs`。若要在远端展示额外箱子分组，由Claude在本人投影适配接入；不要向其他席位公开payload。未新增网络命令；单位领取仍用已有claimOrb。奖励是战后统一入账，战中死亡动画不能再次加金/发物品。
4. `mechanicGranted`/`itemEquipped`用于魔像初始接线；战后奖励沿既有mechanic receipt和choice事件。巨蟹伤害已有packetDamage，当前没有另加跳跃视觉事件；需要跳跃动画时从模拟tick/伤害包及runtime.castCount读信息，不能使用墙钟另算伤害。
5. 建议文案“沃里克掉落参数采用项目批准值”“巨蟹属性待校准”；银箱是战利品箱，不是银色强化。组内金/物品已经发放；剩余单位可单独领取，不能将一组奖励再次整包发放。
6. 输入分支和本批都超过1.50体积线，仍需集成阶段压缩/拆包；不提高门槛。另一个Codex的梅尔/维克托/订阅会改共享文件，本批运行逻辑尽量新文件，`opening-encounters.ts`只改四项状态+一个policy导入/属性；`S13_RULES_GAP.md`仅新增顶部集中说明。
7. #410未合，epoch/digest/golden按指令留待统一处理。当前候选不能用于新旧版本混跑或发布；历史测试失败不能用放宽断言解决。未做全套/浏览器真机验收，UI交叉验货与统一录制仍是后续任务。现有已批准数值无待用户再决定项。
