/**
 * A definition's shop cost for the 3D layer's star sizes (model-fit.ts useUnitCost): the one lookup every host that mounts
 * the 3D renderer injects, the game's three-loader.ts and the dev recording pages alike, so they draw the same sizes.
 * Lives outside the 3D chunk: it reads the unit data, which the chunk must not import.
 */
import { UNIT_DEFINITIONS } from '../../simulation/units';

/** The shop cost of `definitionId`, 1 for one the unit data does not hold (a summon's or a monster's stand-in id). */
export const unitCostOf = (definitionId: string): number => UNIT_DEFINITIONS[definitionId]?.cost ?? 1;
