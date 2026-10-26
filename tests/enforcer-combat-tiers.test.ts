import { expect, it } from 'vitest';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createMatch } from '../src/simulation/match';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { readCombatStats } from '../src/simulation/combat-s13';
import { stepCombat } from '../src/simulation/combat';
import { readUnitStatusRows } from '../src/presentation/combat-status';
import { compileBattle, snapshotForBattle, startTwoSidedCombat } from '../src/server-entry';
import type { Unit } from '../src/simulation/unit-types';

const natives = ['maddie', 'steb', 'camille', 'loris', 'twistedfate', 'vi', 'caitlyn'];
const emblem = Object.values(EMBLEM_ITEMS).find(item => item.emblemTrait === 'enforcer')!.id;
function army(count: number) {
  const base = createMatch(42), round = getCatalogRoundById('4-1');
  const names = [...natives.slice(0, count), ...Object.values(M5_UNIT_DEFINITIONS)
    .filter(d => !d.summon && d.unitKind !== 'neutral' && !d.traits.includes('enforcer')).slice(0, Math.max(0, count - natives.length)).map(d => d.id)];
  const units: Unit[] = names.map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId, team: 'player', starLevel: 1,
    location: { kind: 'board', cell: { col: i % 7, row: 4 + Math.floor(i / 7) } } }));
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 10, preparation: { ...base.preparation, units }, items: names.flatMap((name, i) => natives.includes(name) ? [] : [{
    id: `item-${i + 1}`, definitionId: emblem, location: { kind: 'unit' as const, unitId: `unit-${i + 1}`, slot: 0 },
  }]) };
}

it.each([[2, 1200, 1200, 1], [4, 2000, 2000, 2], [6, 3000, 3300, 4], [8, 4000, 5000, 5], [10, 10000, 15000, 99]])(
  'multiplayer Enforcer %i applies shield, damage amp, authoritative wanted list and one speed bonus per death',
  (tier, shieldBps, damageBps, wantedCount) => {
    const a = army(tier), b = army(6);
    // A real compiled multiplayer battle uses namespaced ids and both teams' rules.
    const input = compileBattle(snapshotForBattle(a, 'A'), snapshotForBattle(b, 'B'), 42, { battleId: `wanted-${tier}` });
    const started = startTwoSidedCombat(input);
    const members = started.units.filter(u => u.team === 'player');
    const enemies = started.units.filter(u => u.team === 'enemy').sort((a, b) => b.maxHp - a.maxHp || (a.id < b.id ? -1 : 1));
    const wanted = enemies.slice(0, wantedCount).map(u => u.id);
    for (const unit of members) {
      expect(unit.shield).toBe(Math.floor(unit.maxHp * shieldBps / 10000));
      expect(unit.g22?.wanted).toEqual(wanted);
      expect(unit.mechanics?.find(m => m.mechanic === 'damageAmp')?.values.bps).toBe(damageBps);
    }
    // Same battle seed and first attack: removing only this trait's damageAmp must reduce actual packet damage.
    const firstAttack = (initial: typeof started) => {
      let state = initial;
      for (let i = 0; i < 40; i++) {
        const step = stepCombat(state); state = step.state;
        const packet = step.events.find(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === members[0].id && e.outcome.context.delivery === 'basic-attack');
        if (packet?.type === 'packetDamage') return packet.outcome;
      }
      throw new Error('No Enforcer attack in fixture');
    };
    const withoutAmp = { ...started, units: started.units.map(u => u.id !== members[0].id ? u : { ...u,
      mechanics: u.mechanics?.filter(m => !(m.mechanic === 'damageAmp' && m.source.definitionId === 'enforcer')) }) };
    const amplified = firstAttack(started), plain = firstAttack(withoutAmp);
    expect(amplified.context.targetId).toBe(plain.context.targetId);
    expect(amplified.critical).toBe(plain.critical);
    expect(amplified.mitigated).toBeGreaterThan(plain.mitigated);
    // Keep a non-wanted victim alive so a single death cannot immediately end the battle.
    const victim = wanted[0];
    const killed = { ...started, units: started.units.map(u => u.id === victim ? { ...u, hp: 0, alive: false } : u) };
    const bonuses = (state: typeof started, id: string) => readUnitStatusRows(state, id).filter(row => row.source.definitionId === 'enforcer' && row.magnitude.includes('30'));
    expect(bonuses(started, members[0].id)).toHaveLength(0);
    const next = stepCombat(killed).state;
    const owner = next.units.find(u => u.id === members[0].id)!;
    expect(owner.g22?.wantedDeaths).toBe(1);
    expect(readCombatStats(owner, next).attackIntervalTicks).toBeLessThan(readCombatStats(members[0], started).attackIntervalTicks);
    expect(bonuses(next, owner.id)).toHaveLength(1);
    const repeated = stepCombat(next).state;
    expect(bonuses(repeated, owner.id)).toHaveLength(1);
    expect(readCombatStats(repeated.units.find(u => u.id === owner.id)!, repeated).attackIntervalTicks).toBe(readCombatStats(owner, next).attackIntervalTicks);
  });
