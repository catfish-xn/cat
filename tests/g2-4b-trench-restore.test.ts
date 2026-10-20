import {battle,unit} from './combat-helpers';
import {createItemRandomStreams} from '../src/simulation/g2-4b-item-kernel';
import {recordItemGold} from '../src/simulation/g2-4b-item-gold';
import {g23BattleFacts,commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {reachRound} from './match-helpers';
import {expect,it} from 'vitest';
import {createMatch,deployMatchUnit,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {compileBattle,resolveTwoSidedBattle,proposeSettlement} from '../src/simulation/two-sided-battle';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const coat='TFT_Item_Artifact_SuspiciousTrenchCoat';
function equipped(base=createMatch(42)){
 const grant=grantMechanicItem(base,{receiptId:'trench-restore',source:'test',definitionId:coat});
 if(!grant.ok)throw Error(grant.reason);
 const owner=grant.state.preparation.units.find(u=>u.team==='player')!;
 const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,0);
 if(!equip.ok)throw Error(equip.reason);
 if(owner.location.kind==='board')return equip.state;
 const deploy=deployMatchUnit(equip.state,owner.id,{kind:'board',cell:{col:3,row:4}});if(!deploy.ok)throw Error(deploy.reason);return deploy.state;
}
it('authenticates the entire Trench checkpoint before and after dynamic roster replacement',()=>{
 const start=startMatchCombat(equipped(reachRound('2-1')));if(!start.ok)throw Error(start.reason);
 let current=start.state;
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
 while(current.phase==='combat'&&!current.combat!.trenchSplits?.length)current=stepMatch(current).state;
 expect(current.combat!.trenchSplits).toHaveLength(1);
 const split=current.combat!.trenchSplits![0];
 expect(current.combat!.units.some(u=>u.id===split.ownerId)).toBe(false);
 expect(restoreMatch(current)).toEqual(current);
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
 const mutations=[
  (s:typeof current)=>Object.assign(s.combat!.units.find(u=>u.id===split.copyIds[0])!,{hp:1}),
  (s:typeof current)=>Object.assign(s.combat!.units.find(u=>u.id===split.copyIds[0])!,{id:'fabricated-copy'}),
  (s:typeof current)=>Object.assign(s.combat!.trenchSplits![0],{maxHp:split.maxHp+1}),
  (s:typeof current)=>Object.assign(s.combat!.trenchSplits![0],{permanentAdBps:125}),
  (s:typeof current)=>Object.assign(s.combat!,{removedUnitIds:[]}),
  (s:typeof current)=>Object.assign(s.combat!,{rngDraws:(s.combat!.rngDraws??0)+1}),
 ];
 for(const mutate of mutations){const forged=structuredClone(current);mutate(forged);expect(()=>restoreMatch(forged)).toThrow();}
 // A prior successful restore never authorizes a later mutated object.
 expect(restoreMatch(current)).toEqual(current);
 while(current.phase==='combat')current=stepMatch(current).state;
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
 expect(current.items).toEqual(start.state.items);
});

it('settles removed two-sided holders without minting clone survivors or accepting forged copies',()=>{
 const round=getCatalogRoundById('2-1');
 const prepare=(state:ReturnType<typeof createMatch>)=>({...state,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...state.m8,round},
  preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='player')}});
 const battle=compileBattle(snapshotForBattle(prepare(equipped()),'A'),snapshotForBattle(prepare(equipped()),'B'),42,{battleId:'trench-two-sided'});
 const result=resolveTwoSidedBattle(battle,1200);
 expect(result.terminal.trenchSplits!.length).toBeGreaterThan(0);
 const proposal=proposeSettlement(result);
 for(const split of result.terminal.trenchSplits!){
  expect(result.a.survivors.concat(result.b.survivors).some(s=>split.copyIds.includes(s.unitId))).toBe(false);
 }
 expect(proposal.a.opposingSurvivors).toBe(result.b.survivors.length);
 expect(proposal.b.opposingSurvivors).toBe(result.a.survivors.length);
 const forged=structuredClone(result);Object.assign(forged.terminal.units.find(u=>u.itemSummon?.kind==='trench')!,{maxHp:99999});
 expect(()=>proposeSettlement(forged)).toThrow('invalid-result');
});

it('keeps pre-split and copy-earned gold receipts once, including after settlement serialization',()=>{
 // Adapter fixture: deterministic positive Mogul receipts isolate owner selection
 // from combat RNG. Full combat authority is exercised by the replay tests above.
 const initial=createMatch(42),owner=initial.preparation.units.find(u=>u.team==='player')!.id;
 const copy='copy-0',enemy='enemy-copy';
 let ledger={streams:createItemRandomStreams(42),receipts:[]} as ReturnType<typeof recordItemGold>;
 for(const [ordinal,ownerId] of [owner,copy,enemy].entries())ledger=recordItemGold(ledger,{battleId:'round-1',ownerId,itemInstanceId:'mogul',kind:'moguls-full',tick:ordinal+1,ordinal});
 const combat=battle([unit(copy,'player',3,4),unit(enemy,'enemy',3,2)],{
  combatId:'round-1',status:'finished',result:'playerWin',itemGoldReceipts:ledger.receipts,itemRandomStreams:ledger.streams,
  trenchSplits:[{ownerId:owner,itemInstanceId:'coat',tick:2,maxHp:1000,permanentAdBps:0,copyIds:[copy]}],removedUnitIds:[owner],
 });
 const facts=g23BattleFacts({...combat,strategy:{traits:[],units:[]}},'player',1,'pve',[{id:owner,team:'player'}]);
 expect(facts.itemGoldPayouts!.map(p=>p.receiptId)).toEqual(ledger.receipts.slice(0,2).map(r=>r.id));
 const settled=commitG23Settlement(initial,facts);
 expect(settled.gold).toBe(initial.gold+2);
 expect(commitG23Settlement(settled,facts)).toBe(settled);
 expect(commitG23Settlement(JSON.parse(JSON.stringify(settled)),facts)).toEqual(settled);
});
