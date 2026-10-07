import { describe, expect, it } from 'vitest';
import { startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { battle, deployed, freeze } from './match-helpers';
import { BattleHistory, PlaybackSession } from '../src/replay';
import type { CombatEvent } from '../src/simulation/combat-types';
import type { MatchState } from '../src/simulation/match-types';
function active(): MatchState {
  let state = battle();
  for (let i = 0; i < 120 && state.phase === 'combat'; i++) {
    state = stepMatch(state).state;
    if (state.combat!.units.some(u => u.shieldLayers?.some(l => l.remaining > 0))) return state;
  }
  throw new Error('Expected an ordinary active sourced shield');
}
const copy = (s: MatchState): any => JSON.parse(JSON.stringify(s));
describe('B3 second batch restore binds finite programs and accounting facts', () => {
  it('ordinary tick0 and active shields restore without new grants, events or random draws', () => {
    for (const state of [battle(), active()]) {
      const restored = restoreMatch(serializeMatch(state)); expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual(stepMatch(state));
    }
  });
  it('stepping frozen sourced shields and declarations preserves every prior snapshot', () => {
    let state = active();
    const retained: { state: MatchState; json: string }[] = [];
    for (let i = 0; i < 80 && state.phase === 'combat'; i++) {
      const json = serializeMatch(state); retained.push({ state, json });
      freeze(state); state = stepMatch(state).state;
    }
    for (const prior of retained) expect(serializeMatch(prior.state)).toBe(prior.json);
  });
  it('retained playback snapshots stay frozen and independent across advance, seek and disposal', () => {
    let state = deployed(); const history = new BattleHistory('b3-isolation');
    const observe = (result: ReturnType<typeof stepMatch>, reason: 'command' | 'tick') => {
      history.observe({ before: state, after: result.state, events: result.events.filter(e => e.domain === 'combat') as CombatEvent[], reason }); state = result.state;
    };
    const start = startMatchCombat(state); if (!start.ok) throw new Error(start.reason);
    observe(start, 'command');
    while (state.phase === 'combat') observe(stepMatch(state), 'tick');
    const record = history.completedRecords[0], first = new PlaybackSession(record), second = new PlaybackSession(record);
    const retained = first.read(), json = JSON.stringify(retained);
    first.play(); first.advance(200); first.seek(Math.floor(record.endTick / 2)); first.dispose();
    expect(Object.isFrozen(retained.combat.units)).toBe(true); expect(Object.isFrozen(retained.events)).toBe(true);
    expect(JSON.stringify(retained)).toBe(json); expect(second.read().combat).toEqual(record.initial); second.dispose();
  });
  it.each([
    ['forged definitions', (s: any) => { s.combat.units[0].mechanismDefinitions.vamp.push({ source: {}, modifier: {}, allyBps: 10000 }); }],
    ['lost initialized marker', (s: any) => { s.combat.units[0].mechanismState.initialized = false; }],
    ['wrong combat namespace', (s: any) => { s.combat.units[0].mechanismState.combatId = 'foreign'; }],
    ['invented remainder', (s: any) => { s.combat.units[0].mechanismState.periodicTasks.push({ key: 'fake', remainders: [{ effectIndex: 0, targetId: 'other', numerator: 1, denominator: 0 }] }); }],
    ['invented trigger consumption', (s: any) => { s.combat.units[0].mechanismState.runtimes.push({ key: 'fake', consumed: true }); }],
    ['wrong HP basis', (s: any) => { s.combat.units[0].maxHpBasis.base++; }],
    ['shield double absorption', (s: any) => { s.combat.units.flatMap((u: any) => u.shieldLayers).find((l: any) => l.remaining > 0).m8State.absorbed++; }],
    ['shield lost frozen record', (s: any) => { delete s.combat.units.flatMap((u: any) => u.shieldLayers).find((l: any) => l.remaining > 0).m8State; }],
    ['shield foreign identity', (s: any) => { s.combat.units.flatMap((u: any) => u.shieldLayers).find((l: any) => l.remaining > 0).m8State.targetId = 'foreign'; }],
    ['shield lost end declaration', (s: any) => { delete s.combat.units.flatMap((u: any) => u.shieldLayers).find((l: any) => l.remaining > 0).m8Grant; }],
  ] as const)('rejects %s without changing original state', (_name, corrupt) => {
    const state = active(), invalid = copy(state); corrupt(invalid);
    expect(() => restoreMatch(invalid)).toThrow(); expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
});
