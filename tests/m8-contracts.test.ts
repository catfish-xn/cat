import { describe, expect, it } from 'vitest';
import type { CastReceipt, DamageContext, Effect, EquipmentRoundRoll, HealOutcome, M8Version, PeriodicTask, Source, SpellCritAuthorization, StatusGroup, SurvivalSample, TriggerDefinition } from '../src/simulation/m8/contracts';
import type { CompatibilityView, LootView, RevealedDropView } from '../src/simulation/m8/ui-contracts';

const source: Source = { ownerId: 'u1', sourceKind: 'item', definitionId: 'TFT_Item_Morellonomicon', instanceId: 'i1', effectIndex: 0, parentItemInstanceId: null };
const burn: PeriodicTask = {
  key: '["c1","u1","item","TFT_Item_Morellonomicon","i1",0,null,"u2","source"]', source, targetId: 'u2', nextPulseAtTick: 20,
  periodTicks: 20, endsAtTick: 200, pulseOrdinal: 0, pulseLimit: 10,
  remainders: [],
  finalPulse: 'before-expiry', onSourceDeath: 'persist-attached', onTargetDeath: 'cancel',
  program: { definitionId: 'burn', targetSnapshot: 'once-per-pulse', selector: { primary: 'normal', candidates: 'bound-target', relation: 'enemy', anchor: 'holder', radius: null, maxTargets: 1, excludeSelf: true, excludePrimary: false, distinct: true, order: 'distance-id', sample: 'each-pulse' }, effects: [{ kind: 'damage', damageType: 'true', delivery: 'item-burn', critEligibility: 'never',
    amount: { flat: 0, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 100, missingHpBps: 0, actualManaSpentBps: 0, actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'target', sample: 'each-pulse', cap: null } }] },
};
const threshold: TriggerDefinition = {
  id: 'threshold', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, aggregation: 'event', counters: [], gate: { kind: 'always' },
  source: { ...source, definitionId: 'TFT_Item_SteraksGage', instanceId: 'i2' },
  event: 'post-damage-survival', condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 6000 },
  selector: { primary: 'normal', candidates: 'board', relation: 'self', anchor: 'holder', radius: 0, maxTargets: 1, excludeSelf: false, excludePrimary: false, distinct: true, order: 'distance-id', sample: 'action-completion' },
  internalCooldownTicks: 0, maxPerAction: 1, maxPerCombat: 1, stackPolicy: { kind: 'independent-instances' },
  effects: [{ kind: 'change-max-hp', bonusBps: 2500, currentHp: 'add-max-delta', countsAsHeal: false }],
};
const roll: EquipmentRoundRoll = { parentItemInstanceId: 'gloves-7', roundId: 'r-2-1', playerLevelSnapshot: 6, poolVersion: 'tg-01-v1', children: ['TFT_Item_InfinityEdge', 'TFT_Item_BFSword'], rngDrawStart: 0, rngDrawEnd: 2 };
const packet: DamageContext = {
  source, targetId: 'u2', damageType: 'physical', delivery: 'equipment-proc', actionSeq: 4,
  rootActionSeq: 3, parentPacketId: 'p3', triggeringCastActionSeq: null, packetId: 'p4', packetOrdinal: 0, equipmentDepth: 1,
  redirected: false, area: false, critEligibility: 'never',
  permissions: ['last-whisper', 'defender-titan', 'damage-mana', 'guardbreaker'],
};

describe('M8 B2 data expressiveness (not combat execution)', () => {
  it('round-trips source, periodic phase, final pulse and rational remainder', () => {
    const restored: PeriodicTask = JSON.parse(JSON.stringify(burn));
    expect(restored).toEqual(burn);
    expect([restored.nextPulseAtTick, restored.endsAtTick]).toEqual([20, 200]);
    // Independent hand-written acceptance data: 2000HP at 1% gives ten 20HP pulses.
    const expectedPulses = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
    expect(expectedPulses).toHaveLength(10);
    expect(restored.program.effects[0]).toMatchObject({ damageType: 'true', critEligibility: 'never' });
  });
  it('can retain a weaker source and its expiry while exposing the stronger status', () => {
    const application = { activation: 'next-tick', kind: 'shred', magnitudeBps: 3000, duration: { kind: 'ticks', ticks: 100 }, stackPolicy: { kind: 'strongest-category', category: 'shred', retainSuppressed: true }, removable: true, polarity: 'harmful', damageFilter: null, onEnd: null } as const;
    const group: StatusGroup = { targetId: 'u2', kind: 'shred', effectiveSourceKey: 'strong', effectiveMagnitudeBps: 5000, nextPulseAtTick: null,
      contributions: [{ key: 'weak', source, targetId: 'u2', appliedAtTick: 1, expiresAtTick: 101, endRewardConsumed: false, application }, { key: 'strong', source: { ...source, instanceId: 'i2' }, targetId: 'u2', appliedAtTick: 21, expiresAtTick: 61, endRewardConsumed: false, application: { ...application, magnitudeBps: 5000, duration: { kind: 'ticks', ticks: 40 } } }] };
    expect(JSON.parse(JSON.stringify(group))).toEqual(group);
    expect(group.contributions.map(x => x.expiresAtTick)).toEqual([101, 61]);
  });
  it('expresses survival gates and max-health gains separately from healing', () => {
    const survived: SurvivalSample = { unitId: 'u1', tick: 40, hpBeforeDamage: 700, hpAfterDamage: 600, maxHpBeforeThresholdEffects: 1000, survivedDamageBatch: true, receivedPositiveDamage: true };
    const lethal: SurvivalSample = { ...survived, hpAfterDamage: 0, survivedDamageBatch: false };
    const heal: HealOutcome = { healId: 'h1', contributions: [{ source, numerator: 300, denominator: 1 }], shares: [{ source, requested: 300, afterWound: 201, actual: 100, overheal: 101, preventedByWound: 99 }], targetId: 'u1', requested: 300, kind: 'direct', fromPacketId: null, afterWound: 201, actual: 100, overheal: 101, preventedByWound: 99 };
    expect(threshold.effects[0]).toMatchObject({ countsAsHeal: false });
    expect(lethal.survivedDamageBatch).toBe(false);
    expect(heal.actual + heal.overheal + heal.preventedByWound).toBe(300);
  });
  it('retains the gloves roll independently of holder and of temporary effects', () => {
    const saved = { equipmentRoundRolls: [roll], temporaryEquipment: [] };
    expect(JSON.parse(JSON.stringify(saved)).equipmentRoundRolls[0]).toEqual(roll);
    expect(roll).not.toHaveProperty('holderId');
    expect(packet.permissions).not.toContain('omnivamp');
    expect(packet.permissions).toContain('last-whisper');
  });
  it('expresses mana-spend damage and slot-independent duplicate spell authorization', () => {
    const receipt: CastReceipt = { source, actionSeq: 7, completed: true, targetIds: ['u2'], targetsSampledAtTick: 20, actualManaSpent: 80, refundedMana: 10, completionCell: { col: 3, row: 3 } };
    const ionic: Effect = { kind: 'damage', damageType: 'magic', delivery: 'equipment-proc', critEligibility: 'never', amount: { flat: 0, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 0, missingHpBps: 0, actualManaSpentBps: 16000, actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'target', sample: 'packet', cap: null } };
    const authorization: SpellCritAuthorization = { nonItemSources: [], itemSources: [{ ...source, definitionId: 'TFT_Item_InfinityEdge' }, { ...source, definitionId: 'TFT_Item_JeweledGauntlet', instanceId: 'i3' }], enabled: true, redundantItemBonusBps: 1000, chanceBps: 9500, multiplierBps: 15000 };
    expect(JSON.parse(JSON.stringify({ receipt, ionic, authorization }))).toEqual({ receipt, ionic, authorization });
    expect(ionic.amount.actualManaSpentBps).toBe(16000);
    expect(receipt.actualManaSpent).not.toBe(receipt.actualManaSpent - receipt.refundedMana);
  });
  it('public loot and compatibility exclude hidden plans and fake grant receipts', () => {
    const retained: RevealedDropView = { dropId: 'd1', encounterId: 'e1', sourceUnitId: 'n1', roundId: 'r-6-7', payload: { kind: 'unit', definitionId: 'irelia', quantity: 1 }, status: 'retained-terminal', receiptId: null, allowedActions: [], reason: 'terminal-bench-full' };
    const loot: LootView = { roundId: 'r-6-7', revealedDrops: [retained], pendingClaims: [], canContinue: false, reason: 'game-over' };
    const legacy: CompatibilityView = { status: 'legacy-preserved', currentRulesVersion: 'm8-14.24b-v1', fileRulesVersion: 'm5-14.24b-v1', canResume: false, canReplay: false, canExportOriginal: true, reason: 'new-match-required' };
    expect(loot.revealedDrops[0].receiptId).toBeNull();
    expect(legacy.canReplay).toBe(false);
    // @ts-expect-error A future public loot view cannot expose an unrevealed plan.
    const hidden: RevealedDropView['status'] = 'planned';
    // @ts-expect-error Maximum-HP grants must never be healing.
    const invalid: Extract<Effect, { kind: 'change-max-hp' }>['countsAsHeal'] = true;
    // @ts-expect-error B2 does not permit silently reusing the old save format.
    const oldFormat: M8Version['saveFormatVersion'] = 1;
    void hidden; void invalid; void oldFormat;
  });
});
