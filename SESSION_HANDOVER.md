# 交接记录（2026-10-13，晚间更新）

## 0.0 高吞吐派单与输出铁律（2026-10-14 用户确认，从下一轮派单起严格执行）

1. **严禁过程半成品派单。** 跑测试、构建或排查中途不得输出"先行版/过渡版"派单；思考与工具调用间隙只写简短进度，不得出现"给 Opus""给 Codex"字样。所有派单只在回合最末尾、所有测试跑完且 DISPATCH 文档 push 完成后，集中一次性以代码块输出。
2. **拉满单次任务体量。** 取消小里程碑停顿。每条派单必须是端到端闭环大单：功能实现 + 边界处理 + 夹具更新 + 目标测试全绿 + 提 PR/转正，执行方单次会话自愈闭环到底。指挥 2 分钟内能写完的合同类型、接口占位、文档字段，由指挥在派单前直接推上 `multiplayer`，消除串行等待。
3. **Codex 测试指令只给目标集。** 子任务只要求 typecheck + 本次受影响的目标测试文件；不得要求"空闲机单跑全套长回放"。全套回归只在最终合并树上由指挥跑唯一一次。
4. **拉满横向并发度。** 不局限于 1 Opus + 1 Codex。每次盘点 backlog 后，只要修改目录不强冲突，一次开出 3～4 条并行派单，每条标明窗口编号、分支、目录边界、验收命令。

## 0.0.5 当前状态（2026-10-14 晚，指挥更新；以本节为准，§0.1–§0.4 为 10-13 的旧记录）

- `multiplayer` 头 `33ae068`。今天合入：#72 #73 #74 #71 #76 #75 #77 #78 #80 #81 #82(→#81) #83 #84 #85。#68 已关。
- **已完成**：T11/T12 夹具修复；T12 战中装备；T13-A 自动合成；T13-B R3/R4 随机掉落 + 消耗品（D1–D8 = A，格式 3，CONTENT `bd9c3a8e`、LOOT_REPLAY `5cd0487c`，NET_PROTOCOL 2）；C17/C18-A/C18-B 界面接线；SR-C18-05 性能；SR-B8-02 可恢复战斗任务（合同 §19）并已接 `resolveSlice`；SR-C19-01 日炎同拍漏脉冲修复；C19 两真人 + 六机器人整局 e2e（`tests/server/e2e/c19-full-match.mjs`，约 30 分钟）与共享 e2e harness。
- **最终验收（指挥在合并树 multiplayer+#85+#84 上）**：全套 209 文件 / 2626 用例，仅 `b8-resumable-battle` 启动预算与 `m5-replay` cannon 超时两条在 209 worker 并行时失败，空闲机单跑 19/19 通过，判定为负载噪声，预算未放宽。e2e：c6 c7 c12 c15 c17 c18 c18b×2 b6 c19-overtime-display c19-full-match 通过；复现脚本 seed 9/4/11 整局正常结束。
- **已知噪声**：全套并行时耗时断言不稳定，验货必须空闲机单跑后再判。`c18b-use-consumable` 高负载下偶发竞态（Opus 观察到一次，重跑通过）。
- **下一步**：用户两机真机整局（`docs/MULTIPLAYER_RELEASE_NOTES.md` 启动方式）；通过后 `multiplayer` 合 main（提醒：旧单机存档作废，save 格式 2→3、digest 已改四次）并部署。性能 SR-B8-03 未排期，不阻塞。
- 派单记录与各批结果见 `docs/DISPATCH_2026-10-14.md`。

## 0.0.7 backlog 处理结果（2026-10-14 深夜）

- P1、P2 已由 Opus 交付并合入（#88，multiplayer `d39ae18`）：工具四阶段可用（路由到单位身上的装备，合法性仍由 `previewConsumable` 判定）；掉线默认不接管，`CAT_TAKEOVER=1` 才启用 B6。
- P3/P4/P5 资料已由 Codex 交付并合入（#87，`docs/S13_RULES_GAP.md` §9，未实施）。结论：
  - P3 扣血：普通阶段 2/5/8/10/12 + 每个存活敌人 1 **与 14.24b 一致**（一手 14.8/14.9）；唯一差异是加时仍用 stage 6 的 12，标准 stage 7 为 17。待用户拍板 P3-A（加时基础 17）。
  - P4 经验：现行 2/2/6/10/20/36/48/76、最高 9 级 **与 14.24b 一致**；68/68 来自 16.1（跨赛季）。待用户拍板 P4-A（保持）或 P4-B（开 10 级，9→10=84，需新增 10 级商店概率等，1–2 人日）。
  - P5 宝珠：14.24b 逐轮球数与品质配比**未找到一手来源（U）**；现行八场共 15 球、1/2/3/2/2/2/2/1。建议 P5-A 保持并把采样器改为读冻结权重表（消除写死分界）。
  - 三项一次发布包（P3-A + P4-A + P5-A）估 3–5.5 人日，只改一次 digest。**用户 2026-10-14 深夜拍板按此包实施**，派单见 `docs/DISPATCH_2026-10-14.md` 第六批。
- 新增 P8（低）：`c18b-use-consumable` e2e 战斗中把工具拖到移动中的棋盘 token 偶发落空（首跑 5 项失败、重跑通过）；Opus 可改为按单位所在格判定落点或在 e2e 等 token 静止。

## 0.0.6 真机反馈与补内容 backlog（2026-10-14 晚，用户两机实测后口述；用户决定先合 main，后续按此慢慢补）

按设计、暂不改（用户已知）：无 1-1 选秀、首轮 0 金（M5/OPENING §3.1）；战中装备下场生效（T12 R2）。

| # | 项目 | 定性 | 归属 | 急迫度 |
| --- | --- | --- | --- | --- |
| P1 | 拆卸器/重铸器只能在备战用；规则与服务器 OPS 都允许四阶段，是界面没接战斗中/结算期的拖放 | bug | Opus（rendering/presentation，补 c18b e2e 战中分支） | 高，合 main 后第一批 |
| P2 | 掉线不要机器人接管：按云顶，掉线席位什么都不做、棋盘照打。现在 60 s 后机器人接管 | 产品决定 | Opus（`bot-driver` 增加 takeover 关闭开关，默认关；B6 接管代码保留）；部署前临时用 `CAT_TAKEOVER_SEC` 调极大 | 高，合 main 后第一批 |
| P3 | 扣血公式：现为阶段基础 2/5/8/10/12 + 对方存活单位数（不看星级/费用），用户感觉后期扣血不对 | 规则数值 | Codex，先收集 14.24b 一手公式（阶段基础 + 按星级/费用的单位伤害），写 S13_RULES_GAP 再改，改 digest | 中 |
| P4 | 经验阈值：用户到 10 级偏快；建议按成熟版本 8→9、9→10 各 68 | 规则数值 | Codex，同 P3 一起收集资料后改 | 中 |
| P5 | 每阶段宝珠个数（给几个球）按真云顶配置 | 规则内容 | Codex，R3 载体表修订 | 中 |
| P6 | 匹配时显示多个可能对手，人少后才唯一 | 产品/界面 | Codex 出配对预告合同字段 → Opus 界面 | 低 |
| P7 | 1-1 共享选秀、开局金币、战中装备即时生效 | 规则级 | 需用户再拍板，默认不做 | 低 |

## 0. 角色分工（2026-10-13 用户确认）

三个 AI 参与，职责如下。AGENTS.md 的目录权限不变：规则/测试/文档归 Codex，界面与 `src/server/` 归 Claude 流水线；只是 Claude 流水线内部再分两层。

| 角色 | 模型 | 做什么 | 不做什么 |
| --- | --- | --- | --- |
| 指挥 | Claude（本指挥会话） | 读交接与合同，拆任务、写派单提示词、交叉验货（跑测试、对照合同、答"测试过了吗/越界了吗/改玩法了吗"）、维护本文件、向用户汇报并提出待拍板项 | 不写功能代码；不替用户做玩法取舍 |
| 后端 | Codex（GPT） | `src/simulation/`、`tests/`、`scripts/`、`docs/` 合同；规则、经济、战斗、恢复校验、digest 与证据 | 不改 `src/server/`、`src/rendering/` |
| 前端 | Claude Opus 5.5 | `src/rendering/`、`src/presentation/`、`src/server/`（投影、房间状态机、网络）、AGENTS.md 列出的四个界面文件；e2e 脚本 `tests/server/e2e/` | 不改 `src/simulation/`、不自行算规则；需要新数据写 `docs/UI_REQUESTS.md` |

派单流程：指挥写提示词 → 用户转给对应模型 → 模型出 PR 合 `multiplayer` → 指挥验货 → 用户决定合并。Codex 的 PR 由指挥跑测试并对照合同；Opus 的 PR 由指挥检查是否越过目录、是否自行算规则，必要时再让 Codex 看一眼规则调用。

## 0.1 今晚交付与验货结果（2026-10-13 晚，指挥验货完成）

五个 PR 已验货，均未越界、未改玩法。验货方式：每个 PR 独立 worktree，typecheck + 对应测试 + 目录 diff；T12 另在空闲机上单独重跑耗时套件；最后把 #72+#73+#74+#71 合成一棵树跑 typecheck 与专项测试（通过）。

| PR | 范围 | 核心文件与逻辑 | 验货结论 |
| --- | --- | --- | --- |
| #72 T11 夹具 | Codex，tests/docs | `tests/m8-b5-equipment-history`、`m8-b5-temporary` 的等级/经验预期按 1-4 +2 修正；`docs/evidence/t11/README.md` 补原因 | **通过**。38 条全绿 |
| #73 C15 PvP 回放装备图标 | Opus，server+rendering | `src/server/room/projection.ts` 新增 `SeatReplay.unitIds`，来自 `BattleResult.battle.mapping`，只过滤 `kind==='unit'` 且本席 seatId，a/b 两侧同函数，PvE 空数组；`src/server/net/messages.ts` `readReplayUnitIds` 结构校验；`remote-session.ts` `equipmentOwnerId()` 把战斗 ID 换回原 ID；`BoardScene.reconcileTokens` 读装备前先换 ID。不解析 ID 字符串，不下发对手/物品条目 | **通过**。typecheck、`tests/server` 新用例、真服务器 e2e（两真人六机器人）通过；projection 双重过滤已逐行核对 |
| #74 C16 装备 UI 全读 previewEquip | Opus，rendering/presentation | `strategy-panel.ts`：`itemsOpen()` 不看阶段，`equipAt()` 先 `previewEquip` 再发命令；状态行按阶段描述、不写死"已锁定"；`equipment-feedback.ts` 未知失败码走 `EQUIPMENT_FAILURE_FALLBACK`；`BoardScene` 装备命令拒绝走装备文案表 | **通过**。typecheck，e2e c16/c7/c12/c8 共 79 条全绿；UI 没有自行判断装备合法性 |
| #71 T12 战中装备永不锁定（R2） | Codex，simulation/tests/docs | `operation-policy.ts` 新增 `canOperateEquipment`（四阶段、单人联机同用）与 `equipment-ops-next-battle-v1`；`item-selectors.ts` previewEquip/previewCombine 改用它，删掉棋盘目标锁；`inventory.ts` validateEquip/planEquip 支持"库存组件 + 身上组件"原子合成并留在目标槽；`match.ts` equipItem 记 `item-combined` 来源；`b8-restore.ts`/`resource-provenance.ts` 接受战中合成的 suffix；digest b4a5c2e2 → **44fe9c0e**；合同 §17、MATCH_CONTRACT T12、S13_RULES_GAP §2.6、UI_REQUESTS 接线说明 | **通过**。typecheck；T12 四文件 60 条；B5/B8/T10/T11 回归 244 条；T1 入口 165 状态字节一致；`tests/server` 并行时 4 条耗时断言失败，空闲机单跑 30/30 通过，判定为 CPU 争用 |
| #75 R3+R4 掉落设计稿 | Codex，docs（draft） | `docs/M8B_LOOT.md` §11、`MULTIPLAYER_CONTRACT.md` §17 草案、新建 `docs/R3R4_LOOT_DESIGN.md`（估 9–15 人日，D1–D8 待拍板） | 文档，无代码。**合并前需改编号**：与 T12 的合同 §17 撞号，应改为 §18 |

**合并顺序（已用试合并验证）**：#72 → #73 → #74 → #71 → #75。
- #71 与 #73 在 `docs/UI_REQUESTS.md` 末尾冲突（两段各自追加），保留两段即可；建议 Codex 先把 `multiplayer` 合进 `codex/t12-combat-equip` 再合。
- #75 与 #71 在 `docs/MULTIPLAYER_CONTRACT.md` 冲突（都新增 §17），Codex 在 T12 合入后把草案改成 §18 并重新合 `multiplayer`。
- 四个代码 PR 合成一棵树后 typecheck 通过、T12/C15 专项 61 条通过。

## 0.2 遗留问题与未解 bug

- **T11 遗留的基线测试失败（新发现，P1）**：`multiplayer` 基线上除 #72 修的 9 条外，还有 9 个文件因 1-4 经验 +2 而失败，PR #70 验货时只跑了专项没发现：`tests/match-session`、`match-lifecycle`（升级后 xp 应为 2 不是 0）；`m8-b8-live-growth`、`m8-b8-live-capacity`（金币 26≠19）、`m8-b8-live-transfer`、`m8-b8-loot-view`、`m8-b10-temporary-replay`（固定购买序列遇 `stale-shop`）；`m8-b8-live-reveal`（战斗提前进入 settlement）；`m8-content-equivalence`（录制存档 digest 过期）。全是夹具路线失效，不是规则 bug。需 Codex 单独 PR 修夹具，T12 合入后 digest 又变，`m8-content-equivalence` 要按 44fe9c0e 重录。
- **耗时预算类测试在 4 核机上不稳定**：`tests/server` 的 bot-driver/room/round-commit/local-room-client 在整套并行时超预算，单跑通过。验货时须空闲机单跑，否则会误判。
- **T12 小出入（不阻塞）**：成装拖到被组件占用的槽返回 `invalid-recipe` 而非 `item-slot-occupied`，只影响提示文案，C16 的文案表已能显示。
- **T12 之后的界面项未做**：拖组件到已带组件的单位自动合成（T12 已提供 `previewEquip(...).combination`，C16 的 `equipAt` 目前按槽位走，拖到棋盘单位仍取"第一个允许的槽"，已带组件的槽现在也会被预览允许，实际行为需真机确认）；战中装备"下场生效"的提示文案。
- **真机未验证**：C10–C16 全部只过 e2e，没人工试玩；T12 的战中装备更没有真人试过。
- **部署未做**：`docs/MULTIPLAYER_RELEASE_NOTES.md` 的 systemd + Caddy 步骤未在任何服务器执行。
- **旧单机存档作废**：digest 今天第三次变更（b4a5c2e2 → 44fe9c0e），合 main 时要提醒。
- 性能项 SR-B8-02/03 未排期，不阻塞上线。
- PR #68（S13 规则差异文档）仍开着，内容已随 #70 进入 `multiplayer`，可直接关闭。

## 0.3 明天第一步

1. **用户合并**：按 #72 → #73 → #74 顺序合；然后让 Codex 把 `multiplayer` 合进 T12 分支解决 `UI_REQUESTS.md` 冲突后合 #71；再让 Codex 把 #75 的 §17 改 §18 后合。关闭 #68。
2. **派 Codex**：T11/T12 夹具修复 PR（上面 9 个文件 + `m8-content-equivalence` 按新 digest 重录），要求跑 `npm test` 全套并如实报告，目标是 `multiplayer` 全套绿。
3. **派 Opus 5.5**：C17 战中装备真机接线收尾：拖组件到已带组件单位时读 `previewEquip(...).combination` 显示"将合成 X"，成功提示"下场生效"；跑 c16 e2e 的"允许槽"分支（T12 合入后该分支才会触发）。
4. **用户拍板** `docs/R3R4_LOOT_DESIGN.md` §6 的 D1–D8，建议全部按 Codex 推荐（A）签；签完派 Codex 实施 R3+R4。
5. **用户真机试玩一整局**（两台电脑，`npm run serve:game` + `npx vite --host`），重点：战斗中给棋盘单位穿装备、下一场生效；PvP 回放看到自己单位的装备图标；战斗中买牌/刷新/自动上场；结算显示利息和经验。

## 0.4 联机收尾还剩什么

T12（验货通过，待合并）→ 夹具修复 → R3+R4 掉落系统 → T9 两机真机整局验收 → 合 main（提醒旧单机存档作废，digest 已改三次）→ 按 `docs/MULTIPLAYER_RELEASE_NOTES.md` 部署。性能项 SR-B8-02/03 不阻塞上线。

---

以下为白天的原记录。

分支：`multiplayer`（1cf3b80），今天合入 6 个 PR（#61–#66），类型检查与 22 文件/150 个服务器用例全绿。main 未动，正式站 `/cat/` 仍是单机版。

## 1. 今天改了什么

| 范围 | PR | 文件 | 做了什么 |
| --- | --- | --- | --- |
| 结算掉落（C9） | #61 | `src/presentation/loot-view.ts`、`src/rendering/online/seat-view-adapter.ts`、`strategy-panel.ts` | 联机结算面板改读 `privateView.revealedLoot`（合同 §14.1），与单机共用 `lootRevealedSection`；删除 `round-gains.ts` 快照差分。修复重连不显示、掉落即升星漏列、战后扣费抵掉金币三类失真 |
| 回放重复棋子（C10） | #62 | `src/rendering/BoardScene.ts` | PvP 回放用战斗 ID，备战 token 不再为棋盘单位重复建；死亡棋子不消失同根因，一并修复。e2e `c10-duplicate-token.mjs` |
| 经济取证（C11） | #64 | `strategy-panel.ts`、e2e `c11-economy.mjs` | 证明利息与每回合 +2 经验规则正确（1-x 固定 2/3/5 金币、2/2/0 经验；2-1 起每 10 金币 1 利息上限 5）。结算摘要行直接显示利息和经验，顶部改为"预计利息" |
| 死亡棋子与 C8 时序（C13） | #63 | e2e `c13-dead-tokens.mjs`、`swap-checks.mjs`、`c7-playtest.mjs` | 只保留测试；swap-checks 每步核对 `state.phase === 'preparation'`，C7 E2E 的 `CAT_PREP_SEC` 15→25（SR-C8-01） |
| 战斗运营规则（T10） | #65 | `src/simulation/*`、合同 §15 | combat/choice/settlement 允许商店、经验、库存合成、备战席操作；战中三合一只合备战席，棋盘参与的合并延迟到战后；`autoDeployToCap` 准备截止自动上场（备战槽从左到右，前排起每行按 3/2/4/1/5/0/6 找空格）。digest 20b58a63 → a0b38123，旧档拒绝 |
| 战斗运营接线（C12） | #66 | `src/server/room/room.ts`、`remote-session.ts`、`strategy-panel.ts`、`BoardScene.ts` | 阶段闸门按 §15.2 允许矩阵；截止对真人席调用 `autoDeployToCap`，PvP 用 `lockMatchCombatRoster`；结算以最新 live state 为准。P1 修复：卖空阵容的 PvE 席被规则提前结算后，战中合法操作不再导致 `invalid-results` 整局结束 |

验货方式（已固定）：Codex 的 PR 由 Claude 跑测试并对照合同；Claude 的 PR 由 Codex 跑 typecheck、`tests/server`、相关 e2e，只回答"测试过了吗、越界了吗、改玩法了吗"。

## 2. 遗留问题

- **真机未验证**：今天所有修复只过了 e2e，用户在 C9 之前试过一局（结算掉落、重连面板正常），C10–C12 之后没再人工试玩。
- **用户未拍板**：把组件拖到已带组件的单位上是否自动合成（TFT 行为）。现在只能在装备页点选两件再合成。
- **PvP 战斗中我方单位不显示装备图标**：回放用战斗 ID 查不到装备，C10 之前也如此。需要服务器在回放里给我方单位附原始 ID，尚未写入 `UI_REQUESTS.md`。
- **性能**（未排期）：PvP 一场战斗仍完整执行两次（SR-B8-02）；PvE 每 tick 池守恒检查约 4.6 s/局（SR-B8-03）。
- **已知测试噪音**：`npm run test:browser` 的 golden 内容 digest 仍是旧值，在 multiplayer 基线上即失败；`tests/m5-replay`、`m6-integration` 并行跑会超时。慢机器上 e2e 的端口占用需改 `CHROMIUM`/端口参数。
- **部署未做**：`docs/MULTIPLAYER_RELEASE_NOTES.md` 有 systemd + Caddy 步骤，尚未在任何服务器执行。

## 3. 明天第一步

1. 用户两台电脑试一整局（A 机 `npm run serve:game` + `npx vite --host`，两边开 `?mode=online&server=ws&name=…`）。重点验证五项：战斗中能买牌、刷新、买经验、动备战席；准备倒计时结束后备战席棋子自动补上前排；棋盘一张加备战两张在战斗中凑齐时战后才合并；PvP 回放无重复棋子、死亡棋子消失；结算摘要行显示利息和经验。
2. 发现 bug 按今天的流程派单：界面与服务器归 Claude，规则归 Codex，交叉验货后合入 `multiplayer`。
3. 试玩通过后决定合 main 与部署：`git checkout main && git merge multiplayer`，按发布说明 §2–§4 部署；合 main 前提醒用户旧单机存档会因规则版本变化作废（digest 已两次变更）。

## 4. 派单提示词（2026-10-13 晚，指挥拟；三项均已交付：#73、#74、#75）

### 4.1 给 Opus 5.5：C15 PvP 回放显示我方单位装备图标

现象：PvP 战斗回放里我方单位不显示装备图标（交接遗留项）。原因：回放 `CombatViewState` 内的单位 ID 是战斗 ID（合同 §10：`JSON.stringify(['t2', seatId, kind, originalId])`），客户端按它查不到本席 `items`；合同明确"不按字符串切割推断"，所以客户端不能自己解析。
做法：服务器在 `src/server/room/projection.ts` 的 `SeatReplay` 增加本席专用映射 `unitIds: { combatId: string; originalId: string }[]`，只含 `kind==='unit'` 且 `seatId` 为本席的条目，来源是 `BattleResult.battle.mapping`（`BattleIdMapping`）；PvE 的 placeholder 战斗没有映射，`unitIds` 为空数组，客户端按现有逻辑直接用原 ID。镜像席（b 侧）同样只给自己的条目。不下发对手映射，不下发 item/augment/anomaly 条目。`src/server/net/messages.ts` 的推送结构同步加字段并更新结构校验。客户端 `src/rendering/BoardScene.ts` 回放建 token 时，用映射把战斗 ID 换成原 ID 再读装备（沿用现有 `readUnitEquipment`/图标路径），找不到映射就不显示装备，不报错。
约束：不改 `src/simulation/`；不解析战斗 ID 字符串；不改回放 tick、事件或结果。
测试：`tests/server/` 加投影用例（a 侧、b 侧各只拿到自己的单位映射，PvE 为空，对手条目不出现）；e2e `tests/server/e2e/` 加一条：两席各带一件装备进 PvP，回放期间双方各自看到自己单位的装备图标，对手单位按现状。跑 `npm run typecheck`、`npx vitest run tests/server`、新 e2e。
交付：PR 合 `multiplayer`，标题 `C15: own-unit equipment icons in PvP replay`。在 `docs/UI_REQUESTS.md` 记一条已解决项说明字段形状。

### 4.2 给 Opus 5.5：C16 装备操作完全按 previewEquip，为 T12 预接线

背景：T12（PR #71，Codex 进行中）会把装备/合成放开到 combat/choice/settlement 四阶段，并允许库存组件直接合到棋盘单位身上已穿的组件。现在界面在 `src/rendering/strategy-panel.ts`（第 39 行附近的阶段文案、第 379 行附近 "棋盘单位锁定到下个准备阶段"）和 `BoardScene` 的拖放判断里自己写死了"战斗中棋盘单位不可装备"，违反"界面只读规则结果"的约定。
做法：所有装备目标能否放、放到哪个槽、提示什么，一律以 `previewEquip(state, itemId, unitId, slot)` 的 `allowed/reason/conflictingItemIds` 为准，删掉界面自己的阶段判断；拒绝文案继续走 `src/presentation/equipment-feedback.ts` 的 `EQUIPMENT_FAILURE_TEXT`。状态行文案改为按阶段描述可做的事（例如战斗中："可购买、刷新、买经验、整理备战席；装备以单位提示为准"），不再写死"已锁定"。合成按钮继续读 `previewCombine`。T12 合入后不需要再改界面即可生效；T12 合入前行为与现在完全一致（因为 previewEquip 现在就拒绝战中棋盘目标）。
约束：不改 `src/simulation/`；不预判 T12 的新失败码，未知 reason 显示通用文案；不改拖放手感和布局。
测试：现有 `tests/server/e2e/swap-checks.mjs`、`c7-playtest.mjs`、`c12-combat-ops.mjs` 必须照常通过；补一条 e2e：战斗中把装备拖到棋盘单位上，提示文案与 `previewEquip` 的 reason 对应文案一致。
交付：PR 合 `multiplayer`，标题 `C16: equipment UI follows previewEquip in every phase`。与 C15 分开 PR。

### 4.3 给 Codex：R3+R4 掉落系统设计稿与合同草案（只写文档，不写代码）

基线 `origin/multiplayer@25dae94`，分支 `codex/r3r4-loot-design`，只改 `docs/`。按 `docs/S13_RULES_GAP.md` §3（R3 野怪宝珠）和 §4（R4 拆卸器与重铸器）已签字的方向，产出：
1. `docs/M8B_LOOT.md` 修订草案（标明"草案，未签字"）：宝珠品质体系（灰/蓝/金/棱彩）、同局各席数量与品质一致政策、开局累计 2–3 组件价值、PvE 改随机、保留五次 `.4` 自选；拆卸器、重铸器三个项目消耗品的定义、来源、一次性语义、使用阶段（结合 R2 四阶段装备权限）、失败原因。每个数值标注来源等级（S1–S9/L1）或"项目自定"。
2. `docs/MULTIPLAYER_CONTRACT.md` 新节草案：新增/修改的公共命令签名、`revealedLoot` 投影字段变化、共享池影响、失败枚举。
3. 工作量与版本：影响文件清单、需要的新细分版本名、与 T12 的 digest 合并发布方案（S13_RULES_GAP §2.5 建议统一升级）、测试清单。
4. 列出需要用户拍板的数值或取舍（每项给选项和建议）。
不改 `src/`、`tests/`，不改 digest。PR 合 `multiplayer`，标题 `docs: R3+R4 loot system design draft`。
