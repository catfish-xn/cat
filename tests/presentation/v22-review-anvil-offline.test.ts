import { afterEach, expect, it, vi } from 'vitest';
import { MatchSession } from '../../src/rendering/match-session';
import { createMatch } from '../../src/simulation/match';
import { createOpeningEncounter } from '../../src/simulation/opening-encounter';
import { isAnvil } from '../../src/simulation/content/anvils';

let session: MatchSession | undefined;
afterEach(() => { session?.dispose(); session = undefined; vi.useRealTimers(); });

// #430 / docs/ANVIL_UNITS.md: the offline application must also bind the
// 30-second window. Current MatchSession only advances combat, so the opened
// armory remains pending indefinitely. Remove .fails when that binding lands.
it.fails('offline anvil sale selects the first offer after its own 30-second window', () => {
  vi.useFakeTimers();
  let seed = 0;
  while (seed < 20_000 && createOpeningEncounter(seed).selection.encounterId !== 'artifact-anvil') seed++;
  if (seed === 20_000) throw new Error('missing artifact-anvil seed');
  session = new MatchSession(createMatch(seed));
  const anvil = session.preparation.units.find(u => isAnvil(u.definitionId))!;
  const opened = session.sell(anvil.id);
  expect(opened.ok).toBe(true);
  const choice = session.state.pendingChoice!;
  expect(choice.payload).toMatchObject({ source: 'anvil-unit', timeoutMs: 30_000 });
  vi.advanceTimersByTime(29_999); session.advanceDisplay(29_999);
  expect(session.state.pendingChoice?.choiceId).toBe(choice.choiceId);
  vi.advanceTimersByTime(2); session.advanceDisplay(2);
  expect(session.state.pendingChoice).toBeNull();
  expect(session.state.items.at(-1)?.definitionId).toBe(choice.offers[0]);
});

it('carries the server armory deadline through private projection and display adaptation on reconnect', async () => {
  const { toSeatPrivateView } = await import('../../src/server/room/projection');
  const { toDisplayMatch } = await import('../../src/rendering/online/seat-view-adapter');
  const { openAnvil } = await import('../../src/simulation/match');
  let seed = 0;
  while (seed < 20_000 && createOpeningEncounter(seed).selection.encounterId !== 'artifact-anvil') seed++;
  const initial = createMatch(seed);
  const result = openAnvil(initial, initial.preparation.units.find(u => isAnvil(u.definitionId))!.id);
  if (!result.ok) throw new Error(result.reason);
  const choice = result.state.pendingChoice!;
  const deadline = { choiceId: choice.choiceId, generation: choice.generation, deadlineAt: 80_000 };
  const project = () => toDisplayMatch(JSON.parse(JSON.stringify(toSeatPrivateView(result.state, deadline))));
  expect(project()).toMatchObject({ pendingChoice: { choiceId: choice.choiceId }, choiceDeadline: { choiceId: choice.choiceId, generation: choice.generation, endsAt: 80_000 } });
  expect(project()).toEqual(project()); // reconnect must carry the original deadline, never create a new window
  for (const wrong of [{ ...deadline, choiceId: 'stale' }, { ...deadline, generation: choice.generation + 1 }]) {
    expect(toSeatPrivateView(result.state, wrong)).not.toHaveProperty('choiceDeadline');
  }
  expect(toSeatPrivateView(initial, deadline)).not.toHaveProperty('choiceDeadline');
});
