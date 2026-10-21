import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountRenderer3d, Renderer3d } from '../src/rendering/three-mode/contract';

/** Minimal host DOM: no canvas, WebGL, jsdom or actual assets. */
class Element {
  children: Element[] = [];
  parent: Element | null = null;
  dataset: Record<string, string> = {};
  className = '';
  textContent = '';
  type = '';
  clientWidth = 800;
  clientHeight = 600;
  private listeners = new Map<string, () => void>();
  append(...children: Element[]): void { for (const child of children) { child.parent = this; this.children.push(child); } }
  remove(): void { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  addEventListener(event: string, listener: () => void): void { this.listeners.set(event, listener); }
  click(): void { this.listeners.get('click')?.(); }
}

describe('optional 3D mode import boundary and fallback', () => {
  let board: Element, original2d: Element, renderer: Renderer3d;
  let mount: ReturnType<typeof vi.fn<MountRenderer3d>>;
  let evaluations: { chunk: number; three: number; rejectImport: boolean };
  let observe: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, createElement: ReturnType<typeof vi.fn>;
  let settled: Promise<void>, mountStarted: Promise<void>, rendererDisposed: Promise<void>;
  let signalSettled: () => void, signalMount: () => void, signalDisposed: () => void;
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); vi.stubEnv('VITE_ASSETS3D_BASE', '');
    board = new Element(); original2d = new Element(); original2d.dataset.debug = 'existing-2d-board'; board.append(original2d);
    evaluations = { chunk: 0, three: 0, rejectImport: false };
    settled = new Promise<void>(done => { signalSettled = done; });
    mountStarted = new Promise<void>(done => { signalMount = done; });
    rendererDisposed = new Promise<void>(done => { signalDisposed = done; });
    renderer = { status: 'placeholder', detail: 'synthetic', resize: vi.fn(), dispose: vi.fn(() => signalDisposed()) };
    mount = vi.fn<MountRenderer3d>().mockImplementation(async () => { signalMount(); return renderer; });
    observe = vi.fn(() => signalSettled()); disconnect = vi.fn(() => signalSettled()); createElement = vi.fn(() => new Element());
    vi.stubGlobal('window', { location: { search: '', href: 'https://example.test/cat/' } });
    vi.stubGlobal('document', { createElement });
    vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Evaluate the real renderer module and its real three dependency only when
    // imported. Substitute mounting to avoid constructing a WebGL context.
    vi.doMock('three', async importOriginal => {
      evaluations.three++;
      return importOriginal();
    });
    vi.doMock('../src/rendering/three-mode/placeholder-renderer', async importOriginal => {
      evaluations.chunk++;
      if (evaluations.rejectImport) throw new Error('synthetic chunk unavailable');
      const actual = await importOriginal<typeof import('../src/rendering/three-mode/placeholder-renderer')>();
      return { ...actual, mountRenderer3d: mount };
    });
  });
  afterEach(async () => {
    await vi.dynamicImportSettled();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    vi.doUnmock('../src/rendering/three-mode/placeholder-renderer'); vi.doUnmock('three'); vi.doUnmock('../src/rendering/render-mode'); vi.resetModules();
  });

  it.each(['', '?render=2d', '?render=3D', '?unrelated=1', '?assets3d=/assets3d-local/'])('keeps 2D without an explicit render=3d switch: %s', async search => {
    window.location.search = search;
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    const { readRenderMode, readAssetBase3d } = await import('../src/rendering/render-mode');
    expect(readRenderMode()).toBe('2d');
    if (!search) expect(readAssetBase3d()).toBeNull();
    const handle = mountThreeMode(board as unknown as HTMLElement);
    await vi.dynamicImportSettled(); handle.dispose(); handle.dispose();
    expect(evaluations).toEqual({ chunk: 0, three: 0, rejectImport: false });
    expect(mount).not.toHaveBeenCalled(); expect(createElement).not.toHaveBeenCalled(); expect(board.children).toEqual([original2d]);
  });
  it('does not enable 3D merely because an asset root is configured', async () => {
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    const { readAssetBase3d } = await import('../src/rendering/render-mode');
    // The explicit fallback is the public seam for a build-time constant; env
    // substitutions are fixed by Vite's transform rather than runtime changes.
    expect(readAssetBase3d('', window.location.href, 'https://cdn.example.test/3d/')).toBe('https://cdn.example.test/3d/');
    mountThreeMode(board as unknown as HTMLElement); await vi.dynamicImportSettled();
    expect(evaluations.chunk).toBe(0); expect(evaluations.three).toBe(0); expect(board.children).toEqual([original2d]);
  });
  it('evaluates the renderer and three only after opt-in, using a placeholder when no asset root exists', async () => {
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    expect(evaluations.chunk).toBe(0); expect(evaluations.three).toBe(0);
    const handle = mountThreeMode(board as unknown as HTMLElement, '?render=3d'); await settled;
    expect(evaluations.chunk).toBe(1); expect(evaluations.three).toBe(1);
    const layer = board.children.find(child => child.dataset.debug === 'render3d-layer')!;
    expect(mount).toHaveBeenCalledExactlyOnceWith(layer, { assetBase: null });
    expect(layer.dataset.state).toBe('placeholder'); expect(observe).toHaveBeenCalledWith(layer); expect(board.children).toContain(original2d);
    handle.dispose(); handle.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1); expect(board.children).toEqual([original2d]);
  });
  it.each(['import', 'mount'])('falls back to the original 2D board after %s failure', async failure => {
    evaluations.rejectImport = failure === 'import';
    if (failure === 'mount') mount.mockRejectedValueOnce(new Error('synthetic WebGL unavailable'));
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    const handle = mountThreeMode(board as unknown as HTMLElement, '?render=3d'); await settled;
    expect(board.children).toContain(original2d); expect(board.children.some(child => child.dataset.debug === 'render3d-layer')).toBe(false);
    const notice = board.children.find(child => child.dataset.debug === 'render3d-fallback');
    expect(notice?.textContent).toContain('2D'); expect(console.warn).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
    handle.dispose(); expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('offers a 3D button on the 2D page only when the build has an asset root, and comes back to it from 3D', async () => {
    // Vite fixes the build constant at transform time, so the build root is stood in for at its reader.
    vi.doMock('../src/rendering/render-mode', async importOriginal => {
      const actual = await importOriginal<typeof import('../src/rendering/render-mode')>();
      const base = (search = '', page = 'https://example.test/cat/') => actual.readAssetBase3d(search, page, 'https://cdn.example.test/3d');
      return { ...actual, buildAssetBase3d: () => base(), readAssetBase3d: base };
    });
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    const handle = mountThreeMode(board as unknown as HTMLElement, '?mode=online');
    const enter = () => board.children.find(child => child.dataset.debug === 'render3d-enter');
    expect(enter()?.textContent).toBe('切换 3D');
    await vi.dynamicImportSettled();
    expect(evaluations.chunk).toBe(0); expect(evaluations.three).toBe(0); // the button alone loads nothing
    enter()!.click(); await settled;
    expect(history.replaceState).toHaveBeenCalledWith(null, '', 'https://example.test/cat/?render=3d');
    expect(enter()).toBeUndefined();
    const layer = board.children.find(child => child.dataset.debug === 'render3d-layer')!;
    expect(mount).toHaveBeenCalledExactlyOnceWith(layer, { assetBase: 'https://cdn.example.test/3d/' });
    const back = layer.children[0].children.find(child => child.dataset.debug === 'render3d-exit')!;
    back.click();
    expect(renderer.dispose).toHaveBeenCalledTimes(1); expect(enter()).toBeDefined();
    handle.dispose(); vi.doUnmock('../src/rendering/render-mode');
    expect(board.children).toEqual([original2d]);
  });
  it('disposes a late renderer when the player leaves 3D before mounting completes', async () => {
    let resolve!: (renderer: Renderer3d) => void;
    const pending = new Promise<Renderer3d>(done => { resolve = done; });
    mount.mockImplementationOnce(() => { signalMount(); return pending; });
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    const handle = mountThreeMode(board as unknown as HTMLElement, '?render=3d');
    handle.dispose(); await mountStarted; resolve(renderer); await rendererDisposed;
    expect(renderer.dispose).toHaveBeenCalledTimes(1); expect(observe).not.toHaveBeenCalled(); expect(board.children).toEqual([original2d]);
  });
});
