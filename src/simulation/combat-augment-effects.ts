import { isTraitSnapshotMember } from './traits/effective-membership';
import type { TraitSnapshot } from './strategy-types';
import { isAttackProxy } from './anomalies/availability';
/** Combat-only augment effects. Every grant is a frozen, serializable contribution. */
import type { CombatMechanic } from './combat-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import { byDistance, interval, type S13Unit } from './combat-s13-state';
import { M5_UNIT_DEFINITIONS } from './units';
import { modifier, stat, status, shield } from './content/item-programs';
import type { Effect } from './m8/contracts';
import { asSource } from './m8/s13-definitions';
import { effectIdentity } from './m8/identity';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { startingRows } from './m8/targeting';

/** Shared declarations also let restore validate exact source coefficients. */
export function augmentCombatEffects(m: CombatMechanic, tick = 0): readonly Effect[] {
  const v = m.values;
  const independent = (effect: Effect): Effect => effect.kind === 'modify-stat'
    ? { ...effect, stackPolicy: { kind: 'independent-instances' } } : effect;
  switch (m.mechanic) {
    case 'clockworkAccelerator': return [independent(stat(modifier('attackSpeed', v.attackSpeedBps, 'bps')))];
    case 'loneHero': {
      const durability = status('damage-reduction', v.durabilityBps, 1, { activation: 'immediate' }) as Extract<Effect, {kind:'apply-status'}>;
      return [stat(modifier('attackSpeed', v.attackSpeedBps, 'bps')), { ...durability, status: { ...durability.status, duration: { kind: 'combat' } } }];
    }
    case 'climbLadder': return [stat(modifier('attackDamage', v.adBps, 'bps')), stat(modifier('abilityPower', v.abilityPower)),
      stat(modifier('armor', v.armor)), stat(modifier('magicResist', v.magicResist))].map(independent);
    case 'inspiringEpitaph': {
      const protection = shield(v.shieldMaxHpBps, MAX_COMBAT_TICKS + 1 - tick) as Extract<Effect, {kind:'grant-shield'}>;
      return [{ ...protection, amount: { ...protection.amount, hpBasis: 'target' } }, independent(stat(modifier('attackSpeed', v.attackSpeedBps, 'bps')))];
    }
    case 'blazingSoul': return [stat(modifier('abilityPower', v.abilityPower), v.periodTicks), stat(modifier('attackSpeed', v.attackSpeedBps, 'bps'), v.periodTicks)].map(independent);
    case 'corrosion': return [independent(stat(modifier('armor', -v.resistLoss))), independent(stat(modifier('magicResist', -v.resistLoss)))];
    default: return [];
  }
}
function grant(ctx: AbilityContext, holder: S13Unit, target: S13Unit, m: CombatMechanic, effect: Effect, applicationId: string): void {
  const source = asSource(m.source);
  const key = effectIdentity(ctx.combatId ?? 'standalone', source, target.id,
    effect.kind === 'apply-status' ? 'source' : applicationId).key;
  if (effect.kind === 'grant-shield' && target.shieldLayers.some(layer => layer.source.ownerId === source.ownerId && layer.source.instanceId === source.instanceId && layer.source.effectIndex === source.effectIndex)) return;
  if (target.mechanismState?.statuses.some(g => g.contributions.some(c => c.key === key))) return;
  executeMechanismEffect(ctx, holder, source, target, effect, 0, 0, undefined, undefined, undefined, undefined,
    { area: false, triggeringCastActionSeq: null, applicationId });
}
/** Tick gates derive from the combat clock, with no cross-call counters or caches. */
export function advanceAugmentCombat(ctx: AbilityContext): void {
  for (const unit of ctx.units) {
    if (!unit.alive || unit.hp <= 0) continue;
    for (const m of unit.mechanics ?? []) {
      if (m.mechanic === 'clockworkAccelerator' && ctx.tick > 0 && ctx.tick % m.values.periodTicks === 0)
        grant(ctx, unit, unit, m, augmentCombatEffects(m)[0], JSON.stringify(['clockwork', ctx.tick]));
      if (m.mechanic === 'loneHero' && ctx.units.filter(u => u.team === unit.team && u.alive && u.hp > 0 && !isAttackProxy(u)).length === 1)
        augmentCombatEffects(m).forEach((effect, index) => grant(ctx, unit, unit, m, effect, JSON.stringify(['loneHero', index])));
    }
  }
  advanceCorrosion(ctx);
  advanceBlazingSoul(ctx);
}
const byId = (a: S13Unit, b: S13Unit) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
/** Blazing Soul (P 2026-10-24): from the first combat tick and every TransferDuration, a TransferDuration-long buff goes
 * to the live ally with the highest attack speed (shortest interval, then id), excluding the previous recipient.
 * The first live owner by id applies it; the recipient is recorded on every owner, so the handoff survives a death. */
function advanceBlazingSoul(ctx: AbilityContext): void {
  for (const team of ['player', 'enemy'] as const) {
    const allies = ctx.units.filter(u => u.team === team && u.alive && u.hp > 0 && !isAttackProxy(u));
    const owners = ctx.units.filter(u => u.team === team && u.mechanics?.some(m => m.mechanic === 'blazingSoul'));
    const holder = owners.filter(u => u.alive && u.hp > 0).sort(byId)[0], m = holder?.mechanics!.find(m => m.mechanic === 'blazingSoul');
    if (!holder || !m || ctx.tick < 1 || (ctx.tick - 1) % m.values.periodTicks !== 0) continue;
    const last = holder.batch2?.blazingLast;
    const [target] = allies.filter(u => u.id !== last).sort((a, b) => interval(a, ctx.tick, ctx.units) - interval(b, ctx.tick, ctx.units) || byId(a, b));
    if (!target) continue;
    augmentCombatEffects(m).forEach((effect, index) => grant(ctx, holder, target, m, effect, JSON.stringify(['blazingSoul', ctx.tick, index])));
    for (const owner of owners) owner.batch2 = { ...owner.batch2, blazingLast: target.id };
  }
}
/** Corrosion is one team-wide clock: the first live holder (by id) applies each pulse once to every live enemy
 * that started the combat in its own front two rows (P 2026-10-24: the board's row helper samples starting rows). */
function advanceCorrosion(ctx: AbilityContext): void {
  for (const team of ['player', 'enemy'] as const) {
    const holder = ctx.units.filter(u => u.team === team && u.alive && u.hp > 0 && u.mechanics?.some(m => m.mechanic === 'corrosion'))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
    const m = holder?.mechanics!.find(m => m.mechanic === 'corrosion');
    if (!holder || !m || ctx.tick <= 0 || ctx.tick % m.values.periodTicks !== 0) continue;
    for (const enemy of ctx.units.filter(u => u.team !== team && u.alive && u.hp > 0 && startingRows(u.team, u.startingCell?.row ?? u.cell.row) === 'front-two'))
      augmentCombatEffects(m).forEach((effect, index) => grant(ctx, holder, enemy, m, effect, JSON.stringify(['corrosion', ctx.tick, index])));
  }
}
/** The opening strategy, including inactive rows, owns runtime membership.
 * Plain standalone callers without a strategy retain native eligibility. */
export function shareAugmentTraits(a: Pick<S13Unit,'id'|'definitionId'|'team'>,
  b: Pick<S13Unit,'id'|'definitionId'|'team'>, traits?: readonly TraitSnapshot[]): boolean {
  return traits !== undefined ? traits.some(t => isTraitSnapshotMember(t,a) && isTraitSnapshotMember(t,b))
    : (M5_UNIT_DEFINITIONS[a.definitionId]?.traits ?? []).some(t => (M5_UNIT_DEFINITIONS[b.definitionId]?.traits ?? []).includes(t));
}
/** All deaths settle first: a simultaneously dying unit cannot receive a reward. */
export function settleAugmentDeaths(ctx: AbilityContext, dead: readonly S13Unit[], traits?: readonly TraitSnapshot[]): void {
  for (const fallen of [...dead].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    const survivors = ctx.units.filter(u => u.team === fallen.team && u.alive && u.hp > 0 && !isAttackProxy(u));
    for (const m of fallen.mechanics ?? []) {
      if (m.mechanic === 'climbLadder') {
        for (const survivor of survivors) if (shareAugmentTraits(fallen,survivor,traits))
          augmentCombatEffects(m).forEach((effect, index) => grant(ctx, fallen, survivor, m, effect, JSON.stringify(['climbLadder', fallen.id, index])));
      }
      if (m.mechanic === 'inspiringEpitaph') {
        const recipient = byDistance(fallen, survivors)[0];
        if (recipient) augmentCombatEffects(m, ctx.tick).forEach((effect, index) => grant(ctx, fallen, recipient, m, effect, JSON.stringify(['inspiringEpitaph', fallen.id, index])));
      }
    }
  }
  settleNobleSacrifice(ctx, dead);
  // Lone Hero becomes visible at the death boundary, before next-tick actions.
  for (const unit of ctx.units) if (unit.alive && unit.hp > 0 && ctx.units.filter(u => u.team === unit.team && u.alive && u.hp > 0 && !isAttackProxy(u)).length === 1)
    for (const m of unit.mechanics ?? []) if (m.mechanic === 'loneHero')
      augmentCombatEffects(m).forEach((effect, index) => grant(ctx, unit, unit, m, effect, JSON.stringify(['loneHero', index])));
}

/** Noble Sacrifice (P 2026-10-24): the team's first champion death of the combat (the lowest id among simultaneous
 * deaths) gives every surviving ally BaseResists + SharePerc of that champion's opening armor and magic resist. */
function settleNobleSacrifice(ctx: AbilityContext, dead: readonly S13Unit[]): void {
  for (const team of ['player', 'enemy'] as const) {
    const owners = ctx.units.filter(u => u.team === team && u.mechanics?.some(m => m.mechanic === 'nobleSacrifice'));
    const fallen = dead.filter(u => u.team === team && !isAttackProxy(u)).sort(byId)[0];
    if (!owners.length || !fallen || owners.some(u => u.batch2?.nobleSpent)) continue;
    for (const owner of owners) owner.batch2 = { ...owner.batch2, nobleSpent: true };
    const holder = owners.filter(u => u.alive && u.hp > 0).sort(byId)[0] ?? owners.sort(byId)[0];
    const m = holder.mechanics!.find(m => m.mechanic === 'nobleSacrifice')!, v = m.values;
    const effects = [stat(modifier('armor', v.baseResists + Math.floor(fallen.armor * v.shareBps / 10000))), stat(modifier('magicResist', v.baseResists + Math.floor(fallen.magicResist * v.shareBps / 10000)))];
    for (const survivor of ctx.units.filter(u => u.team === team && u.alive && u.hp > 0 && !isAttackProxy(u)))
      effects.forEach((effect, index) => grant(ctx, holder, survivor, m, { ...effect, stackPolicy: { kind: 'independent-instances' } }, JSON.stringify(['nobleSacrifice', fallen.id, index])));
  }
}
