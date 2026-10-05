import { it } from 'vitest';
import assert from './fixtures/m5/assert-equal.cjs';
import * as api from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {run,dispatch} from '../scripts/generate-m5-route.cjs';

for(const build of ['cannon','sniper','mage','sniper-caitlyn'])it(`M5 ${build} restores every command and tick; rejected insertion preserves every field`,async()=>{
 const started=performance.now();
 console.log(`M5 replay ${build}: start`);
 let restored=api.createMatch(42),commands=0,ticks=0;
 await run(api,{build,seed:42,onStep(before,result,command){
  assert.deepEqual(restored,before);
  const frozen=JSON.stringify(restored);
  const failures=[api.buyUnit(restored,-1,restored.shop.generation),api.sellUnit(restored,'absent'),api.selectChoice(restored,'stale',-1,'absent'),api.nextRound(restored,-1)];
  for(const failed of failures){assert.equal(failed.ok,false);assert.equal(failed.state,restored);assert.equal('events' in failed,false);}
  assert.equal(JSON.stringify(restored),frozen);
  const second=command?dispatch(api,restored,command):api.stepMatch(restored);
  assert.deepEqual(second,result);
  restored=restoreMatch(JSON.stringify(second.state));assert.deepEqual(restored,second.state);
  if(command)commands++;else ticks++;
 }});
 assert.equal(restored.phase,'gameOver');assert(commands>100);assert(ticks>1000);
 console.log(JSON.stringify({replay:build,commands,ticks,durationSeconds:(performance.now()-started)/1000,passed:true}));
},180000);
