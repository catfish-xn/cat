import type { Texture } from 'three';
import type { DisplayCombatEvent } from '../../presentation/combat-display';
import { ARENA_UNIT_SCALE } from './vfx-ltk/fx-size';

/**
 * Whole-fight debuff icons over a unit's bar (Fable 11-24): a small, still icon drawn as overhead sprites (unit-overhead.ts),
 * never a particle system, so it takes no effect slot or particle budget however many units carry one.
 *
 * The display events name neither the source nor the time of a stat debuff, so an icon is put on when its ability hits a
 * unit and taken off when that unit dies or the combat ends: the rules' steal lasts longer than a fight. One icon per unit
 * and kind, however often it is hit.
 */
export interface DebuffIconLayer {
  /** Width and height in board units. */
  readonly size: number;
  /** Multiplied onto the texture, as the particle's colour was. */
  readonly color: readonly [number, number, number];
  readonly opacity: number;
}
export interface DebuffIconDef {
  /** The ability whose direct hit puts the icon on its target (packetDamage definitionId). */
  readonly ability: string;
  /** Where the icon's texture is: the champion's vfx-ltk package and the asset key its index maps to a file. */
  readonly champion: string;
  readonly textureKey: string;
  /** Back to front, as the system's emitters draw. */
  readonly layers: readonly DebuffIconLayer[];
}
/** An icon shown on a unit's bar: its kind and loaded texture. */
export interface OverheadDebuff { readonly kind: string; readonly texture: Texture; readonly layers: readonly DebuffIconLayer[] }

/** League units → board units: the arena scale every skill effect is drawn at (fx-size.ts). */
const lu = (units: number) => units * ARENA_UNIT_SCALE;
/**
 * Rell's defence steal (her Q's armour/magic-resist shred system 5fe3dc8a): the system's two still camera-facing quads, the
 * same broken-shield texture tinted twice, a larger dim purple one behind a slightly smaller pale blue one. Their sizes,
 * tints and opacities are read from that system.
 */
export const RELL_SHRED: DebuffIconDef = {
  ability: 'rell-ability',
  champion: 'rell',
  textureKey: 'assets/characters/tft13_rell/skins/base/particles/tft13_rell_base_q_armor_mr_shred2.tft_set13.tex',
  layers: [
    { size: lu(36), color: [0.43, 0.24, 0.51], opacity: 0.41 },
    { size: lu(32), color: [0.49, 0.64, 1], opacity: 0.78 },
  ],
};
export const DEBUFF_ICONS: Readonly<Record<string, DebuffIconDef>> = { 'rell-shred': RELL_SHRED };

/** Which units carry which icon, from the display events. */
export function createDebuffMarks(defs: Readonly<Record<string, DebuffIconDef>> = DEBUFF_ICONS) {
  const marks = new Map<string, Set<string>>();
  const byAbility = new Map(Object.entries(defs).map(([kind, def]) => [def.ability, kind]));
  return {
    /** True when the event changed some unit's icons. */
    next(event: DisplayCombatEvent): boolean {
      if (event.type === 'packetDamage') {
        const { definitionId, sourceKind, hit } = event as { definitionId?: string; sourceKind?: string; hit?: boolean };
        const kind = definitionId === undefined ? undefined : byAbility.get(definitionId);
        if (!kind || sourceKind !== 'ability' || hit === false) return false;
        let set = marks.get(event.targetId); if (!set) marks.set(event.targetId, set = new Set());
        if (set.has(kind)) return false;
        set.add(kind); return true;
      }
      const gone = event.type === 'death' ? event.unitId : event.type === 'unitRemoved' || event.type === 'unitLeft' ? event.unitId : undefined;
      return gone !== undefined && marks.delete(gone);
    },
    /** The icon kinds a unit carries now, in a fixed order. */
    of(id: string): readonly string[] { const set = marks.get(id); return set ? Object.keys(defs).filter(kind => set.has(kind)) : []; },
    /** A new combat, a rewind or the end of a fight: nobody carries anything. */
    clear(): void { marks.clear(); },
  };
}
