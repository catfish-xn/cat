# Batch 5 R2：B5-21、B5-81（2026-10-27）

基线 `codex/v25-r2`；只开放这两项强化。数值和研究状态见 [P-B5-21 / P-B5-81](S13_RULES_GAP.md#2026-10-27-b5-21-与-b5-81p)。沿用 v25 纪元，不重录历史 epoch，不修改 UI、素材或网络客户端命令。

| 强化 | 数据与实际行为 | 出池 |
| --- | --- | --- |
| 狂暴到底 `anger-issues` | 普通合成成装转换为普通鬼索；10 AP、10% AS、每次攻击+5% AS，另+45双抗，每2次完成攻击+1% AD/+1 AP。每件独立计数，奇数次数保留；不消耗转换 RNG，不改变装备实例或位置。 | 棱彩；3-2、4-2 |
| 又一个异常突变 `another-anomaly` | 4-6确认异常的同一事务发放一件唯一便携装备；250 HP、20% AD、25 AP；复制定义，不继承原英雄的累计状态。装备撤销后不再编译复制效果，原英雄及其合星后继不能装备。 | 黄金；4-2 |

B5-21 只按普通配方目录分类；光明、神器、辅助、纹章、黑市和便携异常装备不转换。普通窃贼手套本体转换后撤销其临时子装备，但保留并认证旧随机收据；特殊手套仍保留，其普通临时成装在战斗投影中转换。后续合成、装备原位合成、机制奖励、PvE 战利品、选秀授予和战中宝箱均接入。合成/装备预览返回转换后的真实结果；原位合成先用转换后的类别检查占槽，避免手套或唯一成装在转换前被错误拒绝。

B5-81 的六项排除为 UltimateHero、CallingCard、IdentityCrisis、IntoTheUnknown、Miniaturize、DualWielding。排除同时覆盖首次报价、重掷和提交校验，未实现/未开放的异常不会因此开放。每个可复制异常对应一个 `TFT13_AnotherAnomaly_Item:<definitionId>` 内容定义；这些变体共用 `apiName=TFT13_AnotherAnomaly_Item`、属性和唯一互斥规则。效果身份存在于物品定义内，不给 Match 添加任意客户端可写的“复制目标”字段。原英雄出售后，装备仍能从不可变定义取得效果；合星继承会把禁止装备的复制品退回库存。拆卸、重铸等沿用既有装备/战斗快照边界，不新增战中撤销其他装备的规则。

## 接口与恢复认证

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
- 独立 oracle：`oracle.g2.cjs` 手工池/阶段/互斥表；`augment-rewards-oracle.cjs` 调用独立 `augment-r2-oracle.cjs`，从选择前装备、实际攻击次数和选择命令推导期望转换/奖励，拒绝伪造收据，不读取生产实现。

## 验证

新增 `augment-pool-batch5-r2*.test.ts` 覆盖真实报价节点与房间选择、真实联机战斗、奖励与装备命令、独立数值向量、所有支持异常的编译/初始化/卸下、战中复制启动、原持有者禁止、对象/JSON往返以及篡改拒绝。额外回归覆盖库存、战中装备、异常恢复与独立 M5 账本。运行命令均带 `--maxWorkers=3 --configLoader runner --cache=false`；后两项用于共享只读 node_modules，不修改权限、断言或超时。仅为查找实际房间报价检查 0..100，固定测试路线 B5-21 为 seed21/s1/3-2，B5-81 为 seed5/s4/4-2。

定向验收13文件302项全部通过，其中R2新增116项；另覆盖库存、装备、P2共享属性及保存/回放回归。最终身份更新后再次通过身份、生产体积与实时金币回归14项。typecheck、生产构建、独立内容/loot digest重算检查和生产体积测试均通过。实时金币回归中的当前身份期望已从误用的v24 fixture分离，v24原文件及其身份断言保留。最终内容身份见根目录 `-o`。
