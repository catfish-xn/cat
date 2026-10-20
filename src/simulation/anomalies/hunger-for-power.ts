import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { byDistance } from '../combat-s13-state';
import { asSource } from '../m8/s13-definitions';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.HungerForPower.values;
export const hungerForPower: AnomalyModule = {
  definition: definition('HungerForPower'),
  start(ctx, unit, source) {
    const basis = ctx.anomalyOpening!;
    const victim = byDistance(unit, ctx.units.filter(u => u.id !== unit.id && u.team === unit.team && u.alive && !u.anomalySummon
      && !u.itemSummon && !u.definitionId.startsWith('g23-')))[0];
    if (!victim) return;
    const frozen = basis.find(u => u.id === victim.id)!;
    const health = Math.floor(frozen.health * v.HealthAndADPercent / 100), attackDamage = Math.floor(frozen.attackDamage * v.HealthAndADPercent / 100);
    (unit.anomalyState ??= {}).consumed = { unitId: victim.id, health, attackDamage };
    const beforeMax = unit.maxHp, beforeHp = unit.hp;
    unit.maxHp += health; unit.hp += health;
    ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: unit.id, source: asSource(source), beforeMax,
      afterMax: unit.maxHp, beforeHp, afterHp: unit.hp, countsAsHeal: false });
    // Combat-only sacrifice; no sale, kill, death item or economic receipt.
    victim.hp = 0; victim.alive = false; victim.mana = 0; victim.targetId = null;
    victim.shield = 0; victim.shieldLayers = []; victim.shieldExpiresAtTick = null;
    victim.statuses = []; victim.tasks = []; victim.cooldownTicks = 0; victim.moveCooldownTicks = 0;
  },
};
