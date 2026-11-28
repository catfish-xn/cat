import { DEFAULT_BOARD } from './board';

/**
 * The most survivors (countsG23SurvivorDamage units) one side of a battle can end with, derived from the board rule
 * rather than from a level: every live counted unit holds its own hex (spawnCombatUnit refuses an occupied cell and
 * occupiesCell covers every live non-proxy unit). A side's population is level + crown team size, and crowns have no
 * fixed maximum; combat may also spawn counted copies, so neither a level nor a population figure bounds survivors.
 * A settlement receipt only sees its own seat, so this board ceiling is the bound it can prove.
 */
export const MAX_SIDE_SURVIVORS = DEFAULT_BOARD.columns * DEFAULT_BOARD.rows;
