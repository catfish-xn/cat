import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {afterAll,afterEach,expect,it,vi} from 'vitest';
const fault=vi.hoisted(()=>({hook:''}));
vi.mock('../src/simulation/seat-mechanics/choices',async importOriginal=>{
 const real=await importOriginal<typeof import('../src/simulation/seat-mechanics/choices')>();
 return {...real,
  openMechanicChoice:(...args:Parameters<typeof real.openMechanicChoice>)=>fault.hook==='choice'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:real.openMechanicChoice(...args),
 };
});
import {createMatch,setShopLock,buyUnit,claimOrb,openAnvil,type MatchState} from '../src/simulation/match';
import {readLootView} from '../src/simulation/loot-view';
import {isAnvil} from '../src/simulation/content/anvils';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards,openG23Choice} from '../src/simulation/g2-3-runtime';
import {grantG23Academy} from '../src/simulation/g2-3-match-progress';
import {freeze} from './combat-helpers';
import type {MatchEvent} from '../src/simulation/match-types';
// Opening-encounter imports make grants re-enter the barrel while an async
// importOriginal factory is pending. Spy after module evaluation so the injected
// failure reaches the actual live export; retain all failure/resource assertions.
import * as grants from '../src/simulation/seat-mechanics/grants';
const goldGrant=grants.grantMechanicGold,itemGrant=grants.grantMechanicItem;
const goldSpy=vi.spyOn(grants,'grantMechanicGold').mockImplementation((...args)=>fault.hook==='rewards'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:goldGrant(...args));
const itemSpy=vi.spyOn(grants,'grantMechanicItem').mockImplementation((...args)=>fault.hook==='academy'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:itemGrant(...args));
afterAll(()=>{goldSpy.mockRestore();itemSpy.mockRestore();});
afterEach(()=>{fault.hook='';});
it('a failed reward atom preserves its input resources and emits an observable reason',()=>{
 const base=createMatch(42),state=writeG23Progress(base,{...readG23Progress(base)!,rewards:[{id:'reward',round:1,source:'conqueror',tier:1,reward:{Gold:2}}]});
 const before=JSON.stringify(state),events:MatchEvent[]=[];fault.hook='rewards';
 expect(drainG23Rewards(freeze(state),undefined,events)).toBe(state);
 expect(events).toEqual([{type:'mechanicFailed',hook:'rewards',reason:'invalid-mechanic-state'}]);
 expect(JSON.stringify(state)).toBe(before);
});
it('a failed academy grant is observable through the public accept hook without minting a receipt',()=>{
 const base=createMatch(42),state:MatchState={...base,preparation:{...base.preparation,units:['lux','leona','ezreal'].map((definitionId,col)=>({id:'a'+col,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col,row:4}}}))}};
 fault.hook='academy';
 const direct=grantG23Academy(freeze(state));expect(direct.state).toBe(state);
 expect(direct.events).toEqual([{type:'mechanicFailed',hook:'academy',reason:'invalid-mechanic-state'}]);
 const result=setShopLock(state,true,state.shop.generation);expect(result.ok).toBe(true);
 if(!result.ok)throw Error(result.reason);
 expect(result.events).toContainEqual(expect.objectContaining({type:'mechanicFailed',hook:'academy'}));
 expect(result.state.items).toEqual(state.items);expect(result.state.seatMechanics?.receipts).toEqual(state.seatMechanics?.receipts);
});
function armory(){
 const base=createMatch(42);return writeG23Progress({...base,preparation:{...base.preparation,units:[{id:'rumble',definitionId:'rumble',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:0,row:4}}}]}},{...readG23Progress(base)!,junkerRounds:3});
}
it.each(['armory','blackMarket'] as const)('a failed %s open preserves the input and reports the failed hook',kind=>{
 const base=createMatch(42),p=readG23Progress(base)!;
 const state=kind==='armory'?armory()
  :writeG23Progress(base,{...p,chem:{...p.chem,offer:{id:'market',tier:1,optionId:'TFT13_Crime_LootA4',optionIds:['TFT13_Crime_LootA4'],round:1,concreteItems:[]}}});
 expect(openG23Choice(state).state.pendingChoice?.kind).toBe(kind);
 fault.hook='choice';
 expect(openG23Choice(freeze(state))).toEqual({state,events:[{type:'mechanicFailed',hook:'choice',reason:'invalid-mechanic-state'}]});
});
// v22 anvil units: a conqueror forge no longer pops up from openG23Choice; it is
// claimed as a bench anvil and opened explicitly. The failed open keeps the input.
it('a failed forge open preserves the input and reports the failed hook',()=>{
 const base=createMatch(42),p=readG23Progress(base)!;
 let state=drainG23Rewards(writeG23Progress(base,{...p,rewards:[{id:'forge',round:1,source:'conqueror',tier:9,reward:g23ConquerorReward(G23_CONQUEROR_CHESTS[8])}]}));
 expect(openG23Choice(state).state.pendingChoice).toBeNull();
 const orb=readLootView(state).unclaimedOrbs!.find(o=>o.orbId.startsWith('g23-anvil:'))!;
 const claimed=claimOrb(state,orb.orbId,state.round);if(!claimed.ok)throw Error(claimed.reason);state=claimed.state;
 const anvil=state.preparation.units.find(u=>isAnvil(u.definitionId))!;
 const opened=openAnvil(state,anvil.id);expect(opened.ok&&opened.state.pendingChoice?.kind).toBe('forge');
 fault.hook='choice';
 expect(openAnvil(freeze(state),anvil.id)).toEqual({ok:false,state,reason:'invalid-mechanic-state'});
});
it.each(['blackMarket','other-armory'] as const)('equipment acceptance never replaces an armory with %s',mode=>{
 const opened=openG23Choice(armory()).state,choice=opened.pendingChoice!;
 const p=readG23Progress(opened)!;
 const state=mode==='blackMarket'?writeG23Progress(opened,{...p,chem:{...p.chem,offer:{id:'different-market',tier:1,optionId:'TFT13_Crime_LootA4',optionIds:['TFT13_Crime_LootA4'],round:1,concreteItems:[]}}})
  :{...opened,pendingChoice:{...choice,choiceId:'g23:junker:other',eventId:'g23:junker:other'}};
 const purchasable={...state,gold:20,shop:{...state.shop,slots:[{status:'available' as const,definitionId:'lux'}]}};
 // Trading while a popup is folded away is multiplayer-only.
 const online={...purchasable,multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]}};
 const result=buyUnit(freeze(online),0,online.shop.generation);expect(result.ok).toBe(true);
 expect(result.state.pendingChoice).toEqual(online.pendingChoice);
});

it('a failed armory refresh remains observable without replacing the pending choice',()=>{
 const state=openG23Choice(armory()).state,choice=state.pendingChoice!;
 fault.hook='choice';
 const online={...state,gold:20,shop:{...state.shop,slots:[{status:'available' as const,definitionId:'lux'}]},multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]}};
 const result=buyUnit(freeze(online),0,online.shop.generation);expect(result.ok).toBe(true);
 if(!result.ok)throw Error(result.reason);
 expect(result.state.pendingChoice).toEqual(choice);
 expect(result.events).toContainEqual(expect.objectContaining({type:'mechanicFailed',hook:'choice',reason:'invalid-mechanic-state'}));
});
