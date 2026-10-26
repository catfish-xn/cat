import { readFileSync } from 'node:fs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch, selectChoice, rerollAugment, buyUnit, equipItem, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { accepted, reachRound, resolveM5Choices, fieldBench } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH4_B4COMBAT as ROWS } from '../src/simulation/content/augment-pool-batch4-b4combat';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { ad, ap } from '../src/simulation/combat-s13-state';

// First public-route seeds offering each card (no reroll needed), re-searched on the 232-card shop pool.
const routes:Record<string,{seed:number;node:string;reroll?:number}>={
 'category-five':{seed:30,node:'2-1'},'long-distance-pals':{seed:18,node:'3-2'},
 'sated-spellweaver':{seed:36,node:'3-2'},overheal:{seed:11,node:'3-2'}
};
function acquire(id:string):MatchState {
 const r=routes[id];let s=reachRound(r.node,false,r.seed);
 if(r.reroll!==undefined){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,r.reroll));}
 const c=s.pendingChoice!;expect(c.offers).toContain(id);
 return accepted(selectChoice(s,c.choiceId,c.generation,id));
}
function rejectAll(s:MatchState,mutate:(s:any)=>void):void {
 const forged=structuredClone(s);mutate(forged);
 expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();
 expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
}
it.skipIf(!existsSync(RESEARCH_FILE)).each(Object.keys(ROWS))('%s preserves the source row and respects every allowed/forbidden node',id=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===ROWS[id].apiName);
 expect(ROWS[id].source.values).toEqual(source.effects);expect(AUGMENT_POOL_API_NAMES[id]).toBe(source.apiName);
 for(const node of ['2-1','3-2','4-2']){
  const allowed=!(AUGMENT_STAGE_BANS[source.apiName]??({'TFT_Augment_CategoryFive':['4-2'],'TFT_Augment_Overheal':['2-1'],'TFT_Augment_SatedSpellweaver':['2-1']} as Record<string,string[]>)[source.apiName]??[]).includes(node);
  const context={node,fieldedTraits:[],blocked:[]};expect(augmentOfferAllowed(id,[],context)).toBe(allowed);
  expect(augmentCandidates('gold',[],[],null,context).includes(id)).toBe(allowed);
 }
});
it.each(Object.keys(routes))('%s public acquisition, combat effects, round trip and tamper rejection',id=>{
 let s=acquire(id);expect(restoreMatch(serializeMatch(s))).toEqual(s);expect(restoreMatch(s)).toEqual(s);
 rejectAll(s,x=>{x.augments.find((a:any)=>a.definitionId===id).acquiredRound++;});
 s=resolveM5Choices(s);
 // Buy a second ally if necessary, then deploy through public commands.
 if(s.preparation.units.filter(u=>u.team==='player').length<2){
  const slot=s.shop.slots.findIndex(x=>x.status==='available');s=accepted(buyUnit(s,slot,s.shop.generation));
 }
 s=fieldBench(s);
 if(id==='category-five'){
  const item=s.items.find(i=>i.definitionId==='runaans-hurricane')!;expect(item).toBeDefined();
  const holder=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
  s=accepted(equipItem(s,item.id,holder.id,0));
 }
 s=accepted(startMatchCombat(s));let seen=false,checked=false;
 for(let i=0;i<400&&s.phase==='combat';i++){
  const result=stepMatch(s);s=result.state;
  seen ||= id==='long-distance-pals'
   ? !!s.combat?.units.some(u=>u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId===id)))
   : id==='category-five'? result.events.some(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId==='runaans-hurricane')
   : id==='overheal'?result.events.some(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId===id)
   : !!s.combat?.units.some(u=>u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId===id)));
  if(seen&&!checked&&s.phase==='combat'){
   expect(restoreMatch(serializeMatch(s))).toEqual(s);expect(restoreMatch(JSON.stringify(s))).toEqual(s);expect(restoreMatch(s)).toEqual(s);
   rejectAll(s,x=>{x.combat.units.find((u:any)=>u.team==='player').runtime.attackCount++;});
   rejectAll(s,x=>{const m=x.combat.units.find((u:any)=>u.mechanics.some((m:any)=>m.source.definitionId===id)).mechanics.find((m:any)=>m.source.definitionId===id);m.values[Object.keys(m.values)[0]]++;});
   if(id==='long-distance-pals'||id==='sated-spellweaver')rejectAll(s,x=>{
    const contribution=x.combat.units.flatMap((u:any)=>u.mechanismState.statuses.flatMap((g:any)=>g.contributions)).find((c:any)=>c.source.definitionId===id);
    contribution.application.modifier.value.amount++;
   });
   rejectAll(s,x=>{x.combatInputBasis.inputs.augments.find((a:any)=>a.definitionId===id).acquiredRound++;});
   checked=true;break;
  }
 }
 expect(seen).toBe(true);expect(checked).toBe(true);
});

function fixture(id:string,playerCount=1){
 const s=createMatch(42),u=s.preparation.units[0];
 const units=[...Array.from({length:playerCount},(_,i)=>({...u,id:'p'+i,definitionId:'maddie',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i*3,row:7}}})),
 ...Array.from({length:3},(_,i)=>({...u,id:'e'+i,definitionId:'training-dummy',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:i*2,row:0}}}))];
 const preparation={...s.preparation,units};const input={...s,preparation,augments:[{definitionId:id,choiceId:'fixture',acquiredRound:1}]};
 return createCombatWithEvents(preparation,buildStrategySnapshot(input),'b4-numeric',42).state;
}
it('Long Distance Pals grants 22% of both pre-share snapshots once, only to the furthest pair',()=>{
 let c=fixture('long-distance-pals',3);const p=c.units.filter(u=>u.team==='player'),before=p.map(u=>[ad(u as any),ap(u as any,0),u.armor,u.magicResist]);
 c=stepCombat(c).state;
 for(const [i,u] of c.units.filter(u=>u.team==='player').entries()){
  const grants=u.mechanismState!.statuses.flatMap(g=>g.contributions).filter(x=>x.source.definitionId==='long-distance-pals');
  expect(grants).toHaveLength(i===1?0:4);
  if(i!==1)expect(grants.map(g=>g.application.modifier!.value)).toEqual(before[2-i].map(n=>({kind:'constant',amount:Math.floor(n*2200/10000)})));
 }
 const next=stepCombat(c).state;expect(next.units.flatMap(u=>u.mechanismState!.statuses.flatMap(g=>g.contributions)).filter(c=>c.source.definitionId==='long-distance-pals')).toHaveLength(8);
});
it('Overheal fires exactly every third attack, deals 115% AD, heals half post-mitigation damage and caps its shield',()=>{
 let c=fixture('overheal');let attacks=0,hits=0,heals=0;
 for(let i=0;i<450&&c.status==='running';i++){
  const r=stepCombat(c);c=r.state;
  attacks+=r.events.filter(e=>e.type==='attack'&&e.attackerId==='p0').length;
  for(const e of r.events)if(e.type==='packetDamage'&&e.outcome.context.source.definitionId==='overheal'){
   hits++;expect(attacks%3).toBe(0);expect(e.outcome.raw).toBe(Math.floor(ad(c.units.find(u=>u.id==='p0')! as any)*11500/10000));
   const heal=r.events.find(h=>h.type==='heal'&&h.outcome.shares.some(s=>s.source.definitionId==='overheal'));
   expect(heal?.type).toBe('heal');if(heal?.type==='heal'){expect(heal.outcome.requested).toBe(Math.floor((e.outcome.hpDamage+e.outcome.absorbed)*0.5));heals++;}
  }
  const layer=c.units.find(u=>u.id==='p0')!.shieldLayers?.find(l=>l.source.definitionId==='overheal');if(layer)expect(layer.remaining).toBeLessThanOrEqual(300);
 }
 expect(hits).toBeGreaterThan(0);expect(heals).toBe(hits);
});
it('Sated Spellweaver grants 20% vamp only during the 60-tick cast window and converts excess into a capped 60-tick shield',()=>{
 let c=fixture('sated-spellweaver'),lastCast=-1000,heals=0,shields=0;
 for(let i=0;i<450&&c.status==='running';i++){
  const r=stepCombat(c);c=r.state;
  if(r.events.some(e=>e.type==='cast'&&'receipt' in e&&e.receipt.source.ownerId==='p0'))lastCast=c.tick;
  const actions=new Map<number,number>();
  for(const e of r.events)if(e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p0'&&e.outcome.context.permissions.includes('omnivamp')){
   const o=e.outcome;actions.set(o.context.actionSeq,(actions.get(o.context.actionSeq)??0)+o.hpDamage+o.absorbed);
  }
  const actual=r.events.filter(e=>e.type==='heal'&&e.outcome.shares.some(s=>s.source.definitionId==='sated-spellweaver'));
  const expected=c.tick-lastCast<60?[...actions.values()].reduce((n,d)=>n+Math.floor(d*2000/10000),0):0;
  expect(actual.reduce((n,e)=>n+(e.type==='heal'?e.outcome.requested:0),0)).toBe(expected);
  heals+=actual.length;
  for(const e of r.events)if(e.type==='shieldLayerChanged'&&e.reason==='granted'&&e.layer.source.definitionId==='sated-spellweaver'){
   shields++;expect(e.layer.remaining).toBeLessThanOrEqual(300);expect(e.layer.expiresAtTick-e.layer.startsAtTick).toBe(60);
  }
 }
 expect(heals).toBeGreaterThan(0);expect(shields).toBeGreaterThan(0);
});

it.each(['runaans-hurricane','TFT5_Item_RunaansHurricaneRadiant'])('Category Five adapts each %s instance to distinct extra targets and 85% bolt damage',itemId=>{
 const base=createMatch(42),unit=base.preparation.units[0];
 const units=[{...unit,id:'p',definitionId:'maddie',team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:7}}},
 ...Array.from({length:4},(_,i)=>({...unit,id:'e'+i,definitionId:'training-dummy',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:i+1,row:3}}}))];
 const preparation={...base.preparation,units};
 const items=[0,1].map(slot=>({id:'hurricane-'+slot,definitionId:itemId,location:{kind:'unit' as const,unitId:'p',slot}}));
 const input={...base,preparation,items,augments:[{definitionId:'category-five',choiceId:'fixture',acquiredRound:1}]};
 let c=createCombatWithEvents(preparation,buildStrategySnapshot(input),'category-numeric',42).state;
 const definitions=c.units.find(u=>u.id==='p')!.mechanismDefinitions!.eventTriggers!.filter(d=>d.source.definitionId===itemId);
 expect(definitions).toHaveLength(2);
 const baseline=itemId==='runaans-hurricane'?5500:11000;
 const targets=2; // Both 14.24 item rows have one original bolt (AdditionalTargets=1 for Radiant).
 for(const def of definitions){expect(def.selector.maxTargets).toBe(targets);expect(def.effects[0].kind).toBe('damage');if(def.effects[0].kind==='damage')expect(def.effects[0].amount.attackDamageBps).toBe(Math.floor(baseline*8500/10000));}
 let seen=false;
 for(let i=0;i<120&&c.status==='running';i++){
  const r=stepCombat(c);c=r.state;
  const bolts=r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId===itemId);
  if(!bolts.length)continue;
  for(const instanceId of ['hurricane-0','hurricane-1']){
   const own=bolts.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.instanceId===instanceId);
   expect(own).toHaveLength(targets);
   expect(new Set(own.map(e=>e.type==='packetDamage'?e.outcome.context.targetId:'')).size).toBe(targets);
   for(const e of own)if(e.type==='packetDamage'){
    expect(e.outcome.raw).toBe(Math.floor(ad(c.units.find(u=>u.id==='p')! as any)*Math.floor(baseline*8500/10000)/10000));
    expect(e.outcome.critical).toBe(false);expect(e.outcome.context.delivery).toBe('equipment-proc');expect(e.outcome.context.permissions).not.toContain('omnivamp');
   }
  }
  seen=true;break;
 }
 expect(seen).toBe(true);
});

it.each(['overheal','sated-spellweaver'])('%s converts only effective excess, adds to the layer, caps at 300, and never refreshes on zero/dead healing',async id=>{
 const {commitMechanismHeal,executeMechanismEffect}=await import('../src/simulation/m8/s13-mechanisms');
 const {castB4Combat}=await import('../src/simulation/augment-pool-batch4-b4combat');
 const {status}=await import('../src/simulation/content/item-programs');
 const {asSource}=await import('../src/simulation/m8/s13-definitions');
 const c=fixture(id),units=structuredClone(c.units) as import('../src/simulation/combat-s13-state').S13Unit[];
 const target=units.find(u=>u.id==='p0')!,m=target.mechanics!.find(m=>m.mechanic===(id==='overheal'?'overheal':'satedSpellweaver'))!;
 const ctx:import('../src/simulation/combat-s13-abilities').AbilityContext={tick:1,combatId:'b4-numeric',board:c.board,units,events:[],packets:[],heals:[],draw:()=>0};
 if(id==='sated-spellweaver')castB4Combat(ctx,target,1);
 executeMechanismEffect(ctx,units[1],asSource({...m.source,ownerId:units[1].id,definitionId:'wound-fixture'}),target,status('wound',3300,200,{activation:'immediate'}),1);
 target.hp=target.maxHp-10;
 commitMechanismHeal(ctx,{source:m.source,targetId:target.id,amount:100});
 expect(target.hp).toBe(target.maxHp);expect(target.shieldLayers.find(l=>l.source.definitionId===id)!.remaining).toBe(57);
 ctx.tick=2;commitMechanismHeal(ctx,{source:m.source,targetId:target.id,amount:100});
 expect(target.shieldLayers.find(l=>l.source.definitionId===id)).toMatchObject({remaining:124,expiresAtTick:62});
 ctx.tick=3;commitMechanismHeal(ctx,{source:m.source,targetId:target.id,amount:1000});
 expect(target.shieldLayers.find(l=>l.source.definitionId===id)).toMatchObject({remaining:300,expiresAtTick:63});
 ctx.tick=4;commitMechanismHeal(ctx,{source:m.source,targetId:target.id,amount:0});
 expect(target.shieldLayers.find(l=>l.source.definitionId===id)!.expiresAtTick).toBe(63);
 target.hp=0;target.alive=false;ctx.tick=5;commitMechanismHeal(ctx,{source:m.source,targetId:target.id,amount:1000});
 expect(target.hp).toBe(0);expect(target.shieldLayers.find(l=>l.source.definitionId===id)!.expiresAtTick).toBe(63);
});
it('Sated cast refreshes the same rate without stacking and stops exactly at its exclusive end tick',async()=>{
 const {castB4Combat,b4Vamp}=await import('../src/simulation/augment-pool-batch4-b4combat');
 const c=fixture('sated-spellweaver'),units=structuredClone(c.units) as import('../src/simulation/combat-s13-state').S13Unit[],u=units.find(u=>u.id==='p0')!;
 const ctx:import('../src/simulation/combat-s13-abilities').AbilityContext={tick:1,combatId:'b4-numeric',board:c.board,units,events:[],packets:[],heals:[],draw:()=>0};
 expect(b4Vamp(u,0)).toEqual([]);castB4Combat(ctx,u,1);expect(b4Vamp(u,60).map(r=>r.bps)).toEqual([2000]);expect(b4Vamp(u,61)).toEqual([]);
 ctx.tick=40;castB4Combat(ctx,u,2);expect(b4Vamp(u,99).map(r=>r.bps)).toEqual([2000]);expect(b4Vamp(u,100)).toEqual([]);
});
it('Long Distance Pals breaks equal-distance pairs by ID, independently of roster iteration order',async()=>{
 const {openingB4Combat}=await import('../src/simulation/augment-pool-batch4-b4combat');
 const c=fixture('long-distance-pals',3),units=[...structuredClone(c.units)].reverse() as import('../src/simulation/combat-s13-state').S13Unit[];
 const cells=[{col:0,row:7},{col:1,row:7},{col:1,row:6}];
 for(let i=0;i<3;i++){const u=units.find(u=>u.id==='p'+i)!;u.cell=cells[i];u.startingCell=cells[i];}
 const ctx:import('../src/simulation/combat-s13-abilities').AbilityContext={tick:1,combatId:'b4-numeric',board:c.board,units,events:[],packets:[],heals:[],draw:()=>0};
 openingB4Combat(ctx);
 expect(units.filter(u=>u.mechanismState!.statuses.some(g=>g.contributions.some(c=>c.source.definitionId==='long-distance-pals'))).map(u=>u.id).sort()).toEqual(['p0','p1']);
});
it('Long Distance Pals with only one ally consumes no RNG and grants no contribution',()=>{
 const c=fixture('long-distance-pals'),r=stepCombat(c);
 expect(r.state.units.flatMap(u=>u.mechanismState!.statuses.flatMap(g=>g.contributions)).filter(c=>c.source.definitionId==='long-distance-pals')).toEqual([]);
 const control=stepCombat({...c,units:c.units.map(u=>({...u,mechanics:u.mechanics?.filter(m=>m.source.definitionId!=='long-distance-pals')}))}).state;
 expect(r.state.rngState).toBe(control.rngState);expect(r.state.rngDraws).toBe(control.rngDraws);
});
