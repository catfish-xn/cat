import type { NeutralDefinition } from './neutrals';
import type { NeutralEncounterDefinition } from './neutral-encounters';
import { CRAB_GROUPS, GIANT_CRAB_HEALTH, GIANT_CRAB_ARMOR, GIANT_CRAB_MAGIC_RESIST, GIANT_CRAB_FROM_STAGE } from './opening-batch-b';
import { freezeContent } from './freeze';
const hp=[...new Set(Object.values(CRAB_GROUPS).flatMap(g=>g.map(x=>x[2])))];
const definition=(health:number,giant=false):NeutralDefinition=>({id:giant?'pve-giant-crab':`pve-scuttle-${health}`,name:giant?'危险巨蟹':'迅捷蟹',unitKind:'neutral',monsterFamily:giant?'giant-crab':'scuttle',starLevel:1,health,
 attack:20,baseAttackSpeedBps:8000,armor:giant?GIANT_CRAB_ARMOR:10,magicResist:giant?GIANT_CRAB_MAGIC_RESIST:10,
 attackRange:1,abilityPower:100,initialMana:0,maxMana:0,baseCritChanceBps:2500,baseCritMultiplierBps:14000,traits:[],equipment:[],mechanism:{kind:'none'}});
export const CRAB_DEFINITIONS=freezeContent(Object.fromEntries([...hp.map(h=>definition(h)),definition(GIANT_CRAB_HEALTH,true)].map(d=>[d.id,d])));
export const CRAB_ENCOUNTERS:readonly NeutralEncounterDefinition[]=freezeContent(['scuttle-puddle','crab-rave'].flatMap(id=>Object.entries(CRAB_GROUPS).map(([roundId,group])=>({roundId,encounterId:`${id}/${roundId}`,
 slots:group.map(([row,col,health],i)=>({slotId:`c${i}`,definitionId:id==='crab-rave'&&Number(roundId[0])>=GIANT_CRAB_FROM_STAGE?'pve-giant-crab':`pve-scuttle-${health}`,cell:{col:col-1,row:8-row}}))}))));
