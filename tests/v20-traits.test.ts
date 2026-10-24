import { describe, it, expect } from 'vitest';
import { createMatch, buyUnit } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { ad, ap, attackSpeedBonus, range, grantShield, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { settleFamilyReunionDeaths } from '../src/simulation/combat-family-reunion';
import { familyReunionParticipants } from '../src/simulation/family-reunion';
import { TEAMUP_IDS, V20_TRAITS } from '../src/simulation/content/v20-traits';
import { p2GiftPlan, drainP2Gifts } from '../src/simulation/s13-augments-p2-grants';
import { validateContent } from '../src/simulation/validate-content';
import { rollG23HighRoller } from '../src/simulation/g2-3-progress';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { hexDistance } from '../src/simulation/board';
import { executeV20Teamup, teamup } from '../src/simulation/combat-v20-traits';
import { quickDashV20, detonateMenaces } from '../src/simulation/combat-v20-traits';
import { advanceG2Passives } from '../src/simulation/combat-g2';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { toCombatReplay, applyCombatReplayTick, toCombatViewState } from '../src/simulation/combat-replay-view';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';

const hero=(id:string,n=0,definitionId=id,starLevel:1|2|3=1):Unit=>({id,definitionId,starLevel,team:'player',location:{kind:'board',cell:{col:n%7,row:4+Math.floor(n/7)}}});
function army(names:string[],augments:string[]=[]):MatchState {
  const s=createMatch(42),round=getCatalogRoundById('4-6');
  return {...s,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...s.m8,round},level:10,items:[],augments:augments.map(id=>({definitionId:id,choiceId:id,acquiredRound:1})),
    preparation:{...s.preparation,units:[...names.map((id,n)=>hero(id,n)),{...hero('enemy',0,'garen'),team:'enemy',location:{kind:'board',cell:{col:0,row:3}}}]}};
}
const start=(s:MatchState)=>createCombatWithEvents(s.preparation,buildStrategySnapshot(s),`round-${s.round}`,42).state;
const unit=(s:CombatState,id:string)=>s.units.find(u=>u.id===id)! as S13Unit;
const idle=(s:CombatState,actors:string[]=[])=>({...s,units:s.units.map(u=>u.team==='enemy'?{...u,maxHp:1000000,hp:1000000,magicResist:0,armor:0,cooldownTicks:1200,moveCooldownTicks:1200,mana:0,maxMana:0}:actors.includes(u.id)?{...u,attackRange:100,cooldownTicks:0,mana:u.maxMana}: {...u,cooldownTicks:1200,moveCooldownTicks:1200,mana:0,maxMana:0})});
function ticks(s:CombatState,n:number){let state=s;const events=[];for(let i=0;i<n&&state.status==='running';i++){const r=stepCombat(state);state=r.state;events.push(...r.events);}return {state,events};}
const context=(s:CombatState):AbilityContext=>({tick:s.tick,combatId:s.combatId,board:s.board,units:structuredClone(s.units) as S13Unit[],events:[],packets:[],heals:[],draw:()=>0});
function blockMovement(u:S13Unit,kind:'stun'|'channel'|'deep-roots',at=0,duration=121):void {
  if(kind==='deep-roots')u.mechanics=[...u.mechanics??[],{mechanic:'g23Anomaly',source:{...origin(u),sourceKind:'anomaly',definitionId:'deep-roots'},values:{enabled:1}}];
  else applyStatus(u,origin(u),kind,0,duration,at,[],true);
}

describe('v20-traits approved custom rules',()=>{
  it('validates the expanded catalogue',()=>expect(()=>validateContent()).not.toThrow());
  it.each(TEAMUP_IDS)('%s needs augment and two different on-board partners, and gifts are unique',id=>{
    const names=[...V20_TRAITS[id].partners],s=army(names,[id]);
    expect(buildStrategySnapshot(army(names)).traits.find(t=>t.traitId===id)?.tier).toBe(0);
    expect(buildStrategySnapshot(army(names.slice(0,1),[id])).traits.find(t=>t.traitId===id)?.tier).toBe(0);
    const bench={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.id===names[1]?{...u,location:{kind:'bench' as const,slot:0}}:u)}};
    expect(buildStrategySnapshot(bench).traits.find(t=>t.traitId===id)?.tier).toBe(0);
    expect(buildStrategySnapshot(s).traits.find(t=>t.traitId===id)?.tier).toBe(2);
    expect(p2GiftPlan(s).map(g=>g.definitionId)).toEqual(names);
    const granted=drainP2Gifts({...createMatch(42),augments:s.augments});expect(drainP2Gifts(granted)).toEqual(granted);
    const copies={...s,preparation:{...s.preparation,units:[...s.preparation.units,hero('copy',4,names[0],2)]},items:[{id:'item-1',definitionId:'sword',location:{kind:'unit' as const,unitId:names[0],slot:0}}]};
    const compiled=buildStrategySnapshot(copies);expect(compiled.units.filter(u=>u.mechanics?.some(m=>m.mechanic==='v20Teamup'&&m.source.definitionId===id))).toHaveLength(2);
    expect(compiled.units.find(u=>u.unitId==='copy')?.mechanics?.some(m=>m.mechanic==='v20Teamup'&&m.source.definitionId===id)).toBe(false);
    expect(buildStrategySnapshot({...copies,preparation:{...copies.preparation,units:[...copies.preparation.units].reverse()}})).toEqual(compiled);
  });
  it('military shares flat actual opening AD once and fires exactly one derived 225% current-AD packet',()=>{
    const base=army(['ambessa','caitlyn'],['mentorship']),items=[{id:'item-1',definitionId:'sword',location:{kind:'unit' as const,unitId:'caitlyn',slot:0}}];
    const s={...base,items},plain=start({...army(['ambessa','caitlyn']),items}),c=start(s);
    const sample=ad(unit(c,'caitlyn'));expect(unit(c,'ambessa').v20Traits?.mentorshipAdSample).toBe(sample);
    expect(ad(unit(c,'ambessa'))-ad(unit(plain,'ambessa'))).toBe(Math.floor(sample/4));
    const first=stepCombat(idle(c,['ambessa']));expect(unit(first.state,'caitlyn').tasks.filter(t=>t.kind==='v20Teamup')).toHaveLength(1);
    const buffed={...first.state,units:first.state.units.map(u=>u.id==='caitlyn'?{...u,attackDamageBase:u.attackDamageBase!+40}:u)},current=ad(unit(buffed,'caitlyn'));
    const r=stepCombat(buffed),packets=r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId==='mentorship');
    expect(current).toBeGreaterThan(sample);expect(unit(r.state,'ambessa').v20Traits?.mentorshipAdSample).toBe(sample);
    expect(packets).toHaveLength(1);expect(packets[0]).toMatchObject({outcome:{raw:Math.floor(current*225/100),context:{delivery:'attack-extra',triggeringCastActionSeq:null,critEligibility:'never'}}});
    expect(unit(r.state,'caitlyn').runtime.castCount).toBe(0);expect(unit(r.state,'caitlyn').runtime.attackCount).toBe(0);
    const dead={...first.state,units:first.state.units.map(u=>u.id==='enemy'?{...u,hp:0,alive:false}:u)};
    expect(stepCombat(dead).events.filter(e=>e.type==='packetDamage')).toHaveLength(0);
  });
  it.each(['reunion','geniuses'] as const)('%s has three independent echoes with exact integer coefficients and no shred',id=>{
    const names=[...V20_TRAITS[id].partners],c=start(army(names,[id])),r=stepCombat(idle(c,[names[0]])),ekko=unit(r.state,'ekko');
    const task=ekko.tasks.find(t=>t.kind==='v20Teamup')!,ctx=context(r.state);executeV20Teamup(ctx,ctx.units.find(u=>u.id==='ekko')!,task);
    // Ekko one-star primary 290 at 100 AP (other opening modifiers are sampled explicitly).
    const expected=Math.floor(Math.floor(290*ap(ekko,r.state.tick)/100)*(id==='geniuses'?33:50)/100);
    expect(ctx.packets[0].raw).toBe(expected);expect(ctx.events).toEqual([]);
    const result=stepCombat(r.state);expect(result.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId===id)).toHaveLength(3);
    expect(unit(result.state,'ekko').runtime.castCount).toBe(0);
  });
  it('Reunion wave uses Vi secondary 150% AD and hits all enemies in the frozen target row without control',()=>{
    const c=idle(start(army(['vi','ekko'],['reunion'])),['ekko']);
    c.units.push({...unit(c,'enemy'),id:'enemy2',cell:{col:2,row:3}});
    const a=stepCombat(c),b=stepCombat(a.state),hits=b.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId==='reunion');
    expect(hits).toHaveLength(2);for(const hit of hits)expect(hit).toMatchObject({outcome:{raw:Math.floor(Math.floor(ad(unit(a.state,'vi'))*180/100)*150/100),context:{damageType:'physical'}}});
    expect(b.events.some(e=>e.type==='statusChanged'&&e.group.kind==='stun')).toBe(false);
  });
  it('Geniuses missiles are 120% of a normal missile, consume three ordinary target words, and do not grow casts',()=>{
    const a=stepCombat(idle(start(army(['heimerdinger','ekko'],['geniuses'])),['ekko'])),b=stepCombat(a.state),h=unit(a.state,'heimerdinger');
    const hits=b.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId==='geniuses');expect(hits).toHaveLength(3);
    for(const hit of hits)expect(hit).toMatchObject({outcome:{raw:Math.floor(Math.floor(50*ap(h,a.state.tick)/100)*120/100)}});
    expect(b.state.rngDraws!-a.state.rngDraws!).toBe(3);expect(unit(b.state,'heimerdinger').runtime.castCount).toBe(0);
  });
  it('two Ekko relationships can coexist without duplicate packet identities or recursive casts',()=>{
    const a=stepCombat(idle(start(army(['vi','ekko','heimerdinger'],['reunion','geniuses'])),['vi','heimerdinger'])),b=stepCombat(a.state);
    const hits=b.events.filter(e=>e.type==='packetDamage'&&['reunion','geniuses'].includes(e.outcome.context.source.definitionId));
    expect(hits).toHaveLength(6);expect(new Set(hits.map(e=>e.type==='packetDamage'&&e.outcome.context.packetId)).size).toBe(6);
    expect(unit(b.state,'ekko').runtime.castCount).toBe(0);expect(unit(b.state,'ekko').tasks.filter(t=>t.kind==='v20Teamup')).toHaveLength(0);
  });
  it('Duo adds ordinary 10% AD/100 HP and gives ten locked/capped Mana only after normal casts',()=>{
    const c=start(army(['jinx','sevika'],['unlikely-duo'])),plain=start(army(['jinx','sevika']));
    for(const id of ['jinx','sevika']){expect(unit(c,id).maxHp-unit(plain,id).maxHp).toBe(100);expect(ad(unit(c,id))).toBe(Math.floor(unit(plain,id).attackDamageBase!*110/100));}
    const ready=idle(c,['jinx']);const s={...ready,units:ready.units.map(u=>u.id==='sevika'?{...u,maxMana:60,mana:57}:u)};
    // v22 mana rule: non-damage mana keeps its overflow above max until the cast spends maxMana (docs/COMBAT_MANA_RULES.md).
    const r=stepCombat(s);expect(unit(r.state,'sevika').mana).toBe(67);
    expect(r.events.find(e=>e.type==='manaChanged'&&'outcome' in e&&e.outcome.source.definitionId==='unlikely-duo')).toMatchObject({outcome:{amount:10,applied:10,overflow:0}});
    const locked=stepCombat({...s,units:s.units.map(u=>u.id==='sevika'?{...u,manaLockedUntilTick:20}:u)});expect(unit(locked.state,'sevika').mana).toBe(57);
  });
  it('luck conversion is strictly below 10%, triples do not reroll and jackpots keep their original table',()=>{
    const roll=(words:number[])=>{let n=0;const r=rollG23HighRoller(()=>words[n++],true);return {r,n};};
    expect(roll([0,Math.ceil(2**32/10)-1])).toMatchObject({r:{enhanced:true,luck:{converted:true,firstSlot:0}},n:2});
    expect(roll([0,Math.ceil(2**32/10)])).toMatchObject({r:{enhanced:false,luck:{converted:false}},n:2});
    expect(roll([2**32-1,2**32-1])).toMatchObject({r:{enhanced:true,mod:'jackpot'},n:2});
    const s=createMatch(42),r=buyUnit(s,99,s.shop.generation);expect(r.ok).toBe(false);expect(r.state).toBe(s);
  });
  it.each([1,2] as const)('Menaces retains Family count, suppresses only Powder benefits, and freezes star %i Silco',star=>{
    const base=army(['powder','silco','violet','vander'],['menaces']),s={...base,preparation:{...base.preparation,units:base.preparation.units.map(u=>u.id==='silco'?{...u,starLevel:star}:u)}};
    const strategy=buildStrategySnapshot(s),c=start(s),p=unit(c,'powder');
    expect(strategy.traits.find(t=>t.traitId==='family'&&t.team==='player')?.count).toBe(3);
    expect(strategy.traits.find(t=>t.traitId==='dominator'&&t.team==='player')?.count).toBe(2);
    expect(p.mechanics!.some(m=>m.mechanic==='family')).toBe(false);expect(unit(c,'violet').mechanics!.some(m=>m.mechanic==='family')).toBe(true);
    expect(p.mechanics!.some(m=>m.mechanic==='g23Trait'&&m.source.definitionId==='dominator')).toBe(true);
    expect(p.v20Traits?.silcoSample).toMatchObject({star,attacks:5,durationTicks:240,damage:star===1?36:55});
    const a=stepCombat(idle(c,['powder'])),b=stepCombat({...a.state,units:a.state.units.map(u=>['powder','silco'].includes(u.id)?{...u,hp:0,alive:false}:u)});
    expect(b.events.filter(e=>e.type==='unitSpawned'&&e.definitionId==='v20-silco-minion')).toHaveLength(3);
    expect(b.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='silco')).toHaveLength(0);
    expect(b.state.units.filter(u=>u.definitionId==='v20-silco-minion')).toHaveLength(3);
    const run=ticks(b.state,240);expect(run.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId==='menaces')).toHaveLength(15);
    expect(run.state.units.filter(u=>u.definitionId==='v20-silco-minion'&&u.alive)).toHaveLength(0);
    expect(stepCombat({...run.state,status:'finished',result:'playerWin'}).events).toEqual([]);
  });
  it.each([1,2,3] as const)('Menaces suppresses only Powder reunion promotion at star %i, preserving count, other heroes and death linkage',star=>{
    const names=['violet','vander','powder','warwick','jinx','vi','silco'],base=army(names,['menaces']);
    const s={...base,preparation:{...base.preparation,units:base.preparation.units.map(u=>u.id==='powder'?{...u,starLevel:star}:u)},
      items:['warwick','jinx','vi'].map((id,n)=>({id:`item-${n+1}`,definitionId:'TFT13_Item_FamilyEmblemItem',location:{kind:'unit' as const,unitId:id,slot:0}}))};
    const original=JSON.stringify(s),strategy=buildStrategySnapshot(s),c=start(s),p=unit(c,'powder');
    expect(familyReunionParticipants(s)).toEqual(names.slice(0,6));
    expect(strategy.traits.find(t=>t.traitId==='family'&&t.team==='player')?.count).toBe(6);
    const noReunion=start({...s,items:[]}),normal=start({...s,augments:[]});
    expect(p.effectiveStarLevel).toBe(star);expect(p.familyReunion).toMatchObject({combatStarLevel:star,unboostedStarLevel:star});
    expect(p.maxHp).toBe(unit(noReunion,'powder').maxHp);expect(ad(p)).toBe(ad(unit(noReunion,'powder')));expect(p.ability).toEqual(unit(noReunion,'powder').ability);
    expect(p.mechanics!.some(m=>m.mechanic==='family')).toBe(false);
    expect(unit(normal,'powder').effectiveStarLevel).toBe(star+1);expect(p.ability).not.toEqual(unit(normal,'powder').ability);
    for(const id of names.slice(0,6).filter(id=>id!=='powder')){
      expect(unit(c,id).effectiveStarLevel).toBe(2);expect(unit(c,id).ability).toEqual(unit(normal,id).ability);
      expect(unit(c,id).maxHp).toBe(unit(normal,id).maxHp);expect(unit(c,id).mechanics!.some(m=>m.mechanic==='family')).toBe(true);
    }
    const ctx=context(c);ctx.tick=1;const dead=ctx.units.find(u=>u.id==='powder')!;dead.hp=0;dead.alive=false;
    settleFamilyReunionDeaths(ctx,ctx.units);
    for(const id of names.slice(0,6).filter(id=>id!=='powder'))expect(ctx.units.find(u=>u.id===id)?.effectiveStarLevel).toBe(1);
    expect(JSON.stringify(s)).toBe(original);
  });
  it.each(['stun','deep-roots','channel'] as const)('Firelight under %s through t120 cannot move but still opens the window and heals once',kind=>{
    const s=army(['zeri','scar','ekko','lux']),c=idle(start({...s,items:[{id:'item-1',definitionId:'TFT13_Item_HoverboardEmblemItem',location:{kind:'unit',unitId:'lux',slot:0}}]})),z=unit(c,'zeri');
    blockMovement(z,kind);
    const before=ticks(c,119),ready=unit(before.state,'zeri');ready.hp=ready.maxHp-200;ready.expansion!.damageTaken=200;
    expect(before.events.some(e=>e.type==='movement'&&e.unitId==='zeri')).toBe(false);
    const r=stepCombat(before.state),after=unit(r.state,'zeri');
    expect(after.cell).toEqual(z.cell);expect(r.events.some(e=>e.type==='movement'&&e.unitId==='zeri')).toBe(false);
    expect(after.v20Traits).toMatchObject({nextDashTick:240,dashUntilTick:140});expect(range(after)).toBe(100);
    expect(attackSpeedBonus(after,120,r.state.units)-attackSpeedBonus(ready,119,before.state.units)).toBe(35000);
    expect(r.events.find(e=>e.type==='heal'&&e.outcome.targetId==='zeri')).toMatchObject({outcome:{requested:80,actual:80}});
    expect(after.hp).toBe(ready.hp+80);expect(after.expansion!.damageTaken).toBe(0);
    expect(ticks(r.state,120).events.some(e=>e.type==='heal'&&e.outcome.targetId==='zeri'&&e.outcome.actual>0)).toBe(false);
  });
  it.each(['v20-silco-minion','g23-sion','g23-forge'])('Firelight does not move excluded body %s',definitionId=>{
    const c=idle(start(army(['zeri','scar']))),ctx=context(c),z=ctx.units.find(u=>u.id==='zeri')!;ctx.tick=120;
    z.definitionId=definitionId;z.runtime.buddyTriggered=false;const before={...z.cell};
    advanceG2Passives(ctx,()=>0);expect(z.cell).toEqual(before);expect(ctx.events.some(e=>e.type==='movement'&&e.unitId==='zeri')).toBe(false);
    expect(z.v20Traits).toMatchObject({nextDashTick:240,dashUntilTick:140});
  });
  it.each(['stun','channel'] as const)('Firelight resumes movement when %s expires exactly at t120',kind=>{
    const c=idle(start(army(['zeri','scar'])));blockMovement(unit(c,'zeri'),kind,0,120);
    const r=ticks(c,120);expect(r.events.filter(e=>e.type==='movement'&&e.unitId==='zeri').map(e=>e.tick)).toEqual([120]);
  });
  it('Firelight sees control starting this tick, but not a contribution that starts next tick',()=>{
    for(const startsAt of [120,121]){
      const c=idle(start(army(['zeri','scar']))),z=unit(c,'zeri');blockMovement(z,'stun',startsAt,20);
      // Cover mechanism-only control as well as the legacy status projection.
      z.statuses=[];
      const r=stepCombat({...c,tick:119});
      expect(r.events.some(e=>e.type==='movement'&&e.unitId==='zeri')).toBe(startsAt===121);
      expect(unit(r.state,'zeri').v20Traits?.dashUntilTick).toBe(140);
    }
  });
  it.each(['self','target','both'] as const)('Quickstriker respects deep roots on %s without moving the target',rooted=>{
    const c=idle(start(army(['akali','nocturne','ambessa','twistedfate']))),a=unit(c,'akali'),enemy=unit(c,'enemy');
    a.cell={col:6,row:7};a.v20Traits={quickDashAtTick:1};
    if(rooted!=='target')blockMovement(a,'deep-roots');if(rooted!=='self')blockMovement(enemy,'deep-roots');
    const r=stepCombat(c);
    // A rooted actor still pulls an unrooted enemy; a rooted target must never be pulled.
    if(rooted!=='self')expect(unit(r.state,'enemy').cell).toEqual(enemy.cell);
    expect(r.events.some(e=>e.type==='movement'&&e.unitId==='enemy')).toBe(rooted==='self');
    expect(r.events.some(e=>e.type==='movement'&&e.unitId==='akali')).toBe(rooted==='target');
    if(rooted!=='target')expect(unit(r.state,'akali').cell).toEqual(a.cell);
    else expect(hexDistance(unit(r.state,'akali').cell,enemy.cell)).toBe(1);
    expect(unit(r.state,'akali').v20Traits?.quickDashAtTick).toBeUndefined();
  });
  it.each(['stun','channel','v20-silco-minion','g23-sion','g23-forge'] as const)('Quickstriker rejects %s through its own shared movement gate',kind=>{
    const ctx=context(start(army(['akali','nocturne']))),a=ctx.units.find(u=>u.id==='akali')!;
    ctx.tick=1;a.cell={col:6,row:7};a.v20Traits={quickDashAtTick:1};
    if(kind==='stun'||kind==='channel')blockMovement(a,kind);else{a.definitionId=kind;a.runtime.buddyTriggered=false;}
    quickDashV20(ctx,a);expect(a.cell).toEqual({col:6,row:7});expect(ctx.events).toEqual([]);expect(a.v20Traits.quickDashAtTick).toBeUndefined();
  });
  it('Firelight first dash at 120, 20-tick range/AS window, only actual HP heals and consumes the bucket',()=>{
    const s=army(['zeri','scar','lux','ekko']);const c=idle(start({...s,items:[{id:'item-1',definitionId:'TFT13_Item_HoverboardEmblemItem',location:{kind:'unit',unitId:'lux',slot:0}}]})),z=unit(c,'zeri');
    const m=z.mechanics!.find(m=>m.mechanic==='firelight')!;expect(m.values.attackSpeedBps).toBe(35000);
    const before=ticks(c,119);expect(unit(before.state,'zeri').v20Traits?.dashUntilTick).toBeUndefined();
    const ready={...before.state,units:before.state.units.map(u=>u.id==='zeri'?{...u,hp:u.maxHp-200,expansion:{...u.expansion!,damageTaken:200}}:u)};
    const a=stepCombat(ready),za=unit(a.state,'zeri');expect(a.events.find(e=>e.type==='heal'&&e.outcome.targetId==='zeri')).toMatchObject({outcome:{requested:80,actual:80}});
    expect(range(za)).toBe(100);expect(attackSpeedBonus(za,120,a.state.units)-attackSpeedBonus(unit(ready,'zeri'),119,ready.units)).toBe(35000);
    expect(hexDistance(z.cell,za.cell)).toBeLessThanOrEqual(2);expect(za.expansion!.damageTaken).toBe(0);
    expect(range(unit(ticks(a.state,19).state,'zeri'))).toBe(100);const end=ticks(a.state,20).state;expect(range(unit(end,'zeri'))).not.toBe(100);
    expect(ticks(end,100).events.filter(e=>e.type==='heal'&&e.outcome.targetId==='zeri'&&e.outcome.actual>0)).toHaveLength(0);
  });
  it('Firelight shield absorption is excluded from the HP bucket and lethal damage cannot resurrect',()=>{
    let c=idle(start(army(['zeri','scar'])));const z=unit(c,'zeri');grantShield(z,{ownerId:z.id,sourceKind:'trait',definitionId:'firelight',instanceId:'test',effectIndex:0},1000,200,0,[]);
    c={...c,units:c.units.map(u=>u.id==='enemy'?{...u,cooldownTicks:0,attackRange:100,attackDamageBase:100,baseCritChanceBps:0,targetId:'zeri'}:u)};
    const a=stepCombat(c);expect(unit(a.state,'zeri').expansion!.damageTaken).toBe(0);
    const dead=stepCombat({...a.state,tick:119,units:a.state.units.map(u=>u.id==='zeri'?{...u,hp:0,alive:false}:u)});expect(dead.events.filter(e=>e.type==='heal'&&e.outcome.targetId==='zeri')).toHaveLength(0);
  });
  it('Quickstriker uses 3/10 hex per tick and next-tick dash/shield after another actor kills its target',()=>{
    const c=idle(start(army(['akali','nocturne','ambessa','twistedfate'])));
    const travel={...c,units:c.units.map(t=>t.id==='akali'?{...t,cell:{col:6,row:7},moveCooldownTicks:0}:t.id==='enemy'?{...t,cell:{col:0,row:0}}:t)};
    const moved=ticks(travel,10).events.filter(e=>e.type==='movement'&&e.unitId==='akali');expect(moved.map(e=>e.tick)).toEqual([1,5,8]);
    const battle={...c,units:[...c.units.map(t=>t.id==='akali'?{...t,targetId:'enemy',cell:{col:6,row:7}}:t.id==='nocturne'?{...t,attackRange:100,cooldownTicks:0,attackDamageBase:1000000}:t.id==='enemy'?{...t,hp:1}:t),{...unit(c,'enemy'),id:'enemy2',cell:{col:0,row:0}}]};
    const a=stepCombat(battle);expect(unit(a.state,'akali').shield).toBe(200);expect(unit(a.state,'akali').v20Traits?.quickDashAtTick).toBe(2);
    const b=stepCombat(a.state);expect(hexDistance(unit(b.state,'akali').cell,unit(b.state,'enemy2').cell)).toBe(1);
    expect(b.events.filter(e=>e.type==='shieldLayerChanged'&&e.reason==='granted'&&e.layer.targetId==='akali')).toHaveLength(0);
  });
  it.each(TEAMUP_IDS)('%s checkpoints reproduce full state/events/RNG and reject tampered dynamic state',id=>{
    const s=army([...V20_TRAITS[id].partners],[id]),strategy=buildStrategySnapshot(s),basis=freezeCombatInput(s,42,0),initial=start(s);
    const a=ticks(initial,12),restored=JSON.parse(JSON.stringify(a.state));expect(validateDynamicCombat(restored,basis,strategy)).toBe(true);
    expect(ticks(restored,20)).toEqual(ticks(a.state,20));
    const tampered=structuredClone(restored);tampered.units[0].v20Traits={...tampered.units[0].v20Traits,moveTenths:9};expect(()=>validateDynamicCombat(tampered,basis,strategy)).toThrow();
    const reverse={...s,preparation:{...s.preparation,units:[...s.preparation.units].reverse()}};expect(ticks(start(reverse),32)).toEqual(ticks(initial,32));
    expect(teamup(unit(initial,V20_TRAITS[id].partners[0]),id)).toBeDefined();
  });
  it.each(['mentorship','reunion','geniuses'] as const)('%s cooperative work requires a live emitter and does not turn into a cast under control',id=>{
    const names=[...V20_TRAITS[id].partners],a=stepCombat(idle(start(army(names,[id])),[names[0]])),emitter=names[1];
    const task=unit(a.state,emitter).tasks.find(t=>t.kind==='v20Teamup')!,ctx=context(a.state),u=ctx.units.find(u=>u.id===emitter)!;
    executeV20Teamup(ctx,{...u,hp:0,alive:false},task);expect(ctx.packets).toEqual([]);
    executeV20Teamup(ctx,u,task);expect(ctx.packets).toHaveLength(1);expect(ctx.events.some(e=>e.type==='cast')).toBe(false);
    expect(u.runtime.castCount).toBe(0);
  });
  it('unique binding uses star then ID when item counts tie, never rebinds on partner death',()=>{
    const s=army(['ambessa','caitlyn'],['mentorship']),copies={...s,preparation:{...s.preparation,units:[...s.preparation.units,hero('caitlyn-b',3,'caitlyn',2),hero('caitlyn-a',4,'caitlyn',2)]}};
    const initial=start(copies);expect(teamup(unit(initial,'ambessa'),'mentorship')!.targetId).toBe('caitlyn-a');
    const dead=stepCombat({...idle(initial),units:idle(initial).units.map(u=>u.id==='caitlyn-a'?{...u,hp:0,alive:false}:u)}).state;
    expect(teamup(unit(dead,'ambessa'),'mentorship')!.targetId).toBe('caitlyn-a');expect(ad(unit(dead,'ambessa'))).toBe(ad(unit(initial,'ambessa')));
  });
  it('Quickstriker full adjacent cells/no enemies do not move and two dashers reserve distinct cells',()=>{
    const c=start(army(['akali','nocturne','ambessa','twistedfate'])),ctx=context(c),u=ctx.units.find(u=>u.id==='akali')!,v=ctx.units.find(u=>u.id==='nocturne')!;
    ctx.tick=2;u.v20Traits={quickDashAtTick:2};v.v20Traits={quickDashAtTick:2};
    quickDashV20(ctx,u);quickDashV20(ctx,v);expect(u.cell).not.toEqual(v.cell);
    const full=context(c);full.tick=2;const target=full.units.find(u=>u.id==='enemy')!;
    full.units.push(...Array.from({length:c.board.rows},(_,row)=>Array.from({length:c.board.columns},(_,col)=>({col,row}))).flat()
      .filter(cell=>hexDistance(cell,target.cell)===1).map((cell,n)=>({...unit(c,'ambessa'),id:'block-'+n,cell})));
    const blocked=full.units.find(u=>u.id==='akali')!,before={...blocked.cell};blocked.v20Traits={quickDashAtTick:2};quickDashV20(full,blocked);
    expect(blocked.cell).toEqual(before);expect(full.events.some(e=>e.type==='movement')).toBe(false);
    full.units=full.units.filter(t=>t.team===blocked.team);blocked.v20Traits={quickDashAtTick:2};quickDashV20(full,blocked);expect(blocked.cell).toEqual(before);
  });
  it('Firelight no landing still opens range/AS window and same-tick lethal damage prevents scheduled healing',()=>{
    const c=start(army(['zeri','scar'])),ctx=context(c),z=ctx.units.find(u=>u.id==='zeri')!;ctx.tick=120;
    ctx.board={...ctx.board,columns:1,rows:1};z.cell={col:0,row:0};z.hp-=100;z.expansion={damageDealt:0,damageTaken:100,crystals:0,crystalDamage:0,attacksRemaining:0,buffUntilTick:0,lastRetaliationTick:0,chainUntilTick:0,chainTargets:[],chainCastSeq:0,chainKills:0};
    advanceG2Passives(ctx,()=>0);expect(z.v20Traits?.dashUntilTick).toBe(140);expect(ctx.events.filter(e=>e.type==='movement'&&e.unitId==='zeri')).toEqual([]);
    const prepared=idle(c);const ready={...prepared,tick:119,units:prepared.units.map(u=>u.id==='zeri'?{...u,hp:1,v20Traits:{nextDashTick:120},expansion:{...z.expansion!,damageTaken:100}}:u.id==='enemy'?{...u,attackDamageBase:100000,cooldownTicks:0,attackRange:100,targetId:'zeri'}:u).filter(u=>['zeri','enemy'].includes(u.id))};
    const r=stepCombat(ready);expect(unit(r.state,'zeri').alive).toBe(false);expect(r.events.filter(e=>e.type==='heal'&&e.outcome.targetId==='zeri'&&e.outcome.actual>0)).toHaveLength(0);
  });
  it('Menaces explosion receipt is idempotent, agents use frozen AP and survive a caster death, and replay restores their roster',()=>{
    const s=army(['powder','silco','vander'],['menaces']),strategy=buildStrategySnapshot(s),basis=freezeCombatInput(s,42,0),c=start(s),ctx=context(c),p=ctx.units.find(u=>u.id==='powder')!;
    detonateMenaces(ctx,p,0,p.cell);detonateMenaces(ctx,p,0,p.cell);expect(ctx.events.filter(e=>e.type==='unitSpawned')).toHaveLength(3);
    let current=c,checkpoint:CombatState|undefined;
    for(let i=0;i<300&&current.status==='running';i++){current=stepCombat(current).state;if(current.units.some(u=>u.definitionId==='v20-silco-minion')){checkpoint=current;break;}}
    expect(checkpoint).toBeDefined();expect(validateDynamicCombat(JSON.parse(JSON.stringify(checkpoint)),basis,strategy)).toBe(true);
    expect(ticks(JSON.parse(JSON.stringify(checkpoint)),15)).toEqual(ticks(checkpoint!,15));
    const changed=structuredClone(checkpoint!);const proxy=changed.units.find(u=>u.definitionId==='v20-silco-minion')! as S13Unit;proxy.v20Traits!.minion!.remaining++;
    expect(()=>validateDynamicCombat(changed,basis,strategy)).toThrow();
  });
  it.each([['quickstriker',['akali','nocturne']],['firelight',['zeri','scar']]] as const)('%s movement/window state restores at its live timing boundary',(_id,names)=>{
    const s=army([...names]),strategy=buildStrategySnapshot(s),basis=freezeCombatInput(s,42,0),c=ticks(start(s),120).state;
    expect(validateDynamicCombat(JSON.parse(JSON.stringify(c)),basis,strategy)).toBe(true);expect(ticks(JSON.parse(JSON.stringify(c)),21)).toEqual(ticks(c,21));
  });
  it('Menaces compact replay preserves spawned agents, untargetability and every terminal display field',()=>{
    const initial=start(army(['powder','silco','vander'],['menaces'])),run=ticks(initial,1200);
    expect(run.state.status).toBe('finished');
    const replay=toCombatReplay({initial,terminal:run.state,events:run.events as LedgerCombatEvent[]});
    let view=replay.initial;for(const frame of replay.ticks)view=applyCombatReplayTick(view,frame);
    expect(view).toEqual(replay.terminal);expect(view).toEqual(toCombatViewState(run.state));
    const entered=replay.ticks.flatMap(t=>t.events).filter(e=>e.type==='unitEntered'&&e.unit.definitionId==='v20-silco-minion');
    expect(entered.length).toBeGreaterThanOrEqual(3);for(const e of entered)expect(e).toMatchObject({unit:{untargetable:true}});
  });
  it('Firelight range window affects basic attacks while preserving the ordinary spell range',()=>{
    const c=idle(start(army(['ekko','zeri']))),r=stepCombat({...c,tick:119,units:c.units.map(u=>u.id==='ekko'?{...u,cell:{col:6,row:7},mana:u.ability.kind==='s13'?60:0,maxMana:60,cooldownTicks:0}:u)});
    const e=unit(r.state,'ekko');expect(range(e)).toBe(100);expect(range(e,false)).toBe(1);
    expect(r.events.some(e=>e.type==='attack'&&e.attackerId==='ekko')).toBe(true);
    expect(r.events.some(e=>e.type==='cast'&&'receipt' in e&&e.receipt.source.ownerId==='ekko')).toBe(false);
  });
});
