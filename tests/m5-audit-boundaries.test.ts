import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { accepted, readyMatch, finish } from './match-helpers';
import { describeEffect, describeTraitTier } from '../src/rendering/strategy-panel';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { run } from '../scripts/generate-m5-route.cjs';
import type { MatchState } from '../src/simulation/match-types';
let before19: MatchState, anomaly: MatchState;
beforeAll(async () => {
  const route = await run(api, { build: 'cannon', seed: 42, retainStates: true });
  before19 = (route.actions.find((a: any) => a.round === 19 && a.command.type === 'start') as any).before;
  anomaly = (route.actions.find((a: any) => a.round === 20 && a.command.type === 'target') as any).before;
}, 120000);

describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling', () => {
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
    s = accepted(api.nextRound(s, 19));
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
    expect(api.nextRound(s, 19).state).toBe(s); expect(restoreMatch(s)).toEqual(s);
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
    s = accepted(api.nextRound(finish(accepted(api.startMatchCombat(s))), 19));
    for (let n = 0; n < 100; n++) { const r = api.rerollShop(s); if (!r.ok) { expect(r.state).toBe(s); break; } s = r.state; }
    for (let n = 0; n < 100; n++) { const r = api.buyXp(s); if (!r.ok) { expect(r.state).toBe(s); break; } s = r.state; }
    const slot = s.shop.slots.findIndex(o => o.status === 'available' &&
      // Costs are independently fixed by the original S13 tier list.
      (['darius','irelia','lux','maddie','zyra'].includes(o.definitionId) ? 1 : ['leona','rell','tristana','urgot','vander'].includes(o.definitionId) ? 2 : ['ezreal','kogmaw','loris','nami','scar'].includes(o.definitionId) ? 3 : o.definitionId === 'caitlyn' ? 5 : 4) <= s.gold);
    expect(slot).toBeGreaterThanOrEqual(0); expect(api.buyUnit(s, slot, s.shop.generation).ok).toBe(true);
  });
  it.each([0, 1, 42, 0xffffffff])('maps one complete random word at each draw and revisits all offers, seed %i', seed => {
    let s = { ...anomaly, choiceRngState: seed, gold: 100 } as MatchState;
    const c = s.pendingChoice!, target = s.preparation.units.find(u => u.team === 'player')!;
    let word = (BigInt(seed) * 1664525n + 1013904223n) % 4294967296n;
    s = accepted(api.selectAnomalyTarget(s, c.choiceId, c.generation, target.id));
    const ids = ['kill-streak', 'mage-armor', 'titanic-strikes'];
    expect(s.pendingChoice!.offers[0]).toBe(ids[Number(word * 3n / 4294967296n)]);
    const seen = new Set(s.pendingChoice!.offers);
    for (let i = 0; i < 40; i++) {
      const previous = s.pendingChoice!.offers[0], pool = ids.filter(id => id !== previous), before = s;
      word = (word * 1664525n + 1013904223n) % 4294967296n;
      const pending = s.pendingChoice!; s = accepted(api.rerollAnomaly(s, pending.choiceId, pending.generation));
      expect(s.choiceRngState).toBe(Number(word)); expect(s.pendingChoice!.offers[0]).toBe(pool[Number(word * 2n / 4294967296n)]);
      expect(s.gold).toBe(before.gold - 1); seen.add(s.pendingChoice!.offers[0]);
    }
    expect([...seen].sort()).toEqual(ids);
  });
});

describe('M5 audit: dynamic restore and truthful strategy descriptions', () => {
  it.each(['abilityPowerFlat', 'attackSpeedBps', 'rangeBonus', 'nextAttackMagic', 'nextAttackPhysical', 'permanentAdBps'] as const)('rejects unsupported/overflow %s before ticking', field => {
    const state = accepted(api.startMatchCombat(readyMatch())), invalid = structuredClone(state);
    const lux = invalid.combat!.units.find(u => u.definitionId === 'lux')!;
    (lux.runtime as any)[field] = Number.MAX_SAFE_INTEGER;
    expect(() => restoreMatch(invalid)).toThrow(); expect(() => restoreMatch(JSON.stringify(invalid))).toThrow();
    expect(restoreMatch(state)).toEqual(state);
  });
  it('rejects small AP corruption too when Lux has no periodic AP source', () => {
    const state = accepted(api.startMatchCombat(readyMatch())), invalid = structuredClone(state);
    (invalid.combat!.units.find(u => u.definitionId === 'lux')!.runtime as any).abilityPowerFlat = 30;
    expect(() => restoreMatch(invalid)).toThrow('derived ability power');
  });
  it.each([['sorcerer', 0, 20], ['sorcerer', 1, 50], ['sentinel', 0, 36], ['sentinel', 1, 75]] as const)('labels %s tier %i team/member benefits and total %i', (id, index, total) => {
    const definition = TRAIT_DEFINITIONS[id], text = describeTraitTier(definition, definition.tiers[index]);
    expect(text).toContain('全队收益'); expect(text).toContain('职业成员额外收益');
    expect(text).toContain('职业成员最终合计'); expect(text.split('职业成员最终合计')[1]).toContain(`+${total}`);
  });
  it.each(['manaflow-i', 'glass-cannon-i'])('%s descriptions consistently say last row', id => {
    const text = AUGMENT_DEFINITIONS[id].effects.map(describeEffect).join('；');
    expect(text).toContain('最后一排'); expect(text).not.toContain('后两排');
  });
});
