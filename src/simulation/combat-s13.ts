import { settleH11Deaths } from './augment-pool-batch5-h11';
import { tracksCabalTakedowns, sampleCabalTakedowns } from './augment-pool-batch5-h9-cabal';
import { startR2PortableCopies } from './augment-pool-batch5-r2-combat';
import { advanceMadChemist, isMadChemist, leaveMadChemistCloud, madChemistMoveInterval, moveMadChemist } from './augment-pool-batch5-r4';
import { summonRebelCopies } from './augment-pool-batch5-g2-rebel';
import { settleGhostFriendsDeaths, observeBatch5RevivalDeaths } from './augment-pool-batch5-g2-combat';
import { recordAerialMovement } from './augment-pool-batch5-g3-combat';
import { castB5Voidcaller, spawnB5Voidlings, type B5VoidlingBirth } from './augment-pool-batch5-g4';
import { sampleAugmentDeath } from './augment-death-samples';
import { lootExplosionKillSample } from './augment-pool-batch5-g7-combat';
import { batch2Attack, batch2Incoming, batch2Kill, batch2Mechanic, batch2ExecuteReward, batch2Bonus, batch2Tick, batch2Cast } from './augment-pool-batch2-combat';
import { batch2Values } from './content/augment-pool-batch2';
import { isOpeningCrab, crabMove, crabJump } from './combat-opening-crabs';
import { overtimeBonusBps, movementIntervalTicks, quickstrikerMoveTenths } from './combat-overtime';
import { castV20Teamups, quickDashV20, advanceV20Minions } from './combat-v20-traits';
import { canMove, isControlled, planMeleeApproach, type MeleeApproachClaim } from './combat-movement';
import { settleAmbessaRetreats } from './combat-ambessa-dash';
import { settleFamilyReunionDeaths } from './combat-family-reunion';
import { advanceSixCost, settleSixCostDeaths, recordMelAbsorption, convertViktorMana } from './combat-six-cost';
import { p2Bonus, p2Stoneskin, p2PacketCrit } from './s13-augments-p2-combat';
import { chaseStep, decideCombatTarget, type CombatTargetDecision } from './combat-targeting';
import { v19DominatorCast, smokeV19, sistersV19, roseAmpV19, chainblade, chainbladeGoldTarget, chainbladeKill } from './combat-v19';
import { V19_MECHANICS } from './content/v19-mechanics';
import { d11AvariceDamageAmpBps, d11HeadhunterAttackSpeedBps } from './d11-fill';
import { UNIT_DEFINITIONS } from './units';
import { advanceP3, p3Attack, p3Cast, p3Roll, p3BurnRaw, p3Reflect, p3Damage, p3Mechanic, settleP3Deaths } from './s13-p3-combat';
import { p3Values } from './s13-p3-programs';
import {splitTrenchHolders} from './combat-g2-4b-trench';
import {splitExperimentClones} from './combat-experiment-clone';
import { hallOfMirrorsDamage, hallOfMirrorsExecution } from './augment-pool-batch5-r3-mirrors';
import { castAnomaly, tickAnomalies, takedownAnomalies, deathAnomalies, attackAnomaly } from './anomalies/runtime';
import { isAttackProxy, scheduleAnomalyAttacks, removeBoundAnomalySummons, recordAnomalyProxyHit } from './anomalies/summons';
import { isAbsent, occupiesCell } from './anomalies/availability';
import {advanceG23Junker,g23RumbleDeath} from './combat-g2-3-junker';
import {chooseFishbonesTarget, advanceDeferredItemDamage} from './g2-4b-item-kernel';
import {recordItemGold,type ItemGoldKind} from './g2-4b-item-gold';
import {scaleItemSummonHp} from './g2-4b-summons';
import {advanceSpectralCutlass,returnZephyrUnits} from './combat-g2-4b';
import { advanceG23Skills,recordG23SkillDamage,extendG23Swain } from './combat-g2-3';
import { advanceG23Summons,deathG23Sion,g23Bound } from './combat-g2-3-summons';
import { advanceG23Anomalies,recordG23Conquest,settleG23ExperimentKills,recordG23Attack,recordG23Damage,g23Anomaly } from './g2-3-combat';
import { openingB4Combat, castB4Combat, attackB4Combat, damageB4Combat } from './augment-pool-batch4-b4combat';
import { advanceAugmentCombat, settleAugmentDeaths } from './combat-augment-effects';
import { advanceG22Traits, recordG22Damage, shareStebHeal } from './combat-g2-2';
import { advanceG2Passives, recordG2Damage } from './combat-g2';
import { copyCombatUnitForTick } from './combat-static';
import { startingRows } from './m8/targeting';
import { planOpening, commitOpening, advanceOpeningTasks } from './m8/opening';
import { targetUnit } from './m8/s13-targeting';
import { damageTypeForTarget } from './m8/planning';
import { EMPTY_FACTS } from './m8/triggers';
import { emitMechanismSignal, hasMechanismSubscriber } from './m8/s13-triggers';
import { freezeCompanions, registerDeaths, advanceReactions } from './m8/companions';
import { executeDamageControlSequence, executeMechanismEffect } from './m8/s13-mechanisms';
import { completeCast, damageMana, planManaCost, refundCast, resolveMana } from './m8/mana';
import { S13_COMBAT_RULES } from './s13-rules';
import { getNeighbors, hexDistance, type HexCell } from './board';
import { compareIds, eliminationResult, type CombatState, type CombatStep, type CombatEvent, type CombatOrigin } from './combat-types';
import { invocationEvent, stampCombatStep } from './combat-effects';
import { collectTriggers } from './effects';
import type { Hook } from './strategy-types';
import { nextRandom } from './rng';
import { executeTask, planS13Attack, planS13Cast, type AbilityContext, type S13Packet } from './combat-s13-abilities';
import { active, ad, ap, byDistance, champion, compareText, EMPTY_RUNTIME, enemies, grantShield, hasMechanic, heroLive, interval,
  mechanic, range, syncShield, variable, origin, hpSample, statusModifiers, frozenShield, shieldProjection, constantModifier, spellCrit, type S13Unit } from './combat-s13-state';
import { allocateDamage, permissionsFor, prepareDamage, type DamageSample } from './m8/damage';
import { rollCrit } from './m8/crit';
import { resolveStat, safeNumber } from './m8/stats';
import type { Amount, DamageContext, DamageRequest, DamageOutcome, StatModifier } from './m8/contracts';

import { initializeMechanisms, maintainMechanisms, maintainActivities, settleSurvival, settleShieldEnds, vampRates, commitMechanismHeal, cleanupMechanisms, clearPeriodicAccount, refreshMechanismAuras } from './m8/s13-mechanisms';
import { effectiveStatuses, isEffective, statusMagnitude } from './m8/status';
import { recordShieldAbsorption } from './m8/shield';
import { vampRequests } from './m8/heal';
import { evaluateAmount } from './m8/stats';
import { canonicalSource } from './m8/identity';
import { asSource } from './m8/s13-definitions';

function key(cell: HexCell): string { return `${cell.col}:${cell.row}`; }
function move(state: CombatState, unit: S13Unit, target: S13Unit, occupied: ReadonlySet<string>): HexCell | undefined {
  let attackRange: number | undefined;
  const seen = new Set([key(unit.cell)]), queue: { cell: HexCell; first?: HexCell }[] = [{ cell: unit.cell }];
  for (let i = 0; i < queue.length; i++) for (const cell of getNeighbors(state.board, queue[i].cell)) {
    if (seen.has(key(cell)) || occupied.has(key(cell))) continue;
    seen.add(key(cell)); const first = queue[i].first ?? cell;
    if (hexDistance(cell, target.cell) <= (attackRange ??= range(unit))) return first;
    queue.push({ cell, first });
  }
  return undefined;
}
function defenses(unit: S13Unit, physical: boolean, tick: number, units: CombatState['units'], ignoreShredSunder = false): number {
  const stat = physical ? 'armor' : 'magicResist';
  const modifiers: StatModifier[] = [...statusModifiers(unit, stat, tick), ...active(unit, tick, 'resistanceFlat').filter(s => !s.contributionKeys && (physical || !s.key.includes(':armor:'))).map(s => constantModifier(stat, s.amount))];
  const openingDefense=p2Bonus(unit,stat)+p2Stoneskin(unit,tick)+batch2Bonus(unit,'resist');if(openingDefense)modifiers.push(constantModifier(stat,openingDefense));
  if(unit.itemMogulHits?.length)modifiers.push(constantModifier(stat,unit.itemMogulHits.length*mechanic(unit,'g24Mogul','resistPerStack')));
  for (const m of unit.mechanics ?? []) if (m.mechanic === 'gargoyle') modifiers.push({ ...constantModifier(stat, 0),
    value: { kind: 'unit-count', perUnit: m.values.resistPerEnemy, population: 'alive-enemies-targeting-holder', sample: 'current', distinctBy: 'unitId' } });
  const shred = Math.max(statusMagnitude(unit.mechanismState?.statuses ?? [], physical ? 'sunder' : 'shred', tick), ...(physical ? active(unit, tick, 'armorReduction').filter(s => !s.contributionKeys).map(s => s.amount) : [0]));
  if (!ignoreShredSunder) modifiers.push(constantModifier(stat, -shred, 'bps'));
  const resolved = resolveStat(stat, physical ? unit.armor : unit.magicResist, modifiers, { holder: hpSample(unit), startingRows: startingRows(unit.team,unit.startingCell?.row ?? unit.cell.row) ?? undefined,
    enemiesTargetingHolder: units.filter(u => u.alive && u.team !== unit.team && u.targetId === unit.id).map(u => u.id) });
  return Math.floor(resolved*(g23Anomaly(unit,'defense-expert')?16600:10000)/10000);
}
/** Authoritative read projection for renderers; it neither consumes RNG nor advances any counter. */
export function readCombatStats(unit: CombatState['units'][number], state: Pick<CombatState,'units'|'tick'>): {
  attackDamage: number; abilityPower: number; attackIntervalTicks: number; attackRange: number; armor: number; magicResist: number;
} {
  const working = (u: CombatState['units'][number]): S13Unit => ({ ...u, runtime: { ...EMPTY_RUNTIME, ...u.runtime },
    statuses: [...u.statuses ?? []], tasks: [...u.tasks ?? []], shieldLayers: [...u.shieldLayers ?? []] });
  // defenses only reads identity/alive/target fields of other units.
  // It needs no detached runtime for those read-only samples.
  const current = working(unit), units = state.units;
  return { attackDamage: ad(current), abilityPower: ap(current, state.tick, state.units), attackIntervalTicks: interval(current, state.tick, state.units),
    attackRange: range(current), armor: defenses(current, true, state.tick, units), magicResist: defenses(current, false, state.tick, units) };
}
function damageRequest(packet: S13Packet, combatId: string, tick: number): DamageRequest {
  const partial: DamageContext = { source: asSource(packet.source), targetId: packet.targetId,
    damageType: packet.damageType, delivery: packet.delivery, actionSeq: packet.actionSeq, rootActionSeq: packet.rootActionSeq ?? packet.actionSeq,
    parentPacketId: packet.inherited?.parentPacketId ?? packet.parentPacketId ?? null, triggeringCastActionSeq: packet.triggeringCastActionSeq,
    packetId: JSON.stringify([combatId, tick, packet.source.ownerId, packet.actionSeq, packet.targetId, packet.ordinal]),
    packetOrdinal: packet.ordinal, equipmentDepth: packet.delivery === 'equipment-proc' || packet.delivery === 'item-burn' ? 1 : 0,
    redirected: false, area: packet.area, critEligibility: packet.critEligibility, permissions: [] };
  const context = { ...partial, permissions: permissionsFor(partial) };
  return { context, input: packet.inherited ? { stage: 'after-mitigation', amount: packet.raw, inherited: packet.inherited } :
    { stage: 'raw', amount: { flat: packet.raw, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 0, missingHpBps: 0,
      actualManaSpentBps: 0, actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'holder', sample: 'packet', cap: null } } };
}
/** G2-4b Prowler's Claw: a charged consume-counter gate adds crit damage to critical basic attacks until spent. */
function chargedCritBps(owner: S13Unit, packet: S13Packet): number {
  if (!packet.critical || packet.delivery !== 'basic-attack') return 0;
  let bonus = 0;
  for (const d of owner.mechanismDefinitions?.eventTriggers ?? []) if (d.gate.kind === 'consume-counter' && d.gate.critDamageBps) {
    const runtime = owner.triggerLedger?.runtimes.find(r => canonicalSource(r.source) === canonicalSource(d.source));
    if ((runtime?.counters[d.gate.counterId] ?? 0) > 0) bonus += d.gate.critDamageBps;
  }
  return bonus;
}
function damageSample(packet: S13Packet, target: S13Unit, owner: S13Unit | undefined, tick: number, units: readonly S13Unit[], hp: number): DamageSample {
  const amplifiers: StatModifier[] = [constantModifier('damageAmp', overtimeBonusBps(tick), 'bps'), ...(owner ? statusModifiers(owner, 'damageAmp', tick) : [])];
  if(owner?.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate'))
    amplifiers.push(constantModifier('damageAmp',d11AvariceDamageAmpBps(owner.currentItemBankGold!),'bps'));
  if (target.g22 && target.g22.exposureFromTick <= tick && target.g22.exposureUntilTick > tick) amplifiers.push(constantModifier('damageAmp', target.g22.exposureBps, 'bps'));
  if(owner&&g23Anomaly(owner,'bully')&&(target.effectiveStarLevel??target.starLevel)<(owner.effectiveStarLevel??owner.starLevel))amplifiers.push(constantModifier('damageAmp',2400,'bps'));
  if (owner) for (const m of owner.mechanics ?? []) {
    if (m.mechanic === 'damageAmp') amplifiers.push(constantModifier('damageAmp', m.values.bps, 'bps'));
    if (m.mechanic === 'heroCarryLive' && m.values.ampBps && owner.batch2?.vladCasts) amplifiers.push(constantModifier('damageAmp', m.values.ampBps * owner.batch2.vladCasts, 'bps'));
    if (m.mechanic === 'sniper') amplifiers.push(constantModifier('damageAmp', m.values.damageBpsPerHex * hexDistance(owner.cell, target.cell), 'bps'));
    if (m.mechanic === 'glassCannon') amplifiers.push(constantModifier('damageAmp', m.values.damageAmpBps, 'bps'));
    if (m.mechanic === 'formSwapper' && startingRows(owner.team, owner.startingCell?.row ?? owner.cell.row)==='back-two') amplifiers.push(constantModifier('damageAmp',m.values.backAmpBps,'bps'));
  }
  // G2-4b Sniper's Focus: the same per-hex reading as the Sniper trait, sampled at resolution.
  if (owner) for (const m of statusModifiers(owner, 'damageAmpPerHex', tick)) if (m.value.kind === 'constant')
    amplifiers.push(constantModifier('damageAmp', m.value.amount * hexDistance(owner.cell, target.cell), 'bps'));
  const reduction = (bps: number): StatModifier => ({ ...constantModifier('damageReduction', bps, 'bps'),
    damageFilter: { deliveries: 'all', damageTypes: ['physical', 'magic'], redirected: 'exclude' } });
  const reductions = [...(mechanic(target, 'family', 'damageReductionBps') ? [reduction(mechanic(target, 'family', 'damageReductionBps'))] : []), ...statusModifiers(target, 'damageReduction', tick), ...active(target, tick, 'damageReduction').filter(s => !s.contributionKeys).map(s => reduction(s.amount)), ...(target.mechanismState?.statuses ?? []).filter(g => g.kind === 'damage-reduction').flatMap(g => g.contributions.filter(c => isEffective(c, tick)).map(c => ({ ...constantModifier('damageReduction', c.application.magnitudeBps, 'bps'), damageFilter: c.application.damageFilter! })))];
  if (target.shieldLayers.some(s => s.remaining > 0 && s.expiresAtTick > tick) && p3Mechanic(target, 'defense-call')) reductions.push(reduction(Math.round(p3Values('defense-call').ReducedDamage * 10000)));
  if(startingRows(target.team,target.startingCell?.row??target.cell.row)==='front-two')for(const m of target.mechanics??[])if(m.mechanic==='formSwapper')reductions.push(reduction(m.values.frontReductionBps));
  for (const m of target.mechanics ?? []) if (m.mechanic === 'watcher') reductions.push(reduction(
    BigInt(target.hp) * 10000n > BigInt(target.maxHp) * BigInt(m.values.thresholdBps) ? m.values.healthyReductionBps : m.values.reductionBps));
  return { holder: hpSample(owner ?? target), target: { ...hpSample(target), hp }, attackDamage: owner ? ad(owner) : 0,
    abilityPower: owner ? ap(owner, tick) : 0, armor: defenses(target, true, tick, units), magicResist: defenses(target, false, tick, units),
    ...(champion(target) === 'amumu' ? { flatReduction: variable(target, 'FlatDamageReduction') } : {}),
    amplifiers, reductions, prevention: effectiveStatuses(target.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'damage-prevention'), ...(packet.delivery === 'item-burn' && champion(target) === 'neutral' ? { burnCap: 100 } : {}), critical: (packet.critical ?? false) && !(owner && hasMechanic(owner, 'badLuck')),
    critMultiplierBps: owner ? (packet.critMultiplierBps ?? p2PacketCrit(owner, target.id, units, spellCrit(owner)).multiplierBps) + chargedCritBps(owner, packet) : S13_COMBAT_RULES.critMultiplierBps,
    shields: [...target.shieldLayers].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareText(frozenShield(a, target).key, frozenShield(b, target).key)) };
}
/** Validate the authorization even on idle units; only packet work is empty. */
function rollPlannedPackets(ctx: AbilityContext, unit: S13Unit, firstPacket: number,
  p3ChargedAttacks: ReadonlySet<number>, guaranteedAttackSeq: number | undefined): void {
  const units = ctx.units;
  const authorization = spellCrit(unit);
  if (firstPacket === ctx.packets.length) return;
  const planned = ctx.packets.slice(firstPacket).sort((a, b) => a.actionSeq - b.actionSeq || compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal);
  const piercingCrit = new Map<number, boolean>();
  for (const packet of planned) {
    const piercing = champion(unit) === 'twitch' && packet.delivery === 'basic-attack';
    const shared = piercing ? piercingCrit.get(packet.actionSeq) : undefined;
    packet.critical = p3ChargedAttacks.has(packet.actionSeq) && packet.delivery === 'basic-attack' ? p3Roll(ctx, unit, packet, true, shared) : shared ?? (packet.inherited ? packet.inherited.critical : rollCrit(packet.critEligibility, p2PacketCrit(packet.source.ownerId===unit.id?unit:units.find(u=>u.id===packet.source.ownerId),packet.targetId,units,packet.source.ownerId === unit.id ? authorization : spellCrit(units.find(u => u.id === packet.source.ownerId)!)), ctx.draw));
    if(packet.actionSeq===guaranteedAttackSeq&&packet.critEligibility==='basic')packet.critical=true;
    if (piercing) piercingCrit.set(packet.actionSeq, packet.critical);
  }
}

/** S13 development resolver; standalone M3/M4 battles keep their original rules. */
export function advanceS13Tick(state: CombatState): CombatStep {
  const tick = state.tick + 1, events: CombatEvent[] = [];
  const lootExplosionKills = new Map<string, NonNullable<ReturnType<typeof lootExplosionKillSample>>>();
  const units: S13Unit[] = state.units.map(unit => {
    const copy = copyCombatUnitForTick(unit) as S13Unit;
    copy.startingCell = unit.startingCell ?? { ...unit.cell };
    copy.runtime = { ...EMPTY_RUNTIME, ...copy.runtime };
    copy.statuses = copy.statuses ?? [];
    copy.shieldLayers = copy.shieldLayers ?? [];
    copy.tasks = copy.tasks ?? [];
    copy.cooldownTicks = unit.alive ? Math.max(0, unit.cooldownTicks - 1) : 0;
    copy.moveCooldownTicks = unit.alive ? Math.max(0, unit.moveCooldownTicks - 1) : 0;
    return copy;
  }).sort(compareIds);
  const hasBanish=units.some(u=>u.itemBanish || u.anomalyState?.absentUntilTick !== undefined || u.g23Sion);
  const fullRoster=hasBanish?[...units]:units;
  const suspendBanished=()=>{for(let i=units.length-1;i>=0;i--)if(isAbsent(units[i],tick))units.splice(i,1);};
  if(hasBanish&&state.tick>0)suspendBanished();
  let rngState = state.rngState ?? 0, rngDraws = state.rngDraws ?? 0, actionSeq = state.nextActionSeq ?? 0;
  const voidcaller = state.voidcaller?.map(c=>({...c})) ?? [], voidlings: B5VoidlingBirth[] = [];
  let itemRandomStreams = state.itemRandomStreams;
  let itemGoldReceipts=state.itemGoldReceipts;
  const ctx: AbilityContext = { manaRequests: [], castReceipts: [], resolutionFacts: EMPTY_FACTS, nextTriggerEventSeq: state.nextTriggerEventSeq ?? 0, tick, combatId: state.combatId ?? 'standalone', board: state.board, units, events, packets: [], heals: [], draw: () => {
    const next = nextRandom(rngState); rngState = next.state; rngDraws++; return next.word;
  } };
  const awardItemGold=(owner:S13Unit,item:NonNullable<S13Unit['mechanics']>[number],kind:ItemGoldKind,ordinal:number)=>{
    if(!itemRandomStreams||!itemGoldReceipts)throw new RangeError('Missing item gold state');
    const next=recordItemGold({streams:itemRandomStreams,receipts:itemGoldReceipts},{battleId:ctx.combatId!,ownerId:owner.id,
      itemInstanceId:item.source.instanceId,kind,tick,ordinal});
    itemRandomStreams=next.streams;itemGoldReceipts=next.receipts;
    if(next.receipts.at(-1)!.gold)for(const holder of fullRoster){
      if(holder.openingItemBankGold===undefined||holder.team!==owner.team)continue;
      const limit=mechanic(holder,'g24Gambler','goldLimit');
      holder.currentItemBankGold=holder.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate')
        ?holder.currentItemBankGold!+next.receipts.at(-1)!.gold:Math.min(limit,holder.currentItemBankGold!+next.receipts.at(-1)!.gold);
    }
  };
  if(hasBanish)returnZephyrUnits(ctx);
  ctx.defenses = (unit, armor, ignoreShredSunder) => defenses(unit, armor, ctx.tick, units, ignoreShredSunder);
  if(hasBanish){
    const activeUnits=ctx.units;ctx.units=fullRoster;
    tickAnomalies(ctx,()=>actionSeq++,true);ctx.units=activeUnits;
    if(state.tick>0)suspendBanished();
  }
  const installedSources = new Set(units.flatMap(u => u.pendingEquipmentSources ?? []));
  startR2PortableCopies({...ctx,anomalySeed:state.rngState});
  initializeMechanisms(ctx);
  if (state.tick > 0 && installedSources.size) for (const unit of units) emitMechanismSignal(ctx,
    { event: 'combat-start', tick, actionSeq: 0, actorId: unit.id, targetId: unit.id, cast: null }, EMPTY_FACTS, 'event', installedSources);
  if (state.tick === 0) {
    // Initial programs finish at tick 0 before opening occupancy/eligibility freezes.
    ctx.tick = 0;
    for (const unit of fullRoster) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: 0 };
    // Initialize every item's static state above, but an absent unit neither emits
    // combat-start actions nor belongs to another opening action's target pool.
    if(hasBanish)suspendBanished();
    for (const unit of units) emitMechanismSignal(ctx, { event: 'combat-start', tick: 0, actionSeq: 0, actorId: unit.id, targetId: unit.id, cast: null });
    advanceSpectralCutlass(ctx);
    ctx.tick = tick;
    for (const unit of fullRoster) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: tick };
  }
  let openingState = state.openingState;
  const openingUnits = (atTick = tick) => units.map(u => ({ ...targetUnit(u, atTick), controlled: active(u, atTick, 'stun').length > 0 || effectiveStatuses(u.mechanismState!.statuses, atTick).some(g => g.kind === 'stun') }));
  if (state.openingDefinitions?.length && !openingState) {
    if (state.tick !== 0) throw new RangeError('Missing consumed opening state');
    openingState = planOpening(ctx.combatId!, ctx.board, openingUnits(state.tick),
      hasBanish?state.openingDefinitions.filter(d=>units.some(u=>u.id===d.source.ownerId)):state.openingDefinitions);
  }
  if (openingState && !openingState.committed) {
    const committed = commitOpening(openingState, units); openingState = committed.state;
    for (const u of units) u.cell = committed.units.find(next => next.id === u.id)!.cell;
    events.push(...committed.movements);
    for (const movement of committed.movements) recordAerialMovement({ ...ctx, tick: 0 }, units.find(u => u.id === movement.unitId)!, movement.to, movement.from);
  }
  const companionDefinitions = fullRoster.flatMap(u => u.companionDefinitions ?? []);
  let companionState = state.companionState ?? (companionDefinitions.length ? freezeCompanions(ctx.combatId!, fullRoster.filter(u => u.alive), companionDefinitions) : undefined);
  if (companionState) {
    const reactions = advanceReactions(companionState, tick, units.filter(u => u.alive && u.hp > 0).map(u => u.id), false); companionState = reactions.state;
    for (const reaction of reactions.ready) {
      const holder = units.find(u => u.id === reaction.targetId)!;
      for (const [index, effect] of reaction.effects.entries()) {
        const source = { ...reaction.source, effectIndex: reaction.source.effectIndex + index };
        if (effect.kind === 'heal') ctx.heals.push({ source, targetId: holder.id, amount: 0, lateAmount: effect.amount, reactionKey: reaction.key });
        else executeMechanismEffect(ctx, holder, source, holder, { ...effect, activation: 'immediate', stackPolicy: { kind: 'independent-instances' } }, actionSeq++, index, undefined, undefined, undefined, undefined, { area: false, triggeringCastActionSeq: null, applicationId: reaction.deadUnitId });
      }
    }
  }
  const startHp = new Map(units.map(u => [u.id, u.hp]));
  const spent = new Map<string, number>(), attackMana = new Map<string, number>(), killMana = new Map<string, number>();
  const hasD11Bank=fullRoster.some(u=>u.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate'));
  const highRollerBefore=new Map(hasD11Bank?fullRoster.map(u=>[u.id,(u.g23?.highRoller??[]).reduce((n,r)=>n+r.gold,0)]):[]);
  const hookMana = new Map<string, number>();
  const hooks = (unit: S13Unit, hook: Hook, seq: number) => {
    const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], hook, unit.id, unit.targetId);
    unit.effectRuntime = batch.runtime;
    batch.invocations.forEach((invocation, index) => {
      events.push(invocationEvent(invocation, tick));
      const original = invocation.trigger.source;
      const source: CombatOrigin = { ownerId: original.ownerId, sourceKind: original.sourceKind, definitionId: original.sourceDefinitionId,
        instanceId: original.sourceInstanceId, effectIndex: original.effectIndex, ...(original.parentItemInstanceId ? { parentItemInstanceId: original.parentItemInstanceId } : {}) };
      const target = units.find(u => u.id === invocation.targetId);
      if (invocation.action.kind === 'gainMana') hookMana.set(unit.id, (hookMana.get(unit.id) ?? 0) + invocation.action.amount);
      else if (target && invocation.action.kind === 'grantShield') grantShield(target, source, invocation.action.amount, tick + invocation.action.durationTicks, tick, events);
      else if (target && invocation.action.kind === 'dealDamage') ctx.packets.push({ source, targetId: target.id, raw: invocation.action.amount,
        damageType: invocation.action.damageType, actionSeq: seq, ordinal: 100000 + index,
        delivery: source.sourceKind === 'item' ? 'equipment-proc' : 'attack-extra', critEligibility: 'never', area: false,
        triggeringCastActionSeq: invocation.trigger.hook === 'onCast' ? seq : null });
    });
  };
  maintainMechanisms(ctx, () => actionSeq++);
  tickAnomalies(ctx,()=>actionSeq++);
  for(const unit of units){
    if(!unit.itemMogulHits)continue;
    const mogul=unit.mechanics?.find(m=>m.mechanic==='g24Mogul');
    if(!mogul||!unit.alive||unit.hp<=0||unit.itemMogulHits?.length!==mogul.values.stackCap)continue;
    const elapsed=tick-unit.itemMogulHits.at(-1)!.tick;
    if(elapsed>0&&elapsed%mogul.values.goldIntervalTicks===0)awardItemGold(unit,mogul,'moguls-periodic',elapsed/mogul.values.goldIntervalTicks-1);
  }
  advanceSpectralCutlass(ctx);
  openingB4Combat(ctx);
  advanceAugmentCombat(ctx);
  smokeV19(ctx);
  advanceG22Traits(ctx); advanceG23Anomalies(ctx); advanceG23Summons(ctx,()=>actionSeq++); advanceG23Skills(ctx); advanceG23Junker(ctx,()=>actionSeq++);
  const blocked = new Set<string>();
  for (const unit of units) {
    // B9 replay2: every S13 status is anchored by frozen contributions or an activity.
    if (unit.statuses.some(s => !s.contributionKeys && !s.activity)) throw new RangeError('S13 status without a frozen contribution or activity');
    unit.statuses = unit.statuses.filter(s => s.activity || s.expiresAtTick > tick);
    const controlled = isControlled(unit, tick);
    maintainActivities(ctx, unit, controlled);
    if (controlled && !unit.sixCost?.permanentFrenzy) { blocked.add(unit.id); unit.tasks = unit.tasks.filter(t => !t.cancellable); }
  }
  advanceG2Passives(ctx, () => actionSeq++);
  advanceV20Minions(ctx);
  for(const unit of units)quickDashV20(ctx,unit);
  for(const unit of units)if(unit.mechanics?.some(m=>m.mechanic==='quickstriker')&&unit.alive){
    unit.v20Traits={...unit.v20Traits,moveTenths:Math.min(13,(unit.v20Traits?.moveTenths??7)+quickstrikerMoveTenths(tick))};
  }
  const occupied = new Set(units.filter(u => occupiesCell(u, tick)).map(u => key(u.cell))), reserved = new Set<string>(), ordinaryMoved = new Set<string>();
  ctx.movementReservations = reserved;
  // Stun and knock-up freeze ordinary target choice. Permanent frenzy still
  // selects. The first tick after release is an ordinary decision again.
  const hardControlled = (unit: S13Unit) => isControlled(unit, tick) && !unit.sixCost?.permanentFrenzy;
  const targets = new Map<string, CombatTargetDecision>();
  // Dead units keep deterministic decisions without consuming the combat stream.
  for (const unit of units) if (!isAttackProxy(unit) && !isMadChemist(unit))
    targets.set(unit.id, decideCombatTarget(state.board, unit, units, tick, occupied, false, undefined, hardControlled(unit),
      unit.alive && unit.hp > 0 ? ctx.draw : undefined));
  const chemistPaths = new Map<string, readonly HexCell[]>();
  const intents = units.map(unit => {
    if (isMadChemist(unit) && unit.alive && unit.hp > 0) leaveMadChemistCloud(unit, [unit.cell], tick);
    if (!canMove(unit, tick)) return undefined;
    if (isMadChemist(unit)) {
      const path = moveMadChemist(ctx, unit, occupied);
      if (path) chemistPaths.set(unit.id, path);
      return path?.at(-1);
    }
    if(isOpeningCrab(unit))return crabMove(ctx,unit,occupied);
    if (unit.mechanics?.some(m=>m.mechanic==='quickstriker')?unit.moveCooldownTicks>5||(unit.v20Traits?.moveTenths??0)<10:unit.moveCooldownTicks>0) return undefined;
    const decision = targets.get(unit.id)!, target = decision.target;
    if (!target || hexDistance(unit.cell, target.cell) <= range(unit)) return undefined;
    // Range 1 claims an attack hex in the commit loop. Ranged units keep this BFS.
    if (!decision.engaged && range(unit) === 1) return undefined;
    return decision.engaged ? chaseStep(state.board, unit, target, occupied) : move(state, unit, target, occupied);
  });
  const moveReady = (unit: S13Unit) => canMove(unit, tick) && (unit.mechanics?.some(m => m.mechanic === 'quickstriker')
    ? unit.moveCooldownTicks <= 5 && (unit.v20Traits?.moveTenths ?? 0) >= 10 : unit.moveCooldownTicks <= 0);
  const goalOwner = new Map<string, string>();
  for (const unit of units) {
    const claim = unit.meleeApproach, target = targets.get(unit.id)?.target;
    if (!claim || !target || claim.targetId !== target.id) continue;
    if (!getNeighbors(state.board, target.cell).some(cell => cell.col === claim.cell.col && cell.row === claim.cell.row)) continue;
    if (!goalOwner.has(key(claim.cell))) goalOwner.set(key(claim.cell), unit.id);
  }
  const assignClaim = (unit: S13Unit, claim: MeleeApproachClaim | undefined) => {
    if (unit.meleeApproach && goalOwner.get(key(unit.meleeApproach.cell)) === unit.id) goalOwner.delete(key(unit.meleeApproach.cell));
    if (!claim) { delete unit.meleeApproach; return; }
    const cell = { col: claim.cell.col, row: claim.cell.row };
    unit.meleeApproach = { targetId: claim.targetId, cell };
    goalOwner.set(key(cell), unit.id);
  };
  units.forEach((unit, n) => {
    let destination = intents[n];
    const decision = targets.get(unit.id), target = decision?.target;
    const melee = !!target && range(unit) === 1 && !isMadChemist(unit) && !isOpeningCrab(unit) && !isAttackProxy(unit);
    if (melee && moveReady(unit) && !decision!.engaged && hexDistance(unit.cell, target.cell) > range(unit)) {
      const blockedGoals = new Set([...goalOwner].filter(([, id]) => id !== unit.id).map(([cell]) => cell));
      const plan = planMeleeApproach(state.board, unit, target, units, tick, occupied, reserved, blockedGoals, ctx.draw);
      assignClaim(unit, plan.claim);
      destination = plan.step;
    } else if (melee && hexDistance(unit.cell, target.cell) <= range(unit)) assignClaim(unit, { targetId: target.id, cell: unit.cell });
    else if (unit.meleeApproach && unit.meleeApproach.targetId !== (target?.id ?? null)) assignClaim(unit, undefined);
    if (!destination || reserved.has(key(destination))) return;
    reserved.add(key(destination)); ordinaryMoved.add(unit.id); events.push({ type: 'movement', tick, unitId: unit.id, from: unit.cell, to: destination }); recordAerialMovement(ctx, unit, destination);
    if(unit.mechanics?.some(m=>m.mechanic==='quickstriker'))unit.v20Traits={...unit.v20Traits,moveTenths:unit.v20Traits!.moveTenths!-10};
    if (isMadChemist(unit)) leaveMadChemistCloud(unit, chemistPaths.get(unit.id)!, tick);
    unit.cell = destination; unit.moveCooldownTicks = isMadChemist(unit) ? madChemistMoveInterval(unit, tick) : movementIntervalTicks(unit.definitionId==='warwick'&&Boolean(unit.sixCost?.permanentFrenzy||(unit.sixCost?.frenzyUntil??0)>=tick), tick);
  });
  refreshMechanismAuras(ctx);
  if (openingState) {
    const advanced = advanceOpeningTasks(openingState, tick, openingUnits()); openingState = advanced.state;
    for (const task of advanced.ready) {
      const holder = units.find(u => u.id === task.source.ownerId)!, seq = actionSeq++;
      for (const id of task.targetIds) {
        const target = units.find(u => u.id === id && u.alive && u.hp > 0); if (!target) continue;
        executeDamageControlSequence(ctx, holder, task.source, target, task.effects, seq);
      }
    }
  }
  advanceSixCost(ctx,()=>actionSeq++);
  advanceP3(ctx);
  // Keep the fixed barriers in separate compilation units. Each closure owns
  // this tick only; none of its plans, queries or validation results is retained.
  function planActions(): void {
    const p3ChargedAttacks = new Set<number>();
    // Every action reads pre-damage HP/life. New control has startsAtTick=tick+1.
    for (const unit of units) {
      const firstPacket = ctx.packets.length;
      if(isAttackProxy(unit))continue;
      let guaranteedAttackSeq: number | undefined;
      const prior = targets.get(unit.id);
      // Stationary bodies and the accepted target's cell still block. Landings won
      // in this tick's ordinary move do not: losing that reservation waits.
      const actionOccupied = new Set(units.filter(u => occupiesCell(u, tick)).map(u => key(u.cell)));
      for (const id of ordinaryMoved) if (id !== prior?.target?.id) {
        const mover = units.find(u => u.id === id); if (mover) actionOccupied.delete(key(mover.cell));
      }
      const decision = unit.hp > 0 && !isMadChemist(unit)
        ? decideCombatTarget(state.board, unit, units, tick, actionOccupied, false, prior, hardControlled(unit),
          unit.alive && unit.hp > 0 ? ctx.draw : undefined) : undefined;
      const target = unit.hp>0?(isMadChemist(unit)?byDistance(unit,enemies(unit,units))[0]:decision?.target):undefined;
      if (unit.alive && unit.targetId !== (target?.id ?? null)) events.push({ type: 'targetChanged', tick, unitId: unit.id, before: unit.targetId, after: target?.id ?? null });
      const previousTarget = unit.targetId;
      unit.targetId = unit.alive ? target?.id ?? null : null;
      if (unit.meleeApproach && unit.meleeApproach.targetId !== unit.targetId) delete unit.meleeApproach;
      if (unit.alive && decision?.engaged) unit.targetEngaged = true;
      else delete unit.targetEngaged;
      if (unit.alive && previousTarget !== unit.targetId) emitMechanismSignal(ctx, { event: 'target-changed', tick, actionSeq, actorId: unit.id, targetId: unit.targetId, cast: null });
      const due = unit.tasks.filter(t => t.executeAtTick <= tick || (t.shieldEndKey !== undefined && unit.shieldLayers.find(s => s.key === t.shieldEndKey)?.remaining === 0));
      unit.tasks = unit.tasks.filter(t => !due.includes(t));
      for (const task of due) if ((!task.cancellable || (unit.alive && unit.hp>0 && !blocked.has(unit.id))) && (unit.alive&&unit.hp>0 || task.attachedDot || task.kind === 'tristanaBounce')) executeTask(ctx, unit, task);
      advanceMadChemist(ctx, unit, () => actionSeq++);
      if(isOpeningCrab(unit)){if(unit.alive&&!blocked.has(unit.id))crabJump(ctx,unit,()=>actionSeq++);rollPlannedPackets(ctx, unit, firstPacket, p3ChargedAttacks, guaranteedAttackSeq);continue;}
      if (unit.definitionId==='g23-forge'||unit.definitionId==='training-dummy'||unit.definitionId==='forming-dummy'||unit.anomalySummon?.kind==='crab'||g23Bound(unit)||!unit.alive || !target || blocked.has(unit.id) || active(unit, tick, 'channel').length > 0) { rollPlannedPackets(ctx, unit, firstPacket, p3ChargedAttacks, guaranteedAttackSeq); continue; }
      const inRange = hexDistance(unit.cell, target.cell) <= range(unit);
      const selfCast = isMadChemist(unit) || ['irelia', 'leona', 'vander', 'kogmaw', 'lux', 'loris', 'scar', 'caitlyn', 'maddie','warwick','viktor','mel'].includes(champion(unit));
      const pendingVanderStrike = champion(unit) === 'vander' && unit.runtime.nextAttackPhysical > 0;
      if ((unit.g23?.ascension?.untilTick??0)<tick && !['neutral', 'amumu', 'zeri'].includes(champion(unit)) && unit.maxMana > 0 && !pendingVanderStrike && unit.mana >= unit.maxMana && (hexDistance(unit.cell,target.cell)<=range(unit,false) || selfCast)) {
        const seq = actionSeq++, beforeCount = events.length;
        const cost = planManaCost({ unitId: unit.id, current: unit.mana, maximum: unit.maxMana, lockedUntilTick: unit.manaLockedUntilTick ?? 0 }, unit.maxMana)!;
        spent.set(unit.id, cost.actualManaSpent); unit.mana = cost.after.current; unit.runtime.castCount++;
        if (champion(unit) !== 'viktor') unit.manaLockedUntilTick = tick + S13_COMBAT_RULES.castManaLockTicks;
        if(unit.unreavedMaxMana!==undefined&&unit.definitionId!=='viktor')unit.maxMana=unit.unreavedMaxMana;
        const oldInterval = interval(unit, tick, units);
        castB4Combat(ctx,unit,seq);
        castAnomaly(ctx,unit,target);
        const targets = planS13Cast(ctx, unit, target, seq);
        const receipt = completeCast({ source: asSource(origin(unit)), actionSeq: seq, completed: true, targetIds: targets, targetsSampledAtTick: tick, actualManaSpent: 0, refundedMana: 0, completionCell: unit.cell }, cost.actualManaSpent);
        (ctx.castReceipts ??= []).push(receipt);
        // replay2: the receipt is finalized at the end of this tick (same-tick refunds, M8_RULES G08).
        events.splice(beforeCount, 0, { type: 'cast', tick, receipt });
        castB5Voidcaller(ctx,unit,receipt.actualManaSpent,voidcaller,voidlings);
        v19DominatorCast(ctx,unit,receipt.actualManaSpent);
        castV20Teamups(ctx,unit,target,seq);
        batch2Cast(ctx,unit);
        unit.cooldownTicks = oldInterval;
        const immediate = unit.tasks.filter(t => t.executeAtTick <= tick);
        unit.tasks = unit.tasks.filter(t => t.executeAtTick > tick);
        for (const task of immediate) executeTask(ctx, unit, task);
        hooks(unit, 'onCast', seq);
        p3Cast(ctx, unit, target, seq, cost.actualManaSpent);
        emitMechanismSignal(ctx, { event: 'cast-completed', tick, actionSeq: seq, actorId: unit.id, targetId: target.id, cast: receipt });
      } else if (!isMadChemist(unit) && inRange && unit.cooldownTicks === 0) {
        const seq = actionSeq++, neutral = champion(unit) === 'neutral';
        let attackTarget = target;
        if (unit.mechanics?.some(m=>m.mechanic==='g24Fishbones')) {
          if (!itemRandomStreams) throw new RangeError('Missing item random streams');
          const selected = chooseFishbonesTarget(itemRandomStreams, enemies(unit, units)
            .filter(enemy=>hexDistance(unit.cell,enemy.cell)<=range(unit)).map(enemy=>enemy.id));
          itemRandomStreams = selected.streams;
          attackTarget = units.find(enemy=>enemy.id===selected.targetId)!;
          if (unit.targetId !== attackTarget.id) {
            events.push({type:'targetChanged',tick,unitId:unit.id,before:unit.targetId,after:attackTarget.id});
            unit.targetId = attackTarget.id;
            if (unit.meleeApproach && unit.meleeApproach.targetId !== unit.targetId) delete unit.meleeApproach;
            unit.targetEngaged = true;
            emitMechanismSignal(ctx, {event:'target-changed',tick,actionSeq:seq,actorId:unit.id,targetId:attackTarget.id,cast:null});
          }
        }
        unit.runtime.attackCount++; events.push({ type: 'attack', tick, attackerId: unit.id, targetId: attackTarget.id });
        if(unit.anomalyState?.critReady){guaranteedAttackSeq=seq;unit.anomalyState.critReady=false;}
        batch2Attack(ctx,unit,attackTarget,seq,defenses(unit,true,tick,units)+defenses(unit,false,tick,units));
        const oldInterval = interval(unit, tick, units); planS13Attack(ctx, unit, attackTarget, seq); recordG23Attack(ctx,unit,attackTarget,seq); attackAnomaly(ctx,unit,attackTarget,seq); if(p3Attack(ctx,unit,attackTarget,seq))p3ChargedAttacks.add(seq); unit.cooldownTicks = oldInterval;
        const gambler=unit.mechanics?.find(m=>m.mechanic==='g24Gambler');
        if(gambler)awardItemGold(unit,gambler,'gamblers-blade',unit.runtime.attackCount-1);
        attackB4Combat(ctx,unit,attackTarget,seq);
        hooks(unit, 'onAttack', seq);
        emitMechanismSignal(ctx, { event: 'attack-completed', tick, actionSeq: seq, actorId: unit.id, targetId: attackTarget.id, cast: null });
        if (!neutral) attackMana.set(unit.id, S13_COMBAT_RULES.attackMana + mechanic(unit, 'extraAttackMana', 'amount'));
      }
      rollPlannedPackets(ctx, unit, firstPacket, p3ChargedAttacks, guaranteedAttackSeq);
    }
  }
  planActions();
  spawnB5Voidlings(ctx,state,voidlings,voidcaller);
  scheduleAnomalyAttacks(ctx,()=>actionSeq++);
  // Coin/Jackpot is earned by the cast before this tick's damage samples.
  if(hasD11Bank)for(const team of ['player','enemy'] as const){
    const gold=fullRoster.filter(u=>u.team===team).reduce((n,u)=>n+(u.g23?.highRoller??[]).reduce((m,r)=>m+r.gold,0)-(highRollerBefore.get(u.id)??0),0);
    if(gold)for(const holder of fullRoster)if(holder.team===team&&holder.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate'))
      holder.currentItemBankGold=holder.currentItemBankGold!+gold;
  }
  // G2-4b: each stun applied (or refreshed) on an enemy is one stun-applied occurrence of its source owner.
  let stunScan = 0;
  const emitStuns = () => {
    const from = stunScan; stunScan = events.length;
    if (!hasMechanismSubscriber(units, 'stun-applied')) return;
    for (const event of events.slice(from, stunScan)) if (event.type === 'statusChanged' && (event.reason === 'applied' || event.reason === 'refreshed') && event.group.kind === 'stun') for (const c of event.group.contributions) {
        const actor = units.find(u => u.id === c.source.ownerId), victim = units.find(u => u.id === event.group.targetId);
        if (actor && victim && actor.team !== victim.team) emitMechanismSignal(ctx, { event: 'stun-applied', tick, actionSeq: actionSeq++, actorId: actor.id, targetId: victim.id, cast: null });
      }
  };
  emitStuns();
  function resolvePackets() {
    const beforeDamage = units.map(u => ({ id: u.id, hp: u.hp, maxHp: u.maxHp }));
    const positiveDamage = new Set<string>();
    // Virtual health and layered shields give each packet a deterministic actual contribution and killer.
    const virtualHp = new Map(units.map(u => [u.id, u.hp])), hpLost = new Map<string, number>(), damageManaCenti = new Map<string, number>();
    // Pay prior debts at the damage barrier. These are nonlethal HP payments:
    // no second shield/resistance, redirection, mana, vamp or equipment proc.
    for (const unit of units) if (unit.deferredItemDamage?.length) {
      const item = unit.mechanics!.find(m=>m.mechanic==='g24DeathsDefiance')!;
      const pending = [];
      for (const debt of unit.deferredItemDamage) {
        const payment = advanceDeferredItemDamage(debt,tick,virtualHp.get(unit.id)!,item.values.durationTicks);
        virtualHp.set(unit.id,payment.hpAfter);
        if (!payment.finished) pending.push(payment.debt);
        if (payment.damage) {
          const seq=actionSeq++;
          const context:DamageContext={source:asSource(item.source),targetId:unit.id,damageType:'true',delivery:'equipment-proc',deferredPayment:true,triggeringCastActionSeq:null,
            actionSeq:seq,rootActionSeq:seq,parentPacketId:debt.packetId,packetId:JSON.stringify([ctx.combatId,tick,unit.id,seq,'defiance',debt.packetId]),
            packetOrdinal:0,equipmentDepth:1,redirected:false,area:false,critEligibility:'never',permissions:[]};
          events.push({type:'packetDamage',tick,outcome:{context,hit:true,raw:payment.damage,prevented:0,mitigated:payment.damage,
            absorbed:0,hpDamage:payment.damage,overkill:0,critical:false,killingPacket:false}});
        }
      }
      unit.deferredItemDamage=pending;
    }
    const damageByAction = new Map<string, { owner: S13Unit; source: CombatOrigin; seq: number; outcomes: DamageOutcome[]; hpAmount: number; heal?: Amount }>();
    const allOutcomes: DamageOutcome[] = [];
    const trackAssists = tracksCabalTakedowns(units)||hasMechanismSubscriber(units, 'kill-or-assist')||units.some(u=>champion(u)==='swain'||u.mechanics?.some(m=>m.mechanic==='s13Anomaly'||m.mechanic==='sisters')||u.sources?.some(s=>s.source.sourceDefinitionId==='conqueror'));
    const damageContributors = { ...state.damageContributors };

    ctx.virtualHp = virtualHp;
    const killed = new Map<string, CombatOrigin>();
    const ricochetActions = new Set<string>(), aggregatedActions = new Set<number>();
    const commitOutcome = (target: S13Unit, result: ReturnType<typeof allocateDamage>, packet: S13Packet, beforeMitigation = result.outcome.raw) => {
      const outcome = result.outcome, { absorbed, hpDamage: actual, context, critical } = outcome;
      if (outcome.deferred) target.deferredItemDamage=[...target.deferredItemDamage??[],{
        packetId:context.packetId,startedAtTick:tick,amount:outcome.deferred,paid:0,elapsedTicks:0}];
      recordG23SkillDamage(ctx,units.find(u=>u.id===packet.source.ownerId),target,actual,packet);
      p3Damage(ctx, units.find(u => u.id === packet.source.ownerId), outcome);
      recordG23Damage(ctx,units.find(u=>u.id===packet.source.ownerId),actual,packet,absorbed,context.redirected);
      recordG22Damage(ctx, units.find(u => u.id === packet.source.ownerId), actual, packet);
      recordG2Damage(ctx, units.find(u => u.id === packet.source.ownerId), target, actual, absorbed, packet, Math.max(0, (virtualHp.get(target.id) ?? 0) - actual));
      const broken: number[] = [];
      target.shieldLayers = result.shields.map(layer => {
        const old = target.shieldLayers.find(s => s.key === layer.key)!;
        const taken = old.remaining - layer.remaining;
        recordMelAbsorption(ctx,old,taken);
        if (taken > 0 && layer.remaining === 0) broken.push(old.granted);
        const next = shieldProjection(recordShieldAbsorption(frozenShield(old, target), layer.remaining), old.key, old.m8Grant, taken > 0 && layer.remaining === 0 ? 'depleted' : old.endedReason);
        if (taken > 0) {
          events.push({ type: 'shieldLayerChanged', tick, layer: next.m8State!, reason: 'absorbed' });
          if (next.remaining === 0) events.push({ type: 'shieldLayerChanged', tick, layer: next.m8State!, reason: 'depleted' });
        }
        return next;
      }); syncShield(target);
      virtualHp.set(target.id, result.hpAfter);
      if(outcome.hit&&packet.source.definitionId.endsWith('DeftHands'))recordAnomalyProxyHit(ctx,units.find(u=>u.id===packet.source.ownerId),target,packet.actionSeq,context.redirected);
      batch2Incoming(ctx,target,packet,outcome.hit);
      allOutcomes.push(outcome);
      ctx.resolutionFacts = { ...ctx.resolutionFacts!, damage: allOutcomes };
      hpLost.set(target.id, (hpLost.get(target.id) ?? 0) + actual);
      if (outcome.mitigated > 0 && context.permissions.includes('damage-mana') && tick >= (target.manaLockedUntilTick ?? 0) && target.maxMana > 0 && champion(target) !== 'viktor')
        damageManaCenti.set(target.id, (damageManaCenti.get(target.id) ?? 0) + damageMana(beforeMitigation, outcome.mitigated));
      if (absorbed + actual > 0) {
        positiveDamage.add(target.id);
        if (trackAssists) damageContributors[target.id] = [...new Set([...(damageContributors[target.id] ?? []), context.source.ownerId,
          ...units.filter(u=>u.id===context.source.ownerId&&isAttackProxy(u)).map(u=>u.anomalySummon?.ownerId??u.v20Traits!.minion!.ownerId)])].sort(compareText);
      }
      // B9 replay2: the frozen DamageOutcome is the packet event payload.
      events.push({ type: 'packetDamage', tick, outcome });
      const mogul=target.mechanics?.find(m=>m.mechanic==='g24Mogul');
      if(mogul&&absorbed+actual>0&&(target.itemMogulHits?.length??0)<mogul.values.stackCap){
        target.itemMogulHits=[...target.itemMogulHits??[],{packetId:context.packetId,tick}];
        if(target.itemMogulHits.length===mogul.values.stackCap)awardItemGold(target,mogul,'moguls-full',0);
      }
      const owner = units.find(u => u.id === packet.source.ownerId);
      damageB4Combat(ctx,owner,packet,absorbed+actual);
      if (owner && absorbed + actual > 0 && context.permissions.includes('omnivamp')) {
        const damageKey = JSON.stringify([owner.id, packet.actionSeq]), old = damageByAction.get(damageKey);
        damageByAction.set(damageKey, { owner, source: packet.source, seq: packet.actionSeq,
          outcomes: [...old?.outcomes ?? [], outcome], hpAmount: (old?.hpAmount ?? 0) + actual, heal: old?.heal ?? packet.onPositiveHpDamageHeal });
      }
      if (outcome.killingPacket) {
        const lootSample=lootExplosionKillSample(owner,target,state.strategy);
        if(lootSample)lootExplosionKills.set(target.id,lootSample);
        batch2Kill(ctx,owner,target,()=>actionSeq++);
        g23RumbleDeath(ctx,target,actionSeq++,defenses(target,true,tick,units)+defenses(target,false,tick,units));
        killed.set(target.id, packet.source); events.push({ type: 'kill', tick, unitId: target.id, source: packet.source });
        if(owner&&owner.team!==target.team)chainbladeKill(ctx,owner);
        if(owner?.d11Kills&&owner.team!==target.team&&!target.itemSummon&&!target.anomalySummon
          &&UNIT_DEFINITIONS[target.definitionId]&&!UNIT_DEFINITIONS[target.definitionId].summon&&target.unitKind!=='neutral'){
          const m=owner.mechanics!.find(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='headhunter')!;
          const before=d11HeadhunterAttackSpeedBps(m.values.priorKills+owner.d11Kills.length);
          owner.d11Kills=[...owner.d11Kills,{eventSeq:(state.nextEventSeq??0)+events.length-1,victimId:target.id}];
          events.push({type:'statChanged',tick,unitId:owner.id,source:asSource(m.source),stat:'attackSpeed',before,
            after:d11HeadhunterAttackSpeedBps(m.values.priorKills+owner.d11Kills.length)});
        }
        const ricochetKey = JSON.stringify([packet.source.ownerId, packet.actionSeq]);
        if (owner && !context.redirected && packet.bounce && !ricochetActions.has(ricochetKey) && outcome.overkill > 0) {
          const next = byDistance(target, enemies(owner, units).filter(u => u.id !== target.id && (virtualHp.get(u.id) ?? 0) > 0))[0];
          if (next) {
            ricochetActions.add(ricochetKey);
            owner.tasks.push({ key: `${owner.id}:${packet.actionSeq}:bounce`, kind: 'tristanaBounce', source: packet.source,
              executeAtTick: tick + 1, targetId: next.id, amount: outcome.overkill, ordinal: 0, total: 1, cancellable: false, actionSeq: packet.actionSeq,
              inherited: { parentPacketId: context.packetId, resolvedAtTick: tick, portion: 'overkill', critical } });
            const gain = Math.round(variable(owner, 'ASKillGain', 1.25) * 100); owner.runtime.permanentAdBps += gain;
            events.push({ type: 'growth', tick, unitId: owner.id, amountBps: gain, totalBps: owner.runtime.permanentAdBps });
          }
        }
      }
      for (const granted of broken) emitMechanismSignal(ctx, { event: 'shield-broken', tick, actionSeq: context.rootActionSeq, actorId: target.id, targetId: null, cast: null }, { ...EMPTY_FACTS, brokenShield: granted });
      const facts = { damage: [outcome], healing: [], shieldDecay: [] };
      const signal = { tick, actionSeq: context.rootActionSeq, actorId: context.source.ownerId, targetId: target.id, cast: null } as const;
      if (context.permissions.includes('incoming-basic-hit') && outcome.hit) emitMechanismSignal(ctx, { ...signal, event: 'incoming-basic-hit' }, facts);
      if (absorbed + actual > 0) {
        emitMechanismSignal(ctx, { ...signal, event: 'damage-dealt' }, facts);
        emitMechanismSignal(ctx, { ...signal, event: 'damage-taken' }, facts);
        if (absorbed > 0 && context.permissions.includes('guardbreaker')) emitMechanismSignal(ctx, { ...signal, event: 'shield-hit' }, facts);
      }
      const itemCollector=owner?.mechanics?.find(m=>m.mechanic==='g24Collector');
      const finisher=owner&&p3Mechanic(owner,'the-finisher');
      const collector=finisher&&(!itemCollector||itemCollector.values.executeBps<Math.round(p3Values('the-finisher').ExecutePercent*10000))?{...finisher,values:{executeBps:Math.round(p3Values('the-finisher').ExecutePercent*10000)}}:itemCollector;
      const remaining=virtualHp.get(target.id)!;
      if(owner&&packet.sevikaChomp&&outcome.hit&&!context.redirected){
        if(remaining>0&&BigInt(remaining)*10000n<BigInt(target.maxHp)*BigInt(Math.round(variable(owner,'Spell3_ExecutePercentage')*10000))){
          const execution:S13Packet={...packet,sevikaChomp:undefined,raw:remaining,damageType:'true',ordinal:1000+packet.ordinal,critEligibility:'never',critical:false};
          const request=damageRequest(execution,ctx.combatId!,tick);
          const executed=allocateDamage(request.context,hallOfMirrorsExecution(owner,remaining),remaining,[]);
          commitOutcome(target,{...executed,shields:target.shieldLayers},execution);
        }
        if(virtualHp.get(target.id)===0){owner.tasks.push({key:JSON.stringify([owner.id,packet.actionSeq,'g23Chomp',packet.ordinal]),kind:'g23Chomp',source:packet.source,
          executeAtTick:tick+1,targetId:target.id,amount:Math.floor(packet.raw*Math.round(variable(owner,'Spell3_ResetDamageFalloff')*10000)/10000),
          actionSeq:packet.actionSeq,ordinal:packet.ordinal+1,total:packet.ordinal+2,cancellable:true});return;}
      }
      const blade=chainblade(owner);
      if(owner&&blade&&!context.redirected&&['basic-attack','ability-direct','ability-periodic','attack-extra'].includes(context.delivery)
        &&absorbed+actual>0&&remaining>0&&owner.team!==target.team&&BigInt(remaining)*10000n<BigInt(target.maxHp)*BigInt(V19_MECHANICS.chainblade.executeBps)){
        const execution:S13Packet={source:blade.source,targetId:target.id,raw:remaining,damageType:'true',actionSeq:actionSeq++,ordinal:0,delivery:'equipment-proc',critEligibility:'never',critical:false,area:false,triggeringCastActionSeq:null};
        const request=damageRequest(execution,ctx.combatId!,tick);
        const executed=allocateDamage(request.context,hallOfMirrorsExecution(owner,remaining),remaining,[]);
        commitOutcome(target,{...executed,shields:target.shieldLayers},execution);
        ctx.heals.push({source:blade.source,targetId:owner.id,amount:V19_MECHANICS.chainblade.heal});
        if(chainbladeGoldTarget(owner,target))awardItemGold(owner,blade,'perfected-chainblade',itemGoldReceipts?.filter(r=>r.ownerId===owner.id&&r.kind==='perfected-chainblade').length??0);
        return;
      }
      const guillotine=owner&&batch2Mechanic(owner,'noxian-guillotine');
      if(guillotine&&owner!.team!==target.team&&!context.redirected&&['basic-attack','ability-direct','ability-periodic','attack-extra'].includes(context.delivery)
        &&absorbed+actual>0&&remaining>0&&BigInt(remaining)*100n<BigInt(target.maxHp)*BigInt(batch2Values('noxian-guillotine').BaseExecuteThreshold)){
        const execution:S13Packet={source:guillotine.source,targetId:target.id,raw:remaining,damageType:'true',actionSeq:actionSeq++,ordinal:0,delivery:'equipment-proc',critEligibility:'never',critical:false,area:false,triggeringCastActionSeq:null};
        const request=damageRequest(execution,ctx.combatId!,tick);
        commitOutcome(target,{...allocateDamage(request.context,hallOfMirrorsExecution(owner,remaining),remaining,[]),shields:target.shieldLayers},execution);
        batch2ExecuteReward(ctx,owner!);return;
      }
      if(collector&&!context.redirected&&['basic-attack','ability-direct','ability-periodic','attack-extra'].includes(context.delivery)
        &&absorbed+actual>0&&remaining>0&&BigInt(remaining)*10000n<BigInt(target.maxHp)*BigInt(collector.values.executeBps)){
        const execution:S13Packet={source:collector.source,targetId:target.id,raw:remaining,damageType:'true',actionSeq:actionSeq++,ordinal:0,
          delivery:'equipment-proc',critEligibility:'never',critical:false,area:false,triggeringCastActionSeq:null};
        const request=damageRequest(execution,ctx.combatId!,tick);
        const executed=allocateDamage(request.context,hallOfMirrorsExecution(owner,remaining),remaining,[]);
        // Execution bypasses shields and Defiance; death cleanup removes layers.
        commitOutcome(target,{...executed,shields:target.shieldLayers},execution);
        if(collector.mechanic==='g24Collector')awardItemGold(owner!,collector,'collector',itemGoldReceipts?.filter(r=>r.itemInstanceId===collector.source.instanceId&&r.ownerId===owner!.id&&r.kind==='collector').length??0);
      }
    };
    ctx.packets.sort((a, b) => compareText(a.source.ownerId, b.source.ownerId) || a.actionSeq - b.actionSeq || compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal);
    for (let packetIndex = 0; packetIndex < ctx.packets.length; packetIndex++) {
      let packet = ctx.packets[packetIndex]; const beforeDerived = ctx.packets.length;
      const target = units.find(u => u.id === packet.targetId); if (!target || !target.alive || isAttackProxy(target)) continue;
      const owner = units.find(u => u.id === packet.source.ownerId);
      if (owner) for (const prefix of packet.beforeDamage ?? []) executeMechanismEffect(ctx, owner, prefix.source, target, prefix.effect, packet.actionSeq, prefix.ordinal);
      const damageType = damageTypeForTarget(packet.damageType, targetUnit(target, tick), ctx.resolutionFacts!);
      if (damageType !== packet.damageType) packet = { ...packet, damageType };
      if (p3BurnRaw(owner, packet) !== packet.raw) packet = { ...packet, raw: p3BurnRaw(owner, packet) };
      // Sorcerer 8 weakness is one outgoing multiplier, even when several sorcerers hit the same enemy.
      const weakness=Math.max(0,...(owner?.mechanismState?.statuses??[]).flatMap(g=>g.contributions.filter(c=>c.source.sourceKind==='trait'&&c.source.definitionId==='sorcerer'&&isEffective(c,tick)).map(c=>c.application.magnitudeBps)));
      const request = damageRequest(weakness&&!packet.inherited ? {...packet,raw:Math.floor(packet.raw*(10000-weakness)/10000)} : packet, state.combatId ?? 'standalone', tick);
      const sample = damageSample(packet, target, owner, tick, units, virtualHp.get(target.id)!);
      const basePrepared = prepareDamage(request, sample);
      // One target multiplier after existing amplification/mitigation, before shields/redirect. Never double-scale inherited packets.
      const prepared = hallOfMirrorsDamage(owner,packet,roseAmpV19(owner,target)&&!packet.inherited ? {...basePrepared,beforeMitigation:Math.floor(basePrepared.beforeMitigation*10800/10000),mitigated:Math.floor(basePrepared.mitigated*10800/10000)} : basePrepared);
      if ((virtualHp.get(target.id) ?? 0) > 0 && !sample.prevention) p3Reflect(ctx, target, packet, prepared.blockedByMitigation);
      if (packet.periodic && (sample.prevention || sample.burnCap !== undefined && prepared.mitigated >= sample.burnCap)) clearPeriodicAccount(ctx, packet.periodic, target.id);
      if(packet.devour){
        if(!sample.prevention&&(virtualHp.get(target.id)??0)>0){const hp=virtualHp.get(target.id)!;const execution=allocateDamage(request.context,hallOfMirrorsExecution(owner,hp),hp,[]);commitOutcome(target,{...execution,shields:target.shieldLayers},packet);}continue;
      }
      const protector = units.filter(u => u.alive && u.id !== target.id && u.team === target.team && hexDistance(u.cell, target.cell) <= 1
        && active(u, tick, 'redirect').length > 0).sort(compareIds)[0];
      const transfer = protector ? safeNumber(BigInt(prepared.mitigated) * BigInt(Math.max(...active(protector, tick, 'redirect').map(s => s.amount))) / 10000n) : 0;
      const transferredRaw = transfer > 0 ? safeNumber(BigInt(prepared.beforeMitigation) * BigInt(transfer) / BigInt(prepared.mitigated)) : 0;
      commitOutcome(target, allocateDamage(request.context, { ...prepared, mitigated: prepared.mitigated - transfer }, sample.target!.hp, sample.shields,mechanic(target,'g24DeathsDefiance','fractionBps')), packet, prepared.beforeMitigation - transferredRaw);
      if (protector && transfer > 0) {
        const partial: DamageContext = { ...request.context, targetId: protector.id, redirected: true, critEligibility: 'never',
          parentPacketId: request.context.packetId, packetId: JSON.stringify([request.context.packetId, 'redirect', protector.id]) };
        const redirected: DamageRequest = { context: { ...partial, permissions: permissionsFor(partial) }, input: { stage: 'after-mitigation', amount: transfer,
          inherited: { parentPacketId: request.context.packetId, resolvedAtTick: tick, portion: 'redirect-share', critical: prepared.critical } } };
        const redirectSample = damageSample(packet, protector, owner, tick, units, virtualHp.get(protector.id)!);
        commitOutcome(protector, allocateDamage(redirected.context,prepareDamage(redirected,redirectSample),redirectSample.target!.hp,redirectSample.shields,mechanic(protector,'g24DeathsDefiance','fractionBps')), packet, transferredRaw);
      }
      // The bound target's virtual HP is authoritative here; alive/hp are committed
      // after the batch. Prevention and full shield absorption still allow control.
      // Redirect outcomes do not inherit this continuation or change its target.
      if (owner && target.alive && (virtualHp.get(target.id) ?? 0) > 0) {
        for (const control of packet.afterDamageControl ?? []) executeMechanismEffect(ctx, owner, control.source, target, control.effect, packet.actionSeq, control.ordinal);
      }
      const rootSeq = request.context.rootActionSeq;
      if (!aggregatedActions.has(rootSeq) && !ctx.packets.slice(packetIndex + 1).some(p => (p.rootActionSeq ?? p.actionSeq) === rootSeq)) {
        aggregatedActions.add(rootSeq);
        const owners = [...new Set(allOutcomes.filter(o => o.context.rootActionSeq === rootSeq).map(o => o.context.source.ownerId))].sort(compareText);
        for (const actorId of owners) {
          const damage = allOutcomes.filter(o => o.context.source.ownerId === actorId && o.context.rootActionSeq === rootSeq);
          emitMechanismSignal(ctx, { event: 'damage-dealt', tick, actionSeq: rootSeq, actorId, targetId: damage[0]?.context.targetId ?? null, cast: null }, { ...ctx.resolutionFacts!, damage }, 'action-damage-total');
        }
      }
      emitStuns();
      if (ctx.packets.length > beforeDerived) {
        const children = ctx.packets.splice(beforeDerived).sort((a,b) => compareText(canonicalSource(asSource(a.source)), canonicalSource(asSource(b.source))) || compareText(a.targetId,b.targetId) || a.ordinal-b.ordinal);
        for (const child of children) child.critical = rollCrit(child.critEligibility, p2PacketCrit(units.find(u=>u.id===child.source.ownerId),child.targetId,units,spellCrit(units.find(u => u.id === child.source.ownerId)!)), ctx.draw);
        ctx.packets.splice(packetIndex + 1, 0, ...children);
      }
    }
    ctx.virtualHp = undefined;
    for (const unit of units) {
      unit.hp = virtualHp.get(unit.id)!;
    }
      return { beforeDamage, positiveDamage, hpLost, damageManaCenti, damageByAction, allOutcomes, trackAssists, damageContributors, killed };
  }
  const { beforeDamage, positiveDamage, hpLost, damageManaCenti, damageByAction, allOutcomes, trackAssists, damageContributors, killed } = resolvePackets();
  const trenchEligible=new Map(units.filter(u=>u.alive&&u.hp>0&&u.mechanics?.some(m=>m.mechanic==='g24Trench'&&BigInt(u.hp)*10000n<=BigInt(u.maxHp)*BigInt(m.values.thresholdBps))).map(u=>[u.id,u.maxHp]));
  settleSurvival(ctx, beforeDamage, positiveDamage);
  settleAmbessaRetreats(ctx);
  // Max-HP growth follows the fixed-max survival barrier. A lethal packet cannot
  // be undone by growth; missing HP is otherwise preserved (not healing).
  for(const unit of units){
    if(!unit.itemMogulHits?.length)continue;
    const gained=(unit.itemMogulHits?.length??0)-(state.units.find(u=>u.id===unit.id)?.itemMogulHits?.length??0);
    if(gained<=0)continue;
    const mogul=unit.mechanics!.find(m=>m.mechanic==='g24Mogul')!,basis=unit.maxHpBasis!;
    unit.maxHpBasis={...basis,flat:basis.flat+gained*mogul.values.healthPerStack};
    const beforeMax=unit.maxHp,beforeHp=unit.hp;
    unit.maxHp=scaleItemSummonHp(unit,Math.floor((basis.base+unit.maxHpBasis.flat)*(10000+basis.bps+basis.bonusBps)/10000));
    unit.hp=beforeHp>0?Math.min(unit.maxHp,beforeHp+unit.maxHp-beforeMax):0;
    events.push({type:'maxHpChanged',tick,unitId:unit.id,source:asSource(mogul.source),beforeMax,afterMax:unit.maxHp,beforeHp,afterHp:unit.hp,countsAsHeal:false});
  }
  settleShieldEnds(ctx, () => actionSeq++);
  takedownAnomalies(ctx,killed,damageContributors);
  // Every vamp condition samples the same healing-entry HP, before any queued heal.
  const rates = new Map(units.map(unit => [unit.id, vampRates(unit, unit.hp)]));
  for (const { owner, source, seq, outcomes, hpAmount, heal: positiveHeal } of damageByAction.values()) {
    if (owner.hp <= 0) continue;
    const fieldMedic = heroLive(owner)?.omnivampBps ?? 0;
    if (hpAmount > 0 && fieldMedic && source.sourceKind === 'ability') ctx.heals.push({ source, targetId: owner.id, amount: Math.floor(hpAmount * fieldMedic / 10000) });
    if (hpAmount > 0) for (const definition of positiveHeal ? [{ source, amount: positiveHeal }] : owner.mechanismDefinitions!.positiveDamageHeals ?? []) ctx.heals.push({ source: definition.source, targetId: owner.id,
      amount: evaluateAmount(definition.amount, { holder: hpSample(owner), attackDamage: ad(owner), abilityPower: ap(owner, tick) }) });
    for (const request of vampRequests(JSON.stringify([ctx.combatId, tick, owner.id, seq, 'vamp']), owner, outcomes, rates.get(owner.id)!, units.filter(u=>!isAttackProxy(u))))
      ctx.heals.push({ source: request.contributions[0].source, targetId: request.targetId, amount: request.requested, request });
  }
  ctx.heals.sort((a, b) => compareText(canonicalSource(asSource(a.source)), canonicalSource(asSource(b.source))) || compareText(a.targetId, b.targetId) || compareText(a.request?.healId ?? '', b.request?.healId ?? ''));
  const healIds = new Set<string>();
  for (const entry of ctx.heals) {
    if (entry.request) { if (healIds.has(entry.request.healId)) throw new RangeError('Duplicate planned healing mutation'); healIds.add(entry.request.healId); }
    const healTarget = units.find(u => u.id === entry.targetId), beforeHeal = healTarget?.hp ?? 0;
    commitMechanismHeal(ctx, entry);
    shareStebHeal(ctx, entry, healTarget, (healTarget?.hp ?? 0) - beforeHeal);
    if (entry.reactionKey && companionState && units.find(u => u.id === entry.targetId)!.hp <= 0) companionState = { ...companionState, reactions: companionState.reactions.map(r => r.key === entry.reactionKey ? { ...r, status: 'cancelled' as const } : r) };
  }
  if (trackAssists) for (const death of allOutcomes.filter(o => o.killingPacket)) for (const actorId of damageContributors[death.context.targetId] ?? [])
    if (units.some(u => u.id === actorId && u.hp > 0)) emitMechanismSignal(ctx, { event: 'kill-or-assist', tick, actionSeq: death.context.rootActionSeq, actorId, targetId: death.context.targetId, cast: null }, { ...ctx.resolutionFacts!, damage: [death] });
  for(const [victimId,source] of killed){const contributors=[...new Set([source.ownerId,...(damageContributors[victimId]??[])])];extendG23Swain(ctx,victimId,contributors);recordG23Conquest(ctx,victimId,contributors);sistersV19(ctx,contributors);}
  // Shield follows the death of the current target, including kills credited to another ally.
  for(const u of units.filter(u=>u.alive&&u.hp>0)) {
    const quick=u.mechanics?.find(m=>m.mechanic==='quickstriker');
    if(quick?.values.shield && u.targetId && killed.has(u.targetId)){
      grantShield(u,quick.source,quick.values.shield,tick+quick.values.durationTicks,tick,events);
      u.v20Traits={...u.v20Traits,quickDashAtTick:tick+1};
    }
  }
  settleG23ExperimentKills(ctx,killed);
  for (const source of killed.values()) {
    const owner = units.find(u => u.id === source.ownerId);
    if (owner && owner.hp > 0 && hasMechanic(owner, 'killStreak')) killMana.set(owner.id, (killMana.get(owner.id) ?? 0) + mechanic(owner, 'killStreak', 'mana'));
  }
  function settleMana(): void {
    for (let request of ctx.manaRequests ?? []) {
      const target = units.find(u => u.id === request.targetId); if (!target?.alive || target.hp <= 0) continue;
      if(target.definitionId==='viktor'){convertViktorMana(ctx,target,request.amount);continue;}
      request={...request,amount:Math.floor(request.amount*(10000+mechanic(target,'visionary','manaBps'))/10000)};
      const mana = { unitId: target.id, current: target.mana, maximum: target.maxMana, lockedUntilTick: target.manaLockedUntilTick ?? 0 };
      const receipt = ctx.castReceipts?.find(c => c.source.ownerId === target.id && c.actionSeq === request.castActionSeq);
      const result = request.reason === 'cast-refund' ? refundCast(mana, request, receipt!, tick) : { outcome: resolveMana(mana, request, tick) };
      if ('receipt' in result) ctx.castReceipts = ctx.castReceipts!.map(c => c === receipt ? result.receipt : c);
      const outcome = result.outcome; target.mana = outcome.after;
      events.push({ type: 'manaChanged', tick, outcome });
    }
    for (const unit of units) {
      if (!unit.alive || unit.hp <= 0 || champion(unit) === 'neutral') continue;
      if ((hpLost.get(unit.id) ?? 0) > 0) hooks(unit, 'onHpLoss', actionSeq);
      // Legacy gainMana hooks have no frozen ManaRequest reason; no M8 content declares them.
      if ((hookMana.get(unit.id) ?? 0) > 0) throw new RangeError('Legacy gainMana hook cannot enter the replay2 ledger');
      const centi = (unit.damageManaRemainderCenti ?? 0) + Math.floor((damageManaCenti.get(unit.id) ?? 0) * (10000 + mechanic(unit, 'visionary', 'manaBps')) / 10000);
      if (damageManaCenti.has(unit.id)) unit.damageManaRemainderCenti = centi % 100;
      const attackGain = attackMana.get(unit.id) ?? 0, damageGain = Math.floor(centi / 100), killGain = killMana.get(unit.id) ?? 0;
      // replay2: one ManaOutcome event per non-zero request, resolved in the same order as before.
      for (const [reason, gain] of [['attack', attackGain], ['damage', damageGain], ['kill', killGain]] as const) {
        if(unit.definitionId==='viktor'){if(reason!=='attack'&&reason!=='damage')convertViktorMana(ctx,unit,gain);else if(reason==='attack')convertViktorMana(ctx,unit,Math.max(0,Math.floor(gain*(10000+mechanic(unit,'visionary','manaBps'))/10000)-10));continue;}
        const outcome = resolveMana({ unitId: unit.id, current: unit.mana, maximum: unit.maxMana, lockedUntilTick: unit.manaLockedUntilTick ?? 0 },
          { source: asSource(origin(unit)), targetId: unit.id, amount: reason === 'damage' ? gain : Math.floor(gain*(10000+mechanic(unit,'visionary','manaBps'))/10000), reason, bypassLock: 'none', castActionSeq: null }, tick);
        unit.mana = outcome.after;
        if (gain > 0) events.push({ type: 'manaChanged', tick, outcome });
      }
      if (!unit.runtime.buddyTriggered) {
        const grants = (unit.mechanics ?? []).filter(effect => effect.mechanic === 'bulkyBuddies' && units.some(buddy => buddy.id === effect.targetId && (startHp.get(buddy.id) ?? 0) > 0 && buddy.hp === 0));
        for (const effect of grants) grantShield(unit, effect.source, Math.floor(unit.maxHp * effect.values.shieldMaxHpBps / 10000), tick + effect.values.durationTicks, tick, events);
        if (grants.length) unit.runtime.buddyTriggered = true;
      }
    }
  }
  settleMana();
  const trenchMembership=splitTrenchHolders(ctx,state,trenchEligible);
  observeBatch5RevivalDeaths(ctx, () => deathAnomalies(ctx));
  deathG23Sion(ctx);
  settleSixCostDeaths(ctx,killed);
  if(hasBanish){
    // A first-death Sion is already in units when it becomes absent at this barrier.
    // Active identities take precedence; only append missing suspended identities.
    const rosterById=new Map(units.map(u=>[u.id,u]));
    for(const unit of fullRoster)if(isAbsent(unit,tick)&&!rosterById.has(unit.id))rosterById.set(unit.id,unit);
    fullRoster.splice(0,fullRoster.length,...rosterById.values());
  }
  // G2-4b: only true zero-HP deaths notify item declarations before cleanup.
  // Trench replacement removes a surviving holder and must not emit holder-death.
  if (hasMechanismSubscriber(units, 'holder-death')) for (const unit of units.filter(u => u.alive && u.hp === 0))
    emitMechanismSignal(ctx, { event: 'holder-death', tick, actionSeq: actionSeq++, actorId: unit.id, targetId: unit.id, cast: null });
  settleP3Deaths(ctx, units.filter(u => u.alive && u.hp === 0));
  cleanupMechanisms(ctx);
  for (const unit of units) {
    if (unit.alive && unit.hp === 0) {
      unit.alive = false; unit.targetId = null; delete unit.targetEngaged; delete unit.meleeApproach; unit.cooldownTicks = 0; unit.moveCooldownTicks = 0; unit.mana = 0;
      unit.shieldLayers = []; unit.shield = 0; unit.shieldExpiresAtTick = null; unit.statuses = [];
      if (unit.deferredItemDamage) unit.deferredItemDamage=[];
      unit.tasks = unit.tasks.filter(t => !t.cancellable && (t.attachedDot || t.kind === 'tristanaBounce'));
      events.push(sampleAugmentDeath({ type: 'death', tick, unitId: unit.id }, unit, killed.get(unit.id) ?? null,
        tracksCabalTakedowns(units)?sampleCabalTakedowns(units,unit.id,[...(killed.has(unit.id)?[killed.get(unit.id)!.ownerId]:[]),...(damageContributors[unit.id]??[])]):undefined, lootExplosionKills.get(unit.id)));
    }
    // Keep depleted protective layers only until their independent end task has consumed absorption.
    unit.shieldLayers = unit.shieldLayers.filter(layer => layer.remaining > 0 || unit.tasks.some(t => t.shieldEndKey === layer.key));
  }
  for(const unit of units)for(const m of unit.mechanics??[]){
    if(m.mechanic!=='g23Tactician')continue;
    if(m.values.timerTicks>0&&tick===m.values.timerTicks&&unit.alive&&unit.hp>0)awardItemGold(unit,m,'tactician-cape',0);
    if(m.values.timerTicks===0&&events.some(e=>e.type==='death'&&e.unitId===unit.id))awardItemGold(unit,m,'tactician-shield',itemGoldReceipts?.filter(r=>r.ownerId===unit.id&&r.itemInstanceId===m.source.instanceId&&r.kind==='tactician-shield').length??0);
  }
  settleH11Deaths(ctx, state);
  const batch5Deaths = events.filter(e => e.type === 'death');
  settleGhostFriendsDeaths({...ctx,units:fullRoster}, batch5Deaths.flatMap(e => e.type === 'death' ? units.filter(u => u.id === e.unitId) : []));
  settleFamilyReunionDeaths(ctx, fullRoster);
  batch2Tick(ctx);
  settleAugmentDeaths(ctx, units.filter(u => (startHp.get(u.id) ?? 0) > 0 && !u.alive), state.strategy?.traits);
  const anomalyRemoved=removeBoundAnomalySummons(ctx,fullRoster);
  if(hasBanish&&anomalyRemoved.length)for(let i=fullRoster.length-1;i>=0;i--)if(anomalyRemoved.includes(fullRoster[i].id))fullRoster.splice(i,1);
  if (companionState) {
    const deaths = units.filter(u => (startHp.get(u.id) ?? 0) > 0 && !u.alive && u.unitKind === 'neutral' && u.encounterId && u.monsterFamily).map(u => ({ combatId: ctx.combatId!, tick, deadUnitId: u.id, team: u.team, encounterId: u.encounterId!, monsterFamily: u.monsterFamily!, eventId: JSON.stringify([ctx.combatId, tick, (state.nextEventSeq ?? 0) + events.findIndex(e => e.type === 'death' && e.unitId === u.id)]) }));
    companionState = registerDeaths(companionState, deaths, units.filter(u => u.alive).map(u => u.id));
  }
  const batch5RebelSummons = summonRebelCopies(ctx,state,fullRoster,batch5Deaths);
  splitExperimentClones(ctx,state,fullRoster);
  const eliminated = eliminationResult(fullRoster), result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  if (result) { cleanupMechanisms(ctx, true); for (const unit of units) { unit.statuses = []; unit.shieldLayers = []; syncShield(unit); unit.tasks = []; } }
  if (result && companionState) companionState = advanceReactions(companionState, tick, [], true).state;
  if (result) events.push({ type: 'combatFinished', tick, result, reason: eliminated ? 'elimination' : 'timeout' });
  // Same-tick refunds are now final: publish each cast with its completed receipt.
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'cast' && 'receipt' in event) {
      const final = ctx.castReceipts!.find(c => c.source.ownerId === event.receipt.source.ownerId && c.actionSeq === event.receipt.actionSeq)!;
      events[i] = { ...event, receipt: final };
    }
  }
  // Preserve prior view order; append new identities for compact replay.
  if(state.trenchSplits?.length||trenchMembership.trenchSplits?.length){
    const order=new Map(state.units.map((u,i)=>[u.id,i]));
    fullRoster.sort((a,b)=>(order.get(a.id)??state.units.length)-(order.get(b.id)??state.units.length));
  }
  return stampCombatStep({ ...state,...trenchMembership, ...(batch5RebelSummons?{batch5RebelSummons}:{}), ...(voidcaller.length?{voidcaller}:{}), ...(anomalyRemoved.length?{removedUnitIds:[...trenchMembership.removedUnitIds??state.removedUnitIds??[],...anomalyRemoved]}:{}), ...(itemGoldReceipts ? {itemGoldReceipts} : {}), ...(itemRandomStreams ? {itemRandomStreams} : {}), ...(openingState ? { openingState } : {}), ...(trackAssists ? { damageContributors } : {}), nextTriggerEventSeq: ctx.nextTriggerEventSeq, ...(companionState ? { companionState } : {}), units:fullRoster, tick, rngState, rngDraws, nextActionSeq: actionSeq, status: result ? 'finished' : 'running', result }, events);
}
