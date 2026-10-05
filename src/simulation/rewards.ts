import type { MatchState } from './match-types';
import type { GameState } from './game';
import type { ItemInstance, ScheduleEvent, ScheduleReceipt } from './strategy-types';
import { COMPONENT_IDS, ITEM_DEFINITIONS } from './content/items';
import { ROUND_SCHEDULE } from './round-schedule';
import { nextRandom } from './rng';

export interface RewardPlan {
  readonly items: readonly ItemInstance[];
  readonly nextItemSerial: number;
  readonly rewardRngState: number;
  readonly gold: number;
  readonly preparation: GameState;
  readonly nextUnitSerial: number;
  readonly receipt: ScheduleReceipt;
}
/** Pure grant plan: callers commit this and its receipt in the same Match transaction. */
export function planReward(state: MatchState, event: Extract<ScheduleEvent, { kind: 'reward' }>): RewardPlan {
  const previous = state.scheduleReceipts.find(receipt => receipt.eventId === event.id);
  if (previous) {
    if (previous.kind !== 'reward' || previous.round !== state.round) throw new Error('Conflicting reward receipt');
    return { items: state.items, nextItemSerial: state.nextItemSerial, rewardRngState: state.rewardRngState,
      gold: state.gold, preparation: state.preparation, nextUnitSerial: state.nextUnitSerial, receipt: previous };
  }
  let rewardRngState = state.rewardRngState;
  let nextItemSerial = state.nextItemSerial;
  let nextUnitSerial = state.nextUnitSerial;
  let preparation = state.preparation;
  const items = [...state.items];
  const definitions = [...event.components];
  if (!Number.isSafeInteger(event.randomComponents) || event.randomComponents < 0 || !Number.isSafeInteger(event.gold) || event.gold < 0) throw new RangeError('Invalid reward');
  for (let i = 0; i < event.randomComponents; i++) {
    const draw = nextRandom(rewardRngState);
    rewardRngState = draw.state;
    definitions.push(COMPONENT_IDS[draw.word % COMPONENT_IDS.length]);
  }
  const itemIds: string[] = [];
  for (const definitionId of definitions) {
    if (ITEM_DEFINITIONS[definitionId]?.kind !== 'component') throw new RangeError(`Unknown reward component: ${definitionId}`);
    const id = `item-${nextItemSerial++}`;
    items.push({ id, definitionId, location: { kind: 'inventory' } });
    itemIds.push(id);
  }
  let unitId: string | null = null;
  if (event.recruitIfEmpty && !preparation.units.some(unit => unit.team === 'player')) {
    unitId = `unit-${nextUnitSerial++}`;
    preparation = { ...preparation, units: [...preparation.units, { id: unitId, definitionId: ROUND_SCHEDULE.fallbackDefinitionId,
      team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } }] };
  }
  const gold = state.gold + event.gold;
  if (![gold, nextItemSerial, nextUnitSerial].every(Number.isSafeInteger)) throw new RangeError('Reward integer overflow');
  return { items, nextItemSerial, rewardRngState, gold, preparation, nextUnitSerial,
    receipt: { eventId: event.id, round: state.round, kind: 'reward', itemIds, gold: event.gold, unitId, definitionId: null } };
}
