/**
 * Skill feel table: every per-champion number of the skill feel sample (skill-feel.ts), in one place. Plain data, no
 * three.js or 2D imports. A champion takes part in the sample by having a row here; rolling the sample out to another
 * champion means adding its row, nothing else. Fields left out fall back to SKILL_FX_DEFAULTS.
 */

/** One cast effect's size factor (times its own scale) and live-particle limit. */
export interface SkillFxEffectTuning { readonly scale: number; readonly particles: number }
/**
 * How a cast's impact lands: seconds the caster and targets hold, camera kick strength, a colored ring at each target,
 * and (optional) seconds the ring waits after the impact moment.
 */
export interface SkillFxImpact { readonly hold: number; readonly kick: number; readonly ring: boolean; readonly ringDelay?: number }

export interface SkillFxRow {
  /** Charge (and impact ring) color: the champion's main skin color. */
  readonly color: number;
  /** The cast effects kept; left out, the cast keeps its whole plan (only shifted past the charge). */
  readonly keepCast?: readonly string[];
  /** Impact feel; left out, SKILL_FX_DEFAULTS.impact. */
  readonly impact?: SkillFxImpact;
  /** Per-effect overrides, by effect id; any other cast effect gets SKILL_FX_DEFAULTS.effect. */
  readonly effects?: Readonly<Record<string, SkillFxEffectTuning>>;
}

export const SKILL_FX_DEFAULTS = {
  /** Charge color for a champion without a row (never drawn today: only rows get the sample). */
  color: 0xffc864,
  /** Seconds of charge before a cast's own effects start (shared: the cast timeline is laid out on it). */
  windup: 0.25,
  impact: { hold: 0.07, kick: 1, ring: false } as SkillFxImpact,
  /** Live particles one cast effect may have (the shared budget still caps the whole board). */
  effect: { scale: 1, particles: 120 } as SkillFxEffectTuning,
} as const;

/** 10-24 GPU review: Vi and Renata hit too softly (蔚、烈娜塔命中力度不够). */
const STRONG_IMPACT: SkillFxImpact = { hold: 0.1, kick: 1.5, ring: true };

/*
 * 10-24 rollout to every champion with a 3D model (63). Colors: each champion's hero identity color (hero-identity.ts),
 * lifted to at least 62% lightness and 60% saturation so the additive charge ring shows on the board (Amumu's near-black
 * picked by hand). keepCast only for the champions whose cast plays six or more effects: launch, flight and impact.
 */

export const SKILL_FX_TABLE: Readonly<Record<string, SkillFxRow>> = {
  jinx: {
    color: 0xff4fb0,
    keepCast: ['jinx_tft13_jinx_base_r_muzzleflash', 'jinx_tft13_jinx_base_r_rocket_child', 'jinx_tft13_jinx_base_r_tar'],
    // 10-24: 金克丝命中的粉色爆炸太亮太大.
    effects: { jinx_tft13_jinx_base_r_tar: { scale: 0.6, particles: 50 } },
  },
  jayce: {
    color: 0x58b8ff,
    keepCast: ['jayce_tft13_jayce_base_r_ranged_recall_blast_cast', 'jayce_tft13_jayce_base_r_ranged_crystaldestroymissile', 'jayce_tft13_jayce_base_r_ranged_explosion'],
  },
  renata: { color: 0xc24dff, impact: STRONG_IMPACT },
  vi: {
    // 10-24 retest: the orange ring blended into enemy red and showed while Vi was still in the air; yellow, 0.15 s later.
    color: 0xffcf4a,
    keepCast: ['vi_tft13_vi_base_q_activate_hands_r', 'vi_tft13_vi_base_q_landing_aoe', 'vi_tft13_vi_base_q_tar'],
    impact: { ...STRONG_IMPACT, ringDelay: 0.15 },
  },
  // 阿卡丽
  akali: { color: 0x64d4d8, keepCast: [
    'akali_tft13_akali_base_e_mis',
    'akali_tft13_akali_base_e_tar',
    'akali_tft13_akali_base_w_tar',
  ] },
  // 安蓓萨
  ambessa: { color: 0xe7558a, keepCast: [
    'ambessa_tft13_ambessa_base_r_energy_windup',
    'ambessa_tft13_ambessa_base_r_hurl_swipe',
    'ambessa_tft13_ambessa_base_r_hurl_impact',
  ] },
  // 阿木木
  amumu: { color: 0x8fd6c4 },
  // 布里茨
  blitzcrank: { color: 0xaf4af3 },
  // 凯特琳
  caitlyn: { color: 0xd89e64 },
  // 卡蜜尔
  camille: { color: 0xa084e8 },
  // 卡西奥佩娅
  cassiopeia: { color: 0x52ea68 },
  // 库奇
  corki: { color: 0xe58558 },
  // 德莱厄斯
  darius: { color: 0xd86764 },
  // 德莱文
  draven: { color: 0xe97653, keepCast: [
    'draven_tft13_draven_base_q_activation',
    'draven_tft13_draven_base_q_mis',
    'draven_tft13_draven_base_q_spinning_tar',
  ] },
  // 蒙多医生
  drmundo: { color: 0xbb64d8 },
  // 艾克
  ekko: { color: 0x4af34a },
  // 伊莉丝
  elise: { color: 0xdc60dc, keepCast: [
    'elise_tft13_elise_base_cas_spider',
    'elise_tft13_elise_base_cocoon_mis',
    'elise_tft13_elise_base_cocoon_tar',
  ] },
  // 伊泽瑞尔
  ezreal: { color: 0x5aa9ff, keepCast: [
    'ezreal_tft13_ezreal_base_q_cas',
    'ezreal_tft13_ezreal_base_q_mis',
    'ezreal_tft13_ezreal_base_q_tar',
  ] },
  // 普朗克
  gangplank: { color: 0x4bf189, keepCast: [
    'gangplank_tft13_gangplank_base_e_ranged_mis_crit',
    'gangplank_tft13_gangplank_base_e_ranged_tar',
    'gangplank_tft13_gangplank_base_r_ranged_bomb',
  ] },
  // 盖伦
  garen: { color: 0x6481d8 },
  // 黑默丁格
  heimerdinger: { color: 0xf2e04a },
  // 俄洛伊
  illaoi: { color: 0x64d8d8 },
  // 艾瑞莉娅
  irelia: { color: 0x7fb3e0 },
  // 克格莫
  kogmaw: { color: 0xc0e458 },
  // 乐芙兰
  leblanc: { color: 0xd864d8, keepCast: [
    'leblanc_tft13_leblanc_base_r_channel',
    'leblanc_tft13_leblanc_base_r_mis_v2',
    'leblanc_tft13_leblanc_base_r_tar',
  ] },
  // 蕾欧娜
  leona: { color: 0xffd166 },
  // 洛里斯
  loris: { color: 0x6476d8 },
  // 拉克丝
  lux: { color: 0xffed80 },
  // 麦迪
  maddie: { color: 0xe07fa8 },
  // 玛尔扎哈
  malzahar: { color: 0xf34aaf },
  // 梅尔
  mel: { color: 0xe0b95c },
  // 莫德凯撒
  mordekaiser: { color: 0x9ed864, keepCast: [
    'mordekaiser_tft13_mordekaiser_base_q_mace_charge',
    'mordekaiser_tft13_mordekaiser_base_e_floor',
    'mordekaiser_tft13_mordekaiser_base_e_tar',
  ] },
  // 莫甘娜
  morgana: { color: 0x6f64d8 },
  // 娜美
  nami: { color: 0x5db7df },
  // 魔腾
  nocturne: { color: 0x4a4af3 },
  // 努努和威朗普
  nunu: { color: 0x4d92ef },
  // 爆爆
  powder: { color: 0x4af3f3 },
  // 芮尔
  rell: { color: 0x99b4e6 },
  // 荏妮
  renni: { color: 0xe7c255, keepCast: [
    'renni_tft13_chainsaw_base_r_hero_dash',
    'renni_tft13_chainsaw_base_q_tar',
    'renni_tft13_chainsaw_base_q_finalslam_impact',
  ] },
  // 兰博
  rumble: { color: 0x6464d8 },
  // 刀疤
  scar: { color: 0x5fddab, keepCast: [
    'scar_tft13_flyguy_base_q_mis_01',
    'scar_tft13_flyguy_base_q_hit_tar',
    'scar_tft13_flyguy_base_w_tar',
  ] },
  // 瑟提
  sett: { color: 0xf84451 },
  // 塞薇卡
  sevika: { color: 0xd86464, keepCast: [
    'sevika_tft13_lieutenant_base_q_flamethrower_nonupgraded_cast',
    'sevika_tft13_lieutenant_base_q_flamethrower_nonupgraded',
    'sevika_tft13_lieutenant_base_q_spell2_flamethrower_tar',
  ] },
  // 希尔科
  silco: { color: 0x64d8d8 },
  // 辛吉德
  singed: { color: 0x64d864 },
  // 史密奇
  smeech: { color: 0x92ef4d, keepCast: [
    'smeech_tft13_gremlin_base_z_jump_launch',
    'smeech_tft13_gremlin_base_z_swipe_dual',
    'smeech_tft13_gremlin_base_q_tar',
  ] },
  // 斯特卜
  steb: { color: 0x64d8a6 },
  // 斯维因
  swain: { color: 0x644def, keepCast: [
    'swain_tft13_swain_base_p_cas',
    'swain_tft13_swain_base_p_bird_child_mis',
    'swain_tft13_swain_base_p_tar',
    'swain_tft13_swain_base_r_explode',
  ] },
  // 崔丝塔娜
  tristana: { color: 0xff9f40 },
  // 特朗德尔
  trundle: { color: 0x90efde },
  // 崔斯特
  twistedfate: { color: 0xe4c358 },
  // 图奇
  twitch: { color: 0xd86464 },
  // 厄加特
  urgot: { color: 0xb1d864 },
  // 范德尔
  vander: { color: 0xd8aa64 },
  // 薇古丝
  vex: { color: 0x54e8e8, keepCast: [
    'vex_tft13_vex_base_q_initialaoe',
    'vex_tft13_vex_base_q_mis',
    'vex_tft13_vex_base_q_explosion',
  ] },
  // 维克托
  viktor: { color: 0xe0b95c },
  // 蔚奥莱
  violet: { color: 0xf34af3 },
  // 弗拉基米尔
  vladimir: { color: 0x8df34a },
  // 沃里克
  warwick: { color: 0xe0b95c },
  // 泽丽
  zeri: { color: 0x91ee91 },
  // 吉格斯
  ziggs: { color: 0xdfdf81 },
  // 佐伊
  zoe: { color: 0xd080ff },
  // 婕拉
  zyra: { color: 0x7cd864 },
};
