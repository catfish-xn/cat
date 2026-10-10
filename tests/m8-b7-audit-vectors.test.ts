import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { battle, unit } from './combat-helpers';
import { accepted, resolveM5Choices } from './match-helpers';

/**
 * Independent B7 audit vectors (signed-off audit of 889a2a5). Expected values come from
 * M8B_ENCOUNTERS §4.4/§4.5 hand calculations and a separate odd-r/axial geometry model below,
 * never from implementation output.
 */

// Independent odd-r offset <-> axial model; does not import board.ts helpers.
type Cell = { col: number; row: number };
const toAxial = (c: Cell) => [c.col - Math.floor(c.row / 2), c.row] as const;
const fromAxial = (q: number, r: number): Cell => ({ col: q + Math.floor(r / 2), row: r });
const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const; // E SE SW W NW NE
const distance = (a: Cell, b: Cell) => {
  const [aq, ar] = toAxial(a), [bq, br] = toAxial(b), dq = aq - bq, dr = ar - br;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};
const onBoard = (c: Cell) => c.col >= 0 && c.col < 7 && c.row >= 0 && c.row < 8;

const dummy = (id: string, team: CombatUnit['team'], col: number, row: number, hp = 1000): CombatUnit => ({
  ...unit(id, team, col, row, { hp, maxHp: hp, armor: 0, magicResist: 0, mana: 0, maxMana: 0,
    ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } }),
  cooldownTicks: 1000, moveCooldownTicks: 1000,
});
function heraldBattle(players: readonly CombatUnit[], allies: readonly CombatUnit[] = []): CombatState {
  const compiled = compileNeutralEncounter('6-7');
  return battle([...compiled.units.map(u => ({ ...u, cooldownTicks: 1000, moveCooldownTicks: 1000 })), ...allies, ...players],
    { combatId: 'b7-audit', rngDraws: 0, openingDefinitions: compiled.openingDefinitions });
}
const chargeTrace = (events: readonly CombatEvent[]) => events.flatMap(e => e.type === 'packetDamage' ? [`damage:${e.unitId}:${e.raw}`]
  : e.type === 'statusChanged' && e.status.kind === 'stun' ? [`stun:${e.unitId}:${e.reason}:${e.status.startsAtTick}-${e.status.expiresAtTick}`] : []);

describe('B7 audit: Rift Herald charge (ENCOUNTERS §4.5)', () => {
  it('hits every path enemy in path order, each damage packet before its own next-tick stun', () => {
    const result = stepCombat(heraldBattle([dummy('a', 'player', 3, 3), dummy('b', 'player', 3, 4)]));
    const plan = result.state.openingState!.plans[0];
    expect(plan.path).toEqual([{ col: 4, row: 2 }, { col: 3, row: 3 }, { col: 3, row: 4 }, { col: 2, row: 5 }]);
    expect(plan.targetIds).toEqual(['a', 'b']);
    expect(plan.to).toEqual({ col: 2, row: 5 });
    // floor(1000×1500/10000)=150 each; stun [2,12).
    expect(chargeTrace(result.events)).toEqual(['damage:a:150', 'stun:a:applied:2-12', 'damage:b:150', 'stun:b:applied:2-12']);
    expect(result.state.rngDraws).toBe(0);
  });

  it('a lethal first target gets no stun while the surviving second target is still stunned', () => {
    const result = stepCombat(heraldBattle([{ ...dummy('a', 'player', 3, 3), hp: 100 }, dummy('b', 'player', 3, 4)]));
    expect(chargeTrace(result.events)).toEqual(['damage:a:150', 'damage:b:150', 'stun:b:applied:2-12']);
    expect(result.state.units.find(u => u.id === 'a')).toMatchObject({ alive: false, statuses: [] });
  });

  it.each([[1999, 299], [2000, 300], [2001, 300]])('target maxHp %i samples %i raw magic damage at the 300 cap boundary', (hp, raw) => {
    const result = stepCombat(heraldBattle([dummy('p', 'player', 3, 4, hp)]));
    expect(result.events.find(e => e.type === 'packetDamage')).toMatchObject({ raw, damageType: 'magic', critical: false });
  });

  it('no-landing vector: friendly and enemy occupants fill the whole path, so nothing moves, hits or stuns', () => {
    const result = stepCombat(heraldBattle([dummy('p1', 'player', 3, 4), dummy('p2', 'player', 2, 5)],
      [dummy('f1', 'enemy', 4, 2), dummy('f2', 'enemy', 3, 3)]));
    const plan = result.state.openingState!.plans[0];
    expect(plan).toMatchObject({ result: 'no-space', task: null, consumed: true });
    expect(result.events.filter(e => e.type === 'packetDamage' || e.type === 'movement' || e.type === 'statusChanged')).toEqual([]);
  });
});

describe('B7 audit: Elder Dragon cone (ENCOUNTERS §4.4) against independent geometry', () => {
  const layouts: { dragon: Cell; primary: Cell }[] = [];
  for (const [col, row] of [[3, 2], [3, 3], [0, 3], [6, 4], [2, 5], [5, 0]])
    for (let c = 0; c < 7; c++) for (let r = 0; r < 8; r++) {
      const d = distance({ col, row }, { col: c, row: r });
      if (d >= 1 && d <= 2) layouts.push({ dragon: { col, row }, primary: { col: c, row: r } });
    }

  it(`selects at most two 29-damage children from the four-cell cone on ${layouts.length} odd/even/edge layouts`, () => {
    let attacked = 0;
    for (const { dragon, primary } of layouts) {
      const [dq, dr] = toAxial(dragon);
      const di = DIRECTIONS.findIndex(([x, y]) => { const n = fromAxial(dq + x, dr + y); return onBoard(n) && distance(n, primary) < distance(dragon, primary); });
      const [pq, pr] = toAxial(primary), d = DIRECTIONS[di], left = DIRECTIONS[(di + 5) % 6], right = DIRECTIONS[(di + 1) % 6];
      const cone = [[pq + d[0], pr + d[1]], [pq + 2 * d[0], pr + 2 * d[1]], [pq + d[0] + left[0], pr + d[1] + left[1]], [pq + d[0] + right[0], pr + d[1] + right[1]]]
        .map(([q, r]) => fromAxial(q, r)).filter(onBoard);
      // Fill all cells near the primary but farther from the dragon, so the primary is the unique nearest target.
      const players = [dummy('p00', 'player', primary.col, primary.row, 500)];
      for (let c = 0; c < 7; c++) for (let r = 0; r < 8; r++) {
        const cell = { col: c, row: r };
        if ((c === primary.col && r === primary.row) || (c === dragon.col && r === dragon.row)) continue;
        if (distance(cell, primary) <= 2 && distance(cell, dragon) > distance(primary, dragon)) players.push(dummy(`p${String(players.length).padStart(2, '0')}`, 'player', c, r, 500));
      }
      const compiled = compileNeutralEncounter('5-7');
      const step = stepCombat(battle([{ ...compiled.units[0], cell: dragon }, ...players], { combatId: 'b7-audit', rngState: 634785765, rngDraws: 0 }));
      const attack = step.events.find(e => e.type === 'attack');
      if (!attack) continue;
      attacked++;
      expect(attack).toMatchObject({ targetId: 'p00' });
      const expected = players.filter(u => u.id !== 'p00' && cone.some(c => c.col === u.cell.col && c.row === u.cell.row))
        .sort((a, b) => distance(a.cell, primary) - distance(b.cell, primary) || (a.id < b.id ? -1 : 1)).slice(0, 2);
      const children = step.events.filter(e => e.type === 'packetDamage' && e.source.sourceKind === 'ability');
      expect({ dragon, primary, children: children.map(e => e.type === 'packetDamage' ? [e.unitId, e.raw, e.critical] : []).sort() })
        .toEqual({ dragon, primary, children: expected.map(u => [u.id, 29, false]).sort() });
      expect(step.state.rngDraws).toBe(1);
    }
    expect(attacked).toBe(layouts.length); // Every independently enumerated layout must actually attack.
  });
});

/** Synthetic earlier wins only to reach the target round; the tested round uses production Start/step/serialize/restore. */
function prepared(roundId: string): api.MatchState {
  let s = api.createMatch(42);
  while (s.roundDefinitionId !== roundId) {
    s = resolveM5Choices(s);
    if (s.phase === 'preparation') {
      s = accepted(api.startMatchCombat(s));
      if (s.phase === 'combat') s = api.stepMatch(s).state;
      if (s.phase === 'combat') {
        s = { ...s, combat: { ...s.combat, units: s.combat.units.map(u => u.team === 'enemy' ? { ...u, hp: 0, alive: false } : u) } };
        s = api.stepMatch(s).state;
      }
    }
    s = resolveM5Choices(s);
    s = accepted(api.nextRound(s, s.round));
  }
  return resolveM5Choices(s);
}
const withGaren = (s: api.MatchState): api.MatchState => ({ ...s, preparation: { ...s.preparation,
  units: s.preparation.units.map(u => u.team === 'player' ? { ...u, definitionId: 'garen', starLevel: 3 as const, location: { kind: 'board' as const, cell: { col: 3, row: 4 } } } : u) } });
const restored = (s: api.MatchState) => restoreMatch(JSON.parse(serializeMatch(s)));
const rejects = (s: api.MatchState, mutate: (x: any) => void) => { const x = JSON.parse(serializeMatch(s)); mutate(x); expect(() => restoreMatch(x)).toThrow(); };
const mechanismTick = (events: readonly api.MatchEvent[]) => events.some(e => ['death', 'heal', 'movement', 'statusChanged'].includes(e.type));

describe('B7 audit: Match save/restore of real encounters', () => {
  it.each(['2-7', '3-7', '4-7', '5-7', '6-7'])('%s: restoring at every opening and mechanism tick reproduces the continuous run', roundId => {
    let continuous = accepted(api.startMatchCombat(withGaren(prepared(roundId)))), resumed = restored(continuous), restores = 1, afterMechanism = false;
    const continuousEvents: unknown[] = [], resumedEvents: unknown[] = [];
    while (continuous.phase === 'combat') {
      const a = api.stepMatch(continuous), b = api.stepMatch(resumed);
      continuous = a.state; continuousEvents.push(...a.events); resumedEvents.push(...b.events);
      // Opening/stun window, every mechanism tick AND its next-tick consumer, and periodic checkpoints.
      const tick = continuous.combat!.tick;
      if (tick <= 13 || mechanismTick(a.events) || afterMechanism || tick % 50 === 0) {
        resumed = restored(b.state); restores++;
        expect(resumed).toEqual(continuous);
      } else resumed = b.state;
      afterMechanism = mechanismTick(a.events);
    }
    expect(resumedEvents).toEqual(continuousEvents);
    expect(serializeMatch(resumed)).toBe(serializeMatch(continuous));
    expect(restores).toBeGreaterThan(14);
  });

  it('6-7 rejects retimed stun, forged death, un-expired receipt and forged removal reasons', () => {
    let s = api.stepMatch(accepted(api.startMatchCombat(withGaren(prepared('6-7'))))).state;
    rejects(s, x => {
      const target = x.combat.units.find((u: any) => u.id === 'unit-1');
      for (const group of target.mechanismState.statuses) for (const c of group.contributions)
        if (c.source.definitionId === 'void-charge-project-v1') { c.appliedAtTick = 3; c.expiresAtTick = 13; }
      for (const status of target.statuses) if (status.kind === 'stun') { status.startsAtTick = 3; status.expiresAtTick = 13; }
    });
    rejects(s, x => { x.combat.neutralReceipts.deaths.push({ unitId: x.combat.units.find((u: any) => u.team === 'enemy').id, tick: 1, eventSeq: 0 }); });
    for (let i = 0; i < 12; i++) s = api.stepMatch(s).state;
    expect(s.combat!.neutralReceipts!.controls[0]).toMatchObject({ removedReason: 'expired', removedAtTick: 12 });
    rejects(s, x => { Object.assign(x.combat.neutralReceipts.controls[0], { removedAtTick: null, removedEventSeq: null, removedReason: null }); });
    rejects(s, x => { x.combat.neutralReceipts.controls[0].removedReason = 'cleansed'; });
    rejects(s, x => { x.combat.neutralReceipts.controls[0].removedReason = 'death-cleanup'; });
  });

  it('2-7 rejects deleting an executed krug reaction whose holder is still alive', () => {
    let s = accepted(api.startMatchCombat(withGaren(prepared('2-7'))));
    const executedForLiving = (m: api.MatchState) => m.combat?.companionState?.reactions.find(r => r.status === 'executed' && m.combat!.units.find(u => u.id === r.targetId)!.alive);
    while (s.phase === 'combat' && !executedForLiving(s)) s = api.stepMatch(s).state;
    expect(s.phase).toBe('combat');
    const reaction = executedForLiving(s)!;
    rejects(s, x => { x.combat.companionState.reactions = x.combat.companionState.reactions.filter((r: any) => r.key !== reaction.key); });
  });
});
