import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchHudRules } from '../src/rendering/three-mode/batch-hud-skin';
import { startOriginalUi, type ReadyUiSprite, type UiPlatform } from '../src/rendering/three-mode/ui-original-assets';
import { createOriginalStarMark } from '../src/rendering/three-mode/original-stars';
import { uiSha256 } from '../src/rendering/three-mode/ui-sha256';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const sprite = (id = 'normal'): ReadyUiSprite => ({ source: {} as CanvasImageSource, width: 24, height: 16, url: `blob:${id}`, dispose: vi.fn() });
describe('optional batch skin behavior', () => {
  it('scopes every selector to 3D and preserves numeric streak content and hidden player bars', () => {
    const rules = batchHudRules(new Map(['button.refresh', 'button.refresh.hover', 'button.refresh.disabled', 'streak.win', 'generic.panel', 'star.1'].map(id => [id, sprite(id)])));
    for (const rule of rules.split('\n')) expect(rule.startsWith('body')).toBe(true);
    expect(rules).toContain(':has('); expect(rules).toContain(':not(:disabled):is(:hover,:focus-visible)');
    expect(rules).toContain(':disabled{'); expect(rules).toContain('content:attr(data-value);');
    expect(rules).not.toContain('.seat-bar'); expect(rules).not.toContain('.hud-xp');
    expect(batchHudRules(new Map())).toBe('');
  });
  it('retains the existing lock decoration and visible label for every unreviewed interaction state', () => {
    const rules = batchHudRules(new Map([['button.lock.on', sprite()]]));
    expect(rules).toContain(':not(:hover):not(:focus-visible):not(:active):not(:disabled){');
    expect(rules).toContain(':not(:hover):not(:focus-visible):not(:active):not(:disabled){font-size:0!important;}');
    expect(rules).not.toMatch(/\[aria-pressed="true"\]\)\{font-size:0/);
  });
  it('restricts every empty-slot state to the ordinary shop, excluding black-market and anvil offer cards', () => {
    // Both choice flows use .shop-panel.shop-choice and .shop-card.shop-offer,
    // without data-unit-def. Missing hero metadata alone cannot identify a slot.
    const ids = ['shop.empty', ...['hover', 'pressed', 'disabled', 'selected'].map(s => `shop.empty.${s}`)];
    const rules = batchHudRules(new Map(ids.map(id => [id, sprite(id)]))).split('\n');
    expect(rules).toHaveLength(ids.length);
    for (const rule of rules) {
      expect(rule).toContain('body:has(.render3d-layer) :is(.shop-dock .shop-panel:not(.shop-choice) > .touch-shop > .shop-card:not(.shop-offer):not([data-unit-def]))');
      expect(rule).toContain('background:');
    }
    expect(batchHudRules(new Map())).not.toContain('shop-card');
  });
  it('decorates player meters without revealing the hidden 3D strip or changing server-provided widths', () => {
    const rules = batchHudRules(new Map([['player.hp-track', sprite()], ['player.hp-fill', sprite()]]));
    expect(rules).toContain('.seat-bar'); expect(rules).toContain('.seat-fill');
    expect(rules).not.toMatch(/(?:^|[;{])(?:display|visibility|width|height|min-width|max-width):/);
  });
  it('replaces a late star row without losing its effective level; releases private textures, subscriptions and fallback', () => {
    const ready = new Map<string, ReadyUiSprite>(); let notify = () => {}; const unsubscribe = vi.fn();
    const stars = createOriginalStarMark({ effectiveStarLevel: 2, colorFor: () => '#fff', ui: {
      sprite: id => ready.get(id), subscribe: fn => { notify = fn; return unsubscribe; },
    } });
    expect(stars.object.children[0].visible).toBe(true);
    ready.set('star.2', sprite('two')); notify();
    expect(stars.object.children[0].visible).toBe(false); expect(stars.object.children[1].name).toBe('render3d-original-stars');
    const row = stars.object.children[1] as any, textureDisposed = vi.spyOn(row.material.map, 'dispose');
    stars.setLevel(3); expect(textureDisposed).toHaveBeenCalledTimes(1); expect(stars.object.children[0].visible).toBe(true);
    ready.set('star.3', sprite('three')); notify(); expect(stars.object.children).toHaveLength(2);
    stars.dispose(); stars.dispose(); notify(); expect(unsubscribe).toHaveBeenCalledTimes(1); expect(stars.object.children).toHaveLength(0);
  });
  it('loads new semantic sprites through the same hash/decode/dispose boundary', async () => {
    const data = 'image', bytes = new Blob([data]), t = { path: 'textures/test.png', width: 24, height: 16, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    const raw = { schemaVersion: 1, sourceVersion: '14.24.6442327', textures: { t }, fonts: {}, sprites: {
      'button.refresh': { texture: 't', rect: [0, 0, 12, 8] }, 'button.refresh.disabled': { texture: 't', rect: [12, 8, 12, 8] },
      'star.3': { texture: 't', rect: [0, 0, 12, 8] },
    } };
    const disposed = vi.fn(), style = { set: vi.fn(), dispose: vi.fn() }, imageDispose = vi.fn();
    const p: UiPlatform = { image: async () => ({ source: {} as CanvasImageSource, dispose: imageDispose }),
      crop: async (_s, r) => ({ ...sprite(), width: r[2], height: r[3], dispose: disposed }),
      font: () => { throw Error('unexpected font'); }, style: () => style };
    const ui = startOriginalUi('https://assets.test/', async path => path.endsWith('.json') ? new Blob([JSON.stringify(raw)]) : bytes, p);
    await ui.ready; expect(ui.sprite('star.3')).toBeDefined(); expect(style.set.mock.calls[0][0]).toContain('[data-debug="reroll"]');
    ui.dispose(); expect(disposed).toHaveBeenCalledTimes(3); expect(imageDispose).toHaveBeenCalledTimes(1); expect(style.dispose).toHaveBeenCalledTimes(1);
  });
});
describe('SHA-256 without a secure-context API', () => {
  it.each(['', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(65), '金币'.repeat(100)])('matches independent Node digest for %s', async data => {
    vi.stubGlobal('crypto', undefined);
    expect(await uiSha256(new Blob([data]))).toBe(createHash('sha256').update(data).digest('hex'));
  });
});
