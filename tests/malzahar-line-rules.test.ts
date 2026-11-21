import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, hexCrossLine, hexDistance, type HexCell } from '../src/simulation/board';
import { MALZAHAR_LINE_HALF } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Malzahar's gate line (11-20): a 5-hex line across the target (the 14.24 description), square to the line from him to it
// (original footage); which hex axis counts as square is self-chosen. docs/S13_RULES_GAP.md (玛尔扎哈技能直线).
const cells = (from: HexCell, to: HexCell) => hexCrossLine(DEFAULT_BOARD, from, to, MALZAHAR_LINE_HALF);
const line = (from: HexCell, to: HexCell) => cells(from, to).map(l => `${l.step}:${l.cell.col},${l.cell.row}`);

describe('Malzahar line geometry', () => {
  it('straight ahead (not along a hex axis): the row across the target, two cells either side', () => {
    expect(line({ col: 3, row: 6 }, { col: 3, row: 3 })).toEqual(['-2:1,3', '-1:2,3', '0:3,3', '1:4,3', '2:5,3']);
    expect(line({ col: 3, row: 3 }, { col: 3, row: 2 })).toEqual(['-2:1,2', '-1:2,2', '0:3,2', '1:4,2', '2:5,2']);
  });
  it('along his own row: the axis rising to the right (the two slanted axes tie)', () => {
    expect(line({ col: 1, row: 3 }, { col: 4, row: 3 })).toEqual(['-2:3,1', '-1:4,2', '0:4,3', '1:5,4', '2:5,5']);
  });
  it('drops cells off the board', () => {
    expect(line({ col: 0, row: 6 }, { col: 0, row: 3 })).toEqual(['0:0,3', '1:1,3', '2:2,3']);
    expect(line({ col: 3, row: 7 }, { col: 5, row: 3 })).toEqual(['-2:3,3', '-1:4,3', '0:5,3', '1:6,3']);
  });
  it('is the same line for both sides (the board turned half a turn maps every line onto its mirror)', () => {
    const turn = (c: HexCell): HexCell => ({ col: DEFAULT_BOARD.columns - 1 - c.col, row: DEFAULT_BOARD.rows - 1 - c.row });
    const all: HexCell[] = [];
    for (let row = 0; row < DEFAULT_BOARD.rows; row++) for (let col = 0; col < DEFAULT_BOARD.columns; col++) all.push({ col, row });
    const key = (c: HexCell) => `${c.col},${c.row}`;
    let pairs = 0;
    for (const from of all) for (const to of all) {
      const d = hexDistance(from, to);
      if (d < 1 || d > 4) continue;
      pairs++;
      const mirrored = cells(turn(from), turn(to)).map(l => key(l.cell)).sort();
      const original = cells(from, to).map(l => key(turn(l.cell))).sort();
      expect(mirrored, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).toEqual(original);
      expect(original.includes(key(turn(to))), 'the target is always on its line').toBe(true);
      expect(cells(from, to).length).toBeLessThanOrEqual(5);
    }
    expect(pairs).toBeGreaterThan(500);
  });
});

// The line changes battle results, so its rule identifier is part of the content digest: a save or replay written under the
// earlier digest (before this rule) is turned away as not matching this version, never replayed under the new rule.
const BEFORE_LINE_DIGEST = 'fnv1a32-utf16:cf212873';
describe('Malzahar line: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.malzaharGate).toBe('line-across-target-hex-axis-most-square-to-caster-target-tie-row-then-rising-2-either-side-target-then-steps-then-id');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_LINE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-line', createdAt: '2026-11-19T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_LINE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-line']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_LINE_DIGEST }))).toThrow('content-digest');
  });
});

// Display only: the cast receipt carries the gate's cells for the renderer (Malzahar's gate, cast receipt area).
import { stepCombat } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { battle, unit } from './combat-helpers';
describe('Malzahar gate cells on the cast receipt', () => {
  it("the receipt's area is the gate's on-board cells, end to end; the replay view keeps it; other casts have none", () => {
    const m = unit('p', 'player', 3, 6, { definitionId: 'malzahar', starLevel: 1, ability: resolveAbility('malzahar-ability', 1), hp: 10000, maxHp: 10000, mana: 100, maxMana: 100,
      attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 1, cooldownTicks: 1000, moveCooldownTicks: 1000, targetId: 'e',
      runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] } as any);
    const foe = (id: string, col: number, row: number) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
      hp: 100000, maxHp: 100000, mana: 0, maxMana: 0, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] } as any);
    const r = stepCombat(battle([m, foe('e', 3, 3), foe('f', 0, 0)], { strategy: { traits: [], units: [] }, combatId: 'malzahar-area', rngState: 42 } as any));
    const cast = r.events.find(e => e.type === 'cast') as any;
    expect(cast.receipt.area).toEqual({ cells: hexCrossLine(DEFAULT_BOARD, { col: 3, row: 6 }, { col: 3, row: 3 }, MALZAHAR_LINE_HALF).map(l => l.cell) });
    expect(cast.receipt.area.cells).toEqual([{ col: 1, row: 3 }, { col: 2, row: 3 }, { col: 3, row: 3 }, { col: 4, row: 3 }, { col: 5, row: 3 }]);
    expect(cast.receipt.targetIds).toEqual(['e']);
    expect(toCombatViewEvents(toLedgerEvents(r.events)).find(e => e.type === 'cast')).toMatchObject({ type: 'cast', sourceId: 'p', area: cast.receipt.area });
    expect(r.events.filter(e => e.type === 'cast' && (e as any).receipt.source.ownerId !== 'p').every(e => (e as any).receipt.area === undefined)).toBe(true);
  });
});
