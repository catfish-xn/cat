# M3 frozen implementation rules

Implementation baseline: merged M2 main `169f28e`. Rules `m3-v1`, content `m3-content-v1`, schema3. M3_PLAN.md is preserved as the design record; this file records the implemented contract.

- Match starts level3/XP0/HP100/gold10, five one-star owned units, seven bench slots, five shop slots. Population cap equals level.
- F buys4XP for4G. XP thresholds for level1–8: 2,2,6,10,20,36,56,80. Level9 clamps XP to0; F rejects. Every first terminal settlement gives5G and2XP (discard capped overflow); Continue gives neither.
- D costs2G. Each shop slot draws a cost then a definition, exactly ten LCG words per shop. Catalog and odds are frozen in match-rules.ts. Buying, F, merging, combat and enemies consume no random words.
- Buy costs definition.cost; sell refunds cost times 1/3/9 for stars1/2/3. HP/AD scale100/180/324 percent with floor; abilities use explicit per-star values.
- Purchase plans include recursive triples before checking final bench capacity. Board(row,col,ID) survivors precede bench(slot,ID), then incoming candidate. Survivor keeps ID/position; successful purchase always increments serial once even if immediately consumed. Output roster is ID sorted. Failed purchase returns the exact old state and no events.
- Terminal Match transition owns income, XP, HP and history. Base damage2+2*floor((round-1)/3); win0, loss base+2*livingEnemies, draw base. Clamp HP to0 and enter gameOver immediately. Empty player deployment concedes at tick0; missing enemies remain invalid. New Match resets the entire seed42 match.
- Fixed enemy templates advance only on Continue; player preparation is retained. New enemy IDs include round, never consume the player serial or RNG.
- Combat remains20ticks/s, max1200ticks, existing BFS/reservations/target ties. Expire shields, move, plan attack/cast intents, grant all shields, mitigate each packet, apply aggregated damage simultaneously, award survivor Mana, resolve deaths and terminal result.
- Successful attack intent gains10Mana; surviving damage recipient gains min(20,floor(actualHPdamage/10)) per tick. Mana gained this tick can cast only next tick. Full-Mana valid cast has priority, spends all Mana, excludes same-tick attack and resets attack cooldown. Dead casters' committed effects still land.
- Nonnegative resistance: raw0→0; otherwise max(1,floor(raw*100/(100+resist))). Physical uses armor, magic uses MR. Each packet rounds separately; shield absorbs before HP. damage.amount is mitigated incoming including overkill; hpDamage is actual HP loss.
- Self shields take max(current,grant), refresh integer expiry, never add. Expire at tick>=expiry; zero shield means null expiry. New shields block same-tick damage.
- JSON state includes resolved Ability snapshots. No UI timers, RNG, counters or callbacks decide simulation rules. M2 unversioned snapshots/replays are not M3-compatible.
