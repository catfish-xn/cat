/** Presentation only: public trait selectors; no writes to inventory or combat frames. */
import { enforcerConfiscates } from '../../simulation/strategy-snapshot';
import { UNIT_DEFINITIONS } from '../../simulation/units';
import { ITEM_DEFINITIONS } from '../../simulation/content/g2-3-item-registry';
import type { CombatViewState } from '../../presentation/combat-display';
import type { GearExtras } from '../../presentation/equipment-feedback';
import type { PlayerView, PublicBoard } from './protocol';
import { publicTraitSnapshots } from './opponent-board';

const confiscatable = (id: string) => !!ITEM_DEFINITIONS[id] && !ITEM_DEFINITIONS[id].emblemTrait;
export class ConfiscationDisplay {
  private view: PlayerView | null = null;
  private round = -1;
  private battles = new Map<string | undefined, { initial: CombatViewState; seat: string | null; victims?: Map<string, boolean> }>();
  observe(view: PlayerView): void {
    if (view.phase.round !== this.round) { this.battles.clear(); this.round = view.phase.round; }
    // Freeze at combat entry: mid-combat deployments affect the next round.
    if (view.phase.kind === 'combat' && this.view?.phase.kind === 'combat' && this.view.phase.round === view.phase.round) return;
    this.view = view;
  }
  capture(initial: CombatViewState, seat: string | null = null): void {
    if (!this.battles.has(initial.combatId)) this.battles.set(initial.combatId, { initial, seat });
  }
  gear(combatId: string | undefined, unitId: string, equipped: readonly string[], extras: GearExtras) {
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
      const traits = ([['player', owned], ['enemy', enemy]] as const).flatMap(([team, b]) =>
        b ? publicTraitSnapshots(b, initial.board).map(t => ({ ...t, team })) : []);
      battle.victims = new Map(initial.units.flatMap(u => {
        const definition = UNIT_DEFINITIONS[u.definitionId], b = u.team === 'player' ? owned : enemy;
        if (!definition || definition.summon || definition.unitKind === 'neutral' || !enforcerConfiscates(traits, u.team)) return [];
        const at = u.startingCell ?? u.cell;
        const original = b?.units.find(v => v.definitionId === u.definitionId && v.cell.col === at.col
          && v.cell.row === (u.team === 'player' ? at.row : initial.board.rows - 1 - at.row));
        return [[u.id, original?.items.some(confiscatable) ?? false]];
      }));
    }
    const affected = battle?.victims?.has(unitId) ?? false;
    if (affected && [...equipped, ...extras.temporary].some(confiscatable)) battle!.victims!.set(unitId, true);
    const confiscated = affected && battle!.victims!.get(unitId);
    return affected ? { equipped: equipped.filter(id => !confiscatable(id)),
      extras: { reserved: 0, temporary: extras.temporary.filter(id => !confiscatable(id)) }, confiscated: !!confiscated }
      : { equipped, extras, confiscated: false };
  }
}
