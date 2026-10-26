import { acquireAugment, offeredAt } from './augment-stage-helpers';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { TACTICIAN_ITEM_SOURCE, TACTICIAN_ITEMS } from '../src/simulation/content/tactician-items';
import { createMatch, selectChoice, equipItem, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { deploymentCapFor } from '../src/simulation/deployment-cap';
import { createItemRandomStreams } from '../src/simulation/g2-4b-item-kernel';
import { recordItemGold, validateItemGoldPayouts, itemGoldPayouts } from '../src/simulation/g2-4b-item-gold';
import { augmentCandidates, resolveAugmentTier, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { accepted, reachRound } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH1 } from '../src/simulation/content/augment-pool-batch1';

it('authenticates Cape/Ring and Shield/Scepter names, 1 population, 10% one-gold triggers and recipes against retained raw 14.24b',()=>{
 const root='src/simulation/content/source/s13-14.24b/raw/',raw=JSON.parse(gunzipSync(readFileSync(root+'map22.bin.json.gz')).toString()),en=JSON.parse(gunzipSync(readFileSync(root+'en_us.tft.stringtable.json.gz')).toString()).entries;
 for(const [id,s] of Object.entries(TACTICIAN_ITEM_SOURCE)){
  const node=raw['Maps/Shipping/Map22/Items/'+id],values=Object.fromEntries(Object.entries(node.constants['{df085b93}']).map(([k,v])=>[k,(v as any).mValue]));
  expect(values).toEqual(s.values);expect(en[node.mDisplayNameTra.toLowerCase()]).toBe(s.enName);expect(en[node.mDescriptionNameTra.toLowerCase()]).toContain('1 gold');
  expect(TACTICIAN_ITEMS[id].recipe).toEqual(node.mComposition.map((x:string)=>x.endsWith('Spatula')?'spatula':'frying-pan'));
 }
});
it.each(['tactician-shield','tactician-cape'] as const)('%s records both successes and failures with exactly 10% and idempotent independent item RNG',kind=>{
 for(let seed=0;seed<100;seed++){
  const streams=createItemRandomStreams(seed),opportunity={battleId:'b',ownerId:'u',itemInstanceId:'i',kind,tick:200,ordinal:0},before={streams,receipts:[]},after=recordItemGold(before,opportunity);
  const word=(Math.imul(streams.collector.state,1664525)+1013904223)>>>0;
  expect(after.receipts[0]).toMatchObject({word,gold:BigInt(word)*10000n<1000n*4294967296n?1:0});expect(recordItemGold(after,opportunity)).toBe(after);
  expect(after.streams['gamblers-blade']).toBe(streams['gamblers-blade']);expect(after.streams.fishbones).toBe(streams.fishbones);
  validateItemGoldPayouts(itemGoldPayouts(after,new Set(['u'])),'b');
 }
});
function battle(item:string):CombatState {
 const s=createMatch(42),preparation={...s.preparation,units:[{...s.preparation.units[0],id:'p',definitionId:'lux',location:{kind:'board' as const,cell:{col:0,row:4}}},{...s.preparation.units[0],id:'e',definitionId:'garen',team:'enemy' as const,location:{kind:'board' as const,cell:{col:0,row:3}}}]},input={...s,preparation,items:[{id:'item',definitionId:item,location:{kind:'unit' as const,unitId:'p',slot:0}}]};
 const strategy=buildStrategySnapshot(input);const c=createCombatWithEvents(preparation,strategy,'tactician',42).state;
 return {...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000}))};
}
function advance(c:CombatState,n:number){for(let i=0;i<n;i++)c=stepCombat(c).state;return c;}
it('Cape rolls exactly once after 200 ticks while alive, never before, and JSON continuation preserves the failed/successful roll',()=>{
 const a=advance(battle('TFT_Item_TacticiansRing'),199);expect(a.itemGoldReceipts).toEqual([]);
 const b=stepCombat(a).state;expect(b.itemGoldReceipts).toHaveLength(1);expect(b.itemGoldReceipts![0]).toMatchObject({kind:'tactician-cape',tick:200,ownerId:'p',ordinal:0});
 expect(advance(b,1).itemGoldReceipts).toEqual(b.itemGoldReceipts);expect(stepCombat(JSON.parse(JSON.stringify(a)))).toEqual(stepCombat(a));
});
it('Shield rolls on actual holder death and the retained ledger can pay a dead holder once',()=>{
 let c=battle('TFT_Item_TacticiansScepter');c={...c,units:c.units.map(u=>u.id==='p'?{...u,hp:1}: {...u,cooldownTicks:0})};
 const ended=stepCombat(c);expect(ended.events.some(e=>e.type==='death'&&e.unitId==='p')).toBe(true);
 expect(ended.state.itemGoldReceipts).toHaveLength(1);expect(ended.state.itemGoldReceipts![0]).toMatchObject({kind:'tactician-shield',ownerId:'p',tick:1});
});
it.each(['TFT_Item_ForceOfNature','TFT_Item_TacticiansRing','TFT_Item_TacticiansScepter'])('%s adds one permanent population from the authenticated item receipt, even in inventory',id=>{
 const s=createMatch(42),after=accepted(grantMechanicItem(s,{receiptId:'test:item',source:'test',definitionId:id}));
 expect(deploymentCapFor(after.level,readG23Progress(after))).toBe(s.level+1);
 const removed={...after,items:[]};expect(deploymentCapFor(after.level,readG23Progress(removed))).toBe(s.level+1);
});
it('Coronation gives each Crown/Shield/Cape holder 30% AD, 30% AS and 40 AP per item, and no stats to an unequipped ally',()=>{
 const s=createMatch(42),u=s.preparation.units[0],base=buildStrategySnapshot(s).units.find(x=>x.unitId===u.id)!;
 for(const definitionId of ['TFT_Item_ForceOfNature','TFT_Item_TacticiansRing','TFT_Item_TacticiansScepter']){
  const input={...s,augments:[{definitionId:'coronation',choiceId:'test',acquiredRound:1}],items:[{id:'item',definitionId,location:{kind:'unit' as const,unitId:u.id,slot:0}}]},snapshot=buildStrategySnapshot(input).units.find(x=>x.unitId===u.id)!;
  expect(snapshot.abilityPower!-base.abilityPower!).toBe(40);expect(snapshot.attackDamagePercentBps!-base.attackDamagePercentBps!).toBe(3000);expect(snapshot.stats.attackIntervalTicks).toBeLessThan(base.stats.attackIntervalTicks);
 }
 expect(buildStrategySnapshot({...s,augments:[{definitionId:'coronation',choiceId:'test',acquiredRound:1}]}).units[0].abilityPower).toBe(base.abilityPower);
 expect(augmentOfferAllowed('coronation',[{definitionId:'tacticians-kitchen',choiceId:'old',acquiredRound:1}],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(false);
});
function acquire(id:string){
 if(!offeredAt(id,'2-1'))return acquireAugment(id); // 14.24 stage tags: first offering round instead of 2-1
 for(let seed=0;seed<10000;seed++){
  const s=createMatch(seed);if(!generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes(id))continue;
  const before=reachRound('2-1',false,seed),c=before.pendingChoice!;return accepted(selectChoice(before,c.choiceId,c.generation,id));
 }throw Error('seed');
}
it.each(['coronation','tacticians-kitchen'])('%s public acquisition adds one population, restores the passive, and rejects a forged roll',id=>{
 let s=acquire(id);expect(deploymentCapFor(s.level,readG23Progress(s))).toBe(s.level+1);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const gift=AUGMENT_BATCH1[id].gifts.find(g=>g.kind==='item')!;const item=s.items.find(i=>'definitionId' in gift&&i.definitionId===gift.definitionId)!;
 const holder=s.preparation.units.find(u=>u.team==='player')!;s=accepted(deployMatchUnit(s,holder.id,{kind:'board',cell:{col:0,row:7}}));s=accepted(equipItem(s,item.id,holder.id,0));
 s=accepted(startMatchCombat(s));if(s.phase==='combat')s=stepMatch(s).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);
 if(id==='tacticians-kitchen'){
  const fake=structuredClone(s) as any;fake.combat.itemGoldReceipts=[{id:'fake'}];expect(()=>restoreMatch(serializeMatch(fake))).toThrow();
 }
});
it('Coronation holder stats recompile at the live equipment barrier while the opening trait basis stays frozen',()=>{
 const s=createMatch(42),a={...s,augments:[{definitionId:'coronation',choiceId:'test',acquiredRound:1}]},before=buildStrategySnapshot(a),u=s.preparation.units[0];
 const equipped={...a,items:[{id:'cape',definitionId:'TFT_Item_TacticiansRing',location:{kind:'unit' as const,unitId:u.id,slot:0}}]},after=buildStrategySnapshot(equipped,undefined,undefined,before);
 const original=before.units.find(x=>x.unitId===u.id)!,updated=after.units.find(x=>x.unitId===u.id)!;
 expect(updated.abilityPower!-original.abilityPower!).toBe(40);expect(updated.attackDamagePercentBps!-original.attackDamagePercentBps!).toBe(3000);
 expect(buildStrategySnapshot(a,undefined,undefined,after).units.find(x=>x.unitId===u.id)!.abilityPower).toBe(original.abilityPower);
});
it.each([['frying-pan','frying-pan','TFT_Item_TacticiansScepter'],['spatula','frying-pan','TFT_Item_TacticiansRing']])('crafting %s + %s grants %s and one population with an authenticated combination fact',(a,b,result)=>{
 let s=createMatch(42);const holder=s.preparation.units[0];
 for(const [i,id] of [a,b].entries()){
  s=accepted(grantMechanicItem(s,{receiptId:'craft:'+i,source:'test',definitionId:id}));
  const item=s.items.at(-1)!;s=accepted(equipItem(s,item.id,holder.id,i));
 }
 expect(s.items.some(i=>i.definitionId===result)).toBe(true);expect(deploymentCapFor(s.level,readG23Progress(s))).toBe(s.level+1);
 expect(s.resourceProvenance.entries.some(e=>e.kind==='item-combined'&&e.event.definitionId===result)).toBe(true);
});
