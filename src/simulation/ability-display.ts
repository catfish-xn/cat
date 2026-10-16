import { S13_ABILITY_DATA } from './content/abilities';
import { ABILITY_DISPLAY_SOURCE } from './ability-display-source';
import { getUnitStats } from './unit-stats';
import type { StarLevel } from './unit-types';

export interface AbilityDisplayStats {
  readonly abilityPower?: number;
  readonly attackDamage?: number;
}
function sourceFor(id: string) {
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
  const source = sourceFor(definitionId), base = getUnitStats(definitionId, starLevel);
  const ad = stats.attackDamage ?? base.attack, ap = stats.abilityPower ?? 100;
  if (![ad, ap].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000))
    throw new RangeError('Display AD/AP must be integers in [0, 1000000]');
  const values: Record<string, number> = Object.fromEntries(Object.entries(source.variables).map(([k, v]) => [k, v[starLevel - 1]]));
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
