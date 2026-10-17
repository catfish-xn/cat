import { G23_SPECIAL_ITEM_SOURCE } from './content/g2-3-special-item-source';
import type { G23MatchProgress } from './g2-3-match-progress';
export const TACTICIANS_CROWN_ID = 'TFT_Item_ForceOfNature';
const CROWN_TEAM_SIZE = G23_SPECIAL_ITEM_SOURCE.TFT_Item_ForceOfNature.values.MaxArmySizeIncrease;
/** Source: +MaxArmySizeIncrease per crown. User rule (2026-10-17): every crown ever granted adds it permanently,
 * wherever the crown sits and even after it is sold, removed or reforged; read from the immutable reward claims. */
export function crownTeamSizeBonus(g23: G23MatchProgress | undefined): number {
  return (g23?.rewardClaims.filter(claim => claim.kind === 'item' && claim.definitionId === TACTICIANS_CROWN_ID).length ?? 0) * CROWN_TEAM_SIZE;
}
export function deploymentCapFor(level: number, g23: G23MatchProgress | undefined): number {
  return level + crownTeamSizeBonus(g23);
}
