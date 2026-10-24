# 开局奇遇 A/B 合并报告（2026-10-23）

## 范围与结论

工作目录 `/home/aiapps/workspcae/cat-v22`，分支 `codex/v22-candidate`。合并输入 A 为 `bbe8730e88abf4b88093c8b8a9eaa5b29ea38b06`，B（MERGE_HEAD）为 `2e1a9d3f1afc866b0af8d275d70ae3f49fbda31d`。在用户已经执行的 merge 上解决工作树冲突；没有执行 git add、commit、联网或修改 CI。索引仍显示 8 个 UU，等待用户暂存；这不表示工作树仍有冲突标记。

保留 A 的梅尔、维克托、两个订阅、普通六费和 B 的魔像、沃里克、两种蟹。没有修改任何数值、随机流名、收据前缀、identity/digest 常量或历史夹具。B 分支已带入的 `src/rendering/online/stage-track.ts` 名称映射原样保留，本次未编辑界面文件。

## 八个冲突文件的处理

| 冲突文件 | 合并方式 |
| --- | --- |
| `docs/MATCH_CONTRACT.md` | 按 A、B 顺序保留两份覆盖合同及报告链接，两者同时覆盖各自历史停用说明。 |
| `docs/S13_RULES_GAP.md` | 保留双方完整批准表、来源等级、库存边界、加时语义和待统一 epoch 说明；不改表内数值。 |
| `src/simulation/b8-restore.ts` | 同时导入 A 奖励投影与 B 蟹载体映射；A 本人战斗排队法球验证继续成立，B 死亡身份与资格认证仍使用实际蟹载体。 |
| `src/simulation/content/opening-encounters.ts` | 同时保留 `batchA` / `batchB` 政策和八项启用状态。版本字串沿用 A 的 `opening-encounters-14.24b-batch-a-v1`，不回退 B 的旧 PR 版本，也不另录统一 epoch。 |
| `src/simulation/match.ts` | 合并双方导入/导出，保留 A 六费上下文、订阅阶段入口及 B 奖励读取、魔像成长、蟹替换、锻造器和终局处理。自动合并的生命周期调用也已核对。 |
| `src/simulation/opening-encounter.ts` | 恢复时依次执行 A 奖励、魔像、B 奖励认证；保留订阅/梅尔路径及 B 初始化/沃里克路径，失败返回原始入参状态。 |
| `src/simulation/orb-claim.ts` | B 的同名导出使用本地别名；待领投影同时拼入两批奖励，单人准入接受两个前缀，各自调用自己的领取器。A 战斗中排队，B 锁定战斗阵容时拒领；双方失败原因与共享池要求不互换。 |
| `src/simulation/orb-restore.ts` | 同时保留 A 排队奖励投影与 B 蟹死亡载体认证。B 原设计不允许战斗中排队，因此没有把 B 前缀加入可恢复队列白名单。 |

额外修改 `tests/opening-encounters.test.ts`：全部奇遇合并启用后，`as const` 推导使 `readiness` 只剩 `ready-for-followup`，旧分支比较触发 TS2367。仅引入局部 `const readiness: string = e.readiness` 后执行相同判断；所有 expect、预期值、分支条件及运行行为不变。该文件旧失败仍保留，没有为了变绿删改断言。

## 收据、流与恢复边界

- A：`opening-reward:`、`opening-encounter-batch-a`、订阅 `opening-batch-a` fact 和原梅尔门槛身份全部保留。`shared/mels-blessing/outcome`、`shared/<subscription>/stage/<stage>`、个人奖励/forge/six-cost-shop 流保持原样。
- B：`opening-batch-b/` 奖励、`opening-batch-b/trainer-golems` 及纹章子收据、`opening-batch-b` / `opening-trainer-golems` 来源全部保留。个人 trainer-golems/emblems、warwicks-hunger、bonus 和 forge 流保持原样。
- 两批随机模块未编辑。恢复时两批验证器都执行，不按当前奇遇过滤掉另一批验证器；各自重算奖励、验证来源与已有收据，不在恢复时补发。
- 合并不代表 epoch 兼容：配置中已同时包含两个政策，但保留开发版版本字串和旧 identity 常量。旧存档/历史录制不能据此宣称兼容。

## 验证

日志与 JSON 原始结果保存在 `/tmp/v22-encounter-merge/`，不提交生成物。依赖沿现有 node_modules 软链；使用 `--configLoader runner` 避免默认加载器写只读依赖目录。

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
npm test -- --configLoader runner tests/opening-encounters-batch-a.test.ts tests/opening-encounters-batch-b.test.ts
npm test -- --configLoader runner --maxWorkers=4 opening-encounters orb b8 match-contract t3-round-settlement t5r-private-seat-view opening-random-identity
```

最终 `npm run typecheck` 通过（退出码 0）。两批单独运行 **165/165 通过**：A 94、B 71。相关 fast 集合 **39 文件：19 通过、20 失败；930 用例：717 通过、188 失败、25 跳过；另有 6 个套件级错误**。两批测试已包含在 930 中，不重复累计。修复类型标注后单独复核旧奇遇测试仍是 3 通过 / 3 失败，断言结果未变化。

为识别合并回归，使用 `git archive` 只读导出 A/B 原提交到 `/tmp`，对当前失败的 20 文件逐项对照。初次导出漏带 docs 造成额外 13 个证据文件 ENOENT，补齐各自 docs 后重跑 identity 文件；这些临时环境错误不计为基线证据。下列每个当前失败均在至少一方原提交出现，6 个套件错误均与 B 相同。**本次所选测试发现的新增合并失败为 0**；这不等于全套测试或发布验收通过。

B8 timing 项目按原门槛单独运行 **12/12 通过**（1 文件），未与其他测试争用工作线程：

```sh
npm run test:timing -- --configLoader runner tests/b8-resumable-battle-timing.test.ts
```

最终不重复计数共 **40 文件、942 用例：729 通过、188 失败、25 跳过；另有 6 个套件级错误**。冲突标记扫描为 0，`git diff --check` 通过。

### 当前相关 fast 结果（逐文件）

| 文件（tests/ 下） | 通过 | 失败 | 跳过/未执行 | 套件错误 |
| --- | ---: | ---: | ---: | --- |
| `b8-resumable-battle.test.ts` | 12 | 3 | 0 | — |
| `loot-orb-claim.test.ts` | 24 | 3 | 0 | — |
| `m8-b8-acquisition.test.ts` | 12 | 0 | 0 | — |
| `m8-b8-combat-input.test.ts` | 36 | 2 | 0 | — |
| `m8-b8-command-oracle.test.ts` | 6 | 0 | 0 | — |
| `m8-b8-copy-semantics.test.ts` | 6 | 0 | 0 | — |
| `m8-b8-equipment-fixture.test.ts` | 4 | 0 | 0 | — |
| `m8-b8-golden-guard.test.mjs` | 24 | 0 | 0 | — |
| `m8-b8-input-evidence.test.mjs` | 32 | 0 | 0 | — |
| `m8-b8-live-capacity.test.ts` | 0 | 0 | 0 | earned source must be dead |
| `m8-b8-live-cross-round.test.ts` | 5 | 1 | 0 | — |
| `m8-b8-live-economy.test.ts` | 0 | 3 | 0 | — |
| `m8-b8-live-growth.test.ts` | 0 | 0 | 0 | earned source must be dead |
| `m8-b8-live-reveal.test.ts` | 0 | 0 | 0 | card-equivalent conservation |
| `m8-b8-live-transfer.test.ts` | 0 | 0 | 0 | earned source must be dead |
| `m8-b8-loot-freeze.test.ts` | 66 | 0 | 0 | — |
| `m8-b8-loot-runtime.test.ts` | 11 | 7 | 0 | — |
| `m8-b8-loot-view.test.ts` | 0 | 0 | 0 | earned source must be dead |
| `m8-b8-oracle.test.ts` | 0 | 0 | 25 | earned source must be dead |
| `m8-b8-resource-provenance.test.ts` | 64 | 0 | 0 | — |
| `m8-b8-restore-fold-reuse.test.ts` | 5 | 0 | 0 | — |
| `m8-b8-restore.test.ts` | 7 | 0 | 0 | — |
| `m8-b8-token-lifecycle.test.ts` | 3 | 0 | 0 | — |
| `match-contract.test.ts` | 12 | 0 | 0 | — |
| `opening-encounters-batch-a.test.ts` | 94 | 0 | 0 | — |
| `opening-encounters-batch-b.test.ts` | 71 | 0 | 0 | — |
| `opening-encounters-integration.test.ts` | 37 | 1 | 0 | — |
| `opening-encounters-pr2.test.ts` | 30 | 1 | 0 | — |
| `opening-encounters-pr5.test.ts` | 31 | 0 | 0 | — |
| `opening-encounters-pr6.test.ts` | 28 | 14 | 0 | — |
| `opening-encounters-trainer-golems.test.ts` | 29 | 6 | 0 | — |
| `opening-encounters.test.ts` | 3 | 3 | 0 | — |
| `opening-random-identity.test.ts` | 16 | 135 | 0 | — |
| `t3-round-settlement.test.ts` | 11 | 0 | 0 | — |
| `t5r-private-seat-view.test.ts` | 8 | 8 | 0 | — |
| `v17-orb-combo.test.ts` | 10 | 1 | 0 | — |
| `server/v15-orb-claim.test.ts` | 8 | 0 | 0 | — |
| `server/v15-orb-ui.test.ts` | 9 | 0 | 0 | — |
| `server/v15-terminal-orbs.test.ts` | 3 | 0 | 0 | — |

### 保留的失败清单及基线归属

A/B 表示该失败用例在对应原提交中实测复现。失败分为：139 项 identity/digest/历史指纹，24 项旧关闭语义，25 项旧怪物/奖励/文案等相关预期；套件级错误另列。没有修改这些预期、历史文件或数值。

#### b8-resumable-battle.test.ts

- A/B：`SR-B8-02 resumable pure tasks pre-change byte fingerprint: 0 units per side`
- A/B：`SR-B8-02 resumable pure tasks pre-change byte fingerprint: 1 units per side`
- A/B：`SR-B8-02 resumable pure tasks pre-change byte fingerprint: 9 units per side`

#### loot-orb-claim.test.ts

- B：`multiplayer explicit orb claims retains a revealed 2-7 orb into 3-1 and pays its entries once in entryOrdinal order`
- B：`multiplayer explicit orb claims combat accepts FIFO intent, then settles using actual capacity (sell during combat: false)`
- B：`multiplayer explicit orb claims combat accepts FIFO intent, then settles using actual capacity (sell during combat: true)`

#### m8-b8-combat-input.test.ts

- B：`B8 combat input basis pure prerequisites (not live Match integration) binds public later-round inputs, skips supply battle seeds and preserves original G12 children`
- B：`shared current/basis asset validation rejects unit array at both restore boundaries with their own errors`

#### m8-b8-live-capacity.test.ts

套件级错误：`earned source must be dead`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### m8-b8-live-cross-round.test.ts

- B：`B8 loot carried across rounds: combine, equip, fight and sell arrives at 2-1 with the frozen opening rewards and only current-round loot in the view`

#### m8-b8-live-economy.test.ts

- B：`B8 live gold before interest, randomized direct loot 9 G plus earned 1G settles to 16 once, across exact restore/Continue`
- B：`B8 live gold before interest, randomized direct loot 49 G plus earned 1G settles to 60 once, across exact restore/Continue`
- B：`B8 live gold before interest, randomized direct loot 50 G plus earned 1G settles to 61 once, across exact restore/Continue`

#### m8-b8-live-growth.test.ts

套件级错误：`earned source must be dead`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### m8-b8-live-reveal.test.ts

套件级错误：`card-equivalent conservation`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### m8-b8-live-transfer.test.ts

套件级错误：`earned source must be dead`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### m8-b8-loot-runtime.test.ts

- B：`B8 real loot preparation and earned-only transitions 3-7 seed 4 counts frying-pan as one crafting component in the independent oracle`
- B：`B8 real loot preparation and earned-only transitions reveals all earned source slots from formal deaths without resources, IDs, RNG or phase changes`
- B：`B8 real loot preparation and earned-only transitions forfeits unearned slots, ignores no-loot monsters and rejects forged observation inputs`
- B：`B8 atomic direct awards, capacity and actual purchase lineage grants the real opening hero once, recording the candidate birth and unique receipt`
- B：`B8 atomic direct awards, capacity and actual purchase lineage keeps a full-bench hero pending without allocating, retries after release, and retains at terminal`
- B：`B8 atomic direct awards, capacity and actual purchase lineage grants all signed entries before income or XP, with no PvE choice`
- B：`B8 atomic direct awards, capacity and actual purchase lineage preserves every prior receipt and derives the full-clear 0/1/1/2/2/2/2/0 component vector`

#### m8-b8-loot-view.test.ts

套件级错误：`earned source must be dead`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### m8-b8-oracle.test.ts

套件级错误：`earned source must be dead`。B 原提交同样复现（错误文本一致）。该文件未执行到断言的项目不能算通过。


#### opening-encounters-integration.test.ts

- B：`opening encounter PR1 lifecycle, privacy and no-effect contract uses an explicit public whitelist even when secrets are injected`

#### opening-encounters-pr2.test.ts

- A/B：`exactly six PR2 effects become enabled; unimplemented effects retain original weights and null evidence`

#### opening-encounters-pr6.test.ts

- A：`PR6 Mel threshold observation with reward gate closed 41 → 40 crosses after save: true`
- A：`PR6 Mel threshold observation with reward gate closed 41 → 39 crosses after save: true`
- A：`PR6 Mel threshold observation with reward gate closed 100 → 40 crosses after save: true`
- A：`PR6 Mel threshold observation with reward gate closed 41 → 1 crosses after save: true`
- A/B：`PR6 Mel threshold observation with reward gate closed keeps all rewards closed and preserves only the evidenced B-patch branch override`
- A：`PR6 Mel threshold observation with reward gate closed authenticates every receipt field and rejects duplicates, missing records, and foreign encounters`
- A：`PR6 Mel threshold observation with reward gate closed multiplayer settlement records 41 → 39 atomically, rejects retries and mirrors without RNG or grants`
- A：`PR6 Mel threshold observation with reward gate closed owner-only progress is detached and explicitly blocked; public view contains no personal receipt`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 0`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 1`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 2`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 3`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 4`
- B：`PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 5`

#### opening-encounters-trainer-golems.test.ts

- B：`PR4 trainer evidence admission and executable emblem validation retains the 4% identity, known counts, approved conventions and unknown core parameters`
- B：`PR4 trainer evidence admission and executable emblem validation rejects caller-supplied enabled instead of filling the evidence gap`
- B：`PR4 trainer evidence admission and executable emblem validation rejects enabling only the weighted entry and accepts the exact disabled config copy`
- B：`PR4 trainer evidence admission and executable emblem validation accepts every executable distinct triple, returns a detached frozen tuple, without declaring a sampling pool`
- B：`PR4 disabled lifecycle, bypass rejection and restoration repeated explicit grants fail atomically; generic round hooks and restore never grant or draw`
- B：`PR4 disabled lifecycle, bypass rejection and restoration keeps all eight seats closed and rejects forged shared receipts and foreign bindings`

#### opening-encounters.test.ts

- A/B：`opening encounter PR1 content and independent selection preserves all sixteen official 14.24b intervals and explicit disabled identities`
- B：`opening encounter PR1 content and independent selection rejects incomplete/reordered/enabled configs without altering the supplied input`
- A/B：`opening encounter PR1 content and independent selection includes the full table and conventions in both freshly recomputed digests`

#### opening-random-identity.test.ts

- A：`cannon` 和 `sniper` 各 checkpoint 0–66，共 134 项 `survives strict text/object restore`；旧保存的 opening configVersion 与当前配置不符。B 也复现其中 122 项。
- A/B：`recomputes the first battle terminal and every event hash from public commands`

#### t5r-private-seat-view.test.ts

- B：`T5R private own-seat whitelist SR-B7-02 1-2: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 1-3: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 1-4: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 2-7: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 3-7: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 4-7: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 5-7: current public preview survives display adaptation without hidden fields`
- B：`T5R private own-seat whitelist SR-B7-02 6-7: current public preview survives display adaptation without hidden fields`

#### v17-orb-combo.test.ts

- B：`v17 orb combination — eleven contract acceptance groups 6: pre-combo shop/reforge bytes and cursors remain identical; partial/permuted kills cannot change another orb`

### 风险与交付边界

- epoch / digest / golden 尚未统一，保持既有失败；本次合并候选不能作为新旧存档兼容或可直接发布的证明。
- 旧套件中的蟹载体、商店/卡牌独立 oracle 和关闭状态预期仍需后续按批准规则独立复核；本任务不放宽或重录。T5R 的 8 个失败来自旧预览文案预期，B 原提交同样失败。
- A 单人奖励库存/界面接线等既有边界仍以 A 报告为准；本次没有扩充 UI、改变库存容量或修改 B 的战斗中拒领语义。
- 未跑全套浏览器、部署或完整 CI 体积验收。未编辑 `.github/`、CI 门槛、资产或生成物。
- 用户下一步可审阅工作树后自行 git add：8 个冲突文件、类型兼容调整的测试文件及本报告；再按既定流程统一 epoch / digest / golden。无需新增玩法决定。
