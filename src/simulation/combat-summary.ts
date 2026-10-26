import type { CombatReplay, CombatViewUnit } from './combat-replay-view';

export interface UnitBattleSummary {
  readonly unitId: string;
  readonly definitionId: string;
  readonly team: CombatViewUnit['team'];
  readonly starLevel: CombatViewUnit['starLevel'];
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly shieldAbsorbed: number;
  readonly healingDone: number;
  readonly healingReceived: number;
  readonly kills: number;
  readonly alive: boolean;
}

/** Authoritative display accounting from one complete replay, including tick-zero facts. */
export function summarizeBattle(replay: CombatReplay): readonly UnitBattleSummary[] {
  const terminal = new Map(replay.terminal.units.map(unit => [unit.id, unit]));
  const rows = replay.initial.units.map(unit => ({ unitId: unit.id, definitionId: unit.definitionId,
    team: unit.team, starLevel: unit.starLevel, damageDealt: 0, damageTaken: 0, shieldAbsorbed: 0,
    // Removed summons keep their earned totals, but are absent from the current/terminal roster.
    healingDone: 0, healingReceived: 0, kills: 0, alive: terminal.get(unit.id)?.alive ?? false }));
  const units = new Map(rows.map(row => [row.unitId, row]));
  for (const frame of replay.ticks) for (const event of frame.events) {
    if (event.type === 'packetDamage') {
      const source = units.get(event.sourceId), target = units.get(event.targetId);
      const damage = event.hpDamage + event.absorbed;
      if (source) source.damageDealt += damage;
      if (target) { target.damageTaken += damage; target.shieldAbsorbed += event.absorbed; }
    } else if (event.type === 'heal') {
      const target = units.get(event.targetId);
      if (target) target.healingReceived += event.actual;
      for (const share of event.shares) {
        const source = units.get(share.sourceId);
        if (source) source.healingDone += share.actual;
      }
    } else if (event.type === 'kill') {
      const source = units.get(event.sourceId);
      if (source) source.kills++;
    }
  }
  return rows;
}
