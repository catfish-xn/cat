<!-- claude-projects-attribution: {"github_login":"catfish-xn"} -->
_Requested by **Xiaoyu**_

## Before

Multiplayer runs the v24 online rules. Batch-5 cards that depend on cross-seat placements, eliminations, deaths, player damage, carousel receipts and permanent growth are largely unavailable; research-dependent cards also lack executable conventions. Some augment descriptions are missing or show placeholders, and integration exposed restore, replay-tail and rendering dependency defects.

## After

This draft describes **`codex/v25-integration-2 → multiplayer`**, checked against `686f3086fa565d2c1af81a5414d1259fc0ab86fb` on 2026-10-28. It introduces the **v25-online-rules** identity and the integrated batch-5 implementations, authenticated history, display improvements and performance work.

The supplied 82-row numbers draft is a scope list, **not 82 shipped cards**. Current code registers **78 of those 82**, including Hall of Mirrors, which is banned at all offer nodes; the other **77 have allowed nodes**, subject to normal offer filtering. **Over Encumbered (26), Restart Mission (29), BRB (30), and True Colors (66) are not registered and remain unimplemented in this tree.** History-owner names or approved proposals alone do not enable them. B5-11/14/41/62 were already covered in the v24 data scope and remain outside this table. Existing shop cards are included for completeness; these counts are not a claim that all 78 were newly added by this PR.

Players receive the available cards at the nodes below. A versioned `augment-history-v1` section authenticates facts and resulting rewards on restore. History may start when a history-sensitive choice is offered (for example Max Cap), rather than only after ownership; saves that never require it do not acquire that section. This does not make online Match states portable offline saves.

v24 saves, snapshots and replays are rejected by the exact v25 rules/content identity, without migration or seed rerolls. Players must export important old files before updating and start a new game; old bytes are preserved, but cannot resume or replay in v25. Server restarts discard in-memory matches and old seat credentials, so deployment waits for matches to end and players then refresh/rematch.

| Identity | v24 | Current v25 |
| --- | --- | --- |
| rulesVersion | `s13-g2-3-v24-online-rules` | `s13-g2-3-v25-online-rules` |
| contentVersion | `s13-14.24b-g2-3-v24-online-rules` | `s13-14.24b-g2-3-v25-online-rules` |
| CONTENT_DIGEST | `fnv1a32-utf16:1b86447c` | `fnv1a32-utf16:b5e50d50` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:18c876b2` | `fnv1a32-utf16:63bddec2` |
| schema/save/replay/command; NET | `12/8/8/7; 6` | `12/8/8/7; 6` |

### User decisions and research boundaries

- **2026-10-27:** Fine Vintage and Table Scraps only at **2-1**; Loot Explosion at **2-1 and 3-2**, never 4-2; Hall of Mirrors banned at every stage, with its implementation retained.
- **2026-10-27:** Loot Explosion requires an Ambusher’s last hit on an opposing ordinary hero, excluding summons/copies. Drop chance is **min(100%, 11% + killer crit chance)**. Tiers 1–6 award **1/2/3 gold, 1 component, 2 components, 1 completed item**. A separate value-crit roll adds **one tier**, capped at 6, without chaining. These are **provisional project numbers for play-testing**, not a verified live-server reward formula.
- **2026-10-27:** Adopt the approved batch-5 research conventions summarized below. The first research memo’s “keep disabled” recommendations were superseded where the user authorized implementation; lack of primary evidence still needs to be disclosed.
- **2026-10-28:** Retain Mad Chemist’s **project-defined skill numbers**. No 14.24 source establishes these skill coefficients; the earlier memo’s stronger provenance claim is superseded. The archive’s 20% omnivamp field does not authenticate the poison/duration/movement formula.
- **2026-10-28:** Align **Built Different** to the approved **14.24 static official/client values**, HP **240/330/420/530** and AS **45/50/55/60%** at stages 2/3/4/5+. **Placebo+** grants a fixed **15 gold and 1% AS**, replacing the former staged 15/18/22 gold. Built Different remains a 2-1 offer; Placebo+ remains 3-2. This is an explicit override of the former 14.24b values, not a claim that 14.24 and its B hotfix match. See [the field-by-field alignment](AUGMENT_14_24_ALIGNMENT.md).
- **2026-10-28:** The Carry golem’s fixed offensive items **are exempt from Anger Issues conversion**. Other ordinary-item conversion rules continue to apply to eligible items.
- **2026-10-28:** Add **official 14.24 descriptions for 73 augments** that lacked player text. Six cards now show settled in-match values: **Diversified Portfolio, Diversified Portfolio+, Glorious Evolution, Lunch Money, Forward Thinking, and Ghost of Friends Past**. Missing evidence remains unknown; the view does not invent settlement numbers. These extend the earlier dynamic projections for Pumping Up, Starry Night and other cards.
- **2026-10-28:** Use **Canvas only for Phaser’s 2D renderer**. The supplied Windows comparison measured Canvas **52.5 average / 21 minimum FPS**, WebGL **50.6 / 15**, with identical state/event checksums over **19 battles** (recorded in commit `3ae1cc2c`). Three.js remains the separate optional 3D renderer. Restore the production top-level JS **gzip-9 hard limit of 637,144 bytes**; do not retain temporary enlarged limits. This is a reported experiment, not a fresh benchmark of this documentation branch.
- **Pending user confirmation / 待用户确认 (2026-10-27/28):** Starry Night / Starry Night+ levels 1–2 currently use **0%** (`BATCH5_R5_STARRY_POLICY`); v24 shipped **18%** there. The approved research convention conflicts with the earlier v24 approval. This draft reports the code as-is and does not silently resolve the conflict.

The two supplied 2026-10-27 research memos are the decision inputs (`b5-research-decisions.md` and `b5-research-decisions-2.md`); durable project interpretations live in [S13_RULES_GAP.md](S13_RULES_GAP.md) and the linked content modules. They establish conventions, not additional verified 14.24 evidence:

| Cards | Adopted convention and evidence limit |
| --- | --- |
| Tomb Raider I/II | Ordinary equipped completed items from eliminated board/bench heroes, all candidates shown; no retroactive rewards; empty candidates consume an opportunity. Emblem exclusion has official support; the full selection policy is a convention. |
| Anger Issues | Ordinary completed-item conversion only, +45 resists and +1% AD/+1 AP per 2 stacks; special equipment and the Carry fixed set excluded. |
| Starry Night/+ | 3–10 level mapping follows community evidence plus matching fields; 1–2 at 0% remains disputed. Three-copy pool accounting is the project policy. |
| Pandora’s Bench / Recombobulator | Preserve stars, items and permanent growth, drop anomalies; reserve/return actual pool copies; 6-cost Recombobulator inputs stay unchanged. |
| Another Anomaly | Copy the effect definition rather than accumulated counters; item +250 HP/+20% AD/+25 AP; six excluded anomaly definitions. |
| Cloning Facility / Hall of Mirrors | Fixed hex/center selection, clone inheritance and no-space rules are conventions; Hall of Mirrors remains fully banned. |
| Mad Chemist | Poison, movement, duration and mana details are project-defined; retained by the 10-28 decision above. |
| Lucky Gloves/+ | Uniformly choose 2 different 14.24 recommended items; radiant mapping and battle-start form are conventions, not the unavailable tier/weight tables. |
| Ghost of Friends Past | Role-to-stat mapping, hero-copy and revival-death handling are conventions; coefficients are 5 HP/0.8% AD/1 AP. |
| Aerial Warfare | Community-supported additive 3% AD/3 AP per hex and repeated dash +9%/9; movement cap 99 is the project interpretation. |
| Paint the Town Blue | First 5 original Rebel deaths, lower-star clone minus 400 HP with a 100 HP floor, no items/anomaly/recursion. |
| The Mutation Survives | Own second row from back, column 4; sacrificial occupant sits out without death triggers, shares Experiment bonus, tier 7 doubles it. |
| Voidcaller / Void Swarm | Small voidling AD 60/AS 0.8/resists 30, placement rules and large Voidspawn stat curve are conventions; the Wiki large-unit season is unconfirmed. |
| Expected Unexpectedness | 3d6, triple jackpots and stage tables; some reward bands came from S14-labelled research and remain conventions. Use the explicit current reward table below, not a claim of a recovered S13 script. |
| I’m the Carry Now | Acquisition starts at 1-star, later-stage star growth, fixed Crownguard/Bloodthirster/Titan’s Resolve and +475 HP/+20% AD per later stage are conventions. |
| Prismatic Pipeline | Selection at 2-1 fixes early bonuses, 3-2 fixes late bonuses for subsequent openings; reuse the existing `ultraPlus` base orb table. Do not substitute a newly inferred base table. |
| Roll the Dice / Moonlight / Greater Moonlight | Reuse existing radiant-glove behavior rather than an independently reconstructed 70-pair table; Moonlight uses client 25%/25 and Greater Moonlight 5%/5, with the patch-note discrepancy still disclosed. |

### Batch-5 numbers and offer nodes, checked against current code

The table replaces the supplied 2026-10-27 draft. Nodes come from the **effective** `AUGMENT_OFFER_RULES.nodeBans` and `AUGMENT_POOL_API_NAMES`, not copied from the old table. Allowed nodes still require the correct tier, trait snapshot, level, mutual-exclusion, seen-card and mode eligibility. “All banned” differs from “not registered.” Non-user stage mappings retain the documented 14.24 tag inference; they are not newly verified live-server observations.

Content sources: `src/simulation/content/augment-pool-batch5*.ts`, `augment-pool-shop.ts`, `augments.ts`, `augment-offer-rules.ts`, `augment-stage-bans.ts`; the Starry policy and G4/G5/G6/G7 constants supply runtime numbers that cannot be read from prose alone. “Convention” marks an approved project interpretation, not primary-source proof. Rows for missing implementations state the proposal explicitly.

| Card | Augment ID / name | Allowed nodes | Current numbers and behavior |
| --- | --- | --- | --- |
| B5-01 | `beggars-can-be-choosers` / 乞亦有择 | 2-1 | Gain 7 gold. Later augment nodes keep one native reroll per slot and add 3 shared rerolls; native allowance is spent first. No extra allowance at acquisition. |
| B5-02 | `power-up` / 威力提升 | 2-1/3-2 | Upgrade the next augment tier silver → gold → prismatic; prismatic stays prismatic. Consumed by that next selection, with no deferral or gold conversion. |
| B5-03 | `reroll-transfer` / 刷新转换 | 2-1 | Gain 3 gold. On later augment-choice closure, convert each actually unused allowance into 3 free shop rerolls, once; exclude the acquisition node. |
| B5-04 | `at-what-cost` / 不计代价 | 2-1 | Raise to level 6 if below it, then grant 4 XP; never delevel. Skip later augment selections; use the existing XP cap. |
| B5-05 | `rigged-shop-plus` / 操纵商店+ | 3-2 | Gain 5 rerolls. The next successful shop generation, then every fourth generation, contains 3-cost units. A locked shop without generation does not count. |
| B5-06 | `reinfourcement` / 四费增援 | 4-2 | Gain 12 gold. The next bought 4-cost becomes 2-star, retaining the purchased copy and using the existing non-shop gift/shared-pool protocol for the other copies, then merging. |
| B5-07 | `shop-glitch` / 商店故障 | 2-1/3-2 | During non-PvP preparation, refresh at logical 2,500 ms intervals through 30,000 ms. Stop on leaving preparation; locked opportunities are skipped without catch-up. |
| B5-08 | `starry-night` / 星夜 | 2-1 | Gain 6 gold. Level 1–10 2-star chances: 0/0/18/20/22/25/30/50/80/100%. Reserve/return 3 pool copies; insufficient stock stays 1-star. Levels 1–2: pending user confirmation. |
| B5-09 | `starry-night-plus` / 星夜+ | 3-2 | Gain 8 gold; same chances and pool rules as Starry Night. Levels 1–2 currently 0%, pending user confirmation. |
| B5-10 | `two-much-value` / 由二生D | 2-1/3-2 | Gain two 2-cost units. Each next natural round grants floor(distinct 2-cost IDs fielded in the previous actual battle / 2) rerolls; PvE counts, duplicate IDs count once. |
| B5-12 | `prismatic-ticket` / 棱彩门票 | 2-1/3-2 | 45% chance for one free reroll per successful shop generation, including natural/free generations. Grants an allowance rather than recursively refreshing. |
| B5-13 | `component-buffet` / 基础装备自助餐 | 2-1 | Gain one initial component. Later newly acquired inventory components become component anvils with 4 options; moving existing components does not trigger it, and anvil outputs do not loop. |
| B5-15 | `fine-vintage` / 精致古董 | 2-1 (user) | Ordinary completed items continuously held in inventory turn into support-item anvils after 4 subsequent natural round entries. Leaving inventory or changing identity resets age; PvE/carousel rounds count. User stage override. |
| B5-16 | `pandoras-items` / 潘朵拉的装备 | 2-1/3-2/4-2 | Gain 1 component. At round entry, reroll ordinary inventory components/completed items within their respective pools; the same result is allowed. Emblems, crowns, artifacts, support/radiant items and tools stay unchanged. |
| B5-17 | `academic-research` / 学术研究 | 2-1/3-2 | Gain 1 component, Lux and Ezreal. Ordinary item combination creates an anvil offering the original item and one different current Academy-sponsored item, sampled equally. |
| B5-18 | `pandoras-items-ii` / 潘朵拉的装备 II | 2-1/3-2/4-2 | Gain 2 components. Same ordinary-inventory reroll scope as Pandora’s Items; special items remain unchanged. |
| B5-19 | `salvage-bin` / 打捞桶 | 2-1 | Gain 1 completed item; grant a component after 7 completed PvP battles from acquisition. Selling splits ordinary permanent craftable completed items only; specials return unchanged, temporary items yield no components. |
| B5-20 | `salvage-bin-plus` / 打捞桶+ | 3-2/4-2 | Same salvage rules; grant a component after 4 PvP battles, plus 1 completed item immediately. |
| B5-21 | `anger-issues` / 狂暴到底 | 3-2/4-2 | Convert ordinary completed items to Rageblades; add 45 armor/MR and +1% AD/+1 AP per 2 attack stacks. Special items and the Carry golem’s fixed loadout are exempt (2026-10-28). |
| B5-22 | `artifactory` / 神器工厂 | 3-2/4-2 | Gain 1 artifact anvil and 2 removers. Round-entry ordinary inventory completed items become supported artifacts, equally with replacement. The unbound Health=50 archive field does not grant team HP. |
| B5-23 | `pandoras-items-iii` / 潘朵拉的装备 III | 2-1/3-2/4-2 | Gain 1 radiant item. Same ordinary inventory reroll scope; special items do not reroll. |
| B5-24 | `quality-over-quantity` / 重质不重量 | 2-1/3-2 | Freeze permanent equipment counts at battle start: exactly one eligible ordinary completed item upgrades temporarily to its radiant counterpart. Radiant holders gain 12% HP once; gain 2 removers. Permanent identities stay unchanged. |
| B5-25 | `firesale` / 火爆甩卖 | 3-2 | Gain 1 gold. After natural shop processing, uniformly steal one nonempty reserved slot and empty it without replacement. Use existing capacity/pending-reward handling; empty shops give nothing. |
| B5-26 | `over-encumbered` / 运力不足 | Not registered | Not registered in current definitions/API map; no live offer. Draft convention only: next whole stage has 1 usable bench slot, preserve existing overflow, then grant 3 components. Do not report as shipped. |
| B5-27 | `pandoras-bench` / 潘朵拉的备战席 | 2-1/3-2/4-2 | Gain 2 gold. Transform rightmost 3 bench slots left-to-right by printed cost, preserving stars/equipment/permanent growth but not anomalies. Return/reserve 1/3/9 pool copies; insufficient stock keeps the unit; merge afterward. [Convention] |
| B5-28 | `recombobulator` / 变形重组器 | 3-2/4-2 | Board units transform +1 printed cost, capped at 5; 6-cost units stay unchanged. Preserve stars/equipment/permanent growth, not anomalies; apply 1/3/9-copy pool rules. Gain 2 removers. [Convention] |
| B5-29 | `restart-mission` / 重启任务 | Not registered | Not registered; no live offer. Draft convention only: remove units without sale gold, return permanent items, then give six 2-star units (two 3-cost, three 2-cost, one 1-cost) through existing gift/pool rules. |
| B5-30 | `brb` / 假装摸鱼 | Not registered | Not registered; no live offer. Draft convention only: lock player actions for 3 natural rounds including acquisition, allow system settlement/timeouts/reconnect, then give 2 completed-item anvils. |
| B5-31 | `no-scout-no-pivot` / 不侦察，不变阵 | 2-1 | Lock actual PvP starters against selling/benching; board moves, equipment and automatic merges remain allowed. After each actual PvP, grant those units permanent +20 HP/+1.5% AD/+1.5 AP. |
| B5-32 | `diversified-portfolio` / 多元化投资 | 2-1 | Gain 1 gold. Each later natural round grants floor(active non-unique board traits / 3) gold from the round-entry board; no remainder accumulation or acquisition-round payout. |
| B5-33 | `diversified-portfolio-plus` / 多元化投资+ | 3-2 | Gain 4 gold; same later-round portfolio income. Current descriptions use the settled round value. |
| B5-34 | `survivor` / 幸存者 | 2-1 | After 3 other global eliminations, a surviving holder receives 60 gold once. Acquisition may already satisfy the threshold; resolve the whole elimination batch first. |
| B5-35 | `table-scraps` / 餐桌剩菜 | 2-1 (user) | Gain 1 gold. After each of the next 4 shared carousels, holders in seat-index order receive one remaining slot uniformly without replacement. Short supply consumes the opportunity; unavailable in solo. User stage override. |
| B5-36 | `young-and-wild-and-free` / 不拘一格 | 2-1/3-2 | Gain 2 gold. Shared-carousel eligibility starts at arrival completion, using the same slot reservation/atomic claim. No solo-supply equivalent. |
| B5-37 | `contested` / 纷争 | 3-2 | Freeze the first bench hero and all live opponents’ fielded rosters at PvP start. Pay 2 × floor(number of other seats fielding that ID / 2) gold afterward, with no carry; no bench hero means 0. |
| B5-38 | `scoreboard-scrapper` / 冲榜战士 | 2-1 | At later natural round entries, ranks 5–8 grant current board heroes permanent +1.5% AD/+1.5 AP; ranks 1–4 give this-round +10% HP. Keep the existing eight-seat ranking order. |
| B5-39 | `tomb-raider-1` / 盗墓者 I | 4-2 | For the next 3 eliminated players after acquisition, choose one ordinary completed item held by board/bench heroes. Exclude emblems/radiant/artifact/support items; no candidates still consumes one elimination. [Convention] |
| B5-40 | `tomb-raider-2` / 盗墓者 II | 4-2 | Same candidate rules on each later elimination, without the three-player limit or retroactive rewards. [Convention] |
| B5-42 | `good-for-something` / 有用之材 I | 2-1 | Each real death of an unequipped ordinary hero independently has a 50% chance to grant 1 gold; inspect actual equipment including temporary items. Exclude non-hero summons/proxies; a revived hero can count again. |
| B5-43 | `lunch-money` / 午餐钱 | 2-1/3-2 | Each cumulative 8 actual enemy-player HP lost grants 2 gold after battle, carrying the remainder. Exclude mirror damage and overkill; use unique settlement receipts. |
| B5-44 | `titanic-titan` / 巨型泰坦 | 2-1/3-2 | Increase both current and maximum player HP by 20. Carousel release is one existing batch earlier; movement speed is not simulated. [Convention] |
| B5-45 | `forward-thinking` / 前瞻思维 | 3-2 | At acquisition, remove and record current available gold once; normal later economy continues and removed principal earns no interest. After 6 PvP settlements, pay principal +70 gold once. |
| B5-46 | `mirrored-monetization` / 恶意货币化 | 4-2 | Gain 2 gold. For 3 natural rounds including acquisition, each actual opposing ordinary hero death pays 2 gold after combat. Exclude summons; repeated death after revival counts. |
| B5-47 | `dhampyr` / 吸血生机 | 3-2 | Team gains 12% omnivamp. Heal a surviving holder for floor(20% of committed actual enemy-player HP damage), capped at maximum HP; no mirror credit or reversal of elimination. |
| B5-48 | `tiniest-titan` / 最小巨人 | 2-1 | After each actual PvP settlement, a surviving holder gains 2 HP and 1 gold, capped at existing maximum HP. Carousel priority moves one batch earlier; no speed simulation. |
| B5-49 | `tiniest-titan-plus` / 最小巨人+ | 3-2 | Gain 15 gold immediately, then the same +2 HP/+1 gold per PvP as Tiniest Titan. |
| B5-50 | `all-that-shimmers` / 闪若金鳞 | 2-1 | Show each of the 3 supported gold-producing artifact candidates exactly once; choose 1 and gain 1 remover. InterestCap=5 does not override the existing income policy. |
| B5-51 | `all-that-shimmers-plus` / 闪若金鳞+ | 3-2 | Same three-candidate artifact choice and remover, plus 4 gold. |
| B5-52 | `replication` / 反响 | 2-1/3-2 | Uniformly draw 3 distinct components from the existing 8. Choose one now, then receive one copy at each of the next 2 natural round entries, each with its own receipt. |
| B5-53 | `lucky-gloves` / 幸运手套 | 2-1 | Gain 2 gloves now and 1 after 5 rounds. Thief’s Gloves chooses 2 distinct items uniformly from the hero’s 14.24 recommended list; radiant gloves map to radiant versions, dual forms use battle-start form. [Convention] |
| B5-54 | `lucky-gloves-plus` / 幸运手套+ | 3-2/4-2 | Same recommended-item selection; gain 3 gloves immediately. [Convention] |
| B5-55 | `roll-the-dice` / 交给运气 | 3-2/4-2 | Grant one Radiant Thief’s Gloves using existing glove behavior, including the Lucky Gloves interaction. This is not a verified reconstruction of the archived 70-pair probability table. [Convention] |
| B5-56 | `a-golden-find` / 金色收获 | 4-2 | Gain 10 free rerolls. Only kills by the original anomaly-bound ordinary hero count; every 3 kills grants 2 gold via one-time postcombat receipts, carrying the remainder. |
| B5-57 | `cooking-pot` / 金色炊具 | 2-1 | Gain a Frying Pan. Each holder of an original Pan/Spatula gives the nearest other ordinary hero +50 permanent flat HP at each round entry; multiple qualifying items do not multiply it, ties use unit ID. |
| B5-58 | `forbidden-magic` / 禁忌魔法 | 3-2 | Gain 3 uniformly sampled Black Rose heroes with replacement. Each eligible Black Rose/Sion participant gets one takedown credit per victim; every 3 credits gives Sion permanent +1.5% AD/+10 HP next battle. Carry remainder. |
| B5-59 | `pilfer` / 挖角 | 2-1/3-2/4-2 | Next natural round grants a 1-star copy of the first opposing ordinary shop hero actually killed in the previous battle; 6-cost heroes qualify. Use complete death-event ordering; no valid target gives nothing. |
| B5-60 | `snipers-nest` / 狙神之巢 | 2-1/3-2/4-2 | First battle at a starting hex grants 8% damage amp; repeated same starting hex adds 8% per battle up to 32%. Moving the start hex or leaving/re-entering resets to 8%; absent battles do not grow it. |
| B5-61 | `trait-tracker` / 羁绊追踪者 | 3-2 | At the end of a legal preparation command, first reaching 8 active non-unique traits grants 6 distinct emblems from the existing 22-item pool, uniformly without replacement and without excluding already owned items. |
| B5-63 | `ghost-of-friends-past` / 老友幽魂 | 2-1 | Each allied hero death grants permanent team growth by role: tank/other +5 HP, AD role +0.8% AD, AP role +1 AP. Hero copies and deaths after revival count; non-hero summons do not. [Convention] |
| B5-64 | `glorious-evolution` / 光荣进化 | 4-2 | Gain Adaptive Helm. Count actual permanent star upgrades after acquisition, one per star crossed; no temporary promotion or directly gifted/bought high-star credit. At 9, grant Viktor and Jeweled Gauntlet once. |
| B5-65 | `hard-commit` / 硬性承诺 | 2-1 | Gain one uniformly sampled emblem from the existing 22. Now and at later stage starts, give a matching-trait hero costing the stage (cap 5), falling back first to nearest lower cost then higher; no target means no gold substitute. |
| B5-66 | `true-colors` / 真心本色 | Not registered | Not registered; no live offer. Draft convention only: Bloodthirster now, then Warwick + Sterak’s Gage after 35 actual enemy-player HP damage since acquisition, excluding mirrors/overkill and requiring a surviving holder. |
| B5-67 | `mad-chemist` / 炼金术士 | 2-1 | Strongest Singed cannot attack. Poison totals 140/210/315/420 × AP over 5 s (stars 1–4), ticks every 0.5 s, trail width 1 hex; mana/sec = 10 × AS. Ability: 20% omnivamp, move speed 250 for 4 s; cloud 3 s. Project-defined skill values retained on 2026-10-28, not verified 14.24 values. |
| B5-68 | `aerial-warfare` / 空战 | 2-1/3-2/4-2 | Each Firelight dash grants +9% AD/+9 AP; each moved hex adds +3% AD/+3 AP, capped at 99 movement stacks. Gain Scar and Zeri. Community evidence plus project convention. |
| B5-69 | `loot-explosion` / 战利品爆炸 | 2-1/3-2 (user) | Ambusher last hits only: min(100%, 11% + killer crit chance). Tiers 1–6: 1/2/3 gold, 1 component, 2 components, 1 completed item. One independent value-crit roll adds one tier, cap 6, no chaining. Gain Camille and Powder. Provisional convention pending play-testing. |
| B5-70 | `rebel-resurgence` / 爆蓝之城 | 2-1/3-2/4-2 | The first 5 allied Rebel hero deaths per combat spawn a one-star-lower copy (1-star stays 1-star), minus 400 HP, minimum 100 HP, at the original/nearest free hex. Copies retain traits, have no items/anomalies, do not consume the quota or recurse. Gain Akali and Irelia. [Convention] |
| B5-71 | `natural-selection` / 物竞天择 | 3-2/4-2 | Experiment heroes gain 12% HP. Sacrifice hex: own second row from the back, column 4. A qualifying occupant does not fight and shares its Experiment bonus across lab hexes, doubled at tier 7; it returns afterward, with no death trigger/item transfer. Gain 3 Experiment heroes. [Convention] |
| B5-72 | `voidcaller` / 虚空召唤者 | 2-1/3-2/4-2 | Team Visionary mana spending carries over toward one voidling per 275, max 5 successful births per battle. HP 400/450/500/550/600 at stages 2/3/4/5/6+; AD60, AS0.8, armor/MR30, melee, no active ability. Nearest free hex near caster; no space consumes the threshold without a birth. [Convention] |
| B5-73 | `void-swarm` / 虚空虫群 | 2-1 | Gain a portal now and every 11 PvP battles. Large Voidspawn HP 1000/1500/2000/2500/3000 and AD80/80/115/150/180 at stages 2/3/4/5/6+; AS0.8, armor/MR30, opening 2-hex taunt. Both small/large voidlings gain +40% AS/omnivamp. Wiki season unconfirmed; approved convention. |
| B5-74 | `cloning-facility` / 克隆设施 | 2-1/3-2/4-2 | Own second row from the back, column 4 copies its occupant: same stars, no items, counts for traits, 70% battle-start HP, mana cost ×1.2 rounded up. Empty/no-space cases skip the copy. [Convention] |
| B5-75 | `moonlight` / 月光 | 4-2 | At battle start, uniformly choose one fielded 1-cost below the target star level, temporarily promote it to 3-star, then add +25% AD/+25 AP; preserve instance equipment/anomaly. Client-data values, patch-note discrepancy disclosed. |
| B5-76 | `scavenger` / 拾荒者 | 2-1/3-2/4-2 | The first 5 distinct opposing ordinary heroes’ first real deaths give temporary ordinary completed items, uniformly sampled, to a uniformly chosen living ordinary ally with a free slot. No eligible receiver consumes the opportunity without a reward; no permanent items. |
| B5-77 | `greater-moonlight` / 高级月光 | 4-2 | Same eligibility as Moonlight; promote one eligible 1-cost to 4-star, then +5% AD/+5 AP. Higher target-star effects apply first. Client-data values, patch-note discrepancy disclosed. |
| B5-78 | `hall-of-mirrors` / 镜廊 | All banned (user) | Implemented but banned at every node. Front row copies the center hero (nearest column to 4, ties left); retain each recipient’s original HP, no equipment/anomaly/permanent growth, count toward traits; damage −40%. [Convention] |
| B5-79 | `sponging` / 白蹭 | 3-2/4-2 | Freeze permanent equipment at battle start. Up to 5 ordinary heroes with ≤1 permanent item copy one random ordinary completed item instance from the nearest other hero holding 3; ties use unit ID. Sample all before assigning to prevent chains; temporary only. |
| B5-80 | `head-start` / 延迟开始 | 2-1 | Sell board/bench through existing sale semantics, including gold/items; give four random 2-star 1-cost units. Disable buying/manual shop rerolls for 3 natural rounds including acquisition; XP, income and non-shop gifts continue. |
| B5-81 | `another-anomaly` / 又一个异常突变 | 4-2 | After the 4-6 anomaly choice, grant a unique item with +250 HP/+20% AD/+25 AP that copies the chosen effect definition, not its accumulated state. Unequipping disables it; original holder cannot equip it. Exclude UltimateHero, CallingCard, IdentityCrisis, IntoTheUnknown, Miniaturize and DualWielding. [Convention] |
| B5-82 | `expected-unexpectedness` / 意料之中的意外 | 2-1 | Roll 3d6 now, at 3-1 and 4-1 using stage-2/3/4 tables. Triples are jackpots; otherwise sum bands 4–8/9–11/12–15/16–17. Economy rewards: 7 rerolls/15 gold/20 gold. Full reward table includes cross-season research conventions; not a recovered S13 script. |
| B5-83 | `im-the-carry-now` / 我成C位了 | 2-1/3-2/4-2 | Golem starts 1-star when acquired, gains one star per later stage to 4, with fixed Crownguard/Bloodthirster/Titan’s Resolve. Each later stage adds +475 HP/+20% AD. Excluded from survivor player damage and fixed-item conversions, including Anger Issues. [Convention] |
| B5-84 | `max-cap` / 最大规模 | 4-2 | Offer only at level ≤7; cap level at 7, with no delevel/XP refund. Mutually exclusive with higher-level-cap augments. Gain 60 gold and a Tactician’s Shield (team size +1). |
| B5-85 | `prismatic-pipeline` / 棱彩管道 | 2-1/3-2 | Next PvE adds one standard prismatic orb from the existing ultraPlus table. Every later own prismatic opening gets the bonus fixed by acquisition node: 2-1 +8 gold; 3-2 weights 34/33/33 for 16 gold / 2 components / two 5-costs +6 gold. [Convention] |
| B5-86 | `subscription-service` / 订阅服务 | 2-1 | Now and at each later stage start, gain 6 gold and replace the next normal shop with 4 different 4-cost heroes, other slot empty. Pay normal prices; rerolling is allowed. Use shared pool reservations; insufficient distinct stock leaves empty slots. |

Built Different and Placebo+ are existing cards outside these 82 batch-5 rows; their final values are included explicitly in the decisions above and are defined in `content/augments.ts`.

Expected Unexpectedness’s complete current table (`content/augment-pool-batch5-g5.ts`) is included because “7/15/20” alone does not describe the shipped rewards. All non-economy stage-3/4 band details below remain project conventions where the research crosses seasons.

| Band | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- |
| Sum 4–8: economy | 7 free rerolls | 15 gold | 20 gold |
| Sum 9–11: units | two 4-cost heroes | four lesser duplicators +10 gold | three 5-cost heroes |
| Sum 12–15: forge | completed-item anvil +3 reforgers +2 gold | artifact anvil +2 gold | support-item anvil +2 gold |
| Sum 16–17: equipment | Masterwork Upgrade +2 gold | 3 components +2 gold | 1 completed item +2 components +2 gold |
| Triples, overriding sum | Tactician’s Crown +5 gold | 2 random emblems +5 gold | two 5-cost heroes +Champion Duplicator +5 gold |

## How

Cards were developed on separate `codex/v25-*` branches, reviewed and corrected, with targeted second reviews around combat and restore authentication. Integration combines `claude/v25-integration`, the r1–r6/g1–g7 researched-card merges into `codex/v25-integration-2`, `codex/v25-perf`, and later fixes for route drift, descriptions, values, restore and rendering.

- History records cross-seat facts, battle rosters, deaths, player damage, carousel acquisitions and permanent-growth inputs. Restore replays authenticated inputs and checks unique resource receipts; online authentication uses independent room authority rather than trusting the candidate save.
- Independent M5 reward oracles derive expectations from prior states, commands and facts rather than trusting production receipts. Offer-pool expansion required reselecting genuine public routes; scripted offers remain explicitly separated where tests intentionally use them.
- Performance work uses plain-data cloning, combined freezing/certification, shared-pool accounting improvements and bounded replay-prefix caches. Restore-only validation and solo/UI code are loaded on demand; 3D stays isolated from the initial 2D dependency graph.
- This is one **v25 epoch**, not multiple incompatible v25 variants. It was recorded and subsequently regenerated after integrated fixes; the latest checked-in write report has **15 successful steps and `complete: true`**. v24 and earlier artifacts remain immutable. A final no-write epoch check must still be collected for the release candidate; older partial V25 reports do not prove readiness.

### Real defects fixed during this integration

| Defect | Result / commit evidence |
| --- | --- |
| S3B restore rejected overtime round IDs | Pandora/Salvage authentication accepts the existing `overtime-N` schedule through the authoritative round mapping (`a89d8e99`). |
| Spectator live-bank revision emitted an empty replay tail | Keep a nonempty authoritative tail when a revision only truncates the predicted future (`1707ffba`). |
| Carousel restore missed initial gift authentication | G3 gift validation is also reached on carousel restore; Aerial Warfare’s Scar provenance remains bound to the real grant (`1abf27b0`). |
| G7 carousel gifts were not fully authenticated | Loot Explosion’s initial gift namespace/receipts are checked on the carousel restore path; G3/G7 checks coexist after merge (`b213b959`, `0b40db56`, `7af852b0`). |
| Firesale supply-round births were falsely rejected | Accept only births bound to the inferred Firesale plan, round and resource receipt; do not generally allow arbitrary supply-round births (`cad95c32`). |
| Void Swarm empty-board PvP history was inconsistent | Record/authenticate actual PvP participation even with an empty board (`95eb5b6d`). |
| H11 opening dereferenced absent S13 runtime | Guard holder/recipient lookups for valid legacy/non-S13 roster entries without changing S13 item sampling (`15576096`; [diagnosis](V25_RESTORE_PREVIEW_DIAGNOSIS.md)). |
| 3D pulled a 2D mutation-cell module into its graph | Remove the cross-renderer implementation dependency and check the emitted graph (`f80e3ef3`, `725d9cf7`). |

### Validation and release status

This documentation-only pass checks source definitions, effective offer bans, package scripts, deployment code, epoch evidence and `git log 100589ca..HEAD`. **It does not run the full suite, browser e2e, deployment or a new benchmark, and does not assert that the latest remote CI is green.**

Historical evidence: [EXT-1 performance report](tasks/EXT-1-v25-perf-REPORT.md) and `docs/evidence/v25-perf/` compare seeds 42/7/19 and report byte-identical final states, MatchEvents, intentions, receipts, battle ledgers and public replays across that optimization. The local eight-bot timings passed 60 s on that earlier tree; its machine-specific results are not a final-head timing certificate. The checked-in current epoch write report is `docs/evidence/v25-online-rules/epoch-verification.json`; identities are in `tests/v25-online-rules-content-baseline.json`.

Before release, collect **full CI on the final SHA**, enforce wall-clock gates (ordinary non-release PR CI reports them), no-write epoch verification, content-identity check, `rendering3d-isolation`, production-size semantics, M7 budgets (JS ≤1.50, first-interactive ≤1.20), bot-driver eight-bot <60 s and desktop Chromium WS/2D/3D e2e. Use the executable sequence and manual checks in [V25_RELEASE_CHECKLIST.md](V25_RELEASE_CHECKLIST.md). Test-server update commands are for the user to execute; this draft does not perform them or create a PR.

### Remaining work and confirmation

- **User decision:** Starry Night/+ levels 1–2: keep the current 0% research convention or restore v24’s 18%. Current code is 0%; this documentation makes no code change.
- **Disclosed project conventions:** Moonlight client/patch-note discrepancy; existing radiant-glove behavior; Voidspawn’s unconfirmed source season; cross-season Expected Unexpectedness bands; clone/sacrifice hexes; Carry golem equipment/growth; Pipeline bonuses; provisional Loot Explosion yield. These are not newly discovered official 14.24 formulas.
- **Incomplete scope:** B5-26/29/30/66 are absent from definitions/API registration. The release may describe their approved proposals, but must not promise them as available cards.
- **Known follow-up after v25:** cumulative augment-history processing has **quadratic total cost** as the history grows. Prefix caching reduces repeated restore work but does not remove every growing-history scan/copy. Track a separate performance task for long matches and repeated restore; retain full authenticated facts and existing budgets.
- **Release operations:** final release/v25 selection, latest-SHA CI/e2e evidence, test-server update and final main merge remain explicit checklist work, not completed actions in this draft.

## 中文摘要

- v25 集成第五批强化、历史认证、性能与显示修复；82项底稿中当前注册78张，镜廊全禁，其余77张有开放阶段；运力不足、重启任务、假装摸鱼、真心本色尚未注册，不能承诺已上线。
- 阶段按当前有效禁用表更新；保留10-27/28用户决定和调研约定。星夜1–2级代码为0%，与v24的18%冲突，待用户确认；战利品爆炸数值暂定待实测。
- 卓尔不群为240/330/420/530生命、45/50/55/60%攻速；安慰剂+固定15金币、1%攻速。炼金技能数值为项目自定；魔像固定装备不被狂暴到底转换。
- 补73张官方说明，6张显示已结算动态值；Phaser 2D仅Canvas，3D继续独立加载；生产顶层JS gzip-9严格小于637,144字节。
- v24旧档/回放按纪元拒绝且不迁移，玩家先导出保全再新开局；部署重启后重新匹配。当前写纪元记录完整，最终SHA的CI、check、预算及浏览器验收仍按上线清单执行。
- 本轮真bug和修复提交见上表；强化历史累计平方级成本留v25后单独立项。本次只交付文档，不开PR、不部署；测试服更新由用户执行。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
