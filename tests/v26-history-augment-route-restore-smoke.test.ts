import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { stepMatch } from '../src/simulation/match';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { dispatch, run } from '../scripts/generate-m5-route.cjs';
import { accepted } from './match-helpers';
import type { MatchState } from '../src/simulation/match-types';

// Seed-42 public sniper picks snipers-nest at 2-1. Stop at 2-1 combat tick 30: roster/formation
// history is already written at combat start, so restore+replay still exercises augment history
// through the real battle without paying for the rest of 2-1, settlement, or 2-2 prep.
// Does not cover settlement or entering 2-2 preparation.
const BUILD = 'sniper';
const SEED = 42;
const STOP_ROUND = '2-1';
const STOP_COMBAT_TICK = 30;

type TailCommand = Parameters<typeof dispatch>[2];

function atCombatTick(state: MatchState, roundDefinitionId: string, tick: number): boolean {
  return state.roundDefinitionId === roundDefinitionId
    && state.phase === 'combat'
    && state.combat?.tick === tick;
}

function replayRouteTailUntil(
  state: MatchState,
  tail: readonly TailCommand[],
  stop: { roundDefinitionId: string; combatTick: number },
): MatchState {
  let current = state;
  for (const command of tail) {
    current = accepted(dispatch(api, current, command));
    while (current.phase === 'combat') {
      current = stepMatch(current).state;
      if (atCombatTick(current, stop.roundDefinitionId, stop.combatTick)) return current;
    }
  }
  throw new Error(`tail never reached ${stop.roundDefinitionId} combat tick ${stop.combatTick}`);
}

async function capturePublicSniperSmokeRoute(): Promise<{
  checkpoint: MatchState;
  tail: TailCommand[];
  referenceEnd: MatchState;
}> {
  let checkpoint: MatchState | undefined;
  let referenceEnd: MatchState | undefined;
  const tail: TailCommand[] = [];
  let recordTail = false;
  const done = new Error('history-augment smoke route captured');
  try {
    await run(api, {
      build: BUILD,
      seed: SEED,
      onStep(_before, result, command) {
        if (recordTail && command) tail.push(command);
        if (
          !checkpoint
          && command?.type === 'select'
          && command.definitionId === 'snipers-nest'
        ) {
          checkpoint = structuredClone(result.state);
          recordTail = true;
        }
        if (checkpoint && atCombatTick(result.state, STOP_ROUND, STOP_COMBAT_TICK)) {
          referenceEnd = result.state;
          throw done;
        }
      },
    });
  } catch (error) {
    if (error !== done) throw error;
  }
  if (!checkpoint) throw new Error(`public ${BUILD} route never acquired snipers-nest`);
  if (!referenceEnd) {
    throw new Error(`public ${BUILD} route never reached ${STOP_ROUND} combat tick ${STOP_COMBAT_TICK} after snipers-nest`);
  }
  if (tail.length === 0) throw new Error(`public ${BUILD} route produced no tail after snipers-nest`);
  return { checkpoint, tail, referenceEnd };
}

it('public sniper route with snipers-nest survives one mid-run serialize restore', async () => {
  const { checkpoint, tail, referenceEnd } = await capturePublicSniperSmokeRoute();
  expect(checkpoint.augments.map(augment => augment.definitionId)).toContain('snipers-nest');
  expect(Object.hasOwn(AUGMENT_HISTORY_OWNERS, 'snipers-nest')).toBe(true);
  const proof = checkpoint.augmentHistory?.proof;
  expect(proof?.kind).toBe('solo');
  if (proof?.kind !== 'solo') throw new Error('expected solo augment-history proof');
  expect(proof.origin.round).toBe(1);
  expect(checkpoint.augmentHistory!.facts.filter(fact => fact.kind === 'acquire').length).toBeGreaterThanOrEqual(1);
  expect(atCombatTick(referenceEnd, STOP_ROUND, STOP_COMBAT_TICK)).toBe(true);

  let restored = restoreMatch(serializeMatch(checkpoint));
  expect(restored).toEqual(checkpoint);
  restored = replayRouteTailUntil(restored, tail, { roundDefinitionId: STOP_ROUND, combatTick: STOP_COMBAT_TICK });
  expect(restored).toEqual(referenceEnd);
});
