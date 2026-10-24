import { offeredAt } from './augment-stage-helpers';
import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { settleAugmentDeaths } from '../src/simulation/combat-augment-effects';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { type AbilityContext } from '../src/simulation/combat-s13-abilities';
import { type S13Unit } from '../src/simulation/combat-s13-state';

function initial(names: string[], mechanics: {mechanic:string;values:Record<string,number>;targetId?:string}[]): CombatState {
  const match = createMatch(42);
  const preparation = { ...match.preparation, units: [...names, 'garen'].map((definitionId, i) => ({ id: i === names.length ? 'enemy' : `p${i}`, definitionId, starLevel: 1 as const,
    team: i === names.length ? 'enemy' as const : 'player' as const, location: { kind: 'board' as const, cell: { col: i % 7, row: i === names.length ? 0 : 5 } } })) };
  const strategy = buildStrategySnapshot({ ...match, preparation });
  const withAugments = { ...strategy, units: strategy.units.map(u => ({ ...u, mechanics: [...u.mechanics ?? [], ...(!u.unitId.startsWith('p') ? [] : mechanics.map((m, i) => ({ ...m,
    source: { ownerId: u.unitId, sourceKind: 'augment' as const, definitionId: m.mechanic === 'blisteringStrikes' ? 'blistering-strikes' : m.mechanic, instanceId: 'choice-' + i, effectIndex: i } }))) ] })) };
  const started = createCombatWithEvents(preparation, withAugments, 'augment-test').state;
  return { ...started, units: started.units.map(u => ({ ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 })) };
}
function advance(s: CombatState, ticks: number): CombatState { for (let i=0;i<ticks;i++) s=stepCombat(s).state; return s; }
function validate(s: CombatState) { for (const u of s.units) validateMechanisms(u,s.units,s.tick,s.combatId!,s.status==='finished',s.nextActionSeq!); }
function deaths(s: CombatState, ids: string[]): CombatState {
  const units = structuredClone(s.units) as S13Unit[];
  const fallen = units.filter(u => ids.includes(u.id));
  for (const u of fallen) { u.hp=0;u.alive=false;u.statuses=[];u.mechanismState={...u.mechanismState!,statuses:[]}; }
  const ctx: AbilityContext={tick:s.tick,combatId:s.combatId,board:s.board,units,events:[],packets:[],heals:[],draw:()=>0};
  settleAugmentDeaths(ctx,fallen);
  return {...s,units};
}
const clock={mechanic:'clockworkAccelerator',values:{attackSpeedBps:1000,periodTicks:60}};
const climb={mechanic:'climbLadder',values:{adBps:300,abilityPower:3,armor:3,magicResist:3}};
const epitaph={mechanic:'inspiringEpitaph',values:{shieldMaxHpBps:2000,attackSpeedBps:1000}};
const lone={mechanic:'loneHero',values:{attackSpeedBps:14000,durabilityBps:3500}};
function amounts(u: CombatUnit, stat: string) { return u.mechanismState!.statuses.flatMap(g=>g.contributions).filter(c=>c.application.modifier?.stat===stat).map(c=>c.application.modifier!.value.kind==='constant'?c.application.modifier!.value.amount:0); }

it('Clockwork pulses at 60/120 only, stacking 10% twice; duplicate step and JSON continuation are exact',()=>{
  const before=advance(initial(['lux','leona'],[clock]),59), first=stepCombat(before);
  expect(amounts(before.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([]);
  expect(amounts(first.state.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([1000]);
  expect(stepCombat(before)).toEqual(first);
  const second=advance(first.state,60);expect(amounts(second.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([1000,1000]);validate(second);
  expect(advance(JSON.parse(JSON.stringify(first.state)),60)).toEqual(second);
  const ended=stepCombat({...second,maxTicks:121}).state;expect(ended.status).toBe('finished');
  expect(ended.units.every(u=>u.mechanismState!.statuses.length===0)).toBe(true);
});
it('Lone Hero grants exactly +140% AS and 35% physical/magic durability only to the last living ally',()=>{
  const base=advance(initial(['lux','leona'],[lone]),1);expect(amounts(base.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([]);
  const last=deaths(base,['p1']), hero=last.units.find(u=>u.id==='p0')!;
  expect(amounts(hero,'attackSpeed')).toEqual([14000]);
  expect(hero.mechanismState!.statuses.find(g=>g.kind==='damage-reduction')!.contributions[0].application.magnitudeBps).toBe(3500);
  validate(last);const next=stepCombat(last).state;expect(amounts(next.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([14000]);
  const single=stepCombat(initial(['lux'],[lone])).state;expect(amounts(single.units.find(u=>u.id==='p0')!,'attackSpeed')).toEqual([14000]);validate(single);
});
it('Climb grants once per shared-trait death, not once per shared trait, without unrelated or enemy grants',()=>{
  const base=advance(initial(['lux','leona','ezreal','darius'],[climb]),1);
  const next=deaths(base,['p0','p1']);const ezreal=next.units.find(u=>u.id==='p2')!, darius=next.units.find(u=>u.id==='p3')!;
  expect(amounts(ezreal,'attackDamage')).toEqual([300,300]);expect(amounts(ezreal,'abilityPower')).toEqual([3,3]);
  const a=readCombatStats(base.units.find(u=>u.id==='p2')!,base), b=readCombatStats(ezreal,next);
  expect(b.abilityPower).toBe(a.abilityPower+6);expect(b.armor).toBe(a.armor+6);expect(b.magicResist).toBe(a.magicResist+6);
  expect(amounts(darius,'attackDamage')).toEqual([]);expect(amounts(next.units.find(u=>u.id==='enemy')!,'attackDamage')).toEqual([]);validate(next);
  expect(stepCombat(JSON.parse(JSON.stringify(next)))).toEqual(stepCombat(next));
});
it('Epitaph chooses nearest surviving ally with stable ID tie, stacks independent death shields, lasts this combat',()=>{
  let s=advance(initial(['lux','leona','ezreal','darius'],[epitaph]),1);
  s={...s,units:s.units.map(u=>({...u,cell:u.id==='p0'||u.id==='p1'?{col:3,row:3}:u.id==='p2'?{col:2,row:3}:u.id==='p3'?{col:4,row:3}:u.cell}))};
  const result=deaths(s,['p1','p0']), recipient=result.units.find(u=>u.id==='p2')!;
  expect(recipient.shield).toBe(2*Math.floor(recipient.maxHp*.2));expect(recipient.shieldLayers).toHaveLength(2);
  // v22 combat lasts 45s (900 ticks incl. overtime), so "this combat" now ends at tick 901.
  expect(recipient.shieldLayers!.map(l=>l.expiresAtTick)).toEqual([901,901]);expect(amounts(recipient,'attackSpeed')).toEqual([1000,1000]);
  expect(result.units.find(u=>u.id==='p3')!.shield).toBe(0);validate(result);
  expect(deaths(result,['p0','p1'])).toEqual(result);
  expect(stepCombat(JSON.parse(JSON.stringify(result)))).toEqual(stepCombat(result));
});
it('rejects forged Clockwork count, tick, coefficient and death-owner identity',()=>{
  const s=advance(initial(['lux','leona'],[clock]),60);validate(s);
  for(const mutate of [
    (u:any)=>{u.mechanismState.statuses=[];u.statuses=[];},
    (u:any)=>{u.mechanismState.statuses[0].contributions[0].appliedAtTick=59;u.statuses[0].startsAtTick=59;},
    (u:any)=>{u.mechanismState.statuses[0].contributions[0].application.modifier.value.amount=2000;u.statuses[0].amount=2000;},
  ]) {const forged=structuredClone(s);mutate(forged.units.find(u=>u.id==='p0'));expect(()=>validate(forged)).toThrow();}
  const d=deaths(advance(initial(['lux','leona','ezreal'],[climb]),1),['p0']);
  const forged={...d,units:d.units.map(u=>u.id==='p0'?{...u,alive:true,hp:1}:u)};expect(()=>validate(forged)).toThrow();
});
it('Lone Hero really reduces a 100 physical hit to 65, and a lethal tick grants death rewards before the next action',()=>{
  function attack(s: CombatState): CombatState {return {...s,units:s.units.map(u=>u.id==='enemy'?{...u,attackDamage:100,attackDamageBase:100,attackDamagePercentBps:0,baseCritChanceBps:0,spellCrit:undefined,attackRange:20,cooldownTicks:0}: {...u,armor:0,magicResist:0})};}
  const alone=attack(initial(['lux'],[lone]));
  const hp=alone.units.find(u=>u.id==='p0')!.hp;
  expect(stepCombat(alone).state.units.find(u=>u.id==='p0')!.hp).toBe(hp-65);
  let team=attack(initial(['lux','leona','ezreal'],[climb,epitaph]));
  team={...team,units:team.units.map(u=>u.id==='p0'?{...u,hp:1,cell:{col:0,row:1}}:u)};
  const next=stepCombat(team).state;expect(next.units.find(u=>u.id==='p0')!.alive).toBe(false);
  expect(amounts(next.units.find(u=>u.id==='p1')!,'abilityPower')).toEqual([3]);
  expect(next.units.filter(u=>u.team==='player').reduce((n,u)=>n+u.shield,0)).toBeGreaterThan(0);
  expect(stepCombat(JSON.parse(JSON.stringify(next)))).toEqual(stepCombat(next));
});

it('rejects missing Climb groups, partial grants, mismatched death times and wrong trait recipients',()=>{
  const s=deaths(advance(initial(['lux','leona','ezreal','darius'],[climb]),3),['p0']);validate(s);
  for(const all of [false,true]) {
    const forged=structuredClone(s);const u=forged.units.find(u=>u.id==='p1')! as S13Unit;
    const keys=u.mechanismState!.statuses.flatMap(g=>g.contributions).filter(c=>c.source.sourceKind==='augment').map(c=>c.key);
    const removed=new Set(all?keys:keys.slice(0,1));
    u.statuses=u.statuses.filter(l=>!l.contributionKeys?.some(k=>removed.has(k)));
    u.mechanismState={...u.mechanismState!,statuses:u.mechanismState!.statuses.map(g=>({...g,contributions:g.contributions.filter(c=>!removed.has(c.key))})).filter(g=>g.contributions.length)};
    expect(()=>validate(forged)).toThrow();
  }
  const mistimed=structuredClone(s) as any;const u=mistimed.units.find((u:any)=>u.id==='p1');
  const c=u.mechanismState.statuses.flatMap((g:any)=>g.contributions).find((c:any)=>c.source.sourceKind==='augment');
  c.appliedAtTick=2;u.statuses.find((l:any)=>l.contributionKeys.includes(c.key)).startsAtTick=2;expect(()=>validate(mistimed)).toThrow();
  const changed=structuredClone(s) as any;changed.units.find((u:any)=>u.id==='p0').definitionId='darius';expect(()=>validate(changed)).toThrow();
});
import { selectChoice, deployMatchUnit, buyUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { accepted, reachRound } from './match-helpers';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
// v22 augment tier table: Climb the Ladder I is offered at 2-1 only by seeds 108/109 below 600; seed 109's real battle has the ally death.
// v23 batch 3 grows the silver pool: the first seeds offering it are 735/774/782; seed 774 is the first whose real battle has the ally death.
// v23 batch 3 XP/health adds Kingslayer to silver: seed 656 is now the first offering it, and its real battle has the ally death.
// Global 14.24 stage bans (pool after batch 3): Climb the Ladder I is a 3-2/4-2 card; 3-2 seed 61 is the first offering seed
// whose real battle has the ally death (17 has none). Blistering Strikes is first offered at 601, Lone Hero at 688.
// (Before batch 3 merged, Blistering Strikes seeds 16 and 648 hit a mid-combat "Invalid status contribution" restore
// failure; reported to the battle-restore line.)
it.each([
 ['blistering-strikes',601],['clockwork-accelerator',7],['lone-hero',688],['climb-the-ladder-i',61],['inspiring-epitaph',18],
] as const)('%s public selection, real battle, strict save/restore and next-step state/RNG/events/receipts match (seed %i)',(id,seed)=>{
 // 14.24 stage tags: Climb the Ladder I is offered at 3-2/4-2; its seed column is a 3-2 seed.
 let s=offeredAt(id,'2-1')?reachRound('2-1',false,seed):reachRound('3-2',false,seed);
 for(let candidate=0;!s.pendingChoice!.offers.includes(id)&&candidate<300;candidate++)s=reachRound('2-1',false,candidate);
 const choice=s.pendingChoice!;expect(choice.offers).toContain(id);
 s=accepted(selectChoice(s,choice.choiceId,choice.generation,id));
 const first=s.preparation.units.find(u=>u.team==='player')!;
 const traits=M5_UNIT_DEFINITIONS[first.definitionId].traits;
 const slot=s.shop.slots.findIndex(v=>v.status==='available'&&M5_UNIT_DEFINITIONS[v.definitionId].traits.some(t=>traits.includes(t)));
 s=accepted(deployMatchUnit(s,first.id,{kind:'board',cell:{col:3,row:4}}));
 if(id!=='lone-hero') {
  s=accepted(buyUnit(s,slot>=0?slot:0,s.shop.generation));
  const second=s.preparation.units.find(u=>u.team==='player'&&u.id!==first.id)!;
  s=accepted(deployMatchUnit(s,second.id,{kind:'board',cell:{col:0,row:7}}));
 }
 s=accepted(startMatchCombat(s));let triggered=false, deathCheckpoint=false, checks=0;
 let previousCount=0;
 const check=(state:MatchState)=>{
  const restored=restoreMatch(serializeMatch(state));expect(restored).toEqual(state);
  // Whole MatchStep equality includes all events, RNG states, effect ledgers and acquisition/round receipts.
  expect(stepMatch(restored)).toEqual(stepMatch(state));checks++;
 };
 check(s);
 while(s.phase==='combat') {
  s=stepMatch(s).state;
  const grants=s.combat!.units.flatMap(u=>u.mechanismState?.statuses.flatMap(g=>g.contributions)??[]).filter(c=>c.source.definitionId===id);
  const count=grants.length;triggered ||= count>0;
  const newDeathGrant=count>previousCount&&['climb-the-ladder-i','inspiring-epitaph'].includes(id);
  if(newDeathGrant) {
   expect(s.combat!.units.some(u=>u.team==='player'&&!u.alive)).toBe(true);deathCheckpoint=true;check(s);
   const next=stepMatch(s).state;
   if(next.phase==='combat') {
    const after=next.combat!.units.flatMap(u=>u.mechanismState?.statuses.flatMap(g=>g.contributions)??[]).filter(c=>c.source.definitionId===id);
    expect(after.length).toBe(count);check(next);
   }
  } else if(count!==previousCount||s.combat!.tick%60===0||s.phase!=='combat')check(s);
  previousCount=count;
 }
 expect(triggered).toBe(true);expect(checks).toBeGreaterThan(3);
 if(['climb-the-ladder-i','inspiring-epitaph'].includes(id))expect(deathCheckpoint).toBe(true);
 expect(s.scheduleReceipts.filter(r=>r.eventId===choice.eventId)).toHaveLength(1);
});

it('Bulky Buddies I/II/III each grant their own shield on the same buddy death, without repetition',()=>{
 const mechanics=[1000,1500,1800].map(shieldMaxHpBps=>({mechanic:'bulkyBuddies',targetId:'p0',values:{shieldMaxHpBps,durationTicks:200}}));
 let s=initial(['lux','leona'],mechanics);
 s={...s,units:s.units.map(u=>u.id==='p0'?{...u,hp:1,cell:{col:0,row:1}}:u.id==='enemy'?{...u,cooldownTicks:0,attackRange:20,attackDamageBase:1000,attackDamage:1000,attackDamagePercentBps:0}:u)};
 const next=stepCombat(s).state, survivor=next.units.find(u=>u.id==='p1')!;
 expect(survivor.shieldLayers).toHaveLength(3);
 expect(survivor.shield).toBe(Math.floor(survivor.maxHp*.1)+Math.floor(survivor.maxHp*.15)+Math.floor(survivor.maxHp*.18));
 expect(survivor.runtime!.buddyTriggered).toBe(true);
 const again=stepCombat(next).state;expect(again.units.find(u=>u.id==='p1')!.shieldLayers).toEqual(survivor.shieldLayers);
});
it('Glass Cannon I+II start at 60% HP and amplify 100 attack damage by 32%; Manaflow I+II both add mana',()=>{
 const glass=[1200,2000].map(damageAmpBps=>({mechanic:'glassCannon',values:{startingHealthBps:8000,damageAmpBps}}));
 let s=initial(['lux'],glass);const hero=s.units.find(u=>u.id==='p0')!;expect(hero.hp).toBe(Math.floor(hero.maxHp*.6));
 s={...s,units:s.units.map(u=>u.id==='p0'?{...u,cooldownTicks:0,attackRange:20,attackDamageBase:100,attackDamage:100,attackDamagePercentBps:0,spellCrit:undefined,baseCritChanceBps:0}: {...u,armor:0})};
 expect(stepCombat(s).state.units.find(u=>u.id==='enemy')!.hp).toBe(s.units.find(u=>u.id==='enemy')!.hp-132);
 let mana=initial(['lux'],[{mechanic:'extraAttackMana',values:{amount:2}},{mechanic:'extraAttackMana',values:{amount:4}}]);
 mana={...mana,units:mana.units.map(u=>u.id==='p0'?{...u,cooldownTicks:0,attackRange:20,mana:0}:u)};
 expect(stepCombat(mana).state.units.find(u=>u.id==='p0')!.mana).toBe(16);
});
import { packets } from './helpers/replay2-views';
import { commitMechanismHeal } from '../src/simulation/m8/s13-mechanisms';
it('Blistering Strikes primary attack attaches five 1%-HP burn pulses and 33% Wound; expiry and restore do not duplicate',()=>{
 let s=initial(['lux'],[{mechanic:'blisteringStrikes',values:{durationTicks:100,burnBpsPerSecond:100,woundBps:3300}}]);
 s={...s,units:s.units.map(u=>u.id==='p0'?{...u,cooldownTicks:0,attackRange:20,attackDamageBase:0,attackDamage:0}:u)};
 let r=stepCombat(s);s=r.state;
 const enemy=s.units.find(u=>u.id==='enemy')!;
 expect(enemy.mechanismState!.statuses.find(g=>g.kind==='wound')!.effectiveMagnitudeBps).toBe(3300);
 expect(enemy.mechanismState!.statuses.find(g=>g.kind==='burn')!.effectiveMagnitudeBps).toBe(100);validate(s);
 expect(stepCombat(JSON.parse(JSON.stringify(s)))).toEqual(stepCombat(s));
 const units=structuredClone(s.units) as S13Unit[],target=units.find(u=>u.id==='enemy')!;target.hp-=200;const before=target.hp;
 const ctx:AbilityContext={tick:1,combatId:s.combatId,board:s.board,units,events:[],packets:[],heals:[],draw:()=>0};
 commitMechanismHeal(ctx,{source:{ownerId:target.id,sourceKind:'ability',definitionId:target.ability.id,instanceId:target.id,effectIndex:0},targetId:target.id,amount:100});
 expect(target.hp-before).toBe(67);
 s={...s,units:s.units.map(u=>({...u,cooldownTicks:2000}))};const damage:number[]=[];const ticks:number[]=[];
 for(let n=0;n<101;n++){r=stepCombat(s);s=r.state;for(const p of packets(r.events).filter(p=>p.damageType==='true')){damage.push(p.hpDamage);ticks.push(s.tick);}}
 expect(ticks).toEqual([21,41,61,81,101]);expect(enemy.maxHp).toBe(1120);expect(damage).toEqual([11,11,11,11,12]);expect(damage.reduce((a,b)=>a+b,0)).toBe(56);
 expect(s.units.find(u=>u.id==='enemy')!.mechanismState!.statuses).toEqual([]);validate(s);
});
it('Singed self-speed and durability use distinct identities and strict restore rejects forged speed',()=>{
 let s=initial(['singed'],[]);s={...s,units:s.units.map(u=>u.id==='p0'?{...u,mana:u.maxMana,attackRange:20}:u)};
 const next=stepCombat(s).state, hero=next.units.find(u=>u.id==='p0')!;
 expect(hero.mechanismState!.statuses.map(g=>g.kind).sort()).toEqual(['damage-reduction','stat-buff']);
 const keys=hero.mechanismState!.statuses.flatMap(g=>g.contributions.map(c=>c.key));expect(new Set(keys).size).toBe(keys.length);validate(next);
 const raw=structuredClone(next) as any, unit=raw.units.find((u:any)=>u.id==='p0');
 const c=unit.mechanismState.statuses.find((g:any)=>g.kind==='stat-buff').contributions[0];
 c.application.modifier.value.amount=20000;unit.statuses.find((s:any)=>s.kind==='attackSpeed').amount=20000;
 expect(()=>validate(raw)).toThrow('status modifier projection');
});
