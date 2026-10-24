import { freezeContent } from './freeze';

/** Exact local s13-14.24b zh_cn stringtable entries; display data only.
 * Trait APIs use Teamup_, unlike the corresponding TeamupAugment_ augment APIs.
 * Keep official wording separate from v20 custom execution annotations.
 */
export const V20_OFFICIAL_TRAIT_TEXT = /* @__PURE__ */ freezeContent({
  mentorship: {
    apiName: 'TFT13_Teamup_Mentorship', locale: 'zh_cn',
    description: '当【安蓓萨】施放技能时，【凯特琳】对该目标进行一次强化攻击，造成@CaitAD*100@%伤害。【安蓓萨】获得【凯特琳】的@ADShare*100@%攻击力。',
  },
  reunion: {
    apiName: 'TFT13_Teamup_Reunion', locale: 'zh_cn',
    description: '当【蔚】施放技能时，【艾克】会朝她的目标释放3个残影，每个残影造成@EkkoAfterImageReducedDamage*100@%伤害。当【艾克】施放技能时，【蔚】会对他的目标打出一道地震波，造成@ViEarthquakeReducedDamage*100@%伤害。',
  },
  geniuses: {
    apiName: 'TFT13_Teamup_Geniuses', locale: 'zh_cn',
    description: '当【黑默丁格】施放技能时，【艾克】会释放@NumEkkoAfterImages@个残影，每个残影造成@ReducedEkkoDamage*100@%伤害。当【艾克】施放技能时，【黑默丁格】会发射@NumHeimerMissiles@枚导弹，每枚导弹造成@ReducedHeimerDamage*100@%伤害。 ',
  },
  menaces: {
    apiName: 'TFT13_Teamup_Menaces', locale: 'zh_cn',
    description: '【爆爆】获得【统领】但不再受益于【家人】。当她的猴子爆炸时，它会生成@NumMonstrosities@个【希尔科】的畸变体。',
  },
  'unlikely-duo': {
    apiName: 'TFT13_Teamup_UnlikelyDuo', locale: 'zh_cn',
    description: '【金克丝】和【塞薇卡】获得@AD*100@%攻击力和@Health@生命值。当其中一个施放技能时，会给另一个提供@Mana@法力值。【塞薇卡】的钢臂会更加幸运。',
  },
});

/** Archived tier variables for display; decimal float artifacts rounded to six places.
 * The unnamed Unlikely Duo hash is omitted: it is not a text token and does not
 * establish the custom luck formula. No rule evaluation occurs here.
 */
export const V20_TEAMUP_DISPLAY_SOURCE = /* @__PURE__ */ freezeContent({
  mentorship: { tiers: [{ threshold: 2, values: { ADShare: 0.25, CaitAD: 2.25 } }] },
  reunion: { tiers: [{ threshold: 2, values: { EkkoAfterImageReducedDamage: 0.5, ViEarthquakeReducedDamage: 1.5 } }] },
  geniuses: { tiers: [{ threshold: 2, values: { NumEkkoAfterImages: 3, NumHeimerMissiles: 3, ReducedEkkoDamage: 0.33, ReducedHeimerDamage: 1.2 } }] },
  menaces: { tiers: [{ threshold: 2, values: { NumMonstrosities: 3 } }] },
  'unlikely-duo': { tiers: [{ threshold: 2, values: { AD: 0.1, Health: 100, Mana: 10 } }] },
});
