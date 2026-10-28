import type { UnitLootPolicy } from './loot-runtime';
import { requireAugmentFacts } from './augment-history';
import { SHOP_CATALOG } from './match-rules';
import type { MatchEvent, MatchState } from './match-types';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { appendResourceProvenance, mergeGrowthLedger } from './resource-provenance';
import { nextRandom } from './rng';
import { planDeferredUpgrades, transferUpgradeResources } from './upgrades';
import { UNIT_DEFINITIONS, type Unit } from './units';

const SOURCE = 'augment-pool-batch5-r6';
// Transaction-local pool capability: never serialised and never accepted from a client command.
const policyStocks = new WeakMap<UnitLootPolicy, Readonly<Record<string, number>>>();
export function bindBatch5R6Stock(policy: UnitLootPolicy, stock: Readonly<Record<string, number>>): UnitLootPolicy {
  policyStocks.set(policy, stock); return policy;
}
const ordinary = (u: Unit) => u.team === 'player' && SHOP_CATALOG.includes(u.definitionId);
const completed = (s: MatchState, choiceId: string) => s.resourceProvenance.entries.some(e =>
  e.kind === 'augment-transform-completed' && e.choiceId === choiceId && e.roundId === getMultiplayerRoundByOrdinal(s.round).roundId);

/** Separate explicit LCG stream: no shop, offer, battle or other seat RNG is advanced. */
function transformSeed(s: MatchState, choiceId: string): number {
  const key = JSON.stringify([SOURCE, s.multiplayer!.seatId, choiceId, s.round]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193) >>> 0;
  return (s.seed ^ hash) >>> 0;
}

/** Plan all exchanges against a private stock copy, then merge once. The pool folds these facts atomically. */
function transformBatch(initial: MatchState, choiceId: string, targets: readonly Unit[], stock: Readonly<Record<string, number>>, upgradeCost = false): { state: MatchState; events: readonly MatchEvent[] } {
  let state = initial, rng = transformSeed(state, choiceId);
  const available = { ...stock }, roundId = getMultiplayerRoundByOrdinal(state.round).roundId;
  for (const original of targets) {
    const unit = state.preparation.units.find(u => u.id === original.id);
    if (!unit || unit.definitionId !== original.definitionId || unit.starLevel !== original.starLevel) throw new RangeError('Invalid transform roster');
    const originalCost = UNIT_DEFINITIONS[unit.definitionId].cost, cost = upgradeCost ? Math.min(5, originalCost + 1) : originalCost, copies = 3 ** (unit.starLevel - 1);
    // Only complete stars can be reserved. Selection sees stock before returning this unit.
    const candidates = SHOP_CATALOG.filter(id => UNIT_DEFINITIONS[id].cost === cost && available[id] >= copies).sort();
    if (!candidates.length) continue;
    const draw = nextRandom(rng); rng = draw.state;
    const to = candidates[Math.floor(draw.word * candidates.length / 4294967296)];
    available[unit.definitionId] += copies; available[to] -= copies;
    state = { ...state,
      preparation: { ...state.preparation, units: state.preparation.units.map(u => u.id === unit.id ? { ...u, definitionId: to } : u) },
      anomalyBinding: state.anomalyBinding?.unitId === unit.id ? null : state.anomalyBinding,
      resourceProvenance: appendResourceProvenance(state.resourceProvenance, roundId,
        { kind: 'unit-transformed', choiceId, unitId: unit.id, from: unit.definitionId, to, starLevel: unit.starLevel }),
    };
  }
  const merged = planDeferredUpgrades(state.preparation), resources = transferUpgradeResources(state.items, state.anomalyBinding, merged.events);
  const events = [...merged.events, ...resources.events];
  state = { ...state, preparation: merged.preparation, items: resources.items, anomalyBinding: resources.anomalyBinding,
    persistentGrowth: mergeGrowthLedger(state.persistentGrowth, merged.events),
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, roundId, [
      ...merged.events.map(event => ({ kind: 'unit-upgraded-after-combat' as const, event })),
      { kind: 'augment-transform-completed', choiceId },
    ]),
  };
  return { state, events };
}

/** Next natural round (including supply and overtime), before XP, shop or carousel placements. Solo stays safe. */
export function transformPandorasBench(state: MatchState, stock?: Readonly<Record<string, number>>): { state: MatchState; events: readonly MatchEvent[] } {
  const owner = state.augments.find(a => a.definitionId === 'pandoras-bench');
  if (!owner || owner.acquiredRound >= state.round || !state.multiplayer || !stock || completed(state, owner.choiceId)) return { state, events: [] };
  const entry = requireAugmentFacts(state, 'round-entry', state.round)[0];
  const targets = entry.roster.units.filter(u => ordinary(u) && u.location.kind === 'bench' && u.location.slot >= state.preparation.benchSize - 3)
    .sort((a, b) => (a.location.kind === 'bench' ? a.location.slot : 0) - (b.location.kind === 'bench' ? b.location.slot : 0));
  return transformBatch(state, owner.choiceId, targets, stock);
}

/** Selection-time board snapshot; six-cost inputs and summons are excluded. */
export function transformRecombobulator(state: MatchState, policy?: UnitLootPolicy): { state: MatchState; events: readonly MatchEvent[] } {
  const owner = state.augments.find(a => a.definitionId === 'recombobulator');
  if (!owner || owner.acquiredRound !== state.round || !state.multiplayer || completed(state, owner.choiceId)) return { state, events: [] };
  const stock = policy && policyStocks.get(policy);
  if (!stock) {
    if (state.sharedPool) throw new RangeError('Recombobulator requires the shared pool transaction');
    return { state, events: [] };
  }
  const entry = requireAugmentFacts(state, 'acquire', state.round).find(f => f.choiceId === owner.choiceId);
  if (!entry) throw new RangeError('Invalid augment history: missing recombobulator acquisition');
  const targets = entry.roster.units.filter(u => ordinary(u) && u.location.kind === 'board' && UNIT_DEFINITIONS[u.definitionId].cost <= 5)
    .sort((a, b) => a.location.kind === 'board' && b.location.kind === 'board'
      ? a.location.cell.row - b.location.cell.row || a.location.cell.col - b.location.cell.col || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : 0);
  return transformBatch(state, owner.choiceId, targets, stock, true);
}


