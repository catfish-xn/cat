/*
 * Neutral monster portraits (PvE rounds): 14.24 HUD square icons from the CommunityDragon mirror (Riot Games assets,
 * free non-commercial fan use; see README), same 128×128 format as the champion portraits. TFT characters where the
 * 14.24 client has a HUD icon (TFT_Krug, TFT_Murkwolf, TFT_Razorbeak, TFT_ElderDragon, TFT_RiftHerald, paths from
 * raw/map22.bin.json.gz); the client's only minion icon (TFT_MinionSquare) is a caster, so the melee/ranged minions use
 * the 14.24 Summoner's Rift red minion icons to stay distinguishable. Large and small wolves/razorbeaks share one icon.
 * Sources, byte counts and SHA-256: s13-neutral-asset-checks.ts (not imported at runtime).
 */
import { NEUTRAL_DEFINITIONS, type MonsterFamily } from '../simulation/content/neutrals';

export type NeutralPortrait = Exclude<MonsterFamily, 'minion'> | 'minion-melee' | 'minion-ranged';
export const neutralPortraitPath = (portrait: NeutralPortrait): string => `assets/s13/neutrals/${portrait}.png`;

/** Portrait of a neutral content unit id; undefined for heroes and unknown ids. */
export function neutralPortrait(definitionId: string): NeutralPortrait | undefined {
  if (!Object.hasOwn(NEUTRAL_DEFINITIONS, definitionId)) return undefined;
  const family = NEUTRAL_DEFINITIONS[definitionId].monsterFamily;
  return family !== 'minion' ? family : definitionId.startsWith('pve-minion-ranged') ? 'minion-ranged' : 'minion-melee';
}
/** Every neutral content id with its portrait file (for the board texture loader). */
export const neutralPortraitAssets = (): readonly { readonly id: string; readonly path: string }[] =>
  Object.keys(NEUTRAL_DEFINITIONS).map(id => ({ id, path: neutralPortraitPath(neutralPortrait(id)!) }));
