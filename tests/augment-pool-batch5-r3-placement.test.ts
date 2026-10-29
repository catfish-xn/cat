import { expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { cloningFacilityPlacement } from '../src/simulation/augment-pool-batch5-r3';
import type { GameState } from '../src/simulation/game';
import type { Unit } from '../src/simulation/unit-types';
import { existsSync, readFileSync } from 'node:fs';
import { AUGMENT_BATCH5_R3 } from '../src/simulation/content/augment-pool-batch5-r3';

const unit = (id: string, col: number, row: number): Unit => ({
  id, definitionId: 'vander', starLevel: 2, team: 'player', location: { kind: 'board', cell: { col, row } },
});
const board = (units: Unit[]): GameState => ({ board: DEFAULT_BOARD, benchSize: 9, units });

const research = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(research))('preserves the independently archived Cloning Facility numbers', () => {
  const archive = JSON.parse(readFileSync(research, 'utf8'));
  const row = archive.find((entry: { apiName: string }) => entry.apiName === 'TFT_Augment_CloningFacility');
  expect(row.effects).toEqual(AUGMENT_BATCH5_R3['cloning-facility'].source.values);
  expect(row.tier).toBe(2);
});

it('uses the fourth column of the second row from the player back edge', () => {
  const owner = unit('owner', 3, 6);
  expect(cloningFacilityPlacement(board([owner]))).toEqual({ owner, cell: { col: 2, row: 5 } });
  expect(cloningFacilityPlacement(board([unit('wrong', 3, 5)]))).toBeNull();
});

it('selects the nearest vacant deployment cell deterministically and does nothing on a full board', () => {
  const owner = unit('owner', 3, 6);
  const blocked = [unit('a', 3, 5), unit('b', 4, 5), unit('c', 2, 6), unit('d', 4, 6), unit('e', 3, 7), unit('f', 4, 7), unit('g', 2, 5)];
  const result = cloningFacilityPlacement(board([owner, ...blocked]));
  expect(result?.cell).toEqual({ col: 2, row: 7 });
  const full = Array.from({ length: 28 }, (_, n) => unit(`u${n}`, n % 7, 4 + Math.floor(n / 7)));
  expect(cloningFacilityPlacement(board(full))).toBeNull();
});
