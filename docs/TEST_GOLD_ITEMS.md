# 服务器测试中的金币装备

PR #300 的测试可复用 `tests/helpers/grant-test-items.ts`；仅测试代码导入，不能接入服务器运行代码或客户端命令。

```ts
// 在 tests/server/*.test.ts 中：
import { grantTestItems, TEST_GOLD_ITEMS } from '../helpers/grant-test-items';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedBattle } from '../../src/simulation/two-sided-battle';

// state、opponent 是测试已准备好的同轮 preparation MatchState。
// unitId 必须是己方真实单位 ID；参战单位须已部署在棋盘上。
state = grantTestItems(state, {
  unitId,
  itemIds: [
    TEST_GOLD_ITEMS.mogulsMail,     // TFT7_Item_ShimmerscaleMogulsMail：大亨之铠
    TEST_GOLD_ITEMS.collector,      // TFT4_Item_OrnnTheCollector：金币收集者
    TEST_GOLD_ITEMS.gamblersBlade,  // TFT7_Item_ShimmerscaleGamblersBlade：投机者之刃（赌徒之刃）
  ],
});
const a = snapshotForBattle(state, 'A');
restorePlayerBattleSnapshot(JSON.stringify(a));
const b = snapshotForBattle(opponent, 'B');
const input = compileBattle(a, b, 42, { battleId: 'gold-items-test' });
const result = startTwoSidedBattle(input).advance(1201)!;
// result.terminal.itemGoldReceipts：包括成功和失败的掷骰。
```

签名：`grantTestItems(state: MatchState, { unitId: string, itemIds: readonly TestGoldItemId[] }): MatchState`。
`itemIds` 是以上三个**装备定义 ID**，实例 ID 由规则生成。按请求顺序穿入第一个合法槽，不覆盖原有装备；仍遵守三槽、唯一性和穿戴限制。输入须处于未锁定阵容的 preparation 阶段。未知己方单位、不支持的装备、获取失败或没有合法槽位时抛错，原输入不变，不返回部分结果。每次调用是一次新的授予，不能作为幂等重试使用。

辅助使用现有 `grantMechanicItem` 机制授予路径，记录 `source: 'test-gold-items'` 的唯一收据和 `item-acquired` 事实，再调用公共 `equipItem` 记录穿戴事实。它不模拟玩家挣取神器奖励的过程，不手填 items、序号或账本，也不放宽任何校验；没有新增 simulation 入口、正式命令、序列化特例、规则变更或 digest/herald 更新。

返回值必须写回测试持有的权威席位状态，并在生成快照及锁定战斗阵容**之前**调用。`snapshotForBattle` 自动从席位 `gold` 带入赌徒之刃需要的 `bankGold`，不要另造该字段或直接改快照。只有场上持有者的装备进入快照；辅助不会修复原本无效的单位 ID、部署、轮次、经济或历史，也不能令孤立的合成阵容变成完整可恢复存档。共享卡池/房间的状态装配继续使用服务器现有测试路径。

验证见 `tests/gold-item-test-entry.test.ts`：真实开局状态授予三件装备后完整存档往返；独立 PvP 阵容快照往返、双边开战、三类金币效果及结算提案。金币掉落按规则触发：收集者处决时 40%，赌徒之刃每次攻击 5%，大亨之铠 35 层给 1 金、此后每 160 tick 给 1 金。装备存在不保证短战斗一定掉金。

```sh
npm run typecheck
npx --no-install vitest run tests/gold-item-test-entry.test.ts tests/g2-4b-item-gold.test.ts tests/g2-4b-gold-settlement.test.ts tests/g2-4b-mogul.test.ts tests/g2-4b-gambler.test.ts tests/g2-4b-collector.test.ts tests/g2-4b-artifact-forge.test.ts
```
