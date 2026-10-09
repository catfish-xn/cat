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
- 定向 `npm test -- tests/m8-b5-queries.test.ts tests/m8-b5-instances.test.ts tests/inventory.test.ts tests/upgrades.test.ts`：4文件/84测试通过。预览测试新增6项，其中包含125组跨phase合成和875组穿戴组合检查。
- 本阶段不新增状态、不更改存档格式、目录版本、规则修订或digest（仍 `db25532e`）；阶段1的四项界面枚举授权仍待回复，不能声称build通过。

下一步：第3阶段在可编辑模块中接G12，保留独立equipment stream与roll账本，给Match/快照/来源/恢复/查询接线；同一批完成新态严格局部校验和保存恢复。不得修改G12及冻结合同。
