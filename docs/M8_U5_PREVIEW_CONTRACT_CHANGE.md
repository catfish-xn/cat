# U5 遭遇预览合同变更提案：UR-U5-01 / UR-U5-02

日期：2026-10-10 UTC。状态：**待用户批准；仅提案，不是冻结合同修订、代码交付或验收记录。**

## 1. 请求批准的范围

建议批准一次有限、加法式的 `EncounterPreview` 扩展：每个单位增加正式分类 `unitKind`、`monsterFamily`，`stats` 增加射程、攻击间隔、暴击率、暴击倍率、法强、开战法力和法力上限共七项。保留现有字段、查询签名、当前轮范围、纯只读与隐藏信息边界。

本提案依据固定 B7 基线 `87782695f864ba5d493d7a40c9c3652b48aacc86`，需求依据 `claude/u5-preview-requests` 的 `d3deb2fb8cf0d6e24131d65b32f2eb6ebd721000:docs/UI_REQUESTS.md`。预算参照文档提交为 `4c75a5692b6732f516ca542ad535985056573c49`；其中“预算等待批准”属于历史状态，最新指示已批准 **仅 M8 剩余范围的 1.30 倍 JS 上限**，并允许 U5 先沿用旧适配入口开工。该批准不等于批准本提案的冻结字段变更。

不包含 UR-U5-03 野怪图片、UR-U5-04 能力短名称、UI 布局/样式/实现、下一轮预告、新战斗规则或英雄说明删减。本次不编辑 `EncounterPreview`、源码、测试或原冻结合同；批准后才进入实现。

## 2. 原合同与具体差量

冻结类型位于 `src/simulation/m8/ui-contracts.ts`。当前顶层只有 `encounterId: string`、`units: readonly …[]`、`rulesNote: string`。单位已有 `unitId`、`definitionId`、`name`、`starLevel: 1 | 2 | 3`、`cell: HexCell`、`abilityDescription`，以及仅包含 `maxHp / attackDamage / armor / magicResist` 的只读数值 `stats`。现有 `readEncounterPreview(state): EncounterPreview | null` 不改签名；补给轮仍为 `null`。

### 2.1 拟议字段形状（示意，尚未写入类型文件）

```ts
import type { MonsterFamily } from '../content/neutrals';

// 以下仅列出 units[] 的新增部分；其他既有字段原样保留。
readonly unitKind: 'champion' | 'neutral';
readonly monsterFamily: MonsterFamily | null;
readonly stats: Readonly<Record<
  | 'maxHp' | 'attackDamage' | 'armor' | 'magicResist'
  | 'attackRange' | 'attackIntervalTicks'
  | 'critChanceBps' | 'critMultiplierBps'
  | 'abilityPower' | 'mana' | 'maxMana', number>>;
```

所有新增字段必填；不使用可选字段、`undefined`、字符串数字或 UI 猜测回退。英雄的 `monsterFamily` 明确为 `null`。沿用 `content/neutrals.ts` 已有 `MonsterFamily`，仅 `import type`，不复制一套 family 枚举，也不为类型导入引入运行内容。

### 2.2 分类语义

| 字段 | 类型与取值 | 唯一依据与约束 |
| --- | --- | --- |
| `unitKind` | `'champion' \| 'neutral'` | 冻结内容定义的分类；当前英雄目录未逐条标注时，在领域边界依据已验证英雄目录身份规范化为 `champion`，不得按 ID 前缀、名字或队伍判断 |
| `monsterFamily` | `MonsterFamily \| null` | 中立取 `NEUTRAL_DEFINITIONS[definitionId].monsterFamily`；英雄为 `null`；中立缺失/不一致应作为非法领域内容拒绝，不能回落为英雄 |

现有 family 值：`minion / krug / wolf / razorbeak / elder-dragon / rift-herald`。保持来自同版本冻结内容、与编译及恢复校验同源。`UNIT_DEFINITIONS` 中中立 `cost: 1` 是旧类型兼容占位，不是购买费用；本提案不新增 `cost`。消费者以正式分类决定是否显示英雄费用、职业等信息，不能再从占位值推断“1 费野怪”。family 分组只用于展示，不能替代领域的同伴集合或死亡规则。

### 2.3 新属性的单位与含义

| 字段 | 单位与合法值 | 精确语义 |
| --- | --- | --- |
| `attackRange` | 非负安全整数，六角格 | 当前轮开战输入中的射程；不是像素距离或半径估算 |
| `attackIntervalTicks` | 正安全整数，1 tick = 50 ms | 开战 `CombatUnit.attackIntervalTicks` 的整数间隔字段；不是当前剩余冷却，也不是战中攻速变化后的实时读数 |
| `critChanceBps` | 安全整数 0–10000；100 Bps = 1% | 开战权威暴击投影中的概率；适用于允许暴击的普通攻击，不意味着技能获准暴击 |
| `critMultiplierBps` | 安全整数，至少 10000；14000 = 1.4 倍 | 同一暴击投影的最终倍率，包括领域已核准的来源处理；不是额外增加 140% |
| `abilityPower` | 非负安全整数，法强点；100 为当前标准基础值 | 开战单位的法强字段，不是 Bps，也不是技能最终伤害 |
| `mana` | 非负安全整数，不大于 `maxMana` | 成功 `startMatchCombat` 返回的 tick 0 初始化结束后的法力字段；不是战中即时蓝量 |
| `maxMana` | 安全整数；中立 ≥0，英雄 ≥1 | 开战法力上限；中立合法为 `mana=0,maxMana=0`，不能用 1 占位 |

UI 可以作单位格式化，例如间隔显示为 `ticks × 50 ms`、暴击显示为 `Bps / 100 %`、倍率显示为 `Bps / 10000`；不再计算装备、羁绊、取整或暴击授权。若以 `20 / attackIntervalTicks` 展示每秒攻击次数，应标为按整数开战间隔换算值，不冒充原始内容攻速或实时攻速。此轮不增加另一个 `attackSpeed` 浮点数，避免两份权威值。

“完整开战属性”在本次只表示补齐请求列出的七项，不承诺护盾、伤害加成、吸血、技能暴击资格等所有战斗状态。也不把 Combat 中用于战中生效修饰的只读 `readCombatStats` 与此处开战字段混为同一接口。

## 3. 权威来源与实现约束

### 3.1 可直接复用的来源

当前查询已经调用 `buildStrategySnapshot(state)`，现有四项来自对应 `snapshot.units[].stats`，映射为 `health → maxHp`、`attack → attackDamage`、`armor`、`magicResist`。这四项名称、来源和语义不变。

新增 `attackRange / attackIntervalTicks / maxMana` 沿用同一解析单位的 `stats`；`abilityPower` 在同一个解析单位的 **`resolved.abilityPower`**，并不在 `resolved.stats` 内。`stats.initialMana` 是开战法力的输入，但不能无条件宣布等于完成初始化后的 `mana`。

完整权威链路是：

1. `getUnitStats / resolveUnitStats` 读取冻结定义和星级，`validateNeutralInputs` 校验中立 AS/crit/零蓝输入。
2. `buildStrategySnapshot` 汇集实际本轮单位、公开敌方装备与羁绊，调用 `resolveEffects`。不得在 UI 或查询中对每个英雄重新调用裸 `getUnitStats` 来替代这一步。
3. `startMatchCombat → createCombatWithEvents → snapshotCombat` 消费上述快照；中立经 `compileUnitInputs`，装备经 `compileItemCrit`，形成真实开战属性及暴击投影。
4. `applyCombatStart` 执行开战初始化，其中既有 `combatStart/gainMana` 钩子可改变法力；实际暴击读取统一经 `combat-s13-state.ts:spellCrit`，最终由 `authorizeSpellCrit` 提供概率/倍率与授权语义。

新中立的零修饰攻击间隔复用 `m8/stats.ts:attackInterval` 的 G01 整数运算，不能由 UI 从小数攻速重新计算，不能从已取整间隔反推基础 AS。基础暴击 2500/14000 来自冻结定义与 `compileUnitInputs`，不能在查询里硬编码一份；PvP 尤其不能忽略装备带来的暴击投影。

### 3.2 需要的小范围共享投影，不是第二套初始化

现有 strategy snapshot 尚未独立暴露最终 crit 投影，且初始化后 `mana` 可能不同于 `stats.initialMana`。因此批准后需提取/复用**真实开战路径已经使用的纯初始化投影**，由 Combat 创建与预览共同消费，至少覆盖分类、法强、初始法力和暴击输入。具体 helper 名称不冻结为 UI API。

- crit 必须复用 `compileItemCrit / authorizeSpellCrit / spellCrit` 的现有规则；可缩小它们的输入类型以共享所需字段，不复制公式、常量或来源计数逻辑。
- mana 必须复用实际开战法力初始化逻辑。若需要提取 `applyCombatStart` 的纯数值部分，应让真实路径与查询都调用同一函数，并用差分测试证明行为无变化；不能在查询另写一次钩子遍历和封顶算法。
- 每次查询只构建一次 strategy snapshot；不能逐单位重复解析全局装备/羁绊，也不先做一次完整 Combat 再做一次快照。
- 不在查询调用 `startMatchCombat`、推进 tick、运行整场战斗、生成掉落/临时装备或消耗种子；不为预览增加保存态缓存、回放事件或 ID。更不得依赖一次真实开战作为查询可用条件。
- 若单纯共享现有初始化不足以实现这里的语义，或必须重构超出这些有限字段，应先报告差异；不得以这份批准扩成规则重写。

### 3.3 时间与身份边界

预览始终指当前轮，在准备、战斗、结算阶段读取同一轮的开战输入，不因受伤、耗蓝、鸟同伴死亡叠层而变成实时面板；`nextRound` 后切换。不得从正在运行的 `state.combat` 直接摘取当前属性来填这些字段。终局若仍保留当前战斗轮，沿现有查询语义返回该轮公开预览；补给轮仍为 `null`。

`encounterId = pvp:<roundId>` 的身份约定已单独获准，保留为不透明显示身份。UI 不解析前缀，也不用它作素材键、掉落键或反向查询隐藏奖励；中立 `encounterId` 仍来自冻结遭遇目录。`definitionId` 和 `unitId` 各自身份不变。

## 4. 冻结合同增补映射

| 原依据 | 批准后拟补内容 | 不改变的边界 |
| --- | --- | --- |
| `M8_UI_CONTRACT.md` §4、`EncounterPreview` | 列明 2 个分类字段和 7 个属性字段，以及当前轮/开战初始化语义 | 查询签名、原字段与 `null`、仅公开敌军 |
| `M8_UI_CONTRACT.md` §1、§7 | 新字段只读、与真实开战同源及差分验收 | Match/Combat 唯一权威，查询不授予操作权限 |
| `M8B_CONTRACT_ADDENDUM.md` §4.1、IF-DEATH/IF-ENCOUNTER | 将既有内容分类映射到预览 | 同伴范围、死亡消费与 t+1 规则不变 |
| 同文 §4.5、IF-AS | 显式投影开战整数攻击间隔 | G01 公式、旧守卫边界、冷却不重置均不变 |
| 同文 §4.6、IF-CRIT | 显式投影最终概率/倍率 | G03 抽词、取整、技能资格与授权来源不变 |
| 同文 §4.7、IF-MANA | 显式投影合法 0/0 与初始化后法力 | G08 回蓝/锁蓝/施法规则不变 |

批准后以独立增补记录标明批准日期、范围与实现提交，再同步类型和相关合同引用；不能把本提案直接写成“已签收”。不因新增 UI 投影擅改运行内容 digest、规则版本或存档 schema；只有另有真实内容/状态变化才按原版本政策单独处理。

## 5. 消费者兼容性

- 原查询消费者只读取既有字段时，运行结构保持加法兼容；当前基线生产展示层尚无该查询的消费，已知消费者是 `tests/m8-b7-match-wiring.test.ts`，公共导出在 `match.ts`。
- 必填字段对 TypeScript 手写 `EncounterPreview` fixture/实现者属于需要补齐的编译变化；不能声称“对所有源码完全无破坏”。批准后检索消费者与精确 key 断言，补齐真实测试来源，禁止用 `as` 或 `any` 掩盖。
- 现有顶层 key 仍只有三个；嵌套单位和 `stats` 的精确 key 断言需要按已批准名单更新。旧四项逐值保持一致。
- U5 在等待批准期间可继续已获准的旧适配读取。新字段正式交付时由 Claude 切换分类和新增属性来源，撤除该处裸定义补值；本提案不代改 UI，也不提前解除 PvP 暂只展示四项的限制。
- 查询结果是临时只读投影，不存入 Match/save/replay，不引入历史文件迁移；原有恢复真实性测试仍必须通过。

## 6. 批准后计划验收

1. **类型与形状**：新增字段必填、全为安全整数，冻结返回对象及嵌套对象；不出现 `undefined`。英雄 family 必须 null，中立为合法枚举；旧四项和全部既有身份/文本不变。
2. **分类全量**：遍历 8 场 PvE 的 25 个实例，与独立 ENCOUNTERS fixture 的定义/family/成员核对；遍历所有 PvP 模板均为 champion/null。测试不从预览自身生成 expected。
3. **开战差分**：同一合法准备状态，先读预览，再通过公开 `startMatchCombat` 开战，用稳定 unitId 对齐 tick 0 敌军。七项与相应 `CombatUnit` 字段、`spellCrit(unit).chanceBps/multiplierBps` 对齐；注意 CombatUnit 没有与预览同名的两个顶层 crit 字段。
4. **装备/羁绊覆盖**：至少一场后期带装备与羁绊的 PvP，建议覆盖全部三类模板及星级变化；证明不是裸 `getUnitStats` 的偶然等值。另以既有领域单元测试入口检验装备 crit 和 combatStart 法力钩子的共享函数差分，不篡改生产敌军模板以造样例。
5. **独立数值锚**：远程小兵 range=3、龙/先锋 range=2；新中立 crit=2500/14000、AP=100、mana/maxMana=0/0；AS 6000 对应 34 tick、8000 对应25 tick、10000 对应20 tick。旧守卫 0 基础暴击边界仍保留。
6. **时间边界**：准备→战斗→结算及 nextRound 后核对当前轮身份；战中耗蓝、受伤、叠攻速不改变开战预览含义；补给轮为 null，PvP ID 不被当作资源或奖励身份。
7. **纯度与信息边界**：重复查询前后序列化 Match、全部 RNG state/draws、事件/收据/资源/ID 分配一致；快照只含批准字段，不泄漏 loot plan、fallback、随机词或未揭示奖励；查询结果不可反向修改 state。
8. **回归与预算**：运行 typecheck、相关 B7/Combat/crit/mana/恢复测试和 production build；共享 helper 提取需证明真实开战与原实现结果一致。UI 交付后的桌面展示验证由后续接线验收覆盖；本提案不宣称上述测试已执行。

## 7. 字节影响预期与测量计划

TypeScript 类型扩展及 `import type` 本身预计为 0 运行字节；实际增量来自属性赋值、分类规范化和有限共享初始化投影。由于新代码尚未获准实现，**没有新字段的实际 build 数据**。在复用现有已可达规则函数、无需新目录/依赖库的前提下，先按 **约 +0.3–1.5 KB（十进制 300–1500 B，gzip9 净量）** 预留这两项领域扩展；这是粗粒度规划范围，不是承诺、精确预测或独立配额。若共享初始化提取导致更大的可达依赖，须据实复测并解释，不能拿估值当通过门禁的证据。

必须分开以下两次既有实验，不相加，也不称为同一测量：

- Claude 在 UR 文档报告：Node 22.22 / zlib 1.3.1，基线 485,743 B，仅让 `readEncounterPreview` 可达后 487,353 B，**+1,610 B**。本提案引用该报告，未重新复现实验。
- 预算规划固定探针：Node 22.23.3 / zlib 1.3.1-e00f703，`readEncounterPreview + readRoundInfo` 可达探针，485,743 → 487,400 B，**+1,657 B**。该结果包含诊断入口绑定和整包压缩交互。

上述首次可达开销已经属于 U5 预算；本节 300–1500 B 是在“相同查询已可达”条件下新字段的增量预期，不能再次计一遍首次导入。最终不能简单把各独立 gzip 增量算术相加当成已测总量。

批准后用相同 Node/zlib/lockfile、同样查询可达方式，在固定前后提交分别 production build，按 `m7-budget` 口径逐个 `dist/assets/*.js` gzip level 9 求和，记录 SHA、工具链、总量、净差和依赖变化；再测最终 U5 整合树。1.30 相对签收 M7 的现有 factor 口径只覆盖 M8 剩余工作，其他性能/容量门禁不变，不是扩大 UR 范围的授权；M9 必须重新评估。

按最新批准的批次控制，U5 中央规划为 **4,500 B**；最终整合树相对 U5 前固定基线的实际 JS gzip 净增量若 **超过 5,850 B（中央值的 130%）**，必须停止并向用户报告，等待决定，不能因总包仍低于 1.30 上限而继续。本提案 UR-U5-01/02 的新字段与共享投影成本全部计入 U5 净增量，300–1500 B 仅用于解释其中一部分，**不是独立追加额度**。

## 8. 决策与后续

请批准或调整：**仅 UR-U5-01/02 的 2 个分类字段和 7 个数值字段，以及本提案明确的开战字段语义、共享权威路径和验收边界。** 推荐按此有限范围批准；如暂不批准，继续保持冻结类型，U5 沿已授权旧适配路径推进。

批准后 dot 先提交合同增补与最小领域实现/测试供复审，再向 Claude 交付可消费字段与语义。U5 的视觉接线、图片和能力名称各按原职责与后续独立授权处理。

## 来源索引

- [请求 d3deb2f：UR-U5-01/02、范围与测量记录](https://github.com/catfish-xn/cat/blob/d3deb2fb8cf0d6e24131d65b32f2eb6ebd721000/docs/UI_REQUESTS.md)
- [冻结 UI 合同](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/docs/M8_UI_CONTRACT.md)
- [冻结预览类型](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/m8/ui-contracts.ts)
- [M8B 合同增补](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/docs/M8B_CONTRACT_ADDENDUM.md)
- [现有只读预览](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/encounter-selectors.ts)
- [Strategy snapshot](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/strategy-snapshot.ts)
- [Combat 初始化](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/combat.ts)；[开战钩子](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/combat-effects.ts)
- [中立内容与 MonsterFamily](https://github.com/catfish-xn/cat/blob/87782695f864ba5d493d7a40c9c3652b48aacc86/src/simulation/content/neutrals.ts)
- [预算规划与 1657 B 探针](https://github.com/catfish-xn/cat/blob/4c75a5692b6732f516ca542ad535985056573c49/docs/M8_REMAINING_JS_BUDGET_PLAN.md)
