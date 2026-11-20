import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, hexDistance, hexLine, type HexCell } from '../src/simulation/board';
import { MALZAHAR_LINE_HALF } from '../src/simulation/cast-windup';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Malzahar's gate line (11-20): a 5-hex line across the target (the 14.24 description); the hex sampling and tie rule are
// self-chosen. docs/S13_RULES_GAP.md (玛尔扎哈技能直线).
const steps = (from: HexCell, to: HexCell) => { const n = hexDistance(from, to); return [n - MALZAHAR_LINE_HALF, n + MALZAHAR_LINE_HALF] as const; };
const cells = (from: HexCell, to: HexCell) => hexLine(DEFAULT_BOARD, from, to, ...steps(from, to));
const line = (from: HexCell, to: HexCell) => cells(from, to).map(l => `${l.step}:${l.cell.col},${l.cell.row}`);

describe('Malzahar line geometry', () => {
  it('is centred on the target, two steps either side along the line from him through it', () => {
    expect(line({ col: 3, row: 6 }, { col: 3, row: 3 })).toEqual(['1:3,5', '2:3,4', '3:3,3', '4:4,2', '5:3,1']);
    expect(line({ col: 3, row: 7 }, { col: 5, row: 3 })).toEqual(['2:4,5', '3:5,4', '4:5,3', '5:6,2', '6:6,1']);
  });
  it('an adjacent target: his own cell (step 0) is not listed, so the near side is one cell', () => {
    expect(line({ col: 3, row: 3 }, { col: 3, row: 2 })).toEqual(['-1:4,4', '1:3,2', '2:2,1', '3:2,0']);
  });
  it('takes both cells where a step falls exactly between two, and drops cells off the board', () => {
    expect(line({ col: 1, row: 6 }, { col: 3, row: 3 })).toEqual(['2:2,4', '2:2,5', '3:3,4', '4:3,3', '5:4,2', '6:4,1', '6:5,2']);
    expect(line({ col: 3, row: 2 }, { col: 3, row: 5 })).toEqual(['1:3,3', '2:3,4', '3:3,5', '4:4,6', '5:3,7']);
    // The far end of this one is past the back row: step 5 is dropped.
    expect(line({ col: 3, row: 3 }, { col: 3, row: 6 })).toEqual(['1:3,4', '2:3,5', '3:3,6', '4:2,7']);
  });
  it('is the same line for both sides (the board turned half a turn maps every line onto its mirror)', () => {
    const turn = (c: HexCell): HexCell => ({ col: DEFAULT_BOARD.columns - 1 - c.col, row: DEFAULT_BOARD.rows - 1 - c.row });
    const all: HexCell[] = [];
    for (let row = 0; row < DEFAULT_BOARD.rows; row++) for (let col = 0; col < DEFAULT_BOARD.columns; col++) all.push({ col, row });
    const key = (l: { cell: HexCell; step: number }) => `${l.step}:${l.cell.col},${l.cell.row}`;
    let pairs = 0;
    for (const from of all) for (const to of all) {
      const d = hexDistance(from, to);
      if (d < 1 || d > 4) continue;
      pairs++;
      const mirrored = cells(turn(from), turn(to)).map(key).sort();
      const original = cells(from, to).map(l => key({ step: l.step, cell: turn(l.cell) })).sort();
      expect(mirrored, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).toEqual(original);
      expect(original.includes(key({ step: d, cell: turn(to) })), 'the target is always on its line').toBe(true);
    }
    expect(pairs).toBeGreaterThan(500);
  });
});

// The line changes battle results, so its rule identifier is part of the content digest: a save or replay written under the
// earlier digest (before this rule) is turned away as not matching this version, never replayed under the new rule.
const BEFORE_LINE_DIGEST = 'fnv1a32-utf16:cf212873';
describe('Malzahar line: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.malzaharGate).toBe('line-centred-on-target-2-either-side-along-caster-to-target-both-cells-on-tie-target-then-far-then-near-order');
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
