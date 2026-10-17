import { freezeContent } from './freeze';
import type { ItemDefinition } from '../strategy-types';
import {modifier,vamp} from './item-programs';

/** WIP runtime entries. Values: archived 14.24 map22,
 * Maps/Shipping/Map22/Items/TFT_Item_Artifact_Fishbones; source pins in normalized
 * g2-4b-mechanism-items.json. Only the entries below are current runtime claims.
 */
export const G24_MECHANISM_ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent({
  TFT_Item_Artifact_Fishbones: {
    id: 'TFT_Item_Artifact_Fishbones', apiName: 'TFT_Item_Artifact_Fishbones', name: '鱼骨头',
    kind: 'completed', unique: false, slotCost: 1, evidenceStatus: 'approved-provisional',
    conventionIds: ['G24-FISHBONES-TARGET-01'],
    effects: [
      {kind: 'statPercentBps', stat: 'attackDamage', bps: 4000},
      {kind: 'attackSpeedBps', bps: 4000},
      {kind: 'mechanic', mechanic: 'g24Fishbones', values: {rangeMultiplier: 2}},
    ],
    effectDescriptions: ['攻击距离翻倍，每次攻击从有效攻击距离内的敌人中随机选取目标（目标范围为用户批准约定）。'],
  },
  TFT_Item_Artifact_SpectralCutlass: {
    id:'TFT_Item_Artifact_SpectralCutlass',apiName:'TFT_Item_Artifact_SpectralCutlass',name:'幽魂弯刀',
    kind:'completed',unique:false,slotCost:1,evidenceStatus:'approved-provisional',
    conventionIds:['G24-CUTLASS-CELL-01'],
    effects:[{kind:'statPercentBps',stat:'attackDamage',bps:4000},
      {kind:'statFlat',stat:'armor',amount:40},{kind:'statFlat',stat:'magicResist',amount:40},
      {kind:'mechanic',mechanic:'g24SpectralCutlass',values:{durationTicks:160}}],
    combatProgram:{modifiers:[modifier('critChance',2000,'bps')]},
    effectDescriptions:['开局传送到敌方镜像格，8秒后返回。占位时选最近空格（用户批准约定）。'],
  },
  TFT_Item_Shroud: {
    id:'TFT_Item_Shroud',apiName:'TFT_Item_Shroud',name:'静止法衣',kind:'completed',unique:true,slotCost:1,
    evidenceStatus:'approved-provisional',conventionIds:['G24-SHROUD-BEAM-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:150},
      {kind:'mechanic',mechanic:'g24Shroud',values:{costIncreaseBps:3000,allyHealth:60}}],
    effectDescriptions:['开局光束使敌人最大法力增加30%直到首次施法。全队获得60生命。光束宽度为用户批准约定。'],
  },
  TFT4_Item_OrnnDeathsDefiance: {
    id:'TFT4_Item_OrnnDeathsDefiance',apiName:'TFT4_Item_OrnnDeathsDefiance',name:'死亡之蔑',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',
    conventionIds:['G24-DEFIANCE-ORDER-01'],
    effects:[{kind:'statPercentBps',stat:'attackDamage',bps:1000},
      {kind:'statFlat',stat:'armor',amount:30},{kind:'attackSpeedBps',bps:2500},
      {kind:'mechanic',mechanic:'g24DeathsDefiance',values:{fractionBps:5000,durationTicks:80}}],
    combatProgram:{vamp:[vamp(2500)]},
    effectDescriptions:['受到伤害的50%转为4秒非致命持续扣血；护盾之后计算、逐tick分摊为用户批准约定。'],
  },
  TFT9_Item_OrnnTrickstersGlass: {
    id:'TFT9_Item_OrnnTrickstersGlass',apiName:'TFT9_Item_OrnnTrickstersGlass',name:'诡术师之镜',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',
    conventionIds:['G24-MIRROR-INHERIT-01','G24-SUMMON-CELL-01'],
    effects:[{kind:'statFlat',stat:'armor',amount:10},{kind:'statFlat',stat:'magicResist',amount:10},
      {kind:'attackSpeedBps',bps:1000},{kind:'mechanic',mechanic:'g24Mirror',values:{healthBps:7000,manaIncreaseBps:1000}}],
    combatProgram:{modifiers:[modifier('critChance',1500,'bps')]},
    effectDescriptions:['召唤70%最大生命、最大法力增加10%的复制体，继承已激活羁绊。其余继承与放置规则为用户批准约定。'],
  },
  TFT_Item_Artifact_SuspiciousTrenchCoat: {
    id:'TFT_Item_Artifact_SuspiciousTrenchCoat',apiName:'TFT_Item_Artifact_SuspiciousTrenchCoat',name:'迷离风衣',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',conventionIds:['G24-TRENCH-INHERIT-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:100},{kind:'attackSpeedBps',bps:1500},
      {kind:'mechanic',mechanic:'g24Trench',values:{thresholdBps:5000,healthBps:3000}}],
    effectDescriptions:['每场战斗首次存活降到50%生命时，由三个新身份复制体替换，每个满生命且最大生命为持有者触发时最大生命的30%。继承静态声明，重置临时状态，风衣不递归。'],
  },
  TFT4_Item_OrnnTheCollector: {
    id:'TFT4_Item_OrnnTheCollector',apiName:'TFT4_Item_OrnnTheCollector',name:'金币收集者',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',
    conventionIds:['G24-COLLECTOR-EXECUTE-01','G24-ITEM-GOLD-01'],
    effects:[{kind:'statPercentBps',stat:'attackDamage',bps:3000},
      {kind:'mechanic',mechanic:'g24Collector',values:{executeBps:1200}}],
    combatProgram:{modifiers:[modifier('critChance',3000,'bps')]},
    effectDescriptions:['攻击和技能处决低于12%最大生命的目标；处决有40%几率掉1金币，结算统一入账。'],
  },
  TFT7_Item_ShimmerscaleGamblersBlade: {
    id:'TFT7_Item_ShimmerscaleGamblersBlade',apiName:'TFT7_Item_ShimmerscaleGamblersBlade',name:'投机者之刃',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',conventionIds:['G24-ITEM-GOLD-01'],
    effects:[{kind:'statFlat',stat:'abilityPower',amount:10},{kind:'attackSpeedBps',bps:4500},
      {kind:'mechanic',mechanic:'g24Gambler',values:{goldLimit:30,speedPerGoldBps:100}}],
    effectDescriptions:['每金币增加1%攻速，最多30金币；每次攻击5%几率掉1金币。战斗内掉金计入攻速、结算入账为用户批准约定。'],
  },
  TFT7_Item_ShimmerscaleMogulsMail: {
    id:'TFT7_Item_ShimmerscaleMogulsMail',apiName:'TFT7_Item_ShimmerscaleMogulsMail',name:'大亨之铠',
    kind:'completed',unique:true,slotCost:1,evidenceStatus:'approved-provisional',conventionIds:['G24-MOGUL-STACK-01','G24-ITEM-GOLD-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:50},
      {kind:'mechanic',mechanic:'g24Mogul',values:{stackCap:35,healthPerStack:7,resistPerStack:1,goldIntervalTicks:160}}],
    effectDescriptions:['承受伤害时获得7生命和1双抗，最多35层；满层获得1金币，此后每8秒获得1金币。'],
  },
  TFT_Item_Zephyr: {
    id:'TFT_Item_Zephyr',apiName:'TFT_Item_Zephyr',name:'灵风',kind:'completed',unique:true,slotCost:1,
    evidenceStatus:'approved-provisional',conventionIds:['G24-ZEPHYR-ABSENCE-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:150},
      {kind:'mechanic',mechanic:'g24Zephyr',values:{durationTicks:100,allyAttackSpeedBps:200}}],
    effectDescriptions:['开局将镜像飓风最近的敌人移出战斗5秒，无视控制免疫；全队获得2%攻速。碰撞与多件顺序为用户批准约定。'],
  },
  TFT5_Item_ZzRotPortalRadiant: {
    id:'TFT5_Item_ZzRotPortalRadiant',apiName:'TFT5_Item_ZzRotPortalRadiant',name:'兹若特传送门',kind:'completed',unique:true,slotCost:1,
    evidenceStatus:'approved-provisional',conventionIds:['G24-VOIDSPAWN-STAGES-01','G24-SUMMON-CELL-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:150}],
    effectDescriptions:['备战阶段召唤可移动、随阶段成长的虚空生物；阶段表沿用14.6/14.7公告，边界阶段与碰撞为用户批准约定。'],
  },
});
