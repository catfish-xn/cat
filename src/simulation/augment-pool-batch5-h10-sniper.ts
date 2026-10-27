import { AUGMENT_BATCH5_H10 } from './content/augment-pool-batch5-h10';
import type { MatchBase } from './match-types';
import { EMBLEM_ITEMS } from './content/emblems';
import { UNIT_DEFINITIONS } from './units';
import type { AugmentHistory, HistoryRoster } from './augment-history-types';
import type { Unit } from './unit-types';
import type { OwnedAugment } from './strategy-types';

const values = AUGMENT_BATCH5_H10['snipers-nest'].source.values;
const stepBps = values.DamageAmp * 100, capBps = values.MaxAmp * 100;
function sniperUnits(roster: HistoryRoster): readonly Unit[] {
  return roster.units.filter(u => u.team === 'player' && u.location.kind === 'board' &&
    (UNIT_DEFINITIONS[u.definitionId]?.traits.includes('sniper') || roster.items.some(i =>
      i.location.kind === 'unit' && i.location.unitId === u.id && EMBLEM_ITEMS[i.definitionId]?.emblemTrait === 'sniper')));
}
/** Frozen server snapshot shape only; historical authentication belongs to Match/room restore. */
export function validSniperOpeningSnapshot(augments: readonly OwnedAugment[], roster: HistoryRoster, value: unknown): boolean {
  if (!augments.some(a => a.definitionId === 'snipers-nest')) return value === undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const eligible = new Set(sniperUnits(roster).map(u => u.id)), entries = Object.entries(value);
  return eligible.size === entries.length && entries.every(([id, bps]) => eligible.has(id) &&
    Number.isSafeInteger(bps) && bps >= stepBps && bps <= capBps && bps % stepBps === 0);
}

/** P-B5-60: Derive opening-cell streaks from authenticated roster facts, never saved counters.
 * Callers must supply the current opening roster and only use a history authenticated at the
 * Match/room boundary. A current-round PvP roster may already be present at the freeze point. */
export function sniperOpeningAmpBps(history: AugmentHistory, choiceId: string, round: number, current: HistoryRoster): Readonly<Record<string, number>> {
  const acquisition = history.facts.find(f => f.kind === 'acquire' && f.choiceId === choiceId && f.definitionId === 'snipers-nest');
  if (!acquisition) throw new RangeError('Invalid augment history: missing sniper acquisition');
  type Streak = { cell: { col: number; row: number }; count: number };
  const streaks = new Map<string, Streak>();
  const battles = new Set<string>();
  let currentRecorded = false;
  const players = (r: HistoryRoster): readonly Unit[] => r.units.filter(u => u.team === 'player');
  const resetAbsent = (r: HistoryRoster) => {
    const board = new Set(players(r).filter(u => u.location.kind === 'board').map(u => u.id));
    for (const id of streaks.keys()) if (!board.has(id)) streaks.delete(id);
  };
  const fight = (roster: HistoryRoster) => {
    resetAbsent(roster);
    const eligible = new Set(sniperUnits(roster).map(u => u.id));
    for (const u of players(roster)) {
      if (u.location.kind !== 'board') continue;
      if (!eligible.has(u.id)) { streaks.delete(u.id); continue; }
      const cell = u.location.cell, prior = streaks.get(u.id);
      streaks.set(u.id, { cell, count: prior && prior.cell.col === cell.col && prior.cell.row === cell.row ? Math.min(capBps / stepBps, prior.count + 1) : 1 });
    }
  };
  for (const fact of history.facts.slice(acquisition.sequence + 1)) {
    if (fact.round > round) break;
    if (fact.kind === 'positions' || fact.kind === 'round-entry') resetAbsent(fact.roster);
    if (fact.kind !== 'combat-roster' && fact.kind !== 'pvp-roster') continue;
    if (battles.has(fact.battleId)) continue;
    const roster = fact.kind === 'combat-roster' ? fact.roster : fact.seats.find(s => s.seatId === history.seatId);
    if (!roster) throw new RangeError('Invalid augment history: missing sniper seat roster');
    battles.add(fact.battleId); fight(roster);
    // Once this round opened, later equipment/merge/settlement positions cannot rewrite its input.
    // They still participate when deriving the next round's opening.
    if (fact.round === round) { currentRecorded = true; break; }
  }
  if (!currentRecorded) fight(current);
  return Object.fromEntries([...streaks].map(([id, value]) => [id, value.count * stepBps]));
}

/** Match history is authenticated upstream; only this derived opening projection enters combat. */
export function readSniperOpening(state: Pick<MatchBase, 'augments' | 'augmentHistory' | 'round' | 'preparation' | 'items'>): Readonly<Record<string, number>> | undefined {
  const owner = state.augments.find(a => a.definitionId === 'snipers-nest');
  if (!owner) return undefined;
  if (!state.augmentHistory) throw new RangeError('Invalid augment history: missing sniper history');
  return sniperOpeningAmpBps(state.augmentHistory, owner.choiceId, state.round, { units: state.preparation.units, items: state.items });
}
