export const PLANNER_KEY = 'hex.planner.v1';

/** Called after the first rendered frame; preferences and highlighting stay lazy. */
export function restorePlannerHighlights(): void {
  try {
    if (localStorage.getItem(PLANNER_KEY)) (window.requestIdleCallback ?? window.setTimeout)(() => {
      void import('./team-planner/team-planner').then(module => module.enableShopHighlights()).catch(() => {});
    });
  } catch { /* Storage may be unavailable; opening the planner still works. */ }
}
