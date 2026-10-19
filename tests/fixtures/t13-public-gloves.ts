import { createMatch, buyUnit, deployMatchUnit, nextRound, selectChoice, rerollAugment, startMatchCombat, combineItems } from '../../src/simulation/match';
import { finishPublicEquipmentBattle, benchPublicEquipmentPlayers } from './b8-public-equipment';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { S13_P2_SOURCE } from '../../src/simulation/content/s13-augments-p2-source';
import { P2_ITEM_GRANTS } from '../../src/simulation/content/s13-augments-p2';

const accepted = (result: MatchCommandResult): MatchState => {
  if (!result.ok) throw Error(`Public TG supply route: ${result.reason}`);
  return result.state;
};
const cached = new Map<string, MatchState>();
// Keep this TG-only route free of earlier item births, including P1/P3 gifts.
const extraItemChoices = new Set(['high-voltage','pyromaniac','thorn-plated-armor','unleash-the-beast','portable-forge','radiant-relics','blinding-speed']);
/** T13's five supply choices remain guaranteed. Concede with an empty board to
 * obtain two gloves at 2-4/3-4 without depending on random PvE content. The level-9
 * control fights the opening to retain enough HP for 4-2. All battles, income,
 * choices and the extra holder are committed by public commands. */
export function publicGlovesInventory(roundId = '3-5', seed = 42): MatchState {
  const key = JSON.stringify([seed, roundId]);
  if (cached.has(key)) return structuredClone(cached.get(key)!);
  let state = createMatch(seed);
  if (roundId !== '4-2') state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'bench', slot: 0 }));
  for (let budget = 0; budget < 40; budget++) {
    while (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      if (choice.kind === 'anomaly') throw Error('TG fixture must finish before the anomaly');
      const id = choice.kind === 'component' ? 'gloves'
        : ['manaflow-i', 'pumping-up-i', 'backup', 'bulky-buddies-i'].find(id => choice.offers.includes(id))
          ?? choice.offers.find(id => !(id in S13_P2_SOURCE) && !extraItemChoices.has(id))
          ?? choice.offers.find(id => !(id in P2_ITEM_GRANTS) && !extraItemChoices.has(id));
      if (!id) { state = accepted(rerollAugment(state, choice.choiceId, choice.generation)); continue; }
      state = accepted(selectChoice(state, choice.choiceId, choice.generation, id));
    }
    if (state.roundDefinitionId === '2-1') {
      state = benchPublicEquipmentPlayers(state);
      if (!state.preparation.units.some(unit => unit.id === 'unit-2')) {
        const slot = state.shop.slots.findIndex(offer => offer.status === 'available');
        state = accepted(buyUnit(state, slot, state.shop.generation));
      }
    }
    if (state.roundDefinitionId === roundId && state.phase === 'preparation') {
      const gloves = state.items.filter(item => item.definitionId === 'gloves');
      if (gloves.length < 2) throw Error('TG supply route has not acquired two gloves');
      state = accepted(combineItems(state, gloves[0].id, gloves[1].id));
      cached.set(key, structuredClone(state));
      return state;
    }
    if (state.phase === 'preparation') {
      if (roundId === '4-2' && state.round <= 3) {
        for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench')) {
          const col = unit.id === 'unit-2' ? 3 : 5;
          state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col, row: 7 } }));
        }
        state = finishPublicEquipmentBattle(state);
      } else state = accepted(startMatchCombat(state));
    }
    if (state.phase !== 'settlement') throw Error(`TG route ended at ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
  }
  throw Error(`TG route cannot reach ${roundId}`);
}
