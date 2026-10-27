import { createMatch, buyUnit, deployMatchUnit, nextRound, selectChoice, rerollAugment, startMatchCombat, combineItems } from '../../src/simulation/match';
import { finishPublicEquipmentBattle, benchPublicEquipmentPlayers, resolvePublicEquipmentChoices } from './b8-public-equipment';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { S13_P2_SOURCE } from '../../src/simulation/content/s13-augments-p2-source';
import { P2_ITEM_GRANTS } from '../../src/simulation/content/s13-augments-p2';
import { TEAMUP_IDS } from '../../src/simulation/content/v20-traits';
import { AUGMENT_BATCH3 } from '../../src/simulation/content/augment-pool-batch3';
import { AUGMENT_BATCH3_XP } from '../../src/simulation/content/augment-pool-batch3-xp';
import { AUGMENT_BATCH4 } from '../../src/simulation/content/augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP } from '../../src/simulation/content/augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL } from '../../src/simulation/content/augment-pool-batch4-b4reroll';
import { AUGMENT_BATCH4_B4COMBAT } from '../../src/simulation/content/augment-pool-batch4-b4combat';
import { AUGMENT_SHOP } from '../../src/simulation/content/augment-pool-shop';

const accepted = (result: MatchCommandResult): MatchState => {
  if (!result.ok) throw Error(`Public TG supply route: ${result.reason}`);
  return result.state;
};
const cached = new Map<string, MatchState>();
// Keep TG-only routes free of replay-history cards and unintended gifts/XP.
// Seed 42 keeps one unequipped Watcher emblem and combat-only later choices; opening HP/armor and item births stay fixed.
const extraItemChoices = new Set(['high-voltage','pyromaniac','thorn-plated-armor','unleash-the-beast','portable-forge','radiant-relics','blinding-speed',
  // v22 tiers offer team-ups (two partner units) and Investment Strategy (max-HP growth) on this route;
  // both would change the bench and the independent holder stats, so keep them out as well.
  ...TEAMUP_IDS,'investment-strategy-i','investment-strategy-ii',
  // v23 batch 3 / batch-3 XP cards remove or grant champions (Golemify, dummies), grant items or XP, or add replayed
  // combat mechanics; keep the TG-only route free of them too.
  ...Object.keys(AUGMENT_BATCH3),...Object.keys(AUGMENT_BATCH3_XP),
  ...Object.keys(AUGMENT_BATCH4),...Object.keys(AUGMENT_BATCH4_B4XP),...Object.keys(AUGMENT_BATCH4_B4REROLL),
  ...Object.keys(AUGMENT_BATCH4_B4COMBAT),...Object.keys(AUGMENT_SHOP)]);
/** T13's five supply choices remain guaranteed. Concede with an empty board to
 * obtain two gloves at 2-4/3-4 without depending on random PvE content. The level-9
 * control fights the opening to retain enough HP for 4-2. All battles, income,
 * choices and the extra holder are committed by public commands. */
export function publicGlovesInventory(roundId = '3-5', seed = 42): MatchState {
  const key = JSON.stringify([seed, roundId]);
  if (cached.has(key)) return structuredClone(cached.get(key)!);
  let state = resolvePublicEquipmentChoices(createMatch(seed));
  // v22 anvils are bench units, so bench the opening unit in the first free slot.
  const freeSlot = (s: MatchState) => Array.from({ length: s.preparation.benchSize }, (_, i) => i)
    .find(i => !s.preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === i))!;
  if (roundId !== '4-2') state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'bench', slot: freeSlot(state) }));
  for (let budget = 0; budget < 40; budget++) {
    while (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      if (choice.kind === 'anomaly') throw Error('TG fixture must finish before the anomaly');
      if (seed === 42 && state.roundDefinitionId === '2-1' && choice.generation === 0) {
        if (!choice.offers.includes('watcher-crest')) throw Error('TG seed42 must offer Watcher Crest');
        // Preserve the emblem while advancing the choice stream to a later
        // combat-only card. All resource births still use public commands.
        state = accepted(rerollAugment(state, choice.choiceId, choice.generation, 0));
        continue;
      }
      const id = choice.kind === 'component' ? 'gloves'
        : (seed===42?['watcher-crest','dominator-crest','manaflow-i','manaflow-ii','glass-cannon-ii','clockwork-accelerator','inspiring-epitaph','mentorship-ii','backup','trade-sector','superstars-ii','raining-gold','raining-gold-plus','heroic-grab-bag','team-building','rolling-for-days-i',
          // Later choices may change attack speed/damage (as Clockwork did),
          // while preserving the independent opening HP/armor and item births.
          ...(state.roundDefinitionId==='2-1'?[]:['pumping-up-i','pumping-up-ii','pumping-up-iii','bronze-for-life-i','bronze-for-life-ii','lone-hero','blistering-strikes','piercing-lotus-i']),...(state.roundDefinitionId==='4-2'?['noble-sacrifice']:[])]:['manaflow-i', 'pumping-up-i', 'backup', 'bulky-buddies-i', 'prismatic-ticket']).find(id => choice.offers.includes(id))
          ?? (seed===42?undefined:choice.offers.find(id => !(id in S13_P2_SOURCE) && !extraItemChoices.has(id)))
          ?? (seed===42?undefined:choice.offers.find(id => !(id in P2_ITEM_GRANTS) && !extraItemChoices.has(id)));
      if (!id && !choice.rerolledSlots?.some(used=>!used)) throw Error(`No inert TG augment at ${state.roundDefinitionId}, seed ${seed}: ${choice.offers.join(',')}`);
      if (!id) { state = accepted(rerollAugment(state, choice.choiceId, choice.generation,
        choice.rerolledSlots?.findIndex(used => !used))); continue; }
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
