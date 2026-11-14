import { SHOP_CATALOG } from '../../simulation/match-rules';
import { UNIT_DEFINITIONS } from '../../simulation/units';
import { TRAIT_DEFINITIONS } from '../../simulation/content/traits';
import type { Unit } from '../../simulation/units';

import { PLANNER_KEY } from '../team-planner-loader';
export { PLANNER_KEY };
export interface PlannerState { readonly active: number; readonly plans: readonly (readonly string[])[] }
const catalog = new Set(SHOP_CATALOG);
const validPlan = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string' && catalog.has(id)))].slice(0, 10) : [];

/** Untrusted local preferences: always exactly three independent, capped plans. */
export function normalizePlanner(value: unknown): PlannerState {
  const data = value as Partial<PlannerState> | null;
  return { active: Number.isInteger(data?.active) && data!.active! >= 0 && data!.active! < 3 ? data!.active! : 0,
    plans: Array.from({ length: 3 }, (_, index) => validPlan(Array.isArray(data?.plans) ? data.plans[index] : null)) };
}
export function readPlanner(): PlannerState {
  try { return normalizePlanner(JSON.parse(localStorage.getItem(PLANNER_KEY) ?? 'null')); } catch { return normalizePlanner(null); }
}
export function writePlanner(state: PlannerState): void {
  try { localStorage.setItem(PLANNER_KEY, JSON.stringify(normalizePlanner(state))); } catch { /* This page's in-memory plan still works. */ }
}
export function selectPlan(state: PlannerState, active: number): PlannerState { return normalizePlanner({ ...state, active }); }
export function replacePlan(state: PlannerState, ids: readonly string[]): PlannerState {
  return { ...state, plans: state.plans.map((plan, index) => index === state.active ? validPlan(ids) : plan) };
}
export function toggleHero(state: PlannerState, id: string): PlannerState {
  const ids = state.plans[state.active];
  return replacePlan(state, ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
}
export function snapshotPlan(state: PlannerState, units: readonly Unit[]): PlannerState {
  return replacePlan(state, units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').map(unit => unit.definitionId));
}
export function isPlanned(state: PlannerState, id: string | undefined): boolean {
  return !!id && catalog.has(id) && state.plans[state.active].includes(id);
}

/** Hero-only estimate: no emblems, augments, anomalies or live board state. */
export function previewTraits(ids: readonly string[]) {
  const counts = new Map<string, number>();
  for (const id of validPlan(ids)) for (const trait of new Set(UNIT_DEFINITIONS[id].traits)) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  return [...counts].filter(([id]) => Object.hasOwn(TRAIT_DEFINITIONS, id)).map(([id, count]) => {
    const definition = TRAIT_DEFINITIONS[id], thresholds = definition.tiers.map(tier => tier.threshold);
    const tier = id === 'emissary' && count !== 1 && count !== 4 ? 0 : Math.max(0, ...thresholds.filter(threshold => threshold <= count));
    return { id, name: definition.name, count, tier, thresholds };
  }).sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0) || b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}
