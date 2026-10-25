import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import type { GameState } from '../src/simulation/game';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { boardTraitRows } from '../src/rendering/trait-column';
import { publicTraitRows, publicTraits } from '../src/rendering/online/opponent-board';

// Playtest 10-25: 魔像训练师's golem carries three emblems; the trait column must count them as the rules do.
const emblems = ['TFT13_Item_CrimeEmblemItem', 'TFT13_Item_WatcherEmblemItem', 'TFT13_Item_ChallengerEmblemItem'];
const board = createMatch(7).preparation.board;
const preparation: GameState = { board, benchSize: 9, units: [
  { id: 'golem', definitionId: 'trainer-golem', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } },
] };
const items: ItemInstance[] = emblems.map((definitionId, slot) => ({ id: `i${slot}`, definitionId, location: { kind: 'unit', unitId: 'golem', slot } }));

it('counts emblems held by board units in my trait column', () => {
  expect(boardTraitRows(preparation)).toEqual([]);
  expect(boardTraitRows(preparation, items).map(row => [row.traitId, row.count]).sort()).toEqual([['chem-baron', 1], ['quickstriker', 1], ['watcher', 1]]);
  const benched: ItemInstance[] = items.map(item => ({ ...item, location: { kind: 'inventory' } }));
  expect(boardTraitRows(preparation, benched)).toEqual([]);
});

it('counts emblems on a scouted public board', () => {
  const pub = { units: [{ definitionId: 'trainer-golem', starLevel: 1, cell: { col: 3, row: 4 }, items: emblems }] };
  expect(publicTraitRows(pub, board).map(row => row.traitId).sort()).toEqual(['chem-baron', 'quickstriker', 'watcher']);
  expect(publicTraits(pub, board).every(trait => trait.count === 1)).toBe(true);
});
