# Batch 5 R2：B5-21、B5-81（2026-10-27）

基线 `codex/v25-r2`；只开放这两项强化。数值和研究状态见 [P-B5-21 / P-B5-81](S13_RULES_GAP.md#2026-10-27-b5-21-与-b5-81p)。沿用 v25 纪元，v25 为当前纪元，内容摘要变化后已随合并重录 v25 纪元 epoch，不修改 UI、素材或网络客户端命令。

| 强化 | 数据与实际行为 | 出池 |
| --- | --- | --- |
| 狂暴到底 `anger-issues` | 普通合成成装转换为普通鬼索；10 AP、10% AS、每次攻击+5% AS，另+45双抗，每2次完成攻击+1% AD/+1 AP。每件独立计数，奇数次数保留；不消耗转换 RNG，不改变装备实例或位置。 | 棱彩；3-2、4-2 |
| 又一个异常突变 `another-anomaly` | 4-6确认异常的同一事务发放一件唯一便携装备；250 HP、20% AD、25 AP；复制定义，不继承原英雄的累计状态。卸下后在后续装备投影中失效，已开战快照沿用既有边界；原英雄及其合星后继不能装备。 | 黄金；4-2 |

B5-21 只按普通配方目录分类；光明、神器、辅助、纹章、黑市和便携异常装备不转换。普通窃贼手套本体转换后撤销其临时子装备，但保留并认证旧随机收据；特殊手套仍保留，其普通临时成装在战斗投影中转换。后续合成、装备原位合成、机制奖励、PvE 战利品、选秀授予和战中宝箱均接入。合成/装备预览返回转换后的真实结果；原位合成先用转换后的类别检查占槽，避免手套或唯一成装在转换前被错误拒绝。

B5-81 的六项排除为 UltimateHero、CallingCard、IdentityCrisis、IntoTheUnknown、Miniaturize、DualWielding。排除同时覆盖首次报价、重掷和提交校验，未实现/未开放的异常不会因此开放。每个可复制异常对应一个 `TFT13_AnotherAnomaly_Item:<definitionId>` 内容定义；这些变体共用 `apiName=TFT13_AnotherAnomaly_Item`、属性和唯一互斥规则。效果身份存在于物品定义内，不给 Match 添加任意客户端可写的“复制目标”字段。原英雄出售后，装备仍能从不可变定义取得效果；合星继承会把禁止装备的复制品退回库存。拆卸、重铸等沿用既有装备/战斗快照边界，不新增战中撤销其他装备的规则。

资料短描述中的“卸下即失效”指后续装备投影不再编译复制效果及物品属性。已开始的战斗继续使用自己的已安装快照；战中拆卸不会追溯撤销本战属性或已发生的吞噬、召唤、成长。下一次开战按最新装备重新编译。

## 接口与恢复认证

2026-10-28 用户决定 A（P-B5-21/B5-83）：魔像固定套装豁免狂暴转换，两种取得顺序均适用。永久账本按既有 `augment-pool-batch5-g6` 装备收据来源识别，覆盖尚在库存的发放中间态；战斗输入不带收据，按既有 `carry-golem` 持有者标识识别。恢复保留固定套装、连续来源事实和独立服务器 authority 校验，并拒绝套装转换事实或漏转普通成装。无新增命令或失败枚举；内容清单 G6 修订为 `v25-review-2`，同一 v25 纪元下重算摘要，v25 为当前纪元，内容摘要变化后已随合并重录 v25 纪元。

内部签名补充：`carryGolemFixedItemIds(receipts?: readonly MechanicReceipt[]): ReadonlySet<string>` 返回专属来源的装备实例 ID；`convertAngerIssuesItems(items: readonly ItemInstance[], fixedItemIds?: ReadonlySet<string>): readonly ItemInstance[]` 保留固定实例，其余沿普通配方分类转换；`r2ItemDefinition(item: ItemDefinition, augments: readonly OwnedAugment[], fixedEquipment?: boolean): ItemDefinition` 在固定套装时保留原定义。三个函数均无副作用、无新增失败原因；完整恢复仍独立认证收据与固定配装，不能用该分类函数替代认证。

| 内部导出 | 签名与约束 |
| --- | --- |
| `applyAngerIssues` | `(state: MatchState): MatchState`；追加 `anger-item-converted` 资源事实，保留原奖励收据；无持有者/无变化返回原对象。 |
| `r2AnomalyAllowed` | `(augments: readonly OwnedAugment[], id: string): boolean`；只过滤持有该强化的席位。 |
| `grantPortableAnomaly` | `(state: MatchState): {state: MatchState; events: readonly MatchEvent[]}`；成功异常选择事务内调用；收据 ID 绑定强化 choiceId 和异常 choiceId，重复不授予。 |
| `validatePortableAnomaly` | `(state: MatchState): void`；校验选择、授予轮、唯一来源、复制定义和禁止原持有者约束；失败抛 `Invalid portable anomaly`。 |
| `recordAugmentCopyKills` | 强化历史 API：`(state, {kind:'anomaly-copy-kills', battleId, itemId, unitId, kills:[{eventSeq,victimId}]}): MatchState`；同一战斗/物品幂等，冲突拒绝，不按受害单位去重。 |
| `readAugmentCopyKills` | 强化历史 API：`(state: MatchState, itemId: string, beforeRound=state.round): number`；只读取此前回合的复制品自身击杀。 |
| `recordR2PortableBattle` | 服务器内部导出：`(state: MatchState, combat: CombatState, team: Team, mapping?: readonly {kind:string;combatId:string;originalId:string}[]): MatchState`；只采样可信终战，映射原单位/装备 ID；非终战抛 `Invalid portable anomaly terminal`。 |

沿用 `augment-history-v1` 的对象/JSON界限和命令重演/独立服务器 authority。追加 `anomaly-copy-kills` 事实族；只有持有强化的席位采样。原 Headhunter 的 G23 收据继续只统计原持有者，复制品独立计数；战斗输入可选 `augmentCopyKills:[{itemId,count}]` 由历史 API 推导；当前回合的冻结计数读取认证资源前缀与开战历史，后续卸下或重铸不能抹掉已开战输入。经 PvE 输入认证、PvP 快照复制及装备 ID 命名空间映射；没有记录时不写空字段。保存候选不能自带 authority。

开场异常钩子保持既有持有者顺序及冻结数值，每次调用前重查 `alive && hp > 0`，前一持有者已经吞噬的单位不再执行自己的开场钩子；战中安装的复制品采用同一存活门槛。`readBattleLiveGoldReaders(input)` 只表示开战快照资格；`BattleTask.sampleBankGold(seatId:string,liveGold:number):boolean` 从当前战斗已安装的机制判断资格，原英雄未上场、复制品开场在库存也可在成功安装后开始采样。无当前携带机制、相同有效余额、镜像 B 返回 `false`；阶段与样本错误仍为 `wrong-phase` / `invalid-bank-sample`。装备日志先按 `effectiveTick` 安装，之后的金币样本按原 tick、原顺序重演；早于安装、无携带者、重复无效及镜像样本仍拒绝。结算恢复和回放均逐样本认证，不再用开场资格否决合法后装携带者。

失败使用现有 `invalid-choice`、`item-restricted`、`unique-conflict` 和装备/战斗输入失败原因；失败不写事件、资源或 RNG。恢复还认证转换前定义、选择来源、顺序、旧手套收据以及复制定义/源单位；完整候选仍必须与独立服务器权威对象一致。

## 接线点

- `match.ts`：成功命令收尾转换、临时装备撤销、异常候选过滤及即时授予。
- `inventory.ts` / `item-selectors.ts`：转换后的原位合成占槽、禁止原英雄装备。
- `seat-mechanics/grants.ts` / `loot-runtime.ts` / `carousel.ts`：未来永久装备的同事务转换。
- `strategy-snapshot.ts` / `augment-effects.ts`：逐件属性/程序、临时普通成装投影、复制异常来源和相关团队计数。
- `m8/combat-item-grants.ts` / `combat-item-programs.ts`：宝箱新装备转换，原随机字和授予序号不变。
- `combat-s13.ts` / `battle-equipment.ts` / `m8/s13-mechanisms.ts` / `m8/s13-triggers.ts` / `s13-augments-p2-combat.ts`：战中安装的独立启动、计数和周期任务。
- `live-gold-readers.ts` / `combat-input.ts` / `two-sided-*.ts`：复制 Avarice 的现有实时金币采样；复制 Headhunter 自身历史输入。
- `resource-provenance.ts` / `b8-restore.ts` / `temporary-equipment.ts` / `g2-3-restore.ts`：转换与授予认证、独立装备重放和手套历史。
- `upgrades.ts`：原异常身份转移后退回禁止装备的复制品；`g2-3-settlement.ts` 保持原 Headhunter 账本独立。
- `augment-history*.ts`：事实 API、归属及边界；**`src/server/room/augment-history.ts` 只加一处终战采样调用**，`src/server-entry/index.ts` 导出该规则入口。服务器不计算强化效果，不新增计时器、墙钟或客户端字段。
- 内容注册：`augments`、`augment-policy`、`augment-offer-rules`、`augment-stage-bans`、物品注册、`rules-manifest`、`validate-content`；身份由生成脚本重算。
- 独立 oracle：`oracle.g2.cjs` 手工池/阶段/互斥表；`augment-rewards-oracle.cjs` 调用独立 `augment-r2-oracle.cjs`，从选择前装备、实际攻击次数和选择命令推导期望转换/奖励。后续普通配方及原位合成从命令前两个组件推导；锻造选择与机制奖励从所选定义、独立奖励计划推导，认证物品和完整转换事实，删除转换事实也不能抹掉应转换的预期。完整 Ledger 同样按转换后的独立期望验证原始奖励收据，不读取生产实现。

## 验证

2026-10-28 F1（用户决定 A）：定向11文件315项通过，含原 `batch5-g6-room` 47项、新组合路线51项、R2全套、G6、资源恢复、内容身份及production-size；`tsc --noEmit` 和内容身份 `--check` 通过。新组合按现有逐轮房间测试组织，不调整5秒默认超时；正序seed0，逆序由0..100等级序列查得seed29，逆序选择尚未见过魔像卡的人类席位。脚本化报价的 `toContain` 仅作夹具自检，真实资格、已见禁出、RNG推进与恢复验证保持。内容／loot摘要为 `fnv1a32-utf16:179507ab`／`fnv1a32-utf16:63bddec2`；没有改服务器、放宽原断言或录制历史epoch。

审查 must-fix 定向复验（2026-10-27）：相关13文件240项与 `npm run typecheck` 全部通过。新增 `augment-pool-batch5-r2-review.test.ts` 的11项回归覆盖双持有者的两种原英雄身份、单边/双边开场，A/B双方后装贪财的采样及JSON重放/结算认证，以及后续合成、原位合成、锻造奖励在物品/转换事实被删改时的独立拒绝。按任务要求只跑相关测试和tsc，未跑构建、全量或浏览器验收，未修改 `src/server/` 或执行Git写操作。下段为初次交付的历史验证结果。

新增 `augment-pool-batch5-r2*.test.ts` 覆盖真实报价节点与房间选择、真实联机战斗、奖励与装备命令、独立数值向量、所有支持异常的编译/初始化/卸下、战中复制启动、原持有者禁止、对象/JSON往返以及篡改拒绝。额外回归覆盖库存、战中装备、异常恢复与独立 M5 账本。运行命令均带 `--maxWorkers=3 --configLoader runner --cache=false`；后两项用于共享只读 node_modules，不修改权限、断言或超时。仅为查找实际房间报价检查 0..100，固定测试路线 B5-21 为 seed21/s1/3-2，B5-81 为 seed5/s4/4-2。

定向验收13文件302项全部通过，其中R2新增116项；另覆盖库存、装备、P2共享属性及保存/回放回归。最终身份更新后再次通过身份、生产体积与实时金币回归14项。typecheck、生产构建、独立内容/loot digest重算检查和生产体积测试均通过。实时金币回归中的当前身份期望已从误用的v24 fixture分离，v24原文件及其身份断言保留。最终内容身份见根目录 `-o`。
