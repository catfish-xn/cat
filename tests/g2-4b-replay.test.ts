import {expect,it} from 'vitest';
import {createMatch,equipItem,snapshotForBattle,compileBattle,resolveTwoSidedBattle} from '../src/server-entry';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {toCombatReplay,applyCombatReplayTick,toCombatViewState} from '../src/simulation/combat-replay-view';
import {stepCombat} from '../src/simulation/combat';
import type {MatchState} from '../src/simulation/match-types';

function seat(item?:string):MatchState {
  const base=createMatch(42),round=getCatalogRoundById('2-1');
  let state:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},
    preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'lux',starLevel:3,
      team:'player',location:{kind:'board',cell:{col:3,row:4}}}]}};
  if(item){
    const grant=grantMechanicItem(state,{receiptId:'replay-item',source:'test',definitionId:item});
    if(!grant.ok)throw Error(grant.reason);
    const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,'unit-1',0);
    if(!equip.ok)throw Error(equip.reason);
    state=equip.state;
  }
  return state;
}

it.each(['TFT_Item_Artifact_Fishbones','TFT_Item_Artifact_SpectralCutlass','TFT_Item_Shroud','TFT4_Item_OrnnDeathsDefiance','TFT9_Item_OrnnTrickstersGlass','TFT4_Item_OrnnTheCollector','TFT7_Item_ShimmerscaleGamblersBlade','TFT7_Item_ShimmerscaleMogulsMail'])(
  '%s reproduces every compact replay frame and rejects a missing visible action',item=>{
    const input=compileBattle(snapshotForBattle(seat(item),'A'),snapshotForBattle(seat(),'B'),42);
    const battle=resolveTwoSidedBattle(input,1201), replay=toCombatReplay(battle);
    let actual=battle.initial, view=replay.initial;
    for(const frame of replay.ticks){
      if(frame.tick>0)actual=stepCombat(actual).state;
      view=applyCombatReplayTick(view,frame);
      expect(view).toEqual(toCombatViewState(actual));
    }
    expect(view).toEqual(replay.terminal);
    const attack=battle.events.find(e=>e.type==='attack')!;
    expect(attack).toBeDefined();
    expect(()=>toCombatReplay({...battle,events:battle.events.filter(e=>e.eventSeq!==attack.eventSeq)}))
      .toThrow('replay-divergence');
    if(item==='TFT_Item_Shroud'){
      const victim=battle.initial.units.find(u=>u.team==='enemy')!;
      expect(victim.unreavedMaxMana).toBeGreaterThan(0);
      expect(battle.terminal.units.find(u=>u.id===victim.id)!.maxMana).toBe(victim.unreavedMaxMana);
    }
  });
