import { describe, expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, startMatchCombat, stepMatch, nextRound,
  type MatchState, type MatchCommandResult, type MultiplayerCommandResult } from '../src/server-entry';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { grantPveRemover, validatePveRemover } from '../src/simulation/pve-remover';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { lootPlan } from './fixtures/orb-combo-oracle.cjs';

const accepted = (result: MatchCommandResult | MultiplayerCommandResult) => { if (!result.ok) throw new Error(result.reason); return result.state; };
const bonuses = (state: MatchState) => state.seatMechanics!.receipts.filter(r => r.source === 'pve-remover');
const pve = ROUND_CATALOG.filter(r => r.kind === 'pve');

/** Synthetic no-player concession isolates settlement from kills and random rewards. */
function concession(round: typeof pve[number], online: boolean, hp = 100): MatchState {
  const initial = createMatch(17);
  const base = online ? accepted(enableMultiplayerSettlement(initial, 'arbitrary-seat')) : initial;
  const enemies = createRoundEnemies(round.ordinal);
  return {...base, playerHp: hp, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: {...base.m8, round, loot: prepareMatchLoot(base.seed, round.ordinal),
      preparation: {...base.m8.preparation, roundId: round.roundId, encounterId: round.encounterId, enemies}},
    preparation: {...base.preparation, units: enemies}};
}

describe('14.23 onward fixed PvE remover', () => {
  it('uses the authoritative eight PvE nodes; overtime has no additional PvE nodes', () => {
    expect(pve.map(r => r.roundId)).toEqual(['1-2','1-3','1-4','2-7','3-7','4-7','5-7','6-7']);
  });
  it.each(pve.flatMap(round => [false, true].map(online => ({round, online}))))(
    '$round.roundId online=$online: grants even on a survived loss without kills, once and without RNG', ({round, online}) => {
      const before = concession(round, online);
      const result = startMatchCombat(before), settled = accepted(result);
      expect(settled.playerHp).toBeGreaterThan(0);
      expect(bonuses(settled)).toEqual([{receiptId:`pve-remover:${round.roundId}`, source:'pve-remover',
        kind:'consumable', round:round.ordinal, roundId:round.roundId, definitionId:'magnetic-remover', consumableId:'consumable-1'}]);
      expect(settled.consumables).toEqual([{consumableId:'consumable-1',definitionId:'magnetic-remover'}]);
      expect(settled.m8.loot.receipts).toEqual([]);
      expect(settled.m8.loot.frozen).toEqual(before.m8.loot.frozen);
      expect(settled.m8.loot.frozen.rounds).toEqual(lootPlan(17,round.ordinal).rounds);
      expect(settled.reforgeState).toBe(before.reforgeState);
      expect(settled.rngState).toBe(before.rngState);
      expect(result.ok && result.events.filter(e => e.type === 'mechanicGranted' && e.receipt.source === 'pve-remover')).toHaveLength(1);
      expect(stepMatch(settled)).toEqual({state:settled,events:[]});
      expect(grantPveRemover(settled)).toBe(settled);
    });
  it.each([false, true])('HP zero online=%s: no fixed reward', online => {
    const state = accepted(startMatchCombat(concession(pve[0], online, 1)));
    expect(state.playerHp).toBe(0); expect(bonuses(state)).toEqual([]); expect(state.consumables).toEqual([]);
  });
  it('real opening accumulates bonuses beside box removers, restores and cannot grant again', () => {
    let state = createMatch(17);
    for (let i = 0; i < 3; i++) {
      state = accepted(startMatchCombat(state));
      while (state.phase === 'combat') state = stepMatch(state).state;
      const bonus = bonuses(state);
      expect(bonus).toHaveLength(i + 1);
      const boxIds = state.m8.loot.receipts.flatMap(r => r.payload.kind === 'consumable' ? r.grantedConsumableIds ?? [] : []);
      expect(state.consumables).toHaveLength(bonus.length + boxIds.length);
      const restored = restoreMatch(serializeMatch(state));
      expect(restored).toEqual(state); expect(stepMatch(restored)).toEqual({state:restored,events:[]});
      expect(grantPveRemover(restored)).toBe(restored);
      if (i < 2) state = accepted(nextRound(restored, restored.round));
    }
    expect(state.m8.loot.receipts.some(r => r.payload.kind === 'consumable' && r.payload.definitionId === 'magnetic-remover')).toBe(true);
    expect(new Set(state.consumables.map(c => c.consumableId)).size).toBe(state.consumables.length);
    expect(startMatchCombat(state)).toEqual({ok:false,state,reason:'wrong-phase'});
    for (const kind of ['missing', 'duplicate', 'wrong-round', 'wrong-definition', 'unsettled'] as const) {
      const forged = structuredClone(state), receipts = [...forged.seatMechanics!.receipts];
      Object.assign(forged.seatMechanics!, {receipts});
      const index = receipts.findIndex(r => r.source === 'pve-remover');
      if (kind === 'missing') receipts.splice(index, 1);
      if (kind === 'duplicate') receipts.push({...receipts[index]});
      if (kind === 'wrong-round') Object.assign(receipts[index], {roundId:'2-1'});
      if (kind === 'wrong-definition') Object.assign(receipts[index], {definitionId:'reforger'});
      if (kind === 'unsettled') (forged.roundResults as unknown[]).splice(0, 1);
      expect(() => validatePveRemover(forged), kind).toThrow('Invalid PvE remover receipt');
      expect(() => restoreMatch(serializeMatch(forged)), kind).toThrow();
    }
  });
  it('preparation and non-PvE settlements are ineligible', () => {
    const initial = createMatch(17); expect(grantPveRemover(initial)).toBe(initial);
    const settled = accepted(startMatchCombat(concession(pve[0], false)));
    const pvp = {...settled,round:4,roundResults:[{...settled.roundResults[0],round:4,roundId:'2-1',roundKind:'pvp' as const}]};
    expect(grantPveRemover(pvp)).toBe(pvp);
    const supply = {...pvp,round:7,roundResults:[{...pvp.roundResults[0],round:7,roundId:'2-4',roundKind:'supply' as const}]};
    expect(grantPveRemover(supply)).toBe(supply);
  });
});
