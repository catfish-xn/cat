import { JAYCE_CRYSTAL_STAY } from './champions/jayce';
import type { WorldPoint } from './timeline';

/** The runtime calls Jayce's crystals make (placeholder-renderer.ts passes its vfx-ltk runtime). */
export interface JayceCrystalHost {
  stopSystems(source: string, systems: readonly string[]): void;
  play(champion: string, source: string, targets: readonly string[], action: 'passive', context: { skill: string; board: WorldPoint }): boolean;
}
type CrystalEvent = { readonly type: 'jayceCrystal'; readonly unitId: string; readonly phase: 'landed' | 'exploded'; readonly crystal: number };

/**
 * Jayce's crystals (rules 11-21, jayceCrystal): each lands on its cell and stays there until the rules set it off, then
 * explodes on that cell. Each crystal plays as its own board source, so its stay (JAYCE_CRYSTAL_STAY) ends with its own
 * explosion, or as the next cast's crystal of the same place lands: the stay is always stopped before anything of that
 * crystal plays. Should Jayce die first, the rules drop his pending explosions (combat-s13.ts: a dead unit keeps only its
 * non-cancellable landings, damage over time and bounces), so his crystals still standing end with his death.
 * In catch-up (`current` false) stays are still ended, nothing is started.
 */
export function createJayceCrystals(host: JayceCrystalHost) {
  const standing = new Map<string, Set<string>>();
  const sourceOf = (unitId: string, crystal: number) => `@jayce-crystal:${unitId}:${crystal}`;
  return {
    /** One crystal event, its cell's world point `at`. */
    crystal(event: CrystalEvent, at: WorldPoint, current: boolean) {
      const source = sourceOf(event.unitId, event.crystal), mine = standing.get(event.unitId) ?? new Set<string>();
      host.stopSystems(source, [JAYCE_CRYSTAL_STAY]);
      mine.delete(source);
      if (event.phase === 'landed') { mine.add(source); standing.set(event.unitId, mine); }
      if (current) host.play('jayce', source, [], 'passive', { skill: event.phase === 'landed' ? 'jayce-back-crystal-land' : 'jayce-back-crystal-blast', board: at });
    },
    /** A unit died: if it is a Jayce with crystals still standing, they end now (no explosion will come for them). */
    death(unitId: string) {
      for (const source of standing.get(unitId) ?? []) host.stopSystems(source, [JAYCE_CRYSTAL_STAY]);
      standing.delete(unitId);
    },
    clear() { standing.clear(); },
  };
}
