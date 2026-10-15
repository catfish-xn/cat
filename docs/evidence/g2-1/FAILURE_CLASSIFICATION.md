# G2-1 全套失败归因（第八批窗口 3）

基线为指挥的 `multiplayer@a159fbb`，候选在 `codex/g2-1-content` 合入更新的调度文档后续作。下表覆盖 DISPATCH 第七批列出的全部 30 文件 / 71 例。没有增大测试预算、删除断言或 skip。同一文件可同时包含(a)/(b)两种原因。旧 P3/P4/P5 oracle、golden、原始 Herald 存档均保留，G2 使用独立命名的新录制。

## (a) 历史轨迹 / 版本快照需重新录制

| 文件（tests/ 下） | 原因、修复与证据 |
| --- | --- |
| m6-integration.test.ts | 四个公开整局路线通过共用 assert-golden 读取 G2 golden；商店从 19 扩至 33 导致真实命令、事件、经济轨迹改变，见 release-audit.json 四路线首个 command/event 差异、旧新 gzip 和 UTF-8 SHA256。G2 mage路线较长，完整结构断言改用Node deepStrictEqual以降低框架开销，保留每个tick与180秒预算。 |
| m5-route.test.ts | 同上；保留历史 full-match-golden.json，使用 full-match-golden.g2-1.json。 |
| m5-acceptance.test.ts | 使用含 33 字面英雄的独立 oracle.g2.cjs 与 G2 golden；不从被测运行时导出期望。 |
| match-lifecycle.test.ts | oracle.g2 的独立商店与全局 RNG 轨迹。旧 oracle 不改。 |
| m8-b8-oracle.test.ts | 独立 G2 oracle 对所有 command / event / RNG 状态逐项比较；另有(b)项：seed74奖励合并关系失效，改用公开seed48，候选27消耗到survivor5，保留真实候选计数和伪造serial拒绝；字节证据为public-fixture-migration.json的growth。 |
| m8-b7-match-wiring.test.ts | 旧 Herald 原始存档 content identity 不再可恢复，公开命令重录到 g2-1-herald-raw；fixture-migration.json 的 herald 项含全部 7 文件字节数、SHA256、首字节偏移与结构差异。 |
| b8-resumable-battle.test.ts | 扩池和新增羁绊改变战斗快照指纹，读取 g2-1-b8-fingerprints.json；fixture-migration.json 的 b8 项保留旧新完整指纹及首差异。原预算保留。 |
| c19-missed-pulse.test.ts | 重新编译相同 seed-9 最小输入；C19 events 166434 字节与 15 个 pulse 包 14192 字节逐字节相同。战斗结局仍 tick244 enemyWin；terminal 首差异 sentinel→automata，23276→23883 字节。完整 SHA256 见 fixture-migration.json。 |
| match-contract.test.ts | 明确钉住 s13-g2-1-v1 / s13-14.24b-g2-1-v1，版本与新 digest 一致，不伪装旧版本。 |
| t13-golden.test.ts | 历史 #90 审计继续校验原 driver 的字节 SHA，原 driver 归档为 generate-m5-route.p3p4p5.cjs；当前 G2 driver 由 release-audit.json 独立校验。 |

字节证据：`route-prefix-migration.json` 对四条路线首次变化的 round2 给出实际 command/event/terminal 的旧新字节数、SHA256和首结构差异（用两树各自驱动）；`release-audit.json` 的四条整局路线分别记录首次实际命令与事件差异、旧新录制 SHA256、文本/对象恢复字节相等；`fixture-migration.json` 为 C19 / Herald / B8；`public-fixture-migration.json` 对 transfer / growth / capacity / terminal / partial reveal 的旧新准备态、完整事件和终态分别给出字节数、SHA256、首字节偏移、首个结构差异，以及剔除版本身份后的首个玩法差异。后者逐文件验证历史 simulation 源码确为 a159fbb，避免用当前代码冒充旧行为。

## (b) 夹具引用失效

| 文件（tests/ 下） | 为什么失效、如何修复 |
| --- | --- |
| m8-b8-oracle.test.ts | seed74旧奖励合并失效，沿用有公开字节证据的seed48：候选27消耗到survivor5；保留真实候选计数及伪造serial拒绝。 |
| match-economy.test.ts | 旧 19 英雄商店槽字面值失效；以独立 G2 oracle 验证 seed42 新槽位（含 zeri、scar），保留逐金币 / XP / RNG 账本。 |
| m5-economy.test.ts | 各费用种类数从旧表变化；独立字面表改为 9/8/6/6/4 和 33 英雄，保留原经济断言。 |
| m5-content.test.ts | 旧 19 英雄 / 5 羁绊全集断言失效；改为 33 / 8，原 19 英雄隐藏字段约束继续保留，新英雄由源数据与技能专测覆盖。 |
| unit-stats.test.ts | 费用桶和全集表扩容；独立 g2-roster.ts 对照归档源数据，原数值契约不放宽。 |
| m8-ability-contracts.test.ts | 19 个历史技能计划不再是全部；保留全部 19 项原断言，另断言总数 33。 |
| match-session.test.ts | 快速 D/F/E 的独立商店字面目录仍为 19；补足 33，保留六轮混合事件、拒绝命令、RNG 与 XP 账本。 |
| server/shared-pool-room.test.ts | 库存总量 674 取代旧总量 404；扣除开场与已购后 626，继续检查所有费用桶、释放与守恒。 |
| m8-b5-grant-upgrade.test.ts | 九张固定艾瑞莉娅在新商店中会 insufficient-gold；独立 oracle 预估九张一费英雄路线，选择可支付路线，实际全部通过公开买卖 / 刷新执行；保持九次付费、递归升星、装备冲突、防重复及资源账本断言。 |
| m5-growth.test.ts | 旧路线九张崔丝塔娜不足金币；seed9 虽够钱但战斗无成长。改为 seed21：公开取得四组件后正常扣血完成两场空板败局，取得收入/XP与自然商店；3-7卖出全部旧阵容支付九张，三星在 tick56 获得125 bps成长；保留恢复、伪造拒绝与恰好一次结算。 |
| t12-combat-equip.test.ts | 旧 unit-2 在扩池路径不存在，导致 unknown-unit；从真实公开取得的另一玩家单位选择跨单位目标，继续拒绝错误装备所有权。逐tick三路对比使用Node原生deepStrictEqual，仍比较每个tick的完整result及全部状态/事件，以降低断言框架开销，未改预算。 |
| m8-b8-equipment-fixture.test.ts | 相同装备路线因实战收益变化，艾瑞莉娅装备后 HP 756→716；保留全部实际组件来源、合成、装备和恢复验证。 |
| m8-b8-token-lifecycle.test.ts | seed13 原槽位不再是两张拉克丝；seed11 的槽1/4通过真实购买，在1-3掉落拉克丝触发合并，保持被消耗 Combat token 生命周期的原断言。 |
| m8-b8-live-transfer.test.ts | 同 seed4 付费伊泽瑞尔的 ID/排序变化；survivor16、donor10，手套及异变绑定真实 donor；保留奖励29、物品9、roll/provenance和恢复审计。 |
| t12-offline-transfer.test.ts | 同上，改真实 survivor16/donor10，继续逐 tick 核对脱机装备转移。 |
| m8-b10-temporary-replay.test.ts | 同上，保留临时装备换持有人与回放的完整审计。 |
| m8-b8-live-growth.test.ts | 旧 seed74 的成长/揭晓先后已不成立；seed48 保留两张付费崔丝塔娜：19=125、5=375，tick77再成长125，奖励27合并后625；错误源、缺delta、超额伪造仍拒绝。 |
| m8-b8-live-capacity.test.ts | seed36 旧 lux 已不存在；卖实际 zyra，gold15，揭晓74、终态110；保留满备战区和溢出奖励断言。 |
| m8-b8-loot-view.test.ts | 同容量夹具；真实终态载体改为7号洛里斯(2击杀)/6号芮尔(1击杀)，保留 earned/retained/forfeited 显示来源。 |
| m8-b8-live-reveal.test.ts | mage42 的真实载体改为11号芮尔(死亡344)，非载体15号拉克丝(死亡164)；同时揭晓仍 tick52 seq449/450，保留中途与恢复审计。 |

上述公开路线的字节/轨迹差异还见 public-fixture-migration.json。修复的是对真实命令结果的引用，没有注入金币、英雄、RNG、掉落或成长。

## (c) 真 bug

| 文件（tests/ 下） | 根因与修复 |
| --- | --- |
| m7-hero-identity.test.ts | 新14英雄缺展示元数据会触发 missing identity，新增羁绊缺中文标签与图标索引；用户明确授权补齐 hero-identity.ts 和 s13-asset-manifest.ts。补齐简称/身份映射、源羁绊标签与81图标，保留原图标映射；检查所有33英雄、简称唯一、颜色距离/对比度和图标可追溯性。 |

未发现需修改 simulation 规则算法的 bug。斯维因只归档源记录和图标，不进入33英雄运行时；形态证据留 G2-2。金铲铲与转职体系不在范围。

## 本轮全套额外发现

`m8-b5-instances.test.ts` 的两件Blue Buff公开购入夹具在seed17扩池路线要跑到4-5（7580 tick），超出原5秒。改seed9在4-1购齐（6642 tick），仍需真实掉落/选择与合成；两个真实持有人都保留，唯一性、跨持有人成功及restore断言不变。T12/M6的完整结构比较改为Node原生deepStrictEqual，无删字段、tick或预算调整。
