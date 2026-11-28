import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { plannerDom } from './fixtures/planner-dom';

const plannerModule = '../src/presentation/team-planner/team-planner';
let dom: ReturnType<typeof plannerDom>;
let imported = vi.fn<() => void>();
let pendingImport: Promise<unknown>;
beforeEach(() => {
  vi.resetModules(); dom = plannerDom(); imported = vi.fn<() => void>();
  vi.doMock(plannerModule, () => { imported(); return pendingImport = vi.importActual(plannerModule); });
});
afterEach(() => { vi.doUnmock(plannerModule); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

test.each(['idle', 'timeout'] as const)('a saved plan restores shop highlights on a fresh page through %s, without opening the panel', async scheduler => {
  const { PLANNER_KEY, restorePlannerHighlights } = await import('../src/presentation/team-planner-loader');
  dom.data.set(PLANNER_KEY, JSON.stringify({ active: 1, plans: [[], ['irelia'], []] }));
  const dock = dom.make('section', 'shop-dock'), card = dom.make('button', 'shop-card upgrade');
  card.dataset.unitDef = 'irelia'; card.setAttribute('aria-label', '购买 艾瑞莉娅'); dock.append(card); dom.document.body.append(dock);
  const schedule = vi.fn();
  Object.assign(dom.window, { requestIdleCallback: scheduler === 'idle' ? schedule : undefined, setTimeout: schedule });
  restorePlannerHighlights();
  expect(schedule).toHaveBeenCalledTimes(1); expect(imported).not.toHaveBeenCalled();
  expect(card.classList.contains('planned')).toBe(false);
  schedule.mock.calls[0][0](); await vi.dynamicImportSettled();
  // Await the real dependency graph loaded inside the mock factory as well.
  await pendingImport; await vi.dynamicImportSettled();
  expect(imported).toHaveBeenCalledTimes(1);
  expect(card.classList.contains('planned')).toBe(true); expect(card.classList.contains('upgrade')).toBe(true);
  expect(card.querySelectorAll('.planner-mark')).toHaveLength(1);
  expect(dom.document.querySelector('.team-planner')).toBeNull();
  expect(dom.observers).toHaveLength(1); expect(dom.observers[0].target).toBe(dock);
  expect(dom.observers[0].options).toEqual({ childList: true, subtree: true, attributes: true, attributeFilter: ['data-unit-def'] });
  const styles = vi.spyOn(globalThis, 'getComputedStyle');
  const next = dom.make('button', 'shop-card'); next.dataset.unitDef = 'irelia'; dock.replaceChildren(next);
  dom.flush([{ target: dock, type: 'childList' } as unknown as MutationRecord]);
  expect(next.classList.contains('planned')).toBe(true); expect(styles).not.toHaveBeenCalled();
  next.dataset.unitDef = 'lux';
  dom.flush([{ target: next, type: 'attributes', attributeName: 'data-unit-def' } as unknown as MutationRecord]);
  expect(next.classList.contains('planned')).toBe(false);
});

test.each(['absent', 'blocked'] as const)('a %s local preference neither schedules work nor imports the planner', async storage => {
  const { restorePlannerHighlights } = await import('../src/presentation/team-planner-loader');
  if (storage === 'blocked') vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); } });
  const idle = vi.fn(), timeout = vi.fn(); Object.assign(dom.window, { requestIdleCallback: idle, setTimeout: timeout });
  expect(() => restorePlannerHighlights()).not.toThrow(); await vi.dynamicImportSettled();
  expect(idle).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled(); expect(imported).not.toHaveBeenCalled();
  expect(dom.document.head.querySelectorAll('style')).toHaveLength(0); expect(dom.observers).toHaveLength(0);
});

test('an unavailable idle chunk is caught and leaves the manual opener available for retry', async () => {
  vi.doMock(plannerModule, () => { throw new Error('chunk unavailable'); });
  const { PLANNER_KEY, restorePlannerHighlights } = await import('../src/presentation/team-planner-loader');
  dom.data.set(PLANNER_KEY, '{}');
  const schedule = vi.fn(); Object.assign(dom.window, { requestIdleCallback: schedule });
  restorePlannerHighlights(); schedule.mock.calls[0][0](); await vi.dynamicImportSettled();
  expect(dom.document.querySelector('.team-planner')).toBeNull();
});
