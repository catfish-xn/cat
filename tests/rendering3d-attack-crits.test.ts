import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { attackCritKeys } from '../src/rendering/three-mode/attack-crits';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// A basic attack plays as a crit (CRIT_ATTACK_HIT: its crit missile and the crit flash) when the batch shows it crits: a
// melee attack by its packet on its own tick, a ranged shot by its launch event, since its packet lands ticks later.
const ev = (e: Record<string, unknown>) => e as unknown as DisplayCombatEvent;
describe('attack crits for the attack\'s own event', () => {
  it('melee: the crit packet of the attack\'s tick; ranged: the launch event\'s crit flag, never the later landing', () => {
    const keys = attackCritKeys([
      ev({ type: 'attack', attackerId: 'm', targetId: 't', tick: 10 }),
      ev({ type: 'packetDamage', sourceId: 'm', targetId: 't', tick: 10, delivery: 'basic-attack', critical: true }),
      ev({ type: 'attack', attackerId: 'r', targetId: 't', tick: 10 }),
      ev({ type: 'attackLaunched', attackerId: 'r', targetId: 't', tick: 10, arrivalTick: 14, projectile: 'flight', critical: true }),
      ev({ type: 'attack', attackerId: 'p', targetId: 't', tick: 10 }),
      ev({ type: 'attackLaunched', attackerId: 'p', targetId: 't', tick: 10, arrivalTick: 14, projectile: 'flight', critical: false }),
      ev({ type: 'packetDamage', sourceId: 'm', targetId: 'u', tick: 10, delivery: 'ability-direct', critical: true }),
    ]);
    expect([...keys].sort()).toEqual(['m>t@10', 'r>t@10']);
  });
  it('fast ranged shots: a crit shot landing on the tick of the next, non-crit shot at the same target leaves that shot plain', () => {
    // Shot 1 leaves at 10 as a crit and lands at 14; shot 2 leaves at 14 at the same target, not a crit; shot 3 leaves at 18
    // as a crit. Only shots 1 and 3 play as crits.
    const keys = attackCritKeys([
      ev({ type: 'attack', attackerId: 'r', targetId: 't', tick: 10 }),
      ev({ type: 'attackLaunched', attackerId: 'r', targetId: 't', tick: 10, arrivalTick: 14, projectile: 'flight', critical: true }),
      ev({ type: 'attack', attackerId: 'r', targetId: 't', tick: 14 }),
      ev({ type: 'attackLaunched', attackerId: 'r', targetId: 't', tick: 14, arrivalTick: 18, projectile: 'flight', critical: false }),
      ev({ type: 'packetDamage', sourceId: 'r', targetId: 't', tick: 14, delivery: 'basic-attack', critical: true }),
      ev({ type: 'attack', attackerId: 'r', targetId: 't', tick: 18 }),
      ev({ type: 'attackLaunched', attackerId: 'r', targetId: 't', tick: 18, arrivalTick: 22, projectile: 'flight', critical: true }),
      ev({ type: 'packetDamage', sourceId: 'r', targetId: 't', tick: 18, delivery: 'basic-attack', critical: false }),
    ]);
    expect([...keys].sort()).toEqual(['r>t@10', 'r>t@18']);
  });
  it('the real rules, attack speed raised: every attack event is a crit exactly when its own launch is', () => {
    const units = realUnits({ unit: 'caitlyn', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 3 } as never);
    const shown: DisplayCombatEvent[] = [];
    runRealCombat(units, 600, (state, events) => {
      if (state.tick === 1) { const me = state.units.find((u: { id: string }) => u.id === 'me'); me.baseAttackSpeedBps *= 3; }
      shown.push(...(events as DisplayCombatEvent[]));
    }, 99);
    const launches = shown.filter(e => e.type === 'attackLaunched' && (e as { attackerId: string }).attackerId === 'me') as unknown as
      { tick: number; targetId: string; arrivalTick: number; critical: boolean }[];
    expect(launches.some(l => l.critical) && launches.some(l => !l.critical)).toBe(true);
    const keys = attackCritKeys(shown);
    for (const l of launches) expect(keys.has(`me>${l.targetId}@${l.tick}`), `shot @${l.tick}`).toBe(l.critical);
  });
  it('the real rules: every ranged shot that lands as a crit is a crit at its attack event', () => {
    const units = realUnits({ unit: 'caitlyn', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 3 } as never);
    const shown: DisplayCombatEvent[] = [];
    runRealCombat(units, 600, (_state, events) => { shown.push(...(events as DisplayCombatEvent[])); }, 99);
    const keys = attackCritKeys(shown);
    const launches = shown.filter(e => e.type === 'attackLaunched' && (e as { attackerId: string }).attackerId === 'me') as unknown as
      { tick: number; targetId: string; arrivalTick: number; critical: boolean }[];
    const crits = shown.filter(e => e.type === 'packetDamage' && (e as { sourceId: string }).sourceId === 'me' && (e as { delivery: string }).delivery === 'basic-attack'
      && (e as { critical?: boolean }).critical) as unknown as { tick: number; targetId: string }[];
    expect(crits.length).toBeGreaterThan(0);
    for (const crit of crits) {
      const launch = launches.find(l => l.arrivalTick === crit.tick && l.targetId === crit.targetId);
      expect(launch, `crit landing @${crit.tick}`).toBeDefined();
      expect(launch!.tick).toBeLessThan(crit.tick);
      expect(keys.has(`me>${crit.targetId}@${launch!.tick}`)).toBe(true);
      expect(shown.some(e => e.type === 'attack' && (e as { attackerId: string }).attackerId === 'me' && (e as { tick: number }).tick === launch!.tick)).toBe(true);
    }
  });
});
