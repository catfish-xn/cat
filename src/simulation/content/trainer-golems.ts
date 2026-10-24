import { freezeContent } from './freeze';
import { TRAINER_EMBLEMS, TRAINER_UNIT, TRAINER_HEALTH, TRAINER_ATTACK_CENTI } from './opening-batch-b';
export const TRAINER_GOLEMS_POLICY = freezeContent({
 version:'trainer-golems-approved-20261023',encounterId:'trainer-golems',enabled:true,golemsPerSeat:1,emblemsPerGolem:3,
 permanentEmblems:true,grantRound:'1-2',samplingScope:'seat',distinctEmblems:true,emblemPool:TRAINER_EMBLEMS,
 unitDefinitionId:TRAINER_UNIT.id,statsAndGrowth:{unit:TRAINER_UNIT,health:TRAINER_HEALTH,attackCenti:TRAINER_ATTACK_CENTI},
 countsTowardPopulation:false,placementAndMovement:'front-center-first-empty/board-only',missingEvidence:[],
 emblemStream:'opening-encounter-v1/seat/<seatId>/trainer-golems/emblems',effectKey:'trainer-golems',
 receiptPolicy:'one-per-seat/permanent-items/restore-authenticated',
} as const);
