/** Independent hand transcription from:
 * /home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json
 * recordIndex is the ZERO-BASED array index, not a line number.
 * Values preserve raw JSON floats/null/hash keys. Rewards translate resolved descriptions;
 * they are not generated from either implementation table. Sampling/timing: P-AG1..4.
 * Disabled rewards describe source intent only and MUST NOT execute partially.
 */
export const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
type Values=Record<string,number|null>;
// Tokens: i=item, u=unit[:stars], c=consumable[:count], ri=random item pool:count[:identical],
// ru=random unit cost:count:stars, all=all units of cost. No production imports.
export interface SourceExpectation {id:string;recordIndex:number;apiName:string;tier:string;values:Values;rewards:string[];gold:number;xp:number;roundGold:number;enabled:boolean;deferred?:string}
function r(id:string,recordIndex:number,apiName:string,tier:string,values:Values,rewards:string[],gold=0,xp=0,roundGold=0,enabled=true,deferred?:string):SourceExpectation {
 return {id,recordIndex,apiName,tier,values,rewards,gold,xp,roundGold,enabled,deferred};
}
export const BATCH1_SOURCE:SourceExpectation[]=[
 r('coronation',241,'TFT_Augment_Coronation','prismatic',{BonusAD:0.30000001192092896,BonusAP:40,BonusAS:0.30000001192092896},['i:TFT_Item_ForceOfNature']),
 r('tacticians-kitchen',295,'TFT_Augment_TacticiansKitchen','prismatic',{NumFryingPan:1,NumItemAnvils:1,NumSpatula:1},['i:TFT_Item_TacticiansRing','ri:emblem:1']),
 r('branching-out',5,'TFT_Augment_BranchingOut','silver',{Numberofcombats:null},['ri:emblem:1','c:reforger:1']),
 r('item-grab-bag-i',28,'TFT6_Augment_ItemGrabBag1','silver',{NumItems:1},['ri:completed:1']),
 r('one-two-five',40,'TFT6_Augment_OneTwoFive','silver',{Gold:2,NumChamps:1,NumComponents:1},['ri:component:1','ru:5:1:1'],2),
 r('band-of-thieves-i',1,'TFT7_Augment_BandOfThieves1','silver',{NumGloves:1},['i:thiefs-gloves']),
 r('teaming-up-i',64,'TFT9_Augment_Commander_TeamingUp1','silver',{NumChamps:2,NumComponents:1},['ri:component:1','ru:3:2:1']),
 r('iron-assets',26,'TFT9_Augment_IronAssets','silver',{Gold:4},['u:TFT_ArmoryKeyComponent'],4),
 r('missed-connections',38,'TFT9_Augment_MissedConnections','silver',{},['all:1']),
 r('ones-twos-three',41,'TFT9_Augment_OneTwosThree','silver',{NumChamps:2,tier1champs:2},['ru:1:2:1','ru:2:2:1','ru:3:1:1']),
 r('silver-spoon',56,'TFT9_Augment_SilverSpoon','silver',{Experience:10},[],0,10),
 r('heroic-grab-bag',124,'TFT10_Augment_HeroicGrabBag','gold',{Gold:9,LesserDuplicatorAmount:2},['c:TFT_Consumable_ChampionDuplicator_III:2'],9),
 r('raining-gold',157,'TFT11_Augment_RainingGold','gold',{InstantGold:8,RoundGold:1},[],8,0,1),
 r('raining-gold-plus',158,'TFT11_Augment_RainingGoldPlus','gold',{InstantGold:18,RoundGold:1},[],18,0,1),
 r('big-grab-bag',83,'TFT9_Augment_BigGrabBag','gold',{Gold:2,NumItems:3,NumReforgers:1},['ri:component:3','c:reforger:1'],2),
 r('teaming-up-ii',187,'TFT9_Augment_Commander_TeamingUp2','gold',{NumComponents:null,NumItems:1,NumUnits:2},['ri:support:1','ru:4:2:1']),
 r('support-cache',186,'TFT9_Augment_SupportCache','gold',{ArmoryChoiceCount:4},['u:TFT_ArmoryKeySupport']),
 r('duo-queue',108,'TFT_Augment_DuoQueue','gold',{NumComponents:2,NumUnits:2},['ru:5:2:1','ri:component:2:identical']),
 r('two-trick',204,'TFT_Augment_TwoTrick','gold',{},['ru:2:1:2','ru:1:2:2']),
 r('build-a-bud',233,'TFT11_Augment_Buildabud','prismatic',{Gold:8},['ru:1:1:3'],8),
 r('radiant-refactor',281,'TFT11_Augment_RadiantRefactor','prismatic',{anvils:1},['c:masterwork-upgrade:1','u:TFT_ArmoryKeyComponent']),
 r('final-polish',249,'TFT_Augment_FinalPolish','prismatic',{},['u:TFT_ArmoryKeySupport','u:TFT_ArmoryKeyCompleted']),
 r('one-buff-two-buff',270,'TFT_Augment_OneBuffTwoBuff','prismatic',{},['i:red-buff','i:blue-buff','c:TFT_Consumable_NeekosHelp:1']),
];
// Each tuple independently transcribes both source records, emblem identity and named rewards.
const emblems:[string,string,string,number,string[],number,string[]][]=[
 ['academy','Academy','Academy',71,['leona'],218,['ri:sponsored:1']],
 ['ambusher','Ambusher','Ambusher',76,['camille'],219,['i:hand-of-justice','u:camille']],
 ['artillerist','Artillerist','Demolitionist',79,['tristana'],223,['i:runaans-hurricane','u:tristana']],
 ['automata','Automata','Automata',80,['nocturne'],225,['i:guardbreaker','u:nocturne']],
 ['bruiser','Bruiser','Bruiser',88,['sett'],232,['i:redemption','u:sett']],
 ['black-rose','Cabal','Cabal',84,[],228,['i:shojin']],
 ['chem-baron','Chembaron','Crime',94,['renata'],239,['i:nashors-tooth','u:smeech']],
 ['conqueror','Conqueror','Warband',100,['rell'],240,['i:last-whisper','u:rell']],
 ['dominator','Dominator','Infused',107,['blitzcrank'],243,['i:protectors-vow','u:blitzcrank']],
 ['enforcer','Enforcer','Squad',109,[],245,['i:infinity-edge','u:maddie']],
 ['experiment','Experiment','Experiment',112,['urgot'],247,['i:bloodthirster','u:urgot']],
 ['family','Family','Family',113,['violet'],248,['i:redemption','u:vander','u:violet']],
 ['firelight','Firelight','Hoverboard',114,['zeri'],250,['i:protectors-vow','u:scar']],
 ['pit-fighter','PitFighter','PitFighter',150,['urgot'],275,['i:steraks-gage','u:gangplank']],
 ['quickstriker','Quickstriker','Challenger',156,['akali'],280,['i:rageblade','u:nocturne']],
 ['rebel','Rebel','Rebel',159,['akali'],283,['i:jeweled-gauntlet','u:akali']],
 ['scrap','Scrap','Scrap',171,['ziggs'],285,['u:ziggs','ri:component:2']],
 ['sentinel','Sentinel','Titan',172,['rell'],286,['i:crownguard','u:loris']],
 ['sniper','Sniper','Sniper',177,['zeri'],289,['i:infinity-edge','u:zeri']],
 ['sorcerer','Sorcerer','Sorcerer',179,['vladimir'],290,['i:adaptive-helm','u:vladimir']],
 ['visionary','Visionary','Invoker',207,['renata'],304,['i:shojin','u:renata']],
 ['watcher','Watcher','Watcher',212,['vander'],309,['i:steadfast-heart','u:scar']],
];
for(const [id,api,item,crestIndex,units,crownIndex,rewards] of emblems){
 const emblem=`i:TFT13_Item_${item}EmblemItem`;
 BATCH1_SOURCE.push(r(`${id}-crest`,crestIndex,`TFT13_Augment_${api}Crest`,'gold',{},[emblem,...units.map(u=>`u:${u}`)]));
 BATCH1_SOURCE.push(r(`${id}-crown`,crownIndex,`TFT13_Augment_${api}Crown`,'prismatic',id==='scrap'?{NumComponents:2}:{},[emblem,...rewards]));
}
export const BATCH2_SOURCE:SourceExpectation[]=[
 r('academic-research',70,'TFT13_Augment_Academy','gold',{NumItems:1,NumOptions:2},['ri:component:1','u:lux','u:ezreal'],0,0,0,false,'build -> 2 options: sponsored + built item'),
 r('loot-explosion',132,'TFT13_Augment_Ambusher','gold',{'{51972fee}':2,'{a59e2760}':.5,'{c209103c}':0.10999999940395355,'{ca332ec1}':.5,'{d89481f4}':1.75},['u:camille','u:powder'],0,0,0,false,'kill -> unknown loot table'),
 r('rocket-collection',162,'TFT13_Augment_Artillerist','gold',{IncreasedRocketDamage:0.15000000596046448,MaxItems:2,RocketDamageThreshold:75},['u:tristana','u:urgot'],0,0,0,true,'75 rockets -> collector; max 2'),
 r('rocket-collection-plus',163,'TFT13_Augment_ArtilleristPlus','gold',{IncreasedRocketDamage:0.15000000596046448,MaxItems:2,RocketDamageThreshold:65},['u:tristana','u:urgot'],0,0,0,true,'65 rockets -> collector; max 2'),
 r('fractured-crystals',117,'TFT13_Augment_Automata','gold',{Percentage:0.699999988079071},['u:amumu','u:nocturne']),
 r('heavy-hitters',123,'TFT13_Augment_Bruiser','gold',{RefreshSeconds:4,SlamPercentHealth:0.07000000029802322},['u:steb','u:trundle']),
 r('forbidden-magic',115,'TFT13_Augment_Cabal','gold',{NumTakedownsPerStack:3,SionADPercentPerStack:0.014999999664723873,SionHealthPerStack:10},['trait-units:black-rose:3'],0,0,0,false),
 r('crimson-pact',210,'TFT13_Augment_Chembaron','gold',{Gold:6,Heal:4},['u:renni'],0,0,0,true,'save shimmer -> 6 gold + 4 player HP'),
 r('noxian-guillotine',141,'TFT13_Augment_Conqueror','gold',{ArmorandMagicResist:5,BaseExecuteThreshold:12,NumKills:1},['u:darius','u:draven']),
 r('dominate',106,'TFT13_Augment_Dominator','gold',{ShieldAmount:100,ShieldDuration:3,ShieldPercentAS:0.10000000149011612},['u:cassiopeia']),
 r('enforce',129,'TFT13_Augment_Enforcer','gold',{BonusAD:0.10000000149011612,BonusGoldAmount:6,WantedEnemyBreakpoint:6},['u:steb','u:maddie'],0,0,0,true,'6 wanted deaths -> 6 gold'),
 r('natural-selection',188,'TFT13_Augment_Experiment','gold',{Health:0.11999999731779099,'{1b889d1c}':100},['trait-units:experiment:3'],0,0,0,false),
 r('welcome-to-the-playground',213,'TFT13_Augment_Family','gold',{MinNumFamilyMembers:2,NumCopies:1,TimeRequirement:17},['u:powder','u:violet'],0,0,0,true,'2 alive at 17s or end -> random vander/powder/violet'),
 r('aerial-warfare',73,'TFT13_Augment_Firelight','gold',{Bonus:3,FirelightBonusAD:0.09000000357627869,FirelightBonusAP:9,'{445a9cb6}':99},['u:scar','u:zeri'],0,0,0,false),
 r('why-not-both',215,'TFT13_Augment_Formswapper','gold',{BonusStats:24},['u:swain','u:gangplank'],0,0,0,true,'3-star form swapper -> 2-star copy'),
 r('pit-fighter-prizefighter',194,'TFT13_Augment_PitFighter','gold',{ADPerLoss:0.014999999664723873,HealthPerWin:45},['u:urgot']),
 r('quickstriker-boost',72,'TFT13_Augment_Quickstriker','gold',{AttackSpeed:0.8500000238418579,BuffDuration:2.5,TimeBetweenProcs:6},['u:nocturne','u:akali']),
 r('rebel-resurgence',144,'TFT13_Augment_Rebel','gold',{NumOfUnits:5,ReducedHealth:400},['u:akali','u:irelia'],0,0,0,false),
 r('scrap-recycling',191,'TFT13_Augment_Scrap','gold',{MaxComponents:5,NumScrapItemsConverted:6},['u:powder','u:trundle'],0,0,0,true,'6 conversions -> random component; max 5'),
 r('sentinel-slam',173,'TFT13_Augment_Sentinel','gold',{Interval:4,PercGain:0.05000000074505806,ResistToDamageRatio:.75},['u:loris']),
 r('snipers-nest',178,'TFT13_Augment_Sniper','gold',{DamageAmp:8,MaxAmp:32},['u:zeri'],0,0,0,false),
 r('sorcerer-explosion',78,'TFT13_Augment_Sorcerer','gold',{DeathPercentage:3},['u:vladimir','u:lux']),
 r('visionary-voidlings',208,'TFT13_Augment_Visionary','gold',{Mana:275,MaxVoidlings:5,Stage2Health:400,Stage3Health:450,Stage4Health:500,Stage5Health:550,Stage6Health:600,'{3bc62dd2}':60},['u:rell','u:morgana'],0,0,0,false),
 r('watcher-growth',82,'TFT13_Augment_Watcher','gold',{IncreaseADByTakeAttack:2,IncreaseAPByTakeSpell:4},['u:vander']),
 r('betrayal',196,'TFT13_TeamupAugment_Betrayal','gold',{NumKills:2},['u:maddie','u:ambessa'],0,0,0,true,'either partner 2 kills -> maddie'),
 r('blood-brothers',301,'TFT13_TeamupAugment_BloodBrothers','prismatic',{APGainPerDeath:6,MaxHealthGainPerCast:30},['u:vander:2','u:silco','i:shojin'],0,0,0,true,'silco cast -> vander +30 max HP; vander death -> silco +6 AP; player-owned totals'),
];
// Former batch-1 exclusions, reclassified by P-B5-50/51 on 2026-10-27.
export const BATCH1_BLOCKED_SOURCE:SourceExpectation[]=[];
export const BATCH1_RECLASSIFIED_SOURCE:SourceExpectation[]=[
 r('all-that-shimmers',74,'TFT9_Augment_AllThatShimmers','gold',{ArmoryChoiceCount:3,InterestCap:5},['c:magnetic-remover:1'],0,0,0,false,'P-B5-50/51: choose 1 of 3 fixed artifacts, existing interest policy'),
 r('all-that-shimmers-plus',75,'TFT_Augment_AllThatShimmersPlus','gold',{ArmoryChoiceCount:3,GoldGranted:4,InterestCap:5},['c:magnetic-remover:1'],4,0,0,false,'P-B5-50/51: choose 1 of 3 fixed artifacts, existing interest policy'),
];
