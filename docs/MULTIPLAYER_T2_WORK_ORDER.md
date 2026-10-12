# T2 派工单：真实双方战斗

日期：2026-10-12
派给：Codex（GPT）
依据：`docs/MULTIPLAYER_RENOVATION_V2.md` 第 3.3 节与 N2、`docs/MULTIPLAYER_CONTRACT.md` 第 4 节、PR #32 里你写的 T2 最小范围建议（已采纳）

## 0 先读这一段

- `multiplayer` 已合入 PR #32（你的 T1）和 PR #33（Claude 的联机界面）。拉最新 `origin/multiplayer` 再开分支。
- Claude 的 B1（`src/server/room/`，PR #35）正在验货。它定义了一个可替换的 `battle-resolver.ts` 接口，占位实现只跑单人战斗。**T2 的产出就是替换这个占位的真实实现**，所以请看一眼 PR #35 的 `src/server/room/battle-resolver.ts` 和 `types.ts` 里 `BattleInput`/`BattleResult` 的形状；如果你认为形状应该改，在合同里写明理由，由 Claude 改 `src/server/`，你不要直接改。
- **Node 版本统一为 22.x**（CI、`AGENTS.md`、部署目标都是 22；Claude 环境是 22.22）。你本机的 24 请用 nvm/fnm 切到 22 LTS 后再跑验证，报告里写实际版本。不要为了 24 改任何配置。
- `tests/m5-replay.test.ts` 的三个超时是既有问题，不要修，不要改阈值，报告里单列即可。

## 1 任务目标

让两名玩家各自真实拥有的阵容进入**同一场** Combat，产出**一份**权威结果，并能把结果映射回双方席位。现在的 `startMatchCombat` 只会打固定敌军模板；T2 之后，A 的对手就是 B 的真实棋子、装备、强化、异常和持久成长。

一句话判据：**换掉 B 的阵容，A 的结果按独立预期变化；双方装备、羁绊、强化、异常、成长都生效；同一输入永远同一结果。**

## 2 起点

| 项目 | 值 |
| --- | --- |
| 开发分支 | `codex/t2-two-sided-battle`，从最新 `origin/multiplayer` 开出 |
| 合入目标 | `multiplayer` |
| 可改 | `src/simulation/`、`src/server-entry/`、`tests/`、`scripts/`、合同文档 |
| 不改 | `src/server/`、`src/rendering/`、`main`、单人战斗的现有行为与 golden |

## 3 实施范围

1. **PlayerBattleSnapshot**：定义一方的可信战斗快照类型：席位标识、上场单位（含星级、位置）、每单位装备、强化、异常绑定、持久成长，以及快照版本号。从 `MatchState` 导出快照的纯函数 `snapshotForBattle(state, seatId)`，只取合法上场单位，不含商店、金币、随机流。
2. **双方编译器**：`compileBattle(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number): BattleInput`。要处理：
   - 坐标：B 的棋盘按行镜像到敌方部署区；A 保持原样。
   - 身份：双方可能有相同的原始 unit id、item id、强化 id。战斗内 id 必须用席位命名空间隔离，并保留回映射表。
   - 效果来源：装备、羁绊、强化、异常、成长的来源身份不能碰撞；羁绊按各自阵容分别计算。
   - 随机：战斗 RNG 只来自 `battleSeed`，不读任何一方 MatchState 的随机流。
3. **受信多人战斗入口**：`startTwoSidedCombat(input: BattleInput): CombatState` 和复用现有 `stepCombat`（或等价），产出 `BattleResult`：`battleId`、胜方席位或平局、双方存活者（已映射回原始 id）、双方成长回写、完整事件账本。旧单人入口不动。
4. **结算提案（不提交）**：`proposeSettlement(result: BattleResult): { a: SideProposal; b: SideProposal }`，给出每方的伤害数值（基础伤害 + 存活单位数，从选定基线的正式数值提取，不用 CC 文档的"stage + 2"）、成长回写、事件。只算不扣，扣血与唯一收据是 T3。
5. **导出**：以上全部经 `src/server-entry/index.ts` 导出，合同新增第 10 节「双方战斗接口」：签名、输入输出、失败枚举（例如 `empty-both`、`snapshot-version`、`seat-collision`）、确定性保证。
6. **测试**（文件名以 `t2-` 开头）：
   - 已知答案的简单对局（例如 1 星单位 1v1），胜负与存活数有独立手算预期。
   - A 固定，B 换强弱两套阵容，A 的结果按预期变化。
   - 双方同时持有同一装备、同一 unit 原始 id、同一强化，所有权和来源不串。
   - 交换 a/b 位置：身份映射正确；平局破同顺序按合同，不假设完全对称。
   - 空阵容对非空、双方空、战斗到时间上限平局。
   - 持久成长只回写给正确席位。
   - 同一 `BattleInput` 运行两次，`BattleResult` deepEqual。
   - 原单人测试全部不变（不改 golden）。
7. **合同清理**：T2 合入前，把 `MULTIPLAYER_CONTRACT.md` 里"房间、邀请码、房主开始、准备键"的旧表述按 `AGENTS.md` 产品决定 2–4 条改为单一匹配队列和隐藏座位凭证。这是你在 PR #32 承诺的事项，一并做掉。

## 4 验收标准

- [ ] A 对真实 B 在同一 Combat，B 换阵容时 A 的结果按独立预期变化（不是"两个结果不一样"就算过）。
- [ ] 装备、羁绊、强化、异常、持久成长在双方都生效，至少一组覆盖全部五类。
- [ ] 相同原始 id 不串所有权；交换双方后映射正确。
- [ ] 同输入同结果；战斗 RNG 只来自 `battleSeed`。
- [ ] 伤害数值有来源说明（引用规则文件和行）。
- [ ] `npm run typecheck`、`npm run build`、`npm run test:server-entry`、新 `t2-*` 测试通过；现有单人测试与 golden 零改动。
- [ ] 合同第 10 节能让 Claude 只看文档就实现 `battle-resolver.ts`。
- [ ] Node 22 下验证，报告写实际版本。

## 5 禁止事项

- 不改单人战斗数值、顺序或 golden。
- 不做扣血、淘汰、收据（T3）、共享卡池（TP）、机器人、网络。
- 不碰 `src/server/`、`src/rendering/`。
- 不为了方便把 B 退化成固定模板或裸棋子。

## 6 交付格式

按 `AGENTS.md` 汇报格式，另附：实际 Node 版本与提交哈希；每条测试对应的验收项；合同第 10 节链接；T3 最小范围建议（一段话）。开 PR 到 `multiplayer`，由 Claude 交叉验货后合入。
