import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { batch2RewardPlan, drainBatch2Gold, validateBatch2Gold, validateBatch2Facts, batch2BattleFacts } from '../src/simulation/augment-pool-batch2-progress';
import { batch2HpAfterSettlement, batch2HpBeforeBattle } from '../src/simulation/augment-pool-batch2-health';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { finishG23Choice } from '../src/simulation/g2-3-runtime';
import { openMechanicChoice, resolveMechanicChoice } from '../src/simulation/seat-mechanics/choices';
import { createG23Progress } from '../src/simulation/g2-3-match-progress';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { type AbilityContext } from '../src/simulation/combat-s13-abilities';
import { type S13Unit } from '../src/simulation/combat-s13-state';
import { batch2Tick, batch2Rocket, batch2Target, batch2Kill } from '../src/simulation/augment-pool-batch2-combat';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import type { MatchState } from '../src/simulation/match-types';

const fact=(round:number,batch2:G23BattleFacts['batch2']=[],result:G23BattleFacts['result']='win'):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind:'pvp',result,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,batch2});
function stateWithFacts(id:string,counts:number[]){
 let s={...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]},p=readG23Progress(s)!;
 for(const [i,count] of counts.entries())p=advanceG23Economy(p,fact(i+1,[{definitionId:id,count}])).progress;
 s={...s,round:counts.length};return writeG23Progress(s,p);
}
it('strict bounded battle facts reject unknown fields, duplicate IDs, negatives, fractions and extra family rewards',()=>{
 for(const x of [[{definitionId:'unknown',count:1}],[{definitionId:'betrayal',count:2}],[{definitionId:'rocket-collection',count:-1}],[{definitionId:'rocket-collection',count:1.2}],[{definitionId:'enforce',count:1,extra:1}],[{definitionId:'enforce',count:1},{definitionId:'enforce',count:1}]])expect(()=>validateBatch2Facts(x)).toThrow();
});
it.each([['rocket-collection',75],['rocket-collection-plus',65]] as const)('%s carries rocket remainder across combats and caps at two Collectors', (id,n)=>{
 expect(batch2RewardPlan(stateWithFacts(id,[n-1]))).toEqual([]);
 const a=stateWithFacts(id,[n-1,1]),gifts=batch2RewardPlan(a);expect(gifts).toHaveLength(1);expect(gifts[0]).toMatchObject({definitionId:'TFT4_Item_OrnnTheCollector',acquiredRound:2,kind:'item'});
 const b=stateWithFacts(id,[n-1,1,n*10]);expect(batch2RewardPlan(b)).toHaveLength(2);
 const after=drainBatch1Gifts(b);expect(drainBatch1Gifts(after)).toBe(after);
});
it('Scrap carries conversion remainder and caps at five independent component rewards',()=>{
 expect(batch2RewardPlan(stateWithFacts('scrap-recycling',[5]))).toHaveLength(0);
 expect(batch2RewardPlan(stateWithFacts('scrap-recycling',[5,1]))).toHaveLength(1);
 const gifts=batch2RewardPlan(stateWithFacts('scrap-recycling',[5,1,100]));expect(gifts).toHaveLength(5);expect(new Set(gifts.map(g=>g.receiptId)).size).toBe(5);
});
it('Enforce pays exactly six gold per six distinct Wanted deaths, once, and authenticates receipt coefficients',()=>{
 const s=stateWithFacts('enforce',[5,1]),before=s.gold,first=drainBatch2Gold(s),p=advanceG23Economy(readG23Progress(first)!,fact(3,[{definitionId:'enforce',count:7}])).progress,after=drainBatch2Gold(writeG23Progress({...first,round:3},p));
 expect(after.gold-before).toBe(12);expect(drainBatch2Gold(after)).toBe(after);validateBatch2Gold(after);
 const changed=structuredClone(after) as any;changed.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch2').amount++;expect(()=>validateBatch2Gold(changed)).toThrow();
});
it('Family and Betrayal grant one copy per qualifying battle and use stable shared-pool-compatible unit receipts',()=>{
 const family=stateWithFacts('welcome-to-the-playground',[1,0,1]),f=batch2RewardPlan(family);
 expect(f).toHaveLength(2);expect(f.every(g=>g.kind==='unit'&&['vander','powder','violet'].includes(g.definitionId))).toBe(true);
 const betrayal=stateWithFacts('betrayal',[0,1,1]);expect(batch2RewardPlan(betrayal).map(g=>[g.definitionId,g.acquiredRound])).toEqual([['maddie',2],['maddie',3]]);
});
function combat(id:string,names:string[]){
 const s=createMatch(42),preparation={...s.preparation,units:[...names,'garen'].map((definitionId,i)=>({id:'u'+i,definitionId,starLevel:1 as const,team:i===names.length?'enemy' as const:'player' as const,location:{kind:'board' as const,cell:{col:i,row:i===names.length?2:4}}}))};
 const strategy=buildStrategySnapshot({...s,preparation,augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]});return createCombatWithEvents(preparation,strategy,'b2',42).state;
}
const context=(s:ReturnType<typeof combat>,tick:number):AbilityContext=>({units:structuredClone(s.units) as S13Unit[],board:s.board,combatId:s.combatId,tick,events:[],heals:[],packets:[],draw:()=>0});
it('each Artillerist rocket gets 15% more raw damage once, regardless of enemies hit',()=>{
 const s=combat('rocket-collection',['tristana','urgot']),c=context(s,10),u=c.units.find(u=>u.definitionId==='tristana')!;
 expect(batch2Rocket(u,200)).toBe(230);expect(batch2Rocket(u,200)).toBe(230);expect(u.batch2?.rockets).toBe(2);
 expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:'rocket-collection',count:2}]);
});
it('Family samples survival at 17 seconds once; a later death cannot erase an already earned copy',()=>{
 const s=combat('welcome-to-the-playground',['powder','violet']),c=context(s,339);
 batch2Tick(c);expect(c.units.some(u=>u.batch2?.familyQualified)).toBe(false);
 c.tick=340;batch2Tick(c);const violet=c.units.find(u=>u.definitionId==='violet')!;violet.alive=false;violet.hp=0;
 expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:'welcome-to-the-playground',count:1}]);
 const early=context(s,10);expect(batch2BattleFacts({...s,units:early.units},'player')).toEqual([{definitionId:'welcome-to-the-playground',count:1}]);
});
it('Betrayal follows Ambessa target for ordinary attacks and spells; two kills must belong to either partner, not the pair sum',()=>{
 const s=combat('betrayal',['maddie','ambessa']),c=context(s,1),m=c.units.find(u=>u.definitionId==='maddie')!,a=c.units.find(u=>u.definitionId==='ambessa')!,e=c.units.find(u=>u.team==='enemy')!;
 a.targetId=e.id;expect(batch2Target(m,c.units)?.id).toBe(e.id);
 batch2Kill(c,m,e,()=>1);batch2Kill(c,a,e,()=>2);
 expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:'betrayal',count:0}]);
 batch2Kill(c,a,e,()=>3);expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:'betrayal',count:1}]);
});
it('Betrayal needs both partners fielded and counts champion and PvE monster kills, never summons (P-AG5)',()=>{
 expect(combat('betrayal',['maddie']).units.some(u=>u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'))).toBe(false);
 const s=combat('betrayal',['maddie','ambessa']),c=context(s,1),a=c.units.find(u=>u.definitionId==='ambessa')!,e=c.units.find(u=>u.team==='enemy')!;
 for(const definitionId of ['g23-sion','g23-forge','s13-mini'])batch2Kill(c,a,{...e,definitionId},()=>1);
 batch2Kill(c,a,{...e,itemSummon:{} as never},()=>1);
 expect(a.batch2?.kills).toBeUndefined();
 batch2Kill(c,a,{...e,definitionId:'s13-wolf'} as typeof e,()=>1);
 expect(a.batch2?.kills).toBeUndefined();
 batch2Kill(c,a,e,()=>2);expect(a.batch2?.kills).toBe(1);
 batch2Kill(c,a,{...e,definitionId:'neutral-stage-2',unitKind:'neutral'} as typeof e,()=>3);expect(a.batch2?.kills).toBe(2);
});
it('Pit Fighters gain 45 HP per win and 1.5% AD per loss; draws grant neither, and source history is not mutated',()=>{
 const s=combat('pit-fighter-prizefighter',['urgot']),base=createMatch(42);let p=createG23Progress(42);
 for(const [i,result] of ['win','loss','win','draw'].entries())p=advanceG23Economy(p,fact(i+1,[],result as 'win'|'loss'|'draw')).progress;
 const preparation={...base.preparation,units:[{...base.preparation.units[0],definitionId:'urgot'}]},input={...base,round:5,preparation,augments:[{definitionId:'pit-fighter-prizefighter',choiceId:'test',acquiredRound:1}],g23:p};
 const before=JSON.stringify(input),snap=buildStrategySnapshot(input),zero=buildStrategySnapshot({...input,g23:createG23Progress(42)});
 expect(snap.units[0].stats.health-zero.units[0].stats.health).toBe(90);expect(snap.units[0].attackDamagePercentBps!-zero.units[0].attackDamagePercentBps!).toBe(150);expect(JSON.stringify(input)).toBe(before);expect(s.units).toHaveLength(2);
});
it('the paired rocket variants exclude each other and Chembaron/Family retain their global offer blocks',()=>{
 const old=(id:string)=>[{definitionId:id,choiceId:'old',acquiredRound:1}];
 expect(augmentOfferAllowed('rocket-collection',old('rocket-collection-plus'),{node:'3-2',fieldedTraits:['artillerist'],blocked:[]})).toBe(false);
 expect(augmentOfferAllowed('rocket-collection-plus',old('rocket-collection'),{node:'3-2',fieldedTraits:['artillerist'],blocked:[]})).toBe(false);
 for(const id of ['crimson-pact','welcome-to-the-playground'])expect(augmentOfferAllowed(id,[],{node:'2-1',fieldedTraits:[],blocked:[id]})).toBe(false);
});
it('Chembaron skip heals four HP, caps at 100, pays six gold once and records the original skip choice',()=>{
 let base={...createMatch(42),phase:'settlement' as const,playerHp:98,augments:[{definitionId:'crimson-pact',choiceId:'test',acquiredRound:1}]} as MatchState,p=readG23Progress(base)!;
 for(let i=1;i<=4&&!p.chem.offer;i++)p=advanceG23Economy(p,{...fact(i),chemBaronTier:3,result:'loss',alliedDeaths:3}).progress;
 expect(p.chem.offer).not.toBeNull();base=writeG23Progress({...base,round:p.chem.offer!.round},p);
 const offer=p.chem.offer!,opened=openMechanicChoice(base,{choiceId:offer.id,returnPhase:'settlement',offers:offer.optionIds,payload:{kind:'blackMarket',grantItem:false,source:'black-market',skippable:true,skipReward:{kind:'health-per-skip',amount:1},timeoutOption:'@skip'}});
 if(!opened.ok)throw Error(opened.reason);const selected=resolveMechanicChoice(opened.state,'@skip');if(!selected.ok)throw Error(selected.reason);
 const after=finishG23Choice(opened.state,selected.state,'@skip');expect(after.playerHp).toBe(100);expect(after.gold-base.gold).toBe(6);expect(drainBatch2Gold(after)).toBe(after);validateBatch2Gold(after);
 expect(resolveMechanicChoice(after,'@skip').ok).toBe(false);
});
it('heals before battle and after settlement reconstruct separately, preserving HP cap and round order',()=>{
 const base=createMatch(42),skip=(receiptId:string,round:number)=>({kind:'choice' as const,receiptId,round,roundId:'2-1',source:'black-market',choiceKind:'blackMarket' as const,optionId:'@skip',skipped:true,price:0,itemId:null,timedOut:false});
 const s={...base,augments:[{definitionId:'crimson-pact',choiceId:'a',acquiredRound:1}],seatMechanics:{...base.seatMechanics!,receipts:[skip('pre',4),skip('post',4)]},roundResults:[{round:4,mechanicReceiptPrefixLength:1}]} as unknown as MatchState;
 expect(batch2HpBeforeBattle(s,'2-1',90)).toBe(94);expect(batch2HpAfterSettlement(s,4,60)).toBe(64);
 expect(batch2HpBeforeBattle(s,'2-1',99)).toBe(100);
});
