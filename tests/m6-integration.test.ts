/** E-owned cross-module acceptance. Existing golden fixtures remain the route oracle. */
import { describe, expect, it } from 'vitest';
import { trajectoryHash } from './m6-integration-oracle.cjs';
import * as api from '../src/simulation/match';
import { run, type Route } from '../scripts/generate-m5-route.cjs';
import assertGolden from './fixtures/m5/assert-golden.cjs';
import { BattleHistory, PlaybackSession, validateBattleCollection, validateBattleRecord } from '../src/replay';
import { MatchSession } from '../src/rendering/match-session';
import { validateEnvelope } from '../src/persistence/format';
import type { SaveEnvelope } from '../src/m6/contracts';
import type { CombatEvent } from '../src/simulation/combat-types';
import { digestContent } from '../src/simulation/content';

const combatEvents = (events: readonly unknown[]) => events.filter(event => (event as { domain?: string }).domain === 'combat') as CombatEvent[];
type RetainedRoute = Omit<Route, 'rounds'> & { rounds: Array<Route['rounds'][number] & { before: api.MatchState; after: api.MatchState }> };

describe('M6 independent route/history/playback/session integration', () => {
  for (const build of ['cannon', 'sniper', 'mage', 'sniper-caitlyn']) it(`${build}: every completed battle has exact original state/events and isolated playback`, async () => {
    const runId = `independent-${build}`, history = new BattleHistory(runId);
    const trajectories = new Map<string, Map<number, string>>();
    const route = await run(api, { build, seed: 42, retainStates: true, onStep: (before, result, command) => { if (!('events' in result)) throw new Error('route rejected command'); history.observe({ before, after: result.state, events: combatEvents(result.events), reason: command ? 'command' : 'tick' }); const combat = result.state.combat; if (combat) { let ticks = trajectories.get(combat.combatId!); if (!ticks) { ticks = new Map(); trajectories.set(combat.combatId!, ticks); } ticks.set(combat.tick, trajectoryHash(combat)); } } }) as RetainedRoute;
    assertGolden(route);
    expect(history.completedRecords).toHaveLength(30);
    expect(history.capturePrefix()).toBeNull();
    const active = new MatchSession(route.final, combatEvents(route.rounds.at(-1)!.events));
    const immutableActive = structuredClone({ state: active.state, events: active.combatEvents });
    for (const record of history.completedRecords) {
      const original = route.rounds.find(round => round.round === record.context.round)!;
      expect(record.events).toEqual(combatEvents(original.events));
      expect(record.context).toEqual(original.before);
      const verified = validateBattleRecord(record);
      expect(verified.settledMatch).toEqual(original.after);
      const playback = new PlaybackSession(record);
      expect(playback.read().combat).toEqual(record.initial);
      expect(playback.read().events).toEqual(record.events.filter(event => event.tick === 0));
      // Independent expected SHA256 comes from the original command route's every-tick Match output.
      const trajectory = trajectories.get(record.combatId)!;
      playback.play();
      for (let tick = 1; tick <= record.endTick; tick++) {
        const observed = playback.advance(50);
        expect(observed.tick).toBe(tick);
        expect(trajectoryHash(observed.combat), `${build}/${record.combatId}/tick${tick}`).toBe(trajectory.get(tick));
      }
      for (const tick of [81, 80, 79, 41, 40, 39].filter(tick => tick <= record.endTick))
        expect(trajectoryHash(playback.seek(tick).combat), `checkpoint-neighbor ${tick}`).toBe(trajectory.get(tick));
      const middle = Math.floor(record.endTick / 2);
      let model = api.startMatchCombat(record.context).state;
      while (model.combat!.tick < middle) model = api.stepMatch(model).state;
      expect(playback.seek(middle).combat).toEqual(model.combat);
      playback.pause(); const paused = playback.read(); playback.advance(10000); expect(playback.read()).toEqual(paused);
      expect(playback.seek(record.endTick).combat).toEqual(original.after!.combat);
      expect(playback.read().events).toEqual(record.events);
      playback.seek(0); playback.setSpeed(4); playback.play(); playback.advance(50);
      expect(playback.read().tick).toBe(Math.min(4, record.endTick));
      playback.setSpeed(2); playback.pause(); playback.seek(middle);
      expect(playback.read().combat).toEqual(model.combat);
      expect({ state: active.state, events: active.combatEvents }).toEqual(immutableActive);
      playback.dispose(); expect(() => playback.read()).toThrow();
    }
    const envelope: SaveEnvelope = { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1, runId, createdAt: '2026-10-06T00:00:00.000Z', match: route.final, battles: history.completedRecords, currentBattle: null };
    await expect(validateEnvelope(envelope, validateBattleCollection)).resolves.toEqual(envelope);
    if (build === 'cannon') {
      // A missing WHOLE battle is invalid even though each remaining battle is individually valid.
      await expect(validateEnvelope({ ...envelope, battles: envelope.battles.slice(1) }, validateBattleCollection)).rejects.toThrow();
      const badEvent = structuredClone(envelope.battles[0]);
      (badEvent.events as CombatEvent[]).splice(1, 1);
      expect(() => validateBattleRecord(badEvent)).toThrow();
      const wrongInitial = structuredClone(envelope.battles[0]);
      (wrongInitial.initial as { tick: number }).tick = 1;
      expect(() => validateBattleRecord(wrongInitial)).toThrow();
      const wrongHistorical = structuredClone(envelope.battles[0]);
      (wrongHistorical as { context: api.MatchState }).context = route.rounds.at(-1)!.before!;
      expect(() => validateBattleRecord(wrongHistorical)).toThrow();
      expect(route.actions.some(action => action.command?.type === 'sell')).toBe(true);
      expect(history.completedRecords.some(record => record.context.preparation.units.some(unit => unit.team === 'player' && !route.final.preparation.units.some(final => final.id === unit.id)))).toBe(true);
      // Two completed battles, then exact tick39/40/41 current prefix round trips.
      const third = route.rounds[2], session = new MatchSession(third.before!);
      const partial = new BattleHistory(runId, history.completedRecords.slice(0, 2));
      const observed: number[] = [];
      const unsubscribe = session.subscribe(change => { partial.observe(change); if (change.reason === 'tick') observed.push(change.after.combat!.tick); });
      expect(session.start().ok).toBe(true);
      session.advance(39 * 50);
      for (const tick of [39, 40, 41]) {
        if (session.combat!.tick < tick) session.advance(50);
        const prefix = partial.capturePrefix()!;
        expect(prefix.endTick).toBe(tick); expect(prefix.nextEventSeq).toBe(session.combat!.nextEventSeq);
        const candidate = { ...envelope, match: session.state, battles: partial.completedRecords, currentBattle: prefix };
        await expect(validateEnvelope(candidate, validateBattleCollection)).resolves.toEqual(candidate);
        const restored = new MatchSession(candidate.match, prefix.events);
        expect(restored.combatEvents).toEqual(session.combatEvents);
        expect(restored.advance(50)).toEqual(api.stepMatch(session.state).events.filter(event => event.domain === 'combat'));
      }
      expect(observed).toEqual(Array.from({ length: 41 }, (_, index) => index + 1));
      const before = structuredClone(session.state), ledger = session.combatEvents;
      session.advance(49); session.pause('import'); session.advance(999999);
      expect(session.reroll().ok).toBe(false); expect(session.buyXp().ok).toBe(false); expect(session.sell(before.preparation.units[0].id).ok).toBe(false);
      session.pause('replay'); session.resume('import'); session.advance(50); expect(session.state).toEqual(before);
      session.resume('replay'); session.advance(1); expect(session.state).toEqual(before); expect(session.combatEvents).toEqual(ledger);
      session.advance(49); expect(session.combat!.tick).toBe(42);
      expect(digestContent(session.state)).toBe(digestContent(api.stepMatch(before).state));
      unsubscribe(); const count = observed.length; session.advance(50); expect(observed).toHaveLength(count);
      session.dispose();
    }
    active.dispose();
  }, 120000);
});
