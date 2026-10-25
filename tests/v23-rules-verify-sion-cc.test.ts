import { describe, expect, it } from 'vitest';
import { COMBAT_TICK_MS, createCombat, createCombatWithEvents, stepCombat, type CombatState, type CombatStep, type CombatUnit } from '../src/simulation/combat';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { resolveAbility } from '../src/simulation/combat-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import { effectiveStatuses } from '../src/simulation/m8/status';
import { battle, freeze, unit } from './combat-helpers';

// Expected values below are independently transcribed from the user-approved v23 checklist.
// Production tables supply combat inputs only, never expected coefficients or durations.
const get = (c: CombatState, id: string) => c.units.find(u => u.id === id)! as S13Unit;
const sion = (c: CombatState) => c.units.find(u => u.definitionId === 'g23-sion')! as S13Unit;
const patch = (c: CombatState, id: string, p: Partial<CombatUnit>): CombatState =>
  ({ ...c, units: c.units.map(u => u.id === id ? { ...u, ...p } : u) });
const advance = (c: CombatState, n: number): CombatState => {
  for (let i = 0; i < n; i++) c = stepCombat(freeze(c)).state;
  return c;
};
const dummy = (id: string, col: number, row: number) => unit(id, 'enemy', col, row, {
  definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
  hp: 100000, maxHp: 100000, attackDamage: 0, cooldownTicks: 10000, moveCooldownTicks: 10000,
});
function army(tier: number, firstStar: 1 | 2 | 3 = 1): CombatState {
  const state = createMatch(42), round = getCatalogRoundById('2-1');
  const ids = ['morgana', 'vladimir', 'cassiopeia', 'elise', 'leblanc', 'singed', 'trundle'].slice(0, tier);
  const emblem = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!;
  const preparation = { ...state.preparation, units: [
    ...ids.map((definitionId, i) => ({ id: `member-${i}`, definitionId, team: 'player' as const,
      starLevel: i === 0 ? firstStar : 1 as const, location: { kind: 'board' as const, cell: { col: i, row: 7 } } })),
    { id: 'enemy', definitionId: 'garen', team: 'enemy' as const, starLevel: 1 as const,
      location: { kind: 'board' as const, cell: { col: 3, row: 3 } } },
  ] };
  const input = { ...state, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round }, preparation,
    items: ids.slice(5).map((_, i) => ({ id: `emblem-${i}`, definitionId: emblem.id,
      location: { kind: 'unit' as const, unitId: `member-${i + 5}`, slot: 0 } })),
  };
  const c = createCombatWithEvents(preparation, buildStrategySnapshot(input), 'independent-v23', 42).state;
  return { ...c, units: c.units.map(u => u.id === 'enemy' ? dummy('enemy', 3, 3)
    : { ...u, cooldownTicks: 10000, moveCooldownTicks: 10000, mana: 0, maxMana: 0 }) };
}
const controls = (c: CombatState, id: string) => get(c, id).mechanismState?.statuses
  .filter(g => g.kind === 'stun').flatMap(g => g.contributions) ?? [];
const packets = (r: CombatStep, owner: string) => r.events.filter(e => e.type === 'packetDamage')
  .map(e => e.outcome).filter(o => o.context.source.ownerId === owner);
function released(tier: number): CombatState {
  const c = army(tier), u = sion(c);
  return patch(c, u.id, { runtime: { ...u.runtime, buddyTriggered: true } });
}
function revived(): CombatState {
  let c = released(7), u = sion(c);
  c = patch(c, u.id, { hp: 0 });
  c = advance(c, 21);
  // Suppress actions after revival so each test can arrange its own isolated attack/cast.
  return patch(c, u.id, { mana: 0, maxMana: 0, cooldownTicks: 10000, moveCooldownTicks: 10000 });
}

describe('v23 independent approved Sion and crowd-control rules', () => {
  it('unmodified Sion body has 750 HP, 50 AD, zero armor, 120/120 mana, 0.7 AS and range 1', () => {
    const c = createCombat({ ...createMatch(42).preparation, units: [
      { id: 'base', definitionId: 'g23-sion', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } },
      { id: 'e', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 3 } } },
    ] });
    expect(sion(c)).toMatchObject({ hp: 750, maxHp: 750, attackDamage: 50, armor: 0,
      mana: 120, maxMana: 120, baseAttackSpeedBps: 7000, attackRange: 1, attackIntervalTicks: 29 });
    expect(stepCombat(c).state.tick).toBe(1);
  });

  it.each([[3, 40], [4, 45], [5, 50], [7, 100]])('Black Rose %i grants %i armor and MR', (tier, resist) => {
    expect(sion(army(tier))).toMatchObject({ armor: resist, magicResist: resist });
  });

  it.each([[1, 1087, 68], [2, 1200, 74], [3, 1312, 80]] as const)(
    'tier 3 with first member at star %i scales every member star by 15%% HP and 12%% AD', (star, hp, ad) => {
      // Total stars 3/4/5: floor(750 × (1 + .15 × stars)), floor(50 × (1 + .12 × stars)).
      expect(sion(army(3, star))).toMatchObject({ maxHp: hp, hp, attackDamage: ad });
    });

  it.each([3, 4, 5, 7])('tier %i active shields for 3 s and line-stuns for 1 s without knock-up', tier => {
    let c = released(tier), u = sion(c);
    c = { ...c, units: [...c.units.filter(x => x.team === 'player'), dummy('enemy', 3, 3), dummy('off', 0, 0)] };
    c = patch(c, u.id, { abilityPower: 100, mana: 120, maxMana: 120 });
    const r = stepCombat(freeze(c));
    expect(r.events.filter(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === u.id)).toHaveLength(1);
    const layer = sion(r.state).shieldLayers.find(x => x.source.ownerId === u.id)!;
    expect(layer.expiresAtTick - r.state.tick).toBe(60);
    expect(layer.remaining).toBe(tier >= 5 ? 75 : 175);
    const cc = controls(r.state, 'enemy');
    expect(cc).toHaveLength(1);
    expect(cc[0].expiresAtTick! - cc[0].appliedAtTick).toBe(20);
    expect(cc[0].application.knockup).toBeUndefined();
    expect(controls(r.state, 'off')).toHaveLength(0);
    expect(sion(advance(r.state, 59)).shield).toBe(tier >= 5 ? 75 : 175);
    expect(sion(advance(r.state, 60)).shield).toBe(0);
  });

  it.each([100, 200])('tier 5 active shields for exactly 75 percent of %i AP', ap => {
    let c = released(5), u = sion(c);
    c = patch(c, u.id, { abilityPower: ap, mana: 120, maxMana: 120 });
    expect(sion(stepCombat(c).state).shield).toBe(ap === 100 ? 75 : 150);
  });

  it.each([[4, false], [5, true], [6, true]] as const)('unshackle at %i accumulated member casts: %s', (casts, unlock) => {
    let c = army(3), member = get(c, 'member-0');
    // Split the total between two actual Black Rose members; Sion's own casts do not count.
    c = patch(c, member.id, { runtime: { ...member.runtime, castCount: casts - 1 } });
    c = patch(c, 'member-1', { runtime: { ...get(c, 'member-1').runtime, castCount: 1 } });
    c = patch(c, sion(c).id, { runtime: { ...sion(c).runtime, castCount: 10 } });
    const r = stepCombat(c);
    expect(sion(r.state).runtime.buddyTriggered).toBe(unlock);
    expect(r.events.filter(e => e.type === 'bindingChanged' && !e.bound)).toHaveLength(unlock ? 1 : 0);
  });

  it('five actual Black Rose casts release Sion on the next combat step, not after four', () => {
    let c = army(3);
    for (let count = 1; count <= 5; count++) {
      c = patch(c, 'member-0', { mana: 120, maxMana: 120, manaLockedUntilTick: 0, attackRange: 20 });
      const r = stepCombat(c); c = r.state;
      expect(r.events.filter(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === 'member-0')).toHaveLength(1);
      expect(get(c, 'member-0').runtime.castCount).toBe(count);
      expect(sion(c).runtime.buddyTriggered).toBe(false);
    }
    const r = stepCombat(c);
    expect(sion(r.state).runtime.buddyTriggered).toBe(true);
    expect(r.events.filter(e => e.type === 'bindingChanged' && !e.bound)).toEqual([
      expect.objectContaining({ unitId: sion(c).id, reason: 'casts' }),
    ]);
  });

  it.each([[651, false], [650, false], [649, true]] as const)('unshackle HP boundary %i/1000: %s', (hp, unlock) => {
    let c = army(3);
    c = patch(c, sion(c).id, { hp, maxHp: 1000, maxHpBasis: { base: 1000, flat: 0, bps: 0, bonusBps: 0 } });
    expect(sion(stepCombat(c).state).runtime.buddyTriggered).toBe(unlock);
  });

  it('charge selects nearest enemy, hits every path occupant for 100% AD and knocks up for 0.5 s', () => {
    let c = army(4), u = sion(c);
    // Co-located test targets exercise the multi-hit path loop: a nearest-enemy path normally ends at its first occupant.
    c = { ...c, units: [...c.units.filter(x => x.team === 'player'), dummy('near-a', 3, 2), dummy('near-b', 3, 2), dummy('far', 3, 0), dummy('off', 0, 4)] };
    c = patch(c, u.id, { hp: 1, attackDamage: 100, attackDamageBase: 100, attackDamagePercentBps: 0 });
    const r = stepCombat(c), hits = packets(r, u.id);
    expect(hits.map(o => o.context.targetId).sort()).toEqual(['near-a', 'near-b']);
    expect(hits.map(o => [o.raw, o.hpDamage])).toEqual([[100, 100], [100, 100]]);
    for (const id of ['near-a', 'near-b']) {
      const cc = controls(r.state, id);
      expect(cc).toHaveLength(1);
      expect(cc[0].application.knockup).toBe(true);
      expect(cc[0].expiresAtTick! - cc[0].appliedAtTick).toBe(10);
    }
    expect(controls(r.state, 'far')).toHaveLength(0);
    expect(controls(r.state, 'off')).toHaveLength(0);
    expect(r.events.filter(e => e.type === 'movement' && e.unitId === u.id)).toHaveLength(1);
    expect(sion(r.state).cell).toEqual({ col: 2, row: 1 });
    expect(sion(stepCombat(r.state).state).runtime.buddyTriggered).toBe(true);
    expect(packets(stepCombat(r.state), u.id)).toHaveLength(0);
  });

  it('only charge-hit enemies receive 8% amplified damage from Black Rose members', () => {
    let c = army(4), u = sion(c);
    c = { ...c, units: [...c.units.filter(x => x.team === 'player'), dummy('enemy', 3, 3), dummy('off', 0, 0)] };
    c = patch(c, u.id, { hp: 1 });
    c = stepCombat(c).state;
    for (const [id, expected] of [['enemy', 108], ['off', 100]] as const) {
      let probe = patch(c, 'member-0', { cell: { col: 2, row: 4 }, attackRange: 20,
        targetId: id, cooldownTicks: 0, attackDamage: 100, attackDamageBase: 100,
        attackDamagePercentBps: 0, baseCritChanceBps: 0 });
      // Keep exactly one candidate so target acquisition is independent of previous target locks.
      probe = { ...probe, units: probe.units.filter(x => x.team === 'player' || x.id === id) };
      const hit = packets(stepCombat(probe), 'member-0');
      expect(hit).toHaveLength(1);
      expect(hit[0].hpDamage).toBe(expected);
    }
  });

  it.each([3, 4, 5, 7])('tier %i unshackle heals missing HP and grants 100 AP only at tier 5+', tier => {
    let c = army(tier), u = sion(c);
    c = patch(c, u.id, { hp: 1, abilityPower: 100 });
    c = stepCombat(c).state;
    expect(sion(c).hp).toBe(tier >= 5 ? u.maxHp : 1);
    // Read AP through a real subsequent active shield, not a production stat resolver.
    c = patch(c, u.id, { mana: 120, maxMana: 120, attackRange: 20 });
    expect(sion(stepCombat(c).state).shield).toBe(tier >= 5 ? 150 : 175);
  });

  it('tier 7 revives once after 20 ticks at 75% HP; lower tiers die permanently', () => {
    for (const tier of [3, 4, 5, 7]) {
      let c = released(tier), u = sion(c);
      c = stepCombat(patch(c, u.id, { hp: 0 })).state;
      if (tier < 7) { expect(sion(c).alive).toBe(false); expect(sion(c).g23Sion).toBeUndefined(); continue; }
      expect(sion(c).hp).toBe(Math.floor(u.maxHp * 0.75));
      expect(sion(c).g23Sion).toEqual({ reviveAtTick: 21, revived: false });
      for (let tick = 2; tick <= 21; tick++) {
        const r = stepCombat(c); c = r.state;
        expect(c.tick).toBe(tick);
        expect(sion(c).g23Sion!.revived).toBe(tick === 21);
        expect(r.events.filter(e => e.type === 'unitRevived' && e.unitId === u.id)).toHaveLength(tick === 21 ? 1 : 0);
      }
      const death = stepCombat(patch(c, u.id, { hp: 0 }));
      expect(sion(death.state).alive).toBe(false);
      expect(death.events.filter(e => e.type === 'unitRevived')).toHaveLength(0);
    }
  });

  it('revived Sion gains +300% AS and heals 40% of actual attack damage', () => {
    let c = revived(), u = sion(c);
    c = patch(c, u.id, { hp: 100, attackDamage: 100, attackDamageBase: 100, attackDamagePercentBps: 0,
      baseCritChanceBps: 0, cooldownTicks: 0, attackRange: 20, baseAttackSpeedBps: 7000 });
    let r = stepCombat(c);
    expect(packets(r, u.id).map(o => o.hpDamage)).toEqual([100]);
    expect(sion(r.state).hp).toBe(140);
    expect(sion(r.state).mechanismState!.statuses.flatMap(g => g.contributions).map(x => x.application.modifier))
      .toContainEqual(expect.objectContaining({ stat: 'attackSpeed', unit: 'bps', value: { kind: 'constant', amount: 30000 } }));
    expect(sion(r.state).cooldownTicks).toBe(8); // ceil(20 / (.7 × (1 + 3))) by the existing integer-tick contract.
    c = advance(r.state, 7);
    expect(sion(c).hp).toBe(140);
    r = stepCombat(c);
    expect(packets(r, u.id).map(o => o.hpDamage)).toEqual([100]);
    expect(sion(r.state).hp).toBe(180);
  });

  it('revival CC immunity remains effective late in combat and blocks a real Vi knock-up', () => {
    let c = revived(), u = sion(c);
    c = advance(c, 100);
    expect(effectiveStatuses(sion(c).mechanismState!.statuses, c.tick).some(g => g.kind === 'control-immunity')).toBe(true);
    const vi = unit('hostile-vi', 'enemy', 3, 3, { definitionId: 'vi', ability: resolveAbility('vi-ability', 1),
      hp: 100000, maxHp: 100000, mana: 1000, maxMana: 100, attackRange: 20, moveCooldownTicks: 10000 });
    c = { ...c, units: [get(c, 'member-0'), sion(c), vi] };
    c = patch(c, 'member-0', { cell: { col: 3, row: 4 }, hp: 100000, maxHp: 100000 });
    c = patch(c, u.id, { cell: { col: 5, row: 4 } });
    const r = stepCombat(c);
    expect(r.events.some(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === vi.id)).toBe(true);
    expect(controls(r.state, 'member-0')).toHaveLength(1);
    expect(controls(r.state, u.id)).toHaveLength(0);
    expect(effectiveStatuses(sion(r.state).mechanismState!.statuses, r.state.tick).some(g => g.kind === 'control-immunity')).toBe(true);
    c = advance(r.state, c.maxTicks - 1 - r.state.tick);
    expect(c.tick).toBe(c.maxTicks - 1);
    expect(effectiveStatuses(sion(c).mechanismState!.statuses, c.tick).some(g => g.kind === 'control-immunity')).toBe(true);
    expect(stepCombat(c).state.status).toBe('finished');
  });

  it.each([['ambessa', 1, 20, false], ['vi', 0, 10, true]] as const)(
    '%s applies independently specified CC duration and knock-up flag', (id, casts, ticks, knockup) => {
      let c = army(3);
      const base = get(c, 'member-0');
      const caster = { ...base, id: 'caster', definitionId: id, ability: resolveAbility(`${id}-ability`, 1),
        cell: { col: 3, row: 4 }, mana: 200, maxMana: 100, attackRange: 6,
        runtime: { ...base.runtime, castCount: casts }, mechanics: [], sources: [] };
      c = battle([caster, dummy('enemy', 3, 3), dummy('row', 5, 3), dummy('off', 5, 1)],
        { strategy: { traits: [], units: [] }, combatId: 'independent-cc', rngState: 42 });
      const r = stepCombat(c), cc = controls(r.state, id === 'vi' ? 'row' : 'enemy');
      expect(r.events.some(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === 'caster')).toBe(true);
      expect(cc).toHaveLength(1);
      expect(cc[0].expiresAtTick! - cc[0].appliedAtTick).toBe(ticks);
      expect(cc[0].application.knockup === true).toBe(knockup);
      expect(controls(r.state, 'off')).toHaveLength(0);
    });

  it('Vander casts and completes his channel without applying any taunt or forced retarget', () => {
    const c = createCombat({ ...createMatch(42).preparation, units: [
      { id: 'vander', definitionId: 'vander', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } },
      { id: 'ally', definitionId: 'garen', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 3 } } },
      { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 3 } } },
    ] });
    let live = patch(c, 'vander', { mana: 1000, cooldownTicks: 10000, moveCooldownTicks: 10000 });
    live = patch(live, 'ally', { cooldownTicks: 10000, moveCooldownTicks: 10000, mana: 0, maxMana: 0 });
    live = { ...live, units: live.units.map(x => x.id === 'enemy' ? { ...dummy('enemy', 3, 3), targetId: 'ally' } : x) };
    for (let tick = 1; tick <= 61; tick++) {
      const r = stepCombat(live); live = r.state;
      if (tick === 1) expect(r.events.some(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === 'vander')).toBe(true);
      expect(get(live, 'enemy').targetId).toBe('ally');
      expect(live.units.flatMap(x => x.mechanismState?.statuses ?? []).some(g => String(g.kind) === 'taunt')).toBe(false);
    }
    expect(get(live, 'vander').runtime.nextAttackPhysical).toBeGreaterThan(0);
  });

  it('20 real combat steps equal one second at the public combat clock rate', () => {
    const c = army(3), after = advance(c, 20);
    expect(after.tick - c.tick).toBe(20);
    expect((after.tick - c.tick) * COMBAT_TICK_MS).toBe(1000);
  });
});
