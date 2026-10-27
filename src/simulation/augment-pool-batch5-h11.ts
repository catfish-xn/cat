import { hexDistance } from './board';
import { G24_CHEST_PAYLOADS, G24_CHEST_POOL } from './content/g2-4-chest-pool';
import { uniformIndex } from './m8/equipment';
import type { AbilityContext } from './combat-s13-abilities';
import type { CombatState } from './combat-types';
import { compareText } from './combat-s13-state';
import { grantCombatItemDefinition } from './m8/combat-item-grants';
import { asSource } from './m8/s13-definitions';
import { isAugmentOrdinaryHero, readAugmentFirstHeroDeaths, readAugmentCombatEquipment } from './augment-pool-batch5-h11-history';

/** The existing ordinary mid-combat pool (G24-CHEST-01), equal-weight draws.
 * Grants occupy a slot for H11 even though their programs use the existing
 * combat-only receipt, never permanent ItemInstances. */
export function settleH11Deaths(ctx: AbilityContext, before: CombatState): void {
  if (!ctx.units.some(u => u.mechanics?.some(m => m.mechanic === 'scavenger'))) return;
  const deaths = readAugmentFirstHeroDeaths(before, ctx.events);
  const counts = { player: 0, enemy: 0 };
  const holders = (['player', 'enemy'] as const).map(team => before.units.filter(u => u.team === team && isAugmentOrdinaryHero(u))
    .sort((a, b) => compareText(a.id, b.id)).find(u => u.mechanics?.some(m => m.mechanic === 'scavenger')));
  // The outer loop is the full death-event order, including interleaved deaths
  // when both sides hold Scavenger; team iteration must not reorder RNG draws.
  for (const death of deaths) {
    const team = death.team === 'player' ? 'enemy' : 'player';
    const holder = holders.find(u => u?.team === team);
    const mechanic = holder?.mechanics?.find(m => m.mechanic === 'scavenger');
    const ordinal = counts[team]++;
    if (!mechanic || ordinal >= mechanic.values.numDeaths || !death.current) continue;
    const targets = ctx.units.filter(u => u.team === team && u.alive && u.hp > 0 && isAugmentOrdinaryHero(u)
      && (u.equipment?.length ?? 0) + (u.combatItemGrants?.length ?? 0) < 3).sort((a, b) => compareText(a.id, b.id));
    // No receiver consumes the death opportunity, but no random words.
    if (!targets.length) continue;
    const item = G24_CHEST_POOL[uniformIndex(G24_CHEST_POOL.length, ctx.draw)];
    const target = targets[uniformIndex(targets.length, ctx.draw)];
    grantCombatItemDefinition(ctx, asSource(mechanic.source), target, 0, item.definitionId);
  }
}

/** Freeze all eligible recipients and donors before applying any item. Donors
 * need three permanent ordinary completed instances, never rolled glove children,
 * Scrap conversions, radiant/support/artifact equipment or another copied grant. */
export function openingH11(ctx: AbilityContext, before: CombatState): void {
  if (ctx.tick !== 0 || before.startEffectsApplied) return;
  const roster = readAugmentCombatEquipment(before);
  const plans: { source: import('./m8/contracts').Source; target: import('./combat-s13-state').S13Unit; definitionId: string }[] = [];
  for (const team of ['player', 'enemy'] as const) {
    const allies = roster.filter(u => u.team === team).sort((a, b) => compareText(a.id, b.id));
    const holder = allies.map(u => ctx.units.find(x => x.id === u.id)!).find(u => u.mechanics?.some(m => m.mechanic === 'sponging'));
    const mechanic = holder?.mechanics?.find(m => m.mechanic === 'sponging');
    if (!mechanic) continue;
    const donors = allies.filter(u => u.equipment.length === 3 && u.equipment.every(i => Object.hasOwn(G24_CHEST_PAYLOADS, i.definitionId)));
    const recipients = allies.filter(u => {
      const target = ctx.units.find(x => x.id === u.id)!;
      return u.equipment.length <= mechanic.values.maxItems && target.alive && target.hp > 0
        && (target.equipment?.length ?? 0) + (target.combatItemGrants?.length ?? 0) < 3;
    }).slice(0, mechanic.values.maxUnits);
    for (const recipient of recipients) {
      const target = ctx.units.find(u => u.id === recipient.id)!;
      const donor = donors.filter(u => u.id !== recipient.id).sort((a, b) => hexDistance(recipient.cell, a.cell) - hexDistance(recipient.cell, b.cell) || compareText(a.id, b.id))[0];
      if (!donor) continue;
      const items = [...donor.equipment].sort((a, b) => a.slot - b.slot);
      plans.push({ source: asSource(mechanic.source), target, definitionId: items[uniformIndex(items.length, ctx.draw)].definitionId });
    }
  }
  for (const plan of plans) grantCombatItemDefinition(ctx, plan.source, plan.target, 0, plan.definitionId);
}
