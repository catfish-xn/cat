import type { ScheduleEvent } from './strategy-types';
import { freezeContent } from './content/freeze';

/** Absolute rounds remain authoritative. This data is also locked by the content digest. */
export const ROUND_SCHEDULE = freezeContent({
  fixed: [
    { round: 1, event: { id: 'r1-reward', kind: 'reward', priority: 10, components: ['blade', 'rod'], randomComponents: 0, gold: 0, recruitIfEmpty: false } },
    { round: 2, event: { id: 'r2-augment', kind: 'augment', priority: 20 } },
    { round: 3, event: { id: 'r3-reward', kind: 'reward', priority: 10, components: [], randomComponents: 1, gold: 0, recruitIfEmpty: false } },
    { round: 4, event: { id: 'r4-reward', kind: 'reward', priority: 10, components: [], randomComponents: 1, gold: 0, recruitIfEmpty: false } },
    { round: 5, event: { id: 'r5-augment', kind: 'augment', priority: 20 } },
    { round: 6, event: { id: 'r6-reward', kind: 'reward', priority: 10, components: [], randomComponents: 1, gold: 0, recruitIfEmpty: false } },
    { round: 7, event: { id: 'r7-reward', kind: 'reward', priority: 10, components: [], randomComponents: 0, gold: 2, recruitIfEmpty: true } },
    { round: 7, event: { id: 'r7-anomaly', kind: 'anomaly', priority: 30 } },
    { round: 8, event: { id: 'r8-reward', kind: 'reward', priority: 10, components: [], randomComponents: 1, gold: 0, recruitIfEmpty: false } },
  ] satisfies readonly { readonly round: number; readonly event: ScheduleEvent }[],
  recurring: { fromRound: 10, everyRounds: 2, randomComponents: 1 },
  fallbackDefinitionId: 'sentinel',
});
function requireRound(round: number): void {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Round must be a positive safe integer');
}
export function getStageRound(round: number): { readonly stage: number; readonly round: number } {
  requireRound(round);
  return { stage: 1 + Math.floor((round - 1) / 3), round: 1 + (round - 1) % 3 };
}
export function getRoundSchedule(round: number): ScheduleEvent[] {
  requireRound(round);
  const result: ScheduleEvent[] = ROUND_SCHEDULE.fixed.filter(entry => entry.round === round).map(({ event }) =>
    event.kind === 'reward' ? { ...event, components: [...event.components] } : { ...event });
  const recurring = ROUND_SCHEDULE.recurring;
  if (round >= recurring.fromRound && (round - recurring.fromRound) % recurring.everyRounds === 0) {
    result.push({ id: `r${round}-reward`, kind: 'reward', priority: 10, components: [], randomComponents: recurring.randomComponents, gold: 0, recruitIfEmpty: false });
  }
  return result.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
