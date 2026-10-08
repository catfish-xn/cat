import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets } from './fixtures/m8-b4-items';
import { itemMatch } from './fixtures/m8-b4-match';
import { stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { stepMatch } from '../src/simulation/match';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { readItemCatalog } from '../src/simulation/item-catalog';
import { statusMagnitude } from '../src/simulation/m8/status';

describe('B4 composed consumers and restore rejection',()=>{
 it('IE+JG:25+35+35=95% chance,one redundant source makes multiplier1.5;135→202',()=>{
  const r=run(wearing(['infinity-edge','jeweled-gauntlet']));expect(r.p.spellCrit).toMatchObject({chanceBps:9500,multiplierBps:15000,redundantItemBonusBps:1000});expect(packets(r.events)[0].hpDamage).toBe(202);
 });
 it('renaming a programme source leaves Giant Slayer numbers and RNG unchanged',()=>{
  const a=wearing('giant-slayer'),b={...a,itemPrograms:a.itemPrograms!.map(p=>({...p,source:{...p.source,definitionId:'independent-unnamed-program'}}))};
  const x=run(a),y=run(b);expect(packets(y.events)[0].hpDamage).toBe(156);expect(y.state.rngState).toBe(x.state.rngState);expect(y.state.rngDraws).toBe(x.state.rngDraws);
 });
 it.each(['ionic-spark','evenshroud'])('%s moves into aura before current-tick damage;source death immediately withdraws only aura',id=>{
  const r=run(wearing(id,{attackRange:1,cell:{col:1,row:4}}),1,[enemy('e',1,1,{armor:100,magicResist:100})]);
  expect(r.events.some(e=>e.type==='movement'&&e.unitId==='p')).toBe(true);
  const target=r.state.units.find(u=>u.id==='e')!,kind=id==='ionic-spark'?'shred':'sunder';expect(statusMagnitude(target.mechanismState!.statuses,kind,1)).toBe(3000);
  const dead=stepCombat({...r.state,units:[...r.state.units.map(u=>u.id==='p'?{...u,hp:0}:u),enemy('ally',6,7,{team:'player'})]});
  expect(statusMagnitude(dead.state.units.find(u=>u.id==='e')!.mechanismState!.statuses,kind,dead.state.tick)).toBe(0);expect(dead.state.status).toBe('running');
 });
 it('aura departure removes its contribution without removing an attached30%shred',()=>{
  const r=run(wearing('ionic-spark',{cooldownTicks:1000,moveCooldownTicks:1000}),1),e=r.state.units.find(u=>u.id==='e')!;
  const g=e.mechanismState!.statuses.find(g=>g.kind==='shred')!,original=g.contributions[0],source={...original.source,definitionId:'attached-test',effectIndex:0},key=JSON.stringify([...JSON.parse(original.key).slice(0,3),source.definitionId,source.instanceId,0,null,e.id,'source']);
  const c={...original,key,source,expiresAtTick:100,application:{...original.application,duration:{kind:'ticks' as const,ticks:100}}};
  const next=stepCombat({...r.state,units:r.state.units.map(u=>u.id==='e'?{...u,cell:{col:6,row:0},mechanismState:{...u.mechanismState!,statuses:[{...g,contributions:[...g.contributions,c]}]}}:u)});
  const groups=next.state.units.find(u=>u.id==='e')!.mechanismState!.statuses;expect(statusMagnitude(groups,'shred',2)).toBe(3000);expect(groups.flatMap(g=>g.contributions).some(c=>c.source.definitionId==='ionic-spark')).toBe(false);
 });
 it('Sterak25% HP happens before later BT25% shield; sampled changed HP roundtrips',()=>{
  const r=run(wearing(['steraks-gage','bloodthirster'],{hp:600,cooldownTicks:1000}),1);expect(r.p.maxHp).toBe(1437);
  const next=stepCombat({...r.state,units:r.state.units.map(u=>u.id==='p'?{...u,hp:500}:u.id==='e'?{...u,cooldownTicks:0,attackDamage:100}:u)});expect(next.state.units.find(u=>u.id==='p')!.shield).toBe(359);
  let s=itemMatch(['steraks-gage','bloodthirster']);const u=s.combat!.units.find(u=>u.id==='unit-1')!;
  if(s.phase!=='combat')throw new Error('combat required');
  s={...s,combat:{...s.combat!,units:s.combat!.units.map(x=>x.id===u.id?{...x,hp:Math.floor(x.maxHp*.5)}:x)}};s=stepMatch(s).state;
  for(let i=0;i<80&&s.phase==='combat';i++){s=stepMatch(s).state;if(i%10===0)expect(restoreMatch(serializeMatch(s))).toEqual(s);}
 });
 it('Quicksilver stops growing at death; later living units may keep fighting and save',()=>{
  let s=itemMatch('quicksilver');while(s.combat!.tick<45&&s.phase==='combat')s=stepMatch(s).state;
  if(s.phase==='combat'){
   const units=s.combat!.units.map(u=>u.id==='unit-1'?{...u,hp:0}:u);s=stepMatch({...s,combat:{...s.combat!,units}}).state;
   for(let i=0;i<45&&s.phase==='combat';i++)s=stepMatch(s).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);
  }
 });
 it('Lux HoJ samples360×130%=468; crossing below50% keeps charged468 through Match save and next attack',()=>{
  let s=itemMatch('hand-of-justice','unit-3');if(s.phase!=='combat')throw new Error('combat required');
  s=stepMatch({...s,combat:{...s.combat,units:s.combat.units.map(u=>u.id==='unit-3'?{...u,mana:u.maxMana,cooldownTicks:0}:u)}}).state;
  const high=s.combat!.units.find(u=>u.id==='unit-3')!;expect(high.hp*2).toBeGreaterThan(high.maxHp);expect(readCombatStats(high,s.combat!).abilityPower).toBe(130);expect(high.runtime!.nextAttackMagic).toBe(468);
  if(s.phase!=='combat')throw new Error('combat required');
  s=stepMatch({...s,combat:{...s.combat,units:s.combat.units.map(u=>u.id==='unit-3'?{...u,hp:190,mana:0,cooldownTicks:1000}:u)}}).state;
  const low=s.combat!.units.find(u=>u.id==='unit-3')!;expect(low.hp*2).toBeLessThan(low.maxHp);expect(readCombatStats(low,s.combat!).abilityPower).toBe(115);expect(low.runtime!.nextAttackMagic).toBe(468);
  const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);
  const attack=(state:typeof s)=>{if(state.phase!=='combat')throw new Error('combat required');return stepMatch({...state,combat:{...state.combat,units:state.combat.units.map(u=>u.id==='unit-3'?{...u,cooldownTicks:0}:u)}});};
  const result=attack(s);expect(attack(restored)).toEqual(result);expect(result.events.filter(e=>e.type==='packetDamage'&&e.source.ownerId==='unit-3'&&e.source.sourceKind==='ability').map(e=>e.type==='packetDamage'?e.raw:0)).toEqual([468]);expect(result.state.combat!.units.find(u=>u.id==='unit-3')!.runtime!.nextAttackMagic).toBe(0);
 });
 it('string restore uses its parsed independent graph;object restore still detaches the input',()=>{
  const source=itemMatch('hand-of-justice'),json=serializeMatch(source),a=restoreMatch(json),b=restoreMatch(json),c=restoreMatch(source);
  expect(a).toEqual(source);expect(c).toEqual(source);expect(a.combat).not.toBe(b.combat);expect(c.combat).not.toBe(source.combat);
  if(!a.combat||!c.combat)throw new Error('combat required');
  Object.assign(a.combat.units[0],{hp:0});Object.assign(c.combat.units[0],{hp:0});expect(serializeMatch(b)).toBe(json);expect(serializeMatch(source)).toBe(json);
 });
 it('catalogue query is frozen,source-labelled,44 entries and consumes zero Match words',()=>{
  const s=itemMatch('jeweled-gauntlet'),before=JSON.stringify(s),a=readItemCatalog(),b=readItemCatalog();expect(a).toEqual(b);expect(a).toHaveLength(44);expect(a.every(i=>i.effectDescriptions.length&&i.referencePatch==='14.24b'&&i.evidenceStatus===(['red-buff','runaans-hurricane'].includes(i.id)?'approved-provisional':'source-reviewed'))).toBe(true);expect(Object.isFrozen(a)).toBe(true);expect(JSON.stringify(s)).toBe(before);
 });
 it.each(['spellCrit','program','bonus','survival','shield','burn'])('rejects forged %s rather than silently executing it',kind=>{
  let s=itemMatch(kind==='burn'?'sunfire-cape':kind==='shield'?'crownguard':kind==='bonus'?'steraks-gage':kind==='survival'?'giant-slayer':'infinity-edge');
  if(kind==='burn')for(let i=0;i<45;i++)s=stepMatch(s).state;
  const raw=JSON.parse(serializeMatch(s)),u=raw.combat.units.find((u:{id:string})=>u.id==='unit-1');
  if(kind==='spellCrit')delete u.spellCrit;
  if(kind==='program')u.itemPrograms[0].program.effects=[];
  if(kind==='bonus')u.maxHpBasis.bonusBps=2500;
  if(kind==='survival')u.mechanismState.runtimes[0].triggerCount=2;
  if(kind==='shield')u.shieldLayers[0].m8Grant.amount.maxHpBps=9000;
  if(kind==='burn'){const burn=raw.combat.units.flatMap((u:{mechanismState:{periodicTasks:unknown[]}})=>u.mechanismState.periodicTasks).find((t:{onSourceDeath:string})=>t.onSourceDeath==='persist-attached');expect(burn).toBeDefined();burn.program.effects[0].amount.flat=100;}
  expect(()=>restoreMatch(raw)).toThrow();
 });
});
