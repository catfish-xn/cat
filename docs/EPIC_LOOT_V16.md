# v16：5-7/6-7史诗奖励、英雄复制器与统一重铸器

基线：codex/epic-loot-reforger @ 46454b77348c86b70a4fec57869f95c22ecf9682（v15、PR #260已收口）。本次只留工作区，不提交、不联网、不安装依赖、不改.git。用户已批准规则与拒绝旧存档，无迁移。规则实现和测试完成情况以下列实际记录为准；界面目录的明确禁改边界仍有效。

交付状态：领域、90份测试和v16录制已完成；整体验收因明确禁改的两个界面文件仍有6条tsc错误，尚未通过。

## 身份与digest

| 项 | v15前值 | v16后值 |
| --- | --- | --- |
| rulesVersion | s13-g2-3-v15 | s13-g2-3-v16 |
| contentVersion | s13-14.24b-g2-3-v15 | s13-14.24b-g2-3-v16 |
| LOOT_POLICY_VERSION | s13-orbs-project-v1 | s13-orbs-project-v16 |
| ORB_RULES.policy | s13-orbs-project-v2 | s13-orbs-project-v16 |
| ORB_RULES.freeze / LOOT_FREEZE_ALGORITHM.revision / LOOT_FREEZE_VERSION | s13-orb-freeze-v1 | s13-orb-freeze-v16 |
| CONSUMABLE_RULES.version | s13-consumables-project-v1 | s13-consumables-project-v16 |
| G23_POLICY.revision | g2-4b-multiplayer-orb-claim-v15 | g2-4b-epic-loot-reforger-v16 |
| CONTENT_DIGEST | fnv1a32-utf16:70dbb056 | fnv1a32-utf16:7181dce2 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:61568ec0 | fnv1a32-utf16:cee1d7d7 |
| RULES_GAP_MANIFEST digest | fnv1a32-utf16:97c14bf3 | fnv1a32-utf16:81596be6 |

CONSUMABLE_RULES.reforge由s13-reforge-v1改为s13-reforge-all-v16。schema7/save3/replay3/command4、netProtocol目标4保持。digest由实际v15 Git归档与当前源码分别加载计算，命令node scripts/compare-v16-digests.cjs，输出artifacts/v16-recording/digest-comparison.json；未手写指纹。旧存档仅拒绝，没有兼容别名、版本归一化或迁移分支。

## 冻结表与名字

5-7 d01、6-7 h01只在真实击杀后掉史诗奖励；移除旧ORB_SLOTS晚期项。变体899/100/1、铜箱49/46/3/1/1、银箱49/47/3/1完整数值见[M8B_LOOT §11.3/11.4](M8B_LOOT.md#113-开局与逐轮载体表v16用户已批准)。零权重银箱拆卸器行不进入执行表。

每组一颗：普通变体成装锻造器/铜/银3颗；神器变体成装/神器锻造器/铜/银4颗；冠冕变体冠冕/银/银3颗。铜gray、银blue，锻造器/冠冕gold。早期1–4阶段组合颜色权重保持50/50与90/9/1，除批准的追加复制器和重铸器来源外不改基础奖励。

| 官方apiName | 内部id | 14.24 zh_cn显示名 |
| --- | --- | --- |
| TFT_Consumable_NeekosHelp | 同apiName | 英雄复制器 |
| TFT_Consumable_ChampionDuplicator_III | 同apiName | 次级英雄复制器 |
| TFT_Consumable_ItemReroller | reforger | 装备重铸器 |
| TFT_Consumable_ItemRemover | magnetic-remover | 装备拆卸器 |
| TFT_ArmoryKeyCompleted | 同apiName，forge payload | 成装锻造器 |
| TFT_ArmoryKeyOrnn | 同apiName，forge payload | 神器装备锻造器 |
| TFT_Item_ForceOfNature | 同apiName | 金铲铲冠冕 |

名称依据本任务用户提供的14.24 zh_cn冻结名单及仓库既有本地中文manifest，不联网查询。领域名与合同已更新；禁止改的界面硬编码映射另列V16-UI-01。

## RNG合同

所有领域随机仍lcg32-v1，无真实时钟/Math.random。

1. layout流：(roomSeed XOR 0x4f524253)>>>0；逐轮、sourceUnitId代码点→slotOrdinal数值。1-4组合抽1词、2-7/3-7/4-7装备颜色各1词，合计4个接受词；史诗占位不抽layout词。
2. 每席loot流：(seatMatchSeed XOR 0xdeadbeef)>>>0。早期每珠先原基础内容，再追加复制器的独立100桶抽签；灰收益先类别，再可选英雄，再80/20工具，再复制器。棱彩只抽普通成装，不抽复制器追加词。none照常消耗追加抽签词。金珠3%普通或3%普通+次级、蓝珠2%次级或1%普通为同一个互斥桶。
3. 史诗每轮固定变体1000→铜箱100（冠冕省略）→银箱100（冠冕独立两次）→铜箱英雄→银箱1英雄→银箱2英雄。双英雄各抽一次，可重复，固定1星payload；正常获取时仍沿用既有升星，不预制2星。英雄池按已上线商店id升序：2/3费各13、4费12；不重抽缺货英雄。
4. 所有上述整数桶使用uint32拒绝采样，拒绝词也计draw；1000 limit=4294967000、100 limit=4294967200、13 limit=4294967287、12 limit=4294967292。
5. 四选一沿用G24：seedText为seed+冒号+JSON['epic-forge',lootReceiptId]；从0x67323372逐字符 seed=imul(seed,31)+charCode，再逐词LCG、floor(word*remaining.length/2^32)无放回抽4项。独立派生，不消费loot/equipment/reforge流；超时与单机终局首候选沿用现有策略。
6. 重铸流：(seed XOR 0x52454647)>>>0；成功命令按永久槽位升序，每件从本类排除原物后的池拒绝采样。组件7、普通成装35候选，特殊装备本类池；无其他候选不抽词。失败、预览、领取已冻结法球、复制器和拆卸器不消耗reforge RNG。

## 约定值清单（PR须单列）

- 第1–4阶段复制器追加率为用户约定：灰1%次级；蓝1–3阶段2%次级/1%普通互斥，4阶段1%普通；金2–3阶段3%普通/3%普通+次级互斥，4阶段5%普通；棱彩0。只追加工具。
- 2-7至4-7灰珠工具none80/reforger20；棱彩2个reforger；全部旧ItemReroller来源统一reforger。
- 重铸组件8/普通成装36；光明36/神器29/辅助17按各自已上线池；当前纹章池空。无池/只剩自身原ID原物退库存、0随机；产物进库存不自动穿戴。
- 一组一珠及锻造器/冠冕显示gold，铜gray、银blue；史诗变体使用每席内容流，冻结次序如上。
- 锻造器四选一、相同seed稳定、收据唯一；单机终局首候选政策沿用G24现有约定，不开新终局窗口。
- 满席复制器严格拒绝，包含可能合星的情况；单机直接授予，联机成功使用后生成已有mechanic英雄法球，领取时共享池扣卡/缺货折费用金币/满席按原getUnitSellPrice折金。未修改售价。

## 实现与恢复边界

新epic-forges.ts复用mechanic choice与装备授予；原loot领取收据绑定唯一epic-forge收据，restore验证来源/候选/时点/终局fallback。冠冕只通过已领取的真实item收据增加人口，CombatInput和征服者发奖证据按资源前缀恢复，不能把战后/后领冠冕倒灌开战人口。

统一重铸器一次拆下全部永久装备；outputs[]逐项记录，output兼容首项，copiedUnit仅复制用途。来源fold验证工具授予、使用次序、RNG、装备ID、复制目标出生与共享池领取。临时子件不参与永久重铸；父窃贼移走后沿原生命周期注销live子件，冻结战斗不变。所有失败原状态/事件/资源/随机/ID不变。

新奖励路线覆盖了原neutral restore只按静态health重建开场的缺口：光明装备开场光环先改变生命值，再冻结野怪开场计划。现在从已认证CombatInput重演，并逐字段比较原openingState；未改战斗计算。新增正例恢复及篡改开场HP拒绝用例。

独立oracle在tests/fixtures/epic-loot-oracle.cjs：字面权重/英雄池/装备池，BigInt LCG和独立拒绝采样，零生产实现导入。4096种子分8用例核对全部payload、身份、两流游标；精确遍历权重桶与追加概率；重铸也用独立组件/成装池及随机流核对。新测试不设单条时限。

M5 oracle重新独立实现v16法球表；路线只用公共命令。mage用已赚取拆卸器更新核心装备，凯特琳路线从5-1尝试升9追真实5费商店；继续要求胜利到6-7、凯特琳至少2场/2次技能、完整成装战斗次数，原超时不变。旧公共装备/法球用例因新RNG换种子或组件供给，仍逐项检查原数值、来源链和损坏拒绝。live-reveal的44/382/383、381/152、4/0收据、0单位ID和2/0装备ID保持原精确断言。

## 录制结果

最终流水线全部成功，命令和退出码由[verification.json](evidence/v16/verification.json)自动汇总：

| 阶段 | 命令 | 退出码 |
| --- | --- | ---: |
| release | node scripts/record-v16-release.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 | 0 |
| herald-write | node tests/fixtures/record-v16-herald.cjs --write | 0 |
| inputs | node scripts/record-v16-inputs.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 | 0 |
| live-reveal | node scripts/record-v16-live-reveal.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 | 0 |
| inputs-check | node scripts/record-v16-inputs.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 --check | 0 |
| herald-verify | node scripts/verify-m8-herald-fixtures.cjs | 0 |
| history | node scripts/v16-fixture-audit.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 | 0 |
| live-reveal-check | node scripts/record-v16-live-reveal.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682 --check | 0 |
| digests | node scripts/compare-v16-digests.cjs | 0 |

release四路线各33场到6-7胜利；cannon/sniper各67个原始检查点，文本/对象恢复字节相同。Herald5个用例各14场公开战斗，原始JSON在导入生产restore前导出，再验证开战和15个完整后继tick，共7个文件。inputs共9组新证据并通过--check；live-reveal四分支及--check保持44/382/383、381/152、4/0收据等精确要求。首次战斗仍164tick/106事件，战斗/事件hash分别fnv1a32-utf16:1db5b9e9与cf452d32。

CURRENT入口与当前golden/raw读取器均指向v16。历史G2-3/G2-4b共86个文件、v15共23个文件逐字节相同，历史身份审计expect行字节相同。crown-history是运行中的恢复套件，其旧工具场景已适配，56项通过；没有把整个活动套件误作冻结历史目录。最终录制完成后再次核对所有录制sourceDigests与Herald sources，均匹配当前工作区。沙箱内完整录制成功，不需要RUN_OUTSIDE或手写指纹。

## 逐文件测试结果

90份实际存在的测试文件逐个完整执行，最终1514项通过、0失败、0待执行。每份均使用--configLoader runner，保留原时限；新epic套件29项无单条时限。表中为各文件最后一次完整运行结果，机器结果见[verification.json](evidence/v16/verification.json)。

| 文件 | 通过 | 失败 | 待执行 | 秒 |
| --- | ---: | ---: | ---: | ---: |
| tests/c19-missed-pulse.test.ts | 10 | 0 | 0 | 0.454 |
| tests/d11-wiring-bank.test.ts | 2 | 0 | 0 | 0.802 |
| tests/epic-loot-reforger.test.ts | 29 | 0 | 0 | 8.329 |
| tests/g2-3-content.test.ts | 10 | 0 | 0 | 0.463 |
| tests/g2-3-hook-failures.test.ts | 8 | 0 | 0 | 0.054 |
| tests/g2-3-identity.test.ts | 14 | 0 | 0 | 9.433 |
| tests/g2-3-integration.test.ts | 18 | 0 | 0 | 2.15 |
| tests/g2-3-lesser-shimmer-duplicator.test.ts | 37 | 0 | 0 | 16.267 |
| tests/g2-3-netcode-hooks.test.ts | 14 | 0 | 0 | 9.674 |
| tests/g2-4a-conqueror-items.test.ts | 6 | 0 | 0 | 0.063 |
| tests/g2-4a-crown-gold.test.ts | 9 | 0 | 0 | 7.452 |
| tests/g2-4a-crown-history.test.ts | 56 | 0 | 0 | 35.979 |
| tests/g2-4a-crown.test.ts | 6 | 0 | 0 | 0.783 |
| tests/g2-4b-artifact-forge.test.ts | 7 | 0 | 0 | 2.908 |
| tests/g2-4b-clone-forges.test.ts | 4 | 0 | 0 | 0.008 |
| tests/g2-4b-reward-order.test.ts | 1 | 0 | 0 | 0.039 |
| tests/g2-4b-support-forge.test.ts | 8 | 0 | 0 | 4.167 |
| tests/loot-orb-claim.test.ts | 20 | 0 | 0 | 1.917 |
| tests/m5-replay-cannon.test.ts | 1 | 0 | 0 | 157.287 |
| tests/m5-replay-mage.test.ts | 1 | 0 | 0 | 265.723 |
| tests/m5-replay-sniper-caitlyn.test.ts | 1 | 0 | 0 | 352.858 |
| tests/m5-replay.test.ts | 1 | 0 | 0 | 237.434 |
| tests/m5-route.test.ts | 8 | 0 | 0 | 53.399 |
| tests/m6-persistence.test.ts | 44 | 0 | 0 | 2.065 |
| tests/m7-m6-save-compat.test.ts | 8 | 0 | 0 | 1.261 |
| tests/m8-b10-encounter-outcomes.test.ts | 46 | 0 | 0 | 6.173 |
| tests/m8-b10-item-save-replay.test.ts | 45 | 0 | 0 | 24.022 |
| tests/m8-b10-temporary-replay.test.ts | 3 | 0 | 0 | 1.078 |
| tests/m8-b4-audit-regressions.test.ts | 14 | 0 | 0 | 17.751 |
| tests/m8-b4-belt.test.ts | 2 | 0 | 0 | 0.041 |
| tests/m8-b4-bow.test.ts | 7 | 0 | 0 | 0.093 |
| tests/m8-b4-cloak.test.ts | 3 | 0 | 0 | 0.166 |
| tests/m8-b4-gloves.test.ts | 1 | 0 | 0 | 0.022 |
| tests/m8-b4-integration.test.ts | 16 | 0 | 0 | 4.751 |
| tests/m8-b4-r3b-lifecycle.test.ts | 4 | 0 | 0 | 3.88 |
| tests/m8-b4-rod.test.ts | 6 | 0 | 0 | 0.169 |
| tests/m8-b4-sword.test.ts | 8 | 0 | 0 | 0.06 |
| tests/m8-b4-tear.test.ts | 9 | 0 | 0 | 0.165 |
| tests/m8-b4-trigger-ledger.test.ts | 2 | 0 | 0 | 0.006 |
| tests/m8-b4-vest.test.ts | 4 | 0 | 0 | 0.071 |
| tests/m8-b5-equipment-history.test.ts | 9 | 0 | 0 | 9.155 |
| tests/m8-b5-grant-upgrade.test.ts | 14 | 0 | 0 | 13.721 |
| tests/m8-b5-instances.test.ts | 18 | 0 | 0 | 0.692 |
| tests/m8-b5-queries.test.ts | 5 | 0 | 0 | 0.306 |
| tests/m8-b5-temporary.test.ts | 30 | 0 | 0 | 11.909 |
| tests/m8-b6-match-wiring.test.ts | 18 | 0 | 0 | 6.218 |
| tests/m8-b6-opening-economy.test.ts | 27 | 0 | 0 | 0.021 |
| tests/m8-b6-round-catalog.test.ts | 30 | 0 | 0 | 0.014 |
| tests/m8-b7-cleanup.test.ts | 5 | 0 | 0 | 0.288 |
| tests/m8-b7-match-wiring.test.ts | 30 | 0 | 0 | 16.755 |
| tests/m8-b8-acquisition.test.ts | 12 | 0 | 0 | 0.037 |
| tests/m8-b8-combat-input.test.ts | 38 | 0 | 0 | 0.448 |
| tests/m8-b8-command-oracle.test.ts | 6 | 0 | 0 | 0.061 |
| tests/m8-b8-copy-semantics.test.ts | 6 | 0 | 0 | 0.082 |
| tests/m8-b8-equipment-fixture.test.ts | 4 | 0 | 0 | 7.792 |
| tests/m8-b8-live-capacity.test.ts | 6 | 0 | 0 | 3.246 |
| tests/m8-b8-live-cross-round.test.ts | 6 | 0 | 0 | 0.996 |
| tests/m8-b8-live-economy.test.ts | 3 | 0 | 0 | 2.17 |
| tests/m8-b8-live-growth.test.ts | 26 | 0 | 0 | 2.626 |
| tests/m8-b8-live-reveal.test.ts | 3 | 0 | 0 | 2.991 |
| tests/m8-b8-live-transfer.test.ts | 19 | 0 | 0 | 3.31 |
| tests/m8-b8-loot-freeze.test.ts | 67 | 0 | 0 | 0.217 |
| tests/m8-b8-loot-runtime.test.ts | 16 | 0 | 0 | 0.155 |
| tests/m8-b8-loot-view.test.ts | 7 | 0 | 0 | 1.804 |
| tests/m8-b8-oracle.test.ts | 24 | 0 | 0 | 24.783 |
| tests/m8-b8-resource-provenance.test.ts | 64 | 0 | 0 | 0.079 |
| tests/m8-b8-restore-fold-reuse.test.ts | 5 | 0 | 0 | 0.269 |
| tests/m8-b8-restore.test.ts | 7 | 0 | 0 | 2.387 |
| tests/m8-b8-token-lifecycle.test.ts | 3 | 0 | 0 | 1.091 |
| tests/m8-content-equivalence.test.ts | 138 | 0 | 0 | 19.798 |
| tests/m8-contracts.test.ts | 6 | 0 | 0 | 0.008 |
| tests/match-contract.test.ts | 12 | 0 | 0 | 0.134 |
| tests/opening-random-identity.test.ts | 142 | 0 | 0 | 26.628 |
| tests/r3r4-consumable-targets.test.ts | 5 | 0 | 0 | 1.914 |
| tests/r3r4-consumables.test.ts | 15 | 0 | 0 | 18.527 |
| tests/r3r4-legacy.test.ts | 2 | 0 | 0 | 0.031 |
| tests/r3r4-loot-weights.test.ts | 2 | 0 | 0 | 0.009 |
| tests/r3r4-loot.test.ts | 6 | 0 | 0 | 0.674 |
| tests/r3r4-oracle.test.ts | 7 | 0 | 0 | 1.302 |
| tests/r3r4-shared.test.ts | 8 | 0 | 0 | 2.771 |
| tests/restore-audit/cd-replay-facts.test.ts | 34 | 0 | 0 | 35.502 |
| tests/server/c18b-consumable-preview.test.ts | 6 | 0 | 0 | 0.028 |
| tests/t12-combat-equip.test.ts | 48 | 0 | 0 | 11.711 |
| tests/t3-round-settlement.test.ts | 10 | 0 | 0 | 3.077 |
| tests/t3-timeout-loot.test.ts | 6 | 0 | 0 | 0.187 |
| tests/t5r-b7-integration.test.ts | 1 | 0 | 0 | 30.288 |
| tests/t5r-loot-view.test.ts | 24 | 0 | 0 | 0.517 |
| tests/t5r-private-seat-view.test.ts | 15 | 0 | 0 | 0.569 |
| tests/task-mechanism-restore.test.ts | 20 | 0 | 0 | 16.89 |
| tests/ur-i3-combat-statuses.test.ts | 6 | 0 | 0 | 0.157 |

实际执行npx.cmd tsc --noEmit退出2：只有禁改的src/presentation/loot-view.ts:48、orb-loot.ts:43/48的6条旧枚举映射错误。整体验收尚未达到0失败。可审阅补丁在artifacts/v16-recording/UI_ADAPTER.patch；不写源码的TypeScript compiler-host覆盖检查为0诊断，仅证明拟议补丁可编译，不能冒充实际tsc通过。

较宽验证中修复了旧公共材料/收入路线：真实seed16手套和seed3眼泪配合供应选择，不注入装备；四剑预热和使用采用相同种子，未延长5秒用例或10秒hook；T12通过真实购买XP和部署军队活到4-4，保留原供应阶段断言。Morgana/Sion用例保持原2-1种子与真实已获组件，使用新的公开位置向量244/355tick验证0/15助攻属性、不是20个人击杀奖励；89/104的诅咒/护盾检查保持。黑玫瑰英雄出生ID按实际新来源顺序固定为unit-15，循环增加合法战斗断言避免终局空转。

凯特琳逐tick重放耗时352.858秒，接近既有360秒限制，机器负载可能造成计时抖动；未加时、跳过或减少任何tick/拒绝插入检查。cannon已在最终恢复实现下重新完整运行。

## 界面待交接与限制

任务禁止修改src/presentation/，因此未动loot-view.ts/orb-loot.ts。必须更新旧工具名/图标映射、bench-full文案、forge payload分支与复制成功预览。已写UI_REQUESTS V16-UI-01。没有修改server/rendering/main/index/style/assets，也没有提交素材。领域单机/共享池测试通过不表示服务器或浏览器已经上线验收。

## 建议提交信息

feat(simulation): add v16 epic PvE rewards and unify reforger

## PR描述草稿

5-7/6-7击杀载体现在按899/100/1史诗变体发放锻造器、铜银箱或冠冕；单机自动授予、联机复用法球领取与共享卡池。新增全费用英雄复制器与早期法球追加复制器，统一装备重铸器为己方单位全部永久装备同类重铸，保留失败原子性和唯一来源收据。

规则/content升v16，旧存档明确拒绝且不迁移。新增独立oracle和新epoch，v15/G2-4b/G2-3历史字节与审计断言保持。M8B_LOOT §11.3/11.4预算已重算；约定值必须保留本报告同名单独一节。验证：90份测试/1514项通过，release→Herald→inputs→live-reveal及各check/历史审计全部通过。实际tsc仍因明确禁改的2个界面文件产生6条错误，V16-UI-01和审阅补丁已就绪；关闭编译问题前不建议合并。

### 约定值（PR正文单列）

- 第1–4阶段复制器追加率为用户约定：灰1%次级；蓝1–3阶段2%次级/1%普通互斥，4阶段1%普通；金2–3阶段3%普通/3%普通+次级互斥，4阶段5%普通；棱彩0。只追加工具。
- 2-7至4-7灰珠工具none80/reforger20；棱彩2个reforger；全部旧ItemReroller来源统一reforger。
- 重铸组件8/普通成装36；光明36/神器29/辅助17按各自已上线池；当前纹章池空。无池/只剩自身原ID原物退库存、0随机；产物进库存不自动穿戴。
- 一组一珠及锻造器/冠冕显示gold，铜gray、银blue；史诗变体使用每席内容流，冻结次序如上。
- 锻造器四选一、相同seed稳定、收据唯一；单机终局首候选政策沿用G24现有约定，不开新终局窗口。
- 满席复制器严格拒绝，包含可能合星的情况；单机直接授予，联机成功使用后生成已有mechanic英雄法球，领取时共享池扣卡/缺货折费用金币/满席按原getUnitSellPrice折金。未修改售价。
