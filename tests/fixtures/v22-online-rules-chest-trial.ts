import { deployMatchUnit, equipItem, sellUnit, startMatchCombat, type MatchCommandResult, type MatchState } from '../../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../../src/simulation/seat-mechanics';
import { publicEquipmentPreparation } from './b8-public-equipment';
import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import { isAnvil } from '../../src/simulation/content/anvils';
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
  // v22: anvils stay benched (selling opens them) and opening structures cannot be sold or hold the chest.
  const keepable = (u: MatchState['preparation']['units'][number]) => isSellableUnit(u.definitionId) && !isAnvil(u.definitionId);
  const chestHolderId = state.preparation.units.find(u => u.team === 'player' && u.definitionId !== 'lux' && keepable(u))!.id;
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.definitionId !== 'lux' && u.id !== chestHolderId && keepable(u)))
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
  // v22: an unbenchable opening structure (Trainer Golem) may already stand on (3,4); the
  // holder takes the nearest free front-row cell instead. Lux stands one row further forward
  // (6,6) than in v21 so the longer v22 combat still reaches her after two takedowns.
  const occupied = (col: number, row: number) => state.preparation.units.some(u => u.location.kind === 'board' && u.location.cell.col === col && u.location.cell.row === row);
  const holderCol = [3, 2, 4, 1, 5, 0, 6].find(col => !occupied(col, 4))!;
  state = accepted(deployMatchUnit(state, chestHolderId, { kind: 'board', cell: { col: holderCol, row: 4 } }));
  state = accepted(deployMatchUnit(state, receiver.id, { kind: 'board', cell: { col: 6, row: 6 } }));
  return { state: accepted(startMatchCombat(state)), receiverId: receiver.id, chestHolderId };
}

