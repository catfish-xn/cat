import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import type { Effect, StatusApplication } from '../src/simulation/m8/contracts';
import { commitOpening, planOpening, validateOpeningState, type OpeningDefinition } from '../src/simulation/m8/opening';
import { applyStatusContribution, effectiveStatuses } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { battle, freeze, unit } from './combat-helpers';
import { amount, source, trigger } from './fixtures/m8-contract-cases';
import captured from './fixtures/m8-b3/damage-control-opening.json';

// Captured by calling the real B7 compiler at the recorded commit, outside this
// branch. B3 owns this frozen regression input; no B7 implementation is imported.
const definitions = captured.openingDefinitions as readonly OpeningDefinition[];
const heraldId = captured.unit.id;
const dummy = (id = 'p', patch: Partial<CombatUnit> = {}): CombatUnit => unit(id, 'player', 3, 4, {
  hp: 1000, maxHp: 1000, cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0,
  ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} }, ...patch,
});
const start = (patch: Partial<CombatUnit> = {}, others: CombatUnit[] = []): CombatState => battle([
  { ...captured.unit as CombatUnit, cooldownTicks: 1000, moveCooldownTicks: 1000 }, dummy('p', patch), ...others,
], { combatId: 'b3-damage-control', rngDraws: 0, openingDefinitions: definitions });
const status = (kind: StatusApplication['kind'], activation: StatusApplication['activation'] = 'immediate'): StatusApplication => ({
  kind, magnitudeBps: 0, activation, duration: { kind: 'ticks', ticks: 10 },
  stackPolicy: { kind: 'independent-instances' }, removable: true, polarity: kind === 'stun' ? 'harmful' : 'beneficial', damageFilter: null, onEnd: null,
});
const withStatus = (kind: StatusApplication['kind']): Partial<CombatUnit> => ({ mechanismState: {
  ...EMPTY_MECHANISMS, combatId: 'b3-damage-control', statuses: applyStatusContribution([], effectIdentity('b3-damage-control', source('protection', 'p', 'p'), 'p'), status(kind), 0).groups,
} });
const damage = (events: ReturnType<typeof stepCombat>['events'], id = 'p') => events.filter(e => e.type === 'packetDamage' && e.unitId === id);
const applied = (events: ReturnType<typeof stepCombat>['events'], id = 'p') => events.filter(e => e.type === 'statusChanged' && e.unitId === id && e.reason === 'applied' && e.status.kind === 'stun');

describe('B3 packet-bound opening damage then surviving-target control', () => {
  it('recorded 100/1000 lethal case emits damage and death, never applied control or its cleanup', () => {
    const input = freeze(start({ hp: 100 }));
    const result = stepCombat(input);
    expect(captured.referenceCommit).toBe('3b0d55f923d7225587872340f62b203de31f8f41');
    expect(result.state.openingState?.plans[0]).toMatchObject({
      path: [{ col: 4, row: 2 }, { col: 3, row: 3 }, { col: 3, row: 4 }, { col: 2, row: 5 }], targetIds: ['p'], task: { status: 'executed' },
    });
    expect(result.events.filter(e => e.type === 'movement')).toMatchObject([{ tick: 0, unitId: heraldId, to: { col: 2, row: 5 } }]);
    expect(damage(result.events)).toMatchObject([{ tick: 1, raw: 150, hpDamage: 100, critical: false }]);
    expect(applied(result.events)).toEqual([]);
    expect(result.events.filter(e => e.type === 'statusChanged' && e.unitId === 'p')).toEqual([]);
    expect(result.events.filter(e => e.type === 'death').map(e => e.unitId)).toEqual(['p']);
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 0, alive: false, statuses: [], mechanismState: { statuses: [] } });
    expect(result.events.filter(e => e.type === 'attack' || e.type === 'cast')).toEqual([]);
    expect(result.state.rngDraws).toBe(0);
    expect(stepCombat(input)).toEqual(result);
  });

  it.each([[1000, 150], [4000, 300]])('maxHP %i takes %i then gets stun [2,12)', (maxHp, raw) => {
    const result = stepCombat(start({ hp: maxHp, maxHp }));
    expect(damage(result.events)).toMatchObject([{ raw, hpDamage: raw }]);
    expect(applied(result.events)).toMatchObject([{ tick: 1, status: { startsAtTick: 2, expiresAtTick: 12 } }]);
    expect(result.events.indexOf(applied(result.events)[0])).toBeGreaterThan(result.events.indexOf(damage(result.events)[0]));
    const target = result.state.units.find(u => u.id === 'p')!;
    expect(target.hp).toBe(maxHp - raw);
    expect(effectiveStatuses(target.mechanismState!.statuses, 1)).toEqual([]);
    expect(effectiveStatuses(target.mechanismState!.statuses, 2).map(g => g.kind)).toEqual(['stun']);
    expect(effectiveStatuses(target.mechanismState!.statuses, 11).map(g => g.kind)).toEqual(['stun']);
    expect(effectiveStatuses(target.mechanismState!.statuses, 12)).toEqual([]);
    expect(result.state.rngDraws).toBe(0);
  });

  it('effective immunity blocks control without preventing damage', () => {
    const result = stepCombat(start(withStatus('control-immunity')));
    expect(damage(result.events)).toMatchObject([{ raw: 150, hpDamage: 150 }]);
    expect(applied(result.events)).toEqual([]);
    expect(result.state.units.find(u => u.id === 'p')!.mechanismState!.statuses.some(g => g.kind === 'stun')).toBe(false);
  });

  it.each(['prevention', 'shield'] as const)('%s still permits control after a zero-HP-damage packet', protection => {
    const shieldSource = source('shield', 'p', 'p');
    const result = stepCombat(start(protection === 'prevention' ? withStatus('damage-prevention') : {
      shield: 200, shieldExpiresAtTick: 100,
      shieldLayers: [{ key: 'shield', source: shieldSource, granted: 200, remaining: 200, absorbed: 0, expiresAtTick: 100 }],
    }));
    expect(damage(result.events)).toMatchObject([{ raw: 150, hpDamage: 0, absorbed: protection === 'shield' ? 150 : 0 }]);
    expect(applied(result.events)).toHaveLength(1);
    expect(result.events.indexOf(applied(result.events)[0])).toBeGreaterThan(result.events.indexOf(damage(result.events)[0]));
    expect(result.state.units.find(u => u.id === 'p')!.hp).toBe(1000);
  });

  it('later same-tick lethal damage follows the charge control, then cleans it up', () => {
    const result = stepCombat(start({ hp: 200 }, [dummy('z', { team: 'enemy', cell: { col: 4, row: 4 }, cooldownTicks: 0, attackDamage: 100 })]));
    const packets = damage(result.events);
    expect(packets).toMatchObject([{ raw: 150, hpDamage: 150 }, { hpDamage: 50 }]);
    expect(applied(result.events)).toHaveLength(1);
    const index = result.events.indexOf(applied(result.events)[0]);
    expect(index).toBeGreaterThan(result.events.indexOf(packets[0]));
    expect(index).toBeLessThan(result.events.indexOf(packets[1]));
    expect(result.events.some(e => e.type === 'statusChanged' && e.unitId === 'p' && e.reason === 'death-cleanup')).toBe(true);
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 0, alive: false, statuses: [] });
  });

  it('an earlier killing packet suppresses control even while the target alive flag is still true', () => {
    const result = stepCombat(start({ hp: 100 }, [dummy('A', { team: 'enemy', cell: { col: 4, row: 4 }, cooldownTicks: 0, attackDamage: 200 })]));
    expect(damage(result.events)).toMatchObject([{ hpDamage: 100 }, { raw: 150, hpDamage: 0 }]);
    expect(applied(result.events)).toEqual([]);
  });

  it('multi-target contributions bind per target, independent of input order', () => {
    const protectedUnit = dummy('a', { cell: { col: 4, row: 2 }, mechanismState: {
      ...EMPTY_MECHANISMS, combatId: 'b3-damage-control', statuses: applyStatusContribution([], effectIdentity('b3-damage-control', source('protection', 'a', 'a'), 'a'), status('control-immunity'), 0).groups,
    } });
    const input = start({ hp: 100 }, [protectedUnit, dummy('q', { cell: { col: 3, row: 3 } })]);
    const result = stepCombat(input);
    expect(stepCombat({ ...input, units: [...input.units].reverse() })).toEqual(result);
    expect(result.state.openingState?.plans[0].targetIds).toEqual(['a', 'q', 'p']);
    expect(damage(result.events, 'a')).toMatchObject([{ hpDamage: 150 }]);
    expect(applied(result.events, 'a')).toEqual([]);
    expect(applied(result.events, 'p')).toEqual([]);
    expect(applied(result.events, 'q')).toHaveLength(1);
    expect(result.events.indexOf(applied(result.events, 'q')[0])).toBeGreaterThan(result.events.indexOf(damage(result.events, 'q')[0]));
    expect(result.state.rngDraws).toBe(0);
  });

  it('immunity gained from this packet is rechecked at control registration', () => {
    const listener = trigger({ source: source('immunity-on-damage', 'p', 'p'), event: 'damage-taken',
      listener: { subject: 'target', relationToHolder: 'self', withinHexes: null },
      effects: [{ kind: 'apply-status', status: status('control-immunity') }],
    });
    const result = stepCombat(start({ mechanismDefinitions: { periodicTasks: [], survivalTriggers: [], vamp: [], eventTriggers: [listener] } }));
    expect(damage(result.events)).toMatchObject([{ hpDamage: 150 }]);
    expect(result.state.units.find(u => u.id === 'p')!.mechanismState!.statuses.some(g => g.kind === 'control-immunity')).toBe(true);
    expect(applied(result.events)).toEqual([]);
  });

  it.each(['dead', 'controlled'] as const)('committed movement survives a %s source cancellation; restore never retries', reason => {
    const input = start();
    const planned = planOpening(input.combatId!, input.board, input.units, definitions);
    const committed = commitOpening(planned, input.units);
    const units = committed.units.map(u => u.id !== heraldId ? u : reason === 'dead' ? { ...u, hp: 0, alive: false } : {
      ...u, statuses: [{ key: 'cancel', source: definitions[0].source, kind: 'stun' as const, amount: 0, startsAtTick: 1, expiresAtTick: 3 }],
    });
    // An ally keeps the battle running after a pre-task source death.
    const pending = { ...input, units: [...units, dummy('ally', { team: 'enemy', cell: { col: 0, row: 0 } })], openingState: committed.state };
    const result = stepCombat(JSON.parse(JSON.stringify(pending)));
    expect(result.state.units.find(u => u.id === heraldId)!.cell).toEqual({ col: 2, row: 5 });
    expect(result.state.openingState?.plans[0].task?.status).toBe('cancelled');
    expect(damage(result.events)).toEqual([]);
    expect(applied(result.events)).toEqual([]);
    expect(result.events.filter(e => e.type === 'movement')).toEqual([]);
    const next = stepCombat(JSON.parse(JSON.stringify(result.state)));
    expect(next.events.filter(e => e.type === 'movement' || e.type === 'packetDamage')).toEqual([]);
    expect(result.state.rngDraws).toBe(0);
  });

  it('partial opening commit and tick-boundary round trips consume exactly one movement/task/control', () => {
    const input = start();
    const committed = commitOpening(planOpening(input.combatId!, input.board, input.units, definitions), input.units);
    validateOpeningState(committed.state, input.combatId!, input.board, definitions);
    const pending = { ...input, units: committed.units, openingState: committed.state };
    const first = stepCombat(freeze(JSON.parse(JSON.stringify(pending))));
    const whole = stepCombat(input);
    expect([...committed.movements, ...first.events].map(e => ({ ...e, eventSeq: undefined, combatId: undefined }))).toEqual(whole.events.map(e => ({ ...e, eventSeq: undefined, combatId: undefined })));
    expect(first.state.units).toEqual(whole.state.units);
    expect(damage(first.events)).toHaveLength(1);
    expect(applied(first.events)).toHaveLength(1);
    const next = stepCombat(JSON.parse(JSON.stringify(first.state)));
    expect(next).toEqual(stepCombat(first.state));
    expect(next.events.filter(e => e.type === 'movement' || e.type === 'packetDamage')).toEqual([]);
    expect(applied(next.events)).toEqual([]);
    expect(next.state.rngDraws).toBe(0);
  });

  it('generic IDs and consecutive damage/control pairs retain their own packet boundary', () => {
    const input = start({ hp: 200 });
    const effects: Effect[] = [
      { kind: 'damage', amount: amount(50), damageType: 'magic', delivery: 'ability-direct', critEligibility: 'never' },
      { kind: 'apply-status', status: status('stun', 'next-tick') },
      { kind: 'damage', amount: amount(200), damageType: 'magic', delivery: 'ability-direct', critEligibility: 'never' },
      { kind: 'apply-status', status: status('stun', 'next-tick') },
    ];
    const result = stepCombat({ ...input, units: input.units.map(u => u.id === heraldId ? { ...u, id: 'generic', definitionId: 'generic' } : u),
      openingDefinitions: [{ kind: 'path-charge', source: { ...source('generic', 'generic', 'generic'), sourceKind: 'ability' }, effects: effects as Extract<Effect, { kind: 'damage' | 'apply-status' }>[] }],
    });
    const packets = damage(result.events);
    expect(packets).toMatchObject([{ raw: 50, hpDamage: 50 }, { raw: 200, hpDamage: 150 }]);
    expect(applied(result.events)).toHaveLength(1);
    expect(result.events.indexOf(applied(result.events)[0])).toBeGreaterThan(result.events.indexOf(packets[0]));
    expect(result.events.indexOf(applied(result.events)[0])).toBeLessThan(result.events.indexOf(packets[1]));
  });
});
