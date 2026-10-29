import { planAugmentGifts } from './augment-gift-plan';
import { isAnvil } from './content/anvils';
import { RESTART_MISSION } from './content/restart-mission';
import { pruneForgePositions } from './forge-positions';
import { returnUnitItems } from './inventory';
import type { MatchEvent, MatchState } from './match-types';
import { appendResourceProvenance } from './resource-provenance';
import type { OwnedAugment } from './strategy-types';

export const restartMissionRemovalId = (a: Pick<OwnedAugment, 'choiceId'>): string =>
  JSON.stringify(['restart-mission', a.choiceId, 'removal']);

/** Independent uniform draws with replacement from each cost's entire shop catalog, never current stock. */
export function restartMissionGiftPlan(state: MatchState) {
  return state.augments.filter(a => a.definitionId === 'restart-mission')
    .flatMap(a => planAugmentGifts(state, a, RESTART_MISSION.gifts));
}

/** Strict retirement proof for permanent summons whose original contract otherwise requires a live body.
 * Shared restore separately authenticates the history against independent server authority. */
export function restartMissionRemovedUnit(state: MatchState, unitId: string) {
  const owner = state.augments.find(a=>a.definitionId==='restart-mission');
  if (!owner) return undefined;
  const acquired = state.augmentHistory?.facts.find(f=>f.kind==='acquire'&&f.choiceId===owner.choiceId&&f.definitionId===owner.definitionId);
  const marker = state.resourceProvenance.entries.find(e=>e.kind==='restart-mission-completed'&&e.choiceId===owner.choiceId);
  const removal = state.resourceProvenance.entries.find(e=>e.kind==='unit-removed'&&e.unitId===unitId&&e.receiptId===restartMissionRemovalId(owner));
  if (acquired?.kind!=='acquire' || !marker || removal?.kind!=='unit-removed') return undefined;
  const unit = acquired.roster.units.find(u=>u.id===unitId&&!isAnvil(u.definitionId));
  return unit && removal.roundId===acquired.roundId && marker.roundId===acquired.roundId
    && acquired.round===owner.acquiredRound && acquired.resourcePrefix<=removal.sequence && removal.sequence<marker.sequence
    && removal.definitionId===unit.definitionId && removal.starLevel===unit.starLevel
    && !state.preparation.units.some(u=>u.id===unitId) ? removal : undefined;
}

/** Selection transaction only: no sales, gold, merging or reward/pool allocation here.
 * Anvils and carousel escrow are retained; all other board/bench bodies, including summons, leave. */
export function applyRestartMission(state: MatchState): { state: MatchState; events: readonly MatchEvent[] } {
  const owner = state.augments.find(a => a.definitionId === 'restart-mission');
  if (!owner || owner.acquiredRound !== state.round || state.phase === 'combat'
    || state.resourceProvenance.entries.some(e => e.kind === 'restart-mission-completed' && e.choiceId === owner.choiceId)) return { state, events: [] };
  const pending = new Set(state.carousel?.pendingUnits.map(u => u.unitId));
  const targets = state.preparation.units.filter(u => u.team === 'player' && !isAnvil(u.definitionId) && !pending.has(u.id));
  const removed = new Set(targets.map(u => u.id)), events: MatchEvent[] = [];
  let items = state.items;
  for (const unit of targets) {
    const returned = returnUnitItems(items, unit.id);
    items = returned.items; events.push(...returned.events);
  }
  return { state: pruneForgePositions({ ...state, items,
    preparation: { ...state.preparation, units: state.preparation.units.filter(u => !removed.has(u.id)) },
    anomalyBinding: state.anomalyBinding && removed.has(state.anomalyBinding.unitId) ? null : state.anomalyBinding,
    persistentGrowth: state.persistentGrowth.filter(g => !removed.has(g.unitId)),
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, [
      ...targets.map(u => ({ kind: 'unit-removed' as const, unitId: u.id, receiptId: restartMissionRemovalId(owner), definitionId: u.definitionId, starLevel: u.starLevel })),
      { kind: 'restart-mission-completed', choiceId: owner.choiceId },
    ]),
  }), events };
}
