import { advanceAugmentPreparationTime } from '../src/simulation/augment-history';
import {G23_ANOMALY_SOURCE as ANOMALY_SOURCE} from '../src/simulation/content/g2-3-anomaly-source';
import { S13_P2_SOURCE } from '../src/simulation/content/s13-augments-p2-source';
import { P4_SOURCE } from '../src/simulation/anomalies/source';
import { COST } from './fixtures/m5/oracle.g2.cjs';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, purchasedThreeHeroMatch, finish } from './match-helpers';
import { describeEffect, describeTraitTier } from '../src/rendering/strategy-panel';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { run } from '../scripts/generate-m5-route.cjs';
import type { MatchState } from '../src/simulation/match-types';
import { historyFreeRerollPriorities } from './fixtures/history-free-augments';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { traceAnomalyCommand } from '../src/simulation/anomaly-history';
let before19: MatchState, anomaly: MatchState, quoted: MatchState;
let cannonRoute: Promise<{ before19: MatchState; anomaly: MatchState }> | undefined;
function loadCannonRoute() {
  // One public cannon route per worker. Each suite warms only the replay prefix its own cases restore.
  cannonRoute ??= (async () => {
    const route = await run(api, { build: 'cannon', seed: 25, retainStates: true, augmentRerollPriorities: historyFreeRerollPriorities });
    return {
      before19: (route.actions.find((a: any) => a.round === getCatalogRoundById('4-5').ordinal && a.command.type === 'start') as any).before as MatchState,
      anomaly: (route.actions.find((a: any) => a.round === getCatalogRoundById('4-6').ordinal && a.command.type === 'target') as any).before as MatchState,
    };
  })();
  return cannonRoute;
}

describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling', () => {
beforeAll(async () => {
  // Public rerolls keep recovery saves independent of battle history; seed 25 also avoids prismatic 4-2 Max Cap history.
  ({ before19, anomaly } = await loadCannonRoute());
  // Cold solo-history replay of this cannon route is about 7.5s, past the 5s case.
  // Admit the 4-5 prefix from a clone so the restore trace is not installed on the live checkpoint.
  expect(restoreMatch(structuredClone(before19))).toEqual(before19);
}, 120000);

  it.each([false, true])('sells the real 4-5 roster, recruits at4-6 and completes once (exhausted lock=%s)', exhausted => {
    let s = before19;
    for (const unit of s.preparation.units.filter(u => u.team === 'player')) s = accepted(api.sellUnit(s, unit.id));
    if (exhausted) for (let slot = 0; slot < s.shop.slots.length; slot++) {
      if (s.shop.slots[slot].status !== 'available') continue;
      s = accepted(api.buyUnit(s, slot, s.shop.generation));
      for (const unit of s.preparation.units.filter(u => u.team === 'player')) s = accepted(api.sellUnit(s, unit.id));
    }
    s = accepted(api.setShopLock(s, true, s.shop.generation));
    s = finish(accepted(api.startMatchCombat(s)));
    expect(s.playerHp).toBeGreaterThan(0);
    const previousShop = s.shop, previousRandom = s.rngState;
    s = accepted(api.nextRound(s, getCatalogRoundById('4-5').ordinal));
    if (exhausted) {
      expect(s.shop.generation).toBe(previousShop.generation + 1); expect(s.shop.locked).toBe(false);
      let word = BigInt(previousRandom); for (let i = 0; i < 10; i++) word = (word * 1664525n + 1013904223n) % 4294967296n;
      expect(s.rngState).toBe(Number(word));
    } else { expect(s.shop).toEqual(previousShop); expect(s.rngState).toBe(previousRandom); }
    expect(s.phase).toBe('preparation'); expect(api.needsAnomalyRecruitment(s)).toBe(true);
    expect(s.pendingChoice).toBeNull(); expect(restoreMatch(s)).toEqual(s);
    expect(() => restoreMatch({ ...s, phase: 'choice', pendingChoice: anomaly.pendingChoice })).toThrow('target substate');
    expect(api.startMatchCombat(s)).toEqual({ ok: false, state: s, reason: 'missing-player' });
    const slot = s.shop.slots.findIndex(o => o.status === 'available');
    const before = s, result = api.buyUnit(s, slot, s.shop.generation); s = accepted(result);
    expect(s.pendingChoice?.step).toBe('target'); expect(s.nextUnitSerial).toBe(before.nextUnitSerial + 1);
    expect(result.ok && result.events.filter(e => e.type === 'choiceOpened')).toHaveLength(1);
    expect(api.buyUnit(s, slot, s.shop.generation).state).toBe(s);
    expect(api.nextRound(s, getCatalogRoundById('4-5').ordinal).state).toBe(s); expect(restoreMatch(s)).toEqual(s);
    const c = s.pendingChoice!, target = s.preparation.units.find(u => u.team === 'player')!;
    s = accepted(api.selectAnomalyTarget(s, c.choiceId, c.generation, target.id));
    const offer = s.pendingChoice!; s = accepted(api.selectChoice(s, offer.choiceId, offer.generation, offer.offers[0]));
    expect(s.phase).toBe('preparation'); expect(s.scheduleReceipts.filter(r => r.kind === 'anomaly')).toHaveLength(1);
    expect(restoreMatch(s)).toEqual(s);
    expect(api.selectChoice(s, offer.choiceId, offer.generation, offer.offers[0]).state).toBe(s);
    s = accepted(api.deployMatchUnit(s, target.id, { kind: 'board', cell: { col: 1, row: 4 } }));
    expect(api.startMatchCombat(s).ok).toBe(true);
    const emptyAfterConfirmation = accepted(api.sellUnit(s, target.id));
    expect(api.needsAnomalyRecruitment(emptyAfterConfirmation)).toBe(false);
    expect(restoreMatch(emptyAfterConfirmation)).toEqual(emptyAfterConfirmation);
    expect(api.startMatchCombat(emptyAfterConfirmation).ok).toBe(true);
  });
  it('preserves an affordable recruitment offer when repeated D/F exhaust discretionary gold', () => {
    let s = before19;
    for (const u of s.preparation.units.filter(u => u.team === 'player')) s = accepted(api.sellUnit(s, u.id));
    s = accepted(api.nextRound(finish(accepted(api.startMatchCombat(s))), getCatalogRoundById('4-5').ordinal));
    for (let n = 0; n < 100; n++) { const r = api.rerollShop(s); if (!r.ok) { expect(r.state).toBe(s); break; } s = r.state; }
    for (let n = 0; n < 100; n++) { const r = api.buyXp(s); if (!r.ok) { expect(r.state).toBe(s); break; } s = r.state; }
    const slot = s.shop.slots.findIndex(o => o.status === 'available' &&
      // Frozen independent G2-2 catalog, including all new tiers.
      COST[o.definitionId] <= s.gold);
    expect(slot).toBeGreaterThanOrEqual(0); expect(api.buyUnit(s, slot, s.shop.generation).ok).toBe(true);
  });
  it.each([0, 1, 42, 0xffffffff])('maps one complete random word at each draw and revisits all offers, seed %i', seed => {
    let s = { ...anomaly, choiceRngState: seed, gold: 500 } as MatchState;
    const c = s.pendingChoice!, target = s.preparation.units.find(u => u.team === 'player')!;
    let word = (BigInt(seed) * 1664525n + 1013904223n) % 4294967296n;
    s = accepted(api.selectAnomalyTarget(s, c.choiceId, c.generation, target.id));
    // Independently include the anomaly rows (the rows without an augment tier).
    const ids = [...Object.keys(ANOMALY_SOURCE), ...Object.values(P4_SOURCE).map(d => d.id), ...Object.entries(S13_P2_SOURCE)
      .filter(([, source]) => !('tier' in source)).map(([id]) => id),
      // P1 and P3 anomaly literals, independent from production registration.
      'dual-wielding', 'the-finisher', 'touch-of-frost', 'fireball', 'dragonsoul', 'nothing-wasted', 'thornskin', 'knockout',
      // D11 identities from the retained source, not the production registry.
      'avarice-incarnate', 'headhunter',
      // D14 literals and target policy, independent of the production helper.
      ...(target.location.kind==='board'?['into-the-unknown',...(COST[target.definitionId]===1&&target.starLevel===3?['ultimate-hero']:[])]:[])].sort();
    expect(ids).toHaveLength(54+(target.location.kind==='board'?1+(COST[target.definitionId]===1&&target.starLevel===3?1:0):0));
    expect(s.pendingChoice!.offers[0]).toBe(ids[Number(word * BigInt(ids.length) / 4294967296n)]);
    const seen = new Set(s.pendingChoice!.offers);
    for (let i = 0; i < 400; i++) {
      const previous = s.pendingChoice!.offers[0], history = api.readAnomalyOfferHistory(s),
        excluded = history.length < 12 ? history : [previous], pool = ids.filter(id => !excluded.includes(id)), before = s;
      word = (word * 1664525n + 1013904223n) % 4294967296n;
      const pending = s.pendingChoice!; s = accepted(api.rerollAnomaly(s, pending.choiceId, pending.generation));
      expect(s.choiceRngState).toBe(Number(word)); expect(s.pendingChoice!.offers[0]).toBe(pool[Number(word * BigInt(pool.length) / 4294967296n)]);
      expect(s.gold).toBe(before.gold - 1); seen.add(s.pendingChoice!.offers[0]);
    }
    expect([...seen].sort()).toEqual(ids);
  });
});

describe('M5 audit: sealed anomaly quote history', () => {
  beforeAll(async () => {
    const { anomaly: start } = await loadCannonRoute();
    quoted = openQuotedAnomaly(start);
    // This suite's own cold replay. Roster restores live in another suite and cannot run between this hook and the case below.
    expect(restoreMatch(serializeMatch(structuredClone(quoted)))).toEqual(quoted);
  }, 120000);

  it('v26 authenticates quote history through object/JSON/text restore and exact continuation', () => {
    // Target selection, the 13 rerolls, the gold and history-length checks, and the
    // first cold replay run in beforeAll. This case keeps every restore and tamper check.
    const s = quoted;
    const text = serializeMatch(s);
    for (const input of [s, JSON.parse(text), text]) {
      const restored = restoreMatch(input), p = s.pendingChoice!;
      expect(restored).toEqual(s);
      expect(api.rerollAnomaly(restored, p.choiceId, p.generation)).toEqual(api.rerollAnomaly(s, p.choiceId, p.generation));
    }
    const refused = api.sellUnit(s, s.pendingChoice!.targetId!);
    expect(refused).toEqual({ok:false,state:s,reason:'wrong-phase'});
    expect(refused.state).toBe(s);
    expect(restoreMatch(serializeMatch(s))).toEqual(s);
    const chosen = accepted(api.selectChoice(s,s.pendingChoice!.choiceId,s.pendingChoice!.generation,s.pendingChoice!.offers[0]));
    const sealed = chosen.anomalyOfferHistory;
    const later = accepted(api.sellUnit(chosen,chosen.anomalyBinding!.unitId));
    expect(later.anomalyOfferHistory).toBe(sealed);
    expect(restoreMatch(serializeMatch(later))).toEqual(later);
    expect(later.anomalySelection).toEqual(chosen.anomalySelection);
    const restoredHolder = accepted(grantMechanicUnit(later, {receiptId:'audit:anomaly-reacquired',source:'anomaly-audit',
      definitionId:chosen.anomalySelection!.championDefinitionId}));
    expect(restoredHolder.anomalyBinding).not.toBeNull();
    expect(restoredHolder.anomalyBinding!.unitId).not.toBe(chosen.anomalyBinding!.unitId);
    expect(restoredHolder.anomalySelection).toEqual(chosen.anomalySelection);
    expect(restoredHolder.anomalyOfferHistory).toBe(sealed);
    expect(restoreMatch(serializeMatch(restoredHolder))).toEqual(restoredHolder);
    // R5 permits a real replacement, but neither dormant nor restored ownership
    // permits resurrecting the sold instance from the sealed quote proof.
    for (const state of [later, restoredHolder]) {
      const forgedTarget = {...state,anomalyBinding:chosen.anomalyBinding};
      expect(()=>restoreMatch(forgedTarget)).toThrow();
      expect(()=>restoreMatch(JSON.stringify(forgedTarget))).toThrow();
      expect(()=>serializeMatch(forgedTarget)).toThrow();
    }
    const changed = structuredClone(s);
    const facts = changed.anomalyOfferHistory!.facts.filter(f => f.kind === 'anomaly-offer');
    Object.assign(facts[1], {definitionId:facts[0].definitionId});
    for (const bad of [changed, {...s,anomalyOfferHistory:undefined}, {...s,choiceRngState:s.choiceRngState ^ 1},
      {...s,pendingChoice:{...s.pendingChoice!,rerollCount:99}}]) {
      expect(() => restoreMatch(bad)).toThrow();
      expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
      expect(() => serializeMatch(bad)).toThrow();
    }
  });
});

function openQuotedAnomaly(start: MatchState): MatchState {
  const c = start.pendingChoice!, unit = start.preparation.units.find(u => u.team === 'player')!;
  let s = accepted(api.selectAnomalyTarget(start, c.choiceId, c.generation, unit.id));
  expect(s.gold).toBeGreaterThanOrEqual(13);
  for (let i = 0; i < 13; i++) {
    const p = s.pendingChoice!;
    s = accepted(api.rerollAnomaly(s, p.choiceId, p.generation));
  }
  expect(api.readAnomalyOfferHistory(s)).toHaveLength(14);
  return advanceAugmentPreparationTime(s, 1000);
}

describe('M5 audit: dynamic restore and truthful strategy descriptions', () => {
  it('keeps the sealed quote and augment history objects when a resolved choice is traced', () => {
    const anomalyOfferHistory = { version: 'anomaly-offer-history-v1' as const, facts: [{
      kind: 'anomaly-offer' as const, choiceId: 'round:4-6:anomaly', definitionId: 'fireball', sequence: 0,
      seatId: 'solo', round: 23, roundId: '4-6', resourcePrefix: 0,
    }], proof: { kind: 'augment-history' as const } };
    const augmentHistory = { version: 'augment-history-v1' as const, facts: [], proof: { kind: 'solo' as const }, seatId: 'solo' };
    const before = { anomalyOfferHistory, augmentHistory, pendingChoice: null, openingEncounter: { mode: 'solo' } } as unknown as MatchState;
    const after = { ...before, gold: 1 } as MatchState;
    const traced = traceAnomalyCommand(before, after, 'sellUnit', ['sold-unit']);
    expect(traced.anomalyOfferHistory).toBe(anomalyOfferHistory);
    expect(traced.augmentHistory).toBe(augmentHistory);
    expect(JSON.stringify(traced)).toBe(JSON.stringify(after));
  });
  it.each(['abilityPowerFlat', 'attackSpeedBps', 'rangeBonus', 'nextAttackMagic', 'nextAttackPhysical', 'permanentAdBps'] as const)('rejects unsupported/overflow %s before ticking', field => {
    const state = accepted(api.startMatchCombat(purchasedThreeHeroMatch())), invalid = structuredClone(state);
    const lux = invalid.combat!.units.find(u => u.definitionId === 'lux')!;
    (lux.runtime as any)[field] = Number.MAX_SAFE_INTEGER;
    expect(() => restoreMatch(invalid)).toThrow(); expect(() => restoreMatch(JSON.stringify(invalid))).toThrow();
    expect(restoreMatch(state)).toEqual(state);
  });
  it('rejects small AP corruption too when Lux has no periodic AP source', () => {
    const state = accepted(api.startMatchCombat(purchasedThreeHeroMatch())), invalid = structuredClone(state);
    (invalid.combat!.units.find(u => u.definitionId === 'lux')!.runtime as any).abilityPowerFlat = 30;
    expect(() => restoreMatch(invalid)).toThrow('derived ability power');
  });
  it.each([['sorcerer', 0, 20], ['sorcerer', 1, 50], ['sentinel', 0, 36], ['sentinel', 1, 75]] as const)('labels %s tier %i team/member benefits and total %i', (id, index, total) => {
    const definition = TRAIT_DEFINITIONS[id], text = describeTraitTier(definition, definition.tiers[index]);
    expect(text).toContain('全队收益'); expect(text).toContain('职业成员额外收益');
    expect(text).toContain('职业成员最终合计'); expect(text.split('职业成员最终合计')[1]).toContain(`+${total}`);
  });
  it.each(['manaflow-i', 'glass-cannon-i'])('%s descriptions consistently say back two rows', id => {
    const text = AUGMENT_DEFINITIONS[id].effects.map(describeEffect).join('；');
    // v24 corrected these effects to the source's back-two-row condition.
    expect(text).toContain('后两排'); expect(text).not.toContain('最后一排');
  });
});
