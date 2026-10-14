import { describe, expect, it } from 'vitest';
import { dispatchTriggers, EMPTY_TRIGGER_LEDGER, type TriggerSignal } from '../src/simulation/m8/triggers';
import { source, trigger, context, amount } from './fixtures/m8-contract-cases';
import { status } from '../src/simulation/content/item-programs';

const units = [
  { id: 'p', team: 'player' as const, cell: { col: 1, row: 4 }, hp: 1000, maxHp: 1000, alive: true },
  { id: 'a', team: 'enemy' as const, cell: { col: 1, row: 3 }, hp: 1000, maxHp: 1000, alive: true },
];
const signal = (eventSeq: number, qualified = true): TriggerSignal => ({
  context: { event: 'damage-dealt', tick: 1, eventSeq, actionSeq: 7, actorId: 'p', targetId: 'a', cast: null }, aggregation: 'event',
  facts: { damage: [{ context: context({ targetId: 'a', permissions: qualified ? ['apply-item-burn'] : [], packetId: `packet-${eventSeq}` }), hit: true, raw: 100, prevented: 0, mitigated: 100, absorbed: 0, hpDamage: 100, overkill: 0, critical: false, killingPacket: false }], healing: [], shieldDecay: [] },
});

describe('B4 R1 generic scheduler keeps finite damage and idempotent state streams', () => {
  it('ineligible burn spends no runtime/ICD/reward; qualified event and its duplicate consume exactly once', () => {
    const d = trigger({ source: source('arbitrary-state-program', 'i', 'p'), event: 'damage-dealt', internalCooldownTicks: 5, maxPerCombat: 1, effects: [status('burn', 100, 100, { activation: 'immediate' })] });
    const rejected = dispatchTriggers('c', [d], EMPTY_TRIGGER_LEDGER, signal(1, false), units, () => ['a']);
    expect(rejected.ledger.runtimes).toEqual([]); expect(rejected.ledger.actionCounts).toEqual({}); expect(rejected.invocations).toEqual([]);
    const accepted = dispatchTriggers('c', [d], rejected.ledger, signal(2), units, () => ['a']);
    expect(accepted.invocations[0].effectIndices).toEqual([0]); expect(accepted.ledger.runtimes[0]).toMatchObject({ triggerCount: 1, consumed: true, nextEligibleTick: 6 });
    const duplicate = dispatchTriggers('c', [d], JSON.parse(JSON.stringify(accepted.ledger)), signal(2), units, () => ['a']);
    expect(duplicate.ledger).toEqual(accepted.ledger); expect(duplicate.invocations).toEqual([]);
  });

  it('one damage derivation per action; subsequent qualified packets still update state using original effect indices', () => {
    const d = trigger({ source: source('arbitrary-mixed-program', 'i', 'p'), event: 'damage-dealt', effects: [
      status('wound', 3300, 100, { activation: 'immediate' }),
      { kind: 'damage', damageType: 'magic', delivery: 'equipment-proc', critEligibility: 'never', amount: amount(35) },
    ] });
    const first = dispatchTriggers('c', [d], EMPTY_TRIGGER_LEDGER, signal(1), units, () => ['a']);
    expect(first.invocations[0].effectIndices).toEqual([0, 1]);
    const second = dispatchTriggers('c', [d], first.ledger, signal(2), units, () => ['a']);
    expect(second.invocations[0].effectIndices).toEqual([0]); expect(second.ledger.actionCounts).toEqual(first.ledger.actionCounts);
    const child = signal(3); const derived = { ...child, facts: { ...child.facts, damage: child.facts.damage.map(o => ({ ...o, context: { ...o.context, equipmentDepth: 1 as const, permissions: [] } })) } };
    const noRecursion = dispatchTriggers('c', [d], second.ledger, derived, units, () => ['a']);
    expect(noRecursion.invocations).toEqual([]); expect(noRecursion.ledger.runtimes).toEqual(second.ledger.runtimes);
  });
});
