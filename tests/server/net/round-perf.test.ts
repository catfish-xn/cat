import { describe, expect, it } from 'vitest';
import { RoundPerf } from '../../../src/server/net/round-perf';
import type { LogRecord } from '../../../src/server/log';

function setup() {
  let time = 0;
  const logs: LogRecord[] = [];
  const perf = new RoundPerf(() => time, (level, event, fields) => logs.push({ level, event, ...fields }));
  const round = { roomId: 'r', round: 25, roundName: '5-1' };
  perf.enter(round);
  return { perf, logs, round, advance: (ms: number) => { time += ms; } };
}
describe('bounded per-round work logging', () => {
  it('logs only thresholds and resets time and traffic at the next round', () => {
    const { perf, logs, round } = setup();
    perf.add('combat', 99); perf.add('projection', 24); perf.add('broadcast', 24); perf.add('room', 49);
    perf.enter({ ...round, round: 26, roundName: '5-2' }); expect(logs).toHaveLength(0);
    perf.add('combat', 60); perf.add('combat', 40); perf.add('room', 55);
    perf.sent(1024); perf.sent(12); perf.flush(); perf.flush();
    expect(logs).toEqual([{ level: 'warn', event: 'round.perf', roomId: 'r', round: 26, roundName: '5-2',
      combatMs: 100, combatMaxMs: 60, projectionMs: 0, projectionMaxMs: 0, broadcastMs: 0, broadcastMaxMs: 0,
      roomWorkMs: 55, taskMaxMs: 55, bytes: 1036, messages: 2 }]);
  });
  it.each(['projection', 'broadcast', 'room'] as const)('reports %s independently of combat', part => {
    const { perf, logs } = setup();
    perf.add(part, part === 'room' ? 50 : 25); perf.flush(); expect(logs).toHaveLength(1);
  });
  it('measures failures too, excludes phase waiting, and stores only context identifiers', () => {
    const { perf, logs, round, advance } = setup();
    advance(40_000);
    expect(() => perf.measure('projection', () => { advance(30); throw new Error('test'); })).toThrow('test');
    round.roundName = 'mutated'; // caller state must not be retained
    perf.flush(); expect(logs[0]).toMatchObject({ roundName: '5-1', projectionMs: 30, projectionMaxMs: 30, combatMs: 0 });
  });
});
