import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, hexDistance, hexLine, type HexCell } from '../src/simulation/board';
import { MALZAHAR_LINE_BACK, MALZAHAR_LINE_FRONT } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Malzahar's gate line (11-19, inferred/self-chosen, not original data): docs/S13_RULES_GAP.md (玛尔扎哈技能直线).
const line = (from: HexCell, to: HexCell) =>
  hexLine(DEFAULT_BOARD, from, to, MALZAHAR_LINE_BACK, MALZAHAR_LINE_FRONT).map(l => `${l.step}:${l.cell.col},${l.cell.row}`);

describe('Malzahar line geometry', () => {
  it('runs 2 steps behind him and 3 ahead through an adjacent target, straight on, clipped by the board', () => {
    expect(line({ col: 3, row: 3 }, { col: 3, row: 2 })).toEqual(['-2:4,5', '-1:4,4', '1:3,2', '2:2,1', '3:2,0']);
    // Behind him from the back row: off the board, dropped.
    expect(line({ col: 3, row: 6 }, { col: 3, row: 3 })).toEqual(['-1:2,7', '1:3,5', '2:3,4', '3:3,3']);
  });
  it('reaches a target further than 3 steps (the front part runs to it)', () => {
    expect(line({ col: 3, row: 7 }, { col: 5, row: 3 })).toEqual(['1:4,6', '2:4,5', '3:5,4', '4:5,3']);
  });
  it('takes both cells where a step falls exactly between two', () => {
    expect(line({ col: 1, row: 6 }, { col: 3, row: 3 })).toEqual(['-1:0,7', '1:1,5', '2:2,4', '2:2,5', '3:3,4', '4:3,3']);
  });
  it('is the same line for both sides (the board turned half a turn maps every line onto its mirror)', () => {
    const turn = (c: HexCell): HexCell => ({ col: DEFAULT_BOARD.columns - 1 - c.col, row: DEFAULT_BOARD.rows - 1 - c.row });
    const cells: HexCell[] = [];
    for (let row = 0; row < DEFAULT_BOARD.rows; row++) for (let col = 0; col < DEFAULT_BOARD.columns; col++) cells.push({ col, row });
    const key = (l: { cell: HexCell; step: number }) => `${l.step}:${l.cell.col},${l.cell.row}`;
    let pairs = 0;
    for (const from of cells) for (const to of cells) {
      const d = hexDistance(from, to);
      if (d < 1 || d > 4) continue;
      pairs++;
      const mirrored = hexLine(DEFAULT_BOARD, turn(from), turn(to), MALZAHAR_LINE_BACK, MALZAHAR_LINE_FRONT).map(key).sort();
      const original = hexLine(DEFAULT_BOARD, from, to, MALZAHAR_LINE_BACK, MALZAHAR_LINE_FRONT).map(l => key({ step: l.step, cell: turn(l.cell) })).sort();
      expect(mirrored, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).toEqual(original);
      expect(original.some(k => k.endsWith(`:${turn(to).col},${turn(to).row}`)), 'the target is always on its line').toBe(true);
    }
    expect(pairs).toBeGreaterThan(500);
  });
});

// The line changes battle results, so its rule identifier is part of the content digest: a save or replay written under the
// earlier digest (before this rule) is turned away as not matching this version, never replayed under the new rule.
const BEFORE_LINE_DIGEST = 'fnv1a32-utf16:cf212873';
describe('Malzahar line: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.malzaharGate).toBe('line-through-caster-back-2-front-3-or-to-target-both-cells-on-tie-front-then-back-order');
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
