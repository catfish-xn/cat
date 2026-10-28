/** On-demand presentation only. All runtime selectors/catalogs are injected; this chunk has no imports. */
import type { enforcerConfiscates } from '../simulation/strategy-snapshot';
import type { UNIT_DEFINITIONS, Unit } from '../simulation/units';
import type { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import type { deriveTraits } from '../simulation/trait-snapshot';
import type { Board } from '../simulation/board';
import type { combatEquipmentDisplay } from './battle-equipment';
import type { UnitView } from './unit-view';
import type { CombatViewState } from './combat-display';
import type { GearExtras } from './equipment-feedback';
import type { PlayerView, PublicBoard } from '../rendering/online/protocol';

export interface ConfiscationDependencies {
  enforcerConfiscates: typeof enforcerConfiscates;
  units: typeof UNIT_DEFINITIONS;
  items: typeof ITEM_DEFINITIONS;
  deriveTraits: typeof deriveTraits;
  combatEquipmentDisplay: typeof combatEquipmentDisplay;
}

export default class ConfiscationDisplay {
  private view: PlayerView | null = null;
  private round = -1;
  private battles = new Map<string, { initial: CombatViewState; seat: string | null; victims?: Map<string, boolean> }>();
  constructor(private readonly dependencies: ConfiscationDependencies) {}
  observe(view: PlayerView): void {
    if (view.phase.round !== this.round) { this.battles.clear(); this.round = view.phase.round; }
    // Keep the first received combat view through settlement, even before a replay has arrived.
    // It may already be mid-combat, so it is not guaranteed to be the true opening formation.
    if (this.view?.phase.kind === 'combat' && this.view.phase.round === view.phase.round) return;
    this.view = view;
  }
  capture(initial: CombatViewState, seat: string | null = null): void {
    if (initial.combatId && !this.battles.has(initial.combatId)) this.battles.set(initial.combatId, { initial, seat });
  }
  gear(combatId: string | undefined, unitId: string, equipped: readonly string[], extras: GearExtras) {
    if (!combatId) return { equipped, extras, confiscated: false };
    const { units: UNIT_DEFINITIONS, items: ITEM_DEFINITIONS, enforcerConfiscates } = this.dependencies;
    // Matches strategy-snapshot keeps(): unknown item definitions are confiscated too, unless an emblem is known.
    const confiscatable = (id: string) => !ITEM_DEFINITIONS[id]?.emblemTrait;
    const battle = this.battles.get(combatId), view = this.view;
    if (battle && !battle.victims && view?.phase.kind === 'combat') {
      const { initial, seat } = battle, home = seat ?? view.mySeatId;
      const board = (id: string | null) => view.seats.find(s => s.seatId === id)?.publicBoard;
      const owned = board(home);
      // Watched replays omit their pairing: match the opening formation without parsing opaque ids.
      // Ambiguous/missing public data stays unknown rather than inventing a confiscation notice.
      const enemyChampions = initial.units.filter(u => u.team === 'enemy' && !UNIT_DEFINITIONS[u.definitionId]?.summon && UNIT_DEFINITIONS[u.definitionId]?.unitKind !== 'neutral');
      const matches = (candidate: PublicBoard) => candidate.units.filter(u => !u.summon).length === enemyChampions.length && candidate.units.filter(u => !u.summon).every(u => initial.units.some(v =>
        v.team === 'enemy' && v.definitionId === u.definitionId && v.starLevel === u.starLevel
        && (v.startingCell ?? v.cell).col === u.cell.col && initial.board.rows - 1 - (v.startingCell ?? v.cell).row === u.cell.row));
      const candidates = view.seats.filter(s => s.seatId !== home && s.publicBoard?.units.length && matches(s.publicBoard));
      const enemy = seat ? candidates.length === 1 ? candidates[0].publicBoard : undefined : board(view.opponentSeatId);
      try {
        const traits = ([['player', owned], ['enemy', enemy]] as const).flatMap(([team, b]) =>
          b ? this.publicTraitSnapshots(b, initial.board).map(t => ({ ...t, team })) : []);
        battle.victims = new Map(initial.units.flatMap(u => {
          const definition = UNIT_DEFINITIONS[u.definitionId], b = u.team === 'player' ? owned : enemy;
          if (!definition || definition.summon || definition.unitKind === 'neutral' || !enforcerConfiscates(traits, u.team)) return [];
          const at = u.startingCell ?? u.cell;
          const original = b?.units.find(v => v.definitionId === u.definitionId && v.cell.col === at.col
            && v.cell.row === (u.team === 'player' ? at.row : initial.board.rows - 1 - at.row));
          return [[u.id, original?.items.some(confiscatable) ?? false]];
        }));
      } catch { battle.victims = new Map(); } // Unknown public data: no stamp and no repeated per-frame exception.
    }
    const affected = battle?.victims?.has(unitId) ?? false;
    if (affected && [...equipped, ...extras.temporary].some(confiscatable)) battle!.victims!.set(unitId, true);
    const confiscated = affected && battle!.victims!.get(unitId);
    return affected ? { equipped: equipped.filter(id => !confiscatable(id)),
      extras: { reserved: 0, temporary: extras.temporary.filter(id => !confiscatable(id)) }, confiscated: !!confiscated }
      : { equipped, extras, confiscated: false };
  }
  /** Public roster + held emblems only; no private augment/orb/mirror membership projection. */
  private publicTraitSnapshots(board: PublicBoard, layout: Board) {
    const units = board.units.filter(unit => !unit.summon);
    return this.dependencies.deriveTraits({ board: layout, benchSize: 0, units: units.map((unit, index) => ({
      id: `public-${index}`, definitionId: unit.definitionId, team: 'player', starLevel: unit.starLevel as Unit['starLevel'], location: { kind: 'board', cell: unit.cell },
    })) }, 'player', undefined, undefined, units.flatMap((unit, index) => (unit.items ?? []).map((definitionId, slot) => ({
      id: `public-${index}-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: `public-${index}`, slot },
    }))));
  }
  /** One on-demand path updates both the 2D icons and the fields published to the 3D board feed. */
  sync(view: CombatViewState, views: ReadonlyMap<string, UnitView>): boolean {
    syncCombatEquipment(view, views, this.dependencies.combatEquipmentDisplay, this);
    return true;
  }
}

/** Without a confiscation projection, preserve the normal loadout and legacy opening gear. */
export function syncCombatEquipment(view: CombatViewState, views: ReadonlyMap<string, UnitView>, readEquipment: typeof combatEquipmentDisplay,
  confiscation?: ConfiscationDisplay): void {
  for (const unit of view.units) {
    const drawn = views.get(unit.id);
    if (!drawn) continue;
    const opening = readEquipment(unit.equipment, drawn.equipped, drawn.extras);
    const gear = confiscation?.gear(view.combatId, unit.id, opening.equipped, opening.extras) ?? { ...opening, confiscated: false };
    if (unit.equipment !== undefined || gear.confiscated) drawn.update({ ...unit, location: { kind: 'board', cell: unit.cell } } as Unit,
      gear.equipped, [], gear.extras, unit.effectiveStarLevel ?? unit.starLevel, unit.itemStacks);
    const on = gear.confiscated && unit.alive;
    if (on && !drawn.confiscationTag) {
      drawn.confiscationTag = drawn.token.scene.add.text(0, 53, '已没收！', { fontSize: '11px', color: '#ffd84d', backgroundColor: '#291b0a', resolution: 2 }).setOrigin(0.5);
      drawn.body.add(drawn.confiscationTag);
    }
    drawn.confiscationTag?.setVisible(on);
  }
}
