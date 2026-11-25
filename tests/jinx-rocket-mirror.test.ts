import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { jinxRocketEpicenter } from '../src/simulation/ability-projectile';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';
import { readyMatch } from './match-helpers';

// Jinx's Death Rocket epicenter (11-25, user decision; docs/S13_RULES_GAP.md 金克丝大火箭落点镜像): the board has no centre hex,
// so it explodes on the centre hex of her enemies' side, (3,3) for a player-side Jinx and the mirrored (3,4) for an enemy-side
// one; both sides' rockets now fall alike. Who is hit (every enemy) and the falloff per hex are unchanged.
// The board's own symmetry (odd rows shifted half a hex): a cell's mirror is (columns-1-col, rows-1-row), which keeps every distance.
const at = (team: 'player' | 'enemy', col: number, row: number) => team === 'player' ? { col, row } : { col: DEFAULT_BOARD.columns - 1 - col, row: DEFAULT_BOARD.rows - 1 - row };
const jinx = (team: 'player' | 'enemy') => unit('j', team, at(team, 3, 7).col, at(team, 3, 7).row, { definitionId: 'jinx', starLevel: 2, ability: resolveAbility('jinx-ability', 2), hp: 100000,
  maxHp: 100000, mana: 0, maxMana: 60, attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 10000, cooldownTicks: 0, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] } as any);
const foe = (id: string, team: 'player' | 'enemy', col: number, row: number) => unit(id, team, at(team === 'player' ? 'enemy' : 'player', col, row).col, at(team === 'player' ? 'enemy' : 'player', col, row).row, {
  definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 10000000, maxHp: 10000000, armor: 0, mana: 0, maxMana: 0, attackDamage: 0,
  cooldownTicks: 100000, moveCooldownTicks: 100000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] } as any);
function rocketHits(side: 'player' | 'enemy') {
  const other = side === 'player' ? 'enemy' : 'player';
  let state = battle([jinx(side), foe('a', other, 3, 3), foe('b', other, 1, 2), foe('c', other, 5, 0)], { strategy: { traits: [], units: [] }, combatId: 'jinx-mirror', rngState: 42 } as any);
  const events: CombatEvent[] = [];
  for (let i = 0; i < 420 && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; events.push(...r.events); }
  const landed = events.find(e => e.type === 'abilityProjectileLanded' && e.skill === 'jinx-rocket')!;
  const marker = events.find(e => e.type === 'abilityMarker' && e.marker === 'jinx-rocket-epicenter');
  return { marker, hits: packets(events).filter(p => p.tick === landed.tick && p.source.ownerId === 'j' && p.source.sourceKind === 'ability').map(p => [p.unitId, p.raw]).sort() };
}

describe('Jinx Death Rocket epicenter mirrors to her side', () => {
  it('player side (3,3), enemy side the mirrored (3,4)', () => {
    expect(jinxRocketEpicenter(DEFAULT_BOARD, 'player')).toEqual({ col: 3, row: 3 });
    expect(jinxRocketEpicenter(DEFAULT_BOARD, 'enemy')).toEqual({ col: 3, row: 4 });
  });
  it('mirrored boards: every enemy takes the same amount whichever side she is on, and the marker names her side\'s epicenter', () => {
    const p = rocketHits('player'), e = rocketHits('enemy');
    expect(p.hits.length).toBe(3);
    expect(e.hits).toEqual(p.hits);
    expect(p.marker).toMatchObject({ cell: { col: 3, row: 3 } });
    expect(e.marker).toMatchObject({ cell: { col: 3, row: 4 } });
  });
});

// The epicenter changes battle results, so its rule identifier is part of the content digest: a save written under the digest
// just before it (Steb's heal) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:05db2ac4';
describe('Jinx Death Rocket mirror: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.jinxRocketMirror).toBe('jinx-death-rocket-epicenter-mirrors-to-caster-side-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-jinx-rocket-mirror', createdAt: '2026-11-25T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-jinx-rocket-mirror']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
