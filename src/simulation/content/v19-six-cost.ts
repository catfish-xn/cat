import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';
import type { TraitDefinition } from '../strategy-types';

/** Local 14.24 archive with 12/17 B overrides. Missing execution details are explicitly custom; see V19_PART2.md. */
export const SIX_COST_POLICY = freezeContent({
  version:'v19-six-cost-custom-v1', copies:9, threeStarBps:36000,
  odds:{unlockRoundId:'4-6',initialBps:20,perRoundBps:4,level10Bps:160,source:'非官方数值'},
  viktor:{conversion:'1-extra-AD/1-AS-percentage-point/1-extra-mana-to-1-AP',speedBps:5500,initialEnergy:3,maxEnergy:8},
  warwick:{executeBps:1500,heal:400,mana:50,frenzyTicks:80,speedBps:4000,moveSpeedBps:5000,permanentKills:5},
  mel:{shieldTicks:80,absorbBps:5000,dashRadius:2,saveCasts:12,savedAmpBps:1000,bolts:10},
});
export const SIX_COST_UNITS:Readonly<Record<string,UnitDefinition>>=freezeContent(Object.fromEntries([
  {id:'warwick',name:'沃里克',symbol:'狼',health:2100,attack:110,resist:70,speed:9000,range:1,mana:60,maxMana:100,traits:['experiment','blood-hunter']},
  {id:'viktor',name:'维克托',symbol:'维',health:1600,attack:100,resist:40,speed:5500,range:4,mana:0,maxMana:100,traits:['machine-herald']},
  {id:'mel',name:'梅尔',symbol:'梅',health:1800,attack:80,resist:60,speed:8000,range:3,mana:0,maxMana:40,traits:['banished-mage']},
].map(u=>[u.id,{id:u.id,name:u.name,symbol:u.symbol,color:0xe0b95b,cost:6,baseStats:{health:u.health,attack:u.attack,armor:u.resist,magicResist:u.resist},
  attackRange:u.range,attackIntervalTicks:Math.ceil(200000/u.speed),baseAttackSpeedBps:u.speed,initialMana:u.mana,maxMana:u.maxMana,abilityId:u.id+'-ability',traits:u.traits}])));
export const SIX_COST_ABILITIES:Readonly<Record<string,S13AbilityData>>=freezeContent({
  'warwick-ability':{id:'warwick-ability',championId:'warwick',name:'鲜血追猎',variables:{BaseDamage:[180,300,1088],ADRatio:[2,3.75,25],Vamp:[0.10,0.15,1]},description:'嗜血4秒，攻速+40%；每秒造成基础伤害＋攻击力×攻速系数的物理伤害。吞噬严格低于15%生命的敌人，治疗400并回复50法力；五次击杀后永久嗜血且不可阻挡。移速+50%等执行参数为魔改。'},
  'viktor-ability':{id:'viktor-ability',championId:'viktor',name:'混乱风暴',variables:{RayMagic:[50,180,2000],RayTrue:[25,90,1000],StormDamage:[100,300,9999],StormHp:[0.08,0.20,1],StunSeconds:[2,3,30]},description:'固定0.55攻速；每次攻击发射2格直线死亡射线并获得1混沌能量。8能量击飞全体敌人，落地造成魔法伤害。额外攻击力、攻速及法力1:1转法强（魔改）。'},
  'mel-ability':{id:'mel-ability',championId:'mel',name:'魔法导管',variables:{Shield:[300,600,10000],Damage:[180,450,2700],ThirdDamage:[1390,3475,99999]},description:'冲刺后自身及附近2友军获得护盾，对附近3敌发射弹幕；自身护盾吸收伤害的50%储能，每第三次施法由至多5敌均摊储能爆发。盾4秒、冲刺2格等执行为魔改；PvP累计12次施法后全局仅一次免于淘汰至1生命。'},
});
export const SIX_COST_TRAITS:Readonly<Record<string,TraitDefinition>>=freezeContent(Object.fromEntries([
  ['blood-hunter','祖安怒兽','低于15%生命的敌人可被沃里克吞噬。'],['machine-herald','机械先驱','固定攻速；额外攻击力、攻速、法力转法强（魔改1:1）。'],['banished-mage','放逐法师','PvP累计12次施法后，整局一次致死救至1玩家生命；之后梅尔增伤10%。'],
].map(([id,name,description])=>[id,{id,name,target:'members',tiers:[{threshold:1,effects:[{kind:'mechanic',mechanic:'g23Trait',values:{tier:1}}]}],description}])));
