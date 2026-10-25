import {readG23Progress} from '../../src/simulation/g2-3-state';
import * as api from '../../src/simulation/match';
import {g23JunkerMenu} from '../../src/simulation/g2-3-junker';
import {createRequire} from 'node:module';
const {run}=createRequire(import.meta.url)('../../scripts/generate-m5-route.cjs');
const accept=(result:api.MatchCommandResult)=>{if(!result.ok)throw Error(result.reason);return result.state;};
/** Actual shop purchase and three battles; never fabricates currency, units, progress or receipts. */
export async function publicPendingArmory(seed=4,onRound?:(state:api.MatchState)=>Promise<void>):Promise<api.MatchState>{
  let prefix:api.MatchState|undefined;
  const reached=Error('Public5-1 preparation');
  try{
    await run(api,{build:'cannon',seed,onRound,onBattleProgress:onRound,onStep(before:api.MatchState,_result:api.MatchCommandResult,command?:{type:string}){
      if(command?.type==='start'&&before.roundDefinitionId==='5-1'){prefix=before;throw reached;}
    }});
  }catch(error){if(error!==reached)throw error;}
  if(!prefix)throw Error('Public cannon route did not reach5-1');
  let state:api.MatchState=prefix,rumbleId:string|null=null;
  const choose=()=>{
    const choice=state.pendingChoice!;
    if(choice.step==='target'){
      const targetId=rumbleId??state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!.id;
      state=accept(api.selectAnomalyTarget(state,choice.choiceId,choice.generation,targetId));
    }else state=accept(api.selectChoice(state,choice.choiceId,choice.generation,choice.offers[0]));
  };
  for(let budget=0;readG23Progress(state)!.junkerRounds<3;budget++){
    if(budget>15000||state.phase==='gameOver')throw Error('Public Rumble battle budget '+JSON.stringify({round:state.roundDefinitionId,phase:state.phase,gold:state.gold,level:state.level,junkerRounds:readG23Progress(state)!.junkerRounds,rumbleId}));
    if(state.phase==='choice')choose();
    else if(state.phase==='preparation'){
      if(!rumbleId){
        let slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId==='rumble');
        while(slot<0&&state.gold>=7){state=accept(api.rerollShop(state));slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId==='rumble');}
        if(slot>=0&&state.gold>=5){
          state=accept(api.buyUnit(state,slot,state.shop.generation));
          rumbleId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId==='rumble')!.id;
          state=accept(api.deployMatchUnit(state,rumbleId,{kind:'board',cell:{col:1,row:4}}));
        }
      }
      state=accept(api.startMatchCombat(state));
    }else if(state.phase==='combat'){state=api.stepMatch(state).state;if(state.phase!=='combat'||state.combat!.tick%150===0)await onRound?.(state);}
    else state=accept(api.nextRound(state,state.round));
  }
  while(state.pendingChoice?.kind!=='armory'){
    if(state.phase==='choice')choose();
    else if(state.phase==='settlement')state=accept(api.nextRound(state,state.round));
    else throw Error('Public Rumble armory phase');
  }
  return state;
}

export async function publicPaidArmorySettlement(seed=4):Promise<api.MatchState>{
  let state=await publicPendingArmory(seed);
  const menu=g23JunkerMenu(state);
  if(!menu)throw Error('Public Rumble armory missing');
  const upgrade=menu.choices.find(c=>c!=='spare-parts')!;
  state=accept(api.chooseG23Junker(state,menu.id,upgrade));
  state=accept(api.startMatchCombat(state));
  while(state.phase==='combat')state=api.stepMatch(state).state;
  return state;
}
