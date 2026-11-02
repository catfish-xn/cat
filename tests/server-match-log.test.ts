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

  it('logs the copies left in the shared pool once per preparation round', () => {
    const records: [string, Record<string, unknown>][] = [];
    const observe = createMatchLogObserver((_level, event, fields = {}) => records.push([event, { ...fields }]));
    const withPool = (round: number, phase: string, vander: number) => ({ ...room({ ...base, round }), round, phase, pool: { available: { vander, jinx: 9 } } }) as unknown as RoomState;
    observe(withPool(3, 'preparation', 20));
    observe(withPool(3, 'preparation', 19));
    observe(withPool(3, 'battle', 19));
    observe(withPool(4, 'preparation', 18));
    const pools = records.filter(([event]) => event === 'pool.left').map(([, fields]) => fields);
    expect(pools).toEqual([{ roomId: 'r1', round: 3, available: 'vander:20,jinx:9' }, { roomId: 'r1', round: 4, available: 'vander:18,jinx:9' }]);
  });
});
