import { B4XP_ARCHIVE } from './augment-pool-batch4-b4xp-archive';
import { AUGMENT_BATCH4_B4XP } from '../src/simulation/content/augment-pool-batch4-b4xp';
import { B4REROLL_ARCHIVE } from './augment-pool-batch4-b4reroll-archive';
// Offline only: rebuild the exact original identity roots, including all text/provenance.
import { AUGMENT_BATCH1 } from '../src/simulation/content/augment-pool-batch1';
import { AUGMENT_BATCH2 } from '../src/simulation/content/augment-pool-batch2';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { AUGMENT_BATCH3_XP } from '../src/simulation/content/augment-pool-batch3-xp';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { RULES_GAP_MANIFEST as runtimeManifest } from '../src/simulation/content/rules-manifest';
import { AUGMENT_POOL_TEXT } from '../src/presentation/augment-pool-text';
const BATCH1_NOTES = {
  "coronation": {
    "description_en_us": "Gain a Tactician's Crown. Tactician's Crown, Shield, and Cape grant the holder an additional 30% Attack Speed, 30% Attack Damage, and 40 Ability Power."
  },
  "tacticians-kitchen": {
    "description_en_us": "Gain a Tactician's Cape and a random Emblem."
  },
  "branching-out": {
    "description_en_us": "Gain a random Emblem and a Reforger.\n\nReforgers allow you to remake any item."
  },
  "item-grab-bag-i": {
    "description_en_us": "Gain 1 random completed item."
  },
  "one-two-five": {
    "description_en_us": "Gain 1 random component, 2 gold, and 1 random 5-cost champion."
  },
  "band-of-thieves-i": {
    "description_en_us": "Gain 1 Thief's Gloves."
  },
  "teaming-up-i": {
    "description_en_us": "Gain 1 random component and 2 random Tier 3 champions."
  },
  "iron-assets": {
    "description_en_us": "Gain a component anvil and 4 gold.\n\nThe anvil offers 4 choices."
  },
  "missed-connections": {
    "description_en_us": "Gain a copy of each 1-cost champion."
  },
  "ones-twos-three": {
    "description_en_us": "Gain 2 1-cost champion, 2 2-cost champions, and 1 3-cost champion."
  },
  "silver-spoon": {
    "description_en_us": "Gain 10 XP.\n"
  },
  "heroic-grab-bag": {
    "description_en_us": "Gain 2 Lesser Champion Duplicators and 9 gold.\n\nThis item allows you to copy a 3-cost or less champion."
  },
  "raining-gold": {
    "description_en_us": "Gain 8 gold now and 1 gold every round."
  },
  "raining-gold-plus": {
    "description_en_us": "Gain 18 gold now and 1 gold every round."
  },
  "academy-crest": {
    "description_en_us": "Gain an Academy Emblem and a Leona."
  },
  "ambusher-crest": {
    "description_en_us": "Gain an Ambusher Emblem and a Camille."
  },
  "artillerist-crest": {
    "description_en_us": "Gain an Artillerist Emblem and a Tristana."
  },
  "automata-crest": {
    "description_en_us": "Gain an Automata Emblem and a Nocturne."
  },
  "bruiser-crest": {
    "description_en_us": "Gain a Bruiser Emblem and a Sett."
  },
  "black-rose-crest": {
    "description_en_us": "Gain a Black Rose Emblem."
  },
  "chem-baron-crest": {
    "description_en_us": "Gain a Chem-Baron Emblem and a Renata Glasc."
  },
  "conqueror-crest": {
    "description_en_us": "Gain a Conqueror Emblem and a Rell."
  },
  "dominator-crest": {
    "description_en_us": "Gain a Dominator Emblem and a Blitzcrank."
  },
  "enforcer-crest": {
    "description_en_us": "Gain an Enforcer Emblem."
  },
  "experiment-crest": {
    "description_en_us": "Gain an Experiment Emblem and an Urgot."
  },
  "family-crest": {
    "description_en_us": "Gain a Family Emblem and a Violet."
  },
  "firelight-crest": {
    "description_en_us": "Gain a Firelight Emblem and a Zeri."
  },
  "pit-fighter-crest": {
    "description_en_us": "Gain a Pit Fighter Emblem and an Urgot."
  },
  "quickstriker-crest": {
    "description_en_us": "Gain a Quickstriker Emblem and an Akali."
  },
  "rebel-crest": {
    "description_en_us": "Gain a Rebel Emblem and an Akali."
  },
  "scrap-crest": {
    "description_en_us": "Gain a Scrap Emblem and a Ziggs."
  },
  "sentinel-crest": {
    "description_en_us": "Gain a Sentinel Emblem and a Rell."
  },
  "sniper-crest": {
    "description_en_us": "Gain a Sniper Emblem and a Zeri."
  },
  "sorcerer-crest": {
    "description_en_us": "Gain a Sorcerer Emblem and a Vladimir."
  },
  "visionary-crest": {
    "description_en_us": "Gain a Visionary Emblem and a Renata Glasc."
  },
  "watcher-crest": {
    "description_en_us": "Gain a Watcher Emblem and a Vander."
  },
  "big-grab-bag": {
    "description_en_us": "Gain 3 random components, 2 gold, and 1 Reforger. \n\nReforgers allow you to remake any item."
  },
  "teaming-up-ii": {
    "description_en_us": "Gain 1 random Support item and 2 random 4-cost champions."
  },
  "support-cache": {
    "description_en_us": "Choose 1 of 4 Support items."
  },
  "duo-queue": {
    "description_en_us": "Gain 2 random 5-cost champions and 2 copies of a random component."
  },
  "two-trick": {
    "description_en_us": "Gain a random 2-star two-cost and 2 random 2-star one-cost champions."
  },
  "build-a-bud": {
    "description_en_us": "Gain a random 3-star 1-cost champion and 8 gold."
  },
  "radiant-refactor": {
    "description_en_us": "Gain a Masterwork Upgrade and 1 component anvil.\n\nMasterwork Upgrade upgrades an item to Radiant!"
  },
  "academy-crown": {
    "description_en_us": "Gain an Academy Emblem and a random sponsored item."
  },
  "ambusher-crown": {
    "description_en_us": "Gain an Ambusher Emblem, a Hand of Justice, and a Camille."
  },
  "artillerist-crown": {
    "description_en_us": "Gain an Artillerist Emblem, a Runaan's Hurricane, and a Tristana."
  },
  "automata-crown": {
    "description_en_us": "Gain an Automata Emblem, a Guardbreaker, and a Nocturne."
  },
  "bruiser-crown": {
    "description_en_us": "Gain a Bruiser Emblem, a Redemption, and a Sett."
  },
  "black-rose-crown": {
    "description_en_us": "Gain a Black Rose Emblem and a Spear of Shojin."
  },
  "chem-baron-crown": {
    "description_en_us": "Gain a Chem-Baron Emblem, a Nashor's Tooth, and a Smeech."
  },
  "conqueror-crown": {
    "description_en_us": "Gain a Conqueror Emblem, a Last Whisper, and a Rell."
  },
  "dominator-crown": {
    "description_en_us": "Gain a Dominator Emblem, a Protector's Vow, and a Blitzcrank."
  },
  "enforcer-crown": {
    "description_en_us": "Gain an Enforcer Emblem, an Infinity Edge, and a Maddie."
  },
  "experiment-crown": {
    "description_en_us": "Gain an Experiment Emblem, a Bloodthirster, and an Urgot."
  },
  "family-crown": {
    "description_en_us": "Gain a Family Emblem, a Redemption, a Vander, and a Violet."
  },
  "firelight-crown": {
    "description_en_us": "Gain a Firelight Emblem, a Protector's Vow, and a Scar."
  },
  "pit-fighter-crown": {
    "description_en_us": "Gain a Pit Fighter Emblem, a Sterak's Gage, and a Gangplank."
  },
  "quickstriker-crown": {
    "description_en_us": "Gain a Quickstriker Emblem, a Guinsoo's Rageblade, and a Nocturne."
  },
  "rebel-crown": {
    "description_en_us": "Gain a Rebel Emblem, a Jeweled Gauntlet, and an Akali."
  },
  "scrap-crown": {
    "description_en_us": "Gain a Scrap Emblem, a Ziggs, and 2 random components."
  },
  "sentinel-crown": {
    "description_en_us": "Gain a Sentinel Emblem, a Crownguard, and a Loris."
  },
  "sniper-crown": {
    "description_en_us": "Gain a Sniper Emblem, an Infinity Edge, and a Zeri."
  },
  "sorcerer-crown": {
    "description_en_us": "Gain a Sorcerer Emblem, an Adaptive Helm, and a Vladimir."
  },
  "visionary-crown": {
    "description_en_us": "Gain a Visionary Emblem, a Spear of Shojin, and a Renata Glasc."
  },
  "watcher-crown": {
    "description_en_us": "Gain a Watcher Emblem, a Steadfast Heart, and a Scar."
  },
  "final-polish": {
    "description_en_us": "Gain a Support Anvil and a completed item anvil."
  },
  "one-buff-two-buff": {
    "description_en_us": "Gain a Red Buff, a Blue Buff, and a Champion Duplicator."
  }
};
const BATCH2_NOTES = {
  "academic-research": {
    "description_en_us": "Whenever you build an item, gain a completed item anvil instead. That anvil always offers an Academy item and the item built. Gain 1 random components. Gain a Lux and an Ezreal."
  },
  "loot-explosion": {
    "description_en_us": "Ambusher kills have a chance to drop loot, scaling with Critical Strike Chance. The value of the loot given can also critically strike, granting even more loot. Gain a Camille and a Powder."
  },
  "rocket-collection": {
    "description_en_us": "Artillerist rockets deal 15% increased damage. Every 75 rockets your Artillerists fire, gain a Collector (max 2). Gain a Tristana and Urgot. (Rockets Fired: 〔对局动态值〕)"
  },
  "rocket-collection-plus": {
    "description_en_us": "Artillerist rockets deal 15% increased damage. Every 65 rockets your Artillerists fire, gain a Collector (max 2). Gain a Tristana and Urgot. (Rockets Fired: 〔对局动态值〕)"
  },
  "fractured-crystals": {
    "description_en_us": "When an Automata champion fires their blast, they fire a second blast at the closest enemy dealing 70% of the original damage. Gain an Amumu and Nocturne."
  },
  "heavy-hitters": {
    "description_en_us": "Every 4 seconds, Bruisers deal 7% bonus max Health bonus physical damage on their next attack. Gain a Steb and a Trundle."
  },
  "forbidden-magic": {
    "description_en_us": "Every 3 takedowns by Black Rose champions or Sion grant Sion permanent 1.5% Attack Damage and 10 Max Health. Gain 3 Black Rose champions. (Stacks: 〔对局动态值〕)"
  },
  "crimson-pact": {
    "description_en_us": "Everytime you choose to save your Shimmer on a Black Market, heal 4 player health and gain 6 gold. Gain a Renni."
  },
  "noxian-guillotine": {
    "description_en_us": "Conquerors execute enemies below 12% Health. When they do, they gain 5 Armor and Magic Resist for the rest of combat. Gain a Darius and Draven."
  },
  "dominate": {
    "description_en_us": "Dominators gain 10% Attack Speed while shielded. When a Dominator gets a kill, all Dominators gain 100 Shield for 3 seconds. Gain a Cassiopeia."
  },
  "enforce": {
    "description_en_us": "Enforcer champions gain 10% Attack Damage. Every 6 Wanted enemy deaths grant 6 gold. Gain a Steb and Maddie."
  },
  "natural-selection": {
    "description_en_us": "Experiments gain 12% Health and grant a special hex. The Experiment in the hex is killed on combat start, granting their Experiment bonus to other laboratory hexes. Gain 3 Experiment champions."
  },
  "welcome-to-the-playground": {
    "description_en_us": "If at least 2 Family members are alive after 17 seconds in combat or at the end of combat, gain a random copy of a Vander, Powder, or Violet. Gain a Powder and Violet."
  },
  "aerial-warfare": {
    "description_en_us": "Firelight champions gain 9% Attack Damage and 9 Ability Power when they start a Firelight dash. They gain another 3% for every hex traveled that combat. Gain a Scar and Zeri."
  },
  "why-not-both": {
    "description_en_us": "While you field 2 of the same Form Swapper in different forms, both gain 24 Ability Power, Armor, and Magic Resist, and 24% Attack Damage. When you 3-star a Form Swapper, gain a 2-star copy. Gain a Swain and Gangplank."
  },
  "pit-fighter-prizefighter": {
    "description_en_us": "Pit Fighters permanently gain 1.5% Attack Damage if they lost the last combat. If they won, gain 45 Health instead. Gain an Urgot."
  },
  "quickstriker-boost": {
    "description_en_us": "Combat start and every 6 seconds, all Quickstrikers attack 85% faster for 2.5 seconds. Gain a Nocturne and Akali."
  },
  "rebel-resurgence": {
    "description_en_us": "When the first 5 Rebels die each combat, summon a copy of themselves that is one-star lower with 400 less Health. Gain an Akali and an Irelia."
  },
  "scrap-recycling": {
    "description_en_us": "Every 6 components Scrap champions convert, gain a random component (max 5). Gain a Powder and a Trundle.\n\nConverted: 〔对局动态值〕/6"
  },
  "sentinel-slam": {
    "description_en_us": "Sentinels gain 5% bonus Armor and Magic Resist. Every 4 seconds, their next attack deals 75% of their total resistances as magic damage. Gain a Loris."
  },
  "snipers-nest": {
    "description_en_us": "Snipers gain +8% Damage Amp for each round fought from the same starting hex (Maximum +32%). Gain a Zeri."
  },
  "sorcerer-explosion": {
    "description_en_us": "When Sorcerers die, they deal 300% of their Ability Power as magic damage to all adjacent units. Gain a Vladimir and Lux."
  },
  "visionary-voidlings": {
    "description_en_us": "For every 275 Mana Visionaries spend during combat, summon a Voidling, up to 5 Voidlings. Gain a Rell and Morgana.\n\nThe Voidling has 400-600 Health based on Stage."
  },
  "watcher-growth": {
    "description_en_us": "Every time Watchers are attacked, they gain 2% Attack Damage. Every time Watchers are hit by an ability, they gain 4 Ability Power. Gain a Vander."
  },
  "betrayal": {
    "description_en_us": "Maddie always targets Ambessa's target with her Ability and attacks. Every round where either gets at least 2 kills, gain a Maddie.\n\nGain a Maddie and Ambessa."
  },
  "blood-brothers": {
    "description_en_us": "Vander gains 30 permanent max Health each time Silco casts. Silco gains 6 permanent Ability Power each time Vander dies.\n\nGain a 2-star Vander, a Silco, and a Spear of Shojin."
  }
};
const BATCH3_NOTES = {
  "dummify": {
    "description_en_us": "Lose all champions on your board and bench. Gain a Training Dummy with 100% of their combined health. The dummy gains 250 Health per stage."
  },
  "golemify": {
    "description_en_us": "Lose all champions on your board and bench. Gain a Golem with 90% of their combined Health and 60% of their combined Attack Damage. The Golem gains 150 Health per stage."
  },
  "spoils-of-war-i": {
    "description_en_us": "Enemies have a 25% chance to drop loot when killed."
  },
  "spoils-of-war-ii": {
    "description_en_us": "Enemies have a 30% chance to drop loot when killed."
  },
  "spoils-of-war-iii": {
    "description_en_us": "Enemies have a 40% chance to drop loot when killed."
  },
  "field-medic": {
    "description_en_us": "Gain a Steb. Your strongest Steb's Ability's Mana cost is reduced by 10, but no longer heals. Steb's spell grants 30% Omnivamp and strikes 3 times, each dealing 65%."
  },
  "blade-dance": {
    "description_en_us": "Gain an Irelia. Your strongest Irelia gains 40% Attack Speed and gains a brand new Ability that dashes her between two targets, dealing physical damage to both."
  },
  "shocking-troll": {
    "description_en_us": "Gain a Trundle. Your strongest Trundle's Ability no longer heals, but grants him 140% Attack Speed for 5 seconds, and permanently grants him 1.5% Attack Damage. His maximum mana is reduced by 50."
  },
  "savage-revenge": {
    "description_en_us": "Gain 2 Rennis. Your strongest Renni's Ability costs 10 less and causes her to lunge towards the farthest enemy within 2 hexes, dealing 110% damage to the target and reduced damage to enemies in her path."
  },
  "all-out": {
    "description_en_us": "Gain a Vander. Your strongest Vander gains a brand new Ability that no longer grants resistances, but deals 85% increased damage and punches the target backwards, dealing 25% of the original damage to all enemies hit."
  },
  "blood-pact": {
    "description_en_us": "Gain a Vladimir. Your strongest Vladimir gains +3 Range and gains 3 bonus Mana each attack. His Ability no longer heals but grants 10% Damage Amp, deals 80% bonus damage, and spreads additional damage to the nearest enemy."
  },
  "tower-defense": {
    "description_en_us": "Gain a Training Dummy equipped with a random emblem that fires ranged attacks at enemies. It upgrades as the game goes on."
  },
  "the-golden-egg": {
    "description_en_us": "Gain a golden egg that hatches in 11 turns for a huge amount of loot. Winning player combat speeds up the hatch timer by an extra turn."
  },
  "an-exalted-adventure": {
    "description_en_us": "Gain three 2-cost champions. If you 3-star two of them, gain an orb filled with loot. Gain a Lesser Champion Duplicator now and at the start of every stage.\n\nChampions: 〔对局动态值〕, 〔对局动态值〕, 〔对局动态值〕"
  },
  "support-mining": {
    "description_en_us": "Gain a Training Dummy. When it dies 7 times, gain a random Support Item and remove the Training Dummy."
  },
  "support-mining-plus": {
    "description_en_us": "Gain a Training Dummy. When it dies 4 times, gain a random Support Item and remove the Training Dummy."
  },
  "scapegoat": {
    "description_en_us": "Gain a Training Dummy and 4 gold. If it is the first to die each player combat, gain 1 gold."
  },
  "wandering-trainer-i": {
    "description_en_us": "Gain 1 gold and a Training Dummy with 2 permanently attached Emblems."
  },
  "wandering-trainer-ii": {
    "description_en_us": "Gain 6 gold and a Training Dummy with 3 permanently attached Emblems."
  },
  "gold-for-dummies": {
    "description_en_us": "Gain a Training Dummy. Every 10 seconds, all Training Dummies grant 1 gold."
  },
  "bad-luck-protection": {
    "description_en_us": "Your team can no longer critically strike. Convert each 1% Critical Strike Chance into 1% Attack Damage. Gain a Sparring Gloves."
  },
  "blazing-soul-i": {
    "description_en_us": "Combat start: Your highest Attack Speed champion gains 20 Ability Power and 20% Attack Speed. Repeat on another ally every 3 seconds."
  },
  "blazing-soul-ii": {
    "description_en_us": "Combat start: Your highest Attack Speed champion gains 35 Ability Power and 30% Attack Speed. Repeat on another ally every 3 seconds."
  },
  "noble-sacrifice": {
    "description_en_us": "When your first ally dies each combat, grant your team 25 + 10% of that ally's Armor and Magic Resistance."
  },
  "wealthy-rehab-i": {
    "description_en_us": "Your team gains 10% Omnivamp.  Get a bonus of 8 gold when your team first accumulates 10000 total champion healing.\n\nTotal Healing: 〔对局动态值〕"
  },
  "wealthy-rehab-ii": {
    "description_en_us": "Your team gains 15% Omnivamp.  Get a bonus of 15 gold when your team first accumulates 10000 total champion healing.\n\nTotal Healing: 〔对局动态值〕"
  },
  "corrosion": {
    "description_en_us": "Enemy champions in the first two rows lose 3 Armor and Magic Resist every 2 seconds."
  },
  "building-a-collection-iii": {
    "description_en_us": "Gain a random item component at the start of the next 6 rounds (including this round)."
  },
  "worth-the-wait": {
    "description_en_us": "Gain a random two-star 1-cost champion. After 2 rounds, gain another copy of them at the start of each round for the rest of the game.\n\nChampion: 〔对局动态值〕"
  },
  "worth-the-wait-ii": {
    "description_en_us": "Gain a random 2-cost champion. Gain another copy of them at the start of each round for the rest of the game.\n\nChampion: 〔对局动态值〕"
  },
  "flexible": {
    "description_en_us": "Gain 1 random emblem. At the start of every Stage, gain a random emblem. Your team gains 40 Health for each emblem they are holding."
  },
  "rolling-for-days-i": {
    "description_en_us": "Gain 11 free Shop rerolls."
  },
  "superstars-i": {
    "description_en_us": "Your team deals 5% more damage, increased by 2% for every 3-star champion on your team. Gain 2 rerolls.\n\nBonus: 〔对局动态值〕%"
  },
  "superstars-ii": {
    "description_en_us": "Your team deals 7% more damage, increased by 5% for every 3-star champion on your team. Gain 4 rerolls.\n\nBonus: 〔对局动态值〕%"
  },
  "trade-sector": {
    "description_en_us": "Gain a free Shop reroll every round. Gain 1 gold."
  },
  "eye-for-an-eye-plus": {
    "description_en_us": "Gain a random component. For every 13 ally champions that die, gain another component (max 3).\n\nDeaths Remaining: 〔对局动态值〕"
  },
  "prizefighter": {
    "description_en_us": "Gain 2 item components. Every 5 wins gives you an item component."
  },
  "shimmerscale-essence": {
    "description_en_us": "Gain a Mogul's Mail. In 5 rounds, gain a Gamblers Blade.\n\nThese items give gold as well as combat power."
  },
  "eye-for-an-eye": {
    "description_en_us": "For every 15 ally champions that die, gain a random component (max 4).\n\nDeaths Remaining: 〔对局动态值〕"
  },
  "team-building": {
    "description_en_us": "Gain a Lesser Champion Duplicator. Gain another after 7 player combats.\n\nThis item allows you to copy a 3-cost or less champion."
  },
  "latent-forge": {
    "description_en_us": "After 8 player combats, gain an Artifact anvil. \n\nThe anvil offers 4 choices. Artifacts are more powerful items with a unique effect."
  },
  "phreaky-friday": {
    "description_en_us": "Gain an Infinity Force. After 5 player combats, gain another.\n\nInfinity Force: Artifact that offers tons of offensive and defensive stats"
  },
  "phreaky-friday-plus": {
    "description_en_us": "Gain an Infinity Force. After 3 player combats, gain another.\n\nInfinity Force: Artifact that offers tons of offensive and defensive stats"
  },
  "dark-alley-dealings": {
    "description_en_us": "Gain a Suspicious Trenchcoat. After 3 player combats, gain a Trickster's Glass."
  },
  "living-forge": {
    "description_en_us": "Gain an Artifact anvil now and after every 9 player combats.\n\nArtifacts are more powerful items with a unique effect."
  },
  "what-doesnt-kill-you": {
    "description_en_us": "Gain 2 gold after losing a player combat. Gain a random component after every 4 losses.\n\nLosses until next component: 〔对局动态值〕"
  },
  "warpath": {
    "description_en_us": "After dealing 60 player damage, gain a chest of high cost champions and items.\n(Current: 〔对局动态值〕)"
  },
  "magic-roll": {
    "description_en_us": "Roll 3 dice. Gain rewards based on their total.\n\nReward: 〔对局动态值〕"
  },
  "call-to-chaos": {
    "description_en_us": "Gain a powerful and random reward.\n\nReward: 〔对局动态值〕"
  }
};
const BATCH3_XP_NOTES = {
  "patient-study": {
    "description_en_us": "After player combat, gain 2 XP if you won or 3 XP if you lost."
  },
  "epoch": {
    "description_en_us": "Now, and at the start of every stage, gain 6 XP and 2 free rerolls."
  },
  "epoch-plus": {
    "description_en_us": "Now, and at the start of every stage, gain 8 XP and 3 free rerolls."
  },
  "level-up": {
    "description_en_us": "When you buy XP, gain an additional 2. Gain 12 immediately."
  },
  "shopping-spree": {
    "description_en_us": "When you level up, gain a number of free shop refreshes equal to your level. Gain 4 gold. "
  },
  "upward-mobility": {
    "description_en_us": "Buying XP costs 1 less. Gain 2 Health and 3 free rerolls whenever you level up."
  },
  "kingslayer": {
    "description_en_us": "After winning player combat, gain 1 gold. If they had more health than you, gain 4 Gold instead. Gain 1 gold now."
  },
  "risky-moves": {
    "description_en_us": "Your Tactician loses 20 Health, but after 7 player combats, gain 30 gold."
  }
};
function restoreBatch<T extends Record<string, { source: object }>>(runtime: T, notes: Record<string, object>) {
  if (Object.keys(runtime).length !== Object.keys(notes).length) throw new Error('Augment archive identities differ');
  return Object.fromEntries(Object.entries(runtime).map(([id, row]) => {
    if (!Object.hasOwn(notes, id) || !Object.hasOwn(AUGMENT_POOL_TEXT, id)) throw new Error(`Missing augment archive: ${id}`);
    return [id, { ...row, ...AUGMENT_POOL_TEXT[id], source: { ...row.source, ...notes[id] } }];
  }));
}

export const RULES_GAP_MANIFEST = {
  ...runtimeManifest,
  augmentPoolBatch4B4xp:{...runtimeManifest.augmentPoolBatch4B4xp,content:Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4XP).map(([id,row])=>{const text=B4XP_ARCHIVE[id as keyof typeof B4XP_ARCHIVE];return [id,{...row,...text,source:{...row.source,...text.source}}];}))},
  augmentPoolBatch1: { ...runtimeManifest.augmentPoolBatch1, content: restoreBatch(AUGMENT_BATCH1, BATCH1_NOTES) },
  augmentPoolBatch2: { ...runtimeManifest.augmentPoolBatch2, content: restoreBatch(AUGMENT_BATCH2, BATCH2_NOTES) },
  augmentPoolBatch4B4reroll: { ...runtimeManifest.augmentPoolBatch4B4reroll, content: B4REROLL_ARCHIVE },
  augmentPoolBatch3Xp: { ...runtimeManifest.augmentPoolBatch3Xp, content: restoreBatch(AUGMENT_BATCH3_XP, BATCH3_XP_NOTES) },
  augmentPoolBatch3: { ...runtimeManifest.augmentPoolBatch3, content: restoreBatch(AUGMENT_BATCH3, BATCH3_NOTES) },
};
export const ARCHIVED_AUGMENT_DEFINITIONS = Object.fromEntries(Object.entries(AUGMENT_DEFINITIONS).map(([id, row]) =>
  [id, Object.hasOwn(B4XP_ARCHIVE,id) ? {...row,name:B4XP_ARCHIVE[id as keyof typeof B4XP_ARCHIVE].name,description:B4XP_ARCHIVE[id as keyof typeof B4XP_ARCHIVE].description} : Object.hasOwn(B4REROLL_ARCHIVE,id) ? {...row,name:B4REROLL_ARCHIVE[id].name,description:B4REROLL_ARCHIVE[id].description} : Object.hasOwn(AUGMENT_POOL_TEXT, id) ? { ...row, ...AUGMENT_POOL_TEXT[id] } : row]));
