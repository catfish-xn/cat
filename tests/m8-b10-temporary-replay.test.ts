/** B10 (M8_PLAN §7.4): a battle fought with Thief's Gloves temporary children is rebuilt by replay from its
 * recorded context alone, at 1×/2×/4× and by seek, and a forged child in the context is rejected.
 * Route: real seed-230 cannon commands through 3-4, then the same public branch as m8-b8-live-transfer
 * (gloves + gloves → Thief's Gloves on unit-22 at 4-7). No state is injected. */
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../src/simulation/match';
import type { SessionChange } from '../src/m6/contracts';
import { BattleHistory, validateBattleRecord } from '../src/replay/history';
import { PlaybackSession } from '../src/replay/playback-session';
import { run } from '../scripts/generate-m5-route.cjs';

const SURVIVOR = 'unit-21', DONOR = 'unit-22', TG = 'item-9';
function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public temporary-replay fixture: ${result.reason}`);
  return result.state;
}
function choose(state: MatchState, definitionId: string): MatchState {
  const choice = state.pendingChoice!;
  return accepted(api.selectChoice(state, choice.choiceId, choice.generation, definitionId));
}
function finish(input: MatchState): MatchState {
  let state = input;
  while (state.phase === 'combat' && state.combat.tick < 1201) state = api.stepMatch(state).state;
  if (state.phase === 'combat') throw new Error('Public battle exceeded its tick bound');
  return state;
}
async function preparation(): Promise<MatchState> {
  let prefix: MatchState | undefined;
  const captured = new Error('Captured real 3-4 component choice');
  try {
    await run({ ...api, selectChoice(state: MatchState, ...args: [string, number, string]) {
      if (state.roundDefinitionId === '3-4') { prefix = state; throw captured; }
      return api.selectChoice(state, ...args);
    } }, { build: 'cannon', seed: 230 });
  } catch (error) { if (error !== captured) throw error; }
  if (!prefix) throw new Error('Public route did not reach 3-4');
  let state = accepted(api.nextRound(choose(prefix, 'gloves'), 14));
  for (const id of ['unit-16', 'unit-2', 'unit-10']) state = accepted(api.sellUnit(state, id));
  state = accepted(api.equipItem(state, 'item-3', 'unit-13', 0));
  state = accepted(api.equipItem(state, 'item-7', 'unit-13', 1));
  for (let count = 0; count < 8; count++) state = accepted(api.buyXp(state));
  state = accepted(api.buyUnit(state, 0, 20));
  for (let count = 0; count < 4; count++) state = accepted(api.rerollShop(state));
  state = accepted(api.buyUnit(state, 2, 24));
  state = accepted(api.deployMatchUnit(state, SURVIVOR, { kind: 'board', cell: { col: 3, row: 7 } }));
  state = accepted(api.deployMatchUnit(state, DONOR, { kind: 'board', cell: { col: 5, row: 7 } }));
  state = accepted(api.combineItems(state, 'item-5', 'item-8'));
  state = accepted(api.equipItem(state, TG, DONOR, 0));
  while (state.roundDefinitionId !== '4-7') {
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      if (choice.kind === 'anomaly' && choice.step === 'target') {
        state = accepted(api.selectAnomalyTarget(state, choice.choiceId, choice.generation, DONOR));
      } else state = choose(state, choice.kind === 'component' ? 'gloves'
        : choice.kind === 'anomaly' ? 'mage-armor' : 'bulky-buddies-i');
    } else if (state.phase === 'settlement') state = accepted(api.nextRound(state, state.round));
    else if (state.phase === 'preparation') state = finish(accepted(api.startMatchCombat(state)));
    else throw new Error(`Unexpected public phase: ${state.phase}`);
  }
  return state;
}
/** Live battle observed exactly as the application records it (one SessionChange per committed step). */
function recorded(prepared: MatchState) {
  const history = new BattleHistory('b10-temporary'), ticks = new Map<number, MatchState>();
  // Same projection as MatchSession.record: ledger combat events are the ones carrying a tick.
  const combatEvents = (events: readonly api.MatchEvent[]) => events.filter(event => 'tick' in event) as unknown as SessionChange['events'];
  const start = api.startMatchCombat(prepared);
  if (!start.ok) throw new Error(start.reason);
  let before = prepared, state = start.state;
  history.observe({ before, after: state, events: combatEvents(start.events), reason: 'command' });
  ticks.set(state.combat!.tick, state);
  while (state.phase === 'combat') {
    before = state; const step = api.stepMatch(state); state = step.state;
    history.observe({ before, after: state, events: combatEvents(step.events), reason: 'tick' });
    ticks.set(state.combat!.tick, state);
  }
  return { record: history.completedRecords[0], ticks, terminal: state.combat! };
}

describe('B10 temporary equipment replay rebuild', async () => {
  const prepared = await preparation();
  const { record, ticks, terminal } = recorded(prepared);

  it('records the temporary children in the battle context and rebuilds the identical terminal', () => {
    // M8B rules: Thief's Gloves rolls two temporary children for its holder each combat round (m8-b8-live-transfer).
    expect(prepared.temporaryEquipment.map(({ parentItemInstanceId, holderId, roundId }) => ({ parentItemInstanceId, holderId, roundId })))
      .toEqual([{ parentItemInstanceId: TG, holderId: DONOR, roundId: '4-7' }, { parentItemInstanceId: TG, holderId: DONOR, roundId: '4-7' }]);
    expect(record.roundId).toBe('4-7');
    expect(record.context.temporaryEquipment).toEqual(prepared.temporaryEquipment);
    const verified = validateBattleRecord(record);
    expect(verified.terminal).toEqual(terminal);
    expect(verified.terminal.status).toBe('finished');
  });

  it('plays at 1×, 2× and 4× from tick 0 and seeks to the same states as the live battle', () => {
    for (const speed of [1, 2, 4] as const) {
      const playback = new PlaybackSession(record);
      playback.seek(0); playback.setSpeed(speed); playback.play();
      // 50 ms display time = one 50 ms tick at 1× (fixed tick, AGENTS.md); speed multiplies ticks per frame.
      const after = playback.advance(50);
      expect(after.tick).toBe(Math.min(speed, record.endTick));
      expect(after.combat).toEqual(ticks.get(after.tick)!.combat);
      let snapshot = after;
      while (snapshot.tick < record.endTick) snapshot = playback.advance(50);
      expect(snapshot.combat).toEqual(terminal);
      expect(snapshot.events).toEqual(record.events);
      playback.dispose();
    }
    const playback = new PlaybackSession(record);
    for (const tick of [record.endTick, 0, 39, 40, 41, Math.floor(record.endTick / 2), record.endTick - 1]) {
      expect(playback.seek(tick).combat).toEqual(ticks.get(tick)!.combat);
    }
    playback.dispose();
  });

  it('rejects a record whose context forges, drops or moves a temporary child', () => {
    const forge = (edit: (children: MatchState['temporaryEquipment']) => MatchState['temporaryEquipment']) => {
      const context = structuredClone(record.context) as { temporaryEquipment: MatchState['temporaryEquipment'] };
      context.temporaryEquipment = edit(context.temporaryEquipment);
      return { ...structuredClone(record), context } as typeof record;
    };
    const replacement = prepared.temporaryEquipment[1].definitionId === 'deathcap' ? 'archangel' : 'deathcap';
    for (const forged of [
      forge(children => children.map((child, index) => index === 1 ? { ...child, definitionId: replacement } : child)),
      forge(children => children.slice(0, 1)),
      forge(() => []),
      forge(children => children.map(child => ({ ...child, holderId: SURVIVOR }))),
    ]) {
      expect(() => validateBattleRecord(forged)).toThrow();
      expect(() => new PlaybackSession(forged)).toThrow();
    }
  });
});
