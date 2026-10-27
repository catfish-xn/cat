import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { toSeatPrivateView, toPlayerView } from '../src/server/room/projection';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { drawMutationCell, isMutationCell, mutationCellForBoard, MUTATION_CELL_COLOR } from '../src/rendering/online/mutation-cell';
import { DamageResolver, makeRoom } from './server/helpers';

describe('物竞天择 owner-only cell', () => {
  it('projects the coordinate only to its holder, never in public or another private view', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const seats = room.state.seats.map((seat, index) => index === 0 ? { ...seat, match: { ...seat.match,
      augments: [{ definitionId: 'natural-selection', choiceId: 'test', acquiredRound: 12 }] } } : seat);
    const state = { ...room.state, seats };
    const own = toSeatPrivateView(seats[0]!.match), other = toSeatPrivateView(seats[1]!.match);
    expect(own.mutationSacrificeCell).toEqual({ col: 3, row: 6 });
    expect(other).not.toHaveProperty('mutationSacrificeCell');
    expect(JSON.stringify(toPlayerView(state, 's1', clock.now()))).not.toContain('mutationSacrificeCell');
    expect(JSON.stringify(toPlayerView(state, 's0', clock.now()))).not.toContain('mutationSacrificeCell');
    expect(JSON.parse(JSON.stringify(own)).mutationSacrificeCell).toEqual({ col: 3, row: 6 });
  });

  it('feeds the projected cell to the board highlight and clears it for hidden or absent views', () => {
    const match = createMatch(42);
    const holder = { ...match, augments: [{ definitionId: 'natural-selection', choiceId: 'test', acquiredRound: 12 }] };
    const view = toDisplayMatch(toSeatPrivateView(holder));
    const cell = mutationCellForBoard(view, true);
    expect(cell).toEqual({ col: 3, row: 6 });
    expect(cell).not.toBe(view.mutationSacrificeCell);
    expect(MUTATION_CELL_COLOR).not.toBe('#e6bc76');
    const painted: unknown[] = [];
    const paint = (target: unknown, color: string) => painted.push({ target, color });
    drawMutationCell(cell, view.preparation.board, paint);
    expect(painted).toEqual([{ target: { col: 3, row: 6 }, color: MUTATION_CELL_COLOR }]);
    drawMutationCell(null, view.preparation.board, paint);
    drawMutationCell({ col: 99, row: 6 }, view.preparation.board, paint);
    expect(painted).toHaveLength(1);
    expect(isMutationCell({ col: 3, row: 6 }, cell, true)).toBe(true);
    expect(isMutationCell({ col: 2, row: 6 }, cell, true)).toBe(false);
    expect(isMutationCell({ col: 3, row: 6 }, cell, false)).toBe(false);
    expect(mutationCellForBoard(view, false)).toBeNull();
    expect(mutationCellForBoard(toDisplayMatch(toSeatPrivateView(match)), true)).toBeNull();
    // Rendering uses the supplied coordinate, even when it differs from the usual one.
    expect(mutationCellForBoard({ mutationSacrificeCell: { col: 1, row: 4 } }, true)).toEqual({ col: 1, row: 4 });
  });
});
