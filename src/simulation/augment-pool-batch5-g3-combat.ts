import { hexDistance } from './board';
import type { HexCell } from './board';
import type { AbilityContext } from './combat-s13-abilities';
import { ad, ap, type S13Unit } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';

/** Called immediately after a movement event, before changing the cell or planning the next action. */
export function recordAerialMovement(ctx: AbilityContext, unit: S13Unit, to: HexCell, from: HexCell = unit.cell): void {
  grow(ctx, unit, hexDistance(from, to), false);
}

/** A blocked dash still starts; its fixed reward is independent of distance. */
export function startAerialDash(ctx: AbilityContext, unit: S13Unit): void { grow(ctx, unit, 0, true); }

function grow(ctx: AbilityContext, unit: S13Unit, distance: number, dash: boolean): void {
  const mechanic = unit.mechanics?.find(m => m.mechanic === 'aerialWarfare');
  if (!mechanic || !unit.alive || unit.hp <= 0) return;
  const old = unit.aerialWarfare ?? { hexes: 0, dashes: 0 };
  const next = { hexes: Math.min(mechanic.values.maxHexes, old.hexes + distance), dashes: old.dashes + (dash ? 1 : 0) };
  if (next.hexes === old.hexes && next.dashes === old.dashes) return;
  const beforeAd = ad(unit), beforeAp = ap(unit, ctx.tick, ctx.units);
  unit.aerialWarfare = next;
  ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: unit.id, source: asSource(mechanic.source), stat: 'attackDamage', before: beforeAd, after: ad(unit) },
    { type: 'statChanged', tick: ctx.tick, unitId: unit.id, source: asSource(mechanic.source), stat: 'abilityPower', before: beforeAp, after: ap(unit, ctx.tick, ctx.units) });
}
