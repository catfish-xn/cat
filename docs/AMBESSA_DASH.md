# 安蓓萨施法位移（P，待 v22 统一录制）

2026-10-23，`codex/ambessa-dash`，基线 `5d7fb72ccd6169728e1794d6ed07264a1f3883c4`。
本单按协调者转达的项目决定先行实现，**不合并、不提交、不录 epoch**。原版资料只证明两姿态方向和先后关系，不证明位移距离；来源保留在 [AMBESSA_DASH_EVIDENCE](AMBESSA_DASH_EVIDENCE.md)。下列落点算法全部标 **P（项目决定）**，不是 14.24b 原版数值。

## 规则与时序

- 沿用已有 `runtime.castCount`：本次计数递增后，奇数锁链、偶数拳击。伤害系数、AOE、5 tick 短晕、姿态奖励、耗蓝和施法距离闸门不改。
- 锁链：在既有施法目标选择之后、伤害包规划之前更新 `cell`。**已与目标相邻时原地不动，不发位移事件**：当前格就是最近落点。不相邻时，候选是目标六角距离 1 的可达空格。按距当前格的六角距离最小选取，同距沿现有普通移动 BFS 首次访问顺序（邻居 E、SE、SW、W、NW、NE）。只选从当前位置绕开阻挡可达的候选，不穿过封闭包围；无可达空邻格则原地，原伤害照常结算。
- 拳击：规划原砸击/短晕时保存目标此时的坐标，等本 tick 全部伤害 HP 与存活屏障提交后后撤。仅仍能移动且存活的施法者执行。目标被这次砸击杀死仍可后撤，不重选目标。
- 后撤方向：从 `board.deploymentZones` 两队半场中心判断己方行方向；默认 player 向较大 row，enemy 向较小 row。只考虑 row 朝己方且六角距离严格远离施法时目标坐标的相邻格；同距按上述邻居顺序选第一个。**先定方向，再检查该格可用性；被占/被保留时不换另一个格。** 边界无此邻格、目标在身后导致两个条件不能同时满足时原地。
- 位移复用 `canMove`（控制、引导、深根等限制）和 `occupiesCell`（活单位包括暂离/待复活占格；攻击代理不占格）。读取普通移动之后的当前占位，并共享本 tick 普通移动落点保留集合；本单成功冲刺也保留终点，后续安蓓萨不能抢占。单位顺序沿现有 ID 顺序，不用随机平局。
- 目标在行动前移动或死亡，沿用现有行动阶段重新选目标；没有活目标就不施法、不耗蓝、不冲刺。拳击后撤不会撤销本 tick 已规划的攻击。延续现有同步伤害屏障，不改其他单位的结算顺序。
- 后撤意图与保留集合只存在本次原子 tick 的 `AbilityContext`，没有跨 tick 新状态、定时器或 RNG 调用。断点在 tick 边界，JSON 恢复不补发已发生事件。

## 公共事件与表现层接口

复用既有通用移动事件，**本单不新增 `unitDashed` 类型**：

```ts
{
  type: 'movement', tick: number, unitId: string,
  from: { col: number, row: number }, to: { col: number, row: number },
  reason: 'ambessa-chain' | 'ambessa-fist-retreat'
}
```

普通移动不带 `reason`；没有实际落格改变不发事件。领域账本仍带 `domain:'combat'`、`combatId`、递增 `eventSeq`。`CombatViewEvent` 白名单保留 `reason` 与 `tick/eventSeq/unitId/from/to`，不外泄领域内部字段。

锁链的顺序是 `cast` 收据 → `movement(reason='ambessa-chain')` → `packetDamage`，收据 `completionCell` 是冲刺终点；拳击是 `cast`/原短晕 → `packetDamage` → `movement(reason='ambessa-fist-retreat')`，收据 `completionCell` 是砸击位置。后撤在全批 HP/存活提交后、治疗前；不把瞬时伤害包输出误称为 HP 已提交。死亡清理事件仍在既有 tick 尾部。

Claude 接入 `CombatViewEvent` 的 `movement.reason`，使用服务器给出的 `from/to`，按既有 `eventSeq` 去重；锁链/拳击分别识别以上两个字符串。结束位置以 `unitUpdated.changes.cell`/keyframe 为准；不要根据动画、姿态计数或未镜像坐标再算落点。若没有位移事件，仍按 `cast` 播放原地施法。

服务器既有 `mirrorReplayTick` 的 movement 分支通过对象展开保留 `reason`，只镜像 from/to；`CombatStream.view` 和 `toCombatReplayFor` 共用这条路径，无须修改 `src/server/`。本单测试运行真实 `CombatStream` 并序列化其 NET6 `combat-chunk` 形状，覆盖双方坐标、完整事件数量/序号和终局；遵守不联网要求，未启动 WebSocket 或访问外部服务。

## 实现接口（内部，不供服务器另算规则）

`src/simulation/combat-ambessa-dash.ts`：

```ts
dashAmbessaChain(ctx: AbilityContext, unit: S13Unit, target: S13Unit): void
settleAmbessaRetreats(ctx: AbilityContext): void
```

输入为 tick 私有工作副本；输出为同一 ctx 中的 `cell` 更新、movement 事件与落点保留。没有新公共命令或失败枚举。不能移动、无合法落点、落点占用/保留是无位移分支，不撤销原施法、不增加事件或 RNG 消耗。服务器继续只调用原有战斗公共入口。

接线仅在 `combat-g2-2.ts` 的 Ambessa 两分支、`combat-s13.ts` 的普通移动保留集/伤害后屏障、`combat-s13-abilities.ts` 的 tick 私有类型、`combat-types.ts` 的可选事件字段、`combat-replay-view.ts` 的移动白名单。

## 独立手算向量

坐标为 `(col,row)`、默认 7×8 odd-row 棋盘，固定 AD=100、零甲；锁链原伤害 250，拳击原伤害 500，rngState=42 不变。测试的期望坐标是字面量，不调用落点算法生成答案。

| 姿态/条件 | 起点 → 目标 | 期望落点/说明 |
| --- | --- | --- |
| 锁链正常/平局 | (1,3) → (5,3) | (4,3)，距离 3、E 优先 |
| 锁链已贴身 | (4,3) → (5,3) | (4,3)，当前格就是最近落点，原地不动、无位移事件 |
| 锁链目标六邻全占 | (1,3) → (5,3) | 原地，仍造成 250 |
| 锁链后方被占 | (1,3) → (5,3)，(2,4) 占用 | (4,3)，后方不影响前冲 |
| 锁链上/右边界 | (3,0) → (6,0) | (5,0) |
| 锁链自身六邻全占 | (1,3) → (5,3) | 原地，不穿封闭阻挡 |
| 锁链保留格 | (1,3) → (5,3)，保留 (4,3) | (5,4)，与 (5,2) 同为距离 4；E,E,SE,E 先于 E,E,NE,E |
| 拳击正常 | (3,4) → (3,3) | (3,5)，伤害先结算 |
| 拳击目标周围其他五格全占 | 同上 | (3,5)，后撤不需目标旁空格 |
| 拳击落点占用/保留 | 同上，(3,5) 不可用 | 原地，不横向绕行 |
| 拳击己方边界 | (3,7) → (3,6) | 原地 |
| 拳击左边界 | (0,4) → (0,3) | (0,5) |
| 拳击敌方单位 | enemy (3,3) → player (3,4) | (3,2) |
| 拳击目标在身后 | (3,4) → (3,5) | 原地，没有同时远离且回己方的邻格 |
| 两姿态目标先移动 | (1,3)，目标 (5,3) 普通移动到 (4,3) | 锁链 (3,3)，拳击 (1,4) |
| 两姿态旧目标已死亡 | (1,3)，旧目标尸体 (2,3)，新目标 (5,3) | 锁链 (4,3)，拳击 (1,4)；命中存活新目标 |
| 两姿态无活目标 | 仅死目标 | 原地、无 cast、mana 保持 100 |
| 拳击杀死目标/施法者同拍死亡 | (3,4) → (3,3) | 目标死仍后撤 (3,5)；施法者死则不撤 |

另外验证：眩晕/引导/深根均阻止两种位移；HP=0 但 alive、暂离的占位体仍阻挡；保留格即使原预订者已经离开仍不可落入；两姿态逐 tick JSON 往返后 state/events 相等；首遍 recorder、同步 replay、预算 1/3 的切片 replay 每帧相等，删改 reason 被 replay-divergence 拒绝；真实 PvP 预算 1/7 与同步完整 state/ledger 相等，两队公共流/回放/序列化帧相等。另用真实 mechanic 奖励收据取得安蓓萨、蓝霸符、圣盾使和狙击手的专注（增加射程以便贴身前施法），沿公共出售/部署/装备命令形成资源账本，从 (3,6) 不相邻起手，验证真实冲刺后的 `serializeMatch/restoreMatch` 严格认证及下一 tick 完整返回值相等。

## 验证结果与版本边界

验证命令均先 `export PATH=$HOME/.local/bin:$PATH`，保留原 `node_modules -> ../cat/node_modules`。Vitest 使用 `--configLoader runner --no-cache` 避开只读软链 `.vite-temp`；不改配置或门槛。

本次按“已与目标相邻时原地不动”收尾，保留手算向量中的伤害、RNG、位移事件数量与顺序断言；严格 Match 用例改为不相邻起手，仍要求真实位移发生、完整存档恢复相等及下一 tick 完整返回值相等。

本次指定验证：`npm test -- --configLoader runner --no-cache --maxWorkers=2 tests/ambessa-dash.test.ts tests/ambessa-dash-stream.test.ts`、`npm run typecheck`；两文件共 **32/32 项通过**，typecheck 与 `git diff --check` 通过。此前其他场景的验证记录不代表本次语义下重新验收通过。

**规则状态：待 v22 统一录制。** 已撤回本分支对 `docs/evidence/v21-opening-encounters/`、`tests/fixtures/v21-opening-encounters-herald-raw/manifest.json`、`tests/server/fixtures/battle-start.json` 的 v21 证据刷新，恢复为本地 `origin/multiplayer` 的原始字节。v21 verify 因规则变化而失败属于预期，本次不运行、不刷新；并入 v22 候选后统一录制。PR #417 不单独合并。

此前语义下的体积抽测（本次未重跑）：同一 esbuild 配置对 `src/server-entry/index.ts` 做 browser/ESM/es2022/bundle/minify，基线从 HEAD 读取本单修改的旧模块，不改工作区。minified **1,130,065 → 1,131,279 bytes（+1,214）**，gzip **326,646 → 327,087 bytes（+441）**。这是共享规则入口抽测，不等同完整 Vite 构建或 CI JS 门槛通过；未改 CI 门槛，未引入依赖。

本单不修改 epoch、digest 常量、golden 或历史断言。即使某组旧测试通过，也不表示新玩法可以使用旧 epoch 发布；本分支待 v22 统一录制，最终合并由用户决定。未运行完整历史/浏览器验收，未验证界面动画。

## 独立回退

本单不创建 commit。后续应把本功能保留为单独提交，拒绝该 P 决定时只回退该提交；不要整分支 reset 或覆盖其他人的工作。

未提交阶段按本单差异逐块撤销：删除 `combat-g2-2.ts` 中 `dashAmbessaChain` 导入/调用和 `ambessaRetreats` 入队；删除 `combat-s13.ts` 的导入、保留集接线与 `settleAmbessaRetreats` 调用；删掉两个 AbilityContext 字段；恢复 movement 类型与投影白名单；删除 `combat-ambessa-dash.ts` 和两份 `ambessa-dash*.test.ts`。保留来源报告，把本说明、S13 gap、UI/合同补充标记为已回退。无新持久化状态需要迁移；epoch 未录，因此也不需要撤销版本夹具。完整撤销接线后恢复原“只伤害/短晕，无施法位移”。
