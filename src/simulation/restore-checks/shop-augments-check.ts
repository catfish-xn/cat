// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { AUGMENT_SHOP, type ShopAugmentRule, shopAugmentValue } from '../content/augment-pool-shop';
import { SHOP_CATALOG } from '../match-rules';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { owned, receiptId, REINFORCED_COST, SHOP_AUGMENT_KEY, SHOP_AUGMENT_SOURCE, type ShopAugmentRecord, ticketHit } from '../shop-augments';
import { UNIT_DEFINITIONS } from '../units';

const RECORD_KEYS=['credits','rolls','rigAnchor','reinforced'];

const isStageStart=(round:number)=>getMultiplayerRoundByOrdinal(round).subround===1;

function ticketCredits(state:Pick<MatchState,'seed'|'multiplayer'|'augments'>,rolls:number):number {
 const a=owned(state,'ticket')[0];if(!a)return 0;
 let n=0;for(let i=0;i<rolls;i++)if(ticketHit(state,a,i))n++;return n;
}

/* ---------------- restore ---------------- */

export function validateShopAugments(state:MatchState):void {
 const fail=(why:string)=>{throw new RangeError(`Invalid shop augment authority: ${why}`);};
 const raw=state.seatMechanics?.seat[SHOP_AUGMENT_KEY] as Record<string,unknown>|undefined;
 const int=(n:unknown,min=0):n is number=>Number.isSafeInteger(n)&&(n as number)>=min;
 if(raw!==undefined){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!RECORD_KEYS.includes(k))||!int(raw.credits))fail('record');
 }
 const r=(raw??{credits:0}) as unknown as ShopAugmentRecord;
 const ticket=owned(state,'ticket')[0],rigged=owned(state,'rigged')[0],reinforce=owned(state,'reinfourcement')[0];
 if(owned(state,'ticket').length>1)fail('duplicate');
 if(r.rolls!==undefined&&(!ticket||!int(r.rolls,1)||r.rolls>state.shop.generation))fail('rolls');
 if(r.rigAnchor!==undefined&&(!rigged||!int(r.rigAnchor,1)||r.rigAnchor>state.shop.generation))fail('rig anchor');
 if(r.credits!==ticketCredits(state,r.rolls??0))fail('credits');
 // ReinFOURcement: the marked purchase is the first such purchase after acquisition; its two copies are receipted.
 let reinforced:string|undefined;
 if(r.reinforced!==undefined){
  const fact=state.resourceProvenance.entries[r.reinforced as number];
  if(!reinforce||!int(r.reinforced)||fact?.kind!=='unit-acquired'||fact.source.kind!=='shop'||UNIT_DEFINITIONS[fact.source.definitionId]?.cost!==REINFORCED_COST
   ||getMultiplayerRoundById(fact.roundId).ordinal<reinforce.acquiredRound)fail('reinforced');
  reinforced=(fact as {source:{definitionId:string}}).source.definitionId;
 }else if(reinforce&&state.multiplayer&&state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&UNIT_DEFINITIONS[e.source.definitionId]?.cost===REINFORCED_COST&&getMultiplayerRoundById(e.roundId).ordinal>reinforce.acquiredRound))fail('missing reinforced');
 const receipts=state.seatMechanics?.receipts??[];
 for(const receipt of receipts){
  if(receipt.source!==SHOP_AUGMENT_SOURCE&&!receipt.receiptId.startsWith(`["${SHOP_AUGMENT_SOURCE}",`))continue;
  let parts:unknown;try{parts=JSON.parse(receipt.receiptId);}catch{fail('receipt id');}
  const [source,rule,choiceId,n]=parts as [string,ShopAugmentRule,string,number];
  const a=state.augments.find(a=>a.choiceId===choiceId&&AUGMENT_SHOP[a.definitionId]?.rule===rule);
  if(receipt.source!==SHOP_AUGMENT_SOURCE||source!==SHOP_AUGMENT_SOURCE||!Array.isArray(parts)||parts.length!==4||!a||!int(n))fail('receipt');
  const own=a!;
  if(rule==='subscription'){if(receipt.kind!=='gold'||receipt.amount!==shopAugmentValue(own.definitionId,'GoldPerStage')||receipt.round!==n||n<=own.acquiredRound||n>state.round||!isStageStart(n))fail('subscription gold');}
  else if(rule==='firesale'){if(receipt.kind!=='unit'||![1,2].includes(receipt.starLevel??1)||receipt.starLevel===2&&UNIT_DEFINITIONS[receipt.definitionId]?.cost>2||!SHOP_CATALOG.includes(receipt.definitionId)||receipt.round!==n||n<=own.acquiredRound||n>state.round)fail('firesale');}
  else if(rule==='reinfourcement'){if(receipt.kind!=='unit'||(receipt.starLevel??1)!==1||n>1||receipt.definitionId!==reinforced)fail('reinfourcement');}
  else fail('receipt rule');
 }
 for(const a of owned(state,'subscription'))for(let round=a.acquiredRound+1;round<=state.round;round++)
  if(isStageStart(round)&&!receipts.some(x=>x.receiptId===receiptId('subscription',a,round)))fail('missing subscription gold');
 if(reinforce&&reinforced!==undefined&&[0,1].some(c=>!receipts.some(x=>x.receiptId===receiptId('reinfourcement',reinforce,c))))fail('missing reinfourcement copy');
}
