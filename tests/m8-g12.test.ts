import {describe,it,expect} from 'vitest';
import {initializeStreams,uniformIndex,generateRoundRolls,projectTemporaryEquipment,reconcileTemporaryEquipment,validateEquipmentState,compileTemporaryModifiers,reconcileTemporaryModifiers,validateTemporaryEquipment,selectTemporaryPair,compileTemporaryEffects,reconcileTemporaryEffects,createEquipmentPool,compileTemporaryPrograms,reconcileTemporaryPrograms} from '../src/simulation/m8/equipment';
import {resolveStat} from '../src/simulation/m8/stats';
import {modifier} from './fixtures/m8-contract-cases';
const pool={version:'tg-01-v1' as const,completed:Array.from({length:35},(_,n)=>({apiName:`C${String(n).padStart(2,'0')}`,definitionId:`c${n}`})),components:Array.from({length:8},(_,n)=>({apiName:`P${n}`,definitionId:`p${n}`}))};
describe('G12 TG-01 independent accepted-word and lifecycle vectors',()=>{
 it('seed0 stream XOR seeds consume0; rejects upper11 words for35 before modulo',()=>{
  expect(initializeStreams(0)).toEqual({equipment:{state:0x243f6a88,draws:0},encounter:{state:0xb7e15162,draws:0},loot:{state:0xdeadbeef,draws:0}});
  const words=[4294967295,4294967285,36];let draws=0;
  expect(uniformIndex(35,()=>words[draws++])).toBe(1);expect(draws).toBe(3);
  expect(uniformIndex(8,()=>4294967295)).toBe(7);
 });
 it('parents sorted before draws; low35×8, high35×34 without replacement; same round transfer/level-up0words',()=>{
  const state={equipment:{state:0,draws:0},rolls:[]};
  const first=generateRoundRolls(state,[{parentItemInstanceId:'b',roundId:'2-1',playerLevel:6},{parentItemInstanceId:'a',roundId:'2-1',playerLevel:7}],pool);
  // LCG0 gives1013904223,1196435762,3519870697,2868466484.
  // first35=3, next34=4 (after removing c3→c5); then35=7 and8=4.
  expect(first.rolls.map(r=>[r.parentItemInstanceId,r.children,r.rngDrawStart,r.rngDrawEnd])).toEqual([['a',['c3','c5'],0,2],['b',['c7','p4'],2,4]]);
  expect(generateRoundRolls(first,[{parentItemInstanceId:'b',roundId:'2-1',playerLevel:9}],pool)).toBe(first);
  const children=projectTemporaryEquipment(first.rolls[0],'new-holder');
  validateTemporaryEquipment(children,first.rolls);
  expect(()=>validateTemporaryEquipment(children,[])).toThrow();expect(()=>validateTemporaryEquipment(children.slice(0,1),first.rolls)).toThrow();
  expect(children.map(c=>[c.temporaryId,c.holderId,c.slot])).toEqual([[JSON.stringify(['a','2-1',1]),'new-holder',1],[JSON.stringify(['a','2-1',2]),'new-holder',2]]);
  const patch=reconcileTemporaryEquipment(projectTemporaryEquipment(first.rolls[0],'old-holder'),children);
  expect(patch.remove.map(c=>c.holderId)).toEqual(['old-holder','old-holder']);expect(patch.apply.map(c=>c.holderId)).toEqual(['new-holder','new-holder']);
  expect(reconcileTemporaryEquipment(children,children)).toEqual({remove:[],apply:[]});
  validateEquipmentState(JSON.parse(JSON.stringify(first)),pool,{state:0,draws:0});
  expect(()=>validateEquipmentState({...first,equipment:{...first.equipment,state:0}},pool,{state:0,draws:0})).toThrow();
 });
 it('280 low-tier ordered pairs occur once;1190 high-tier draws produce595 unordered pairs exactlytwice',()=>{
  for(const [level,size,expected,multiplicity] of [[6,8,280,1],[7,34,595,2]]){
    const counts=new Map<string,number>();
    for(let a=0;a<35;a++)for(let b=0;b<size;b++){
      const words=[a,b];let offset=0;const pair=selectTemporaryPair(level,pool,()=>words[offset++]);
      expect(offset).toBe(2);const key=JSON.stringify([...pair].sort());counts.set(key,(counts.get(key)??0)+1);
    }
    expect(counts.size).toBe(expected);expect(new Set(counts.values())).toEqual(new Set([multiplicity]));
  }
 });
 it('temporary modifiers use complete parent/child/holder provenance and can be revoked without RNG',()=>{
  const roll={parentItemInstanceId:'parent',roundId:'r',playerLevelSnapshot:7,poolVersion:'tg-01-v1' as const,children:['x','y'] as const,rngDrawStart:0,rngDrawEnd:2};
  const definitions={x:[modifier('attackDamage',50)],y:[modifier('attackDamage',20)]};
  const children=projectTemporaryEquipment(roll,'old'),compiled=compileTemporaryModifiers(children,definitions);
  expect(compiled.map(c=>c.source.parentItemInstanceId)).toEqual(['parent','parent']);
  expect(resolveStat('attackDamage',100,compiled.map(c=>c.modifier),{holder:{id:'old',hp:100,maxHp:100}})).toBe(170);
  const next=reconcileTemporaryModifiers(compiled,children,projectTemporaryEquipment(roll,'new'),definitions);
  expect(next.map(c=>c.source.ownerId)).toEqual(['new','new']);
  expect(reconcileTemporaryModifiers(next,projectTemporaryEquipment(roll,'new'),[],definitions)).toEqual([]);
 });
 it('finite child effects retain independent sources across transfer and revoke, without a draw callback',()=>{
  const roll={parentItemInstanceId:'parent',roundId:'r',playerLevelSnapshot:7,poolVersion:'tg-01-v1' as const,children:['x','y'] as const,rngDrawStart:0,rngDrawEnd:2};
  const definitions={x:[{kind:'grant-mana' as const,amount:10,reason:'periodic' as const,bypassLock:'none' as const}],y:[{kind:'cleanse' as const,remove:'removable-hostile-control-dot-debuff' as const,retarget:true as const}]};
  const children=projectTemporaryEquipment(roll,'old'),effects=compileTemporaryEffects(children,definitions);
  expect(effects.map(e=>[e.source.instanceId,e.source.parentItemInstanceId,e.source.effectIndex,e.effect.kind])).toEqual([
    [JSON.stringify(['parent','r',1]),'parent',0,'grant-mana'],[JSON.stringify(['parent','r',2]),'parent',0,'cleanse']]);
  const next=reconcileTemporaryEffects(effects,children,projectTemporaryEquipment(roll,'new'),definitions);
  expect(next.map(e=>e.source.ownerId)).toEqual(['new','new']);
  expect(reconcileTemporaryEffects(next,projectTemporaryEquipment(roll,'new'),[],definitions)).toEqual([]);
 });
 it('one child definition gives distinct effect ordinals to static and finite contributions',()=>{
  const roll={parentItemInstanceId:'p',roundId:'r',playerLevelSnapshot:7,poolVersion:'tg-01-v1' as const,children:['x','y'] as const,rngDrawStart:0,rngDrawEnd:2};
  const definitions={x:{modifiers:[modifier('attackDamage',50)],effects:[{kind:'grant-mana' as const,amount:10,reason:'periodic' as const,bypassLock:'none' as const}]},y:{modifiers:[modifier('attackDamage',20)],effects:[]}};
  const children=projectTemporaryEquipment(roll,'holder'),program=compileTemporaryPrograms(children,definitions);
  expect(program.modifiers.map(e=>e.source.effectIndex)).toEqual([0,0]);
  expect(program.effects.map(e=>e.source.effectIndex)).toEqual([1]);
  expect(new Set([...program.modifiers,...program.effects].map(e=>JSON.stringify([e.source.instanceId,e.source.effectIndex]))).size).toBe(3);
  expect(reconcileTemporaryPrograms(program,children,[],definitions)).toEqual({modifiers:[],effects:[]});
 });
 it('pool exclusion uses the finite policy, and a new round retains historical receipts',()=>{
  const entries=[...pool.completed.map(e=>({...e,kind:'completed' as const,effects:[]})),...pool.components.map(e=>({...e,kind:'component' as const,effects:[]})),{apiName:'arbitrary-name',definitionId:'unrelated-id',kind:'completed' as const,effects:[{kind:'temporary-equipment' as const,policyId:'TG-01' as const,lifetime:'round' as const}]}];
  expect(createEquipmentPool(entries)).toEqual(pool);
  const first=generateRoundRolls({equipment:{state:0,draws:0},rolls:[]},[{parentItemInstanceId:'a',roundId:'r1',playerLevel:7},{parentItemInstanceId:'b',roundId:'r1',playerLevel:6}],pool);
  const next=generateRoundRolls(first,[{parentItemInstanceId:'a',roundId:'r2',playerLevel:7}],pool);
  expect(next.rolls).toHaveLength(3);expect(next.rolls.slice(0,2)).toEqual(first.rolls);
  // Words 5/6:1649599747 and2670642822; mod35=12, mod34=10 -> c12,c10.
  expect(next.rolls[2]).toMatchObject({children:['c12','c10'],rngDrawStart:4,rngDrawEnd:6});
  const old=projectTemporaryEquipment(first.rolls[0],'holder'),fresh=projectTemporaryEquipment(next.rolls[2],'holder');
  expect(reconcileTemporaryEquipment(old,fresh)).toEqual({remove:old,apply:fresh});
  validateEquipmentState(next,pool,{state:0,draws:0});
 });
 it('failed plans keep input/RNG untouched; child application/revocation has no random input',()=>{
  const state={equipment:{state:0,draws:0},rolls:[]};const frozen=JSON.stringify(state);
  expect(()=>generateRoundRolls(state,[{parentItemInstanceId:'a',roundId:'r',playerLevel:0}],pool)).toThrow();
  expect(JSON.stringify(state)).toBe(frozen);
  expect(()=>generateRoundRolls(state,[{parentItemInstanceId:'a',roundId:'r',playerLevel:6}],{...pool,completed:pool.completed.slice(1)})).toThrow();
 });
});

// The contribution test uses explicit synthetic modifiers, not future catalog coefficients.
