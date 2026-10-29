import type { AbilityContext } from './combat-s13-abilities';
import type { S13Unit } from './combat-s13-state';
import { ad, ap } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import { scaleItemSummonHp } from './g2-4b-summons';
import { addGhostFriends, EMPTY_GHOST_GROWTH, ghostFriendsChampion, ghostFriendsReward, ghostFriendsRole } from './augment-pool-batch5-g2';
import { sampleAugmentDeath } from './augment-death-samples';
import type { CombatEvent, CombatUnit } from './combat-types';

/** Mid-combat births are future allies too. Trench/Mirror already encode the donor's current
 * HP in their opening basis; carry the team counters without adding that health twice. */
export function inheritGhostFriendsBirth(ctx: AbilityContext, born: readonly CombatUnit[]): void {
  for (const unit of born as S13Unit[]) {
    if (unit.ghostFriends) continue;
    const donor = ctx.units.find(u => u.id !== unit.id && u.team === unit.team && u.ghostFriends);
    if (!donor?.ghostFriends) continue;
    unit.ghostFriends = {...donor.ghostFriends};
    if (!unit.ghostFriends.healthFlat || unit.itemSummon?.kind === 'trench' || unit.itemSummon?.kind === 'mirror') continue;
    const basis = unit.maxHpBasis ?? {base: unit.maxHp, flat: 0, bps: 0, bonusBps: 0};
    const before = unit.maxHp;
    unit.maxHpBasis = {...basis, flat: basis.flat + unit.ghostFriends.healthFlat};
    const next = unit.maxHpBasis;
    unit.maxHp = scaleItemSummonHp(unit, Math.floor((next.base + next.flat) * (10000 + next.bps + next.bonusBps) / 10000));
    unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp - before);
  }
}

/** Some existing revives replace lethal HP before ordinary death cleanup. Preserve that first
 * champion death for these augments, with its real pre-revival equipment/form sample. */
export function observeBatch5RevivalDeaths(ctx: AbilityContext, revive: () => void): void {
  const lethal = ctx.units.filter(u => u.alive && u.hp === 0 && ghostFriendsChampion(u)
    && ctx.units.some(a => a.team === u.team && a.mechanics?.some(m => m.mechanic === 'ghostFriends' || m.mechanic === 'rebelResurgence')));
  if (!lethal.length) { revive(); return; }
  const samples = new Map(lethal.map(u => [u.id, sampleAugmentDeath<CombatEvent>({type: 'death', tick: ctx.tick, unitId: u.id}, u)]));
  const start = ctx.events.length;
  revive();
  for (let i = start; i < ctx.events.length; i++) {
    const event = ctx.events[i];
    if (event.type !== 'unitRevived') continue;
    const death = samples.get(event.unitId);
    if (!death) continue;
    ctx.events.splice(i, 0, death); samples.delete(event.unitId); i++;
  }
}

/** Consume actual death events once at the death barrier, including later deaths of a revived identity.
 * Dead allies retain the counters too, so a future revival receives the team's complete earned bonus. */
export function settleGhostFriendsDeaths(ctx: AbilityContext, dead: readonly S13Unit[]): void {
  for (const fallen of dead) {
    if (!ghostFriendsChampion(fallen)) continue;
    const owner = ctx.units.find(u => u.team === fallen.team && u.mechanics?.some(m => m.mechanic === 'ghostFriends'));
    const source = owner?.mechanics?.find(m => m.mechanic === 'ghostFriends')?.source;
    if (!source) continue;
    const reward = ghostFriendsReward(ghostFriendsRole(fallen.definitionId, fallen.form));
    for (const ally of ctx.units.filter(u => u.team === fallen.team)) {
      const beforeAd = ad(ally), beforeAp = ap(ally, ctx.tick, ctx.units);
      ally.ghostFriends = addGhostFriends(ally.ghostFriends ?? EMPTY_GHOST_GROWTH, reward);
      if (reward.healthFlat) {
        const basis = ally.maxHpBasis ?? { base: ally.maxHp, flat: 0, bps: 0, bonusBps: 0 };
        const updated = { ...basis, flat: basis.flat + reward.healthFlat };
        const beforeMax = ally.maxHp, beforeHp = ally.hp;
        ally.maxHpBasis = updated;
        ally.maxHp = scaleItemSummonHp(ally, Math.floor((updated.base + updated.flat) * (10000 + updated.bps + updated.bonusBps) / 10000));
        if (ally.alive && ally.hp > 0) ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp - beforeMax);
        ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: ally.id, source: asSource(source), beforeMax, afterMax: ally.maxHp, beforeHp, afterHp: ally.hp, countsAsHeal: false });
      }
      if (reward.attackDamageBps) ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: ally.id, source: asSource(source), stat: 'attackDamage', before: beforeAd, after: ad(ally) });
      if (reward.abilityPower) ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: ally.id, source: asSource(source), stat: 'abilityPower', before: beforeAp, after: ap(ally, ctx.tick, ctx.units) });
    }
  }
}
