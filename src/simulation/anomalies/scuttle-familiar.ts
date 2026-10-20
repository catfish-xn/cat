import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { appendAnomalySummon } from './summons';
import { P4_SOURCE } from './source';
const ratio = P4_SOURCE.ScuttleFamiliar.values.PctOfDefensiveStats;
export const scuttleFamiliar: AnomalyModule = {
  definition: definition('ScuttleFamiliar'),
  death(ctx, unit, source) {
    appendAnomalySummon(ctx, unit, source, 'crab', 0, { health: Math.floor(unit.maxHp * ratio / 100),
      // Official 14.24: clear Shred/Sunder before sampling, retain other resolved bonuses.
      armor: Math.floor((ctx.defenses?.(unit, true, true) ?? unit.armor) * ratio / 100),
      magicResist: Math.floor((ctx.defenses?.(unit, false, true) ?? unit.magicResist) * ratio / 100), attack: 0 });
  },
};
