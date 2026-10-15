/** B10 coverage matrix, save/replay column (M8_PLAN §7.1 contentId → … → save/replayTest): every one of the
 * 44 M8 equipment definitions is carried by a real public-command combat (tests/fixtures/m8-b4-match.ts route),
 * recorded the way the application records it, and
 *  - replayed from the record's context alone to the identical terminal, event ledger and hashes;
 *  - saved and restored at ticks 0/39/40/41 and the end, continuing to the identical terminal;
 *  - rejected when the recorded context swaps the item for another definition.
 * The expected terminal is the uninterrupted live battle, not a stored golden. */
import { beforeAll, describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import * as api from '../src/simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../src/simulation/match';
import type { SessionChange } from '../src/m6/contracts';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { BattleHistory, validateBattleRecord } from '../src/replay/history';
import { publicEquipmentPreparation } from './fixtures/m8-b4-match';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`B10 item save/replay fixture: ${result.reason}`);
  return result.state;
}
/** Same public steps as itemMatch() up to, but excluding, startMatchCombat: the recorded battle context. */
function holderPreparation(definitionId: string): { state: MatchState; itemId: string } {
  const definition = ITEM_DEFINITIONS[definitionId];
  let state = publicEquipmentPreparation(definition.recipe ? [...definition.recipe] : [definitionId]);
  const available = state.items.filter(item => item.location.kind === 'inventory');
  const inputs = (definition.recipe ?? [definitionId]).map(component => {
    const index = available.findIndex(item => item.definitionId === component);
    if (index < 0) throw new Error(`Fixture did not acquire ${component}`);
    return available.splice(index, 1)[0].id;
  });
  let itemId = inputs[0];
  if (definition.recipe) {
    const combined = api.combineItems(state, inputs[0], inputs[1]);
    state = accepted(combined);
    const event = combined.ok ? combined.events.find(event => event.type === 'itemCombined') : undefined;
    if (!event || event.type !== 'itemCombined') throw new Error('Public combine omitted its itemCombined event');
    itemId = event.itemId;
  }
  state = accepted(api.equipItem(state, itemId, 'unit-1', 0));
  state = accepted(api.deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }));
  return { state, itemId };
}
const combatEvents = (events: readonly MatchEvent[]) => events.filter(event => 'tick' in event) as unknown as SessionChange['events'];
function live(prepared: MatchState) {
  const history = new BattleHistory('b10-items'), ticks = new Map<number, MatchState>();
  const start = api.startMatchCombat(prepared);
  if (!start.ok) throw new Error(start.reason);
  let before = prepared, state = start.state;
  history.observe({ before, after: state, events: combatEvents(start.events), reason: 'command' });
  ticks.set(0, state);
  while (state.phase === 'combat' && state.combat.tick < 1201) {
    before = state; const step = api.stepMatch(state); state = step.state;
    history.observe({ before, after: state, events: combatEvents(step.events), reason: 'tick' });
    if (state.combat) ticks.set(state.combat.tick, state);
  }
  if (state.phase === 'combat') throw new Error('Battle exceeded its tick bound');
  return { record: history.completedRecords[0], ticks, settled: state };
}
function continueFrom(saved: string): MatchState {
  let state = restoreMatch(saved);
  while (state.phase === 'combat') state = api.stepMatch(state).state;
  return state;
}

beforeAll(() => { holderPreparation('blue-buff'); });

const IDS = Object.keys(ITEM_DEFINITIONS).sort();
describe('B10 every M8 equipment definition survives record, replay and save/restore', () => {
  it('covers exactly the 44 frozen definitions', () => { expect(IDS).toHaveLength(44); });
  it.each(IDS)('%s', definitionId => {
    const { state: prepared, itemId } = holderPreparation(definitionId);
    expect(prepared.items.find(item => item.id === itemId)).toMatchObject({ definitionId, location: { kind: 'unit', unitId: 'unit-1', slot: 0 } });
    const { record, ticks, settled } = live(prepared);
    const terminal = settled.combat!;
    expect(terminal.tick).toBeGreaterThan(41); // ticks 39/40/41 straddle the 40-tick checkpoint inside the battle
    expect(record.context).toEqual(prepared);
    expect(record.initial.units.some(unit => unit.id === 'unit-1')).toBe(true);
    const verified = validateBattleRecord(record);
    expect(verified.terminal).toEqual(terminal);
    expect(verified.settledMatch).toEqual(settled);
    for (const tick of [0, 39, 40, 41, terminal.tick - 1]) {
      const at = ticks.get(Math.min(tick, terminal.tick - 1))!;
      const saved = serializeMatch(at);
      expect(restoreMatch(saved)).toEqual(at);
      // In particular red-buff refreshes a fractional burn after canonical key sorting.
      // Comparing the entire continuation prevents losing its saved remainder (one HP).
      expect(continueFrom(saved)).toEqual(settled);
    }
    expect(restoreMatch(serializeMatch(settled))).toEqual(settled);
    // Swapping the definition in the recorded context must not replay to the recorded battle.
    const other = definitionId === 'sword' ? 'bow' : 'sword';
    const context = structuredClone(record.context) as unknown as { items: { id: string; definitionId: string }[] };
    context.items = context.items.map(item => item.id === itemId ? { ...item, definitionId: other } : item);
    expect(() => validateBattleRecord({ ...structuredClone(record), context } as unknown as typeof record)).toThrow();
  });
});
