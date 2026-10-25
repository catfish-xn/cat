import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { run } from '../scripts/generate-m5-route.cjs';
import { ANVIL_IDS } from './fixtures/m5/oracle.g2.cjs';

// One ordinary oracle-audited route, collected once as the existing replay files do.
// No funded state, injected reward, skipped command, or enlarged test/hook timeout.
const sold=new Set<string>(),anvilDeploys:string[]=[];
// The 224-card pool offers Caretaker's Favor at seed 30 (seed 25 now offers Prizefighter).
const route=await run(api,{seed:30,build:'sniper',onStep(before,_result,command){
  if(command?.type==='sell')sold.add(command.id as string);
  if(command?.type==='deploy'){
    const unit=before.preparation.units.find(u=>u.id===command.id);
    if(unit&&ANVIL_IDS.has(unit.definitionId))anvilDeploys.push(unit.id);
  }
}});

it('opens all four genuine Caretaker level anvils through public commands without deploying them as heroes',()=>{
  expect(route.final.augments[0].definitionId).toBe('caretakers-favor');
  const grants=route.final.seatMechanics!.receipts.filter(r=>r.kind==='unit'&&r.source==='augment-pool-batch1'
    &&JSON.parse(r.receiptId)[2]==='caretakers-favor');
  expect(grants).toHaveLength(4);
  expect(grants.map(r=>JSON.parse(JSON.parse(r.receiptId)[1])[2])).toEqual([5,6,7,8]);
  for(const r of grants){expect(r.kind).toBe('unit');if(r.kind!=='unit')throw Error('unit receipt required');
    expect(r.definitionId).toBe('TFT_ArmoryKeyComponent');expect(r.resolution).toBe('held');expect(sold.has(r.unitId!)).toBe(true);}
  expect(anvilDeploys).toEqual([]);
  expect(route.final.phase).toBe('gameOver');
});
