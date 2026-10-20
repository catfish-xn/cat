import type { ItemProgram } from './m8/item-program';
import type { Effect } from './m8/contracts';
import { amount, modifier, stat, status, shield, survival, trigger, enemies, burn } from './content/item-programs';
import { S13_P3_SOURCE } from './content/s13-p3-source';

export function p3Values(id: string): Readonly<Record<string, number>> {
  return (S13_P3_SOURCE as Readonly<Record<string, { values: Readonly<Record<string, number>> }>>)[id]?.values ?? {};
}
export const p3Frost = () => stat(modifier('attackSpeed', -2000, 'bps'), p3Values('touch-of-frost').Duration * 20);
export const p3Stun = () => status('stun', 0, p3Values('touch-of-frost').StunDuration * 20, { activation: 'next-tick' });
/** Common Bramble/Thornskin reflection declaration; both enter executeMechanismEffect. */
export const p3ReflectionDamage = (flat: number): Effect => ({ kind: 'damage', damageType: 'magic', delivery: 'equipment-proc',
  critEligibility: 'never', amount: amount({ flat }) });
/** Declare manually scheduled effects too: restore still checks their exact frozen source and coefficients. */
export function p3Program(id: string, stage: number): ItemProgram {
  const v = p3Values(id);
  if (id === 'defense-call') return { survival: [{ ...survival(Math.round(v.HealthThreshold * 10000), [
    { ...shield(0, v.ShieldDuration * 20), amount: amount({ flat: v['ShieldAmount' + Math.max(1, Math.min(4, stage - 1))] }) },
  ]), condition: { kind: 'hp-ratio', subject: 'holder', op: 'lt', thresholdBps: Math.round(v.HealthThreshold * 10000) } }] };
  if (id.startsWith('piercing-lotus-')) return {
    modifiers: [modifier('critChance', v.CritChance * 100, 'bps')], effects: [{ kind: 'authorize-spell-crit', duplicateBonusBps: 1000 }],
    triggers: [trigger({ id: 'lotus-critical', event: 'damage-dealt', condition: { kind: 'critical-hit' },
      selector: enemies({ candidates: 'event-target' }), effects: ['sunder', 'shred'].map(kind => ({ ...status(kind as 'sunder' | 'shred',
        Math.round(v.ShredSunderPerc * 10000), v.Duration * 20, { activation: 'immediate' }), anyDamage: true })) })],
  };
  if (id === 'touch-of-frost') return { triggers: [trigger({ id: 'frost', event: 'damage-dealt',
    condition: { kind: 'damage-delivery', deliveries: ['ability-direct', 'ability-periodic'] },
    selector: enemies({ candidates: 'event-target' }), effects: [p3Frost()] }),
    trigger({ id: 'frost-death', event: 'counter-updated', selector: enemies(), effects: [p3Stun()] })] };
  if (id === 'fireball') return { triggers: [trigger({ id: 'fireball-burn', event: 'counter-updated', effects: burn(v.Duration * 20) })] };
  return {};
}
/** Adapt only the existing item's declarations; damage still resolves in the common packet pipeline. */
export function p3ItemProgram(id: string, program: ItemProgram, augments: readonly string[], stage: number): ItemProgram {
  let out = structuredClone(program);
  if (id === 'ionic-spark' && augments.includes('high-voltage')) {
    const v = p3Values('high-voltage');
    out = { ...out, periodic: out.periodic?.map(p => ({ ...p, program: { ...p.program, selector: { ...p.program.selector,
      radius: p.program.selector.radius === null ? null : p.program.selector.radius + v.hexincreasetooltip } } })),
      triggers: out.triggers?.map(t => ({ ...t, listener: { ...t.listener, withinHexes: t.listener.withinHexes === null ? null : t.listener.withinHexes + v.hexincreasetooltip },
        effects: t.effects.map(e => e.kind === 'damage' ? { ...e, amount: { ...e.amount, actualManaSpentBps: Math.round(e.amount.actualManaSpentBps * (1 + v.effectincrease)) } } : e) })) };
  }
  if (id === 'bramble-vest' && augments.includes('thorn-plated-armor')) {
    const v = p3Values('thorn-plated-armor'), amp = v['DamageAmp' + Math.max(1, Math.min(4, stage - 1))];
    out = { ...out, triggers: out.triggers?.map(t => ({ ...t, effects: t.effects.map(e => e.kind === 'damage'
      ? p3ReflectionDamage(Math.round(e.amount.flat * (1 + amp))) : e) })) };
  }
  if (id === 'steraks-gage' && augments.includes('unleash-the-beast')) {
    const v = p3Values('unleash-the-beast');
    const extra: Effect[] = [stat(modifier('attackSpeed', Math.round(v.AttackSpeed * 10000), 'bps')),
      status('control-immunity', 0, v.CCImmunityDuration * 20, { activation: 'immediate' })];
    out = { ...out, survival: out.survival?.map(t => ({ ...t, effects: [...t.effects, ...extra] })) };
  }
  return out;
}
