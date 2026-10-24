import { describe, expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle, startTwoSidedCombat,
  restoreBattleInput, restorePlayerBattleSnapshot, stepCombat, type MatchState } from '../src/server-entry';
import type { CombatState } from '../src/simulation/combat';
import { buyXp, deployMatchUnit, equipItem, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { attackSpeedBonus, type S13Unit } from '../src/simulation/combat-s13-state';
import { effectiveStatuses } from '../src/simulation/m8/status';
import { vampRates } from '../src/simulation/m8/s13-mechanisms';
import { reachRound, accepted } from './match-helpers';

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
    const input = pvp(rose7());
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
    const full = resolveTwoSidedBattle(input, 1201);
    expect(full.events.filter(e => (e.type === 'unitRevived' || e.type === 'death') && e.unitId === id).map(e => e.type)).toEqual(['unitRevived', 'death']);
    expect(sionOf(full.terminal)).toMatchObject({ alive: false, g23Sion: { revived: true } });
  }, 60000);

  it('below 7 the same Sion dies on its first death', () => {
    const six = pvp(seat(backRow([...NATIVE, 'garen']), [6]));
    expect(roseTier(six)).toBe(5);
    const full = resolveTwoSidedBattle(six, 1201), id = sionOf(full.initial)!.id;
    expect(full.events.some(e => e.type === 'death' && e.unitId === id)).toBe(true);
    expect(full.events.some(e => e.type === 'unitRevived' && e.unitId === id)).toBe(false);
    expect(sionOf(full.terminal)!.g23Sion).toBeUndefined();
  }, 60000);

  it('snapshot and battle input survive JSON save/restore; restored, sliced and full runs keep the same revive', () => {
    const a = snapshotForBattle(rose7(), 'A'), b = snapshotForBattle(killers(), 'B');
    expect(restorePlayerBattleSnapshot(JSON.stringify(a))).toEqual(a);
    const input = compileBattle(a, b, 42, { battleId: 'black-rose-7' });
    const restored = restoreBattleInput(JSON.stringify(input));
    expect(restored).toEqual(input);
    const full = resolveTwoSidedBattle(input, 1201);
    expect(full.events.some(e => e.type === 'unitRevived')).toBe(true);
    expect(resolveTwoSidedBattle(restored, 1201)).toEqual(full);
    for (const budget of [1, 13]) {
      const task = startTwoSidedBattle(restored); let sliced = null;
      while (!sliced) sliced = task.advance(budget);
      expect(sliced).toEqual(full);
    }
  }, 60000);

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
  let s = reachRound('2-5', true, 42);
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
  }, 60000);
});
