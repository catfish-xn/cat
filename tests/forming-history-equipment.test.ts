import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { validateHistoricalEquipment } from '../src/simulation/b8-restore';
import { pausableRoute } from './fixtures/t13-loot-public';
const { run } = createRequire(import.meta.url)('../scripts/generate-m5-route.cjs');

// Seed 2199's public cannon route (tests/m6-application-failures.cjs) takes Golemify at 3-2 while two completed
// items are equipped: the forming removal returns them to the inventory like a sale, and the saved-history check
// (battle-record-validation checkHistoryCarry) must carry that return instead of keeping the old bindings.
describe('forming removal in the historical equipment fold', () => {
  const captured = new Error('captured');
  let settled: MatchState | undefined, formed: MatchState | undefined;
  // The public route plays one battle per case; the 3-2 capture ends it.
  const through = pausableRoute(async onRound => {
    try {
      await run(api, { build: 'cannon', seed: 2199, onRound(state: MatchState) { if (state.roundDefinitionId === '3-1') settled = state; return onRound(state); },
        onStep(before: MatchState, _result: unknown, command: { type: string } | undefined) {
          if (command && before.roundDefinitionId === '3-2' && before.phase === 'preparation') { formed = before; throw captured; }
        } });
    } catch (error) { if (error !== captured) throw error; }
  });
  for (let round = 1; round <= 11; round++) it(`plays the public seed-2199 route through round ${round}`, async () => { await through(round); });
  it('Golemify returns equipped items to the inventory and the 3-1 -> 3-2 history continues', async () => {
    await through(Infinity);
    expect(settled && formed).toBeTruthy();
    expect(formed!.augments.map(a => a.definitionId)).toContain('golemify');
    const removed = formed!.resourceProvenance.entries.flatMap(e => e.kind === 'unit-removed' && e.definitionId ? [e.unitId] : []);
    const held = settled!.items.filter(i => i.location.kind === 'unit' && removed.includes(i.location.unitId));
    expect(held.length).toBeGreaterThan(0);
    for (const item of held) expect(formed!.items.find(i => i.id === item.id)?.location).toEqual({ kind: 'inventory' });
    expect(() => validateHistoricalEquipment(settled!, formed!)).not.toThrow();
    // A forged binding that survives the removal is still rejected.
    const forged = structuredClone(formed!);
    Object.assign(forged.items.find(i => i.id === held[0].id)!, { location: held[0].location });
    expect(() => validateHistoricalEquipment(settled!, forged)).toThrow('historical equipment continuation');
  });
});
