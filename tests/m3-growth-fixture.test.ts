import { beforeAll, describe, expect, it } from 'vitest';
import createFixtures, { type FixtureRun } from '../scripts/generate-m3-fixture.cjs';
import { createMatch, buyUnit, buyXp, rerollShop, sellUnit, deployMatchUnit, startMatchCombat, stepMatch, nextRound, type MatchState } from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import { expectedCommand, expectedRound, validateReplayHeader, type LedgerCommand } from './fixtures/m3/oracle.cjs';
import { accepted, freeze } from './match-helpers';

const header = { schemaVersion: 3, rulesVersion: 'm3-v1', contentVersion: 'm3-content-v1' };
function dispatch(state: MatchState, command: LedgerCommand) {
  switch (command.type) {
    case 'buy': return buyUnit(state, command.slot, command.generation);
    case 'buyXp': return buyXp(state);
    case 'reroll': return rerollShop(state);
    case 'sell': return sellUnit(state, command.id);
    case 'deploy': return deployMatchUnit(state, command.id, command.target);
  }
}
function replay(run: FixtureRun, options: { json?: boolean; failures?: boolean } = {}) {
  validateReplayHeader(header);
  let state = createMatch(42), seq = 0;
  const events: CombatEvent[] = [], trace: unknown[] = [];
  function checkpoint() {
    trace.push({ seq: seq++, round: state.round, logicalTick: state.combat?.tick ?? 0, state: structuredClone(state) });
    if (options.json) state = JSON.parse(JSON.stringify(state)) as MatchState;
    if (options.failures) {
      const before = structuredClone(state); freeze(state);
      for (const result of [buyUnit(state, -1, state.shop.generation), sellUnit(state, 'consumed-id')]) { expect(result.ok).toBe(false); expect(result.state).toBe(state); }
      if (state.phase !== 'preparation') for (const action of [buyXp, rerollShop, startMatchCombat]) { expect(action(state).ok).toBe(false); expect(action(state).state).toBe(state); }
      expect(state).toEqual(before);
    }
  }
  for (const round of run.rounds) {
    for (const action of round.preparationActions) {
      const result = dispatch(freeze(state), action.command);
      expect(result).toEqual(expectedCommand(state, action.command));
      trace.push({ seq: seq++, round: state.round, logicalTick: 0, command: action.command, commandEvents: result.ok ? result.events : [] });
      state = accepted(result); expect(state).toEqual(action.after); checkpoint();
    }
    const before = state; state = accepted(startMatchCombat(freeze(state))); checkpoint();
    while (state.phase === 'combat') {
      const next = stepMatch(freeze(state)); state = next.state; events.push(...next.events);
      expect(state).toEqual(round.atTick.get(state.combat!.tick)); checkpoint();
    }
    expect(state.roundResults.at(-1)).toEqual(expectedRound(before, state.combat!));
    expect(state).toEqual(round.settled);
    if (state.phase === 'settlement') { state = accepted(nextRound(state, state.round)); checkpoint(); }
  }
  expect(state).toEqual(run.final); expect(events).toEqual(run.events);
  return { trace, events, state };
}

describe('the exact seed42 production browser routes also replay offline', () => {
  let growth: FixtureRun, terminal: FixtureRun;
  beforeAll(async () => { ({ growth, terminal } = await createFixtures()); });
  it('buys and deploys the newly unlocked three-cost champion, increases population with F and survives eight actual rounds', () => {
    const result = replay(growth);
    expect(result.state).toMatchObject({ round: 9, phase: 'preparation', playerHp: 56 });
    expect(growth.commands.find(c => c.annotation === 'new-tier-three-cost')?.after.preparation.units.some(u => u.definitionId === 'arcanist')).toBe(true);
    expect(growth.commands.find(c => c.annotation === 'fourth-population')?.after.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board')).toHaveLength(4);
    expect(growth.rounds.map(r => r.settled.combat!.result)).toEqual(['playerWin','playerWin','playerWin','playerWin','enemyWin','playerWin','enemyWin','enemyWin']);
  });
  it('keeps the growth trajectory identical after every JSON restore and inserted rejection', () => {
    expect(replay(growth, { json: true, failures: true })).toEqual(replay(growth));
  });
  it('replays every weak-roster defeat into a persistent terminal Game Over', () => {
    expect(replay(terminal, { json: true, failures: true })).toEqual(replay(terminal));
    expect(terminal.final).toMatchObject({ phase: 'gameOver', playerHp: 0, round: 9 });
  });
  it.each(['schemaVersion', 'rulesVersion', 'contentVersion'] as const)('rejects unsupported %s before replay starts', field => {
    const mismatch = { ...header, [field]: field === 'schemaVersion' ? 2 : 'm2' };
    expect(() => validateReplayHeader(mismatch)).toThrow(`Unsupported replay ${field}`);
  });
});
