import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { plannerDom } from './fixtures/planner-dom';
import type { LobbyView } from '../src/rendering/online/protocol';

let dom: ReturnType<typeof plannerDom>;
let lobby: import('../src/rendering/online/lobby').Lobby | undefined;
const view: LobbyView = { queue: [], capacity: 8, joined: false, canStart: false, error: null };
const plannerModule = '../src/presentation/team-planner/team-planner';
beforeEach(() => { vi.resetModules(); dom = plannerDom(); });
afterEach(() => { lobby?.dispose(); lobby = undefined; vi.doUnmock(plannerModule); vi.unstubAllGlobals(); vi.resetModules(); });
async function mount() {
  const { Lobby } = await import('../src/rendering/online/lobby');
  lobby = new Lobby(dom.document.body as unknown as HTMLElement, { join() {}, leave() {}, start() {} });
  lobby.render(view);
  return dom.document.querySelector('[data-debug="planner:open"]')!;
}
const alerts = () => dom.document.querySelectorAll('.lobby-error').filter(node => !node.hidden).map(node => node.textContent);

test('a rejected planner import stays visible across queue refreshes and preserves server errors', async () => {
  vi.doMock(plannerModule, () => { throw new Error('chunk unavailable'); });
  const opener = await mount(); opener.click(); await vi.dynamicImportSettled();
  expect(alerts()).toEqual(['阵容规划加载失败，请重试']);
  lobby!.render(view); expect(alerts()).toEqual(['阵容规划加载失败，请重试']);
  lobby!.render({ ...view, error: '队列已满' });
  expect(alerts()).toEqual(['阵容规划加载失败，请重试', '队列已满']);
});

test('an openPlanner exception reports an opening error; a successful retry clears only the planner error', async () => {
  const openPlanner = vi.fn().mockImplementationOnce(() => { throw new Error('showModal failed'); });
  vi.doMock(plannerModule, () => ({ openPlanner }));
  const opener = await mount(); opener.click(); await vi.dynamicImportSettled();
  expect(alerts()).toEqual(['阵容规划打开失败，请重试']);
  lobby!.render({ ...view, error: '队列已满' });
  expect(alerts()).toEqual(['阵容规划打开失败，请重试', '队列已满']);
  opener.click(); await vi.dynamicImportSettled();
  expect(openPlanner).toHaveBeenCalledTimes(2); expect(openPlanner).toHaveBeenLastCalledWith(opener);
  expect(alerts()).toEqual(['队列已满']);
});
