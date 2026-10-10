# U6 LootView 最小合同增补提案（待用户决定，未实施）

状态：**提案**。冻结的 `LootView`（`src/simulation/m8/ui-contracts.ts`、M8_UI_CONTRACT §5）未修改；`readLootView` 按现形状实现。本文只列出验收要求与现合同之间的缺口，以及最小的补法。

## 1. 核对结论

| 能力 | 验收出处 | 现合同能否表达 | 结论 |
| --- | --- | --- | --- |
| 已揭示／已授予／满席等待／终局保留的区分 | M8_UI_CONTRACT §5、ADDENDUM §5.1 | 能（`status`/`receiptId`/`reason`） | 已实现并有自动回归 |
| 已解决选择显示实际收据与物品 | ADDENDUM §5.1“只有真正已授予者显示实际 receipt” | 能（选择的 granted 行） | 已实现 |
| **未解决自选：明确的待选投影与阻塞原因** | ADDENDUM §5.1：“未解决自选须有明确的待选投影与阻塞原因……现有 UI 合同缺少的只读形状需作为增补提交”；“领域查询应能区分……战后待选择” | **部分**：`PendingChoice` 可作当前可操作项（§5.1 允许），但 `LootView.reason` 只有通用的 `unsettled-round`（战斗进行中、未结算时也用它），`PendingChoice` 没有掉落来源。界面只能按 `m8.round.kind==='pve'` 推断这是野怪选择 | **必需能力，现合同无法明确表达** |
| 待选项的来源（哪只怪） | U6 任务“显示……来源”指已揭示奖励；UR-U6-03 | 已揭示奖励有来源；待选项没有 | 随上一项一并补，不单列 |
| 玩家自选与终局自动处理的区分 | U6 完成条件、§5 原子示例均未要求区分方式；只要求终局奖励按领域结果展示 | 不能（选择行没有 method） | **非必需**，不提议；记为已知限制 |

## 2. 提议的最小增补（加法，不改既有字段语义）

```ts
export interface LootView {
  // 既有字段不变
  readonly reason: 'pending-capacity' | 'pending-choice' | 'unsettled-round' | 'game-over' | null;
  /** 当前可操作的、已赚得未解决的野怪组件选择；与 state.pendingChoice 一一对应，否则为 null。 */
  readonly pendingChoice: (DropIdentity & { readonly choiceId: string; readonly generation: number }) | null;
}
```

- `reason='pending-choice'`：`phase==='choice'` 且当前 `PendingChoice` 是野怪掉落选择时使用；补给、强化、异常选择仍为 `unsettled-round`。
- `pendingChoice` 只给身份（dropId、encounterId、sourceUnitId、roundId）及 `choiceId/generation`，**不含**备用组件或候选以外的任何计划信息；候选仍读 `PendingChoice.offers`。
- 不改 `RevealedDropView`、不加解决方式字段、不改存档、digest 或规则。

## 3. 若批准的实施与验收

1. `ui-contracts.ts`、`M8_UI_CONTRACT.md` §5 同步增补，并记录批准时间。
2. `readLootView` 增加上述字段；`loot-view` 测试补：待选期间 `reason='pending-choice'` 且 `pendingChoice` 与 `state.pendingChoice` 对应；补给轮组件选择不触发；篡改备用组件不改变视图。
3. 界面改读 `pendingChoice` 判断野怪选择并显示来源，去掉按回合类型推断；`verify-m8-u6-loot.cjs` 同步断言。
4. 预计包体增量约 0.2–0.4 KB（B8/U6 各半），在 B8 余量内。

不批准时：维持现状（`unsettled-round`＋按回合类型推断），并在节点1送审中把该项列为未关闭的合同缺口。
