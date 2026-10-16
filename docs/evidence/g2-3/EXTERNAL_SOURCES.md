# G2-3 外部缺口数据考证

> 研究日期：2026-10-16。目标：14.24 与 14.24b；仅证据文档，不批准或应用运行时数值。

## 结论与使用边界

已找到可直接引用的官方 B 改动、学院每件加成、Rumble 两项改动、实验体 Urgot/Warwick及Mundo、Sion 部分规则，以及异变停用与数值修订。**完整历史学院组合与抽法、Sion完整属性、形态/召唤物默认属性、全部异变正式服池、征服者20档阈值仍未证实。** 下文逐项列出建议约定值，均未批准。

状态：`confirmed`=官方字段；`supported`=外部支持但有时间边界；`candidate`=待确认候选；`conflict`=保留冲突；`inference`=推导；`not_found`=目标版本未查到。可信度标签按官方/攻略站标记；本次未取得可核验的原始挖掘脚本，不能把Reddit玩家评论称作挖掘事实。

同一Riot URL内，正文是14.24，**DECEMBER 10是pre(A)热修，DECEMBER 17才是B**。本报告的14.24候选基线优先纳入12/10热修，并单列正文原值；不把A改动写成B。

**存档陷阱：** LittleBuddyBot的12月HTML已读，但图片实际回放到了2025-02-19。图中旧Urgot、Sion复活50%、征服者650等均保留为冲突，不能借HTML时间冒充12月图片冻结。实验图含Mundo 14.23改动前旧值；Twitch 15%、纹章分身40%来源可能早于 14.23，仅作参考，不作为约定值依据。Mobalytics 12/14和12/22异变表正文相同且滞后；LoLCHESS 1/2表含PBE线索Hivemind，数据库清单不是正式服可抽白名单。

## 来源索引

| ID | 可信度与对应版本 | 来源/存档 | 读取与限制 |
| --- | --- | --- | --- |
| `riot` | 官方；14.24 / 14.24a(12-10) / 14.24b(12-17) | [来源](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/) · 未使用存档 | 正文已读；同页三个时间层；正文、A 热修、B 补丁必须按小标题定位。 |
| `riot-14.23` | 官方；14.23中途更新，2024-11-21；14.24/14.24b未再列Mundo实验加成改动 | [来源](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-23-notes/) · 未使用存档 | 正文已读；定位Mid-Patch Updates → NOVEMBER 21ST → TRAITS；只用于Mundo实验加成，不混同本体技能。 |
| `academy-lol` | 攻略站；Set 13，当前页未锁定14.24 | [来源](https://lolchess.gg/rewards/set13/academy-sponsored-items?hl=en) · 未使用存档 | 正文已读；可确认通用文案；不能仅凭当前页面推定历史抽取算法。 |
| `academy-copies` | 攻略站；2024-12-17，B上线当日，发帖先后未知 | [来源](https://www.reddit.com/r/TeamfightTactics/comments/1hggiuu/copies_of_academy_items_meaning/) · 未使用存档 | 正文已读；Reddit 玩家解释；非 Riot、非原始挖掘。 |
| `academy-leduck` | 攻略站；2024-11-25，早于14.24 | [来源](https://www.tacter.com/es/tft/guides/academy-sponsored-item-list-tft-set-13-d5f8c0de?nxtPgame=tft) · 未使用存档 | 搜索索引；搜索索引可读；正文图片未从该站读取。 |
| `sevika-leduck` | 攻略站；页面更新2024-12-10；14.24发布同日 | [来源](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda) · 未使用存档 | 搜索索引正文；LeDuck 原文含 40/35/24.5/0.5 二级概率表；Unlikely Duo将Triple从10%提高至20%的说明原文标not confirmed。非原始挖掘；发布同日先后、jackpot分配及强化精确倍率未锁定；本次直连404，搜索索引仍可读一级表和Notes。 |
| `academy-archive` | 攻略站；页面快照20241212093929；图片快照20250219192335 | [来源](https://www.littlebuddybot.com/academy-items) · [实际使用存档](https://web.archive.org/web/20241212093929/https://www.littlebuddybot.com/academy-items) | 存档HTML已读；图片单独目视读取；12月HTML引用同名图片，但实际图片回放重定向到2025-02-19；不能把图片字节当12月冻结证据。文件名写14.23。 |
| `academy-image` | 攻略站；2025-02-19图片快照，14.24适用性未证实 | [来源](https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=681,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-14.23-academy-AwvMNxbPoWseqr3W.png) · [实际使用存档](https://web.archive.org/web/20250219192335id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=681,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-14.23-academy-AwvMNxbPoWseqr3W.png) | 图表已目视读取；图表数值只作候选或冲突证据；不能用页面时间代替图片时间。 |
| `sion-archive` | 攻略站；页面快照20241212115728；图片快照20250219203836 | [来源](https://www.littlebuddybot.com/black-rose-sion-ability) · [实际使用存档](https://web.archive.org/web/20241212115728/https://www.littlebuddybot.com/black-rose-sion-ability) | 存档HTML已读；图片单独目视读取；12月HTML引用同名图片，但实际图片回放重定向到2025-02-19；不能把图片字节当12月冻结证据。 |
| `sion-image` | 攻略站；2025-02-19图片快照，14.24适用性未证实 | [来源](https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=632,fit=crop,trim=0;1.812191103789127;0;1.812191103789127/mnlvzo4MORckGV8d/set-13-tables-blackrose-YD06PRypBgCRwglo.png) · [实际使用存档](https://web.archive.org/web/20250219203836id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=632,fit=crop,trim=0;1.812191103789127;0;1.812191103789127/mnlvzo4MORckGV8d/set-13-tables-blackrose-YD06PRypBgCRwglo.png) | 图表已目视读取；图表数值只作候选或冲突证据；不能用页面时间代替图片时间。 |
| `experiment-archive` | 攻略站；页面快照20241212200931；图片快照20250219205122 | [来源](https://www.littlebuddybot.com/experiment-bonuses) · [实际使用存档](https://web.archive.org/web/20241212200931/https://www.littlebuddybot.com/experiment-bonuses) | 存档HTML已读；图片单独目视读取；12月HTML引用同名图片，但实际图片回放重定向到2025-02-19；不能把图片字节当12月冻结证据。 实验图仍含Mundo 200/75的14.23改动前旧值；Twitch 15%、纹章分身40%来源可能早于 14.23，仅作参考，不作为约定值依据。 |
| `experiment-image` | 攻略站；2025-02-19图片快照，14.24适用性未证实 | [来源](https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png) · [实际使用存档](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png) | 图表已目视读取；图表数值只作候选或冲突证据；不能用页面时间代替图片时间。 实验图仍含Mundo 200/75的14.23改动前旧值；Twitch 15%、纹章分身40%来源可能早于 14.23，仅作参考，不作为约定值依据。 |
| `sevika-archive` | 攻略站；页面快照20241213065257；图片快照20250219191534 | [来源](https://www.littlebuddybot.com/sevika-high-roller) · [实际使用存档](https://web.archive.org/web/20241213065257/https://www.littlebuddybot.com/sevika-high-roller) | 存档HTML已读；图片单独目视读取；12月HTML引用同名图片，但实际图片回放重定向到2025-02-19；不能把图片字节当12月冻结证据。 |
| `sevika-image` | 攻略站；2025-02-19图片快照，14.24适用性未证实 | [来源](https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png) · [实际使用存档](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png) | 图表已目视读取；图表数值只作候选或冲突证据；不能用页面时间代替图片时间。 |
| `conqueror-archive` | 攻略站；页面快照20241212104640；图片快照20250219205805 | [来源](https://www.littlebuddybot.com/conqueror-loot-table) · [实际使用存档](https://web.archive.org/web/20241212104640/https://www.littlebuddybot.com/conqueror-loot-table) | 存档HTML已读；图片单独目视读取；12月HTML引用同名图片，但实际图片回放重定向到2025-02-19；不能把图片字节当12月冻结证据。 |
| `conqueror-image` | 攻略站；2025-02-19图片快照，14.24适用性未证实 | [来源](https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=439,fit=crop,trim=1.8136363636363635;0;1.8136363636363635;0/mnlvzo4MORckGV8d/set-13-tables-conqueror-A0xwaRK5L4sDDNWL.png) · [实际使用存档](https://web.archive.org/web/20250219205805id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=439,fit=crop,trim=1.8136363636363635;0;1.8136363636363635;0/mnlvzo4MORckGV8d/set-13-tables-conqueror-A0xwaRK5L4sDDNWL.png) | 图表已目视读取；图表数值只作候选或冲突证据；不能用页面时间代替图片时间。 |
| `rumble-lol` | 攻略站；当前Set13，14.24适用性逐项判断 | [来源](https://lolchess.gg/rewards/set13/junkerking-items?hl=en) · 未使用存档 | 搜索索引正文；部分数值与14.24官方吻合；Self-Destruct三星值与官方冲突。 |
| `rumble-community` | 攻略站；2025-01-09，非14.24冻结 | [来源](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/) · 未使用存档 | 正文已读；Reddit菜单说明；所列喷火及自爆一二星仍是14.24前旧值，不能整表当14.24。 |
| `experiment-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/traits/tft13_experiment) · 未使用存档 | 正文已读；当前5档450HP、Warwick眩晕1.5s等不能回填14.24。 Mundo 120生命/击杀+60与Riot 14.23官方改动一致，该项已确认。 |
| `sion-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/traits/tft13_cabal) · 未使用存档 | 正文已读；只支持5次施法/65%解锁等通用文案，非完整属性表。 |
| `jayce-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/units/tft13_jayce) · 未使用存档 | 正文已读；模板range=1、armor=0等不代表已解析的远程形态。 |
| `forms-wiki` | 攻略站；当前模块混合多个赛季及后续补丁 | [来源](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data) · 未使用存档 | 搜索索引片段；直连受限；只用明确Set13的锻炉被动段；搜索片段中的range4可能属于其他赛季，不能据此证实四名形态英雄。 |
| `gangplank-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/units/tft13_gangplank) · 未使用存档 | 正文已读；未解析形态/桶默认属性。 |
| `swain-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/units/tft13_swain) · 未使用存档 | 正文已读；模板range不足以证明远程射程。 |
| `elise-tools` | 攻略站；当前Set13，非14.24冻结 | [来源](https://tft.tools/info/set-13/units/tft13_elise) · 未使用存档 | 正文已读；模板range不足以证明远程射程。 |
| `anomaly-pre` | 攻略站；2024-12-10 08:27:16 UTC，早于官方正文19:00发布 | [来源](https://lolchess.gg/anomalies/set13) · [实际使用存档](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13) | 正文已读；58项数据库清单，含Cosmic、不含Miniaturize/Essence；不能直接当14.24已上线池。 |
| `anomaly-post` | 攻略站；2025-01-02，14.24b时段的网页快照 | [来源](https://lolchess.gg/anomalies/set13) · [实际使用存档](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) | 正文已读；58项，新增Hivemind同时删除Cosmic；可能混入PBE。快照时间不能证明正式服可抽。 |
| `anomaly-moba-pre` | 攻略站；2024-12-14网页快照 | [来源](https://mobalytics.gg/tft/anomalies) · [实际使用存档](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies) | 正文已读；60项；大量值仍旧，如MR50、Bully18%、Cosmic仍列，明确滞后，不能冻结正式服池。 |
| `anomaly-moba-post` | 攻略站；2024-12-22网页快照 | [来源](https://mobalytics.gg/tft/anomalies) · [实际使用存档](https://web.archive.org/web/20241222150138/https://mobalytics.gg/tft/anomalies) | 正文已读；异变表正文与12-14相同；不能据此认定B补丁无变更。 |
| `anomaly-disabled-community` | 攻略站；2024-12-05及12-12玩家讨论 | [来源](https://www.reddit.com/r/TeamfightTactics/comments/1h7091h/) · 未使用存档 | 搜索索引正文；社区称Miniaturize和Essence已移除；并区分Another Anomaly条件排除。非官方停用时间表。 |
| `anomaly-pbe` | 攻略站；2024-12-16 PBE帖 | [来源](https://www.reddit.com/r/CompetitiveTFT/comments/1hfq0l8/here_are_the_new_anomalies_that_might_be_added_in/) · 未使用存档 | 正文已读；Riot_Mort评论明确并非最终版本或最终数值；不作14.24/14.24b在池证明。 |
| `hivemind-pbe` | 攻略站；2024-12-18玩家讨论 | [来源](https://www.reddit.com/r/TeamfightTactics/comments/1hh8quy/) · 未使用存档 | 搜索索引片段；评论称Hivemind为PBE新异变，反证不能仅凭1月攻略库把它算入14.24正式服。 |
| `conqueror-lol` | 攻略站；当前Set13，未冻结14.24 | [来源](https://lolchess.gg/rewards/set13/conqueror-war-chest-rewards?hl=en) · 未使用存档 | 正文已读；只列15档；页首误贴学院文案且写3%，该段不采用。只取阈值表。 |

## 1. 学院赞助

### sponsored-count

- 数值/规则：3
- 对应版本：14.24 / 14.24b通用文案，目标版本未独立冻结；状态：`supported`；依据：[`academy-lol`](https://lolchess.gg/rewards/set13/academy-sponsored-items?hl=en)。

### bonus-by-tier

- 数值/规则：{"tiers": [3, 4, 5, 6], "max_health_and_damage_amp_percent_per_copy": [2, 3, 5, 9]}
- 对应版本：14.24正文；B未列修改；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### copies

- 数值/规则：{"self_crafted_matching_items_count": true, "multiple_copies_on_one_holder_count": true, "academy_holder": "double item bonus plus 5% HP and Damage Amp"}
- 对应版本：14.24b时段，社区支持通用语义；状态：`supported`；依据：[`academy-lol`](https://lolchess.gg/rewards/set13/academy-sponsored-items?hl=en)、[`academy-copies`](https://www.reddit.com/r/TeamfightTactics/comments/1hggiuu/copies_of_academy_items_meaning/)。
- 边界：不是只有羁绊发的三件有效；社区例子为自己合成及三件Warmog。额外5%多件时加几次仍缺精确证据。

### candidate-list-structure

- 数值/规则：{"ordered_lists_shown": 29, "items_per_list": 3, "duplicates_within_shown_lists": false, "selection_weights": null, "all_players_share_same_list": null}
- 对应版本：图片文件名14.23；14.24沿用未证实；状态：`candidate`；依据：[`academy-archive`](https://web.archive.org/web/20241212093929/https://www.littlebuddybot.com/academy-items)、[`academy-image`](https://web.archive.org/web/20250219192335id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=681,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-14.23-academy-AwvMNxbPoWseqr3W.png)、[`academy-leduck`](https://www.tacter.com/es/tft/guides/academy-sponsored-item-list-tft-set-13-d5f8c0de?nxtPgame=tft)。
- 边界：图中List1–29为有顺序组合，不能替换成36件成装独立抽样。图标未获文字ID对照，未把所有图标猜成装备ID。


### 未查到项目与建议约定

- **historical-pool-and-sampling**：未查到，建议约定值 {"enabled": false, "required_items_per_game": 3, "candidate_list_count": 29, "within_list_replacement": false}，理由 只拿到29组合图的后期图片字节；14.24完整装备ID映射、组合权重和跨玩家共享均未证实。先不准入随机赞助，避免编造均匀36选3。建议未批准；查阅依据：[`academy-image`](https://web.archive.org/web/20250219192335id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=681,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-14.23-academy-AwvMNxbPoWseqr3W.png)、[`academy-leduck`](https://www.tacter.com/es/tft/guides/academy-sponsored-item-list-tft-set-13-d5f8c0de?nxtPgame=tft)。
- **exact-multi-copy-formula**：未查到，建议约定值 {"non_academy": "n*b", "academy": "2*n*b + (n>0 ? 5% : 0)", "example_b_5pct_n_2": "25% HP and Damage Amp"}，理由 文案支持翻倍再加5%，但未找到14.24多件精确拆分；建议额外5%仅加一次、无赞助件不触发，需玩法拍板。另一公式n*(2*b+5%)会得到30%，不可当已排除。建议未批准；查阅依据：[`academy-lol`](https://lolchess.gg/rewards/set13/academy-sponsored-items?hl=en)、[`academy-copies`](https://www.reddit.com/r/TeamfightTactics/comments/1hggiuu/copies_of_academy_items_meaning/)。
- **special-item-equivalence**：未查到，建议约定值 {"radiant_counts": false, "emblem_counts": false, "temporary_item_counts": false}，理由 社区有光明装备有效的回答但无14.24冻结规则；建议先仅同一普通成装ID算复制品，其他分支不启用。建议未批准；查阅依据：[`academy-copies`](https://www.reddit.com/r/TeamfightTactics/comments/1hggiuu/copies_of_academy_items_meaning/)。

## 2. Sevika High Roller

### two-stage-distribution

- 数值/规则：{"first_roll_percent": {"rocket": 35, "shield": 35, "coin": 20, "triple": 10}, "conditional_on_triple_percent": {"blue_flamethrower": 40, "knockout_punch": 35, "quadruple_chomp": 24.5, "jackpot": 0.5}}
- 对应版本：14.24同日LeDuck原文含一级与二级概率表；后期图片仅辅助参考；状态：`supported`；依据：[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)、[`sevika-archive`](https://web.archive.org/web/20241213065257/https://www.littlebuddybot.com/sevika-high-roller)、[`sevika-image`](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png)。
- 边界：LeDuck 原文含 40/35/24.5/0.5 二级概率表。一级合计100%；二级合计100%；10%不能与二级四项相加。二级按Triple条件概率解释，尚非已解码的脚本控制流；本次直连受限，版本边界保留。

### unlikely-duo-triple-chance

- 数值/规则：{"base_triple_percent": 10, "possible_with_unlikely_duo_percent": 20, "confirmed": false}
- 对应版本：LeDuck 2024-12-10 Notes；14.24/14.24b未确认；状态：`candidate`；依据：[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)。
- 边界：原文明确标not confirmed：Unlikely Duo可能把三连（Triple）从10%提高到20%。仅记录未确认线索，不作为约定值或运行时概率依据。

### hash-alignment

- 数值/规则：{"{e640e05f}": {"observed": 0.4, "candidate_meaning": "P(Blue Flamethrower | Triple)"}, "{e1fc0fa1}": {"observed": 0.245, "candidate_meaning": "P(Quadruple Chomp | Triple)"}, "{9ad9e572}": {"observed": 0.005, "candidate_meaning": "P(Jackpot | Triple)"}, "{52aec87f}": {"observed": 0.1, "candidate_meaning": "P(Triple)"}, "ambiguous_0.35_keys": ["{01148678}", "{267deafa}", "{592d23e5}"], "ambiguous_meanings": ["P(Rocket)", "P(Shield)", "P(Knockout Punch | Triple)"], "{699f6a87}": {"observed": 0.2, "candidate_meaning": "P(Coin)"}}
- 对应版本：14.24导出键仅作问题定位；意义来自外部表数值对应；状态：`candidate`；依据：[`sevika-image`](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png)、[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)。
- 边界：唯一数值匹配并不等于符号名解码；三个0.35不可按排列强配。此处原始hash仅定位，不作为外部来源。

### mod-values

- 数值/规则：{"cast_durability_percent": 80, "cast_durability_seconds": 1.5, "rocket_count": 8, "rocket_physical_damage_each": 100, "shield": 500, "shield_seconds": 4, "coin_gold": 3}
- 对应版本：14.24同日资料，B未列修改；状态：`supported`；依据：[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)。

### jackpot-ad-ratio-percent

- 数值/规则：{"before": 125, "14.24": 250}
- 对应版本：14.24正文，非B改动；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### joint-jackpot-if-model-holds

- 数值/规则：{"formula": "0.10 * 0.005", "percent": 0.05}
- 对应版本：研究推导，14.24控制流未证实；状态：`inference`；依据：[`sevika-image`](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png)。
- 边界：0.05%是上述两级模型的乘积；不是直接证实的每次施法jackpot概率。


### 未查到项目与建议约定

- **exact-hash-symbols-and-roll-order**：未查到，建议约定值 {"use_named_two_stage_table": true, "decode_ambiguous_hashes": false}，理由 已解释两层表但未查到哈希符号表、首抽保底或依星级变化；建议独立命名数据候选，不给三个同值键伪造语义。建议未批准；查阅依据：[`sevika-image`](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png)、[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)。
- **enhanced-gold-and-jackpot-loot**：未查到，建议约定值 {"normal_coin_gold": 3, "other_results_guaranteed_gold": 0, "jackpot_loot_enabled": false}，理由 3金币有文字；约20金币和1–2宝箱只是LeDuck观察，不是固定映射。Triple Coin是否存在、强化伤害/护盾倍率及jackpot奖励分配均未冻结；建议奖励分支阻塞，不把0说成原版掉落。建议未批准；查阅依据：[`sevika-leduck`](https://www.tacter.com/es/tft/guides/sevika-high-roller-odds-tft-set-13-f6af8bda)、[`sevika-image`](https://web.archive.org/web/20250219191534id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=488,fit=crop,trim=0;0;0;0/mnlvzo4MORckGV8d/set-13-tables-highroller-m7VwlZlXRnI4O0e1.png)。

## 3. Rumble机甲升级

### armory-menu

- 数值/规则：{"interval_rounds": 3, "choices": ["2未购付费升级", "Spare Parts"], "paid_upgrade_cost_gold": 5, "purchased_upgrades_removed": true, "all_paid_purchased_next_choice": "Finishing Touch", "three_star_next_choice": "Junkyard Titan"}
- 对应版本：2025-01-09社区说明，14.24菜单沿用未冻结；状态：`candidate`；依据：[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。
- 边界：菜单次数及费用无14.24官方完整表；不是B新增。

### upgrade-Spare Parts

- 数值/规则：{"name": "Spare Parts", "cost_gold": 0, "parameters": {"ability_power": 3, "health": 50}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

### upgrade-Finishing Touch

- 数值/规则：{"name": "Finishing Touch", "cost_gold": 0, "parameters": {"ability_power": 25, "health": 300}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

### upgrade-Junkyard Titan

- 数值/规则：{"name": "Junkyard Titan", "cost_gold": 0, "parameters": {"all_upgrades": true, "durability_percent": 90}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

### upgrade-Flamethrower

- 数值/规则：{"name": "Flamethrower", "cost_gold": 5, "parameters": {"damage_ap_percent_star123": [30, 45, 600], "tick_seconds": null}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)、[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### upgrade-Petricite Rod

- 数值/规则：{"name": "Petricite Rod", "cost_gold": 5, "parameters": {"interval_seconds": 5, "range_hexes": 4, "target": "范围内最远敌人", "damage_ap_percent_star123": [350, 525, 6000], "damage_over_seconds": 15}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

### upgrade-Repairing Microbots

- 数值/规则：{"name": "Repairing Microbots", "cost_gold": 5, "parameters": {"interval_seconds": 3, "heal_max_health_percent_star123": [6, 6, 25]}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

### upgrade-Self-Destruct

- 数值/规则：{"name": "Self-Destruct", "cost_gold": 5, "parameters": {"bonus_armor_mr_percent": 25, "death_radius_hexes": 2, "damage_resists_percent_star123_official": [160, 240, 20000], "damage_resists_percent_star123_guide": [160, 240, 2000]}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`conflict`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)、[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### upgrade-Tankbuster

- 数值/规则：{"name": "Tankbuster", "cost_gold": 5, "parameters": {"interval_seconds": 3, "true_damage_ap_percent_star123": [120, 180, 1600], "target": "最高Armor+MR敌人"}}
- 对应版本：14.24官方只明确喷火/自爆变动；其余为未冻结Set13攻略候选；状态：`candidate`；依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。


### 未查到项目与建议约定

- **self-destruct-three-star**：未查到，建议约定值 {"damage_resists_percent": 20000, "authority": "官方公告优先，进入实现前确认是否笔误"}，理由 官方两端均写20000%，LoLCHESS为2000%，社区旧表亦2000%；未查到官方勘误，不能静默少写一个0。建议未批准；查阅依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。
- **flamethrower-tick-and-menu-lock**：未查到，建议约定值 {"flamethrower_tick_seconds": 1, "armory_choice_timeout": "不自动扣费，保留未选", "paid_upgrade_repeatable": false, "spare_parts_repeatable": true}，理由 喷火每tick倍率与持续/菜单超时等精确规则未查到14.24来源；1秒只是建议的显式模拟周期，非原版。建议未批准；查阅依据：[`rumble-lol`](https://lolchess.gg/rewards/set13/junkerking-items?hl=en)、[`rumble-community`](https://www.reddit.com/r/CompetitiveTFT/comments/1hxjr7w/junker_king_upgrades_discussion/)。

## 4. Experiment实验格

### labs-and-health

- 数值/规则：{"tiers": [3, 5, 7], "laboratory_count": [2, 3, 3], "max_health_bonus": [100, 300, 300], "tier7_bonus_increase_percent": 100}
- 对应版本：14.24；7档300由官方明确，其他由图表支持但时间未冻结；状态：`supported`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)。
- 边界：7档+100%意为实验效果双倍，不是新增6格。后期tft.tools 5档450HP不能覆盖此处。

### sharing-rule

- 数值/规则：开战时只让站实验格的Experiment单位获得所有实验格上Experiment的实验效果和生命
- 对应版本：通用Set13文案；14.24 B未列修改；状态：`supported`；依据：[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)、[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)。

### bonus-Zyra

- 数值/规则：{"unit": "Zyra", "ability_damage_bonus_true_percent": 50, "bleed_seconds": 2}
- 对应版本：14.24官方优先；其余攻略候选，图片非12月冻结；状态：`candidate`；依据：[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)、[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)。

### bonus-Urgot

- 数值/规则：{"unit": "Urgot", "dash": "dash to targets", "on_cast_max_hp_shield_percent": 8, "on_cast_attack_speed_percent": 20, "duration_seconds": 5, "combat_start_shield_and_as": false}
- 对应版本：14.24官方优先；其余攻略候选，图片非12月冻结；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### bonus-Nunu

- 数值/规则：{"unit": "Nunu", "on_dealing_damage_self_max_hp_magic_percent": 3, "cooldown_seconds": 1}
- 对应版本：14.24官方优先；其余攻略候选，图片非12月冻结；状态：`candidate`；依据：[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)、[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)。

### bonus-Dr. Mundo

- 数值/规则：{"unit": "Dr. Mundo", "max_hp": 120, "on_kill_hp": 60, "official_original": "Experiment, Dr. Mundo's Experiment Bonus HP: 200 + 75 ⇒ 120 + 60"}
- 对应版本：14.23中途更新（2024-11-21）生效；14.24/14.24b公告未再改动；状态：`confirmed`；依据：[`riot-14.23`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-23-notes/)、[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)。
- 边界：已确认（官方，Riot 14.23公告）；数值120生命/击杀+60。tft.tools的120/60是正确的，与官方一致；LittleBuddyBot图中的200/75为改动前旧值，不用于目标版本。

### bonus-Twitch

- 数值/规则：{"unit": "Twitch", "after_attacks": 5, "image_nearest_enemy_max_hp_physical_percent": 15, "tools_nearest_enemy_max_hp_physical_percent": 20}
- 对应版本：旧图与当前攻略的跨版本参考；14.24/14.24b尚未冻结；状态：`candidate`；依据：[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)、[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)。
- 边界：图中Twitch 15%：来源可能早于 14.23，仅作参考，不作为约定值依据。当前tft.tools的20%也未独立冻结到14.24；两者不能构成目标版本的可靠冲突或定值依据。

### bonus-Warwick

- 数值/规则：{"unit": "Warwick", "on_kill_adjacent_enemy_stun_seconds": 1}
- 对应版本：14.24官方优先；其余攻略候选，图片非12月冻结；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### bonus-Emblem

- 数值/规则：{"unit": "Emblem", "image_trigger": "after 8 seconds or on death", "image_clone_hp_percent": 40, "clone_player_damage": 0}
- 对应版本：图中分身生命/时机为旧图参考；玩家伤害0为14.24官方字段；状态：`candidate`；依据：[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)、[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- 边界：图中纹章分身40%（及图中触发时机）：来源可能早于 14.23，仅作参考，不作为约定值依据。clone_player_damage=0由14.24官方修复支持，不能据此确认分身生命或触发时机。


### 未查到项目与建议约定

- **hex-coordinates-and-twitch-emblem**：未查到，建议约定值 {"hex_coordinates": "不固定伪造坐标，配置为空并阻塞Experiment随机格准入", "twitch_enemy_max_hp_percent": null, "emblem_clone_hp_percent": null, "unverified_bonus_enabled": false}，理由 坐标/生成算法及Twitch、纹章的目标版本数值未查到；旧图15%/40%来源可能早于14.23，不作为约定值依据，建议保持待定并阻塞相应效果。Mundo已由官方确认为120生命/击杀+60，移出缺口。建议未批准；查阅依据：[`experiment-image`](https://web.archive.org/web/20250219205122id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=319,fit=crop,trim=1.8125;0;1.8125;0/mnlvzo4MORckGV8d/set-13-tables-experimentbonuses-AzGeJ2kwzqSVMaVq.png)、[`experiment-tools`](https://tft.tools/info/set-13/traits/tft13_experiment)。

## 5. Black Rose的Sion

### summon-and-release

- 数值/规则：{"tiers": [3, 4, 5, 7], "summon": "战斗开始有被束缚Sion", "unlock_black_rose_casts": 5, "unlock_hp_below_percent": 65, "conditions_operator": "OR"}
- 对应版本：14.24通用文案；B未列修改；状态：`supported`；依据：[`sion-tools`](https://tft.tools/info/set-13/traits/tft13_cabal)。
- 边界：召唤与解锁是两件事；不能等第五次施法才生成Sion。具体开战事件排序尚未证实。

### official-stage-scaling

- 数值/规则：{"tier4_old": [1, 1.4, 2, 2.7, 3.5], "tier4_14_24": [0.9, 1.25, 2, 2.7, 3.5], "tier5_old": [1.2, 1.5, 2.2, 3.3, 3.9], "tier5_14_24": [1, 1.4, 2.1, 3, 3.65]}
- 对应版本：14.24正文；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- 边界：公告仅列5个序号，未标它们对应哪些stage；不擅自写成stage2–6或base HP。

### official-release-and-revive

- 数值/规则：{"tier5_heal": "治疗已损失生命，受重伤影响；不是直接set full HP", "tier7_revive_hp_percent_before": 50, "tier7_revive_hp_percent_14_24": 75}
- 对应版本：14.24正文；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### official-a-hotfix

- 数值/规则：{"tier5_shield_ap_percent": [175, 75], "tier5_shield_seconds": [5, 3], "tier5_stun_seconds": [1.5, 1]}
- 对应版本：14.24a 2024-12-10；B之前已生效；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- 边界：这里的75%AP、3秒、1秒只按公告写5 Black Rose；不自动推广成3/4档。

### ability-guide

- 数值/规则：{"tier3": {"freed_charge_hexes": 3, "freed_charge_ad_percent": 100, "active_shield_ap_percent": 175, "shield_seconds": 5, "line_stun_seconds": 1.5, "line_damage_ad_percent": 300}, "tier4": {"black_rose_damage_amp_on_sion_damaged_enemies_percent": 15, "duration": "rest of combat"}, "tier5": {"heal_missing_health": true, "bonus_ap_on_release": 100}, "tier7": {"guide_revive_hp_percent": 50, "cc_immune": true, "attack_speed_percent": 300, "omnivamp_percent": 40}}
- 对应版本：攻略旧表；3/4技能及5/7附加属性无法冻结14.24；状态：`candidate`；依据：[`sion-image`](https://web.archive.org/web/20250219203836id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=632,fit=crop,trim=0;1.812191103789127;0;1.812191103789127/mnlvzo4MORckGV8d/set-13-tables-blackrose-YD06PRypBgCRwglo.png)。
- 边界：图中7档50%与官方75%冲突，5档屏蔽/眩晕也不可据旧图覆盖A热修。


### 未查到项目与建议约定

- **full-stat-block-and-stage-star-formula**：未查到，建议约定值 {"sion_enabled": false, "missing": ["HP/AD/AS/Armor/MR/mana/range各档完整属性", "5个stage倍率对应阶段", "每星级成长及乘算顺序", "7档复活后完整技能"]}，理由 未查到14.24/14.24b完整属性表；零散倍率和旧技能图不足以反推基础值，建议阻塞Sion准入，不填0属性制造假数据。建议未批准；查阅依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`sion-tools`](https://tft.tools/info/set-13/traits/tft13_cabal)、[`sion-image`](https://web.archive.org/web/20250219203836id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=632,fit=crop,trim=0;1.812191103789127;0;1.812191103789127/mnlvzo4MORckGV8d/set-13-tables-blackrose-YD06PRypBgCRwglo.png)。

## 6. 形态英雄及召唤物默认值

### forge-guide-passive

- 数值/规则：{"count_star123": [1, 1, 6], "revive_hp_percent": 100, "front_nearest_allies": 3, "front_shield_ap_star123": [200, 275, 1800], "front_shield_seconds": 4, "back_attack_speed_percent_star123": [30, 40, 300], "back_buff_seconds": 3}
- 对应版本：当前Set13模块/攻略；非14.24冻结；状态：`candidate`；依据：[`jayce-tools`](https://tft.tools/info/set-13/units/tft13_jayce)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)。
- 边界：4秒/3秒是友军buff持续时间，不是锻炉存活时长。

### forge-official-revive-window

- 数值/规则：只在战斗仍进行时复活Hextech Forge
- 对应版本：14.24正文BUG FIXES；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### gangplank-melee-b-ad

- 数值/规则：{"14.24": 60, "14.24b": 65}
- 对应版本：14.24b DECEMBER17；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- 边界：公告限定Melee；不能自动改远程形态。


### 未查到项目与建议约定

- **Jayce-ranged-range**：未查到，建议约定值 {"range_hexes": 4}，理由 未查到对应14.24远程形态的可靠射程记录；通用模板1格不足以证明，4格只作为保持现有设想的待批准约定。建议未批准；查阅依据：[`jayce-tools`](https://tft.tools/info/set-13/units/tft13_jayce)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)。
- **Gangplank-ranged-range**：未查到，建议约定值 {"range_hexes": 4}，理由 未查到对应14.24远程形态的可靠射程记录；通用模板1格不足以证明，4格只作为保持现有设想的待批准约定。建议未批准；查阅依据：[`gangplank-tools`](https://tft.tools/info/set-13/units/tft13_gangplank)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)。
- **Swain-ranged-range**：未查到，建议约定值 {"range_hexes": 4}，理由 未查到对应14.24远程形态的可靠射程记录；通用模板1格不足以证明，4格只作为保持现有设想的待批准约定。建议未批准；查阅依据：[`swain-tools`](https://tft.tools/info/set-13/units/tft13_swain)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)。
- **Elise-ranged-range**：未查到，建议约定值 {"range_hexes": 4}，理由 未查到对应14.24远程形态的可靠射程记录；通用模板1格不足以证明，4格只作为保持现有设想的待批准约定。建议未批准；查阅依据：[`elise-tools`](https://tft.tools/info/set-13/units/tft13_elise)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)。
- **forge-hp-lifetime-other-defaults**：未查到，建议约定值 {"max_health": 1000, "armor": 0, "magic_resist": 0, "attack_enabled": false, "expiry": "战斗结束，死亡可由Jayce施法复活至100%"}，理由 未查到14.24锻炉生命、防御或独立倒计时；建议显式1000HP、0双抗、无独立寿命，作为可审阅的召唤物约定，不当原版数据。建议未批准；查阅依据：[`jayce-tools`](https://tft.tools/info/set-13/units/tft13_jayce)、[`forms-wiki`](https://wiki.leagueoflegends.com/en-us/Module%3ATFTUnitData/data)、[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- **barrel-hp-lifetime-other-defaults**：未查到，建议约定值 {"attackable": false, "health": null, "expires": "爆炸后立即移除，战斗结束统一清理", "count_cap": null, "damage_delay_seconds": null, "gangplank_ranged_enabled": false}，理由 未查到14.24桶的生命、是否可被敌军选中、数量与自动引爆时限；建议用不承伤技能实体，但在计数/引爆证据或玩法约定完成前阻塞远程技能。不能挪用召唤师峡谷3HP/25秒桶。建议未批准；查阅依据：[`gangplank-tools`](https://tft.tools/info/set-13/units/tft13_gangplank)。

## 7. 异变池及14.24/14.24b差异

### roll-rule

- 数值/规则：可重复但不连续出现同一个；公告说有针对当前阵容的轻微优化，未给权重表
- 对应版本：14.24正文；非B新增；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### cosmic-disabled

- 数值/规则：{"name": "Cosmic Rhythm", "enabled_14_24": false, "enabled_14_24b": false}
- 对应版本：14.24明确停用；B无重开公告，B禁用为继承判断；状态：`supported`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。
- 边界：14.24禁用为官方事实；B仍禁用是继承判断，不是第二份显式公告。

### pool-observations

- 数值/规则：{"pre_lolchess_database_count": 58, "post_lolchess_database_count": 58, "mobalytics_database_count": 60, "post_only": ["Hivemind"], "pre_only": ["Cosmic Rhythm"], "mobalytics_extra": ["Essence of Navori", "Miniaturize"]}
- 对应版本：网页快照，不等于正式服可抽池；状态：`conflict`；依据：[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13)、[`anomaly-moba-pre`](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies)、[`anomaly-moba-post`](https://web.archive.org/web/20241222150138/https://mobalytics.gg/tft/anomalies)。
- 边界：Hivemind的PBE旁证表明攻略库会提前纳入候选。

### 逐项清单与B差异

下表57个常规候选来自12/10 LoLCHESS列表去掉Cosmic；附停用/歧义项。**官方修改某个效果不证明其可对所有英雄抽到，攻略存在也不证明正式服启用。** 每行B差异为“未列”，不是“已核实零差异”。参数中未获官方覆盖部分只属攻略候选。

| 异变 | 14.24数值/规则（带证据边界） | 池状态/可信度 | 14.24b差异 | 依据 |
| --- | --- | --- | --- | --- |
| Arcana Overwhelming | MR+65；AP+=25% MR | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Attack Expert | 所有来源AD额外55% | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Avalanche of Armor | Armor+50；AD+=30% Armor | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Avarice Incarnate | 获得5金币；15%增伤，每2金币再+1%，上限40% | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Berserker Rage | 25AD%和25AP，生命低于50%时三倍 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Bully | 12%增伤；对更低星目标36% | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Bulwark | 40双抗，生命高于50%时三倍 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Calling Card | 获得该英雄一项非独有羁绊的纹章；可用纹章资格另受限制 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Center of the Universe | 6颗星；旧库70、后库75魔伤/颗；14.24仅确认轨道显著变快，精确周期未公开 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Comeback Story | 每损失10玩家生命+5%增伤（正文6%，12/10A回5%） | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Cull The Weak | 按目标缺失生命获得至多100%暴击；每3秒改选射程内生命百分比最低目标 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Deep Roots | +700HP、25双抗；不能移动/被眩晕；将目标拉进射程 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Defense Expert | 双抗所有来源额外66%（官方称Hardened Mind，别名对应未最终确认） | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Diving In | 首次施法跳入敌群，2格范围眩晕1.5秒；25%攻速、20%全能吸血 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Dragonsoul | 对每个新目标的首次攻击附带目标最大生命20%真伤 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Dramatic Entrance | 开战离场6秒；回场+55%最大生命，群体眩晕和击飞2秒 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Dual Wielding | 获得2件适合该英雄定位的成装 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Eagle Eye | +1射程；每2秒不移动+6%AD | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Energy Absorption | +30AP；每名友军死亡吸收其5%AP | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Fireball | 每花70法力触发2格火球；6%目标最大生命真伤，灼烧5秒（旧Moba写60法力） | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Force of Friendship | 全棋盘每个星级贡献1%增伤，三星每名按8%计 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Fortified | 先+12%最大生命，每4秒再+12%，至多5次 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Freestyling | 每个激活的非独有羁绊+4.5%增伤（旧库未写非独有） | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Giant-Sized | +1000HP | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Headhunter | +15%攻速；每击杀永久+1%（Hyper Roll双倍） | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Heavy Hitter | 普攻附带自身最大生命20%物伤，2.5秒冷却 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Hunger For Power | 开战吞噬最近友军，获得其60%HP和AD | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Hypervelocity | +10%攻速；每次施法叠15%攻速直到战斗结束 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Into the Unknown | 离开3轮；回归获得50AP与50%AD | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Invisibility | 每6秒隐身1秒；随后一击100%暴击率 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Kill Streak | 每击杀获得20法力 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Knockout | +15%AD；施法后下一击+35%暴击率并造成90%真伤 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Laser Eyes | 每秒100%AP魔伤，3格线；灼烧3秒 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Last Chance | 首次死亡满血复活，+50%攻速和20%全能吸血；每秒损失12.5%HP | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Legacy Of Shurima | 战斗10秒后飞升，+50%最大生命与60%攻速 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Mage Armor | 双抗+=50%AP | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Magic Expert | 所有来源AP额外40% | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Magic Training | +15AP；每花20法力，全队+2AP（旧Moba写15法力） | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Mini Mees | 3小分身每3次攻击各打30%AD；分身攻击削甲5 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Nothing Wasted | 每名友军死亡获得其当前法力70% | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| One Thousand Cuts | 普攻30真伤；目标每次受此效果伤害再叠12真伤 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Power Absorption | +30%AD；友军死亡吸其9%AD；14.24修复二次百分比AD放大 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Protective Shielding | 开战及每8秒给自身和生命最低2友军12%最大生命护盾，持续4秒 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Repulsor | +35%攻速；施法时目标在2格内则击退 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Scuttle Familiar | 死亡召蟹，继承100%最大生命/双抗；先清除Shred/Sunder再算 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Share Your Energy | 开战分享15%AD/AP/HP/双抗给邻格友军 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Slime Time | 每2秒1格范围130%AP魔伤，按伤害100%治疗 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Slow Cooker | 每秒1格范围造成自身最大生命3%魔伤；每6秒范围扩大 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Stoneskin | 开战+225双抗，每秒减少10 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Strength Training | +20%AD；每3次攻击全队+4%AD | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| The Finisher | 攻击和技能斩杀15%或以下生命的英雄 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Thornskin | +60双抗；受伤时按挡下伤害20%对邻近敌人造成魔伤 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Titanic Strikes | 攻击额外对目标及邻敌造成40%AD伤害 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Touch of Frost | 施法20%冰冷4秒；冰冷目标死亡眩晕最近敌人1秒 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Ultimate Hero | 三星1费在3轮后变四星 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Unstoppable Force | 参与击杀后冲向下一目标，眩晕1.5秒并治疗自身10%最大生命 | `guide_candidate_not_live_pool_proof`；攻略站，正式服池与全参数未冻结 | B公告未列本项变更；继承左栏仅作候选 | [`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Wolf Familiars | 2不可选中狼，攻速1.0；AD比例旧库45%、后库50%、Moba35%，14.24精确比例未锁定 | `official_patch_addresses_active_effect`；官方确认改动字段；其余攻略候选 | B公告未列本项变更；继承左栏仅作候选 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |
| Cosmic Rhythm | 每4秒自动施法，停止回蓝；14.24明确禁用 | `disabled_official_14_24`；官方 | B公告未列变更；未证实重开/改名 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/) |
| Essence of Navori | 初始最大法力-10%，每施法再-10%，至多-40%；旧库残留 | `disabled_community_supported`；攻略站/社区 | B公告未列变更；未证实重开/改名 | [`anomaly-disabled-community`](https://www.reddit.com/r/TeamfightTactics/comments/1h7091h/)、[`anomaly-moba-pre`](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies) |
| Miniaturize | 旧库称转成物品继承60%AD/AP/双抗；其他版本不同，禁用候选不使用数值 | `disabled_community_supported`；攻略站/社区 | B公告未列变更；未证实重开/改名 | [`anomaly-disabled-community`](https://www.reddit.com/r/TeamfightTactics/comments/1h7091h/)、[`anomaly-moba-pre`](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies) |
| Hivemind | 首个亲手击杀英雄获得复制品，+25%增伤；仅见后库/PBE旁证 | `pbe_or_unverified_exclude`；攻略站/社区 | B公告未列变更；未证实重开/改名 | [`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13)、[`hivemind-pbe`](https://www.reddit.com/r/TeamfightTactics/comments/1hh8quy/) |
| Hardened Mind | 14.24官方双抗增幅50%→66%；与Defense Expert是否同一ID未获原始ID证明 | `official_name_alias_unresolved`；官方 | B公告未列变更；未证实重开/改名 | [`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13) |

### 14.24公告原始改动字段（含A覆盖）

以下保留官方数值条目及必要的短规则原文；其余叙述不复制。所有字段均来自[Riot公告](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)对应小节。

| 版本 | 公告原文 |
| --- | --- |
| 14.24正文 | Arcana Overwhelming Bonus MR: 50  ⇒  65 |
| 14.24正文 | Avalanche of Armor Armor to AD Conversion: 25%  ⇒  30% |
| 14.24正文 | Center of the Universe Orbs now orbit significantly faster |
| 14.24正文 | Berserker Rage Base AD & AP: 20  ⇒  25 |
| 14.24正文 | Bully Base Damage Amp: 18%  ⇒  12% (Max is still 36%) |
| 14.24正文 | Comeback Story Damage Amp per 10 Health Lost: 5%  ⇒  6% |
| 14.24正文 | Cosmic Rhythm has been disabled |
| 14.24正文 | Dramatic Entrance Stun Duration: 1.5  ⇒  2 seconds, Bonus HP: 70%  ⇒  55% |
| 14.24正文 | Fireball Max HP Damage: 7%  ⇒  6% |
| 14.24正文 | Fortified Stacks Gain every 3  ⇒  4 sec |
| 14.24正文 | Hardened Mind Bonus Armor & MR: 50%  ⇒  66% |
| 14.24正文 | Heavy Hitter Cooldown: 3  ⇒  2.5 seconds |
| 14.24正文 | Kill Streak Mana Gain: 25  ⇒  20 |
| 14.24正文 | Laser Eyes AP Ratio: 80%  ⇒  100% |
| 14.24正文 | Legacy of Shurima Max Health: 40%  ⇒  50% |
| 14.24正文 | Mage Armor AP to Defenses: 40%  ⇒  50% |
| 14.24正文 | Magic Training Base AP: 20  ⇒  15 |
| 14.24正文 | Power Absorption [Bugfix]: Power Absorption’s AD is no longer multiplied by other sources of % Attack Damage. |
| 14.24正文 | Power Absorption Ally AD Absorb: 5%  ⇒  9%. |
| 14.24正文 | Protective Shielding Percent HP Shield: 15%  ⇒  12%, Shield Duration: 5  ⇒  4 sec |
| 14.24正文 | Nothing Wasted Mana Gain: 100%  ⇒  70% |
| 14.24正文 | One Thousand Cuts True Damage Per Auto: 15  ⇒  12 |
| 14.24正文 | Scuttle Familiar [Bugfix] now clears Shred and Sunder before calculating Armor and MR of the crab |
| 14.24正文 | Scuttle Familiar Stat%: 111%  ⇒  100 |
| 14.24正文 | Share Your Energy Stat Share: 12%  ⇒  15% |
| 14.24正文 | Slime Time AP Ratio: 100%  ⇒  130% |
| 14.24正文 | Slow Cooker Max Health Damage: 4%  ⇒  3% |
| 14.24正文 | Titanic Strikes AD Cleave: 30%  ⇒  40% |
| 14.24正文 | Ultimate Hero now has a 3-turn delay before the unit becomes 4-star |
| 14.24正文 | Wolf Familiars Attack Speed: 0.9  ⇒  1.0 |
| 14.24正文 | Dramatic Entrance now also knocks up enemies for the stun duration. |
| 14.24a 2024-12-10 | Comeback Story Damage Amp: 6%  ⇒  5% |

### 未查到项目与建议约定

- **complete-live-pool-and-b-deltas**：未查到，建议约定值 {"candidate_pool_count": 57, "candidate_pool": ["Arcana Overwhelming", "Attack Expert", "Avalanche of Armor", "Avarice Incarnate", "Berserker Rage", "Bully", "Bulwark", "Calling Card", "Center of the Universe", "Comeback Story", "Cull The Weak", "Deep Roots", "Defense Expert", "Diving In", "Dragonsoul", "Dramatic Entrance", "Dual Wielding", "Eagle Eye", "Energy Absorption", "Fireball", "Force of Friendship", "Fortified", "Freestyling", "Giant-Sized", "Headhunter", "Heavy Hitter", "Hunger For Power", "Hypervelocity", "Into the Unknown", "Invisibility", "Kill Streak", "Knockout", "Laser Eyes", "Last Chance", "Legacy Of Shurima", "Mage Armor", "Magic Expert", "Magic Training", "Mini Mees", "Nothing Wasted", "One Thousand Cuts", "Power Absorption", "Protective Shielding", "Repulsor", "Scuttle Familiar", "Share Your Energy", "Slime Time", "Slow Cooker", "Stoneskin", "Strength Training", "The Finisher", "Thornskin", "Titanic Strikes", "Touch of Frost", "Ultimate Hero", "Unstoppable Force", "Wolf Familiars"], "disabled": ["Cosmic Rhythm", "Essence of Navori", "Miniaturize"], "exclude_until_verified": ["Hivemind"], "merge_Hardened_Mind_with_Defense_Expert": false, "b_delta_assumption": 0}，理由 未查到完整14.24正式服白名单/权重及每项B前后抓包；57来自12/10攻略库去Cosmic，不能宣称57为官方完整池。B公告无异变段，建议延用A后值，但0差异是约定，不是沉默证明。建议未批准；查阅依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13)、[`anomaly-moba-pre`](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies)、[`anomaly-moba-post`](https://web.archive.org/web/20241222150138/https://mobalytics.gg/tft/anomalies)、[`hivemind-pbe`](https://www.reddit.com/r/TeamfightTactics/comments/1hh8quy/)。
- **unresolved-anomaly-fields**：未查到，建议约定值 {"center_star_damage": 70, "center_orbit_period_seconds": 2, "wolf_ad_percent": 45, "fireball_mana": 70, "magic_training_mana": 20, "defense_expert_percent": 66}，理由 中心轨道周期完全未查到；其他字段攻略跨版本冲突，建议保留12/10 LoLCHESS基线并用官方覆盖。2秒周期和Defense/Hardened映射必须单独批准。建议未批准；查阅依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`anomaly-pre`](https://web.archive.org/web/20241210082716/https://lolchess.gg/anomalies/set13)、[`anomaly-post`](https://web.archive.org/web/20250102215351/https://lolchess.gg/anomalies/set13)、[`anomaly-moba-pre`](https://web.archive.org/web/20241214034336/https://mobalytics.gg/tft/anomalies)。

## 8. 征服者每箱成长及阈值

### b-growth

- 数值/规则：{"14.24_percent": 3, "14.24b_percent": 5, "official_original": "Conqueror Stat Increase per chest opened: 3% ⇒ 5%"}
- 对应版本：14.24b 2024-12-17 TRAITS；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### external-thresholds

- 数值/规则：{"count": 15, "cumulative_conquest": [10, 35, 65, 100, 150, 200, 330, 440, 550, 660, 750, 850, 1000, 1200, 1500], "image_tenth": 650, "lolchess_tenth": 660, "tiers_16_to_20": null}
- 对应版本：未冻结14.24的攻略表；B前后阈值差异未证实；状态：`conflict`；依据：[`conqueror-lol`](https://lolchess.gg/rewards/set13/conqueror-war-chest-rewards?hl=en)、[`conqueror-image`](https://web.archive.org/web/20250219205805id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=439,fit=crop,trim=1.8136363636363635;0;1.8136363636363635;0/mnlvzo4MORckGV8d/set-13-tables-conqueror-A0xwaRK5L4sDDNWL.png)。
- 边界：第10档图片650 vs LoLCHESS660；不能同时称两者一致。20x Conquest是9羁绊击杀倍数，不是外部表提供20档的证据。


### 未查到项目与建议约定

- **twenty-tiers-and-b-threshold-difference**：未查到，建议约定值 {"thresholds_1_to_15": [10, 35, 65, 100, 150, 200, 330, 440, 550, 660, 750, 850, 1000, 1200, 1500], "tiers_16_to_20_enabled": false, "b_threshold_delta_assumption": 0}，理由 外部表只见15档，未找到第16–20档阈值，也未找到B修改阈值原文。建议先禁用未证实后5档，已列阈值暂用LoLCHESS，B保持不变只是约定。建议未批准；查阅依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、[`conqueror-lol`](https://lolchess.gg/rewards/set13/conqueror-war-chest-rewards?hl=en)、[`conqueror-image`](https://web.archive.org/web/20250219205805id_/https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=606,h=439,fit=crop,trim=1.8136363636363635;0;1.8136363636363635;0/mnlvzo4MORckGV8d/set-13-tables-conqueror-A0xwaRK5L4sDDNWL.png)。

## 9. B补丁范围与逐项原文

### anomaly-b-section

- 数值/规则：{"official_b_anomaly_changes_listed": 0, "meaning": "12/17段未列异变改动；不等于独立验证所有异变数值相同"}
- 对应版本：14.24b；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### boundary

- 数值/规则：{"ordinary_item_changes_in_b": 0, "chem_baron_item_changes": 15, "excluded": ["商店概率", "开场奇遇", "强化符文"], "included_for_completeness": ["全部B英雄/羁绊数值", "Chem-Baron羁绊产物", "Visionary交互修复"]}
- 对应版本：14.24b；状态：`confirmed`；依据：[`riot`](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

### 12月17日逐项公告原文

为避免漏掉既有英雄对补齐内容的影响，列出全部B英雄/羁绊条目并标范围；六费关联项单列。Chem-Baron特殊装备属于羁绊产物，纳入。没有将商店、奇遇、强化符文混入英雄/羁绊/异变清单。所有原文定位：[Riot公告 → Mid-Patch Updates → DECEMBER 17TH](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。

| 类别 | 范围 | 公告原文 |
| --- | --- | --- |
| trait | 既有内容的B一致性关联项 | Artilerist 6 Piece AD: 60% ⇒ 70% |
| trait | G2-3新内容 | Chem-Baron item, Destabilized Chemtank Shield Value: 20% ⇒ 25% |
| trait | G2-3新内容 | Chem-Baron item, Destabilized Chemtank II Shield Value: 35% ⇒ 50% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Destabilized Chemtank Base HP: 600 ⇒ 999 |
| trait | G2-3新内容 | Chem-Baron item, Perfected Destabilized Chemtank Every 4 second Shield: 10% ⇒ 20% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Destabilized Chemtank Bonus Vial Damage: 10% ⇒ 15% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Fleshripper Base AD: 45% ⇒ 60% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Piltoven Hexarmor Armor/MR per stack: 10 ⇒ 5 |
| trait | G2-3新内容 | Chem-Baron item, Perfected Shimmerbloom Shielding & Healing Increase: 60% ⇒ 50% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Shimmerbloom Shield Granted: 600 ⇒ 400 |
| trait | G2-3新内容 | Chem-Baron item, Perfected Shimmerbloom Bonus AP/AS Granted: 30% ⇒ 25% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Unleashed Toxins Bonus Wave Damage: 450 ⇒ 200 |
| trait | G2-3新内容 | Chem-Baron item, Perfected Unleashed Toxins Bonus Stun Duration: 1.5 sec ⇒ 1 sec |
| trait | G2-3新内容 | Chem-Baron item, Perfected Virulent Virus AP: 75 ⇒ 50 |
| trait | G2-3新内容 | Chem-Baron item, Perfected Virulent Virus Bonus Damage Reduction: 25% ⇒ 20% |
| trait | G2-3新内容 | Chem-Baron item, Perfected Virulent Virus Bonus Zombie HP: 1600 ⇒ 1200 |
| trait | 既有内容的B一致性关联项 | Conqueror Stat Increase per chest opened: 3% ⇒ 5% |
| trait | 既有内容的B一致性关联项 | Sniper Damage per Hex: 7/16/35% ⇒ 7/18/36% |
| trait | 既有内容的B一致性关联项 | Sorcerer AP: 20/50/95/110 ⇒ 20/50/95/125 |
| unit | 既有内容的B一致性关联项 | Singed Spell Damage Reduction 50/50/60/70% ⇒ 50/50/55/60% |
| unit | 既有内容的B一致性关联项 | Violet AD: 50 ⇒ 46 |
| unit | 既有内容的B一致性关联项 | Camille AD: 50 ⇒ 52 |
| unit | 既有内容的B一致性关联项 | Nocturne AD: 65 ⇒ 63 |
| unit | 既有内容的B一致性关联项 | Zeri AD: 45 ⇒ 48 |
| unit | G2-3新内容 | Gangplank (Melee) AD: 60 ⇒ 65 |
| unit | 既有内容的B一致性关联项 | Loris Mana: 50/90 ⇒ 40/80 |
| unit | 既有内容的B一致性关联项 | Ekko Spell Damage: 290/435/1200 ⇒ 300/450/1200 |
| unit | 既有内容的B一致性关联项 | Ekko Secondary Damage: 145/215/450 ⇒ 150/225/450 |
| unit | G2-3新内容 | Silco Monstrosity Damage: 38/57/100 ⇒ 36/55/100 |
| unit | 既有内容的B一致性关联项 | Malzahar Dot Damage: 14/21/400 ⇒ 15/22/400 |
| unit | 六费关联项（超出普通1–5费补齐，单列） | Viktor Energy: 4/8 ⇒ 3/8 |
| unit | 六费关联项（超出普通1–5费补齐，单列） | Viktor Laser Damage: 70/175/2000 ⇒ 50/180/2000 |
| unit | 六费关联项（超出普通1–5费补齐，单列） | Viktor Laser True Damage: 35/90/1000 ⇒ 25/90/1000 |
| unit | 六费关联项（超出普通1–5费补齐，单列） | Viktor Spell Damage 120/300/9999 ⇒ 100/300/9999 |
| bugfix | Visionary交互，含六费关联项 | Viktor and Zeri can no longer gain extra resources from 8 Visionary |
| bugfix | Visionary交互，含六费关联项 | Removing a Visionary Emblem from Viktor no longer causes him to lose his starting Chaos Energy. |

## 待决策清单

1. 是否接受上述待批准约定，或继续阻塞对应内容。建议：官方确证字段可作为后续实现候选；候选与冲突字段逐项批准，不能整份报告自动入运行时。
2. 学院组合、Sevika三个同值哈希、Sion完整属性、实验格坐标、桶引爆、征服者第16–20档仍需目标版本的原始符号或录像/客户端观测证据。
3. 异变候选57项不能对外声称完整正式服池；Hivemind等PBE线索先排除，Cosmic禁用，Miniaturize/Essence按社区停用证据保守排除。

机器可读对应文件：[external-sources.json](external-sources.json)。JSON中的`value:null`表示目标问题未查到；`proposed_value`为独立未批准约定，不是已证实数值。
