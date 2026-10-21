// Generated offline by scripts/generate-trait-official-text.cjs from archived 14.24 stringtables.
// Keep client wording and markup intact here; rendering fills current rule values and annotates deferred effects.
export const TRAIT_OFFICIAL_TEXT: Readonly<Record<string, { readonly apiName: string; readonly locale: string; readonly description: string }>> = {
  "automata": {
    "apiName": "TFT13_Hextech",
    "locale": "zh_cn",
    "description": "【海克斯机械】们会在造成伤害时获得一颗水晶。在@TriggerNumCrystals@颗水晶时，它们会震击它们的当前目标，造成魔法伤害+自上次震击后的<magicDamage>@ConversionDamagePct*100@%</magicDamage>已造成伤害，然后重置。它们还会获得护甲与魔抗。<br><br><expandRow>(@MinUnits@) <magicDamage>@MagicDamage@</magicDamage>伤害，@Resists@ %i:scaleArmor%%i:scaleMR%</expandRow>"
  },
  "sorcerer": {
    "apiName": "TFT13_Sorcerer",
    "locale": "zh_cn",
    "description": "你的队伍获得@TeamAP@法术强度。【法师】们获得更多法术强度。<br><br><row>(@MinUnits@) @BaseAP@ %i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@ %i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@ %i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@ %i:scaleAP%，技能会对其目标造成持续@DamageDecreaseDuration@秒的@DamageDecrease*100@%伤害削减</row>"
  },
  "scrap": {
    "apiName": "TFT13_Scrap",
    "locale": "zh_cn",
    "description": "战斗开始时：【极客】们携带的基础装备会临时转变为成装。己方每持有一件基础装备(包括那些已合成成装的基础装备)，【极客】弈子就获得持续@ShieldDuration@秒的护盾值。<br><br><row>(@MinUnits@) @NumComponents@件基础装备，@HPShieldAmount@护盾值</row><br><row>(@MinUnits@) @NumComponents@件基础装备，@HPShieldAmount@护盾值</row><br><row>(@MinUnits@) 所有基础装备和成装都会成为幸运装备！@HPShieldAmount@护盾值</row><br><row>(@MinUnits@) 生成光明版装备！@HPShieldAmount@护盾值</row><br><br><rules>护盾值：@TFTUnitProperty.:TFT13_Trait_Scrap_ShieldTotal@</rules><br>"
  },
  "artillerist": {
    "apiName": "TFT13_Martialist",
    "locale": "zh_cn",
    "description": "【炮手】们每攻击@NumOfAttacks@次，就会发射一枚火箭，在目标附近造成@PercentDamage*100@%攻击力的伤害。他们还会获得攻击力。<br><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%，每攻击@NumOfAttacks@次，发射一枚造成双倍伤害的火箭。</row>"
  },
  "emissary": {
    "apiName": "TFT13_Ambassador",
    "locale": "zh_cn",
    "description": "这个羁绊仅会在你恰好拥有1个或4个独特的【外交官】时激活。<br><br><row>(@MinUnits@) 获得该【外交官】的加成。</row><br><row>(@MinUnits@) 获得所有加成。 【外交官】们获得@BonusHealth@ %i:scaleHealth%和@SelfishDamageAmp*100@% %i:scaleDA%。</row><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveDomina alternate=TFTGuildInactive>【安蓓萨】： 己方弈子们获得@AmbessaArmor@x已击败对手数量的护甲和魔抗。(@TFTUnitProperty.trait:TFT13_Ambassador_PlayersDefeated@/7)</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveJarvan alternate=TFTGuildInactive>【盖伦】： 战斗开始时，【盖伦】和他左右两侧的己方弈子们获得他的@GarenHealthPercent*100@%最大生命值。</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveNami alternate=TFTGuildInactive>【娜美】： 己方弈子的每次普攻提供@NamiMana@额外法力值。</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveTristana alternate=TFTGuildInactive>【崔丝塔娜】： 己方弈子获得@StarAS*100@%x星级的攻击速度。</TFTGuildActive>"
  },
  "sentinel": {
    "apiName": "TFT13_Titan",
    "locale": "zh_cn",
    "description": "你的队伍获得护甲和魔抗。【哨兵】们获得三倍。<br><br><expandRow>(@MinUnits@) @BonusArmor@ %i:scaleArmor%%i:scaleMR%</expandRow>"
  },
  "family": {
    "apiName": "TFT13_Family",
    "locale": "zh_cn",
    "description": "【家人】们会彼此支持，缩减最大法力值并且获得额外加成。<br><br><row>(@MinUnits@) @ManaReduction*100@%缩减，@DamageReduction*100@%&nbsp;%i:scaleDR%</row><br><row>(@MinUnits@) @ManaReduction*100@%缩减，@AttackSpeed*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @ManaReduction*100@%缩减，去上城搞钱！在战斗后，获得搞钱进度，并且每个存活的【家人】都会使这个进度提升！</row><br><br><rules>@TFTUnitProperty.trait:TFT13_JunkerKing_SelfDestructTRA@</rules>"
  },
  "ambusher": {
    "apiName": "TFT13_Ambusher",
    "locale": "zh_cn",
    "description": "来自【伏击专家】的技能的伤害可以暴击。他们还会获得额外的暴击几率和暴击伤害。<br><br><row>(@MinUnits@) @CritChance*100@% %i:scaleCrit%；@CritDamage*100@% %i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@% %i:scaleCrit%；@CritDamage*100@% %i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@% %i:scaleCrit%；@CritDamage*100@% %i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@% %i:scaleCrit%；@CritDamage*100@% %i:scaleCritMult%；此外，还会获得@DamageReductionPct*100@%伤害减免</row>"
  },
  "visionary": {
    "apiName": "TFT13_Invoker",
    "locale": "zh_cn",
    "description": "每当【先知】们获得法力值时，会获得更多法力值。<br><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%，技能会治疗一名友军，数额相当于该技能的@AllyHealing*100@%已造成伤害</row><br>"
  },
  "sniper": {
    "apiName": "TFT13_Sniper",
    "locale": "zh_cn",
    "description": "【狙神】们可对距离更远的目标造成更高伤害。<br><br><row>(@MinUnits@) 每格@PercentDamageIncrease@%伤害</row><br><row>(@MinUnits@) 每格@PercentDamageIncrease@%伤害</row><br><row>(@MinUnits@) 每格@PercentDamageIncrease@%伤害并获得额外的@BonusHexRangeIncrease@攻击距离</row>"
  },
  "conqueror": {
    "apiName": "TFT13_Warband",
    "locale": "zh_cn",
    "description": "【铁血征服者】们在参与击杀后会提供【征服】层数。获得足够的【征服】层数后，即可打开一个装满战利品的战争宝箱！<br><br>【铁血征服者】们获得攻击力和法术强度，并且每打开一个战利品宝箱，这个加成就会提升@PercentIncreasePerChest*100@%。<br><br><expandRow>(@MinUnits@) @ADAPBase*100@% %i:scaleAD%%i:scaleAP%；@StacksPerKill@x【征服】层数</expandRow><br><br><rules>已打开的战争宝箱：@TFTUnitProperty.trait:TFT13_Warband_ChestsCompleted@</rules><br><rules>当前属性：@TFTUnitProperty.trait:TFT13_Warband_CurrentADAP@% %i:scaleAD%%i:scaleAP%</rules><br>"
  },
  "high-roller": {
    "apiName": "TFT13_HighRoller",
    "locale": "en_us",
    "description": "施放技能时，【塞薇卡】会为她的技能随机抽取一种【金克丝】改装，并获得持续@Duration@秒的@Durability*100@%伤害减免。<br><br>改装：<br>-火箭：发射@Bonus1NumRockets@枚火箭，每枚造成@Bonus1RocketDamage@物理伤害<br>-护盾：获得持续@Bonus2ShieldDuration@秒的@Bonus2ShieldAmount@护盾值<br>-硬币：获得@Bonus4Gold@金币<br>-三倍：强化她抽取到的技能！"
  },
  "academy": {
    "apiName": "TFT13_Academy",
    "locale": "zh_cn",
    "description": "【皮城学院】在每局游戏会赞助3件装备。<br><br>赞助装备会提供额外最大生命值和伤害增幅。携带着赞助装备的【皮城学院】弈子们会获得此加成的双倍，外加额外的@BaseValues*100@%生命值和伤害增幅。<br><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%；<br>获得1件赞助装备。</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%；<br>获得1件赞助装备。</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%；<br>获得1件赞助装备。</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%</row>"
  },
  "chem-baron": {
    "apiName": "TFT13_Crime",
    "locale": "zh_cn",
    "description": "在每个玩家对战回合后获得【微光】。如果你的连败至少在@MinStreakLength@次，则会获得更多。<br><br>每拥有@ShimmerBreakpoint@层【微光】，黑市会向你提供只有【炼金男爵】才能使用的非法装备。 你每次跳过一次黑市【炼金男爵】们就会获得最大生命值。<br><br><expandRow>(@MinUnits@) @ShimmerPerCombat@或@ShimmerPerCombatStreaking@；@HealthPerSkip@&nbsp;%i:scaleHealth%</expandRow><br><br><rules>已跳过的黑市数量：@TFTUnitProperty.trait:TFT13_Crime_PassedMarkets@</rules><br><rules>当前生命值：@TFTUnitProperty.trait:TFT13_Crime_CurrentHealth@&nbsp;%i:scaleHealth%</rules>"
  },
  "rebel": {
    "apiName": "TFT13_Rebel",
    "locale": "zh_cn",
    "description": "【蓝发小队】们获得@MaxHealthIncrease*100@%最大生命值。<br><br>在你的队伍失去@PercentHealthTrigger*100@%生命值时，一个烟雾信号会出现，为【蓝发小队】们提供持续@BurstDuration@秒的@BurstAS*100@%攻击速度，以及持续到战斗结束的额外强度。<br><br><row>(@MinUnits@) @ADAP*100@% %i:scaleAD%%i:scaleAP%</row><br><row>(@MinUnits@) @ADAP*100@% %i:scaleAD%%i:scaleAP%，@PercentMaxHealthBonus*100@% %i:scaleHealth%</row><br><row>(@MinUnits@) @ADAP*100@% %i:scaleAD%%i:scaleAP%，@PercentMaxHealthBonus*100@% %i:scaleHealth%，并晕眩所有敌人@StunDuration@秒</row><br><row>(@MinUnits@) 烟雾信号会在战斗开始时以及之后的每 @ForceDuration@秒触发。</row>"
  },
  "dominator": {
    "apiName": "TFT13_Infused",
    "locale": "zh_cn",
    "description": "战斗开始时：【统领】获得持续@ShieldDuration@秒的护盾值。<br><br>【统领】施放技能时，会基于已消耗的法力值获得可叠加的法术强度。<br><br><expandRow>(@MinUnits@) @ShieldAmount@护盾值，@APPercent*100@% %i:scaleAP%</expandRow>"
  },
  "pit-fighter": {
    "apiName": "TFT13_Pugilist",
    "locale": "zh_cn",
    "description": "【搏击手】们获得@OmnivampPercent*100@%全能吸血并造成额外真实伤害。每场战斗一次：在@HealthThreshold*100@%生命值时，他们会在@Duration@秒里持续治疗自身一部分最大生命值。<br><br><expandRow>(@MinUnits@) @TrueDamagePercent*100@%真实伤害，@HealPercent*100@% %i:scaleHealth%</expandRow>"
  },
  "enforcer": {
    "apiName": "TFT13_Squad",
    "locale": "zh_cn",
    "description": "战斗开始时：【执法官】们获得护盾值和伤害增幅。生命值最高的敌人们会被<i>通缉！</i><br><br>当一个被通缉的敌人阵亡时，【执法官】们获得@AttackSpeedPerWantedKill*100@%攻击速度。<br><br><row>(@MinUnits@) @NumOfWantedEnemies@个敌人被通缉； @PercentMaxHealthShield*100*100@% %i:scaleHealth%，@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@个敌人被通缉； @PercentMaxHealthShield*100*100@% %i:scaleHealth%，&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@个敌人被通缉； @PercentMaxHealthShield*100*100@% %i:scaleHealth%，&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@个敌人被通缉； @PercentMaxHealthShield*100*100@% %i:scaleHealth%，&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) 所有敌人都被通缉；@PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%，@BaseDA*100@%&nbsp;%i:scaleDA%；战斗开始时：没收敌人的所有装备！</row>"
  },
  "firelight": {
    "apiName": "TFT13_Hoverboard",
    "locale": "zh_cn",
    "description": "每过@Duration@秒，【野火帮】们就会冲刺。在冲刺时，他们会进行一次无限距离的攻击并治疗自身，治疗量相当于自上次冲刺后的一部分已承受伤害。<br><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@%已承受伤害</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@%已承受伤害</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@%已承受伤害。在冲刺时，获得巨额爆发攻速加成。</row>"
  },
  "experiment": {
    "apiName": "TFT13_Experiment",
    "locale": "zh_cn",
    "description": "在你的棋盘上获得【试验格】。<br><br>战斗开始时：【试验格】上的【试验品】会获得站在【试验格】上的所有【试验品】的【试验品】加成，外加最大生命值。<br><br><row>(@MinUnits@) @NumLaboratory@个【试验格】，@MaxHealth@ %i:scaleHealth%</row><br><row>(@MinUnits@) @NumLaboratory@个【试验格】，@MaxHealth@ %i:scaleHealth%</row><br><row>(@MinUnits@) 【试验品】加成提升@ExperimentBonusIncrease*100@%！</row>"
  },
  "bruiser": {
    "apiName": "TFT13_Bruiser",
    "locale": "zh_cn",
    "description": "己方弈子获得@TeamFlatHealth@最大生命值。【格斗家】们获得更多生命值。<br><br><expandRow>(@MinUnits@) @BonusPercentHealth*100@% %i:scaleHealth%</expandRow>"
  },
  "junker-king": {
    "apiName": "TFT13_JunkerKing",
    "locale": "zh_cn",
    "description": "每@NumRounds1Star@回合开启一个武器库，可为你最强大的那个【兰博】的机甲购买永久升级项目。<br><br><rules>升级项目所需回合数：@TFTUnitProperty.trait:TFT13_JunkerKing_RoundsUntilOpening@</rules>"
  },
  "black-rose": {
    "apiName": "TFT13_Cabal",
    "locale": "zh_cn",
    "description": "<row>(@MinUnits@) 召唤一个被束缚的【赛恩】。在【黑色玫瑰】弈子们施放@NumCastsToUnlock@次技能后，或在他跌下@PercentHealthUnlock*100@%生命值时，他会挣脱束缚。</row><br><row>(@MinUnits@) 【赛恩】变得更强并且【黑色玫瑰】弈子们会对敌人造成更多伤害。</row><br><row>(@MinUnits@) 【赛恩】在挣脱束缚时会释放黑暗能量并回满生命值。</row><br><row>(@MinUnits@) 当【赛恩】阵亡时，他会带着超越死亡的能量重获生命！</row><br><br><rules>【黑色玫瑰】弈子们的每个星级都会提升【赛恩】的强度</rules>"
  },
  "quickstriker": {
    "apiName": "TFT13_Challenger",
    "locale": "zh_cn",
    "description": "【迅击战士】移动得更快且获得攻击速度，这个攻速加成基于其目标的已损失生命值。<br><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@% %i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@% %i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@% %i:scaleAS%。在目标阵亡时，【迅击战士】们会冲刺至一个新目标并获得持续@ShieldDuration@秒的@ShieldAmount@护盾值。</row>"
  },
  "watcher": {
    "apiName": "TFT13_Watcher",
    "locale": "zh_cn",
    "description": "【监察】们获得伤害减免，这个加成会在高于@HealthBreakpoint*100@%生命值时提升。<br><br><expandRow>(@MinUnits@) @BaseDR*100@%或@IncreasedDR*100@% %i:scaleDR%</expandRow><br>"
  }
};
