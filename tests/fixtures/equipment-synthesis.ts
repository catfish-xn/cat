import type { SaveEnvelope } from '../../src/m6/contracts';
import { validateEnvelope } from '../../src/persistence/format';
import { BattleHistory, validateBattleCollection } from '../../src/replay/history';
import { deployMatchUnit } from '../../src/simulation/match';
import { publicEquipmentPreparation } from './b8-public-equipment';

/** Independent public reward route; no BR4 policy, raw state injection or item grants. */
export async function equipmentSynthesisFixture() {
  const runId = 'native-component-synthesis', history = new BattleHistory(runId);
  let match = publicEquipmentPreparation(['vest', 'belt'], { seed: 42, history });
  const holder = match.preparation.units.find(unit => unit.team === 'player');
  if (!holder) throw new Error('Synthesis fixture has no player unit');
  const deployed = deployMatchUnit(match, holder.id, { kind: 'board', cell: { col: 1, row: 4 } });
  if (!deployed.ok) throw new Error(`Synthesis fixture deployment: ${deployed.reason}`);
  match = deployed.state;
  const componentIds = ['vest', 'belt'].map(definitionId => {
    const item = match.items.find(item => item.definitionId === definitionId && item.location.kind === 'inventory');
    if (!item) throw new Error(`Synthesis fixture did not acquire ${definitionId}`);
    return item.id;
  });
  const envelope: SaveEnvelope = {
    kind: 'hex-autobattler-save', saveFormatVersion: 3, replayFormatVersion: 3,
    runId, createdAt: '2026-10-20T00:00:00.000Z', match,
    battles: history.completedRecords, currentBattle: null,
  };
  // Exercise the same JSON/import validation boundary used by the browser harness.
  await validateEnvelope(JSON.parse(JSON.stringify(envelope)), validateBattleCollection);
  return { envelope, holderId: holder.id, componentIds };
}
