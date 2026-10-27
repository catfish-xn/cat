import { AUGMENT_BATCH5_R4 } from './content/augment-pool-batch5-r4';
import type { CombatStrategyInputs } from './combat-input';
import type { Effect } from './strategy-types';
import type { Unit } from './unit-types';
import type { HexCell } from './board';
import { getNeighbors, hexDistance, sameCell } from './board';
import type { AbilityContext } from './combat-s13-abilities';
import { ap, attackSpeedBonus, byDistance, enemies, origin, statusModifiers, type S13Unit } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import type { VampRate } from './m8/heal';
import { overtimeMoveBonusBps } from './combat-overtime';
import { safeNumber } from './m8/stats';

const SPELL = AUGMENT_BATCH5_R4['mad-chemist'].spell;
const PULSES = SPELL.damageDurationTicks / SPELL.trailIntervalTicks;
const cellKey = (cell: HexCell) => `${cell.col}:${cell.row}`;

export interface MadChemistRuntime {
  readonly manaRemainder: number;
  readonly buffUntilTick: number;
  readonly clouds: readonly { readonly cell: HexCell; readonly expiresAtTick: number }[];
  readonly poisons: readonly { readonly targetId: string; readonly expiresAtTick: number; readonly nextTick: number;
    readonly totalDamage: number; readonly ordinal: number; readonly actionSeq: number }[];
}

/** Same strongest-copy ordering as the existing hero augments; never uses a saved historical guess. */
export function compileMadChemist(state: CombatStrategyInputs, unit: Unit, board: readonly Unit[], effect: Effect): Effect[] {
  const held = (id: string) => state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === id).length;
  const strongest = board.filter(u => u.team === unit.team && u.definitionId === 'singed' && u.location.kind === 'board')
    .sort((a, b) => b.starLevel - a.starLevel || held(b.id) - held(a.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  return strongest?.id === unit.id ? [effect] : [];
}
export const isMadChemist = (unit: Pick<S13Unit, 'mechanics'>): boolean => Boolean(unit.mechanics?.some(m => m.mechanic === 'madChemist'));

function runtime(unit: S13Unit): MadChemistRuntime {
  return unit.madChemist ??= { manaRemainder: 0, buffUntilTick: 0, clouds: [], poisons: [] };
}
export function leaveMadChemistCloud(unit: S13Unit, cells: readonly HexCell[], tick: number): void {
  const r = runtime(unit), clouds = r.clouds.filter(c => c.expiresAtTick > tick);
  for (const cell of cells) {
    const existing = clouds.findIndex(c => sameCell(c.cell, cell));
    const cloud = { cell: { ...cell }, expiresAtTick: tick + SPELL.cloudDurationTicks };
    if (existing < 0) clouds.push(cloud); else clouds[existing] = cloud;
  }
  unit.madChemist = { ...r, clouds };
}

/** Nearest enemy, ID ties. Pass through the contacted enemy, reserving a free landing cell.
 * Every traversed hex gets the same one-cell-wide trail; occupied endpoints are never committed. */
export function moveMadChemist(ctx: AbilityContext, unit: S13Unit, occupied: ReadonlySet<string>): readonly HexCell[] | undefined {
  if (unit.moveCooldownTicks > 0) return;
  const target = byDistance(unit, enemies(unit, ctx.units))[0];
  if (!target) return;
  const free = (cell: HexCell) => !occupied.has(cellKey(cell)) && !ctx.movementReservations?.has(cellKey(cell));
  if (hexDistance(unit.cell, target.cell) === 1) {
    const landings = getNeighbors(ctx.board, target.cell).filter(free)
      .sort((a, b) => hexDistance(unit.cell, b) - hexDistance(unit.cell, a));
    if (landings.length) return [target.cell, landings[0]];
  }
  const seen = new Set([cellKey(unit.cell)]), queue: { cell: HexCell; first?: HexCell }[] = [{ cell: unit.cell }];
  for (let i = 0; i < queue.length; i++) for (const cell of getNeighbors(ctx.board, queue[i].cell)) {
    if (seen.has(cellKey(cell)) || !free(cell)) continue;
    seen.add(cellKey(cell)); const first = queue[i].first ?? cell;
    if (hexDistance(cell, target.cell) === 1) return [first];
    queue.push({ cell, first });
  }
}

/** The existing five-tick grid represents normal movement; flat +250 is normalized to 550 base MS.
 * Overtime adds its existing bonus. No extra clocks or random choices are introduced. */
export function madChemistMoveInterval(unit: S13Unit, tick: number): number {
  const speed = 550 * (10000 + overtimeMoveBonusBps(tick)) + (runtime(unit).buffUntilTick > tick ? SPELL.moveSpeed * 10000 : 0);
  return Math.max(1, Math.ceil(5 * 550 * 10000 / speed));
}

/** Self cast replaces both the normal ally attack-speed buff and the normal damage reduction. */
export function castMadChemist(ctx: AbilityContext, unit: S13Unit): string[] {
  unit.madChemist = { ...runtime(unit), buffUntilTick: ctx.tick + SPELL.abilityDurationTicks };
  return [unit.id];
}
export function madChemistVamp(unit: S13Unit, tick: number): VampRate[] {
  return isMadChemist(unit) && (unit.madChemist?.buffUntilTick ?? 0) > tick
    ? [{ source: asSource(origin(unit)), bps: SPELL.omnivampBps, allyBps: 0 }] : [];
}

/** Run inside the owner's action barrier so poison packets receive ordinary skill crit/proc handling.
 * Clouds live three seconds; contact refreshes ONE five-second poison without resetting its next pulse.
 * Existing clouds/attached poison survive death, while deposition and mana stop. */
export function advanceMadChemist(ctx: AbilityContext, unit: S13Unit, nextSeq: () => number): void {
  if (!isMadChemist(unit)) return;
  let r = runtime(unit);
  if (unit.alive && unit.hp > 0) {
    leaveMadChemistCloud(unit, [unit.cell], ctx.tick);
    r = runtime(unit);
    if (ctx.tick >= (unit.manaLockedUntilTick ?? 0)) {
      const locks = statusModifiers(unit, 'attackSpeedLock', ctx.tick).flatMap(m => m.value.kind === 'constant' ? [m.value.amount] : []);
      // Exact 10 × AS / 20 per tick, with an integer fractional carry. Do not invert rounded attack intervals.
      const numerator = locks.length ? BigInt(Math.min(...locks)) * 10000n
        : BigInt(unit.baseAttackSpeedBps ?? 6000) * BigInt(Math.max(0, 10000 + attackSpeedBonus(unit, ctx.tick, ctx.units)));
      const denominator = 10000n * 10000n * 20n;
      const sum = BigInt(r.manaRemainder) + numerator * BigInt(SPELL.manaPerSecondPerAttackSpeed);
      const amount = safeNumber(sum / denominator);
      r = { ...r, manaRemainder: safeNumber(sum % denominator) };
      if (amount) (ctx.manaRequests ??= []).push({ source: asSource(origin(unit)), targetId: unit.id,
        amount, reason: 'periodic', bypassLock: 'none', castActionSeq: null });
    }
  }
  const clouds = r.clouds.filter(c => c.expiresAtTick > ctx.tick);
  let poisons = r.poisons.filter(p => p.expiresAtTick >= ctx.tick && ctx.units.some(u => u.id === p.targetId && u.alive && u.hp > 0));
  for (const target of enemies(unit, ctx.units)) {
    if (!clouds.some(c => sameCell(c.cell, target.cell))) continue;
    const found = poisons.findIndex(p => p.targetId === target.id), existing = poisons[found];
    if (existing) poisons[found] = { ...existing, expiresAtTick: ctx.tick + SPELL.damageDurationTicks };
    else poisons.push({ targetId: target.id, expiresAtTick: ctx.tick + SPELL.damageDurationTicks,
      nextTick: ctx.tick + SPELL.trailIntervalTicks, totalDamage: Math.floor(SPELL.totalDamageByStar[(unit.effectiveStarLevel ?? unit.starLevel) - 1] * ap(unit, ctx.tick, ctx.units) / 100),
      ordinal: 0, actionSeq: nextSeq() });
  }
  poisons = poisons.map(p => {
    if (p.nextTick > ctx.tick) return p;
    const ordinal = p.ordinal % PULSES;
    const raw = Math.floor(p.totalDamage * (ordinal + 1) / PULSES) - Math.floor(p.totalDamage * ordinal / PULSES);
    ctx.packets.push({ source: origin(unit), targetId: p.targetId, raw, damageType: 'magic', actionSeq: p.actionSeq,
      ordinal: p.ordinal, delivery: 'ability-periodic', critEligibility: 'requires-spell-authorization', area: false, triggeringCastActionSeq: null });
    return { ...p, ordinal: p.ordinal + 1, nextTick: ctx.tick + SPELL.trailIntervalTicks };
  });
  unit.madChemist = { ...r, clouds, poisons };
}
