import type { AbilityContext } from './combat-s13-abilities';
import { ad, constantModifier, hpSample, type S13Unit } from './combat-s13-state';
import { familyCombatBase } from './family-reunion';
import { resolveEffects } from './effects';
import { resolveStat } from './m8/stats';
import { scaleItemSummonHp } from './g2-4b-summons';

/** Run after survival/revival and death cleanup, using the full roster (including banished allies). */
export function settleFamilyReunionDeaths(ctx: AbilityContext, roster: readonly S13Unit[]): void {
  for (const team of ['player', 'enemy'] as const) {
    const members = roster.filter(u => u.team === team && u.familyReunion);
    if (!members.some(u => !u.alive && u.hp === 0) || members.some(u => u.familyReunion!.downgradedAtTick !== undefined)) continue;
    for (const u of members) {
      const reunion = u.familyReunion!;
      u.familyReunion = { ...reunion, downgradedAtTick: ctx.tick };
      if (!u.alive || u.hp <= 0) continue;
      const star = reunion.unboostedStarLevel;
      const boosted = familyCombatBase(u, reunion.combatStarLevel), restored = familyCombatBase(u, star);
      const beforeMax = u.maxHp, beforeHp = u.hp, beforeAd = ad(u);
      const basis = { ...u.maxHpBasis!, base: restored.base.health };
      u.maxHpBasis = basis;
      u.maxHp = scaleItemSummonHp(u, resolveStat('maxHp', basis.base,
        [constantModifier('maxHp', basis.flat), constantModifier('maxHp', basis.bps + basis.bonusBps, 'bps')], { holder: hpSample(u) }));
      u.hp = Math.max(1, Number(BigInt(beforeHp) * BigInt(u.maxHp) / BigInt(beforeMax)));
      u.attackDamageBase = (u.attackDamageBase ?? u.attackDamage) + restored.base.attack - boosted.base.attack;
      u.attackDamage = resolveStat('attackDamage', u.attackDamageBase,
        [constantModifier('attackDamage', u.attackDamagePercentBps ?? 0, 'bps')], { holder: hpSample(u) });
      u.ability = resolveEffects(restored.base, restored.ability, u.sources ?? []).ability;
      u.effectiveStarLevel = star;
      const source = { ownerId: u.id, sourceKind: 'trait' as const, definitionId: 'family', instanceId: 'family-reunion', effectIndex: 0, parentItemInstanceId: null };
      ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: u.id, source, beforeMax, afterMax: u.maxHp, beforeHp, afterHp: u.hp, countsAsHeal: false });
      ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: u.id, source, stat: 'attackDamage', before: beforeAd, after: ad(u) });
    }
  }
}
