import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { plannerDom } from './fixtures/planner-dom';
import { PLANNER_KEY } from '../src/presentation/team-planner/model';

let dom: ReturnType<typeof plannerDom>;
let openPlanner: typeof import('../src/presentation/team-planner/team-planner').openPlanner;
let host: ReturnType<typeof plannerDom>['document']['body'];
const panel = () => dom.document.querySelector('.team-planner');
const open = () => openPlanner(host as unknown as HTMLElement);
const closeButton = () => panel()!.querySelectorAll('button').find(node => node.textContent === '关闭')!;
function key(name: string) {
  const event = new Event('keydown', { cancelable: true }); Object.defineProperty(event, 'key', { value: name });
  dom.window.dispatchEvent(event); return event;
}

beforeEach(async () => {
  vi.resetModules(); dom = plannerDom(); host = dom.make('section');
  const opener = dom.make('button'); opener.dataset.debug = 'planner:open'; host.append(opener);
  dom.document.body.append(host); opener.focus();
  ({ openPlanner } = await import('../src/presentation/team-planner/team-planner'));
});
afterEach(() => { if (panel()) closeButton().click(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

test('opens one modal, replaces an existing panel, reuses one observer/style and restores opener focus on close', () => {
  const opener = dom.document.activeElement;
  const add = vi.spyOn(dom.window, 'addEventListener'), remove = vi.spyOn(dom.window, 'removeEventListener');
  open(); const first = panel()!;
  expect(first.open).toBe(true); expect(first.getAttribute('aria-label')).toBe('阵容规划');
  expect(first.contains(dom.document.activeElement)).toBe(true);
  open();
  expect(first.open).toBe(false); expect(first.isConnected).toBe(false);
  expect(dom.document.querySelectorAll('.team-planner')).toHaveLength(1);
  expect(dom.document.head.querySelectorAll('style')).toHaveLength(1); expect(dom.observers).toHaveLength(1);
  closeButton().click();
  expect(panel()).toBeNull(); expect(dom.document.activeElement).toBe(opener);
  const keyHandlers = add.mock.calls.filter(([type]) => type === 'keydown');
  expect(keyHandlers).toHaveLength(2);
  for (const args of keyHandlers) expect(remove.mock.calls).toContainEqual(args);
});

test('Esc and native cancel close the panel; game hotkeys stop while native editing keys stay available', () => {
  open(); const gameKey = vi.fn(); dom.window.addEventListener('keydown', gameKey);
  expect(key('d').defaultPrevented).toBe(false);
  expect(key('Tab').defaultPrevented).toBe(false);
  expect(key('Enter').defaultPrevented).toBe(false);
  expect(key(' ').defaultPrevented).toBe(false);
  expect(gameKey).not.toHaveBeenCalled();
  expect(key('Escape').defaultPrevented).toBe(true); expect(panel()).toBeNull();
  key('d'); expect(gameKey).toHaveBeenCalledTimes(1); dom.window.removeEventListener('keydown', gameKey);
  open(); const cancel = new Event('cancel', { cancelable: true }); panel()!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true); expect(panel()).toBeNull();
});

test('redrawing a selected hero or plan preserves focus, saves changes and restores focus to a replacement opener', () => {
  open();
  const hero = panel()!.querySelector('.planner-cost [data-hero="irelia"]')!; hero.focus(); hero.click();
  expect(dom.document.activeElement).toBe(panel()!.querySelector('.planner-cost [data-hero="irelia"]'));
  expect(JSON.parse(dom.data.get(PLANNER_KEY)!).plans[0]).toEqual(['irelia']);
  const tab = panel()!.querySelector('[data-action="plan-1"]')!; tab.focus(); tab.click();
  expect(dom.document.activeElement).toBe(panel()!.querySelector('[data-action="plan-1"]'));
  host.replaceChildren(); const replacement = dom.make('button'); replacement.dataset.debug = 'planner:open'; host.append(replacement);
  closeButton().click(); expect(dom.document.activeElement).toBe(replacement);
});

test.each(['hidden', 'inert', 'detached'] as const)('refuses a %s host and automatically closes when the host becomes unavailable', reason => {
  const hide = () => { if (reason === 'detached') host.remove(); else host[reason] = true; };
  open(); hide(); dom.flush(); expect(panel()).toBeNull();
  open(); expect(panel()).toBeNull();
});

test('a shop refresh restores focus to the new standalone sibling entry', () => {
  const opener = host.querySelector('[data-debug="planner:open"]')!;
  dom.document.body.append(opener); opener.focus(); open();
  opener.remove();
  const replacement = dom.make('button'); replacement.dataset.debug = 'planner:open'; dom.document.body.append(replacement);
  closeButton().click(); expect(dom.document.activeElement).toBe(replacement);
});

test('a choice hidden by CSS leaves the planner open; a visible choice closes it on class/style changes', () => {
  const overlay = dom.make('section', 'choice-overlay'); overlay.style.display = 'none'; dom.document.body.append(overlay);
  open(); dom.flush(); expect(panel()?.open).toBe(true);
  expect(dom.observers[0].options?.attributeFilter).toEqual(expect.arrayContaining(['hidden', 'inert', 'class', 'style']));
  overlay.style.display = 'block'; overlay.hidden = true; dom.flush(); expect(panel()?.open).toBe(true);
  overlay.hidden = false; dom.flush(); expect(panel()).toBeNull();
});

test('only planner storage updates (or clear) close the panel and reload the selected plan', () => {
  const storage = (key: string | null) => { const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key }); dom.window.dispatchEvent(event); };
  open(); storage('unrelated-key'); expect(panel()?.open).toBe(true);
  dom.data.set(PLANNER_KEY, JSON.stringify({ active: 2, plans: [[], [], ['lux']] })); storage(PLANNER_KEY);
  expect(panel()).toBeNull(); open();
  expect(panel()!.querySelector('[data-action="plan-2"]')!.getAttribute('aria-pressed')).toBe('true');
  expect(panel()!.querySelector('.planner-cost [data-hero="lux"]')!.getAttribute('aria-pressed')).toBe('true');
  dom.data.clear(); storage(null); expect(panel()).toBeNull(); open();
  expect(panel()!.querySelector('[data-action="plan-0"]')!.getAttribute('aria-pressed')).toBe('true');
});
