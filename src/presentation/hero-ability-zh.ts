/**
 * zh_cn client name and tooltip of the hero spells that replace an ability (archived 14.24 stringtable
 * `tft13_primespellhero_dsc` / `generatedtip_spelltft_tft13_primespellhero_displayname`; markup removed, same @tokens@).
 * Keyed by the ordinary ability id the hero spell replaces.
 */
export const HERO_ABILITY_ZH: Readonly<Record<string, { readonly name: string; readonly text: string }>> = Object.freeze({
  'vander-ability': { name: '卯足全力', text: '对目标出拳，使其向后飞去。造成@HEROModifiedDamage@ (%i:scaleAD%)物理伤害，己方队伍中每有一名1或2费弈子，这个伤害值就会提升@HEROModifiedBonusDamage@ (%i:scaleAD%)物理伤害。所有被初始目标命中的敌人都会受到@HEROSplashPerc*100@%原伤害。' },
});
