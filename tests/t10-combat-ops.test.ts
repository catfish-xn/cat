import { describe, expect, it } from 'vitest';
import { buyUnit, sellUnit, rerollShop, buyXp, setShopLock, deployMatchUnit, validateMatchDeployment,
  combineItems, equipItem, startMatchCombat, stepMatch, type MatchState, type MatchCommandResult } from '../src/server-entry';
import { previewCombine, previewEquip } from '../src/simulation/item-selectors';
import { freeze } from './combat-helpers';
import { accepted, bench, board, hero, operating } from './t10-helpers';

function rejected(state: MatchState, command: (s:MatchState)=>MatchCommandResult, reason: string) {
  const before=structuredClone(state), result=command(freeze(state));
  expect(result).toEqual({ok:false,state,reason}); expect(result.state).toBe(state); expect(state).toEqual(before);
}
const commands: [string,(s:MatchState)=>MatchCommandResult][] = [
  ['buy',s=>buyUnit(s,0,s.shop.generation)],['sell',s=>sellUnit(s,'unit-2')],['reroll',rerollShop],['buyXp',buyXp],
  ['shopLock',s=>setShopLock(s,true,s.shop.generation)],['bench swap',s=>deployMatchUnit(s,'unit-2',bench(2))],
  ['bench move',s=>deployMatchUnit(s,'unit-2',bench(8))],['combine',s=>combineItems(s,'item-1','item-2')],
  ['equip',s=>equipItem(s,'item-1','unit-2',0)],
];
describe('t10-combat-ops phase whitelist',()=>{
  for (const phase of ['combat','choice','settlement'] as const) {
    it.each(commands)(`${phase} allows %s while preserving frozen input and combat`,(_name,command)=>{
      const state=operating(phase), before=structuredClone(state), result=command(freeze(state)), next=accepted(result);
      expect(state).toEqual(before);expect(next.phase).toBe(phase);
      expect(next.combatInputBasis).toBe(state.combatInputBasis); expect(next.combat).toBe(state.combat);
      expect(next.battleSeedRngState).toBe(state.battleSeedRngState);
      expect(next.pendingChoice).toBe(state.pendingChoice);expect(next.roundResults).toBe(state.roundResults);
      if(_name==='buy')expect(next.preparation.units.find(u=>u.id==='unit-10')?.location.kind).toBe('bench');
      if(_name==='bench swap')expect(next.preparation.units.find(u=>u.id==='unit-3')?.location).toEqual(bench(0));
    });
    it(`${phase} forbids board sale/deployment, including bench-to-occupied-board swaps`,()=>{
      const state=operating(phase), unit=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
      rejected(state,s=>sellUnit(s,unit.id),'wrong-phase');
      rejected(state,s=>deployMatchUnit(s,unit.id,bench(0)),'wrong-phase');
      rejected(state,s=>deployMatchUnit(s,unit.id,board(1)),'wrong-phase');
      rejected(state,s=>deployMatchUnit(s,'unit-2',unit.location),'wrong-phase');
      rejected(state,s=>deployMatchUnit(s,'unit-2',board(1)),'wrong-phase');
      expect(equipItem(state,'item-1',unit.id,0).ok).toBe(true);
      rejected(state,startMatchCombat,'wrong-phase');
      expect(previewEquip(state,'item-1',unit.id,0)).toMatchObject({allowed:true});
      expect(validateMatchDeployment(state,'unit-2',unit.location)).toBe('wrong-phase');
      expect(previewEquip(state,'item-1','unit-2',0).allowed).toBe(true);
      expect(previewCombine(state,'item-1','item-2').allowed).toBe(true);
    });
    it(`${phase} retains offline restrictions and rejects eliminated seats`,()=>{
      const base=operating(phase), {multiplayer:_online,...offline}=base;
      for (const [name,command] of commands) {
        if (name === 'equip' || name === 'combine') expect(command(offline).ok).toBe(true);
        else rejected(offline,command,'wrong-phase');
        rejected({...base,multiplayer:{...base.multiplayer!,status:'eliminated'}},command,'wrong-phase');
        rejected({...base,phase:'gameOver',combat:null},command,'wrong-phase');
      }
    });
  }
  it('retains stale-shop, resources, capacity and equipment failures without partial updates',()=>{
    const state=operating('combat');
    rejected(state,s=>buyUnit(s,0,s.shop.generation-1),'stale-shop');
    rejected(state,s=>setShopLock(s,true,s.shop.generation-1),'stale-shop');
    rejected({...state,gold:0},s=>buyUnit(s,0,s.shop.generation),'insufficient-gold');
    rejected({...state,gold:0},rerollShop,'insufficient-gold');
    rejected({...state,gold:0},buyXp,'insufficient-gold');
    rejected({...state,level:10,xp:0},buyXp,'max-level');
    rejected(state,s=>sellUnit(s,'missing'),'unknown-unit');
    rejected(state,s=>deployMatchUnit(s,'unit-2',bench(9)),'invalid-location');
    rejected(state,s=>combineItems(s,'item-1','item-1'),'same-item');
    rejected(state,s=>equipItem(s,'missing','unit-2',0),'unknown-item');
    const full={...state,shop:{...state.shop,slots:[{status:'available' as const,definitionId:'irelia'}]},
      preparation:{...state.preparation,units:[...state.preparation.units.filter(u=>u.location.kind==='board'),
        ...Array.from({length:9},(_,i)=>hero(`full-${i}`,bench(i),'maddie',3))]}};
    rejected(full,s=>buyUnit(s,0,s.shop.generation),'bench-full');
  });
  it('the same frozen PvE battle keeps identical tick events, RNG and terminal result after operations',()=>{
    const initial=operating('combat');let changed=initial;
    for(const [,command] of commands.filter(([name])=>name!=='sell'&&name!=='equip'))changed=accepted(command(changed));
    changed=accepted(equipItem(changed,'item-3','unit-2',0));
    let control=initial,budget=1201;
    while(control.phase==='combat' && budget-->0){
      const a=stepMatch(control),b=stepMatch(changed);
      expect(b.events.filter(e=>'tick' in e)).toEqual(a.events.filter(e=>'tick' in e));
      expect(b.state.combat).toEqual(a.state.combat);
      control=a.state;changed=b.state;
    }
    expect(budget).toBeGreaterThanOrEqual(0);expect(changed.combatInputBasis).toEqual(initial.combatInputBasis);
    expect(changed.shop).not.toEqual(control.shop);
  });
});

describe('t10-choice trading keeps anomaly selection usable',()=>{
  it('refuses sales of the selected bench target and other units until confirmation',async()=>{
    const { selectAnomalyTarget, selectChoice }=await import('../src/simulation/match');
    const { catalogPreparation }=await import('./t5r-helpers');
    const base=operating('choice'),catalog=catalogPreparation('4-6'),choiceId='round:4-6:anomaly';
    const state:MatchState={...base,round:catalog.round,roundDefinitionId:catalog.roundDefinitionId,m8:catalog.m8,
      pendingChoice:{kind:'anomaly',step:'target',choiceId,eventId:choiceId,generation:0,offers:[],targetId:null,rerollCount:0,returnPhase:'preparation'}};
    const targeted=accepted(selectAnomalyTarget(state,choiceId,0,'unit-2'));
    for (const unit of targeted.preparation.units.filter(u=>u.team==='player'))
      rejected(targeted,s=>sellUnit(s,unit.id),'wrong-phase');
    rejected(targeted,s=>selectAnomalyTarget(s,choiceId,1,'unit-3'),'invalid-choice');
    rejected(targeted,s=>selectChoice(s,choiceId,0,targeted.pendingChoice!.offers[0]),'stale-choice');
    const chosen=accepted(selectChoice(targeted,choiceId,1,targeted.pendingChoice!.offers[0]));
    expect(chosen.anomalyBinding?.unitId).toBe('unit-2');
    expect(accepted(sellUnit(chosen,'unit-2')).preparation.units.some(u=>u.id==='unit-2')).toBe(false);
  });
  it('buying a triple migrates a consumed anomaly target and invalidates its old generation',()=>{
    const base=operating('choice'),state:MatchState={...base,
      preparation:{...base.preparation,units:[hero('unit-1',board(3)),hero('unit-2',bench(0)),hero('unit-3',bench(1),'irelia')]},
      shop:{generation:1,slots:[{status:'available',definitionId:'maddie'}]},
      pendingChoice:{kind:'anomaly',step:'offer',choiceId:'anomaly',eventId:'anomaly',generation:1,offers:['mage-armor'],targetId:'unit-2',rerollCount:0,returnPhase:'preparation'}};
    const next=accepted(buyUnit(state,0,1));
    expect(next.pendingChoice).toMatchObject({targetId:'unit-1',generation:2,offers:['mage-armor']});
    expect(next.choiceRngState).toBe(state.choiceRngState);
  });
});
