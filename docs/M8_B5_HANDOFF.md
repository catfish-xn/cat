# M8 B5 分阶段交接

当前分支：`feat/m8-b5`；精确基线：`97f38a0e787a4edcb35df4a59823bb1d106def67`。
依赖图按 `58c901188b7da9c1534ec3fcb949d2554cb1fbdd:docs/M8_DEPENDENCY_MAP.md` 第3/5/6节读取；不将远端更晚基线混入本分支。
用户授权尽可能多完成；每阶段自检、`[wip]` 提交、推送后再继续。不开正式PR、不送审、不合并、不rebase/force push；必要CI只开指向 `feat/m8-b0-baseline` 的草稿PR。

## 当前交接摘要（以此处为最新状态）

第二轮审计处理已完成：用户选择**先修 R1、保留现有装备玩法，规则扩展另批处理**。R1 修复提交 `20551f26fa738f090898a29360435ab1fdb1e8c5`；R2 输入补丁已在 `8e16da2` 交付，本轮补齐隔离负向证据。[本轮完整 CI #124](https://github.com/catfish-xn/cat/actions/runs/37887531022/attempts/3) 最终12/12必需作业成功，堆与输入性能失败分别定位留证后各实际复验一次；不冒称首轮全过。后续提交仅补文档，详细反例、限制及最终验收结论见文末；下方中途进度保留为历史快照。**用户转交的最终审计结论：B5于 `e3af61b55deac960c2d44085f4440b87342e6f11` 通过最终复审，可以签收；R1、R2、R3及文档版本歧义均已关闭，无本轮审计遗留阻塞。**PR #16已转Ready并按B4/U4一致的merge commit方式合入 `feat/m8-b0-baseline`；合并SHA为 `5bd7968ee31e107e12701145aa4fdac0bec7ea8d`，合并后验收见文末。

| 阶段 | 已推送提交 | 交付 |
| --- | --- | --- |
| 1 | `633f28a` | 唯一/三槽/独占、命令失败原子性、恢复约束 |
| 2 | `fb32637` | 共用校验的预览、只读装备视图 |
| 3 | `12d70ad` | TG生命周期、真实战斗来源、严格局部恢复 |
| 4 | `1e1e554` | IF-GRANT、永久库存查询、完整升星返还验收 |

四阶段历史施工提交均标记 `[wip]`；整体已在上述精确HEAD通过最终复审，可以签收。下方各阶段“未完成/下一步”是当时记录，请以本摘要与最后复验记录为准。用户已明确授权仅在 `BoardScene.ts` 补四条拒绝原因映射，现已落实；未改其他界面代码、布局或样式。四条均为临时文案，后续由 Claude 在 U3 动态部分统一打磨，已同步登记 `docs/UI_REQUESTS.md`。

本次获授权并已添加到既有 `messages` 表的四项临时文案：

```ts
'same-item': '请选择两件不同的组件实例合成',
'unique-conflict': '该单位已装备同一件唯一装备',
'exclusive-slots': '独占装备不能与其他装备同时穿戴',
'temporary-item': '临时装备不能单独操作',
```

最终固定代码 `1e1e554` 的 `npm test -- --maxWorkers=1` 已通过：98文件/1231测试，1096.34秒。参数仅限制本次本地并发，测试时限、断言、门禁和CI配置未改。上一轮全量失败已由此次固定代码复验覆盖；本次四条文案补齐后的构建、桌面 Chromium 验收及最新CI状态见文末。


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

## 阶段 4：升星返还与 IF-GRANT

状态：领域实现和定向验收完成，随本阶段 `[wip]` 提交推送；最终全量复验另记，不代表送审或签收。

- 新增 `item-grants.ts`：`planPermanentItemGrant(state,{definitionId,receiptId},committedReceiptIds)` 仅规划一个永久实例；成功返回资源state与单项 `grantedItemIds`，失败返回**同一输入state引用**与有限失败码。校验空身份、调用方已提交收据、未知目录定义、安全serial/ID冲突。零经济、零随机、零事件，无新收据账本。
- `match.ts`组件选择与 `rewards.ts`旧日程奖励接入该helper，与原 `ScheduleReceipt` 同次Match提交；旧批量日程奖励在局部副本规划每件，整批成功才提交原一份收据，任意失败不提交局部资源。没有新增公开grant命令，不更改协议2。
- `item-selectors.ts`新增 `readItemInventory(state)`：返回按永久ID排序的独立 `{itemInstanceId,definitionId}[]`，仅含真实库存，不含已穿戴、临时件或未解决选择。
- 新增 `tests/m8-b5-grant-upgrade.test.ts`：一次授予/调用方已提交收据后重试、错误定义/身份/serial、真实组件选择一次收据与保存重试、旧日程批量原子性、库存查询隔离；真实购买连锁1→2→3星，多TG冲突只返父永久实例并清子件/不重抽，唯一冲突/独占双向/满槽返还，重复购买与失败购买完全不变。
- `upgrades.ts`的通用限制已在阶段1接入；第4阶段补真实Match级联与永久ID/roll/临时绑定守恒验收，不改变survivor选择规则，不拆临时子件返库存。

IF-GRANT 给B8的接法（必须作为一个领域事务）：

1. 调用方先校验掉落资格/未解决状态，从自己的权威 `lootReceipts` 提取 `receiptId` 列表传helper；不传UI自行构造的已领取列表。
2. helper成功后，以返回的单项 `grantedItemIds` 创建那一份原形状LootReceipt，并将库存、序号、收据、解决记录和计数同次提交；helper本身不提交，也不能充当公开领取入口。
3. 重试读取**已提交后的**收据列表，返回duplicate-grant；不得只提交库存而漏提交收据。未解决选择保持选择，不先造库存。
4. 失败不创建收据、不计保底、不改状态；库存查询直接调用 `readItemInventory`。完整掉落资格/解决/终局顺序和B8恢复仍由B8负责，本批没有假装实现IF-LOOT。

本阶段无新增持久态，不改变目录/规则/digest（仍 `47dd941a`）；有效旧命令的输出保持一致。定向4文件/88测试通过（grant/upgrade 14项、temporary 25项、既有upgrade与serialization）；测试夹具priority字段补齐后，grant/upgrade 14项再次通过；typecheck复验仍仅BoardScene四项枚举缺失。

## 后续开发者优先事项

1. 先读本文件的版本/测试失败历史及各阶段SHA；不要误把 `[wip]` 当已审签。基线97f38a0；阶段1 `633f28a`、阶段2 `fb32637`、阶段3 `12d70ad`，阶段4见本节提交。
2. 四项 `BoardScene.ts` 拒绝文案已获用户授权并补齐；后续由 Claude 在 U3 动态部分统一打磨临时文案。不扩大Codex UI权限。
3. 全量/构建/桌面验收证据以文末最新记录为准；不要调整180秒回放时限、体积预算或CI配置来掩盖失败。需要CI时只开指向 `feat/m8-b0-baseline` 的草稿PR。
4. 验证完成后由接手开发者送审；本任务不送审、不合并、不开正式PR。U3动态界面可消费现有 `item-selectors.ts` 接口，不能自行重算规则。


## 四阶段领域复验（文案授权前的历史记录）

- 四阶段实现HEAD：`1e1e554de7c44b1d7bb812d5636130e997100cca`，已核对远端 `refs/heads/feat/m8-b5` 一致。本节所在后续提交仅更新交接文档。
- `npm test -- --maxWorkers=1`：**98文件 / 1231测试全部通过**，运行1096.34秒；完整保留既有180秒/120秒用例限制。覆盖此前旧golden捕获和回放超时失败项，不需要修改门禁、阈值或CI配置。
- `npm run build`：在typecheck阶段失败，仍仅 `src/rendering/BoardScene.ts:360` 的 `Record<MatchFailure,string>` 缺 `same-item/unique-conflict/exclusive-slots/temporary-item`；Vite构建未执行。无权擅改Claude界面文件，四条可应用文案见顶部；等待用户明确授权或交Claude。
- 桌面Chromium/完整浏览器验收未执行；没有因全量单测通过就标记构建、体积预算、浏览器或CI通过。未建PR、未送审、未合并；需要CI时按用户要求开草稿PR指向 `feat/m8-b0-baseline`。
- `git diff --check`通过；冻结五文件、G12源码及两份G12测试、CI配置与97f38a0的diff为空。没有rebase或force push。
- 规则/目录/存档变化最终值：目录 `s13-14.24b-m8-b5-v1`，实例规则 `m8-b5-instances-v2`，digest `fnv1a32-utf16:47dd941a`；必需新增 `equipmentState` / `temporaryEquipment`，schema5/save1/replay1仍是开发边界，旧digest档严格拒绝，B9正式格式切换未越界实施。
- 当时剩余工作（已被下节最新记录覆盖）：获得四条UI文案接线授权并落实 → `npm run build` → 适当桌面Chromium和草稿CI → 由后续开发者送审。B5领域功能已写完，不能将本次编写完成等同整体签收。

## 授权文案接线与桌面复验（最新）

- 用户授权严格限定 `BoardScene.ts` 的四条映射；本次仅新增上述四条，无其他界面代码、布局或样式改动。
- `docs/UI_REQUESTS.md` 登记临时文案归属：Claude 在 U3 动态部分统一打磨，拒绝码与规则仍由领域层给出。
- 本次不新增状态、不改变存档格式、目录版本或 content digest；冻结合同、G12及其测试、门禁/阈值/CI配置不变。
- `npm run build`：typecheck与Vite生产构建通过（Vite耗时13.39秒）；仍有标准500kB chunk提示，未修改阈值，构建成功不等同体积预算验收。
- `M5_EVIDENCE_DIR=artifacts/m8-b5-preview-cannon npm run test:preview -- --build=cannon`：桌面Chromium `153.0.8010.12`，1440×1000，`touch=false`，**passed=true**；35轮、182个命令检查点，1102.332秒。逐命令完整状态、逐轮完整战斗事件、终局与新局重置通过；原生输入均trusted、页面错误0、源码指纹前后一致。
- 证据：`artifacts/m8-b5-preview-cannon/{manifest,route,round-ledger,native-inputs}.json`、逐命令/逐轮JSON、截图与trace；生成物不提交。本次基于 `3b8444c` 加仅四条文案的源码diff验收；与本次提交源码一致，不冒充干净HEAD下的完整最终比较。
- 首次沙箱运行在git子进程启动处报EPERM，尚未执行浏览器断言；获准在沙箱外重试后上述完整路线通过，未改脚本或断言。
- 无新增测试用例：仅补四条静态文案，沿用已通过的98文件/1231测试领域全量证据；本次新增构建和桌面preview完整路线验证。不宣称其他构筑、dev模式、完整input门禁、体积/性能预算、最终比较或CI通过；本次未开PR、未送审、未合并。
- `git diff --check`通过；相对97f38a0，冻结五文件、G12与两份测试、CI配置diff均为空。本次变更文件仅 `src/rendering/BoardScene.ts`、`docs/M8_B5_HANDOFF.md`、`docs/UI_REQUESTS.md`；其他任务的未跟踪 `docs/M8_U3_AUDIT.md` / `docs/M8_U3_REVIEW.md` 保留且不纳入提交。
- 下一步：由后续开发者按审核要求补所需证据并送审；如需CI，只开指向 `feat/m8-b0-baseline` 的草稿PR。Claude在U3动态部分打磨临时文案并消费共用预览/只读接口。B6仍需同步轮次/最低等级恢复边界，B8按阶段4说明原子接入IF-GRANT。

## 送审前审计索引与CI准备

用户最新授权：由Codex开草稿PR `feat/m8-b5 → feat/m8-b0-baseline` 并跑完整GitHub CI，修复本次引入的问题并追加提交；送审仍由接手开发者负责，不转正式PR、不合并。目标分支当前为 `10a8367`，相对精确施工基线 `97f38a0` 仅多依赖图文档提交与合并提交，B5未合并或重写目标分支历史。

### 四阶段关键反例与可定位测试

以下测试名为源码中的完整标题；`%s` 行还列出参数值。文件均位于 `tests/`，可用 `npm test -- tests/<文件>` 单独定位；这是反例索引，不替代完整CI。

| 阶段 / 文件 | 关键反例与断言 | 对应测试名 |
| --- | --- | --- |
| 1 / `m8-b5-instances.test.ts` | blue-buff / last-whisper / quicksilver同持有者重复拒绝，跨持有者允许 | `%s is unique per holder, not per inventory or team` |
| 1 / 同上 | 普通装备已三件，第四件不花资源、不分配事件序号 | `allows three nonunique copies but refuses a fourth without spending resources or event IDs` |
| 1 / 同上 | 三槽本体从0/1/2任意输入归一0；普通与独占双向冲突 | `three-slot item requested at %s uses canonical parent slot 0 and reserves all slots`；`cannot equip an exclusive parent over an ordinary item in slot %s` |
| 1 / 同上 | 同实例合成、未知身份、非法槽位按冻结优先级拒绝；输入state引用/完整JSON不变 | `phase then identity then input then conflicts; same item has the frozen reason` |
| 1 / 同上 | 重放已成功合成不再次消费；篡改唯一/独占/本体槽位存档拒绝 | `successful combine consumes exactly two IDs and one serial; stale replay fails atomically`；`restore rejects invalid unique, exclusive or parent-slot placements` |
| 2 / `m8-b5-queries.test.ts` | 各phase/身份/槽位/位置/冲突的125组合成及875组穿戴，预览与实际命令一致 | `preview and command agree over identities, locations, recipes, slots, conflicts and phase` |
| 2 / 同上 | 预览后槽已被占或组件已消耗，旧成功预览不能授权命令 | `a previous successful preview never authorizes a stale command` |
| 2 / 同上 | 查询修改不回写，预留槽没有伪永久ID，未知单位null，恢复后视图一致 | `known units have three slots, reserved slots have no fake permanent IDs; unknown returns null` |
| 3 / `m8-b5-temporary.test.ts` | 3/6级成装+组件，7/9级两成装；独立手写LCG词，其他RNG与永久ID零消耗 | `level %s uses the approved pool and an independent stream` |
| 3 / 同上 | F从6升7、出售/恢复/同轮重穿不能重抽 | `F, sale, same-round re-equip and restore preserve the original level6 roll across level7` |
| 3 / 同上 | 换轮只抽一次，重复Continue/step零抽；库存本体延迟到首次穿戴生成 | `next round revokes old children and rolls once; failed/duplicate Continue and step do not draw`；`inventory parents do not refresh until first equip in a new round` |
| 3 / 同上 | 当前/已撤销临时ID不能变成库存命令或触发重抽，查询副本不能回写 | `queries and temporary-ID commands cannot redraw, consume children or issue permanent IDs` |
| 3 / 同上 | 43种子件经真实Match快照、战斗、恢复；伪造旧source-only盾key拒绝；真实反甲父链 | `all 43 eligible child definitions bind through real Match snapshots and restore`；`children contribute real stats/programs and parent provenance through combat and restore` |
| 3 / 同上 | 改流/词数/组合/父/未来轮级/holder/缺兄弟或绑定/期限/库存父携子/永久化子件等13种篡改拒绝，不修复 | `restore rejects %s instead of rerolling or repairing`；`combat restore rejects a forged temporary program parent chain` |
| 4 / `m8-b5-grant-upgrade.test.ts` | 一次永久授予，调用方已提交收据后重试拒绝；非法定义/空身份/serial零局部提交 | `plans exactly one permanent %s with no receipt/economy/RNG work`；`rejects bad definitions, grant identities and serials without any partial state` |
| 4 / 同上 | 真实选择的一件库存和一份收据原子提交，恢复后重试不补发；批量中坏定义不部分授予 | `real choice commits exactly one item and one caller-owned receipt; restore/retry cannot regrant`；`legacy multi-component reward uses one caller receipt and rejects a bad batch atomically` |
| 4 / 同上 | 真实购买链式1→2→3星、多TG只返冲突父、不拆子件、不重抽、永久ID守恒 | `chains to three stars, retaining one TG and returning conflicting parent without splitting or rerolling` |
| 4 / 同上 | unique / exclusive survivor / exclusive incoming / full ordinary冲突返还；失败购买完整资源/RNG/事件不变 | `returns %s conflicts and preserves permanent IDs across the complete command`；`failed purchase preserves roll ledger, children, resources and event serials` |

### 存档、digest与版本改动对照

| 项目 | 精确基线97f38a0 | B5最终领域代码 | 兼容性 / 理由 |
| --- | --- | --- | --- |
| Match持久态 | 无装备独立流/子件字段 | 必需 `equipmentState{equipment:{state,draws},rolls}`、`temporaryEquipment[]` | 局部严格校验及保存→恢复已在本批完成，不能缺字段后恢复时补抽 |
| 战斗来源 | 永久/普通来源 | 可选 `parentItemInstanceId` | 临时子件来源必须精确绑定父实例；普通来源JSON保持原形状 |
| 装备目录版本 | `s13-14.24b-m8-b4-v3` | `s13-14.24b-m8-b5-v1` | 补TG生命周期说明；不改36成装数值 |
| 实例规则修订 | 未单列 | `m8-b5-instances-v2`（阶段1先为v1） | 通用实例限制与TG池纳入content digest |
| content digest | `fnv1a32-utf16:2b6a9a4b` | `fnv1a32-utf16:47dd941a`（阶段1中间值db25532e） | 由内容/规则计算，不手填；旧digest开发档严格拒绝，无迁移/重标 |
| Match schema / save / replay / command / RNG / tick | 5 / 1 / 1 / 2 / lcg32-v1 / 50ms | 均不变 | 当前开发边界；正式schema6/save2/replay2等切换由B9/B10负责，未冒充正式格式兼容 |

四条UI文案及本次审计文档不再改变以上值。目录/digest不同使B3/B4开发期旧档被拒绝，这是预期兼容性变化，不能通过放宽恢复、缺字段默认值或保留旧digest绕过。

### 对B3、B4已签收行为的影响

- B3伤害/治疗/盾/状态/百分比/时序与随机算法未改；普通来源不增加父字段，普通盾仍只接受原sourceKey。临时来源贯穿既有通用编译/程序，盾投影保留父ID并只接受完整effectIdentity key；`m8/restore.ts`的分支是精确验证新来源，没有放宽普通恢复。
- B4八组件/36成装的属性、配方和程序数值保持已签收值；TG本体开始拥有已批准的真实子件生命周期，因此实际TG战斗结果可变化。唯一/三槽/独占由原目录元数据在实例层执行，升星冲突返库存；这是B5有意补齐的行为，不按装备名/ID特判。
- B4 Match级测试夹具以前直接注入TG本体，现补为合法装备流和绑定；原低层本体数值测试保留，不删断言。既有inventory失败码预期更新为冻结失败码，upgrades虚构blade夹具改真实sword，不改资源转移预期。
- `full-match-golden.pre-m8-b5.json`保留97f38a0原始golden；`update-m8-b5-golden.cjs`对cannon/sniper/mage/sniper-caitlyn四路线强制核对全部命令及30场战斗逐轮完整事件哈希不变。状态哈希只因新态/目录/规则/digest变动更新，不能用新golden替代独立数值oracle。
- 五份冻结合同、G12源码及两份测试与97f38a0 diff为空；原B3/B4测试纳入98文件/1231项本地全量，完整GitHub CI将再次验证。尚未完成CI时不把本地通过当GitHub结果。

### 验收覆盖与剩余边界

- 已有本地：98文件/1231测试全量、生产构建、桌面cannon preview完整路线。其他构筑桌面实跑、dev模式、原input、retention、M7体积/交互预算及最终比较，等待本次完整GitHub CI填补；不新增手机测试，现有CI自带的触摸覆盖照常执行。
- 四条临时文案的U3动态界面整合/打磨尚未验收；本次仅解决类型枚举文案映射，不宣称完整装备UI联调。
- 旧四路线不含TG最大合法多父/多轮负载；43子件矩阵验证真实绑定和恢复，但不是每种子件长程组合全事件的性能证明。M8最终33战/PvE/掉落与最大保存容量、正式save2/replay2仍由后续批次承担。
- IF-GRANT验证当前组件选择/旧奖励及helper；B8权威lootReceipts、资格/保底/终局解决原子接入未在本批实现。B6新最低1级/38轮需同步装备局部恢复边界。
- 完整CI的堆门禁如首轮失败，保留具体run/job/数字/日志；确认与B5无关后只重跑一次并注明，不改门禁、阈值、预热或CI配置。重复失败不能当偶发通过处理。
- 草稿PR与各CI run及实际结果将在本节后续记录；完成审计准备不等同送审或用户签收。

## 草稿PR、完整CI首轮与初步双触诊断（历史记录）

> 用户随后暂不授权修改双触脚本，要求先完成基线/B5多次同方法对照。下文562.5ms的初步归因证据不足；调查结论见“受控双触延迟调查”。截至该调查提交候选补丁未应用；之后的明确授权与实际修复在文末单列。

- [草稿PR #16](https://github.com/catfish-xn/cat/pull/16)：`feat/m8-b5 → feat/m8-b0-baseline`，仍是Draft，未送审/签收/合并。审计索引提交 `7002998aa8196fd4707b1be6fd3bf942634a7b14`。
- [完整CI #113 / run 37874820358](https://github.com/catfish-xn/cat/actions/runs/37874820358/attempts/1)：已全部结束，**总体failure**；12个必需作业中11成功、1失败，可选暖机/堆诊断2项按原配置跳过。没有诊断模式代验收、没有重跑掩盖原失败。

| 必需作业 | 首轮结果 / 实际覆盖 |
| --- | --- |
| test-and-build | 成功：98文件/1231测试、typecheck、生产构建、headless多seed、重复性能 |
| browser-{dev,preview}-{cannon,sniper,mage}（6项） | 全部成功；三构筑分别182/178/172命令检查点、30场战斗，完整状态及事件账本 |
| input-{dev,preview}（2项） | 全部成功；原生输入、既有touch路线及配置中原M6专用检查 |
| m6-retention | 成功；独立原生对象/资源门禁 |
| compare-evidence | 成功；同一干净7002998与源码指纹的M5最终比较、M6比较；不能代验未通过的M7 |
| m7-presentation | **失败**：`scripts/verify-m7-presentation.cjs:145`，两次触摸继续后实际combat；后续screens/subpath/budget同作业步骤未执行，不能报通过 |

本轮两次预热/30循环的完整应用堆实测：dev **269884 B ≤1572864 B**，listeners83→83/RAF1→1；preview **217620 B ≤1048576 B**，listeners82→82/RAF1→1。门限/预热/方法不变，均首轮通过，本轮没有堆失败重跑。

### 双触失败的反例与定位证据

1. 原CI失败日志：[job 113640880811](https://github.com/catfish-xn/cat/actions/runs/37874820358/job/113640880811)，02:32:25 UTC，`double tap on 继续 must not start combat`；原失败产物保留。B5没有改该脚本或 `strategy-panel.ts` 的400ms生命周期防护。
2. 用原M7全脚本在本地顺序对照：97f38a0隔离构建通过全脚本；当前B5构建复现同一第145行失败。一次基线通过不能证明B5因果，也不能把复现失败当CI随机抖动。
3. 仓库外脚本副本保持原完整断言，仅监听trusted原生事件时间；失败时click间隔 **562.5ms**（65809.2→66371.7），第二个click目标从 `mobile:continue` 变为 `mobile:start-combat`，结果combat。这只能说明原脚本40ms等待不等于真实click间隔，不能单独证明是驱动或B5导致。产品400ms防护实际在第一次同步处理结束后才开始；此前直接比较总间隔的归因过早，已由文末对照纠正。
4. 局部原输入通过样本间隔245.4ms、结果preparation。准备的输入驱动补丁只将双触排队为两次Chromium原生 `Input.dispatchTouchEvent`，不等待第一次release确认后才开始40ms间隔。局部实测两次trusted click目标仍为continue→start-combat，间隔131.5ms；完整脚本诊断的双触检查也通过，间隔51.1ms；随后7项原M7检查全部通过（passed=true），包括继续双激活、回放、奖励帮助层与头像回退。未使用DOM `.click()`、伪造领域状态、加大产品窗口或删第二次操作。
5. 被放弃的 `Input.synthesizeTapGesture` 候选未产生足够click，不能证明覆盖，未入库、未算通过；仅保留确实发出两次原生click的方案。诊断副本不替代原门禁或GitHub验收。
6. 当前原约束“不改门禁、阈值、CI配置”仍有效；补丁已在仓库外准备且局部验证，因修改位置属于门禁脚本，已向用户申请仅输入驱动的明确例外，**尚未应用仓库脚本**。修复后必须追加提交并跑完整CI，不以一次不变代码重跑掩盖失败。

原完整M7对照与诊断产物在 `/tmp/m8-b5-ci-{baseline,current}-m7-evidence`、`/tmp/m8-b5-full-m7-current-probe`、`/tmp/m8-b5-full-m7-dispatch-fixed-probe`；原CI永久链接如上。最终比较产物在CI `m5-comparison-sample1-7002998...`，已核对SHA、干净工作区与源码指纹；生成物不提交。

继承的已知问题：B4 `M8_B4_STATUS.md` 的R3b记录泰坦已有层刷新后当前属性查询可提前一tick显示新幅度，实际命中取样仍按原值。B5未改对应status时序逻辑，不将这项记为已修。此前“除cannon外未实跑”的缺口已由本轮三构筑dev/preview补齐；剩余M7子路径/展示/体积预算、U3动态联调、TG最大合法长程负载及后续正式存档/新日程边界仍需准确区分。

### 调查前的输入驱动方案（历史记录；当时尚未应用）

替换原第140–142行两次tap与中间等待，后面的700ms等待、两项双触结果断言、刻意Start及全部其他检查保持原样。原400ms产品窗口、测试时限、CI配置保持原样；不改变B5领域/存档/digest。用户已被请求确认原“不改门禁”约束的这一精确输入驱动例外，未收到确认前不应用。

```js
// Queue the second native touch without waiting for the first release acknowledgement.
// Driver round trips must not turn the intended 40ms burst into deliberate clicks.
const touchInput = await touch.context.newCDPSession(touch.page);
const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
await touchInput.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
const firstRelease = touchInput.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await new Promise(resolve => setTimeout(resolve, 40));
const secondPress = touchInput.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
const secondRelease = touchInput.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await Promise.all([firstRelease, secondPress, secondRelease]);
await touchInput.detach();
```

本节文档追加提交只更新交接，不冒充已修复驱动或已通过完整CI。当前完整CI证据仍绑定7002998；新文档HEAD的自动CI如启动，也不能消除已记录的输入驱动问题。授权后实际修复需另行追加提交、原M7全脚本验收及完整GitHub CI，仍不送审、不合并。

## 受控双触延迟调查（0298a3f；当时待用户决定）

用户明确暂不授权修改M7双触脚本；本阶段只调查、记录，不应用上述候选方案。比较精确基线 `97f38a0e787a4edcb35df4a59823bb1d106def67` 与当前B5 `e10c2541e57797b38bbd62a98b600739a94eb0b7`，后者领域代码与审计HEAD 7002998相同。

- 完整报告：[M8_B5_CLICK_LATENCY.md](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/M8_B5_CLICK_LATENCY.md)；机器证据：[M8_B5_CLICK_LATENCY.json](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/evidence/M8_B5_CLICK_LATENCY.json)。报告保留十次普通样本、两次独立采样、实际输入分段及可复现命令，不筛掉失败。
- 同机交替、同构建方法、同依赖、原完整前置负载和原双触输入：基线**2/5失败**、B5**1/5失败**。click总间隔中位数434.1/365.7ms；第一次同步处理中位数45.5/44.8ms，未观察到B5稳定变慢。两版都能复现，不能把此前一次基线通过作为因果证据。
- 第一次同步处理结束后才启动400ms防护。原40ms等待实际约41–44ms；主要耗时是第二次tap API发起到原生click派发，基线207–421ms、B5 190–365ms。两版trace在第一次处理结束至第二次click之间，Chromium渲染提交分别占224.050/304.535ms，线程CPU仅5.929/6.443ms，主要为已有渲染提交/调度等待。
- 界面未调用B5预览/只读查询。换轮确有新增装备计划：单次采样约1.1ms，预热隔离测量约0.0077ms/次；整个nextRound预热增量约0.01ms。不能说“零新增计算”，但它在防护开始前执行，当前没有证据支持它造成数百毫秒输入延迟。保留原实现和严格校验，不为此修改冻结G12。
- 562.5ms旧单次样本没有完整trace，不能事后声称已还原其全部因果；本地有限样本不等于所有CI环境/最大TG负载都无回归。原CI #113仍11/12必需作业通过、整体failure；未重跑掩盖失败，PR仍Draft，不送审/合并。

### 本阶段文件、验证与设计决定

| 文件 | 用途/验证 |
| --- | --- |
| `scripts/diagnose-m8-b5-click-latency.cjs` | 只读提取原M7前置及原输入/断言、交替运行并保留全部结果；已跑5对普通测量+1对单独采样 |
| `scripts/analyze-m8-b5-click-latency.cjs` | 时间分解、source map还原CPU栈、trace窗口统计；已对全部12份产物分析；采样区间按时间排序，嵌套值不相加 |
| `scripts/diagnose-m8-b5-click-pure-cost.cjs` | 真实快照的隔离Chromium纯函数成本；预热成本与端到端/冷路径结果分开列明 |
| `docs/M8_B5_CLICK_LATENCY.md`、`docs/evidence/M8_B5_CLICK_LATENCY.json` | 详细结果、限制、构建/原门禁/原始产物指纹及复现步骤 |
| `docs/M8_B5_HANDOFF.md` | 纠正初步归因、记录当前授权边界和下一步 |

新增的是诊断工具，**没有新增/修改验收测试**，三份脚本均通过`node --check`；未因纯调查文档追加而重复跑1231项领域测试/构建。原门禁文件与基线字节一致；冻结合同、G12及测试、CI/阈值无改动。**本阶段存档格式、content digest、目录/规则版本均无变化**。

建议用户决定是否只授权输入驱动例外：把两次原生触摸排队，避免等待第一次release ACK后才启动40ms间隔；不改断言、产品窗口或CI。获授权后需检查两次trusted click及实际间隔、跑原M7全脚本与完整CI；未获授权前保持未应用状态。若先要求CI runner上trace，再继续采集环境证据。本次仅交付调查结论，不把建议当成授权或完成修复。

## 已授权的M7双触输入修复（最新；独立审计项 B5-M7-INPUT）

用户明确授权仅调整双触输入驱动，保留全部断言、400ms阈值、CI配置与其他门禁。本阶段只把原两次顺序等待tap替换为同一CDP会话的两次原生触摸排队：不等待第一次release ACK后才开始40ms间隔；最后等待全部ACK，finally释放会话。`verify-m7-presentation.cjs`替换块之外字节完全一致，产品/冻结合同/G12及测试无变动；存档格式、digest、目录/规则版本均无变化。

| 本阶段文件 | 修改/验证 |
| --- | --- |
| `scripts/verify-m7-presentation.cjs` | 仅授权输入块；原700ms等待、双触/双击断言、刻意Start及后续检查全部保留 |
| `scripts/probe-m7-native-touch.cjs` | 可选只读preload，记录真实原生事件；不接入CI配置，不改变输入或对局状态 |
| `scripts/diagnose-m8-b5-click-latency.cjs` | 增加`--gate`以读取归档旧驱动，历史失败仍可复现；不覆盖旧测量 |
| `docs/M8_B5_CLICK_LATENCY.md`、`docs/evidence/M8_B5_NATIVE_TOUCH_FIX.json` | 新旧对比、原生事件/全脚本结果及审计边界；旧机器证据不改写 |
| `docs/M8_B5_HANDOFF.md` | 授权、阶段验证与CI交接 |

- 修复前基线97f38a0的5次测量中2次失败（click总间隔502.0/472.0ms），B5 5次中1次失败；不是通过单次基线成功来推断驱动问题。全部原始对照保留在前节。
- 修复后在**相同生产资产、完整原M7前置负载**下，基线与B5各运行一次完整M7脚本，两版均通过全部7项检查。两次trusted click均为continue→start-combat；基线click间隔**42.2ms**、处理后**9.3ms**，B5为**61.9ms / 8.4ms**，均在原400ms窗口内。
- 原脚本SHA256 `518ef64aa54a272baed1e8e59cf0d82ac8c60c83ac09ae529461222476b93fda`；修复后 `e14a32900b6785c6091040c16c80bd3b7151793be0f0cac058d18218a8424d50`。三份本轮涉及的脚本通过`node --check`；完整CI在本阶段提交推送后按正常配置执行，不使用诊断模式。
- **审计方必须单列 B5-M7-INPUT 核实**：授权范围、替换块外字节一致、断言/400ms不变、基线偶发失败的对照证据、修复后实际原生间隔及正常完整CI结果。这个修复不等于B5领域回归修复，也不等于已签收。
- 修复已提交推送为 `8e16da2f53c4d2d715f663a719a1329e54330568`；完整CI结果见下一节。原#113失败仍保留。PR #16保持Draft，不送审、不合并。

## 输入驱动修复后的完整CI结果（最新）

- [完整CI #120 / run 37883266293 / attempt 1](https://github.com/catfish-xn/cat/actions/runs/37883266293/attempts/1)：**12/12必需作业首轮全部成功**，两个可选诊断按原配置跳过，无失败或重跑。正常workflow_dispatch默认输入，修复SHA为 `8e16da2f53c4d2d715f663a719a1329e54330568`。
- 全量98文件/1231测试（原日志368.72秒）、typecheck/build、headless多seed/重复性能通过；cannon/sniper/mage × dev/preview六路线、两组input、M6 retention、M7以及最终比较全部通过。最终M5/M6证据均为干净8e16da2，源码指纹 `008a880c749e7fd8a2348e51eedda614bb7c0f81372e886e869bf91375644e07` 一致。
- [M7作业113667531607](https://github.com/catfish-xn/cat/actions/runs/37883266293/job/113667531607)原日志确认完整7项检查、原有五视口、`/cat/`子路径和预算通过，填补原#113未执行的剩余M7覆盖。JS gzip473332B / 基线424763B = 1.114344 ≤既有1.15；首交互747/687ms = 1.087336 ≤1.20。没有新增手机适配或测试，仅运行原有门禁。
- 堆首轮实测：dev **259632B ≤1572864B**（listeners83→83、RAF1→1），preview **238776B ≤1048576B**（82→82、1→1）；沿用原2次预热/30循环，无诊断、无堆失败重跑。
- 审计独立项 **B5-M7-INPUT** 仍必须核实。原34处assert调用逐项文本及顺序一致；仅输入驱动变化，400ms和其他门禁/CI未变。对照证据/永久链接/原始产物指纹见 [报告](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/M8_B5_CLICK_LATENCY.md)与 [机器证据](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/evidence/M8_B5_NATIVE_TOUCH_FIX.json)。
- 本次结果补记只改 `docs/M8_B5_CLICK_LATENCY.md`、`docs/evidence/M8_B5_NATIVE_TOUCH_FIX.json` 和本交接文件；相对已通过CI的8e16da2，没有可执行源码/脚本/依赖/工作流变化。明确区分CI受测SHA与后续文档SHA，不因纯文档补记重复整轮测试。
- 未覆盖边界仍为前述U3动态联调、TG最大合法长程负载、后续正式存档/新日程及B8收据集成；本轮输入驱动修复不改变存档、digest、目录/规则版本，也不修复或重定义B3/B4已签收行为。下一步由接手开发者审计，本文不代替签收；不送审、不合并。
- 结果补记前曾发现PR引用未同步：分支与Git Ref API为8e16da2，PR API及`refs/pull/16/head`为0298a3f。**结果文档79c4d7e推送后，已用git ls-remote复核分支与PR head均为79c4d7e，差异消除。** PR摘要已更新为真实修复及CI结果，状态仍Draft；没有关闭重开、改目标分支或合并。该异常及恢复作为历史记录保留，审计仍须区分修复受测SHA8e16da2与后续纯文档提交。

## 第二轮审计修复：R1 历史抽取等级（2026-10-09）

范围决定：用户选择先修 R1，保留普通穿戴不自动合成、升星不跨英雄合成、主单位原装备优先及既定转移顺序。自动合成和成装优先另批定义规则，不作为本轮新增玩法。

根因：冻结 G12 能重放随机数与抽样池，但它不持有 Match 的历史经济。原 Match 校验仅要求抽取等级不高于当前等级；当前到七级后，将首轮实际三级改成七级，并将相同 RNG words 对应的组件改为成装，仍可通过 RNG 重放。这个反例是历史真实性漏洞，不是 RNG 算法错误。

| 文件 | 本轮修改与设计理由 |
| --- | --- |
| `src/simulation/temporary-equipment.ts` | 逐 roll 校验所属轮次：下界为首轮初始等级或上一轮 `levelAfter`；上界为已结算轮 `levelBefore` 或未结算当前轮当前等级。用区间保留同轮先抽后 F、先 F 后首次穿戴；结算被动经验不属于该轮装备生成时点。 |
| `src/simulation/serialization.ts` | 把装备交叉校验移到轮次结构、身份、经济历史及当前结算总量验证之后，确保依据可信。保留原有结构/装备位置及全部严格校验。 |
| `tests/m8-b5-equipment-history.test.ts` | 新增 8 项真实公开命令回归；不注入资源、轮次或结算。拒绝路径覆盖对象/字符串恢复与序列化，保持输入不变。 |
| `docs/M8_B5_HANDOFF.md` | 记录用户范围决定、缺陷、反例、版本影响和实际受测提交；本轮仍为 `[wip]`，不代替复审签收。 |

### R1 审计反例与测试索引

以下测试均位于 `tests/m8-b5-equipment-history.test.ts`：

| 手算边界/反例 | 对应测试名 |
| --- | --- |
| seed42 首轮三级，已到第8轮七级；旧 roll 伪造七级双成装，RNG 状态和当前子件均不变，冻结 G12 单独仍接受，Match 必须拒绝 | `rejects a historical level3 roll forged as level7 with RNG-consistent two completed items` |
| 第3轮结算升到四级，第4轮补给/当前第8轮下界都是四级；伪造三级且 RNG pair 不变也须拒绝（两例） | `rejects a roll below the previous settlement level in a %s` |
| 第3轮结算前三级、被动经验结算后四级，不得把装备抽取等级写为四级 | `uses levelBefore rather than passive levelAfter as the settled-round upper bound` |
| 本轮先以四级抽取，再 F 到七级：当前、结算后、下一轮历史三种保存恢复都合法 | `preserves a legal pre-F roll through current, settled and historical save/restore` |
| 本轮起始四级，先 F 到七级再首次穿戴，七级抽取合法 | `allows the first equip after same-round F at the upper bound, not only the starting level` |
| 伪造结算 `levelAfter` 必须先被轮次经济校验拒绝，不能先消费该值检查装备 | `validates round economy before consulting its level bounds for equipment` |
| 完整公开对局的 SaveEnvelope 与 BattleHistory 先正常通过；只改 Match 旧 roll、不改归档，完整存档入口必须拒绝 | `rejects the forged historical level through full save-envelope validation without changing archived battles` |

修复前上述 8 项实际为 **5 失败、3 通过**，失败均是错误接受伪造；修复后 B5 五文件 **70/70 通过**，包含全部 8 项。类型检查及生产构建通过。全量本地回归和对应提交完整 CI 的结果补记于下方，未完成前不得沿用 #120 宣称本轮通过。

### 格式、版本及 B3/B4 影响（本轮单独声明）

- 本轮无新增状态/字段、无格式迁移、无内容或随机抽样规则改变。Match schema5 / save1 / replay1、目录 `s13-14.24b-m8-b5-v1`、实例规则 `m8-b5-instances-v2`、digest `fnv1a32-utf16:47dd941a` 均不变；这是落实原历史约束的恢复校验修复，不改变合法运行规则，因此不更新内容 digest 或规则版本。
- 合法保存恢复继续逐值往返；旧实现错误接受的伪造档现在严格拒绝，不补抽、不修正或迁移。既有 B5 新状态/相对施工基线的版本差异仍见前文，不能将“本轮无格式变化”误读为整个 B5 无变化。
- 不修改 B3/B4 内容、战斗、时序、装备数值或事件生成；仅影响不合法历史数据的接受范围与拒绝顺序。冻结合同、G12及其测试、CI/阈值均不动。原有 B4 R3b 查询显示时序限制仍保留，未宣称本轮修复。
- 仍未覆盖 U3 动态联调、TG 最大合法长程负载、后续正式存档/新日程及 B8 集成。三构筑 dev/preview 已有 #120 覆盖，本轮仍须完整 CI 复验；不扩展手机适配。

### R2 独立核验项 B5-M7-INPUT

R2 针对 `0298a3f` 的交付缺口已由 `8e16da2` 补齐，基线/B5 的两次 trusted click、窗口内间隔、原 M7 全脚本及完整 CI #120 证据见前文。第二轮不重复改输入驱动；额外按附件要求在 `/tmp` 隔离副本关闭产品防护，核验原双触断言的负向敏感性，结果登记在延迟报告中。仓库产品 400ms、全部断言、门禁和 CI 配置保持不变，审计方仍需单列核实。

负向验证已完成：先关闭隔离副本全部防护，原鼠标双击断言先失败；再仅让触摸环境绕过防护，原完整脚本到第154行双触断言按预期失败（实际 `combat`，退出1）。两次click均trusted、目标continue→start-combat，间隔43.6ms，第一次处理后9.4ms，均在原400ms内。仓库未引入此变异。完整事件、变异/资产指纹及失败报告见 [延迟报告](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/M8_B5_CLICK_LATENCY.md) 与机器证据 `round2NegativeControl`；这个故意失败样本只证明断言敏感性，不冒充正常M7通过。

### R1 实际提交与验收进度

- R1 已提交推送：`20551f26fa738f090898a29360435ab1fdb1e8c5`，仅两份领域源码、新回归文件及交接文档。之后的双触负向证据/结果补记均为纯文档，不改变受测产品。
- [本轮完整 CI / run 37887531022](https://github.com/catfish-xn/cat/actions/runs/37887531022/attempts/1) 使用该精确SHA、workflow_dispatch默认参数；结果见下方补记，不用旧#120替代。本轮没有改CI、测试时限、断言或其他门禁。
- 本地默认全量首轮：99文件中97通过、2失败；1233通过、6失败，726.89秒。原日志明确全部失败是 `tests/m5-replay.test.ts` 的sniper/mage/sniper-caitlyn三项180000ms超时，以及 `tests/m6-integration.test.ts` 同三构筑120000ms超时；没有值/事件不一致断言。本次曾与构建和负向浏览器诊断并发，不能仅凭超时即认定环境偶发，更不能报全量通过。
- 浏览器诊断与该轮全量结束后，按原180/120秒时限，以 `npm test -- tests/m5-replay.test.ts tests/m6-integration.test.ts --maxWorkers=1` 单独复验两文件；只限制本次本地worker并发，不改变测试或CI配置，原失败记录保留。复验及CI实际结果待结束后补记。
- CI首轮 [preview-cannon作业113680778586](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113680778586) 堆门禁失败：**2029636B >1048576B**；两次预热/30循环、无诊断。已保留[原产物11597381206](https://github.com/catfish-xn/cat/actions/runs/37887531022/artifacts/11597381206)。listeners全程82、RAF全程1、applications/sessions/observers全程各1；该活跃快照及3份归档均为0条roll，未执行R1新增的等级区间分支。本轮无新增持久引用，结合以上检查，按用户对首轮堆偶发失败的既有授权，仅做一次同SHA/同门限/同预热重跑；不能由这些计数推断所有负载都无泄漏。整轮尚运行时API拒绝启动重跑（HTTP403，workflow already running），该请求没有产生一次运行。实际重跑结果在结束后补记。
- M7首轮 [作业113680778554](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113680778554) 已通过：全部7项交互、原有视口、`/cat/`子路径及预算。JS gzip473392/424763B=1.114485≤原1.15，首交互734/683ms=1.074671≤原1.20；M6独立原生资源作业也已通过。完整本轮机器证据登记在 `docs/evidence/M8_B5_ROUND2_VALIDATION.json`，仍须等全部必需作业结束才判定整体结果。

### 供用户先行复审的交接快照

用户要求代码修好后先告知并交复审，开发者继续等待CI。R1代码已修好并推送为 `20551f26fa738f090898a29360435ab1fdb1e8c5`；本次追加仅为负向验证及进度文档，与受测修复SHA没有可执行代码差异。R2正常/负向证据均已备齐。当前CI测试、构建、headless步骤及完整M7/M6资源作业通过，其他长任务与单次堆重跑尚未完成，**不能据此宣称完整CI通过或签收**。PR #16仍Draft；由用户/接手开发者送复审，我继续跟进CI，不送审、不合并。

本地超时复验结果：上述两文件按原时限单worker复验 **2文件/8项全部通过**，990.85秒；保留首轮1233通过/6超时记录，不将其改写为首轮通过。正常CI的test-and-build原日志确认 **99文件/1239项全部通过**（551.79秒），typecheck/build、headless多seed与重复性能均通过。没有为本轮失败改测试、时限或CI配置。

### 首轮CI新发现的M6性能失败与受控对照

首轮最终为9个必需作业success、2个failure、最终比较因依赖失败skipped，另2个可选诊断skipped。除preview-cannon堆失败外，[input-dev作业113680778342](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113680778342) 在后续 `verify-m6-performance.cjs:123` 失败：capture P95 **81.4ms >50ms**、cachedSeek max **111.5ms >100ms**。此前100项原生输入、正常时间完整触摸路线、五视口、33项存储与17项组件检查均已通过；后续retry/application-failures检查尚未执行。不能把这个作业笼统描述为输入断言失败。

原12个capture样本为81.4/43.8/52.3/20.4/17.9/17.3/18.2/16.8/16.8/17.1/18.5/17.2ms，cachedSeek只有第11个样本111.5ms超预算。所有样本和原日志/manifest指纹保留于机器证据，未删除首个冷样本、增加预热、修改预算或脚本。

代码核验：capture计时段执行 `BattleHistory.capturePrefix` 的digest/deepFreeze及 `SaveCoordinator.enqueue → fixedCapture → repository.commit` 的复制/冻结；cachedSeek执行检查点clone、`stepCombat`和read。两段均不调用本轮 `restoreMatch/validateMatchEquipment`；相关模块在R1前后字节不变。构造/完整导入可以调用历史恢复，但属于独立的firstSeek/completeImport计时段，它们均通过。

在同机串行运行**原完整性能脚本**，精确源码分别为R1前 `0ece5b9` 和R1后 `20551f2`，共享相同依赖/Chromium 153.0.8010.12，不改变预算或工作负载。两个工作树的受跟踪源码无修改；原manifest准确记录了 `?? node_modules`（共享依赖符号链接），因此不能冒称工作区完全干净或用本地对照代替CI。

| 指标 | R1前 | R1后 | 原门限 |
| --- | ---: | ---: | ---: |
| capture P95 | 77.7ms（失败） | 62.0ms（失败） | 50ms |
| cachedSeek max | 62.4ms（通过） | 46.1ms（通过） | 100ms |
| completeImport max | 11777.9ms | 11653.7ms | 30000ms |
| firstSeek max | 1640.2ms | 1676.1ms | 2000ms |

两版本完整脚本均因capture失败，**不能记为本地性能验收通过**。相同脚本指纹、浏览器、载荷尺寸（完整24803012B、增量2026215B、最大战斗记录1834558B）及除耗时外的五构筑摘要均一致。R1前已经复现capture超预算，且没有观察到R1使两项失败指标变慢；这些证据支持不是本轮历史校验新增的计算退化，不能证明所有负载和机器均无性能风险。依此保留原结果，对input-dev安排一次原配置复验；不靠循环重跑消除失败。

重跑次数以实际job ID/起止时间为准：attempt2仅实际执行preview-cannon（job113687150359）；input-dev的attempt2记录只是继承首轮失败，并没有第二次执行。CLI泛化错误和已在运行时的403请求不算一次测试。堆作业结束后再针对input-dev做一次复验，分别登记每个作业实际执行次数；最终结果见后续补记。dev-cannon首轮堆为 **-592904B ≤1572864B**，listeners83→83/RAF1→1，原2次预热/30循环不变。

最新进度补记：attempt2的preview-cannon唯一一次重跑已通过（job113687150359），堆211556B≤1048576B、listeners82→82/RAF1→1、原2次预热/30循环，干净20551f2且源码指纹97d52e0a03dc571c7cca7610c72666b49a84c6c6931872122eedb745208c8ca0一致。首轮2029636B失败仍保留。attempt3仅实际重跑input-dev（job113691471754），这是该作业首次复验；其他已通过作业继承结果，未再次执行。该输入复验与最终比较尚未结束，不能提前宣称完整CI通过。本次进度提交只更新交接及机器证据，不改变20551f2的受测代码。

## 第二轮最终验收结论（最新；2026-10-09）

- **代码已修复并交付复审材料**：R1为 `20551f26fa738f090898a29360435ab1fdb1e8c5`，之后 `63a8dbf`、`074d68b`及本次结果补记均只修改文档/证据，不改变受测代码。R2原补丁与本轮负向验证均已齐备，仍作为独立审计项 **B5-M7-INPUT**，不混为R1领域修复。用户已先行安排复审；我未请求review、未标记签收、未合并，[PR #16](https://github.com/catfish-xn/cat/pull/16)保持Draft。
- **[完整 CI #124 / run 37887531022 / attempt3](https://github.com/catfish-xn/cat/actions/runs/37887531022/attempts/3) 最终 success：12/12必需作业全部成功**，2个可选诊断按原配置跳过。不是三次完整CI：首轮9个必需作业通过、2失败、比较跳过；attempt2仅实际复跑preview-cannon，attempt3仅实际复跑input-dev并执行最终比较，其他作业继承已通过结果。两个失败作业各实际复验一次；原失败及未启动请求保留，不改代码、门限、预热或CI配置。
- 验证覆盖：99文件/1239测试、typecheck/生产构建、headless多seed/重复性能、cannon/sniper/mage × dev/preview六路线、两组原生输入、M6资源与持久化失败边界、完整M7交互/视口/子路径/预算、最终M5/M6比较。此前input-dev未执行的4项持久化重试边界与9项应用失败边界在唯一一次复验中均通过。

| 首轮失败项 | 原结果（保留） | 唯一一次实际复验 | 结论/证据 |
| --- | --- | --- | --- |
| preview-cannon应用堆 | 2029636B >1048576B | attempt2 / [job113687150359](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113687150359)：211556B，listeners82→82、RAF1→1 | 通过；同SHA、原2预热/30循环，无诊断 |
| input-dev后续M6性能 | capture P95 81.4ms >50；cachedSeek max111.5ms >100 | attempt3 / [job113691471754](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113691471754)：24.3ms /39.3ms | 全部8项原性能预算及后续检查通过；修复前后对照与原样本保留 |

- 已下载并核对[最终比较作业113696499088](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113696499088)产物：M5三构筑为182/178/172命令检查点、各30场战斗，均 `final-clean-commit`；M6九份记录与最终validation全部通过、dirty为空。全部绑定 `20551f2` 和源码指纹 `97d52e0a03dc571c7cca7610c72666b49a84c6c6931872122eedb745208c8ca0`，所有收集命令exitCode=0，没有混用旧#120或其他源码。产物SHA256、最终作业链接/状态与首轮原始数据见 [M8_B5_ROUND2_VALIDATION.json](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/evidence/M8_B5_ROUND2_VALIDATION.json)。
- 局部验收如实区分：R1定向70项与build通过；本地默认全量1233通过/6超时，随后原时限单worker两文件8项全部通过；正常CI1239项全部通过。本机性能对照capture在R1前77.7ms、后62.0ms都超50ms，**本地性能两次仍记失败**。最终CI通过不等于证明所有环境没有冷路径/调度波动，不删除首轮失败或把有限对照写成全负载保证。
- 本轮未更改冻结合同、G12及其测试、CI配置、产品400ms或任何门限；不扩展自动合成/跨英雄合成/成装优先。格式、目录/规则版本、content digest不变，B3/B4已签收行为不重新定义。U3动态联调、TG最大合法长程负载及后续正式存档/日程/B8接线等剩余边界仍按前文交接。
- 下一步由用户/接手开发者完成独立复审与签收；本次补记只提交文档，无可执行代码变化，因此不因结果文档SHA变化重复整轮CI。不送审、不合并。

## 收到第二轮复审结论后的核对（2026-10-09）

- 用户转交两份报告明确：**R1、R2可以签收，B5整体暂不签收**。本次不重复修改已获认可的源码，不扩展装备玩法，也不代表审计方签收整体。
- 报告中“CI未完成”的快照截至北京时间13:43:22；本次重新读取GitHub API确认，[CI #124 / run37887531022 / attempt3](https://github.com/catfish-xn/cat/actions/runs/37887531022/attempts/3) 已于北京时间14:20:22更新为completed/success，受测SHA仍为 `20551f26fa738f090898a29360435ab1fdb1e8c5`。12个必需作业success、2个可选诊断skipped；以run ID与受测SHA识别本轮结果，不将报告中的#121编号视为本轮最终结果。
- **R3的执行验收证据已补齐，待审计方复核**：[input-dev唯一一次复验](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113691471754) capture P95为24.3ms、cachedSeek max为39.3ms，保留50/100ms阈值；后续4项retry及9项application-failures均执行通过。[preview-cannon唯一一次复验](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113687150359)与[最终比较](https://github.com/catfish-xn/cat/actions/runs/37887531022/job/113696499088)也已通过。原失败产物、同机修复前后两次capture失败、对照限制仍见前文及机器证据，本次没有再次重跑。
- 性能归因的边界不变：现有调用路径与对照支持R1没有引入所测计时段的新计算；没有trace级证据证明首轮波动的精确调度/冷路径原因。一次复验通过不等于所有环境均无性能风险，也不抹去原失败。
- 修正 `docs/M8_B5_CLICK_LATENCY.md` 两处版本歧义：将“当前B5”明确为“当时的B5（8e16da2）”，实测资产SHA仍为e10c254，不把早期点击数据改记为R1样本。已核对 `git diff e10c254 8e16da2 -- src` 为空；所有历史数值和资产指纹保持原样。
- PR可合并性单独记录：核对时GitHub API对head `572791cc514e1b364a13fc083c4f301c3492133f`、base `10a8367bead882c91e28769b400ad1b819b79980` 返回 `mergeable=false / mergeable_state=dirty`。对完全相同两SHA执行 `git merge-tree --write-tree --name-only` 却退出0、无冲突文件，结果树为 `9d73021dc3ba01cff7faa8dc3e7083cc5db6f756`。因此不能确认存在文件内容冲突，也不能保证平台可合并；只记录平台与本地计算的差异，未改变分支、索引或工作区，未执行merge/rebase/force push。实际合并前由接手开发者重新核实平台状态。
- 本次仅修改本交接与点击报告两份文档；无新增测试，无存档格式/digest/目录或规则版本变化，无B3/B4行为变化。相对20551f2的源码、脚本、测试、依赖与CI配置无差异；执行 `git diff --check` 并核对证据链接/SHA，不为纯文档重复完整CI。仓库另有U3审计/复审未跟踪文档，本次不触碰或提交。
- 下一步：用户将本交接、最新CI与保留的失败/对照证据交复审；重点复核R3执行闭环及上述归因限制。开发者等待反馈，不送审、不合并；整体是否签收由审计方决定。

## 最终审计通过登记（2026-10-09）

结论来源：用户转交的最终只读审计报告。**B5 于 `e3af61b55deac960c2d44085f4440b87342e6f11` 通过最终复审，可以签收。** 审计基线为 `10a8367`；未发现新的阻塞或应修问题。此条覆盖前文历史快照中的“整体暂不签收/待复审”，不改写历史失败和原审计结论。登记提交仅更新本交接，不将后续文档提交冒充已审计HEAD。

- R1、R2维持通过；R3验收阻塞及点击报告的历史版本歧义关闭。审计确认领域代码、测试、冻结合同、400ms防护、性能预算及CI配置均未发生本轮变动。
- 审计CI唯一快照为 **2026-10-09 14:43:57（UTC+8）**：[CI #124 / attempt3](https://github.com/catfish-xn/cat/actions/runs/37887531022/attempts/3) completed/success，12/12必需作业通过、2个可选诊断按原配置skipped，无未完成作业。实际受测提交为 `20551f26fa738f090898a29360435ab1fdb1e8c5`；审计HEAD e3af61b无独立run，审计已确认二者仅文档差异，可执行代码一致。
- 通过范围：99文件/1239测试、构建、headless与重复性能、m6-retention、完整m7-presentation、cannon/mage/sniper的dev与preview六路线、input-dev/input-preview、最终compare-evidence。原#113的M7失败已由本轮完整成功结果覆盖，原记录继续保留。
- R3原始日志经审计核实：capture P95 **24.3ms ≤50ms**、cachedSeek max **39.3ms ≤100ms**，全部8项预算通过；此前中断的4项持久化重试与9项应用失败检查均实际执行并通过。preview-cannon堆门禁复验通过；按实际起止时间确认堆与input-dev各仅实际复验一次，其余成功作业继承结果。
- 最终比较实际完成：M5三构筑各30场，182/178/172个命令检查点一致；M6九份记录通过，均绑定20551f2。作业链接与机器证据沿用前文，未重跑或替换原产物。
- 签收范围遵循现行装备合同：普通穿戴自动合成、跨英雄合成、成装优先仍属另批规则扩展，无新增决策项。此前记录的后续集成/负载覆盖边界不变，不列为本轮审计遗留阻塞。
- 后续性能跟踪项：首轮失败与本地R1前后capture **77.7/62.0ms** 超限记录完整保留。调用链核查支持两项失败计时段没有新增R1计算；首轮波动的精确原因尚未由trace定位，审计将其列为非阻塞跟踪项，不宣称已证明所有环境均稳定。
- 本次登记仅改 `docs/M8_B5_HANDOFF.md`，检查文档差异与 `git diff --check`；无新增测试或代码、无格式/digest/版本变化，不重复CI。PR #16保持Draft，不发起评审、不合并；此前平台可合并性差异仍留待实际合并前核实。下一步等待用户安排后续工作。

## 用户批准合并及基线同步（2026-10-09）

用户明确批准PR #16转Ready并合入 `feat/m8-b0-baseline`，使用与B4/U4一致的保留历史merge commit。覆盖前文“不合并/保持Draft”的历史施工要求；性能波动继续作为跟踪项，不阻塞本次合并。

- 最终审计HEAD仍为e3af61b；登记提交 `114951c22c0b332d4d68623dca475ee1552ed722` 相对它仅改本交接文档。CI #124实际受测20551f2，不称e3af61b有独立run。
- 已确认正常应用堆门禁实际执行通过：dev-cannon首轮-592904B≤1572864B；preview-cannon唯一一次复验211556B≤1048576B，2预热/30循环不变。跳过的是可选heap-diagnostics，不是正常门禁；原首轮失败保留。
- GitHub分支查询显示目标baseline未protected，适用rules API返回空列表，无最新提交必需CI要求，因此不因114951c的纯文档变化额外重跑合并前完整CI。
- 目标baseline现为U3静态合并提交 `e896cc0aafa8e4c8a77620c2a33a287f40bab378`。同步该基线仅在 `docs/UI_REQUESTS.md` 冲突；双方独立追加记录均完整保留。U3已签收源文件由Git直接合入，不手改界面；无B5规则调整，不rebase/force push。
- 基线同步使用追加merge commit；PR合并后对合并SHA运行完整默认CI，最终结果向用户汇报。合并后的CI不得用旧#124代替。原性能归因边界、未覆盖负载和另批玩法扩展继续保留。

## 批准合并执行结果与 baseline 验收（2026-10-09）

- 用户批准后，[PR #16](https://github.com/catfish-xn/cat/pull/16)已从Draft转Ready并合入指定目标 `feat/m8-b0-baseline`。合并方式为与B4/U4一致的merge commit，无squash/rebase/force push；合并提交 **`5bd7968ee31e107e12701145aa4fdac0bec7ea8d`**，双父提交为既有baseline `e896cc0` 与B5同步提交 `d20a3d3`。目标基线的U3静态实现通过Git原样整合，只在UI_REQUESTS文档保留双方追加内容解决冲突。同步后的typecheck/生产构建通过。
- 合并前确认：114951c相对最终审计HEAD e3af61b仅改交接文档；目标分支未protected、适用rules为空，无最新提交CI要求。正常堆门禁在已审计CI #124中实际执行且通过（dev -592904B≤1572864B、preview 211556B≤1048576B），未被跳过；跳过的是可选heap-diagnostics。该CI受测20551f2，与e3af61b可执行代码一致，无e3af61b独立run。
- 合并后单独启动[完整默认 CI #129](https://github.com/catfish-xn/cat/actions/runs/37898349556)，受测提交为精确合并SHA5bd7968，默认profile/heap_diagnostics/warmup_experiment均false。目标分支的现有CI不自动覆盖普通baseline push，因此使用既有workflow_dispatch；未改工作流、预算、断言或阈值。
- 合并后CI最终结果：**#129 / attempt1 completed/success，12/12必需作业首轮全部通过**；2个可选诊断按原配置skipped，无失败、无重跑、无未完成作业。覆盖测试/构建/headless/重复性能、六路线、两组输入、M6资源、M7、存储/性能/重试/应用失败及最终比较；不沿用旧#124代替本次验收。
- 已下载核对本次preview-cannon原始堆产物：heapDiagnostics=false、warmupExperiment=false，原2预热/30循环，heapDelta **-27340B≤1048576B**；listeners84→84、RAF1→1。dev-cannon作业也已成功。正常应用堆门禁并未跳过。最终比较实际执行通过：M5三路线各30场，182/178/172命令检查点一致；M6九份记录通过、dirty为空，全部命令exitCode0且attempt1，均绑定5bd7968和源码指纹 `569228e555692174f013be544796352fa6fdc8eafbd70fb75e785a36656d6cd8`。完整作业状态与比较产物哈希见 [合并验收证据](https://github.com/catfish-xn/cat/blob/feat/m8-b5/docs/evidence/M8_B5_MERGE_VALIDATION.json)。
- 性能首轮波动继续作为非阻塞跟踪项，原失败、前后本地超限与归因限制完整保留；不扩展装备玩法。此结果文档在B5分支登记，不改变已合并baseline的受测SHA，也不追加第二次合并。
