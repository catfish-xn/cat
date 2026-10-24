import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import type { Unit } from '../src/simulation/unit-types';
import type { MatchState } from '../src/simulation/match-types';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { ad, ap, type S13Unit } from '../src/simulation/combat-s13-state';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { itemGoldPayouts } from '../src/simulation/g2-4b-item-gold';
import { advanceG23Economy } from '../src/simulation/g2-3-economy';
import { createG23Progress } from '../src/simulation/g2-3-match-progress';
import { p2GiftPlan, drainP2Gifts } from '../src/simulation/s13-augments-p2-grants';
import { validateContent } from '../src/simulation/validate-content';
import { V19_MECHANICS } from '../src/simulation/content/v19-mechanics';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { chainbladeGoldTarget } from '../src/simulation/combat-v19';
import { createTrenchCopy } from '../src/simulation/combat-g2-4b-trench';

const hero=(id:string,col=0,row=4,team:'player'|'enemy'='player',definitionId=id):Unit=>({id,definitionId,team,starLevel:1,location:{kind:'board',cell:{col,row}}});
function army(names:string[]):MatchState {
  const s=createMatch(42),round=getCatalogRoundById('2-1');
  return {...s,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...s.m8,round},items:[],preparation:{...s.preparation,units:[...names.map((n,i)=>hero(n,i%7,4+Math.floor(i/7))),hero('enemy',0,3,'enemy','garen')]}};
}
function tierArmy(trait:string,tier:number):MatchState {
  const all=Object.values(M5_UNIT_DEFINITIONS),native=all.filter(u=>u.traits.includes(trait)).slice(0,tier).map(u=>u.id);
  const added=all.filter(u=>!u.traits.includes(trait)).slice(0,tier-native.length).map(u=>u.id),s=army([...native,...added]);
  const emblem=Object.values(EMBLEM_ITEMS).find(i=>i.emblemTrait===trait)!;
  return {...s,items:added.map((id,i)=>({id:'item-'+(i+1),definitionId:emblem.id,location:{kind:'unit',unitId:id,slot:0}}))};
}
const start=(s:MatchState)=>createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'v19',42);
const unit=(c:CombatState,id:string)=>c.units.find(u=>u.id===id)! as S13Unit;
const idle=(c:CombatState,except:string[]=[])=>({...c,units:c.units.map(u=>except.includes(u.id)?u:{...u,cooldownTicks:1200,moveCooldownTicks:1200,mana:0,maxMana:0})});
function ticks(c:CombatState,n:number){let state=c;const events=[];for(let i=0;i<n&&state.status==='running';i++){const r=stepCombat(state);state=r.state;events.push(...r.events);}return {state,events};}

describe('v19 archived mechanics in synthetic combat',()=>{
  it('keeps the complete content catalogue valid',()=>expect(()=>validateContent()).not.toThrow());
  it.each([2,4,6])('Dominator %i samples actual increased cost then restored cost, and stacks',tier=>{
    let c=idle(start(tierArmy('dominator',tier)).state);
    const id=c.units.find(u=>u.mechanics?.some(m=>m.mechanic==='g23Trait'&&m.source.definitionId==='dominator'))!.id;
    c={...c,units:c.units.map(u=>u.id===id?{...u,maxMana:53,mana:53,unreavedMaxMana:40,cooldownTicks:0}:u)};
    const before=ap(unit(c,id),0),first=stepCombat(c),receipt=first.events.find(e=>e.type==='cast');
    expect(receipt?.type==='cast'&&'receipt' in receipt&&receipt.receipt.actualManaSpent).toBe(53);
    const expected=Math.floor(53*V19_MECHANICS.dominator[tier as 2|4|6]/10000);
    expect(ap(unit(first.state,id),1)-before).toBe(expected);
    const second=stepCombat({...first.state,units:first.state.units.map(u=>u.id===id?{...u,mana:40,cooldownTicks:0}:u)});
    expect(ap(unit(second.state,id),2)-before).toBe(expected+Math.floor(40*V19_MECHANICS.dominator[tier as 2|4|6]/10000));
  });
  it.each([1,4])('Garen Emissary %i freezes actual item/trait HP and awards it once to self/left/right',tier=>{
    let s=army(tier===1?['garen','lux','darius']:['garen','nami','ambessa','tristana','lux','darius']);
    s={...s,preparation:{...s.preparation,units:[hero('garen',2),hero('lux',1),hero('darius',3),...s.preparation.units.filter(u=>!['garen','lux','darius'].includes(u.id))]},items:[{id:'item-1',definitionId:'warmog',location:{kind:'unit',unitId:'garen',slot:0}}]};
    const c=start(s).state,g=unit(c,'garen'),sample=g.v19!.garenSample!;
    expect(sample).toBe(buildStrategySnapshot(s).units.find(u=>u.unitId==='garen')!.stats.health);
    expect(g.maxHp).toBe(sample+Math.floor(sample*12/100));
    for(const id of ['lux','darius'])expect(unit(c,id).v19?.sharedHealth).toBe(Math.floor(sample*12/100));
    expect(unit(ticks(idle(c),2).state,'garen').maxHp).toBe(g.maxHp);
  });
  it.each([2,4])('Form Swapper %i applies fixed starting-row reduction/amplification on both teams',tier=>{
    const s=army(['elise','swain',...(tier===4?['gangplank','jayce']:[])]),base=start(s).state;
    expect(base.strategy!.traits.find(t=>t.traitId==='form-swapper'&&t.team==='player')?.tier).toBe(tier);
    const run=(front:boolean,enabled:boolean)=>{
      const e=unit(base,'enemy'),p=unit(base,'elise');
      const c={...base,units:[{...p,cell:{col:0,row:4},startingCell:{col:0,row:front?4:6},cooldownTicks:0,maxMana:0,mana:0,mechanics:enabled?p.mechanics:p.mechanics!.filter(m=>m.mechanic!=='formSwapper')},
        {...e,maxHp:100000,hp:100000,armor:0,magicResist:0,cooldownTicks:1200,maxMana:0,mana:0}]};
      return stepCombat(c).events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='elise');
    };
    const plain=run(false,false),amped=run(false,true);
    expect(plain?.type==='packetDamage'&&amped?.type==='packetDamage'&&amped.outcome.hpDamage).toBe(plain?.type==='packetDamage'?Math.floor(plain.outcome.hpDamage*(tier===2?12000:14000)/10000):0);
    // Enemy teams use rows 2/3 as the front; the same mechanic is read from startingCell.
    expect(TRAIT_DEFINITIONS['form-swapper'].tiers.map(t=>t.threshold)).toEqual([2,4]);
    const front=(team:'player'|'enemy',enabled:boolean)=>{
      const p=unit(base,'elise'),e=unit(base,'enemy');
      const victim={...p,id:'victim',team,cell:{col:0,row:team==='player'?4:3},startingCell:{col:0,row:team==='player'?4:3},hp:100000,maxHp:100000,armor:0,magicResist:0,maxMana:0,mana:0,cooldownTicks:1200,mechanics:enabled?p.mechanics:p.mechanics!.filter(m=>m.mechanic!=='formSwapper')};
      const attacker={...e,id:'attacker',team:team==='player'?'enemy' as const:'player' as const,cell:{col:0,row:team==='player'?3:4},maxMana:0,mana:0,cooldownTicks:0,attackRange:100};
      return stepCombat({...base,units:[victim,attacker]}).events.find(e=>e.type==='packetDamage');
    };
    for(const team of ['player','enemy'] as const){const a=front(team,false),b=front(team,true);expect(a?.type==='packetDamage'&&b?.type==='packetDamage'&&b.outcome.mitigated).toBe(a?.type==='packetDamage'?Math.max(1,Math.floor(a.outcome.mitigated*(tier===2?8500:7000)/10000)):0);}
  });
  it('Chainblade excludes neutral/summon/copy gold and refreshes one 200-tick buff per kill',()=>{
    const s=army(['lux']),armed={...s,items:[{id:'item-1',definitionId:V19_MECHANICS.chainblade.id,location:{kind:'unit' as const,unitId:'lux',slot:0}}]};
    let c:CombatState=idle(start(armed).state,['lux']);const e=unit(c,'enemy'),u=unit(c,'lux');
    expect(chainbladeGoldTarget(u,e)).toBe(true);
    const inherited=createTrenchCopy(u,{mechanic:'g24Trench',source:u.mechanics!.find(m=>m.mechanic==='v19Chainblade')!.source,values:{healthBps:3000}},0,{col:4,row:6},1);
    expect(inherited.mechanics!.find(m=>m.mechanic==='v19Chainblade')!.values.pvp).toBe(1);
    for(const target of [{...e,unitKind:'neutral' as const},{...e,definitionId:'g23-sion'},{...e,itemSummon:{} as never},{...e,anomalySummon:{} as never},{...e,team:u.team}])expect(chainbladeGoldTarget(u,target)).toBe(false);
    c={...c,units:[...c.units.map(x=>x.id==='lux'?{...x,maxMana:0,mana:0,attackRange:100,cooldownTicks:0}:x.id==='enemy'?{...x,maxHp:2000,hp:250,armor:0}:x),
      {...e,id:'second',hp:1000000,maxHp:1000000,cell:{col:5,row:0}}, {...e,id:'third',hp:1000000,maxHp:1000000,cell:{col:6,row:0}}]};
    let r=stepCombat(c);const expiry=(c:CombatState)=>unit(c,'lux').mechanismState!.statuses.flatMap(g=>g.contributions).filter(x=>x.source.definitionId===V19_MECHANICS.chainblade.id);
    expect(expiry(r.state).map(x=>x.expiresAtTick)).toEqual([201,201]);
    c=ticks(idle(r.state),49).state;
    r=stepCombat({...c,units:c.units.map(x=>x.id==='lux'?{...x,cooldownTicks:0}:x.id==='second'?{...x,hp:250,maxHp:2000,armor:0,cell:{col:0,row:3}}:x)});
    expect(r.state.itemGoldReceipts!.map(x=>x.gold)).toEqual([3,3]);
    expect(expiry(r.state).map(x=>x.expiresAtTick)).toEqual([251,251]);
    expect(expiry(r.state).map(x=>x.application.modifier?.value)).toEqual([{kind:'constant',amount:2000},{kind:'constant',amount:2000}]);
    expect(expiry(ticks(idle(r.state),200).state)).toHaveLength(0);
  });
  it('Chainblade uses a strict post-hit 20% boundary and grants no execution reward for natural lethality',()=>{
    const s=army(['lux']),armed={...s,items:[{id:'item-1',definitionId:V19_MECHANICS.chainblade.id,location:{kind:'unit' as const,unitId:'lux',slot:0}}]};
    let c:CombatState=idle(start(armed).state,['lux']);c={...c,units:c.units.map(u=>u.id==='lux'?{...u,maxMana:0,mana:0,attackRange:100,cooldownTicks:0}:u.id==='enemy'?{...u,maxHp:2000,hp:1000,armor:0}:u)};
    const probe=stepCombat(c).events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='lux');
    if(probe?.type!=='packetDamage')throw Error('missing attack');const damage=probe.outcome.hpDamage;
    const at=(hp:number)=>stepCombat({...c,units:c.units.map(u=>u.id==='enemy'?{...u,hp}:u)});
    const exact=at(400+damage);expect(exact.state.itemGoldReceipts).toEqual([]);expect(unit(exact.state,'enemy').hp).toBe(400);
    expect(at(399+damage).state.itemGoldReceipts!.map(r=>r.gold)).toEqual([3]);
    const lethal=at(damage);expect(lethal.state.itemGoldReceipts).toEqual([]);expect(lethal.events.filter(e=>e.type==='heal')).toEqual([]);
  });
  it('Sisters requires its augment and both distinct partners; gifts use unique receipts',()=>{
    const s=army(['jinx','vi']);
    expect(buildStrategySnapshot(s).traits.find(t=>t.traitId==='sisters')?.tier).toBe(0);
    const unlocked={...s,augments:[{definitionId:'sisters',choiceId:'sisters-1',acquiredRound:1}]};
    expect(buildStrategySnapshot(unlocked).traits.find(t=>t.traitId==='sisters')?.tier).toBe(2);
    expect(buildStrategySnapshot({...unlocked,preparation:{...s.preparation,units:s.preparation.units.filter(u=>u.id!=='vi')}}).traits.find(t=>t.traitId==='sisters')?.tier).toBe(0);
    expect(p2GiftPlan(unlocked).map(g=>g.definitionId)).toEqual(['vi','jinx']);
    const gifts=drainP2Gifts({...createMatch(42),augments:unlocked.augments});
    expect(drainP2Gifts(gifts)).toEqual(gifts);
  });
  it.each(['jinx','vi'])('Sisters: %s takedown buffs the partner, refreshes and expires',actor=>{
    const s={...army(['jinx','vi']),augments:[{definitionId:'sisters',choiceId:'sisters-1',acquiredRound:1}]};
    const partner=actor==='jinx'?'vi':'jinx';let c=idle(start(s).state,[actor]);
    c={...c,units:c.units.map(u=>u.id===actor?{...u,maxMana:0,mana:0,attackDamageBase:1000,attackDamage:1000,attackRange:100}:u.id==='enemy'?{...u,hp:1}:u)};
    // Leave another enemy alive so the timed effect can expire.
    c={...c,units:[...c.units,{...unit(c,'enemy'),id:'other',hp:100000,maxHp:100000,cell:{col:6,row:0}}]};
    const first=stepCombat(c),p=unit(first.state,partner);
    const buff=p.mechanismState!.statuses.flatMap(g=>g.contributions).find(x=>x.source.definitionId==='sisters')!;
    expect(buff.application.modifier?.value).toEqual({kind:'constant',amount:actor==='jinx'?4000:7500});
    expect(buff.expiresAtTick).toBe(1+(actor==='jinx'?140:100));
    if(actor==='jinx')expect(ad(p)).toBeGreaterThan(p.attackDamage);
    const end=ticks(idle(first.state),actor==='jinx'?140:100).state;
    expect(unit(end,partner).mechanismState!.statuses.flatMap(g=>g.contributions).filter(x=>x.source.definitionId==='sisters')).toHaveLength(0);
  });
  it('Sisters recognizes a prior contributor even when another ally delivers the lethal hit',()=>{
    const s={...army(['jinx','vi','darius']),augments:[{definitionId:'sisters',choiceId:'sisters-1',acquiredRound:1}]};
    let c:CombatState=idle(start(s).state,['jinx']);c={...c,units:[...c.units.map(u=>u.id==='jinx'?{...u,maxMana:0,mana:0,attackRange:100,cooldownTicks:0}:u.id==='enemy'?{...u,maxHp:10000,hp:10000}:u),
      {...unit(c,'enemy'),id:'other',hp:100000,maxHp:100000,cell:{col:6,row:0}}]};
    const first=stepCombat(c);expect(first.state.damageContributors?.enemy).toContain('jinx');
    const second=stepCombat({...idle(first.state),units:idle(first.state).units.map(u=>u.id==='darius'?{...u,maxMana:0,mana:0,cooldownTicks:0,attackRange:100}:u.id==='enemy'?{...u,hp:1}:u)});
    const buff=unit(second.state,'vi').mechanismState!.statuses.flatMap(g=>g.contributions).find(c=>c.source.definitionId==='sisters');
    expect(buff?.application.modifier?.value).toEqual({kind:'constant',amount:4000});
    expect(second.events.find(e=>e.type==='kill'&&e.unitId==='enemy')).toMatchObject({source:{ownerId:'darius'}});
  });
  it('Rebel 10 signals at 0/240/480 with permanent stats once, refreshed burst and repeat stun',()=>{
    const c=idle(start(tierArmy('rebel',10)).state),id=c.units.find(u=>u.team==='player'&&u.v19?.smokePermanent)!.id;
    const before=unit(c,id),hp=before.maxHp,attack=ad(before),power=ap(before,0);
    expect(before.v19?.smokeOrdinal).toBe(0);
    const a=ticks(c,240),b=ticks(a.state,240);
    for(const [r,n] of [[a,1],[b,2]] as const){const u=unit(r.state,id);expect(u.v19?.smokeOrdinal).toBe(n);expect(u.maxHp).toBe(hp);expect(ad(u)).toBe(attack);expect(ap(u,r.state.tick)).toBe(power);
      expect(r.events.some(e=>e.type==='statusChanged'&&e.group.kind==='stun'&&e.tick===240*n)).toBe(true);}
  });
  it('Rose marks only enemies hit by the unshackle charge, gives one separate 1.08 multiplier to members, and remains after Sion death',()=>{
    const s=army(['morgana','vladimir','cassiopeia','elise']),base=start(s).state;
    const sion=base.units.find(u=>u.definitionId==='g23-sion')!;
    expect(sion.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier).toBe(4);
    const attacking=idle(base,[sion.id]),attacked=stepCombat({...attacking,units:attacking.units.map(u=>u.id===sion.id?{...u,runtime:{...u.runtime!,buddyTriggered:true},maxMana:0,mana:0,attackRange:100,cooldownTicks:0}:u.id==='enemy'?{...u,hp:100000,maxHp:100000}:u)});
    expect(attacked.events.some(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId===sion.id&&e.outcome.hpDamage>0)).toBe(true);
    expect(unit(attacked.state,'enemy').v19?.roseTeams).toBeUndefined();
    let c=idle(base,[sion.id]);c={...c,units:c.units.map(u=>u.id===sion.id?{...u,hp:Math.floor(u.maxHp/2),maxMana:0,mana:0}:u.id==='enemy'?{...u,hp:100000,maxHp:100000}:u)};
    const marked=stepCombat(c).state;expect(unit(marked,'enemy').v19?.roseTeams).toEqual(['player']);
    const probe=(mark:boolean)=>stepCombat({...idle(marked,['morgana']),units:idle(marked,['morgana']).units.map(u=>u.id===sion.id?{...u,alive:false,hp:0}:u.id==='morgana'?{...u,attackRange:100,maxMana:0,mana:0,cooldownTicks:0}:u.id==='enemy'?{...u,v19:mark?u.v19:undefined}:u)});
    const a=probe(false).events.find(e=>e.type==='packetDamage'),b=probe(true).events.find(e=>e.type==='packetDamage');
    expect(a?.type==='packetDamage'&&b?.type==='packetDamage'&&b.outcome.mitigated).toBe(a?.type==='packetDamage'?Math.floor(a.outcome.mitigated*10800/10000):0);
  });
  it.each([true,false])('Perfected Chainblade executes/heals once; PvP gold eligibility=%s and duplicates do not stack',pvp=>{
    const s=army(['lux']);const round=getCatalogRoundById(pvp?'2-1':'1-2');
    const armed={...s,round:round.ordinal,items:[0,1].map(slot=>({id:'item-'+(slot+1),definitionId:V19_MECHANICS.chainblade.id,location:{kind:'unit' as const,unitId:'lux',slot}}))};
    let c=idle(start(armed).state,['lux']);c={...c,units:c.units.map(u=>u.id==='lux'?{...u,hp:u.maxHp-400,maxMana:0,mana:0,attackRange:100,cooldownTicks:0}:u.id==='enemy'?{...u,hp:250,maxHp:2000,armor:0}:u)};
    const r=stepCombat(c);expect(r.events.filter(e=>e.type==='kill')).toHaveLength(1);
    expect(r.events.filter(e=>e.type==='heal').map(e=>e.type==='heal'&&e.outcome.actual)).toEqual([400]);
    expect(r.state.itemGoldReceipts).toHaveLength(pvp?1:0);
    if(pvp){const payout=itemGoldPayouts({streams:r.state.itemRandomStreams!,receipts:r.state.itemGoldReceipts!},new Set(['lux']));expect(payout[0].amount).toBe(3);
      const facts={battleId:'v19',round:4,roundKind:'pvp' as const,result:'win' as const,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0 as const,highRollerGold:0,itemGoldPayouts:payout};
      const settled=advanceG23Economy(createG23Progress(42),facts);expect(settled.gold).toBe(3);expect(advanceG23Economy(settled.progress,facts).gold).toBe(0);}
    expect(r.events.filter(e=>e.type==='statusChanged'&&e.reason==='applied'&&e.group.contributions.some(x=>x.source.definitionId===V19_MECHANICS.chainblade.id))).toHaveLength(2);
    expect(stepCombat(r.state).events).toEqual([]);
  });
  it('reconstructs new runtime from frozen inputs and rejects forged marks/HP/receipts/clocks',()=>{
    for(const s of [army(['garen','lux']),tierArmy('rebel',10),army(['cassiopeia','ziggs']),army(['morgana','vladimir','cassiopeia','elise'])]){
      const strategy=buildStrategySnapshot(s),basis=freezeCombatInput(s,42,0);
      const initial=createCombatWithEvents(s.preparation,strategy,'v19',42).state;
      const c=ticks(initial,3).state;
      expect(validateDynamicCombat(c,{...basis,combatId:'v19'},strategy)).toBe(true);
      const forged={...c,units:c.units.map((u,i)=>i?u:{...u,v19:{...u.v19,smokeOrdinal:99}})};
      expect(()=>validateDynamicCombat(forged,{...basis,combatId:'v19'},strategy)).toThrow('authoritative');
    }
  });
  it('Sevika emits move/channel/enhancement in a detached whitelisted display event without extra RNG',()=>{
    let c=idle(start(army(['sevika'])).state,['sevika']);c={...c,units:c.units.map(u=>u.id==='sevika'?{...u,mana:u.maxMana,attackRange:100}:u)};
    const r=stepCombat(c),e=r.events.find(e=>e.type==='castOutcome');expect(e?.type).toBe('castOutcome');
    if(e?.type!=='castOutcome')throw Error('missing variant');
    expect(e.castVariant).toMatchObject({actionSeq:0,heroAugmentIds:[]});
    expect(['flamethrower','punch','chomp']).toContain(e.castVariant!.move);
    const projected=toCombatViewEvents([e as never])[0] as unknown as {castVariant:typeof e.castVariant};
    expect(projected.castVariant).toEqual(e.castVariant);expect(projected.castVariant).not.toBe(e.castVariant);
    expect(r.state.rngDraws).toBeGreaterThan(0);
  });
});
