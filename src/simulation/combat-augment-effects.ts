/** Combat-only augment effects. Every grant is a frozen, serializable contribution. */
import type { CombatMechanic } from './combat-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import { byDistance, type S13Unit } from './combat-s13-state';
import { M5_UNIT_DEFINITIONS } from './units';
import { modifier, stat, status, shield } from './content/item-programs';
import type { Effect } from './m8/contracts';
import { asSource } from './m8/s13-definitions';
import { effectIdentity } from './m8/identity';
import { executeMechanismEffect } from './m8/s13-mechanisms';

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
      if (m.mechanic === 'loneHero' && ctx.units.filter(u => u.team === unit.team && u.alive && u.hp > 0).length === 1)
        augmentCombatEffects(m).forEach((effect, index) => grant(ctx, unit, unit, m, effect, JSON.stringify(['loneHero', index])));
    }
  }
}
/** All deaths settle first: a simultaneously dying unit cannot receive a reward. */
export function settleAugmentDeaths(ctx: AbilityContext, dead: readonly S13Unit[]): void {
  for (const fallen of [...dead].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    const survivors = ctx.units.filter(u => u.team === fallen.team && u.alive && u.hp > 0);
    for (const m of fallen.mechanics ?? []) {
      if (m.mechanic === 'climbLadder') {
        const traits = M5_UNIT_DEFINITIONS[fallen.definitionId]?.traits ?? [];
        for (const survivor of survivors) if ((M5_UNIT_DEFINITIONS[survivor.definitionId]?.traits ?? []).some(t => traits.includes(t)))
          augmentCombatEffects(m).forEach((effect, index) => grant(ctx, fallen, survivor, m, effect, JSON.stringify(['climbLadder', fallen.id, index])));
      }
      if (m.mechanic === 'inspiringEpitaph') {
        const recipient = byDistance(fallen, survivors)[0];
        if (recipient) augmentCombatEffects(m, ctx.tick).forEach((effect, index) => grant(ctx, fallen, recipient, m, effect, JSON.stringify(['inspiringEpitaph', fallen.id, index])));
      }
    }
  }
  // Lone Hero becomes visible at the death boundary, before next-tick actions.
  for (const unit of ctx.units) if (unit.alive && unit.hp > 0 && ctx.units.filter(u => u.team === unit.team && u.alive && u.hp > 0).length === 1)
    for (const m of unit.mechanics ?? []) if (m.mechanic === 'loneHero')
      augmentCombatEffects(m).forEach((effect, index) => grant(ctx, unit, unit, m, effect, JSON.stringify(['loneHero', index])));
}
