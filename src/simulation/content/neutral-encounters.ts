import type { HexCell } from '../board';
import { freezeContent } from './freeze';

/** Catalog policy labels only; these do not change the active content/rules version. */
export const NEUTRAL_ENCOUNTER_CATALOG_VERSION = 'm8b-encounters-project-v1';
export const NEUTRAL_ENCOUNTER_POLICY_VERSION = 'm8b-pve-project-v1';
export interface NeutralDeployment {
  readonly slotId: string;
  readonly definitionId: string;
  readonly cell: HexCell;
}
export interface NeutralEncounterDefinition {
  readonly roundId: string;
  readonly encounterId: string;
  readonly slots: readonly NeutralDeployment[];
}
const slot = (slotId: string, definitionId: string, col: number, row: number): NeutralDeployment =>
  ({ slotId, definitionId, cell: { col, row } });

/** M8B_ENCOUNTERS §2: fixed 8 encounters / 25 units. Selection consumes no RNG. */
export const NEUTRAL_ENCOUNTERS: readonly NeutralEncounterDefinition[] = freezeContent([
  { roundId: '1-2', encounterId: 'minions-a-v1', slots: [
    slot('m01', 'pve-minion-melee-a', 2, 3), slot('m02', 'pve-minion-melee-a', 4, 3),
  ] },
  { roundId: '1-3', encounterId: 'minions-b-v1', slots: [
    slot('m01', 'pve-minion-melee-b', 2, 3), slot('m02', 'pve-minion-melee-b', 4, 3), slot('r01', 'pve-minion-ranged-b', 3, 1),
  ] },
  { roundId: '1-4', encounterId: 'minions-c-v1', slots: [
    slot('m01', 'pve-minion-melee-c', 2, 3), slot('m02', 'pve-minion-melee-c', 4, 3),
    slot('r01', 'pve-minion-ranged-c', 2, 1), slot('r02', 'pve-minion-ranged-c', 4, 1),
  ] },
  { roundId: '2-7', encounterId: 'krugs-v1', slots: [
    slot('k01', 'pve-krug', 1, 3), slot('k02', 'pve-krug', 3, 3), slot('k03', 'pve-krug', 5, 3),
  ] },
  { roundId: '3-7', encounterId: 'wolves-v1', slots: [
    slot('w00', 'pve-wolf-large', 3, 2), slot('w01', 'pve-wolf-small', 1, 3), slot('w02', 'pve-wolf-small', 2, 3),
    slot('w03', 'pve-wolf-small', 4, 3), slot('w04', 'pve-wolf-small', 5, 3),
  ] },
  { roundId: '4-7', encounterId: 'razorbeaks-v1', slots: [
    slot('r00', 'pve-razorbeak-large', 3, 2), slot('r01', 'pve-razorbeak-small', 0, 3), slot('r02', 'pve-razorbeak-small', 1, 3),
    slot('r03', 'pve-razorbeak-small', 2, 3), slot('r04', 'pve-razorbeak-small', 4, 3), slot('r05', 'pve-razorbeak-small', 5, 3),
  ] },
  { roundId: '5-7', encounterId: 'elder-dragon-v1', slots: [slot('d01', 'pve-elder-dragon', 3, 2)] },
  { roundId: '6-7', encounterId: 'rift-herald-v1', slots: [slot('h01', 'pve-rift-herald', 3, 1)] },
]);
