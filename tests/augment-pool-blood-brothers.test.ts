import { expect, it } from 'vitest';
import { createMatch, selectChoice, startMatchCombat, stepMatch, deployMatchUnit } from '../src/simulation/match';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { batch2BattleFacts, validateBatch2Facts, batch2RewardPlan } from '../src/simulation/augment-pool-batch2-progress';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { type AbilityContext } from '../src/simulation/combat-s13-abilities';
import { ap, type S13Unit } from '../src/simulation/combat-s13-state';
import { batch2Cast, batch2Kill } from '../src/simulation/augment-pool-batch2-combat';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted } from './match-helpers';
import { BattleHistory } from '../src/replay/history';
import { recordCommand, recordedEmptyRoute } from './fixtures/recorded-empty-route';

// Independent transcription of augments-14.24.json record [301] TFT13_TeamupAugment_BloodBrothers.
const HP_PER_CAST=30,AP_PER_DEATH=6;
const ID='blood-brothers';
const marked=(u:{mechanics?:readonly {mechanic:string;source:{definitionId:string}}[]})=>u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===ID)??false;
type Spec={id:string;definitionId:string;cell?:number;bench?:boolean};
function match(units:Spec[],g23?:ReturnType<typeof readG23Progress>,acquiredRound=1){
 const s=createMatch(42);
 const preparation={...s.preparation,units:[...units.map(u=>({id:u.id,definitionId:u.definitionId,starLevel:1 as const,team:'player' as const,location:u.bench?{kind:'bench' as const,slot:0}:{kind:'board' as const,cell:{col:u.cell??0,row:4}}})),
  {id:'enemy',definitionId:'garen',starLevel:1 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:2}}}]};
 return {...s,preparation,augments:[{definitionId:ID,choiceId:'test',acquiredRound}],...(g23?{g23}:{})};
}
function combat(units:Spec[]){
 const s=match(units);return createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'bb',42).state;
}
const context=(s:ReturnType<typeof combat>):AbilityContext=>({units:structuredClone(s.units) as S13Unit[],board:s.board,combatId:s.combatId,tick:5,events:[],heals:[],packets:[],draw:()=>0});
const fact=(round:number,casts:number,deaths:number):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind:round%2?'pvp':'pve',result:'win',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,
 batch2:[{definitionId:ID,count:casts},{definitionId:'blood-brothers-deaths',count:deaths}]});

it('binds only with both partners fielded; with copies, the earliest acquired serial (numeric, not lexical) binds',()=>{
 const alone=combat([{id:'unit-1',definitionId:'vander'}]);expect(alone.units.some(marked)).toBe(false);
 const benched=combat([{id:'unit-1',definitionId:'vander'},{id:'unit-2',definitionId:'silco',bench:true}]);expect(benched.units.some(marked)).toBe(false);
 const s=combat([{id:'unit-12',definitionId:'vander',cell:0},{id:'unit-3',definitionId:'vander',cell:1},{id:'unit-10',definitionId:'silco',cell:2},{id:'unit-9',definitionId:'silco',cell:4},{id:'unit-4',definitionId:'violet',cell:5}]);
 expect(s.units.filter(marked).map(u=>u.id).sort()).toEqual(['unit-3','unit-9']);
});
it('each Silco cast gives the live bound Vander +30 flat max HP and +30 current HP; Vander deaths give Silco +6 AP',()=>{
 const s=combat([{id:'unit-1',definitionId:'vander'},{id:'unit-2',definitionId:'silco',cell:1}]),c=context(s);
 const vander=c.units.find(u=>u.id==='unit-1')!,silco=c.units.find(u=>u.id==='unit-2')!,enemy=c.units.find(u=>u.id==='enemy')!;
 expect(vander.maxHpBasis?.bps??0).toBe(0);expect(vander.maxHpBasis?.bonusBps??0).toBe(0);
 const max=vander.maxHp;vander.hp=max-100;
 batch2Cast(c,silco);batch2Cast(c,silco);
 expect([vander.maxHp,vander.hp]).toEqual([max+2*HP_PER_CAST,max-100+2*HP_PER_CAST]);
 expect(c.events.filter(e=>e.type==='maxHpChanged')).toMatchObject([{unitId:'unit-1',beforeMax:max,afterMax:max+HP_PER_CAST,countsAsHeal:false},{unitId:'unit-1',afterMax:max+2*HP_PER_CAST}]);
 batch2Cast(c,vander);batch2Cast(c,enemy);expect(vander.maxHp).toBe(max+2*HP_PER_CAST);
 const before=ap(silco,c.tick,c.units);
 vander.alive=false;vander.hp=0;batch2Kill(c,enemy,vander,()=>1);
 expect(ap(silco,c.tick,c.units)-before).toBe(AP_PER_DEATH);
 // A revived Vander dying again counts again (every real death).
 vander.alive=true;vander.hp=1;batch2Kill(c,enemy,vander,()=>2);
 expect(ap(silco,c.tick,c.units)-before).toBe(2*AP_PER_DEATH);
 expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:ID,count:2},{definitionId:'blood-brothers-deaths',count:2}]);
});
it('casts and deaths still accrue to the player while the partner is dead, without touching the dead unit',()=>{
 const s=combat([{id:'unit-1',definitionId:'vander'},{id:'unit-2',definitionId:'silco',cell:1}]),c=context(s);
 const vander=c.units.find(u=>u.id==='unit-1')!,silco=c.units.find(u=>u.id==='unit-2')!,enemy=c.units.find(u=>u.id==='enemy')!;
 vander.alive=false;vander.hp=0;const max=vander.maxHp;batch2Cast(c,silco);expect(vander.maxHp).toBe(max);
 silco.alive=false;silco.hp=0;batch2Kill(c,enemy,vander,()=>1);expect(silco.batch2?.vanderDeaths).toBeUndefined();
 expect(batch2BattleFacts({...s,units:c.units},'player')).toEqual([{definitionId:ID,count:1},{definitionId:'blood-brothers-deaths',count:1}]);
});
it('permanent totals are summed from battle facts since acquisition (PvE included) and survive a copy swap',()=>{
 let p=readG23Progress(createMatch(42))!;
 for(const [round,casts,deaths] of [[1,9,9],[2,3,1],[3,2,0],[4,1,2]])p=advanceG23Economy(p,fact(round,casts,deaths)).progress;
 const units=[{id:'unit-1',definitionId:'vander'},{id:'unit-2',definitionId:'silco',cell:1}];
 const hp=(snap:ReturnType<typeof buildStrategySnapshot>,id:string)=>snap.units.find(u=>u.unitId===id)!;
 const input={...match(units,p,2),round:5},before=JSON.stringify(input),zero=buildStrategySnapshot(match(units,readG23Progress(createMatch(42))!,2)),snap=buildStrategySnapshot(input);
 expect(hp(snap,'unit-1').stats.health-hp(zero,'unit-1').stats.health).toBe((3+2+1)*HP_PER_CAST);
 const c0=createCombatWithEvents(input.preparation,zero,'z',42).state,c1=createCombatWithEvents(input.preparation,snap,'s',42).state;
 const silcoAp=(c:typeof c0)=>ap(c.units.find(u=>u.id==='unit-2') as S13Unit,0,c.units as S13Unit[]);
 expect(silcoAp(c1)-silcoAp(c0)).toBe((1+0+2)*AP_PER_DEATH);
 expect(JSON.stringify(input)).toBe(before);
 // Selling and rebuying gives new serials; the totals belong to the player, not the instance.
 const swapped={...match([{id:'unit-30',definitionId:'vander'},{id:'unit-31',definitionId:'silco',cell:1}],p,2),round:5};
 expect(buildStrategySnapshot(swapped).units.find(u=>u.unitId==='unit-30')!.stats.health).toBe(hp(snap,'unit-1').stats.health);
 expect(batch2RewardPlan(input)).toEqual([]);
});
it('strict facts reject a lone, negative or fractional Blood Brothers counter',()=>{
 validateBatch2Facts([{definitionId:ID,count:4},{definitionId:'blood-brothers-deaths',count:0}]);
 for(const x of [[{definitionId:ID,count:1}],[{definitionId:'blood-brothers-deaths',count:1}],[{definitionId:ID,count:-1},{definitionId:'blood-brothers-deaths',count:0}],[{definitionId:ID,count:1},{definitionId:'blood-brothers-deaths',count:0.5}]])
  expect(()=>validateBatch2Facts(x)).toThrow();
});
function acquire(){
  // Seed 178 is the first 2-1 Blood Brothers offer (pinned to avoid a per-test timeout; the loop asserts it still offers).
 for(let seed=178;seed<10000;seed++){ // starts at the first offering seed; the predicate is still checked
  const s=createMatch(seed),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  if(!generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,filter),s.choiceRngState).offers.includes(ID))continue;
  const history=new BattleHistory('blood-brothers-regression');
  const before=recordedEmptyRoute(seed,'2-1',history),c=before.pendingChoice!;return {state:accepted(selectChoice(before,c.choiceId,c.generation,ID)),history};
 }
 throw Error('missing seed');
}
it('Match grants 2-star Vander, Silco and Shojin, settles authoritative facts once, restores, and rejects tampered facts',()=>{
 const live=acquire(),history=live.history;let s=live.state;
 const vander=s.preparation.units.find(u=>u.definitionId==='vander'&&u.starLevel===2),silco=s.preparation.units.find(u=>u.definitionId==='silco');
 expect(vander).toBeDefined();expect(silco).toBeDefined();expect(s.items.some(i=>i.definitionId==='shojin')).toBe(true);
 for(const [i,u] of [vander!,silco!].entries())if(u.location.kind!=='board')s=accepted(deployMatchUnit(s,u.id,{kind:'board',cell:{col:i*3,row:7}}));
 const battles=readG23Progress(s)!.economyReceipts.length;
 s=accepted(recordCommand(history,s,startMatchCombat(s)));
 expect(s.combat!.units.filter(marked).map(u=>u.definitionId).sort()).toEqual(['silco','vander']);
 for(let i=0;i<1200&&s.phase==='combat';i++)s=recordCommand(history,s,stepMatch(s)).state;
 expect(s.phase).toBe('settlement');
 const receipts=readG23Progress(s)!.economyReceipts.slice(battles),last=receipts.at(-1)!;
 expect(last.kind).toBe('battle');
 const rows=last.kind==='battle'?last.facts.batch2?.filter(x=>x.definitionId.startsWith(ID)):[];
 expect(rows?.map(r=>r.definitionId)).toEqual([ID,'blood-brothers-deaths']);
 expect(restoreMatch(serializeMatch(s,history.completedRecords),history.completedRecords)).toEqual(s);
 const again=serializeMatch(s,history.completedRecords);expect(serializeMatch(stepMatch(s).state,history.completedRecords)).toBe(again);
 const forged=JSON.parse(again);
 const walk=(o:any):boolean=>{if(!o||typeof o!=='object')return false;if(Array.isArray(o)){for(const x of o)if(walk(x))return true;return false;}
  if(o.definitionId==='blood-brothers-deaths'&&typeof o.count==='number'){o.count+=0.5;return true;}for(const k of Object.keys(o))if(walk(o[k]))return true;return false;};
 expect(walk(forged)).toBe(true);
 expect(()=>restoreMatch(JSON.stringify(forged),history.completedRecords)).toThrow();
 const p=readG23Progress(s)!;
 expect(p.economyReceipts.length).toBe(battles+receipts.length);
});
