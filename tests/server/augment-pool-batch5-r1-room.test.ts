import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { recordRoomPublication } from '../../src/server/room/augment-history';
import { ManualClock } from '../../src/server/room/clock';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import type { BattleInput, BattleResult, RoomState, SeatState } from '../../src/server/room/types';
import { runUntil, claimAllOrbs, TIMINGS } from './helpers';
import { runSharedMatchCommand, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import type { SharedPoolState } from '../../src/simulation/shared-pool-types';
import { resolveRoundEconomy } from '../../src/simulation/round-economy';
import { ROUND_SETTLEMENT_VERSION } from '../../src/simulation/round-settlement';
import { needsOpponentHp } from '../../src/simulation/augment-settlement-gold';
import { choiceTimeoutOption } from '../../src/simulation/seat-mechanics/choices';
import { augmentNeedsHistory } from '../../src/simulation/augment-history-owners';
import { tombRaiderOpportunities, TOMB_RAIDER_SOURCE } from '../../src/simulation/augment-pool-batch5-r1';
import { decideBotAction } from '../../src/simulation/bot';
import { canonicalContent } from '../../src/simulation/content';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { tombRaiderPlan } from '../fixtures/m5/oracle.g2.cjs';
import { captureAugmentHistoryAuthority } from '../../src/simulation/augment-history';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { replayG23Economy } from '../../src/simulation/g2-3-match-progress';
import { applyG23Radiant } from '../../src/simulation/g2-3-radiant';
import { g23RadiantDefinitionId } from '../../src/simulation/g2-3-rewards';
import { appendResourceProvenance } from '../../src/simulation/resource-provenance';
import type { G23BattleFacts, G23EconomyReceipt } from '../../src/simulation/g2-3-economy';
import type { MatchState } from '../../src/simulation/match-types';

/** Controlled historical PvP facts reach chest 15 in 4-3; the real economy replay and
 * radiant hook create the conversion. The room's reward, equipment and carousel are real. */
function radiantSnapshot(state: MatchState): MatchState {
  const progress = readG23Progress(state)!;
  const last = state.multiplayer!.receipts.find(r => r.roundId === '4-3')!;
  const prior = state.multiplayer!.receipts.filter(r => r.round < last.round).slice(0, 2);
  expect(prior).toHaveLength(2);
  const selected = [...prior, last];
  const facts = (receipt: typeof last, count: number): G23BattleFacts => ({
    battleId: receipt.battleId, round: receipt.round, roundKind: 'pvp', result: receipt.result,
    conquerorTier: 9, conquestTakedowns: Array.from({ length: count }, (_, i) => `${receipt.battleId}-enemy-${i}`),
    chemBaronTier: 0, alliedDeaths: 0, rumbleStar: 0, highRollerGold: 0,
  });
  const records = (lastCount: number): G23EconomyReceipt[] => {
    const replacements = selected.map((receipt, index) => ({ kind: 'battle' as const,
      facts: facts(receipt, index === 2 ? lastCount : 30), gold: 0, bundles: [] }));
    const kept = progress.economyReceipts.filter(r => r.kind !== 'battle' || !selected.some(s => s.round === r.facts.round));
    expect(kept.every(r => r.kind === 'battle')).toBe(true);
    return [...kept, ...replacements].sort((a, b) =>
      (a.kind === 'battle' ? a.facts.round : a.round) - (b.kind === 'battle' ? b.facts.round : b.round));
  };
  const beforeLast = replayG23Economy(state.seed, records(0));
  const missing = Math.ceil((1500 - beforeLast.conquest.stacks) / 20);
  expect(missing).toBeGreaterThan(0); expect(missing).toBeLessThanOrEqual(30);
  const replayed = replayG23Economy(state.seed, records(missing));
  expect(replayed.conquest.receipts.find(r => r.chestTiers.includes(15))?.battleId).toBe(last.battleId);
  const multiplayer = { ...state.multiplayer!, receipts: state.multiplayer!.receipts.map(receipt => {
    const action = replayed.economyReceipts.find(r => r.kind === 'battle' && r.facts.battleId === receipt.battleId);
    return action?.kind === 'battle' ? { ...receipt, g23Facts: action.facts } : receipt;
  }) };
  // The reward was equipped during 4-3, and no later resource fact may precede
  // this settlement conversion in the reconstructed stream.
  expect(state.resourceProvenance.entries.every(f => f.roundId !== '4-4')).toBe(true);
  const converted = applyG23Radiant(writeG23Progress({ ...state, multiplayer, roundDefinitionId: '4-3' }, replayed));
  return { ...converted, roundDefinitionId: state.roundDefinitionId };
}

/** Controlled PvP outcomes still go through the actual shared settlement command and Room rank/release commit.
 * PvE uses the real combat runner; no production observation or reward is seeded. */
class RankedEliminationResolver implements BattleResolver {
  readonly losers = new Set<string>();
  private readonly pve = new PlaceholderBattleResolver();
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult {
    if (input.roundKind !== 'pvp') return this.pve.resolveBattle(input, pool);
    let latest = pool;
    const outcomes = input.seats.map(seat => {
      const state = seat.state, loss = this.losers.has(seat.seatId);
      const plan = resolveRoundEconomy({ augments: state.augments, roundId: state.roundDefinitionId,
        result: loss ? 'enemyWin' : 'playerWin', gold: state.gold, streak: state.streak, level: state.level,
        xp: state.xp, hp: state.playerHp, enemySurvivors: loss ? 1 : 0 });
      const result = runSharedMatchCommand(latest, state, { type: 'settleRound', receipt: {
        version: ROUND_SETTLEMENT_VERSION, settlementId: `controlled:${state.round}:${seat.seatId}`,
        battleId: input.battleId, seatId: seat.seatId, round: state.round, roundId: state.roundDefinitionId,
        settlementEligible: true, result: loss ? 'loss' : 'win', damage: plan.playerDamage, baseDamage: plan.baseDamage,
        opposingSurvivors: loss ? 1 : 0, growth: [], combatTicks: 1, combatEventCount: 1,
        ...(needsOpponentHp(state.augments, state.round) ? { opponentHp: 100 } : {}),
      } });
      if (!result.ok) throw new Error(`${seat.seatId}: ${result.reason}`);
      latest = result.pool;
      return { seatId: seat.seatId, state: result.state, result: loss ? 'enemyWin' as const : 'playerWin' as const,
        damage: plan.playerDamage, combat: null };
    });
    return { kind: 'placeholder', battleId: input.battleId, roomRevision: input.roomRevision, round: input.round, outcomes, pool: latest };
  }
}

describe.each([{ id: 'tomb-raider-1', seed: 1, opportunities: 3, grants: 2, carousel: false },
  { id: 'tomb-raider-1', seed: 1, opportunities: 3, grants: 2, carousel: true },
  { id: 'tomb-raider-2', seed: 0, opportunities: 4, grants: 3, carousel: true }])('$id actual Room publication, choice and authority (carousel: $carousel)', ({ id, seed, opportunities, grants, carousel }) => {
  const clock = new ManualClock(), resolver = new RankedEliminationResolver();
  const room = new Room(Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `玩家${index}`, kind: 'human' as const })),
    { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, seed, roomId: `tomb-room-${id}`, clock, resolver, pvpMode: 'placeholder',
      ...(carousel ? { carousel: CAROUSEL_RULES_BINDING } : {}) });
  let ownerId = '', victims: readonly SeatState[] = [];
  const mine = () => room.state.seats.find(s => s.seatId === ownerId)!;
  beforeAll(() => room.start());
  afterAll(() => room.dispose());
  function answer() {
    for (const seat of room.state.seats) for (let n = 0; n < 16; n++) {
      const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice;
      if (!c) break;
      const option = c.kind === 'augment'
        ? c.offers.find(id => !augmentNeedsHistory(id) && !['dummify', 'golemify'].includes(id)) ?? c.offers[0]
        : choiceTimeoutOption(c)!;
      expect(room.handle(seat.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: option })).toMatchObject({ ok: true });
    }
  }
  function reach(round: string) {
    for (let fired = 0; fired < 5000; fired++) {
      claimAllOrbs(room);
      if (room.state.roundId === round && ['preparation', 'choice', 'carousel'].includes(room.state.phase)) return;
      if (room.state.fault || room.state.phase === 'ended') break;
      if (room.state.phase === 'preparation') answer();
      if (!clock.runNext()) break;
    }
    throw new Error(`did not reach ${round}: ${room.state.roundId}/${room.state.phase}, ${JSON.stringify(room.state.fault)}`);
  }
  // Split real combat legs so each test retains Vitest's unchanged deadline.
  for (const round of ['1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7',
    '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '4-1', '4-2']) it(`reaches ${round} through the room`, () => {
    reach(round); expect(room.state.fault).toBeNull();
  });

  it('selects the augment from an actual room offer', () => {
    for (const seat of room.state.seats) {
      if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes(id))) break;
      for (let slot = 0; slot < 3; slot++) {
        const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
        expect(room.handle(seat.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
        if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes(id))) break;
      }
    }
    const owner = room.state.seats.find(s => s.match.pendingChoice?.offers.includes(id));
    expect(owner, JSON.stringify(room.state.seats.map(s => ({ seat: s.seatId, choice: s.match.pendingChoice })))).toBeDefined();
    if (!owner) throw new Error(`no ${id} room offer`); ownerId = owner.seatId;
    const c = owner.match.pendingChoice!;
    // Bot legality dry-runs selectChoice before the room attaches the acquisition table.
    const preview: MatchState = { ...owner.match, pendingChoice: { ...c, offers: [id, ...c.offers.filter(offer => offer !== id)] } };
    expect(decideBotAction(preview, { difficulty: 'basic', stepsTaken: 0, maxSteps: 8,
      self: { seatId: owner.seatId, hp: preview.playerHp, round: preview.round } }, 1).action)
      .toMatchObject({ type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: id });
    expect(room.handle(ownerId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: id })).toMatchObject({ ok: true });
    answer();
    victims = room.state.seats.filter(s => s.seatId !== ownerId).sort((a, b) => b.index - a.index).slice(0, 4);
    expect(mine().match.augmentHistory?.facts.some(f => f.kind === 'table' && f.stage === 'acquire' && f.seats.length === 8)).toBe(true);
  });

  it('equips real completed items through room commands and commits four simultaneous eliminations', () => {
    for (const victim of victims.slice(1)) {
      const seat = () => room.state.seats.find(s => s.seatId === victim.seatId)!;
      let items = seat().match.items.filter(i => i.location.kind === 'inventory');
      const components = items.filter(i => ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'].includes(i.definitionId));
      const previousIds = new Set(seat().match.items.map(i => i.id));
      expect(components.length).toBeGreaterThanOrEqual(2);
      expect(room.handle(victim.seatId, { type: 'combine', a: components[0].id, b: components[1].id })).toMatchObject({ ok: true });
      items = seat().match.items.filter(i => !previousIds.has(i.id) && i.location.kind === 'inventory' && ITEM_DEFINITIONS[i.definitionId].kind === 'completed');
      expect(items.length).toBeGreaterThan(0);
      const unit = seat().match.preparation.units.find(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon
        && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral')!;
      expect(room.handle(victim.seatId, { type: 'equip', itemId: items[0].id, unitId: unit.id, slot: 0 })).toMatchObject({ ok: true });
    }
    // Test-only lethal starting HP; equipment, augment, settlement and rank/release are real commands/Room code.
    const holder = room as unknown as { current: RoomState };
    holder.current = { ...holder.current, seats: holder.current.seats.map(s => victims.some(v => v.seatId === s.seatId)
      ? { ...s, hp: 1, match: { ...s.match, playerHp: 1 }, seatRevision: s.seatRevision + 1 } : s) };
    for (const victim of victims) resolver.losers.add(victim.seatId);
    runUntil(room, clock, s => s.roundId === '4-2' && s.phase === 'choice'
      && mine().match.pendingChoice?.payload?.source === TOMB_RAIDER_SOURCE);
    expect(room.state.fault).toBeNull();
    const owner = mine().match, choiceId = owner.augments.find(a => a.definitionId === id)!.choiceId;
    const plan = tombRaiderOpportunities(owner, choiceId);
    expect(plan.map(p => p.seatId)).toEqual(victims.slice(0, opportunities).map(s => s.seatId));
    expect(plan[0].candidates).toEqual([]); expect(plan[1].candidates.length).toBeGreaterThan(0);
    expect(plan[2].candidates.length).toBeGreaterThan(0);
    expect(owner.pendingChoice?.offers).toEqual(plan[1].candidates.map(c => c.definitionId));
    expect(toSeatPrivateView(owner).pendingChoice?.offers).toEqual(owner.pendingChoice?.offers);
    expect(tombRaiderPlan(owner).map((p: { seatId: string }) => p.seatId)).toEqual(plan.map(p => p.seatId));
    for (const victim of victims) expect(room.state.pool.seats.find(s => s.seatId === victim.seatId)?.released).toBe(true);
    const frozen = owner.augmentHistory!.facts.find(f => f.kind === 'table' && f.stage === 'settlement' && f.round === owner.round)!;
    expect(frozen.kind).toBe('table');
    if (frozen.kind === 'table') expect(frozen.seats.find(s => s.seatId === victims[1].seatId)?.items.some(i => i.location.kind === 'unit')).toBe(true);
  });

  it('restores the open room choice and continues with the same grant', () => {
    const live = mine().match, choice = live.pendingChoice!;
    expect(choice.payload?.source).toBe(TOMB_RAIDER_SOURCE);
    expect(tombRaiderOpportunities(live, live.augments.find(a => a.definitionId === id)!.choiceId).some(o => o.candidates.length === 0)).toBe(true);
    const restored = restoreSharedOrbSnapshot(room.state.pool, canonicalContent(live), room.augmentHistoryAuthority(ownerId));
    const command = { type: 'choose' as const, choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[0] };
    const fromLive = runSharedMatchCommand(room.state.pool, live, command);
    const fromRestored = runSharedMatchCommand(room.state.pool, restored, command);
    expect(fromLive.ok).toBe(true);
    expect(fromRestored).toEqual(fromLive);
    expect(mine().match.pendingChoice?.choiceId).toBe(choice.choiceId);
  });

  it('authenticates the open room choice and rejects history or candidate tampering', () => {
    const state = mine().match, authority = room.augmentHistoryAuthority(ownerId);
    for (const form of ['object', 'json', 'canonical']) {
      expect(restoreSharedOrbSnapshot(room.state.pool, form === 'object' ? state : form === 'json' ? JSON.stringify(state) : canonicalContent(state), authority)).toEqual(state);
      for (const edit of [
        (s: any) => { s.pendingChoice.offers.push('TFT4_Item_OrnnInfinityForce'); },
        (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((s: any) => s.seatId === victims[1].seatId).items = []; },
        (s: any) => { delete s.augmentHistory; },
      ]) {
        const bad = structuredClone(state); edit(bad);
        expect(() => restoreSharedOrbSnapshot(room.state.pool, form === 'object' ? bad : form === 'json' ? JSON.stringify(bad) : canonicalContent(bad), authority)).toThrow();
      }
    }
  });

  it('rejects a multiplayer restore after the acquisition table is removed', () => {
    const state = mine().match;
    expect(state.augmentHistory?.facts.some(f => f.kind === 'table' && f.stage === 'acquire')).toBe(true);
    const cloned = structuredClone(state);
    const kept = cloned.augmentHistory!.facts.filter(f => !(f.kind === 'table' && f.stage === 'acquire'));
    expect(kept).toHaveLength(cloned.augmentHistory!.facts.length - 1);
    const bad: MatchState = { ...cloned, augmentHistory: { ...cloned.augmentHistory!, facts: kept.map((fact, sequence) => ({ ...fact, sequence })) } };
    const authority = captureAugmentHistoryAuthority(bad);
    for (const input of [bad, JSON.stringify(bad), canonicalContent(bad)])
      expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow('Invalid tomb raider acquisition table');
  });

  it('chooses every nonempty opportunity through Room and grants each exactly once', () => {
    const serial = mine().match.nextItemSerial, first = mine().match.pendingChoice!;
    expect(room.handle(ownerId, { type: 'choose', choiceId: first.choiceId, generation: first.generation, definitionId: first.offers[0] })).toMatchObject({ ok: true });
    const second = mine().match.pendingChoice!; expect(second.choiceId).not.toBe(first.choiceId);
    expect(room.handle(ownerId, { type: 'choose', choiceId: first.choiceId, generation: first.generation, definitionId: first.offers[0] })).toMatchObject({ ok: false, reason: 'stale-choice' });
    expect(room.handle(ownerId, { type: 'choose', choiceId: second.choiceId, generation: second.generation, definitionId: second.offers[0] })).toMatchObject({ ok: true });
    if (id === 'tomb-raider-2') {
      const third = mine().match.pendingChoice!; expect(third).toBeDefined();
      expect(room.handle(ownerId, { type: 'choose', choiceId: third.choiceId, generation: third.generation, definitionId: third.offers[0] })).toMatchObject({ ok: true });
    }
    expect(mine().match.nextItemSerial).toBe(serial + grants);
    expect(mine().match.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(grants);
    expect(mine().match.pendingChoice).toBeNull();
    const authority = room.augmentHistoryAuthority(ownerId);
    expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(mine().match), authority)).toEqual(mine().match);
  });

  if (carousel) it('equips a tomb reward before the controlled Conqueror conversion', () => {
    reach('4-3'); answer();
    const state = mine().match, receipt = state.seatMechanics!.receipts.find(r =>
      r.source === TOMB_RAIDER_SOURCE && r.kind === 'choice' && g23RadiantDefinitionId(r.optionId));
    expect(receipt?.kind).toBe('choice');
    if (!receipt || receipt.kind !== 'choice' || !receipt.itemId) throw new Error('missing convertible reward');
    const unit = state.preparation.units.find(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon
      && !state.items.some(i => i.location.kind === 'unit' && i.location.unitId === u.id && i.location.slot === 0));
    expect(unit).toBeDefined(); if (!unit) throw new Error('missing equipment slot');
    expect(room.handle(ownerId, { type: 'equip', itemId: receipt.itemId, unitId: unit.id, slot: 0 })).toMatchObject({ ok: true });
  });

  let radiantState: MatchState;
  let reward: { itemId: string; optionId: string; radiantId: string };
  if (carousel) it('reaches the shared carousel after equipping the reward', () => { reach('4-4'); });
  if (carousel) it('constructs a converted reward from the ordered Conqueror history', () => {
    const prior = mine().match.seatMechanics!.receipts.find(r => r.source === TOMB_RAIDER_SOURCE && r.kind === 'choice'
      && mine().match.items.some(i => i.id === r.itemId && i.location.kind === 'unit'));
    if (!prior || prior.kind !== 'choice' || !prior.itemId) throw new Error('missing equipped reward');
    radiantState = radiantSnapshot(mine().match);
    const converted = radiantState.items.find(i => i.id === prior.itemId)!;
    reward = { itemId: prior.itemId, optionId: prior.optionId, radiantId: converted.definitionId };
    expect(converted.definitionId).toBe(g23RadiantDefinitionId(prior.optionId));
    const fact = radiantState.resourceProvenance.entries.find(f => f.kind === 'g23-item-converted' && f.itemId === prior.itemId);
    expect(fact).toMatchObject({ from: prior.optionId, to: converted.definitionId, roundId: '4-3', receiptId: 'g23:conqueror:15' });
  });

  const edits: { name: string; edit: (s: any) => void }[] = [
    { name: 'missing conversion', edit: s => { s.resourceProvenance.entries = s.resourceProvenance.entries.filter((f: any) => f.kind !== 'g23-item-converted' || f.itemId !== reward.itemId); } },
    { name: 'wrong source definition', edit: s => { s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId).from = reward.optionId === 'warmog' ? 'shojin' : 'warmog'; } },
    { name: 'wrong chest receipt', edit: s => { s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId).receiptId = 'g23:conqueror:14'; } },
    { name: 'wrong sequence', edit: s => { s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId).sequence++; } },
    { name: 'wrong round', edit: s => { s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId).roundId = '1-2'; } },
    { name: 'wrong item identity', edit: s => { s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId).itemId = 'forged-item'; } },
    { name: 'conversion before birth', edit: s => { const entries = s.resourceProvenance.entries;
      const from = entries.findIndex((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId);
      const birth = entries.findIndex((f: any) => f.kind === 'item-acquired' && f.itemId === reward.itemId);
      entries.splice(birth, 0, entries.splice(from, 1)[0]); entries.forEach((f: any, i: number) => { f.sequence = i; }); } },
    { name: 'conversion after consumption', edit: s => { const entries = s.resourceProvenance.entries;
      const index = entries.findIndex((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId);
      entries.splice(index, 0, { kind: 'item-combined', roundId: '4-3', sequence: index,
        event: { type: 'itemCombined', consumedIds: [reward.itemId, 'other-item'], itemId: 'item-forged', definitionId: 'warmog' } });
      entries.forEach((f: any, i: number) => { f.sequence = i; }); } },
    { name: 'wrong target mapping', edit: s => { const f = s.resourceProvenance.entries.find((f: any) => f.kind === 'g23-item-converted' && f.itemId === reward.itemId);
      f.to = f.to === 'TFT5_Item_WarmogsArmorRadiant' ? 'TFT5_Item_SpearOfShojinRadiant' : 'TFT5_Item_WarmogsArmorRadiant';
      s.items.find((i: any) => i.id === reward.itemId).definitionId = f.to; } },
    { name: 'forged unlock', edit: s => { s.seatMechanics.seat.radiantConversion = false; } },
  ];
  const boundaries = [
    { name: 'shared-orb', restore: (input: unknown, auth: ReturnType<typeof captureAugmentHistoryAuthority>) => restoreSharedOrbSnapshot(room.state.pool, input, auth) },
    { name: 'carousel', restore: (input: unknown, auth: ReturnType<typeof captureAugmentHistoryAuthority>) => restoreCarouselSeat(room.state.carousel!.state, input, auth) },
  ];
  if (carousel) for (const { name, restore } of boundaries) {
    it(`${name} restores the legal radiant conversion`, () => {
      const authority = captureAugmentHistoryAuthority(radiantState);
      for (const input of [radiantState, JSON.stringify(radiantState), canonicalContent(radiantState)])
        expect(restore(input, authority)).toEqual(radiantState);
    });
    for (const { name: forgery, edit } of edits) it(`${name} rejects ${forgery}`, () => {
      const bad = structuredClone(radiantState); edit(bad);
      const authority = captureAugmentHistoryAuthority(bad);
      for (const input of [bad, JSON.stringify(bad), canonicalContent(bad)])
        expect(() => restore(input, authority)).toThrow('Invalid tomb raider authority');
    });
    it(`${name} rejects a correct mapping without the chest-15 unlock`, () => {
      const noUnlock: MatchState = structuredClone(mine().match);
      const fakeItem = noUnlock.items.find(i => i.id === reward.itemId)!;
      const fake = { ...noUnlock, items: noUnlock.items.map(i => i.id === reward.itemId
        ? { ...i, definitionId: reward.radiantId } : i),
      resourceProvenance: appendResourceProvenance(noUnlock.resourceProvenance, noUnlock.roundDefinitionId,
        { kind: 'g23-item-converted', itemId: fakeItem.id, from: reward.optionId, to: reward.radiantId, receiptId: 'g23:conqueror:15' }) };
      const authority = captureAugmentHistoryAuthority(fake);
      for (const input of [fake, JSON.stringify(fake), canonicalContent(fake)])
        expect(() => restore(input, authority)).toThrow('Invalid tomb raider authority');
    });
  }

  if (id === 'tomb-raider-2') it('round trips its earned items and history through the real shared-carousel restore boundary', () => {
    expect(room.state.phase).toBe('carousel');
    const carousel = room.state.carousel!.state, state = mine().match, authority = room.augmentHistoryAuthority(ownerId);
    for (const input of [state, JSON.stringify(state), canonicalContent(state)]) expect(restoreCarouselSeat(carousel, input, authority)).toEqual(state);
    const bad: any = structuredClone(state);
    bad.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE).optionId = 'TFT4_Item_OrnnInfinityForce';
    for (const input of [bad, JSON.stringify(bad), canonicalContent(bad)]) expect(() => restoreCarouselSeat(carousel, input, authority)).toThrow();
    expect(room.state.fault).toBeNull();
  });
});

describe('tomb raider bot seat grants one receipt after one elimination', () => {
  const clock = new ManualClock(), resolver = new RankedEliminationResolver();
  const room = new Room(Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `机器人${index}`, kind: 'bot' as const })),
    { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, seed: 1, roomId: 'tomb-bot-room', clock, resolver, pvpMode: 'placeholder' });
  let ownerId = '';
  const mine = () => room.state.seats.find(s => s.seatId === ownerId)!;
  const components = ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'];
  beforeAll(() => room.start());
  afterAll(() => room.dispose());
  function claim() {
    if (room.state.phase !== 'preparation') return;
    for (const seat of room.state.seats) {
      const current = room.state.seats.find(s => s.seatId === seat.seatId)!;
      if (!current.alive || current.match.phase !== 'preparation') continue;
      expect(room.claimBotOrbs(current.seatId, current.controlEpoch), current.seatId).toMatchObject({ ok: true });
    }
  }
  function answer() {
    for (const seat of room.state.seats) for (let n = 0; n < 16; n++) {
      const current = room.state.seats.find(s => s.seatId === seat.seatId)!;
      const c = current.match.pendingChoice;
      if (!c) break;
      const option = c.kind === 'augment'
        ? c.offers.find(offer => !augmentNeedsHistory(offer) && !['dummify', 'golemify'].includes(offer)) ?? c.offers[0]
        : choiceTimeoutOption(c)!;
      expect(room.handleBot(current.seatId, current.controlEpoch, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: option })).toMatchObject({ ok: true });
    }
  }
  function reach(round: string) {
    for (let fired = 0; fired < 5000; fired++) {
      claim();
      if (room.state.roundId === round && ['preparation', 'choice', 'carousel'].includes(room.state.phase)) return;
      if (room.state.fault || room.state.phase === 'ended') break;
      if (room.state.phase === 'preparation') answer();
      if (!clock.runNext()) break;
    }
    throw new Error(`did not reach ${round}: ${room.state.roundId}/${room.state.phase}, ${JSON.stringify(room.state.fault)}`);
  }
  for (const round of ['1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7',
    '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '4-1', '4-2']) it(`reaches ${round} through the bot room`, () => {
    reach(round); expect(room.state.fault).toBeNull();
  });

  it('selects the tomb choice once after one elimination and keeps a single receipt', () => {
    for (const seat of room.state.seats) {
      if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes('tomb-raider-1'))) break;
      for (let slot = 0; slot < 3; slot++) {
        const current = room.state.seats.find(s => s.seatId === seat.seatId)!;
        const c = current.match.pendingChoice!;
        expect(room.handleBot(current.seatId, current.controlEpoch, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
        if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes('tomb-raider-1'))) break;
      }
    }
    const owner = room.state.seats.find(s => s.match.pendingChoice?.offers.includes('tomb-raider-1'));
    expect(owner).toBeDefined();
    if (!owner) throw new Error('no tomb-raider-1 bot offer');
    ownerId = owner.seatId;
    const offered = owner.match.pendingChoice!;
    expect(room.handleBot(ownerId, owner.controlEpoch, { type: 'choose', choiceId: offered.choiceId, generation: offered.generation, definitionId: 'tomb-raider-1' })).toMatchObject({ ok: true });
    answer();
    expect(mine().match.augmentHistory?.facts.some(f => f.kind === 'table' && f.stage === 'acquire' && f.seats.length === 8)).toBe(true);
    const victim = room.state.seats.find(s => s.seatId !== ownerId && s.match.items.filter(i => i.location.kind === 'inventory' && components.includes(i.definitionId)).length >= 2);
    expect(victim).toBeDefined();
    if (!victim) throw new Error('no equipped elimination candidate');
    const seat = () => room.state.seats.find(s => s.seatId === victim.seatId)!;
    const held = seat().match.items.filter(i => i.location.kind === 'inventory' && components.includes(i.definitionId));
    const previousIds = new Set(seat().match.items.map(i => i.id));
    expect(room.handleBot(victim.seatId, seat().controlEpoch, { type: 'combine', a: held[0].id, b: held[1].id })).toMatchObject({ ok: true });
    const completed = seat().match.items.filter(i => !previousIds.has(i.id) && i.location.kind === 'inventory' && ITEM_DEFINITIONS[i.definitionId].kind === 'completed');
    expect(completed.length).toBeGreaterThan(0);
    const unit = seat().match.preparation.units.find(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon
      && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral')!;
    expect(room.handleBot(victim.seatId, seat().controlEpoch, { type: 'equip', itemId: completed[0].id, unitId: unit.id, slot: 0 })).toMatchObject({ ok: true });
    const holder = room as unknown as { current: RoomState };
    holder.current = { ...holder.current, seats: holder.current.seats.map(s => s.seatId === victim.seatId
      ? { ...s, hp: 1, match: { ...s.match, playerHp: 1 }, seatRevision: s.seatRevision + 1 } : s) };
    resolver.losers.add(victim.seatId);
    runUntil(room, clock, s => s.roundId === '4-2' && s.phase === 'choice'
      && mine().match.pendingChoice?.payload?.source === TOMB_RAIDER_SOURCE);
    expect(room.state.fault).toBeNull();
    const live = mine(), choice = live.match.pendingChoice!;
    expect(choice.offers.length).toBeGreaterThan(0);
    const decision = decideBotAction(live.match, { difficulty: 'basic', stepsTaken: 0, maxSteps: 8,
      self: { seatId: ownerId, hp: live.match.playerHp, round: live.match.round } }, 1);
    expect(decision.action).toMatchObject({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation });
    if (decision.action === 'done' || decision.action.type !== 'choose') throw new Error('bot did not select the tomb choice');
    expect(choice.offers).toContain(decision.action.definitionId);
    expect(room.handleBot(ownerId, live.controlEpoch, { type: 'choose', choiceId: decision.action.choiceId, generation: decision.action.generation, definitionId: decision.action.definitionId })).toMatchObject({ ok: true });
    expect(room.state.fault).toBeNull();
    const receipts = mine().match.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE) ?? [];
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ optionId: decision.action.definitionId });
    expect(mine().match.pendingChoice).toBeNull();
    const before = room.state, committed = mine().match;
    const facts = committed.augmentHistory!.facts.filter(f => !(f.kind === 'table' && f.stage === 'acquire'))
      .map((fact, sequence) => ({ ...fact, sequence }));
    const stripped = { ...mine(), match: { ...committed, augmentHistory: { ...committed.augmentHistory!, facts } } };
    expect(() => recordRoomPublication(before, { ...before, seats: before.seats.map(s => s.seatId === ownerId ? stripped : s) })).toThrow('Invalid tomb raider acquisition table');
    expect(room.state.fault).toBeNull();
  });

  it('faults the room (invalid-results) when replace publication lacks the tomb acquisition table', () => {
    expect(mine().match.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(1);
    const before = room.state, committed = mine().match;
    const facts = committed.augmentHistory!.facts.filter(f => !(f.kind === 'table' && f.stage === 'acquire'))
      .map((fact, sequence) => ({ ...fact, sequence }));
    const stripped = { ...mine(), match: { ...committed, augmentHistory: { ...committed.augmentHistory!, facts } } };
    const holder = room as unknown as { current: RoomState; replace(next: RoomState): void };
    holder.replace({ ...before, seats: before.seats.map(s => s.seatId === ownerId ? stripped : s) });
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toEqual({ kind: 'invalid-results', detail: 'Invalid tomb raider acquisition table' });
  });
});
