import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { appendAnomalySummon } from './summons';
import { ad } from '../combat-s13-state';
import { P4_SOURCE } from './source';
export const wolfFamiliars: AnomalyModule = {
  definition: { ...definition('WolfFamiliars'), description: '召唤两头不可被选取的狼，它们拥有1.0攻击速度和这个弈子的50%攻击力。' },
  start(ctx, unit, source) {
    for (let i = 0; i < 2; i++) appendAnomalySummon(ctx, unit, source, 'wolf', i,
      { health: 1, armor: 0, magicResist: 0, attack: Math.floor(ad(unit) * P4_SOURCE.WolfFamiliars.values.PercentAD) });
  },
};
