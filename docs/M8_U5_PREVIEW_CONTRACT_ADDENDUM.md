# U5 遭遇预览有限合同增补：UR-U5-01 / UR-U5-02

批准时间：**2026-10-10 00:31 UTC**。状态：**已获有限实施授权；实现验收、Claude 独立审计及用户合并批准须另行记录。**

授权依据为 [U5 遭遇预览合同变更提案](M8_U5_PREVIEW_CONTRACT_CHANGE.md)。本增补只落实该提案的 2 个分类字段和 7 个属性字段，不是对 B2、M8B 或其余 U5 范围的普遍解冻。对应 [M8_UI_CONTRACT.md §4.1](M8_UI_CONTRACT.md#41-u5-遭遇预览有限增补2026-10-10)；提案引用的固定 B7 基线为 `87782695f864ba5d493d7a40c9c3652b48aacc86`，需求记录为 `d3deb2fb8cf0d6e24131d65b32f2eb6ebd721000:docs/UI_REQUESTS.md`。

## 1. 唯一批准的类型差量

类型入口为 `src/simulation/m8/ui-contracts.ts` 的 `EncounterPreview`。下列只列出 `units[]` 的新增分类与扩展后的 `stats`；所有既有字段保持原样。

```ts
import type { MonsterFamily } from '../content/neutrals';

readonly unitKind: 'champion' | 'neutral';
readonly monsterFamily: MonsterFamily | null;
readonly stats: Readonly<Record<
  | 'maxHp' | 'attackDamage' | 'armor' | 'magicResist'
  | 'attackRange' | 'attackIntervalTicks'
  | 'critChanceBps' | 'critMultiplierBps'
  | 'abilityPower' | 'mana' | 'maxMana', number>>;
```

- 全部新增字段必填；不用可选字段、`undefined`、字符串数字或 UI 猜测回退。数值字段必须满足 §3 的安全整数边界。
- 顶层仍只有 `encounterId / units / rulesNote`；单位原有 `unitId / definitionId / name / starLevel / cell / stats / abilityDescription` 的名称、身份、文本与语义不变。
- 原四项 `maxHp / attackDamage / armor / magicResist` 继续来自同一次 strategy snapshot 的 `health / attack / armor / magicResist`，逐值不变。
- 保留 `readEncounterPreview(state): EncounterPreview | null` 的签名和公开敌军范围；补给轮仍返回 `null`。
- 不新增 `cost / attackSpeed / abilityName / image` 等字段，不扩展其他查询。必填字段会要求手写 TypeScript fixture 或实现者补齐，因此只承诺旧字段读取的加法兼容，不声称所有消费者源码无需调整。

## 2. 正式分类

| 字段 | 精确语义 |
| --- | --- |
| `unitKind` | 只允许 `champion` 或 `neutral`，依据冻结内容定义的正式分类。英雄目录未逐条声明时，只可在领域边界依据已验证英雄目录身份规范化为 `champion`；不能按名字、ID 前缀、队伍或费用推断。 |
| `monsterFamily` | 英雄必须为 `null`；中立必须等于同版本 `NEUTRAL_DEFINITIONS[definitionId].monsterFamily`。中立缺失或不一致按非法领域内容拒绝，不能静默回落为英雄。 |

`MonsterFamily` 直接引用 `src/simulation/content/neutrals.ts` 的已有类型，只作 `import type`，不复制另一套枚举或借此引入运行内容。现有 family 为 `minion / krug / wolf / razorbeak / elder-dragon / rift-herald`；同版本内容、编译和恢复校验保持同源。

`UNIT_DEFINITIONS` 中中立 `cost: 1` 只是旧类型兼容占位，不表示可购买或真实费用。消费者按正式分类决定英雄费用、职业等展示，不从占位费用推导“1 费野怪”。family 分组只提供展示分类，不替代领域同伴集合、死亡触发或 t+1 规则。

## 3. 七项开战属性

| 字段 | 单位与边界 | 权威语义 |
| --- | --- | --- |
| `attackRange` | 非负安全整数，六角格 | 当前轮开战输入的射程，不是像素距离或 UI 半径估算。 |
| `attackIntervalTicks` | 正安全整数，1 tick = 50 ms | 开战 `CombatUnit.attackIntervalTicks` 的整数间隔，不是剩余冷却，也不是战中攻速变化后的实时数值。 |
| `critChanceBps` | 安全整数 0–10000，100 Bps = 1% | 真实开战权威暴击投影的最终概率；普通攻击按既有资格消费，不意味着技能获准暴击。 |
| `critMultiplierBps` | 安全整数 ≥10000，14000 = 1.4 倍 | 同一暴击投影的最终倍率，包含既有合法来源处理，不是额外增加 140%。 |
| `abilityPower` | 非负安全整数，法强点 | 开战单位法强，当前标准基础值为 100；不是 Bps 或技能最终伤害。 |
| `mana` | 非负安全整数，≤`maxMana` | 成功 `startMatchCombat` 返回的 tick 0 初始化结束后的法力，不是无条件使用 `stats.initialMana`，也不是战中即时蓝量。 |
| `maxMana` | 安全整数；中立 ≥0，英雄 ≥1 | 开战法力上限；中立合法 `mana=0,maxMana=0`，不能用 1 占位。 |

`attackRange / attackIntervalTicks / maxMana` 来自同一解析单位的 `stats`；`abilityPower` 来自该解析单位的 `resolved.abilityPower`，不在 `resolved.stats` 内。`stats.initialMana` 是初始化输入，开战钩子可以改变最终 `mana`。crit 的最终对照为 `spellCrit(unit).chanceBps / multiplierBps`；`CombatUnit` 不存在与预览同名的两个顶层 crit 字段。

UI 仅做单位格式化，例如 `ticks × 50 ms`、`Bps / 100 %`、`Bps / 10000`。若用 `20 / attackIntervalTicks` 显示每秒攻击次数，必须表明是整数开战间隔的换算，不冒充原始内容攻速或实时攻速。UI 不重算装备、羁绊、取整、暴击来源或技能资格。本增补的“完整开战属性”仅指这七项，不承诺护盾、吸血、伤害加成或所有战斗状态，也不改变 `readCombatStats` 的职责。

## 4. 同源初始化与纯度

1. `getUnitStats / resolveUnitStats` 读取冻结定义和星级；中立 AS、crit 与零蓝输入仍经已有内容校验。
2. 每次查询只调用一次 `buildStrategySnapshot(state)`，统一解析实际本轮单位、公开敌方装备和羁绊并执行 `resolveEffects`。不逐单位重建全局快照，不用裸 `getUnitStats` 替代已解析结果。
3. 新字段复用或有限提取真实 `startMatchCombat → createCombatWithEvents → snapshotCombat / applyCombatStart` 路径的纯初始化投影，实际开战与查询共同消费；helper 的内部名称不成为新的 UI API。
4. crit 复用 `compileUnitInputs / compileItemCrit / authorizeSpellCrit / spellCrit` 的既有规则，允许缩小共享函数输入类型，不复制公式、常量或来源计数。新中立的 G01 整数攻击间隔复用已有 `m8/stats.ts:attackInterval`，不从小数攻速在 UI 重算，也不从已取整间隔反推基础 AS。
5. mana 共用实际 `combatStart/gainMana` 初始化的纯数值逻辑及封顶规则。提取时真实路径也必须消费它，并以差分检验证明行为未改变；禁止查询另写一遍钩子遍历或封顶算法。

查询结果是临时、递归只读且冻结的快照，不能反向修改 Match。查询不调用 `startMatchCombat`、不创建完整 Combat 再另取快照、不推进 tick、不运行战斗、不生成掉落或临时装备，不消耗任何种子或 RNG 词，不分配持久 ID，不修改事件、收据、资源或状态。不为它增加保存态缓存、回放事件或初始化的前置开战条件。

若共享已有初始化无法满足本增补，或实现必须扩大到这些字段以外的重构，应先报告差异并等待决定；此授权不覆盖第二套初始化或规则重写。

## 5. 当前轮、身份与信息边界

准备、战斗、结算阶段都显示当前轮的开战输入；`nextRound` 后才切换到下一轮。受伤、耗蓝、同伴死亡叠层等不会把预览变成实时面板，不能从正在运行的 `state.combat` 直接摘取当前属性代替。终局若保留当前战斗轮，沿已有查询语义返回该轮公开预览；补给轮仍为 `null`。

中立 `encounterId` 来自冻结遭遇目录；PvP 保留已获准的 `pvp:<roundId>` 身份约定，并视为不透明标识。消费者不得解析前缀、拿它当素材键或掉落键，或反向查询隐藏奖励。`definitionId` 与 `unitId` 各自身份、原部署 `cell` 和既有文本均不改变。

仅包含允许公开的敌军数据；不暴露 loot plan、fallback、随机词或尚未揭示奖励。查询结果不写入 Match/save/replay，不引入历史迁移。本次不改变战斗规则、内容数据、规则版本、内容 digest、存档 schema 或保存／回放格式；若发现必须改变这些内容，应另提范围与版本依据。

## 6. 与冻结合同的对应关系

本节只引用既有 M8B 依据，**不修改 `M8B_CONTRACT_ADDENDUM.md`**，也不据此重新签收其中任何 IF 任务。

| 原合同 | 本增补的投影 | 保持不变 |
| --- | --- | --- |
| [M8_UI_CONTRACT](M8_UI_CONTRACT.md) §1、§4、§7 | 2 个正式分类和 7 个开战数值、只读与真实开战同源验收 | Match/Combat 权威、查询签名、旧字段、`null`、隐藏信息边界、查询不授予操作权限。 |
| [M8B_CONTRACT_ADDENDUM](M8B_CONTRACT_ADDENDUM.md) §4.1、§8.2 的 IF-DEATH / IF-ENCOUNTER | 公开已存在的中立分类和 family | 冻结同伴范围、完整死亡批次、去重、t+1 时序以及真实中立内容编译。 |
| 同文 §4.5、§8.2 的 IF-AS | 开战整数攻击间隔 | G01 运算顺序、旧守卫整数边界、剩余冷却不重置。 |
| 同文 §4.6、§8.2 的 IF-CRIT | 开战最终 crit 概率和倍率 | G03 抽词、取整、普通攻击／技能资格、授权来源与旧守卫 0 概率。 |
| 同文 §4.7、§8.2 的 IF-MANA | 初始化后法力及合法 0/0 | G08 回蓝、锁蓝、溢出、施法完成与非法输入拒绝规则。 |

本次不包含 UR-U5-03 野怪图片、UR-U5-04 能力短名称、任何 UI 布局／样式／接线实现、下一轮预告、英雄说明删减或其他字段扩展。Claude 后续消费这些字段仍按各自职责和授权执行。

## 7. 必须完成的验收与审计门槛

下列是验收要求，**不是已执行或通过的结果**。实际命令、提交 SHA、结果和证据由独立验证记录提供。

1. **形状与分类**：精确 key 只增加批准字段，必填且无 `undefined`，对象及嵌套对象冻结；全部新增数值符合安全整数边界。遍历 8 场 PvE 的 25 个实例，与独立 ENCOUNTERS fixture 核对定义、family 和成员；所有 PvP 模板均为 `champion/null`。不由预览自身生成 expected，不用 `as` 或 `any` 掩盖 fixture 缺字段。
2. **真实开战对照**：从同一合法准备状态先读预览，再调用公开 `startMatchCombat`；按稳定 `unitId` 对齐成功返回的 tick 0 敌军，将七项逐项与实际 `CombatUnit` 及 `spellCrit(unit)` 对照。只测纯 helper、裸定义或另造 Combat 不能替代这项真实入口验收。
3. **非裸值覆盖**：至少覆盖带装备和羁绊的后期 PvP，并覆盖相关模板／星级；另从已有领域单元测试入口验证装备 crit 和 `combatStart` 法力钩子共享逻辑，不篡改生产敌军模板造样例。共享提取前后的真实开战结果须有行为无变化的差分证据。
4. **独立数值锚**：远程小兵射程 3，龙／先锋射程 2；新中立 crit=2500/14000、AP=100、mana/maxMana=0/0；AS 6000/8000/10000 对应 34/25/20 tick，旧守卫基础 crit=0 的边界保留。
5. **时间与纯度**：准备→战斗→结算、`nextRound` 和补给轮符合 §5；战中受伤、耗蓝或叠攻速不改变开战语义。重复查询前后 Match 序列化、全部 RNG state/draws、事件、收据、资源和 ID 分配相同，无隐藏掉落或奖励泄漏，返回值不能反向修改状态。
6. **回归**：运行 typecheck、相关 B7／Combat／crit／mana／恢复测试和 production build，说明未执行或受阻项。原字段逐值、身份、技能说明和 rulesNote 保持不变；原恢复真实性要求仍须通过。
7. **独立审计与合并**：把合同增补、完整实现差量、真实开战测试和实际 gzip 对比交 Claude 独立审计合同与实现。审计问题处理并复核后，向用户汇报，再取得明确合并批准；当前实施授权不含合并，也不表示 Claude 已审计。

## 8. 实测预算要求

必须分别给出两组真实 production build 对比，不能用类型零字节、tree shaking 推测或规划估值代替结果：

- **普通入口前后树**：固定基线与实现后树用原生产入口构建，记录实际 JS gzip9 总量和净差；即使差量为零也如实报告，不据此声称新增查询运行成本为零。
- **匹配可达条件前后树**：固定基线与实现后树使用完全相同的查询可达探针，使 `readEncounterPreview` 可达；若探针也包含 `readRoundInfo`，两侧必须一致。测量新字段／共享投影的实际净差，并说明首次可达开销和压缩交互，不能混用不同探针。

两组均按 `m7-budget` 口径对 `dist/assets/*.js` 逐文件 gzip level 9 后求和，使用相同 Node、zlib、lockfile 和构建方式，记录各侧 SHA／未提交差量标识、工具链、总量、净差及依赖变化。诊断探针不进入正式运行入口；最终 U5 整合树另按同口径实测，不把各次 gzip 净差简单相加冒充整包实测。

提案中的 **300–1500 B** 只是新字段成本的历史规划估值；此前 **+1610 B** 与 **+1657 B** 是不同可达探针的历史测量，不能当作本次实际交付结果，也不能相加。只限 M8 剩余范围的 JS 总上限仍为已签收 M7 基线的 **1.30 倍**，不扩大其他门禁或 M9 授权。

U5 中央规划仍为 **4500 B**，最终整合树相对 U5 前固定基线的实际 JS gzip 净增量若 **超过 5850 B**，必须停止、报告并等待用户决定，即使总包尚低于 1.30 上限。本次分类、新属性及共享初始化成本全部计入 U5，估值不是独立追加额度。
