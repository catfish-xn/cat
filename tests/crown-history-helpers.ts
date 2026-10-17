import { startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { BattleHistory } from '../src/replay/history';

/** Recorder driven only by committed public commands, just like MatchSession. */
export function recordedCrownBattle(context: MatchState, history = new BattleHistory('crown-history')) {
  const start = startMatchCombat(context);
  if (!start.ok) throw new Error(start.reason);
  let state = start.state;
  history.observe({ before: context, after: state, events: start.events.filter(e => e.domain === 'combat'), reason: 'command' });
  while (state.phase === 'combat') {
    const before = state, step = stepMatch(state); state = step.state;
    history.observe({ before, after: state, events: step.events.filter(e => e.domain === 'combat'), reason: 'tick' });
  }
  return { state, history, battles: history.completedRecords };
}
