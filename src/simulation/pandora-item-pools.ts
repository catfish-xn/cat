import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { EMBLEM_ITEMS } from './content/emblems';

/** User approved 2026-11-02: Pandora's Items I/II/III reroll a bench item within its own class.
 * Ordinary components, spatula/frying pan, ordinary completed items, emblems, artifacts and support items change;
 * Tactician items (official text excludes them), Radiant items (user ruling) and set-mechanic items do not. */
const CRAFTING = Object.freeze(['frying-pan', 'spatula']);
const EMBLEMS = Object.freeze(Object.keys(EMBLEM_ITEMS).sort());
const POOLS: readonly (readonly string[])[] = Object.freeze([
  G24_FORGE_POOLS.TFT_ArmoryKeyComponent,
  CRAFTING,
  G24_FORGE_POOLS.TFT_ArmoryKeyCompleted,
  EMBLEMS,
  G24_FORGE_POOLS.TFT_ArmoryKeyOrnn,
  G24_FORGE_POOLS.TFT_ArmoryKeySupport,
]);

export function pandoraItemPool(definitionId: string): readonly string[] | null {
  return POOLS.find(pool => pool.includes(definitionId)) ?? null;
}
