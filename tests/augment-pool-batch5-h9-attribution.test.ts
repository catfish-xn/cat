import { expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { augmentDeathsFromEvents, readAugmentCombatAttributions, readAugmentCombatDeaths, readAugmentDeathKiller } from '../src/simulation/augment-death-samples';

it('observes the real killing source beside stamped death events without modifying their public shape', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw new Error(started.reason);
  let state = started.state;
  let checked = 0;
  const observed: {combatId: string; eventSeq: number; killer: unknown}[] = [];
  while (state.phase === 'combat') {
    const step = stepMatch(state);
    state = step.state;
    for (const death of step.events.filter(e => e.type === 'death')) {
      const kill = step.events.find(e => e.type === 'kill' && e.unitId === death.unitId);
      if (!kill || kill.type !== 'kill') continue;
      const source = readAugmentDeathKiller(death);
      expect(source).toEqual(kill.source);
      const plain = augmentDeathsFromEvents(step.events).find(d => d.eventSeq === death.eventSeq)!;
      const attributed = augmentDeathsFromEvents(step.events, true).find(d => d.eventSeq === death.eventSeq)!;
      expect(plain).not.toHaveProperty('killer');
      expect(attributed.killer).toEqual(source);
      if (typeof death.combatId !== 'string' || typeof death.eventSeq !== 'number') throw new Error('missing stamped death identity');
      observed.push({combatId: death.combatId, eventSeq: death.eventSeq, killer: source});
      expect(death).not.toHaveProperty('killer');
      expect(source).not.toBe(kill.source);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
  const terminal = readAugmentCombatAttributions(state.combat!);
  for (const row of observed) {
    expect(terminal).toContainEqual(row);
    expect(readAugmentCombatDeaths(state.combat!, true).find(d => d.eventSeq === row.eventSeq)?.killer).toEqual(row.killer);
  }
  expect(readAugmentCombatAttributions(state.combat!)).not.toBe(terminal);
});

import { existsSync, readFileSync } from 'node:fs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_H9 } from '../src/simulation/content/augment-pool-batch5-h9';

it.skipIf(!existsSync(RESEARCH_FILE))('retains the 14.24 Golden Find source values and descriptions', () => {
  const row = AUGMENT_BATCH5_H9['a-golden-find'];
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((entry: {apiName: string}) => entry.apiName === row.apiName);
  expect(source.effects).toEqual(row.source.values);
  expect(source.name_zh_cn).toBe(row.name);
  expect(source.description_zh_cn).toBe(row.description);
  expect(source.description_en_us).toBe(row.source.description_en_us);
  expect(source.tier).toBe(2);
});

import { batch5H9FreeRerolls } from '../src/simulation/augment-pool-batch5-h9';

it('counts the Golden Find free credits only from its acquisition round onward', () => {
  const augment = {definitionId: 'a-golden-find', choiceId: 'choice', acquiredRound: 9};
  expect(batch5H9FreeRerolls({augments: [augment], round: 8})).toBe(0);
  expect(batch5H9FreeRerolls({augments: [augment], round: 9})).toBe(10);
  expect(batch5H9FreeRerolls({augments: [augment], round: 10})).toBe(10);
  expect(batch5H9FreeRerolls({augments: [], round: 10})).toBe(0);
});

import { preflightAugmentHistory } from '../src/simulation/augment-history-restore';
import { recordAugmentAcquisition, recordAugmentPvpRoster, recordAugmentTransition, requireAugmentFacts } from '../src/simulation/augment-history';

it('records an anomaly binding at battle entry and attaches observed killers only for a history owner', () => {
  const base = createMatch(42);
  const owned = recordAugmentAcquisition(base, {...base, augments: [{definitionId: 'a-golden-find', choiceId: 'probe', acquiredRound: base.round}]});
  const started = startMatchCombat(base);
  if (!started.ok) throw new Error(started.reason);
  let history = recordAugmentTransition(owned, {...started.state, augments: owned.augments, augmentHistory: owned.augmentHistory});
  expect(requireAugmentFacts(history, 'combat-binding', base.round)).toMatchObject([{battleId: history.combat!.combatId, binding: null}]);
  const both = recordAugmentPvpRoster(history, history.combat!.combatId!, [{seatId: 'solo', index: 0, hp: 100, alive: true, rank: 1, eliminatedRound: null, units: base.preparation.units, items: base.items}], null);
  expect(requireAugmentFacts(both, 'combat-binding', base.round)).toHaveLength(1);
  let raw = started.state;
  while (raw.phase === 'combat') {
    const step = stepMatch(raw);
    raw = step.state;
    history = recordAugmentTransition(history, {...raw, augments: owned.augments, augmentHistory: history.augmentHistory}, step.events);
  }
  const rows = requireAugmentFacts(history, 'deaths', base.round).flatMap(f => f.deaths);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.some(row => row.killer !== null && row.killer !== undefined)).toBe(true);
  expect(() => preflightAugmentHistory(history)).not.toThrow();
  const tampered = structuredClone(history);
  const fact = tampered.augmentHistory!.facts.find(f => f.kind === 'deaths' && f.deaths.length > 0);
  if (!fact || fact.kind !== 'deaths') throw new Error('missing death');
  delete (fact.deaths[0] as {killer?: unknown}).killer;
  expect(() => preflightAugmentHistory(tampered)).toThrow('death killer');
});

import { goldenFindGoldPlan } from '../src/simulation/augment-pool-batch5-h9';
import type { MatchState } from '../src/simulation/match-types';

it('derives threshold payouts from separate authenticated-history rows with a cross-battle remainder', () => {
  const base = createMatch(42);
  const holder = base.preparation.units.find(u => u.location.kind === 'board' && u.team === 'player')!;
  expect(holder).toBeDefined();
  const owner = {definitionId: 'a-golden-find', choiceId: 'golden', acquiredRound: 1};
  const killer = {ownerId: holder.id, sourceKind: 'attack', definitionId: holder.definitionId, instanceId: 'basic', effectIndex: 0};
  const death = (combatId: string, eventSeq: number, source: typeof killer) => ({combatId, eventSeq, tick: 1,
    unitId: `enemy-${eventSeq}`, definitionId: 'garen', team: 'enemy', ownerSeatId: null, originalUnitId: `enemy-${eventSeq}`,
    ordinaryHero: true, equipment: [], combatItemGrants: [], killer: source});
  const facts = [1, 2].flatMap(round => {
    const common = {round, roundId: `round-${round}`, seatId: 'solo', sequence: 0, resourcePrefix: 0};
    const battleId = `battle-${round}`;
    return [
      {...common, kind: 'combat-binding', battleId, binding: {unitId: holder.id, choiceId: 'anomaly', definitionId: 'power-up', boundRound: 1}},
      {...common, kind: 'combat-roster', battleId, roster: {units: base.preparation.units, items: base.items}},
      {...common, kind: 'deaths', battleId, completeThroughTick: 1, deaths: [death(battleId, round * 10, killer), death(battleId, round * 10 + 1, killer),
        death(battleId, round * 10 + 2, {...killer, ownerId: 'summon-proxy'})]},
    ];
  });
  const state = {...base, round: 2, augments: [owner], roundResults: [1, 2].map(round => ({round, result: 'playerWin', roundKind: 'pve', combatTicks: 1})),
    augmentHistory: {version: 'augment-history-v1', seatId: 'solo', proof: {kind: 'server'}, facts}} as unknown as MatchState;
  expect(goldenFindGoldPlan(state)).toEqual([{receiptId: JSON.stringify(['augment-b5-golden-find', 'golden', 2]),
    source: 'augment-b5-golden-find', round: 2, amount: 2}]);
});
