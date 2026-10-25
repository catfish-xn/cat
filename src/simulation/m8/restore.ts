import { overtimeReceivedBps } from '../combat-overtime';
import { MAX_COMBAT_TICKS } from '../combat-types';
import { d14UnitBase } from '../d14-anomalies/projection';
import { p2Bonus } from '../s13-augments-p2-combat';
import { g23FormStats } from '../g2-3-forms';
import type { TraitSnapshot } from '../strategy-types';
import { augmentCombatEffects, shareAugmentTraits } from '../combat-augment-effects';
import { statusDeclaration, isDeclaredStatus, validateItemEffectConsumption, declaredEffects, validateItemRuntime, abilityPowerCandidates, maxHpCandidates } from './item-restore';
import { canonicalSource } from './identity';
import { grantedMaxHpBasis } from './combat-item-programs';
/** Development saves may only contain programs produced by the enabled content compiler. */
import type { CombatUnit } from '../combat-types';
import { canonicalContent, equalValidatedContent } from '../content';
import { sourceKey } from '../combat-s13-state';
import { asSource, compileMechanismDefinitions, flatAmount, selfSelector } from './s13-definitions';
import { validateIdentity } from './identity';
import { validateStatusGroups } from './status';
import { validatePeriodicTask } from './periodic';
import { validateShield } from './shield';
import { integer } from './stats';
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`Invalid Match save: ${message}`); }
export function validateMechanisms(unit: CombatUnit, units: readonly CombatUnit[], tick: number, combatId: string, finished: boolean, nextActionSeq: number, neutralStatuses: ReadonlySet<string> = new Set(), parsedJsonInput = false, traits?: readonly TraitSnapshot[], abilityStatuses: ReadonlySet<string> = new Set()): void {
  const same = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  const state = unit.mechanismState, definitions = unit.mechanismDefinitions;
  check(state && definitions && state.initialized === true && state.combatId === combatId && state.sampledAtTick === tick, 'mechanism initialization/namespace');
  const compiled = compileMechanismDefinitions(unit, combatId);
  check(same(definitions, compiled), 'uncompiled mechanism definitions');
  check(Array.isArray(state.statuses) && Array.isArray(state.periodicTasks) && Array.isArray(state.runtimes) && Array.isArray(state.activities), 'mechanism arrays');
  validateItemRuntime(unit,combatId,tick,compiled);
  const basis = unit.maxHpBasis;
  // G2-4b: health of items gained during combat is part of the basis from their grant on.
  const granted = grantedMaxHpBasis(unit);
  const expectedBasis = { base: unit.effectiveStarLevel===4?d14UnitBase(unit,true).base.health:g23FormStats(unit.definitionId, unit.starLevel,unit.team,unit.itemSummon?.formCell.row ?? unit.startingCell?.row ?? unit.cell.row).health,
    flat: p2Bonus(unit,'health')+granted.flat+(unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statFlat' && e.effect.stat === 'maxHp' ? e.effect.amount : 0), 0)+(unit.g23?.experimentTakedowns.length??0)*(unit.mechanics?.find(m=>m.mechanic==='g23Experiment')?.values.mundo??0),
    bps: (unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statPercentBps' && e.effect.stat === 'maxHp' ? e.effect.bps : 0), 0)+granted.bps, bonusBps: 0 };
  if(unit.itemSummon?.kind==='mirror'){
    expectedBasis.base=unit.itemSummonOpeningMaxHp!;expectedBasis.bps=granted.bps;
    expectedBasis.flat=p2Bonus(unit,'health')+granted.flat+(unit.g23?.experimentTakedowns.length??0)*(unit.mechanics?.find(m=>m.mechanic==='g23Experiment')?.values.mundo??0);
  }
  expectedBasis.flat+=(unit.itemMogulHits?.length??0)*(unit.mechanics?.find(m=>m.mechanic==='g24Mogul')?.values.healthPerStack??0);
  check(same({...basis,bonusBps:0}, expectedBasis), 'resolved maximum health basis');
  validateStatusGroups(state.statuses, tick, combatId);
  const contributions = state.statuses.flatMap(g => g.contributions), covered = new Set<string>();
  for (const legacy of unit.statuses ?? []) {
    if (legacy.kind === 'channel' || legacy.kind === 'redirect') { check(legacy.activity !== undefined, 'missing activity projection'); continue; }
    check(Array.isArray(legacy.contributionKeys) && legacy.contributionKeys.length > 0, 'missing status contribution projection');
    for (const key of legacy.contributionKeys) {
      const c = contributions.find(c => c.key === key);
      // Frozen ability declarations use the same exact identity-key projection
      // as item declarations; their historical source/application is replay-proven.
      const replayedAbility = c?.source.sourceKind === 'ability' && legacy.key === c.key && abilityStatuses.has(c.key);
      if(c && (neutralStatuses.has(c.key) || replayedAbility || (c.source.sourceKind==='item'||c.source.sourceKind==='augment'||c.source.sourceKind==='anomaly'||c.source.sourceKind==='trait') && isDeclaredStatus(c.source,c.application,units,combatId))) {
        check(!covered.has(key) && c.targetId===unit.id && same(c.source,asSource(legacy.source)) && legacy.key===c.key && c.appliedAtTick===legacy.startsAtTick && (c.expiresAtTick ?? 1201)===legacy.expiresAtTick, 'item status source/timing projection');
        if (c.source.sourceKind === 'augment' && c.source.definitionId === 'blistering-strikes') {
          const owner = units.find(u => u.id === c.source.ownerId)!;
          check(owner.team !== unit.team && c.appliedAtTick > 0 && c.appliedAtTick <= tick
            && owner.triggerLedger?.runtimes.some(r => r.source.definitionId === c.source.definitionId && r.source.instanceId === c.source.instanceId
              && r.source.effectIndex <= c.source.effectIndex && c.source.effectIndex < r.source.effectIndex + 2 && r.triggerCount > 0 && r.startsAtTick <= c.appliedAtTick), 'augment attack status receipt');
        } else if (c.source.sourceKind === 'augment' && ['piercing-lotus-i','piercing-lotus-ii'].includes(c.source.definitionId)) {
          // A later critical refreshes the same contribution: it keeps appliedAtTick and moves expiry to that hit + 60 (status.ts).
          const owner=units.find(u=>u.id===c.source.ownerId)!;
          const d=owner.mechanismDefinitions?.eventTriggers?.find(t=>t.id==='lotus-critical'&&t.source.effectIndex<=c.source.effectIndex&&c.source.effectIndex<t.source.effectIndex+t.effects.length);
          check(owner.team!==unit.team&&d&&owner.mechanics?.some(m=>m.mechanic==='s13P3'&&m.source.definitionId===c.source.definitionId)&&c.expiresAtTick!==null&&c.expiresAtTick>=c.appliedAtTick+60&&c.expiresAtTick<=tick+60&&c.appliedAtTick>0&&c.appliedAtTick<=tick&&owner.triggerLedger?.runtimes.some(r=>canonicalSource(r.source)===canonicalSource(d.source)&&r.triggerCount>=(c.expiresAtTick===c.appliedAtTick+60?1:2)&&r.startsAtTick<=c.appliedAtTick),'P3 lotus critical receipt');
        } else if (c.source.sourceKind === 'augment' && c.source.definitionId === 'all-for-one-i') {
          // The D11 source compiler binds this static damage amplifier at tick 0.
          // isDeclaredStatus above and consumption below authenticate coefficients.
          check(c.source.ownerId===unit.id&&c.appliedAtTick===0&&c.expiresAtTick===null,'D11 opening status source/timing');
        } else if (c.source.sourceKind === 'augment' && units.find(u => u.id === c.source.ownerId)?.mechanics?.some(m => m.mechanic === 'corrosion' && canonicalSource(asSource(m.source)) === canonicalSource(c.source))) {
          // Batch-3 Corrosion: an enemy-side, permanent pulse on the holder's combat clock (combat-augment-effects.ts).
          const owner = units.find(u => u.id === c.source.ownerId)!, m = owner.mechanics!.find(m => m.mechanic === 'corrosion')!;
          const [tickOf, index] = JSON.parse(JSON.parse(c.key)[8]).slice(1) as [number, number];
          check(owner.team !== unit.team && c.expiresAtTick === null && c.appliedAtTick > 0 && c.appliedAtTick <= tick && c.appliedAtTick % m.values.periodTicks === 0
            && tickOf === c.appliedAtTick && JSON.parse(c.key)[8] === JSON.stringify(['corrosion', c.appliedAtTick, index])
            && same(statusDeclaration(augmentCombatEffects(m)[index], owner, c.source), c.application), 'augment corrosion pulse');
        } else if (c.source.sourceKind === 'augment') {
          const owner = units.find(u => u.id === c.source.ownerId)!;
          const m = owner.mechanics?.find(m => canonicalSource(asSource(m.source)) === canonicalSource(c.source));
          check(m && owner.team === unit.team && c.expiresAtTick === null && c.appliedAtTick > 0 && c.appliedAtTick <= tick, 'augment status source/timing');
          const application = JSON.parse(c.key)[8];
          const effects = augmentCombatEffects(m);
          const index = effects.findIndex(e => same(statusDeclaration(e, owner, c.source), c.application));
          check(index >= 0, 'augment coefficient');
          if (m.mechanic === 'clockworkAccelerator') check(owner.id === unit.id && c.appliedAtTick % m.values.periodTicks === 0 && application === JSON.stringify(['clockwork', c.appliedAtTick]), 'augment clock identity');
          else if (m.mechanic === 'loneHero') check(owner.id === unit.id && units.filter(u => u.team === unit.team && u.alive).length === 1 && application === (index === 1 ? 'source' : JSON.stringify(['loneHero', index])), 'augment lone identity');
          else {
            check(!owner.alive && owner.id !== unit.id && application === JSON.stringify([m.mechanic, owner.id, index]), 'augment death identity');
            if (m.mechanic === 'climbLadder') check(shareAugmentTraits(owner,unit,traits), 'augment shared trait');
            else check(m.mechanic === 'inspiringEpitaph', 'augment death mechanic');
          }
        }
        const app=c.application;
        const kind=app.kind==='stun'?'stun':app.kind==='sunder'?'armorReduction':'resistanceFlat';
        const amount=app.modifier?.value.kind==='constant'?app.modifier.value.amount:app.magnitudeBps;
        check(legacy.kind===kind && legacy.amount===amount && legacy.contributionKeys.length===1 && legacy.activity===undefined, 'item status semantic projection');
        if (!neutralStatuses.has(c.key) && !replayedAbility) validateItemEffectConsumption(c.source,c.appliedAtTick,units,combatId);
        covered.add(key);continue;
      }
      check(c && !covered.has(key) && c.targetId === unit.id && c.source.ownerId === legacy.source.ownerId
        && c.source.sourceKind === legacy.source.sourceKind && c.source.definitionId === legacy.source.definitionId
        && c.source.instanceId === legacy.source.instanceId && c.source.parentItemInstanceId === null
        && (c.source.effectIndex === legacy.source.effectIndex * 16 || c.source.effectIndex === legacy.source.effectIndex * 16 + 1)
        && c.appliedAtTick === legacy.startsAtTick && c.expiresAtTick === legacy.expiresAtTick, 'status source/timing projection');
      const prefix = `${sourceKey(legacy.source)}:${legacy.kind}:${unit.id}:`;
      check(legacy.key.startsWith(prefix), 'status display identity');
      const suffix = legacy.key.slice(prefix.length), legacyApplication = suffix.startsWith('armor:') ? suffix.slice(6) : suffix;
      const applicationId = !legacyApplication ? (legacy.kind === 'attackSpeed' && legacy.source.definitionId === 'singed-ability' ? 'singed-speed' : 'source') : legacyApplication.startsWith('[') ? legacyApplication : JSON.stringify([...legacyApplication.split(':').map(Number), unit.id]);
      check(JSON.parse(c.key)[8] === applicationId, 'status application identity');
      const app = c.application;
      const kind = legacy.kind === 'stun' ? 'stun' : legacy.kind === 'armorReduction' ? 'sunder' : legacy.kind === 'damageReduction' ? 'damage-reduction' : legacy.amount < 0 ? 'stat-debuff' : 'stat-buff';
      check(app.kind === kind && app.onEnd === null, 'uncompiled status kind/end rewards');
      if (app.modifier) {
        const owner = units.find(u => u.id === c.source.ownerId)!;
        const firelight = owner.mechanics?.find(m => m.mechanic === 'firelight' && canonicalSource(asSource(m.source)) === canonicalSource(asSource(legacy.source)));
        const speed = legacy.kind === 'attackSpeed' && app.modifier.stat === 'attackSpeed' && app.modifier.unit === 'bps'
          && app.activation === 'immediate' && app.duration.kind === 'ticks'
          && (owner.ability.kind === 's13' && owner.ability.championId === 'singed' && c.source.sourceKind === 'ability' && c.source.definitionId === 'singed-ability'
            && app.duration.ticks === 1 && legacy.amount >= 0 && legacy.amount <= owner.ability.variables.AttackSpeed / 100
            || owner.ability.kind === 's13' && owner.ability.championId === 'jayce-ranged' && c.source.sourceKind === 'ability' && c.source.definitionId === 'jayce-ranged-ability' && app.duration.ticks === owner.ability.variables.ASDuration / 10000 * 20 && legacy.amount === owner.ability.variables.AttackSpeed
            || firelight && app.duration.ticks === firelight.values.dashTicks && legacy.amount === firelight.values.attackSpeedBps);
        check(app.modifier.value.kind === 'constant' && app.modifier.value.amount === legacy.amount
          && (speed || app.modifier.unit === 'flat' && ['armor', 'magicResist'].includes(app.modifier.stat)) && app.modifier.condition.kind === 'always' && app.modifier.damageFilter === null, 'status modifier projection');
      }
      else check(app.magnitudeBps === legacy.amount, 'status magnitude projection');
      covered.add(key);
    }
  }
  check(covered.size === contributions.length, 'uncompiled status contribution');
  const ids = new Set(units.map(u => u.id)), dead = new Set(units.filter(u => !u.alive).map(u => u.id)), taskKeys = new Set<string>();
  for (const task of state.periodicTasks) {
    validatePeriodicTask(task, ids, dead, tick, combatId);
    const burn=contributions.find(c=>c.key===task.key&&c.application.kind==='burn');
    if(burn) {
      const program={definitionId:JSON.stringify([burn.source.definitionId,burn.source.effectIndex,'burn']),selector:selfSelector({candidates:'bound-target',relation:'enemy',maxTargets:1}),targetSnapshot:'once-per-pulse',effects:[{kind:'damage',damageType:'true',delivery:'item-burn',critEligibility:'never',amount:flatAmount(0,{maxHpBps:burn.application.magnitudeBps,hpBasis:'target',sample:'each-pulse'})}]};
      check(!taskKeys.has(task.key)&&task.targetId===unit.id&&same(task.source,burn.source)&&task.periodTicks===20&&task.endsAtTick===burn.expiresAtTick&&task.finalPulse==='before-expiry'&&task.onSourceDeath==='persist-attached'&&task.onTargetDeath==='cancel'&&task.pulseLimit===null&&same(task.program,program)&&task.nextPulseAtTick===state.statuses.find(g=>g.contributions.some((c: import('./contracts').StatusContribution)=>c.key===burn.key))!.nextPulseAtTick,'item burn program');
      taskKeys.add(task.key);continue;
    }
    const definition = compiled.periodicTasks.find(t => t.key === task.key);
    check(definition && !taskKeys.has(task.key) && same({ ...task, nextPulseAtTick: definition.nextPulseAtTick, pulseOrdinal: 0, remainders: [] }, definition), 'periodic program/source binding');
    check(task.pulseOrdinal === Math.max(0,Math.floor((tick-definition!.nextPulseAtTick)/task.periodTicks)+1) && task.nextPulseAtTick === definition!.nextPulseAtTick+task.pulseOrdinal*task.periodTicks, 'periodic phase');
    for (const r of task.remainders) check(ids.has(r.targetId) && r.denominator > 0 && r.numerator > 0, 'compiled periodic account');
    taskKeys.add(task.key);
  }
  check(state.periodicTasks.filter(t=>t.onSourceDeath==='cancel').length === (!unit.alive || finished ? 0 : compiled.periodicTasks.filter(t=>t.endsAtTick===null||t.endsAtTick>tick).length), 'lost periodic tasks');
  check(contributions.filter(c=>c.application.kind==='burn').every(c=>taskKeys.has(c.key)), 'lost attached burn task');
  if (unit.alive && !finished) for (const m of unit.mechanics ?? []) if (m.mechanic === 'clockworkAccelerator') {
    const grants = contributions.filter(c => canonicalSource(c.source) === canonicalSource(asSource(m.source)));
    check(grants.length === Math.floor(tick / m.values.periodTicks), 'augment clock grant count');
  }
  if (unit.alive && !finished && tick > 0 && units.filter(u => u.team === unit.team && u.alive).length === 1)
    for (const m of unit.mechanics ?? []) if (m.mechanic === 'loneHero') {
      const grants = contributions.filter(c => canonicalSource(c.source) === canonicalSource(asSource(m.source)));
      check(grants.length === 2 && new Set(grants.map(c => c.appliedAtTick)).size === 1, 'augment lone complete grant');
    }
  if (unit.alive && !finished) for (const owner of units.filter(u => !u.alive && u.team === unit.team)) {
    if (!shareAugmentTraits(owner,unit,traits)) continue;
    for (const m of owner.mechanics ?? []) if (m.mechanic === 'climbLadder') {
      const grants = contributions.filter(c => canonicalSource(c.source) === canonicalSource(asSource(m.source)));
      check(grants.length === 4 && new Set(grants.map(c => c.appliedAtTick)).size === 1, 'augment climb complete death grant');
    }
  }
  for (const layer of unit.shieldLayers ?? []) {
    check(layer.m8State && layer.m8Grant, 'missing frozen shield record/declaration');
    const shield = layer.m8State, grant = layer.m8Grant;
    validateShield(shield, tick, combatId);
    check(shield.targetId === unit.id && same(shield.source, asSource(layer.source))
      && layer.key === (shield.source.parentItemInstanceId === null ? sourceKey(layer.source) : shield.key)
      && shield.granted === layer.granted && shield.remaining === layer.remaining && shield.absorbed === layer.absorbed
      && shield.expiresAtTick === layer.expiresAtTick && typeof shield.endRewardConsumed === 'boolean', 'shield projection');
    if (shield.source.sourceKind === 'augment') {
      const owner = units.find(u => u.id === shield.source.ownerId);
      const m = owner?.mechanics?.find(m => m.mechanic === 'inspiringEpitaph' && canonicalSource(asSource(m.source)) === canonicalSource(shield.source));
      if (m) {
        check(owner && !owner.alive && owner.team === unit.team && owner.id !== unit.id && shield.startsAtTick > 0 && shield.startsAtTick <= tick, 'augment shield death source');
        check(same(grant, augmentCombatEffects(m, shield.startsAtTick)[0]) && shield.expiresAtTick === MAX_COMBAT_TICKS + 1 && shield.decay.kind === 'none', 'augment shield declaration');
        const speed = contributions.find(c => canonicalSource(c.source) === canonicalSource(shield.source) && JSON.parse(c.key)[8] === JSON.stringify(['inspiringEpitaph', owner.id, 1]));
        check(speed && speed.appliedAtTick === shield.startsAtTick, 'augment shield receipt');
        const reave = (unit.g22?.reaveUntilTick ?? 0) > shield.startsAtTick ? unit.g22!.reaveBps : 0;
        check([...maxHpCandidates(unit,shield.startsAtTick,combatId)].some(hp => shield.granted === Math.floor(Math.floor(Math.floor(hp * m.values.shieldMaxHpBps / 10000) * (10000 - reave) / 10000) * overtimeReceivedBps(shield.startsAtTick) / 10000)), 'augment shield amount');
        check(shield.remaining > 0 && !shield.endRewardConsumed && layer.endedReason === undefined, 'augment shield lifecycle');
        continue;
      }
    }
    const declared=(['item','trait','anomaly'].includes(shield.source.sourceKind)||shield.source.sourceKind==='augment'&&shield.source.definitionId==='defense-call')?units.filter(u=>u.id===shield.source.ownerId).flatMap(u=>declaredEffects(u,combatId)).find(d=>canonicalSource(d.source)===canonicalSource(shield.source)&&d.effect.kind==='grant-shield'):undefined;
    if(declared) {
      check(same(declared.effect,grant), 'declared shield grant');
      validateItemEffectConsumption(shield.source,shield.startsAtTick,units,combatId);
      const holder=units.find(u=>u.id===shield.source.ownerId)!;
      const pulse=holder.mechanismState?.periodicTasks.find(t=>canonicalSource(t.source)===canonicalSource(shield.source)&&t.nextPulseAtTick-t.periodTicks===shield.startsAtTick);
      const remainder=pulse?.remainders.find(r=>r.targetId===unit.id&&r.effectIndex===0);
      const reave=(unit.g22?.reaveUntilTick??0)>shield.startsAtTick?unit.g22!.reaveBps:0;
      // Resist grants get structural checks here and exact trusted-input replay in restoreMatch.
      // Current or opening defenses cannot authenticate the historical live sample.
      check(shield.decay.kind===grant.decay.kind && (grant.amount.resistsBps ? Number.isSafeInteger(shield.granted) && shield.granted >= 0 : [...maxHpCandidates(holder,shield.startsAtTick,combatId)].some(hp=>{
        const numerator=grant.amount.flat*10000+hp*grant.amount.maxHpBps;
        const previous=remainder?((remainder.numerator-numerator%10000+10000)%10000):0;
        return shield.granted===Math.floor(Math.floor(Math.floor((numerator+previous)/10000)*(10000-reave)/10000)*overtimeReceivedBps(shield.startsAtTick)/10000);
      })), 'declared shield sampled amount');
      check(shield.remaining>0&&layer.endedReason===undefined&&!shield.endRewardConsumed&&!units.some(u=>u.tasks?.some(t=>t.shieldEndKey===layer.key)), 'item shield active lifecycle');
      continue;
    }
    check(grant.kind === 'grant-shield' && grant.durationTicks > 0 && grant.amount.sample === 'application'
      && grant.amount.flat >= 0 && grant.amount.attackDamageBps === 0 && grant.amount.abilityPowerBps === 0 && grant.amount.maxHpBps === 0
      && (grant.amount.resistsBps ?? 0) === 0 && grant.amount.missingHpBps === 0 && grant.amount.actualManaSpentBps === 0 && grant.amount.actualDamageBps === 0
      && grant.amount.shieldAbsorbedBps === 0 && grant.amount.cap === null && grant.amount.hpBasis === 'holder'
      , 'uncompiled shield grant');
    integer(grant.durationTicks, 1); integer(grant.amount.flat);
    const owner = units.find(u => u.id === shield.source.ownerId)!;
    if (shield.decay.kind === 'linear-initial-grant') {
      check(owner.ability.kind === 's13' && Object.hasOwn(owner.ability.variables, 'PercentShieldDamage') && grant.endTiming === 'next-action-planning' && grant.decay.kind === 'linear-initial-grant'
        && same(grant.onEnd, ['depleted', 'expired']) && grant.endEffects.length === 1, 'decaying shield end binding');
      const end = grant.endEffects[0];
      check(end.kind === 'damage' && end.damageType === 'magic' && end.delivery === 'ability-direct' && end.critEligibility === 'requires-spell-authorization'
        && end.amount.shieldAbsorbedBps === owner.ability.variables.PercentShieldDamage && end.amount.sample === 'packet'
        && end.amount.attackDamageBps === 0 && end.amount.abilityPowerBps === 0 && end.amount.maxHpBps === 0 && end.amount.missingHpBps === 0
        && end.amount.actualManaSpentBps === 0 && end.amount.actualDamageBps === 0 && end.amount.cap === null && end.amount.hpBasis === 'holder', 'shield end amount binding');
      const apAtGrant = (owner.abilityPower ?? 100) + (owner.mechanics ?? []).filter(m => m.mechanic === 'archangel').reduce((n, m) => n + Math.floor(shield.startsAtTick / m.values.periodTicks) * m.values.abilityPower, 0);
      check(end.amount.flat === Math.floor(apAtGrant * owner.ability.variables.StrikeBaseDamage / 1000000) || [...abilityPowerCandidates(owner,shield.startsAtTick,combatId)].some(ap=>end.amount.flat===Math.floor(ap*(owner.ability.kind==='s13'?owner.ability.variables.StrikeBaseDamage:0)/1000000)), 'shield end sampled damage');
      check(grant.endTargeting.kind === 'select' && same(grant.endTargeting.selector, { primary: 'normal', candidates: 'board', relation: 'enemy', anchor: 'holder', radius: 1, maxTargets: 100, excludeSelf: true, excludePrimary: false, distinct: true, order: 'id', sample: 'action-completion' }), 'shield end targeting binding');
    } else check(grant.endTiming === 'post-damage' && grant.decay.kind === 'none' && grant.onEnd.length === 0 && grant.endEffects.length === 0
      && same(grant.endTargeting, { kind: 'fixed', targetIds: [unit.id], ifMissing: 'skip' }), 'ordinary shield end binding');
    const pendingEnds = units.flatMap(u => u.tasks ?? []).filter(t => t.shieldEndKey === layer.key && t.source.ownerId === shield.source.ownerId);
    check(shield.remaining === 0 || layer.endedReason === undefined && !shield.endRewardConsumed, 'active shield consumption/reason');
    if (shield.remaining === 0) check(layer.endedReason !== undefined || shield.granted === 0 && !shield.endRewardConsumed, 'missing shield end reason');
    if (shield.endRewardConsumed) check(pendingEnds.length === 0, 'consumed shield has pending end task');
    else if (grant.endTiming === 'next-action-planning') check(pendingEnds.length === 1
      && pendingEnds[0].executeAtTick > tick && same(asSource(pendingEnds[0].source), shield.source), 'missing/foreign shield end task');
    else check(pendingEnds.length === 0, 'unexpected shield end task');
    if (layer.endedReason !== undefined) check(['depleted','expired','replaced','death-cleanup','combat-end'].includes(layer.endedReason) && shield.remaining === 0, 'shield end reason');
  }
  const activityKeys = new Set<string>();
  for (const a of state.activities) {
    validateIdentity(a, combatId); integer(a.actionSeq); integer(a.startsAtTick); integer(a.expiresAtTick, 1);
    check(!activityKeys.has(a.key) && a.targetId === unit.id && a.source.ownerId === unit.id && a.source.sourceKind === 'ability'
      && a.source.definitionId === unit.ability.id && a.source.instanceId === unit.id && a.source.effectIndex === 0 && a.source.parentItemInstanceId === null
      && a.actionSeq < nextActionSeq && a.startsAtTick <= tick && a.expiresAtTick > a.startsAtTick, 'activity identity/time');
    activityKeys.add(a.key);
    check(a.kind === 'channel' || a.kind === 'redirect', 'activity kind');
    if (a.kind === 'channel') check(same(a.blocks, ['move','attack','cast']) && a.cancelOnControl === true, 'channel declaration');
    else check(a.allyRadius === 1 && a.shareBps >= 0 && a.shareBps <= 10000 && a.choose === 'lowest-id' && a.repeatMitigation === false && a.recursive === false, 'redirect declaration');
    if (a.lifecycle === 'active') check(unit.alive && !finished && a.expiresAtTick > tick && a.endedAtTick === null && a.endReason === null
      && (unit.statuses ?? []).some(s => s.activity?.key === a.key && same(s.activity, a) && s.startsAtTick === a.startsAtTick && s.expiresAtTick === a.expiresAtTick && s.kind === a.kind && (a.kind !== 'redirect' || s.amount === a.shareBps)), 'active activity projection');
    else { check(a.lifecycle === 'ended', 'activity lifecycle'); integer(a.endedAtTick); check(a.endedAtTick <= tick && a.endedAtTick >= a.startsAtTick
      && ['expired','control-cancelled','replaced','death-cleanup','combat-end'].includes(a.endReason)
      && (a.endReason !== 'expired' || a.endedAtTick === a.expiresAtTick) && (a.kind !== 'redirect' || a.endReason !== 'control-cancelled'), 'ended activity receipt'); }
  }
  for (const legacy of unit.statuses ?? []) if (legacy.activity) check(state.activities.some(a => a.key === legacy.activity!.key && a.lifecycle === 'active'), 'foreign activity projection');
  if (!unit.alive || finished) check(state.statuses.length === 0 && (unit.statuses ?? []).length === 0 && (unit.shieldLayers ?? []).length === 0, 'mechanism cleanup');
}
