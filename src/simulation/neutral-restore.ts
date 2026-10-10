import type { CombatState } from './combat-types';
import type { GameState } from './game';
import type { StrategySnapshot } from './strategy-types';
import type { StatusApplication } from './m8/contracts';
import { canonicalContent } from './content';
import { COMPILED_NEUTRAL_ENCOUNTERS, readNeutralCombatUnit } from './neutral-encounter-compiler';
import { freezeCompanions } from './m8/companions';
import { planOpening } from './m8/opening';
import { declaredEffects } from './m8/item-restore';
import { canonicalSource, effectIdentity } from './m8/identity';

const same = (a: unknown, b: unknown) => a === b || a !== undefined && b !== undefined && canonicalContent(a) === canonicalContent(b);
function check(value: unknown, label: string): asserts value { if (!value) throw new Error(`Invalid Match save: neutral ${label}`); }
/** Same-version static content and once-only consumption validation; no combatStart, draws or effects. */
export function validateNeutralCombat(combat: CombatState, preparation: GameState, strategy: StrategySnapshot): ReadonlySet<string> {
  const trusted = combat.units.flatMap(u => { const n = readNeutralCombatUnit(u.id); return n ? [n] : []; });
  const openings = COMPILED_NEUTRAL_ENCOUNTERS.flatMap(e=>e.openingDefinitions).filter(d=>trusted.some(u=>u.id===d.source.ownerId));
  const companionDefs = trusted.flatMap(u=>u.companionDefinitions ?? []);
  // Every current tick-1 periodic declaration is an unconditional aura; maintenance consumes
  // its action identity before the opening task even when there is no payable damage.
  const openingSeq = strategy.units.reduce((n,u)=>n+(u.itemPrograms ?? []).flatMap(p=>p.program.periodic ?? [])
    .filter(p=>(p.startsAtTick ?? p.periodTicks)===1).length,0);
  const neutralKeys = new Set<string>(), combatId = combat.combatId!, tick = combat.tick;
  for (const u of combat.units) {
    const expected = trusted.find(n=>n.id===u.id);
    for (const field of ['unitKind','monsterFamily','encounterId','baseCritChanceBps','baseCritMultiplierBps','companionDefinitions','attackCone'] as const)
      check(same(u[field], expected?.[field]), `authored ${field}`);
    const origin = preparation.units.find(p=>p.id===u.id)!;
    check(origin.location.kind==='board' && (tick===0 && u.startingCell===undefined || same(u.startingCell,origin.location.cell)), 'starting cell');
    if (expected) check(u.team==='enemy' && u.starLevel===1 && u.definitionId===expected.definitionId
      && u.mana===0 && u.maxMana===0 && same(u.spellCrit,expected.spellCrit), 'identity/mana/crit');
  }
  const receipts=combat.neutralReceipts;
  check(trusted.length ? receipts && Array.isArray(receipts.deaths) && Array.isArray(receipts.controls) : receipts===undefined, 'receipts namespace');
  const eventIds=new Set<number>(),deathIds=new Set<string>(),controlIds=new Set<string>();
  const event=(seq:number)=>{check(Number.isSafeInteger(seq) && seq>=0 && seq<combat.nextEventSeq! && !eventIds.has(seq),'receipt event');eventIds.add(seq);};
  for(const d of receipts?.deaths ?? []) {
    check(trusted.some(n=>n.id===d.unitId) && !combat.units.find(u=>u.id===d.unitId)!.alive && !deathIds.has(d.unitId)
      && Number.isSafeInteger(d.tick) && d.tick>=1 && d.tick<=tick,'death fact');
    deathIds.add(d.unitId);event(d.eventSeq);
  }
  check(trusted.every(n=>combat.units.find(u=>u.id===n.id)!.alive || deathIds.has(n.id)),'lost death fact');
  check(same(combat.openingDefinitions, trusted.length ? openings : undefined), 'opening declarations');
  if (openings.length && tick>0) {
    // Current catalog has no initial stun/untargetability; glass-cannon is the sole starting HP adjustment.
    const initial = preparation.units.filter(u=>u.location.kind==='board').map(u=>{
      const r=strategy.units.find(r=>r.unitId===u.id)!;
      return {id:u.id,team:u.team,cell:u.location.kind==='board'?u.location.cell:{col:0,row:0},
        hp:Math.floor(r.stats.health*(r.mechanics?.find(m=>m.mechanic==='glassCannon')?.values.startingHealthBps ?? 10000)/10000),
        maxHp:r.stats.health,alive:true,untargetable:false,controlled:false};
    });
    const planned=planOpening(combatId,combat.board,initial,openings);
    check(same(combat.openingState,{...planned,committed:true,plans:planned.plans.map(p=>({...p,task:p.task?{...p.task,status:'executed'}:null}))}), 'opening plan/consumption');
  } else check(combat.openingState===undefined, 'unexpected opening state');
  if (companionDefs.length && tick>0) {
    const state=combat.companionState, expected=freezeCompanions(combatId,trusted,companionDefs);
    check(state && state.combatId===combatId && same(state.bindings,expected.bindings) && Array.isArray(state.reactions), 'companion binding');
    const seen=new Set<string>();
    for (const r of state.reactions) {
      const b=expected.bindings.find(b=>canonicalSource(b.source)===canonicalSource(r.source));
      const owner=combat.units.find(u=>u.id===r.targetId),dead=combat.units.find(u=>u.id===r.deadUnitId);
      check(b && owner && dead && !dead.alive && b.members.includes(r.deadUnitId) && r.targetId===b.source.ownerId
        && Number.isSafeInteger(r.registeredAtTick) && r.registeredAtTick>=1 && r.registeredAtTick<=tick
        && r.executeAtTick===r.registeredAtTick+1 && same(r.effects,b.effects)
        && r.key===JSON.stringify([combatId,r.targetId,canonicalSource(b.source),r.deadUnitId]) && !seen.has(r.key), 'companion binding');
      const death=receipts!.deaths.find(d=>d.unitId===r.deadUnitId);
      check(death && death.tick===r.registeredAtTick && r.deathEventId===JSON.stringify([combatId,death.tick,death.eventSeq]), 'death event identity');
      seen.add(r.key);
      check(state.reactions.filter(x=>canonicalSource(x.source)===canonicalSource(r.source)).length<=b.maxReactions, 'reaction limit');
      check(r.status==='pending' ? r.executeAtTick===tick+1 && owner.alive && combat.status==='running'
        : r.status==='executed' ? r.executeAtTick<=tick
        : r.status==='cancelled' && (!owner.alive || combat.status==='finished'), 'companion lifecycle');
    }
    // The surviving holder necessarily observed each dead member. No pending/death receipt can be removed to replay it.
    for(const b of expected.bindings) if(combat.units.find(u=>u.id===b.source.ownerId)!.alive)
      for(const id of b.members) if(!combat.units.find(u=>u.id===id)!.alive)
        check(state.reactions.some(r=>r.targetId===b.source.ownerId && r.deadUnitId===id), 'lost death consumption');
  } else check(combat.companionState===undefined, 'unexpected companion state');
  for(const receipt of receipts?.controls ?? []) {
    check(!controlIds.has(receipt.key),'duplicate control receipt');controlIds.add(receipt.key);event(receipt.appliedEventSeq);
    const tuple=JSON.parse(receipt.key),task=combat.openingState?.plans.find(p=>p.source.ownerId===tuple[1])?.task;
    check(tick>=1 && task?.status==='executed' && task.targetIds.includes(receipt.targetId)
      && receipt.key===effectIdentity(combatId,{...task.source,effectIndex:1},receipt.targetId,JSON.stringify([openingSeq,1])).key,'control binding');
    const status=task.effects[1];
    check(status?.kind==='apply-status' && status.status.kind==='stun' && status.status.duration.kind==='ticks', 'control duration');
    const startsAtTick=task.executeAtTick+(status.status.activation==='next-tick'?1:0);
    const endsAtTick=startsAtTick+status.status.duration.ticks;
    const target=combat.units.find(u=>u.id===receipt.targetId)!;
    const active=target.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.key===receipt.key));
    if(receipt.removedAtTick===null) check(receipt.removedEventSeq===null && receipt.removedReason===null && active && target.alive && combat.status==='running' && tick<endsAtTick,'lost control');
    else {
      check(Number.isSafeInteger(receipt.removedAtTick) && receipt.removedAtTick>=1 && receipt.removedAtTick<=tick && !active
        && receipt.removedEventSeq!>receipt.appliedEventSeq,'control removal time');event(receipt.removedEventSeq!);
      const reason=receipt.removedReason;
      check(reason==='expired' ? receipt.removedAtTick===endsAtTick
        : reason==='death-cleanup' ? !target.alive
        : reason==='combat-end' ? combat.status==='finished' && receipt.removedAtTick===tick
        : reason==='cleansed' && declaredEffects(target,combatId).some(d=>d.effect.kind==='cleanse' && d.survivalSource
          && target.mechanismState!.runtimes.some(r=>r.key===effectIdentity(combatId,d.survivalSource!,target.id).key && r.consumed && r.startsAtTick===receipt.removedAtTick)), 'control removal reason');
    }
  }
  // In the signed current catalog the only pre-charge immunity is an initial item effect.
  // A still-living nonimmune path target necessarily survived its charge packet, so its receipt cannot vanish.
  for(const plan of combat.openingState?.plans ?? []) for(const id of plan.task?.targetIds ?? []) {
    const target=combat.units.find(u=>u.id===id)!,r=strategy.units.find(u=>u.unitId===id)!;
    const immune=(r.itemPrograms ?? []).some(p=>p.program.effects?.some(e=>e.kind==='apply-status' && e.status.kind==='control-immunity'));
    if(target.alive && !immune) check(receipts!.controls.some(c=>c.targetId===id),'lost applied control receipt');
  }
  for(const u of combat.units) for(const c of u.mechanismState?.statuses.flatMap(g=>g.contributions) ?? []) {
    if(!trusted.some(n=>n.id===c.source.ownerId)) continue;
    const owner=trusted.find(n=>n.id===c.source.ownerId)!;
    let app:StatusApplication|undefined,at=0,applicationId:string|undefined;
    const reaction=combat.companionState?.reactions.find(r=>r.status==='executed' && r.targetId===u.id
      && canonicalSource(r.source)===canonicalSource(c.source) && effectIdentity(combatId,r.source,u.id,r.deadUnitId).key===c.key);
    const effect=reaction?.effects[0];
    if(reaction && effect?.kind==='modify-stat') {
      app={kind:'stat-buff',magnitudeBps:0,duration:effect.duration,stackPolicy:{kind:'independent-instances'},activation:'immediate',
        polarity:'beneficial',removable:false,modifier:effect.modifier,damageFilter:null,onEnd:null};
      at=reaction.executeAtTick;applicationId=reaction.deadUnitId;
    } else {
      const definition=openings.find(d=>d.source.ownerId===owner.id);
      const task=combat.openingState?.plans.find(p=>p.source.ownerId===owner.id)?.task;
      const status=definition?.kind==='path-charge'?definition.effects[1]:undefined;
      check(task?.status==='executed' && task.targetIds.includes(u.id) && status?.kind==='apply-status'
        && same(c.source,{...definition!.source,effectIndex:1}), 'control binding');
      app=status.status;at=task.executeAtTick+(app.activation==='next-tick'?1:0);check(controlIds.has(c.key),'missing control receipt');
      const tuple=JSON.parse(c.key),action=JSON.parse(tuple[8]);
      check(Array.isArray(action) && action.length===2 && action[0]===openingSeq && action[1]===1, 'control action identity');
      applicationId=tuple[8];
    }
    check(same(c.application,app) && c.appliedAtTick===at && c.expiresAtTick===(app.duration.kind==='combat'?null:at+app.duration.ticks)
      && c.key===effectIdentity(combatId,c.source,u.id,applicationId).key && !c.endRewardConsumed, 'status declaration');
    neutralKeys.add(c.key);
  }
  for(const r of combat.companionState?.reactions ?? []) if(r.status==='executed' && r.effects[0]?.kind==='modify-stat'
    && combat.status==='running' && combat.units.find(u=>u.id===r.targetId)!.alive)
    check(neutralKeys.has(effectIdentity(combatId,r.source,r.targetId,r.deadUnitId).key), 'lost companion buff');
  return neutralKeys;
}
