import type { BoardPiece } from '../board-feed';

/** Exact character keys with verified, independently published GLBs. Radiant has no verified model yet. */
const ANVIL_MODELS: ReadonlySet<string> = new Set([
  'TFT_ArmoryKeyComponent', 'TFT_ArmoryKeyCompleted', 'TFT_ArmoryKeyOrnn', 'TFT_ArmoryKeySupport',
]);
export function unitModelId(definitionId: string, anvil: boolean): string | null {
  return anvil && !ANVIL_MODELS.has(definitionId) ? null : definitionId;
}

/**
 * Temporary display ratio relative to the owner's fitted body, after its official unitScale and size caps.
 * This is NOT a verified Riot constant: 14.24 map22's DeftHands record only supplies PercentAD, MiniCount,
 * ArmorReduction and AttackCadence; the official Into the Arcane mechanics article confirms copies of the selected
 * unit but gives no size ratio. Keep this explicit until an original size source is available; 30%/40% AD is not size.
 * https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/mechanics-into-the-arcane/
 */
export const MINI_MODEL_SCALE = 0.5;

// v26 remaining audit (models-delta-report.zh-CN.md, lines 70–80): no speculative model aliases.
// b5-voidling: TFT_VoidSpawn is available for g24-voidspawn, but no binding identifies this augment's voidling with it.
// s13-crab: TFT9_SLIME_Crab has a PvE SkinName binding, not a ScuttleFamiliar character/skin/scale binding.
// s13-wolf: pve-wolf-small / TFT_MurkwolfMini are candidates; WolfFamiliars data gives no character/skin/scale binding.
// pve-giant-crab: an ordinary scuttle cannot establish the CrabRave / ElderDragon_ScuttleCrab skin and size multiplier.
// TFT_ArmoryKeyRadiant: skin0 is missing from the checked offline indexes; Ornn/Support are not substitutes for it.

type ModelPiece = Pick<BoardPiece, 'id' | 'definitionId' | 'team' | 'neutral'>;
export interface UnitModelChoice { readonly id: string | null; readonly scale: number }

/**
 * The view protocol preserves the summon id, but omits anomalySummon.ownerId. Decode only the exact tuple emitted
 * by anomalies/summons.ts: [owner.id, source.instanceId, 'anomaly', 'mini', ordinal]. The same id survives online
 * replay, reconnect and watching either team. Never infer an owner from a nearby cell, roster order or hero name.
 * Keep this adapter inside the 3D chunk; it adds no fields or runtime code to the 2D feed or server projection.
 */
export function pieceModel(piece: ModelPiece, pieces: ReadonlyMap<string, ModelPiece>, anvil: boolean): UnitModelChoice {
  if (piece.definitionId !== 's13-mini') return { id: unitModelId(piece.definitionId, anvil), scale: 1 };
  let tuple: unknown;
  try { tuple = JSON.parse(piece.id); } catch { /* Unknown/legacy identity keeps its pawn. */ }
  if (Array.isArray(tuple) && tuple.length === 5 && typeof tuple[0] === 'string' && typeof tuple[1] === 'string'
    && tuple[2] === 'anomaly' && tuple[3] === 'mini' && Number.isSafeInteger(tuple[4]) && tuple[4] >= 0) {
    const owner = pieces.get(tuple[0]);
    if (owner && owner.team === piece.team && !owner.neutral && owner.definitionId !== 's13-mini') {
      return { id: owner.definitionId, scale: MINI_MODEL_SCALE };
    }
  }
  return { id: null, scale: MINI_MODEL_SCALE };
}
