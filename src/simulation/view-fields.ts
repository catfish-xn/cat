import type { Board, HexCell } from './board';
/** Only use for explicitly listed scalar fields; nested objects need their own whitelist. */
export function pick<T, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as Pick<T, K>;
}
export const cellView = (cell: HexCell): HexCell => ({ col: cell.col, row: cell.row });
export const boardView = (board: Board): Board => ({ columns: board.columns, rows: board.rows,
  deploymentZones: { player: pick(board.deploymentZones.player, ['firstRow', 'lastRow']),
    enemy: pick(board.deploymentZones.enemy, ['firstRow', 'lastRow']) } });
