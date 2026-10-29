import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrategyPanel } from '../../src/rendering/strategy-panel';
import { registerRootUiAssets } from '../../src/presentation/s13-assets';

const ID = 'late-icon-probe';
const ROOT = 'https://ui-assets.invalid/late/';

class El {
  children: El[] = [];
  parent: El | null = null;
  dataset: Record<string, string> = {};
  className = '';
  private attrs: Record<string, string> = {};
  constructor(readonly tagName: string) {}
  get parentElement(): El | null { return this.parent; }
  getAttribute(name: string): string | null { return this.attrs[name] ?? null; }
  setAttribute(name: string, value: string): void { this.attrs[name] = value; }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
  private matches(selector: string): boolean {
    if (selector === '[data-augment]') return Object.hasOwn(this.dataset, 'augment');
    if (selector === 'img.augment-icon') return this.tagName === 'IMG' && this.className.split(/\s+/).includes('augment-icon');
    if (selector === '.augment-badge') return this.className.split(/\s+/).includes('augment-badge');
    return false;
  }
  private walk(): El[] { return this.children.flatMap(child => [child, ...child.walk()]); }
  querySelector(selector: string): El | null { return this.walk().find(node => node.matches(selector)) ?? null; }
  querySelectorAll(selector: string): El[] { return this.walk().filter(node => node.matches(selector)); }
  insertAdjacentHTML(_position: string, html: string): void {
    const image = new El('IMG');
    image.className = 'augment-icon';
    image.dataset.augment = /data-augment="([^"]*)"/.exec(html)?.[1] ?? '';
    image.setAttribute('src', /src="([^"]*)"/.exec(html)?.[1] ?? '');
    image.parent = this;
    this.children.unshift(image);
  }
}

function ownedChip(): { strip: El; chip: El; badge: El } {
  const strip = new El('DIV');
  const chip = new El('SPAN');
  chip.className = 'augment-chip';
  chip.dataset.augment = ID;
  chip.parent = strip;
  const badge = new El('SPAN');
  badge.className = 'augment-icon augment-badge';
  badge.dataset.augment = ID;
  badge.parent = chip;
  chip.children.push(badge);
  strip.children.push(chip);
  return { strip, chip, badge };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('late augment icons', () => {
  it('replaces only the icon when the asset root arrives and leaves the panel nodes in place', () => {
    const { strip, chip, badge } = ownedChip();
    const shop = new El('BUTTON');
    const root = new El('SECTION');
    shop.parent = root;
    root.children.push(shop);
    const drag = { element: shop, moved: true };
    const panel = Object.assign(Object.create(StrategyPanel.prototype), { augmentStrip: strip, root, itemDrag: drag });

    registerRootUiAssets(ROOT, { assets: [{ kind: 'augment', id: ID, path: 'icons/a.png' }] });
    panel.refreshAugmentIcons();

    expect(panel.root).toBe(root);
    expect(root.children).toEqual([shop]);
    expect(panel.itemDrag).toBe(drag);
    expect(strip.children).toEqual([chip]);
    expect(badge.parent).toBeNull();
    const image = chip.children[0]!;
    expect(image).not.toBe(badge);
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe(`${ROOT}icons/a.png`);

    registerRootUiAssets(ROOT, { assets: [{ kind: 'augment', id: ID, path: 'icons/b.png' }] });
    panel.refreshAugmentIcons();
    expect(chip.children[0]).toBe(image);
    expect(image.getAttribute('src')).toBe(`${ROOT}icons/b.png`);
    expect(root.children[0]).toBe(shop);
    expect(panel.itemDrag).toBe(drag);
  });
});
