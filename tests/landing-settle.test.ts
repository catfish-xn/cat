import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, type S13Unit } from '../src/simulation/combat-s13-state';
import { DARIUS_SPIN_TICKS, HEIMER_ROCKET_TIMING, heimerRocketLaunchTick, LUX_SELF_SHIELD_TICKS, LUX_SHIELD_FLIGHT_TICKS, MADDIE_SHOT_MIN_TICKS,
  MADDIE_SHOT_TICKS_PER_HEX, maddieShotFlightTicks, MORDEKAISER_CLAW_TICKS } from '../src/simulation/cast-windup';
import { HEIMER_ROCKETS, heimerRocketLandTick, MADDIE_SHOT_MIN_TICKS as RENDER_MADDIE_MIN, MADDIE_SHOT_TICKS_PER_HEX as RENDER_MADDIE_PER_HEX } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { hexDistance } from '../src/simulation/board';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { heals as healViews, packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Landing batch (11-20, user-approved timing only): docs/S13_RULES_GAP.md (技能落地结算批).
function hero(name: string, star: 1 | 2 | 3, col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', col, row, { definitionId: name, starLevel: star, ability: resolveAbility(name + '-ability', star), hp: 10000, maxHp: 10000,
    mana: 100, maxMana: 100, attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 1, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [], ...patch });
}
const dummy = (id: string, team: 'player' | 'enemy', col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit => unit(id, team, col, row, {
  definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 0, attackDamage: 0,
  cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], ...patch });
type Step = { tick: number; events: readonly CombatEvent[] };
function run(state: CombatState, count: number) {
  const out: Step[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
const castTick = (out: Step[]) => out.find(s => s.events.some(e => e.type === 'cast' && (e as any).receipt?.source?.ownerId === 'p'))!.tick;
const hits = (out: Step[]) => out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p').map(x => ({ tick: s.tick, target: x.unitId })));
const ofType = (out: Step[], type: string) => out.flatMap(s => s.events.filter(e => e.type === type).map(e => ({ ...(e as any), at: s.tick })));

describe('landing batch: timings shared with the render', () => {
  it('Heimerdinger rockets: the rules copy equals the render timing for every rocket of every volley size', () => {
    expect(HEIMER_ROCKET_TIMING).toEqual({ launchTicks: HEIMER_ROCKETS.launchTicks, flightTicks: HEIMER_ROCKETS.flightTicks, staggerTicks: HEIMER_ROCKETS.staggerTicks, spreadTicks: HEIMER_ROCKETS.spreadTicks });
    for (let n = 1; n <= 30; n++) for (let k = 0; k < n; k++) expect(heimerRocketLaunchTick(k, n) + HEIMER_ROCKET_TIMING.flightTicks).toBe(heimerRocketLandTick(k, n));
  });
  it("Maddie's shot flight equals the render's", () => {
    expect([MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS]).toEqual([RENDER_MADDIE_PER_HEX, RENDER_MADDIE_MIN]);
    expect([1, 2, 3, 6].map(maddieShotFlightTicks)).toEqual([4, 4, 6, 12]);
  });
});

describe('landing batch: Darius', () => {
  it('his spin damages the neighbours, heals him and starts the bleed DARIUS_SPIN_TICKS after the cast; the bleed runs its full length from there', () => {
    const start = battle([hero('darius', 2, 3, 4, { targetId: 'e', hp: 5000 }), dummy('e', 'enemy', 3, 3), dummy('f', 'enemy', 2, 3), dummy('far', 'enemy', 0, 0)], { rngState: 42 });
    const r = run(start, 120), cast = castTick(r.out);
    const spin = hits(r.out).filter(h => h.tick === cast + DARIUS_SPIN_TICKS);
    expect(spin.map(h => h.target).sort()).toEqual(['e', 'f']);
    expect(hits(r.out).filter(h => h.tick <= cast + DARIUS_SPIN_TICKS - 1)).toEqual([]);
    const heals = r.out.flatMap(s => healViews(s.events).filter(h => h.unitId === 'p').map(() => s.tick));
    expect(heals).toEqual([cast + DARIUS_SPIN_TICKS]);
    const bleed = hits(r.out).filter(h => h.tick > cast + DARIUS_SPIN_TICKS && h.target === 'e').map(h => h.tick);
    expect(bleed).toEqual([1, 2, 3, 4].map(n => cast + DARIUS_SPIN_TICKS + n * 20));
  });
});

describe('landing batch: projectiles', () => {
  it("Maddie: each shot leaves on its offset, lands its flight later; Landed comes before its damage", () => {
    const start = battle([hero('maddie', 2, 3, 7), dummy('e', 'enemy', 3, 1)], { rngState: 42 });
    const r = run(start, 80), launched = ofType(r.out, 'abilityProjectileLaunched'), landed = ofType(r.out, 'abilityProjectileLanded');
    expect(launched.length).toBe(6);
    expect(launched.every(l => l.skill === 'maddie-shot' && l.count === 6 && l.at === l.tick)).toBe(true);
    const flight = maddieShotFlightTicks(hexDistance({ col: 3, row: 7 }, { col: 3, row: 1 }));
    expect(launched.map(l => l.arrivalTick - l.tick)).toEqual(Array(6).fill(flight));
    expect(landed.map(l => [l.ordinal, l.at, l.hit])).toEqual(launched.map(l => [l.ordinal, l.arrivalTick, true]));
    expect(hits(r.out).map(h => h.tick)).toEqual(launched.map(l => l.arrivalTick));
    for (const step of r.out) {
      const order = step.events.map(e => e.type).filter(t => t === 'abilityProjectileLanded' || t === 'packetDamage');
      expect(order.indexOf('packetDamage')).not.toBeLessThan(order.indexOf('abilityProjectileLanded'));
    }
  });
  it('a target that dies in flight takes nothing, nobody else is hit (hit false)', () => {
    const start = battle([hero('maddie', 2, 3, 7), dummy('e', 'enemy', 3, 1), dummy('g', 'enemy', 0, 0)], { rngState: 42 });
    const first = ofType(run(start, 80).out, 'abilityProjectileLaunched')[0]!;
    let state = run(start, first.tick - start.tick).state;
    state = structuredClone(state);
    Object.assign(state.units.find(u => u.id === first.targetId)!, { hp: 0, alive: false });
    const r = run(state, first.arrivalTick - state.tick);
    const landed = ofType(r.out, 'abilityProjectileLanded').filter(l => l.ordinal === first.ordinal);
    expect(landed.map(l => [l.at, l.targetId, l.hit])).toEqual([[first.arrivalTick, first.targetId, false]]);
    expect(hits(r.out).filter(h => h.tick === first.arrivalTick)).toEqual([]);
  });
  it('Heimerdinger: rocket k of n lands heimerRocketLandTick(k, n) after the cast, targets drawn on the cast', () => {
    const start = battle([hero('heimerdinger', 2, 3, 7), dummy('e', 'enemy', 3, 1), dummy('f', 'enemy', 5, 1)], { rngState: 42 });
    const r = run(start, 60), cast = castTick(r.out), launched = ofType(r.out, 'abilityProjectileLaunched');
    expect(launched.length).toBeGreaterThan(1);
    const n = launched[0]!.count;
    expect(launched.map(l => l.arrivalTick - cast)).toEqual(launched.map(l => heimerRocketLandTick(l.ordinal, n)));
    expect(hits(r.out).filter(h => h.tick <= cast + HEIMER_ROCKET_TIMING.launchTicks)).toEqual([]);
    expect(hits(r.out).map(h => [h.tick, h.target])).toEqual(launched.map(l => [l.arrivalTick, l.targetId]));
  });
  it("Lux: an ally's shield lands when the missile arrives; her own LUX_SELF_SHIELD_TICKS after the cast, with no projectile", () => {
    const toAlly = battle([hero('lux', 2, 3, 7), dummy('a', 'player', 2, 5, { hp: 10, maxHp: 100000 }), dummy('e', 'enemy', 3, 1)], { rngState: 42 });
    const r = run(toAlly, 40), cast = castTick(r.out);
    expect(ofType(r.out, 'abilityProjectileLaunched').map(l => [l.at, l.targetId, l.skill, l.arrivalTick])).toEqual([[cast, 'a', 'lux-shield', cast + LUX_SHIELD_FLIGHT_TICKS]]);
    const shielded = (s: CombatState, id: string) => ((s.units.find(u => u.id === id) as S13Unit).shieldLayers ?? []).some(l => l.source.ownerId === 'p');
    expect(shielded(run(toAlly, cast + LUX_SHIELD_FLIGHT_TICKS - 1).state, 'a')).toBe(false);
    expect(shielded(run(toAlly, cast + LUX_SHIELD_FLIGHT_TICKS).state, 'a')).toBe(true);
    const self = battle([hero('lux', 2, 3, 7, { hp: 5 }), dummy('e', 'enemy', 3, 1)], { rngState: 42 });
    const s = run(self, 40), selfCast = castTick(s.out);
    expect(ofType(s.out, 'abilityProjectileLaunched')).toEqual([]);
    expect(shielded(run(self, selfCast + LUX_SELF_SHIELD_TICKS - 1).state, 'p')).toBe(false);
    expect(shielded(run(self, selfCast + LUX_SELF_SHIELD_TICKS).state, 'p')).toBe(true);
  });
  it.each([1, 2, 3] as const)('Mordekaiser %s star: the claw appears and comes down MORDEKAISER_CLAW_TICKS after the cast; damage there', star => {
    const start = battle([hero('mordekaiser', star, 3, 4), dummy('e', 'enemy', 3, 3), dummy('f', 'enemy', 3, 2)], { rngState: 42 });
    const r = run(start, 60), cast = castTick(r.out), claw = MORDEKAISER_CLAW_TICKS[star], launched = ofType(r.out, 'abilityProjectileLaunched');
    expect(launched.length).toBeGreaterThan(0);
    expect(launched.every(l => l.skill === 'mordekaiser-claw' && l.tick === cast + claw.appear && l.arrivalTick === cast + claw.land)).toBe(true);
    expect(hits(r.out).filter(h => h.tick < cast + claw.land)).toEqual([]);
    expect(hits(r.out).filter(h => h.tick === cast + claw.land).map(h => h.target).sort()).toEqual(launched.map(l => l.targetId).sort());
  });
  it('a state saved with a projectile in flight replays identically', () => {
    const start = battle([hero('maddie', 2, 3, 7), dummy('e', 'enemy', 3, 1)], { rngState: 42 });
    const first = ofType(run(start, 80).out, 'abilityProjectileLaunched')[0]!;
    const mid = run(start, first.tick - start.tick + 1).state;
    expect(mid.units.some(u => (u as S13Unit).tasks?.some(t => t.kind === 'skillShot' && t.shot?.arrivalTick !== undefined))).toBe(true);
    let a = mid, b = JSON.parse(JSON.stringify(mid)) as CombatState;
    for (let n = 0; n < 30; n++) { const x = stepCombat(a), y = stepCombat(b); expect(y).toEqual(x); a = x.state; b = y.state; }
  });
});

// The batch's rule identifier enters the content digest: files written before it are turned away, never replayed under it.
const BEFORE_BATCH_DIGEST = 'fnv1a32-utf16:cf212873';
describe('landing batch: files written before it', () => {
  it('has its own identifier, the digest moved, and a save with the earlier digest is rejected and quarantined', () => {
    expect(S13_COMBAT_RULES.skillLanding).toBe('darius-spin-lux-shield-maddie-shot-heimer-rocket-morde-claw-settle-on-landing-events-launched-landed');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_BATCH_DIGEST);
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-landing', createdAt: '2026-11-20T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_BATCH_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toMatchObject({ status: 'rejected', canResume: false, canReplay: false, reason: 'digest-mismatch' });
    expect(admitArchives([file], routeSaveFile).quarantined.map(q => q.runId)).toEqual(['before-landing']);
  });
});
