/** Production ESM, real public commands and combat; no rule/state edits or synthetic income. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
function execute(api,state,a) {
  switch(a.type) {
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
    case 'anomalyReroll': return api.rerollAnomaly(state,a.choiceId,a.generation);
    default: throw new Error(`Unexpected bot command ${a.type}`);
  }
}
async function main() {
  assert.equal(process.versions.node.split('.')[0],'22');
  for(const key of ['window','document','Phaser','WebSocket']) Object.defineProperty(globalThis,key,{configurable:true,get(){throw new Error(`Forbidden ${key}`);}});
  Math.random=()=>{throw new Error('Implicit RNG');}; Date.now=()=>{throw new Error('Implicit clock');};
  const api=await import(pathToFileURL(path.resolve(__dirname,'../dist-server/index.mjs')).href);
  let state=api.createMatch(42),rng=42,steps=0,commands=0,ticks=0,maxSteps=0;
  const kinds=new Set();
  const accept=result=>{assert.equal(result.ok,true,result.reason);return result.state;};
  for(let budget=0;state.phase!=='gameOver';budget++) {
    assert(budget<100000,'finite complete match');
    if(state.phase==='combat') {state=api.stepMatch(state).state;ticks++;continue;}
    const decision=api.decideBotAction(state,{difficulty:'basic',stepsTaken:steps,maxSteps:64,self:{seatId:'bot',hp:state.playerHp,round:state.round}},rng);
    rng=decision.rng;
    if(decision.action!=='done') {
      kinds.add(decision.action.type);state=accept(execute(api,state,decision.action));steps++;commands++;maxSteps=Math.max(maxSteps,steps);continue;
    }
    if(state.phase==='preparation') state=accept(api.startMatchCombat(state));
    else if(state.phase==='settlement') {state=accept(api.nextRound(state,state.round));steps=0;}
    else throw new Error(`Bot stopped at unresolved ${state.phase}`);
  }
  assert(state.roundResults.length>=20,'fixed-seed bot must traverse at least twenty real rounds');
  assert(maxSteps<=64);
  console.log(JSON.stringify({node:process.version,policy:api.BOT_POLICY_VERSION,seed:42,rounds:state.roundResults.length,
    outcome:state.outcome,commands,ticks,maxSteps,finalBotRng:rng,actions:[...kinds].sort(),checks:'complete actual match, all commands accepted, bounded rounds, pure Node'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
