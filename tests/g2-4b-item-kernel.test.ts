import { expect, it } from 'vitest';
import { nextRandom } from '../src/simulation/rng';
import { createItemRandomStreams, drawItemRandom, validateItemRandomStreams, chooseFishbonesTarget,
  deferItemDamage, advanceDeferredItemDamage, validateDeferredItemDamage, manaReavedMaximum,
  type ItemRandomPurpose } from '../src/simulation/g2-4b-item-kernel';

it('uses distinct explicit streams, preserves inputs and resumes from plain JSON', () => {
  const initial = createItemRandomStreams(42), frozen = JSON.stringify(initial);
  const first = chooseFishbonesTarget(initial, ['c', 'a', 'b']);
  expect(JSON.stringify(initial)).toBe(frozen);
  expect(first.streams.collector).toEqual(initial.collector);
  expect(first.streams['gamblers-blade']).toEqual(initial['gamblers-blade']);
  expect(chooseFishbonesTarget(JSON.parse(JSON.stringify(first.streams)), ['b', 'a', 'c']))
    .toEqual(chooseFishbonesTarget(first.streams, ['c', 'b', 'a']));
  const loot = drawItemRandom(initial, 'collector');
  expect(chooseFishbonesTarget(loot.streams, ['a', 'b', 'c']).targetId).toBe(first.targetId);
  expect(chooseFishbonesTarget(initial, []).streams).toBe(initial);
  expect(() => chooseFishbonesTarget(initial, ['a', 'a'])).toThrow();
});

it('validates skip-ahead against iterative LCG and rejects forged states, counts and fields', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) {
    let streams = createItemRandomStreams(seed);
    const counts = {fishbones: 0, collector: 0, 'gamblers-blade': 0};
    for (const purpose of Object.keys(counts) as ItemRandomPurpose[]) {
      let word = streams[purpose].state;
      for (let n = 0; n < 513; n++) {
        word = nextRandom(word).state;
        streams = drawItemRandom(streams, purpose).streams; counts[purpose]++;
      }
      expect(streams[purpose].state).toBe(word);
    }
    validateItemRandomStreams(streams, seed, counts);
    expect(() => validateItemRandomStreams({...streams, fishbones: {...streams.fishbones, state: 0}}, seed, counts)).toThrow();
    expect(() => validateItemRandomStreams(streams, seed, {...counts, collector: 512})).toThrow();
    expect(() => validateItemRandomStreams({...streams, hidden: 1} as typeof streams, seed, counts)).toThrow();
  }
});

it('preserves odd damage across exactly 80 ticks and a save/resume boundary', () => {
  const split = deferItemDamage('packet-1', 203, 7, 5000);
  expect(split.immediate).toBe(102);
  expect(split.debt.amount).toBe(101);
  let debt = split.debt, hp = 1000, total = 0;
  for (let tick = 8; tick <= 87; tick++) {
    const pulse = advanceDeferredItemDamage(debt, tick, hp, 80);
    total += pulse.damage; hp = pulse.hpAfter;
    debt = tick === 40 ? JSON.parse(JSON.stringify(pulse.debt)) : pulse.debt;
    expect(pulse.finished).toBe(tick === 87);
    expect(advanceDeferredItemDamage(debt, tick, hp, 80).damage).toBe(0);
  }
  expect(total).toBe(101); expect(hp).toBe(899);
  expect(() => advanceDeferredItemDamage(debt, 86, hp, 80)).toThrow();
});

it('nonlethal debt never revives or kills, and discarded damage does not return after healing', () => {
  const debt = deferItemDamage('packet', 1000, 0, 5000).debt;
  const one = advanceDeferredItemDamage(debt, 40, 1, 80);
  expect(one).toMatchObject({damage: 0, hpAfter: 1});
  expect(advanceDeferredItemDamage(one.debt, 41, 1000, 80).damage).toBe(6);
  expect(advanceDeferredItemDamage(debt, 80, 0, 80)).toMatchObject({damage: 0, hpAfter: 0, finished: true});
  expect(advanceDeferredItemDamage(debt, 80, 30, 80)).toMatchObject({damage: 29, hpAfter: 1});
});

it('rejects forged debt balances, future timestamps and invalid numeric inputs', () => {
  const debt = deferItemDamage('packet', 31, 10, 5000).debt;
  expect(() => validateDeferredItemDamage({...debt, paid: 1}, 11, 80)).toThrow();
  expect(() => validateDeferredItemDamage({...debt, elapsedTicks: 2}, 11, 80)).toThrow();
  expect(() => validateDeferredItemDamage({...debt, startedAtTick: 12}, 11, 80)).toThrow();
  expect(() => deferItemDamage('packet', -1, 0, 5000)).toThrow();
  expect(() => deferItemDamage('packet', 31, 0, 10001)).toThrow();
  expect(() => advanceDeferredItemDamage(debt, 11, 100, 0)).toThrow();
});

it('mana reave increases the cost without mutating the underlying maximum', () => {
  expect(manaReavedMaximum(100, 3000)).toBe(130);
  expect(manaReavedMaximum(0, 3000)).toBe(0);
  // Integer rounding is an explicitly pending convention until combat integration.
  expect(manaReavedMaximum(75, 3000)).toBe(98);
  expect(() => manaReavedMaximum(Number.MAX_SAFE_INTEGER, 3000)).toThrow();
});
