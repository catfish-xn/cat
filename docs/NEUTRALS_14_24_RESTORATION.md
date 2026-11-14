# 野怪恢复 14.24：2026-10-29 用户批准记录

本次在 `claude/v26-neutrals-1424`、起点 `4baaaf5a9a74335d46fa0e037a93e4e595f05384` 实施。只修改工作区，不写 `.git`、不提交、不重录录制fixture、不执行任何 `--write`；三张独立可执行oracle按批准规则手写同步。用户批准表是本次实施依据；不是重新调整平衡。14.24 客户端来源为 CommunityDragon 的 `characters/tft_chaosminionmelee`、`tft_chaosminionranged`、`tft_krug`、`tft_murkwolf`、`tft_murkwolfmini`、`tft_razorbeak`、`tft_razorbeakmini`、`tft_elderdragon`，数量来自 `map22.bin.json` 关卡表。上游入口：[14.24 game](https://raw.communitydragon.org/14.24/game/)。本次直接访问 BIN JSON 被403拒绝；没有把未读取到的网络内容写成独立复核证据。已有 `selected-neutrals.json` 原始归档不改。

`M8B_ENCOUNTERS.md`、`M8B_POLICY.md` 的旧“项目削弱表”及相关耐久/DPS、龙伤害向量已被本次用户决定取代；文档保留历史表并明确标注覆盖关系。原始资料、历史 fixture 与历史验收证据不改。

## 完成：前后数值

数值顺序：**单体 HP / AD / 每秒AS / 护甲 / 魔抗 / 射程格数**。攻速存储为整数Bps，0.8→8000、1.0→10000；攻击间隔沿原公式，分别25、20tick。50ms/tick、固定1星、零蓝、25%/140%暴击不变。

| 定义／回合 | 改前 | 改后 |
| --- | --- | --- |
| 近战A，1-2 | 110 / 8 / 0.5 / 0 / 0 / 1 | 250 / 20 / 0.8 / 10 / 10 / 1 |
| 近战B，1-3 | 160 / 10 / 0.6 / 0 / 0 / 1 | 250 / 20 / 0.8 / 10 / 10 / 1 |
| 远程B，1-3 | 120 / 9 / 0.6 / 0 / 0 / 3 | 150 / 40 / 0.8 / 10 / 10 / 3 |
| 近战C，1-4 | 220 / 12 / 0.6 / 0 / 0 / 1 | 250 / 20 / 0.8 / 10 / 10 / 1 |
| 远程C，1-4 | 160 / 10 / 0.6 / 0 / 0 / 3 | 150 / 40 / 0.8 / 10 / 10 / 3 |
| 石甲虫×3，2-7 | 400 / 30 / 0.8 / 20 / 20 / 1 | 1200 / 110 / 0.8 / 50 / 25 / 1 |
| 大狼×1，3-7 | 900 / 50 / 0.8 / 15 / 15 / 1 | 1300 / 230 / 1.0 / 15 / 15 / 1 |
| 小狼×4，3-7 | 450 / 22 / 0.8 / 15 / 15 / 1 | 550 / 135 / 1.0 / 15 / 15 / 1 |
| 大鸟×1，4-7 | 1400 / 65 / 0.8 / 25 / 25 / 1 | 2400 / 230 / 0.8 / 25 / 25 / 1 |
| 小鸟，4-7 | ×5；680 / 32 / 0.8 / 25 / 25 / 1 | ×4；1450 / 180 / 0.8 / 25 / 25 / 1 |
| 远古龙×1，5-7 | 6000 / 85 / 1.0 / 50 / 50 / 2 | 10000 / 900 / 0.8 / 50 / 50 / 2 |
| 6-7 | 峡谷先锋×1；9000 / 120 / 1.0 / 60 / 60 / 2 | 远古龙×1；与5-7同定义、同数值 |

射程依据为 [`FIVE_COST_3STAR_FIXES.md:19`](FIVE_COST_3STAR_FIXES.md#逐项依据与实现) 和[原件摘录](evidence/five-cost-3star/source-excerpts.md#原版射程映射不是几何坐标比例尺)中的 `map22.bin.json.gz /{9fcfd7a6}/HexToRangeMap`：1/2/3/4格对应180/420/610/890。按不超过原始攻击射程的最高映射阈值离散化，660处于610与890之间→**3格**，420正好对应**2格**。这是非线性攻击射程映射，不能用 `floor(rawRange/180)` 论证，也不能当作技能碰撞几何比例尺；本次未改战斗距离算法。

三轮小兵的 A/B/C ID 保留为部署与素材别名，数值相同；数量仍为2近战、2近战+1远程、2近战+2远程。4-7仅移除 `r05@(5,3)`，其余站位不改，总部署25→24。6-7保留原Boss站位 `(3,1)`，改为 `elder-dragon-v1 / d01 / pve-elder-dragon`，实例ID仍包含roundId，因此不与5-7冲突。史诗奖励载体同步改为d01，奖励表、权重、数量及结算规则不改；载体数量和身份变化会改变奖励身份及部分分配，须重录。

石甲虫死亡回血、狼跳后排、鸟每死同伴+1500Bps及5层上限、龙35%/至多两个副目标均保持现有实现。现行5只鸟最多4个同伴触发，最高实际间隔16tick；历史5层15tick仍以合成第5同伴验证。先锋定义和通用冲锋实现保留作遗留回归，八个普通S13遭遇均不再部署先锋。PvE打输扣血公式没有修改。

版本使用 `s13-g2-3-v26-neutrals-1424 / s13-14.24b-g2-3-v26-neutrals-1424`，目录版本 `s13-14.24-neutrals-v1`；schema/save/replay/command仍为12/8/8/7，组合政策仍为 `m8b-pve-project-v2`。生成的digest常量及v25 fixture留给Claude统一更新，本轮只做只读身份校验；发布前必须完成。

## 完成：调用点及展示映射

| 路径 | 数据调用链／处理 |
| --- | --- |
| 单机 | `content/neutrals.ts` + `content/neutral-encounters.ts` → `neutral-encounter-compiler.ts:compileNeutralEncounter/COMPILED_NEUTRAL_ENCOUNTERS` → `round-enemies.ts:createRoundEnemies/ROUND_ENEMY_PROJECTIONS` → `match.ts:prepareRound/createMatch` → `combat.ts:createCombatWithEvents`。`units.ts`、`unit-stats.ts`、`combat-initialization.ts` 和 `combat-abilities.ts` 读取同源定义，无额外数值表。 |
| 联机 | `server-entry/index.ts` 公共导出 → `server/room/room.ts` 的 `createMatch`、`runSharedMatchCommand(startCombat)`、PvE推进 → `server/room/battle-resolver.ts`。服务器不另算野怪，未修改 `src/server/`、未新增计时API。 |
| 本地房间 | `rendering/online/local-room-client.ts` 使用同一 `Room`、同一server-entry规则；没有另一套野怪数值。 |
| bot | `server/room/bot-driver.ts` 只发席位命令，PvE仍走同一Room/Match规则；本轮没有调整bot决策来补偿难度。 |
| 掉落／恢复／蟹奇遇 | `content/orbs.ts:EPIC_SOURCES` 的6-7 h01→d01；`orb-layout.ts`、`loot-freeze.ts`、`opening-crabs.ts`、`neutral-restore.ts`、`neutral-receipts.ts` 均从目录身份生成或校验。蟹奇遇本身数值和机制不改。 |
| 预览 | `encounter-selectors.ts:readEncounterPreview` 从相同定义生成名字、属性和能力描述；普通PvE说明改为2026-10-29批准的14.24基础数值。联机 `private-seat-view.ts` 与 `rendering/online/seat-view-adapter.ts` 传递同一投影。 |
| 2D名／头像 | `rendering/display-names.ts`、`presentation/hero-identity.ts` 读NEUTRAL_DEFINITIONS；`presentation/s13-neutral-assets.ts` 用family得到 `elder-dragon` 头像；`rendering/online/stage-track.ts` 用目录+family生成“6-7 野怪：远古巨龙 ×1”。按roundId查询遭遇，避免5-7/6-7共用encounterId时误取首行；既有名称／头像映射复用。 |
| 3D | `rendering/three-mode/placeholder-renderer.ts` 以definitionId加载模型，已有 `pve-elder-dragon` 高度映射；`rendering3d/assets.ts:ModelCache.load` 从可配置manifest取key；`scripts/assets3d/neutral-config.mjs` 已将该ID绑定tft_elderdragon及五段动作。无需新模型／回合特判。 |
| 静态展示样例（非运行对局） | `presentation/loot-preview/fixtures.ts:SAMPLE_SOURCES` 已依本次用户明确指示改为6-7远古龙d01；文件声明游戏入口不导入。 |

3D远古龙已经存在：在本机忽略目录 `../cat-v23-anvil-assets/assets3d-local/anvil-delta/root-H1IaDF/roots/0/roots/4/roots/8/models/pve-elder-dragon/model.glb` 只读验证GLB v2、882804字节、头部长度一致，五段动作是 `tft_dragon_idle_aggro1 / tft_dragon_run / tft_dragon_spell / tft_elderdragon_takeoff / tft_dragon_death`。当前工作树没有本地素材包；3D运行须配置已有完整素材根。本轮未复制素材，未做浏览器视觉测试。

## 替换的断言

所有原有断言保留或逐项替换为批准后的精确值，没有删除、skip、扩大容差或提高超时；历史录制fixture保留旧证据；三份独立可执行oracle按批准规则手写更新，未导入生产内容表。新增合成向量只用于不再被S13目录部署的旧机制回归，不作为真实Match验收。

| 测试 | 旧断言 → 新断言／保留边界 |
| --- | --- |
| `m8-b7-catalog.test.ts` | 11项有效野怪基础数值逐行按上表替换；小兵40/34tick→25，狼25→20，龙20→25；先锋定义行不变，按独立字面9000/120/10000/20/60/60/2断言编译属性；另逐字段断言编译器产出的15%/cap300/10tick path-charge程序，活跃目录无先锋。 |
| `m8-b7-catalog.test.ts` | 完整阵型删r05；6-7 `rift-herald-v1/h01/pve-rift-herald`→`elder-dragon-v1/d01/pve-elder-dragon`；只数 `[2,3,4,3,5,6,1,1]`→`[2,3,4,3,5,5,1,1]`；总实例及唯一ID数25→24；目录版本同步。 |
| `m8-b7-catalog.test.ts` | 鸟6个程序、每个cap5→5个程序、每个仍cap5；6-7开场冲锋→龙35%锥形且openingDefinitions为空。 |
| `m8-u5-preview.test.ts` | 同上独立HP/AD/间隔/双抗/射程表、完整阵型与总身份数25→24；终局当前encounterId改为elder-dragon-v1。预览不变性、无隐藏字段、恢复断言保留。 |
| `m8-b6-round-catalog.test.ts` | 两处6-7 encounterId从先锋替换为龙，序号38、最终轮、其他轮次断言不变。 |
| `round-enemies.test.ts`、`m5-content.test.ts` | 6-7敌方定义从pve-rift-herald→pve-elder-dragon；1星、不带装备断言保留。 |
| `server/stage-track.test.ts` | “6-7 野怪：峡谷先锋 ×1”→“6-7 野怪：远古巨龙 ×1”。 |
| `assets3d-neutrals.test.ts` | 配置必须覆盖全部定义的断言保留；活跃部署集合精确等于配置减去遗留先锋，并显式断言无先锋、有远古龙。 |
| `m8-b7-mechanisms.test.ts` | 石甲虫仍缺200：起始HP200→1000，以1200上限保留两笔请求200/66、重伤实疗134/44、无重伤200/0；最终HP378/400→1178/1200。 |
| `m8-b7-mechanisms.test.ts` | 小鸟真实死亡目标从被删除r05→r04，攻击者移至相邻(4,4)，保留一次死亡、下一tick25→22、单贡献、无额外攻击/RNG的全部断言。0/1/2/5层向量保留；5层用明确的合成第5同伴，另加现行4层=16tick。 |
| `m8-b7-mechanisms.test.ts` | 龙AD85、主包119/副包29→AD900、主包1260/副包315；目标HP500→2000，余HP381/471→740/1685，未命中者500→2000，保留1词、最多两副包、never暴击及恢复不重发；同样断言覆盖5-7和6-7。 |
| `m8-b7-known-limitations.test.ts`、`m8-b7-mechanisms.test.ts`、`m8-b7-audit-combat-vectors.test.ts` | 先锋的纯战斗场景改用 `neutral-helpers.ts:legacyHeraldVector()`，保留150/300封顶、伤害先于控制、致死不控、免控/防伤/不重发等精确断言；不把先锋放回6-7。 |
| `m8-b7-audit-combat-vectors.test.ts`（从原audit-vectors移动，全部断言保留） | 88个独立奇偶/边界布局的龙副包29→315；目标HP500→2000以避免1260主包致死干扰几何验证，布局数与攻击覆盖断言不变。纯战斗部分独立运行；原audit-vectors中的真实Match部分仍依赖待重录路线。 |
| `m8-b7-match-wiring.test.ts` | 总部署25→24；普通PvE说明精确替换新文案。开场位移与消费恢复改用3-7狼跳；6-7改验真实龙攻击、光环先行、护具与非法先锋开场/控制注入。存量鸟的真实buff覆盖重定时、删除收据/贡献等篡改。先锋冲锋/眩晕与tick12到期另有纯战斗JSON恢复回归。 |
| `opening-encounters-batch-b.test.ts` | 4-7“第6载体r05映射c4”→“第5载体r04映射c4”，并新增已删除r05不被重映射的精确断言；蟹金币、奖励与机制断言不变。 |
| `m8-b8-loot-freeze.test.ts`、`m8-b10-encounter-outcomes.test.ts` | 独立轮次表及6-7 encounterId断言改为elder-dragon-v1；独立oracle的鸟slot减为r00–r04，6-7改elder-dragon-v1/d01，RNG、完整payload、收据与载体断言保留。 |

本轮审查修正的补充断言：

| 测试 | 旧前提 → 新覆盖 |
| --- | --- |
| 三份独立oracle | `m5/oracle.g2.cjs:ORIGINAL_PVE_SLOTS`、`orb-combo-oracle.cjs:ROUNDS` 的4-7载体r00–r05→r00–r04、6-7 h01→d01；后者与 `epic-loot-oracle.cjs:TABLE` 的6-7 encounterId→elder-dragon-v1。仅手写目录事实，不导入生产内容，不改抽样算法。 |
| `neutral-helpers.ts`、catalog、mechanisms | 辅助函数复制生产path-charge程序→直接调用生产 `compileNeutralEncounterDefinition`；catalog的独立字面期望覆盖真实编译分支。新增逐tick JSON恢复：仅一笔150伤害、一次位移、一次眩晕，tick12到期且13tick内RNG=0。 |
| `m8-b8-live-reveal.test.ts` | 五只鸟全部有奖励，移除对不存在r05的依赖。1-4的三个无奖励小兵用于真实末次死亡、零新增证据、仅发此前m01两份英雄奖励、同源死亡冲突拒绝的覆盖。双载体场景以公开蕾欧娜/洛里斯换位，tick110的r00/r01保留战中同拍揭示三条奖励而不发放；tick178的r03/r04保留两只英雄载体同拍死亡与四条奖励证据。因删掉第六鸟，后者现在也是终止批次，因此另断言同事务揭示/发放与不重发，未把战中“无资源变化”断言改成允许发放。旧裸装Loris/Zyra已均为零击杀，改用公开取得的二星Loris：青龙刀/石像鬼/冕卫、(6,7)，tick655仅杀r00，三份奖励/1装备出生/2单位出生；青龙刀/石像鬼/离子、(0,4)，tick357仅杀r01，一份奖励/1装备出生/0单位出生。两场均仍是实际败局，全部唯一发放、弃置、恢复与篡改断言保留。 |
| `epic-loot-reforger.test.ts` | 6-7先锋开场HP真实性→3-7狼跳的真实冻结HP、光环增血及篡改拒绝；6-7龙仍验证异常付费收据边界。没有降低恢复校验或改领域规则。 |
| `m5-route.test.ts` | “全计划item必发”→独立oracle逐条核对完整取得/弃置分区。固定mage路线2-7仅k02死，k01/k03的三条掉落（含两个组件）全部弃置，敌存活2、扣血3；总装备价值20→18、扣除终局未开锻造器并计额外组件砧后19→17。其他路线仍要求零PvE丢失及原精确总值。 |

编译器新增纯函数 `compileNeutralEncounterDefinition(encounter: NeutralEncounterDefinition): CompiledNeutralEncounter`，只编译显式受信内容；重复slot/格、敌方部署越界、未知定义和非法数值仍抛RangeError。`compileNeutralEncounter(roundId, encounterId?)` 只改为调用此函数，真实目录、Match和恢复从未安装测试先锋。没有新服务器导出或计时API。

## 需要重录／尚待集成

测试命令、实际结果与逐项失败清单在下方验收记录中。生成的 `content/identity-constants.ts` 未写回；当前发布身份已升v26，但digest常量仍是v25旧值，Claude须在统一重录时按完整根刷新，不能带此状态发布。旧版本恢复被版本检查拒绝是预期行为。

Claude统一处理：`tests/v25-online-rules-content-baseline.json` 的下一纪元、`tests/fixtures/m5/full-match-golden.v25-online-rules.json` 后继、v25-recorded-states、b8-fingerprints、herald-raw/support、transfer-route与chest-trial后继，以及 `scripts/verify-m8-herald-fixtures.cjs` 等当前纪元入口。`tests/fixtures/m8-neutral-public-route.ts` 的seed65/78本轮已通过公开命令真实33战通关断言；未改seed、注入战果或重录JSON。三份独立oracle（m5 ORIGINAL_PVE_SLOTS、orb-combo ROUNDS、epic-loot TABLE）现已逐份手写更新并用于验收，不在待重录清单。历史v25文件保留，不就地覆盖成新规则。

特别注意：旧先锋的冲锋/眩晕/控制收据场景从S13真实Match中消失。纯战斗层已保留冲锋路径、伤害先于控制、150/300封顶、免控/防伤、10tick眩晕及tick12到期、JSON恢复不重发。真实Match改验仍在目录内的狼跳、龙攻击和鸟同伴buff，不再读取旧先锋raw存档验证新内容；没有放宽restore校验。

## 风险

- 1-2近战HP110→250、AD8→20、AS0.5→0.8；1-3远程AD9→40。单英雄开局必胜、100HP及旧收益轨迹不再有保证，bot与公开路线可能减员或提前终局；本轮不修改bot策略或PvE失败扣血来补偿。
- 石甲虫耐久与AD、狼/鸟输出、龙AD大幅上升。旧通关路线、精确击杀tick、真实死亡反应及奖励载体的测试前提可能失效；失败需区分内容漂移和领域回归。
- 移除r05会改变round-robin奖励载体分布；6-7换encounterId/slot会改变orb/drop/receipt身份。奖励算法与预算未改，但身份和实际取得路径必须重新验证。
- 3D远古龙文件已存在于本机另一个忽略目录，当前工作树缺完整素材包；浏览器外观尚未实测。环境无CODEX_BROWSER_CLIENT/PLAYWRIGHT_WS_ENDPOINT，本轮不启动Chrome；需要视觉验收时应由Claude经codex-browser exec启动专用任务。
- 旧先锋注册项仍在定义/素材表中以保留通用机制与历史资料，本轮明确断言其不出现在任何普通S13部署；不是删除通用冲锋功能。
- 最终live-reveal两项装备部分败局约17.8/17.0秒，接近既有20秒上限；本轮没有提高超时，Claude完成纪元录制后应在目标CI负载下复验。

## 验收记录与文件定位

主要数值与目录：`src/simulation/content/neutrals.ts:49`（HexToRangeMap约定）及`:58`（基础数值）、`content/neutral-encounters.ts:39`（减鸟）及`:44`（6-7龙）、`content/round-catalog.ts:46`（轮次身份）、`content/orbs.ts:40`（d01史诗载体）。其余定位以最终工作区文件为准。

只运行相关测试，所有Vitest命令均带 `--maxWorkers=4`，不提高既有超时。纯领域测试采用忽略目录的 `artifacts/neutrals/vitest.config.ts`，沿用fast项目的threads、isolate=false与原worker setup，只省略不适用于这些无DOM测试的浏览器global setup；没有mock规则、fixture或恢复校验。没有连接/启动浏览器。

真实装备前缀由公开命令在模块共享fixture准备阶段构建，计时案例各自解析和完整恢复独立图，保留所有实际战斗检查点；不把装备取得过程塞进单个恢复断言案例的20秒时限。旧录制raw不被当作新龙的机制向量。

此前 `playtest-1022b-bench.test.ts` 已通过，其生成的bench-timing.json已从HEAD原文恢复，最终diff为空。未运行写索引的checkout；本轮不再重复无改动的计时测试。生成物、素材和.git均未写入提交。

最终按每个文件的最新有效结果去重，共 **21文件、453通过、145失败**。失败均在约定由Claude统一处理的身份／旧录制检查内：144项当前首先失败点为版本或digest；1项为真实首战录制轨迹变化，**不是纯身份漂移**。无收集阶段阻塞。

- `npm run typecheck`：通过，`artifacts/neutrals/review-typecheck-final.log`。
- `git diff --check`：通过；未提交、未执行写回命令、未提高超时。`src/server/`、生成identity常量、历史录制JSON/gzip与素材均无diff。界面仅修改本次明确点名的两处。
- `node scripts/update-content-identities.cjs --check`：预期失败；content旧值`f671ab88`→完整根新值`ec6dce7d`，loot旧值`36ebfac2`→新值`df6b9e07`，均为`fnv1a32-utf16:`前缀。未写回。

| 文件（均在tests/） | 通过 | 失败 | 最新本地证据（artifacts/neutrals/） |
| --- | ---: | ---: | --- |
| `assets3d-neutrals.test.ts` | 5 | 0 | `review-final-tests.log` / `.json` |
| `content-identity-constants.test.ts` | 4 | 2 | `review-final-tests.log` / `.json` |
| `epic-loot-reforger.test.ts` | 27 | 3 | `review-final-tests.log` / `.json` |
| `m5-content.test.ts` | 9 | 0 | `review-final-tests.log` / `.json` |
| `m5-route.test.ts` | 4 | 4 | `review-final-routes.log` / `.json` |
| `m8-b10-encounter-outcomes.test.ts` | 46 | 0 | `review-baseline.log` / `.json` |
| `m8-b6-round-catalog.test.ts` | 30 | 0 | `review-final-tests.log` / `.json` |
| `m8-b7-audit-combat-vectors.test.ts` | 7 | 0 | `review-final-tests.log` / `.json` |
| `m8-b7-audit-vectors.test.ts` | 7 | 0 | `review-scenarios.log` / `.json` |
| `m8-b7-catalog.test.ts` | 6 | 0 | `review-final-tests.log` / `.json` |
| `m8-b7-known-limitations.test.ts` | 2 | 0 | `review-final-tests.log` / `.json` |
| `m8-b7-match-wiring.test.ts` | 28 | 0 | `review-final-routes.log` / `.json` |
| `m8-b7-mechanisms.test.ts` | 24 | 0 | `review-final-tests.log` / `.json` |
| `m8-b8-live-reveal.test.ts` | 4 | 0 | `review-final-live-reveal.log` / `.json` |
| `m8-b8-loot-freeze.test.ts` | 66 | 0 | `review-final-tests.log` / `.json` |
| `m8-u5-preview.test.ts` | 60 | 0 | `review-baseline.log` / `.json` |
| `opening-encounters-batch-b.test.ts` | 71 | 0 | `review-final-tests.log` / `.json` |
| `opening-random-identity.test.ts` | 19 | 136 | `review-final-tests.log` / `.json` |
| `r3r4-oracle.test.ts` | 23 | 0 | `review-final-tests.log` / `.json` |
| `round-enemies.test.ts` | 7 | 0 | `review-final-tests.log` / `.json` |
| `server/stage-track.test.ts` | 4 | 0 | `review-final-tests.log` / `.json` |

所有剩余失败逐条列出在 [145项完整清单](evidence/neutrals-1424/remaining-failures.md)，下面按同类检查汇总。这里的“纯身份”仅指当前首先失败的检查，不承诺仅替换一个版本字段就能通过被挡住的后续golden／恢复断言；统一重录后必须完整复跑。

| 文件／确切失败集合 | 数量 | 当前原因与是否纯身份漂移 |
| --- | ---: | --- |
| `content-identity-constants.test.ts`：full content root、full loot replay root | 2 | 纯摘要漂移；完整根新值见上，生成常量仍为v25。 |
| `opening-random-identity.test.ts`：binds v25-online-rules… | 1 | 纯版本字面量漂移。保留历史字节的独立检查仍通过。 |
| 同文件：cannon checkpoint 0–66、sniper checkpoint 0–66（每个text/object恢复用例） | 134 | 当前纯版本栅栏：v25录制state被v26正确拒绝；未绕过校验，后续路径待新录制重验。 |
| 同文件：recomputes the first battle terminal and every event hash from public commands | 1 | **非纯身份漂移**：真实战斗tick、stateHash/eventHash与旧录制不同；由Claude重录新纪元。 |
| `m5-route.test.ts`：sniper-caitlyn、cannon、sniper、mage四条ordinary/golden案例 | 4 | 当前首先在golden rulesVersion失败；旧golden保留，后续轨迹/构筑断言仍待新录制完整验收。四条独立B8奖励链已全过。 |
| `epic-loot-reforger.test.ts`：a real 5-7 command path…；the real 6-7 terminal keeps full-bench… | 2 | 当前纯版本栅栏：v25 recorded-states无法恢复为v26；旧录制不改，后续锻造器/满席路径待新录制重验。 |
| 同文件：uses exact approved zh_cn names and rejects prior-epoch state identities without migration | 1 | 纯版本字面量漂移：仍要求v25-online-rules。 |

可复现命令：

```bash
node node_modules/vitest/vitest.mjs run --config artifacts/neutrals/vitest.config.ts --configLoader runner --maxWorkers=4 <上表对应测试路径>
npm run typecheck
node scripts/update-content-identities.cjs --check
git diff --check
```

独立oracle与现行机制已可执行并通过。Claude接下来应生成新digest、纪元与新录制证据，并复跑上述145项；旧先锋raw留作历史，新龙场景不沿用先锋身份。此工作区尚不能作为完整纪元验收通过的发布候选。
