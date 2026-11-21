import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { JINX_CHOMPERS_TICKS, JINX_ROCKET_FLIGHT_TICKS, JINX_ROCKET_LAUNCH_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { readyMatch } from './match-helpers';

// Jinx's rocket and chompers (11-21, authorization ②): aligned to the original frame by frame; the zap is unchanged.
// docs/S13_RULES_GAP.md (金克丝飞弹、手雷).
const jinx = () => unit('p', 'player', 3, 7, { definitionId: 'jinx', starLevel: 2, ability: resolveAbility('jinx-ability', 2), hp: 100000, maxHp: 100000, mana: 0, maxMana: 60,
  attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 10000, cooldownTicks: 0, moveCooldownTicks: 1000, targetId: 'e',
  runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] } as any);
const foe = (id: string, col: number, row = 2) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 10000000, maxHp: 10000000,
  mana: 0, maxMana: 0, attackDamage: 0, cooldownTicks: 100000, moveCooldownTicks: 100000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] } as any);
type Step = { tick: number; events: readonly CombatEvent[] };
function run(state: CombatState, n: number) { const out: Step[] = []; for (let i = 0; i < n && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: r.state.tick, events: r.events }); } return { state, out }; }
const skill = (s: Step) => s.events.filter(e => e.type === 'packetDamage' && (e as any).outcome.context.source.ownerId === 'p' && (e as any).outcome.context.source.sourceKind === 'ability')
  .map(e => (e as any).outcome.context.targetId as string);

describe('Jinx cast timing', () => {
  const start = battle([jinx(), foe('e', 3), foe('f', 4), foe('g', 0, 0)], { strategy: { traits: [], units: [] }, combatId: 'jinx-timing', rngState: 42 } as any);
  const r = run(start, 420);
  const casts = r.out.filter(s => s.events.some(e => e.type === 'cast')).map(s => ({ tick: s.tick, branch: (s.events.find(e => e.type === 'cast') as any).receipt.branch?.branch }));
  const at = (branch: string) => casts.find(c => c.branch === branch)!.tick;
  const hitsBetween = (from: number, to: number) => r.out.filter(s => s.tick >= from && s.tick <= to).flatMap(s => skill(s).map(id => `${s.tick}:${id}`));
  it('the zap still settles on its cast', () => {
    expect(casts.map(c => c.branch).slice(0, 3)).toEqual(['zap', 'chompers', 'rocket']);
    expect(hitsBetween(at('zap'), at('zap')).length).toBeGreaterThan(0);
  });
  it('the chompers go off JINX_CHOMPERS_TICKS after the cast, nothing before', () => {
    const c = at('chompers');
    expect(hitsBetween(c, c + JINX_CHOMPERS_TICKS - 1)).toEqual([]);
    expect(hitsBetween(c + JINX_CHOMPERS_TICKS, c + JINX_CHOMPERS_TICKS).length).toBeGreaterThan(0);
  });
  it('the rocket leaves JINX_ROCKET_LAUNCH_TICKS after the cast and explodes JINX_ROCKET_FLIGHT_TICKS later, hitting every enemy there', () => {
    const c = at('rocket');
    const launched = r.out.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched' && (e as any).skill === 'jinx-rocket') as any[]);
    expect(launched.map(l => [l.tick, l.arrivalTick, l.count])).toEqual([[c + JINX_ROCKET_LAUNCH_TICKS, c + JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS, 1]]);
    expect(hitsBetween(c, c + JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS - 1)).toEqual([]);
    expect(hitsBetween(c + JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS, c + JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS).map(h => h.split(':')[1]).sort()).toEqual(['e', 'f', 'g']);
  });
  it('she starts no basic attack until the rocket leaves (one already in flight may still land)', () => {
    const c = at('rocket');
    expect(r.out.filter(s => s.tick > c && s.tick < c + JINX_ROCKET_LAUNCH_TICKS).flatMap(s => s.events.filter(e => (e.type === 'attack' || e.type === 'attackLaunched')
      && ((e as any).sourceId ?? (e as any).attackerId ?? (e as any).unitId) === 'p'))).toEqual([]);
    expect(r.out.filter(s => s.tick > c + JINX_ROCKET_LAUNCH_TICKS).some(s => s.events.some(e => (e.type === 'attack' || e.type === 'attackLaunched')
      && ((e as any).sourceId ?? (e as any).attackerId ?? (e as any).unitId) === 'p'))).toBe(true);
  });
});

// The new timing changes battle results, so its rule identifier is part of the content digest: a save written under the digest
// just before it (Violet's combo) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:3ade1e2c';
describe('Jinx timing: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.jinxRocketChompers).toBe('jinx-rocket-and-chompers-settle-when-they-go-off-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-jinx', createdAt: '2026-11-21T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-jinx']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
