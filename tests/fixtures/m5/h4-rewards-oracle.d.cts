import type { Gold } from './augment-rewards-oracle.cjs';
export function goldPlan(state: unknown): Gold[];
export function activeTraits(roster: unknown, augments?: readonly unknown[]): string[];
export function validateTransition(before: unknown, after: unknown, command: unknown, events: readonly unknown[], base: unknown): void;
export const sources: readonly string[];
