import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { VIOLET_JAB_TICKS, VIOLET_UPPERCUT_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { readyMatch } from './match-helpers';

// Violet's combo (11-21, authorization ②): two jabs then an uppercut, each on its own tick, aligned to the original frame by
// frame (which hit is hers not fully verified). docs/S13_RULES_GAP.md (蔚奥莱连击).
const violet = () => unit('p', 'player', 3, 4, { definitionId: 'violet', starLevel: 2, ability: resolveAbility('violet-ability', 2), hp: 10000, maxHp: 10000, mana: 100, maxMana: 100,
  attackDamage: 100, abilityPower: 100, attackRange: 1, baseAttackSpeedBps: 1, cooldownTicks: 0, moveCooldownTicks: 1000, targetId: 'e',
  runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] } as any);
const foe = (hp = 100000) => unit('e', 'enemy', 3, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
  hp, maxHp: hp, mana: 0, maxMana: 0, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] } as any);
function run(state: CombatState, n: number) { const out: { tick: number; events: readonly CombatEvent[] }[] = []; for (let i = 0; i < n && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: r.state.tick, events: r.events }); } return { state, out }; }
const mine = (out: { tick: number; events: readonly CombatEvent[] }[]) => out.flatMap(s => s.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'p'
  && (e as any).outcome.context.source.sourceKind === 'ability').map(() => s.tick));

describe('Violet combo timing', () => {
  const start = battle([violet(), foe()], { strategy: { traits: [], units: [] }, combatId: 'violet-combo', rngState: 42 } as any);
  const r = run(start, VIOLET_UPPERCUT_TICKS + 5);
  const cast = r.out.find(s => s.events.some(e => e.type === 'cast'))!.tick;
  it('the two jabs and the uppercut land on their own ticks after the cast, none on the cast', () => {
    expect(VIOLET_JAB_TICKS.length).toBe(2);
    expect(mine(r.out)).toEqual([...VIOLET_JAB_TICKS.map(at => cast + at), cast + VIOLET_UPPERCUT_TICKS]);
  });
  // The ticks themselves are pinned (v2, 11-24; measured on official-server footage, not original data: pODUuLLkM9g, counted
  // from her mana bar emptying). Changing them is a rule change, which this pin makes visible.
  it('the jab and uppercut ticks are the ones measured on official footage', () => {
    expect(VIOLET_JAB_TICKS).toEqual([1, 5]);
    expect(VIOLET_UPPERCUT_TICKS).toBe(21);
  });
  it('the knock-up starts with the uppercut, not on the cast', () => {
    const stunned = (tick: number) => run(start, tick - start.tick).state.units.find(u => u.id === 'e')!.statuses?.some((x: any) => x.kind === 'stun');
    expect(stunned(cast + VIOLET_UPPERCUT_TICKS - 1)).toBe(false);
    expect(stunned(cast + VIOLET_UPPERCUT_TICKS)).toBe(true);
  });
  it('she makes no basic attack while the combo runs', () => {
    const attacks = r.out.filter(s => s.tick > cast && s.tick < cast + VIOLET_UPPERCUT_TICKS).flatMap(s => s.events.filter(e => e.type === 'packetDamage'
      && (e as any).outcome.context.source.ownerId === 'p' && (e as any).outcome.context.source.sourceKind !== 'ability'));
    expect(attacks).toEqual([]);
  });
  it('a target that dies before a hit takes nothing more and no one else is hit', () => {
    const mid = structuredClone(run(start, cast + VIOLET_JAB_TICKS[0]! - start.tick).state);
    Object.assign(mid.units.find(u => u.id === 'e')!, { hp: 0, alive: false });
    expect(mine(run(mid, VIOLET_UPPERCUT_TICKS).out)).toEqual([]);
  });
});

// The combo timing changes battle results, so its rule identifier is part of the content digest: a save written under the
// digest just before it is turned away as another version, never replayed under the new rule. v1 (11-21): the digest before it
// was Mel's barrage (1ca19aae); v2 (11-24, ticks re-aligned from her mana bar emptying): the ranged attack wind-up (d6493c11).
const BEFORE_DIGEST = 'fnv1a32-utf16:d6493c11';
describe('Violet combo: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.violetCombo).toBe('violet-combo-settle-per-hit-v2');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-violet', createdAt: '2026-11-24T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-violet']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
