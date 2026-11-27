import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { SMEECH_RELEAP_AFTER_KILL_TICKS, SMEECH_RELEAP_FLIGHT_TICKS, SMEECH_STAB_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { hexDistance } from '../src/simulation/board';
import { packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Smeech after a kill (11-25, user decision; docs/S13_RULES_GAP.md 史密奇击杀后再跳): when one of his stabs kills his target he
// stands still (no step, no attack), takes off for the next target SMEECH_RELEAP_AFTER_KILL_TICKS after the kill, lands
// SMEECH_RELEAP_FLIGHT_TICKS later (in the air he keeps his hex for the rules, still no step and no attack) and strikes on landing.
// The stab interval, the 4-hex range and the reduced re-leap damage are unchanged.
const smeech = (): CombatUnit => unit('p', 'player', 1, 3, { definitionId: 'smeech', starLevel: 2, ability: resolveAbility('smeech-ability', 2), hp: 4000, maxHp: 5000,
  armor: 0, magicResist: 0, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 1, abilityPower: 100, baseAttackSpeedBps: 7000, cooldownTicks: 0,
  moveCooldownTicks: 0, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] } as any);
const dummy = (id: string, col: number, row: number, hp: number): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp, maxHp: hp, armor: 0, magicResist: 0, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] } as any);
function run(units: CombatUnit[], n: number) {
  let state = battle(units, { rngState: 42 }); const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let i = 0; i < n && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return out;
}
const mineIn = (out: { tick: number; events: readonly CombatEvent[] }[], kind: string, from: number, to: number) => out.filter(s => s.tick > from && s.tick <= to)
  .flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === kind).map(() => s.tick));
const mine = (out: ReturnType<typeof run>, sourceKind: string) => out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === sourceKind).map(p => [s.tick, p.unitId] as const));

describe('Smeech stands still after a stab kill, then re-leaps', () => {
  it('a kill on his second stab: no step and no attack until he lands; take-off SMEECH_RELEAP_AFTER_KILL_TICKS after the kill, landing and strike SMEECH_RELEAP_FLIGHT_TICKS after that', () => {
    const out = run([smeech(), dummy('e', 3, 3, 400), dummy('far', 6, 2, 100000)], 60);
    const kill = out.find(s => s.events.some(e => e.type === 'death' && e.unitId === 'e'))!.tick;
    expect(mine(out, 'ability').filter(([, id]) => id === 'e').map(([t]) => t)).toEqual([kill - SMEECH_STAB_TICKS, kill]);
    const takeOff = kill + SMEECH_RELEAP_AFTER_KILL_TICKS, leapTick = takeOff + SMEECH_RELEAP_FLIGHT_TICKS;
    const marker = out.flatMap(s => s.events.filter(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again'));
    expect(marker.map(m => m.type === 'abilityMarker' && [m.tick, m.arrivalTick])).toEqual([[takeOff, leapTick]]);
    const moves = out.flatMap(s => s.events.filter(e => e.type === 'movement' && e.unitId === 'p').map(() => s.tick));
    expect(moves.filter(t => t > kill && t <= leapTick)).toEqual([leapTick]);
    expect(mine(out, 'attack').filter(([t]) => t > kill && t <= leapTick)).toEqual([]);
    expect(mine(out, 'ability').filter(([, id]) => id === 'far').map(([t]) => t)[0]).toBe(leapTick);
  });
  it('a new target already next to him: no flight, no hex change, no leap marker; he strikes it SMEECH_RELEAP_AFTER_KILL_TICKS after the kill', () => {
    const out = run([{ ...smeech(), cell: { col: 2, row: 3 } } as CombatUnit, dummy('e', 3, 3, 400), dummy('near', 2, 2, 100000)], 60);
    const kill = out.find(s => s.events.some(e => e.type === 'death' && e.unitId === 'e'))!.tick;
    expect(out.flatMap(s => s.events.filter(e => e.type === 'movement' && e.unitId === 'p'))).toEqual([]);
    expect(out.flatMap(s => s.events.filter(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again'))).toEqual([]);
    expect(mine(out, 'ability').filter(([, id]) => id === 'near').map(([t]) => t)[0]).toBe(kill + SMEECH_RELEAP_AFTER_KILL_TICKS);
    expect(mineIn(out, 'attack', kill, kill + SMEECH_RELEAP_AFTER_KILL_TICKS)).toEqual([]);
  });
  it('the hex he aimed at is taken while he is in the air: he lands on the free hex next to his new target nearest him, and strikes', () => {
    let state = battle([smeech(), dummy('e', 3, 3, 400), dummy('far', 6, 2, 100000), { ...dummy('block', 6, 7, 100000), team: 'player' } as CombatUnit], { rngState: 42 }); // an ally of his, out of the way until it takes the hex
    const all: { tick: number; events: readonly CombatEvent[] }[] = [];
    let aimed: { col: number; row: number } | undefined;
    for (let i = 0; i < 60 && state.status === 'running'; i++) {
      const r = stepCombat(state); state = r.state; all.push({ tick: state.tick, events: r.events });
      const m = r.events.find(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again');
      if (m && m.type === 'abilityMarker' && !aimed) {
        aimed = m.cell; state = structuredClone(state); Object.assign(state.units.find(u => u.id === 'block')!, { cell: { ...m.cell } });
      }
    }
    expect(aimed).toBeDefined();
    const marker = all.flatMap(s => s.events.filter(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again'))[0]!;
    if (marker.type !== 'abilityMarker') throw Error('marker');
    const landing = all.find(s => s.tick === marker.arrivalTick)!.events.filter(e => e.type === 'movement' && e.unitId === 'p');
    expect(landing).toHaveLength(1);
    const to = landing[0]!.type === 'movement' ? landing[0]!.to : undefined;
    expect(to).not.toEqual(aimed);
    const far = state.units.find(u => u.id === 'far')!;
    expect(hexDistance(to!, far.cell)).toBe(1);
    expect(mine(all, 'ability').filter(([, id]) => id === 'far').map(([t]) => t)[0]).toBe(marker.arrivalTick);
  });
  it('a new target that dies in the air: he lands on the hex he aimed at, stands still, and takes off again SMEECH_RELEAP_AFTER_KILL_TICKS after landing', () => {
    let state = battle([smeech(), dummy('e', 3, 3, 400), dummy('far', 6, 2, 100000), dummy('next', 5, 0, 100000)], { rngState: 42 });
    const all: { tick: number; events: readonly CombatEvent[] }[] = [];
    let killed = false;
    for (let i = 0; i < 80 && state.status === 'running'; i++) {
      const r = stepCombat(state); state = r.state; all.push({ tick: state.tick, events: r.events });
      if (!killed && r.events.some(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again')) {
        killed = true; state = structuredClone(state); Object.assign(state.units.find(u => u.id === 'far')!, { hp: 0, alive: false });
      }
    }
    const marks = all.flatMap(s => s.events.filter(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again'));
    expect(marks.length).toBeGreaterThanOrEqual(2);
    const [first, second] = marks as Extract<CombatEvent, { type: 'abilityMarker' }>[];
    expect(second!.tick).toBe(first!.arrivalTick + SMEECH_RELEAP_AFTER_KILL_TICKS);
    const moves = all.flatMap(s => s.events.filter(e => e.type === 'movement' && e.unitId === 'p').map(e => [s.tick, e.type === 'movement' && e.to] as const));
    expect(moves.filter(([t]) => t > first!.tick && t <= second!.arrivalTick)).toEqual([[first!.arrivalTick, first!.cell], [second!.arrivalTick, second!.cell]]);
    expect(mineIn(all, 'attack', first!.tick, second!.arrivalTick)).toEqual([]);
  });
  it('a target killed by something else is still found dead by his next stab, as before; he then flies to the next one', () => {
    let state = battle([smeech(), dummy('e', 3, 3, 100000), dummy('far', 6, 2, 100000)], { rngState: 42 });
    const first = stepCombat(state); state = first.state;
    Object.assign(state.units.find(u => u.id === 'e')!, { hp: 0, alive: false });
    const later: number[] = [];
    for (let i = 0; i < 3 * SMEECH_STAB_TICKS; i++) { const r = stepCombat(state); state = r.state;
      if (packets(r.events).some(p => p.source.ownerId === 'p' && p.source.sourceKind === 'ability' && p.unitId === 'far')) later.push(state.tick - first.state.tick); }
    expect(later[0]).toBe(SMEECH_STAB_TICKS + SMEECH_RELEAP_FLIGHT_TICKS); // v2: take-off on the next stab slot, then the flight (was SMEECH_STAB_TICKS)
  });
});

// The re-leap timing changes battle results, so its rule identifier is part of the content digest: a save written under the
// digest just before it (Jinx's rocket mirror) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:b30fa3a6'; // v2: the v1 digest (v1 itself turned 1b32b9d3 away)
describe('Smeech re-leap after a kill: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.smeechReleapAfterKill).toBe('smeech-stands-then-strikes-adjacent-or-flies-to-next-v2');
    expect(S13_COMBAT_RULES.smeechStabInterval).toBe('smeech-stab-interval-from-official-footage-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-smeech-releap', createdAt: '2026-11-25T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-smeech-releap']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
