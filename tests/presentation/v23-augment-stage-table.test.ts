import { afterEach, describe, expect, it } from 'vitest';
import { AUGMENT_TIER_TEXT } from '../../src/presentation/augment-display';
import { stageTrackRounds } from '../../src/rendering/online/stage-track';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIER_COMBINATIONS } from '../../src/simulation/content/augment-policy';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../../src/simulation/content/round-catalog';
import { AUGMENT_PREPARATION_MS, Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { runUntil, SEATS, TIMINGS } from '../server/helpers';

// Verbatim CSV snapshot, including all zero-weight rows, for portable CI without the research directory.
// Source: /home/aiapps/workspace/augments-research-2026-10-23/data/odds-all27.csv
// Original file SHA-256: d081f1cc2ea60ed6935b707d03d54ed88267fa3a64fc63913c10923b60f2d62e
const clientCsv = `2-1,3-2,4-2,sequence_cn,configuration,integer_weight,denominator,probability_percent,source_type
1,1,1,银→银→银,not present,0,109,0,not configured among 20 entries
1,1,2,银→银→金,TFT9_AugmentConfiguration_Option1,5,109,4.587155963,explicit entry
1,1,3,银→银→彩,TFT9_AugmentConfiguration_Option2,5,109,4.587155963,explicit entry
1,2,1,银→金→银,not present,0,109,0,not configured among 20 entries
1,2,2,银→金→金,TFT9_AugmentConfiguration_Option3,12,109,11.009174312,explicit entry
1,2,3,银→金→彩,TFT9_AugmentConfiguration_Option12,5,109,4.587155963,explicit entry
1,3,1,银→彩→银,TFT9_AugmentConfiguration_Option9,0,109,0.0,explicit entry
1,3,2,银→彩→金,not present,0,109,0,not configured among 20 entries
1,3,3,银→彩→彩,TFT9_AugmentConfiguration_Option15,1,109,0.917431193,explicit entry
2,1,1,金→银→银,TFT9_AugmentConfiguration_Option11,0,109,0.0,explicit entry
2,1,2,金→银→金,TFT9_AugmentConfiguration_Option4,18,109,16.513761468,explicit entry
2,1,3,金→银→彩,TFT9_AugmentConfiguration_Option6,2,109,1.834862385,explicit entry
2,2,1,金→金→银,not present,0,109,0,not configured among 20 entries
2,2,2,金→金→金,TFT9_AugmentConfiguration_Option13,22,109,20.183486239,explicit entry
2,2,3,金→金→彩,TFT9_AugmentConfiguration_Option5,12,109,11.009174312,explicit entry
2,3,1,金→彩→银,TFT9_AugmentConfiguration_Option19,6,109,5.504587156,explicit entry
2,3,2,金→彩→金,TFT9_AugmentConfiguration_Option16,10,109,9.174311927,explicit entry
2,3,3,金→彩→彩,TFT9_AugmentConfiguration_Option17,1,109,0.917431193,explicit entry
3,1,1,彩→银→银,not present,0,109,0,not configured among 20 entries
3,1,2,彩→银→金,TFT9_AugmentConfiguration_Option7,4,109,3.669724771,explicit entry
3,1,3,彩→银→彩,TFT9_AugmentConfiguration_Option14,1,109,0.917431193,explicit entry
3,2,1,彩→金→银,not present,0,109,0,not configured among 20 entries
3,2,2,彩→金→金,TFT9_AugmentConfiguration_Option10,2,109,1.834862385,explicit entry
3,2,3,彩→金→彩,TFT9_AugmentConfiguration_Option18,1,109,0.917431193,explicit entry
3,3,1,彩→彩→银,not present,0,109,0,not configured among 20 entries
3,3,2,彩→彩→金,TFT9_AugmentConfiguration_Option20,1,109,0.917431193,explicit entry
3,3,3,彩→彩→彩,TFT9_AugmentConfiguration_Option8,1,109,0.917431193,explicit entry`;
const tiers = ['silver', 'gold', 'prismatic'] as const;
const nodes = ['2-1', '3-2', '4-2'] as const;
const clientRows = clientCsv.split('\n').slice(1).map(line => {
  const [a, b, c, sequence, configuration, weight, denominator, probability, source] = line.split(',');
  return { tiers: [a, b, c].map(n => tiers[Number(n) - 1]), sequence, configuration,
    weight: Number(weight), denominator: Number(denominator), probability: Number(probability), source };
});

describe('14.24 client augment tier table consumed by the UI', () => {
  it('contains each of the 27 combinations exactly once, with 18 nonzero rows and denominator 109', () => {
    expect(clientCsv.split('\n')[0]).toBe('2-1,3-2,4-2,sequence_cn,configuration,integer_weight,denominator,probability_percent,source_type');
    expect(clientRows).toHaveLength(27);
    expect(new Set(clientRows.map(r => r.tiers.join('/'))).size).toBe(27);
    expect(clientRows.filter(r => r.weight > 0)).toHaveLength(18);
    expect(clientRows.reduce((sum, r) => sum + r.weight, 0)).toBe(109);
    expect(AUGMENT_OFFER_POLICY.tierWeightTotal).toBe(109);
    expect(AUGMENT_TIER_COMBINATIONS).toEqual(clientRows.filter(r => r.weight > 0).map(r => ({ tiers: r.tiers, weight: r.weight })));
  });

  it.each(clientRows)('$sequence (weight $weight): matches rules and every UI tier label at 2-1/3-2/4-2', row => {
    const matches = AUGMENT_TIER_COMBINATIONS.filter(rule => rule.tiers.join('/') === row.tiers.join('/'));
    expect(matches).toHaveLength(row.weight === 0 ? 0 : 1);
    if (row.weight > 0) expect(matches[0].weight).toBe(row.weight);
    expect(row.denominator).toBe(109);
    // CSV percent is rounded to nine decimal places; integer weights are checked exactly above.
    expect(row.probability).toBeCloseTo(row.weight * 100 / row.denominator, 8);
    expect(row.tiers.map(tier => AUGMENT_TIER_TEXT[tier][0]).join('→')).toBe(row.sequence);
    expect(row.tiers.map(tier => AUGMENT_TIER_TEXT[tier])).toEqual(row.sequence.split('→').map(label => `${label}色`));
    for (const id of nodes) {
      const round = ROUND_CATALOG.find(r => r.roundId === id)!;
      expect(stageTrackRounds(round.ordinal).find(r => r.roundId === id))
        .toEqual({ roundId: id, icon: 'augment', title: `${id} 强化 · 玩家对战`, state: 'current' });
    }
  });
});

describe('per-round stage tracker agrees with the full rules catalog', () => {
  it.each(ROUND_CATALOG)('$roundId: every displayed row, special mark and progress state matches its rules source', current => {
    const stage = ROUND_CATALOG.filter(r => r.stage === current.stage);
    const shown = stageTrackRounds(current.ordinal);
    expect(shown.map(r => r.roundId)).toEqual(stage.map(r => r.roundId));
    for (const [index, round] of stage.entries()) {
      const marks = ROUND_SEMANTIC_NODES[round.roundId] ?? [];
      const icon = marks.includes('augment') ? 'augment' : marks.includes('anomaly') ? 'anomaly'
        : round.kind === 'supply' ? 'carousel' : round.kind;
      expect(shown[index]).toMatchObject({ roundId: round.roundId, icon,
        state: round.ordinal < current.ordinal ? 'done' : round.ordinal === current.ordinal ? 'current' : 'next' });
      expect(shown[index].title.startsWith(`${round.displayName} `)).toBe(true);
    }
  });
  it('marks only the three approved augment nodes and 4-6 anomaly, including future and completed rows', () => {
    const all = ROUND_CATALOG.flatMap(r => stageTrackRounds(r.ordinal).filter(s => s.state === 'current'));
    expect(all.filter(r => r.icon === 'augment').map(r => r.roundId)).toEqual(nodes);
    expect(all.filter(r => r.icon === 'anomaly')).toEqual([
      { roundId: '4-6', icon: 'anomaly', title: '4-6 玩家对战 · 异常', state: 'current' },
    ]);
    for (const ordinal of [0, -1, NaN, Infinity, 1.5]) expect(stageTrackRounds(ordinal)).toEqual([]);
    expect(stageTrackRounds(39)).toEqual([
      { roundId: 'overtime-1', icon: 'pvp', title: '加时 1 玩家对战', state: 'current' },
      { roundId: 'overtime-2', icon: 'pvp', title: '加时 2 玩家对战', state: 'next' },
    ]);
  });
});

const rooms: Room[] = [];
afterEach(() => { for (const room of rooms.splice(0)) room.dispose(); });
// This traverses real room phases up to 4-2; wall-clock duration is not the deadline under test.
it('all three augment windows project one 50 s preparation and keep choices open until exactly its deadline', { timeout: 30_000 }, () => {
  expect(AUGMENT_PREPARATION_MS).toBe(50_000);
  expect(ROOM_TIMING_DEFAULTS.choiceMs).toBe(30_000);
  const clock = new ManualClock();
  // Empty bot boards avoid simulating whole armies; all phases, commands and projections stay real.
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'bot' })), {
    roomId: 'v23-stage-table', seed: 42, clock, resolver: new TwoSidedBattleResolver(),
    ...TIMINGS, choiceMs: 30_000,
  });
  rooms.push(room); room.start();
  for (const seat of room.state.seats) {
    const unit = seat.match.preparation.units.find(u => u.team === 'player')!;
    expect(room.handle(seat.seatId, { type: 'deploy', unitId: unit.id, target: { kind: 'bench', slot: 0 } }).ok).toBe(true);
  }
  const phases: string[] = [];
  room.subscribe(state => { const key = `${state.roundId}:${state.phase}`; if (phases.at(-1) !== key) phases.push(key); });
  for (const id of nodes) {
    runUntil(room, clock, s => s.roundId === id && s.phase === 'preparation');
    const before = room.state, start = clock.now();
    const publicView = toPlayerView(before, 's0', start);
    expect(publicView.phase).toMatchObject({ kind: 'preparation', endsAt: start + 50_000, serverNow: start });
    expect(phases).not.toContain(`${id}:choice`);
    expect(stageTrackRounds(publicView.phase.round).find(r => r.state === 'current')?.icon).toBe('augment');
    const choices = before.seats.map(s => s.match.pendingChoice!);
    for (const seat of before.seats) {
      expect(seat.match.pendingChoice!.returnPhase).toBe('preparation');
      const vm = toDisplayMatch(toSeatPrivateView(seat.match));
      expect(vm.pendingChoice).toMatchObject({ kind: 'augment', step: 'offer', choiceId: `round:${id}:augment` });
      expect(vm.pendingChoice!.offers).toHaveLength(3);
      expect(AUGMENT_TIER_TEXT[vm.pendingChoice!.augmentTier!]).toMatch(/^(银色|金色|彩色)$/);
    }
    clock.advance(30_000); expect(room.state).toBe(before);
    clock.advance(19_999); expect(room.state).toBe(before);
    clock.advance(1);
    expect(clock.now()).toBe(start + 50_000);
    expect(room.state.phase).not.toBe('preparation');
    expect(room.state.fault).toBeNull();
    for (const [index, seat] of room.state.seats.entries()) {
      expect(toDisplayMatch(toSeatPrivateView(seat.match)).pendingChoice).toBeNull();
      expect(seat.match.augments).toContainEqual(expect.objectContaining({ choiceId: choices[index].choiceId, definitionId: choices[index].offers[0] }));
    }
  }
});
