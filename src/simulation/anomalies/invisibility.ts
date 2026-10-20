import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.Invisibility.values;
export const invisibility: AnomalyModule = {
  definition: definition('Invisibility'),
  tick(ctx, unit) {
    if (ctx.tick % Math.round(v.StealthTimer * 20)) return;
    const state = unit.anomalyState ??= {};
    state.invisibleUntilTick = ctx.tick + Math.round(v.StealthDuration * 20);
    state.critReady = true;
  },
};
