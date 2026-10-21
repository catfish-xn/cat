import { deepStrictEqual } from 'node:assert';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
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
import type { LedgerCombatEvent as CombatEvent } from '../src/simulation/combat-types';
import { digestContent } from '../src/simulation/content';

const combatEvents = (events: readonly unknown[]) => events.filter(event => (event as { domain?: string }).domain === 'combat') as CombatEvent[];
type RetainedRoute = Omit<Route, 'rounds'> & { rounds: Array<Route['rounds'][number] & { before: api.MatchState; after: api.MatchState }> };

export function registerM6Integration(builds: readonly string[]): void {
const fullEnvelopes=new Map<string,SaveEnvelope>();
let cannonTransition:{route:RetainedRoute;history:BattleHistory}|undefined;
describe('M6 independent route/history/playback/session integration', () => {
  for (const build of builds) it(`${build}: every completed battle has exact original state/events and isolated playback`, async () => {
    const runId = `independent-${build}`, history = new BattleHistory(runId);
    const trajectories = new Map<string, Map<number, string>>();
    const route = await run(api, { build, seed: 42, retainStates: true, onStep: (before, result, command) => { if (!('events' in result)) throw new Error('route rejected command'); history.observe({ before, after: result.state, events: combatEvents(result.events), reason: command ? 'command' : 'tick' }); const combat = result.state.combat; if (combat) { let ticks = trajectories.get(combat.combatId!); if (!ticks) { ticks = new Map(); trajectories.set(combat.combatId!, ticks); } ticks.set(combat.tick, trajectoryHash(combat)); } } }) as RetainedRoute;
    assertGolden(route);
    expect(history.completedRecords).toHaveLength(ROUND_CATALOG.filter(r=>r.kind!=='supply').length);
    expect(history.capturePrefix()).toBeNull();
    const active = new MatchSession(route.final, combatEvents(route.rounds.at(-1)!.events));
    const immutableActive = structuredClone({ state: active.state, events: active.combatEvents });
    for (const record of history.completedRecords) {
      const original = route.rounds.find(round => round.round === record.context.round)!;
      deepStrictEqual(record.events, combatEvents(original.events));
      deepStrictEqual(record.context, original.before);
      const verified = validateBattleRecord(record);
      deepStrictEqual(verified.settledMatch, original.after);
      const playback = new PlaybackSession(record);
      deepStrictEqual(playback.read().combat, record.initial);
      // Event tick is the semantic phase, not the committed-prefix boundary.
      // B3 emits tick-0 opening moves during the first step, after initial capture.
      const independentlyStarted = api.startMatchCombat(record.context);
      if (!independentlyStarted.ok) throw new Error('record context cannot start');
      const initialEvents = combatEvents(independentlyStarted.events);
      deepStrictEqual(record.initial, independentlyStarted.state.combat);
      expect(record.initial.nextEventSeq).toBe(initialEvents.length);
      deepStrictEqual(playback.read().events, initialEvents);
      deepStrictEqual(record.events.slice(0, initialEvents.length), initialEvents);
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
      deepStrictEqual(playback.seek(middle).combat, model.combat);
      playback.pause(); const paused = playback.read(); playback.advance(10000); deepStrictEqual(playback.read(), paused);
      deepStrictEqual(playback.seek(record.endTick).combat, original.after!.combat);
      deepStrictEqual(playback.read().events, record.events);
      playback.seek(0); playback.setSpeed(4); playback.play(); playback.advance(50);
      expect(playback.read().tick).toBe(Math.min(4, record.endTick));
      playback.setSpeed(2); playback.pause(); playback.seek(middle);
      deepStrictEqual(playback.read().combat, model.combat);
      deepStrictEqual({ state: active.state, events: active.combatEvents }, immutableActive);
      playback.dispose(); expect(() => playback.read()).toThrow();
    }
    const envelope: SaveEnvelope = { kind: 'hex-autobattler-save', saveFormatVersion: 6, replayFormatVersion: 4, runId, createdAt: '2026-10-06T00:00:00.000Z', match: route.final, battles: history.completedRecords, currentBattle: null };
    fullEnvelopes.set(build,envelope); // Positive full-save acceptance at the catalog capacity runs below (B9).
    if (build === 'cannon') {
      const badEvent = structuredClone(envelope.battles[0]);
      (badEvent.events as CombatEvent[]).splice(1, 1);
      expect(() => validateBattleRecord(badEvent)).toThrow();
      const wrongInitial = structuredClone(envelope.battles[0]);
      (wrongInitial.initial as { tick: number }).tick = 1;
      expect(() => validateBattleRecord(wrongInitial)).toThrow();
      const wrongHistorical = structuredClone(envelope.battles[0]);
      (wrongHistorical as { context: api.MatchState }).context = route.rounds.at(-1)!.before!;
      expect(() => validateBattleRecord(wrongHistorical)).toThrow();
      cannonTransition={route,history};
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
        deepStrictEqual(await validateEnvelope(candidate, validateBattleCollection), candidate);
        // A legal two-battle prefix isolates missing-history rejection from B9's full-run capacity limit.
        await expect(validateEnvelope({ ...candidate, battles: candidate.battles.slice(1) }, validateBattleCollection)).rejects.toThrow('历史缺战或重战');
        const restored = new MatchSession(candidate.match, prefix.events);
        deepStrictEqual(restored.combatEvents, session.combatEvents);
        deepStrictEqual(restored.advance(50), api.stepMatch(session.state).events.filter(event => event.domain === 'combat'));
      }
      deepStrictEqual(observed, Array.from({ length: 41 }, (_, index) => index + 1));
      const before = structuredClone(session.state), ledger = session.combatEvents;
      session.advance(49); session.pause('import'); session.advance(999999);
      expect(session.reroll().ok).toBe(false); expect(session.buyXp().ok).toBe(false); expect(session.sell(before.preparation.units[0].id).ok).toBe(false);
      session.pause('replay'); session.resume('import'); session.advance(50); deepStrictEqual(session.state, before);
      session.resume('replay'); session.advance(1); deepStrictEqual(session.state, before); deepStrictEqual(session.combatEvents, ledger);
      session.advance(49); expect(session.combat!.tick).toBe(42);
      expect(digestContent(session.state)).toBe(digestContent(api.stepMatch(before).state));
      unsubscribe(); const count = observed.length; session.advance(50); expect(observed).toHaveLength(count);
      session.dispose();
    }
    active.dispose();
  // Idle single-worker measurement: 82.99/134.39/123.06/130.34s; preserve every tick/assertion.
  // 临时、用户 10-20 批准：只因 CI 机器计时超时或贴着上限（断言都过），按约 2 倍放宽；断言不变。180 秒 → 360 秒（本机满负载 sniper-caitlyn 约 108 秒）。
  }, 360000);
  if (builds.includes('cannon')) it('[B8] cannon: completed history retains sold opening transition units',()=>{
    const {route,history}=cannonTransition!;
      expect(route.actions.some(action => action.command?.type === 'sell')).toBe(true);
      expect(history.completedRecords.some(record => record.context.preparation.units.some(unit => unit.team === 'player' && !route.final.preparation.units.some(final => final.id === unit.id)))).toBe(true);
  });
  for(const build of builds)it(`${build}: full catalog-capacity envelope acceptance (B9)`,async()=>{
    const envelope=fullEnvelopes.get(build)!;
    deepStrictEqual(await validateEnvelope(envelope, validateBattleCollection), envelope);
    if(build==='cannon')await expect(validateEnvelope({ ...envelope, battles: envelope.battles.slice(1) }, validateBattleCollection)).rejects.toThrow();
  }, 120000);
});
}
