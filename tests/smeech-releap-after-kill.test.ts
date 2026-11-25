import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { SMEECH_RELEAP_AFTER_KILL_TICKS, SMEECH_STAB_TICKS } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Smeech after a kill (11-25, user decision; docs/S13_RULES_GAP.md 史密奇击杀后再跳): when one of his stabs kills his target he
// stands still (no step, no attack), then leaps to the next target SMEECH_RELEAP_AFTER_KILL_TICKS after the kill and strikes on
// landing. The stab interval, the 4-hex range and the reduced re-leap damage are unchanged.
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
const mine = (out: ReturnType<typeof run>, sourceKind: string) => out.flatMap(s => packets(s.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === sourceKind).map(p => [s.tick, p.unitId] as const));

describe('Smeech stands still after a stab kill, then re-leaps', () => {
  it('a kill on his second stab: no step and no attack until the re-leap, which comes SMEECH_RELEAP_AFTER_KILL_TICKS after the kill and strikes on landing', () => {
    const out = run([smeech(), dummy('e', 3, 3, 400), dummy('far', 6, 2, 100000)], 60);
    const kill = out.find(s => s.events.some(e => e.type === 'death' && e.unitId === 'e'))!.tick;
    expect(mine(out, 'ability').filter(([, id]) => id === 'e').map(([t]) => t)).toEqual([kill - SMEECH_STAB_TICKS, kill]);
    const leapTick = kill + SMEECH_RELEAP_AFTER_KILL_TICKS;
    const moves = out.flatMap(s => s.events.filter(e => e.type === 'movement' && e.unitId === 'p').map(() => s.tick));
    expect(moves.filter(t => t > kill && t <= leapTick)).toEqual([leapTick]);
    expect(mine(out, 'attack').filter(([t]) => t > kill && t <= leapTick)).toEqual([]);
    expect(mine(out, 'ability').filter(([, id]) => id === 'far').map(([t]) => t)[0]).toBe(leapTick);
  });
  it('a target killed by something else is still found dead by his next stab, as before', () => {
    let state = battle([smeech(), dummy('e', 3, 3, 100000), dummy('far', 6, 2, 100000)], { rngState: 42 });
    const first = stepCombat(state); state = first.state;
    Object.assign(state.units.find(u => u.id === 'e')!, { hp: 0, alive: false });
    const later: number[] = [];
    for (let i = 0; i < 3 * SMEECH_STAB_TICKS; i++) { const r = stepCombat(state); state = r.state;
      if (packets(r.events).some(p => p.source.ownerId === 'p' && p.source.sourceKind === 'ability' && p.unitId === 'far')) later.push(state.tick - first.state.tick); }
    expect(later[0]).toBe(SMEECH_STAB_TICKS);
  });
});

// The re-leap timing changes battle results, so its rule identifier is part of the content digest: a save written under the
// digest just before it (Jinx's rocket mirror) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:1b32b9d3';
describe('Smeech re-leap after a kill: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.smeechReleapAfterKill).toBe('smeech-stands-then-releaps-after-stab-kill-v1');
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
