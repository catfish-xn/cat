import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { P4_SOURCE } from './source';
import { asSource } from '../m8/s13-definitions';
import { permissionsFor } from '../m8/damage';
import type { DamageContext } from '../m8/contracts';
const v = P4_SOURCE.EvenInDeath.values;
export const evenInDeath: AnomalyModule = {
  definition: definition('EvenInDeath'),
  death(ctx, unit, source) {
    const state = unit.anomalyState ??= {};
    if (state.revivedAtTick !== undefined) return;
    state.revivedAtTick = ctx.tick;
    unit.hp = unit.maxHp;
    ctx.events.push({ type: 'unitRevived', tick: ctx.tick, unitId: unit.id, source, hp: unit.hp });
  },
  tick(ctx, unit, source, nextSeq) {
    const at = unit.anomalyState?.revivedAtTick;
    if (at === undefined || ctx.tick <= at || (ctx.tick - at) % 20) return;
    const raw = Math.floor(unit.maxHp * v.PercentHealthLoss), loss = Math.min(unit.hp, raw), seq = nextSeq();
    // Unshielded health loss: no offensive, healing or equipment callbacks.
    const partial: DamageContext = { source: asSource(source), targetId: unit.id, damageType: 'true',
      delivery: 'equipment-proc', critEligibility: 'never', actionSeq: seq, rootActionSeq: seq,
      parentPacketId: null, triggeringCastActionSeq: null, packetOrdinal: 0, equipmentDepth: 1,
      redirected: false, area: false, permissions: [],
      packetId: JSON.stringify([ctx.combatId, ctx.tick, unit.id, seq, unit.id, 'last-chance-loss']) };
    unit.hp -= loss;
    ctx.events.push({ type: 'packetDamage', tick: ctx.tick, outcome: { context: { ...partial, permissions: permissionsFor(partial) },
      hit: true, raw, prevented: 0, mitigated: raw, absorbed: 0, hpDamage: loss,
      overkill: raw - loss, critical: false, killingPacket: unit.hp === 0 } });
  },
};
