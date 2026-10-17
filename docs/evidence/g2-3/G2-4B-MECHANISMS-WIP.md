# G2-4b eleven mechanism items — WIP

Base: `0bc011fa1c3a2b4947c86b24c4367a90268cc10d`, target `multiplayer`.
Scope: eight artifacts and Shroud, Zephyr, radiant-ID Zz'Rot support item.
No forges, Conqueror tier restoration, UI, or server implementation.

The source extraction is reproducible with
`python scripts/extract-g2-4b-mechanism-items.py`.
The resulting normalized JSON contains exact archive hashes, English JSON
pointers, map22 keys, and the actual Chinese localization references for all
eleven items. All eleven belong to TFTSet13; map22 constants equal English
effects. 14.24 is the authorized archive for 14.24b (no B-patch artifact/support
changes, confirmed by the user's dispatch and supplied values investigation).

Important distinctions:
- Normal Mogul's Mail grants 1 gold at 35 stacks, not the HR variant's 3.
- Normal Gambler's Blade has AS 45, 1% per gold capped at 30 gold, and 5% proc.
- Trench Coat uses 50% trigger / 30% copy HP, not later patches' 66% / 25%.
- The actual Zz'Rot map22 localization reference resolves to 兹若特传送门;
  another legacy string says 兹若特的邀请 and must not be selected by substring.

Unresolved source semantics, not adopted conventions: Voidspawn stage clamping/placement,
copy equipment/stat inheritance. Beam width, collision fallback and Fishbones
target-pool/stacking rules are explicitly provisional conventions in overrides.
No incomplete item is registered merely because its numeric extraction exists.
Fishbones, Spectral Cutlass, Shroud, Death’s Defiance and Trickster’s Glass are now registered. The runtime policy
revision/digest have changed; old fixture migration is still pending (WIP).

The two planning attachments were read through the supported Library read API.
Local signed-URL materialization was denied by the network proxy (HTTP 403).
Their older scope proposals do not supersede the latest eleven-item dispatch.

Validation: source pins, item kernel, gold receipt kernel, Fishbones real Match
roundtrip/multi-target, Cutlass geometry/public save, and Shroud two-seat tests.
The gold kernel is not connected to settlement yet; deferred damage is connected.
Six items, final fixture migration, final full suite and final-head CI/JS measurement
remain pending. This branch must remain a draft until complete.

Draft PR #150 was created by Claude: https://github.com/catfish-xn/cat/pull/150 .
Continue on codex/g2-4b-new-mechanism-items; no further PR-creation attempts.
Record transitional CI failures until fixtures migrate; final-head CI must be green.

## Checkpoint after replay and source follow-up

- Added `tests/g2-4b-replay.test.ts`: all three registered items reproduce every
  compact replay frame; omitting an attack event rejects replay. The Shroud
  case also checks the restored maximum mana after first cast.
- Related execution: the previous eight files / 36 tests passed; the added
  replay file and changed Cutlass adapter were checked together (two files /
  seven tests passed, including four existing Cutlass tests). Total distinct
  tests across these checkpoints: 39. No full suite has run.
- `npm run build` passed, including TypeScript checking. No independent review.
- Cutlass's inactive ticks now avoid allocating and sorting the whole army.
  This preserves outcomes and does not change policy values.
- JS gzip level 9: 552935 bytes, **1.3017494462x** the CI-pinned signed-off M7
  build (`15313a75c6e74beec739fe52a2875c104c55eae3`, 424763 bytes).
  Against branch base `0bc011f` (550288 bytes): **1.0048102085x**.
  See `G2-4B-WIP-JS.json`. This measures size only, not interactive performance;
  it is not final-PR-head acceptance and does not claim CI is green.
- Latest fetch still has `origin/multiplayer` at the base above. Predecessor
  merges are not present. Final synchronization and another revision bump are
  outstanding. Do not merge this branch.

Remaining implementation boundaries (not claimed as permission blockers):
gold must connect opportunities to battle state, settlement payouts, economy
replay and save authority; Gambler additionally needs an authoritative bank
snapshot. Existing High Roller receipts cannot represent item gold. Deferred
damage needs shield/redirect ordering and event/restore integration. Zephyr
needs true absence from action, area-target and passive processing, not merely
stun/untargetability. Clones need authoritative membership and inherited stat
compilation without counting additional traits or minting inventory assets.
Voidspawn requires a verified stage table and spawn/restore integration.

## 集中待定清单（2026-10-17，未逐项批准）

原版明确的常数全部取已固定 hash 的 14.24 原档；下列实现细节缺少原版证据，
均为 **约定值建议**，不是已经证实的原版行为。前 4 项与诡术师之镜已在 WIP 执行，其他未接线。

| ID / status | Concrete recommendation | Source gap, research, behavior impact |
| --- | --- | --- |
| G24-FISHBONES-TARGET-01 / WIP runtime | Eligible living, targetable enemies inside doubled effective range; one draw per actual attack, ID-sorted pool; multiple copies double once. | Raw describes doubling/random target but not pool radius or stacking. Wiki fetch restricted; Riot 14.9 confirms the broad mechanic. Controls whether distant targets can be selected and whether multiple items multiply range. |
| G24-CUTLASS-CELL-01 / WIP runtime | Mirror both axes. At occupied destination/home use nearest free cell; ties row then column; holders ordered by ID; multiple copies share one teleport/return; dead holders do not return. | Raw fixes return at 8 seconds, Riot 14.9 illustrates teleport/return. Neither specifies collisions or multiple-copy interaction. Controls exact landing cell and engagement timing. |
| G24-SHROUD-BEAM-01 / WIP runtime | Initial combined-board column difference ≤1; strongest overlapping beam; ceil(maxMana×1.30); restore after first cast. Each deployed item adds 60 allied HP including holder. | Raw fixes 30% and 60 HP; Riot 13.18 independently establishes the team HP. No six-angle beam definition or rounding in source. Controls affected enemies and integer cast cost. |
| G24-DEFIANCE-ORDER-01 / WIP runtime | Mitigate and redirect first, absorb shields, defer floor(remaining×0.50) over 80 ticks. Cumulative integer apportionment; each pulse stops at 1 HP and discards excess. Bleed neither redirects nor recursively delays; no repeated on-hit/vamp proc. | Raw specifies 50%, 4 seconds, nonlethal only. Wiki access restricted. Shield/redirect order, pulse timing and proc rules unconfirmed. Controls shield strength, lifesteal accounting and survival at 1 HP. |
| G24-ITEM-GOLD-01 / proposed, not wired | Credit each positive receipt once at battle settlement. Gambler AS uses frozen opening bank plus this side's already-generated battle gold; 100 Bps per gold capped at 30. Failure rolls remain in ledger. | Raw gives bank scaling and 5%/1 gold, Collector 40%/1 gold, Mogul 1 gold. Inventory attachment explicitly calls out settlement convention. Client pickup timing absent. Decides whether this battle's gold accelerates later attacks; deferred credit cannot be spent mid-battle. |
| G24-MIRROR-INHERIT-01 / WIP runtime | One clone of same champion/star/form; recompile naked champion plus active trait effects; no item programs, no anomaly or persistent growth inheritance until verified. Multiply resulting max HP by 70%, max Mana by 110%, flooring HP/ceiling Mana. Clone does not add population, trait counts or survivor player damage. | Raw 14.24 says max Health (not base Health), disallows equipping items, and confirms active traits. A later 15.1 description changes max to base (values attachment; secondary data diff also found), so later text cannot silently establish 14.24 semantics. Riot 14.8 confirms original form inheritance for an older form-swap champion. Item-stat, anomaly and growth inheritance remain unproven. Proposal may underpower clones of scaled/anomalous units; requires explicit review. |
| G24-TRENCH-INHERIT-01 / candidate, not wired | Replace holder with 3 fresh combat identities at first 50% threshold. Each starts full at floor(holder maxHP×0.30). Copy champion/star/form and item declarations, mark coat consumed on all three to prevent recursive splitting; reset transient combat timers/counters. No persistent inventory items minted. | Raw fixes 3/50%/30%. Riot 14.9's Treasure Chest interaction supports equipment effects on copies, but full inherited timers, mana, anomalies and growth are not specified. Resetting counters can retrigger survival effects and alter mana timing; do not describe as verified original behavior. |
| G24-VOIDSPAWN-STAGES-01 / historical candidate, not wired | HP stages 2/3/4/5/6 = 1000/1500/2000/2500/3000 (Riot 14.6, supersedes 13.18). AD = 80/80/120/180, stars = 1/1/2/3 (Riot 14.7). If unresolved, propose stage 1 uses stage 2, ≥6 clamps at last HP row; do not multiply these displayed totals by stars again. AS .75, armor/MR 30 match local raw. | 14.6 removes taunt and creates the movable summon during preparation. Keyword patch-chain research has a 14.14 access gap; absence of a keyword is not proof of no change. Corrected character-bin URL also unavailable (proxy 403); wiki/stored-page access restricted. Historical table is evidence at its published version, carry-forward/clamping are conventions. Controls summon tankiness/damage substantially; prefer completing patch-chain research before adopting. |
| G24-SUMMON-CELL-01 / candidate, not wired | Mirror clone nearest empty friendly-half cell to owner; Voidspawn auto-placement would seek front row, then remaining friendly cells; this differs from original movable preparation placement. Tie-break distance then row/column. Atomic allocation: if full, record no-space outcome without creating partial clones. | Riot 13.20 front-row preference was superseded by 14.6 movable preparation placement; 14.8 fixes placement persistence. A combat-only auto-placement substitute is a 约定值 and needs review, not an original implementation claim. Planning documents flag copy/placement semantics as missing. A full board can prevent summon benefit; engine must record the outcome and not silently create overlapping units. |


### 已核实原版与证据边界

- 诡术师之镜：14.24 原档明确 70% **max Health**、额外 10% 最大法力、无法装备物品、受益于激活羁绊。不能用 15.1 的 base Health 文案倒推。装备提供的属性、异变、成长、计数器继承没有足够证据；上表裸英雄加羁绊建议可能偏弱，未批准。
- 迷离风衣：14.24 为 50% 阈值、3 个 30% 最大生命复制体、15% 攻速。Riot 14.9 的 Treasure Chest 示例表明复制体拥有装备效果；不证明所有瞬时状态继承。
- 虚空生物：Riot 14.6 明确阶段 2–6 生命 1000/1500/2000/2500/3000；移除嘲讽，准备阶段出现且可移动。14.7 攻击总值阶段 2/3/4/5 为 80/80/120/180，阶段 4 升二星、5+ 三星，攻速 .75、双抗 30。14.8 修复跨轮位置保持。阶段 1/7+ 钳制、是否对生命额外乘星级、自动放置替代原版移动仍是约定值建议。
- 灵风：原档 5 秒、镜像旋风最近敌人、无视控制免疫、全队 2% 攻速；最近同距以 ID 排序、多个旋风优先选择尚未放逐者为约定值建议。
- 金币收集者：12% 斩杀阈值，击杀 40% 掉 1 金。投机者：每金 1% 攻速、上限 30 金、攻击 5% 掉 1 金。大亨：受伤每层 7 生命/1 双抗、35 层满层掉 1 金、之后每 8 秒 1 金。金币拾取时点、同 tick 多伤害计层/斩杀先后未查到；建议每正伤害包一层、每包后斩杀、金币结算统一入账，不伪造原版时序。

官方出处：
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-6-notes/
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-7-notes/
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-8-notes/
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-9-notes/
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/

调查记录：13.19–14.24 官方公告关键词检索见 G2-4B-PATCH-CHAIN.json，
14.14 页面不可访问；wiki 和正确 CommunityDragon character-bin 路径受代理限制。
检索没有命中不能证明中间版本没有变化。原始 13.18 生命候选表已废弃，不能使用。

建议集中确认：保留已接线三项及上表约定；复制继承与虚空生物准备期站位需重点审阅。
在确认前保留 WIP 标签，不将推测写成原版事实。

## Fourth runtime item checkpoint

Death’s Defiance now allocates deferred damage after shield absorption and redirect.
The original damage event exposes `deferred`; it is not counted as immediate HP
damage or overkill. Each later payment has its own `packetDamage` event with
`context.deferredPayment=true` and empty proc permissions. Debt is explicit JSON,
checked on Match restore for item authority, packet identity, uniqueness, timing
and exact integer progress. As with existing combat tasks, this validates the
stored dynamic state; it does not authenticate historical damage amounts by
rerunning an entire battle. Normal-mode damage allocation remains unchanged.

Specialized validation: 7 tests in g2-4b-defiance and g2-4b-replay passed (including
all four registered items’ every-frame compact replay). Full suite remains unused.
BaseHeal=25 has no referenced heal description; no extra flat heal is invented.
The raw StatOmnivamp=.25 is implemented as 25% omnivamp.

TypeScript checking passed after the fourth item integration.

## Mirror runtime checkpoint (still WIP)

Canonical clone origin is compiled from frozen equipment/owner inputs, then
recompiled during Match restore. No clone is added to preparation assets or the
shared pool. Active trait targets extend to the clone while original tiers/counts
stay unchanged. Form follows the original holder even when placed in another row.
Clone growth is excluded from permanent growth receipts and survivor player damage.
HP scaling also applies to subsequent max-HP changes, preserving restore equations.
Initial unit ordering was stabilized for clone battles so compact replay frames
remain aligned; unrelated battles retain their previous initial order.

Limitations requiring the centralized review: inheritance is the naked-plus-traits
proposal, not proof of original item/augment/anomaly/growth behavior. Jayce's clone
currently uses the existing self fallback when its private forge is absent; native
summon inheritance is not yet complete. Team item auras on clones also need review.
This registration is a WIP implementation, not a declaration of full item completion.
