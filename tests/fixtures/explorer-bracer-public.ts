import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import { sellUnit, deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../../src/simulation/seat-mechanics';
import { publicEquipmentPreparation } from './b8-public-equipment';

export const BRACER = 'TFT_Item_Artifact_SeekersArmguard';
const accepted = (r: MatchCommandResult): MatchState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** Public commands only: no battle facts or stats are edited. */
export function startBracerFight(twoHolders = false): MatchState {
  // v19: publicly reroll the shifted gold offer to recover Glass Cannon II;
  // this back-row-only augment keeps the row-4 Lux numeric control unchanged.
  let state = publicEquipmentPreparation(['rod'], { seed: 3151248, augmentPriorities:['glass-cannon-ii'],rerollForAugment:true });
  for(const u of state.preparation.units.filter(u=>u.team==='player'&&!['irelia','lux'].includes(u.definitionId)&&isSellableUnit(u.definitionId)))state=accepted(sellUnit(state,u.id));
  if(!state.preparation.units.some(u=>u.team==='player'&&u.definitionId==='lux'))state=accepted(grantMechanicUnit(state,{receiptId:'fixture:base-lux',source:'test',definitionId:'lux'}));
  for (const definitionId of twoHolders ? ['lux', 'irelia'] : ['lux'])
    for (let i = 0; i < 8; i++) state = accepted(grantMechanicUnit(state, { receiptId: `${definitionId}-${i}`, source: 'test', definitionId }));
  for (const [i, definitionId] of (twoHolders ? ['lux', 'irelia'] : ['lux']).entries()) {
    state = accepted(grantMechanicItem(state, { receiptId: `bracer-${i}`, source: 'test', definitionId: BRACER }));
    const unit = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
    state = accepted(equipItem(state, state.items.at(-1)!.id, unit.id, 0));
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: i === 0 ? { col: 1, row: 4 } : { col: 6, row: 7 } }));
  }
  return accepted(startMatchCombat(state));
}
export function stackedBracerSave(twoHolders = false): MatchState {
  let state = startBracerFight(twoHolders);
  while (state.phase === 'combat') {
    const lux = state.combat!.units.find(u => u.definitionId === 'lux')!;
    const kill = lux.mechanismDefinitions!.eventTriggers!.find(t => t.source.definitionId === BRACER && t.id === 'kill')!;
    const kills = lux.triggerLedger?.runtimes.find(r => r.source.instanceId === kill.source.instanceId && r.source.effectIndex === kill.source.effectIndex)?.triggerCount ?? 0;
    if (twoHolders ? kills > 0 && lux.runtime!.nextAttackMagic === 0 : kills === 2 && lux.runtime!.nextAttackMagic === 1530) return state;
    state = stepMatch(state).state;
  }
  throw new Error('Public bracer fight did not reach the required stack checkpoint');
}
