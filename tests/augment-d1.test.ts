import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { WHAT_YOU_REALLY_ARE as RULE } from '../src/simulation/content/augment-d1';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { whatYouReallyAreGiftPlan, whatYouReallyAreProgress } from '../src/simulation/augment-d1';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { applyRoundSettlement } from '../src/simulation/round-settlement';
import { createMatch } from '../src/simulation/match';
import { toSeatPrivateView, toPublicBoard } from '../src/server/room/projection';
import type { MatchState } from '../src/simulation/match-types';
import { opening, atRound, receipt, settle } from './d01-helpers';
import { freeze } from './combat-helpers';

const ID = 'what-you-really-are';
const owner = { definitionId: ID, choiceId: 'd1-owned-fixture', acquiredRound: 4 };
const receipts = (s: MatchState) => s.seatMechanics!.receipts.filter(r => r.receiptId.includes(ID));
const itemCount = (s: MatchState, id: string) => s.items.filter(i => i.definitionId === id).length;
let base: MatchState;
beforeAll(() => { base = opening(); });
const acquire = (s = base) => drainBatch1Gifts({ ...s, augments: [owner] });

describe('D1 What You Really Are (effect only; D5 owns offers)', () => {
  it('grants one Bloodthirster at acquisition and stays outside every offer node', () => {
    const s = acquire();
    expect(itemCount(s, 'bloodthirster') - itemCount(base, 'bloodthirster')).toBe(1);
    expect(receipts(s)).toHaveLength(1);
    expect(drainBatch1Gifts(freeze(s))).toEqual(s);
    expect(whatYouReallyAreProgress(s)).toEqual({ count: 0 });
    expect(AUGMENT_DEFINITIONS[ID]).toBeUndefined();
    for (const node of ['2-1', '3-2', '4-2'])
      expect(augmentCandidates('prismatic', [], [], null, { node, fieldedTraits: [], blocked: [] })).not.toContain(ID);
  });

  it('counts the acquisition-round PvP, triggers at exactly 35, and rewards once after JSON copying/retry', () => {
    const acquired = acquire();
    const first = settle(freeze(acquired), { damageDealt: 12 });
    expect(whatYouReallyAreProgress(first)).toEqual({ count: 12 });
    const second = settle(atRound(first, '2-2'), { damageDealt: 22 });
    expect(whatYouReallyAreProgress(second)).toEqual({ count: 34 });
    expect(receipts(second)).toHaveLength(1);
    const before = atRound(second, '2-3'), r = receipt(before, { damageDealt: 1 });
    const third = settle(freeze(before), { damageDealt: 1 });
    expect(whatYouReallyAreProgress(third)).toEqual({ count: 35, completedRound: 6 });
    expect(receipts(third)).toMatchObject([
      { kind: 'item', definitionId: 'bloodthirster' },
      { kind: 'unit', definitionId: 'warwick', resolution: 'orb', starLevel: 1 },
      { kind: 'item', definitionId: 'steraks-gage' },
    ]);
    expect(itemCount(third, 'steraks-gage') - itemCount(acquired, 'steraks-gage')).toBe(1);
    expect(third.preparation.units.some(u => u.definitionId === 'warwick')).toBe(false);
    const clone: MatchState = JSON.parse(JSON.stringify(third)); // Trusted server state, not restoreMatch admission.
    expect(whatYouReallyAreProgress(clone)).toEqual(whatYouReallyAreProgress(third));
    expect(drainBatch1Gifts(clone)).toEqual(third);
    const repeat = applyRoundSettlement(clone, r);
    expect(repeat).toEqual({ ok: false, state: clone, reason: 'duplicate-settlement' });
    expect(repeat.state).toBe(clone);
    const supply: MatchState = { ...third, roundResults: [...third.roundResults,
      { ...third.roundResults.at(-1)!, round: 7, roundId: '2-4', roundKind: 'supply' }] };
    const later = settle(atRound(supply, '2-5'), { damageDealt: 15 });
    expect(receipts(later)).toEqual(receipts(third));
    expect(whatYouReallyAreProgress(later)).toEqual({ count: 35, completedRound: 6 });
  });

  it('uses damageDealt alone: ignores prior PvP, incoming loss, PvE/supply and zero-damage mirrors', () => {
    const prior = settle(base, { damageDealt: 35 });
    const acquired = drainBatch1Gifts({ ...atRound(prior, '2-2'), augments: [{ ...owner, acquiredRound: 5 }] });
    const loss = settle(acquired, { result: 'loss', damage: 9, opposingSurvivors: 7, damageDealt: 0 });
    const zero = settle(atRound(loss, '2-3'), { damageDealt: 0 });
    const ignored = { ...zero, roundResults: [...zero.roundResults,
      { ...zero.roundResults.at(-1)!, round: 7, roundKind: 'supply' as const, damageDealt: 100 },
      { ...zero.roundResults.at(-1)!, round: 10, roundKind: 'pve' as const, damageDealt: 100 }] };
    expect(loss.roundResults.at(-1)).toMatchObject({ playerDamage: 9, hpLost: 9, damageDealt: 0 });
    expect(whatYouReallyAreProgress(ignored)).toEqual({ count: 0 });
    expect(receipts(drainBatch1Gifts(ignored))).toHaveLength(1);
  });

  it('crosses 35 during the acquisition round, saturates the count and does not award an eliminated holder', () => {
    const live = settle(acquire(), { damageDealt: 36 });
    expect(whatYouReallyAreProgress(live)).toEqual({ count: 35, completedRound: 4 });
    expect(receipts(live)).toHaveLength(3);
    const dead = settle({ ...acquire(), playerHp: 1 }, { result: 'draw', damage: 2, damageDealt: 35 });
    expect(dead.playerHp).toBe(0);
    expect(whatYouReallyAreProgress(dead)).toEqual({ count: 35 });
    expect(receipts(dead)).toHaveLength(1);
  });

  it('requires matching committed D0 authority and atomically rejects a missing field at settlement', () => {
    const s = acquire(), { damageDealt: _, ...legacy } = receipt(s);
    const rejected = applyRoundSettlement(freeze(s), legacy);
    expect(rejected).toEqual({ ok: false, state: s, reason: 'invalid-receipt' });
    expect(rejected.state).toBe(s);
    const settled = settle(s, { damageDealt: 12 });
    for (const bad of [
      { ...settled, multiplayer: { ...settled.multiplayer!, receipts: [] } },
      { ...settled, multiplayer: { ...settled.multiplayer!, receipts: settled.multiplayer!.receipts.map(r => ({ ...r, damageDealt: 35 })) } },
      { ...settled, roundResults: settled.roundResults.map(r => r.roundKind === 'pvp' ? { ...r, damageDealt: -1 } : r) },
    ]) expect(() => whatYouReallyAreProgress(bad)).toThrow('Invalid D1 damageDealt authority');
  });

  it('projects the settled owner counter without exposing receipts and has no solo damage fallback', () => {
    const s = settle(acquire(), { damageDealt: 14 });
    const before = JSON.stringify(s);
    expect(toSeatPrivateView(s).augmentDynamicValues[ID]).toEqual({ values: [14] });
    expect(JSON.stringify(toPublicBoard(s))).not.toContain('augmentDynamicValues');
    expect(JSON.stringify(s)).toBe(before);
    expect(whatYouReallyAreProgress({ ...createMatch(5), augments: [owner] })).toEqual({ count: 0 });
    expect(whatYouReallyAreGiftPlan(base)).toEqual([]);
    for (const key of ['rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState'] as const) expect(s[key]).toBe(base[key]);
  });
});

const archive = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(archive))('D1 numbers, grant names and raw stage tags agree with the independent 14.24 archive', () => {
  const row = JSON.parse(readFileSync(archive, 'utf8')).find((r: { apiName: string }) => r.apiName === 'TFT13_Augment_Grant6Cost_Warwick');
  expect(RULE.source.values).toEqual(row.effects);
  expect(RULE.name).toBe(row.name_zh_cn);
  expect(RULE.description).toBe(row.description_zh_cn);
  expect(RULE.source.description_en_us).toBe(row.description_en_us);
  expect(row.description_en_us).toContain('Gain a Bloodthirster. After you deal 35 damage to other players, gain a Warwick and a Sterak\'s Gage.');
  expect(RULE.source.item_tags_raw).toEqual(row.item_tags_raw);
});
