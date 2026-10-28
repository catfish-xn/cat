import type { MatchState } from './match-types';
import { historyCheck, historySeatId, requireAugmentFacts } from './augment-history';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { nextRandom } from './rng';
import { grantMechanicGold, grantMechanicItem } from './seat-mechanics/grants';
import { LOOT_EXPLOSION_BASE_DROP_CHANCE, LOOT_EXPLOSION_LOOT_VALUES, LOOT_EXPLOSION_RULES } from './content/augment-pool-batch5-g7';

export const LOOT_EXPLOSION_SOURCE = 'augment-pool-batch5-g7';
type Reward = {readonly kind:'gold';readonly amount:number} | {readonly kind:'item';readonly definitionId:string};
export interface LootExplosionDrop {readonly baseTier:number;readonly tier:number;readonly valueCrit:boolean;readonly rewards:readonly Reward[]}
/** Independent drop, weighted value, then ONE value crit; no live Match/combat RNG. */
export function rollLootExplosion(stage:number, critChanceBps:number, draw:()=>number):LootExplosionDrop|null {
  historyCheck(Number.isSafeInteger(critChanceBps) && critChanceBps>=0 && critChanceBps<=10000,'loot explosion crit chance');
  const rows=LOOT_EXPLOSION_LOOT_VALUES[stage];
  historyCheck(rows,'loot explosion stage');
  const word=()=>{const w=draw();historyCheck(Number.isSafeInteger(w)&&w>=0&&w<0x100000000,'loot explosion random word');return w;};
  if(word()*10000>=Math.min(10000,LOOT_EXPLOSION_BASE_DROP_CHANCE+critChanceBps)*0x100000000)return null;
  const valid=rows.filter((r):r is {key:number;mValue:number}=>r.mValue!==undefined && r.mValue>0);
  const total=valid.reduce((n,r)=>n+r.mValue,0),ticket=word()*total;
  let cumulative=0;
  const baseTier=valid.find(r=>{cumulative+=r.mValue;return ticket<cumulative*0x100000000;})!.key;
  const valueCrit=word()*10000<critChanceBps*0x100000000,tier=Math.min(6,baseTier+(valueCrit?1:0));
  const pool=tier===6?LOOT_EXPLOSION_RULES.completed:LOOT_EXPLOSION_RULES.components;
  const rewards:Reward[]=tier<=3?[{kind:'gold',amount:tier}]:Array.from({length:tier===5?2:1},()=>({kind:'item',definitionId:pool[Math.floor(word()*pool.length/0x100000000)]}));
  return {baseTier,tier,valueCrit,rewards};
}
export function lootExplosionRewardPlan(state:MatchState) {
  const owner=state.augments.find(a=>a.definitionId==='loot-explosion');
  const plan: {receiptId:string;source:string;round:number;reward:Reward}[]=[];
  if(!owner)return plan;
  for(const result of state.roundResults.filter(r=>r.round>=owner.acquiredRound && r.roundKind!=='supply')) {
    const rows=requireAugmentFacts(state,'deaths',result.round);
    historyCheck(rows.some(f=>f.completeThroughTick===result.combatTicks),'loot explosion incomplete deaths');
    const battleIds=new Set(rows.map(f=>f.battleId));
    historyCheck(battleIds.size===1,'loot explosion battle identity');
    const seen=new Set<number>();
    for(const death of rows.flatMap(f=>f.deaths).sort((a,b)=>a.eventSeq-b.eventSeq)) {
      historyCheck(!seen.has(death.eventSeq),'loot explosion duplicate death');seen.add(death.eventSeq);
      const kill=death.lootExplosion;
      if(!kill || !death.ordinaryHero || kill.killerSeatId!==historySeatId(state) || death.ownerSeatId===historySeatId(state))continue;
      const namespace=[LOOT_EXPLOSION_SOURCE,historySeatId(state),owner.choiceId,result.round,death.combatId,death.eventSeq];
      let hash=0x811c9dc5;const key=JSON.stringify(namespace);
      for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),0x01000193)>>>0;
      let rng=(state.seed^hash)>>>0;
      const drop=rollLootExplosion(getMultiplayerRoundByOrdinal(result.round).stage,kill.critChanceBps,()=>{const next=nextRandom(rng);rng=next.state;return next.word;});
      drop?.rewards.forEach((reward,index)=>plan.push({receiptId:JSON.stringify([...namespace,index]),source:LOOT_EXPLOSION_SOURCE,round:result.round,reward}));
    }
  }
  return plan;
}
/** Only called by authoritative settlement, after the complete death evidence is present. */
export function drainLootExplosionRewards(state:MatchState):MatchState {
  for(const p of lootExplosionRewardPlan(state)) {
    if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
    historyCheck(p.round===state.round,'loot explosion missing prior reward');
    const request={receiptId:p.receiptId,source:p.source,...p.reward};
    const granted=p.reward.kind==='gold'?grantMechanicGold(state,{...request,amount:p.reward.amount}):grantMechanicItem(state,{...request,definitionId:p.reward.definitionId});
    historyCheck(granted.ok,'loot explosion grant');state=granted.state;
  }
  return state;
}

