import { appendResourceProvenance } from '../src/simulation/resource-provenance';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH2, AUGMENT_BATCH2_ENABLED } from '../src/simulation/content/augment-pool-batch2';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_DEFINITIONS, ITEM_DEFINITIONS } from '../src/simulation/content';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { createMatch, selectChoice, startMatchCombat, stepMatch, deployMatchUnit } from '../src/simulation/match';
import { augmentCandidates, resolveAugmentTier, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { batch1GiftPlan, drainBatch1Gifts, validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { planAugmentGifts } from '../src/simulation/augment-gift-plan';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { batch2Attack, batch2Incoming, batch2Kill, batch2ExecuteReward, batch2AutomataBlast, batch2Bonus } from '../src/simulation/augment-pool-batch2-combat';
import { type AbilityContext, type S13Packet } from '../src/simulation/combat-s13-abilities';
import { type S13Unit } from '../src/simulation/combat-s13-state';
import { accepted, reachRound } from './match-helpers';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { validateEffect } from '../src/simulation/validate-content';
import { cloneEffect } from '../src/simulation/effects';

const names=['Academy','Ambusher','Artillerist','ArtilleristPlus','Automata','Bruiser','Cabal','Chembaron','Conqueror','Dominator','Enforcer','Experiment','Family','Firelight','Formswapper','PitFighter','Quickstriker','Rebel','Scrap','Sentinel','Sniper','Sorcerer','Visionary','Watcher'];
it('takes exactly the 26 batch-2 classification entries, with no disabled offers',()=>{
 expect(Object.values(AUGMENT_BATCH2).map(x=>x.apiName)).toEqual([...names.map(x=>'TFT13_Augment_'+x),'TFT13_TeamupAugment_Betrayal','TFT13_TeamupAugment_BloodBrothers']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH2)){
  expect(row.source.patch).toBe('14.24');expect(row.source.archive).toContain('augments-14.24.json');
  if(!row.enabled){expect(AUGMENT_DEFINITIONS[id]).toBeUndefined();expect(Object.values(AUGMENT_POOL_API_NAMES)).not.toContain(row.apiName);}
 }
 expect(AUGMENT_BATCH2['heavy-hitters'].source.values).toMatchObject({RefreshSeconds:4,SlamPercentHealth:expect.closeTo(.07,6)});
 expect(AUGMENT_BATCH2['quickstriker-boost'].source.values).toMatchObject({AttackSpeed:expect.closeTo(.85,6),BuffDuration:2.5,TimeBetweenProcs:6});
});
it.each(Object.keys(AUGMENT_BATCH2_ENABLED))('%s has executable gifts, trait offer rules and no RNG leakage',id=>{
 const row=AUGMENT_BATCH2[id],a={definitionId:id,choiceId:'test',acquiredRound:1};
 for(const e of AUGMENT_DEFINITIONS[id].effects){validateEffect(e);expect(cloneEffect(e)).toEqual(e);}
 expect(augmentOfferAllowed(id,[],{node:'3-2',fieldedTraits:[],blocked:[]})).toBe(false);
 expect(augmentOfferAllowed(id,[],{node:'3-2',fieldedTraits:row.traits,blocked:[]})).toBe(true);
 expect(augmentOfferAllowed(id,[],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(true);
 const initial=createMatch(42),s={...initial,augments:[a],resourceProvenance:id==='why-not-both'?appendResourceProvenance(initial.resourceProvenance,initial.roundDefinitionId,{kind:'form-swapper-selected',choiceId:'test'}):initial.resourceProvenance},after=drainBatch1Gifts(s);
 expect(batch1GiftPlan(s).map(g=>g.definitionId)).toEqual(row.gifts.map(g=>'definitionId' in g?g.definitionId:''));
 expect(drainBatch1Gifts(after)).toBe(after);validateBatch1Gifts(after);
 expect([after.rngState,after.choiceRngState,after.rewardRngState]).toEqual([s.rngState,s.choiceRngState,s.rewardRngState]);
});
it('Branching Out uses the existing 22 sorted emblems and one reforger, independently of live streams',()=>{
 const s=createMatch(123),a={definitionId:'branching-out',choiceId:'test',acquiredRound:1};
 const specs=[{kind:'random-item',pool:'emblem',count:1},{kind:'consumable',definitionId:'reforger',count:1}] as const;
 const pool=Object.keys(EMBLEM_ITEMS).sort(),seen=new Set<string>();expect(pool).toHaveLength(22);
 // Independent FNV + LCG word, then floor(word*N/2^32), no hidden rejection or pool weights.
 for(let seed=0;seed<256;seed++){
  let hash=0x811c9dc5;const key=JSON.stringify(['augment-pool-batch1','solo','test','branching-out',0]);
  for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),0x01000193)>>>0;
  const word=(Math.imul((seed^hash)>>>0,1664525)+1013904223)>>>0;
  const gifts=planAugmentGifts({...s,seed},a,specs);expect(gifts.map(g=>g.definitionId)).toEqual([pool[Math.floor(word*22/4294967296)],'reforger']);seen.add(gifts[0].definitionId);
 }
 expect(seen.size).toBeGreaterThan(1);
});
function opening(id:string,definitionId:string,others:string[]=[]):CombatState {
 const s=createMatch(42),preparation={...s.preparation,units:[definitionId,...others,'garen'].map((name,i)=>({id:i===others.length+1?'enemy':`p${i}`,definitionId:name,team:i===others.length+1?'enemy' as const:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{row:i===others.length+1?3:4,col:i%7}}}))};
 const strategy=buildStrategySnapshot({...s,preparation,augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]});
 const combat=createCombatWithEvents(preparation,strategy,'b2',42).state;return {...combat,units:[...combat.units].sort((a,b)=>a.id==='enemy'?1:b.id==='enemy'?-1:a.id.localeCompare(b.id))};
}
function ctx(s:CombatState,tick=1):AbilityContext{return {tick,combatId:s.combatId,board:s.board,units:structuredClone(s.units) as S13Unit[],events:[],packets:[],heals:[],draw:()=>0};}
it.each(Object.keys(AUGMENT_BATCH2_ENABLED).filter(id=>!['betrayal','blood-brothers','why-not-both'].includes(id)))('%s compiles only for members, including emblem holders, even below an activated trait tier',id=>{
 const row=AUGMENT_BATCH2[id],s=createMatch(42),emblem=Object.values(EMBLEM_ITEMS).find(e=>e.emblemTrait===row.traits[0])!;
 const preparation={...s.preparation,units:[{...s.preparation.units[0],definitionId:'darius'}]};
 const base={...s,preparation,augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]};
 const snapshot=buildStrategySnapshot({...base,items:[{id:'emblem',definitionId:emblem.id,location:{kind:'unit' as const,unitId:preparation.units[0].id,slot:0}}]});
 expect(snapshot.units[0].mechanics?.some(m=>m.mechanic==='traitAugmentB2')).toBe(true);
 if(!['conqueror','watcher'].includes(row.traits[0]))expect(buildStrategySnapshot(base).units[0].mechanics?.some(m=>m.mechanic==='traitAugmentB2')).toBe(false);
 expect(ITEM_DEFINITIONS[emblem.id]).toBe(emblem);
});
it('Quickstriker pulses at combat start and 6 seconds, for exactly 2.5 seconds each',()=>{
 const s=opening('quickstriker-boost','nocturne'),u=s.units[0];
 for(const [tick,expected] of [[0,8500],[49,8500],[50,0],[119,0],[120,8500],[169,8500],[170,0]])expect(batch2Bonus(u,'speed',tick)).toBe(expected);
 expect(batch2Bonus(s.units.at(-1)!,'speed',0)).toBe(0);
});
it('Bruiser slam charges at 4 seconds, does 7% max HP physical, consumes once, and never backfills',()=>{
 const c=ctx(opening('heavy-hitters','trundle'),79),u=c.units[0],target=c.units.at(-1)!;
 batch2Attack(c,u,target,1,100);expect(c.packets).toHaveLength(0);c.tick=80;
 batch2Attack(c,u,target,2,100);expect(c.packets).toMatchObject([{raw:Math.floor(u.maxHp*.07),damageType:'physical',source:{definitionId:'heavy-hitters'}}]);
 batch2Attack(c,u,target,3,100);expect(c.packets).toHaveLength(1);c.tick=400;batch2Attack(c,u,target,4,100);expect(c.packets).toHaveLength(2);
});
it('Sentinel gets 5% resists and next attack deals 75% total current resists as magic',()=>{
 const s=opening('sentinel-slam','loris'),c=ctx(s,80),u=c.units[0],target=c.units.at(-1)!;
 const stats=readCombatStats(u,s);expect(u.armor).toBeGreaterThan(0);
 batch2Attack(c,u,target,1,stats.armor+stats.magicResist);expect(c.packets[0]).toMatchObject({raw:Math.floor((stats.armor+stats.magicResist)*.75),damageType:'magic'});
});
it('Watcher gains 2% AD per incoming basic hit and 4 AP per spell hit, with no item proc stacks',()=>{
 const s=opening('watcher-growth','vander'),c=ctx(s),u=c.units[0],enemy=c.units.at(-1)!,source={ownerId:enemy.id,sourceKind:'attack' as const,definitionId:enemy.definitionId,instanceId:enemy.id,effectIndex:0};
 const packet:S13Packet={source,targetId:u.id,raw:10,damageType:'physical',actionSeq:1,ordinal:0,delivery:'basic-attack',critEligibility:'never',area:false,triggeringCastActionSeq:null};
 batch2Incoming(c,u,packet,false);expect(u.batch2).toBeUndefined();
 batch2Incoming(c,u,packet,true);batch2Incoming(c,u,{...packet,delivery:'ability-direct'},true);batch2Incoming(c,u,{...packet,delivery:'equipment-proc'},true);
 expect(batch2Bonus(u,'adBps')).toBe(200);expect(batch2Bonus(u,'ap')).toBe(4);expect(c.events).toHaveLength(2);
 expect(batch2Bonus(enemy,'ap')).toBe(0);
});
it('Dominator speed requires an active shield and a kill shields only fellow Dominators, for three seconds',()=>{
 const s=opening('dominate','cassiopeia',['ziggs','lux']),c=ctx(s,10),u=c.units[0],enemy=c.units.at(-1)!;
 const before=readCombatStats({...u,shield:0},s).attackIntervalTicks;
 batch2Kill(c,u,enemy,()=>100);
 expect(c.units.slice(0,3).map(x=>x.shield)).toEqual([450,450,0]);
 expect(c.units[0].shieldLayers.find(l=>l.source.definitionId==='dominate')).toMatchObject({remaining:100,expiresAtTick:70});
 expect(readCombatStats(u,{...s,tick:10,units:c.units}).attackIntervalTicks).toBeLessThan(before);
});
it('Sorcerer death deals 300% AP to all adjacent units, friendly and hostile, excluding self',()=>{
 const s=opening('sorcerer-explosion','lux',['vladimir']),c=ctx(s),u=c.units[0];
 c.units[1].cell={col:1,row:4};c.units[2].cell={col:0,row:3};
 batch2Kill(c,c.units[2],u,()=>10);
 expect(c.packets.map(p=>[p.targetId,p.raw,p.damageType])).toEqual([['p1',360,'magic'],['enemy',360,'magic']]);
});
it('Automata secondary blast is 70% of the primary raw damage, at the nearest enemy, and cannot recursively generate crystals',()=>{
 const c=ctx(opening('fractured-crystals','amumu'),20),u=c.units[0];
 batch2AutomataBlast(c,u,999,12);expect(u.tasks.at(-1)).toMatchObject({kind:'g2Blast',amount:699,executeAtTick:21,source:{definitionId:'fractured-crystals'}});
});
it('Conqueror executions stack five resists each, with current combat lifetime only',()=>{
 const c=ctx(opening('noxian-guillotine','darius')),u=c.units[0];
 batch2ExecuteReward(c,u);batch2ExecuteReward(c,u);expect(batch2Bonus(u,'resist')).toBe(10);
 expect(batch2Bonus(opening('noxian-guillotine','darius').units[0],'resist')).toBe(0);
});
it('real combat steps reproduce exactly and preserve the prior checkpoint',()=>{
 const before=opening('heavy-hitters','trundle'),copy=structuredClone(before),a=stepCombat(before),b=stepCombat(before);
 expect(before).toEqual(copy);expect(a).toEqual(b);expect(stepCombat(JSON.parse(JSON.stringify(a.state)))).toEqual(stepCombat(a.state));
});
function acquire(id:string){
 for(let seed=0;seed<10000;seed++){
  const s=createMatch(seed),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  if(!generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,filter),s.choiceRngState).offers.includes(id))continue;
  const before=reachRound('2-1',false,seed),c=before.pendingChoice!;return accepted(selectChoice(before,c.choiceId,c.generation,id));
 }
 throw Error('missing seed '+id);
}
it.each(['branching-out',...Object.keys(AUGMENT_BATCH2_ENABLED)])('%s selects through Match, restores, and combat replay rejects altered runtime',id=>{
 let s=acquire(id);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const definition=AUGMENT_BATCH2[id]?.gifts.find(g=>g.kind==='unit');
 const gift=s.preparation.units.find(u=>u.location.kind==='bench'&&(!definition||'definitionId' in definition&&u.definitionId===definition.definitionId));if(gift)s=accepted(deployMatchUnit(s,gift.id,{kind:'board',cell:{col:2,row:4}}));
 let combat=accepted(startMatchCombat(s));for(let i=0;i<4&&combat.phase==='combat';i++)combat=stepMatch(combat).state;
 expect(restoreMatch(serializeMatch(combat))).toEqual(combat);
 if(id!=='branching-out'){
  const changed=structuredClone(combat) as any;changed.combat.units[0].batch2={executions:99};expect(()=>restoreMatch(serializeMatch(changed))).toThrow();
 }
});
it('actual Family settlement persists the authoritative reward fact, restores, and repeated stepping never pays twice',()=>{
 let s=acquire('welcome-to-the-playground');
 for(const [i,id] of ['powder','violet'].entries()){
  const u=s.preparation.units.find(u=>u.definitionId===id)!;s=accepted(deployMatchUnit(s,u.id,{kind:'board',cell:{col:i*3,row:7}}));
 }
 s=accepted(startMatchCombat(s));for(let i=0;i<901&&s.phase==='combat';i++)s=stepMatch(s).state;
 expect(s.phase).toBe('settlement');expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const before=serializeMatch(s);expect(serializeMatch(stepMatch(s).state)).toBe(before);
});
