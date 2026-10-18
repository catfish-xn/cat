import {readG23Progress} from '../../src/simulation/g2-3-state';
import * as api from './recorded-match';
import {g23JunkerMenu} from '../../src/simulation/g2-3-junker';
import {createRequire} from 'node:module';
const {run}=createRequire(import.meta.url)('../../scripts/generate-m5-route.cjs');
import {CompletedBattleHistory} from './completed-battle-history';
import {historyFor,registerHistory,copyWithHistory} from './history-evidence';
import {readRecordedFixture} from './recorded-fixture';
const accept=(result:api.MatchCommandResult)=>{if(!result.ok)throw Error(result.reason);return result.state;};
/** Actual shop purchase and three battles; never fabricates currency, units, progress or receipts. */
export async function recordPublicPendingArmory(seed=4):Promise<api.MatchState>{
  let prefix:api.MatchState|undefined;
  const history=new CompletedBattleHistory('armory-public');
  const reached=Error('Public5-1 preparation');
  try{
    await run(api,{build:'cannon',seed,onStep(before:api.MatchState,result:api.MatchCommandResult|api.MatchStep,command?:{type:string}){
      if(command?.type==='start'&&before.roundDefinitionId==='5-1'){prefix=before;throw reached;}
      history.observe({before,after:result.state,events:('events' in result?result.events:[]).filter(e=>e.domain==='combat'),reason:before.combat?'tick':'command'});
    }});
  }catch(error){if(error!==reached)throw error;}
  if(!prefix)throw Error('Public cannon route did not reach5-1');
  let state:api.MatchState=prefix,rumbleId:string|null=null;
  const commit=(result:api.MatchCommandResult|api.MatchStep)=>{
    history.observe({before:state,after:result.state,events:('events' in result?result.events:[]).filter(e=>e.domain==='combat'),reason:state.combat?'tick':'command'});
    if('ok' in result&&!result.ok)throw Error(result.reason);
    return result.state;
  };
  const choose=()=>{
    const choice=state.pendingChoice!;
    if(choice.step==='target'){
      const targetId=rumbleId??state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!.id;
      state=commit(api.selectAnomalyTarget(state,choice.choiceId,choice.generation,targetId));
    }else state=commit(api.selectChoice(state,choice.choiceId,choice.generation,choice.offers[0]));
  };
  for(let budget=0;readG23Progress(state)!.junkerRounds<3;budget++){
    if(budget>15000||state.phase==='gameOver')throw Error('Public Rumble battle budget '+JSON.stringify({round:state.roundDefinitionId,phase:state.phase,gold:state.gold,level:state.level,junkerRounds:readG23Progress(state)!.junkerRounds,rumbleId}));
    if(state.phase==='choice')choose();
    else if(state.phase==='preparation'){
      if(!rumbleId){
        let slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId==='rumble');
        while(slot<0&&state.gold>=7){state=commit(api.rerollShop(state));slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId==='rumble');}
        if(slot>=0&&state.gold>=5){
          state=commit(api.buyUnit(state,slot,state.shop.generation));
          rumbleId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId==='rumble')!.id;
          state=commit(api.deployMatchUnit(state,rumbleId,{kind:'board',cell:{col:1,row:4}}));
        }
      }
      state=commit(api.startMatchCombat(state));
    }else if(state.phase==='combat')state=commit(api.stepMatch(state));
    else state=commit(api.nextRound(state,state.round));
  }
  while(state.pendingChoice?.kind!=='armory'){
    if(state.phase==='choice')choose();
    else if(state.phase==='settlement')state=commit(api.nextRound(state,state.round));
    else throw Error('Public Rumble armory phase');
  }
  registerHistory(state,history.completedRecords);
  return state;
}

/** Raw recording of the same real shop/three-battle route. Validation remains
 * inside the calling read test; loading never installs a verified flag. */
export async function publicPendingArmory(seed=4):Promise<api.MatchState>{
  if(seed!==4)return recordPublicPendingArmory(seed);
  const recorded=readRecordedFixture<{state:api.MatchState;battles:ReturnType<typeof historyFor>}>('armory-4');
  registerHistory(recorded.state,recorded.battles);
  return copyWithHistory(recorded.state);
}

export async function publicPaidArmorySettlement(seed=4):Promise<api.MatchState>{
  let state=await publicPendingArmory(seed);
  const history=new CompletedBattleHistory('armory-public',historyFor(state));
  const menu=g23JunkerMenu(state);
  if(!menu)throw Error('Public Rumble armory missing');
  const upgrade=menu.choices.find(c=>c!=='spare-parts')!;
  state=accept(api.chooseG23Junker(state,menu.id,upgrade));
  const before=state,start=api.startMatchCombat(state);state=accept(start);
  if(start.ok)history.observe({before,after:state,events:start.events.filter(e=>e.domain==='combat'),reason:'command'});
  while(state.phase==='combat'){const before=state,next=api.stepMatch(state);state=next.state;history.observe({before,after:state,events:next.events.filter(e=>e.domain==='combat'),reason:'tick'});}
  registerHistory(state,history.completedRecords);
  return state;
}
