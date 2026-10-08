import { describe, expect, it } from 'vitest';
import { wearing, enemy, run, packets } from './fixtures/m8-b4-items';
import { itemMatch } from './fixtures/m8-b4-match';
import { accepted, readyMatch, resolveM5Choices } from './match-helpers';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { stepCombat, type CombatUnit } from '../src/simulation/combat';
import { startMatchCombat, stepMatch, nextRound, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { readItemCatalog } from '../src/simulation/item-catalog';

const contributions = (unit: CombatUnit, item: string) => unit.mechanismState!.statuses
  .flatMap(g => g.contributions).filter(c => c.source.definitionId === item);
const stacks = (unit: CombatUnit) => unit.triggerLedger?.runtimes.find(r => r.counters.stacks !== undefined)?.counters.stacks ?? 0;

describe('B4 audit R1: qualified packets and counter projections', () => {
  it.each(['morellonomicon', 'red-buff', 'last-whisper'])('%s listens to all three positive Urgot skill targets', item => {
    const p = wearing(item, { definitionId: 'urgot', ability: resolveAbility('urgot-ability', 1), mana: 1000 });
    const r = run(p, 1, [enemy('a', 1, 3), enemy('b', 2, 3), enemy('c', 1, 2)]);
    expect(packets(r.events).filter(e => e.source.sourceKind === 'ability').map(e => e.unitId)).toEqual(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) {
      const c = contributions(r.state.units.find(u => u.id === id)!, item);
      expect(c.map(c => c.application.kind).sort()).toEqual(item === 'last-whisper' ? ['sunder'] : ['burn', 'wound']);
      if (item === 'last-whisper') expect(c[0].application.magnitudeBps).toBe(3000);
    }
  });

  it.each(['morellonomicon', 'red-buff'])('%s: ineligible Runaan arrow settles first without spending burn allowance', item => {
    const r = run(wearing([item, 'runaans-hurricane'], { targetId: 'z' }), 1, [enemy('z', 1, 3), enemy('a', 2, 3)]);
    expect(packets(r.events).map(e => e.unitId)).toEqual(['a', 'z']);
    expect(packets(r.events)[0].source.definitionId).toBe('runaans-hurricane');
    expect(contributions(r.state.units.find(u => u.id === 'a')!, item)).toEqual([]);
    expect(contributions(r.state.units.find(u => u.id === 'z')!, item).map(c => c.application.kind).sort()).toEqual(['burn', 'wound']);
  });

  it('Last Whisper applies 30% sunder to both root attack and physical Runaan arrow', () => {
    const r = run(wearing(['last-whisper', 'runaans-hurricane'], { targetId: 'z' }), 1, [enemy('z', 1, 3), enemy('a', 2, 3)]);
    expect(packets(r.events).map(e => e.unitId)).toEqual(['a', 'z']);
    for (const id of ['a', 'z']) expect(contributions(r.state.units.find(u => u.id === id)!, 'last-whisper')[0].application.magnitudeBps).toBe(3000);
  });

  it.each([false, true])('Titan same-action Ezreal double packet: two stacks update both attributes at next tick (shield=%s)', shield => {
    const p = wearing(shield ? ['titans-resolve', 'crownguard', 'warmog'] : 'titans-resolve', { cooldownTicks: 1000 });
    const e = enemy('e', 1, 3, { definitionId: 'ezreal', ability: resolveAbility('ezreal-ability', 1), attackDamage: 100, mana: 1000, maxMana: 1000 });
    const r = run(p, 1, [e]);
    const hits = packets(r.events, 'e');
    expect(hits).toHaveLength(2); expect(hits[0].actionSeq).toBe(hits[1].actionSeq);
    expect(hits.every(h => h.absorbed + h.hpDamage > 0)).toBe(true);
    if (shield) { expect(hits.every(h => h.hpDamage === 0)).toBe(true); expect(r.p.hp).toBe(1904); }
    expect(stacks(r.p)).toBe(2);
    expect(readCombatStats(r.p, r.state)).toMatchObject({ attackDamage: 100, abilityPower: shield ? 120 : 100 });
    const next = stepCombat(r.state).state;
    expect(readCombatStats(next.units.find(u => u.id === 'p')!, next)).toMatchObject({ attackDamage: 104, abilityPower: shield ? 124 : 104 });
    expect(stepCombat(JSON.parse(JSON.stringify(r.state)))).toEqual(stepCombat(r.state));
  });

  it('Titan zero actual incoming damage does not count or create a growth projection', () => {
    const r = run(wearing('titans-resolve', { cooldownTicks: 1000 }), 1, [enemy('e', 1, 3, { cooldownTicks: 0, attackDamage: 0 })]);
    expect(stacks(r.p)).toBe(0); expect(contributions(r.p, 'titans-resolve')).toEqual([]);
  });

  it('5-1 real Match progression with Titan/Warmog/Gunblade saves through enemy same-action double damage', () => {
    let s: MatchState = readyMatch();
    // A valid strong preparation fixture; rounds, enemy templates and combat
    // are subsequently produced only by the public Match commands.
    s = { ...s, preparation: { ...s.preparation, units: s.preparation.units.map(u => u.id === 'unit-1'
      ? { ...u, definitionId: 'garen', starLevel: 3 } : u.team === 'player' ? { ...u, location: { kind: 'bench', slot: Number(u.id.slice(5)) - 2 } } : u) },
      items: [...s.items, ...['titans-resolve', 'warmog', 'gunblade'].map((definitionId, slot) => ({ id: `item-${s.nextItemSerial + slot}`, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot } }))], nextItemSerial: s.nextItemSerial + 3 };
    expect(restoreMatch(serializeMatch(s))).toEqual(s);
    while (s.round < 22) {
      s = resolveM5Choices(s);
      if (s.phase === 'preparation') s = accepted(startMatchCombat(s));
      while (s.phase === 'combat') s = stepMatch(s).state;
      s = resolveM5Choices(s);
      expect(s.phase).toBe('settlement');
      s = accepted(nextRound(s, s.round));
    }
    s = resolveM5Choices(s); expect(s.roundDefinitionId).toBe('5-1');
    s = accepted(startMatchCombat(s)); expect(restoreMatch(serializeMatch(s))).toEqual(s);
    let witnessed = false;
    for (let tick = 0; tick < 120 && s.phase === 'combat'; tick++) {
      const before = s.combat.units.find(u => u.id === 'unit-1')!;
      const result = stepMatch(s); s = result.state;
      const hits = result.events.filter(e => e.type === 'packetDamage' && e.unitId === 'unit-1' && e.absorbed + e.hpDamage > 0);
      if (hits.some((a, i) => hits.some((b, j) => i !== j && a.type === 'packetDamage' && b.type === 'packetDamage' && a.actionSeq === b.actionSeq && a.source.ownerId === b.source.ownerId))) {
        witnessed = true; expect(stacks(s.combat!.units.find(u => u.id === 'unit-1')!)).toBeGreaterThanOrEqual(Math.min(25, stacks(before) + 2));
      }
      const restored = restoreMatch(serializeMatch(s)); expect(restored).toEqual(s); expect(stepMatch(restored)).toEqual(stepMatch(s));
    }
    expect(witnessed).toBe(true);
  }, 120000);
});

describe('B4 audit R3: projection semantics and active-effect receipt references', () => {
  it.each(['kind', 'amount'])('R3a rejects Giant Slayer projection forged %s, leaving genuine save valid', field => {
    const s = itemMatch('giant-slayer'); const json = serializeMatch(s); const raw = JSON.parse(json);
    const projected = raw.combat.units.find((u: CombatUnit) => u.id === 'unit-1').statuses.find((s: { source: { definitionId: string } }) => s.source.definitionId === 'giant-slayer');
    if (field === 'kind') projected.kind = 'stun'; else projected.amount++;
    expect(() => restoreMatch(raw)).toThrow(/item status semantic projection/);
    expect(() => restoreMatch(JSON.stringify(raw))).toThrow(/item status semantic projection/);
    expect(serializeMatch(s)).toBe(json); expect(restoreMatch(json)).toEqual(s);
  });

  it('R3b rejects deletion of the entire Bloodthirster receipt while its granted shield is active', () => {
    let s = itemMatch('bloodthirster');
    if (s.phase !== 'combat') throw Error('combat fixture');
    s = { ...s, combat: { ...s.combat, units: s.combat.units.map(u => u.id === 'unit-1' ? { ...u, hp: 280 } : u) } };
    for (let i = 0; i < 100 && s.phase === 'combat' && !s.combat.units.find(u => u.id === 'unit-1')!.shield; i++) s = stepMatch(s).state;
    const original = serializeMatch(s); const raw = JSON.parse(original);
    const holder = raw.combat.units.find((u: CombatUnit) => u.id === 'unit-1');
    expect(holder.maxHp).toBe(700); expect(holder.shield).toBe(175);
    expect(holder.mechanismState.runtimes.some((r: { source: { definitionId: string }; consumed: boolean }) => r.source.definitionId === 'bloodthirster' && r.consumed)).toBe(true);
    holder.mechanismState.runtimes = [];
    expect(() => restoreMatch(raw)).toThrow(/incomplete survival consumption/);
    expect(() => restoreMatch(JSON.stringify(raw))).toThrow(/incomplete survival consumption/);
    expect(serializeMatch(s)).toBe(original); expect(stepMatch(restoreMatch(original))).toEqual(stepMatch(s));
  });
});

describe('B4 audit R4: declaration-owned evidence and mechanism descriptions', () => {
  it('only B-07/B-10 are approved-provisional; Titan describes actual stack and cap rules', () => {
    const catalog = readItemCatalog();
    expect(catalog.filter(i => i.evidenceStatus === 'approved-provisional').map(i => i.id).sort()).toEqual(['red-buff', 'runaans-hurricane']);
    expect(catalog.find(i => i.id === 'runaans-hurricane')!.conventionIds).toContain('B-10');
    const titan = catalog.find(i => i.id === 'titans-resolve')!.effectDescriptions.join('；');
    for (const fragment of ['完成普攻', '每个正实际承伤包', '护盾承伤', '下一tick', '持续本场', '最多25层', '只授予一次', '零伤害']) expect(titan).toContain(fragment);
  });
});
