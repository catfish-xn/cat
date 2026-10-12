import type { ClientCommand } from '../../server/protocol';
import type { MatchState } from '../match-types';
import { buyUnit, getDeploymentCap, needsAnomalyRecruitment } from '../match';
import { MATCH_RULES } from '../match-rules';
import { getShopOdds } from '../progression';
import { ITEM_DEFINITIONS } from '../content/items';
import { UNIT_DEFINITIONS } from '../units';
import { nextRandom, validateSeed } from '../rng';
import { BOT_MAX_STEPS, type BotContext, type BotDecision } from './types';
import { byId, cheapest, formationAction, strongest, strength } from './formation';
import { legal } from './preflight';
export { BOT_MAX_STEPS, BOT_POLICY_VERSION } from './types';
export type { BotContext, BotDecision } from './types';

/** One intention, never a state commit. B6 owns execution, pool transactions and attempt budgets. */
export function decideBotAction(state: MatchState, context: BotContext, rng: number): BotDecision {
  validateSeed(rng);
  if(context.difficulty!=='basic' || !Number.isSafeInteger(context.stepsTaken) || context.stepsTaken<0
    || !Number.isSafeInteger(context.maxSteps) || context.maxSteps<0) throw new RangeError('Invalid bot context');
  const done:BotDecision={action:'done',rng};
  if(context.stepsTaken>=Math.min(context.maxSteps,BOT_MAX_STEPS) || context.lastFailure
    || context.self.round!==state.round || context.self.hp!==state.playerHp
    || (state.multiplayer && context.self.seatId!==state.multiplayer.seatId)
    || state.playerHp<=0 || state.multiplayer?.status==='eliminated') return done;
  if(state.phase!=='preparation' && state.phase!=='choice') return done;
  const emit=(action:ClientCommand):BotDecision=>({action,rng});
  const roster=state.preparation.units.filter(u=>u.team==='player').sort(strongest);
  if(state.phase==='choice') {
    const choice=state.pendingChoice;
    if(!choice) return done;
    const identity={choiceId:choice.choiceId,generation:choice.generation};
    const actions:ClientCommand[]=choice.kind==='anomaly' && choice.step==='target'
      ? [...roster].sort(byId).map(u=>({type:'anomalyTarget',...identity,unitId:u.id}))
      : choice.offers.map(definitionId=>({type:'choose',...identity,definitionId}));
    const action=actions.find(a=>legal(state,a));
    return action?emit(action):done;
  }
  const position=formationAction(state,roster);
  if(position) return emit(position);
  const inventory=state.items.filter(i=>i.location.kind==='inventory').sort(byId);
  for(let i=0;i<inventory.length;i++) for(let j=i+1;j<inventory.length;j++) {
    const action:ClientCommand={type:'combine',a:inventory[i].id,b:inventory[j].id};
    if(legal(state,action)) return emit(action);
  }
  const spendDown=state.playerHp<=30 || state.m8.round.stage>=5;
  for(const item of inventory) {
    // Save unpaired components for a future recipe until the late/low-HP spend-down.
    if(ITEM_DEFINITIONS[item.definitionId].kind!=='completed' && !spendDown) continue;
    for(const unit of roster.filter(u=>u.location.kind==='board')) for(let slot=0;slot<3;slot++) {
      const action:ClientCommand={type:'equip',itemId:item.id,unitId:unit.id,slot};
      if(legal(state,action)) return emit(action);
    }
  }
  const recruit=needsAnomalyRecruitment(state);
  const reserve=spendDown || recruit ? 0 : Math.min(50,Math.floor(state.gold/10)*10);
  const cap=getDeploymentCap(state), weakest=roster.slice(0,cap).at(-1);
  const offers=state.shop.slots.flatMap((slot,index)=>{
    if(slot.status!=='available') return [];
    const cost=UNIT_DEFINITIONS[slot.definitionId].cost;
    if(state.gold-cost<reserve) return [];
    const owned=roster.filter(u=>u.definitionId===slot.definitionId);
    if(owned.some(u=>u.starLevel===3)) return [];
    if(roster.length>=cap && !owned.length && weakest && 100+cost*10<=strength(weakest)) return [];
    const singles=owned.filter(u=>u.starLevel===1).length;
    return [{slot:index,definitionId:slot.definitionId,cost,score:(singles>=2?10000:owned.length?1000:0)+cost*10}];
  }).sort((a,b)=>b.score-a.score || a.slot-b.slot);
  const buys=offers.filter(o=>legal(state,{type:'buy',slot:o.slot,generation:state.shop.generation}));
  if(buys.length) {
    const ties=buys.filter(o=>o.score===buys[0].score);
    const draw=ties.length>1?nextRandom(rng):undefined;
    const offer=ties[draw?Math.floor(draw.word*ties.length/4294967296):0];
    return {action:{type:'buy',slot:offer.slot,generation:state.shop.generation},rng:draw?.state??rng};
  }
  // A full bench blocks a desirable purchase: sell its cheapest expendable reserve first.
  for(const offer of offers) {
    const preview=buyUnit(state,offer.slot,state.shop.generation);
    if(preview.ok || preview.reason!=='bench-full') continue;
    const victim=roster.filter(u=>u.location.kind==='bench' && u.definitionId!==offer.definitionId).sort(cheapest)[0];
    if(!victim || strength(victim)>=100+offer.cost*10) continue;
    const action:ClientCommand={type:'sell',unitId:victim.id};
    if(legal(state,action)) return emit(action);
  }
  if(!recruit && state.level<MATCH_RULES.maxLevel && state.gold-MATCH_RULES.xpPurchaseCost>=reserve) {
    const action:ClientCommand={type:'buyXp'};
    if(legal(state,action)) return emit(action);
  }
  // Observing only this seat: returning an available positive-odds offer guarantees a pooled
  // reroll can draw at least one card. An all-empty/sold shop never guesses the hidden pool.
  const canReturnCard=state.shop.slots.some(s=>s.status==='available'
    && getShopOdds(state.level)[UNIT_DEFINITIONS[s.definitionId].cost-1]>0);
  if(!recruit && state.gold-MATCH_RULES.rerollCost>=reserve && (!state.sharedPool || canReturnCard)) {
    const action:ClientCommand={type:'reroll'};
    if(legal(state,action)) return emit(action);
  }
  // A disconnected human may leave a locked shop; release it once we choose to stop shopping.
  if(state.shop.locked) {
    const action:ClientCommand={type:'shopLock',locked:false,generation:state.shop.generation};
    if(legal(state,action)) return emit(action);
  }
  return done;
}
