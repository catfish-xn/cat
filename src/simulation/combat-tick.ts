import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import { compareIds, eliminationResult, MOVE_INTERVAL_TICKS, type CombatEvent, type CombatState, type CombatStep, type CombatUnit } from './combat-types';

type WorkingUnit = { -readonly [Key in keyof CombatUnit]: CombatUnit[Key] };
const cellKey = (cell: HexCell): string => `${cell.col},${cell.row}`;

function nearestEnemy(unit: CombatUnit, units: readonly CombatUnit[]): CombatUnit | undefined {
  return units.filter(other => other.alive && other.team !== unit.team).sort((a, b) =>
    hexDistance(unit.cell, a.cell) - hexDistance(unit.cell, b.cell) || compareIds(a, b))[0];
}

/** BFS visits neighbors in board order, retaining the first step of each path. */
function nextStep(board: Board, unit: CombatUnit, target: CombatUnit, occupied: ReadonlySet<string>): HexCell | undefined {
  const visited = new Set([cellKey(unit.cell)]);
  const queue: { cell: HexCell; first: HexCell | undefined }[] = [{ cell: unit.cell, first: undefined }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const cell of getNeighbors(board, current.cell)) {
      const key = cellKey(cell);
      if (visited.has(key) || occupied.has(key)) continue;
      visited.add(key);
      const first = current.first ?? cell;
      if (hexDistance(cell, target.cell) <= unit.attackRange) return first;
      queue.push({ cell, first });
    }
  }
  return undefined;
}

export function advanceCombatTick(state: CombatState): CombatStep {
  const tick = state.tick + 1;
  const events: CombatEvent[] = [];
  const units: WorkingUnit[] = state.units.map(unit => ({ ...unit, cell: { ...unit.cell },
    cooldownTicks: unit.alive ? Math.max(0, unit.cooldownTicks - 1) : 0,
    moveCooldownTicks: unit.alive ? Math.max(0, unit.moveCooldownTicks - 1) : 0,
  })).sort(compareIds);
  const occupied = new Set(units.filter(unit => unit.alive).map(unit => cellKey(unit.cell)));
  // Every intent reads the same position snapshot. Reservations resolve only after planning.
  const intents = units.map(unit => {
    if (!unit.alive) return undefined;
    const target = nearestEnemy(unit, units);
    unit.targetId = target?.id ?? null;
    if (!target || unit.moveCooldownTicks > 0 || hexDistance(unit.cell, target.cell) <= unit.attackRange) return undefined;
    return nextStep(state.board, unit, target, occupied);
  });
  const reserved = new Set<string>();
  units.forEach((unit, index) => {
    const destination = intents[index];
    if (!destination || reserved.has(cellKey(destination))) return;
    reserved.add(cellKey(destination));
    events.push({ type: 'movement', tick, unitId: unit.id, from: { ...unit.cell }, to: { ...destination } });
    unit.cell = destination;
    unit.moveCooldownTicks = MOVE_INTERVAL_TICKS;
  });

  const incoming = new Map<string, number>();
  for (const unit of units) {
    if (!unit.alive) continue;
    const target = nearestEnemy(unit, units);
    unit.targetId = target?.id ?? null;
    if (!target || unit.cooldownTicks > 0 || hexDistance(unit.cell, target.cell) > unit.attackRange) continue;
    events.push({ type: 'attack', tick, attackerId: unit.id, targetId: target.id });
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + unit.attackDamage);
    unit.cooldownTicks = unit.attackIntervalTicks;
  }
  // All attacks above are committed before any HP or life state changes.
  for (const unit of units) {
    const amount = incoming.get(unit.id);
    if (amount === undefined) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    events.push({ type: 'damage', tick, unitId: unit.id, amount, hp: unit.hp });
  }
  for (const unit of units) {
    if (!unit.alive || unit.hp > 0) continue;
    unit.alive = false;
    unit.targetId = null;
    unit.cooldownTicks = 0;
    unit.moveCooldownTicks = 0;
    events.push({ type: 'death', tick, unitId: unit.id });
  }
  const eliminated = eliminationResult(units);
  const result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  if (result !== null) events.push({ type: 'combatFinished', tick, result, reason: eliminated === null ? 'timeout' : 'elimination' });
  return { state: { ...state, units, tick, status: result === null ? 'running' : 'finished', result }, events };
}
