import { rangedAttackFlightTicks } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets,heals,LANDING,WINDUP } from './fixtures/m8-b4-items';
import { stepCombat } from '../src/simulation/combat';
import { statusMagnitude } from '../src/simulation/m8/status';
import { readCombatStats } from '../src/simulation/combat-s13';
import { vi } from 'vitest';
import { CAST_WINDUP_TICKS } from '../src/simulation/cast-windup';
// #693 (2026-11-16): the wearer is Zyra; her vines (and their crit roll) land CAST_WINDUP_TICKS.zyra after her cast.
const LAND=1+CAST_WINDUP_TICKS.zyra,skill=(events:Parameters<typeof packets>[0])=>packets(events).filter(e=>e.source.sourceKind==='ability');
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
describe('B4 tear recipes: hand vectors and real effects',()=>{
 it('blue:completed1000 mana cast refunds10;kill buffs5% for160ticks',()=>{const cast=run(wearing('blue-buff',{mana:1000}),1,[enemy('e',1,3,{hp:100}),enemy('e2',2,3)]);expect(cast.p.mana).toBe(10);const r=run(wearing('blue-buff',{mana:1000}),LAND,[enemy('e',1,3,{hp:100}),enemy('e2',2,3)]);expect(r.p.mechanismState?.statuses.flatMap(g=>g.contributions).some(c=>c.application.modifier?.stat==='damageAmp'&&c.expiresAtTick===161+CAST_WINDUP_TICKS.zyra)).toBe(true);expect(skill(r.events)[0].hpDamage).toBe(100);});
 it('vow:positive hit at40% grants250 shield+20 permanent resists,armor20+20=40',()=>{const r=run(wearing('protectors-vow',{hp:400,cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(r.p.shield).toBe(250);expect(readCombatStats(r.p,r.state)).toMatchObject({armor:40,magicResist:20});});
 it('helm front:armor40 mitigates100→71;gain1 incoming+floor(1+71×.03)=3 mana on top15',()=>{const r=run(wearing('adaptive-helm',{cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(packets(r.events,'e')[0].hpDamage).toBe(71);expect(r.p.mana).toBe(19);expect(readCombatStats(r.p,r.state).magicResist).toBe(60);});
 it('helm back:AP100+10+15=125;tick60 adds10 mana,original branch survives movement',()=>{const r=run(wearing('adaptive-helm',{cell:{col:1,row:6},startingCell:{col:1,row:6},cooldownTicks:1000,attackRange:1,moveCooldownTicks:0}),60,[enemy('e',1,1)]);expect(r.events.some(e=>e.type==='movement'&&e.unitId==='p'&&e.to.row<=5)).toBe(true);expect(r.p.cell.row).toBeLessThanOrEqual(5);expect(readCombatStats(r.p,r.state)).toMatchObject({abilityPower:125,magicResist:20,armor:0});expect(r.p.mana).toBe(25);});
 it('helm front moves into back rows but retains40 resists and incoming-hit mana instead of periodic mana',()=>{
  const r=run(wearing('adaptive-helm',{cooldownTicks:1000,attackRange:1,moveCooldownTicks:0}),60,[enemy('e',1,7,{cooldownTicks:60,attackDamage:100,attackRange:1})]);
  expect(r.events.some(e=>e.type==='movement'&&e.unitId==='p'&&e.to.row>=6)).toBe(true);expect(r.p.cell.row).toBeGreaterThanOrEqual(6);
  expect(readCombatStats(r.p,r.state)).toMatchObject({abilityPower:110,armor:40,magicResist:60});expect(r.p.mana).toBe(19);
 });
 it('redemption first contribution is [101,201): damage100/90/90/100 at ticks100/101/200/201 without refresh',()=>{
  const ally=enemy('ally',2,4,{team:'player',hp:100000,maxHp:100000}),attacker=enemy('e',2,3,{targetId:'ally',attackDamage:100});
  let state=run(wearing('redemption',{hp:650,cooldownTicks:1000}),99,[ally,attacker]).state;
  const damage:number[]=[];
  for(let tick=100;tick<=201;tick++){
   const attack=[100,101,200,201].includes(tick);
   const r=stepCombat({...state,units:state.units.map(u=>u.id==='p'&&tick===101?{...u,hp:0}:u.id==='e'?{...u,cooldownTicks:attack?0:1000}:u)});state=r.state;
   if(attack)damage.push(packets(r.events,'e').find(e=>e.unitId==='ally')!.hpDamage);
   if(tick===100){const c=state.units.find(u=>u.id==='ally')!.mechanismState!.statuses.flatMap(g=>g.contributions).find(c=>c.application.kind==='damage-reduction')!;expect([c.appliedAtTick,c.expiresAtTick]).toEqual([101,201]);expect(statusMagnitude(state.units.find(u=>u.id==='ally')!.mechanismState!.statuses,'damage-reduction',100)).toBe(0);}
  }
  expect(damage).toEqual([100,90,90,100]);
 });
 it('blue kill500Bps makes115→120 damage;second kill refreshes expiry,159/160 boundary remains half-open',()=>{
  // Ranged attack landing (pure-result re-pin, Fable 11-18): the wearer stays ranged, so each kill — and so each expiry and its
  // half-open boundary — moves later by exactly that shot's flight (rangedAttackFlightTicks of its distance); both sides of
  // the boundary are still asserted. Before landing: kill on tick 1 → 161; second kill on tick 2 → 162; hits at 161 / 162.
  const fa=rangedAttackFlightTicks(1),fb=rangedAttackFlightTicks(2),fz=rangedAttackFlightTicks(hexDistance({col:1,row:4},{col:3,row:3}));
  const first=run(wearing('blue-buff',{baseCritChanceBps:0,targetId:'a'}),1+WINDUP+fa,[enemy('a',1,3,{hp:100}),enemy('b',2,3),enemy('z',3,3)]);
  const buff=first.p.mechanismState!.statuses.flatMap(g=>g.contributions).find(c=>c.application.modifier?.stat==='damageAmp')!;
  expect(buff.application.modifier!.value).toEqual({kind:'constant',amount:500});expect(buff.expiresAtTick).toBe(161+WINDUP+fa);
  // One attack on targetId, then on until its shot lands: [landing step, its events].
  const attack=(state:typeof first.state,targetId:string,hp?:number)=>{let r=stepCombat({...state,units:state.units.map(u=>u.id==='p'?{...u,cooldownTicks:0,targetId}:u.id===targetId&&hp!==undefined?{...u,hp}:u)});
    while(!r.events.some(e=>e.type==='attackLanded'&&e.attackerId==='p'))r=stepCombat({...r.state,units:r.state.units.map(u=>u.id==='p'?{...u,cooldownTicks:1000}:u)});return r;};
  const second=attack(first.state,'b',120);expect(packets(second.events)[0].hpDamage).toBe(120);expect(second.state.tick).toBe(first.state.tick+1+WINDUP+fb);
  const refreshed=second.state.units.find(u=>u.id==='p')!.mechanismState!.statuses.flatMap(g=>g.contributions).filter(c=>c.application.modifier?.stat==='damageAmp');expect(refreshed).toHaveLength(1);expect(refreshed[0].expiresAtTick).toBe(second.state.tick+160);expect(refreshed[0].application.modifier!.value).toEqual({kind:'constant',amount:500});
  const expiry=refreshed[0].expiresAtTick!;
  // The attacker's side (this buff) is taken on the attack tick: a shot launched on expiry-1 keeps +500 bps wherever it lands,
  // one launched on expiry does not (the half-open boundary, now on the launch tick).
  // Ranged attack wind-up (#791; assertion-structure change approved by Fable 11-24): the old form launched two shots on
  // consecutive ticks (expiry-1, expiry) in one sequence and asserted landed [120,115]. A ranged attack now winds up for WINDUP
  // ticks and cannot start another meanwhile, so two launches one tick apart are impossible in one sequence. Instead two
  // branches leave the same save: one starts on expiry-1-WINDUP and launches on expiry-1 (keeps +500 bps: [120]); the other
  // starts on expiry-WINDUP and launches on expiry (no buff: [115]). Pinning each launch tick also pins that the buff is read
  // on the launch tick, not the start tick.
  const hold=(st:typeof first.state)=>stepCombat({...st,units:st.units.map(u=>u.id==='p'?{...u,cooldownTicks:1000}:u)});
  let branchPoint=second.state;while(branchPoint.tick<expiry-2-WINDUP)branchPoint=hold(branchPoint).state;
  const branch=(startTick:number)=>{
   let st=structuredClone(branchPoint);const origin=JSON.stringify(st);
   while(st.tick<startTick-1)st=hold(st).state;
   let r=stepCombat({...st,units:st.units.map(u=>u.id==='p'?{...u,cooldownTicks:0,targetId:'z'}:u)});expect(r.state.tick).toBe(startTick);
   let launch:number|undefined;const landed:number[]=[];
   for(let n=0;n<WINDUP+fz+1;n++){r=hold(r.state);if(r.events.some(e=>e.type==='attackLaunched'&&e.attackerId==='p'))launch=r.state.tick;landed.push(...packets(r.events).map(e=>e.hpDamage));}
   return {origin,launch,landed};
  };
  const before=branch(expiry-1-WINDUP),at=branch(expiry-WINDUP);
  expect(at.origin).toBe(before.origin); // both branches start from the same save
  expect(before.launch).toBe(expiry-1);expect(before.landed).toEqual([120]);
  expect(at.launch).toBe(expiry);expect(at.landed).toEqual([115]);
 });
 it('redemption:1150−650=500 missing;500×15%=75 at100;t100 damage stays100 before next-tick10% reduction',()=>{const r=run(wearing('redemption',{hp:650,cooldownTicks:1000}),100,[enemy('e',1,3,{cooldownTicks:100,attackDamage:100})]);expect(heals(r.events).filter(e=>e.unitId==='p')[0].actual).toBe(75);expect(packets(r.events,'e')[0].hpDamage).toBe(100);});
 it('justice:above50% AD130/AP130/vamp12%→15 heal;below AD115/vamp24%→27;equal50% none doubled',()=>{for(const [hp,ad,heal] of [[600,130,15],[490,115,27],[500,115,13]]){const r=run(wearing('hand-of-justice',{hp,baseCritChanceBps:0}),1+LANDING);expect(packets(r.events)[0].raw).toBe(ad);expect(heals(r.events)[0].actual).toBe(heal);expect(readCombatStats(r.p,r.state).abilityPower).toBe(hp+heal>500?130:115);}});
});
