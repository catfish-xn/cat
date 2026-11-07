import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle, startTwoSidedCombat,
  restoreBattleInput, restorePlayerBattleSnapshot, stepCombat, type MatchState } from '../src/server-entry';
import type { CombatState } from '../src/simulation/combat';
import { buyXp, deployMatchUnit, equipItem, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { attackSpeedBonus, type S13Unit } from '../src/simulation/combat-s13-state';
import { readCombatStats } from '../src/simulation/combat-s13';
import { effectiveStatuses } from '../src/simulation/m8/status';
import { vampRates } from '../src/simulation/m8/s13-mechanisms';
import { reachRound, accepted, freeze } from './match-helpers';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';

// 14.24 TFT13_Cabal: tiers 3/4/5(5-6)/7, Sion resists 40/45/50/100; TFT13_SionSpell_Unleashed: 75% revive HP,
// 300% AS, 40% omnivamp, control immunity for the rest of combat. Once per combat and the 1s delay are P-S5.
const EMBLEM = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!.id;
const NATIVE = ['morgana', 'vladimir', 'cassiopeia', 'elise', 'leblanc'];

type Spec = { readonly d: string; readonly star: 1 | 2 | 3; readonly col: number; readonly row: number };
/** A level-9 PvP seat at 3-2 (same shape as the other two-sided fixtures). */
function seat(units: readonly Spec[], emblemHolders: readonly number[] = []): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('3-2');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    items: emblemHolders.map((unit, i) => ({ id: `item-${i + 1}`, definitionId: EMBLEM, location: { kind: 'unit' as const, unitId: `unit-${unit}`, slot: (i % 3) as 0 | 1 | 2 } })),
    preparation: { ...base.preparation, units: units.map((u, i) => ({ id: `unit-${i + 1}`, definitionId: u.d, team: 'player' as const, starLevel: u.star, location: { kind: 'board' as const, cell: { col: u.col, row: u.row } } })) } };
}
const backRow = (ids: readonly string[]): Spec[] => ids.map((d, i) => ({ d, star: 1, col: i % 7, row: 7 - Math.floor(i / 7) }));
/** Seven Black Rose: five natives plus emblems on Garen (unit-6) and Lux (unit-7). */
const rose7 = () => seat(backRow([...NATIVE, 'garen', 'lux']), [6, 7]);
/** Eight three-star Jinx/Vi kill the chained-then-freed Sion well before the end of combat. */
const killers = () => seat(Array.from({ length: 8 }, (_, i) => ({ d: i % 2 ? 'vi' : 'jinx', star: 3 as const, col: i % 7, row: 4 + Math.floor(i / 7) })));
const pvp = (a: MatchState, b: MatchState = killers()) => compileBattle(snapshotForBattle(a, 'A'), snapshotForBattle(b, 'B'), 42, { battleId: 'black-rose-7' });
const roseTier = (input: ReturnType<typeof pvp>) => input.strategy.traits.find(t => t.team === 'player' && t.traitId === 'black-rose')?.tier ?? 0;
const sionOf = (c: CombatState) => c.units.find(u => u.definitionId === 'g23-sion' && u.team === 'player') as S13Unit | undefined;

// Read-only input and reference run shared within this file; each consumer still verifies its own path.
let seven: ReturnType<typeof pvp>, fullSeven: ReturnType<typeof resolveTwoSidedBattle>;
beforeAll(() => {
  seven = freeze(pvp(rose7()));
  fullSeven = freeze(resolveTwoSidedBattle(seven, 1201));
});

describe('7 Black Rose breakpoint (online PvP)', () => {
  it('counts distinct champions and one emblem holder: 5 natives + 2 emblem holders reach 7; 6 members or a duplicate champion stay at 5', () => {
    expect(roseTier(pvp(rose7()))).toBe(7);
    // Six members is still the 5 tier (minUnits 5, maxUnits 6).
    expect(roseTier(pvp(seat(backRow([...NATIVE, 'garen']), [6])))).toBe(5);
    // A second copy of a native champion adds nothing.
    expect(roseTier(pvp(seat(backRow([...NATIVE, 'garen', 'morgana']), [6])))).toBe(5);
    const sion = pvp(rose7()).strategy.units.find(u => u.unitId.endsWith(':g23-sion'))!;
    expect(sion.mechanics?.find(m => m.mechanic === 'g23Sion')?.values.tier).toBe(7);
  });

  it('Sion revives once, 1s after its first death, at 75% HP with 300% AS, 40% omnivamp and control immunity; the second death is final', () => {
    const input = seven;
    let c = startTwoSidedCombat(input);
    const id = sionOf(c)!.id;
    let firstDeath = -1, revivedAt = -1;
    while (c.status === 'running') {
      const step = stepCombat(c), sion = sionOf(step.state)!;
      if (firstDeath < 0 && sion.g23Sion) {
        firstDeath = step.state.tick;
        expect(step.events.some(e => e.type === 'death' && e.unitId === id)).toBe(false);
        expect(sion).toMatchObject({ alive: true, hp: Math.floor(sion.maxHp * 3 / 4), g23Sion: { reviveAtTick: firstDeath + 20, revived: false } });
      }
      if (step.events.some(e => e.type === 'unitRevived' && e.unitId === id)) {
        revivedAt = step.state.tick;
        const before = sionOf(c)!;
        expect(sion.g23Sion).toEqual({ reviveAtTick: firstDeath + 20, revived: true });
        expect(attackSpeedBonus(sion, revivedAt + 1) - attackSpeedBonus(before, revivedAt + 1)).toBe(30000);
        expect(effectiveStatuses(sion.mechanismState!.statuses, revivedAt).some(g => g.targetId === id && g.kind === 'control-immunity')).toBe(true);
        expect(vampRates(sion, sion.hp).map(r => r.bps)).toContain(4000);
        expect(vampRates(before, before.hp).map(r => r.bps)).not.toContain(4000);
      }
      if (firstDeath >= 0 && revivedAt < 0) expect(step.events.some(e => e.type === 'death' && e.unitId === id)).toBe(false);
      c = step.state;
    }
    expect(firstDeath).toBeGreaterThan(0);
    expect(revivedAt).toBe(firstDeath + 20);
    const full = fullSeven;
    expect(full.events.filter(e => (e.type === 'unitRevived' || e.type === 'death') && e.unitId === id).map(e => e.type)).toEqual(['unitRevived', 'death']);
    expect(sionOf(full.terminal)).toMatchObject({ alive: false, g23Sion: { revived: true } });
  });

  it('both sides at seven Black Rose retain unique Sions through staggered revival waits', () => {
    let c = startTwoSidedCombat(pvp(rose7(), rose7()));
    c = { ...c, units: c.units.map(u => ({ ...u, cooldownTicks: 1200, moveCooldownTicks: 1200, mana: 0, maxMana: 0,
      runtime: { ...u.runtime!, buddyTriggered: true } })) };
    const ids = c.units.map(u => u.id).sort();
    const sions = c.units.filter(u => u.definitionId === 'g23-sion');
    expect(sions.map(u => u.team).sort()).toEqual(['enemy', 'player']);
    const reviveEvents: string[] = [];
    for (let tick = 1; tick <= 23; tick++) {
      if (tick <= 2) c = { ...c, units: c.units.map(u => u.id === sions[tick - 1].id ? { ...u, hp: 0 } : u) };
      const r = stepCombat(c); c = r.state;
      expect(c.units.map(u => u.id).sort()).toEqual(ids);
      for (const u of sions) expect(c.units.filter(x => x.id === u.id)).toHaveLength(1);
      reviveEvents.push(...r.events.flatMap(e => e.type === 'unitRevived' ? [e.unitId] : []));
    }
    expect(reviveEvents.sort()).toEqual(sions.map(u => u.id).sort());
    expect(c.units.filter(u => u.definitionId === 'g23-sion').every(u => u.g23Sion?.revived)).toBe(true);
  });

  it('real Collector executions preserve kill rewards and ordinary holder-death triggers across Sion revival', () => {
    const crest = 'TFT_Item_Artifact_LightshieldCrest';
    const a = rose7(), b = seat(backRow(['garen', 'garen']));
    const withItems = (state: MatchState, entries: readonly [number, string][]): MatchState => ({ ...state,
      items: [...state.items, ...entries.map(([holder, definitionId], i) => ({ id: `item-${state.items.length + i + 1}`, definitionId,
        location: { kind: 'unit' as const, unitId: `unit-${holder}`, slot: i as 0 | 1 | 2 } }))],
    });
    let c = startTwoSidedCombat(pvp(withItems(a, [[1, crest]]), withItems(b, [
      [1, 'TFT4_Item_OrnnTheCollector'], [1, 'TFT_Item_Artifact_RapidFirecannon'],
    ])));
    const id = sionOf(c)!.id;
    const holder = c.units.find(u => u.team === 'player' && u.definitionId === 'morgana')!;
    const killers = c.units.filter(u => u.team === 'enemy');
    expect(killers).toHaveLength(2);
    c = { ...c, units: c.units.map(u => ({ ...u, mana: 0, maxMana: 0, cooldownTicks: 1200, moveCooldownTicks: 1200,
      runtime: { ...u.runtime!, buddyTriggered: true },
      ...(u.id === id || u.id === holder.id ? { hp: 10, armor: 0 } : {}),
      ...(u.id === holder.id ? { cell: { col: 0, row: 6 } } : {}),
      ...(u.id === killers[0].id ? { cell: { col: 3, row: 3 }, targetId: id, attackRange: 20, cooldownTicks: 0, attackDamage: 1,
        attackDamageBase: 1, attackDamagePercentBps: 0, baseCritChanceBps: 0 } : {}),
      ...(u.id === killers[1].id ? { cell: { col: 0, row: 5 }, targetId: holder.id, attackRange: 20, cooldownTicks: 0, attackDamage: 10000,
        attackDamageBase: 10000, attackDamagePercentBps: 0, baseCritChanceBps: 0 } : {}),
    })) };
    const range = () => readCombatStats(c.units.find(u => u.id === killers[0].id)!, c).attackRange;
    const initialRange = range();
    let r = stepCombat(c); c = r.state;
    const execution = r.events.filter(e => e.type === 'packetDamage' && e.outcome.context.targetId === id && e.outcome.killingPacket);
    expect(execution).toHaveLength(1);
    expect(execution[0]).toMatchObject({ outcome: { context: { damageType: 'true', source: { definitionId: 'TFT4_Item_OrnnTheCollector' } }, hpDamage: 9 } });
    expect(r.events.filter(e => e.type === 'kill').map(e => e.unitId).sort()).toEqual([id, holder.id].sort());
    expect(r.events.filter(e => e.type === 'death').map(e => e.unitId)).toEqual([holder.id]);
    expect(c.itemGoldReceipts!.filter(x => x.kind === 'collector')).toHaveLength(1);
    // The absent Sion is excluded; each of the six surviving present allies gets exactly one death shield.
    expect(c.units.filter(u => u.team === 'player').map(u => ({ id: u.id,
      shields: u.shieldLayers!.filter(x => x.source.definitionId === crest).map(x => x.remaining),
    }))).toEqual(c.units.filter(u => u.team === 'player').map(u => ({ id: u.id,
      shields: u.id === id || u.id === holder.id ? [] : [52],
    })));
    expect(range()).toBe(initialRange + 1);
    c = { ...c, units: c.units.map(u => ({ ...u, cooldownTicks: 1200 })) };
    while (c.tick < 21) c = stepCombat(c).state;
    expect(sionOf(c)!.g23Sion?.revived).toBe(true);
    expect(c.itemGoldReceipts!.filter(x => x.kind === 'collector')).toHaveLength(1);
    expect(range()).toBe(initialRange + 1);
    c = { ...c, units: c.units.map(u => u.id === id ? { ...u, hp: 10, shield: 0, shieldLayers: [] }
      : u.id === killers[0].id ? { ...u, cooldownTicks: 0, targetId: id } : u) };
    r = stepCombat(c); c = r.state;
    expect(r.events.filter(e => e.type === 'death' && e.unitId === id)).toHaveLength(1);
    expect(r.events.filter(e => e.type === 'kill' && e.unitId === id)).toHaveLength(1);
    expect(c.itemGoldReceipts!.filter(x => x.kind === 'collector')).toHaveLength(2);
    expect(sionOf(c)!.alive).toBe(false);
    expect(range()).toBe(initialRange + 2);
  });

  it('below 7 the same Sion dies on its first death', () => {
    const six = pvp(seat(backRow([...NATIVE, 'garen']), [6]));
    expect(roseTier(six)).toBe(5);
    const full = resolveTwoSidedBattle(six, 1201), id = sionOf(full.initial)!.id;
    expect(full.events.some(e => e.type === 'death' && e.unitId === id)).toBe(true);
    expect(full.events.some(e => e.type === 'unitRevived' && e.unitId === id)).toBe(false);
    expect(sionOf(full.terminal)!.g23Sion).toBeUndefined();
  });

  it('snapshot and battle input survive JSON save/restore; restored, sliced and full runs keep the same revive', () => {
    const a = snapshotForBattle(rose7(), 'A'), b = snapshotForBattle(killers(), 'B');
    expect(restorePlayerBattleSnapshot(JSON.stringify(a))).toEqual(a);
    const input = compileBattle(a, b, 42, { battleId: 'black-rose-7' });
    const restored = restoreBattleInput(JSON.stringify(input));
    expect(restored).toEqual(input);
    const full = fullSeven;
    expect(full.events.some(e => e.type === 'unitRevived')).toBe(true);
  });

  // Each execution path keeps a separate default-budget case; input restoration is exercised in every path.
  it.each(['full', 1, 13] as const)('restored battle matches the full reference (slice budget %s)', budget => {
    const restored = restoreBattleInput(JSON.stringify(seven)), full = fullSeven;
    if (budget === 'full') expect(resolveTwoSidedBattle(restored, 1201)).toEqual(full);
    else {
      const task = startTwoSidedBattle(restored); let sliced = null;
      while (!sliced) sliced = task.advance(budget);
      expect(sliced).toEqual(full);
    }
  });

  it('rejects a battle input whose Black Rose tier or Sion tier was raised to 7, and a snapshot that pre-places Sion', () => {
    const six = pvp(seat(backRow([...NATIVE, 'garen']), [6]));
    type Loose = { strategy: { traits: { team: string; traitId: string; tier: number }[]; units: { unitId: string; mechanics?: { mechanic: string; values: Record<string, number> }[] }[] }; units: unknown[] };
    const tamper = (value: unknown, edit: (x: Loose) => void): string => { const x = JSON.parse(JSON.stringify(value)) as Loose; edit(x); return JSON.stringify(x); };
    expect(() => restoreBattleInput(JSON.stringify(six))).not.toThrow();
    expect(() => restoreBattleInput(tamper(six, x => { x.strategy.traits.find(t => t.team === 'player' && t.traitId === 'black-rose')!.tier = 7; }))).toThrow('battle-input');
    expect(() => restoreBattleInput(tamper(six, x => {
      x.strategy.units.find(u => u.unitId.endsWith(':g23-sion'))!.mechanics!.find(m => m.mechanic === 'g23Sion')!.values.tier = 7;
    }))).toThrow('battle-input');
    expect(() => restorePlayerBattleSnapshot(tamper(snapshotForBattle(rose7(), 'A'), x => {
      x.units.push({ id: 'unit-8', definitionId: 'g23-sion', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } });
    }))).toThrow('invalid-snapshot');
  });
});

/** PvE seat (online PvE rounds run as a Match combat): 7 Black Rose deployed through public commands. */
function pveRose7(): MatchState {
  // v26 D5 (7953c99a) changed seed 42's public 2-1 offer so the first card is snipers-nest, a history owner. Its solo
  // proof replays only public commands, so the test-injected gold below made restore fail at the replayed buyXp.
  // Pick the first public card that owns no augment history, as the v25 route did (no history, no replay).
  let s = reachRound('2-5', true, 42, [], Object.keys(AUGMENT_HISTORY_OWNERS));
  expect(s.augmentHistory).toBeUndefined();
  s = accepted(grantMechanicGold(s, { receiptId: 'rose7-xp', source: 'test', amount: 200 }));
  while (s.level < 7) s = accepted(buyXp(s));
  for (const [i, definitionId] of [...NATIVE, 'garen', 'lux'].entries()) {
    s = accepted(grantMechanicUnit(s, { receiptId: `rose7-${definitionId}`, source: 'test', definitionId }));
    const unit = s.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player' && u.location.kind === 'bench')!;
    s = accepted(deployMatchUnit(s, unit.id, { kind: 'board', cell: { col: i, row: 7 } }));
    if (i >= NATIVE.length) {
      s = accepted(grantMechanicItem(s, { receiptId: `rose7-emblem-${i}`, source: 'test', definitionId: EMBLEM }));
      s = accepted(equipItem(s, s.items.at(-1)!.id, unit.id, 0));
    }
  }
  return s;
}

describe('7 Black Rose breakpoint (Match save)', () => {
  it('restores tier-7 checkpoints exactly and rejects an invented or altered revive state', () => {
    let s = accepted(startMatchCombat(pveRose7()));
    const sion = s.combat!.units.find(u => u.definitionId === 'g23-sion')!;
    expect(sion.mechanics?.find(m => m.mechanic === 'g23Sion')?.values.tier).toBe(7);
    expect([sion.armor, sion.magicResist]).toEqual([100, 100]);
    const checkpoints: MatchState[] = [s];
    while (s.phase === 'combat' && !s.combat!.units.find(u => u.id === sion.id)!.runtime!.buddyTriggered) s = stepMatch(s).state;
    expect(s.phase).toBe('combat');
    checkpoints.push(s);
    for (const checkpoint of checkpoints) {
      const saved = serializeMatch(checkpoint), restored = restoreMatch(saved);
      expect(restored).toEqual(checkpoint);
      expect(stepMatch(restored)).toEqual(stepMatch(checkpoint));
      const tick = checkpoint.combat!.tick;
      for (const g23Sion of [{ reviveAtTick: tick + 5, revived: false }, { reviveAtTick: Math.max(0, tick - 5), revived: true }]) {
        const bad = structuredClone(checkpoint);
        Object.assign(bad.combat!.units.find(u => u.id === sion.id)!, { g23Sion });
        expect(() => serializeMatch(bad)).toThrow('Invalid authoritative V19 replay');
        for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('Invalid authoritative V19 replay');
      }
    }
  });
});
