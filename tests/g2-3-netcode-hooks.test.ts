import { describe, expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, forfeitPendingChoice, selectChoice, toPrivateSeatView, type MatchState } from '../src/server-entry';
import { decideBotAction } from '../src/simulation/bot';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { g23JunkerMenu } from '../src/simulation/g2-3-junker';
import { getRoundSchedule } from '../src/simulation/round-schedule';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { stepCombat } from '../src/simulation/combat';
import { applyCombatReplayTick, toCombatViewEvents, toCombatViewState, type CombatViewEvent } from '../src/simulation/combat-replay-view';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { assertSharedPoolConservation, runSharedMatchCommand } from '../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import { CHOICE_SKIP_OPTION, alignReplayUnits, grantMechanicGold, grantMechanicItem, grantMechanicUnit, openMechanicChoice,
  readSeatMechanic, removeCombatUnit, resolveUnitForm, spawnCombatUnit, writeHiddenMechanic, writeSeatMechanic,
  type MechanicChoiceSpec } from '../src/simulation/seat-mechanics';
import { battle, freeze, unit } from './combat-helpers';
import { room } from './tp-helpers';
import { publicPendingArmory } from './fixtures/g2-3-armory-public';

const ok = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  if (!result.ok) throw new Error((result as unknown as { reason: string }).reason);
  return result as Extract<T, { ok: true }>;
};
/** A non-supply round whose schedule is empty, so returning from a mechanic choice opens nothing else. */
const quietRound = ROUND_CATALOG.find(round => round.kind !== 'supply' && getRoundSchedule(round.ordinal).length === 0)!;
function atQuietRound(base: MatchState): MatchState {
  const round = getCatalogRoundById(quietRound.roundId);
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, phase: 'preparation', combat: null, pendingChoice: null,
    m8: { ...base.m8, round, preparation: { ...base.m8.preparation, roundId: round.roundId, encounterId: null, enemies: [] } } } as MatchState;
}
const solo = () => atQuietRound(createMatch(7));
const online = () => atQuietRound(ok(enableMultiplayerSettlement(createMatch(7), 'A')).state);
const armory = (choiceId = 'armory-1'): MechanicChoiceSpec => ({ choiceId, offers: ['micro-bots', 'spare-parts'], returnPhase: 'preparation',
  payload: { kind: 'armory', source: 'junker-king', prices: { 'micro-bots': 5, 'spare-parts': 0 }, timeoutOption: 'spare-parts' } });
const blackMarket = (skippable: boolean): MechanicChoiceSpec => ({ choiceId: 'market-1', offers: ['sword', 'rod', 'belt'], returnPhase: 'preparation',
  payload: { kind: 'blackMarket', source: 'alchemist', skippable, skipReward: skippable ? { kind: 'maxHp', amount: 40 } : null,
    timeoutOption: skippable ? CHOICE_SKIP_OPTION : 'sword' } });

describe('G2-3 seat mechanic container', () => {
  it('reaches the private view and the display state verbatim; hidden state never does', () => {
    // The real conqueror container always carries its reward bundles; v22 anvil
    // orbs make the private loot view read them, so keep the (empty) list.
    let state = writeSeatMechanic(solo(), 'conqueror', { stacks: 640, chestsOpened: 9, nextThreshold: 650, bonusBps: 4500, rewards: [] });
    state = writeSeatMechanic(state, 'radiantConversion', true);
    state = writeHiddenMechanic(state, 'alchemist', { rng: 123456 });
    const view = toPrivateSeatView(freeze(state));
    expect(view.seatMechanics?.seat).toMatchObject({ conqueror: { stacks: 640, chestsOpened: 9, nextThreshold: 650, bonusBps: 4500, rewards: [] }, radiantConversion: true });
    expect(view.seatMechanics?.hidden).toEqual({});
    expect(JSON.stringify(view)).not.toContain('123456');
    const display = toDisplayMatch(view as never);
    expect(readSeatMechanic(display, 'conqueror')).toEqual({ stacks: 640, chestsOpened: 9, nextThreshold: 650, bonusBps: 4500, rewards: [] });
    expect(readSeatMechanic(display, 'radiantConversion')).toBe(true);
  });
  it('is present in G2-3 states and views, and rejects non-integer values', () => {
    const view = toPrivateSeatView(solo());
    expect('seatMechanics' in view).toBe(true);
    expect(view.seatMechanics?.hidden).toEqual({});
    expect(() => writeSeatMechanic(solo(), 'conqueror', { stacks: 0.5 })).toThrow(RangeError);
  });
  it('pays mechanic gold once per receipt and records its source', () => {
    const paid = ok(grantMechanicGold(solo(), { receiptId: 'high-roller:round-12:cast-3', source: 'high-roller', amount: 3 }));
    expect(paid.state.gold).toBe(solo().gold + 3);
    expect(toPrivateSeatView(paid.state).seatMechanics?.receipts).toEqual([expect.objectContaining({ kind: 'gold', source: 'high-roller', amount: 3 })]);
    expect(grantMechanicGold(paid.state, { receiptId: 'high-roller:round-12:cast-3', source: 'high-roller', amount: 3 }))
      .toMatchObject({ ok: false, reason: 'duplicate-mechanic-receipt', state: paid.state });
  });
});

describe('G2-3 mechanic choices', () => {
  it('armory opens like an augment, charges the chosen price, and continues to preparation', () => {
    const opened = ok(openMechanicChoice({ ...solo(), gold: 7 }, armory()));
    expect(opened.state.phase).toBe('choice');
    expect(toPrivateSeatView(opened.state).pendingChoice).toMatchObject({ kind: 'armory', offers: ['micro-bots', 'spare-parts'],
      payload: { prices: { 'micro-bots': 5, 'spare-parts': 0 }, timeoutOption: 'spare-parts' } });
    const bought = ok(selectChoice(opened.state, 'armory-1', 0, 'micro-bots'));
    expect(bought.state.gold).toBe(2);
    expect(bought.state.phase).toBe('preparation');
    expect(bought.state.seatMechanics?.receipts.at(-1)).toMatchObject({ kind: 'choice', choiceKind: 'armory', optionId: 'micro-bots', price: 5, timedOut: false });
    expect(selectChoice({ ...opened.state, gold: 4 }, 'armory-1', 0, 'micro-bots')).toMatchObject({ ok: false, reason: 'insufficient-gold' });
  });
  it('a paid armory option cannot be the timeout default', () => {
    const spec = armory();
    expect(openMechanicChoice(solo(), { ...spec, payload: { ...spec.payload, timeoutOption: 'micro-bots' } as never }))
      .toMatchObject({ ok: false, reason: 'invalid-mechanic-state' });
  });
  it('timeout resolves forge, black market and armory with the free default and never stalls', () => {
    const forge: MechanicChoiceSpec = { choiceId: 'forge-1', offers: ['bloodthirster', 'warmog'], returnPhase: 'preparation',
      payload: { kind: 'forge', source: 'conqueror-chest', timeoutOption: 'bloodthirster' } };
    for (const spec of [forge, blackMarket(true), armory()]) {
      const opened = ok(openMechanicChoice(online(), spec)).state;
      const timedOut = ok(forfeitPendingChoice(opened, opened.round, spec.choiceId, 0));
      expect(timedOut.state.phase).toBe('preparation');
      expect(timedOut.state.gold).toBe(opened.gold);
      expect(timedOut.events.at(-1)).toMatchObject({ type: 'choiceTimedOut', choiceId: spec.choiceId, resolution: 'default-option' });
      expect(timedOut.state.seatMechanics?.receipts.at(-1)).toMatchObject({ receiptId: spec.choiceId, optionId: spec.payload.timeoutOption, timedOut: true });
    }
  });
  it('the basic bot answers new kinds with the timeout default', () => {
    const opened = ok(openMechanicChoice(online(), blackMarket(false))).state;
    const decision = decideBotAction(opened, { difficulty: 'basic', stepsTaken: 0, maxSteps: 64,
      self: { seatId: 'A', hp: opened.playerHp, round: opened.round } }, 1);
    expect(decision.action).toEqual({ type: 'choose', choiceId: 'market-1', generation: 0, definitionId: 'sword' });
  });
  it('choose skip: skippable black market grants nothing, records skipped; otherwise refused', () => {
    const opened = ok(openMechanicChoice(solo(), blackMarket(true))).state;
    const skipped = ok(selectChoice(opened, 'market-1', 0, CHOICE_SKIP_OPTION));
    expect(skipped.state.items).toEqual(opened.items);
    expect(skipped.state.seatMechanics?.receipts.at(-1)).toMatchObject({ choiceKind: 'blackMarket', skipped: true, itemId: null });
    const picked = ok(selectChoice(opened, 'market-1', 0, 'rod'));
    expect(picked.state.items.filter(item => item.definitionId === 'rod')).toHaveLength(opened.items.filter(item => item.definitionId === 'rod').length + 1);
    const strict = ok(openMechanicChoice(solo(), blackMarket(false))).state;
    expect(selectChoice(strict, 'market-1', 0, CHOICE_SKIP_OPTION)).toMatchObject({ ok: false, reason: 'choice-not-skippable', state: strict });
  });
  it('an offline save with a pending mechanic choice restores', async () => {
    // Buy Rumble from the shop and complete three real battles; Match opens the armory.
    const state = await publicPendingArmory(), progress = readG23Progress(state)!;
    const choice = state.pendingChoice!, menu = g23JunkerMenu(state)!;
    expect(state.multiplayer).toBeUndefined();
    expect(state.phase).toBe('choice');
    expect(progress.junkerRounds).toBe(3);
    expect(progress.economyReceipts.filter(r => r.kind === 'battle' && r.facts.rumbleStar > 0)).toHaveLength(3);
    expect(progress.junkerPurchases).toEqual([]);
    expect(state.preparation.units.find(u => u.id === menu.unitId)).toMatchObject({ definitionId: 'rumble', team: 'player', location: { kind: 'board' } });
    expect(choice).toMatchObject({ kind: 'armory', choiceId: 'g23:junker:1', eventId: menu.id, offers: menu.choices,
      returnPhase: 'preparation', payload: { kind: 'armory', source: 'junker-king' } });
    expect(restoreMatch(JSON.stringify(state)).pendingChoice).toEqual(choice);
    const save = serializeMatch(state);
    for (const input of [state, JSON.parse(save), save]) expect(restoreMatch(input)).toEqual(state);
    // A renamed G23 window still needs its real authority, regardless of ID prefix.
    const renamed = { ...state, pendingChoice: { ...choice, choiceId: 'armory-1', eventId: 'armory-1' } };
    for (const input of [renamed, JSON.stringify(renamed)]) expect(() => restoreMatch(input)).toThrow('G23 pending choice authority');
    expect(() => serializeMatch(renamed)).toThrow('G23 pending choice authority');
    // 临时、用户 10-20 批准：只因 CI 机器计时超时或贴着上限（断言都过），按约 2 倍放宽；断言不变。20 秒 → 40 秒（#343 上超时，本机满负载约 13 秒）。
  }, 40_000);
});

describe('G2-3 unit grants through the shared pool', () => {
  it('a mechanic hero consumes one pool copy; an empty pool pays its cost in gold', () => {
    const { pool, states } = room({ irelia: 3, maddie: 1 }, 1);
    const state = states[0];
    const granted = ok(grantMechanicUnit(state, { receiptId: 'chest-1', source: 'conqueror-chest', definitionId: 'maddie' }));
    expect(granted.receipt).toMatchObject({ kind: 'unit', resolution: 'orb', gold:0 });
    expect(pool.available.maddie).toBe(1);expect(granted.state.preparation).toBe(state.preparation);
    if(granted.receipt.kind!=='unit')throw Error('unit');
    const first=ok(runSharedMatchCommand(pool,granted.state,{type:'claimOrb',round:1,orbId:granted.receipt.orbId!}));
    expect(first.pool.available.maddie).toBe(0);
    const unitId=first.state.m8.loot.receipts.at(-1)!.grantedUnitIds[0];
    expect(first.pool.holdings.some(h => h.unitId === unitId && h.definitionId === 'maddie')).toBe(true);
    assertSharedPoolConservation(first.pool, [first.state]);
    const again = ok(grantMechanicUnit(first.state, { receiptId: 'chest-2', source: 'conqueror-chest', definitionId: 'maddie' }));
    expect(again.receipt).toMatchObject({ kind: 'unit', resolution: 'orb', gold:0 });
    if(again.receipt.kind!=='unit')throw Error('unit');
    const second=ok(runSharedMatchCommand(first.pool,again.state,{type:'claimOrb',round:1,orbId:again.receipt.orbId!}));
    expect(second.state.m8.loot.receipts.at(-1)).toMatchObject({resolution:'gold',gold:UNIT_DEFINITIONS.maddie.cost});
    expect(second.state.gold).toBe(first.state.gold + UNIT_DEFINITIONS.maddie.cost);
    assertSharedPoolConservation(second.pool,[second.state]);
  });
  it('offline item grants land in inventory with mechanic provenance', () => {
    const granted = ok(grantMechanicItem(solo(), { receiptId: 'academy-3', source: 'academy', definitionId: 'warmog' }));
    expect(granted.state.items.at(-1)).toMatchObject({ definitionId: 'warmog', location: { kind: 'inventory' } });
    expect(granted.state.resourceProvenance.entries.at(-1)).toMatchObject({ kind: 'item-acquired', source: { kind: 'mechanic', receiptId: 'academy-3' } });
  });
});

describe('G2-3 forms', () => {
  it('front two rows melee, back two ranged, bench and plain heroes none', () => {
    const swapper = { formSwap: true as const };
    expect([4, 5, 6, 7].map(row => resolveUnitForm(swapper, 'player', { kind: 'board', cell: { col: 2, row } })))
      .toEqual(['melee', 'melee', 'ranged', 'ranged']);
    expect([3, 2, 1, 0].map(row => resolveUnitForm(swapper, 'enemy', { kind: 'board', cell: { col: 2, row } })))
      .toEqual(['melee', 'melee', 'ranged', 'ranged']);
    expect(resolveUnitForm(swapper, 'player', { kind: 'bench', slot: 0 })).toBeNull();
    expect(resolveUnitForm({}, 'player', { kind: 'board', cell: { col: 2, row: 4 } })).toBeNull();
    expect(toPrivateSeatView(solo()).preparation.units.every(unit => !('form' in unit))).toBe(true);
  });
});

describe('G2-3 replay membership', () => {
  const start = () => battle([unit('a', 'player', 1, 4), unit('b', 'enemy', 1, 3)]);
  it('a unit spawned mid-combat appears on the very tick it enters, and leaves when removed', () => {
    const initial = start(), next = stepCombat(initial).state;
    const spawned = spawnCombatUnit(next, unit('barrel-1', 'player', 5, 6), { ownerId: 'a', sourceKind: 'ability', definitionId: 'gangplank', instanceId: 'a', effectIndex: 0 }, next.tick);
    expect(spawned.events).toEqual([expect.objectContaining({ type: 'unitSpawned', unitId: 'barrel-1', cell: { col: 5, row: 6 } })]);
    const before = toCombatViewState(initial), after = toCombatViewState(spawned.state), events: CombatViewEvent[] = [];
    alignReplayUnits(before.units, after.units, events);
    expect(events).toEqual([{ type: 'unitEntered', unit: after.units[2] }]);
    const shown = applyCombatReplayTick(before, { tick: after.tick, events });
    expect(shown.units.map(u => u.id)).toEqual(['a', 'b', 'barrel-1']);
    const removed = removeCombatUnit(spawned.state, 'barrel-1', 'detonated', after.tick + 1), leftEvents: CombatViewEvent[] = [];
    alignReplayUnits(after.units, toCombatViewState(removed.state).units, leftEvents);
    expect(leftEvents).toEqual([{ type: 'unitLeft', unitId: 'barrel-1' }]);
    expect(applyCombatReplayTick(shown, { tick: after.tick + 1, events: leftEvents }).units.map(u => u.id)).toEqual(['a', 'b']);
    expect(() => spawnCombatUnit(next, unit('c', 'player', 1, 4), { ownerId: 'a', sourceKind: 'ability', definitionId: 'x', instanceId: 'a', effectIndex: 0 }, 1)).toThrow('Spawn cell');
  });
  it('spawn, cast outcome and binding facts pass the animation whitelist', () => {
    const envelope = { domain: 'combat' as const, combatId: 'c', tick: 4 };
    const ledger = [
      { ...envelope, eventSeq: 0, type: 'unitSpawned', unitId: 'm', definitionId: 'silco-monster', team: 'player', cell: { col: 1, row: 5 },
        source: { ownerId: 'silco', sourceKind: 'ability', definitionId: 'silco', instanceId: 'silco', effectIndex: 0 } },
      { ...envelope, eventSeq: 1, type: 'castOutcome', unitId: 'sevika', abilityKey: 'high-roller', outcome: 'triple', subOutcomes: ['rocket', 'gold', 'shield'] },
      { ...envelope, eventSeq: 2, type: 'bindingChanged', unitId: 'sion', bound: false, reason: 'casts' },
      { ...envelope, eventSeq: 3, type: 'unitRemoved', unitId: 'm', reason: 'expired' },
    ] as unknown as LedgerCombatEvent[];
    expect(toCombatViewEvents(ledger).map(e => e.type)).toEqual(['unitSpawned', 'castOutcome', 'bindingChanged', 'unitRemoved']);
    expect(toCombatViewEvents(ledger)[0]).toMatchObject({ sourceId: 'silco', cell: { col: 1, row: 5 } });
  });
});
