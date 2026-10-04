import type { Unit, StarLevel } from './unit-types';
type Entry = readonly [string, StarLevel];
const templates: readonly (readonly Entry[])[] = [
  [['sentinel',1],['ranger',1]],
  [['sentinel',1],['bulwark',1],['ranger',1]],
  [['sentinel',2],['bulwark',1],['archer',1],['arcanist',1]],
  [['sentinel',2],['bulwark',2],['ranger',2],['arcanist',2],['warden',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['warden',2],['oracle',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['tempest',2],['colossus',2]],
  [['bulwark',2],['duelist',2],['archer',2],['arcanist',2],['warden',2],['colossus',2]],
];
const positions = [[2,1],[4,2],[0,1],[6,1],[2,0],[4,0]] as const;
export function createRoundEnemies(round: number): readonly Unit[] {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Round must be a positive integer');
  const index = round <= 2 ? 0 : round <= 4 ? 1 : round <= 6 ? 2 : round <= 9 ? 3 : 4 + (round - 10) % 3;
  return templates[index].map(([definitionId,starLevel], slot) => ({
    id: round === 1 ? `enemy-${slot+1}` : `enemy-r${round}-${slot+1}`, definitionId, starLevel, team: 'enemy',
    location: { kind: 'board', cell: { col: positions[slot][0], row: positions[slot][1] } },
  }));
}
