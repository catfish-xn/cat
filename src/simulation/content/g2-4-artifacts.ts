/** G2-4b artifacts, first subset: only those whose source text is expressible in the existing item
 * program vocabulary. Every number reads G24_ARTIFACT_SOURCE; the rest of the pool lands later. */
import type {Effect,ItemDefinition} from '../strategy-types';
import type {ItemProgram} from '../m8/item-program';
import {G24_ARTIFACT_SOURCE} from './g2-4-artifact-source';
import {amount,damage,enemies,filter,modifier,periodic,stat,status,survival,trigger} from './item-programs';
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
const ticks=(seconds:number)=>Math.round(seconds*20),pct=(percent:number)=>Math.round(percent*100);
const PROGRAMS:Partial<Record<ArtifactId,{readonly program?:ItemProgram;readonly text:string;readonly omitted?:string}>>={
 TFT4_Item_OrnnAnimaVisage:(()=>{const v=values('TFT4_Item_OrnnAnimaVisage');return {
  program:{periodic:[periodic(20,[{kind:'heal',amount:amount({maxHpBps:pct(v.PercentHealthRegen)})}])]},
  text:`每秒治疗${v.PercentHealthRegen}%最大生命值。`};})(),
 TFT4_Item_OrnnInfinityForce:{text:'只有属性。'},
 TFT4_Item_OrnnZhonyasParadox:(()=>{const v=values('TFT4_Item_OrnnZhonyasParadox'),d=ticks(v.InvulnDuration);return {
  program:{survival:[{...survival(pct(v.PercentHealthThreshold),[status('untargetable',10000,d,{activation:'immediate'}),status('damage-prevention',10000,d,{activation:'immediate'})]),id:'zhonya'}]},
  text:`每场战斗一次：生命值降到${v.PercentHealthThreshold}%时，免疫伤害且无法被选取${v.InvulnDuration}秒。`};})(),
 TFT9_Item_OrnnDeathfireGrasp:(()=>{const v=values('TFT9_Item_OrnnDeathfireGrasp'),blast=[damage('magic',{maxHpBps:pct(v.PercentMaxHealthDamage),hpBasis:'target'})],every=ticks(v.RepeatTime);return {
  // Tick 0 has no ordinary-attack target yet: the opening blast takes the nearest enemy, as target acquisition would.
  program:{triggers:[trigger({id:'opening-blast',event:'combat-start',selector:enemies({sample:'combat-start'}),effects:blast})],
   periodic:[periodic(every,blast,enemies({primary:'first-required',sample:'each-pulse'}),{startsAtTick:every})]},
  text:`开战时对当前目标（开战瞬间取最近敌人）造成其${v.PercentMaxHealthDamage}%最大生命值的魔法伤害，此后每${v.RepeatTime}秒对当前目标重复一次。`,
  omitted:'源数据未命名键 {1543aa48}=0.25 不执行（14.24 描述未提及）。'};})(),
 TFT_Item_Artifact_TalismanOfAscension:(()=>{const v=values('TFT_Item_Artifact_TalismanOfAscension'),at=ticks(v.Seconds);return {
  // One pulse at `at`: endsAtTick=at+1 removes the task on the following tick (no final pulse).
  program:{periodic:[periodic(at,[{kind:'change-max-hp',bonusBps:pct(v.MaxHealthPercent),currentHp:'add-max-delta',countsAsHeal:false},stat(modifier('damageAmp',Math.round(v.DamageAmp*10000),'bps'))],undefined,{startsAtTick:at,endsAtTick:at+1})]},
  text:`${v.Seconds}秒后获得${v.MaxHealthPercent}%最大生命值和${Math.round(v.DamageAmp*100)}%伤害增幅，持续到战斗结束。`};})(),
 TFT_Item_Artifact_Mittens:(()=>{const v=values('TFT_Item_Artifact_Mittens');return {
  program:{modifiers:[modifier('damageReduction',pct(v.PercentDR),'bps',undefined,filter())]},
  text:`受到的伤害降低${v.PercentDR}%。`,
  omitted:'移动速度提升不执行（项目移动间隔全局固定）；冰冷免疫无对象（项目没有冰冷）；未命名键 {cd951938}=0.25 不执行。'};})(),
};
/** 约定值 G24-ARTIFACT-SUBSET-01: artifacts outside PROGRAMS are not yet executable and are not registered. */
export const G24_ARTIFACT_ITEMS:Readonly<Record<string,ItemDefinition>>=freezeContent(Object.fromEntries(Object.entries(PROGRAMS).map(([id,entry])=>{
 const s=G24_ARTIFACT_SOURCE[id as ArtifactId];
 return [id,{id,apiName:id,name:s.zhName,kind:'completed',evidenceStatus:'approved-provisional',unique:s.unique,slotCost:1,effects:sourceStats(id as ArtifactId),...entry!.program?{combatProgram:entry!.program}:{},
  conventionIds:['G24-ARTIFACT-SUBSET-01'],effectDescriptions:['神器：'+entry!.text,...entry!.omitted?['未执行部分：'+entry!.omitted]:[]]} satisfies ItemDefinition];
})));
export const G24_ARTIFACT_PENDING=freezeContent(Object.keys(G24_ARTIFACT_SOURCE).filter(id=>!Object.hasOwn(G24_ARTIFACT_ITEMS,id)).sort());
