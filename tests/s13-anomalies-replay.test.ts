import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { startReplayWarmup, toCombatReplayFor } from '../src/server/room/projection';
import type { RoomState, TwoSidedBattleResult } from '../src/server/room/types';
import { applyCombatReplayTick } from '../src/simulation/combat-replay-view';
import { anomalyId } from './helpers/s13-anomalies';

it.each(['ScuttleFamiliar', 'WolfFamiliars', 'DramaticEntrance', 'EvenInDeath', 'CenteroftheUniverse', 'DeftHands'])('%s full server projection has no replay error across movement, birth and removal', suffix => {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const seat = (definitionId: string, starLevel: 1 | 3, binding: boolean) => ({ ...base, level: 9,
    round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    preparation: { ...base.preparation, units: [{ id: 'unit-1', definitionId, starLevel, team: 'player' as const,
      location: { kind: 'board' as const, cell: { col: 3, row: 7 } } }] },
    anomalyBinding: binding ? { unitId: 'unit-1', definitionId: anomalyId(suffix), choiceId: 'anomaly', boundRound: 1 } : null });
  const input = compileBattle(snapshotForBattle(seat('lux', 1, true), 'A'), snapshotForBattle(seat('garen', 3, false), 'B'), 42, { battleId: 'p4-replay-' + suffix });
  const battle = resolveTwoSidedBattle(input, 1201);
  const envelope: TwoSidedBattleResult = { kind: 'two-sided', battleId: battle.battleId, round: round.ordinal,
    roomRevision: 1, participants: ['A', 'B'], battle, proposals: proposeSettlement(battle) };
  const warmup = startReplayWarmup(envelope, ['A', 'B']);
  let finished = false;
  for (let i = 0; i < 200 && !finished; i++) finished = warmup.advance(7);
  expect(finished).toBe(true);
  const room = { battles: [envelope] } as unknown as RoomState;
  for (const id of ['A', 'B']) {
    const projected = toCombatReplayFor(room, id)!;
    let view = projected.replay.initial;
    for (const frame of projected.replay.ticks) view = applyCombatReplayTick(view, frame);
    expect(view).toEqual(projected.replay.terminal);
  }
  expect(battle.events.some(e => e.type === 'movement')).toBe(true);
  if (suffix === 'ScuttleFamiliar') expect(battle.events.filter(e => e.type === 'unitSpawned' && e.definitionId === 's13-crab')).toHaveLength(1);
  if (suffix === 'WolfFamiliars') {
    expect(battle.events.filter(e => e.type === 'unitSpawned' && e.definitionId === 's13-wolf')).toHaveLength(2);
    expect(battle.events.filter(e => e.type === 'unitRemoved')).toHaveLength(2);
    expect(envelope.proposals.b.opposingSurvivors).toBe(0);
  }
});
