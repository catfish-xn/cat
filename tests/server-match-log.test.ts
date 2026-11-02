import { describe, expect, it } from 'vitest';
import { createMatchLogObserver } from '../src/server/room/match-log';
import type { RoomState } from '../src/server/room/types';

const seat = (match: object) => ({ seatId: 's1', kind: 'human', match }) as never;
const room = (match: object, roomId = 'r1') => ({ roomId, seats: [seat(match)] }) as unknown as RoomState;
const base = { round: 3, level: 5, gold: 20, augments: [] as object[],
  shop: { generation: 2, slots: [{ status: 'available', definitionId: 'vander' }, { status: 'purchased' }, { status: 'available', definitionId: 'jinx', starLevel: 2 }] },
  shopHistory: { entries: [{ kind: 'draw', cause: 'reroll', shop: { generation: 2 } }] } };

describe('server match log', () => {
  it('logs each augment taken and each shop dealt once, with the draw cause when the history has it', () => {
    const records: [string, string, Record<string, unknown>][] = [];
    const observe = createMatchLogObserver((level, event, fields = {}) => records.push([level, event, { ...fields }]));
    observe(room(base));
    observe(room(base));
    observe(room({ ...base, augments: [{ definitionId: 'all-out', choiceId: 'c1', acquiredRound: 3 }] }));
    observe(room({ ...base, augments: [{ definitionId: 'all-out', choiceId: 'c1', acquiredRound: 3 }], shop: { ...base.shop, generation: 3 } }));
    expect(records.map(([, event]) => event)).toEqual(['shop.dealt', 'augment.chosen', 'shop.dealt']);
    expect(records[0][2]).toMatchObject({ roomId: 'r1', seatId: 's1', seatKind: 'human', round: 3, level: 5, generation: 2, cause: 'reroll', units: 'vander,-,jinx*2' });
    expect(records[1][2]).toMatchObject({ augment: 'all-out', choiceId: 'c1', acquiredRound: 3 });
    expect(records[2][2].cause).toBeUndefined();
    observe(room(base, 'r2'));
    expect(records.at(-1)![2]).toMatchObject({ roomId: 'r2', generation: 2 });
  });
});
