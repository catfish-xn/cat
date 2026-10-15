import {expect,it} from 'vitest';
import {createMatch,startMatchCombat,stepMatch} from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
type Mutable<T>={-readonly [K in keyof T]:Mutable<T[K]>};
function started(seed=42){const r=startMatchCombat(createMatch(seed));if(!r.ok)throw Error(r.reason);return r.state;}
it('warm compilation preserves every restored field and continuation state/event',()=>{
 const original=started(),text=JSON.stringify(original);
 for(let i=0;i<3;i++){
  const restored=restoreMatch(text);
  expect(restored).toEqual(original);
  expect(stepMatch(restored)).toEqual(stepMatch(original));
  expect(restored).not.toBe(original);
 }
});
it('a warm compilation never admits edited strategy, runtime, resources or basis',()=>{
 const original=started(),text=JSON.stringify(original);restoreMatch(text);
 for(const mutate of [
  (s:Mutable<typeof original>)=>{s.combat!.strategy!.units[0].stats.attack++;},
  (s:Mutable<typeof original>)=>{s.combat!.units[0].attackDamage++;},
  (s:Mutable<typeof original>)=>{s.nextItemSerial++;},
  (s:Mutable<typeof original>)=>{s.combatInputBasis!.inputs.preparation.units[0].definitionId='lux';},
 ]){
  const edited=JSON.parse(text);mutate(edited);
  expect(()=>restoreMatch(JSON.stringify(edited))).toThrow();
  expect(()=>restoreMatch(edited)).toThrow();
 }
});
it('compilation reuse cannot mix seeds or leak caller mutations',()=>{
 const initial=started(),text=JSON.stringify(initial);
 const first=restoreMatch(text) as Mutable<typeof initial>;first.combat!.units[0].hp--;
 for(let seed=1;seed<=18;seed++){
  const state=started(seed);expect(restoreMatch(JSON.stringify(state))).toEqual(state);
 }
 expect(restoreMatch(text)).toEqual(initial);
 const raw=text.replace('"cooldownTicks":0','"cooldownTicks":-0');
 const restored=restoreMatch(raw);
 expect(Object.is(restored.combat!.units[0].cooldownTicks,-0)).toBe(true);
});

it('parsed equality preserves nested key order and rejects extra fields or reordered arrays',()=>{
 const state=started(),text=JSON.stringify(state);restoreMatch(text);
 function reversed(value:unknown):unknown {return Array.isArray(value)?value.map(reversed):value!==null&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reversed(v)])):value;}
 expect(restoreMatch(JSON.stringify(reversed(state)))).toEqual(state);
 const extra=JSON.parse(text);extra.combat.strategy.extra=true;
 expect(()=>restoreMatch(JSON.stringify(extra))).toThrow();
 const swapped=JSON.parse(text);swapped.combat.strategy.units.reverse();
 expect(()=>restoreMatch(JSON.stringify(swapped))).toThrow();
});
