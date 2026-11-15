import { describe, expect, it } from 'vitest';
import { runRealCombat } from '../dev/castcmp/real-combat';

// User 2026-11-15: Jayce's passive gives "the nearest N allies" a shield (melee) or attack speed (ranged), measured from his
// forge; the forge itself is not one of those allies (as g2-3-combat.ts's heal already excludes it). Real combats.
type Shown = { type: string; sourceId?: string; targetId?: string; unitId?: string; reason?: string; kind?: string };
const at = (row: number, col: number) => ({ kind: 'board', cell: { row, col } });

/** Per Jayce cast: who got his shields (melee) or attack speed (ranged; shown as a 'stat-buff' status). */
function buffsPerCast(form: 'melee' | 'ranged', allies: { id: string; definitionId: string; cell: [number, number] }[]) {
  const units = [
    { id: 'jayce', definitionId: 'jayce', team: 'player', starLevel: 2, form, location: at(form === 'melee' ? 4 : 6, 3) },
    ...allies.map(a => ({ id: a.id, definitionId: a.definitionId, team: 'player', starLevel: 2, location: at(...a.cell) })),
    ...['garen', 'drmundo', 'leona'].map((d, i) => ({ id: `e${i}`, definitionId: d, team: 'enemy', starLevel: 2, location: at(2, 1 + i * 2) })),
  ];
  const casts: string[][] = [];
  runRealCombat(units, 1, (_state, shown: Shown[]) => {
    if (!shown.some(e => e.type === 'cast' && e.sourceId === 'jayce')) return;
    casts.push(shown.filter(e => (e.type === 'shieldLayerChanged' && e.reason === 'granted')
      || (e.type === 'statusChanged' && e.kind === 'stat-buff' && ['applied', 'refreshed'].includes(e.reason ?? '')))
      .map(e => e.targetId ?? e.unitId ?? '?').sort());
  }, 3);
  return casts;
}
const four = [
  { id: 'a1', definitionId: 'leona', cell: [4, 1] as [number, number] }, { id: 'a2', definitionId: 'vi', cell: [4, 5] as [number, number] },
  { id: 'a3', definitionId: 'caitlyn', cell: [6, 1] as [number, number] }, { id: 'a4', definitionId: 'jinx', cell: [6, 5] as [number, number] },
];

describe('Jayce\'s nearest allies leave his forge out (user 2026-11-15)', () => {
  for (const form of ['melee', 'ranged'] as const) {
    it(`${form}: each cast gives its 3 buffs to 3 real allies, never to the forge`, () => {
      const casts = buffsPerCast(form, four);
      expect(casts.length).toBeGreaterThanOrEqual(1);
      for (const got of casts) {
        expect(got).toHaveLength(3);
        expect(got.some(id => id.includes('g23-forge'))).toBe(false);
      }
    });
  }

  it('with one ally besides Jayce, only those two get a buff; the forge does not take the third', () => {
    for (const form of ['melee', 'ranged'] as const) {
      const casts = buffsPerCast(form, four.slice(0, 1));
      expect(casts.length).toBeGreaterThanOrEqual(1);
      // The first cast reaches both; later ones only whoever is still alive. The forge never takes the third.
      expect(casts[0]).toEqual(['a1', 'jayce']);
      for (const got of casts) for (const id of got) expect(['a1', 'jayce']).toContain(id);
    }
  });
});
