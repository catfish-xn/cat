import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { appendAnomalySummon } from './summons';
import { ad } from '../combat-s13-state';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.DeftHands.values;
/** 项目约定：three minis are traced owner-bound agents, not independent autoattackers. */
export const deftHands: AnomalyModule = {
  definition: definition('DeftHands'),
  start(ctx, owner, source) {
    for (let i = 0; i < v.MiniCount; i++) appendAnomalySummon(ctx, owner, source, 'mini', i, { health: 1, armor: 0, magicResist: 0, attack: 0 });
  },
  attack(ctx, owner, target, seq) {
    if (owner.runtime.attackCount % v.AttackCadence) return;
    for (const proxy of ctx.units.filter(u => u.anomalySummon?.kind === 'mini' && u.anomalySummon.ownerId === owner.id).sort((a, b) => a.id < b.id ? -1 : 1)) {
      const state = proxy.anomalyState ??= {};
      (state.pendingAttacks ??= []).push({ targetId: target.id, executeAtTick: ctx.tick + 10, rootActionSeq: seq,
        raw: Math.floor(ad(owner) * Math.round(v.PercentAD * 10000) / 10000) });
      ctx.events.push({ type: 'attack', tick: ctx.tick, attackerId: proxy.id, targetId: target.id });
    }
  },
};
