/*
 * Neutral monster portraits (PvE rounds): 14.24 HUD square icons from the CommunityDragon mirror (Riot Games assets,
 * free non-commercial fan use; see README), same 128×128 format as the champion portraits. TFT characters where the
 * 14.24 client has a HUD icon (TFT_Krug, TFT_Murkwolf, TFT_Razorbeak, TFT_ElderDragon, TFT_RiftHerald, paths from
 * raw/map22.bin.json.gz); the client's only minion icon (TFT_MinionSquare) is a caster, so the melee/ranged minions use
 * the 14.24 Summoner's Rift red minion icons to stay distinguishable. Large and small wolves/razorbeaks share one icon.
 * Sources, byte counts and SHA-256: s13-neutral-asset-checks.ts (not imported at runtime).
 */
import { NEUTRAL_DEFINITIONS, type MonsterFamily } from '../simulation/content/neutrals';

/** v22 opening crabs (scuttle, giant crab) have no bundled 14.24 icon yet: they keep the code-drawn emblem, never a missing file. */
type UnbundledFamily = 'scuttle' | 'giant-crab';
const UNBUNDLED: ReadonlySet<MonsterFamily> = new Set<UnbundledFamily>(['scuttle', 'giant-crab']);
export type NeutralPortrait = Exclude<MonsterFamily, 'minion' | UnbundledFamily> | 'minion-melee' | 'minion-ranged';
export const neutralPortraitPath = (portrait: NeutralPortrait): string => `assets/s13/neutrals/${portrait}.png`;

/** Portrait of a neutral content unit id; undefined for heroes and unknown ids. */
export function neutralPortrait(definitionId: string): NeutralPortrait | undefined {
  if (!Object.hasOwn(NEUTRAL_DEFINITIONS, definitionId)) return undefined;
  const family = NEUTRAL_DEFINITIONS[definitionId].monsterFamily;
  if (UNBUNDLED.has(family)) return undefined;
  return family !== 'minion' ? family as NeutralPortrait : definitionId.startsWith('pve-minion-ranged') ? 'minion-ranged' : 'minion-melee';
}
/** Every neutral content id with a bundled portrait file (for the board texture loader). */
export const neutralPortraitAssets = (): readonly { readonly id: string; readonly path: string }[] =>
  Object.keys(NEUTRAL_DEFINITIONS).flatMap(id => { const portrait = neutralPortrait(id); return portrait ? [{ id, path: neutralPortraitPath(portrait) }] : []; });
