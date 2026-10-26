/** Measurement, no timing assertions. Run with esbuild --bundle --platform=node --format=esm --packages=external. */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { Room, ROOM_TIMING_DEFAULTS } from '../../../src/server/room/room';
import { ManualClock, type Clock } from '../../../src/server/room/clock';
import { BotDriver } from '../../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../../src/server/room/carousel';
import { toPlayerView, toSeatPrivateView } from '../../../src/server/room/projection';
import type { CombatCursor } from '../../../src/server/net/messages';

const manual = new ManualClock();
let room: Room;
const samples = new Map<number, { round: number; name: string; workMs: number; combatMs: number; projectionMs: number; broadcastMs: number;
  maxTaskMs: number; maxCombatMs: number; bytes: number; messages: number; maxUnits: number; maxItems: number; ticks: number }>();
const sample = () => {
  const state = room.state;
  let entry = samples.get(state.round);
  if (!entry) samples.set(state.round, entry = { round: state.round, name: state.roundName, workMs: 0, combatMs: 0,
    projectionMs: 0, broadcastMs: 0, maxTaskMs: 0, maxCombatMs: 0, bytes: 0, messages: 0, maxUnits: 0, maxItems: 0, ticks: 0 });
  return entry;
};
const clock: Clock = { now: () => manual.now(), cancel: handle => manual.cancel(handle), schedule: (at, fn) => manual.schedule(at, () => {
  const entry = sample(), started = performance.now(); fn();
  const ms = performance.now() - started; entry.workMs += ms; entry.maxTaskMs = Math.max(entry.maxTaskMs, ms);
}) };
const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `bot-${i}`, name: `机器人${i}`, kind: 'bot' as const }));
room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, clock, roomId: 'perf', seed: Number(process.argv[2] ?? 42),
  resolver: new TwoSidedBattleResolver(), carousel: CAROUSEL_RULES_BINDING, combatStreaming: true, sliceTicks: 100, sliceMs: 20,
  sliceNow: () => performance.now(), onCombatWork: ms => { const s = sample(); s.combatMs += ms; s.maxCombatMs = Math.max(s.maxCombatMs, ms); } });
const bots = new BotDriver(room, Number(process.argv[2] ?? 42), {});
const roomRevisions = new Map<string, number>();
const seatRevisions = new Map<string, number>();
const cursors = new Map<string, CombatCursor>();
const send = (message: unknown) => { const s = sample(), t = performance.now(); const json = JSON.stringify(message);
  s.broadcastMs += performance.now() - t; s.bytes += Buffer.byteLength(json); s.messages++; };
let latest: unknown;
function push() {
  const state = room.state, s = sample();
  for (const seat of state.seats) {
    if (roomRevisions.get(seat.seatId) !== state.roomRevision) {
      roomRevisions.set(seat.seatId, state.roomRevision);
      const t = performance.now(); const view = toPlayerView(state, seat.seatId, manual.now()); s.projectionMs += performance.now() - t; send({ type: 'view', view });
    }
    if ((seat.alive || seat.eliminatedRound === state.round) && seatRevisions.get(seat.seatId) !== seat.seatRevision) {
      seatRevisions.set(seat.seatId, seat.seatRevision);
      const t = performance.now(); const privateState = toSeatPrivateView(seat.match, seat.choiceDeadline); s.projectionMs += performance.now() - t; send({ type: 'state', state: privateState });
    }
    if (room.streamingBoundaryPending) continue;
    const t = performance.now(), stream = room.combatStreamFor(seat.seatId); s.projectionMs += performance.now() - t;
    if (!stream) continue;
    const cursor = cursors.get(seat.seatId);
    const from = cursor?.battleId === stream.battleId ? cursor.nextTick : 1;
    if (!cursor || cursor.battleId !== stream.battleId) send({ type: 'combat-open', initial: stream.initial, frame: stream.ticks[0] });
    if (stream.ticks.length > from) send({ type: 'combat-chunk', ticks: stream.ticks.slice(from) });
    cursors.set(seat.seatId, { battleId: stream.battleId, revision: stream.revision, seatId: seat.seatId, nextTick: stream.ticks.length });
    s.ticks = Math.max(s.ticks, stream.ticks.length - 1);
    s.maxUnits = Math.max(s.maxUnits, stream.initial.units.length);
    const items = state.seats.reduce((max, player) => Math.max(max, player.match.items.filter(item => item.location.kind === 'unit').length), 0);
    s.maxItems = Math.max(s.maxItems, items);
    if (state.round >= 26 && stream.initial.units.length >= 14) latest = { round: state.round, name: state.roundName, initial: stream.initial, ticks: stream.ticks };
  }
}
room.subscribe(push); room.subscribeStreams(push);
room.start();
let last = 0;
for (let fired = 0; room.state.phase !== 'ended' && fired < 300_000; fired++) {
  if (!manual.fireNext()) break;
  if (room.state.round !== last) { last = room.state.round; process.stderr.write(`${room.state.roundName}\n`); }
}
if (room.state.fault || room.state.phase !== 'ended') throw Error(JSON.stringify(room.state.fault ?? room.state.phase));
bots.dispose(); room.dispose();
writeFileSync(process.env.CAT_PERF_FIXTURE ?? '/tmp/cat-late-combat.json', JSON.stringify(latest ?? null));
process.stdout.write(JSON.stringify({ seed: process.argv[2] ?? 42, node: process.version, samples: [...samples.values()] }, null, 2));
