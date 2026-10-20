import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import type { Unit } from '../src/simulation/unit-types';
import { M5_UNIT_DEFINITIONS, UNIT_DEFINITIONS } from '../src/simulation/units';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { projectEffectiveMembership, type TraitProjectionContext, type TraitProjectionSource } from '../src/simulation/traits/effective-membership';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { createMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../src/simulation/round-settlement';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { reachRound, battle } from './match-helpers';
import { freeze } from './combat-helpers';

const unit = (id:string, definitionId:string, col=0, row=4, team:Unit['team']='player'):Unit =>
  ({id,definitionId,team,starLevel:1,location:{kind:'board',cell:{col,row}}});
const preparation = (units:readonly Unit[]):GameState => ({board:DEFAULT_BOARD,benchSize:9,units});
const context = (sources:readonly TraitProjectionSource[],round=4):TraitProjectionContext => ({round,sources});
const duration = {activeFromRound:4,expiresBeforeRound:6};
const row = (p:GameState,id:string,c?:TraitProjectionContext) => deriveTraits(p,'player',undefined,c).find(t=>t.traitId===id)!;
const compiled = (p:GameState,c?:TraitProjectionContext) => buildStrategySnapshot({...createMatch(42),round:c?.round??4,preparation:p},undefined,c);

it('preserves every native trait/count/tier/target on every current champion, duplicates, bench and both teams',()=>{
  // Independent oracle enumerates native definitions; does not call the projection.
  const all=Object.values(M5_UNIT_DEFINITIONS).filter(d=>d.unitKind!=='neutral');
  for(let offset=0;offset<all.length;offset++){
    const names=Array.from({length:9},(_,i)=>all[(offset+i)%all.length].id);
    const army=names.map((name,i)=>unit('u'+i,name,i%7,4+Math.floor(i/7)));
    const p=preparation([...army,{...army[0],id:'copy'},{...army[1],id:'bench',location:{kind:'bench',slot:0}},unit('enemy',names[2],0,0,'enemy')]);
    for(const team of ['player','enemy'] as const){
      const board=p.units.filter(u=>u.team===team&&u.location.kind==='board').sort((a,b)=>a.id<b.id?-1:1);
      const expected=Object.keys(TRAIT_DEFINITIONS).sort().map(traitId=>{
        const d=TRAIT_DEFINITIONS[traitId],members=board.filter(u=>UNIT_DEFINITIONS[u.definitionId].traits.includes(traitId));
        const memberDefinitionIds=[...new Set(members.map(u=>u.definitionId))].sort(),count=memberDefinitionIds.length;
        const tier=traitId==='emissary'&&count!==1&&count!==4?0:Math.max(0,...d.tiers.filter(t=>t.threshold<=count).map(t=>t.threshold));
        return {team,traitId,count,tier,memberDefinitionIds,targetUnitIds:tier===0?[]:(d.target==='team'?board:members).map(u=>u.id)};
      });
      expect(deriveTraits(freeze(p),team)).toEqual(expected);
    }
  }
});
it('Q3 projects temporary unit entry, removal and return without changing ownership or population input',()=>{
  const p=freeze(preparation([unit('a','darius'),unit('b','draven',1)])),saved=JSON.stringify(p);
  const add:TraitProjectionSource={...duration,sourceId:'duo:unit',kind:'add-unit',unit:unit('c','ambessa',2)};
  const remove:TraitProjectionSource={...duration,sourceId:'unknown:a',kind:'remove-unit',unitId:'a'};
  expect(row(p,'conqueror',context([add])).count).toBe(3);
  expect(row(p,'conqueror',context([remove])).tier).toBe(0);
  expect(row(p,'conqueror',context([remove],6)).tier).toBe(2);
  expect(row(p,'conqueror',context([add],6)).count).toBe(2);
  expect(JSON.stringify(p)).toBe(saved);
  const replacement=context([{...add,sourceId:'a:add',unit:unit('c','ambessa')},{...remove,sourceId:'z:remove'}]);
  expect(row(p,'conqueror',replacement).memberDefinitionIds).toEqual(['ambessa','draven']);
  const c=context([remove]);
  expect(compiled(p,c).units.map(u=>u.unitId)).toEqual(['b']);
  expect(createCombatWithEvents(p,compiled(p,c),'absence',42,c).state.units.map(u=>u.id)).toEqual(['b']);
});
it('temporary emblem joins and expires at the exclusive boundary, with provenance and instance-specific member effects',()=>{
  const p=preparation([unit('leona','leona'),unit('a','lux',1),unit('b','lux',2)]);
  const emblem:TraitProjectionSource={...duration,sourceId:'calling-card:a',kind:'emblem',unitId:'a',traitId:'sentinel',itemInstanceId:'emblem-1'};
  const c=context([emblem]),projection=projectEffectiveMembership(freeze(p),freeze(c));
  expect(projection.members.find(m=>m.unitId==='a'&&m.traitId==='sentinel')?.sourceIds).toEqual(['calling-card:a']);
  expect(row(p,'sentinel',c)).toMatchObject({count:2,tier:2,memberUnitIds:['a','leona'],targetUnitIds:['a','b','leona']});
  const strategy=compiled(p,c),a=strategy.units.find(u=>u.unitId==='a')!,b=strategy.units.find(u=>u.unitId==='b')!;
  expect(a.stats.armor-b.stats.armor).toBe(24); // current catalog Sentinel2 member bonus = 2*12
  expect(row(p,'sentinel',context([emblem],6))).toMatchObject({count:1,tier:0});
  expect(row(p,'sentinel',context([emblem],3))).toMatchObject({count:1,tier:0});
});
it('bench, absent and enemy emblem holders never add player membership',()=>{
  const p=preparation([unit('d','darius'),{...unit('l','lux'),location:{kind:'bench',slot:0}},unit('e','lux',0,0,'enemy')]);
  const sources:TraitProjectionSource[]=['l','e'].map(id=>({...duration,sourceId:'emblem:'+id,kind:'emblem',unitId:id,traitId:'conqueror',itemInstanceId:'i:'+id}));
  expect(row(p,'conqueror',context(sources)).count).toBe(1);
  const c=context([...sources,{...duration,sourceId:'absent',kind:'remove-unit',unitId:'e'}]);
  expect(deriveTraits(p,'enemy',undefined,c).find(t=>t.traitId==='conqueror')?.count).toBe(0);
});
it('membership removal and duplicate definitions use the same distinct count and target instances',()=>{
  const p=preparation([unit('d1','darius'),unit('d2','darius',1),unit('dr','draven',2)]);
  const c=context([{...duration,sourceId:'remove:d1',kind:'remove-trait',unitId:'d1',traitId:'conqueror'}]);
  expect(row(p,'conqueror',c)).toMatchObject({count:2,tier:2,memberUnitIds:['d2','dr'],targetUnitIds:['d2','dr']});
  expect(compiled(p,c).units.find(u=>u.unitId==='d1')?.attackDamagePercentBps).toBe(0);
});
it('black rose summon qualification and star totals consume the projected membership',()=>{
  const p=preparation([unit('m','morgana'),unit('v','vladimir',1),unit('l','lux',2),unit('enemy','garen',2,3,'enemy')]);
  const c=context([{...duration,sourceId:'rose:l',kind:'emblem',unitId:'l',traitId:'black-rose',itemInstanceId:'rose-emblem'}]);
  const strategy=compiled(p,c),rose=strategy.traits.find(t=>t.traitId==='black-rose'&&t.team==='player')!;
  expect(rose).toMatchObject({count:3,tier:3,memberUnitIds:['l','m','v']});
  const started=createCombatWithEvents(p,strategy,'rose',42,c).state;
  expect(started.units.some(u=>u.definitionId==='g23-sion')).toBe(true);
  const casting={...started,units:started.units.map(u=>u.id==='l'?{...u,runtime:{...u.runtime!,castCount:5}}:u)};
  expect(stepCombat(casting).state.units.find(u=>u.definitionId==='g23-sion')?.runtime?.buddyTriggered).toBe(true);
  expect(compiled(p,context(c.sources,6)).units.some(u=>u.unitId.endsWith(':g23-sion'))).toBe(false);
});
it('experiment membership uses the same dynamic tier and laboratory donors',()=>{
  const p=preparation([unit('z','zyra'),unit('n','nunu',1),unit('l','lux',2)]);
  const c=context([{...duration,sourceId:'experiment:l',kind:'add-trait',unitId:'l',traitId:'experiment'}]);
  const state={...createMatch(42),round:4,preparation:p,visibleExperimentCells:[{col:2,row:4}]};
  const s=buildStrategySnapshot(state,undefined,c);
  expect(s.traits.find(t=>t.traitId==='experiment'&&t.team==='player')).toMatchObject({count:3,tier:3});
  expect(s.units.find(u=>u.unitId==='l')?.mechanics?.some(m=>m.mechanic==='g23Experiment')).toBe(true);
});
it('Q5 rejects conflicting grants, duplicate source/emblem identities, native duplication and unique emblems without mutation',()=>{
  const p=freeze(preparation([unit('l','lux')]));
  const source:TraitProjectionSource={...duration,sourceId:'s',kind:'emblem',unitId:'l',traitId:'conqueror',itemInstanceId:'i'};
  const invalid:TraitProjectionSource[][]=[
    [source,source],[source,{...source,sourceId:'s2'}],
    [source,{...source,sourceId:'s2',traitId:'chem-baron'}],
    [{...source,traitId:'sorcerer'}],[{...source,traitId:'high-roller'}],
    [{...source,expiresBeforeRound:4}],[{...source,traitId:'unknown'}],
    [{...duration,sourceId:'unit',kind:'add-unit',unit:unit('l','lux')}],
  ];
  const saved=JSON.stringify(p);
  for(const sources of invalid)expect(()=>projectEffectiveMembership(p,context(sources))).toThrow(RangeError);
  expect(JSON.stringify(p)).toBe(saved);
});
it('no mutable-state cache: a later board or source edit always recomputes',()=>{
  const p=preparation([unit('d','darius'),unit('l','lux',1)]);
  const source={...duration,sourceId:'s',kind:'add-trait' as const,unitId:'l',traitId:'conqueror'};
  expect(row(p,'conqueror',context([source])).tier).toBe(2);
  source.expiresBeforeRound=4;
  source.activeFromRound=3;
  expect(row(p,'conqueror',context([source])).tier).toBe(0);
  expect(row({...p,units:[unit('d','darius'),unit('dr','draven',1)]},'conqueror').tier).toBe(2);
});

describe('current-board settlement and frozen combat share projection',()=>{
  it.each([false,true])('uses exact source lifetimes (expired=%s), rejects stale tiers atomically and pays once',expired=>{
    const base=reachRound('2-1'),enabled=enableMultiplayerSettlement(base,'A');
    if(!enabled.ok)throw Error(enabled.reason);
    const names=['darius','draven','ambessa','swain','singed','renata','renni','lux'];
    const p=preparation(names.map((name,i)=>unit(name,name,i%7,4+Math.floor(i/7))));
    const state=freeze({...enabled.state,preparation:p});
    const validity={activeFromRound:state.round-1,expiresBeforeRound:state.round+(expired?0:1)};
    const c=context([
      {...validity,sourceId:'unknown:ambessa',kind:'remove-unit',unitId:'ambessa'},
      {...validity,sourceId:'calling:lux',kind:'emblem',unitId:'lux',traitId:'chem-baron',itemInstanceId:'chem-emblem'},
    ],state.round);
    const strategy=compiled(p,c),traits=strategy.traits.filter(t=>t.team==='player');
    const tiers={conquerorTier:traits.find(t=>t.traitId==='conqueror')!.tier,chemBaronTier:traits.find(t=>t.traitId==='chem-baron')!.tier};
    expect(tiers).toEqual(expired?{conquerorTier:4,chemBaronTier:3}:{conquerorTier:2,chemBaronTier:4});
    const facts={battleId:'projected',round:state.round,roundKind:'pvp' as const,result:'loss' as const,...tiers,conquestTakedowns:['enemy'],alliedDeaths:1,rumbleStar:0 as const,highRollerGold:0};
    const receipt:RoundSettlementReceipt={version:ROUND_SETTLEMENT_VERSION,settlementId:'projected:A',battleId:'projected',seatId:'A',round:state.round,roundId:state.roundDefinitionId,
      settlementEligible:true,result:'loss',damage:2,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:80,combatEventCount:20,g23Facts:facts};
    const saved=JSON.stringify(state),wrong={...receipt,g23Facts:{...facts,conquerorTier:expired?2:4}};
    expect(applyRoundSettlement(state,wrong,undefined,c)).toEqual({ok:false,state,reason:'invalid-receipt'});
    const result=applyRoundSettlement(state,receipt,undefined,c);
    expect(result.ok).toBe(true);
    if(!result.ok)throw Error(result.reason);
    const before=readG23Progress(state)!,after=readG23Progress(result.state)!;
    expect(after.conquest.stacks-before.conquest.stacks).toBe(expired?3:1);
    expect(after.chem.shimmer-before.chem.shimmer).toBe(expired?15:20);
    expect(applyRoundSettlement(result.state,receipt,undefined,c)).toEqual({ok:false,state:result.state,reason:'duplicate-settlement'});
    expect(JSON.stringify(state)).toBe(saved);
  });
});
it('object/JSON restore of existing saves preserves projection; externally verified declarations replay identically',()=>{
  const state=battle(),restored=restoreMatch(serializeMatch(state));
  expect(deriveTraits(restored.preparation,'player')).toEqual(deriveTraits(state.preparation,'player'));
  expect(buildStrategySnapshot(restored)).toEqual(buildStrategySnapshot(state));
  expect(restoreMatch(state)).toEqual(restored);
  const reversed=context([{...duration,sourceId:'emblem-b',kind:'emblem',unitId:'l',traitId:'conqueror',itemInstanceId:'i-b'},
    {...duration,sourceId:'absent-a',kind:'remove-unit',unitId:'d'}]);
  const orderBoard=preparation([unit('d','darius'),unit('l','lux',1)]);
  expect(projectEffectiveMembership(orderBoard,{...reversed,sources:[...reversed.sources].reverse()})).toEqual(projectEffectiveMembership(orderBoard,reversed));
  const p=preparation([unit('d','darius'),unit('l','lux',1),unit('e','garen',1,3,'enemy')]);
  const c=context([{...duration,sourceId:'emblem',kind:'emblem',unitId:'l',traitId:'conqueror',itemInstanceId:'i'}]);
  const restoredInput=JSON.parse(JSON.stringify({p,c}));
  expect(projectEffectiveMembership(restoredInput.p,restoredInput.c)).toEqual(projectEffectiveMembership(p,c));
  let a=createCombatWithEvents(p,compiled(p,c),'replay',42,c),b=createCombatWithEvents(restoredInput.p,compiled(restoredInput.p,restoredInput.c),'replay',42,restoredInput.c);
  for(let tick=0;tick<25;tick++){
    expect(b).toEqual(a);
    a=stepCombat(a.state);b=stepCombat(JSON.parse(JSON.stringify(b.state)));
  }
});
