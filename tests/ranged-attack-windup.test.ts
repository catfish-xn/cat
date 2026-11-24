import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { RANGED_ATTACK_WINDUP_MAX, RANGED_ATTACK_WINDUP_TICKS, rangedAttackFlightTicks, rangedAttackWindupTicks } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Ranged attack wind-up (user-approved 11-19; fitted / self-chosen values, cancel semantics inferred, not original data): a ranged
// hero's attack starts (animation, cooldown) and its shot launches rangedAttackWindupTicks later, then lands
// rangedAttackFlightTicks after the launch. docs/S13_RULES_GAP.md (远程普攻前摇).
function shooter(name: string, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 3, 6, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 3000, maxHp: 3000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1000, attackDamage: 100, attackRange: 4, abilityPower: 100, baseAttackSpeedBps: 10000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
const dummy = (id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
const of = <T extends CombatEvent['type']>(out: { tick: number; events: readonly CombatEvent[] }[], type: T) =>
  out.flatMap(s => s.events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type && (e as { attackerId?: string }).attackerId === 'p'));
const hitTicks = (out: { tick: number; events: readonly CombatEvent[] }[], target = 'e') => out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p' && x.unitId === target).map(() => s.tick));
const p = (s: CombatState) => s.units.find(u => u.id === 'p')! as S13Unit;

describe('ranged attack wind-up', () => {
  it('starts the attack, launches the shot rangedAttackWindupTicks later, lands it a flight after the launch; the cadence runs from the start', () => {
    const start = battle([shooter('ezreal'), dummy('e', 3, 3)], { rngState: 42 });
    const r = run(start, 80), w = rangedAttackWindupTicks('ezreal', start.units[0]!.attackIntervalTicks);
    const windups = of(r.out, 'attackWindup'), attacks = of(r.out, 'attack');
    expect(w).toBe(RANGED_ATTACK_WINDUP_TICKS.ezreal);
    expect(windups.length).toBeGreaterThan(1);
    // The start names the launch; the attack itself (and its launch) comes on that tick, nothing before it.
    expect(attacks[0]!.tick).toBe(windups[0]!.launchTick);
    expect(windups[0]!.launchTick).toBe(windups[0]!.tick + w);
    expect(hitTicks(r.out).filter(t => t < attacks[0]!.tick)).toEqual([]);
    const flight = rangedAttackFlightTicks(hexDistance(start.units[0]!.cell, start.units[1]!.cell), 'ezreal');
    expect(hitTicks(r.out)[0]).toBe(attacks[0]!.tick + flight);
    expect(of(r.out, 'attackLaunched')[0]).toMatchObject({ tick: attacks[0]!.tick, arrivalTick: attacks[0]!.tick + flight });
    // Attack cadence unchanged: the next start is one attack interval after this one.
    expect(windups[1]!.tick - windups[0]!.tick).toBe(start.units[0]!.attackIntervalTicks);
  });
  it('its attack mana and attack count come on the launch, not the start', () => {
    const start = battle([shooter('ezreal'), dummy('e', 3, 3)], { rngState: 42 });
    const r = run(start, 40), first = of(r.out, 'attackWindup')[0]!;
    const atStart = r.out.find(s => s.tick === first.tick)!;
    expect(atStart.events.some(e => e.type === 'manaChanged' && JSON.stringify(e).includes('"p"'))).toBe(false);
    const atLaunch = r.out.find(s => s.tick === first.launchTick)!;
    expect(atLaunch.events.some(e => e.type === 'manaChanged' && JSON.stringify(e).includes('"p"'))).toBe(true);
    const before = run(start, first.launchTick - start.tick - 1).state, after = run(before, 1).state;
    expect([p(before).runtime.attackCount, p(after).runtime.attackCount]).toEqual([0, 1]);
  });
  it('neither moves nor casts while winding up; a full mana bar casts after the launch', () => {
    const start = battle([shooter('ezreal', { maxMana: 30 }), dummy('e', 3, 3)], { rngState: 42 });
    const pre = run(start, 40), first = of(pre.out, 'attackWindup')[0]!;
    const mid = structuredClone(run(start, first.tick - start.tick).state);
    Object.assign(p(mid), { mana: 30 });
    const r = run(mid, first.launchTick - mid.tick + 2);
    const castTicks = r.out.flatMap(s => s.events.filter(e => e.type === 'cast').map(() => s.tick));
    expect(castTicks.every(t => t > first.launchTick)).toBe(true);
    expect(castTicks.length).toBeGreaterThan(0);
    expect(r.out.flatMap(s => s.events.filter(e => e.type === 'movement' && e.unitId === 'p'))).toEqual([]);
  });
  it('a control during the wind-up cancels the attack (nothing lands) and clears the cooldown: it restarts as soon as the control ends', () => {
    const start = battle([shooter('ezreal'), dummy('e', 3, 3)], { rngState: 42 });
    const first = of(run(start, 40).out, 'attackWindup')[0]!;
    const mid = structuredClone(run(start, first.tick - start.tick + 1).state);
    applyStatus(p(mid), origin(mid.units.find(u => u.id === 'e')! as S13Unit), 'stun', 0, 10, mid.tick, [], true);
    const r = run(mid, 30);
    expect(of(r.out, 'attackWindupCancelled').map(e => e.targetId)).toEqual(['e']);
    expect(of(r.out, 'attack').filter(e => e.tick <= first.launchTick)).toEqual([]);
    const restart = of(r.out, 'attackWindup')[0]!;
    const stunEnds = mid.tick + 10;
    expect(restart.tick).toBeLessThanOrEqual(stunEnds + 1);
    expect(restart.tick).toBeGreaterThanOrEqual(stunEnds);
  });
  it('a target dying during the wind-up cancels the attack and the next one starts at once on a new target', () => {
    const start = battle([shooter('ezreal'), dummy('e', 3, 3), dummy('f', 4, 3)], { rngState: 42 });
    const first = of(run(start, 40).out, 'attackWindup')[0]!;
    const mid = structuredClone(run(start, first.tick - start.tick + 1).state);
    Object.assign(mid.units.find(u => u.id === first.targetId)!, { hp: 0, alive: false });
    const r = run(mid, 1), other = first.targetId === 'e' ? 'f' : 'e';
    expect(of(r.out, 'attackWindupCancelled').map(e => e.targetId)).toEqual([first.targetId]);
    expect(of(r.out, 'attackWindup').map(e => e.targetId)).toEqual([other]);
  });
  it('a target turning unselectable during the wind-up cancels the attack; the next one on a new target winds up in full, never launching that tick', () => {
    // 11-24 Fable: cancelled like a dead target, then the ordinary target choice and a whole wind-up of its own.
    const start = battle([shooter('ezreal'), dummy('e', 3, 3), dummy('f', 4, 3)], { rngState: 42 });
    const first = of(run(start, 40).out, 'attackWindup')[0]!;
    const mid = structuredClone(run(start, first.tick - start.tick + 1).state);
    Object.assign(mid.units.find(u => u.id === first.targetId)!, { anomalyState: { invisibleUntilTick: mid.tick + 30 } });
    const r = run(mid, 30), other = first.targetId === 'e' ? 'f' : 'e';
    const cancelled = of(r.out, 'attackWindupCancelled');
    expect(cancelled.map(e => e.targetId)).toEqual([first.targetId]);
    expect(cancelled[0]!.tick).toBe(mid.tick + 1);
    const next = of(r.out, 'attackWindup')[0]!;
    expect(next).toMatchObject({ tick: mid.tick + 1, targetId: other, launchTick: mid.tick + 1 + first.launchTick - first.tick });
    const attacks = of(r.out, 'attack');
    expect(attacks.filter(e => e.targetId === first.targetId)).toEqual([]);
    expect(attacks[0]).toMatchObject({ tick: next.launchTick, targetId: other });
    // No wind-up is ever left behind its launch tick.
    let st = mid; for (let n = 0; n < 30; n++) { st = stepCombat(st).state; const w = p(st).windup; if (w) expect(w.launchTick).toBeGreaterThan(st.tick); }
  });
  it('melee attacks have no wind-up', () => {
    const r = run(battle([shooter('garen', { attackRange: 1 }), dummy('e', 3, 5)], { rngState: 42 }), 30);
    expect(of(r.out, 'attackWindup')).toEqual([]);
    expect(hitTicks(r.out)[0]).toBe(of(r.out, 'attack')[0]!.tick);
  });
  it('the wind-up is at most RANGED_ATTACK_WINDUP_MAX and at most half the attack interval', () => {
    for (const ticks of Object.values(RANGED_ATTACK_WINDUP_TICKS)) expect(ticks).toBeLessThanOrEqual(RANGED_ATTACK_WINDUP_MAX);
    expect(rangedAttackWindupTicks('zyra', 40)).toBe(7);
    expect(rangedAttackWindupTicks('zyra', 9)).toBe(4);
    expect(rangedAttackWindupTicks('unknown-hero', 40)).toBe(5);
  });
  it('a state saved mid wind-up replays identically', () => {
    const start = battle([shooter('ezreal'), dummy('e', 3, 3)], { rngState: 42 });
    const first = of(run(start, 40).out, 'attackWindup')[0]!;
    const mid = run(start, first.tick - start.tick + 1).state;
    expect(p(mid).windup).toEqual({ targetId: first.targetId, launchTick: first.launchTick });
    let a = mid, b = JSON.parse(JSON.stringify(mid)) as CombatState;
    for (let n = 0; n < 20; n++) { const x = stepCombat(a), y = stepCombat(b); expect(y).toEqual(x); a = x.state; b = y.state; }
  });
});

// ---- Match save with an attack winding up: restored exactly, a forged wind-up is rejected ----
import { itemMatch } from './fixtures/m8-b4-match';
import { stepMatch } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
describe('ranged attack wind-up: Match save', () => {
  function windingUp() {
    let s = itemMatch('hand-of-justice', 'unit-3');
    for (let n = 0; n < 200 && s.phase === 'combat' && !s.combat!.units.some(u => u.windup); n++) s = stepMatch(s).state;
    expect(s.combat!.units.some(u => u.windup), 'premise: an attack winds up at the save').toBe(true);
    return s;
  }
  it('restores identically', () => {
    const s = windingUp(), json = serializeMatch(s);
    expect(serializeMatch(restoreMatch(json))).toBe(json);
  }, 60000);
  it('Edge of Night: a wind-up whose target turns unselectable is cancelled, and every save of that combat restores', () => {
    // The 11-24 repro: the enemy Tristana winds up on unit-1 as its Edge of Night stealth begins. Before the fix the wind-up hung past
    // its launch tick and that save was refused ('attack windup launch').
    let s = itemMatch('edge-of-night'), cancelled = 0;
    for (let n = 0; n < 361 && s.phase === 'combat'; n++) {
      const r = stepMatch(s); s = r.state;
      cancelled += r.events.filter(e => (e as { type: string }).type === 'attackWindupCancelled' && (e as { targetId?: string }).targetId === 'unit-1').length;
      if (s.phase !== 'combat') break;
      for (const u of s.combat!.units) if (u.windup) expect(u.windup.launchTick).toBeGreaterThan(s.combat!.tick);
      if (s.combat!.units.some(u => u.windup)) expect(serializeMatch(restoreMatch(serializeMatch(s)))).toBe(serializeMatch(s));
    }
    expect(cancelled, 'premise: a wind-up on unit-1 is cancelled by its stealth').toBeGreaterThan(0);
  }, 120000);
  it.each([
    ['an ally target', (u: any, units: any[]) => { u.windup.targetId = units.find((x: any) => x.team === u.team && x.id !== u.id)?.id ?? u.id; }],
    ['a launch in the past', (u: any) => { u.windup.launchTick = 0; }],
    ['an extra key', (u: any) => { u.windup.extra = 1; }],
    ['a dead holder', (u: any) => { u.alive = false; u.hp = 0; }],
  ] as const)('rejects a forged wind-up: %s', (_name, edit) => {
    const json = JSON.parse(serializeMatch(windingUp()));
    const holder = json.combat.units.find((u: any) => u.windup);
    edit(holder, json.combat.units);
    expect(() => restoreMatch(JSON.stringify(json))).toThrow();
  }, 60000);
});

// The wind-up's rule identifier enters the content digest: files written before it are turned away, never replayed under it.
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';
describe('ranged attack wind-up: files written before it', () => {
  const BEFORE = 'fnv1a32-utf16:33d330e9';
  it('has its own identifier; a save with the earlier digest is rejected and its archive quarantined', () => {
    expect(S13_COMBAT_RULES.rangedAttackWindup).toBe('ranged-attack-start-then-launch-after-windup-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE);
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-windup', createdAt: '2026-11-19T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toMatchObject({ status: 'rejected', canResume: false, canReplay: false, reason: 'digest-mismatch' });
    expect(admitArchives([file], routeSaveFile).quarantined.map(q => q.runId)).toEqual(['before-windup']);
  });
});
