import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, MALZAHAR_GATE_DELAY } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { gateEnds } from '../src/rendering/three-mode/vfx-ltk/gate-ends';

// Malzahar's gate (11-21): the bolt flies to each enemy the gate hits; the portal opens at the two ends of the rules' line
// of cells (CastReceipt.area), facing each other, not under each enemy (fitted opening time, docs/S13_RULES_GAP.md).
const BOLT = '7d0f4b1e', PORTAL = '10e4e326';

describe('vfx-ltk Malzahar gate', () => {
  it('the bolt still goes to every enemy hit; the portal is no cue of his cast but the board gate skill', () => {
    const cues = CUE_OVERRIDES.malzahar!;
    const bolt = cues.find(cue => cue.system === BOLT);
    expect(bolt).toMatchObject({ action: 'cast', event: 'projectile' });
    expect(bolt!.primary).toBeUndefined(); expect(bolt!.targetLimit).toBeUndefined();
    expect(cues.some(cue => cue.system === PORTAL)).toBe(false);
    expect(CUE_EXTRA_SKILLS['malzahar-gate']).toEqual([{ system: PORTAL, action: 'cast', event: 'cast-start', location: 'board', delay: MALZAHAR_GATE_DELAY, duration: 2 }]);
    expect(MALZAHAR_GATE_DELAY).toBeGreaterThanOrEqual(0);
  });

  it('opens at the two ends of the line, each facing the other; a one-cell line opens once', () => {
    const line = [{ col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 }];
    expect(gateEnds(line)).toEqual([{ cell: line[0], facing: line[4] }, { cell: line[4], facing: line[0] }]);
    // Off-board cells are already left out by the rules: a clipped line opens at its own ends.
    expect(gateEnds(line.slice(0, 3))).toEqual([{ cell: line[0], facing: line[2] }, { cell: line[2], facing: line[0] }]);
    expect(gateEnds([line[2]])).toEqual([{ cell: line[2], facing: null }]);
    expect(gateEnds([])).toEqual([]);
  });

  it('the renderer opens it from the cast event\'s area, for Malzahar only', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    const at = source.indexOf("event.type === 'cast' && event.area?.cells.length");
    expect(at).toBeGreaterThan(0);
    const block = source.slice(at, source.indexOf('\n      }\n', at));
    expect(block).toContain("definitionId === 'malzahar'");
    expect(block).toContain('gateEnds(event.area.cells)');
    expect(block).toContain("skill: 'malzahar-gate'");
  });
});
