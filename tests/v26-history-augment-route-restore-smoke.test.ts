import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { stepMatch } from '../src/simulation/match';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { dispatch, run } from '../scripts/generate-m5-route.cjs';
import { accepted } from './match-helpers';
import type { MatchState } from '../src/simulation/match-types';

// Full seed-42 sniper victory replays ~37 s in one vitest case. Capture the genuine
// public route once at import; the case only replays the tail after one serialize→restore.
// Checkpoint immediately after the public 2-1 snipers-nest pick; tail is the rest of 2-1
// through one battle into 2-2 preparation.
const BUILD = 'sniper';
const SEED = 42;
const END = '2-2';

type TailCommand = Parameters<typeof dispatch>[2] | undefined;

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
        if (recordTail) tail.push(command);
        if (
          !checkpoint
          && command?.type === 'select'
          && command.definitionId === 'snipers-nest'
        ) {
          checkpoint = structuredClone(result.state);
          recordTail = true;
        }
        if (checkpoint && result.state.roundDefinitionId === END && result.state.phase === 'preparation') {
          referenceEnd = structuredClone(result.state);
          throw done;
        }
      },
    });
  } catch (error) {
    if (error !== done) throw error;
  }
  if (!checkpoint) throw new Error(`public ${BUILD} route never acquired snipers-nest`);
  if (!referenceEnd) throw new Error(`public ${BUILD} route never reached ${END} preparation after snipers-nest`);
  if (tail.length === 0) throw new Error(`public ${BUILD} route produced no tail after snipers-nest`);
  return { checkpoint, tail, referenceEnd };
}

const routeCapture = capturePublicSniperSmokeRoute();

it('public sniper route with snipers-nest survives one mid-run serialize restore', async () => {
  const { checkpoint, tail, referenceEnd } = await routeCapture;
  expect(checkpoint.augments.map(augment => augment.definitionId)).toContain('snipers-nest');
  expect(Object.hasOwn(AUGMENT_HISTORY_OWNERS, 'snipers-nest')).toBe(true);
  const proof = checkpoint.augmentHistory?.proof;
  expect(proof?.kind).toBe('solo');
  if (proof?.kind !== 'solo') throw new Error('expected solo augment-history proof');
  expect(proof.origin.round).toBe(1);
  expect(checkpoint.augmentHistory!.facts.filter(fact => fact.kind === 'acquire').length).toBeGreaterThanOrEqual(1);
  expect(referenceEnd.roundDefinitionId).toBe(END);

  let restored = restoreMatch(serializeMatch(checkpoint));
  expect(restored).toEqual(checkpoint);
  for (const command of tail) {
    if (command) restored = accepted(dispatch(api, restored, command));
    else restored = stepMatch(restored).state;
  }
  expect(restored).toEqual(referenceEnd);
});
