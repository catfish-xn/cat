/** N2-P2-3: activityChanged reaches the shared event-log consumer (strategy log; the stats panel uses the same
 * m8EventText) for a real Vander channel, identically live and through the replay path, with no duplicate lines
 * and every lifecycle event (applied and its end) shown. */
import { describe, expect, it } from 'vitest';
import { roundRouteCache } from './fixtures/round-route-cache';
import { prepareInput } from './fixtures/prepared-input';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import type { BattleRecord } from '../src/m6/contracts';
import * as api from '../src/simulation/match';
import { run } from '../scripts/generate-m5-route.cjs';
import { BattleHistory, PlaybackSession } from '../src/replay';
import { combatEventText } from '../src/rendering/combat-feedback';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
type Activity = Extract<LedgerCombatEvent, { type: 'activityChanged' }>;
const isVander = (e: LedgerCombatEvent): e is Activity => e.type === 'activityChanged' && e.activity.source.definitionId === 'vander-ability';

// Only the first completed Vander record is consumed. Keep that original
// selection rule, but stop before generating unrelated later battles.
let activityRecord: BattleRecord | undefined;
const activityRoute = roundRouteCache(async onRound => {
  const history = new BattleHistory('activity-log'), stop = new Error('first Vander record');
  const combat = (events: readonly { domain?: string }[]) => events.filter(e => e.domain === 'combat') as LedgerCombatEvent[];
  let last = api.createMatch(42);
  try {
    await run(api, { build: 'sniper', seed: 42, onRound, onStep(before, result, command) {
      if (!('events' in result)) throw new Error('route command rejected');
      last = result.state;
      history.observe({ before, after: result.state, events: combat(result.events), reason: command ? 'command' : 'tick' });
      const record = history.completedRecords.find(r => r.events.some(isVander));
      if (record) { activityRecord = prepareInput(record); throw stop; }
    } });
  } catch (error) { if (error !== stop) throw error; }
  expect(activityRecord).toBeDefined(); return last;
});

describe('N2-P2-3 activity log consumers', () => {
  for (const round of ROUND_CATALOG.filter(r => r.kind !== 'supply'))
    it(`public Vander route through ${round.roundId}`, async () => { await activityRoute.through(round.ordinal); });
  it('a real Vander channel is logged once per lifecycle event, live and in replay', async () => {
    await activityRoute.finish();
    const record = activityRecord!;
    expect(record).toBeDefined();
    const live = record.events.filter(isVander);
    expect(live.some(e => e.reason === 'applied')).toBe(true);
    expect(live.some(e => e.reason !== 'applied')).toBe(true);
    // Replay path: the playback session publishes the same validated ledger to the same consumers.
    const playback = new PlaybackSession(record);
    const replayed = playback.seek(record.endTick).events;
    expect(replayed).toEqual(record.events);
    const name = (id: string | null) => id ?? '无';
    for (const ledger of [record.events, replayed]) {
      const activityLines = ledger.filter(e => e.type === 'activityChanged').map(e => combatEventText(e, name));
      expect(activityLines.every(line => typeof line === 'string' && line.length > 0)).toBe(true);
      const vander = ledger.filter(isVander);
      const vanderLines = vander.map(e => combatEventText(e, name)!);
      expect(vanderLines).toHaveLength(live.length);
      expect(vanderLines.every(line => line.includes('引导'))).toBe(true);
      // Applied lines carry the planned end; every end event is shown with its own reason (no lifecycle gap).
      vander.forEach((e, i) => { if (e.reason === 'applied') expect(vanderLines[i]).toContain(`至第 ${e.activity.expiresAtTick} 刻`); });
      // No duplicate: the channel is never also published as a status line.
      expect(ledger.filter(e => e.type === 'statusChanged').map(e => combatEventText(e, name)).filter(line => line?.includes('引导'))).toEqual([]);
    }
    playback.dispose();
  });
});
