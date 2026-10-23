import { afterEach, describe, expect, it } from 'vitest';
import { randomSeed } from '../../../src/server/net/session';
import { nextRandom } from '../../../src/simulation/rng';
import { DamageResolver, TIMINGS } from '../helpers';
import { expectOk, startServer, type NetHarness } from './helpers';

describe('per-match seed on one server', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it.each([0, 42, 0xffffffff, randomSeed()])('uses configured seed %i for match zero, then a different seed', async seed => {
    const seeds: unknown[] = [];
    harness = await startServer({ seed, logger: (_level, event, fields) => {
      if (event === 'room.started') seeds.push(fields?.seed);
    } }, new DamageResolver(() => 100, false));
    const { server, clock } = harness;
    const client = await harness.connect();
    expectOk(await client.join('第一局'));
    expectOk(await client.start());
    const first = server.room!;
    expect(server.lobby.roomSeed).toBe(seed);
    expect(first.state.seats[0]!.seed).toBe(nextRandom(seed).word);
    clock.advance(TIMINGS.preparationMs);
    expect(first.state.phase).toBe('ended');
    await client.waitForView(view => view.phase.kind === 'ended');

    expectOk(await client.join('第二局'));
    expectOk(await client.start());
    expect(server.room).not.toBe(first);
    expect(server.room!.state.phase).toBe('preparation');
    const secondSeed = server.lobby.roomSeed!;
    expect(Number.isInteger(secondSeed)).toBe(true);
    expect(secondSeed).toBeGreaterThanOrEqual(0);
    expect(secondSeed).toBeLessThanOrEqual(0xffffffff);
    expect(secondSeed).not.toBe(seed);
    expect(server.room!.state.seats[0]!.seed).toBe(nextRandom(secondSeed).word);
    expect(seeds).toEqual([seed, secondSeed]);
  });
});
