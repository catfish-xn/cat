import type { DamageContext, DamageOutcome, DamageRequest, ProcPermission } from './contracts';
import { evaluateAmount, integer, modifierValues, safeNumber, type AmountSample, type BoundModifier, type StatSample } from './stats';

export function permissionsFor(context: Pick<DamageContext, 'delivery' | 'damageType' | 'redirected'>): ProcPermission[] {
  const permissions: ProcPermission[] = ['defender-titan', 'damage-mana'];
  const ordinary = ['basic-attack', 'ability-direct', 'ability-periodic'].includes(context.delivery);
  const vamp = ordinary || context.delivery === 'attack-extra';
  if (vamp) permissions.push('omnivamp', 'gunblade-ally-heal');
  if (!context.redirected) {
    if (ordinary) permissions.push('apply-item-burn');
    if (context.damageType === 'physical' && context.delivery !== 'item-burn') permissions.push('last-whisper');
    permissions.push('guardbreaker');
    if (context.delivery === 'basic-attack') permissions.push('incoming-basic-hit');
  }
  return permissions;
}
export interface DamageShield { readonly key: string; readonly remaining: number }
export interface DamageSample extends AmountSample {
  readonly armor: number;
  readonly magicResist: number;
  /** Already ordered earliest-expiry then canonical source key by the shield owner. */
  readonly shields: readonly DamageShield[];
  readonly amplifiers: readonly BoundModifier[];
  readonly reductions: readonly BoundModifier[];
  readonly prevention: boolean;
  readonly critical: boolean;
  readonly critMultiplierBps: number;
  readonly burnCap?: number;
  readonly counters?: StatSample['counters'];
  readonly enemiesTargetingHolder?: readonly string[];
}
export function validateDamageContext(context: DamageContext): void {
  if (!['physical', 'magic', 'true'].includes(context.damageType) ||
      !['basic-attack', 'ability-direct', 'ability-periodic', 'attack-extra', 'equipment-proc', 'item-burn'].includes(context.delivery) ||
      !['basic', 'requires-spell-authorization', 'never'].includes(context.critEligibility)) throw new RangeError('Invalid damage category');
  for (const value of [context.actionSeq, context.rootActionSeq, context.packetOrdinal, context.equipmentDepth, context.source.effectIndex]) integer(value);
  if (context.equipmentDepth > 1 || (['equipment-proc', 'item-burn'].includes(context.delivery) && context.critEligibility !== 'never') ||
      (context.delivery === 'attack-extra' && context.critEligibility !== 'never') ||
      (context.delivery === 'basic-attack' && !['basic', 'never'].includes(context.critEligibility)) ||
      (['ability-direct', 'ability-periodic'].includes(context.delivery) && context.critEligibility === 'basic')) throw new RangeError('Invalid damage eligibility');
  const expected = permissionsFor(context);
  if (context.permissions.length !== expected.length || new Set(context.permissions).size !== expected.length || expected.some(p => !context.permissions.includes(p))) throw new RangeError('Forged proc permissions');
}
/** Coefficient/critical/resistance stages precede the one allowed Loris split. */
export function prepareDamage(request: DamageRequest, sample: DamageSample): Pick<DamageOutcome, 'raw' | 'prevented' | 'mitigated' | 'critical'> & { readonly rawAfterCritical: number } {
  const { context, input } = request;
  validateDamageContext(context);
  if (sample.holder.id !== context.source.ownerId) throw new RangeError('Wrong damage holder sample');
  if (!sample.target || sample.target.id !== context.targetId) throw new RangeError('Missing damage target');
  integer(sample.target.hp); integer(sample.target.maxHp, 1);
  integer(sample.armor); integer(sample.magicResist); integer(sample.critMultiplierBps, 10000);
  if (sample.target.hp > sample.target.maxHp) throw new RangeError('Invalid target HP');
  const raw = input.stage === 'raw' ? evaluateAmount(input.amount, sample) : safeNumber(integer(input.amount));
  let value = raw, rawAfterCritical = raw, critical = sample.critical;
  if (input.stage === 'after-mitigation') {
    if (context.parentPacketId !== input.inherited.parentPacketId) throw new RangeError('Mismatched inherited packet');
    integer(input.inherited.resolvedAtTick);
    critical = input.inherited.critical;
  } else {
    if (critical && context.critEligibility === 'never') throw new RangeError('Ineligible critical damage');
    if (critical) value = safeNumber(BigInt(value) * integer(sample.critMultiplierBps, 10000) / 10000n);
    rawAfterCritical = value;
    if (context.damageType !== 'true') {
      const resistance = context.damageType === 'physical' ? sample.armor : sample.magicResist;
      value = safeNumber(BigInt(value) * 100n / (100n + integer(resistance)));
    }
    const statSample: StatSample = { holder: sample.holder, target: sample.target, packet: context,
      counters: sample.counters, enemiesTargetingHolder: sample.enemiesTargetingHolder };
    const amp = modifierValues('damageAmp', sample.amplifiers, statSample).bps;
    const reduction = context.damageType === 'true' ? 0 : modifierValues('damageReduction', sample.reductions,
      { ...statSample, holder: sample.target, target: sample.holder }).bps;
    // Retain the M5 combined amplification/reduction floor after the resistance floor.
    value = safeNumber(BigInt(value) * (10000n + integer(amp, -10000)) * (10000n - integer(reduction)) / 100000000n);
    if (raw > 0 && context.delivery !== 'item-burn') value = Math.max(1, value);
    if (context.delivery === 'item-burn' && sample.burnCap !== undefined) value = Math.min(value, safeNumber(integer(sample.burnCap)));
  }
  const prevented = sample.prevention ? value : 0;
  if (sample.prevention) value = 0;
  return { raw, rawAfterCritical, prevented, mitigated: value, critical };
}
export function allocateDamage(context: DamageContext, prepared: Pick<DamageOutcome, 'raw' | 'prevented' | 'mitigated' | 'critical'>,
  hp: number, layers: readonly DamageShield[]): { readonly outcome: DamageOutcome; readonly shields: readonly DamageShield[]; readonly hpAfter: number } {
  integer(hp); integer(prepared.mitigated);
  let remaining = prepared.mitigated, absorbed = 0;
  const shields = layers.map(layer => {
    integer(layer.remaining);
    const taken = Math.min(remaining, layer.remaining); absorbed += taken; remaining -= taken;
    return { ...layer, remaining: layer.remaining - taken };
  });
  const hpDamage = Math.min(hp, remaining), overkill = remaining - hpDamage;
  return { outcome: { context, hit: true, raw: prepared.raw, prevented: prepared.prevented, mitigated: prepared.mitigated,
    critical: prepared.critical, absorbed, hpDamage, overkill,
    killingPacket: hp > 0 && hpDamage === hp }, shields, hpAfter: hp - hpDamage };
}
/** G02: one integer outcome, shields and HP copied; the tick resolver commits HP simultaneously. */
export function resolveDamage(request: DamageRequest, sample: DamageSample): ReturnType<typeof allocateDamage> {
  const prepared = prepareDamage(request, sample);
  return allocateDamage(request.context, prepared, sample.target!.hp, sample.shields);
}
