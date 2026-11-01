import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { stepMatch } from '../src/simulation/match';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { dispatch, run } from '../scripts/generate-m5-route.cjs';
import { accepted } from './match-helpers';
import type { MatchState } from '../src/simulation/match-types';

// Full seed-42 sniper victory with snipers-nest + rebel-resurgence replays ~37 s in one
// vitest case. Stop at 2-6 preparation instead: snipers-nest is already on the route,
// augmentHistory has replayed from round 1, and the tail stays within the default timeout.
const BUILD = 'sniper';
const SEED = 42;
const CHECKPOINT = '2-5';
const END = '2-6';

it('public sniper route with snipers-nest survives one mid-run serialize restore', async () => {
  let checkpoint: MatchState | undefined;
  const tail: (Parameters<typeof dispatch>[2] | undefined)[] = [];
  let recordTail = false;
  const done = new Error('history-augment smoke route captured');
  try {
    await run(api, {
      build: BUILD,
      seed: SEED,
      onStep(_before, result, command) {
        if (recordTail) tail.push(command);
        if (!checkpoint && result.state.roundDefinitionId === CHECKPOINT && result.state.phase === 'preparation') {
          checkpoint = structuredClone(result.state);
          recordTail = true;
        }
        if (checkpoint && result.state.roundDefinitionId === END && result.state.phase === 'preparation') throw done;
      },
    });
  } catch (error) {
    if (error !== done) throw error;
  }
  expect(checkpoint).toBeDefined();
  expect(tail.length).toBeGreaterThan(0);
  expect(checkpoint!.augments.map(augment => augment.definitionId)).toContain('snipers-nest');
  expect(Object.hasOwn(AUGMENT_HISTORY_OWNERS, 'snipers-nest')).toBe(true);
  const proof = checkpoint!.augmentHistory?.proof;
  expect(proof?.kind).toBe('solo');
  if (proof?.kind !== 'solo') throw new Error('expected solo augment-history proof');
  expect(proof.origin.round).toBe(1);
  expect(checkpoint!.augmentHistory!.facts.filter(fact => fact.kind === 'acquire').length).toBeGreaterThanOrEqual(1);

  let reference = structuredClone(checkpoint!);
  let restored = restoreMatch(serializeMatch(checkpoint!));
  expect(restored).toEqual(checkpoint);
  for (const command of tail) {
    if (command) {
      reference = accepted(dispatch(api, reference, command));
      restored = accepted(dispatch(api, restored, command));
    } else {
      reference = stepMatch(reference).state;
      restored = stepMatch(restored).state;
    }
  }
  expect(reference.roundDefinitionId).toBe(END);
  expect(restored).toEqual(reference);
});
