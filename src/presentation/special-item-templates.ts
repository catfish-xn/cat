/** Pure UI tooltip templates; numeric values are supplied by the caller. */
type Values = Readonly<Record<string, number | null>>;
const pct = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)}%`;
const num = (value: number | null | undefined) => String(Math.round((value ?? 0) * 10) / 10);

/** Family effect text: [base line, 完美加成 line (prismatic tier only)]. */
export const SHIMMER_FAMILIES: Readonly<Record<string, (v: Values) => readonly [string, string?]>> = {
  ChemGrips: v => [`受到的每次伤害减少 ${num(v.ReducedDamage)} 点。`],
  MageGuard: v => [`每 ${num(v.TickRate)} 秒获得 ${num(v.APPerTick)} 法强。`],
  MiningGauntlet: v => [`普攻额外造成 ${num(v.BonusDamageOnAttack)} 真实伤害。`],
  DestabilizedChemtank: v => [`生命降到 ${pct(v.HealthThreshold)} 时获得 ${pct(v.InitialPercentShield)} 最大生命的护盾，之后每 ${num(v.TickRate)} 秒再获得 ${pct(v.PercentShield)} 最大生命的护盾。`,
    `获得护盾时向附近 ${num(v.PrismaticNumChampions)} 名敌人投出药瓶，造成 ${pct(v.PrismaticDamagePercent)} 最大生命的魔法伤害。`],
  ExecutionersVorpalblade: v => [`普攻和技能处决生命低于 ${pct(v.ExecuteThreshold)} 的敌人；击杀后 ${num(v.Duration)} 秒内获得 ${pct(v.OnKillDR)} 伤害减免和 ${pct(v.OnKillDA)} 伤害增幅，再次击杀刷新。`,
    `处决时掉落 ${num(v.PrismaticGold)} 金币，并为携带者回复 ${num(v.PrismaticHeal)} 生命。`],
  FleshRipper: v => [`生命降到 ${pct(v.HealthThreshold)} 以下时短暂不可选取，回复 ${pct(v.PercentHeal)} 最大生命，并获得 ${pct(v.EnhancedAD)} 攻击力和 ${pct(v.EnhancedOmnivamp)} 全能吸血。`,
    `首次阵亡时以 ${pct(v.PrismaticReviveHeal)} 最大生命复活。`],
  PiltovenHexplating: v => [`受到伤害时获得 ${num(v.ArmorPerStack)} 护甲和魔抗，最多叠 ${num(v.MaxStacks)} 层；满层后被普攻时，对 ${num(v.HexRange)} 格内敌人造成护甲与魔抗之和 ${pct(v.ResistancePercentageDamage)} 的魔法伤害（冷却 ${num(v.Cooldown)} 秒）。`,
    '满层反击改为真实伤害。'],
  ShimmerBloom: v => [`治疗和护盾效果提高 ${pct(v.IncreasedHealShieldPercent)}；每 ${num(v.Cadence)} 秒为自己和生命最低的 ${num(v.NumAllies)} 名友军提供 ${num(v.ShieldAmount)} 护盾，持续 ${num(v.ShieldDuration)} 秒。`,
    `为友军提供护盾或治疗时，使其获得 ${num(v.PrismaticAllyAP)} 法强和 ${pct(v.PrismaticAllyAS)} 攻速（冷却 ${num(v.PrismaticCooldownTime)} 秒）。`],
  UnleashedToxins: v => [`普攻额外获得 ${num(v.ExtraManaOnAttack)} 法力；施放技能后向当前目标发射 ${num(v.NumMissiles)} 枚导弹，造成 ${num(v.FlatDamage)} 魔法伤害。`,
    `施放技能时放出毒波，造成 ${num(v.PrismaticWaveDamage)} 魔法伤害并晕眩 ${num(v.PrismaticWaveStunDuration)} 秒。`],
  VirulentVirus: v => [`技能伤害命中的敌人在 ${num(v.Duration)} 秒内额外受到该伤害 ${pct(v.DoTPercentDamage)} 的真实伤害。`,
    `受影响的敌人伤害降低 ${pct(v.PrismaticReducedDamage)}，阵亡后以 ${num(v.PrismaticZombieHealth)} 生命加入你方，生命在 ${num(v.PrismaticZombieDecayDuration)} 秒内衰减。`],
  VoltaicSaber: v => [`每造成 ${num(v.NumDamageInstances)} 次伤害，向生命最低的 ${num(v.NumEnemies)} 名敌人放出电击，造成 ${num(v.JoltDamage)} 物理伤害。`,
    `每次放出电击，携带者获得 ${pct(v.PrismaticASPerTrigger)} 攻速。`],
  DimensionalHeirloom: v => [`战斗开始时放出一个随身异常点，每 ${num(v.Cadence)} 秒召唤一名强力友军。`],
};

/** Source stats the rules apply, in client order; AD and omnivamp are ratios, AS and crit percents, the rest flat. */
