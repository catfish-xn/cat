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

// Select the first Vander record only AFTER the complete public route, so the
// driver's ledger/shop/RNG and every battle's terminal assertions still run.
let activityRecord: BattleRecord | undefined;
const activityRoute = roundRouteCache(async onRound => {
  const history = new BattleHistory('activity-log');
  const combat = (events: readonly { domain?: string }[]) => events.filter(e => e.domain === 'combat') as LedgerCombatEvent[];
  const route = await run(api, { build: 'sniper', seed: 42, onRound, onBattleProgress: onRound, onStep(before, result, command) {
      if (!('events' in result)) throw new Error('route command rejected');
      history.observe({ before, after: result.state, events: combat(result.events), reason: command ? 'command' : 'tick' });
  } });
  const record = history.completedRecords.find(r => r.events.some(isVander));
  expect(record).toBeDefined();
  activityRecord = prepareInput(record!);
  expect(route.final.phase).toBe('gameOver');
  return route.final;
});

describe('N2-P2-3 activity log consumers', { concurrent: false }, () => {
  // Slots claim the next boundary in execution order, including under shuffle.
  // No randomly selected late slot can force a whole match into one test.
  const boundaries = ROUND_CATALOG.filter(r => r.kind !== 'supply').flatMap(r =>
    [150, 300, 450, 600, 750, 900, 1050, 1201].map(tick => r.ordinal - 1 + tick / 1201));
  let nextSegment = 0;
  for (let slot = 0; slot <= boundaries.length; slot++)
    it(`complete Vander route and live/replay lifecycle checks: work slot ${slot + 1}`, async () => {
      const segment = nextSegment++;
      if (segment < boundaries.length) await activityRoute.through(boundaries[segment]);
      else { await activityRoute.finish(); checkActivityLog(); }
    });
  function checkActivityLog() {
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
  }
});
