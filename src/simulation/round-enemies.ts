import type { Unit, StarLevel } from './unit-types';
import { freezeContent } from './content/freeze';
type Entry = readonly [string, StarLevel];
export const ENEMY_TEMPLATES: readonly (readonly Entry[])[] = freezeContent([
  [['sentinel',1],['ranger',1]],
  [['sentinel',1],['bulwark',1],['ranger',1]],
  [['sentinel',2],['bulwark',1],['archer',1],['arcanist',1]],
  [['sentinel',2],['bulwark',2],['ranger',2],['arcanist',2],['warden',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['warden',2],['oracle',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['tempest',2],['colossus',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['warden',2],['colossus',2]],
]);
export const ENEMY_POSITIONS = freezeContent([[2,1],[4,2],[0,1],[6,1],[2,0],[4,0]] as const);
export const ENEMY_GROWTH = freezeContent({ fromRound: 10, bpsPerRound: 1000, maxBps: 20000 });
export function getEnemyGrowthBps(round: number): number {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Round must be a positive integer');
  return Math.min(Math.max(0, round - ENEMY_GROWTH.fromRound + 1), ENEMY_GROWTH.maxBps / ENEMY_GROWTH.bpsPerRound) * ENEMY_GROWTH.bpsPerRound;
}
export function createRoundEnemies(round: number): readonly Unit[] {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Round must be a positive integer');
  const index = round <= 2 ? 0 : round <= 4 ? 1 : round <= 6 ? 2 : round <= 9 ? 3 : 4 + (round - 10) % 3;
  return ENEMY_TEMPLATES[index].map(([definitionId,starLevel], slot) => ({
    id: round === 1 ? `enemy-${slot+1}` : `enemy-r${round}-${slot+1}`, definitionId, starLevel, team: 'enemy',
    location: { kind: 'board', cell: { col: ENEMY_POSITIONS[slot][0], row: ENEMY_POSITIONS[slot][1] } },
  }));
}
