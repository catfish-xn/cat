import * as api from '../../src/simulation/match';

const accepted = (result: api.MatchCommandResult): api.MatchState => {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

/** 14.24 stats: publicly swap Leona/Loris so r03 and r04 still die in one real batch. */
export function simultaneousB8Preparation(initial: api.MatchState): api.MatchState {
  const leona = initial.preparation.units.find(u => u.team === 'player' && u.definitionId === 'leona')!;
  const loris = initial.preparation.units.find(u => u.team === 'player' && u.definitionId === 'loris')!;
  const slot = Array.from({length: initial.preparation.benchSize}, (_, i) => i).find(i =>
    !initial.preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === i));
  if (slot === undefined) throw new Error('Public B8 prefix needs one free bench slot');
  let state = accepted(api.deployMatchUnit(initial, leona.id, {kind:'bench', slot}));
  state = accepted(api.deployMatchUnit(state, loris.id, leona.location));
  return accepted(api.deployMatchUnit(state, leona.id, loris.location));
}

/** Keep actual equipment/receipts, bench every other hero through public commands. */
export function partialB8Preparation(initial: api.MatchState, definitionId: string): api.MatchState {
  const target = initial.preparation.units.find(u => u.team === 'player' && u.definitionId === definitionId)!;
  let state = initial, slot = 0;
  for (const unit of initial.preparation.units.filter(u => u.team === 'player' && u.id !== target.id))
    state = accepted(api.deployMatchUnit(state, unit.id, {kind:'bench', slot:slot++}));
  return accepted(api.deployMatchUnit(state, target.id, definitionId === 'zyra'
    ? {kind:'board', cell:{col:0, row:4}} : target.location));
}
