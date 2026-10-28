import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { getCatalogRoundByOrdinal } from '../src/simulation/round-selectors';
import { portfolioGoldPlan } from '../src/simulation/augment-pool-batch5-h4';
import { gloriousEvolutionProgress } from '../src/simulation/augment-pool-batch5-s8b';
import { ghostFriendsGrowth } from '../src/simulation/augment-pool-batch5-g2';
import type { MatchState } from '../src/simulation/match-types';
import type { AugmentHistory, AugmentHistoryFact } from '../src/simulation/augment-history-types';
import { toSeatPrivateView, toPublicBoard } from '../src/server/room/projection';
import { augmentPlayerDescription } from '../src/presentation/augment-display';
import { loadAugmentText } from '../src/presentation/augment-text-loader';

beforeAll(() => loadAugmentText());

const IDS = ['diversified-portfolio', 'diversified-portfolio-plus', 'glorious-evolution', 'lunch-money', 'forward-thinking', 'ghost-of-friends-past'] as const;
const own = (definitionId: string, choiceId = definitionId, acquiredRound = 1) => ({ definitionId, choiceId, acquiredRound });
const atRound = (round = 2): MatchState => {
  const base = createMatch(42), definition = getCatalogRoundByOrdinal(round);
  return { ...base, round, roundDefinitionId: definition.roundId, m8: { ...base.m8, round: definition } };
};
const history = (facts: readonly AugmentHistoryFact[]): AugmentHistory => ({ version: 'augment-history-v1', seatId: 'solo', proof: { kind: 'server' }, facts });
const roster = (ids: readonly string[]) => ({
  units: ids.map((definitionId, index) => ({ id: `u${index}`, definitionId, team: 'player' as const, starLevel: 1 as const,
    location: { kind: 'board' as const, cell: { col: index % 7, row: 4 + Math.floor(index / 7) } } })),
  items: [],
});
const described = (state: MatchState, id: string) => augmentPlayerDescription(id, toSeatPrivateView(state).augmentDynamicValues[id]);

it('diversified-portfolio shows the frozen round-entry gold bonus', () => {
  const units = ['irelia', 'illaoi', 'vex', 'renata'];
  const state = { ...atRound(), augments: [own('diversified-portfolio')], augmentHistory: history([{
    kind: 'round-entry', sequence: 0, seatId: 'solo', round: 2, roundId: '1-2', resourcePrefix: 0, roster: roster(units),
  }]) };
  expect(portfolioGoldPlan(state)).toEqual([expect.objectContaining({ amount: 1 })]);
  const text = described(state, 'diversified-portfolio');
  expect(text).toContain('金币加成：1');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('diversified-portfolio')).toContain('未确定');
});

it('diversified-portfolio-plus shows the same frozen trait bonus', () => {
  const state = { ...atRound(), augments: [own('diversified-portfolio-plus', 'plus')], augmentHistory: history([{
    kind: 'round-entry', sequence: 0, seatId: 'solo', round: 2, roundId: '1-2', resourcePrefix: 0,
    roster: roster(['irelia', 'illaoi', 'vex', 'renata']),
  }]) };
  expect(portfolioGoldPlan(state).map(row => row.amount)).toEqual([1]);
  const text = described(state, 'diversified-portfolio-plus');
  expect(text).toContain('金币加成：1');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('diversified-portfolio-plus')).toContain('未确定');
});

it('glorious-evolution shows the settled upgrade count', () => {
  const owner = own('glorious-evolution', 'helm');
  const base = { ...atRound(), augments: [owner] };
  const receiptId = JSON.stringify(['augment-pool-batch1', 'helm', 'glorious-evolution', 0, 0]);
  const state: MatchState = { ...base, resourceProvenance: { ...base.resourceProvenance, entries: [...base.resourceProvenance.entries,
    { kind: 'item-acquired', itemId: 'helm-item', source: { kind: 'mechanic', receiptId }, sequence: 50, roundId: base.roundDefinitionId },
    { kind: 'unit-upgraded', acquisitionSequence: 0, sequence: 51, roundId: base.roundDefinitionId, event: {
      type: 'unitUpgraded', survivorId: 'u', consumedIds: ['a', 'b'], definitionId: 'lux', fromStar: 1, toStar: 3,
      location: { kind: 'board', cell: { col: 0, row: 0 } },
    } },
  ] } };
  expect(gloriousEvolutionProgress(state).count).toBe(2);
  const text = described(state, 'glorious-evolution');
  expect(text).toContain('(当前：2)');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('glorious-evolution')).toContain('未确定');
});

it('lunch-money shows cumulative actual damage and counts a mirror as zero', () => {
  const damage = (battleId: string, actualDamage: number | null, mirror = false, extra: Record<string, unknown> = {}) => ({
    kind: 'player-damage' as const, sequence: 0, seatId: 'solo', round: 2, roundId: '1-2', resourcePrefix: 0,
    battleId, opponentSeatId: mirror ? 'enemy' : 'enemy', mirror, hpBefore: 77, hpAfterDamage: 57, actualDamage, ...extra,
  });
  const state = { ...atRound(), augments: [own('lunch-money')], augmentHistory: history([
    damage('real', 8), damage('mirror', 20, true), damage('rest', 5), damage('real', 100),
    { ...damage('unknown', null), opponentSeatId: null },
  ]) };
  const view = toSeatPrivateView(state);
  expect(view.augmentDynamicValues['lunch-money']).toEqual({ values: [13] });
  expect(JSON.stringify(view.augmentDynamicValues['lunch-money'])).not.toMatch(/hpBefore|hpAfter|opponentSeatId|77|20/);
  const text = augmentPlayerDescription('lunch-money', view.augmentDynamicValues['lunch-money']);
  expect(text).toContain('(当前：13)');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('lunch-money')).toContain('未确定');
  const bare = { ...atRound(), augments: [own('lunch-money')] };
  expect(() => toSeatPrivateView(bare)).not.toThrow();
  expect(described(bare, 'lunch-money')).toContain('未确定');
});

it('forward-thinking shows the frozen principal plus 70', () => {
  const owner = own('forward-thinking', 'think');
  const state = { ...atRound(), augments: [owner], augmentHistory: history([{
    kind: 'acquire', sequence: 0, seatId: 'solo', round: 1, roundId: '1-1', resourcePrefix: 0, choiceId: 'think',
    definitionId: 'forward-thinking', goldBefore: 31, hpBefore: 100, roster: roster([]), previousBattle: { status: 'none' }, preparationElapsedMs: 0,
  }]) };
  const text = described(state, 'forward-thinking');
  expect(text).toContain('即将收到的金币：101');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('forward-thinking')).toContain('未确定');
});

it('ghost-of-friends-past shows own settled growth and divides attack damage by 100', () => {
  const death = (eventSeq: number, definitionId: string, ownerSeatId: string, ordinaryHero: boolean, championCopy = false) => ({
    combatId: 'battle', eventSeq, tick: eventSeq, definitionId, unitId: `${definitionId}-${eventSeq}`, team: 'player' as const,
    ownerSeatId, originalUnitId: `${definitionId}-${eventSeq}`, ordinaryHero, equipment: [], combatItemGrants: [],
    ...(championCopy ? { championCopy: true as const } : {}),
  });
  const state = { ...atRound(), augments: [own('ghost-of-friends-past', 'ghost')], augmentHistory: history([{
    kind: 'deaths', sequence: 0, seatId: 'solo', round: 1, roundId: '1-1', resourcePrefix: 0, battleId: 'battle', completeThroughTick: 1,
    deaths: [
      death(1, 'irelia', 'solo', true), death(1, 'irelia', 'solo', true), death(2, 'irelia', 'solo', true),
      death(3, 'darius', 'solo', true), death(4, 'darius', 'solo', true),
      death(5, 'akali', 'solo', false, true), death(6, 'akali', 'solo', false, true),
      death(7, 'lux', 's1', true), death(8, 'g23-sion', 'solo', false),
    ],
  }]) };
  expect(ghostFriendsGrowth(state)).toEqual({ healthFlat: 10, attackDamageBps: 160, abilityPower: 2 });
  const view = toSeatPrivateView(state);
  expect(view.augmentDynamicValues['ghost-of-friends-past']).toEqual({ values: [10, 1.6, 2] });
  expect(JSON.stringify(view.augmentDynamicValues['ghost-of-friends-past'])).not.toMatch(/lux|s1|deaths|darius/);
  const text = augmentPlayerDescription('ghost-of-friends-past', view.augmentDynamicValues['ghost-of-friends-past']);
  expect(text).toContain('生命值：10');
  expect(text).toContain('攻击力：1.6%');
  expect(text).toContain('法术强度：2');
  expect(text).not.toContain('未确定');
  expect(augmentPlayerDescription('ghost-of-friends-past')).toContain('未确定');
});

it('scouting another seat gets no dynamic values', () => {
  const state = { ...atRound(), augments: IDS.map(id => own(id, id)), augmentHistory: history([{
    kind: 'player-damage', sequence: 0, seatId: 'solo', round: 2, roundId: '1-2', resourcePrefix: 0,
    battleId: 'real', opponentSeatId: 'enemy', mirror: false, hpBefore: 77, hpAfterDamage: 69, actualDamage: 8,
  }]) };
  const mine = toSeatPrivateView(state);
  expect(mine.augmentDynamicValues['lunch-money'].values).toEqual([8]);
  const board = toPublicBoard(state);
  expect(JSON.stringify(board)).not.toContain('augmentDynamicValues');
  const augments = board.augments ?? [];
  expect(augments).toEqual([...IDS]);
  const panel = readFileSync(new URL('../src/rendering/online/opponent-board.ts', import.meta.url), 'utf8');
  expect(panel).toContain('augmentPlayerDescription(id)');
  expect(panel).not.toContain('augmentDynamicValues');
  for (const id of augments) expect(augmentPlayerDescription(id), id).toContain('未确定');
  const offered = { ...atRound(), pendingChoice: { kind: 'augment', offers: [...IDS] } as unknown as MatchState['pendingChoice'] };
  for (const id of IDS) expect(described(offered, id), id).toContain('未确定');
});
