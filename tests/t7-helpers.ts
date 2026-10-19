import * as api from '../src/server-entry';
import type { ClientCommand } from '../src/server/protocol';
export function context(state:api.MatchState,stepsTaken=0):api.BotContext {
  return {difficulty:'basic',stepsTaken,maxSteps:api.BOT_MAX_STEPS,self:{seatId:state.multiplayer?.seatId??'bot',hp:state.playerHp,round:state.round}};
}
export function execute(state:api.MatchState,a:ClientCommand):api.MatchCommandResult {
  switch(a.type) {
    case 'useConsumable': return api.useConsumable(state,a.consumableId,a.target);
    case 'buy': return api.buyUnit(state,a.slot,a.generation);
    case 'sell': return api.sellUnit(state,a.unitId);
    case 'deploy': return api.deployMatchUnit(state,a.unitId,a.target);
    case 'buyXp': return api.buyXp(state);
    case 'reroll': return api.rerollShop(state);
    case 'shopLock': return api.setShopLock(state,a.locked,a.generation);
    case 'combine': return api.combineItems(state,a.a,a.b);
    case 'equip': return api.equipItem(state,a.itemId,a.unitId,a.slot);
    case 'choose': return api.selectChoice(state,a.choiceId,a.generation,a.definitionId);
    case 'anomalyTarget': return api.selectAnomalyTarget(state,a.choiceId,a.generation,a.unitId);
    case 'rerollAugment': return api.rerollAugment(state,a.choiceId,a.generation);
    case 'anomalyReroll': return api.rerollAnomaly(state,a.choiceId,a.generation);
  }
}
export function accepted(r:api.MatchCommandResult):api.MatchState {
  if(!r.ok) throw new Error(r.reason);return r.state;
}
/** Execute positioning only to isolate economy/equipment decisions without overriding the policy. */
export function aligned(state:api.MatchState):api.MatchState {
  for(let i=0;i<40;i++) {
    const d=api.decideBotAction(state,context(state),0);
    if(d.action==='done'||d.action.type!=='deploy') return state;
    state=accepted(execute(state,d.action));
  }
  throw new Error('Formation did not converge');
}
