import { describe, expect, it } from 'vitest';
import { createMatch, setShopLock, startMatchCombat, stepMatch } from '../../src/simulation/match';
import { createMatchRestoreSession, restoreMatch } from '../../src/simulation/serialization';
import type { MatchState } from '../../src/simulation/match-types';
function accept(result: { state: MatchState; ok: boolean }): MatchState { expect(result.ok).toBe(true); return result.state; }
describe('call-local preparation replay boundaries', () => {
  it('keeps seed, full commands and short prefixes independent', () => {
    const restore = createMatchRestoreSession();
    const first = createMatch(42), other = createMatch(1);
    const locked = accept(setShopLock(first, true, first.shop.generation));
    expect(restore(locked)).toEqual(locked);
    expect(restore(other)).toEqual(other);
    expect(restore(first)).toEqual(first);
    const forged = structuredClone(first); Object.assign(forged, { gold: forged.gold + 1 });
    expect(() => restore(forged)).toThrow('preparation-ledger-gold');
    expect(() => restoreMatch(forged)).toThrow('preparation-ledger-gold');
    expect(restore(first)).toEqual(first);
    const returned = restore(locked); Object.assign(returned, { gold: returned.gold + 1 });
    expect(restore(locked)).toEqual(locked);
  });
  it('does not equate same-length command parameters or compressed tick endpoints', () => {
    const restore = createMatchRestoreSession();
    const first = createMatch(42);
    const locked = accept(setShopLock(first, true, first.shop.generation));
    expect(restore(locked)).toEqual(locked);
    const altered = structuredClone(locked);
    altered.preparationLedger.commands[0].args[0] = false;
    expect(() => restore(altered)).toThrow(/preparation-ledger/);
    let state = accept(startMatchCombat(first));
    const atStart = structuredClone(state);
    state = stepMatch(state).state;
    expect(restore(state)).toEqual(state);
    expect(restore(atStart)).toEqual(atStart);
    const bad = structuredClone(atStart); Object.assign(bad, { gold: bad.gold + 1 });
    expect(() => restore(bad)).toThrow('preparation-ledger-gold');
  });
});

import * as matchApi from '../../src/simulation/match';
import { vi } from 'vitest';
import { BattleHistory, validateBattleCollection } from '../../src/replay/history';
import { publicEquipmentPreparation } from '../fixtures/b8-public-equipment';
import type { SaveEnvelope } from '../../src/m6/contracts';
it.each([false, true])('collection reuses plain battle proofs and fully checks equipment command records: %s', async (equipDuringCombat) => {
  let state = createMatch(42);
  const history = new BattleHistory('scope-proof');
  if (equipDuringCombat) {
    state = publicEquipmentPreparation(['vest'], { history });
    state = accept(matchApi.deployMatchUnit(state, 'unit-1', {kind:'board',cell:{col:3,row:7}}));
  }
  function apply(result: ReturnType<typeof stepMatch>) {
    history.observe({ before: state, after: result.state,
      events: result.events.filter(e => e.domain === 'combat'), reason: 'tick' });
    state = result.state;
  }
  const start = startMatchCombat(state); expect(start.ok).toBe(true); apply(start as ReturnType<typeof stepMatch>);
  if (equipDuringCombat) {
    expect(state.phase).toBe('combat');
    expect(state.items.length).toBeGreaterThan(0);
    const beforeCombat = state.combat;
    const equip = matchApi.equipItem(state, state.items[0].id, 'unit-1', 0);
    expect(equip.ok).toBe(true); apply(equip as ReturnType<typeof stepMatch>);
    expect(state.combat).toBe(beforeCombat);
  }
  while (state.phase === 'combat') apply(stepMatch(state));
  const envelope: SaveEnvelope = {kind:'hex-autobattler-save', saveFormatVersion:3, replayFormatVersion:3,
    runId:'scope-proof', createdAt:'2026-10-17T00:00:00Z', match:state, battles:history.completedRecords,currentBattle:null};
  const scoped = createMatchRestoreSession();
  expect(scoped(state)).toEqual(state);
  const context = history.completedRecords.at(-1)!.context;
  const proof = scoped.battleProof(context, state.combat!.tick)!;
  expect(proof).toBeDefined();
  Object.assign(proof.settledMatch, { gold: proof.settledMatch.gold + 1 });
  expect(scoped.battleProof(context, state.combat!.tick)!.settledMatch).toEqual(state);
  const expected = state.preparationLedger.commands.reduce((n,c)=>n+(c.name==='stepMatch'?c.repeats:0),0);
  const spy = vi.spyOn(matchApi,'stepMatch');
  try {
    const pending = validateBattleCollection(envelope);
    const independent = createMatch(1); Object.assign(independent, { gold: independent.gold + 1 });
    expect(() => restoreMatch(independent)).toThrow('preparation-ledger-gold');
    await pending;
    // Upstream equipmentCommands must be replayed independently, even when the ledger has a proof.
    expect(spy).toHaveBeenCalledTimes(expected + (equipDuringCombat ? state.combat!.tick : 0));
  }
  finally { spy.mockRestore(); }
  if (equipDuringCombat) {
    const omitted = structuredClone(envelope);
    Reflect.deleteProperty(omitted.battles.at(-1)!, 'equipmentCommands');
    await expect(validateBattleCollection(omitted)).rejects.toThrow();
  }
  const forged = structuredClone(envelope);
  Object.assign(forged.battles[0], { stateHash: 'forged' });
  await expect(validateBattleCollection(forged)).rejects.toThrow('内容校验');
});
