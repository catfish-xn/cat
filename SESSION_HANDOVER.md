# 交接记录（2026-10-13）

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
