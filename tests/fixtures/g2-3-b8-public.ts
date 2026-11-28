import * as api from '../../src/simulation/match';

const accepted = (result: api.MatchCommandResult): api.MatchState => {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

/** 14.24 stats: publicly swap Leona/Loris so r03 and r04 still die in one real batch. */
export function simultaneousB8Preparation(initial: api.MatchState, zyraCell: {col:number,row:number} = {col:6, row:5}): api.MatchState {
  const leona = initial.preparation.units.find(u => u.team === 'player' && u.definitionId === 'leona')!;
  const loris = initial.preparation.units.find(u => u.team === 'player' && u.definitionId === 'loris')!;
  const slot = Array.from({length: initial.preparation.benchSize}, (_, i) => i).find(i =>
    !initial.preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === i));
  if (slot === undefined) throw new Error('Public B8 prefix needs one free bench slot');
  let state = accepted(api.deployMatchUnit(initial, leona.id, {kind:'bench', slot}));
  state = accepted(api.deployMatchUnit(state, loris.id, leona.location));
  state = accepted(api.deployMatchUnit(state, leona.id, loris.location));
  // 2026-11-16: Zyra's vines now land CAST_WINDUP_TICKS.zyra after her cast, which broke the old same-tick pair (r02/r03 at
  // tick 127) and the terminal pair. One public deploy of Zyra restores each: on the empty (3,4) r02 and r04 die in one live
  // tick (the default); on the empty (4,7) r00 and r01 die together in the action that ends combat.
  // 2026-11-25 (#791 ranged attack wind-up) both pairs split; scene re-picked over every player hex: onto Leona's post-swap
  // (6,5) (the deploy swaps the two) r01 and r04 die in one live tick, now the default; on the empty (3,6) r00 and r03 die
  // together in the action that ends combat.
  const zyra = state.preparation.units.find(u => u.team === 'player' && u.definitionId === 'zyra')!;
  return accepted(api.deployMatchUnit(state, zyra.id, {kind:'board', cell:{...zyraCell}}));
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
