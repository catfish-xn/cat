/**
 * 3D 单独加载模式的入口开关（3D 支线 A 段骨架）。默认 2D：不读 three.js、不请求任何 3D 素材。
 *  - `?render=3d` 选择 3D 模式；其余取值或缺省都是 2D。
 *  - 素材根地址：`?assets3d=<url>` 优先，其次构建变量 VITE_ASSETS3D_BASE；都没有时为 null（公开站 /cat/ 即如此），
 *    3D 模式只画合成占位棋盘。素材本身只放本地 gitignore 目录 assets3d-local/，从不进仓库。
 * Display only: nothing here reaches a rule.
 */
export type RenderMode = '2d' | '3d';

export function readRenderMode(search = window.location.search): RenderMode {
  return new URLSearchParams(search).get('render') === '3d' ? '3d' : '2d';
}

const BUILD_ASSET_BASE = ((import.meta as unknown as { env?: { VITE_ASSETS3D_BASE?: string } }).env?.VITE_ASSETS3D_BASE ?? '').trim();

/** Absolute http(s) URL ending in "/", resolved against the page; anything else (javascript:, data:, garbage) is ignored. */
export function readAssetBase3d(search = window.location.search, page = window.location.href, fallback = BUILD_ASSET_BASE): string | null {
  const raw = (new URLSearchParams(search).get('assets3d') ?? '').trim() || fallback;
  if (!raw) return null;
  try {
    const url = new URL(raw, page);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.search = ''; url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.toString();
  } catch { return null; }
}

/** Drops `render` from the address bar so a reload stays in 2D after the player switches back. */
export function withoutRenderParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('render');
  return url.toString();
}
