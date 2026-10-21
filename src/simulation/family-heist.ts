import { nextRandom } from './rng';
import { freezeContent } from './content/freeze';
import { COMPONENT_POOL } from './component-pool';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import type { LootPayload } from './m8/contracts';
import type { G23MatchProgress } from './g2-3-match-progress';

export const FAMILY_HEIST_POLICY=freezeContent({version:'v19-family-heist-custom-v1',seedXor:0x66616d35,weights:'16-equal-repeatable',carry:'subtract-current-target-once-per-pvp',activation:'first-family5-preparation',dropBelow5:'pause-and-retain',stageReset:false});
export const FAMILY_REWARDS=freezeContent([
  {key:'3TrainingDummies',target:10,name:'训练假人替代：10 金（魔改）'},
  {key:'ViJinx',target:10,name:'1星成年蔚 + 1星金克丝'},
  {key:'Spatula',target:10,name:'金铲铲'}, {key:'FryingPan',target:10,name:'金锅铲'},
  {key:'ThievesGloves',target:17,name:'窃贼手套'}, {key:'3LesserDuplicators',target:17,name:'3个次级英雄复制器'},
  {key:'2randomComponents',target:17,name:'2件随机基础装备'}, {key:'Fishbones',target:17,name:'鱼骨头'},
  {key:'20Gold',target:20,name:'20金币'}, {key:'RandomArtifact',target:20,name:'随机神器'},
  {key:'PitFighterEmblem',target:20,name:'搏击手纹章'}, {key:'AmbusherEmblem',target:20,name:'伏击专家纹章'},
  {key:'WatcherEmblem',target:20,name:'监察纹章'}, {key:'30Gold',target:30,name:'30金币'},
  {key:'2starViJinx',target:30,name:'2星成年蔚 + 2星金克丝'}, {key:'3randomComponents',target:30,name:'3件随机基础装备'},
]);
export interface FamilyTask {
  readonly CurrentReward:string;readonly CurrentProgress:number;readonly CurrentRewardValue:number;
  readonly sequence:number;readonly payloads:readonly LootPayload[];readonly rngState:number;readonly rngDraws:number;
}
function roll(rngState:number,rngDraws:number,sequence:number,progress:number):FamilyTask {
  const draw=(length:number)=>{const r=nextRandom(rngState);rngState=r.state;rngDraws++;return Math.floor(r.word*length/4294967296);};
  const row=FAMILY_REWARDS[draw(16)],payloads:LootPayload[]=[];
  const item=(definitionId:string)=>payloads.push({kind:'item',definitionId,quantity:1});
  const gold=(quantity:number)=>payloads.push({kind:'gold',quantity});
  const components=()=>{for(let i=0;i<(row.key==='2randomComponents'?2:3);i++)item(COMPONENT_POOL[draw(COMPONENT_POOL.length)].definitionId);};
  switch(row.key){
    case '3TrainingDummies':gold(10);break;
    case 'ViJinx':case '2starViJinx':for(const definitionId of ['vi','jinx'])payloads.push({kind:'unit',definitionId,quantity:1,starLevel:row.key==='ViJinx'?1:2});break;
    case 'Spatula':item('spatula');break;case 'FryingPan':item('frying-pan');break;
    case 'ThievesGloves':item('thiefs-gloves');break;
    case '3LesserDuplicators':for(let i=0;i<3;i++)payloads.push({kind:'consumable',definitionId:'TFT_Consumable_ChampionDuplicator_III',quantity:1});break;
    case '2randomComponents':case '3randomComponents':components();break;
    case 'Fishbones':item('TFT_Item_Artifact_Fishbones');break;
    case '20Gold':gold(20);break;case '30Gold':gold(30);break;
    case 'RandomArtifact':item(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[draw(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn.length)]);break;
    case 'PitFighterEmblem':item('TFT13_Item_PitFighterEmblemItem');break;
    case 'AmbusherEmblem':item('TFT13_Item_AmbusherEmblemItem');break;
    case 'WatcherEmblem':item('TFT13_Item_WatcherEmblemItem');break;
  }
  return {CurrentReward:row.key,CurrentProgress:progress,CurrentRewardValue:row.target,sequence,payloads,rngState,rngDraws};
}
export function initialFamilyTask(seed:number):FamilyTask{return roll((seed^FAMILY_HEIST_POLICY.seedXor)>>>0,0,1,0);}
export function familyTaskAt(seed:number,sequence:number):FamilyTask {
  if(!Number.isSafeInteger(sequence)||sequence<1||sequence>100)throw new RangeError('Invalid family task sequence');
  let task=initialFamilyTask(seed);while(task.sequence<sequence)task=nextFamilyTask(task,0);return task;
}
export function nextFamilyTask(task:FamilyTask,progress:number):FamilyTask{return roll(task.rngState,task.rngDraws,task.sequence+1,progress);}
export function activateFamily(p:G23MatchProgress,round:number):G23MatchProgress {
  return p.family?p:{...p,family:initialFamilyTask(p.seed),economyReceipts:[...p.economyReceipts,{kind:'family-start',round}]};
}
export function familyDisplay(task:FamilyTask|undefined){
  if(!task)return null;
  const row=FAMILY_REWARDS.find(r=>r.key===task.CurrentReward)!;
  return {CurrentReward:task.CurrentReward,CurrentProgress:task.CurrentProgress,CurrentRewardValue:task.CurrentRewardValue,currentRewardName:row.name,
    progressText:`${task.CurrentProgress}/${task.CurrentRewardValue}；当前奖励：${row.name}`,policy:'未验证/魔改：等权、余量结转、每战一次、暂停保留'};
}
