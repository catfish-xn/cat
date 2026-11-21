import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { amount, EMPTY_RUNTIME, variable, type S13Unit } from '../src/simulation/combat-s13-state';
import { SWAIN_PULSE_TICKS, SWAIN_PULSES_PER_SECOND } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility } from '../src/persistence/compatibility';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { heals, packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Swain's demon form drain (11-20, user-approved): docs/S13_RULES_GAP.md (斯维因吸取跳频).
const swain = (patch: Partial<CombatUnit> = {}) => unit('p', 'player', 1, 3, { definitionId: 'swain', starLevel: 1, ability: resolveAbility('swain-ability', 1),
  hp: 2000, maxHp: 5000, mana: 100, maxMana: 100, attackDamage: 0, abilityPower: 100, attackRange: 1, baseAttackSpeedBps: 1, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [], ...patch });
const dummy = (id: string, col: number, row: number) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
  hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] });
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); out.push({ tick: state.tick, events: r.events }); state = r.state; }
  return { state, out };
}

describe('Swain demon form drain', () => {
  const start = battle([swain(), dummy('e', 2, 3), dummy('far', 6, 0)], { rngState: 42 });
  const r = run(start, 400), me = start.units[0] as S13Unit;
  const cast = r.out.find(s => s.events.some(e => e.type === 'cast'))!.tick;
  const ascension = run(start, cast + 1).state.units.find(u => u.id === 'p')!.g23!.ascension!;
  const drains = r.out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.unitId === 'e').map(p => ({ tick: s.tick, raw: p.raw })));
  const pulseHeals = r.out.flatMap(s => heals(s.events).filter(h => h.unitId === 'p' && s.tick > cast).map(h => ({ tick: s.tick, requested: h.requested })));
  it('pulses every SWAIN_PULSE_TICKS from SWAIN_PULSE_TICKS after the cast, up to the end of the form and not past it', () => {
    expect([SWAIN_PULSE_TICKS, SWAIN_PULSES_PER_SECOND]).toEqual([5, 4]);
    const end = ascension.untilTick, expected: number[] = [];
    for (let t = cast + SWAIN_PULSE_TICKS; t <= end; t += SWAIN_PULSE_TICKS) expected.push(t);
    expect(drains.map(d => d.tick)).toEqual(expected);
    expect(pulseHeals.map(h => h.tick)).toEqual(expected);
    // The tail: the last pulse is on the end tick when the form's length is a whole number of pulses, none after it.
    expect(expected.at(-1)).toBe(end - (end - cast) % SWAIN_PULSE_TICKS);
    expect(drains.some(d => d.tick > end)).toBe(false);
  });
  it("each second's four pulses add up to the per-second values exactly", () => {
    const perSecondDamage = amount(me, cast, { ap: variable(me, 'DamagePerSecond') }), perSecondHeal = amount(me, cast, { ap: variable(me, 'HealPerSecond') });
    for (let k = 0; k + SWAIN_PULSES_PER_SECOND <= drains.length; k += SWAIN_PULSES_PER_SECOND) {
      expect(drains.slice(k, k + 4).reduce((n, d) => n + d.raw, 0)).toBe(perSecondDamage);
      expect(pulseHeals.slice(k, k + 4).reduce((n, h) => n + h.requested, 0)).toBe(perSecondHeal);
    }
    expect(Math.max(...drains.map(d => d.raw)) - Math.min(...drains.map(d => d.raw))).toBeLessThanOrEqual(1);
  });
  it('only adjacent enemies are drained, taken every pulse', () => {
    expect(r.out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.unitId === 'far'))).toEqual([]);
  });
});

const BEFORE_DIGEST = 'fnv1a32-utf16:cf212873';
describe('Swain drain: files written before it', () => {
  it('has its own identifier; a save with an earlier digest is rejected', () => {
    expect(S13_COMBAT_RULES.swainDrain).toBe('every-5-ticks-first-at-5-quarter-of-per-second-split-total-adjacency-each-pulse');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-swain', createdAt: '2026-11-20T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toMatchObject({ status: 'rejected', reason: 'digest-mismatch' });
  });
});

describe('Swain demon form extension event', () => {
  it('a takedown extends the form once per victim and says so with swainAscensionExtended (display only)', () => {
    const start = battle([swain(), dummy('weak', 2, 3), dummy('far', 6, 0)], { rngState: 42 });
    Object.assign(start.units[1]!, { hp: 1, maxHp: 1 });
    const r = run(start, 60);
    const ext = r.out.flatMap(s => s.events.filter(e => e.type === 'swainAscensionExtended')) as any[];
    expect(ext.map(e => [e.unitId, e.victimId])).toEqual([['p', 'weak']]);
    expect(ext[0].untilTick - ext[0].beforeUntilTick).toBe(Math.round(variable(start.units[0] as S13Unit, 'BonusDuration') * 20));
    expect(r.state.units.find(u => u.id === 'p')!.g23!.ascension!.untilTick).toBe(ext[0].untilTick);
  });
});
