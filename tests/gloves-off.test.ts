import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { GLOVES_OFF } from '../src/simulation/content/gloves-off';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { abilityDisplayValues, glovesOffDisplayValues } from '../src/simulation/ability-display';
import { abilityText } from '../src/presentation/ability-text';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';
import { glovesOffUnitId } from '../src/presentation/hero-ability';
import { DISPLACEMENT_REASONS } from '../src/presentation/control-display';
import { hexDistance } from '../src/simulation/board';

// 卯足全力 (TFT13_Augment_PrimeCarry), 14.24b TFT13_PrimeSpellHero: 0.5 s cast, ×1.85, punch knocks back, 0.75 s stun, +60 mana.
/** e0 stands in front of Vander (a Garen when `movableTarget`, else a training dummy that never moves); e1 is a dummy next
 * to e0 and e2 a dummy far away. */
function vanderCombat(augments: readonly string[], movableTarget = false) {
  const m = createMatch(42), u = m.preparation.units[0];
  const units = [{ ...u, id: 'h0', definitionId: 'vander', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 4 } } },
    ...[{ col: 3, row: 3 }, { col: 4, row: 3 }, { col: 0, row: 0 }].map((cell, i) => ({ ...u, id: 'e' + i, definitionId: i === 0 && movableTarget ? 'garen' : 'training-dummy', starLevel: 1 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell } }))];
  const preparation = { ...m.preparation, units };
  const strategy = buildStrategySnapshot({ ...m, round: 10, preparation, augments: augments.map(definitionId => ({ definitionId, choiceId: 't', acquiredRound: 1 })) });
  return createCombatWithEvents(preparation, strategy, 'gloves-off', 42).state;
}
function run(state: ReturnType<typeof vanderCombat>, limit = 1200) {
  const events: any[] = []; let c: any = state;
  while (c.status === 'running' && c.tick < limit) {
    const step = stepCombat(c); c = step.state; events.push(...(step.events as any[]));
    if (events.some(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'attack-extra' && e.outcome.context.source.ownerId === 'h0')) break;
  }
  return { c, events };
}

describe('卯足全力 hero spell', () => {
  it('display copies equal the augment row, and the row carries the 60 extra mana', () => {
    const row = AUGMENT_BATCH3['all-out'];
    expect([10000 + Math.round(row.source.values.TooltipBonusDamage! * 10000), Math.round(row.source.values.TOOLTIPONLYSplashPerc! * 10000)]).toEqual([GLOVES_OFF.damageBps, GLOVES_OFF.splashBps]);
    expect(row.source.values['{8cfa39af}']).toBe(GLOVES_OFF.manaIncrease);
    const live = vanderCombat(['all-out']).units.find(u => u.id === 'h0')!.mechanics!.find(m => m.mechanic === 'heroCarryLive')!.values;
    expect(live).toMatchObject({ manaIncrease: 60, damageBps: 18500, splashBps: 2500 });
  });

  it('costs 60 more mana than the plain Vander (50 → 110)', () => {
    const hero = vanderCombat(['all-out']).units.find(u => u.id === 'h0')!, plain = vanderCombat([]).units.find(u => u.id === 'h0')!;
    expect(plain.maxMana).toBe(50);
    expect(hero.maxMana).toBe(plain.maxMana + GLOVES_OFF.manaIncrease);
  });

  it('casts for 0.5 s (no resists, no 2.5 s brace), then the punch knocks the target back, stuns it 0.75 s and splashes 25% to enemies it hits', () => {
    const { c, events } = run(vanderCombat(['all-out'], true));
    expect(events.some(e => e.type === 'cast' && e.receipt?.source.ownerId === 'h0')).toBe(true);
    const channel = c.units.find((u: any) => u.id === 'h0').mechanismState.activities.find((a: any) => a.kind === 'channel');
    expect(channel.expiresAtTick - channel.startsAtTick).toBe(GLOVES_OFF.castTicks);
    expect(events.some(e => e.type === 'statusChanged' && e.group?.targetId === 'h0' && e.group.kind === 'resistanceFlat')).toBe(false);
    const empowered = events.filter(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'basic-attack' && e.outcome.context.source.ownerId === 'h0').at(-1);
    const targetId = empowered.outcome.context.targetId;
    const move = events.find(e => e.type === 'movement' && e.reason === 'vander-knockback');
    expect(move.unitId).toBe(targetId);
    expect(hexDistance(move.from, move.to)).toBeGreaterThan(0);
    expect(hexDistance(move.from, move.to)).toBeLessThanOrEqual(GLOVES_OFF.knockbackHexes);
    const vander = c.units.find((u: any) => u.id === 'h0');
    expect(hexDistance(vander.cell, move.to)).toBeGreaterThan(hexDistance(vander.cell, move.from));
    const stun = c.units.find((u: any) => u.id === targetId).mechanismState.statuses.find((g: any) => g.kind === 'stun').contributions[0];
    expect(stun.expiresAtTick - stun.appliedAtTick).toBe(GLOVES_OFF.stunTicks);
    const splash = events.filter(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'attack-extra' && e.outcome.context.source.ownerId === 'h0');
    expect(splash.length).toBeGreaterThan(0);
    expect(splash.every(e => e.outcome.context.targetId !== targetId && e.outcome.raw === Math.floor(empowered.outcome.raw * GLOVES_OFF.splashBps / 10000))).toBe(true);
  });

  it('a target that cannot be moved stays put; the splash then hits only its neighbours', () => {
    const { events } = run(vanderCombat(['all-out']));
    expect(events.some(e => e.type === 'movement' && e.reason === 'vander-knockback')).toBe(false);
    const splash = events.filter(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'attack-extra' && e.outcome.context.source.ownerId === 'h0');
    expect(splash.map(e => e.outcome.context.targetId)).toEqual(['e1']);
  });

  it('a plain Vander still braces 2.5 s and moves nobody', () => {
    const plain: any = vanderCombat([]); let c = plain; const events: any[] = [];
    while (c.status === 'running' && c.tick < 400 && !events.some(e => e.type === 'cast')) { const s = stepCombat(c); c = s.state; events.push(...(s.events as any[])); }
    const channel = c.units.find((u: any) => u.id === 'h0').mechanismState.activities.find((a: any) => a.kind === 'channel');
    expect(channel.expiresAtTick - channel.startsAtTick).toBe(50);
    expect(events.some(e => e.type === 'movement' && e.reason === 'vander-knockback')).toBe(false);
  });

  it('the panel shows 卯足全力 with the hero numbers only for my strongest board Vander', async () => {
    await loadTooltipText();
    const base = abilityDisplayValues('vander', 1), hero = glovesOffDisplayValues(1);
    expect(hero.HEROModifiedDamage).toBe(Math.floor(base.ModifiedDamage * 1.85));
    const text = abilityText('vander', 1, undefined, true)!;
    expect(text.name).toBe('卯足全力');
    expect(text.unknown).toEqual([]);
    expect(text.text).toContain('向后飞去');
    expect(text.text).toContain('25%原伤害');
    expect(abilityText('vander', 1)!.name).not.toBe('卯足全力');
    const m = createMatch(42), u = m.preparation.units[0];
    const units = [{ ...u, id: 'a', definitionId: 'vander', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 1, row: 4 } } },
      { ...u, id: 'b', definitionId: 'vander', starLevel: 2 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 2, row: 4 } } },
      { ...u, id: 'c', definitionId: 'vander', starLevel: 3 as const, team: 'player' as const, location: { kind: 'bench' as const, slot: 0 } }] as any;
    const state = { ...m, preparation: { ...m.preparation, units }, augments: [{ definitionId: 'all-out', choiceId: 't', acquiredRound: 1 }] };
    expect(glovesOffUnitId(state)).toBe('b');
    expect(glovesOffUnitId({ ...state, augments: [] })).toBeUndefined();
    expect(DISPLACEMENT_REASONS.has('vander-knockback')).toBe(true);
  });
});
