# PR168 公开夹具迁移：部分完成，仍不可签收

## 固定版本与范围
- 分支 `codex/restore-fix-batch-b`；合并代码 SHA `32849209f4a6c4aa100ee9796ad4732209492314`。
- 合并父：`e6d9725654c643edec2d17293878783aac2974a5`、`0719ced60ade353a238024d757cf9440701f6aaa`。
- 合并验证证据 SHA `18d81a359f92b4067ed7500515df1f8ee4d37ab4`；完整冲突解决、19文件/333项逐例证据见 [此前报告](../latest-multiplayer-sync/REPORT.md)。
- 本轮测试构造代码 SHA `cd9b83b1ed2344557acbc666b8f3a9fa64f0d95c`，仅 `tests/g2-4a-crown-history.test.ts`。无生产代码、原断言、数值、版本、门槛修改。
- 两种重铸器输入改为 seed26 真实公开路线已有库存；成装缺失时公开 combineItems。保留所有原先对象/JSON/历史入口与逐 tick 续战断言。

## 实测
`npm test -- tests/g2-4a-crown-history.test.ts --reporter=default --reporter=json --outputFile=/tmp/b-public-crown-file.json`
完整文件 56 项，8 通过、48 失败、0 跳过。此前同文件4通过/52失败，本次4项转绿；并未整体通过。
- component-reforger 正控 2117.075 ms；completed-reforger 正控1598.320 ms。
- 两种命令 tick 篡改负例812.920/783.906 ms通过。
- 两种资源 tick 篡改仍拒绝，但先报 preparation-ledger-state-resourceProvenance，与原预期历史拒因不同，因此两项仍失败，未改原断言。
- 此前6项过滤专项4过2败、50项未选择，不计作完整文件；原日志保留。
- 与合并时其余18文件结果复用后：333项270过63败。此为跨固定受测SHA的证据汇总，**不是最终HEAD重跑333项**。没有全套或新CI，未新增typecheck。

## 仍未完成及来源边界
- 冠冕：初始背包为空；公开冠冕源仅征服者第12档850层1顶、第15档1500层2顶。首战3冠的原构造无法用合法公开命令保持。固定38轮单人敌人上界为147 PvP+25 PvE=172；征服者最多6层/有效击杀，死亡ID去重且g23召唤物排除，即使全程最高档且全杀也只有1032层，低于1500。此上界只适用于当前单人固定日程，不外推联机或以后内容。
- 源码依据：`g2-3-combat.ts` recordG23Conquest、`g2-3-settlement.ts` g23BattleFacts、`content/g2-3-policy.ts`及征服者奖励原表。此为静态可达性论证，不替代原冠冕恢复测试。
- 单冠850只理论可能，尚无验证成功路线；不能称全部冠冕正控已迁移。
- 护盾原6失败仍未改：2-1空场路线没有650层神器窗口，双神器需650及1200两个窗口；原133/168/196/217/AP145/tick600等断言不能无依据迁移到晚期。第6项需要不稳定宝箱，其辅助锻造器仍未启用，没有真实获取入口。相关构造位于 resists 测试11–24、54、79、104、164(两格式)、196；不借内部grant绕账本。
- 普通双剑的M8/其他M10仍含首/第二场固定事件、item编号、endTick240等断言；本轮没有改变其期望来使后期构造通过。
- crown-restore-cache 的1项本来就是公开路线；实际start次数2而旧预期1，是独立B验证成本，不能归入内部grant问题，保留失败。
- 旧Herald5例缺账本按用户要求不迁移、不skip，保持原失败。

## 有限公开路线探索（不是正式测试通过证明）
首次沿用旧M5 oracle的seed42探索在2-1之后实际金币26/预期24停止，完整失败保留。用户允许独立探索按真实公开返回余额决策后，同seed完成38轮/10089ticks/277命令，终局胜利、HP58、396层、7宝箱、0冠冕；用时7.699秒。首宝箱真实2金收据在日志中，因此旧oracle少算不证明生产错误。
`node docs/evidence/restore-audit/batch-b/public-fixture-migration/explore-conqueror.cjs`
该诊断在独立模块实例中仅移除旧oracle经济核对，保留真实公开命令、商店/事件检查；不修改任何生产状态/资源/源码/正式断言。路线长期仅4征服者档，未凑齐六人；没有找到650/850层路径，不作不可达证明，不无界搜种子。

## 合并后的已有检查
B7完整30项25过5旧Herald失败；bird3559 ms，4-7/5-7/6-7分别4288/5779/8081 ms，四例均使用已获用户明确批准的20秒。鸟授权位置tests/m8-b7-match-wiring.test.ts:221–234。其他时限不改。
脚本按要求依次执行：record-g2-3-herald.cjs不带write，生成5个公开轨迹的恢复及15续算tick均过，但最终现有旧raw字节比较失败，整体退出1；未写旧raw。record-g2-3-inputs.cjs与--check均退出0，无内容变化。不能将Herald整体表述为通过。
需要统一升级save/schema相关版本并在获准后迁移旧raw；本轮不升版本。无合并授权，PR保持未合并。

## 逐例结果（本轮最新文件）
|用例|结果|毫秒|错误首行|
|---|---|---:|---|
|M1 crown history authority rejects the crowns:84/+5 coordinated forgery in text and object restoration, with or without genuine history|failed|132.558|AssertionError: expected [Function] to throw error matching /缺少冠冕历史证据/ but got 'Invalid Match save: preparation-ledge…'|
|M1 crown history authority rejects the unchanged genuine replay collection paired with the forgery, synchronously and asynchronously|failed|76.934|AssertionError: expected [Function] to throw error matching /历史经济收据/ but got 'Invalid Match save: preparation-ledge…'|
|M1 crown history authority does not let a later record context authorize its own forged historical prefix|failed|167.473|AssertionError: expected [Function] to throw error matching /历史经济收据/ but got 'Invalid Match save: preparation-ledge…'|
|M1 crown history authority accepts the public-command no-crown control and resumes identically|passed|264.229||
|M1 crown history authority restores and continues a legal provenance-backed crown control, seed 1|failed|51.820|AssertionError: expected [Function] to throw error matching /缺少冠冕历史证据/ but got 'Invalid Match save: preparation-ledge…'|
|M1 crown history authority restores and continues a legal provenance-backed crown control, seed 42|failed|40.459|AssertionError: expected [Function] to throw error matching /缺少冠冕历史证据/ but got 'Invalid Match save: preparation-ledge…'|
|M2 equipment binding continuity rejects seed 7 cross-round crown transfer despite self-consistent production replay and rewards|failed|83.096|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity accepts legal sale and subsequent re-equipping|failed|40.602|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity accepts legal remover and subsequent re-equipping|failed|36.490|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity accepts legal upgrade and subsequent re-equipping|failed|39.798|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity accepts legal upgrade-remover-equip and subsequent re-equipping|failed|43.158|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity accepts legal combine-equip and subsequent re-equipping|failed|38.453|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity replays survivor equipment before-upgrade in exact order (M4)|failed|39.836|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity replays survivor equipment after-upgrade in exact order (M4)|failed|35.986|Error: Invalid Match save: preparation-ledger-command-rejected|
|M2 equipment binding continuity also rejects moving a non-crown equipped instance|failed|17.447|AssertionError: expected [Function] to throw error including 'historical equipment continuation' but got 'Invalid Match save: preparation-ledge…'|
|M5/M6 ordered equipment across the first battle replays combat equip before settlement, restores through all three entries and continues tick for tick|failed|10.469|Error: Invalid Match save: preparation-ledger-state-resourceProvenance|
|M5/M6 ordered equipment across the first battle rejects a claimed pre-first-battle equip left in inventory, with or without an empty history|failed|60.781|AssertionError: expected [Function] to throw error including 'historical equipment continuation' but got 'Invalid Match save: preparation-ledge…'|
|M5/M6 ordered equipment across the first battle accepts legal pre-first-battle equipment and validates the first opening prefix|failed|5.623|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records combat consumable use with remove at all three entries and resumes tick for tick (M10)|failed|38.083|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records combat consumable use with reequip at all three entries and resumes tick for tick (M10)|failed|32.057|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records combat consumable use with combine at all three entries and resumes tick for tick (M10)|failed|28.897|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records combat consumable use with component-reforger at all three entries and resumes tick for tick (M10)|passed|2117.075||
|M7/S7 combat equipment command replay records combat consumable use with completed-reforger at all three entries and resumes tick for tick (M10)|passed|1598.320||
|M7/S7 combat equipment command replay rejects changing the remove command tick at all three entries (M10)|failed|35.254|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects changing the component-reforger command tick at all three entries (M10)|passed|812.920||
|M7/S7 combat equipment command replay rejects changing the completed-reforger command tick at all three entries (M10)|passed|783.906||
|M7/S7 combat equipment command replay rejects changing the remove resource tick at all three entries (M10)|failed|31.609|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects changing the component-reforger resource tick at all three entries (M10)|failed|370.411|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects changing the completed-reforger resource tick at all three entries (M10)|failed|384.596|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay records inventory combination followed by equip=false and resumes the next battle tick for tick (M8)|failed|7.993|Error: Invalid Match save: preparation-ledger-state-resourceProvenance|
|M7/S7 combat equipment command replay records inventory combination followed by equip=true and resumes the next battle tick for tick (M8)|failed|6.309|Error: Invalid Match save: preparation-ledger-state-resourceProvenance|
|M7/S7 combat equipment command replay rejects changing only the command tick to 0, 2 or 69 for ordinary (M9)|failed|41.059|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects changing only the command tick to 0, 2 or 69 for in-place (M9)|failed|30.497|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects changing only the command tick to 0, 2 or 69 for inventory (M9)|failed|37.074|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay certifies the same ordered result when both tick claims move to 0 (M9 boundary)|failed|68.560|AssertionError: expected { preparationLedger: { …(3) }, …(44) } to deeply equal { preparationLedger: { …(3) }, …(44) }|
|M7/S7 combat equipment command replay certifies the same ordered result when both tick claims move to 2 (M9 boundary)|failed|65.419|AssertionError: expected { preparationLedger: { …(3) }, …(44) } to deeply equal { preparationLedger: { …(3) }, …(44) }|
|M7/S7 combat equipment command replay certifies the same ordered result when both tick claims move to 69 (M9 boundary)|failed|72.180|AssertionError: expected { preparationLedger: { …(3) }, …(44) } to deeply equal { preparationLedger: { …(3) }, …(44) }|
|M7/S7 combat equipment command replay rejects existing-target in-place combination tampering at all three entries|failed|35.380|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects missing-first in-place combination tampering at all three entries|passed|36.436||
|M7/S7 combat equipment command replay rejects missing-second in-place combination tampering at all three entries|passed|32.683||
|M7/S7 combat equipment command replay rejects ordinary-equip in-place combination tampering at all three entries|passed|29.582||
|M7/S7 combat equipment command replay rejects missing-first inventory combination commands at all three entries|failed|46.178|AssertionError: expected [Function] to throw error including '合成命令字段' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects missing-second inventory combination commands at all three entries|failed|42.060|AssertionError: expected [Function] to throw error including '合成命令字段' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects ordinary-equip inventory combination commands at all three entries|failed|34.783|AssertionError: expected [Function] to throw error including '历史获得或合成记录不一致' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay rejects a structurally valid command with an invalid recipe through production replay|failed|53.485|AssertionError: expected [Function] to throw error including '非法合成命令' but got 'Invalid Match save: preparation-ledge…'|
|M7/S7 combat equipment command replay binds combat equip order to the temporary item roll prefix (M9)|failed|63.308|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay keeps combat equips before terminal resources and crown gold (M9)|failed|32.955|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records in-place sword combination at tick 1 (requested slot 0) and resumes the next battle tick for tick|failed|6.140|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay records in-place sword combination at tick 1 (requested slot 2) and resumes the next battle tick for tick|failed|8.705|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects reordered commands at all three save/restore entries|failed|31.520|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects duplicated commands at all three save/restore entries|failed|34.729|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects extra commands at all three save/restore entries|failed|31.704|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects missing commands at all three save/restore entries|failed|33.756|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay rejects unknown-target commands at all three save/restore entries|failed|31.519|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay accepts combat equipment targeting a bench unit at all three entries|failed|35.653|Error: Invalid Match save: preparation-ledger-command-rejected|
|M7/S7 combat equipment command replay accepts combat equipment targeting a dead unit at all three entries|failed|211.432|Error: Invalid Match save: preparation-ledger-command-rejected|
