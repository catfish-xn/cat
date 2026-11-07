import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { toDisplayEvents } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, type Batch1EventPlan } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { battle, unit } from './combat-helpers';

/** Run the unchanged real domain engine, then exactly the online animation whitelist.
 * This catches wrong field spellings, event order and passive skills without a cast. */
function natural(champion: string, ticks: number, ally = false) {
  const hero = unit('p', 'player', 1, 3, { definitionId: champion, ability: resolveAbility(champion + '-ability', 1),
    hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100, attackDamage: 100,
    attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [],
    ...(champion === 'amumu' ? { mana: 0, maxMana: 0, cooldownTicks: 1000 } : {}),
  });
  const dummy = unit('e', 'enemy', 2, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 20000, maxHp: 20000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
  const units: CombatUnit[] = [hero, dummy];
  if (ally) units.push({ ...hero, id: 'ally', hp: 1, mana: 0, maxMana: 10000, cooldownTicks: 1000, cell: { col: 0, row: 3 } });
  let state = battle(units, { rngState: 42, combatId: 'vfx-batch1-natural', nextEventSeq: 0, strategy: { traits: [], units: [] } });
  const visual = createBatch1VfxEvents(id => units.find(u => u.id === id)?.definitionId), plans: Batch1EventPlan[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = stepCombat(state); state = step.state;
    plans.push(...visual.batch(toDisplayEvents(toLedgerEvents(step.events))));
  }
  return plans;
}
describe('batch 1 natural domain events through the online whitelist', () => {
  it('Amumu has no cast, yet W pulses at ticks 20/40/60 once for each area pulse', () => {
    const plans = natural('amumu', 61);
    expect(plans.filter(p => p.event.type === 'cast')).toEqual([]);
    expect(plans.filter(p => p.extra.some(v => v.champion === 'amumu')).map(p => 'tick' in p.event ? p.event.tick : -1)).toEqual([20, 40, 60]);
  });
  it('Zeri naturally chooses charged beams on her third attack without any cast', () => {
    const plans = natural('zeri', 61);
    expect(plans.filter(p => p.event.type === 'cast')).toEqual([]);
    const attacks = plans.filter(p => p.event.type === 'attack' && p.event.attackerId === 'p');
    expect(attacks.length).toBeGreaterThanOrEqual(3);
    expect(attacks.slice(0, 3).map(p => p.variant)).toEqual([undefined, undefined, 'empowered']);
  });
  it('Leona empty-target cast produces the explosion exactly 60 ticks later', () => {
    const plans = natural('leona', 80);
    const cast = plans.find(p => p.event.type === 'cast' && p.event.sourceId === 'p')!;
    expect(cast.event).toMatchObject({ targetIds: [] });
    const end = plans.find(p => p.extra.some(v => v.action === 'end'))!;
    expect(end.event).toMatchObject({ type: 'statusChanged', kind: 'damage-reduction', reason: 'expired', tick: ('tick' in cast.event ? cast.event.tick : -1) + 60 });
    expect(end.extra.find(v => v.action === 'passive')?.targets).toContain('e');
    expect(cast.extra).toEqual([]);
  });
  it.each(['draven', 'nocturne', 'twitch'])('%s self cast selects subsequent empowered attacks', name => {
    const plans = natural(name, 45);
    expect(plans.find(p => p.event.type === 'cast' && p.event.sourceId === 'p')?.event).toMatchObject({ targetIds: ['p'] });
    expect(plans.find(p => p.event.type === 'attack' && p.event.attackerId === 'p')?.variant).toBe('empowered');
  });
  it.each([false, true])('Lux shield follows authoritative self/ally recipient (ally=%s)', ally => {
    const plans = natural('lux', 45, ally);
    const cast = plans.find(p => p.event.type === 'cast' && p.event.sourceId === 'p')!;
    expect(cast.event).toMatchObject({ targetIds: [ally ? 'ally' : 'p'] }); expect(cast.variant).toBe(ally ? undefined : 'self');
    const attacks = plans.filter(p => p.event.type === 'attack' && p.event.attackerId === 'p');
    expect(attacks.slice(0, 2).map(p => p.variant)).toEqual(['empowered', undefined]);
  });
  it('KogMaw cast is self-only while its attack still has actual magic packets', () => {
    const plans = natural('kogmaw', 25);
    expect(plans.find(p => p.event.type === 'cast' && p.event.sourceId === 'p')?.event).toMatchObject({ targetIds: ['p'] });
    expect(plans.some(p => p.event.type === 'packetDamage' && p.event.sourceId === 'p' && p.event.damageType === 'magic')).toBe(true);
  });
});
