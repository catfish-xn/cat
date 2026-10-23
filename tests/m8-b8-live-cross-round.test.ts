import ragebladeRoute from '../scripts/v17-rageblade-route.cjs';
import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchEvent, MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

function accepted(result: api.MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Cross-round loot fixture: ${result.reason}`);
  return result.state;
}
function roundTrip(state: MatchState): MatchState {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state);
  expect(api.readLootView(restored)).toEqual(api.readLootView(state));
  return restored;
}
/** Run to the end of combat; restore at the first tick and require identical remaining state/events. */
function fight(preparation: MatchState): { state: MatchState; events: MatchEvent[] } {
  const started = accepted(api.startMatchCombat(preparation));
  const finish = (initial: MatchState) => {
    let state = initial; const events: MatchEvent[] = [];
    while (state.phase === 'combat') { const next = api.stepMatch(state); state = next.state; events.push(...next.events); }
    return { state, events };
  };
  const first = api.stepMatch(started).state, uninterrupted = finish(first);
  expect(finish(roundTrip(first))).toEqual(uninterrupted);
  return uninterrupted;
}
function reject(state: MatchState, message: string, change: (raw: any) => void): void {
  const saved = serializeMatch(state), raw = JSON.parse(saved);
  change(raw);
  expect(() => restoreMatch(raw), change.toString()).toThrowError(message);
  expect(serializeMatch(state)).toBe(saved);
}
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
const lootItem = (state: MatchState, definitionId: string) => state.m8.loot.receipts.find(r => r.payload.kind === 'item' && r.payload.definitionId === definitionId)!;

/* T13 seed 14349: independent literal-table oracle gives Amumu opening, baseline random Irelia/Lux, rod,
 * gloves and bow. Cross-round components are random earned drops, not PvE picks. */
const choiceViews: { roundId: string; kind: string; choiceId: string; view: ReturnType<typeof api.readLootView> }[] = [];
const openingState = createOpening();
function createOpening(): MatchState {
  const current=ragebladeRoute.prefix(api,(before:MatchState,_after:MatchState,_pick:string)=>{const choice=before.pendingChoice!;choiceViews.push({roundId:before.roundDefinitionId,kind:choice.kind,choiceId:choice.choiceId,view:api.readLootView(before)});});
  return current;
}

describe('B8 loot carried across rounds: combine, equip, fight and sell', () => {
  const opening = openingState;
  it('arrives at 2-1 with the frozen opening rewards and only current-round loot in the view', () => {
    expect([opening.level,opening.xp]).toEqual([5,0]);
    const expected=independentLootPlan(27,10).rounds.flatMap(r=>r.encounterPlan.drops);
    expect(opening.m8.loot.receipts.map(r=>r.payload)).toEqual(expected.map(d=>d.payload));
    // v22 augment tiers make the 2-1 card Little Buddies (a stat augment, no unit grant), and seed 27's
    // crab-rave opening adds its 2-7 blue component (cloak) as a mechanic receipt.
    expect(opening.augments.map(a=>a.definitionId)).toEqual(['little-buddies']);
    expect(players(opening).map(u=>u.definitionId).sort()).toEqual(['irelia','lux','renata','sett','steb']);
    expect(opening.items.map(i=>i.definitionId).sort()).toEqual(['belt','bow','cloak','gloves','rod','rod','rod','sword','tear']);
    expect(opening.consumables.map(c=>c.definitionId)).toEqual(Array(4).fill('magnetic-remover'));
    expect(api.readLootView(opening)).toEqual({ roundId: '3-1', revealedDrops: [], revealedOrbs: [], pendingClaims: [], canContinue: false, reason: 'unsettled-round', pendingChoice: null });
    roundTrip(opening);
  });

  // 2-1: combine the two loot components from different rounds, equip the loot-born Lux, fight.
  const bow = lootItem(opening, 'bow'), rod = lootItem(opening, 'rod');
  const combined = accepted(api.combineItems(opening, bow.grantedItemIds[0], rod.grantedItemIds[0]));
  const rageblade = combined.items.find(item => item.definitionId === 'rageblade')!;
  const lux = players(opening).find(unit => unit.definitionId === 'lux')!;
  const equipped = accepted(api.equipItem(combined, rageblade.id, lux.id, 0));
  const fielded = accepted(api.deployMatchUnit(equipped, lux.id, { kind: 'board', cell: { col: 3, row: 7 } }));
  const battle = fight(fielded);
  const nextPreparation = accepted(api.nextRound(battle.state, battle.state.round));
  const salePreparation=nextPreparation.phase==='choice'?accepted(api.selectChoice(nextPreparation,nextPreparation.pendingChoice!.choiceId,nextPreparation.pendingChoice!.generation,nextPreparation.pendingChoice!.offers[0])):nextPreparation;
  const sold = api.sellUnit(salePreparation, lux.id);

  it('names only real loot picks as pending-choice; the 2-1 augment and 2-4 supply picks are not', () => {
    expect(choiceViews.map(entry => [entry.roundId, entry.kind, entry.view.reason])).toEqual([
      ['2-1', 'augment', 'unsettled-round'],['2-4','component','unsettled-round']]);
    for (const entry of choiceViews.filter(entry => entry.view.reason === 'pending-choice')) {
      const descriptor = openingState.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === entry.roundId)!.choices[0];
      expect(entry.view.pendingChoice).toEqual({ dropId: descriptor.dropId, encounterId: descriptor.encounterId,
        sourceUnitId: descriptor.sourceUnitId, roundId: entry.roundId, choiceId: entry.choiceId, generation: 0 });
    }
    expect(choiceViews.find(entry => entry.roundId === '2-1')!.view.pendingChoice).toBeNull();
    // 2-4 is a supply round: its scheduled component pick is not a loot pick.
    const supply=choiceViews.find(e=>e.roundId==='2-4')!;
    expect(supply.kind).toBe('component');expect(supply.view).toMatchObject({roundId:'2-4',reason:'unsettled-round',pendingChoice:null,canContinue:false});
  });

  it('consumes both loot components into one item without touching their receipts', () => {
    expect(combined.items.filter(item => item.id === bow.grantedItemIds[0] || item.id === rod.grantedItemIds[0])).toEqual([]);
    expect(combined.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    const facts = combined.resourceProvenance.entries.slice(opening.resourceProvenance.entries.length);
    expect(facts.map(fact => fact.kind)).toEqual(['item-combined']);
    for (const step of [combined, equipped, fielded]) roundTrip(step);
  });
  it('fights 2-1 with the cross-round Rageblade and keeps loot identity through settlement and Continue', () => {
    expect(battle.events.some(event => event.type === 'statChanged' && event.source.definitionId === 'rageblade' && event.unitId === lux.id)).toBe(true);
    expect(battle.state.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    roundTrip(battle.state);
    expect(nextPreparation.roundDefinitionId).toBe('3-2');
    expect(api.readLootView(nextPreparation).revealedDrops).toEqual([]);
    roundTrip(nextPreparation);
  });
  it('selling the loot-born carrier returns the combined item and remains a legal history', () => {
    if (!sold.ok) throw new Error(sold.reason);
    expect(sold.events.map(event => event.type)).toContain('itemsReturned');
    expect(sold.state.items.find(item => item.id === rageblade.id)?.location).toEqual({ kind: 'inventory' });
    expect(players(sold.state).some(unit => unit.id === lux.id)).toBe(false);
    expect(sold.state.m8.loot.receipts).toEqual(opening.m8.loot.receipts);
    const restored = roundTrip(sold.state);
    expect(api.nextRound(restored, restored.round)).toEqual(api.nextRound(sold.state, sold.state.round));
  });
  it('rejects tampering with the cross-round consumption chain', () => {
    if (!sold.ok) throw new Error(sold.reason);
    const after = sold.state;
    // Deleting the combine fact leaves the ordered placement of the combined item without an owned item, which is checked first.
    reject(after, 'Invalid resource provenance: equipment ownership/slot', raw => {
      const index = raw.resourceProvenance.entries.findIndex((entry: any) => entry.kind === 'item-combined');
      raw.resourceProvenance.entries.splice(index, 1);
      raw.resourceProvenance.entries.forEach((entry: any, sequence: number) => { entry.sequence = sequence; });
    });
    reject(after, 'Invalid resource provenance: receipt birth binding', raw => { raw.m8.loot.receipts.find((r: any) => r.payload.definitionId === 'bow').grantedItemIds = [rageblade.id]; });
    reject(after, 'Invalid resource provenance: duplicate loot receipt', raw => { raw.m8.loot.receipts.push({ ...raw.m8.loot.receipts.at(-1) }); });
    // A consumed loot component cannot reappear in inventory.
    reject(after, 'Invalid B8 Match: current resource fold', raw => { raw.items.push({ id: bow.grantedItemIds[0], definitionId: 'bow', location: { kind: 'inventory' } }); });
  });
});
