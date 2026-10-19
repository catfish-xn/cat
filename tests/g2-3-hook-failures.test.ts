import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {afterEach,expect,it,vi} from 'vitest';
const fault=vi.hoisted(()=>({hook:''}));
vi.mock('../src/simulation/seat-mechanics',async importOriginal=>{
 const real=await importOriginal<typeof import('../src/simulation/seat-mechanics')>();
 return {...real,
  grantMechanicGold:(...args:Parameters<typeof real.grantMechanicGold>)=>fault.hook==='rewards'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:real.grantMechanicGold(...args),
  grantMechanicItem:(...args:Parameters<typeof real.grantMechanicItem>)=>fault.hook==='academy'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:real.grantMechanicItem(...args),
  openMechanicChoice:(...args:Parameters<typeof real.openMechanicChoice>)=>fault.hook==='choice'?{ok:false,state:args[0],reason:'invalid-mechanic-state'}:real.openMechanicChoice(...args),
 };
});
import {createMatch,setShopLock,buyUnit,type MatchState} from '../src/simulation/match';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards,openG23Choice} from '../src/simulation/g2-3-runtime';
import {grantG23Academy} from '../src/simulation/g2-3-match-progress';
import {freeze} from './combat-helpers';
import type {MatchEvent} from '../src/simulation/match-types';
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
it.each(['armory','blackMarket','forge'] as const)('a failed %s open preserves the input and reports the failed hook',kind=>{
 const base=createMatch(42),p=readG23Progress(base)!;
 const state=kind==='armory'?armory():kind==='blackMarket'
  ?writeG23Progress(base,{...p,chem:{...p.chem,offer:{id:'market',tier:1,optionId:'TFT13_Crime_LootA4',round:1}}})
  :writeG23Progress(base,{...p,rewards:[{id:'forge',round:1,source:'conqueror',tier:9,reward:g23ConquerorReward(G23_CONQUEROR_CHESTS[8])}]});
 expect(openG23Choice(state).state.pendingChoice?.kind).toBe(kind);
 fault.hook='choice';
 expect(openG23Choice(freeze(state))).toEqual({state,events:[{type:'mechanicFailed',hook:'choice',reason:'invalid-mechanic-state'}]});
});
it.each(['blackMarket','other-armory'] as const)('equipment acceptance never replaces an armory with %s',mode=>{
 const opened=openG23Choice(armory()).state,choice=opened.pendingChoice!;
 const p=readG23Progress(opened)!;
 const state=mode==='blackMarket'?writeG23Progress(opened,{...p,chem:{...p.chem,offer:{id:'different-market',tier:1,optionId:'TFT13_Crime_LootA4',round:1}}})
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
