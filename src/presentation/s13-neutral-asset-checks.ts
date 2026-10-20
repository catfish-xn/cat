/*
 * Download checks for the neutral monster portraits (s13-neutral-assets.ts), downloaded 2026-10-20 from the CommunityDragon
 * 14.24 mirror with a cache-busting query string (CommunityDragon's Cloudflare Polish may otherwise serve a recompressed copy).
 * `bytes` and `sha256` are the length and SHA-256 of the PNG under public/<path>, equal to the original file at `source`.
 * Kept out of the runtime bundle: only tests and audits import this file.
 */
import type { NeutralPortrait } from './s13-neutral-assets';

export interface S13NeutralAssetCheck { readonly id: NeutralPortrait; readonly apiName: string; readonly path: string; readonly source: string; readonly bytes: number; readonly sha256: string }
export const S13_NEUTRAL_ASSET_CHECKS: readonly S13NeutralAssetCheck[] = [
  {"id": "minion-melee", "apiName": "SRU_ChaosMinionMelee", "path": "assets/s13/neutrals/minion-melee.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/sru_chaosminionmelee/hud/redmelee_square.png", "bytes": 24871, "sha256": "d60ec23c70f432e2f8d41dca559bf3d8795245a864f1370ed1b10110fea36e59"},
  {"id": "minion-ranged", "apiName": "SRU_ChaosMinionRanged", "path": "assets/s13/neutrals/minion-ranged.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/sru_chaosminionranged/hud/redrange_square.png", "bytes": 23368, "sha256": "1abf9fd1faad3fdd37b25ee871e8091cf0982b5a54a3cb8138ba0b0609f1056e"},
  {"id": "krug", "apiName": "TFT_Krug", "path": "assets/s13/neutrals/krug.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/tft_krug/hud/ancientkrug_square.png", "bytes": 18203, "sha256": "a50a8a4ce8c4e15419e50959217755a18d90a99aecf0088dc681f0af98ce4c4f"},
  {"id": "wolf", "apiName": "TFT_Murkwolf", "path": "assets/s13/neutrals/wolf.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/tft_murkwolf/hud/tft_murkwolf_square.png", "bytes": 22263, "sha256": "627dd27a63f91da8f54e53b56493a846057348ebdb590e031ef88b3921a8285f"},
  {"id": "razorbeak", "apiName": "TFT_Razorbeak", "path": "assets/s13/neutrals/razorbeak.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/tft_razorbeak/hud/razorbeak_square.png", "bytes": 20642, "sha256": "46ba0d892a2b4b0bae738e205a5b70f3268b7302e120de1a5243a6ffe78da928"},
  {"id": "elder-dragon", "apiName": "TFT_ElderDragon", "path": "assets/s13/neutrals/elder-dragon.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/tft_elderdragon/hud/dragon_square_elder.png", "bytes": 25718, "sha256": "ff52ba4d68ee381818cfe11d1853405372809db35643188419b6db2717efa12f"},
  {"id": "rift-herald", "apiName": "TFT_RiftHerald", "path": "assets/s13/neutrals/rift-herald.png", "source": "https://raw.communitydragon.org/14.24/game/assets/characters/tft_riftherald/hud/tft9_riftherald_square.png", "bytes": 20347, "sha256": "81df25c775f9acb2bc84ea8f379b455c9c1b4322958b8df99d9f089b5a5c8394"},
];
