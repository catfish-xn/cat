import { freezeContent } from './freeze';

/** Research encounters[9], D01–D03; approved plan §§4,6,9 (2026-10-22).
 * Executable emblem definitions are NOT evidence of the complete encounter pool.
 * Other summons' stats, population and placement must never supply these nulls.
 * This is a disabled admission contract, not a UnitDefinition or grant record.
 */
export const TRAINER_GOLEMS_POLICY = freezeContent({
  version: 'trainer-golems-blocked-v1',
  encounterId: 'trainer-golems',
  enabled: false,
  golemsPerSeat: 1,
  emblemsPerGolem: 3,
  permanentEmblems: true,
  // Approved project conventions, not verified historical sampling/timing.
  grantRound: '1-2',
  samplingScope: 'seat',
  distinctEmblems: true,
  emblemPool: null,
  unitDefinitionId: null,
  statsAndGrowth: null,
  countsTowardPopulation: null,
  placementAndMovement: null,
  missingEvidence: ['emblem_sampling_pool', 'golem_stats_and_growth', 'population_rules', 'placement_and_movement'],
  // Reserved only: no RNG is initialized or advanced while disabled.
  emblemStream: 'opening-encounter-v1/seat/<seatId>/trainer-golems/emblems',
  effectKey: 'trainer-golems',
  receiptPolicy: 'no-grant/no-fact/no-receipt-until-enabled-and-authenticated',
} as const);
