# 实时战斗第 2 阶段：applyBattleEquipment（2026-10-22，待集成 epoch）

本节覆盖 T12「战中新装备下场生效」和 #382「非空 battle-input-unsupported」。用户 10-22 第 1 条反馈及「排」授权包含服务器改动。工作基线 `9d9ea671`，分支 `codex/battle-equipment-phase2`；界面交由 Claude。

## 规则依据和范围

- 生效时机依据本任务用户确认的 14.24b 行为：装备在下一个逻辑 tick 生效。固定 tick 为 50 ms；服务器调度晚到时仍使用逻辑边界，不按动画帧或真实时间倒填。
- 数值使用仓库冻结的 14.24b 装备目录、`buildStrategySnapshot → resolveEffects`、`compileMechanismDefinitions`。没有新增或替换装备数值。最大生命使用既有 `changeMaxHp`（保留缺失生命，不算治疗、不复活），并通过 `scaleItemSummonHp` 保留盖伦共享生命、异常已获得生命。
- 羁绊沿用仓库开战冻结约定：`M5_RULES.md` 的羁绊/站位条款、`combat-input.ts` 的冻结输入和 `strategy-snapshot.ts` 编译边界。装备自身属性、程序、合成产物及窃贼临时子件即时同步；非装备来源、羁绊成员和档位本场保持开战值，纹章在下一场参与羁绊重编译。这是本仓库规则边界，不宣称已验证 Riot 内部羁绊切换实现。
- 保留已造成伤害、当前生命缺口、死亡、行动计数、技能/移动冷却、护盾、已消耗触发器及周期进度。新装备声明的初始效果只启动一次，新的周期从安装边界开始；不重跑整队开场、野怪开场、召唤物生成或开战冠冕收益资格。
- 目标为己方永久场上单位的当前战斗实例；已阵亡但仍在实例数组中的单位可以装，不会复活。敌方、镜像、召唤物拒绝；已被替换/移除而不再有原战斗实例的永久单位返回 `battle-unit-unavailable`，资产也不提交。备战席和本场已结束后的装备继续走资产路径，留给下一场。
- 装备事务沿用自动找最低组件槽、配方、三槽/独占、唯一性、限制条件、永久 ID 和临时装备 RNG。安装本身不抽 RNG；窃贼首次 roll 仍只在成功 Match 装备事务内消费原 equipment 流。消耗品不因此新增实时拆卸/重铸命令。

## 公共函数与成功日志

```ts
applyBattleEquipment(state: CombatState, receipt: BattleEquipmentReceipt):
  | {ok: true; state: CombatState}
  | {ok: false; state: CombatState; reason: BattleEquipmentFailure}

BattleTask.queueEquipment(input: BattleEquipmentInput, equipped: MatchState): void
queueMatchBattleEquipment(before: MatchState, equipped: MatchState,
  input: BattleEquipmentInput): MatchCommandResult
stepMatchCombatStream(state: MatchState, beforeTick?: BattleTickInputSource):
  MatchStep & {terminal: CombatState | null}

equipItem(state, itemId, unitId, slot,
  options?: {readonly deferBattleEquipment?: boolean}): MatchCommandResult
```

`applyBattleEquipment` 是纯函数，失败返回原 CombatState 引用。`queueEquipment` 只接服务器成功 `equipItem` 的权威结果；它在副本上验证整批安装，失败不改任务。它不是客户端入口，也不能用客户端自报的 Match/receipt 调用。`queueMatchBattleEquipment` 是同等 PvE 适配，失败返回 before。服务器先用 `deferBattleEquipment:true` 得到待提交资产，再在同一单写闭包中完成对应流的排队与资产发布；单人默认自动排下一 tick。

`BattleReplayOptions.beforeTick(effectiveTick)` 继续在 `advance(n)` 的每一步和 `advanceTick()` 前执行，PvE 也透传。提供回调时返回批次必须与已认证待安装批次一致；缺少来源的输入是 `battle-input-invalid`，不会推进。调用方不用自行改战斗实例。成功批次按 effectiveTick/seq 安装后，原子追加私有日志；未安装的意图不是成功日志。

`BattleEquipmentInput` 保持既定 7 字段：`{kind:'equipment',seq,effectiveTick,seatId,itemId,unitId,slot}`。正安全整数 seq、1…1200 effectiveTick、0…2 slot；itemId/unitId 是席位永久资产 ID。PvP 规则层负责映射为战斗 ID，服务器不拼 ID、不计算属性。

`BattleResult.inputLog?: readonly BattleTickInput[]` 空时省略。PvE outcome.combat 同样携带成功 inputLog。由于 PvP 开战快照不含库存，光有 itemId 无法重建战中新物品：`terminal.equipmentReceipts` 保存与 inputLog 一一对应的私有源凭据，字段为 `input/team/combatUnitId/before/after/battleSeed/resourceSequence`。before/after 为冻结非装备输入和这次已认证装备持有变化的 `CombatStrategyInputs`，没有客户端提供的攻击/生命答案。回放重新调用同一个策略编译器，逐 tick/seq 注入，核对日志形状、顺序、来源连续性、终局和事件；漏日志、重复、倒序、错 tick 均拒绝。此 API 的来源认证边界与既有 BattleResult/bankSamples 一样，是可信规则/服务器结果，不能单独认证外部自报资产的出生历史。

单人 `CombatState.pendingEquipment` 保存尚未跨过 tick 的已成功资产事务；`equipmentReceipts` 仅含已安装事务。恢复从合法资源账本的装备/合成记录、原冻结输入及已验证临时 roll 重建每张凭据，再独立续算完整 Combat；不能只让候选自身 RNG 或凭据自洽。原 `BattleRecord.equipmentCommands.tick` 仍表示装备命令执行前游标，安装 tick=`tick+1`，不改写旧日志或迁移旧身份。联机仍无房间落盘/重启恢复；断线恢复使用同一 recorder 的已提交关键帧和尾段。

## 服务器、回执和失败

网络命令不变：`{type:'equip',itemId,unitId,slot}`，外层仍带 roomId、round、seatRevision、commandId。凭证认证决定 seatId，客户端不传 seq/effectiveTick。

Room 沿现有单写队列、`deferDuringSettlement` 和 phase/seat gate：一拍多分片之间到达的命令先等待整拍封口，执行时取 `effectiveTick=Room.nextBattleInputTick`，并要求等于该 `CombatStream.nextEffectiveTick`。仅成功排队时增加房间 seq；成功回执表示资产和下一 tick 意图已原子提交，装备显示在该 tick 的帧中变化。尚在单写闸门等待时不提前回成功；旧 round/seatRevision、连接 epoch 和 dedupe 规则保持。重复 commandId 返回原回执，跨重连也不再次扣物品、合成、roll 或追加日志。

失败原因：

- 原装备枚举：`wrong-phase / unknown-item / unknown-unit / same-item / item-not-inventory / invalid-recipe / invalid-slot / item-slot-occupied / unique-conflict / exclusive-slots / temporary-item / item-restricted`。
- 新规则枚举：`battle-input-invalid`（非法字段、边界、顺序、来源/未认证批次），`battle-unit-unavailable`（没有可对应的永久战斗实例）。
- 原网络/Room 校验：`not-authenticated / no-room / wrong-room / stale-round / seat-revision-mismatch / unknown-seat / seat-eliminated / seat-controlled / control-revoked` 等仍先于规则命令。`settlement-pending, queued:true` 是内部未执行占位，不是最终规则失败；网络保留完整闭包等待最终回执。

所有最终失败不改变资产、pool、Match/Combat、事件/日志、RNG、ID 或 revision。已结束的流没有新战斗输入，只允许原资产操作。

## 给界面的字段

`CombatViewUnit.equipment?: readonly {definitionId:string; slot:number; temporary:boolean}[]`：该单位第一次实时安装后出现，表示此时该持有者的完整装备格。后续通过 `unitUpdated.changes.equipment` 或关键帧更新。缺省时沿既有开场装备显示路径；出现后按此数组显示当前战斗，不按当前库存猜测合成或生效时机。数组不带 itemId、输入序号、席位资产、before/after、装备 RNG 或成功日志。

观战、B 侧镜像投影、重连均读取同一个 recorder；重连可能是较早关键帧加尾段，必须依次执行 reducer。拖拽输入依旧使用 unitIds 的 combatId→originalId 映射（PvE 原 ID），只操作本人永久单位。界面任务及验收见 `UI_REQUESTS.md` 的 BATTLE-EQUIPMENT-PHASE2。

## 身份和集成

候选 rules/content：`s13-g2-3-v20-battle-equipment` / `s13-14.24b-g2-3-v20-battle-equipment`；CONTENT=`fnv1a32-utf16:c17a536b`，LOOT_REPLAY=`fnv1a32-utf16:d9012397`。schema/save/replay/command 仍为 **11/7/5/5**，NET6。规则 manifest 明记 next-unsealed-tick-v2、冻结羁绊和私有来源凭据。`identity-constants.ts` 用离线完整 root 重算，旧身份拒绝运行态恢复。

**未录制 epoch，不更新任何历史 golden、baseline 或 recorded states。** 此候选身份须在与开局奇遇集成时统一定名、重算 digest、录制和验收；不能直接把本工作区当已通过发布门槛的版本。预期失败及实测结果见 [LIVE_COMBAT_EQUIPMENT_PHASE2_TESTS](LIVE_COMBAT_EQUIPMENT_PHASE2_TESTS.md)。
