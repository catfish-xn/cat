# G2-1 source reconciliation

Candidate inventory: 33 admitted heroes (14 new), 8 traits (3 new), 8 ordinary components and36 completed items already present at base. Dispatch eighth-batch scope accepts this inventory: Swain is deferred to G2-2 pending form evidence; Spatula and emblems are excluded from G2-1/G2-2.

The frozen gzip is the only numerical source; `import-m8-source.py --g2-1` validates the decompressed SHA256 before extraction. `reconciliation.json` includes every raw attribute, all three-star skill coefficients, source trait names, runtime records, JSON pointers and canonical record hashes. Existing item conventions are preserved.

Selected origins share existing KogMaw/Scar/Vander and complete Automata/Firelight/Family teams; their extra six heroes are Nocturne, Blitzcrank, Malzahar, Ekko, Powder and Violet. Emblems and unique origins (Experiment/JunkerKing etc.) remain excluded.

## Heroes

| Hero / API | Cost | HP/AD/armor/MR | AS; mana; range | Source traits → selected | Source pointer | Approximation / status |
|---|---:|---|---|---|---|---|
| amumu / TFT13_Amumu | 1 | 600/45/35/35 | 0.6000000238418579; 0/0; 1 | Automata,Watcher → automata,watcher | /setData/1/champions/19 | Flat reduction is per resolved packet; raw hidden per-attacker cooldown not modeled. Sparks use one-second 20-tick pulses. |
| blitzcrank / TFT13_Blitzcrank | 3 | 850/60/50/50 | 0.6000000238418579; 20/70; 1 | Automata,Dominator → automata | /setData/1/champions/15 | Shield/shock instant; first surviving hit can retaliate immediately, then 20-tick cooldown; retaliation is next-tick, nonrecursive. |
| caitlyn / TFT13_Caitlyn | 5 | 900/82/40/40 | 0.550000011920929; 0/50; 13 | Enforcer,Sniper → sniper | /setData/1/champions/17 | Existing release unchanged except selected new origin membership. |
| corki / TFT13_Corki | 4 | 850/65/30/30 | 0.75; 0/60; 4 | Scrap,Artillerist → artillerist | /setData/1/champions/52 | Existing release unchanged except selected new origin membership. |
| darius / TFT13_Darius | 1 | 600/55/40/40 | 0.699999988079071; 30/70; 1 | Conqueror,Watcher → watcher | /setData/1/champions/58 | Existing release unchanged except selected new origin membership. |
| ekko / TFT13_Ekko | 4 | 1100/50/60/60 | 0.8500000238418579; 0/60; 1 | Firelight,Scrap,Ambusher → firelight | /setData/1/champions/18 | Afterimages collapsed to one damage packet per target; flat MR reduction applied immediately, stacks to combat end; no animation cast time. |
| ezreal / TFT13_Ezreal | 3 | 700/60/25/25 | 0.75; 0/60; 4 | Academy,Rebel,Artillerist → artillerist | /setData/1/champions/25 | Existing release unchanged except selected new origin membership. |
| garen / TFT13_Garen | 4 | 1000/65/60/60 | 0.6000000238418579; 60/125; 1 | Emissary,Watcher → watcher | /setData/1/champions/55 | Existing release unchanged except selected new origin membership. |
| illaoi / TFT13_Illaoi | 4 | 1100/70/60/60 | 0.6499999761581421; 65/125; 1 | Rebel,Sentinel → sentinel | /setData/1/champions/26 | Three one-second drain pulses; nearest enemies resampled each pulse; slam radius2 uses armor+MR sampled at cast. PercentBonusHealthSteal hidden modifier not modeled. |
| irelia / TFT13_Irelia | 1 | 700/45/40/40 | 0.6000000238418579; 30/70; 1 | Rebel,Sentinel → sentinel | /setData/1/champions/59 | Existing release unchanged except selected new origin membership. |
| kogmaw / TFT13_KogMaw | 3 | 650/15/25/25 | 0.699999988079071; 0/40; 4 | Automata,Sniper → automata,sniper | /setData/1/champions/67 | Existing release unchanged except selected new origin membership. |
| leblanc / TFT13_LeBlanc | 5 | 900/50/40/40 | 0.800000011920929; 45/90; 4 | Black Rose,Sorcerer → sorcerer | /setData/1/champions/32 | Nearest chain members; chain redistribution on next tick, no recursive shares; initial kills increase empowered attacks by source AutoKillBonus. |
| leona / TFT13_Leona | 2 | 800/55/50/50 | 0.6000000238418579; 50/90; 1 | Academy,Sentinel → sentinel | /setData/1/champions/66 | Existing release unchanged except selected new origin membership. |
| loris / TFT13_Beardy | 3 | 850/50/50/50 | 0.6499999761581421; 50/90; 1 | Enforcer,Sentinel → sentinel | /setData/1/champions/41 | Existing release unchanged except selected new origin membership. |
| lux / TFT13_Lux | 1 | 500/30/20/20 | 0.699999988079071; 0/50; 4 | Academy,Sorcerer → sorcerer | /setData/1/champions/69 | Existing release unchanged except selected new origin membership. |
| maddie / TFT13_Shooter | 1 | 500/50/15/15 | 0.699999988079071; 20/120; 6 | Enforcer,Sniper → sniper | /setData/1/champions/43 | Existing release unchanged except selected new origin membership. |
| malzahar / TFT13_Malzahar | 5 | 950/45/40/40 | 0.800000011920929; 30/95; 4 | Automata,Visionary → automata | /setData/1/champions/20 | Finite caster-to-target path last5 cells plus target; five infection stacks round-robin on sorted targets; one pulse per20 ticks; dead target transfers to nearest living enemy, survives caster death. |
| nami / TFT13_Nami | 3 | 700/40/25/25 | 0.699999988079071; 0/60; 4 | Emissary,Sorcerer → sorcerer | /setData/1/champions/51 | Existing release unchanged except selected new origin membership. |
| nocturne / TFT13_Nocturne | 2 | 700/65/45/45 | 0.800000011920929; 0/40; 1 | Automata,Quickstriker → automata | /setData/1/champions/57 | Four bleed pulses at 5-tick intervals; primary and adjacent cells sampled on attack. |
| powder / TFT13_Blue | 1 | 500/35/15/15 | 0.699999988079071; 40/120; 4 | Family,Scrap,Ambusher → family | /setData/1/champions/44 | Largest cluster center is an occupied enemy cell; ties by ID; instant explosion; additive per-hex damage falloff; HERO friendly fire excluded. |
| rell / TFT13_Rell | 2 | 800/60/45/45 | 0.6000000238418579; 40/90; 1 | Conqueror,Sentinel,Visionary → sentinel | /setData/1/champions/28 | Existing release unchanged except selected new origin membership. |
| rumble / TFT13_Rumble | 5 | 1200/60/70/70 | 0.800000011920929; 40/120; 1 | Junker King,Scrap,Sentinel → sentinel | /setData/1/champions/37 | Row targets sorted by column; one missile per occupied row target, remaining missiles refund mana; all five hit sole survivor. Junker King upgrades excluded. |
| scar / TFT13_FlyGuy | 3 | 800/50/50/50 | 0.6499999761581421; 80/170; 1 | Firelight,Watcher → firelight,watcher | /setData/1/champions/46 | Existing release unchanged except selected new origin membership. |
| singed / TFT13_Singed | 1 | 650/55/40/40 | 0.6000000238418579; 0/50; 1 | Chem-Baron,Sentinel → sentinel | /setData/1/champions/11 | Damage leader includes shield damage; ties by unit ID; linear AS decay at 50ms steps; self durability expires after source Duration. |
| swain / TFT13_Swain | 3 | 650/50/0/null | 0.5; 0/10; 1 | Conqueror,Form Swapper,Sorcerer → sorcerer | /setData/1/champions/73 | BLOCKED: raw caster template armor=0, MR=null, mana=0/10; demon record also lacks core stats. No playable attributes invented. |
| tristana / TFT13_Tristana | 2 | 550/42/20/20 | 0.75; 20/60; 4 | Emissary,Artillerist → artillerist | /setData/1/champions/72 | Existing release unchanged except selected new origin membership. |
| twitch / TFT13_Twitch | 4 | 800/70/30/30 | 0.75; 0/60; 6 | Experiment,Sniper → sniper | /setData/1/champions/22 | Finite path to seeded random target; 40% multiplicative falloff by pierced target; one shared critical roll per bolt. Experiment origin excluded. |
| urgot / TFT13_Urgot | 2 | 700/50/45/45 | 0.699999988079071; 20/70; 2 | Experiment,Pit Fighter,Artillerist → artillerist | /setData/1/champions/75 | Existing release unchanged except selected new origin membership. |
| vander / TFT13_Prime | 2 | 800/50/45/45 | 0.699999988079071; 0/50; 1 | Family,Watcher → family,watcher | /setData/1/champions/45 | Existing release unchanged except selected new origin membership. |
| violet / TFT13_Red | 1 | 650/50/40/40 | 0.800000011920929; 20/65; 1 | Family,Pit Fighter → family | /setData/1/champions/50 | Jabs and uppercut resolve in one cast tick; control begins following tick for5 ticks. |
| vladimir / TFT13_Vladimir | 2 | 800/45/45/45 | 0.6499999761581421; 0/65; 1 | Black Rose,Watcher,Sorcerer → watcher,sorcerer | /setData/1/champions/30 | Instant single-target heal/damage; HERO augment branches excluded. |
| zeri / TFT13_Zeri | 2 | 600/45/20/20 | 0.75; 0/3; 6 | Firelight,Sniper → firelight,sniper | /setData/1/champions/49 | Every third attack replaces base; nearest two bounces; secondary packets cannot crit, matching existing secondary-attack convention. |
| zoe / TFT13_Zoe | 4 | 800/40/30/30 | 0.75; 20/80; 4 | Rebel,Sorcerer → sorcerer | /setData/1/champions/76 | Existing release unchanged except selected new origin membership. |
| zyra / TFT13_Zyra | 1 | 500/30/20/20 | 0.699999988079071; 10/60; 4 | Experiment,Sorcerer → sorcerer | /setData/1/champions/63 | Existing release unchanged except selected new origin membership. |

## Origins

| Origin | Source breakpoint variables | Runtime thresholds | Approximation |
|---|---|---|---|
| Automata | [{"min":2,"ConversionDamagePct":0.25,"MagicDamage":150,"Resists":25,"TriggerNumCrystals":20,"{a142f31c}":1},{"min":4,"ConversionDamagePct":0.25,"MagicDamage":400,"Resists":60,"TriggerNumCrystals":20,"{a142f31c}":1},{"min":6,"ConversionDamagePct":0.25,"MagicDamage":1100,"Resists":140,"TriggerNumCrystals":20,"{a142f31c}":1}] | 2/4 | Damage packet grants one crystal; excludes own blast; next-tick blast. Tier6 requires emblems and omitted. |
| Family | [{"min":3,"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.25},{"min":4,"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.30000001192092896},{"min":5,"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.4000000059604645,"{01fcc30b}":0.75,"{217874f1}":2.5,"{43cb93dd}":1.25,"{46c3fc24}":1.5,"{6fc9f267}":17,"{8173be81}":2,"{9000fe5b}":2,"{92029cea}":0.5}] | 3 | Only reachable3-member tier; maximum mana floor(75%); 20% durability. Tier4/5 omitted without emblems; no heist. |
| Firelight | [{"min":2,"Duration":6,"PercentDamageTakenHeal":0.20000000298023224,"{0a9a9714}":null,"{3c0d594a}":1},{"min":3,"Duration":6,"PercentDamageTakenHeal":0.33000001311302185,"{0a9a9714}":null,"{3c0d594a}":1},{"min":4,"Duration":6,"PercentDamageTakenHeal":0.4000000059604645,"{0a9a9714}":3.5,"{3c0d594a}":1}] | 2/3 | Dash teleports to nearest free neighbor of target each120 ticks; HP damage since prior dash only, shield damage excluded. Tier4 omitted without emblems. |

## Components and completed items

No new recipes were required: base already contains every unordered pair of the eight ordinary components (8×9/2=36). A ninth ordinary component does not exist in the locked source policy. Dispatch explicitly excludes Spatula and emblems from G2-1/G2-2.

| Runtime / API | Recipe | Source effects | Runtime conventions |
|---|---|---|---|
| adaptive-helm / TFT_Item_AdaptiveHelm | cloak + tear | {"AP":10,"BackRowBonusAP":15,"FrontLineManaPerHit":1,"FrontRowBonusResists":40,"MagicResist":20,"Mana":15,"ManaPerTickrate":10,"ManaTickrate":3,"{d357c9f2}":null} | A-01, GLOBAL-STAT-01 |
| archangel / TFT_Item_ArchangelsStaff | rod + tear | {"AP":20,"APPerInterval":30,"IntervalSeconds":5,"Mana":15} | A-02, GLOBAL-STAT-01 |
| sword / TFT_Item_BFSword | component | {"AD":0.10000000149011612} | GLOBAL-STAT-01 |
| bloodthirster / TFT_Item_Bloodthirster | sword + cloak | {"AD":0.15000000596046448,"AP":15,"HealthThreshold":40,"LifeSteal":20,"MagicResist":20,"ShieldDuration":5,"ShieldHealthPercent":25,"StatOmnivamp":0.20000000298023224} | A-04, GLOBAL-STAT-01 |
| blue-buff / TFT_Item_BlueBuff | tear + tear | {"AD":0.15000000596046448,"AP":15,"DamageAmp":0.05000000074505806,"Mana":30,"ManaRefund":10,"TakedownTimer":8} | A-05, GLOBAL-STAT-01 |
| bramble-vest / TFT_Item_BrambleVest | vest + vest | {"1StarAoEDamage":100,"2StarAoEDamage":100,"3StarAoEDamage":100,"Armor":65,"AutoDamageReduction":0.07999999821186066,"ICD":2,"PercentMaxHP":0.07000000029802322,"{6688a0d5}":100,"{b5c2a66b}":100} | A-06, GLOBAL-STAT-01 |
| vest / TFT_Item_ChainVest | component | {"Armor":20} | GLOBAL-STAT-01 |
| crownguard / TFT_Item_Crownguard | vest + rod | {"AP":20,"Armor":20,"ChillDuration":4,"Health":100,"HexRange":2,"ShieldBonusAP":25,"ShieldDuration":8,"ShieldSize":25} | A-08, GLOBAL-STAT-01 |
| deathblade / TFT_Item_Deathblade | sword + sword | {"AD":0.550000011920929,"BonusDamage":0.07999999821186066,"{1543aa48}":0.07999999821186066} | A-09, GLOBAL-STAT-01 |
| dragons-claw / TFT_Item_DragonsClaw | cloak + cloak | {"HealthRegenInterval":2,"ICD":0.5,"MagicResist":75,"PercentHealthDamage":2.5,"PercentMaxHP":0.09000000357627869} | A-10, GLOBAL-STAT-01 |
| protectors-vow / TFT_Item_FrozenHeart | vest + tear | {"Armor":20,"HealthThreshold":40,"Mana":30,"ShieldDuration":5,"ShieldHealthPercent":25,"Stats":20} | A-11, GLOBAL-STAT-01 |
| gargoyle / TFT_Item_GargoyleStoneplate | vest + cloak | {"Armor":25,"ArmorPerEnemy":10,"Health":100,"MRPerEnemy":10,"MagicResist":25} | A-12, GLOBAL-STAT-01 |
| belt / TFT_Item_GiantsBelt | component | {"Health":150} | GLOBAL-STAT-01 |
| edge-of-night / TFT_Item_GuardianAngel | sword + vest | {"AD":0.10000000149011612,"Armor":20,"AttackSpeed":15,"DamageReduction":100,"HealthThreshold":60,"StealthDuration":1} | A-14, GLOBAL-STAT-01 |
| rageblade / TFT_Item_GuinsoosRageblade | bow + rod | {"AP":10,"AS":10,"AttackSpeedPerStack":5} | A-15, GLOBAL-STAT-01 |
| gunblade / TFT_Item_HextechGunblade | sword + rod | {"AD":0.20000000298023224,"AP":20,"AllyHealing":0.25,"Omnivamp":15,"StatOmnivamp":0.15000000596046448} | A-16, GLOBAL-STAT-01 |
| infinity-edge / TFT_Item_InfinityEdge | sword + gloves | {"AD":0.3499999940395355,"CritChance":35,"CritDamageToGive":0.10000000149011612} | A-17, GLOBAL-STAT-01 |
| ionic-spark / TFT_Item_IonicSpark | rod + cloak | {"AP":15,"Damage":250,"Health":100,"HexRange":2,"MRShred":30,"MagicResist":25,"ManaRatio":160} | A-18, GLOBAL-STAT-01 |
| jeweled-gauntlet / TFT_Item_JeweledGauntlet | rod + gloves | {"AP":35,"CritChance":35,"CritDamageToGive":0.10000000149011612} | A-19, GLOBAL-STAT-01 |
| last-whisper / TFT_Item_LastWhisper | bow + gloves | {"AD":0.15000000596046448,"AS":20,"ArmorBreakDuration":3,"ArmorReductionPercent":30,"CritChance":20} | A-20, GLOBAL-STAT-01 |
| nashors-tooth / TFT_Item_Leviathan | belt + bow | {"AP":10,"AS":10,"ASDuration":5,"AttackSpeedToGive":60,"Health":150} | A-21, GLOBAL-STAT-01 |
| giant-slayer / TFT_Item_MadredsBloodrazor | sword + bow | {"AD":0.25,"AP":25,"AS":10,"DamageAmp":0.20000000298023224,"HealthThreshold":1750,"LargeBonusPct":25,"{1543aa48}":0.05000000074505806} | GLOBAL-STAT-01, GS-01 |
| morellonomicon / TFT_Item_Morellonomicon | belt + rod | {"AP":25,"AS":10,"BurnDuration":10,"BurnPercent":1,"GrievousWoundsPercent":33,"Health":150,"MonsterCap":100,"TicksPerSecond":1} | B-01, B-02, GLOBAL-STAT-01 |
| rod / TFT_Item_NeedlesslyLargeRod | component | {"AP":10} | GLOBAL-STAT-01 |
| cloak / TFT_Item_NegatronCloak | component | {"MagicResist":20} | GLOBAL-STAT-01 |
| steadfast-heart / TFT_Item_NightHarvester | vest + gloves | {"Armor":20,"BaseDamageReduction":8,"BaseDurability":0.07999999821186066,"CritChance":20,"EmpowerDamageReduction":15,"EmpoweredDurability":0.15000000596046448,"Health":200,"ThresholdForEmpower":0.5} | GLOBAL-STAT-01 |
| guardbreaker / TFT_Item_PowerGauntlet | belt + gloves | {"AP":10,"AS":20,"CritChance":20,"DamageAmp":0.15000000596046448,"Duration":3,"Health":150,"{1543aa48}":0.10000000149011612} | B-04, GLOBAL-STAT-01 |
| quicksilver / TFT_Item_Quicksilver | cloak + gloves | {"AS":30,"CritChance":20,"MagicResist":20,"ProcAttackSpeed":0.029999999329447746,"ProcInterval":2,"SpellShieldDuration":18} | GLOBAL-STAT-01 |
| deathcap / TFT_Item_RabadonsDeathcap | rod + rod | {"AP":50,"BonusDamage":0.15000000596046448,"{1543aa48}":0.15000000596046448} | B-06, GLOBAL-STAT-01 |
| red-buff / TFT_Item_RapidFireCannon | bow + bow | {"AS":35,"BonusDamage":0.05999999865889549,"BurnPercent":1,"Duration":5,"HealingReductionPct":33,"HexRangeIncrease":1,"{1543aa48}":0.029999999329447746,"{9f5117db}":100} | B-07, GLOBAL-STAT-01 |
| bow / TFT_Item_RecurveBow | component | {"AS":10} | GLOBAL-STAT-01 |
| sunfire-cape / TFT_Item_RedBuff | vest + belt | {"Armor":20,"BonusPercentHP":0.07999999821186066,"BurnDuration":10,"BurnPercent":1,"GrievousWoundsPercent":33,"Health":150,"HexRange":2,"ICD":2,"MonsterCap":100} | B-02, GLOBAL-STAT-01 |
| redemption / TFT_Item_Redemption | belt + tear | {"AoEDamageReduction":10,"HealTickRate":5,"Health":150,"HexRadius":1,"Mana":15,"MaxHeal":1000,"MissingHealthHeal":15} | B-09, GLOBAL-STAT-01 |
| runaans-hurricane / TFT_Item_RunaansHurricane | cloak + bow | {"AD":0.25,"AS":10,"AdditionalTargets":1,"MagicResist":20,"MultiplierForDamage":55} | B-10, GLOBAL-STAT-01 |
| gloves / TFT_Item_SparringGloves | component | {"CritChance":20} | GLOBAL-STAT-01 |
| shojin / TFT_Item_SpearOfShojin | sword + tear | {"AD":0.15000000596046448,"AP":15,"FlatManaRestore":5,"Mana":15} | GLOBAL-STAT-01 |
| evenshroud / TFT_Item_SpectralGauntlet | belt + cloak | {"ARReductionAmount":30,"BonusResistDuration":10,"BonusResists":25,"Health":150,"HexRange":2,"MagicResist":20} | GLOBAL-STAT-01 |
| statikk-shiv / TFT_Item_StatikkShiv | bow + tear | {"1StarBounces":4,"AP":15,"AS":15,"Damage":35,"MRShred":30,"MRShredDuration":5,"Mana":15,"{12a15e9e}":4,"{15144cec}":4,"{79e2ec7b}":4} | B-13, GLOBAL-STAT-01 |
| steraks-gage / TFT_Item_SteraksGage | sword + belt | {"AD":0.15000000596046448,"BonusADToGive":35,"BonusMaxHealthPerc":25,"Health":150,"HealthThreshold":60} | GLOBAL-STAT-01 |
| tear / TFT_Item_TearOfTheGoddess | component | {"Mana":15} | GLOBAL-STAT-01 |
| thiefs-gloves / TFT_Item_ThiefsGloves | gloves + gloves | {"CritChance":20,"Health":150} | GLOBAL-STAT-01 |
| titans-resolve / TFT_Item_TitansResolve | vest + bow | {"AS":10,"Armor":20,"BonusResistsAtStackCap":20,"StackCap":25,"StackingAD":0.019999999552965164,"StackingSP":2} | GLOBAL-STAT-01 |
| hand-of-justice / TFT_Item_UnstableConcoction | gloves + tear | {"AD_NotStatBar":0.15000000596046448,"AP_NotStatBar":15,"CritChance":20,"HealthThreshold":0.5,"Mana":15,"StatOmnivamp_NotStatBar":0.11999999731779099,"{f23e83fc}":2} | GLOBAL-STAT-01 |
| warmog / TFT_Item_WarmogsArmor | belt + belt | {"BonusPercentHP":0.11999999731779099,"Health":600} | GLOBAL-STAT-01 |

## Review and evidence

The hidden Amumu cooldown, Illaoi bonus-health drain modifier and unproved form attributes are substantive limitations, not source-equivalence claims. HERO augment variables and Rumble unique-trait upgrades remain captured but inactive. All81 icons are committed under public/assets/s13; assets-manifest.json records their source/hash/size (includes the deferred Swain icon only). Old content identities are rejected by restore and original historical recordings remain preserved for read-only export.

Rebuild: `python3 scripts/import-m8-source.py --g2-1 --check`; `python3 scripts/generate-g2-content.py --check`; `node scripts/generate-g2-audit.cjs --check`. Release: `node scripts/record-g2-1-release.cjs` (or `--check`).
