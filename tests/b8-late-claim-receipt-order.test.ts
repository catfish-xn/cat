import { needsAugmentHistory } from '../src/simulation/augment-history';
import { isSellableUnit } from '../src/simulation/seat-mechanics/forms';
import { describe, expect, it } from 'vitest';
import { sellUnit, createMatch, buyXp, deployMatchUnit, startMatchCombat, stepMatch, nextRound, selectChoice, selectAnomalyTarget, claimOrb, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readLootView } from '../src/simulation/loot-view';
import { grantMechanicGold, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { isAnvil } from '../src/simulation/content/anvils';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { lootEntryId } from '../src/simulation/loot-identity';
import { accepted, openConquerorAnvil } from './fixtures/g24-forge-anvil';

/*
 * B8 receipt order with retained orbs (merge 473f2e2b): receipts follow their transaction round, which is the
 * claim round (claimedRoundId) for an orb claimed later, never earlier than the orb's own round.
 *
 * Route (seed 21, the natural-forge recruit): six 3-star heroes from public mechanic
 * grants at 1-1, every later preparation sells the spare bench. At 4-7 and 5-7 the bench is filled to capacity
 * before combat, so each round's PvE forge entry stays revealed and unclaimed (the 4-7 orb's component entry is
 * still granted at 4-7). The 4-7 forge is claimed at 6-1 and the 5-7 forge at 6-2, giving two late receipts with
 * claimedRoundId 6-1 then 6-2.
 */
const SEED = 21, BOARD = ['darius', 'draven', 'rell', 'swain', 'ambessa', 'mordekaiser'], FULL_BENCH_ROUNDS = ['4-7', '5-7'];
const bench = (state: MatchState) => state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench');
const forgeOrb = (state: MatchState, roundId: string) => readLootView(state).unclaimedOrbs?.find(o => o.orbId.startsWith(JSON.stringify(['orb', roundId]).slice(0, -1) + ',') && o.entries.some(e => e.kind === 'forge'));

function recruit(input: MatchState): MatchState {
  let state = accepted(grantMechanicGold(input, { receiptId: 'fixture:gold', source: 'fixture', amount: 150 }));
  while (state.level < 6) state = accepted(buyXp(state));
  for (const u of state.preparation.units.filter(u => u.team === 'player')) state = accepted(deployMatchUnit(state, u.id, { kind: 'bench', slot: 0 }));
  for (const [col, definitionId] of BOARD.entries()) {
    for (let copy = 0; copy < 9; copy++) state = accepted(grantMechanicUnit(state, { receiptId: `fixture:${definitionId}:${copy}`, source: 'fixture', definitionId }));
    const unit = state.preparation.units.find(u => u.team === 'player' && u.definitionId === definitionId && u.starLevel === 3)!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col, row: 4 } }));
  }
  return state;
}
/** Sell the spare bench; at 4-7/5-7 refill it to capacity so the PvE forge entry cannot be granted at combat end. */
function prepare(input: MatchState): MatchState {
  let state = input;
  for (const u of bench(state).filter(u => u.id !== 'unit-1' && !isAnvil(u.definitionId) && isSellableUnit(u.definitionId))) state = accepted(sellUnit(state, u.id));
  if (FULL_BENCH_ROUNDS.includes(state.roundDefinitionId)) {
    // Direct fixture grants are not recorded in solo augment-command proofs.
    expect(needsAugmentHistory(state)).toBe(false);
    const fillers = SHOP_CATALOG.filter(d => !BOARD.includes(d));
    for (let i = 0; bench(state).length < state.preparation.benchSize; i++)
      state = accepted(grantMechanicUnit(state, { receiptId: `fixture:filler:${state.roundDefinitionId}:${i}`, source: 'fixture', definitionId: fillers[i] }));
  }
  return state;
}
/** Public commands from the current state to the preparation of `target`. */
function advanceTo(input: MatchState, target: string): MatchState {
  let state = input;
  for (let guard = 0; guard < 20000; guard++) {
    if (state.phase === 'choice') {
      let c = state.pendingChoice!;
      if (c.kind === 'anomaly' && c.step === 'target') { state = accepted(selectAnomalyTarget(state, c.choiceId, c.generation, state.preparation.units.find(u => u.team === 'player')!.id)); c = state.pendingChoice!; }
      // Natural offers for seed 21; these choices avoid history-dependent mechanics.
      const id = c.kind === 'augment' ? ({ '2-1': 'inspiring-epitaph', '3-2': 'bronze-for-life-ii', '4-2': 'clockwork-accelerator' } as Record<string, string>)[state.roundDefinitionId] : c.offers[0];
      expect(c.offers).toContain(id);
      state = accepted(selectChoice(state, c.choiceId, c.generation, id)); continue;
    }
    if (state.phase === 'combat') { state = stepMatch(state).state; continue; }
    if (state.phase === 'settlement') {
      const opened = openConquerorAnvil(state); if (opened) { state = opened.state; continue; }
      while (state.m8.loot.direct.some(d => d.status === 'pending-capacity')) {
        const extra: MatchState['preparation']['units'][number] = bench(state).find(u => !isAnvil(u.definitionId) && isSellableUnit(u.definitionId))!; state = accepted(sellUnit(state, extra.id));
      }
      state = accepted(nextRound(state, state.round)); continue;
    }
    if (state.phase !== 'preparation') throw Error(`Unexpected phase ${state.phase} at ${state.roundDefinitionId}`);
    if (state.round === 1 && state.combat === null && !state.preparation.units.some(u => u.team === 'player' && u.starLevel === 3)) state = recruit(state);
    if (state.roundDefinitionId === target) return state;
    state = accepted(startMatchCombat(prepare(state)));
  }
  throw Error(`Route budget before ${target}`);
}

/** Built once per file: each case advances the shared route by a few rounds (a filtered run builds earlier stages). */
const STAGES = ['3-1', '3-5', '4-1', '4-3', '4-7', '5-1', '5-3', '5-6', '5-7', '6-1', '6-2'] as const;
type Stage = typeof STAGES[number];
const stages = new Map<Stage, MatchState>();
function stage(target: Stage): MatchState {
  const cached = stages.get(target); if (cached) return cached;
  const index = STAGES.indexOf(target), previous = index ? stage(STAGES[index - 1]) : createMatch(SEED);
  let state = advanceTo(previous, target);
  // The retained 4-7 forge is claimed at 6-1, the retained 5-7 forge at 6-2.
  const claim = target === '6-1' ? '4-7' : target === '6-2' ? '5-7' : null;
  if (claim) {
    state = prepare(state);
    const orb = forgeOrb(state, claim)!; expect(orb).toBeDefined();
    state = accepted(claimOrb(state, orb.orbId, state.round));
  }
  stages.set(target, state); return state;
}
const lateReceipts = (state: MatchState) => state.m8.loot.receipts.filter(r => r.claimedRoundId !== undefined);

describe('B8 late-claimed retained orb receipts (seed 21)', () => {
  it.each(STAGES)('public route reaches %s', target => {
    const state = stage(target);
    expect([state.roundDefinitionId, state.phase]).toEqual([target, 'preparation']);
    expect(state.playerHp).toBeGreaterThan(0);
    if (target === '5-1' || target === '5-3') {
      // 4-7 combat ended with a full bench: the component entry was granted at 4-7, the forge entry is retained.
      const orb = forgeOrb(state, '4-7')!, [item, forge] = [0, 1].map(ordinal => lootEntryId(orb.orbId, ordinal));
      expect(orb.entries.map(e => e.kind)).toEqual(['item', 'forge']);
      expect([item, forge].map(id => state.m8.loot.direct.find(d => d.dropId === id)?.status)).toEqual(['granted', 'revealed']);
      expect(state.m8.loot.receipts.find(r => r.dropId === item)).toBeDefined();
      expect(state.m8.loot.receipts.find(r => r.dropId === item)).not.toHaveProperty('claimedRoundId');
      expect(lateReceipts(state)).toEqual([]);
    }
    if (target === '6-1') {
      expect(forgeOrb(state, '4-7')).toBeUndefined(); expect(forgeOrb(state, '5-7')).toBeDefined();
      expect(lateReceipts(state)).toMatchObject([{ payload: { kind: 'forge' }, claimedRoundId: '6-1', resolution: 'held' }]);
      expect(JSON.parse(JSON.parse(lateReceipts(state)[0].dropId)[0])[1]).toBe('4-7');
      expect(state.m8.loot.receipts.at(-1)).toBe(lateReceipts(state)[0]);
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
    }
    if (target === '6-2') {
      expect(forgeOrb(state, '5-7')).toBeUndefined();
      expect(lateReceipts(state).map(r => [JSON.parse(JSON.parse(r.dropId)[0])[1], r.claimedRoundId])).toEqual([['4-7', '6-1'], ['5-7', '6-2']]);
      expect(state.m8.loot.receipts.slice(-2)).toEqual(lateReceipts(state));
    }
  });

  /** The three save entrances (as in g2-3-lesser-shimmer-duplicator). */
  const ENTRIES = ['serialized save', 'state object', 'JSON string'] as const;
  const restoreVia = (state: MatchState, entry: typeof ENTRIES[number]) => entry === 'serialized save' ? restoreMatch(serializeMatch(state)) : entry === 'state object' ? restoreMatch(structuredClone(state)) : restoreMatch(JSON.stringify(state));
  it.each(ENTRIES)('the 6-2 save with both late receipts passes the %s entrance', entry => {
    const state = stage('6-2'), restored = restoreVia(state, entry);
    expect(restored).toEqual(state);
    expect(serializeMatch(restored)).toBe(serializeMatch(state));
  });

  type Raw = any;
  const late = (raw: Raw, claimedRoundId: string) => raw.m8.loot.receipts.find((r: Raw) => r.claimedRoundId === claimedRoundId);
  /* Which check rejects each forgery: validateB8Loot first runs validateResourceReceipts, whose loot receipt identity
   * already requires claim round >= source round and a catalog round, so (a) and (d) stop there before the
   * B8 'receipt order' loop; the frozen ledger replay rejects a moved source round (b); the swap (c) passes the
   * per-receipt identity and is rejected by 'receipt order'. These are also the proof that the source-ordinal
   * half of that check is defensive: changing only the claim fails identity, while changing the slot or its
   * dropId to escape that bound fails deterministic frozen-ledger replay before the receipt loop. */
  const TAMPERS: readonly { name: string; error: RegExp; change: (raw: Raw) => void }[] = [
    { name: 'claim round before the orb round (4-7 orb claimed at 4-6)', error: /^Invalid resource provenance: loot receipt identity$/, change: raw => { late(raw, '6-1').claimedRoundId = '4-6'; } },
    { name: 'claim round two stages early (4-7 orb claimed at 3-7)', error: /^Invalid resource provenance: loot receipt identity$/, change: raw => { late(raw, '6-1').claimedRoundId = '3-7'; } },
    { name: 'orb round moved after its claim round (frozen 4-7 slot as 6-7)', error: /^Invalid frozen loot ledger$/, change: raw => {
      const dropId = late(raw, '6-1').dropId;
      for (const round of raw.m8.loot.frozen.rounds) for (const drop of [...round.encounterPlan.drops, ...round.orbs.flatMap((o: Raw) => o.entries)])
        if (drop.dropId === dropId) drop.roundId = '6-7';
    } },
    { name: 'the two late claim rounds swapped', error: /^Invalid B8 Match: receipt order$/, change: raw => {
      const first = late(raw, '6-1'), second = late(raw, '6-2'); first.claimedRoundId = '6-2'; second.claimedRoundId = '6-1';
    } },
    { name: 'claim round that does not exist (9-9)', error: /^Unknown catalog round ID$/, change: raw => { late(raw, '6-1').claimedRoundId = '9-9'; } },
  ];
  it.each(TAMPERS.flatMap(t => (['state object', 'JSON string'] as const).map(entry => ({ ...t, entry }))))('rejects $name through the $entry entrance', ({ change, entry, error }) => {
    const state = stage('6-2'), saved = serializeMatch(state), raw = JSON.parse(saved);
    change(raw);
    expect(() => entry === 'state object' ? restoreMatch(raw) : restoreMatch(JSON.stringify(raw))).toThrowError(error);
    expect(serializeMatch(state)).toBe(saved);
  });
});
