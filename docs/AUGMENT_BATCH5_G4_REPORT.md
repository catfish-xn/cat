【完成】B5-72、B5-73均完成；分支 codex/v25-g4，基线4495602；只新增这两张运行时强化，未提交Git、未重录epoch。

| B5-72 虚空召唤者 | 已实现数值与约定 | 测试 | 接线与调用点（路径均相对src/simulation；含服务器） |
| --- | --- | --- | --- |
| voidcaller／TFT13_Augment_Visionary | 取得芮尔＋莫甘娜；全队有效先知实际施法扣蓝每275召1只，余数结转，每场累计至多5只，死亡不返名额；HP400/450/500/550/600（2–6+），AD60、AS0.8、双抗30、近战无技能；施法者附近最近空格，无格不召；三节点可报价，3-2/4-2按先知成员过滤。匿名AD／模板属性属社区推测，聚合、上限、6+封顶等按2026-10-27用户批准P约定。 | 14项通过：源表、独立报价/赠物/数值oracle、真实选择与共享池奖励领取、实际施法、双边隔离、满格/累计上限、可信输入重演、联机object/JSON/canonical往返和删改篡改拒绝。 | 新content/augment-pool-batch5-g4.ts、augment-pool-batch5-g4.ts、augment-pool-batch5-g4-unit.ts；augment-effects.compileAugmentEffect、augment-pool-grants.batch1GiftPlan、combat-s13.advanceS13Tick、combat-types、units、content/abilities、m8/mana、g2-3-summons.countsG23SurvivorDamage、g2-4b-gold-restore.validateDynamicCombat、augment-history-owners、shared-pool.restoreSharedOrbSnapshot；公用augments/policy/offer/rules-manifest/effects/validate-content注册。src/server：0改动，复用既有房间历史与权威结算。 |

| B5-73 虚空虫群 | 已实现数值与约定 | 测试 | 接线与调用点（路径均相对src/simulation；含服务器） |
| --- | --- | --- | --- |
| void-swarm／TFT_Augment_Voidborne | 初始1传送门，从选取当轮起每11场已结算PvP再给1个，PvE/选秀不计；大型HP1000/1500/2000/2500/3000、AD80/80/115/150/180（2–6+），AS0.8、双抗30、近战无技能；开战持有者前方最近空格生成、2格嘲讽目标锁；大小虚灵均额外40%AS／40%全能吸血，小虚灵不套大型数表。11/40%/40%属14.24客户端已证实；未锁季Wiki数表、社区回合数/先知联动按2026-10-27用户批准P约定。14.24阶段禁用保留：仅2-1。 | 37项通过：各阶段/加时数表、前方出生/满格/多传送门/嘲讽释放、大小联动与实际吸血、独立0/10/11/21/22次PvP奖励oracle、真实房间选取/装备/第11战发奖/次轮不重发、在线PvE战斗存档、object/JSON/canonical往返、伪造数值/赠物/历史/authority拒绝。 | 新augment-pool-batch5-g4-swarm.ts及同组content/unit模块；augment-pool-grants.batch1GiftPlan、round-settlement.applyRoundSettlement（无g23Facts备用路径）、strategy-snapshot.buildStrategySnapshotSteps、g2-4b-voidspawn.projectVoidspawns、combat-effects.applyCombatStart、s13-augments-p2-combat.p2Target、m8/s13-mechanisms.vampRates、combat-types、augment-history-owners、shared-pool.restoreSharedOrbSnapshot、g2-4b-gold-restore.validateDynamicCombat、content/augment-stage-bans；同上公用注册。src/server：0改动，复用既有Room采样/结算/authority。 |

【完成】51项功能＋119项相关回归＋12项身份/生产压缩语义检查，共182项定向测试通过；npm run typecheck与npm run build -- --configLoader runner通过。独立M5 oracle手写身份/赠物/阈值/存活数，未从生产收据反推期待；候选池扩容的固定种子在0..100重定位。只读node_modules导致默认缓存不可写，定向Vitest使用/tmp配置、--configLoader runner和--maxWorkers=3，无超时放宽或断言删除。P-B5-72/P-B5-73均记2026-10-27及已证实/社区推测/约定等级，AUGMENT_BATCH5_GAPS分类与MATCH/COMBAT合同已更新；node scripts/update-content-identities.cjs --write及--check通过，production-size期望同步；content=fnv1a32-utf16:f05e7646，loot=fnv1a32-utf16:36fccc50。
【未完成】无本任务缺项；按要求未跑全套测试、未提交、未重录epoch。
【需要我决定】无；已按批准约定实现，两卡均非全节点禁用，未覆盖任何既有阶段禁用。
【风险】Wiki未锁季和社区推测仍是项目约定；独立阶段审计仍报告原有5项差异（Academy/Cabal/Experiment/Formswapper/BloodBrothers），本次保持其既有禁用规则。普通无虚空虫群的传送门保留原规则。
【下一步】由Claude交叉验货后交集成任务合并；所有修改均留在工作区。
