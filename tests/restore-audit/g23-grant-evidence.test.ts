import {beforeAll,expect,it} from 'vitest';
import type {MatchState} from '../../src/simulation/match';
import {createMatch,buyXp,deployMatchUnit,startMatchCombat,chooseG23Junker,sellUnit} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import {readG23Progress} from '../../src/simulation/g2-3-state';
import type {G23GrantEvidence} from '../../src/simulation/g2-3-grant-evidence';
import {grantMechanicGold,grantMechanicUnit} from '../../src/simulation/seat-mechanics';
import {publicPendingArmory} from '../fixtures/g2-3-armory-public';
import {publicAcademyGrant} from '../fixtures/g2-3-academy-public';
let junker:MatchState,academy:MatchState;
beforeAll(async()=>{
 const pending=await publicPendingArmory();
 const choice=chooseG23Junker(pending,pending.pendingChoice!.choiceId,'spare-parts');
 if(!choice.ok)throw Error(choice.reason);junker=choice.state;
 academy=await publicAcademyGrant();
},30000);
const evidence=(s:MatchState)=>s.seatMechanics!.hidden.grantEvidence as G23GrantEvidence[];
// Object, JSON and serializeMatch are all restore entries; each must reject the same save.
const rejects=(s:MatchState,message?:string)=>{for(const input of [s,JSON.stringify(s)])expect(()=>restoreMatch(input)).toThrow(message);expect(()=>serializeMatch(s)).toThrow(message);};
it('public commands record a legal armory receipt; selling its holder later retains grant-time authority',()=>{
 expect(evidence(junker).at(-1)?.receiptId).toBe('g23:junker:1');
 expect(restoreMatch(serializeMatch(junker))).toEqual(junker);
 const sold=sellUnit(junker,readG23Progress(junker)!.junkerPurchases[0].unitId);if(!sold.ok)throw Error(sold.reason);
 expect(restoreMatch(serializeMatch(sold.state))).toEqual(sold.state);
});
it('rejects a junker unitId that disagrees with the holder reconstructed at selection',()=>{
 const bad=structuredClone(junker),p=readG23Progress(bad)!;
 Object.assign(p.junkerPurchases[0],{unitId:bad.preparation.units.find(u=>u.team==='player'&&u.definitionId!=='rumble')!.id});
 rejects(bad,'junker menu/unit');
});
it('rejects titan on a non-three-star holder even when both receipts agree',()=>{
 const bad=structuredClone(junker);Object.assign(readG23Progress(bad)!.junkerPurchases[0],{upgrade:'junkyard-titan'});
 Object.assign(bad.seatMechanics!.receipts.find(r=>r.receiptId==='g23:junker:1')!,{optionId:'junkyard-titan'});
 rejects(bad,'junker menu/unit');
});
it('rejects a paid option outside the seed-derived menu even when generic and mechanic receipts agree',()=>{
 const bad=structuredClone(junker),purchase=readG23Progress(bad)!.junkerPurchases[0];
 // Public seed4 menu has just two of five paid upgrades; try all five and prove at least three fail specifically at menu admission.
 let rejected=0;
 for(const upgrade of ['flamethrower','petricite-rod','repairing-microbots','self-destruct','tankbuster']){
  Object.assign(purchase,{upgrade,cost:5});Object.assign(bad.seatMechanics!.receipts.find(r=>r.receiptId===purchase.id)!,{optionId:upgrade,price:5});
  try{restoreMatch(bad);}catch(e){if(String(e).includes('junker menu/unit'))rejected++;}
 }
 expect(rejected).toBeGreaterThanOrEqual(3);
});
it('rejects omitted evidence and forged ownership/star/resource/economy prefixes',()=>{
 for(const state of [junker,academy]){
  const old=structuredClone(state);delete (old.seatMechanics!.hidden as Record<string,unknown>).grantEvidence;rejects(old,'missing/extra receipt snapshot');
  for(const mutate of [(e:G23GrantEvidence)=>Object.assign(e,{resourcePrefixLength:0}),(e:G23GrantEvidence)=>Object.assign(e,{economyPrefixLength:0}),
   (e:G23GrantEvidence)=>Object.assign(e.units[0],{starLevel:e.units[0].starLevel===3?1:3}),(e:G23GrantEvidence)=>Object.assign(e,{mechanicPrefixLength:-1})]){
   const bad=structuredClone(state);mutate(evidence(bad)[0]);rejects(bad);
  }
 }
});
it('public Academy3 grant restores from its historical deployment after members are sold',()=>{
 expect(readG23Progress(academy)!.itemReceipts.map(r=>r.tier)).toEqual([3]);
 expect(restoreMatch(serializeMatch(academy))).toEqual(academy);
 const unit=academy.preparation.units.find(u=>u.team==='player'&&u.definitionId==='leona')!;
 const sold=sellUnit(academy,unit.id);if(!sold.ok)throw Error(sold.reason);
 expect(restoreMatch(serializeMatch(sold.state))).toEqual(sold.state);
});
it('rejects an Academy receipt whose grant-time deployment cannot qualify',()=>{
 const bad=structuredClone(academy),e=evidence(bad)[0];
 // Preserve resource identities/stars and legal, distinct bench locations; only qualification changes.
 Object.assign(e,{units:e.units.map((u,slot)=>({...u,location:{kind:'bench',slot}}))});
 rejects(bad,'academy qualification');
});
it('source cannot opt an Academy receipt out of its dedicated validation',()=>{
 const bad=structuredClone(academy);Object.assign(bad.seatMechanics!.receipts.find(r=>r.receiptId==='g23:academy:3')!,{source:'registry-test'});
 rejects(bad,'academy qualification');
});

it('the frozen combat purchase cannot substitute another unitId for the validated selection',()=>{
 const started=startMatchCombat(junker);if(!started.ok)throw Error(started.reason);
 expect(restoreMatch(serializeMatch(started.state))).toEqual(started.state);
 const bad=structuredClone(started.state);
 Object.assign(bad.combatInputBasis!.inputs.g23!.junkerPurchases[0],{unitId:'unit-1'});
 rejects(bad,'Invalid combat input basis');
});
it('Academy3/4/5 each binds its own pre-grant birth boundary and qualifying deployment',()=>{
 // Focused planner fixture: genuine grants/provenance, public XP and deployment.
 const accepted=<T extends {ok:boolean;state:MatchState}>(r:T)=>{if(!r.ok)throw Error(JSON.stringify(r));return r.state;};
 let state=accepted(grantMechanicGold(createMatch(42),{receiptId:'fixture-funding',source:'test',amount:100}));
 while(state.level<5)state=accepted(buyXp(state));
 for(const [i,definitionId] of ['lux','leona','ezreal','heimerdinger','jayce'].entries()){
  state=accepted(grantMechanicUnit(state,{receiptId:'fixture-academy-'+i,source:'test',definitionId}));
  const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId)!;
  state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col:i,row:4}}));
 }
 expect(readG23Progress(state)!.itemReceipts.map(r=>r.tier)).toEqual([3,4,5]);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 for(const i of [1,2]){
  const bad=structuredClone(state),snapshot=evidence(bad)[i];
  Object.assign(snapshot,{resourcePrefixLength:evidence(bad)[0].resourcePrefixLength});
  rejects(bad);
 }
});

it.each(['extra snapshot','identity','round','level','deployment collision'])('rejects forged grant evidence %s without mutating either save entry',field=>{
 for(const source of [junker,academy]){
  const bad=structuredClone(source),snapshots=evidence(bad),snapshot=snapshots[0];
  if(field==='extra snapshot')snapshots.push(structuredClone(snapshot));
  else if(field==='identity')Object.assign(snapshot,{receiptId:'forged-grant'});
  else if(field==='round')Object.assign(snapshot,{round:snapshot.round+1});
  else if(field==='level')Object.assign(snapshot,{level:0});
  else Object.assign(snapshot.units[1],{location:structuredClone(snapshot.units[0].location)});
  const before=JSON.stringify(bad);rejects(bad,'grant evidence');expect(JSON.stringify(bad)).toBe(before);
 }
});
