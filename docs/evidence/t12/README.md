# T12 R2：装备运营与冻结战斗证据

基线 `origin/multiplayer@25dae94eb58108909a7b2cdc1d68ab0ee36d7561`，同一 [PR #71](https://github.com/catfish-xn/cat/pull/71) 继续，目标 `multiplayer`。依赖先行的 [PR #72](https://github.com/catfish-xn/cat/pull/72)：仅修两份 T11 装备 XP 夹具的 9 条断言及 T11 证据，不改生产代码。两 PR 均待交叉验货/用户最终合并。

## 独立规则与数值依据

用户已签 [S13_RULES_GAP R2 §2.2–2.4](../../S13_RULES_GAP.md#22-拟替换-151-的装备子矩阵) 是本任务唯一玩法规格：四阶段永久装备可操作，战中新装备下场生效，保留所有权/槽位/唯一/独占。本任务没有战斗数值、tick 顺序、掉落或 buy/sell/deploy 规则变化。该冻结取舍是项目政策，不伪称历史 TFT 实时装备行为的原样还原；M8B_POLICY §9 的数值批准不受影响。

测试独立写出九个原始配方向量：剑剑 deathblade、棒棒 deathcap、弓弓 red-buff、剑棒 gunblade、剑弓 giant-slayer、棒弓 rageblade、泪泪 blue-buff、甲甲 bramble-vest、拳套拳套 thiefs-gloves。这些期望不调用生产配方查询生成；另遍历完整普通配方表检查“移除两组件后的最终三槽”合法性。金币、经验、掉落不新增数值，四条公开路线仍由原手写独立经济 oracle 逐事务核对。

## 用户选 B 的恢复边界

初稿诊断发现原“联机完整保存恢复”与 [MULTIPLAYER_CONTRACT §12.5](../../MULTIPLAYER_CONTRACT.md#125-失败原因恢复与投影) 冲突，用户看过 PR 后明确选择 B，现已据此实施；不再存在待选择的 A/B 阻塞。

- 单人 PvE/PvP：准备、战斗、选择、结算装备与单位身上合成后 serializeMatch→restoreMatch→一致续算，保留来源验证。真实装备来自公开击杀/选择命令，保存用例不注入资产。
- 联机 PvP：restorePlayerBattleSnapshot/restoreBattleInput 恢复两方及镜像冻结输入，重算结果不变；latest live seat 未中断地继续运营、唯一结算、延迟升星搬迁最新装备。
- 联机 PvE：restorePlayerBattleSnapshot 恢复玩家冻结描述，配原目录遭遇重建并对照全部后继战斗状态/事件；既有 compileBattle/BattleInput 只用于 PvP。共享 PvE 在最新席位持续 start/step/结算/迁移并检查池守恒。
- §12.5 不变，不新增联机存档恢复合同。restoreMatch/serializeMatch 继续拒绝 multiplayer/sharedPool。冻结描述恢复不等于进程重启续局或完整来源认证。

## 实现与冻结边界

`canOperateEquipment` 独立于其它运营许可。previewEquip 与 equipItem 共用 validateEquip；组件目标校验成功后只分配一个新永久 ID，事件依次 itemCombined、itemEquipped、必要的 equipmentRolled/temporaryEquipmentChanged。窃贼新父实例本轮仅规划一次，不读 shop/loot/battle RNG。失败保留原 state，无 events，无 ID/RNG/序号/共享池变化。三槽满时可合法消费一个已穿组件；非法配方/成装占槽/唯一/独占仍明确拒绝，不免费拆卸或挤回库存。

装备命令不修改 combatInputBasis、当前 Combat、两方/镜像冻结快照、HP/护盾/属性/触发器/战斗随机流，不重抽 battleSeed、不重编译锁定 live seat。本场已阵亡但永久阵容保留的单位仍可装备；实测本场逐 tick 不变，下场攻击属性变化。共享 PvE/PvP 结算迁移最新棋盘与备战席装备，旧战斗成长/奖励按原冻结结果只提交一次，不能追溯新物品收益。

恢复改造保留以下验证，而非删除资源来源检查：

1. `resource-provenance` 的 combat resource suffix 新增合法 item-combined；仍逐条检查出生收据、配方、两输入消费、串行 ID、序号、轮次、成长归属和奖励顺序。供给/结算可合成，但单人供给购买/出售仍拒绝。
2. `validateB8Resources` 使用冻结 basis 的 provenancePrefixLength 和 equipmentRollPrefixLength，分别验证最新完整账本与旧前缀；旧组件即使被最新库存消费，仍从前缀重建冻结身份。不允许越界前缀或切开升星事务。
3. 战斗 running 只允许合法合成 suffix；非装备 strategy inputs 继续完全相等。按原 planner 在副本上重放配方；冻结已穿幸存物品必须保持原位，拒绝无偿拆卸、跨两个已穿单位取件。库存项可合法穿戴，最终 slots/ownership/unique/exclusive 由恢复资产校验核对。
4. finished 在单位掉落引发升星前，使用纯装备 planner 恢复已存活库存项的最终合法穿戴（不拆卸冻结物品、不生成未记录合成），然后按最新占槽执行原升星转移。seed26 的真实 Tristana 掉落升星用例复现并修正“战中新窃贼独占使旧供体装备返回库存却不能恢复”的问题；移走独占父件而仍让旧装备返回库存的伪造继续拒绝。随后按合成、原子掉落/成长提交、玩家选择、让位出售/容量重试的合法边界重放；不允许命令插入原子奖励事务，不免除 receipt 和资源顺序检查。gameOver 只可保留提交前发生的装备操作。
5. 新 roll 必须属于当前轮，不可替换冻结已穿父实例的 roll。当前/历史 round 的 levelAfter 是结算后新父实例可达到的等级上界；冻结输入内的父实例仍按战前等级校验。因此 B5 旧“结算后四级 roll 一律非法”断言改为拒绝超过真实 levelAfter 的五级。原被冻结的三级父实例伪造到四级仍有恢复约束。

恢复是已有结构一致性验证，不声称对历史所有装备位置作密码学认证；不新增持久化字段或伪造旧装备流水。`tests/t12-recovery-boundary.test.ts` 保留方案 B 边界拒绝守卫。

## 新旧身份

| 身份 | T11 基线 | T12 |
| --- | --- | --- |
| 装备操作细分版本 | 无 | equipment-ops-next-battle-v1 |
| MULTIPLAYER_OPERATION_RULES.version | multiplayer-combat-ops-v1 | multiplayer-combat-ops-v2 |
| EQUIPMENT_RULES_VERSION | m8-b5-instances-v2 | m8-b5-instances-v3 |
| CONTENT_DIGEST | fnv1a32-utf16:b4a5c2e2 | fnv1a32-utf16:44fe9c0e |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:7b14bfba | fnv1a32-utf16:7b14bfba |

三项装备规则身份进入 canonical digest。掉落规则没变，loot digest 不需人为改值。外层 schema6 / rules `m8-14.24b-v1` / content `s13-14.24b-m8-v1` / save2 / replay2 / commandProtocol2 / NET_PROTOCOL_VERSION=1 不变。旧 content digest 存档明确拒绝，不迁移、不补写旧账本；真实保留的 T11 Herald 存档也验证拒绝。

## 每个 golden 的变动原因

历史 B9、T1、T10、T11 golden 和 T11 updater 均保持原字节。新证据不是给旧档贴新 digest：从原公开命令驱动分别执行基线和候选，再比较完整状态和事件；五份 Herald 原始 JSON 都在导入恢复器之前公开获取并导出。

| 新文件 | 原因及验证 |
| --- | --- |
| tests/t12-content-baseline.json | 只变 contentDigest；首战 165 状态 SHA-256 `bf4da979eab5889734e1b61c03a33c268d08ca58f7413844aaacc1c17c1b504c`。仅替换 digest 后逐字节重现 T11 `5eef930e6e9672117cf15ba84fd61b9228769bf4c4e4fa45bdd2110a65dbb89a`。 |
| full-match-golden.t12.json / cannon | 命令、每 tick 完整结果、事件、经济账本、检查点在仅 digest 归一化后一致；终态 stateHash 因身份而变。 |
| 同文件 / sniper | 同上，无路线、数值或事件变化。 |
| 同文件 / mage | 同上，无路线、数值或事件变化。 |
| 同文件 / sniper-caitlyn | 同上，无路线、数值或事件变化。 |
| t12-herald-raw/ionic-spark.json | 重新执行原离子火花公开分支；整个原始状态除 contentDigest 外与 T11 相等。 |
| …/evenshroud.json | 原薄暮法袍分支；完整状态仅 digest 变化。 |
| …/ionic-spark--evenshroud.json | 原双装备分支；完整状态仅 digest 变化。 |
| …/quicksilver.json | 原水银分支；完整状态仅 digest 变化。 |
| …/edge-of-night.json | 原夜之锋刃分支；完整状态仅 digest 变化。 |
| …/trajectory.json | 公开命令不变，状态哈希随 digest 变化；每分支仍 14 战、5833 ticks、最终 HP64/G231、强化进度 pumpingRounds19/investmentHp1056。 |
| …/manifest.json | 原始文件/轨迹 SHA 与当前源文件 SHA 更新，绑定本次重新生成。 |

完整逐 tick 对照哈希在 [golden-audit.json](golden-audit.json)。`update-t12-golden.cjs` 在全部核对成功前不写 golden；全轨迹比较覆盖每个 before/result/command，不只终态哈希。`t12-golden.test.ts` 固定 updater/baseline/golden SHA，并验证每份 Herald 仅 digest 变化及旧档拒绝。

T1 仍为 164 tick、106 战斗事件；原 Combat hash `fnv1a32-utf16:acf238a8`、事件 hash `fnv1a32-utf16:966105d6`。原事件 trace SHA `2a19081d29a4a070f35a0a8b0ee4fab3324d9939963759f6fc01b5c1b286bfbe`，原 RNG trace SHA `0663a319578257493a68c0f86632d94040e7f27fe534ade7d40911774154ae6d` 不变；继续归一化历史身份可重现原 T1 状态 SHA `2750307d4dea28641853737163d3621a6b3cce3901cfd184a0dc8c4178689167`。Node 与 browser-target bundle 比较 UTF-8 字节，不宣称真浏览器试玩；最终报告摘要见 [t1-entry.json](t1-entry.json)。

## 验证与复现

```sh
# baseline-checkout 是 25dae94（或仅含 PR72 测试修正的工作树），不含 T12 生产实现
node scripts/update-t12-golden.cjs <baseline-checkout> <capture-directory>
node scripts/verify-m8-herald-fixtures.cjs --write
npm run typecheck
npm run test:server-entry
npm test -- tests/m8-b5- tests/t10- tests/t11- tests/t12- tests/inventory.test.ts tests/m8-b8-resource-provenance.test.ts tests/m8-b8-restore-fold-reuse.test.ts --maxWorkers=2
npm test -- tests/m5-command-phases.test.ts tests/m8-b8-restore-fold-reuse.test.ts --maxWorkers=2
npm test -- tests/server --maxWorkers=2
npm test -- --maxWorkers=2
```

- typecheck：通过。
- T1 Node/browser-target 入口：通过，165 状态/完整事件/RNG 字节一致，恢复 tick40 后续算一致，CLI snapshot/budget 检查通过。
- 必跑 B5/T10/T11/T12 加 inventory/provenance/restore-fold：最终 19 文件、319 条通过（另包含 m5 阶段守卫和新增单人装备迁移用例）。
- 新 T12 文件：48 条装备/冻结/恢复测试、1 条真实单人掉落升星/装备溢出恢复测试，5 条方案 B 边界测试，6 条身份/golden 审计测试。
- m5 阶段守卫和 restore-fold 独立重跑：2 文件、18 条通过。
- 五个 Herald：原始获取路线、prepare/start/前15tick 保存恢复与下一步一致性通过。
- `tests/server` 单跑：22 文件、150 条通过，227.28 秒。
- `npm test -- --maxWorkers=2` 全套实际跑完 1323.58 秒：191 文件中 177 通过、14 失败；2487 条中 2445 通过、16 失败、26 skipped。**全套未通过**。该轮启动于施工期间，含随后修正的 7 条断言；保留原统计，不用专项重跑结果伪造全套汇总。另有 M6 sniper-caitlyn 集成在并发下超过原 120 秒门槛，单独复核保持原门槛通过：`tests/m6-integration.test.ts -t sniper-caitlyn --maxWorkers=1`，2 条通过、7 条因名称筛选未运行，110.05 秒；不称整个 M6 套件通过。

全套中发现的既有失败已在无 T12 生产改动的 PR72 工作树复现：match-session/match-lifecycle 的 XP0→实际2；B8 live-growth/capacity/transfer/loot-view 的固定旧路线/商店序号；B8 live-reveal 的死亡时点；B10 temporary-replay 的旧商店序号；m8-content-equivalence 使用保留 B9 旧 digest 状态导致拒绝。后者是历史文件的既有测试使用方式，不通过重写历史文件掩盖。原全套运行还读到了施工中的旧 T12 收据测试、旧禁止装备阶段断言与前缀错误文案；这些已修正并定向重跑，最终结果以分项记录为准。最后一次生产恢复修正后已重跑 typecheck、19 文件 319 条专项、T1 和五个 Herald；未在最终树重新运行 22 分钟全套，故仍明确保留“全套未通过”。

## Claude 接线与目录边界

已同步 [联机合同 §15/§17](../../MULTIPLAYER_CONTRACT.md)、[MATCH_CONTRACT T12](../../MATCH_CONTRACT.md)、[S13_RULES_GAP 实施记录](../../S13_RULES_GAP.md) 和 [UI_REQUESTS](../../UI_REQUESTS.md)。room 的 battle/awaiting-settlement/settlement 已放行 equip/combine，无需改闸门；UI 读 previewEquip，更新 strategy-panel 两处锁定文案和拖放目标，提示战中新装备下场生效。未新增投影白名单字段、不规定视觉。

未修改 src/server、src/rendering、src/presentation、src/main.ts；未扩展 R3/R4。未完成真机/UI 验货或合并，交给 Claude 交叉验证、用户最终决定合并。
