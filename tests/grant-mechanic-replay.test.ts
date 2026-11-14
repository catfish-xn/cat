import { describe, expect, it } from 'vitest';
import { deployMatchUnit, selectChoice, sellUnit, type MatchState } from '../src/simulation/match';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, reachRound } from './match-helpers';

// Seed 41's 2-1 offer opens on Voidcaller, an acquire-only history owner.
// Selling that board and granting the champion back is an external unit birth:
// it is not nested inside sellUnit, so the solo proof has to replay it itself.
const SEED = 41;

function regrantAfterSale(): { state: MatchState; definitionId: string } {
  let state = reachRound('2-1', false, SEED);
  const choice = state.pendingChoice!;
  expect(choice.offers[0]).toBe('voidcaller');
  state = accepted(selectChoice(state, choice.choiceId, choice.generation, 'voidcaller'));
  expect(state.augmentHistory?.proof.kind).toBe('solo');
  const counts = new Map<string, number>();
  for (const unit of state.preparation.units) counts.set(unit.definitionId, (counts.get(unit.definitionId) ?? 0) + 1);
  const victim = state.preparation.units.find(unit => unit.team === 'player' && counts.get(unit.definitionId) === 1);
  expect(victim).toBeDefined();
  const definitionId = victim!.definitionId;
  const cell = { col: 3, row: 4 };
  state = accepted(sellUnit(state, victim!.id));
  const before = new Set(state.preparation.units.map(unit => unit.id));
  state = accepted(grantMechanicUnit(state, { receiptId: 'replay:regrant', source: 'anomaly-audit', definitionId }));
  const back = state.preparation.units.find(unit => unit.team === 'player' && !before.has(unit.id));
  expect(back?.definitionId).toBe(definitionId);
  state = accepted(deployMatchUnit(state, back!.id, { kind: 'board', cell }));
  return { state, definitionId };
}

describe('solo history replays a unit granted back after a sale', () => {
  it('restoreMatch replays the grant and rejects a forged unit or cell', () => {
    const { state, definitionId } = regrantAfterSale();
    const proof = state.augmentHistory?.proof;
    expect(proof?.kind).toBe('solo');
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    expect(restoreMatch(JSON.parse(serializeMatch(state)))).toEqual(state);
    if (proof?.kind !== 'solo') return;
    const grant = proof.commands.filter(command => command.name === 'grantMechanicUnit');
    expect(grant).toEqual([{ name: 'grantMechanicUnit', args: [{ receiptId: 'replay:regrant', source: 'anomaly-audit', definitionId }], count: 1 }]);

    const saved = JSON.parse(serializeMatch(state)) as MatchState;
    const forged = structuredClone(saved) as { -readonly [K in keyof MatchState]: MatchState[K] };
    const commands = forged.augmentHistory!.proof.kind === 'solo' ? [...forged.augmentHistory!.proof.commands] : [];
    forged.augmentHistory = { ...forged.augmentHistory!, proof: { kind: 'solo', origin: (forged.augmentHistory!.proof as { origin: MatchState }).origin, commands: [...commands, { name: 'grantMechanicUnit', args: [{ receiptId: 'forged-grant', source: 'anomaly-audit', definitionId: 'jinx' }], count: 1 }] } };
    expect(() => restoreMatch(forged)).toThrow(/Invalid augment history/);

    const wrongUnit = structuredClone(saved) as { -readonly [K in keyof MatchState]: MatchState[K] };
    if (wrongUnit.augmentHistory?.proof.kind === 'solo') {
      wrongUnit.augmentHistory = { ...wrongUnit.augmentHistory, proof: { ...wrongUnit.augmentHistory.proof, commands: wrongUnit.augmentHistory.proof.commands.map(command => command.name === 'grantMechanicUnit'
        ? { ...command, args: [{ ...(command.args[0] as { definitionId: string }), definitionId: command.args[0] && (command.args[0] as { definitionId: string }).definitionId === 'jinx' ? 'vi' : 'jinx' }] }
        : command) } };
    }
    expect(() => restoreMatch(wrongUnit)).toThrow(/Invalid augment history/);

    const wrongCell = structuredClone(saved);
    const placed = wrongCell.preparation.units.find(unit => unit.definitionId === definitionId && unit.location.kind === 'board');
    expect(placed?.location.kind).toBe('board');
    if (placed?.location.kind === 'board') (placed as { location: typeof placed.location }).location = { kind: 'board', cell: { col: placed.location.cell.col === 0 ? 6 : 0, row: placed.location.cell.row } };
    expect(() => restoreMatch(wrongCell)).toThrow('Invalid augment history: replayed facts/state mismatch');
  });
});
