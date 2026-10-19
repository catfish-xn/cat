import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { appendAnomalySummon } from './summons';
import { ad } from '../combat-s13-state';
import { P4_SOURCE } from './source';
export const wolfFamiliars: AnomalyModule = {
  definition: definition('WolfFamiliars'),
  start(ctx, unit, source) {
    for (let i = 0; i < 2; i++) appendAnomalySummon(ctx, unit, source, 'wolf', i,
      { health: 1, armor: 0, magicResist: 0, attack: Math.floor(ad(unit) * P4_SOURCE.WolfFamiliars.values.PercentAD) });
  },
};
