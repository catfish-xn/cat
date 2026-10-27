import { expect, it } from 'vitest';
import { transferUpgradeResources } from '../src/simulation/upgrades';
import { createMatch } from '../src/simulation/match';
import { recordAugmentAcquisition, readAugmentCopyKills, recordAugmentCopyKills, appendAugmentFact } from '../src/simulation/augment-history';
import { recordR2PortableBattle, r2CopyKills, r2FrozenCopyKills } from '../src/simulation/augment-pool-batch5-r2-history';
import type { CombatState } from '../src/simulation/combat-types';
import { readBattleLiveGoldReaders } from '../src/simulation/two-sided-battle';
import { readsLiveGold } from '../src/simulation/live-gold-readers';
import { PORTABLE_ANOMALY_PREFIX } from '../src/simulation/content/augment-pool-batch5-r2';

it('records independent copied Headhunter kills through the history API, preserves zero and rejects conflicting repeats',()=>{
 const before=createMatch(0);
 let state=recordAugmentAcquisition(before,{...before,augments:[{definitionId:'another-anomaly',choiceId:'copy',acquiredRound:1}]});
 const fact={kind:'anomaly-copy-kills' as const,battleId:'battle-1',itemId:'item-9',unitId:'unit-2',kills:[{eventSeq:4,victimId:'enemy-a'},{eventSeq:8,victimId:'enemy-a'}]};
 state=recordAugmentCopyKills(state,fact);
 expect(recordAugmentCopyKills(state,fact)).toBe(state);
 expect(readAugmentCopyKills(state,'item-9',2)).toBe(2);expect(readAugmentCopyKills(state,'original-item',2)).toBe(0);
 expect(readAugmentCopyKills(state,'item-9',1)).toBe(0);
 expect(()=>recordAugmentCopyKills(state,{...fact,kills:[]})).toThrow(/conflict/);
 const zero={...fact,battleId:'battle-2',kills:[]};const recorded=recordAugmentCopyKills(state,zero);
 expect(recorded.augmentHistory!.facts.at(-1)).toMatchObject(zero);expect(readAugmentCopyKills(recorded,'item-9',2)).toBe(2);
 const cloned=structuredClone(fact);cloned.kills[0].victimId='mutated';expect(state.augmentHistory!.facts.at(-1)).toMatchObject(fact);
});
it('online sampler maps copied item/holder IDs and never journals original Headhunter kills as copy kills',()=>{
 const before=createMatch(0),state=recordAugmentAcquisition(before,{...before,augments:[{definitionId:'another-anomaly',choiceId:'copy',acquiredRound:1}]});
 const source={ownerId:'online-copy',sourceKind:'anomaly' as const,definitionId:'headhunter',instanceId:'portable:online-item',parentItemInstanceId:'online-item',effectIndex:0};
 const terminal={status:'finished',combatId:'online-battle',units:[
  {id:'original',team:'player',d11Kills:[{eventSeq:1,victimId:'old'}],mechanics:[{mechanic:'d11Anomaly',source:{...source,ownerId:'original',parentItemInstanceId:undefined},values:{priorKills:77}}]},
  {id:'online-copy',team:'player',d11Kills:[{eventSeq:2,victimId:'enemy'}],mechanics:[{mechanic:'d11Anomaly',source,values:{priorKills:0}}]},
 ]} as unknown as CombatState;
 const recorded=recordR2PortableBattle(state,terminal,'player',[{kind:'unit',combatId:'online-copy',originalId:'unit-2'},{kind:'item',combatId:'online-item',originalId:'item-2'}]);
 expect(recorded.augmentHistory!.facts.filter(f=>f.kind==='anomaly-copy-kills')).toEqual([
  expect.objectContaining({battleId:'online-battle',unitId:'unit-2',itemId:'item-2',kills:[{eventSeq:2,victimId:'enemy'}]}),
 ]);
 expect(readAugmentCopyKills(recorded,'item-2',2)).toBe(1);
 expect(recordR2PortableBattle(recorded,terminal,'player',[{kind:'unit',combatId:'online-copy',originalId:'unit-2'},{kind:'item',combatId:'online-item',originalId:'item-2'}])).toBe(recorded);
 expect(()=>recordR2PortableBattle(state,{...terminal,status:'running'},'player')).toThrow(/terminal/);
});
it('portable Avarice participates in live-bank reader routing, including an absent original and frozen mirrors',()=>{
 const item={id:'item-1',definitionId:PORTABLE_ANOMALY_PREFIX+'avarice-incarnate',location:{kind:'unit' as const,unitId:'unit-2',slot:0}};
 expect(readsLiveGold(null,['unit-2'],[item])).toBe(true);expect(readsLiveGold(null,['unit-3'],[item])).toBe(false);
 const side={anomalyBinding:null,units:[{id:'unit-2',team:'player',location:{kind:'board'}}],items:[item]} as unknown as Parameters<typeof readBattleLiveGoldReaders>[0]['a'];
 expect(readBattleLiveGoldReaders({a:{...side,seatId:'a'},b:{...side,seatId:'b'},mirrorOfSeatId:null})).toEqual([{seatId:'a',team:'player',readsLiveGold:true},{seatId:'b',team:'enemy',readsLiveGold:true}]);
 expect(readBattleLiveGoldReaders({a:{...side,seatId:'a'},b:{...side,seatId:'b'},mirrorOfSeatId:'b'})[1].readsLiveGold).toBe(false);
});

it('returns a portable copy when an upgrade survivor becomes the original anomaly holder',()=>{
 const item={id:'item-1',definitionId:PORTABLE_ANOMALY_PREFIX+'bulwark',location:{kind:'unit' as const,unitId:'unit-1',slot:0}};
 const binding={definitionId:'bulwark',unitId:'unit-2',choiceId:'anomaly',boundRound:23};
 const merged=transferUpgradeResources([item],binding,[{type:'unitUpgraded',survivorId:'unit-1',consumedIds:['unit-2','unit-3'],definitionId:'darius',fromStar:1,toStar:2,location:{kind:'board',cell:{col:0,row:4}}}]);
 expect(merged.anomalyBinding?.unitId).toBe('unit-1');expect(merged.items[0].location).toEqual({kind:'inventory'});
 expect(merged.events).toContainEqual({type:'itemsReturned',itemIds:['item-1'],unitId:'unit-1'});
});

it('freezes prior copy kills from the history roster when the item is later removed or reforged',()=>{
 const before=createMatch(0);let state=recordAugmentAcquisition(before,{...before,augments:[{definitionId:'another-anomaly',choiceId:'copy',acquiredRound:1}]});
 state=recordAugmentCopyKills(state,{kind:'anomaly-copy-kills',battleId:'prior',itemId:'item-2',unitId:'unit-1',kills:[{eventSeq:1,victimId:'enemy'}]});
 state={...state,round:2,combatInputBasis:{} as NonNullable<typeof state.combatInputBasis>};
 state=appendAugmentFact(state,{kind:'combat-roster',battleId:'current',roster:{units:[],items:[{id:'item-2',definitionId:PORTABLE_ANOMALY_PREFIX+'headhunter',location:{kind:'inventory'}}]}});
 expect(r2CopyKills(state)).toEqual([]);
 expect(r2FrozenCopyKills(state)).toEqual([{itemId:'item-2',count:1}]);
 const independentPrefix=[{id:'item-2',definitionId:PORTABLE_ANOMALY_PREFIX+'headhunter'}];
 expect(r2CopyKills(state,independentPrefix)).toEqual([{itemId:'item-2',count:1}]);
});
