import { describe, it, expect } from 'vitest';
import { createMatch, claimOrb } from '../src/simulation/match';
import { getUnitStats } from '../src/simulation/unit-stats';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { generateShop } from '../src/simulation/shop';
import { sixCostOddsBps } from '../src/simulation/six-cost-shop';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { ad, ap, interval, type S13Unit } from '../src/simulation/combat-s13-state';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { readItemCatalog } from '../src/simulation/item-catalog';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { activateFamily, initialFamilyTask, familyTaskAt, FAMILY_REWARDS } from '../src/simulation/family-heist';
import { familyReunionParticipants, familyCombatBase } from '../src/simulation/family-reunion';
import { settleFamilyReunionDeaths } from '../src/simulation/combat-family-reunion';
import { resolveEffects } from '../src/simulation/effects';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { createG23Progress, validateG23Progress, replayG23Economy } from '../src/simulation/g2-3-match-progress';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { readG23MechanismState } from '../src/simulation/g2-3-view';
import { familyOrbs } from '../src/simulation/family-orbs';
import { melCanSave, commitMelSave } from '../src/simulation/mel-save';
import { M8_VERSION } from '../src/simulation/m8/version';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { familyTraitFooter } from '../src/presentation/trait-text';
import { g23BattleFacts } from '../src/simulation/g2-3-settlement';
import { grantShield, origin } from '../src/simulation/combat-s13-state';
import { forfeitUnclaimedOrbs } from '../src/simulation/orb-claim';
import { compileBattle, resolveTwoSidedBattle } from '../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { runSharedMatchCommand } from '../src/simulation/shared-pool';
import { recordMelAbsorption, sixState } from '../src/simulation/combat-six-cost';
import { toCombatReplay, applyCombatReplayTick } from '../src/simulation/combat-replay-view';
import { room, accept, conserved, syntheticSharedRound } from './tp-helpers';
import { generateSharedShop, rerollSharedShop, buySharedUnit, sellSharedUnit, setSharedShopLock } from '../src/simulation/shared-pool';
import type { Unit } from '../src/simulation/unit-types';
import type { MatchState } from '../src/simulation/match-types';

const hero=(id:string,col=0,row=4,team:'player'|'enemy'='player',definitionId=id,starLevel:1|2|3=1):Unit=>({id,definitionId,team,starLevel,location:{kind:'board',cell:{col,row}}});
function army(names:string[],star:1|2|3=1):MatchState {
  const s=createMatch(42),round=getCatalogRoundById('4-6');
  return {...s,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...s.m8,round},items:[],level:10,preparation:{...s.preparation,units:[...names.map((n,i)=>hero(n,i%7,4+Math.floor(i/7),'player',n,star)),hero('enemy',0,3,'enemy','garen')]}};
}
const start=(s:MatchState)=>createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'v19-part2',42);
const unit=(c:CombatState,id:string)=>c.units.find(u=>u.id===id)! as S13Unit;
const idle=(c:CombatState,actors:string[]=[])=>({...c,units:c.units.map(u=>actors.includes(u.id)?u:{...u,cooldownTicks:1200,moveCooldownTicks:1200,mana:0,maxMana:0})});
const facts=(round=4,stage=2,survivors=['a','b'],eligible=true,kind:'pvp'|'pve'='pvp'):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind:kind,result:'loss',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,family:{stage,eligible,openingIds:['a','b'],survivorIds:survivors}});

describe('v19 six costs',()=>{
  it.each([['warwick',2100,[110,165,248],70,9000,1,60,100],['viktor',1600,[100,150,225],40,5500,4,0,100],['mel',1800,[80,120,180],60,8000,3,0,40]] as const)('independent base/star table: %s',(id,hp,ad,resist,speed,range,mana,maxMana)=>{
    expect(UNIT_DEFINITIONS[id]).toMatchObject({id,cost:6,baseAttackSpeedBps:speed,attackRange:range,initialMana:mana,maxMana});
    for(const [star,bps] of [[1,10000],[2,18000],[3,36000]] as const)expect(getUnitStats(id,star)).toMatchObject({health:Math.floor(hp*bps/10000),attack:ad[star-1],armor:resist,magicResist:resist});
  });
  it('freezes stage/level odds and preserves two words per shop slot',()=>{
    const unlock=getCatalogRoundById('4-6').ordinal;
    for(let level=1;level<=10;level++){
      // Batch A (approved 10-23, table V1) replaced the v19 +4/round ramp: 4-6/4-7 are 16 (Lv10 126), 5-1 is 19 (129).
      expect(sixCostOddsBps(unlock-1,level)).toBe(0);expect(sixCostOddsBps(unlock,level)).toBe(level===10?126:16);
      expect(sixCostOddsBps(unlock+1,level)).toBe(level===10?126:16);expect(sixCostOddsBps(unlock+2,level)).toBe(level===10?129:19);
      const projected=toPrivateSeatView({...army(['lux']),level});
      expect(projected.shopOdds).toEqual({sixCostBps:level===10?126:16});
    }
    const before=generateShop(42,1,10,unlock-1),after=generateShop(42,1,10,unlock);
    expect(after.rngState).toBe(before.rngState);
    // One seat-stream draw per shop hits at clamp(5q)=0.8% at 4-6; spread the seeds so the stream words are independent.
    const seeds=Array.from({length:2000},(_,i)=>Math.imul(i+1,2654435761)>>>0);
    expect(seeds.some(seed=>generateShop(seed,1,1,unlock).shop.slots.some(s=>s.status==='available'&&UNIT_DEFINITIONS[s.definitionId].cost===6))).toBe(true);
  });
  it('shared six-cost reservations are finite, can merge, sell and fall back after exhaustion; locks and failures are inert',()=>{
    // v22 batch A: six-costs only enter through one seat-stream draw per shop (6.3% at 4-6 Lv10), so ordinary
    // slots must stay stocked for rerolls to succeed; Lux is the only ordinary stock besides the held Irelia.
    const r=room({irelia:1,lux:30,warwick:9},1),round=getCatalogRoundById('4-6'),initial=accept(generateSharedShop(r.pool,r.states[0],0)),x=syntheticSharedRound(initial.pool,[initial.state],round.ordinal);
    let state={...x.states[0],roundDefinitionId:round.roundId,m8:{...x.states[0].m8,round},gold:1000,level:10},pool=x.pool;
    let g=accept(rerollSharedShop(pool,state,state.shop.generation));pool=g.pool;state=g.state;
    for(let n=0;n<400&&pool.holdings.filter(h=>h.definitionId==='warwick').reduce((n,h)=>n+h.sources.length,0)<9;n++){
      const slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId==='warwick');
      g=accept(slot<0?rerollSharedShop(pool,state,state.shop.generation):buySharedUnit(pool,state,slot,state.shop.generation));pool=g.pool;state=g.state;conserved(pool,[state]);
    }
    const held=state.preparation.units.find(u=>u.definitionId==='warwick')!;expect(held.starLevel).toBe(3);
    const lock=accept(setSharedShopLock(pool,state,true,state.shop.generation));expect(lock.state.rngState).toBe(state.rngState);
    const failed=buySharedUnit(lock.pool,lock.state,5,lock.state.shop.generation);expect(failed.ok).toBe(false);expect(failed.state).toBe(lock.state);expect(failed.pool).toBe(lock.pool);
    const sold=accept(sellSharedUnit(lock.pool,lock.state,held.id));expect(sold.pool.available.warwick).toBe(9);conserved(sold.pool,[sold.state]);
  });
  it('Viktor fixes speed, converts extra AD/AS/mana, emits two ray damage types and only attacks add energy',()=>{
    let s=army(['viktor']);s={...s,items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'viktor',slot:0}},{id:'item-2',definitionId:'bow',location:{kind:'unit',unitId:'viktor',slot:1}},{id:'item-3',definitionId:'tear',location:{kind:'unit',unitId:'viktor',slot:2}}]};
    let c=idle(start(s).state,['viktor']);const v=unit(c,'viktor');
    expect(ad(v)).toBe(100);expect(interval(v,0)).toBe(37);expect(ap(v,0)).toBe(135);expect(v.mana).toBe(3);
    const r=stepCombat(c);expect(unit(r.state,'viktor').mana).toBe(4);
    expect(r.events.filter(e=>e.type==='packetDamage').map(e=>e.type==='packetDamage'&&e.outcome.context.damageType)).toEqual(['magic','true']);
    c={...r.state,units:r.state.units.map(u=>u.id==='viktor'?{...u,cooldownTicks:0,mana:8,sixCost:{...u.sixCost!,energy:8}}:{...u,hp:100000,maxHp:100000})};
    const cast=stepCombat(c);expect(unit(cast.state,'viktor').mana).toBe(0);expect(cast.events.some(e=>e.type==='cast')).toBe(true);
    expect(unit(cast.state,'viktor').sixCost?.storm?.due).toBe(cast.state.tick+40);
  });
  it('Viktor converts target-dependent extra attack speed at its actual current value while retaining 0.55 AS',()=>{
    let c=idle(start(army(['viktor'])).state,['viktor']);
    c={...c,units:c.units.map(u=>u.id==='viktor'?{...u,targetId:'enemy',mechanics:[...u.mechanics??[],{source:origin(u),mechanic:'quickstriker',values:{minBps:3000,maxBps:6000,shield:0,durationTicks:1}}]}:{...u,hp:500,maxHp:1000})};
    expect(ap(unit(c,'viktor'),0,c.units)).toBe(145);expect(interval(unit(c,'viktor'),0,c.units)).toBe(37);
    const r=stepCombat(c),hit=r.events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='viktor'&&e.outcome.context.damageType==='magic');
    expect(hit?.type==='packetDamage'&&hit.outcome.raw).toBe(72);
  });
  it('Warwick uses strict <15%, one devour per tick, bypasses shields, rewards only after actual death, heals and gains mana',()=>{
    let c=idle(start(army(['warwick'])).state,['warwick']);
    c={...c,units:c.units.map(u=>u.id==='warwick'?{...u,cooldownTicks:1200,mana:0,hp:1000}: {...u,hp:150,maxHp:1000,shield:500})};
    expect(stepCombat(c).events.some(e=>e.type==='devoured')).toBe(false);
    c={...c,units:[...c.units.map(u=>u.id==='enemy'?{...u,hp:149}:u),{...unit(c,'enemy'),id:'other',hp:100,maxHp:1000,cell:{col:2,row:3}}]};
    const r=stepCombat(c);expect(r.events.filter(e=>e.type==='devoured')).toHaveLength(1);expect(unit(r.state,'other').alive).toBe(false);
    expect(unit(r.state,'warwick').hp).toBe(1400);expect(unit(r.state,'warwick').mana).toBe(50);
  });
  it('Warwick executes through real shield layers, gains permanent frenzy on five kills, and retains the independent cast/passive clocks',()=>{
    let c=idle(start(army(['warwick'])).state,['warwick']);
    c={...c,units:[...c.units.map(u=>u.id==='warwick'?{...u,cooldownTicks:1200,mana:0,sixCost:{...u.sixCost!,kills:4}}:{...u,hp:149,maxHp:1000}),{...unit(c,'enemy'),id:'other',hp:100000,maxHp:100000,cell:{col:6,row:0}}]};
    const victim=unit(c,'enemy'),ctx={tick:0,board:c.board,units:c.units as S13Unit[],events:[],packets:[],heals:[],draw:()=>0};grantShield(victim,origin(victim),9999,100,0,ctx.events);
    const r=stepCombat(c);expect(unit(r.state,'enemy').alive).toBe(false);expect(unit(r.state,'warwick').sixCost).toMatchObject({kills:5,permanentFrenzy:true});
    expect(r.events.filter(e=>e.type==='devoured')).toHaveLength(1);
  });
  it('Mel absorbs only her own shield, keeps integer half remainder, and third cast conserves total across fewer than 5 enemies and ten packets',()=>{
    let c=idle(start(army(['mel','lux'])).state,['mel']);c={...c,units:c.units.map(u=>u.id==='mel'?{...u,mana:40,runtime:{...u.runtime!,castCount:2},sixCost:{...sixState(unit(c,'mel')),storedEnergy:11}}:{...u,hp:100000,maxHp:100000})};
    const r=stepCombat(c),packets=r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='mel');
    expect(packets).toHaveLength(10);expect(packets.reduce((n,e)=>n+(e.type==='packetDamage'?e.outcome.raw:0),0)).toBe(1401);
    expect(unit(r.state,'mel').sixCost?.storedEnergy).toBe(0);
    const mel=unit(r.state,'mel'),layer=mel.shieldLayers[0];expect(layer.expiresAtTick-r.state.tick).toBe(80);
    const ctx={tick:1,board:r.state.board,units:r.state.units as S13Unit[],events:[],packets:[],heals:[],draw:()=>0};
    recordMelAbsorption(ctx,{...layer,source:{...layer.source,definitionId:'lux-ability'}},9);expect(mel.sixCost?.storedEnergy).toBe(0);
    recordMelAbsorption(ctx,layer,3);recordMelAbsorption(ctx,layer,3);expect(mel.sixCost?.storedEnergy).toBe(3);
  });
  it('counts two real Mel copies in PvP facts, excludes bench/extra summon copies and counts no PvE rescue progress',()=>{
    let s=army(['mel']);s={...s,preparation:{...s.preparation,units:[...s.preparation.units,hero('second-mel',2,4,'player','mel')]}};
    let c=start(s).state;c={...c,units:c.units.map(u=>u.definitionId==='mel'?{...u,runtime:{...u.runtime!,castCount:u.id==='mel'?5:7}}:u)};
    const f=g23BattleFacts(c,'player',s.round,'pvp',s.preparation.units);expect(f.melCasts).toBe(12);
    expect(advanceG23Economy(createG23Progress(42),{...f,roundKind:'pve'}).progress.mel).toBeUndefined();
  });
  it('12 PvP casts combine across Mel copies, protect once at lethal settlement and persist through sale/rebuy',()=>{
    let p=createG23Progress(42);p=advanceG23Economy(p,{...facts(4),melCasts:11}).progress;
    let s=writeG23Progress({...createMatch(42),playerHp:5},p);expect(melCanSave(s,{...facts(5),melCasts:1},0)).toBe(true);expect(melCanSave(s,{...facts(5),roundKind:'pve',melCasts:1},0)).toBe(false);
    p=advanceG23Economy(p,{...facts(5),melCasts:1}).progress;s=writeG23Progress({...s,round:5},p);
    s=commitMelSave(s,'battle-5',[]);expect(melCanSave(s,{...facts(6),melCasts:100},0)).toBe(false);
    expect(replayG23Economy(42,readG23Progress(s)!.economyReceipts).mel?.savedBattleId).toBe('battle-5');
    const later=writeG23Progress(army(['mel']),readG23Progress(s)!);expect(buildStrategySnapshot(later).units.find(u=>u.unitId==='mel')?.mechanics).toContainEqual(expect.objectContaining({mechanic:'damageAmp',values:{bps:1000}}));
  });
  it.each(['warwick','viktor','mel'])('replays %s from frozen inputs and rejects a forged dynamic counter',id=>{
    const s=army([id]),basis=freezeCombatInput(s,42,s.resourceProvenance.entries.length),strategy=buildStrategySnapshot(s),initial=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state,r=stepCombat(initial);
    expect(validateDynamicCombat(r.state,basis,strategy)).toBe(true);
    const forged=structuredClone(r.state);(forged.units.find(u=>u.id===id) as S13Unit).sixCost!.kills=99;
    expect(()=>validateDynamicCombat(forged,basis,strategy)).toThrow();
    let terminal=initial;const events=[];while(terminal.status==='running'){const r=stepCombat(terminal);terminal=r.state;events.push(...r.events);}const replay=toCombatReplay({initial,terminal,events:events as import('../src/simulation/combat-types').LedgerCombatEvent[]});expect(replay.terminal.result).toBe(terminal.result);
  });
  it('runs a genuine two-seat six-cost battle and reproduces its public replay and owner cast facts',()=>{
    function side(names:string[]){const s=army(names);return {...s,nextUnitSerial:names.length+1,preparation:{...s.preparation,units:names.map((name,i)=>hero('unit-'+(i+1),i,4,'player',name))}};}
    const a=side(['warwick','mel']),b=side(['viktor','mel']),input=compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:'six-cost-pvp'});
    const r=resolveTwoSidedBattle(input,1201),repeated=resolveTwoSidedBattle(input,1201);
    expect(r.terminal.status).toBe('finished');expect(repeated.terminal).toEqual(r.terminal);expect(repeated.events).toEqual(r.events);
    expect(toCombatReplay(r).terminal.result).toBe(r.terminal.result);
    expect(r.events.some(e=>e.type==='chaosEnergyChanged')).toBe(true);
  });
});

describe('v19 Family heist and reunion',()=>{
  it('covers all 16 equally sized candidates, actual adults, regular duplicators and the marked dummy replacement',()=>{
    const seen=new Map<string,ReturnType<typeof initialFamilyTask>>();for(let seed=0;seed<20000&&seen.size<16;seed++){const t=initialFamilyTask(seed);seen.set(t.CurrentReward,t);}
    expect(seen.size).toBe(16);expect(FAMILY_REWARDS.map(r=>r.target)).toEqual([10,10,10,10,17,17,17,17,20,20,20,20,20,30,30,30]);
    expect(seen.get('3TrainingDummies')!.payloads).toEqual([{kind:'gold',quantity:10}]);
    expect(seen.get('ViJinx')!.payloads.map(p=>p.kind==='unit'&&p.definitionId)).toEqual(['vi','jinx']);
    expect(seen.get('3LesserDuplicators')!.payloads).toEqual(Array(3).fill({kind:'consumable',definitionId:'TFT_Consumable_ChampionDuplicator_III',quantity:1}));
  });
  it.each([[2,0,2],[2,2,2],[3,0,2],[3,2,4],[4,0,3],[4,2,5],[5,2,5]])('stage %i survivors %i gains %i; PVE and paused tiers are inert',(stage,n,gain)=>{
    let p=activateFamily(createG23Progress(42),4);const before=p.family!;
    p=advanceG23Economy(p,facts(4,stage,['a','b'].slice(0,n))).progress;expect(p.family!.CurrentProgress).toBe(gain);expect(p.rngState).toBe(createG23Progress(42).rngState);expect(p.family!.rngState).toBe(before.rngState);
    for(const f of [facts(5,4,['a'],false),facts(5,4,['a'],true,'pve')])expect(advanceG23Economy(p,f).progress.family).toEqual(p.family);
  });
  it('carries excess but pays at most once, does not wait for claims, and validates the independent RNG/receipt replay',()=>{
    let p=activateFamily(createG23Progress(42),4);p={...p,family:{...p.family!,CurrentProgress:100}};
    const r=advanceG23Economy(p,facts(4,4,['a','b']));expect(r.progress.rewards.filter(r=>r.source==='family')).toHaveLength(1);expect(r.gold).toBe(0);
    expect(r.progress.family!.CurrentProgress).toBe(105-p.family!.CurrentRewardValue);expect(advanceG23Economy(r.progress,facts(4,4)).progress).toBe(r.progress);
    let real=activateFamily(createG23Progress(42),4);for(let i=4;i<25;i++)real=advanceG23Economy(real,facts(i,4)).progress;
    expect(()=>validateG23Progress(real,42,25)).not.toThrow();expect(()=>validateG23Progress({...real,family:{...real.family!,rngDraws:999}},42,25)).toThrow();
    expect(real.rewards.length).toBeGreaterThan(3);expect(familyTaskAt(42,real.family!.sequence).payloads).toEqual(real.family!.payloads);
  });
  it('publishes progress/reward/target without seed/RNG and claims a frozen orb once',()=>{
    let p=activateFamily(createG23Progress(42),4);for(let i=4;i<15;i++)p=advanceG23Economy(p,facts(i,4)).progress;
    let s=writeG23Progress(army(['lux']),p);const display=readG23MechanismState(s)!;expect(display.familyHeist?.progressText).toContain('当前奖励');expect(JSON.stringify(display.familyHeist)).not.toMatch(/rng|seed/);
    const orb=familyOrbs(s)[0],before=p.family!.rngState,r=claimOrb(s,orb.orbId,s.round);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);s=r.state;
    expect(readG23Progress(s)!.family!.rngState).toBe(before);expect(familyOrbs(s).some(o=>o.orbId===orb.orbId)).toBe(false);expect(claimOrb(s,orb.orbId,s.round).ok).toBe(false);
  });
  it('keeps the owner progress footer and completed orb visible through the private-seat adapter without exposing task RNG',()=>{
    let p=activateFamily(createG23Progress(42),4);p={...p,family:{...p.family!,CurrentProgress:29}};p=advanceG23Economy(p,facts(4,4)).progress;
    const s=writeG23Progress({...army(['lux']),multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'seat-0',status:'active' as const,receipts:[],forfeitedChoices:[]}},p),view=toPrivateSeatView(s),display=toDisplayMatch(view);
    expect(view.seatMechanics?.hidden).toEqual({});expect(view.seatMechanics?.seat.familyHeist).toMatchObject({CurrentRewardValue:p.family!.CurrentRewardValue});
    expect(()=>readG23Progress(display)).not.toThrow();expect(view.unclaimedOrbs?.some(o=>o.source==='family')).toBe(true);
    const footer=familyTraitFooter(readG23MechanismState(s)!.familyHeist as ReturnType<typeof import('../src/simulation/family-heist').familyDisplay>);expect(footer[0]).toContain('当前奖励');
  });
  it('partially claims a full-bench family orb without dropping, rerolling or paying the blocked units',()=>{
    // Find the frozen two-hero reward deterministically; both heroes need real capacity.
    let seed=0;while(initialFamilyTask(seed).CurrentReward!=='ViJinx'){seed++;if(seed>100000)throw Error('No ViJinx seed');}
    let p=activateFamily(createG23Progress(seed),4);p={...p,family:{...p.family!,CurrentProgress:9}};p=advanceG23Economy(p,facts(4,2,[])).progress;
    const base=army(['lux']),units=[...base.preparation.units,...Array.from({length:9},(_,i)=>({...hero('bench-'+i,0,0,'player',['irelia','darius','lux'][i%3]),location:{kind:'bench' as const,slot:i}}))];
    const s=writeG23Progress({...base,seed,preparation:{...base.preparation,units}},p),orb=familyOrbs(s)[0],r=claimOrb(s,orb.orbId,s.round);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);
    expect(readG23Progress(r.state)!.rewardClaims).toEqual([]);expect(familyOrbs(r.state)[0].entries).toEqual(orb.entries);
  });
  it('clears a solo terminal queued Family intent without granting resources or replaying the intent on restore',()=>{
    const initial=createMatch(42),queued={...initial,m8:{...initial.m8,loot:{...initial.m8.loot,queuedOrbClaims:['family:orb:1']}}};
    const r=forfeitUnclaimedOrbs(queued);expect(r.state.m8.loot.queuedOrbClaims).toEqual([]);expect(r.state.gold).toBe(queued.gold);expect(r.state.preparation).toBe(queued.preparation);expect(r.events).toEqual([]);
    expect(forfeitUnclaimedOrbs(r.state).state).toBe(r.state);
  });
  it('claims 2-star Family heroes through a real shared-pool transaction with three copies each and no repeated award',()=>{
    let seed=0;while(initialFamilyTask(seed).CurrentReward!=='2starViJinx'){seed++;if(seed>100000)throw Error('No 2starViJinx seed');}
    const r=room(undefined,1),initial=r.states[0];let p=activateFamily(createG23Progress(seed),4);
    p={...p,family:{...p.family!,CurrentProgress:29}};p=advanceG23Economy(p,facts(4,2,[])).progress;
    const state=writeG23Progress(initial,p),orb=familyOrbs(state)[0];
    const claimed=accept(runSharedMatchCommand(r.pool,state,{type:'claimOrb',orbId:orb.orbId,round:state.round}));
    for(const id of ['vi','jinx']){expect(claimed.state.preparation.units.find(u=>u.definitionId===id)?.starLevel).toBe(2);expect(claimed.pool.holdings.find(h=>h.definitionId===id)?.sources).toHaveLength(3);}
    conserved(claimed.pool,[claimed.state]);
    const twice=runSharedMatchCommand(claimed.pool,claimed.state,{type:'claimOrb',orbId:orb.orbId,round:claimed.state.round});expect(twice.ok).toBe(false);expect(twice.pool).toBe(claimed.pool);expect(twice.state).toBe(claimed.state);
  });
  it.each([1,2,3] as const)('reunion boosts six real heroes at star %i, affects numeric stats, and never changes permanent ownership',star=>{
    const ids=['violet','vander','powder','warwick','jinx','vi'];let s=army(ids,star);s={...s,items:['warwick','jinx','vi'].map((id,i)=>({id:'item-'+(i+1),definitionId:'TFT13_Item_FamilyEmblemItem',location:{kind:'unit',unitId:id,slot:0}}))};
    expect(familyReunionParticipants(s)).toEqual(ids);const original=JSON.stringify(s),c=start(s).state;
    expect(toPrivateSeatView({...s,combat:c} as MatchState).familyReunion).toMatchObject({eligible:true,participantIds:ids,downgraded:false,downgradedAtTick:null});
    const basis=freezeCombatInput(s,42,s.resourceProvenance.entries.length);
    const moved={...s,combat:c,combatInputBasis:basis,preparation:{...s.preparation,units:s.preparation.units.filter(u=>u.id!=='vi')}} as MatchState;
    expect(toPrivateSeatView(moved).familyReunion).toMatchObject({eligible:true,participantIds:ids});
    for(const id of ids){expect(unit(c,id).effectiveStarLevel).toBe(star+1);expect(unit(c,id).maxHp).toBeGreaterThan(getUnitStats(id,star).health);expect(unit(c,id).ability).not.toEqual(buildStrategySnapshot({...s,items:[]}).units.find(u=>u.unitId===id)!.ability);}
    expect(JSON.stringify(s)).toBe(original);expect(start(s).state).toEqual(c);
    for(const missing of ids)expect(familyReunionParticipants({...s,preparation:{...s.preparation,units:s.preparation.units.filter(u=>u.id!==missing)}})).toEqual([]);
    expect(familyReunionParticipants({...s,items:s.items.slice(1)})).toEqual([]);
    expect(familyReunionParticipants({...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.id==='vi'?{...u,location:{kind:'bench',slot:0}}:u)}})).toEqual([]);
  });
  it.each([1,2,3] as const)('first real reunion death removes only the extra star once at rank %i, preserving sources and shield snapshots',star=>{
    const ids=['violet','vander','powder','warwick','jinx','vi'];let s=army(ids,star);
    s={...s,items:['warwick','jinx','vi'].map((id,i)=>({id:'item-'+(i+1),definitionId:'TFT13_Item_FamilyEmblemItem',location:{kind:'unit',unitId:id,slot:0}}))};
    const initial=start(s).state,units=structuredClone(initial.units) as S13Unit[],events:import('../src/simulation/combat-types').CombatEvent[]=[];
    const ctx={tick:1,board:initial.board,units,events,packets:[],heals:[],draw:()=>0};
    // No member death: unrelated deaths and temporary absence cannot revoke the bonus.
    units.find(u=>u.id==='enemy')!.alive=false;units.find(u=>u.id==='enemy')!.hp=0;
    settleFamilyReunionDeaths(ctx,units);
    for(const id of ids)expect(units.find(u=>u.id===id)!.effectiveStarLevel).toBe(star+1);
    expect(events).toEqual([]);
    const survivor=units.find(u=>u.id==='jinx')!;survivor.hp=Math.floor(survivor.maxHp/2);
    grantShield(survivor,origin(survivor),333,100,1,events);const shields=structuredClone(survivor.shieldLayers),beforeHp=survivor.hp,beforeMax=survivor.maxHp;
    const first=units.find(u=>u.id==='violet')!;first.alive=false;first.hp=0;
    settleFamilyReunionDeaths(ctx,units);
    for(const id of ids.slice(1)){
      const u=units.find(u=>u.id===id)!,base=familyCombatBase(u,star),expected=resolveEffects(base.base,base.ability,u.sources!);
      expect(u).toMatchObject({starLevel:star,effectiveStarLevel:star,maxHp:expected.stats.health,attackDamageBase:expected.attackDamageBase,ability:expected.ability,familyReunion:{downgradedAtTick:1}});
    }
    expect(survivor.hp).toBe(Math.floor(beforeHp*survivor.maxHp/beforeMax));expect(survivor.shieldLayers).toEqual(shields);
    expect(events.filter(e=>e.type==='maxHpChanged')).toHaveLength(5);
    const second=units.find(u=>u.id==='vander')!;second.alive=false;second.hp=0;ctx.tick=2;
    const before=JSON.stringify(units),count=events.length;settleFamilyReunionDeaths(ctx,units);
    expect(JSON.stringify(units)).toBe(before);expect(events).toHaveLength(count);
    for(const id of ids)expect(unit(initial,id).effectiveStarLevel).toBe(star+1);
  });
  it('authenticates reunion downgrade checkpoints and resumes/replays the same deaths, stats and star updates',()=>{
    const ids=['violet','vander','powder','warwick','jinx','vi'];let s=army(ids);
    s={...s,items:['warwick','jinx','vi'].map((id,i)=>({id:'item-'+(i+1),definitionId:'TFT13_Item_FamilyEmblemItem',location:{kind:'unit',unitId:id,slot:0}})),preparation:{...s.preparation,units:[...s.preparation.units.filter(u=>u.team==='player'),hero('enemy',0,3,'enemy','warwick',3),hero('enemy-2',1,3,'enemy','garen',3)]}};
    const basis=freezeCombatInput(s,42,s.resourceProvenance.entries.length),strategy=buildStrategySnapshot(s),initial=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
    let c=initial,checkpoint:CombatState|undefined;const events:import('../src/simulation/combat-types').CombatEvent[]=[];
    while(c.status==='running'){
      const r=stepCombat(c);c=r.state;events.push(...r.events);
      if(!checkpoint&&c.units.some(u=>u.familyReunion?.downgradedAtTick!==undefined)){
        const view=toPrivateSeatView({...s,combat:c} as MatchState).familyReunion;
        expect(view).toMatchObject({eligible:true,participantIds:ids,downgraded:true,downgradedAtTick:c.tick});
        expect(readG23MechanismState({...s,combat:c} as MatchState)!.familyReunion).toEqual(view);
        checkpoint=JSON.parse(JSON.stringify(c));expect(validateDynamicCombat(checkpoint!,basis,strategy)).toBe(true);
        const forged=structuredClone(c),u=forged.units.find(u=>u.alive&&u.familyReunion)!;
        (u as S13Unit).effectiveStarLevel=2;expect(()=>validateDynamicCombat(forged,basis,strategy)).toThrow();
      }
    }
    expect(checkpoint).toBeDefined();let resumed=checkpoint!;while(resumed.status==='running')resumed=stepCombat(resumed).state;
    expect(resumed).toEqual(c);expect(validateDynamicCombat(c,basis,strategy)).toBe(true);
    const replay=toCombatReplay({initial,terminal:c,events:events as import('../src/simulation/combat-types').LedgerCombatEvent[]});
    let view=replay.initial;for(const tick of replay.ticks)view=applyCombatReplayTick(view,tick);expect(view).toEqual(replay.terminal);
    expect(replay.ticks.some(t=>t.events.some(e=>e.type==='unitUpdated'&&e.changes.effectiveStarLevel===1))).toBe(true);
  });
});

describe('v19 emblem replacement and schema',()=>{
  it('uses the approved total base stats on all 22 identities; tears no longer grant initial mana',()=>{
    const expected:Record<string,Record<string,number>>={conqueror:{health:200,ad:1000,ap:10},artillerist:{ad:2500},rebel:{as:4000},quickstriker:{as:2000},'black-rose':{health:250,ad:1000,ap:10},sorcerer:{ap:25},enforcer:{as:2500,armor:25,mr:25},sentinel:{armor:25,mr:25},automata:{as:1000,armor:15,mr:15},'pit-fighter':{ad:2000,ap:20,armor:20,mr:20},experiment:{health:250,ad:1500,ap:15},bruiser:{health:150},firelight:{as:3500,health:250},ambusher:{},family:{as:2000},visionary:{},academy:{ap:25},dominator:{ap:25},'chem-baron':{health:375},scrap:{health:375},sniper:{as:2500},watcher:{health:188,armor:25}};
    expect(Object.values(EMBLEM_ITEMS)).toHaveLength(22);
    for(const i of Object.values(EMBLEM_ITEMS)){
      const actual:Record<string,number>={};for(const e of i.effects){if(e.kind==='statFlat')actual[({maxHp:'health',abilityPower:'ap',armor:'armor',magicResist:'mr'} as Record<string,string>)[e.stat]??e.stat]=e.amount;else if(e.kind==='statPercentBps')actual.ad=e.bps;else if(e.kind==='attackSpeedBps')actual.as=e.bps;}
      expect(actual,i.id).toEqual(expected[i.emblemTrait!]);expect(readItemCatalog().find(c=>c.id===i.id)).toMatchObject({recipe:i.recipe??null});
    }
    for(const trait of ['family','visionary'])expect(EMBLEM_ITEMS[Object.keys(EMBLEM_ITEMS).find(id=>EMBLEM_ITEMS[id].emblemTrait===trait)!].effects.some(e=>e.kind==='statFlat'&&e.stat==='initialMana')).toBe(false);
  });
  it('replies to emblem periodic mana at 1-second boundaries, keeping initial mana unchanged',()=>{
    let s=army(['lux']);s={...s,items:[{id:'item-1',definitionId:'TFT13_Item_FamilyEmblemItem',location:{kind:'unit',unitId:'lux',slot:0}}]};
    let c:CombatState=idle(start(s).state);c={...c,units:c.units.map(u=>u.id==='lux'?{...u,maxMana:100,mana:0}:u)};
    for(let i=0;i<19;i++)c=stepCombat(c).state;expect(unit(c,'lux').mana).toBe(0);c=stepCombat(c).state;expect(unit(c,'lux').mana).toBe(3);
  });
  it('retains v19 rules in v24-online-rules schema/save/replay 12/8/8',()=>expect(M8_VERSION).toMatchObject({schemaVersion:12,saveFormatVersion:8,replayFormatVersion:8,rulesVersion:'s13-g2-3-v24-online-rules'}));
});
