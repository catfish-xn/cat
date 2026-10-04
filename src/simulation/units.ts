import type { HexCell, Team } from './board';
export interface UnitDefinition {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly color: number;
  readonly baseStats: { readonly health: number; readonly attack: number; readonly armor: number };
}
export type UnitLocation = { readonly kind: 'bench'; readonly slot: number } | { readonly kind: 'board'; readonly cell: HexCell };
export interface Unit { readonly id: string; readonly definitionId: string; readonly team: Team; readonly location: UnitLocation }
export const UNIT_DEFINITIONS: Readonly<Record<string, UnitDefinition>> = {
  sentinel: { id: 'sentinel', name: '守卫', symbol: '盾', color: 0x68ddd0, baseStats: { health: 800, attack: 45, armor: 40 } },
  ranger: { id: 'ranger', name: '游侠', symbol: '弓', color: 0xe6bc76, baseStats: { health: 500, attack: 70, armor: 15 } },
  mystic: { id: 'mystic', name: '秘术师', symbol: '星', color: 0xb4a1f5, baseStats: { health: 450, attack: 80, armor: 10 } },
};
