import {expect,it} from 'vitest';
import {createMatch,equipItem,snapshotForBattle,compileBattle,startTwoSidedCombat,stepCombat} from '../src/server-entry';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {initializeShroud} from '../src/simulation/combat-g2-4b';
import {unit} from './combat-helpers';
import type {MatchState} from '../src/simulation/match-types';

function seat(shroud:boolean,col=3):MatchState {
  const base=createMatch(42),round=getCatalogRoundById('2-1');
  let state:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},
    preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'lux',starLevel:3,team:'player',location:{kind:'board',cell:{col,row:4}}}]}};
  if(shroud){
    const grant=grantMechanicItem(state,{receiptId:'shroud',source:'test',definitionId:'TFT_Item_Shroud'});if(!grant.ok)throw Error(grant.reason);
    const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,'unit-1',0);if(!equip.ok)throw Error(equip.reason);
    state=equip.state;
  }
  return state;
}

it('adds source 150 holder HP and 60 allied HP through the strategy compiler',()=>{
  const plain=buildStrategySnapshot(seat(false)).units[0],equipped=buildStrategySnapshot(seat(true)).units[0];
  expect(equipped.stats.health-plain.stats.health).toBe(210);
  const bench=seat(true),owner=bench.preparation.units[0];
  const benched={...bench,preparation:{...bench.preparation,units:[{...owner,location:{kind:'bench' as const,slot:0}}]}};
  expect(buildStrategySnapshot(benched).units).toHaveLength(0);
});

it('applies to the opposing seat after board mirroring and clears on its first cast',()=>{
  const input=compileBattle(snapshotForBattle(seat(true),'A'),snapshotForBattle(seat(false),'B'),42);
  let combat=startTwoSidedCombat(input);
  const victim=combat.units.find(u=>u.team==='enemy')!;
  expect(victim.unreavedMaxMana).toBeGreaterThan(0);
  expect(victim.maxMana).toBe(Math.ceil(victim.unreavedMaxMana!*1.3));
  let cast=false;
  for(let n=0;n<600&&combat.status==='running';n++){
    const next=stepCombat(combat);combat=next.state;
    if(next.events.some(e=>e.type==='cast'&&'receipt' in e&&e.receipt.source.ownerId===victim.id)){
      const current=combat.units.find(u=>u.id===victim.id)!;
      expect(current.maxMana).toBe(victim.unreavedMaxMana);cast=true;break;
    }
  }
  expect(cast).toBe(true);
  expect(stepCombat(combat).state.units.find(u=>u.id===victim.id)!.maxMana).toBe(victim.unreavedMaxMana);
});

it('leaves off-beam enemies and zero-mana units unchanged; overlapping shrouds do not multiply the cost',()=>{
  const source={ownerId:'p',sourceKind:'item' as const,definitionId:'TFT_Item_Shroud',instanceId:'i',effectIndex:1};
  const holder=unit('p','player',3,6,{mechanics:[{source,mechanic:'g24Shroud',values:{costIncreaseBps:3000,allyHealth:60}}]});
  const on=unit('on','enemy',3,1,{maxMana:75}),off=unit('off','enemy',0,1,{maxMana:75}),zero=unit('zero','enemy',4,1,{maxMana:0});
  const result=initializeShroud([holder,{...holder,id:'p2'},on,off,zero]);
  expect(result.find(u=>u.id==='on')).toMatchObject({maxMana:98,unreavedMaxMana:75});
  expect(result.find(u=>u.id==='off')).toBe(off);expect(result.find(u=>u.id==='zero')).toBe(zero);
});
