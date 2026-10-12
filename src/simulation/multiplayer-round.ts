import { ROUND_CATALOG } from './content/round-catalog';
import { getCatalogRoundById, getCatalogRoundByOrdinal } from './round-selectors';
import type { RoundDefinition } from './m8/contracts';

const last = ROUND_CATALOG.at(-1)!;
/** Online-only extension. Offline catalog queries and save validation stay strict. */
export function getMultiplayerRoundByOrdinal(ordinal: number): RoundDefinition {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw new RangeError('Invalid multiplayer round');
  if (ordinal <= last.ordinal) return getCatalogRoundByOrdinal(ordinal);
  const n = ordinal - last.ordinal;
  return { roundId: `overtime-${n}`, ordinal, stage: last.stage, subround: last.subround + n,
    kind: 'pvp', isFinal: false, encounterId: null, displayName: `加时 ${n}` };
}
export function getMultiplayerRoundById(id: string): RoundDefinition {
  if (!/^overtime-[1-9][0-9]*$/.test(id)) return getCatalogRoundById(id);
  const round = getMultiplayerRoundByOrdinal(last.ordinal + Number(id.slice(9)));
  if (round.roundId !== id) throw new RangeError('Invalid multiplayer round');
  return round;
}
