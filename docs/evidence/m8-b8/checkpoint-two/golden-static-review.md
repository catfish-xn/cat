# B8 golden 失败的只读静态诊断与后续 guarded 迁移方案

受检工作区：`/workspace/scratch/2d61d723fa5a/cat-b8-phase2`。受检 HEAD：`6484a53c55d5199270fc7822df5ca58c2796819f`。本次没有修改 src、tests、scripts、golden 或任何受测文件；只读源码、历史和已有日志，并运行一次 Vite SSR `createMatch(42)` 与独立 oracle 的纯 `lootPlan(42,38)`。没有运行四构筑全程，避免与仍在执行的固定 HEAD 全量竞争 CPU。

## 1. 现有失败准确说明什么

- `scripts/verify-m5-browser.cjs` 先执行 `generateRoute({build,seed:42,retainStates:true})`，再调用 `assert-golden.cjs`，随后才保存 route/ledger、启动 Vite 和 Chromium。因此在 `golden contentDigest` 处失败表示生成器已返回且其逐步独立 oracle 没有抛错，但本 job 尚未执行真实浏览器输入或验证浏览器状态。它不是浏览器已通过，也不是浏览器行为回归的证据。
- `assert-golden.cjs` 的顺序是全部 versions、seed、完整 command transcript、全部 round/stateHash/eventsHash。当前只能首先看到 digest 不匹配，其余检查未执行，不能将未执行检查称为通过或“只差 digest”。
- 本机当前 `createMatch(42)` 实测 contentDigest 为 `fnv1a32-utf16:314b4c1f`；现 golden 为 `fnv1a32-utf16:c8a4b6d9`。
- 其余版本仍为 schemaVersion=5、rulesVersion=`m5-14.24b-v1`、contentVersion=`s13-14.24b-slice-v1`、commandProtocolVersion=2、rngAlgorithm=`lcg32-v1`、tickMs=50。`src/persistence/format.ts:15` 仍要求 saveFormatVersion=1、replayFormatVersion=1。没有 schema6/save2/replay2 的迁移授权或实现。

## 2. 精确档案来源，不能拿错 baseline

现 `tests/fixtures/m5/full-match-golden.json` 最后修改提交是 `ff60a7989ad76052c9720fe58546cc70842b316c`，该提交至当前 HEAD 字节完全一致；checkpoint-one 签收基线 `4554f5a` 也包含完全相同字节。

本次应保存的 **B8 之前现行 golden** SHA256：

`007b6b4136d6959b227cbd9567948f83dca75db4ad788fd43d03c4e3cf069cc5`

若后续获准迁移，可新增 `full-match-golden.pre-m8-b8.json` 保存以上字节；本次没有创建或改写该档案。

已有 `full-match-golden.pre-m8-b7.json` 的 SHA256 是 `983806603e27718f263d280c0a4fd42740226bca1e56163f9b5d214ef8ec5fac`。它是 B7 updater 使用的旧 947/B6-placeholder 基线，**不是本次 B8 的直接来源**。该旧档案及历史说明必须继续保留，不覆盖、不重命名为 B8 来源。

现 B7 golden 四构筑（均 seed42、33战）命令数依次为 cannon 158、sniper 160、mage 157、sniper-caitlyn 163。历史观测为各38轮、victory、formedBattles=0、schedule 组件授予5。B7 updater 固定要求旧命令逐条相同；B7独立双树对比曾证明经济/HP/XP/日程奖励/四个 Match RNG 每命令相同，变化主要来自八场 PvE 与 cannon 后续 Tristana 成长。此 B7 证明不能继承为 B8 的语义证明。

## 3. 差异分类

### A. 版本属性变化

只在 versions 对象里，当前已证实变化的是 contentDigest。其输入新增 `loot` 整包：runtime revision、freeze 算法、policy、hero pools、slots、categories；`ROUND_PREPARATION_RULES` 也从 B7 的 preparation/contentStatus 更新为 `m8-b8-preparation-v1` / `ready-b8-loot`。因此 digest 应变，不能回退常量、删掉 loot digest 输入或加测试模式逃避它。

但“versions 仅 digest 变化”绝不等于“状态只变 digest”。

### B. 纯状态/证据结构的新增

初态已具有真实 `m8.loot` 冻结计划与进度、`resourceProvenance` 开局 Irelia 出生，以及 `combatInputBasis:null`；首战后还会有 basis、成长提交、掉落资格/收据等。roundResults 新增 `combatEventCount`。这些即使不改变某一次伤害，也会使完整状态不等。不得在正式 golden 断言中统一去掉这些字段，也不能仅替换 contentDigest 后声称完整 hash 等价。

### C. 实际资源与命令变化

默认入口已直接接入真实奖励：1-2 Maddie，1-3 Lux及自选，1-4自选，2-7/3-7/4-7/5-7随机组件+自选+额外类别，6-7固定5G。收据仅在对应怪物真实死亡且实际授予后成立；这是资源变化，不是标签变化。

只读运行独立 `lootPlan(42,38)` 得到：随机组件 belt/rod/sword/vest；六个预冻结 fallback sword/tear/cloak/bow/belt/cloak；四个额外槽均为1/2/3/4G，连同6-7共15G；完整 loot RNG 14 draws、最终 state=1259077867。这是冻结计划，不冒称四条实际路线都已赚取全部奖励。seed230 的已有独立报告则覆盖四个 hero tiers，不能拿来替代 seed42 四构筑验收。

同一个未修改的 command-only driver 会根据真实单位/金币/物品状态决策，因此会出现新的 loot select、单位出生 serial变化、升级/购买/出售/合成/装备/布阵变化，以及可能不同的 XP/商店重刷次数。四构筑新 transcript 的确切长度与首次差异仍待实测，不应沿用 B7 的“全部命令必须等于旧档”前提，也不能允许任意差异。

### D. 事件、RNG、经济与战果变化

- 新的 lootRevealed/lootGranted/lootChoiceResolved/lootForfeited/choiceOpened 进入 Match 完整事件账本，改变后续 Match eventSeq；即使某轮 combat-only events 完全相同，其包含 Match events 的完整 eventsHash 也可能不同。
- 真实新单位、装备、星级与布阵会改变之后真实战斗输入，进而改变战斗事件、消耗战斗 RNG 的轨迹、存活者、tick与成长。不能把这些自动全归因为 digest，也不能将全部事件差异直接作为“必然正确”。
- loot 使用独立冻结 RNG，不应直接偷用 shop/choice/reward/battle-seed 流；原 oracle 正在逐命令验证这些旧流的消耗规则。命令数量/种类改变之后旧流的最终状态可能间接改变，不能将不同 action index 强行作同位比较。battle seed 在相同33场 start 下应按旧规则保持恰好33次推进；各其它流须由实际命令/事件推导。
- 掉落金币先于结算利息，可能改 interestBasis、利息收入及 investment growth；掉落英雄不能折金币。结果差异必须由资源、战斗和原经济规则解释。固定seed42各构筑是否仍 victory、38轮、33战，formed/bound/Caitlyn等数量，本次静态诊断不能替实测盖章。

## 4. 安全 guarded 迁移步骤（仅方案，尚未实施）

1. **先解条件再写文件。** 当前预算仍超线；本次只读方案维持未完成。既有缺陷修复授权允许在严格前置条件下另做独立 golden 适配，但不能为了报告绿灯立即刷新 golden。无需也不得修改正式 schema/格式版本。
2. **冻结旧档和输入。** 检查现文件 SHA256 精确等于上述 `007b...`，另存 pre-m8-b8 字节并再次核验；绑定 old/new HEAD、tree、Node/dependency/config、generator、oracle、assert与skip文件hash。当前 `sourceFingerprint()`不包含tests/scripts，应额外绑定这些文件。若来源hash或任何受测文件变化，拒绝写入。
3. **复现旧档。** 建议用默认live之前签收基线4554f5a（或另一已证明等价的精确树），使用该树自己的原 oracle 和同一依赖逐条重放四构筑。必须复现全部旧 commands与132个完整state/event hashes才接受其为比较树。不能拿当前B8 oracle强喂不含loot的旧Match；不能假设文件hash相同就等于旧轨迹已实测复现。
4. **独立规则前置验证。** 保留c4fd5da的独立oracle与反例验证，不将生产grant/economy/RNG helpers导入oracle作期望。四条当前seed42路线必须全部通过逐步独立gold/card/item/serial/receipt/source-death/choice/settlement/RNG/event-sequence校验；必要B8专项保留。此前seed42/230 cannon证据不代替另外三条。
5. **两份原始路线与结构化差异。** old/new分别输出完整route、ledger和source manifest；按roundId/语义命令对齐，记录每轮购买/出售/升级/loot/select/合成/装备差异、完整资产来源、经济/HP/XP/growth、每条RNG流、combat-start输入、combat-only与Match-only事件首差异、完整hash差异。输入相同时combat差异应有明确解释；输入不同则给出可追溯的资源/命令因果链。分类未知差异必须停止，不靠宽泛字段忽略名单通过。
6. **硬条件不下降。** 四条路线仍须原有gameOver/victory/38轮/33战，三个标准构筑boundBattles>=2、三强化/异常、真实四来源>=2战、正常升级/锁店，以及Caitlyn>=2真实参战/施法/伤害等现有断言。版本对象除已审核digest外完全一致；initial经济/Irelia、目录38/33、八个B7 roster、固定数值/阈值、命令失败原态不耗资源不推进RNG保持。若不满足，记录为真实问题，不能改路线刷出想要结果或顺便改数值。
7. **审核后冻结新 transcript/hash。** B7 updater的“新命令=旧命令”不适用，应由独立审阅的具体差异与完整新 transcript替代，而非删掉正式assert。先生成候选到临时目录，重复固定当前树确认确定性；全部前置检查/差异审批通过后才一次性更新四条版本、commands和round hashes，添加明确B8历史说明。任何失败不得部分写golden；不覆盖旧B6/B7历史观测，也不把它们标成当前。
8. **复跑原 gates。** `assert-golden.cjs` 保持原样，重新执行现有unit/headless/browser/compare路径，真实浏览器失败另行诊断。golden匹配只说明冻结轨迹一致，不证明B8完整功能、浏览器容量、预算或性能已过，也不自动解除B8/B9延期。

## 5. 必须原样保留的 assert / skip

- `assert-golden.cjs` 的versions/seed/完整commands/完整round-state-event检查，不加digest忽略、不改hash范围、不跳过新事件。
- `tests/m5-route.test.ts` 原非skip结果、四来源、Caitlyn、三强化/异常、38轮33战、升级、终局失败原态和新局确定性检查。
- `tests/m5-route.test.ts` 四个 `[B8] complete-build battles and full component grant chain` skip，`verify-m5-headless` formedBattles>=3延期，以及input runner现有opening-component/Rageblade skip保持。不增加skip，不把skip报passed。
- 特别是旧15组件skip内用的是`final.scheduleReceipts.reduce(...)=15`，而正确新B8应为10个LootReceipt组件+5个ScheduleReceipt supply组件；旧断言表示历史依赖与旧存储形状。此次不改它，正式解除B8延期时需要独立审阅的计数语义迁移，绝不能伪造ScheduleReceipt、把15降成5、或声称旧body已通过。
- B9 30战应用容量保持；只允许6-5/6-6/6-7尾部及完整应用路由的已有精确延期；`b6DeferredBrowserRounds`、`validateB6BrowserBoundary`、manifest不可把fullApplicationRoutePassed设true来掩盖未跑。禁止扩大遗漏集或把领域证据冒充浏览器证据。
- 不改CI job路径、原性能/heap/bundle预算、重试策略、内容数值与其它历史golden。

## 6. 尚未知 / 待实测

1. CI180 mage之外其余三构筑新路线的确切command transcript/hash、变化轮次及因果分类；本次不从首个digest错误推断后续全部匹配。
2. 所有四条的victory/38/33、formed/bound、Caitlyn计数和四来源条件是否满足。
3. 各route实得完整10loot+5supply组件、15G及其具体授予时序，是否有forfeit/pending-capacity/terminal-retained，以及上述冻结计划是否全部兑现。
4. 各route真实资源/买卖/重刷、XP/金币/血量/成长、所有旧RNG流终态、战斗输入及combat-only事件差异。计划和源码只能说明可能/应有机制，不能替代实际数字。
5. 前默认live树复现现行golden的本次实测、所有新state restore与真实浏览器全现有非延期区间、最终固定SHA全量结果、budget现值和外部审计。

结论：这是已批准默认B8规则启用后尚未完成的轨迹golden适配；首个digest失败有合理明确来源，但迁移绝不只改digest。当前可以诚实记录为golden未迁移/后续checks未执行的阻塞，不能称验收通过。
