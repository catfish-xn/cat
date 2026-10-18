/** G2-4b artifacts: the 21 whose source text is expressible in the item program vocabulary (with the
 * G2-4b extensions). Every number reads G24_ARTIFACT_SOURCE; the eight new-mechanism artifacts land later. */
import type {Effect,ItemDefinition} from '../strategy-types';
import type {ItemProgram} from '../m8/item-program';
import {G24_ARTIFACT_SOURCE} from './g2-4-artifact-source';
import {always,amount,damage,enemies,filter,mana,modifier,periodic,selector,stat,status,survival,trigger} from './item-programs';
import {freezeContent} from './freeze';
type ArtifactId=keyof typeof G24_ARTIFACT_SOURCE;
const values=(id:ArtifactId):Readonly<Record<string,number>>=>G24_ARTIFACT_SOURCE[id].values as Readonly<Record<string,number>>;
/** Same source-stat adapter as G2-3 reward items: AD is a ratio, AS a percent, the rest flat. */
function sourceStats(id:ArtifactId):Effect[]{
 const v=values(id),n=(key:string)=>v[key]??0,effects:Effect[]=[];
 for(const [key,statName] of [['Health','maxHp'],['AP','abilityPower'],['Armor','armor'],['MagicResist','magicResist'],['Mana','initialMana']] as const)if(n(key))effects.push({kind:'statFlat',stat:statName,amount:Math.round(n(key))});
 if(n('AD'))effects.push({kind:'statPercentBps',stat:'attackDamage',bps:Math.round(n('AD')*10000)});
 if(n('AS'))effects.push({kind:'attackSpeedBps',bps:Math.round(n('AS')*100)});
 return effects;
}
const grow=(m:ReturnType<typeof modifier>)=>({...stat(m),stackPolicy:{kind:'add-stacks' as const,cap:null}});
const killingBlow=(by:'holder'|'other')=>({kind:'killing-blow' as const,by});
const num=(x:number)=>Math.round(x*100)/100;
const ticks=(seconds:number)=>Math.round(seconds*20),pct=(percent:number)=>Math.round(percent*100);
const self=(event:'actor'|'target'='actor')=>({subject:event,relationToHolder:'self' as const,withinHexes:null});
const extra=(patch:Parameters<typeof damage>[1])=>({...damage('magic',patch),delivery:'attack-extra' as const});
const over=(resource:'heal'|'mana',patch:Parameters<typeof amount>[0],seconds:number)=>({kind:'over-time' as const,resource,amount:amount(patch),pulses:seconds,periodTicks:20});
/** Stage-keyed values decode (FNV-1a) as Stage1..Stage8; the table is read in stage order. */
const stages=(id:ArtifactId,names:readonly string[])=>{const v=values(id);return names.map(k=>Math.round(v[k]));};
const PROGRAMS:Partial<Record<ArtifactId,{readonly program?:ItemProgram;readonly isolatedEffects?:readonly Effect[];readonly text:string;readonly omitted?:string}>>={
 TFT4_Item_OrnnAnimaVisage:(()=>{const v=values('TFT4_Item_OrnnAnimaVisage');return {
  program:{periodic:[periodic(20,[{kind:'heal',amount:amount({maxHpBps:pct(v.PercentHealthRegen)})}])]},
  text:`每秒治疗${v.PercentHealthRegen}%最大生命值。`};})(),
 TFT4_Item_OrnnInfinityForce:{text:'只有属性。'},
 TFT4_Item_OrnnZhonyasParadox:(()=>{const v=values('TFT4_Item_OrnnZhonyasParadox'),d=ticks(v.InvulnDuration);return {
  program:{survival:[{...survival(pct(v.PercentHealthThreshold),[status('untargetable',10000,d,{activation:'immediate'}),status('damage-prevention',10000,d,{activation:'immediate'})]),id:'zhonya'}]},
  text:`每场战斗一次：生命值降到${v.PercentHealthThreshold}%时，免疫伤害且无法被选取${v.InvulnDuration}秒。`};})(),
 TFT9_Item_OrnnDeathfireGrasp:(()=>{const v=values('TFT9_Item_OrnnDeathfireGrasp'),blast=[damage('magic',{maxHpBps:pct(v.PercentMaxHealthDamage),hpBasis:'target'})],every=ticks(v.RepeatTime);return {
  // Tick 0 has no ordinary-attack target yet: the opening blast takes the nearest enemy, as target acquisition would.
  // {1543aa48} decodes (FNV-1a, lower-case) to StatDamageAmp: a stat-bar Damage Amp, like StatOmnivamp elsewhere.
  program:{modifiers:[modifier('damageAmp',Math.round(v['{1543aa48}']*10000),'bps')],triggers:[trigger({id:'opening-blast',event:'combat-start',selector:enemies({sample:'combat-start'}),effects:blast})],
   periodic:[periodic(every,blast,enemies({primary:'first-required',sample:'each-pulse'}),{startsAtTick:every})]},
  text:`开战时对当前目标（开战瞬间取最近敌人）造成其${v.PercentMaxHealthDamage}%最大生命值的魔法伤害，此后每${v.RepeatTime}秒对当前目标重复一次。伤害增幅${Math.round(v['{1543aa48}']*100)}%。`};})(),
 TFT_Item_Artifact_TalismanOfAscension:(()=>{const v=values('TFT_Item_Artifact_TalismanOfAscension'),at=ticks(v.Seconds);return {
  // One pulse at `at`: endsAtTick=at+1 removes the task on the following tick (no final pulse).
  program:{periodic:[periodic(at,[{kind:'change-max-hp',bonusBps:pct(v.MaxHealthPercent),currentHp:'add-max-delta',countsAsHeal:false},stat(modifier('damageAmp',Math.round(v.DamageAmp*10000),'bps'))],undefined,{startsAtTick:at,endsAtTick:at+1})]},
  text:`${v.Seconds}秒后获得${v.MaxHealthPercent}%最大生命值和${Math.round(v.DamageAmp*100)}%伤害增幅，持续到战斗结束。`};})(),
 TFT_Item_Artifact_Mittens:(()=>{const v=values('TFT_Item_Artifact_Mittens');return {
  program:{modifiers:[modifier('damageReduction',pct(v.PercentDR),'bps',undefined,filter())]},
  text:`受到的伤害降低${v.PercentDR}%。`,
  // {cd951938} decodes to StatDurability 0.25: the stat-bar form of the same 25%, applied once.
  omitted:'移动速度提升不执行（项目移动间隔全局固定）；冰冷免疫无对象（项目没有冰冷）。'};})(),
 TFT_Item_Artifact_RapidFirecannon:{
  program:{modifiers:[modifier('range',1,'hexes')],triggers:[trigger({id:'kill-range',event:'kill-or-assist',condition:killingBlow('holder'),effects:[grow(modifier('range',1,'hexes'))]})]},
  text:'攻击距离+1；携带者每亲手击杀一名敌人，再+1，持续到战斗结束。'},
 TFT_Item_Artifact_SeekersArmguard:(()=>{const v=values('TFT_Item_Artifact_SeekersArmguard'),gain=(n:number)=>(['armor','magicResist','abilityPower'] as const).map(s=>grow(modifier(s,n)));return {
  program:{triggers:[trigger({id:'assist',event:'kill-or-assist',actionLimitScope:'target',condition:killingBlow('other'),effects:gain(v.StatsPerTakedown)}),trigger({id:'kill',event:'kill-or-assist',actionLimitScope:'target',condition:killingBlow('holder'),effects:gain(v.StatsPerKill)})]},
  text:`参与击杀后护甲、魔抗、法强各+${v.StatsPerTakedown}；亲手击杀则改为+${v.StatsPerKill}。持续到战斗结束。`};})(),
 TFT_Item_Artifact_SilvermereDawn:(()=>{const v=values('TFT_Item_Artifact_SilvermereDawn');return {
  // Combat-long immunity uses the same 1201-tick bound as Deep Roots.
  program:{modifiers:[modifier('attackSpeedLock',Math.round(v.AttackSpeedCap*10000),'bps')],effects:[status('control-immunity',10000,1201,{activation:'immediate'})],
   triggers:[trigger({id:'stun',selector:enemies({candidates:'event-target'}),effects:[status('stun',10000,ticks(v.StunDuration),{activation:'immediate'})]})]},
  text:`免疫眩晕；普攻使目标眩晕${num(v.StunDuration)}秒；攻速锁定为每秒${num(v.AttackSpeedCap)}次。`};})(),
 TFT9_Item_OrnnHorizonFocus:(()=>{const v=values('TFT9_Item_OrnnHorizonFocus');return {
  // Hex count reads hexDistance, as the Sniper trait does: an adjacent target is one hex away.
  program:{modifiers:[modifier('range',Math.round(v.HexRangeIncrease),'hexes'),modifier('damageAmpPerHex',Math.round(v.DamageAmpPerHex*10000),'bps')]},
  text:`攻击距离+${v.HexRangeIncrease}；与目标每相距1格，伤害增幅+${Math.round(v.DamageAmpPerHex*100)}%（按格距计，与狙神羁绊相同）。`};})(),
 TFT9_Item_OrnnHullbreaker:(()=>{const v=values('TFT9_Item_OrnnHullbreaker');return {
  isolatedEffects:[{kind:'statFlat',stat:'maxHp',amount:v.ExtraHealth},{kind:'statPercentBps',stat:'attackDamage',bps:pct(v.ExtraADandAP)},{kind:'statFlat',stat:'abilityPower',amount:v.ExtraADandAP}],
  text:`开战时若身边没有相邻友军，获得${v.ExtraHealth}生命值、${v.ExtraADandAP}%攻击力和${v.ExtraADandAP}法术强度（按布阵站位判断）。`};})(),
 TFT_Item_Artifact_HorizonFocus:(()=>{const v=values('TFT_Item_Artifact_HorizonFocus');return {
  program:{triggers:[trigger({id:'lightning',event:'stun-applied',selector:enemies({candidates:'event-target'}),effects:[damage('magic',{maxHpBps:pct(v.PercentHealthDamage),hpBasis:'target'})]})]},
  text:`携带者眩晕敌人时，闪电劈中目标，造成其${v.PercentHealthDamage}%最大生命值的魔法伤害。`};})(),
 TFT_Item_Artifact_UnendingDespair:(()=>{const v=values('TFT_Item_Artifact_UnendingDespair');return {
  program:{triggers:[trigger({id:'despair',event:'shield-broken',maxPerAction:100,selector:enemies(),effects:[damage('magic',{shieldAbsorbedBps:pct(v.PercentDamage)})]})]},
  text:`携带者身上的护盾被打破时，对最近的敌人造成该护盾初始值${v.PercentDamage}%的魔法伤害（自然到期不算）。`};})(),
 TFT_Item_Artifact_InnervatingLocket:(()=>{const v=values('TFT_Item_Artifact_InnervatingLocket');return {
  program:{triggers:[trigger({id:'hit-mana',event:'incoming-basic-hit',listener:self('target'),effects:[{kind:'grant-mana',amount:0,reason:'incoming-basic-hit',bypassLock:'none',maxManaBps:pct(v.PercentMana)}]}),
   trigger({id:'cast-heal',event:'cast-completed',effects:[over('heal',{maxHpBps:pct(v.PercentHealth)},v.Duration)]})]},
  text:`被普攻命中时回复${v.PercentMana}%最大法力值（四舍五入到整数）；每次施法后在${v.Duration}秒内回复${v.PercentHealth}%最大生命值（每秒一跳）。`};})(),
 TFT4_Item_OrnnMuramana:(()=>{const v=values('TFT4_Item_OrnnMuramana');return {
  program:{triggers:[trigger({id:'first-cast',event:'cast-completed',maxPerCombat:1,effects:[over('mana',{flat:v.ManaRestore},v.ManaDuration)]})]},
  text:`本场第一次施法后，在${v.ManaDuration}秒内回复${v.ManaRestore}法力值（每秒一跳）。`};})(),
 TFT_Item_Artifact_LudensTempest:(()=>{const v=values('TFT_Item_Artifact_LudensTempest');return {
  program:{triggers:[trigger({id:'overkill',event:'damage-dealt',condition:{kind:'killed-target'},maxPerAction:100,selector:enemies({anchor:'event-target',maxTargets:3}),
   effects:[damage('magic',{flat:v.BaseDamage,overkillBps:pct(v.PercentOfOverkill)})]})]},
  text:`携带者击杀敌人时，把${v.PercentOfOverkill}%超杀伤害加${v.BaseDamage}点，作为魔法伤害分别打向离目标最近的3名敌人。`};})(),
 TFT_Item_Artifact_BlightingJewel:(()=>{const v=values('TFT_Item_Artifact_BlightingJewel'),magic={kind:'damage-type' as const,damageType:'magic' as const};return {
  program:{triggers:[trigger({id:'shred',event:'damage-dealt',condition:{kind:'all',conditions:[magic,{kind:'target-magic-resist',op:'gt',value:0}]},selector:enemies({candidates:'event-target'}),
    effects:[grow(modifier('magicResist',-Math.round(v.MRReduction)))]}),
   trigger({id:'mana',event:'damage-dealt',condition:{kind:'all',conditions:[magic,{kind:'target-magic-resist',op:'lte',value:0}]},effects:[mana(Math.round(v.ManaGain),'attack')]})]},
  text:`每次造成魔法伤害使目标魔抗-${v.MRReduction}（可叠加，持续到战斗结束）；若目标魔抗已为0，改为携带者回复${v.ManaGain}法力值。`};})(),
 TFT_Item_Artifact_LightshieldCrest:(()=>{const v=values('TFT_Item_Artifact_LightshieldCrest'),
  grant={kind:'grant-shield' as const,amount:amount({resistsBps:pct(v.PercentOfResists)}),durationTicks:ticks(v.ShieldDuration),decay:{kind:'none' as const},onEnd:[],endTiming:'post-damage' as const,endTargeting:{kind:'select' as const,selector:selector()},endEffects:[]};return {
  program:{periodic:[periodic(ticks(v.TriggerRate),[grant],selector({relation:'ally',order:'hp-ratio-id',sample:'each-pulse'}))],
   triggers:[trigger({id:'death',event:'holder-death',selector:selector({relation:'ally',excludeSelf:true,maxTargets:100,order:'id'}),effects:[grant]})]},
  text:`每${v.TriggerRate}秒为生命百分比最低的友军提供护盾，数值为携带者护甲与魔抗之和的${v.PercentOfResists}%，持续${v.ShieldDuration}秒；携带者阵亡时为所有友军提供同样的护盾。`};})(),
 TFT_Item_Artifact_ProwlersClaw:(()=>{const v=values('TFT_Item_Artifact_ProwlersClaw');return {
  program:{triggers:[trigger({id:'kill-cleanse',event:'kill-or-assist',condition:killingBlow('holder'),effects:[{kind:'cleanse',remove:'removable-hostile-control-dot-debuff',retarget:true}]}),
   trigger({id:'kill-dash',event:'kill-or-assist',condition:killingBlow('holder'),selector:enemies({order:'farthest-id',radius:Math.round(v.HexRange)}),effects:[{kind:'leap'}]}),
   trigger({id:'crit-charges',event:'damage-dealt',condition:{kind:'critical-attack'},
    counters:[{id:'charges',events:[{event:'kill-or-assist',listener:self(),qualifies:'killing-blow',refill:true}],scope:'source-instance',reset:'combat-start',cap:2}],
    gate:{kind:'consume-counter',counterId:'charges',critDamageBps:pct(v.CritDamageBonusPercent)},effects:[]})]},
  text:`亲手击杀后，移除自身负面效果并立即跳到${v.HexRange}格内最远的敌人身边；之后的2次暴击普攻额外+${v.CritDamageBonusPercent}%暴击伤害。`};})(),
 TFT_Item_Artifact_WitsEnd:(()=>{const v=values('TFT_Item_Artifact_WitsEnd');return {
  program:{byStage:{flat:stages('TFT_Item_Artifact_WitsEnd',['{58f90eac}','{5bf91365}','{5af911d2}','{55f909f3}','{54f90860}','{57f90d19}','{56f90b86}','{61f91cd7}'])},
   triggers:[trigger({id:'on-hit',selector:enemies({candidates:'event-target'}),effects:[extra({})]})],
   vamp:[{modifier:modifier('omnivamp',pct(v.PercentHealing),'bps'),allyBps:0,allyCondition:always,damageTypes:['magic']}]},
  text:`普攻额外造成魔法伤害（按对局阶段：42/42/60/75/90/100/100/100）；按造成的魔法伤害的${v.PercentHealing}%治疗自己。`};})(),
 TFT_Item_Artifact_LichBane:{
  program:{byStage:{flat:stages('TFT_Item_Artifact_LichBane',['{a46d51dd}','{a16d4d24}','{a26d4eb7}','{9f6d49fe}','{a06d4b91}','{9d6d46d8}','{9e6d486b}','{9b6d43b2}'])},
   triggers:[trigger({id:'empowered',counters:[{id:'cast',events:[{event:'cast-completed',listener:self(),qualifies:'completed-event'}],scope:'source-instance',reset:'combat-start',cap:1}],
    gate:{kind:'consume-counter',counterId:'cast'},selector:enemies({candidates:'event-target'}),effects:[extra({})]})]},
  text:'每次施法后的第一次普攻额外造成魔法伤害（按对局阶段：200/200/270/340/410/480/480/480）。'},
};
/** 约定值 G24-ARTIFACT-SUBSET-01: artifacts outside PROGRAMS are not yet executable and are not registered. */
export const G24_ARTIFACT_ITEMS:Readonly<Record<string,ItemDefinition>>=freezeContent(Object.fromEntries(Object.entries(PROGRAMS).map(([id,entry])=>{
 const s=G24_ARTIFACT_SOURCE[id as ArtifactId];
 // Crit chance is a combat-program modifier (as for G2-3 reward items), compiled into the spell-crit authorization.
 const crit=values(id as ArtifactId).CritChance,program=crit&&entry!.program?{...entry!.program,modifiers:[modifier('critChance',pct(crit),'bps'),...entry!.program.modifiers??[]]}:entry!.program;
 return [id,{id,apiName:id,name:s.zhName,kind:'completed',evidenceStatus:'approved-provisional',unique:s.unique,slotCost:1,effects:sourceStats(id as ArtifactId),...program?{combatProgram:program}:{},...entry!.isolatedEffects?{isolatedEffects:entry!.isolatedEffects}:{},
  conventionIds:['G24-ARTIFACT-SUBSET-01'],effectDescriptions:['神器：'+entry!.text,...entry!.omitted?['未执行部分：'+entry!.omitted]:[]]} satisfies ItemDefinition];
})));
export const G24_ARTIFACT_PENDING=freezeContent(Object.keys(G24_ARTIFACT_SOURCE).filter(id=>!Object.hasOwn(G24_ARTIFACT_ITEMS,id)).sort());
