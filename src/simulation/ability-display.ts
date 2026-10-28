import { BATCH3_SUMMON_ABILITIES } from './content/batch3-summons';
import { B5_G4_SUMMON_ABILITIES } from './content/augment-pool-batch5-g4';
import { SIX_COST_ABILITIES } from './content/v19-six-cost';
import { S13_ANOMALY_SUMMON_ABILITIES } from './content/s13-anomaly-summons';
import { G24_VOIDSPAWN_ABILITIES } from './content/g2-4b-voidspawn';
import { G23_SUMMON_ABILITIES } from './content/g2-3-summons';
import { G23_ABILITIES } from './content/g2-3-abilities';
import { G23_UNITS } from './content/g2-3-units';
import { resolveUnitStats } from './unit-stats';
import { S13_ABILITY_DATA } from './content/abilities';
import { ABILITY_DISPLAY_SOURCE } from './ability-display-source';
import { getUnitStats } from './unit-stats';
import type { StarLevel } from './unit-types';
import { d14UnitBase } from './d14-anomalies/projection';

export interface AbilityDisplayStats {
  readonly abilityPower?: number;
  readonly attackDamage?: number;
}
function sourceFor(id: string): {readonly name:string;readonly variables:Readonly<Record<string,readonly number[]>>} {
  if(Object.hasOwn(B5_G4_SUMMON_ABILITIES,id+'-ability'))return B5_G4_SUMMON_ABILITIES[id+'-ability'];
  if(Object.hasOwn(SIX_COST_ABILITIES,id+'-ability'))return SIX_COST_ABILITIES[id+'-ability'];
  if(Object.hasOwn(S13_ANOMALY_SUMMON_ABILITIES,id+'-ability'))return S13_ANOMALY_SUMMON_ABILITIES[id+'-ability'];
  if(Object.hasOwn(G24_VOIDSPAWN_ABILITIES,id+'-ability'))return G24_VOIDSPAWN_ABILITIES[id+'-ability'];
  if(Object.hasOwn(G23_SUMMON_ABILITIES,id+'-ability'))return G23_SUMMON_ABILITIES[id+'-ability'];
  if(Object.hasOwn(BATCH3_SUMMON_ABILITIES,id+'-ability'))return BATCH3_SUMMON_ABILITIES[id+'-ability'];
  if(Object.hasOwn(G23_ABILITIES,id+'-ability'))return G23_ABILITIES[id+'-ability'];
  if (!Object.hasOwn(ABILITY_DISPLAY_SOURCE, id)) throw new RangeError(`Unknown ability display definition: ${id}`);
  return ABILITY_DISPLAY_SOURCE[id as keyof typeof ABILITY_DISPLAY_SOURCE];
}
/** CDragon name; no translation is inferred from champion identity. */
export function abilityDisplayName(definitionId: string): string { return sourceFor(definitionId).name; }
/** Values are per source placeholder (e.g. Maddie's TotalDamage is per bullet).
 * Defaults: base star-scaled AD, 100 AP, no items/traits or persistent growth.
 * Experiment-only values describe the archived tooltip, not an enabled mechanic.
 */
export function abilityDisplayValues(definitionId: string, starLevel: StarLevel,
  stats: AbilityDisplayStats = {}): Readonly<Record<string, number>> {
  return displayValues(definitionId, starLevel, stats);
}
/** Ultimate Hero's effective rank 4 only. Caller reads the authenticated promoted
 * marker; this query neither grants promotion nor changes physical ownership.
 * Rejects non-one-cost heroes. Uses raw rank 4 plus the 14.24b Singed override.
 */
export function ultimateHeroAbilityDisplayValues(definitionId: string,
  stats: AbilityDisplayStats = {}): Readonly<Record<string, number>> {
  return displayValues(definitionId, 3, stats, true);
}
function displayValues(definitionId: string, starLevel: StarLevel,
  stats: AbilityDisplayStats, promoted = false): Readonly<Record<string, number>> {
  const source = sourceFor(definitionId);
  const projection = promoted ? d14UnitBase({ definitionId, starLevel }, true) : undefined;
  const base = projection?.base ?? (definitionId.endsWith('-ranged')&&Object.hasOwn(G23_UNITS,definitionId)?resolveUnitStats(G23_UNITS[definitionId],starLevel):getUnitStats(definitionId, starLevel));
  const ad = stats.attackDamage ?? base.attack, ap = stats.abilityPower ?? 100;
  if (![ad, ap].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000))
    throw new RangeError('Display AD/AP must be integers in [0, 1000000]');
  const values: Record<string, number> = projection?.ability.kind === 's13'
    ? Object.fromEntries(Object.entries(projection.ability.variables).map(([key, value]) => [key, value / 10000]))
    : Object.fromEntries(Object.entries(source.variables).map(([k, v]) => [k, v[starLevel - 1]]));
  const v = (key: string): number => {
    if (!Object.hasOwn(values, key)) throw new RangeError(`Missing display source variable: ${definitionId}/${key}`);
    return values[key];
  };
  // Same coefficient quantization and final floor as combat amount(), with no mitigation/crit.
  const amount = (adKey?: string, apKey?: string, flatKey?: string, hpKey?: string, multiplier = 1) =>
    Math.floor(((adKey ? ad * Math.round(v(adKey) * multiplier * 10000) : 0)
      + (apKey ? ap * Math.round(v(apKey) * multiplier * 100) : 0)
      + (hpKey ? base.health * Math.round(v(hpKey) * multiplier * 10000) : 0)) / 10000
      + (flatKey ? v(flatKey) * multiplier : 0));
  const magic = (key: string) => amount(undefined, key);
  const physical = (key: string, apKey?: string) => amount(key, apKey);
  // Explicit aliases avoid treating every Modified* token as an AP multiplier.
  switch (definitionId) {
    case 'renata':Object.assign(values,{ModifiedShield:magic('Shield'),ModifiedTargetDamage:magic('TargetDamage'),ModifiedExplosionDamage:magic('ExplosionDamage')});break;
    case 'silco':Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedMinionDamage:magic('MinionDamage')});break;
    case 'drmundo':Object.assign(values,{ModifiedHeal:amount(undefined,'APHeal',undefined,'PercentHealthHeal'),ModifiedDamage:magic('APDamage'),ModifiedSecondaryDamage:amount(undefined,undefined,undefined,'PercentHealthDamage'),'TFTUnitProperty.:TFT13_DrMundoBaseHealthExperimentBonus':v('BaseExperimentHealthGain'),'TFTUnitProperty.:TFT13_DrMundoCurrentExperimentBonus':v('ExperimentHealthGain')});break;
    case 'cassiopeia':Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedMiasmaDamage:magic('MiasmaDamage')});break;
    case 'elise':Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedHeal:magic('FlatHealth')});break;
    case 'elise-ranged':case 'swain-ranged':Object.assign(values,{ModifiedDamage:magic('MagicDamage'),ModifiedSecondaryDamage:magic('SecondaryDamage')});break;
    case 'jayce':Object.assign(values,{ModifiedShield:magic('Shield'),ModifiedDamage:physical('PercentAttackDamage'),ModifiedSecondaryDamage:physical('PercentADSecondaryDamage')});break;
    case 'jayce-ranged':Object.assign(values,{ModifiedAttackSpeed:v('AttackSpeed')*ap,ModifiedTargetDamage:physical('ClosestEnemyPercentAD'),ModifiedDamage:physical('PercentAttackDamage')});break;
    case 'smeech':values.TotalDamage=physical('PercentAttackDamage','APDamage');break;
    case 'renni':Object.assign(values,{ModifiedHealing:amount(undefined,'APHeal',undefined,'MaxHealthHealingPercent'),ModifiedDamage:physical('ADPercent'),FinalDamage:physical('FinalADPercent')});break;
    case 'nunu':Object.assign(values,{ModifiedDurability:Math.min(100,v('Durability')*ap),ModifiedDamage:magic('Damage'),ModifiedSecondDamage:magic('SecondDamage'),'TFTUnitProperty.:TFT13_NunuCurrentExperimentBonus':v('ExperimentMaxHealthDamage')*100});break;
    case 'gangplank':Object.assign(values,{ModifiedHeal:magic('Heal'),ModifiedDamage:physical('PercentAttackDamage')});break;
    case 'gangplank-ranged':Object.assign(values,{TotalDamage:physical('PercentAttackDamage','APDamage'),SecondaryDamage:Math.floor(physical('PercentAttackDamage','APDamage')*v('PercentToAdjacentUnits'))});break;
    case 'swain':Object.assign(values,{ModifiedHeal:magic('Heal'),ModifiedHealPerSecond:magic('HealPerSecond'),ModifiedDamage:magic('DamagePerSecond')});break;
    case 'camille': values.TotalDamage = physical('PercentAttackDamage','APDamage'); break;
    case 'vi': Object.assign(values,{ModifiedShield:magic('Shield'),ModifiedDamage:physical('PercentAttackDamage'),ModifiedSecondaryDamage:physical('PercentAttackDamage_SecondaryDamage')}); break;
    case 'akali': case 'vex': Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedSecondaryDamage:magic('SecondaryDamage')}); break;
    case 'sett': case 'heimerdinger': case 'morgana': case 'amumu': case 'powder': case 'rumble': values.ModifiedDamage=magic('Damage');break;
    case 'draven': values.TotalDamage=amount('PercentAD',undefined,'BaseDamage');break;
    case 'trundle': Object.assign(values,{ModifiedHeal:magic('GainHealth'),ModifiedDamage:physical('PercentAttackDamage')});break;
    case 'ziggs': Object.assign(values,{ModifiedInitialDamage:magic('Damage'),ModifiedSecondaryDamage:magic('MinibombDamage')});break;
    case 'steb': case 'vladimir': Object.assign(values,{ModifiedHeal:magic('Heal'),ModifiedDamage:magic('Damage')});break;
    case 'jinx': Object.assign(values,{ZapModifiedDamage:physical('ZapPercentAD'),FlameChompersModifiedDamage:physical('FlameChompersPercentAD'),DeathRocketModifiedDamage:physical('DeathRocketPercentAD','DeathRocketAP')});break;
    case 'ambessa': Object.assign(values,{ModifiedChainDamage:physical('PercentChainAttackAD'),ModifiedStrikeDamage:physical('PercentStrikeAD'),ModifiedSlamDamage:physical('SlamDamageAD'),ModifiedOmnivamp:v('PercentOmnivamp')*ap});break;
    case 'twistedfate': Object.assign(values,{ModifiedHeal:magic('BlueHeal'),ModifiedRedDamage:magic('RedDamage'),ModifiedYellowDamage:magic('YellowDamage')});break;
    case 'mordekaiser': Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedTargetDamage:magic('TargetDamage'),ModifiedSecondaryDamage:magic('SlamDamage')});break;
    case 'blitzcrank': Object.assign(values,{ModifiedDamage:magic('BaseDamage'),ModifiedShield:magic('Shield')});break;
    case 'ekko': Object.assign(values,{ModifiedDamage:magic('TargetDamage'),ModifiedSecondaryDamage:magic('SecondaryDamage')});break;
    case 'illaoi': Object.assign(values,{ModifiedHealthSteal:magic('HealthSteal'),ModifiedDamage:Math.floor((base.armor+base.magicResist)*v('DamageResistRatio'))});break;
    case 'leblanc': Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedAutoDamage:magic('AutoDamage')});break;
    case 'malzahar': Object.assign(values,{ModifiedDamage:magic('Damage'),ModifiedInfectionDamage:magic('InfectionDamage')});break;
    case 'nocturne': values.ModifiedDamage=amount('ADPercent',undefined,'BaseDamage');break;
    case 'singed': values.ModifiedDurability=Math.min(100,v('DR')*ap);break;
    case 'twitch': Object.assign(values,{TotalDamage:physical('PercentAttackDamage','APDamage'),'TFTUnitProperty.:TFT13_TwitchCurrentExperimentBonus':v('ExperimentMaxHealthDamage')*100});break;
    case 'violet': Object.assign(values,{ModifiedDamage:physical('PercentAttackDamage'),TotalDamage:physical('PercentIncreasedAttackDamage','APDamage')});break;
    case 'zeri': values.TotalDamage=physical('PercentAttackDamage','APDamage');values.SecondaryDamage=Math.floor(values.TotalDamage*v('PercentDealtToBouncedEnemies'));break;
    case 'irelia': Object.assign(values, { ModifiedShield: magic('ShieldHealth'), ModifiedBaseStrikeDamage: magic('StrikeBaseDamage') }); break;
    case 'maddie': case 'tristana': case 'caitlyn':
      values.TotalDamage = physical('PercentAttackDamage', 'APDamage');
      if (definitionId === 'tristana') Object.assign(values, {
        'TFTUnitProperty.:TFT13_TristanaASPerStack': v('ASKillGain'),
        'TFTUnitProperty.:TFT13_TristanaASGain': 0,
      });
      if (definitionId === 'caitlyn') values.HeadshotDamage = physical('HeadshotPercentAD');
      break;
    case 'darius': Object.assign(values, { ModifiedDamage: physical('PercentAttackDamage'), ModifiedHeal: magic('Heal'), ModifiedBleedDamage: physical('BleedPercentAttackDamage') }); break;
    case 'lux': case 'loris': Object.assign(values, { ModifiedShield: magic('Shield'), ModifiedDamage: magic('Damage') }); break;
    case 'zyra': Object.assign(values, { ModifiedTargetDamage: magic('TargetDamage'), ModifiedAOEDamage: magic('AOEDamage'), 'TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus': v('ExperimentTrueDamage') * 100 }); break;
    case 'urgot': Object.assign(values, {
      ModifiedPrimaryDamage: physical('PrimaryDamage', 'APDamage'), ModifiedSecondaryDamage: physical('SecondaryDamage', 'APDamage'),
      'TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield': v('ExperimentPercentHealthShield') * 100,
      'TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS': v('ExperimentAttackSpeed') * 100,
    }); break;
    case 'rell': Object.assign(values, { ModifiedShield: magic('Shield'), ModifiedDamage: magic('StabDamage') }); break;
    case 'leona': Object.assign(values, { ModifiedDurability: Math.min(100, v('DR') * ap), ModifiedDamage: magic('Damage') }); break;
    case 'vander': Object.assign(values, { ModifiedDefenses: magic('Resists'), ModifiedDamage: physical('PercentAttackDamage'), ModifiedBonusDamage: physical('BonusDamageADRatio') }); break;
    case 'kogmaw': values.ModifiedDamage = magic('DamageOnAttack'); break;
    case 'scar': Object.assign(values, { ModifiedDamage: magic('Damage'), ModifiedHeal: magic('Heal') }); break;
    case 'ezreal': Object.assign(values, { TotalDamage: physical('PercentAttackDamage', 'APDamage'), ModifiedDamage: physical('PercentCenterDamage') }); break;
    case 'nami': case 'zoe': values.ModifiedDamage = magic('Damage'); break;
    case 'corki': Object.assign(values, {
      ModifiedDamage: amount('PercentAD', undefined, 'FlatDamagePerMissile'),
      ModifiedSpecialDamage: amount('PercentAD', undefined, 'FlatDamagePerMissile', undefined, v('SpecialMissileMult')),
      SpecialMissileArmorReduction: v('FlatArmorShred') * v('SpecialMissileMult'),
    }); break;
    case 'garen': Object.assign(values, {
      ModifiedHeal: amount(undefined, undefined, undefined, 'HealPercentHealth'),
      ModifiedShield: amount(undefined, 'APShield', undefined, 'PercentHealthShield'),
      ModifiedDamage: physical('ADRatio'), ModifiedSecondaryDamage: physical('SecondaryADRatio'),
    }); break;
  }
  // Include expression keys so callers never need to perform numeric arithmetic.
  for (const [, expression] of S13_ABILITY_DATA[base.abilityId].description.matchAll(/@([^@]+)@/g)) {
    const [key, ...factors] = expression.split('*');
    if (Object.hasOwn(values, key) && factors.every(x => /^\d+(?:\.\d+)?$/.test(x)))
      values[expression] = factors.reduce((n, factor) => n * Number(factor), values[key]);
  }
  return Object.freeze(values);
}
