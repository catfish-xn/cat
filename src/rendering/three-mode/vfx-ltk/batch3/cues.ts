import type { TimelineCue } from '../timeline';
export const cast = (system: string, delay = 0, duration = 1, bone?: string): TimelineCue => ({ system, event: 'cast-start', delay, duration, ...(bone ? { bone } : {}) });
export const hit = (system: string, delay = 0, duration = 1): TimelineCue => ({ system, event: 'hit', delay, duration });
export const missile = (system: string, delay = 0, travelSeconds = .4, bone?: string): TimelineCue => ({ system, event: 'projectile', delay, duration: travelSeconds + .2, travelSeconds, ...(bone ? { bone } : {}) });
export const attack = (system = '0f2af66b', delay = .3): TimelineCue => ({ ...hit(system, delay, .6), action: 'attack' });
export type HeroTimelines = Record<string, readonly TimelineCue[]>;
