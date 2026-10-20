// Offline archive/provenance columns; never imported by runtime modules.
import { freezeContent } from './freeze';
import { restoreArchiveColumns } from './archive-source';
import { G23_TRAIT_SOURCE as runtime } from './g2-3-trait-runtime';
export const G23_TRAIT_SOURCE_NOTES = freezeContent({
  "automata": {
    "apiName": "TFT13_Hextech",
    "description": "Automata gain a crystal when they deal damage. At @TriggerNumCrystals@&nbsp;crystals, they blast their current target, dealing magic damage + <magicDamage>@ConversionDamagePct*100@%</magicDamage> of damage dealt since the previous blast and reset. They also gain Armor and Magic&nbsp;Resist.<br><br><expandRow>(@MinUnits@) <magicDamage>@MagicDamage@</magicDamage> damage, @Resists@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>"
  },
  "sorcerer": {
    "apiName": "TFT13_Sorcerer",
    "description": "Your team gains @TeamAP@ Ability Power. Sorcerers gain more.<br><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%, Abilities reduce their target's damage by @DamageDecrease*100@% for @DamageDecreaseDuration@&nbsp;seconds</row>"
  },
  "scrap": {
    "apiName": "TFT13_Scrap",
    "description": "Combat start: Components held by Scrap units temporarily turn into full items. Scrap units gain Shield for @ShieldDuration@ seconds for each component held by your team, including those that make up a full item.<br><br><row>(@MinUnits@) @NumComponents@ component, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) @NumComponents@ components, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) All components, and full items become lucky! @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) Generate Radiant items! @HPShieldAmount@ Shield</row><br><br><rules>Shield Amount:&nbsp;@TFTUnitProperty.:TFT13_Trait_Scrap_ShieldTotal@ </rules> <br>"
  },
  "artillerist": {
    "apiName": "TFT13_Martialist",
    "description": "Every @NumOfAttacks@ attacks, Artillerists launch a rocket that deals @PercentDamage*100@% Attack Damage around the target. They also gain Attack Damage.<br><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%, Launch a rocket every @NumOfAttacks@ attacks that deals double&nbsp;damage.</row>"
  },
  "form-swapper": {
    "apiName": "TFT13_FormSwapper",
    "description": "Innate: Form Swappers change their stats and ability based on if they're placed in the front 2 rows or back 2&nbsp;rows.<br><br>Frontline Form Swappers gain Durability. Backline Form Swappers gain Damage&nbsp;Amp.<br><br><expandRow>(@MinUnits@) @DR*100@%&nbsp;%i:scaleDR% or @DA*100@%&nbsp;%i:scaleDA%</expandRow>"
  },
  "emissary": {
    "apiName": "TFT13_Ambassador",
    "description": "This trait is active only when you have exactly 1 or 4 unique Emissaries. <br><br><row>(@MinUnits@) Gain that Emissary's bonus</row><br><row>(@MinUnits@) Gain all bonuses. Emissaries gain @BonusHealth@&nbsp;%i:scaleHealth% and @SelfishDamageAmp*100@%&nbsp;%i:scaleDA%</row><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveDomina alternate=TFTGuildInactive>Ambessa: Allies gain @AmbessaArmor@ Armor and Magic Resist for each opponent defeated. (@TFTUnitProperty.trait:TFT13_Ambassador_PlayersDefeated@/7)</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveJarvan alternate=TFTGuildInactive>Garen: On Combat Start, Garen and allies to his left and right gain @GarenHealthPercent*100@% of his max Health.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveNami alternate=TFTGuildInactive>Nami: Allies' attacks grant @NamiMana@ bonus Mana.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveTristana alternate=TFTGuildInactive>Tristana: Allies gain @StarAS*100@% Attack Speed per star level.</TFTGuildActive>"
  },
  "sentinel": {
    "apiName": "TFT13_Titan",
    "description": "Your team gains Armor and Magic Resist. Sentinels gain triple.<br><br><expandRow>(@MinUnits@) @BonusArmor@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>"
  },
  "family": {
    "apiName": "TFT13_Family",
    "description": "Family members support each other, reducing their max Mana and gaining extra bonuses.<br><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @DamageReduction*100@%&nbsp;%i:scaleDR%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @AttackSpeed*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, heist on topside! After combat, progress the heist, increased for each surviving Family&nbsp;member!</row><br><br><rules>@TFTUnitProperty.trait:TFT13_JunkerKing_SelfDestructTRA@</rules>"
  },
  "ambusher": {
    "apiName": "TFT13_Ambusher",
    "description": "Damage from Ambushers' Abilities can critically strike. They also gain bonus Critical Strike Chance and Critical Strike Damage.<br><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%; also gain @DamageReductionPct*100@% Durability</row>"
  },
  "visionary": {
    "apiName": "TFT13_Invoker",
    "description": "Whenever Visionaries gain Mana, they gain more.<br><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%, Abilities heal an ally for @AllyHealing*100@% of damage dealt</row><br>"
  },
  "sniper": {
    "apiName": "TFT13_Sniper",
    "description": "Snipers deal more damage to targets farther away.<br><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex and +@BonusHexRangeIncrease@ Attack Range</row>"
  },
  "conqueror": {
    "apiName": "TFT13_Warband",
    "description": "Conquerors' takedowns grant stacks of Conquest. After gaining enough Conquest, open War Chests full of loot!<br><br>Conquerors gain Attack Damage and Ability Power, increased by @PercentIncreasePerChest*100@% for each War Chest opened.<br><br><expandRow>(@MinUnits@) @ADAPBase*100@%&nbsp;%i:scaleAD%%i:scaleAP%; @StacksPerKill@x&nbsp;Conquest</expandRow><br><br><rules>War Chests Opened: @TFTUnitProperty.trait:TFT13_Warband_ChestsCompleted@</rules><br><rules>Current Stats: @TFTUnitProperty.trait:TFT13_Warband_CurrentADAP@%&nbsp;%i:scaleAD%%i:scaleAP%</rules><br>"
  },
  "high-roller": {
    "apiName": "TFT13_HighRoller",
    "description": "When casting, Sevika rolls a random Jinx modification to her Ability and gains @Durability*100@% Durability for @Duration@ seconds.<br><br>Mods:<br>-Rocket: Launch @Bonus1NumRockets@ rockets that deal @Bonus1RocketDamage@ physical damage each<br>-Shield: Gain @Bonus2ShieldAmount@ Shield for @Bonus2ShieldDuration@ seconds<br>-Coin: Gain @Bonus4Gold@ gold<br>-Triple: Enhance her rolled ability!"
  },
  "academy": {
    "apiName": "TFT13_Academy",
    "description": "The Academy sponsors 3 items each game.<br><br>Copies of sponsored items grant bonus max Health and Damage Amp. Academy units holding sponsored items gain double the amount, plus an additional @BaseValues*100@% Health and Damage Amp.<br><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%</row>"
  },
  "chem-baron": {
    "apiName": "TFT13_Crime",
    "description": "Gain Shimmer after each player combat. If your loss streak is at least @MinStreakLength@, gain more.<br><br>At each stack of @ShimmerBreakpoint@ Shimmer, the Black Market offers you contraband that only Chem-Barons can use. Chem-Barons gain max Health for each Black Market you pass on.<br><br><expandRow>(@MinUnits@) @ShimmerPerCombat@ or @ShimmerPerCombatStreaking@; @HealthPerSkip@&nbsp;%i:scaleHealth%</expandRow><br><br><rules>Markets Skipped: @TFTUnitProperty.trait:TFT13_Crime_PassedMarkets@</rules><br><rules>Current Health: @TFTUnitProperty.trait:TFT13_Crime_CurrentHealth@&nbsp;%i:scaleHealth%</rules>"
  },
  "rebel": {
    "apiName": "TFT13_Rebel",
    "description": "Rebels gain @MaxHealthIncrease*100@% max Health.<br><br>After your team loses @PercentHealthTrigger*100@% of their Health, a smoke signal appears, granting Rebels @BurstAS*100@% Attack Speed for @BurstDuration@ seconds and extra power for the rest of&nbsp;combat.<br><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%, and Stun all enemies for @StunDuration@&nbsp;seconds</row><br><row>(@MinUnits@) The smoke signal triggers at Combat Start and every @ForceDuration@&nbsp;seconds.</row>"
  },
  "dominator": {
    "apiName": "TFT13_Infused",
    "description": "Combat start: Dominators gain a Shield for @ShieldDuration@ seconds.<br><br>When Dominators cast, they gain stacking Ability Power based on the Mana spent.<br><br><expandRow>(@MinUnits@) @ShieldAmount@ Shield, @APPercent*100@%&nbsp;%i:scaleAP%</expandRow>"
  },
  "pit-fighter": {
    "apiName": "TFT13_Pugilist",
    "description": "Pit Fighters gain @OmnivampPercent*100@% Omnivamp and deal bonus true damage. Once per combat at @HealthThreshold*100@% Health, they heal a percentage of their max Health over @Duration@ seconds.<br><br><expandRow>(@MinUnits@) @TrueDamagePercent*100@%&nbsp;true damage, @HealPercent*100@%&nbsp;%i:scaleHealth%</expandRow>"
  },
  "enforcer": {
    "apiName": "TFT13_Squad",
    "description": "Combat Start: Enforcers gain Shield and Damage Amp. The highest Health enemy units become <i>WANTED!</i> <br><br>When a Wanted enemy dies, Enforcers gain @AttackSpeedPerWantedKill*100@% Attack Speed.<br><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;unit; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) ALL enemies; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%, @BaseDA*100@%&nbsp;%i:scaleDA%; Combat Start: Confiscate all enemy&nbsp;items!</row>"
  },
  "firelight": {
    "apiName": "TFT13_Hoverboard",
    "description": "Every @Duration@ seconds, Firelights dash. While dashing, they attack with infinite range and heal a percentage of the damage taken since their last dash.<br><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken. While dashing, gain a massive burst of Attack Speed.</row>"
  },
  "experiment": {
    "apiName": "TFT13_Experiment",
    "description": "Gain Laboratory hexes on your board.<br><br>Combat start: Experiments standing on Laboratory hexes gain the Experiment bonuses of all Experiments on Laboratory hexes, plus max Health.<br><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) Experiment bonuses increase by @ExperimentBonusIncrease*100@%!</row>"
  },
  "bruiser": {
    "apiName": "TFT13_Bruiser",
    "description": "Your team gains @TeamFlatHealth@ max Health. Bruisers gain more.<br><br><expandRow>(@MinUnits@) @BonusPercentHealth*100@%&nbsp;%i:scaleHealth%</expandRow>"
  },
  "junker-king": {
    "apiName": "TFT13_JunkerKing",
    "description": "Every @NumRounds1Star@ rounds, open an armory to purchase permanent upgrades to your strongest Rumble's&nbsp;mech.<br><br><rules>Rounds Until Upgrade: @TFTUnitProperty.trait:TFT13_JunkerKing_RoundsUntilOpening@</rules>"
  },
  "black-rose": {
    "apiName": "TFT13_Cabal",
    "description": "<row>(@MinUnits@) Summon a chained Sion. He is freed after @NumCastsToUnlock@ casts from Black Rose units or when he drops below @PercentHealthUnlock*100@% health.</row><br><row>(@MinUnits@) Sion grows stronger and his enemies take more damage from Black Rose units.</row><br><row>(@MinUnits@) Sion unleashes dark magic and heals to full Health when freed.</row><br><row>(@MinUnits@) When Sion dies, he restores to life with power beyond death!</row><br><br><rules>Each Black Rose champion's star level increases Sion's power</rules>"
  },
  "quickstriker": {
    "apiName": "TFT13_Challenger",
    "description": "Quickstrikers move faster and gain Attack Speed, based on their target's missing Health.<br><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%. On target death, Quickstrikers dash to a new target and gain @ShieldAmount@ shield for @ShieldDuration@&nbsp;seconds. </row>"
  },
  "watcher": {
    "apiName": "TFT13_Watcher",
    "description": "Watchers gain Durability, increased while above @HealthBreakpoint*100@%&nbsp;Health.<br><br><expandRow>(@MinUnits@) @BaseDR*100@% or @IncreasedDR*100@%&nbsp;%i:scaleDR%</expandRow><br>"
  }
});
export const G23_TRAIT_SOURCE = restoreArchiveColumns(runtime, G23_TRAIT_SOURCE_NOTES);
