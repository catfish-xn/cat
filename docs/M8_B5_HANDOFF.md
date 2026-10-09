# M8 B5 分阶段交接

当前分支：`feat/m8-b5`；精确基线：`97f38a0e787a4edcb35df4a59823bb1d106def67`。
依赖图按 `58c901188b7da9c1534ec3fcb949d2554cb1fbdd:docs/M8_DEPENDENCY_MAP.md` 第3/5/6节读取；不将远端更晚基线混入本分支。
用户授权尽可能多完成；每阶段自检、`[wip]` 提交、推送后再继续。不开正式PR、不送审、不合并、不rebase/force push；必要CI只开指向 `feat/m8-b0-baseline` 的草稿PR。

## 阶段 1：唯一 / 三槽 / 独占及失败原子性

状态：领域实现完成，已提交并推送 `633f28a`；编译接线与全量验证状态见下文。

文件与职责：

- `src/simulation/equipment-policy.ts`：读取目录 `unique/apiName/slotCost` 的通用放置校验，返回冻结失败码、冲突永久ID与占槽信息；不按装备名称/ID分支。
- `inventory.ts`：穿戴复用放置校验；三槽本体归一到0槽；同实例合成拒绝 `same-item`，身份优先于输入/冲突校验。
- `match-types.ts`：并入冻结 `EquipmentFailure`；敌方单位在装备命令中属于非合法自有目标，返回 `unknown-unit`。
- `upgrades.ts`：现有转移立即共用放置校验，冲突退回库存。提前接这一小部分，避免第1阶段正常购买产生不可恢复的非法装备布局；完整链式升星/TG验收仍在第4阶段。
- `serialization.ts`：保留原结构/ID/槽位检查，再严格验证唯一性、独占和三槽本体0槽；不修复非法档、不放宽校验。
- `content/index.ts`：规则修订进入内容digest。
- `tests/m8-b5-instances.test.ts`：新增独立唯一装备例子、普通三件/第四件拒绝、三槽双向冲突、规范槽位、失败状态引用/全状态/序号/RNG原子性、合成ID消耗、恢复拒绝、升星旁路保护。
- `tests/inventory.test.ts`：更新冻结失败码预期；`tests/upgrades.test.ts`：旧虚构组件 `blade` 改为真实目录 `sword`，资源转移预期不变。
- `scripts/update-m8-b5-golden.cjs` 与 `tests/fixtures/m5/full-match-golden{,.pre-m8-b5}.json`：保留原golden并严格核对四条命令序列与逐轮事件哈希不变，仅更新版本/digest及状态哈希。

设计依据：冻结 `M8_RULES §5/§8`、`M8_UI_CONTRACT §2`。三槽任意合法目标槽输入均归一到本体0槽、预留1/2槽。普通槽不得替换已有物品。唯一判定用apiName；冲突ID按代码点排序。拒绝优先级 phase → 身份 → 位置/输入 → unique → exclusive → occupied。

已知问题/下一步：TG当前仍只有本体，第3阶段接入G12生成/同轮保持/跨轮刷新/清理和严格恢复。预览与装备视图第2阶段交付。IF-GRANT和完整升星返还第4阶段交付。新增失败码需要 `BoardScene.ts` 的四项文案接线，已按AGENTS边界向用户请求最小修改授权。

## 版本 / 存档 / digest 独立记录

阶段1不新增Match字段，不更改schema5/save1/replay1或正式M8版本，不更改装备目录版本 `s13-14.24b-m8-b4-v3`。
新增规则修订 `EQUIPMENT_RULES_VERSION = m8-b5-instances-v1`，纳入CONTENT_DIGEST，旧开发档按原严格digest检查被拒绝；不重标旧档、不迁移。正式M8格式切换仍属B9。

## 边界自检

冻结的 `m8/contracts.ts`、`m8/ui-contracts.ts`、`m8/equipment.ts`、`docs/M8_RULES.md`、`docs/M8_UI_CONTRACT.md` 以及G12/其测试保持原样。未改门禁、阈值、CI配置；只做桌面目标。

### 阶段1自检记录

- 定向 `npm test -- tests/m8-b5-instances.test.ts tests/inventory.test.ts tests/upgrades.test.ts tests/m5-serialization.test.ts`：4文件/112测试通过。
- `node scripts/update-m8-b5-golden.cjs`：四路线命令序列、逐轮事件哈希逐项不变；独立资源账本通过。digest：`2b6a9a4b → db25532e`。
- `npm test -- tests/m5-route.test.ts`：4/4通过。
- 全量 `npm test` 在运行；启动早于golden更新，已知路线/集成用例捕获旧golden，需在完成后重跑受影响项，不能报全绿。
- `npm run typecheck`：仅报告 `BoardScene.ts:360` 缺四项EquipmentFailure文案；等待用户界面修改授权。本次 `[wip]` 保留此已知编译阻塞，未绕过类型或减少失败码。
- `git diff --check`通过；冻结合同/G12/其测试/CI配置diff为空。

阶段1领域实现已完成并准备分阶段推送；上述界面接线和全量验证结果在下一次推送更新。下一阶段实现公共预览/只读查询，不以阶段1编译阻塞作为改界面授权。

## 阶段 2：共享校验与只读装备查询

状态：实现及定向自检完成；本节随阶段2 `[wip]` 提交推送。

- `inventory.ts`：提取 `validateCombine` / `validateEquip`，纯校验只返回冻结预览结构；规划器在成功后才分配ID、构造事件/新库存。
- 新增 `item-selectors.ts`：公开 `previewCombine` / `previewEquip` / `readUnitEquipment`，并重导出既有 `readItemCatalog`。预览包含phase校验；`match.ts`直接调用这两个预览校验入口，提交时始终重新校验当前state。内部规划器也校验，避免内部调用绕过规则；不引入第二套判断。
- 装备视图返回分离的三槽对象；三槽本体只在0槽拥有永久ID，1/2槽仅 `reservedByItemInstanceId` 指向本体。未知单位返回null；已知敌方按既有战斗来源 `enemy:round:unitId:slot` 投影装备，这些ID不能作为玩家库存命令参数。
- 临时子件暂为空，第3阶段接入真实态；读取不触发生成、补发或修复。当前静态/永久视图可用，不宣称TG完整查询验收通过。
- 新增 `tests/m8-b5-queries.test.ts`：独立手写枪刃配方/三槽占用/冲突ID预期；跨phase、未知身份、输入、位置、配方的预览-命令一致性；过期预览不能授权提交；返回对象隔离；保存恢复后查询一致；深冻结状态重复查询无资源/事件/RNG变化。
- 定向 `npm test -- tests/m8-b5-queries.test.ts tests/m8-b5-instances.test.ts tests/inventory.test.ts tests/upgrades.test.ts`：4文件/84测试通过。预览测试新增5项，其中包含125组跨phase合成和875组穿戴组合检查。
- 本阶段不新增状态、不更改存档格式、目录版本、规则修订或digest（仍 `db25532e`）；阶段1的四项界面枚举授权仍待回复，不能声称build通过。

下一步：第3阶段在可编辑模块中接G12，保留独立equipment stream与roll账本，给Match/快照/来源/恢复/查询接线；同一批完成新态严格局部校验和保存恢复。不得修改G12及冻结合同。

## 阶段 3：TG-01 Match 生命周期与局部恢复

状态：领域实现与定向/恢复回归完成，随本阶段 `[wip]` 提交推送；本阶段未动冻结G12及其测试。

文件与职责：

- 新增 `temporary-equipment.ts`：从目录 `temporary-equipment` effect识别生成者，调用G12冻结池生成/投影/差分/校验；固定池为35成装+8组件，禁止按名称或ID识别机制。
- `match-types.ts`：新增必需 `equipmentState{equipment:{state,draws},rolls}`、`temporaryEquipment`；`match.ts`只在成功穿戴/购买升星/出售/换轮事务接入。空库存不抽；同轮等级改变/重穿/转移不重抽；新轮清理旧绑定后生成新key。部署到备战席保留本轮组合，但不上战斗快照。
- `strategy-types.ts`：增加 `equipmentRolled` / `temporaryEquipmentChanged` 完整领域事件；生成和移除/应用均由Match事件序号盖章。新增可选父实例来源字段，普通来源JSON形状不变。
- `strategy-snapshot.ts` / `effects.ts` / `combat-types.ts` / `combat-effects.ts` / `combat-s13.ts` / `combat-s13-state.ts`：临时件的静态属性、旧mechanic和完整ItemProgram走现有通用编译/执行链，并保留父永久ID；不重做G12或另写战斗机制。
- `serialization.ts`：新字段必需；从可信seed重放equipment流验证roll；检查父物品仍存在且具有生成机制、轮次不超前/倒退、等级上界、当前持有者与两个子件精确对应。拒绝缺roll、缺子件、错holder/slot/期限/来源链，不恢复时生成。战斗策略与程序继续按完整权威快照比较。
- `item-selectors.ts`：查询返回独立临时对象副本；当前或历史临时ID用于equip/combine均拒绝 `temporary-item`，不会被误当永久实例。
- `content/items-gloves.ts` / `content/source-manifest.ts` / `equipment-policy.ts` / `content/index.ts`：更新目录说明与开发修订，固定池纳入digest，详见下文。
- `tests/m8-b5-temporary.test.ts`：独立LCG词/池索引的3/6/7/9级向量；F跨级同轮保持、出售重穿、真实tick0结算/跨轮刷新、库存延迟生成、失败/查询零词、批生成ID排序；43种临时子定义经真实Match快照/战斗/恢复；父来源与反甲真实反击；13种篡改拒绝与战斗父链拒绝。
- `tests/fixtures/m8-b4-match.ts`、`tests/m8-b5-queries.test.ts`：将原直接注入本体的夹具补成合法装备生命周期状态，不删除既有B4低层本体数值测试。
- `scripts/update-m8-b5-golden.cjs`、当前golden：保留97f38a0的归档；仍严格要求四条命令序列和完整逐轮事件哈希不变，仅新字段/版本/digest导致状态哈希变化。

设计决定：

1. 本轮父roll随永久本体保留，卖单位只清当前临时绑定，不删roll；跨轮保留历史roll用于可信RNG验证。gameOver保留本轮已冻结装备供历史/快照核验，新局重新初始化空账本；没有终局可操作临时库存。
2. `equipmentState` 与永久 `items` 完全分开；helper不分配永久ID、不授奖、不消费其他RNG。开战只复制已冻结装备，不补抽。
3. 保存旧schema5开发边界但新字段必需、digest不同，旧开发档严格拒绝。B9正式版本切换另行负责；不把本批新增态恢复推迟到B9。
4. 当前校验按旧日程35轮/最低3级约束，B6接新1级/38轮时必须同步 `validateMatchEquipment` 的轮次/等级边界；不能只改Match日程。

阶段3版本变化：装备目录 `s13-14.24b-m8-b4-v3 → s13-14.24b-m8-b5-v1`；实例规则 `m8-b5-instances-v1 → m8-b5-instances-v2`；新增上述两个必需Match字段及可选临时父来源字段，schema/save/replay版本号不变，digest改变。冻结合同未改。

### 全量自检历史（不报全绿）

阶段1首次全量：95文件，1176通过/11失败。8项为全量启动早于golden写完，捕获 `2b6a9a4b` 而运行 `db25532e`；其中4项路线已在写完后独立通过，4项M6集成待固定最终代码后重跑。另3项M5逐tick回放超过180000ms；未改时限/门禁，后续隔离复验。该次运行期间还进行了定向检查，不能当性能基线或最终B5验收证据。

### 阶段3自检与补充

- `npm test -- m8 inventory upgrades m5-serialization m4-strategy-snapshot`：51文件/572测试通过，包含未修改的G12原测试。
- 43子定义矩阵暴露临时护盾投影缺口：`combat-s13-state.ts`以前丢弃父ID，`serialization.ts`与`m8/restore.ts`只检查旧source-only key；现保留父ID，按既有运行态定义精确检查临时shield的完整effectIdentity key。临时/普通分支均只有一个合法key，父链、目标、金额与声明仍完整验证；不是放宽校验。新增伪造旧key反例。
- 四旧路线重建再次通过：命令和完整逐轮事件哈希均与基线相同；仅状态字段/版本/digest变化。最终阶段3digest：`fnv1a32-utf16:47dd941a`。
- `npm run typecheck`仍仅四项已知BoardScene文案枚举阻塞；未获界面修改授权，未改该文件。
- 全量/浏览器/生产build尚不宣称通过；不改CI、预算、阈值。后续最终固定代码需复验第1阶段已记录的全量失败项。
- 工作区另有 `docs/M8_U3_AUDIT.md`，属于同时进行的其他任务，不纳入B5提交。

下一阶段：完整升星链/满槽/多本体返还验收、IF-GRANT唯一永久实例与调用方一次收据的原子接点；新增永久库存只读查询。B8掉落资格/解决账本不提前实现。
