import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
import { getXpToNextLevel } from '../src/simulation/progression';

const accepted = (result: MatchCommandResult) => {
  if (!result.ok) throw Error(result.reason);
  return result;
};

it.each([8, 9])('level %i: paid 68 XP route across a live battle matches full-round bytes at every command and tick', level => {
  const base = api.createMatch(42);
  const deployed = accepted(api.deployMatchUnit(base, base.preparation.units[0]!.id,
    { kind: 'board', cell: { col: 3, row: 6 } })).state;
  // Transaction vector: 17 normal paid purchases, crossing exactly the 68 XP boundary before combat.
  let full: MatchState = { ...deployed, level, xp: 0, gold: 68 };
  let live = full;
  expect(getXpToNextLevel(level)).toBe(68);
  for (let i = 0; i < 16; i++) {
    const old = accepted(api.buyXp(full)), streamed = accepted(api.buyXp(live));
    expect(JSON.stringify(streamed)).toBe(JSON.stringify(old));
    full = old.state; live = streamed.state;
  }
  expect(full).toMatchObject({ level, xp: 64, gold: 4 });
  const oldPurchase = accepted(api.buyXp(full)), livePurchase = accepted(api.buyXp(live));
  expect(JSON.stringify(livePurchase)).toBe(JSON.stringify(oldPurchase));
  full = oldPurchase.state; live = livePurchase.state;
  expect(full).toMatchObject({ level: level + 1, xp: 0, gold: 0 });
  const oldOpen = accepted(api.startMatchCombat(full));
  const opened = api.openMatchCombatStream(live);
  if (!opened.ok) throw Error(opened.reason);
  expect(JSON.stringify({ state: opened.state, events: opened.events }))
    .toBe(JSON.stringify({ state: oldOpen.state, events: oldOpen.events }));
  full = oldOpen.state; live = opened.state;
  let ticks = 0;
  while (full.phase === 'combat') {
    const old = api.stepMatch(full), streamed = api.stepMatchCombatStream(live);
    const next = streamed.terminal ? accepted(api.settleMatchCombatStream(streamed.state, streamed.terminal)) : streamed;
    const events = streamed.terminal ? [...streamed.events, ...next.events] : next.events;
    expect(JSON.stringify({ state: next.state, events })).toBe(JSON.stringify(old));
    full = old.state; live = next.state; ticks++;
  }
  expect(ticks).toBeGreaterThan(1);
  expect(JSON.stringify(live)).toBe(JSON.stringify(full));
});
