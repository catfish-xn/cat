import { deployMatchUnit, equipItem, sellUnit, startMatchCombat, type MatchCommandResult, type MatchState } from '../../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../../src/simulation/seat-mechanics';
import { publicEquipmentPreparation } from './b8-public-equipment';
const BRACER = 'TFT_Item_Artifact_SeekersArmguard';
const CHEST = 'TFT_Item_UnstableTreasureChest';
const accepted = (result: MatchCommandResult): MatchState => {
  if (!result.ok) throw new Error(`Chest/bracer integration: ${result.reason}`);
  return result.state;
};

/** Real acquisition route followed by production mechanic-grant commands (source
 * "test"), equip/deploy/start/step. The special items are NOT claimed to be
 * naturally rolled by the acquisition route. No combat facts, stats or RNG edits. */
export function startFight(seed: number): { state: MatchState; receiverId: string; chestHolderId: string } {
  // The PR9 recorder searches independently offered Manaflow I seeds because
  // seed554 now forces Prismatic Prelude. No combat stats or outcomes are patched.
  let state = publicEquipmentPreparation(['rod'], { seed, augmentPriorities:['manaflow-i'], earliestRound:8, rerollForAugment:true });
  const chestHolderId = state.preparation.units.find(u => u.team === 'player' && u.definitionId !== 'lux')!.id;
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.definitionId !== 'lux' && u.id !== chestHolderId))
    state = accepted(sellUnit(state, unit.id));
  if (!state.preparation.units.some(u => u.team === 'player' && u.definitionId === 'lux'))
    state = accepted(grantMechanicUnit(state, { receiptId: 'joint-lux-base', source: 'test', definitionId: 'lux' }));
  for (let i = 0; i < 2; i++)
    state = accepted(grantMechanicUnit(state, { receiptId: `joint-lux-${i}`, source: 'test', definitionId: 'lux' }));
  const receiver = state.preparation.units.find(u => u.team === 'player' && u.definitionId === 'lux')!;
  if(receiver.starLevel!==2)throw Error('Expected a genuine two-star receiver');
  for (const [unitId, definitionId] of [[receiver.id, BRACER], [chestHolderId, CHEST]]) {
    state = accepted(grantMechanicItem(state, { receiptId: `joint-${definitionId}`, source: 'test', definitionId }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, unitId, 0));
  }
  state = accepted(deployMatchUnit(state, chestHolderId, { kind: 'board', cell: { col: 3, row: 4 } }));
  state = accepted(deployMatchUnit(state, receiver.id, { kind: 'board', cell: { col: 6, row: 7 } }));
  return { state: accepted(startMatchCombat(state)), receiverId: receiver.id, chestHolderId };
}

