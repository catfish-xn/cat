/** Dev-only measurement entry, loaded by stage5-lag-browser.cjs, never imported by product code. */
import { BoardScene } from '../src/rendering/BoardScene';
import { RemoteSession } from '../src/rendering/online/remote-session';
import { OnlineApplication } from '../src/rendering/online/online-application';
import { WsGameClient } from '../src/rendering/online/ws-client';
import { PlayersSidebar } from '../src/rendering/online/players-sidebar';

let enabled = false, frames: number[] = [], tasks: any[] = [], spans: Record<string, number[]> = {}, mutations = 0, last = 0;
const record = (name: string, ms: number) => { if (enabled) (spans[name] ??= []).push(ms); };
function wrap(proto: any, name: string, label: string) {
  const original = proto[name];
  if (typeof original !== 'function') throw Error(`Missing browser seam ${label}`);
  proto[name] = function (this: any, ...args: any[]) {
    if (!enabled) return original.apply(this, args);
    const t = performance.now(); try { return original.apply(this, args); } finally { record(label, performance.now() - t); }
  };
}
for (const name of ['update', 'syncCombat', 'boardFrame', 'syncHud', 'renderActiveStats', 'renderFeedback', 'reconcileTokens']) wrap(BoardScene.prototype, name, `scene.${name}`);
for (const name of ['advanceDisplay', 'receiveReplay', 'reviseReplay']) wrap(RemoteSession.prototype, name, `replay.${name}`);
for (const name of ['frame', 'onView', 'onState']) wrap(OnlineApplication.prototype, name, `online.${name}`);
wrap(WsGameClient.prototype, 'onCombatStream', 'ws.onCombatStream');
for (const name of ['render', 'tick']) wrap(PlayersSidebar.prototype, name, `sidebar.${name}`);
new PerformanceObserver(list => { if (enabled) tasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }).observe({ type: 'longtask', buffered: false });
new MutationObserver(list => { if (enabled) mutations += list.length; }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
function raf(now: number) { if (enabled && last) frames.push(now - last); last = enabled ? now : 0; requestAnimationFrame(raf); }
requestAnimationFrame(raf);
(window as any).__stage5 = {
  start() {
    const renderer = (window as any).__render3d?.renderer;
    if (renderer && !renderer.__measured) { wrap(renderer, 'render', 'three.render'); renderer.__measured = true; }
    frames = []; tasks = []; spans = {}; mutations = 0; last = 0; enabled = true;
  },
  stop() {
    enabled = false;
    const gpu = (window as any).__render3d?.renderer;
    const gl = gpu?.getContext(), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { frames, tasks, spans, mutations, gpu: gpu ? { calls: gpu.info.render.calls, triangles: gpu.info.render.triangles,
      geometries: gpu.info.memory.geometries, textures: gpu.info.memory.textures, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null } : null,
      debug: (window as any).__CAT_DEBUG__?.read(), heap: (performance as any).memory?.usedJSHeapSize };
  },
};
