import { JAYCE_CRYSTAL_STAY } from './champions/jayce';

/**
 * What one of Jayce's crystal events draws (rules 11-21, jayceCrystal): each crystal plays as its own board source on its
 * cell, so its stay (JAYCE_CRYSTAL_STAY) ends with its own explosion, or as the next cast's crystal of the same place lands.
 * `stop` runs even in catch-up; `skill` plays only for current events.
 */
export function jayceCrystalVisual(event: { readonly unitId: string; readonly phase: 'landed' | 'exploded'; readonly crystal: number }):
  { readonly source: string; readonly stop: readonly string[]; readonly skill: 'jayce-back-crystal-land' | 'jayce-back-crystal-blast' } {
  return { source: `@jayce-crystal:${event.unitId}:${event.crystal}`, stop: [JAYCE_CRYSTAL_STAY],
    skill: event.phase === 'landed' ? 'jayce-back-crystal-land' : 'jayce-back-crystal-blast' };
}
